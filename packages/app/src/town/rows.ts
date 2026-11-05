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
 * Every street's built sides are rows (round 4, the build): both sides of the four east-west streets, west and east of the park (Seam
 * Street's north side either side of the promenade), and Seam Avenue's two short stretches between the corners. A 3-deep block between
 * two streets is two rows back to back (each about 1.2 squares deep); a deep block (Seam Street to Fountain Street, Upper Street to Seam
 * Street) has a row on each street and its gardens and tall blocks in the middle, seen over the roofs: the skyline.
 *
 * Away from the corners a look-alike is a flat front (a shallow box with a flat roof, its cap a false front over it): the chase camera
 * sees fronts, not roofs. A corner keeps a deep box, so the end it turns onto the cross street reads as a building.
 */
import type { HomeId } from "./home-boxes.ts";
import type { LookSpec } from "./lookalike.ts";
import { TOWN_FEEL } from "./feel.ts";

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

/** The street town's buildings' picture pixels a world square (boxes.ts BUILD_PX: drawn TOWN_FEEL.streetBuildScale bigger than 37). */
export const ROW_PX = 37 / TOWN_FEEL.streetBuildScale;
const SQ = ROW_PX;
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
  /** One front on it a landmark (taller, a tall cap), away from its homes and ends. */
  landmark?: boolean;
  /** Its building line: how far (squares) its fronts stand back from its lots' front edge (ROW_INSET where a sidewalk runs before it). */
  inset: number;
  /** How deep (squares) its flat fronts and its corner fronts run back. */
  flat: number;
  cornerDepth: number;
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
  /** A home slid along the row to fit (world squares along the row's world axis, x or y): too wide for the room by its row's end. */
  shift?: number;
}

/** How far (squares) a front stands back from its lot's front edge: every front on a row on one line (the homes' inset). */
export const ROW_INSET = 0.45;
/** A row backing onto the homes of another (a 3-deep block's back street) or along Seam Avenue: its fronts nearly on the lot's edge. */
export const ROW_INSET_BACK = 0.12;
/** How deep a corner's look-alike runs back (squares): as the homes'. */
export const ROW_DEPTH = 2.3;
/** How deep a flat front runs back (squares): a shallow box, so two rows fit back to back on a 3-deep block. */
export const ROW_FLAT = 1.2;
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
  const anchors = homes.map((h) => ({ h, span: homeSpan(h.id, h.a, h.w, side.facing), shift: 0 })).sort((a, b) => a.span[0] - b.span[0]);
  // A home too wide for the room by its row's end (or its neighbour home) slides inward; one that leaves a gap at an end too slim for a
  // front slides out to the end (the home turns the corner itself, its own side wall on the cross street).
  const slide = (k: number, d: number) => {
    const an = anchors[k]!;
    an.span = [an.span[0] + d, an.span[1] + d];
    an.shift += d;
  };
  for (let k = 0; k < anchors.length; k++) {
    const lo = k === 0 ? side.a0 : anchors[k - 1]!.span[1];
    const gap = anchors[k]!.span[0] - lo;
    if (gap < 0 || (k === 0 && gap < MIN_W)) slide(k, -gap);
  }
  for (let k = anchors.length - 1; k >= 0; k--) {
    const hi = k === anchors.length - 1 ? side.a1 : anchors[k + 1]!.span[0];
    const gap = hi - anchors[k]!.span[1];
    if (gap < 0 || (k === anchors.length - 1 && gap < MIN_W)) slide(k, gap);
  }
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
      // (Eric, Nov 5: "no front is low next to the pawn": three floors at least, about three pawn heights to the eave; four mostly.)
      let tall = ([1, 1, 2, 2, 2, 2] as const)[Math.floor(r() * 6) % 6]!;
      // (Stepped rooflines: a neighbour the same height is bumped up or down, mostly.)
      if (tall === prevTall && r() < 0.75) tall = (tall === 2 ? 1 : 2) as 1 | 2;
      prevTall = tall;
      // Which side faces the cross street at a corner: the picture's left runs from a0 (sgn +1) or a1 (sgn -1).
      const atLo = k === 0 && endCorner0;
      const atHi = k === ws.length - 1 && endCorner1;
      const corner = atLo ? (sgn > 0 ? "L" : "R") : atHi ? (sgn > 0 ? "R" : "L") : null;
      out.push({
        kind: "look",
        look: { seed: Math.floor(r() * 1e9), w: Math.round((s1 - s0) * SQ) + 2 * ROW_OVERLAP_PX, tall, corner, depth: side.cornerDepth, px: SQ },
        s0,
        s1,
      });
    });
  };
  anchors.forEach(({ h, span }, k) => {
    if (span[0] - at < 0.02) at = span[0];
    fill(span[0], k === 0 && side.corner0, false);
    out.push({ kind: "home", home: h.id, s0: span[0], s1: span[1], shift: anchors[k]!.shift });
    at = span[1];
    prevTall = 0;
  });
  fill(side.a1, anchors.length === 0 && side.corner0, side.corner1);
  // One landmark a side that asks: the widest look-alike of two squares or more, away from the ends and from the homes.
  if (side.landmark) {
    const looks = out.filter((p, i) => p.kind === "look" && i > 0 && i < out.length - 1 && p.s1 - p.s0 >= 1.9 && out[i - 1]!.kind !== "home" && out[i + 1]!.kind !== "home");
    const best = looks.sort((a, b) => b.s1 - b.s0 - (a.s1 - a.s0))[0];
    if (best) best.look = { ...best.look!, tall: 3 };
  }
  // Depth: a corner's look-alike a deep box, the rest flat fronts.
  for (const p of out) if (p.kind === "look") p.look = { ...p.look!, depth: p.look!.corner ? side.cornerDepth : side.flat, flat: !p.look!.corner };
  return out;
}

