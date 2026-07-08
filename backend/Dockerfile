FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/agent_profiles ./agent_profiles
COPY backend/prompts ./prompts
COPY backend/tests ./tests
COPY backend/run_backend.py ./run_backend.py
COPY backend/backfill_decision_history.py ./backfill_decision_history.py

# Bid workflow sample inputs live outside backend/ in the source tree. The
# compose build context is the repository root so they are copied below.
COPY files/input/samples /files/input/samples

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
