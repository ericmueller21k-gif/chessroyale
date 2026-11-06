/**
 * The street town's boxes' roofs, made ready to draw (Nov 5, code round 3; boxes.ts has the geometry and the frame's plan, render.ts
 * draws it). Each roof face is painted once, top-down in its own plane at the art's 37 px a square: its tile (town-kit.ts ROOF_TILES in
 * the box's roof palette, or a hedge's own top), lit as the art says (the light stays with the camera, so a box gets one painting for
 * the camera facing north and one for east, and a turn blends the two), its ink edge round it (not a dome's or a vault's own seams)
 * and a flat roof's light parapet rim. A face is kept whole, for when it's drawn in one piece, and in triangles (a fan from its first
 * corner, each a pixel over its shared edges so no seam opens), for when its perspective needs them. A box's pieces are packed into a
 * sheet or two (so WebGL's atlas holds a few big pictures, not hundreds of small ones).
 *
 * Painting a box is a few milliseconds: render.ts does it ahead, a little a frame, nearest first (`TOWN_FEEL.boxBakeMs`).
 */
import { renderFrame, type Character } from "../characters/sprite.ts";
import { faceLight, geomOf, worldNormal, type BoxInst, type FaceGeom } from "./boxes.ts";
import { roofTile, type TownBox } from "./town-kit.ts";

/** A piece of a sheet: its canvas, its rectangle there, and where its texture's (0, 0) lies on the sheet (`ox`, `oy`). */
export interface Piece {
  cv: HTMLCanvasElement;
  sx: number;
  sy: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
}
/** A face's pieces: whole, and its triangles (triangle k: corners 0, k + 1, k + 2). */
export interface FaceArt {
  whole: Piece;
  tris: Piece[];
}
/** A box's roof painted for one heading. */
export interface RoofArt {
  faces: FaceArt[];
}

const INK = [42, 33, 24] as const;
const RIM = [247, 241, 227] as const;
const SHEET = 512;

/** A tile's pixels (RGBA; 37 x 37, or a box's own: a run of hedge's tops side by side), by tile and palette. */
export interface Tile {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}
const tiles = new Map<string, Tile>();
function tilePixels(box: TownBox, tex: FaceGeom["tex"], own: Character | null): Tile {
  const key = own ? `own:${own.id}` : `${box.id}:${tex}`;
  let t = tiles.get(key);
  if (!t) {
    const ch = own ?? roofTile(tex, { ...box.roofPal }, `${tex}-${box.id}`);
    t = renderFrame(ch, ch.anims.idle!.frames[0]!);
    tiles.set(key, t);
  }
  return t;
}

/** A convex polygon's edges as lines (a, b, c: a x + b y + c is the distance inside), for many inside tests. */
function edges(xs: Float64Array, ys: Float64Array, idx: readonly number[]): Float64Array {
  // (The corners' winding in the texture frame: the sign of the area.)
  let area = 0;
  for (let k = 0; k < idx.length; k++) {
    const a = idx[k]!;
    const b = idx[(k + 1) % idx.length]!;
    area += xs[a]! * ys[b]! - xs[b]! * ys[a]!;
  }
  const s = area >= 0 ? 1 : -1;
  const out = new Float64Array(idx.length * 3);
  for (let k = 0; k < idx.length; k++) {
    const a = idx[k]!;
    const b = idx[(k + 1) % idx.length]!;
    const ex = xs[b]! - xs[a]!;
    const ey = ys[b]! - ys[a]!;
    const len = Math.hypot(ex, ey) || 1;
    // d = s (ex (y - ya) - ey (x - xa)) / len
    out[k * 3] = (-s * ey) / len;
    out[k * 3 + 1] = (s * ex) / len;
    out[k * 3 + 2] = (s * (ey * xs[a]! - ex * ys[a]!)) / len;
  }
  return out;
}
/** Is (x, y) inside the polygon (its `edges`), or within `pad` of it? */
function inside(e: Float64Array, x: number, y: number, pad: number): boolean {
  for (let k = 0; k < e.length; k += 3) if (e[k]! * x + e[k + 1]! * y + e[k + 2]! < -pad) return false;
  return true;
}

/**
 * A face's pixels, painted (pure: no canvas): its tile in its rows' direction, times `light`, its ink edge and rim; `w` x `h` with a
 * pixel's margin all round, texture point (X, Y) at pixel (X - tx0 + 1, Y - ty0 + 1).
 */
