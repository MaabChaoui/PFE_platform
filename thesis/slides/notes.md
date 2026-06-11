
**## Introduction —

* Opening hook: The case Mata v. Avianca showed that generative AI can fabricate legal citations and still sound convincing \thcite{Mata2023}.
* Main problem: In law, fluency is not enough. A legal AI answer must be supported by a real legal source, a correct article, and a valid citation.
* Why this matters: A hallucinated citation is not a small factual mistake; it breaks the legal justification chain.
* Research gap: Existing legal AI benchmarks such as LexGLUE, LegalBench, and COLIEE advanced legal NLP, but they mostly focus on English or well-resourced legal systems \thcite{Chalkidis2022,Guha2023,Goebel2024}.
* Arabic legal AI is emerging, with resources such as ArabLegalEval and AraLegal-BERT, but national citation-controlled reasoning for Algerian law remains underexplored \thcite{Hijazi2024,ALQurishi2022}.
* Algerian law is challenging because it combines Arabic statutory texts, French civil-law influence, Islamic legal concepts, and complex legal document structures.
* Core thesis claim: Reliable legal AI in Algeria is not only a model problem; it is an infrastructure problem.
* Why PDFs are not enough: Legal AI needs structured articles, stable identifiers, hierarchy, cross-references, amendment relations, and temporal metadata.
* Proposed direction: The thesis builds a citation-controlled architecture using structured legal documents, Retrieval-Augmented Generation, Knowledge Graphs, recursive orchestration, and faithfulness verification.
* Akoma Ntoso role: Akoma Ntoso provides a structured XML format for representing legal documents, their hierarchy, metadata, and references \thcite{OASIS2018}.
* RAG role: Retrieval-Augmented Generation helps ground the answer in retrieved legal evidence instead of relying only on model memory \thcite{Louis2023}.
* KG role: The Knowledge Graph represents legal relations such as references, amendments, hierarchy, and temporal dependencies.
* Argument structure role: Argument-aware evidence organization improves inspectability and makes the reasoning easier to verify, following the broader tradition of argument analysis \thcite{Toulmin1958}.
* Faithfulness role: The triple faithfulness gate checks citation existence, jurisdictional discipline, and claim-level support before accepting an answer.
* Scope: The thesis does not claim to give official legal advice or cover all Algerian law. It evaluates a controlled but realistic subset of Algerian positive law.
* Main takeaway: The goal is not to make a chatbot that sounds legal, but to build a system whose answers remain anchored in verifiable Algerian legal sources.

## Chapter 1 —

Slide 4: (main problem, focus on these more than the outline and title pages)

* Legal AI is difficult because legal meaning is not only linguistic; it is structured, interdependent, and time-sensitive.
* Legal structure is an advantage when it is machine-readable, but a problem when it remains hidden inside PDFs or publication-oriented documents.
* A legal answer must not only be fluent; it must cite the correct authority and preserve the legal reasoning chain.
* Legal provisions depend on hierarchy, definitions, exceptions, cross-references, and amendments.

Slide 5: (algerian context)

* Algerian law is challenging because it combines Arabic and French legal language, civil-law influence, Islamic legal concepts, and under-digitized legal sources.
* Existing legal AI work is mostly concentrated on English and well-resourced jurisdictions \thcite{Ariai2024,Kucuk2025}.
* Algerian legal AI requires infrastructure first: structured corpus, article identifiers, legal links, amendment metadata, and evaluation benchmarks \thcite{HamoudaSidhoum2024}.
* The Algerian context is not just an application case; it is a stress test for Legal AI in low-resource, bilingual, and structurally complex environments.

Slide 6: (hallucinations and citations)

* Legal hallucination is a major risk because the system can invent legal claims, citations, or authorities while sounding confident \thcite{Mata2023,Ji2023}.
* The problem is not only factual correctness; in law, hallucination becomes a legal-validity problem.
* The case of \textit{Mata v. Avianca} shows that fabricated AI-generated legal citations can enter real legal submissions \thcite{Mata2023}.
* Attribution is essential: a legal answer must show which source supports which claim \thcite{Rashkin2023}.
* Citation-aware generation is improving, but citations do not automatically guarantee legal justification \thcite{Zhang2025}.

