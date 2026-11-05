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

/** The ridged crease field at a point of the flat sheet (px): about -0.5 to 0.5. */
export function creaseField(x: number, y: number, seed: number): number {
  let s = 0;
  for (let i = 0; i < 7; i++) {
    const a = rnd(i, seed) * Math.PI;
    const k = 1 / (38 + rnd(i + 10, seed) * 70);
    const ph = rnd(i + 20, seed) * 6.28;
    s += Math.abs(Math.sin((x * Math.cos(a) + y * Math.sin(a)) * k + ph));
  }
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
