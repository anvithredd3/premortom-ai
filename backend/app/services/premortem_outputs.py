"""Persist PreMortem analysis runs to disk (mirrors bid_outputs pattern)."""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

PREMORTEM_RUNS_DIR = Path("files/output/premortem_runs")
RUNS_CSV = PREMORTEM_RUNS_DIR / "runs_database.csv"

_CSV_FIELDS = [
    "run_id",
    "procurement_name",
    "equipment_type",
    "overall_risk_score",
    "recommended_decision",
    "failure_probability_pct",
    "created_at",
    "report_path",
]


# ── helpers ──────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _next_run_id() -> str:
    rows = read_run_rows()
    if not rows:
        return "PM-001"
    last = rows[-1].get("run_id", "PM-000")
    try:
        n = int(last.split("-")[1]) + 1
    except (IndexError, ValueError):
        n = len(rows) + 1
    return f"PM-{n:03d}"


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str))


def read_run_rows() -> List[Dict[str, str]]:
    if not RUNS_CSV.exists():
        return []
    with open(RUNS_CSV, newline="") as f:
        return list(csv.DictReader(f))


def _write_run_rows(rows: List[Dict[str, str]]) -> None:
    PREMORTEM_RUNS_DIR.mkdir(parents=True, exist_ok=True)
    with open(RUNS_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=_CSV_FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


# ── public API ────────────────────────────────────────────────────────────────

def save_run(report_dict: Dict[str, Any], input_dict: Dict[str, Any]) -> str:
    """Write the PreMortem report to disk and update runs_database.csv.
    Returns the generated run_id."""
    run_id = _next_run_id()
    run_dir = PREMORTEM_RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    # Embed run metadata into the report
    report_dict["run_id"] = run_id
    report_dict["created_at"] = _now()
    report_dict["input"] = input_dict

    report_path = run_dir / "report.json"
    _write_json(report_path, report_dict)

    # Update CSV index
    rows = read_run_rows()
    decision = report_dict.get("recommended_decision") or ""
    decision_str = decision if isinstance(decision, str) else (decision.get("value", "") if isinstance(decision, dict) else str(decision))
    rows.append({
        "run_id": run_id,
        "procurement_name": str(report_dict.get("procurement_name", "")),
        "equipment_type": str(report_dict.get("equipment_type", "")),
        "overall_risk_score": str(report_dict.get("overall_risk_score", "")),
        "recommended_decision": decision_str[:80],
        "failure_probability_pct": str(report_dict.get("failure_probability_pct", "")),
        "created_at": report_dict["created_at"],
        "report_path": str(report_path),
    })
    _write_run_rows(rows)

    return run_id


def list_runs() -> List[Dict[str, str]]:
    """Return all PreMortem runs from the CSV, newest first."""
    rows = read_run_rows()
    return list(reversed(rows))


def list_output_files() -> List[Dict[str, Any]]:
    """Return {run_id, type:'premortem', files:[...]} for the output-files API."""
    if not PREMORTEM_RUNS_DIR.exists():
        return []
    results = []
    for run_dir in sorted(PREMORTEM_RUNS_DIR.iterdir(), reverse=True):
        if not run_dir.is_dir() or run_dir.name == "runs_database.csv":
            continue
        files = [
            f.name for f in sorted(run_dir.iterdir())
            if f.is_file() and f.suffix in (".json", ".jsonl")
        ]
        if files:
            results.append({"run_id": run_dir.name, "type": "premortem", "files": files})
    return results


def get_file(run_id: str, filename: str) -> Dict[str, Any]:
    path = PREMORTEM_RUNS_DIR / run_id / filename
    if not path.exists():
        raise FileNotFoundError(f"{run_id}/{filename} not found")
    text = path.read_text()
    if filename.endswith(".jsonl"):
        lines = [json.loads(line) for line in text.strip().splitlines() if line.strip()]
        return {"run_id": run_id, "filename": filename, "content": lines, "type": "jsonl"}
    return {"run_id": run_id, "filename": filename, "content": json.loads(text), "type": "json"}
