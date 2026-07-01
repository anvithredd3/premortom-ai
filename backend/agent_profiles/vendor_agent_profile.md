# Vendor Proposal Agent Profile

## Objective

Understand each vendor quote as a business proposal and produce reusable proposal intelligence for downstream agents.

## Skills

- Vendor proposal understanding
- Fixed feature extraction
- Proposal intelligence extraction
- Missing and ambiguous information detection

## Memory

- Short-term: current bid context, quote text, extracted fields
- Long-term: prior vendor patterns and reviewer feedback, future
- Demo memory: CSV/JSON files and run artifacts are sufficient.
- RAG opportunity: improves vendor history, prior submissions, reviewed internet research, and similar proposal pattern retrieval.

## Connectors

- PDF/document parser
- Vendor registry, future
- Market and web research, future

## Outputs

- `artifact_vendor_proposal`
- `fixed_features`
- `proposal_text`
- `proposal_intelligence`
- `raw_text_reference`

## Guardrails

- Separate stated facts from interpretation.
- Preserve evidence snippets.
- Do not recommend winners.

## Why This Agent Is Justified

Vendor submissions vary widely, and proposal quality itself is decision-relevant evidence.

## Status

Designed; artifact scaffold exists; LLM prompt-backed agent not implemented yet.
