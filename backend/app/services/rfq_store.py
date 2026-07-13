"""Postgres storage for published RFQ sessions and requirements."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any

import psycopg2
from psycopg2.extras import Json


def publish_rfq(payload: dict[str, Any]) -> dict[str, Any]:
    """Persist the current RFQ snapshot and its accepted requirements."""
    rfq_id = str(payload.get("rfq_id") or _new_rfq_id())
    requirements = list(payload.get("requirements") or [])
    now = datetime.now(timezone.utc)
    with _connect() as conn:
        with conn.cursor() as cur:
            _ensure_schema(cur)
            cur.execute(
                """
                INSERT INTO rfq_sessions (
                  id,
                  procurement_name,
                  equipment_type,
                  budget_cr,
                  status,
                  snapshot,
                  published_at,
                  updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                  procurement_name = EXCLUDED.procurement_name,
                  equipment_type = EXCLUDED.equipment_type,
                  budget_cr = EXCLUDED.budget_cr,
                  status = EXCLUDED.status,
                  snapshot = EXCLUDED.snapshot,
                  published_at = EXCLUDED.published_at,
                  updated_at = EXCLUDED.updated_at
                """,
                (
                    rfq_id,
                    str(payload.get("procurement_name") or ""),
                    str(payload.get("equipment_type") or ""),
                    float(payload.get("budget_cr") or 0),
                    "published",
                    Json(payload),
                    now,
                    now,
                ),
            )
            cur.execute("DELETE FROM rfq_requirements WHERE rfq_id = %s", (rfq_id,))
            for index, req in enumerate(requirements, start=1):
                requirement_id = str(req.get("id") or f"REQ-{index:03d}")
                cur.execute(
                    """
                    INSERT INTO rfq_requirements (
                      id,
                      rfq_id,
                      entered_by_role,
                      perspective_role,
                      requirement,
                      priority_rank,
                      perspective_value_pct,
                      estimated_cost_cr,
                      cost_confidence,
                      cost_source,
                      notes,
                      status,
                      raw_requirement
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        requirement_id,
                        rfq_id,
                        str(req.get("entered_by_role") or ""),
                        str(req.get("role") or req.get("perspective_role") or ""),
                        str(req.get("requirement") or ""),
                        int(req.get("priority_rank") or 0),
                        float(req.get("perspective_value_pct") or 0),
                        _optional_float(req.get("estimated_cost_cr")),
                        str(req.get("cost_confidence") or "unknown"),
                        str(req.get("cost_source") or "unknown"),
                        str(req.get("notes") or ""),
                        str(req.get("status") or "accepted"),
                        Json(req),
                    ),
                )
    return {
        "stored": True,
        "rfq_id": rfq_id,
        "requirements_stored": len(requirements),
        "status": "published",
    }


def _optional_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    return float(value)


def _new_rfq_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"RFQ-{stamp}-{uuid.uuid4().hex[:6]}"


def _connect():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg2.connect(database_url)


def _ensure_schema(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS rfq_sessions (
          id text PRIMARY KEY,
          procurement_name text NOT NULL DEFAULT '',
          equipment_type text NOT NULL DEFAULT '',
          budget_cr numeric NOT NULL DEFAULT 0,
          status text NOT NULL DEFAULT 'draft',
          snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
          published_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS rfq_requirements (
          id text NOT NULL,
          rfq_id text NOT NULL REFERENCES rfq_sessions(id) ON DELETE CASCADE,
          entered_by_role text NOT NULL DEFAULT '',
          perspective_role text NOT NULL DEFAULT '',
          requirement text NOT NULL DEFAULT '',
          priority_rank integer NOT NULL DEFAULT 0,
          perspective_value_pct numeric NOT NULL DEFAULT 0,
          estimated_cost_cr numeric,
          cost_confidence text NOT NULL DEFAULT 'unknown',
          cost_source text NOT NULL DEFAULT 'unknown',
          notes text NOT NULL DEFAULT '',
          status text NOT NULL DEFAULT 'accepted',
          raw_requirement jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (rfq_id, id)
        )
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_rfq_requirements_rfq
        ON rfq_requirements(rfq_id)
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_rfq_requirements_perspective
        ON rfq_requirements(perspective_role)
        """
    )
