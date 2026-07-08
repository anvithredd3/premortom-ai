"""OKF-style memory loading and selection.

This module keeps the first memory-selection pass local and deterministic:
load markdown memory files, attach lightweight metadata, and select relevant
snippets before the LLM prompt is assembled.
"""
from __future__ import annotations

import os
import re
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable


DEFAULT_OKF_MEMORY_ROOT = (
    Path(__file__).resolve().parents[2] / "memory" / "okf"
)
AGENT_PROFILE_ROOT = Path(__file__).resolve().parents[2] / "agent_profiles"


@dataclass(frozen=True)
class OkfMemoryChunk:
    agent_id: str
    source_path: str
    memory_type: str
    tags: tuple[str, ...]
    content: str


def resolve_okf_memory_root(agent_id: str = "contract_agent") -> Path | None:
    """Return the OKF memory bundle root if configured and present."""
    agent_env = f"{agent_id.upper()}_OKF_MEMORY_ROOT"
    configured = os.getenv(agent_env)
    if not configured and agent_id == "contract_agent":
        configured = os.getenv("OKF_MEMORY_ROOT")
    if configured:
        root = Path(configured).expanduser()
        return root if root.is_dir() else None
    profile_root = AGENT_PROFILE_ROOT / f"{agent_id}_profile"
    if profile_root.is_dir():
        return profile_root
    return DEFAULT_OKF_MEMORY_ROOT if DEFAULT_OKF_MEMORY_ROOT.is_dir() else None


@lru_cache(maxsize=8)
def load_okf_chunks(agent_id: str = "contract_agent") -> tuple[OkfMemoryChunk, ...]:
    """Load OKF markdown files as selectable memory chunks."""
    root = resolve_okf_memory_root(agent_id)
    if root is None:
        return ()

    paths: list[Path] = []
    for relative in ("index.md", "profile.md"):
        path = root / relative
        if path.is_file():
            paths.append(path)

    for folder_name in ("policies", "patterns"):
        folder = root / folder_name
        if not folder.is_dir():
            continue
        paths.extend(path for path in sorted(folder.glob("*.md")) if path.name != "index.md")

    return tuple(_load_chunk(root, path, agent_id) for path in paths)


def select_okf_memory(
    query_text: str,
    agent_id: str = "contract_agent",
    max_chunks: int = 10,
) -> str:
    """Return a compact memory block relevant to the current input.

    The core index/profile chunks are always included. Policy/pattern chunks are
    selected with simple deterministic keyword rules. This avoids sending every
    memory file while keeping the current flow to one final LLM call.
    """
    if os.getenv("OKF_USE_PGVECTOR_RETRIEVAL", "0") in {"1", "true", "True"}:
        memory = _select_okf_memory_pgvector(query_text, agent_id, max_chunks)
        if memory:
            return memory

    chunks = tuple(chunk for chunk in load_okf_chunks(agent_id) if chunk.agent_id == agent_id)
    if not chunks:
        return ""

    selected: list[OkfMemoryChunk] = []
    selected.extend(
        chunk for chunk in chunks if chunk.source_path in {"index.md", "profile.md"}
    )

    query = query_text.lower()
    scored: list[tuple[int, OkfMemoryChunk]] = []
    for chunk in chunks:
        if chunk in selected:
            continue
        score = _score_chunk(query, chunk)
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda item: (-item[0], item[1].source_path))
    selected.extend(chunk for _, chunk in scored)

    selected = selected[:max_chunks]
    if not selected:
        return ""
    return "\n\n".join(_format_chunk(chunk) for chunk in selected).strip()


