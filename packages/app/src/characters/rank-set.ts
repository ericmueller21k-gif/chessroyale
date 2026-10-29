/**
 * Ranked emblems, the whole ladder in one drawing (id "rank-set"): every tier's emblem as an animation of one
 * character, so the set is drawn once, by one rig, and reads as one family.
 *
 * Every emblem is the same build: a chess piece standing in front of a faceted octagon badge (a bezel of eight
 * facets, lit from the top left, round a gem-cut table of eight triangular facets). The parts use generic palette
 * keys (the bezel's metal "0".."5", the table "p".."t", the piece "a".."f", the glow "z","Z") and each tier's frames
 * swap them for its own colors, so one badge, one set of studs, wings and crest serve every tier.
 *
 * Divisions, the same steps in every tier: d5 the badge and the piece; d4 adds four studs on the cut corners; d3 adds
 * a pair of wings (carved leaves for Wood); d2 adds a small crest at the top; d1 trades it for a big crown set with a gem
 * in the piece's color, with a wide glow round the badge and a glint on the piece (Eric, Oct 28: "option C").
 * Pearlescent and Transcendent are d1 and more, each a 2 s loop: the emblem still, its light moving.
 */
import { canvas, edge, inPoly, poly, toGrid } from "./paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "./sprite.ts";

type Pt = readonly [number, number];

// ---- Colors.

const GOLD = { "0": "#fff3a6", "1": "#f6c93a", "2": "#dc9a1c", "3": "#a8680e", "4": "#6a3a08", "5": "#4a2604" };

/** One tier's colors for the generic keys. */
interface Colors {
  k: string;
  metal: readonly string[]; // "0".."5", light to dark
  field: readonly string[]; // "p".."t", light to dark
  piece: readonly string[]; // "a".."f", light to dark
  glow: readonly [string, string];
  /** The studs: light, mid, dark (default: the piece's own colors). */
  stud?: readonly [string, string, string];
  extra?: Readonly<Record<string, string>>;
}

const pal = (c: Colors): Record<string, string> => {
  const [u, v, x] = c.stud ?? [c.piece[0]!, c.piece[2]!, c.piece[4]!];
  const out: Record<string, string> = { k: c.k, z: c.glow[0], Z: c.glow[1], u, v, x };
  c.metal.forEach((v, i) => (out[String(i)] = v));
  c.field.forEach((v, i) => (out["pqrst"[i]!] = v));
  c.piece.forEach((v, i) => (out["abcdef"[i]!] = v));
  return { ...out, ...c.extra };
};

const WOOD: Colors = {
  k: "#24120a",
  metal: ["#dcaa66", "#c28a47", "#a8733a", "#8d5d2e", "#724624", "#5a3519"],
  field: ["#6a3d1d", "#5b3419", "#4a2a14", "#3a200f", "#2e180b"],
  piece: ["#fbd584", "#efae4c", "#d88c35", "#b4692a", "#8a4a20", "#5e2f16"],
  glow: ["#ffd666e6", "#ffbc44a0"],
  stud: ["#fff1c2", "#efae4c", "#8a4a20"],
};
const SILVER: Colors = {
  k: "#121826",
  metal: ["#ffffff", "#dfe6ee", "#b9c3cf", "#8d99a8", "#5f6b7c", "#3e4757"],
  field: ["#4c5d78", "#3d4b64", "#303c52", "#242e41", "#1a2232"],
  piece: ["#ffffff", "#e6ecf2", "#c4cdd8", "#98a5b5", "#6c7a8e", "#4a5568"],
  glow: ["#e8f2ffd8", "#b8cff090"],
  stud: ["#ffffff", "#7c8a9e", "#343d4e"],
};
const GOLDT: Colors = {
  k: "#2a1404",
  metal: Object.values(GOLD),
  field: ["#6e3a12", "#5a2e0c", "#472308", "#361905", "#261103"],
  piece: ["#fff6c0", "#ffd94a", "#f0b020", "#c88410", "#94580a", "#5e3406"],
  glow: ["#ffe27ae6", "#ffc84098"],
  stud: ["#fff6c0", "#a8680e", "#4a2604"],
};
const PARAGON: Colors = {
  k: "#0a1c12",
  metal: Object.values(GOLD),
  field: ["#2f7a52", "#24643f", "#1a4f31", "#123b24", "#0b2a19"],
  piece: ["#dcffe6", "#94eaae", "#56c682", "#30995c", "#1d6e42", "#11472b"],
  glow: ["#a8ffc8d8", "#60e09890"],
};
const ILLUSTRIOUS: Colors = {
  k: "#08102a",
  metal: ["#ffffff", "#eef3fa", "#cdd8e8", "#a0afc6", "#6e7f9c", "#4a5878"],
  field: ["#2049ac", "#183b8e", "#122d72", "#0c2157", "#07163e"],
  piece: ["#d4e4ff", "#86aeff", "#4479f2", "#2655cc", "#173b98", "#0d2566"],
  glow: ["#a8c8ffe0", "#6a98ff90"],
};
const SUBLIME: Colors = {
  k: "#1a0a2e",
  metal: Object.values(GOLD),
  field: ["#582cab", "#472292", "#371a78", "#291058", "#1b0b38"],
  piece: ["#f4e8ff", "#d3b0ff", "#ad78f0", "#8447d4", "#5a26a3", "#35146b"],
  glow: ["#ead2ffc8", "#c096ff70"],
};
const RADIANT: Colors = {
  k: "#2a0606",
  metal: ["#fff6b8", "#ffd23c", "#f2a218", "#c06a0c", "#7a3606", "#521f04"],
  field: ["#8a1424", "#701020", "#580c1a", "#420814", "#2c040c"],
  piece: ["#ffe0d0", "#ff7e68", "#f0303c", "#c01428", "#880c1e", "#560612"],
  glow: ["#ffd060e8", "#ff8a30a0"],
  extra: { o: "#ffb43a", O: "#e2661c" },
};

