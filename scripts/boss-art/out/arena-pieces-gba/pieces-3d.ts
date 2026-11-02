/**
 * The Colosseum's chess pieces as 3D models, GBA style (Eric, Nov 2: the rook and the horse "as the 3d model based on the 2d
 * image", then the gold rook top, mane and bishop slit, then "finish the pieces"). Pure code, no Node or DOM: the game can
 * import it as it is.
 *
 * - **Units and axes:** one unit one sprite pixel (a board square near White is about 20 units across, as drawn); y up, the
 *   foot (the middle of the square the piece stands on) at the origin, **+z the piece's front** (toward the viewer), +x its
 *   right as you face it. The knight's head looks toward -x (to the viewer's left); mirror x for the other way.
 * - **A model** is `inside(x, y, z)`: the material at that point (body, gold, groove, eye) or null outside. Heights, foot to
 *   top: pawn 19, rook 19, knight 22, bishop 23, queen 25, king 30.
 * - **`drawPiece(kind, side, pitch)`** draws one piece as seen from above at `pitch` radians (0 level, 0.52 the stands behind
 *   White as mocked up) facing its front, one pixel a unit: palette keys (`PALETTE`), null empty, the foot's pixel (ax, ay).
 *   Flat cel bands lit from the top left and front, a 1-pixel outline round it and where a nearer part covers a farther one.
 *   Every seat: draw each piece once per seat's pitch (a few ms each) and use the result as a sprite, turned to face the
 *   screen as the arena's pieces are today; or march the same `inside` in a shader.
 */
import { PIECES, PALETTE, FOOT_X, FOOT_Y } from "./arena-pieces-gba.ts";

export { PALETTE };
/** The picture `drawPiece` makes: its size and the foot's pixel. */
export const FRAME = { w: 32, h: 40, ax: 16, ay: 33 } as const;
export type Kind = "p" | "n" | "b" | "r" | "q" | "k";

export type Mat = "body" | "gold" | "groove" | "eye";
export type Side = "w" | "b";
export const TONES: Record<Side, Record<Mat, string[]>> = {
  // highlight, light, mid, shade
  w: { body: ["W", "w", "c", "C"], gold: ["Y", "G", "G", "g"], groove: ["C", "C", "k", "k"], eye: ["k", "k", "k", "k"] },
  b: { body: ["B", "b", "d", "d"], gold: ["Y", "G", "G", "g"], groove: ["d", "K", "K", "K"], eye: ["Y", "Y", "G", "G"] },
};
export const OUTLINE: Record<Side, string> = { w: "k", b: "K" };
const GOLD = new Set(["T", "U", "V", "R", "S", "Q", "M", "N"]);

/** A row of the sprite (frame row f) as a turned ring: its radius (the inside, outline left off) and material. */
function ringOf(grid: string[][], f: number): { r: number; mat: Mat } | null {
  const row = grid[f];
  if (!row) return null;
  const cells = row.filter((k) => k !== ".");
  if (!cells.length) return null;
  const inner = cells.filter((k) => k !== "O");
  const gold = inner.filter((k) => GOLD.has(k)).length;
  const mat: Mat = !inner.length ? "groove" : gold * 2 > inner.length ? "gold" : "body";
  return { r: inner.length ? inner.length / 2 : cells.length / 2 - 1, mat };
}

export interface Model { inside(x: number, y: number, z: number): Mat | null }

/** World: y up, the foot at the origin, +z toward the viewer; frame row f spans y in [FOOT_Y - f, FOOT_Y - f + 1). */
const rowAt = (y: number) => FOOT_Y - Math.floor(y);

function turned(grid: string[][], from: number, to: number) {
  return (x: number, y: number, z: number): Mat | null => {
    const f = rowAt(y);
    if (f < from || f > to) return null;
    const ring = ringOf(grid, f);
    if (!ring) return null;
    return Math.hypot(x, z) <= ring.r ? ring.mat : null;
  };
}

