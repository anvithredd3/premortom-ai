"""Bid Recommender Agent.

Compares reviewed vendor quotes for one bid and recommends a winner/shortlist.
The core ranking is deterministic so the demo remains useful without API keys;
an LLM can enrich the explanation when configured.
"""
from __future__ import annotations

import json
from typing import Dict, List

from ..services.llm import has_api_key, run_agent_llm
from ..services.okf_memory import select_okf_memory

NAME = "Bid Recommender Agent"

INSTRUCTIONS = """
You are the Bid Recommender Agent for a public procurement review.
Compare only the quotes in the provided bid payload.
Use the contract review findings as evidence, not as decoration.

Return one JSON object with these keys:
- rationale: string
- feedback: list of strings
- negotiation_points: list of strings

Keep the recommendation practical, audit-friendly, and concise.
Do not invent prices, certifications, or vendor facts that are not present.
"""


def recommend(
    *,
    run_id: str,
    bid_id: str,
    reviews: List[Dict[str, object]],
    market_research: Dict[str, object] | None = None,
) -> Dict[str, object]:
    """Return the bid recommendation artifact payload."""
    ranked = sorted(reviews, key=_ranking_key)
    winner = ranked[0] if ranked else {}
    shortlist = ranked[: min(3, len(ranked))]

    result = {
        "run_id": run_id,
        "bid_id": bid_id,
        "status": "completed",
        "agent": NAME,
        "winner": winner,
        "ranked_quotes": ranked,
        "shortlist": shortlist,
        "rationale": _default_rationale(winner, ranked),
        "feedback": _default_feedback(winner, ranked),
        "negotiation_points": _default_negotiation_points(winner),
        "artifact_refs": [
            "artifact_vendor_proposal",
            "artifact_market_research",
            "artifact_bid_recommendation",
            "artifact_contract_review",
        ],
    }

    if market_research:
        result["market_research_summary"] = _market_research_summary(market_research)

    llm_result = _llm_enrichment(bid_id, ranked, winner, market_research or {})
    if llm_result:
        for key in ("rationale", "feedback", "negotiation_points"):
            value = llm_result.get(key)
            if value:
                result[key] = value

    return result


def _ranking_key(review: Dict[str, object]) -> tuple:
    risk_score = float(review.get("risk_score") or 100)
    finding_count = len(review.get("findings") or [])
    quote_id = str(review.get("quote_id") or "")
    return (risk_score, finding_count, quote_id)


def _default_rationale(
    winner: Dict[str, object],
    ranked: List[Dict[str, object]],
) -> str:
    if not winner:
        return "No eligible quotes were reviewed."

    winner_id = winner.get("quote_id", "selected quote")
    winner_score = winner.get("risk_score", "unknown")
    if len(ranked) == 1:
        return (
            f"{winner_id} is the only reviewed quote and carries a contract "
            f"risk score of {winner_score}."
        )

    runner_up = ranked[1]
    return (
        f"{winner_id} is recommended because it has the lowest reviewed "
        f"contract risk score ({winner_score}) among {len(ranked)} quotes. "
        f"The next best quote is {runner_up.get('quote_id', 'unknown')} "
        f"with risk score {runner_up.get('risk_score', 'unknown')}."
    )


def _default_feedback(
    winner: Dict[str, object],
    ranked: List[Dict[str, object]],
) -> List[str]:
    if not ranked:
        return ["No quote reviews were available for recommendation."]

    feedback = [
        "Ranking is based on contract review risk, with lower risk preferred.",
    ]
    if winner.get("findings"):
        feedback.append(
            "Recommended quote still needs review of: "
            + "; ".join(str(item) for item in winner["findings"][:2])
        )
    weaker = ranked[1:3]
    if weaker:
        downgraded = ", ".join(str(item.get("quote_id", "unknown")) for item in weaker)
        feedback.append(f"Downgraded quotes with higher reviewed risk: {downgraded}.")
    return feedback


def _default_negotiation_points(winner: Dict[str, object]) -> List[str]:
    if not winner:
        return ["Collect complete quote reviews before negotiation."]

    points = [
        "Confirm delivery, installation, warranty, and payment milestones before award.",
        "Convert any ambiguous contract obligations into measurable acceptance criteria.",
    ]
    recommendation = winner.get("recommendation")
    if recommendation:
        points.append(str(recommendation))
    return points


def _llm_enrichment(
    bid_id: str,
    ranked: List[Dict[str, object]],
    winner: Dict[str, object],
    market_research: Dict[str, object],
) -> Dict[str, object]:
    if not has_api_key() or not ranked:
        return {}

    payload = {
        "bid_id": bid_id,
        "winner": winner,
        "ranked_quotes": ranked,
        "market_research": market_research,
    }
    memory = select_okf_memory(
        json.dumps(payload),
        agent_id="bid_recommender_agent",
        max_chunks=8,
    )
    instructions = INSTRUCTIONS
    if memory:
        instructions = (
            f"{INSTRUCTIONS}\n\n"
            "# Bid Recommender OKF memory selected for this explanation\n"
            f"{memory}\n"
        )
    result = run_agent_llm(
        name=NAME,
        instructions=instructions,
        user_payload=json.dumps(payload),
        temperature=0.1,
    )
    return result or {}


def _market_research_summary(market_research: Dict[str, object]) -> Dict[str, object]:
    return {
        "provider": market_research.get("provider", ""),
        "status": market_research.get("status", "completed"),
        "retrieved_at": market_research.get("retrieved_at", ""),
        "market_price_range": market_research.get("market_price_range", {}),
        "typical_terms": market_research.get("typical_terms", {}),
        "red_flags": market_research.get("red_flags", []),
        "limitations": market_research.get("limitations", []),
    }
