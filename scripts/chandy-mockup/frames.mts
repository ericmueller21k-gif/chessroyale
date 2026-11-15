// Dumps frames of characters as PNGs (each on the game's dark ground, scaled by whole numbers): for the mockup's sheets and GIFs.
//   npx tsx scripts/chandy-mockup/frames.mts <outDir> <scale> <module.ts:EXPORT:anim[:i,i]> ...
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import {
  renderFrame,
  type Character,
} from "../../packages/app/src/characters/sprite.ts";
const [outDir, scaleS, ...specs] = process.argv.slice(2);
mkdirSync(outDir!, { recursive: true });
const S = Number(scaleS);
const crc = (b: Uint8Array) => {
  let c = ~0;
  for (const v of b) {
    c ^= v;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
};
const chunk = (t: string, d: Uint8Array) => {
  const o = new Uint8Array(12 + d.length);
  const dv = new DataView(o.buffer);
  dv.setUint32(0, d.length);
  o.set(Buffer.from(t), 4);
  o.set(d, 8);
  dv.setUint32(8 + d.length, crc(o.subarray(4, 8 + d.length)));
  return o;
};
function png(file: string, w: number, h: number, buf: Uint8Array) {
  const raw = new Uint8Array((w * 4 + 1) * h);
  for (let y = 0; y < h; y++)
    raw.set(buf.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 6, 0, 0, 0], 8);
  writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", new Uint8Array()),
    ]),
  );
}
for (const spec of specs) {
  const [mod, exp, anim, idx] = spec.split(":");
  const ch: Character = (await import(resolve(mod!)))[exp!];
  const frames = ch.anims[anim!]!.frames;
  const list = idx ? idx.split(",").map(Number) : frames.map((_, i) => i);
  for (const i of list) {
    const r = renderFrame(ch, frames[i]!, {});
    const W = r.w * S;
    const H = r.h * S;
    const buf = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const si = (Math.floor(y / S) * r.w + Math.floor(x / S)) * 4;
        const a = r.data[si + 3]! / 255;
        const g = [0x14, 0x16, 0x1b];
        const di = (y * W + x) * 4;
        for (let c = 0; c < 3; c++)
          buf[di + c] = Math.round(r.data[si + c]! * a + g[c]! * (1 - a));
        buf[di + 3] = 255;
      }
    png(join(outDir!, `${exp}-${anim}-${i}-ms${frames[i]!.ms}.png`), W, H, buf);
  }
}
