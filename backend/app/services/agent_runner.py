"""Resilient agent execution — timeouts, retries, and partial results.

Prevents one slow or failing LLM call from aborting the entire PreMortem run.
Each specialist returns an ``AgentResult`` even on timeout/error (status
``failed``), so downstream consolidation and the Evaluator can still proceed.
"""
from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from typing import Callable

from ..agents.base import risk_level
from ..models import AgentResult, RiskLevel

DEFAULT_TIMEOUT_SEC = float(os.getenv("AGENT_TIMEOUT_SECONDS", "90"))
DEFAULT_MAX_RETRIES = int(os.getenv("AGENT_MAX_RETRIES", "2"))


def _failed_result(agent_name: str, error: str) -> AgentResult:
    return AgentResult(
        agent=agent_name,
        status="failed",
        risk_score=50,
        risk_level=risk_level(50),
        findings=[f"Agent did not complete: {error}"],
        evidence=[],
        reasoning="Partial run — this agent timed out or errored after retries.",
        recommendation="Re-run this agent or review manually before approval.",
        metrics={"error": error},
    )


def run_agent_resilient(
    agent_name: str,
    fn: Callable[..., AgentResult],
    *args,
    timeout: float | None = None,
    max_retries: int | None = None,
    **kwargs,
) -> AgentResult:
    """Run ``fn`` with per-attempt timeout and retries; never raises."""
    timeout_sec = DEFAULT_TIMEOUT_SEC if timeout is None else timeout
    retries = DEFAULT_MAX_RETRIES if max_retries is None else max_retries
    last_error = "unknown error"

    for attempt in range(retries + 1):
        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(fn, *args, **kwargs)
                return future.result(timeout=timeout_sec)
        except FuturesTimeoutError:
            last_error = (
                f"timeout after {timeout_sec}s "
                f"(attempt {attempt + 1}/{retries + 1})"
            )
        except Exception as exc:
            last_error = (
                f"{type(exc).__name__}: {exc} "
                f"(attempt {attempt + 1}/{retries + 1})"
            )

    return _failed_result(agent_name, last_error)
