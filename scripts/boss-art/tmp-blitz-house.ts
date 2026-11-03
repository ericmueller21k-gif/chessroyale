// Temporary: the house's idle frames at 3x, and the home at 2x beside two others (deleted after).
import { mkdirSync, writeFileSync } from "node:fs";
import { renderFrame, type Character } from "../../packages/app/src/characters/sprite.ts";
import { HOUSES } from "../../packages/app/src/town/houses/index.ts";
import { HOUSE_BLITZ } from "./out/house-blitz/house-blitz.ts";
import { HOUSE_TIMBER } from "./out/house-timber/house-timber.ts";
import { blank, blit, png } from "./render.ts";
const [dir] = process.argv.slice(2);
mkdirSync(`${dir}/fr`, { recursive: true });
const BG = "#14161b";
HOUSE_BLITZ.anims.idle!.frames.forEach((fr, i) => {
  const im = renderFrame(HOUSE_BLITZ, fr);
  const out = blank(im.w * 3 + 24, im.h * 3 + 24, BG);
  blit(out, im, 12, 12, 3);
  writeFileSync(`${dir}/fr/${String(i).padStart(2, "0")}.png`, png(out));
});
const row: Character[] = [HOUSES.tiger.ch, HOUSE_BLITZ, HOUSE_TIMBER];
const s = 2;
const base = Math.max(...row.map((c) => c.foot[1])) * s + 16;
const town = blank(row.reduce((a, c) => a + c.w * s + 16, 16), base + 16, BG);
let x = 16;
for (const c of row) {
  blit(town, renderFrame(c, c.anims.idle!.frames[0]!), x, base - c.foot[1] * s, s);
  x += c.w * s + 16;
}
writeFileSync(`${dir}/town.png`, png(town));
