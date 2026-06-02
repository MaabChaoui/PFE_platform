# CLAUDE.md — AKN-RLM Viva Demo build

Project-level instructions for any Claude session working in this repo. Keep this in mind for every task here. For full design depth, defer to **`plan.md`**; for current state, read the **latest `HANDOFF.md` entry**.

## What we're building
A polished, interactive **web demo** of **AKN-RLM** (citation-faithful Algerian-legal QA system; ENSIA thesis, viva 13/06/2026) — *not a chatbot*. New `backend/` (FastAPI wrapping the existing `akn_rlm` Python package) + `frontend/` (Next.js), run via `docker-compose`. **Offline-first**: most pages render from precomputed results; live LLM calls are an optional enhancement. Built in small sessions (S0–S16 in `plan.md` §14).

## ⛔ Hard rules (non-negotiable)
1. **Never touch git.** Do **not** `git add`, `commit`, `stage`, `push`, `tag`, or `git reset`. Make file changes only — the author manages all version control. (You may `git status`/`git diff` to inspect.)
2. **Python = the project venv.** Always use `/home/maab/Documents/pfe/methodology/PFE_locally/.venv/bin/python` (and `… /.venv/bin/python -m pip`) for every Python install, run, and test. Never use system `python`/`pip`. (Node/npm is separate — used only for the frontend.)
3. **`akn_rlm/` is read-mostly.** Change it only **additively** and **behind a feature flag**, so the thesis metrics never drift. Prefer wrapping behavior in `backend/` instead of editing the package.
4. **Offline-first.** Every change must be verifiable with **no live LLM** and **no network / model downloads** during dev. Live LLM (AI-Grid / Vertex) is an enhancement that may be unavailable.
5. **One session at a time.** Implement only the requested `Sxx` from `plan.md` §14. Don't pull future-session work forward.
6. **Always finish by appending a `HANDOFF.md` entry** (≤1000 tokens, format below). `HANDOFF.md` is the single source of truth between sessions.

## Source of truth & read order
1. `plan.md` — architecture (§1), stack (§2), folders (§3), API (§4), control map (§5), **data contracts (§6)**, strategies (§7–9), sessions (§14). Don't rederive decisions already here.
2. `HANDOFF.md` — read the **latest** `## Sxx` entry: it states current state + the **Next** pointer. `prompt.txt` holds the current session's brief.

## Session workflow
Implement → **verify offline** (exact commands) → append one HANDOFF entry under `## Demo Build`:
`## <Sxx> <title> (YYYY-MM-DD)` — **Status** · **Shipped** (files + endpoints/components) · **Contracts/paths** (embed the relevant `plan.md` §6 contract) · **Verify** (exact offline cmds) · **Gotchas** · **Next** (session id + first concrete step).

## Repo map (key paths)
- `backend/` FastAPI (wraps `akn_rlm`) · `frontend/` Next.js · `docker-compose.yml` · `plan.md` · `HANDOFF.md`.
- Python package: `akn_rlm/akn_rlm/`. UI entry point: `akn_rlm/akn_rlm/api/answer.py` (`answer_query`, `AnswerResponse`). Dispatcher: `akn_rlm/akn_rlm/rlm/dispatcher.py` (`build_dispatcher(...)`).
- Built indices (present): `akn_rlm/data/indices/{bm25.pkl, dense.faiss, dense_meta.parquet}`.
- Dataset: `latest_dataset/{akn,txt,rdf,pdf}/` + `latest_dataset/AlgerianLegalBench_v3.0_final.json`. KG: `latest_dataset/rdf/algerian_legal_kg.ttl` (74 MB) + small per-law `.ttl` files.
- Precomputed locked run: `akn_rlm/eval_results/rlm_dispatched_full_phase_e_final/{metrics.json, predictions.jsonl}`. Classifier eval: `akn_rlm/eval_results/classifier_accuracy_llm_final/`.
- Thesis (About/Results copy): `thesis/Thesis.txt`.

## Tech stack — don't drift
Backend: **FastAPI + uvicorn**, Pydantic v2, `sse-starlette`. Frontend: **Next.js 14 App Router + TypeScript + Tailwind (pinned v3) + shadcn/ui**; **Cytoscape.js** (`fcose`) for the KG; **Recharts**; TanStack Query. KG explorer queries a **prebuilt SQLite index** — never load the 74 MB rdflib graph at query time.

## Conventions
- API base path `/api`; backend `:8000`, frontend `:3000`.
- `NEXT_PUBLIC_API_BASE=http://localhost:8000/api` — use `localhost` (the browser runs on the host), **not** `http://backend:8000`. It is **inlined at build time**.
- Read-only Docker mounts: `./latest_dataset → /data/latest_dataset`, `./akn_rlm/data/indices → /data/indices`, `./akn_rlm/eval_results → /data/eval_results`.
- Dataset env vars (the package's `config.py` does **not** auto-discover `latest_dataset/`, so set these): `AKN_RLM_AKN_DIR`, `AKN_RLM_KG_PATH`, `AKN_RLM_BENCHMARK_PATH`.
- **Honesty about controls:** re-ranking and RRF fusion-weights are **not** in the live RLM path (handlers RRF BM25+Dense; `reranker.py` only feeds the Hybrid+Rerank baseline). Route those to the **Retrieval Lab** (baselines) and map every UI control to its real backend home (`plan.md` §5).

## Run & verify (host; use the venv)
- Backend deps: `/home/maab/Documents/pfe/methodology/PFE_locally/.venv/bin/python -m pip install -r backend/requirements.txt`
- Backend run: `cd backend && /home/maab/Documents/pfe/methodology/PFE_locally/.venv/bin/python -m uvicorn app.main:app --reload --port 8000`
- Backend tests: `/home/maab/Documents/pfe/methodology/PFE_locally/.venv/bin/python -m pytest backend/tests -m "not live"`
- Frontend: `cd frontend && npm install && npm run build` (must pass) · `npm run dev`
- Full stack: `docker-compose up --build` → `curl -s localhost:8000/api/health` → open `http://localhost:3000`.

## Known gotchas (carry forward)
- Tailwind pinned to **v3** (`^3.4.17`); npm@11+ installs v4, which breaks the `tailwind.config.ts` + `postcss.config.js` layout.
- `python:3.11-slim` has no `curl` — the Docker healthcheck uses a Python `urllib` one-liner.
- Frontend uses Next.js **standalone** output: run `node server.js`; copy `.next/static` + `public/` alongside `.next/standalone/`.
- KG 74 MB rdflib load is ~26 s + multi-GB RAM → used **only** by live TF/CD handlers; the explorer uses SQLite.
