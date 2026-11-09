"""Related-paper discovery.

Topic-similar candidates come from arXiv search. Verified citation links (cites / cited_by) come
from Semantic Scholar when the paper has an arXiv ID. The two are never conflated.
"""
import asyncio
import logging
import re
import time

import httpx

from paperpal.core.config import get_settings
from paperpal.ingestion.arxiv import search_arxiv
from paperpal.rag.lexical import tokenize

logger = logging.getLogger(__name__)

S2_API = "https://api.semanticscholar.org/graph/v1/paper"
S2_FIELDS = "title,year,url,externalIds,abstract,authors"
CACHE_TTL_SECONDS = 3600
_cache: dict[str, tuple[float, list[dict]]] = {}

NOTICE = (
    "Similar papers come from arXiv topic search; similarity does not mean a citation exists. "
    "Only items marked as verified citations are confirmed by Semantic Scholar."
)


def _norm(title: str) -> str:
    return re.sub(r"[^a-z0-9]", "", title.casefold())


def _search_query(title: str, keywords: list[str]) -> str:
    words = [re.sub(r"[^\w-]", "", k) for k in keywords if 3 < len(k) < 40 and " " not in k.strip()]
    if len(words) >= 2:  # a few distinctive terms ANDed together beat one broad phrase
        return " AND ".join(f"all:{w}" for w in words[:3])
    terms = list(dict.fromkeys(tokenize(title)))[:5]
    return " AND ".join(f"all:{t}" for t in terms) or f'ti:"{title[:120]}"'


async def _arxiv_candidates(title: str, keywords: list[str], limit: int) -> list[dict]:
    entries = await search_arxiv(_search_query(title, keywords), limit + 4, get_settings().arxiv_timeout_seconds)
    return [
        {
            "key": f"arxiv:{e['arxiv_id']}" if e["arxiv_id"] else f"title:{_norm(e['title'])}",
            "title": e["title"],
            "url": e["source_url"],
            "abstract": e["abstract"][:600],
            "authors": e["authors"][:4],
            "year": e["year"],
            "relation": "similar_to",
            "verified_citation": False,
            "source": "arxiv",
        }
        for e in entries
        if e["title"]
    ]


async def _s2_links(client: httpx.AsyncClient, arxiv_id: str, direction: str, limit: int) -> list[dict]:
    base_id = re.sub(r"v\d+$", "", arxiv_id)
    response = await client.get(f"{S2_API}/arXiv:{base_id}/{direction}", params={"fields": S2_FIELDS, "limit": limit})
    response.raise_for_status()
    key = "citedPaper" if direction == "references" else "citingPaper"
    items = []
    for row in response.json().get("data") or []:
        paper = row.get(key) or {}
        if not paper.get("title"):
            continue
        external = paper.get("externalIds") or {}
        arxiv = external.get("ArXiv")
        items.append(
            {
                "key": f"arxiv:{arxiv}" if arxiv else f"s2:{paper.get('paperId') or _norm(paper['title'])}",
                "title": paper["title"],
                "url": f"https://arxiv.org/abs/{arxiv}" if arxiv else paper.get("url"),
                "abstract": (paper.get("abstract") or "")[:600],
                "authors": [a.get("name", "") for a in (paper.get("authors") or [])[:4]],
                "year": paper.get("year"),
                "relation": "cites" if direction == "references" else "cited_by",
                "verified_citation": True,
                "source": "semantic_scholar",
            }
        )
    return items


async def find_related(
    paper_id: str, title: str, arxiv_id: str | None, keywords: list[str], limit: int = 8
) -> list[dict]:
    cached = _cache.get(paper_id)
    if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    tasks = [_arxiv_candidates(title, keywords, limit)]
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        if arxiv_id:
            tasks += [_s2_links(client, arxiv_id, "references", 6), _s2_links(client, arxiv_id, "citations", 6)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    items: list[dict] = []
    seen = {_norm(title)}
    # Verified citation links first, so a paper that is both similar and cited shows as cited.
    for result in [*results[1:], results[0]]:
        if isinstance(result, BaseException):
            logger.warning("Related-paper source failed: %s", result)
            continue
        for item in result:
            if _norm(item["title"]) in seen or (arxiv_id and item["key"].startswith(f"arxiv:{arxiv_id[:10]}")):
                continue
            seen.add(_norm(item["title"]))
            items.append(item)
    if all(isinstance(r, BaseException) for r in results):
        raise httpx.HTTPError("All related-paper sources are unavailable")
    _cache[paper_id] = (time.monotonic(), items)
    return items
