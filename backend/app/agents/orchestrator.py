"""Agent orchestration.

Runs all five specialist analysis agents in parallel, then the Scenario
Simulation Agent and finally the Decision Board Agent. When ``langgraph`` is
installed the flow is expressed as a graph; otherwise we use a thread pool,
preserving identical behaviour.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import List

from ..models import AgentResult, PreMortemReport, ProcurementInput
from ..services import bid_outputs, document_parser, input_bids, market_research
from ..services.debate import build_debate
from . import (
    bid_recommender_agent,
    contract_agent,
    decision_board,
    financial_agent,
    historical_agent,
    infrastructure_agent,
    scenario_agent,
    vendor_proposal_agent,
    workforce_agent,
)


def _run_parallel(data: ProcurementInput) -> List[AgentResult]:
    """Execute the independent specialist agents concurrently."""
    with ThreadPoolExecutor(max_workers=5) as ex:
        f_contract = ex.submit(contract_agent.analyze, data)
        f_infra = ex.submit(infrastructure_agent.analyze, data)
        f_workforce = ex.submit(workforce_agent.analyze, data)
        f_historical = ex.submit(historical_agent.analyze, data)
        infra_result = _safe_agent_result(infrastructure_agent, f_infra)
        predicted_delay = infra_result.metrics.get("predicted_delay_months", 8.0)
        # Financial agent depends on infra's delay prediction.
        f_financial = ex.submit(
            financial_agent.analyze, data, predicted_delay
        )
        results = [
            _safe_agent_result(contract_agent, f_contract),
            infra_result,
            _safe_agent_result(workforce_agent, f_workforce),
            _safe_agent_result(financial_agent, f_financial),
            _safe_agent_result(historical_agent, f_historical),
        ]
    return results


def _safe_agent_result(agent_module, future) -> AgentResult:
    try:
        return future.result()
    except Exception as exc:
        fallback = getattr(agent_module, "_offline_result", None)
        if not callable(fallback):
            raise
        result = fallback()
        result.status = "offline"
        result.findings = [
            *result.findings,
            "Non-agentic fallback output used for now because live LLM analysis failed.",
            f"Failure reason: {exc}",
        ]
        result.reasoning = (
            f"{result.reasoning}\n\n"
            "This is deterministic fallback output, not live agentic LLM output."
        ).strip()
        result.metrics = {
            **result.metrics,
            "fallback_reason": str(exc),
            "agentic_output": False,
        }
        return result


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


def run_bid_evaluation(run_id: str, bid_id: str, quote_ids: List[str]) -> None:
    """Evaluate a bid run and persist status for the UI.

    This is the first backend skeleton for the bid workflow. It uses the
    existing Contract Risk Agent for per-quote review, then asks the Bid
    Recommender Agent to rank quotes and produce the decision artifact.
    """
    try:
        bid_outputs.set_running(run_id)
        bid_outputs.update_agent(
            run_id,
            "bid_recommender",
            "running",
            "Preparing quote review plan",
        )
        quote_rows = input_bids.get_quote_rows(bid_id, quote_ids)
        reviews = []
        vendor_proposals = []

        for quote in quote_rows:
            quote_id = quote["quote_id"]
            bid_outputs.update_quote(run_id, quote_id, "running")
            bid_outputs.update_agent(
                run_id,
                "vendor_proposal",
                "running",
                f"Extracting proposal text for {quote_id}",
            )
            bid_outputs.update_agent(
                run_id,
                "contract_review",
                "running",
                f"Reviewing {quote_id}",
            )
            pdf_path = input_bids.SAMPLES_DIR / quote["pdf_path"]
            content = pdf_path.read_bytes()
            text = document_parser.extract_text(pdf_path.name, content)
            extracted_fields = document_parser.extract_fields(text)
            vendor_proposals.append(
                vendor_proposal_agent.analyze_quote(
                    quote=quote,
                    raw_text=text,
                    source_pdf_path=str(pdf_path),
                )
            )
            bid_outputs.write_vendor_proposals(run_id, vendor_proposals)
            bid_outputs.update_agent(
                run_id,
                "vendor_proposal",
                "completed",
                f"Proposal text extracted for {quote_id}",
            )
            data = ProcurementInput(
                procurement_name=quote.get("procurement_name") or bid_id,
                equipment_type=quote.get("equipment_type") or "Medical Equipment",
                raw_document_text=text,
            )
            try:
                result = contract_agent.analyze(data)
            except Exception as exc:
                result = contract_agent._offline_result()
                result.findings = [
                    *result.findings,
                    "Non-agentic fallback output used for now because live LLM analysis failed.",
                    f"Failure reason: {exc}",
                ]
                result.reasoning = (
                    f"{result.reasoning}\n\n"
                    "This is deterministic fallback output, not live agentic LLM output."
                ).strip()
                result.metrics = {
                    **result.metrics,
                    "fallback_reason": str(exc),
                    "agentic_output": False,
                }
            review = {
                "quote_id": quote_id,
                "vendor_name": quote.get("vendor_name", ""),
                "risk_score": result.risk_score,
                "risk_level": result.risk_level.value,
                "findings": result.findings,
                "recommendation": result.recommendation,
                "contract_value_cr": extracted_fields.get("contract_value_cr"),
            }
            reviews.append(review)
            bid_outputs.write_contract_reviews(run_id, reviews)
            bid_outputs.update_quote(
                run_id,
                quote_id,
                "completed",
                vendor_name=quote.get("vendor_name", ""),
                risk_score=result.risk_score,
            )

        bid_outputs.update_agent(
            run_id,
            "bid_recommender",
            "running",
            "Preparing market benchmarks",
        )
        market_result = market_research.research_bid_market(
            bid_id=bid_id,
            equipment_type=_first_value(quote_rows, "equipment_type", "Medical Equipment"),
            procurement_name=_first_value(quote_rows, "procurement_name", bid_id),
            quote_summaries=_quote_summaries(quote_rows, vendor_proposals, reviews),
        )
        bid_outputs.write_market_research(run_id, market_result)
        bid_outputs.update_agent(
            run_id,
            "market_research",
            "completed",
            (
                "Market research skipped"
                if market_result.get("status") == "skipped"
                else "Market benchmarks prepared"
            ),
        )
        bid_outputs.update_agent(
            run_id,
            "bid_recommender",
            "running",
            "Comparing reviewed quotes",
        )
        result = bid_recommender_agent.recommend(
            run_id=run_id,
            bid_id=bid_id,
            reviews=reviews,
            market_research=market_result,
        )
        bid_outputs.update_agent(
            run_id,
            "decision_logic",
            "completed",
            "Recommendation prepared",
        )
        bid_outputs.complete_run(run_id, result)
    except Exception as exc:
        bid_outputs.fail_run(run_id, str(exc))


def _first_value(rows: List[dict], key: str, fallback: str) -> str:
    for row in rows:
        value = row.get(key)
        if value:
            return str(value)
    return fallback


def _quote_summaries(
    quote_rows: List[dict],
    vendor_proposals: List[dict],
    reviews: List[dict],
) -> List[dict]:
    proposals_by_id = {item["quote_id"]: item for item in vendor_proposals}
    reviews_by_id = {item["quote_id"]: item for item in reviews}
    summaries = []
    for quote in quote_rows:
        quote_id = quote["quote_id"]
        proposal = proposals_by_id.get(quote_id, {})
        review = reviews_by_id.get(quote_id, {})
        text = proposal.get("proposal_text", {}).get("text_preview", "")
        summaries.append(
            {
                "quote_id": quote_id,
                "vendor_name": quote.get("vendor_name", ""),
                "equipment_type": quote.get("equipment_type", ""),
                "procurement_name": quote.get("procurement_name", ""),
                "risk_score": review.get("risk_score"),
                "risk_level": review.get("risk_level", ""),
                "findings": review.get("findings", [])[:5],
                "recommendation": review.get("recommendation", ""),
                "text_preview": text[:1200],
            }
        )
    return summaries
