"""Agent orchestration.

Runs all five specialist analysis agents in parallel, then the Scenario
Simulation Agent and finally the Decision Board Agent. When ``langgraph`` is
installed the flow is expressed as a graph; otherwise we use a thread pool,
preserving identical behaviour.
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Callable, List

from ..models import AgentResult, PreMortemReport, ProcurementInput
from ..services.debate import build_debate
from ..services.llm import get_last_call_meta
from . import (
    contract_agent,
    decision_board,
    financial_agent,
    historical_agent,
    infrastructure_agent,
    scenario_agent,
    workforce_agent,
)


def _run_parallel(data: ProcurementInput) -> List[AgentResult]:
    """Execute the independent specialist agents concurrently."""
    with ThreadPoolExecutor(max_workers=5) as ex:
        f_contract = ex.submit(contract_agent.analyze, data)
        f_infra = ex.submit(infrastructure_agent.analyze, data)
        f_workforce = ex.submit(workforce_agent.analyze, data)
        f_historical = ex.submit(historical_agent.analyze, data)
        infra_result = f_infra.result()
        predicted_delay = infra_result.metrics.get("predicted_delay_months", 8.0)
        # Financial agent depends on infra's delay prediction.
        f_financial = ex.submit(
            financial_agent.analyze, data, predicted_delay
        )
        results = [
            f_contract.result(),
            infra_result,
            f_workforce.result(),
            f_financial.result(),
            f_historical.result(),
        ]
    return results


def _risk_to_status(risk_level_value: str) -> str:
    if risk_level_value in ("HIGH", "CRITICAL"):
        return "red"
    if risk_level_value == "MODERATE":
        return "amber"
    return "green"


def run_premortem_stream(data: ProcurementInput, send: Callable[[dict], None]) -> None:
    """Run the full analysis and emit SSE-ready dicts via send() as events arrive."""
    send({"type": "run_started", "agents": [
        "contract", "infrastructure", "workforce", "historical", "financial", "decision"
    ]})

    def run_agent(agent_id: str, fn: Callable, *args) -> AgentResult:
        send({"type": "agent_started", "id": agent_id})
        t0 = time.monotonic()
        result = fn(*args)
        ms = int((time.monotonic() - t0) * 1000)
        meta = get_last_call_meta()
        status = _risk_to_status(result.risk_level.value)
        send({
            "type": "agent_finished",
            "id": agent_id,
            "status": status,
            "risk_score": round(result.risk_score, 1),
            "verdict": result.recommendation,
            "summary": result.reasoning,
            "tokens": {"in": meta["tokens_in"], "out": meta["tokens_out"]},
            "time_ms": ms,
            "model": meta["model"],
            "research": [
                {"title": e, "url": "", "snippet": e} for e in result.evidence[:4]
            ],
        })
        return result

    with ThreadPoolExecutor(max_workers=5) as ex:
        f_contract = ex.submit(run_agent, "contract", contract_agent.analyze, data)
        f_infra = ex.submit(run_agent, "infrastructure", infrastructure_agent.analyze, data)
        f_workforce = ex.submit(run_agent, "workforce", workforce_agent.analyze, data)
        f_historical = ex.submit(run_agent, "historical", historical_agent.analyze, data)

        infra_result = f_infra.result()
        predicted_delay = infra_result.metrics.get("predicted_delay_months", 8.0)
        f_financial = ex.submit(run_agent, "financial", financial_agent.analyze, data, predicted_delay)

        results_list = [
            f_contract.result(),
            infra_result,
            f_workforce.result(),
            f_financial.result(),
            f_historical.result(),
        ]

    send({"type": "agent_started", "id": "decision"})
    t0 = time.monotonic()
    consolidated = decision_board.consolidate(data, results_list)
    ms = int((time.monotonic() - t0) * 1000)
    meta = get_last_call_meta()

    decision_val = consolidated["recommended_decision"]
    decision_str = decision_val.value if hasattr(decision_val, "value") else str(decision_val)

    if "NO" in decision_str.upper():
        dec_status = "red"
    elif "CONDITION" in decision_str.upper():
        dec_status = "amber"
    else:
        dec_status = "green"

    send({
        "type": "agent_finished",
        "id": "decision",
        "status": dec_status,
        "verdict": decision_str,
        "summary": str(consolidated.get("predicted_failure_mode", "")),
        "tokens": {"in": meta["tokens_in"], "out": meta["tokens_out"]},
        "time_ms": ms,
        "model": meta["model"],
        "research": [],
    })

    exposure_cr = consolidated.get("projected_financial_loss_cr", 0)
    send({
        "type": "run_finished",
        "decision": decision_str,
        "score": consolidated.get("overall_risk_score", 0),
        "conditions": consolidated.get("conditions", []),
        "exposure_range": f"₹{exposure_cr:.1f} Cr",
    })


def run_premortem(data: ProcurementInput) -> PreMortemReport:
    results = _run_parallel(data)

    consolidated = decision_board.consolidate(data, results)
    debate = build_debate(results)
    scenarios = scenario_agent.simulate(
        data,
        consolidated["predicted_delay_months"],
        consolidated["failure_probability_pct"],
    )

    return PreMortemReport(
        procurement_name=data.procurement_name,
        equipment_type=data.equipment_type,
        contract_value_cr=data.contract_value_cr,
        overall_risk_score=consolidated["overall_risk_score"],
        failure_probability_pct=consolidated["failure_probability_pct"],
        confidence_pct=consolidated["confidence_pct"],
        predicted_delay_months=consolidated["predicted_delay_months"],
        projected_financial_loss_cr=consolidated["projected_financial_loss_cr"],
        predicted_failure_mode=consolidated["predicted_failure_mode"],
        supporting_evidence=consolidated["supporting_evidence"],
        predicted_outcomes=consolidated["predicted_outcomes"],
        recommended_decision=consolidated["recommended_decision"],
        conditions=consolidated["conditions"],
        agent_results=results,
        debate=debate,
        scenarios=scenarios,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
