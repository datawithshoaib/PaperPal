"""Deterministic evaluation utilities; no unreviewed quality scores are reported as results."""
import re

_CITATION = re.compile(r"\[(E\d+)\]")


def recall_at_k(expected_chunk_ids: set[str], retrieved_chunk_ids: list[str], k: int = 5) -> float:
    if not expected_chunk_ids:
        return 1.0
    return len(set(retrieved_chunk_ids[:k]) & expected_chunk_ids) / len(expected_chunk_ids)


def citation_ids_valid(answer: str, supplied_refs: set[str]) -> bool:
    """Every inline [E#] marker must refer to evidence that was supplied to the model."""
    cited = set(_CITATION.findall(answer))
    return bool(cited) and cited <= supplied_refs
