"""Profiler Agent — classify intake text, then web-research product category norms.

Two phases:
  Phase 1  classify(text) → PROPOSAL | PRODUCT_ONLY | OUT_OF_SCOPE
  Phase 2  profile(text)  → web-research norms, return READY dict with proposed fields

Reuses extraction_agent's field-coercion pattern.
run_agent_with_tools used for research (Anthropic); falls back to run_agent_llm
(uses model knowledge) for OpenAI; returns safe defaults offline.

HARD RULES enforced here, not in the LLM:
  - contract_value_cr / advance_payment_pct / delivery_timeline_months are always
    in missing_fields when input is a bare product name (PRODUCT_ONLY).
  - No field is ever null in proposed_fields — coerced to ProcurementInput defaults.
"""
from __future__ import annotations

from typing import Any

from ..models import ApprovalStatus, ProcurementInput, WarrantyStart
from ..services.llm import has_api_key, run_agent_llm, run_agent_with_tools

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DEAL_FIELDS = ("contract_value_cr", "advance_payment_pct", "delivery_timeline_months")

_WS_MAP = {v.value: v for v in WarrantyStart}
_AP_MAP = {v.value: v for v in ApprovalStatus}

_WEB_SEARCH_TOOL = {
    "name": "web_search",
    "description": (
        "Search the web for product specifications, Indian public-procurement "
        "norms, typical lead times, staffing requirements, and regulatory approvals."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query string"}
        },
        "required": ["query"],
    },
}

# ---------------------------------------------------------------------------
# Phase 1 — classify
# ---------------------------------------------------------------------------

_CLASSIFY_INSTRUCTIONS = """Classify the text into exactly one of three categories.
Read carefully — the OUT_OF_SCOPE list is exhaustive and takes priority.

OUT_OF_SCOPE (return this if ANY of the following apply):
  - It is an invoice, bill, receipt, or payment document (look for "Invoice",
    "Bill To", "Amount Due", "Total", "Tax", unit prices for consumer goods)
  - The items are clothing, textiles, food, furniture, stationery, or other
    consumer/retail goods — regardless of quantity
  - It is a news article, research paper, general webpage, or unrelated document
  - It is a purchase-order CONFIRMATION (goods already dispatched/received)

PROPOSAL — a procurement proposal, RFP, NIT, tender, or draft contract for
  capital equipment or technology that contains deal-specific terms
  (indicative price, advance payment %, delivery schedule, named parties,
  bid conditions). Scientific instruments, medical devices, IT systems, etc.

PRODUCT_ONLY — a bare product name, model number, datasheet, or short
  description with NO deal-specific financial or delivery terms attached.
  Example: "Bruel and Kjaer HATS Type 4128", "3T MRI Scanner Siemens Vida"

Return exactly one JSON object:
{"type": "PROPOSAL"|"PRODUCT_ONLY"|"OUT_OF_SCOPE", "reason": "<one sentence>"}"""


def _classify(text: str) -> tuple[str, str]:
    result = run_agent_llm(
        name="Profiler-Classify",
        instructions=_CLASSIFY_INSTRUCTIONS,
        user_payload=text[:3000],
        temperature=0.0,
    )
    if result is None:
        return "PRODUCT_ONLY", "offline — defaulting to PRODUCT_ONLY"
    doc_type = result.get("type", "PRODUCT_ONLY")
    if doc_type not in ("PROPOSAL", "PRODUCT_ONLY", "OUT_OF_SCOPE"):
        doc_type = "PRODUCT_ONLY"
    return doc_type, result.get("reason", "")


# ---------------------------------------------------------------------------
# Phase 2 — research
# ---------------------------------------------------------------------------

_RESEARCH_INSTRUCTIONS = """You are a procurement intelligence analyst for Indian public-sector buyers.

Use web_search to research the product/category described in the input. Find:
  1. Product category (medical / acoustic-lab / it-hardware / industrial / defence / other)
  2. Typical Indian public-procurement characteristics:
       - installation_responsibility: Vendor (most high-value scientific equipment)
         or Buyer (civil/construction work)
       - training_included: true/false typical for this category
       - construction_completion_pct: site readiness typically required before delivery
       - electrical_readiness: "Approved"|"Pending"|"Not Started" typical expectation
       - regulatory_approval_status: "Approved"|"Pending"|"Not Started"
         (CDSCO for medical, AERB for radiation, BIS for electronics, etc.)
       - technicians_required: typical number of specialist operators/engineers
       - warranty_start: "On Commissioning" for complex equipment, "On Delivery" for simpler goods
       - historical_delays_months: typical delay range seen in Indian tenders [float, ...]

HARD RULES — follow exactly:
  - Set contract_value_cr, advance_payment_pct, delivery_timeline_months to null.
    These are deal-specific; we never invent them from a product name.
  - technicians_available is always 0 (unknown until buyer confirms).
  - Populate research[] from the actual sources you searched.

Return ONE JSON object (no markdown):
{
  "category": "<short label>",
  "procurement_name": "<product or document name>",
  "equipment_type": "<type string>",
  "contract_value_cr": null,
  "advance_payment_pct": null,
  "delivery_timeline_months": null,
  "warranty_start": "On Commissioning",
  "installation_responsibility": "Vendor",
  "training_included": true,
  "construction_completion_pct": 100,
  "electrical_readiness": "Approved",
  "regulatory_approval_status": "Pending",
  "technicians_available": 0,
  "technicians_required": <integer>,
  "historical_delays_months": [<float>],
  "research": [{"title": "...", "url": "...", "snippet": "..."}]
}"""


