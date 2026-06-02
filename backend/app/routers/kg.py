from __future__ import annotations

from urllib.parse import unquote

from fastapi import APIRouter, Depends, Query

from ..deps import get_kg
from ..models import KGMeta, KGSearchHit, NodeDetail, Subgraph
from ..services.kg import KGService

router = APIRouter()


@router.get("/kg/meta", response_model=KGMeta)
def meta(kg: KGService = Depends(get_kg)) -> KGMeta:
    return kg.meta()


@router.get("/kg/subgraph", response_model=Subgraph)
def subgraph(
    seed: str | None = None,
    doc_id: str | None = None,
    node_types: str | None = None,
    edge_types: str | None = None,
    depth: int = Query(1, ge=1, le=2),
    limit: int = Query(250, ge=1, le=600),
    kg: KGService = Depends(get_kg),
) -> Subgraph:
    return kg.subgraph(
        seed=seed,
        doc_id=doc_id,
        node_types=_csv(node_types),
        edge_types=_csv(edge_types),
        depth=depth,
        limit=limit,
    )


@router.get("/kg/node", response_model=NodeDetail)
def node_by_query(
    id: str = Query(..., min_length=1),
    kg: KGService = Depends(get_kg),
) -> NodeDetail:
    return kg.node(id)


@router.get("/kg/node/{node_id:path}", response_model=NodeDetail)
def node_by_path(
    node_id: str,
    kg: KGService = Depends(get_kg),
) -> NodeDetail:
    return kg.node(unquote(node_id))


@router.get("/kg/search", response_model=list[KGSearchHit])
def search(
    q: str = Query(..., min_length=1),
    node_types: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    kg: KGService = Depends(get_kg),
) -> list[KGSearchHit]:
    return kg.search(q, node_types=_csv(node_types), limit=limit)


def _csv(value: str | None) -> list[str] | None:
    if not value:
        return None
    values = [item.strip() for item in value.split(",") if item.strip()]
    return values or None
