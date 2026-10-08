/**
 * The Pawn Golem (boss tier 1): a white chess pawn of carved stone come to life, gold runes burning in it, its
 * boulder fists floating free at its sides. Drawn facing a little left, light from the top left.
 */
import { canvas, ellipse, inEllipse, inPoly, line, roundLight, shade, toGrid } from "./paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "./sprite.ts";

const PALETTE = {
  k: "#0e0e12", // outline
  a: "#4a4540", // stone: deepest shadow
  b: "#6d665d", // dark
  c: "#958c7f", // mid
  d: "#bdb3a3", // light
  e: "#ddd5c4", // highlight
  f: "#f3eee2", // shine
  x: "#2b2825", // cracks, carved lines
  m: "#3f5a33", // moss
  n: "#6b8c45",
  h: "#9a6c1c", // runes: dim
  g: "#f2c14e", // runes: lit (the game's gold)
  G: "#fff1c4", // runes: white-hot
  j: "#f2c14e", // eyes
  J: "#fff1c4",
  w: "#7d7466", // dust
  W: "#a99f8d",
  q: "#c9cfdb", // speed lines
  z: "#0d0e12", // ground shadow
} as const;

const STONE = "abcde";

/** A stone cylinder (a base tier): a lit top face over a side banded from lit left to shaded right. */
function cylinder(w: number, ry: number, height: number): string[][] {
  const cv = canvas(w, Math.ceil(ry * 2 + height));
  const rx = w / 2;
  const top = inEllipse(rx, ry, rx, ry);
  const bottom = inEllipse(rx, ry + height, rx, ry);
  const side = (x: number, y: number) => y + 0.5 >= ry && y + 0.5 <= ry + height;
  shade(cv, (x, y) => side(x, y) || bottom(x, y), "abcd", (x) => 0.62 - 0.55 * ((x + 0.5 - rx) / rx));
  shade(cv, top, "cde", (x, y) => 0.62 - 0.35 * ((x + 0.5 - rx) / rx) - 0.2 * ((y + 0.5 - ry) / ry));
  // The front lip of the top face.
  for (let x = 0; x < w; x++) {
    let lip = -1;
    for (let y = 0; y < cv.length; y++) if (top(x, y)) lip = y;
    if (lip >= 0 && lip + 1 < cv.length && cv[lip + 1]![x] !== ".") cv[lip + 1]![x] = x < w * 0.35 ? "e" : x < w * 0.7 ? "d" : "c";
  }
  return cv;
}

const head: Part = (() => {
  const cv = canvas(21, 21);
  shade(cv, inEllipse(10.5, 10.5, 10.5, 10.5), STONE, roundLight(10.5, 10.5, 10.5, 10.5, 0.05));
  cv[4]![6] = "f";
  cv[4]![7] = "f";
  cv[5]![6] = "f";
  // Heavy brows sloping in (a scowl), burning eyes under them (turned a little left), a jagged mouth and a crack
  // with the gold light showing through.
  line(cv, 2, 7, 7, 9, "x");
  line(cv, 3, 7, 7, 8, "b");
  line(cv, 9, 9, 14, 7, "x");
  line(cv, 9, 8, 13, 7, "b");
  for (const x of [4, 5, 6, 10, 11, 12]) cv[10]![x] = "j";
  cv[10]![5] = "J";
  cv[10]![11] = "J";
  cv[11]![5] = "b";
  cv[11]![11] = "b";
  for (const [x, y, k] of [[5, 15, "x"], [6, 14, "x"], [7, 15, "h"], [8, 15, "x"], [9, 14, "h"], [10, 15, "x"], [11, 14, "x"], [12, 15, "x"]] as const) cv[y]![x] = k;
  for (const [x, y, k] of [[15, 1, "x"], [15, 2, "h"], [14, 3, "x"], [14, 4, "h"], [15, 5, "x"], [16, 6, "h"], [16, 7, "x"], [15, 8, "x"]] as const) cv[y]![x] = k;
  for (const [x, y, k] of [[5, 1, "n"], [6, 1, "n"], [7, 1, "m"], [4, 2, "n"], [5, 2, "m"], [8, 1, "n"], [9, 0, "n"]] as const) if (cv[y]![x] !== ".") cv[y]![x] = k;
  return { grid: toGrid(cv) };
})();