export function facePixels(fg: FaceGeom, tile: Tile, light: number): { w: number; h: number; data: Uint8ClampedArray; mask: Uint8Array } {
  const w = fg.tw + 2;
  const h = fg.th + 2;
  const data = new Uint8ClampedArray(w * h * 4);
  const mask = new Uint8Array(w * h);
  const e = edges(fg.tx, fg.ty, Array.from({ length: fg.n }, (_, k) => k));
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const X = fg.tx0 - 1 + i + 0.5;
      const Y = fg.ty0 - 1 + j + 0.5;
      if (!inside(e, X, Y, 0.35)) continue;
      mask[j * w + i] = 1;
    }
  // How far each pixel is inside (1: on the edge), up to 4, through its four neighbours.
  const dist = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (!mask[k]) continue;
      const out = i === 0 || j === 0 || i === w - 1 || j === h - 1 || !mask[k - 1] || !mask[k + 1] || !mask[k - w] || !mask[k + w];
      dist[k] = out ? 1 : 0;
    }
  for (let d = 2; d <= 4; d++)
    for (let j = 1; j < h - 1; j++)
      for (let i = 1; i < w - 1; i++) {
        const k = j * w + i;
        if (!mask[k] || dist[k]) continue;
        if (dist[k - 1] === d - 1 || dist[k + 1] === d - 1 || dist[k - w] === d - 1 || dist[k + w] === d - 1) dist[k] = d;
      }
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (!mask[k]) continue;
      const X = Math.floor(fg.tx0 - 1 + i);
      const Y = Math.floor(fg.ty0 - 1 + j);
      // (Rows along u: the tile's x along the face's first edge; along t: its y.)
      const a = fg.rows === "u" ? X : Y;
      const b = fg.rows === "u" ? Y : X;
      const o = ((((b % tile.h) + tile.h) % tile.h) * tile.w + (((a % tile.w) + tile.w) % tile.w)) * 4;
      const px = tile.data;
      let r = px[o]! * light;
      let g = px[o + 1]! * light;
      let bl = px[o + 2]! * light;
      const dk = dist[k]!;
      if (dk === 1 && !fg.soft) {
        r += (INK[0] - r) * 0.85;
        g += (INK[1] - g) * 0.85;
        bl += (INK[2] - bl) * 0.85;
      } else if (fg.rim && (dk === 3 || dk === 4)) {
        r += (RIM[0] - r) * 0.8;
        g += (RIM[1] - g) * 0.8;
        bl += (RIM[2] - bl) * 0.8;
      }
      const q = k * 4;
      data[q] = r;
      data[q + 1] = g;
      data[q + 2] = bl;
      data[q + 3] = 255;
    }
  return { w, h, data, mask };
}

/** A triangle of a face's painting: its pixels inside the triangle (and a pixel past its edges, inside the face), cropped. */
function triPixels(fg: FaceGeom, whole: { w: number; h: number; data: Uint8ClampedArray; mask: Uint8Array }, a: number, b: number, c: number) {
  const e = edges(fg.tx, fg.ty, [a, b, c]);
  const X0 = Math.max(0, Math.floor(Math.min(fg.tx[a]!, fg.tx[b]!, fg.tx[c]!) - fg.tx0));
  const Y0 = Math.max(0, Math.floor(Math.min(fg.ty[a]!, fg.ty[b]!, fg.ty[c]!) - fg.ty0));
  const X1 = Math.min(whole.w, Math.ceil(Math.max(fg.tx[a]!, fg.tx[b]!, fg.tx[c]!) - fg.tx0) + 3);
  const Y1 = Math.min(whole.h, Math.ceil(Math.max(fg.ty[a]!, fg.ty[b]!, fg.ty[c]!) - fg.ty0) + 3);
  const w = Math.max(1, X1 - X0);
  const h = Math.max(1, Y1 - Y0);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const wi = X0 + i;
      const wj = Y0 + j;
      const k = wj * whole.w + wi;
      if (!whole.mask[k]) continue;
      if (!inside(e, fg.tx0 - 1 + wi + 0.5, fg.ty0 - 1 + wj + 0.5, 1.2)) continue;
      const q = (j * w + i) * 4;
      data.set(whole.data.subarray(k * 4, k * 4 + 4), q);
    }
  // (Its texture (0, 0) at its pixel (1 - tx0 - X0, 1 - ty0 - Y0).)
  return { w, h, data, ox: 1 - fg.tx0 - X0, oy: 1 - fg.ty0 - Y0 };
}

