"""LangGraph workflow for the PreMortem pipeline (Tier-2)."""
from __future__ import annotations

import os
from typing import List, TypedDict

from ..models import (
    AgentResult,
    DebateTurn,
    EvaluationResult,
    PreMortemReport,
    ProcurementInput,
    ScenarioOutcome,
)
from ..services.debate import build_debate
from . import decision_board, evaluator_agent, scenario_agent
from .premortem_flow import build_report, run_parallel_resilient

_GRAPH = None


class PremortemState(TypedDict, total=False):
    data: ProcurementInput
    results: List[AgentResult]
    consolidated: dict
    debate: List[DebateTurn]
    scenarios: List[ScenarioOutcome]
    evaluation: EvaluationResult
    report: PreMortemReport


def langgraph_enabled() -> bool:
    if os.getenv("USE_LANGGRAPH", "1").lower() in {"0", "false", "no"}:
        return False
    try:
        import langgraph  # noqa: F401
        return True
    except ImportError:
        return False


def _node_specialists(state: PremortemState) -> dict:
    return {"results": run_parallel_resilient(state["data"])}


def _node_consolidate(state: PremortemState) -> dict:
    return {
        "consolidated": decision_board.consolidate(state["data"], state["results"])
    }


def _node_debate(state: PremortemState) -> dict:
    return {"debate": build_debate(state["results"])}


def _node_scenarios(state: PremortemState) -> dict:
    consolidated = state["consolidated"]
    return {
        "scenarios": scenario_agent.simulate(
            state["data"],
            consolidated["predicted_delay_months"],
            consolidated["failure_probability_pct"],
        )
    }


def _node_evaluate(state: PremortemState) -> dict:
    return {
        "evaluation": evaluator_agent.evaluate(
            state["results"], state["consolidated"]
        )
    }


def _node_report(state: PremortemState) -> dict:
    return {
        "report": build_report(
            state["data"],
            state["results"],
            state["consolidated"],
            state["debate"],
            state["scenarios"],
            state["evaluation"],
        )
    }


def _build_graph():
    from langgraph.graph import END, StateGraph

    graph = StateGraph(PremortemState)
    graph.add_node("specialists", _node_specialists)
    graph.add_node("consolidate", _node_consolidate)
    graph.add_node("debate", _node_debate)
    graph.add_node("scenarios", _node_scenarios)
    graph.add_node("evaluate", _node_evaluate)
    graph.add_node("report", _node_report)

    graph.set_entry_point("specialists")
    graph.add_edge("specialists", "consolidate")
    graph.add_edge("consolidate", "debate")
    graph.add_edge("debate", "scenarios")
    graph.add_edge("scenarios", "evaluate")
    graph.add_edge("evaluate", "report")
    graph.add_edge("report", END)
    return graph.compile()


def _get_graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = _build_graph()
    return _GRAPH


def run_premortem_graph(data: ProcurementInput) -> PreMortemReport:
    final = _get_graph().invoke({"data": data})
    report = final.get("report")
    if report is None:
        raise RuntimeError("LangGraph PreMortem run did not produce a report.")
    return report
