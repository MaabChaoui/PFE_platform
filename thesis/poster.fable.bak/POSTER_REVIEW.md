# POSTER_REVIEW.md — AKN-RLM thesis poster (v3: left column rebuilt)

## v3 (2026-06-10) — left column redesigned to the author's sketch
New order: **problem statement → real examples → LLM failure chart → hard case →
objectives → significance & impact** (matches the hand sketch + the ENSIA directive's
"Problem Statement / Objectives / Significance & Impact" checklist).

- **Problem statement** card: "In law, fluent ≠ correct" + 5 requirement chips, the red
  one being "— or refused".
- **Three RTL Arabic speech bubbles** with *verbatim benchmark questions* (ids
  `civ_ra_q01`, `fam_tf_q01`, `lab_un_q03` — see `EXTRACTED_FACTS.md` §11c), each
  footed by the capability it demands: exact articles / law-as-amended / abstention.
  Font: Noto Naskh Arabic (system-installed; verified in the 300-dpi render).
- **Hallucinated-Citation-Rate bar chart** (the sketch's "hallucinations per LLM"):
  per-model HCR from the *intact* Table 4.4 (`EXTRACTED_FACTS.md` §11b) — 6 red bars
  0.492→0.811 sorted by parameter count so the rising trend visually argues
  "scale doesn't fix law"; AKN-RLM 0.000 in green. Caption covers the Gemini paradox
  and the 6/7 foreign-law infection stat. Gemini's bar is intentionally *not* drawn
  (its 0.008 is a refusal-to-cite artefact, explained in the caption instead).
- **Objectives** 2×2 check grid + **Significance** 3 icon rows replace the v2
  capability-gap table; the 6 risk tiles were retired (the chart + bubble tags now
  carry those failure modes).
- QC re-run: 1 page, A3, no overflow (column crop-checked at 300 dpi).

---

# v2 review (previous)

A3 portrait infographic in `./thesis/poster/`. Source of truth: `../Thesis.txt`
(every figure traces to `EXTRACTED_FACTS.md` with a line reference). v2 is a structural
redesign of v1, not a polish pass.

## Deliverables
| File | Purpose |
|---|---|
| `index.html` + `styles.css` | The poster — pure HTML/CSS/inline-SVG, no JS/deps |
| `build_poster.py` | `python3 build_poster.py` → `poster.pdf` (A3, 1 page) + `poster_preview.png` |
| `poster.pdf` / `poster_preview.png` | Print-ready output + 150-dpi preview |
| `EXTRACTED_FACTS.md` | Every fact + thesis line reference |
| `DESIGN_BRIEF.md` | Narrative + visual system |
| `IMAGE_REQUESTS.md` | Asset notes |
| `assets/ensia_logo.png` | Official ENSIA mark (in masthead) |
| `assets/generated/legal_ai_pipeline_hero.png` | Faint center-panel watermark (processed from the provided ChatGPT illustration) |

---

## 1. What changed from v1 → v2
The brief was that v1 felt "too text-heavy and too card-based." v2 rebuilds structure and visuals:

- **Reading flow is now explicit: WHY → HOW → PROOF.** Each column carries a coloured badge
  (01·WHY red, 02·HOW orange, 03·PROOF green) so the 30-second read is unmistakable.
- **Center is a true architecture diagram**, not a stack of boxes. Four labelled **zones** —
  *Structure the law → Retrieve evidence → Reason recursively → Verify & answer* — each a
  grouped band with a horizontal mini-flow of icon nodes and inter-stage arrows, joined by
  connector arrows. The recursion zone is enlarged and flex-grows to dominate the panel.
- **Prose replaced by graphics** throughout: "why LLMs fail" → 6 icon risk-tiles; research
  gap → a **Generic-LLM ✗ vs AKN-RLM ✓ capability table**; results → two bar charts; the
  takeaway → a visual **equation**.
- **Masthead** now uses the real **ENSIA logo** in a white pill (the logo is dark, the
  masthead navy).
- **The provided ChatGPT pipeline illustration** is integrated as a faint navy-friendly
  **watermark** behind the center panel (see §6).
- **Whitespace removed** where it carried nothing: the center bands flow tightly (recursion
  band absorbs slack); side-column section labels are wrapped with their content so spacing
  falls *between* groups, not between a label and its grid.

## 2. How text density was reduced (≈40%)
- Every left-column prose card became **icon tiles / chips / a comparison table** (1–2 word labels).
- The two-paragraph "citation faithfulness findings" card became a **chart + one caption line**.
- The benchmark paragraph became **stat cards + a difficulty stacked bar**.
- The takeaway paragraph became a **4-term equation**.
- Remaining prose is four short fragments only: the WHY kicker, the architecture sub-line,
  one faithfulness caption, and one capability-table footnote.

## 3. How recursion is now shown
Zone 3 is a dedicated **circular cycle** (inline SVG), visually distinct from the linear
zones (thick orange border + glow). Four nodes — **Retrieve → Inspect → Reason → Refine** —
ring a central **"Gap-probe RLM · depth ≤ k"** hub, with clockwise arrowheads showing the
loop. Beside it: *detects evidence gaps · Toulmin ADU mining · one corrective retry*, then a
green **exit** ("evidence sufficient → verify & answer"). It reads at a glance as bounded
iteration, not a single pipeline box.

## 4. How the results section was strengthened
- **Headline panel:** giant `0.305` Citation F1 + `0.000` HCR/JIR + `0.703` Abstention F1 +
  the 1.64× / 2.9× / 1.74× multipliers.
- **Chart 1 — Citation F1 vs baselines** (5 bars, AKN-RLM in orange at 0.305).
- **Chart 2 — Jurisdictional infection (JIR), "lower = safer"**: AKN-RLM **0.000** vs
  Gemini 2.5 **0.375** (15/40) vs Qwen 2 **0.675** (27/40) — makes the safety gap visceral.
- **Benchmark summary:** six stat cards + a difficulty stacked bar (23 / 35 / 42 %).
- **Limits / Next:** four terse bullets each.

## QC results
| Check | Result |
|---|---|
| Single A3 portrait PDF | **PASS** — `Pages: 1`, `841.92 × 1191.12 pt (A3)` |
| Colours survive PDF export | **PASS** — `print-color-adjust:exact` (verified in PNG) |
| No text overflow / clipping | **PASS** — fixed-box layout; every band/column visually crop-checked |
| Center is the dominant money-shot | **PASS** — widest column; recursion cycle flex-grows |
| Recursion shown as an explicit loop | **PASS** — circular 4-node cycle with hub |
| WHY → HOW → PROOF hierarchy | **PASS** |
| Every number exists in the thesis | **PASS** — all figures cited in `EXTRACTED_FACTS.md`; new v2 figures (JIR 0.375/0.675, 15/40, 27/40, 232/12, 23/35/42 %) confirmed by line ref |
| Faithfulness uses only anchored cells | **PASS** — Qwen 2 → 27/40 (l.6106), Gemini → 15/40 (l.6107); no OCR-scrambled matrix reproduced |
| Headline = locked 0.305 (not 0.313 oracle) | **PASS** |
| No emojis / lorem / fake metrics / raster text | **PASS** |

## 6. Use of the provided ChatGPT illustration
The illustration (`assets/ChatGPT Image …png`, 809×1942, white background) is a top-down
pipeline matching the architecture. Because the center panel is dark navy, the white-bg image
was processed (PIL: grayscale → invert → gamma to drop the background grid → tint pale steel-blue
on alpha) into a light **watermark** at `assets/generated/legal_ai_pipeline_hero.png`, applied
behind the panel at **20 % opacity, screen blend**. It reads as a faint ghost in the navy
gutters between bands; the SVG foreground stays dominant and fully legible — per the brief
("very faint, must not reduce readability, foreground dominant"). The original is untouched.

## 5. Remaining `TODO_CONFIRM`
- **None blocking.** ENSIA logo and the hero illustration are now both in place.
- **Optional:** the jurisdiction-gate caveat (canary list derived from the same 40 traps)
  is documented in `EXTRACTED_FACTS.md` §12 but, for a poster, is intentionally not printed —
  the 0.000 JIR claim is stated as a benchmark result, not an absolute guarantee. Flag if you
  want a footnote added.
- **Optional:** if you'd prefer the provided illustration featured more prominently (e.g. a
  visible side strip rather than a faint watermark), that's a one-line CSS change — say the word.

## Regenerate
```bash
cd thesis/poster
python3 build_poster.py            # → poster.pdf + poster_preview.png + QC
python3 build_poster.py --png-dpi 300
```
Offline: system Google Chrome + poppler (`pdftoppm`/`pdfinfo`).
