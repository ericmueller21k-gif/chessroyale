/**
 * The crumple (Folio's intro, beat 5; Eric's idea): a sketch of the maths, small and pure (no DOM), for the code round to
 * port. The screen as it is is taken as a still and laid on a grid mesh; over black the mesh crumples into a ball in the
 * middle (creases, foreshortened faces, light and shade; where the sheet turns over, its back shows: cream-grey paper with
 * faint ink showing through), holds a beat, and opens back up, and the unfolded sheet is the match screen.
 *
 * - **The mesh:** `cols` x `rows` cells over the screen (W x H px), two triangles a cell. 16 x 34 on a phone (cells about
 *   24 px) is enough: the ball is small and the creases are the triangles' own facets.
 * - **Where a point goes:** flat, it is at (x, y, 0) round the screen's middle. Crumpled, the sheet is wrapped round a ball
 *   of radius `R`: a point's distance from the middle sets how far round the ball it goes (the middle stays at the front,
 *   the corners reach round to the back), its direction from the middle sets which way. A ridged noise (the sum of a few
 *   |sin| waves across the sheet, each its own direction) pushes it in or out from the ball, so the ball has creases. In
 *   between (`p` from 0 to 1, eased) the point moves from flat to crumpled, the edges a little ahead of the middle, and the
 *   creases come up early (a wrinkle in z that peaks halfway), so the sheet buckles before it balls.
 * - **Shading:** each triangle's normal against a light from the top left and in front: Lambert, scaled so the flat sheet
 *   is exactly 1 (it looks unchanged until it moves). A triangle turned away from us (its normal's z below 0) is the
 *   paper's back: cream-grey (#e3dccd) at that shade, the screen showing through at 13% (mirrored, as the screen's own
 *   triangle drawn turned over is).
 * - **Drawing:** project each point (a mild perspective, focal length `F`), sort the triangles far to near, and draw each
 *   one as the screen's image mapped on it (an affine map from its three corners), then its shade over it (black at
 *   1 - shade, or a warm white over 1). The mockup does it on a 2D canvas (intro-folio-view.ts, `crumple`), each triangle
 *   grown 1.2 px so its neighbours leave no seam, and a flat frame drawn as the plain image. In the game a WebGL quad mesh
 *   (or a canvas with the same overlap) has no seams at all.
 * - **The open:** the same, `p` running back from 1 to 0, the image now the match screen (cross-faded while it's a ball).
 *   The creases' shade lingers a little after the sheet is flat and fades out (`creaseLinger`), so it reads as paper
 *   smoothed out, not a cut.
 *
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/house-intro-folio/crumple.ts at e7e08bcf, Nov 5), its imports moved; the maths the WebGL crumple (crumple-gl.ts) runs, as drawn (only `creaseField`'s per-seed constants worked out once: the same field), and the game's own helpers after it. The
 * notes: scripts/boss-art/out/shop-folio-nov5.md and intro-folio-nov5.md on that branch.
 */

export interface CrumpleOpts {
  cols: number;
  rows: number;
  /** The ball's radius, a fraction of the screen's shorter side. */
  ball: number;
  /** How deep the creases are, a fraction of the ball's radius. */
  creases: number;
  /** The halfway wrinkle's depth, px. */
  wrinkle: number;
  /** The perspective's focal length, px. */
  F: number;
  seed: number;
  /** The ball's turn (radians, about the up axis) during the hold. */
  turn: number;
}
export const CRUMPLE_DEFAULTS: CrumpleOpts = { cols: 16, rows: 34, ball: 0.17, creases: 0.28, wrinkle: 56, F: 900, seed: 3, turn: 0 };
/** The beats (ms), a starting point tuned for a phone: crumple, hold, open (and how long the creases' shade lingers after). */
export const CRUMPLE_TIMING = { crumple: 800, hold: 400, open: 800, creaseLinger: 260 } as const;

