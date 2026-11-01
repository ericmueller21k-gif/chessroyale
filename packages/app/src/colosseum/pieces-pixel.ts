/**
 * The pixel set (Nov 1, the gear's Pieces: Pixel, the default; docs/decisions/2026-11-01-colosseum-pixel.md): the six
 * Staunton pieces as Eric's picture of Oct 31 draws them, made once in code like the 3D set (pieces3d.ts, whose builder this
 * uses) and drawn cel-shaded on the arena's pixel grid (arena-gl.ts). Eric, on the proof of concept's pawn and king: "that's
 * exactly what I was thinking of."
 *
 * Real-set heights (the pawn shortest, then the rook, the knight, the bishop, the queen; the king about twice the pawn) and
 * slender stems on wide eight-sided bases (a flat face toward you, each face one flat tone), trim bands at the base and the
 * collar (`band`: gold on Black, the body's own color on White), the king's chunky cross, the queen's coronet, the rook's
 * battlements, the bishop's slit, and the knight a horse's head in profile (its outline given depth, as the 3D knight's).
 * Meters, a board square a meter; each piece stands on y = 0, its front toward +z (the renderer turns each to face the
 * screen). The profiles are in set units (a pawn 0.62 tall), drawn at PIXEL_SIZE.
 */
import { Builder, KINDS, MAT, PV, arc, extrude, type Kind, type P, type PieceMesh } from "./pieces3d.ts";

/**
 * How big the pixel set is drawn: 1.25 times the proof of concept's (which drew at the 3D set's SIZE, 1.25), as Eric's
 * picture has them against the squares: a pawn about 0.97 m, the king about 1.85 m.
 */
export const PIXEL_SIZE = 1.25 * 1.25;
/** Steps round a smooth turned part: 20 reads round on the pixel grid. */
const SEGS = 20;
/** The bishop's slit (in the shader): the line k·x + y = `c` across the mitre's front, `w` half its width (set units). */
export const PIXEL_SLIT = { k: 1.5, c: 0.745, w: 0.022 } as const;
/** The knight's eye (in the shader): its middle in the head's outline (x, y; set units) and its radius. */
export const PIXEL_EYE = { x: -0.065, y: 0.61, r: 0.032 } as const;
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

/** The base every piece stands on: eight-sided, a band round its foot, a bevel up to a second, narrower step, `top` high. */
function base(b: Builder, R: number, top: number): void {
  octagon(b, [
    { r: 0, y: 0 },
    { r: R, y: 0, m: B },
    { r: R, y: 0.05 },
    { r: R * 0.9, y: 0.064 },
    { r: R * 0.86, y: 0.068 },
    { r: R * 0.86, y: top },
    { r: 0, y: top },
  ]);
  b.shadow(R * 1.3);
}

/** A collar round the stem at height y: a disc (radius R, `t` thick) in the band's color. */
function collar(stem: number, R: number, y: number, t: number): P[] {
  return [
    { r: stem, y },
    { r: R, y: y + 0.01, m: B },
    { r: R, y: y + t },
    { r: R * 0.8, y: y + t + 0.01 },
    { r: stem, y: y + t + 0.015 },
  ];
}

function pawn(): PieceMesh {
  const b = new Builder();
  base(b, 0.215, 0.09);
  const head = { cy: 0.5, r: 0.12 };
  b.lathe(
    [
      { r: 0, y: 0.09 },
      { r: 0.168, y: 0.09 },
      { r: 0.15, y: 0.11 },
      { r: 0.122, y: 0.135 },
      { r: 0.1, y: 0.18 },
      { r: 0.087, y: 0.26 },
      { r: 0.078, y: 0.33 },
      ...collar(0.078, 0.145, 0.335, 0.03),
      { r: 0.06, y: 0.39 },
      ...arc(0, head.cy, head.r, -Math.acos(0.06 / head.r), Math.PI / 2, 10),
    ],
    SEGS,
  );
  return b.done(head.cy + head.r);
}

function rook(): PieceMesh {
  const b = new Builder();
  base(b, 0.235, 0.1);
  const top = 0.6;
  b.lathe(
    [
      { r: 0, y: 0.1 },
      { r: 0.185, y: 0.1 },
      { r: 0.165, y: 0.13 },
      { r: 0.148, y: 0.19 },
      { r: 0.138, y: 0.44 },
      { r: 0.15, y: 0.47 },
      { r: 0.19, y: 0.49, m: B },
      { r: 0.19, y: 0.52 },
      { r: 0.21, y: 0.53 },
      { r: 0.21, y: top },
      { r: 0.09, y: top },
      { r: 0.09, y: top - 0.03 },
      { r: 0, y: top - 0.03 },
    ],
    SEGS,
  );
  // The battlements: five merlons, one square to you (three show from the front, the notches between them).
  const n = 5;
  const gap = 0.36;
  for (let k = 0; k < n; k++) {
    const a0 = ((k - 0.5 + gap / 2) / n) * Math.PI * 2;
    const a1 = ((k + 0.5 - gap / 2) / n) * Math.PI * 2;
    b.ringBlock(a0, a1, 0.09, 0.21, top - 0.001, top + 0.1, MAT.body);
  }
  return b.done(top + 0.1);
}

/**
 * The knight's head in profile, its nose toward -x (as the board's knights), counter-clockwise: up the back of the neck (the
 * mane's arch) to the ear, down the face to the muzzle, the mouth, the jaw and the throat, the chest back to the base (a
 * height of 1, made the head's size below).
 */
