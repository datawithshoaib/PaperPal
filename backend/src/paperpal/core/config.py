from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    # The root .env is shared by the API, the worker, and Docker Compose; backend/.env overrides it.
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR.parent / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "sqlite+aiosqlite:///./paperpal.db"
    frontend_origin: str = "http://localhost:3000"
    use_celery: bool = False
    redis_url: str = "redis://localhost:6379/0"

    # Uploads
    max_upload_bytes: int = 25 * 1024 * 1024
    max_pdf_pages: int = 500
    upload_dir: str = "./data/uploads"
    arxiv_timeout_seconds: float = 20

    # LLM (Groq via LangChain)
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_fast_model: str = "llama-3.1-8b-instant"
    llm_temperature: float = 0.1
    llm_timeout_seconds: float = 60

    # RAG (ChromaDB)
    chroma_dir: str = "./data/chroma"
    chroma_host: str = ""  # set to use a Chroma server (required when the API and a worker both write)
    chroma_port: int = 8000
    retrieval_top_k: int = 6

    # Auth: Supabase access tokens, plus locally signed tokens for the demo account
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    auth_secret: str = "paperpal-local-development-secret-change-me"
    demo_enabled: bool = True
    demo_email: str = "demo@paperpal.dev"
    demo_password: str = "paperpal-demo"
    demo_token_ttl_hours: int = 24
    demo_seed_arxiv_id: str = "1706.03762"  # added to an empty demo library; blank to disable

    @property
    def llm_enabled(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url)

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
