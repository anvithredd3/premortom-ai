# Vendor Proposal Agent Profile

## Objective

Understand each vendor quote as a business proposal and produce reusable,
evidence-backed proposal intelligence for downstream agents.

The Vendor Proposal Agent should bridge the gap between raw PDF text and the
structured inputs needed by Contract Review, Bid Recommendation, Market Research,
RFQ/Negotiation Guidance, Compliance, future Invoice Monitoring, and future
post-award agents.

## Skills

- Vendor proposal understanding
- Fixed feature extraction
- Proposal intelligence extraction
- Missing and ambiguous information detection
- Evidence snippet selection
- Static field reconciliation
- Vendor differentiator identification
- Commercial and operational term extraction
- Proposal quality assessment
- Published RFQ requirement coverage mapping
- Follow-up question generation

## Memory

- Short-term: current bid context, quote text, extracted fields, source PDF
  metadata, current run id, current quote id
- Long-term: prior vendor patterns, recurring proposal omissions, reviewer
  feedback, external research summaries, future
- Demo memory: CSV/JSON files and run artifacts are sufficient.
- RAG opportunity: improves vendor history, prior submissions, reviewed internet
  research, similar proposal pattern retrieval, and recurring negotiation issue
  retrieval.

## Connectors

- PDF/document parser
- Bid and quote registry
- Published RFQ store: `rfq_sessions` and `rfq_requirements`
- Run artifact store
- Vendor registry, future
- Market and web research, future
- Decision history memory, future
- Invoice and post-award history, future

## Outputs

- `artifact_vendor_proposal`
- `fixed_features`
- `proposal_text`
- `proposal_intelligence`
- `rfq_requirement_coverage`
- `raw_text_reference`

## Output Shape

The agent should produce one proposal record per quote.

```json
{
  "quote_id": "...",
  "fixed_features": {
    "vendor_name": {
      "value": "...",
      "status": "found|missing|conflict|inferred",
      "confidence": 0.0,
      "evidence": "bids_database.csv|proposal_text|both"
    }
  },
  "proposal_text": {
    "raw_text": "...",
    "text_preview": "...",
    "char_count": 0,
    "source_pdf_path": "...",
    "extraction_quality": "low|medium|high",
    "needs_ocr_or_vision_fallback": false
  },
  "proposal_intelligence": {
    "vendor_profile": {},
    "commercial_terms": {},
    "delivery_and_installation": {},
    "warranty_and_service": {},
    "training_and_handover": {},
    "compliance_claims": [],
    "differentiators": [],
    "omissions_or_ambiguities": [],
    "unusual_terms": [],
    "proposal_quality": {},
    "follow_up_questions": []
  },
  "rfq_requirement_coverage": {
    "rfq_id": "...",
    "requirements": [
      {
        "requirement_id": "REQ-001",
        "perspective_role": "doctor",
        "requirement": "AI-based organ marking",
        "value_pct": 20.0,
        "coverage": "met|partial|missing|unclear",
        "evidence": "...",
        "gap": "..."
      }
    ],
    "weighted_value_covered_pct": 0.0,
    "mandatory_gaps": []
  },
  "raw_text_reference": {
    "pdf_path": "...",
    "full_text_available": true
  }
}
```

## Fixed Features

The agent should extract and reconcile static comparable fields where possible:

- vendor name
- legal entity name
- registered address
- contact person and contact details
- equipment type
- procurement name
- quoted price
- currency
- advance payment percentage
- delivery timeline
- warranty start trigger
- warranty duration
- installation responsibility
- commissioning responsibility
- training included
- service response target
- local service team availability
- certifications or compliance claims
- references or prior hospital installations

If a value appears in both `bids_database.csv` and proposal text, preserve both
when they conflict. Do not silently overwrite one source with another.

## Proposal Intelligence

The agent should preserve richer proposal-level information that is not a simple
static field:

- what the vendor emphasizes
- what the vendor avoids or leaves vague
- whether the quote is operationally specific or marketing-heavy
- whether implementation responsibilities are measurable
- whether payment terms are tied to buyer acceptance
- whether warranty and service terms are enforceable
- whether training and handover are sufficient
- whether lifecycle-cost items are visible or hidden
- whether compliance claims are evidenced or only asserted
- whether the proposal includes differentiators that may reduce or increase risk
- what questions should be asked before award or negotiation

## Published RFQ Requirement Coverage

When a published RFQ is available, the agent should map vendor proposal evidence
to every accepted RFQ requirement.

- Use `rfq_requirements` as the buyer-approved source of truth.
- Mark each requirement as `met`, `partial`, `missing`, or `unclear`.
- Preserve evidence snippets from the proposal for `met` and `partial`
  coverage.
- Treat missing or unclear high-value requirements as downstream recommendation
  signals.
- Do not give credit for vendor features that are attractive but unrelated to
  accepted RFQ value.
- Do not infer coverage from marketing language without specific evidence.

## Evidence Rules

- Separate explicitly stated facts from inferred observations.
- Attach short evidence snippets to major extracted fields and observations.
- Preserve source names such as `bids_database.csv`, PDF path, or extracted text.
- Mark missing values as `missing`; do not invent values to make the artifact
  look complete.
- Mark conflicts as `conflict` and carry both values where possible.
- Mark uncertain extraction as `inferred` with lower confidence.

## Guardrails

- Separate stated facts from interpretation.
- Preserve evidence snippets.
- Do not recommend winners.
- Do not perform final contract review; pass evidence to the Contract Review
  Agent.
- Do not decide the bid winner; pass structured proposal intelligence to the Bid
  Recommendation Agent.
- Do not treat internet or market research as vendor-submitted evidence.
- Do not treat a vendor differentiator as buyer value unless it maps to an
  accepted RFQ requirement or is explicitly added by the user later.
- Do not make fraud accusations; route suspicious anomalies to future
  compliance or invoice-monitoring agents.

## Downstream Consumers

- Contract Review Agent uses proposal text, fixed features, omissions, unusual
  terms, and evidence snippets.
- Bid Recommendation Agent uses comparable fields, proposal quality, vendor
  differentiators, RFQ requirement coverage, weighted value covered, and
  follow-up questions.
- RFQ Intake and Negotiation UI Guidance Agent uses omissions, negotiation gaps,
  lifecycle-cost items, and draft follow-up questions.
- Internet / Market Research Agent can use equipment type, vendor/product names,
  certifications, and lifecycle-cost terms as search context.
- Invoice Monitoring and Contract Compliance Agent can later use accepted
  warranty, service, consumable, spare-parts, and payment terms.

## Why This Agent Is Justified

Vendor submissions vary widely, and proposal quality itself is decision-relevant
evidence. A dedicated Vendor Proposal Agent keeps extraction and proposal
understanding separate from risk scoring, recommendation, and final decision
logic.

## Status

Implemented with minimum backend functionality. Current code reads quote PDF
text, extracts fixed comparable fields, and writes proposal intelligence to
`vendor_proposal_agent_quote_intelligence.json`.