def write_okf_memory_index(
    output_path: Path | None = None,
    agent_id: str = "contract_agent",
) -> Path | None:
    """Write a debug JSON index of parsed OKF chunks.

    The file contains plain text and metadata only, not embedding vectors.
    """
    root = resolve_okf_memory_root(agent_id)
    if root is None:
        return None

    path = output_path or root / f"{agent_id}_memory_index.json"
    chunks = load_okf_chunks(agent_id)
    payload = [
        {
            "agent_id": chunk.agent_id,
            "source_path": chunk.source_path,
            "memory_type": chunk.memory_type,
            "tags": list(chunk.tags),
            "content": chunk.content,
        }
        for chunk in chunks
    ]
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def _load_chunk(root: Path, path: Path, agent_id: str) -> OkfMemoryChunk:
    raw = path.read_text(encoding="utf-8").strip()
    metadata, body = _split_frontmatter(raw)
    rel = path.relative_to(root).as_posix()
    return OkfMemoryChunk(
        agent_id=agent_id,
        source_path=rel,
        memory_type=_memory_type(rel, metadata.get("type", "")),
        tags=tuple(_metadata_list(metadata.get("tags", ""))),
        content=body.strip() or raw,
    )


def _split_frontmatter(raw: str) -> tuple[dict[str, str], str]:
    if not raw.startswith("---"):
        return {}, raw
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", raw, re.DOTALL)
    if not match:
        return {}, raw

    metadata: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line or line.lstrip().startswith("-"):
            continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip()
    return metadata, match.group(2)


def _metadata_list(value: str) -> Iterable[str]:
    value = value.strip()
    if not value:
        return ()
    if value.startswith("[") and value.endswith("]"):
        value = value[1:-1]
    return tuple(part.strip().strip("\"'") for part in value.split(",") if part.strip())


def _memory_type(source_path: str, declared_type: str) -> str:
    if source_path.startswith("policies/"):
        return "policy"
    if source_path.startswith("patterns/"):
        return "pattern"
    if source_path == "profile.md":
        return "profile"
    if source_path == "index.md":
        return "index"
    return declared_type or "memory"


def _score_chunk(query: str, chunk: OkfMemoryChunk) -> int:
    score = 0
    for keyword in _keywords_for_path(chunk.source_path):
        if keyword and keyword in query:
            score += 5

    keywords = set()
    keywords.update(tag.lower().replace("-", " ") for tag in chunk.tags)
    keywords.update(_keywords_from_text(chunk.content[:500]))
    score += sum(1 for keyword in keywords if keyword and keyword in query)
    return score


def _keywords_for_path(source_path: str) -> tuple[str, ...]:
    rules = {
        "policies/advance-payments.md": (
            "advance",
            "payment",
            "bank guarantee",
            "guarantee",
            "milestone",
        ),
        "policies/installation.md": (
            "installation",
            "commissioning",
            "site readiness",
            "buyer",
            "vendor responsibility",
        ),
        "policies/service-levels.md": (
            "service",
            "sla",
            "response",
            "spare",
            "maintenance",
            "uptime",
        ),
        "policies/training.md": (
            "training",
            "operator",
            "technician",
            "handover",
        ),
        "policies/warranty.md": (
            "warranty",
            "commissioning",
            "delivery",
            "acceptance",
        ),
        "patterns/clause-conflicts.md": (
            "conflict",
            "conflicting",
            "inconsistent",
            "mismatch",
        ),
        "patterns/common-risk-patterns.md": (
            "risk",
            "missing",
            "unclear",
            "vague",
        ),
        "patterns/evidence-quality.md": (
            "evidence",
            "claim",
            "verified",
            "certificate",
            "reference",
        ),
    }
    return rules.get(source_path, ())


def _keywords_from_text(text: str) -> tuple[str, ...]:
    words = re.findall(r"[a-zA-Z][a-zA-Z-]{3,}", text.lower())
    stop = {"this", "that", "with", "from", "should", "contract", "agent", "memory"}
    return tuple(word.replace("-", " ") for word in words if word not in stop)[:20]


def _format_chunk(chunk: OkfMemoryChunk) -> str:
    return f"# {chunk.source_path}\n{chunk.content}"


def _select_okf_memory_pgvector(
    query_text: str,
    agent_id: str,
    max_chunks: int,
) -> str:
    try:
        from .okf_pgvector import search_okf_chunks_pgvector

        rows = search_okf_chunks_pgvector(query_text, agent_id, limit=max_chunks)
    except Exception as exc:
        print(f"Falling back to rule-based OKF memory selection: {exc}")
        return ""

    if not rows:
        return ""
    return "\n\n".join(
        f"# {row['source_path']}\n{row['content']}"
        for row in rows
    ).strip()
