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

## Summary
| Image | Required? | Without it |
|---|---|---|
| ENSIA logo | Recommended | CSS "AI / ENSIA" wordmark (looks fine) |
| Pipeline hero backdrop | Optional | Flat navy panel (intended look) |

No other images are needed. **Do not** request fake metrics, screenshots, or decorative
stock art — the poster is deliberately vector-only and distance-readable.
