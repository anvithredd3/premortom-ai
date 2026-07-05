"""Vendor screening tool.

A real, queryable data lookup the agents can call as a *tool*: it screens a
vendor/supplier name against a debarment / blacklist list (World Bank debarred
firms sample). This is deliberately deterministic and dependency-free so it
works with or without an API key, but it is exposed to the LLM as a callable
tool so the Historical Intelligence Agent can genuinely reason with live data.

Replace ``worldbank_debarred_SAMPLE.csv`` with a fuller export (World Bank
debarred firms, SAM.gov exclusions, etc.) and this keeps working unchanged.
"""
from __future__ import annotations

import csv
import os
import re
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path
from typing import Dict, List

# backend/app/services/vendor_screening.py -> parents[3] == premortem-ai/
_DEFAULT_CSV = (
    Path(__file__).resolve().parents[3] / "files" / "worldbank_debarred_SAMPLE.csv"
)

# Company suffixes / filler tokens ignored when comparing names.
_STOPWORDS = {
    "pvt",
    "private",
    "ltd",
    "limited",
    "llp",
    "llc",
    "inc",
    "co",
    "company",
    "corp",
    "corporation",
    "the",
    "and",
}

_MATCH_THRESHOLD = 0.62


def _csv_path() -> Path:
    configured = os.getenv("VENDOR_DEBARMENT_CSV")
    return Path(configured).expanduser() if configured else _DEFAULT_CSV


def _normalize(name: str) -> List[str]:
    cleaned = re.sub(r"[^a-z0-9\s]", " ", (name or "").lower())
    return [tok for tok in cleaned.split() if tok and tok not in _STOPWORDS]


@lru_cache(maxsize=1)
def _load_records() -> List[Dict[str, str]]:
    path = _csv_path()
    try:
        with path.open("r", encoding="utf-8", newline="") as fh:
            return [dict(row) for row in csv.DictReader(fh)]
    except FileNotFoundError:
        return []


def _similarity(a_tokens: List[str], b_tokens: List[str], a_raw: str, b_raw: str) -> float:
    if not a_tokens or not b_tokens:
        return 0.0
    set_a, set_b = set(a_tokens), set(b_tokens)
    overlap = len(set_a & set_b) / len(set_a | set_b)
    seq = SequenceMatcher(None, " ".join(a_tokens), " ".join(b_tokens)).ratio()
    # Substring containment is a strong signal for company names.
    contained = 1.0 if (a_raw and (a_raw in b_raw or b_raw in a_raw)) else 0.0
    return max(overlap, seq, contained * 0.9)


def screen_vendor(vendor_name: str) -> Dict[str, object]:
    """Screen a vendor name against the debarment list.

    Returns a structured, JSON-serialisable result with any matches and the
    match confidence. Never raises.
    """
    records = _load_records()
    query_tokens = _normalize(vendor_name)
    query_join = " ".join(query_tokens)

    matches: List[Dict[str, object]] = []
    if query_tokens:
        for row in records:
            candidate = row.get("vendor_name", "")
            cand_tokens = _normalize(candidate)
            score = _similarity(
                query_tokens, cand_tokens, query_join, " ".join(cand_tokens)
            )
            if score >= _MATCH_THRESHOLD:
                matches.append(
                    {
                        "vendor_name": candidate,
                        "source": row.get("source", ""),
                        "reason": row.get("reason", ""),
                        "date": row.get("date", ""),
                        "match_score": round(score, 2),
                    }
                )

    matches.sort(key=lambda m: m["match_score"], reverse=True)
    return {
        "query": vendor_name,
        "matched": bool(matches),
        "matches": matches,
        "records_checked": len(records),
        "source_file": _csv_path().name,
    }


# --- Tool specifications for LLM tool-calling ------------------------------- #
TOOL_DESCRIPTION = (
    "Screen a vendor/supplier company name against the debarment, blacklist, "
    "and exclusion list (World Bank debarred firms). Call this whenever a "
    "vendor name is available to check for prior fraud, bid-rigging, "
    "non-performance, or litigation flags. Returns any matching records."
)

_INPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "vendor_name": {
            "type": "string",
            "description": "The vendor/supplier company name to screen.",
        }
    },
    "required": ["vendor_name"],
}


def openai_tool_spec() -> dict:
    return {
        "type": "function",
        "function": {
            "name": "screen_vendor",
            "description": TOOL_DESCRIPTION,
            "parameters": _INPUT_SCHEMA,
        },
    }


def anthropic_tool_spec() -> dict:
    return {
        "name": "screen_vendor",
        "description": TOOL_DESCRIPTION,
        "input_schema": _INPUT_SCHEMA,
    }


def summarize_matches(screening: Dict[str, object]) -> str:
    """One-line human summary of a screening result, for evidence lines."""
    if not screening or not screening.get("matched"):
        checked = screening.get("records_checked", 0) if screening else 0
        return (
            f"Vendor screening: no debarment match "
            f"({checked} records checked in {screening.get('source_file', 'list') if screening else 'list'})."
        )
    top = screening["matches"][0]  # type: ignore[index]
    return (
        f"DEBARMENT MATCH: '{top['vendor_name']}' — {top['reason']} "
        f"[{top['source']}, {top['date']}] (match {top['match_score']})."
    )
