// Mockup of Timber's whole battle intro (Nov 3): his moves (boss-beaver.ts, BOSS_BEAVER_INTRO) and the props
// (house-intro-timber.ts) laid out side-on on one floor line, as code would play them. The board on the table is a
// stand-in (the game's renderer draws the real slab and board). Usage: npx tsx scripts/boss-art/intro-timber-view.ts <dir>
import { writeFileSync } from "node:fs";
import { renderFrame, type Character, type Frame } from "../../packages/app/src/characters/sprite.ts";
import { blank, blit, png } from "./render.ts";
const P = await import("./out/house-intro-timber/house-intro-timber.ts");
const B = await import("./out/boss-beaver/boss-beaver.ts");
const dir = process.argv[2]!;
const TI = B.BOSS_BEAVER_INTRO as Character, LOG = P.INTRO_TIMBER_LOG as Character, SH = P.INTRO_TIMBER_SHAVINGS as Character;
const TB = P.INTRO_TIMBER_TABLE as Character, ST = P.INTRO_TIMBER_STUMP as Character;
const REACH = B.TIMBER_INTRO_REACH as [number, number], LIFT = B.TIMBER_INTRO_LIFT_AT as [number, number];
const sc = 3, W = 360, H = 190, GY = 165, X0 = 200, LOGX = 70;
const pal = P.INTRO_TIMBER_TABLE_PALETTE as Record<string, string>;
const hexc = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255];
const slab = (() => {
  const im = { w: TB.w, h: TB.h, data: new Uint8ClampedArray(TB.w * TB.h * 4) } as any;
  const put = (x: number, y: number, c: string) => im.data.set(hexc(c), (y * TB.w + x) * 4);
  const top = TB.foot[1] - 27, x0 = TB.foot[0] - 16, x1 = TB.foot[0] + 16;
  for (let y = top - 10; y < top; y++) for (let x = x0; x < x1; x++) put(x, y, x === x0 || x === x1 - 1 || y === top - 10 ? pal["1"]! : (Math.floor((x - x0 - 1) / 3.75) + y) % 2 ? pal.D! : pal.L!);
  for (let y = top; y < top + 3; y++) for (let x = x0; x < x1; x++) put(x, y, pal["4"]!);
  return im;
})();
type Put = { ch: Character | "slab"; f?: Frame; x: number; flip?: boolean };
let n = 0; const ms: number[] = [];
const draw = (items: Put[], t: number) => {
  const o = blank(W * sc, H * sc, "#c99a62");
  for (let y = GY * sc; y < H * sc; y++) for (let x = 0; x < W * sc; x++) o.data.set([176, 128, 74, 255], (y * W * sc + x) * 4);
  for (const it of items) {
    if (it.ch === "slab") { blit(o, slab, (it.x - TB.foot[0]) * sc, (GY - TB.foot[1]) * sc, sc); continue; }
    let im = renderFrame(it.ch, it.f!);
    if (it.flip) { const f = blank(im.w, im.h, "#00000000"); for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) f.data.set(im.data.subarray((y * im.w + x) * 4, (y * im.w + x) * 4 + 4), (y * im.w + (im.w - 1 - x)) * 4); im = f; }
    const fx = it.flip ? it.ch.w - 1 - it.ch.foot[0] : it.ch.foot[0];
    blit(o, im, (it.x - fx) * sc, (GY - it.ch.foot[1]) * sc, sc);
  }
  writeFileSync(`${dir}/f${String(n++).padStart(3, "0")}.png`, png(o)); ms.push(t);
};
const A = TI.anims, LA = LOG.anims, SA = SH.anims;
const tableSet = (): Put[] => [{ ch: TB, f: TB.anims.idle!.frames[0], x: X0 }, { ch: "slab", x: X0 }, { ch: ST, f: ST.anims.idle!.frames[0], x: X0 - 37 }, { ch: ST, f: ST.anims.idle!.frames[0], x: X0 + 37 }];
const lying = { ch: LOG, f: LA.lying!.frames[0], x: LOGX };
let tx = X0 - 55;
for (let i = 0; i < 6; i++) draw([lying, { ch: TI, f: A.idle!.frames[0], x: tx }], 130); // his line
const walkTo = (to: number, anim: string, extra: () => Put[], stepMs = 110) => {
  const fr = A[anim]!.frames; const steps = Math.max(4, Math.round(Math.abs(to - tx) / 6)); const from = tx;
  for (let i = 1; i <= steps; i++) { tx = Math.round(from + ((to - from) * i) / steps); draw([...extra(), { ch: TI, f: fr[i % fr.length], x: tx, flip: to < from }], stepMs); }
};
walkTo(LOGX - LIFT[0], "walk", () => [lying]);
for (const f of A.lift!.frames) draw([{ ch: TI, f, x: tx }], f.ms);
walkTo(X0 - REACH[0], "carry", () => []);
for (const f of A.setDown!.frames) draw([{ ch: TI, f, x: tx }], f.ms);
const logAt = X0;
LA.gnawed!.frames.forEach((lf, i) => { for (let j = 0; j < 3; j++) draw([{ ch: LOG, f: lf, x: logAt }, { ch: TI, f: A.gnaw!.frames[(i * 3 + j) % 8], x: tx }], 90); });
const lastLog = LA.gnawed!.frames.at(-1)!;
SA.rise!.frames.forEach((f, i) => draw([{ ch: LOG, f: lastLog, x: logAt }, { ch: TI, f: A.gnaw!.frames[i % 8], x: tx }, { ch: SH, f, x: X0 }], f.ms));
for (let k = 0; k < 2; k++) for (const f of SA.hold!.frames) draw([...tableSet(), { ch: TI, f: A.idle!.frames[0], x: tx }, { ch: SH, f, x: X0 }], f.ms);
for (const f of SA.settle!.frames) draw([...tableSet(), { ch: TI, f: A.idle!.frames[0], x: tx }, { ch: SH, f, x: X0 }], f.ms);
const ring = SA.settle!.frames.at(-1)!;
for (const f of A.done!.frames) draw([...tableSet(), { ch: SH, f: ring, x: X0 }, { ch: TI, f, x: tx }], f.ms);
draw([...tableSet(), { ch: SH, f: ring, x: X0 }, { ch: TI, f: A.idle!.frames[0], x: tx }], 900);
writeFileSync(`${dir}/ms.txt`, ms.join("\n"));
console.log(n, ms.reduce((a, b) => a + b, 0));
