# HANDOFF — Viva Slides (thesis/slides/)

## Project Overview
Static, **fully offline** HTML slide deck for the AKN-RLM thesis viva (ENSIA, defense **13 June 2026**). Lives entirely in `thesis/slides/` — no build step, no server, no network. Separate from the demo app (backend/frontend); none of those were touched.

- `index.html` — all **34 slides** as `<section class="slide">` blocks, delimited by `<!-- ============ N · NAME ============ -->` comments (numbers are historical labels, NOT current order). Inline SVG for every diagram.
- `styles.css` — design system. Tokens in `:root`: paper `#f5f0e4`, ink `#1d1810`, wine `#6e2433`, gold `#876a28`, green `#38543f`. Components: `.card .ledger .dtable .rule-list .chip .bignum .trip .req-line .takeaway .kicker` etc.
- `deck.js` — nav engine: 1280×720 stage scaled to window; ←/→/Space/click advance, right-click back, `F` fullscreen, `#N` deep-link. **Fragments are disabled** (everything visible on arrival — supervisor's rule). Builds the top breadcrumb from `SECTIONS` array; highlights via `data-section="0..4"` on each slide; `data-plain` hides chrome (title/thanks).
- `fonts.css` + `assets/fonts/*.woff2` — Cormorant Garamond (display/titles), EB Garamond (body), IBM Plex Mono (XML pane), **Amiri** (Arabic Naskh, thanks page). All local; keep it offline.
- `assets/ensia_logo.png` — title-page logo.
- Content sources: `thesis/Thesis.txt` (abstract ~line 104; Tables 4.3–4.5 ~lines 4380–4740; ADU §2.6 ~line 2033), `thesis/slides/notes.md`, sketches in `thesis/slides/sketches/`.
- Project rules: `CLAUDE.md` (no git ops, venv-only python, append `HANDOFF.md` entry each session).

## Files Modified This Session
- `thesis/slides/index.html` — created, then 3 revision rounds (see Key Decisions).
- `thesis/slides/styles.css` — created + extended (`.trip`, `.req-line`, `.scope-note`, divider/hook/topnav styles). **User manually set `.s-title .main-title` to 80px — keep.**
- `thesis/slides/deck.js` — created; later simplified (fragments removed, breadcrumb added).
- `thesis/slides/fonts.css`, `assets/fonts/*` — downloaded/embedded fonts (incl. Amiri arabic subsets).
- `thesis/slides/SLIDES_HANDOFF.md` — this file.
- `HANDOFF.md` (repo root) — appended SLIDES v1/v2/v3 entries.

## Current Status
Deck rebuilt to the supervisor's numbered outline (v5–v5.3, 2026-06-12). Current order (34): Title · Hook · Outline · **L&L divider** · Legal-meaning · **Problem merged** (justification h1 + 3 failure cards + standard req-line; chain slide deleted) · Algerian context · **Research question** (statement slide; properties color-keyed wine/gold/green to CitF1+HCR / JIR / AbsF1; conclusion kicker now reads "The research question — answered" as the callback) · **Foundations divider (pillars outline: 4 classical columns + AKN-RLM entablature + Arabic-NLP stylobate)** · Arabic NLP · Pillars (RAG, KG, AM, RLM) · **Synthesis+Gaps merged** (gap-card layout, SOTA folded in) · **AKN-RLM divider** · **17 Context** (supervisor's black-box sketch: query → dispatcher panel flush on AKN-RLM box → "answer *or* abstention"; corpus DB w/ cylinder icon "retrieve · verify" + KG w/ graph icon "traverse", double arrows) · **18 Corpus+KG** (pipeline + eId XML pane + law-student/senior-expert multi-pass validation card) · **19 Benchmark** (query-type bars, difficulty/language stats, 3-step annotation protocol, κ=0.829) · **20 Architecture** (overview before the zoom-ins) · **21 Query dispatcher** (flow strip + 8 behaviour cards) · 22 **Generative inside / deterministic outside** (nested shell) · 23 **Bounded recursion** (root-controller loop, depth ≤ 3, gap-probe/coverage/workers/audit) · 24 **Toulmin-style ADUs** (ground→claim + warrant + rebuttal, **statements in Arabic/Amiri — real Art. 124 & 127 wording** + English gloss on claim; AMF 0.471; scope footnote) · 25 Gate · **Evaluation & Results divider** (section renamed from "Results"; deck.js SECTIONS updated) · 27 **Deployment+objectives** · 28 **Evaluation setup & metrics** · **Main results (1/2)** (bignums + tier-best bars ×1.64/×1.74/×2.9) · **Interpretation (2/2)** (compact staircase + 5 readings) · **Conclusion divider** · Conclusion ledger · **Limitations & future work** · Thanks.
Deleted in v5: synthesis ledger, AKN pillar slide, Retrieval-limits, scatter, tier-2 bars, full staircase, limits, abstention. v5.1: **deterministic = green `#3f5d49` / generative = wine** on slides 21–24 (gold was too close to wine — keep this legend in any new diagram); deck.js is keyboard-only (click/right-click navigation removed). No blockers; all changed slides screenshot-verified.

