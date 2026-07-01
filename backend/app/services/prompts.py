"""Prompt loading helpers for agent prompt files."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path


PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"


@lru_cache(maxsize=None)
def load_prompt(agent_module_name: str) -> str:
    """Load a prompt whose filename matches the agent module name."""
    path = PROMPTS_DIR / f"{agent_module_name}.md"
    try:
        return path.read_text(encoding="utf-8").strip()
    except FileNotFoundError as exc:
        raise RuntimeError(f"Prompt file not found: {path}") from exc
