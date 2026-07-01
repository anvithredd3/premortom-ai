# Backend Design

This document defines the backend API, storage layout, and service boundaries for the bid and quote workflow. The agentic architecture and agent responsibilities are described separately in `High_level_Agent_architecture_v3.md`.

## Goals

The backend should support a demo-safe workflow where the UI can:

1. Create a bid or request-for-quote container.
2. Upload vendor quote PDFs.
3. Scan generated quote folders created by the synthetic data script.
4. Start a bid evaluation run.
5. Poll run status for realtime-style UI updates.
6. Fetch the final recommendation, analysis outputs, telemetry, and report artifacts.

The first implementation should avoid a database and use CSV/JSON files for demo persistence.

## Process Boundaries

The application has two server processes:

```text
Browser
  -> Streamlit UI server
    -> FastAPI backend server
      -> input registry services
      -> orchestrator
      -> agents
      -> output store
```

Roles:

- Browser is the client of Streamlit.
- Streamlit is the client of FastAPI.
- FastAPI is the backend server and source of truth for bid inputs, run state, and outputs.
- FastAPI is also the client of LLM providers through the centralized LLM service.

The UI should not call agents directly. It should call FastAPI endpoints.

## Storage Layout

Inputs and outputs must remain separate.

### Input Storage

Inputs are stored under:

```text
files/input/samples/
```

Structure:

```text
files/input/samples/
  bids_database.csv
  metadata.json
  manifest.csv
  coverage.csv
  bids/
    BID-001/
      BID-001-Q01.pdf
      BID-001-Q02.pdf
    BID-002/
      BID-002-Q01.pdf
```

Purpose:

- Store uploaded and generated vendor quote PDFs.
- Track bid and quote metadata.
- Keep generated experiment metadata, manifest, coverage, and ground truth files.

PDFs should not be stored in CSV or in a database. The CSV stores metadata only.

### Output Storage

Agent outputs and decisions are stored under:

```text
files/output/
```

Recommended structure:

```text
files/output/
  bid_runs/
    runs_database.csv
    RUN-001/
      run_state.json
      events.jsonl
      contract_review_agent_quote_reviews.json
      bid_recommender_agent_decision_result.json
      telemetry.json
      report.json
      report.pdf
```

Outputs belong to a run, not only to a bid, because the same bid can be evaluated multiple times with different prompts, models, quote subsets, or agent logic.

## CSV Registries

### bids_database.csv

Path:

```text
files/input/samples/bids_database.csv
```

Purpose:

- Operational registry for bid and quote inputs.
- Includes both manually uploaded quotes and scanned generated quote PDFs.
- Used by FastAPI endpoints to list bids and quotes without requiring a database.

Suggested columns:

```text
bid_id
quote_id
vendor_name
equipment_type
procurement_name
source
status
pdf_path
original_filename
created_at
updated_at
```

Example rows:

```csv
bid_id,quote_id,vendor_name,equipment_type,procurement_name,source,status,pdf_path,original_filename,created_at,updated_at
BID-101,,,,MRI Machine,MRI Procurement,upload,created,,,,2026-06-27T10:00:00Z,2026-06-27T10:00:00Z
BID-101,BID-101-Q01,MedNova Healthcare,MRI Machine,MRI Procurement,upload,uploaded,bids/BID-101/BID-101-Q01.pdf,quote.pdf,2026-06-27T10:01:00Z,2026-06-27T10:01:00Z
```

`source` values:

- `upload`: created through the FastAPI upload endpoint.
- `scan`: discovered by scanning `files/input/samples/bids/`.
- `generated`: optionally used later for rows imported directly from generated metadata.

`status` values:

- `created`
- `uploaded`
- `discovered`
- `ready`
- `error`

### runs_database.csv

Path:

```text
files/output/bid_runs/runs_database.csv
```

Purpose:

- Operational registry for evaluation runs.
- Allows the UI to list previous runs and compare outputs.

Suggested columns:

```text
run_id
bid_id
status
quote_count
winner_quote_id
decision_result_path
started_at
completed_at
created_by
llm_provider
model
```

`status` values:

- `queued`
- `running`
- `completed`
- `failed`
- `cancelled`

## Backend Services

### Input Bid Registry Service

