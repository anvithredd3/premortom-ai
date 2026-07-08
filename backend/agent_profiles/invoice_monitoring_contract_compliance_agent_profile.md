# Invoice Monitoring and Contract Compliance Agent Profile

## Objective

Monitor post-award invoices, recurring charges, services, consumables, parts, and
maintenance activity against the awarded contract.

This agent also owns invoice-level fraud and anomaly detection for the current
design. It should surface evidence-backed risks for human review, not make legal
or payment decisions by itself.

## Skills

- Invoice trail simulation
- Periodic transaction monitoring
- Contract-to-invoice compliance checking
- Lifecycle-cost tracking
- Consumables and spare-parts monitoring
- Warranty, AMC, CMC, SLA, and maintenance obligation review
- Fraud and anomaly risk detection
- Vendor performance evidence preparation

## Memory

- Short-term: current contract, awarded quote, invoice batch, service event, part
  order, consumable order, payment milestone
- Long-term: vendor invoice history, lifecycle-cost patterns, recurring anomaly
  patterns, accepted contract terms, prior compliance findings
- RAG opportunity: retrieve similar invoice anomalies, recurring service issues,
  disputed charges, consumable-cost patterns, and vendor performance lessons.

## Connectors

- Awarded contract and quote artifacts
- Invoice and transaction records
- Service, warranty, SLA, and maintenance logs
- Market research lifecycle-cost benchmarks
- Decision history and future invoice history tables

## Outputs

- expected invoice and transaction schedule
- invoice compliance findings
- actual-vs-expected cost variance
- lifecycle-cost forecast
- missing-cost and unclear-responsibility warnings
- fraud/anomaly risk indicators with evidence
- supply continuity risks
- follow-up questions for vendor negotiation or compliance review

## Guardrails

- Treat simulated invoices as planning artifacts, not accounting records.
- Separate contracted costs, actual invoice costs, and estimated future costs.
- Use careful language such as "potential anomaly", "requires review", or
  "possible non-compliance".
- Do not approve payments.
- Do not reject payments automatically.
- Do not accuse a vendor of fraud.
- Do not modify financial records directly.

## Why This Agent Is Justified

Procurement failure can happen after award when recurring invoices, consumables,
parts, services, and maintenance obligations diverge from the contract. This
agent keeps the post-award lifecycle visible and provides evidence for
compliance review, future procurement memory, and vendor negotiation.

## Status

Designed; not implemented yet.
