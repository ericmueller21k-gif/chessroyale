// Mockup of Dash's whole battle intro (Nov 3): his moves (boss-blitz.ts, BOSS_BLITZ_INTRO) and the props
// (house-intro-blitz.ts) laid out side-on on one floor line, timed as code would play them: four dashes (the table, the
// board, the pieces, the stools), then his brag. The slab and pieces are stand-ins (the game's renderer draws the real
// ones). Usage: npx tsx scripts/boss-art/intro-blitz-view.ts <dir>  (writes f###.png and ms.txt)
import { writeFileSync } from "node:fs";
import { renderFrame, type Character, type Frame } from "../../packages/app/src/characters/sprite.ts";
import { blank, blit, png } from "./render.ts";
const P = await import("./out/house-intro-blitz/house-intro-blitz.ts");
const B = await import("./out/boss-blitz/boss-blitz.ts");
const dir = process.argv[2]!;
const BZ = B.BOSS_BLITZ_INTRO as Character, TB = P.INTRO_BLITZ_TABLE as Character, ST = P.INTRO_BLITZ_STOOL as Character;
const DU = P.INTRO_BLITZ_DUST as Character, PO = P.INTRO_BLITZ_POP as Character;
const DROP = B.BLITZ_INTRO_DROP_AT as readonly [number, number];
const sc = 3, W = 360, H = 190, GY = 165, X0 = 220, SPOT = X0 - DROP[0];
const pal = P.INTRO_BLITZ_TABLE_PALETTE as Record<string, string>;
const hexc = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255];
const slab = (pieces: boolean) => {
  const im = { w: TB.w, h: TB.h, data: new Uint8ClampedArray(TB.w * TB.h * 4) };
  const put = (x: number, y: number, c: string) => im.data.set(hexc(c), (y * TB.w + x) * 4);
  const top = TB.foot[1] - 27, x0 = TB.foot[0] - 16, x1 = TB.foot[0] + 16;
  for (let y = top - 10; y < top; y++) for (let x = x0; x < x1; x++) put(x, y, x === x0 || x === x1 - 1 || y === top - 10 ? pal["1"]! : (Math.floor((x - x0 - 1) / 3.75) + y) % 2 ? pal.D! : pal.L!);
  for (let y = top; y < top + 3; y++) for (let x = x0; x < x1; x++) put(x, y, pal["4"]!);
  if (pieces) for (const [row, c] of [[top - 7, "#2d2c33"], [top - 5, "#2d2c33"], [top - 2, "#f6f1e6"], [top, "#f6f1e6"]] as const)
    for (let f = 0; f < 8; f++) { const x = x0 + 1 + Math.round(f * 3.75); for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) put(x + i, row - 4 + j, j === 0 || i === 0 || i === 2 ? "#1a1210" : c); }
  return im;
};
const SLAB = slab(false), SLAB_P = slab(true);
type Put = { ch: Character; f: Frame; x: number } | { img: ReturnType<typeof slab>; x: number };
const draw = (items: Put[]) => {
  const o = blank(W * sc, H * sc, "#ece7dd");
  for (let y = GY * sc; y < H * sc; y++) for (let x = 0; x < W * sc; x++) o.data.set([216, 209, 195, 255], (y * W * sc + x) * 4);
  for (const it of items) {
    if ("img" in it) { blit(o, it.img, (it.x - TB.foot[0]) * sc, (GY - TB.foot[1]) * sc, sc); continue; }
    blit(o, renderFrame(it.ch, it.f), (it.x - it.ch.foot[0]) * sc, (GY - it.ch.foot[1]) * sc, sc);
  }
  return o;
};
// ---- The timeline (ms): a track plays one animation from `at`; `hold` keeps its last frame afterwards.
type Track = { ch: Character; anim: string; at: number; x: number; hold?: boolean; until?: number };
const frameAt = (t: Track, now: number): Frame | null => {
  if (now < t.at || (t.until !== undefined && now >= t.until)) return null;
  const fr = t.ch.anims[t.anim]!.frames;
  let s = now - t.at;
  const total = fr.reduce((a, f) => a + f.ms, 0);
  if (s >= total) { if (t.ch.anims[t.anim]!.loop) s %= total; else return t.hold ? fr.at(-1)! : null; }
  for (const f of fr) { if (s < f.ms) return f; s -= f.ms; }
  return null;
};
const startOf = (ch: Character, anim: string, i: number) => ch.anims[anim]!.frames.slice(0, i).reduce((a, f) => a + f.ms, 0);
const dropMs = startOf(BZ, "arrive", BZ.anims.arrive!.frames.findIndex((f) => f.cue === "drop"));
const whooshMs = startOf(BZ, "bolt", BZ.anims.bolt!.frames.findIndex((f) => f.cue === "whoosh"));
const arriveLen = startOf(BZ, "arrive", BZ.anims.arrive!.frames.length);
const LINE = 900, CYCLE = 1600, AWAY = 750;
const him: Track[] = [{ ch: BZ, anim: "idle", at: 0, x: SPOT, until: LINE }];
const props: Track[] = [];
const events: Record<string, number> = {};
for (let i = 0; i < 4; i++) {
  const b = LINE + i * CYCLE, a = b + AWAY, d = a + dropMs;
  him.push({ ch: BZ, anim: "bolt", at: b, x: SPOT, until: a }, { ch: BZ, anim: "arrive", at: a, x: SPOT, hold: true, until: LINE + (i + 1) * CYCLE });
  props.push({ ch: DU, anim: "idle", at: b + whooshMs, x: SPOT });
  if (i === 0) props.push({ ch: TB, anim: "land", at: d, x: X0, hold: true });
  if (i === 1) events.board = d;
  if (i === 2) { props.push({ ch: PO, anim: "idle", at: d, x: X0 }); events.pieces = d + PO.anims.idle!.frames[0]!.ms; }
  if (i === 3) for (const sx of [X0 - 37, X0 + 37]) props.push({ ch: ST, anim: "land", at: d, x: sx, hold: true });
}
const bragAt = LINE + 4 * CYCLE;
him.push({ ch: BZ, anim: "brag", at: bragAt, x: SPOT, hold: true });
const END = bragAt + startOf(BZ, "brag", BZ.anims.brag!.frames.length) + 700;
// Every moment something changes.
const cuts = new Set<number>([0, END]);
for (const t of [...him, ...props]) {
  const fr = t.ch.anims[t.anim]!.frames;
  let s = t.at;
  for (let k = 0; k < (t.ch.anims[t.anim]!.loop ? 20 : 1); k++) for (const f of fr) { cuts.add(s); s += f.ms; }
  cuts.add(s);
  if (t.until !== undefined) cuts.add(t.until);
}
for (const v of Object.values(events)) cuts.add(v);
const times = [...cuts].filter((c) => c >= 0 && c <= END).sort((a, b) => a - b);
const ms: number[] = [];
times.slice(0, -1).forEach((t, n) => {
  const items: Put[] = [];
  const back = props.filter((p) => p.ch !== DU && p.ch !== PO);
  for (const p of back) { const f = frameAt(p, t); if (f) items.push({ ch: p.ch, f, x: p.x }); }
  if (events.board !== undefined && t >= events.board) items.push({ img: t >= (events.pieces ?? Infinity) ? SLAB_P : SLAB, x: X0 });
  for (const p of props.filter((p) => p.ch === DU)) { const f = frameAt(p, t); if (f) items.push({ ch: p.ch, f, x: p.x }); }
  for (const h of him) { const f = frameAt(h, t); if (f) items.push({ ch: h.ch, f, x: h.x }); }
  for (const p of props.filter((p) => p.ch === PO)) { const f = frameAt(p, t); if (f) items.push({ ch: p.ch, f, x: p.x }); }
  writeFileSync(`${dir}/f${String(n).padStart(3, "0")}.png`, png(draw(items)));
  ms.push(times[n + 1]! - t);
});
writeFileSync(`${dir}/ms.txt`, ms.join("\n"));
writeFileSync(`${dir}/times.txt`, times.slice(0, -1).join("\n"));
console.log(ms.length, "frames", END, "ms; arrive", arriveLen, "drop at", dropMs);
