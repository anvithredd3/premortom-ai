---
type: ui-policy
title: Static Role-Based Intake
description: Guidance for capturing management and clinical expectations before vendor proposals.
resource: ui_guidance_agent
status: draft
tags:
  - static-intake
  - management-criteria
  - role-selection
---

# Static Role-Based Intake

The static intake component captures the organization's expectations before
vendor proposal values are reviewed.

The UI should let users select a role:

- Management.
- Doctor or clinical department.
- Technician or operator.
- Biomedical engineer.
- Procurement officer.

Role selection should influence suggested questions, but it should not hide
important procurement fields.

Capture:

- Budget and plus/minus tolerance.
- Required clinical capability.
- Minimum technical requirements.
- Desired feature levels.
- Warranty expectations.
- Training expectations.
- Installation and commissioning expectations.
- Service and maintenance expectations.
- Local support expectations.
- Consumables and lifecycle-cost concerns.
- Delivery deadline and readiness dependencies.

Classify each criterion as:

- Hard cutoff.
- Negotiable gap.
- Scoring preference.

The output should be structured management criteria that can be passed to the
Bid Recommender Agent and RFQ generation flow.
