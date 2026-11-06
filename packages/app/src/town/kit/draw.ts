/**
 * The 3D art kit's drawing (Nov 6; brief-3d-kit): a model's faces through a Painter's context (paint.ts `Ctx`: Canvas 2D or the
 * street town's WebGL stand-in) and the camera (camera.ts `proj`, through a `P3` the caller makes from its view). Each face is a
 * picture baked once (bake.ts) and drawn through an affine transform, whole or as triangles whose pixels outside are see-through, so
 * nothing needs a clip and both backends draw it the same. Nearest filtering at 1.5 screen pixels a texel and above, smooth below,
 * as the sprites.
 *
 * Painter's order: a model's shapes by layer, then far to near within a layer (each shape's faces together: a convex shape's faces
 * turned toward the camera never overlap). A see-through shape (glass) has its far faces drawn first (before everything, or in the
 * layer it names), its near ones in its layer, so what's inside shows through.
 */
import type { Pt } from "../camera.ts";
import type { Ctx } from "../paint.ts";
import { bakeFace, gridTexel, rampsOf, triPixels, type Cut, type Poly, type Ramps } from "./bake.ts";
import { affine, area, facesOf, lightStep, texOf, type Model, type PFace, type Step, type V3 } from "./prims.ts";

/** A piece of a sheet: its canvas, its rectangle there, and where its texture's (0, 0) lies on the sheet (`ox`, `oy`). */
export interface Piece {
  cv: HTMLCanvasElement;
  sx: number;
  sy: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
}
const SHEET = 512;

/** Packs pictures into sheets (shelves, SHEET px wide), each with a 2 px gap: a few big pictures for WebGL's atlas, not hundreds of small ones. */
export function pack(items: Cut[]): Piece[] {
  const out: Piece[] = new Array(items.length);
  const sheets: { w: number; h: number; place: { i: number; x: number; y: number }[] }[] = [];
  let cur = { w: 0, h: 0, place: [] as { i: number; x: number; y: number }[] };
  let x = 0;
  let y = 0;
  let shelf = 0;
  // Tallest first, so shelves fill.
  const order = items.map((_, i) => i).sort((a, b) => items[b]!.h - items[a]!.h);
  for (const i of order) {
    const it = items[i]!;
    const w = it.w + 2;
    const h = it.h + 2;
    if (x + w > SHEET) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    if (y + h > SHEET && cur.place.length) {
      sheets.push(cur);
      cur = { w: 0, h: 0, place: [] };
      x = y = shelf = 0;
    }
    cur.place.push({ i, x: x + 1, y: y + 1 });
    cur.w = Math.max(cur.w, x + w);
    cur.h = Math.max(cur.h, y + h);
    x += w;
    shelf = Math.max(shelf, h);
  }
  if (cur.place.length) sheets.push(cur);
  for (const s of sheets) {
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, s.w);
    cv.height = Math.max(1, s.h);
    const img = new ImageData(cv.width, cv.height);
    for (const p of s.place) {
      const it = items[p.i]!;
      for (let j = 0; j < it.h; j++) img.data.set(it.data.subarray(j * it.w * 4, (j + 1) * it.w * 4), ((p.y + j) * cv.width + p.x) * 4);
      out[p.i] = { cv, sx: p.x, sy: p.y, w: it.w, h: it.h, ox: p.x + it.ox, oy: p.y + it.oy };
    }
    cv.getContext("2d")!.putImageData(img, 0, 0);
  }
  return out;
}

/** A face's pieces: whole, and its triangles (triangle k: corners 0, k + 1, k + 2). */
export interface FaceArt {
  whole: Piece;
  tris: Piece[];
}
/** A face painted (bake.ts): whole, then its triangles, ready to pack. */
export function faceCuts(p: Poly, texel: (X: number, Y: number) => string | null, ramps: Ramps, step: Step, o: Parameters<typeof bakeFace>[4] = {}): Cut[] {
  const whole = bakeFace(p, texel, ramps, step, o);
  const items: Cut[] = [{ w: whole.w, h: whole.h, data: whole.data, ox: 1 - p.tx0, oy: 1 - p.ty0 }];
  for (let k = 0; k < p.n - 2; k++) items.push(triPixels(p, whole, 0, k + 1, k + 2));
  return items;
}
/** Faces' cuts (`faceCuts`, in order) packed together into a sheet or two, then split back into each face's pieces. */
export function packFaces(cuts: Cut[][]): FaceArt[] {
  const pcs = pack(cuts.flat());
  let at = 0;
  return cuts.map((c) => {
    const fa = { whole: pcs[at]!, tris: pcs.slice(at + 1, at + c.length) };
    at += c.length;
    return fa;
  });
}

