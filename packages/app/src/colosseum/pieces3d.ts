/**
 * The giant pieces in 3D (Oct 30, behind `?pieces=3d`; docs/decisions/2026-10-30-colosseum-3d-pieces.md). Eric: "make the chess
 * pieces 3D, but look the same kind of as the basic chess pieces that we're all used to seeing … draw each piece once as its
 * own 3D version … then they're done … and we can reuse those later."
 *
 * The six classic Staunton shapes, made once in code at load, pure numbers (no WebGL here, so the tests build them):
 * pawn, rook, bishop, queen and king are profiles spun round (a lathe), with their details (the rook's notches, the bishop's
 * slit, the queen's coronet, the king's cross); the knight is a horse's head drawn as an outline and given depth (extruded
 * with a bevel), on the same round base. Meters, a board square a meter; each piece stands on y = 0, its axis the y axis.
 * Its front faces +z (the renderer turns each piece round its axis to face you, as the flat pieces did, so a knight always
 * shows its profile and a bishop its slit).
 *
 * Every vertex: position, normal, and a material: body, gold trim, the bishop's mitre (where the slit is cut, in the shader),
 * the knight's head (its eye, in the shader), or the soft round shadow under the piece (its alpha in the normal's x).
 */

/** The six kinds, in the order the renderer draws them. */
export const KINDS = ["p", "n", "b", "r", "q", "k"] as const;
export type Kind = (typeof KINDS)[number];

/** A vertex's material. */
export const MAT = { body: 0, gold: 1, mitre: 2, shadow: 3, head: 4 } as const;

/** Floats a vertex: x, y, z, nx, ny, nz, material. */
export const PV = 7;

/** The bishop's slit (in the shader): the line k·x + y = `c` across the mitre's front (steep, as a real set's), `w` half its width. */
export const SLIT = { k: 1.6, c: 0.735, w: 0.012 } as const;
/** The knight's eye (in the shader): its middle in the head's outline (x, y) and its radius. */
export const EYE = { x: -0.075, y: 0.68, r: 0.024 } as const;
/** The knight's head turned this much (radians) toward you from a plain profile, so its depth and bevel show. */
export const KNIGHT_TURN = 0.38;

export interface PieceMesh {
  /** Interleaved vertices (PV floats each). */
  verts: Float32Array;
  /** Triangles, as indices into `verts` (this mesh's own: 0 is its first vertex). */
  index: Uint16Array;
  /** How tall it stands (m). */
  height: number;
}

/** A profile point: radius and height; `m` the material of the stretch from this point to the next. */
interface P {
  r: number;
  y: number;
  m?: number;
}

