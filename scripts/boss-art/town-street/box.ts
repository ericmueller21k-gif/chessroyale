/**
 * Depth for the street town's buildings (Nov 5, Eric: "you can clearly see the houses are flat"): each building becomes a
 * box made from its own front picture, worked out once per picture (browser side, for harness.ts). Mockup only.
 *
 *  - Its body: the picture's tall columns (fences, signs and yard bits in front stay on the front only).
 *  - Its roof line: each column's top, with anything narrower than ~2/3 of a square (chimneys, tanks, flag poles) taken out
 *    (`SPIKE`): those stand up as little boxes of their own on the roof.
 *  - Its sides: a wall the box's depth, as tall as the front's edge, in the front's own wall color and material (brick,
 *    siding, plaster, stone, logs, planks, glass, ice), its window rows and trim carried round the corner, a corner trim.
 *  - Its roof top: the roof line carried back over the depth, each column in the color of the front's roof there, in rows
 *    (shingles), a parapet on a flat roof.
 *
 * The world's pictures stand like cut-outs (a point h pixels up is drawn h x k / 37 above its foot: render.ts's rule), so
 * the box's top and sides are raised the same way and meet the front exactly.
 */
export type Mat = "brick" | "siding" | "plaster" | "stone" | "log" | "plank" | "glass" | "ice" | "canvas" | "paper";

export interface BoxModel {
  /** The body's first and last column (picture pixels). */
  x0: number;
  x1: number;
  /** Each column's roof height above the foot (spikes taken out), and as drawn. */
  h: Float32Array;
  raw: Float32Array;
  /** Each column's roof color. */
  roof: [number, number, number][];
  /** The narrow things standing up out of the roof line: runs of columns. */
  spikes: { x0: number; x1: number; color: [number, number, number] }[];
  /** A flat roof (a parapet round it). */
  flat: boolean;
  /** The side walls (left: its corner trim on the right, at the front; right: on the left) and their lights. */
  left: Side;
  right: Side;
}
export interface Side {
  img: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  /** The wall's height (px): its foot is the canvas's bottom row. */
  h: number;
}

const SPIKE = 24;
const TRIM: [number, number, number] = [247, 241, 227];
const INK = "#2a2118";
const lum = (c: readonly number[]) => (0.299 * c[0]! + 0.587 * c[1]! + 0.114 * c[2]!) / 255;
const css = (c: readonly number[], m = 1) => `rgb(${Math.min(255, c[0]! * m) | 0},${Math.min(255, c[1]! * m) | 0},${Math.min(255, c[2]! * m) | 0})`;

