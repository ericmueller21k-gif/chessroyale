/**
 * The giant pieces in 3D (Oct 30, behind `?pieces=3d`; docs/decisions/2026-10-30-colosseum-3d-pieces.md). Eric: "the basic
 * pieces we're all used to seeing" (the board's own cburnett pieces) made 3D, chunky like the town's table pieces: "draw each
 * piece once as its own 3D version … then they're done … and we can reuse those later."
 *
 * Made once in code at load, pure numbers (no WebGL here, so the tests build them). Each follows its cburnett picture's outline
 * and proportions, measured in the picture's own units (its box is 45 across; `U` meters each), its base no wider than the
 * picture's: pawn, rook, bishop, queen and king turned in a few steps round (their facets show), with the rook's notches, the
 * bishop's slit (in the shader), the queen's points and the king's cross; the knight the cburnett horse's head, its outline
 * given depth with a bevel, on a round base. Each stands on y = 0 round the y axis, its front +z (the renderer turns it to face
 * you, as the flat pieces did, so a knight shows its profile, nose to the left, as on the board).
 *
 * Drawn in two flat tones and a thick dark outline (arena-gl.ts): every triangle faces outward (counter-clockwise seen from
 * outside), and each mesh carries its own outline, a copy of itself turned inside out that the shader pushes out along the
 * welded normals (an inverted hull). Every vertex: position, normal, material (body, the bishop's mitre, the knight's head,
 * the shadow under it with its alpha in the normal's x, or the outline).
 */

/** The six kinds, in the order the renderer draws them. */
export const KINDS = ["p", "n", "b", "r", "q", "k"] as const;
export type Kind = (typeof KINDS)[number];

/** A vertex's material. */
export const MAT = { body: 0, mitre: 2, shadow: 3, head: 4, outline: 10 } as const;

/** Floats a vertex: x, y, z, nx, ny, nz, material. */
export const PV = 7;

/** Meters a cburnett unit (its picture's box is 45 across): a pawn about 0.76 m tall on the board's 1 m squares. */
export const U = 0.025;

/** The bishop's slit (in the shader, in cburnett units): the line k·x + y = c across the mitre's front, `w` half its width. */
export const SLIT = { k: 1.4, c: 20.5, w: 0.55 } as const;
/** The knight's eye (in the shader, in cburnett units, its head's outline before it's turned): its middle and radius. */
export const EYE = { x: -9.3, y: 23.4, r: 1.15 } as const;
/** The knight's head turned this much (radians) toward you from a plain profile, so its depth shows. */
export const KNIGHT_TURN = 0.3;

export interface PieceMesh {
  /** Interleaved vertices (PV floats each), in meters. */
  verts: Float32Array;
  /** Triangles, as indices into `verts` (this mesh's own: 0 is its first vertex). */
  index: Uint16Array;
  /** How tall it stands (m). */
  height: number;
}

/** A profile point: radius and height (cburnett units); `m` the material of the stretch from this point to the next. */
interface P {
  r: number;
  y: number;
  m?: number;
}

