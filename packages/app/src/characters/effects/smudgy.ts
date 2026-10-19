/**
 * Smudgy's board art (not wired in yet: drafts for Eric, Oct 19): the splash of paint that covers his pawns (Camouflage),
 * the paint dripping off the disguised piece as it's revealed, the brush stroke of Repaint in either tint, the blob of
 * paint that flies from his brush to the board, and the splat of a blob on a king (his attack on a king). Drawn in his
 * sprite's style: the same yellow paint, dark outlines, light from the top left, so it reads on the light and the dark
 * squares of every board color scheme (Classic, Green, Gold) at a phone's 40 px.
 *
 *   paintSplash  square  land<A|B|C> (a splash of paint lands over a piece: it spreads, thick enough to hide it;
 *                        `splat`; ends on hold's look, 220 ms), hold<A|B|C> (loop: the splash, a gleam moving on it),
 *                        fade<A|B|C> (it thins and dries away, ends empty, 240 ms). The three shapes differ so a row of
 *                        pawns doesn't look stamped: use A, B, C in turn along the squares. Over the piece.
 *   paintDrip    square  drip (ends empty, 470 ms): the paint on a piece's square, its drips running down and the
 *                        last drops falling off it; the piece shows through under it. `drip` is the cue's moment.
 *   brushStroke  square  stroke<C|N> (ends empty, 340 ms): a swoosh of cream (C: your color, white's) or charcoal
 *                        (N: his color, black's) paint swept across the square from the top left to the bottom
 *                        right, bristle streaks in it, flecks flying; it holds a moment, thins and goes.
 *   paintFly     square  fly (loop): a blob of paint wobbling, a short tail behind it up and to the right; move it
 *                        from his brush to the square (or the row).
 *   paintHit     square  hit<H|L><L|R> (ends empty, about 200 ms): a blob of paint splatting on a king's head (high)
 *                        or a little lower, from the left or right edge: it splats, runs and drips.
 */
import { canvas, edge, ellipse, inEllipse, toGrid, type Canvas } from "../paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../sprite.ts";
import { SQUARE, hitAnims, type Pt } from "./common.ts";

export const PAINT_PALETTE: Record<string, string> = {
  k: "#2a1c06", // outline: a dark brown that reads on every square
  P: "#b97c06", // his yellow paint (the brush's): dark, mid, light
  R: "#f7c60f",
  K: "#fff48c",
  w: "#ffffff",
  r: "#d9342c", // flecks of red, blue and green from his palette, so the yellow never blends into a gold square
  b: "#2f6fdc",
  g: "#2fa84a",
  c: "#b5a98a", // cream (white's), dark to light
  C: "#f1e8d2",
  x: "#ffffff",
  n: "#0f1013", // charcoal (black's), dark to light
  N: "#30333a",
  M: "#6c727d",
};

/** The same palette, every color see-through by `alpha` (two hex digits), for a thinning splash. */
const faded = (alpha: string): Record<string, string> => Object.fromEntries(Object.entries(PAINT_PALETTE).map(([k, v]) => [k, `${v}${alpha}`]));

const part = (draw: (cv: Canvas) => void, outline = true): Part => {
  const cv = canvas(SQUARE, SQUARE);
  draw(cv);
  return { grid: toGrid(cv), outline };
};
const L = (name: string): Layer => ({ part: name, x: 0, y: 0 });
const frame = (ms: number, layers: Layer[] = [], extra: Partial<Frame> = {}): Frame => ({ ms, layers, ...extra });

// ---- The splash.

type Lobe = readonly [dx: number, dy: number, r: number];
/** Three shapes for the splash: a body and lobes round it, from the square's middle. */
const SPLASHES: readonly { rx: number; ry: number; lobes: readonly Lobe[]; dabs: readonly (readonly [number, number, string])[] }[] = [
  { rx: 12.2, ry: 11.6, lobes: [[0, -12.5, 4.8], [11.5, -8, 4.6], [13.5, 4, 4.4], [6, 12.8, 4.8], [-7.5, 12, 4.6], [-13.2, -1, 4.6], [-9.5, -10.5, 4]], dabs: [[-6, -2, "r"], [5, -5, "b"], [3, 6, "g"]] },
  { rx: 12.6, ry: 11.2, lobes: [[-3, -12.2, 4.6], [9, -10.5, 4.8], [13.6, 0, 4.4], [11, 10.5, 4.4], [0, 13, 4.8], [-10.5, 9.5, 4.6], [-13.8, -3, 4.4]], dabs: [[-4, -6, "b"], [6, 1, "r"], [-5, 5, "g"]] },
  { rx: 12, ry: 12.2, lobes: [[2, -13, 4.6], [12, -4.5, 4.8], [12.5, 8.5, 4.4], [-2, 13.2, 4.6], [-12.2, 5.5, 4.7], [-11.5, -8, 4.5]], dabs: [[-2, -7, "g"], [5, 3, "b"], [-6, 3, "r"]] },
];

