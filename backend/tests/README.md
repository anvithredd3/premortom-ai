# Test Helpers

This folder contains local integration helpers that call the running FastAPI backend.

## Contract Review Bid Evaluation

`test_contract_review.py` starts a bid evaluation through the backend API without using the Streamlit UI.

Start the backend first from the repository root:

```bash
python -m uvicorn backend.app.main:app --reload --port 8000
```

Run the default bid:

```bash
python backend/tests/test_contract_review.py
```

By default, the helper evaluates only the first registered quote for token safety.

Run a specific bid:

```bash
python backend/tests/test_contract_review.py --bid-id BID-001
```

or:

```bash
python backend/tests/test_contract_review.py --bid-number 1
```

Run a specific quote only:

```bash
python backend/tests/test_contract_review.py --bid-id BID-001 --quote-id BID-001-Q01
```

Run up to two quotes:

```bash
python backend/tests/test_contract_review.py --bid-id BID-001 --max-quotes 2
```

Run every registered quote for the bid:

```bash
python backend/tests/test_contract_review.py --bid-id BID-001 --all-quotes
```

Use a different backend URL:

```bash
python backend/tests/test_contract_review.py --api http://localhost:8000 --bid-id BID-001
```

Skip rescanning the input folder:

```bash
python backend/tests/test_contract_review.py --bid-id BID-001 --skip-scan
```

## Vendor Proposal Agent

Run the Vendor Proposal Agent directly on the sample quote PDF:

```bash
python backend/tests/test_vendor_proposal_agent.py --pdf files/input/samples/bids/BID-001/BID-001-Q01.pdf
```

Run the same helper inside Docker:

```bash
docker compose build backend
docker compose up -d db backend
docker compose exec backend python tests/test_vendor_proposal_agent.py --pdf /files/input/samples/bids/BID-001/BID-001-Q01.pdf
```

## RFQ Intake and Negotiation UI Guidance Agent

Run the UI Guidance Agent directly on the sample quote PDF:

```bash
python backend/tests/test_ui_guidance_agent.py --pdf files/input/samples/bids/BID-001/BID-001-Q01.pdf
```

Run the same helper inside Docker:

```bash
docker compose build backend
docker compose up -d db backend
docker compose exec backend python tests/test_ui_guidance_agent.py --pdf /files/input/samples/bids/BID-001/BID-001-Q01.pdf
```

This helper prints the UI Guidance Agent output and stores `ui_guidance_agent`
rows in `agent_history` / `agent_history_chunks`. It does not create a `RUN-XXX`
directory because it does not call the bid orchestrator or artifact store. Use
`--no-store` to print output only.

Run the UI Guidance Agent through the backend API using a completed Vendor
Proposal Agent artifact:

```bash
python backend/tests/test_ui_guidance_api.py --run-id RUN-024 --api http://127.0.0.1:8000
```

Docker:

```bash
docker compose exec backend python tests/test_ui_guidance_api.py --artifact /files/output/bid_runs/RUN-024/vendor_proposal_agent_quote_intelligence.json --api http://127.0.0.1:8000
```

Run the capped bid-evaluation unittest inside Docker:

```bash
docker compose exec backend env RUN_BID_EVAL_TESTS=1 BID_ID=BID-001 MAX_QUOTES_PER_BID=1 python -m unittest tests.test_bid_evaluation
```

The capped bid-evaluation unittest creates a new `files/output/bid_runs/RUN-XXX`
directory and writes run artifacts.

## API Flow

The script calls:

```text
GET  /health
POST /input/scan
GET  /bids/{bid_id}/quotes
POST /bid-runs
GET  /bid-runs/{run_id}/state
GET  /bid-runs/{run_id}/result
```

`POST /input/scan` registers PDFs already present under:

```text
files/input/samples/bids/
```

Run outputs are written under:

```text
files/output/bid_runs/
```

## Notes

- The script expects FastAPI to already be running.
- If no `--bid-id` or `--bid-number` is provided, it uses `BID-001`.
- If no `--quote-id` is provided, it evaluates only the first registered quote by default.
- Use `--max-quotes` or `--all-quotes` only for intentional larger runs.
- Use the separate backend unittest for capped batch evaluation across registered bids.
