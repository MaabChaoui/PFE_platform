# POSTER_REVIEW.md — AKN-RLM thesis poster

Quality-control record for the A3 infographic in `./thesis/poster/`.

## Deliverables
| File | Purpose |
|---|---|
| `index.html` + `styles.css` | The poster (pure HTML/CSS/inline-SVG, no JS/deps) |
| `build_poster.py` | `python3 build_poster.py` → `poster.pdf` (A3, 1 page) + `poster_preview.png` |
| `poster.pdf` | Print-ready A3 portrait, 841.92 × 1191.12 pt, **1 page** |
| `poster_preview.png` | 150-dpi raster preview |
| `EXTRACTED_FACTS.md` | Every fact + thesis line reference (verification source) |
| `DESIGN_BRIEF.md` | Narrative, layout rationale, visual system |
| `IMAGE_REQUESTS.md` | Optional ENSIA logo + optional hero backdrop |

## What was extracted (from `../Thesis.txt`, all line-referenced in EXTRACTED_FACTS.md)
Title; both students; full jury with correct supervisor/co-supervisor mapping; the legal-AI
problem; objective; three contributions; corpus stats (171 files / 189.46 MB / 1963–2025);
benchmark stats (244 Q · 23 categories · 8 query types · 40 traps · κ=0.829 · 232 AR/12 FR);
architecture components; the full metric set; headline results (CitF1 0.305, HCR/JIR 0.000,
AbsF1 0.703, AMF 0.471, MRR 0.310, R@10 0.258) and baseline comparison; limitations;
future work; takeaway.

## What was designed
- **Masthead:** ENSIA + dept + degree + FYP code; title with highlighted RAG/KG/AM;
  students; supervisor + co-supervisor; defense date.
- **Left (Context):** the problem, six failure-mode chips, why Algerian law is hard,
  research gap, objective card, three headline stats.
- **Center (Methodology — focal point):** navy panel with an 8-stage vertical pipeline,
  phase-coded (Structure → Retrieve/Reason → Verify/Answer), each node an icon + method
  card. Covers AKN corpus, KG, RAG, typed dispatch, recursive reasoning + Toulmin AM,
  triple faithfulness gate, verifiable answer/abstention.
- **Right (Evaluation):** benchmark stat badges, 0.305 Citation-F1 hero, 5-bar comparison
  chart, 1.64×/2.9×/1.74× multipliers, citation-faithfulness findings, limitations + future work.
- **Footer:** the evidence-controlled-system takeaway.

## QC results
| Check | Result |
|---|---|
| Single A3 portrait PDF | **PASS** — `Pages: 1`, `841.92 × 1191.12 pt (A3)` |
| Background colours survive PDF export | **PASS** — `print-color-adjust:exact` (verified in PNG) |
| No text overflow / clipping | **PASS** — fixed-box layout, content sized under 420 mm; visual crops checked per column |
| Center pipeline is dominant | **PASS** — widest column, raised navy panel, full-height flow |
| Visual hierarchy / distance-readable | **PASS** — large title/heroes, chips over prose, numbered sections |
| Every number exists in the thesis | **PASS** — 26 figures spot-checked by grep in `Thesis.txt`; faithfulness-card counts (15→Gemini l.6107, 27 + 0.675→Qwen 2 l.6106) confirmed by attribution against EXTRACTED_FACTS line refs |
| Headline uses locked 0.305 (not 0.313 oracle) | **PASS** |
| Faithfulness shows only narrative-anchored cells | **PASS** — OCR-scrambled per-baseline HCR/JIR matrix deliberately omitted |
| No emojis / lorem / fake metrics / raster text | **PASS** |

## Still needs confirmation (`TODO_CONFIRM`)
1. **ENSIA logo** — the only missing asset. Masthead currently uses a CSS "AI / ENSIA"
   wordmark. Supply `assets/ensia_logo.png` (official mark) to replace it — see
   `IMAGE_REQUESTS.md` for the exact wire-in. Everything else is text-verified.
2. **Jury display choice** — header prints Supervisor (Dahak) + Co-supervisor (Cantador)
   only, to save space. Full four-person jury (Chami President, Brahimi Examiner) is in
   `EXTRACTED_FACTS.md` if you want all four on the poster.

## Images to (optionally) request from ChatGPT
- **ENSIA logo** — recommended (use the *real* logo, do not AI-generate a fake one).
- **Pipeline hero backdrop** — optional decorative layer; the design does not need it.

## Regenerate
```bash
cd thesis/poster
python3 build_poster.py          # → poster.pdf + poster_preview.png, prints QC
python3 build_poster.py --png-dpi 300   # higher-res preview
```
Requires system Google Chrome + poppler (`pdftoppm`/`pdfinfo`) — both present, fully offline.
