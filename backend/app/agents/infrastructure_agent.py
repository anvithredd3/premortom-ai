"""Agent 2 — Infrastructure Readiness Agent (LLM-only)."""
from __future__ import annotations

from ..models import AgentResult, ProcurementInput
from ..services.llm import has_api_key, run_agent_llm
from .base import clamp, risk_level

NAME = "Infrastructure Readiness Agent"
INSTRUCTIONS = """You are a site-readiness and installation-risk engineer specialising
in public-sector procurement across all equipment and infrastructure categories.

Evaluate the following fields from the procurement input:
- construction_completion_pct: physical space/site readiness percentage
- electrical_readiness: power and electrical infrastructure status
- regulatory_approval_status: required permits or certifications

IMPORTANT — calibrate to the item being procured:
- If `category` is provided, adapt your findings to that domain:
  * aviation → hangar readiness, airside clearances, DGCA approvals
  * medical_equipment → shielded/clean room, medical gas lines, radiation or bio-safety clearances
  * it_systems → server room, network uptime, power redundancy, data-centre readiness
  * heavy_machinery → structural floor load, lifting gear, foundation work, factory acceptance
  * vehicles → workshop, parking bay, fuel infrastructure
  * infrastructure → civil/structural clearances, environmental NOC, architect sign-off
  * general → standard site readiness for delivery and installation
- If `item_research_context` is provided, use it to understand what specific site
  prerequisites apply to this item and reference them in your findings.
- If `extra_fields` contains relevant site data (e.g. hangar_ready, foundation_type),
  incorporate it into your assessment.

Return a JSON object with EXACTLY these keys:
{
  "risk_score": <integer 0-100>,
  "findings": ["specific finding grounded in the input data", ...],
  "evidence": ["direct data point or quote from the input", ...],
  "reasoning": "narrative of how site readiness translates to installation delay risk for this specific item",
  "recommendation": "concrete gate conditions the buyer must meet before accepting delivery",
  "metrics": {
    "readiness_pct": <integer 0-100, composite site readiness>,
    "construction_pct": <integer 0-100, civil works or space completion>,
    "predicted_delay_months": <float, expected installation delay>,
    "delay_range": "<low>-<high> months"
  }
}

Scoring guidance:
- Site/space readiness < 80% → installation likely impossible at delivery → CRITICAL (score ≥ 80)
- Each major approval pending (electrical, regulatory, domain-specific) → +20-25 pts
- Site gap (100 - construction_pct) × 0.8 is a reasonable base score
- predicted_delay_months: site gap drives ~0.1 months per 1% gap;
  each pending approval adds 1-2.5 months"""


def analyze(data: ProcurementInput) -> AgentResult:
    if not has_api_key():
        return _offline_result()

    result, telemetry = run_agent_llm(
        name=NAME,
        instructions=INSTRUCTIONS,
        user_payload=data.model_dump_json(),
    )
    if result is None:
        raise RuntimeError(f"{NAME}: LLM call failed — check your API key.")

    score = clamp(float(result.get("risk_score", 50)))
    metrics = result.get("metrics") or {}
    # Ensure required downstream keys exist with safe defaults
    metrics.setdefault("readiness_pct", 50)
    metrics.setdefault("construction_pct", data.construction_completion_pct)
    metrics.setdefault("predicted_delay_months", 8.0)
    delay = float(metrics["predicted_delay_months"])
    metrics.setdefault(
        "delay_range",
        f"{max(1, round(delay - 2))}-{round(delay + 1)} months",
    )

    return AgentResult(
        agent=NAME,
        risk_score=round(score),
        risk_level=risk_level(score),
        findings=result.get("findings") or [],
        evidence=result.get("evidence") or [],
        reasoning=result.get("reasoning") or "",
        recommendation=result.get("recommendation") or "",
        metrics=metrics,
        tokens_in=telemetry["tokens_in"],
        tokens_out=telemetry["tokens_out"],
        time_ms=telemetry["time_ms"],
        model=telemetry["model"],
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
            "readiness_pct": 50,
            "construction_pct": 50,
            "predicted_delay_months": 8.0,
            "delay_range": "6-9 months",
        },
    )
