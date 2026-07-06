"""Shared PreMortem pipeline steps (used by orchestrator and LangGraph)."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import List

from ..models import (
    AgentResult,
    DebateTurn,
    EvaluationResult,
    PreMortemReport,
    ProcurementInput,
    ScenarioOutcome,
)
from ..services.agent_runner import run_agent_resilient
from ..services.debate import build_debate
from . import (
    contract_agent,
    decision_board,
    evaluator_agent,
    financial_agent,
    historical_agent,
    infrastructure_agent,
    scenario_agent,
    workforce_agent,
)


def run_parallel_resilient(data: ProcurementInput) -> List[AgentResult]:
    """Execute specialist agents concurrently with timeout/retry resilience."""
    with ThreadPoolExecutor(max_workers=5) as executor:
        f_contract = executor.submit(
            run_agent_resilient,
            contract_agent.NAME,
            contract_agent.analyze,
            data,
        )
        f_infra = executor.submit(
            run_agent_resilient,
            infrastructure_agent.NAME,
            infrastructure_agent.analyze,
            data,
        )
        f_workforce = executor.submit(
            run_agent_resilient,
            workforce_agent.NAME,
            workforce_agent.analyze,
            data,
        )
        f_historical = executor.submit(
            run_agent_resilient,
            historical_agent.NAME,
            historical_agent.analyze,
            data,
        )
        infra_result = f_infra.result()
        predicted_delay = infra_result.metrics.get("predicted_delay_months", 8.0)
        f_financial = executor.submit(
            run_agent_resilient,
            financial_agent.NAME,
            financial_agent.analyze,
            data,
            predicted_delay,
        )
        return [
            f_contract.result(),
            infra_result,
            f_workforce.result(),
            f_financial.result(),
            f_historical.result(),
        ]


def build_report(
    data: ProcurementInput,
    results: List[AgentResult],
    consolidated: dict,
    debate: List[DebateTurn],
    scenarios: List[ScenarioOutcome],
    evaluation: EvaluationResult,
) -> PreMortemReport:
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
        evaluation=evaluation,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


def run_premortem_legacy(data: ProcurementInput) -> PreMortemReport:
    """Sequential pipeline (fallback when LangGraph is disabled)."""
    results = run_parallel_resilient(data)
    consolidated = decision_board.consolidate(data, results)
    debate = build_debate(results)
    scenarios = scenario_agent.simulate(
        data,
        consolidated["predicted_delay_months"],
        consolidated["failure_probability_pct"],
    )
    evaluation = evaluator_agent.evaluate(results, consolidated)
    return build_report(data, results, consolidated, debate, scenarios, evaluation)
