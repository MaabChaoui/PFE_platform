#!/usr/bin/env python3
"""Render the AKN-RLM poster (index.html) to a print-ready PDF + PNG.

Offline, dependency-free: uses the system Google Chrome in headless mode and the
poppler CLI (pdftoppm / pdfinfo). No Python packages required.

Two output modes (the layout is identical — A0 is A3 scaled 2.8284x, same ISO-216
aspect ratio, so the poster is authored once at A3 and scaled for the A0 build):

    python3 build_poster.py            # A3 proof  -> poster.pdf + poster_preview.png
    python3 build_poster.py --a0       # ceremony  -> poster_A0.pdf + poster_A0.png
    python3 build_poster.py --a0 --a0-dpi 220

The --a0 build emits a TRUE A0 portrait PDF (841x1189 mm) and rasterizes it; at the
default 220 DPI the PNG is 7285x10298 px, clearing the ceremony minimum of A0 /
>=200 DPI / >=6622x9929 px with margin. The A0 page is produced by scaling the fixed
297x420 mm box via a CSS transform injected at build time (index.html is untouched).
"""
from __future__ import annotations
import argparse, pathlib, shutil, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
HTML = HERE / "index.html"
PDF = HERE / "poster.pdf"
PNG = HERE / "poster_preview.png"

A0_HTML = HERE / "index_a0.html"
A0_PDF = HERE / "poster_A0.pdf"
A0_PNG = HERE / "poster_A0.png"

A3_PTS = (841.89, 1190.55)        # A3 portrait in points
A0_PTS = (2383.94, 3370.39)       # A0 portrait in points (841 x 1189 mm)
A0_SCALE = 2.8284                 # sqrt(8): A3 -> A0 linear scale
A0_MIN_PX = (6622, 9929)          # ceremony pixel floor
TOL = 4.0


def find_chrome() -> str:
    for c in ("google-chrome-stable", "google-chrome", "chromium", "chromium-browser",
              "/opt/google/chrome/chrome"):
        p = shutil.which(c) or (c if pathlib.Path(c).exists() else None)
        if p:
            return p
    sys.exit("ERROR: no Chrome/Chromium binary found.")


def run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"ERROR running {cmd[0]}:\n{r.stderr.strip()}")


def _isnum(s: str) -> bool:
    try:
        float(s); return True
    except ValueError:
        return False


def _pdf_size(pdf: pathlib.Path) -> tuple[str, list[float]]:
    info = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True).stdout
    pages = next((l.split(":")[1].strip() for l in info.splitlines()
                  if l.startswith("Pages")), "?")
    size = next((l.split(":", 1)[1].strip() for l in info.splitlines()
                 if l.startswith("Page size")), "?")
    nums = [float(x) for x in size.replace("x", " ").split() if _isnum(x)]
    return pages, nums + [0, 0]  # pad


def build_a3(chrome: str, png_dpi: int) -> bool:
    print(f"• Rendering: {HTML.name} -> {PDF.name}")
    run([chrome, "--headless", "--disable-gpu", "--no-pdf-header-footer",
         "--no-sandbox", "--virtual-time-budget=12000",
         f"--print-to-pdf={PDF}", HTML.as_uri()])
    pages, nums = _pdf_size(PDF)
    ok_pages = pages == "1"
    ok_size = abs(nums[0] - A3_PTS[0]) < TOL and abs(nums[1] - A3_PTS[1]) < TOL
    print(f"• Pages    : {pages}  {'OK' if ok_pages else 'FAIL (expected 1)'}")
    print(f"• Page size: {nums[0]:.1f} x {nums[1]:.1f} pts  {'OK (A3)' if ok_size else 'CHECK'}")
    if shutil.which("pdftoppm"):
        print(f"• Preview  : {PNG.name} @ {png_dpi} dpi")
        run(["pdftoppm", "-png", "-r", str(png_dpi), "-singlefile",
             str(PDF), str(PNG.with_suffix(""))])
    return ok_pages and ok_size


def build_a0(chrome: str, dpi: int) -> bool:
    # Inject an A0 page + scale override; index.html stays the single source of truth.
    override = (
        "<style id=\"a0\">\n"
        "@page { size: 841mm 1189mm; margin: 0; }\n"
        "html, body { width: 841mm; height: 1189mm; }\n"
        f".poster {{ transform: scale({A0_SCALE}); transform-origin: top left; }}\n"
        "</style>\n</head>"
    )
    A0_HTML.write_text(HTML.read_text().replace("</head>", override, 1))
    try:
        print(f"• Rendering: index.html (A0 scale {A0_SCALE}) -> {A0_PDF.name}")
        run([chrome, "--headless", "--disable-gpu", "--no-pdf-header-footer",
             "--no-sandbox", "--virtual-time-budget=12000",
             f"--print-to-pdf={A0_PDF}", A0_HTML.as_uri()])
    finally:
        A0_HTML.unlink(missing_ok=True)

    pages, nums = _pdf_size(A0_PDF)
    ok_pages = pages == "1"
    ok_size = abs(nums[0] - A0_PTS[0]) < TOL and abs(nums[1] - A0_PTS[1]) < TOL
    print(f"• Pages    : {pages}  {'OK' if ok_pages else 'FAIL (expected 1)'}")
    print(f"• Page size: {nums[0]:.1f} x {nums[1]:.1f} pts  {'OK (A0)' if ok_size else 'CHECK'}")

    ok_px = False
    if shutil.which("pdftoppm"):
        print(f"• Raster   : {A0_PNG.name} @ {dpi} dpi  (memory-heavy — run alone)")
        run(["pdftoppm", "-png", "-r", str(dpi), "-singlefile",
             str(A0_PDF), str(A0_PNG.with_suffix(""))])
        try:
            from PIL import Image
            w, h = Image.open(A0_PNG).size
            ok_px = w >= A0_MIN_PX[0] and h >= A0_MIN_PX[1]
            eff = round(w / (841 / 25.4), 1)
            print(f"• Pixels   : {w} x {h}  (eff {eff} DPI on A0)  "
                  f"{'OK (>= 6622x9929)' if ok_px else 'FAIL (below ceremony minimum)'}")
        except ImportError:
            print("• Pixels   : Pillow missing — verify dimensions manually")
            ok_px = True
    else:
        print("• Raster   : skipped (pdftoppm not found)")
    return ok_pages and ok_size and ok_px


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--png-dpi", type=int, default=150, help="A3 preview DPI")
    ap.add_argument("--a0", action="store_true", help="build the A0 ceremony deliverables")
    ap.add_argument("--a0-dpi", type=int, default=220, help="A0 raster DPI (>=213 to clear the minimum)")
    args = ap.parse_args()

    if not HTML.exists():
        sys.exit(f"ERROR: {HTML} not found.")

    chrome = find_chrome()
    print(f"• Chrome   : {chrome}")
    ok = build_a0(chrome, args.a0_dpi) if args.a0 else build_a3(chrome, args.png_dpi)
    print("\nDone." if ok else "\nDone — review the QC warnings above.")


if __name__ == "__main__":
    main()
