# AKN-RLM Backend

FastAPI service wrapping the `akn_rlm` Python package for the viva demo.

## Run locally

```bash
cd backend
/home/maab/Documents/pfe/methodology/PFE_locally/.venv/bin/python -m pip install -r requirements.txt
/home/maab/Documents/pfe/methodology/PFE_locally/.venv/bin/python -m uvicorn app.main:app --port 8000 --reload
# → GET http://localhost:8000/api/health
```

Live mode is intentionally gated off unless the backend is started with both
`OFFLINE_MODE=false` and a valid AI-Grid key:

```bash
cd /home/maab/Documents/pfe/methodology/PFE_locally
set -a
source .env   # must define a valid, non-expired AI_GRID_API_KEY
set +a
cd backend
OFFLINE_MODE=false \
AI_GRID_BASE_URL="${AI_GRID_BASE_URL:-http://app.ai-grid.io:4000/v1}" \
/home/maab/Documents/pfe/methodology/PFE_locally/.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

## Run via docker-compose (from repo root)

```bash
docker-compose up --build
# backend: http://localhost:8000/api/health
# frontend: http://localhost:3000
```

For a live compose run, keep the same offline-first default and override it only
at launch:

```bash
OFFLINE_MODE=false AI_GRID_API_KEY=<valid-key> docker-compose up --build
```

Dataset paths default to `<repo>/latest_dataset/`. Override via env vars (see `.env.example`).
