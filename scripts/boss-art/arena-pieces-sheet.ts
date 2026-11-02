/**
 * The GBA piece trial's sheet and mockup (Nov 2): every still of `out/arena-pieces-gba` at 1x and 4x on the arena's sand
 * and the board's squares, and the pieces laid into a still of the arena with no pieces (taken with a local, uncommitted
 * switch: `empty-<device>.png` plus each square's position, `empty-<device>.json`), one sprite pixel one of the arena's.
 *
 *   npx tsx scripts/boss-art/arena-pieces-sheet.ts <empty-stills dir> <out dir>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
import { renderFrame } from "../../packages/app/src/characters/sprite.ts";
import { ARENA_PIECES_GBA as CH } from "./out/arena-pieces-gba/arena-pieces-gba.ts";

interface Img { w: number; h: number; data: Uint8ClampedArray }
const [inDir, outDir] = process.argv.slice(2) as [string, string];

const hex = (c: string) => { const n = parseInt(c.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]; };
const blank = (w: number, h: number, c: string): Img => { const d = new Uint8ClampedArray(w * h * 4); const v = hex(c); for (let i = 0; i < w * h; i++) d.set(v, i * 4); return { w, h, data: d }; };
const rect = (im: Img, x0: number, y0: number, w: number, h: number, c: string) => { const v = hex(c); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < im.w && y < im.h) im.data.set(v, (y * im.w + x) * 4); };
const blit = (dst: Img, src: Img, x0: number, y0: number, s: number) => {
  for (let y = 0; y < src.h * s; y++) for (let x = 0; x < src.w * s; x++) {
    const X = x0 + x, Y = y0 + y; if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
    const si = ((Math.floor(y / s)) * src.w + Math.floor(x / s)) * 4; const a = src.data[si + 3]! / 255; if (!a) continue;
    const di = (Y * dst.w + X) * 4; for (let c = 0; c < 3; c++) dst.data[di + c] = src.data[si + c]! * a + dst.data[di + c]! * (1 - a); dst.data[di + 3] = 255;
  }
};
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const png = (im: Img) => { const h = Buffer.alloc(13); h.writeUInt32BE(im.w, 0); h.writeUInt32BE(im.h, 4); h[8] = 8; h[9] = 6; const raw = Buffer.alloc((im.w * 4 + 1) * im.h); for (let y = 0; y < im.h; y++) Buffer.from(im.data.buffer, y * im.w * 4, im.w * 4).copy(raw, y * (im.w * 4 + 1) + 1); return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", h), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]); };
/** A plain PNG (8-bit RGB or RGBA, no interlace: what Chromium's screenshots are). */
const readPng = (f: string): Img => {
  const b = readFileSync(f); const w = b.readUInt32BE(16), h = b.readUInt32BE(20), ct = b[25]!; const bpp = ct === 6 ? 4 : 3;
  const idat: Buffer[] = []; for (let o = 8; o < b.length;) { const l = b.readUInt32BE(o); const t = b.toString("ascii", o + 4, o + 8); if (t === "IDAT") idat.push(b.subarray(o + 8, o + 8 + l)); o += 12 + l; }
  const raw = inflateSync(Buffer.concat(idat)); const st = w * bpp; const px = Buffer.alloc(st * h);
  for (let y = 0; y < h; y++) { const f0 = raw[y * (st + 1)]!; for (let x = 0; x < st; x++) {
    const r = raw[y * (st + 1) + 1 + x]!; const a = x >= bpp ? px[y * st + x - bpp]! : 0; const u = y ? px[(y - 1) * st + x]! : 0; const c = x >= bpp && y ? px[(y - 1) * st + x - bpp]! : 0;
    let v = r; if (f0 === 1) v += a; else if (f0 === 2) v += u; else if (f0 === 3) v += (a + u) >> 1; else if (f0 === 4) { const p = a + u - c; const pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
    px[y * st + x] = v & 255; } }
  const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { d[i * 4] = px[i * bpp]!; d[i * 4 + 1] = px[i * bpp + 1]!; d[i * 4 + 2] = px[i * bpp + 2]!; d[i * 4 + 3] = 255; }
  return { w, h, data: d };
};

const names = Object.keys(CH.anims);
const sprite = (k: string) => renderFrame(CH, CH.anims[k]!.frames[0]!);

// The sheet: on sand, a light and a dark square under each piece, at 1x then at 4x.
{
  const SQ = 20, gap = 6;
  const cell = (s: number) => CH.w * s + gap;
  const W = gap + names.length * cell(4), H = gap + (CH.h + 6) + gap + (CH.h * 4) + gap * 2;
  const im = blank(W, H, "#e9d6ae");
  names.forEach((k, i) => {
    const x1 = gap + i * cell(1); rect(im, x1 + CH.foot[0] - SQ / 2, gap + CH.foot[1] - 8, SQ, 12, i % 2 ? "#a97c55" : "#eac99a"); blit(im, sprite(k), x1, gap, 1);
    const x4 = gap + i * cell(4), y4 = gap + CH.h + 6 + gap; rect(im, x4 + (CH.foot[0] - SQ / 2) * 4, y4 + (CH.foot[1] - 8) * 4, SQ * 4, 48, i % 2 ? "#a97c55" : "#eac99a"); blit(im, sprite(k), x4, y4, 4);
  });
  writeFileSync(`${outDir}/sheet.png`, png(im));
}

// The mockups: a position of rooks and knights (all that's drawn so far), each foot on its square's middle, snapped to the
// arena's art grid, drawn far rank first so nearer pieces overlap farther ones.
const POS: [string, string][] = [["a1", "wr"], ["g1", "wn"], ["f3", "wn"], ["d1", "wr"], ["e4", "wn"], ["c6", "bn"], ["a8", "br"], ["h8", "br"], ["f6", "bn"], ["d5", "wr"]];
for (const dev of ["computer", "phone"]) {
  const info = JSON.parse(readFileSync(`${inDir}/empty-${dev}.json`, "utf8"));
  const shot = readPng(`${inDir}/empty-${dev}.png`);
  const toShot = (info.rect.w * info.dpr) / info.cw; // still pixels per canvas pixel
  const pxScale: number = info.px.scale; // canvas px per art px
  // Each foot on its square's middle, snapped to the arena's art grid (pxScale canvas pixels), painted onto the still at
  // the still's size of an art pixel (3 on a computer; 4.5 on a 3x phone, whose canvas is 2x), nearest-neighbor.
  const cx = info.rect.x * info.dpr, cy = info.rect.y * info.dpr;
  const per = pxScale * toShot;
  const placed = POS.map(([sq, k]) => { const p = info.px.sqs[sq] as [number, number]; return { k, x: Math.round(p[0] / pxScale), y: Math.round(p[1] / pxScale) }; }).sort((a, b) => a.y - b.y);
  const out = shot;
  for (const p of placed) {
    const im = sprite(p.k); const ax = p.x - CH.foot[0], ay = p.y - CH.foot[1];
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      const si = (y * im.w + x) * 4; if (!im.data[si + 3]) continue;
      const X0 = Math.round(cx + (ax + x) * per), X1 = Math.round(cx + (ax + x + 1) * per), Y0 = Math.round(cy + (ay + y) * per), Y1 = Math.round(cy + (ay + y + 1) * per);
      for (let Y = Y0; Y < Y1; Y++) for (let X = X0; X < X1; X++) if (X >= 0 && Y >= 0 && X < out.w && Y < out.h) out.data.set(im.data.subarray(si, si + 4), (Y * out.w + X) * 4);
    }
  }
  writeFileSync(`${outDir}/mockup-${dev}.png`, png(out));
}
console.log("wrote", outDir);
