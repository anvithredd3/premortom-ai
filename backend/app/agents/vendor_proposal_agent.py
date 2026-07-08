"""Vendor Proposal Agent.

Turns extracted quote text plus bid registry metadata into reusable proposal
intelligence for downstream agents.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List

from ..services import document_parser
from ..services.llm import has_api_key, run_agent_llm

NAME = "Vendor Proposal Agent"
PROFILE_PATH = (
    Path(__file__).resolve().parents[2]
    / "agent_profiles"
    / "vendor_proposal_agent_profile"
    / "profile.md"
)
MAX_LLM_TEXT_CHARS = 12000

INSTRUCTIONS = """
You are the Vendor Proposal Agent for PreMortem AI.
Extract vendor proposal intelligence from the provided quote text and registry
metadata. Return one JSON object with these keys:
- fixed_features: object
- proposal_intelligence: object

Rules:
- Preserve stated facts separately from interpretation.
- Do not recommend a winner.
- Do not invent values that are not present.
- Mark missing fields as missing.
- Mark conflicts between registry metadata and proposal text as conflict.
"""


def analyze_quote(
    *,
    quote: Dict[str, str],
    raw_text: str,
    source_pdf_path: str,
) -> Dict[str, object]:
    """Return one vendor proposal artifact record for a quote."""
    deterministic = _deterministic_record(
        quote=quote,
        raw_text=raw_text,
        source_pdf_path=source_pdf_path,
    )

    llm_result = _llm_enrichment(quote=quote, raw_text=raw_text)
    if llm_result:
        deterministic["fixed_features"].update(
            _safe_dict(llm_result.get("fixed_features"))
        )
        deterministic["proposal_intelligence"].update(
            _safe_dict(llm_result.get("proposal_intelligence"))
        )

    return deterministic


def analyze_pdf_path(
    *,
    quote: Dict[str, str],
    pdf_path: str | Path,
) -> Dict[str, object]:
    """Read a quote PDF and return a vendor proposal artifact record."""
    path = Path(pdf_path)
    text = document_parser.extract_text(path.name, path.read_bytes())
    return analyze_quote(quote=quote, raw_text=text, source_pdf_path=str(path))


def _deterministic_record(
    *,
    quote: Dict[str, str],
    raw_text: str,
    source_pdf_path: str,
) -> Dict[str, object]:
    extracted = _extract_from_text(raw_text)
    fixed_features = _fixed_features(quote, extracted)
    proposal_intelligence = _proposal_intelligence(raw_text, extracted)
    return {
        "quote_id": quote.get("quote_id", ""),
        "fixed_features": fixed_features,
        "proposal_text": {
            "raw_text": raw_text,
            "text_preview": raw_text[:2000],
            "char_count": len(raw_text),
            "source_pdf_path": source_pdf_path,
            "extraction_quality": _extraction_quality(raw_text),
            "needs_ocr_or_vision_fallback": len(raw_text.strip()) < 200,
        },
        "proposal_intelligence": proposal_intelligence,
        "raw_text_reference": {
            "pdf_path": quote.get("pdf_path", ""),
            "full_text_available": bool(raw_text),
        },
    }


def _extract_from_text(text: str) -> Dict[str, object]:
    fields: Dict[str, object] = {}
    patterns = {
        "vendor_name": r"(?im)^Vendor:\s*(.+)$",
        "legal_entity_name": r"(?im)^Legal Entity:\s*(.+)$",
        "registered_address": r"(?im)^Registered Address:\s*(.+)$",
        "contact_details": r"(?im)^Contact:\s*(.+)$",
        "procurement_name": r"(?im)^Procurement:\s*(.+)$",
        "service_response_target": r"(?i)Service response target:\s*([^.\\n]+)",
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, text)
        if match:
            fields[key] = _clean(match.group(1))
    if fields.get("procurement_name") and " - " in str(fields["procurement_name"]):
        procurement_name, equipment_type = str(fields["procurement_name"]).rsplit(" - ", 1)
        fields["procurement_name"] = _clean(procurement_name)
        fields["equipment_type"] = _clean(equipment_type)

    commercial = re.search(
        r"(?i)Commercial Offer:\s*(?:INR\s*)?([\d.]+)\s*Cr\s+with\s+(\d{1,3})%\s+advance",
        text,
    )
    if commercial:
        fields["quoted_price_cr"] = float(commercial.group(1))
        fields["currency"] = "INR"
        fields["advance_payment_pct"] = float(commercial.group(2))

    delivery = re.search(
        r"(?i)Delivery in\s*([\d.]+)\s*months?\.\s*Warranty starts\s*([^.\n]+)\.",
        text,
    )
    if delivery:
        fields["delivery_timeline_months"] = float(delivery.group(1))
        fields["warranty_start_trigger"] = _clean(delivery.group(2))

    install = re.search(r"(?i)Installation\s+responsibility:\s*([^.\n]+)", text)
    if install:
        fields["installation_responsibility"] = _clean(install.group(1))

    training = re.search(r"(?i)Training included:\s*(true|false|yes|no)", text)
    if training:
        fields["training_included"] = training.group(1).lower() in {"true", "yes"}

    local_service = re.search(r"(?i)Local service\s+team:\s*(true|false|yes|no)", text)
    if local_service:
        fields["local_service_team_available"] = (
            local_service.group(1).lower() in {"true", "yes"}
        )

    compliance = re.search(r"(?im)^Compliance Claims:\s*(.+)$", text)
    if compliance:
        fields["compliance_claims"] = [
            _clean(item).rstrip(".") for item in compliance.group(1).split(",") if item.strip()
        ]

    profile = re.search(r"(?im)^Company Profile:\s*(.+)$", text)
    if profile:
        fields["company_profile"] = _clean(profile.group(1))
        years = re.search(r"(\d+)\s+years?", profile.group(1), re.I)
        refs = re.search(r"(\d+)\s+similar hospital references", profile.group(1), re.I)
        if years:
            fields["years_in_operation"] = int(years.group(1))
        if refs:
            fields["hospital_references_count"] = int(refs.group(1))

    return fields


def _fixed_features(
    quote: Dict[str, str],
    extracted: Dict[str, object],
) -> Dict[str, Dict[str, object]]:
    keys = [
        "vendor_name",
        "legal_entity_name",
        "registered_address",
        "contact_details",
        "equipment_type",
        "procurement_name",
        "quoted_price_cr",
        "currency",
        "advance_payment_pct",
        "delivery_timeline_months",
        "warranty_start_trigger",
        "installation_responsibility",
        "training_included",
        "service_response_target",
        "local_service_team_available",
        "compliance_claims",
        "hospital_references_count",
        "years_in_operation",
    ]
    fixed: Dict[str, Dict[str, object]] = {}
    for key in keys:
        registry_value = quote.get(key, "")
        text_value = extracted.get(key)
        fixed[key] = _feature_value(registry_value, text_value)
    return fixed


def _feature_value(registry_value: object, text_value: object) -> Dict[str, object]:
    has_registry = registry_value not in (None, "")
    has_text = text_value not in (None, "")
    if has_registry and has_text and str(registry_value).strip() != str(text_value).strip():
        return {
            "value": text_value,
            "status": "conflict",
            "confidence": 0.7,
            "evidence": "bids_database.csv and proposal_text",
            "registry_value": registry_value,
            "proposal_value": text_value,
        }
    if has_registry:
        return {
            "value": registry_value,
            "status": "found",
            "confidence": 1.0,
            "evidence": "bids_database.csv",
        }
    if has_text:
        return {
            "value": text_value,
            "status": "found",
            "confidence": 0.9,
            "evidence": "proposal_text",
        }
    return {
        "value": "",
        "status": "missing",
        "confidence": 0.0,
        "evidence": "",
    }


def _proposal_intelligence(text: str, extracted: Dict[str, object]) -> Dict[str, object]:
    lower = text.lower()
    omissions = []
    if "spare" not in lower:
        omissions.append("Spare-parts availability or commitment is not clearly stated.")
    if "consumable" not in lower:
        omissions.append("Consumables and recurring supply responsibility are not clearly stated.")
    if "resolution" not in lower:
        omissions.append("Service resolution time and remedies are not clearly stated.")
    if "training included: false" in lower:
        omissions.append("Training is explicitly not included.")

    unusual_terms = []
    advance = extracted.get("advance_payment_pct")
    if isinstance(advance, (int, float)) and advance >= 50:
        unusual_terms.append(f"High advance payment requested: {advance:g}%.")
    if extracted.get("installation_responsibility") == "Buyer":
        unusual_terms.append("Installation responsibility is assigned to the buyer.")

    differentiators = []
    if extracted.get("local_service_team_available") is True:
        differentiators.append("Vendor states a local service team is available.")
    if extracted.get("hospital_references_count"):
        differentiators.append(
            f"Vendor states {extracted['hospital_references_count']} similar hospital references."
        )

    return {
        "vendor_profile": {
            "vendor_name": extracted.get("vendor_name", ""),
            "legal_entity_name": extracted.get("legal_entity_name", ""),
            "registered_address": extracted.get("registered_address", ""),
            "contact_details": extracted.get("contact_details", ""),
            "company_profile": extracted.get("company_profile", ""),
            "years_in_operation": extracted.get("years_in_operation", ""),
            "hospital_references_count": extracted.get("hospital_references_count", ""),
        },
        "commercial_terms": {
            "quoted_price_cr": extracted.get("quoted_price_cr", ""),
            "currency": extracted.get("currency", ""),
            "advance_payment_pct": extracted.get("advance_payment_pct", ""),
        },
        "delivery_and_installation": {
            "delivery_timeline_months": extracted.get("delivery_timeline_months", ""),
            "installation_responsibility": extracted.get("installation_responsibility", ""),
        },
        "warranty_and_service": {
            "warranty_start_trigger": extracted.get("warranty_start_trigger", ""),
            "service_response_target": extracted.get("service_response_target", ""),
            "local_service_team_available": extracted.get("local_service_team_available", ""),
        },
        "training_and_handover": {
            "training_included": extracted.get("training_included", ""),
        },
        "compliance_claims": extracted.get("compliance_claims", []),
        "differentiators": differentiators,
        "omissions_or_ambiguities": omissions,
        "unusual_terms": unusual_terms,
        "proposal_quality": _proposal_quality(text, omissions),
        "follow_up_questions": _follow_up_questions(extracted, omissions),
        "evidence_snippets": _evidence_snippets(text),
    }


def _proposal_quality(text: str, omissions: List[str]) -> Dict[str, object]:
    lower = text.lower()
    marketing_heavy = "brand reputation" in lower or "market differentiation" in lower
    operational_signals = sum(
        1
        for word in ("delivery", "warranty", "installation", "training", "service", "compliance")
        if word in lower
    )
    return {
        "specificity": "medium" if operational_signals >= 4 else "low",
        "marketing_heavy": marketing_heavy,
        "omission_count": len(omissions),
        "summary": (
            "Proposal includes some operational fields but leaves lifecycle/service details incomplete."
            if omissions
            else "Proposal includes the main operational fields visible in extracted text."
        ),
    }


def _follow_up_questions(
    extracted: Dict[str, object],
    omissions: List[str],
) -> List[str]:
    questions = [
        "Please confirm final price, advance payment, retention, and payment milestones.",
        "Please confirm installation, commissioning, acceptance, and handover responsibilities.",
        "Please provide evidence for certification and regulatory claims.",
    ]
    if extracted.get("training_included") is False:
        questions.append("Can training be included with scope, audience, duration, and acceptance criteria?")
    if omissions:
        questions.append("Please clarify omitted lifecycle items including spares, consumables, service remedies, and recurring charges.")
    return questions


def _evidence_snippets(text: str) -> List[str]:
    snippets = []
    keywords = (
        "Vendor:",
        "Commercial Offer:",
        "Delivery and Warranty:",
        "Training and Service:",
        "Compliance Claims:",
        "Company Profile:",
    )
    for line in text.splitlines():
        clean = _clean(line)
        if clean and any(clean.startswith(keyword) for keyword in keywords):
            snippets.append(clean[:240])
    return snippets[:10]


def _extraction_quality(text: str) -> str:
    if len(text.strip()) < 200:
        return "low"
    if len(_evidence_snippets(text)) >= 4:
        return "high"
    return "medium"


def _llm_enrichment(quote: Dict[str, str], raw_text: str) -> Dict[str, object]:
    if not has_api_key() or not raw_text.strip():
        return {}
    payload = {
        "quote": quote,
        "raw_document_text": raw_text[:MAX_LLM_TEXT_CHARS],
    }
    result = run_agent_llm(
        name=NAME,
        instructions=_build_instructions(),
        user_payload=json.dumps(payload),
        temperature=0.1,
    )
    return result or {}


def _build_instructions() -> str:
    try:
        profile = PROFILE_PATH.read_text(encoding="utf-8")
    except Exception:
        profile = ""
    if profile:
        return f"{INSTRUCTIONS}\n\n# Vendor Proposal Agent profile\n{profile}\n"
    return INSTRUCTIONS


def _safe_dict(value: object) -> Dict[str, object]:
    return value if isinstance(value, dict) else {}


def _clean(value: object) -> str:
    return " ".join(str(value).strip().split())
