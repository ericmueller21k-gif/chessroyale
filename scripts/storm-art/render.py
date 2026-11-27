#!/usr/bin/env python3
"""
The Stranger's storm, drawn once (Eric, Nov 27: "a realistic blend of shards of fire and ice tornado ... it should be a fairly quick
loop ... like a GIF basically"). Renders the ring's loop offline: fire up the left of the board and across the top, frost wind and
crystal shards down the right and along the bottom, both swirling the same way round, meeting top and bottom. The game only plays the
frames back (components/Stranger.tsx `StormRing`): nothing is drawn per particle at play time.

  python3 scripts/storm-art/render.py <out-dir> [frames=30] [res=400] [all|fire|ice|frost] [soft|gba]
  python3 scripts/storm-art/pack.py <out-dir> packages/app/src/assets/stranger-storm   # the shipped sheet and its frost

It writes, in <out-dir>: fire-NN.png and ice-NN.png (one cell each a frame, straight alpha) and frost.png (the still frost and icicles).
Everything loops: every noise is periodic in time and every drift is a whole number of periods a loop.

Units: the board is 1 wide, centered on (0, 0), y down. The frame is the board and MARGIN past it each side (RING.margin in the game).
Needs numpy and Pillow.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

MARGIN = 0.12
SPAN = 1 + 2 * MARGIN
HALF = 0.5
RAD = 0.09  # the ring's path: the board's outline with rounded corners
B = HALF - RAD
ARC = math.pi * RAD / 2
PERIM = 8 * B + 4 * ARC
CELL = 0.68  # each element's cell: its own side of the frame and the part of the other where they meet
SS = 2  # drawn at twice the size, then scaled down
# The Game Boy Advance pass (Eric, Nov 27: "a bit more Game Boy Advance style, but still keep the details"): the same storm at a low
# size, each element in a small palette (15-bit colors), ordered dithering between its colors, its glow in hard see-through bands.
PIX = False
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) + 0.5) / 16
FIRE_PAL = [(96, 8, 0), (144, 16, 0), (192, 40, 8), (232, 72, 8), (248, 112, 16), (248, 152, 24), (255, 192, 56), (255, 224, 112), (255, 248, 176), (255, 255, 232)]
ICE_PAL = [(16, 48, 112), (24, 80, 168), (40, 112, 216), (64, 144, 240), (96, 184, 248), (136, 208, 255), (176, 228, 255), (208, 240, 255), (232, 248, 255), (255, 255, 255)]


def pixel(img, palette, x0):
    """The pass itself, on a finished frame: its colors to the palette (dithered), its transparency to three hard levels."""
    a = np.asarray(img, np.float32)
    rgb, al = a[..., :3], a[..., 3] / 255
    h, w = al.shape
    yy, xx = np.mgrid[0:h, 0:w]
    b = BAYER[yy % 4, (xx + x0) % 4]
    levels = 3
    aq = np.clip(np.floor(al * levels + 0.5 + (b - 0.5) * 0.4), 0, levels) / levels
    aq = np.where(al < 0.07, 0, aq)
    c = rgb + (b[..., None] - 0.5) * 32
    pal = np.array(palette, np.float32)
    idx = np.argmin(((c[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(-1), axis=2)
    out = np.dstack([pal[idx], aq * 255])
    out[aq == 0] = 0
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), "RGBA")


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- noise that loops (in space and in time)


def volume(shape, lo, hi, seed, slope=1.0, taniso=6.0):
    """A noise volume (time, y, x), periodic on every axis: random phases, a band of frequencies lo..hi (cycles a period)."""
    rng = np.random.default_rng(seed)
    nt, ny, nx = shape
    ft = np.fft.fftfreq(nt) * nt
    fy = np.fft.fftfreq(ny) * ny
    fx = np.fft.rfftfreq(nx) * nx
    fs = np.sqrt(fy[None, :, None] ** 2 + fx[None, None, :] ** 2)
    f = np.sqrt(fs**2 + (ft[:, None, None] * taniso) ** 2)
    f[0, 0, 0] = 1.0
    amp = f ** (-slope) * smooth(lo * 0.5, lo, f) * (1 - smooth(hi, hi * 1.6, f))
    amp[0, 0, 0] = 0.0
    spec = amp * np.exp(2j * np.pi * rng.random(amp.shape))
    v = np.fft.irfftn(spec, s=shape, axes=(0, 1, 2))
    v = (v - v.mean()) / v.std()
    return v.astype(np.float32)


def samp(vol, x, y, t):
    """The volume at (x, y) in periods and time t in loops, about normal (mean 0, deviation 1)."""
    nt, ny, nx = vol.shape
    tt = (t % 1.0) * nt
    t0 = int(math.floor(tt)) % nt
    t1 = (t0 + 1) % nt
    ft = tt - math.floor(tt)
    xx = np.mod(x, 1.0) * nx
    yy = np.mod(y, 1.0) * ny
    x0 = np.floor(xx).astype(np.int32)
    y0 = np.floor(yy).astype(np.int32)
    fx = (xx - x0).astype(np.float32)
    fy = (yy - y0).astype(np.float32)
    x0 %= nx
    y0 %= ny
    x1 = (x0 + 1) % nx
    y1 = (y0 + 1) % ny

    def bil(a):
        return (a[y0, x0] * (1 - fx) + a[y0, x1] * fx) * (1 - fy) + (a[y1, x0] * (1 - fx) + a[y1, x1] * fx) * fy

    return bil(vol[t0]) * (1 - ft) + bil(vol[t1]) * ft


def unit(v, k=0.9):
    """About normal -> 0..1, evenly."""
    return 0.5 + 0.5 * np.tanh(v * k)


# ---------------------------------------------------------------- the ring: where a point is along it, and how far off it


def ring_coords(res, x_from, x_to):
    """For each pixel of the frame's columns x_from..x_to (shares of the frame): its x, y (board units), its way along the ring
    (board units, from the bottom's middle, the way the storm turns: left along the bottom, up the left, right along the top, down the
    right) and its distance from the ring's path (outward positive)."""
    cols = np.arange(int(round(x_from * res)), int(round(x_to * res)))
    cx = (cols + 0.5) / res * SPAN - SPAN / 2
    cy = (np.arange(res) + 0.5) / res * SPAN - SPAN / 2
    x, y = np.meshgrid(cx.astype(np.float32), cy.astype(np.float32))
    qx = np.clip(x, -B, B)
    qy = np.clip(y, -B, B)
    dx = x - qx
    dy = y - qy
    dist = np.hypot(dx, dy)
    inner = dist < 1e-7
    d = np.where(inner, np.maximum(np.abs(x), np.abs(y)) - HALF, dist - RAD)
    # (Inside the path's inner box: the nearest side by the larger coordinate.)
    side_x = np.where(inner, np.abs(x) >= np.abs(y), np.abs(dx) > 0) & ~(np.abs(dy) > 0)
    side_y = ~side_x & ~((np.abs(dx) > 0) & (np.abs(dy) > 0))
    corner = (np.abs(dx) > 0) & (np.abs(dy) > 0)
    phi = np.mod(np.arctan2(dy, dx), 2 * math.pi)
    s = np.zeros_like(x)
    bottom = side_y & (y > 0)
    top = side_y & (y <= 0)
    left = side_x & (x < 0)
    right = side_x & (x >= 0)
    s = np.where(bottom & (x <= 0), -x, s)
    s = np.where(bottom & (x > 0), PERIM - x, s)
    s = np.where(left, B + ARC + (B - y), s)
    s = np.where(top, 3 * B + 2 * ARC + (x + B), s)
    s = np.where(right, 5 * B + 3 * ARC + (y + B), s)
    s = np.where(corner & (x < 0) & (y > 0), B + RAD * (phi - math.pi / 2), s)
    s = np.where(corner & (x < 0) & (y < 0), 3 * B + ARC + RAD * (phi - math.pi), s)
    s = np.where(corner & (x > 0) & (y < 0), 5 * B + 2 * ARC + RAD * (phi - 1.5 * math.pi), s)
    s = np.where(corner & (x > 0) & (y > 0), 7 * B + 3 * ARC + RAD * phi, s)
    return x, y, s.astype(np.float32), d.astype(np.float32)


