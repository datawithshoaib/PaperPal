import math
import re
from collections import Counter

from paperpal.db.models import PaperChunk

STOPWORDS = {
    "the", "and", "for", "are", "what", "when", "where", "which", "that", "this", "with", "from", "does",
    "have", "were", "their", "about", "paper", "authors", "explain", "describe", "how", "why", "they",
    "into", "than", "then", "there", "these", "those", "can", "use", "used", "using", "its", "also",
}
_TOKEN = re.compile(r"[a-z0-9][a-z0-9\-]*")


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.casefold()) if len(t) > 2 and t not in STOPWORDS]


def bm25(query: str, chunks: list[PaperChunk], k: int, k1: float = 1.4, b: float = 0.75) -> list[tuple[str, float]]:
    """BM25 over a single paper's chunks; catches exact terms, acronyms, and model names."""
    terms = set(tokenize(query))
    if not terms or not chunks:
        return []
    docs = [Counter(tokenize(f"{c.section_title} {c.text}")) for c in chunks]
    avg_len = sum(sum(d.values()) for d in docs) / len(docs) or 1
    doc_freq = {t: sum(1 for d in docs if t in d) for t in terms}
    scored = []
    for chunk, counts in zip(chunks, docs, strict=True):
        length = sum(counts.values())
        score = 0.0
        for term in terms:
            if not counts[term]:
                continue
            idf = math.log(1 + (len(docs) - doc_freq[term] + 0.5) / (doc_freq[term] + 0.5))
            score += idf * counts[term] * (k1 + 1) / (counts[term] + k1 * (1 - b + b * length / avg_len))
        if score > 0:
            scored.append((chunk.id, score))
    return sorted(scored, key=lambda row: row[1], reverse=True)[:k]