/** Steps round a turned piece: few, so its facets show, as the table pieces' pixels. */
const SEGS = 10;

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

  /** A profile spun round the y axis (`segs` steps), at (cx, cy, cz): from the axis at the bottom, out, up and back to the axis. */
  lathe(pts: readonly P[], segs = SEGS, cx = 0, cy = 0, cz = 0, m0: number = MAT.body): void {
    for (let j = 0; j + 1 < pts.length; j++) {
      const p0 = pts[j]!;
      const p1 = pts[j + 1]!;
      const dr = p1.r - p0.r;
      const dy = p1.y - p0.y;
      const l = Math.hypot(dr, dy);
      if (l < 1e-6) continue;
      const nr = dy / l;
      const ny = -dr / l;
      const m = p0.m ?? m0;
      const base = this.n;
      for (let k = 0; k <= segs; k++) {
        const a = (k / segs) * Math.PI * 2;
        const s = Math.sin(a);
        const c = Math.cos(a);
        this.vert(cx + p0.r * s, cy + p0.y, cz + p0.r * c, nr * s, ny, nr * c, m);
        this.vert(cx + p1.r * s, cy + p1.y, cz + p1.r * c, nr * s, ny, nr * c, m);
      }
      for (let k = 0; k < segs; k++) {
        const a0 = base + k * 2;
        this.tri(a0, a0 + 1, a0 + 3);
        this.tri(a0, a0 + 3, a0 + 2);
      }
    }
  }

  /** A ball (radius `r`) at (cx, cy, cz). */
  ball(cx: number, cy: number, cz: number, r: number, segs = 8): void {
    this.lathe(arc(0, 0, r, -Math.PI / 2, Math.PI / 2, segs / 2 + 1), segs, cx, cy, cz);
  }

  /** A flat quad a, b, c, d (each [x, y, z]) with normal n. */
  quad(a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[], n: readonly number[], m: number = MAT.body): void {
    const q = [a, b, c, d].map((p) => this.vert(p[0]!, p[1]!, p[2]!, n[0]!, n[1]!, n[2]!, m));
    this.tri(q[0]!, q[1]!, q[2]!);
    this.tri(q[0]!, q[2]!, q[3]!);
  }

  /** A box from (x0, y0, z0) to (x1, y1, z1). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  }

  /** A block of a ring (a merlon): from angle a0 to a1, radius ri to ro, height y0 to y1. */
  ringBlock(a0: number, a1: number, ri: number, ro: number, y0: number, y1: number): void {
    const P = (a: number, r: number, y: number) => [Math.sin(a) * r, y, Math.cos(a) * r];
    const um = (a0 + a1) / 2;
    this.quad(P(a0, ro, y0), P(a1, ro, y0), P(a1, ro, y1), P(a0, ro, y1), [Math.sin(um), 0, Math.cos(um)]);
    this.quad(P(a1, ri, y0), P(a0, ri, y0), P(a0, ri, y1), P(a1, ri, y1), [-Math.sin(um), 0, -Math.cos(um)]);
    this.quad(P(a0, ro, y1), P(a1, ro, y1), P(a1, ri, y1), P(a0, ri, y1), [0, 1, 0]);
    this.quad(P(a0, ri, y0), P(a0, ro, y0), P(a0, ro, y1), P(a0, ri, y1), [-Math.cos(a0), 0, Math.sin(a0)]);
    this.quad(P(a1, ro, y0), P(a1, ri, y0), P(a1, ri, y1), P(a1, ro, y1), [Math.cos(a1), 0, -Math.sin(a1)]);
  }

  /** A four-sided point (the queen's): from a square of half-width `hw` round `base` (flat) up to `tip`. */
  spike(base: readonly number[], tip: readonly number[], hw: number): void {
    const c = [
      [base[0]! - hw, base[1]!, base[2]! - hw],
      [base[0]! + hw, base[1]!, base[2]! - hw],
      [base[0]! + hw, base[1]!, base[2]! + hw],
      [base[0]! - hw, base[1]!, base[2]! + hw],
    ];
    const mid = [(base[0]! + tip[0]!) / 2, (base[1]! + tip[1]!) / 2, (base[2]! + tip[2]!) / 2];
    for (let s = 0; s < 4; s++) {
      const a = c[s]!;
      const b = c[(s + 1) % 4]!;
      const fx = (a[0]! + b[0]! + tip[0]!) / 3 - mid[0]!;
      const fy = (a[1]! + b[1]! + tip[1]!) / 3 - mid[1]!;
      const fz = (a[2]! + b[2]! + tip[2]!) / 3 - mid[2]!;
      const q = [a, b, tip].map((p) => this.vert(p[0]!, p[1]!, p[2]!, fx, fy, fz, MAT.body));
      this.tri(q[0]!, q[1]!, q[2]!);
    }
  }

  /** The soft round shadow under a piece: a disc on the board, dark in the middle and fading out (alpha in the normal's x). */
  shadow(r: number): void {
    const segs = 16;
    const c = this.vert(0, 0, 0, 1, 0, 0, MAT.shadow);
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

  /**
   * The mesh in meters: every triangle turned to face outward (counter-clockwise from outside; the shadow's up), the normals
   * welded (every copy of a point gets their average, so the outline has no gaps at the corners), and the outline added: the
   * body again, inside out.
   */
  done(): PieceMesh {
    const v = this.v;
    const idx = this.i.slice();
    const at = (i: number, k: number) => v[i * PV + k]!;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t]!;
      const b = idx[t + 1]!;
      const c = idx[t + 2]!;
      const ux = at(b, 0) - at(a, 0);
      const uy = at(b, 1) - at(a, 1);
      const uz = at(b, 2) - at(a, 2);
      const wx = at(c, 0) - at(a, 0);
      const wy = at(c, 1) - at(a, 1);
      const wz = at(c, 2) - at(a, 2);
      const gx = uy * wz - uz * wy;
      const gy = uz * wx - ux * wz;
      const gz = ux * wy - uy * wx;
      const shadow = at(a, 6) === MAT.shadow;
      const nx = shadow ? 0 : at(a, 3) + at(b, 3) + at(c, 3);
      const ny = shadow ? 1 : at(a, 4) + at(b, 4) + at(c, 4);
      const nz = shadow ? 0 : at(a, 5) + at(b, 5) + at(c, 5);
      if (gx * nx + gy * ny + gz * nz < 0) ((idx[t + 1] = c), (idx[t + 2] = b));
    }
    const key = (i: number) => `${at(i, 0).toFixed(3)},${at(i, 1).toFixed(3)},${at(i, 2).toFixed(3)}`;
    const sum = new Map<string, [number, number, number]>();
    const n = this.n;
    for (let i = 0; i < n; i++) {
      if (at(i, 6) === MAT.shadow) continue;
      const s = sum.get(key(i)) ?? [0, 0, 0];
      sum.set(key(i), [s[0] + at(i, 3), s[1] + at(i, 4), s[2] + at(i, 5)]);
    }
    const out = new Float32Array(n * 2 * PV);
    let top = 0;
    for (let i = 0; i < n; i++) {
      const o = i * PV;
      out[o] = at(i, 0) * U;
      out[o + 1] = at(i, 1) * U;
      out[o + 2] = at(i, 2) * U;
      top = Math.max(top, out[o + 1]!);
      if (at(i, 6) === MAT.shadow) {
        for (let k = 3; k < 7; k++) out[o + k] = at(i, k);
      } else {
        const [x, y, z] = sum.get(key(i))!;
        const l = Math.hypot(x, y, z) || 1;
        out[o + 3] = x / l;
        out[o + 4] = y / l;
        out[o + 5] = z / l;
        out[o + 6] = at(i, 6);
      }
      // (Its outline's copy.)
      out.set(out.subarray(o, o + 6), (n + i) * PV);
      out[(n + i) * PV + 6] = MAT.outline;
    }
    const hull: number[] = [];
    for (let t = 0; t < idx.length; t += 3) if (at(idx[t]!, 6) !== MAT.shadow) hull.push(n + idx[t]!, n + idx[t + 2]!, n + idx[t + 1]!);
    return { verts: out, index: new Uint16Array([...idx, ...hull]), height: top };
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

