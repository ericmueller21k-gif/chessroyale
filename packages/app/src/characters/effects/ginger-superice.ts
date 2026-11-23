// Copied as drawn from `claude/boss-art` (scripts/boss-art/out/ginger-superice/ginger-superice.ts at ae4c2107, Nov 18, 2026; the paid art
// runner, $1.75): only the import paths changed. Notes: scripts/boss-art/out/ginger-superice/summary.md on that branch.
/**
 * Ginger's Super Freeze: the expanding 3 x 3 ice block. Not a boss: a board effect over 3 x 3 squares (96 x 96, one
 * square 32 px). The blast hits the middle square, its ice forms, then the block grows outward square by square (the
 * four beside it, then the four corners) into one thick block of cracked ice; it holds, then breaks apart along the
 * squares' edges and clears. Its ice is today's one-piece ice (effects/ginger.ts) made big: the same palette, the
 * see-through body so the pieces under it read.
 */
import { canvas, line, toGrid, type Canvas } from "../paint.ts";
import { lazyAnim, lazyParts, type Character, type Frame, type Part, type Speck } from "../sprite.ts";

const SQUARE = 32;
const W = 3 * SQUARE;

const PALETTE = {
  k: "#1d4e7a", // outline
  a: "#c4ecff59", // the ice, see-through
  A: "#7fcfff73",
  q: "#dff6ff59", // frost forming
  i: "#d6f6ff", // rims and shine
  I: "#7fd3ff",
  J: "#3a8fd8",
  F: "#ffffff",
  f: "#a8e8ff",
  c: "#2a6fb0", // cracks
  d: "#9fdcff", // meltwater
  p: "#9fdcff80",
  t: "#c4ecff12", // thin ice, barely there
  T: "#7fcfff1c",
  w: "#9fdcff8c",
  // Added for the big block:
  B: "#4a9de466", // a deeper facet, still see-through
  C: "#174a7e", // the deep cracks' cores
} as const;

type Pt = readonly [number, number];
const hash = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 997;

/** Inside a rectangle with per-corner rounding radii [tl, tr, bl, br] (0: square). */
function inBox(x0: number, y0: number, x1: number, y1: number, rr: readonly [number, number, number, number]) {
  return (x: number, y: number) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const corners: [number, number, number][] = [
      [x0 + rr[0], y0 + rr[0], rr[0]],
      [x1 - rr[1], y0 + rr[1], rr[1]],
      [x0 + rr[2], y1 - rr[2], rr[2]],
      [x1 - rr[3], y1 - rr[3], rr[3]],
    ];
    for (let n = 0; n < 4; n++) {
      const [cx, cy, r] = corners[n]!;
      if (!r) continue;
      const inX = n % 2 === 0 ? x < cx : x > cx;
      const inY = n < 2 ? y < cy : y > cy;
      if (inX && inY && (x - cx) ** 2 + (y - cy) ** 2 > r * r + 0.5) return false;
    }
    return true;
  };
}

/** The whole block's inside: x, y 3..92 (its outline at 2 and 93). */
const BIG = inBox(3, 3, 92, 92, [5, 5, 5, 5]);

// ---- Cracks: from the blast in the middle out, along the lines between the squares, to the block's edges.

