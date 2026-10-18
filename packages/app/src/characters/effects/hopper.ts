/**
 * Chub & Chirp's board art (not wired in yet: drafts for Eric, Oct 18): the carrots of his Carrot Patch (planted on a
 * square, flying to it, pulled out of it, and the square's mark once claimed), the dock's carrot icon for the race's
 * count, and the bonk of a carrot on a king (his attack on a king). Drawn in his sprite's style: the same orange
 * carrot, the grasshopper's greens for its leaves, dark outlines, light from the top left.
 *
 *   carrotPatch   square  plant (ends on the planted look; `thunk` as it lands), planted (loop: its leaves sway,
 *                         a glint now and then), pull<W|B> (a piece of that side ended its move on it: the carrot
 *                         pops out of the soil, wobbles and is gone in a sparkle; `pop`; ends on claimed<W|B>),
 *                         claimed<W|B> (loop: the dug soil and, in the square's bottom-right corner, the side's small
 *                         token with a carrot on it). Under the piece, as the board's other square marks.
 *   carrotFly     square  fly (loop): a carrot tumbling end over end; move it from his paw to the square.
 *   carrotHit     square  hit<H|L><L|R> (ends empty, about 200 ms): a carrot bonking a king on the head (high) or a
 *                         little lower, from the left or right edge: a white star, and the carrot bouncing back off.
 *   carrotIcon    14 x 14 icon (a carrot, for the dock's count), slot (an empty place in the count: the same carrot,
 *                         dim).
 */
import { canvas, toGrid, type Canvas } from "../paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../sprite.ts";
import { SQUARE, type Pt } from "./common.ts";

const CARROT_PALETTE: Record<string, string> = {
  k: "#21160c", // outline
  K: "#a8471a", // the carrot: orange, dark to light (his own)
  R: "#e8732a",
  J: "#f79a3d",
  P: "#ffc97e",
  a: "#2b5218", // its leaves: the grasshopper's greens
  b: "#447a1f",
  c: "#62a02a",
  d: "#86c13a",
  e: "#b3de5f",
  f: "#3a2313", // soil, dark to light
  g: "#5c3a1f",
  h: "#7d5530",
  i: "#9c7043",
  W: "#f7f3ea", // the white side's token, and its shade
  X: "#c9c0af",
  B: "#2a2521", // the black side's token, and its rim's light
  A: "#5e564d",
  Y: "#f2c14e", // sparkles: gold, its light, white
  y: "#ffe58a",
  w: "#ffffff",
  s: "#8c8577", // the empty slot's carrot (dim)
  t: "#6b655a",
};

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;

/**
 * A carrot painted onto `cv`: its top (the shoulder, where the leaves sprout) at `top`, pointing `deg` (0 down, 90 to
 * our left, 180 up, 270 to our right), `len` long and `w` wide at its rounded shoulder, tapering to its tip, ridged
 * across and lit from the top left; five leaves (the middle one `leaf` long) fanning out of its top, spread by `sway`
 * degrees more or less. `dim`: all in the empty slot's gray.
 */
function paintCarrot(cv: Canvas, top: Pt, deg: number, len: number, w: number, leaf: number, sway = 0, dim = false): void {
  const a = (deg * Math.PI) / 180;
  const u: Pt = [-Math.sin(a), Math.cos(a)];
  const n: Pt = [-u[1], u[0]];
  // Which way across the carrot faces the light (the top left).
  const lit = -(n[0] + n[1]) >= 0 ? 1 : -1;
  for (let y = 0; y < cv.length; y++)
    for (let x = 0; x < cv[0]!.length; x++) {
      const px = x + 0.5 - top[0];
      const py = y + 0.5 - top[1];
      // The leaves: three slim leaves fanning back from the top.
      for (const [i, turn] of [[3, -68 - sway], [4, 68 - sway], [0, -34 - sway], [2, 34 - sway], [1, 0 + sway / 2]] as const) {
        const b = a + Math.PI + (turn * Math.PI) / 180;
        const v: Pt = [-Math.sin(b), Math.cos(b)];
        const l = i === 1 ? leaf : i > 2 ? leaf * 0.5 : leaf * 0.8;
        const along = px * v[0] + py * v[1];
        const across = px * -v[1] + py * v[0];
        const t = along / l;
        if (t < 0 || t > 1) continue;
        const half = Math.max(0.5, (i === 1 ? 1.5 : i > 2 ? 1 : 1.25) * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)));
        if (Math.abs(across) <= half) cv[y]![x] = dim ? "t" : ramp("bcde", 0.55 - 0.35 * t - 0.25 * (across / half) * (v[1] > 0 ? -1 : 1) + (i === 1 ? 0.1 : 0));
      }
    }
  for (let y = 0; y < cv.length; y++)
    for (let x = 0; x < cv[0]!.length; x++) {
      const px = x + 0.5 - top[0];
      const py = y + 0.5 - top[1];
      const s = px * u[0] + py * u[1];
      const d = px * n[0] + py * n[1];
      // Its width along it: full at the shoulder (rounded over the top), to a point at the tip.
      const cap = Math.min(w / 2, 2.2);
      const half = s < cap ? Math.sqrt(Math.max(0, cap ** 2 - (cap - s) ** 2)) + (w / 2 - cap) : (w / 2) * Math.pow(Math.max(0, 1 - (s - cap) / (len - cap)), 0.9);
      if (s < 0 || s > len || Math.abs(d) > half) continue;
      if (dim) {
        cv[y]![x] = "s";
        continue;
      }
      const l = 0.55 + 0.4 * lit * (d / Math.max(half, 0.5)) * -1 + (s < 1 ? 0.15 : 0);
      const ridge = s > 2 && Math.round(s) % 3 === 0 && Math.abs(d) < half * 0.8 && l < 0.8;
      cv[y]![x] = ridge ? "K" : ramp("KRJP", l);
    }
}

