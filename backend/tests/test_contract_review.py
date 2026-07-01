"""Call the backend API to run a bid contract-review evaluation.

This is a lightweight integration helper for local testing against a running
FastAPI server.

Start the backend first from the repo root:

    python -m uvicorn backend.app.main:app --reload --port 8000

Then run one bid evaluation:

    python backend/tests/test_contract_review.py --bid-id BID-001

or:

    python backend/tests/test_contract_review.py --bid-number 1

By default the helper evaluates only the first quote for token safety. Use
`--max-quotes` or `--all-quotes` only when you intentionally want a larger run.
"""
from __future__ import annotations

import argparse
import sys
import time
from typing import Any, Dict

import requests


DEFAULT_API = "http://localhost:8000"
TERMINAL_STATES = {"completed", "failed", "cancelled"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run one bid evaluation via FastAPI.")
    parser.add_argument("--api", default=DEFAULT_API, help="FastAPI base URL.")
    parser.add_argument("--bid-id", help="Bid id, for example BID-001.")
    parser.add_argument("--bid-number", type=int, help="Bid number, for example 1.")
    parser.add_argument(
        "--quote-id",
        action="append",
        default=[],
        help="Optional quote id. Repeat to evaluate multiple specific quotes.",
    )
    parser.add_argument(
        "--max-quotes",
        type=int,
        default=1,
        help="Maximum quotes to evaluate when --quote-id is not provided.",
    )
    parser.add_argument(
        "--all-quotes",
        action="store_true",
        help="Evaluate every registered quote for the bid.",
    )
    parser.add_argument(
        "--poll-seconds",
        type=float,
        default=1.0,
        help="Seconds between run-state polls.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=180.0,
        help="Maximum time to wait for completion.",
    )
    parser.add_argument(
        "--skip-scan",
        action="store_true",
        help="Do not call POST /input/scan before starting the run.",
    )
    return parser.parse_args()


def resolve_bid_id(args: argparse.Namespace) -> str:
    if args.bid_id:
        return args.bid_id
    if args.bid_number is not None:
        return f"BID-{args.bid_number:03d}"
    return "BID-001"


def request_json(method: str, url: str, **kwargs: Any) -> Dict[str, Any]:
    response = requests.request(method, url, timeout=120, **kwargs)
    response.raise_for_status()
    return response.json()


def main() -> int:
    args = parse_args()
    api = args.api.rstrip("/")
    bid_id = resolve_bid_id(args)

    health = request_json("GET", f"{api}/health")
    print(f"Backend online: {health.get('mode', 'unknown mode')}")

    if not args.skip_scan:
        scan = request_json("POST", f"{api}/input/scan")
        print(
            "Input scan: "
            f"{scan['bids_indexed']} bids, {scan['quotes_indexed']} quotes "
            f"({scan['new_bids']} new bids, {scan['new_quotes']} new quotes)"
        )

    quotes = request_json("GET", f"{api}/bids/{bid_id}/quotes")
    available_quote_ids = [quote["quote_id"] for quote in quotes.get("quotes", [])]
    if not available_quote_ids:
        print(f"No quotes found for {bid_id}.")
        return 1

    if args.quote_id:
        quote_ids = args.quote_id
    elif args.all_quotes:
        quote_ids = available_quote_ids
    else:
        if args.max_quotes <= 0:
            print("--max-quotes must be positive.")
            return 1
        quote_ids = available_quote_ids[: args.max_quotes]

    skipped = len(available_quote_ids) - len(quote_ids)
    if skipped > 0 and not args.quote_id:
        print(
            f"Token-safety limit: evaluating {len(quote_ids)} quote(s), "
            f"skipping {skipped}. Use --all-quotes to evaluate the full bid."
        )
    print(f"Starting evaluation for {bid_id}: {', '.join(quote_ids)}")

    run = request_json(
        "POST",
        f"{api}/bid-runs",
        json={"bid_id": bid_id, "quote_ids": quote_ids},
    )
    run_id = run["run_id"]
    print(f"Started {run_id}")

    deadline = time.monotonic() + args.timeout_seconds
    while True:
        state = request_json("GET", f"{api}/bid-runs/{run_id}/state")
        status = state["status"]
        print(f"{run_id}: {status} / {state.get('current_step')}")
        if status in TERMINAL_STATES:
            break
        if time.monotonic() > deadline:
            print(f"Timed out waiting for {run_id}.")
            return 1
        time.sleep(args.poll_seconds)

    result = request_json("GET", f"{api}/bid-runs/{run_id}/result")
    print("Result:")
    print(result)
    return 0 if result.get("status") == "completed" else 1


if __name__ == "__main__":
    sys.exit(main())
