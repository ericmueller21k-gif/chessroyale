// Boss characters' preview: for each character, an animated GIF per animation and a showreel (4x), a frame sheet
// (PNG, every frame with its time and cue), and one comparison PNG of them all at phone size on the game's ground.
//   npm run preview:characters -- [outDir] [ref=reference.png] [scale=4]
// A character with recolours (`looks`, such as the God King's black armour) is drawn once per look too, its files
// named <id>-<look>-*.
// `ref` puts a reference picture first in the comparison (its white or transparent background is keyed out).
// The bosses' power effects (characters/effects.ts) are drawn too, over the game's board (a white pawn under the
// ice and on the fire tile, so you can see it through), as fx-<id>-<anim>.gif and fx-<id>-sheet.png.
// No dependencies: PNG and GIF are written (and the reference read) here, with node:zlib.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { CHARACTERS } from "../packages/app/src/characters/index.ts";
import { EFFECT_SPRITES } from "../packages/app/src/characters/effects.ts";
import { renderFrame, type Character, type Frame } from "../packages/app/src/characters/sprite.ts";

const args = process.argv.slice(2);
const opt = (k: string) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
const outDir = args.find((a) => !a.includes("=")) ?? "characters-preview";
const SCALE = Number(opt("scale") ?? 4);
const GROUND = "#14161b";
const INK = "#8b93a7";
const GOLD = "#f2c14e";
mkdirSync(outDir, { recursive: true });
// `extra=<module.ts>` adds the characters a draft module exports; `only=<id,id>` picks which to draw.
const extra = opt("extra") ? Object.values(await import(resolve(opt("extra")!))).filter((v): v is Character => !!v && typeof v === "object" && "anims" in v) : [];
const only = opt("only")?.split(",");
const ALL = [...CHARACTERS, ...extra].filter((c) => !only || only.includes(c.id));

interface Img {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

const hex = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const blank = (w: number, h: number, bg = GROUND): Img => {
  const data = new Uint8ClampedArray(w * h * 4);
  const [r, g, b] = hex(bg);
  for (let i = 0; i < w * h; i++) data.set([r, g, b, 255], i * 4);
  return { w, h, data };
};
const scaleUp = (img: Img, s: number): Img => {
  const out = new Uint8ClampedArray(img.w * s * img.h * s * 4);
  for (let y = 0; y < img.h * s; y++)
    for (let x = 0; x < img.w * s; x++) {
      const i = (Math.floor(y / s) * img.w + Math.floor(x / s)) * 4;
      out.set(img.data.subarray(i, i + 4), (y * img.w * s + x) * 4);
    }
  return { w: img.w * s, h: img.h * s, data: out };
};
/** Draws `src` onto `dst` at (x, y), blending by alpha. */
const blit = (dst: Img, src: Img, x0: number, y0: number) => {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const X = x0 + x;
      const Y = y0 + y;
      if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
      const s = (y * src.w + x) * 4;
      const d = (Y * dst.w + X) * 4;
      const a = src.data[s + 3]! / 255;
      for (let c = 0; c < 3; c++) dst.data[d + c] = Math.round(src.data[s + c]! * a + dst.data[d + c]! * (1 - a));
    }
};

