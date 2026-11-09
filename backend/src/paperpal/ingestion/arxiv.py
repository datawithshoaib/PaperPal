import re
from xml.etree import ElementTree

import httpx

ATOM = "{http://www.w3.org/2005/Atom}"
ARXIV_API = "https://export.arxiv.org/api/query"
_ARXIV_ID = re.compile(r"(\d{4}\.\d{4,5}(?:v\d+)?|[a-z\-]+(?:\.[A-Z]{2})?/\d{7}(?:v\d+)?)", re.I)


def normalize_arxiv_id(value: str) -> str:
    match = _ARXIV_ID.search(value.strip())
    if not match:
        raise ValueError("That doesn't look like an arXiv link or ID (for example 1706.03762).")
    return match.group(1)


def parse_entry(entry: ElementTree.Element) -> dict:
    def text(key: str) -> str:
        return " ".join((entry.findtext(f"{ATOM}{key}") or "").split())

    abs_url = text("id")
    published = text("published")
    pdf_url = next(
        (link.attrib.get("href") for link in entry.findall(f"{ATOM}link") if link.attrib.get("title") == "pdf"),
        None,
    )
    match = _ARXIV_ID.search(abs_url)
    return {
        "arxiv_id": match.group(1) if match else None,
        "title": text("title"),
        "abstract": text("summary"),
        "authors": [e.text for e in entry.findall(f"{ATOM}author/{ATOM}name") if e.text],
        "year": int(published[:4]) if published[:4].isdigit() else None,
        "source_url": abs_url.replace("http://", "https://"),
        "pdf_url": (pdf_url or abs_url.replace("/abs/", "/pdf/")).replace("http://", "https://"),
    }


async def fetch_arxiv(value: str, timeout: float) -> dict:
    arxiv_id = normalize_arxiv_id(value)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(ARXIV_API, params={"id_list": arxiv_id})
        response.raise_for_status()
    entry = ElementTree.fromstring(response.text).find(f"{ATOM}entry")
    if entry is None or not (entry.findtext(f"{ATOM}title") or "").strip() or entry.find(f"{ATOM}summary") is None:
        raise ValueError(f"arXiv has no paper with the ID {arxiv_id}.")
    metadata = parse_entry(entry)
    metadata["arxiv_id"] = arxiv_id
    metadata["source_url"] = f"https://arxiv.org/abs/{arxiv_id}"
    return metadata


async def search_arxiv(query: str, max_results: int, timeout: float) -> list[dict]:
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(
            ARXIV_API,
            params={"search_query": query, "start": 0, "max_results": max_results, "sortBy": "relevance"},
        )
        response.raise_for_status()
    return [parse_entry(entry) for entry in ElementTree.fromstring(response.text).findall(f"{ATOM}entry")]