/** Packs pictures into sheets (shelves, SHEET px wide), each with a 2 px gap. */
function pack(items: { w: number; h: number; data: Uint8ClampedArray; ox: number; oy: number }[]): Piece[] {
  const out: Piece[] = new Array(items.length);
  let sheets: { w: number; h: number; place: { i: number; x: number; y: number }[] }[] = [];
  let cur = { w: 0, h: 0, place: [] as { i: number; x: number; y: number }[] };
  let x = 0;
  let y = 0;
  let shelf = 0;
  // Tallest first, so shelves fill.
  const order = items.map((_, i) => i).sort((a, b) => items[b]!.h - items[a]!.h);
  for (const i of order) {
    const it = items[i]!;
    const w = it.w + 2;
    const h = it.h + 2;
    if (x + w > SHEET) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    if (y + h > SHEET && cur.place.length) {
      sheets.push(cur);
      cur = { w: 0, h: 0, place: [] };
      x = y = shelf = 0;
    }
    cur.place.push({ i, x: x + 1, y: y + 1 });
    cur.w = Math.max(cur.w, x + w);
    cur.h = Math.max(cur.h, y + h);
    x += w;
    shelf = Math.max(shelf, h);
  }
  if (cur.place.length) sheets.push(cur);
  for (const s of sheets) {
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, s.w);
    cv.height = Math.max(1, s.h);
    const img = new ImageData(cv.width, cv.height);
    for (const p of s.place) {
      const it = items[p.i]!;
      for (let j = 0; j < it.h; j++) img.data.set(it.data.subarray(j * it.w * 4, (j + 1) * it.w * 4), ((p.y + j) * cv.width + p.x) * 4);
      out[p.i] = { cv, sx: p.x, sy: p.y, w: it.w, h: it.h, ox: p.x + it.ox, oy: p.y + it.oy };
    }
    cv.getContext("2d")!.putImageData(img, 0, 0);
  }
  sheets = [];
  return out;
}

/**
 * Box `b`'s roof (its art `box`), painted for the camera facing quarter `q` (0 north, 1 east, 2 south, 3 west): every face, whole and
 * in triangles, packed into sheets.
 */
export function bakeRoof(b: BoxInst, box: TownBox, q: number): RoofArt {
  // (The camera's quarter: 0 north, 1 east, 2 south, 3 west; its heading's cosine and sine.)
  const hc = [1, 0, -1, 0][q & 3]!;
  const hs = [0, 1, 0, -1][q & 3]!;
  const g = geomOf(box);
  const n = { x: 0, y: 0 };
  const items: { w: number; h: number; data: Uint8ClampedArray; ox: number; oy: number }[] = [];
  const shape: number[] = [];
  for (const fg of g.faces) {
    worldNormal(b, fg.nx, fg.ny, n);
    const light = faceLight(n.x, n.y, fg.nz, hc, hs);
    const whole = facePixels(fg, tilePixels(box, fg.tex, b.tile), light);
    items.push({ w: whole.w, h: whole.h, data: whole.data, ox: 1 - fg.tx0, oy: 1 - fg.ty0 });
    for (let k = 0; k < fg.n - 2; k++) items.push(triPixels(fg, whole, 0, k + 1, k + 2));
    shape.push(fg.n - 2);
  }
  const pieces = pack(items);
  const faces: FaceArt[] = [];
  let at = 0;
  for (const nt of shape) {
    faces.push({ whole: pieces[at]!, tris: pieces.slice(at + 1, at + 1 + nt) });
    at += 1 + nt;
  }
  return { faces };
}

/** A wall's shade if it's one the camera rests at (the art's 6% or 30%: the camera facing north or east), else 0. */
export const restShade = (shade: number): number => (Math.abs(shade - 0.06) < 1e-3 ? 0.06 : Math.abs(shade - 0.3) < 1e-3 ? 0.3 : 0);
/** A picture darkened by `shade`, made once a picture and shade (a few: render.ts rounds a turning wall's to a twentieth): one draw. */
const shadedImgs = new WeakMap<HTMLCanvasElement, Map<number, HTMLCanvasElement>>();
export function shadedImg(img: HTMLCanvasElement, shade: number): HTMLCanvasElement {
  let m = shadedImgs.get(img);
  if (!m) shadedImgs.set(img, (m = new Map()));
  let s = m.get(shade);
  if (!s) {
    s = document.createElement("canvas");
    s.width = img.width;
    s.height = img.height;
    const g = s.getContext("2d")!;
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = shade;
    g.fillStyle = "#0b0a12";
    g.fillRect(0, 0, s.width, s.height);
    m.set(shade, s);
  }
  return s;
}