// ---- A 3 x 5 pixel font for the sheet's labels (rows top to bottom, space-separated).
const FONT: Record<string, string> = {
  "A": ".#. #.# ### #.# #.#",
  "B": "##. #.# ##. #.# ##.",
  "C": ".## #.. #.. #.. .##",
  "D": "##. #.# #.# #.# ##.",
  "E": "### #.. ##. #.. ###",
  "F": "### #.. ##. #.. #..",
  "G": ".## #.. #.# #.# .##",
  "H": "#.# #.# ### #.# #.#",
  "I": "### .#. .#. .#. ###",
  "J": "..# ..# ..# #.# .#.",
  "K": "#.# #.# ##. #.# #.#",
  "L": "#.. #.. #.. #.. ###",
  "M": "#.# ### ### #.# #.#",
  "N": "##. #.# #.# #.# #.#",
  "O": ".#. #.# #.# #.# .#.",
  "P": "##. #.# ##. #.. #..",
  "Q": ".#. #.# #.# ##. .##",
  "R": "##. #.# ##. #.# #.#",
  "S": ".## #.. .#. ..# ##.",
  "T": "### .#. .#. .#. .#.",
  "U": "#.# #.# #.# #.# ###",
  "V": "#.# #.# #.# #.# .#.",
  "W": "#.# #.# ### ### #.#",
  "X": "#.# #.# .#. #.# #.#",
  "Y": "#.# #.# .#. .#. .#.",
  "Z": "### ..# .#. #.. ###",
  "0": "### #.# #.# #.# ###",
  "1": ".#. ##. .#. .#. ###",
  "2": "##. ..# .#. #.. ###",
  "3": "##. ..# .#. ..# ##.",
  "4": "#.# #.# ### ..# ..#",
  "5": "### #.. ##. ..# ##.",
  "6": ".## #.. ### #.# ###",
  "7": "### ..# .#. .#. .#.",
  "8": "### #.# ### #.# ###",
  "9": "### #.# ### ..# ##.",
  "-": "... ... ### ... ...",
  ".": "... ... ... ... .#.",
  ":": "... .#. ... .#. ...",
  " ": "... ... ... ... ...",
  "/": "..# ..# .#. #.. #..",
  "+": "... .#. ### .#. ...",
};
const text = (img: Img, s: string, x0: number, y0: number, colour: string, px = 2) => {
  const [r, g, b] = hex(colour);
  [...s.toUpperCase()].forEach((ch, n) => {
    const glyph = (FONT[ch] ?? FONT[" "]!).replace(/ /g, "");
    for (let i = 0; i < 15; i++) {
      if (glyph[i] !== "#") continue;
      for (let dy = 0; dy < px; dy++)
        for (let dx = 0; dx < px; dx++) {
          const X = x0 + n * 4 * px + (i % 3) * px + dx;
          const Y = y0 + Math.floor(i / 3) * px + dy;
          if (X >= 0 && Y >= 0 && X < img.w && Y < img.h) img.data.set([r, g, b, 255], (Y * img.w + X) * 4);
        }
    }
  });
};

// ---- PNG
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, body: Uint8Array) => {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(body).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
};
const writePng = (path: string, img: Img) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) Buffer.from(img.data.buffer, img.data.byteOffset + y * img.w * 4, img.w * 4).copy(raw, y * (img.w * 4 + 1) + 1);
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array())]));
};
/** Reads an 8-bit RGB or RGBA, non-interlaced PNG (enough for a reference picture). */
const readPng = (path: string): Img => {
  const buf = readFileSync(path);
  let p = 8;
  let w = 0;
  let h = 0;
  let type = 0;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const t = buf.toString("ascii", p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (t === "IHDR") {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      type = body[9]!;
      if (body[8] !== 8 || body[12] !== 0 || (type !== 2 && type !== 6)) throw new Error(`${path}: only 8-bit RGB/RGBA, non-interlaced`);
    }
    if (t === "IDAT") idat.push(body);
    p += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const px = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x]!;
      const a = x >= bpp ? px[y * stride + x - bpp]! : 0;
      const b = y > 0 ? px[(y - 1) * stride + x]! : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp]! : 0;
      const pa = Math.abs(b - c);
      const pb = Math.abs(a - c);
      const pc = Math.abs(a + b - 2 * c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]!;
      px[y * stride + x] = (v + pred) & 255;
    }
  }
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([px[i * bpp]!, px[i * bpp + 1]!, px[i * bpp + 2]!, bpp === 4 ? px[i * bpp + 3]! : 255], i * 4);
  return { w, h, data };
};