export function boxOf(img: HTMLCanvasElement, foot: readonly [number, number], mat: Mat, depthPx: number, spike = SPIKE): BoxModel {
  const w = img.width, H = img.height;
  const d = img.getContext("2d")!.getImageData(0, 0, w, H).data;
  const A = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= H ? 0 : d[(y * w + x) * 4 + 3]!);
  const C = (x: number, y: number): [number, number, number] => [d[(y * w + x) * 4]!, d[(y * w + x) * 4 + 1]!, d[(y * w + x) * 4 + 2]!];
  const fy = foot[1];
  // Each column's top, and how tall it stands.
  const top = new Int32Array(w).fill(fy);
  for (let x = 0; x < w; x++) for (let y = 0; y < fy; y++) if (A(x, y) > 160) { top[x] = y; break; }
  let tallest = 0;
  for (let x = 0; x < w; x++) tallest = Math.max(tallest, fy - top[x]!);
  // The body: the run of tall columns round the middle (at least 45% of the tallest).
  const tall = (x: number) => fy - top[x]! >= tallest * 0.45;
  let x0 = Math.floor(w / 2), x1 = x0;
  while (x0 > 0 && tall(x0 - 1)) x0--;
  while (x1 < w - 1 && tall(x1 + 1)) x1++;
  // Widen to the outermost tall columns (a gap in the middle doesn't split it).
  for (let x = 0; x < w; x++) if (tall(x)) (x0 = Math.min(x0, x), (x1 = Math.max(x1, x)));
  const raw = new Float32Array(w);
  for (let x = x0; x <= x1; x++) raw[x] = fy - top[x]!;
  // Spikes out: an opening (the min over a window, then the max), so only things wider than SPIKE stay in the roof line.
  const er = new Float32Array(w);
  const h = new Float32Array(w);
  const r = spike >> 1;
  for (let x = x0; x <= x1; x++) {
    let m = Infinity;
    for (let k = Math.max(x0, x - r); k <= Math.min(x1, x + r); k++) m = Math.min(m, raw[k]!);
    er[x] = m;
  }
  for (let x = x0; x <= x1; x++) {
    let m = 0;
    for (let k = Math.max(x0, x - r); k <= Math.min(x1, x + r); k++) m = Math.max(m, er[k]!);
    h[x] = Math.min(raw[x]!, m);
  }
  // Each column's roof color: a few pixels under its (smoothed) top; a very light one (a cornice's trim) reads as a roof's tar.
  const roof: [number, number, number][] = [];
  for (let x = 0; x < w; x++) {
    let c: [number, number, number] = [120, 110, 100];
    if (x >= x0 && x <= x1) {
      for (let y = Math.round(fy - h[x]!) + 2; y < fy; y++)
        if (A(x, y) > 200) {
          const cc = C(x, y);
          if (lum(cc) > 0.2) { c = cc; break; }
        }
      if (lum(c) > 0.82) c = [128, 118, 106];
    }
    roof.push(c);
  }
  const spikes: BoxModel["spikes"] = [];
  for (let x = x0; x <= x1; x++) {
    if (raw[x]! - h[x]! < 5) continue;
    let e = x;
    while (e + 1 <= x1 && raw[e + 1]! - h[e + 1]! >= 5) e++;
    if (e - x >= 3) {
      // Its color: its own top's, a couple of pixels in (not a window in it).
      const mx = Math.round((x + e) / 2);
      let c = C(mx, Math.min(fy - 1, top[mx]! + 2));
      if (c[2] > c[0] + 25 && lum(c) < 0.75) c = roof[mx]!;
      spikes.push({ x0: x, x1: e, color: c });
    }
    x = e;
  }
  let lo = Infinity, hi = 0;
  for (let x = x0 + 4; x <= x1 - 4; x++) (lo = Math.min(lo, h[x]!), (hi = Math.max(hi, h[x]!)));
  const flat = hi - lo < 6;
  // The wall's color: the commonest mid color by the body's edges, below the eaves.
  const wallOf = (ex: number, dir: 1 | -1): [number, number, number] => {
    const count = new Map<string, number>();
    const eave = fy - Math.min(h[x0 + 1]!, h[x1 - 1]!);
    for (let x = ex; Math.abs(x - ex) < 22; x += dir)
      for (let y = Math.round(eave + 6); y < fy - 6; y++) {
        if (A(x, y) < 220) continue;
        const c = C(x, y);
        const L = lum(c);
        if (L < 0.22 || L > 0.93) continue;
        if (c[2] > c[0] + 25 && c[2] > c[1] + 5 && L < 0.6) continue; // (window glass)
        const k = `${c[0] >> 3},${c[1] >> 3},${c[2] >> 3}`;
        count.set(k, (count.get(k) ?? 0) + 1);
      }
    let best = "", n = 0;
    for (const [k, v] of count) if (v > n) ((best = k), (n = v));
    return best ? (best.split(",").map((s) => Number(s) * 8 + 4) as [number, number, number]) : [200, 180, 150];
  };
  // Window rows and trim rows by an edge (glass colors / trim), else a row a floor.
  const rowsBy = (ex: number, dir: 1 | -1) => {
    const glass: number[] = [];
    const trim: number[] = [];
    for (let y = 0; y < fy - 4; y++) {
      let g = 0, t = 0;
      for (let x = ex; Math.abs(x - ex) < 26; x += dir) {
        if (A(x, y) < 220) continue;
        const c = C(x, y);
        if ((c[0] === 59 && c[1] === 77 && c[2] === 107) || (c[0] === 143 && c[1] === 180 && c[2] === 217)) g++;
        if (c[0] === 247 && c[1] === 241 && c[2] === 227) t++;
      }
      if (g >= 3) glass.push(y);
      if (t >= 12) trim.push(y);
    }
    const bands: { y: number; h: number }[] = [];
    for (const y of glass) {
      const last = bands.at(-1);
      if (last && y <= last.y + last.h + 1) last.h = y - last.y + 1;
      else bands.push({ y, h: 1 });
    }
    return { bands: bands.filter((b) => b.h >= 6), trim };
  };
  const side = (ex: number, dir: 1 | -1, trimAtRight: boolean): Side => {
    const hh = Math.max(4, Math.round(h[ex]!));
    const rows = rowsBy(ex, dir);
    return sideWall(depthPx, hh, wallOf(ex, dir), mat, rows.bands.map((b) => ({ y: b.y - (fy - hh), h: b.h })), rows.trim.map((y) => y - (fy - hh)), trimAtRight);
  };
  return { x0, x1, h, raw, roof, spikes, flat, left: side(x0 + 1, 1, true), right: side(x1 - 1, -1, false) };
}

