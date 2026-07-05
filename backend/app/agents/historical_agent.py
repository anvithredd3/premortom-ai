"""Agent 5 — Historical Procurement Intelligence Agent.

Beyond curated precedent, this agent performs *real tool use*: it can screen
the vendor name against a debarment/blacklist list (World Bank debarred firms)
via the ``screen_vendor`` tool. The screening also runs deterministically so
the finding is always surfaced, even offline.
"""
from __future__ import annotations

import json

from ..models import AgentResult, ProcurementInput
from ..services import vendor_screening
from ..services.historical_data import find_similar
from ..services.llm import has_api_key, run_agent_llm, run_agent_llm_with_tools
from .base import clamp, risk_level

NAME = "Historical Intelligence Agent"
INSTRUCTIONS = """You are a procurement data scientist with access to a curated
database of past public-sector procurement outcomes AND a live vendor-screening
tool.

You will be given:
1. The current procurement under review.
2. A set of benchmark projects retrieved from the historical knowledge base.

If a vendor name is present, call the `screen_vendor` tool to check the vendor
against the debarment / blacklist list before concluding. Treat any debarment
match as strong negative evidence that raises the risk score.

Compare the current procurement against the benchmarks. Identify which failure
patterns it matches, estimate delay and failure probability, and produce a
risk assessment grounded in historical precedent and vendor screening.

Return a JSON object with EXACTLY these keys:
{
  "risk_score": <integer 0-100>,
  "findings": ["finding grounded in a historical project", ...],
  "evidence": ["<project_id>: outcome description", ...],
  "reasoning": "narrative linking current procurement to historical patterns",
  "recommendation": "gate conditions derived from what succeeded historically",
  "metrics": {
    "avg_delay_months": <float, average delay across matched benchmarks>,
    "failure_probability_pct": <integer 0-100>,
    "delay_probability_pct": <integer 0-100>,
    "benchmark_ids": ["id1", "id2", ...]
  }
}"""


def analyze(data: ProcurementInput) -> AgentResult:
    # Deterministic tool call — always available, no API key needed. This
    # guarantees the debarment catch is visible even in offline mode.
    screening = (
        vendor_screening.screen_vendor(data.vendor_name)
        if data.vendor_name
        else None
    )

    if not has_api_key():
        return _offline_result(screening)

    similar = find_similar(
        f"{data.equipment_type} procurement",
        data.equipment_type,
        k=4,
    )

    payload = {
        "current_procurement": json.loads(data.model_dump_json()),
        "benchmark_projects": similar,
    }

    result = None
    if data.vendor_name:
        # Genuine agentic tool use: let the model call screen_vendor itself.
        result = run_agent_llm_with_tools(
            name=NAME,
            instructions=INSTRUCTIONS,
            user_payload=json.dumps(payload),
            openai_tools=[vendor_screening.openai_tool_spec()],
            anthropic_tools=[vendor_screening.anthropic_tool_spec()],
            tool_functions={
                "screen_vendor": lambda args: vendor_screening.screen_vendor(
                    args.get("vendor_name", data.vendor_name)
                )
            },
        )
    if result is None:
        # Fall back to the plain (no-tool) call.
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

    findings = result.get("findings") or []
    evidence = result.get("evidence") or []
    if screening and screening.get("matched"):
        # A debarment hit is decisive — inject it and floor the risk score.
        hit = vendor_screening.summarize_matches(screening)
        findings = [hit, *findings]
        evidence = [hit, *evidence]
        score = clamp(max(score, 85.0))
        metrics["vendor_debarment_match"] = True
        metrics["vendor_screening"] = screening

    return AgentResult(
        agent=NAME,
        risk_score=round(score),
        risk_level=risk_level(score),
        findings=findings,
        evidence=evidence,
        reasoning=result.get("reasoning") or "",
        recommendation=result.get("recommendation") or "",
        metrics=metrics,
    )


def _offline_result(screening: dict | None = None) -> AgentResult:
    findings = [
        "Offline mode — no API key set. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to enable analysis."
    ]
    evidence: list = []
    score = 50.0
    metrics = {
        "avg_delay_months": 0.0,
        "failure_probability_pct": 50,
        "delay_probability_pct": 50,
        "benchmark_ids": [],
    }
    # Vendor screening still runs offline (deterministic CSV tool).
    if screening is not None:
        summary = vendor_screening.summarize_matches(screening)
        evidence.append(summary)
        if screening.get("matched"):
            findings = [summary, *findings]
            score = 85.0
            metrics["failure_probability_pct"] = 85
            metrics["vendor_debarment_match"] = True
            metrics["vendor_screening"] = screening

    return AgentResult(
        agent=NAME,
        status="offline",
        risk_score=round(score),
        risk_level=risk_level(score),
        findings=findings,
        evidence=evidence,
        reasoning="Vendor screening ran offline; full precedent analysis needs an API key."
        if screening
        else "No analysis performed in offline mode.",
        recommendation="Configure an API key to enable full agentic analysis.",
        metrics=metrics,
    )
