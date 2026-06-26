"""LLM service wrapper — dual-provider (Anthropic Claude or OpenAI).

Provider selection (in priority order):
  1. LLM_PROVIDER env var ("anthropic" or "openai") — explicit override
  2. ANTHROPIC_API_KEY present → anthropic
  3. OPENAI_API_KEY present    → openai
  4. Neither                   → offline rule-based fallback

Model env vars:
  CLAUDE_MODEL  (default: claude-haiku-4-5-20251001; sonnet used for Decision Board)
  OPENAI_MODEL  (default: gpt-4o)
"""
from __future__ import annotations

import json
import os
import threading
import time
from typing import Optional

# Thread-local storage for per-call metadata (tokens, model, latency).
# Written by _run_anthropic / _run_openai; read by get_last_call_meta().
_local = threading.local()


def _store_meta(tokens_in: int | None, tokens_out: int | None, model: str | None) -> None:
    _local.last_meta = {"tokens_in": tokens_in, "tokens_out": tokens_out, "model": model}


def get_last_call_meta() -> dict:
    """Return metadata from the most recent LLM call on this thread."""
    return getattr(_local, "last_meta", {"tokens_in": None, "tokens_out": None, "model": None})

# --- Anthropic models ---
CLAUDE_HAIKU = "claude-haiku-4-5-20251001"
CLAUDE_SONNET = "claude-sonnet-4-6"
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", CLAUDE_HAIKU)

# --- OpenAI models ---
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")


def _provider() -> str:
    """Resolve which provider to use."""
    explicit = os.getenv("LLM_PROVIDER", "").lower()
    if explicit in ("anthropic", "openai"):
        return explicit
    if os.getenv("ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    return "offline"


def has_api_key() -> bool:
    return _provider() != "offline"


# --- Lazy client singletons ---
_anthropic_client = None
_openai_client = None


def _get_anthropic():
    global _anthropic_client
    if _anthropic_client is not None:
        return _anthropic_client
    try:
        import anthropic
        _anthropic_client = anthropic.Anthropic()
        return _anthropic_client
    except Exception:
        return None


def _get_openai():
    global _openai_client
    if _openai_client is not None:
        return _openai_client
    try:
        from openai import OpenAI
        _openai_client = OpenAI()
        return _openai_client
    except Exception:
        return None


def run_agent_llm(
    *,
    name: str,
    instructions: str,
    user_payload: str,
    temperature: float = 0.2,
    use_sonnet: bool = False,
) -> Optional[dict]:
    """Call the configured LLM and return a parsed JSON dict, or None on failure.

    Callers fall back to the rule-based engine on None.
    use_sonnet=True upgrades to claude-sonnet-4-6 (Anthropic path only; ignored
    on OpenAI path where the same model is used throughout).
    """
    provider = _provider()
    if provider == "anthropic":
        return _run_anthropic(instructions, user_payload, temperature, use_sonnet)
    if provider == "openai":
        return _run_openai(instructions, user_payload, temperature)
    return None


def _run_anthropic(
    instructions: str,
    user_payload: str,
    temperature: float,
    use_sonnet: bool,
) -> Optional[dict]:
    client = _get_anthropic()
    if client is None:
        return None
    model = CLAUDE_SONNET if use_sonnet else CLAUDE_MODEL
    try:
        t0 = time.monotonic()
        resp = client.messages.create(
            model=model,
            max_tokens=1024,
            temperature=temperature,
            system=instructions + "\nAlways respond with a single JSON object and nothing else.",
            messages=[
                {"role": "user", "content": user_payload},
                {"role": "assistant", "content": "{"},
            ],
        )
        _store_meta(
            tokens_in=getattr(resp.usage, "input_tokens", None),
            tokens_out=getattr(resp.usage, "output_tokens", None),
            model=model,
        )
        return _coerce_json("{" + resp.content[0].text)
    except Exception:
        return None


def _run_openai(
    instructions: str,
    user_payload: str,
    temperature: float,
) -> Optional[dict]:
    client = _get_openai()
    if client is None:
        return None
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            temperature=temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": instructions},
                {"role": "user", "content": user_payload},
            ],
        )
        usage = getattr(resp, "usage", None)
        _store_meta(
            tokens_in=getattr(usage, "prompt_tokens", None) if usage else None,
            tokens_out=getattr(usage, "completion_tokens", None) if usage else None,
            model=OPENAI_MODEL,
        )
        return _coerce_json(resp.choices[0].message.content)
    except Exception:
        return None


