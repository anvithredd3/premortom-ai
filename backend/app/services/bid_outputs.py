"""File-backed bid run state and result store."""
from __future__ import annotations

import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List


REPO_ROOT = Path(__file__).resolve().parents[3]
OUTPUT_DIR = Path(os.getenv("PREMORTEM_OUTPUT_DIR", REPO_ROOT / "files/output"))
BID_RUNS_DIR = OUTPUT_DIR / "bid_runs"
RUNS_DATABASE = BID_RUNS_DIR / "runs_database.csv"

FIELDNAMES = [
    "run_id",
    "bid_id",
    "status",
    "quote_count",
    "winner_quote_id",
    "decision_result_path",
    "started_at",
    "completed_at",
    "created_by",
    "llm_provider",
    "model",
]

RUN_STATE_FILE = "run_state.json"
EVENTS_FILE = "events.jsonl"
VENDOR_PROPOSAL_FILE = "vendor_proposal_agent_quote_intelligence.json"
CONTRACT_REVIEW_FILE = "contract_review_agent_quote_reviews.json"
BID_RECOMMENDER_RESULT_FILE = "bid_recommender_agent_decision_result.json"

ARTIFACTS = {
    "artifact_run_state": {
        "node_id": "orchestrator",
        "artifact_type": "state",
        "name": "Run State",
        "filename": RUN_STATE_FILE,
    },
    "artifact_events": {
        "node_id": "orchestrator",
        "artifact_type": "events",
        "name": "Run Events",
        "filename": EVENTS_FILE,
    },
    "artifact_vendor_proposal": {
        "node_id": "vendor_proposal",
        "artifact_type": "proposal_intelligence",
        "name": "Vendor Proposal Intelligence",
        "filename": VENDOR_PROPOSAL_FILE,
    },
    "artifact_contract_review": {
        "node_id": "contract_review",
        "artifact_type": "quote_reviews",
        "name": "Contract Review Results",
        "filename": CONTRACT_REVIEW_FILE,
    },
    "artifact_bid_recommendation": {
        "node_id": "bid_recommender",
        "artifact_type": "decision_result",
        "name": "Bid Recommendation",
        "filename": BID_RECOMMENDER_RESULT_FILE,
    },
}


def create_run(bid_id: str, quote_ids: List[str]) -> Dict[str, str]:
    rows = read_run_rows()
    run_id = _next_run_id(rows)
    run_dir = BID_RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    now = _now()
    rows.append(
        _row(
            run_id=run_id,
            bid_id=bid_id,
            status="queued",
            quote_count=str(len(quote_ids)),
            started_at=now,
        )
    )
    write_run_rows(rows)
    state = _initial_state(run_id, bid_id, quote_ids)
    write_json(run_dir / RUN_STATE_FILE, state)
    append_event(run_id, "run_queued", {"bid_id": bid_id})
    return {
        "run_id": run_id,
        "bid_id": bid_id,
        "status": "queued",
        "output_path": str(run_dir),
    }


def set_running(run_id: str) -> None:
    state = get_state(run_id)
    state["status"] = "running"
    state["current_step"] = "starting"
    write_state(run_id, state)
    _update_run_row(run_id, status="running")
    append_event(run_id, "run_started", {"bid_id": state["bid_id"]})


def complete_run(run_id: str, result: Dict[str, object]) -> None:
    state = get_state(run_id)
    state["status"] = "completed"
    state["current_step"] = "completed"
    for agent in state["agents"].values():
        if agent["status"] in {"running", "waiting"}:
            agent["status"] = "completed"
    write_state(run_id, state)
    result_path = BID_RUNS_DIR / run_id / BID_RECOMMENDER_RESULT_FILE
    write_json(result_path, result)
    winner = result.get("winner") or {}
    _update_run_row(
        run_id,
        status="completed",
        winner_quote_id=str(winner.get("quote_id", "")),
        decision_result_path=str(result_path),
        completed_at=_now(),
    )
    append_event(run_id, "run_completed", {"winner": winner})


def fail_run(run_id: str, message: str) -> None:
    state = get_state(run_id)
    state["status"] = "failed"
    state["current_step"] = "failed"
    state["error"] = message
    write_state(run_id, state)
    _update_run_row(run_id, status="failed", completed_at=_now())
    append_event(run_id, "run_failed", {"message": message})


def write_contract_reviews(run_id: str, reviews: List[Dict[str, object]]) -> None:
    path = BID_RUNS_DIR / run_id / CONTRACT_REVIEW_FILE
    write_json(path, {"run_id": run_id, "quote_reviews": reviews})


