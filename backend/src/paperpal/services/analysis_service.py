"""Structured paper analysis: Groq structured output when available, section extraction otherwise."""
import logging
import re
from collections import Counter

from paperpal.agents.prompts import ANALYSIS_PROMPT
from paperpal.core.config import get_settings
from paperpal.db.models import PaperChunk
from paperpal.rag.lexical import tokenize
from paperpal.schemas.analysis import PaperAnalysis
from paperpal.services.llm import get_chat_model

logger = logging.getLogger(__name__)

# Sections sampled for the model, in priority order, with a per-section character budget.
ANALYSIS_SECTIONS = [
    ("abstract", 2500), ("introduction", 4500), ("method", 6000), ("experiments", 3500),
    ("results", 3500), ("discussion", 2000), ("limitations", 2500), ("conclusion", 2500),
]
MAX_CONTEXT_CHARS = 24000


def _by_section(chunks: list[PaperChunk]) -> dict[str, list[PaperChunk]]:
    grouped: dict[str, list[PaperChunk]] = {}
    for chunk in chunks:
        grouped.setdefault(chunk.section_type, []).append(chunk)
    return grouped


def _excerpts(chunks: list[PaperChunk]) -> str:
    grouped = _by_section(chunks)
    parts: list[str] = []
    for section_type, budget in ANALYSIS_SECTIONS:
        text = "\n".join(c.text for c in grouped.get(section_type, []))[:budget]
        if text:
            parts.append(f"## {section_type.title()}\n{text}")
    if sum(len(p) for p in parts) < 4000:  # unusual layout: fall back to reading order
        parts = [f"## Pages {c.page_start}-{c.page_end}\n{c.text}" for c in chunks[:12]]
    return "\n\n".join(parts)[:MAX_CONTEXT_CHARS]


def _sentences(text: str, limit: int) -> list[str]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if 30 < len(s.strip()) < 400]
    return sentences[:limit]


def extractive_analysis(chunks: list[PaperChunk], title: str, abstract: str) -> PaperAnalysis:
    grouped = _by_section(chunks)

    def section_text(*types: str, limit: int = 1100) -> str:
        for section_type in types:
            if grouped.get(section_type):
                return " ".join(c.text for c in grouped[section_type][:2])[:limit]
        return ""

    summary = abstract or section_text("abstract", "introduction", "front_matter")
    words = Counter(t for t in tokenize(f"{title} {summary}") if len(t) > 4 and not t.isdigit())
    limitations = section_text("limitations", "discussion")
    return PaperAnalysis(
        tldr=(_sentences(summary, 1) or [title])[0],
        summary=summary[:1400] or "Summary is not available in the extracted text.",
        problem_statement=section_text("introduction") or "Review the introduction for the problem statement.",
        contributions=_sentences(section_text("introduction", "abstract", limit=3000), 4)
        or ["No structured contribution statement was identified."],
        methodology=section_text("method") or "No methods section was detected in the extracted text.",
        experiments=section_text("experiments", "results") or "No experiments section was detected.",
        key_findings=_sentences(section_text("results", "conclusion", limit=3000), 4)
        or ["No results section was detected."],
        limitations=_sentences(limitations, 4)
        or ["The extracted text has no clearly labeled limitations section."],
        keywords=[word for word, _ in words.most_common(6)],
    )


async def analyze_paper(chunks: list[PaperChunk], title: str, abstract: str) -> dict:
    settings = get_settings()
    if settings.llm_enabled and chunks:
        try:
            chain = ANALYSIS_PROMPT | get_chat_model().with_structured_output(PaperAnalysis)
            result = await chain.ainvoke(
                {"title": title, "abstract": abstract or "(not provided)", "excerpts": _excerpts(chunks)}
            )
            return {**result.model_dump(), "source": "llm", "model": settings.groq_model, "schema_version": "2"}
        except Exception:
            logger.warning("LLM analysis failed; using extractive analysis", exc_info=True)
    return {**extractive_analysis(chunks, title, abstract).model_dump(), "source": "extractive", "schema_version": "2"}
