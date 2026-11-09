from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from paperpal.api.dependencies import PaperDep, SessionDep, UserDep
from paperpal.core.exceptions import NotFoundError
from paperpal.db.models import Conversation, Feedback, Message
from paperpal.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationOut,
    ConversationSummary,
    FeedbackRequest,
    MessageOut,
)
from paperpal.services import chat_service

router = APIRouter(tags=["chat"])


@router.post("/papers/{paper_id}/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, paper: PaperDep, user: UserDep, session: SessionDep):
    turn = await chat_service.prepare_turn(session, paper, request, user.id)
    return await chat_service.run_turn(turn, user.id)


@router.post("/papers/{paper_id}/chat/stream")
async def chat_stream(request: ChatRequest, paper: PaperDep, user: UserDep, session: SessionDep):
    turn = await chat_service.prepare_turn(session, paper, request, user.id)
    return StreamingResponse(
        chat_service.stream_turn(turn, user.id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/papers/{paper_id}/conversations", response_model=list[ConversationSummary])
async def list_conversations(paper: PaperDep, user: UserDep, session: SessionDep):
    rows = (await session.scalars(
        select(Conversation)
        .where(Conversation.paper_id == paper.id, Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
    )).all()
    return [ConversationSummary.model_validate(row, from_attributes=True) for row in rows]


async def _owned_conversation(session: AsyncSession, conversation_id: str, user_id: str) -> Conversation:
    conversation = await session.get(Conversation, conversation_id)
    if not conversation or conversation.user_id != user_id:
        raise NotFoundError("Conversation not found")
    return conversation


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
async def get_conversation(conversation_id: str, user: UserDep, session: SessionDep):
    conversation = await _owned_conversation(session, conversation_id, user.id)
    messages = (await session.scalars(
        select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at)
    )).all()
    return ConversationOut(
        id=conversation.id,
        paper_id=conversation.paper_id,
        title=conversation.title,
        updated_at=conversation.updated_at,
        messages=[MessageOut.model_validate(m, from_attributes=True) for m in messages],
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: str, user: UserDep, session: SessionDep):
    await session.delete(await _owned_conversation(session, conversation_id, user.id))
    await session.commit()


@router.post("/feedback", status_code=201)
async def feedback(request: FeedbackRequest, user: UserDep, session: SessionDep):
    message = await session.get(Message, request.message_id)
    if not message:
        raise NotFoundError("Message not found")
    await _owned_conversation(session, message.conversation_id, user.id)
    record = Feedback(user_id=user.id, message_id=message.id, rating=request.rating, comment=request.comment)
    session.add(record)
    await session.commit()
    return {"id": record.id, "status": "recorded"}