// ---- The badge: 34 x 34, a bezel of eight facets round a gem-cut table.

const BW = 34;
const CUT = 10;
const BX = 7; // the badge's top-left on the 48 x 48 frame
const BY = 8;
const CX = BX + BW / 2; // 24
const CY = BY + BW / 2; // 25

/** The octagon inset by `inset` from a box of `size`, its corner cuts kept at 45 degrees. */
function oct(inset: number, size = BW, cut = CUT): Pt[] {
  const a = cut + inset * Math.SQRT2 - inset;
  const lo = inset;
  const hi = size - inset;
  return [[a, lo], [size - a, lo], [hi, a], [hi, size - a], [size - a, hi], [a, hi], [lo, size - a], [lo, a]];
}

const rnd = (a: number, b: number, c = 0): number => {
  let h = Math.imul(a + 101, 73856093) ^ Math.imul(b + 57, 19349663) ^ Math.imul(c + 13, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000;
};

const shift = (ramp: string, k: string, d: number): string => {
  const i = ramp.indexOf(k);
  return i < 0 ? k : ramp[Math.max(0, Math.min(ramp.length - 1, i + d))]!;
};

/** Top, top right, right, bottom right, bottom, bottom left, left, top left. */
const BEZEL = ["1", "2", "3", "4", "3", "2", "1", "0"];
const TABLE = ["q", "r", "s", "t", "s", "r", "q", "p"];

interface BadgeOpts {
  bezel?: readonly string[];
  field?: readonly string[];
  grain?: boolean;
  sun?: boolean;
}

function makeBadge(o: BadgeOpts = {}): Part {
  const bezel = o.bezel ?? BEZEL;
  const field = o.field ?? TABLE;
  const cv = canvas(BW, BW);
  const O = oct(0);
  const T = oct(4);
  const I = oct(5);
  const facets = O.map((a, i): Pt[] => [a, O[(i + 1) % 8]!, T[(i + 1) % 8]!, T[i]!]);
  facets.forEach((f, i) => poly(cv, f, bezel[i]!));
  if (o.grain) {
    // Wood grain along each side of the frame: streaks parallel to its edge, in short broken runs.
    for (let i = 0; i < 8; i++) {
      const A = O[i]!;
      const B = O[(i + 1) % 8]!;
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const ex = (B[0] - A[0]) / len;
      const ey = (B[1] - A[1]) / len;
      const inside = inPoly(facets[i]!);
      for (let y = 0; y < BW; y++)
        for (let x = 0; x < BW; x++) {
          if (!inside(x, y)) continue;
          const X = x + 0.5 - A[0];
          const Y = y + 0.5 - A[1];
          const d = X * -ey + Y * ex;
          const s = X * ex + Y * ey;
          const band = Math.floor(d);
          const seg = Math.floor((s + i * 3.7) / 3.2);
          const k = cv[y]![x]!;
          if ((band === 1 && rnd(seg, 1, i) < 0.6) || (band === 3 && rnd(seg, 3, i) < 0.4)) cv[y]![x] = shift("012345", k, 1);
          else if (band === 2 && rnd(seg, 2, i) < 0.22) cv[y]![x] = shift("012345", k, -1);
        }
    }
  }
  // A bright rim along the outer top and left edges.
  edge(cv, 0, -1, bezel[0]!, "0");
  edge(cv, -1, 0, bezel[6]!, "0");
  edge(cv, 0, -1, bezel[7]!, "0");
  poly(cv, T, "4");
  const c: Pt = [BW / 2, BW / 2];
  for (let i = 0; i < 8; i++) poly(cv, [c, I[i]!, I[(i + 1) % 8]!], field[i]!);
  const table = inPoly(I);
  if (o.grain) {
    for (let y = 0; y < BW; y++)
      for (let x = 0; x < BW; x++) {
        if (!table(x, y)) continue;
        const seg = Math.floor((x + y * 3) / 5);
        if (y % 3 === 0 && rnd(seg, y, 5) < 0.5) cv[y]![x] = shift("pqrst", cv[y]![x]!, 1);
        else if (y % 4 === 1 && rnd(seg, y, 6) < 0.3) cv[y]![x] = shift("pqrst", cv[y]![x]!, -1);
      }
  }
  if (o.sun) {
    // A sunburst on the table, from behind the queen's head.
    const sx = 17;
    const sy = 12;
    for (let y = 0; y < BW; y++)
      for (let x = 0; x < BW; x++) {
        if (!table(x, y)) continue;
        const dx = x + 0.5 - sx;
        const dy = y + 0.5 - sy;
        const a = Math.atan2(dy, dx) / (2 * Math.PI) + 1;
        const f = (a * 12 + 0.5) % 1;
        const r = Math.hypot(dx, dy);
        if (f < 0.34 && r > 6) cv[y]![x] = r < 12 ? "o" : "O";
      }
  }
  return { grid: toGrid(cv) };
}

/** The glow round the badge: see-through, no outline, `w` pixels beyond the badge's outline. */
function makeGlow(w = 2): Part {
  const size = BW + 2 + 2 * w;
  const cv = canvas(size, size);
  const out = 1 + w;
  const cut = CUT + 2 * out - out * Math.SQRT2;
  poly(cv, oct(0, size, cut), "Z");
  for (let i = 1; i < w; i++) poly(cv, oct(i, size, cut), w > 2 && i < w - 1 ? "Z" : "z");
  if (w <= 2) poly(cv, oct(1, size, cut), "z");
  return { grid: toGrid(cv), outline: false };
}

/** Radiant's sunburst behind the badge: sixteen gold rays, long at the faces, short at the corners. */
function makeRays(): Part {
  const cv = canvas(48, 48);
  for (let n = 0; n < 16; n++) {
    const ang = ((-90 + n * 22.5) * Math.PI) / 180;
    const face = n % 2 === 0;
    const diag = n % 4 === 2;
    const R = diag ? 25 : face ? 20.6 : 21.2;
    const hw = diag ? 3.4 : face ? 3 : 2.2;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const vx = -uy;
    const vy = ux;
    const r0 = 12;
    const pts: Pt[] = [
      [CX + ux * r0 + vx * hw, CY + uy * r0 + vy * hw],
      [CX + ux * R, CY + uy * R],
      [CX + ux * r0 - vx * hw, CY + uy * r0 - vy * hw],
    ];
    // Each ray cut in two along its spine: the half toward the light paler.
    const tip = pts[1]!;
    const a: Pt = [CX + ux * r0, CY + uy * r0];
    const sideLit = -vx * 0.6 - vy * 0.8 > 0;
    const lit = -ux * 0.6 - uy * 0.8;
    const hi = lit > 0.35 ? "0" : lit > -0.35 ? "1" : "2";
    const lo = lit > 0.35 ? "2" : lit > -0.35 ? "2" : "3";
    poly(cv, [pts[0]!, tip, a], sideLit ? hi : lo);
    poly(cv, [a, tip, pts[2]!], sideLit ? lo : hi);
  }
  return { grid: toGrid(cv) };
}

// ---- The pieces: masks ("X" the piece's material, "M" its metal, "D" material in shadow, "k" a cut), then shaded.

type Row = readonly [number, "X" | "M"] | string;
const PW = 20;
const sym = (rows: readonly Row[]): string[] =>
  rows.map((r) => (typeof r === "string" ? r : ".".repeat((PW - r[0]) / 2) + r[1].repeat(r[0]) + ".".repeat((PW - r[0]) / 2)));
const rep = (n: number, r: Row): Row[] => Array.from({ length: n }, () => r);

interface Ball {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

function shadePiece(mask: readonly string[], balls: readonly Ball[] = [], grain = false): Part {
  const H = mask.length;
  const cv = canvas(PW, H);
  const at = (x: number, y: number) => mask[y]?.[x] ?? ".";
  const on = (x: number, y: number) => at(x, y) !== ".";
  const kind = (c: string) => (c === "M" ? "M" : c === "." ? "." : "X");
  for (let y = 0; y < H; y++)
    for (let x = 0; x < PW; x++) {
      const c = at(x, y);
      if (c === ".") continue;
      if (c === "k") {
        cv[y]![x] = "k";
        continue;
      }
      let a = x;
      while (on(a - 1, y)) a--;
      let b = x;
      while (on(b + 1, y)) b++;
      const u = (x - a + 0.5) / (b - a + 1);
      let lv = u < 0.15 ? 3.6 : u < 0.42 ? 4.4 : u < 0.64 ? 3 : u < 0.84 ? 2 : 1;
      const ball = balls.find((B) => ((x + 0.5 - B.cx) / B.rx) ** 2 + ((y + 0.5 - B.cy) / B.ry) ** 2 <= 1.15);
      if (ball) lv = 6 * (0.5 - 0.42 * ((x + 0.5 - ball.cx) / ball.rx) - 0.5 * ((y + 0.5 - ball.cy) / ball.ry)) - 0.4;
      if (!on(x, y - 1)) lv += 1;
      else if (kind(at(x, y - 1)) !== kind(c)) lv += 0.6;
      if (!on(x, y + 1)) lv -= 1;
      else if (kind(at(x, y + 1)) !== kind(c)) lv -= 0.6;
      if (c === "D") lv = Math.min(lv, 1.4);
      if (grain && [4, 7, 9, 12, 15].includes(x) && rnd(x, Math.floor((y + x * 3) / 6), 9) < 0.6) lv -= 1;
      const level = Math.max(0, Math.min(5, Math.round(lv)));
      cv[y]![x] = (c === "M" ? "543210" : "fedcba")[level]!;
    }
  return { grid: toGrid(cv) };
}

const PAWN = sym([
  [6, "X"], [10, "X"], ...rep(6, [12, "X"]), [10, "X"], [8, "X"],
  [14, "X"], [16, "X"], [14, "X"],
  ...rep(3, [8, "X"]), [10, "X"], [10, "X"], [12, "X"], [14, "X"],
  [16, "X"], [16, "X"],
  [16, "X"], [18, "X"], [18, "X"], [16, "X"],
]);
const PAWN_BALL: Ball[] = [{ cx: 10, cy: 5, rx: 6, ry: 5.2 }];

const KNIGHT = [
  "...........XX.XX....",
  "..........XXXXXX....",
  ".........XXXXXXXX...",
  "........XXXXXXXXXD..",
  "......XXXXkXXXXXXD..",
  "....XXXXXXXXXXXXXXD.",
  "...XXXXXXXXXXXXXXD..",
  "..XXXXXXXXXXXXXXXXD.",
  ".XXXXXXXXXXXXXXXXXD.",
  "XkXXXXXXXXXXXXXXXD..",
  "XXXXXXXXXXXXXXXXXXD.",
  ".XXXXXXk.XXXXXXXXXXD",
  "..XXXX....XXXXXXXXD.",
  "..........XXXXXXXXXD",
  ".........XXXXXXXXXD.",
  "........XXXXXXXXXXD.",
  ".......XXXXXXXXXXXD.",
  "......XXXXXXXXXXXD..",
  ".....XXXXXXXXXXXXD..",
  "....XXXXXXXXXXXXXX..",
  "...XXXXXXXXXXXXXXX..",
  ...sym([[16, "M"], [16, "X"], [18, "X"], [18, "X"], [16, "X"]]),
];

const BISHOP = (() => {
  const m = sym([
    [2, "M"], [4, "M"], [4, "M"], [2, "M"],
    [6, "X"], [8, "X"], [10, "X"], [12, "X"], [12, "X"], [12, "X"], [12, "X"], [12, "X"], [10, "X"], [8, "X"],
    [14, "M"], [16, "M"], [14, "M"],
    [8, "X"], [8, "X"], [10, "X"], [12, "X"],
    [16, "M"], [16, "X"], [18, "X"], [18, "X"], [16, "X"],
  ]).map((r) => [...r]);
  for (const [x, y] of [[13, 6], [12, 7], [11, 8], [10, 9]] as const) m[y]![x] = "k";
  return m.map((r) => r.join(""));
})();
const BISHOP_BALLS: Ball[] = [{ cx: 10, cy: 2, rx: 2.2, ry: 2.2 }, { cx: 10, cy: 9, rx: 6, ry: 5.6 }];

const ROOK = (() => {
  const m = sym([
    "..XXXX..XXXX..XXXX..", "..XXXX..XXXX..XXXX..",
    [16, "X"], [16, "X"], [16, "X"], [14, "M"],
    ...rep(12, [12, "X"]),
    [14, "X"], [14, "X"],
    [16, "M"], [16, "X"], [18, "X"], [18, "X"], [16, "X"],
  ]).map((r) => [...r]);
  return m.map((r) => r.join(""));
})();

const QUEEN_RUNS: readonly (readonly [number, number][])[] = [
  [[9, 10]], [[8, 11]], [[8, 11]],
  [[5, 5], [9, 10], [14, 14]],
  [[4, 6], [8, 11], [13, 15]],
  [[1, 1], [4, 6], [8, 11], [13, 15], [18, 18]],
  [[0, 2], [4, 6], [8, 11], [13, 15], [17, 19]],
  [[0, 2], [4, 6], [8, 11], [13, 15], [17, 19]],
  [[1, 3], [5, 14], [16, 18]],
  [[2, 17]], [[4, 15]], [[6, 13]], [[7, 12]], [[7, 12]],
  [[6, 13]], [[6, 13]],
  [[7, 12]], [[6, 13]], [[6, 13]], [[5, 14]], [[5, 14]], [[4, 15]],
];
const QUEEN = (() => {
  const gold = (x: number, y: number): boolean => {
    if (y <= 3) return true;
    if (y === 4) return x <= 6 || x >= 13;
    if (y === 5 || y === 6) return x <= 2 || x >= 17;
    return y === 9 || y === 14 || y === 15;
  };
  const rows = QUEEN_RUNS.map((runs, y) => {
    let s = "";
    for (let x = 0; x < PW; x++) s += runs.some(([a, b]) => x >= a && x <= b) ? (gold(x, y) ? "M" : "X") : ".";
    return s;
  });
  return [...rows, ...sym([[16, "M"], [16, "X"], [18, "X"], [18, "X"], [16, "X"]])];
})();
const QUEEN_BALLS: Ball[] = [{ cx: 10, cy: 1.5, rx: 2.2, ry: 2 }];

const KING = sym([
  [2, "M"], [6, "M"], [6, "M"], [2, "M"], [2, "M"],
  [10, "X"], [14, "X"], [14, "X"], [12, "X"], [12, "X"],
  [12, "M"], [8, "X"],
  [14, "M"], [16, "M"],
  [8, "X"], [8, "X"], [10, "X"], [10, "X"], [12, "X"], [12, "X"], [14, "X"], [14, "X"],
  [16, "M"], [16, "X"], [18, "X"], [18, "X"], [16, "X"],
]);

// ---- Studs, crest, wings, leaves.

const STUD: Part = { grid: [".uvv.", "uuvvx", "vvvvx", "vvvxx", ".xxx."] };
const STUDS: readonly Pt[] = [
  [BX + 3, BY + 3],
  [BX + BW - 7, BY + 3],
  [BX + 3, BY + BW - 7],
  [BX + BW - 7, BY + BW - 7],
];

/** Division 1's crown: three points, a band, and a gem in the tier's piece color. */
const CROWN: Part = (() => {
  const cv = canvas(18, 11);
  poly(cv, [[1, 10], [1, 3], [5, 6.5], [9, 0.5], [13, 6.5], [17, 3], [17, 10]], "1");
  poly(cv, [[1, 10], [1, 8], [17, 8], [17, 10]], "3");
  poly(cv, [[9.5, 0.5], [13, 6.5], [17, 3], [17, 8], [9.5, 8]], "2");
  poly(cv, [[9, 4], [11, 6], [9, 8], [7, 6]], "b");
  poly(cv, [[9, 4], [9, 6], [7, 6]], "a");
  return { grid: toGrid(cv) };
})();

const CREST: Part = {
  grid: [
    ".....01.....",
    "01...12...01",
    "12..1ab2..12",
    "11221abc2233",
    "12222bcd2233",
    ".1222222223.",
    "..33333333..",
  ],
};

function feather(bx: number, by: number, tx: number, ty: number, hw: number, mirror: boolean, keys: string): { part: Part; x: number; y: number } {
  const mx = (x: number) => (mirror ? 48 - x : x);
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const at = (t: number, s: number): Pt => [mx(bx + dx * t + nx * s), by + dy * t + ny * s];
  const pts: Pt[] = [at(0, hw * 0.6), at(0.55, hw), at(0.85, hw * 0.8), at(1, hw * 0.3), at(1, -hw * 0.3), at(0.85, -hw * 0.8), at(0.55, -hw), at(0, -hw * 0.6)];
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0])));
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1])));
  const x1 = Math.ceil(Math.max(...pts.map((p) => p[0])));
  const y1 = Math.ceil(Math.max(...pts.map((p) => p[1])));
  const cv = canvas(x1 - x0, y1 - y0);
  const [base, dark, light] = [keys[0]!, keys[1]!, keys[2]!];
  poly(cv, pts.map(([x, y]) => [x - x0, y - y0] as Pt), base);
  edge(cv, 0, 1, base, dark);
  edge(cv, 1, 0, base, dark);
  edge(cv, 0, -1, base, light);
  edge(cv, -1, 0, base, light);
  return { part: { grid: toGrid(cv) }, x: x0, y: y0 };
}