Suggested module:

```text
backend/app/services/input_bids.py
```

Responsibilities:

- Create bid IDs.
- Create bid folders.
- Save uploaded quote PDFs.
- Assign quote IDs.
- Maintain `bids_database.csv`.
- Scan `files/input/samples/bids/` for generated quote PDFs.
- List bids and quotes for API endpoints.

This is deterministic bookkeeping and should not be implemented as an AI agent.

### Bid Output Store Service

Suggested module:

```text
backend/app/services/bid_outputs.py
```

Responsibilities:

- Create run IDs.
- Create run output folders.
- Maintain `runs_database.csv`.
- Write `run_state.json`.
- Append `events.jsonl`.
- Write `contract_review_agent_quote_reviews.json`.
- Write `bid_recommender_agent_decision_result.json`.
- Write `telemetry.json`.
- Write final report artifacts.

This service provides durable output files that can be used for evaluation.

## Input APIs

### Create Bid

```text
POST /bids
```

Request:

```json
{
  "procurement_name": "MRI Procurement",
  "equipment_type": "MRI Machine"
}
```

Response:

```json
{
  "bid_id": "BID-101",
  "status": "created",
  "storage_path": "files/input/samples/bids/BID-101"
}
```

Behavior:

- Creates `files/input/samples/bids/{bid_id}/`.
- Adds a bid-level row to `bids_database.csv`.

### List Bids

```text
GET /bids
```

Response:

```json
{
  "bids": [
    {
      "bid_id": "BID-101",
      "procurement_name": "MRI Procurement",
      "equipment_type": "MRI Machine",
      "quote_count": 2,
      "status": "created"
    }
  ]
}
```

### Upload Quote PDF

```text
POST /bids/{bid_id}/quotes
```

Multipart fields:

```text
file = vendor_quote.pdf
vendor_name = MedNova Healthcare
```

Response:

```json
{
  "bid_id": "BID-101",
  "quote_id": "BID-101-Q01",
  "vendor_name": "MedNova Healthcare",
  "pdf_path": "bids/BID-101/BID-101-Q01.pdf",
  "status": "uploaded"
}
```

Behavior:

- Saves the PDF to `files/input/samples/bids/{bid_id}/{quote_id}.pdf`.
- Adds a quote-level row to `bids_database.csv`.
- Does not update `coverage.csv` immediately.

### List Quotes For Bid

```text
GET /bids/{bid_id}/quotes
```

Response:

```json
{
  "bid_id": "BID-101",
  "quotes": [
    {
      "quote_id": "BID-101-Q01",
      "vendor_name": "MedNova Healthcare",
      "pdf_path": "bids/BID-101/BID-101-Q01.pdf",
      "status": "uploaded"
    }
  ]
}
```

### Scan Input Folder

```text
POST /input/scan
```

Behavior:

- Scans `files/input/samples/bids/`.
- Finds `BID-*` folders.
- Finds `BID-*-Q*.pdf` files.
- Adds missing rows to `bids_database.csv`.

Response:

```json
{
  "bids_indexed": 100,
  "quotes_indexed": 2000,
  "new_bids": 0,
  "new_quotes": 20
}
```

## Evaluation APIs

### Start Bid Run

```text
POST /bid-runs
```

Request:

```json
{
  "bid_id": "BID-101",
  "quote_ids": ["BID-101-Q01", "BID-101-Q02"]
}
```

Response:

```json
{
  "run_id": "RUN-001",
  "bid_id": "BID-101",
  "status": "queued",
  "output_path": "files/output/bid_runs/RUN-001"
}
```

Behavior:

- Creates a run folder.
- Adds a row to `runs_database.csv`.
- Starts orchestrator execution in the background.
- Returns quickly so the UI can begin polling.

### Get Run State

```text
GET /bid-runs/{run_id}/state
```

Response:

```json
{
  "run_id": "RUN-001",
  "bid_id": "BID-101",
  "status": "running",
  "current_step": "contract_review",
  "quotes": [
    {
      "quote_id": "BID-101-Q01",
      "vendor_name": "MedNova Healthcare",
      "status": "completed",
      "risk_score": 68
    },
    {
      "quote_id": "BID-101-Q02",
      "vendor_name": "BudgetMed Systems",
      "status": "running",
      "risk_score": null
    }
  ],
  "agents": {
    "bid_recommender": {
      "status": "running",
      "message": "Comparing submitted quotes"
    },
    "contract_review": {
      "status": "running",
      "message": "Reviewing BID-101-Q02"
    }
  }
}
```

