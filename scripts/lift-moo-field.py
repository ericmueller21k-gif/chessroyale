"""Splits Moo & Moon's field (characters/moo-cinematic.png, its four frames) into three layers in one picture, so the Full Moon's moon
can rise from behind the hill (Eric, Nov 20: "the moon should start half hidden behind the horizon/grassy hill and then move upward into the sky
... moon should never be in front of the background hill terrain"; docs/decisions/2026-11-20-moo-moonrise.md):
  - the sky without its moon (frames 0 to 3): the field's own sky, its moon and the moon's glow round it filled from the sky on either
    side of them in the same row (the sky's own colors, dithered as the art's), its stars kept;
  - the front (frames 4 to 7): everything from the hill line down (the hills, the barn and silo, the fence, the grass and flowers),
    the field's own pixels, the sky above and between them see-through;
  - the moon (frame 8): the field's own moon in its own place, the sky round it see-through (the four frames share it; only their
    stars twinkle). In the same picture as the sky and the front, so the three can never arrive apart (Eric, Nov 20: on a cold load
    "you can see the moon behind the land because the moon loaded first"; docs/decisions/2026-11-20-moonrise-load-order.md).
Nothing drawn: every pixel is the field's own, or one of its sky's colors. Also writes the hill line per art column
(characters/moo-horizon.ts) for the tests.
  python3 scripts/lift-moo-field.py   ->  packages/app/src/characters/moo-field-layers.png, moo-horizon.ts
"""
from PIL import Image

SRC = "packages/app/src/characters/moo-cinematic.png"
OUT = "packages/app/src/characters/moo-field-layers.png"
HORIZON_TS = "packages/app/src/characters/moo-horizon.ts"
W, H, FRAMES = 200, 260, 4
# The field's moon (scripts/lift-moo-moon.py) and its glow, which goes with it (it reaches about 25 art pixels past its rim).
CX, CY, R = 100, 80.5, 58.6
GLOW = R + 30
# The sky's colors, darkest to lightest (its gradient and the moon's glow are dithered between neighbors).
BANDS = [(9, 11, 36), (14, 18, 54), (21, 26, 71), (29, 35, 87), (38, 45, 103), (49, 56, 118), (61, 68, 133), (79, 83, 143), (103, 104, 157), (111, 118, 182)]
STARS = [(184, 194, 240), (255, 255, 255)]
SKY = set(BANDS) | set(STARS)
# The moon's box in the field (art pixels): columns 42 to 157, rows 24 to 136 (its bottom tip touches the hills at 137).
MX0, MY0, MX1, MY1 = 42, 24, 158, 137
# A 2 x 2 ordered dither: which of two neighboring colors a pixel takes for a share between them.
BAYER = [[0.125, 0.625], [0.875, 0.375]]

sheet = Image.open(SRC).convert("RGB")
frames = [sheet.crop((i * W, 0, i * W + W, H)) for i in range(FRAMES)]
f0 = frames[0]


def is_moon(c):
    return c not in SKY and c[0] > c[2] and c[0] >= 200


def in_disc(x, y, r):
    return ((x + 0.5 - CX) ** 2 + (y + 0.5 - CY) ** 2) ** 0.5 <= r


# The hill line: per column, the first row (from the sky's lower half down) that is neither sky nor moon: the hills, the barn, the
# fence. From there down a pixel is the front's unless it's the sky's (between the fence's rails).
top = []
for x in range(W):
    y = 90
    while f0.getpixel((x, y)) in SKY or (is_moon(f0.getpixel((x, y))) and in_disc(x, y, R + 1)):
        y += 1
    top.append(y)
# The solid hill line: per column, the first row from which every row down is the front's (the moon is hidden under it).
solid = []
for x in range(W):
    y = H - 1
    while y > 0 and f0.getpixel((x, y - 1)) not in SKY and not (is_moon(f0.getpixel((x, y - 1))) and in_disc(x, y - 1, R + 1)):
        y -= 1
    solid.append(y)
