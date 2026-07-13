# RFQ Requirement Design

## Purpose

The RFQ Intake page should become the management-facing screen where the buyer
defines what value the procurement should deliver before any vendor proposal is
reviewed.

The page should not look like a long static form. It should behave like a
requirement design workspace:

1. Select a reviewer role or use the default management view.
2. Add one requirement at a time through a single input window.
3. Assign priority, perspective value, and estimated cost or cost source.
4. Visualize role-specific requirements in priority order.
5. Combine all roles into a radial value map for the RFQ.
6. Publish the RFQ requirements for later vendor proposal review.

This supports the pitch that PreMortem is not only finding risk after a proposal
arrives. It helps management design a better decision surface before the market
responds.

## Core Product Idea

Each requirement is a value contributor from a specific role's perspective.

For example, from a doctor's perspective in an MRI procurement:

| Priority Rank | Requirement | Perspective Value | Meaning |
|---:|---|---:|---|
| 1 | Core MRI imaging capability | 30% | Required clinical function |
| 2 | Scan calibration / focus control | 25% | Helps doctors operate scans better |
| 3 | Patient throughput and workflow fit | 15% | Improves daily usage |
| 4 | AI-based organ marking | 20% | Useful but not core |
| 5 | AI-based disease artifact detection | 10% | Helpful advanced feature |

High-priority requirements are closer to the center of the visual map. Lower
priority requirements move toward the circumference. Radius therefore represents
priority distance from the core decision.

Perspective value represents how much of that role's total value is explained by
the requirement. The sum for a role should ideally equal 100%.

Cost represents estimated incremental cost, total cost contribution, or market
benchmark cost for the requirement. In the first demo this may be manually
entered or left as unknown. Later it can be filled by market research.

## Role-Specific Requirement Examples

The same data model can support every perspective, but each role should define
value in its own language.

### Doctor Perspective

Doctor value is clinical usefulness, patient workflow, scan quality, and ease of
operation.

| Priority Rank | Requirement | Perspective Value | Cost Meaning |
|---:|---|---:|---|
| 1 | Core MRI imaging capability for required clinical cases | 30% | Base clinical capability |
| 2 | Scan calibration / focus control to improve operator control | 25% | Usability and scan quality premium |
| 3 | Patient throughput and workflow fit | 15% | Time saved per scan session |
| 4 | AI-based organ marking | 20% | Advanced clinical assistance premium |
| 5 | AI-based disease artifact detection | 10% | Optional diagnostic-support premium |

### Biomedical Engineering / Service Perspective

Biomedical engineering value is maintainability, uptime, installation clarity,
training, and service continuity.

| Priority Rank | Requirement | Perspective Value | Cost Meaning |
|---:|---|---:|---|
| 1 | Vendor owns installation and commissioning | 30% | Avoids buyer-side setup burden |
| 2 | Service response SLA must be contractually stated | 25% | Uptime protection |
| 3 | Spare-parts availability commitment | 20% | Downtime reduction |
| 4 | Preventive maintenance schedule included | 15% | Long-term reliability |
| 5 | Training and handover documentation included | 10% | Operational adoption and support readiness |

### Finance Perspective

Finance value is budget control, cash-flow protection, lifecycle-cost visibility,
and avoidance of hidden recurring costs.

| Priority Rank | Requirement | Perspective Value | Cost Meaning |
|---:|---|---:|---|
| 1 | Total cost of ownership must be visible | 30% | Prevents hidden recurring cost |
| 2 | Payment milestones tied to commissioning and acceptance | 25% | Reduces advance payment exposure |
| 3 | Warranty, AMC, and CMC costs separated clearly | 20% | Avoids double payment |
| 4 | Consumables and software subscriptions disclosed | 15% | Controls lifecycle leakage |
| 5 | Quoted price benchmarked against acceptable market range | 10% | Confirms commercial reasonableness |

### Procurement Officer Perspective

Procurement value is comparability, enforceability, audit readiness, and fair
vendor evaluation.

| Priority Rank | Requirement | Perspective Value | Cost Meaning |
|---:|---|---:|---|
| 1 | Mandatory and negotiable criteria clearly separated | 25% | Reduces evaluation ambiguity |
| 2 | Warranty trigger tied to commissioning or acceptance | 25% | Protects buyer value |
| 3 | Delivery, installation, and acceptance obligations measurable | 20% | Improves contract enforceability |
| 4 | Vendor exceptions and exclusions must be disclosed | 15% | Reduces hidden contract risk |
| 5 | Comparable quote format required across vendors | 15% | Improves fair comparison |

