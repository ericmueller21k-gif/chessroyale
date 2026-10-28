/**
 * The runner's eyes, run as its own process for each look (run.ts starts it with no API key in its environment, since it
 * imports the drawing the model wrote): it loads the draft, draws the frames asked for, and writes two PNGs.
 *   npx tsx scripts/boss-art/render.ts '<json request>'
 * The request: { draft, id, anim, frames?, scale?, bg?, with?, out }. Prints one line of JSON: the picture, the facts
 * (frame size, the animations and their frame counts) and the warnings (a pixel on a frame's edge, a missing outline key,
 * a missing animation), or { error }. One picture, `look.png` (never over 1500 px either way: the API's limit for many
 * images is 2000), so each look costs the conversation one image:
 * - on top, the chosen frames of one animation side by side at `scale` (at most 8);
 * - below, the first idle frame at phone size (1x and 2x) beside another boss (`with`, default Babur), on the game's
 *   dark ground, feet on one line, for size and style.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { CHARACTERS } from "../../packages/app/src/characters/index.ts";
import { HOUSES } from "../../packages/app/src/town/houses/index.ts";
import { renderFrame, type Character } from "../../packages/app/src/characters/sprite.ts";

interface Req {
  draft: string;
  id: string;
  anim: string;
  frames?: number[];
  scale?: number;
  bg?: "dark" | "light";
  with?: string;
  out: string;
}
interface Img {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** The anims every boss needs (the kit's moments). */
export const REQUIRED = ["idle", "entrance", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory"] as const;
/** A boss's sidekick's anims (Oct 27: a town bot you can play, no powers): standing, walking, sitting at a table, a wave. */
export const SIDEKICK = ["idle", "walk", "sit", "wave"] as const;
/** A ranked tier's emblem ("rank-"): one still per division, 5 the plainest to 1 the grandest. The top tiers ("rank-top-") have no divisions: one idle. */
export const RANK = ["d5", "d4", "d3", "d2", "d1"] as const;
const GROUND = { dark: "#14161b", light: "#f3f1ec" } as const;
const MAX_W = 1500;

const hex = (c: string) => {
  const n = parseInt(c.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const blank = (w: number, h: number, bg: string): Img => {
  const data = new Uint8ClampedArray(w * h * 4);
  const [r, g, b] = hex(bg);
  for (let i = 0; i < w * h; i++) data.set([r, g, b, 255], i * 4);
  return { w, h, data };
};
/** Draws `src` scaled by `s` (nearest neighbor) onto `dst` at (x0, y0), blending by alpha. */
const blit = (dst: Img, src: Img, x0: number, y0: number, s: number) => {
  for (let y = 0; y < src.h * s; y++)
    for (let x = 0; x < src.w * s; x++) {
      const X = x0 + x;
      const Y = y0 + y;
      if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
      const i = (Math.floor(y / s) * src.w + Math.floor(x / s)) * 4;
      const a = src.data[i + 3]! / 255;
      if (a === 0) continue;
      const j = (Y * dst.w + X) * 4;
      for (let k = 0; k < 3; k++) dst.data[j + k] = Math.round(src.data[i + k]! * a + dst.data[j + k]! * (1 - a));
    }
};

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Buffer) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const png = (img: Img): Buffer => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 4 + 1)] = 0;
    Buffer.from(img.data.buffer, img.data.byteOffset + y * img.w * 4, img.w * 4).copy(raw, y * (img.w * 4 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};

const isCharacter = (v: unknown): v is Character => !!v && typeof v === "object" && "anims" in v && "parts" in v && "palette" in v;

async function main(req: Req): Promise<object> {
  const mod = (await import(resolve(req.draft))) as Record<string, unknown>;
  const all = Object.values(mod).filter(isCharacter);
  const ch = all.find((c) => c.id === req.id) ?? all[0];
  if (!ch) return { error: `the draft exports no character (an object with id, palette, parts and anims); exports: ${Object.keys(mod).join(", ") || "none"}` };
  const warnings: string[] = [];
  if (ch.id !== req.id) warnings.push(`its id is "${ch.id}", not "${req.id}"`);
  if (!ch.palette.k) warnings.push(`no outline color: the palette needs "k"`);
  // A home on the town square (an id starting "house-") needs only its idle; a boss's sidekick (a town bot, "sidekick-")
  // its idle, walk, sit and wave; a ranked tier's emblem ("rank-") a still per division, a top tier's ("rank-top-") its idle.
  const need: readonly string[] = req.id.startsWith("house-") || req.id.startsWith("rank-top-") ? ["idle"] : req.id.startsWith("sidekick-") ? SIDEKICK : req.id.startsWith("rank-") ? RANK : REQUIRED;
  const missing = need.filter((a) => !ch.anims[a]);
  if (missing.length) warnings.push(`animations still to draw: ${missing.join(", ")}`);
  const anim = ch.anims[req.anim];
  const facts = {
    frame: `${ch.w} x ${ch.h}, feet at (${ch.foot.join(", ")})`,
    anims: Object.fromEntries(Object.entries(ch.anims).map(([k, a]) => [k, `${a.frames.length} frames, ${a.frames.reduce((s, f) => s + f.ms, 0)} ms${a.loop ? ", loops" : ""}`])),
  };
  if (!anim) return { error: `no animation "${req.anim}"`, facts, warnings };
  const bg = GROUND[req.bg ?? "dark"];
  const pick = (req.frames?.length ? req.frames : anim.frames.map((_, i) => i)).filter((i) => i >= 0 && i < anim.frames.length).slice(0, 8);
  // Each frame drawn on transparency first, for the edge check; then laid on the ground.
  const drawn = pick.map((i) => {
    const im = renderFrame(ch, anim.frames[i]!);
    let edge = false;
    for (let x = 0; x < im.w && !edge; x++) edge = im.data[x * 4 + 3]! > 0 || im.data[((im.h - 1) * im.w + x) * 4 + 3]! > 0;
    for (let y = 0; y < im.h && !edge; y++) edge = im.data[y * im.w * 4 + 3]! > 0 || im.data[(y * im.w + im.w - 1) * 4 + 3]! > 0;
    if (edge) warnings.push(`${req.anim} frame ${i}: a pixel touches the frame's edge (it may be cut off)`);
    return im;
  });
  const gap = 4;
  let s = Math.max(1, Math.min(6, Math.round(req.scale ?? 4)));
  while (s > 1 && (pick.length * (ch.w * s + gap) + gap > MAX_W || ch.h * s + 2 * gap > 1500 - 4 * ch.h - 16)) s--;
  const strip = blank(pick.length * (ch.w * s + gap) + gap, ch.h * s + 2 * gap, bg);
  drawn.forEach((im, n) => blit(strip, im, gap + n * (ch.w * s + gap), gap, s));
  // Phone size: this boss's first idle frame at 1x and 2x, beside the other boss at 2x, feet on one line.
  // `with` can also name another home's picture (house-hollow, house-gardener, ...).
  const others = [...CHARACTERS, ...Object.values(HOUSES).map((h) => h.ch)];
  const other = others.find((c) => c.id === (req.with ?? "tiger")) ?? CHARACTERS[0]!;
  const idle = (c: Character) => renderFrame(c, (c.anims.idle ?? Object.values(c.anims)[0]!).frames[0]!);
  const mine = idle(ch);
  const theirs = idle(other);
  const base = Math.max(ch.foot[1] * 2, other.foot[1] * 2) + 8;
  const phone = blank(ch.w + ch.w * 2 + other.w * 2 + 40, base + Math.max(ch.h - ch.foot[1], other.h - other.foot[1]) * 2 + 8, bg);
  blit(phone, mine, 8, base - ch.foot[1], 1);
  blit(phone, mine, 16 + ch.w, base - ch.foot[1] * 2, 2);
  blit(phone, theirs, 24 + ch.w * 3, base - other.foot[1] * 2, 2);
  const look = blank(Math.max(strip.w, phone.w), Math.min(1500, strip.h + phone.h), bg);
  blit(look, strip, 0, 0, 1);
  blit(look, phone, 0, strip.h, 1);
  writeFileSync(`${req.out}/look.png`, png(look));
  return { file: `${req.out}/look.png`, shown: { anim: req.anim, frames: pick, scale: s, beside: other.id }, facts, warnings };
}

main(JSON.parse(process.argv[2]!) as Req)
  .then((r) => console.log(JSON.stringify(r)))
  .catch((e: unknown) => console.log(JSON.stringify({ error: e instanceof Error ? `${e.message}\n${(e.stack ?? "").split("\n").slice(1, 4).join("\n")}` : String(e) })));
