"""Set up local PostgreSQL/pgvector for PreMortem AI.

Run with a system account that can execute `sudo -u postgres psql`.
This is intended for local development only; Docker Compose handles this with
its own containerized database.
"""
from __future__ import annotations

import shutil
import subprocess
import sys


DB_NAME = "premortem"
DB_USER = "premortem"
DB_PASSWORD = "premortem"


def main() -> int:
    if shutil.which("psql") is None:
        print("psql was not found. Install PostgreSQL first.")
        return 1

    commands = [
        (
            "create app role",
            f"""
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{DB_USER}') THEN
                CREATE ROLE {DB_USER} LOGIN PASSWORD '{DB_PASSWORD}';
              END IF;
            END
            $$;
            """,
            None,
        ),
        (
            "enable pgvector",
            "CREATE EXTENSION IF NOT EXISTS vector;",
            DB_NAME,
        ),
        (
            "grant schema permissions",
            f"GRANT ALL ON SCHEMA public TO {DB_USER};",
            DB_NAME,
        ),
    ]

    for label, sql, database in commands:
        print(f"Setting up PostgreSQL: {label}...")
        if label == "enable pgvector":
            created = _ensure_database()
            if created.returncode != 0:
                print(created.stderr.strip())
                return created.returncode

        result = _psql(sql, database)
        if result.returncode != 0:
            print(result.stderr.strip())
            print()
            print("Setup failed. If the error mentions vector.control, install pgvector first.")
            return result.returncode

    print("PostgreSQL/pgvector setup complete.")
    print(f"DATABASE_URL=postgresql://{DB_USER}:{DB_PASSWORD}@localhost:5432/{DB_NAME}")
    return 0


def _ensure_database() -> subprocess.CompletedProcess[str]:
    exists = _psql(
        f"SELECT 1 FROM pg_database WHERE datname = '{DB_NAME}'",
        None,
        tuples_only=True,
    )
    if exists.returncode != 0:
        return exists
    if exists.stdout.strip() == "1":
        return subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")

    return subprocess.run(
        ["sudo", "-u", "postgres", "createdb", "-O", DB_USER, DB_NAME],
        text=True,
        capture_output=True,
        check=False,
    )


def _psql(
    sql: str,
    database: str | None,
    tuples_only: bool = False,
) -> subprocess.CompletedProcess[str]:
    cmd = ["sudo", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1"]
    if tuples_only:
        cmd.extend(["-t", "-A"])
    if database:
        cmd.extend(["-d", database])
    cmd.extend(["-c", sql])
    return subprocess.run(cmd, text=True, capture_output=True, check=False)


if __name__ == "__main__":
    sys.exit(main())
