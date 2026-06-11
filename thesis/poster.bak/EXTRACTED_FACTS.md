# EXTRACTED_FACTS.md — AKN-RLM Thesis Poster

Source of truth: `../Thesis.txt` (376 KB, 7712 lines). Every fact below carries a
line reference and short quote so it can be re-verified. **No number appears on the
poster unless it appears here.** Unresolved items are marked `TODO_CONFIRM`.

---

## 1. Thesis title
> "Advancing Legal Reasoning in Algerian Law: Integrating RAG, Knowledge Graphs, and Argument Mining for Citation-Faithful Legal Reasoning" — lines 18–21, restated 54–56.

## 2. Student names
- **Ibrahim El Khalil ATTIA** and **Maab CHAOUI** — lines 10–14 ("By: Ibrahim El Khalil ATTIA … & … Maab CHAOUI").

## 3. Supervisor / advisor names + jury
Names (l.28–31) and roles (l.42–48) are listed in *separate* blocks; the correct pairing is:
- **Wahid CHAMI** — MCA, ENSIA, Algeria — **President**
- **Fouad DAHAK** — MCA, ENSIA, Algeria — **Supervisor**
- **Ivan CANTADOR** — Professor, U. Autónoma (Madrid), Spain — **Co-supervisor**
- **Mohamed BRAHIMI** — MCA, ENSIA, Algeria — **Examiner**

> Cross-check: Author's Declaration says "accepted by my examiners"; abstract confirms supervision structure. Header shows **Supervisor: Fouad Dahak**, **Co-supervisor: Ivan Cantador**.

## Institution / programme (header)
- The National School of Artificial Intelligence (**ENSIA**) — line 3.
- Department of Intelligent Systems Engineering — line 6.
- Degree: **Engineer in Artificial Intelligence and Data Science** — lines 7–8.
- Defended publicly **13/06/2026** — line 22.
- Project code **FYP/2025/135** — line 50.

## 4. Main research problem
> "Large Language Models remain unreliable for low-resource, non-English legal systems. Legal answers cannot be judged by fluency or plausibility alone: they must be grounded in identifiable sources, supported by valid article-level citations, bounded by the correct jurisdiction, sensitive to legal structure and temporality, and able to abstain when the corpus does not justify an answer." — lines 105–110.
> "Algerian law is a particularly demanding case — predominantly Arabic, historically layered, structurally complex, and markedly underrepresented in existing legal-AI resources." — lines 110–111.
- Diagnosed failure modes: hallucination, attribution gap, retrieval insufficiency, multi-hop fragility, domain/language shift — lines 574, 1022, 1036–1039.

## 5. Main objective
> "This thesis introduces AKN-RLM, an architecture for citation-faithful legal reasoning in Algerian law that integrates Retrieval-Augmented Generation, Akoma Ntoso legal-document structuring, a Legal Knowledge Graph, Toulmin-based Argument Mining, and bounded Recursive Language Model orchestration behind a triple faithfulness gate enforcing citation existence, jurisdictional discipline, and claim-level support." — lines 112–115.
- Central question — lines 7320–7321.

## 6. Core contributions (three)
1. **Structured Algerian legal corpus** — 171 files, 189.46 MB, 1963–2025 — lines 7329–7336.
2. **AlgerianLegalBench** benchmark — 244 questions, 23 categories, 8 query types — lines 7337–7349.
3. **AKN-RLM architecture** — typed query handling, hybrid retrieval, KG traversal, bounded recursion, Toulmin ADU, triple faithfulness gate — lines 7350–7356.

## 7. Dataset / corpus statistics
- **171 files**, total **189.46 MB** — lines 2383–2384, 7330.
- Composition: **35** source PDF, **45** plain-text, **45** Akoma Ntoso XML, **46** RDF/Turtle (incl. **1** consolidated KG, `algerian_legal_kg.ttl`) — lines 2384–2386, 7331.
- Temporal span **1963–2025** — line 2387.
- Only **35** entries have full TXT–PDF–XML–RDF coverage — lines 2413–2415.
- Coverage: Civil, Family, Commercial, Penal codes; 2025 Code of Criminal Procedure; 2020 constitution; sectoral statutes; amending instruments — lines 2433–2438.
- Canonical identity via **FRBR metadata + registry alias layer**; "no citation can be treated as legally valid unless it resolves to a registered document and article" — lines 2440–2459.
- KG roles: corpus boundary, amendment-aware temporal versioning, typed cross-references; example = Family Code **Art. 54** + 2005 reform (Order 05-02) — lines 2486–2544.