# ---------------------------------------------------------------------------
# Field coercion (mirrors extraction_agent pattern exactly)
# ---------------------------------------------------------------------------

def _coerce(raw: dict, missing: list[str]) -> dict[str, Any]:
    """Extract and type-coerce LLM output into ProcurementInput kwargs."""
    kwargs: dict[str, Any] = {}

    scalar_map: dict[str, type] = {
        "procurement_name": str,
        "equipment_type": str,
        "construction_completion_pct": float,
        "training_included": bool,
        "installation_responsibility": str,
        "technicians_available": int,
        "technicians_required": int,
        "historical_delays_months": list,
    }
    for field, coerce in scalar_map.items():
        val = raw.get(field)
        if val is None:
            missing.append(field)
        else:
            try:
                kwargs[field] = coerce(val)
            except (ValueError, TypeError):
                missing.append(field)

    ws_raw = raw.get("warranty_start")
    if ws_raw in _WS_MAP:
        kwargs["warranty_start"] = _WS_MAP[ws_raw]
    else:
        missing.append("warranty_start")

    for ap_field in ("electrical_readiness", "regulatory_approval_status"):
        val = raw.get(ap_field)
        if val in _AP_MAP:
            kwargs[ap_field] = _AP_MAP[val]
        else:
            missing.append(ap_field)

    return kwargs


# ---------------------------------------------------------------------------
# Offline / error fallback
# ---------------------------------------------------------------------------

def _offline_ready() -> dict:
    defaults = ProcurementInput()
    all_fields = list(ProcurementInput.model_fields.keys())
    return {
        "status": "READY",
        "category": "unknown",
        "proposed_fields": defaults.model_dump(exclude={"raw_document_text", "category"}),
        "missing_fields": [f for f in all_fields if f not in ("raw_document_text", "category")],
        "research": [],
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def profile(text: str) -> dict:
    """Classify text and research product norms. Returns /profile response dict."""
    doc_type, reason = _classify(text)

    if doc_type == "OUT_OF_SCOPE":
        return {"status": "OUT_OF_SCOPE", "reason": reason}

    if not has_api_key():
        return _offline_ready()

    # Research with tool-use (Anthropic) or model knowledge (OpenAI fallback)
    payload = (
        f"Input type: {doc_type}\n\n"
        f"Research this for Indian public-procurement context:\n\n{text[:2000]}"
    )

    result = run_agent_with_tools(
        name="Profiler-Research",
        instructions=_RESEARCH_INSTRUCTIONS,
        user_payload=payload,
        tools=[_WEB_SEARCH_TOOL],
        temperature=0.2,
        use_sonnet=True,
    )

    # OpenAI / tool-use failure fallback — use model knowledge without search
    if result is None:
        result = run_agent_llm(
            name="Profiler-Research-Fallback",
            instructions=_RESEARCH_INSTRUCTIONS,
            user_payload=payload,
            temperature=0.2,
        )

    if result is None:
        return _offline_ready()

    # Enforce deal-field hard rule: always missing for PRODUCT_ONLY
    missing: list[str] = list(_DEAL_FIELDS) if doc_type == "PRODUCT_ONLY" else []

    research = [
        r for r in (result.get("research") or [])
        if isinstance(r, dict) and r.get("title")
    ]

    kwargs = _coerce(result, missing)
    # Deduplicate while preserving order
    seen: set[str] = set()
    deduped_missing: list[str] = []
    for f in missing:
        if f not in seen:
            seen.add(f)
            deduped_missing.append(f)

    try:
        proposed = ProcurementInput(**kwargs)
    except Exception:
        proposed = ProcurementInput()
        deduped_missing = [
            f for f in ProcurementInput.model_fields
            if f not in ("raw_document_text", "category")
        ]

    return {
        "status": "READY",
        "category": result.get("category", "unknown"),
        "proposed_fields": proposed.model_dump(exclude={"raw_document_text", "category"}),
        "missing_fields": deduped_missing,
        "research": research[:6],
    }
