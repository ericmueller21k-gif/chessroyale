/**
 * The 3D art kit's geometry (Nov 6; the audit of Nov 6 §3, brief-3d-kit): one way to build every building and prop in 3D that looks
 * like the rest of the game's pixel art. Pure: no canvas.
 *
 * A model is plain data (`Model`): its palette, its textures (pixel grids), its shapes and its anchors. A shape is a primitive (box,
 * prism, pyramid or hip, wedge, n-gon cylinder, dome, quad) at `at` with `size`, in the model's own texels: x to the right as you
 * face its front, z back from its front line, y up (37 texels a square, the town's). Thin parts are quads 1 or 2 texels wide, never
 * stroked lines.
 *
 * Every face comes out with its corners in texture order (top left, top right, bottom right, bottom left as seen from outside, so
 * the texture's rows read like a picture: a wall's top row at its top, a top face's top row at its back) and its texture frame.
 */

/** A point in a model: [x across, z back, y up] (texels). */
export type V3 = readonly [x: number, z: number, y: number];
export type Prim = "box" | "prism" | "pyramid" | "wedge" | "cyl" | "dome" | "quad";
/** Which way a face looks: the texture it takes (`front`, `side`, `top`, `back`) follows from it. */
export type Role = "front" | "back" | "left" | "right" | "top" | "bottom" | "slope";
/** A shape's texture names by face. Left out: a side or the back takes the front's, a slope the top's, the top the front's. */
export interface Faces {
  front: string;
  side?: string;
  top?: string;
  back?: string;
}
export interface Shape {
  prim: Prim;
  at: V3;
  size: V3;
  faces: Faces;
  /** A moving part's name: the draw call moves or hides it (a claw, a crate). */
  part?: string;
  /** Its place in the drawing order: lower first; shapes in one layer are drawn far to near. */
  layer?: number;
  /** See-through (glass): its far faces are drawn first (in layer `far`, default before everything), its near ones in its layer. */
  glass?: boolean;
  far?: number;
  /** Faces left out (a top under a lid, a back against a wall). */
  hide?: readonly Role[];
  /** An n-gon's corners (cyl, dome; default 8) and a dome's rings (default 3). */
  n?: number;
  m?: number;
  /** A prism's ridge across its width (0 left .. 1 right; default 0.5); a hip's ridge as a share of its depth (0: a pyramid). */
  apex?: number;
  ridge?: number;
  /** A wedge's front height as a share of its height (0: a ramp to the ground). */
  lo?: number;
  /** A quad's own four corners (texture order), in place of `at` and `size`. */
  pts?: readonly [V3, V3, V3, V3];
  /** The ink outline round its faces (default true; a curved shape's facets have none of their own). */
  outline?: boolean;
}
export interface Model {
  /** Key -> a color, or a ramp [dark, base, light] (bake.ts derives a plain color's). "#rrggbbaa" for see-through (glass). */
  palette: Readonly<Record<string, string | readonly [string, string, string]>>;
  textures: Readonly<Record<string, readonly string[]>>;
  shapes: readonly Shape[];
  /** Named points (texels): a coin slot, where a claw hangs. */
  anchors: Readonly<Record<string, V3>>;
}

/** A face of a shape: its corners in texture order, its outward normal, its role and its texture frame. */
export interface PFace {
  role: Role;
  pts: V3[];
  /** Outward unit normal, [x, z, y] as the points. */
  n: V3;
  soft: boolean;
  twoSided: boolean;
  /** Each corner's texture point (texels: tx to the right, ty down, from the face's top left) and their box. */
  tx: number[];
  ty: number[];
  tw: number;
  th: number;
}

