"""The LLM path of the research graph, with a fake LangChain chat model standing in for Groq."""
from types import SimpleNamespace

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from paperpal.agents import graph as graph_module
from paperpal.agents.nodes import research, router
from paperpal.core.config import get_settings

CHUNKS = [
    SimpleNamespace(id="m1", section_title="Method", section_type="method", page_start=2, page_end=2, chunk_index=0,
                    text="The router dispatches each token to the top two experts using a learned projection."),
    SimpleNamespace(id="x1", section_title="Experiments", section_type="experiments", page_start=3, page_end=3,
                    chunk_index=1, text="We evaluate on SQuAD and TriviaQA and reach 88.1 F1."),
]


@pytest.fixture
def fake_llm(monkeypatch):
    def install(*replies: str):
        model = GenericFakeChatModel(messages=iter([AIMessage(content=r) for r in replies]))
        monkeypatch.setattr(get_settings(), "groq_api_key", "test-key")
        for module in (research, router):
            monkeypatch.setattr(module, "get_chat_model", lambda fast=False: model)
        graph_module.build_research_graph.cache_clear()

    yield install
    graph_module.build_research_graph.cache_clear()


def initial_state(question: str) -> dict:
    paper = {"id": "paper-x", "title": "Sparse Routing", "abstract": "", "arxiv_id": None, "keywords": []}
    return {"paper": paper, "question": question, "explanation_level": "graduate", "history": [], "retry_count": 0}


async def run(question: str) -> tuple[list[str], dict]:
    tokens, result = [], {}
    async for mode, chunk in graph_module.build_research_graph().astream(
        initial_state(question), {"configurable": {"chunks": CHUNKS}}, stream_mode=["updates", "messages"]
    ):
        if mode == "messages":
            message, metadata = chunk
            streamed = metadata["langgraph_node"] in graph_module.STREAMING_NODES
            if streamed and "nostream" not in metadata.get("tags", []):
                tokens.append(message.content)
        else:
            for update in chunk.values():
                result.update(update or {})
    return tokens, result


async def test_streams_grounded_answer(fake_llm):
    # The structured-output router call fails on the fake model, which exercises keyword-routing fallback.
    fake_llm("Tokens go to the **top two experts** [E1].")
    tokens, result = await run("How does the routing method work?")
    assert result["task"] == "methodology"
    assert "".join(tokens).strip() == "Tokens go to the **top two experts** [E1]."
    assert [c["chunk_id"] for c in result["citations"]] == ["m1"]
    assert result.get("retry_count", 0) == 0


async def test_repairs_uncited_answer_once(fake_llm):
    fake_llm("It uses two experts.", "It uses two experts [E1].")
    tokens, result = await run("How does the routing method work?")
    assert result["retry_count"] == 1
    assert result["answer"] == "It uses two experts [E1]."
    assert "[E1]" not in "".join(tokens)  # repair output is not streamed as tokens; the final event carries it
    assert not result["insufficient_evidence"]


async def test_insufficient_evidence_is_flagged(fake_llm):
    fake_llm("[INSUFFICIENT] The paper does not report training cost.")
    _, result = await run("What did training cost in dollars for the experts?")
    assert result["insufficient_evidence"] and not result["answer"].startswith("[INSUFFICIENT]")