const TRUNKS: readonly (readonly Pt[])[] = [
  [[48, 48], [44, 45], [41, 41], [36, 37], [33, 33], [30, 30], [28, 24], [30, 18], [27, 12], [29, 6], [28, 3]],
  [[48, 48], [52, 45], [55, 41], [60, 37], [63, 33], [66, 30], [73, 28], [79, 31], [86, 28], [92, 30]],
  [[48, 48], [51, 52], [55, 55], [59, 59], [63, 63], [66, 67], [65, 74], [68, 81], [66, 87], [67, 92]],
  [[48, 48], [45, 52], [41, 56], [37, 59], [33, 63], [30, 66], [23, 65], [16, 68], [9, 66], [3, 67]],
];
const BRANCHES: readonly (readonly Pt[])[] = [
  [[30, 30], [24, 31], [18, 34], [10, 32], [3, 35]],
  [[66, 30], [65, 23], [68, 16], [66, 9], [68, 3]],
  [[66, 67], [72, 65], [79, 68], [86, 65], [92, 67]],
  [[30, 66], [31, 73], [28, 80], [31, 86], [29, 92]],
  // Short ones: the blast's star, and chips off the outer edges.
  [[48, 48], [49, 43], [47, 40]],
  [[48, 48], [53, 49], [56, 51]],
  [[3, 12], [6, 14], [7, 19]],
  [[92, 80], [88, 78], [87, 73]],
  [[40, 92], [42, 88], [40, 85]],
  [[84, 3], [83, 7], [86, 10]],
  [[13, 92], [15, 88], [19, 87]],
  [[92, 47], [88, 46], [86, 43]],
];
const CRACKS: Canvas = (() => {
  const cv = canvas(W, W);
  const draw = (pts: readonly Pt[], k: string) => pts.forEach((p, n) => n > 0 && line(cv, pts[n - 1]![0], pts[n - 1]![1], p[0], p[1], k));
  BRANCHES.forEach((b) => draw(b, "c"));
  TRUNKS.forEach((t) => draw(t, "C"));
  return cv;
})();
/** The cracks and a few facet edges (tone changes only, not drawn): the facets' walls. */
const WALLS: Canvas = (() => {
  const cv = CRACKS.map((r) => [...r]);
  const edges: readonly (readonly [number, number, number, number])[] = [
    [36, 37, 3, 50], [55, 41, 92, 52], [59, 59, 46, 92], [52, 45, 45, 3],
    [79, 31, 92, 10], [16, 68, 22, 92], [73, 28, 58, 3], [10, 32, 3, 8], [79, 68, 92, 88], [41, 56, 3, 80],
  ];
  for (const [x0, y0, x1, y1] of edges) line(cv, x0, y0, x1, y1, "w");
  return cv;
})();

/**
 * Facets: the shards between the cracks, each its own tint (lighter toward the top left). A label per pixel of the
 * whole block, from a flood between the cracks.
 */
const FACET: string[][] = (() => {
  const label: number[][] = Array.from({ length: W }, () => Array<number>(W).fill(-1));
  const regions: { n: number; sx: number; sy: number }[] = [];
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      if (label[y]![x] !== -1 || !BIG(x, y) || WALLS[y]![x] !== ".") continue;
      const id = regions.length;
      const reg = { n: 0, sx: 0, sy: 0 };
      regions.push(reg);
      const stack: Pt[] = [[x, y]];
      label[y]![x] = id;
      while (stack.length) {
        const [px, py] = stack.pop()!;
        reg.n++;
        reg.sx += px;
        reg.sy += py;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const qx = px + dx;
          const qy = py + dy;
          if (qx < 0 || qy < 0 || qx >= W || qy >= W || label[qy]![qx] !== -1 || !BIG(qx, qy) || WALLS[qy]![qx] !== ".") continue;
          label[qy]![qx] = id;
          stack.push([qx, qy]);
        }
      }
    }
  const tone = regions.map((r, id) => {
    const cx = r.sx / Math.max(1, r.n);
    const cy = r.sy / Math.max(1, r.n);
    const light = cx + cy < 90;
    return light ? (id % 2 ? "A" : "a") : id % 2 ? "B" : "A";
  });
  // (The walls between facets that aren't cracks take the tone of the facet to their left or above.)
  return label.map((row, y) => row.map((id, x) => (id >= 0 ? tone[id]! : tone[label[y]![x - 1] ?? -1] ?? tone[label[y - 1]?.[x] ?? -1] ?? "a")));
})();

/** Where a piece stands: the middle of a square (kept thin: no highlights, no frost). */
const inPieceZone = (x: number, y: number) => {
  const dx = Math.abs((x % SQUARE) - 15.5);
  const dy = Math.abs((y % SQUARE) - 15.5);
  return dx <= 10 && dy <= 12;
};

// ---- The ice, growing.

interface IceOpts {
  /** Each square (r * 3 + c): below 0 none, 0..1 its ice spreading across it, 1 or more whole. */
  prog: readonly number[];
  /** The middle square's frost creeping in from its edges (before its ice closes), pixels deep. */
  frost?: number;
  /** How far the cracks have run from the middle (pixels). */
  cracks?: number;
  /** The lines between the squares: "bright" (fusing), "faint" (a fault line), none. */
  seams?: "bright" | "faint";
  /** Broken apart: nine blocks, each in its own square. */
  apart?: boolean;
}

const sqOf = (i: number) => [i % 3, Math.floor(i / 3)] as const;
const isCorner = (i: number) => i !== 4 && i % 2 === 0;

