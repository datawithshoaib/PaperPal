"""Supervisor: decide which workflow handles the message."""
import logging

from pydantic import BaseModel, Field

from paperpal.agents.prompts import ROUTER_PROMPT
from paperpal.agents.state import ResearchState, Task
from paperpal.core.config import get_settings
from paperpal.services.llm import get_chat_model

logger = logging.getLogger(__name__)

KEYWORD_ROUTES: list[tuple[Task, tuple[str, ...]]] = [
    ("related_papers", ("related paper", "related work", "similar paper", "other papers", "read next", "papers like")),
    ("limitations", ("limitation", "weakness", "caveat", "drawback", "shortcoming", "future work")),
    ("methodology", ("method", "approach", "how does", "how do", "architecture", "algorithm", "how it works")),
    ("results", ("result", "experiment", "dataset", "benchmark", "accuracy", "performance", "metric")),
    ("summarize", ("summar", "overview", "tl;dr", "tldr", "main idea", "contribution", "key idea")),
    ("explain", ("explain", "what is", "what are", "define", "meaning of", "intuition")),
]
GREETINGS = ("hi", "hello", "hey", "thanks", "thank you", "good morning", "good evening")


class Route(BaseModel):
    task: Task = Field(description="The workflow that should handle the latest message.")
    search_query: str = Field(description="A standalone query for searching the paper's text.")


def keyword_route(question: str) -> Task:
    q = question.casefold().strip(" !.?")
    if q in GREETINGS:
        return "general"
    for task, needles in KEYWORD_ROUTES:
        if any(needle in q for needle in needles):
            return task
    return "question_answer"


async def route(state: ResearchState) -> ResearchState:
    question = state["question"]
    if get_settings().llm_enabled:
        try:
            router = ROUTER_PROMPT | get_chat_model(fast=True).with_structured_output(Route)
            decision = await router.ainvoke(
                {"title": state["paper"]["title"], "history": state.get("history", [])[-4:], "question": question},
                config={"tags": ["nostream"]},
            )
            return {"task": decision.task, "search_query": decision.search_query or question}
        except Exception:
            logger.warning("LLM routing failed; using keyword routing", exc_info=True)
    return {"task": keyword_route(question), "search_query": question}
