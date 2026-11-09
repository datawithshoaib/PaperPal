import re

SECTION_TYPES: dict[str, str] = {
    "abstract": "abstract",
    "introduction": "introduction",
    "background": "background",
    "preliminaries": "background",
    "related work": "related_work",
    "related works": "related_work",
    "prior work": "related_work",
    "method": "method",
    "methods": "method",
    "methodology": "method",
    "approach": "method",
    "model": "method",
    "model architecture": "method",
    "proposed method": "method",
    "experiment": "experiments",
    "experiments": "experiments",
    "experimental setup": "experiments",
    "evaluation": "experiments",
    "results": "results",
    "experimental results": "results",
    "analysis": "results",
    "discussion": "discussion",
    "limitation": "limitations",
    "limitations": "limitations",
    "limitations and future work": "limitations",
    "future work": "limitations",
    "conclusion": "conclusion",
    "conclusions": "conclusion",
    "references": "references",
    "bibliography": "references",
    "acknowledgments": "acknowledgments",
    "acknowledgements": "acknowledgments",
    "appendix": "appendix",
}

_NUMBERING = r"^(?:(?:\d+(?:\.\d+)*|[IVX]+|[A-H])[.)]?\s+)?"
_NAMES = "|".join(sorted(map(re.escape, SECTION_TYPES), key=len, reverse=True))
_HEADING = re.compile(_NUMBERING + r"(" + _NAMES + r")\b[:.]?", re.I)
_NUMBERED_HEADING = re.compile(r"^(\d+(?:\.\d+)*)\.?\s+([A-Z][\w\- ,:&]{2,70})$")


def detect_heading(block_text: str) -> tuple[str, str] | None:
    """Return (title, section_type) when a text block is a section heading."""
    text = block_text.strip()
    if len(text) > 90:
        # Headings often share a block with the first paragraph ("1 Introduction The ...").
        match = _HEADING.match(text)
        if match and (match.end() >= len(text) or text[match.end()] in " :.\n"):
            title = re.sub(_NUMBERING, "", text[: match.end()]).strip(" .:")
            return title.title(), SECTION_TYPES[match.group(1).casefold()]
        return None
    match = _HEADING.match(text)
    if match and len(text) - match.end() < 40:
        title = re.sub(_NUMBERING, "", text).strip(" .:")
        return title, SECTION_TYPES[match.group(1).casefold()]
    numbered = _NUMBERED_HEADING.match(text)
    if numbered and "." not in numbered.group(1) and not text.endswith("."):
        return numbered.group(2).strip(), "body"
    return None