Slide 7: (whatever)

* Retrieval helps, but retrieving a relevant passage is not enough if the system misses an exception, definition, amendment, or related article.
* BM25 is useful for exact legal terms and article numbers \thcite{Robertson2009}; dense retrieval helps with vocabulary mismatch \thcite{Karpukhin2020}.
* Hybrid retrieval improves recall, but legal sufficiency still requires structural and temporal checking.
* Knowledge Graphs are useful because law is naturally relational: provisions cite, modify, define, limit, or depend on other provisions.
* Legal reasoning requires several steps: finding the rule, resolving definitions, checking exceptions, following references, and verifying the applicable version.

Slide 8: (arabic NLP, feels a bit awkwardly positioned, restructure if needed)

* Arabic legal AI is emerging, but still less developed than English legal AI \thcite{Hijazi2024,ALQurishi2022,AbuShairah2025}.
* Arabic legal NLP is a cross-cutting constraint across the whole architecture.
* Arabic morphology, tokenisation, orthographic variation, and Arabic/French code-switching affect retrieval and generation quality.
* AraLegal-BERT is the most relevant Arabic legal encoder, but its Algerian coverage remains limited \thcite{ALQurishi2022}.
* AraBERT, CAMeLBERT, Jais, XLM-R, and CamemBERT each serve different roles in Arabic, French, bilingual, or generative stages \thcite{Antoun2020,Inoue2021,Sengupta2023,Conneau2020,Martin2020}.
* Main takeaway: the proposed framework is not a generic RAG system; it is a layered legal reasoning architecture.

Slide 9: (Gaps)

* The chapter identifies six main gaps: structured Algerian corpus, temporal legal KG, recursive orchestration, Algerian benchmark, argument-aware evidence structuring, and unified citation-faithful architecture.
* The thesis contribution is both contextual and methodological: it addresses Algerian legal AI while proposing a general framework for low-resource legal reasoning.
* Main takeaway: reliable Legal AI requires more than stronger models; it requires structured legal infrastructure, grounded retrieval, graph-based relations, recursive reasoning, and faithfulness verification.

## Chapter 2 —

* Chapter 2 explains the technical foundations needed to build citation-faithful Legal AI.
* The chapter argues that the system must be layered, not based on one single technique.

Slide 10: (AKN Corpus):

* First pillar: the legal corpus must be transformed from PDFs or text into structured legal objects.
* In Algerian law, corpus structuring is a precondition, not just preprocessing.
* Legal PDFs are readable by humans, but they hide article boundaries, hierarchy, references, and amendment history.
* Akoma Ntoso provides a machine-readable legal document model for hierarchy, metadata, references, and temporal information \thcite{OASIS2018}.
* Structured corpus construction is necessary before retrieval, graph construction, citation checking, or evaluation.
* Algerian legal AI cannot rely only on available documents; it needs identifiable articles, stable IDs, references, and expert validation.
* The Algerian legal corpus problem is confirmed by work on Algerian Official Journal knowledge graphs \thcite{HamoudaSidhoum2024}.

**	**Slide 11: Information retrieval

* Information Retrieval is the evidence-access layer of the framework.
* BM25 is useful because legal queries often contain exact identifiers such as article numbers, law numbers, dates, and institutional names \thcite{Robertson2009}.
* Dense retrieval is useful because users may ask questions using lay language, paraphrases, or mixed Arabic/French expressions \thcite{Karpukhin2020}.
* Hybrid retrieval is needed because sparse and dense methods fail in different ways.
* RAG grounds generation in retrieved documents instead of relying only on model memory \thcite{Lewis2021}.
* However, RAG alone is not legal reasoning.
* RAG can retrieve relevant passages, but it does not guarantee article correctness, legal completeness, temporal validity, or claim-level support.
* Self-RAG, Corrective RAG, and Speculative RAG show the importance of verification and correction in grounded generation \thcite{Asai2023,Yan2024,Wang2025}.

Slide 12: KG

