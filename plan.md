# AKN-RLM Viva Demo — Implementation Plan (`plan.md`)

## Context

This repo holds **AKN-RLM**, a citation-faithful Algerian-legal QA system (ENSIA engineering thesis, *Ibrahim El Khalil Attia & Maab Chaoui*; viva **13/06/2026**). The Python package `akn_rlm/` runs an 8-handler typed dispatcher over Akoma Ntoso XML, a 765k-triple RDF KG, and a 244-question benchmark, behind a triple faithfulness gate (Cite F1 = 0.3045 locked / 0.313 gold-typed, HCR = 0.000, JIR = 0.000, Abstention F1 = 0.703).

We need a **polished, interactive web demo** for the viva — *not a chatbot* — that visualizes the whole pipeline and lets the jury explore the corpus, KG, benchmark, architecture, and results. The work is split into a new `backend/` (FastAPI wrapping `akn_rlm`) and `frontend/` (Next.js), orchestrated by `docker-compose`. Built in small, cold-startable sessions (Sonnet/Codex), each ending with a `<1000`-token `HANDOFF.md` entry. **`HANDOFF.md` is the single source of truth between sessions.**

**Decisions (confirmed with author):** execution = **hybrid offline-first + live**; scope = **all 7 pages**; stack = **Next.js + Tailwind + shadcn/ui**.

**The critical enabler:** `akn_rlm/eval_results/rlm_dispatched_full_phase_e_final/` already contains `metrics.json` (overall + per-type) and `predictions.jsonl` (all 244 questions: citations, gold, full trajectory, per-question scores). So Results, Benchmark, and trajectory replay on the Main page are **instant and fully offline**. Live LLM calls are an *enhancement*, never a dependency (assume `app.ai-grid.io:4000` and venue wifi may be down at the viva).

### Stated assumptions

- UI chrome in **English**; Arabic legal content rendered **RTL** (jury includes a Spanish co-supervisor). No i18n framework.
- Demo runs on the **author's laptop via `docker-compose up`**, possibly offline. Design for the offline-worst-case.
- `HANDOFF.md` is currently empty; treat as an intentional reset — append fresh demo-build entries under a `## Demo Build` delimiter (the Phase A–H history remains in git/README). *(Flagged for the author to confirm the reset was intentional; appending loses nothing regardless.)*
- `plan.md` and `HANDOFF.md` live at **repo root**. Existing `akn_rlm/` code is changed only **additively** (new telemetry behind a flag) so thesis metrics never drift.
- Live mode requires valid keys in `akn_rlm/.env`; absent/unreachable → graceful replay fallback.

---

## 1. Proposed architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ frontend/  Next.js (App Router, TS, Tailwind, shadcn/ui)          │
│  7 pages → typed API client → http://backend:8000/api             │
└───────────────▲───────────────────────────────────────────────▲─┘
                │ REST + SSE (trajectory stream)                  │
┌───────────────┴─────────────────────────────────────────────────┐
│ backend/  FastAPI                                                 │
│  routers → services → wraps `akn_rlm` package                     │
│  PipelineService: ONE set of heavy singletons                     │
│   (registry, bm25, dense, llm_pool, router, kg)                   │
│   + per-options memoized dispatchers (build_dispatcher)           │
│  Precomputed loaders: predictions.jsonl + metrics.json            │
│  KG index (prebuilt, compact) — NOT rdflib at query time          │
└───────────────────────────────────────────────────────────────┬─┘
                                                                  │ read-only mounts
   latest_dataset/{akn,txt,rdf,pdf,*.json} · akn_rlm/data/indices │
   akn_rlm/eval_results/rlm_dispatched_full_phase_e_final/        ─┘
