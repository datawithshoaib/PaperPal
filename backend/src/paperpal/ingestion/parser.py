from dataclasses import dataclass

import pymupdf


@dataclass
class TextBlock:
    page: int
    text: str


@dataclass
class ParsedPdf:
    page_count: int
    blocks: list[TextBlock]
    title_guess: str | None


def extract_pdf(data: bytes, max_pages: int) -> ParsedPdf:
    """Extract reading-order text blocks with page provenance."""
    try:
        document = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ValueError("invalid_pdf") from exc
    with document:
        if document.page_count > max_pages:
            raise ValueError("page_limit_exceeded")
        blocks: list[TextBlock] = []
        for index, page in enumerate(document):
            for block in page.get_text("blocks", sort=True):
                # (x0, y0, x1, y1, text, block_no, block_type); type 1 is an image.
                text = " ".join(block[4].replace("-\n", "").split()) if block[6] == 0 else ""
                if len(text) > 1:
                    blocks.append(TextBlock(index + 1, text))
        title = (document.metadata or {}).get("title") or None
        page_count = document.page_count
    if not blocks:
        raise ValueError("no_extractable_text")
    return ParsedPdf(page_count, blocks, title.strip() if title and len(title.strip()) > 4 else None)
