"""Paper processing pipeline: parse -> chunk -> embed (Chroma) -> analyze."""
import asyncio
import logging

from sqlalchemy import delete, select

from paperpal.core.config import get_settings
from paperpal.db.models import Paper, PaperChunk, ProcessingJob
from paperpal.db.session import SessionLocal
from paperpal.ingestion.chunker import chunk_blocks
from paperpal.ingestion.parser import extract_pdf
from paperpal.rag import vectorstore
from paperpal.services.analysis_service import analyze_paper
from paperpal.services.storage import read_pdf

logger = logging.getLogger(__name__)
_background_tasks: set[asyncio.Task] = set()

ERROR_MESSAGES = {
    "invalid_pdf": "The file could not be opened as a PDF.",
    "page_limit_exceeded": "The PDF has more pages than the configured limit.",
    "no_extractable_text": "No text could be extracted. Scanned PDFs need OCR, which isn't supported yet.",
}


async def _set_stage(paper_id: str, job_id: str, stage: str, status: str = "processing") -> None:
    async with SessionLocal() as session:
        paper, job = await session.get(Paper, paper_id), await session.get(ProcessingJob, job_id)
        if paper and job:
            paper.status, job.status, job.stage = status, status, stage
            await session.commit()


def _guess_title(paper: Paper, title_guess: str | None, chunks: list[PaperChunk]) -> str:
    if paper.arxiv_id:
        return paper.title
    if title_guess:
        return title_guess
    front = next((c for c in chunks if c.section_type == "front_matter"), None)
    first_line = front.text.split("\n\n")[0] if front else ""
    return first_line[:200] if 10 < len(first_line) < 200 else paper.title


async def process_paper(paper_id: str, job_id: str) -> None:
    settings = get_settings()
    try:
        async with SessionLocal() as session:
            paper = await session.get(Paper, paper_id)
            if not paper or not paper.storage_key:
                return
            storage_key = paper.storage_key
        await _set_stage(paper_id, job_id, "parsing")
        parsed = await asyncio.to_thread(extract_pdf, await read_pdf(storage_key), settings.max_pdf_pages)
        chunks = chunk_blocks(parsed.blocks)
        if not chunks:
            raise ValueError("no_extractable_text")

        async with SessionLocal() as session:
            paper = await session.get(Paper, paper_id)
            job = await session.get(ProcessingJob, job_id)
            if not paper or not job:
                return
            await session.execute(delete(PaperChunk).where(PaperChunk.paper_id == paper_id))
            session.add_all(
                PaperChunk(
                    paper_id=paper_id, section_title=c.section_title[:500], section_type=c.section_type,
                    page_start=c.page_start, page_end=c.page_end, text=c.text,
                    token_count=c.token_count, chunk_index=c.chunk_index,
                )
                for c in chunks
            )
            job.stage, paper.page_count = "embedding", parsed.page_count
            await session.commit()
            persisted = list(
                (await session.scalars(
                    select(PaperChunk).where(PaperChunk.paper_id == paper_id).order_by(PaperChunk.chunk_index)
                )).all()
            )
            paper.title = _guess_title(paper, parsed.title_guess, persisted)
            if not paper.abstract:
                paper.abstract = " ".join(c.text for c in persisted if c.section_type == "abstract")[:3000]
            await session.commit()
            title, abstract = paper.title, paper.abstract

        await asyncio.to_thread(vectorstore.index_chunks, paper_id, persisted)
        await _set_stage(paper_id, job_id, "analyzing")
        analysis = await analyze_paper(persisted, title, abstract)

        async with SessionLocal() as session:
            paper, job = await session.get(Paper, paper_id), await session.get(ProcessingJob, job_id)
            if paper and job:
                paper.analysis = analysis
                paper.status, paper.error_code = "ready", None
                job.status, job.stage, job.error_code = "completed", "done", None
                await session.commit()
        logger.info("Processed paper %s: %d pages, %d chunks", paper_id, parsed.page_count, len(chunks))
    except Exception as exc:
        logger.exception("Processing failed for paper %s", paper_id)
        code = str(exc)
        message = ERROR_MESSAGES.get(code, f"Processing failed: {code}"[:200])
        async with SessionLocal() as session:
            paper, job = await session.get(Paper, paper_id), await session.get(ProcessingJob, job_id)
            if paper and job:
                paper.status, paper.error_code = "failed", message
                job.status, job.error_code, job.attempts = "failed", message, job.attempts + 1
                await session.commit()
        raise


def dispatch_processing(paper_id: str, job_id: str) -> None:
    """Hand processing to Celery when configured, otherwise run it in the API's event loop."""
    if get_settings().use_celery:
        from paperpal.workers.tasks import process_pdf

        process_pdf.delay(paper_id, job_id)
        return

    async def run() -> None:
        try:
            await process_paper(paper_id, job_id)
        except Exception:
            pass  # the failure is recorded on the job and paper

    task = asyncio.create_task(run())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