function rookModel(): Model {
  const g = PIECES.r!;
  const body = turned(g, 18, 33);
  const R = ringOf(g, 18)!.r; // the crown's radius
  const WALL = 2;
  return {
    inside(x, y, z) {
      const f = rowAt(y);
      if (f >= 15 && f <= 17) {
        // Three rows of battlements: a ring wall, four merlons (one facing you), the roof sunk inside.
        const r = Math.hypot(x, z);
        if (r > R || r < R - WALL) return null;
        const a = Math.atan2(x, z); // 0 = toward you
        const sector = (((a / (Math.PI / 2)) % 1) + 1.5) % 1; // 0.5 at a merlon's middle
        // (Their flat tops gold, with the roof: the rook's top reads gold from the stands.)
        return Math.abs(sector - 0.5) < 0.3 ? (f === 15 ? "gold" : "body") : null;
      }
      // The roof inside the ring, sunk in its shadow.
      // The flat roof inside the ring: gold (Eric, Nov 2: "the rook flat area on the top should be gold").
      if (f === 18 && Math.hypot(x, z) < R - WALL) return "gold";
      return body(x, y, z);
    },
  };
}

function knightModel(): Model {
  const g = PIECES.n!;
  const base = turned(g, 25, 33);
  // The head's cells (frame rows 12..24) and each cell's distance (in cells) to the outside, for the slab's rounding.
  const H0 = 12, H1 = 24;
  const cell = (c: number, f: number) => (f >= H0 && f <= H1 ? (g[f]?.[c] ?? ".") : ".");
  const dist: number[][] = [];
  for (let f = H0; f <= H1; f++) {
    dist[f] = [];
    for (let c = 0; c < g[0]!.length; c++) {
      let d = 0;
      if (cell(c, f) !== ".")
        for (d = 1; d < 6; d++) {
          let edge = false;
          for (let dy = -d; dy <= d && !edge; dy++) for (let dx = -d; dx <= d && !edge; dx++) if (Math.hypot(dx, dy) <= d && cell(c + dx, f + dy) === ".") edge = true;
          if (edge) break;
        }
      dist[f]![c] = d;
    }
  }
  return {
    inside(x, y, z) {
      const f = rowAt(y);
      if (f > H1) return base(x, y, z);
      if (f < H0) return null;
      const c = Math.floor(x + FOOT_X + 0.5);
      const k = cell(c, f);
      if (k === ".") return null;
      const d = dist[f]![c]!;
      // The mane (Eric, Nov 2: gold) a flat-sided ridge down the back of the neck, so its side is one clean gold stripe.
      const half = k === "M" || k === "N" ? 2.4 : Math.min(2.8, 0.6 + 0.85 * d);
      if (Math.abs(z) > half) return null;
      if (k === "E") return Math.abs(z) > half - 0.8 ? "eye" : "body";
      return GOLD.has(k) ? "gold" : "body";
    },
  };
}

/**
 * The bishop (Eric, Nov 2: its mitre's "strip thing on top gold like in our reference"), turned like the rook: the shared
 * base, a stem narrowing up to a gold collar, the mitre (an egg narrowing to a point), a small ball on top, and the slit
 * across the mitre's front a gold strip, falling from the upper left to the lower right.
 */
function bishopModel(): Model {
  const base = turned(PIECES.r!, 25, 33);
  const radius = (y: number): [number, Mat] | null => {
    if (y < 9) return null;
    if (y < 12.6) return [3.5 - ((y - 9) / 3.6) * 1.2, "body"];
    if (y < 13.8) return [3.6, "gold"];
    if (y < 14.6) return [2.6, "body"];
    if (y < 16.2) return [2.6 + ((y - 14.6) / 1.6) * 0.9, "body"];
    if (y < 21.4) return [3.5 * Math.sqrt(Math.max(0, 1 - ((y - 16.2) / 5.2) ** 2)), "body"];
    return null;
  };
  return {
    inside(x, y, z) {
      if (y < 9) return base(x, y, z);
      if (Math.hypot(x, y - 22, z) <= 1.25) return "body";
      const pr = radius(y);
      if (!pr || Math.hypot(x, z) > pr[0]) return null;
      if (y > 15.4 && y < 21 && z > -0.5 && Math.abs(y - 18.4 + 0.75 * x) < 0.7) return "gold";
      return pr[1];
    },
  };
}

export interface Shot { w: number; h: number; ax: number; ay: number; keys: (string | null)[][] }

