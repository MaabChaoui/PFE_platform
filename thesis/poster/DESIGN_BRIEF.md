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
  Exports offline through headless Chrome. Fonts = the deck's local woff2 set
  (`assets/fonts/`): Cormorant Garamond (display), EB Garamond (text), IBM Plex Mono
  (tags); Arabic = system Noto Naskh Arabic.
- `print-color-adjust: exact` so the parchment/ink/wine/olive palette survives PDF export.

## Layout (three bands, top→bottom)
```
┌──────────────────────────────────────────────────────────┐
│ MASTHEAD  ENSIA logo · title · students · supervisors      │  ~46mm  dark ink
├───────────────┬──────────────────────┬───────────────────┤
│ 01 · WHY      │ 02 · HOW (solution)   │ 03 · PROOF        │
│ problem stmt  │ Ⅰ Structured corpus   │ 0.305 headline    │
│  + req chips  │   AKN def · stats ·   │ CitF1 bar chart   │
│ 3 AR question │   XML codepane ·      │ JIR bar chart     │  ~340mm
│  bubbles      │   expert validation   │ limits / next     │
│ HCR bar chart │ Ⅱ AlgerianLegalBench  │                   │
│  (per LLM)    │   lead · type bars ·  │                   │
│ hard-case ×4  │   difficulty · traps  │                   │
│ objectives ×4 │ Ⅲ AKN-RLM pipeline    │                   │
│ significance×3│   retrieve→reason     │                   │
│               │   (cycle)→3 gates     │                   │
├───────────────┴──────────────────────┴───────────────────┤
│ TAKEAWAY  [sources]+[retrieval]+[recursion]+[citation] =  │  ~30mm  dark ink
└──────────────────────────────────────────────────────────┘
```

## Center column (v4 "The Solution" — follows the author's sketch)
Three parts on the dark panel, each a roman-numeral header (sage italic Cormorant)
over a paper band:
- **Ⅰ Structured legal corpus** — "What is Akoma Ntoso?" definition (OASIS LegalDocML,
  FRBR article registry); "what we built" stat strip (171 source files / 189 MB ·
  45 laws → AKN XML · 46 RDF graphs → one KG · 1963–2025); a **deck-style codepane on a
  deep-green ground** with a richer AKN sample (FRBRWork + FRBRExpression + lifecycle
  amendment eventRef (law 05-10, 2005) + art_124 with Arabic num/content + ref);
  expert-validation note (two law students + supervising senior legal expert).
- **Ⅱ AlgerianLegalBench** — lead sentence (244 Qs · 23 categories · 177 answerable /
  67 expect abstention · 232 AR / 12 FR · four-step reasoning chain · κ = 0.829);
  query-type mini bar chart (counts from Table 3.2, Unanswerable bar in wine);
  difficulty stack (23/35/42 %) + 40-trap note. The former right-column benchmark
  card was removed (it now lives here).
- **Ⅲ AKN-RLM** — the pipeline compressed to three bands: Retrieve (Q → classifier →
  hybrid RRF), Reason (recursion cycle, compact horizontal), Verify (triple gate →
  answer / abstention). "Structure the law" band retired — part Ⅰ covers it.
Column grid `0.9fr 1.34fr 0.9fr` — the **center is widest** and sits on a **dark ink
panel** (the deck's stage colour, with a hairline sage inner frame) so the 4-zone
architecture is the focal point.

## Left column (v3 "paper style" — follows the author's sketch, LaTeX aesthetic)
The column is a single white **paper sheet** (one hairline border, serif type =
Liberation Serif) with numbered subsections `1.1 → 1.6` separated by thin rules —
a flowing journal-article read, *not* stacked outlined cards:
- **1.1 Fluent is not lawful** — justified problem-statement paragraph opened by a
  wine Cormorant **drop cap** (the cartoon spot illustration was retired in v3 — it
  clashed with the paper-and-ink theme); below it a LaTeX-keywords-style small-caps
  line between hairlines: `sourced · article-cited · jurisdiction-bound ·
  amendment-aware · or refused` (last term wine).
- **1.2 What legal questions demand** — three *verbatim AlgerianLegalBench questions*
  (`civ_ra_q01`, `fam_tf_q01`, `lab_un_q03`) set as **RTL block quotes** in Noto Naskh
  Arabic with a thin colour-coded right rule (teal / orange / red) and an italic
  em-dash annotation: exact articles · law-as-amended · foreign-doctrine trap → abstain.
  Right-aligned italic source note.
- **1.3 Where today's LLMs fail** — **Fig. 1**: HCR per direct-LLM baseline (Table 4.4),
  flat matplotlib-style plot: L-frame axes, 0.25-step gridlines, six flat red bars
  0.492→0.811 ordered by params (3B→70B), dashed divider, flat-green AKN-RLM 0.000.
  Justified italic figure caption carries the Gemini paradox + 6/7 foreign-law stat.
- **1.4 Hard case** — 2×2 em-dash list (Arabic-first 232/244 · layered 1963–2025 ·
  deeply structured · low-resource). No boxes, no icons.
- **1.5 Objectives** — 2×2 borderless check list (structure · benchmark · reason ·
  verify/abstain).
- **1.6 Significance & impact** — numbered contributions list; item 2 ("reusable
  infrastructure") nests **AKN corpus + KG** (171 docs) and **AlgerianLegalBench**
  (244 Qs, κ = 0.829) as sub-entries.

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

## Visual system (v3 — matched to the viva slide deck's paper-and-ink theme)
| Token | Value | Use |
|---|---|---|
| Paper | `#f5f0e4` / `#fbf8ef` / `#efe8d6` | page, cards, chart tracks |
| Dark ink | `#14160f` / `#1c1f15` | masthead, center panel, footer (green-cooled deck stage) |
| Wine | `#6e2433` / `#8d3a4a` | emphasis, 0.305 headline card, failure bars, abstention |
| Olive green | `#38543f` / `#5d7a64` | section numerals, arrows, recursion cycle, verification, answer node |
| Sage | `#a8b89a` | accents/kickers/hairlines on the dark surfaces |
| Ink / Muted | `#1d1810` / `#4d4634` / `#6e6553` | text |
| Hairlines | `#d8cdb4` / `#e6ddc8` | rules, card borders |

- **Type system = the deck's**: Cormorant Garamond for display titles, big numerals and
  italic section numbers; EB Garamond for text (small-caps kickers, italic annotations);
  IBM Plex Mono only for masthead metadata tags. Stat heroes are lining-nums Cormorant.
- **Stage colours encode the pipeline phase**: Structure (sage) → Retrieve (wine) →
  Reason (olive highlight band) → Verify/Answer (olive green); abstention is wine.
- Dark surfaces carry the deck's grain: faint radial sage/wine glows + a `.15mm` sage
  inner hairline frame; paper cards keep the deck's inset-highlight shadow.
- Icons: hand-built inline SVG line icons in outlined paper circles (document, XML,
  graph, magnifier, recursion, shield-check). No raster images except the ENSIA logo.
- Deck motifs reused: the rotated wine **"Abstain" rubber stamp** on the trap question,
  the drop cap, italic olive ordinals, the small-caps keyword line.

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
