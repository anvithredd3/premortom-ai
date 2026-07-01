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