```

**Why this shape:** the pipeline is Python and `akn_rlm.api.answer.answer_query` is already the intended single entry point; FastAPI gives async + SSE (for live step-by-step) + auto OpenAPI. Heavy resources load once; cheap dispatchers are rebuilt per control-combo and memoized. The KG explorer never touches the 74 MB rdflib graph (only the *live* TF/CD handlers do, lazily).

---

## 2. Recommended tech stack

| Layer         | Choice                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend       | **FastAPI** + Uvicorn; Pydantic v2; `sse-starlette` for streaming; installs `akn_rlm` (`pip install -e`)                         |
| KG index      | Prebuilt**SQLite** (nodes/edges tables) from per-law TTLs via `rdflib` at image-build; queried with plain SQL (fast, bounded)        |
| Frontend      | **Next.js 14 (App Router)** + **TypeScript** + **Tailwind** + **shadcn/ui** (Radix)                                  |
| Graph viz     | **Cytoscape.js** (+ `fcose` layout) — bounded subgraphs, lazy expand                                                                |
| Charts        | **Recharts** (metric bars, phase progression, per-type)                                                                                |
| XML view      | `fast-xml-parser` → custom tree; raw XML via `react-syntax-highlighter`                                                                 |
| Arabic        | `dir="rtl"` blocks; **IBM Plex Sans Arabic** / Noto Naskh; Inter for chrome                                                          |
| State/data    | React Server Components for static data; TanStack Query for client fetches/SSE                                                               |
| Tests         | Backend**pytest** + FastAPI `TestClient` on offline fixtures; Frontend **Vitest** + `tsc`/ESLint + optional Playwright smoke |
| Orchestration | **docker-compose** (backend :8000, frontend :3000)                                                                                     |

---

## 3. Folder structure

```
PFE_locally/
├── plan.md                         ← this deliverable
├── HANDOFF.md                      ← append one entry per session (root)
├── docker-compose.yml
├── .env                            ← LLM keys + dataset paths (gitignored)
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, CORS, router mounts, startup pre-warm
│   │   ├── settings.py             # paths, OFFLINE_MODE, ports, model cache dir
│   │   ├── deps.py                 # singleton accessors
│   │   ├── services/
│   │   │   ├── pipeline.py         # PipelineService: shared resources + memoized dispatchers
│   │   │   ├── corpus.py           # parse+cache AKN docs/articles (akn_parser, article_registry)
│   │   │   ├── kg.py               # bounded subgraph queries over prebuilt SQLite index
│   │   │   ├── benchmark.py        # benchmark JSON + join predictions.jsonl
│   │   │   ├── results.py          # metrics.json + curated baseline table
│   │   │   └── retrieval_lab.py    # baselines + rrf_fuse(weights) + reranker comparisons
│   │   ├── routers/ {answer,corpus,kg,benchmark,results,retrieval}.py
│   │   ├── models/                 # Pydantic schemas (mirror AnswerResponse, etc.)
│   │   └── scripts/build_kg_index.py
│   ├── data/kg_index.sqlite        # generated artifact (gitignored)
│   ├── fixtures/                   # tiny offline test data (2 questions, 1 small TTL, 1 XML, stub metrics)
│   ├── tests/
│   ├── requirements.txt · Dockerfile · README.md
└── frontend/
    ├── app/{page,architecture,corpus,kg,benchmark,results,about}/…  # 7 routes
    ├── components/{pipeline,corpus,kg,benchmark,results,shared,ui}/
    ├── lib/{api.ts,types.ts,format.ts}
    ├── public/  · package.json · tailwind.config.ts · next.config.js · Dockerfile
    └── .env.local                  # NEXT_PUBLIC_API_BASE=http://localhost:8000/api
