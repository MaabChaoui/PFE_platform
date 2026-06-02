# HANDOFF — AKN-RLM Viva Demo build

Single source of truth between implementation sessions. **Full design: [`plan.md`](plan.md)** (architecture, API, control map, data contracts §6, all 16 sessions). Read `plan.md` first, then the latest entry below.

Demo for the ENSIA viva on **13/06/2026**. Goal: a polished, interactive web demo of AKN-RLM (not a chatbot) — new `backend/` (FastAPI wrapping `akn_rlm`) + `frontend/` (Next.js), via `docker-compose`. **Offline-first**: precomputed predictions/metrics drive Results, Benchmark, and Main-page replay with no LLM; live is an enhancement.

## Quick reference (verify paths before relying on them)
- Backend `:8000` (`/api/...`) · Frontend `:3000` (`NEXT_PUBLIC_API_BASE=http://localhost:8000/api`).
- Python pkg: `akn_rlm/akn_rlm/` · UI entry point: `akn_rlm/akn_rlm/api/answer.py` (`answer_query`, `AnswerResponse`) · dispatcher: `akn_rlm/akn_rlm/rlm/dispatcher.py` (`build_dispatcher(...)`).
- Indices (present): `akn_rlm/data/indices/{bm25.pkl,dense.faiss,dense_meta.parquet}`.
- Dataset: `latest_dataset/{akn,txt,rdf,pdf}/` + `latest_dataset/AlgerianLegalBench_v3.0_final.json`. KG: `latest_dataset/rdf/algerian_legal_kg.ttl` (74 MB; per-law `.ttl` files are small).
- Precomputed (locked run): `akn_rlm/eval_results/rlm_dispatched_full_phase_e_final/{metrics.json,predictions.jsonl}`. Classifier eval: `akn_rlm/eval_results/classifier_accuracy_llm_final/`.
- **Dataset env vars the backend must set** (config auto-discovery does NOT find `latest_dataset/`): `AKN_RLM_AKN_DIR`, `AKN_RLM_KG_PATH`, `AKN_RLM_BENCHMARK_PATH`.
- Data contracts (benchmark question, predictions record, `AnswerResponse`, KG subgraph, metrics): **`plan.md` §6** — embed the relevant one verbatim in each session's HANDOFF entry.
- Constraints: change `akn_rlm/` only **additively** (new telemetry behind a flag) so thesis metrics never drift. Every session must be **offline-verifiable** (no live LLM).

## Entry format (append one per session, ≤1000 tokens)
`## <Sxx> <title> (<YYYY-MM-DD>)` — **Status** done/partial · **Shipped** (files + endpoints/components) · **Contracts/paths** touched · **Verify** (exact offline commands) · **Gotchas** · **Next** (session id + first concrete step).

---

## Demo Build

## S0 — Repo + compose skeleton (2026-06-01)

- **Status:** done
- **Shipped:**
  - `backend/app/__init__.py`, `backend/app/main.py`, `backend/app/settings.py`
  - `backend/app/routers/__init__.py`, `backend/app/routers/health.py`
  - `backend/requirements.txt` (`fastapi`, `uvicorn[standard]`, `pydantic-settings` only)
  - `backend/Dockerfile` (`python:3.11-slim`; Python healthcheck, no curl needed)
  - `backend/README.md`
  - `frontend/app/layout.tsx` (persistent top nav, 7 links), `frontend/app/globals.css`
  - `frontend/app/page.tsx` (client component — health badge with `useEffect`)
  - `frontend/app/{architecture,corpus,kg,benchmark,results,about}/page.tsx` (6 placeholders)
  - `frontend/lib/api.ts` (`getHealth()`, `HealthResponse` type)
  - `frontend/package.json` (Next.js 14.2.29, Tailwind v3.4.17, TypeScript)
  - `frontend/{next.config.js,tsconfig.json,tailwind.config.ts,postcss.config.js,.env.local}`
  - `frontend/Dockerfile` (node:20-alpine multi-stage; `ARG NEXT_PUBLIC_API_BASE` before build; runs `node server.js`)
  - `docker-compose.yml` (two services on `demo` network; read-only mounts; Python healthcheck)
  - `.env.example` (all env vars documented)

