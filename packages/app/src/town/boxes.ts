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
import { N, proj, toCam, wrapF, wrapFX, wrapFY, type Pt, type View } from "./camera.ts";
import { TOWN_FEEL } from "./feel.ts";
import { building } from "./buildings.ts";
import { HEDGE, hedgeFront, hedgeTop, shed } from "./dressing.ts";
import { homeBox, type HomeId as ArtHomeId } from "./home-boxes.ts";
import { STREET_LOTS, type StreetLot } from "./street.ts";
import { lookalike } from "./lookalike.ts";
import { wallArt } from "./wall.ts";
import { PORTAL_BOX, ringBox } from "./houses/coliseum-ring.ts";
import { homePx, type Facing } from "./rows.ts";
import { RING_PX, WALL_H } from "./houses/coliseum-shape.ts";
import type { Face, RoofTex, SideArt, TownBox } from "./town-kit.ts";
import { frameKeys, type Character } from "../characters/sprite.ts";
import type { HomeId } from "./world.ts";
import { affine, DARK_SIDE, lightStep, type Step } from "./kit/prims.ts";
import { DARK_SHADE, faceLight, faceStep, geomOf, pxOf, SQ, wallShade, worldNormal, type BoxGeom, type FaceGeom } from "./box-geom.ts";

export { affine };


/** What a box is: a boss's home, an everyday building on a row, a bigger one behind the rows, a garden's shed or a square of hedge. */
/** (The north edge round: a stretch of the Colosseum's ring, and its portal, the Colosseum's own box.) */
export type BoxKind = "home" | "house" | "tall" | "wall" | "ring" | "portal" | "shed" | "hedge";

/** A box standing in the town. */
export interface BoxInst {
  i: number;
  kind: BoxKind;
  /** Its art. */
  box: TownBox;
  /** Which way its front faces: south or north (onto an east-west street), west or east (onto Seam Avenue). */
  facing: Facing;
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
  /** A home's id (the game's; the Colosseum's portal: "coliseum"), an everyday building's lot (its index in STREET_LOTS), a prop's index in PROPS (a shed, a hedge). */
  home: HomeId | "coliseum" | null;
  lot: number;
  prop: number;
  /** Its left and right sides, covered by a neighbour at least as tall: never drawn. */
  hideL: boolean;
  hideR: boolean;
  /** A tile for every roof face in place of the face's own (a hedge's top: dressing.ts hedgeTop, a run's side by side). */
  tile: Character | null;
  /** A run of hedge: every prop it stands for (the first, `prop`, draws it). */
  props: number[];
  /**
   * (Nov 6) Drawn even where the rows hide it (render.ts's culling): a front of the row back to back behind a home with no side walls (a
   * dome or a slope to the ground: Ginger's igloo, Hollow's peak). Seen past the home's curve from along its street, it fills what would
   * otherwise show sky.
   */
  open?: boolean;
}

/**
 * Where a picture `w` px wide stands, centred on (cx, cy) along its front line facing `facing`: its left edge, the way along it (left to
 * right as you face it) and the way back.
 */
function place(facing: Facing, cx: number, cy: number, w: number, px: number) {
  const h = w / px / 2;
  if (facing === "S") return { ox: cx - h, oy: cy, ux: 1, uy: 0, bx: 0, by: 1 };
  if (facing === "N") return { ox: cx + h, oy: cy, ux: -1, uy: 0, bx: 0, by: -1 };
  if (facing === "W") return { ox: cx, oy: cy + h, ux: 0, uy: -1, bx: 1, by: 0 };
  return { ox: cx, oy: cy - h, ux: 0, uy: 1, bx: -1, by: 0 };
}

