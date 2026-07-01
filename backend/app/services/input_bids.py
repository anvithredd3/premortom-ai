"""CSV-backed bid and quote input registry for the demo workflow."""
from __future__ import annotations

import csv
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import BinaryIO, Dict, Iterable, List


REPO_ROOT = Path(__file__).resolve().parents[3]
SAMPLES_DIR = Path(
    os.getenv("PREMORTEM_SAMPLES_DIR", REPO_ROOT / "files/input/samples")
)
BIDS_DIR = SAMPLES_DIR / "bids"
BIDS_DATABASE = SAMPLES_DIR / "bids_database.csv"

FIELDNAMES = [
    "bid_id",
    "quote_id",
    "vendor_name",
    "equipment_type",
    "procurement_name",
    "source",
    "status",
    "pdf_path",
    "original_filename",
    "created_at",
    "updated_at",
]

BID_RE = re.compile(r"^BID-(\d{3,})$")
QUOTE_RE = re.compile(r"^(BID-\d{3,})-Q(\d{2,})$")


def create_bid(procurement_name: str, equipment_type: str) -> Dict[str, str]:
    rows = read_rows()
    bid_id = _next_bid_id(rows)
    bid_dir = BIDS_DIR / bid_id
    bid_dir.mkdir(parents=True, exist_ok=True)
    now = _now()
    rows.append(
        _row(
            bid_id=bid_id,
            procurement_name=procurement_name,
            equipment_type=equipment_type,
            source="upload",
            status="created",
            created_at=now,
            updated_at=now,
        )
    )
    write_rows(rows)
    return {
        "bid_id": bid_id,
        "status": "created",
        "storage_path": str(bid_dir),
    }


def list_bids() -> Dict[str, List[Dict[str, object]]]:
    bids: Dict[str, Dict[str, object]] = {}
    for row in read_rows():
        bid_id = row["bid_id"]
        if not bid_id:
            continue
        bid = bids.setdefault(
            bid_id,
            {
                "bid_id": bid_id,
                "procurement_name": row.get("procurement_name", ""),
                "equipment_type": row.get("equipment_type", ""),
                "quote_count": 0,
                "status": row.get("status", ""),
            },
        )
        if row.get("quote_id"):
            bid["quote_count"] = int(bid["quote_count"]) + 1
        for key in ("procurement_name", "equipment_type"):
            if not bid[key] and row.get(key):
                bid[key] = row[key]
    return {"bids": sorted(bids.values(), key=lambda item: item["bid_id"])}


def save_quote(
    bid_id: str,
    vendor_name: str,
    filename: str,
    file_obj: BinaryIO,
) -> Dict[str, str]:
    if not BID_RE.match(bid_id):
        raise ValueError(f"Invalid bid_id: {bid_id}")
    if not filename.lower().endswith(".pdf"):
        raise ValueError("Only PDF quote uploads are supported.")

    rows = read_rows()
    quote_id = _next_quote_id(rows, bid_id)
    bid_dir = BIDS_DIR / bid_id
    bid_dir.mkdir(parents=True, exist_ok=True)
    pdf_file = bid_dir / f"{quote_id}.pdf"
    with pdf_file.open("wb") as out:
        shutil.copyfileobj(file_obj, out)

    bid_meta = next((row for row in rows if row["bid_id"] == bid_id), {})
    pdf_path = pdf_file.relative_to(SAMPLES_DIR).as_posix()
    now = _now()
    rows.append(
        _row(
            bid_id=bid_id,
            quote_id=quote_id,
            vendor_name=vendor_name,
            equipment_type=bid_meta.get("equipment_type", ""),
            procurement_name=bid_meta.get("procurement_name", ""),
            source="upload",
            status="uploaded",
            pdf_path=pdf_path,
            original_filename=filename,
            created_at=now,
            updated_at=now,
        )
    )
    write_rows(rows)
    return {
        "bid_id": bid_id,
        "quote_id": quote_id,
        "vendor_name": vendor_name,
        "pdf_path": pdf_path,
        "status": "uploaded",
    }


def list_quotes(bid_id: str) -> Dict[str, object]:
    quotes = [
        row
        for row in read_rows()
        if row["bid_id"] == bid_id and row.get("quote_id")
    ]
    return {"bid_id": bid_id, "quotes": quotes}


def scan_inputs() -> Dict[str, int]:
    rows = read_rows()
    known_bids = {row["bid_id"] for row in rows if row["bid_id"]}
    known_quotes = {row["quote_id"] for row in rows if row["quote_id"]}
    new_bids = 0
    new_quotes = 0
    now = _now()

    for bid_dir in sorted(BIDS_DIR.glob("BID-*")):
        if not bid_dir.is_dir() or not BID_RE.match(bid_dir.name):
            continue
        if bid_dir.name not in known_bids:
            rows.append(
                _row(
                    bid_id=bid_dir.name,
                    source="scan",
                    status="discovered",
                    created_at=now,
                    updated_at=now,
                )
            )
            known_bids.add(bid_dir.name)
            new_bids += 1
        for pdf in sorted(bid_dir.glob("*.pdf")):
            quote_id = pdf.stem
            if quote_id in known_quotes or not QUOTE_RE.match(quote_id):
                continue
            rows.append(
                _row(
                    bid_id=bid_dir.name,
                    quote_id=quote_id,
                    source="scan",
                    status="discovered",
                    pdf_path=pdf.relative_to(SAMPLES_DIR).as_posix(),
                    original_filename=pdf.name,
                    created_at=now,
                    updated_at=now,
                )
            )
            known_quotes.add(quote_id)
            new_quotes += 1

    write_rows(rows)
    return {
        "bids_indexed": len({row["bid_id"] for row in rows if row["bid_id"]}),
        "quotes_indexed": len([row for row in rows if row["quote_id"]]),
        "new_bids": new_bids,
        "new_quotes": new_quotes,
    }


def get_quote_rows(bid_id: str, quote_ids: List[str]) -> List[Dict[str, str]]:
    wanted = set(quote_ids)
    return [
        row
        for row in read_rows()
        if row["bid_id"] == bid_id and row["quote_id"] in wanted
    ]


def read_rows() -> List[Dict[str, str]]:
    if not BIDS_DATABASE.exists():
        return []
    with BIDS_DATABASE.open("r", newline="", encoding="utf-8") as f:
        return [_normalize(row) for row in csv.DictReader(f)]


def write_rows(rows: Iterable[Dict[str, str]]) -> None:
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    with BIDS_DATABASE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(_normalize(row) for row in rows)


def _next_bid_id(rows: List[Dict[str, str]]) -> str:
    indexes = []
    for row in rows:
        match = BID_RE.match(row.get("bid_id", ""))
        if match:
            indexes.append(int(match.group(1)))
    return f"BID-{max(indexes, default=0) + 1:03d}"


def _next_quote_id(rows: List[Dict[str, str]], bid_id: str) -> str:
    indexes = []
    for row in rows:
        match = QUOTE_RE.match(row.get("quote_id", ""))
        if match and match.group(1) == bid_id:
            indexes.append(int(match.group(2)))
    return f"{bid_id}-Q{max(indexes, default=0) + 1:02d}"


def _row(**values: str) -> Dict[str, str]:
    row = {field: "" for field in FIELDNAMES}
    row.update({key: str(value) for key, value in values.items() if value is not None})
    return row


def _normalize(row: Dict[str, str]) -> Dict[str, str]:
    return {field: row.get(field, "") for field in FIELDNAMES}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
