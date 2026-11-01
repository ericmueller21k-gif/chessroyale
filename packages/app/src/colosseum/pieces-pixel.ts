/**
 * The pixel set (Nov 1, the gear's Pieces: Pixel, the default; docs/decisions/2026-11-01-colosseum-pixel.md): the six
 * Staunton pieces as Eric's picture of Oct 31 draws them (docs/refs/colosseum-high-view.png), made once in code like the 3D
 * set (pieces3d.ts, whose builder this uses) and drawn cel-shaded on the arena's pixel grid (arena-gl.ts). Eric, on the proof
 * of concept's pawn and king: "that's exactly what I was thinking of"; on round 1: "the bordering and the shading and the
 * size was just still off… we were almost there."
 *
 * Round 2 (Nov 1, measured on the picture): each piece as tall on screen, in the high view behind White, against the width of
 * the square it stands on near White, as the picture's (`PIXEL_TARGET`, its one-pixel outline counted as the picture's is),
 * on a base as wide as the picture's (`PIXEL_BASE`): eight-sided and stepped (a flat face toward you, each face one flat
 * tone), the lower step's top edge a band (gold on Black). Above it a skirt narrowing to the stem, a collar (`band`: gold on
 * Black, the body's own color on White), then the top: the pawn's small round head, the rook's straight tower and crisp
 * battlements, the knight's horse's head in profile (its outline given depth, as the 3D knight's), the bishop's mitre with
 * its slit and a small ball, the queen's wide coronet of points and its ball, the king's wide crown and its cross.
 * Meters (a board square a meter), each piece standing on y = 0, its front toward +z (the renderer turns each to face the
 * screen and leans it back like a sprite).
 */
import { Builder, MAT, arc, extrude, type Kind, type P, type PieceMesh } from "./pieces3d.ts";

/**
 * How tall each piece stands on screen in the high view behind White, outline and all, against the width of the square it
 * stands on near White (Eric's picture, measured on its first two ranks: the pawn 0.8, the rook 0.95, the queen 1.27, the
 * king 1.5; the knight from its middle ranks, scaled as its pawns scale there; the bishop between the knight and the queen).
 */
export const PIXEL_TARGET: Record<Kind, number> = { p: 0.8, r: 0.95, n: 1.1, b: 1.15, q: 1.27, k: 1.5 };
/** How wide each piece's base is on screen there, outline and all (the picture's). */
export const PIXEL_BASE: Record<Kind, number> = { p: 0.58, r: 0.64, n: 0.7, b: 0.66, q: 0.72, k: 0.7 };
/** Steps round a smooth turned part: 16 reads round on the pixel grid at these sizes. */
const SEGS = 16;
/** The bishop's slit (in the shader): the line k·x + y = `c` across the mitre's front, `w` half its width (meters). */
export const PIXEL_SLIT = { k: 1.4, c: 0.94, w: 0.03 } as const;
/** The knight's head turned this much (radians) from a plain profile, so the bevel of its near side catches the light. */
export const PIXEL_KNIGHT_TURN = 0.22;

const B = MAT.band;

/**
 * An eight-sided part: a profile (from the axis at the bottom, out, up and back in) turned round in eight flat faces, one of
 * them square to +z (toward you), each face its own normal, so the cel shading lights each face one flat tone.
 */
