/**
 * The GBA trial's rook and knight as 3D models (Eric, Nov 2: "actually draw the 3d model based on the 2d image you just
 * made for the horse and rook, then send me a view of it from the crowd"). Built from the 2D drawing's own template grids
 * (out/arena-pieces-gba, `PIECES`), one unit a sprite pixel:
 * - the rook and every base: each row of the sprite turned round the piece's axis (its half-width the radius, its gold rows
 *   gold rings, its dark rows grooves); the rook's top three rows a ring wall cut into four battlements round a sunken roof;
 * - the bishop: turned in 3D on the same base, its mitre's slit a gold strip;
 * - the knight's head: the sprite's head pushed out into a rounded slab (thicker toward its middle), the mane gold, the eye
 *   on both cheeks.
 * Drawn from a seat in the stands (looking down `PITCH`) at one screen pixel a unit, each pixel one ray: flat cel bands of
 * the drawing's palette (light from the top left and front), a 1-pixel outline round the shape and where a nearer part
 * covers a farther one. No blur, no in-between colors: every pixel is a palette color.
 *
 *   npx tsx scripts/boss-art/arena-pieces-3d.ts <empty-stills dir> <out dir> [pitch degrees]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
import { PIECES, PALETTE, FOOT_X, FOOT_Y } from "./out/arena-pieces-gba/arena-pieces-gba.ts";

const [inDir, outDir, pitchArg] = process.argv.slice(2) as [string, string, string?];
/** How far down the view looks at the pieces (degrees): the stands behind White, as Eric's picture shows its pieces. */
const PITCH = ((Number(pitchArg) || 30) * Math.PI) / 180;

type Mat = "body" | "gold" | "groove" | "eye";
type Side = "w" | "b";
const TONES: Record<Side, Record<Mat, string[]>> = {
  // highlight, light, mid, shade
  w: { body: ["W", "w", "c", "C"], gold: ["Y", "G", "G", "g"], groove: ["C", "C", "k", "k"], eye: ["k", "k", "k", "k"] },
  b: { body: ["B", "b", "d", "d"], gold: ["Y", "G", "G", "g"], groove: ["d", "K", "K", "K"], eye: ["Y", "Y", "G", "G"] },
};
const OUTLINE: Record<Side, string> = { w: "k", b: "K" };
const GOLD = new Set(["T", "U", "V", "R", "S", "Q", "M", "N"]);

/** A row of the sprite (frame row f) as a turned ring: its radius (the inside, outline left off) and material. */
function ringOf(grid: string[][], f: number): { r: number; mat: Mat } | null {
  const row = grid[f];
  if (!row) return null;
  const cells = row.filter((k) => k !== ".");
  if (!cells.length) return null;
  const inner = cells.filter((k) => k !== "O");
  const gold = inner.filter((k) => GOLD.has(k)).length;
  const mat: Mat = !inner.length ? "groove" : gold * 2 > inner.length ? "gold" : "body";
  return { r: inner.length ? inner.length / 2 : cells.length / 2 - 1, mat };
}

interface Model { inside(x: number, y: number, z: number): Mat | null }

/** World: y up, the foot at the origin, +z toward the viewer; frame row f spans y in [FOOT_Y - f, FOOT_Y - f + 1). */
const rowAt = (y: number) => FOOT_Y - Math.floor(y);

function turned(grid: string[][], from: number, to: number) {
  return (x: number, y: number, z: number): Mat | null => {
    const f = rowAt(y);
    if (f < from || f > to) return null;
    const ring = ringOf(grid, f);
    if (!ring) return null;
    return Math.hypot(x, z) <= ring.r ? ring.mat : null;
  };
}

function rookModel(): Model {
  const g = PIECES.r!;
  const body = turned(g, 18, 33);
  const R = ringOf(g, 18)!.r; // the crown's radius
  const WALL = 2;
  return {
    inside(x, y, z) {
      const f = rowAt(y);
      if (f >= 15 && f <= 17) {
        // Three rows of battlements: a ring wall, four merlons (one facing you), the roof sunk inside.
        const r = Math.hypot(x, z);
        if (r > R || r < R - WALL) return null;
        const a = Math.atan2(x, z); // 0 = toward you
        const sector = (((a / (Math.PI / 2)) % 1) + 1.5) % 1; // 0.5 at a merlon's middle
        // (Their flat tops gold, with the roof: the rook's top reads gold from the stands.)
        return Math.abs(sector - 0.5) < 0.3 ? (f === 15 ? "gold" : "body") : null;
      }
      // The roof inside the ring, sunk in its shadow.
      // The flat roof inside the ring: gold (Eric, Nov 2: "the rook flat area on the top should be gold").
      if (f === 18 && Math.hypot(x, z) < R - WALL) return "gold";
      return body(x, y, z);
    },
  };
}