const collar: Part = (() => {
  const cv = canvas(33, 8);
  shade(cv, inEllipse(16.5, 3, 16.5, 3), "bcde", (x, y) => 0.75 - 0.35 * ((x + 0.5 - 16.5) / 16.5) - 0.25 * ((y + 0.5 - 3) / 3));
  shade(cv, (x, y) => y >= 3 && inEllipse(16.5, 4.5, 16.5, 3.5)(x, y) && !inEllipse(16.5, 3, 16.5, 3)(x, y), "abc", (x) => 0.55 - 0.5 * ((x + 0.5 - 16.5) / 16.5));
  return { grid: toGrid(cv) };
})();

/** The trunk, curving out to the base, with a rune carved in the chest. */
const RUNE = ["..g..", ".g.g.", "..g..", ".ggg.", "g.g.g", "..g..", ".g.g."];
const body: Part = (() => {
  const cv = canvas(30, 21);
  const pts = [[4, 0], [26, 0], [24, 5], [24, 11], [27, 16], [30, 21], [0, 21], [3, 16], [6, 11], [6, 5]] as const;
  shade(cv, inPoly(pts), STONE, (x, y) => 0.62 - 0.5 * ((x + 0.5 - 15) / (9 + y * 0.3)) - 0.15 * (y / 21));
  RUNE.forEach((row, y) => [...row].forEach((k, x) => k !== "." && (cv[5 + y]![11 + x] = k)));
  for (const [x, y, k] of [[7, 17, "x"], [7, 16, "h"], [8, 15, "x"], [8, 14, "h"], [9, 13, "x"], [9, 12, "x"], [8, 11, "h"], [8, 10, "x"]] as const) cv[y]![x] = k;
  return { grid: toGrid(cv) };
})();

const base1: Part = { grid: toGrid(cylinder(37, 2.5, 3)) };
const base2: Part = (() => {
  const cv = cylinder(47, 3, 5);
  // Chips and moss along the bottom tier.
  line(cv, 33, 6, 35, 9, "x");
  line(cv, 12, 7, 11, 9, "x");
  for (const [x, y, k] of [[3, 8, "m"], [4, 9, "n"], [5, 9, "m"], [40, 9, "m"], [41, 9, "n"], [42, 8, "m"], [20, 10, "m"], [21, 10, "n"]] as const) if (cv[y]?.[x] && cv[y]![x] !== ".") cv[y]![x] = k;
  return { grid: toGrid(cv) };
})();

/** A boulder fist: knuckles at the bottom, a rune on its back. */
const fist: Part = (() => {
  const cv = canvas(13, 12);
  shade(cv, inPoly([[2, 0], [10, 0], [13, 3], [13, 9], [11, 12], [2, 12], [0, 9], [0, 3]]), STONE, roundLight(6, 4, 8, 9));
  for (const x of [3, 6, 9]) line(cv, x, 8, x, 11, "x");
  cv[3]![5] = "g";
  cv[4]![6] = "g";
  cv[3]![7] = "g";
  return { grid: toGrid(cv) };
})();

const shoulder: Part = (() => {
  const cv = canvas(10, 8);
  shade(cv, inPoly([[2, 0], [8, 0], [10, 3], [9, 8], [1, 8], [0, 3]]), STONE, roundLight(4, 2, 6, 6));
  return { grid: toGrid(cv) };
})();

const pebble: Part = { grid: ["dc", "cb"] };