export { pxOf };
/** The street town's buildings' pixels a square (drawn TOWN_FEEL.streetBuildScale bigger than the art's 37). */
export const BUILD_PX = SQ / TOWN_FEEL.streetBuildScale;
/** An art drawn bigger (its own copy, so the art's caches stay the art's). */
const bigger = new WeakMap<TownBox, TownBox>();
function big(box: TownBox, px = BUILD_PX): TownBox {
  if (box.px === px) return box;
  let b = bigger.get(box);
  if (!b || b.px !== px) bigger.set(box, (b = { ...box, px }));
  return b;
}
/** A home's back seen from behind (round 4): its own side wall's picture across its body (a home with a `back` keeps that). */
const rears = new WeakMap<TownBox, TownBox>();
function withRear(box: TownBox): TownBox {
  if (box.back || box.rear || !(box.left ?? box.right)) return box;
  let b = rears.get(box);
  if (!b) rears.set(box, (b = { ...box, rear: box.left ?? box.right! }));
  return b;
}
/** A lot's building as a box: a home's, an everyday design's, or a row's look-alike (round 4), drawn the street town's bigger size. */
export function lotArt(l: StreetLot): TownBox {
  // (A home: drawn bigger again where the street town asks, round 6: rows.ts homePx.)
  if (l.kind === "home") return big(withRear(homeBox(l.id as ArtHomeId)), homePx(l.id as ArtHomeId));
  if (l.look) return big(lookalike(l.look));
  if (l.wall) return wallArt(l.wall);
  if (l.ring !== undefined) return ringBox(l.ring);
  if (l.kind === "portal") return PORTAL_BOX;
  return big(building(l.id as never, l.w, l.v));
}

/** Pictures side by side, in one picture (a run of hedge's squares): each one's parts, moved along. */
function sideBySide(id: string, chs: Character[]): Character {
  const parts: Record<string, Character["parts"][string]> = {};
  const layers: { part: string; x: number; y: number }[] = [];
  chs.forEach((ch, k) => {
    for (const l of ch.anims.idle!.frames[0]!.layers) {
      parts[`s${k}${l.part}`] = ch.parts[l.part]!;
      layers.push({ part: `s${k}${l.part}`, x: l.x + k * SQ, y: l.y });
    }
  });
  const h = chs[0]!;
  return { ...h, id, name: id, w: SQ * chs.length, parts, anims: { idle: { frames: [{ layers, ms: 1000 }], loop: true } } };
}
/**
 * A run of hedge (its squares' flowers `vs`, in order along its front) as one box: its front (a plane facing the street) and its top
 * (one face, its squares' own tiles side by side). A run is drawn in two pieces, not two a square (Nov 5, round 3: a frame's cost).
 */
const hedgeBoxes = new Map<string, { box: TownBox; tile: Character }>();
function hedgeRun(vs: number[]): { box: TownBox; tile: Character } {
  const key = vs.join("");
  let r = hedgeBoxes.get(key);
  if (!r) {
    const W = SQ * vs.length;
    const front = sideBySide(`hedge-${key}`, vs.map((v) => hedgeFront(v)));
    const tile = sideBySide(`hedge-top-${key}`, vs.map((v) => hedgeTop(v)));
    const box: TownBox = {
      id: `hedge-${key}`, front, lights: [], lot: { w: vs.length, d: 1 }, inset: 0, depth: HEDGE.deep, body: { x0: 0, x1: W }, left: null, right: null,
      roof: [{ pts: [[0, 0, HEDGE.tall], [W, 0, HEDGE.tall], [W, 1, HEDGE.tall], [0, 1, HEDGE.tall]], tex: "hedge", rows: "u", soft: true }],
      roofPal: tile.palette, taper: 1,
    };
    hedgeBoxes.set(key, (r = { box, tile }));
  }
  return r;
}
/** The longest run of hedge drawn as one (squares): longer ones split, so each sorts near its own depth. */
const HEDGE_RUN = 5;

/** The game's id for the art's home id ("blitz" is Dash's). */
const gameHome = (id: string): HomeId => (id === "blitz" ? "dash" : id) as HomeId;

/**
 * Every box in the street town: the lots (homes and everyday buildings, as the plan has them), then the sheds and the hedges among
 * `props` (world.ts PROPS, by index). Their sides a neighbour covers are marked.
 */