/** A square's ice when whole: to its neighbor's edge if that one has ice too, else 3 px inside its own square. */
function zone(i: number, prog: readonly number[], apart = false) {
  const [c, r] = sqOf(i);
  const on = (dc: number, dr: number) => {
    const cc = c + dc;
    const rr = r + dr;
    return !apart && cc >= 0 && cc < 3 && rr >= 0 && rr < 3 && prog[rr * 3 + cc]! > 0;
  };
  const L = !on(-1, 0);
  const R = !on(1, 0);
  const T = !on(0, -1);
  const B = !on(0, 1);
  const x0 = L ? SQUARE * c + 3 : SQUARE * c;
  const x1 = R ? SQUARE * c + 28 : SQUARE * c + 31;
  const y0 = T ? SQUARE * r + 3 : SQUARE * r;
  const y1 = B ? SQUARE * r + 28 : SQUARE * r + 31;
  const rad = (a: boolean, b: boolean, outer: boolean) => (a && b ? (outer && !apart ? 5 : 3) : 0);
  const box = inBox(x0, y0, x1, y1, [
    rad(L, T, c === 0 && r === 0),
    rad(R, T, c === 2 && r === 0),
    rad(L, B, c === 0 && r === 2),
    rad(R, B, c === 2 && r === 2),
  ]);
  return (x: number, y: number) => box(x, y) && BIG(x, y);
}

