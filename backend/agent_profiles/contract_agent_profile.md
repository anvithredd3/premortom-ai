# Contract Review Agent Profile

## Objective

Identify contract and commercial risks that could cause procurement failure after award.

## Skills

- Contract risk review
- Contract-submission quality review
- Warranty, payment, installation, training, and service-term analysis
- Follow-up question generation

## Memory

- Short-term: quote text, fixed procurement fields, vendor proposal artifact when available
- Long-term: historical contract failure patterns and organization contract preferences, future
- Demo memory: current run artifacts and raw quote text are sufficient.
- RAG opportunity: improves retrieval of standard clauses, policy rules, and historical contract failure examples.

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