* Legal Knowledge Graphs are needed because law is relational.
* A legal KG represents links such as definitions, citations, amendments, hierarchy, and version relations.
* GraphRAG is useful because graph relations can guide evidence expansion instead of relying only on text similarity \thcite{Edge2025}.
* Temporality remains a major challenge in legal KGs because law changes over time \thcite{Kucuk2025}.

**	**Slide 13: Argument Mining

* Argument-aware evidence structuring helps separate legal claims, legal bases, conditions, exceptions, and support relations.
* ADU-inspired triplets make the evidence easier to inspect before final answer generation.
* Toulmin, Walton, and ASPIC+ support the idea that legal reasoning should expose claims, grounds, warrants, exceptions, and defeasible relations \thcite{Toulmin1958,Walton2008,Modgil2014}.

---

Slide 13: RLM

* Recursive Language Models provide the orchestration layer.
* RLMs allow the system to decompose the question, inspect evidence, call retrieval, traverse the graph, verify support, and revise the reasoning path \thcite{Zhang2025rlm}.
* The RLM layer is not an autonomous legal judge; it is a bounded controller over deterministic legal infrastructure.
* Recursive Language Models are relevant because they allow the system to inspect, decompose, revisit, and verify evidence before final generation \thcite{Zhang2025rlm}.

Slide 14: pillars conclusion (or a better title)

* Final defense message: each layer reduces a specific risk: corpus structuring gives legal identity, retrieval gives evidence, KG gives relations, RLM gives control, ADU structuring gives inspectability, and Arabic NLP gives linguistic reliability.

## Chapter 3 —

* Chapter 3 explains how the theoretical pillars become a concrete system.

Slide 15:

* The system is presented as a layered architecture, not a simple RAG pipeline.
* The input is an Arabic or French legal question.
* The output is either a citation-faithful Algerian legal answer or a safe abstention.
* The data layer converts official JORADP legal texts into Akoma Ntoso XML and RDF graph data.
* Akoma Ntoso gives the system stable legal units: documents, articles, hierarchy, references, and metadata \thcite{OASIS2018}.
* The legal knowledge graph represents references, amendments, article ancestry, and temporal relations.
* The graph is derived from the structured corpus, not manually invented.
* The article registry creates a hard boundary: the system cannot accept citations that do not exist in the registered corpus.
* AlgerianLegalBench is the evaluation layer of the thesis.
* The benchmark contains 244 questions across legal categories, query types, difficulty levels, languages, and answerability regimes.
* The benchmark evaluates more than answers: it evaluates retrieval, citations, faithfulness, abstention, and reasoning chains.

Slide 16:

* The system uses typed handlers instead of one generic pipeline.
* Each query is routed according to its type: exact article, rule application, temporal, multi-hop, long context, layman, conceptual, or unanswerable.
* The architecture is deterministic outside and generative inside.
* Deterministic components handle citation existence, corpus boundaries, article registry, and graph traversal.
* LLMs are used only for flexible tasks: classification, decomposition, verification, summarization, ADU extraction, and synthesis.
* Hybrid retrieval combines BM25, dense retrieval, and HyDE.
* BM25 helps with exact legal identifiers \thcite{Robertson2009}.
* Dense retrieval helps with paraphrases and semantic mismatch \thcite{Karpukhin2020}.
* HyDE helps bridge underspecified user queries and formal legal language \thcite{Gao2023b}.
* RRF combines retrieval channels without requiring the same score scale \thcite{Cormack2009}.
* RLM-based orchestration controls decomposition, evidence inspection, gap probing, and bounded revision \thcite{Zhang2025rlm}.
* The triple faithfulness gate checks citation existence, jurisdictional faithfulness, and claim-level support.
* Claim-level support is checked using multilingual NLI.
* If the answer fails support verification, the system gets one corrective regeneration attempt.
* If verification still fails, the system abstains.
* Argument-aware evidence structuring turns cited provisions into claim, ground, warrant, rebuttal, and backing units.
* This supports both explanation and faithfulness checking.

Slide 17:

* The evaluation uses retrieval metrics, citation metrics, generation metrics, faithfulness metrics, abstention metrics, and RLM telemetry.
* nDCG, BLEU, ROUGE, BERTScore, Kendall’s tau, and other metrics are cited to ground the evaluation methodology \thcite{Jarvelin2002,Papineni2002,Lin2004,Zhang2020BERTScore,Kendall1938}.
* The methodology includes threats to validity: annotation ambiguity, benchmark size, corpus snapshot limits, scope restriction, and metric limitations.
* Main takeaway: Chapter 3 shows that the proposed system is engineered for legal reliability through structure, routing, retrieval, graph traversal, bounded recursion, and faithfulness verification.

## Chapter 4 —

(do what you will with this chapter)Slide

* Chapter 4 reports the empirical results of our framework, AKN-RLM.
* AKN-RLM is evaluated on AlgerianLegalBench with 244 legal questions.
* The goal is not only answer quality, but citation-faithful legal reasoning.
* The main headline metric is article-level Citation F1.
* AKN-RLM reaches Article Citation F1 = 0.3045.
* Document-level Citation F1 reaches 0.5460.
* The system reaches hallucinated-citation rate = 0.0000.
* The system reaches jurisdictional-infection rate = 0.0000.
* This means emitted citations are registry-valid and no foreign-law contamination was detected.
* AKN-RLM outperforms the strongest closed-corpus baseline, Hybrid+Rerank, by +0.1993 Citation F1.
* The improvement over Hybrid+Rerank is statistically significant with (p_{\mathrm{Holm}}<0.0001).
* The result shows that the gain is not only from retrieval, but from the full architecture.
* Direct LLM baselines often produce fluent answers but weak article-level citations.
* Raw LLMs also show high hallucinated-citation rates, confirming the risk of direct generation.
* This supports the claim that legal AI needs grounding and verification, not only larger models \thcite{BlairStanek2025}.
* Gemini has relatively low hallucination but often avoids citing articles.
* Aya shows a document-level/article-level gap: it may identify the right law but cite the wrong article.
* This justifies using article-level Citation F1 instead of only document-level metrics.
* Tier-2 baselines use the same corpus, so the comparison isolates the value of the architecture.
* Minimal RAG improves over raw LLMs, but still remains below AKN-RLM.
* This supports the idea that RAG is necessary but not sufficient for legal reasoning \thcite{Lewis2021,Asai2023,Yan2024}.
* The phase progression shows that the largest gain comes from typed-handler dispatch.
* Later phases improve stability, abstention, and telemetry more than they create a large Citation F1 jump.
* Phase A establishes the direct LLM/RAG floor.
* Phase B adds typed-handler dispatch.
* Phase C adds pervasive ADU evidence structuring.
* Phase D adds gap-driven recursion and corrective retry.
* Phase E locks the final deployable configuration.
* The ablations show that the jurisdiction gate is important for abstention routing.
* Removing the jurisdiction gate lowers abstention recall on negative-answerability cases.
* The faithfulness gate helps rule-application and multi-hop questions, but may be too restrictive for layman-language queries.
* MultiQuery improves retrieval metrics slightly but lowers final Citation F1.
* This shows that adding more candidates does not automatically improve legal citation quality.
* The French-translated benchmark reveals cross-lingual fragility.
* The current deployment is Arabic-primary, not yet a robust bilingual legal assistant.
* Per-query analysis shows strongest performance on exact-article and unanswerable questions.
* Multi-hop, long-context, and French queries remain the hardest slices.
* The main bottleneck is article-level retrieval.
* The gold article appears in the top-ten article candidates on only about one quarter of queries.
* Abstention is one of the strongest behaviours of the system.
* The system abstains correctly on 38 of 40 jurisdictional-infection questions.
* This supports the thesis claim that refusal is a legal safety behaviour, not a failure.
* The qualitative examples show four behaviours: clean success, partial multi-hop failure, temporal-recursive reasoning, and principled abstention.
* The discussion concludes that structural heterogeneity matters more than parametric scale.
* Main takeaway: AKN-RLM improves legal reliability because it combines structured corpus, retrieval, KG, typed handlers, RLM orchestration, ADU evidence, and faithfulness gates.

**