// Each piece in cburnett units: its picture's half-widths (r, from the middle at 22.5) and heights up from its foot.

/** The pawn: a flared skirt (as wide as the picture's foot, 11.5), the round body, a neck, the ball of its head. */
function pawn(): PieceMesh {
  const b = new Builder();
  b.shadow(13.5);
  b.lathe([
    { r: 0, y: 0 },
    { r: 11.5, y: 0 },
    { r: 11.5, y: 1 },
    { r: 10.9, y: 3.5 },
    { r: 9.6, y: 6 },
    { r: 7.6, y: 9 },
    { r: 5.4, y: 11.7 },
    ...arc(0, 18.5, 6.5, -Math.acos(4.2 / 6.5), Math.acos(3.3 / 6.5), 5),
    ...arc(0, 26.5, 4, -Math.acos(3.3 / 4), Math.PI / 2, 4),
  ]);
  return b.done();
}

/** The rook: its two foot steps, the tower, the top widening out, six merlons round it (the notches between). */
function rook(): PieceMesh {
  const b = new Builder();
  b.shadow(15);
  b.lathe([
    { r: 0, y: 0 },
    { r: 13.5, y: 0 },
    { r: 13.5, y: 3 },
    { r: 10.5, y: 3 },
    { r: 10.5, y: 7 },
    { r: 8.5, y: 9.5 },
    { r: 8.5, y: 22 },
    { r: 11.5, y: 25 },
    { r: 11.5, y: 28 },
    { r: 7.5, y: 28 },
    { r: 7.5, y: 27 },
    { r: 0, y: 27 },
  ]);
  for (let k = 0; k < 6; k++) b.ringBlock(((k + 0.18) / 6) * Math.PI * 2, ((k + 0.82) / 6) * Math.PI * 2, 7.5, 11.5, 28, 31);
  return b.done();
}

