"""Run the RFQ Intake and Negotiation UI Guidance Agent on a sample PDF.

Example:

    python backend/tests/test_ui_guidance_agent.py

or:

    python backend/tests/test_ui_guidance_agent.py --pdf files/input/samples/bids/BID-001/BID-001-Q01.pdf
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


TEST_PATH = Path(__file__).resolve()
if (TEST_PATH.parents[1] / "app").is_dir():
    BACKEND_ROOT = TEST_PATH.parents[1]
    REPO_ROOT = BACKEND_ROOT.parent
else:
    REPO_ROOT = TEST_PATH.parents[2]
    BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.agents.ui_guidance_agent import analyze_pdf_path  # noqa: E402
from app.services.decision_history_pgvector import store_ui_guidance_agent_history  # noqa: E402


DEFAULT_PDF = (
    Path("/files/input/samples/bids/BID-001/BID-001-Q01.pdf")
    if Path("/files/input/samples").is_dir()
    else REPO_ROOT / "files/input/samples/bids/BID-001/BID-001-Q01.pdf"
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run RFQ Intake and Negotiation UI Guidance Agent on a PDF.",
    )
    parser.add_argument(
        "--pdf",
        default=str(DEFAULT_PDF),
        help="Path to vendor quote PDF.",
    )
    parser.add_argument("--bid-id", default="")
    parser.add_argument("--quote-id", default="")
    parser.add_argument(
        "--no-store",
        action="store_true",
        help="Print output only; do not write ui_guidance_agent history to pgvector.",
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    if not pdf_path.is_absolute():
        pdf_path = REPO_ROOT / pdf_path
    if not pdf_path.is_file():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    result = analyze_pdf_path(pdf_path)
    print(json.dumps(result, indent=2))
    if not args.no_store:
        try:
            stored_run_id = store_ui_guidance_agent_history(
                result=result,
                bid_id=args.bid_id,
                quote_id=args.quote_id or pdf_path.stem,
                source_name=pdf_path.name,
            )
            print(f"Stored ui_guidance_agent history: {stored_run_id}")
        except Exception as exc:
            print(f"Skipped ui_guidance_agent history store: {exc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
