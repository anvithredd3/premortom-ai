"""LLM service wrapper — dual-provider (Anthropic Claude or OpenAI).

Provider selection (in priority order):
  1. LLM_PROVIDER env var ("anthropic" or "openai") — explicit override
  2. ANTHROPIC_API_KEY present → anthropic
  3. OPENAI_API_KEY present    → openai
  4. Neither                   → offline rule-based fallback

Model env vars:
  CLAUDE_MODEL  (default: claude-haiku-4-5-20251001; sonnet used for Decision Board)
  OPENAI_MODEL  (default: gpt-5.5; overridable, matches .env.example / .codex)
"""
from __future__ import annotations

import json
import os
from typing import Callable, Dict, List, Optional

# --- Anthropic models ---
CLAUDE_HAIKU = "claude-haiku-4-5-20251001"
CLAUDE_SONNET = "claude-sonnet-4-6"
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", CLAUDE_HAIKU)

# --- OpenAI models ---
# Default aligns with .env.example, AGENTS.md, and .codex/config.toml.
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.5")


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
        return _coerce_json(resp.choices[0].message.content)
    except Exception:
        return None


def run_agent_llm_with_tools(
    *,
    name: str,
    instructions: str,
    user_payload: str,
    openai_tools: List[dict],
    anthropic_tools: List[dict],
    tool_functions: Dict[str, Callable[[dict], dict]],
    temperature: float = 0.2,
    use_sonnet: bool = False,
    max_rounds: int = 4,
) -> Optional[dict]:
    """Run an agentic tool-use loop and return a parsed JSON dict, or None.

    The model may call the registered ``tool_functions`` (by name); we execute
    them locally, feed results back, and iterate until it produces a final JSON
    answer or ``max_rounds`` is reached. Returns None on any failure so callers
    can fall back to the plain (no-tool) path or the rule-based engine.
    """
    provider = _provider()
    try:
        if provider == "anthropic":
            return _run_anthropic_tools(
                instructions,
                user_payload,
                anthropic_tools,
                tool_functions,
                temperature,
                use_sonnet,
                max_rounds,
            )
        if provider == "openai":
            return _run_openai_tools(
                instructions,
                user_payload,
                openai_tools,
                tool_functions,
                temperature,
                max_rounds,
            )
    except Exception:
        return None
    return None


def _run_openai_tools(
    instructions: str,
    user_payload: str,
    tools: List[dict],
    tool_functions: Dict[str, Callable[[dict], dict]],
    temperature: float,
    max_rounds: int,
) -> Optional[dict]:
    client = _get_openai()
    if client is None:
        return None
    messages: List[dict] = [
        {"role": "system", "content": instructions},
        {"role": "user", "content": user_payload},
    ]
    for _ in range(max_rounds):
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            temperature=temperature,
            tools=tools,
            messages=messages,
        )
        msg = resp.choices[0].message
        tool_calls = getattr(msg, "tool_calls", None)
        if not tool_calls:
            return _coerce_json(msg.content)
        messages.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in tool_calls
                ],
            }
        )
        for tc in tool_calls:
            fn = tool_functions.get(tc.function.name)
            try:
                args = json.loads(tc.function.arguments or "{}")
            except Exception:
                args = {}
            result = fn(args) if fn else {"error": "unknown tool"}
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result),
                }
            )
    return None


def _run_anthropic_tools(
    instructions: str,
    user_payload: str,
    tools: List[dict],
    tool_functions: Dict[str, Callable[[dict], dict]],
    temperature: float,
    use_sonnet: bool,
    max_rounds: int,
) -> Optional[dict]:
    client = _get_anthropic()
    if client is None:
        return None
    model = CLAUDE_SONNET if use_sonnet else CLAUDE_MODEL
    system = (
        instructions
        + "\nWhen you have gathered enough information, respond with a single "
        "JSON object and nothing else."
    )
    messages: List[dict] = [{"role": "user", "content": user_payload}]
    for _ in range(max_rounds):
        resp = client.messages.create(
            model=model,
            max_tokens=1024,
            temperature=temperature,
            system=system,
            tools=tools,
            messages=messages,
        )
        if resp.stop_reason != "tool_use":
            text = "".join(
                block.text for block in resp.content if getattr(block, "type", "") == "text"
            )
            return _coerce_json(text)
        messages.append({"role": "assistant", "content": resp.content})
        tool_results = []
        for block in resp.content:
            if getattr(block, "type", "") != "tool_use":
                continue
            fn = tool_functions.get(block.name)
            result = fn(dict(block.input)) if fn else {"error": "unknown tool"}
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result),
                }
            )
        messages.append({"role": "user", "content": tool_results})
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