/** A side wall: `L` px long (the box's depth), `H` tall, in `wall` and `mat`; its windows (rows from its top), its trim. */
function sideWall(L: number, H: number, wall: [number, number, number], mat: Mat, bands: { y: number; h: number }[], trim: number[], trimAtRight: boolean): Side {
  const img = document.createElement("canvas");
  img.width = L;
  img.height = H + 1;
  const g = img.getContext("2d")!;
  const lit = document.createElement("canvas");
  lit.width = L;
  lit.height = H + 1;
  const lg = lit.getContext("2d")!;
  const px = (x: number, y: number, c: readonly number[], m = 1) => ((g.fillStyle = css(c, m)), g.fillRect(x, y, 1, 1));
  const hash = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
  for (let y = 0; y <= H; y++)
    for (let x = 0; x < L; x++) {
      let m = 1;
      if (mat === "brick") m = y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 3) % 6 === 0 ? 0.8 : 1;
      else if (mat === "siding") m = y % 5 === 4 ? 0.82 : 1;
      else if (mat === "plaster" || mat === "paper") m = hash(x, y) > 0.95 ? 0.93 : hash(x, y) < 0.04 ? 1.05 : 1;
      else if (mat === "stone") m = y % 7 === 6 || (x + (Math.floor(y / 7) % 2) * 5) % 10 === 0 ? 0.76 : 0.97 + (hash(Math.floor((x + (Math.floor(y / 7) % 2) * 5) / 10), Math.floor(y / 7)) - 0.5) * 0.1;
      else if (mat === "log") m = y % 6 === 5 ? 0.62 : y % 6 === 0 ? 1.1 : 1;
      else if (mat === "plank") m = x % 6 === 5 ? 0.7 : 1;
      else if (mat === "ice") m = y % 8 === 7 || (x + (Math.floor(y / 8) % 2) * 6) % 12 === 0 ? 1.12 : 1;
      else if (mat === "canvas") m = Math.floor(x / 8) % 2 ? 1 : 1.25;
      if (mat === "glass") {
        const frame = x % 12 === 0 || y % 14 === 0;
        const c = frame ? [64, 112, 72] : [190, 228, 236];
        px(x, y, c, frame ? 1 : (x + y) % 23 < 3 ? 1.06 : 0.94);
        continue;
      }
      px(x, y, wall, m);
    }
  // Trim rows carried round (a cornice, a string course).
  for (const y of trim) if (y >= 0 && y <= H) (g.fillStyle = css(TRIM)), g.fillRect(0, y, L, 1);
  // Windows: the front's rows, a window every 30 px along (none on glass, ice or canvas).
  if (mat !== "glass" && mat !== "ice" && mat !== "canvas") {
    let rows = bands.filter((b) => b.y > 2 && b.y + b.h < H - 2);
    if (!rows.length && H > 40) for (let y = 8; y + 16 < H - 8; y += 30) rows.push({ y, h: 14 });
    for (const b of rows)
      for (let x = 9; x + 12 < L - 6; x += 30) {
        g.fillStyle = INK;
        g.fillRect(x - 1, b.y - 1, 14, b.h + 2);
        g.fillStyle = css(TRIM);
        g.fillRect(x, b.y, 12, b.h);
        g.fillStyle = "#3b4d6b";
        g.fillRect(x + 1, b.y + 1, 10, b.h - 2);
        g.fillStyle = "#8fb4d9";
        g.fillRect(x + 1, b.y + 1, 4, Math.max(2, (b.h - 2) >> 1));
        g.fillStyle = css(TRIM);
        g.fillRect(x - 1, b.y + b.h, 14, 2);
        lg.fillStyle = "#ffb85c";
        lg.fillRect(x + 1, b.y + 1, 10, b.h - 2);
      }
  }
  // The corner trim at the front, the wall's top edge and its back edge in the outline's ink.
  const cx = trimAtRight ? L - 3 : 0;
  g.fillStyle = css(TRIM, mat === "glass" ? 0.7 : 1);
  g.fillRect(cx, 0, 3, H + 1);
  g.fillStyle = css(TRIM, 0.82);
  g.fillRect(trimAtRight ? L - 1 : 2, 0, 1, H + 1);
  g.fillStyle = INK;
  g.fillRect(0, 0, L, 1);
  g.fillRect(trimAtRight ? 0 : L - 1, 0, 1, H + 1);
  const glow = document.createElement("canvas");
  glow.width = L;
  glow.height = H + 1;
  const gg = glow.getContext("2d")!;
  gg.filter = "blur(3px)";
  gg.drawImage(lit, 0, 0);
  gg.filter = "none";
  gg.drawImage(lit, 0, 0);
  return { img, glow, h: H };
}