assert all(s >= t for s, t in zip(solid, top)), "the solid line above the first front row"
assert max(solid) < 160, max(solid)


def band(c):
    return BANDS.index(c) if c in BANDS else None


# The moon and its glow, row by row (the same in every frame): the sky's band each side of the glow (a few pixels' average, stars
# skipped; a row with none, the hills there: the row above's), eased over the rows round it so no row stands out, then between the
# two sides across, dithered.
def side(y, xs):
    vals = [band(f0.getpixel((x, y))) for x in xs if 0 <= x < W and y < top[x]]
    vals = [v for v in vals if v is not None]
    return sum(vals) / len(vals) if vals else None


raw = {}
prev = None
for y in range(0, int(CY + GLOW) + 1):
    dy = y + 0.5 - CY
    if abs(dy) > GLOW:
        continue
    half = (GLOW**2 - dy**2) ** 0.5
    xl, xr = int(CX - half) - 1, int(CX + half) + 1
    left, right = side(y, range(xl - 5, xl + 1)), side(y, range(xr, xr + 6))
    if left is None and right is None:
        left = right = side(y, list(range(0, 6)) + list(range(W - 6, W)))
    left = right if left is None else left
    right = left if right is None else right
    if left is None:
        left, right = prev
    prev = (left, right)
    raw[y] = (xl, xr, left, right)
EASE = 4
rows = {}
for y, (xl, xr, _, _) in raw.items():
    near = [raw[k] for k in range(y - EASE, y + EASE + 1) if k in raw]
    rows[y] = (xl, xr, sum(n[2] for n in near) / len(near), sum(n[3] for n in near) / len(near))

out = Image.new("RGBA", (W * (FRAMES * 2 + 1), H), (0, 0, 0, 0))
# The moon (frame 8): the moon's own pixels (warm, the sky's cool: red over blue) inside its disc.
holes = 0
for y in range(MY0, MY1):
    for x in range(MX0, MX1):
        r, g, b = f0.getpixel((x, y))
        if in_disc(x, y, R) and r > b:
            out.putpixel((FRAMES * 2 * W + x, y), (r, g, b, 255))
        elif in_disc(x, y, R - 3):
            holes += 1
assert holes == 0, f"{holes} sky pixels inside the moon"
for i, f in enumerate(frames):
    sky = f.copy()
    front = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(H):
        for x in range(W):
            c = f.getpixel((x, y))
            if y >= top[x] and c not in SKY:
                front.putpixel((x, y), (*c, 255))
    for y, (xl, xr, left, right) in rows.items():
        for x in range(max(0, xl + 1), min(W, xr)):
            if y >= top[x] or not in_disc(x, y, GLOW):
                continue
            c = f.getpixel((x, y))
            if c in STARS and not in_disc(x, y, R + 2):
                continue
            u = (x - xl) / max(1, xr - xl)
            v = left + (right - left) * u
            lo = int(v)
            hi = min(lo + 1, len(BANDS) - 1)
            sky.putpixel((x, y), BANDS[hi if v - lo > BAYER[y % 2][x % 2] else lo])
    # (No moon left in the sky above the hill line.)
    left_moon = sum(1 for y in range(H) for x in range(W) if y < top[x] and is_moon(sky.getpixel((x, y))))
    assert left_moon == 0, f"frame {i}: {left_moon} moon pixels left"
    out.paste(sky.convert("RGBA"), (i * W, 0))
    out.paste(front, ((FRAMES + i) * W, 0))
out.save(OUT, optimize=True)
with open(HORIZON_TS, "w") as fh:
    fh.write(
        "/**\n * The field's solid hill line (characters/moo-cinematic.png, art pixels): per column, the first row from which every row down is\n"
        " * the front layer's (characters/moo-field-layers.png), so a moon there is hidden behind the hill. Written by scripts/lift-moo-field.py.\n */\n"
        f"export const MOO_HORIZON: readonly number[] = {solid};\n"
    )
print(OUT, out.size, "hill line rows", min(solid), "to", max(solid), "under the moon", solid[int(CX)])