Behavior:

- Reads current run state from memory or `run_state.json`.
- Does not block on agent execution.

### Get Run Events

```text
GET /bid-runs/{run_id}/events?since=0
```

Response:

```json
{
  "run_id": "RUN-001",
  "events": [
    {
      "id": 1,
      "timestamp": "2026-06-27T10:00:00Z",
      "type": "run_started",
      "run_id": "RUN-001",
      "bid_id": "BID-101"
    }
  ],
  "next_since": 1
}
```

Events are read from:

```text
files/output/bid_runs/{run_id}/events.jsonl
```

This endpoint can power incremental polling and can later be reused for SSE or WebSocket.

### Get Run Graph

```text
GET /bid-runs/{run_id}/graph
```

Purpose:

- Return the execution graph for the run.
- Let the UI render agents, decision steps, external systems, and connections without hardcoded screen logic.
- Keep the UI compatible with future graph-based execution engines.

Response:

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
      "id": "decision_logic",
      "type": "decision_step",
      "label": "Decision Logic",
      "status": "waiting"
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
      "target": "bid_recommender",
      "type": "returns_result_to",
      "status": "completed"
    },
    {
      "source": "contract_review",
      "target": "llm_provider",
      "type": "uses_external_service",
      "status": "completed"
    },
    {
      "source": "bid_recommender",
      "target": "decision_logic",
      "type": "passes_results_to",
      "status": "waiting"
    }
  ]
}
```

Node types:

- `agent`
- `decision_step`
- `tool`
- `external_connection`
- `data_store`
- `human_review`

Edge types:

- `delegates_to`
- `returns_result_to`
- `depends_on`
- `passes_results_to`
- `uses_tool`
- `uses_external_service`
- `reads_from`
- `writes_to`

For the first implementation, the backend can return a fixed graph with dynamic statuses. Later, if the execution engine becomes graph-native, this endpoint can return the actual runtime graph.

### List Run Artifacts

```text
GET /bid-runs/{run_id}/artifacts
```

Purpose:

- Return metadata for all outputs produced by graph nodes.
- Allow the UI to discover outputs by `node_id` and `artifact_type` instead of hardcoded filenames.
- Support adding new agents without changing the UI API contract.

Response:

```json
{
  "run_id": "RUN-001",
  "artifacts": [
    {
      "artifact_id": "artifact_contract_review",
      "node_id": "contract_review",
      "artifact_type": "quote_reviews",
      "name": "Contract Review Results",
      "status": "ready",
      "media_type": "application/json",
      "path": "files/output/bid_runs/RUN-001/contract_review_agent_quote_reviews.json",
      "created_at": "2026-06-27T10:02:00Z"
    },
    {
      "artifact_id": "artifact_bid_recommendation",
      "node_id": "bid_recommender",
      "artifact_type": "decision_result",
      "name": "Bid Recommendation",
      "status": "ready",
      "media_type": "application/json",
      "path": "files/output/bid_runs/RUN-001/bid_recommender_agent_decision_result.json",
      "created_at": "2026-06-27T10:05:00Z"
    }
  ]
}
```

Recommended first artifact IDs:

```text
artifact_vendor_proposal
artifact_contract_review
artifact_bid_recommendation
artifact_run_state
artifact_events
artifact_telemetry
artifact_report
```

## Vendor Proposal Artifact Schema

The Vendor / Proposal Understanding and External Risk Agent should produce a reusable proposal artifact for each quote. This artifact is the shared input for Contract Review, Cost Benchmark, Compliance, Vendor Risk, Bid Recommendation, and Evaluator agents.

Recommended artifact:

```text
artifact_vendor_proposal
```

Recommended file name:

```text
vendor_proposal_agent_quote_intelligence.json
```

The output should put fixed comparable fields first. All later sections are optional and can be added incrementally without breaking existing consumers.

```text
fixed_features
proposal_text
proposal_intelligence
raw_text_reference
```

### fixed_features

`fixed_features` contains comparable fields used for fair quote comparison. These fields should be stable and should not be freely selected by the LLM.

Each fixed feature should include:

```json
{
  "value": null,
  "status": "found | missing | unclear | conflicting | inferred | not_applicable",
  "confidence": 0.0,
  "evidence": ""
}
```

Recommended first fixed fields:

```text
vendor_name
company_legal_name
registered_address
contact_person
contact_email
contact_phone
years_in_operation
similar_hospital_references
equipment_type
offered_solution_summary
contract_value_cr
currency
advance_payment_pct
delivery_timeline_months
warranty_start
warranty_duration_months
installation_responsibility
training_included
service_response_hours
local_service_team
spare_parts_commitment
uptime_commitment
compliance_claims
certifications
regulatory_approvals
implementation_plan
acceptance_testing_terms
penalty_or_liquidated_damages
exclusions_or_assumptions
payment_milestones
```

These include the important fields previously represented in `ProcurementInput` and the synthetic quote metadata, while adding proposal-specific fields needed for real vendor quote review.

### proposal_text

`proposal_text` contains the extracted source text from the vendor PDF. It should be treated as source material, not as interpreted intelligence.

Recommended fields:

```text
raw_text
text_preview
char_count
source_pdf_path
```

This section is optional for long documents. For small demo PDFs, storing `raw_text` inline is acceptable. For production-scale documents, store raw text once and use `raw_text_reference` plus evidence snippets.

### proposal_intelligence

`proposal_intelligence` contains agent-interpreted signals. These should be evidence-backed, but they are not the same as objective fixed features.

Recommended first fields:

```text
vendor_emphasis
missing_information
extra_information
unusual_terms
evidence_quality
marketing_vs_specificity
implementation_specificity
positive_differentiators
risk_flags
vendor_maturity_signal
follow_up_questions
```

This section captures information that humans naturally use when judging proposals:

- what the vendor emphasizes
- what the vendor avoids saying
- whether implementation details are specific
- whether claims are evidence-backed
- whether the proposal is mostly marketing
- whether unusual conditions exist
- whether differentiators are relevant
- whether the vendor seems mature or vague
- what must be clarified before award

### raw_text_reference

`raw_text_reference` preserves traceability without forcing every downstream artifact to duplicate the full PDF text.

Recommended fields:

```text
pdf_path
raw_text_path
full_text_available
text_excerpt_refs
source_page_refs
```

Longer term, store raw extracted text once and pass references plus evidence snippets to downstream agents.

### Get Run Artifact

```text
GET /bid-runs/{run_id}/artifacts/{artifact_id}
```

Purpose:

- Return the content of one artifact.
- Keep Streamlit from reading files directly.
- Allow the backend to move from local files to object storage later.

Example:

```text
GET /bid-runs/RUN-001/artifacts/artifact_contract_review
```

Response:

```json
{
  "run_id": "RUN-001",
  "artifact_id": "artifact_contract_review",
  "node_id": "contract_review",
  "artifact_type": "quote_reviews",
  "content": {
    "quote_reviews": []
  }
}
```

### Get Final Result

```text
GET /bid-runs/{run_id}/result
```

Response:

```json
{
  "run_id": "RUN-001",
  "bid_id": "BID-101",
  "status": "completed",
  "winner": {
    "quote_id": "BID-101-Q01",
    "vendor_name": "MedNova Healthcare",
    "score": 84.2
  },
  "ranked_quotes": [],
  "feedback": [],
  "artifact_refs": [
    "artifact_bid_recommendation",
    "artifact_contract_review"
  ]
}
```

`/result` is a business-friendly shortcut. It should contain only the final decision package needed by the dashboard and report screens. Detailed agent outputs should be accessed through `/artifacts`.

### List Runs For Bid

```text
GET /bids/{bid_id}/runs
```

Response:

```json
{
  "bid_id": "BID-101",
  "runs": [
    {
      "run_id": "RUN-001",
      "status": "completed",
      "winner_quote_id": "BID-101-Q01",
      "completed_at": "2026-06-27T10:05:00Z"
    }
  ]
}
```

## Graph-Based Result Access For UI Screens

The UI should not read output files directly from the filesystem. Streamlit should access run state, graph structure, artifacts, events, and final results through FastAPI.

Core result access endpoints:

```text
GET /bid-runs/{run_id}/state
GET /bid-runs/{run_id}/graph
GET /bid-runs/{run_id}/events?since=N
GET /bid-runs/{run_id}/artifacts
GET /bid-runs/{run_id}/artifacts/{artifact_id}
GET /bid-runs/{run_id}/result
```

Recommended division of responsibility:

```text
/state
  Lightweight status snapshot.

