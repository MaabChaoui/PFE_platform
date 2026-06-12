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
Deck is complete and supervisor-revised. Current order (34): Title · Hook (Mata **V.** Avianca lockup, hallucinated cases small + struck) · Outline · **L&L divider** · Legal-meaning · The-problem (chain-links hero: snapped wine link, ghosted tail) · Algerian context · Hallucination · **Foundations divider** · Arabic NLP · Pillars I–IV of IV (RAG, KG, **AM = ADU-triplets redesign w/ scope note**, RLM) · Synthesis (SOTA ledger, Arabic-NLP row first, no AKN row) · Gaps & Contributions · **AKN-RLM divider** · Architecture · AKN ("The corpus standard") · Data layer · Retrieval-limits (**parked here, rework pending**) · Typed handlers · Gate · Evaluation · **Results divider** · Headline · Empty-corner scatter · Tier-2 bars · Phase staircase · Limits · Abstention · **Conclusion divider** · Conclusion · Thanks (Thank you · Merci · شكرًا in Amiri).
No blockers. All changed slides verified via headless-Chrome screenshots.

## Key Decisions
- **Supervisor directives (standing):** no "Chapter N" labels anywhere; no click-to-reveal; breadcrumb header w/ active section bold wine + big bold page number bottom-right; intermediate divider pages; takeaway lines (`.takeaway`) only when they add something — prune redundant ones; projector contrast (darkened inks; smallest SVG text ≥ ~12.5px).
- **User taste:** formal/elegant/serif, diagrams over prose, paper-and-ink palette. Asks for sketches → follow them closely. Numbers must match Thesis.txt exactly (CitF1 0.305, HCR/JIR 0.000, AbsF1 0.703, 171 files, 244 q, 38/40 traps, phases .056/.175/.298/.301/.302/.305).
- AM slide must say it is **not** a full argument-mining system (lightweight ADU triplets ⟨source·relation·statement⟩).
- Synthesis page ≠ gaps page: synthesis = what SOTA gives/leaves open; gaps = what we built.
- Edit workflow: large/structural edits via `python3` heredoc string-replace on `index.html` (Edit tool loses file-state after scripts); sections moved by cutting between marker comments.

## Next Steps
1. **Rework "Retrieval at its limits"** (parked in AKN-RLM section) to fit the methodology narrative — user said "we'll work on it later".
2. Content pass on remaining chapters (methodology + results wording) — user drives slide-by-slide; expect more sketch images.
3. Possible additions mentioned: KG-explorer screenshot on the KG pillar; live-demo cutaway slide.
4. After each session: append an entry to root `HANDOFF.md`.

## Start Here
```bash
cat /home/maab/Documents/pfe/methodology/PFE_locally/thesis/slides/SLIDES_HANDOFF.md
grep -oE '<!-- ============ [^=]+ ============ -->' thesis/slides/index.html | sed 's/<!-- ============ //; s/ ============ -->//' | cat -n   # current slide order
mkdir -p /tmp/deckshots && cd thesis/slides && google-chrome-stable --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1280,720 --virtual-time-budget=3500 --screenshot=/tmp/deckshots/sN.png "file://$PWD/index.html#N"   # verify any slide N, then Read the png
```

## Context Notes
- **Verify visually after every change** — screenshot + Read the image; check label collisions/overflow in SVGs (hand-computed coordinates).
- Slide geometry: 1280×720, padding `70px 76px 78px`; content area ≈ 540px tall after titleblock — SVGs taller than ~440px collide with `.takeaway`; scale via width/height attrs keeping viewBox.
- `/tmp` gets wiped between sessions — recreate `/tmp/deckshots`.
- Headless Chrome occasionally renders half-size; add `--user-data-dir=/tmp/chromeshot` and retry.
- Machine OOMs under heavy parallel work — keep tool use light, screenshots sequential.
- Never touch git; never start servers on :3000/:8000.
- Comment markers keep old numbers after reorders — match sections by marker text, not number; trust the `grep` order listing.
