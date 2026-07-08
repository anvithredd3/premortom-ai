---
type: okf-memory-index
title: Contract Agent Memory Index
description: Entry point for OKF-style long-term memory used by the contract review agent.
timestamp: 2026-07-01T00:00:00-07:00
resource: contract_agent
status: draft
tags:
  - contract-review
  - long-term-memory
  - okf
---

# Contract Agent Memory Index

This folder stores durable memory for the contract review agent. It is meant to improve consistency across reviews without changing the agent response schema.

## Read Order

1. Read `profile.md` for the agent's standing review policy.
2. Select relevant pages from `policies/` based on the current contract terms.
3. Select relevant pages from `patterns/` based on observed risks and evidence quality.
4. Retrieve similar prior examples from `cases/` when available.
5. Use `references/contract-review-guidance.md` for general review guidance.

## Memory Boundaries

- Keep current procurement facts in short-term prompt input.
- Keep stable review rules, patterns, and reusable examples in this folder.
- Cite memory pages when their guidance shapes a finding.
- Do not treat memory as contract evidence; evidence must come from the current contract, proposal, or procurement record.
