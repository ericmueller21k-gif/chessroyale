/**
 * The 3D art kit's faces (Nov 6; brief-3d-kit): each face painted once as a pixel grid at the art's texels, every pixel a palette
 * color. Pure: no canvas.
 *
 * - **Palette ramps.** Each key has three steps: [dark, base, light]. A model may give its own (hand-picked from the home's palette);
 *   a plain color's are derived once (`rampOf`: dark is the art's 30% shade toward SHADE, the street town's right-hand walls; light a
 *   touch brighter). Light is baked as a step along the ramp, never a multiply or an overlay at draw time, so every pixel drawn is one
 *   of the palette's colors.
 * - **Outline.** A 1-texel ink border (`k`) on each face's outer edges (none on a curved shape's facets, nor on a face too thin to
 *   have an inside), the sprites' 1-pixel weight.
 */
import type { Character } from "../../characters/sprite.ts";
import type { Step } from "./prims.ts";

export type Ramp = readonly [dark: string, base: string, light: string];
export type Ramps = Readonly<Record<string, Ramp>>;

/** The dark step: this much of the way toward SHADE (the street town's right-hand walls, today's 30%). */
export const SHADE = "#0b0a12";
export const DARK_MIX = 0.3;
/** The light step: the base this many times as bright (the street town's lit roofs reached 1.12, its flat ones 1.02). */
export const LIGHT_MUL = 1.06;

/** "#rrggbb" or "#rrggbbaa" as [r, g, b, a]. */
export function rgba(c: string): [number, number, number, number] {
  const s = c.replace("#", "");
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, s.length === 8 ? parseInt(s.slice(6), 16) : 255];
}
const hex2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
/** [r, g, b, a] as "#rrggbb" (or "#rrggbbaa" when see-through). */
export const toHex = (r: number, g: number, b: number, a = 255): string => `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 255 ? hex2(a) : ""}`;

/** A plain color's derived ramp: [dark, base, light] (its alpha kept). */
export function rampOf(c: string): Ramp {
  const [r, g, b, a] = rgba(c);
  const [sr, sg, sb] = rgba(SHADE);
  const dark = toHex(r + (sr - r) * DARK_MIX, g + (sg - g) * DARK_MIX, b + (sb - b) * DARK_MIX, a);
  return [dark, toHex(r, g, b, a), toHex(r * LIGHT_MUL, g * LIGHT_MUL, b * LIGHT_MUL, a)];
}
/** A palette's ramps: each key's own, or derived from its color. */
export function rampsOf(pal: Readonly<Record<string, string | Ramp>>): Record<string, Ramp> {
  const out: Record<string, Ramp> = {};
  for (const [k, v] of Object.entries(pal)) out[k] = typeof v === "string" ? rampOf(v) : ([toHex(...rgba(v[0])), toHex(...rgba(v[1])), toHex(...rgba(v[2]))] as Ramp);
  return out;
}
/** Every color a palette's ramps hold (lower case): what a baked pixel may be. */
export function rampColors(r: Ramps): Set<string> {
  return new Set(Object.values(r).flatMap((x) => x.map((c) => c.toLowerCase())));
}

/** A palette one step along its ramps (each color's own derived ramp). */
export function stepPalette(pal: Readonly<Record<string, string>>, step: Step): Record<string, string> {
  if (step === 0) return { ...pal };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(pal)) out[k] = rampOf(v)[step + 1]!;
  return out;
}
/** A picture with its palette (its looks', its frames' own changes) one step along the ramps: a wall in shade, as palette colors. */
const stepped = new WeakMap<Character, Map<Step, Character>>();
export function stepChar(ch: Character, step: Step): Character {
  if (step === 0) return ch;
  let m = stepped.get(ch);
  if (!m) stepped.set(ch, (m = new Map()));
  let s = m.get(step);
  if (!s) {
    const anims = Object.fromEntries(
      Object.entries(ch.anims).map(([name, an]) => [name, { ...an, frames: an.frames.map((f) => (f.pal ? { ...f, pal: stepPalette(f.pal, step) } : f)) }]),
    );
    const looks = ch.looks ? Object.fromEntries(Object.entries(ch.looks).map(([n, l]) => [n, stepPalette(l, step)])) : undefined;
    s = { ...ch, id: `${ch.id}~${step}`, palette: stepPalette(ch.palette, step), ...(ch.halo ? { halo: rampOf(ch.halo)[step + 1] } : {}), ...(looks ? { looks } : {}), anims };
    m.set(step, s);
  }
  return s;
}