/** A part from a painter on a canvas `w` x `h`. */
const part = (w: number, h: number, paint: (cv: Canvas) => void, outline = true): Part => {
  const cv = canvas(w, h);
  paint(cv);
  return { grid: toGrid(cv), outline };
};
const inEllipse = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

// ---- A carrot planted on a square: its leaves and the top of it showing above a small mound of soil.

/** The mound of soil in front of the carrot's foot: a low dome, lit from the top left, a few crumbs on it. */
function soil(cv: Canvas): void {
  const top = (x: number) => 22.6 + 5.2 * ((x + 0.5 - 16) / 9) ** 2;
  for (let y = 0; y < SQUARE; y++)
    for (let x = 0; x < SQUARE; x++) {
      const t = top(x);
      if (Math.abs(x + 0.5 - 16) > 9 || y + 0.5 < t || y + 0.5 > 28.6) continue;
      cv[y]![x] = ramp("fghi", 0.78 - 0.28 * ((x + 0.5 - 16) / 9) - 0.75 * ((y + 0.5 - t) / (28.6 - t + 0.01)));
    }
  // Crumbs: a few lighter and darker pixels, the same every time.
  for (const [x, y, k] of [[12, 24, "i"], [14, 26, "g"], [19, 25, "h"], [21, 26, "g"], [10, 26, "h"], [17, 27, "g"], [22, 27, "h"]] as const) if (cv[y]![x] !== ".") cv[y]![x] = k;
}
/** Where the planted carrot's shoulder is, and its size. */
const PLANT: Pt = [16, 17.5];
const CARROT_LEN = 12;
const CARROT_W = 7;
const LEAF = 10.5;

const PARTS: Record<string, Part> = {
  mound: part(SQUARE, SQUARE, (cv) => soil(cv)),
  // Once pulled: the hole it left, a ring of loose soil round it (no outline: crumbs on the square).
  hole: part(
    SQUARE,
    SQUARE,
    (cv) => {
      const ring = inEllipse(16, 26, 4.6, 1.7);
      const hole = inEllipse(16, 26, 2.4, 1);
      for (let y = 0; y < SQUARE; y++) for (let x = 0; x < SQUARE; x++) if (ring(x, y)) cv[y]![x] = hole(x, y) ? "f" : y < 26 ? "i" : "h";
    },
    false,
  ),
  loose: part(
    SQUARE,
    SQUARE,
    (cv) => {
      for (const [x, y, k] of [[10, 25, "h"], [11, 26, "g"], [12, 24, "i"], [13, 27, "h"], [20, 24, "h"], [21, 25, "i"], [21, 26, "g"], [19, 27, "h"], [22, 27, "g"], [15, 28, "h"], [17, 28, "g"], [9, 27, "g"]] as const) cv[y]![x] = k;
    },
    false,
  ),
};
for (const sway of [-6, 0, 6]) PARTS[`planted:${sway}`] = part(SQUARE, SQUARE, (cv) => paintCarrot(cv, PLANT, 0, 9, CARROT_W, LEAF, sway));
/** The whole carrot, out of the ground: its top `rise` pixels above where it was planted, tilted `deg`. */
const pulledName = (rise: number, deg: number) => {
  const name = `pulled:${rise}:${deg}`;
  PARTS[name] ??= part(SQUARE, SQUARE, (cv) => paintCarrot(cv, [PLANT[0], PLANT[1] - rise], deg, CARROT_LEN - 1, CARROT_W - 1, LEAF - 1, 0));
  return name;
};
/** The side's token in the square's bottom-right corner: a disc in its color, a little carrot on it. */
for (const side of ["W", "B"] as const)
  PARTS[`token${side}`] = part(SQUARE, SQUARE, (cv) => {
    const disc = inEllipse(26.5, 26.5, 4.3, 4.3);
    for (let y = 20; y < SQUARE; y++)
      for (let x = 20; x < SQUARE; x++) if (disc(x, y)) cv[y]![x] = side === "W" ? (x + y > 54 ? "X" : "W") : x + y < 51 ? "A" : "B";
    const glyph = ["...dc", "..RJd", ".RRJ.", ".KR..", "K...."];
    glyph.forEach((row, j) => [...row].forEach((k, i) => k !== "." && (cv[24 + j]![24 + i] = k)));
  });