```

---

## 4. Backend API design

Base path `/api`. **All read endpoints work fully offline.** Live endpoints degrade gracefully.

| Method · Path                                                                                       | Purpose                                                                                                                      | Offline?       |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `GET /health`                                                                                      | indices present? KG warm? LLM reachable?                                                                                     | ✓             |
| `GET /meta`                                                                                        | corpus/benchmark/KG headline counts                                                                                          | ✓             |
| `GET /corpus/documents`                                                                            | 45 docs: id, title, date, type, article_count, formats                                                                       | ✓             |
| `GET /corpus/documents/{doc_id}`                                                                   | doc tree: hierarchy + articles (ref, num, eId, status, ancestors, text, paragraphs)                                          | ✓             |
| `GET /corpus/documents/{doc_id}/xml` · `/text`                                                  | raw AKN XML · raw txt                                                                                                       | ✓             |
| `GET /corpus/articles/{doc_id}/{article_ref}`                                                      | one article (+KG links, versions)                                                                                            | ✓             |
| `GET /corpus/search?q=&doc_id=&type=`                                                              | article search (BM25 index / normalized substring)                                                                           | ✓             |
| `GET /kg/meta`                                                                                     | node types, predicate types, per-law triple counts                                                                           | ✓             |
| `GET /kg/subgraph?seed=&doc_id=&node_types=&edge_types=&depth=&limit=`                             | **bounded** Cytoscape `{nodes,edges}`                                                                                | ✓             |
| `GET /kg/node/{id}` · `GET /kg/search?q=`                                                       | node detail · node search                                                                                                   | ✓             |
| `GET /benchmark/questions?query_type=&difficulty=&category=&answerable=&language=&split=&q=&page=` | filtered list + per-q prediction summary (pred articles, cite_f1, abstained, latency)                                        | ✓             |
| `GET /benchmark/questions/{id}`                                                                    | full question + gold articles**with text** + precomputed prediction (citations, trajectory, scores, gold-vs-pred diff) | ✓             |
| `GET /benchmark/stats`                                                                             | distribution counts for overview charts                                                                                      | ✓             |
| `POST /benchmark/questions/{id}/run`                                                               | live re-run (hybrid); falls back to precomputed                                                                              | live→fallback |
| `POST /answer`                                                                                     | full `AnswerResponse` (sync) for given query + options                                                                     | live→fallback |
| `POST /answer/stream` (SSE)                                                                        | stream trajectory steps live (route→retrieve→verify→recursion→adu→summarize→gate→done)                                | live only      |
| `POST /classify`                                                                                   | query →`{query_type, confidence}` (classifier preview)                                                                    | live           |
| `GET /pipeline/config`                                                                             | catalog of available controls + current defaults (UI renders panel from this)                                                | ✓             |
| `POST /pipeline/reset`                                                                             | `reset_dispatcher()` (Cache reset control)                                                                                 | ✓             |
| `POST /retrieval/compare`                                                                          | per-retriever ranked lists + RRF-fused (weights) + reranked, with scores                                                     | ✓ (no LLM)    |
| `GET /results/metrics` · `/baselines` · `/runs`                                              | locked `metrics.json`; curated baseline table; available runs                                                              | ✓             |
| `GET /results/classification`                                                                      | classifier accuracy over the 8 query types + confusion matrix (from `akn_rlm/eval_results/classifier_accuracy_llm_final/`) | ✓             |

**PipelineService (core backend refactor of `akn_rlm/api/answer.py`):**

- Module singletons loaded once: `ArticleRegistry`(parse_all), `BM25Index`, `DenseIndex`, `LLMPool.default()`, `DocRouter`, lazy `kg`.
- `get_dispatcher(options) -> RLMDispatcher`: memoized by a hashable options key; calls existing `build_dispatcher(...)` with the verified kwargs; sets E-flag env vars per request. Default options replicate `_build_dispatcher()` (E4 HyDE on, ADU on top-5, recursion depth 3, corrective retry, MH/RA coverage_min=4).
- **Concurrency note:** E1–E7 and `AKN_NO_CITATION_GATE` are read from `os.environ` at dispatcher *build* time, so mutating them per request is process-global. **Lock-serialize builds** (reuse the `_INIT_LOCK` pattern) and assume single-user demo concurrency; memoization means each combo builds once. Kwarg toggles (recursion / ADU / ceiling-breakers / coverage_min) are request-safe and preferred where available.
- `answer(query, options)` wraps `dispatcher.run()` → `AnswerResponse.to_dict()`.

**Dataset wiring (important):** the current `config.py` auto-discovery looks for `new_dataset/`, **not** `latest_dataset/`. Set explicit env vars in backend/compose:
`AKN_RLM_AKN_DIR=/data/latest_dataset/akn`, `AKN_RLM_KG_PATH=/data/latest_dataset/rdf/algerian_legal_kg.ttl`, `AKN_RLM_BENCHMARK_PATH=/data/latest_dataset/AlgerianLegalBench_v3.0_final.json`. Indices come from mounted `akn_rlm/data/indices` (`bm25.pkl`, `dense.faiss`, `dense_meta.parquet` confirmed present).

---

## 5. Control map (UI control → real backend home)

The live RLM path = classifier → typed handler → RRF(BM25,Dense[,HyDE]) → sub-LM verify → recursion → ADU → summarize → gates. **Re-ranking and fusion-weights are NOT in the live path** (handlers RRF BM25+Dense; `reranker.py` is only used by the Hybrid+Rerank baseline). Be honest in the UI: route those to the **Retrieval Lab**, and add lightweight per-channel telemetry so the live retrieve step is still visualizable.

| UI control (page)                                                                            | Real home                   | Mechanism                                                                                                 |
| -------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Classifier ON / manual type (Main)                                                           | live                        | `dispatcher.run(query, query_type=None\|<type>)`                                                         |
| RLM (recursion) ON/OFF + max depth + MH/RA coverage_min (Main)                               | live                        | `enable_recursion`, `recursion_max_depth`, `recursion_coverage_min_overrides`                       |
| Corrective retry ON/OFF (Main)                                                               | live                        | `enable_corrective_retry`                                                                               |
| Pervasive ADU ON/OFF + top-N (Main)                                                          | live                        | `enable_pervasive_adu`, `adu_extract_top_n`                                                           |
| HyDE (E4) ON/OFF (Main)                                                                      | live                        | env `AKN_E4_HYDE`                                                                                       |
| Enhancers E1/E2/E3/E5/E6/E7 (Main, advanced)                                                 | live                        | env `AKN_E{1..7}_*`                                                                                     |
| Ceiling-breakers (Main, advanced)                                                            | live                        | `enable_ceiling_breakers`                                                                               |
| KG ON/OFF (Main)                                                                             | live                        | `kg_loader=None` (TF/CD abstain)                                                                        |
| Citation gate ON/OFF (Main, advanced)                                                        | live                        | env `AKN_NO_CITATION_GATE`                                                                              |
| Sub-model override · long-context timeout (Main)                                            | live                        | `sub_model`, `long_context_timeout_s`                                                                 |
| **Cache reset** (Main)                                                                 | live                        | `POST /pipeline/reset` → `reset_dispatcher()`                                                        |
| **Debug / trace mode** (Main)                                                          | both                        | render `trajectory[].detail` raw payloads                                                               |
| **Retriever selection · RRF fusion weights · Re-ranker ON/OFF · k** (Retrieval Lab) | `POST /retrieval/compare` | `baselines/*` + `hybrid_fusion.rrf_fuse(weights=)` + `reranker.rerank()`                            |
| Per-channel candidates (BM25/Dense/HyDE) + fused scores on the live step                     | new additive telemetry      | emit a `retrieve` trajectory step with per-channel hits + fused scores (flag-guarded, no metric change) |

---

## 6. Key data contracts (embed verbatim in HANDOFF so sessions are self-contained)

**Benchmark question** (`latest_dataset/AlgerianLegalBench_v3.0_final.json`, top-level `{metadata, document_registry, questions[]}`, 244 q):

```
id, version, source, split, language(ar|fr), category(23), query_type(8),
difficulty(easy|medium|hard), question, answerable(bool), partially_answerable,
temporal_note, expected_documents[str], expected_articles[{document_id, article_ref,
law_name_ar, in_dataset, article_ref_disambig}], ground_truth_answer,
reasoning_chain[str], annotation{...}
```

Counts: query_type = rule_application 66 / exact_article 59 / unanswerable 40 / multi_hop 26 / long_context 17 / layman 17 / conceptual_definitional 12 / temporal_factual 7. difficulty = easy 56 / medium 85 / hard 103. lang = ar 232 / fr 12. document_registry = 32 entries (with `formats_available{akn,txt,rdf,pdf}`).
**Answerability convention (state once, apply everywhere):** three numbers exist — `query_type=='unanswerable'` (**40**), `answerable==False` (67), and metadata `unanswerable_questions`. Use **`query_type=='unanswerable'` (40)** as the abstention positive set (matches thesis Abstention F1 = 0.703). Benchmark filters and Results framing must use this convention consistently.

**Precomputed prediction** (`…/rlm_dispatched_full_phase_e_final/predictions.jsonl`, join to question by `question_id`):

```
question_id, query, query_type, dispatched_handler, pred_doc_ids, pred_article_ids,
gold_doc_ids, gold_article_ids, predicted_citations[], gold_citations[],
predicted_abstain, gold_abstain, answer_text, gold_answer_text, reasoning_chain,
trajectory[{step, depth, ...}], hcr, jir, answer_faithfulness, citation_groundedness,
am_faithfulness_score, latency_s, sub_call_count, calls_by_model, retry_count,
legal_category, difficulty, language, split
```

**`AnswerResponse`** (`akn_rlm/akn_rlm/api/answer.py`): `query, query_type_predicted, handler_used, answer_text, citations[Citation], references[str], trajectory[TrajectoryStep], abstained, abstention_reason, latency_s, sub_call_count, am_faithfulness_score, recursion_depth_max, corrective_retry_fired`. `Citation{doc_id, article_ref, doc_title, supporting_span, text, confidence, version_date?, kg_source?, argumentation?, verifier_relevant?}`. `TrajectoryStep{step, depth, summary, detail}`. All have `.to_dict()`.

**KG subgraph response:** `{ nodes:[{id,type,label,doc_id?,article_ref?,props}], edges:[{id,source,target,predicate}], truncated:bool, total_neighbors:int }`. Ontology: `dzdoc:` (Law, Article, Paragraph, ExternalReference, AmendmentEvent, ArticleVersion, …), `dznorm:` (Obligation, Right, Permission, Prohibition, Condition), `dzterm:`/`skos:Concept`. **Derive node/edge types by querying the index at build time — do not hardcode** (loader assumptions and actual TTL predicates differ).

**`metrics.json` overall (locked run, verified):** `citation_f1 0.3045`, `doc_citation_f1 0.613`, `hcr 0.0`, `jir 0.0`, `abstention_f1 0.703`, `am_faithfulness_score 0.471`, `answer_faithfulness 0.320`, `citation_groundedness 0.553`, `mrr_article 0.310`, `recall_article 0.258`, `mean_latency_s 9.74`, `corrective_retry_rate 0.193`; plus `by_query_type{…}`. Gold-typed counterpart = 0.313 (thesis §4.3). **Render from the file; never hardcode** (note locked 0.3045 vs gold-typed 0.313).

---

## 7. Data-loading strategy

- **Precomputed-first:** benchmark predictions + metrics loaded into memory at startup; served as the default everywhere. Trajectory replay on Main uses these (looks live, zero risk).
- **Corpus:** `parse_all()` once at startup (~9k Article objects) → cache per-doc trees + article index in memory. Raw XML/txt streamed from mounted files.
- **KG:** build compact **SQLite** index once (image build or first boot) from the *per-law* TTLs (small) + cross-law edges; explorer queries SQLite (bounded). The 74 MB `algerian_legal_kg.ttl` is loaded **only** by live TF/CD handlers (lazy, ~26 s), never by the explorer.
- **Live:** `PipelineService` memoized dispatchers; SSE for streaming.

## 8. Graph scalability strategy

- **Never ship the whole graph.** Prebuilt SQLite: `nodes(id, type, label, doc_id, article_ref, props_json)`, `edges(source, target, predicate)` with indices on `source`,`target`,`doc_id`,`type`,`predicate`.
- **Bounded subgraph endpoint:** seed (doc / article / term) → BFS to `depth∈{1,2}` → filter by `node_types`/`edge_types` → cap to `limit` (default 250, hard max ~600) → return `truncated` + neighbor counts; high-degree nodes (e.g. a 1000-article law) are *not* auto-expanded — show count + "expand" pagination.
- **Two modes:** *Law overview* (document-level nodes + amends/references edges only — small) and *Article drill-down* (expand one article's neighborhood). Cross-law edges are few (~468 external refs, 9,091 amendment events) so they index cheaply.
- **Frontend:** Cytoscape `fcose`; lazy expand on node click; legend by node/edge type; node cap warning; loading skeleton.

## 9. Pipeline execution strategy (hybrid)

- **Replay (default, always-on):** benchmark queries → serve precomputed trajectory/citations/scores; Main page animates steps with play/step controls.
- **Live (when healthy):** free-form query → `PipelineService` → **SSE** stream of trajectory steps with per-step timing + `sub_call_count`. `GET /health` gates the live button; if APIs down → toast + offer "replay a similar precomputed example."
- **Pre-warm:** at startup, build the default dispatcher; optionally warm KG. Live **TF/CD** trigger the 74 MB load — either pre-warm or route TF/CD to precomputed (configurable `LIVE_TF_CD=replay|live`).
- **Per-request options** via memoized dispatchers (don't rebuild heavy singletons).

---

## 10. Frontend page structure (the 7 pages)

1. **LexAlgeria — Main pipeline visualizer** (`/`). Query box (AR/FR/Darja) + **Control Panel** (full §5 map; basic vs *Advanced* accordion). Center: **trajectory "subway map"** with active-step highlight + animated, expandable **StepCards** (route → retrieve[per-channel candidates + RRF scores] → verify → recursion[depth badges] → adu[Toulmin] → summarize → faithfulness gate → corrective retry). Right: **Answer panel** (RTL Arabic) + **citation chips** (deep-link to corpus article + KG node) + references + telemetry (latency, sub-calls, depth, retry). **Modes:** *Replay* (benchmark picker, instant) and *Live* (SSE). Embeds the **Retrieval Lab** panel.
2. **AKN dataset explorer** (`/corpus`). Doc list (45) w/ metadata + filters (type/date/category). Document view: **side-by-side** plain text ⟷ AKN XML; **tree XML nav** (book/chapter/section/article eIds, status badges); **metadata panel** (FRBR, dates, title, type, formats); selecting an article syncs both panes; in-doc + cross-corpus search; per-doc summary (article count, structure depth).
3. **RDF KG explorer** (`/kg`). Cytoscape canvas + **filter bar** (law/doc, node type, relationship type, article/entity search, depth, max nodes). Bounded subgraph + lazy expand; **node inspector** (props, text, link to corpus article); law-overview ↔ article-drill modes; legend; perf guard.
4. **Benchmark page** (`/benchmark`). Filterable/searchable **question table** (type/difficulty/category/answerable/language/split) with per-q "AKN-RLM hit?" badge. Detail: query, type/difficulty/answerability/metadata, **gold target articles WITH full text**, reasoning chain, and **"Run through pipeline"** → precomputed AKN-RLM prediction (gold-vs-pred diff, citations, trajectory, per-q scores) + optional live re-run. Overview charts.
5. **Architecture page** (`/architecture`). Interactive, **clickable** system diagram (data-driven content module). Each node → panel: *what it does · inputs · outputs · where in code* (real paths, e.g. `rlm/dispatcher.py`, `gates/faithfulness_nli.py`) · relevant metric. Animated data flow. Mirrors thesis §3.4.
6. **Results page** (`/results`). Headline **MetricCards** (Cite F1 0.3045 locked / 0.313 gold-typed, HCR 0, JIR 0, AbsF1 0.703, AMF 0.471, latency 9.7 s) + **metric explainers** (definitions of every metric: Cite P/R/F1, HCR, JIR, AbsF1, AMF, answer-faithfulness, groundedness, retrieval R@10/MRR/nDCG). **Charts:** per-query-type stratified bars, phase progression A→E, baseline comparison table (2.9× / 1.74× / 1.64×), ablation table, **and classification metrics** — classifier accuracy over the 8 query types + a confusion matrix (required by the task; from `/results/classification`). All from `/results`.
7. **About page** (`/about`). Title, abstract/motivation, authorship (Attia & Chaoui), ENSIA, jury + viva 13/06/2026, demo purpose, the two novel resources (corpus 171 files; AlgerianLegalBench 244 q), AI-usage note, links.

## 11. UX / design direction

- Scholarly-modern: deep indigo/navy + parchment + one accent; light/dark; **presenter mode** (large type, high contrast for projector).
- Inter for chrome; **IBM Plex Sans Arabic**/Noto Naskh for legal text; strict `dir="rtl"` on Arabic blocks; never mirror the whole app.
- Reusable: `MetricCard`, `CitationChip`, `ArticleCard`, `GraphCanvas`, `FilterBar`, `TrajectoryTimeline`, `StepCard`, `ArabicText`.
- Trajectory animation with play/pause/step (viva storytelling). Skeletons; explicit empty/offline/error states. Restrained motion.

