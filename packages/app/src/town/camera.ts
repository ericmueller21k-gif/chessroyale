/**
 * The town square's camera: pure projection math, no DOM (ported from the prototype Eric tested,
 * docs/mockups/town-square/prototype.html; its README has the numbers, now in feel.ts).
 *
 * A pitched pinhole camera over a ground that drops away from the focus point (a small round world), cut at a rim that
 * forms the horizon. The box's width-to-height ratio blends the phone's and the computer's camera, so the world never
 * assumes a screen size. Squares are in world units; the square (c, r) covers [c - 0.5, c + 0.5] x [r - 0.5, r + 0.5],
 * and r grows away from the camera. The world is N x N squares and wraps both ways.
 *
 * Nothing here allocates once a view is made: projections write into a point the caller owns.
 */
import { TOWN_FEEL, type CamSet } from "./feel.ts";

/** The world is N x N squares and wraps on both axes. */
export const N = 40;

/** Into [0, N). */
export const wrapI = (v: number): number => ((v % N) + N) % N;
/** Into [-N/2, N/2): the shortest way round. */
export const wrapF = (v: number): number => ((((v + N / 2) % N) + N) % N) - N / 2;
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** A projected point: screen x, y (CSS pixels in the box), k = pixels per square there, and its depth. */
export interface Pt {
  x: number;
  y: number;
  k: number;
  depth: number;
}
export const newPt = (): Pt => ({ x: 0, y: 0, k: 0, depth: 0 });

/** How many points make the rim's line (the horizon). */
const RIM_STEPS = 64;

/** The camera for a frame. Make one with newView and refresh it with setView. */
export interface View {
  W: number;
  H: number;
  zoom: number;
  /**
   * The lens (the close-up on a statue): everything magnified `mag` times about the lens's middle (the box's middle
   * column, `cy`), then shifted `oy` pixels down. 1 and 0: the plain camera. A longer lens, not a moved camera: the
   * world keeps its shape, only the view narrows.
   */
  mag: number;
  oy: number;
  /** The blended camera set for this box. */
  P: CamSet;
  h: number;
  back: number;
  cs: number;
  sn: number;
  F: number;
  cy: number;
  /** The curve: the ground drops c (kx dx² + dz²) below the focus' height. */
  c: number;
  kx: number;
  /** The rim's reach ahead, in squares, and its sideways stretch. */
  rim: number;
  rimX: number;
  /** The horizon's y straight ahead. */
  hy: number;
  /** Pixels per square at the focus point, and the focus point's y. */
  kf: number;
  fy: number;
  /** The rim as a screen polyline: rimN points, (rimPx[i], rimPy[i]). */
  rimN: number;
  rimPx: Float64Array;
  rimPy: Float64Array;
}

export function newView(): View {
  return {
    W: 0,
    H: 0,
    zoom: -1,
    mag: 1,
    oy: 0,
    P: { ...TOWN_FEEL.camTall },
    h: 1,
    back: 1,
    cs: 1,
    sn: 0,
    F: 1,
    cy: 0,
    c: 0,
    kx: 1,
    rim: 1,
    rimX: 1,
    hy: 0,
    kf: 1,
    fy: 0,
    rimN: 0,
    rimPx: new Float64Array(RIM_STEPS + 1),
    rimPy: new Float64Array(RIM_STEPS + 1),
  };
}

const KEYS = ["h", "th", "back", "R", "kx", "fW", "cy", "rim", "rimX"] as const;
const tmp = newPt();

/**
 * Works the camera out for a box of W x H CSS pixels at a zoom (0 = normal, 1 = zoomed out), through a lens of `mag`
 * shifted `oy` (the close-up; 1, 0: none). Cheap when nothing changed.
 */
export function setView(v: View, W: number, H: number, zoom: number, mag = 1, oy = 0): void {
  if (v.W === W && v.H === H && v.zoom === zoom && v.mag === mag && v.oy === oy) return;
  v.W = W;
  v.H = H;
  v.zoom = zoom;
  v.mag = mag;
  v.oy = oy;
  const f = TOWN_FEEL;
  const t = clamp((W / H - f.aspectTall) / (f.aspectWide - f.aspectTall), 0, 1);
  const P = v.P;
  for (const k of KEYS) P[k] = f.camTall[k] + (f.camWide[k] - f.camTall[k]) * t;
  v.h = P.h * (1 + f.zoomOutHeight * zoom);
  v.back = P.back * (1 + f.zoomOutBack * zoom);
  const th = ((P.th + f.zoomOutPitch * zoom) * Math.PI) / 180;
  v.cs = Math.cos(th);
  v.sn = Math.sin(th);
  v.F = P.fW * W * mag;
  v.cy = P.cy * H;
  // The curve comes from the unzoomed height, so zooming keeps the world's shape.
  v.c = P.h / (P.R * P.R);
  v.kx = P.kx;
  // Where the ground passes over the curve, straight ahead: the world's rim is there or nearer.
  let best = Infinity;
  let bz = 0;
  for (let dz = 0; dz < N / 2; dz += 0.25) if (proj(v, 0, dz, 0, tmp) && tmp.y < best) ((best = tmp.y), (bz = dz));
  v.rim = Math.min(bz, P.rim * (1 + f.zoomOutRim * zoom));
  v.rimX = P.rimX;
  v.hy = proj(v, 0, v.rim, 0, tmp) ? tmp.y : H * 0.2;
  // The rim as a half circle of radius rim around the focus point, on screen.
  v.rimN = 0;
  for (let i = 0; i <= RIM_STEPS; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / RIM_STEPS;
    if (proj(v, v.rim * v.rimX * Math.sin(a), v.rim * Math.cos(a), 0, tmp)) {
      v.rimPx[v.rimN] = tmp.x;
      v.rimPy[v.rimN] = tmp.y;
      v.rimN++;
    }
  }
  if (proj(v, 0, 0, 0, tmp)) ((v.kf = tmp.k), (v.fy = tmp.y));
  else ((v.kf = 50), (v.fy = H * 0.7));
}