class Builder {
  readonly v: number[] = [];
  readonly i: number[] = [];
  get n(): number {
    return this.v.length / PV;
  }
  vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, m: number): number {
    const l = Math.hypot(nx, ny, nz) || 1;
    this.v.push(x, y, z, nx / l, ny / l, nz / l, m);
    return this.n - 1;
  }
  tri(a: number, b: number, c: number): void {
    this.i.push(a, b, c);
  }

  /**
   * A profile spun round the y axis (`segs` steps), at (cx, cy, cz). The profile runs from the axis at the bottom, out, up and
   * back to the axis at the top. Normals are smooth along the profile where it bends gently, sharp at its corners.
   */
  lathe(pts: readonly P[], segs: number, cx = 0, cy = 0, cz = 0, m0: number = MAT.body): void {
    const fn: [number, number][] = [];
    for (let j = 0; j + 1 < pts.length; j++) {
      const dr = pts[j + 1]!.r - pts[j]!.r;
      const dy = pts[j + 1]!.y - pts[j]!.y;
      const l = Math.hypot(dr, dy) || 1;
      fn.push([dy / l, -dr / l]);
    }
    const smooth = (a: [number, number], b: [number, number]): [number, number] | null => (a[0] * b[0] + a[1] * b[1] > Math.cos((50 * Math.PI) / 180) ? [a[0] + b[0], a[1] + b[1]] : null);
    for (let j = 0; j + 1 < pts.length; j++) {
      const p0 = pts[j]!;
      const p1 = pts[j + 1]!;
      if (Math.hypot(p1.r - p0.r, p1.y - p0.y) < 1e-6) continue;
      const n0 = (j > 0 && smooth(fn[j - 1]!, fn[j]!)) || fn[j]!;
      const n1 = (j + 2 < pts.length && smooth(fn[j]!, fn[j + 1]!)) || fn[j]!;
      const m = p0.m ?? m0;
      const base = this.n;
      for (let k = 0; k <= segs; k++) {
        const a = (k / segs) * Math.PI * 2;
        const s = Math.sin(a);
        const c = Math.cos(a);
        this.vert(cx + p0.r * s, cy + p0.y, cz + p0.r * c, n0[0] * s, n0[1], n0[0] * c, m);
        this.vert(cx + p1.r * s, cy + p1.y, cz + p1.r * c, n1[0] * s, n1[1], n1[0] * c, m);
      }
      for (let k = 0; k < segs; k++) {
        const a0 = base + k * 2;
        const b0 = a0 + 1;
        const a1 = a0 + 2;
        const b1 = a0 + 3;
        this.tri(a0, b0, b1);
        this.tri(a0, b1, a1);
      }
    }
  }

  /** A ball (radius `r`) at (cx, cy, cz). */
  ball(cx: number, cy: number, cz: number, r: number, m: number, segs = 10): void {
    this.lathe(arc(0, 0, r, -Math.PI / 2, Math.PI / 2, segs / 2 + 1), segs, cx, cy, cz, m);
  }

  /** A flat quad a, b, c, d (each [x, y, z]) with normal n. */
  quad(a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[], n: readonly number[], m: number): void {
    const q = [a, b, c, d].map((p) => this.vert(p[0]!, p[1]!, p[2]!, n[0]!, n[1]!, n[2]!, m));
    this.tri(q[0]!, q[1]!, q[2]!);
    this.tri(q[0]!, q[2]!, q[3]!);
  }

  /** A box from (x0, y0, z0) to (x1, y1, z1). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: number): void {
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], m);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], m);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], m);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], m);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], m);
  }

  /** A block of a ring (a merlon): from angle a0 to a1, radius ri to ro, height y0 to y1. */
  ringBlock(a0: number, a1: number, ri: number, ro: number, y0: number, y1: number, m: number): void {
    const steps = 3;
    const P = (a: number, r: number, y: number) => [Math.sin(a) * r, y, Math.cos(a) * r];
    for (let k = 0; k < steps; k++) {
      const u0 = a0 + ((a1 - a0) * k) / steps;
      const u1 = a0 + ((a1 - a0) * (k + 1)) / steps;
      const um = (u0 + u1) / 2;
      this.quad(P(u0, ro, y0), P(u1, ro, y0), P(u1, ro, y1), P(u0, ro, y1), [Math.sin(um), 0, Math.cos(um)], m);
      this.quad(P(u1, ri, y0), P(u0, ri, y0), P(u0, ri, y1), P(u1, ri, y1), [-Math.sin(um), 0, -Math.cos(um)], m);
      this.quad(P(u0, ro, y1), P(u1, ro, y1), P(u1, ri, y1), P(u0, ri, y1), [0, 1, 0], m);
    }
    this.quad(P(a0, ri, y0), P(a0, ro, y0), P(a0, ro, y1), P(a0, ri, y1), [-Math.cos(a0), 0, Math.sin(a0)], m);
    this.quad(P(a1, ro, y0), P(a1, ri, y0), P(a1, ri, y1), P(a1, ro, y1), [Math.cos(a1), 0, -Math.sin(a1)], m);
  }

  /** The soft round shadow under a piece: a disc on the board, dark in the middle and fading out (alpha in the normal's x). */
  shadow(r: number): void {
    const segs = 20;
    const c = this.vert(0, 0, 0, 1, 0, 0, MAT.shadow);
    // (The normal's length is 1 after normalizing: the alpha rides in x as a fraction of it, with y and z making up the rest.)
    const ring = (rr: number, alpha: number) => {
      const base = this.n;
      for (let k = 0; k < segs; k++) {
        const a = (k / segs) * Math.PI * 2;
        this.vert(Math.sin(a) * rr, 0, Math.cos(a) * rr, alpha, Math.sqrt(Math.max(0, 1 - alpha * alpha)), 0, MAT.shadow);
      }
      return base;
    };
    const mid = ring(r * 0.72, 0.8);
    const out = ring(r, 0);
    for (let k = 0; k < segs; k++) {
      const k1 = (k + 1) % segs;
      this.tri(c, mid + k, mid + k1);
      this.tri(mid + k, out + k, out + k1);
      this.tri(mid + k, out + k1, mid + k1);
    }
  }

  done(height: number): PieceMesh {
    return { verts: new Float32Array(this.v), index: new Uint16Array(this.i), height };
  }
}

