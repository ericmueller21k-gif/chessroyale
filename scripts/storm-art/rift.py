#!/usr/bin/env python3
"""
The rift the Stranger's storm tears in the board (Eric, Nov 27: "like somebody ripped open the board ... more graphical"): a deep
jagged rift down the board's middle, between his two swords. Depth (terraced walls down to a glow), lifted broken edges, floating chips
of board, lava and its glow on the fire side (left), ice crystals and frost on the other. Drawn once, offline, as stills: one per heal
stage (the rift closes from its ends and narrows each turn of the storm). The game only shows the picture, under the pieces.

  python3 scripts/storm-art/rift.py <out-dir> [soft|gba] [res]     # rift-1.png (whole), rift-2.png, rift-3.png

Units: the board is 0..1 both ways, y down. Needs numpy and Pillow.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render import BAYER, ICE, FIRE, over, ramp, smooth, unit, volume, samp  # noqa: E402

SS = 2
# How much of the rift is left at each stage: its length (a share of the board's height) and its width (a share of its widest).
STAGES = [dict(length=0.88, width=1.0, bits=1.0), dict(length=0.64, width=0.68, bits=0.6), dict(length=0.4, width=0.4, bits=0.3)]
MID = 0.545  # where it is widest: between his swords
WIDE = 0.058  # half its widest opening (about a square across at its widest)
BOARD_LIGHT = (240, 217, 181)
BOARD_DARK = (190, 172, 142)
# The GBA pass's palette: the dark of the deep, the rock, the board's two colors (chips), lava and ice.
RIFT_PAL = [(8, 4, 16), (40, 20, 24), (80, 48, 40), (128, 88, 64), (184, 152, 120), (240, 216, 176), (136, 16, 0), (216, 56, 8), (248, 136, 24), (255, 216, 80), (255, 248, 200), (24, 72, 160), (56, 136, 232), (136, 208, 255), (224, 244, 255)]


def jag(rng, lo, hi, step_lo, step_hi, value):
    """A jagged line's knots: positions from lo to hi, a value at each from `value(rng, position)`."""
    ks = [lo]
    while ks[-1] < hi:
        ks.append(ks[-1] + rng.uniform(step_lo, step_hi))
    ks = np.array(ks)
    return ks, np.array([value(rng, k) for k in ks])


