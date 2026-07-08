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
- Do not make fraud accusations; route suspicious anomalies to future
  compliance or invoice-monitoring agents.

## Downstream Consumers

- Contract Review Agent uses proposal text, fixed features, omissions, unusual
  terms, and evidence snippets.
- Bid Recommendation Agent uses comparable fields, proposal quality, vendor
  differentiators, and follow-up questions.
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

Designed; artifact scaffold exists. Current implementation stores raw extracted
PDF text and a small fixed-feature shell. Proposal intelligence extraction is
the next implementation step.
