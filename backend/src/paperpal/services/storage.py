"""Private PDF storage on the local filesystem (a mounted volume in Docker)."""
import asyncio
from pathlib import Path

from paperpal.core.config import get_settings


def pdf_path(storage_key: str) -> Path:
    return Path(get_settings().upload_dir, storage_key)


async def save_pdf(paper_id: str, content: bytes) -> str:
    storage_key = f"{paper_id}.pdf"
    path = pdf_path(storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    await asyncio.to_thread(path.write_bytes, content)
    return storage_key


async def read_pdf(storage_key: str) -> bytes:
    return await asyncio.to_thread(pdf_path(storage_key).read_bytes)


def delete_pdf(storage_key: str | None) -> None:
    if storage_key:
        pdf_path(storage_key).unlink(missing_ok=True)