def write_vendor_proposals(run_id: str, proposals: List[Dict[str, object]]) -> None:
    path = BID_RUNS_DIR / run_id / VENDOR_PROPOSAL_FILE
    write_json(path, {"run_id": run_id, "quotes": proposals})


def update_quote(run_id: str, quote_id: str, status: str, **values: object) -> None:
    state = get_state(run_id)
    for quote in state["quotes"]:
        if quote["quote_id"] == quote_id:
            quote["status"] = status
            quote.update(values)
            break
    write_state(run_id, state)
    append_event(run_id, f"quote_{status}", {"quote_id": quote_id, **values})


def update_agent(run_id: str, agent_id: str, status: str, message: str) -> None:
    state = get_state(run_id)
    state["agents"].setdefault(agent_id, {})["status"] = status
    state["agents"][agent_id]["message"] = message
    state["current_step"] = agent_id
    _sync_graph_status(state, agent_id, status)
    write_state(run_id, state)
    append_event(run_id, "agent_status", {"agent": agent_id, "status": status})


def get_state(run_id: str) -> Dict[str, object]:
    return read_json(BID_RUNS_DIR / run_id / RUN_STATE_FILE)


def write_state(run_id: str, state: Dict[str, object]) -> None:
    write_json(BID_RUNS_DIR / run_id / RUN_STATE_FILE, state)


def get_result(run_id: str) -> Dict[str, object]:
    result_path = BID_RUNS_DIR / run_id / BID_RECOMMENDER_RESULT_FILE
    legacy_path = BID_RUNS_DIR / run_id / "decision_result.json"
    if not result_path.exists() and legacy_path.exists():
        result_path = legacy_path
    if not result_path.exists():
        state = get_state(run_id)
        return {
            "run_id": run_id,
            "bid_id": state["bid_id"],
            "status": state["status"],
            "message": "Result is not ready yet.",
        }
    return read_json(result_path)


def get_events(run_id: str, since: int = 0) -> Dict[str, object]:
    path = BID_RUNS_DIR / run_id / EVENTS_FILE
    events = []
    if path.exists():
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                event = json.loads(line)
                if int(event["id"]) > since:
                    events.append(event)
    next_since = events[-1]["id"] if events else since
    return {"run_id": run_id, "events": events, "next_since": next_since}


def get_graph(run_id: str) -> Dict[str, object]:
    state = get_state(run_id)
    graph = state.get("graph") or {"nodes": [], "edges": []}
    return {
        "run_id": run_id,
        "nodes": graph.get("nodes", []),
        "edges": graph.get("edges", []),
    }


def list_artifacts(run_id: str) -> Dict[str, object]:
    run_dir = BID_RUNS_DIR / run_id
    artifacts = []
    for artifact_id, meta in ARTIFACTS.items():
        path = run_dir / meta["filename"]
        status = "ready" if path.exists() else "pending"
        created_at = ""
        if path.exists():
            created_at = datetime.fromtimestamp(
                path.stat().st_mtime,
                tz=timezone.utc,
            ).isoformat()
        artifacts.append(
            {
                "artifact_id": artifact_id,
                "node_id": meta["node_id"],
                "artifact_type": meta["artifact_type"],
                "name": meta["name"],
                "status": status,
                "media_type": "application/json",
                "path": str(path),
                "created_at": created_at,
            }
        )
    return {"run_id": run_id, "artifacts": artifacts}


def get_artifact(run_id: str, artifact_id: str) -> Dict[str, object]:
    if artifact_id not in ARTIFACTS:
        raise KeyError(f"Unknown artifact_id: {artifact_id}")

    meta = ARTIFACTS[artifact_id]
    path = BID_RUNS_DIR / run_id / meta["filename"]
    if artifact_id == "artifact_events":
        content: object = get_events(run_id, since=0)
    elif path.exists():
        content = read_json(path)
    else:
        content = None

    return {
        "run_id": run_id,
        "artifact_id": artifact_id,
        "node_id": meta["node_id"],
        "artifact_type": meta["artifact_type"],
        "status": "ready" if path.exists() else "pending",
        "content": content,
    }


def append_event(run_id: str, event_type: str, payload: Dict[str, object]) -> None:
    run_dir = BID_RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    path = run_dir / EVENTS_FILE
    event_id = 1
    if path.exists():
        with path.open("r", encoding="utf-8") as f:
            event_id = sum(1 for _ in f) + 1
    event = {"id": event_id, "timestamp": _now(), "type": event_type, **payload}
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event) + "\n")