/graph
  Execution nodes and edges for visualization.

/events
  Timeline and realtime-style updates.

/artifacts
  Discoverable list of outputs produced by graph nodes.

/artifacts/{artifact_id}
  Detailed content for one node output.

/result
  Final business recommendation shortcut.
```

This makes the API compatible with graph-based execution without requiring a graph engine immediately. The current orchestrator can write a simple fixed graph with dynamic statuses; a future graph runtime can populate the same API shape.

### Screen 1: Procurement Input

Purpose:

- Create or select a bid.
- Upload or scan quote PDFs.
- Start a bid evaluation run.

Backend access:

```text
POST /bids
GET  /bids
POST /bids/{bid_id}/quotes
GET  /bids/{bid_id}/quotes
POST /input/scan
POST /bid-runs
```

Graph/artifact access:

```text
None required before a run starts.
```

This screen should use input registry APIs and then store `bid_id` and `run_id` in Streamlit session state.

### Screen 2: Agent Investigation Board

Purpose:

- Show per-agent findings.
- Show quote-by-quote contract review results.
- Show agent status and evidence.

Backend access:

```text
GET /bid-runs/{run_id}/state
GET /bid-runs/{run_id}/graph
GET /bid-runs/{run_id}/artifacts
GET /bid-runs/{run_id}/artifacts/artifact_contract_review
```

Primary node:

```text
contract_review
```

Recommended UI mapping:

- Agent cards should be generated from `/graph.nodes`.
- Agent connections should be generated from `/graph.edges`.
- Contract Review Agent details should read from `artifact_contract_review`.
- Each quote review should show `quote_id`, `vendor_name`, `risk_score`, `risk_level`, findings, and recommendation.
- Agent status cards should read status from `/state` and `/graph`.

### Screen 3: Agent Debate Room

Purpose:

- Show discussion, disagreements, and reasoning between agents.

Backend access:

```text
GET /bid-runs/{run_id}/graph
GET /bid-runs/{run_id}/artifacts
GET /bid-runs/{run_id}/result
GET /bid-runs/{run_id}/events?since=N
```

Current primary node:

```text
bid_recommender
```

Future output artifacts:

```text
artifact_agent_debate
artifact_decision_board_consensus
```

Recommended UI mapping:

- For the first bid workflow, show recommender feedback and ranking rationale from `artifact_bid_recommendation`.
- When a dedicated debate/decision-board step is added, expose those outputs as artifacts linked to their graph nodes.

### Screen 4: Executive Dashboard

Purpose:

- Show the bid-level winner, ranked quotes, risk distribution, status, and telemetry.

Backend access:

```text
GET /bid-runs/{run_id}/state
GET /bid-runs/{run_id}/graph
GET /bid-runs/{run_id}/artifacts
GET /bid-runs/{run_id}/result
```

Primary nodes:

```text
bid_recommender
contract_review
decision_logic
```

Supporting artifacts:

```text
artifact_bid_recommendation
artifact_contract_review
artifact_telemetry
```

Recommended UI mapping:

- Winner and ranked quote table should read from `/result`.
- Quote risk charts should read from `artifact_contract_review` or `/result.ranked_quotes`.
- Agent workflow graph should read from `/graph`.
- Agent runtime and connection status should read from `/state` and `/events`.
- Token, model, latency, and cost metrics should read from `artifact_telemetry` when implemented.

### Screen 5: PreMortem Report

Purpose:

- Show the final human-readable decision package.
- Support JSON/PDF/DOCX exports.

Backend access:

```text
GET  /bid-runs/{run_id}/result
GET  /bid-runs/{run_id}/artifacts
POST /report/{fmt}
```

Current primary artifact:

```text
artifact_bid_recommendation
```

Future report artifacts:

```text
report.json
report.pdf
report.docx
```

Recommended UI mapping:

- For the first bid workflow, build the report screen from the final result endpoint.
- When bid-level report generation is implemented, expose `artifact_report` and export formats through the backend.

### Bonus Lab: What-If / Digital Twin

Purpose:

- Re-run or simulate changed procurement conditions.
- Compare original result with modified assumptions.

Backend access:

```text
POST /bid-runs
GET  /bid-runs/{run_id}/state
GET  /bid-runs/{run_id}/graph
GET  /bid-runs/{run_id}/artifacts
GET  /bid-runs/{run_id}/result
GET  /bids/{bid_id}/runs
```

Primary artifacts:

```text
artifact_bid_recommendation
artifact_contract_review
```

Recommended UI mapping:

- Create a new run for each what-if scenario instead of overwriting the original run.
- Compare two `run_id` values side by side.
- Use `GET /bids/{bid_id}/runs` to list previous runs for the same bid.
- Later, add a scenario simulation node and expose its output as `artifact_scenario_simulation`.

## UI Polling Model

For the first implementation, use REST polling instead of WebSocket.

Flow:

```text
1. Streamlit sends POST /bid-runs.
2. FastAPI returns run_id immediately.
3. Streamlit polls GET /bid-runs/{run_id}/state every 0.5-1 second.
4. FastAPI returns current run state.
5. Streamlit redraws graph, status, telemetry, and quote progress.
6. When status is completed, Streamlit calls GET /bid-runs/{run_id}/result.
```

REST polling is preferred for the demo because Streamlit is naturally request/rerun oriented and agent events are low frequency. The event model should still be designed so SSE or WebSocket can be added later.

## Event-Driven Updates Later

The current design should remain modular enough to switch from polling to event-driven updates later.

The important design rule is:

```text
Orchestrator writes state/events once.
API delivery method can change independently.
```

Internal backend flow:

```text
orchestrator
  -> updates run_state.json
  -> appends events.jsonl
  -> updates in-memory RunState if available