export function streetBoxes(props: readonly { kind: string; x: number; y: number; v: number }[]): BoxInst[] {
  const out: BoxInst[] = [];
  const add = (kind: BoxKind, box: TownBox, facing: Facing, cx: number, cy: number, extra: Partial<BoxInst>) => {
    const p = place(facing, cx, cy, box.front.w, pxOf(box));
    out.push({ i: out.length, kind, box, facing, ...p, fx: 0, fy: 0, home: null, lot: -1, prop: -1, hideL: false, hideR: false, tile: null, props: [], ...extra });
  };
  STREET_LOTS.forEach((l, lot) => {
    const box = lotArt(l);
    // (Its front line: the lot's front edge plus the box's inset; its picture centered on the lot. A row's look-alike: where the row put it.
    // A stretch of the Colosseum's ring: facing out from the oval, its front's middle where the ring has it.)
    if (l.dir && l.at) {
      const h = box.front.w / pxOf(box) / 2;
      out.push({ i: out.length, kind: l.kind, box, facing: l.facing, ox: l.at.x - l.dir.ux * h, oy: l.at.y - l.dir.uy * h, ux: l.dir.ux, uy: l.dir.uy, bx: -l.dir.uy, by: l.dir.ux, fx: 0, fy: 0, home: null, lot, prop: -1, hideL: false, hideR: false, tile: null, props: [] });
    } else if (l.kind === "portal" && l.at) add(l.kind, box, "S", l.at.x, l.at.y, { lot, home: "coliseum" });
    else if (l.at) add(l.kind, box, l.facing, l.at.x, l.at.y, { lot, home: null });
    else if (l.facing === "S") add(l.kind, box, "S", l.c0 + l.w / 2 - 0.5 + (l.shift ?? 0), l.r0 - 0.5 + box.inset, { lot, home: l.kind === "home" ? gameHome(l.id) : null });
    else add(l.kind, box, "W", l.c0 - 0.5 + box.inset, l.r0 + l.w / 2 - 0.5, { lot, home: null });
  });
  props.forEach((pr, prop) => {
    if (pr.kind === "shed") {
      const b = shed(pr.v);
      add("shed", b, "S", pr.x, pr.y - 0.4, { prop });
    }
  });
  // The hedges, in runs along their lines (a hedge's x, y is the back of its top; one running east to west faces the street south of
  // it, one along Seam Avenue, north to south (a half square's x), faces west): squares side by side, up to HEDGE_RUN a run.
  const hedges = props.map((pr, i) => ({ pr, i })).filter((h) => h.pr.kind === "hedge");
  const ew = hedges.filter((h) => h.pr.x === Math.round(h.pr.x)).sort((a, b) => a.pr.y - b.pr.y || a.pr.x - b.pr.x);
  const ns = hedges.filter((h) => h.pr.x !== Math.round(h.pr.x)).sort((a, b) => a.pr.x - b.pr.x || b.pr.y - a.pr.y);
  const runs = (list: typeof hedges, next: (a: (typeof hedges)[number]["pr"], b: (typeof hedges)[number]["pr"]) => boolean) => {
    const out2: (typeof hedges)[] = [];
    for (const h of list) {
      const last = out2[out2.length - 1];
      if (last && last.length < HEDGE_RUN && next(last[last.length - 1]!.pr, h.pr)) last.push(h);
      else out2.push([h]);
    }
    return out2;
  };
  for (const run of runs(ew, (a, b) => a.y === b.y && b.x === a.x + 1)) {
    const { box, tile } = hedgeRun(run.map((h) => h.pr.v));
    const a = run[0]!.pr;
    const z = run[run.length - 1]!.pr;
    add("hedge", box, "S", (a.x + z.x) / 2, a.y - HEDGE.deep, { prop: run[0]!.i, props: run.map((h) => h.i), tile });
  }
  for (const run of runs(ns, (a, b) => a.x === b.x && b.y === a.y - 1)) {
    const { box, tile } = hedgeRun(run.map((h) => h.pr.v));
    const a = run[0]!.pr;
    const z = run[run.length - 1]!.pr;
    add("hedge", box, "W", a.x - HEDGE.deep, (a.y + z.y) / 2, { prop: run[0]!.i, props: run.map((h) => h.i), tile });
  }
  for (const b of out) {
    // (W-facing: the front's middle is the line's middle too.)
    b.fx = b.ox + (b.ux * b.box.front.w) / pxOf(b.box) / 2;
    b.fy = b.oy + (b.uy * b.box.front.w) / pxOf(b.box) / 2;
  }
  coverSides(out);
  openBehind(out);
  return out;
}