function knightModel(): Model {
  const g = PIECES.n!;
  const base = turned(g, 25, 33);
  // The head's cells (frame rows 12..24) and each cell's distance (in cells) to the outside, for the slab's rounding.
  const H0 = 12, H1 = 24;
  const cell = (c: number, f: number) => (f >= H0 && f <= H1 ? (g[f]?.[c] ?? ".") : ".");
  const dist: number[][] = [];
  for (let f = H0; f <= H1; f++) {
    dist[f] = [];
    for (let c = 0; c < g[0]!.length; c++) {
      let d = 0;
      if (cell(c, f) !== ".")
        for (d = 1; d < 6; d++) {
          let edge = false;
          for (let dy = -d; dy <= d && !edge; dy++) for (let dx = -d; dx <= d && !edge; dx++) if (Math.hypot(dx, dy) <= d && cell(c + dx, f + dy) === ".") edge = true;
          if (edge) break;
        }
      dist[f]![c] = d;
    }
  }
  return {
    inside(x, y, z) {
      const f = rowAt(y);
      if (f > H1) return base(x, y, z);
      if (f < H0) return null;
      const c = Math.floor(x + FOOT_X + 0.5);
      const k = cell(c, f);
      if (k === ".") return null;
      const d = dist[f]![c]!;
      // The mane (Eric, Nov 2: gold) a flat-sided ridge down the back of the neck, so its side is one clean gold stripe.
      const half = k === "M" || k === "N" ? 2.4 : Math.min(2.8, 0.6 + 0.85 * d);
      if (Math.abs(z) > half) return null;
      if (k === "E") return Math.abs(z) > half - 0.8 ? "eye" : "body";
      return GOLD.has(k) ? "gold" : "body";
    },
  };
}

/**
 * The bishop (Eric, Nov 2: its mitre's "strip thing on top gold like in our reference"), turned like the rook: the shared
 * base, a stem narrowing up to a gold collar, the mitre (an egg narrowing to a point), a small ball on top, and the slit
 * across the mitre's front a gold strip, falling from the upper left to the lower right.
 */
function bishopModel(): Model {
  const base = turned(PIECES.r!, 25, 33);
  const radius = (y: number): [number, Mat] | null => {
    if (y < 9) return null;
    if (y < 12.6) return [3.5 - ((y - 9) / 3.6) * 1.2, "body"];
    if (y < 13.8) return [3.6, "gold"];
    if (y < 14.6) return [2.6, "body"];
    if (y < 16.2) return [2.6 + ((y - 14.6) / 1.6) * 0.9, "body"];
    if (y < 21.4) return [3.5 * Math.sqrt(Math.max(0, 1 - ((y - 16.2) / 5.2) ** 2)), "body"];
    return null;
  };
  return {
    inside(x, y, z) {
      if (y < 9) return base(x, y, z);
      if (Math.hypot(x, y - 22, z) <= 1.25) return "body";
      const pr = radius(y);
      if (!pr || Math.hypot(x, z) > pr[0]) return null;
      if (y > 15.4 && y < 21 && z > -0.5 && Math.abs(y - 18.4 + 0.75 * x) < 0.7) return "gold";
      return pr[1];
    },
  };
}

interface Shot { w: number; h: number; ax: number; ay: number; keys: (string | null)[][] }

