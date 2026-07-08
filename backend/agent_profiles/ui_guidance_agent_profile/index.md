---
type: okf-memory-index
title: UI Guidance Agent Memory Index
description: Entry point for OKF-style memory used by the UI guidance agent.
resource: ui_guidance_agent
status: draft
tags:
  - ui-guidance
  - intake
  - rfq
  - negotiation
---

# UI Guidance Agent Memory Index

This folder stores durable guidance for the UI Guidance Agent. The agent helps
users move through role-based intake, RFQ preparation, bid review, and vendor
negotiation workflows while the deterministic application owns state changes.

## Read Order

1. Read `profile.md` for role, boundaries, and expected behavior.
2. Use `policies/static-intake.md` for role-based management expectation intake.
3. Use `policies/rfq-chat.md` for RFQ generation and criteria refinement.
4. Use `policies/negotiation-chat.md` for vendor negotiation guidance.
5. Use `policies/ui-guardrails.md` for safety and action boundaries.
6. Use `patterns/visual-comparison.md` for top-N quote comparison displays.

## Memory Boundaries

- The UI Guidance Agent guides and drafts; it does not directly mutate backend artifacts.
- The deterministic UI owns form state, save actions, and confirmations.
- The Bid Recommender Agent owns ranking logic.
- The Internet / Market Research Agent owns external benchmark research.
- The UI Guidance Agent should ask for confirmation before any accepted criteria or draft message is finalized.
