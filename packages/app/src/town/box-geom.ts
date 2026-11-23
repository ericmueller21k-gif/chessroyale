/**
 * The street town's boxes' roof faces' geometry and their light (moved from boxes.ts on Nov 23, unchanged, so a paint worker
 * (paint.worker.ts) can paint a roof without loading the town's art: boxes.ts re-exports all of it).
 */
import type { BoxInst } from "./boxes.ts";
import type { Face, RoofTex, TownBox } from "./town-kit.ts";
import { DARK_SIDE, lightStep, type Step } from "./kit/prims.ts";

export const SQ = 37;
/** A box art's picture pixels a world square. */
export const pxOf = (box: Pick<TownBox, "px">): number => box.px ?? SQ;

/**
 * What a roof's geometry and painting read of a box's art and of the box (box-draw.ts `roofCuts`): a paint worker is sent just these
 * (paint-jobs.ts `roofCopy`). Typed by these lists, so code here reading anything else doesn't compile until it's added.
 */
export const ROOF_BOX_KEYS = ["id", "roof", "roofPal", "body", "depth", "px", "taper"] as const;
export type RoofBox = Pick<TownBox, (typeof ROOF_BOX_KEYS)[number]>;
export const ROOF_INST_KEYS = ["ux", "uy", "bx", "by", "tile"] as const;
export type RoofInst = Pick<BoxInst, (typeof ROOF_INST_KEYS)[number]>;

// ---- The roof faces' geometry, worked out once a box (its art: shared by every box standing with it).

export interface FaceGeom {
  /** Its corners: 3 or 4. */
  n: number;
  /** Its corners in the box's own space (u, t, h) and in px (lx along the front, ly back, lz up; the taper applied). */
  u: Float64Array;
  t: Float64Array;
  h: Float64Array;
  lx: Float64Array;
  ly: Float64Array;
  lz: Float64Array;
  /** Its normal, outward (the art's corners run counter-clockwise seen from outside), in the box's own frame (along, back, up). */
  nx: number;
  ny: number;
  nz: number;
  /** Its texture's frame: each corner's texture point (px, in the face's own plane, its first corner at 0, 0), and their box. */
  tx: Float64Array;
  ty: Float64Array;
  tx0: number;
  ty0: number;
  tw: number;
  th: number;
  /** Its middle (u, t, h). */
  cu: number;
  ct: number;
  ch: number;
  tex: RoofTex;
  rows: "u" | "t";
  rim: boolean;
  soft: boolean;
}
export interface BoxGeom {
  faces: FaceGeom[];
  /** The highest point of its roof (px). */
  top: number;
}
const geoms = new WeakMap<RoofBox, BoxGeom>();
export function geomOf(box: RoofBox): BoxGeom {
  let g = geoms.get(box);
  if (g) return g;
  const cxp = (box.body.x0 + box.body.x1) / 2;
  const D = box.depth * pxOf(box);
  let top = 0;
  const faces = box.roof.map((f: Face): FaceGeom => {
    const n = f.pts.length;
    const F = (k: number) => new Float64Array(k);
    const fg: FaceGeom = { n, u: F(n), t: F(n), h: F(n), lx: F(n), ly: F(n), lz: F(n), nx: 0, ny: 0, nz: 1, tx: F(n), ty: F(n), tx0: 0, ty0: 0, tw: 1, th: 1, cu: 0, ct: 0, ch: 0, tex: f.tex, rows: f.rows, rim: !!f.rim, soft: !!f.soft };
    f.pts.forEach(([u, t, h], k) => {
      fg.u[k] = u;
      fg.t[k] = t;
      fg.h[k] = h;
      fg.lx[k] = cxp + (u - cxp) * (1 - t * (1 - box.taper));
      fg.ly[k] = t * D;
      fg.lz[k] = h;
      fg.cu += u / n;
      fg.ct += t / n;
      fg.ch += h / n;
      top = Math.max(top, h);
    });
    // Its normal: (p1 - p0) x (p_last - p0).
    const e1 = [fg.lx[1]! - fg.lx[0]!, fg.ly[1]! - fg.ly[0]!, fg.lz[1]! - fg.lz[0]!];
    const e2 = [fg.lx[n - 1]! - fg.lx[0]!, fg.ly[n - 1]! - fg.ly[0]!, fg.lz[n - 1]! - fg.lz[0]!];
    let nx = e1[1]! * e2[2]! - e1[2]! * e2[1]!;
    let ny = e1[2]! * e2[0]! - e1[0]! * e2[2]!;
    let nz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    fg.nx = nx;
    fg.ny = ny;
    fg.nz = nz;
    // The texture's frame: x along its first edge, y across it in its plane.
    const xl = Math.hypot(e1[0]!, e1[1]!, e1[2]!) || 1;
    const X = [e1[0]! / xl, e1[1]! / xl, e1[2]! / xl];
    const d = e2[0]! * X[0]! + e2[1]! * X[1]! + e2[2]! * X[2]!;
    const yv = [e2[0]! - d * X[0]!, e2[1]! - d * X[1]!, e2[2]! - d * X[2]!];
    const yl = Math.hypot(yv[0]!, yv[1]!, yv[2]!) || 1;
    const Y = [yv[0]! / yl, yv[1]! / yl, yv[2]! / yl];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let k = 0; k < n; k++) {
      const px = fg.lx[k]! - fg.lx[0]!;
      const py = fg.ly[k]! - fg.ly[0]!;
      const pz = fg.lz[k]! - fg.lz[0]!;
      fg.tx[k] = px * X[0]! + py * X[1]! + pz * X[2]!;
      fg.ty[k] = px * Y[0]! + py * Y[1]! + pz * Y[2]!;
      x0 = Math.min(x0, fg.tx[k]!);
      y0 = Math.min(y0, fg.ty[k]!);
      x1 = Math.max(x1, fg.tx[k]!);
      y1 = Math.max(y1, fg.ty[k]!);
    }
    fg.tx0 = Math.floor(x0);
    fg.ty0 = Math.floor(y0);
    fg.tw = Math.max(1, Math.ceil(x1) - fg.tx0);
    fg.th = Math.max(1, Math.ceil(y1) - fg.ty0);
    return fg;
  });
  g = { faces, top };
  geoms.set(box, g);
  return g;
}