## 8. Benchmark statistics (AlgerianLegalBench)
- **244 questions · 23 legal categories · 8 query types** — line 2643.
- Query-type counts (Table 3.2, l.2649–2677): Rule application **66**, Exact article **59**, Unanswerable **40**, Multi-hop **26**, Layman **17**, Long-context **17**, Conceptual-definitional **12**, Temporal-factual **7**.
- Difficulty (Table 3.3, l.2679–2701): Easy **56** (23.0%), Medium **85** (34.8%), Hard **103** (42.2%).
- Language: **232 Arabic**, **12 French** — line 2703.
- Answerability: **177 answerable**, **67 unanswerable** — line 2708.
- **40** jurisdictional-infection traps (canary sources: French, US, Egyptian, Tunisian, Gulf) — lines 121–122, 3215–3220, 6103–6104.
- Expected articles/question: min **0**, max **15**, mean **1.816**; **30** items with zero — line 2717.
- Inter-annotator agreement **Cohen's κ = 0.829** — line 4031.
- Cross-annotation protocol w/ senior-legal-expert resolution — lines 2579–2587.

## 9. System architecture components
- **Akoma Ntoso XML structuring** — article-level segmentation, stable IDs, FRBR registry — lines 2425–2432.
- **Legal Knowledge Graph (RDF/Turtle)** — amendment chains, temporal versioning, typed cross-references — lines 2473–2559.
- **Hybrid retrieval** — three channels fused by **Reciprocal Rank Fusion (RRF)** (BM25 + dense) — line 3178; CLAUDE.md confirms handlers RRF BM25+Dense.
- **Query classifier → typed-handler dispatcher** over the **8 query types**; classifier backbone **gemma-4-31B** — lines 2978, 3009, 3130–3143.
- **Five primitive families**: retrieval, knowledge-graph, article-operations, recursive-call, verification — lines 3178–3220.
- **Bounded Recursive Language Model (RLM)** orchestration — gap-probe recursion, depth-limited; controller **gpt-oss-120b**, sub-models **Qwen3-30B-A3B-Thinking** + **gemma-4-31B** — lines 3211–3214, 3273–3278, 6155.
- **Toulmin-based Argument Mining** — pervasive ADU extraction on every cited article — lines 113, 3351, 4368.
- **Triple faithfulness gate** — (1) citation existence vs registry; (2) jurisdictional faithfulness via canary detection; (3) claim-level support via **multilingual NLI**; then **one corrective regeneration step**, else **abstain** — lines 2982, 3309, 7350–7356.
- **Darja→MSA rewriter** for layman queries — line 3407.

## 10. Evaluation metrics
- Retrieval: **Recall@k** (k∈{1,3,5,10,20,50}), **Precision@k**, **MRR@10/50**, **nDCG@5/10/20** — lines 3505–3550, 3815–3817.
- Citation: **Citation Precision / Recall / F1** (+ document-level Doc Cite F1) — lines 3591–3601.
- Faithfulness: **Hallucinated-Citation Rate (HCR)**, **Jurisdictional-Infection Rate (JIR)**, **Argument-Mining Faithfulness (AMF)** — lines 3663–3690, 4227.
- Abstention: **Abstention Precision / Recall / F1** — lines 3740–3779.
- RLM runtime telemetry: latency, recursion depth — lines 3784–3789.

## 11. Final results (frozen 244-question locked deployable run)
Headline — `rlm_dispatched_full_phase_e_final`:
- **Citation F1 = 0.305** (locked, classifier-typed deployable; gold-typed oracle = 0.313) — lines 4259–4264, 7357.
- **HCR = 0.000**, **JIR = 0.000** — line 4260.
- **Abstention F1 = 0.703** (40 infection traps as positive class) — line 4260.
- **Argument-Mining Faithfulness = 0.471** — lines 6196, 7360.
- Article **MRR = 0.310**, **Recall@10 = 0.258**, **Citation recall = 0.260** — lines 6053–6055.
- Latency ≈ **9.7 s** (Table 4.2) — line 4336.
- Improves Citation F1 by **1.64×** (vs strongest direct-LLM), **2.9×** (vs strongest deterministic retrieval), **1.74×** (vs strongest minimal-RAG) — lines 125–126, 4338–4339, 7361–7363.
- **Only compared system capable of principled abstention** — line 126.

