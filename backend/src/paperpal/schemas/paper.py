from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ArxivSource(BaseModel):
    arxiv_url: str = Field(min_length=3, max_length=500)


class PaperOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    authors: list[str]
    abstract: str
    arxiv_id: str | None
    source_url: str | None
    page_count: int
    status: str
    error_code: str | None
    analysis: dict
    created_at: datetime
    job_id: str | None = None


class PaperList(BaseModel):
    items: list[PaperOut]


class PaperCreated(BaseModel):
    paper: PaperOut
    job_id: str | None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    paper_id: str
    status: str
    stage: str
    attempts: int
    error_code: str | None


class SectionOut(BaseModel):
    title: str
    section_type: str
    page_start: int
    page_end: int
    chunk_count: int
