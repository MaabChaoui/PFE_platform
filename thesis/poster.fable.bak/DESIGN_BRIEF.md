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
│ MASTHEAD  ENSIA logo · title · students · supervisors      │  ~45mm  navy
├───────────────┬──────────────────────┬───────────────────┤
│ 01 · WHY      │ 02 · HOW (money shot) │ 03 · PROOF        │
│ problem stmt  │ ┌ Structure the law ┐ │ 0.305 headline    │
│  + req chips  │ │ texts→AKN→KG       │ │ CitF1 bar chart   │
│ 3 AR question │ ├ Retrieve evidence ─┤ │ JIR bar chart     │  ~340mm
│  bubbles      │ │ Q→classifier→hybr. │ │ benchmark stats   │
│ HCR bar chart │ ├ Reason recursively ┤ │  + difficulty bar │
│  (per LLM)    │ │  ◉ RETRIEVE→INSPECT│ │ limits / next     │
│ hard-case ×4  │ │    →REASON→REFINE  │ │                   │
│ objectives ×4 │ ├ Verify & answer ───┤ │                   │
│ significance×3│ │ 3 gates → ✓ / abst.│ │                   │
├───────────────┴──────────────────────┴───────────────────┤
│ TAKEAWAY  [sources]+[retrieval]+[recursion]+[citation] =  │  ~30mm  navy
└──────────────────────────────────────────────────────────┘
```
Column grid `0.9fr 1.34fr 0.9fr` — the **center is widest** and sits on a **navy panel**
(with a faint pipeline watermark) so the 4-zone architecture is the focal point.

## Left column (v3 — follows the author's sketch)
Order: **problem statement → examples → LLM failure → hard case → objectives → significance.**
- **Problem statement**: "fluent ≠ correct" + five requirement chips
  (sourced / article-cited / jurisdiction-bound / amendment-aware / **— or refused** in red).
- **Examples** = three **RTL Arabic speech bubbles** containing *verbatim AlgerianLegalBench
  questions* (`civ_ra_q01`, `fam_tf_q01`, `lab_un_q03`), each with an English "demand" footer:
  exact articles (teal) · law-as-amended (orange) · foreign-doctrine trap → abstain (red).
  Arabic set in **Noto Naskh Arabic** (installed); bubbles have CSS tails.
- **Failure of LLMs** = vertical **Hallucinated-Citation-Rate bar chart** straight from
  Table 4.4: six red bars 0.492→0.811 ordered by params (3B→70B, rising = "scale doesn't
  fix law") + green AKN-RLM 0.000 on a green band. Caption notes the Gemini paradox
  (0.008 by declining to cite) and 6/7 importing foreign law on >12/40 traps.
- **Objectives** = 2×2 green check-cards (structure · benchmark · reason · verify/abstain);
  **Significance** = 3 icon rows (first citation-faithful QA for DZ law · reusable
  infrastructure · evidence control beats scale). The v2 capability-gap table and the six
  risk tiles were retired — the bubbles + chart now carry that argument visually.

## Why this structure (v2)
- **WHY → HOW → PROOF.** Coloured column badges (red/orange/green) make the 30-second read
  explicit: the stakes, the system, the evidence.
- **Center = a real architecture, four banded zones**, not stacked boxes:
  *Structure the law → Retrieve evidence → Reason recursively → Verify & answer*. Each zone
  is a grouped band with a horizontal mini-flow of icon nodes + arrows. The **recursion zone
  is a circular cycle** (Retrieve→Inspect→Reason→Refine around a Gap-probe hub) that flex-grows
  to dominate — the explicit "iteration", visually set apart from the linear zones.
- **Right column = the proof, made visceral.** A giant `0.305` headline plus **two** charts:
  Citation-F1 vs baselines, and a "lower = safer" **JIR** chart (AKN-RLM 0.000 vs baselines).
- **Left column = the stakes, all visual.** Icon risk-tiles + a Generic-LLM ✗ / AKN-RLM ✓
  **capability-gap table** that states the research gap without a paragraph.

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