def ring_point(s, d):
    """The point `d` off the ring's path at `s` along it, and the way the storm moves there (a unit vector)."""
    s = s % PERIM
    marks = [B, B + ARC, 3 * B + ARC, 3 * B + 2 * ARC, 5 * B + 2 * ARC, 5 * B + 3 * ARC, 7 * B + 3 * ARC, 7 * B + 4 * ARC]
    r = RAD + d

    def corner(cx, cy, phi):
        return cx + r * math.cos(phi), cy + r * math.sin(phi), -math.sin(phi), math.cos(phi)

    if s < marks[0]:
        return -s, B + r, -1.0, 0.0
    if s < marks[1]:
        return corner(-B, B, math.pi / 2 + (s - marks[0]) / RAD)
    if s < marks[2]:
        return -B - r, B - (s - marks[1]), 0.0, -1.0
    if s < marks[3]:
        return corner(-B, -B, math.pi + (s - marks[2]) / RAD)
    if s < marks[4]:
        return -B + (s - marks[3]), -B - r, 1.0, 0.0
    if s < marks[5]:
        return corner(B, -B, 1.5 * math.pi + (s - marks[4]) / RAD)
    if s < marks[6]:
        return B + r, -B + (s - marks[5]), 0.0, 1.0
    if s < marks[7]:
        return corner(B, B, (s - marks[6]) / RAD)
    return B - (s - marks[7]), B + r, -1.0, 0.0