**Citation-F1 bar-chart values (Table 4.2, CitF1 column — each value re-confirmed by the narrative multipliers):**
| System | CitF1 | source |
|---|---|---|
| gpt-oss-120b raw (no retrieval) | **0.056** | l.4293; floor, l.4377 |
| Hybrid + cross-encoder rerank (best deterministic) | **0.105** | 0.305 / 2.9 ✓ l.4338 |
| gpt-oss-120b + dense top-5 (minimal RAG) | **0.175** | 0.305 / 1.74 ✓ l.4339; also l.4378 |
| Gemini 2.5 Flash (strongest direct LLM) | **0.186**, JIR **0.375** | 0.305 / 1.64 ✓; JIR l.4351, 6107 |
| **AKN-RLM (locked; classifier-typed)** | **0.305** | l.4328, 4260 |

Faithfulness contrast (narrative-anchored, safe):
- Gemini 2.5 Flash imports foreign law on **15 of 40** traps (JIR 0.375) — lines 4351, 6107.
- Six of seven direct-LLM baselines fall into >12 traps; **Qwen 2 → 27 traps (JIR 0.675)** — line 6106.
- "Reliability tracks legal structure, not parametric scale: the 70B baseline is among the most hallucination-prone, while AKN-RLM leads with a smaller controller." — lines 126–127.
- ⚠️ Per-baseline HCR/JIR matrix in Table 4.2 was OCR-interleaved in the raw text; poster shows **only** the narrative-anchored cells above.

## 12. Limitations
- **Retrieval ceiling** — article Recall@10 stays **< 0.30 (0.258)**; gold article reaches top-10 on **only ~¼ of queries** → "the main barrier … is not only algorithmic but infrastructural" — lines 128–130, 6053–6055, 7374–7380.
- **French under-served** — CitF1 −0.100, article MRR −0.176, Recall@10 −0.160 on French; "Arabic-primary … not robustly cross-lingual" — lines 6168–6172, 7380–7381.
- **Abstention precision imperfect** — 0.654 vs recall 0.761; abstains on some answerable items — lines 6123–6124, 7381–7383.
- **Jurisdiction-gate contamination caveat** — canary list drawn from the same 40 traps used in eval — lines 4045–4052, 7383–7384.
- **Metrics are proxies** — LLM-as-judge (32-q sample), not human expert review — lines 6180–6185, 7384–7385.
- Endpoint non-determinism ±0.02 CitF1; no snapshot pinning — lines 6145–6160.
- Generic KG-CONTAINS channels disabled (regress on this corpus) — lines 6161–6167.

## 13. Future work
1. Corpus-tuned dense embedder, richer hybrid retrieval, robust article ranking — lines 7393–7395.
2. Expand French coverage (align French↔Arabic, parallel corpus) — lines 7396–7398.
3. Redesign graph-retrieval interface so KG relations feed candidate selection — lines 7399–7401.
4. Run no-jurisdiction-gate / no-NLI-gate ablations; independent JIR detector — lines 7402–7403, 6127–6129.
5. Complement automated metrics with expert legal review — lines 7404–7405.

## Takeaway sentence (verbatim anchors)
> "trustworthy legal AI must be built as an evidence-controlled system rather than as an unconstrained generator." — lines 7421–7422.
> "reliable legal AI for Algerian law requires more than larger language models. It requires better legal infrastructure: structured legal data, article-level retrieval, explicit legal relations, controlled recursive reasoning, argument-aware evidence organization, and strict faithfulness verification." — lines 7406–7409.

---

### TODO_CONFIRM
- **ENSIA logo asset** — none in repo; poster uses a CSS wordmark placeholder. Drop a real `assets/ensia_logo.png` to replace it (optional). See `IMAGE_REQUESTS.md`.
- Jury academic titles (President/Examiner) shown only as Supervisor + Co-supervisor on the poster header to save space — full jury list is in this file if you want all four printed.
