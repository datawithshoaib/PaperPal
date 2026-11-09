import os
import tempfile
from pathlib import Path

import pytest

# Settings are read once at import time, so the test environment must be set first.
_tmp = Path(tempfile.mkdtemp(prefix="paperpal-tests-"))
os.environ.update(
    {
        "APP_ENV": "test",
        "DATABASE_URL": f"sqlite+aiosqlite:///{(_tmp / 'test.db').as_posix()}",
        "UPLOAD_DIR": str(_tmp / "uploads"),
        "CHROMA_DIR": str(_tmp / "chroma"),
        "CHROMA_HOST": "",
        "GROQ_API_KEY": "",
        "SUPABASE_URL": "",
        "DEMO_ENABLED": "true",
        "DEMO_SEED_ARXIV_ID": "",
        "USE_CELERY": "false",
    }
)

import pymupdf  # noqa: E402

PAGES = [
    [
        "Sparse Routing Networks for Efficient Reading",
        "Abstract",
        "We introduce sparse routing networks, a method that routes tokens to a small set of experts. "
        "Sparse routing reduces compute by 40 percent while matching dense accuracy on reading comprehension.",
        "1 Introduction",
        "Large language models are expensive to run. The problem we address is the cost of dense computation "
        "for every token. Our contributions are a routing algorithm and an analysis of its efficiency.",
    ],
    [
        "2 Method",
        "The router computes a score for each expert using a learned projection. Tokens are dispatched to the "
        "top two experts. A load balancing loss keeps expert utilization even across the batch.",
        "3 Experiments",
        "We evaluate on SQuAD and TriviaQA. The sparse model reaches 88.1 F1 on SQuAD compared with 88.3 for the "
        "dense baseline while using 40 percent fewer floating point operations.",
    ],
    [
        "4 Limitations",
        "Our evaluation covers English datasets only. Routing adds communication overhead on multi-device setups "
        "and the load balancing loss requires tuning for each model size.",
        "References",
        "[1] A. Author. Mixture of experts. 2017.",
    ],
]


def make_pdf() -> bytes:
    document = pymupdf.open()
    for paragraphs in PAGES:
        page = document.new_page()
        y = 72
        for paragraph in paragraphs:
            rect = pymupdf.Rect(72, y, 540, y + 120)
            page.insert_textbox(rect, paragraph, fontsize=10)
            y += 30 + 14 * (len(paragraph) // 80 + 1)
    data = document.tobytes()
    document.close()
    return data


@pytest.fixture(scope="session")
def pdf_bytes() -> bytes:
    return make_pdf()