/**
 * A world point dx squares sideways and dz ahead of the focus point, `lift` squares above the ground, into `out`.
 * False when it's behind the camera. The ground drops with distance from the focus: Y = -h - c (kx dx² + dz²).
 */
export function proj(v: View, dx: number, dz: number, lift: number, out: Pt): boolean {
  const Y = -v.h - v.c * (v.kx * dx * dx + dz * dz) + lift;
  const Z = dz + v.back;
  const depth = Z * v.cs - Y * v.sn;
  if (depth < 0.5) return false;
  const up = Y * v.cs + Z * v.sn;
  out.x = v.W / 2 + (v.F * dx) / depth;
  out.y = v.cy + v.oy - (v.F * up) / depth;
  out.k = v.F / depth;
  out.depth = depth;
  return true;
}

const ta = newPt();
const tb = newPt();
/** Is a ground point past the curve (hidden behind the bulge)? There the ground faces away: farther projects lower. */
export function pastCurve(v: View, dx: number, dz: number): boolean {
  return !proj(v, dx, dz, 0, ta) || !proj(v, dx, dz + 0.25, 0, tb) || tb.y >= ta.y;
}

/** Distance from the focus point in rim units (the rim's sideways stretch taken out). */
export const radial = (v: View, dx: number, dz: number): number => Math.hypot(dx / v.rimX, dz);
/** How far toward the horizon a point is: 0 at the focus, 1 at the rim. */
export const farOf = (v: View, dz: number): number => clamp(dz / Math.max(1, v.rim), 0, 1);
/** Things fade in over their first squares inside the rim, so nothing pops. */
export const enterOf = (v: View, dx: number, dz: number): number => clamp((v.rim - radial(v, dx, dz)) / TOWN_FEEL.enterSquares, 0, 1);
/** 0 before the far band, rising smoothly to 1 at the rim (and past it). */
export function bandOf(v: View, dx: number, dz: number): number {
  const b = TOWN_FEEL.bandStart;
  const t = clamp((radial(v, dx, dz) / v.rim - b) / (1 - b), 0, 1);
  return t * t * (3 - 2 * t);
}
/** The mix toward the sky's color: a light haze with distance (more with dawn's `mist`), then the band's dissolve. */
export function hazeMix(v: View, dx: number, dz: number, mist = 0): number {
  const base = (TOWN_FEEL.hazeNear + mist) * Math.pow(farOf(v, dz), 1.5);
  return base + (TOWN_FEEL.bandMix - base) * bandOf(v, dx, dz);
}

/**
 * Can a thing standing at (dx, dz) be drawn? Inside the rim, in front of the camera, before the curve, roughly on screen
 * (`margin` squares past either side, its foot up to `below` squares under the box: a tall thing's top still shows).
 */
export function drawable(v: View, dx: number, dz: number, margin: number, below = 3.2): boolean {
  if (radial(v, dx, dz) > v.rim || dz < -v.back + 0.6) return false;
  if (!proj(v, dx, dz, 0, tmp)) return false;
  if (tmp.x < -margin * tmp.k || tmp.x > v.W + margin * tmp.k || tmp.y > v.H + tmp.k * below) return false;
  return !pastCurve(v, dx, dz);
}

/** The horizon's y at screen x (null off its ends). */
export function rimYAt(v: View, x: number): number | null {
  const px = v.rimPx;
  const py = v.rimPy;
  for (let i = 1; i < v.rimN; i++)
    if ((px[i - 1]! - x) * (px[i]! - x) <= 0) {
      const t = (x - px[i - 1]!) / (px[i]! - px[i - 1]! || 1);
      return py[i - 1]! + t * (py[i]! - py[i - 1]!);
    }
  return null;
}

/** A drawn square's corners, far-left, far-right, near-right, near-left: (x, y) pairs in q[0..7]. */
export type Quad = Float64Array;

/**
 * Visits every ground square drawn this frame: (c, r) wrapped, (cu, ru) unwrapped near the camera, and its corners.
 * Far rows first (the drawing order), or near rows first (`nearFirst`, for picking: a nearer square wins). The visit
 * returns true to stop.
 */
