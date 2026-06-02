# AKN-RLM Backend

FastAPI service wrapping the `akn_rlm` Python package for the viva demo.

## Run locally

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
# → GET http://localhost:8000/api/health
```

## Run via docker-compose (from repo root)

```bash
docker-compose up --build
# backend: http://localhost:8000/api/health
# frontend: http://localhost:3000
```

Dataset paths default to `<repo>/latest_dataset/`. Override via env vars (see `.env.example`).
