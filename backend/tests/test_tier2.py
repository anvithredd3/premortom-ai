"""Unit tests for Tier-2 reactive debate and resilient agent runner."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.agents.base import risk_level  # noqa: E402
from app.models import AgentResult, RiskLevel  # noqa: E402
from app.services.agent_runner import run_agent_resilient  # noqa: E402
from app.services.debate import build_debate  # noqa: E402


def _sample_results() -> list[AgentResult]:
    return [
        AgentResult(
            agent="Infrastructure Readiness Agent",
            risk_score=85,
            risk_level=RiskLevel.CRITICAL,
            findings=["Site only 60% ready"],
            evidence=["construction_completion_pct=60"],
            reasoning="Installation blocked",
            recommendation="Delay delivery",
            metrics={
                "readiness_pct": 60,
                "predicted_delay_months": 9,
                "delay_range": "8-10 months",
            },
        ),
        AgentResult(
            agent="Contract Risk Agent",
            risk_score=75,
            risk_level=RiskLevel.HIGH,
            findings=["Warranty starts on delivery"],
            evidence=["warranty_start=On Delivery"],
            reasoning="Coverage erodes during delay",
            recommendation="Revise warranty terms",
            metrics={"warranty_start": "On Delivery"},
        ),
        AgentResult(
            agent="Financial Exposure Agent",
            risk_score=80,
            risk_level=RiskLevel.CRITICAL,
            findings=["High advance released early"],
            evidence=["advance_cr=10.8"],
            reasoning="Funds at risk",
            recommendation="Reduce advance",
            metrics={"advance_cr": 10.8, "projected_loss_cr": 2.5},
        ),
        AgentResult(
            agent="Workforce Readiness Agent",
            risk_score=70,
            risk_level=RiskLevel.HIGH,
            findings=["6 operators required, 0 available"],
            evidence=["technicians gap"],
            reasoning="No operators",
            recommendation="Hire technicians",
            metrics={"operator_gap": 6},
        ),
        AgentResult(
            agent="Historical Intelligence Agent",
            risk_score=85,
            risk_level=RiskLevel.CRITICAL,
            findings=["DEBARMENT MATCH: Apex Infra Builders"],
            evidence=["worldbank_debarred_SAMPLE.csv"],
            reasoning="Vendor flagged",
            recommendation="Do not award",
            metrics={"vendor_debarment_match": True, "avg_delay_months": 9},
        ),
    ]


class ReactiveDebateTest(unittest.TestCase):
    def test_two_round_debate_structure(self) -> None:
        debate = build_debate(_sample_results())
        openings = [t for t in debate if t.phase == "opening"]
        responses = [t for t in debate if t.phase == "response"]
        self.assertEqual(len(openings), 5)
        self.assertEqual(len(responses), 5)

    def test_response_references_peers(self) -> None:
        debate = build_debate(_sample_results())
        contract_response = next(
            t for t in debate
            if t.agent == "Contract Agent" and t.phase == "response"
        )
        joined = " ".join(contract_response.statements).lower()
        self.assertTrue(
            "infrastructure" in joined or "historical" in joined,
            msg=f"Expected peer reference in: {joined}",
        )


class AgentRunnerTest(unittest.TestCase):
    def test_timeout_returns_failed_result(self) -> None:
        def slow_agent() -> AgentResult:
            import time
            time.sleep(5)
            return AgentResult(
                agent="Slow Agent",
                risk_score=10,
                risk_level=risk_level(10),
            )

        with patch.dict("os.environ", {"AGENT_TIMEOUT_SECONDS": "0.1", "AGENT_MAX_RETRIES": "0"}):
            # Re-import defaults after env patch would need module reload;
            # pass explicit timeout instead.
            result = run_agent_resilient(
                "Slow Agent",
                slow_agent,
                timeout=0.1,
                max_retries=0,
            )
        self.assertEqual(result.status, "failed")
        self.assertIn("timeout", result.metrics.get("error", ""))


if __name__ == "__main__":
    unittest.main()
