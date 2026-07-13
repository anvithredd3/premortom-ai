#!/usr/bin/env python3
"""Generate synthetic PDF quote inputs for the procurement experiment.

The generated PDFs are intentionally simple but realistic enough to exercise
document parsing, missing-information detection, criteria scoring, and ground
truth evaluation.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def require_reportlab():
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    except ImportError as exc:
        raise SystemExit(
            "reportlab is required to generate PDF quote files. "
            "Install backend requirements first, for example: "
            "cd backend && uv pip install -r requirements.txt"
        ) from exc
    return A4, getSampleStyleSheet, Paragraph, SimpleDocTemplate, Spacer


def clamp(value: float, low: int = 0, high: int = 100) -> int:
    return max(low, min(high, round(value)))


def score_quote(
    rng: random.Random,
    base_range: List[int],
    vendor_type: Dict[str, Any],
    criteria_ids: List[str],
) -> Dict[str, int]:
    base = rng.uniform(base_range[0], base_range[1])
    biases = vendor_type.get("score_bias", {})
    return {
        criterion_id: clamp(base + biases.get(criterion_id, 0) + rng.uniform(-8, 8))
        for criterion_id in criteria_ids
    }


def weighted_score(scores: Dict[str, int], weighted_criteria: List[Dict[str, Any]]) -> float:
    total = 0.0
    for criterion in weighted_criteria:
        total += scores[criterion["id"]] * (criterion["weight_pct"] / 100.0)
    return round(total, 2)


def choose_with_coverage(
    rng: random.Random,
    options: List[Any],
    coverage: Dict[str, Dict[str, int]],
    dimension: str,
    label_fn=None,
) -> Any:
    """Choose an option, preferring values with lower existing coverage."""
    if not coverage:
        return rng.choice(options)
    label_fn = label_fn or (lambda item: str(item))
    counts = coverage.setdefault(dimension, {})
    min_count = min(counts.get(label_fn(option), 0) for option in options)
    candidates = [
        option for option in options if counts.get(label_fn(option), 0) == min_count
    ]
    selected = rng.choice(candidates)
    counts[label_fn(selected)] = counts.get(label_fn(selected), 0) + 1
    return selected


def build_quote_text(
    bid: Dict[str, Any],
    quote: Dict[str, Any],
    category: Dict[str, Any],
    format_variation: str,
) -> str:
    compliance = ", ".join(quote["compliance_claims"]) or "not clearly stated"
    strengths = {
        "complete": "The quote includes a technical specification, commercial offer, installation plan, training plan, warranty terms, service support details, and compliance statement.",
        "partially_complete": "The quote provides price and delivery details, but leaves some service and compliance evidence unclear.",
        "overly_promotional": "The quote emphasizes brand reputation, patient confidence, and market differentiation more than operational details.",
        "compliance_heavy": "The quote focuses strongly on standards, certifications, regulatory documentation, and audit readiness.",
        "price_heavy": "The quote emphasizes low purchase price and fast shipment, with limited explanation of long-term operating cost.",
        "service_heavy": "The quote emphasizes local service coverage, spare parts access, response time, uptime support, and escalation process."
    }
    return "\n\n".join(
        [
            f"Vendor Quote: {quote['quote_id']}",
            f"Vendor: {quote['vendor_name']} ({quote['vendor_type_label']})",
            f"Legal Entity: {quote['company_legal_name']}",
            f"Registered Address: {quote['company_address']}",
            f"Contact: {quote['contact_person']}, {quote['contact_email']}, {quote['contact_phone']}",
            f"Company Profile: {quote['years_in_operation']} years in operation, {quote['similar_hospital_references']} similar hospital references, estimated quote length {quote['page_count_hint']} pages.",
            f"Procurement: {bid['procurement_name']} - {category['equipment_type']}",
            f"Commercial Offer: INR {quote['contract_value_cr']:.2f} Cr with {quote['advance_payment_pct']}% advance payment.",
            f"Delivery and Warranty: Delivery in {quote['delivery_timeline_months']:.1f} months. Warranty starts {quote['warranty_start']}. Installation responsibility: {quote['installation_responsibility']}.",
            f"Training and Service: Training included: {quote['training_included']}. Service response target: {quote['service_response_hours']} hours. Local service team: {quote['local_service_team']}.",
            f"Compliance Claims: {compliance}.",
            strengths[format_variation],
            "Company Details: The vendor states experience with hospital equipment procurement and provides references where available. Some claims may require verification during technical evaluation.",
        ]
    )


def write_pdf(path: Path, title: str, body: str) -> None:
    try:
        A4, get_styles, Paragraph, SimpleDocTemplate, Spacer = require_reportlab()
    except SystemExit:
        if _write_libreoffice_pdf(path, title, body):
            return
        _write_simple_pdf(path, title, body)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    styles = get_styles()
    doc = SimpleDocTemplate(str(path), pagesize=A4, title=title)
    story = [Paragraph(title, styles["Title"]), Spacer(1, 12)]
    for para in body.split("\n\n"):
        story.append(Paragraph(para.replace("\n", "<br/>"), styles["BodyText"]))
        story.append(Spacer(1, 8))
    doc.build(story)


def _write_libreoffice_pdf(path: Path, title: str, body: str) -> bool:
    soffice = shutil.which("libreoffice") or shutil.which("soffice")
    if not soffice:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        source = tmp_path / f"{path.stem}.txt"
        source.write_text(f"{title}\n\n{body}\n", encoding="utf-8")
        result = subprocess.run(
            [
                soffice,
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(tmp_path),
                str(source),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        converted = tmp_path / f"{path.stem}.pdf"
        if result.returncode != 0 or not converted.exists():
            return False
        shutil.copyfile(converted, path)
        return True


def _write_simple_pdf(path: Path, title: str, body: str) -> None:
    """Write a dependency-free, text-only PDF sufficient for parser demos."""
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [title, ""] + _wrap_pdf_lines(body)
    content_lines = ["BT", "/F1 10 Tf", "50 790 Td", "14 TL"]
    for line in lines[:52]:
        content_lines.append(f"({_escape_pdf_text(line)}) Tj")
        content_lines.append("T*")
    content_lines.append("ET")
    stream = "\n".join(content_lines).encode("latin-1", errors="replace")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for idx, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{idx} 0 obj\n".encode("ascii"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")
    xref_at = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_at}\n%%EOF\n"
        ).encode("ascii")
    )
    path.write_bytes(bytes(pdf))


def _wrap_pdf_lines(text: str, width: int = 88) -> list[str]:
    lines: list[str] = []
    for para in text.split("\n\n"):
        words = para.replace("\n", " ").split()
        current: list[str] = []
        for word in words:
            if sum(len(item) + 1 for item in current) + len(word) > width:
                lines.append(" ".join(current))
                current = [word]
            else:
                current.append(word)
        if current:
            lines.append(" ".join(current))
        lines.append("")
    return lines


def _escape_pdf_text(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def write_demo_rfq_responses(output_dir: Path, bid_id: str = "BID-001") -> None:
    """Write two curated MRI RFQ response PDFs for the RFQ-value demo loop."""
    bid_dir = output_dir / "bids" / bid_id
    quotes = [
        {
            "quote_id": f"{bid_id}-Q06",
            "vendor_name": "ApexCura Imaging Systems",
            "company_legal_name": "ApexCura Imaging Systems Private Limited",
            "equipment_type": "MRI Machine",
            "procurement_name": "MRI System",
            "contract_value_cr": 18.90,
            "delivery_timeline_months": 4.0,
            "advance_payment_pct": 10,
            "warranty_start": "On Commissioning",
            "installation_responsibility": "Vendor",
            "training_included": True,
            "vendor_type": "international_premium_brand",
            "vendor_type_label": "International premium brand",
            "archetype": "rfq_value_winner",
            "format_variation": "complete",
            "weighted_decision_score": 96.0,
            "criteria_scores": _demo_criteria_scores(96),
            "compliance_claims": ["IEC 60601", "ISO 13485", "Local regulatory approval"],
            "page_count_hint": 18,
            "body": _demo_top_quote_text(f"{bid_id}-Q06"),
        },
        {
            "quote_id": f"{bid_id}-Q07",
            "vendor_name": "ValueMed Diagnostics",
            "company_legal_name": "ValueMed Diagnostics Private Limited",
            "equipment_type": "MRI Machine",
            "procurement_name": "MRI System",
            "contract_value_cr": 17.60,
            "delivery_timeline_months": 4.5,
            "advance_payment_pct": 25,
            "warranty_start": "On Installation",
            "installation_responsibility": "Shared",
            "training_included": True,
            "vendor_type": "local_supplier_strong_support",
            "vendor_type_label": "Local supplier with strong support",
            "archetype": "rfq_lower_cost_comparator",
            "format_variation": "service_heavy",
            "weighted_decision_score": 78.0,
            "criteria_scores": _demo_criteria_scores(78),
            "compliance_claims": ["IEC 60601", "ISO 13485"],
            "page_count_hint": 11,
            "body": _demo_comparator_quote_text(f"{bid_id}-Q07"),
        },
    ]
    for quote in quotes:
        pdf_path = bid_dir / f"{quote['quote_id']}.pdf"
        write_pdf(pdf_path, f"{quote['quote_id']} Vendor RFQ Response", quote["body"])
        quote["pdf_path"] = f"bids/{bid_id}/{quote['quote_id']}.pdf"
        quote["pdf_url"] = ""
        quote["original_filename"] = f"{quote['quote_id']}.pdf"
    _upsert_bids_database(output_dir / "bids_database.csv", bid_id, quotes)
    _upsert_demo_metadata(output_dir, bid_id, quotes)
    print(f"Wrote {len(quotes)} curated RFQ response PDFs to {bid_dir}")
    print(f"Registered {', '.join(quote['quote_id'] for quote in quotes)} in {output_dir / 'bids_database.csv'}")


def _demo_criteria_scores(base: int) -> dict[str, int]:
    return {
        "clinical_fit": base,
        "total_cost_of_ownership": max(0, base - 8),
        "service_maintenance_readiness": base,
        "infrastructure_workforce_readiness": max(0, base - 4),
        "training_workforce_readiness": base,
        "strategic_business_value": base,
        "vendor_reliability": max(0, base - 2),
        "financial_terms": max(0, base - 5),
        "brand_market_acceptance": max(0, base - 3),
        "regulatory_compliance": base,
    }


def _demo_top_quote_text(quote_id: str) -> str:
    return "\n\n".join(
        [
            f"Vendor Quote: {quote_id}",
            "Vendor: ApexCura Imaging Systems (Premium integrated MRI and AI diagnostics supplier)",
            "Legal Entity: ApexCura Imaging Systems Private Limited",
            "Registered Address: 402 Medical Technology Park, Bengaluru, India",
            "Contact: Dr. Meera Shah, rfq-response@apexcura.example, +91-98765-21045",
            "Company Profile: 18 years in operation, 52 similar hospital MRI installations, local service offices in Mumbai, Pune, Bengaluru, Delhi, and Hyderabad.",
            "Procurement: MRI System - MRI Machine",
            "Commercial Offer: INR 18.90 Cr total package price. This is higher than the base budget because it includes AI-based organ coloring, AI-based infected tissue detection support, scan calibration/focus control, installation, commissioning, and a five-year uptime-backed service plan. A negotiation discount of INR 0.20 Cr is offered if the buyer confirms AI-based organ coloring and infection-detection workflow as accepted RFQ value items during technical negotiation.",
            "Advance Payment and Security: 10% advance payment against bank guarantee. 20% on delivery to site, 40% after installation and commissioning, 20% after acceptance testing, and 10% retention released after 90 days of successful operation.",
            "Delivery and Warranty: Delivery in 4.0 months. Warranty starts on commissioning and buyer acceptance, not delivery. Full warranty duration is 36 months after acceptance.",
            "Installation Responsibility: Vendor owns delivery coordination, installation, commissioning, calibration, acceptance testing, and handover. Buyer dependencies are limited to civil readiness, power availability, and site access dates agreed in the installation plan.",
            "Clinical Capability: Includes core MRI imaging capability, scan calibration/focus control, patient throughput workflow, AI-based organ coloring/marking, AI-based infected tissue detection assistance, artifact flagging, and radiology workflow export. AI outputs are decision support only and must remain under doctor review.",
            "Training and Handover: Training included for radiologists, MRI technicians, biomedical engineers, and administrators. Includes five onsite sessions, competency checklist, completion certificates, operating SOPs, preventive maintenance handover, and emergency escalation workflow.",
            "Service Support: 12-hour response target, 48-hour resolution target for critical failures, 98% uptime commitment excluding force majeure and buyer-caused downtime, local service team, spare-parts buffer in India, quarterly preventive maintenance, escalation matrix, and service-credit remedy for missed SLA.",
            "Compliance Claims: IEC 60601, ISO 13485, local regulatory approval, cybersecurity hardening note, DICOM workflow support, audit logs for AI module usage, and validation documentation available during technical evaluation.",
            "Acceptance Criteria: Site acceptance test, image-quality phantom test, commissioning report, AI workflow demonstration, uptime monitoring setup, training completion evidence, and signed buyer acceptance are required before final payment milestone.",
            "RFQ Requirement Coverage Statement: The vendor confirms coverage of high-value doctor requirements for MRI function, scan focus control, AI organ coloring, AI infected tissue detection, and patient workflow; biomedical engineering requirements for installation, commissioning, SLA, spares, maintenance, training, and handover; finance requirements for payment milestones, TCO visibility, AMC/CMC separation, and software subscription disclosure; procurement requirements for measurable delivery, warranty, vendor obligations, and comparable quote format.",
            "Commercial Note: The quoted price is deliberately not the lowest offer. The vendor believes the added clinical AI features, commissioning-linked warranty, secured payment structure, and enforceable service plan provide higher buyer value and lower execution risk.",
        ]
    )


def _demo_comparator_quote_text(quote_id: str) -> str:
    return "\n\n".join(
        [
            f"Vendor Quote: {quote_id}",
            "Vendor: ValueMed Diagnostics (Value-oriented MRI supplier)",
            "Legal Entity: ValueMed Diagnostics Private Limited",
            "Registered Address: 77 Healthcare Plaza, Pune, India",
            "Contact: Rohan Mehta, sales@valuemed.example, +91-91234-55770",
            "Company Profile: 9 years in operation, 17 similar hospital references, local support partner in Pune and Mumbai.",
            "Procurement: MRI System - MRI Machine",
            "Commercial Offer: INR 17.60 Cr base package price. Price includes MRI hardware, delivery, basic installation support, standard warranty, and first-year preventive maintenance. AI-based organ coloring and infected tissue detection are not included in the base price and are available only as future paid software options.",
            "Advance Payment and Security: 25% advance payment. 35% on delivery, 30% after installation, and 10% after acceptance. Bank guarantee is available for the advance but must be requested in the purchase order.",
            "Delivery and Warranty: Delivery in 4.5 months. Warranty starts on installation. Warranty duration is 24 months.",
            "Installation Responsibility: Vendor provides installation supervision and commissioning support. Buyer is responsible for site readiness, electrical readiness, shielding readiness, and local rigging support.",
            "Clinical Capability: Includes core MRI imaging, routine scan protocols, and standard radiology workflow export. Does not include AI organ coloring, AI infected tissue detection, or advanced artifact detection in the base quote.",
            "Training and Handover: Training included for MRI technicians and biomedical engineering users. Radiologist workflow training is optional and separately quoted. Training plan gives two onsite sessions but does not define competency evidence.",
            "Service Support: 24-hour response target, local service partner, annual preventive maintenance, and spare-parts support subject to availability. No explicit resolution-time target, uptime commitment, service credits, or remedy for missed SLA is stated.",
            "Compliance Claims: IEC 60601 and ISO 13485 claimed. Local regulatory approval documentation will be submitted before final technical evaluation.",
            "Acceptance Criteria: Installation report and basic image-quality demonstration are included. AI workflow demonstration is not applicable because AI modules are not included.",
            "RFQ Requirement Coverage Statement: The vendor covers core MRI imaging and basic delivery obligations at a lower price, but clinical AI requirements, commissioning-linked warranty, detailed service remedies, and full lifecycle software disclosure require negotiation or add-on pricing.",
            "Commercial Note: This quote is positioned as a lower-cost alternative. It may be suitable if the buyer reduces clinical AI value weighting or treats AI organ coloring and infected tissue detection as optional future modules.",
        ]
    )


def _upsert_bids_database(path: Path, bid_id: str, quotes: list[dict[str, str]]) -> None:
    fieldnames = [
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
    existing: list[dict[str, str]] = []
    if path.exists():
        with path.open("r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            existing = list(reader)
    now = datetime.now(timezone.utc).isoformat()
    skip_quote_ids = {quote["quote_id"] for quote in quotes}
    rows = [
        row for row in existing
        if not (row.get("bid_id") == bid_id and row.get("quote_id") in skip_quote_ids)
    ]
    for quote in quotes:
        rows.append(
            {
                "bid_id": bid_id,
                "quote_id": quote["quote_id"],
                "vendor_name": quote["vendor_name"],
                "equipment_type": quote["equipment_type"],
                "procurement_name": quote["procurement_name"],
                "source": "synthetic_rfq_response",
                "status": "ready",
                "pdf_path": quote["pdf_path"],
                "original_filename": quote["original_filename"],
                "created_at": now,
                "updated_at": now,
            }
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _upsert_demo_metadata(output_dir: Path, bid_id: str, quotes: list[dict[str, Any]]) -> None:
    metadata_path = output_dir / "metadata.json"
    config = load_json(Path("files/input/criteria.json"))
    if metadata_path.exists():
        metadata = load_json(metadata_path)
    else:
        metadata = {
            "experiment": config["experiment"],
            "criteria": config["weighted_decision_criteria"],
            "guardrails": config["guardrails"],
            "bids": [],
        }
    bids = metadata.setdefault("bids", [])
    bid = next((item for item in bids if item.get("bid_id") == bid_id), None)
    if bid is None:
        bid = {
            "bid_id": bid_id,
            "procurement_name": "MRI System",
            "equipment_type": "MRI Machine",
            "hospital_context": {
                "hospital_type": "medium_hospital",
                "city_tier": "tier_2",
                "construction_completion_pct": 60,
                "electrical_readiness": "Pending",
                "regulatory_approval_status": "Pending",
                "technicians_available": 0,
                "technicians_required": 6,
                "historical_delays_months": [8.0, 11.0, 7.0],
            },
            "published_bid_criteria": {
                "contract_value_expected_cr": 18.0,
                "delivery_timeline_expected_months": 4.0,
                "warranty_start_preference": "On Commissioning",
                "installation_responsibility_preference": "Vendor",
                "compliance_required": ["IEC 60601", "ISO 13485"],
                "training_required": True,
            },
            "quotes": [],
        }
        bids.append(bid)
    existing = [
        quote for quote in bid.get("quotes", [])
        if quote.get("quote_id") not in {item["quote_id"] for item in quotes}
    ]
    sanitized_quotes = []
    for quote in quotes:
        sanitized = {key: value for key, value in quote.items() if key not in {"body", "original_filename"}}
        sanitized_quotes.append(sanitized)
    bid["quotes"] = existing + sanitized_quotes
    _refresh_bid_ground_truth(bid)
    metadata["experiment"] = {
        **metadata.get("experiment", {}),
        "num_bids": len(bids),
        "num_samples": sum(len(item.get("quotes", [])) for item in bids),
    }
    write_json(metadata_path, metadata)
    write_manifest(output_dir, bids)
    write_dataset(output_dir, bids)
    write_coverage(output_dir, config, bids)


def _refresh_bid_ground_truth(bid: dict[str, Any]) -> None:
    ranked = sorted(
        bid.get("quotes", []),
        key=lambda quote: float(quote.get("weighted_decision_score") or 0),
        reverse=True,
    )
    if not ranked:
        return
    bid["ground_truth"] = {
        "top_1": ranked[0]["quote_id"],
        "top_2": [quote["quote_id"] for quote in ranked[:2]],
        "top_3": [quote["quote_id"] for quote in ranked[:3]],
        "notes": (
            "Ground truth is based on the current static weighted criteria. "
            "Dynamic RFQ-specific validation remains a post-demo evaluation task."
        ),
    }


def make_vendor_name(rng: random.Random, vendor_type: str, index: int) -> str:
    prefixes = {
        "international_premium_brand": ["MedNova", "PrimeHealth", "GlobalCare", "ApexMed"],
        "local_supplier_strong_support": ["CareAxis", "CityBio", "SonoCare", "MetroMedi"],
        "low_cost_vendor": ["ValueScan", "BudgetMed", "FastLab", "EconoCare"],
        "refurbished_supplier": ["RefurbMed", "RenewEquip", "ReLife Systems", "SecondCycle"],
        "new_entrant": ["MediBridge", "NeoHealth", "StartCare", "PulseEdge"],
    }
    suffixes = ["Healthcare", "Diagnostics", "Systems", "Technologies", "Devices"]
    return f"{rng.choice(prefixes[vendor_type])} {rng.choice(suffixes)} {index:02d}"


def make_company_profile(rng: random.Random, vendor_name: str, vendor_type: str) -> Dict[str, Any]:
    cities = ["Pune", "Mumbai", "Bengaluru", "Hyderabad", "Delhi", "Chennai", "Ahmedabad"]
    areas = ["Industrial Estate", "Medical Tech Park", "Business Center", "Healthcare Plaza"]
    city = rng.choice(cities)
    years_range = {
        "international_premium_brand": (12, 45),
        "local_supplier_strong_support": (6, 22),
        "low_cost_vendor": (2, 12),
        "refurbished_supplier": (3, 18),
        "new_entrant": (1, 5),
    }[vendor_type]
    references_range = {
        "international_premium_brand": (12, 80),
        "local_supplier_strong_support": (8, 45),
        "low_cost_vendor": (1, 18),
        "refurbished_supplier": (1, 15),
        "new_entrant": (0, 6),
    }[vendor_type]
    page_range = {
        "complete": (12, 24),
        "partially_complete": (4, 10),
        "overly_promotional": (10, 22),
        "compliance_heavy": (18, 36),
        "price_heavy": (3, 8),
        "service_heavy": (10, 20),
    }
    return {
        "company_legal_name": f"{vendor_name} Private Limited",
        "company_address": f"{rng.randint(10, 999)}, {rng.choice(areas)}, {city}, India",
        "contact_person": rng.choice(["Anita Rao", "Rohan Mehta", "Kavita Iyer", "Sameer Khan", "Neha Shah"]),
        "contact_email": f"sales{rng.randint(1, 99)}@{vendor_name.lower().replace(' ', '')}.example",
        "contact_phone": f"+91-{rng.randint(70000, 99999)}-{rng.randint(10000, 99999)}",
        "years_in_operation": rng.randint(*years_range),
        "similar_hospital_references": rng.randint(*references_range),
        "page_count_range_by_format": page_range,
    }


def generate_bid(
    rng: random.Random,
    config: Dict[str, Any],
    bid_index: int,
    output_dir: Path,
    coverage: Optional[Dict[str, Dict[str, int]]] = None,
    quotes_per_bid: Optional[int] = None,
) -> Dict[str, Any]:
    category = choose_with_coverage(
        rng,
        config["bid_categories"],
        coverage or {},
        "equipment_type",
        lambda item: item["equipment_type"],
    )
    bid_id = f"BID-{bid_index:03d}"
    bid_dir = output_dir / "bids" / bid_id
    weighted_criteria = config["weighted_decision_criteria"]
    weighted_ids = [c["id"] for c in weighted_criteria]
    all_criteria_ids = [c["id"] for c in config["top_10_candidate_criteria"]]
    expected_value = rng.uniform(*category["expected_contract_value_cr"])
    expected_delivery = rng.uniform(*category["expected_delivery_months"])

    bid = {
        "bid_id": bid_id,
        "procurement_name": f"{category['equipment_type']} Procurement",
        "equipment_type": category["equipment_type"],
        "hospital_context": {
            "hospital_type": choose_with_coverage(
                rng, ["small_hospital", "medium_hospital"], coverage or {}, "hospital_type"
            ),
            "city_tier": choose_with_coverage(
                rng, ["tier_2", "tier_3"], coverage or {}, "city_tier"
            ),
            "construction_completion_pct": rng.choice([55, 70, 85, 95, 100]),
            "electrical_readiness": choose_with_coverage(
                rng,
                ["Approved", "Pending", "Not Started"],
                coverage or {},
                "electrical_readiness",
            ),
            "regulatory_approval_status": choose_with_coverage(
                rng,
                ["Approved", "Pending", "Not Started"],
                coverage or {},
                "regulatory_approval_status",
            ),
            "technicians_available": rng.randint(0, 6),
            "technicians_required": rng.randint(2, 6),
            "historical_delays_months": [round(rng.uniform(1, 12), 1) for _ in range(3)],
        },
        "published_bid_criteria": {
            "contract_value_expected_cr": round(expected_value, 2),
            "delivery_timeline_expected_months": round(expected_delivery, 1),
            "warranty_start_preference": "On Commissioning",
            "installation_responsibility_preference": "Vendor",
            "compliance_required": category["required_compliance"],
            "training_required": category["training_required"],
        },
        "quotes": [],
    }

    archetypes = []
    for archetype in config["quote_archetypes"]:
        archetypes.extend([archetype] * archetype["count_per_bid"])
    if quotes_per_bid:
        if quotes_per_bid <= len(archetypes):
            archetypes = archetypes[:quotes_per_bid]
        else:
            archetypes.extend(
                rng.choices(config["quote_archetypes"], k=quotes_per_bid - len(archetypes))
            )
    rng.shuffle(archetypes)

    for quote_index, archetype in enumerate(archetypes, start=1):
        vendor_type = choose_with_coverage(
            rng,
            config["vendor_types"],
            coverage or {},
            "vendor_type",
            lambda item: item["id"],
        )
        if coverage is not None:
            increment_coverage(coverage, "archetype", archetype["id"])
        quote_id = f"{bid_id}-Q{quote_index:02d}"
        scores = score_quote(rng, archetype["score_range"], vendor_type, all_criteria_ids)
        decision_scores = {criterion_id: scores[criterion_id] for criterion_id in weighted_ids}
        total_score = weighted_score(decision_scores, weighted_criteria)
        value_factor = rng.uniform(0.75, 1.35)
        if archetype["id"] == "high_risk":
            value_factor = rng.choice([rng.uniform(0.55, 0.8), rng.uniform(1.25, 1.55)])

        format_variation = choose_with_coverage(
            rng,
            config["quote_format_variations"],
            coverage or {},
            "quote_format_variation",
        )
        missing_compliance = archetype["id"] in {"high_risk", "edge_case"} and rng.random() < 0.45
        compliance_claims = (
            rng.sample(category["required_compliance"], rng.randint(1, len(category["required_compliance"])))
            if missing_compliance
            else list(category["required_compliance"])
        )
        vendor_name = make_vendor_name(rng, vendor_type["id"], quote_index)
        company_profile = make_company_profile(rng, vendor_name, vendor_type["id"])
        page_range = company_profile.pop("page_count_range_by_format")[format_variation]
        quote = {
            "quote_id": quote_id,
            "vendor_name": vendor_name,
            **company_profile,
            "page_count_hint": rng.randint(*page_range),
            "vendor_type": vendor_type["id"],
            "vendor_type_label": vendor_type["label"],
            "archetype": archetype["id"],
            "format_variation": format_variation,
            "contract_value_cr": round(expected_value * value_factor, 2),
            "advance_payment_pct": rng.choice([10, 20, 25, 30, 40, 50, 60, 70]),
            "delivery_timeline_months": round(expected_delivery * rng.uniform(0.65, 1.55), 1),
            "warranty_start": choose_with_coverage(
                rng,
                ["On Delivery", "On Installation", "On Commissioning"],
                coverage or {},
                "warranty_start",
            ),
            "installation_responsibility": choose_with_coverage(
                rng,
                ["Buyer", "Vendor", "Shared"],
                coverage or {},
                "installation_responsibility",
            ),
            "training_included": rng.random() > 0.18,
            "service_response_hours": rng.choice([8, 12, 18, 24, 48, 72, 96]),
            "local_service_team": rng.random() > 0.35,
            "compliance_claims": compliance_claims,
            "criteria_scores": scores,
            "weighted_decision_score": total_score,
        }
        quote_text = build_quote_text(bid, quote, category, format_variation)
        pdf_path = bid_dir / f"{quote_id}.pdf"
        write_pdf(pdf_path, f"{quote_id} Vendor Quote", quote_text)
        relative_pdf_path = pdf_path.relative_to(output_dir).as_posix()
        pdf_base_url = config["experiment"].get("pdf_base_url", "").rstrip("/")
        quote["pdf_path"] = relative_pdf_path
        quote["pdf_url"] = f"{pdf_base_url}/{relative_pdf_path}" if pdf_base_url else ""
        bid["quotes"].append(quote)

    ranked = sorted(bid["quotes"], key=lambda q: q["weighted_decision_score"], reverse=True)
    bid["ground_truth"] = {
        "top_1": ranked[0]["quote_id"],
        "top_2": [ranked[0]["quote_id"], ranked[1]["quote_id"]],
        "top_3": [q["quote_id"] for q in ranked[:3]],
        "notes": (
            "Ground truth is based on weighted criteria score with guardrail-sensitive "
            "synthetic quote generation. Human review can replace this label for real datasets."
        ),
    }
    return bid


def load_existing_coverage(metadata_path: Path) -> Dict[str, Dict[str, int]]:
    if not metadata_path.exists():
        return {}
    data = load_json(metadata_path)
    coverage: Dict[str, Dict[str, int]] = {}
    for bid in data.get("bids", []):
        increment_coverage(coverage, "equipment_type", bid.get("equipment_type", "unknown"))
        context = bid.get("hospital_context", {})
        for key in [
            "hospital_type",
            "city_tier",
            "electrical_readiness",
            "regulatory_approval_status",
        ]:
            increment_coverage(coverage, key, context.get(key, "unknown"))
        for quote in bid.get("quotes", []):
            increment_coverage(coverage, "vendor_type", quote.get("vendor_type", "unknown"))
            increment_coverage(coverage, "archetype", quote.get("archetype", "unknown"))
            increment_coverage(
                coverage,
                "quote_format_variation",
                quote.get("format_variation", "unknown"),
            )
            increment_coverage(coverage, "warranty_start", quote.get("warranty_start", "unknown"))
            increment_coverage(
                coverage,
                "installation_responsibility",
                quote.get("installation_responsibility", "unknown"),
            )
            increment_coverage(
                coverage,
                "quote_length",
                page_count_bucket(quote.get("page_count_hint", 0)),
            )
            for criterion_id, score in quote.get("criteria_scores", {}).items():
                increment_coverage(coverage, f"criterion:{criterion_id}", score_bucket(score))
            compliance_count = len(quote.get("compliance_claims", []))
            increment_coverage(
                coverage,
                "compliance_completeness",
                "partial" if compliance_count < 2 else "complete",
            )
    return coverage


def load_existing_bids(metadata_path: Path) -> List[Dict[str, Any]]:
    if not metadata_path.exists():
        return []
    data = load_json(metadata_path)
    return data.get("bids", [])


def next_bid_index(existing_bids: List[Dict[str, Any]]) -> int:
    indexes = []
    for bid in existing_bids:
        bid_id = bid.get("bid_id", "")
        try:
            indexes.append(int(bid_id.split("-")[-1]))
        except ValueError:
            continue
    return max(indexes, default=0) + 1


def increment_coverage(coverage: Dict[str, Dict[str, int]], dimension: str, value: Any) -> None:
    values = coverage.setdefault(dimension, {})
    label = str(value)
    values[label] = values.get(label, 0) + 1


def score_bucket(score: int) -> str:
    if score < 40:
        return "low_0_39"
    if score < 70:
        return "medium_40_69"
    return "high_70_100"


def page_count_bucket(page_count: int) -> str:
    if page_count <= 8:
        return "short_1_8_pages"
    if page_count <= 20:
        return "medium_9_20_pages"
    return "long_21_plus_pages"


def build_coverage_rows(config: Dict[str, Any], bids: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    coverage: Dict[str, Dict[str, int]] = {}
    for bid in bids:
        increment_coverage(coverage, "equipment_type", bid["equipment_type"])
        context = bid["hospital_context"]
        for key in [
            "hospital_type",
            "city_tier",
            "electrical_readiness",
            "regulatory_approval_status",
        ]:
            increment_coverage(coverage, key, context[key])
        for quote in bid["quotes"]:
            increment_coverage(coverage, "vendor_type", quote["vendor_type"])
            increment_coverage(coverage, "archetype", quote["archetype"])
            increment_coverage(coverage, "quote_format_variation", quote["format_variation"])
            increment_coverage(coverage, "warranty_start", quote["warranty_start"])
            increment_coverage(
                coverage,
                "installation_responsibility",
                quote["installation_responsibility"],
            )
            increment_coverage(
                coverage,
                "quote_length",
                page_count_bucket(quote.get("page_count_hint", 0)),
            )
            increment_coverage(
                coverage,
                "compliance_completeness",
                "complete"
                if len(quote.get("compliance_claims", [])) >= len(bid["published_bid_criteria"]["compliance_required"])
                else "partial",
            )
            for criterion_id, score in quote["criteria_scores"].items():
                increment_coverage(coverage, f"criterion:{criterion_id}", score_bucket(score))

    expected_values = {
        "equipment_type": [item["equipment_type"] for item in config["bid_categories"]],
        "hospital_type": ["small_hospital", "medium_hospital"],
        "city_tier": ["tier_2", "tier_3"],
        "electrical_readiness": ["Approved", "Pending", "Not Started"],
        "regulatory_approval_status": ["Approved", "Pending", "Not Started"],
        "vendor_type": [item["id"] for item in config["vendor_types"]],
        "archetype": [item["id"] for item in config["quote_archetypes"]],
        "quote_format_variation": config["quote_format_variations"],
        "warranty_start": ["On Delivery", "On Installation", "On Commissioning"],
        "installation_responsibility": ["Buyer", "Vendor", "Shared"],
        "compliance_completeness": ["complete", "partial"],
        "quote_length": ["short_1_8_pages", "medium_9_20_pages", "long_21_plus_pages"],
    }
    for criterion in config["top_10_candidate_criteria"]:
        expected_values[f"criterion:{criterion['id']}"] = [
            "low_0_39",
            "medium_40_69",
            "high_70_100",
        ]

    rows = []
    for dimension, values in expected_values.items():
        counts = coverage.get(dimension, {})
        target = max(1, sum(counts.values()) // max(1, len(values)))
        for value in values:
            count = counts.get(value, 0)
            rows.append(
                {
                    "dimension": dimension,
                    "value": value,
                    "count": count,
                    "target_count": target,
                    "missing_to_target": max(0, target - count),
                    "covered": count > 0,
                }
            )
    return rows


def write_coverage(output_dir: Path, config: Dict[str, Any], bids: List[Dict[str, Any]]) -> None:
    path = output_dir / "coverage.csv"
    rows = build_coverage_rows(config, bids)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "dimension",
                "value",
                "count",
                "target_count",
                "missing_to_target",
                "covered",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)


def write_manifest(output_dir: Path, bids: List[Dict[str, Any]]) -> None:
    path = output_dir / "manifest.csv"
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "bid_id",
                "quote_id",
                "vendor_name",
                "equipment_type",
                "archetype",
                "weighted_decision_score",
                "pdf_path",
                "is_top_1",
                "is_top_2",
            ],
        )
        writer.writeheader()
        for bid in bids:
            top_1 = bid["ground_truth"]["top_1"]
            top_2 = set(bid["ground_truth"]["top_2"])
            for quote in bid["quotes"]:
                writer.writerow(
                    {
                        "bid_id": bid["bid_id"],
                        "quote_id": quote["quote_id"],
                        "vendor_name": quote["vendor_name"],
                        "equipment_type": bid["equipment_type"],
                        "archetype": quote["archetype"],
                        "weighted_decision_score": quote["weighted_decision_score"],
                        "pdf_path": quote["pdf_path"],
                        "is_top_1": quote["quote_id"] == top_1,
                        "is_top_2": quote["quote_id"] in top_2,
                    }
                )


def write_dataset(output_dir: Path, bids: List[Dict[str, Any]]) -> None:
    path = output_dir / "dataset.csv"
    fieldnames = [
        "bid_id",
        "quote_id",
        "vendor_name",
        "company_legal_name",
        "equipment_type",
        "pdf_path",
        "pdf_url",
        "contract_value_cr",
        "delivery_timeline_months",
        "advance_payment_pct",
        "warranty_start",
        "installation_responsibility",
        "training_included",
        "vendor_type",
        "vendor_type_label",
        "archetype",
        "format_variation",
        "weighted_decision_score",
        "rank_in_bid",
        "is_top_1",
        "is_top_2",
        "is_top_3",
        "is_top_5",
        "ground_truth_label",
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for bid in bids:
            ranked = sorted(
                bid["quotes"],
                key=lambda quote: quote["weighted_decision_score"],
                reverse=True,
            )
            rank_by_quote = {
                quote["quote_id"]: rank
                for rank, quote in enumerate(ranked, start=1)
            }
            top_1 = bid["ground_truth"]["top_1"]
            top_2 = set(bid["ground_truth"]["top_2"])
            top_3 = set(bid["ground_truth"].get("top_3", []))
            top_5 = {quote["quote_id"] for quote in ranked[:5]}
            for quote in bid["quotes"]:
                quote_id = quote["quote_id"]
                rank = rank_by_quote[quote_id]
                if quote_id == top_1:
                    label = "winner"
                elif quote_id in top_2:
                    label = "top_2"
                elif quote_id in top_3:
                    label = "top_3"
                elif quote_id in top_5:
                    label = "top_5"
                else:
                    label = "not_selected"
                writer.writerow(
                    {
                        "bid_id": bid["bid_id"],
                        "quote_id": quote_id,
                        "vendor_name": quote["vendor_name"],
                        "company_legal_name": quote.get("company_legal_name", ""),
                        "equipment_type": bid["equipment_type"],
                        "pdf_path": quote["pdf_path"],
                        "pdf_url": quote.get("pdf_url", ""),
                        "contract_value_cr": quote.get("contract_value_cr", ""),
                        "delivery_timeline_months": quote.get("delivery_timeline_months", ""),
                        "advance_payment_pct": quote.get("advance_payment_pct", ""),
                        "warranty_start": quote.get("warranty_start", ""),
                        "installation_responsibility": quote.get("installation_responsibility", ""),
                        "training_included": quote.get("training_included", ""),
                        "vendor_type": quote.get("vendor_type", ""),
                        "vendor_type_label": quote.get("vendor_type_label", ""),
                        "archetype": quote.get("archetype", ""),
                        "format_variation": quote.get("format_variation", ""),
                        "weighted_decision_score": quote["weighted_decision_score"],
                        "rank_in_bid": rank,
                        "is_top_1": quote_id == top_1,
                        "is_top_2": quote_id in top_2,
                        "is_top_3": quote_id in top_3,
                        "is_top_5": quote_id in top_5,
                        "ground_truth_label": label,
                    }
                )


def total_requested_samples(args: argparse.Namespace, experiment: Dict[str, Any]) -> int:
    if args.num_samples:
        return args.num_samples
    num_bids = args.num_bids or experiment["num_bids"]
    quotes_per_bid = args.quotes_per_bid or experiment["quotes_per_bid"]
    return num_bids * quotes_per_bid


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic procurement quote PDFs.")
    parser.add_argument("--criteria", default="files/input/criteria.json", type=Path)
    parser.add_argument("--output", default="files/input/samples", type=Path)
    parser.add_argument("--num-samples", type=int, help="Override total number of quote PDFs.")
    parser.add_argument("--num-bids", type=int, help="Override number of bidding processes.")
    parser.add_argument("--quotes-per-bid", type=int, help="Override quotes per bidding process.")
    parser.add_argument(
        "--fill-coverage",
        action="store_true",
        help="Prefer values that are under-covered in the existing output metadata.",
    )
    parser.add_argument(
        "--from-metadata",
        action="store_true",
        help="Rebuild manifest.csv, dataset.csv, and coverage.csv from existing metadata.json.",
    )
    parser.add_argument(
        "--demo-rfq-responses",
        action="store_true",
        help="Write curated BID-001-Q06/Q07 MRI RFQ response PDFs and register them.",
    )
    args = parser.parse_args()

    if args.demo_rfq_responses:
        write_demo_rfq_responses(args.output)
        return

    config = load_json(args.criteria)
    if args.from_metadata:
        existing_bids = load_existing_bids(args.output / "metadata.json")
        if not existing_bids:
            raise SystemExit(f"No bids found in {args.output / 'metadata.json'}")
        write_manifest(args.output, existing_bids)
        write_dataset(args.output, existing_bids)
        write_coverage(args.output, config, existing_bids)
        print(f"Rebuilt manifest.csv, dataset.csv, and coverage.csv in {args.output}")
        return

    experiment = config["experiment"]
    rng = random.Random(experiment.get("random_seed", 42))
    args.output.mkdir(parents=True, exist_ok=True)
    quotes_per_bid = args.quotes_per_bid or experiment["quotes_per_bid"]
    if args.num_samples:
        num_bids = math.ceil(args.num_samples / quotes_per_bid)
    else:
        num_bids = args.num_bids or experiment["num_bids"]
    coverage = (
        load_existing_coverage(args.output / "metadata.json")
        if args.fill_coverage
        else {}
    )
    existing_bids = (
        load_existing_bids(args.output / "metadata.json") if args.fill_coverage else []
    )
    start_bid_index = next_bid_index(existing_bids)

    new_bids = []
    remaining_samples = args.num_samples
    for bid_index in range(start_bid_index, start_bid_index + num_bids):
        current_quotes_per_bid = quotes_per_bid
        if remaining_samples is not None:
            current_quotes_per_bid = min(quotes_per_bid, remaining_samples)
            remaining_samples -= current_quotes_per_bid
        new_bids.append(
            generate_bid(
                rng,
                config,
                bid_index,
                args.output,
                coverage=coverage,
                quotes_per_bid=current_quotes_per_bid,
            )
        )
    bids = existing_bids + new_bids
    metadata = {
        "experiment": {
            **experiment,
            "num_bids": len(bids),
            "new_bids_generated": len(new_bids),
            "quotes_per_bid": quotes_per_bid,
            "num_samples": sum(len(bid["quotes"]) for bid in bids),
            "new_samples_generated": sum(len(bid["quotes"]) for bid in new_bids),
        },
        "criteria": config["weighted_decision_criteria"],
        "guardrails": config["guardrails"],
        "bids": bids,
    }
    write_json(args.output / "metadata.json", metadata)
    write_manifest(args.output, bids)
    write_dataset(args.output, bids)
    write_coverage(args.output, config, bids)

    total_quotes = sum(len(bid["quotes"]) for bid in bids)
    print(f"Generated {len(new_bids)} new bids and {sum(len(bid['quotes']) for bid in new_bids)} new quote PDFs in {args.output}")
    print(f"Dataset now has {len(bids)} bids and {total_quotes} quote PDFs")
    print(f"Wrote dataset file to {args.output / 'dataset.csv'}")
    print(f"Wrote coverage report to {args.output / 'coverage.csv'}")


if __name__ == "__main__":
    main()