export function forEachSquare(
  v: View,
  camX: number,
  camY: number,
  nearFirst: boolean,
  visit: (c: number, r: number, cu: number, ru: number, q: Quad) => boolean | void,
): void {
  const near = Math.floor(camY - v.back + 0.5) - 1; // the row under the camera
  const far = Math.ceil(camY + v.rim + 1);
  for (let i = 0; i <= far - near; i++) {
    const ru = nearFirst ? near + i : far - i;
    if (scanRow(v, camX, camY, ru, visit)) return;
  }
}

// Each row's far and near edges, one vertex per column boundary: x, y and whether it projected.
const MAXV = N + 8;
const fx = new Float64Array(MAXV);
const fy = new Float64Array(MAXV);
const nx = new Float64Array(MAXV);
const ny = new Float64Array(MAXV);
const ok = new Uint8Array(MAXV);
const quad: Quad = new Float64Array(8);

function scanRow(v: View, camX: number, camY: number, ru: number, visit: (c: number, r: number, cu: number, ru: number, q: Quad) => boolean | void): boolean {
  const zf = ru + 0.5 - camY;
  const zn = ru - 0.5 - camY;
  if (zn > N / 2 - 1 || zf < -N / 2 + 1) return false;
  if (zn > v.rim) return false; // beyond the rim
  if (!proj(v, 0, zn, 0, ta)) return false;
  const kn = ta.k;
  if (ta.y - 40 > v.H && proj(v, 0, zf, 0, tb) && tb.y > v.H) return false; // below the bottom of the box
  const zc = zn <= 0 && zf >= 0 ? 0 : Math.min(Math.abs(zn), Math.abs(zf));
  const Lrim = Math.sqrt(Math.max(0, v.rim * v.rim - zc * zc)) * v.rimX + 1.5;
  const L = Math.min(N / 2 - 1, (v.W / 2 + 40) / kn + 1.5, Lrim);
  const c0 = Math.floor(camX - L);
  const c1 = Math.ceil(camX + L);
  const n = c1 - c0 + 2;
  for (let i = 0; i < n; i++) {
    const dx = c0 + i - 0.5 - camX;
    const a = proj(v, dx, zf, 0, ta);
    const b = proj(v, dx, zn, 0, tb);
    ok[i] = a && b ? 1 : 0;
    fx[i] = ta.x;
    fy[i] = ta.y;
    nx[i] = tb.x;
    ny[i] = tb.y;
  }
  const r = wrapI(ru);
  for (let i = 0; i < n - 1; i++) {
    if (!ok[i] || !ok[i + 1]) continue;
    // Past the curve: the ground faces away here.
    if (fy[i]! >= ny[i]! - 0.15 || fy[i + 1]! >= ny[i + 1]! - 0.15) continue;
    const xmin = Math.min(fx[i]!, fx[i + 1]!, nx[i]!, nx[i + 1]!);
    const xmax = Math.max(fx[i]!, fx[i + 1]!, nx[i]!, nx[i + 1]!);
    if (xmax < 0 || xmin > v.W || Math.min(fy[i]!, fy[i + 1]!) > v.H) continue;
    quad[0] = fx[i]!;
    quad[1] = fy[i]!;
    quad[2] = fx[i + 1]!;
    quad[3] = fy[i + 1]!;
    quad[4] = nx[i + 1]!;
    quad[5] = ny[i + 1]!;
    quad[6] = nx[i]!;
    quad[7] = ny[i]!;
    const cu = c0 + i;
    if (visit(wrapI(cu), r, cu, ru, quad)) return true;
  }
  return false;
}

/** Is (x, y) inside a convex quad? */
export function inQuad(x: number, y: number, q: Quad): boolean {
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < 4; i++) {
    const ax = q[2 * i]!;
    const ay = q[2 * i + 1]!;
    const bx = q[(2 * i + 2) % 8]!;
    const by = q[(2 * i + 3) % 8]!;
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (cross > 0) pos++;
    else if (cross < 0) neg++;
  }
  return pos === 0 || neg === 0;
}

/** The square under a tap at (x, y) in the box, or null (the sky, or nothing drawn there). Nearest square wins. */
export function pickSquare(v: View, camX: number, camY: number, x: number, y: number): { c: number; r: number } | null {
  const rim = rimYAt(v, x);
  if (rim !== null && y < rim) return null; // the sky, above the horizon
  let hit: { c: number; r: number } | null = null;
  forEachSquare(v, camX, camY, true, (c, r, _cu, _ru, q) => {
    if (!inQuad(x, y, q)) return false;
    hit = { c, r };
    return true;
  });
  return hit;
}

/** How many rows show between the bottom of the box and the horizon, straight ahead. */
export function rowsInView(v: View): number {
  let n = 0;
  for (let k = -12; k < N; k++) {
    const z = 0.5 + k;
    if (z > v.rim) break;
    if (proj(v, 0, z, 0, tmp) && tmp.y < v.H) n++;
  }
  return n;
}
