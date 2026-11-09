"""Supervisor-style research graph.

    START -> route -> retrieve -> answer -> validate -> finalize -> END
                 |                            ^   |
                 |                            |   v (invalid citations, within budget)
                 |                            +-- repair
                 +-> related_papers -> END
                 +-> general -> END

Without GROQ_API_KEY every node falls back to deterministic behaviour (keyword routing,
extractive answers), so the workflow is always runnable locally.
"""
from functools import lru_cache

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from paperpal.agents.nodes import conversation, research, router
from paperpal.agents.state import EVIDENCE_TASKS, ResearchState

# Nodes whose model tokens are streamed to the client.
STREAMING_NODES = {"answer", "related_papers", "general"}


def after_route(state: ResearchState) -> str:
    task = state["task"]
    if task in EVIDENCE_TASKS:
        return "retrieve"
    return task


@lru_cache
def build_research_graph() -> CompiledStateGraph:
    graph = StateGraph(ResearchState)
    graph.add_node("route", router.route)
    graph.add_node("retrieve", research.retrieve_evidence)
    graph.add_node("answer", research.answer)
    graph.add_node("validate", research.validate)
    graph.add_node("repair", research.repair)
    graph.add_node("finalize", research.finalize)
    graph.add_node("related_papers", conversation.related_papers)
    graph.add_node("general", conversation.general)

    graph.add_edge(START, "route")
    graph.add_conditional_edges("route", after_route, ["retrieve", "related_papers", "general"])
    graph.add_edge("retrieve", "answer")
    graph.add_edge("answer", "validate")
    graph.add_conditional_edges("validate", research.after_validate, ["repair", "finalize"])
    graph.add_edge("repair", "validate")
    graph.add_edge("finalize", END)
    graph.add_edge("related_papers", END)
    graph.add_edge("general", END)
    return graph.compile()