```

Current delivery:

```text
Streamlit polls GET /bid-runs/{run_id}/state
Streamlit optionally polls GET /bid-runs/{run_id}/events?since=N
```

Future delivery:

```text
SSE endpoint streams the same events from events.jsonl or in-memory event queue.
WebSocket endpoint streams the same events and optionally receives live commands.
```

Recommended later endpoint for one-way event delivery:

```text
GET /bid-runs/{run_id}/events/stream
```

Use SSE first if the UI only needs server-to-client updates such as:

- agent started
- agent completed
- quote review completed
- decision completed
- telemetry updated
- run failed
- run completed

Use WebSocket only if the UI later needs two-way live interaction during a run, such as:

- pause
- cancel
- resume
- approve a step
- add human feedback
- ask an agent a follow-up question

TODO:

- Add an SSE endpoint backed by the existing run event log.
- Add reconnect support using the last event ID.
- Keep `GET /state` as the reliable snapshot endpoint even after SSE is added.
- Add WebSocket only if human-in-the-loop commands become part of the demo.

## Coverage CSV

`coverage.csv` remains experiment coverage for generated/evaluation data.

For the demo:

- Uploading a quote updates `bids_database.csv`.
- Scanning generated folders updates `bids_database.csv`.
- `coverage.csv` does not need to update on every upload.

Later, add:

```text
POST /input/coverage/rebuild
```

to rebuild coverage from `metadata.json` plus registered quote inputs.

## Implementation Order

1. Create `backend/app/services/input_bids.py`.
2. Create `backend/app/services/bid_outputs.py`.
3. Add FastAPI input endpoints:
   - `POST /bids`
   - `GET /bids`
   - `POST /bids/{bid_id}/quotes`
   - `GET /bids/{bid_id}/quotes`
   - `POST /input/scan`
4. Add run output endpoints:
   - `POST /bid-runs`
   - `GET /bid-runs/{run_id}/state`
   - `GET /bid-runs/{run_id}/events`
   - `GET /bid-runs/{run_id}/result`
   - `GET /bids/{bid_id}/runs`
5. Update `frontend/api_client.py`.
6. Add Streamlit bid creation and quote upload screens.
7. Wire orchestrator and agents after input/output plumbing works.
