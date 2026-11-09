from fastapi import APIRouter, File, UploadFile
from fastapi.responses import FileResponse

from paperpal.api.dependencies import PaperDep, SessionDep, UserDep
from paperpal.core.exceptions import ConflictError, NotFoundError
from paperpal.schemas.paper import ArxivSource, PaperCreated, PaperList, PaperOut, SectionOut
from paperpal.services import paper_service, storage
from paperpal.services.analysis_service import analyze_paper

router = APIRouter(prefix="/papers", tags=["papers"])


@router.get("", response_model=PaperList)
async def list_papers(user: UserDep, session: SessionDep):
    return PaperList(items=await paper_service.list_papers(session, user.id))


@router.post("", status_code=202, response_model=PaperCreated)
async def upload_paper(user: UserDep, session: SessionDep, file: UploadFile = File(...)):
    paper, job = await paper_service.create_from_upload(session, user.id, file)
    return PaperCreated(paper=paper_service.to_out(paper, job.id), job_id=job.id)


@router.post("/arxiv", status_code=202, response_model=PaperCreated)
async def add_arxiv(source: ArxivSource, user: UserDep, session: SessionDep):
    paper, job = await paper_service.create_from_arxiv(session, user.id, source.arxiv_url)
    job_id = job.id if job else None
    return PaperCreated(paper=paper_service.to_out(paper, job_id), job_id=job_id)


@router.get("/{paper_id}", response_model=PaperOut)
async def get_paper(paper: PaperDep, session: SessionDep):
    job = await paper_service.latest_job(session, paper.id)
    return paper_service.to_out(paper, job.id if job else None)


@router.get("/{paper_id}/sections", response_model=list[SectionOut])
async def get_sections(paper: PaperDep, session: SessionDep):
    return await paper_service.list_sections(session, paper.id)


@router.get("/{paper_id}/pdf")
async def get_pdf(paper: PaperDep):
    if not paper.storage_key or not storage.pdf_path(paper.storage_key).is_file():
        raise NotFoundError("PDF unavailable")
    return FileResponse(
        storage.pdf_path(paper.storage_key),
        media_type="application/pdf",
        filename=f"{paper.title[:80]}.pdf",
        content_disposition_type="inline",
    )


@router.post("/{paper_id}/analyze", response_model=PaperOut)
async def reanalyze(paper: PaperDep, session: SessionDep):
    if paper.status != "ready":
        raise ConflictError("This paper is still being processed")
    chunks = await paper_service.load_chunks(session, paper.id)
    paper.analysis = await analyze_paper(chunks, paper.title, paper.abstract)
    await session.commit()
    return paper_service.to_out(paper)


@router.delete("/{paper_id}", status_code=204)
async def delete_paper(paper: PaperDep, session: SessionDep):
    await paper_service.delete_paper(session, paper)
