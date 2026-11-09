from fastapi import APIRouter

from paperpal.api.dependencies import PaperDep
from paperpal.core.exceptions import UpstreamError
from paperpal.db.models import Paper
from paperpal.schemas.related import GraphEdge, GraphNode, GraphOut, RelatedList, RelatedPaper
from paperpal.services.related_service import NOTICE, find_related

router = APIRouter(prefix="/papers/{paper_id}", tags=["related"])


async def _related(paper: Paper) -> list[RelatedPaper]:
    try:
        items = await find_related(paper.id, paper.title, paper.arxiv_id, (paper.analysis or {}).get("keywords", []))
    except Exception as exc:
        raise UpstreamError("Related-paper sources are unavailable right now. Please try again shortly.") from exc
    return [RelatedPaper(**item) for item in items]


@router.get("/related", response_model=RelatedList)
async def related(paper: PaperDep):
    return RelatedList(items=await _related(paper), notice=NOTICE)


@router.get("/graph", response_model=GraphOut)
async def graph(paper: PaperDep):
    items = await _related(paper)
    nodes = [GraphNode(id=paper.id, title=paper.title, url=paper.source_url, kind="root")]
    edges = []
    for item in items:
        nodes.append(
            GraphNode(id=item.key, title=item.title, url=item.url, year=item.year, kind="paper", relation=item.relation)
        )
        # Edges follow the citation direction: a citing paper points at the root.
        source, target = (item.key, paper.id) if item.relation == "cited_by" else (paper.id, item.key)
        edges.append(GraphEdge(source=source, target=target, relation=item.relation, verified=item.verified_citation))
    return GraphOut(nodes=nodes, edges=edges, notice=NOTICE)
