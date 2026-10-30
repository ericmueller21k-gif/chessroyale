/**
 * What the houses share: painting a part pixel by pixel over its box, banded light, and the blank sign board on two posts
 * (the game writes each home's name on it: no letters in the art). Same format as the bosses (characters/sprite.ts).
 */
import type { Part } from "../../characters/sprite.ts";

export type Pt = readonly [number, number];
export type Key = string | null;

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
/** A ramp of three keys by a light value (0 dark to 1 light): banded, never blended. */
export const tone = (l: number, ramp: string): string => ramp[l < 0.3 ? 0 : l > 0.8 ? 2 : 1]!;

/** A part painted over the box (x0, y0, w, h) in frame pixels: `fn` gives each pixel's palette key (null: empty). */
export function paint(x0: number, y0: number, w: number, h: number, fn: (x: number, y: number) => Key, outline = true): { part: Part; at: Pt } {
  const grid = Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => fn(x0 + i, y0 + j) ?? ".").join(""));
  return { part: { grid, outline }, at: [x0, y0] };
}

/** A small seeded hash of a pixel, in [0, 1): for speckles and grain that stay put. */
export function grain(x: number, y: number, seed = 1): number {
  let h = Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x7f4a, 0xc2b2ae35) ^ Math.imul(seed, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/**
 * The sign: a blank board in a wooden frame (lit along the top and left, a nail in each corner). Keys: `wood` dark to
 * light (4), `face` shadow, board, light (3), `nail`.
 */
export function signBoard(x0: number, y0: number, w: number, h: number, wood = "NOPQ", face = "STU", nail = "L"): { part: Part; at: Pt } {
  return paint(x0, y0, w, h, (x, y) => {
    const i = x - x0;
    const j = y - y0;
    const edge = Math.min(i, j, w - 1 - i, h - 1 - j);
    if (edge < 2) {
      if ((i === 1 || i === w - 2) && (j === 1 || j === h - 2)) return nail;
      if (j === 0 || (i === 0 && j < h - 1)) return wood[3]!;
      if (j === h - 1 || i === w - 1) return wood[0]!;
      return j === h - 2 || i === w - 2 ? wood[1]! : wood[2]!;
    }
    if (j === 2) return face[2]!;
    if (j === h - 3 || i === w - 3) return face[0]!;
    return face[1]!;
  });
}

/**
 * A light at dusk and night (Oct 27): where a picture glows from inside, as data beside its art (render.ts lights it after
 * the world's tint: its pixels warm and bright, a soft glow spilling a little round them). A box in the picture's pixels;
 * `keys`: only the pixels of these palette keys in it light up (the glass, the dark of a doorway; omitted: every drawn pixel
 * in it), so frames, bars and things standing in front stay dark against the glow.
 */
export interface LightSpot {
  x: number;
  y: number;
  w: number;
  h: number;
  keys?: string;
  /** The light's color, and how strong it shines at night (0 to 1; dusk is weaker: `lightsAt` in feel.ts). */
  color: string;
  strength: number;
  /** A candle's or a torch's slow, gentle flicker. */
  flicker?: boolean;
  /** A halo in the air round it (a lantern's, a lamp's): its radius in picture pixels, round the box's middle. */
  halo?: number;
}
/** A faint pool of light on the ground (under a lamp, in front of an open door): its middle and half-axes, in the picture's pixels. */
export interface LightPool {
  x: number;
  y: number;
  rx: number;
  ry: number;
  color: string;
  strength: number;
}
/** The lights' colors: the warm light from inside a home (a lamp or a fire within), a lantern's or a candle's, a torch's. */
export const WARM = "#ffb85c";
export const LANTERN_LIGHT = "#ffb648";
export const TORCH = "#ff9a3c";
/** Ginger's cold ice-blue (he loves the cold), and the funhouse's pink. */
export const ICE_LIGHT = "#a8dcff";
export const FUN_PINK = "#ff8fe0";

/** Where the game writes on a sign board made by signBoard at (x0, y0, w, h): its face, inside the frame. */
export const signFace = (x0: number, y0: number, w: number, h: number) => ({ x: x0 + 2, y: y0 + 3, w: w - 5, h: h - 6 }) as const;

/** A sign's post, 3 pixels wide, from `top` down to `foot`: lit on its left. Keys: wood dark to light (4). */
export const signPost = (px: number, top: number, foot: number, wood = "NOPQ") => paint(px, top, 3, foot - top, (x) => (x === px ? wood[2]! : x === px + 2 ? wood[0]! : wood[1]!));

/** A soft shadow on the ground: an ellipse around (cx, cy) of half-axes rx, ry; its rim see-through (keys `core`, `rim`). */
export const groundShadow = (cx: number, cy: number, rx: number, ry: number, core = "-", rim = "+") =>
  paint(Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(2 * rx) + 1, Math.ceil(2 * ry) + 1, (x, y) => {
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
    return d > 1 ? null : d > 0.55 ? rim : core;
  }, false);

// ---- Small things several homes share (each takes its palette keys, so it fits any home's colors).

/** A ball lit from the top left: `ramp` its mid and shade keys, a glint of `glint`. */
export const ball = (cx: number, cy: number, r: number, ramp: string, glint = "") =>
  paint(Math.floor(cx - r), Math.floor(cy - r), Math.ceil(2 * r) + 1, Math.ceil(2 * r) + 1, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const d = Math.hypot(dx, dy);
    if (d > r) return null;
    if (glint && dx < -r * 0.2 && dy < -r * 0.2 && d < r * 0.7 && d > r * 0.25) return glint;
    return dx + dy > r * 0.45 ? ramp[1]! : ramp[0]!;
  });