/** A splash of shape `v`, `s` its size (1 as it holds; below, as it spreads; the lobes lead it). */
function splashPart(v: number, s: number, gleam = 0): Part {
  const sh = SPLASHES[v]!;
  return part((cv) => {
    const body = inEllipse(15.5, 15.5, sh.rx * s, sh.ry * s);
    const lobes = sh.lobes.map(([dx, dy, r]) => inEllipse(15.5 + dx * s, 15.5 + dy * s, r * s, r * s));
    for (let y = 0; y < SQUARE; y++) for (let x = 0; x < SQUARE; x++) if (body(x, y) || lobes.some((l) => l(x, y))) cv[y]![x] = "R";
    // Light from the top left: its lit edges pale, its shaded edges deep.
    edge(cv, 1, 0, "R", "P", 2);
    edge(cv, 0, 1, "R", "P", 2);
    edge(cv, -1, 0, "R", "K");
    edge(cv, 0, -1, "R", "K");
    if (s >= 0.95) {
      // A gloss at its top left, and the flecks of his palette in it.
      for (const [dx, dy] of [[-6, -5], [-5, -6], [-6, -4], [-4, -6]] as const) {
        const x = Math.round(15.5 + dx + gleam);
        const y = Math.round(15.5 + dy);
        if (cv[y]?.[x] === "R" || cv[y]?.[x] === "K") cv[y]![x] = "w";
      }
      for (const [dx, dy, k] of sh.dabs) {
        const x = Math.round(15.5 + dx);
        const y = Math.round(15.5 + dy);
        for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) if (cv[y + oy]?.[x + ox] === "R") cv[y + oy]![x + ox] = k;
      }
    }
  });
}
/** Droplets thrown off the splash (`t` 0 to 2 as it lands), around the square's rim. */
const droplets = (t: number): Speck[] =>
  Array.from({ length: 8 }, (_, i): Speck[] => {
    const a = (i / 8) * Math.PI * 2 + 0.35;
    const d = 11 + t * 2.2 + (i % 3);
    const x = Math.round(15.5 + Math.cos(a) * d);
    const y = Math.round(15.5 + Math.sin(a) * d);
    return x < 1 || y < 1 || x > SQUARE - 2 || y > SQUARE - 2 ? [] : [[x, y, i % 2 ? "R" : "K"]];
  }).flat();

const splashParts: Record<string, Part> = {};
const splashAnims: Record<string, Anim> = {};
for (const [v, name] of ["A", "B", "C"].entries()) {
  for (const [s, id] of [[0.4, "s0"], [0.75, "s1"], [1.12, "s2"], [1, "hold"], [1, "hold2"]] as const) splashParts[`${name}${id}`] = splashPart(v, s, id === "hold2" ? 3 : 0);
  splashAnims[`land${name}`] = {
    loop: false,
    frames: [
      frame(50, [L(`${name}s0`)], { cue: "splat" }),
      frame(60, [L(`${name}s1`)], { specks: droplets(0) }),
      frame(70, [L(`${name}s2`)], { specks: droplets(1) }),
      frame(40, [L(`${name}hold`)], { specks: droplets(2) }),
    ],
  };
  splashAnims[`hold${name}`] = { loop: true, frames: [frame(500, [L(`${name}hold`)]), frame(400, [L(`${name}hold2`)])] };
  splashAnims[`fade${name}`] = {
    loop: false,
    frames: [
      frame(80, [L(`${name}hold`)], { pal: faded("d8") }),
      frame(80, [L(`${name}hold`)], { pal: faded("98") }),
      frame(80, [L(`${name}hold`)], { pal: faded("50") }),
      frame(20),
    ],
  };
}
export const PAINT_SPLASH: Character = {
  id: "paint-splash",
  name: "A splash of paint over a piece",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: PAINT_PALETTE,
  parts: splashParts,
  anims: splashAnims,
};

// ---- The drips.

/** Where the drips hang along the paint's lower edge, and how long each runs (0 to 1 of the square's rest). */
const DRIPS: readonly (readonly [x: number, len: number])[] = [[3, 12], [10, 20], [16, 9], [22, 17], [27, 8]];

