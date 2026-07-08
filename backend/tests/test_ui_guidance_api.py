"""Call the UI Guidance Agent backend API using a vendor proposal artifact.

Example:

    python backend/tests/test_ui_guidance_api.py --run-id RUN-024

Docker:

    docker compose exec backend python tests/test_ui_guidance_api.py --artifact /files/output/bid_runs/RUN-024/vendor_proposal_agent_quote_intelligence.json --api http://127.0.0.1:8000
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict

import requests


TEST_PATH = Path(__file__).resolve()
if (TEST_PATH.parents[1] / "app").is_dir():
    BACKEND_ROOT = TEST_PATH.parents[1]
    REPO_ROOT = BACKEND_ROOT.parent
else:
    REPO_ROOT = TEST_PATH.parents[2]
    BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


DEFAULT_RUN_ID = "RUN-024"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run UI Guidance Agent through the FastAPI endpoint.",
    )
    parser.add_argument("--api", default="http://127.0.0.1:8000")
    parser.add_argument("--run-id", default=DEFAULT_RUN_ID)
    parser.add_argument("--artifact", default="")
    parser.add_argument("--bid-id", default="BID-001")
    parser.add_argument("--quote-id", default="BID-001-Q01")
    parser.add_argument(
        "--role",
        default="procurement_officer",
        choices=[
            "management",
            "doctor",
            "technician",
            "biomedical_engineer",
            "procurement_officer",
        ],
    )
    parser.add_argument(
        "--free-text",
        default=(
            "Prepare RFQ and negotiation guidance for an MRI procurement. "
            "Focus on warranty, training, service SLA, lifecycle cost, and advance payment."
        ),
    )
    parser.add_argument("--no-store", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    artifact_path = _artifact_path(args)
    artifact = _read_json(artifact_path)
    quote = _select_quote(artifact, args.quote_id)
    payload = _build_payload(args, quote)

    response = requests.post(
        f"{args.api.rstrip('/')}/ui-guidance/rfq-negotiation",
        json=payload,
        timeout=180,
    )
    response.raise_for_status()
    result = response.json()
    print(json.dumps(result, indent=2))
    history = result.get("history") or {}
    print(
        "UI guidance API completed: "
        f"stored={history.get('stored')} run_id={history.get('run_id', '')}"
    )
    return 0


def _artifact_path(args: argparse.Namespace) -> Path:
    if args.artifact:
        path = Path(args.artifact)
    elif Path("/files/output/bid_runs").is_dir():
        path = Path(f"/files/output/bid_runs/{args.run_id}/vendor_proposal_agent_quote_intelligence.json")
    else:
        path = REPO_ROOT / f"files/output/bid_runs/{args.run_id}/vendor_proposal_agent_quote_intelligence.json"
    if not path.is_file():
        raise FileNotFoundError(f"Vendor proposal artifact not found: {path}")
    return path


def _read_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _select_quote(artifact: Dict[str, Any], quote_id: str) -> Dict[str, Any]:
    quotes = artifact.get("quotes") or []
    if not quotes:
        raise ValueError("Vendor proposal artifact has no quotes.")
    for quote in quotes:
        if quote.get("quote_id") == quote_id:
            return quote
    return quotes[0]


def _build_payload(args: argparse.Namespace, quote: Dict[str, Any]) -> Dict[str, Any]:
    fixed = quote.get("fixed_features") or {}
    return {
        "mode": "negotiation",
        "role": args.role,
        "free_text": args.free_text,
        "static_inputs": {
            "procurement_name": _feature(fixed, "procurement_name") or "MRI Machine Procurement",
            "equipment_type": _feature(fixed, "equipment_type") or "MRI Machine",
            "budget_cr": _feature(fixed, "quoted_price_cr") or 18.0,
            "budget_tolerance_pct": 10.0,
            "delivery_timeline_months": _feature(fixed, "delivery_timeline_months") or 6.0,
            "warranty_start": _feature(fixed, "warranty_start_trigger") or "On Commissioning",
            "installation_responsibility": _feature(fixed, "installation_responsibility") or "Vendor",
            "training_required": True,
            "service_response_hours": _parse_hours(_feature(fixed, "service_response_target")),
            "site_readiness_pct": 80,
            "patient_volume": "High outpatient and inpatient diagnostic demand",
            "clinical_use_cases": ["routine MRI", "neurology", "orthopedics"],
        },
        "feature_weights": {
            "technical_capability": 25,
            "price": 20,
            "delivery": 10,
            "warranty": 15,
            "service_sla": 15,
            "training": 10,
            "lifecycle_cost": 5,
        },
        "minimum_criteria": [
            "Warranty must start at commissioning or acceptance.",
            "Vendor must provide compliance evidence before award.",
            "Training and service obligations must be written into the final contract.",
        ],
        "negotiable_criteria": [
            "Advance payment percentage and payment milestone protection.",
            "Spare-parts commitment and service remedy language.",
            "Consumables and software subscription inclusions.",
        ],
        "bid_id": args.bid_id,
        "quote_id": quote.get("quote_id") or args.quote_id,
        "vendor_proposal": quote,
        "store_history": not args.no_store,
    }


def _feature(fixed: Dict[str, Any], key: str) -> Any:
    value = fixed.get(key)
    if isinstance(value, dict):
        return value.get("value")
    return value


def _parse_hours(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value or "")
    for token in text.replace("/", " ").split():
        try:
            return float(token)
        except ValueError:
            continue
    return 12.0


if __name__ == "__main__":
    raise SystemExit(main())