/** How far into a square its ice has to spread to reach (x, y), and the most it can be. */
function spread(i: number, x: number, y: number): number {
  const [c, r] = sqOf(i);
  if (isCorner(i)) {
    const ix = c === 0 ? 31 : 64;
    const iy = r === 0 ? 31 : 64;
    const d = Math.abs(x - ix) + Math.abs(y - iy);
    return d + (hash(x - y + 200, 7) % 3 === 0 ? 1.5 : 0);
  }
  // A side square: from the middle square's edge, its front bulging a little in the middle.
  const vertical = c === 1;
  const d = vertical ? (r === 0 ? 31 - y : y - 64) : c === 0 ? 31 - x : x - 64;
  const u = vertical ? x : y;
  return d + 0.008 * (u - 47.5) ** 2 + (hash(u, 3) % 3 === 0 ? 1 : 0);
}
const MAX_SPREAD = (i: number) => (isCorner(i) ? 59 : 33);

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function paintIce(o: IceOpts): Part {
  const prog = o.prog;
  const zones = prog.map((_, i) => zone(i, prog, o.apart));
  const ice: boolean[][] = [];
  const frost: boolean[][] = [];
  for (let y = 0; y < W; y++) {
    ice.push([]);
    frost.push([]);
    for (let x = 0; x < W; x++) {
      let isIce = false;
      let isFrost = false;
      for (let i = 0; i < 9 && !isIce; i++) {
        const p = prog[i]!;
        if (p <= 0 || !zones[i]!(x, y)) continue;
        if (p >= 1) isIce = true;
        else {
          const reach = p * MAX_SPREAD(i);
          const d = spread(i, x, y);
          if (d <= reach) isIce = true;
          else if (d - reach <= 1.5 || (d - reach <= 4 && hash(x, y) % 3 === 0)) isFrost = true;
        }
      }
      if (!isIce && o.frost && prog[4]! <= 0) {
        // The middle square's frost, creeping in from its edges.
        const z = zone(4, prog);
        if (z(x, y)) {
          const d = Math.min(x - 35, y - 35, 60 - x, 60 - y);
          const reach = o.frost + (hash(x, y) % 4 === 0 ? 1 : 0);
          if (d < reach) isFrost = true;
        }
      }
      ice[y]!.push(isIce);
      frost[y]!.push(isFrost);
    }
  }
  const isIce = (x: number, y: number) => ice[y]?.[x] ?? false;
  const isFrost = (x: number, y: number) => frost[y]?.[x] ?? false;
  const cv = canvas(W, W);
  const done = (x: number, y: number) => prog[Math.floor(y / SQUARE) * 3 + Math.floor(x / SQUARE)]! >= 1;

  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      if (isIce(x, y)) {
        const nearFront = N4.some(([dx, dy]) => isFrost(x + dx, y + dy));
        const nearFront2 = N4.some(([dx, dy]) => isFrost(x + 2 * dx, y + 2 * dy));
        const tl = !isIce(x - 1, y) || !isIce(x, y - 1);
        const br = !isIce(x + 1, y) || !isIce(x, y + 1);
        const br2 = !isIce(x + 2, y) || !isIce(x, y + 2);
        const br3 = !isIce(x + 3, y) || !isIce(x, y + 3);
        const tl2 = !isIce(x - 2, y) || !isIce(x, y - 2);
        let k: string;
        if (nearFront) k = "F";
        else if (tl) k = "i";
        else if (br) k = "J";
        else if (nearFront2) k = hash(x, y) % 2 ? "i" : "f";
        else if (br2) k = "I";
        else if (br3) k = "B";
        else if (tl2) k = "q";
        else {
          // Facets: wedges around the blast, lighter toward the top left.
          k = o.cracks ? FACET[y]![x]! : x + y < 92 ? "a" : "A";
        }
        cv[y]![x] = k;
      } else if (isFrost(x, y)) {
        const edge = N4.some(([dx, dy]) => !isFrost(x + dx, y + dy) && !isIce(x + dx, y + dy));
        cv[y]![x] = hash(x, y) % 4 === 0 ? "f" : edge && hash(x, y) % 3 === 0 ? "i" : "q";
      } else if (N4.some(([dx, dy]) => isIce(x + dx, y + dy))) cv[y]![x] = "k";
    }

  const body = (x: number, y: number) => isIce(x, y) && "aAqB".includes(cv[y]![x]!);

  // Fault lines between whole squares: bright as they fuse, faint after.
  if (o.seams && !o.apart)
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const onSeam = x === 32 || x === 63 || y === 32 || y === 63;
        if (!onSeam || !body(x, y) || !done(x, y)) continue;
        if (o.seams === "bright") cv[y]![x] = hash(x, y) % 4 ? "i" : "F";

      }

  // Shine: diagonal streaks across the top left, and one across the middle.
  const streak = (sum: number, xa: number, xb: number, k: string) => {
    for (let x = xa; x <= xb; x++) {
      const y = sum - x;
      if (body(x, y) && done(x, y)) cv[y]![x] = k;
    }
  };
  streak(48, 8, 40, "F");
  streak(47, 12, 22, "i");
  streak(54, 13, 32, "i");
  streak(20, 5, 15, "i");
  streak(112, 50, 62, "i");
  streak(150, 70, 80, "i");

  // Cracks, from the middle out to `cracks` pixels.
  if (o.cracks)
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const k = CRACKS[y]![x]!;
        if (k === "." || !isIce(x, y) || Math.hypot(x - 48, y - 48) > o.cracks) continue;
        if (o.apart && !N4.every(([dx, dy]) => isIce(x + dx, y + dy))) continue;
        cv[y]![x] = k === "C" && inPieceZone(x, y) ? "c" : k;
        // A chipped, lit edge beside the deep cracks.
        if (k === "C" && !inPieceZone(x, y) && body(x + 1, y) && CRACKS[y]![x + 1] === ".") cv[y]![x + 1] = "i";
      }

  // Frost crystals in the block's four corners, opaque.
  const crystal: [number, number, string][] = [];
  [
    "..FFFif..f",
    ".FFFif....",
    "FFFi.F....",
    "FFi.fiF...",
    "Fi.f..f...",
    "if.iF.....",
    "f.fF......",
    "...f.....",
    ".........",
    "f........",
  ].forEach((row, dy) => [...row].forEach((k, dx) => k !== "." && crystal.push([dx, dy, k])));
  for (const i of [0, 2, 6, 8]) {
    if (prog[i]! < 1) continue;
    const [c, r] = sqOf(i);
    for (const [dx, dy, k] of crystal) {
      const x = c === 0 ? 4 + dx : 91 - dx;
      const y = r === 0 ? 4 + dy : 91 - dy;
      if (isIce(x, y)) cv[y]![x] = k;
    }
  }
  return { grid: toGrid(cv), outline: false };
}

/** Crack pixels at a distance from the middle between r0 and r1 (a glint running out along them). */
const crackGlint = (r0: number, r1: number): Speck[] => {
  const out: Speck[] = [];
  for (let y = 4; y < W - 4; y++)
    for (let x = 4; x < W - 4; x++) {
      if (CRACKS[y]![x] === ".") continue;
      const d = Math.hypot(x - 48, y - 48);
      if (d >= r0 && d <= r1) out.push([x, y, d - r0 < 2 ? "i" : "I"]);
    }
  return out;
};