/** The paint on a piece's square: a band across its top, its drips `t` (0 to 1) of the way down. `thin`: the band wearing away. */
function dripPart(t: number, thin = false): Part {
  return part((cv) => {
    const bottom = (x: number) => 7 + Math.round(1.4 * Math.sin(x * 0.9 + 1));
    for (let x = 2; x <= 29; x++) for (let y = thin ? 5 : 2; y <= bottom(x); y++) cv[y]![x] = "R";
    for (const [x0, len] of DRIPS) {
      const l = Math.round(len * t);
      for (let y = bottom(x0); y <= bottom(x0) + l; y++) for (const dx of [0, 1, 2]) if (cv[y] && x0 + dx < SQUARE - 1) cv[y]![x0 + dx] = "R";
      // The bulb at its end.
      if (l > 3) ellipse(cv, x0 + 1.5, bottom(x0) + l + 0.5, 2.5, 2.4, "R");
    }
    edge(cv, 1, 0, "R", "P");
    edge(cv, 0, 1, "R", "P");
    edge(cv, -1, 0, "R", "K");
    edge(cv, 0, -1, "R", "K");
  });
}
/** The last drops, falling off the ends of the longest drips (`t` frames on). */
const drops = (t: number): Speck[] =>
  [[10, 7 + 20], [22, 7 + 17], [16, 7 + 9]].flatMap(([x, y], i): Speck[] => {
    const yy = y! + 2 + t * (4 + i);
    return yy > SQUARE - 2 ? [] : [[x! + 1, yy, "R"], [x! + 2, yy, "R"], [x! + 1, yy + 1, "P"], [x! + 2, yy + 1, "P"]];
  });

export const PAINT_DRIP: Character = {
  id: "paint-drip",
  name: "Paint dripping off a piece",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: PAINT_PALETTE,
  parts: { d1: dripPart(0.2), d2: dripPart(0.45), d3: dripPart(0.7), d4: dripPart(1), d5: dripPart(1, true) },
  anims: {
    drip: {
      loop: false,
      frames: [
        frame(70, [L("d1")], { cue: "drip" }),
        frame(80, [L("d2")]),
        frame(90, [L("d3")]),
        frame(100, [L("d4")], { specks: drops(0) }),
        frame(70, [L("d5")], { specks: drops(1), pal: faded("c8") }),
        frame(40, [], { specks: drops(2) }),
        frame(20),
      ],
    },
  },
};

// ---- The brush stroke.

/** A point on the swoosh at `t` (0 to 1): a curve from the top left over to the bottom right. */
const swoosh = (t: number): Pt => {
  const u = 1 - t;
  const P: Pt[] = [[2, 9], [11, 3], [22, 12], [29, 24]];
  return [u ** 3 * P[0]![0] + 3 * u * u * t * P[1]![0] + 3 * u * t * t * P[2]![0] + t ** 3 * P[3]![0], u ** 3 * P[0]![1] + 3 * u * u * t * P[1]![1] + 3 * u * t * t * P[2]![1] + t ** 3 * P[3]![1]];
};

/** The stroke as far as `reach` (0 to 1) in the ramp `ramp` (dark to light), thick in the middle, dry bristle streaks at its tail. */
function strokePart(reach: number, ramp: string): Part {
  return part((cv) => {
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (t > reach) break;
      const [cx, cy] = swoosh(t);
      const half = 1.8 + 3.6 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      const [nx, ny] = ((): Pt => {
        const [ax, ay] = swoosh(Math.min(1, t + 0.02));
        const [bx, by] = swoosh(Math.max(0, t - 0.02));
        const d = Math.hypot(ax - bx, ay - by) || 1;
        return [-(ay - by) / d, (ax - bx) / d];
      })();
      for (let w = -half; w <= half; w += 0.4) {
        // Across the stroke, from its lit side (the upper left) to its shaded one; the dry streaks gap out at the tail.
        const across = w / half;
        const gap = t > 0.72 && Math.abs(Math.sin(w * 2.1 + 1)) > 0.8 - (t - 0.72) * 1.8;
        if (gap) continue;
        const sgn = nx + ny < 0 ? -1 : 1;
        const l = 0.62 - 0.45 * across * sgn + (Math.abs(Math.sin(w * 3.7)) > 0.93 ? 0.3 : 0);
        const x = Math.round(cx + nx * w);
        const y = Math.round(cy + ny * w);
        if (cv[y]?.[x] !== undefined) cv[y]![x] = ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(l * ramp.length)))]!;
      }
    }
  });
}
/** A few flecks flung off the stroke (`t` frames on), in `ramp`'s colors. */
const flecks = (t: number, ramp: string): Speck[] =>
  [[0.5, -1], [0.7, 1], [0.85, -1.4]].map(([at, side], i): Speck => {
    const [x, y] = swoosh(at!);
    return [Math.round(x! + side! * (5 + t * 3 + i)), Math.round(y! - (3 + t * 2)), ramp[1 + (i % 2)]!];
  }).filter(([x, y]) => x > 0 && y > 0 && x < SQUARE - 1 && y < SQUARE - 1);