- **Contracts/paths:**
  - Health JSON shape: `{"status":"ok","offline_mode":bool,"indices_present":bool,"dataset_present":bool,"predictions_present":bool,"llm":"unchecked"}`
  - `indices_present` = `INDICES_DIR/bm25.pkl` exists · `dataset_present` = `AKN_RLM_BENCHMARK_PATH` exists · `predictions_present` = `PREDICTIONS_PATH` exists
  - Settings env vars → local default → container override:
    - `AKN_RLM_AKN_DIR` → `<repo>/latest_dataset/akn` → `/data/latest_dataset/akn`
    - `AKN_RLM_KG_PATH` → `<repo>/latest_dataset/rdf/algerian_legal_kg.ttl` → `/data/latest_dataset/rdf/algerian_legal_kg.ttl`
    - `AKN_RLM_BENCHMARK_PATH` → `<repo>/latest_dataset/AlgerianLegalBench_v3.0_final.json` → `/data/latest_dataset/AlgerianLegalBench_v3.0_final.json`
    - `INDICES_DIR` → `<repo>/akn_rlm/data/indices` → `/data/indices`
    - `EVAL_RESULTS_DIR` → `<repo>/akn_rlm/eval_results` → `/data/eval_results`
    - `PREDICTIONS_PATH`, `METRICS_PATH` → derived from `EVAL_RESULTS_DIR/rlm_dispatched_full_phase_e_final/` when unset (model_validator ensures Docker override of `EVAL_RESULTS_DIR` propagates)
  - Read-only mount convention: `./latest_dataset → /data/latest_dataset`, `./akn_rlm/data/indices → /data/indices`, `./akn_rlm/eval_results → /data/eval_results`
  - Ports: backend `:8000`, frontend `:3000` · `NEXT_PUBLIC_API_BASE=http://localhost:8000/api`

- **Verify:**
  ```bash
  # Local backend
  cd backend && pip install -r requirements.txt
  uvicorn app.main:app --port 8000   # from backend/ dir
  curl -s localhost:8000/api/health
  # Expected: {"status":"ok","offline_mode":true,"indices_present":true,"dataset_present":true,"predictions_present":true,"llm":"unchecked"}

  # Local frontend
  cd frontend && npm install && npm run build   # build must succeed
  npm run dev   # open http://localhost:3000 — nav has 7 links; health badge shows all flags true

  # Docker (from repo root)
  docker-compose up --build
  curl -s localhost:8000/api/health   # same JSON as above
  # http://localhost:3000 loads; health badge shows "ok" + all flags true
  ```
  **Observed (local):** `indices_present=true`, `dataset_present=true`, `predictions_present=true` — all three flags confirmed true (not just 200). `next build` produced 7 routes, 0 errors.

- **Gotchas:**
  - `NEXT_PUBLIC_API_BASE` is inlined at build time, not runtime. The compose value is `http://localhost:8000/api` (host-visible) — NOT `http://backend:8000`. Browser runs on host, not inside the compose network.
  - Tailwind pinned to v3 (`^3.4.17`). npm@11+ installs v4 by default; v4 uses `@tailwindcss/postcss` and breaks the `tailwind.config.ts` + `postcss.config.js` layout.
  - Repo root derived from `Path(__file__).resolve().parents[2]` in `settings.py`. Verified depth: settings.py→app→backend→repo. Running uvicorn from any CWD gives correct path defaults.
  - `python:3.11-slim` has no curl; healthcheck uses Python `urllib.request` one-liner.
  - Frontend standalone output: `node server.js` (not `next start`); `.next/static` and `public/` must be copied alongside `.next/standalone/`.

