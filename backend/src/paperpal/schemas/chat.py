from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ExplanationLevel = Literal["beginner", "undergraduate", "graduate", "expert"]


class ChatRequest(BaseModel):
    question: str = Field(min_length=2, max_length=4000)
    explanation_level: ExplanationLevel = "undergraduate"
    conversation_id: str | None = None


class Citation(BaseModel):
    ref: str
    chunk_id: str
    section: str
    page_start: int
    page_end: int
    quote: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    task: str
    insufficient_evidence: bool
    conversation_id: str
    message_id: str


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    citations: list[Citation]
    task: str | None
    explanation_level: str | None
    insufficient_evidence: bool
    created_at: datetime


class ConversationSummary(BaseModel):
    id: str
    paper_id: str
    title: str
    updated_at: datetime


class ConversationOut(ConversationSummary):
    messages: list[MessageOut]


class FeedbackRequest(BaseModel):
    message_id: str
    rating: Literal["helpful", "unhelpful"]
    comment: str | None = Field(default=None, max_length=2000)
