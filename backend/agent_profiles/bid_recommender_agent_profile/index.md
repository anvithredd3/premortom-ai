---
type: okf-memory-index
title: Bid Recommender Agent Memory Index
description: Entry point for OKF-style long-term memory used by the bid recommender agent.
resource: bid_recommender_agent
status: draft
tags:
  - bid-recommendation
  - quote-ranking
  - shortlist
  - memory
---

# Bid Recommender Agent Memory Index

This folder stores durable memory for the Bid Recommender Agent. It is meant to
improve consistency when comparing multiple vendor quotes within one bid.

## Read Order

1. Read `profile.md` for the recommender's role, boundaries, and output policy.
2. Select relevant pages from `policies/` based on current bid comparison needs.
3. Select relevant pages from `patterns/` when recurring quote-comparison risks appear.

## Memory Boundaries

- The recommender integrates specialist outputs; it does not redo every specialist analysis.
- Use Contract Review Agent findings as evidence for contract risk.
- Use external market/specification research as benchmark context, not proof.
- Keep deterministic ranking and optional LLM explanation separate.
- Do not let memory silently change the winner, shortlist, or score components.
