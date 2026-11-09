from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from paperpal.core.exceptions import AuthError
from paperpal.core.security import AuthUser, verify_token
from paperpal.db.models import Paper
from paperpal.db.session import get_session
from paperpal.services.paper_service import get_owned_paper

bearer = HTTPBearer(auto_error=False)


async def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> AuthUser:
    if not credentials or not credentials.credentials:
        raise AuthError("Authentication required")
    return verify_token(credentials.credentials)


SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[AuthUser, Depends(current_user)]


async def owned_paper(paper_id: str, user: UserDep, session: SessionDep) -> Paper:
    return await get_owned_paper(session, paper_id, user.id)


PaperDep = Annotated[Paper, Depends(owned_paper)]