const FEATHERS: readonly (readonly [number, number, number, number, number])[] = [
  [10, 29, 3.5, 32.5, 2.4],
  [10, 28, 3.5, 27, 2.6],
  [10, 27, 3.5, 21, 2.6],
  [10, 26, 5.5, 11.5, 2.8],
];

const PARTS: Record<string, Part> = {};
function wings(name: string, keys: string): Layer[] {
  const out: Layer[] = [];
  FEATHERS.forEach((f, i) => {
    for (const mirror of [false, true]) {
      const fe = feather(f[0], f[1], f[2], f[3], f[4], mirror, keys);
      const id = `${name}${mirror ? "R" : "L"}${i}`;
      PARTS[id] = fe.part;
      out.push({ part: id, x: fe.x, y: fe.y });
    }
  });
  return out;
}
/** Wings in the badge's metal; the same fan in the piece's own material (Wood's carved leaves, starlight, pearl). */
const WINGS_METAL = wings("wing", "231");
const WINGS_PIECE = wings("swing", "cdb");

Object.assign(PARTS, {
  badge: makeBadge(),
  badgeWood: makeBadge({ grain: true }),
  badgeSun: makeBadge({ sun: true }),
  badgeFacets: makeBadge({ bezel: [..."ABCDEFGH"], field: [..."IJKLMNOP"] }),
  glow: makeGlow(2),
  glowWide: makeGlow(3),
  rays: makeRays(),
  stud: STUD,
  crest: CREST,
  crown: CROWN,
  pawn: shadePiece(PAWN, PAWN_BALL),
  pawnWood: shadePiece(PAWN, PAWN_BALL, true),
  knight: shadePiece(KNIGHT, [{ cx: 9, cy: 6.5, rx: 10, ry: 7 }]),
  bishop: shadePiece(BISHOP, BISHOP_BALLS),
  rook: shadePiece(ROOK),
  queen: shadePiece(QUEEN, QUEEN_BALLS),
  king: shadePiece(KING),
});

