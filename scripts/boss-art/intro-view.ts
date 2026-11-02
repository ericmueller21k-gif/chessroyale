// Mockup frames of Alfil's battle intro (the pyramid sequence with a stand-in slab, and the storm tiles): npx tsx scripts/boss-art/intro-view.ts <dir>. Then storm-view.py composes the storm over a phone still.
import { writeFileSync } from "node:fs";
import { renderFrame } from "../../packages/app/src/characters/sprite.ts";
import { blank, blit, png } from "./render.ts";
const m = await import("./out/house-intro-alfil/house-intro-alfil.ts");
const P = m.INTRO_ALFIL_PYRAMID, T = m.INTRO_ALFIL_TABLE;
const S = process.argv[2]!;
const sc = 4, W = P.w * sc + 40, H = P.h * sc + 40;
const floor = "#e9cf9c";
let n = 0; const ms: number[] = [];
const draw = (layers: [any, any][]) => {
  const im = blank(W, H, floor);
  for (const [ch, fr] of layers) { if (ch === T) blit(im, slab, 20 + (P.foot[0] - T.foot[0]) * sc, 20 + (P.foot[1] - T.foot[1]) * sc, sc); const r = renderFrame(ch, fr); blit(im, r, 20 + (P.foot[0] - ch.foot[0]) * sc, 20 + (P.foot[1] - ch.foot[1]) * sc, sc); }
  writeFileSync(`${S}/seq/f${String(n++).padStart(3, "0")}.png`, png(im));
};
const t0 = T.anims.idle!.frames[0];
// A stand-in for the slab and board the game's renderer draws on the table (mockup only): top face, front face, 8 x 8 squares.
const pal = m.INTRO_ALFIL_TABLE_PALETTE as Record<string, string>;
const hexc = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255];
const slab = { w: T.w, h: T.h, data: new Uint8ClampedArray(T.w * T.h * 4) } as any;
const put = (x: number, y: number, c: string) => slab.data.set(hexc(c), (y * T.w + x) * 4);
const top = T.foot[1] - 26, x0 = T.foot[0] - 16, x1 = T.foot[0] + 16, depth = 10;
for (let y = top - depth; y < top; y++) for (let x = x0; x < x1; x++) {
  const bx = Math.floor((x - x0 - 1) / 3.75), by = Math.floor((y - (top - depth) - 1) / 1.0);
  const edge = x === x0 || x === x1 - 1 || y === top - depth;
  put(x, y, edge ? pal["1"]! : (bx + by) % 2 ? (pal.D ?? "#3768c4") : (pal.L ?? "#ecc98c"));
}
for (let y = top; y < top + 3; y++) for (let x = x0; x < x1; x++) put(x, y, pal["4"]!);
for (const f of P.anims.rise!.frames) { draw([[P, f]]); ms.push(f.ms); }
for (let i = 0; i < 3; i++) for (const f of P.anims.idle!.frames) { draw([[P, f]]); ms.push(f.ms); }
for (const f of P.anims.crack!.frames) { draw([[P, f]]); ms.push(f.ms); }
P.anims.crumble!.frames.forEach((f: any, i: number) => { draw(i >= 2 ? [[T, t0], [P, f]] : [[P, f]]); ms.push(f.ms); });
draw([[T, t0]]); ms.push(1200);
writeFileSync(`${S}/seq/ms.txt`, ms.join("\n"));
// The storm tiles at 1x, every frame.
const st = m.INTRO_ALFIL_STORM, fr = m.INTRO_ALFIL_FRONT;
st.anims.idle!.frames.forEach((f: any, i: number) => writeFileSync(`${S}/storm/s${i}.png`, png(renderFrame(st, f))));
fr.anims.idle!.frames.forEach((f: any, i: number) => writeFileSync(`${S}/storm/f${i}.png`, png(renderFrame(fr, f))));
console.log(n, st.anims.idle!.frames.length, fr.anims.idle!.frames.length, T.w, T.h);
