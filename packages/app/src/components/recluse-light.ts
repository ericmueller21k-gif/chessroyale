/**
 * The light of the Hidden Boss's transformation (RecluseTransform.tsx), on its two canvases: behind him (the dark coming down round
 * it, the pool, the rays, the shaft) and over him (the beam's core and its motes, his white eyes' glow, the glow engulfing him, the
 * rays radiating over the whole screen, the white-out, the light dying back into the center, the flash as he lands). The
 * summoning's light from his room (town/shops/recluse-scene.ts): its sprites made once and stretched, added together ("lighter").
 * No document here: it draws in the light's worker (recluse-light.worker.ts), off the main thread, or, where a browser can't hand
 * a canvas to a worker, on it (Nov 14 review, B1: a phone pays for every pixel of every sprite, every frame).
 */
import type { PHASE_CHANGE } from "../recluse-phase2.ts";

/** The phase change's beats the light follows (PHASE_CHANGE's; handed to the worker once). */
export type LightBeats = Pick<typeof PHASE_CHANGE, "burstAt" | "riseAt" | "shootAt" | "radiateAt" | "whiteAt" | "whiteFull" | "downAt" | "revealAt" | "crackAt" | "growAt" | "growMs" | "pickupAt">;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Sprite = HTMLCanvasElement | OffscreenCanvas;

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;

// ---- The light: the summoning's (recluse-scene.ts), laid on the board. Its sprites, made once and stretched.
function lightImg(w: number, h: number, rgb: readonly [number, number, number], alpha: (x: number, y: number) => number): Sprite {
  // (In the light's worker there's no document: an OffscreenCanvas.)
  const c: Sprite = typeof document === "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const g = c.getContext("2d") as Ctx;
  const im = g.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      im.data[i] = rgb[0];
      im.data[i + 1] = rgb[1];
      im.data[i + 2] = rgb[2];
      im.data[i + 3] = 255 * clamp01(alpha((x + 0.5) / w, (y + 0.5) / h));
    }
  g.putImageData(im, 0, 0);
  return c;
}
const beam = (foot: number, fade: number, rise: number) => (x: number, y: number) => {
  const half = foot + (1 - foot) * (1 - y);
  const dx = Math.abs(2 * x - 1) / half;
  return dx >= 1 ? 0 : (1 - dx * dx) ** 2 * y ** fade * Math.min(1, (1 - y) / rise);
};
const round = (x: number, y: number) => {
  const r = Math.hypot(2 * x - 1, 2 * y - 1);
  return r >= 1 ? 0 : (1 - r) ** 1.7;
};
let LIGHT: Record<"ray" | "gold" | "shaft" | "pool" | "glow", Sprite> | null = null;
const light = () =>
  (LIGHT ??= {
    ray: lightImg(48, 192, [255, 247, 220], beam(0.22, 1.4, 0.14)),
    gold: lightImg(48, 192, [255, 214, 120], beam(0.3, 1.1, 0.16)),
    shaft: lightImg(96, 192, [255, 240, 196], beam(0.7, 0.75, 0.04)),
    pool: lightImg(128, 128, [255, 206, 112], round),
    glow: lightImg(96, 96, [255, 248, 214], round),
  });