/** Marks the fronts standing back to back behind a home with no side walls (BoxInst.open). */
function openBehind(boxes: BoxInst[]): void {
  const a = { x: 0, y: 0 };
  // (Its front's span east-west, measured from the home's front's middle the short way round the wrap.)
  const span = (o: BoxInst, from: number): [number, number] => {
    boxPoint(o, o.box, 0, 0, a);
    const s0 = wrapF(a.x - from);
    boxPoint(o, o.box, o.box.front.w, 0, a);
    const s1 = wrapF(a.x - from);
    return [Math.min(s0, s1), Math.max(s0, s1)];
  };
  for (const h of boxes) {
    if (h.kind !== "home" || h.box.left || h.box.right || h.facing !== "S") continue;
    const [h0, h1] = span(h, h.fx);
    for (const b of boxes) {
      // (Facing the other way, its front line within the home's block behind it, along the same stretch.)
      if (b.kind !== "house" || b.facing !== "N" || b.fy <= h.fy || b.fy - h.fy > 3.5 || Math.abs(wrapF(b.fx - h.fx)) > 8) continue;
      const [b0, b1] = span(b, h.fx);
      if (Math.min(b1, h1 + 1) > Math.max(b0, h0 - 1)) b.open = true;
    }
  }
}

/** World point of a box's own (u, t): into `out` (squares, not wrapped). */
export function boxPoint(b: BoxInst, box: TownBox, u: number, t: number, out: { x: number; y: number }): void {
  const cxp = (box.body.x0 + box.body.x1) / 2;
  const lx = cxp + (u - cxp) * (1 - t * (1 - box.taper));
  const px = pxOf(box);
  const ly = t * box.depth * px;
  out.x = b.ox + (b.ux * lx + b.bx * ly) / px;
  out.y = b.oy + (b.uy * lx + b.by * ly) / px;
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
        // (Round 4's rows overlap a neighbour by a pixel or two each (rows.ts ROW_OVERLAP_PX): up to a tenth of a square under it.)
        if (gap < -0.1 || gap > 0.34) continue;
        if (Math.abs(wrapF(them.front - me.front)) > 1.5) continue;
        if (wrapF(them.front - me.front) > 0.05 || wrapF(them.back - me.back) < -0.05 || them.tall < me.tall) continue;
        if (right) o.hideR = true;
        else o.hideL = true;
      }
    }
  }
}

