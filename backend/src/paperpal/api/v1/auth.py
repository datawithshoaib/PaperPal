import asyncio
import logging
import secrets

from fastapi import APIRouter
from sqlalchemy import select

from paperpal.api.dependencies import UserDep
from paperpal.core.config import get_settings
from paperpal.core.exceptions import AuthError, NotFoundError
from paperpal.core.security import DEMO_USER_ID, create_demo_token
from paperpal.db.models import Paper
from paperpal.db.session import SessionLocal
from paperpal.schemas.auth import AuthConfig, DemoLogin, DemoSession, UserOut
from paperpal.services.paper_service import create_from_arxiv

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)
_seed_tasks: set[asyncio.Task] = set()


async def _seed_demo_library() -> None:
    """Give a fresh demo account one paper to explore."""
    settings = get_settings()
    if not settings.demo_seed_arxiv_id:
        return
    async with SessionLocal() as session:
        if await session.scalar(select(Paper.id).where(Paper.owner_id == DEMO_USER_ID).limit(1)):
            return
        try:
            await create_from_arxiv(session, DEMO_USER_ID, settings.demo_seed_arxiv_id)
        except Exception:
            logger.warning("Could not seed the demo library", exc_info=True)


@router.get("/config", response_model=AuthConfig)
async def auth_config():
    settings = get_settings()
    return AuthConfig(
        demo_enabled=settings.demo_enabled,
        demo_email=settings.demo_email if settings.demo_enabled else None,
        supabase_enabled=settings.supabase_enabled,
        llm_enabled=settings.llm_enabled,
        llm_model=settings.groq_model if settings.llm_enabled else None,
    )


@router.post("/demo", response_model=DemoSession)
async def demo_login(credentials: DemoLogin | None = None):
    settings = get_settings()
    if not settings.demo_enabled:
        raise NotFoundError("The demo account is disabled")
    if credentials and not (
        secrets.compare_digest(credentials.email.strip().casefold(), settings.demo_email.casefold())
        and secrets.compare_digest(credentials.password, settings.demo_password)
    ):
        raise AuthError("Incorrect demo email or password")
    token, expires_at = create_demo_token()
    task = asyncio.create_task(_seed_demo_library())
    _seed_tasks.add(task)
    task.add_done_callback(_seed_tasks.discard)
    user = UserOut(id=DEMO_USER_ID, email=settings.demo_email, name="Demo Researcher", provider="demo", is_demo=True)
    return DemoSession(access_token=token, expires_at=expires_at, user=user)


@router.get("/me", response_model=UserOut)
async def me(user: UserDep):
    return UserOut(id=user.id, email=user.email, name=user.name, provider=user.provider, is_demo=user.is_demo)