/** A wooden crate: a frame of planks, a brace across it. `wood`: dark to light (4 keys). */
export const crate = (x0: number, y0: number, w: number, h: number, wood: string) =>
  paint(x0, y0, w, h, (x, y) => {
    const i = x - x0;
    const j = y - y0;
    if (i === 0 || j === 0 || i === w - 1 || j === h - 1) return j === 0 ? wood[3]! : i === w - 1 || j === h - 1 ? wood[0]! : wood[2]!;
    if (Math.abs(i - 1 - ((w - 3) * (h - 2 - j)) / (h - 3)) < 1) return wood[2]!;
    return j % 3 === 0 ? wood[0]! : wood[1]!;
  });

/** A lantern hanging from (x, y): an iron cap and frame round warm glass. `iron`, `glass` (bright, warm). */
export const lantern = (x: number, y: number, iron: string, glass: string) =>
  paint(x, y, 8, 12, (px, py) => {
    const i = px - x;
    const j = py - y;
    if (j === 0) return i >= 3 && i <= 4 ? iron : null; // the ring
    if (j === 1 || j === 11) return i >= 1 && i <= 6 ? iron : null; // its cap and base
    if (i === 0 || i === 7) return null;
    if (i === 1 || i === 6) return iron;
    return j < 5 && i < 4 ? glass[0]! : glass[1]!;
  });

/** A small pine in tiers: `green` its lit and shaded keys, `snow` (optional) on each tier's top, `trunk`. */
export function pine(cx: number, foot: number, h: number, green: string, trunk: string, snow = "") {
  const w = Math.round(h * 0.7);
  return paint(cx - Math.ceil(w / 2), foot - h, w + 1, h, (x, y) => {
    const X = x + 0.5 - cx;
    const j = foot - (y + 0.5);
    if (j < 2) return Math.abs(X) < 1 ? trunk : null;
    const tier = Math.min(2, Math.floor(((j - 2) / (h - 2)) * 3));
    const tTop = 2 + ((tier + 1) * (h - 2)) / 3 + (tier < 2 ? 2 : 0);
    const tBot = 2 + (tier * (h - 2)) / 3;
    const half = (w / 2) * (1 - tier * 0.25) * ((tTop - j) / (tTop - tBot));
    if (Math.abs(X) > half) return null;
    if (snow && tTop - j < 1.5) return snow;
    return X < 0 ? green[0]! : green[1]!;
  });
}

/** A little flower: four petals of `petal` round a `heart`. */
export const flower = (cx: number, cy: number, petal: string, heart: string) =>
  paint(cx - 1, cy - 1, 3, 3, (x, y) => (x === cx && y === cy ? heart : x === cx || y === cy ? petal : null));

/** A tuft of grass, `h` tall, blades fanning out: `ramp` its lit and shaded greens (no outline: blades are thin). */
export const tuft = (cx: number, foot: number, h: number, ramp: string) =>
  paint(cx - 3, foot - h, 7, h, (x, y) => {
    const j = foot - (y + 0.5);
    const X = x + 0.5 - cx;
    for (const lean of [-0.45, 0, 0.5]) {
      const bx = lean * j * (1 + Math.abs(lean));
      if (Math.abs(X - bx) < 0.7 && j < h * (lean === 0 ? 1 : 0.75)) return lean < 0.2 ? ramp[0]! : ramp[1]!;
    }
    return null;
  }, false);

/** A log's cut end: rings of `wood` (dark, mid, light) round a dark heart. */
export const logEnd = (cx: number, cy: number, r: number, wood: string) =>
  paint(Math.floor(cx - r), Math.floor(cy - r), Math.ceil(2 * r) + 1, Math.ceil(2 * r) + 1, (x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > r) return null;
    if (d > r - 1.2) return wood[0]!; // the bark
    return Math.floor(d) % 2 ? wood[1]! : wood[2]!;
  });
