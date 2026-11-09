from types import SimpleNamespace

import pytest

from paperpal.agents.nodes.research import INSUFFICIENT_TAG, finalize, validate
from paperpal.agents.nodes.router import keyword_route
from paperpal.core.exceptions import AuthError
from paperpal.core.security import DEMO_USER_ID, create_demo_token, verify_token
from paperpal.evals.runner import citation_ids_valid
from paperpal.ingestion.arxiv import normalize_arxiv_id
from paperpal.ingestion.chunker import chunk_blocks
from paperpal.ingestion.parser import extract_pdf
from paperpal.ingestion.sections import detect_heading
from paperpal.rag.lexical import bm25
from paperpal.rag.retriever import Evidence


def evidence(ref: str) -> Evidence:
    return Evidence(ref, f"chunk-{ref}", "Method", "method", 2, 2, "The router picks two experts.", 1.0)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("https://arxiv.org/abs/1706.03762v7", "1706.03762v7"),
        ("arxiv.org/pdf/2401.12345.pdf", "2401.12345"),
        ("1706.03762", "1706.03762"),
        ("hep-th/9901001", "hep-th/9901001"),
    ],
)
def test_normalize_arxiv_id(value, expected):
    assert normalize_arxiv_id(value) == expected


def test_normalize_arxiv_id_rejects_garbage():
    with pytest.raises(ValueError):
        normalize_arxiv_id("not a paper")


@pytest.mark.parametrize(
    ("text", "expected_type"),
    [("1 Introduction", "introduction"), ("3.2 Experimental Setup", "experiments"), ("LIMITATIONS", "limitations")],
)
def test_detect_heading(text, expected_type):
    assert detect_heading(text)[1] == expected_type


def test_detect_heading_ignores_prose():
    assert detect_heading("We introduce a method that routes tokens to experts and analyse it.") is None


def test_pdf_is_chunked_by_section(pdf_bytes):
    parsed = extract_pdf(pdf_bytes, max_pages=10)
    chunks = chunk_blocks(parsed.blocks)
    types = {c.section_type for c in chunks}
    assert {"abstract", "introduction", "method", "experiments", "limitations"} <= types
    method = next(c for c in chunks if c.section_type == "method")
    assert method.page_start == 2 and "load balancing" in method.text


def test_bm25_prefers_matching_chunk():
    chunks = [
        SimpleNamespace(id="a", section_title="Intro", text="Language models are costly."),
        SimpleNamespace(id="b", section_title="Experiments", text="We evaluate on SQuAD and TriviaQA datasets."),
    ]
    assert bm25("Which datasets, like SQuAD?", chunks, k=2)[0][0] == "b"


def test_keyword_routing():
    assert keyword_route("What are the limitations?") == "limitations"
    assert keyword_route("How does the method work") == "methodology"
    assert keyword_route("find related papers") == "related_papers"
    assert keyword_route("hello") == "general"


def test_validation_rejects_unknown_citations():
    state = {"draft": "Routing uses two experts [E1][E9].", "evidence": [evidence("E1")]}
    assert validate(state)["validation_errors"]


def test_validation_requires_a_citation_unless_insufficient():
    assert validate({"draft": "Uncited claim.", "evidence": [evidence("E1")]})["validation_errors"]
    assert not validate({"draft": f"{INSUFFICIENT_TAG} Not covered.", "evidence": [evidence("E1")]})[
        "validation_errors"
    ]


def test_finalize_strips_invalid_markers_and_resolves_citations():
    result = finalize({"draft": "Two experts [E1] and more [E7].", "evidence": [evidence("E1")]})
    assert "[E7]" not in result["answer"]
    assert [c["chunk_id"] for c in result["citations"]] == ["chunk-E1"]
    assert result["insufficient_evidence"] is False


def test_citation_eval_helper():
    assert citation_ids_valid("A [E1] B [E2]", {"E1", "E2"})
    assert not citation_ids_valid("A [E3]", {"E1"})


def test_demo_token_round_trip():
    token, _ = create_demo_token()
    user = verify_token(token)
    assert user.id == DEMO_USER_ID and user.is_demo


def test_tampered_token_is_rejected():
    token, _ = create_demo_token()
    with pytest.raises(AuthError):
        verify_token(token[:-2] + ("A" if token[-1] != "A" else "B") + token[-1])