function streak(g: Ctx, img: Sprite, x0: number, y0: number, x1: number, y1: number, wx: number, wy: number, alpha: number) {
  if (alpha < 0.01) return;
  g.save();
  g.globalAlpha = Math.min(1, alpha);
  g.transform(wx / img.width, wy / img.width, (x0 - x1) / img.height, (y0 - y1) / img.height, x1 - wx / 2, y1 - wy / 2);
  g.drawImage(img, 0, 0);
  g.restore();
}
const dice = (i: number, k: number) => {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
/**
 * How much light there is at `t`: the pages' glow; the burst; the beam, and from the build on `grow`, the light pouring out
 * more and more (0 to 1, faster and faster) till the white-out; `white`, the whole screen; `down`, the light dying back into
 * the center (1 to 0); the slam's flash on the drop.
 */
export function lightNow(t: number, T: LightBeats) {
  const pages = clamp01((t - 500) / 900);
  const before = t < T.whiteFull;
  const rays = t < T.burstAt || !before ? 0 : easeOut((t - T.burstAt) / 500);
  const shaft = t < T.riseAt || !before ? 0 : easeOut((t - T.riseAt) / 1600);
  const grow = before ? clamp01((t - T.riseAt) / (T.whiteFull - T.riseAt)) ** 1.7 : 0;
  const shoot = before ? ease((t - T.shootAt) / 700) : 0;
  const radiate = before ? ease((t - T.radiateAt) / (T.whiteFull - T.radiateAt)) : 0;
  // (Then the white is drawn in to the center: `down`'s shrinking disc takes over from the full screen.)
  const white = t < T.whiteAt ? 0 : t < T.whiteFull ? ease((t - T.whiteAt) / (T.whiteFull - T.whiteAt)) ** 1.4 : t < T.downAt ? 1 : 0;
  const down = t < T.downAt ? (t < T.whiteFull ? 0 : 1) : 1 - clamp01((t - T.downAt) / (T.revealAt - T.downAt));
  const slam = t < T.crackAt ? 0 : Math.max(0, 1 - (t - T.crackAt) / 900);
  // (The book's own glow: up as it opens, held on, dying as the boards settle, as today's light does.)
  const glow = pages * (1 - clamp01((t - (T.growAt + T.growMs - 300)) / 500)) * (t >= T.pickupAt ? 0 : 1);
  return { pages: glow, rays, shaft, grow, shoot, radiate, white, down, slam };
}
type Light = ReturnType<typeof lightNow>;
/** Whether each canvas has anything to draw at `t` (each is left out while it has nothing: a full-screen layer costs every frame). */
export function canvasesOn(s: Light, t: number, eyes: boolean, T: LightBeats) {
  return {
    // (Under the whole white, nothing behind it shows.)
    back: s.white < 1 && (s.pages > 0 || s.rays > 0 || s.shaft > 0 || s.slam > 0),
    front: s.white > 0 || s.shaft > 0 || (eyes && t >= T.burstAt && t < T.whiteFull) || s.grow > 0 || s.radiate > 0 || s.down > 0 || s.slam > 0,
  };
}
/**
 * Behind him: the dark coming down round the light (on this canvas, under the light, which adds onto it: the board doesn't show
 * through the rays), the pool on the board, the rays along it and up out of the book, the shaft.
 */
function drawBack(g: Ctx, s: Light, t: number, T: LightBeats, bx: number, by: number, bw: number, W: number, H: number) {
  const L = light();
  const k = bw / 8; // a square
  const gr = 1 + s.grow;
  const lit = Math.max(s.rays, s.shaft * 0.8);
  if (lit > 0) {
    g.fillStyle = "#100a1e";
    g.globalAlpha = (0.32 + 0.22 * s.grow) * ease(lit);
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  g.save();
  g.globalCompositeOperation = "lighter";
  g.imageSmoothingEnabled = true;
  const since = t - T.burstAt;
  const pool = Math.max(s.pages * 0.45, s.rays, s.slam * 0.8);
  if (pool > 0) {
    const r = k * (1.6 + 1.1 * s.rays + 2.4 * s.grow) * (1 + 0.03 * Math.sin(t / 160));
    g.globalAlpha = Math.min(1, 0.55 * pool * (1 + 0.6 * s.grow));
    g.drawImage(L.pool, bx - r, by - r * 0.42, r * 2, r * 0.84);
  }
  if (s.rays > 0) {
    // Along the board, out from the book (flattened, as the board under his feet is), longer as the light grows.
    const spin = t / 5200;
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + spin + (dice(i, 1) - 0.5) * 0.3;
      const shot = easeOut((since - i * 28) / 340) * s.rays;
      const far = k * (0.5 + (1.6 + 1.4 * dice(i, 2)) * shot * (1 + 1.8 * s.grow));
      const wide = k * (0.3 + 0.3 * dice(i, 3)) * gr;
      const ca = Math.cos(a);
      const sa = Math.sin(a) * 0.42;
      streak(g, L.gold, bx + ca * k * 0.4, by + sa * k * 0.4, bx + ca * far, by + sa * far, -sa * wide * 2, ca * wide * 0.84, 0.5 * s.rays * gr * (0.75 + 0.25 * Math.sin(t / 150 + i * 2.1)));
    }
    // Up and outward from the pages: each leans away from the middle, turning slowly, shimmering; more and longer as it grows.
    const n = 13 + Math.round(10 * s.grow);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - spin * 1.6 + (dice(i, 4) - 0.5) * 0.25;
      const lean = 0.3 + 0.55 * dice(i, 5) + 0.04 * Math.sin(t / 300 + i);
      const shot = easeOut((since - 60 - (i % 13) * 34) / 300) * s.rays;
      const len = k * (2.6 + 2.4 * dice(i, 6)) * shot * (0.9 + 0.1 * Math.sin(t / 170 + i * 1.3)) * (1 + 1.6 * s.grow);
      const ox = Math.cos(a) * k * 0.3;
      const oy = Math.sin(a) * k * 0.12;
      const x1 = bx + ox + Math.cos(a) * len * Math.sin(lean);
      const y1 = by + oy + Math.sin(a) * len * Math.sin(lean) * 0.42 - len * Math.cos(lean);
      const lx = x1 - bx - ox;
      const ly = y1 - by - oy;
      const ll = Math.hypot(lx, ly) || 1;
      const shimmer = 0.72 + 0.28 * Math.sin(t / 110 + i * 1.9);
      const wd = k * (0.4 + 0.35 * dice(i, 7)) * gr;
      streak(g, L.gold, bx + ox, by + oy, x1, y1, (-ly / ll) * wd * 1.7, (lx / ll) * wd * 1.7, 0.4 * s.rays * shimmer);
      streak(g, L.ray, bx + ox, by + oy, x1, y1, (-ly / ll) * wd * 0.6, (lx / ll) * wd * 0.6, 0.8 * s.rays * shimmer);
    }
  }
  // The shaft standing on the book, up through him: wide and soft (behind him); wider as it grows, then up off the screen.
  if (s.shaft > 0) {
    const tall = k * 6.2 * s.shaft + (by + H * 0.3) * s.shoot;
    streak(g, L.shaft, bx, by, bx, by - tall, k * 2.1 * (1 + 1.3 * s.grow), 0, Math.min(1, 0.42 * s.shaft * (1 + s.grow)));
  }
  // The pages, blazing.
  if (s.pages > 0) {
    const gs = k * (0.9 + 0.08 * Math.sin(t / 120)) * (1 + 0.6 * s.rays + s.grow);
    g.globalAlpha = Math.min(1, 0.55 * s.pages);
    g.drawImage(L.glow, bx - gs, by - gs * 0.62, gs * 2, gs * 1.24);
  }
  g.restore();
}
/**
 * Over him: the bright core of the beam and the motes in it; his white eyes' glow; the glow engulfing him; the light radiating out
 * over the whole screen; the white-out; the light dying back into the center; the slam's flash.
 */
