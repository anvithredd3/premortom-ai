"""Run the FastAPI backend with local development defaults.

Project-level settings should live in the repository root `.env`. This runner
fills in path defaults that are annoying to type by hand, then starts uvicorn.
"""
from __future__ import annotations

import os
from pathlib import Path

import uvicorn
from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_ROOT.parent


def main() -> None:
    load_dotenv(REPO_ROOT / ".env", override=False)

    os.environ.setdefault(
        "OKF_MEMORY_ROOT",
        str(BACKEND_ROOT / "agent_profiles" / "contract_agent_profile"),
    )
    okf_root = Path(os.environ["OKF_MEMORY_ROOT"]).expanduser()
    if not okf_root.is_absolute():
        os.environ["OKF_MEMORY_ROOT"] = str(REPO_ROOT / okf_root)

    os.environ.setdefault("OKF_WRITE_MEMORY_INDEX", "1")
    os.environ.setdefault(
        "DATABASE_URL",
        "postgresql://premortem:premortem@localhost:5432/premortem",
    )

    host = os.getenv("PREMORTEM_BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("PREMORTEM_BACKEND_PORT", "8000"))
    reload = os.getenv("PREMORTEM_BACKEND_RELOAD", "1") not in {"0", "false", "False"}

    uvicorn.run("app.main:app", host=host, port=port, reload=reload)


if __name__ == "__main__":
    main()
