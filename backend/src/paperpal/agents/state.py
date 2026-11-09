from typing import Literal, TypedDict

from paperpal.rag.retriever import Evidence

Task = Literal[
    "question_answer", "summarize", "methodology", "limitations", "results", "explain", "related_papers", "general"
]
EVIDENCE_TASKS = ("question_answer", "summarize", "methodology", "limitations", "results", "explain")
MAX_REPAIRS = 1


class PaperContext(TypedDict):
    id: str
    title: str
    abstract: str
    arxiv_id: str | None
    keywords: list[str]


class ResearchState(TypedDict, total=False):
    # Inputs
    paper: PaperContext
    question: str
    explanation_level: str
    history: list[tuple[str, str]]
    # Routing
    task: Task
    search_query: str
    # Evidence and drafting
    evidence: list[Evidence]
    draft: str
    validation_errors: list[str]
    retry_count: int
    # Outputs
    answer: str
    citations: list[dict]
    related: list[dict]
    insufficient_evidence: bool
