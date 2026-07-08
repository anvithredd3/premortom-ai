"""pgvector-backed decision history storage.

Decision history is kept separate from OKF agent memory. The full run snapshot
is stored for audit/replay, while compact text chunks are stored for later
similar-case retrieval.
"""
from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2.extras import Json

from .okf_pgvector import VECTOR_DIMS, embed_text


EMBEDDING_METHOD = "local_hashing_vector_v1"
DEFAULT_GLOBAL_LIMIT = 10
DEFAULT_VENDOR_LIMIT = 5
DEFAULT_CATEGORY_LIMIT = 5
DEFAULT_SIMILAR_LIMIT = 5
DEFAULT_ITEM_CHAR_LIMIT = 500
DEFAULT_TOTAL_CHAR_LIMIT = 6000


def store_ui_guidance_agent_history(
    *,
    result: dict[str, Any],
    bid_id: str = "",
    quote_id: str = "",
    run_id: str | None = None,
    source_name: str = "",
) -> str:
    """Store direct UI Guidance Agent helper output as agent-level history.

    This does not create a bid-run artifact directory. It writes only
    `agent_history` and `agent_history_chunks` rows scoped to `ui_guidance_agent`.
    """
    stored_run_id = run_id or f"UI-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}"
    stored_quote_id = quote_id or str(result.get("source_name") or source_name or "")
    history = _ui_guidance_history(
        run_id=stored_run_id,
        bid_id=bid_id,
        quote_id=stored_quote_id,
        result=result,
        source_name=source_name,
    )

    with _connect() as conn:
        with conn.cursor() as cur:
            _ensure_schema(cur)
            cur.execute(
                """
                INSERT INTO agent_history (
                  id,
                  run_id,
                  bid_id,
                  quote_id,
                  agent_id,
                  artifact_id,
                  history_type,
                  input_summary,
                  output_summary,
                  retrieved_context
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                  input_summary = EXCLUDED.input_summary,
                  output_summary = EXCLUDED.output_summary,
                  retrieved_context = EXCLUDED.retrieved_context,
                  created_at = now()
                """,
                (
                    history["id"],
                    history["run_id"],
                    history["bid_id"],
                    history["quote_id"],
                    history["agent_id"],
                    history["artifact_id"],
                    history["history_type"],
                    Json(history["input_summary"]),
                    Json(history["output_summary"]),
                    Json(history["retrieved_context"]),
                ),
            )
            for chunk in history["chunks"]:
                cur.execute(
                    """
                    INSERT INTO agent_history_chunks (
                      id,
                      agent_history_id,
                      run_id,
                      bid_id,
                      quote_id,
                      agent_id,
                      artifact_id,
                      chunk_type,
                      content,
                      metadata,
                      embedding,
                      embedding_method
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector, %s)
                    ON CONFLICT (id) DO UPDATE SET
                      content = EXCLUDED.content,
                      metadata = EXCLUDED.metadata,
                      embedding = EXCLUDED.embedding,
                      embedding_method = EXCLUDED.embedding_method,
                      created_at = now()
                    """,
                    (
                        chunk["id"],
                        history["id"],
                        history["run_id"],
                        history["bid_id"],
                        history["quote_id"],
                        history["agent_id"],
                        history["artifact_id"],
                        chunk["chunk_type"],
                        chunk["content"],
                        Json(chunk["metadata"]),
                        _vector_literal(embed_text(chunk["content"])),
                        EMBEDDING_METHOD,
                    ),
                )
        conn.commit()
    return stored_run_id


