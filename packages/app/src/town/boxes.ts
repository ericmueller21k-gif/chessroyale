/**
 * The street town's buildings as boxes (Nov 5, code round 3; the art's format: town-kit.ts `TownBox`, town-art-nov5.md "The format
 * the code draws"). Eric (Nov 5, the corner screenshot): "you can clearly see the houses are flat, any way to fix?": every building
 * (the 16 homes, the everyday ones on the rows and behind them, the gardens' sheds and hedges) is a box: its front, its two side
 * walls, a back wall on three homes, its roof faces.
 *
 * This file is the geometry and the frame's plan, no canvas: where each box stands (`STREET_BOXES`), which sides a neighbour at least
 * as tall covers (skipped), each roof face's points, normal and texture frame (`geomOf`), how a face and a wall are lit (the art's
 * formula), and each frame what of a box shows and how (`planBox`: the parts' depths for the drawing order, the faces turned away
 * and the tiny ones left out, far to near, each in one piece or two triangles, the walls' strips). box-draw.ts draws the plan.
 *
 * Squares (c, r) and positions (x, y) as world.ts: x east, y north, a square's middle at whole numbers. A box's own space (the art's):
 * `u` a column of its front picture (px), `t` 0 at the front line to 1 at the back, `h` px up; 37 px a square.
 */
import { N, proj, toCam, wrapF, type Pt, type View } from "./camera.ts";
import { TOWN_FEEL } from "./feel.ts";
import { building } from "./buildings.ts";
import { HEDGE, hedgeFront, hedgeTop, shed } from "./dressing.ts";
import { homeBox, type HomeId as ArtHomeId } from "./home-boxes.ts";
import { STREET_LOTS } from "./street.ts";
import type { Face, RoofTex, SideArt, TownBox } from "./town-kit.ts";
import { frameKeys, type Character } from "../characters/sprite.ts";
import type { HomeId } from "./world.ts";

const SQ = 37;

/** What a box is: a boss's home, an everyday building on a row, a bigger one behind the rows, a garden's shed or a square of hedge. */
export type BoxKind = "home" | "house" | "tall" | "shed" | "hedge";

/** A box standing in the town. */
export interface BoxInst {
  i: number;
  kind: BoxKind;
  /** Its art, and (a home with a dome) the same with fewer faces for the 2D fallback. */
  box: TownBox;
  low: TownBox;
  /** Which way its front faces: south (onto an east-west street) or west (onto Seam Avenue). */
  facing: "S" | "W";
  /** Its front picture's left edge on its front line (world squares), the way along its front (left to right) and the way back. */
  ox: number;
  oy: number;
  ux: number;
  uy: number;
  bx: number;
  by: number;
  /** Its front line's middle (world): where its front sorts, a home's item stands, and every point is measured from. */
  fx: number;
  fy: number;
  /** A home's id (the game's), an everyday building's lot (its index in STREET_LOTS), a prop's index in PROPS (a shed, a hedge). */
  home: HomeId | null;
  lot: number;
  prop: number;
  /** Its left and right sides, covered by a neighbour at least as tall: never drawn. */
  hideL: boolean;
  hideR: boolean;
  /** A tile for every roof face in place of the face's own (a hedge's top: dressing.ts hedgeTop). */
  tile: Character | null;
}

/** Where a picture `w` px wide stands, centred on (cx, cy) along its front line facing `facing`. */
function place(facing: "S" | "W", cx: number, cy: number, w: number) {
  return facing === "S" ? { ox: cx - w / SQ / 2, oy: cy, ux: 1, uy: 0, bx: 0, by: 1 } : { ox: cx, oy: cy + w / SQ / 2, ux: 0, uy: -1, bx: 1, by: 0 };
}

/** A hedge's square as a box: its front (a plane facing the street) and its top (one face, its own tile). */
const hedgeBoxes = new Map<number, TownBox>();
function hedgeBox(v: number): TownBox {
  let b = hedgeBoxes.get(v);
  if (!b) {
    const front = hedgeFront(v);
    b = {
      id: `hedge-${v}`, front, lights: [], lot: { w: 1, d: 1 }, inset: 0, depth: HEDGE.deep, body: { x0: 0, x1: SQ }, left: null, right: null,
      roof: [{ pts: [[0, 0, HEDGE.tall], [SQ, 0, HEDGE.tall], [SQ, 1, HEDGE.tall], [0, 1, HEDGE.tall]], tex: "hedge", rows: "u", soft: true }],
      roofPal: hedgeTop(v).palette, taper: 1,
    };
    hedgeBoxes.set(v, b);
  }
  return b;
}