/** The bishop: a foot, the collar, the waist, the mitre (its slit drawn in the shader) and the ball on top. */
function bishop(): PieceMesh {
  const b = new Builder();
  b.shadow(12.5);
  const mitre = [
    { r: 5, y: 12.5 },
    { r: 6.8, y: 14 },
    { r: 7.9, y: 16.5 },
    { r: 8.1, y: 18.5 },
    { r: 7.6, y: 21 },
    { r: 6.2, y: 23.5 },
    { r: 4, y: 26 },
    { r: 1.5, y: 27.7 },
    { r: 0, y: 28 },
  ].map((p) => ({ ...p, m: MAT.mitre }));
  b.lathe([{ r: 0, y: 0 }, { r: 10, y: 0 }, { r: 10, y: 2.5 }, { r: 8.5, y: 3 }, { r: 7.5, y: 5.5 }, { r: 7.5, y: 8.5 }, ...mitre]);
  b.ball(0, 30.3, 0, 2.5);
  return b.done();
}

/** The queen: her foot, the stem, the crown's band, six points leaning out round it, each with a ball, and one in the middle. */
function queen(): PieceMesh {
  const b = new Builder();
  b.shadow(14);
  b.lathe([
    { r: 0, y: 0 },
    { r: 11.5, y: 0 },
    { r: 11.5, y: 1.5 },
    { r: 11, y: 2.5 },
    { r: 10.5, y: 5 },
    { r: 10, y: 8.5 },
    { r: 10.5, y: 10 },
    { r: 13.5, y: 12.5 },
    { r: 13.5, y: 13.8 },
    { r: 11, y: 13.8 },
    { r: 0, y: 16 },
  ]);
  for (let k = 0; k < 6; k++) {
    const a = ((k + 0.5) / 6) * Math.PI * 2;
    const tip = [Math.sin(a) * 14.8, 26, Math.cos(a) * 14.8];
    b.spike([Math.sin(a) * 11.8, 13.5, Math.cos(a) * 11.8], tip, 1.9);
    b.ball(tip[0]!, tip[1]! + 1.6, tip[2]!, 2);
  }
  b.spike([0, 15, 0], [0, 28.5, 0], 2);
  b.ball(0, 30.3, 0, 2.1);
  return b.done();
}

/** The king: his foot and stem, the crown swelling out and closing over, the bud on top, the cross. */
function king(): PieceMesh {
  const b = new Builder();
  b.shadow(13);
  b.lathe([
    { r: 0, y: 0 },
    { r: 10, y: 0 },
    { r: 10, y: 1.5 },
    { r: 9.6, y: 3 },
    { r: 10, y: 8.5 },
    { r: 12, y: 11 },
    { r: 13.6, y: 14 },
    { r: 14.2, y: 17.5 },
    { r: 13.6, y: 20.5 },
    { r: 11.5, y: 22.8 },
    { r: 7.5, y: 24.3 },
    { r: 3.2, y: 25.2 },
    { r: 3, y: 26.5 },
    { r: 0, y: 27.3 },
  ]);
  const t = 1.6;
  b.box(-t, 26.5, -t, t, 36, t);
  b.box(-4.4, 30.2, -t, 4.4, 33.4, t);
  return b.done();
}

/**
 * The cburnett knight's outline as path segments (its picture's coordinates, y down): the back, the foot, the chest, the jaw,
 * the face, the ears. A point is [x, y]; a curve on from the last point is [c1x, c1y, c2x, c2y, x, y, t0, t1, steps], or with its
 * own start first (11 numbers) where only part of it is the outline.
 */
const KNIGHT_PATH: readonly (readonly number[])[] = [
  [22, 10],
  [32.5, 11, 38.5, 18, 38, 39, 0, 1, 6],
  [15, 39],
  [15, 30, 25, 32.5, 23, 18, 0, 0.88, 5],
  [24, 18, 24.38, 20.91, 18.45, 25.37, 16, 27, 0.35, 1, 4],
  [16, 27, 13, 29, 13.18, 31.34, 11, 31, 0, 1, 3],
  [10, 30],
  [10, 30, 9, 30, 5.997, 31, 6, 26, 0, 1, 3],
  [6, 26, 6, 24, 12, 14, 12, 14, 0, 1, 3],
  [12, 14, 12, 14, 13.89, 12.1, 14, 10.5, 0, 1, 2],
  [14, 10.5, 13.27, 9.506, 13.5, 8.5, 13.5, 7.5, 0, 1, 2],
  [13.5, 7.5, 14.5, 6.5, 16.5, 10, 16.5, 10, 0, 1, 3],
  [18.5, 10],
  [18.5, 10, 18.5, 10, 19.28, 8.008, 21, 7, 0, 1, 2],
  [21, 7, 22, 7, 22, 10, 22, 10, 0, 1, 2],
];