export type V3 = [number, number, number];
export interface Tri {
  /** Screen points (px) and the image's points (px, in the still) of its three corners. */
  s: [number, number][];
  uv: [number, number][];
  /** Its shade (1 = as flat) and whether we see its back. */
  shade: number;
  back: boolean;
  /** Its depth (larger is nearer), for sorting. */
  z: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** A seeded random in [0, 1). */
const rnd = (i: number, seed: number) => {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Each seed's seven waves (their direction's cos and sin times their scale, and their phase), worked out once (the game's, Nov 5). */
const WAVES = new Map<number, Float64Array>();
function wavesOf(seed: number): Float64Array {
  let w = WAVES.get(seed);
  if (w) return w;
  w = new Float64Array(21);
  for (let i = 0; i < 7; i++) {
    const a = rnd(i, seed) * Math.PI;
    const k = 1 / (38 + rnd(i + 10, seed) * 70);
    w[i * 3] = Math.cos(a) * k;
    w[i * 3 + 1] = Math.sin(a) * k;
    w[i * 3 + 2] = rnd(i + 20, seed) * 6.28;
  }
  WAVES.set(seed, w);
  return w;
}
/** The ridged crease field at a point of the flat sheet (px): about -0.5 to 0.5. (Its waves' constants cached: the same numbers.) */
export function creaseField(x: number, y: number, seed: number): number {
  const w = wavesOf(seed);
  let s = 0;
  for (let i = 0; i < 21; i += 3) s += Math.abs(Math.sin(x * w[i]! + y * w[i + 1]! + w[i + 2]!));
  return s / 7 - 0.64;
}

/** Where a point of the sheet (px, round the screen's middle) is at crumple `p` (0 flat, 1 a ball). */
export function crumplePoint(x: number, y: number, p: number, W: number, H: number, o: CrumpleOpts = CRUMPLE_DEFAULTS): V3 {
  const rmax = Math.hypot(W / 2, H / 2);
  const r = Math.hypot(x, y);
  const R = o.ball * Math.min(W, H);
  // The edges lead, the middle follows.
  const pv = smooth(clamp01(p * 1.35 - 0.35 * (1 - r / rmax)));
  const phi = Math.PI * Math.pow(r / rmax, 0.85);
  const th = Math.atan2(y, x);
  const n = creaseField(x, y, o.seed);
  const Rr = R * (1 + o.creases * n * 2);
  let bx = Rr * Math.sin(phi) * Math.cos(th);
  const by = Rr * Math.sin(phi) * Math.sin(th);
  let bz = Rr * Math.cos(phi);
  if (o.turn) {
    const c = Math.cos(o.turn);
    const s = Math.sin(o.turn);
    [bx, bz] = [bx * c + bz * s, -bx * s + bz * c];
  }
  // The halfway wrinkle (buckling before it balls), from a second field: mostly in depth, some sideways, so the sheet's
  // outline breaks up as it goes (a sheet being crushed, not a pillow shrinking).
  const mid = Math.sin(Math.PI * pv);
  const wz = o.wrinkle * mid * creaseField(y * 1.3 + 50, x * 1.3 - 20, o.seed + 7) * 2;
  const jx = o.wrinkle * 0.6 * mid * creaseField(x * 0.9 + 13, y * 0.9, o.seed + 3) * 2;
  const jy = o.wrinkle * 0.6 * mid * creaseField(y * 0.9 - 31, x * 0.9 + 7, o.seed + 5) * 2;
  return [x + (bx - x) * pv + jx, y + (by - y) * pv + jy, bz * pv + wz];
}

/** The light (top left, in front; y is down the screen, z toward us). */
const L: V3 = (() => {
  const v: V3 = [-0.45, -0.55, 0.7];
  const m = Math.hypot(...v);
  return [v[0] / m, v[1] / m, v[2] / m];
})();
/** Lambert, scaled so a flat sheet facing us is 1; never darker than 0.22, never over 1.12. */
export function shadeOf(a: V3, b: V3, c: V3): { shade: number; back: boolean } {
  const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const m = Math.hypot(...n) || 1;
  n = [n[0] / m, n[1] / m, n[2] / m];
  const back = n[2] < 0;
  if (back) n = [-n[0], -n[1], -n[2]];
  const lam = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
  const flat = 0.42 + 0.68 * L[2];
  return { shade: Math.max(0.22, Math.min(1.12, (0.42 + 0.68 * lam) / flat)), back };
}

/**
 * The mesh at crumple `p`: its triangles, projected, shaded and sorted far to near, for a screen W x H. `shadeP` shades it
 * as if at another `p` (the creases lingering on the flat sheet: shadeP a little over 0 while p is 0).
 */
export function crumpleMesh(p: number, W: number, H: number, o: CrumpleOpts = CRUMPLE_DEFAULTS, shadeP = p): Tri[] {
  const grid = (q: number) => {
    const g: V3[][] = [];
    for (let j = 0; j <= o.rows; j++) {
      g.push([]);
      for (let i = 0; i <= o.cols; i++) g[j]!.push(crumplePoint((i / o.cols - 0.5) * W, (j / o.rows - 0.5) * H, q, W, H, o));
    }
    return g;
  };
  const pts = grid(p);
  const sp = shadeP === p ? pts : grid(shadeP);
  const proj = (q: V3): [number, number] => {
    const k = o.F / (o.F - q[2]);
    return [W / 2 + q[0] * k, H / 2 + q[1] * k];
  };
  const uv = (i: number, j: number): [number, number] => [(i / o.cols) * W, (j / o.rows) * H];
  const tris: Tri[] = [];
  for (let j = 0; j < o.rows; j++)
    for (let i = 0; i < o.cols; i++) {
      const P = (di: number, dj: number) => pts[j + dj]![i + di]!;
      const S = (di: number, dj: number) => sp[j + dj]![i + di]!;
      // Alternate the cut (so the facets don't all lean one way).
      const cut = (i + j) % 2 === 0;
      const tri = (c: readonly (readonly [number, number])[]) => {
        const [a, b, d] = c.map(([di, dj]) => P(di, dj)) as [V3, V3, V3];
        const { shade, back } = shadeOf(...(c.map(([di, dj]) => S(di, dj)) as [V3, V3, V3]));
        tris.push({ s: [proj(a), proj(b), proj(d)], uv: c.map(([di, dj]) => uv(i + di, j + dj)), shade, back, z: (a[2] + b[2] + d[2]) / 3 });
      };
      if (cut) {
        tri([[0, 0], [1, 0], [1, 1]]);
        tri([[0, 0], [1, 1], [0, 1]]);
      } else {
        tri([[0, 0], [1, 0], [0, 1]]);
        tri([[1, 0], [1, 1], [0, 1]]);
      }
    }
  return tris.sort((a, b) => a.z - b.z);
}

/**
 * The whole beat at time `t` (ms from its start): which image (the still, or the match screen), the crumple `p`, the
 * ball's turn, the cross-fade while it's a ball, and how much of the creases' shade is left once it's open.
 */
export function crumpleAt(t: number, T = CRUMPLE_TIMING): { p: number; turn: number; image: "still" | "match"; mix: number; linger: number } {
  const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
  if (t < T.crumple) return { p: ease(t / T.crumple), turn: 0, image: "still", mix: 0, linger: 1 };
  const h = t - T.crumple;
  if (h < T.hold) return { p: 1, turn: 0.35 * smooth(h / T.hold), image: h < T.hold / 2 ? "still" : "match", mix: smooth(h / T.hold), linger: 1 };
  const o = h - T.hold;
  if (o < T.open) return { p: 1 - ease(o / T.open), turn: 0.35 * (1 - smooth(o / T.open)), image: "match", mix: 1, linger: 1 };
  return { p: 0, turn: 0, image: "match", mix: 1, linger: Math.max(0, 1 - (o - T.open) / T.creaseLinger) };
}

// ---- The game's (Nov 5, crumple-gl.ts draws it with WebGL): the mesh for a screen's shape (its fixed parts worked out once), its vertices filled into arrays a frame
// (no allocation), and the beat's clock with a hold that waits for the match screen. Pure; tested in packages/app/test/shop-folio.test.ts.

/** The mesh (the notes'): 16 columns by 34 rows on a portrait screen (a phone: cells about 24 px), turned (34 by 16) on a landscape one. */
export const CRUMPLE_MESH = { cols: 16, rows: 34 } as const;
export function meshSize(W: number, H: number): { cols: number; rows: number } {
  return W <= H ? { ...CRUMPLE_MESH } : { cols: CRUMPLE_MESH.rows, rows: CRUMPLE_MESH.cols };
}
/** Each triangle's three corners as (cell column, cell row) offsets: the cut alternating cell to cell, as `crumpleMesh`'s. */
const CUT_A = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]] as const;
const CUT_B = [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]] as const;
/** The mesh's vertex arrays (6 vertices a cell, two triangles), made once for a screen and refilled each frame by `fillMesh`. */
export interface MeshBuf {
  cols: number;
  rows: number;
  W: number;
  H: number;
  /** Clip-space position and depth (x, y, z) a vertex. */
  pos: Float32Array;
  /** The image's point (0 to 1 across, 0 to 1 down) a vertex. */
  uv: Float32Array;
  /** Its triangle's shade (1 = as flat) and whether we see its back (1), a vertex. */
  shade: Float32Array;
  back: Float32Array;
  /** The grid's points at p, and at the shade's p (scratch: (cols + 1) x (rows + 1) x 3). */
  grid: Float32Array;
  sgrid: Float32Array;
  /**
   * Each grid point's parts that never change (worked out once, so a frame only blends them: `crumplePoint` as drawn, faster): its
   * flat place (x, y), its edge lead (`p`'s shift), its place on the ball before the turn (bx, by, bz), and its three wrinkle fields.
   */
  fixed: Float64Array;
  /** The options its fixed parts were worked out for (a change of seed, ball or creases works them out again). */
  for: string;
}
/** A grid point's fixed parts: 9 numbers. */
const FIX = 9;
function fixParts(b: MeshBuf, o: CrumpleOpts): void {
  const key = `${o.seed}|${o.ball}|${o.creases}`;
  if (b.for === key) return;
  b.for = key;
  const { W, H } = b;
  const rmax = Math.hypot(W / 2, H / 2);
  const R = o.ball * Math.min(W, H);
  let k = 0;
  for (let j = 0; j <= b.rows; j++)
    for (let i = 0; i <= b.cols; i++) {
      const x = (i / b.cols - 0.5) * W;
      const y = (j / b.rows - 0.5) * H;
      const r = Math.hypot(x, y);
      const phi = Math.PI * Math.pow(r / rmax, 0.85);
      const th = Math.atan2(y, x);
      const Rr = R * (1 + o.creases * creaseField(x, y, o.seed) * 2);
      const f = b.fixed;
      f[k] = x;
      f[k + 1] = y;
      f[k + 2] = 0.35 * (1 - r / rmax);
      f[k + 3] = Rr * Math.sin(phi) * Math.cos(th);
      f[k + 4] = Rr * Math.sin(phi) * Math.sin(th);
      f[k + 5] = Rr * Math.cos(phi);
      f[k + 6] = creaseField(y * 1.3 + 50, x * 1.3 - 20, o.seed + 7) * 2;
      f[k + 7] = creaseField(x * 0.9 + 13, y * 0.9, o.seed + 3) * 2;
      f[k + 8] = creaseField(y * 0.9 - 31, x * 0.9 + 7, o.seed + 5) * 2;
      k += FIX;
    }
}
export function meshBuf(W: number, H: number): MeshBuf {
  const { cols, rows } = meshSize(W, H);
  const n = cols * rows * 6;
  const uv = new Float32Array(n * 2);
  let k = 0;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      for (const [di, dj] of (i + j) % 2 === 0 ? CUT_A : CUT_B) {
        uv[k++] = (i + di) / cols;
        uv[k++] = (j + dj) / rows;
      }
  const g = (cols + 1) * (rows + 1) * 3;
  return {
    cols,
    rows,
    W,
    H,
    pos: new Float32Array(n * 3),
    uv,
    shade: new Float32Array(n),
    back: new Float32Array(n),
    grid: new Float32Array(g),
    sgrid: new Float32Array(g),
    fixed: new Float64Array((g / 3) * FIX),
    for: "",
  };
}
/** Fills the grid's points at `p` into `out`: `crumplePoint` for each, from its fixed parts. */
function gridAt(b: MeshBuf, p: number, o: CrumpleOpts, out: Float32Array): void {
  fixParts(b, o);
  const f = b.fixed;
  const c = Math.cos(o.turn);
  const sn = Math.sin(o.turn);
  const n = out.length / 3;
  for (let q = 0, k = 0; q < n; q++, k += FIX) {
    const x = f[k]!;
    const y = f[k + 1]!;
    const pv = smooth(clamp01(p * 1.35 - f[k + 2]!));
    let bx = f[k + 3]!;
    let bz = f[k + 5]!;
    if (o.turn) [bx, bz] = [bx * c + bz * sn, -bx * sn + bz * c];
    const mid = Math.sin(Math.PI * pv);
    const w = o.wrinkle * mid;
    out[q * 3] = x + (bx - x) * pv + w * 0.6 * f[k + 7]!;
    out[q * 3 + 1] = y + (f[k + 4]! - y) * pv + w * 0.6 * f[k + 8]!;
    out[q * 3 + 2] = bz * pv + w * f[k + 6]!;
  }
}
/**
 * The mesh at crumple `p` (0 flat, 1 a ball), shaded as at `shadeP` (the creases lingering on the flat sheet), into `b`: each vertex
 * projected as `crumpleMesh` projects it (a mild perspective, focal F), in clip space (y up), its depth nearer the larger `z`; each
 * triangle's shade and back side from `shadeOf`. The ball's turn is `o.turn`.
 */
