/**
 * Ranked emblem, Wood tier (tier 1 of 7): a carved honey-wood pawn standing in front of a faceted walnut badge, an
 * octagon cut like a stone and framed like a picture (mitred bevel, grain running along each side) around a dark
 * walnut table. Five stills, one per division: d5 the badge and the pawn alone; d4 adds four pale pegs round the
 * edge; d3 a pair of oak leaves at its sides; d2 an acorn crest on top; d1 a glint on the pawn and a thin glow round
 * the badge. Light from the top left. Every part is outlined by the format, so the pawn is cut out of the badge.
 */
import { canvas, inPoly, line, poly, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE = {
  k: "#24120a", // outline
  // The pawn: honey, dark to light.
  f: "#5e2f16",
  e: "#8a4a20",
  d: "#b4692a",
  c: "#d88c35",
  b: "#efae4c",
  a: "#fbd584",
  h: "#fff1c2", // glint
  w: "#ffffff",
  // The badge: walnut, light to dark.
  o: "#d8a35f",
  p: "#c28a47",
  q: "#a8733a",
  r: "#8d5d2e",
  s: "#724624",
  t: "#5a3519",
  u: "#432611",
  // The table the pawn stands on.
  x: "#5b3419",
  y: "#4a2a14",
  z: "#3a200f",
  // Oak leaves.
  g: "#a9cc5c",
  G: "#7aa73f",
  n: "#4f7d2d",
  N: "#33582a",
  // The glow (see-through): near, far.
  "1": "#ffd666e6",
  "2": "#ffbc44a0",
} as const;

// ---- Little helpers.

const rnd = (a: number, b: number, c = 0): number => {
  let h = Math.imul(a + 101, 73856093) ^ Math.imul(b + 57, 19349663) ^ Math.imul(c + 13, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 1000 / 1000;
};

const WALNUT = "opqrstu";
const darker = (k: string): string => WALNUT[Math.min(WALNUT.length - 1, WALNUT.indexOf(k) + 1)] ?? k;
const lighter = (k: string): string => WALNUT[Math.max(0, WALNUT.indexOf(k) - 1)] ?? k;

type Pt = readonly [number, number];

// ---- The badge: 34 x 34, an octagon framed by eight mitred facets round a recessed table.

const OUT: readonly Pt[] = [[10, 0], [24, 0], [34, 10], [34, 24], [24, 34], [10, 34], [0, 24], [0, 10]];
const IN: readonly Pt[] = [[12, 4], [22, 4], [30, 12], [30, 22], [22, 30], [12, 30], [4, 22], [4, 12]];
/** Top, top right, right, bottom right, bottom, bottom left, left, top left: lit from the top left. */
const FACET = ["p", "q", "r", "t", "s", "r", "p", "o"] as const;
const edgePx = (n: number): number => (n >= 17 ? n - 1 : n);

const badge: Part = (() => {
  const cv = canvas(34, 34);
  const facets = OUT.map((a, i): Pt[] => [a, OUT[(i + 1) % 8]!, IN[(i + 1) % 8]!, IN[i]!]);
  facets.forEach((f, i) => poly(cv, f, FACET[i]!));
  // Wood grain along each side of the frame: streaks parallel to the outer edge, broken into short runs.
  for (let i = 0; i < 8; i++) {
    const A = OUT[i]!;
    const B = OUT[(i + 1) % 8]!;
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const ex = (B[0] - A[0]) / len;
    const ey = (B[1] - A[1]) / len;
    const inside = inPoly(facets[i]!);
    for (let y = 0; y < 34; y++)
      for (let x = 0; x < 34; x++) {
        if (!inside(x, y)) continue;
        const X = x + 0.5 - A[0];
        const Y = y + 0.5 - A[1];
        const d = X * -ey + Y * ex;
        const s = X * ex + Y * ey;
        const band = Math.floor(d);
        const seg = Math.floor((s + i * 3.7) / 3.2);
        const k = cv[y]![x]!;
        if ((band === 1 && rnd(seg, 1, i) < 0.62) || (band === 3 && rnd(seg, 3, i) < 0.42)) cv[y]![x] = darker(k);
        else if (band === 2 && rnd(seg, 2, i) < 0.22) cv[y]![x] = lighter(k);
      }
  }
  // The mitre joints.
  for (let i = 0; i < 8; i++) {
    const a = FACET[(i + 7) % 8]!;
    const b = FACET[i]!;
    const joint = darker(WALNUT.indexOf(a) > WALNUT.indexOf(b) ? a : b);
    line(cv, edgePx(OUT[i]![0]), edgePx(OUT[i]![1]), edgePx(IN[i]![0]), edgePx(IN[i]![1]), joint);
  }
  // The table: dark walnut with long streaks, shadowed along the top and left lip.
  poly(cv, IN, "y");
  const table = inPoly(IN);
  for (let y = 0; y < 34; y++)
    for (let x = 0; x < 34; x++) {
      if (!table(x, y)) continue;
      const seg = Math.floor((x + y * 3) / 5);
      if (y % 3 === 0 && rnd(seg, y, 5) < 0.5) cv[y]![x] = "z";
      else if (y % 4 === 1 && rnd(seg, y, 6) < 0.3) cv[y]![x] = "x";
      if (!table(x, y - 1) || !table(x - 1, y)) cv[y]![x] = "z";
    }
  return { grid: toGrid(cv) };
})();

// ---- Four pale wooden pegs.

const peg: Part = { grid: [".ab.", "abbc", "bbcd", ".cd."] };

// ---- The pawn: 20 x 26, turned on a lathe. Full width of each row, and what the row is.

const PROFILE: readonly (readonly [number, "H" | "C" | "B" | "R" | "F"])[] = [
  [6, "H"], [10, "H"], [12, "H"], [12, "H"], [12, "H"], [12, "H"], [12, "H"], [12, "H"], [10, "H"], [8, "H"],
  [14, "C"], [16, "C"], [14, "C"],
  [8, "B"], [8, "B"], [8, "B"], [10, "B"], [10, "B"], [12, "B"], [14, "B"],
  [16, "R"], [16, "R"],
  [16, "F"], [18, "F"], [18, "F"], [16, "F"],
];

const pawn: Part = (() => {
  const cv = canvas(20, PROFILE.length);
  const RAMP = "fedcba";
  const HEAD = "edcba";
  const pick = (ramp: string, v: number): string => ramp[Math.floor(Math.max(0, Math.min(0.999, v)) * ramp.length)]!;
  // First and last row of each kind, to light its top and shade its underside.
  const first = (y: number): boolean => PROFILE[y - 1]?.[1] !== PROFILE[y]![1];
  const last = (y: number): boolean => PROFILE[y + 1]?.[1] !== PROFILE[y]![1];
  PROFILE.forEach(([w, kind], y) => {
    const x0 = 10 - w / 2;
    for (let x = x0; x < x0 + w; x++) {
      const u = (x + 0.5 - 10) / (w / 2);
      // Long vertical streaks of grain, one band darker, in short broken runs.
      const grainy = [4, 7, 9, 12, 15].includes(x) && rnd(x, Math.floor((y + x * 3) / 6), 9) < 0.62 ? -0.19 : 0;
      if (kind === "H") {
        const nx = (x + 0.5 - 10) / 6;
        const ny = (y + 0.5 - 5) / 5.2;
        cv[y]![x] = pick(HEAD, 0.52 - 0.42 * nx - 0.5 * ny + grainy);
        continue;
      }
      let v = 0.56 - 0.5 * u + grainy;
      if (kind === "C") v += first(y) ? 0.2 : last(y) ? -0.3 : 0;
      if (kind === "B") v += first(y) ? -0.22 : -0.04;
      if (kind === "R") v += first(y) ? 0.18 : -0.3;
      if (kind === "F") v += first(y) ? 0.2 : last(y) ? -0.3 : y === 24 ? -0.06 : 0;
      cv[y]![x] = pick(RAMP, v);
    }
  });
  // The underside of the head sits in the collar's shadow.
  for (const x of [6, 7, 8, 9, 10, 11, 12, 13]) if (cv[9]![x] !== ".") cv[9]![x] = pick(HEAD, 0.08);
  // A knot and a nick: well loved.
  cv[16]![11] = "e";
  cv[16]![12] = "f";
  cv[17]![11] = "f";
  cv[23]![5] = "d";
  cv[23]![4] = "d";
  return { grid: toGrid(cv) };
})();

// ---- The acorn crest: 10 x 8, a crosshatched walnut cap over a honey nut.

const CROWN = [
  "......ab......",
  "......bc......",
  ".ab..abbc..ab.",
  ".abc.abbc.abc.",
  "abbbbbbbbbbbbc",
  "bbbbbbabcbbbcd",
  "cddddddcddddde",
];
for (const r of CROWN) if (r.length !== 14) throw new Error(`crown row ${r} is ${r.length} wide`);
const crown: Part = { grid: CROWN };

// ---- An oak leaf, pointing up and out, its lit side toward the top left.

function leaf(right: boolean): Part {
  const W = 10;
  const H = 16;
  const cv: Canvas = canvas(W, H);
  const bx = right ? W - 7.5 : 7.5;
  const by = 15;
  const tx = right ? W - 1 : 1;
  const ty = 0.5;
  const len = Math.hypot(tx - bx, ty - by);
  const ax = (tx - bx) / len;
  const ay = (ty - by) / len;
  // The perpendicular on the lit side (toward the top left).
  let px = -ay;
  let py = ax;
  if (px * -0.55 + py * -0.83 < 0) {
    px = -px;
    py = -py;
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const X = x + 0.5 - bx;
      const Y = y + 0.5 - by;
      const s = (X * ax + Y * ay) / len;
      if (s < 0 || s > 1) continue;
      const q = X * px + Y * py;
      // Oak: the blade swells and pinches in rounded lobes.
      const hw = 3.5 * Math.sin(Math.PI * Math.pow(s, 0.85)) * (0.8 + 0.2 * Math.cos(2 * Math.PI * 2 * s - 0.4));
      if (Math.abs(q) > Math.max(hw, 0.6)) continue;
      const a = Math.abs(q);
      if (q > 0) cv[y]![x] = a < hw * 0.55 ? "g" : "G";
      else cv[y]![x] = a < hw * 0.45 ? "G" : "n";
      if (a < 0.5 && s > 0.15 && s < 0.8) cv[y]![x] = "n";
    }
  return { grid: toGrid(cv) };
}

// ---- The glow: two thin rings of warm light round the badge's outline.

const glow: Part = (() => {
  const S = 42;
  const cv = canvas(S, S);
  const body = canvas(S, S);
  poly(body, OUT.map(([x, y]): Pt => [x + 4, y + 4]), "#");
  const grow = (m: Canvas): Canvas =>
    m.map((row, y) => row.map((c, x) => (c !== "." || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m[y + dy!]?.[x + dx!] && m[y + dy!]![x + dx!] !== ".") ? "#" : ".")));
  const outline = grow(body);
  const r1 = grow(outline);
  const r2 = grow(r1);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (outline[y]![x] !== ".") continue;
      cv[y]![x] = r1[y]![x] !== "." ? "1" : r2[y]![x] !== "." ? "2" : ".";
    }
  return { grid: toGrid(cv), outline: false };
})();