/**
 * The knight's outline (x, y in cburnett units: x from the middle of its foot, y up from its foot), counter-clockwise, its nose
 * toward -x as on the board. Sampled from the picture's own curves (the mouth's little notch left out: too small to show).
 */
export const KNIGHT_OUTLINE: readonly (readonly [number, number])[] = (() => {
  const pts: [number, number][] = [];
  let at: readonly number[] = [0, 0];
  for (const s of KNIGHT_PATH) {
    if (s.length === 2) {
      pts.push([s[0]!, s[1]!]);
      at = s;
      continue;
    }
    const c = s.length === 11 ? s : [at[0]!, at[1]!, ...s];
    const [x0, y0, c1x, c1y, c2x, c2y, x1, y1, t0, t1, n] = c as [number, number, number, number, number, number, number, number, number, number, number];
    for (let k = s.length === 11 && t0 > 0 ? 0 : 1; k <= n; k++) {
      const t = t0 + ((t1 - t0) * k) / n;
      const u = 1 - t;
      pts.push([u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1, u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1]);
    }
    at = pts[pts.length - 1]!;
  }
  const out: [number, number][] = [];
  for (const [x, y] of pts) {
    const p: [number, number] = [x - 24, 39 - y];
    const q = out[out.length - 1];
    if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.3) out.push(p);
  }
  if (Math.hypot(out[0]![0] - out[out.length - 1]![0], out[0]![1] - out[out.length - 1]![1]) < 0.3) out.pop();
  let area = 0;
  for (let i = 0; i < out.length; i++) {
    const a = out[i]!;
    const b = out[(i + 1) % out.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area < 0 ? out.reverse() : out;
})();

/** Ear clipping: triangles (indices into `pts`) of a simple counter-clockwise polygon. */
export function triangulate(pts: readonly (readonly [number, number])[]): number[] {
  const idx = pts.map((_, i) => i);
  const out: number[] = [];
  const cross = (o: readonly number[], a: readonly number[], b: readonly number[]) => (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const inside = (p: readonly number[], a: readonly number[], b: readonly number[], c: readonly number[]) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < 2000) {
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

/** The knight: a round foot, and the horse's head standing on it, its outline given depth with a bevelled edge, turned a little toward you. */
function knight(): PieceMesh {
  const b = new Builder();
  b.shadow(14);
  b.lathe([{ r: 0, y: 0 }, { r: 12, y: 0 }, { r: 12, y: 2.5 }, { r: 0, y: 2.5 }]);
  const P = KNIGHT_OUTLINE;
  const T = 4.6;
  const bev = 0.9;
  const N = P.length;
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
    const k = Math.min(2, 1 / Math.max(0.25, d / 2));
    return [p[0] - ((a[0] + c[0]) / 2) * k * bev, p[1] - ((a[1] + c[1]) / 2) * k * bev] as const;
  });
  const cs = Math.cos(KNIGHT_TURN);
  const sn = Math.sin(KNIGHT_TURN);
  const V = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => b.vert(x * cs + z * sn, y, -x * sn + z * cs, nx * cs + nz * sn, ny, -nx * sn + nz * cs, MAT.head);
  const tris = triangulate(P);
  for (const s of [1, -1]) {
    const f = inset.map(([x, y]) => V(x, y, s * T, 0, 0, s));
    for (let k = 0; k < tris.length; k += 3) b.tri(f[tris[k]!]!, f[tris[k + 1]!]!, f[tris[k + 2]!]!);
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const n = en[i]!;
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
  return b.done();
}

/** The six pieces, built once ("p" … "k"). */
export function pieceMeshes(): Record<Kind, PieceMesh> {
  return { p: pawn(), n: knight(), b: bishop(), r: rook(), q: queen(), k: king() };
}
