from fastapi import APIRouter

from paperpal.api.dependencies import SessionDep, UserDep
from paperpal.schemas.paper import JobOut
from paperpal.services import paper_service

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobOut)
async def get_job(job_id: str, user: UserDep, session: SessionDep):
    return await paper_service.get_owned_job(session, job_id, user.id)


@router.post("/{job_id}/retry", status_code=202, response_model=JobOut)
async def retry_job(job_id: str, user: UserDep, session: SessionDep):
    job = await paper_service.get_owned_job(session, job_id, user.id)
    return await paper_service.retry_job(session, job)