### Management Perspective

Management value is stakeholder alignment, approval readiness, cost visibility,
and strategic fit.

| Priority Rank | Requirement | Perspective Value | Cost Meaning |
|---:|---|---:|---|
| 1 | Critical stakeholder needs are represented in the RFQ | 25% | Reduces decision reversal risk |
| 2 | Core value requirements are costed or cost-source identified | 25% | Improves approval confidence |
| 3 | High-priority risks have mitigation or negotiation conditions | 20% | Improves GO / CONDITIONS decision quality |
| 4 | RFQ criteria are auditable and comparable | 15% | Supports governance |
| 5 | Optional features do not distract from core outcomes | 15% | Preserves decision discipline |

### IT / Digital Systems Perspective

For equipment with software, networking, data, AI, or hospital-system
integration, IT should be a separate perspective.

| Priority Rank | Requirement | Perspective Value | Cost Meaning |
|---:|---|---:|---|
| 1 | Integration with hospital systems and data workflows | 30% | Integration effort and interface cost |
| 2 | Cybersecurity and access-control requirements stated | 25% | Security and compliance exposure |
| 3 | Software licensing and upgrade terms disclosed | 20% | Recurring software cost |
| 4 | Data export, backup, and interoperability supported | 15% | Avoids vendor lock-in |
| 5 | AI module validation and explainability expectations stated | 10% | Governance and validation cost |

### Compliance / Legal Perspective

Compliance and legal value is policy alignment, regulatory defensibility,
contract clarity, and audit protection.

| Priority Rank | Requirement | Perspective Value | Cost Meaning |
|---:|---|---:|---|
| 1 | Regulatory certifications and approvals documented | 30% | Compliance blocker avoidance |
| 2 | Contract obligations and remedies are enforceable | 25% | Legal protection |
| 3 | Data, privacy, and patient-safety obligations stated | 20% | Regulatory exposure control |
| 4 | Vendor representations and exclusions explicitly listed | 15% | Dispute prevention |
| 5 | Audit trail and approval evidence preserved | 10% | Audit readiness |

### Operations / Facility Perspective

Operations and facility value is readiness of space, utilities, logistics, and
handover.

| Priority Rank | Requirement | Perspective Value | Cost Meaning |
|---:|---|---:|---|
| 1 | Site readiness requirements are explicit | 30% | Civil/electrical readiness cost |
| 2 | Power, cooling, shielding, and safety prerequisites stated | 25% | Infrastructure dependency cost |
| 3 | Delivery logistics and installation window defined | 20% | Operational disruption cost |
| 4 | Acceptance testing and handover process stated | 15% | Commissioning confidence |
| 5 | Downtime or temporary-service plan considered | 10% | Continuity planning cost |

### Patient / End-User Perspective

For hospitals, patient or end-user value can be represented directly or through
clinical leadership.

| Priority Rank | Requirement | Perspective Value | Cost Meaning |
|---:|---|---:|---|
| 1 | Patient safety and scan reliability protected | 35% | Safety-critical value |
| 2 | Appointment availability and throughput improved | 25% | Access and waiting-time impact |
| 3 | Comfort, accessibility, and workflow considered | 15% | Experience improvement |
| 4 | Repeat-scan reduction through quality controls | 15% | Avoided operational waste |
| 5 | Service continuity during failures planned | 10% | Continuity and trust impact |

## Additional Perspectives To Consider

Start with five core roles for the demo:

- Management
- Doctor
- Biomedical Engineer
- Finance
- Procurement Officer

Additional perspectives can be added based on customer context:

- IT / Digital Systems
- Compliance / Legal
- Operations / Facility
- Patient / End User
- Vendor Management
- Sustainability / ESG
- Security
- Training / Change Management
- Supply Chain / Inventory

For the hackathon, avoid showing too many roles by default. Use Management as
the consolidated view and allow other perspectives to be added when they matter
for the specific procurement.

## Screen Name

Use:

```text
1 · RFQ Intake
```

This should be the first page in the app.

## Page Layout

### Top Bar

The top of the page should be compact.

Controls:

