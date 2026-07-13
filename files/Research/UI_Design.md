# UI Design Review Notes

The current UI is strong for demonstrating a single procurement PreMortem. The following comments are not replacements for the existing design, but proposed extensions for batch quote comparison, management decision criteria, pipeline evaluation, and agent observability.

## Backend And UI Interface Changes

The frontend should treat FastAPI as the source of truth for bid inputs, uploaded quote PDFs, run state, and final outputs. Streamlit remains the UI server, while FastAPI owns the backend workflow.

```text
Browser
  -> Streamlit UI
    -> FastAPI backend
      -> bid input registry
      -> orchestrator
      -> agents
      -> output store
```

The detailed backend API and storage design is documented in `Backend_Design.md`. The UI should use those APIs through `frontend/api_client.py` instead of writing files directly.

### Initial Bid Workflow

The first UI implementation should add a bid-level workflow above the existing individual procurement analysis screens.

Recommended first navigation:

1. Bid Intake
2. Quote Uploads
3. Bid Analysis Monitor
4. Bid Results
5. Quote Detail
6. RFQ / Negotiation Guidance

The current individual quote/procurement analysis implementation remains useful. The new UI should add higher-level bid and quote-batch screens, then allow the user to drill down into an individual quote using the existing analysis style.

High-level flow:

```text
Create or select bid
  -> upload/list quote PDFs
  -> start bid evaluation
  -> poll run state every second
  -> display agent graph, connections, telemetry, and quote progress
  -> display winner and ranked quote results
  -> select quote for individual analysis detail
```

### Bid Creation Screen

The UI should add a bid creation and selection flow before quote analysis.

User actions:

- Enter procurement name.
- Enter equipment type.
- Create a bid/RFQ container.
- Select an existing bid.
- Optionally scan the generated sample input folder.

Frontend API call:

```text
POST /bids
GET /bids
POST /input/scan
```

Expected UI state after success:

- Store `bid_id` in `st.session_state`.
- Show the bid ID and storage status.
- Enable quote upload for that bid.

### Quote Upload Screen

The UI should support manual vendor quote PDF uploads and quote listing for a selected bid.

User actions:

- Select or create a bid.
- Enter vendor name.
- Upload one or more PDF quote files.
- Submit uploads to FastAPI.
- View all registered quotes for the bid.
- Select one quote for individual analysis detail.

Frontend API call:

```text
POST /bids/{bid_id}/quotes
GET /bids/{bid_id}/quotes
```

The Streamlit app should not save PDFs directly to the filesystem. FastAPI should save PDFs under:

```text
files/input/samples/bids/{bid_id}/{quote_id}.pdf
```

After each upload, the UI should refresh:

```text
GET /bids/{bid_id}/quotes
```

and show the registered quotes.

### Generated Input Scan

Because the synthetic input script can create quote PDFs directly under `files/input/samples/bids/`, the UI should provide a simple admin/demo action:

```text
Scan sample input folder
```

Frontend API call:

```text
POST /input/scan
```

The UI should show:

- Number of bids indexed.
- Number of quotes indexed.
- Number of new bids discovered.
- Number of new quotes discovered.

This keeps the manually uploaded data path and generated data path aligned through the same `bids_database.csv` registry.

### RFQ Intake / Negotiation Guidance Page

This page supports the RFQ Intake and Negotiation UI Guidance Agent. In the
current Streamlit app it is the first screen, `1 · RFQ Intake`, and acts as the
buyer-side value design workspace before vendor quote review.

Primary modes:

1. RFQ intake.
   Help management, doctors, biomedical engineers, finance, and procurement
   users define realistic requirements before vendor quotes are submitted.

2. Vendor negotiation.
   Use ranked recommendations, Vendor Proposal Agent intelligence, and user
   priorities to prepare negotiation questions and a draft vendor message.

Inputs:

- Active chat role, such as management, doctor, biomedical engineer, finance, or
  procurement officer.
- RFQ name and equipment/service type.
- Budget limit.
- Chat-entered requirements with perspective role, priority, value percentage,
  estimated cost, cost confidence, and source.