/** The game's id for the art's home id ("blitz" is Dash's). */
const gameHome = (id: string): HomeId => (id === "blitz" ? "dash" : id) as HomeId;

/**
 * Every box in the street town: the lots (homes and everyday buildings, as the plan has them), then the sheds and the hedges among
 * `props` (world.ts PROPS, by index). Their sides a neighbour covers are marked.
 */
export function streetBoxes(props: readonly { kind: string; x: number; y: number; v: number }[]): BoxInst[] {
  const out: BoxInst[] = [];
  const add = (kind: BoxKind, box: TownBox, low: TownBox, facing: "S" | "W", cx: number, cy: number, extra: Partial<BoxInst>) => {
    const p = place(facing, cx, cy, box.front.w);
    out.push({ i: out.length, kind, box, low, facing, ...p, fx: 0, fy: 0, home: null, lot: -1, prop: -1, hideL: false, hideR: false, tile: null, ...extra });
  };
  STREET_LOTS.forEach((l, lot) => {
    const box = l.kind === "home" ? homeBox(l.id as ArtHomeId) : building(l.id as never, l.w, l.v);
    const low = l.kind === "home" ? homeBox(l.id as ArtHomeId, true) : box;
    // (Its front line: the lot's front edge plus the box's inset; its picture centred on the lot.)
    if (l.facing === "S") add(l.kind, box, low, "S", l.c0 + l.w / 2 - 0.5, l.r0 - 0.5 + box.inset, { lot, home: l.kind === "home" ? gameHome(l.id) : null });
    else add(l.kind, box, low, "W", l.c0 - 0.5 + box.inset, l.r0 + l.w / 2 - 0.5, { lot, home: null });
  });
  props.forEach((pr, prop) => {
    if (pr.kind === "shed") {
      const b = shed(pr.v);
      add("shed", b, b, "S", pr.x, pr.y - 0.4, { prop });
    } else if (pr.kind === "hedge") {
      const b = hedgeBox(pr.v);
      const tile = hedgeTop(pr.v);
      // (A hedge's x, y is the back of its top. One running east to west faces the street south of it; one along Seam Avenue, north
      // to south (a half square's x), faces west.)
      if (pr.x === Math.round(pr.x)) add("hedge", b, b, "S", pr.x, pr.y - HEDGE.deep, { prop, tile });
      else add("hedge", b, b, "W", pr.x - HEDGE.deep, pr.y, { prop, tile });
    }
  });
  for (const b of out) {
    // (W-facing: the front's middle is the line's middle too.)
    b.fx = b.ox + (b.ux * b.box.front.w) / SQ / 2;
    b.fy = b.oy + (b.uy * b.box.front.w) / SQ / 2;
  }
  coverSides(out);
  return out;
}

/** World point of a box's own (u, t): into `out` (squares, not wrapped). */
export function boxPoint(b: BoxInst, box: TownBox, u: number, t: number, out: { x: number; y: number }): void {
  const cxp = (box.body.x0 + box.body.x1) / 2;
  const lx = cxp + (u - cxp) * (1 - t * (1 - box.taper));
  const ly = t * box.depth * SQ;
  out.x = b.ox + (b.ux * lx + b.bx * ly) / SQ;
  out.y = b.oy + (b.uy * lx + b.by * ly) / SQ;
}

/** A side's eave (px): its picture's height less the ink row. */
const eaveOf = (s: SideArt | null): number => (s ? s.ch.h - 1 : 0);

/**
 * Skips each side a neighbour at least as tall covers (the art: "a side tucked against a neighbour at least as tall is covered by that
 * neighbour's front. Better still, skip it: the plan knows the neighbours"): a box facing the same way, whose facing wall stands within
 * a third of a square of it, runs from no further back at the front to no nearer at the back, and is at least as tall.
 */