- **Next:** S1 — Backend PipelineService + corpus service + meta/corpus endpoints. First step: add `akn_rlm` editable install + `rdflib`, `rank-bm25`, `sentence-transformers`, `faiss-cpu` to `backend/requirements.txt` and Dockerfile; create `backend/app/services/pipeline.py` with singleton `PipelineService`.

## S1 — Backend PipelineService + corpus API (2026-06-02)

- **Status:** done
- **Shipped:** `backend/app/services/pipeline.py`, `services/corpus.py`, `deps.py`, `models/{__init__,corpus}.py`, `routers/corpus.py`; updated `main.py`, `settings.py`, `health.py`, `backend/requirements.txt`, `backend/Dockerfile`, `docker-compose.yml`; fixtures `backend/fixtures/{akn,txt,benchmark,rdf}`; tests `backend/tests/test_corpus_api.py`. Endpoints: `GET /api/meta`, `/api/corpus/documents`, `/api/corpus/documents/{doc_id}`, `/xml`, `/text`, `/api/corpus/articles/{doc_id}/{article_ref}`, `/api/corpus/search`.
- **Contracts/paths:** `PipelineService` warms `parse_all()` + `ArticleRegistry` once at lifespan startup and keeps per-doc/per-article in-memory indexes; `bm25()`, `dense()`, `llm_pool()`, `kg()` are memoized lazy loaders, `get_dispatcher()` is stubbed with `NotImplementedError("wired in S4")`. Uses `Article{doc_id, article_ref, text_ar, text_normalized, frbr_uri, ancestors, eid, filename_stem, doc_title, doc_date, doc_type, paragraphs}` and `DocEntry{canonical_id, doc_title, doc_date, doc_type, filename_stem, article_eids, article_refs}`. Doc lookups resolve direct then `registry.resolve_alias`; raw files use `filename_stem -> AKN_RLM_AKN_DIR/*.xml` and `AKN_RLM_TXT_DIR/*.txt`. New vars: `AKN_RLM_TXT_DIR`, `AKN_RLM_RDF_DIR`, `AKN_RLM_PDF_DIR`, `AKN_RLM_EXTRACTION_REPORT_PATH`. Local importability: `pip install -e ./akn_rlm`; Docker importability: `./akn_rlm:/app/akn_rlm:ro` plus `PYTHONPATH=/app/akn_rlm`. Meta counts: corpus parse/registry, benchmark JSON `questions`, RDF `extraction_report.summary.total_triples`.
- **Verify:** `/home/maab/Documents/pfe/methodology/PFE_locally/.venv/bin/python -m pip install -e ./akn_rlm && /home/maab/Documents/pfe/methodology/PFE_locally/.venv/bin/python -m pip install -r backend/requirements.txt` succeeded. `cd backend && $PY -m uvicorn app.main:app --port 8000`: `/api/meta -> {"documents":45,"articles":8868,"benchmark_questions":244,"kg_triples":765215,...}`; `/api/corpus/documents | jq length -> 45`; family-code detail returned 239 articles and 235 with non-empty ancestors; article `84-11_1984-06-09/1` returned Arabic text; `/xml` and `/text` returned raw content; URL-encoded search `q=الزواج -> 44`; alias `75-8_1975-09-26 -> 75-58_1975-09-26`. `$PY -m pytest backend/tests -m "not live" -q -> 3 passed`. `docker-compose up --build` succeeded after freeing disk; backend healthy; container `/api/meta` matched local counts.
- **Gotchas:** current `parse_all()` returns 8868 Article objects, not the brief’s approximate 9002. One FRBR collision maps `06-01_2006-02-20` to `05-01_2005-02-06`; the wrapper preserves benchmark filename identities so the API still exposes 45 docs. Raw Arabic in curl URLs must be URL-encoded (`curl -G --data-urlencode`). Starlette `TestClient` hangs inside the sandbox; tests pass outside it.
- **Next:** S2 — benchmark + results services (precomputed). First step: `services/benchmark.py` loading `AKN_RLM_BENCHMARK_PATH` + joining `…/rlm_dispatched_full_phase_e_final/predictions.jsonl` by `question_id`.

