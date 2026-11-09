"""Runs the research graph for a chat turn and persists the conversation."""
import json
import logging
from collections.abc import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from paperpal.agents.graph import STREAMING_NODES, build_research_graph
from paperpal.agents.state import PaperContext, ResearchState
from paperpal.core.exceptions import ConflictError, NotFoundError
from paperpal.db.models import Conversation, Message, Paper
from paperpal.db.session import SessionLocal
from paperpal.schemas.chat import ChatRequest, ChatResponse
from paperpal.services.paper_service import load_chunks

logger = logging.getLogger(__name__)
HISTORY_TURNS = 6


class ChatTurn:
    """Everything needed to run one turn, prepared inside the request's database session."""

    def __init__(self, paper: Paper, conversation_id: str | None, state: ResearchState, chunks: list) -> None:
        self.paper_id = paper.id
        self.conversation_id = conversation_id
        self.state = state
        self.config = {"configurable": {"chunks": chunks}}


async def prepare_turn(session: AsyncSession, paper: Paper, request: ChatRequest, user_id: str) -> ChatTurn:
    if paper.status != "ready":
        raise ConflictError("This paper is still being processed")
    history: list[tuple[str, str]] = []
    if request.conversation_id:
        conversation = await session.get(Conversation, request.conversation_id)
        if not conversation or conversation.user_id != user_id or conversation.paper_id != paper.id:
            raise NotFoundError("Conversation not found")
        messages = (await session.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc())
            .limit(HISTORY_TURNS)
        )).all()
        history = [("human" if m.role == "user" else "ai", m.content) for m in reversed(messages)]
    context = PaperContext(
        id=paper.id,
        title=paper.title,
        abstract=paper.abstract,
        arxiv_id=paper.arxiv_id,
        keywords=(paper.analysis or {}).get("keywords", []),
    )
    state: ResearchState = {
        "paper": context,
        "question": request.question,
        "explanation_level": request.explanation_level,
        "history": history,
        "retry_count": 0,
    }
    return ChatTurn(paper, request.conversation_id, state, await load_chunks(session, paper.id))


async def _persist(turn: ChatTurn, user_id: str, result: ResearchState) -> tuple[str, str]:
    async with SessionLocal() as session:
        conversation = await session.get(Conversation, turn.conversation_id) if turn.conversation_id else None
        if not conversation:
            conversation = Conversation(user_id=user_id, paper_id=turn.paper_id, title=turn.state["question"][:120])
            session.add(conversation)
            await session.flush()
        level = turn.state["explanation_level"]
        assistant = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=result.get("answer", ""),
            citations=result.get("citations", []),
            task=result.get("task"),
            explanation_level=level,
            insufficient_evidence=result.get("insufficient_evidence", False),
        )
        session.add(Message(conversation_id=conversation.id, role="user", content=turn.state["question"],
                            explanation_level=level))
        await session.flush()
        session.add(assistant)  # flushed separately so the user message sorts first
        await session.commit()
        return conversation.id, assistant.id


async def run_turn(turn: ChatTurn, user_id: str) -> ChatResponse:
    result = await build_research_graph().ainvoke(turn.state, turn.config)
    conversation_id, message_id = await _persist(turn, user_id, result)
    return ChatResponse(
        answer=result["answer"],
        citations=result.get("citations", []),
        task=result.get("task", "question_answer"),
        insufficient_evidence=result.get("insufficient_evidence", False),
        conversation_id=conversation_id,
        message_id=message_id,
    )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


async def stream_turn(turn: ChatTurn, user_id: str) -> AsyncIterator[str]:
    """Server-sent events: status -> route -> evidence -> token* -> final (or error)."""
    result: ResearchState = {}
    yield _sse("status", {"stage": "routing"})
    try:
        async for mode, chunk in build_research_graph().astream(
            turn.state, turn.config, stream_mode=["updates", "messages"]
        ):
            if mode == "messages":
                message, metadata = chunk
                if metadata.get("langgraph_node") in STREAMING_NODES and "nostream" not in metadata.get("tags", []):
                    if text := getattr(message, "content", ""):
                        yield _sse("token", {"text": text})
                continue
            for node, update in chunk.items():
                result.update(update or {})
                if node == "route":
                    yield _sse("route", {"task": update["task"]})
                    stage = {"related_papers": "searching", "general": "writing"}.get(update["task"], "retrieving")
                    yield _sse("status", {"stage": stage})
                elif node == "retrieve":
                    yield _sse("evidence", {"citations": [e.citation() for e in update["evidence"]]})
                    yield _sse("status", {"stage": "writing"})
                elif node == "validate":
                    yield _sse("status", {"stage": "validating"})
                elif node == "repair":
                    yield _sse("status", {"stage": "repairing"})
        conversation_id, message_id = await _persist(turn, user_id, result)
        yield _sse(
            "final",
            {
                "answer": result.get("answer", ""),
                "citations": result.get("citations", []),
                "related": result.get("related", []),
                "task": result.get("task", "question_answer"),
                "insufficient_evidence": result.get("insufficient_evidence", False),
                "conversation_id": conversation_id,
                "message_id": message_id,
            },
        )
    except Exception as exc:
        logger.exception("Chat turn failed")
        yield _sse("error", {"detail": f"The research assistant hit an error: {type(exc).__name__}. Please try again."})