/** Where a row's end meets Seam Avenue's building line (its fronts at the lot's edge plus ROW_INSET_BACK): a corner's end front stands on it. */
const AVE_W = 2.5 + ROW_INSET_BACK;
const AVE_E = 42.5 - ROW_INSET_BACK;
/** A street row (its fronts face S or N), corners at both ends unless said: its own inset and depths. */
const sideOf = (id: string, street: string, facing: Facing, a0: number, a1: number, d0: number, d1: number, seed: number, more: Partial<RowSide> = {}): RowSide => ({
  id, street, facing, a0, a1, d0, d1, corner0: true, corner1: true, seed, inset: ROW_INSET, flat: ROW_FLAT, cornerDepth: ROW_DEPTH, ...more,
});
/** A 3-deep block's two rows back to back: each a shallow box, a corner too (the two corners side by side close the cross street). */
const BACK = { flat: ROW_FLAT, cornerDepth: ROW_FLAT } as const;
/** A row's corner's box from its front line back (squares): where Seam Avenue's own short rows begin and end. */
const cornerBack = (d0: number, facing: "S" | "N") => (facing === "S" ? d0 - 0.5 + ROW_INSET + ROW_DEPTH : d0 + 0.5 - ROW_INSET - ROW_DEPTH);
/**
 * The town's rows (round 4; the plan as it wraps east-west only, scripts/street-plan-north.py): every street's built sides. A row's end
 * onto Seam Avenue, the park, the promenade or the Colosseum's plaza turns the corner. Seam Avenue's own short rows (between the
 * corners' backs) butt against the corners' sides: no corners. The closing row along the south edge and Upper Street's north row run
 * on over the wrap (their a1 past N).
 */
export const ROW_SIDES: readonly RowSide[] = [
  // The south edge: one row the whole way round, its fronts facing north onto South Street (Eric: "the south edge is closed by a row of
  // buildings"). Nothing is behind it.
  sideOf("south-edge", "south-st", "N", -0.5, 45.5, 2, 0, 1301, { corner0: false, corner1: false, flat: 2.0, landmark: true }),
  // South Street, north side (its fronts face south), either side of the promenade; the deep block's tall blocks behind.
  sideOf("south-n-west", "south-st", "S", AVE_W, 20.5, 9, 11, 501),
  sideOf("south-n-east", "south-st", "S", 24.5, AVE_E, 9, 11, 502, { landmark: true }),
  // Fountain Street, south side (facing north): the deep block's other street.
  sideOf("fountain-s-west", "fountain-st", "N", AVE_W, 12.5, 17, 15, 303, { landmark: true }),
  sideOf("fountain-s-east", "fountain-st", "N", 32.5, AVE_E, 17, 15, 404),
  // Fountain Street's north side and Colosseum Row's south side: a 3-deep block, back to back.
  sideOf("fountain-n-west", "fountain-st", "S", AVE_W, 12.5, 24, 25, 101, BACK),
  sideOf("fountain-n-east", "fountain-st", "S", 32.5, AVE_E, 24, 25, 202, BACK),
  sideOf("colrow-s-west", "colosseum-row", "N", AVE_W, 12.5, 26, 26, 603, { ...BACK, inset: ROW_INSET_BACK, landmark: true }),
  sideOf("colrow-s-east", "colosseum-row", "N", 32.5, AVE_E, 26, 26, 604, { ...BACK, inset: ROW_INSET_BACK }),
  // Colosseum Row's north side and Upper Street's south side: back to back.
  sideOf("colrow-n-west", "colosseum-row", "S", AVE_W, 12.5, 32, 33, 701, BACK),
  sideOf("colrow-n-east", "colosseum-row", "S", 32.5, AVE_E, 32, 33, 702, BACK),
  sideOf("upper-s-west", "upper-st", "N", AVE_W, 12.5, 34, 34, 803, { ...BACK, inset: ROW_INSET_BACK }),
  sideOf("upper-s-east", "upper-st", "N", 32.5, AVE_E, 34, 34, 804, { ...BACK, inset: ROW_INSET_BACK, landmark: true }),
  // Upper Street's north side: from the plaza's east side round over the wrap (Seam Avenue ends at Upper Street) to its west side; tall
  // blocks and gardens behind it, the north edge beyond.
  sideOf("upper-n", "upper-st", "S", 32.5, 12.5 + 46, 41, 43, 901, { landmark: true }),
  // Seam Avenue's own stretch between South Street's and Fountain Street's corners: east of it (fronts face west) and west of it
  // (facing east, one square deep).
  { id: "ave-e", street: "seam-ave", facing: "W", a0: cornerBack(9, "S"), a1: cornerBack(17, "N"), d0: 3, d1: 5, corner0: false, corner1: false, seed: 1101, inset: ROW_INSET_BACK, flat: ROW_FLAT, cornerDepth: ROW_FLAT },
  { id: "ave-w", street: "seam-ave", facing: "E", a0: cornerBack(9, "S"), a1: cornerBack(17, "N"), d0: 42, d1: 42, corner0: false, corner1: false, seed: 1201, inset: ROW_INSET_BACK, flat: 0.8, cornerDepth: 0.8 },
];
