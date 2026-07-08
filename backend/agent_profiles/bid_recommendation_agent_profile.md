# Bid Recommendation Agent Profile

## Objective

Compare reviewed quotes within a single bid and recommend a winner, shortlist,
and practical negotiation points.

## Skills

- Deterministic quote ranking
- Contract-review signal synthesis
- Tradeoff explanation
- Winner and shortlist recommendation
- Audit-friendly feedback and negotiation points

## Memory

- Short-term: current bid id, reviewed quote records, risk scores, findings, and contract-review recommendations.
- Run artifacts: vendor proposal extraction and contract review artifacts are available for the bid run.
- OKF long-term memory: `backend/agent_profiles/bid_recommender_agent_profile/` contains ranking, guardrail, external-signal, and tie-breaker guidance.
- Demo memory: local run artifacts under `files/output/bid_runs/` preserve bid history.
- Future memory: historical decision outcomes, reviewer preferences, and similar bid outcomes could improve recommendations.
- RAG opportunity: useful later for retrieving past decisions, company preferences, reviewer feedback, and similar bid outcomes.

## Connectors

- `artifact_vendor_proposal`
- `artifact_contract_review`
- Optional LLM provider through `backend/app/services/llm.py`
- Future: cost, compliance, vendor-risk, and market-research agents

## Outputs

- `artifact_bid_recommendation`
- `winner`
- `ranked_quotes`
- `shortlist`
- `rationale`
- `feedback`
- `negotiation_points`
- `artifact_refs`

## Guardrails

- Compare quotes within the same bid only.
- Use contract review findings as evidence.
- Separate evidence from judgment in the rationale.
- Explain why weaker quotes were downgraded.
- Do not invent prices, certifications, or vendor facts.
- Preserve the existing bid-run result shape expected by the UI.

## Current Implementation

Implemented in `backend/app/agents/bid_recommender_agent.py`.

The agent is called from `run_bid_evaluation(...)` in
`backend/app/agents/orchestrator.py` after contract reviews are completed.

Current behavior:

- Sorts reviewed quotes by lowest `risk_score`.
- Uses finding count and `quote_id` as deterministic tie-breakers.
- Selects the lowest-risk quote as `winner`.
- Returns up to three quotes in `shortlist`.
- Produces fallback `rationale`, `feedback`, and `negotiation_points` without requiring an API key.
- If an OpenAI or Anthropic key is configured, calls `run_agent_llm(...)` to enrich the explanation fields only.
- Optional LLM explanation receives selected Bid Recommender OKF memory; deterministic ranking remains unchanged.
- Keeps provider-specific logic centralized in `backend/app/services/llm.py`.

## Why This Agent Is Justified

Procurement decisions require comparing multiple vendor proposals, not merely reviewing one quote in isolation.

## Status

Implemented as a dedicated, offline-safe Bid Recommender Agent with optional LLM explanation enrichment.