def reach(sn):
    """How far past the board the storm reaches at `sn` (0..1 round the ring), a share of its full reach: little along the bottom, so
    the line under the board (what to do, the clock) stays readable on a phone and a computer."""
    return 1 - 0.72 * (1 - smooth(0.1, 0.16, np.minimum(sn, 1 - sn)))


def to_px(x, y, res, x_from):
    return (x + SPAN / 2) / SPAN * res - x_from * res, (y + SPAN / 2) / SPAN * res


# ---------------------------------------------------------------- colors


def ramp(h, stops):
    xs = [p for p, _ in stops]
    out = np.empty(h.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = np.interp(h, xs, [col[c] for _, col in stops])
    return out


FIRE = [(0.0, (96, 6, 0)), (0.2, (172, 22, 2)), (0.4, (232, 66, 6)), (0.58, (255, 128, 14)), (0.74, (255, 190, 48)), (0.88, (255, 234, 140)), (1.0, (255, 252, 232))]
ICE = [(0.0, (22, 70, 150)), (0.25, (44, 124, 214)), (0.5, (96, 190, 248)), (0.72, (170, 228, 255)), (0.88, (224, 246, 255)), (1.0, (255, 255, 255))]


def over(dst, rgb, a):
    """Straight-alpha `rgb`/`a` over the layer `dst` (premultiplied, float, 0..1 alpha, 0..255 color times alpha)."""
    dst[..., :3] = rgb * a[..., None] + dst[..., :3] * (1 - a[..., None])
    dst[..., 3] = a + dst[..., 3] * (1 - a)


def splat(dst, px, py, radius, rgb, alpha):
    """A soft dot, over the layer."""
    r = int(math.ceil(radius * 3))
    x0, y0 = int(math.floor(px)) - r, int(math.floor(py)) - r
    x1, y1 = x0 + 2 * r + 2, y0 + 2 * r + 2
    h, w = dst.shape[:2]
    if x1 <= 0 or y1 <= 0 or x0 >= w or y0 >= h:
        return
    xa, ya, xb, yb = max(x0, 0), max(y0, 0), min(x1, w), min(y1, h)
    gx = np.arange(xa, xb) + 0.5 - px
    gy = np.arange(ya, yb) + 0.5 - py
    a = alpha * np.exp(-(gx[None, :] ** 2 + gy[:, None] ** 2) / (2 * radius * radius)).astype(np.float32)
    a = np.minimum(a, 1.0)
    over(dst[ya:yb, xa:xb], np.array(rgb, np.float32), a)


def finish(layer, res_out):
    """A premultiplied float layer -> a straight-alpha image, scaled down."""
    a = np.clip(layer[..., 3], 0, 1)
    rgb = np.where(a[..., None] > 1e-4, layer[..., :3] / np.maximum(a[..., None], 1e-4), 0)
    # (Premultiplied through the scaling, so a clear pixel's color never bleeds in.)
    pm = np.dstack([np.clip(rgb, 0, 255) * a[..., None], a * 255]).astype(np.float32)
    h, w = a.shape
    small = pm.reshape(h // SS, SS, w // SS, SS, 4).mean(axis=(1, 3))
    sa = small[..., 3] / 255
    out = np.dstack([np.where(sa[..., None] > 1e-4, small[..., :3] / np.maximum(sa[..., None], 1e-4), 0), small[..., 3]])
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), "RGBA")


# ---------------------------------------------------------------- fire