// ---- The roof faces' geometry and the light: box-geom.ts (Nov 23: on their own, so the paint workers load them without the town's art).
export { DARK_SHADE, faceLight, faceStep, geomOf, wallShade, worldNormal, type BoxGeom, type FaceGeom } from "./box-geom.ts";

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
  /** Its light: the base, or one ramp step darker (a side turned right, `DARK_SHADE`). */
  step: Step;
  /** The part of its picture drawn (0..1 along it): all of it, or (a wall running past the camera, the chase camera's rows) only what's in front of it. */
  s0: number;
  s1: number;
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
}
const newWall = (): WallPlan => ({ on: false, x0: 0, y0: 0, k0: 0, x1: 0, y1: 0, k1: 0, dx: 0, dz: 0, strips: 1, shade: 0, step: 0, s0: 0, s1: 1 });
/** A wall is cut this far (squares) in front of the camera: what's nearer (or behind it) isn't drawn. */
const NEAR = 0.6;
export function newPlan(box: TownBox): BoxPlan {
  const n = Math.max(geomOf(box).faces.length, 1);
  return {
    on: false, front: newWall(), left: newWall(), right: newWall(), back: newWall(),
    faces: Array.from({ length: n }, () => ({ on: false, x: new Float64Array(4), y: new Float64Array(4), dz: 0, whole: false })),
    order: new Int16Array(n), nOrder: 0, roofDx: 0, roofDz: 0, light: new Float64Array(n),
    topY: 0, eaveY: 0, minX: 0, maxX: 0, minY: 0, maxY: 0,
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
// (The box being planned's offsets and near cut: 0, 1 and 2. In a typed array, not module `let`s, Nov 27: a module variable holding a
// fraction is a new boxed number each time it's set, three a box a frame, a few hundred boxes: much of walking's garbage.)
const OFF = new Float64Array(3);
/** A world point of the box being planned into the camera's frame (`cq`). */
const atCam = (x: number, y: number) => toCam(V, x + OFF[0]!, y + OFF[1]!, cq);
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
  if (Math.max(az, cq.dz) < OFF[2]!) return;
  // (A wall running past the camera, a row's beside you: only its part in front of the camera, cut where it passes the near plane.)
  let bx = cq.dx;
  let bz = cq.dz;
  let ax2 = ax;
  let az2 = az;
  // (The Colosseum's ring and portal, the north edge round: cut nearer, as near as the projection holds (a hair over 0.5 deep at the
  // ground), so a stretch you stand beside on the plaza, looking along it, runs on to the box's edge: no gap into the ring.)
  const solid = BI.kind === "ring" || BI.kind === "portal";
  const zn = (solid ? Math.max(0.05, (0.56 - v.h * v.sn) / v.cs) : NEAR) - v.back;
  w.s0 = 0;
  w.s1 = 1;
  if (az2 < zn && bz < zn) return;
  if (az2 < zn) {
    const s = (zn - az) / (bz - az);
    w.s0 = s;
    ax2 = ax + (bx - ax) * s;
    az2 = zn;
  } else if (bz < zn) {
    const s = (zn - az) / (bz - az);
    w.s1 = s;
    bx = ax + (bx - ax) * s;
    bz = zn;
  }
  if (!proj(v, ax2, az2, 0, pa) || !proj(v, bx, bz, 0, pb)) return;
  // Seen from the front only: its picture runs left to right on screen.
  if (pb.x - pa.x < 0.5) return;
  // (A bigger box's picture: its k scaled, so a picture pixel is k / 37 screen pixels wherever a wall is drawn.)
  const kk = SQ / pxOf(BX);
  pa.k *= kk;
  pb.k *= kk;
  const h0 = (ch.h * pa.k) / SQ;
  const h1 = (ch.h * pb.k) / SQ;
  if (pa.x > v.W + 2 || pb.x < -2 || Math.min(pa.y - h0, pb.y - h1) > v.H || Math.max(pa.y, pb.y) < 0) return;
  w.x0 = pa.x;
  w.y0 = pa.y;
  w.k0 = pa.k;
  w.x1 = pb.x;
  w.y1 = pb.y;
  w.k1 = pb.k;
  // Strips: each a step in its top of about `boxStripFine` px at most, and at least 2 px wide.
  const f = TOWN_FEEL;
  const dh = Math.abs(h1 - h0);
  w.strips = dh < 0.75 ? 1 : Math.max(1, Math.min(f.boxStripsFine, Math.ceil(dh / f.boxStripFine), Math.ceil((pb.x - pa.x) / 2)));
  worldNormal(BI, nbx, nby, nw);
  w.shade = Math.min(0.6, wallShade(nw.x, nw.y, v.hc, v.hs) + extraShade);
  w.step = w.shade >= DARK_SHADE ? -1 : 0;
  w.on = true;
  P.on = true;
  grow(pa.x, pa.y);
  grow(pb.x, pb.y);
  grow(pa.x, pa.y - h0);
  grow(pb.x, pb.y - h1);
}

/**
 * What of box `b` (its art `box`) shows this frame from the camera `v` focused on (camX, camY), and how, into `p`: walls in fine strips
 * (WebGL, where a strip costs a few vertices). `cut`: nothing nearer than this (camera-frame squares ahead) is drawn (the near side:
 * nothing between the camera and you). Allocates nothing.
 */
export function planBox(p: BoxPlan, b: BoxInst, box: TownBox, v: View, camX: number, camY: number, cut: number): void {
  const g = geomOf(box);
  P = p;
  BI = b;
  BX = box;
  V = v;
  OFF[2] = cut;
  // Every point from the camera, the nearest way round the wrap from the box's front line's middle.
  OFF[0] = wrapFX(b.fx - camX) - b.fx;
  OFF[1] = wrapFY(b.fy - camY) - b.fy;
  p.on = false;
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
  if (B.back) planWall(p.back, B.back.ch, x0, 1, x1, 1, 0, -1, 0.18);
  else planWall(p.back, B.rear?.ch ?? null, x1, 1, x0, 1, 0, 1, 0.1);
  // The roof's place in the order: its middle, a hair nearer than the sides' (drawn over them).
  boxPoint(b, box, (x0 + x1) / 2, 0.5, wp);
  atCam(wp.x, wp.y);
  p.roofDx = cq.dx;
  p.roofDz = cq.dz - 0.001;
  let nOrd = 0;
  const faces = g.faces;
  const f = TOWN_FEEL;
  // (A stretch of the Colosseum's ring with the camera lower than its rim: its rim, seats and podium are hidden behind its outer wall, so
  // they're left out rather than drawn and covered.)
  const bowl = BI.kind !== "ring" || v.h > WALL_H / RING_PX;
  for (let i = 0; i < faces.length; i++) {
    const fg = faces[i]!;
    const fp = p.faces[i]!;
    fp.on = false;
    if (!bowl) continue;
    // Turned away from the camera (its outward normal; the camera stands `back` behind its focus, `h` up)?
    worldNormal(b, fg.nx, fg.ny, nw);
    const ncx = nw.x * v.hc - nw.y * v.hs;
    const ncz = nw.x * v.hs + nw.y * v.hc;
    boxPoint(b, box, fg.u[0]!, fg.t[0]!, wp);
    atCam(wp.x, wp.y);
    const bpx = pxOf(box);
    if (-cq.dx * ncx + (-v.back - cq.dz) * ncz + (v.h - fg.h[0]! / bpx) * fg.nz <= 0) continue;
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
      const y = pa.y - (fg.h[k]! * pa.k) / bpx;
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
    // (A hedge's top is thin: always one piece.)
    fp.whole = fg.n === 3 || b.kind === "hedge" || wholeFits(fg, fp) < f.boxWholePxFine;
    fp.on = true;
    p.light[i] = faceLight(nw.x, nw.y, fg.nz, v.hc, v.hs);
    fdz[nOrd] = fp.dz;
    p.order[nOrd++] = i;
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
/** (Nov 27) Each front's first frame's drawn pixels (1 a pixel, row by row), shared by every box with that front. */
const frontPixels = new WeakMap<object, Uint8Array>();
export function solidTop(box: TownBox): number {
  let t = solidTops.get(box);
  if (t === undefined) {
    const ch = box.front;
    let px = frontPixels.get(ch);
    if (!px) {
      const rows = frameKeys(ch, ch.anims.idle!.frames[0]!);
      px = new Uint8Array(ch.w * ch.h);
      for (let y = 0; y < ch.h; y++) for (let x = 0; x < ch.w; x++) if (rows[y]?.[x]) px[y * ch.w + x] = 1;
      frontPixels.set(ch, px);
    }
    const need = Math.max(4, 0.2 * (box.body.x1 - box.body.x0));
    t = 0;
    for (let y = 0; y < ch.h; y++) {
      let n = 0;
      for (let x = box.body.x0; x <= box.body.x1; x++) if (x >= 0 && x < ch.w && px[y * ch.w + x]) n++;
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
  return Math.sqrt((X - fp.x[2]!) ** 2 + (Y - fp.y[2]!) ** 2);
}
const AF = new Float64Array(6);

/** (Tests) Squares in the world: N. */
export const WORLD = N;
