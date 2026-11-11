/**
 * Stills and GIFs for the zebra bakery's characters (Nov 10), no browser.
 *   npx tsx scripts/boss-art/zebra-stills.ts sheet <out.png> <scale> <file#Export:anim[,anim...][@flip]> ...
 *     one row per animation, its frames left to right (`anim/0.3.5`: only those frames), on the game's dark ground.
 *   npx tsx scripts/boss-art/zebra-stills.ts gif <out.gif> <scale> <file#Export:anim> [<file#Export:anim> ...]
 *     one GIF at `scale`; several figures side by side, each playing its own animation by the clock (one-shots hold their
 *     last frame, then the GIF loops), on the dark ground.
 *   npx tsx scripts/boss-art/zebra-stills.ts lineup <out.png> <scale>
 *     the kingpin and the five crew side by side next to the dealer giraffe for scale, feet on one line.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderFrame, type Character } from "../../packages/app/src/characters/sprite.ts";
import { blank, blit, png } from "./render.ts";

type Img = { w: number; h: number; data: Uint8ClampedArray };
const BG = "#14161b";
const flipImg = (im: Img): Img => {
  const d = new Uint8ClampedArray(im.data.length);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) d.set(im.data.subarray((y * im.w + x) * 4, (y * im.w + x) * 4 + 4), (y * im.w + (im.w - 1 - x)) * 4);
  return { w: im.w, h: im.h, data: d };
};
const load = async (spec: string) => {
  const [left, flip] = spec.split("@");
  const [file, tail] = left!.split("#") as [string, string];
  const [exp, anims] = tail.split(":") as [string, string | undefined];
  const ch = ((await import(resolve(file))) as Record<string, Character>)[exp];
  if (!ch) throw new Error(`${file} exports no ${exp}`);
  return { ch, anims: (anims ?? Object.keys(ch.anims).join(",")).split(","), flip: flip === "flip" };
};
const draw = (ch: Character, anim: string, i: number, flip: boolean): Img => {
  const an = ch.anims[anim];
  if (!an) throw new Error(`${ch.id} has no ${anim}`);
  const r = renderFrame(ch, an.frames[i]!);
  const im = { w: r.w, h: r.h, data: r.data };
  return flip ? flipImg(im) : im;
};

const [cmd, out, sc, ...specs] = process.argv.slice(2);
const scale = Number(sc ?? 3);

if (cmd === "sheet") {
  const rows: Img[][] = [];
  for (const spec of specs) {
    const { ch, anims, flip } = await load(spec);
    for (const a of anims) {
      const [name, pick] = a.split("/") as [string, string | undefined];
      const idx = pick ? pick.split(".").map(Number) : ch.anims[name]!.frames.map((_, i) => i);
      const imgs = idx.map((i) => draw(ch, name, i, flip));
      if (process.env.ONEROW && rows.length) rows.at(-1)!.push(...imgs);
      else rows.push(imgs);
    }
  }
  const gap = 4 * scale;
  const W = Math.max(...rows.map((r) => r.reduce((s, im) => s + im.w * scale + gap, gap)));
  const H = rows.reduce((s, r) => s + Math.max(...r.map((im) => im.h)) * scale + gap, gap);
  const img = blank(W, H, BG);
  let y = gap;
  for (const r of rows) {
    let x = gap;
    for (const im of r) blit(img, im, x, y, scale), (x += im.w * scale + gap);
    y += Math.max(...r.map((im) => im.h)) * scale + gap;
  }
  writeFileSync(out!, png(img));
  console.log(`wrote ${out} (${W} x ${H})`);
} else if (cmd === "gif") {
  const figs = await Promise.all(specs.map(load));
  // The timeline: long enough for the longest one-shot plus a pause, or two loops of the longest loop.
  const durs = figs.map(({ ch, anims }) => ch.anims[anims[0]!]!.frames.reduce((s, f) => s + f.ms, 0));
  const anyOnce = figs.some(({ ch, anims }) => !ch.anims[anims[0]!]!.loop);
  const total = anyOnce ? Math.max(...durs) + 700 : Math.max(...durs) * (figs.length > 1 ? 2 : 1);
  const at = (ch: Character, anim: string, t: number) => {
    const an = ch.anims[anim]!;
    const dur = an.frames.reduce((s, f) => s + f.ms, 0);
    let u = an.loop ? t % dur : Math.min(t, dur - 1);
    for (let i = 0; i < an.frames.length; i++) {
      if (u < an.frames[i]!.ms) return i;
      u -= an.frames[i]!.ms;
    }
    return an.frames.length - 1;
  };
  // Cut times: every frame change of any figure.
  const cuts = new Set<number>([0]);
  for (const { ch, anims } of figs) {
    const an = ch.anims[anims[0]!]!;
    for (let t0 = 0; t0 < total; ) for (const f of an.frames) { t0 += f.ms; if (t0 < total) cuts.add(t0); if (!an.loop) break; }
    if (!an.loop) { let t1 = 0; for (const f of an.frames) { t1 += f.ms; if (t1 < total) cuts.add(t1); } }
  }
  const times = [...cuts].sort((a, b) => a - b);
  const pad = 4;
  const fw = figs.reduce((s, f) => s + f.ch.w, 0) + pad * (figs.length + 1);
  const fh = Math.max(...figs.map((f) => f.ch.h)) + pad * 2;
  const frames = times.map((t, n) => {
    const img = blank(fw * scale, fh * scale, BG);
    let x = pad;
    for (const { ch, anims, flip } of figs) {
      const im = draw(ch, anims[0]!, at(ch, anims[0]!, t), flip);
      blit(img, im, x * scale, (pad + (fh - pad * 2 - ch.h)) * scale, scale);
      x += ch.w + pad;
    }
    return { img, ms: (times[n + 1] ?? total) - t };
  });
  writeGif(out!, frames);
  console.log(`wrote ${out} (${frames.length} frames, ${fw * scale} x ${fh * scale})`);
}

// ---- GIF (looping, full frames, one global palette): scripts/preview-characters.ts's writer.
function writeGif(path: string, frames: { img: Img; ms: number }[]) {
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
  if (colours.size > 256) throw new Error(`${path}: ${colours.size} colors (GIF holds 256)`);
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
}
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
