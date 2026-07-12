# PreMortem AI — UI Status Checklist

Reference architecture: `files/Research/High_level_Agent_architecture_v3.md`

---

## Legend

| Dot | Meaning |
|-----|---------|
| 🔵 | Built — connected to backend and functional |
| 🟠 | Partial — UI shell exists but backend not wired, placeholder, or incomplete |
| ⚫ | Not built yet |

---

## Screens

### RFQ / Negotiation Guidance *(new screen — separate from Screen 01 per architecture §5.2)*

> Architecture is explicit: this must be a **separate page** from Procurement Input.
> Currently the criteria weights tab lives inside Screen 01 — that needs to move here.

- ⚫ Screen added to nav
- ⚫ Role selector (management / doctor / technician / biomedical engineer / procurement officer)
- ⚫ Expectation profile selector (premium capability / balanced / lowest lifecycle cost / fastest / strict compliance)
- ⚫ Budget + tolerance inputs (budget Cr, ±%)
- ⚫ Mandatory hard-cutoff criteria inputs
- ⚫ Negotiable criteria inputs
- ⚫ Feature weights (currently inside Screen 01 — move here)
- ⚫ Static intake → structured management expectation profile output
- ⚫ Chat guidance — initial RFQ generation (calls bid recommender + market research)
- ⚫ Chat guidance — negotiation mode (post-bid, loads bid_id + quote_id)
- ⚫ Top N vendor comparison view (feature tradeoff table / risk-vs-value chart)
- ⚫ Adjust feature values → see cost / risk impact
- ⚫ Draft vendor negotiation message
- ⚫ API `POST /api/ui-guidance/rfq-negotiation` mode: `rfq_intake`
- ⚫ API `POST /api/ui-guidance/rfq-negotiation` mode: `negotiation`
- ⚫ Display: requirement summary, suggested requirements, missing inputs, negotiation questions, contract conditions, lifecycle cost items, draft vendor message, evidence, guardrails

---

### 01 · Procurement Input

- 🔵 Free-text / paste document input
- 🔵 PDF / file drag-and-drop upload zone
- 🔵 UI Guidance Agent call → `POST /api/ui-guidance/rfq-negotiation`
- 🔵 RFQ guidance panel (missing inputs, suggested requirements, risk signals)
- 🔵 Structured field form (14 fields)
- 🔵 Multi-currency contract value (USD M/K, EUR M, GBP M, INR Cr/L) with conversion
- 🔵 Missing field highlighting (amber)
- 🔵 RUN ANALYSIS button → `POST /api/analyze`
- 🔵 LOAD SAMPLE shortcut
- 🟠 Management Criteria tab (UI built — should move to separate RFQ / Negotiation page)
- ⚫ Role selector
- ⚫ Expectation profile selector

---

### 02 · Investigation Board

- 🔵 Agent status card grid (6 agents: contract / infra / workforce / historical / financial / decision)
- 🔵 Status dot per agent (running / complete / error)
- 🔵 Risk severity badge per agent (CRITICAL / HIGH / MODERATE / LOW)
- 🔵 Risk score number
- 🔵 Verdict excerpt
- 🔵 Top 2 evidence items per agent
- 🔵 Expand to full report per agent card
- 🔵 Empty state when no run yet
- ⚫ Orchestrator status panel (shows orchestrator as a visible manager entity)
- ⚫ Evaluator Agent feedback panel (quality check, consistency, confidence, missing evidence)
- ⚫ Workflow selector (shows which workflow is active — PreMortem / Vendor Eval / etc.)
- ⚫ Parallel execution timeline (which agents ran in parallel, timing)

---

### 03 · Debate Room

- 🔵 Debate transcript display
- 🔵 Agent turns color-coded by agent (contract=blue / infra=purple / workforce=cyan / historical=green / financial=amber / decision=red)
- 🔵 Empty state when no run yet
- 🟠 Human-in-the-loop review textarea (UI shell only — labeled COMING SOON)
- ⚫ Human review routes to UI Guidance Agent
- ⚫ Human override logged to decision history

---

### 04 · Executive Dashboard

- 🔵 Decision hero card (GO / NO-GO / CONDITIONAL GO)
- 🔵 4 KPI cards (Overall Risk Score / Financial Exposure / Failure Probability / Predicted Delay)
- 🔵 Risk bar chart per agent (Plotly)
- 🔵 Radar chart (agent risk profile)
- 🔵 Token usage chart
- 🔵 Latency chart
- 🔵 Scenario cards (Best / Expected / Worst case)
- 🔵 Empty state when no run yet
- ⚫ Evaluator quality badge (did evaluator pass this report?)
- ⚫ Confidence indicator from Evaluator Agent
- ⚫ Orchestrator completion status (all required agents ran?)

---

### 05 · PreMortem Report

