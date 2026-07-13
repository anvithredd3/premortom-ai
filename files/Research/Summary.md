# Research

---


## Esisting features:

```
| Area                    | What Zycus / Coupa / Ivalua provide                                                |
| ----------------------- | ---------------------------------------------------------------------------------- |
| Supplier Management     | Onboarding, qualification, risk scoring, performance tracking                      |
| Strategic Sourcing      | RFx, supplier discovery, bid comparison, auctions, supplier selection              |
| Contract Management     | Contract repository, approval workflows, renewal tracking, compliance              |
| Spend Analytics         | Spend visibility, category analysis, savings tracking, cost dashboards             |
| Procure-to-Pay          | Requisitions, purchase orders, invoice processing, payments                        |
| AP Automation           | OCR, invoice matching, exception handling, tax compliance                          |
| Compliance & Governance | Policy enforcement, audit trails, approval controls                                |
| AI Capabilities         | Procurement copilots, supplier recommendations, spend insights, invoice automation |
| Integrations            | ERP, finance systems, supplier portals, APIs                                       |
```


---
One-line summary

Existing solutions focus on automating procurement workflows, supplier management, sourcing, invoicing, compliance, and spend visibility using AI-assisted analytics and automation.

---


## Possible domains
1. Small business
2. Govenrment/restricted domain


## Potential gaps
1. Contract drift detection
2. Vendor rate anomaly detection
3. Contract-to-invoice gap analysis
4. Negotiation opportunity prediction
5. Flexible compliance for small businesses
6. Explainable procurement anomaly detection
7. Knowledge retention from historical negotiations


These gaps are where an Agentic AI solution could differentiate itself.

---

## Problem Statement:

Existing procurement platforms focus on automating sourcing, supplier management, invoicing, and compliance. However, they provide limited proactive intelligence for detecting contract drift, vendor rate anomalies, invoice-contract mismatches, and renegotiation opportunities. Organizations therefore continue to incur avoidable procurement costs despite having modern procurement systems.

## Top Challenges
| Challenge                               | Business Impact                                               |
| --------------------------------------- | ------------------------------------------------------------- |
| Human Approval Bottlenecks              | Increased cycle time and operational cost                     |
| Compliance, Reliability & Observability | Audit risk and reduced trust in AI decisions                  |
| Procurement Knowledge Fragmentation     | Loss of institutional knowledge                               |
| Contract & Data Silos                   | Slow and incomplete decision making                           |
| Reactive Procurement                    | Missed savings and risk mitigation opportunities              |
| Vendor Cost Leakage                     | Hidden overspending through rate drift and invoice mismatches |
| Small Business Flexibility              | Enterprise solutions are costly and process-heavy             |


## Proposed Solution
An Agentic Vendor Cost Intelligence Platform that continuously analyzes contracts, invoices, vendor performance, and historical negotiations to identify cost leakage, explain anomalies, and recommend actionable savings opportunities.

## Current Product Direction

The latest implementation direction starts with MRI procurement but keeps the
platform extensible:

- Vendor Proposal Agent extracts fixed quote fields and proposal intelligence
  from uploaded PDFs.
- Contract Review Agent evaluates risk using quote inputs, OKF memory, and
  bounded historical decision context.
- Internet / Market Research Agent adds current market and vendor context when
  enabled.
- Bid Recommendation Agent ranks quotes using management criteria, minimum
  cutoffs, negotiable exceptions, and evidence from other agents.
- RFQ Intake and Negotiation UI Guidance Agent helps create realistic RFQ
  requirements and draft vendor negotiation questions.
- Invoice Monitoring and Contract Compliance Agent is the planned post-award
  extension for contract-to-invoice matching, periodic service/supply tracking,
  and fraud or drift detection.

Memory is split into OKF profile memory, run-level decision history, and
agent-level history so each agent can retrieve the context that matches its job.

## Potential Gaps

1. **Contract Drift Detection**
   Identify gradual deviations in vendor pricing, terms, or service levels from the original contract over time.

2. **Vendor Rate Anomaly Detection**
   Detect unusual vendor rate changes and determine whether they are justified by market or operational factors.

3. **Contract-to-Invoice Gap Analysis**
   Continuously verify that invoices comply with contractual pricing, terms, and agreed deliverables.

4. **Negotiation Opportunity Prediction**
   Proactively identify vendors and contracts that are likely to yield savings through renegotiation.

5. **Flexible Compliance for Small Businesses**
   Enable risk-based and explainable compliance controls that adapt to the needs of smaller organizations.

6. **Explainable Procurement Anomaly Detection**
   Detect procurement anomalies and provide clear business explanations rather than simple alerts.

7. **Knowledge Retention from Historical Negotiations**
   Preserve negotiation rationale, exceptions, and procurement decisions to prevent loss of institutional knowledge.
