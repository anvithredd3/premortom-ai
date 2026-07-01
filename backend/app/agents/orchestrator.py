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
from ..services import bid_outputs, document_parser, input_bids
from ..services.debate import build_debate
from ..services.llm import get_last_call_meta
from . import (
    bid_recommender_agent,
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
            vendor_proposals.append(
                {
                    "quote_id": quote_id,
                    "fixed_features": {
                        "vendor_name": {
                            "value": quote.get("vendor_name", ""),
                            "status": "found" if quote.get("vendor_name") else "missing",
                            "confidence": 1.0 if quote.get("vendor_name") else 0.0,
                            "evidence": "bids_database.csv",
                        },
                        "equipment_type": {
                            "value": quote.get("equipment_type", ""),
                            "status": "found" if quote.get("equipment_type") else "missing",
                            "confidence": 1.0 if quote.get("equipment_type") else 0.0,
                            "evidence": "bids_database.csv",
                        },
                    },
                    "proposal_text": {
                        "raw_text": text,
                        "text_preview": text[:2000],
                        "char_count": len(text),
                        "source_pdf_path": str(pdf_path),
                    },
                    "proposal_intelligence": {},
                    "raw_text_reference": {
                        "pdf_path": quote["pdf_path"],
                        "full_text_available": bool(text),
                    },
                }
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
            result = contract_agent.analyze(data)
            review = {
                "quote_id": quote_id,
                "vendor_name": quote.get("vendor_name", ""),
                "risk_score": result.risk_score,
                "risk_level": result.risk_level.value,
                "findings": result.findings,
                "recommendation": result.recommendation,
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
            "Comparing reviewed quotes",
        )
        result = bid_recommender_agent.recommend(
            run_id=run_id,
            bid_id=bid_id,
            reviews=reviews,
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
