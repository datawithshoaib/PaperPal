"""Access-token verification.

Two issuers are accepted:
- Supabase Auth (email/password and Google). Asymmetric tokens are checked against the project's
  JWKS; legacy HS256 tokens are checked with SUPABASE_JWT_SECRET.
- PaperPal itself, for the local demo account. These are HS256 tokens signed with AUTH_SECRET.
"""
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import jwt

from paperpal.core.config import get_settings
from paperpal.core.exceptions import AuthError

DEMO_ISSUER = "paperpal-demo"
DEMO_USER_ID = "demo-user"


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None
    name: str | None
    provider: str
    is_demo: bool = False


def create_demo_token() -> tuple[str, datetime]:
    settings = get_settings()
    expires_at = datetime.now(UTC) + timedelta(hours=settings.demo_token_ttl_hours)
    claims = {
        "sub": DEMO_USER_ID,
        "email": settings.demo_email,
        "name": "Demo Researcher",
        "iss": DEMO_ISSUER,
        "aud": "authenticated",
        "exp": expires_at,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(claims, settings.auth_secret, algorithm="HS256"), expires_at


@lru_cache
def _jwks_client(supabase_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json", cache_keys=True)


def _verify_supabase(token: str, header: dict) -> dict:
    settings = get_settings()
    if not settings.supabase_enabled:
        raise AuthError("Supabase authentication is not configured on the API")
    issuer = f"{settings.supabase_url.rstrip('/')}/auth/v1"
    algorithm = header.get("alg", "")
    if algorithm == "HS256":
        if not settings.supabase_jwt_secret:
            raise AuthError("SUPABASE_JWT_SECRET is required to verify HS256 Supabase tokens")
        key = settings.supabase_jwt_secret
    else:
        key = _jwks_client(settings.supabase_url).get_signing_key_from_jwt(token).key
    return jwt.decode(token, key, algorithms=[algorithm], audience="authenticated", issuer=issuer)


def verify_token(token: str) -> AuthUser:
    settings = get_settings()
    try:
        header = jwt.get_unverified_header(token)
        unverified = jwt.decode(token, options={"verify_signature": False})
        if unverified.get("iss") == DEMO_ISSUER:
            if not settings.demo_enabled:
                raise AuthError("The demo account is disabled")
            claims = jwt.decode(
                token, settings.auth_secret, algorithms=["HS256"], audience="authenticated", issuer=DEMO_ISSUER
            )
            return AuthUser(DEMO_USER_ID, claims.get("email"), claims.get("name"), "demo", is_demo=True)
        claims = _verify_supabase(token, header)
    except jwt.ExpiredSignatureError:
        raise AuthError("Your session has expired. Please sign in again.") from None
    except (jwt.PyJWTError, jwt.PyJWKClientError) as exc:
        raise AuthError(f"Invalid access token: {exc}") from None
    metadata = claims.get("user_metadata") or {}
    provider = (claims.get("app_metadata") or {}).get("provider", "email")
    return AuthUser(
        id=claims["sub"],
        email=claims.get("email"),
        name=metadata.get("full_name") or metadata.get("name"),
        provider=provider,
    )
