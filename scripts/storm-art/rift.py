#!/usr/bin/env python3
"""
The rift the Stranger's storm tears in the board (Eric, Nov 27: "like somebody ripped open the board"; his reference: one central
impact, board chunks flying from it, a wide lava fissure to the lower left with flames out of it, a wide ice fissure to the upper
right with ice crystals erupting, thinner branches, real depth). GBA style: drawn smooth at four times the size, then scaled down to
the storm ring's own pixel size and put in one 15-color palette with ordered dithering.

Depth is drawn the way a top-down pixel game draws a pit: under each upper lip you see the board's thickness and the wall going down,
then the floor far below (lava on the fire side, ice on the other) with the wall's shadow on it.

Drawn once, offline: one short loop (FRAMES frames: the flames lick, the lava and crystals glint, the chunks bob) for each heal stage
(the rift closes from its ends and narrows each turn of the storm). The game only shows the pictures, under the pieces.

The opening (his storm's scene, STORM_SCENE in bosses/stranger.ts) tears it open: at the fire sword's slam a flash, the impact's pit,
the lava fissure ripping out to the lower left, its chunks bursting up; at the ice sword's the ice fissure ripping out to the upper
right, its crystals erupting, its chunks. OPEN_A frames from the first slam and OPEN_B from the second, 12 a second, ending on stage 1.

  python3 scripts/storm-art/rift.py <out-dir> [res=202]    # sheet.png: COLS a row: each stage's loop, then the opening's frames

Units: the board is 0..1 both ways, y down. Needs numpy and Pillow.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render import BAYER, FIRE, ICE, over, ramp, samp, smooth, unit, volume  # noqa: E402

SS = 4
FRAMES = 4
CENTER = (0.5, 0.545)  # the impact: between his two swords
# What is left at each stage: the fissures' length and width, the crater's size, how many chunks and crystals, the flames' height.
STAGES = [dict(length=1.0, width=1.0, crater=1.0, bits=1.0, flames=1.0), dict(length=0.72, width=0.74, crater=0.78, bits=0.6, flames=0.7), dict(length=0.44, width=0.5, crater=0.55, bits=0.3, flames=0.42)]
COLS = 8  # the sheet: frames a row
OPEN_A, OPEN_B = 9, 10  # the opening's frames: from the fire sword's slam, from the ice sword's
OPEN_FPS, LOOP_FPS = 12, 6
SLAMS = (1900, 2700)  # STORM_SCENE.fireAt, iceAt (ms)
SWORDS = ((CENTER[0] - 0.0356, CENTER[1]), (CENTER[0] + 0.0356, CENTER[1]))  # where each sword goes in (Stranger.tsx swordPoints)


def stage_state(i):
    """A heal stage as the drawing takes it: each number for the lava side and the ice side."""
    s = STAGES[i]
    return dict(length=[s["length"]] * 2, width=[s["width"]] * 2, crater=s["crater"], bits=[s["bits"]] * 2, flames=s["flames"], ice_on=True, burst=[1.0, 1.0], flash=None)


def opening_state(k):
    """The opening's frame k: how far each fissure has torn, the pit, the chunks' flight, the slam's flash; and the loop frame its
    flames show (the same clock the loop runs on after it)."""
    ease = lambda x: 1 - (1 - min(max(x, 0.0), 1.0)) ** 2
    if k < OPEN_A:
        ms = k * 1000 / OPEN_FPS
        gl, gi, on = 0.14 + 0.86 * ease(k / (OPEN_A - 1)), 0.0, False
        burst = [(k + 1) / OPEN_A, 0.0]
        flash = (LAVA, 1 - k / 2.0) if k < 2 else None
        crater = min(1.0, (k + 1) / 3)
    else:
        j = k - OPEN_A
        ms = SLAMS[1] - SLAMS[0] + j * 1000 / OPEN_FPS
        gl, gi, on = 1.0, 0.14 + 0.86 * ease(j / (OPEN_B - 1)), True
        burst = [1.0, (j + 1) / OPEN_B]
        flash = (ICY, 1 - j / 2.0) if j < 2 else None
        crater = 1.0
    st = dict(length=[gl, gi], width=[0.5 + 0.5 * gl, 0.5 + 0.5 * gi], crater=crater, bits=[1.0, 1.0], flames=0.35 + 0.65 * gl, ice_on=on, burst=burst, flash=flash)
    return st, int(ms * LOOP_FPS / 1000) % FRAMES

LAVA, ICY = 0, 1
BOARD_LIGHT = (240, 216, 176)
BOARD_DARK = (184, 152, 120)
# One palette (15-bit colors): the deep, rock, the board's two colors (its thickness, the chunks), lava, ice.
PAL = [(8, 4, 16), (40, 20, 24), (80, 48, 40), (128, 88, 64), BOARD_DARK, BOARD_LIGHT, (136, 16, 0), (216, 56, 8), (248, 136, 24), (255, 216, 80), (255, 248, 200), (24, 72, 160), (56, 136, 232), (136, 208, 255), (224, 244, 255)]


def walk(rng, start, ang, total, n, wobble):
    """A jagged line from `start`: n stretches, each off the heading by up to `wobble`."""
    pts = [start]
    for _ in range(n):
        a = ang + rng.uniform(-wobble, wobble)
        seg = total / n * rng.uniform(0.75, 1.25)
        pts.append((pts[-1][0] + math.cos(a) * seg, pts[-1][1] + math.sin(a) * seg))
    return pts


class Fissure:
    def __init__(self, rng, pts, wide, kind, fork=0.0):
        self.pts, self.wide, self.kind, self.fork = pts, wide, kind, fork
        segs = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:])]
        self.total = sum(segs)
        self.cum = np.concatenate([[0], np.cumsum(segs)])
        k = np.linspace(0, 1, 14)
        self.jit = [(k, rng.uniform(0.55, 1.0, len(k))), (k, rng.uniform(0.55, 1.0, len(k)))]

    def at(self, t):
        """The point at `t` along it (0..1) and its heading there."""
        s = min(max(t, 0.0), 0.9999) * self.total
        i = int(np.searchsorted(self.cum, s, side="right") - 1)
        a, b = self.pts[i], self.pts[i + 1]
        f = (s - self.cum[i]) / (self.cum[i + 1] - self.cum[i])
        return a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, math.atan2(b[1] - a[1], b[0] - a[0])

    def width(self, t, side, st):
        """Its half-width at `t` on a side (0 left of its heading, 1 right): widest at the impact, a point at its end."""
        length = max(st["length"][self.kind], 1e-4)
        left = np.clip(1 - t / length, 0, 1)
        return self.wide * st["width"][self.kind] * left**0.8 * np.interp(t, *self.jit[side])

    def field(self, u, v, st):
        """For every pixel: how deep into it (1 on its middle line, 0 at its lip, below 0 outside), and how far outside its lip."""
        best = np.full(u.shape, 1e9, np.float32)
        tt = np.zeros_like(u)
        sd = np.zeros(u.shape, np.int32)
        for i, (a, b) in enumerate(zip(self.pts, self.pts[1:])):
            abx, aby = b[0] - a[0], b[1] - a[1]
            l2 = abx * abx + aby * aby
            h = np.clip(((u - a[0]) * abx + (v - a[1]) * aby) / l2, 0, 1)
            d = np.hypot(u - (a[0] + h * abx), v - (a[1] + h * aby))
            near = d < best
            best = np.where(near, d, best)
            tt = np.where(near, (self.cum[i] + h * math.sqrt(l2)) / self.total, tt)
            sd = np.where(near, (abx * (v - a[1]) - aby * (u - a[0]) > 0).astype(np.int32), sd)
        w = np.where(sd == 0, self.width(tt, 0, st), self.width(tt, 1, st))
        q = np.where(w > 1e-5, 1 - best / np.maximum(w, 1e-5), -1.0)
        # (Past where it ends there is no lip: nothing of it out there.)
        return q, np.where(w > 1e-5, best - w, 1e9), w


class Rift:
    def __init__(self, seed=3):
        rng = np.random.default_rng(seed)
        self.seed = seed
        lava = Fissure(rng, walk(rng, CENTER, math.radians(133), 0.56, 9, 0.5), 0.05, LAVA)
        ice = Fissure(rng, walk(rng, CENTER, math.radians(-44), 0.54, 9, 0.5), 0.05, ICY)
        self.mains = [lava, ice]
        self.all = [lava, ice]
        # Thinner branches off each: alternately to either side.
        for main, base in ((lava, math.radians(133)), (ice, math.radians(-44))):
            for j, i in enumerate((2, 4, 6)):
                t = main.cum[i] / main.total
                turn = (1 if j % 2 == 0 else -1) * rng.uniform(0.65, 1.1)
                length = rng.uniform(0.11, 0.2) * (1 - 0.4 * t)
                self.all.append(Fissure(rng, walk(rng, main.pts[i], base + turn, length, 4, 0.45), 0.4 * 0.05 * (1 - t) ** 0.8 + 0.006, main.kind, fork=t))
        k = np.linspace(0, 2 * math.pi, 19)
        r = rng.uniform(0.72, 1.12, len(k))
        r[-1] = r[0]
        self.crater = (k, r)
        self.grain = volume((1, 256, 256), 6, 60, seed + 1, slope=0.9)
        self.low = volume((1, 128, 128), 2, 10, seed + 2, slope=1.1)
        self.lick = volume((FRAMES, 128, 128), 2, 16, seed + 3, slope=1.1, taniso=5)

    def draw(self, res, st, frame):
        R = res * SS
        tau = frame / FRAMES
        c = (np.arange(R, dtype=np.float32) + 0.5) / R
        u, v = np.meshgrid(c, c)
        grain = unit(samp(self.grain, u * 2.3, v * 2.3, 0), 1.2)
        low = unit(samp(self.low, u * 1.7, v * 1.7, 0), 1.1)

        # Every opening as one: how deep into the nearest (q), how far outside it (near), whose it is (kind), how wide it is there.
        q = np.full(u.shape, -1.0, np.float32)
        near = np.full(u.shape, 1e9, np.float32)
        kind = np.zeros(u.shape, np.int32)
        wide = np.zeros_like(u)
        for f in self.all:
            if st["length"][f.kind] <= 0 or f.fork > st["length"][f.kind] * 0.8:
                continue
            fq, fn, fw = f.field(u, v, st)
            closer = fn < near
            kind = np.where(closer, f.kind, kind)
            wide = np.where(closer, fw, wide)
            near = np.minimum(near, fn)
            q = np.maximum(q, fq)
        # The impact's crater: jagged, lava on the fire fissure's side of it, ice on the other.
        rx, ry = u - CENTER[0], v - CENTER[1]
        rho = np.hypot(rx, ry)
        rc = 0.072 * st["crater"] * np.interp(np.mod(np.arctan2(ry, rx), 2 * math.pi), *self.crater)
        cq = 1 - rho / rc
        axis = (-rx + ry) * 0.7071 + 0.02 * (low - 0.5)
        in_crater = cq > q
        kind = np.where((rho - rc < near) | in_crater, (axis < 0).astype(np.int32) if st["ice_on"] else LAVA, kind)
        wide = np.where(rho - rc < near, rc * 0.7, wide)
        near = np.minimum(near, rho - rc)
        q = np.maximum(q, cq)
        inside = q > 0
        lava_side = kind == LAVA
        layer = np.zeros((R, R, 4), np.float32)
        out = np.maximum(near, 0)
        there = smooth(0.0, 0.008, wide)  # its lips' marks on the board thin out to nothing at its ends

        # 1. The glow that spills onto the board: lava's, and the cold's. Soft, see-through.
        spill = np.exp(-out / 0.045) * (near > 0) * (0.7 + 0.3 * low) * np.clip(wide / 0.03, 0.25, 1) * there
        over(layer, np.where(lava_side[..., None], np.array([255, 96, 16], np.float32), np.array([64, 160, 255], np.float32)), 0.34 * spill)
        # 2. The lifted, broken edges: a slab along each lip, tilted up toward the rift (lit at the lip, shaded toward its break), a
        #    dark break line, and its thin shadow on the board past it.
        reach = (0.012 + 0.03 * unit(samp(self.low, u * 3.3 + 0.2, v * 3.3, 0), 1.6)) * np.clip(wide / 0.03, 0.3, 1)
        t = np.clip(out / reach, 0, 1.6)
        slab = (near > 0) * there
        over(layer, np.array([255, 246, 226], np.float32), 0.16 * np.clip(1 - t / 0.45, 0, 1) * slab)
        over(layer, np.array([44, 26, 18], np.float32), 0.42 * smooth(0.4, 1.0, t) * (t <= 1) * slab)
        over(layer, np.array([20, 10, 10], np.float32), 0.34 * np.clip(1 - (t - 1) / 0.35, 0, 1) * (t > 1) * slab)
        over(layer, np.array([24, 12, 10], np.float32), 0.9 * np.exp(-(((out - reach) / 0.0028) ** 2)) * slab)
        # 3. Scorch and molten rock over the fire side's lips; rime over the ice side's.
        edge = np.exp(-out / 0.014) * (near > 0) * there
        over(layer, np.array([30, 12, 8], np.float32), 0.55 * edge * lava_side * (0.35 + 0.65 * grain))
        melt = np.clip(np.exp(-out / 0.014) * 1.5 - 1.38 * (1 - unit(samp(self.low, u * 6.1, v * 6.1, 0), 1.6)), 0, 1) * lava_side * (near > 0) * there
        over(layer, ramp(np.clip(0.3 + 0.75 * melt, 0, 1), FIRE), smooth(0.0, 0.18, melt))
        over(layer, ramp(np.clip(0.55 + 0.45 * grain, 0, 1), ICE), 0.6 * np.clip(edge * 1.3 - 0.7 * (1 - grain), 0, 1) * ~lava_side)

        # 4. Hairline cracks running on from the branches' ends and off the lips.
        img = Image.new("RGBA", (R, R), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img, "RGBA")
        rng = np.random.default_rng(self.seed + 10)
        px = lambda x, y: (x * R, y * R)
        for f in self.all:
            for k in range(5 if f in self.mains else 2):
                t0 = rng.uniform(0.25, 0.95) if f in self.mains else rng.uniform(0.6, 1.0)
                turn = rng.choice([-1, 1]) * rng.uniform(0.5, 1.3)
                length = rng.uniform(0.04, 0.1)
                turns = [(rng.uniform(-0.7, 0.7), rng.uniform(0.4, 1.0)) for _ in range(4)]
                reach_t = st["length"][f.kind]
                if t0 > reach_t or f.fork > reach_t * 0.8:
                    continue
                x, y, ang = f.at(min(t0, reach_t * 0.98))
                ang += turn
                pts = [(x, y)]
                for da, dn in turns:
                    ang += da
                    pts.append((pts[-1][0] + math.cos(ang) * length * dn / 2, pts[-1][1] + math.sin(ang) * length * dn / 2))
                for i in range(len(pts) - 1):
                    draw.line([px(*pts[i]), px(*pts[i + 1])], fill=(22, 10, 10, 235), width=max(1, int(0.0062 * R * (1 - i / len(pts)))))
        cr = np.asarray(img, np.float32)
        over(layer, cr[..., :3], cr[..., 3] / 255 * (near > 0))

        # 5. Into the rift. Under each upper lip: the board's own thickness, then the wall going down into the dark. Below: the floor,
        #    far down (running lava on the fire side, blue ice on the other), the wall's shadow across it.
        run = np.zeros(u.shape, np.float32)  # how far below the opening's upper lip (pixels)
        for y in range(1, R):
            run[y] = np.where(inside[y], run[y - 1] + 1, 0)
        below = np.zeros(u.shape, np.float32)  # how far above its lower lip
        for y in range(R - 2, -1, -1):
            below[y] = np.where(inside[y], below[y + 1] + 1, 0)
        tall = (run + below) / R
        wall = np.clip(0.46 * tall, 0.0, 0.062)
        d = run / R
        # (Where it is only a crack there is no room for the board's edge or a lit wall: dark, with a thread of its floor.)
        thin = tall < 0.03
        slabh = np.where(thin, 0.0, np.minimum(0.011, wall * 0.3))
        on_slab = inside & (d < slabh)
        on_wall = inside & ~on_slab & (d < wall)
        floor = inside & ~on_slab & ~on_wall
        wd = np.where(thin, 1.0, np.clip((d - slabh) / np.maximum(wall - slabh, 1e-5), 0, 1))
        strata = 0.82 + 0.3 * unit(samp(self.grain, u * 0.9, v * 4.0, 0), 1.4)
        fire_wall = (np.array([120, 78, 54], np.float32) * (1 - wd[..., None]) ** 1.6 + np.array([14, 6, 12], np.float32) * (1 - (1 - wd[..., None]) ** 1.6)) * strata[..., None]
        ice_wall = (np.array([136, 196, 244], np.float32) * (1 - wd[..., None]) ** 1.6 + np.array([10, 28, 84], np.float32) * (1 - (1 - wd[..., None]) ** 1.6)) * strata[..., None]
        veins = np.clip(1 - np.abs(samp(self.grain, u * 1.1, v * 1.1, 0)) * 3.4, 0, 1) ** 3 * wd
        fire_wall = fire_wall * (1 - veins[..., None]) + ramp(np.clip(0.4 + 0.45 * veins, 0, 1), FIRE) * veins[..., None]
        over(layer, np.where(lava_side[..., None], fire_wall, ice_wall), on_wall.astype(np.float32))
        board = np.where((np.floor(u * 8) + np.floor(v * 8)) % 2 == 0, 1.0, 0.0)[..., None]
        edge_col = (np.array(BOARD_LIGHT, np.float32) * board + np.array(BOARD_DARK, np.float32) * (1 - board)) * 0.78
        over(layer, edge_col, on_slab.astype(np.float32))
        flick = unit(samp(self.lick, u * 5, v * 5 + tau, tau), 1.3)
        crust = unit(samp(self.grain, u * 1.6 + 0.3, v * 1.6, 0), 1.6)
        hot = np.clip(0.34 + 0.62 * q + 0.16 * (flick - 0.5) - 0.34 * (crust > 0.72) * (q < 0.55), 0, 1)
        facets = np.clip(1 - np.abs(samp(self.grain, u * 0.8 + 0.4, v * 0.8, 0)) * 2.4, 0, 1) ** 2
        cold = np.clip(0.02 + 0.3 * q + 0.5 * facets * (0.6 + 0.8 * (flick - 0.5)), 0, 1)
        fl = np.where(lava_side[..., None], ramp(hot, FIRE), ramp(cold, ICE))
        # (Where the two meet in the crater: a white-hot seam.)
        seam = np.exp(-((axis / 0.012) ** 2)) * (cq > 0.1)
        pit = smooth(0.12, 0.55, cq)[..., None] * in_crater[..., None]
        fl = fl * (1 - 0.82 * pit) + np.array([10, 4, 18], np.float32) * 0.82 * pit
        fl = np.clip(fl + seam[..., None] * np.array([230, 200, 230], np.float32), 0, 255)
        shade = 1 - 0.62 * np.exp(-np.maximum(d - wall, 0) / 0.014)
        over(layer, fl * shade[..., None], floor.astype(np.float32))
        # (The near lip's edge, and the far one's: a bright line where the broken board catches the light from below.)
        rim = np.exp(-((np.abs(near) / 0.0034) ** 2)) * smooth(0.008, 0.022, wide)
        over(layer, np.where(lava_side[..., None], np.array([255, 196, 96], np.float32), np.array([208, 240, 255], np.float32)), 0.9 * rim * (near > 0))

        # 6. Flames out of the lava: they rise from its floor past its lips, licking (each frame its own).
        src = (floor & lava_side & (q > 0.45) & ~((cq > 0.1) & in_crater)).astype(np.float32) * np.clip(wide / 0.04, 0.3, 1)
        col_tall = unit(samp(self.lick, u * 11, np.zeros_like(u) + 0.3, tau), 2.2)
        src = src * (col_tall > 0.42)
        height = 0.12 * st["flames"] * np.clip((col_tall - 0.42) / 0.5, 0.05, 1)
        decay = 1.0 / np.maximum(height * R, 1.0)
        fire = np.zeros_like(u)
        fire[R - 1] = src[R - 1]
        for y in range(R - 2, -1, -1):
            sway = int(round(1.5 * SS * math.sin(y / (5.0 * SS) + 2 * math.pi * tau)))
            fire[y] = np.maximum(src[y], np.roll(fire[y + 1], sway) - decay[y])
        turb = unit(samp(self.lick, u * 13 + 0.6, v * 9 + 1 * tau, tau), 1.4)
        heat = np.clip(fire * (0.7 + 0.5 * turb) - 0.12, 0, 1)
        over(layer, ramp(np.clip(0.25 + heat * 0.95, 0, 1), FIRE), smooth(0.12, 0.3, heat) * (1 - src) * 0.96)

        # 7. Ice crystals erupting from the ice fissure and its branches: clusters of spikes off both lips.
        img = Image.new("RGBA", (R, R), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img, "RGBA")
        rng = np.random.default_rng(self.seed + 20)
        for f in [x for x in self.all if x.kind == ICY]:
            main = f in self.mains
            for k in range(15 if main else 4):
                t0 = rng.uniform(0.04, 0.92)
                side = int(rng.integers(0, 2))
                spikes = [(rng.uniform(-0.85, 0.85), rng.uniform(0.45, 1.0), rng.uniform(0.16, 0.26), rng.random(), int(rng.integers(0, FRAMES))) for _ in range(int(rng.integers(2, 4)))]
                size = rng.uniform(0.055, 0.125) * (1 if main else 0.6)
                keep = rng.random() < st["bits"][ICY] + 0.15
                reach_t = st["length"][ICY]
                if t0 > reach_t * 0.92 or f.fork > reach_t * 0.8 or not keep:
                    continue
                x, y, ang = f.at(t0)
                w = float(f.width(np.float32(t0), side, st))
                out_ang = ang + (math.pi / 2 if side else -math.pi / 2)
                bx, by = x + math.cos(out_ang) * w * 0.8, y + math.sin(out_ang) * w * 0.8
                grow = size * (0.45 + 0.55 * (1 - t0 / reach_t)) * (0.6 + 0.4 * st["width"][ICY])
                for da, dl, wid, tone, glint in spikes:
                    a = out_ang + da
                    a = math.atan2(math.sin(a) - 0.35, math.cos(a))  # they lean upward: erupting
                    length = grow * dl
                    ca, sa = math.cos(a), math.sin(a)
                    tip = (bx + ca * length, by + sa * length)
                    nx, ny = -sa * length * wid, ca * length * wid
                    mid = (bx + ca * length * 0.28, by + sa * length * 0.28)
                    p1, p2 = (mid[0] + nx, mid[1] + ny), (mid[0] - nx, mid[1] - ny)
                    base = (bx - ca * length * 0.06, by - sa * length * 0.06)
                    draw.polygon([px(*base), px(*p1), px(*tip), px(*p2)], outline=(16, 48, 128, 255), width=SS + 2)
                    draw.polygon([px(*base), px(*p1), px(*tip)], fill=(int(214 + 30 * tone), int(240 + 10 * tone), 255, 255))
                    draw.polygon([px(*base), px(*tip), px(*p2)], fill=(int(48 + 30 * tone), int(124 + 30 * tone), 228, 255))
                    draw.line([px(*base), px(*p1), px(*tip), px(*p2), px(*base)], fill=(16, 48, 128, 255), width=SS)
                    draw.line([px(*base), px(*tip)], fill=(255, 255, 255, 255), width=max(1, int(0.003 * R)))
                    if glint == frame:
                        gx, gy = bx + ca * length * 0.55, by + sa * length * 0.55
                        g = 0.011
                        draw.line([px(gx - g, gy), px(gx + g, gy)], fill=(255, 255, 255, 255), width=max(1, int(0.005 * R)))
                        draw.line([px(gx, gy - g), px(gx, gy + g)], fill=(255, 255, 255, 255), width=max(1, int(0.005 * R)))
        bits = np.asarray(img, np.float32)
        over(layer, bits[..., :3], bits[..., 3] / 255)

        # 8. Chunks of board flying from the impact: each with its thickness, a rim lit by its side's glow, and its shadow on the
        #    board (the farther it has flown, the higher it is and the farther its shadow). They bob a pixel as the loop turns.
        shadow = Image.new("L", (R, R), 0)
        sdraw = ImageDraw.Draw(shadow)
        img = Image.new("RGBA", (R, R), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img, "RGBA")
        rng = np.random.default_rng(self.seed + 30)
        for k in range(15):
            ang = k / 15 * 2 * math.pi + rng.uniform(-0.2, 0.2)
            far = rng.uniform(0.075, 0.25)
            n = int(rng.integers(4, 7))
            angs = np.sort(rng.uniform(0, 2 * math.pi, n))
            rad = rng.uniform(0.6, 1.0, n)
            lightc = rng.random() < 0.5
            size = rng.uniform(0.02, 0.042) * (1.2 - 2.0 * far)
            phase = int(rng.integers(0, FRAMES))
            on_lava = (-math.cos(ang) + math.sin(ang) * 0.9) > 0
            mine = LAVA if on_lava else ICY
            keep = rng.random() < st["bits"][mine]
            b = st["burst"][mine]
            if not keep or b <= 0:
                continue
            # (Bursting out: it flies from the impact to its place, up in an arc on the way.)
            far *= (0.55 + 0.45 * st["crater"]) * (1 - (1 - b) ** 2)
            up = 0.075 * math.sin(math.pi * b) if b < 1 else 0.0
            bob = [0, -1, 0, 1][(frame + phase) % FRAMES] / res - up
            x, y = CENTER[0] + math.cos(ang) * far, CENTER[1] + math.sin(ang) * far * 0.9 + bob
            pts = [(x + math.cos(t) * size * rr, y + math.sin(t) * size * rr * 0.8) for t, rr in zip(angs, rad)]
            lift = 0.012 + 0.11 * far
            sdraw.polygon([px(qx + lift * 0.45, qy + lift - bob) for qx, qy in pts], fill=170)
            thick = size * 0.34
            draw.polygon([px(qx, qy + thick) for qx, qy in pts], fill=(80, 48, 40, 255))
            draw.polygon([px(*p) for p in pts], fill=(BOARD_LIGHT if lightc else BOARD_DARK) + (255,))
            order = sorted(range(n), key=lambda i: (pts[i][0] - CENTER[0]) ** 2 + (pts[i][1] - CENTER[1]) ** 2)
            draw.line([px(*pts[order[0]]), px(*pts[order[1]])], fill=(255, 170, 60, 255) if on_lava else (170, 224, 255, 255), width=max(1, int(0.006 * R)))
            draw.line([px(*p) for p in pts] + [px(*pts[0])], fill=(40, 20, 24, 255), width=max(1, int(0.004 * R)))
        sh = np.asarray(shadow.filter(ImageFilter.GaussianBlur(0.004 * R)), np.float32) / 255
        over(layer, np.array([10, 6, 14], np.float32), 0.5 * sh)
        chips = np.asarray(img, np.float32)
        over(layer, chips[..., :3], chips[..., 3] / 255)
        # 9. A slam's flash where its sword goes in: a white-hot burst, gone in two frames.
        if st["flash"] and st["flash"][1] > 0:
            which, power = st["flash"]
            sx, sy = SWORDS[which]
            fr = np.hypot(u - sx, v - sy)
            tint = np.array([255, 216, 80], np.float32) if which == LAVA else np.array([136, 208, 255], np.float32)
            over(layer, tint, 0.8 * power * np.exp(-((fr / 0.16) ** 2)))
            over(layer, np.array([255, 252, 236], np.float32), power * np.exp(-((fr / 0.075) ** 2)))
        return layer


def finish(layer, res):
    """Scaled down to the game's pixels, then the GBA pass: the palette, dithered; transparency in three hard levels."""
    a = np.clip(layer[..., 3], 0, 1)
    pm = np.dstack([layer[..., :3], a * 255]).astype(np.float32)
    h, w = a.shape
    small = pm.reshape(h // SS, SS, w // SS, SS, 4).mean(axis=(1, 3))
    sa = small[..., 3] / 255
    rgb = np.where(sa[..., None] > 1e-4, small[..., :3] / np.maximum(sa[..., None], 1e-4), 0)
    yy, xx = np.mgrid[0:res, 0:res]
    b = BAYER[yy % 4, xx % 4]
    aq = np.clip(np.floor(sa * 3 + 0.5 + (b - 0.5) * 0.4), 0, 3) / 3
    aq = np.where(sa < 0.1, 0, aq)
    c = rgb + (b[..., None] - 0.5) * 18
    pal = np.array(PAL, np.float32)
    idx = np.argmin(((c[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(-1), axis=2)
    out = np.dstack([pal[idx], aq * 255])
    out[aq == 0] = 0
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), "RGBA")


def main():
    out = sys.argv[1]
    res = int(sys.argv[2]) if len(sys.argv) > 2 else 202
    os.makedirs(out, exist_ok=True)
    rift = Rift()
    frames = []
    for stage in range(len(STAGES)):
        for frame in range(FRAMES):
            img = finish(rift.draw(res, stage_state(stage), frame), res)
            img.save(os.path.join(out, f"rift-{stage + 1}-{frame}.png"))
            frames.append(img)
    for k in range(OPEN_A + OPEN_B):
        st, frame = opening_state(k)
        img = finish(rift.draw(res, st, frame), res)
        img.save(os.path.join(out, f"open-{k:02d}.png"))
        frames.append(img)
    sheet = Image.new("RGBA", (res * COLS, res * ((len(frames) + COLS - 1) // COLS)), (0, 0, 0, 0))
    for i, img in enumerate(frames):
        sheet.paste(img, ((i % COLS) * res, (i // COLS) * res))
    sheet.save(os.path.join(out, "sheet.png"))
    print(f"{out}: {len(STAGES)} stages of {FRAMES} frames, the opening's {OPEN_A} + {OPEN_B}, {res} px; sheet {sheet.size}")


if __name__ == "__main__":
    main()