class Fire:
    def __init__(self, res, seed=11):
        self.res = res
        self.x_from, self.x_to = 0.0, CELL
        self.x, self.y, self.s, self.d = ring_coords(res, self.x_from, self.x_to)
        self.sn = self.s / PERIM
        self.tongue = volume((24, 192, 192), 2, 9, seed, slope=1.3, taniso=8)
        self.detail = volume((24, 256, 256), 4, 24, seed + 1, slope=1.5, taniso=7)
        self.warp = volume((16, 128, 128), 2, 8, seed + 2, slope=1.0, taniso=6)
        self.tall = volume((16, 16, 256), 2, 12, seed + 3, slope=0.8, taniso=4)
        rng = np.random.default_rng(seed + 4)
        self.embers = [
            dict(s=rng.uniform(0.02, 0.5) * PERIM, lives=int(rng.choice([1, 1, 2])), ph=rng.random(), out=rng.uniform(0.05, 0.13) * rng.choice([1, 1, 1, -0.5]), run=rng.uniform(0.25, 0.75), wig=rng.uniform(0.004, 0.014), wf=int(rng.integers(1, 4)), size=rng.uniform(0.7, 1.5), d0=rng.uniform(-0.01, 0.03))
            for _ in range(150)
        ]
        # (Its side of the ring: from the bottom's middle, up the left, to the top's middle, and a little past each where the two meet.)
        self.edge = smooth(0.0, 0.012, self.x - (-SPAN / 2)) * smooth(0.0, 0.012, self.y + SPAN / 2) * smooth(0.0, 0.012, SPAN / 2 - self.y) * smooth(0.0, 0.03, (self.x_to * SPAN - SPAN / 2) - self.x)

    def frame(self, t):
        s, sn, d = self.s, self.sn, self.d
        d0 = 0.008
        dd = d - d0
        up = np.maximum(dd, 0)
        lean = 1.25
        # (Where a point's flame comes from along the ring: flames lean the way the storm turns.)
        wx = samp(self.warp, sn * 6 - 1 * t, d * 3 - t, t)
        wy = samp(self.warp, sn * 6 - 1 * t + 0.37, d * 3 + 0.61 - t, t)
        sl = sn - (lean * up + 0.012 * wx * (0.3 + up * 9)) / PERIM
        yy = dd + 0.006 * wy * (0.3 + up * 8)
        # Each stretch of the ring's flames: how tall just now (tongues in groups, moving round).
        tall = unit(samp(self.tall, sl * 7 - 1 * t, np.zeros_like(sl), t), 1.1)
        tall2 = unit(samp(self.tall, sl * 17 - 2 * t + 0.5, np.zeros_like(sl) + 0.5, t), 1.0)
        hgt = 0.098 * (0.34 + 0.62 * tall + 0.34 * tall2) * reach(sn)
        hin = 0.04 * (0.2 + 0.5 * tall + 0.6 * tall2)
        v = np.where(yy >= 0, yy / hgt, -yy / hin)
        # The tongues: noise stretched along the flame, climbing it.
        n1 = samp(self.tongue, sl * 11 - 2 * t, yy * 1.6 - 1 * t, t)
        n2 = samp(self.detail, sl * 15 - 3 * t + 0.3, yy * 2.6 - 1 * t, t)
        turb = 0.4 * n1 + 0.17 * n2
        heat = (1.08 - v) + turb * (0.35 + 0.85 * np.clip(v, 0, 1.4))
        # (Tips thin to points: the higher, the more the noise decides.)
        heat = heat - 0.22 * np.clip(v, 0, 2) ** 2
        heat = np.clip(heat, 0, 1.25)
        # (Over the board the flames stay orange and see-through: no white wash on the edge squares.)
        heat = heat * (1 - 0.42 * smooth(0.008, -0.02, np.maximum(np.abs(self.x), np.abs(self.y)) - HALF))
        # Its side.
        bnd = 0.022 * samp(self.warp, sn * 9 + 0.2, d * 5 - t, t)
        side = smooth(-0.03, 0.035, sn + bnd + np.where(sn > 0.75, -1.0, 0.0)) * (1 - smooth(0.47, 0.545, sn + bnd))
        heat = heat * side
        db = np.maximum(np.abs(self.x), np.abs(self.y)) - HALF  # the board's own square edge (its corners too)
        inside = smooth(0.0, -0.03, db)  # over the board: see-through
        layer = np.zeros(heat.shape + (4,), np.float32)
        # The glow: wide and soft, a warm light on the board's edge.
        flick = 0.8 + 0.2 * unit(samp(self.warp, sn * 4 - t, np.zeros_like(sn), t))
        glow = np.exp(-((np.maximum(dd, 0) / (0.075 * reach(sn))) ** 2)) * np.exp(-((np.minimum(dd, 0) / 0.034) ** 2)) * side * flick
        over(layer, np.array([255, 84, 10], np.float32), 0.32 * glow)
        a = smooth(0.03, 0.34, heat) * (0.96 - 0.42 * inside)
        col = ramp(np.clip((heat - 0.08) / 0.98, 0, 1), FIRE)
        over(layer, col, a)
        # Embers and sparks, drifting off.
        res, big = self.res, self.res / (400 * 1.0)
        for e in self.embers:
            life = (e["ph"] + e["lives"] * t) % 1.0
            es = e["s"] + e["run"] * life
            esn = (es % PERIM) / PERIM
            if esn > 0.56 and esn < 0.97:
                continue
            ed = e["d0"] + e["out"] * life**0.8 + e["wig"] * math.sin(2 * math.pi * (e["wf"] * life + e["ph"]))
            ed = ed * float(reach(np.float32(esn))) if ed > 0 else ed
            x, y, _, _ = ring_point(es, ed)
            px, py = to_px(x, y, res, self.x_from)
            fade = math.sin(math.pi * min(1.0, life * 1.15)) ** 0.7 * (1 - smooth(0.5, 0.56, np.float32(esn)) if esn < 0.9 else 1.0)
            hot = 1 - life
            rgb = (255, 150 + 100 * hot, 30 + 170 * hot * hot)
            splat(layer, px, py, 2.4 * e["size"] * big, (255, 110, 20), 0.3 * fade)
            splat(layer, px, py, (1.7 if PIX else 0.95) * e["size"] * big, rgb, 0.95 * fade)
        layer *= self.edge[..., None]
        return layer


