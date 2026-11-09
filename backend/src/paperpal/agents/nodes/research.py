"""Evidence-grounded answering: retrieve -> answer -> validate (-> repair) -> finalize."""
import re

from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableConfig

from paperpal.agents.prompts import ANSWER_PROMPT, LEVEL_GUIDANCE, REPAIR_PROMPT, TASK_GUIDANCE
from paperpal.agents.state import MAX_REPAIRS, ResearchState
from paperpal.core.config import get_settings
from paperpal.rag.retriever import Evidence, retrieve
from paperpal.services.llm import get_chat_model

INSUFFICIENT_TAG = "[INSUFFICIENT]"
_CITATION = re.compile(r"\[(E\d+)\]")


def format_evidence(evidence: list[Evidence]) -> str:
    return "\n\n".join(
        f"[{item.ref}] Section: {item.section} | Pages {item.page_start}-{item.page_end}\n{item.text[:3500]}"
        for item in evidence
    )


def extractive_answer(question: str, evidence: list[Evidence], level: str) -> str:
    """Answer without a model: the most relevant passages, quoted with their references."""
    lead = {
        "beginner": "Here are the parts of the paper that speak to your question, in the authors' own words:",
        "undergraduate": "The most relevant passages from the paper are:",
        "graduate": "The retrieved passages that bear on this question:",
        "expert": "Relevant source passages:",
    }[level]
    bullets = []
    for item in sorted(evidence, key=lambda e: e.score, reverse=True)[:3]:
        text = item.text.strip()
        excerpt = text if len(text) <= 600 else text[:600].rsplit(" ", 1)[0] + "…"
        bullets.append(f"- **{item.section}** (p. {item.page_start}): “{excerpt}” [{item.ref}]")
    note = (
        "\n\n_Configure `GROQ_API_KEY` on the API to get synthesized, level-adapted answers instead of excerpts._"
    )
    return f"{lead}\n\n" + "\n".join(bullets) + note


async def retrieve_evidence(state: ResearchState, config: RunnableConfig) -> ResearchState:
    chunks = config["configurable"]["chunks"]
    evidence = await retrieve(
        state["paper"]["id"],
        state.get("search_query") or state["question"],
        chunks,
        task=state.get("task", "question_answer"),
        top_k=get_settings().retrieval_top_k,
    )
    return {"evidence": evidence}


async def answer(state: ResearchState) -> ResearchState:
    evidence = state.get("evidence", [])
    if not evidence:
        return {
            "draft": f"{INSUFFICIENT_TAG} I couldn't find passages in this paper that address that question. "
            "Try rephrasing it, or ask about a specific section, method, or result.",
        }
    level = state.get("explanation_level", "undergraduate")
    if not get_settings().llm_enabled:
        return {"draft": extractive_answer(state["question"], evidence, level)}
    chain = ANSWER_PROMPT | get_chat_model() | StrOutputParser()
    draft = await chain.ainvoke(
        {
            "level_guidance": LEVEL_GUIDANCE[level],
            "task_guidance": TASK_GUIDANCE.get(state.get("task", "question_answer"), TASK_GUIDANCE["question_answer"]),
            "title": state["paper"]["title"],
            "evidence": format_evidence(evidence),
            "history": state.get("history", [])[-6:],
            "question": state["question"],
        }
    )
    return {"draft": draft.strip()}


def validate(state: ResearchState) -> ResearchState:
    """Server-side citation contract: models may only cite evidence that was actually supplied."""
    draft = state.get("draft", "")
    valid = {item.ref for item in state.get("evidence", [])}
    cited = set(_CITATION.findall(draft))
    errors = []
    if unknown := sorted(cited - valid):
        errors.append(f"it cites evidence IDs that do not exist ({', '.join(unknown)})")
    if valid and not cited & valid and not draft.startswith(INSUFFICIENT_TAG):
        errors.append("it makes claims without citing any evidence")
    return {"validation_errors": errors}


def after_validate(state: ResearchState) -> str:
    if not state.get("validation_errors"):
        return "finalize"
    if get_settings().llm_enabled and state.get("retry_count", 0) < MAX_REPAIRS:
        return "repair"
    return "finalize"


async def repair(state: ResearchState) -> ResearchState:
    evidence = state["evidence"]
    chain = REPAIR_PROMPT | get_chat_model() | StrOutputParser()
    draft = await chain.ainvoke(
        {
            "title": state["paper"]["title"],
            "evidence": format_evidence(evidence),
            "question": state["question"],
            "draft": state["draft"],
            "errors": "; ".join(state["validation_errors"]),
            "valid_ids": ", ".join(item.ref for item in evidence),
        },
        config={"tags": ["nostream"]},
    )
    return {"draft": draft.strip(), "retry_count": state.get("retry_count", 0) + 1}


def finalize(state: ResearchState) -> ResearchState:
    draft = state.get("draft", "")
    evidence = {item.ref: item for item in state.get("evidence", [])}
    insufficient = draft.startswith(INSUFFICIENT_TAG)
    text = draft.removeprefix(INSUFFICIENT_TAG).strip()
    # Drop citation markers that survived repair but point at nothing.
    text = _CITATION.sub(lambda m: m.group(0) if m.group(1) in evidence else "", text)
    cited = list(dict.fromkeys(_CITATION.findall(text)))
    citations = [evidence[ref].citation() for ref in cited]
    if not citations and not insufficient and evidence:
        insufficient = True  # an uncited answer is not evidence-grounded, so flag it in the UI
    return {"answer": text, "citations": citations, "insufficient_evidence": insufficient}
