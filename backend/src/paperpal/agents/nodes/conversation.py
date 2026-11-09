"""Non-evidence workflows: related-paper discovery and general conversation."""
import logging

from langchain_core.output_parsers import StrOutputParser

from paperpal.agents.prompts import GENERAL_PROMPT, LEVEL_GUIDANCE, RELATED_PROMPT
from paperpal.agents.state import ResearchState
from paperpal.core.config import get_settings
from paperpal.services.llm import get_chat_model
from paperpal.services.related_service import NOTICE, find_related

logger = logging.getLogger(__name__)


def _format_candidates(items: list[dict]) -> str:
    rows = []
    for item in items:
        label = f"verified citation ({item['relation']})" if item["verified_citation"] else "topic similarity"
        year = item.get("year") or "n.d."
        rows.append(f"- {item['title']} ({year}) — {label} — {item['url']}\n  {item['abstract'][:400]}")
    return "\n".join(rows)


async def related_papers(state: ResearchState) -> ResearchState:
    paper = state["paper"]
    try:
        items = await find_related(paper["id"], paper["title"], paper["arxiv_id"], paper["keywords"])
    except Exception:
        logger.warning("Related-paper search failed", exc_info=True)
        return {
            "answer": "I couldn't reach the paper-search services right now. The analysis of this paper is still "
            "available — try again in a minute.",
            "related": [],
            "citations": [],
            "insufficient_evidence": True,
        }
    if not items:
        text = "I didn't find related papers for this one. Try asking about a specific technique it uses."
    elif get_settings().llm_enabled:
        chain = RELATED_PROMPT | get_chat_model() | StrOutputParser()
        text = await chain.ainvoke(
            {
                "title": paper["title"],
                "candidates": _format_candidates(items[:10]),
                "question": state["question"],
                "level_guidance": LEVEL_GUIDANCE[state.get("explanation_level", "undergraduate")],
            }
        )
    else:
        lines = [
            f"- [{i['title']}]({i['url']}) — {'verified citation' if i['verified_citation'] else 'similar topic'}"
            for i in items[:8]
        ]
        text = "Here are papers related to this one:\n\n" + "\n".join(lines) + f"\n\n_{NOTICE}_"
    return {"answer": text.strip(), "related": items, "citations": [], "insufficient_evidence": False}


async def general(state: ResearchState) -> ResearchState:
    if not get_settings().llm_enabled:
        text = (
            "Hi! Ask me anything about this paper — for example, *summarize it*, *how does the method work?*, "
            "*what are the limitations?*, or *find related papers*."
        )
    else:
        chain = GENERAL_PROMPT | get_chat_model(fast=True) | StrOutputParser()
        text = await chain.ainvoke(
            {"title": state["paper"]["title"], "history": state.get("history", [])[-4:], "question": state["question"]}
        )
    return {"answer": text.strip(), "citations": [], "insufficient_evidence": False}
