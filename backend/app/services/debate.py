"""Generate the multi-agent debate (Screen 3).

Tier-2: two-round *reactive* debate.
  Round 1 (opening) — each agent states its primary finding.
  Round 2 (response) — each agent reacts to peer findings (agreement,
  challenge, or synthesis). Rule-based cross-references always run; an LLM
  may enrich response statements when an API key is configured.
"""
from __future__ import annotations

import json
from typing import Dict, List, Tuple

from ..models import AgentResult, DebateTurn
from ..services.llm import has_api_key, run_agent_llm

# (full agent name in AgentResult, short display label for UI)
_DEBATE_AGENTS: List[Tuple[str, str]] = [
    ("Infrastructure Readiness Agent", "Infrastructure Agent"),
    ("Contract Risk Agent", "Contract Agent"),
    ("Financial Exposure Agent", "Financial Agent"),
    ("Workforce Readiness Agent", "Workforce Agent"),
    ("Historical Intelligence Agent", "Historical Agent"),
]


def build_debate(results: List[AgentResult]) -> List[DebateTurn]:
    by_name: Dict[str, AgentResult] = {r.agent: r for r in results}
    turns: List[DebateTurn] = []

    for full_name, label in _DEBATE_AGENTS:
        agent = by_name.get(full_name)
        if not agent:
            continue
        turns.append(
            DebateTurn(
                agent=label,
                phase="opening",
                statements=_opening_statements(agent),
            )
        )

    for full_name, label in _DEBATE_AGENTS:
        agent = by_name.get(full_name)
        if not agent:
            continue
        turns.append(
            DebateTurn(
                agent=label,
                phase="response",
                statements=_reactive_statements(agent, by_name),
            )
        )

    enriched = _llm_enrich_responses(turns, results)
    return enriched if enriched else turns


def _opening_statements(agent: AgentResult) -> List[str]:
    """Primary position from the agent's own analysis."""
    if agent.findings:
        lead = agent.findings[0]
    elif agent.reasoning:
        lead = agent.reasoning[:200]
    else:
        lead = f"Risk score {agent.risk_score:.0f}/100 ({agent.risk_level.value})."

    statements = [lead]
    if len(agent.findings) > 1:
        statements.append(agent.findings[1])
    elif agent.recommendation:
        statements.append(agent.recommendation)
    return statements[:2]


def _reactive_statements(
    agent: AgentResult,
    by_name: Dict[str, AgentResult],
) -> List[str]:
    """Cross-agent reactions based on peer findings (deterministic)."""
    statements: List[str] = []
    infra = by_name.get("Infrastructure Readiness Agent")
    contract = by_name.get("Contract Risk Agent")
    fin = by_name.get("Financial Exposure Agent")
    workforce = by_name.get("Workforce Readiness Agent")
    hist = by_name.get("Historical Intelligence Agent")

    if agent.agent == "Infrastructure Readiness Agent":
        if contract and contract.risk_score >= 60:
            statements.append(
                "Contract Agent flags warranty/payment terms that worsen idle-site "
                "exposure — I agree delivery should not proceed at current readiness."
            )
        if fin and fin.metrics.get("projected_loss_cr", 0) > 0:
            statements.append(
                f"Financial Agent projects ₹{fin.metrics['projected_loss_cr']:.2f} Cr "
                "loss if we proceed — aligns with my delay prediction."
            )

    elif agent.agent == "Contract Risk Agent":
        if infra and infra.risk_score >= 60:
            delay = infra.metrics.get("delay_range", "several months")
            statements.append(
                f"Infrastructure Agent confirms site readiness gaps with {delay} "
                "delay — warranty-on-delivery terms become critical."
            )
        if hist and hist.metrics.get("vendor_debarment_match"):
            statements.append(
                "Historical Agent found a vendor debarment match — contract terms "
                "must include stronger safeguards before any award."
            )

    elif agent.agent == "Financial Exposure Agent":
        if infra:
            delay = infra.metrics.get("predicted_delay_months", "?")
            statements.append(
                f"Infrastructure's {delay}-month delay directly drives my idle-cost "
                "and advance-exposure calculations."
            )
        if contract:
            statements.append(
                "Contract Agent's payment/warranty findings increase the probability "
                "funds are committed before value is realised."
            )

    elif agent.agent == "Workforce Readiness Agent":
        if infra and infra.risk_score >= 60:
            statements.append(
                "Even if Infrastructure eventually completes the site, operator "
                "gaps mean utilisation risk remains after installation."
            )
        gap = agent.metrics.get("operator_gap", 0)
        if gap and fin:
            statements.append(
                f"With {gap} operators short and ₹{fin.metrics.get('advance_cr', 0):.2f} "
                "Cr advance at risk, idle equipment is likely post-installation too."
            )

    elif agent.agent == "Historical Intelligence Agent":
        if hist and hist.metrics.get("vendor_debarment_match"):
            statements.append(
                "Vendor screening hit is decisive — precedent alone would caution "
                "against award; debarment elevates this to a hard stop."
            )
        if infra and hist:
            avg = hist.metrics.get("avg_delay_months", "?")
            statements.append(
                f"Current readiness pattern matches historical delays (~{avg} months); "
                "Infrastructure Agent's assessment is consistent with precedent."
            )

    if not statements:
        high_risk_peers = [
            r.agent.split()[0]
            for r in by_name.values()
            if r.agent != agent.agent and r.risk_score >= 70
        ]
        if high_risk_peers:
            statements.append(
                "I align with peer concerns from "
                + ", ".join(high_risk_peers)
                + " — combined risk supports a cautious decision."
            )
        else:
            statements.append(
                "Peer findings are moderate; my assessment still warrants "
                "the conditions I recommended."
            )

    return statements[:2]


def _llm_enrich_responses(
    turns: List[DebateTurn],
    results: List[AgentResult],
) -> List[DebateTurn] | None:
    """Optional LLM pass to rewrite response-round statements."""
    if not has_api_key():
        return None

    payload = {
        "agent_results": [
            {
                "agent": r.agent,
                "risk_score": r.risk_score,
                "findings": r.findings[:3],
                "recommendation": r.recommendation,
            }
            for r in results
        ],
        "opening_turns": [
            {"agent": t.agent, "statements": t.statements}
            for t in turns
            if t.phase == "opening"
        ],
    }
    instructions = (
        "You simulate a procurement review board debate. Given specialist agent "
        "outputs and opening statements, write ONE reactive response statement "
        "per agent (Infrastructure, Contract, Financial, Workforce, Historical). "
        "Each response must reference at least one peer finding. "
        'Return JSON: {"responses": {"Infrastructure Agent": "...", ...}}'
    )
    llm = run_agent_llm(
        name="Debate Room",
        instructions=instructions,
        user_payload=json.dumps(payload),
        temperature=0.3,
    )
    if not llm or not isinstance(llm.get("responses"), dict):
        return None

    responses: Dict[str, str] = llm["responses"]
    enriched: List[DebateTurn] = []
    for turn in turns:
        if turn.phase != "response":
            enriched.append(turn)
            continue
        llm_line = responses.get(turn.agent)
        if llm_line and isinstance(llm_line, str):
            enriched.append(
                DebateTurn(
                    agent=turn.agent,
                    phase="response",
                    statements=[llm_line.strip(), *turn.statements[:1]],
                )
            )
        else:
            enriched.append(turn)
    return enriched
