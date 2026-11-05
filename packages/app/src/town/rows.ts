/**
 * The street town's rows (Nov 5, round 4; brief-town-rows.md): each built side of a street is one continuous frontage from corner to
 * corner, its fronts on one building line and butted edge to edge (Eric: "they just need to be attached like that"). A row side is
 * data: its street, the way its fronts face, its building line, its two ends (and whether each is a corner onto a cross street), and
 * its slots. A boss home keeps its own lot and size and anchors the row; everything between the homes (and between a home and a row's
 * end) is filled with look-alike fronts (lookalike.ts) of seeded widths and heights, whose widths in pixels close every gap exactly,
 * butted against a home's body (its picture's margins, its sign and fence, stand in front of the neighbour).
 *
 * Pure: no canvas. street.ts applies the rows to the plan (the lots they replace, the ground under them, the garden things they cover).
 *
 * MOCKUP (round 4, step 1): only Fountain Street's four sides are rows so far (both sides of the street, west and east of the park).
 */
import type { HomeId } from "./home-boxes.ts";
import type { LookSpec } from "./lookalike.ts";

/**
 * Each home's front picture's width and its body's columns (px; home-boxes.ts homeBox: the row butts its neighbours against the body).
 * A copy, as data: street.ts lays the rows as the town's world first loads, before the homes' art can be (the houses import the world).
 * test/town-rows.test.ts checks it against homeBox.
 */
export const HOME_BODY: Readonly<Record<HomeId, readonly [w: number, x0: number, x1: number]>> = {
  timber: [144, 26, 118], sawyer: [144, 20, 114], gingerbread: [144, 28, 104], grex: [144, 18, 122], clown: [144, 28, 116], tiger: [144, 28, 116],
  bigboy: [144, 18, 126], blitz: [144, 22, 122], hopper: [144, 4, 140], pig: [144, 12, 128], moo: [144, 8, 136], hollow: [144, 28, 124],
  gardener: [144, 24, 120], smudgy: [144, 20, 124], folio: [144, 16, 112], alfil: [208, 34, 176],
};

const SQ = 37;
/** Which way a row's fronts face: south (onto an east-west street north of the row), north, west (onto Seam Avenue) or east. */
export type Facing = "S" | "N" | "W" | "E";

/** A row side as the plan gives it. */
export interface RowSide {
  id: string;
  street: string;
  facing: Facing;
  /** Its lots' squares: across the street front (along) a0..a1 as edges (world squares; x for S and N, y for W and E), and deep. */
  a0: number;
  a1: number;
  /** The lots' first and last row (S, N) or column (W, E) of squares, front to back either way. */
  d0: number;
  d1: number;
  /** Whether each end (a0, a1) is a corner onto a cross street (its end front turns the corner) or an open end (the park). */
  corner0: boolean;
  corner1: boolean;
  /** The seed for its look-alikes. */
  seed: number;
  /** One front on it a landmark (taller, a tall cap). */
  landmark?: boolean;
}
/** A home anchoring a row: its id and its lot's first square along (its lot is `w` squares). */
export interface RowHome {
  id: HomeId;
  a: number;
  w: number;
}
/** A front placed on a row: a home (where the plan has it) or a look-alike (its recipe), with its extent along (world squares). */
export interface Placed {
  kind: "home" | "look";
  home?: HomeId;
  look?: LookSpec;
  /** Its picture's extent along the row (world squares; a look-alike's is its whole front, a home's its body). */
  s0: number;
  s1: number;
}

/** How far (squares) a front stands back from its lot's front edge: every front on a row on one line (the homes' inset). */
export const ROW_INSET = 0.45;
/** How deep a look-alike's box runs back (squares): as the homes'. */
export const ROW_DEPTH = 2.3;
/** A look-alike's widths (squares) to pick from, and the narrowest one may be (a slim filler front). */
const WIDTHS = [1, 1.5, 2, 2, 2.5, 3] as const;
const MIN_W = 0.6;
/** Each look-alike runs this many px past each of its edges, under its neighbour, so a rounding crack never shows sky. */
export const ROW_OVERLAP_PX = 1;

/** Which way along a row its fronts' pictures run left to right: +1 (x or y growing) or -1. */
export const alongSign = (f: Facing): 1 | -1 => (f === "S" || f === "E" ? 1 : -1);

/** A home's body along a row (world squares), its lot starting at `a` and `w` squares wide, centred on its lot. */
export function homeSpan(id: HomeId, a: number, w: number, facing: Facing): [number, number] {
  const [fw, x0, x1] = HOME_BODY[id];
  const mid = a + w / 2 - 0.5;
  const sgn = alongSign(facing);
  const u0 = (x0 - fw / 2) / SQ;
  const u1 = (x1 + 1 - fw / 2) / SQ;
  return sgn > 0 ? [mid + u0, mid + u1] : [mid - u1, mid - u0];
}

/** A small seeded random (as lookalike.ts's). */
function rnd(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Splits a gap `len` squares long into look-alike widths: seeded picks from WIDTHS while a whole one and a slim one still fit, the last
 * taking what's left (a slim filler, at least MIN_W, or folded into the one before it). `first`: a width to begin with (a corner's).
 */
