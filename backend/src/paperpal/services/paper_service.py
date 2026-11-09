from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from paperpal.core.config import get_settings
from paperpal.core.exceptions import (
    ConflictError,
    NotFoundError,
    PayloadTooLargeError,
    UnsupportedMediaError,
    UpstreamError,
)
from paperpal.db.models import Paper, PaperChunk, ProcessingJob
from paperpal.ingestion.arxiv import fetch_arxiv
from paperpal.rag import vectorstore
from paperpal.schemas.paper import PaperOut, SectionOut
from paperpal.services import storage
from paperpal.services.ingestion_service import dispatch_processing


def to_out(paper: Paper, job_id: str | None = None) -> PaperOut:
    return PaperOut.model_validate(paper).model_copy(update={"job_id": job_id})


async def get_owned_paper(session: AsyncSession, paper_id: str, user_id: str) -> Paper:
    paper = await session.scalar(select(Paper).where(Paper.id == paper_id, Paper.owner_id == user_id))
    if not paper:
        raise NotFoundError("Paper not found")
    return paper


async def latest_job(session: AsyncSession, paper_id: str) -> ProcessingJob | None:
    return await session.scalar(
        select(ProcessingJob).where(ProcessingJob.paper_id == paper_id).order_by(ProcessingJob.created_at.desc())
    )


async def get_owned_job(session: AsyncSession, job_id: str, user_id: str) -> ProcessingJob:
    job = await session.get(ProcessingJob, job_id)
    if not job or not await session.scalar(select(Paper.id).where(Paper.id == job.paper_id, Paper.owner_id == user_id)):
        raise NotFoundError("Job not found")
    return job


async def list_papers(session: AsyncSession, user_id: str) -> list[PaperOut]:
    papers = (await session.scalars(
        select(Paper).where(Paper.owner_id == user_id).order_by(Paper.created_at.desc())
    )).all()
    return [to_out(p) for p in papers]


async def _create(session: AsyncSession, user_id: str, content: bytes, **fields) -> tuple[Paper, ProcessingJob]:
    paper_id = str(uuid4())
    storage_key = await storage.save_pdf(paper_id, content)
    paper = Paper(id=paper_id, owner_id=user_id, storage_key=storage_key, status="queued", **fields)
    job = ProcessingJob(paper_id=paper_id, status="queued", stage="queued")
    session.add_all([paper, job])
    await session.commit()
    dispatch_processing(paper.id, job.id)
    return paper, job


async def create_from_upload(session: AsyncSession, user_id: str, file: UploadFile) -> tuple[Paper, ProcessingJob]:
    settings = get_settings()
    if file.content_type != "application/pdf" and not (file.filename or "").lower().endswith(".pdf"):
        raise UnsupportedMediaError("Please upload a PDF file")
    content = await file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise PayloadTooLargeError(f"PDFs are limited to {settings.max_upload_bytes // (1024 * 1024)} MB")
    if not content.startswith(b"%PDF-"):
        raise UnsupportedMediaError("The uploaded file is not a valid PDF")
    title = Path(file.filename or "Untitled paper").stem.replace("_", " ")[:300]
    return await _create(session, user_id, content, title=title)


async def _download_pdf(url: str) -> bytes:
    limit = get_settings().max_upload_bytes
    buffer = bytearray()
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            async for part in response.aiter_bytes():
                buffer.extend(part)
                if len(buffer) > limit:
                    raise PayloadTooLargeError("The arXiv PDF exceeds the upload limit")
    if not buffer.startswith(b"%PDF-"):
        raise UpstreamError("arXiv did not return a valid PDF")
    return bytes(buffer)


async def create_from_arxiv(session: AsyncSession, user_id: str, value: str) -> tuple[Paper, ProcessingJob | None]:
    try:
        metadata = await fetch_arxiv(value, get_settings().arxiv_timeout_seconds)
    except ValueError as exc:
        raise NotFoundError(str(exc)) from exc
    except httpx.HTTPError as exc:
        raise UpstreamError(f"Could not reach arXiv: {exc}") from exc
    existing = await session.scalar(
        select(Paper).where(Paper.arxiv_id == metadata["arxiv_id"], Paper.owner_id == user_id)
    )
    if existing:
        return existing, await latest_job(session, existing.id)
    try:
        content = await _download_pdf(metadata["pdf_url"])
    except httpx.HTTPError as exc:
        raise UpstreamError(f"Could not download the PDF from arXiv: {exc}") from exc
    return await _create(
        session, user_id, content,
        title=metadata["title"], authors=metadata["authors"], abstract=metadata["abstract"],
        arxiv_id=metadata["arxiv_id"], source_url=metadata["source_url"],
    )


async def delete_paper(session: AsyncSession, paper: Paper) -> None:
    storage.delete_pdf(paper.storage_key)
    vectorstore.delete_paper(paper.id)
    await session.delete(paper)
    await session.commit()


async def retry_job(session: AsyncSession, job: ProcessingJob) -> ProcessingJob:
    if job.status != "failed":
        raise ConflictError("Only failed jobs can be retried")
    paper = await session.get(Paper, job.paper_id)
    if not paper or not paper.storage_key or not storage.pdf_path(paper.storage_key).is_file():
        raise NotFoundError("The source PDF is no longer available")
    job.status, job.stage, job.error_code = "queued", "queued", None
    paper.status, paper.error_code = "queued", None
    await session.commit()
    dispatch_processing(paper.id, job.id)
    return job


async def list_sections(session: AsyncSession, paper_id: str) -> list[SectionOut]:
    rows = (await session.execute(
        select(
            PaperChunk.section_title,
            PaperChunk.section_type,
            func.min(PaperChunk.page_start),
            func.max(PaperChunk.page_end),
            func.count(),
            func.min(PaperChunk.chunk_index).label("first"),
        )
        .where(PaperChunk.paper_id == paper_id)
        .group_by(PaperChunk.section_title, PaperChunk.section_type)
        .order_by("first")
    )).all()
    return [SectionOut(title=r[0], section_type=r[1], page_start=r[2], page_end=r[3], chunk_count=r[4]) for r in rows]


async def load_chunks(session: AsyncSession, paper_id: str) -> list[PaperChunk]:
    return list((await session.scalars(
        select(PaperChunk).where(PaperChunk.paper_id == paper_id).order_by(PaperChunk.chunk_index)
    )).all())