- 🔵 Report header (procurement name / date / equipment type / contract value)
- 🔵 Decision chip (GO / NO-GO / CONDITIONAL GO)
- 🔵 Conditions list
- 🔵 Predicted outcomes
- 🔵 Supporting evidence list
- 🔵 Predicted failure mode
- 🔵 Export button — JSON → `POST /api/report/json`
- 🟠 Export button — PDF → `POST /api/report/pdf` (API wired, output quality TBD)
- 🟠 Export button — DOCX → `POST /api/report/docx` (API wired, output quality TBD)
- ⚫ Follow-up questions (surfaced from agent outputs)
- ⚫ Human approval / reject / revise action (routes to next workflow step)
- ⚫ Evaluator sign-off status

---

### 06 · Bid Evaluation

- 🔵 Bid dashboard / list view (`BidDashboard`)
- 🔵 Quote upload — PDF per vendor (`QuoteUpload`)
- 🔵 Bid run monitor — live agent progress (`BidMonitor`)
- 🔵 Bid results view (`BidResults`)
- 🟠 Vendor Proposal Agent output per quote (agent runs but no dedicated display card)
- ⚫ Side-by-side vendor comparison table (feature / risk / cost across all quotes)
- ⚫ Shortlist view (top 2 / top 3 with rationale)
- ⚫ Rejection reasons for weaker quotes
- ⚫ Negotiation points per quote
- ⚫ Link to RFQ / Negotiation Guidance screen (post-bid negotiation mode)

---

### 07 · Market Research

- 🔵 Market price range card + confidence chip
- 🔵 Typical contract terms grid (delivery / advance / warranty / training / service SLA)
- 🔵 Vendor & product reputation signals
- 🔵 Lifecycle & consumable costs
- 🔵 Market trends + signals
- 🔵 Red flags
- 🔵 Research limitations
- 🔵 Empty state (no bid run completed yet)
- 🔵 Skip state (when `MARKET_RESEARCH_ENABLED=0`)
- 🔵 Refresh button
- 🟠 Requires `MARKET_RESEARCH_ENABLED=1` + `OPENAI_API_KEY` — disabled by default in docker-compose

---

### 08 · Database / Memory

- 🔵 Connection status cards (DATABASE CONFIGURED / DATABASE CONNECTED / PGVECTOR AVAILABLE)
- 🔵 Table row counts — all 5 pgvector tables
- 🔵 Recent decision history table (run ID / title / risk level / score / date)
- 🔵 Agent memory chunks table (agent / source / type / updated)
- 🔵 Agent history chunk counts per agent
- 🔵 Docker startup hint when not connected (`docker compose up -d`)
- 🔵 Refresh button

---

### 09 · Invoice Monitoring / Post-Award *(not built — architecture §5.5.7)*

- ⚫ Screen added to nav
- ⚫ Expected invoice & transaction schedule view
- ⚫ Invoice compliance findings
- ⚫ Lifecycle cost forecast (actual vs expected variance)
- ⚫ Missing-cost and unclear-responsibility warnings
- ⚫ Anomaly / fraud risk indicators with evidence
- ⚫ Supply continuity risk signals
- ⚫ Follow-up questions for compliance review

---

## Navigation & Layout

- 🔵 Sidebar with 3 sections (PREMORTEM ANALYSIS / BID EVALUATION / INTELLIGENCE)
- 🔵 Active screen highlight + accent dot
- 🔵 Screens 02–05 dimmed in sidebar when no run exists
- 🔵 Header breadcrumb with contextual action buttons
- 🔵 ANALYZING pulse animation in header during run
- 🔵 Error banner below header
- 🔵 Lazy loading for Plotly-heavy screens (analysis chunk loads on first nav to 02–05)
- ⚫ RFQ / Negotiation Guidance in nav (new screen)
- ⚫ Invoice Monitoring / Post-Award in nav
- ⚫ Workflow selector in header (which platform workflow is active)
- ⚫ Future workflow placeholders in sidebar (Vendor Eval / Compliance Audit / Cost Optimization — locked/grayed)
- ⚫ Platform identity signal (shows this is a generic agentic decision review platform, not only MRI)

---

## Cross-Cutting

- 🔵 LOAD SAMPLE shortcut (pre-filled AIIMS MRI data)
- 🔵 RERUN with same input
- 🔵 NEW ANALYSIS / CLEAR flow
- 🟠 Docker DB required for memory features — hint shown in UI, not enforced
- ⚫ Orchestrator surfaced as a visible first-class concept
- ⚫ Evaluator Agent output visible to user (quality, confidence, missing agents)
- ⚫ Human approval workflow (approve / revise / reject with audit log)
- ⚫ OKF memory viewer (which knowledge files were loaded per agent)

---

## Summary Count

| State | Count |
|-------|-------|
| 🔵 Implemented | ~55 |
| 🟠 Partial | ~10 |
| ⚫ Not built | ~40 |

*Last updated: 2026-07-08*
