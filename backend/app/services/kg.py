from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from ..models.kg import (
    CorpusLink,
    KGDocumentCount,
    KGEdge,
    KGMeta,
    KGNode,
    KGPredicateCount,
    KGSearchHit,
    KGTypeCount,
    KGTotals,
    NodeDegree,
    NodeDetail,
    Subgraph,
)
from ..settings import Settings, settings
from .corpus import CorpusService

MAX_SUBGRAPH_LIMIT = 600
DEFAULT_SUBGRAPH_LIMIT = 250
DOC_ID_RE = re.compile(r"^(?P<num>.+)_(?P<date>\d{4}-\d{2}-\d{2})$")


class KGService:
    def __init__(
        self,
        corpus: CorpusService,
        config: Settings = settings,
    ) -> None:
        self.corpus = corpus
        self.settings = config

    def meta(self) -> KGMeta:
        with self._connect() as conn:
            node_types = [
                KGTypeCount(type=row["type"] or "Unknown", count=row["count"])
                for row in conn.execute(
                    """
                    SELECT type, COUNT(*) AS count
                    FROM nodes
                    GROUP BY type
                    ORDER BY count DESC, type
                    """
                )
            ]
            edge_types = [
                KGPredicateCount(predicate=row["predicate"], count=row["count"])
                for row in conn.execute(
                    """
                    SELECT predicate, COUNT(*) AS count
                    FROM edges
                    GROUP BY predicate
                    ORDER BY count DESC, predicate
                    """
                )
            ]
            documents = self._documents(conn)
            totals = KGTotals(
                nodes=self._scalar(conn, "SELECT COUNT(*) FROM nodes"),
                edges=self._scalar(conn, "SELECT COUNT(*) FROM edges"),
            )
        return KGMeta(
            node_types=node_types,
            edge_types=edge_types,
            documents=documents,
            totals=totals,
        )

    def subgraph(
        self,
        *,
        seed: str | None = None,
        doc_id: str | None = None,
        node_types: list[str] | None = None,
        edge_types: list[str] | None = None,
        depth: int = 1,
        limit: int = DEFAULT_SUBGRAPH_LIMIT,
    ) -> Subgraph:
        depth = 2 if depth == 2 else 1
        limit = max(1, min(limit, MAX_SUBGRAPH_LIMIT))
        node_type_set = set(node_types or [])
        edge_type_set = set(edge_types or [])

        with self._connect() as conn:
            seed_id = self._resolve_seed(conn, seed=seed, doc_id=doc_id)
            seed_row = self._node_row(conn, seed_id)
            if seed_row is None:
                raise HTTPException(status_code=404, detail="KG seed not found")

            total_neighbors = self._neighbor_count(
                conn,
                seed_id,
                node_types=node_type_set,
                edge_types=edge_type_set,
            )

            node_ids: set[str] = {seed_id}
            edge_ids: set[int] = set()
            frontier: list[str] = [seed_id]
            truncated = False

            for _ in range(depth):
                next_frontier: list[str] = []
                for current_id in frontier:
                    for edge_row, neighbor_row in self._neighbors(
                        conn,
                        current_id,
                        edge_types=edge_type_set,
                    ):
                        neighbor_id = neighbor_row["id"]
                        if node_type_set and neighbor_row["type"] not in node_type_set:
                            continue

                        if neighbor_id not in node_ids:
                            if len(node_ids) >= limit:
                                truncated = True
                                continue
                            node_ids.add(neighbor_id)
                            next_frontier.append(neighbor_id)

                        if (
                            edge_row["source"] in node_ids
                            and edge_row["target"] in node_ids
                        ):
                            edge_ids.add(edge_row["id"])

                if not next_frontier or len(node_ids) >= limit:
                    if next_frontier:
                        truncated = True
                    break
                frontier = next_frontier

            node_rows = self._node_rows(conn, node_ids)
            edge_rows = self._edge_rows(conn, edge_ids)

        return Subgraph(
            nodes=[self._kg_node(row) for row in node_rows],
            edges=[self._kg_edge(row) for row in edge_rows],
            truncated=truncated or total_neighbors > max(limit - 1, 0),
            total_neighbors=total_neighbors,
        )

    def node(self, node_id: str) -> NodeDetail:
        with self._connect() as conn:
            row = self._node_row(conn, node_id)
            if row is None:
                raise HTTPException(status_code=404, detail="KG node not found")
            degree = NodeDegree(
                in_count=self._scalar(
                    conn,
                    "SELECT COUNT(*) FROM edges WHERE target = ?",
                    (node_id,),
                ),
                out_count=self._scalar(
                    conn,
                    "SELECT COUNT(*) FROM edges WHERE source = ?",
                    (node_id,),
                ),
            )

        link = self._corpus_link(row)
        return NodeDetail(
            id=row["id"],
            type=row["type"],
            label=row["label"],
            doc_id=row["doc_id"],
            article_ref=row["article_ref"],
            text=row["text"],
            props=_loads_props(row["props_json"]),
            corpus_link=link,
            degree=degree,
        )

    def search(
        self,
        q: str,
        *,
        node_types: list[str] | None = None,
        limit: int = 50,
    ) -> list[KGSearchHit]:
        limit = max(1, min(limit, 100))
        variants = _query_variants(q)
        if not variants:
            return []

        clauses: list[str] = []
        params: list[Any] = []
        for variant in variants:
            pattern = f"%{_escape_like(variant)}%"
            clauses.append(
                """
                (
                    label LIKE ? ESCAPE '\\'
                    OR text LIKE ? ESCAPE '\\'
                    OR props_json LIKE ? ESCAPE '\\'
                )
                """
            )
            params.extend([pattern, pattern, pattern])

        where = f"({' OR '.join(clauses)})"
        if node_types:
            placeholders = ",".join("?" for _ in node_types)
            where = f"{where} AND type IN ({placeholders})"
            params.extend(node_types)

        params.append(limit)
        sql = f"""
            SELECT *
            FROM nodes
            WHERE {where}
            ORDER BY
                CASE
                    WHEN label LIKE ? ESCAPE '\\' THEN 0
                    WHEN text LIKE ? ESCAPE '\\' THEN 1
                    ELSE 2
                END,
                label
            LIMIT ?
        """
        order_pattern = f"%{_escape_like(variants[0])}%"
        order_params = params[:-1] + [order_pattern, order_pattern, limit]

        with self._connect() as conn:
            rows = conn.execute(sql, order_params).fetchall()

        return [self._search_hit(row, variants[0]) for row in rows]

    def _connect(self) -> sqlite3.Connection:
        path = self.settings.KG_INDEX_PATH
        if not path.exists():
            raise HTTPException(
                status_code=503,
                detail="kg index not built; run build_kg_index",
            )
        conn = sqlite3.connect(_sqlite_readonly_uri(path), uri=True)
        conn.row_factory = sqlite3.Row
        return conn

    def _documents(self, conn: sqlite3.Connection) -> list[KGDocumentCount]:
        node_counts = {
            row["doc_id"]: row["nodes"]
            for row in conn.execute(
                """
                SELECT doc_id, COUNT(*) AS nodes
                FROM nodes
                WHERE doc_id IS NOT NULL
                GROUP BY doc_id
                """
            )
        }
        edge_counts = {
            row["doc_id"]: row["edges"]
            for row in conn.execute(
                """
                SELECT n.doc_id, COUNT(e.id) AS edges
                FROM edges e
                JOIN nodes n ON n.id = e.source
                WHERE n.doc_id IS NOT NULL
                GROUP BY n.doc_id
                """
            )
        }
        return [
            KGDocumentCount(
                doc_id=doc_id,
                nodes=node_counts.get(doc_id, 0),
                edges=edge_counts.get(doc_id, 0),
            )
            for doc_id in sorted(node_counts)
        ]

    def _resolve_seed(
        self,
        conn: sqlite3.Connection,
        *,
        seed: str | None,
        doc_id: str | None,
    ) -> str:
        if seed:
            return seed
        if not doc_id:
            raise HTTPException(
                status_code=400,
                detail="Provide either seed or doc_id for KG subgraph",
            )

        canonical = self.corpus.pipeline.resolve_doc_id(doc_id) or doc_id
        doc_uri = _law_uri_from_doc_id(canonical)
        if doc_uri and self._node_row(conn, doc_uri) is not None:
            return doc_uri

        row = conn.execute(
            """
            SELECT id
            FROM nodes
            WHERE doc_id = ? AND type = 'Law'
            ORDER BY id
            LIMIT 1
            """,
            (canonical,),
        ).fetchone()
        if row is not None:
            return row["id"]

        row = conn.execute(
            """
            SELECT id
            FROM nodes
            WHERE doc_id = ?
            ORDER BY
                CASE WHEN type = 'Article' THEN 0 ELSE 1 END,
                id
            LIMIT 1
            """,
            (canonical,),
        ).fetchone()
        if row is not None:
            return row["id"]

        raise HTTPException(status_code=404, detail="KG document seed not found")

    def _neighbor_count(
        self,
        conn: sqlite3.Connection,
        node_id: str,
        *,
        node_types: set[str],
        edge_types: set[str],
    ) -> int:
        rows = self._neighbors(conn, node_id, edge_types=edge_types)
        count = 0
        seen: set[str] = set()
        for _, neighbor in rows:
            neighbor_id = neighbor["id"]
            if neighbor_id in seen:
                continue
            if node_types and neighbor["type"] not in node_types:
                continue
            seen.add(neighbor_id)
            count += 1
        return count

    def _neighbors(
        self,
        conn: sqlite3.Connection,
        node_id: str,
        *,
        edge_types: set[str],
    ) -> list[tuple[sqlite3.Row, sqlite3.Row]]:
        edge_filter = ""
        out_params: list[Any] = [node_id]
        in_params: list[Any] = [node_id]
        if edge_types:
            placeholders = ",".join("?" for _ in edge_types)
            edge_filter = f"AND e.predicate IN ({placeholders})"
            out_params.extend(sorted(edge_types))
            in_params.extend(sorted(edge_types))

        sql = f"""
            SELECT e.*, n.id AS neighbor_id
            FROM edges e
            JOIN nodes n ON n.id = e.target
            WHERE e.source = ? {edge_filter}
            UNION ALL
            SELECT e.*, n.id AS neighbor_id
            FROM edges e
            JOIN nodes n ON n.id = e.source
            WHERE e.target = ? {edge_filter}
            ORDER BY id
        """
        edge_rows = conn.execute(sql, out_params + in_params).fetchall()
        out: list[tuple[sqlite3.Row, sqlite3.Row]] = []
        for edge_row in edge_rows:
            neighbor_id = edge_row["neighbor_id"]
            neighbor = self._node_row(conn, neighbor_id)
            if neighbor is not None:
                out.append((edge_row, neighbor))
        return out

    def _node_row(self, conn: sqlite3.Connection, node_id: str) -> sqlite3.Row | None:
        return conn.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()

    def _node_rows(
        self,
        conn: sqlite3.Connection,
        node_ids: set[str],
    ) -> list[sqlite3.Row]:
        if not node_ids:
            return []
        placeholders = ",".join("?" for _ in node_ids)
        return conn.execute(
            f"SELECT * FROM nodes WHERE id IN ({placeholders}) ORDER BY label, id",
            sorted(node_ids),
        ).fetchall()

    def _edge_rows(
        self,
        conn: sqlite3.Connection,
        edge_ids: set[int],
    ) -> list[sqlite3.Row]:
        if not edge_ids:
            return []
        placeholders = ",".join("?" for _ in edge_ids)
        return conn.execute(
            f"SELECT * FROM edges WHERE id IN ({placeholders}) ORDER BY id",
            sorted(edge_ids),
        ).fetchall()

    def _kg_node(self, row: sqlite3.Row) -> KGNode:
        return KGNode(
            id=row["id"],
            type=row["type"],
            label=row["label"],
            doc_id=row["doc_id"],
            article_ref=row["article_ref"],
            props=_loads_props(row["props_json"]),
        )

    def _kg_edge(self, row: sqlite3.Row) -> KGEdge:
        return KGEdge(
            id=row["id"],
            source=row["source"],
            target=row["target"],
            predicate=row["predicate"],
        )

    def _search_hit(self, row: sqlite3.Row, query: str) -> KGSearchHit:
        return KGSearchHit(
            id=row["id"],
            type=row["type"],
            label=row["label"],
            doc_id=row["doc_id"],
            article_ref=row["article_ref"],
            props=_loads_props(row["props_json"]),
            text_snippet=_snippet(row["text"] or row["label"] or "", query),
            score=_score(row, query),
        )

    def _corpus_link(self, row: sqlite3.Row) -> CorpusLink | None:
        if row["type"] != "Article" or not row["doc_id"] or not row["article_ref"]:
            return None
        try:
            article = self.corpus.article(row["doc_id"], row["article_ref"])
        except HTTPException:
            return CorpusLink(
                doc_id=row["doc_id"],
                article_ref=row["article_ref"],
            )
        return CorpusLink(doc_id=article.doc_id, article_ref=article.article_ref)

    def _scalar(
        self,
        conn: sqlite3.Connection,
        sql: str,
        params: tuple[Any, ...] = (),
    ) -> int:
        value = conn.execute(sql, params).fetchone()[0]
        return int(value or 0)


def _loads_props(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if isinstance(parsed, dict):
        return parsed
    return {}


def _law_uri_from_doc_id(doc_id: str) -> str | None:
    match = DOC_ID_RE.match(doc_id)
    if not match:
        return None
    return f"https://legal.dz/resource/law/{match.group('date')}/{match.group('num')}"


def _sqlite_readonly_uri(path: Path) -> str:
    return f"file:{path.resolve()}?mode=ro"


def _query_variants(query: str) -> list[str]:
    variants = [query.strip()]
    try:
        from akn_rlm.normalizers import normalize_arabic

        normalized = normalize_arabic(query).strip()
        if normalized and normalized not in variants:
            variants.append(normalized)
    except Exception:
        pass
    return [variant for variant in variants if variant]


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _snippet(text: str, query: str, width: int = 220) -> str | None:
    if not text:
        return None
    compact = " ".join(text.split())
    pos = compact.find(query)
    if pos < 0:
        return compact[:width]
    start = max(0, pos - 60)
    end = min(len(compact), start + width)
    return compact[start:end]


def _score(row: sqlite3.Row, query: str) -> float:
    label = row["label"] or ""
    text = row["text"] or ""
    if query in label:
        return 3.0
    if query in text:
        return 2.0
    return 1.0