const pieceAt = (piece: string): Layer => ({ part: piece, x: CX - PW / 2, y: 39 - PARTS[piece]!.grid.length });

// ---- Glints and stars.

function glint(cx: number, cy: number, size = 2): Speck[] {
  const out: Speck[] = [[cx, cy, "w"], [cx - 1, cy, "w"], [cx + 1, cy, "w"], [cx, cy - 1, "w"], [cx, cy + 1, "w"]];
  if (size >= 2) out.push([cx - 2, cy, "h"], [cx + 2, cy, "h"], [cx, cy - 2, "h"], [cx, cy + 2, "h"]);
  if (size >= 3) out.push([cx - 3, cy, "h"], [cx + 3, cy, "h"], [cx, cy - 3, "h"], [cx, cy + 3, "h"]);
  return out;
}

function star(x: number, y: number, state: number, key: string, arm: string): Speck[] {
  if (state <= 0) return [];
  const out: Speck[] = [[x, y, key]];
  if (state >= 2) out.push([x - 1, y, arm], [x + 1, y, arm], [x, y - 1, arm], [x, y + 1, arm]);
  if (state >= 3) out.push([x - 2, y, arm], [x + 2, y, arm], [x, y - 2, arm], [x, y + 2, arm]);
  return out;
}

// ---- The seven tiers with divisions.