/** Draws a model from the stands: one ray a pixel, flat tones, then the outline. `ax, ay`: the foot's pixel. */
function draw(m: Model, side: Side): Shot {
  const d = [0, -Math.sin(PITCH), -Math.cos(PITCH)];
  const up = [0, Math.cos(PITCH), -Math.sin(PITCH)];
  const L = (() => { const v = [-0.55, 0.7, 0.45]; const n = Math.hypot(...v); return v.map((a) => a / n); })();
  const W = 32, H = 34, ax = 16, ay = 27; // the foot (world origin) lands on pixel (16, 27)
  const depth: number[][] = Array.from({ length: H }, () => Array<number>(W).fill(Infinity));
  const keys: (string | null)[][] = Array.from({ length: H }, () => Array<string | null>(W).fill(null));
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const u = px + 0.5 - ax, v = ay - (py + 0.5);
      const o = [u - d[0]! * 40, up[1]! * v - d[1]! * 40, up[2]! * v - d[2]! * 40];
      for (let t = 0; t < 80; t += 0.03) {
        const p = [o[0]! + d[0]! * t, o[1]! + d[1]! * t, o[2]! + d[2]! * t];
        if (p[1]! < 0 || p[1]! >= 34) continue;
        const mat = m.inside(p[0]!, p[1]!, p[2]!);
        if (!mat) continue;
        // The surface's facing: the middle of the empty space round the hit, looking out.
        let nx = 0, ny = 0, nz = 0;
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) {
          const s = 0.45;
          if (Math.hypot(i, j, k) > 2.2 || (i === 0 && j === 0 && k === 0)) continue;
          if (!m.inside(p[0]! + i * s, p[1]! + j * s, p[2]! + k * s) && p[1]! + j * s >= 0) { nx += i; ny += j; nz += k; }
        }
        const n = Math.hypot(nx, ny, nz) || 1;
        const lit = (nx * L[0]! + ny * L[1]! + nz * L[2]!) / n;
        const tone = lit > 0.72 ? 0 : lit > 0.38 ? 1 : lit > 0.05 ? 2 : 3;
        keys[py]![px] = TONES[side][mat][tone]!;
        depth[py]![px] = t;
        break;
      }
    }
  // The outline: round the shape, and on the farther side of a jump in depth (a nearer part over a farther one).
  const out = keys.map((r) => r.slice());
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx!, y + dy!] as const).filter(([X, Y]) => X >= 0 && Y >= 0 && X < W && Y < H);
      if (!keys[y]![x]) { if (nb.some(([X, Y]) => keys[Y]![X])) out[y]![x] = OUTLINE[side]; continue; }
      if (nb.some(([X, Y]) => keys[Y]![X] && depth[Y]![X]! < depth[y]![x]! - 2.2)) out[y]![x] = OUTLINE[side];
    }
  return { w: W, h: H, ax, ay, keys: out };
}