/** Draws a model from the stands: one ray a pixel, flat tones, then the outline. `ax, ay`: the foot's pixel. */
export function drawModel(m: Model, side: Side, pitch: number): Shot {
  const d = [0, -Math.sin(pitch), -Math.cos(pitch)];
  const up = [0, Math.cos(pitch), -Math.sin(pitch)];
  const L = (() => { const v = [-0.55, 0.7, 0.45]; const n = Math.hypot(...v); return v.map((a) => a / n); })();
  const W = FRAME.w, H = FRAME.h, ax = FRAME.ax, ay = FRAME.ay; // the foot (world origin) lands on pixel (ax, ay)
  const depth: number[][] = Array.from({ length: H }, () => Array<number>(W).fill(Infinity));
  const keys: (string | null)[][] = Array.from({ length: H }, () => Array<string | null>(W).fill(null));
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const u = px + 0.5 - ax, v = ay - (py + 0.5);
      const o = [u - d[0]! * 40, up[1]! * v - d[1]! * 40, up[2]! * v - d[2]! * 40];
      // Only inside the pieces' box (|x|, |z| <= 7, 0 <= y < 32), in coarse steps, the hit then found to a fine step.
      let t0 = 0, t1 = 80;
      for (const [a, lo, hi] of [[0, -7, 7], [1, 0, 32], [2, -7, 7]] as const) {
        if (Math.abs(d[a]!) < 1e-9) { if (o[a]! < lo || o[a]! > hi) t1 = -1; continue; }
        const ta = (lo - o[a]!) / d[a]!, tb = (hi - o[a]!) / d[a]!;
        t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
      }
      const at = (t: number) => [o[0]! + d[0]! * t, o[1]! + d[1]! * t, o[2]! + d[2]! * t] as const;
      for (let t = t0; t < t1; t += 0.12) {
        let q = at(t);
        if (!m.inside(q[0], q[1], q[2])) continue;
        let a = Math.max(t0, t - 0.12), b = t;
        for (let i = 0; i < 4; i++) { const c = (a + b) / 2; const r = at(c); if (m.inside(r[0], r[1], r[2])) b = c; else a = c; }
        t = b; q = at(t);
        const p = q;
        const mat = m.inside(p[0], p[1], p[2])!;
        // The surface's facing: the middle of the empty space round the hit, looking out.
        let nx = 0, ny = 0, nz = 0;
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) {
          const s = 0.45;
          if (Math.hypot(i, j, k) > 2.2 || (i === 0 && j === 0 && k === 0)) continue;
          if (!m.inside(p[0]! + i * s, p[1]! + j * s, p[2]! + k * s) && p[1]! + j * s >= 0) { nx += i; ny += j; nz += k; }
        }
        const n = Math.hypot(nx, ny, nz) || 1;
        const lit = (nx * L[0]! + ny * L[1]! + nz * L[2]!) / n;
        const tone = lit > 0.72 ? 0 : lit > 0.38 ? 1 : lit > 0.05 ? 2 : 3;
        keys[py]![px] = TONES[side][mat][tone]!;
        depth[py]![px] = t;
        break;
      }
    }
  // The outline: round the shape, and on the farther side of a jump in depth (a nearer part over a farther one).
  const out = keys.map((r) => r.slice());
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx!, y + dy!] as const).filter(([X, Y]) => X >= 0 && Y >= 0 && X < W && Y < H);
      if (!keys[y]![x]) { if (nb.some(([X, Y]) => keys[Y]![X])) out[y]![x] = OUTLINE[side]; continue; }
      if (nb.some(([X, Y]) => keys[Y]![X] && depth[Y]![X]! < depth[y]![x]! - 2.2)) out[y]![x] = OUTLINE[side];
    }
  return { w: W, h: H, ax, ay, keys: out };
}

/** A turned piece above the shared base: `profile(y)` gives the radius and material at height y (null: nothing there). */
function turnedAbove(profile: (y: number) => [number, Mat] | null, extra?: (x: number, y: number, z: number) => Mat | null | undefined): Model {
  const base = turned(PIECES.r!, 25, 33);
  return {
    inside(x, y, z) {
      if (y < 9) return base(x, y, z);
      const e = extra?.(x, y, z);
      if (e !== undefined) return e;
      const pr = profile(y);
      return pr && Math.hypot(x, z) <= pr[0] ? pr[1] : null;
    },
  };
}