export function splitGap(len: number, r: () => number, first?: number): number[] {
  const out: number[] = [];
  let left = len;
  if (left <= 0.02) return out;
  if (first !== undefined && left >= first + MIN_W) {
    out.push(first);
    left -= first;
  }
  while (left > 0.02) {
    const w = WIDTHS[Math.floor(r() * WIDTHS.length) % WIDTHS.length]!;
    if (left - w >= MIN_W) {
      out.push(w);
      left -= w;
    } else if (left <= 3.2 || out.length === 0) {
      out.push(left);
      left = 0;
    } else {
      out.push(left / 2);
      out.push(left / 2);
      left = 0;
    }
  }
  // (A sliver under MIN_W folds into the one before it.)
  if (out.length > 1 && out[out.length - 1]! < MIN_W) out[out.length - 2]! += out.pop()!;
  return out;
}

/**
 * A row side's fronts, left to right along its world axis (a0 to a1): its homes where the plan has them, and look-alikes filling every
 * gap between them and the row's ends. Every point from a0 to a1 is covered by a front (a home's body or a look-alike's picture).
 */
export function layRow(side: RowSide, homes: readonly RowHome[]): Placed[] {
  const r = rnd(side.seed);
  const anchors = homes.map((h) => ({ h, span: homeSpan(h.id, h.a, h.w, side.facing) })).sort((a, b) => a.span[0] - b.span[0]);
  const out: Placed[] = [];
  let at = side.a0;
  let prevTall = -1;
  const sgn = alongSign(side.facing);
  const fill = (to: number, endCorner0: boolean, endCorner1: boolean) => {
    const len = to - at;
    if (len <= 0.02) return;
    // (A corner's front is two squares where there's room: it turns the corner.)
    const ws = splitGap(len, r, endCorner0 && len >= 2 + MIN_W ? 2 : undefined);
    if (endCorner1 && ws.length > 1 && ws[ws.length - 1]! < 1.5) {
      // Keep a corner front at least a square and a half: borrow from its neighbour.
      const need = 1.5 - ws[ws.length - 1]!;
      if (ws[ws.length - 2]! - need >= MIN_W) ((ws[ws.length - 2]! -= need), (ws[ws.length - 1]! += need));
    }
    ws.forEach((w, k) => {
      const s0 = at;
      const s1 = k === ws.length - 1 ? to : at + w;
      at = s1;
      let tall = ([0, 1, 1, 1, 2, 2] as const)[Math.floor(r() * 6) % 6]!;
      // (Stepped rooflines: a neighbour the same height is bumped up or down, mostly.)
      if (tall === prevTall && r() < 0.75) tall = (tall === 2 ? 1 : tall + 1) as 0 | 1 | 2;
      prevTall = tall;
      // Which side faces the cross street at a corner: the picture's left runs from a0 (sgn +1) or a1 (sgn -1).
      const atLo = k === 0 && endCorner0;
      const atHi = k === ws.length - 1 && endCorner1;
      const corner = atLo ? (sgn > 0 ? "L" : "R") : atHi ? (sgn > 0 ? "R" : "L") : null;
      out.push({
        kind: "look",
        look: { seed: Math.floor(r() * 1e9), w: Math.round((s1 - s0) * SQ) + 2 * ROW_OVERLAP_PX, tall, corner, depth: ROW_DEPTH },
        s0,
        s1,
      });
    });
  };
  anchors.forEach(({ h, span }, k) => {
    fill(span[0], k === 0 && side.corner0, false);
    out.push({ kind: "home", home: h.id, s0: span[0], s1: span[1] });
    at = span[1];
    prevTall = 0;
  });
  fill(side.a1, anchors.length === 0 && side.corner0, side.corner1);
  // One landmark a side that asks: the widest look-alike of two squares or more, away from the ends.
  if (side.landmark) {
    const looks = out.filter((p, i) => p.kind === "look" && i > 0 && i < out.length - 1 && p.s1 - p.s0 >= 1.9);
    const best = looks.sort((a, b) => b.s1 - b.s0 - (a.s1 - a.s0))[0];
    if (best) best.look = { ...best.look!, tall: 3 };
  }
  return out;
}

/** Fountain Street's four sides (the mockup's rows): north of the street (its fronts face south) and south of it (facing north), west and east of the park. */
export const ROW_SIDES: readonly RowSide[] = [
  { id: "fountain-n-west", street: "fountain-st", facing: "S", a0: 2.5, a1: 12.5, d0: 18, d1: 20, corner0: true, corner1: true, seed: 101 },
  { id: "fountain-n-east", street: "fountain-st", facing: "S", a0: 32.5, a1: 42.5, d0: 18, d1: 20, corner0: true, corner1: true, seed: 202 },
  { id: "fountain-s-west", street: "fountain-st", facing: "N", a0: 2.5, a1: 12.5, d0: 11, d1: 9, corner0: true, corner1: true, seed: 303, landmark: true },
  { id: "fountain-s-east", street: "fountain-st", facing: "N", a0: 32.5, a1: 42.5, d0: 11, d1: 9, corner0: true, corner1: true, seed: 404 },
];
