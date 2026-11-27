#!/usr/bin/env python3
"""
Packs the storm's rendered frames (render.py) into what the game ships: one sheet (every frame's fire cell and ice cell side by side,
COLS frames a row) and the still frost, both WebP with transparency.

  python3 scripts/storm-art/pack.py <cells-dir> <out-dir> [quality=72|lossless] [unpack-dir]

lossless: for the GBA pass (few colors, hard edges: exact and still small).

unpack-dir: the shipped files cut back into frames (as the game will show them, after compression), for preview.py.
"""
import glob
import os
import sys

from PIL import Image

COLS = 6


def main():
    cells, out = sys.argv[1], sys.argv[2]
    exact = len(sys.argv) > 3 and sys.argv[3] == "lossless"
    quality = 72 if exact or len(sys.argv) <= 3 else int(sys.argv[3])
    fire = [Image.open(p).convert("RGBA") for p in sorted(glob.glob(os.path.join(cells, "fire-*.png")))]
    ice = [Image.open(p).convert("RGBA") for p in sorted(glob.glob(os.path.join(cells, "ice-*.png")))]
    assert len(fire) == len(ice) and fire, "render the frames first"
    w, h = fire[0].size
    rows = (len(fire) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * 2 * w, rows * h), (0, 0, 0, 0))
    for i, (f, c) in enumerate(zip(fire, ice)):
        x, y = (i % COLS) * 2 * w, (i // COLS) * h
        sheet.paste(f, (x, y))
        sheet.paste(c, (x + w, y))
    os.makedirs(out, exist_ok=True)
    how = dict(lossless=True, quality=100, method=6) if exact else dict(quality=quality, alpha_quality=60, method=6)
    sheet.save(os.path.join(out, "storm.webp"), "WEBP", **how)
    Image.open(os.path.join(cells, "frost.png")).save(os.path.join(out, "frost.webp"), "WEBP", **(how if exact else dict(quality=82, alpha_quality=80, method=6)))
    for name in ("storm.webp", "frost.webp"):
        print(name, Image.open(os.path.join(out, name)).size, os.path.getsize(os.path.join(out, name)) // 1024, "KB")
    print(f"frames {len(fire)}, cell {w} x {h}, {COLS} a row")
    if len(sys.argv) > 4:
        back = sys.argv[4]
        os.makedirs(back, exist_ok=True)
        got = Image.open(os.path.join(out, "storm.webp")).convert("RGBA")
        for i in range(len(fire)):
            x, y = (i % COLS) * 2 * w, (i // COLS) * h
            got.crop((x, y, x + w, y + h)).save(os.path.join(back, f"fire-{i:02d}.png"))
            got.crop((x + w, y, x + 2 * w, y + h)).save(os.path.join(back, f"ice-{i:02d}.png"))
        Image.open(os.path.join(out, "frost.webp")).convert("RGBA").save(os.path.join(back, "frost.png"))


if __name__ == "__main__":
    main()
