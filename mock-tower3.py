from PIL import Image, ImageDraw, ImageFont
exec(open("../mock-tower2.py").read().split("LET = ")[0])  # palette, glyphs, T/F, block() for the top-down view
base = Image.open("no-tower.png").convert("RGBA")
OX, OY, SQ = 84, 459, 125.0
U = SQ / 32
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 46)
def sq_xy(sq):
    f = ord(sq[0]) - 97; r = int(sq[1]) - 1
    return OX + f * SQ, OY + (7 - r) * SQ
def panel(img, label):
    out = img.crop((40, 380, 1130, 1540)); d = ImageDraw.Draw(out)
    d.rectangle((0, 0, out.width, 66), fill=(30, 30, 30, 235)); d.text((18, 8), label, fill=(255, 255, 255, 255), font=FONT)
    return out
def sheet(outs, name):
    W = sum(o.width for o in outs) + 30 * (len(outs) - 1)
    sh = Image.new("RGBA", (W, outs[0].height), (255, 255, 255, 255)); x = 0
    for o_ in outs: sh.alpha_composite(o_, (x, 0)); x += o_.width + 30
    sh.convert("RGB").save(name)
def shadow(img, sq):
    x, y = sq_xy(sq)
    sh = Image.new("RGBA", (round(SQ * 0.9), round(SQ * 0.3)), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((0, 0, sh.width - 1, sh.height - 1), fill=(0, 0, 0, 70))
    img.alpha_composite(sh, (round(x + SQ * 0.05), round(y + SQ * 0.68)))

# ---- 1. Today's tower, over the pieces, see-through.
st10 = Image.frombytes("RGBA", (48, 136), open("stand10.rgba", "rb").read())
def today(img, sq, alpha):
    x, y = sq_xy(sq)
    im = st10.resize((round(48 * U), round(136 * U)), Image.NEAREST)
    if alpha < 1:
        a = im.getchannel("A").point(lambda v: int(v * alpha)); im.putalpha(a)
    img.alpha_composite(im, (round(x - 8 * U), round(y + SQ - 136 * U)))
o1 = base.copy(); today(o1, "g1", 0.5)
o2 = base.copy(); today(o2, "e4", 0.5)
sheet([panel(o1, "1: today's tower, see-through"), panel(o2, "1: see-through, middle of the board")], "opt1-see-through.png")

# ---- 2. In between (about 45 degrees): each block's front face shows (its letter), a short top face on the top block.
LET = "ABCBACABCA"
JX = [0, 1.5, -1, 2, -0.5, -2, 1, -1.5, 2, 0.5]
JY = [0, 0.5, -0.5, 0, 1, -0.5, 0, 0.5, -0.5, 0]
W2, TT, FF = 24, 9, 7
SMALL = {"A": [".#.", "#.#", "###", "#.#", "#.#"], "B": ["##.", "#.#", "##.", "#.#", "##."], "C": [".##", "#..", "#..", "#..", ".##"]}
def block45(letter, top):
    h = (TT if top else 0) + FF + 2
    im = Image.new("RGBA", (W2 + 2, h), (0, 0, 0, 0)); px = im.load()
    pan, panD = PAN[letter]
    t0 = 1
    if top:
        for yy in range(TT):
            for xx in range(W2):
                edge = xx < 2 or yy < 1 or xx >= W2 - 2 or yy >= TT - 1
                px[xx + 1, yy + 1] = (o if yy == 0 else O) if edge else pan
        t0 = TT + 1
    for yy in range(FF):
        for xx in range(W2):
            edge = xx < 2 or xx >= W2 - 2 or yy < 1 or yy >= FF - 1
            px[xx + 1, t0 + yy] = D if edge else panD
    g = SMALL[letter]; gx = (W2 - 3) // 2 + 1; gy = t0 + 1
    for r, row in enumerate(g):
        for c, ch in enumerate(row):
            if ch == "#": px[gx + c, gy + r] = Y
    d = ImageDraw.Draw(im); d.rectangle((0, 0, W2 + 1, h - 1), outline=K)
    if top: d.line((1, TT + 1, W2, TT + 1), fill=K)
    return im
def draw45(img, sq, n, grow=0.03):
    x, y = sq_xy(sq); cx = x + SQ / 2; bottom = y + SQ * 0.9
    shadow(img, sq)
    for k in range(n):
        s = U * (1 + grow * k); top = k == n - 1
        b = block45(LET[k], top); w, h = round(b.width * s), round(b.height * s)
        im = b.resize((w, h), Image.NEAREST)
        fy = bottom - FF * U * (k + 1)  # this block's front face top; each block sits on the one below
        yy = fy - ((TT * s) if top else 0) - 0 * U
        img.alpha_composite(im, (round(cx + JX[k] * U * 0.8 - w / 2), round(yy)))
b1 = base.copy(); draw45(b1, "g1", 10)
b2 = base.copy(); draw45(b2, "e4", 5)
b3 = base.copy(); draw45(b3, "e4", 10)
sheet([panel(b1, "2: in between, 10 blocks"), panel(b2, "2: 5 blocks, middle"), panel(b3, "2: 10 blocks, middle")], "opt2-45deg.png")

# ---- 3. Top-down, the count as a number on the top block.
DIG = {"0": [".#####.", "##...##", "##..###", "##.####", "###.###", "####.##", "###..##", "##...##", ".#####."],
       "1": ["...##..", "..###..", ".####..", "...##..", "...##..", "...##..", "...##..", "...##..", ".######"],
       "2": [".#####.", "##...##", ".....##", "....##.", "...##..", "..##...", ".##....", "##.....", "#######"],
       "3": [".#####.", "##...##", ".....##", ".....##", "..####.", ".....##", ".....##", "##...##", ".#####."],
       "4": ["....##.", "...###.", "..####.", ".##.##.", "##..##.", "#######", "....##.", "....##.", "....##."],
       "5": ["#######", "##.....", "##.....", "######.", ".....##", ".....##", ".....##", "##...##", ".#####."],
       "6": [".#####.", "##...##", "##.....", "######.", "##...##", "##...##", "##...##", "##...##", ".#####."],
       "7": ["#######", ".....##", "....##.", "...##..", "..##...", "..##...", "..##...", "..##...", "..##..."],
       "8": [".#####.", "##...##", "##...##", "##...##", ".#####.", "##...##", "##...##", "##...##", ".#####."],
       "9": [".#####.", "##...##", "##...##", "##...##", ".######", ".....##", ".....##", "##...##", ".#####."]}
def numbered(letter, n):
    im = block(letter); px = im.load(); pan, _ = PAN[letter]
    for yy in range(3, T - 1):  # clear the letter
        for xx in range(3, T - 1):
            if px[xx, yy] in (Y, y): px[xx, yy] = pan
    s = str(n); gw = 7 * len(s) + (1 if len(s) > 1 else 0)
    gx = (T - gw) // 2 + 1; gy = (T - 9) // 2 + 1
    for i, ch in enumerate(s):
        for r, row in enumerate(DIG[ch]):
            for c, v in enumerate(row):
                if v == "#":
                    px[gx + i * 8 + c + 1, gy + r + 1] = y
    for i, ch in enumerate(s):
        for r, row in enumerate(DIG[ch]):
            for c, v in enumerate(row):
                if v == "#": px[gx + i * 8 + c, gy + r] = Y
    return im
def drawtop(img, sq, n, grow=0.035, rise=2.4):
    x0, y0 = sq_xy(sq); cx, cy = x0 + SQ / 2, y0 + SQ / 2
    shadow(img, sq)
    for k in range(n):
        s = U * (1 + grow * k)
        b = numbered(LET[k], n) if k == n - 1 else block(LET[k])
        w, h = round(b.width * s), round(b.height * s)
        im = b.resize((w, h), Image.NEAREST)
        x = cx + JX[k] * U - w / 2
        yy = cy - (T / 2 + 1) * U - rise * U * k + JY[k] * U - (h - b.height * U) / 2
        img.alpha_composite(im, (round(x), round(yy)))
c1 = base.copy(); drawtop(c1, "g1", 10)
c2 = base.copy(); drawtop(c2, "e4", 3)
c3 = base.copy(); drawtop(c3, "e4", 10)
sheet([panel(c1, "3: from above, 10 blocks"), panel(c2, "3: 3 blocks, middle"), panel(c3, "3: 10 blocks, middle")], "opt3-top-numbers.png")