// ---- Specks: the blast, sparkles, glints, chips.

const sparkle = (x: number, y: number, core = "F", ray = "f", big = false): Speck[] => [
  [x, y, core],
  [x - 1, y, ray],
  [x + 1, y, ray],
  [x, y - 1, ray],
  [x, y + 1, ray],
  ...(big ? ([[x - 2, y, ray], [x + 2, y, ray], [x, y - 2, ray], [x, y + 2, ray]] as Speck[]) : []),
];
const DIRS8 = Array.from({ length: 8 }, (_, n) => [Math.cos((n * Math.PI) / 4), Math.sin((n * Math.PI) / 4)] as const);
const DIRS8B = Array.from({ length: 8 }, (_, n) => [Math.cos(((n + 0.5) * Math.PI) / 4), Math.sin(((n + 0.5) * Math.PI) / 4)] as const);

/** The blast on the middle square: a starburst of frost, specks flying out. */
function burst(step: number): Speck[] {
  const out: Speck[] = [];
  const cx = 47;
  const cy = 47;
  const at = (x: number, y: number, k: string) => out.push([Math.round(cx + x), Math.round(cy + y), k]);
  if (step === 0) {
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
      const d = Math.abs(x) + Math.abs(y);
      if (d <= 2) at(x, y, "F");
      else if (d === 3) at(x, y, "i");
    }
    DIRS8.forEach(([vx, vy], n) => {
      const len = n % 2 ? 13 : 19;
      for (let d = 3; d <= len; d++) {
        at(vx * d, vy * d, d < len - 4 ? "F" : d < len - 1 ? "f" : "I");
        // The rays thick near the core.
        if (n % 2 === 0 && d < 8) at(vx * d + vy, vy * d + vx, "i");
      }
    });
    DIRS8B.forEach(([vx, vy], n) => out.push(...sparkle(Math.round(cx + vx * 14), Math.round(cy + vy * 14), "F", n % 2 ? "I" : "f")));
  } else if (step === 1) {
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) at(x!, y!, "F");
    DIRS8.forEach(([vx, vy], n) => {
      const len = n % 2 ? 17 : 24;
      for (let d = 9; d <= len; d++) at(vx * d, vy * d, d < len - 5 ? "i" : d < len - 1 ? "f" : "I");
    });
    DIRS8B.forEach(([vx, vy], n) => out.push(...sparkle(Math.round(cx + vx * 22), Math.round(cy + vy * 22), "F", n % 2 ? "I" : "f", n % 2 === 0)));
  } else if (step === 2) {
    DIRS8.forEach(([vx, vy], n) => [20, 23, 26].forEach((d) => n % 2 === 0 || d < 24 ? at(vx * d, vy * d, d === 20 ? "i" : "f") : 0));
    DIRS8B.forEach(([vx, vy], n) => out.push(...sparkle(Math.round(cx + vx * 29), Math.round(cy + vy * 29 + 1), n % 2 ? "i" : "F", "f")));
  } else if (step === 3) {
    DIRS8B.forEach(([vx, vy], n) => at(vx * 35, vy * 35 + 3, n % 2 ? "f" : "i"));
  }
  return out;
}

/** A glint sweeping across the whole block along the diagonal (`t` 0 to 1). */
const glint = (t: number): Speck[] => {
  const out: Speck[] = [];
  const s = Math.round(14 + t * 160);
  for (let x = 5; x <= 90; x++) {
    const y = s - x;
    if (y < 5 || y > 90 || !BIG(x, y) || !BIG(x + 2, y) || !BIG(x, y + 2) || !BIG(x - 2, y) || !BIG(x, y - 2)) continue;
    out.push([x, y, "F"], [x + 1, y, "i"]);
    if (x % 3 === 0) out.push([x + 2, y, "i"]);
  }
  return out;
};
const cornerTwinkles = (which: readonly number[], big = false): Speck[] =>
  which.flatMap((n) => {
    const [x, y] = ([[16, 12], [83, 14], [13, 82], [81, 85]] as const)[n]!;
    return sparkle(x, y, "F", "i", big);
  });
