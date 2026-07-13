---
type: ui-policy
title: RFQ Chat Guidance
description: Guidance for chat-assisted RFQ criteria generation and refinement.
resource: ui_guidance_agent
status: draft
tags:
  - rfq
  - chat
  - requirements
---

# RFQ Chat Guidance

The RFQ chat workflow helps users turn static intake into realistic bid criteria.

Use:

- Static management criteria.
- Budget and tolerance.
- Internet / Market Research Agent benchmarks.
- Bid Recommender Agent tradeoff suggestions.
- Regional comparable facility context when available.

Help answer:

- Are these requested features realistic for the budget?
- Which criteria should be mandatory?
- Which criteria should be negotiable?
- Which features are likely to increase cost sharply?
- Which service, warranty, training, or lifecycle requirements should be explicit?
- Are comparable hospitals or facilities in the region using similar MRI capabilities?

## Chat Requirement Handling

The agent should not treat every chat message as a requirement.

Add a requirement only when one of these conditions is true:

1. The message clearly matches a known requirement template.
2. The user provides a custom requirement with priority, value percentage, and
   cost or explicit unknown-cost status.
3. The user accepts a previously proposed draft requirement.

Do not add:

- greetings such as `hi`, `hello`, or `hey`
- broad discussion without a concrete requirement
- vague feature ideas without priority/value/cost information
- role-switch messages

When a known requirement is detected:

- Search all role templates, not only the active chat role.
- Keep the active chat role as the role that entered the requirement.
- Assign the requirement to the best matching perspective role.
- Use template defaults only for missing fields.
- Override template defaults with explicit user values for priority, value
  percentage, and cost.
- Ask the user to confirm before adding the requirement.

When a custom requirement is detected:

- Ask for missing priority, value percentage, or cost fields.
- If all required fields are present, show a draft and ask the user to confirm.
- Treat `budget 20 crore` or similar wording inside a requirement as the
  requirement's estimated cost, not as an RFQ-level budget update.
- Preserve explicit unknown-cost status as unknown rather than treating it as
  zero cost.
- Mark cost confidence as `unknown` unless the user or market research provides
  a better source.
- Classify the requirement's stakeholder perspective with deterministic domain
  keywords before falling back to the active chat role.
- Keep the active chat role as `entered_by_role` even when the perspective is
  reassigned to doctor, finance, biomedical engineering, procurement, or
  management.

Confirmation options:

```text
Yes, add
No
Chat further
```

## Guardrails

- Do not silently infer a cost when the user did not provide one and no market
  benchmark is available.
- Do not accept a requirement when its value percentage would push the
  requirement's perspective role above 100% total value coverage.
- Do not accept negative priority, value, cost, or budget values.
- Do not accept a single requirement value percentage above 100%.
- Do not accept duplicate or near-duplicate requirements in the same perspective
  role without clarification.
- Do not publish an RFQ with invalid edited table rows, budget overrun, or
  duplicate accepted requirements.
- Warn before publish when no requirements exist, a role perspective is missing,
  or a role has very low value coverage.
- Do not update the RFQ-level budget unless the user explicitly says `RFQ
  budget`, `overall budget`, `total budget`, or asks to set/change/update the
  budget.
- Do not force management requirements into the management perspective if the
  content clearly belongs to doctor, finance, biomedical engineering, or
  procurement.
- Do not overwrite accepted requirements without user confirmation.
- Do not present template estimates as market-verified costs.
- Do not claim the value polygon is an optimized procurement solution. It is a
  visualization of current stakeholder value coverage.
- Do not treat the cost meter as total cost of ownership unless lifecycle costs
  are explicitly included.

Output:

- Draft RFQ criteria.
- Minimum qualification criteria.
- Weighted preferences.
- Assumptions and tradeoffs.
- Suggested clarifying questions.

All outputs remain draft until accepted by the user.
