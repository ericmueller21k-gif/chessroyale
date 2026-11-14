/**
 * The Hidden Boss's transformation over the board (his phase change from its start to his leap home; the beats: PHASE_CHANGE in
 * recluse-phase2.ts; the figures: characters/recluse-transform.ts). Laid over the screen like his cutscene, which it carries on
 * without a break: the lens (the cutscene's dim with its round light), the child beside him until the white-out, the man, the book
 * at his feet, and the light on two canvases the size of the screen (behind him: the dark round it, the pool, the rays, the shaft;
 * over him: the beam's core and its motes, the glow engulfing him, the rays radiating over the whole screen, his white eyes' glow,
 * the white-out, the light dying back into the center, the flash as he lands). The light is the summoning's from his room
 * (town/shops/recluse-scene.ts): its sprites made once and stretched, drawn only while the phase change is up. His words stand
 * over his head (his voice's bubble, as on the board before). The board, its split and the arcs are the screen's
 * (screens/Recluse2.tsx), under this.
 */
import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef } from "preact/hooks";
import { RECLUSE_CUTSCENE as CS } from "@chessroyale/core";
import { RECLUSE, RECLUSE_JUMP, headOf } from "../characters/recluse.ts";
import { RECLUSE_CUTSCENE } from "../characters/recluse-ages.ts";
import { BOOK_MID, CHANGE_FIG, CHANGE_PLACE, CHEST, GROUND_Y, RECLUSE_CHANGE, RECLUSE_CHANGE_BOOK, RECLUSE_CHANGE_KID, SCENE_LEFT, SCENE_SHARE, SPOT, onBoard } from "../characters/recluse-transform.ts";
import { BOSS_KITS } from "../characters/kits.ts";
import { PHASE_CHANGE } from "../recluse-phase2.ts";
import { VoiceBubble, bossVoice } from "../speech.tsx";
import { SpriteAnim } from "./BossEffect.tsx";

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
/**
 * The light canvases' pixels per CSS pixel: their light is all soft, stretched sprites, so a third is plenty (Nov 14 review: at a
 * phone's 3, the slowed phone's frames went to 100 ms; their cost is their area, the rays up out of the book the most). The small,
 * sharp things (the beam's motes, his eyes' glow) have their own small canvas round him at the screen's own pixels (SHARP_BOX).
 */
const LIGHT_DPR = 1 / 3;

let OPEN_MS: number | undefined;
/** His animations standing on the same spot after the reveal (his box stays put over them). */
const STANDING = new Set(["revealed", "flipUp", "flipDown", "crouch"]);
/** His figure at `t` (ms into the phase change): which animation, since when (ms into it), where his feet are (shares of the board). */
export function changeFigAt(t: number, computer: boolean): { anim: string; then?: string; since: number; feet: { x: number; y: number } } | null {
  const T = PHASE_CHANGE;
  const feet = SPOT;
  const openMs = (OPEN_MS ??= RECLUSE_CHANGE.anims.open!.frames.reduce((s, f) => s + f.ms, 0));
  if (t < 0) return { anim: "together", since: 0, feet };
  if (t < openMs) return { anim: "open", since: 0, feet };
  if (t < T.burstAt) return { anim: "glowing", since: 0, feet };
  if (t < T.riseAt) return { anim: "burst", since: T.burstAt, feet };
  if (t < T.riseAt + T.riseMs) return { anim: "rise", since: T.riseAt, feet };
  // (Hovering in the beam, a little higher as the light grows; set down unseen in the white.)
  if (t < T.whiteFull) return { anim: "beam", since: T.riseAt + T.riseMs, feet: { x: feet.x, y: feet.y - 0.03 * ease((t - T.riseAt - T.riseMs) / (T.whiteFull - T.riseAt - T.riseMs)) } };
  if (t < T.flipUpAt) return { anim: "revealed", since: T.whiteFull, feet };
  if (t < T.flipDownAt) return { anim: "flipUp", then: "faceOpen", since: T.flipUpAt, feet };
  if (t < T.crouchAt) return { anim: "flipDown", then: "revealed", since: T.flipDownAt, feet };
  if (t < T.upAt) return { anim: "crouch", since: T.crouchAt, feet };
  if (t < T.crackAt) {
    const u = (t - T.upAt) / (T.crackAt - T.upAt);
    return { anim: "air", since: T.upAt, feet: { x: feet.x, y: feet.y - 0.34 * 4 * u * (1 - u) } };
  }
  if (t < T.pickupAt) return { anim: "land", then: "landed", since: T.crackAt, feet };
  if (t < T.backAt) return { anim: "pickup", since: T.pickupAt, feet };
  const place = computer ? CHANGE_PLACE.computer : CHANGE_PLACE.phone;
  const u = clamp01((t - T.backAt - RECLUSE_JUMP.upAt) / (RECLUSE_JUMP.landAt - RECLUSE_JUMP.upAt));
  if (t < T.homeAt) return { anim: "leap2", since: T.backAt, feet: { x: feet.x + (place.x - feet.x) * u, y: feet.y + (place.y - feet.y) * u - 0.22 * 4 * u * (1 - u) } };
  return null;
}