export function fillMesh(b: MeshBuf, p: number, o: CrumpleOpts, shadeP = p): void {
  gridAt(b, p, o, b.grid);
  const sg = shadeP === p ? b.grid : b.sgrid;
  if (sg !== b.grid) gridAt(b, shadeP, o, sg);
  const W1 = b.cols + 1;
  const at = (g: Float32Array, i: number, j: number): V3 => {
    const k = (j * W1 + i) * 3;
    return [g[k]!, g[k + 1]!, g[k + 2]!];
  };
  let v = 0;
  for (let j = 0; j < b.rows; j++)
    for (let i = 0; i < b.cols; i++) {
      const cut = (i + j) % 2 === 0 ? CUT_A : CUT_B;
      for (let t = 0; t < 2; t++) {
        const c = [cut[t * 3]!, cut[t * 3 + 1]!, cut[t * 3 + 2]!];
        const { shade, back } = shadeOf(at(sg, i + c[0]![0], j + c[0]![1]), at(sg, i + c[1]![0], j + c[1]![1]), at(sg, i + c[2]![0], j + c[2]![1]));
        for (const [di, dj] of c) {
          const q = at(b.grid, i + di, j + dj);
          const k = o.F / (o.F - q[2]);
          b.pos[v * 3] = ((q[0] * k) / b.W) * 2;
          b.pos[v * 3 + 1] = -((q[1] * k) / b.H) * 2;
          // (Nearer, larger z: smaller depth. Well inside the clip range for any ball.)
          b.pos[v * 3 + 2] = -q[2] / 4000;
          b.shade[v] = shade;
          b.back[v] = back ? 1 : 0;
          v++;
        }
      }
    }
}