function drawFront(g: Ctx, s: Light, t: number, T: LightBeats, bx: number, by: number, bw: number, W: number, H: number, mid: { x: number; y: number }, eyes: readonly { x: number; y: number }[]) {
  const L = light();
  const k = bw / 8;
  g.save();
  g.globalCompositeOperation = "lighter";
  g.imageSmoothingEnabled = true;
  if (s.shaft > 0) {
    const tall = k * 5.8 * s.shaft + (by + H * 0.3) * s.shoot;
    streak(g, L.shaft, bx, by, bx, by - tall, k * 1.1 * (1 + 1.8 * s.grow), 0, Math.min(1, 0.38 * s.shaft * (0.9 + 0.1 * Math.sin(t / 90)) * (1 + 1.4 * s.grow)));
    g.fillStyle = "#fff6cf";
    const motes = 26 + Math.round(30 * s.grow);
    for (let i = 0; i < motes; i++) {
      const up = ((t / ((900 + 700 * dice(i, 8)) * (1 - 0.5 * s.grow)) + dice(i, 9)) % 1) * 5.6 * s.shaft;
      g.globalAlpha = s.shaft * (1 - up / 5.7) * 0.9;
      const sz = Math.max(1.5, k * (0.04 + 0.03 * dice(i, 12)));
      g.fillRect(bx + (dice(i, 10) - 0.5) * k * 1.3 * (1 + s.grow) - sz / 2, by - up * k - sz / 2, sz, sz);
    }
  }
  // His eyes, white and glowing, from the moment the light takes him.
  if (eyes.length && t >= T.burstAt && t < T.whiteFull) {
    const e = Math.min(1, (t - T.burstAt) / 200) * (0.85 + 0.15 * Math.sin(t / 70));
    for (const p of eyes) {
      const r = k * (0.22 + 0.1 * s.grow);
      g.globalAlpha = e;
      g.drawImage(L.glow, p.x - r, p.y - r, r * 2, r * 2);
    }
  }
  // Engulfing him: a glow round him that grows till he's lost in it.
  if (s.grow > 0) {
    const gs = k * (1.2 + 5 * s.grow);
    g.globalAlpha = Math.min(1, 1.3 * s.grow);
    g.drawImage(L.glow, mid.x - gs, mid.y - gs * 1.3, gs * 2, gs * 2.6);
  }
  // Radiating out in every direction over the whole screen, turning slowly.
  const reach = Math.hypot(W, H);
  const rad = Math.max(s.radiate, s.down * 0.9);
  if (rad > 0) {
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t / 3000 + (dice(i, 20) - 0.5) * 0.2;
      const len = reach * (0.35 + 0.65 * Math.min(1, s.radiate * 1.4) * (0.7 + 0.3 * dice(i, 21))) * (s.down > 0 ? s.down ** 1.5 : 1);
      const x1 = mid.x + Math.cos(a) * len;
      const y1 = mid.y + Math.sin(a) * len;
      const wd = k * (0.5 + 1.2 * rad) * (0.6 + 0.6 * dice(i, 22));
      streak(g, L.ray, mid.x, mid.y, x1, y1, -Math.sin(a) * wd, Math.cos(a) * wd, rad * (0.55 + 0.25 * Math.sin(t / 90 + i)));
    }
  }
  // Dying back into the center: the light drawn in to a point (the glow left at its core).
  if (s.down > 0) {
    const gs = k * 0.4 + reach * 0.9 * s.down ** 2;
    g.globalAlpha = Math.min(1, 1.2 * s.down);
    g.drawImage(L.glow, mid.x - gs, mid.y - gs, gs * 2, gs * 2);
  }
  if (s.slam > 0) {
    const gs = k * (1 + 2.5 * (1 - s.slam));
    g.globalAlpha = Math.min(1, 0.8 * s.slam);
    g.drawImage(L.glow, bx - gs, by - gs * 0.45, gs * 2, gs * 0.9);
  }
  g.restore();
  // The white-out: the whole screen. Then it dies back: a disc of white shrinking into the center, a soft edge, gone at the reveal.
  if (s.white > 0) {
    g.globalAlpha = s.white;
    g.fillStyle = "#fffdf6";
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  } else if (s.down > 0) {
    // (Its solid half reaches the corner farthest from the center as it starts, so the white is whole on its first frame: from the
    // screen's diagonal, a tall phone's bottom corners (the board's center high on it) were in its soft edge at once, the panel and
    // the pawns showing through, Nov 14.)
    const far = Math.max(Math.hypot(mid.x, mid.y), Math.hypot(W - mid.x, mid.y), Math.hypot(mid.x, H - mid.y), Math.hypot(W - mid.x, H - mid.y));
    const r = 2 * far * s.down ** 1.6 + 1;
    const grad = g.createRadialGradient(mid.x, mid.y, 0, mid.x, mid.y, r);
    grad.addColorStop(0, "rgba(255,253,246,1)");
    grad.addColorStop(0.5, `rgba(255,250,230,${Math.min(1, 0.4 + s.down).toFixed(3)})`);
    grad.addColorStop(1, "rgba(255,244,210,0)");
    g.fillStyle = grad;
    const x0 = Math.max(0, mid.x - r);
    const y0 = Math.max(0, mid.y - r);
    g.fillRect(x0, y0, Math.min(W, mid.x + r) - x0, Math.min(H, mid.y + r) - y0);
  }
}