// ---- pictures ----
interface Img { w: number; h: number; data: Uint8ClampedArray }
const hex = (c: string) => { const n = parseInt(c.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]; };
const blank = (w: number, h: number, c: string): Img => { const dd = new Uint8ClampedArray(w * h * 4); const v = hex(c); for (let i = 0; i < w * h; i++) dd.set(v, i * 4); return { w, h, data: dd }; };
const rect = (im: Img, x0: number, y0: number, w: number, h: number, c: string) => { const v = hex(c); for (let y = Math.max(0, y0); y < Math.min(im.h, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(im.w, x0 + w); x++) im.data.set(v, (y * im.w + x) * 4); };
const toImg = (s: Shot): Img => { const im: Img = { w: s.w, h: s.h, data: new Uint8ClampedArray(s.w * s.h * 4) }; s.keys.forEach((r, y) => r.forEach((k, x) => { if (k) im.data.set(hex(PALETTE[k]!), (y * s.w + x) * 4); })); return im; };
/** Paints `src` at scale `s` (any positive number: each source pixel a block from round(x·s) to round((x+1)·s)). */
const paint = (dst: Img, src: Img, x0: number, y0: number, s: number) => {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const si = (y * src.w + x) * 4; if (!src.data[si + 3]) continue;
    for (let Y = Math.round(y0 + y * s); Y < Math.round(y0 + (y + 1) * s); Y++) for (let X = Math.round(x0 + x * s); X < Math.round(x0 + (x + 1) * s); X++)
      if (X >= 0 && Y >= 0 && X < dst.w && Y < dst.h) dst.data.set(src.data.subarray(si, si + 4), (Y * dst.w + X) * 4);
  }
};
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t: string, dd: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(dd.length); const td = Buffer.concat([Buffer.from(t), dd]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const png = (im: Img) => { const h = Buffer.alloc(13); h.writeUInt32BE(im.w, 0); h.writeUInt32BE(im.h, 4); h[8] = 8; h[9] = 6; const raw = Buffer.alloc((im.w * 4 + 1) * im.h); for (let y = 0; y < im.h; y++) Buffer.from(im.data.buffer, y * im.w * 4, im.w * 4).copy(raw, y * (im.w * 4 + 1) + 1); return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", h), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]); };
const readPng = (f: string): Img => {
  const b = readFileSync(f); const w = b.readUInt32BE(16), h = b.readUInt32BE(20), ct = b[25]!; const bpp = ct === 6 ? 4 : 3;
  const idat: Buffer[] = []; for (let o = 8; o < b.length;) { const l = b.readUInt32BE(o); const t = b.toString("ascii", o + 4, o + 8); if (t === "IDAT") idat.push(b.subarray(o + 8, o + 8 + l)); o += 12 + l; }
  const raw = inflateSync(Buffer.concat(idat)); const st = w * bpp; const px = Buffer.alloc(st * h);
  for (let y = 0; y < h; y++) { const f0 = raw[y * (st + 1)]!; for (let x = 0; x < st; x++) {
    const r = raw[y * (st + 1) + 1 + x]!; const a = x >= bpp ? px[y * st + x - bpp]! : 0; const u = y ? px[(y - 1) * st + x]! : 0; const c = x >= bpp && y ? px[(y - 1) * st + x - bpp]! : 0;
    let v = r; if (f0 === 1) v += a; else if (f0 === 2) v += u; else if (f0 === 3) v += (a + u) >> 1; else if (f0 === 4) { const p = a + u - c; const pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
    px[y * st + x] = v & 255; } }
  const dd = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { dd[i * 4] = px[i * bpp]!; dd[i * 4 + 1] = px[i * bpp + 1]!; dd[i * 4 + 2] = px[i * bpp + 2]!; dd[i * 4 + 3] = 255; }
  return { w, h, data: dd };
};

const shots: Record<string, Shot> = {
  wr: draw(rookModel(), "w"), br: draw(rookModel(), "b"), wn: draw(knightModel(), "w"), bn: draw(knightModel(), "b"),
  wb: draw(bishopModel(), "w"), bb: draw(bishopModel(), "b"),
};

// The drawings as data (palette keys, "." empty), for whoever puts them in the arena.
writeFileSync(`${outDir}/arena-pieces-3d.json`, JSON.stringify({
  note: "The GBA rook and knight drawn from their 3D models, seen from the stands (scripts/boss-art/arena-pieces-3d.ts). Palette keys as arena-pieces-gba.ts; the foot (the square's middle) at `foot`.",
  pitchDeg: Math.round((PITCH * 180) / Math.PI), foot: [shots.wr!.ax, shots.wr!.ay], palette: PALETTE,
  pieces: Object.fromEntries(Object.entries(shots).map(([k, s]) => [k, s.keys.map((r) => r.map((c) => c ?? ".").join(""))])),
}, null, 1));

// The sheet: the four at 1x, then 4x, on a light and a dark square.
{
  const gap = 8, n = 6, s4 = 4, cw = 32;
  const im = blank(gap + n * (cw * s4 + gap), gap + 34 + gap + 34 * s4 + gap, "#e9d6ae");
  Object.values(shots).forEach((s, i) => {
    const x1 = gap + i * (cw + gap); rect(im, x1 + s.ax - 10, gap + s.ay - 6, 20, 10, i % 2 ? "#a97c55" : "#eac99a"); paint(im, toImg(s), x1, gap, 1);
    const x4 = gap + i * (cw * s4 + gap), y4 = gap + 34 + gap; rect(im, x4 + (s.ax - 10) * s4, y4 + (s.ay - 6) * s4, 20 * s4, 10 * s4, i % 2 ? "#a97c55" : "#eac99a"); paint(im, toImg(s), x4, y4, s4);
  });
  writeFileSync(`${outDir}/sheet-3d.png`, png(im));
}

// From the crowd: laid on a still of the arena with no pieces (the high view behind White), each foot on its square's
// middle, snapped to the arena's art grid, at its art pixel's size on the still; far ranks first.
const POS: [string, string][] = [["a1", "wr"], ["c1", "wb"], ["f3", "wn"], ["d1", "wr"], ["e4", "wn"], ["g2", "wb"], ["c6", "bn"], ["a8", "br"], ["h8", "br"], ["f6", "bn"], ["c8", "bb"], ["e7", "bb"], ["d5", "wr"]];
for (const dev of ["computer", "phone"]) {
  const info = JSON.parse(readFileSync(`${inDir}/empty-${dev}.json`, "utf8"));
  const shot = readPng(`${inDir}/empty-${dev}.png`);
  const per = info.px.scale * ((info.rect.w * info.dpr) / info.cw);
  const cx = info.rect.x * info.dpr, cy = info.rect.y * info.dpr;
  const placed = POS.map(([sq, k]) => { const p = info.px.sqs[sq] as [number, number]; return { k, x: Math.round(p[0] / info.px.scale), y: Math.round(p[1] / info.px.scale) }; }).sort((a, b) => a.y - b.y);
  for (const p of placed) { const s = shots[p.k]!; paint(shot, toImg(s), cx + (p.x - s.ax) * per, cy + (p.y - s.ay) * per, per); }
  writeFileSync(`${outDir}/mockup-3d-${dev}.png`, png(shot));
}
console.log("wrote", outDir);
