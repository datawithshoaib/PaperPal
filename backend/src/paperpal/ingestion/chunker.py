from dataclasses import dataclass

from langchain_text_splitters import RecursiveCharacterTextSplitter

from paperpal.ingestion.parser import TextBlock
from paperpal.ingestion.sections import detect_heading


@dataclass
class Chunk:
    section_title: str
    section_type: str
    page_start: int
    page_end: int
    text: str
    token_count: int
    chunk_index: int


@dataclass
class _Section:
    title: str
    section_type: str
    blocks: list[TextBlock]


def split_sections(blocks: list[TextBlock]) -> list[_Section]:
    sections = [_Section("Front matter", "front_matter", [])]
    for block in blocks:
        heading = detect_heading(block.text)
        if heading:
            title, section_type = heading
            # Unnumbered body headings inherit the type of the canonical section they follow.
            if section_type == "body" and sections[-1].section_type not in ("front_matter", "references"):
                section_type = sections[-1].section_type
            sections.append(_Section(title, section_type, []))
            if len(block.text) > 90:  # the heading shares its block with the first paragraph
                sections[-1].blocks.append(block)
            continue
        sections[-1].blocks.append(block)
    return [section for section in sections if section.blocks]


def chunk_blocks(blocks: list[TextBlock], max_chars: int = 2200, overlap_chars: int = 300) -> list[Chunk]:
    """Pack paragraphs into section-bounded chunks that remember their page range."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=max_chars, chunk_overlap=overlap_chars)
    chunks: list[Chunk] = []

    def emit(section: _Section, parts: list[TextBlock]) -> None:
        text = "\n\n".join(part.text for part in parts).strip()
        if len(text) < 40:
            return
        page_start, page_end = parts[0].page, parts[-1].page
        chunks.append(
            Chunk(section.title, section.section_type, page_start, page_end, text, len(text.split()), len(chunks))
        )

    for section in split_sections(blocks):
        pending: list[TextBlock] = []
        size = 0
        for block in section.blocks:
            pieces = [TextBlock(block.page, piece) for piece in splitter.split_text(block.text)] or [block]
            for piece in pieces:
                if pending and size + len(piece.text) > max_chars:
                    emit(section, pending)
                    tail = pending[-1]
                    pending = [TextBlock(tail.page, tail.text[-overlap_chars:])] if overlap_chars else []
                    size = len(pending[0].text) if pending else 0
                pending.append(piece)
                size += len(piece.text)
        if pending:
            emit(section, pending)
    return chunks