# ---------------------------------------------------------------- ice


def shard_shape(rng):
    """A crystal shard, 2 long (x from -1 to 1): its outline and the ridge that splits its lit face from its shaded one."""
    w = rng.uniform(0.2, 0.36)
    pts = [(1.0, 0.0), (rng.uniform(0.1, 0.45), w * rng.uniform(0.8, 1.1)), (-rng.uniform(0.7, 0.95), w * rng.uniform(0.25, 0.6)), (-1.0, -w * rng.uniform(0.0, 0.3)), (-rng.uniform(0.0, 0.4), -w * rng.uniform(0.7, 1.0))]
    return pts


class Ice:
    def __init__(self, res, seed=23):
        self.res = res
        self.x_from, self.x_to = 1 - CELL, 1.0
        self.x, self.y, self.s, self.d = ring_coords(res, self.x_from, self.x_to)
        self.sn = self.s / PERIM
        self.wind = volume((24, 256, 256), 3, 30, seed, slope=1.1, taniso=5)
        self.mist = volume((16, 128, 128), 2, 10, seed + 1, slope=1.2, taniso=5)
        self.warp = volume((16, 128, 128), 2, 7, seed + 2, slope=1.0, taniso=6)
        rng = np.random.default_rng(seed + 3)
        self.shards = [
            dict(s=rng.uniform(0.46, 0.98) * PERIM, ph=rng.random(), arc=rng.uniform(0.35, 1.0), d=rng.uniform(-0.035, 0.085), wob=rng.uniform(0.004, 0.02), wf=int(rng.integers(1, 3)), size=rng.uniform(0.016, 0.034) * rng.choice([1, 1, 1.6, 2.1]), spin=int(rng.choice([-1, 0, 0, 1])), tilt=rng.uniform(-0.7, 0.7), shape=shard_shape(rng), tone=rng.uniform(0.0, 1.0))
            for _ in range(54)
        ]
        self.specks = [
            dict(s=rng.uniform(0.44, 1.02) * PERIM, lives=int(rng.choice([1, 2, 2])), ph=rng.random(), run=rng.uniform(0.3, 0.9), d=rng.uniform(-0.05, 0.1), out=rng.uniform(-0.02, 0.03), wig=rng.uniform(0.003, 0.012), wf=int(rng.integers(1, 4)), size=rng.uniform(0.6, 1.3))
            for _ in range(190)
        ]
        self.ribbons = [
            dict(ph=rng.random(), d=rng.uniform(-0.03, 0.095), amp=rng.uniform(0.006, 0.026), wl=rng.uniform(0.3, 0.8), wph=rng.random(), len=rng.uniform(0.5, 1.2), w=rng.uniform(0.003, 0.0075), start=rng.uniform(0.38, 0.62), arc=rng.uniform(1.3, 2.7), bright=rng.uniform(0.55, 1.0), curl=rng.uniform(-0.03, 0.04))
            for _ in range(20)
        ]
        self.edge = smooth(0.0, 0.012, SPAN / 2 - self.x) * smooth(0.0, 0.012, self.y + SPAN / 2) * smooth(0.0, 0.012, SPAN / 2 - self.y) * smooth(0.0, 0.03, self.x - (self.x_from * SPAN - SPAN / 2))

    def side_at(self, sn):
        """Its side of the ring at `sn` (0..1 round it): from the top's middle, down the right, to the bottom's middle."""
        a = (sn - 0.455) / 0.075
        b = ((sn if sn > 0.25 else sn + 1) - 0.965) / 0.075
        f = lambda u: max(0.0, min(1.0, u)) ** 2 * (3 - 2 * max(0.0, min(1.0, u)))
        return f(a) * (1 - f(b))

    def frame(self, t):
        sn, d = self.sn, self.d
        res, big = self.res, self.res / 400
        wx = samp(self.warp, sn * 5 - 1 * t, d * 3, t)
        bnd = 0.022 * samp(self.warp, sn * 9 + 0.7, d * 5 + t, t)
        snw = np.where(sn < 0.25, sn + 1.0, sn)
        side = smooth(0.455, 0.53, sn + bnd) * (1 - smooth(0.965, 1.04, snw + bnd))
        # Across the band: from a little over the board's edge squares to the frame's edge, most at the board's edge.
        k = reach(sn)
        dk = np.where(d > 0, d / k, d)
        env = smooth(-0.085, 0.0, d) * (1 - smooth(0.035, 0.118, dk))
        env_wide = smooth(-0.1, -0.01, d) * (1 - smooth(0.05, 0.12, dk))
        inside = smooth(0.0, -0.04, np.maximum(np.abs(self.x), np.abs(self.y)) - HALF)
        # The wind: long thin streaks along the ring, waving, at two speeds.
        dw = d + 0.014 * wx
        n1 = samp(self.wind, sn * 3 - 2 * t, dw * 9.0, t)
        n2 = samp(self.wind, sn * 5 - 3 * t + 0.41, dw * 14.0 + 0.3, t)
        n3 = samp(self.wind, sn * 2 - 1 * t + 0.77, dw * 5.0 + 0.6, t)
        st1 = np.clip(1 - np.abs(n1) * 1.5, 0, 1) ** 3
        st2 = np.clip(1 - np.abs(n2) * 1.7, 0, 1) ** 4
        st3 = np.clip(1 - np.abs(n3) * 1.2, 0, 1) ** 2
        gust = 0.55 + 0.45 * unit(samp(self.mist, sn * 3 - 2 * t, d * 2, t))
        mist = unit(samp(self.mist, sn * 4 - 1 * t + 0.2, d * 4 + 0.4, t), 1.2)
        layer = np.zeros(sn.shape + (4,), np.float32)
        # A cold haze under it all (deeper blue, so it reads on a light board too).
        over(layer, np.array([36, 112, 214], np.float32), 0.34 * env_wide * side * (0.4 + 0.6 * mist) * (1 - 0.6 * inside))
        body = (0.5 * st3 + 0.2 * mist) * gust
        over(layer, ramp(np.clip(0.2 + 0.55 * body, 0, 1), ICE), np.clip(0.5 * body * env * side, 0, 1) * (1 - 0.5 * inside))
        bright = np.clip(0.7 * st1 + 0.55 * st2, 0, 1) * gust
        over(layer, ramp(np.clip(0.5 + 0.5 * bright, 0, 1), ICE), np.clip(0.55 * bright * env * side, 0, 1) * (1 - 0.5 * inside))
        # Ribbons of wind: long bright strokes that run the ring's ice side on waving tracks, a bright head and a long thinning tail.
        su = np.where(self.s < 0.25 * PERIM, self.s + PERIM, self.s)
        core = np.zeros_like(sn)
        halo = np.zeros_like(sn)
        for r in self.ribbons:
            life = (r["ph"] + t) % 1.0
            head = r["start"] * PERIM + r["arc"] * life
            u = (head - su) / r["len"]
            taper = smooth(0.0, 0.06, u) * (1 - smooth(0.25, 1.0, u)) * math.sin(math.pi * life) ** 0.5 * r["bright"]
            mid = r["d"] + r["amp"] * np.sin(2 * math.pi * (su / r["wl"] + r["wph"])) + 0.004 * math.sin(2 * math.pi * (t + r["wph"]))
            # (Its head curls off its track, out or in.)
            mid = mid + r["curl"] * (1 - smooth(0.0, 0.3, u)) ** 2
            mid = np.where(mid > 0, mid * k, mid)
            off = d - mid
            wid = r["w"] * (0.45 + 0.55 * np.clip(1 - u, 0, 1))
            core += np.exp(-((off / wid) ** 2)) * taper
            halo += np.exp(-((off / (wid * 3.2)) ** 2)) * taper
        vis = side * smooth(-0.1, -0.04, d) * (1 - smooth(0.095, 0.118, dk)) * (1 - 0.4 * inside)
        over(layer, np.array([64, 156, 246], np.float32), np.clip(0.42 * halo, 0, 0.6) * vis)
        over(layer, ramp(np.clip(0.7 + 0.3 * core, 0, 1), ICE), np.clip(0.95 * core, 0, 0.95) * vis)
        # Snow specks, blown along: each a short streak.
        for e in self.specks:
            life = (e["ph"] + e["lives"] * t) % 1.0
            fade = math.sin(math.pi * life) ** 0.6
            for k, w in ((0.0, 1.0), (0.012, 0.5), (0.024, 0.25)):
                es = e["s"] + e["run"] * (life - k)
                ed = e["d"] + e["out"] * life + e["wig"] * math.sin(2 * math.pi * (e["wf"] * life + e["ph"]))
                ed = ed * float(reach(np.float32((es % PERIM) / PERIM))) if ed > 0 else ed
                f = fade * w * self.side_at((es % PERIM) / PERIM)
                if f < 0.02:
                    continue
                x, y, _, _ = ring_point(es, ed)
                px, py = to_px(x, y, res, self.x_from)
                splat(layer, px, py, (1.4 if PIX else 0.8) * e["size"] * big, (240, 250, 255), 0.9 * f)
        # Crystal shards, whipping round: drawn as two faces, a lit one and a shaded one, with a bright ridge.
        img = Image.new("RGBA", (layer.shape[1], layer.shape[0]), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img, "RGBA")
        for e, dt, wt in [(e, dt, wt) for e in self.shards for dt, wt in ((-0.011, 0.45), (0.011, 0.45), (0.0, 1.0))]:
            life = (e["ph"] + t + dt) % 1.0
            es = e["s"] + e["arc"] * life
            f = wt * math.sin(math.pi * life) ** 0.5 * self.side_at((es % PERIM) / PERIM)
            if f < 0.03:
                continue
            ed = e["d"] + e["wob"] * math.sin(2 * math.pi * (e["wf"] * life + e["ph"]))
            ed = ed * float(reach(np.float32((es % PERIM) / PERIM))) if ed > 0 else ed
            x, y, tx, ty = ring_point(es, ed)
            ang = math.atan2(ty, tx) + e["tilt"] + e["spin"] * 2 * math.pi * life
            ca, sa = math.cos(ang), math.sin(ang)
            half = e["size"] / SPAN * res
            cx, cy = to_px(x, y, res, self.x_from)
            pts = [(cx + (px * ca - py * sa) * half, cy + (px * sa + py * ca) * half) for px, py in e["shape"]]
            tip, tail = pts[0], pts[3]
            lit = (int(214 + 30 * e["tone"]), int(240 + 10 * e["tone"]), 255, int(225 * f))
            shade = (int(70 + 40 * e["tone"]), int(150 + 30 * e["tone"]), int(236), int(215 * f))
            draw.polygon(pts, fill=None, outline=(38, 104, 200, int(150 * f)), width=SS if PIX else max(1, int(round(1.2 * big))))
            draw.polygon([tip, pts[1], pts[2], tail], fill=lit)
            draw.polygon([tip, tail, pts[4]], fill=shade)
            draw.line([tip, tail], fill=(255, 255, 255, int(235 * f)), width=SS if PIX else max(1, int(round(0.9 * big))))
            gx, gy = cx + (0.35 * ca) * half, cy + (0.35 * sa) * half
            gr = max(1.0, 0.12 * half)
            draw.ellipse([gx - gr, gy - gr, gx + gr, gy + gr], fill=(255, 255, 255, int(240 * f)))
        sh = np.asarray(img, np.float32)
        over(layer, sh[..., :3], sh[..., 3] / 255)
        layer *= self.edge[..., None]
        return layer


