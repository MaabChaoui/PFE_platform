# DESIGN_BRIEF.md — AKN-RLM Thesis Poster

## Narrative (one line)
> Building citation-faithful Legal AI for Algerian law: from raw legal documents to
> structured AKN legal knowledge, retrieval, recursive reasoning, and verifiable,
> citation-grounded answers.

The poster reads as an **infographic**, not a compressed paper. A viewer should grasp
the *problem* in under 30 seconds (left), follow the *pipeline* as the visual centerpiece
(center), and see the *strongest verified result* (right). One A3 portrait page, fixed grid.

## Format
- **A3 portrait, 297 mm × 420 mm**, `@page { size: A3 portrait; margin: 0 }`.
- Fixed-box layout: root is exactly `297mm × 420mm`, `overflow:hidden` — content is sized
  to the box (no flowing), which guarantees single-page export.
- Dependency-free: pure HTML + CSS + inline SVG. No JS, no React/Recharts/Cytoscape.
  Exports offline through headless Chrome. Font = Liberation Sans (installed Helvetica clone).
- `print-color-adjust: exact` so the navy/orange/green palette survives PDF export.

## Layout (three bands, top→bottom)
```
┌──────────────────────────────────────────────────────────┐
│ MASTHEAD  ENSIA · title · students · supervisors · 13/06  │  ~50mm  navy
├───────────────┬──────────────────────┬───────────────────┤
│ 01 CONTEXT    │ 02 METHODOLOGY        │ 03 EVALUATION     │
│ (left)        │ (center — money shot) │ (right)           │
│ problem       │  ┌─ Raw legal texts   │ benchmark badges  │
│ why LLMs risk │  ▼  AKN XML corpus    │ 0.305 hero        │  ~338mm
│ Algerian law  │  ▼  Knowledge graph   │ CitF1 bar chart   │
│ research gap  │  ▼  Hybrid retrieval  │ multiplier badges │
│ objective     │  ▼  Typed dispatch    │ faithfulness card │
│ two resources │  ▼  Recursive reason  │ limitations       │
│               │  ▼  Faithfulness gate │ future work       │
│               │  ▼  Verifiable answer │                   │
├───────────────┴──────────────────────┴───────────────────┤
│ TAKEAWAY  evidence-controlled system, not a generator     │  ~32mm  navy
└──────────────────────────────────────────────────────────┘
```
Column grid `1fr 1.18fr 1fr` — the **center is widest** and sits on a **navy panel** so the
vertical 8-stage pipeline is unmistakably the focal point. Left/right are light cards.

## Why this structure
- **Vertical pipeline ↔ portrait format.** A3 portrait is tall; an 8-node top-to-bottom
  pipeline uses that height instead of fighting it. Each node doubles as a *method card*
  (icon + title + one-line descriptor), covering the six requested concepts (AKN corpus,
  benchmark, KG, RAG, recursive LM, citation faithfulness) inside the flow.
- **Right column = the proof.** A single dominant `0.305` hero + a 5-bar Citation-F1 chart
  where AKN-RLM towers over every baseline. The cleanest, best-supported numbers only.
- **Left column = the stakes.** Failure-mode chips (hallucination, foreign-law contamination,
  no abstention) make "why this is hard" legible at a glance.

## Visual system
| Token | Value | Use |
|---|---|---|
| Navy | `#0f2c52` / grad `#0b2240→#15396b` | masthead, center panel, footer, headings |
| Orange | `#ee8136` | accent rules, AKN-RLM result, retrieval stages |
| Green | `#2e9e6e` | verification / "0.000" / answer node |
| Teal | `#1f8a8a` | knowledge-graph stage |
| Light gray | `#eef1f5` | page background |
| Card | `#ffffff` | left/right cards |
| Ink / Muted | `#16202e` / `#5d6b7c` | text |

- **Stage colours encode the pipeline phase**: Structure (navy/teal) → Retrieve/Reason
  (orange) → Verify/Answer (green). The eye learns the legal-AI story from colour alone.
- Type scale: title ~30pt, section numbers in orange circles, card titles ~10.5pt,
  body ~8.5pt, stat heroes 26–40pt. Distance-readable; minimal prose, chips over paragraphs.
- Icons: hand-built inline SVG line icons (document, XML, graph, magnifier, branch, recursion,
  shield-check, scales). No raster images, no emojis, no clutter.

## Honesty / accuracy rules baked into the design
- Every printed number is in `EXTRACTED_FACTS.md` with a line reference.
- Headline is the **locked deployable 0.305**, never the 0.313 oracle.
- Faithfulness shows only narrative-anchored cells (AKN-RLM 0.000 vs Gemini JIR 0.375);
  the OCR-scrambled per-baseline HCR/JIR matrix is **not** reproduced.
- "RRF fusion / re-ranking" honesty (per project CLAUDE.md): retrieval node says
  *BM25 + Dense, RRF*; the cross-encoder rerank appears only as a **baseline** in the chart.

## Build / regenerate
`python3 build_poster.py` → renders `index.html` via headless Chrome to `poster.pdf`
(A3, 1 page) and `poster_preview.png`. QC asserts `Pages: 1` and A3 page size.