/** Where a model stands: its (0, 0, 0) in the world (squares: x east, y north, lift up), the ways its x and its z (back) run, its texels a square. */
export interface Place {
  x: number;
  y: number;
  lift: number;
  ux: number;
  uy: number;
  bx: number;
  by: number;
  px: number;
}
/** A model standing on (x, y), its front facing south (toward a camera facing north), at the art's 37 texels a square. */
export const facingSouth = (x: number, y: number, lift = 0, px = 37): Place => ({ x, y, lift, ux: 1, uy: 0, bx: 0, by: 1, px });
/** A world point (squares: x east, y north, `lift` up) on screen, into `out`; false if it's behind the camera. camera.ts `proj` after the caller's own offset. */
export type P3 = (x: number, y: number, lift: number, out: Pt) => boolean;

export interface DrawOpts {
  /** The context's scale from CSS pixels to its own (the town's and the rooms' device pixel ratio). */
  dpr?: number;
  /** The camera's heading (cos, sin; north 1, 0): the light turns with it. */
  hc?: number;
  hs?: number;
  /** Moving parts' offsets (texels), by part name; a part `hide` says yes to isn't drawn. */
  move?: Readonly<Record<string, V3>>;
  hide?: (part: string) => boolean;
  alpha?: number;
}

/** A model made ready: its faces, its ramps, its faces' paintings by step (made the first time each is drawn). */
interface FaceRec {
  shape: number;
  f: PFace;
  poly: Poly;
  texel: (X: number, Y: number) => string | null;
  /** This frame: on screen, its corners there, its step, drawn before everything (a glass's far face). */
  xs: Float64Array;
  ys: Float64Array;
  /** Its corners in the world this frame (x, y, lift), for strips. */
  ws: Float64Array;
}
interface ModelArt {
  ramps: Ramps;
  faces: FaceRec[];
  /** Every face painted at a step (dark, base, light), packed together: made the first time a face is drawn at that step. */
  steps: (FaceArt[] | undefined)[];
  /** Each shape's middle (texels). */
  mids: V3[];
}
const arts = new WeakMap<Model, ModelArt>();
export function artOf(m: Model): ModelArt {
  let a = arts.get(m);
  if (a) return a;
  const ramps = rampsOf(m.palette);
  const faces: FaceRec[] = [];
  const mids: V3[] = [];
  m.shapes.forEach((s, si) => {
    mids.push([s.at[0] + s.size[0] / 2, s.at[1] + s.size[1] / 2, s.at[2] + s.size[2] / 2]);
    for (const f of facesOf(s)) {
      const grid = m.textures[texOf(s, f)];
      if (!grid) throw new Error(`kit: no texture "${texOf(s, f)}"`);
      const poly: Poly = { n: f.pts.length, tx: f.tx, ty: f.ty, tx0: 0, ty0: 0, tw: f.tw, th: f.th };
      faces.push({ shape: si, f, poly, texel: gridTexel(grid), xs: new Float64Array(f.pts.length), ys: new Float64Array(f.pts.length), ws: new Float64Array(f.pts.length * 3) });
    }
  });
  arts.set(m, (a = { ramps, faces, mids, steps: [] }));
  return a;
}

/** A model point (texels) in the world, into `out` (x, y, lift). */
export function worldOf(at: Place, x: number, z: number, y: number, out: { x: number; y: number; lift: number }): void {
  out.x = at.x + (at.ux * x + at.bx * z) / at.px;
  out.y = at.y + (at.uy * x + at.by * z) / at.px;
  out.lift = at.lift + y / at.px;
}

const W = { x: 0, y: 0, lift: 0 };
const pt: Pt = { x: 0, y: 0, k: 0, depth: 0 };
const M = new Float64Array(6);
/** The faces to draw this frame: index into the model's faces, its sort keys, its step. */
const list: { i: number; layer: number; depth: number; step: Step }[] = [];

/** A model's anchor on screen (moved with `part`'s offset, if any), into `out`; false if it's behind the camera. */
export function anchorAt(m: Model, at: Place, name: string, p3: P3, out: Pt, off?: V3): boolean {
  const a = m.anchors[name];
  if (!a) throw new Error(`kit: no anchor "${name}"`);
  worldOf(at, a[0] + (off?.[0] ?? 0), a[1] + (off?.[1] ?? 0), a[2] + (off?.[2] ?? 0), W);
  return p3(W.x, W.y, W.lift, out);
}