interface Tier {
  id: string;
  colors: Colors;
  piece: string;
  badge: string;
  glint: Pt;
  leaves?: boolean;
  rays?: boolean;
}

const TIERS: readonly Tier[] = [
  // Wood's "wings" are a fan of carved honey-wood leaves (the same fan in the piece's own material).
  { id: "wood", colors: WOOD, piece: "pawnWood", badge: "badgeWood", glint: [20, 15], leaves: true },
  { id: "silver", colors: SILVER, piece: "pawn", badge: "badge", glint: [20, 15] },
  { id: "gold", colors: GOLDT, piece: "knight", badge: "badge", glint: [21, 17] },
  { id: "paragon", colors: PARAGON, piece: "bishop", badge: "badge", glint: [20, 18] },
  { id: "illustrious", colors: ILLUSTRIOUS, piece: "rook", badge: "badge", glint: [16, 17] },
  { id: "sublime", colors: SUBLIME, piece: "queen", badge: "badge", glint: [19, 23] },
  { id: "radiant", colors: RADIANT, piece: "queen", badge: "badgeSun", glint: [19, 23], rays: true },
];

function emblem(t: Tier, d: number): Frame {
  const layers: Layer[] = [];
  if (d <= 1) layers.push({ part: "glowWide", x: BX - 4, y: BY - 4 });
  if (t.rays) layers.push({ part: "rays", x: 0, y: 0 });
  if (d <= 3) layers.push(...(t.leaves ? WINGS_PIECE : WINGS_METAL));
  layers.push({ part: t.badge, x: BX, y: BY });
  if (d <= 4) for (const [x, y] of STUDS) layers.push({ part: "stud", x, y });
  if (d === 2) layers.push({ part: "crest", x: CX - 6, y: 2 });
  if (d <= 1) layers.push({ part: "crown", x: CX - 9, y: 0 });
  layers.push(pieceAt(t.piece));
  return { layers, ms: 1000, pal: pal(t.colors), specks: d <= 1 ? glint(t.glint[0], t.glint[1], 3) : undefined };
}

