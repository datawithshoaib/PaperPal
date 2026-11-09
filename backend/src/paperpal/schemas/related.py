from typing import Literal

from pydantic import BaseModel

Relation = Literal["cites", "cited_by", "similar_to"]


class RelatedPaper(BaseModel):
    key: str
    title: str
    url: str | None
    abstract: str = ""
    authors: list[str] = []
    year: int | None = None
    relation: Relation
    verified_citation: bool
    source: str


class RelatedList(BaseModel):
    items: list[RelatedPaper]
    notice: str


class GraphNode(BaseModel):
    id: str
    title: str
    url: str | None
    year: int | None = None
    kind: Literal["root", "paper"]
    relation: Relation | None = None


class GraphEdge(BaseModel):
    source: str
    target: str
    relation: Relation
    verified: bool


class GraphOut(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    notice: str
