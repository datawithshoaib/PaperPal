from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class PaperPalError(Exception):
    status_code = 400

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class AuthError(PaperPalError):
    status_code = 401


class NotFoundError(PaperPalError):
    status_code = 404


class ConflictError(PaperPalError):
    status_code = 409


class PayloadTooLargeError(PaperPalError):
    status_code = 413


class UnsupportedMediaError(PaperPalError):
    status_code = 415


class UpstreamError(PaperPalError):
    status_code = 502


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(PaperPalError)
    async def handle_paperpal_error(_: Request, exc: PaperPalError):
        headers = {"WWW-Authenticate": "Bearer"} if isinstance(exc, AuthError) else None
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=headers)
