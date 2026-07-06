"""Agent orchestration.

Runs the PreMortem pipeline via LangGraph when available (Tier-2), otherwise
via the legacy sequential path. Specialist agents run in parallel with
timeout/retry resilience so one failure does not abort the run.
"""
from __future__ import annotations

from typing import List

from ..models import PreMortemReport, ProcurementInput
from ..services import bid_outputs, document_parser, input_bids
from . import bid_recommender_agent, contract_agent, premortem_flow
from .premortem_graph import langgraph_enabled, run_premortem_graph


def run_premortem(data: ProcurementInput) -> PreMortemReport:
    if langgraph_enabled():
        return run_premortem_graph(data)
    return premortem_flow.run_premortem_legacy(data)


def run_bid_evaluation(run_id: str, bid_id: str, quote_ids: List[str]) -> None:
    """Evaluate a bid run and persist status for the UI."""
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
