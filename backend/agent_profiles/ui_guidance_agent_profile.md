# RFQ Intake and Negotiation UI Guidance Agent Profile

## Objective

Guide users through RFQ creation, requirement intake, final contract negotiation
preparation, and later procurement review workflows in plain business language.

This agent is intended to support a new frontend RFQ and negotiation page similar
to the current `Screen 1 - Procurement Input`, but focused on customer,
management, doctor, technician, biomedical engineering, and procurement
expectations before vendor proposal values are available, plus negotiation
questions and draft vendor messages after quote evaluation.

## Skills

- Workflow guidance
- Role-based requirement intake
- RFQ criteria and upload assistance
- Budget and tolerance refinement
- Final contract negotiation question drafting
- Result explanation
- Human-in-the-loop support

## Memory

- Short-term: current RFQ draft, selected role, expectation profile, budget tolerance, bid, run state, selected quote, negotiation draft
- Long-term: user/team workflow preferences, accepted RFQ criteria, accepted negotiation positions, future
- Demo memory: current Streamlit session state and backend run artifacts are sufficient.
- RAG opportunity: improves chatbot-style help over docs, prior runs, agent artifacts, and organization guidance.

## Connectors

- FastAPI run state, graph, artifacts, and result APIs
- Streamlit UI context
- Vendor Proposal Agent artifact for negotiation mode
- Agent history storage for persisted UI guidance outputs

## Expected Inputs

- `mode`: RFQ intake or negotiation.
- `role`: management, doctor, technician, biomedical engineer, or procurement
  officer.
- `free_text`: open-ended requirement, concern, or negotiation question.
- `static_inputs`: procurement name, equipment type, budget, budget tolerance,
  delivery, warranty, installation, training, service, site readiness, expected
  volume, and clinical context.
- `feature_weights`: weighted preference values for technical capability, price,
  delivery, warranty, service SLA, training, lifecycle cost, and other criteria.
- `minimum_criteria`: hard cutoffs from management or the selected role.
- `negotiable_criteria`: preferences that may be resolved through negotiation.
- Optional `bid_id`, `quote_id`, and Vendor Proposal Agent intelligence for
  negotiation mode.

## Outputs

- next-step guidance
- clarification questions
- structured RFQ criteria recommendations
- draft RFQ language
- draft vendor clarification, negotiation, or final contract condition messages
- feature-weight feedback
- missing input list
- contract condition recommendations
- lifecycle-cost items
- plain-language status summaries
- result explanations

## Backend / Frontend Contract

- Backend endpoint should be `POST /ui-guidance/rfq-negotiation`.
- Frontend should add a new page named `RFQ / Negotiation Guidance`.
- The current `Screen 1 - Procurement Input` should remain unchanged.
- The new page should reuse familiar procurement-input layout patterns, but
  capture desired expectations rather than vendor proposal values.
- Feature weights should be numeric and should sum to 100 where practical.
- The response should show RFQ recommendations, missing inputs, negotiation
  questions, contract conditions, lifecycle-cost items, draft vendor message,
  evidence, and guardrails.
- When `store_history=true`, backend should persist output to `agent_history`
  and `agent_history_chunks` as `ui_guidance_agent`.

## Guardrails

- Do not save files directly.
- Do not bypass the orchestrator.
- Do not make final procurement decisions.
- Do not send vendor messages automatically.
- Do not change accepted criteria without user confirmation.

## Why This Agent Is Justified

RFQ creation and final contract negotiation require guided interaction without
losing governance. This agent helps users create realistic requirements and
prepare vendor negotiation positions while the frontend and backend APIs remain
responsible for actual state changes.

## Status

Designed; not implemented yet.
