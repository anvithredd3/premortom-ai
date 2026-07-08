---
type: guardrail-policy
title: Bid Recommendation Guardrails
description: Safety boundaries for bid recommendation and shortlist decisions.
resource: bid_recommender_agent
status: draft
tags:
  - guardrails
  - blockers
  - procurement
---

# Bid Recommendation Guardrails

Treat these as downgrade or human-review triggers:

- Missing or conflicting price/payment terms.
- High advance payment without security, retention, or milestone protection.
- Warranty starts before commissioning or acceptance for complex equipment.
- Buyer-owned installation when site readiness is incomplete.
- Missing training for operationally complex equipment.
- Incomplete service SLA: response but no resolution, spare parts, uptime, remedies, or exclusions.
- Vendor claims that lack source evidence or require verification.
- Regulatory or certification gaps.

Market attractiveness cannot erase a hard blocker. A low price, fast delivery,
or strong brand should not override unresolved contract, compliance, or readiness risk.