function octagon(b: Builder, pts: readonly P[]): void {
  const n = 8;
  const rot = Math.PI / n;
  for (let j = 0; j + 1 < pts.length; j++) {
    const p0 = pts[j]!;
    const p1 = pts[j + 1]!;
    const dr = p1.r - p0.r;
    const dy = p1.y - p0.y;
    const l = Math.hypot(dr, dy);
    if (l < 1e-6) continue;
    const nr = dy / l;
    const ny = -dr / l;
    const m = p0.m ?? MAT.body;
    for (let k = 0; k < n; k++) {
      const a0 = rot + (k / n) * Math.PI * 2;
      const a1 = rot + ((k + 1) / n) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      // (A face's points sit on the corners' radius: its middle, at r·cos(π/8), is what faces you.)
      const nx = nr * Math.sin(am);
      const nz = nr * Math.cos(am);
      const v = [
        b.vert(p0.r * Math.sin(a0), p0.y, p0.r * Math.cos(a0), nx, ny, nz, m),
        b.vert(p1.r * Math.sin(a0), p1.y, p1.r * Math.cos(a0), nx, ny, nz, m),
        b.vert(p1.r * Math.sin(a1), p1.y, p1.r * Math.cos(a1), nx, ny, nz, m),
        b.vert(p0.r * Math.sin(a1), p0.y, p0.r * Math.cos(a1), nx, ny, nz, m),
      ];
      b.tri(v[0]!, v[1]!, v[2]!);
      b.tri(v[0]!, v[2]!, v[3]!);
    }
  }
}

/** The base's height: its lower step and the upper one. */
const STEP = 0.08;
const BASE_TOP = 0.13;

/**
 * The base every piece stands on (corner radius R): eight-sided, two steps, the lower step's top edge a band (gold on Black),
 * as the picture's.
 */
function base(b: Builder, R: number): void {
  octagon(b, [
    { r: 0, y: 0 },
    { r: R, y: 0 },
    { r: R, y: STEP - 0.03, m: B },
    { r: R, y: STEP },
    { r: R * 0.76, y: STEP + 0.005 },
    { r: R * 0.76, y: BASE_TOP },
    { r: 0, y: BASE_TOP },
  ]);
  b.shadow(R * 1.2);
}

/** The skirt from the base's top in to the stem (radius `r` at `y1`), concave as a Staunton piece's. */
function skirt(R: number, r: number, y1: number): P[] {
  const y0 = BASE_TOP;
  const h = y1 - y0;
  const r0 = R * 0.68;
  return [
    { r: 0, y: y0 },
    { r: r0, y: y0 },
    { r: r0, y: y0 + h * 0.08 },
    { r: r + (r0 - r) * 0.55, y: y0 + h * 0.25 },
    { r: r + (r0 - r) * 0.25, y: y0 + h * 0.5 },
    { r: r + (r0 - r) * 0.08, y: y0 + h * 0.78 },
    { r, y: y1 },
  ];
}

/** A collar round the stem at height y: a disc (radius R, `t` thick) in the band's color. */
function collar(stem: number, R: number, y: number, t: number): P[] {
  return [
    { r: stem, y },
    { r: R, y: y + 0.01, m: B },
    { r: R, y: y + t },
    { r: stem, y: y + t + 0.01 },
  ];
}

/** A point of a crown: a block of the ring from angle a0 to a1, radius ri to ro, y0 to y1, its top `narrow` as wide. */
function tooth(b: Builder, a0: number, a1: number, ri: number, ro: number, y0: number, y1: number, narrow: number, m: number): void {
  const am = (a0 + a1) / 2;
  const t0 = am + (a0 - am) * narrow;
  const t1 = am + (a1 - am) * narrow;
  const at = (a: number, r: number, y: number) => [Math.sin(a) * r, y, Math.cos(a) * r];
  b.quad(at(a0, ro, y0), at(a1, ro, y0), at(t1, ro, y1), at(t0, ro, y1), [Math.sin(am), 0, Math.cos(am)], m);
  b.quad(at(a1, ri, y0), at(a0, ri, y0), at(t0, ri, y1), at(t1, ri, y1), [-Math.sin(am), 0, -Math.cos(am)], m);
  b.quad(at(t0, ro, y1), at(t1, ro, y1), at(t1, ri, y1), at(t0, ri, y1), [0, 1, 0], m);
  b.quad(at(a0, ri, y0), at(a0, ro, y0), at(t0, ro, y1), at(t0, ri, y1), [-Math.cos(a0), 0, Math.sin(a0)], m);
  b.quad(at(a1, ro, y0), at(a1, ri, y0), at(t1, ri, y1), at(t1, ro, y1), [Math.cos(a1), 0, -Math.sin(a1)], m);
}