## 12. Docker setup

- `backend/Dockerfile`: `python:3.11-slim`; install `akn_rlm` (editable) + backend reqs (`fastapi uvicorn sse-starlette rdflib faiss-cpu sentence-transformers rank-bm25 pydantic`); **pre-bake HF weights** at build (`intfloat/multilingual-e5-small`, `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`, `MoritzLaurer/mDeBERTa-v3-base-mnli-xnli`) into `HF_HOME` so first run needs no internet (build host has internet). **KG SQLite index** is built at **entrypoint / first boot, idempotently** (skip if it already exists in the named volume) — **not** at image build, because `latest_dataset` is a run-time bind mount and isn't visible during `docker build`. (Alternative: `COPY` the per-law TTLs into the image and build there.)
- `frontend/Dockerfile`: `node:20-alpine`, multi-stage `next build` → standalone.
- `docker-compose.yml`: `backend`(:8000) + `frontend`(:3000) on one network; read-only mounts `./latest_dataset`, `./akn_rlm/data/indices`, `./akn_rlm/eval_results`; `./akn_rlm/.env`; named volume for HF cache + `kg_index.sqlite`; healthchecks with generous `start_period` (≥30 s — `parse_all` + optional KG pre-warm cold start); `frontend.depends_on backend`; generous `mem_limit` (KG live load). `NEXT_PUBLIC_API_BASE` build arg.