/** Draws model `m` standing at `at`, as the camera (`p3`, its heading in `o`) sees it. */
export function drawModel(ctx: Ctx, m: Model, at: Place, p3: P3, o: DrawOpts = {}): void {
  const A = artOf(m);
  const hc = o.hc ?? 1;
  const hs = o.hs ?? 0;
  const dpr = o.dpr ?? 1;
  list.length = 0;
  let si = -1;
  let off: V3 = [0, 0, 0];
  let hidden = false;
  let depth = 0;
  let layer = 0;
  let glass = false;
  let far = 0;
  for (let i = 0; i < A.faces.length; i++) {
    const F = A.faces[i]!;
    if (F.shape !== si) {
      si = F.shape;
      const s = m.shapes[si]!;
      hidden = !!(s.part && o.hide?.(s.part));
      off = (s.part && o.move?.[s.part]) || [0, 0, 0];
      const c = A.mids[si]!;
      worldOf(at, c[0] + off[0], c[1] + off[1], c[2] + off[2], W);
      hidden ||= !p3(W.x, W.y, W.lift, pt);
      depth = pt.depth;
      layer = s.layer ?? 0;
      glass = !!s.glass;
      far = s.far ?? -1e6;
    }
    if (hidden) continue;
    const f = F.f;
    let ok = true;
    for (let k = 0; k < f.pts.length; k++) {
      const p = f.pts[k]!;
      worldOf(at, p[0] + off[0], p[1] + off[1], p[2] + off[2], W);
      if (!p3(W.x, W.y, W.lift, pt)) {
        ok = false;
        break;
      }
      F.xs[k] = pt.x;
      F.ys[k] = pt.y;
      F.ws[k * 3] = W.x;
      F.ws[k * 3 + 1] = W.y;
      F.ws[k * 3 + 2] = W.lift;
    }
    if (!ok) continue;
    // Facing the camera when its corners run the same way on screen as in its texture (both y down).
    const facing = area(F.xs, F.ys) * area(f.tx, f.ty) > 0;
    if (!facing && !f.twoSided && !glass) continue;
    // Its step: its normal (seen from behind: turned round) in the camera's frame.
    const sg = facing ? 1 : -1;
    const ex = sg * (at.ux * f.n[0] + at.bx * f.n[1]);
    const ey = sg * (at.uy * f.n[0] + at.by * f.n[1]);
    const step = lightStep(ex * hc - ey * hs, ex * hs + ey * hc, sg * f.n[2]);
    list.push({ i, layer: glass && !facing ? far : layer, depth, step });
  }
  list.sort((a, b) => a.layer - b.layer || b.depth - a.depth || a.i - b.i);
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  for (const e of list) {
    const F = A.faces[e.i]!;
    const st = e.step;
    const arts = (A.steps[st + 1] ??= packFaces(A.faces.map((G) => faceCuts(G.poly, G.texel, A.ramps, st, { soft: G.f.soft }))));
    drawFace(ctx, dpr, F.poly, F.xs, F.ys, arts[e.i]!, F.ws, p3);
  }
  ctx.restore();
}

/** Strips a face may be cut into, at most, where its perspective is too strong for one affine. */
const MAX_STRIPS = 12;
const S0: Pt = { x: 0, y: 0, k: 0, depth: 0 };
const S1: Pt = { x: 0, y: 0, k: 0, depth: 0 };
const S2: Pt = { x: 0, y: 0, k: 0, depth: 0 };
/** A point `s` of the way from world corner a to b of a face (`ws`: x, y, lift each), projected into `out`. */
function along(ws: Float64Array, a: number, b: number, s: number, p3: P3, out: Pt): boolean {
  return p3(ws[a * 3]! + (ws[b * 3]! - ws[a * 3]!) * s, ws[a * 3 + 1]! + (ws[b * 3 + 1]! - ws[a * 3 + 1]!) * s, ws[a * 3 + 2]! + (ws[b * 3 + 2]! - ws[a * 3 + 2]!) * s, out);
}
/**
 * A face's art on screen at its corners (`xs`, `ys`): whole when an affine puts its every corner within a pixel; a rectangle (a box's
 * face) too foreshortened for that in strips of whole texels across the way it recedes (its world corners `ws` and the camera `p3`
 * give each strip's own corners, as the town's walls are drawn); anything else as its triangles.
 */
