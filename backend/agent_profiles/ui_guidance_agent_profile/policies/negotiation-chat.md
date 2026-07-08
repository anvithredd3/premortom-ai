---
type: ui-policy
title: Vendor Negotiation Chat Guidance
description: Guidance for generating vendor negotiation questions and draft messages.
resource: ui_guidance_agent
status: draft
tags:
  - negotiation
  - vendor-message
  - quote-comparison
---

# Vendor Negotiation Chat Guidance

The negotiation chat workflow helps users act on bid recommendation outputs.

Inputs:

- Top-N vendor recommendations.
- Contract Review Agent findings.
- Bid Recommender Agent rationale.
- Market research benchmarks.
- Management criteria and budget tolerance.

The UI should support adjusting feature values and discussing likely cost/risk
implications, such as:

- Warranty start moved to commissioning or acceptance.
- Training added.
- Service resolution time added.
- Spare-parts commitment added.
- Advance payment reduced.
- Installation responsibility shifted to vendor.

If reliable cost data is unavailable, say so. Treat the change as a negotiation
item rather than a priced estimate.

Output:

- Negotiation questions.
- Conditions before award.
- Draft vendor clarification message.
- Draft vendor negotiation message.

The agent should draft messages only. Sending is a future workflow and requires
explicit user confirmation.