def store_bid_run_history(
    *,
    run_id: str,
    state: dict[str, Any],
    result: dict[str, Any],
    run_dir: Path,
) -> bool:
    """Store a completed bid run in decision history.

    Returns True when stored. If ``DATABASE_URL`` is missing or the database is
    unavailable, the caller should catch the exception and continue.
    """
    snapshot = _build_snapshot(run_id, state, result, run_dir)
    decision_id = run_id
    winner = result.get("winner") or {}
    procurement_title = _procurement_title(state, result, snapshot)
    risk_score = winner.get("risk_score")
    risk_level = winner.get("risk_level", "")
    recommendation = winner.get("recommendation") or result.get("rationale", "")
    findings = winner.get("findings") or []
    winning_vendor = _winning_vendor(winner, snapshot)

    chunks = _build_chunks(
        decision_id=decision_id,
        run_id=run_id,
        bid_id=str(result.get("bid_id") or state.get("bid_id") or ""),
        procurement_title=procurement_title,
        result=result,
        snapshot=snapshot,
    )
    agent_histories = _build_agent_histories(
        run_id=run_id,
        bid_id=str(result.get("bid_id") or state.get("bid_id") or ""),
        procurement_title=procurement_title,
        result=result,
        snapshot=snapshot,
    )

    with _connect() as conn:
        with conn.cursor() as cur:
            _ensure_schema(cur)
            cur.execute(
                """
                INSERT INTO decision_history (
                  id,
                  run_id,
                  bid_id,
                  procurement_title,
                  winning_quote_id,
                  winning_vendor,
                  risk_score,
                  risk_level,
                  recommendation,
                  findings,
                  snapshot,
                  embedding_method
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                  bid_id = EXCLUDED.bid_id,
                  procurement_title = EXCLUDED.procurement_title,
                  winning_quote_id = EXCLUDED.winning_quote_id,
                  winning_vendor = EXCLUDED.winning_vendor,
                  risk_score = EXCLUDED.risk_score,
                  risk_level = EXCLUDED.risk_level,
                  recommendation = EXCLUDED.recommendation,
                  findings = EXCLUDED.findings,
                  snapshot = EXCLUDED.snapshot,
                  embedding_method = EXCLUDED.embedding_method,
                  updated_at = now()
                """,
                (
                    decision_id,
                    run_id,
                    str(result.get("bid_id") or state.get("bid_id") or ""),
                    procurement_title,
                    str(winner.get("quote_id") or ""),
                    winning_vendor,
                    risk_score,
                    str(risk_level),
                    str(recommendation),
                    Json(findings),
                    Json(snapshot),
                    EMBEDDING_METHOD,
                ),
            )
            cur.execute(
                "DELETE FROM decision_history_chunks WHERE decision_id = %s",
                (decision_id,),
            )
            for chunk in chunks:
                cur.execute(
                    """
                    INSERT INTO decision_history_chunks (
                      id,
                      decision_id,
                      run_id,
                      bid_id,
                      chunk_type,
                      content,
                      metadata,
                      embedding,
                      embedding_method
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::vector, %s)
                    """,
                    (
                        chunk["id"],
                        decision_id,
                        run_id,
                        str(result.get("bid_id") or state.get("bid_id") or ""),
                        chunk["chunk_type"],
                        chunk["content"],
                        Json(chunk["metadata"]),
                        _vector_literal(embed_text(chunk["content"])),
                        EMBEDDING_METHOD,
                    ),
                )
            cur.execute(
                "DELETE FROM agent_history WHERE run_id = %s",
                (run_id,),
            )
            for history in agent_histories:
                cur.execute(
                    """
                    INSERT INTO agent_history (
                      id,
                      run_id,
                      bid_id,
                      quote_id,
                      agent_id,
                      artifact_id,
                      history_type,
                      input_summary,
                      output_summary,
                      retrieved_context
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                      bid_id = EXCLUDED.bid_id,
                      quote_id = EXCLUDED.quote_id,
                      agent_id = EXCLUDED.agent_id,
                      artifact_id = EXCLUDED.artifact_id,
                      history_type = EXCLUDED.history_type,
                      input_summary = EXCLUDED.input_summary,
                      output_summary = EXCLUDED.output_summary,
                      retrieved_context = EXCLUDED.retrieved_context,
                      created_at = now()
                    """,
                    (
                        history["id"],
                        run_id,
                        history["bid_id"],
                        history["quote_id"],
                        history["agent_id"],
                        history["artifact_id"],
                        history["history_type"],
                        Json(history["input_summary"]),
                        Json(history["output_summary"]),
                        Json(history["retrieved_context"]),
                    ),
                )
                for chunk in history["chunks"]:
                    cur.execute(
                        """
                        INSERT INTO agent_history_chunks (
                          id,
                          agent_history_id,
                          run_id,
                          bid_id,
                          quote_id,
                          agent_id,
                          artifact_id,
                          chunk_type,
                          content,
                          metadata,
                          embedding,
                          embedding_method
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector, %s)
                        ON CONFLICT (id) DO UPDATE SET
                          content = EXCLUDED.content,
                          metadata = EXCLUDED.metadata,
                          embedding = EXCLUDED.embedding,
                          embedding_method = EXCLUDED.embedding_method,
                          created_at = now()
                        """,
                        (
                            chunk["id"],
                            history["id"],
                            run_id,
                            history["bid_id"],
                            history["quote_id"],
                            history["agent_id"],
                            history["artifact_id"],
                            chunk["chunk_type"],
                            chunk["content"],
                            Json(chunk["metadata"]),
                            _vector_literal(embed_text(chunk["content"])),
                            EMBEDDING_METHOD,
                        ),
                    )
        conn.commit()
    return True