// ---- A face's pixels.

/** A face in its texture's plane: its corners (texels) and the box of whole texels it covers (from tx0, ty0, tw x th). */
export interface Poly {
  n: number;
  tx: ArrayLike<number>;
  ty: ArrayLike<number>;
  tx0: number;
  ty0: number;
  tw: number;
  th: number;
}
/** A face painted: `w` x `h` with a pixel's margin all round (texture point (X, Y) at pixel (X - tx0 + 1, Y - ty0 + 1)), and which pixels are its own. */
export interface Baked {
  w: number;
  h: number;
  data: Uint8ClampedArray;
  mask: Uint8Array;
}
export interface BakeOpts {
  /** The outline's key (default "k"); null: none. */
  ink?: string | null;
  /** A flat roof's parapet: a light rim (this key) two texels in from its edge. */
  rim?: string;
  /** Part of a curved surface: no outline of its own. */
  soft?: boolean;
}

/** A convex polygon's edges as lines (a, b, c: a x + b y + c is the distance inside), for many inside tests. */
export function edges(xs: ArrayLike<number>, ys: ArrayLike<number>, idx: readonly number[]): Float64Array {
  let ar = 0;
  for (let k = 0; k < idx.length; k++) {
    const a = idx[k]!;
    const b = idx[(k + 1) % idx.length]!;
    ar += xs[a]! * ys[b]! - xs[b]! * ys[a]!;
  }
  const s = ar >= 0 ? 1 : -1;
  const out = new Float64Array(idx.length * 3);
  for (let k = 0; k < idx.length; k++) {
    const a = idx[k]!;
    const b = idx[(k + 1) % idx.length]!;
    const ex = xs[b]! - xs[a]!;
    const ey = ys[b]! - ys[a]!;
    const len = Math.hypot(ex, ey) || 1;
    out[k * 3] = (-s * ey) / len;
    out[k * 3 + 1] = (s * ex) / len;
    out[k * 3 + 2] = (s * (ey * xs[a]! - ex * ys[a]!)) / len;
  }
  return out;
}
/** Is (x, y) inside the polygon (its `edges`), or within `pad` of it? */
export function inside(e: Float64Array, x: number, y: number, pad: number): boolean {
  for (let k = 0; k < e.length; k += 3) if (e[k]! * x + e[k + 1]! * y + e[k + 2]! < -pad) return false;
  return true;
}

/**
 * A face's pixels: `texel(X, Y)` (a palette key at whole texture point X, Y; null: nothing there) at the ramp step `step`, its ink
 * outline and a flat roof's rim. Every pixel is one of `ramps`' colors.
 */
export function bakeFace(p: Poly, texel: (X: number, Y: number) => string | null, ramps: Ramps, step: Step, o: BakeOpts = {}): Baked {
  const w = p.tw + 2;
  const h = p.th + 2;
  const data = new Uint8ClampedArray(w * h * 4);
  const mask = new Uint8Array(w * h);
  const e = edges(p.tx, p.ty, Array.from({ length: p.n }, (_, k) => k));
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) if (inside(e, p.tx0 - 1 + i + 0.5, p.ty0 - 1 + j + 0.5, 0.35)) mask[j * w + i] = 1;
  // How far each pixel is inside (1: on the edge), up to 4, through its four neighbors.
  const dist = new Uint8Array(w * h);
  let deep = false;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (!mask[k]) continue;
      dist[k] = i === 0 || j === 0 || i === w - 1 || j === h - 1 || !mask[k - 1] || !mask[k + 1] || !mask[k - w] || !mask[k + w] ? 1 : 0;
    }
  for (let d = 2; d <= 4; d++)
    for (let j = 1; j < h - 1; j++)
      for (let i = 1; i < w - 1; i++) {
        const k = j * w + i;
        if (!mask[k] || dist[k]) continue;
        if (dist[k - 1] === d - 1 || dist[k + 1] === d - 1 || dist[k - w] === d - 1 || dist[k + w] === d - 1) ((dist[k] = d), (deep = true));
      }
  const ink = o.soft || o.ink === null || !deep || p.tw < 4 || p.th < 4 ? null : (o.ink ?? "k");
  const px = new Map<string, readonly number[]>();
  const color = (key: string, st: Step): readonly number[] => {
    const id = `${key}${st}`;
    let c = px.get(id);
    if (!c) {
      const r = ramps[key];
      if (!r) throw new Error(`kit: no color for "${key}"`);
      px.set(id, (c = rgba(r[st + 1]!)));
    }
    return c;
  };
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (!mask[k]) continue;
      const dk = dist[k]!;
      let c: readonly number[] | null;
      if (ink && dk === 1) c = color(ink, 0);
      else if (o.rim && (dk === 3 || dk === 4)) c = color(o.rim, 0);
      else {
        const key = texel(Math.floor(p.tx0 - 1 + i), Math.floor(p.ty0 - 1 + j));
        c = key ? color(key, step) : null;
      }
      if (!c) {
        mask[k] = 0;
        continue;
      }
      const q = k * 4;
      data[q] = c[0]!;
      data[q + 1] = c[1]!;
      data[q + 2] = c[2]!;
      data[q + 3] = c[3]!;
    }
  return { w, h, data, mask };
}