## Key Decisions
- **Supervisor directives (standing):** no "Chapter N" labels anywhere; no click-to-reveal; breadcrumb header w/ active section bold wine + big bold page number bottom-right; intermediate divider pages; takeaway lines (`.takeaway`) only when they add something — prune redundant ones; projector contrast (darkened inks; smallest SVG text ≥ ~12.5px).
- **User taste:** formal/elegant/serif, diagrams over prose, paper-and-ink palette. Asks for sketches → follow them closely. Numbers must match Thesis.txt exactly (CitF1 0.305, HCR/JIR 0.000, AbsF1 0.703, 171 files, 244 q, 38/40 traps, phases .056/.175/.298/.301/.302/.305).
- AM slide must say it is **not** a full argument-mining system (lightweight ADU triplets ⟨source·relation·statement⟩).
- Synthesis page ≠ gaps page: synthesis = what SOTA gives/leaves open; gaps = what we built.
- Edit workflow: large/structural edits via `python3` heredoc string-replace on `index.html` (Edit tool loses file-state after scripts); sections moved by cutting between marker comments.

## Next Steps
1. Author dry-run against the talk track — expect wording tweaks slide-by-slide (user drives; may bring more sketches).
2. Possible additions mentioned earlier: KG-explorer screenshot on the KG pillar; live-demo cutaway slide.
3. Key results numbers if slides change: best direct LLM 0.186 (Gemini 2.5 Flash), best minimal RAG 0.175, best deterministic 0.105 (hybrid+rerank), AKN-RLM 0.305; phases .056/.175/.298/.301/.302/.305; AMF 0.471; benchmark query types 66/59/40/26/17/17/12/7, difficulty 56/85/103, κ=0.829.
4. After each session: append an entry to root `HANDOFF.md`.

## Start Here
```bash
cat /home/maab/Documents/pfe/methodology/PFE_locally/thesis/slides/SLIDES_HANDOFF.md
grep -oE '<!-- ============ [^=]+ ============ -->' thesis/slides/index.html | sed 's/<!-- ============ //; s/ ============ -->//' | cat -n   # current slide order
mkdir -p /tmp/deckshots && cd thesis/slides && google-chrome-stable --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1280,720 --virtual-time-budget=3500 --screenshot=/tmp/deckshots/sN.png "file://$PWD/index.html#N"   # verify any slide N, then Read the png
```

## Context Notes
- **Verify visually after every change** — screenshot + Read the image; check label collisions/overflow in SVGs (hand-computed coordinates).
- SVG `font-size`/`fill` **presentation attributes lose to CSS classes** (`.lbl` etc.) — use inline `style="…"` to override. Arabic in SVG: `class="arabic"` (Amiri) + inline font-size; bidi/shaping render fine.
- Slide geometry: 1280×720, padding `70px 76px 78px`; content area ≈ 540px tall after titleblock — SVGs taller than ~440px collide with `.takeaway`; scale via width/height attrs keeping viewBox.
- `/tmp` gets wiped between sessions — recreate `/tmp/deckshots`.
- Headless Chrome occasionally renders half-size; add `--user-data-dir=/tmp/chromeshot` and retry.
- Machine OOMs under heavy parallel work — keep tool use light, screenshots sequential.
- Never touch git; never start servers on :3000/:8000.
- Comment markers keep old numbers after reorders — match sections by marker text, not number; trust the `grep` order listing.
