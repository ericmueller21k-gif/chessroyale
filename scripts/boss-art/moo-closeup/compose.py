"""Moo & Moon's close-up (Scene B), built from the game's own sprite (Nov 17, Eric: "im fine if it just looks like a zoomed in
version of the real ones"): Moo from his rig at MOO_K x, the Moon at MOON_K x in front (bigger: nearer the camera), on a
night sky with light shafts from the moon off screen (upper left). Frames: the eyes from normal to white and glowing.
  python3 compose.py <parts dir> <out dir>   (parts: parts.ts, beside this file; writes 200 x 260 frames at 1x, b-0.png .. b-4.png)"""
import sys, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

PARTS, OUT = sys.argv[1], sys.argv[2]
W, H = 200, 260
MOO_K, MOON_K = 4, 5
MOO_AT = (-25, -92)          # where the sprite frame's (0, 0) lands, at MOO_K
MOON_AT = (-64, -145)        # the same for the Moon, at MOON_K
load = lambda n: Image.open(f"{PARTS}/{n}.png").convert("RGBA")
up = lambda im, k: im.resize((im.width * k, im.height * k), Image.NEAREST)

def sky(glow):
    rnd = random.Random(7)
    bands = [(14, 17, 44), (20, 24, 60), (27, 32, 78), (35, 40, 96), (44, 48, 112)]
    im = Image.new("RGBA", (W, H))
    px = im.load()
    bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    for y in range(H):
        for x in range(W):
            # brighter toward the upper left, where the moon is
            t = max(0.0, 1 - ((x * 0.8 + y) / (W * 0.8 + H))) * (len(bands) - 1)
            i = int(t)
            f = t - i
            b = bands[min(len(bands) - 1, i + (1 if f * 16 > bayer[y % 4][x % 4] else 0))]
            px[x, y] = b + (255,)
    d = ImageDraw.Draw(im)
    for _ in range(70):
        x, y = rnd.randrange(W), rnd.randrange(H)
        c = rnd.choice([(255, 246, 214), (200, 210, 255), (255, 232, 160)])
        d.point((x, y), fill=c + (rnd.choice([150, 200, 255]),))
    for _ in range(9):
        x, y = rnd.randrange(8, W - 8), rnd.randrange(8, H - 8)
        c = (255, 244, 200, 255)
        d.point([(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=c)
    return im

def shafts(alpha):
    """Diagonal shafts of moonlight from the upper left (banded, no smooth gradient)."""
    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    for x0, w, a in [(-60, 26, 1.0), (10, 14, 0.7), (60, 22, 0.85), (125, 10, 0.55)]:
        for j, k in [(0, 0.45), (3, 0.75), (6, 1.0)]:
            ww = w - 2 * j
            if ww <= 0:
                continue
            x = x0 + j
            poly = [(x, 0), (x + ww, 0), (x + ww + H * 0.75, H), (x + H * 0.75, H)]
            d.polygon(poly, fill=(255, 240, 190, int(alpha * a * k * 40)))
    return im

def glow_ring(mask, color, radius):
    """A soft-banded glow round the pixels of `mask` (L), in whole pixels: bands of falling alpha."""
    out = Image.new("RGBA", mask.size)
    prev = mask
    for r, a in zip(range(1, radius + 1), [200, 140, 90, 50, 25][:radius]):
        grown = prev.filter(ImageFilter.MaxFilter(3))
        ring = ImageChops.subtract(grown, prev)
        layer = Image.new("RGBA", mask.size, color + (a,))
        out.paste(layer, (0, 0), ring)
        prev = grown
    return out

def sparkles(n, seed, box):
    rnd = random.Random(seed)
    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = box
    for _ in range(n):
        x, y = rnd.randrange(x0, x1), rnd.randrange(y0, y1)
        big = rnd.random() < 0.35
        c = (255, 250, 220, 255)
        pts = [(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]
        if big:
            pts += [(x - 2, y), (x + 2, y), (x, y - 2), (x, y + 2)]
        d.point(pts, fill=c)
    return im

moo, moo_glow, moon, moon_noeyes = load("moo"), load("moo-glow"), load("moon"), load("moon-noeyes")
# The Moon's eye pixels: where the Moon with eyes differs from the Moon without.
diff = ImageChops.difference(moon.convert("RGB"), moon_noeyes.convert("RGB")).convert("L").point(lambda v: 255 if v > 0 else 0)
moon_eyes = diff
# Moo's eye pixels: where his glowing eyes differ from his open ones.
moo_eye_mask = ImageChops.difference(moo.convert("RGB"), moo_glow.convert("RGB")).convert("L").point(lambda v: 255 if v > 0 else 0)

def place(im, k, at):
    layer = Image.new("RGBA", (W, H))
    big = up(im, k)
    layer.alpha_composite(big.crop((max(0, -at[0]), max(0, -at[1]), max(0, -at[0]) + W, max(0, -at[1]) + H)), (max(0, at[0]), max(0, at[1])))
    return layer

def placeL(mask, k, at):
    layer = Image.new("L", (W, H))
    big = mask.resize((mask.width * k, mask.height * k), Image.NEAREST)
    layer.paste(big.crop((max(0, -at[0]), max(0, -at[1]), max(0, -at[0]) + W, max(0, -at[1]) + H)), (max(0, at[0]), max(0, at[1])))
    return layer

# Frames: 0 normal; 1-2 the white creeping in; 3 white; 4 white and glowing (the still).
STEPS = [0.0, 0.35, 0.7, 1.0, 1.0]
for i, s in enumerate(STEPS):
    glow = i == 4
    im = sky(s)
    im.alpha_composite(shafts(1 + s))
    m = moo_glow if s >= 1 else moo
    im.alpha_composite(place(m, MOO_K, MOO_AT))
    me = placeL(moo_eye_mask, MOO_K, MOO_AT)
    if 0 < s < 1:
        # the white creeping over the brown eye from the light's side (upper left)
        cut = Image.new("L", (W, H))
        ImageDraw.Draw(cut).polygon([(0, 0), (W * 2 * s, 0), (0, H * 2 * s)], fill=255)
        part = ImageChops.multiply(me, cut)
        white = place(moo_glow, MOO_K, MOO_AT)
        im.paste(white, (0, 0), part)
    moon_layer = place(moon, MOON_K, MOON_AT)
    me2 = placeL(moon_eyes, MOON_K, MOON_AT)
    if s > 0:
        moon_layer.paste((255, 255, 255, 255), (0, 0), me2 if s >= 1 else ImageChops.multiply(me2, Image.new("L", (W, H), int(255 * s))))
    if s >= 1:
        im.alpha_composite(glow_ring(me, (255, 236, 150), 5 if glow else 3))
    im.alpha_composite(moon_layer)
    if s >= 1:
        im.alpha_composite(glow_ring(me2, (255, 236, 150), 5 if glow else 3))
    # the light falling on them, over everything, faint
    im.alpha_composite(shafts(0.35 + 0.4 * s))
    im.alpha_composite(sparkles(6 + int(10 * s), 30 + i, (0, 0, W, H)))
    im.convert("RGB").save(f"{OUT}/b-{i}.png")
print("ok")
