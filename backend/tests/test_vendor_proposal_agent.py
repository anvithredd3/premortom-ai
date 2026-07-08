"""Run the Vendor Proposal Agent on a sample PDF.

Example:

    python backend/tests/test_vendor_proposal_agent.py
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

from app.agents.vendor_proposal_agent import analyze_pdf_path  # noqa: E402


DEFAULT_PDF = (
    Path("/files/input/samples/bids/BID-001/BID-001-Q01.pdf")
    if Path("/files/input/samples").is_dir()
    else REPO_ROOT / "files/input/samples/bids/BID-001/BID-001-Q01.pdf"
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run Vendor Proposal Agent on a PDF.",
    )
    parser.add_argument(
        "--pdf",
        default=str(DEFAULT_PDF),
        help="Path to vendor quote PDF.",
    )
    parser.add_argument("--bid-id", default="BID-001")
    parser.add_argument("--quote-id", default="BID-001-Q01")
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    if not pdf_path.is_absolute():
        pdf_path = REPO_ROOT / pdf_path
    if not pdf_path.is_file():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    quote = {
        "bid_id": args.bid_id,
        "quote_id": args.quote_id,
        "vendor_name": "",
        "equipment_type": "",
        "procurement_name": "",
        "pdf_path": pdf_path.relative_to(REPO_ROOT / "files/input/samples").as_posix(),
    }
    result = analyze_pdf_path(quote=quote, pdf_path=pdf_path)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