## 13. Testing strategy

- **Backend (pytest, offline):** each service against `backend/fixtures/` (2-question benchmark slice + stub `predictions.jsonl`/`metrics.json`, 1 small TTL, 1 AKN XML). `TestClient` contract tests per router. Live-LLM tests `@pytest.mark.live` (skipped by default; no network in CI run).
- **Frontend:** `tsc --noEmit` + ESLint + `next build` must pass each session; Vitest for `lib/` transforms + data components; optional Playwright smoke against a mocked API.
- **Per session:** explicit offline verification commands (curl vs fixtures; page renders with static/mocked data). **Every session must be verifiable with no live LLM.**
- **E2E (S16):** clean-machine `docker-compose up` (empty HF cache) → `/health` green → all 7 pages load offline → one benchmark replay → one live query iff keys present.

---

## 14. Implementation sessions

> Ordering builds shared infra first so a runnable demo exists at each milestone (all 7 pages still delivered). Each session is small, cold-startable from `HANDOFF.md`, and **offline-verifiable**. Split a session if it exceeds one focused sitting (noted where likely).
>
> **Required HANDOFF.md entry (≤1000 tokens), appended at session end:** `## <Sxx> <title> (<date>)` · **Status** done/partial · **What shipped** (files + endpoints/components) · **Contracts/paths touched** · **How to verify** (exact offline commands) · **Gotchas** · **Next session** (id + first concrete step). Keep terse; link code by path.

