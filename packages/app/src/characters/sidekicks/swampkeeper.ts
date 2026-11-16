/**
 * Chandy's Swamp's Shopkeeper (Nov 16, the brief: "a swamp animal, original"): an old bullfrog in a faded bucket hat and an olive
 * fishing vest with its pockets full, standing at the stand on stilts at the back of the swamp. Option A of two for Eric (B, a snapping
 * turtle in waders, is in the round's stills); "Shopkeeper", no name; not a town bot. Drawn three-quarters on, facing our right, light
 * from the top left, in a 52 x 52 frame, his feet at [24, 49].
 * - `idle` (loops, about 2.4 s): he stands, his throat swells and goes down, a blink.
 * - `walk` (loops, 4 x 120 ms): a squat waddle; `sit` (loops): squatting; `wave` (once): a webbed hand up. The bake needs them
 *   (scripts/bake-sidekicks.ts); the shop shows his idle.
 */
import type { Anim, Character, Frame, Layer, Part } from "../sprite.ts";
import { lazyAnim } from "../sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#142010", // outline
  a: "#2e5420", // his skin: deep, dark, mid, light
  b: "#447a2c",
  c: "#5f9a3a",
  d: "#86bb4f",
  e: "#b9d27a", // his throat and belly: shade, light; his swelled throat's sheen
  f: "#dfe7a8",
  F: "#f4f7d6",
  x: "#0b0d08", // his pupil; the eye's gold, its light
  y: "#c99a2a",
  Y: "#f0cf5a",
  m: "#24331a", // his mouth's line
  h: "#a8925c", // the bucket hat: shade, mid, light; its band
  H: "#c9b37c",
  I: "#e2d3a3",
  B: "#6b5a34",
  v: "#4c4a28", // the vest: shade, mid, light; its pockets' flaps
  V: "#6c693a",
  w: "#8c8850",
  p: "#3a3820",
};

const W = 52;
const H = 52;
const FX = 24;
const FY = 49;

type Cv = string[][];
const cv = (): Cv => Array.from({ length: H }, () => Array<string>(W).fill("."));
const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < H && x >= 0 && x < W) c[y]![x] = k;
};
/** An oval, each pixel's key from where it lies in it (u, v from -1 to 1). */
function oval(c: Cv, cx: number, cy: number, rx: number, ry: number, key: (u: number, v: number) => string | null) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      if (u * u + v * v > 1) continue;
      const k = key(u, v);
      if (k) put(c, x, y, k);
    }
}
const skin = (u: number, v: number) => (u + v < -0.9 ? "d" : u + v < 0.2 ? "c" : u + v < 0.95 ? "b" : "a");

interface Pose {
  /** How far he's squashed down (px): a squat, a step. */
  bob?: number;
  /** His throat swelled (0 to 1). */
  puff?: number;
  blink?: boolean;
  /** His near hand raised (a wave), 0 down to 1 up. */
  wave?: number;
  /** His feet's offsets (back, front), for a waddle. */
  feet?: readonly [number, number];
}