// ---- The light (the art's, as the mockups Eric saw): from the top left, a little toward the camera. It stays with the camera (the
// sun stays put while the camera turns), so a face's light changes as the camera turns.

/** A roof face's brightness: 0.74 + 0.36 (n . L), 0.55 to 1.12; its normal (world: east, north, up) turned into the camera's frame. */
export function faceLight(nx: number, ny: number, nz: number, hc: number, hs: number): number {
  const cx = nx * hc - ny * hs;
  const cy = nx * hs + ny * hc;
  const l = 0.74 + 0.36 * (cx * -0.5 + cy * -0.35 + nz * 0.79);
  return l < 0.55 ? 0.55 : l > 1.12 ? 1.12 : l;
}
/** A roof face's light, as a step of its palette's ramps (kit/prims.ts `lightStep`): its normal (world) turned into the camera's frame. */
export function faceStep(nx: number, ny: number, nz: number, hc: number, hs: number): Step {
  return lightStep(nx * hc - ny * hs, nx * hs + ny * hc, nz);
}
/** A wall shaded this much or more (`wallShade`, a back's extra included) is drawn one ramp step darker; less, the base. */
export const DARK_SHADE = 0.3 * DARK_SIDE;
/**
 * A wall's shade (0: none; the art: a side turned to the screen's left 6%, one turned right 30%): by how far its normal (world: east,
 * north) is turned from facing the camera, so a front facing the camera has none and a wall turns smoothly from one to the other.
 */
export function wallShade(nx: number, ny: number, hc: number, hs: number): number {
  const cx = nx * hc - ny * hs;
  return cx > 0 ? 0.3 * cx : -0.06 * cx;
}
/** A box's normal (its own frame: along its front, back, up) in the world's (east, north). */
export const worldNormal = (b: Omit<RoofInst, "tile">, nx: number, ny: number, out: { x: number; y: number }) => {
  out.x = b.ux * nx + b.bx * ny;
  out.y = b.uy * nx + b.by * ny;
};