### S0 — Repo + compose skeleton + HANDOFF bootstrap

- **Goal:** `docker-compose up` serves Next.js shell (:3000) + FastAPI `/api/health` (:8000); seed `HANDOFF.md`.
- **Files:** `docker-compose.yml`, `backend/{Dockerfile,requirements.txt,app/main.py,settings.py}`, `frontend/{Dockerfile,package.json,next.config.js,app/layout.tsx,app/page.tsx + 6 route stubs}`, `.env.example`, `HANDOFF.md`.
- **Output:** health JSON; nav with 7 placeholder routes.
- **Verify:** `curl localhost:8000/api/health`; open each route.
- **HANDOFF:** ports, run commands, dataset env-var names, the §6 contracts pointer.

### S1 — Backend: PipelineService + corpus service + meta/corpus endpoints

- **Goal:** shared singletons + corpus read API.
- **Files:** `services/pipeline.py`, `services/corpus.py`, `routers/corpus.py`, `models/`, `deps.py`; fixtures.
- **Output:** `/meta`, `/corpus/documents`, `/{id}`, `/{id}/xml|text`, `/articles/{doc}/{ref}`, `/corpus/search`.
- **Verify (offline):** pytest fixtures; `documents` → 45; one article returns Arabic text + ancestors.
- **HANDOFF:** PipelineService design, dataset env wiring, Article fields.

### S2 — Backend: benchmark + results services (precomputed)

- **Goal:** serve benchmark joined to predictions; serve metrics.
- **Files:** `services/benchmark.py`, `services/results.py`, `routers/{benchmark,results}.py`, curated `baselines.json`.
- **Output:** `/benchmark/questions`,`/{id}`,`/stats`; `/results/metrics`,`/baselines`,`/runs`,`/classification` (classifier accuracy + confusion from `eval_results/classifier_accuracy_llm_final/`).
- **Verify (offline):** 244 count + per-type; `/{id}` includes gold article **text** + precomputed prediction; metrics `citation_f1≈0.3045`; `/classification` returns 8×8 confusion + accuracy.
- **HANDOFF:** join key `question_id`, prediction + question schemas (§6).

### S3 — Backend: KG index builder + subgraph API

