/**
 * The town square's sky, drawn: its gradient, the stars at night, the sun or the moon low over the horizon, and the
 * clouds up in the sky. Everything is made once (per look and box size) and only placed each frame: the gradient again
 * only when the weights or the horizon move, each cloud a small canvas per look, the sun and moon a canvas each.
 *
 * The clouds are pixel art like the homes (cells of `cloudPixel` CSS pixels): soft, irregular puffs with flat-ish bottoms,
 * light tops and shaded bases, a few sizes, some wisps; spread across the sky with gaps between them, never on the
 * horizon. They drift slowly and shift a little as you walk (parallax); the sun and moon shift less.
 */
import { clamp, N, type View } from "./camera.ts";
import { TOWN_FEEL } from "./feel.ts";
import { LOOKS, SKY_STOPS, look, mixRGB, type Look, type SkyWeights } from "./sky.ts";
import type { Ctx } from "./paint.ts";

const lookOf = look;
const css = (c: readonly number[], a = 1) => (a >= 1 ? `rgb(${c[0]! | 0},${c[1]! | 0},${c[2]! | 0})` : `rgba(${c[0]! | 0},${c[1]! | 0},${c[2]! | 0},${a.toFixed(3)})`);

/** A cloud's shape on its grid of cells: 0 empty, 1 its lit top, 2 its body, 3 its shaded base. */
interface Shape {
  w: number;
  h: number;
  cells: Uint8Array;
}

/** A small seeded generator, in [0, 1). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0), s / 4294967296);
}

/**
 * A puffy cloud: a few wide domes on a flat-ish bottom, its edge roughened a cell here and there. Each dome is shaded as
 * a ball lit from the top left (light on its upper left, shade toward its base), so the puffs read as volumes.
 */
function puffy(r: () => number, w: number, h: number): Shape {
  const cells = new Uint8Array(w * h);
  const domes = 2 + Math.floor(r() * 3);
  const ds: { cx: number; rx: number; ry: number }[] = [];
  for (let i = 0; i < domes; i++) {
    const t = (i + 0.5) / domes + (r() - 0.5) * 0.12;
    const mid = 1 - Math.abs(t - 0.42) * 1.5; // the tallest toward the middle, a little left of it
    ds.push({ cx: t * w, rx: (w / domes) * (0.85 + r() * 0.45), ry: h * (0.5 + 0.5 * Math.max(0.2, mid) * (0.75 + r() * 0.25)) });
  }
  const bottom = h - 1;
  for (let x = 0; x < w; x++) {
    const X = x + 0.5;
    // The bottom rounds up toward the ends.
    const end = Math.min(X, w - X) / (w * 0.1);
    const lift = end < 1 ? (1 - end) * h * 0.3 : 0;
    const rough = r() < 0.18 ? 1 : 0;
    for (let y = 0; y < h; y++) {
      const Y = y + 0.5;
      if (Y > bottom + 0.5 - lift) continue;
      // The dome that's in front here: the one whose surface is nearest the viewer (the highest at this point).
      let best = -1;
      let light = 0;
      for (const d of ds) {
        const u = (X - d.cx) / d.rx;
        const v = (bottom + 0.5 - Y) / d.ry;
        const q = u * u + v * v;
        if (q > 1 || (rough && q > 0.86 && v > 0.6)) continue;
        const z = Math.sqrt(1 - q); // how far the dome's surface stands out here
        if (z * d.ry > best) {
          best = z * d.ry;
          light = -0.55 * u + 0.75 * v + 0.35 * z - 0.25;
        }
      }
      if (best < 0) continue;
      const base = Y > bottom - h * 0.22;
      cells[y * w + x] = base ? 3 : light > 0.55 ? 1 : light < 0.1 ? 3 : 2;
    }
  }
  return { w, h, cells };
}

/** A wisp: a few long thin streaks, lighter on top. */
function wisp(r: () => number, w: number, h: number): Shape {
  const cells = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const x0 = Math.floor(r() * w * 0.3 + y * 2);
    const x1 = Math.floor(w - r() * w * 0.3 - (h - y) * 1.5);
    for (let x = x0; x < x1; x++) if (r() > 0.06) cells[y * w + x] = y === 0 ? 1 : y === h - 1 ? 3 : 2;
  }
  return { w, h, cells };
}

interface Cloud {
  shape: Shape;
  /** Where it floats: across the strip (CSS pixels) and up the sky (a fraction of the sky's height above the horizon). */
  x: number;
  v: number;
  /** Drawn: one canvas per look (made the first time that look shows). */
  art: Partial<Record<Look, HTMLCanvasElement>>;
  /** Night shows only some of the clouds. */
  night: boolean;
}