def _coerce_json(text) -> Optional[dict]:
    if text is None:
        return None
    if isinstance(text, dict):
        return text
    text = str(text).strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1] if "```" in text else text
        text = text.replace("json", "", 1).strip("` \n")
    try:
        return json.loads(text)
    except Exception:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except Exception:
                return None
        return None


# ---------------------------------------------------------------------------
# Tool-use agentic loop — Anthropic only
# ---------------------------------------------------------------------------

def run_agent_with_tools(
    *,
    name: str,
    instructions: str,
    user_payload: str,
    tools: list,
    temperature: float = 0.2,
    use_sonnet: bool = False,
) -> Optional[dict]:
    """Run an LLM agent with a tool-use loop. Anthropic provider only.

    Falls back to None if offline, if OpenAI is the active provider, or on
    any API/tool failure — callers must degrade gracefully.
    """
    if _provider() != "anthropic":
        return None
    return _run_anthropic_with_tools(instructions, user_payload, tools, temperature, use_sonnet)


def _run_anthropic_with_tools(
    instructions: str,
    user_payload: str,
    tools: list,
    temperature: float,
    use_sonnet: bool = False,
) -> Optional[dict]:
    client = _get_anthropic()
    if client is None:
        return None
    model = CLAUDE_SONNET if use_sonnet else CLAUDE_MODEL
    messages: list = [{"role": "user", "content": user_payload}]
    max_rounds = 6

    for _ in range(max_rounds):
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=4096,
                temperature=temperature,
                system=(
                    instructions
                    + "\nAfter completing all tool calls, output a single valid"
                    " JSON object and nothing else."
                ),
                messages=messages,
                tools=tools,
            )
        except Exception:
            return None

        if resp.stop_reason == "end_turn":
            _store_meta(
                tokens_in=getattr(resp.usage, "input_tokens", None),
                tokens_out=getattr(resp.usage, "output_tokens", None),
                model=model,
            )
            text = "".join(
                block.text for block in resp.content if hasattr(block, "text")
            )
            return _coerce_json(text)

        if resp.stop_reason != "tool_use":
            break

        tool_results = []
        for block in resp.content:
            if block.type == "tool_use":
                output = _execute_tool(block.name, block.input)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": output,
                    }
                )

        messages.append({"role": "assistant", "content": resp.content})
        messages.append({"role": "user", "content": tool_results})

    return None


def _execute_tool(tool_name: str, tool_input: dict) -> str:
    """Dispatch a tool call and return its result as a JSON string."""
    if tool_name == "web_search":
        return _web_search(tool_input.get("query", ""))
    return json.dumps({"error": f"Unknown tool: {tool_name}"})


def _web_search(query: str) -> str:
    """Search the web via DuckDuckGo and return top results as JSON."""
    try:
        from duckduckgo_search import DDGS  # optional; add to requirements.txt
        with DDGS() as ddgs:
            hits = list(ddgs.text(query, max_results=5))
        if not hits:
            return json.dumps({"results": [], "note": "No results found"})
        return json.dumps(
            {
                "results": [
                    {
                        "title": h.get("title", ""),
                        "snippet": h.get("body", ""),
                        "url": h.get("href", ""),
                    }
                    for h in hits
                ]
            }
        )
    except ImportError:
        return json.dumps(
            {
                "error": "duckduckgo_search not installed",
                "fix": "pip install duckduckgo-search",
            }
        )
    except Exception as exc:
        return json.dumps({"error": str(exc), "results": []})
