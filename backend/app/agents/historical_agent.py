"""Agent 5 — Historical Procurement Intelligence Agent (LLM-only)."""
from __future__ import annotations

import json

from ..models import AgentResult, ProcurementInput
from ..services.historical_data import find_similar
from ..services.llm import has_api_key, run_agent_llm
from .base import clamp, risk_level

NAME = "Historical Intelligence Agent"
INSTRUCTIONS = """You are a procurement data scientist with access to a curated
database of past public-sector procurement outcomes.

You will be given:
1. The current procurement under review (including `category` and `item_research_context` if available).
2. A set of benchmark projects retrieved from the historical knowledge base.

Compare the current procurement against the benchmarks. Where `item_research_context`
is provided, use it to understand what makes this specific item challenging and
reference domain-specific failure patterns. Where `category` is provided, weight
historical patterns that apply to that domain more heavily.

Identify which failure patterns the current procurement matches, estimate delay
and failure probability, and produce a risk assessment grounded in historical precedent.
Do NOT anchor to any single item type — reason from the actual input data.

Return a JSON object with EXACTLY these keys:
{
  "risk_score": <integer 0-100>,
  "findings": ["finding grounded in a historical project or domain pattern", ...],
  "evidence": ["<project_id>: outcome description", ...],
  "reasoning": "narrative linking current procurement to historical patterns, calibrated to the item category",
  "recommendation": "gate conditions derived from what succeeded historically for this type of procurement",
  "metrics": {
    "avg_delay_months": <float, average delay across matched benchmarks>,
    "failure_probability_pct": <integer 0-100>,
    "delay_probability_pct": <integer 0-100>,
    "benchmark_ids": ["id1", "id2", ...]
  }
}"""


def analyze(data: ProcurementInput) -> AgentResult:
    if not has_api_key():
        return _offline_result()

    similar = find_similar(
        f"{data.equipment_type} procurement",
        data.equipment_type,
        k=4,
    )

    payload = {
        "current_procurement": json.loads(data.model_dump_json()),
        "benchmark_projects": similar,
    }

    result = run_agent_llm(
        name=NAME,
        instructions=INSTRUCTIONS,
        user_payload=json.dumps(payload),
    )
    if result is None:
        raise RuntimeError(f"{NAME}: LLM call failed — check your API key.")

    score = clamp(float(result.get("risk_score", 50)))
    metrics = result.get("metrics") or {}
    metrics.setdefault("avg_delay_months", 0.0)
    metrics.setdefault("failure_probability_pct", 50)
    metrics.setdefault("delay_probability_pct", 50)
    metrics.setdefault("benchmark_ids", [p["id"] for p in similar])

    return AgentResult(
        agent=NAME,
        risk_score=round(score),
        risk_level=risk_level(score),
        findings=result.get("findings") or [],
        evidence=result.get("evidence") or [],
        reasoning=result.get("reasoning") or "",
        recommendation=result.get("recommendation") or "",
        metrics=metrics,
    )


def _offline_result() -> AgentResult:
    return AgentResult(
        agent=NAME,
        status="offline",
        risk_score=50,
        risk_level=risk_level(50),
        findings=["Offline mode — no API key set. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to enable analysis."],
        evidence=[],
        reasoning="No analysis performed in offline mode.",
        recommendation="Configure an API key to enable agentic analysis.",
        metrics={
            "avg_delay_months": 0.0,
            "failure_probability_pct": 50,
            "delay_probability_pct": 50,
            "benchmark_ids": [],
        },
    )