/**
 * The pawn (Eric, Nov 2: "yours look like a pyramid, mine have the normal slender taller look", his reference's pawns): its
 * own low, flat base (a step, a gold band, a sloped top), a slim waisted stem, a gold collar, a short neck and the round
 * head (19 tall).
 */
function pawnModel(): Model {
  const profile = (y: number): [number, Mat] | null => {
    if (y < 1.2) return [4.4, "body"];
    if (y < 2) return [4.3, "gold"];
    if (y < 3.3) return [3.9 - ((y - 2) / 1.3) * 0.7, "body"];
    if (y < 3.8) return [2.6, "groove"];
    if (y < 11.5) { const s = (y - 3.8) / 7.7; return [1.5 + 0.7 * (1 - s) ** 2, "body"]; }
    if (y < 12.4) return [3, "gold"];
    if (y < 13.4) return [1.5, "body"];
    return null;
  };
  return {
    inside(x, y, z) {
      if (y < 0) return null;
      if (y >= 12.4 && Math.hypot(x, y - 16, z) <= 3.05) return "body";
      const pr = profile(y);
      return pr && Math.hypot(x, z) <= pr[0] ? pr[1] : null;
    },
  };
}

/** The queen: a waisted stem, a gold collar, a cup flaring out to an open coronet of seven gold points, a gold ball (25 tall). */
function queenModel(): Model {
  const RIM = 4.1;
  return turnedAbove(
    (y) => {
      if (y < 15.5) return [3.4 - ((y - 9) / 6.5) * 1.3, "body"];
      if (y < 16.6) return [3.4, "gold"];
      if (y < 17.2) return [2.3, "body"];
      if (y < 21.4) return [2.3 + ((y - 17.2) / 4.2) * (RIM - 2.3), "body"];
      if (y < 22.2) return [RIM, "gold"];
      return null;
    },
    (x, y, z) => {
      if (Math.hypot(x, y - 24, z) <= 1.15) return "gold";
      const r = Math.hypot(x, z);
      // The low dome inside the coronet.
      if (y >= 22.2 && y < 23 && r <= 2.2) return "body";
      if (y < 22.2 || y >= 24.6) return undefined;
      // The coronet's points: a ring wall, each point a triangle (seven round, one facing you).
      if (r > RIM || r < RIM - 1.3) return null;
      const sector = (((Math.atan2(x, z) / ((2 * Math.PI) / 7)) % 1) + 1.5) % 1;
      return (y - 22.2) / 2.4 < 1 - Math.abs(sector - 0.5) * 2 ? "gold" : null;
    },
  );
}

/** The king: a tall stem, a gold collar, a body flaring to a gold crown band, a domed cap and the gold cross (30 tall). */
function kingModel(): Model {
  return turnedAbove(
    (y) => {
      if (y < 16.5) return [3.6 - ((y - 9) / 7.5) * 1.3, "body"];
      if (y < 17.6) return [3.5, "gold"];
      if (y < 18.1) return [2.4, "body"];
      if (y < 22) return [2.4 + ((y - 18.1) / 3.9) * 1.8, "body"];
      if (y < 23.2) return [4.3, "gold"];
      if (y < 24.6) return [3.4 * Math.sqrt(Math.max(0, 1 - ((y - 23.2) / 1.6) ** 2)), "body"];
      return null;
    },
    (x, y, z) => {
      // The cross: a thick gold bar up from the cap and its arms, readable from the stands.
      if (y < 24 || Math.abs(z) > 1) return undefined;
      const up = Math.abs(x) <= 1 && y < 30.6;
      const arms = Math.abs(x) <= 2.7 && y >= 27.3 && y < 28.9;
      return up || arms ? "gold" : undefined;
    },
  );
}

export const MODELS: Record<Kind, Model> = {
  p: pawnModel(), n: knightModel(), b: bishopModel(), r: rookModel(), q: queenModel(), k: kingModel(),
};

/** One piece seen from above at `pitch` radians, facing its front: see the file's note. */
export function drawPiece(kind: Kind, side: Side, pitch: number): Shot {
  return drawModel(MODELS[kind], side, pitch);
}