/** The crumple's beats (ms): CHALLENGE_FEEL.folio.crumple. */
export interface CrumpleBeats {
  crumpleMs: number;
  holdMs: number;
  openMs: number;
  lingerMs: number;
  maxHoldMs: number;
}
/**
 * The whole beat `t` ms from its start, the match screen ready (taken, on its texture) `ready` ms from its start (Infinity: not yet):
 * crumpled over `crumpleMs`; held as a ball at least `holdMs`, and until the match screen has been ready for half a hold (the swap from
 * the still to it, cross-faded on the small ball, `mix`); opened over `openMs`; flat, its creases' shade fading over `lingerMs` (`live`:
 * from there the live match screen shows under the shade); done. Not ready by `crumpleMs + maxHoldMs`: "fail" (the room fades through
 * black to the match instead). The ball turns a little while held and back as it opens (the art's crumpleAt).
 */
export function crumpleBeat(t: number, ready: number, T: CrumpleBeats): { phase: "crumple" | "hold" | "open" | "linger" | "done" | "fail"; p: number; turn: number; mix: number; linger: number; openAt: number } {
  const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
  const sm = (u: number) => {
    const c = Math.min(1, Math.max(0, u));
    return c * c * (3 - 2 * c);
  };
  const half = T.holdMs / 2;
  const openAt = Math.max(T.crumpleMs + T.holdMs, ready + half);
  if (t < T.crumpleMs) return { phase: "crumple", p: ease(t / T.crumpleMs), turn: 0, mix: 0, linger: 1, openAt };
  if (t < openAt) {
    if (ready === Infinity && t >= T.crumpleMs + T.maxHoldMs) return { phase: "fail", p: 1, turn: 0.35, mix: 0, linger: 1, openAt };
    return { phase: "hold", p: 1, turn: 0.35 * sm((t - T.crumpleMs) / (openAt - T.crumpleMs)), mix: ready === Infinity ? 0 : sm((t - (openAt - half)) / half), linger: 1, openAt };
  }
  const o = t - openAt;
  if (o < T.openMs) return { phase: "open", p: 1 - ease(o / T.openMs), turn: 0.35 * (1 - sm(o / T.openMs)), mix: 1, linger: 1, openAt };
  const l = o - T.openMs;
  if (l < T.lingerMs) return { phase: "linger", p: 0, turn: 0, mix: 1, linger: 1 - l / T.lingerMs, openAt };
  return { phase: "done", p: 0, turn: 0, mix: 1, linger: 0, openAt };
}
/** The creases' shade on the flat sheet as it lingers (the art's: as if 0.1 crumpled, fading with `linger`). */
export const lingerShadeP = (linger: number): number => 0.1 * linger;
