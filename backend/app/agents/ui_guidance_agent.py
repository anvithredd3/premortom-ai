"""RFQ Intake and Negotiation UI Guidance Agent.

This agent prepares structured guidance for two frontend workflows:

1. RFQ intake and requirement refinement before vendor quotes are issued.
2. Final contract negotiation preparation after a vendor quote is reviewed.

It intentionally returns an artifact-style dictionary instead of AgentResult
because it is not a risk-scoring agent.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

from . import vendor_proposal_agent
from ..services import document_parser
from ..services.llm import has_api_key, run_agent_llm

NAME = "RFQ Intake and Negotiation UI Guidance Agent"
PROFILE_PATH = Path(__file__).resolve().parents[2] / "agent_profiles" / "ui_guidance_agent_profile.md"
MAX_DOCUMENT_CHARS = 12000

INSTRUCTIONS = """
You are the RFQ Intake and Negotiation UI Guidance Agent for PreMortem AI.

You support two frontend workflows:
1. RFQ intake: help management, doctors, technicians, biomedical engineering,
   and procurement users create realistic RFQ requirements before vendor quotes.
2. Final negotiation: help users prepare vendor clarification and contract
   negotiation questions after reviewing a quote.

Return one JSON object with these keys:
- agent: string
- status: "completed"
- source_name: string
- mode: "rfq_and_negotiation"
- rfq_intake: object with keys requirement_summary, suggested_requirements,
  minimum_criteria, negotiable_criteria, missing_inputs
- negotiation_guidance: object with keys negotiation_questions,
  contract_conditions, cost_or_lifecycle_items, vendor_message_draft
- evidence: list of strings
- guardrails: list of strings

