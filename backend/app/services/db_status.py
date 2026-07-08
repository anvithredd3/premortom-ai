"""Read-only database status helpers for the demo UI."""
from __future__ import annotations

import os
from typing import Any

import psycopg2


TABLES = [
    "agent_memory_chunks",
    "decision_history",
    "decision_history_chunks",
    "agent_history",
    "agent_history_chunks",
]


def get_database_status() -> dict[str, Any]:
    """Return table availability, row counts, and recent memory rows.

    This endpoint is intentionally read-only. If the database is not configured
    or is unavailable, return a structured status instead of failing the demo.
    """
    database_url = os.getenv("DATABASE_URL", "")
    status: dict[str, Any] = {
        "database_configured": bool(database_url),
        "database_connected": False,
        "pgvector_available": False,
        "tables": {
            name: {"exists": False, "row_count": 0}
            for name in TABLES
        },
        "recent_memory_rows": [],
        "recent_decision_rows": [],
        "agent_history_counts": [],
        "error": "",
    }
    if not database_url:
        status["error"] = "DATABASE_URL is not configured."
        return status

    try:
        with psycopg2.connect(database_url) as conn:
            with conn.cursor() as cur:
                status["database_connected"] = True
                status["pgvector_available"] = _extension_exists(cur, "vector")
                for table in TABLES:
                    exists = _table_exists(cur, table)
                    status["tables"][table]["exists"] = exists
                    if exists:
                        status["tables"][table]["row_count"] = _table_count(cur, table)

                if status["tables"]["agent_memory_chunks"]["exists"]:
                    status["recent_memory_rows"] = _recent_memory_rows(cur)
                if status["tables"]["decision_history"]["exists"]:
                    status["recent_decision_rows"] = _recent_decision_rows(cur)
                if status["tables"]["agent_history_chunks"]["exists"]:
                    status["agent_history_counts"] = _agent_history_counts(cur)
    except Exception as exc:
        status["error"] = str(exc)
    return status


def _extension_exists(cur, extension_name: str) -> bool:
    cur.execute(
        "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = %s)",
        (extension_name,),
    )
    return bool(cur.fetchone()[0])


def _table_exists(cur, table_name: str) -> bool:
    cur.execute("SELECT to_regclass(%s)", (f"public.{table_name}",))
    return cur.fetchone()[0] is not None


def _table_count(cur, table_name: str) -> int:
    cur.execute(f"SELECT count(*) FROM {table_name}")
    return int(cur.fetchone()[0])


def _recent_memory_rows(cur) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT agent_id, source_path, memory_type, updated_at
        FROM agent_memory_chunks
        ORDER BY updated_at DESC
        LIMIT 20
        """
    )
    return [
        {
            "agent_id": agent_id,
            "source_path": source_path,
            "memory_type": memory_type,
            "updated_at": updated_at.isoformat() if updated_at else "",
        }
        for agent_id, source_path, memory_type, updated_at in cur.fetchall()
    ]


def _recent_decision_rows(cur) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT run_id, procurement_title, risk_level, risk_score, created_at
        FROM decision_history
        ORDER BY created_at DESC
        LIMIT 20
        """
    )
    return [
        {
            "run_id": run_id,
            "procurement_title": procurement_title,
            "risk_level": risk_level,
            "risk_score": float(risk_score) if risk_score is not None else None,
            "created_at": created_at.isoformat() if created_at else "",
        }
        for run_id, procurement_title, risk_level, risk_score, created_at in cur.fetchall()
    ]


def _agent_history_counts(cur) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT agent_id, count(*) AS chunks
        FROM agent_history_chunks
        GROUP BY agent_id
        ORDER BY agent_id
        """
    )
    return [
        {
            "agent_id": agent_id,
            "chunks": int(chunks),
        }
        for agent_id, chunks in cur.fetchall()
    ]
