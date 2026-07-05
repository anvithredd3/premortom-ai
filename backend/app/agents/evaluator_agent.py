"""Evaluator Agent — quality gate over the whole agentic run.

The Evaluator does not analyse procurement risk itself. It reviews the *output
quality* of the specialist agents and the consolidated decision, then decides
whether the package is ready for human review. This gives the platform a
workflow-governance layer instead of trusting raw agent output.

It is deliberately deterministic (works offline and online); an LLM only
enriches the plain-language summary when a key is present. See
``backend/agent_profiles/evaluator_agent_profile.md``.
"""
from __future__ import annotations

import json
from statistics import pstdev
from typing import Dict, List

from ..models import (
    AgentResult,
    EvaluationCheck,
    EvaluationResult,
    ReadinessStatus,
)
from ..services.llm import has_api_key, run_agent_llm

NAME = "Evaluator Agent"

# Specialists we expect to have contributed to a complete PreMortem run.
EXPECTED_AGENTS = {
    "Contract Risk Agent",
    "Infrastructure Readiness Agent",
    "Workforce Readiness Agent",
    "Financial Exposure Agent",
    "Historical Intelligence Agent",
}


def evaluate(results: List[AgentResult], consolidated: Dict[str, object]) -> EvaluationResult:
    checks: List[EvaluationCheck] = []
    flags: List[str] = []
    actions: List[str] = []

    present = {r.agent for r in results}
    offline = [r.agent for r in results if r.status == "offline"]

    # 1. Completeness -------------------------------------------------------
    missing = sorted(EXPECTED_AGENTS - present)
    if missing:
        checks.append(
            EvaluationCheck(
                name="Completeness",
                status="fail",
                detail=f"Missing agents: {', '.join(missing)}.",
            )
        )
        flags.append("Not all specialist agents completed.")
        actions.append("Re-run the missing agents before approval.")
    else:
        checks.append(
            EvaluationCheck(
                name="Completeness",
                status="pass",
                detail=f"All {len(EXPECTED_AGENTS)} specialist agents reported.",
            )
        )

    # 2. Live mode ----------------------------------------------------------
    if offline:
        checks.append(
            EvaluationCheck(
                name="Analysis mode",
                status="warn",
                detail=f"{len(offline)} agent(s) ran offline (rule-based stub).",
            )
        )
        flags.append("Run executed without an API key; reasoning is limited.")
        actions.append("Configure an API key to enable full agentic reasoning.")
    else:
        checks.append(
            EvaluationCheck(
                name="Analysis mode",
                status="pass",
                detail="All agents ran in live (agentic) mode.",
            )
        )

    # 3. Evidence quality ---------------------------------------------------
    no_evidence = [r.agent for r in results if not r.evidence]
    no_findings = [r.agent for r in results if not r.findings]
    if no_evidence or no_findings:
        weak = sorted(set(no_evidence) | set(no_findings))
        checks.append(
            EvaluationCheck(
                name="Evidence quality",
                status="warn" if len(weak) < len(results) else "fail",
                detail=f"Thin/unsupported output from: {', '.join(weak)}.",
            )
        )
        flags.append("Some agents produced conclusions without evidence.")
        actions.append(
            "Request supporting evidence from: " + ", ".join(weak) + "."
        )
    else:
        checks.append(
            EvaluationCheck(
                name="Evidence quality",
                status="pass",
                detail="Every agent attached findings and evidence.",
            )
        )

    # 4. Consistency / agreement -------------------------------------------
    scores = [r.risk_score for r in results]
    spread = (max(scores) - min(scores)) if scores else 0.0
    std = pstdev(scores) if len(scores) > 1 else 0.0
    if spread >= 45:
        checks.append(
            EvaluationCheck(
                name="Consistency",
                status="warn",
                detail=f"Agents disagree sharply (spread {spread:.0f}, σ {std:.0f}).",
            )
        )
        flags.append("Wide disagreement between agents lowers confidence.")
        actions.append("Have the human reviewer reconcile conflicting agent scores.")
    else:
        checks.append(
            EvaluationCheck(
                name="Consistency",
                status="pass",
                detail=f"Agent scores are coherent (spread {spread:.0f}).",
            )
        )

    # 5. Decision support ---------------------------------------------------
    decision = str(consolidated.get("recommended_decision", ""))
    conditions = consolidated.get("conditions") or []
    if "CONDITION" in decision.upper() and not conditions:
        checks.append(
            EvaluationCheck(
                name="Decision support",
                status="fail",
                detail="Conditional decision has no stated conditions.",
            )
        )
        flags.append("Conditional GO lacks explicit approval conditions.")
        actions.append("Define measurable approval conditions.")
    else:
        checks.append(
            EvaluationCheck(
                name="Decision support",
                status="pass",
                detail=f"Decision '{decision}' is backed by consolidated evidence.",
            )
        )

    # --- Score + readiness -------------------------------------------------
    weights = {"pass": 1.0, "warn": 0.6, "fail": 0.0}
    quality_score = round(
        100 * sum(weights[c.status] for c in checks) / (len(checks) or 1)
    )
    has_fail = any(c.status == "fail" for c in checks)
    if missing or (offline and len(offline) == len(results)):
        readiness = ReadinessStatus.INSUFFICIENT
    elif has_fail or quality_score < 70:
        readiness = ReadinessStatus.NEEDS_REVISION
    else:
        readiness = ReadinessStatus.READY

    if not actions:
        actions.append("Proceed to human review; no quality issues detected.")

    summary = _default_summary(readiness, quality_score, flags)
    llm_summary = _llm_summary(checks, consolidated, readiness)
    if llm_summary:
        summary = llm_summary

    return EvaluationResult(
        readiness_status=readiness,
        quality_score=quality_score,
        checks=checks,
        quality_flags=flags,
        recommended_actions=actions,
        summary=summary,
    )


def _default_summary(
    readiness: ReadinessStatus, score: float, flags: List[str]
) -> str:
    base = f"Quality score {score:.0f}/100 — {readiness.value.lower()}."
    if flags:
        return base + " Key concerns: " + " ".join(flags)
    return base + " Output is evidence-backed and internally consistent."


def _llm_summary(
    checks: List[EvaluationCheck],
    consolidated: Dict[str, object],
    readiness: ReadinessStatus,
) -> str:
    if not has_api_key():
        return ""
    instructions = (
        "You are the Evaluator Agent, a quality gate for an agentic procurement "
        "review board. Given the automated quality checks and the consolidated "
        "decision, write a concise, audit-friendly readiness summary (2-3 "
        "sentences) for a human approver. Do not invent new findings. "
        'Return JSON: {"summary": "..."}'
    )
    payload = {
        "readiness_status": readiness.value,
        "checks": [c.model_dump() for c in checks],
        "decision": consolidated.get("recommended_decision"),
        "overall_risk_score": consolidated.get("overall_risk_score"),
    }
    result = run_agent_llm(
        name=NAME,
        instructions=instructions,
        user_payload=json.dumps(payload),
        temperature=0.1,
    )
    if result and isinstance(result.get("summary"), str):
        return result["summary"].strip()
    return ""