export const PIXEL_KNIGHT: readonly (readonly [number, number])[] = (
  [
    [0.22, 0.0],
    [0.28, 0.2],
    [0.29, 0.4],
    [0.26, 0.56],
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
    [-0.24, 0.1],
    [-0.27, 0.0],
  ] as const
).map(([x, y]) => [0.7 * x + 0.04, 0.1 + 0.7 * y] as const);

function knight(): PieceMesh {
  const b = new Builder();
  base(b, 0.235, 0.1);
  b.lathe([{ r: 0, y: 0.1 }, { r: 0.19, y: 0.1, m: B }, { r: 0.19, y: 0.12 }, { r: 0, y: 0.12 }], SEGS);
  extrude(b, PIXEL_KNIGHT, 0.105, 0.03, PIXEL_KNIGHT_TURN, MAT.head);
  return b.done(Math.max(...PIXEL_KNIGHT.map((p) => p[1])));
}

function bishop(): PieceMesh {
  const b = new Builder();
  base(b, 0.23, 0.1);
  const y0 = 0.565;
  const h = 0.245;
  const mitre: P[] = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    const r = 0.13 * Math.sqrt(Math.max(0, 1 - ((t - 0.36) / 0.64) ** 2));
    mitre.push({ r: k === 12 ? 0 : Math.max(r, 0.012), y: y0 + t * h, m: MAT.mitre });
  }
  b.lathe(
    [
      { r: 0, y: 0.1 },
      { r: 0.175, y: 0.1 },
      { r: 0.14, y: 0.135 },
      { r: 0.108, y: 0.19 },
      { r: 0.092, y: 0.32 },
      { r: 0.082, y: 0.46 },
      ...collar(0.082, 0.155, 0.47, 0.032),
      { r: 0.075, y: 0.53 },
      { r: 0.095, y: 0.55 },
      ...mitre,
    ],
    SEGS,
  );
  b.ball(0, y0 + h + 0.03, 0, 0.036, B);
  return b.done(y0 + h + 0.066);
}

function queen(): PieceMesh {
  const b = new Builder();
  base(b, 0.25, 0.1);
  const rim = 0.88;
  b.lathe(
    [
      { r: 0, y: 0.1 },
      { r: 0.19, y: 0.1 },
      { r: 0.152, y: 0.14 },
      { r: 0.12, y: 0.2 },
      { r: 0.102, y: 0.4 },
      { r: 0.092, y: 0.58 },
      ...collar(0.092, 0.17, 0.59, 0.034),
      { r: 0.096, y: 0.66 },
      { r: 0.105, y: 0.7 },
      { r: 0.13, y: 0.76 },
      { r: 0.175, y: rim - 0.025 },
      { r: 0.195, y: rim - 0.01, m: B },
      { r: 0.195, y: rim + 0.015 },
      { r: 0.15, y: rim + 0.02 },
      ...arc(0, rim - 0.03, 0.15, Math.asin(0.05 / 0.15), Math.PI / 2, 6),
    ],
    SEGS,
  );
  // The coronet: five teeth round the rim, one square to you, and a ball on top.
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    b.ringBlock(a - 0.3, a + 0.3, 0.15, 0.2, rim + 0.01, rim + 0.085, B);
  }
  b.ball(0, rim + 0.15, 0, 0.05, B);
  return b.done(rim + 0.2);
}

function king(): PieceMesh {
  const b = new Builder();
  base(b, 0.26, 0.1);
  b.lathe(
    [
      { r: 0, y: 0.1 },
      { r: 0.2, y: 0.1 },
      { r: 0.16, y: 0.14 },
      { r: 0.128, y: 0.2 },
      { r: 0.112, y: 0.4 },
      { r: 0.098, y: 0.57 },
      ...collar(0.098, 0.172, 0.58, 0.036),
      { r: 0.094, y: 0.645 },
      ...collar(0.094, 0.124, 0.655, 0.018),
      { r: 0.096, y: 0.7 },
      { r: 0.13, y: 0.75 },
      { r: 0.178, y: 0.815 },
      { r: 0.2, y: 0.84, m: B },
      { r: 0.2, y: 0.866 },
      { r: 0.19, y: 0.885 },
      { r: 0.165, y: 0.903 },
      { r: 0.11, y: 0.92 },
      { r: 0.045, y: 0.928 },
      { r: 0, y: 0.93 },
    ],
    SEGS,
  );
  // The cross: chunky (its arms survive the one-pixel outline), thin front to back.
  const t = 0.045;
  const d = 0.03;
  b.box(-t, 0.91, -d, t, 1.18, d, B);
  b.box(-0.135, 1.03, -d, 0.135, 1.1, d, B);
  return b.done(1.18);
}

/** The six pixel pieces, built once ("p" … "k"), at PIXEL_SIZE. */
export function pixelMeshes(): Record<Kind, PieceMesh> {
  const all: Record<Kind, PieceMesh> = { p: pawn(), n: knight(), b: bishop(), r: rook(), q: queen(), k: king() };
  for (const k of KINDS) {
    const v = all[k].verts;
    for (let i = 0; i < v.length; i++) if (i % PV < 3) v[i] = v[i]! * PIXEL_SIZE;
    all[k].height *= PIXEL_SIZE;
  }
  return all;
}