/** Points on a circle round (cx, cy) in the profile (r = cx + R cos a, y = cy + R sin a), from angle a0 to a1. */
function arc(cx: number, cy: number, R: number, a0: number, a1: number, n: number, m?: number): P[] {
  const out: P[] = [];
  for (let k = 0; k < n; k++) {
    const a = a0 + ((a1 - a0) * k) / (n - 1);
    out.push({ r: Math.max(0, cx + R * Math.cos(a)), y: cy + R * Math.sin(a), m });
  }
  return out;
}

/** The round base every piece stands on: a foot, a gold line on its top edge, a waist up to `top` at radius `neck`. */
function base(R: number, top: number, neck: number): P[] {
  return [
    { r: 0, y: 0 },
    { r: R, y: 0 },
    { r: R, y: 0.045, m: MAT.gold },
    { r: R - 0.012, y: 0.062 },
    { r: R - 0.03, y: 0.072 },
    ...arc(R - 0.03, 0.072 + 0.06, 0.06, -Math.PI / 2, -Math.PI, 4).slice(1),
    { r: neck + (R - 0.09 - neck) * 0.4, y: top * 0.6 + 0.135 * 0.4 },
    { r: neck, y: top },
  ];
}

/** A collar: a disc round the stem at height y (radius R, `t` thick), its rim in gold. */
function collar(stem: number, R: number, y: number, t: number): P[] {
  return [
    { r: stem, y },
    { r: R, y: y + 0.005 },
    { r: R, y: y + t, m: MAT.gold },
    { r: R - 0.02, y: y + t + 0.015 },
    { r: stem, y: y + t + 0.02 },
  ];
}

const SEGS = 24;

/** The pawn: a base, a tapering stem, a collar, a ball for its head. */
function pawn(): PieceMesh {
  const b = new Builder();
  b.shadow(0.36);
  const head = { cy: 0.47, r: 0.125 };
  b.lathe(
    [
      ...base(0.27, 0.2, 0.105),
      { r: 0.085, y: 0.31 },
      ...collar(0.085, 0.165, 0.315, 0.03),
      { r: 0.075, y: 0.365 },
      ...arc(0, head.cy, head.r, -Math.acos(0.075 / head.r), Math.PI / 2, 9),
    ],
    SEGS,
  );
  return b.done(head.cy + head.r);
}

/** The rook: a base, a solid tower widening at the top, a ring of battlements with six notches cut. */
function rook(): PieceMesh {
  const b = new Builder();
  b.shadow(0.4);
  const top = 0.6;
  b.lathe(
    [
      ...base(0.3, 0.17, 0.17),
      { r: 0.158, y: 0.42 },
      { r: 0.19, y: 0.5 },
      { r: 0.215, y: 0.515, m: MAT.gold },
      { r: 0.215, y: 0.535 },
      { r: 0.2, y: 0.545 },
      { r: 0.205, y: top },
      { r: 0.135, y: top },
      { r: 0.135, y: top - 0.04 },
      { r: 0, y: top - 0.04 },
    ],
    SEGS,
  );
  // The battlements: six merlons, the notches between them.
  const n = 6;
  const gap = 0.3;
  for (let k = 0; k < n; k++) {
    const a0 = ((k + gap / 2) / n) * Math.PI * 2;
    const a1 = ((k + 1 - gap / 2) / n) * Math.PI * 2;
    b.ringBlock(a0, a1, 0.135, 0.205, top - 0.001, top + 0.085, MAT.body);
  }
  return b.done(top + 0.085);
}

/** The bishop: a base, a long stem, a collar, the mitre (an egg, its slit cut in the shader) and a ball on top. */
function bishop(): PieceMesh {
  const b = new Builder();
  b.shadow(0.38);
  const y0 = 0.565;
  const h = 0.27;
  const mitre: P[] = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    const r = 0.155 * Math.sqrt(Math.max(0, 1 - ((t - 0.36) / 0.64) ** 2));
    mitre.push({ r: k === 12 ? 0 : Math.max(r, 0.012), y: y0 + t * h, m: MAT.mitre });
  }
  b.lathe([...base(0.28, 0.2, 0.11), { r: 0.09, y: 0.47 }, ...collar(0.09, 0.175, 0.475, 0.03), { r: 0.085, y: 0.53 }, { r: 0.11, y: 0.55 }, ...mitre], SEGS);
  b.ball(0, y0 + h + 0.028, 0, 0.04, MAT.body);
  return b.done(y0 + h + 0.068);
}