// ---- Color mixing for the two loops.

const parse = (c: string): number[] => {
  const s = c.replace("#", "");
  const out = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  if (s.length === 8) out.push(parseInt(s.slice(6, 8), 16));
  return out;
};
const mix = (a: string, b: string, t: number): string => {
  const A = parse(a);
  const B = parse(b);
  return "#" + A.map((v, j) => Math.round(v + ((B[j] ?? v) - v) * t).toString(16).padStart(2, "0")).join("");
};

const N = 8; // frames in each loop, 250 ms each

// ---- Pearlescent: a king of pearl; the 3-star Auto chess piece's prismatic sheen (AcStarArt's PRISM, Eric: the same
// colors) runs round the facets and over the king, there and back as the 3-star's gradient reflects.

const SHEEN: readonly (readonly [number, string])[] = [
  [0, "#22bfa9"], [0.16, "#1fb6cf"], [0.3, "#2fa3e6"], [0.44, "#5b84f0"], [0.56, "#8d68e6"],
  [0.67, "#d25ccb"], [0.78, "#ff6f73"], [0.88, "#ff9a5c"], [1, "#ff6f73"],
];
const sheen = (t: number): string => {
  const f = ((t % 1) + 1) % 1;
  const u = f < 0.5 ? 2 * f : 2 - 2 * f;
  const k = SHEEN.findIndex(([at]) => at >= u);
  if (k <= 0) return SHEEN[0]![1];
  const [a, ca] = SHEEN[k - 1]!;
  const [b, cb] = SHEEN[k]!;
  return mix(ca, cb, (u - a) / (b - a));
};
const PEARL_BEZEL = ["#f2edf6", "#d8d1e4", "#bdb6d2", "#9f99bc", "#b8b1cf", "#d3cce1", "#ebe5f1", "#ffffff"];
const PEARL_TABLE = ["#4a4274", "#3e3666", "#332c58", "#29234a", "#322b56", "#3c3464", "#484072", "#564e82"];