- Accepted requirements in a role-grouped editable table.
- Optional `bid_id` and `quote_id` so negotiation mode can load a Vendor
  Proposal Agent artifact.

Frontend API call:

```text
POST /rfq/publish
POST /ui-guidance/rfq-negotiation
```

The UI should display:

- Procurement Value Map: blue buyer-defined RFQ value polygon by role.
- Cost Meter: blue accepted requirement cost, gray budget, and selected quote
  cost when available.
- Role chat with compact avatars.
- Editable requirement table grouped by perspective role.
- Publish status and database-backed RFQ id after successful publish.
- After `2 · Vendor Procurement Input` completes a bid run, show the top two
  Bid Recommender options below the value map.
- Selecting one top option overlays a maroon quote-fit polygon on the value map
  and a maroon quote-cost marker on the cost meter.
- Provide a `Suggest Negotiation Change` action for the selected quote. It
  should draft a negotiation suggestion into chat without changing accepted RFQ
  requirements automatically.

The UI should not silently change saved RFQ values. It should let the user review
and accept recommendations before saving final criteria.

The top-two quote overlay is a demo visualization bridge. It helps users see how
vendor options compare against buyer-defined RFQ value, but it does not yet
replace the Bid Recommender's current risk-based ranking with dynamic RFQ-aware
scoring.

### Bid Run Screen

For a selected bid, the UI should allow the user to start a bid evaluation run.

User actions:

- Select a bid.
- Select all quotes or a subset of quotes.
- Click `Run Bid Evaluation`.

Frontend API call:

```text
POST /bid-runs
```

Expected response:

```json
{
  "run_id": "RUN-001",
  "bid_id": "BID-101",
  "status": "queued"
}
```

The UI should store `run_id` and begin polling run state.

### Bid Analysis Monitor

The Bid Analysis Monitor should provide the realtime-style view of the running bid evaluation. For the first implementation, the UI should use REST polling rather than WebSocket.

Frontend API calls:

```text
GET /bid-runs/{run_id}/state
GET /bid-runs/{run_id}/graph
GET /bid-runs/{run_id}/events?since=N
GET /bid-runs/{run_id}/artifacts
```

Polling interval:

```text
0.5-1 second for demo mode
```

The UI should render:

- Overall run status.
- Current step.
- Agent status cards.
- Agent workflow graph.
- Agent connection status.
- External connection status.
- Quote-by-quote progress.
- Runtime telemetry where available.
- Errors or failed quote reviews.

This gives a realtime-style experience without adding WebSocket complexity during the demo phase.

The UI should treat the run as a graph:

```json
{
  "run_id": "RUN-001",
  "nodes": [
    {
      "id": "bid_recommender",
      "type": "agent",
      "label": "Bid Recommender Agent",
      "status": "running"
    },
    {
      "id": "contract_review",
      "type": "agent",
      "label": "Contract Review Agent",
      "status": "completed"
    },
    {
      "id": "llm_provider",
      "type": "external_connection",
      "label": "LLM Provider",
      "status": "ok"
    }
  ],
  "edges": [
    {
      "source": "bid_recommender",
      "target": "contract_review",
      "type": "delegates_to",
      "status": "completed"
    },
    {
      "source": "contract_review",
      "target": "llm_provider",
      "type": "uses_external_service",
      "status": "completed"
    }
  ]
}
```

The UI should treat agent outputs as artifacts:

```json
{
  "run_id": "RUN-001",
  "artifacts": [
    {
      "artifact_id": "artifact_contract_review",
      "node_id": "contract_review",
      "artifact_type": "quote_reviews",
      "name": "Contract Review Results",
      "status": "ready"
    },
    {
      "artifact_id": "artifact_bid_recommendation",
      "node_id": "bid_recommender",
      "artifact_type": "decision_result",
      "name": "Bid Recommendation",
      "status": "ready"
    }
  ]
}
```