const strokeParts: Record<string, Part> = {};
const strokeAnims: Record<string, Anim> = {};
for (const [tint, ramp] of [["C", "cCx"], ["N", "nNM"]] as const) {
  for (const [reach, id] of [[0.4, "a"], [0.78, "b"], [1, "c"]] as const) strokeParts[`${tint}${id}`] = strokePart(reach, ramp);
  strokeAnims[`stroke${tint}`] = {
    loop: false,
    frames: [
      frame(40, [L(`${tint}a`)], { cue: "swoosh" }),
      frame(50, [L(`${tint}b`)], { specks: flecks(0, ramp) }),
      frame(90, [L(`${tint}c`)], { specks: flecks(1, ramp) }),
      frame(80, [L(`${tint}c`)], { pal: faded("b0"), specks: flecks(2, ramp) }),
      frame(60, [L(`${tint}c`)], { pal: faded("58") }),
      frame(20),
    ],
  };
}
export const BRUSH_STROKE: Character = {
  id: "brush-stroke",
  name: "A brush stroke over a square",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: PAINT_PALETTE,
  parts: strokeParts,
  anims: strokeAnims,
};

// ---- The blob in flight.

export const PAINT_FLY: Character = {
  id: "paint-fly",
  name: "A blob of paint in flight",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 16],
  palette: PAINT_PALETTE,
  parts: {
    a: part((cv) => {
      ellipse(cv, 17, 15, 5.5, 5, "R");
      ellipse(cv, 12, 18, 2.4, 2.2, "R");
      ellipse(cv, 21, 11, 2.4, 2.2, "R");
      edge(cv, 1, 0, "R", "P");
      edge(cv, 0, 1, "R", "P");
      edge(cv, -1, 0, "R", "K");
      edge(cv, 0, -1, "R", "K");
      cv[12]![15] = "w";
    }),
    b: part((cv) => {
      ellipse(cv, 17, 15, 5, 5.5, "R");
      ellipse(cv, 11, 17, 2.2, 2.4, "R");
      ellipse(cv, 22, 12, 2.2, 2.4, "R");
      ellipse(cv, 14, 21, 1.8, 1.8, "R");
      edge(cv, 1, 0, "R", "P");
      edge(cv, 0, 1, "R", "P");
      edge(cv, -1, 0, "R", "K");
      edge(cv, 0, -1, "R", "K");
      cv[12]![15] = "w";
    }),
  },
  anims: { fly: { loop: true, frames: [frame(70, [L("a")]), frame(70, [L("b")])] } },
};

// ---- A blob splatting on a king (his attack on a king).

/** A blob's splat at (`x`, `y`) on the king, as specks with the outline: it lands, spreads, then runs. */
function splat([x, y]: Pt, step: 0 | 1 | 2): Speck[] {
  const cv = canvas(SQUARE, SQUARE);
  const r = [3, 5.5, 5][step]!;
  const lobes: Pt[] = step === 0 ? [] : [[-r, -1], [r - 1, -2], [1, -r], [-1, r - 1], [r * 0.7, r * 0.6], [-r * 0.7, -r * 0.7]];
  ellipse(cv, x, y, r, r * 0.9, "R");
  for (const [dx, dy] of lobes) ellipse(cv, x + dx, y + dy, 2, 2, "R");
  edge(cv, 1, 0, "R", "P");
  edge(cv, 0, 1, "R", "P");
  edge(cv, -1, 0, "R", "K");
  edge(cv, 0, -1, "R", "K");
  // The drips running down from the splat as it settles.
  if (step === 2) for (const [dx, len] of [[-3, 4], [1, 7], [4, 3]] as const) for (let j = 0; j <= len; j++) if (cv[Math.round(y + r * 0.9 + j)]) cv[Math.round(y + r * 0.9 + j)]![Math.round(x + dx)] = j === len ? "P" : "R";
  const out: Speck[] = [];
  const filled = (px: number, py: number) => cv[py]?.[px] !== undefined && cv[py]![px] !== ".";
  for (let py = 0; py < SQUARE; py++)
    for (let px = 0; px < SQUARE; px++) {
      if (filled(px, py)) out.push([px, py, cv[py]![px]!]);
      else if (([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => filled(px + dx, py + dy))) out.push([px, py, "k"]);
    }
  // A white flash as it lands, and the drops flying off.
  if (step === 0) out.push([x, y, "w"], [x - 1, y - 1, "w"]);
  if (step === 1) out.push([x - 8, y - 3, "R"], [x + 8, y - 4, "R"], [x - 6, y + 6, "K"], [x + 7, y + 5, "R"], [x, y - 8, "K"]);
  return out;
}

export const PAINT_HIT: Character = {
  id: "paint-hit",
  name: "A blob of paint splatting on a king",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: PAINT_PALETTE,
  parts: {},
  anims: hitAnims([["H", 9], ["L", 15]], (y, step) => splat([15, y], step)),
};