/** The queen: a base, a tall stem, a collar, a crown cup with its coronet of points round the rim, a ball on top. */
function queen(): PieceMesh {
  const b = new Builder();
  b.shadow(0.42);
  const rim = 0.9;
  b.lathe(
    [
      ...base(0.31, 0.24, 0.12),
      { r: 0.095, y: 0.58 },
      ...collar(0.095, 0.195, 0.585, 0.032),
      { r: 0.11, y: 0.66 },
      ...collar(0.1, 0.15, 0.665, 0.02),
      { r: 0.105, y: 0.72 },
      { r: 0.14, y: 0.8 },
      { r: 0.2, y: rim - 0.01 },
      { r: 0.205, y: rim, m: MAT.gold },
      { r: 0.19, y: rim + 0.012 },
      { r: 0.15, y: rim + 0.012 },
      ...arc(0, rim - 0.02, 0.15, Math.asin(0.032 / 0.15), Math.PI / 2, 6),
    ],
    SEGS,
  );
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    b.ball(Math.sin(a) * 0.185, rim + 0.03, Math.cos(a) * 0.185, 0.034, MAT.gold, 8);
  }
  b.ball(0, rim + 0.17, 0, 0.05, MAT.gold);
  return b.done(rim + 0.22);
}

/** The king: a base, the tallest stem, a collar, a crown cup closed by a dome, and the cross on top. */
function king(): PieceMesh {
  const b = new Builder();
  b.shadow(0.43);
  const rim = 0.95;
  b.lathe(
    [
      ...base(0.32, 0.25, 0.125),
      { r: 0.1, y: 0.63 },
      ...collar(0.1, 0.205, 0.635, 0.034),
      { r: 0.115, y: 0.71 },
      ...collar(0.105, 0.155, 0.715, 0.02),
      { r: 0.11, y: 0.77 },
      { r: 0.19, y: rim - 0.01 },
      { r: 0.195, y: rim, m: MAT.gold },
      { r: 0.175, y: rim + 0.01 },
      ...arc(0, rim - 0.06, 0.175, Math.asin(0.07 / 0.175), Math.PI / 2, 6),
    ],
    SEGS,
  );
  // The cross, in gold, face-on to you.
  const y = rim + 0.1;
  b.lathe([{ r: 0, y: y - 0.02 }, { r: 0.05, y: y - 0.01 }, { r: 0.05, y: y + 0.01 }, { r: 0, y: y + 0.03 }], 12, 0, 0, 0, MAT.gold);
  const t = 0.035;
  b.box(-t, y, -t, t, y + 0.25, t, MAT.gold);
  b.box(-0.11, y + 0.13, -t, 0.11, y + 0.2, t, MAT.gold);
  return b.done(y + 0.25);
}

/**
 * The knight's head, an outline (x, y; its nose toward -x, as the board's knights face), counter-clockwise: the back of
 * the neck up to the ears, the face down to the muzzle, the jaw and the throat, the chest.
 */
export const KNIGHT_OUTLINE: readonly (readonly [number, number])[] = [
  [0.2, 0.15],
  [0.225, 0.3],
  [0.215, 0.44],
  [0.18, 0.56],
  [0.12, 0.66],
  [0.07, 0.74],
  [0.055, 0.81],
  [0.03, 0.865],
  [0.0, 0.8],
  [-0.03, 0.775],
  [-0.09, 0.745],
  [-0.16, 0.69],
  [-0.23, 0.62],
  [-0.285, 0.555],
  [-0.305, 0.5],
  [-0.29, 0.465],
  [-0.24, 0.45],
  [-0.17, 0.465],
  [-0.12, 0.445],
  [-0.085, 0.4],
  [-0.085, 0.33],
  [-0.13, 0.25],
  [-0.17, 0.15],
];

/** Ear clipping: triangles (indices into `pts`) of a simple counter-clockwise polygon. */
export function triangulate(pts: readonly (readonly [number, number])[]): number[] {
  const idx = pts.map((_, i) => i);
  const out: number[] = [];
  const cross = (o: readonly number[], a: readonly number[], b: readonly number[]) => (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const inside = (p: readonly number[], a: readonly number[], b: readonly number[], c: readonly number[]) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < 1000) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length]!;
      const i1 = idx[k]!;
      const i2 = idx[(k + 1) % idx.length]!;
      const a = pts[i0]!;
      const b = pts[i1]!;
      const c = pts[i2]!;
      if (cross(a, b, c) <= 0) continue;
      if (idx.some((j) => j !== i0 && j !== i1 && j !== i2 && inside(pts[j]!, a, b, c))) continue;
      out.push(i0, i1, i2);
      idx.splice(k, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) out.push(idx[0]!, idx[1]!, idx[2]!);
  return out;
}

