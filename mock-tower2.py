from PIL import Image, ImageDraw, ImageFont
base = Image.open("no-tower.png").convert("RGBA")
cur = Image.open("with-tower.png").convert("RGBA")
def H(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5)) + (255,)
K, o, O, D = H("#2a1712"), H("#f6d08e"), H("#d9a159"), H("#a26f33")
Y, y = H("#fff4d0"), H("#c9b98e")
PAN = {"A": (H("#e2483f"), H("#a52a26")), "B": (H("#3d7fe0"), H("#2554a8")), "C": (H("#3cb24c"), H("#24782f"))}
BIG = {"A": ["..###..", ".##.##.", "##...##", "##...##", "##...##", "#######", "##...##", "##...##", "##...##"],
       "B": ["######.", "##...##", "##...##", "##...##", "######.", "##...##", "##...##", "##...##", "######."],
       "C": [".#####.", "##...##", "##.....", "##.....", "##.....", "##.....", "##.....", "##...##", ".#####."]}
T, F = 24, 6  # top face size and front face height, art px
def block(letter):
    """A toy block seen from above and a little in front: a big top face, a short front face under it."""
    im = Image.new("RGBA", (T + 2, T + F + 2), (0, 0, 0, 0)); px = im.load()
    pan, panD = PAN[letter]
    for yy in range(T):  # top face
        for xx in range(T):
            edge = xx < 2 or yy < 2 or xx >= T - 2 or yy >= T - 2
            px[xx + 1, yy + 1] = (o if (xx == 0 or yy == 0) else O) if edge else pan
    g = BIG[letter]; gx = (T - 7) // 2 + 1; gy = (T - 9) // 2 + 1
    for r, row in enumerate(g):
        for c, ch in enumerate(row):
            if ch == "#": px[gx + c + 1, gy + r + 1] = y
    for r, row in enumerate(g):
        for c, ch in enumerate(row):
            if ch == "#": px[gx + c, gy + r] = Y
    for yy in range(F):  # front face: wood rim and a darker panel strip
        for xx in range(T):
            edge = xx < 1 or xx >= T - 1 or yy >= F - 1
            px[xx + 1, T + 1 + yy] = D if edge else (pan if yy < F - 3 else panD)
    for yy in range(T + F + 2):  # outline
        for xx in range(T + 2):
            if px[xx, yy][3] == 0 and any(0 <= xx + dx < T + 2 and 0 <= yy + dy < T + F + 2 and px[xx + dx, yy + dy][3] > 0 and px[xx + dx, yy + dy] != K for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                pass
    d = ImageDraw.Draw(im); d.rectangle((0, 0, T + 1, T + F + 1), outline=K)
    d.line((1, T + 1, T, T + 1), fill=K)
    return im
LET = "ABCBACABCA"
JX = [0, 1.5, -1, 2, -0.5, -2, 1, -1.5, 2, 0.5]
JY = [0, 0.5, -0.5, 0, 1, -0.5, 0, 0.5, -0.5, 0]
OX, OY, SQ = 84, 459, 125.0
U = SQ / 32
def sq_center(sq):
    f = ord(sq[0]) - 97; r = int(sq[1]) - 1
    return OX + (f + 0.5) * SQ, OY + (7 - r + 0.5) * SQ
def draw(img, sq, n, grow=0.035, rise=2.4):
    cx, cy = sq_center(sq)
    sh = Image.new("RGBA", (round(SQ * 0.95), round(SQ * 0.35)), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((0, 0, sh.width - 1, sh.height - 1), fill=(0, 0, 0, 70))
    img.alpha_composite(sh, (round(cx - sh.width / 2), round(cy + SQ * 0.22)))
    for k in range(n):
        s = U * (1 + grow * k)
        b = block(LET[k]); w, h = round(b.width * s), round(b.height * s)
        im = b.resize((w, h), Image.NEAREST)
        x = cx + JX[k] * U - w / 2
        # the bottom block's top face sits on the square; each one up rises `rise` art px and grows
        y = cy - (T / 2 + 1) * U - rise * U * k + JY[k] * U - (h - b.height * U) / 2
        img.alpha_composite(im, (round(x), round(y)))
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 46)
def panel(img, label):
    out = img.crop((40, 380, 1130, 1540)); d = ImageDraw.Draw(out)
    d.rectangle((0, 0, out.width, 66), fill=(30, 30, 30, 235)); d.text((18, 8), label, fill=(255, 255, 255, 255), font=FONT)
    return out
def sheet(outs, name):
    W = sum(o.width for o in outs) + 30 * (len(outs) - 1)
    sh = Image.new("RGBA", (W, outs[0].height), (255, 255, 255, 255)); x = 0
    for o_ in outs: sh.alpha_composite(o_, (x, 0)); x += o_.width + 30
    sh.convert("RGB").save(name)
a = base.copy(); draw(a, "g1", 10)
b = base.copy(); draw(b, "e4", 10)
c = base.copy(); draw(c, "e4", 5)
sheet([panel(cur, "Today: 10 blocks"), panel(a, "Idea: 10 blocks, same square")], "tower-3d-v2-g1.png")
sheet([panel(c, "Idea: 5 blocks, middle of the board"), panel(b, "Idea: 10 blocks, middle of the board")], "tower-3d-v2-e4.png")
# close-up of the 10 on e4
b.crop((480, 760, 900, 1180)).resize((840, 840), Image.NEAREST).convert("RGB").save("tower-3d-v2-zoom.png")
