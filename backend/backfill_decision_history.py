"""Backfill completed bid-run artifacts into decision history tables."""
from __future__ import annotations

import sys
from pathlib import Path

from app.services import bid_outputs
from app.services.decision_history_pgvector import store_bid_run_history


def main() -> int:
    rows = bid_outputs.read_run_rows()
    completed = [row for row in rows if row.get("status") == "completed"]
    stored = 0
    skipped = 0

    for row in completed:
        run_id = row["run_id"]
        run_dir = bid_outputs.BID_RUNS_DIR / run_id
        try:
            state = bid_outputs.get_state(run_id)
            result = bid_outputs.get_result(run_id)
            if result.get("status") != "completed":
                skipped += 1
                print(f"Skipped {run_id}: result is not completed")
                continue
            store_bid_run_history(
                run_id=run_id,
                state=state,
                result=result,
                run_dir=Path(run_dir),
            )
            stored += 1
            print(f"Stored {run_id}")
        except Exception as exc:
            skipped += 1
            print(f"Skipped {run_id}: {exc}")

    print(f"Decision history backfill complete: stored={stored}, skipped={skipped}")
    return 0 if stored or not completed else 1


if __name__ == "__main__":
    sys.exit(main())
