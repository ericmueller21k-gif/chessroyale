"""
The God King's pixel portrait for his cut-in banner: a holy armoured king (spiked
gold crown on a steel helm, burning gold eyes in the visor, layered gold-trimmed
pauldrons, the king's cross on his chest, a crimson cape), drawn from shapes with
light from the top left, outlined, with golden sparks.

    python3 scripts/god-king-portrait.py   # writes god-king-portrait-w.png and -b.png in packages/app/public/sprites (needs ffmpeg)

Two versions, one per side: the same picture, his armour recoloured (white steel
for White, blackened steel for Black). Nothing else changes.

Also his battle-worn portrait for the Last Stand's banner (god-king-portrait-hurt-w.png and -b.png): cracked,
chipped, the cape torn, a few red drops; in both colours the same way.
"""
import json, math, random, subprocess
W, H = 64, 60
grid = [[None] * W for _ in range(H)]   # palette keys

def put(x, y, c):
    if 0 <= x < W and 0 <= y < H: grid[y][x] = c

def shade(base, x, y, cx, cy, rx, ry):
    """Light from the top-left: highlight, base, shadow, deep shadow."""
    nx = (x - cx) / max(rx, 1); ny = (y - cy) / max(ry, 1)
    l = -0.6 * nx - 0.8 * ny
    if l > 0.62: return base + "4"
    if l > 0.18: return base + "3"
    if l > -0.35: return base + "2"
    return base + "1"

def ellipse(cx, cy, rx, ry, base, clip=lambda x, y: True):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1 and clip(x, y):
                put(x, y, shade(base, x, y, cx, cy, rx, ry))

def poly(pts, base, cx=None, cy=None, rx=10, ry=10):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    cx = cx if cx is not None else sum(xs) / len(xs); cy = cy if cy is not None else sum(ys) / len(ys)
    for y in range(int(min(ys)), int(max(ys)) + 1):
        for x in range(int(min(xs)), int(max(xs)) + 1):
            px, py = x + .5, y + .5; inside = False
            for i in range(len(pts)):
                x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]
                if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1: inside = not inside
            if inside: put(x, y, shade(base, x, y, cx, cy, rx, ry))

# Cape behind (royal crimson).
poly([(2, 60), (6, 34), (20, 30), (44, 30), (58, 34), (62, 60)], "c", 32, 40, 30, 20)
# Pauldrons: one big rounded plate per shoulder; the overlapping lames are curved
# lines across it (a dark seam with a gold trim under it), not separate plates.
for side in (-1, 1):
    cx, cy, rx, ry = 32 + side * 19, 41, 13, 10.5
    ellipse(cx, cy, rx, ry, "s")
    for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            if not (0 <= x < W and 0 <= y < H and grid[y][x] and grid[y][x][0] == "s"): continue
            nx = (x + .5 - cx) / rx
            d = nx ** 2 + ((y + .5 - cy) / ry) ** 2
            if d > 0.8: put(x, y, "g2" if y > cy else "g3"); continue   # gold rim
            # seams curving down at the outer edge, like stacked lames
            bend = 2.2 * (nx * side) ** 2
            for seam in (cy - 2, cy + 3):
                if abs(y - (seam + bend)) < 0.5: put(x, y, "K")
                elif abs(y - (seam + bend + 1)) < 0.5: put(x, y, "g3")
    # spikes on the top plate
    for k in range(3):
        bx = cx + side * (k * 5 - 3)
        poly([(bx - 1.5, 31), (bx + 1.5, 31), (bx + side * 1.5, 24 + k)], "g", bx, 28, 2, 4)
# Chest plate and gorget.
poly([(21, 38), (43, 38), (41, 60), (23, 60)], "s", 32, 46, 11, 12)
for x in range(20, 45):
    for y in (36, 37, 38):
        if 20 <= x <= 44: put(x, y, "g3" if y == 36 else "g2")