class Rift:
    def __init__(self, seed=5):
        rng = np.random.default_rng(seed)
        # Its middle line: a jagged walk down the board, back through the middle where the swords are.
        kv, steps = jag(rng, 0.0, 1.0, 0.035, 0.085, lambda r, k: r.uniform(-0.034, 0.034))
        kx = np.cumsum(steps)
        kx = kx - np.linspace(kx[0], kx[-1], len(kx))  # no drift: it ends under where it starts
        kx = np.clip(kx, -0.07, 0.07)
        kx = kx - np.interp(MID, kv, kx) + 0.5
        self.mid = (kv, kx)
        # Each lip's own jaggedness (a share of the opening), and each lip's lifted slab (how far the broken edge reaches).
        self.lip_l = jag(rng, 0.0, 1.0, 0.014, 0.04, lambda r, k: r.uniform(0.35, 1.0))
        self.lip_r = jag(rng, 0.0, 1.0, 0.014, 0.04, lambda r, k: r.uniform(0.35, 1.0))
        self.slab_l = jag(rng, 0.0, 1.0, 0.03, 0.08, lambda r, k: r.uniform(0.012, 0.04))
        self.slab_r = jag(rng, 0.0, 1.0, 0.03, 0.08, lambda r, k: r.uniform(0.012, 0.04))
        self.terrace = jag(rng, 0.0, 1.0, 0.012, 0.03, lambda r, k: r.uniform(-0.14, 0.14))
        self.rng_seed = seed
        self.grain = volume((1, 256, 256), 6, 60, seed + 1, slope=0.9)
        self.low = volume((1, 128, 128), 2, 10, seed + 2, slope=1.1)

    def shape(self, v, stage):
        """At height v: the rift's middle, its left and right lips (x), for a stage. No opening where the lips meet."""
        half = STAGES[stage]["length"] / 2
        taper = np.clip(1 - (np.abs(v - MID) / half) ** 1.5, 0, 1) ** 1.1
        w = WIDE * STAGES[stage]["width"] * taper
        xc = np.interp(v, *self.mid)
        return xc, xc - w * np.interp(v, *self.lip_l), xc + w * np.interp(v, *self.lip_r), taper

    def draw(self, res, stage):
        st = STAGES[stage]
        R = res * SS
        c = (np.arange(R, dtype=np.float32) + 0.5) / R
        u, v = np.meshgrid(c, c)
        xc, xl, xr, taper = self.shape(v, stage)
        wide = xr - xl
        inside = (u > xl) & (u < xr) & (wide > 0.5 / R)
        dl = xl - u  # how far left of the left lip
        dr = u - xr
        near = np.where(u < xc, dl, dr)
        left = u < xc
        grain = unit(samp(self.grain, u * 2.3, v * 2.3, 0), 1.2)
        low = unit(samp(self.low, u * 1.7, v * 1.7, 0), 1.1)
        layer = np.zeros((R, R, 4), np.float32)
        on = smooth(0.0, 0.3, taper)  # the rift is here at all (fades toward its ends)

        # 1. The glow that spills onto the board either side: lava's on the left, the cold's on the right. Soft, see-through.
        spill = np.exp(-np.maximum(near, 0) / 0.055) * on * taper**0.5 * (0.75 + 0.25 * low) * (0.5 + 0.5 * st["width"])
        over(layer, np.where(left[..., None], np.array([255, 96, 16], np.float32), np.array([64, 160, 255], np.float32)), 0.32 * spill * (near > 0))
        # 2. The lifted, broken edges: each lip's slab tilts up toward the rift (catching light at the lip, in shade toward its
        #    break), ends at a dark break line, and throws a thin shadow on the board past it.
        for side, slab in ((True, self.slab_l), (False, self.slab_r)):
            reach = np.interp(v, *slab) * (0.45 + 0.55 * st["width"]) * (0.35 + 0.65 * taper)
            d = np.where(side, dl, dr)
            mine = (left == side) & (d > 0) & (taper > 0)
            t = np.clip(d / np.maximum(reach, 1e-5), 0, 1.6)
            over(layer, np.array([255, 246, 226], np.float32), 0.26 * np.clip(1 - t / 0.45, 0, 1) * mine * on)
            over(layer, np.array([44, 26, 18], np.float32), 0.36 * smooth(0.4, 1.0, t) * (t <= 1) * mine * on)
            over(layer, np.array([20, 10, 10], np.float32), 0.3 * np.clip(1 - (t - 1) / 0.35, 0, 1) * (t > 1) * mine * on)
            line = np.exp(-(((d - reach) / 0.0024) ** 2)) * mine * on
            over(layer, np.array([24, 12, 10], np.float32), 0.9 * line)
        # 3. Scorch and molten rock on the fire side's edge; rime on the ice side's.
        edge = np.exp(-np.maximum(near, 0) / 0.014) * on * (near > 0)
        over(layer, np.array([30, 12, 8], np.float32), 0.55 * edge * left * (0.35 + 0.65 * grain))
        melt = np.clip(np.exp(-np.maximum(dl, 0) / 0.02) * 1.5 - 1.25 * (1 - unit(samp(self.low, u * 6.1, v * 6.1, 0), 1.6)), 0, 1) * on * left * (near > 0)
        over(layer, ramp(np.clip(0.3 + 0.75 * melt, 0, 1), FIRE), smooth(0.0, 0.18, melt))
        over(layer, ramp(np.clip(0.55 + 0.45 * grain, 0, 1), ICE), 0.8 * np.clip(edge * 1.6 - 0.6 * (1 - grain), 0, 1) * ~left)

        img = Image.new("RGBA", (R, R), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img, "RGBA")
        rng = np.random.default_rng(self.rng_seed + 10)
        half = st["length"] / 2
        px = lambda x, y: (x * R, y * R)

        def lips_at(y):
            a = self.shape(np.float32(y), stage)
            return float(a[0]), float(a[1]), float(a[2]), float(a[3])

        # 4. Cracks running off the lips into the board: thin, jagged, a faint glow at their roots.
        for k in range(14):
            y = MID + rng.uniform(-0.43, 0.43)
            go_left = k % 2 == 0
            ang = (math.pi if go_left else 0.0) + rng.uniform(-0.9, 0.9)
            length = rng.uniform(0.035, 0.11)
            turns = [(rng.uniform(-0.7, 0.7), rng.uniform(0.3, 1.0)) for _ in range(5)]
            if abs(y - MID) > half * 0.92:
                continue
            _, l, r, tp = lips_at(y)
            at = [l if go_left else r, y]
            pts = [tuple(at)]
            for da, dn in turns[: 2 + int(3 * tp)]:
                ang += da
                seg = length * dn * (0.4 + 0.6 * tp) * (0.5 + 0.5 * st["width"]) / 2.2
                at = [at[0] + math.cos(ang) * seg, at[1] + math.sin(ang) * seg * 0.9]
                pts.append(tuple(at))
            glow = (255, 120, 24, 70) if go_left else (96, 184, 255, 80)
            draw.line([px(*q) for q in pts[:3]], fill=glow, width=max(2, int(0.01 * R)), joint="curve")
            # (Thicker at its root, a hairline at its tip.)
            for i in range(len(pts) - 1):
                draw.line([px(*pts[i]), px(*pts[i + 1])], fill=(22, 10, 10, 230), width=max(1, int(0.0058 * R * (1 - i / len(pts)))))
        cr = np.asarray(img.filter(ImageFilter.GaussianBlur(0.35 * SS)), np.float32)
        over(layer, cr[..., :3], cr[..., 3] / 255)

        # 5. The rift itself, looking down into it: terraced walls stepping down, darker with depth, to a glow in the deep: lava on the
        #    fire side, cold light on the other, a white-hot seam where they meet.
        a = np.clip((u - xl) / np.maximum(wide, 1e-6), 0, 1)
        fire_side = a < 0.5 + 0.08 * (low - 0.5)
        q = np.minimum(a, 1 - a) * 2 + np.interp(v, *self.terrace) * 0.75 + 0.08 * (grain - 0.5)
        # (Where it is narrow there is no room for walls: all deep.)
        room = smooth(0.006, 0.05, wide)
        q = q * room + (1 - room) * 0.7
        steps = [0.17, 0.34, 0.52]
        fire_rock = [(124, 84, 58), (78, 44, 34), (40, 20, 22), (10, 4, 12)]
        ice_rock = [(120, 160, 204), (58, 104, 172), (26, 56, 120), (6, 10, 28)]
        level = (q >= steps[0]).astype(np.int32) + (q >= steps[1]) + (q >= steps[2])
        rock = np.where(fire_side[..., None], np.array(fire_rock, np.float32)[level], np.array(ice_rock, np.float32)[level])
        rock = rock * (0.8 + 0.4 * grain[..., None])
        # (Each ledge's edge catches a little light; under it, its own shadow.)
        for sidx, sv in enumerate(steps):
            ledge = np.exp(-(((q - sv) / 0.022) ** 2)) * (q >= sv)
            rock = rock * (1 - 0.45 * ledge[..., None])
            lip = np.exp(-(((q - sv + 0.012) / 0.012) ** 2)) * (q < sv)
            rock = rock + lip[..., None] * np.where(fire_side[..., None], np.array([90, 50, 24], np.float32), np.array([70, 90, 110], np.float32)) * (1 - 0.25 * sidx)
        # (The fire side's walls: veins of lava. The ice side's: glints.)
        veins = np.clip(1 - np.abs(samp(self.grain, u * 1.1, v * 1.1, 0)) * 3.2, 0, 1) ** 3 * (level >= 1)
        rock = np.where(fire_side[..., None], rock * (1 - veins[..., None]) + ramp(np.clip(0.45 + 0.4 * veins, 0, 1), FIRE) * veins[..., None], rock + (grain[..., None] > 0.86) * 70)
        rock = np.clip(rock, 0, 255)
        deep = np.clip((q - steps[2]) / 0.4, 0, 1)
        flick = 0.7 + 0.6 * unit(samp(self.low, u * 9, v * 5, 0))
        lava = ramp(np.clip(0.38 + 0.66 * deep * flick, 0, 1), FIRE)
        facets = np.clip(1 - np.abs(samp(self.grain, u * 0.8 + 0.4, v * 0.8, 0)) * 2.4, 0, 1) ** 2
        cold = ramp(np.clip(0.28 + 0.6 * deep * flick + 0.3 * facets * deep, 0, 1), ICE)
        glow = np.where(fire_side[..., None], lava, cold)
        seam = np.exp(-(((a - 0.5 - 0.08 * (low - 0.5)) / 0.06) ** 2)) * deep
        glow = np.clip(glow + seam[..., None] * np.array([120, 100, 130], np.float32), 0, 255)
        into = smooth(0.0, 0.45, deep)[..., None]
        col = rock * (1 - into) + glow * into
        over(layer, col, inside.astype(np.float32))
        # (A hairline where it has all but closed: dark, with a thread of glow.)
        thin = np.exp(-(((u - xc) / 0.0028) ** 2)) * on * (wide < 0.006) * (taper > 0)
        over(layer, np.array([24, 10, 14], np.float32), 0.85 * thin)

        # 6. The lips' own edges: a bright rim where the broken board catches the light from below.
        rim = np.exp(-((np.abs(near) / 0.0028) ** 2)) * on * (wide > 0.004)
        over(layer, np.where(left[..., None], np.array([255, 196, 96], np.float32), np.array([208, 240, 255], np.float32)), 0.85 * rim * (near > -0.001))

        # 7. On the fire side: molten drops on the lip. On the ice side: crystals grown from the lip. Then the chips of board, afloat.
        img = Image.new("RGBA", (R, R), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img, "RGBA")
        rng = np.random.default_rng(self.rng_seed + 20)
        for k in range(30):
            y = MID + rng.uniform(-0.4, 0.4)
            length = rng.uniform(0.024, 0.062) * rng.choice([1, 1, 1.5])
            ang = rng.uniform(-1.15, 1.15) - 0.25
            wid = rng.uniform(0.2, 0.34)
            tone = rng.random()
            keep = rng.random() < st["bits"] + 0.2
            if abs(y - MID) > half * 0.88 or not keep:
                continue
            _, _, r, tp = lips_at(y)
            length *= 0.55 + 0.45 * tp
            bx, by = r - 0.002, y
            ca, sa = math.cos(ang), math.sin(ang)
            tip = (bx + ca * length, by + sa * length)
            nx, ny = -sa * length * wid, ca * length * wid
            mid = (bx + ca * length * 0.3, by + sa * length * 0.3)
            p1, p2 = (mid[0] + nx, mid[1] + ny), (mid[0] - nx, mid[1] - ny)
            base = (bx - ca * length * 0.05, by - sa * length * 0.05)
            draw.polygon([px(*base), px(*p1), px(*tip), px(*p2)], outline=(30, 92, 190, 230), width=max(1, int(0.003 * R)))
            draw.polygon([px(*base), px(*p1), px(*tip)], fill=(int(214 + 30 * tone), int(240 + 10 * tone), 255, 240))
            draw.polygon([px(*base), px(*tip), px(*p2)], fill=(int(74 + 40 * tone), int(150 + 30 * tone), 236, 232))
            draw.line([px(*base), px(*tip)], fill=(255, 255, 255, 240), width=max(1, int(0.002 * R)))
        bits = np.asarray(img.filter(ImageFilter.GaussianBlur(0.3 * SS)), np.float32)
        over(layer, bits[..., :3], bits[..., 3] / 255)

        shadow = Image.new("L", (R, R), 0)
        sdraw = ImageDraw.Draw(shadow)
        img = Image.new("RGBA", (R, R), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img, "RGBA")
        rng = np.random.default_rng(self.rng_seed + 30)
        for k in range(13):
            y = MID + rng.uniform(-0.36, 0.36)
            size = rng.uniform(0.016, 0.036)
            spot = rng.uniform(-1.1, 1.1)
            n = int(rng.integers(4, 6))
            angs = np.sort(rng.uniform(0, 2 * math.pi, n))
            rad = rng.uniform(0.55, 1.0, n)
            lightc = rng.random() < 0.5
            turn = rng.uniform(0, math.pi)
            lift = rng.uniform(0.006, 0.014)
            keep = rng.random() < st["bits"]
            if abs(y - MID) > half * 0.8 or not keep:
                continue
            xcn, l, r, tp = lips_at(y)
            x = xcn + spot * max(r - l, 0.02) * 0.75
            pts = [(x + math.cos(t + turn) * size * rr, y + math.sin(t + turn) * size * rr * 0.8) for t, rr in zip(angs, rad)]
            # Its shadow on the board (down and to the right: it floats), its thickness, its top, and a rim lit by its side's glow.
            sdraw.polygon([px(qx + lift * 1.1, qy + lift * 1.6) for qx, qy in pts], fill=150)
            thick = size * 0.28
            draw.polygon([px(qx, qy + thick) for qx, qy in pts], fill=(70, 46, 34, 255))
            top = BOARD_LIGHT if lightc else BOARD_DARK
            draw.polygon([px(*q) for q in pts], fill=top + (255,))
            rimc = (255, 170, 60, 255) if x < xcn else (170, 224, 255, 255)
            order = sorted(range(n), key=lambda i: pts[i][0], reverse=x < xcn)
            a0, a1 = order[0], order[1]
            draw.line([px(*pts[a0]), px(*pts[a1])], fill=rimc, width=max(1, int(0.0035 * R)))
            draw.line([px(*p) for p in pts] + [px(*pts[0])], fill=(60, 38, 28, 200), width=max(1, int(0.0018 * R)))
        sh = np.asarray(shadow.filter(ImageFilter.GaussianBlur(0.006 * R)), np.float32) / 255
        over(layer, np.array([10, 6, 14], np.float32), 0.5 * sh)
        chips = np.asarray(img.filter(ImageFilter.GaussianBlur(0.25 * SS)), np.float32)
        over(layer, chips[..., :3], chips[..., 3] / 255)
        return layer


