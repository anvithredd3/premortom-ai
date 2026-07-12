"""Extraction Agent — converts free-text procurement documents to ProcurementInput.

Claude reads the raw document and extracts all structured fields.
Offline fallback: returns default ProcurementInput with all fields flagged as missing.
"""
from __future__ import annotations

from typing import List, Tuple

from ..models import ApprovalStatus, ProcurementInput, WarrantyStart
from ..services.llm import run_agent_llm

NAME = "Extraction Agent"
INSTRUCTIONS = """You are a procurement document analyst. Extract structured data
from the procurement proposal, contract, or tender document provided.

Return a JSON object with exactly these fields (null for anything you cannot determine):
{
  "procurement_name": "short descriptive name",
  "equipment_type": "what is being procured (equipment/software/service/works)",
  "contract_value_cr": <INR Crore; convert from Lakhs/USD/other if needed>,
  "advance_payment_pct": <0-100>,
  "delivery_timeline_months": <number>,
  "warranty_start": <"On Delivery" | "On Commissioning" | "On Installation">,
  "installation_responsibility": <"Buyer" | "Vendor" | description>,
  "training_included": <true | false>,
  "construction_completion_pct": <0-100; use 100 for software/services with no physical site>,
  "electrical_readiness": <"Approved" | "Pending" | "Not Started">,
  "regulatory_approval_status": <"Approved" | "Pending" | "Not Started">,
  "technicians_available": <integer; for software = licensed users on hand>,
  "technicians_required": <integer>,
  "historical_delays_months": [list of delay durations in months mentioned in the document],
  "missing_fields": [list of field names you could not extract or had to default]
}

Rules:
- Software/IT/service contracts: set construction_completion_pct=100 and
  electrical_readiness="Approved" unless a physical site dependency is mentioned.
- "site not ready" or "under construction" -> construction_completion_pct ~40-60.
- Add every field you guessed or defaulted to missing_fields.
- For contract_value_cr: 1 Crore = 100 Lakhs = ~120,000 USD (use 83 INR/USD if converting)."""


def extract(raw_text: str) -> Tuple[ProcurementInput, List[str]]:
    """Return (ProcurementInput, missing_fields). Never raises."""
    result, _ = run_agent_llm(
        name=NAME,
        instructions=INSTRUCTIONS,
        user_payload=f"Extract procurement details from this document:\n\n{raw_text[:8000]}",
        temperature=0.1,
    )

    if result is None:
        # Offline fallback — return defaults, flag everything as unextracted
        return ProcurementInput(raw_document_text=raw_text), list(ProcurementInput.model_fields)

    missing: List[str] = result.pop("missing_fields", []) or []
    kwargs: dict = {"raw_document_text": raw_text}

    scalar_fields = {
        "procurement_name": str,
        "equipment_type": str,
        "contract_value_cr": float,
        "advance_payment_pct": float,
        "delivery_timeline_months": float,
        "installation_responsibility": str,
        "training_included": bool,
        "construction_completion_pct": float,
        "technicians_available": int,
        "technicians_required": int,
        "historical_delays_months": list,
    }
    for field, coerce in scalar_fields.items():
        val = result.get(field)
        if val is not None:
            try:
                kwargs[field] = coerce(val)
            except (ValueError, TypeError):
                missing.append(field)

    ws_map = {v.value: v for v in WarrantyStart}
    ws_raw = result.get("warranty_start")
    if ws_raw in ws_map:
        kwargs["warranty_start"] = ws_map[ws_raw]

    ap_map = {v.value: v for v in ApprovalStatus}
    for field in ("electrical_readiness", "regulatory_approval_status"):
        raw_val = result.get(field)
        if raw_val in ap_map:
            kwargs[field] = ap_map[raw_val]

    try:
        return ProcurementInput(**kwargs), missing
    except Exception:
        return ProcurementInput(raw_document_text=raw_text), list(ProcurementInput.model_fields)