function draw(p: Pose): Part {
  const c = cv();
  const bob = p.bob ?? 0;
  const [fb, ff] = p.feet ?? [0, 0];
  // His feet: wide webbed feet, the far one behind.
  oval(c, FX - 7 + fb, FY - 1, 6, 2, (u) => (u < -0.3 ? "c" : "b"));
  oval(c, FX + 6 + ff, FY - 1, 7, 2.2, (u) => (u < -0.3 ? "d" : "c"));
  // His legs, bent: thick haunches.
  oval(c, FX - 6, FY - 7 + bob, 6, 6, skin);
  oval(c, FX + 5, FY - 6 + bob, 6.5, 6, skin);
  // His body: a pear, his belly pale, the vest over it.
  const by = FY - 16 + bob;
  oval(c, FX, by, 11, 11, (u, v) => {
    if (u > 0.15 && v > -0.4) return v > 0.5 ? "e" : "f"; // the belly, toward us on our right
    if (Math.abs(u) < 0.95 && v > -0.75 && v < 0.75 && (u < 0.15 || v < -0.4)) {
      // The vest: its pockets' flaps on its front.
      if (((v > -0.15 && v < 0.25) || (v > 0.4 && v < 0.7)) && u > -0.8 && u < -0.1) return v < -0.05 || (v > 0.4 && v < 0.5) ? "p" : "w";
      return u + v < -0.5 ? "w" : u < 0 ? "V" : "v";
    }
    return skin(u, v);
  });
  // His far arm, at his side.
  oval(c, FX - 10, by + 4, 2.5, 6, (u) => (u < 0 ? "b" : "a"));
  // His head: wide and flat, his throat under it.
  const hy = by - 11;
  const puff = p.puff ?? 0;
  if (puff > 0) oval(c, FX + 5, hy + 7, 6 + 3 * puff, 3 + 3 * puff, (u, v) => (u + v < -0.6 ? "F" : v < 0.3 ? "f" : "e"));
  oval(c, FX + 2, hy, 13, 7, (u, v) => (v > 0.45 && u > -0.2 ? "e" : skin(u, v)));
  // His mouth: a long line, curving up at its end.
  for (let x = FX - 6; x <= FX + 14; x++) put(c, x, hy + 3 + (x > FX + 11 ? -1 : 0), "m");
  // The bucket hat, on the back of his head between his eyes: its crown and its floppy brim.
  const ty = hy - 12;
  oval(c, FX + 1, ty - 1, 6, 3.5, (u, v) => (v > 0.6 ? "B" : u + v < -0.4 ? "I" : u < 0.4 ? "H" : "h"));
  for (let x = FX - 7; x <= FX + 9; x++) {
    const sag = Math.abs(x - FX - 1) > 6 ? 1 : 0;
    put(c, x, ty + 2 + sag, x < FX - 2 ? "I" : "H");
    put(c, x, ty + 3 + sag, "h");
  }
  // His eyes, bulging on top: the near one big, the far one behind.
  for (const [ex, er] of [
    [FX - 5, 3.8],
    [FX + 8, 4.6],
  ] as const) {
    oval(c, ex, hy - 5, er, er, (u, v) => (v < -0.2 && u < 0.4 ? "d" : "c"));
    if (p.blink) for (let x = ex - er + 1; x < ex + er; x++) put(c, x, hy - 5, "a");
    else {
      oval(c, ex + 0.6, hy - 4.6, er - 1.2, er - 1.4, (u, v) => (u + v < -0.5 ? "Y" : "y"));
      for (let x = ex - 1; x <= ex + 2; x++) put(c, x, hy - 4.5, "x");
    }
  }
  // His near arm: hanging, or raised in a wave.
  const w = p.wave ?? 0;
  const ax = FX + 10;
  const ay = by - 2;
  const hx = ax + 5 + w * 2;
  const hyy = ay + 10 - w * 18;
  for (let t = 0; t <= 1; t += 0.08) {
    const x = ax + (hx - ax) * t;
    const y = ay + (hyy - ay) * t;
    oval(c, x, y, 2.2, 2.2, (u) => (u < 0 ? "c" : "b"));
  }
  // His hand: three webbed fingers.
  oval(c, hx, hyy, 3, 2.4, (u, v) => (u + v < 0 ? "d" : "c"));
  return { grid: c.map((r) => r.join("")), outline: true };
}

const parts: Record<string, Part> = {};
let n = 0;
const fr = (ms: number, p: Pose, more: Partial<Frame> = {}): Frame => {
  const name = `p${n++}`;
  let made: Part | null = null;
  Object.defineProperty(parts, name, { enumerable: true, get: () => (made ??= draw(p)) });
  return { ms, layers: [{ part: name, x: 0, y: 0 } as Layer], ...more };
};

const idle: Anim = lazyAnim(() => ({
  loop: true,
  frames: [fr(900, {}), fr(160, { puff: 0.5 }), fr(260, { puff: 1 }), fr(160, { puff: 0.5 }), fr(800, {}), fr(120, { blink: true })],
}));
const walk: Anim = lazyAnim(() => ({
  loop: true,
  frames: [fr(120, { feet: [-2, 2] }, { cue: "step" }), fr(120, { bob: 1 }), fr(120, { feet: [2, -2] }, { cue: "step" }), fr(120, { bob: 1 })],
}));
const sit: Anim = lazyAnim(() => ({ loop: true, frames: [fr(900, { bob: 3 }), fr(160, { bob: 3, blink: true })] }));
const wave: Anim = lazyAnim(() => ({
  loop: false,
  frames: [fr(120, { wave: 0.4 }), fr(140, { wave: 1 }), fr(140, { wave: 0.8 }), fr(140, { wave: 1 }), fr(160, { wave: 0.4 }), fr(200, {})],
}));

export const sidekickSwampKeeper: Character = {
  id: "sidekick-swamp-keeper",
  name: "Chandy's Swamp's bullfrog",
  w: W,
  h: H,
  foot: [FX, FY],
  palette: PALETTE,
  halo: "#26341f",
  parts,
  anims: { idle, walk, sit, wave },
};