// ---- The light: the summoning's (recluse-scene.ts), laid on the board. Its sprites, made once and stretched.
function lightImg(w: number, h: number, rgb: readonly [number, number, number], alpha: (x: number, y: number) => number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
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
let LIGHT: Record<"ray" | "gold" | "shaft" | "pool" | "glow", HTMLCanvasElement> | null = null;
const light = () =>
  (LIGHT ??= {
    ray: lightImg(48, 192, [255, 247, 220], beam(0.22, 1.4, 0.14)),
    gold: lightImg(48, 192, [255, 214, 120], beam(0.3, 1.1, 0.16)),
    shaft: lightImg(96, 192, [255, 240, 196], beam(0.7, 0.75, 0.04)),
    pool: lightImg(128, 128, [255, 206, 112], round),
    glow: lightImg(96, 96, [255, 248, 214], round),
  });
function streak(g: CanvasRenderingContext2D, img: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number, wx: number, wy: number, alpha: number) {
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
export function lightNow(t: number) {
  const T = PHASE_CHANGE;
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
/** The dark coming down round the light (a layer of its own under the back canvas: a full-screen fill costs a phone's frame). */
const darkNow = (s: Light) => (0.32 + 0.22 * s.grow) * ease(Math.max(s.rays, s.shaft * 0.8));
/** Whether each canvas has anything to draw at `t` (each is left out while it has nothing: a full-screen layer costs every frame). */
function canvasesOn(s: Light, t: number, eyes: boolean) {
  const T = PHASE_CHANGE;
  // (Under the whole white, nothing behind it shows.)
  if (s.white >= 1) return { back: false, front: false, sharp: false };
  return {
    back: s.pages > 0 || s.rays > 0 || s.shaft > 0 || s.slam > 0,
    front: s.shaft > 0 || s.grow > 0 || s.radiate > 0 || s.down > 0 || s.slam > 0,
    sharp: s.shaft > 0 || (eyes && t >= T.burstAt && t < T.whiteFull),
  };
}
/** Behind him: the pool on the board, the rays along it and up out of the book, the shaft. */
function drawBack(g: CanvasRenderingContext2D, s: Light, t: number, bx: number, by: number, bw: number, H: number) {
  const L = light();
  const k = bw / 8; // a square
  const gr = 1 + s.grow;
  g.save();
  g.globalCompositeOperation = "lighter";
  g.imageSmoothingEnabled = true;
  const since = t - PHASE_CHANGE.burstAt;
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
 * The sharp canvas's box round the book's middle, in squares (`k`): wide enough for the beam at its widest, as tall as its motes
 * rise (his head well inside it).
 */
const SHARP_BOX = { left: -1.5, right: 1.5, top: -6, bottom: 0.2 } as const;
/** The small, sharp light (on its own canvas, SHARP_BOX; `bx`, `by`: the book's middle, `eyes`: his, in its coordinates). */
function drawSharp(g: CanvasRenderingContext2D, s: Light, t: number, bx: number, by: number, bw: number, eyes: readonly { x: number; y: number }[]) {
  const k = bw / 8;
  // His eyes, white and glowing, from the moment the light takes him.
  if (eyes.length && t >= PHASE_CHANGE.burstAt && t < PHASE_CHANGE.whiteFull) {
    const L = light();
    g.imageSmoothingEnabled = true;
    const e = Math.min(1, (t - PHASE_CHANGE.burstAt) / 200) * (0.85 + 0.15 * Math.sin(t / 70));
    for (const p of eyes) {
      const r = k * (0.22 + 0.1 * s.grow);
      g.globalAlpha = e;
      g.drawImage(L.glow, p.x - r, p.y - r, r * 2, r * 2);
    }
  }
  if (s.shaft <= 0) return;
  // The motes rising in the beam.
  g.fillStyle = "#fff6cf";
  const motes = 26 + Math.round(30 * s.grow);
  for (let i = 0; i < motes; i++) {
    const up = ((t / ((900 + 700 * dice(i, 8)) * (1 - 0.5 * s.grow)) + dice(i, 9)) % 1) * 5.6 * s.shaft;
    g.globalAlpha = s.shaft * (1 - up / 5.7) * 0.9;
    const sz = Math.max(1.5, k * (0.04 + 0.03 * dice(i, 12)));
    g.fillRect(bx + (dice(i, 10) - 0.5) * k * 1.3 * (1 + s.grow) - sz / 2, by - up * k - sz / 2, sz, sz);
  }
  g.globalAlpha = 1;
}
/**
 * Over him: the bright core of the beam; the glow engulfing him; the light radiating out over the whole screen; the light dying
 * back into the center; the slam's flash. (The white-out itself: a layer of its own; the motes and his eyes: drawSharp.)
 */
function drawFront(g: CanvasRenderingContext2D, s: Light, t: number, bx: number, by: number, bw: number, W: number, H: number, mid: { x: number; y: number }) {
  const L = light();
  const k = bw / 8;
  g.save();
  g.globalCompositeOperation = "lighter";
  g.imageSmoothingEnabled = true;
  if (s.shaft > 0) {
    const tall = k * 5.8 * s.shaft + (by + H * 0.3) * s.shoot;
    streak(g, L.shaft, bx, by, bx, by - tall, k * 1.1 * (1 + 1.8 * s.grow), 0, Math.min(1, 0.38 * s.shaft * (0.9 + 0.1 * Math.sin(t / 90)) * (1 + 1.4 * s.grow)));
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
  // After the white-out (the whole screen, a layer of its own) it dies back: a disc of white shrinking into the center, a soft
  // edge, gone at the reveal. (Filled over the disc's box only.)
  if (s.white <= 0 && s.down > 0) {
    const r = reach * s.down ** 1.6 + 1;
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


/**
 * The transformation over `rect` (the board's box on the screen), `t` ms into the phase change (`at`: its start). `sceneStand`: ms
 * into the phase change of the cutscene's `together` loop's start, so his and the child's loop carries on unbroken.
 */
export function RecluseTransform({ at, t, rect, computer, sceneStand }: { at: number; t: number; rect: DOMRect; computer: boolean; sceneStand: number }) {
  const T = PHASE_CHANGE;
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const sharp = useRef<HTMLCanvasElement>(null);
  const headAt = useRef<readonly [number, number] | null>(null);
  const fig = changeFigAt(t, computer);
  const W = innerWidth;
  const H = innerHeight;
  const bw = rect.width;
  const bx = rect.x + BOOK_MID.x * bw;
  const by = rect.y + BOOK_MID.y * bw;
  const lit = t < T.pickupAt + 600;
  const s = lightNow(t);
  const k = bw / 8;
  const sx = bx + SHARP_BOX.left * k;
  const sy = by + SHARP_BOX.top * k;
  const sw = (SHARP_BOX.right - SHARP_BOX.left) * k;
  const sh = (SHARP_BOX.bottom - SHARP_BOX.top) * k;
  const on = canvasesOn(s, t, !!headAt.current);
  const dark = lit ? darkNow(s) : 0;
  const white = lit ? s.white : 0;
  useLayoutEffect(() => {
    const feet = fig?.feet ?? SPOT;
    const chest = t < T.whiteFull ? onBoard(feet, RECLUSE.foot[0], RECLUSE.foot[1] - 70) : CHEST;
    const mid = { x: rect.x + chest.x * bw, y: rect.y + chest.y * bw };
    const h = headAt.current;
    const eyes = h && t >= T.burstAt && t < T.whiteFull ? [onBoard(feet, h[0] + 9, h[1] + 18.5), onBoard(feet, h[0] + 16, h[1] + 18.5)].map((p) => ({ x: rect.x + p.x * bw, y: rect.y + p.y * bw })) : [];
    for (const [c, f, dpr, w, h] of [
      [back.current, "b", LIGHT_DPR, W, H],
      [front.current, "f", LIGHT_DPR, W, H],
      [sharp.current, "s", Math.min(devicePixelRatio || 1, 2), sw, sh],
    ] as const) {
      if (!c) continue;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      const g = c.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      if (f === "b") drawBack(g, s, t, bx, by, bw, H);
      else if (f === "f") drawFront(g, s, t, bx, by, bw, W, H, mid);
      else drawSharp(g, s, t, bx - sx, by - sy, bw, eyes.map((p) => ({ x: p.x - sx, y: p.y - sy })));
    }
  });
  const px = (x: number) => `${x * 100}%`;
  const figStyle = (feet: { x: number; y: number }) => ({ left: px(feet.x - (CHANGE_FIG * RECLUSE.foot[0]) / RECLUSE.w), top: `${(feet.y - (CHANGE_FIG * RECLUSE.foot[1]) / RECLUSE.w) * bw}px`, width: px(CHANGE_FIG), aspectRatio: `${RECLUSE.w} / ${RECLUSE.h}` });
  const lens = t < T.whiteFull ? 1 : 0;
  const bookApart = t >= T.riseAt && t < T.crackAt + 90;
  return createPortal(
    <div class="cs-layer rc-transform" aria-hidden="true" data-t={Math.round(t)}>
      {lens > 0 && <div class="cs-dim" style={{ "--cs-x": `${rect.x + bw / 2}px`, "--cs-y": `${rect.y + bw / 2}px`, "--cs-r": `${bw * CS.spot}px`, "--cs-in": `${CS.spotInner * 100}%`, "--cs-a": String(CS.dimAlpha) }} />}
      {dark > 0 && <div class="rc-light-dark" style={{ opacity: dark }} />}
      {lit && on.back && <canvas ref={back} class="rc-light-cv" style={{ width: `${W}px`, height: `${H}px` }} />}
      <div class="cs-stage rc-tf-stage" style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${bw}px`, height: `${bw}px` }}>
        {t < T.whiteFull && (
          <span class="cs-fig rc-tf-kid" style={{ left: px(SCENE_LEFT), top: `${(GROUND_Y - (SCENE_SHARE * RECLUSE_CUTSCENE.foot[1]) / RECLUSE_CUTSCENE.w) * bw}px`, width: px(SCENE_SHARE), aspectRatio: `${RECLUSE_CUTSCENE.w} / ${RECLUSE_CUTSCENE.h}` }}>
            <SpriteAnim ch={RECLUSE_CHANGE_KID} anim="together" since={at + sceneStand} id="rc-tf-kid" />
          </span>
        )}
        {bookApart && (
          <span class="cs-fig rc-tf-book" style={figStyle(SPOT)}>
            <SpriteAnim ch={RECLUSE_CHANGE_BOOK} anim="glow" since={at + T.riseAt} id="rc-tf-book" />
          </span>
        )}
        {fig && (
          <span class="cs-fig rc-tf-fig" data-anim={fig.anim} style={figStyle(fig.feet)}>
            <SpriteAnim
              ch={RECLUSE_CHANGE}
              anim={fig.anim}
              then={fig.then}
              since={at + (fig.anim === "together" ? sceneStand : fig.since)}
              sounds={BOSS_KITS["Hidden Boss"]!.sounds}
              id="rc-tf-fig"
              onFrame={(f) => void (headAt.current = headOf(f))}
            />
            {/* His words over his head (his voice's bubble), mounted again with each of his animations so a box moved into view is
                placed again where he stands now; one mount while he stands in place (his first line runs from the visor up
                through the crouch, and a box mounted again in its fade would vanish at once). */}
            <span class="rc-say-at">
              <VoiceBubble key={STANDING.has(fig.anim) ? "stand" : fig.anim} voice={bossVoice} class="bc-bubble rc-say" />
            </span>
          </span>
        )}
      </div>
      {lit && on.front && <canvas ref={front} class="rc-light-cv rc-light-front" style={{ width: `${W}px`, height: `${H}px` }} />}
      {lit && on.sharp && <canvas ref={sharp} class="rc-light-cv rc-light-front" style={{ left: `${sx}px`, top: `${sy}px`, width: `${sw}px`, height: `${sh}px` }} />}
      {white > 0 && <div class="rc-light-white" style={{ opacity: white }} />}
    </div>,
    document.body,
  );
}
