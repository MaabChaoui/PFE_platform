# IMAGE_REQUESTS.md — optional images for the AKN-RLM poster

**The poster is fully buildable as-is.** Every graphic is CSS/inline-SVG: the masthead
wordmark, all eight pipeline icons, the arrows, and the bar chart are vector and need no
external assets. The two requests below are **optional polish**. If you generate them,
drop the files in `assets/generated/` and follow the "where to wire it in" note; otherwise
the current CSS/SVG placeholders stay in place and the poster still exports cleanly.

---

### Image Request 1 — ENSIA logo (recommended if you have the official mark)

- **Save as:** `assets/ensia_logo.png`
- **Placement:** Masthead, top-left — replaces the CSS `AI` badge + "ENSIA" wordmark.
- **Aspect ratio:** ~1:1 (square mark) or ~3:1 (horizontal lockup); target height ≈ 10 mm.
- **Transparent background:** **Yes** (PNG with alpha) — it sits on a navy gradient.
- **Style:** The real, official ENSIA logo. Do **not** AI-generate a fake institutional
  logo — use the authentic asset from ENSIA brand materials. White / light monochrome
  version preferred so it reads on dark navy.
- **Text in image:** Only whatever is part of the official logo.
- **Wire-in:** In `index.html`, replace the `<div class="logo">…</div>` block with
  `<img src="assets/ensia_logo.png" style="height:10mm">`.

> This is the only `TODO_CONFIRM` asset. Until you supply it, the masthead shows a clean
> CSS "AI / ENSIA" wordmark, which is acceptable for a draft/defense print.

---

### Image Request 2 — center pipeline hero illustration (optional, only if you want a backdrop)

- **Save as:** `assets/generated/legal_ai_pipeline_hero.png`
- **Placement:** Center column, as a faint backdrop *behind* the navy pipeline panel
  (very low opacity, ~8–12%), purely decorative. The SVG pipeline stays on top and remains
  the readable element.
- **Aspect ratio:** 1:2.4 tall (matches the center panel ≈ 100 mm × 300 mm).
- **Transparent background:** **Yes.**
- **Prompt for ChatGPT:**
  > "Create a clean vector-style illustration on a transparent background showing Algerian
  > legal documents being transformed into structured XML nodes, then into a knowledge
  > graph and finally a verified, citation-grounded legal answer. Formal academic AI style,
  > navy / orange / green palette, abstract and minimal, tall vertical composition, no text,
  > no people, no logos, high resolution, suitable as a faint backdrop on a dark-navy A3
  > thesis infographic poster."
- **Style:** Minimal, geometric, line-and-node, low visual noise — must not compete with
  the foreground pipeline.
- **Text in image:** **No text.**
- **Wire-in:** Add `background-image:url('assets/generated/legal_ai_pipeline_hero.png');
  background-size:cover; background-blend-mode:soft-light;` to `.center-panel` in
  `styles.css`. **Skip this** unless the flat navy panel feels too plain — the current
  design is intentionally clean and does not need it.

---

### Image Request 3 — "fluent ≠ correct" spot illustration (optional, left column)

- **Save as:** `assets/generated/problem_spot.png`
- **Placement:** Left column, inside the problem-statement card (top of column 01·WHY),
  floated right of the text at ≈ 18–20 mm tall. Purely an eye-catcher next to the
  requirement chips.
- **Aspect ratio:** ~1:1. **Transparent background: Yes** (sits on a white card).
- **Prompt for ChatGPT:**
  > "Minimal flat vector spot illustration on a transparent background: a friendly
  > chatbot speech bubble confidently presenting a legal document that is visibly
  > wrong — the document shows a broken/crossed-out paragraph symbol (§) — while a
  > small set of scales of justice tips beside it. Two-tone palette only: deep navy
  > #0f2c52 and warm red #cf4b3e with white. Clean geometric line-and-fill style,
  > no gradients, no text, no people, no logos, square composition, high resolution,
  > designed to read clearly at 2 cm on a printed A3 academic poster."
- **Style guard:** must stay 2-tone and geometric; if it comes back busy or with text,
  regenerate or skip — the column works without it.
- **Wire-in:** in `index.html` add `<img class="pspot" src="assets/generated/problem_spot.png">`
  as the first child of `.pstate`, and in `styles.css`:
  `.pstate{display:flex;gap:2.5mm;align-items:center} .pstate .pspot{width:18mm;flex:none;order:2}`
  (wrap the existing `<p>` + chips in a `<div>`).

---

## Summary
| Image | Required? | Without it |
|---|---|---|
| ENSIA logo | Recommended | CSS "AI / ENSIA" wordmark (looks fine) |
| Pipeline hero backdrop | Optional | Flat navy panel (intended look) |
| Problem spot illustration | Optional | Chips-only problem card (current v3 look) |

No other images are needed. **Do not** request fake metrics, screenshots, or decorative
stock art — the poster is deliberately vector-only and distance-readable.
