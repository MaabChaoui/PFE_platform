#!/usr/bin/env python3
"""Render the AKN-RLM poster (index.html) to a print-ready A3 PDF + PNG preview.

Offline, dependency-free: uses the system Google Chrome in headless mode and the
poppler CLI (pdftoppm / pdfinfo). No Python packages required.

Usage:
    python3 build_poster.py            # build poster.pdf + poster_preview.png
    python3 build_poster.py --png-dpi 200
"""
from __future__ import annotations
import argparse, pathlib, shutil, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
HTML = HERE / "index.html"
PDF = HERE / "poster.pdf"
PNG = HERE / "poster_preview.png"

A3_PTS = (841.89, 1190.55)  # A3 portrait in points
TOL = 3.0


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


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--png-dpi", type=int, default=150)
    args = ap.parse_args()

    if not HTML.exists():
        sys.exit(f"ERROR: {HTML} not found.")

    chrome = find_chrome()
    print(f"• Chrome   : {chrome}")
    print(f"• Rendering: {HTML.name} -> {PDF.name}")
    run([chrome, "--headless", "--disable-gpu", "--no-pdf-header-footer",
         "--no-sandbox", "--virtual-time-budget=10000",
         f"--print-to-pdf={PDF}", HTML.as_uri()])

    # ---- QC: single A3 page ----
    info = subprocess.run(["pdfinfo", str(PDF)], capture_output=True, text=True).stdout
    pages = next((l.split(":")[1].strip() for l in info.splitlines()
                  if l.startswith("Pages")), "?")
    size = next((l.split(":", 1)[1].strip() for l in info.splitlines()
                 if l.startswith("Page size")), "?")
    ok_pages = pages == "1"
    nums = [float(x) for x in size.replace("x", " ").split() if _isnum(x)]
    ok_size = len(nums) >= 2 and abs(nums[0] - A3_PTS[0]) < TOL and abs(nums[1] - A3_PTS[1]) < TOL
    print(f"• Pages    : {pages}  {'OK' if ok_pages else 'FAIL (expected 1)'}")
    print(f"• Page size: {size}  {'OK (A3)' if ok_size else 'CHECK'}")

    # ---- PNG preview ----
    if shutil.which("pdftoppm"):
        print(f"• Preview  : {PNG.name} @ {args.png_dpi} dpi")
        run(["pdftoppm", "-png", "-r", str(args.png_dpi), "-singlefile",
             str(PDF), str(PNG.with_suffix(""))])
    else:
        print("• Preview  : skipped (pdftoppm not found)")

    print("\nDone." if (ok_pages and ok_size) else
          "\nDone — review the QC warnings above.")


def _isnum(s: str) -> bool:
    try:
        float(s); return True
    except ValueError:
        return False


if __name__ == "__main__":
    main()
