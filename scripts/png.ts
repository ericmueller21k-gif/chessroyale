/**
 * A small PNG writer for the build's bakes (scripts/bake-sidekicks.ts, scripts/bake-town.ts): 8 bits a channel, RGBA, no filter (the
 * town's art is flat palette colors: unfiltered rows deflate smallest, measured Nov 28). And its reader, for the pictures it wrote.
 */
import { deflateSync, inflateSync } from "node:zlib";

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
/** RGBA pixels as a PNG (8 bits a channel, no filter; `level`: zlib's, 9 the smallest). */
export function png(w: number, h: number, data: Uint8Array, level = 9): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level })), chunk("IEND", new Uint8Array())]);
}

/** A PNG's pixels as `png` wrote it (8 bits a channel, RGBA, not interlaced, no filter): anything else throws. */
export function unpng(file: Uint8Array): { w: number; h: number; data: Uint8Array } {
  const buf = Buffer.from(file.buffer, file.byteOffset, file.length);
  if (buf.subarray(0, 8).toString("latin1") !== "\x89PNG\r\n\x1a\n") throw new Error("unpng: not a PNG");
  let w = 0;
  let h = 0;
  const idat: Buffer[] = [];
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString("ascii", at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + len);
    if (type === "IHDR") {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      if ([...body.subarray(8, 13)].join() !== "8,6,0,0,0") throw new Error("unpng: not 8-bit RGBA, or interlaced");
    } else if (type === "IDAT") idat.push(body);
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const row = w * 4 + 1;
  if (!w || !h || raw.length !== row * h) throw new Error("unpng: not its size");
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    if (raw[y * row] !== 0) throw new Error("unpng: a filtered row");
    data.set(raw.subarray(y * row + 1, (y + 1) * row), y * w * 4);
  }
  return { w, h, data };
}
