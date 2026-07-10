"""Item Research Agent — classifies procurement item and returns structured context."""
from __future__ import annotations

from ..services.llm import has_api_key, run_agent_llm

NAME = "Item Research Agent"

INSTRUCTIONS = """You are a procurement intelligence analyst.

Given an item name, classify the procurement category, provide context relevant to
a risk audit, and suggest typical parameter values so a procurement officer can
fill the intake form accurately.

Return ONLY valid JSON with this exact structure — no markdown, no commentary:
{
  "category": "<one of: medical_equipment | aviation | it_systems | heavy_machinery | vehicles | infrastructure | general>",
  "category_label": "<human-readable category name, e.g. Medical Equipment>",
  "procurement_context": "<2-3 sentences describing what procuring this item typically involves: lead times, key considerations, common failure modes, market characteristics>",
  "risk_factors": ["<top risk 1>", "<top risk 2>", "<top risk 3>"],
  "suggested_fields": {
    "advance_payment_pct": <typical industry-standard advance payment %, integer>,
    "delivery_timeline_months": <typical lead time in months for this item, float>,
    "warranty_start": "<On Delivery | On Commissioning | On Installation>",
    "installation_responsibility": "<Vendor | Buyer | Joint>",
    "training_included": <true if training is typically bundled with this type of item>,
    "construction_completion_pct": <% of site readiness typically needed before delivery, e.g. 90>,
    "technicians_required": <typical number of specialist personnel needed to operate or maintain this item>,
    "historical_delays_months": [<typical delay scenario 1, float>, <typical delay scenario 2, float>]
  },
  "regulatory_label": "<what the regulatory approval field means for this item, e.g. 'DGCA Certification' for aircraft, 'Radiation Clearance' for MRI, 'Boiler Inspector Approval' for industrial boilers, 'Regulatory Approval' for general items>",
  "workforce_label": "<what technicians/operators means for this item, e.g. 'Licensed Pilots' for aircraft, 'Radiologists' for MRI, 'Certified Network Engineers' for IT, 'Technicians' for general>",
  "site_label": "<what construction completion % means for this item, e.g. 'Hangar Readiness' for aircraft, 'Equipment Room Completion' for MRI, 'Data Center Readiness' for servers, 'Site Readiness' for general>",
  "requires_site_readiness": <true if physical site must be prepared before delivery>,
  "extra_fields": [
    {
      "key": "<snake_case_field_key>",
      "label": "<UPPERCASE HUMAN LABEL>",
      "type": "<text | number | bool | select>",
      "opts": ["<option 1>", "<option 2>"],
      "placeholder": "<example hint>"
    }
  ]
}

Category definitions:
- medical_equipment: MRI, CT scanner, X-ray, ultrasound, lab equipment, surgical robots, ventilators
- aviation: Aircraft, helicopters, avionics, UAVs, flight simulators, aerospace components, engines
- it_systems: Software licenses, servers, network equipment, cybersecurity tools, ERP, databases, cloud
- heavy_machinery: Industrial equipment, cranes, manufacturing plant, turbines, generators, compressors
- vehicles: Fleet vehicles, trucks, buses, ambulances, fire engines (exclude aircraft)
- infrastructure: Buildings, bridges, roads, civil works, construction projects, utilities
- general: Anything not clearly fitting the above

Include 2-4 extra_fields that are specific and meaningful for this item category.
For aviation, include things like fleet_size, dgca_approval_status, mro_contract_included.
For medical_equipment, include modality_type, iso_certification, service_contract_years.
For it_systems, include number_of_users, integration_complexity, data_migration_required.
For heavy_machinery, include load_capacity_tons, installation_foundation_type, factory_acceptance_test.
For vehicles, include fleet_size, fuel_type, gps_tracking_included.
For infrastructure, include environmental_clearance, architect_signed_off, contractor_shortlisted.
Always include at least 2 extra_fields even for general items."""


def research(item_name: str) -> dict:
    """Research the procurement item and return structured context."""
    if not has_api_key():
        return _offline_result(item_name)

    result = run_agent_llm(
        name=NAME,
        instructions=INSTRUCTIONS,
        user_payload=f'{{"item_name": "{item_name}"}}',
    )
    if result is None:
        return _offline_result(item_name)

    # Ensure required keys exist
    result.setdefault("category", "general")
    result.setdefault("category_label", "General Procurement")
    result.setdefault("procurement_context", f"Procurement of {item_name}.")
    result.setdefault("risk_factors", [])
    result.setdefault("suggested_fields", {})
    result.setdefault("regulatory_label", "Regulatory Approval")
    result.setdefault("workforce_label", "Technicians")
    result.setdefault("site_label", "Site Readiness")
    result.setdefault("requires_site_readiness", True)
    result.setdefault("extra_fields", [])
    return result


def _offline_result(item_name: str) -> dict:
    return {
        "category": "general",
        "category_label": "General Procurement",
        "procurement_context": f"Offline mode — research unavailable. Procuring {item_name}. Please fill in fields manually.",
        "risk_factors": [
            "Advance payment without security (bank guarantee)",
            "Delivery timeline not aligned with site readiness",
            "Insufficient trained personnel at time of delivery",
        ],
        "suggested_fields": {
            "advance_payment_pct": 20,
            "delivery_timeline_months": 6,
            "warranty_start": "On Commissioning",
            "installation_responsibility": "Vendor",
            "training_included": True,
            "construction_completion_pct": 90,
            "technicians_required": 2,
            "historical_delays_months": [2.0, 4.0],
        },
        "regulatory_label": "Regulatory Approval",
        "workforce_label": "Technicians",
        "site_label": "Site Readiness",
        "requires_site_readiness": True,
        "extra_fields": [],
    }
