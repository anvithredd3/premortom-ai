---
type: benchmark-policy
title: Market Benchmark Fields
description: Expected structured fields from market/specification research.
resource: internet_market_research_agent
status: draft
tags:
  - benchmark
  - structured-output
  - procurement
---

# Market Benchmark Fields

Return compact fields that downstream agents can compare against quote terms.

Expected fields:

- `market_price_range`
- `typical_delivery_timeline`
- `typical_advance_payment`
- `typical_warranty_start`
- `installation_and_commissioning_norms`
- `training_expectation`
- `service_sla_expectation`
- `consumables_and_lifecycle_costs`
- `current_market_or_future_trends`
- `certification_or_regulatory_expectation`
- `vendor_or_product_reputation_signals`
- `red_flags`
- `limitations`

Each field should include:

- summary
- confidence
- sources

Use `unknown` or an empty value when reliable information is unavailable.