const PARTS: Record<string, Part> = { badge, peg, pawn, crown, leafL: leaf(false), leafR: leaf(true), glow };

// ---- The five divisions.

const BADGE_AT: Pt = [7, 10];
const PAWN_AT: Pt = [14, 14];

function layers(division: 1 | 2 | 3 | 4 | 5): Layer[] {
  const out: Layer[] = [];
  if (division <= 1) out.push({ part: "glow", x: 3, y: 6 });
  out.push({ part: "badge", x: BADGE_AT[0], y: BADGE_AT[1] });
  if (division <= 3) out.push({ part: "leafL", x: 3, y: 15 }, { part: "leafR", x: 35, y: 15 });
  if (division <= 4) for (const [x, y] of [[10, 12], [34, 12], [10, 38], [34, 38]] as const) out.push({ part: "peg", x, y });
  if (division <= 2) out.push({ part: "crown", x: 17, y: 3 });
  out.push({ part: "pawn", x: PAWN_AT[0], y: PAWN_AT[1] });
  return out;
}

/** A four-point glint on the pawn's head, top left. */
const GLINT = [
  [19, 16, "a"], [20, 16, "h"], [21, 16, "w"], [22, 16, "w"], [23, 16, "w"], [24, 16, "h"], [25, 16, "a"],
  [22, 13, "a"], [22, 14, "h"], [22, 15, "w"], [22, 17, "w"], [22, 18, "h"], [22, 19, "a"],
  [21, 15, "h"], [23, 15, "h"], [21, 17, "h"], [23, 17, "h"],
] as const;

const still = (division: 1 | 2 | 3 | 4 | 5): Anim => {
  const frame: Frame = { ms: 1000, layers: layers(division), ...(division === 1 ? { specks: GLINT } : {}) };
  return { loop: false, frames: [frame] };
};

export const RANK_WOOD: Character = {
  id: "rank-wood",
  name: "Wood",
  w: 48,
  h: 48,
  foot: [24, 44],
  palette: PALETTE,
  halo: "#a8733a55",
  parts: PARTS,
  anims: {
    d5: still(5),
    d4: still(4),
    d3: still(3),
    d2: still(2),
    d1: still(1),
  },
};