For the first version, the graph can be a fixed workflow with dynamic statuses. The orchestrator should update node, edge, event, and artifact status before and after each agent step.

### Final Decision View

When the run state becomes `completed`, the UI should fetch the final result.

Frontend API calls:

```text
GET /bid-runs/{run_id}/result
GET /bid-runs/{run_id}/artifacts
GET /bid-runs/{run_id}/artifacts/{artifact_id}
```

The final decision screen should show:

- Winning quote.
- Ranked quote list.
- Vendor feedback.
- Reasons for selecting the winner.
- Reasons for rejecting or downgrading other quotes.
- Links or references to graph artifacts.

The final decision should use `/result` for the business summary and `/artifacts` for detailed agent outputs. The UI should not read files from:

```text
files/output/bid_runs/{run_id}/
```

directly.

Recommended artifact use:

```text
artifact_bid_recommendation
  -> final ranking and recommender rationale

artifact_contract_review
  -> quote-by-quote contract review findings

artifact_telemetry
  -> model, token, latency, and cost details when implemented
```

### Quote Detail View

The Quote Detail view should preserve the useful parts of the existing individual procurement analysis UI.

User actions:

- Select a quote from the selected bid.
- Open individual quote analysis.
- Review the quote's extracted details, risks, findings, debate, and report-style output.

This screen can reuse the current single procurement analysis concepts:

- Contract risk.
- Infrastructure readiness.
- Workforce readiness.
- Historical intelligence.
- Financial exposure.
- Debate.
- Report/export.

The quote detail screen should be a drilldown from the bid result or quote list, not the only entry point into the workflow.

## Review Comments On The Existing App

The existing UI allows users to enter various parameters and also upload an input file. This is a good design for defining different combinations of inputs, and it helps explain what combinations the system supports and how complete the system is.

However, this also restricts entry through two main input methods. For large-scale experiments, the system may need to take input directly through the backend. The inputs are quotations, which may come from vendors and not necessarily through the UI. The system should not restrict the input style too much, so file input is likely the best approach.

From an organization point of view, the UI should provide guidance on what the expected inputs are. Users should not be restricted only by UI choices. One question is whether the UI specifies that the organization should use the input file as a vendor quote. If that is the intended flow, then this UI seems acceptable. But it still looks more complex than needed for a demo.

This is where an AI agent for UI guidance can help. It can take the company checklist or provide a template that management can use to specify what they need.

However, the management's product specification does not necessarily mean those are the full criteria for selection. The quote needs to meet the product requirements for the procurement to work, but management may also have its own criteria to compare multiple quotations. These criteria may or may not be explicitly declared to vendors. For example, long-term business benefits may matter, and the final decision should be based on those criteria as well.

The UI should focus more on those management decision criteria and allow weightage to be assigned to those parameters.

The criteria shown on Screen 1 can be treated as criteria published to vendors when the bid is floated. However, vendor quotes should not be assumed to follow those criteria exactly. Vendors may omit details that do not suit them, emphasize strengths they can provide, add extra services or terms, and include their company profile, certifications, references, and differentiators.

One missing area in the current Screen 1 input is international standards and compliance level details. For medical equipment procurement, the UI or input template should capture relevant compliance information such as certifications, safety standards, regulatory approvals, quality standards, documentation, and whether the quoted equipment meets local and international medical device requirements.

In real bidding processes, vendor quotes may usually arrive in a standard document format, often PDF, with a predictable structure and page range. The system should support this document-first flow and use extraction agents to interpret quote content even when vendors do not fill every expected field directly.

## Bid Criteria And Weightage

When floating a bid, the UI should allow management to define the decision criteria and weightage that will later be used to compare vendor quotes. This makes the decision process more transparent and helps separate product requirements from management priorities.

Recommended top five criteria for a small or medium hospital:

1. Clinical fit and specification match.
   The quote should meet the actual clinical need, expected patient volume, specialty use cases, required features, and medical workflow.

2. Total cost of ownership.
   The decision should consider not only purchase price, but also installation, AMC/CMC, consumables, spares, software licenses, upgrades, energy cost, and downtime cost.