# ---------------------------------------------------------------- the still frost and icicles (drawn once, sharper)


def frost(res, seed=41):
    """The right half's frost: rime along the board's edge, icicles from the top-right and bottom-right. A still, at a higher size."""
    rng = np.random.default_rng(seed)
    x_from = 1 - CELL
    x, y, s, d = ring_coords(res, x_from, 1.0)
    sn = s / PERIM
    fine = volume((1, 512, 512), 6, 90, seed, slope=0.9)
    low = volume((1, 128, 128), 2, 9, seed + 1, slope=1.1)
    # (The board's own square edge, not the ring's rounded path.)
    db = np.maximum(np.abs(x), np.abs(y)) - HALF
    snw = np.where(sn < 0.25, sn + 1.0, sn)
    side = smooth(0.5, 0.6, sn) * (1 - smooth(0.9, 1.0, snw))
    grow = 0.55 + 0.75 * unit(samp(low, sn * 5, np.zeros_like(sn), 0))
    crust = unit(samp(fine, x * 3.1, y * 3.1, 0), 1.3)
    # Rime: a crust from the board's edge inward a little and outward a little more, thinning to crystals.
    reach = np.where(db < 0, -db / (0.012 * grow), db / (0.03 * grow))
    rime = np.clip(1.15 - reach - 0.75 * (1 - crust), 0, 1) * side
    layer = np.zeros(x.shape + (4,), np.float32)
    over(layer, ramp(np.clip(0.45 + 0.6 * crust * rime, 0, 1), ICE), smooth(0.0, 0.35, rime) * 0.9)
    layer = (layer * 1.0).copy()
    img = Image.new("RGBA", (x.shape[1], x.shape[0]), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")

    def px(bx, by):
        return to_px(bx, by, res, x_from)

    def icicle(bx, by, length, width):
        """One icicle hanging from (bx, by): a tapered spike, a lit left face, a shaded right one, a white glint."""
        bend = rng.uniform(-0.12, 0.12) * width
        tipx, tipy = bx + bend, by + length
        l, r = bx - width / 2, bx + width / 2
        mid = bx - width * 0.12
        draw.polygon([px(l, by), px(mid, by), px(tipx, tipy)], fill=(226, 246, 255, 215))
        draw.polygon([px(mid, by), px(r, by), px(tipx, tipy)], fill=(120, 190, 244, 190))
        draw.line([px(l + width * 0.2, by + length * 0.06), px(bx + bend * 0.5 - width * 0.1, by + length * 0.6)], fill=(255, 255, 255, 235), width=max(1, res // 500))
        draw.ellipse([px(bx - width * 0.62, by - width * 0.3), px(bx + width * 0.62, by + width * 0.3)], fill=(214, 240, 255, 225))

    # Top-right: from the board's top edge, longer toward the corner. Bottom-right: from its bottom edge, shorter.
    for edge_y, count, longest, x0 in ((-HALF, 16, 0.088, 0.03), (HALF, 13, 0.05, 0.1)):
        xs = np.sort(rng.uniform(x0, HALF - 0.006, count))
        for bx in xs:
            toward = (bx - x0) / (HALF - x0)
            length = longest * (0.3 + 0.7 * toward) * rng.uniform(0.45, 1.0)
            icicle(bx, edge_y - 0.002, length, rng.uniform(0.012, 0.022) * (0.7 + 0.6 * toward))
    ic = np.asarray(img, np.float32)
    over(layer, ic[..., :3], ic[..., 3] / 255)
    return layer, x_from


# ---------------------------------------------------------------- main


def main():
    global PIX
    out = sys.argv[1]
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    res = int(sys.argv[3]) if len(sys.argv) > 3 else 400
    only = sys.argv[4] if len(sys.argv) > 4 else "all"
    PIX = len(sys.argv) > 5 and sys.argv[5] == "gba"
    os.makedirs(out, exist_ok=True)
    big = res * SS
    if only in ("all", "fire"):
        fire = Fire(big)
        for i in range(n):
            img = finish(fire.frame(i / n), res)
            (pixel(img, FIRE_PAL, 0) if PIX else img).save(os.path.join(out, f"fire-{i:02d}.png"))
    if only in ("all", "ice"):
        ice = Ice(big)
        for i in range(n):
            img = finish(ice.frame(i / n), res)
            (pixel(img, ICE_PAL, res - img.width) if PIX else img).save(os.path.join(out, f"ice-{i:02d}.png"))
    if only in ("all", "frost"):
        # (The still frost: twice the frames' size when soft, so its icicles stay sharp; the frames' own pixels in the GBA pass.)
        k = 1 if PIX else 2
        layer, _ = frost(res * k * SS)
        img = finish(layer, res * k)
        (pixel(img, ICE_PAL, res - img.width) if PIX else img).save(os.path.join(out, "frost.png"))
    print(f"{out}: {n} frames at {res} px (cells {int(round(CELL * res))} x {res})")


if __name__ == "__main__":
    main()