/** The knight: the round base, then the horse's head, its outline given depth with a bevelled edge, turned a little toward you. */
function knight(): PieceMesh {
  const b = new Builder();
  b.shadow(0.4);
  b.lathe([...base(0.3, 0.16, 0.2), { r: 0.205, y: 0.17, m: MAT.gold }, { r: 0.2, y: 0.185 }, { r: 0, y: 0.185 }], SEGS);
  const P = KNIGHT_OUTLINE;
  const T = 0.12;
  const bev = 0.03;
  const N = P.length;
  // Each edge's outward normal (counter-clockwise: the right of its direction), and each corner's: smooth where it bends gently.
  const en = P.map((p, i) => {
    const q = P[(i + 1) % N]!;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l] as const;
  });
  const inset = P.map((p, i) => {
    const a = en[(i + N - 1) % N]!;
    const c = en[i]!;
    const d = 1 + a[0] * c[0] + a[1] * c[1];
    const k = Math.min(2.2, 1 / Math.max(0.2, d / 2));
    const mx = ((a[0] + c[0]) / 2) * k;
    const my = ((a[1] + c[1]) / 2) * k;
    return [p[0] - mx * bev, p[1] - my * bev] as const;
  });
  // Turned toward you a little round the upright axis (the nose comes forward), so the head's depth shows.
  const cs = Math.cos(KNIGHT_TURN);
  const sn = Math.sin(KNIGHT_TURN);
  const V = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => b.vert(x * cs + z * sn, y, -x * sn + z * cs, nx * cs + nz * sn, ny, -nx * sn + nz * cs, MAT.head);
  const tris = triangulate(inset);
  for (const s of [1, -1]) {
    const f = inset.map(([x, y]) => V(x, y, s * T, 0, 0, s));
    for (let k = 0; k < tris.length; k += 3) {
      if (s > 0) b.tri(f[tris[k]!]!, f[tris[k + 1]!]!, f[tris[k + 2]!]!);
      else b.tri(f[tris[k]!]!, f[tris[k + 2]!]!, f[tris[k + 1]!]!);
    }
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const n = en[i]!;
    // The side wall (flat along the edge), then the two bevels to the faces.
    const p0 = P[i]!;
    const p1 = P[j]!;
    const q0 = inset[i]!;
    const q1 = inset[j]!;
    const zt = T - bev;
    const w = [V(p0[0], p0[1], -zt, n[0], n[1], 0), V(p1[0], p1[1], -zt, n[0], n[1], 0), V(p1[0], p1[1], zt, n[0], n[1], 0), V(p0[0], p0[1], zt, n[0], n[1], 0)];
    b.tri(w[0]!, w[1]!, w[2]!);
    b.tri(w[0]!, w[2]!, w[3]!);
    for (const s of [1, -1]) {
      const bv = [V(p0[0], p0[1], s * zt, n[0], n[1], s), V(p1[0], p1[1], s * zt, n[0], n[1], s), V(q1[0], q1[1], s * T, n[0], n[1], s), V(q0[0], q0[1], s * T, n[0], n[1], s)];
      b.tri(bv[0]!, bv[1]!, bv[2]!);
      b.tri(bv[0]!, bv[2]!, bv[3]!);
    }
  }
  return b.done(Math.max(...P.map((p) => p[1])));
}

/**
 * How big the pieces are drawn: the shapes above are a real set's proportions with a square 0.8 m; the board's squares are a
 * meter, and the pieces read best from the stands a little bigger than a real set's (the king about 1.5 m, its base 0.8 m).
 */
export const SIZE = 1.25;

/** The six pieces, built once ("p" … "k"), at SIZE. */
export function pieceMeshes(): Record<Kind, PieceMesh> {
  const all: Record<Kind, PieceMesh> = { p: pawn(), n: knight(), b: bishop(), r: rook(), q: queen(), k: king() };
  for (const k of KINDS) {
    const v = all[k].verts;
    for (let i = 0; i < v.length; i++) if (i % PV < 3) v[i] = v[i]! * SIZE;
    all[k].height *= SIZE;
  }
  return all;
}