const shadow: Part = (() => {
  const cv = canvas(56, 5);
  ellipse(cv, 28, 2.5, 28, 2.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

const PARTS = { head, collar, body, base1, base2, fist, shoulder, pebble, shadow };

/** Where the golem's own drawing space (64 x 60, the base's bottom at y 59) sits on the frame. */
const OX = 28;
const OY = 12;

interface Pose {
  /** Head up or down; each fist's and shoulder's place (golem pixels). */
  head?: number;
  fistL: readonly [number, number];
  fistR: readonly [number, number];
  shoulderL?: readonly [number, number];
  shoulderR?: readonly [number, number];
  /** Pebbles drifting around it (golem pixels). */
  pebbles?: readonly (readonly [number, number])[];
}

const L = (part: keyof typeof PARTS, [x, y]: readonly [number, number], extra: Partial<Layer> = {}): Layer => ({ part, x: OX + x, y: OY + y, ...extra });

function pose(p: Pose): Layer[] {
  const h = p.head ?? 0;
  return [
    L("shadow", [4, 57]),
    L("shoulder", p.shoulderR ?? [46, 23], { flipX: true }),
    L("fist", p.fistR, { flipX: true }),
    L("body", [17, 26]),
    L("head", [22, 1 + h]),
    L("collar", [16, 21]),
    L("base1", [14, 44]),
    L("base2", [9, 49]),
    L("shoulder", p.shoulderL ?? [8, 23]),
    L("fist", p.fistL),
    ...(p.pebbles ?? []).map((xy) => L("pebble", xy)),
  ];
}

const TAU = Math.PI * 2;
/** The runes breathe: dim, lit, white-hot, lit. */
const PULSE: Record<string, string>[] = [{}, {}, { h: PALETTE.g }, { h: PALETTE.g, g: PALETTE.G }, { h: PALETTE.g, g: PALETTE.G }, { h: PALETTE.g }, {}, {}];
/** Gold motes in the gap between each shoulder and its floating fist. */
const motes = (i: number, fl: readonly [number, number], fr: readonly [number, number]): Speck[] => {
  const t = (TAU * i) / 8;
  return [
    [OX + fl[0] + 8, OY + 32 + Math.round(Math.sin(t) * 1.5), i % 2 ? "g" : "h"],
    [OX + fl[0] + 5, OY + 31 + Math.round(Math.cos(t) * 1.5), i % 2 ? "h" : "G"],
    [OX + fr[0] + 4, OY + 32 + Math.round(Math.cos(t) * 1.5), i % 2 ? "g" : "h"],
    [OX + fr[0] + 7, OY + 31 + Math.round(Math.sin(t) * 1.5), i % 2 ? "h" : "G"],
  ];
};

const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i): Frame => {
    const t = (TAU * i) / 8;
    const fistL = [1, 34 + Math.round(Math.sin(t) * 2)] as const;
    const fistR = [50, 34 + Math.round(Math.sin(t + 2) * 2)] as const;
    return {
      ms: 150,
      pal: PULSE[i],
      layers: pose({
        head: [0, 0, 0, 1, 1, 1, 0, 0][i],
        fistL,
        fistR,
        shoulderL: [8, 23 + Math.round(Math.sin(t + 0.8))],
        shoulderR: [46, 23 + Math.round(Math.sin(t + 2.8))],
        pebbles: [
          [-4 + Math.round(Math.cos(t) * 3), 50 + Math.round(Math.sin(t) * 2)],
          [64 + Math.round(Math.cos(t + 2) * 3), 46 + Math.round(Math.sin(t + 2) * 2)],
          [58 + Math.round(Math.cos(t + 4) * 2), 14 + Math.round(Math.sin(t + 4) * 2)],
        ],
      }),
      specks: motes(i, fistL, fistR),
    };
  }),
};