export class SkyPainter {
  private W = 0;
  private H = 0;
  private DPR = 1;
  private clouds: Cloud[] = [];
  private stripW = 1000;
  private drift = 0;
  private grad: CanvasGradient | null = null;
  private gradHy = NaN;
  private sun: Partial<Record<Look, HTMLCanvasElement>> = {};
  /** The stars: where, how big, how bright, and whether it twinkles (its phase; -1: it doesn't). */
  private stars: { x: number; y: number; s: number; a: number; p: number }[] | null = null;
  private weights: SkyWeights = { dawn: 0, day: 1, dusk: 0, night: 0 };

  /** The box changed: clouds, sun, moon and stars are made again (at the next draw). */
  resize(W: number, H: number, DPR: number): void {
    this.W = W;
    this.H = H;
    this.DPR = DPR;
    this.sun = {};
    this.stars = null;
    this.layoutClouds();
  }

  setWeights(w: SkyWeights): void {
    this.weights = w;
    this.grad = null;
  }

  /** The drawing's backend changed: its gradient is made again by the new one. */
  forget(): void {
    this.grad = null;
  }

  private layoutClouds(): void {
    const f = TOWN_FEEL;
    const r = rng(20261026);
    this.stripW = Math.max(1000, Math.round(this.W * 1.6));
    const n = Math.max(4, Math.round((this.stripW / 1000) * f.cloudsPer1000));
    const px = f.cloudPixel;
    this.clouds = [];
    for (let i = 0; i < n; i++) {
      // Big, small and wisp by turns, spread evenly across the strip with a little jitter, high and low by turns.
      const kind = i % 3;
      const shape = kind === 0 ? puffy(r, 42 + Math.floor(r() * 20), 15 + Math.floor(r() * 5)) : kind === 1 ? puffy(r, 20 + Math.floor(r() * 10), 9 + Math.floor(r() * 3)) : wisp(r, 30 + Math.floor(r() * 22), 3 + Math.floor(r() * 2));
      const [lo, hi] = f.cloudBand;
      const v = lo + (hi - lo) * (((i * 0.618) % 1) * 0.8 + r() * 0.2);
      this.clouds.push({ shape, x: ((i + r() * 0.5) / n) * this.stripW - (shape.w * px) / 2, v, art: {}, night: i % 2 === 0 });
    }
  }

