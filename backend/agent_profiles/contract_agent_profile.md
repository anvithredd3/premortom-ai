# Contract Review Agent Profile

## Objective

Identify contract and commercial risks that could cause procurement failure after award.

## Skills

- Contract risk review
- Contract-submission quality review
- Warranty, payment, installation, training, and service-term analysis
- Follow-up question generation

## Memory And Retrieval

### Current - OKF Memory And pgvector Decision History

- Store contract review outputs, run state, events, and final decisions as JSON/JSONL/CSV artifacts for audit and demo replay.
- Store completed bid decisions in PostgreSQL tables `decision_history` and `decision_history_chunks`.
- Keep stable review guidance in OKF-style Markdown memory under this profile folder.
- Keep decision history separate from OKF memory: history is evidence about prior cases, not a standing policy rule.

### Bounded Decision-History Prompt Context

When enabled, the Contract Review Agent receives a bounded prior-decision block:

- Last 10 completed decisions globally.
- Last 5 decisions for the same vendor, when the vendor is known.
- Last 5 decisions for the same equipment or procurement category.
- Top 5 vector-similar `decision_history_chunks` for the current quote/context.

The character limit on each memory item is only a prompt-size guard after
retrieval. It is not the selection mechanism. Important factors should be
selected by metadata filters and pgvector similarity.

### Retrieval Guardrails

- Use prior history for consistency and pattern spotting.
- Do not copy prior risk scores into the current review.
- Do not treat prior decisions as proof that the current quote has the same risk.
- Current quote text and current procurement fields remain the primary evidence.
- If database retrieval fails, continue with OKF memory and current-case analysis.

### Current Memory Scope

- Short-term: quote text, fixed procurement fields, vendor proposal artifact when available.
- Long-term OKF memory: warranty, advance payment, installation, training, service-level, evidence-quality, and clause-conflict guidance.
- Decision history memory: bounded hybrid retrieval from `decision_history` and `decision_history_chunks`.
- RAG opportunity: improve retrieval quality with stronger semantic embeddings and richer vendor/category metadata.

## Connectors

- PDF/document parser output
- Procurement policy database, future
- Vendor registry, future

## Outputs

- `artifact_contract_review`
- risk score and risk level
- evidence-backed findings
- recommendation
- contract-risk metrics

## Guardrails

- Treat raw quote text as primary when present.
- Cite evidence.
- Report conflicts between fixed fields and raw text.
- Do not invent missing terms.

## Why This Agent Is Justified

Many procurement failures originate in warranty, payment, installation, service, and ambiguous contract terms.

## Status

Implemented as `backend/app/agents/contract_agent.py` with prompt `backend/prompts/contract_agent.md`.