const HOT = { h: PALETTE.g, g: PALETTE.G, j: PALETTE.G };
/** Puffs of dust rolling out along the ground from both fists: `t` is 1, 2, 3 as they spread, swell and thin. */
function dust(t: number): Speck[] {
  const out: Speck[] = [];
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 1 : 63;
    [0, 1, 2, 3].forEach((n) => {
      const cx = x0 + side * (4 + n * 4) * (0.7 + t * 0.25);
      const r = Math.max(1.2, 2 + t * 0.7 - n * 0.4);
      const cy = 58 - r;
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const d = ((x - cx) / r) ** 2 + ((y - cy) / r) ** 2;
          if (d > 1 || (t === 3 && (x + y) % 2)) continue;
          out.push([OX + x, OY + y, y < cy ? "W" : "w"]);
        }
    });
  }
  return out;
}
/** The ground cracks white under the fists for one frame. */
const shock = (): Speck[] =>
  [-1, 1].flatMap((side): Speck[] => Array.from({ length: 14 }, (_, i): Speck => [OX + (side < 0 ? 4 : 60) + side * i, OY + 59 + (i % 4 === 3 ? 1 : 0), i < 6 ? "f" : "W"]));
const chips = (t: number): Speck[] =>
  [[-6, -2], [-8, -4], [-3, -6], [6, -5], [8, -3], [3, -7]].flatMap(([vx, vy]): Speck[] => {
    const x = (vx! < 0 ? 4 : 60) + vx! * t;
    const y = 54 + vy! * t + 2 * t * t;
    return [[OX + Math.round(x), OY + Math.round(y), "c"], [OX + Math.round(x) + 1, OY + Math.round(y), "b"]];
  });
/** Vertical speed lines over a falling fist. */
const fall = (x: number, y: number): Speck[] => [3, 9].flatMap((dx): Speck[] => Array.from({ length: 9 }, (_, i): Speck => [OX + x + dx, OY + y - 12 + i, "q"]));

const attack: Anim = {
  loop: false,
  frames: [
    { ms: 120, layers: pose({ fistL: [1, 34], fistR: [50, 34] }) },
    // Wind-up: both fists rise above its head, the runes flare.
    { ms: 130, cue: "windup", pal: PULSE[3], layers: pose({ head: -1, fistL: [3, 18], fistR: [48, 18], shoulderL: [8, 21], shoulderR: [46, 21] }) },
    { ms: 220, pal: HOT, layers: pose({ head: -1, fistL: [10, -6], fistR: [41, -6], shoulderL: [9, 19], shoulderR: [45, 19] }) },
    // Slam: a blur, then both fists hit the ground either side of the base.
    { ms: 60, cue: "slam", pal: HOT, layers: pose({ head: 1, fistL: [-1, 24], fistR: [52, 24], shoulderL: [7, 24], shoulderR: [47, 24] }), specks: [...fall(-1, 24), ...fall(52, 24)] },
    { ms: 110, cue: "impact", pal: HOT, shake: [0, 2], layers: pose({ head: 2, fistL: [-6, 47], fistR: [57, 47], shoulderL: [5, 27], shoulderR: [49, 27] }), specks: [...shock(), ...dust(1), ...chips(1)] },
    { ms: 110, pal: PULSE[3], shake: [0, -1], layers: pose({ head: 1, fistL: [-6, 47], fistR: [57, 47], shoulderL: [5, 26], shoulderR: [49, 26] }), specks: [...dust(2), ...chips(2)] },
    { ms: 140, pal: PULSE[2], layers: pose({ head: 1, fistL: [-5, 44], fistR: [56, 44], shoulderL: [6, 25], shoulderR: [48, 25] }), specks: [...dust(3), ...chips(3)] },
    { ms: 150, layers: pose({ fistL: [-1, 38], fistR: [53, 38], shoulderL: [7, 24], shoulderR: [47, 24] }) },
    { ms: 150, layers: pose({ fistL: [1, 34], fistR: [50, 34] }) },
  ],
};

export const PAWN_GOLEM: Character = {
  id: "pawn-golem",
  name: "The Pawn Golem",
  w: 120,
  h: 78,
  foot: [OX + 32, OY + 59],
  palette: PALETTE,
  halo: "#262a33",
  looks: {
    // Phase 2 idea, to show a recolour is only a palette: the same golem in black stone.
    obsidian: { a: "#121216", b: "#1e1e24", c: "#2c2c34", d: "#3e3e48", e: "#55555f", f: "#7a7a86" },
  },
  parts: PARTS,
  anims: { idle, attack },
};