/** A texture `w` x `h` texels of `fill`, with rectangles painted over it in order: [x, y, w, h, key] (a model's textures as data). */
export function gridOf(w: number, h: number, fill: string, marks: readonly (readonly [x: number, y: number, w: number, h: number, key: string])[] = []): string[] {
  const rows = Array.from({ length: h }, () => Array<string>(w).fill(fill));
  for (const [x, y, mw, mh, k] of marks)
    for (let j = Math.max(0, y); j < Math.min(h, y + mh); j++) for (let i = Math.max(0, x); i < Math.min(w, x + mw); i++) rows[j]![i] = k;
  return rows.map((r) => r.join(""));
}

/** A grid's key at texture point (X, Y), tiled from its top left ("." and " ": nothing). */
export function gridTexel(grid: readonly string[]): (X: number, Y: number) => string | null {
  const gh = grid.length;
  return (X, Y) => {
    const row = grid[((Y % gh) + gh) % gh]!;
    const c = row[((X % row.length) + row.length) % row.length]!;
    return c === "." || c === " " ? null : c;
  };
}

/** A picture to pack: its pixels and where its texture's (0, 0) lies in it. */
export interface Cut {
  w: number;
  h: number;
  data: Uint8ClampedArray;
  ox: number;
  oy: number;
}
/** A triangle (corners a, b, c) of a face's painting: its pixels inside the triangle (and a pixel past its edges, inside the face), cropped. */
export function triPixels(p: Poly, whole: Baked, a: number, b: number, c: number): Cut {
  const e = edges(p.tx, p.ty, [a, b, c]);
  const X0 = Math.max(0, Math.floor(Math.min(p.tx[a]!, p.tx[b]!, p.tx[c]!) - p.tx0));
  const Y0 = Math.max(0, Math.floor(Math.min(p.ty[a]!, p.ty[b]!, p.ty[c]!) - p.ty0));
  const X1 = Math.min(whole.w, Math.ceil(Math.max(p.tx[a]!, p.tx[b]!, p.tx[c]!) - p.tx0) + 3);
  const Y1 = Math.min(whole.h, Math.ceil(Math.max(p.ty[a]!, p.ty[b]!, p.ty[c]!) - p.ty0) + 3);
  const w = Math.max(1, X1 - X0);
  const h = Math.max(1, Y1 - Y0);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const wi = X0 + i;
      const wj = Y0 + j;
      const k = wj * whole.w + wi;
      if (!whole.mask[k]) continue;
      if (!inside(e, p.tx0 - 1 + wi + 0.5, p.ty0 - 1 + wj + 0.5, 1.2)) continue;
      data.set(whole.data.subarray(k * 4, k * 4 + 4), (j * w + i) * 4);
    }
  // (Its texture (0, 0) at its pixel (1 - tx0 - X0, 1 - ty0 - Y0).)
  return { w, h, data, ox: 1 - p.tx0 - X0, oy: 1 - p.ty0 - Y0 };
}
