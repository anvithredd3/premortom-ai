"""Agent 3 — Workforce Readiness Agent (LLM-only)."""
from __future__ import annotations

from ..models import AgentResult, ProcurementInput
from ..services.llm import has_api_key, run_agent_llm
from .base import clamp, risk_level

NAME = "Workforce Readiness Agent"
INSTRUCTIONS = """You are an operational-readiness analyst specialising in
public-sector procurement across all equipment and asset categories.

Assess the gap between specialist personnel available versus required,
the presence of a hiring or training plan, whether training is included in the
contract, and the likelihood the asset will be usable on arrival.

IMPORTANT — calibrate to the item being procured:
- `technicians_available` and `technicians_required` refer to the relevant
  specialist personnel for this item. Use `category` and `item_research_context`
  to interpret these correctly:
  * aviation → licensed pilots, aircraft maintenance engineers (AMEs)
  * medical_equipment → radiologists, biomedical engineers, trained operators
  * it_systems → network/system administrators, certified engineers
  * heavy_machinery → certified operators, maintenance technicians
  * vehicles → drivers, maintenance crew
  * infrastructure → site supervisors, licensed engineers
  * general → trained operators/technicians as described
- If `item_research_context` is provided, use it to understand the staffing
  complexity and certification requirements for this item.
- If `extra_fields` contains relevant workforce data, incorporate it.

Return a JSON object with EXACTLY these keys:
{
  "risk_score": <integer 0-100>,
  "findings": ["specific finding grounded in the input and item category", ...],
  "evidence": ["direct data point from the input", ...],
  "reasoning": "narrative linking staff gaps and training status to operational risk for this specific item",
  "recommendation": "concrete action (hire X certified staff, mandate vendor training, etc.)",
  "metrics": {
    "staff_readiness_pct": <integer 0-100, available/required × 100>,
    "operator_gap": <integer, required minus available; 0 if fully staffed>
  }
}

Scoring guidance:
- 0 personnel available, >0 required → CRITICAL (score ≥ 80)
- Gap > 50% of required → HIGH (score 60-79)
- No training included in contract → +10 pts
- staff_readiness_pct = min(100, available / required × 100)"""


def analyze(data: ProcurementInput) -> AgentResult:
    if not has_api_key():
        return _offline_result()

    result = run_agent_llm(
        name=NAME,
        instructions=INSTRUCTIONS,
        user_payload=data.model_dump_json(),
    )
    if result is None:
        raise RuntimeError(f"{NAME}: LLM call failed — check your API key.")

    score = clamp(float(result.get("risk_score", 50)))
    metrics = result.get("metrics") or {}
    metrics.setdefault("staff_readiness_pct", 50)
    metrics.setdefault(
        "operator_gap",
        max(0, data.technicians_required - data.technicians_available),
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
        metrics={"staff_readiness_pct": 50, "operator_gap": 0},
    )
