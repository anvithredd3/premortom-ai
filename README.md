# 🛡️ PreMortem AI

### Predicting Public Procurement Failures Before They Happen

> *"Don't analyze failures after they happen. Predict them before approval."*

PreMortem AI is a full-stack **Agentic AI** platform that predicts procurement
and project failures **before approval** by simulating a structured AI
PreMortem review. Multiple specialist agents analyse the contract,
infrastructure readiness, workforce readiness, financial exposure and
historical outcomes, debate their findings, and a Decision Board Agent issues a
**GO / GO WITH CONDITIONS / NO-GO** recommendation.

The flagship demo recreates the **AIIMS MRI procurement failure** — where ₹72 Cr
of equipment sat unused because infrastructure, installation planning, operators
and warranty timing were never aligned — and shows that AI could have flagged a
**NO-GO before public funds were committed**.

---

## Architecture

```
Streamlit UI  ──HTTP──►  FastAPI backend  ──►  Agent Orchestrator (parallel)
 (Python)                                         ├─ Contract Risk Agent
                                                  ├─ Infrastructure Readiness Agent
                                                  ├─ Workforce Readiness Agent
                                                  ├─ Financial Exposure Agent
                                                  ├─ Historical Intelligence Agent  ──► ChromaDB
                                                  ├─ Scenario Simulation Agent
                                                  └─ Decision Board Agent (consolidator)
```

| Layer       | Technology |
|-------------|------------|
| Frontend    | **Streamlit** (Python UI), Plotly |
| Backend     | **FastAPI** |
| Agents      | **OpenAI Agents SDK / GPT-5.5** (with deterministic offline fallback) |
| Workflow    | Parallel orchestration (LangGraph-compatible) |
| Vector DB   | **ChromaDB** + OpenAI embeddings |
| Documents   | **PyPDF**, python-docx |
| Reports     | **ReportLab** (PDF), python-docx (Word), JSON |
| Database    | **PostgreSQL** (via docker-compose) |
| Deployment  | **Docker + Docker Compose** |

> 💡 **No API key? No problem.** Every agent has a rule-based engine, so the
> full demo runs offline and deterministically. Add `OPENAI_API_KEY` to switch
> to LLM-authored agentic reasoning automatically.

---

## Screens

1. **Procurement Input** — enter data or upload a document (auto-fills fields).
2. **Agent Investigation Board** — live agent cards with status, risk score, evidence, reasoning.
3. **Agent Debate Room** — simulated multi-agent debate + consensus.
4. **Executive Dashboard** — risk gauge, heatmap, radar, agent contributions, scenario timeline.
5. **PreMortem Report** — executive report with PDF / Word / JSON export.
6. **★ Bonus Lab** — Digital Twin What-If simulator & failure-loss sensitivity curve.

---

## Quick Start

### Option A — Docker (recommended)

```bash
cd premortem-ai
cp .env.example .env          # optionally add OPENAI_API_KEY
docker compose up --build
```

- UI:      http://localhost:8501
- API docs: http://localhost:8000/docs
- Docker DB from host: `localhost:5433`
- Docker uses pgvector-enabled Postgres, indexes OKF memory on backend startup,
  and stores completed bid decision history in Postgres.
- Optional market research uses OpenAI Responses API `web_search` when
  `MARKET_RESEARCH_ENABLED=1` and `OPENAI_API_KEY` is configured.

In a second terminal, verify the Docker backend is healthy:

```bash
curl http://127.0.0.1:8000/health
```

Run the bid contract-review integration test against the Docker backend:

```bash
python backend/tests/test_contract_review.py --api http://127.0.0.1:8000 --bid-id BID-001
```

Run the Vendor Proposal Agent helper inside Docker:

```bash
docker compose build backend
docker compose up -d db backend
docker compose exec backend python tests/test_vendor_proposal_agent.py --pdf /files/input/samples/bids/BID-001/BID-001-Q01.pdf
```

Run the RFQ Intake and Negotiation UI Guidance Agent helper inside Docker:

```bash
docker compose build backend
docker compose up -d db backend
docker compose exec backend python tests/test_ui_guidance_agent.py --pdf /files/input/samples/bids/BID-001/BID-001-Q01.pdf
```

This helper prints the agent output and stores `ui_guidance_agent` rows in
`agent_history` / `agent_history_chunks`. It does not create a `RUN-XXX`
directory because it does not call the bid orchestrator or artifact store. Use
`--no-store` to print output only.

Run the RFQ Intake and Negotiation UI Guidance API test using a completed
Vendor Proposal Agent artifact:

```bash
docker compose exec backend python tests/test_ui_guidance_api.py --artifact /files/output/bid_runs/RUN-024/vendor_proposal_agent_quote_intelligence.json --api http://127.0.0.1:8000
```

Run the full bid-evaluation unittest inside Docker:

```bash
docker compose exec backend env RUN_BID_EVAL_TESTS=1 BID_ID=BID-001 MAX_QUOTES_PER_BID=1 python -m unittest tests.test_bid_evaluation
```

The full bid-evaluation unittest creates a new `files/output/bid_runs/RUN-XXX`
directory and writes run artifacts.

Inspect the newest vendor proposal artifact:

```bash
ls -td files/output/bid_runs/RUN-* | head -1
cat files/output/bid_runs/RUN-XXX/vendor_proposal_agent_quote_intelligence.json
```

Replace `RUN-XXX` with the newest run id. Rebuild the backend image after code
or test-helper changes because Docker copies `backend/app`, `backend/tests`, and
`backend/agent_profiles` at build time.

Check pgvector/Postgres tables inside Docker:

```bash
docker compose exec db psql -U premortem -d premortem -c "\dt"
docker compose exec db psql -U premortem -d premortem -c "SELECT count(*) FROM agent_memory_chunks;"
docker compose exec db psql -U premortem -d premortem -c "SELECT count(*) FROM decision_history;"
docker compose exec db psql -U premortem -d premortem -c "SELECT count(*) FROM decision_history_chunks;"
docker compose exec db psql -U premortem -d premortem -c "SELECT agent_id, COUNT(*) AS rows FROM agent_history GROUP BY agent_id ORDER BY agent_id;"
docker compose exec db psql -U premortem -d premortem -c "SELECT agent_id, COUNT(*) AS chunks FROM agent_history_chunks GROUP BY agent_id ORDER BY agent_id;"
```

From the host machine, connect to the Docker database on port `5433`:

```bash
psql "postgresql://premortem:premortem@127.0.0.1:5433/premortem"
```

Do not use host port `5432` for Docker checks unless you changed
`docker-compose.yml`; `5432` may be your local PostgreSQL.

Database URL choices:

```env
# Docker backend -> Docker db
DATABASE_URL=postgresql://premortem:premortem@db:5432/premortem

# Local backend -> Docker db exposed on host port 5433
DATABASE_URL=postgresql://premortem:premortem@127.0.0.1:5433/premortem

# Local backend -> local Postgres on host port 5432
DATABASE_URL=postgresql://premortem:premortem@127.0.0.1:5432/premortem
```

### Option B — Local (two terminals)

**Backend**
```bash
cd premortem-ai/backend
python -m venv .venv && . .venv/Scripts/activate   # Windows
# source .venv/bin/activate                         # macOS/Linux
pip install -r requirements.txt
python run_backend.py
```

For local pgvector-backed OKF memory, install PostgreSQL + pgvector once, then
run:

```bash
cd premortem-ai/backend
python setup_pgvector.py
```

Useful local PostgreSQL checks:

```bash
sudo systemctl status postgresql
pg_lsclusters
sudo ss -ltnp | grep 5432
psql "postgresql://premortem:premortem@localhost:5432/premortem" -c "\dt"
```

On Ubuntu, `postgresql.service` may show `active (exited)` while the actual
cluster is still online. Use `pg_lsclusters` to confirm the cluster status and
port.

Backend HTTP API:

- Base URL: http://localhost:8000
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

**Frontend**
```bash
cd premortem-ai/frontend
pip install -r requirements.txt
streamlit run app.py
```

The backend and frontend load `../.env` automatically for local runs. Values
already exported in your shell or provided by Docker still take precedence. For
local backend runs, keep OKF and pgvector settings centralized in the repository
root `.env`; `backend/run_backend.py` fills in local path defaults and starts
uvicorn.
`OKF_MEMORY_ROOT` enables the contract agent's durable memory bundle during
backend runs. `OKF_WRITE_MEMORY_INDEX=1` writes a plain-text metadata index to
`backend/agent_profiles/contract_agent_profile/contract_agent_memory_index.json`
on backend startup. `OKF_INDEX_PGVECTOR=1` also indexes the same chunks into the
shared `agent_memory_chunks` pgvector table when a pgvector-enabled Postgres is
available. `OKF_USE_PGVECTOR_RETRIEVAL=1` retrieves OKF prompt memory from that
table, with rule-based retrieval as a fallback. If these values are omitted, the
app still runs with the normal offline/LLM fallback behavior.

Open http://localhost:8501, click **Load AIIMS MRI demo**, then **Run PreMortem**.

---

## Demo: Expected Output (AIIMS MRI)

| Metric | Value |
|--------|-------|
| Overall Risk Score | ~88/100 |
| Failure Probability | ~91% |
| Predicted Failure Mode | Equipment delivered before site readiness |
| Recommended Decision | **NO-GO** |

**Conditions for approval:** facility readiness ≥95%, approvals completed,
technicians hired, warranty revised to commissioning date.

---

## API

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/health` | Service status + mode (agentic/offline) |
| GET  | `/sample` | AIIMS MRI demo input |
| POST | `/analyze` | Run full PreMortem, returns report JSON |
| POST | `/upload` | Parse uploaded PDF/DOCX/TXT |
| POST | `/ui-guidance/rfq-negotiation` | Generate RFQ intake / negotiation guidance from role, static inputs, feature weights, free text, and optional vendor proposal intelligence |
| POST | `/report/{pdf\|docx\|json}` | Export the report |

---

## References

- [OKF SPEC.md](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)

---

## Project Layout

```
premortem-ai/
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI endpoints
│   │   ├── models.py           # Pydantic schemas
│   │   ├── agents/             # 7 specialist agents + orchestrator
│   │   └── services/           # llm, historical_data, debate, document_parser, report
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app.py                  # Streamlit 6-screen UI
│   ├── charts.py               # Plotly visualizations
│   ├── api_client.py
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```