function pawn(): PieceMesh {
  const b = new Builder();
  const R = 0.255;
  base(b, R);
  const head = { cy: H.p - 0.13, r: 0.13 };
  const c = H.p - 0.29;
  b.lathe([...skirt(R, 0.085, c - 0.03), { r: 0.08, y: c }, ...collar(0.08, 0.17, c, 0.055), ...arc(0, head.cy, head.r, -Math.acos(0.065 / head.r), Math.PI / 2, 8)], SEGS);
  return b.done(H.p);
}

function rook(): PieceMesh {
  const b = new Builder();
  const R = 0.275;
  base(b, R);
  const top = H.r - 0.15;
  const ro = 0.25;
  b.lathe(
    [
      ...skirt(R, 0.19, BASE_TOP + 0.12),
      { r: 0.18, y: top - 0.15 },
      { r: 0.19, y: top - 0.13 },
      { r: 0.215, y: top - 0.12, m: B },
      { r: 0.215, y: top - 0.08 },
      { r: ro, y: top - 0.07 },
      { r: ro, y: top },
      { r: 0, y: top },
    ],
    SEGS,
  );
  // The battlements: three merlons across the top as you see it (every piece faces the screen, as a sprite's), square
  // notches between them through which the board shows, thin front to back so their tops don't show.
  const m = 0.12;
  const d = 0.09;
  for (const x of [-ro + m / 2, 0, ro - m / 2]) b.box(x - m / 2, top - 0.001, -d, x + m / 2, H.r, d, MAT.body);
  return b.done(H.r);
}

/**
 * The knight's head in profile, its nose toward -x (as the board's knights), counter-clockwise: up the back of the neck (the
 * mane's arch) to the ear, down the face to the muzzle, the mouth, the jaw and the throat, the chest back to the base (a
 * height of 1; `KNIGHT_AT` makes it the head's size).
 */
const KNIGHT_UNIT: readonly (readonly [number, number])[] = [
  [0.22, 0.0],
  [0.27, 0.2],
  [0.28, 0.4],
  [0.25, 0.56],
  [0.21, 0.69],
  [0.16, 0.79],
  [0.14, 0.9],
  [0.11, 1.0],
  [0.05, 0.91],
  [0.01, 0.885],
  [-0.08, 0.855],
  [-0.18, 0.79],
  [-0.27, 0.71],
  [-0.36, 0.62],
  [-0.42, 0.55],
  [-0.445, 0.5],
  [-0.435, 0.445],
  [-0.4, 0.41],
  [-0.33, 0.405],
  [-0.24, 0.415],
  [-0.16, 0.42],
  [-0.12, 0.39],
  [-0.13, 0.3],
  [-0.18, 0.2],
  [-0.22, 0.1],
  [-0.24, 0.0],
];

/** Each piece's height (meters), set so it stands `PIXEL_TARGET` tall on screen (the tests measure it). */
const H: Record<Kind, number> = { p: 0.62, r: 0.75, n: 0.93, b: 1.0, q: 1.12, k: 1.36 };

/** The head's outline in meters: x scaled `sx`, y `sy`, from `y0` (the collar's top), shifted `dx`. */
const KNIGHT_AT = { sx: 0.62, sy: H.n - 0.17, y0: 0.17, dx: 0.035 } as const;
const knightAt = ([x, y]: readonly [number, number]) => [KNIGHT_AT.sx * x + KNIGHT_AT.dx, KNIGHT_AT.y0 + KNIGHT_AT.sy * y] as const;
export const PIXEL_KNIGHT: readonly (readonly [number, number])[] = KNIGHT_UNIT.map(knightAt);
/** The knight's eye (in the shader): its middle in the head's outline (x, y; meters) and its radius. */
export const PIXEL_EYE = (() => {
  const [x, y] = knightAt([-0.15, 0.73]);
  return { x, y, r: 0.04 } as const;
})();