export function drawFace(ctx: Ctx, dpr: number, p: Poly, xs: ArrayLike<number>, ys: ArrayLike<number>, art: FaceArt, ws?: Float64Array, p3?: P3): void {
  const n = p.n;
  const l = n - 1;
  let err = n === 3 ? 0 : Infinity;
  if (n === 4 && affine(p.tx[0]!, p.ty[0]!, xs[0]!, ys[0]!, p.tx[1]!, p.ty[1]!, xs[1]!, ys[1]!, p.tx[l]!, p.ty[l]!, xs[l]!, ys[l]!, M)) {
    const X = M[0]! * p.tx[2]! + M[2]! * p.ty[2]! + M[4]!;
    const Y = M[1]! * p.tx[2]! + M[3]! * p.ty[2]! + M[5]!;
    err = Math.hypot(X - xs[2]!, Y - ys[2]!);
  }
  if (err < 0.75) {
    if (affine(p.tx[0]!, p.ty[0]!, xs[0]!, ys[0]!, p.tx[1]!, p.ty[1]!, xs[1]!, ys[1]!, p.tx[l]!, p.ty[l]!, xs[l]!, ys[l]!, M)) put(ctx, dpr, art.whole);
    return;
  }
  // A rectangle in its texture (corners top left, top right, bottom right, bottom left): strips.
  const w = p.tx[1]!, h = p.ty[3]!;
  const rect = n === 4 && ws && p3 && Math.abs(p.tx[0]!) + Math.abs(p.ty[0]!) + Math.abs(p.ty[1]!) + Math.abs(p.tx[3]!) + Math.abs(p.tx[2]! - w) + Math.abs(p.ty[2]! - h) < 1e-6;
  if (rect && err < Infinity) {
    // Across the way it recedes: columns when its left and right edges differ on screen more than its top and bottom do, else rows.
    const lr = Math.abs(Math.hypot(xs[3]! - xs[0]!, ys[3]! - ys[0]!) - Math.hypot(xs[2]! - xs[1]!, ys[2]! - ys[1]!));
    const tb = Math.abs(Math.hypot(xs[1]! - xs[0]!, ys[1]! - ys[0]!) - Math.hypot(xs[2]! - xs[3]!, ys[2]! - ys[3]!));
    const cols = lr >= tb;
    const len = cols ? w : h;
    const k = Math.min(MAX_STRIPS, Math.ceil(len), Math.ceil(err / 0.75) + 1);
    const pc = art.whole;
    for (let i = 0; i < k; i++) {
      const a = Math.round((i * len) / k), b = Math.round(((i + 1) * len) / k);
      if (b <= a) continue;
      // The strip's top left, top right and bottom left, on screen.
      const ok = cols
        ? along(ws, 0, 1, a / w, p3, S0) && along(ws, 0, 1, b / w, p3, S1) && along(ws, 3, 2, a / w, p3, S2)
        : along(ws, 0, 3, a / h, p3, S0) && along(ws, 1, 2, a / h, p3, S1) && along(ws, 0, 3, b / h, p3, S2);
      if (!ok) continue;
      const [u0, v0, u1, v1, u2, v2] = cols ? [a, 0, b, 0, a, h] : [0, a, w, a, 0, b];
      if (!affine(u0, v0, S0.x, S0.y, u1, v1, S1.x, S1.y, u2, v2, S2.x, S2.y, M)) continue;
      // (Each strip a texel wider than its share, under the next, so no seam opens between them.)
      const more = i < k - 1 ? 1 : 0;
      const sx = cols ? a : -1, sy = cols ? -1 : a;
      const sw = cols ? b - a + more : w + 2, sh = cols ? h + 2 : b - a + more;
      put(ctx, dpr, pc, sx, sy, sw, sh);
    }
    return;
  }
  for (let t = 0; t < n - 2; t++) {
    const a = t + 1;
    const b = t + 2;
    if (affine(p.tx[0]!, p.ty[0]!, xs[0]!, ys[0]!, p.tx[a]!, p.ty[a]!, xs[a]!, ys[a]!, p.tx[b]!, p.ty[b]!, xs[b]!, ys[b]!, M)) put(ctx, dpr, art.tris[t]!);
  }
}
/** A piece through the affine `M`: nearest at 1.5 screen pixels a texel and above. */
function put(ctx: Ctx, dpr: number, pc: Piece, tx?: number, ty?: number, tw?: number, th?: number): void {
  ctx.setTransform(dpr * M[0]!, dpr * M[1]!, dpr * M[2]!, dpr * M[3]!, dpr * M[4]!, dpr * M[5]!);
  ctx.imageSmoothingEnabled = Math.sqrt(Math.abs(M[0]! * M[3]! - M[1]! * M[2]!)) < 1.5;
  // (All of it, or the texels (tx, ty, tw x th) of its texture: a strip; the piece's margin pixel round it included.)
  if (tx === undefined) ctx.drawImage(pc.cv, pc.sx, pc.sy, pc.w, pc.h, pc.sx - pc.ox, pc.sy - pc.oy, pc.w, pc.h);
  else ctx.drawImage(pc.cv, pc.ox + tx, pc.oy + ty!, tw!, th!, tx, ty!, tw!, th!);
}
