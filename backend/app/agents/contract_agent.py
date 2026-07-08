"""Agent 1 — Contract Risk Agent (LLM-only)."""
from __future__ import annotations

from ..models import AgentResult, ProcurementInput
from ..services.decision_history_pgvector import select_decision_history_memory
from ..services.llm import has_api_key, run_agent_llm
from ..services.okf_memory import select_okf_memory
from ..services.prompts import load_prompt
from .base import clamp, risk_level

NAME = "Contract Risk Agent"
BASE_INSTRUCTIONS = load_prompt("contract_agent")


def analyze(data: ProcurementInput) -> AgentResult:
    if not has_api_key():
        return _offline_result()

    instructions = _build_instructions(data)
    result = run_agent_llm(
        name=NAME,
        instructions=instructions,
        user_payload=data.model_dump_json(),
    )
    if result is None:
        raise RuntimeError(f"{NAME}: LLM call failed — check your API key.")

    score = clamp(float(result.get("risk_score", 50)))
    metrics = result.get("metrics") or {}
    # Ensure required downstream keys exist
    if "advance_released_cr" not in metrics:
        metrics["advance_released_cr"] = round(
            data.contract_value_cr * data.advance_payment_pct / 100, 2
        )
    if "warranty_start" not in metrics:
        metrics["warranty_start"] = data.warranty_start.value

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
        metrics={"advance_released_cr": 0.0, "warranty_start": "unknown"},
    )


def _build_instructions(data: ProcurementInput) -> str:
    vendor_name = _extract_vendor_name(data.raw_document_text or "")
    query_text = "\n".join(
        [
            data.procurement_name,
            data.equipment_type,
            data.installation_responsibility,
            vendor_name,
            data.raw_document_text or "",
        ]
    )
    okf_memory = select_okf_memory(query_text)
    history_memory = select_decision_history_memory(
        procurement_title=data.procurement_name,
        equipment_type=data.equipment_type,
        query_text=query_text,
        vendor_name=vendor_name,
    )

    sections = [BASE_INSTRUCTIONS]
    if okf_memory:
        sections.append(
            "# OKF long-term memory selected for this review\n"
            f"{okf_memory}"
        )
    if history_memory:
        sections.append(
            "# Bounded decision history selected for this review\n"
            f"{history_memory}"
        )
    return "\n\n".join(sections) + "\n"


def _extract_vendor_name(text: str) -> str:
    for line in text.splitlines():
        if line.lower().startswith("vendor:"):
            return line.split(":", 1)[1].strip()
    return ""