export function coverSides(boxes: BoxInst[]): void {
  const a = { x: 0, y: 0 };
  const b = { x: 0, y: 0 };
  // A side's line: where along the front (squares, along u) it stands, and its front and back (squares, along the way back).
  const line = (o: BoxInst, right: boolean) => {
    const B = o.box;
    const u = right ? B.body.x1 : B.body.x0;
    boxPoint(o, B, u, 0, a);
    boxPoint(o, B, u, 1, b);
    // Along the front and back, measured on the world's axes for its facing.
    const along = (p: { x: number; y: number }) => p.x * o.ux + p.y * o.uy;
    const back = (p: { x: number; y: number }) => p.x * o.bx + p.y * o.by;
    return { at: along(a), front: back(a), back: back(b), tall: eaveOf(right ? B.right : B.left) };
  };
  for (const o of boxes) {
    if (o.kind === "hedge") continue;
    for (const right of [false, true]) {
      const side = right ? o.box.right : o.box.left;
      if (!side) continue;
      const me = line(o, right);
      for (const n of boxes) {
        if (n === o || n.kind === "hedge" || n.facing !== o.facing) continue;
        const theirs = right ? n.box.left : n.box.right;
        if (!theirs) continue;
        const them = line(n, !right);
        // (The same street line: their backs' axes agree; the neighbour on the side this wall faces, within a third of a square.)
        const gap = right ? wrapF(them.at - me.at) : wrapF(me.at - them.at);
        if (gap < -0.05 || gap > 0.34) continue;
        if (Math.abs(wrapF(them.front - me.front)) > 1.5) continue;
        if (wrapF(them.front - me.front) > 0.05 || wrapF(them.back - me.back) < -0.05 || them.tall < me.tall) continue;
        if (right) o.hideR = true;
        else o.hideL = true;
      }
    }
  }
}

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
const geoms = new WeakMap<TownBox, BoxGeom>();
export function geomOf(box: TownBox): BoxGeom {
  let g = geoms.get(box);
  if (g) return g;
  const cxp = (box.body.x0 + box.body.x1) / 2;
  const D = box.depth * SQ;
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
/**
 * A wall's shade (0: none; the art: a side turned to the screen's left 6%, one turned right 30%): by how far its normal (world: east,
 * north) is turned from facing the camera, so a front facing the camera has none and a wall turns smoothly from one to the other.
 */
export function wallShade(nx: number, ny: number, hc: number, hs: number): number {
  const cx = nx * hc - ny * hs;
  return cx > 0 ? 0.3 * cx : -0.06 * cx;
}
/** A box's normal (its own frame: along its front, back, up) in the world's (east, north). */
export const worldNormal = (b: BoxInst, nx: number, ny: number, out: { x: number; y: number }) => {
  out.x = b.ux * nx + b.bx * ny;
  out.y = b.uy * nx + b.by * ny;
};

// ---- The frame's plan.

/** A wall this frame: its foot's two ends on screen (x, y, k at its picture's left and right edges), its depth, strips, shade. */
export interface WallPlan {
  on: boolean;
  x0: number;
  y0: number;
  k0: number;
  x1: number;
  y1: number;
  k1: number;
  /** The camera-frame offset of its middle (across, ahead): its place in the drawing order, its fade. */
  dx: number;
  dz: number;
  strips: number;
  shade: number;
}
/** A roof face this frame: on screen (its corners' x, y), its depth, in one piece or in triangles. */
export interface FacePlan {
  on: boolean;
  x: Float64Array;
  y: Float64Array;
  dz: number;
  whole: boolean;
}
export interface BoxPlan {
  /** Anything of it drawn this frame. */
  on: boolean;
  front: WallPlan;
  left: WallPlan;
  right: WallPlan;
  back: WallPlan;
  faces: FacePlan[];
  /** The faces drawn, far to near (indices into faces), and how many. */
  order: Int16Array;
  nOrder: number;
  /** The roof's place in the drawing order (its middle, a hair nearer than the sides so it's drawn over them), its middle's offset. */
  roofDx: number;
  roofDz: number;
  /** How the roof's faces are lit (the camera's heading turns the light), and each wall's shade, this frame. */
  light: Float64Array;
  /** The box's highest point on screen (its roof's, or its front's top) and its eave's (where a home's name may drop to); its box. */
  topY: number;
  eaveY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Draws this frame (strips and faces: what the 2D fallback costs). */
  draws: number;
}
const newWall = (): WallPlan => ({ on: false, x0: 0, y0: 0, k0: 0, x1: 0, y1: 0, k1: 0, dx: 0, dz: 0, strips: 1, shade: 0 });
export function newPlan(box: TownBox): BoxPlan {
  const n = Math.max(geomOf(box).faces.length, 1);
  return {
    on: false, front: newWall(), left: newWall(), right: newWall(), back: newWall(),
    faces: Array.from({ length: n }, () => ({ on: false, x: new Float64Array(4), y: new Float64Array(4), dz: 0, whole: false })),
    order: new Int16Array(n), nOrder: 0, roofDx: 0, roofDz: 0, light: new Float64Array(n),
    topY: 0, eaveY: 0, minX: 0, maxX: 0, minY: 0, maxY: 0, draws: 0,
  };
}

const pa: Pt = { x: 0, y: 0, k: 0, depth: 0 };
const pb: Pt = { x: 0, y: 0, k: 0, depth: 0 };
const wp = { x: 0, y: 0 };
const cq = { dx: 0, dz: 0 };
const nw = { x: 0, y: 0 };
const fdz = new Float64Array(64);
// (The box being planned: module state, so planning a frame allocates nothing.)
let P: BoxPlan;
let BI: BoxInst;
let BX: TownBox;
let V: View;
let offX = 0;
let offY = 0;
let FINE = false;
let CUT = 0;
/** A world point of the box being planned into the camera's frame (`cq`). */
const atCam = (x: number, y: number) => toCam(V, x + offX, y + offY, cq);
function grow(x: number, y: number): void {
  if (x < P.minX) P.minX = x;
  if (x > P.maxX) P.maxX = x;
  if (y < P.minY) P.minY = y;
  if (y > P.maxY) P.maxY = y;
}
/** A wall of the box being planned: its foot from (u0, t0) to (u1, t1) in its own space, its picture `ch`, its normal (its own frame). */
function planWall(w: WallPlan, ch: Character | null, u0: number, t0: number, u1: number, t1: number, nbx: number, nby: number, extraShade: number): void {
  w.on = false;
  if (!ch) return;
  const v = V;
  boxPoint(BI, BX, u0, t0, wp);
  atCam(wp.x, wp.y);
  const ax = cq.dx;
  const az = cq.dz;
  boxPoint(BI, BX, u1, t1, wp);
  atCam(wp.x, wp.y);
  w.dx = (ax + cq.dx) / 2;
  w.dz = (az + cq.dz) / 2;
  if (Math.max(az, cq.dz) < CUT) return;
  if (!proj(v, ax, az, 0, pa) || !proj(v, cq.dx, cq.dz, 0, pb)) return;
  // Seen from the front only: its picture runs left to right on screen.
  if (pb.x - pa.x < 0.5) return;
  const h0 = (ch.h * pa.k) / SQ;
  const h1 = (ch.h * pb.k) / SQ;
  if (pa.x > v.W + 2 || pb.x < -2 || Math.min(pa.y - h0, pb.y - h1) > v.H || Math.max(pa.y, pb.y) < 0) return;
  w.x0 = pa.x;
  w.y0 = pa.y;
  w.k0 = pa.k;
  w.x1 = pb.x;
  w.y1 = pb.y;
  w.k1 = pb.k;
  // Strips: each a step in its top of about `boxStrip` px at most (fine: WebGL's; else the 2D fallback's), and at least 2 px wide.
  const f = TOWN_FEEL;
  const dh = Math.abs(h1 - h0);
  w.strips = dh < 0.75 ? 1 : Math.max(1, Math.min(FINE ? f.boxStripsFine : f.boxStrips, Math.ceil(dh / (FINE ? f.boxStripFine : f.boxStrip)), Math.ceil((pb.x - pa.x) / 2)));
  worldNormal(BI, nbx, nby, nw);
  w.shade = Math.min(0.6, wallShade(nw.x, nw.y, v.hc, v.hs) + extraShade);
  w.on = true;
  P.on = true;
  P.draws += w.strips;
  grow(pa.x, pa.y);
  grow(pb.x, pb.y);
  grow(pa.x, pa.y - h0);
  grow(pb.x, pb.y - h1);
}

/**
 * What of box `b` (its art `box`: `b.box`, or `b.low` on the 2D fallback) shows this frame from the camera `v` focused on (camX, camY),
 * and how, into `p`. `fine`: walls in fine strips (WebGL, where a strip costs a few vertices) or coarse ones (the 2D fallback, where
 * each is a draw). `cut`: nothing nearer than this (camera-frame squares ahead) is drawn (the near side: nothing between the camera
 * and you). Allocates nothing.
 */
export function planBox(p: BoxPlan, b: BoxInst, box: TownBox, v: View, camX: number, camY: number, fine: boolean, cut: number): void {
  const g = geomOf(box);
  P = p;
  BI = b;
  BX = box;
  V = v;
  FINE = fine;
  CUT = cut;
  // Every point from the camera, the nearest way round the wrap from the box's front line's middle.
  offX = wrapF(b.fx - camX) - b.fx;
  offY = wrapF(b.fy - camY) - b.fy;
  p.on = false;
  p.draws = 0;
  p.minX = p.minY = Infinity;
  p.maxX = p.maxY = -Infinity;
  p.topY = Infinity;
  p.eaveY = Infinity;
  const B = box;
  const x0 = B.body.x0;
  const x1 = B.body.x1;
  // The front (its whole picture, fences and signs too), the sides from the body's edges, the back.
  planWall(p.front, B.front, 0, 0, B.front.w, 0, 0, -1, 0);
  planWall(p.left, b.hideL ? null : (B.left?.ch ?? null), x0, 1, x0, 0, -1, 0, 0);
  planWall(p.right, b.hideR ? null : (B.right?.ch ?? null), x1, 0, x1, 1, 1, 0, 0);
  planWall(p.back, B.back?.ch ?? null, x0, 1, x1, 1, 0, -1, 0.18);
  // The roof's place in the order: its middle, a hair nearer than the sides' (drawn over them).
  boxPoint(b, box, (x0 + x1) / 2, 0.5, wp);
  atCam(wp.x, wp.y);
  p.roofDx = cq.dx;
  p.roofDz = cq.dz - 0.001;
  let nOrd = 0;
  const faces = g.faces;
  const f = TOWN_FEEL;
  for (let i = 0; i < faces.length; i++) {
    const fg = faces[i]!;
    const fp = p.faces[i]!;
    fp.on = false;
    // Turned away from the camera (its outward normal; the camera stands `back` behind its focus, `h` up)?
    worldNormal(b, fg.nx, fg.ny, nw);
    const ncx = nw.x * v.hc - nw.y * v.hs;
    const ncz = nw.x * v.hs + nw.y * v.hc;
    boxPoint(b, box, fg.u[0]!, fg.t[0]!, wp);
    atCam(wp.x, wp.y);
    if (-cq.dx * ncx + (-v.back - cq.dz) * ncz + (v.h - fg.h[0]! / SQ) * fg.nz <= 0) continue;
    // Its corners on screen (a point h px up drawn h k / 37 over its foot), its nearest depth.
    let ok = true;
    let x0s = Infinity;
    let x1s = -Infinity;
    let y0s = Infinity;
    let y1s = -Infinity;
    let dzMin = Infinity;
    for (let k = 0; k < fg.n; k++) {
      boxPoint(b, box, fg.u[k]!, fg.t[k]!, wp);
      atCam(wp.x, wp.y);
      if (!proj(v, cq.dx, cq.dz, 0, pa)) {
        ok = false;
        break;
      }
      if (cq.dz < dzMin) dzMin = cq.dz;
      const x = pa.x;
      const y = pa.y - (fg.h[k]! * pa.k) / SQ;
      fp.x[k] = x;
      fp.y[k] = y;
      if (x < x0s) x0s = x;
      if (x > x1s) x1s = x;
      if (y < y0s) y0s = y;
      if (y > y1s) y1s = y;
    }
    if (!ok || dzMin < cut) continue;
    if (x1s < 0 || x0s > v.W || y1s < 0 || y0s > v.H) continue;
    // Tiny on screen (a tank's leg from afar): left out.
    if (Math.min(x1s - x0s, y1s - y0s) < f.boxTinyPx && Math.max(x1s - x0s, y1s - y0s) < 4 * f.boxTinyPx) continue;
    boxPoint(b, box, fg.cu, fg.ct, wp);
    atCam(wp.x, wp.y);
    fp.dz = cq.dz;
    // In one piece when the affine through its first, second and last corners puts a quad's third within a pixel of where it is.
    fp.whole = fg.n === 3 || wholeFits(fg, fp) < f.boxWholePx;
    fp.on = true;
    p.light[i] = faceLight(nw.x, nw.y, fg.nz, v.hc, v.hs);
    fdz[nOrd] = fp.dz;
    p.order[nOrd++] = i;
    p.draws += fp.whole ? 1 : fg.n - 2;
    grow(x0s, y0s);
    grow(x1s, y1s);
    if (y0s < p.topY) p.topY = y0s;
  }
  // Far to near (a few faces: insertion).
  for (let a = 1; a < nOrd; a++) {
    const o = p.order[a]!;
    const d = fdz[a]!;
    let j = a - 1;
    while (j >= 0 && fdz[j]! < d) {
      p.order[j + 1] = p.order[j]!;
      fdz[j + 1] = fdz[j]!;
      j--;
    }
    p.order[j + 1] = o;
    fdz[j + 1] = d;
  }
  p.nOrder = nOrd;
  if (nOrd) p.on = true;
  // Its top and its eave on screen, over its front line's middle: the front's solid top (or the roof's, higher), its eave.
  if (p.front.on) {
    const k = (p.front.k0 + p.front.k1) / 2 / SQ;
    const fy = (p.front.y0 + p.front.y1) / 2;
    p.topY = Math.min(p.topY, fy - solidTop(B) * k);
    const eave = Math.max(eaveOf(B.left), eaveOf(B.right)) || minFrontRoof(g);
    p.eaveY = fy - Math.min(eave, solidTop(B)) * k;
  }
}

/**
 * How tall a box's front stands (px over its foot), not counting thin things over it (a chimney's smoke, a flag): its first row from the
 * top whose drawn pixels span a fifth of its body (first frame). Worked out once a picture.
 */
const solidTops = new WeakMap<TownBox, number>();
export function solidTop(box: TownBox): number {
  let t = solidTops.get(box);
  if (t === undefined) {
    const ch = box.front;
    const rows = frameKeys(ch, ch.anims.idle!.frames[0]!);
    const need = Math.max(4, 0.2 * (box.body.x1 - box.body.x0));
    t = 0;
    for (let y = 0; y < ch.h; y++) {
      let n = 0;
      for (let x = box.body.x0; x <= box.body.x1; x++) if (rows[y]?.[x]) n++;
      if (n >= need) {
        t = ch.foot[1] - y;
        break;
      }
    }
    solidTops.set(box, t);
  }
  return t;
}

/** The lowest height (px) a roof face reaches on the front line (the eave of a box with no side walls). */
function minFrontRoof(g: BoxGeom): number {
  let m = Infinity;
  for (const fg of g.faces) for (let k = 0; k < fg.n; k++) if (fg.t[k]! < 0.05) m = Math.min(m, fg.h[k]!);
  return m === Infinity ? 0 : m;
}

/** How far (px) a quad's third corner lands from where the affine through its other three puts it. */
export function wholeFits(fg: FaceGeom, fp: FacePlan): number {
  if (fg.n !== 4) return 0;
  const m = affine(fg.tx[0]!, fg.ty[0]!, fp.x[0]!, fp.y[0]!, fg.tx[1]!, fg.ty[1]!, fp.x[1]!, fp.y[1]!, fg.tx[3]!, fg.ty[3]!, fp.x[3]!, fp.y[3]!, AF);
  if (!m) return Infinity;
  const X = AF[0]! * fg.tx[2]! + AF[2]! * fg.ty[2]! + AF[4]!;
  const Y = AF[1]! * fg.tx[2]! + AF[3]! * fg.ty[2]! + AF[5]!;
  return Math.hypot(X - fp.x[2]!, Y - fp.y[2]!);
}
const AF = new Float64Array(6);

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

/** (Tests) Squares in the world: N. */
export const WORLD = N;