/** Sparks where the lines between the squares meet (the block breaking), `t` 0 to 1 out. */
const breakSparks = (t: number): Speck[] => {
  const out: Speck[] = [];
  for (const [jx, jy] of [[32, 32], [64, 32], [32, 64], [64, 64]] as const) {
    const vx = jx < 48 ? -1 : 1;
    const vy = jy < 48 ? -1 : 1;
    const d = Math.round(2 + t * 7);
    if (t === 0) out.push(...sparkle(jx - (vx < 0 ? 1 : 0), jy - (vy < 0 ? 1 : 0), "F", "i", true));
    out.push([jx + vx * d, jy + vy * (d - 1), "F"], [jx + vx * (d - 2), jy + vy * (d + 1), "i"], [jx - vx * (d - 3), jy + vy * (d + 2), "f"]);
  }
  return out;
};
/** The lines between the squares, flashing white as they open. */
const seamFlash = (): Speck[] => {
  const out: Speck[] = [];
  for (let t = 5; t <= 90; t++)
    for (const s of [31, 32, 63, 64]) {
      if (BIG(s, t)) out.push([s, t, s % 2 ? "F" : "i"]);
      if (BIG(t, s)) out.push([t, s, s % 2 ? "F" : "i"]);
    }
  return out;
};

// ---- Palettes for a frame.

const withAlpha = (hex: string, m: number) => {
  const a = hex.length === 9 ? parseInt(hex.slice(7), 16) : 255;
  return hex.slice(0, 7) + Math.round(a * m).toString(16).padStart(2, "0");
};
/** Everything see-through by `m` (fading out). */
const fadePal = (m: number): Record<string, string> => Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, withAlpha(v, m)]));
const PALE = { a: "#c4ecff30", A: "#7fcfff40", B: "#3f93dc40", q: "#dff6ff30" } as const;
const FLASH = { a: "#ffffff80", A: "#eafaff8c", B: "#c4ecff8c", q: "#ffffff8c", I: "#ffffff", J: "#d6f6ff", k: "#4f90c8", c: "#9fdcff", C: "#5fa8e0" } as const;
const FLASH2 = { a: "#eafaff66", A: "#c4ecff73", B: "#7fcfff73", I: "#d6f6ff", J: "#7fd3ff", k: "#2a6fb0", C: "#2a6fb0" } as const;

// ---- Frames.

const { parts: PARTS, add } = lazyParts();
const partFor = (name: string, o: IceOpts) => add(name, () => paintIce(o));
const frame = (part: string | null, ms: number, extra: Partial<Frame> = {}): Frame => ({ ms, layers: part ? [{ part, x: 0, y: 0 }] : [], ...extra });

const NONE = [-1, -1, -1, -1, -1, -1, -1, -1, -1];
const MID = [-1, -1, -1, -1, 1, -1, -1, -1, -1];
const sides = (p: number) => [-1, p, -1, p, 1, p, -1, p, -1];
const corners = (p: number) => [p, 1, p, 1, 1, 1, p, 1, p];
const ALL = [1, 1, 1, 1, 1, 1, 1, 1, 1];
const WHOLE: IceOpts = { prog: ALL, cracks: 200, seams: "faint" };

/** Grow's frames' lengths, and which frame each square's ice is first whole on. */
const GROW_MS = [80, 70, 70, 80, 80, 70, 70, 70, 90, 80, 70, 70, 70, 70, 90, 80, 80, 90, 140];
const MID_DONE = 3;
const SIDES_DONE = 8;
const CORNERS_DONE = 14;
const startOf = (f: number) => GROW_MS.slice(0, f).reduce((s, m) => s + m, 0);

/** For each square (r * 3 + c), ms from grow's start when its ice is whole. */
export const SUPER_ICE_STEPS: number[] = Array.from({ length: 9 }, (_, i) => startOf(i === 4 ? MID_DONE : isCorner(i) ? CORNERS_DONE : SIDES_DONE));

