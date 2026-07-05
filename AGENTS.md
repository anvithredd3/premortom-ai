# AGENTS.md

## Project Overview

PreMortem AI is a hackathon-stage Python application for predicting public procurement failure risk before approval.

The app has two main parts:

- `backend/`: FastAPI backend with Pydantic models, specialist agents, LLM provider wrapper, document parsing, historical retrieval, debate generation, scenario simulation, and report export.
- `frontend/`: Streamlit UI with Plotly charts and a thin HTTP client for the backend.

The current backend uses custom orchestration, not LangGraph/CrewAI/AutoGen. Agent execution is coordinated in `backend/app/agents/orchestrator.py` using Python concurrency and direct calls to local agent modules.

## Development Priorities

Prefer small, demo-safe changes. This is a hackathon project, so prioritize:

1. A working local demo.
2. Clear provider configuration.
3. Predictable behavior when API keys are missing.
4. Minimal changes with low regression risk.
5. Clear explanations for teammates who are learning agentic AI.

Avoid broad refactors unless explicitly requested.

## Runtime And Providers

The app supports multiple runtime modes:

- OpenAI mode via `OPENAI_API_KEY`
- Anthropic mode via `ANTHROPIC_API_KEY`
- Offline fallback mode when no key is configured

Provider selection is handled in:

- `backend/app/services/llm.py`

Keep provider-specific logic centralized there. Do not scatter direct OpenAI or Anthropic SDK calls across agent files.

For final demo, prefer OpenAI configuration:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
OPENAI_EMBED_MODEL=text-embedding-3-small
```

For Claude teammate development:

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-haiku-4-5-20251001
```

Do not commit real API keys or secrets.

## Backend Structure

Important backend files:

- `backend/app/main.py`: FastAPI routes and app setup.
- `backend/app/models.py`: Pydantic schemas for input, agent results, debate turns, scenarios, and final reports.
- `backend/app/services/llm.py`: LLM provider selection and model calls.
- `backend/app/agents/orchestrator.py`: Multi-agent execution flow.
- `backend/app/agents/*_agent.py`: Specialist agent logic and prompts.
- `backend/app/services/historical_data.py`: Curated historical examples, optional ChromaDB/OpenAI embeddings, keyword fallback.
- `backend/app/services/document_parser.py`: PDF/DOCX/TXT extraction.
- `backend/app/services/report.py`: JSON/PDF/DOCX export.

When changing backend behavior, preserve the Pydantic response models used by the frontend unless the frontend is updated in the same change.

## Frontend Structure

Important frontend files:

- `frontend/app.py`: Streamlit UI screens and session state.
- `frontend/api_client.py`: HTTP calls to the backend.
- `frontend/charts.py`: Plotly chart generation.

Keep the frontend simple and demo-focused. Avoid introducing a new frontend framework unless explicitly requested.

## Agent Design Rules

Specialist agents should:

- Accept `ProcurementInput`.
- Return `AgentResult`.
- Use `run_agent_llm(...)` from `backend/app/services/llm.py`.
- Provide offline fallback behavior when practical.
- Keep prompt instructions specific to that agent's domain.
- Return structured JSON-compatible fields expected by downstream code.

The orchestrator should remain responsible for cross-agent sequencing and consolidation.

Current flow:

1. Contract Risk Agent
2. Infrastructure Readiness Agent
3. Workforce Readiness Agent
4. Historical Intelligence Agent (real tool use: `screen_vendor` against the debarment list)
5. Financial Exposure Agent, using infrastructure delay prediction
6. Decision Board consolidation
7. Debate generation
8. Scenario simulation
9. Evaluator Agent quality gate (deterministic; optional LLM summary)
10. Final `PreMortemReport` (includes `evaluation`)

## Environment Variables

Use these names consistently:

```env
LLM_PROVIDER=
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_EMBED_MODEL=
ANTHROPIC_API_KEY=
CLAUDE_MODEL=
DATABASE_URL=
PREMORTEM_API=
```

`DATABASE_URL` exists for Docker/Postgres but the current backend does not materially depend on a database. Do not introduce a hard database dependency without updating setup docs and Docker behavior.

## Local Run Commands

Docker:

```bash
cp .env.example .env
docker compose up --build
```

Backend only:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend only:

```bash
cd frontend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

Useful URLs:

- Frontend: `http://localhost:8501`
- Backend docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

## Verification

After backend changes, at minimum verify:

```bash
cd backend
python -m compileall app
```

If dependencies are installed, also run the app and check:

```bash
curl http://localhost:8000/health
```

After frontend changes, run:

```bash
cd frontend
streamlit run app.py
```

Then manually verify the main demo path:

1. Open `http://localhost:8501`.
2. Load the AIIMS MRI demo.
3. Run PreMortem.
4. Confirm agent results, dashboard, debate, and report screens still render.

## Coding Style

Use straightforward Python. Prefer readable functions over heavy abstractions.

Follow existing patterns:

- Pydantic models for API data contracts.
- FastAPI route functions in `main.py`.
- Small service modules under `backend/app/services`.
- Agent modules under `backend/app/agents`.
- Streamlit UI code in `frontend/app.py`.

Keep edits scoped. Do not reformat unrelated files.

## Dependency Guidance

Do not add new dependencies unless they are clearly necessary.

Current notable dependencies:

- FastAPI
- Uvicorn
- Pydantic
- Streamlit
- Plotly
- OpenAI SDK
- Anthropic SDK
- ChromaDB
- PyPDF
- python-docx
- ReportLab

Although `langgraph` and `openai-agents` are listed in `backend/requirements.txt`, the current app does not actively use them. Do not claim the app uses those frameworks unless the implementation is updated.

## Documentation Expectations

If changing setup, provider behavior, or demo flow, update relevant documentation:

- `README.md`
- `.env.example`
- Possibly `docs/architecture.md` if architecture changes

Keep docs accurate about what is actually implemented.

## Safety And Secrets

Never commit:

- `.env`
- API keys
- tokens
- credentials
- generated private data

Use `.env.example` for placeholders only.

Do not print API keys in logs or UI.

## Hackathon Demo Bias

For demo-critical changes, prefer reliability over architectural purity.

A good hackathon change is:

- Easy to explain.
- Easy to run locally.
- Robust when keys are missing.
- Clear in the UI.
- Small enough to debug during the demo.

Avoid changes that require complex cloud setup, migrations, queues, background workers, or external services unless explicitly requested.