- **Goal:** compact SQLite index + bounded queries. `build_kg_index.py` runs **idempotently at entrypoint/first boot** (skip if `kg_index.sqlite` exists), parsing per-law TTLs — *not* at image build (run-time bind mount).
- **Files:** `scripts/build_kg_index.py`, `services/kg.py`, `routers/kg.py`.
- **Output:** `/kg/meta`,`/subgraph`,`/node/{id}`,`/search`; `kg_index.sqlite`.
- **Verify (offline):** build from fixture TTL(s); subgraph depth=1 bounded ≤ limit; `truncated` honored; meta enumerates real node/edge types.
- **HANDOFF:** SQLite schema, subgraph params, "derive types, don't hardcode."

### S4 — Backend: live answer + SSE + retrieve telemetry + classify + config/reset

- **Goal:** live pipeline + streaming + honest retrieval visualization.
- **Files:** `routers/answer.py`, `services/pipeline.py` (memoized dispatchers, options→kwargs/env), **additive** `retrieve`-step telemetry in `akn_rlm` (flag-guarded; per-channel candidates + fused scores), `models/answer.py`.
- **Output:** `/answer`, `/answer/stream` (SSE), `/classify`, `/pipeline/config`, `/pipeline/reset`.
- **Verify (offline):** stubbed-dispatcher unit tests for SSE framing + options→kwargs map + `/config` catalog + `/reset`; assert telemetry flag doesn't alter dispatched answer; live test `@mark.live`.
- **HANDOFF:** options schema, SSE event names, telemetry-flag name, "no metric drift."

### S5 — Backend: Retrieval Lab endpoint

- **Goal:** real retriever/fusion/rerank comparison (no LLM).
- **Files:** `services/retrieval_lab.py`, `routers/retrieval.py`.
- **Output:** `/retrieval/compare` → per-retriever + RRF(weights) + reranked, scored.
- **Verify (offline):** sample query returns ranked lists; weight change reorders; rerank toggles; uses built indices.
- **HANDOFF:** request/response schema; which retrievers offline-capable (bm25/dense/hybrid/rerank yes; kg optional).

### S6 — Frontend: foundation (layout, nav, theme, API client, RTL)

- **Goal:** design system + typed client.
- **Files:** `app/layout.tsx`, `globals.css`, `tailwind.config.ts`, shadcn init, `lib/{api.ts,types.ts}`, `components/shared/{Nav,ArabicText,CitationChip,MetricCard}`.
- **Output:** nav, theme (light/dark, presenter), RTL Arabic sample, loading/empty/error states.
- **Verify:** `next build` + `tsc`; nav routes; Arabic renders RTL.
- **HANDOFF:** API base, shared component contracts, type locations.

### S7 — Frontend: Architecture page (offline, high-impact)

- **Goal:** clickable, data-driven architecture.
- **Files:** `app/architecture/page.tsx`, `components/architecture/*`, `lib/architecture.ts` (component graph + code paths + metric per node).
- **Output:** clickable nodes → what/inputs/outputs/code-path; animated flow.
- **Verify:** every node opens detail w/ real code paths; matches thesis §3.4.
- **HANDOFF:** content-module shape; node list.

### S8 — Frontend: Results page

- **Goal:** metrics dashboard from `/results`.
- **Files:** `app/results/page.tsx`, `components/results/{MetricCards,PerTypeChart,PhaseChart,BaselineTable,AblationTable,MetricExplainer,ClassificationCard,ConfusionMatrix}`.
- **Output:** headline cards, stratified/per-type, phase A→E, baseline + ablation tables, metric definitions, **classifier accuracy + confusion matrix**.
- **Verify:** values equal `metrics.json`; charts render; locked vs gold-typed labeled; classification card matches `/results/classification`.
- **HANDOFF:** metric field names, baseline-table source.

### S9 — Frontend: Benchmark page

- **Goal:** explorer + gold + precomputed run.
- **Files:** `app/benchmark/page.tsx`, `components/benchmark/{QuestionList,Filters,QuestionDetail,GoldVsPred,TrajectoryMini}`.
- **Output:** filter/search table + per-q hit badge; detail with gold article **text**, reasoning chain, precomputed prediction + diff; live re-run button.
- **Verify (offline):** filters work; gold text shown; gold-vs-pred diff renders from predictions.
- **HANDOFF:** filter params, detail layout, reuse of CitationChip/ArticleCard.

### S10 — Frontend: Main pipeline visualizer (centerpiece; split a/b/c if needed)

- **Goal:** controls + answer + animated trajectory; replay + live.
- **Files:** `app/page.tsx`, `components/pipeline/{ControlPanel,TrajectoryTimeline,StepCard,AnswerPanel,Telemetry,BenchmarkPicker}`, SSE hook.
- **Output:** full control panel (§5), subway-map trajectory w/ play/step, answer (RTL) + citations deep-linking to `/corpus` & `/kg`, telemetry; **Replay** (precomputed) + **Live** (SSE).
- **Verify:** replay animates precomputed trajectory; controls post correct options; live streams when `/health` ok, else graceful.
- **HANDOFF:** control→option mapping, SSE consumption, step rendering.

