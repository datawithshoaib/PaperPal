from datetime import datetime

from pydantic import BaseModel


class UserOut(BaseModel):
    id: str
    email: str | None
    name: str | None
    provider: str
    is_demo: bool


class DemoSession(BaseModel):
    access_token: str
    expires_at: datetime
    user: UserOut


class DemoLogin(BaseModel):
    email: str
    password: str


class AuthConfig(BaseModel):
    demo_enabled: bool
    demo_email: str | None
    supabase_enabled: bool
    llm_enabled: bool
    llm_model: str | None