const L = (name: string, x = 0, y = 0): Layer => ({ part: name, x, y });
/** The dug square, once the carrot's out. */
const DUG: Layer[] = [L("loose"), L("hole")];
const planted = (sway = 0): Layer[] => [L(`planted:${sway}`), L("mound")];
/** A sparkle (frame pixels): gold, white at its heart, `big` with longer rays. */
const sparkle = ([x, y]: Pt, big = false): Speck[] => [[x, y, "w"], [x - 1, y, "y"], [x + 1, y, "y"], [x, y - 1, "y"], [x, y + 1, "y"], ...(big ? ([[x - 2, y, "Y"], [x + 2, y, "Y"], [x, y - 2, "Y"], [x, y + 2, "Y"]] as Speck[]) : [])];
/** Soil thrown up off the mound (`t` frames on), either side, each a crumb with a darker one under it. */
const crumbs = (t: number, n = 5): Speck[] => {
  const out: Speck[] = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const x = Math.round(16 + side * (4 + i * 1.3 + t * (2 + (i % 3))));
    const y = Math.round(22 - (3 + (i % 3)) * (t + 1) + 1.6 * (t + 1) ** 2);
    if (x > 0 && x < SQUARE - 1 && y > 0 && y < SQUARE - 1) out.push([x, y, i % 3 ? "h" : "i"], [x, y + 1, "f"]);
  }
  return out;
};

const anims: Record<string, Anim> = {
  /**
   * Planted: the flying carrot comes down point first into the square (the board flies it there, carrotFly); the soil
   * heaps up round it as it sinks in (`thunk`), crumbs flying, it springs up a pixel and settles.
   */
  plant: {
    loop: false,
    frames: [
      { ms: 50, cue: "thunk", layers: [L(`planted:6`, 0, 2), L("mound", 0, 2)], specks: crumbs(0) },
      { ms: 60, layers: [L(`planted:-6`, 0, -1), L("mound", 0, 1)], specks: crumbs(1) },
      { ms: 70, layers: [L(`planted:6`), L("mound")], specks: crumbs(2) },
      { ms: 90, layers: planted(0) },
    ],
  },
  /** Planted, while it waits: its leaves sway, a glint now and then on its shoulder. */
  planted: {
    loop: true,
    frames: Array.from({ length: 8 }, (_, i): Frame => ({ ms: 160, layers: planted([0, 0, 6, 6, 0, 0, -6, -6][i]!), specks: i === 2 ? sparkle([13, 19]) : [] })),
  },
};
for (const side of ["W", "B"] as const) {
  /**
   * Pulled by a piece of that side (`side`): the carrot pops up out of the soil (`pop`), crumbs flying, wobbles at the
   * top and is gone in a sparkle; the dug soil and the side's token stay (claimed<side>).
   */
  anims[`pull${side}`] = {
    loop: false,
    frames: [
      { ms: 60, cue: "pop", layers: [L(pulledName(3, 0)), L("mound")], specks: crumbs(0, 7) },
      { ms: 70, layers: [...DUG, L(pulledName(7, 12)), L(`token${side}`)], specks: crumbs(1, 7) },
      { ms: 90, layers: [...DUG, L(pulledName(8, -12)), L(`token${side}`)], specks: [...crumbs(2, 7), ...sparkle([22, 9])] },
      { ms: 90, layers: [...DUG, L(pulledName(8, 0)), L(`token${side}`)], specks: [...sparkle([16, 14], true), ...sparkle([9, 10])] },
      { ms: 70, layers: [...DUG, L(`token${side}`)], specks: [...sparkle([16, 12], true), ...sparkle([22, 7]), ...sparkle([10, 6])] },
      { ms: 60, layers: [...DUG, L(`token${side}`)], specks: [[16, 11, "y"], [22, 6, "Y"], [10, 5, "Y"]] },
      { ms: 40, layers: [...DUG, L(`token${side}`)] },
    ],
  };
  anims[`claimed${side}`] = { loop: true, frames: [{ ms: 1000, layers: [...DUG, L(`token${side}`)] }] };
}

export const CARROT_PATCH: Character = {
  id: "carrot-patch",
  name: "A carrot of Chub's Carrot Patch",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 28],
  palette: CARROT_PALETTE,
  parts: PARTS,
  anims,
};