3. Service and maintenance readiness.
   The hospital should evaluate local service availability, response time, spare parts access, uptime commitment, warranty support, and escalation process.

4. Infrastructure and workforce readiness.
   The hospital should check whether space, power, HVAC, approvals, IT/networking, trained operators, biomedical support, and clinical staff readiness are sufficient.

5. Strategic business value.
   The decision should include long-term business value such as expected revenue, patient demand, referral growth, competitive positioning, future specialty expansion, and hospital brand impact.

Vendor reliability and contractual risk should remain as a guardrail. It may not need to be one of the top weighted business criteria if service and maintenance readiness are already strong, but serious red flags in vendor reliability, delivery history, payment terms, warranty start date, or contract clauses should still downgrade or block a quote.

The UI should support:

- Default criteria templates for small hospitals, medium hospitals, and public procurement.
- Editable criteria names and descriptions.
- Weight assignment for each criterion.
- Required minimum score or hard disqualification rules.
- Separation between mandatory product specifications and weighted decision criteria.
- A preview showing how the criteria will be used to score and rank vendor quotes.

This would help the system compare multiple quotes using management's priorities instead of only analyzing failure risk for one quote.

## Investigation Board

The investigation board provides investigation reports from specialized agents. The report details are useful, but they are wordy for the demo. Technical details are needed, but the UI should make the decision criteria clearer.

Are we saying these are the five criteria used to take the decision?

- Contract Risk Agent: CRITICAL
  - Status: completed
  - Risk Score: 88/100
  - Findings, Evidence & Reasoning

- Workforce Readiness Agent: CRITICAL
  - Status: completed
  - Risk Score: 92/100
  - Findings, Evidence & Reasoning

- Historical Intelligence Agent: CRITICAL
  - Status: completed
  - Risk Score: 94/100
  - Findings, Evidence & Reasoning

- Infrastructure Readiness Agent: CRITICAL
  - Status: completed
  - Risk Score: 92/100
  - Findings, Evidence & Reasoning

- Financial Exposure Agent: CRITICAL
  - Status: completed
  - Risk Score: 92/100
  - Findings, Evidence & Reasoning

## Open Design Questions

- Should the demo UI focus more on uploading vendor quotation files rather than manually entering many parameters?
- Should the UI clearly separate product requirements from management decision criteria?
- Should management criteria have explicit weights?
- Should the investigation board summarize the five agent outputs as decision criteria?
- Should detailed reasoning be hidden behind expandable sections to make the demo easier to explain?

## Debate Room And Human-In-The-Loop Review

Page 3, the debate room, shows excellent and meaningful short information to support the decision. This is where the human-in-the-loop process becomes important.

The UI could allow the decision board or human reviewer to provide comments, objections, clarifications, or approval conditions. A UI guidance agent could interpret those comments and feed them back into the Decision Board Agent. The system could also support a manual override with an explanation, so the final decision is traceable.

One concern is that the current debate happens in silos. Each specialist agent debates from its own perspective, but the system may need broader external and comparative context before making a procurement decision.

From the previous discussion:

- Venkat suggested adding internet search to find more options and market context.
- Anvit asked whether the system compares a batch of quotes before taking a decision.

Both points are crucial for shortlisting or selecting a quote. The debate information should be stored and made available later for detailed analysis. However, a strong procurement decision likely needs multiple input quotes, not just one procurement input.

## Quote Comparison And Market Research

The system should support multiple input quotes for the same bidding process. This would allow the agents to compare vendors, prices, warranty terms, delivery timelines, compliance, operational readiness, and long-term business value.

The agent names and roles could also become more generic so they map better to business decision criteria. One possible addition is a Research Agent that compares the current quote with:

- Other vendor quotes in the same batch.
- Known market rates.
- Alternative products or suppliers.
- Publicly available vendor or product information.
- Historical procurement outcomes.

This would make the decision more useful for real business procurement, where the goal is often not only to detect risk, but also to rank or shortlist the best available options.

