"""End-to-end API flow: demo login -> upload -> process -> analyze -> chat (JSON and SSE)."""
import asyncio
import json

import httpx
import pytest

from paperpal.db.session import Base, engine
from paperpal.main import app


@pytest.fixture
async def client():
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as http:
        yield http


@pytest.fixture
async def auth(client):
    response = await client.post("/auth/demo")
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def wait_for_ready(client, auth, paper_id: str) -> dict:
    for _ in range(600):
        paper = (await client.get(f"/papers/{paper_id}", headers=auth)).json()
        if paper["status"] in ("ready", "failed"):
            return paper
        await asyncio.sleep(0.2)
    raise AssertionError("paper did not finish processing")


async def test_requests_require_auth(client):
    assert (await client.get("/papers")).status_code == 401
    assert (await client.get("/papers", headers={"Authorization": "Bearer nope"})).status_code == 401


async def test_auth_config_and_demo_credentials(client):
    config = (await client.get("/auth/config")).json()
    assert config["demo_enabled"] and not config["llm_enabled"]
    bad = await client.post("/auth/demo", json={"email": config["demo_email"], "password": "wrong"})
    assert bad.status_code == 401
    good = await client.post("/auth/demo", json={"email": config["demo_email"], "password": "paperpal-demo"})
    assert good.status_code == 200


async def test_rejects_non_pdf(client, auth):
    files = {"file": ("notes.pdf", b"hello", "application/pdf")}
    assert (await client.post("/papers", files=files, headers=auth)).status_code == 415


async def test_full_paper_flow(client, auth, pdf_bytes):
    upload = await client.post("/papers", files={"file": ("sparse.pdf", pdf_bytes, "application/pdf")}, headers=auth)
    assert upload.status_code == 202, upload.text
    paper_id = upload.json()["paper"]["id"]

    paper = await wait_for_ready(client, auth, paper_id)
    assert paper["status"] == "ready", paper["error_code"]
    assert paper["page_count"] == 3
    assert paper["analysis"]["source"] == "extractive"
    assert "sparse" in paper["analysis"]["summary"].casefold()

    sections = (await client.get(f"/papers/{paper_id}/sections", headers=auth)).json()
    assert any(s["section_type"] == "method" for s in sections)

    pdf = await client.get(f"/papers/{paper_id}/pdf", headers=auth)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")

    chat = await client.post(
        f"/papers/{paper_id}/chat", json={"question": "Which datasets were used in the experiments?"}, headers=auth
    )
    assert chat.status_code == 200, chat.text
    body = chat.json()
    assert body["task"] == "results"
    assert body["citations"] and "SQuAD" in " ".join(c["quote"] for c in body["citations"])

    async with client.stream(
        "POST",
        f"/papers/{paper_id}/chat/stream",
        json={"question": "What are the limitations?", "conversation_id": body["conversation_id"]},
        headers=auth,
    ) as stream:
        events = [line.removeprefix("event: ") async for line in stream.aiter_lines() if line.startswith("event: ")]
    assert events[0] == "status" and "evidence" in events and events[-1] == "final"

    conversation = (await client.get(f"/conversations/{body['conversation_id']}", headers=auth)).json()
    assert [m["role"] for m in conversation["messages"]] == ["user", "assistant", "user", "assistant"]

    feedback = await client.post(
        "/feedback", json={"message_id": body["message_id"], "rating": "helpful"}, headers=auth
    )
    assert feedback.status_code == 201

    assert (await client.delete(f"/papers/{paper_id}", headers=auth)).status_code == 204
    assert (await client.get(f"/papers/{paper_id}", headers=auth)).status_code == 404


def test_sse_payloads_are_json():
    from paperpal.services.chat_service import _sse

    frame = _sse("token", {"text": "hi"})
    assert json.loads(frame.split("data: ", 1)[1]) == {"text": "hi"}
