"""Prompt loading helpers for agent prompt files."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"
DEFAULT_OKF_MEMORY_ROOT = (
    Path(__file__).resolve().parents[2] / "memory" / "okf"
)


@lru_cache(maxsize=None)
def load_prompt(agent_module_name: str) -> str:
    """Load a prompt whose filename matches the agent module name."""
    path = PROMPTS_DIR / f"{agent_module_name}.md"
    try:
        return path.read_text(encoding="utf-8").strip()
    except FileNotFoundError as exc:
        raise RuntimeError(f"Prompt file not found: {path}") from exc


def resolve_okf_memory_root() -> Path | None:
    """Return the OKF memory bundle root if configured and present."""
    configured = os.getenv("OKF_MEMORY_ROOT")
    if configured:
        root = Path(configured).expanduser()
        return root if root.is_dir() else None
    return DEFAULT_OKF_MEMORY_ROOT if DEFAULT_OKF_MEMORY_ROOT.is_dir() else None


@lru_cache(maxsize=1)
def load_okf_memory() -> str:
    """Load a compact OKF memory summary from the bundle root.

    The contract agent can inject this into its system prompt as durable
    long-term memory. If the bundle is not configured, this returns an empty
    string.
    """
    root = resolve_okf_memory_root()
    if root is None:
        return ""

    index = root / "index.md"
    profile = root / "profile.md"
    snippets: list[str] = []
    for path in (index, profile):
        if path.is_file():
            snippets.append(f"# {path.relative_to(root)}\n{path.read_text(encoding='utf-8').strip()}")

    policies_dir = root / "policies"
    patterns_dir = root / "patterns"
    for folder in (policies_dir, patterns_dir):
        if not folder.is_dir():
            continue
        for md_path in sorted(folder.glob("*.md"))[:6]:
            if md_path.name == "index.md":
                continue
            rel = md_path.relative_to(root).as_posix()
            snippets.append(f"# {rel}\n{md_path.read_text(encoding='utf-8').strip()}")

    if not snippets:
        return ""
    return "\n\n".join(snippets).strip()