def finish(layer, res, pix):
    a = np.clip(layer[..., 3], 0, 1)
    pm = np.dstack([layer[..., :3], a * 255]).astype(np.float32)
    h, w = a.shape
    small = pm.reshape(h // SS, SS, w // SS, SS, 4).mean(axis=(1, 3))
    sa = small[..., 3] / 255
    rgb = np.where(sa[..., None] > 1e-4, small[..., :3] / np.maximum(sa[..., None], 1e-4), 0)
    if not pix:
        return Image.fromarray(np.clip(np.dstack([rgb, small[..., 3]]) + 0.5, 0, 255).astype(np.uint8), "RGBA")
    # The GBA pass: its palette, dithered; its transparency in three hard levels.
    yy, xx = np.mgrid[0:res, 0:res]
    b = BAYER[yy % 4, xx % 4]
    aq = np.clip(np.floor(sa * 3 + 0.5 + (b - 0.5) * 0.4), 0, 3) / 3
    aq = np.where(sa < 0.09, 0, aq)
    c = rgb + (b[..., None] - 0.5) * 30
    pal = np.array(RIFT_PAL, np.float32)
    idx = np.argmin(((c[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(-1), axis=2)
    out = np.dstack([pal[idx], aq * 255])
    out[aq == 0] = 0
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), "RGBA")


def main():
    out = sys.argv[1]
    pix = len(sys.argv) > 2 and sys.argv[2] == "gba"
    res = int(sys.argv[3]) if len(sys.argv) > 3 else (202 if pix else 640)
    os.makedirs(out, exist_ok=True)
    rift = Rift()
    for stage in range(3):
        finish(rift.draw(res, stage), res, pix).save(os.path.join(out, f"rift-{stage + 1}.png"))
    print(f"{out}: 3 stages at {res} px{' (GBA pass)' if pix else ''}")


if __name__ == "__main__":
    main()