const growFrames = (): Frame[] => {
  const ms = GROW_MS;
  return [
    frame(null, ms[0]!, { cue: "burst", shake: [0, 1], specks: burst(0) }),
    frame(partFor("g-frost3", { prog: NONE, frost: 3 }), ms[1]!, { specks: burst(1) }),
    frame(partFor("g-frost7", { prog: NONE, frost: 7 }), ms[2]!, { specks: burst(2) }),
    frame(partFor("g-mid", { prog: MID }), ms[3]!, { pal: PALE, specks: burst(3) }),
    frame("g-mid", ms[4]!, { pal: { i: "#ffffff", I: "#d6f6ff" }, specks: [...sparkle(39, 38, "F", "i", true), ...sparkle(56, 57, "F", "i")] }),
    frame(partFor("g-s1", { prog: sides(0.22) }), ms[5]!),
    frame(partFor("g-s2", { prog: sides(0.48) }), ms[6]!),
    frame(partFor("g-s3", { prog: sides(0.76) }), ms[7]!),
    frame(partFor("g-sdone", { prog: sides(1), seams: "bright", cracks: 8 }), ms[8]!, { cue: "crackle", specks: cornerTwinkles([]).concat(sparkle(47, 15, "F", "i"), sparkle(15, 47, "F", "i"), sparkle(80, 48, "F", "i"), sparkle(48, 80, "F", "i")) }),
    frame(partFor("g-sfused", { prog: sides(1), seams: "faint", cracks: 8 }), ms[9]!),
    frame(partFor("g-c1", { prog: corners(0.2), seams: "faint", cracks: 8 }), ms[10]!),
    frame(partFor("g-c2", { prog: corners(0.42), seams: "faint", cracks: 8 }), ms[11]!),
    frame(partFor("g-c3", { prog: corners(0.64), seams: "faint", cracks: 8 }), ms[12]!),
    frame(partFor("g-c4", { prog: corners(0.85), seams: "faint", cracks: 8 }), ms[13]!),
    frame(partFor("g-cdone", { prog: ALL, seams: "bright", cracks: 18 }), ms[14]!, { cue: "crackle", shake: [0, 1], specks: cornerTwinkles([0, 1, 2, 3]) }),
    frame(partFor("g-crack40", { prog: ALL, seams: "faint", cracks: 42 }), ms[15]!, { specks: crackGlint(30, 42) }),
    frame(partFor("whole", WHOLE), ms[16]!, { pal: FLASH, specks: cornerTwinkles([0, 1, 2, 3], true) }),
    frame("whole", ms[17]!, { pal: FLASH2, specks: cornerTwinkles([0, 3]) }),
    frame("whole", ms[18]!),
  ];
};

export const SUPER_ICE: Character = {
  id: "ginger-superice",
  name: "Ginger's Super Freeze",
  w: W,
  h: W,
  foot: [48, 95],
  palette: PALETTE,
  parts: PARTS,
  anims: {
    /** The blast, the middle square freezing, the block growing out over the 3 x 3, cracking, a flash. */
    grow: lazyAnim(() => ({ loop: false, frames: growFrames() })),
    /** The whole block at rest: a glint sweeping across, the cracks glinting, the corners twinkling. */
    hold: lazyAnim(() => {
      const whole = partFor("whole", WHOLE);
      return {
        loop: true,
        frames: [
          frame(whole, 220),
          frame(whole, 220, { specks: cornerTwinkles([0, 3]) }),
          frame(whole, 200, { specks: crackGlint(8, 26) }),
          frame(whole, 160, { specks: [...crackGlint(30, 52), ...glint(0.2)] }),
          frame(whole, 160, { specks: glint(0.45) }),
          frame(whole, 160, { specks: glint(0.7) }),
          frame(whole, 160, { specks: [...glint(0.95), ...cornerTwinkles([1, 2], true)] }),
          frame(whole, 220),
        ],
      };
    }),
    /** The block breaks along the squares' edges, its nine pieces thin and fade; the last frame is empty. */
    settle: lazyAnim(() => {
      const whole = partFor("whole", WHOLE);
      const apart = partFor("apart", { prog: ALL, cracks: 200, apart: true });
      return {
        loop: false,
        frames: [
          frame(whole, 60, { specks: seamFlash() }),
          frame(apart, 70, { specks: breakSparks(0) }),
          frame(apart, 80, { pal: fadePal(0.75), specks: breakSparks(0.5) }),
          frame(apart, 80, { pal: { ...fadePal(0.5), a: PALETTE.t, A: PALETTE.T, B: "#3f93dc1c", q: PALETTE.t }, specks: breakSparks(1) }),
          frame(apart, 90, { pal: { ...fadePal(0.22), a: PALETTE.t, A: PALETTE.T, B: "#3f93dc12", q: PALETTE.t } }),
          frame(null, 60),
        ],
      };
    }),
    /** For the preview: hold's first frame. */
    idle: lazyAnim(() => ({ loop: true, frames: [frame(partFor("whole", WHOLE), 400)] })),
  },
};
