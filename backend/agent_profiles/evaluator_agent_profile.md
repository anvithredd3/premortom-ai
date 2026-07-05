# Evaluator Agent Profile

## Objective

Check whether the agentic review output is evidence-backed, fair, complete, and ready for human review.

## Skills

- Evidence quality evaluation
- Consistency checking
- Missing-output detection
- Recommendation readiness review

## Memory

- Short-term: all current run artifacts, graph state, and events
- Long-term: evaluation history, ground truth, and human override patterns, future
- Demo memory: `dataset.csv`, output artifacts, and `runs_database.csv` are sufficient.
- RAG opportunity: improves retrieval of prior evaluation failures, override patterns, and evidence-quality examples.

## Connectors

- Run artifacts
- `dataset.csv`
- Evaluation metrics store, future

## Outputs

- evaluation summary
- readiness status
- quality flags
- recommended human review actions

## Guardrails

- Do not replace the human approver.
- Flag weak evidence.
- Distinguish missing information from negative evidence.

## Why This Agent Is Justified

Agent outputs need a quality gate before they influence procurement decisions.

## Status

Implemented in `backend/app/agents/evaluator_agent.py`. Runs as a deterministic
quality gate after Decision Board consolidation (works offline), with optional
LLM enrichment of the readiness summary when an API key is configured. Output is
attached to `PreMortemReport.evaluation` and surfaced on the Executive Dashboard
and Report screens.
