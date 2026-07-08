# DB Process Notes

This project currently uses local PostgreSQL with pgvector for OKF agent memory
and bid decision history.

Current implemented pgvector table:

- `agent_memory_chunks`: stores OKF/agent memory chunks for retrieval.

Decision history tables:

- `decision_history`
- `decision_history_chunks`

## Default Local Database

The local setup script creates this database connection:

```bash
postgresql://premortem:premortem@localhost:5432/premortem
```

## Open The Database

From any terminal:

```bash
psql "postgresql://premortem:premortem@localhost:5432/premortem"
```

Inside `psql`, list tables:

```sql
\dt
```

Quit `psql`:

```sql
\q
```

## Check If The Memory Table Exists

Inside `psql`:

```sql
\d agent_memory_chunks
```

Or as a one-line shell command:

```bash
psql "postgresql://premortem:premortem@localhost:5432/premortem" -c "\d agent_memory_chunks"
```

## Check If Memory Entries Are Present

Count rows:

```sql
SELECT count(*) FROM agent_memory_chunks;
```

Show recent entries:

```sql
SELECT agent_id, source_path, memory_type, updated_at
FROM agent_memory_chunks
ORDER BY updated_at DESC
LIMIT 20;
```

One-line shell version:

```bash
psql "postgresql://premortem:premortem@localhost:5432/premortem" -c "SELECT agent_id, source_path, memory_type, updated_at FROM agent_memory_chunks ORDER BY updated_at DESC LIMIT 20;"
```

## Check For History Tables

Decision history is not expected to exist yet, but this command checks for any history-like table names:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename ILIKE '%history%';
```

One-line shell version:

```bash
psql "postgresql://premortem:premortem@localhost:5432/premortem" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename ILIKE '%history%';"
```

## Planned Decision History Tables

Decision history storage is separate from OKF memory:

- `decision_history`: one structured audit snapshot per completed run.
- `decision_history_chunks`: compact pgvector-searchable summaries for similar-case retrieval.

Check whether these tables exist:

```sql
SELECT
  to_regclass('public.decision_history') AS decision_history,
  to_regclass('public.decision_history_chunks') AS decision_history_chunks;
```

One-line shell version:

```bash
psql "postgresql://premortem:premortem@localhost:5432/premortem" -c "SELECT to_regclass('public.decision_history') AS decision_history, to_regclass('public.decision_history_chunks') AS decision_history_chunks;"
```

Count decision history rows after storage is implemented:

```sql
SELECT count(*) FROM decision_history;
SELECT count(*) FROM decision_history_chunks;
```

One-line shell version:

```bash
psql "postgresql://premortem:premortem@localhost:5432/premortem" -c "SELECT count(*) AS decision_history_rows FROM decision_history;"
psql "postgresql://premortem:premortem@localhost:5432/premortem" -c "SELECT count(*) AS decision_history_chunk_rows FROM decision_history_chunks;"
```

Show recent decision snapshots after storage is implemented:

```sql
SELECT run_id, procurement_title, risk_level, risk_score, created_at
FROM decision_history
ORDER BY created_at DESC
LIMIT 20;
```

Show recent decision-history vector chunks after storage is implemented:

```sql
SELECT decision_id, chunk_type, left(content, 120) AS preview, created_at
FROM decision_history_chunks
ORDER BY created_at DESC
LIMIT 20;
```

## Backend Database Status API

The backend exposes a read-only status endpoint:

```bash
curl http://localhost:8000/db/status
```

It reports:

- whether `DATABASE_URL` is configured
- whether Postgres is reachable
- whether pgvector is installed
- whether `agent_memory_chunks`, `decision_history`, and `decision_history_chunks` exist
- row counts for those tables
- recent memory rows
- recent decision-history rows, once implemented

## Frontend Database Page

The Streamlit app includes:

```text
Screen 6 · Database / Memory
```

Use this page to confirm:

- local database connection status
- pgvector availability
- OKF memory row count
- decision history table status
- recent memory rows

If these tables are missing, run a completed bid evaluation with the updated
backend or use the backfill command below.

## Store Or Backfill Decision History

Completed bid runs now attempt to write decision history during backend run completion when `DATABASE_URL` is configured.

To backfill existing completed runs from `files/output/bid_runs/RUN-*`:

```bash
cd /home/chinmaey/Documents/Backup/AI/AgenticAI/Hackathon/premortom-ai/backend
python backfill_decision_history.py
```

After backfill, check the tables:

```bash
psql "postgresql://premortem:premortem@localhost:5432/premortem" -c "\dt"
psql "postgresql://premortem:premortem@localhost:5432/premortem" -c "SELECT count(*) FROM decision_history;"
psql "postgresql://premortem:premortem@localhost:5432/premortem" -c "SELECT count(*) FROM decision_history_chunks;"
```

## Decision History Memory Limits

The Contract Review Agent can receive bounded prior decision history as prompt context.

Default retrieval policy:

- last 10 completed decisions globally
- last 5 decisions for the same vendor, when vendor name is known
- last 5 decisions for the same procurement/equipment category
- top 5 vector-similar decision-history chunks for the current quote/context

Environment controls:

```env
DECISION_HISTORY_MEMORY_ENABLED=1
DECISION_HISTORY_GLOBAL_LIMIT=10
DECISION_HISTORY_VENDOR_LIMIT=5
DECISION_HISTORY_CATEGORY_LIMIT=5
DECISION_HISTORY_SIMILAR_LIMIT=5
DECISION_HISTORY_ITEM_CHAR_LIMIT=500
DECISION_HISTORY_TOTAL_CHAR_LIMIT=6000
```

Disable decision-history prompt memory without disabling database storage:

```env
DECISION_HISTORY_MEMORY_ENABLED=0
```

The item character limit is only a final prompt-size guard after retrieval. The
important-factor lane comes from pgvector similarity over `decision_history_chunks`.
The total character limit caps the combined history block after all retrieval
lanes are assembled.

The agent prompt treats all history as context only. It should not copy prior
risk scores or treat prior cases as proof that the current quote has the same
risk.

## If The Database Is Not Set Up Yet

Run the local setup script:

```bash
cd /home/chinmaey/Documents/Backup/AI/AgenticAI/Hackathon/premortom-ai/backend
python setup_pgvector.py
```

This creates:

- database: `premortem`
- user: `premortem`
- password: `premortem`
- pgvector extension

## If The Table Exists But Has No Rows

Make sure the backend is started with OKF pgvector indexing enabled.

In the repository root `.env`:

```env
DATABASE_URL=postgresql://premortem:premortem@localhost:5432/premortem
OKF_INDEX_PGVECTOR=1
OKF_USE_PGVECTOR_RETRIEVAL=1
```

Then start the backend:

```bash
cd /home/chinmaey/Documents/Backup/AI/AgenticAI/Hackathon/premortom-ai/backend
python run_backend.py
```

On startup, the backend should index OKF memory into `agent_memory_chunks` if Postgres and pgvector are available.

## Docker Version Later

When Docker is configured, use:

```bash
docker compose exec db psql -U premortem -d premortem -c "\dt"
```

And check memory rows:

```bash
docker compose exec db psql -U premortem -d premortem -c "SELECT agent_id, source_path, memory_type, updated_at FROM agent_memory_chunks ORDER BY updated_at DESC LIMIT 20;"
```