// ---- GIF (looping, full frames, one global palette)
const writeGif = (path: string, frames: { img: Img; ms: number }[]) => {
  const { w, h } = frames[0]!.img;
  const colours = new Map<number, number>();
  const indexed = frames.map(({ img }) => {
    const idx = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const key = (img.data[i * 4]! << 16) | (img.data[i * 4 + 1]! << 8) | img.data[i * 4 + 2]!;
      if (!colours.has(key)) colours.set(key, colours.size);
      idx[i] = colours.get(key)!;
    }
    return idx;
  });
  if (colours.size > 256) throw new Error(`${path}: ${colours.size} colours (GIF holds 256)`);
  let bits = 1;
  while (1 << bits < colours.size) bits++;
  const bytes: number[] = [];
  const u16 = (n: number) => bytes.push(n & 255, (n >> 8) & 255);
  bytes.push(...Buffer.from("GIF89a"));
  u16(w);
  u16(h);
  bytes.push(0xf0 | (bits - 1), 0, 0);
  const table = new Array<number>((1 << bits) * 3).fill(0);
  for (const [rgb, i] of colours) table.splice(i * 3, 3, (rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
  bytes.push(...table);
  bytes.push(0x21, 0xff, 11, ...Buffer.from("NETSCAPE2.0"), 3, 1, 0, 0, 0);
  frames.forEach(({ ms }, f) => {
    bytes.push(0x21, 0xf9, 4, 0);
    u16(Math.max(2, Math.round(ms / 10)));
    bytes.push(0, 0, 0x2c);
    u16(0);
    u16(0);
    u16(w);
    u16(h);
    bytes.push(0);
    const min = Math.max(2, bits);
    bytes.push(min);
    const data = lzw(min, indexed[f]!);
    for (let i = 0; i < data.length; i += 255) bytes.push(Math.min(255, data.length - i), ...data.subarray(i, i + 255));
    bytes.push(0);
  });
  bytes.push(0x3b);
  writeFileSync(path, Buffer.from(bytes));
};
/** GIF's variable-width LZW, codes packed least-significant bit first. */
function lzw(minSize: number, input: Uint8Array): Uint8Array {
  const out: number[] = [];
  let acc = 0;
  let nbits = 0;
  const emit = (code: number, size: number) => {
    acc |= code << nbits;
    nbits += size;
    while (nbits >= 8) {
      out.push(acc & 255);
      acc >>>= 8;
      nbits -= 8;
    }
  };
  const clear = 1 << minSize;
  const eoi = clear + 1;
  let next = eoi + 1;
  let size = minSize + 1;
  let table = new Map<number, number>();
  emit(clear, size);
  let prefix = input[0]!;
  for (let i = 1; i < input.length; i++) {
    const k = input[i]!;
    const key = (prefix << 8) | k;
    const code = table.get(key);
    if (code !== undefined) {
      prefix = code;
      continue;
    }
    emit(prefix, size);
    if (next === 4096) {
      emit(clear, size);
      table = new Map();
      next = eoi + 1;
      size = minSize + 1;
    } else {
      if (next >= 1 << size) size++;
      table.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix, size);
  emit(eoi, size);
  if (nbits > 0) out.push(acc & 255);
  return Uint8Array.from(out);
}

// ---- Output
let look: string | undefined;
const frameImg = (ch: Character, f: Frame) => renderFrame(ch, f, { bg: GROUND, look });
const looksOf = (ch: Character) => [undefined, ...Object.keys(ch.looks ?? {})];

for (const ch of ALL) for (look of looksOf(ch)) {
  const id = look ? `${ch.id}-${look}` : ch.id;
  // A GIF per animation, and a showreel: idle twice, each other animation once with idle between.
  const reel: { img: Img; ms: number }[] = [];
  const idle = ch.anims.idle!.frames;
  const push = (frames: readonly Frame[], to: { img: Img; ms: number }[]) => frames.forEach((f) => to.push({ img: scaleUp(frameImg(ch, f), SCALE), ms: f.ms }));
  push(idle, reel);
  push(idle, reel);
  for (const [name, anim] of Object.entries(ch.anims)) {
    const one: { img: Img; ms: number }[] = [];
    push(anim.frames, one);
    if (anim.loop) push(anim.frames, one);
    writeGif(join(outDir, `${id}-${name}.gif`), one);
    if (name !== "idle") {
      push(anim.frames, reel);
      push(idle, reel);
    }
  }
  writeGif(join(outDir, `${id}.gif`), reel);

  // Frame sheet: each animation's frames in rows of up to 12, with their number, time and cue.
  const anims = Object.entries(ch.anims);
  const PER_ROW = 12;
  const rowsOf = (n: number) => Math.ceil(n / PER_ROW);
  const cols = Math.min(PER_ROW, Math.max(...anims.map(([, a]) => a.frames.length)));
  const cellW = ch.w * SCALE + 8;
  const cellH = ch.h * SCALE + 30;
  const sheet = blank(cols * cellW + 8, 30 + anims.reduce((s, [, a]) => s + 14 + rowsOf(a.frames.length) * cellH, 0));
  text(sheet, `${ch.name}${look ? ` (${look})` : ""}  ${ch.w}x${ch.h} px  shown at ${SCALE}x`, 8, 8, GOLD);
  let y0 = 30;
  for (const [name, anim] of anims) {
    text(sheet, `${name}${anim.loop ? " loop" : ""}`, 8, y0, INK);
    anim.frames.forEach((f, c) => {
      const x = 8 + (c % PER_ROW) * cellW;
      const y = y0 + 13 + Math.floor(c / PER_ROW) * cellH;
      blit(sheet, blank(ch.w * SCALE + 2, ch.h * SCALE + 2, "#22252d"), x - 1, y - 1);
      blit(sheet, scaleUp(frameImg(ch, f), SCALE), x, y);
      text(sheet, `${c + 1} ${f.ms}ms${f.cue ? ` ${f.cue}` : ""}`, x, y + 3 + ch.h * SCALE, f.cue ? GOLD : INK);
    });
    y0 += 14 + rowsOf(anim.frames.length) * cellH;
  }
  writePng(join(outDir, `${id}-sheet.png`), sheet);
  console.log(`${id}: ${Object.entries(ch.anims).map(([n, a]) => `${n} ${a.frames.length}f`).join(", ")}`);
}

// ---- The power effects, over the board (chessground's brown squares), at the same scale.
const LIGHT = "#f0d9b5";
const DARK = "#b58863";
/** The board under an effect: one light square (a white pawn on it under the ice), or the whole board. */
function boardUnder(ch: Character): Img {
  if (ch.w === ch.h && ch.w > 64) {
    const img = blank(ch.w, ch.h, LIGHT);
    const cell = ch.w / 8;
    for (let y = 0; y < ch.h; y++) for (let x = 0; x < ch.w; x++) if ((Math.floor(x / cell) + Math.floor(y / cell)) % 2) img.data.set([...hex(DARK), 255], (y * ch.w + x) * 4);
    return img;
  }
  const img = blank(ch.w, ch.h, LIGHT);
  if (ch.id === "ice-overlay" || ch.id === "fire-tile") {
    // A white pawn: head, body, base; black outline.
    const c = ch.w / 2;
    const inPawn = (x: number, y: number) => (x - c) ** 2 + (y - 10) ** 2 <= 16 || (y >= 13 && y <= 23 && Math.abs(x - c) <= 2.5 + (y - 13) * 0.45) || (y >= 23 && y <= 26 && Math.abs(x - c) <= 9);
    for (let y = 0; y < ch.h; y++)
      for (let x = 0; x < ch.w; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const edge = !inPawn(px - 1, py) || !inPawn(px + 1, py) || !inPawn(px, py - 1) || !inPawn(px, py + 1);
        if (inPawn(px, py)) img.data.set(edge ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * ch.w + x) * 4);
      }
  }
  return img;
}
const fxFrame = (ch: Character, f: Frame): Img => {
  const out = boardUnder(ch);
  blit(out, renderFrame(ch, f), 0, 0);
  return out;
};
const FX = Object.values(EFFECT_SPRITES).filter((c) => !only || only.includes(c.id) || only.includes("fx"));
for (const ch of FX) {
  for (const [name, anim] of Object.entries(ch.anims)) {
    const one: { img: Img; ms: number }[] = [];
    for (let rep = 0; rep < (anim.loop ? 2 : 1); rep++) anim.frames.forEach((f) => one.push({ img: scaleUp(fxFrame(ch, f), SCALE), ms: f.ms }));
    // A short pause on the board after a one-shot, so the GIF's loop shows where it ends.
    if (!anim.loop) one.push({ img: scaleUp(boardUnder(ch), SCALE), ms: 400 });
    writeGif(join(outDir, `fx-${ch.id}-${name}.gif`), one);
  }
  const anims = Object.entries(ch.anims);
  const s = ch.w > 64 ? 2 : SCALE;
  const PER_ROW = ch.w > 64 ? 5 : 10;
  const cellW = ch.w * s + 8;
  const cellH = ch.h * s + 30;
  const rowsOf = (n: number) => Math.ceil(n / PER_ROW);
  const cols = Math.min(PER_ROW, Math.max(...anims.map(([, a]) => a.frames.length)));
  const sheet = blank(cols * cellW + 8, 30 + anims.reduce((t, [, a]) => t + 14 + rowsOf(a.frames.length) * cellH, 0));
  text(sheet, `${ch.name}  ${ch.w}x${ch.h} px  shown at ${s}x`, 8, 8, GOLD);
  let y0 = 30;
  for (const [name, anim] of anims) {
    text(sheet, `${name}${anim.loop ? " loop" : ""}`, 8, y0, INK);
    anim.frames.forEach((f, c) => {
      const x = 8 + (c % PER_ROW) * cellW;
      const y = y0 + 13 + Math.floor(c / PER_ROW) * cellH;
      blit(sheet, scaleUp(fxFrame(ch, f), s), x, y);
      text(sheet, `${c + 1} ${f.ms}ms${f.cue ? ` ${f.cue}` : ""}`, x, y + 3 + ch.h * s, f.cue ? GOLD : INK);
    });
    y0 += 14 + rowsOf(anim.frames.length) * cellH;
  }
  writePng(join(outDir, `fx-${ch.id}-sheet.png`), sheet);
  console.log(`fx ${ch.id}: ${anims.map(([n, a]) => `${n} ${a.frames.length}f ${a.frames.reduce((t, f) => t + f.ms, 0)}ms`).join(", ")}`);
}

// Comparison at phone size: the reference (if given), then each character's first idle frame, about 128 px tall,
// on the game's ground. Sprites at 2x (their size in CSS pixels on a phone); the reference is resampled to match.
const PHONE = 2;
const tiles: { img: Img; label: string }[] = [];
const refPath = opt("ref");
if (refPath) {
  const ref = keyOut(readPng(refPath));
  const target = Math.max(...ALL.map((c) => spriteHeight(c))) * PHONE;
  tiles.push({ img: resample(ref, target / ref.h), label: "reference" });
}
for (const ch of ALL)
  for (const lk of looksOf(ch)) {
    const img = scaleUp(renderFrame(ch, ch.anims.idle!.frames[0]!, { look: lk }), PHONE);
    tiles.push({ img: crop(img), label: ch.name.replace(/^The /, "") + (lk ? ` ${lk}` : "") });
  }
const pad = 24;
const H = Math.max(1, ...tiles.map((t) => t.img.h));
const tileW = (t: { img: Img; label: string }) => Math.max(t.img.w, t.label.length * 8);
const cmp = blank(tiles.reduce((s, t) => s + tileW(t) + pad, pad), H + pad * 2 + 16);
let cx = pad;
for (const t of tiles) {
  blit(cmp, t.img, cx + Math.floor((tileW(t) - t.img.w) / 2), pad + H - t.img.h);
  text(cmp, t.label, cx + Math.floor((tileW(t) - t.label.length * 8) / 2), pad + H + 10, t.label === "reference" ? INK : GOLD);
  cx += tileW(t) + pad;
}
writePng(join(outDir, "comparison.png"), cmp);
console.log(`wrote ${outDir}/`);

/** The character's height in pixels in its first idle frame (its tallest pose at rest). */
function spriteHeight(ch: Character): number {
  return crop(renderFrame(ch, ch.anims.idle!.frames[0]!)).h;
}
/** Trims transparent edges. */
function crop(img: Img): Img {
  let [x0, y0, x1, y1] = [img.w, img.h, -1, -1];
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (img.data[(y * img.w + x) * 4 + 3]! > 0) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  if (x1 < 0) return img;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) data.set(img.data.subarray(((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x1 + 1) * 4), y * w * 4);
  return { w, h, data };
}
/** Makes a reference's background transparent: its own alpha if it has any, else near-white flooded in from the edges. */
function keyOut(img: Img): Img {
  const hasAlpha = img.data.some((v, i) => i % 4 === 3 && v < 250);
  if (!hasAlpha) {
    // Pure white anywhere (gaps between legs, under an arm), then near-white flooded in from the edges.
    for (let i = 0; i < img.w * img.h; i++) if (Math.min(img.data[i * 4]!, img.data[i * 4 + 1]!, img.data[i * 4 + 2]!) >= 248) img.data[i * 4 + 3] = 0;
    const seen = new Uint8Array(img.w * img.h);
    const stack: number[] = [];
    for (let x = 0; x < img.w; x++) stack.push(x, (img.h - 1) * img.w + x);
    for (let y = 0; y < img.h; y++) stack.push(y * img.w, y * img.w + img.w - 1);
    while (stack.length) {
      const i = stack.pop()!;
      if (seen[i]) continue;
      const d = img.data;
      if (Math.min(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!) < 235) continue;
      seen[i] = 1;
      d[i * 4 + 3] = 0;
      const x = i % img.w;
      if (x > 0) stack.push(i - 1);
      if (x < img.w - 1) stack.push(i + 1);
      if (i >= img.w) stack.push(i - img.w);
      if (i < img.w * (img.h - 1)) stack.push(i + img.w);
    }
  }
  return crop(img);
}
/** Area-averaged resize (premultiplied), for the reference only; sprites are only ever scaled by whole numbers. */
function resample(img: Img, f: number): Img {
  const w = Math.max(1, Math.round(img.w * f));
  const h = Math.max(1, Math.round(img.h * f));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [sx0, sx1, sy0, sy1] = [x / f, (x + 1) / f, y / f, (y + 1) / f];
      const acc: [number, number, number, number] = [0, 0, 0, 0];
      let area = 0;
      for (let sy = Math.floor(sy0); sy < Math.min(img.h, Math.ceil(sy1)); sy++)
        for (let sx = Math.floor(sx0); sx < Math.min(img.w, Math.ceil(sx1)); sx++) {
          const cov = (Math.min(sx1, sx + 1) - Math.max(sx0, sx)) * (Math.min(sy1, sy + 1) - Math.max(sy0, sy));
          const i = (sy * img.w + sx) * 4;
          const a = (img.data[i + 3]! / 255) * cov;
          acc[0] += img.data[i]! * a;
          acc[1] += img.data[i + 1]! * a;
          acc[2] += img.data[i + 2]! * a;
          acc[3] += a;
          area += cov;
        }
      const o = (y * w + x) * 4;
      if (acc[3]! > 0) data.set([acc[0]! / acc[3]!, acc[1]! / acc[3]!, acc[2]! / acc[3]!, (acc[3]! / area) * 255], o);
    }
  return { w, h, data };
}
