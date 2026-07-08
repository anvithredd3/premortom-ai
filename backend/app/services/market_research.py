"""Market/specification research using OpenAI Responses API web search.

This service is intentionally optional. If it is disabled, missing an OpenAI
key, or the provider fails, it returns a structured skipped result so the bid
workflow remains demo-safe.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

from .llm import OPENAI_MODEL
from .okf_memory import select_okf_memory


PROVIDER = "openai_web_search"

INSTRUCTIONS = """
You are the Internet / Market Research Agent for a public procurement review.
Use web search to find current, source-aware market and specification context.

Return one JSON object with these keys:
- provider: string
- retrieved_at: string
- equipment_type: string
- market_price_range: object with summary, confidence, sources
- typical_terms: object with delivery_timeline, advance_payment, warranty_start,
  installation, training, service_sla
- regulatory_or_certification_expectations: object with summary, confidence, sources
- vendor_or_product_reputation_signals: list of objects
- consumables_and_lifecycle_costs: object with summary, known_consumables,
  recurring_cost_risks, confidence, sources
- current_market_or_future_trends: object with summary, signals, confidence, sources
- red_flags: list of strings
- limitations: list of strings

Guardrails:
- Do not decide the winning quote.
- Do not invent market values.
- Treat web research as benchmark context, not proof.
- Include source URLs where possible.
- State limitations when reliable information is not available.
"""


def research_bid_market(
    *,
    bid_id: str,
    equipment_type: str,
    procurement_name: str,
    quote_summaries: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return structured market/specification benchmarks for a bid."""
    enabled = os.getenv("MARKET_RESEARCH_ENABLED", "0") in {"1", "true", "True"}
    if not enabled:
        return _skipped("MARKET_RESEARCH_ENABLED is not set to 1.")

    provider = os.getenv("MARKET_RESEARCH_PROVIDER", PROVIDER)
    if provider != PROVIDER:
        return _skipped(f"Unsupported market research provider: {provider}")

    if not os.getenv("OPENAI_API_KEY"):
        return _skipped("OPENAI_API_KEY is not configured.")

    query = {
        "bid_id": bid_id,
        "equipment_type": equipment_type,
        "procurement_name": procurement_name,
        "quote_summaries": quote_summaries,
    }
    memory = select_okf_memory(
        json.dumps(query),
        agent_id="internet_market_research_agent",
        max_chunks=8,
    )
    instructions = INSTRUCTIONS
    if memory:
        instructions = (
            f"{INSTRUCTIONS}\n\n"
            "# Internet Market Research OKF memory selected for this task\n"
            f"{memory}\n"
        )

    try:
        from openai import OpenAI

        client = OpenAI()
        response = _create_response(client, instructions, query)
        result = _coerce_json(_response_text(response))
        if not result:
            return _skipped("OpenAI web search returned no parseable JSON.")
        result["provider"] = PROVIDER
        result["retrieved_at"] = _now()
        result["equipment_type"] = result.get("equipment_type") or equipment_type
        result.setdefault("limitations", [])
        return result
    except Exception as exc:
        return _skipped(f"Market research failed: {exc}")


def _create_response(client, instructions: str, query: dict[str, Any]):
    """Call Responses API with the current web_search tool name.

    Some SDK/API versions have exposed this as web_search_preview. Try the
    current name first, then fall back for compatibility.
    """
    prompt = (
        "Research market/specification benchmarks for this bid and return only "
        "the requested JSON object.\n\n"
        f"{json.dumps(query, indent=2)}"
    )
    try:
        return client.responses.create(
            model=os.getenv("MARKET_RESEARCH_MODEL", OPENAI_MODEL),
            instructions=instructions,
            tools=[{"type": "web_search"}],
            input=prompt,
            temperature=0.1,
        )
    except Exception:
        return client.responses.create(
            model=os.getenv("MARKET_RESEARCH_MODEL", OPENAI_MODEL),
            instructions=instructions,
            tools=[{"type": "web_search_preview"}],
            input=prompt,
            temperature=0.1,
        )


def _response_text(response) -> str:
    text = getattr(response, "output_text", None)
    if text:
        return str(text)
    output = getattr(response, "output", None) or []
    parts: list[str] = []
    for item in output:
        content = getattr(item, "content", None) or []
        for content_item in content:
            value = getattr(content_item, "text", None)
            if value:
                parts.append(str(value))
    return "\n".join(parts)


def _coerce_json(text: str) -> dict[str, Any] | None:
    text = str(text or "").strip()
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


def _skipped(reason: str) -> dict[str, Any]:
    return {
        "provider": PROVIDER,
        "status": "skipped",
        "retrieved_at": _now(),
        "equipment_type": "",
        "market_price_range": {"summary": "", "confidence": "low", "sources": []},
        "typical_terms": {},
        "regulatory_or_certification_expectations": {
            "summary": "",
            "confidence": "low",
            "sources": [],
        },
        "vendor_or_product_reputation_signals": [],
        "consumables_and_lifecycle_costs": {
            "summary": "",
            "known_consumables": [],
            "recurring_cost_risks": [],
            "confidence": "low",
            "sources": [],
        },
        "current_market_or_future_trends": {
            "summary": "",
            "signals": [],
            "confidence": "low",
            "sources": [],
        },
        "red_flags": [],
        "limitations": [reason],
    }


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
