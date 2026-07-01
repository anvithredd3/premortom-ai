# UI Guidance Agent Profile

## Objective

Guide users through the procurement review workflow and explain agent outputs in plain business language.

## Skills

- Workflow guidance
- Criteria and upload assistance
- Result explanation
- Human-in-the-loop support

## Memory

- Short-term: current screen, bid, run state, selected quote
- Long-term: user/team workflow preferences, future
- Demo memory: current Streamlit session state and backend run artifacts are sufficient.
- RAG opportunity: improves chatbot-style help over docs, prior runs, agent artifacts, and organization guidance.

## Connectors

- FastAPI run state, graph, artifacts, and result APIs
- Streamlit UI context

## Outputs

- next-step guidance
- clarification questions
- plain-language status summaries
- result explanations

## Guardrails

- Do not save files directly.
- Do not bypass the orchestrator.
- Do not make final procurement decisions.

## Why This Agent Is Justified

Agentic workflows are complex, and users need guided interaction without losing governance.

## Status

Designed; not implemented yet.
