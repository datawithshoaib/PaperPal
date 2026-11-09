"""Hybrid retrieval: ChromaDB dense search + BM25, fused with reciprocal rank fusion."""
import asyncio
import logging
from dataclasses import dataclass

from paperpal.db.models import PaperChunk
from paperpal.rag import lexical, vectorstore

logger = logging.getLogger(__name__)

# Boost sections that usually answer a given kind of question.
TASK_SECTIONS: dict[str, tuple[str, ...]] = {
    "methodology": ("method", "background"),
    "limitations": ("limitations", "discussion", "conclusion"),
    "summarize": ("abstract", "introduction", "conclusion"),
    "results": ("results", "experiments"),
}
EXCLUDED_SECTIONS = {"references", "acknowledgments", "front_matter"}


@dataclass
class Evidence:
    ref: str
    chunk_id: str
    section: str
    section_type: str
    page_start: int
    page_end: int
    text: str
    score: float

    def citation(self) -> dict:
        return {
            "ref": self.ref,
            "chunk_id": self.chunk_id,
            "section": self.section,
            "page_start": self.page_start,
            "page_end": self.page_end,
            "quote": self.text[:500].strip(),
        }


async def retrieve(
    paper_id: str, question: str, chunks: list[PaperChunk], task: str = "question_answer", top_k: int = 6
) -> list[Evidence]:
    q = question.casefold()
    # References and title-page boilerplate only matter when the user asks about them.
    hints = {"references": ("reference", "bibliograph"), "front_matter": ("author", "affiliation", "who wrote")}
    allowed = {section for section, words in hints.items() if any(w in q for w in words)}
    by_id = {c.id: c for c in chunks if c.section_type not in EXCLUDED_SECTIONS or c.section_type in allowed}
    candidates = list(by_id.values())
    pool = top_k * 3
    rankings = [lexical.bm25(question, candidates, pool)]
    try:
        rankings.append(await asyncio.to_thread(vectorstore.search, paper_id, question, pool))
    except Exception:
        logger.exception("Vector search failed; falling back to lexical retrieval only")

    fused: dict[str, float] = {}
    for ranking in rankings:
        for rank, (chunk_id, _) in enumerate(ranking):
            if chunk_id in by_id:
                fused[chunk_id] = fused.get(chunk_id, 0.0) + 1 / (60 + rank)
    preferred = TASK_SECTIONS.get(task, ())
    for chunk_id in fused:
        if by_id[chunk_id].section_type in preferred:
            fused[chunk_id] *= 1.25

    if not fused and preferred:  # broad questions ("summarize this") may share no terms with the text
        fused = {c.id: 1.0 / (1 + c.chunk_index) for c in candidates if c.section_type in preferred}

    ranked = sorted(fused.items(), key=lambda row: row[1], reverse=True)[:top_k]
    # Present evidence in reading order so the model sees a coherent narrative.
    ordered = sorted(ranked, key=lambda row: by_id[row[0]].chunk_index)
    return [
        Evidence(
            ref=f"E{index + 1}",
            chunk_id=chunk_id,
            section=by_id[chunk_id].section_title,
            section_type=by_id[chunk_id].section_type,
            page_start=by_id[chunk_id].page_start,
            page_end=by_id[chunk_id].page_end,
            text=by_id[chunk_id].text,
            score=round(score, 4),
        )
        for index, (chunk_id, score) in enumerate(ordered)
    ]