/** One frame of the light: what the main thread knows (where he and the book are, the screen's size), the worker draws. */
export interface LightFrame {
  t: number;
  bx: number;
  by: number;
  bw: number;
  W: number;
  H: number;
  dpr: number;
  mid: { x: number; y: number };
  eyes: readonly { x: number; y: number }[];
  back: boolean;
  front: boolean;
}
/** Draws a frame on the two canvases (each only while it has something to draw; its CSS size is the main thread's). */
export function drawLight(f: LightFrame, T: LightBeats, back: HTMLCanvasElement | OffscreenCanvas | null, front: HTMLCanvasElement | OffscreenCanvas | null) {
  const s = lightNow(f.t, T);
  for (const [c, which] of [
    [back, "b"],
    [front, "f"],
  ] as const) {
    if (!c || !(which === "b" ? f.back : f.front)) continue;
    if (c.width !== Math.round(f.W * f.dpr) || c.height !== Math.round(f.H * f.dpr)) {
      c.width = Math.round(f.W * f.dpr);
      c.height = Math.round(f.H * f.dpr);
    }
    const g = c.getContext("2d") as Ctx;
    g.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
    g.clearRect(0, 0, f.W, f.H);
    if (which === "b") drawBack(g, s, f.t, T, f.bx, f.by, f.bw, f.W, f.H);
    else drawFront(g, s, f.t, T, f.bx, f.by, f.bw, f.W, f.H, f.mid, f.eyes);
  }
}
