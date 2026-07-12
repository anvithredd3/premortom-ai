"""Agent 4 — Financial Exposure Agent (LLM-only)."""
from __future__ import annotations

import json

from ..models import AgentResult, ProcurementInput
from ..services.llm import has_api_key, run_agent_llm
from .base import clamp, risk_level

NAME = "Financial Exposure Agent"
ANNUAL_IDLE_RATE = 0.08  # imported by scenario_agent
INSTRUCTIONS = """You are a procurement finance analyst specialising in
public-sector capital expenditure across all procurement categories.

Quantify advance-payment risk, idle-asset opportunity cost, warranty erosion,
and total projected financial loss given the procurement details and the
predicted installation delay provided.

Use `category` and `item_research_context` (if provided) to calibrate:
- What "idle cost" means for this asset type (e.g., aircraft sitting in a hangar
  incurs different costs than a server room sitting unused)
- Whether the advance payment terms are typical for this procurement category
- What financial protections are standard for this item type (bank guarantees,
  performance bonds, escrow arrangements)

Use these formulas as guidance (adapt if the context warrants):
- advance_cr = contract_value_cr × advance_payment_pct / 100
- idle_cost_cr = contract_value_cr × 0.08 × (predicted_delay_months / 12)
- warranty_loss_cr = contract_value_cr × (predicted_delay_months / 36) × 0.04
  (only if warranty starts at delivery; 0 otherwise)
- projected_loss_cr = idle_cost_cr + warranty_loss_cr
- annual_idle_cost_cr = contract_value_cr × 0.08

Return a JSON object with EXACTLY these keys:
{
  "risk_score": <integer 0-100>,
  "findings": ["₹X Cr released as advance...", ...],
  "evidence": ["formula workings or direct evidence", ...],
  "reasoning": "narrative on how funds are exposed ahead of value realisation, calibrated to this item type",
  "recommendation": "concrete financial safeguards appropriate to this procurement category",
  "metrics": {
    "advance_cr": <float>,
    "idle_cost_cr": <float>,
    "warranty_loss_cr": <float>,
    "projected_loss_cr": <float>,
    "annual_idle_cost_cr": <float>
  }
}"""


def analyze(data: ProcurementInput, predicted_delay_months: float = 8.0) -> AgentResult:
    if not has_api_key():
        return _offline_result()

    payload = json.loads(data.model_dump_json())
    payload["predicted_delay_months"] = predicted_delay_months

    result, telemetry = run_agent_llm(
        name=NAME,
        instructions=INSTRUCTIONS,
        user_payload=json.dumps(payload),
    )
    if result is None:
        raise RuntimeError(f"{NAME}: LLM call failed — check your API key.")

    score = clamp(float(result.get("risk_score", 50)))
    metrics = result.get("metrics") or {}
    # Ensure all downstream keys exist
    asset = data.contract_value_cr
    metrics.setdefault("advance_cr", round(asset * data.advance_payment_pct / 100, 2))
    metrics.setdefault("idle_cost_cr", 0.0)
    metrics.setdefault("warranty_loss_cr", 0.0)
    metrics.setdefault("projected_loss_cr", metrics.get("idle_cost_cr", 0.0))
    metrics.setdefault("annual_idle_cost_cr", round(asset * 0.08, 2))

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
            "advance_cr": 0.0,
            "idle_cost_cr": 0.0,
            "warranty_loss_cr": 0.0,
            "projected_loss_cr": 0.0,
            "annual_idle_cost_cr": 0.0,
        },
    )