### S11 — Frontend: Retrieval Lab (panel on Main)

- **Goal:** UI for `/retrieval/compare`.
- **Files:** `components/pipeline/RetrievalLab.tsx`.
- **Output:** retriever multiselect, RRF weight sliders, rerank toggle, k; side-by-side scored lists; gold-hit highlight when seeded from a benchmark query.
- **Verify (offline):** works on indices w/o LLM; weights/rerank visibly change output.
- **HANDOFF:** clarify Lab vs live-path distinction (viva-correctness).

### S12 — Frontend: AKN dataset explorer

- **Goal:** side-by-side text/XML + tree + metadata + search.
- **Files:** `app/corpus/page.tsx`, `components/corpus/{DocList,Filters,XmlTree,ArticleView,MetadataPanel,TextXmlSplit}`.
- **Output:** doc list+filters; synced text⟷XML; eId tree w/ status badges; FRBR metadata; in-doc + cross-corpus search; per-doc summary.
- **Verify:** tree navigates; pane sync; metadata correct; search filters.
- **HANDOFF:** corpus endpoints used, tree-build approach.

### S13 — Frontend: RDF KG explorer

- **Goal:** scalable bounded graph + filters + inspector.
- **Files:** `app/kg/page.tsx`, `components/kg/{GraphCanvas,Filters,NodeInspector,Legend}`.
- **Output:** Cytoscape `fcose`; filters (law/node-type/edge-type/depth/max); lazy expand; inspector w/ corpus link; overview↔drill modes.
- **Verify:** never loads full graph; subgraph bounded; filters reduce; expand works; inspector populated.
- **HANDOFF:** subgraph params, Cytoscape mapping, perf cap.

### S14 — Frontend: About page

- **Goal:** editorial about page.
- **Files:** `app/about/page.tsx`, `lib/about.ts`.
- **Output:** title, motivation, authors, ENSIA, jury, viva date, demo purpose, resources, AI-usage note.
- **Verify:** matches thesis front matter; responsive.
- **HANDOFF:** content source (thesis §Abstract/Ch.1).

### S15 — Live hardening + pre-warm + offline fallback

- **Goal:** robust hybrid behavior.
- **Files:** `app/main.py` (startup pre-warm, `LIVE_TF_CD`), health-gated live buttons, nearest-precomputed fallback, SSE reconnect, toasts.
- **Output:** live works with keys; degrades cleanly offline; no crashes.
- **Verify:** keys → live stream; no keys/APIs → replay fallback; offline never errors.
- **HANDOFF:** health contract, pre-warm flags, fallback rule.

### S16 — Docker finalize + weights pre-bake + E2E + demo seed + polish

- **Goal:** clean-machine, offline, viva-ready.
- **Files:** finalize both Dockerfiles + compose (HF pre-bake, mounts, mem limits, healthchecks), `lib/demoQueries.ts`, root `README.md`.
- **Output:** fresh `docker-compose up` (empty HF cache) serves everything offline; curated demo queries; presenter polish; cross-page QA.
- **Verify (E2E):** clean machine up → `/health` green → 7 pages load offline → benchmark replay → live query iff keys.
- **HANDOFF:** final run instructions, known limits, demo-day checklist.

---

## 15. Risks & mitigations

- **LLM endpoint dead at viva** → offline-complete by design; live gated by `/health`; replay fallback. *(primary mitigation)*
- **74 MB KG RAM/latency** → explorer uses SQLite, not rdflib; live KG (TF/CD) pre-warmed or routed to replay.
- **"Show me re-ranking in your system" (jury)** → Retrieval Lab + honest control map; Architecture page links real code paths.
- **HF weights need internet on first run** → pre-baked into image.
- **`latest_dataset` not auto-discovered** → explicit `AKN_RLM_*` env vars.
- **Cold sessions lose context** → §6 contracts embedded in `plan.md` + each HANDOFF; offline fixtures make every session testable.
- **Metric drift** → render from `metrics.json`; retrieval telemetry additive + flag-guarded.
- **12-day window / all-7 scope** → infra-first ordering keeps a runnable demo at every milestone; S10/S13 are the likely split points.

## 16. Verification (end-to-end)

1. `docker-compose up --build` on a clean machine (empty HF cache, **no** `.env` keys).
2. `curl localhost:8000/api/health` → indices ✓, KG index ✓, llm `unreachable` (expected).
3. Open all 7 pages; confirm offline: Results numbers = `metrics.json`; Benchmark shows gold text + precomputed prediction; Main **replays** a precomputed trajectory; KG explorer returns a bounded subgraph; Corpus shows synced text/XML.
4. Retrieval Lab reorders on weight/rerank change (no LLM).
5. Add valid keys to `akn_rlm/.env`, restart → one **live** free-form query streams via SSE; live button enabled by `/health`.
6. `pytest backend/tests -m "not live"` green; `cd frontend && npm run build` green.