def list_runs_for_bid(bid_id: str) -> Dict[str, object]:
    return {
        "bid_id": bid_id,
        "runs": [row for row in read_run_rows() if row["bid_id"] == bid_id],
    }


def get_latest_run_for_bid(bid_id: str) -> Dict[str, str]:
    runs = [row for row in read_run_rows() if row["bid_id"] == bid_id]
    if not runs:
        raise KeyError(f"No runs found for bid_id: {bid_id}")
    return sorted(
        runs,
        key=lambda row: row.get("started_at") or row.get("completed_at") or "",
        reverse=True,
    )[0]


def read_run_rows() -> List[Dict[str, str]]:
    if not RUNS_DATABASE.exists():
        return []
    with RUNS_DATABASE.open("r", newline="", encoding="utf-8") as f:
        return [_normalize(row) for row in csv.DictReader(f)]


def write_run_rows(rows: Iterable[Dict[str, str]]) -> None:
    BID_RUNS_DIR.mkdir(parents=True, exist_ok=True)
    with RUNS_DATABASE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(_normalize(row) for row in rows)


def read_json(path: Path) -> Dict[str, object]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def _initial_state(run_id: str, bid_id: str, quote_ids: List[str]) -> Dict[str, object]:
    return {
        "run_id": run_id,
        "bid_id": bid_id,
        "status": "queued",
        "current_step": "queued",
        "agents": {
            "bid_recommender": {"status": "waiting", "message": "Waiting to start"},
            "contract_review": {"status": "waiting", "message": "Waiting for quotes"},
            "decision_logic": {"status": "waiting", "message": "Waiting for reviews"},
        },
        "quotes": [{"quote_id": quote_id, "status": "pending"} for quote_id in quote_ids],
        "graph": {
            "nodes": [
                {"id": "vendor_proposal", "type": "agent", "label": "Vendor Proposal", "status": "waiting"},
                {"id": "bid_recommender", "type": "agent", "label": "Bid Recommender", "status": "waiting"},
                {"id": "contract_review", "type": "agent", "label": "Contract Review", "status": "waiting"},
                {"id": "decision_logic", "type": "decision_step", "label": "Decision Logic", "status": "waiting"},
                {"id": "document_store", "type": "data_store", "label": "Local PDF Store", "status": "ok"},
                {"id": "llm_provider", "type": "external_connection", "label": "LLM Provider", "status": "pending"},
            ],
            "edges": [
                {"source": "vendor_proposal", "target": "contract_review", "type": "passes_results_to", "status": "waiting"},
                {"source": "vendor_proposal", "target": "bid_recommender", "type": "passes_results_to", "status": "waiting"},
                {"source": "bid_recommender", "target": "contract_review", "type": "delegates_to", "status": "waiting"},
                {"source": "contract_review", "target": "bid_recommender", "type": "returns_result_to", "status": "waiting"},
                {"source": "bid_recommender", "target": "decision_logic", "type": "passes_results_to", "status": "waiting"},
                {"source": "contract_review", "target": "document_store", "type": "reads_from", "status": "waiting"},
                {"source": "contract_review", "target": "llm_provider", "type": "uses_external_service", "status": "waiting"},
            ],
        },
        "external_connections": [
            {"id": "document_store", "label": "Local PDF Store", "status": "ok"},
            {"id": "llm_provider", "label": "LLM Provider", "status": "pending"},
        ],
        "telemetry": {"elapsed_ms": 0, "llm_calls": 0, "errors": 0},
    }


def _sync_graph_status(state: Dict[str, object], node_id: str, status: str) -> None:
    graph = state.get("graph", {})
    for node in graph.get("nodes", []):
        if node["id"] == node_id:
            node["status"] = status


def _update_run_row(run_id: str, **updates: str) -> None:
    rows = read_run_rows()
    for row in rows:
        if row["run_id"] == run_id:
            row.update({key: str(value) for key, value in updates.items()})
            break
    write_run_rows(rows)


def _next_run_id(rows: List[Dict[str, str]]) -> str:
    indexes = []
    for row in rows:
        run_id = row.get("run_id", "")
        if run_id.startswith("RUN-"):
            try:
                indexes.append(int(run_id.split("-")[-1]))
            except ValueError:
                pass
    return f"RUN-{max(indexes, default=0) + 1:03d}"


def _row(**values: str) -> Dict[str, str]:
    row = {field: "" for field in FIELDNAMES}
    row.update({key: str(value) for key, value in values.items() if value is not None})
    return row


def _normalize(row: Dict[str, str]) -> Dict[str, str]:
    return {field: row.get(field, "") for field in FIELDNAMES}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
