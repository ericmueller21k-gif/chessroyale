/**
 * Smudgy's studio, drawn flat for a look (Nov 6): every piece of SHOP_SMUDGY_LAYOUT at its foot (no camera, the room as a plan with its
 * upright pieces standing at their feet), and strips of the painters' loop, the knight's turn, the cloth's whip and the keeper.
 * `npx tsx scripts/boss-art/smudgy-stills.ts <out dir>`: room.png, painters.png, intro.png, keeper.png.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderFrame, type Character } from "../../packages/app/src/characters/sprite.ts";
import { png } from "../bake-sidekicks.ts";
import { SHOP_SMUDGY_LAYOUT, SHOP_SMUDGY_PIECES } from "../../packages/app/src/town/shops/smudgy-art.ts";
import { INTRO_SMUDGY_CLOTH, INTRO_SMUDGY_TABLE } from "../../packages/app/src/town/shops/smudgy-intro-art.ts";

const out = process.argv[2] ?? "scripts/boss-art/out/house-shop-smudgy";
mkdirSync(out, { recursive: true });
const T = 37;
const hex = (s: string) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), s.length > 7 ? parseInt(s.slice(7, 9), 16) : 255];
class Img {
  data: Uint8Array;
  constructor(public w: number, public h: number, bg = "#1a1520") {
    this.data = new Uint8Array(w * h * 4);
    const [r, g, b] = hex(bg);
    for (let i = 0; i < w * h; i++) this.data.set([r!, g!, b!, 255], i * 4);
  }
  draw(ch: Character, anim: string, f: number, x: number, y: number, flip = false, k = 1) {
    const fr = ch.anims[anim]!.frames[f % ch.anims[anim]!.frames.length]!;
    const { w, h, data } = renderFrame(ch, fr);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const a = data[(j * w + i) * 4 + 3]! / 255;
        if (!a) continue;
        const sx = flip ? w - 1 - i : i;
        for (let v = 0; v < k; v++)
          for (let u = 0; u < k; u++) {
            const X = Math.round(x + (sx - (flip ? w - 1 - ch.foot[0] : ch.foot[0])) * k + u);
            const Y = Math.round(y + (j - ch.foot[1]) * k + v);
            if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
            const o = (Y * this.w + X) * 4;
            for (let c = 0; c < 3; c++) this.data[o + c] = Math.round(this.data[o + c]! * (1 - a) + data[(j * w + i) * 4 + c]! * a);
          }
      }
  }
  save(name: string) {
    writeFileSync(`${out}/${name}`, png(this.w, this.h, this.data));
  }
}
// The room: floor tiles at their squares, uprights at their feet (row middles), far to near.
{
  const im = new Img(20 * T, 20 * T + 140);
  const oy = 140;
  for (const p of SHOP_SMUDGY_LAYOUT) {
    const ch = SHOP_SMUDGY_PIECES[p.name]!;
    const w = p.w ?? 1;
    const isFloor = /^(floor|circle)/.test(p.name);
    const t0 = p.t0 ?? 0;
    const fi = t0 ? Math.floor(t0 / ch.anims.idle!.frames[0]!.ms) : 0;
    if (isFloor) im.draw(ch, "idle", 0, p.col * T + 18, oy + p.row * T + 18);
    else im.draw(ch, "idle", fi, p.col * T + (w * T) / 2, oy + p.row * T + (p.name.startsWith("wall") || p.name === "backdrop" || p.name === "hem" || p.name === "entrance" ? 36 : 18), !!p.flip);
  }
  im.save("room.png");
}
// The painters' loop (one color), 32 frames; the knight's 16.
{
  const P = SHOP_SMUDGY_PIECES["painter-a"]!;
  const im = new Img(8 * 100 * 2, 4 * 76 * 2);
  for (let f = 0; f < 32; f++) im.draw(P, "idle", f, ((f % 8) * 100 + 30) * 2, (Math.floor(f / 8) * 76 + 70) * 2, false, 2);
  im.save("painters.png");
  const K = SHOP_SMUDGY_PIECES["platform"]!;
  const k2 = new Img(8 * 80 * 2, 2 * 90 * 2);
  for (let f = 0; f < 16; f++) k2.draw(K, "idle", f, ((f % 8) * 80 + 40) * 2, (Math.floor(f / 8) * 90 + 84) * 2, false, 2);
  k2.save("knight.png");
  const v = new Img(4 * 100 * 2, 80 * 2);
  for (let i = 0; i < 4; i++) v.draw(SHOP_SMUDGY_PIECES[`painter-${"abcd"[i]}`]!, "idle", 20, (i * 100 + 30) * 2, 74 * 2, false, 2);
  v.save("painter-colors.png");
}
// The intro: the cloth's frames over the table.
{
  const C = INTRO_SMUDGY_CLOTH;
  const n = C.anims.whip!.frames.length + 2;
  const im = new Img(n * 240, 140 * 2);
  for (let i = 0; i < n; i++) {
    const x = i * 240 + 170;
    const y = 128;
    im.draw(INTRO_SMUDGY_TABLE, "idle", 0, x, y);
    if (i === 0) im.draw(C, "covered", 0, x, y);
    else if (i <= C.anims.whip!.frames.length) im.draw(C, "whip", i - 1, x, y);
    else im.draw(C, "heap", 0, x, y);
  }
  im.save("intro-cloth.png");
}
// The gallery owner: idle, walk, sit, wave (its first frames), at 3x.
{
  const { sidekickSmudgyKeeper: K } = await import("../../packages/app/src/characters/sidekicks/smudgykeeper.ts");
  const im = new Img(4 * 70 * 3, 70 * 3);
  ["idle", "walk", "sit", "wave"].forEach((a, i) => im.draw(K, a, 0, (i * 70 + 30) * 3, 64 * 3, false, 3));
  im.save("keeper.png");
}