const PEARL: Colors = {
  k: "#2c2440",
  metal: ["#fffbe8", "#fbe9b4", "#e8cc8a", "#c4a064", "#8e6e40", "#5e4828"],
  field: ["#8e86b6", "#7c74a6", "#6c6496", "#5c5486", "#4c4676"],
  piece: ["#ffffff", "#f8f2f6", "#e6dcec", "#c8bed8", "#a29ac0", "#756e98"],
  glow: ["#fff0fae6", "#d8d0ffa0"],
  stud: ["#ffffff", "#f4bcd8", "#a87098"],
};

function pearlFrame(i: number): Frame {
  const p = pal(PEARL);
  for (let j = 0; j < 8; j++) {
    p["ABCDEFGH"[j]!] = mix(PEARL_BEZEL[j]!, sheen((j - i) / 8), 0.8);
    p["IJKLMNOP"[j]!] = mix(PEARL_TABLE[j]!, mix(sheen((j - i) / 8 + 0.5), "#2e2850", 0.3), 0.4);
  }
  p.b = mix("#f8f2f6", sheen(-i / 8), 0.3);
  p.c = mix("#e6dcec", sheen(-i / 8 + 0.33), 0.38);
  p.d = mix("#c8bed8", sheen(-i / 8 + 0.66), 0.3);
  // The studs catch the sheen too, all one color a frame.
  const st = sheen(-i / 8 + 0.25);
  [p.u, p.v, p.x] = [mix(st, "#ffffff", 0.55), st, mix(st, "#1a1430", 0.45)];

  const glowT = 0.5 + 0.5 * Math.sin((2 * Math.PI * i) / N);
  p.z = mix(sheen(-i / 8) + "ff", "#ffffffff", 0.45).slice(0, 7) + Math.round(170 + 60 * glowT).toString(16);
  p.Z = mix(sheen(-i / 8 + 0.5), "#ffffff", 0.3) + Math.round(80 + 50 * glowT).toString(16);
  const layers: Layer[] = [
    { part: "glowWide", x: BX - 4, y: BY - 4 },
    ...WINGS_PIECE,
    { part: "badgeFacets", x: BX, y: BY },
    ...STUDS.map(([x, y]): Layer => ({ part: "stud", x, y })),
    { part: "crest", x: CX - 6, y: 2 },
    pieceAt("king"),
  ];
  // A glint that swells and fades on the king, and sparkles that come and go round the badge.
  const g = [0, 1, 2, 3, 2, 1, 0, 0][i]!;
  const specks: Speck[] = [...star(21, 18, g, "w", "h")];
  const SPARKS: readonly (readonly [number, number, number])[] = [[5, 9, 0], [42, 9, 4], [4, 40, 6], [43, 40, 2]];
  for (const [x, y, ph] of SPARKS) specks.push(...star(x, y, [0, 1, 2, 1, 0, 0, 0, 0][(i + ph) % 8]!, "w", "h"));
  return { layers, ms: 250, pal: p, specks };
}

// ---- Transcendent: a king of starlight with a halo, the badge of the cosmos.

const TRANS: Colors = {
  k: "#0a051c",
  metal: ["#ffffff", "#fff6c4", "#ffdf72", "#eab53e", "#b0802a", "#7a5418"],
  field: ["#36228a", "#271766", "#1d1052", "#150b3e", "#0f0829"],
  piece: ["#ffffff", "#e9e2ff", "#bcaaf3", "#8a76d6", "#5e4aa8", "#3d2d80"],
  glow: ["#a77cff90", "#9468ff48"],
  stud: ["#fff6c4", "#ffdf72", "#b0802a"],
  extra: { i: "#2a1a70", j: "#5a3cc4" },
};
const TRANS_BEZEL = ["#8e68f0", "#6a45cf", "#4d2fa6", "#33207a", "#412893", "#5c3bbb", "#8059e4", "#b9a1ff"];
const TRANS_TABLE = ["#271766", "#1d1052", "#150b3e", "#0f0829", "#150b3e", "#1d1052", "#271766", "#33208a"];

const HX = CX;
const HY = 19;
function haloRing(step: number): Part {
  const S = 22;
  const cv = canvas(S, S);
  const hl = ((-135 + step * 45) * Math.PI) / 180;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - S / 2;
      const dy = y + 0.5 - S / 2;
      const r = Math.hypot(dx, dy);
      if (r > 10.4 || r < 7.5) continue;
      const l = 0.5 - 0.42 * (dx / 10) - 0.5 * (dy / 10);
      let tone = l > 0.62 ? 3 : l > 0.3 ? 2 : 1;
      if (r < 8.8) tone += 1;
      let da = Math.abs(Math.atan2(dy, dx) - hl);
      if (da > Math.PI) da = 2 * Math.PI - da;
      if (da < 0.5) tone += 1;
      else if (da < 0.95 && tone < 3) tone += 1;
      cv[y]![x] = "3210w"[Math.min(4, tone)]!;
    }
  return { grid: toGrid(cv), outline: false };
}
for (let i = 0; i < N; i++) PARTS[`ring${i}`] = haloRing(i);