for x in range(27, 38): put(x, 37, "g1"); put(x, 38, "s1")
# Emblem: a gold king's cross over a small crown, red jewel.
for y in range(43, 56): put(31, y, "g3"); put(32, y, "g2")
for x in range(27, 37): put(x, 47, "g3"); put(x, 48, "g2")
put(31, 47, "r3"); put(32, 47, "r3"); put(31, 48, "r2"); put(32, 48, "r2")
for x in (27, 36):
    for y in (46, 49): put(x, y, "g2")
# Helmet: rounded dome, angled cheek plates, pointed chin.
ellipse(32, 19, 13, 12, "s")
poly([(19, 19), (45, 19), (42, 31), (36, 36), (28, 36), (22, 31)], "s", 32, 22, 13, 13)
# Brow plate and crest.
for y in range(10, 16): put(32, y, "g3"); put(31, y, "g2")
for x in range(20, 45): put(x, 16, "s1")
# Visor: a dark slit; the brows angle down to meet in the middle (a stern V).
slit = {}
for x in range(20, 45):
    d = abs(x + 0.5 - 32)
    top = 18 + int((12 - d) // 3)
    slit[x] = top
    for y in range(top, top + 3): put(x, y, "k1")
    put(x, top - 1, "s1")          # a hard, angry brow over the slit
for y in range(slit[32] + 3, 34): put(32, y, "s3"); put(31, y, "s2")
# Breathing holes on the cheek plates.
for (x, y) in [(25, 28), (26, 30), (38, 28), (37, 30), (24, 26), (39, 26), (27, 32), (36, 32)]: put(x, y, "k1")
# Burning gold eyes: bright cores in the slit, glow spilling out.
for ex in (25, 37):
    for dx in range(0, 3):
        y0 = slit[ex + dx] + 1
        put(ex + dx, y0, "e4")
        put(ex + dx, y0 - 1, "e3")
        put(ex + dx, y0 + 1, "e2")
    put(ex - 1, slit[ex - 1] + 1, "e3"); put(ex + 3, slit[ex + 3] + 1, "e3")
    put(ex - 2, slit[ex - 2] + 1, "e2"); put(ex + 4, slit[ex + 4] + 1, "e2")
# Crown: five gold spikes on a band, the tallest with a cross, jewels.
for x in range(18, 47):
    for y in (7, 8, 9):
        if grid[y][x] or y == 9: put(x, y, "g3" if y == 7 else "g2")
for i, (bx, h) in enumerate([(20, 4), (26, 6), (32, 7), (38, 6), (44, 4)]):
    poly([(bx - 2, 7.5), (bx + 2, 7.5), (bx, 7.5 - h)], "g", bx, 5, 2, 4)
for y in range(-3, 0): pass
for y in range(0, 3): put(32, y, "g4"); put(31, y, "g3")
for x in range(30, 34): put(x, 0, "g4")
for (x, c) in [(25, "b3"), (31, "r3"), (38, "b3")]: put(x, 8, c); put(x + 1, 8, c[0] + "2")
# Battle-worn (his Last Stand's banner): the same king, cracked and chipped but unbowed. Cracks across the helm,
# a cheek plate, a pauldron and the chest plate; a crown spike broken off; the cape's hem in tatters; a few
# stylised red drops. Only damage: the gold, the burning eyes and the cape's colour stay as they are.
def crack(g, pts):
    """A jagged crack through the armour: a dark split, shadow on one side, a bright chipped edge on the other."""
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        n = max(abs(x2 - x1), abs(y2 - y1), 1)
        for i in range(n + 1):
            x = round(x1 + (x2 - x1) * i / n); y = round(y1 + (y2 - y1) * i / n)
            if not (0 <= x < W and 0 <= y < H and g[y][x]): continue
            g[y][x] = "K"
            if x - 1 >= 0 and g[y][x - 1] and g[y][x - 1][0] == "s": g[y][x - 1] = "s1"
            if x + 1 < W and g[y][x + 1] and g[y][x + 1][0] in "sg" and g[y][x + 1] != "K": g[y][x + 1] = g[y][x + 1][0] + "4"

def drop(g, x, y):
    """A stylised red drop: a bright top, a dark round bottom."""
    for (dx, dy, c) in [(0, 0, "r3"), (0, 1, "r3"), (-1, 1, "r2"), (1, 1, "r3"), (0, 2, "r2"), (-1, 2, "r2"), (1, 2, "r2")]:
        if 0 <= x + dx < W and 0 <= y + dy < H: g[y + dy][x + dx] = c
    g[y + 1][x] = "c4"

def damaged(src):
    g = [r[:] for r in src]
    crack(g, [(42, 10), (39, 12), (41, 14), (37, 17)])            # helm, over the right brow
    crack(g, [(21, 23), (24, 26), (22, 29), (25, 33)])            # left cheek plate
    crack(g, [(46, 33), (50, 36), (48, 40), (53, 43), (51, 48)])  # right pauldron
    crack(g, [(38, 39), (35, 43), (37, 46), (33, 50), (35, 55)])  # chest plate, through the cross
    crack(g, [(14, 36), (17, 40), (14, 44)])                     # left pauldron
    for (x, y) in [(12, 45), (13, 46), (19, 47), (45, 38), (55, 45), (56, 46), (24, 52), (40, 56), (28, 14), (29, 14)]:   # dents
        if g[y][x] and g[y][x][0] == "s": g[y][x] = "s1"
    for y in range(0, 6):                                         # a crown spike broken off
        for x in range(42, 47): g[y][x] = None
    for x in (4, 5, 10, 11, 12, 17, 47, 48, 53, 54, 55, 59):      # the cape's hem, torn
        for y in range(56 if x % 2 else 57, H):
            if g[y][x] and g[y][x][0] == "c": g[y][x] = None
    for (x, y) in [(25, 34), (36, 56), (54, 49)]:                 # a few red drops, from the cracks
        drop(g, x, y)
    return g

def outline(src, seed, sparks):
    """Outline everything, then sparks around him."""
    g = [r[:] for r in src]
    for y in range(H):
        for x in range(W):
            if src[y][x] is None and any(0 <= x + dx < W and 0 <= y + dy < H and src[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                g[y][x] = "K"
    random.seed(seed)
    for _ in range(26):
        x, y = random.randrange(W), random.randrange(H)
        if g[y][x] is None: g[y][x] = random.choice(sparks)
    return g

PALETTE = {
    "K": "#0b0b14", "k1": "#0b0b14",
    "s4": "#f4f7fb", "s3": "#c3ccd9", "s2": "#8692a5", "s1": "#4a5366",
    "g4": "#fff1a8", "g3": "#f2c14e", "g2": "#c48a1c", "g1": "#7a5410",
    # The cape: royal crimson, so it stands out against the banner's navy.
    "c4": "#f87171", "c3": "#dc2626", "c2": "#991b1b", "c1": "#5f0f14",
    "e4": "#fffbe0", "e3": "#ffd54a", "e2": "#f59e0b",
    "r3": "#ef4444", "r2": "#991b1b", "b3": "#60a5fa", "b2": "#1d4ed8",
    "p1": "#ffe08a", "p2": "#fbbf24",
    # Embers (the battle-worn portrait's sparks).
    "x1": "#ff7a3d", "x2": "#ffb347",
}
# Black: the same pixels, the steel blackened (gold, eyes, cape and sparks unchanged).
BLACK_STEEL = {"s4": "#7b8494", "s3": "#4a515f", "s2": "#2c313b", "s1": "#171a20"}
for name, picture in (("god-king-portrait", outline(grid, 4, ["p1", "p2"])), ("god-king-portrait-hurt", outline(damaged(grid), 9, ["p1", "x1", "x2"]))):
    for side, palette in (("w", PALETTE), ("b", {**PALETTE, **BLACK_STEEL})):
        rgba = bytearray()
        for row in picture:
            for c in row:
                h = palette[c] if c else None
                rgba += bytes([int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255]) if h else bytes(4)
        out = f"packages/app/public/sprites/{name}-{side}.png"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-i", "-", "-frames:v", "1", out], input=bytes(rgba), check=True)
        print("wrote", out)
