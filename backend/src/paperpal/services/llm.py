"""Groq chat models through LangChain. Every caller must handle `llm_enabled == False`."""
from functools import lru_cache

from langchain_groq import ChatGroq

from paperpal.core.config import get_settings


@lru_cache
def get_chat_model(fast: bool = False) -> ChatGroq:
    settings = get_settings()
    if not settings.llm_enabled:
        raise RuntimeError("GROQ_API_KEY is not configured")
    return ChatGroq(
        model=settings.groq_fast_model if fast else settings.groq_model,
        api_key=settings.groq_api_key,
        temperature=settings.llm_temperature,
        timeout=settings.llm_timeout_seconds,
        max_retries=2,
    )