def select_decision_history_memory(
    *,
    procurement_title: str,
    equipment_type: str,
    query_text: str,
    vendor_name: str = "",
    global_limit: int | None = None,
    vendor_limit: int | None = None,
    category_limit: int | None = None,
    similar_limit: int | None = None,
) -> str:
    """Return a compact decision-history block for agent prompting.

    The first retrieval policy is deliberately explainable:
    - last N global decisions
    - last N decisions for the same vendor, when vendor is known
    - last N decisions for the same procurement/equipment category
    - top N vector-similar decision-history chunks for the current quote

    Rows are deduplicated by run_id inside each section formatter.
    """
    if os.getenv("DECISION_HISTORY_MEMORY_ENABLED", "1") in {"0", "false", "False"}:
        return ""

    global_limit = _env_int("DECISION_HISTORY_GLOBAL_LIMIT", global_limit or DEFAULT_GLOBAL_LIMIT)
    vendor_limit = _env_int("DECISION_HISTORY_VENDOR_LIMIT", vendor_limit or DEFAULT_VENDOR_LIMIT)
    category_limit = _env_int(
        "DECISION_HISTORY_CATEGORY_LIMIT",
        category_limit or DEFAULT_CATEGORY_LIMIT,
    )
    similar_limit = _env_int(
        "DECISION_HISTORY_SIMILAR_LIMIT",
        similar_limit or DEFAULT_SIMILAR_LIMIT,
    )
    item_char_limit = _env_int(
        "DECISION_HISTORY_ITEM_CHAR_LIMIT",
        DEFAULT_ITEM_CHAR_LIMIT,
    )
    total_char_limit = _env_int(
        "DECISION_HISTORY_TOTAL_CHAR_LIMIT",
        DEFAULT_TOTAL_CHAR_LIMIT,
    )
    category = equipment_type or procurement_title

    try:
        with _connect() as conn:
            with conn.cursor() as cur:
                if not _table_exists(cur, "decision_history"):
                    return ""
                global_rows = _recent_decisions(cur, global_limit)
                vendor_rows = (
                    _recent_vendor_decisions(cur, vendor_name, vendor_limit)
                    if vendor_name
                    else []
                )
                category_rows = (
                    _recent_category_decisions(cur, category, category_limit)
                    if category
                    else []
                )
                similar_rows = (
                    _similar_history_chunks(cur, query_text, similar_limit)
                    if query_text
                    else []
                )
    except Exception as exc:
        print(f"Skipping decision history memory: {exc}")
        return ""

    sections = [
        _format_similar_chunk_section(
            "Vector-similar risk patterns",
            similar_rows,
            item_char_limit,
        ),
        _format_history_section("Same vendor decisions", vendor_rows, item_char_limit),
        _format_history_section(
            "Same equipment/category decisions",
            category_rows,
            item_char_limit,
        ),
        _format_history_section("Recent global decisions", global_rows, item_char_limit),
    ]
    content = "\n\n".join(section for section in sections if section)
    if not content:
        return ""
    content = _clip(content, total_char_limit)
    return (
        "Use this prior decision history only as context for consistency and "
        "pattern spotting. Do not copy prior risk scores and do not treat prior "
        "cases as proof of risk in the current quote.\n\n"
        f"{content}"
    )


def _connect():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg2.connect(database_url)


