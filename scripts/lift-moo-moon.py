"""Lifts the moon out of Moo & Moon's field (characters/moo-cinematic.png, its first frame) as its own sprite, so the Full Moon's
cinematic can move it (Eric, Nov 20; docs/decisions/2026-11-20-moo-moon-meteor.md). Nothing drawn: the moon's own pixels, the sky
round it made see-through. The four field frames share the moon (only their stars twinkle).
  python3 scripts/lift-moo-moon.py   ->  packages/app/src/characters/moo-moon.png
"""
from PIL import Image

SRC = "packages/app/src/characters/moo-cinematic.png"
OUT = "packages/app/src/characters/moo-moon.png"
# The moon's box in the field (art pixels): columns 42 to 157, rows 24 to 136 (its bottom tip touches the hills at 137).
X0, Y0, X1, Y1 = 42, 24, 158, 137
CX, CY, R = 100, 80.5, 58.6

field = Image.open(SRC).convert("RGB").crop((0, 0, 200, 260))
moon = Image.new("RGBA", (X1 - X0, Y1 - Y0), (0, 0, 0, 0))
holes = 0
for y in range(Y0, Y1):
    for x in range(X0, X1):
        inside = ((x + 0.5 - CX) ** 2 + (y + 0.5 - CY) ** 2) ** 0.5 <= R
        r, g, b = field.getpixel((x, y))
        # (The moon's pixels are warm, the sky's cool: red over blue.)
        if inside and r > b:
            moon.putpixel((x - X0, y - Y0), (r, g, b, 255))
        elif inside and ((x + 0.5 - CX) ** 2 + (y + 0.5 - CY) ** 2) ** 0.5 <= R - 3:
            holes += 1
assert holes == 0, f"{holes} sky pixels inside the moon"
moon.save(OUT, optimize=True)
print(OUT, moon.size)