- Role selector
- RFQ name
- Equipment or service type
- Publish RFQ button

Default role:

```text
Management
```

Roles:

- Management
- Doctor
- Biomedical Engineer
- Finance
- Procurement Officer

Management view should show the consolidated picture across roles. Other roles
should show only the selected role's requirements and inputs.

### Main Screen Composition

The RFQ Intake screen should feel like a command workspace, not a questionnaire.

Recommended first viewport:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Top bar: RFQ name | role selector | equipment type | publish             │
├─────────────────────────────┬──────────────────────┬────────────────────┤
│ Radial Requirement Map       │ Cost Confidence Meter│ Role Chat          │
│ core-to-edge value map       │ vertical cost gauge  │ avatars + messages │
├─────────────────────────────┴──────────────────────┴────────────────────┤
│ Expandable role-grouped requirement table                                │
└──────────────────────────────────────────────────────────────────────────┘
```

Left:

- Combined radial requirement map.
- Shows all role requirements in management view.
- Filters to one role when a role is selected.

Middle:

- Vertical cost/value indicator.
- Shows device cost, known requirement cost, unknown cost items, and confidence.

Right:

- Chat panel with role-based avatars.
- Chat is the primary way to add requirements.
- The compact requirement form appears only as an edit/confirm panel after the
  agent extracts a structured requirement from chat.

Bottom:

- Scrollable requirement table.
- Grouped by role with expand/collapse sections.
- Management can expand only the roles they want to inspect.

### Chat-First Requirement Input

Avoid large forms. The main input should be chat. The user speaks naturally as a
role, and the UI Guidance Agent converts the message into a structured
requirement suggestion.

Example chat:

```text
Doctor: We need reliable cardiac MRI capability and easier scan calibration.
```

Agent output shown as a compact confirmation card:

```text
Requirement: Cardiac MRI capability
Role: Doctor
Priority: 1
Value %: 30
Cost: Unknown
Action: Add / Edit / Discard
```

Use one compact edit area for adding or editing one requirement at a time after
chat extraction.

Fields:

- Requirement text
- Role
- Priority rank
- Perspective value percentage
- Estimated cost
- Cost confidence
- Source type
- Notes or evidence

Suggested labels:

```text
Requirement
Role
Priority
Value %
Estimated Cost
Cost Confidence
Cost Source
Notes
```

Cost source options:

- Manual estimate
- Vendor quote
- Market research
- Historical procurement
- Unknown

Cost confidence options:

- Unknown
- Low
- Medium
- High

Button:

```text
Add Requirement
```

Secondary actions:

- Update selected
- Remove selected
- Clear draft

The chat should support adding many requirements without expanding the page. The
requirement table at the bottom handles scale.

### Role-Based Chat Avatars

Each role should have a visible avatar in chat so the conversation feels like a
multi-stakeholder RFQ design session.

Suggested avatars:

| Role | Avatar Label | Visual Treatment |
|---|---|---|
| Management | MGMT | dark neutral circle |
| Doctor | DR | clinical blue circle |
| Biomedical Engineer | BIO | technical green circle |
| Finance | FIN | amber/gold circle |
| Procurement Officer | PROC | slate/purple circle |
| IT / Digital Systems | IT | cyan circle |
| Compliance / Legal | LEGAL | red/maroon circle |
| Operations / Facility | OPS | orange circle |
| Patient / End User | USER | soft teal circle |

The chat can show:

- active role avatar for the human input
- UI Guidance Agent avatar for extracted suggestions
- system badges such as `suggested`, `needs cost`, `ready to add`

Do not use long role descriptions inside the chat. Use concise labels and
tooltips if needed.

## Requirement Data Model

Suggested frontend/backend shape:

```json
{
  "id": "REQ-001",
  "rfq_id": "RFQ-001",
  "role": "doctor",
  "requirement": "Core MRI imaging capability",
  "priority_rank": 1,
  "priority_radius": 0.0,
  "perspective_value_pct": 30.0,
  "estimated_cost_cr": 4.5,
  "cost_confidence": "medium",
  "cost_source": "market_research",
  "notes": "Required for clinical use cases.",
  "created_at": "..."
}
```

Derived fields:

```text
priority_radius = (priority_rank - 1) / max(priority_count - 1, 1)
```

Interpretation:

- `0.0` means core requirement at the center.
- `1.0` means lowest-priority requirement at the circumference.

For role-level linear visualization, x-position can use either:

```text
x = priority_radius
```

or:

```text
x = cumulative perspective value ordered by priority
```

The first is better for priority distance. The second is better for showing how
quickly value accumulates.

## Visual 1: Role Requirement Line

Purpose:

Show the selected role's requirements in priority order without overwhelming the
page.

Recommended chart:

```text
Linear requirement value plot
```

X-axis:

```text
Core priority -> lower priority
```

Y-axis:

```text
Perspective value %
```

Each point:

- requirement label
- priority rank
- value percentage
- estimated cost

Visual behavior:

- Priority 1 appears closest to the center/left.
- Requirements appear in decreasing priority order.
- Marker size can represent estimated cost.
- Marker color can represent cost confidence or role.
- Area under the line represents the role's perceived value coverage.

Business interpretation:

The plot answers:

```text
What does this role actually care about, and how much value is concentrated in
the core requirements?
```

Example:

For doctors, the first two or three requirements may explain most value. This is
important for negotiation because vendor features outside the high-value area
should not distract the buyer from core clinical needs.

## Visual 2: Combined RFQ Radial Requirement Map

Purpose:

Show the full RFQ as a multi-role value map.

Recommended chart:

```text
Radial requirement map
```

Technical naming note:

`Web plot` is understandable in conversation, but the more precise name for this
design is `radial requirement map` or `radial scatter plot`.

A `radar chart` is different: it compares values across fixed axes. This RFQ
visual places many requirement points at different radii, so `radial requirement
map` is the better product and technical name.

Center:

```text
Core requirements
```

Circumference:

```text
Low-priority requirements
```

Radius:

```text
priority_radius from 0 to 1
```

Angle:

Use role lanes or grouped sectors:

- Doctor sector
- Biomedical Engineering sector
- Finance sector
- Procurement sector
- Management sector

Marker size:

```text
Perspective value %
```

Marker color:

```text
Role
```

Marker border or opacity:

```text
Cost confidence
```

Hover text:

- Requirement
- Role
- Priority rank
- Perspective value
- Estimated cost
- Cost source

Business interpretation:

The radial plot answers:

```text
Where is value concentrated across all stakeholders?
```

If many high-value items are near the center, the RFQ has a clear core. If high
value is scattered toward the circumference, management should reconcile
priorities before publishing the RFQ.

## Visual 3: Vertical Cost Confidence Meter

Purpose:

Show whether the RFQ is designing value against the likely cost of the device or
service.

Recommended visual:

```text
Vertical cost confidence meter beside the radial requirement map
```

The fun-fair hammer game visual is commonly called a `high striker`. For a
professional UI, use names like:

- vertical cost confidence meter
- cost exposure gauge
- cost readiness meter
- value-cost thermometer

Recommended product label:

```text
Cost Confidence Meter
```

Metrics:

- Estimated device cost
- Known requirement cost
- Unknown cost count
- High-value requirement cost
- Value coverage

Suggested KPI labels:

```text
Device Cost
Known Requirement Cost
Unknown Cost Items
Core Value Coverage
```

Definitions:

`Device Cost`
: Expected total cost of the equipment or service.

`Known Requirement Cost`
: Sum of estimated costs attached to requirements.

`Unknown Cost Items`
: Requirements with missing or unknown cost.

`Core Value Coverage`
: Sum of perspective value for high-priority requirements, for example priority
  rank 1 to 3 or radius <= 0.33.

Cost color:

Use color to show exposure or uncertainty:

- Green: most high-value requirements have known cost.
- Amber: some high-value requirements have unknown or low-confidence cost.
- Red: core requirements have unknown cost or likely high premium.

Visual behavior:

- Vertical scale can run from 0 to estimated device cost.
- Filled portion can show known requirement cost.
- Marker can show total device cost.
- Color can show cost confidence or risk:
  - green for high confidence
  - amber for partial confidence
  - red for unknown core costs
- Tooltip should explain what is counted and what is unknown.

This is not meant to solve optimization yet. It tells management whether the RFQ
has enough cost visibility to publish or negotiate.

## Requirement Table

The bottom of the page should show a scrollable table.

Columns:

- Priority
- Requirement
- Role
- Value %
- Estimated Cost
- Cost Confidence
- Cost Source
- Notes

The table should support:

- sorting by role
- sorting by priority
- selecting a row for edit/remove
- filtering to selected role
- expanding and collapsing role groups
- showing only roles selected by management
- hiding lower-priority rows until expanded

Management view should default to all roles. Individual role view should filter
to that role.

Recommended table structure:

```text
▾ Doctor
  Priority | Requirement | Value % | Cost | Confidence | Source
