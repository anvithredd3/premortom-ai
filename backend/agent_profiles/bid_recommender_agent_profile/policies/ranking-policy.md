---
type: ranking-policy
title: Quote Ranking Policy
description: Ranking guidance for comparing reviewed quotes within one bid.
resource: bid_recommender_agent
status: draft
tags:
  - ranking
  - shortlist
  - quote-comparison
---

# Quote Ranking Policy

The core ranking should be deterministic and auditable.

## Ranking Order

The recommender should compare quotes in this order:

1. **Minimum qualification criteria**
2. **Management criteria and weights**
3. **Risk and execution guardrails**
4. **Value, service, and lifecycle tradeoffs**
5. **External market/specification benchmarks when available**

## Minimum Qualification Criteria

Minimum criteria are the baseline requirements a quote must satisfy before it
can be recommended. Initially, these should come from management or the bid
criteria configured for the procurement.

Examples:

- Required equipment or service category.
- Mandatory certifications or regulatory approvals.
- Required technical capability or specification coverage.
- Budget or price ceiling when management defines one.
- Delivery deadline or maximum acceptable timeline.
- Warranty and service requirements.
- Installation, commissioning, and acceptance responsibilities.
- Training or handover requirements.
- Required local support or service response capability.
- Mandatory documentation, compliance, or bid submission completeness.

## Cutoffs And Negotiable Gaps

Cutoffs should be part of ranking, but not every below-cutoff feature should
automatically exclude a quote. Classify each cutoff failure as one of:

1. **Hard blocker**
   - Legal, regulatory, safety, certification, eligibility, or mandatory bid
     compliance failure.
   - Normally exclude or require human override before shortlist.

2. **Negotiable gap**
   - Commercial or operational term that can be corrected before award.
   - Examples: advance payment too high, warranty trigger unclear, training not
     included, service SLA incomplete, installation responsibility unclear.
   - A high-ranking quote may remain in the shortlist with explicit conditions
     and negotiation points.

3. **Scoring penalty**
   - Below-target but acceptable weakness.
   - Examples: delivery is slightly slower than preferred, local support is
     available but less mature, documentation is incomplete but recoverable.
   - Apply a penalty and explain the tradeoff.

The recommender should distinguish between:

- **Reject**: quote fails a hard blocker.
- **Shortlist with conditions**: quote is strong overall but has negotiable
  below-cutoff features.
- **Rank with penalty**: quote remains eligible but weaker on one or more
  criteria.

A quote that fails minimum criteria should not be selected as an unconditional
winner. If it remains highly ranked because of other strengths, the output must
state the cutoff failures, required negotiation fixes, and whether human review
is needed.

## Management Criteria And Weights

After minimum eligibility, the recommender should apply management's comparison
criteria and weights when available. These criteria represent the organization's
decision priorities, not just the vendor's submitted claims.

Examples:

- Price or total cost.
- Technical fit.
- Delivery speed.
- Service and maintenance quality.
- Warranty strength.
- Vendor reliability.
- Implementation ownership.
- Long-term operational value.
- Risk tolerance.

If management criteria are missing, the recommender should state that the
ranking is based mainly on available contract-review signals and should be
treated as a provisional shortlist.

## Risk And Execution Guardrails

Prefer quotes that combine:

- Lower contract risk.
- Fewer hard blockers.
- Clearer warranty, installation, commissioning, training, and service terms.
- Lower ambiguity or conflict between fixed fields and raw quote text.
- Stronger evidence quality.

Do not select a quote only because it has the lowest risk score if it has an
unresolved blocker that makes award unsafe.

## External Market And Future-Trend Augmentation

Later, the recommender can augment management criteria with source-aware
internet or MCP research. This should help identify whether a quote is unusual
relative to current market and specification norms.

Examples:

- Current market price ranges.
- Typical delivery timelines.
- Typical advance payment or retention practices.
- Expected warranty start trigger.
- Expected training inclusion.
- Expected service SLA and spare-parts commitments.
- Emerging regulatory, technology, or market trends.

External research should not replace management criteria. It should act as a
benchmark layer that highlights gaps, unusual terms, or future-readiness risks.

The LLM may improve explanation language, but it should not silently change the
winner, ranked quote list, shortlist, or score components.