## S2 — Benchmark + results services (2026-06-02)

- **Status:** done
- **Shipped:** `backend/app/services/{benchmark.py,results.py}`, `routers/{benchmark.py,results.py}`, `models/{benchmark.py,results.py}`, updated `deps.py`, `main.py`, `settings.py`; `backend/app/data/baselines.json`; fixtures under `backend/fixtures/eval/`; tests `backend/tests/{conftest.py,test_benchmark_api.py,test_results_api.py}`. Endpoints: `GET /api/benchmark/questions`, `/api/benchmark/questions/{id}`, `/api/benchmark/stats`, `/api/results/metrics`, `/api/results/baselines`, `/api/results/runs`, `/api/results/classification`.
- **Contracts/paths:** benchmark top-level `{metadata,document_registry,questions[]}` loaded from `AKN_RLM_BENCHMARK_PATH`; predictions loaded from `PREDICTIONS_PATH` and joined by `question_id`. Per-question citation correctness uses set overlap of `gold_article_ids` vs `pred_article_ids` (`doc_id#art_N`) into `n_gold,n_pred,n_correct,precision,recall,f1`; abstention questions use `query_type=="unanswerable"` / `gold_abstain` and score `predicted_abstain==gold_abstain`. Gold text enrichment calls S1 `corpus.article(document_id, article_ref)` so aliases resolve; unresolved or `in_dataset:false` returns `text:null,resolved:false`. `metrics()` serves `METRICS_PATH` structure as-is. `runs()` scans `EVAL_RESULTS_DIR/*/metrics.json`, locks `rlm_dispatched_full_phase_e_final`. New `CLASSIFIER_DIR` derives from `EVAL_RESULTS_DIR/classifier_accuracy_llm_final`; classification computes accuracy/per-type P/R/F1 from `classifier_predictions.jsonl` gold/pred labels and serves `confusion_matrix.json` verbatim (true→pred). `baselines.json` keys: improvement factors, tier1/2 tables, phase progression, ablation, notes, metric definitions.
- **Verify:** `$PY -m pytest backend/tests -m "not live" -q` -> `9 passed, 82 warnings`. Host `cd backend && $PY -m uvicorn app.main:app --port 8000`: `questions?page_size=5 -> 244`; `query_type=unanswerable -> 40`; stats query_type = 66/59/40/26/17/17/12/7; `civ_ra_q01` has 2 resolved gold texts, 2 predicted citations, 9 trajectory steps, `n_correct=1`; metrics `citation_f1=0.3044757580895478`, `abstention_f1=0.7034482758620689`; baselines improvement factors `{1.64,2.9,1.74}`; runs length `87` with locked flagged; classification `accuracy=0.6967213114754098`, 8 labels. `docker-compose up --build` rebuilt backend/frontend, backend health passed, same endpoint numbers worked in-container.
- **Gotchas:** local sockets/TestClient need running outside the sandbox. `civ_ra_q01` expected docs use alias `75-8_1975-09-26` but diff IDs are canonical `75-58_1975-09-26#art_N`. Gold text resolution: 431/442 in-dataset expected articles resolved; 11 unresolved: `env_un_q01 03-10/52`, `env_ea_q01 03-10/15`, `env_ra_q01 03-10/52`, `env_cd_q01 03-10/18`, `env_ra_q02 03-10/25`, `hous_ea_q01 11-04/5`, `hous_ra_q01 11-04/27`, `ip_ea_q01 03-05/54`, `ip_cd_q01 03-05/21`, `ip_ra_q01 03-05/151`, `xdom_mh_q06 03-10/18`. Results page should display locked 0.3045 vs gold-typed 0.313 from baselines notes.
- **Next:** S3 — KG index builder + subgraph API. First step: `backend/app/scripts/build_kg_index.py` that parses per-law TTLs in `latest_dataset/rdf/` into compact SQLite (`nodes`,`edges`), idempotent at entrypoint.
