"""pgvector storage for OKF memory chunks.

This is the first local vector-store path for agent memory. It intentionally
uses a tiny deterministic feature vector so the demo does not require a paid
embedding API or a new ML dependency. Later, replace ``embed_text`` with a
SentenceTransformers embedding provider and increase VECTOR_DIMS.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
from typing import Iterable

import psycopg2
from psycopg2.extras import Json

from .okf_memory import OkfMemoryChunk, load_okf_chunks


VECTOR_DIMS = 32
EMBEDDING_METHOD = "local_hashing_vector_v1"
CHUNK_STRATEGY = "one_okf_markdown_file_per_chunk"


def index_okf_chunks_pgvector(agent_id: str = "contract_agent") -> int:
    """Create/update pgvector rows for the agent's OKF memory chunks.

    Returns the number of indexed chunks. If ``DATABASE_URL`` is unset or the
    database is unavailable, the exception is allowed to bubble to the startup
    wrapper, which logs and continues.
    """
    chunks = load_okf_chunks(agent_id)
    if not chunks:
        return 0

    with _connect() as conn:
        with conn.cursor() as cur:
            _ensure_schema(cur)
            for chunk in chunks:
                cur.execute(
                    """
                    INSERT INTO agent_memory_chunks (
                      id,
                      agent_id,
                      source_path,
                      memory_type,
                      tags,
                      content,
                      embedding
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                    ON CONFLICT (id) DO UPDATE SET
                      memory_type = EXCLUDED.memory_type,
                      tags = EXCLUDED.tags,
                      content = EXCLUDED.content,
                      embedding = EXCLUDED.embedding,
                      updated_at = now()
                    """,
                    (
                        _chunk_id(chunk),
                        chunk.agent_id,
                        chunk.source_path,
                        chunk.memory_type,
                        Json(list(chunk.tags)),
                        chunk.content,
                        _vector_literal(embed_text(chunk.content)),
                    ),
                )
        conn.commit()
    return len(chunks)


def pgvector_index_config() -> dict[str, object]:
    """Return human-readable configuration for logs/debugging."""
    return {
        "embedding_method": EMBEDDING_METHOD,
        "vector_dims": VECTOR_DIMS,
        "chunk_strategy": CHUNK_STRATEGY,
        "stores_history": False,
        "stores_okf_memory": True,
    }


def search_okf_chunks_pgvector(
    query_text: str,
    agent_id: str = "contract_agent",
    limit: int = 5,
) -> list[dict[str, object]]:
    """Return similar OKF chunks from pgvector."""
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  agent_id,
                  source_path,
                  memory_type,
                  tags,
                  content,
                  embedding <-> %s::vector AS distance
                FROM agent_memory_chunks
                WHERE agent_id = %s
                ORDER BY embedding <-> %s::vector
                LIMIT %s
                """,
                (
                    _vector_literal(embed_text(query_text)),
                    agent_id,
                    _vector_literal(embed_text(query_text)),
                    limit,
                ),
            )
            rows = cur.fetchall()

    results: list[dict[str, object]] = []
    for agent, source_path, memory_type, tags, content, distance in rows:
        results.append(
            {
                "agent_id": agent,
                "source_path": source_path,
                "memory_type": memory_type,
                "tags": tags,
                "content": content,
                "distance": float(distance),
            }
        )
    return results


def embed_text(text: str) -> list[float]:
    """Create a deterministic local feature vector for early pgvector wiring."""
    vector = [0.0] * VECTOR_DIMS
    for token in _tokens(text):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:2], "big") % VECTOR_DIMS
        sign = 1.0 if digest[2] % 2 == 0 else -1.0
        vector[index] += sign

    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [round(value / norm, 6) for value in vector]


def _connect():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg2.connect(database_url)


def _ensure_schema(cur) -> None:
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
    cur.execute(
        f"""
        CREATE TABLE IF NOT EXISTS agent_memory_chunks (
          id text PRIMARY KEY,
          agent_id text NOT NULL,
          source_path text NOT NULL,
          memory_type text NOT NULL,
          tags jsonb NOT NULL DEFAULT '[]'::jsonb,
          content text NOT NULL,
          embedding vector({VECTOR_DIMS}) NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_agent_memory_chunks_agent
        ON agent_memory_chunks(agent_id)
        """
    )


def _chunk_id(chunk: OkfMemoryChunk) -> str:
    return f"{chunk.agent_id}:{chunk.source_path}"


def _tokens(text: str) -> Iterable[str]:
    stop = {
        "that",
        "this",
        "with",
        "from",
        "should",
        "contract",
        "agent",
        "memory",
    }
    for token in re.findall(r"[a-zA-Z][a-zA-Z-]{2,}", text.lower()):
        token = token.replace("-", " ")
        if token not in stop:
            yield token


def _vector_literal(values: list[float]) -> str:
    return json.dumps(values)