function knight(): PieceMesh {
  const b = new Builder();
  const R = 0.31;
  base(b, R);
  b.lathe([{ r: 0, y: BASE_TOP }, { r: 0.22, y: BASE_TOP }, { r: 0.2, y: BASE_TOP + 0.01, m: B }, { r: 0.2, y: 0.17 }, { r: 0, y: 0.17 }], SEGS);
  extrude(b, PIXEL_KNIGHT, 0.095, 0.03, PIXEL_KNIGHT_TURN, MAT.head);
  return b.done(H.n);
}

function bishop(): PieceMesh {
  const b = new Builder();
  const R = 0.295;
  base(b, R);
  const top = H.b - 0.09;
  const h = 0.36;
  const y0 = top - h;
  const mitre: P[] = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    const r = 0.16 * Math.sqrt(Math.max(0, 1 - ((t - 0.36) / 0.64) ** 2));
    mitre.push({ r: k === 12 ? 0 : Math.max(r, 0.015), y: y0 + t * h, m: MAT.mitre });
  }
  const c = y0 - 0.085;
  b.lathe([...skirt(R, 0.085, c - 0.02), ...collar(0.085, 0.16, c, 0.055), { r: 0.07, y: c + 0.075 }, { r: 0.095, y: y0 }, ...mitre], SEGS);
  b.ball(0, top + 0.045, 0, 0.045, B);
  return b.done(H.b);
}

function queen(): PieceMesh {
  const b = new Builder();
  const R = 0.335;
  base(b, R);
  const rim = H.q - 0.24;
  const ro = 0.26;
  const c = rim - 0.32;
  b.lathe(
    [
      ...skirt(R, 0.11, c - 0.04),
      ...collar(0.11, 0.175, c, 0.06),
      { r: 0.105, y: c + 0.1 },
      { r: 0.13, y: c + 0.17 },
      { r: 0.2, y: rim - 0.06 },
      { r: ro - 0.01, y: rim - 0.035 },
      { r: ro, y: rim - 0.03, m: B },
      { r: ro, y: rim },
      { r: 0, y: rim },
    ],
    SEGS,
  );
  // The coronet: five points round the rim, one square to you, standing a little above the dome inside them (so the crown
  // reads as one cup with a pointed rim, as the picture's), and the ball on top.
  const n = 5;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const half = (Math.PI / n) * 0.6;
    tooth(b, a - half, a + half, ro - 0.05, ro, rim - 0.001, rim + 0.14, 0.3, B);
  }
  b.lathe([{ r: 0, y: rim }, { r: 0.215, y: rim }, { r: 0.205, y: rim + 0.07 }, { r: 0.15, y: rim + 0.11 }, { r: 0.06, y: rim + 0.13 }, { r: 0, y: rim + 0.135 }], SEGS);
  b.ball(0, H.q - 0.06, 0, 0.06, B);
  return b.done(H.q);
}

function king(): PieceMesh {
  const b = new Builder();
  const R = 0.32;
  base(b, R);
  const rim = H.k - 0.47;
  const ro = 0.265;
  const c = rim - 0.33;
  b.lathe(
    [
      ...skirt(R, 0.115, c - 0.04),
      ...collar(0.115, 0.18, c, 0.06),
      { r: 0.11, y: c + 0.1 },
      { r: 0.15, y: c + 0.16 },
      { r: 0.225, y: rim - 0.08 },
      { r: ro, y: rim - 0.04, m: B },
      { r: ro, y: rim },
      { r: 0.18, y: rim + 0.015 },
      { r: 0.08, y: rim + 0.03 },
      { r: 0, y: rim + 0.032 },
    ],
    SEGS,
  );
  // The cross: chunky (its arms survive the one-pixel outline), thin front to back.
  const t = 0.06;
  const d = 0.035;
  b.box(-t, rim + 0.02, -d, t, H.k, d, B);
  b.box(-0.165, H.k - 0.2, -d, 0.165, H.k - 0.11, d, B);
  return b.done(H.k);
}

/** The six pixel pieces, built once ("p" … "k"), in meters. */
export function pixelMeshes(): Record<Kind, PieceMesh> {
  return { p: pawn(), n: knight(), b: bishop(), r: rook(), q: queen(), k: king() };
}