/** The soft light round the halo, on the table only. */
PARTS.haloGlow = (() => {
  const S = 28;
  const cv = canvas(S, S);
  const inTable = inPoly(oct(5).map(([x, y]) => [x + BX - (HX - S / 2), y + BY - (HY - S / 2)] as const));
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!inTable(x, y)) continue;
      const r = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2);
      if (r < 7.4) cv[y]![x] = "i";
      else if (r >= 10 && r < 11.6) cv[y]![x] = "j";
      else if (r >= 11.6 && r < 13.2) cv[y]![x] = "i";
    }
  return { grid: toGrid(cv), outline: false };
})();

const TRANS_STARS: readonly (readonly [number, number, number, boolean])[] = [
  [5, 7, 0, true], [42, 6, 3, true], [4, 43, 5, true], [43, 42, 1, true],
  [2, 25, 2, false], [45, 22, 6, false], [14, 3, 4, false], [34, 3, 7, false],
  [13, 20, 1, false], [35, 26, 4, false], [14, 33, 6, false], [34, 34, 2, false], [18, 13, 5, false], [31, 14, 0, false],
];
const TWINKLE = [0, 1, 2, 3, 2, 1, 0, 0];

function transFrame(i: number): Frame {
  const pulse = 0.5 + 0.5 * Math.sin((2 * Math.PI * i) / N - Math.PI / 2);
  const p = pal(TRANS);
  for (let j = 0; j < 8; j++) {
    const d = (i - j + 8) % 8;
    const level = d === 0 ? 0.6 : d === 1 ? 0.28 : 0;
    p["ABCDEFGH"[j]!] = mix(TRANS_BEZEL[j]!, "#f4eeff", level);
    p["IJKLMNOP"[j]!] = TRANS_TABLE[j]!;
  }
  p.z = mix("#a77cff60", "#c8a4ffd0", pulse);
  p.Z = mix("#9468ff28", "#a47aff68", pulse);
  p.j = mix("#4a30b0", "#8462ee", pulse);
  p["2"] = mix("#ffd85a", "#ffeb9a", pulse);
  const layers: Layer[] = [
    { part: "glowWide", x: BX - 4, y: BY - 4 },
    ...WINGS_PIECE,
    { part: "badgeFacets", x: BX, y: BY },
    ...STUDS.map(([x, y]): Layer => ({ part: "stud", x, y })),
    { part: "crest", x: CX - 6, y: 2 },
    { part: "haloGlow", x: HX - 14, y: HY - 14 },
    { part: `ring${i}`, x: HX - 11, y: HY - 11 },
    pieceAt("king"),
  ];
  const specks: Speck[] = [];
  for (const [x, y, ph, big] of TRANS_STARS) {
    const st = TWINKLE[(i + ph) % 8]!;
    specks.push(...star(x, y, big ? st : Math.min(st, 2), big ? "1" : "w", big ? "2" : "c"));
  }
  // the king's own stars, and the glint on his cross
  specks.push([21, 29, "1"], [26, 31, "2"], [22, 33, "1"], [27, 35, "2"]);
  const g = TWINKLE[(i + 2) % 8]!;
  specks.push(...star(24, 13, g === 3 ? 3 : g, "w", "1"));
  return { layers, ms: 250, pal: p, specks };
}


// ---- The character.

/** Everything sits one pixel lower than it's drawn above (the crest's outline clears the top edge). */
const drop = (f: Frame): Frame => ({
  ...f,
  layers: f.layers.map((l) => ({ ...l, y: l.y + 1 })),
  specks: f.specks?.map(([x, y, k]): Speck => [x, y + 1, k]),
});
const anims: Record<string, Anim> = {};
for (const t of TIERS) for (const d of [5, 4, 3, 2, 1]) anims[`${t.id}-d${d}`] = { loop: false, frames: [emblem(t, d)] };
anims.pearlescent = { loop: true, frames: Array.from({ length: N }, (_, i) => pearlFrame(i)) };
anims.transcendent = { loop: true, frames: Array.from({ length: N }, (_, i) => transFrame(i)) };

for (const [name, a] of Object.entries(anims)) anims[name] = { ...a, frames: a.frames.map(drop) };

const BASE: Record<string, string> = { ...pal(GOLDT), w: "#ffffff", h: "#fff8e0", o: "#ffb43a", O: "#e2661c", i: "#2a1a70", j: "#5a3cc4" };
for (let j = 0; j < 8; j++) {
  BASE["ABCDEFGH"[j]!] = PEARL_BEZEL[j]!;
  BASE["IJKLMNOP"[j]!] = PEARL_TABLE[j]!;
}

export const RANK_SET: Character = {
  id: "rank-set",
  name: "Ranked emblems",
  w: 48,
  h: 48,
  foot: [24, 44],
  palette: BASE,
  halo: "#ffffff22",
  parts: PARTS,
  anims,
};