## Executive Dashboard

Page 4, the Executive Dashboard, is excellent for analyzing one quote or one procurement case. It shows the risk score, agent contribution, heatmap, radar chart, scenario timeline, and recommended decision clearly.

For the broader product design, the dashboard should support higher-level decision views across three levels:

1. Single quote view.
   This is the current demo view. It explains the risk and decision for one quote or one procurement proposal.

2. One bidding batch view.
   For a single bidding process with around 20 vendor quotes, the dashboard should compare all quotes against the same requirements, decision criteria, risk lenses, and management weights. This view should help shortlist the best quote, top 3 quotes, or top 5 quotes.

3. Portfolio evaluation view.
   For large-scale analysis across around 1,000 bidding processes, the dashboard should show how well the pipeline performs against ground truth and where agents, prompts, or criteria need improvement.

Useful dashboard additions:

- Quote comparison chart for all vendors in one bid.
- Ranked shortlist view showing top 1, top 3, and top 5 recommendations.
- Risk-versus-value chart for comparing vendor options.
- Criteria weight chart showing how management priorities affected the decision.
- Market-rate comparison graph if internet or market research is available.
- Pipeline execution graph showing the agent workflow and dependencies.
- Runtime performance metrics such as execution time, latency by agent, and failure rates.
- Token and cost metrics by agent, by model, and by complete pipeline run.
- Overall decision performance metrics such as top-1 accuracy, top-3 recall, top-5 recall, false acceptance, and false rejection.
- Agent observability charts showing agent contribution, disagreement, confidence, and impact on final decision.

This would turn the dashboard from a single-case demo screen into a decision intelligence and observability screen for the full procurement pipeline.

## PreMortem Report

Page 5, the PreMortem Report, is great for a single decision. It provides a clear executive summary, recommended decision, approval conditions, predicted outcomes, supporting evidence, and export options.

For the broader product design, the report can be expanded beyond one quote or one procurement case.

Possible report levels:

1. Single decision report.
   This is the current report. It explains why one quote or procurement proposal is GO, GO WITH CONDITIONS, or NO-GO.

2. Bidding batch report.
   For one bidding process with multiple quotes, the report should compare vendors, show ranked recommendations, explain why the top quotes were selected, and explain why other quotes were rejected or flagged.

3. Portfolio performance report.
   Across many bidding processes, the report should summarize pipeline performance, ground-truth match rate, agent-level performance, recurring failure patterns, cost and token usage, and areas where prompts or criteria need improvement.

This would make the report useful not only for one procurement decision, but also for management review, auditability, model improvement, and agent observability.

## Bonus Lab: What-If / Digital Twin

The Bonus Lab is great as part of the process. It provides a user-friendly way to try different options and understand how changing procurement levers affects the final risk and decision.

The current what-if flow works well for one procurement case. For higher-level analysis, it could be expanded in the same direction as the dashboard and report.

Possible expansion levels:

1. Single quote simulation.
   This is the current flow. Users can adjust parameters such as site readiness, approvals, staffing, payment terms, warranty timing, and delivery schedule to see how the risk changes.

2. Bidding batch simulation.
   For one bidding process with multiple quotes, the system could simulate how different management criteria, weights, approval conditions, or negotiation terms affect the vendor shortlist.

3. Portfolio simulation.
   Across many bidding processes, the system could estimate how policy changes affect overall procurement risk, approval speed, financial exposure, and decision quality.

Useful future what-if features:

- Compare how each vendor quote responds to changed conditions.
- Simulate negotiation improvements such as warranty start date, lower advance payment, better training, or delayed delivery until site readiness.
- Show which conditions would convert a NO-GO quote into GO WITH CONDITIONS.
- Estimate impact on top-1, top-3, or top-5 shortlist accuracy.
- Track which agents are most sensitive to each changed parameter.
- Use simulation outputs to improve criteria weights, prompts, and decision board rules.

This would make the Bonus Lab not only a demo-friendly feature, but also a strategic planning and optimization tool for procurement decisions.
