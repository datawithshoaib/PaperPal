from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from paperpal.api.v1 import router as v1_router
from paperpal.core.config import get_settings
from paperpal.core.exceptions import register_exception_handlers
from paperpal.core.logging import configure_logging
from paperpal.db import models  # noqa: F401  (registers tables on Base.metadata)
from paperpal.db.session import Base, SessionLocal, engine

settings = get_settings()
configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # create_all keeps the zero-setup SQLite profile working; Postgres deployments run Alembic.
    if settings.database_url.startswith("sqlite"):
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title="PaperPal API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.frontend_origin.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_exception_handlers(app)
app.include_router(v1_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["ops"])
async def health():
    return {
        "status": "ok",
        "service": "paperpal-api",
        "llm": settings.llm_enabled,
        "supabase": settings.supabase_enabled,
    }


@app.get("/ready", tags=["ops"])
async def ready():
    async with SessionLocal() as session:
        await session.execute(text("SELECT 1"))
    return {"status": "ready"}
