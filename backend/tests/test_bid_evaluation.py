"""Integration test helper for running bid evaluations from the backend.

This intentionally exercises the backend service/orchestrator path without the
Streamlit UI. It is skipped by default because it writes run outputs and may run
many bid evaluations.

Run all registered bids:

    RUN_BID_EVAL_TESTS=1 python -m unittest backend.tests.test_bid_evaluation

By default this test evaluates at most 2 bids and at most 5 quotes per bid.
Override only when intentionally running a larger evaluation:

    MAX_BIDS=10 MAX_QUOTES_PER_BID=20 RUN_BID_EVAL_TESTS=1 python -m unittest backend.tests.test_bid_evaluation

Run one bid:

    RUN_BID_EVAL_TESTS=1 BID_ID=BID-001 python -m unittest backend.tests.test_bid_evaluation

or:

    RUN_BID_EVAL_TESTS=1 BID_NUMBER=1 python -m unittest backend.tests.test_bid_evaluation
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.agents.orchestrator import run_bid_evaluation  # noqa: E402
from app.services import bid_outputs, input_bids  # noqa: E402


DEFAULT_MAX_BIDS = 2
DEFAULT_MAX_QUOTES_PER_BID = 5


def _requested_bid_id() -> str:
    bid_id = os.getenv("BID_ID", "").strip()
    if bid_id:
        return bid_id

    bid_number = os.getenv("BID_NUMBER", "").strip()
    if not bid_number:
        return ""
    return f"BID-{int(bid_number):03d}"


def _positive_int_env(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    value = int(raw)
    if value <= 0:
        raise ValueError(f"{name} must be positive")
    return value


@unittest.skipUnless(
    os.getenv("RUN_BID_EVAL_TESTS") == "1",
    "Set RUN_BID_EVAL_TESTS=1 to run backend bid evaluations.",
)
class BidEvaluationIntegrationTest(unittest.TestCase):
    def test_evaluate_registered_bids(self) -> None:
        max_bids = _positive_int_env("MAX_BIDS", DEFAULT_MAX_BIDS)
        max_quotes_per_bid = _positive_int_env(
            "MAX_QUOTES_PER_BID",
            DEFAULT_MAX_QUOTES_PER_BID,
        )
        input_bids.scan_inputs()
        bids = input_bids.list_bids()["bids"]
        requested_bid_id = _requested_bid_id()
        if requested_bid_id:
            bids = [bid for bid in bids if bid["bid_id"] == requested_bid_id]
        else:
            bids = bids[:max_bids]

        self.assertTrue(
            bids,
            f"No bids found for {requested_bid_id or 'registered bid database'}",
        )

        completed_runs = []
        with patch("app.agents.contract_agent.has_api_key", return_value=False):
            for bid in bids:
                bid_id = str(bid["bid_id"])
                quotes = input_bids.list_quotes(bid_id)["quotes"]
                quote_ids = [
                    quote["quote_id"]
                    for quote in quotes[:max_quotes_per_bid]
                ]
                if not quote_ids:
                    continue

                run = bid_outputs.create_run(bid_id, quote_ids)
                run_bid_evaluation(run["run_id"], bid_id, quote_ids)
                result = bid_outputs.get_result(run["run_id"])

                self.assertEqual(result["status"], "completed")
                self.assertEqual(result["bid_id"], bid_id)
                self.assertTrue(result["ranked_quotes"])
                completed_runs.append(run["run_id"])

        self.assertTrue(completed_runs, "No bid evaluations were completed.")


if __name__ == "__main__":
    unittest.main()