Rules:
- Use supplied vendor proposal intelligence and document text as evidence.
- Do not invent prices, certifications, or vendor commitments.
- Draft messages only; do not send messages or make final decisions.
- Use careful language when evidence is weak or missing.
"""


def analyze_pdf_path(pdf_path: str | Path) -> Dict[str, object]:
    """Read a PDF from disk, extract text, and return guidance."""
    path = Path(pdf_path)
    quote = {
        "quote_id": path.stem,
        "pdf_path": str(path),
    }
    proposal = vendor_proposal_agent.analyze_pdf_path(quote=quote, pdf_path=path)
    return analyze_vendor_proposal(proposal, source_name=path.name)


def analyze_vendor_proposal(
    vendor_proposal: Dict[str, object],
    source_name: str = "vendor_proposal",
) -> Dict[str, object]:
    """Return guidance using a Vendor Proposal Agent artifact record."""
    text = str(
        ((vendor_proposal.get("proposal_text") or {}).get("raw_text"))
        if isinstance(vendor_proposal.get("proposal_text"), dict)
        else ""
    )
    extracted_fields = document_parser.extract_fields(text)
    payload = {
        "source_name": source_name,
        "mode": "rfq_and_negotiation",
        "vendor_proposal": _compact_vendor_proposal(vendor_proposal),
        "extracted_fields": extracted_fields,
        "document_text": text[:MAX_DOCUMENT_CHARS],
    }

    if has_api_key():
        result = run_agent_llm(
            name=NAME,
            instructions=_build_instructions(),
            user_payload=json.dumps(payload),
            temperature=0.1,
        )
        if result:
            return _normalize_result(result, source_name)

    return _offline_result(
        text=text,
        source_name=source_name,
        extracted_fields=extracted_fields,
        vendor_proposal=vendor_proposal,
    )


def analyze_text(*, raw_document_text: str, source_name: str = "uploaded_document") -> Dict[str, object]:
    """Return RFQ intake and negotiation guidance for extracted document text."""
    text = raw_document_text or ""
    payload = {
        "source_name": source_name,
        "mode": "rfq_and_negotiation",
        "extracted_fields": document_parser.extract_fields(text),
        "document_text": text[:MAX_DOCUMENT_CHARS],
    }

    if has_api_key():
        result = run_agent_llm(
            name=NAME,
            instructions=_build_instructions(),
            user_payload=json.dumps(payload),
            temperature=0.1,
        )
        if result:
            return _normalize_result(result, source_name)

    return _offline_result(
        text=text,
        source_name=source_name,
        extracted_fields=payload["extracted_fields"],
        vendor_proposal={},
    )


def _build_instructions() -> str:
    profile = ""
    try:
        profile = PROFILE_PATH.read_text(encoding="utf-8")
    except Exception:
        profile = ""
    if not profile:
        return INSTRUCTIONS
    return f"{INSTRUCTIONS}\n\n# Agent profile memory\n{profile}\n"


def _normalize_result(result: Dict[str, object], source_name: str) -> Dict[str, object]:
    result["agent"] = str(result.get("agent") or NAME)
    result["status"] = str(result.get("status") or "completed")
    result["source_name"] = str(result.get("source_name") or source_name)
    result["mode"] = str(result.get("mode") or "rfq_and_negotiation")
    result.setdefault("rfq_intake", {})
    result.setdefault("negotiation_guidance", {})
    result.setdefault("evidence", [])
    result.setdefault("guardrails", _guardrails())
    return result


def _offline_result(
    *,
    text: str,
    source_name: str,
    extracted_fields: Dict[str, object],
    vendor_proposal: Dict[str, object],
) -> Dict[str, object]:
    lower = text.lower()
    intelligence = _safe_dict(vendor_proposal.get("proposal_intelligence"))
    fixed_features = _safe_dict(vendor_proposal.get("fixed_features"))
    evidence = _evidence_lines(text, intelligence)
    omissions = _as_strings(intelligence.get("omissions_or_ambiguities"))
    unusual_terms = _as_strings(intelligence.get("unusual_terms"))
    follow_up_questions = _as_strings(intelligence.get("follow_up_questions"))
    suggested_requirements = [
        "Define required MRI capability, clinical use cases, accepted makes/models or equivalent specifications.",
        "State installation, commissioning, acceptance, training, warranty, service, uptime, and spare-parts expectations explicitly.",
        "Separate mandatory minimum criteria from negotiable preferences before quotes are compared.",
    ]
    minimum_criteria = [
        "Delivery, installation, commissioning, and acceptance responsibilities must be measurable.",
        "Warranty start trigger must be tied to commissioning or acceptance where possible.",
        "Training, uptime, response time, spare parts, and preventive maintenance obligations must be stated.",
    ]
    negotiable_criteria = [
        "Advance payment percentage and retention terms.",
        "Warranty extension, uptime remedies, spare-parts commitment, and training refreshers.",
        "Consumables, software subscriptions, calibration, and recurring service-cost inclusions.",
    ]
    missing_inputs = _missing_inputs(lower, extracted_fields, omissions)
    negotiation_questions = [
        "Can the vendor confirm whether warranty starts after commissioning or final acceptance instead of delivery?",
        "Can payment milestones be tied to delivery, installation, commissioning, training completion, and acceptance?",
        "Which consumables, spare parts, service kits, software licenses, and calibration activities are included versus separately billed?",
        "What response time, resolution time, uptime, preventive maintenance, and spare-parts availability commitments are contractually binding?",
    ]
    negotiation_questions.extend(follow_up_questions)

    if "advance" in lower:
        negotiation_questions.append("What protection, retention, or bank guarantee applies to any advance payment?")
    if "training" not in lower:
        missing_inputs.append("Training scope is not clearly visible in the extracted document text.")
    if "service" not in lower and "maintenance" not in lower:
        missing_inputs.append("Service and maintenance obligations are not clearly visible in the extracted document text.")

    return {
        "agent": NAME,
        "status": "offline" if not has_api_key() else "completed",
        "source_name": source_name,
        "mode": "rfq_and_negotiation",
        "rfq_intake": {
            "requirement_summary": _requirement_summary(extracted_fields),
            "suggested_requirements": suggested_requirements,
            "minimum_criteria": minimum_criteria,
            "negotiable_criteria": negotiable_criteria,
            "missing_inputs": _dedupe(missing_inputs),
        },
        "negotiation_guidance": {
            "negotiation_questions": _dedupe(negotiation_questions),
            "contract_conditions": [
                "Convert vendor promises into measurable contract conditions before award.",
                "Require acceptance-based payment and warranty language where feasible.",
                "Document included and excluded lifecycle-cost items before final negotiation.",
            ],
            "cost_or_lifecycle_items": [
                "Consumables and recurring supplies.",
                "Spare parts, coils, service kits, software subscriptions, and calibration.",
                "AMC/CMC, preventive maintenance, corrective maintenance, uptime remedies, and training refreshers.",
            ],
            "vendor_message_draft": _vendor_message_draft(),
        },
        "evidence": evidence,
        "vendor_proposal_context": _vendor_context(fixed_features, intelligence),
        "risk_or_negotiation_signals": _dedupe(unusual_terms + omissions),
        "guardrails": _guardrails(),
    }


def _requirement_summary(extracted_fields: Dict[str, object]) -> str:
    if not extracted_fields:
        return "Use the uploaded quote as a starting point, but collect structured RFQ expectations before final negotiation."
    parts = [f"{key}={value}" for key, value in sorted(extracted_fields.items())]
    return "Extracted document hints: " + ", ".join(parts)


def _missing_inputs(
    lower: str,
    extracted_fields: Dict[str, object],
    omissions: List[str],
) -> List[str]:
    missing = []
    if "contract_value_cr" not in extracted_fields and "price" not in lower and "value" not in lower:
        missing.append("Budget or expected contract value is not clearly visible.")
    if "warranty" not in lower:
        missing.append("Warranty duration and start trigger are not clearly visible.")
    if "installation" not in lower and "commissioning" not in lower:
        missing.append("Installation, commissioning, and acceptance responsibility are not clearly visible.")
    if "spare" not in lower and "parts" not in lower:
        missing.append("Spare-parts commitment is not clearly visible.")
    if "consumable" not in lower:
        missing.append("Consumables and recurring supply responsibility are not clearly visible.")
    missing.extend(omissions)
    return missing


def _evidence_lines(text: str, intelligence: Dict[str, object]) -> List[str]:
    snippets = _as_strings(intelligence.get("evidence_snippets"))
    if snippets:
        return snippets[:8]
    lines = []
    keywords = (
        "vendor",
        "warranty",
        "advance",
        "installation",
        "commissioning",
        "training",
        "service",
        "maintenance",
        "spare",
        "consumable",
    )
    for raw_line in text.splitlines():
        line = " ".join(raw_line.split())
        if not line:
            continue
        if any(keyword in line.lower() for keyword in keywords):
            lines.append(line[:240])
        if len(lines) >= 8:
            break
    if lines:
        return lines
    preview = " ".join(text.split())[:500]
    return [preview] if preview else ["No extractable document text was available."]


def _compact_vendor_proposal(vendor_proposal: Dict[str, object]) -> Dict[str, object]:
    return {
        "quote_id": vendor_proposal.get("quote_id", ""),
        "fixed_features": vendor_proposal.get("fixed_features", {}),
        "proposal_intelligence": vendor_proposal.get("proposal_intelligence", {}),
        "raw_text_reference": vendor_proposal.get("raw_text_reference", {}),
    }


def _vendor_context(
    fixed_features: Dict[str, object],
    intelligence: Dict[str, object],
) -> Dict[str, object]:
    return {
        "vendor_name": _feature_value(fixed_features, "vendor_name"),
        "quoted_price_cr": _feature_value(fixed_features, "quoted_price_cr"),
        "advance_payment_pct": _feature_value(fixed_features, "advance_payment_pct"),
        "warranty_start_trigger": _feature_value(fixed_features, "warranty_start_trigger"),
        "installation_responsibility": _feature_value(fixed_features, "installation_responsibility"),
        "training_included": _feature_value(fixed_features, "training_included"),
        "proposal_quality": intelligence.get("proposal_quality", {}),
        "differentiators": intelligence.get("differentiators", []),
    }


def _feature_value(fixed_features: Dict[str, object], key: str) -> object:
    feature = fixed_features.get(key)
    if isinstance(feature, dict):
        return feature.get("value", "")
    return ""


def _safe_dict(value: object) -> Dict[str, object]:
    return value if isinstance(value, dict) else {}


def _as_strings(value: object) -> List[str]:
    if not isinstance(value, list):
        return []
    items = []
    for item in value:
        if isinstance(item, dict):
            parts = [str(v) for v in item.values() if v not in (None, "")]
            if parts:
                items.append(" - ".join(parts))
        elif item not in (None, ""):
            items.append(str(item))
    return items


def _vendor_message_draft() -> str:
    return (
        "Please confirm the final commercial and service terms before award, "
        "including installation and commissioning responsibilities, acceptance "
        "criteria, warranty start trigger, payment milestones, training scope, "
        "service SLA, spare-parts availability, consumables, software or "
        "calibration charges, and any exclusions that may affect lifecycle cost."
    )


def _guardrails() -> List[str]:
    return [
        "Draft guidance only; human users accept final RFQ or negotiation language.",
        "Do not send vendor messages automatically.",
        "Do not change accepted criteria without user confirmation.",
        "Do not make final procurement decisions.",
    ]


def _dedupe(items: List[str]) -> List[str]:
    seen = set()
    deduped = []
    for item in items:
        key = _dedupe_key(item)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _dedupe_key(item: str) -> str:
    key = item.lower()
    for word in ("clearly", "visible", "stated", "the", "or", "and"):
        key = key.replace(word, "")
    return " ".join(key.replace("-", " ").replace(".", "").split())