  private cloudArt(c: Cloud, look: Look): HTMLCanvasElement {
    let a = c.art[look];
    if (a) return a;
    const { w, h, cells } = c.shape;
    const s = Math.max(1, Math.round(TOWN_FEEL.cloudPixel * this.DPR));
    a = document.createElement("canvas");
    a.width = w * s;
    a.height = h * s;
    const g = a.getContext("2d")!;
    const cols = lookOf(look).cloud.map((rgb) => css(rgb));
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = cells[y * w + x]!;
        if (!k) continue;
        g.fillStyle = cols[k - 1]!;
        g.fillRect(x * s, y * s, s, s);
      }
    c.art[look] = a;
    return a;
  }

  /** The sun (dawn, day, dusk) or the moon (night): a big soft disc and its glow. */
  private sunArt(look: Look, R: number): HTMLCanvasElement {
    const L = lookOf(look);
    let a = this.sun[look];
    if (a) return a;
    const D = this.DPR;
    const size = Math.ceil(R * 4.4);
    a = document.createElement("canvas");
    a.width = a.height = Math.ceil(size * D);
    const g = a.getContext("2d")!;
    g.scale(D, D);
    const c = size / 2;
    const glow = g.createRadialGradient(c, c, R * 0.6, c, c, size / 2);
    glow.addColorStop(0, css(L.sunGlow, L.sunGlowAlpha));
    glow.addColorStop(1, css(L.sunGlow, 0));
    g.fillStyle = glow;
    g.fillRect(0, 0, size, size);
    g.fillStyle = L.sunDisc;
    g.beginPath();
    g.arc(c, c, R, 0, Math.PI * 2);
    g.fill();
    if (look === "night") {
      // A few soft craters.
      g.fillStyle = "rgba(170,180,215,.45)";
      for (const [dx, dy, r] of [
        [-0.35, -0.2, 0.22],
        [0.25, 0.25, 0.16],
        [0.3, -0.35, 0.1],
        [-0.1, 0.45, 0.12],
      ] as const) {
        g.beginPath();
        g.arc(c + dx * R, c + dy * R, r * R, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      // A lighter heart.
      const heart = g.createRadialGradient(c - R * 0.2, c - R * 0.2, 0, c, c, R);
      heart.addColorStop(0, "rgba(255,255,255,.55)");
      heart.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = heart;
      g.beginPath();
      g.arc(c, c, R, 0, Math.PI * 2);
      g.fill();
    }
    this.sun[look] = a;
    return a;
  }

  private starList() {
    if (this.stars) return this.stars;
    const { W, H } = this;
    const h = H * 0.45;
    const r = rng(77);
    const f = TOWN_FEEL;
    this.stars = [];
    for (let i = 0; i < f.stars; i++) {
      const x = Math.round(r() * W);
      const y = Math.round(Math.pow(r(), 1.3) * h); // more of them high up
      const s = r() < 0.15 ? 2 : 1;
      const a = 0.45 + r() * 0.55;
      this.stars.push({ x, y, s, a, p: i < f.twinkles ? r() * Math.PI * 2 : -1 });
    }
    return this.stars;
  }

  /** Draws the sky for this frame (before the ground, which covers whatever is below the horizon). */
  draw(g: Ctx, v: View, camX: number, camY: number, now: number, dt: number): void {
    const { W, H } = this;
    const w = this.weights;
    const f = TOWN_FEEL;
    // The gradient, from the top of the box to the horizon (and the horizon's color below it).
    if (!this.grad || Math.abs(this.gradHy - v.hy) > 0.5) {
      const gr = g.createLinearGradient(0, 0, 0, Math.max(10, v.hy));
      SKY_STOPS.forEach((at, i) => gr.addColorStop(at, css(mixRGB(w, (c) => c.sky[i]!))));
      this.grad = gr;
      this.gradHy = v.hy;
    }
    // Only down to the rim's lowest point on screen: the ground covers everything below it.
    let low = v.hy;
    for (let i = 0; i < v.rimN; i++) if (v.rimPx[i]! > -60 && v.rimPx[i]! < W + 60 && v.rimPy[i]! > low) low = v.rimPy[i]!;
    g.globalAlpha = 1;
    g.fillStyle = this.grad;
    g.fillRect(0, 0, W, Math.min(H, Math.ceil(low) + 2));
    // Stars at night, a few of them twinkling: a pixel or two each, only above the rim (a few dozen tiny fills, not a
    // canvas the size of the sky).
    if (w.night > 0.01) {
      g.fillStyle = "#ffffff";
      for (const s of this.starList()) {
        if (s.y > low) continue;
        g.globalAlpha = w.night * (s.p < 0 ? s.a : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.0016 + s.p)));
        g.fillRect(s.x, s.y, s.s, s.s);
      }
    }
    // The sun or the moon: one place in the world, low over the horizon, swinging only a little as you walk round (dawn's
    // sun rises on the other side of the sky from where dusk's sets).
    const R = clamp(Math.min(W, H) * f.sunSize, 22, 80);
    const swing = Math.sin((2 * Math.PI * camX) / N) * W * f.sunParallax * 0.5;
    const sy = v.hy + R * f.sunLow;
    for (const l of LOOKS) {
      if (w[l] < 0.01) continue;
      const sx = W * lookOf(l).sunX - swing;
      const a = this.sunArt(l, R);
      const size = a.width / this.DPR;
      g.globalAlpha = w[l];
      g.drawImage(a, sx - size / 2, sy - size / 2, size, size);
    }
    // The clouds, up in the sky: drifting, and shifting a little as you walk.
    this.drift += dt * f.cloudDrift;
    const off = -camX * v.kf * f.cloudParallax - camY * f.cloudParallaxAhead + this.drift;
    const sw = this.stripW;
    const px = f.cloudPixel;
    for (const l of LOOKS) {
      const wl = w[l] * lookOf(l).cloudAlpha;
      if (wl < 0.01) continue;
      g.globalAlpha = wl;
      for (const c of this.clouds) {
        if (l === "night" && !c.night) continue;
        const cw = c.shape.w * px;
        const ch = c.shape.h * px;
        let x = (((c.x + off) % sw) + sw) % sw;
        if (x > W) x -= sw; // (the strip wraps: one copy is enough when it's wider than the box)
        if (x + cw < 0 || x > W) continue;
        // (Whole, inside the sky: never cut by the top of the box, never down on the horizon.)
        const y = Math.round(Math.max(4, Math.min(v.hy - c.v * v.hy - ch, v.hy * (1 - f.cloudBand[0]) - ch)));
        g.drawImage(this.cloudArt(c, l), Math.round(x), y, cw, ch);
      }
    }
    g.globalAlpha = 1;
  }
}