// ---- A carrot in flight, tumbling end over end (moved by the board from his paw to its square).

export const CARROT_FLY: Character = {
  id: "carrot-fly",
  name: "A flying carrot",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 16],
  palette: CARROT_PALETTE,
  parts: { fly: part(SQUARE, SQUARE, (cv) => paintCarrot(cv, [19, 12], 45, 10, 5, 6)) },
  anims: { fly: { loop: true, frames: ([0, 1, 2, 3] as const).map((rot): Frame => ({ ms: 70, layers: [{ part: "fly", x: 0, y: 0, rot }] })) } },
};

// ---- His attack on a king: a carrot bonking the king.

/** A small carrot for the bonk, pointing `deg`, its middle at the square's (16, 16). */
const BONK_PARTS: Record<string, Part> = {};
const bonkCarrot = (deg: number): string => {
  const name = `bonk:${deg}`;
  const a = (deg * Math.PI) / 180;
  BONK_PARTS[name] ??= part(SQUARE, SQUARE, (cv) => paintCarrot(cv, [16 + Math.sin(a) * 4, 16 - Math.cos(a) * 4], deg, 8, 4, 4.5));
  return name;
};
/** A white star where it hits (`big`: the moment of the bonk), with short gold lines out from it. */
const star = ([x, y]: Pt, step: 0 | 1 | 2): Speck[] => {
  if (step === 2) return [[x - 4, y - 3, "Y"], [x + 4, y - 3, "Y"], [x, y - 5, "y"], [x - 5, y + 1, "Y"]];
  const r = step === 0 ? 2 : 3;
  const out: Speck[] = [[x, y, "w"]];
  for (let i = 1; i <= r; i++) out.push([x - i, y, "w"], [x + i, y, "w"], [x, y - i, "w"], [x, y + i, i === r ? "y" : "w"]);
  out.push([x - 1, y - 1, "y"], [x + 1, y - 1, "y"], [x - 1, y + 1, "y"], [x + 1, y + 1, "y"]);
  if (step === 1) out.push([x - 5, y - 4, "Y"], [x + 5, y - 4, "Y"], [x - 6, y + 1, "Y"], [x + 6, y + 1, "Y"], [x, y - 6, "Y"]);
  return out;
};
const hitAnims: Record<string, Anim> = {};
for (const [kind, y] of [["H", 9], ["L", 13]] as const)
  for (const from of ["L", "R"] as const) {
    // Drawn coming in from the left edge, and mirrored for the right.
    const m = (x: number) => (from === "L" ? x : SQUARE - 1 - x);
    const ml = (l: Layer): Layer => (from === "L" ? l : { ...l, flipX: true });
    const sp = (s: Speck[]): Speck[] => s.map(([x, yy, k]): Speck => [m(x), yy, k]);
    const at = (deg: number, cx: number, cy: number): Layer => ml({ part: bonkCarrot(deg), x: from === "L" ? cx - 16 : 16 - cx, y: cy - 16 });
    hitAnims[`hit${kind}${from}`] = {
      loop: false,
      frames: [
        { ms: 50, layers: [at(80, 10, y)], specks: sp(star([15, y], 0)) },
        { ms: 70, layers: [at(130, 7, y - 4)], specks: sp([...star([15, y], 1), [12, y + 2, "R"], [13, y + 3, "J"]]) },
        { ms: 60, layers: [at(200, 4, y - 7)], specks: sp(star([15, y], 2)) },
        { ms: 20, layers: [] },
      ],
    };
  }

/** A carrot bonking a king (Chub's attack on a king): `hit<H|L><L|R>`, about 200 ms, ends empty. Over the piece. */
export const CARROT_HIT: Character = {
  id: "carrot-hit",
  name: "A carrot bonking a king",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: CARROT_PALETTE,
  parts: BONK_PARTS,
  anims: hitAnims,
};
// (Its parts are made as its frames are built, above.)

// ---- The dock's icon for the race's count.

const ICON = 14;
export const CARROT_ICON: Character = {
  id: "carrot-icon",
  name: "Carrot (the dock's count)",
  w: ICON,
  h: ICON,
  foot: [7, 13],
  palette: CARROT_PALETTE,
  parts: {
    icon: part(ICON, ICON, (cv) => paintCarrot(cv, [8.6, 5.4], 45, 8.5, 4.6, 4.6)),
    slot: part(ICON, ICON, (cv) => paintCarrot(cv, [8.6, 5.4], 45, 8.5, 4.6, 4.6, 0, true), false),
  },
  anims: {
    icon: { loop: true, frames: [{ ms: 1000, layers: [L("icon")] }] },
    slot: { loop: true, frames: [{ ms: 1000, layers: [L("slot")] }] },
  },
};
