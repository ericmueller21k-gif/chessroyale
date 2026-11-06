/**
 * The street town's Colosseum's shape (Nov 5, the north edge round): its oval, the ring of straight stretches round it, the portal's size.
 * Pure numbers (no art), so the plan (street.ts) can place its boxes before any picture loads; houses/coliseum-ring.ts draws them.
 */
import PLAN from "../street-plan.json" with { type: "json" };

const SQ = 37;
/** The oval (world squares): its middle and half axes, across (a) and deep (b). The plan's (scripts/street-plan-north.py OVAL). */
export const OVAL: { readonly cx: number; readonly cy: number; readonly a: number; readonly b: number } = PLAN.coliseum.oval;
/** How many stretches round it: 18 (each about 2.3 squares, two bays of arches). */
export const RING_M = 18;
/** The outer wall's height (px over its foot) and how deep the seats run in from it (squares) to the arena's podium. */
export const WALL_H = 262;
export const CAVEA = 2.4;

/** A point on the oval at angle th (counterclockwise from east). */
const onOval = (th: number) => ({ x: OVAL.cx + OVAL.a * Math.cos(th), y: OVAL.cy + OVAL.b * Math.sin(th) });
const angleOf = (x: number, y: number) => Math.atan2((y - OVAL.cy) / OVAL.b, (x - OVAL.cx) / OVAL.a);

/**
 * The ring's corners: RING_M points on the oval, counterclockwise (seen from above), every stretch between two the same length `chord`,
 * the first stretch centred on the front (its corners either side of the oval's southmost point). Found by bisection on the length.
 */
function corners(): { pts: { x: number; y: number }[]; chord: number } {
  const walk = (c: number) => {
    const half = c / 2;
    const y0 = OVAL.cy - OVAL.b * Math.sqrt(Math.max(0, 1 - (half / OVAL.a) ** 2));
    const pts = [
      { x: OVAL.cx - half, y: y0 },
      { x: OVAL.cx + half, y: y0 },
    ];
    let th = angleOf(pts[1]!.x, pts[1]!.y);
    for (let k = 2; k <= RING_M; k++) {
      const from = pts[k - 1]!;
      let lo = th;
      let hi = th + Math.PI / 2;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        const p = onOval(mid);
        if (Math.hypot(p.x - from.x, p.y - from.y) < c) lo = mid;
        else hi = mid;
      }
      th = (lo + hi) / 2;
      pts.push(onOval(th));
    }
    // (How far round the last corner came: a whole turn from the first is closed.)
    const th0 = angleOf(pts[0]!.x, pts[0]!.y);
    return { pts, over: th - (th0 + 2 * Math.PI) };
  };
  let lo = 0.5;
  let hi = 6;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (walk(mid).over < 0) lo = mid;
    else hi = mid;
  }
  const chord = (lo + hi) / 2;
  return { pts: walk(chord).pts.slice(0, RING_M), chord };
}
const C = corners();
/** Every stretch's length (squares), and its front picture's width (px; its box drawn at W / CHORD px a square, about 37). */
export const CHORD = C.chord;
export const RING_W = Math.round(CHORD * SQ);
const W = RING_W;
export const RING_PX = W / CHORD;

/** A stretch of the ring: its outer wall's left end (seen from outside), the way along it, inward, and the corners' turns either end. */
export interface RingSeg {
  k: number;
  x0: number;
  y0: number;
  ux: number;
  uy: number;
  /** Its front line's middle (world squares), and the way its front faces (outward: the nearest of S, E, N, W). */
  mx: number;
  my: number;
  facing: "S" | "E" | "N" | "W";
  /** How sharply the ring turns at its left and right corners (radians). */
  turnL: number;
  turnR: number;
}
export const RING: readonly RingSeg[] = C.pts.map((p, k) => {
  const q = C.pts[(k + 1) % RING_M]!;
  const prev = C.pts[(k + RING_M - 1) % RING_M]!;
  const next = C.pts[(k + 2) % RING_M]!;
  const ux = (q.x - p.x) / CHORD;
  const uy = (q.y - p.y) / CHORD;
  const turn = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
    Math.atan2((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y));
  // Outward: the along way turned a quarter clockwise (uy, -ux).
  const ox = uy;
  const oy = -ux;
  const facing = Math.abs(ox) > Math.abs(oy) ? (ox > 0 ? "E" : "W") : oy > 0 ? "N" : "S";
  return { k, x0: p.x, y0: p.y, ux, uy, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, facing, turnL: turn(prev, p, q), turnR: turn(p, q, next) };
});

/** The portal's width (px: four squares) and depth (squares, back into the ring). */
export const PORTAL_W = 4 * SQ;
export const PORTAL_DEPTH = 0.9;