def _ensure_schema(cur) -> None:
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS decision_history (
          id text PRIMARY KEY,
          run_id text NOT NULL UNIQUE,
          bid_id text NOT NULL DEFAULT '',
          procurement_title text NOT NULL DEFAULT '',
          winning_quote_id text NOT NULL DEFAULT '',
          winning_vendor text NOT NULL DEFAULT '',
          risk_score numeric,
          risk_level text NOT NULL DEFAULT '',
          recommendation text NOT NULL DEFAULT '',
          findings jsonb NOT NULL DEFAULT '[]'::jsonb,
          snapshot jsonb NOT NULL,
          embedding_method text NOT NULL DEFAULT '',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    cur.execute(
        f"""
        CREATE TABLE IF NOT EXISTS decision_history_chunks (
          id text PRIMARY KEY,
          decision_id text NOT NULL REFERENCES decision_history(id) ON DELETE CASCADE,
          run_id text NOT NULL,
          bid_id text NOT NULL DEFAULT '',
          chunk_type text NOT NULL,
          content text NOT NULL,
          metadata jsonb NOT NULL DEFAULT '{{}}'::jsonb,
          embedding vector({VECTOR_DIMS}) NOT NULL,
          embedding_method text NOT NULL DEFAULT '',
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_decision_history_run
        ON decision_history(run_id)
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_decision_history_chunks_decision
        ON decision_history_chunks(decision_id)
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_decision_history_vendor
        ON decision_history(winning_vendor)
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_decision_history_category
        ON decision_history(procurement_title)
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS agent_history (
          id text PRIMARY KEY,
          run_id text NOT NULL,
          bid_id text NOT NULL DEFAULT '',
          quote_id text NOT NULL DEFAULT '',
          agent_id text NOT NULL,
          artifact_id text NOT NULL DEFAULT '',
          history_type text NOT NULL,
          input_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
          output_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
          retrieved_context jsonb NOT NULL DEFAULT '[]'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    cur.execute(
        f"""
        CREATE TABLE IF NOT EXISTS agent_history_chunks (
          id text PRIMARY KEY,
          agent_history_id text NOT NULL REFERENCES agent_history(id) ON DELETE CASCADE,
          run_id text NOT NULL,
          bid_id text NOT NULL DEFAULT '',
          quote_id text NOT NULL DEFAULT '',
          agent_id text NOT NULL,
          artifact_id text NOT NULL DEFAULT '',
          chunk_type text NOT NULL,
          content text NOT NULL,
          metadata jsonb NOT NULL DEFAULT '{{}}'::jsonb,
          embedding vector({VECTOR_DIMS}) NOT NULL,
          embedding_method text NOT NULL DEFAULT '',
          created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_agent_history_agent
        ON agent_history(agent_id)
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_agent_history_run
        ON agent_history(run_id)
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_agent_history_chunks_agent
        ON agent_history_chunks(agent_id)
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_agent_history_chunks_run
        ON agent_history_chunks(run_id)
        """
    )


def _table_exists(cur, table_name: str) -> bool:
    cur.execute("SELECT to_regclass(%s)", (f"public.{table_name}",))
    return cur.fetchone()[0] is not None


def _recent_decisions(cur, limit: int) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT run_id, bid_id, procurement_title, winning_quote_id, winning_vendor,
               risk_score, risk_level, recommendation, findings, created_at
        FROM decision_history
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (limit,),
    )
    return _history_rows(cur.fetchall())


def _recent_vendor_decisions(
    cur,
    vendor_name: str,
    limit: int,
) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT run_id, bid_id, procurement_title, winning_quote_id, winning_vendor,
               risk_score, risk_level, recommendation, findings, created_at
        FROM decision_history
        WHERE lower(winning_vendor) = lower(%s)
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (vendor_name, limit),
    )
    return _history_rows(cur.fetchall())


def _recent_category_decisions(
    cur,
    category: str,
    limit: int,
) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT run_id, bid_id, procurement_title, winning_quote_id, winning_vendor,
               risk_score, risk_level, recommendation, findings, created_at
        FROM decision_history
        WHERE lower(procurement_title) = lower(%s)
           OR lower(procurement_title) LIKE lower(%s)
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (category, f"%{category}%", limit),
    )
    return _history_rows(cur.fetchall())


def _similar_history_chunks(
    cur,
    query_text: str,
    limit: int,
) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT decision_id, run_id, bid_id, chunk_type, content, metadata,
               embedding <-> %s::vector AS distance
        FROM decision_history_chunks
        ORDER BY embedding <-> %s::vector
        LIMIT %s
        """,
        (
            _vector_literal(embed_text(query_text)),
            _vector_literal(embed_text(query_text)),
            limit,
        ),
    )
    rows = []
    for decision_id, run_id, bid_id, chunk_type, content, metadata, distance in cur.fetchall():
        rows.append(
            {
                "decision_id": decision_id,
                "run_id": run_id,
                "bid_id": bid_id,
                "chunk_type": chunk_type,
                "content": content,
                "metadata": metadata or {},
                "distance": float(distance),
            }
        )
    return rows


def _history_rows(rows: list[tuple[Any, ...]]) -> list[dict[str, Any]]:
    history = []
    for row in rows:
        (
            run_id,
            bid_id,
            procurement_title,
            winning_quote_id,
            winning_vendor,
            risk_score,
            risk_level,
            recommendation,
            findings,
            created_at,
        ) = row
        history.append(
            {
                "run_id": run_id,
                "bid_id": bid_id,
                "procurement_title": procurement_title,
                "winning_quote_id": winning_quote_id,
                "winning_vendor": winning_vendor,
                "risk_score": float(risk_score) if risk_score is not None else None,
                "risk_level": risk_level,
                "recommendation": recommendation,
                "findings": findings or [],
                "created_at": created_at.isoformat() if created_at else "",
            }
        )
    return history


def _format_history_section(
    label: str,
    rows: list[dict[str, Any]],
    item_char_limit: int,
) -> str:
    if not rows:
        return ""
    seen = set()
    lines = [f"## {label}"]
    for row in rows:
        run_id = row["run_id"]
        if run_id in seen:
            continue
        seen.add(run_id)
        findings = row.get("findings") or []
        findings_text = _clip("; ".join(str(item) for item in findings[:2]), 240)
        line = (
            "- "
            f"{run_id}: bid={row.get('bid_id', '')}, "
            f"category={row.get('procurement_title', '')}, "
            f"quote={row.get('winning_quote_id', '')}, "
            f"vendor={row.get('winning_vendor', '') or 'unknown'}, "
            f"risk={row.get('risk_level', '')} {row.get('risk_score', '')}. "
            f"Key findings: {findings_text}. "
            f"Recommendation: {_clip(str(row.get('recommendation', '')), 220)}"
        )
        lines.append(_clip(line, item_char_limit))
    return "\n".join(lines)


def _format_similar_chunk_section(
    label: str,
    rows: list[dict[str, Any]],
    item_char_limit: int,
) -> str:
    if not rows:
        return ""
    lines = [f"## {label}"]
    for row in rows:
        metadata = row.get("metadata") or {}
        line = (
            "- "
            f"{row.get('run_id', '')}: "
            f"chunk={row.get('chunk_type', '')}, "
            f"bid={row.get('bid_id', '')}, "
            f"category={metadata.get('procurement_title', '')}, "
            f"distance={row.get('distance', 0):.4f}. "
            f"{_clip(str(row.get('content', '')), 360)}"
        )
        lines.append(_clip(line, item_char_limit))
    return "\n".join(lines)


def _clip(text: str, limit: int) -> str:
    if limit <= 0 or len(text) <= limit:
        return text
    return text[: max(0, limit - 3)].rstrip() + "..."


def _build_snapshot(
    run_id: str,
    state: dict[str, Any],
    result: dict[str, Any],
    run_dir: Path,
) -> dict[str, Any]:
    artifacts = {
        "run_state": state,
        "decision_result": result,
    }
    for key, filename in {
        "vendor_proposals": "vendor_proposal_agent_quote_intelligence.json",
        "contract_reviews": "contract_review_agent_quote_reviews.json",
        "market_research": "internet_market_research_agent_benchmarks.json",
    }.items():
        path = run_dir / filename
        if path.exists():
            artifacts[key] = _read_json(path)

    return {
        "run_id": run_id,
        "bid_id": result.get("bid_id") or state.get("bid_id") or "",
        "status": result.get("status") or state.get("status") or "",
        "artifacts": artifacts,
    }


def _agent_history(
    *,
    run_id: str,
    bid_id: str,
    quote_id: str,
    agent_id: str,
    artifact_id: str,
    history_type: str,
    input_summary: dict[str, Any],
    output_summary: dict[str, Any],
    chunks: list[dict[str, Any]],
    retrieved_context: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    quote_part = quote_id or "bid"
    return {
        "id": f"{run_id}:{agent_id}:{quote_part}:{history_type}",
        "run_id": run_id,
        "bid_id": bid_id,
        "quote_id": quote_id,
        "agent_id": agent_id,
        "artifact_id": artifact_id,
        "history_type": history_type,
        "input_summary": input_summary,
        "output_summary": output_summary,
        "retrieved_context": retrieved_context or [],
        "chunks": chunks,
    }


def _agent_chunks(
    *,
    run_id: str,
    bid_id: str,
    quote_id: str,
    agent_id: str,
    artifact_id: str,
    chunk_specs: list[tuple[str, str]],
    metadata: dict[str, Any],
) -> list[dict[str, Any]]:
    chunks = []
    quote_part = quote_id or "bid"
    for chunk_type, content in chunk_specs:
        content = str(content or "").strip()
        if not content:
            continue
        chunks.append(
            {
                "id": f"{run_id}:{agent_id}:{quote_part}:{chunk_type}",
                "chunk_type": chunk_type,
                "content": content[:8000],
                "metadata": {
                    "run_id": run_id,
                    "bid_id": bid_id,
                    "quote_id": quote_id,
                    "agent_id": agent_id,
                    "artifact_id": artifact_id,
                    **metadata,
                },
            }
        )
    return chunks


def _build_chunks(
    *,
    decision_id: str,
    run_id: str,
    bid_id: str,
    procurement_title: str,
    result: dict[str, Any],
    snapshot: dict[str, Any],
) -> list[dict[str, Any]]:
    winner = result.get("winner") or {}
    findings = winner.get("findings") or []
    chunks = [
        (
            "procurement_summary",
            (
                f"Run {run_id} reviewed bid {bid_id}. "
                f"Procurement: {procurement_title}. "
                f"Status: {result.get('status', '')}."
            ),
        ),
        (
            "winning_decision_summary",
            (
                f"Selected quote: {winner.get('quote_id', '')}. "
                f"Vendor: {winner.get('vendor_name', '')}. "
                f"Risk score: {winner.get('risk_score', '')}. "
                f"Risk level: {winner.get('risk_level', '')}. "
                f"Recommendation: {winner.get('recommendation') or result.get('rationale', '')}"
            ),
        ),
        (
            "risk_findings_summary",
            "Risk findings: " + " ".join(str(item) for item in findings),
        ),
        (
            "decision_rationale",
            (
                f"Rationale: {result.get('rationale', '')} "
                f"Feedback: {' '.join(str(item) for item in result.get('feedback') or [])} "
                "Negotiation points: "
                + " ".join(str(item) for item in result.get("negotiation_points") or [])
            ),
        ),
    ]

    return [
        {
            "id": f"{decision_id}:{chunk_type}",
            "chunk_type": chunk_type,
            "content": content[:8000],
            "metadata": {
                "run_id": run_id,
                "bid_id": bid_id,
                "procurement_title": procurement_title,
                "artifact_refs": result.get("artifact_refs") or [],
                "snapshot_keys": list(snapshot.get("artifacts", {}).keys()),
            },
        }
        for chunk_type, content in chunks
        if content.strip()
    ]


def _build_agent_histories(
    *,
    run_id: str,
    bid_id: str,
    procurement_title: str,
    result: dict[str, Any],
    snapshot: dict[str, Any],
) -> list[dict[str, Any]]:
    artifacts = _safe_dict(snapshot.get("artifacts"))
    histories: list[dict[str, Any]] = []
    histories.extend(
        _vendor_proposal_histories(
            run_id=run_id,
            bid_id=bid_id,
            procurement_title=procurement_title,
            artifact=_safe_dict(artifacts.get("vendor_proposals")),
        )
    )
    histories.extend(
        _contract_agent_histories(
            run_id=run_id,
            bid_id=bid_id,
            procurement_title=procurement_title,
            artifact=_safe_dict(artifacts.get("contract_reviews")),
        )
    )
    market_history = _market_research_history(
        run_id=run_id,
        bid_id=bid_id,
        procurement_title=procurement_title,
        artifact=_safe_dict(artifacts.get("market_research")),
    )
    if market_history:
        histories.append(market_history)
    histories.append(
        _bid_recommender_history(
            run_id=run_id,
            bid_id=bid_id,
            procurement_title=procurement_title,
            result=result,
        )
    )
    return histories


def _vendor_proposal_histories(
    *,
    run_id: str,
    bid_id: str,
    procurement_title: str,
    artifact: dict[str, Any],
) -> list[dict[str, Any]]:
    histories = []
    for quote in artifact.get("quotes") or []:
        if not isinstance(quote, dict):
            continue
        quote_id = str(quote.get("quote_id") or "")
        fixed = _safe_dict(quote.get("fixed_features"))
        intelligence = _safe_dict(quote.get("proposal_intelligence"))
        output_summary = {
            "vendor_name": _feature_value(fixed, "vendor_name"),
            "equipment_type": _feature_value(fixed, "equipment_type"),
            "quoted_price_cr": _feature_value(fixed, "quoted_price_cr"),
            "advance_payment_pct": _feature_value(fixed, "advance_payment_pct"),
            "proposal_quality": intelligence.get("proposal_quality", {}),
        }
        chunks = _agent_chunks(
            run_id=run_id,
            bid_id=bid_id,
            quote_id=quote_id,
            agent_id="vendor_proposal_agent",
            artifact_id="artifact_vendor_proposal",
            chunk_specs=[
                (
                    "vendor_fixed_features",
                    _join_parts(
                        "Vendor proposal fixed features.",
                        f"Vendor: {output_summary['vendor_name']}",
                        f"Equipment: {output_summary['equipment_type'] or procurement_title}",
                        f"Price: {output_summary['quoted_price_cr']}",
                        f"Advance payment: {output_summary['advance_payment_pct']}",
                        f"Warranty start: {_feature_value(fixed, 'warranty_start_trigger')}",
                        f"Installation responsibility: {_feature_value(fixed, 'installation_responsibility')}",
                        f"Training included: {_feature_value(fixed, 'training_included')}",
                    ),
                ),
                (
                    "vendor_proposal_omissions",
                    "Vendor proposal omissions and ambiguities: "
                    + _stringify_list(intelligence.get("omissions_or_ambiguities")),
                ),
                (
                    "vendor_differentiators",
                    "Vendor differentiators and unusual terms: "
                    + _stringify_list(intelligence.get("differentiators"))
                    + " "
                    + _stringify_list(intelligence.get("unusual_terms")),
                ),
                (
                    "vendor_follow_up_questions",
                    "Vendor follow-up questions: "
                    + _stringify_list(intelligence.get("follow_up_questions")),
                ),
            ],
            metadata={
                "procurement_title": procurement_title,
                "vendor_name": output_summary["vendor_name"],
                "equipment_type": output_summary["equipment_type"],
                "source": "vendor_proposal_agent_quote_intelligence.json",
            },
        )
        histories.append(
            _agent_history(
                run_id=run_id,
                bid_id=bid_id,
                quote_id=quote_id,
                agent_id="vendor_proposal_agent",
                artifact_id="artifact_vendor_proposal",
                history_type="proposal_intelligence",
                input_summary={
                    "pdf_path": _safe_dict(quote.get("raw_text_reference")).get("pdf_path", ""),
                    "text_char_count": _safe_dict(quote.get("proposal_text")).get("char_count", 0),
                },
                output_summary=output_summary,
                chunks=chunks,
            )
        )
    return histories


def _contract_agent_histories(
    *,
    run_id: str,
    bid_id: str,
    procurement_title: str,
    artifact: dict[str, Any],
) -> list[dict[str, Any]]:
    histories = []
    for review in artifact.get("quote_reviews") or []:
        if not isinstance(review, dict):
            continue
        quote_id = str(review.get("quote_id") or "")
        findings = review.get("findings") or []
        output_summary = {
            "vendor_name": review.get("vendor_name", ""),
            "risk_score": review.get("risk_score"),
            "risk_level": review.get("risk_level", ""),
            "recommendation": review.get("recommendation", ""),
            "finding_count": len(findings),
        }
        chunks = _agent_chunks(
            run_id=run_id,
            bid_id=bid_id,
            quote_id=quote_id,
            agent_id="contract_agent",
            artifact_id="artifact_contract_review",
            chunk_specs=[
                (
                    "contract_risk_findings",
                    "Contract risk findings: "
                    + " ".join(str(item) for item in findings),
                ),
                (
                    "contract_recommendation",
                    "Contract recommendation: " + str(review.get("recommendation") or ""),
                ),
            ],
            metadata={
                "procurement_title": procurement_title,
                "vendor_name": review.get("vendor_name", ""),
                "risk_level": review.get("risk_level", ""),
                "source": "contract_review_agent_quote_reviews.json",
            },
        )
        histories.append(
            _agent_history(
                run_id=run_id,
                bid_id=bid_id,
                quote_id=quote_id,
                agent_id="contract_agent",
                artifact_id="artifact_contract_review",
                history_type="contract_review",
                input_summary={"quote_id": quote_id},
                output_summary=output_summary,
                chunks=chunks,
            )
        )
    return histories


def _market_research_history(
    *,
    run_id: str,
    bid_id: str,
    procurement_title: str,
    artifact: dict[str, Any],
) -> dict[str, Any] | None:
    market = _safe_dict(artifact.get("market_research"))
    if not market:
        return None
    output_summary = {
        "provider": market.get("provider", ""),
        "status": market.get("status", ""),
        "equipment_type": market.get("equipment_type", procurement_title),
        "retrieved_at": market.get("retrieved_at", ""),
    }
    chunks = _agent_chunks(
        run_id=run_id,
        bid_id=bid_id,
        quote_id="",
        agent_id="internet_market_research_agent",
        artifact_id="artifact_market_research",
        chunk_specs=[
            (
                "market_price_range",
                "Market price range: "
                + json.dumps(market.get("market_price_range", {}), sort_keys=True),
            ),
            (
                "market_typical_terms",
                "Typical market terms: "
                + json.dumps(market.get("typical_terms", {}), sort_keys=True),
            ),
            (
                "market_lifecycle_costs",
                "Consumables and lifecycle costs: "
                + json.dumps(market.get("consumables_and_lifecycle_costs", {}), sort_keys=True),
            ),
            (
                "market_red_flags",
                "Market red flags and limitations: "
                + _stringify_list(market.get("red_flags"))
                + " "
                + _stringify_list(market.get("limitations")),
            ),
        ],
        metadata={
            "procurement_title": procurement_title,
            "equipment_type": output_summary["equipment_type"],
            "provider": output_summary["provider"],
            "source": "internet_market_research_agent_benchmarks.json",
        },
    )
    return _agent_history(
        run_id=run_id,
        bid_id=bid_id,
        quote_id="",
        agent_id="internet_market_research_agent",
        artifact_id="artifact_market_research",
        history_type="market_research",
        input_summary={"procurement_title": procurement_title},
        output_summary=output_summary,
        chunks=chunks,
    )


def _bid_recommender_history(
    *,
    run_id: str,
    bid_id: str,
    procurement_title: str,
    result: dict[str, Any],
) -> dict[str, Any]:
    winner = _safe_dict(result.get("winner"))
    output_summary = {
        "winner_quote_id": winner.get("quote_id", ""),
        "winner_vendor": winner.get("vendor_name", ""),
        "risk_score": winner.get("risk_score"),
        "risk_level": winner.get("risk_level", ""),
        "rationale": result.get("rationale", ""),
        "shortlist_size": len(result.get("shortlist") or []),
    }
    chunks = _agent_chunks(
        run_id=run_id,
        bid_id=bid_id,
        quote_id=str(winner.get("quote_id") or ""),
        agent_id="bid_recommender_agent",
        artifact_id="artifact_bid_recommendation",
        chunk_specs=[
            (
                "recommender_ranking_rationale",
                "Bid recommender rationale: " + str(result.get("rationale") or ""),
            ),
            (
                "recommender_feedback",
                "Bid recommender feedback: " + _stringify_list(result.get("feedback")),
            ),
            (
                "recommender_negotiation_points",
                "Bid recommender negotiation points: "
                + _stringify_list(result.get("negotiation_points")),
            ),
            (
                "recommender_ranked_quotes",
                "Ranked quotes: " + json.dumps(result.get("ranked_quotes") or [], sort_keys=True),
            ),
        ],
        metadata={
            "procurement_title": procurement_title,
            "winner_quote_id": output_summary["winner_quote_id"],
            "winner_vendor": output_summary["winner_vendor"],
            "source": "bid_recommender_agent_decision_result.json",
        },
    )
    return _agent_history(
        run_id=run_id,
        bid_id=bid_id,
        quote_id=str(winner.get("quote_id") or ""),
        agent_id="bid_recommender_agent",
        artifact_id="artifact_bid_recommendation",
        history_type="bid_recommendation",
        input_summary={
            "ranked_quote_count": len(result.get("ranked_quotes") or []),
            "artifact_refs": result.get("artifact_refs") or [],
        },
        output_summary=output_summary,
        chunks=chunks,
    )


def _ui_guidance_history(
    *,
    run_id: str,
    bid_id: str,
    quote_id: str,
    result: dict[str, Any],
    source_name: str,
) -> dict[str, Any]:
    rfq = _safe_dict(result.get("rfq_intake"))
    negotiation = _safe_dict(result.get("negotiation_guidance"))
    context = _safe_dict(result.get("vendor_proposal_context"))
    output_summary = {
        "source_name": result.get("source_name") or source_name,
        "mode": result.get("mode", ""),
        "requirement_summary": rfq.get("requirement_summary", ""),
        "negotiation_question_count": len(negotiation.get("negotiation_questions") or []),
        "missing_input_count": len(rfq.get("missing_inputs") or []),
        "vendor_name": context.get("vendor_name", ""),
    }
    chunks = _agent_chunks(
        run_id=run_id,
        bid_id=bid_id,
        quote_id=quote_id,
        agent_id="ui_guidance_agent",
        artifact_id="artifact_ui_guidance",
        chunk_specs=[
            (
                "ui_rfq_requirements",
                _join_parts(
                    "UI guidance RFQ requirements.",
                    rfq.get("requirement_summary", ""),
                    _stringify_list(rfq.get("suggested_requirements")),
                    _stringify_list(rfq.get("minimum_criteria")),
                ),
            ),
            (
                "ui_missing_inputs",
                "UI guidance missing inputs: " + _stringify_list(rfq.get("missing_inputs")),
            ),
            (
                "ui_negotiation_questions",
                "UI guidance negotiation questions: "
                + _stringify_list(negotiation.get("negotiation_questions")),
            ),
            (
                "ui_contract_conditions",
                "UI guidance contract conditions and lifecycle items: "
                + _stringify_list(negotiation.get("contract_conditions"))
                + " "
                + _stringify_list(negotiation.get("cost_or_lifecycle_items")),
            ),
            (
                "ui_vendor_message_draft",
                "UI guidance vendor message draft: "
                + str(negotiation.get("vendor_message_draft") or ""),
            ),
            (
                "ui_negotiation_signals",
                "UI guidance risk or negotiation signals: "
                + _stringify_list(result.get("risk_or_negotiation_signals")),
            ),
        ],
        metadata={
            "source_name": output_summary["source_name"],
            "mode": output_summary["mode"],
            "vendor_name": output_summary["vendor_name"],
            "source": "test_ui_guidance_agent.py",
        },
    )
    return _agent_history(
        run_id=run_id,
        bid_id=bid_id,
        quote_id=quote_id,
        agent_id="ui_guidance_agent",
        artifact_id="artifact_ui_guidance",
        history_type="rfq_and_negotiation_guidance",
        input_summary={
            "source_name": output_summary["source_name"],
            "mode": output_summary["mode"],
            "vendor_proposal_context": context,
        },
        output_summary=output_summary,
        chunks=chunks,
    )


def _procurement_title(
    state: dict[str, Any],
    result: dict[str, Any],
    snapshot: dict[str, Any],
) -> str:
    vendor_proposals = snapshot.get("artifacts", {}).get("vendor_proposals", {})
    quotes = vendor_proposals.get("quotes") if isinstance(vendor_proposals, dict) else []
    if quotes:
        fixed = quotes[0].get("fixed_features", {})
        equipment = fixed.get("equipment_type", {}).get("value", "")
        if equipment:
            return str(equipment)
        text = quotes[0].get("proposal_text", {}).get("raw_text", "")
        match = re.search(r"^Procurement:\s*(.+)$", str(text), flags=re.MULTILINE)
        if match:
            return match.group(1).strip()
    return str(result.get("bid_id") or state.get("bid_id") or "Procurement review")


def _winning_vendor(winner: dict[str, Any], snapshot: dict[str, Any]) -> str:
    vendor = str(winner.get("vendor_name") or "").strip()
    if vendor:
        return vendor

    vendor_proposals = snapshot.get("artifacts", {}).get("vendor_proposals", {})
    quotes = vendor_proposals.get("quotes") if isinstance(vendor_proposals, dict) else []
    if quotes:
        fixed = quotes[0].get("fixed_features", {})
        fixed_vendor = fixed.get("vendor_name", {}).get("value", "")
        if fixed_vendor:
            return str(fixed_vendor).strip()
        text = quotes[0].get("proposal_text", {}).get("raw_text", "")
        match = re.search(r"^Vendor:\s*(.+)$", str(text), flags=re.MULTILINE)
        if match:
            return match.group(1).strip()
    return ""


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _feature_value(fixed_features: dict[str, Any], key: str) -> Any:
    feature = fixed_features.get(key)
    if isinstance(feature, dict):
        return feature.get("value", "")
    return ""


def _stringify_list(value: Any) -> str:
    if not isinstance(value, list):
        return ""
    items = []
    for item in value:
        if isinstance(item, dict):
            text = " - ".join(str(v) for v in item.values() if v not in (None, ""))
        else:
            text = str(item)
        if text.strip():
            items.append(text.strip())
    return " ".join(items)


def _join_parts(*parts: Any) -> str:
    return " ".join(str(part).strip() for part in parts if str(part).strip())


def _env_int(name: str, default: int) -> int:
    try:
        return max(0, int(os.getenv(name, str(default))))
    except ValueError:
        return default


def _read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _vector_literal(values: list[float]) -> str:
    return json.dumps(values)