▸ Finance
▾ Biomedical Engineer
  Priority | Requirement | Value % | Cost | Confidence | Source
```

Management should be able to collapse low-interest roles and keep high-interest
roles expanded during review.

## Management View

Management should not enter every technical detail by default. Management should
see a consolidated view of stakeholder priorities.

Management default screen should show:

1. RFQ readiness KPIs.
2. Combined RFQ value web.
3. Cost and value panel.
4. Top concerns by role.
5. Scrollable requirements table.

Management can still add requirements, but the main value is synthesis.

Suggested management KPIs:

```text
RFQ Readiness
Core Value Coverage
Known Cost Coverage
Open Requirement Gaps
Publish Status
```

Suggested role concern summary:

| Role | Top Concern | Core Value | Cost Known |
|---|---|---:|---|
| Doctor | Core MRI imaging capability | 30% | Yes |
| Biomedical Engineer | Installation and commissioning | 25% | Partial |
| Finance | Lifecycle cost visibility | 30% | No |
| Procurement | Warranty and service SLA | 25% | Partial |

## Role-Specific Views

### Doctor

Default concerns:

- clinical capability
- image quality
- patient throughput
- workflow fit
- AI-enabled clinical support
- ease of operation

### Biomedical Engineer

Default concerns:

- site readiness
- installation responsibility
- commissioning
- training
- uptime and service SLA
- spare parts and preventive maintenance

### Finance

Default concerns:

- device cost
- advance payment
- milestone payment
- lifecycle cost
- warranty value
- cost uncertainty

### Procurement Officer

Default concerns:

- comparable RFQ criteria
- mandatory versus negotiable terms
- warranty trigger
- acceptance criteria
- vendor obligations
- audit trail

### Management

Default concerns:

- value clarity
- stakeholder alignment
- approval readiness
- cost visibility
- risk before award
- negotiation leverage

## RFQ Publish Behavior

Publishing RFQ should freeze a versioned snapshot:

```json
{
  "rfq_id": "RFQ-001",
  "status": "published",
  "requirements": [...],
  "role_summaries": [...],
  "kpis": {...},
  "published_at": "..."
}
```

In the current demo, publishing can store this in Streamlit session state.

Later, publishing should:

- write the RFQ to backend storage
- pass requirements to Vendor Procurement Input
- use RFQ requirements as evaluation criteria for vendor quotes
- compare vendor proposal evidence against each requirement
- preserve RFQ version history for audit

## Relationship To Vendor Procurement Input

Current demo:

```text
RFQ Intake -> Publish RFQ -> Vendor Procurement Input uses current existing form
```

Future version:

```text
RFQ Intake -> Publish RFQ -> Vendor response is evaluated requirement-by-requirement
```

The Vendor Proposal Agent should eventually map vendor evidence to RFQ
requirements:

```json
{
  "requirement_id": "REQ-001",
  "vendor_evidence": "...",
  "coverage": "full|partial|missing|conflicting",
  "risk": "low|moderate|high|critical",
  "negotiation_question": "..."
}
```

## Open Design Questions

1. Should value percentages sum to 100 per role, or should management assign
   role weights first and then normalize total RFQ value?
2. Should priority rank and value percentage be independent, or should high
   priority automatically imply high value?
3. Should estimated cost be per requirement, incremental premium, or allocated
   share of total device cost?
4. Should internet market research estimate feature cost automatically, or only
   provide benchmark hints for human confirmation?
5. Should conflicting priorities across roles trigger a management warning?

## Recommended Demo Scope

For the hackathon demo, implement only:

1. Chat-first requirement input with compact file upload control.
2. Role selector with Management default.
3. Requirement confirmation flow: `Yes, add`, `No`, `Chat further`.
4. Requirement table in session state with role-grouped expand/collapse.
5. Editable accepted requirements table.
6. Procurement Value Map using role-polygon area coverage.
7. Cost Meter showing actual known cost against proposed budget.
8. Publish RFQ snapshot to `rfq_sessions` and `rfq_requirements` in Postgres.

Do not solve full optimization yet. Present it as a multi-variable procurement
value design problem that the system visualizes and prepares for later
optimization.

## Current Implementation Notes

The current Streamlit RFQ page implements the following behavior.

### Chat And Data Entry

- The RFQ page uses chat as the main requirement entry surface.
- The active role is the person currently speaking in chat.
- The requirement perspective may differ from the active role. For example,
  Management can enter a Doctor requirement.
- The system should track:
  - `entered_by_role`: who typed or submitted the requirement.
  - `perspective_role`: which stakeholder perspective owns the requirement.
- Greetings and casual messages should not become requirements, including simple
  misspellings such as `helllo`.
- Known requirement templates are searched across all roles, not only the active
  role.
- User-provided priority, value percentage, and cost override template defaults.
- Unknown custom requirements should only be added after the user provides
  priority, value percentage, and cost or explicitly says cost is unknown.
- Proposed requirements are not added until the user confirms.

### Chat UI

- Chat messages use compact avatars such as `MGMT`, `DR`, `FIN`, and `AI`.
- The full role label should be available by hover/title, not repeated in every
  message.
- The composer uses:
  - a compact folder upload button
  - a two-line text entry area
  - a compact send button
- Native Streamlit upload controls are limited. A true drag-and-drop text-entry
  area would require a custom component.

### Procurement Value Map

- The implemented value visual is a radar-style role polygon, not a
  per-requirement radial scatter plot.
- Each vertex represents a role perspective:
  - Management
  - Doctor
  - Biomedical Engineering
  - Finance
  - Procurement
- Per-role value is the sum of accepted requirement value percentages for that
  perspective, capped at 100.
- Overall value coverage is:

```text
actual role polygon area / maximum outer polygon area
```

- The maximum value is the polygon with every role vertex at 100.
- The current value is the polygon generated from accepted requirements.

### Cost Meter

- The current cost visual is a compact Plotly meter, not a draggable slider.
- A native vertical draggable slider is not available in Streamlit.
- The meter shows:
  - blue line/dot: actual known cost from accepted requirements
  - gray line/dot: proposed procurement budget
  - rupee labels only
- The cost meter should not be described as total cost of ownership unless
  lifecycle costs are explicitly included.

### Requirement Table

- Accepted requirements are shown in role-grouped expand/collapse sections.
- The table allows editing requirement text, priority, value percentage, and
  cost.
- The table key should refresh when requirement IDs change so newly accepted
  requirements appear immediately.
- Table edits should be validated before committing them to session state.
- Invalid edits include negative priority/value/cost, value above 100%, role
  value totals above 100%, duplicate requirements in the same role, and known
  cost exceeding the RFQ budget.

### RFQ Error Handling

- Chat add and table edit validations should use the same rules.
- Missing priority, value percentage, or cost should trigger a clarification
  message instead of adding a custom requirement.
- Explicit unknown-cost wording should remain unknown cost, not zero cost.
- Publish should block invalid RFQs and warn when requirements are absent,
  stakeholder perspectives are missing, or role coverage is very low.
- A successful publish persists the RFQ session and accepted requirements to the
  database; session state only keeps the latest published response for the UI.

### Next Step: Vendor Publication

- Add a vendor publication page after database publish.
- Load the published RFQ from `rfq_sessions` and `rfq_requirements`.
- Generate a vendor-facing RFQ summary and message for human review.
- Allow the user to select or enter vendors and mark the package as draft,
  ready, sent manually, or cancelled.
- Do not send externally without explicit user approval.
- Treat X, Facebook, and other social channels as future optional connectors,
  not part of the current demo implementation.

### Next Step: RFQ-Driven Quote Comparison

- Vendor Proposal Agent should map each vendor quote to every accepted RFQ
  requirement.
- Bid Recommender should use requirement priority and value percentage as the
  buyer-defined value model.
- Recommendations should explain weighted RFQ value covered, missing core
  requirements, cost against budget, risk guardrails, and negotiation
  conditions.
- For the hackathon submission, keep showing the existing recommendation output
  while presenting the RFQ flow as the source of future RFQ-aware comparison.
- Do not validate dynamic RFQ requirements against the old static sample winner.
  Add versioned RFQ scenarios, rubric checks, and metamorphic tests after the
  demo deadline.