// ---- Vectors as [x, y up, z back], for the cross products.
type R3 = [number, number, number];
const r3 = (p: V3): R3 => [p[0], p[2], p[1]];
const sub = (a: R3, b: R3): R3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: R3, b: R3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: R3, b: R3): R3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: R3): R3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * A face from its corners (texture order, as seen from outside): its normal and texture frame. The texture's y runs down the face
 * (a top face's: toward the front); its x is y x n, to the right as you look at it.
 */
export function face(role: Role, pts: V3[], soft = false, twoSided = false): PFace {
  const P = pts.map(r3);
  // Newell's normal (robust for any planar polygon; x right, y up, z back, the corners clockwise seen from outside).
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i]!, b = P[(i + 1) % P.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const N = unit([nx, ny, nz]);
  const Y: R3 = Math.abs(N[1]) > 0.999 ? [0, 0, N[1] > 0 ? -1 : 1] : unit(sub([0, 0, 0], sub([0, 1, 0], [N[0] * N[1], N[1] * N[1], N[2] * N[1]])));
  const X = cross(Y, N);
  const tx = P.map((p) => dot(sub(p, P[0]!), X));
  const ty = P.map((p) => dot(sub(p, P[0]!), Y));
  const x0 = Math.min(...tx), y0 = Math.min(...ty);
  const sx = tx.map((v) => v - x0), sy = ty.map((v) => v - y0);
  return { role, pts, n: [N[0], N[2], N[1]], soft, twoSided, tx: sx, ty: sy, tw: Math.max(1, Math.ceil(Math.max(...sx) - 1e-6)), th: Math.max(1, Math.ceil(Math.max(...sy) - 1e-6)) };
}

/** A shape's faces (the ones not hidden). */
export function facesOf(s: Shape): PFace[] {
  const [x0, z0, y0] = s.at;
  const [w, d, h] = s.size;
  const x1 = x0 + w, z1 = z0 + d, y1 = y0 + h;
  const out: PFace[] = [];
  const add = (role: Role, pts: V3[], soft = false, two = false) => {
    if (!s.hide?.includes(role)) out.push(face(role, pts, soft || s.outline === false, two));
  };
  switch (s.prim) {
    case "box":
      add("front", [[x0, z0, y1], [x1, z0, y1], [x1, z0, y0], [x0, z0, y0]]);
      add("right", [[x1, z0, y1], [x1, z1, y1], [x1, z1, y0], [x1, z0, y0]]);
      add("left", [[x0, z1, y1], [x0, z0, y1], [x0, z0, y0], [x0, z1, y0]]);
      add("back", [[x1, z1, y1], [x0, z1, y1], [x0, z1, y0], [x1, z1, y0]]);
      add("top", [[x0, z1, y1], [x1, z1, y1], [x1, z0, y1], [x0, z0, y1]]);
      break;
    case "prism": {
      // A gable: its ridge runs straight back at `apex` across, its ends triangles.
      const xm = x0 + w * (s.apex ?? 0.5);
      add("front", [[xm, z0, y1], [x1, z0, y0], [x0, z0, y0]]);
      add("back", [[xm, z1, y1], [x0, z1, y0], [x1, z1, y0]]);
      if (xm > x0) add("left", [[xm, z1, y1], [xm, z0, y1], [x0, z0, y0], [x0, z1, y0]]);
      if (xm < x1) add("right", [[xm, z0, y1], [xm, z1, y1], [x1, z1, y0], [x1, z0, y0]]);
      break;
    }
    case "pyramid": {
      // A hip: its ridge along the middle, `ridge` of the depth long (0: a pyramid's point).
      const xm = x0 + w / 2;
      const r = s.ridge ?? 0;
      const za = z0 + (d * (1 - r)) / 2, zb = z1 - (d * (1 - r)) / 2;
      add("front", [[xm, za, y1], [x1, z0, y0], [x0, z0, y0]]);
      add("back", [[xm, zb, y1], [x0, z1, y0], [x1, z1, y0]]);
      add("right", r > 0 ? [[xm, za, y1], [xm, zb, y1], [x1, z1, y0], [x1, z0, y0]] : [[xm, za, y1], [x1, z1, y0], [x1, z0, y0]]);
      add("left", r > 0 ? [[xm, zb, y1], [xm, za, y1], [x0, z0, y0], [x0, z1, y0]] : [[xm, za, y1], [x0, z0, y0], [x0, z1, y0]]);
      break;
    }
    case "wedge": {
      // A ramp up toward the back (a control panel's desk): its slope from the front at `lo` of its height to the back's top.
      const yl = y0 + h * (s.lo ?? 0);
      add("top", [[x0, z1, y1], [x1, z1, y1], [x1, z0, yl], [x0, z0, yl]]);
      if (yl > y0) add("front", [[x0, z0, yl], [x1, z0, yl], [x1, z0, y0], [x0, z0, y0]]);
      add("back", [[x1, z1, y1], [x0, z1, y1], [x0, z1, y0], [x1, z1, y0]]);
      add("left", yl > y0 ? [[x0, z1, y1], [x0, z0, yl], [x0, z0, y0], [x0, z1, y0]] : [[x0, z1, y1], [x0, z0, y0], [x0, z1, y0]]);
      add("right", yl > y0 ? [[x1, z0, yl], [x1, z1, y1], [x1, z1, y0], [x1, z0, y0]] : [[x1, z1, y1], [x1, z1, y0], [x1, z0, y0]]);
      break;
    }
    case "cyl":
    case "dome": {
      // An n-gon round the middle (its first corner straight ahead at the front); a dome's m rings up to its top.
      const n = Math.max(3, s.n ?? 8);
      const cx = x0 + w / 2, cz = z0 + d / 2;
      const ring = (a: number, r: number, y: number): V3 => [cx + Math.sin(a) * (w / 2) * r, cz - Math.cos(a) * (d / 2) * r, y];
      const a = (i: number) => ((i - 0.5) / n) * Math.PI * 2;
      if (s.prim === "cyl") {
        for (let i = 0; i < n; i++) add("slope", [ring(a(i), 1, y1), ring(a(i + 1), 1, y1), ring(a(i + 1), 1, y0), ring(a(i), 1, y0)], true);
        // (The top's corners clockwise seen from above.)
        add("top", Array.from({ length: n }, (_, i) => ring(a(n - i), 1, y1)));
      } else {
        const m = Math.max(1, s.m ?? 3);
        for (let j = 0; j < m; j++) {
          const b0 = (j / m) * (Math.PI / 2), b1 = ((j + 1) / m) * (Math.PI / 2);
          for (let i = 0; i < n; i++) {
            const lo0 = ring(a(i), Math.cos(b0), y0 + h * Math.sin(b0)), lo1 = ring(a(i + 1), Math.cos(b0), y0 + h * Math.sin(b0));
            const hi0 = ring(a(i), Math.cos(b1), y0 + h * Math.sin(b1)), hi1 = ring(a(i + 1), Math.cos(b1), y0 + h * Math.sin(b1));
            add("slope", j === m - 1 ? [hi0, lo1, lo0] : [hi0, hi1, lo1, lo0], true);
          }
        }
      }
      break;
    }
    case "quad": {
      const pts: V3[] = s.pts
        ? s.pts.map((p) => [p[0], p[1], p[2]] as V3)
        : d === 0
          ? [[x0, z0, y1], [x1, z0, y1], [x1, z0, y0], [x0, z0, y0]]
          : w === 0
            ? [[x0, z0, y1], [x0, z1, y1], [x0, z1, y0], [x0, z0, y0]]
            : [[x0, z1, y0], [x1, z1, y0], [x1, z0, y0], [x0, z0, y0]];
      const f = face("front", pts, s.outline === false, true);
      f.role = Math.abs(f.n[2]) > 0.999 ? "top" : Math.abs(f.n[0]) > 0.999 ? "right" : Math.abs(f.n[1]) > 0.999 ? "front" : "slope";
      out.push(f);
      break;
    }
  }
  return out;
}

/** The texture a face takes. */
export function texOf(s: Shape, f: PFace): string {
  const F = s.faces;
  if (f.role === "top" || f.role === "slope" || f.role === "bottom") return F.top ?? F.front;
  if (f.role === "left" || f.role === "right") return F.side ?? F.front;
  if (f.role === "back") return F.back ?? F.side ?? F.front;
  return F.front;
}

/**
 * The affine map (a, b, c, d, e, f: x' = a x + c y + e, y' = b x + d y + f, a 2D context's setTransform order) taking three points
 * (sx, sy) to (dx, dy), into `out`. False when the three are in a line.
 */
export function affine(
  sx0: number, sy0: number, dx0: number, dy0: number,
  sx1: number, sy1: number, dx1: number, dy1: number,
  sx2: number, sy2: number, dx2: number, dy2: number,
  out: Float64Array,
): boolean {
  const ux = sx1 - sx0;
  const uy = sy1 - sy0;
  const vx = sx2 - sx0;
  const vy = sy2 - sy0;
  const det = ux * vy - uy * vx;
  if (Math.abs(det) < 1e-9) return false;
  const px = dx1 - dx0;
  const py = dy1 - dy0;
  const qx = dx2 - dx0;
  const qy = dy2 - dy0;
  // [a c; b d] [ux vx; uy vy] = [px qx; py qy]
  out[0] = (px * vy - qx * uy) / det;
  out[2] = (qx * ux - px * vx) / det;
  out[1] = (py * vy - qy * uy) / det;
  out[3] = (qy * ux - py * vx) / det;
  out[4] = dx0 - out[0]! * sx0 - out[2]! * sy0;
  out[5] = dy0 - out[1]! * sx0 - out[3]! * sy0;
  return true;
}

/** The signed area of a polygon (its points' x and y): its winding. */
export function area(xs: ArrayLike<number>, ys: ArrayLike<number>, n = xs.length): number {
  let a = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += xs[i]! * ys[j]! - xs[j]! * ys[i]!;
  }
  return a / 2;
}

// ---- The light (the town's, boxes.ts: from the top left, a little toward the camera), as three steps of a palette ramp.

/** Light ramp steps: -1 one step darker, 0 the base, 1 the light step. */
export type Step = -1 | 0 | 1;
/** n . L at or over this: the light step (a top faces up at 0.79); under `DARK_NL`: one step darker. */
export const LIGHT_NL = 0.75;
export const DARK_NL = 0.33;
/** A wall (upright) turned right of the camera this far (the across part of its normal) takes one step darker: the art's 30% side. */
export const DARK_SIDE = 0.5;
/**
 * A face's step from its normal in the camera's frame (`cx` to the right, `cz` ahead, away from the camera, `cy` up): an upright
 * wall the base, or one step darker when turned to the right; anything else (a top, a roof's slope) quantized from n . L.
 */
export function lightStep(cx: number, cz: number, cy: number): Step {
  if (Math.abs(cy) < 0.02) return cx >= DARK_SIDE ? -1 : 0;
  const nl = cx * -0.5 + cz * -0.35 + cy * 0.79;
  return nl >= LIGHT_NL ? 1 : nl < DARK_NL ? -1 : 0;
}
