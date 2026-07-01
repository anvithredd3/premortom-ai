"""Thin HTTP client for the PreMortem AI backend."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import requests

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - dependency is declared for normal installs.
    load_dotenv = None

if load_dotenv is not None:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

API_BASE = os.getenv("PREMORTEM_API", "http://localhost:8000")
TIMEOUT = 120


def health() -> dict:
    return requests.get(f"{API_BASE}/health", timeout=TIMEOUT).json()


def sample_input() -> dict:
    return requests.get(f"{API_BASE}/sample", timeout=TIMEOUT).json()


def analyze(payload: dict) -> dict:
    r = requests.post(f"{API_BASE}/analyze", json=payload, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def upload(filename: str, content: bytes) -> dict:
    files = {"file": (filename, content)}
    r = requests.post(f"{API_BASE}/upload", files=files, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def export_report(fmt: str, report: dict) -> Optional[bytes]:
    r = requests.post(f"{API_BASE}/report/{fmt}", json=report, timeout=TIMEOUT)
    r.raise_for_status()
    return r.content


# --------------------------------------------------------------------------- #
# Bid and quote workflow API
# --------------------------------------------------------------------------- #
def create_bid(procurement_name: str, equipment_type: str) -> dict:
    payload = {
        "procurement_name": procurement_name,
        "equipment_type": equipment_type,
    }
    r = requests.post(f"{API_BASE}/bids", json=payload, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def list_bids() -> dict:
    r = requests.get(f"{API_BASE}/bids", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def scan_input_folder() -> dict:
    r = requests.post(f"{API_BASE}/input/scan", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def upload_quote(bid_id: str, vendor_name: str, filename: str, content: bytes) -> dict:
    files = {"file": (filename, content, "application/pdf")}
    data = {"vendor_name": vendor_name}
    r = requests.post(
        f"{API_BASE}/bids/{bid_id}/quotes",
        files=files,
        data=data,
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


def list_quotes(bid_id: str) -> dict:
    r = requests.get(f"{API_BASE}/bids/{bid_id}/quotes", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def start_bid_run(bid_id: str, quote_ids: Optional[list[str]] = None) -> dict:
    payload = {
        "bid_id": bid_id,
        "quote_ids": quote_ids or [],
    }
    r = requests.post(f"{API_BASE}/bid-runs", json=payload, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def get_bid_run_state(run_id: str) -> dict:
    r = requests.get(f"{API_BASE}/bid-runs/{run_id}/state", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def get_bid_run_events(run_id: str, since: int = 0) -> dict:
    r = requests.get(
        f"{API_BASE}/bid-runs/{run_id}/events",
        params={"since": since},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


def get_bid_run_graph(run_id: str) -> dict:
    r = requests.get(f"{API_BASE}/bid-runs/{run_id}/graph", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def list_bid_run_artifacts(run_id: str) -> dict:
    r = requests.get(f"{API_BASE}/bid-runs/{run_id}/artifacts", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def get_bid_run_artifact(run_id: str, artifact_id: str) -> dict:
    r = requests.get(
        f"{API_BASE}/bid-runs/{run_id}/artifacts/{artifact_id}",
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


def get_bid_run_result(run_id: str) -> dict:
    r = requests.get(f"{API_BASE}/bid-runs/{run_id}/result", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def list_bid_runs(bid_id: str) -> dict:
    r = requests.get(f"{API_BASE}/bids/{bid_id}/runs", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def get_latest_bid_run(bid_id: str) -> dict:
    r = requests.get(f"{API_BASE}/bids/{bid_id}/latest-run", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def get_latest_bid_run_state(bid_id: str) -> dict:
    r = requests.get(f"{API_BASE}/bids/{bid_id}/latest-state", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def get_latest_bid_run_graph(bid_id: str) -> dict:
    r = requests.get(f"{API_BASE}/bids/{bid_id}/latest-graph", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def list_latest_bid_run_artifacts(bid_id: str) -> dict:
    r = requests.get(f"{API_BASE}/bids/{bid_id}/latest-artifacts", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def get_latest_bid_run_result(bid_id: str) -> dict:
    r = requests.get(f"{API_BASE}/bids/{bid_id}/latest-result", timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()
