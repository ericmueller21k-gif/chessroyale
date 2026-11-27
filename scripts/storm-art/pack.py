#!/usr/bin/env python3
"""
Packs the storm's rendered frames into what the game ships (lossless WebP: few colors, hard edges, exact and small):

  stranger-storm.webp   the ring: every frame's fire cell and ice cell side by side, COLS frames a row; after the last frame, one
                        more cell pair whose ice cell is the still frost (render.py's frost.png)
  stranger-rift.webp    the rift's sheet as rift.py lays it out (each stage's loop, then the opening's frames)

  python3 scripts/storm-art/render.py <cells-dir> 36 250 all gba
  python3 scripts/storm-art/rift.py <rift-dir>
  python3 scripts/storm-art/pack.py <cells-dir> <rift-dir> packages/app/src/characters
"""
import glob
import os
import sys

from PIL import Image

COLS = 6


def main():
    cells, rift, out = sys.argv[1:4]
    fire = [Image.open(p).convert("RGBA") for p in sorted(glob.glob(os.path.join(cells, "fire-*.png")))]
    ice = [Image.open(p).convert("RGBA") for p in sorted(glob.glob(os.path.join(cells, "ice-*.png")))]
    assert len(fire) == len(ice) and fire, "render the frames first"
    w, h = fire[0].size
    pairs = list(zip(fire, ice)) + [(Image.new("RGBA", (w, h), (0, 0, 0, 0)), Image.open(os.path.join(cells, "frost.png")).convert("RGBA"))]
    rows = (len(pairs) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * 2 * w, rows * h), (0, 0, 0, 0))
    for i, (f, c) in enumerate(pairs):
        x, y = (i % COLS) * 2 * w, (i // COLS) * h
        sheet.paste(f, (x, y))
        sheet.paste(c, (x + w, y))
    os.makedirs(out, exist_ok=True)
    sheet.save(os.path.join(out, "stranger-storm.webp"), "WEBP", lossless=True, quality=100, method=6)
    Image.open(os.path.join(rift, "sheet.png")).save(os.path.join(out, "stranger-rift.webp"), "WEBP", lossless=True, quality=100, method=6)
    for name in ("stranger-storm.webp", "stranger-rift.webp"):
        print(name, Image.open(os.path.join(out, name)).size, os.path.getsize(os.path.join(out, name)) // 1024, "KB")
    print(f"ring: {len(fire)} frames, cell {w} x {h}, {COLS} a row, the frost in frame {len(fire)}'s ice cell")


if __name__ == "__main__":
    main()
