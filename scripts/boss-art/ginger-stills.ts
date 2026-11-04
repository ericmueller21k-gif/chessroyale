/**
 * Stills for Ginger's igloo candy shop (Nov 5), no browser: the room laid out flat (its HOUSE_SHOP_GINGER idle), with ELVES=1 the
 * elves in their places, and sheets of animation frames side by side, blown up, on a plain ground.
 *   npx tsx scripts/boss-art/ginger-stills.ts room <out.png> [frame]
 *   npx tsx scripts/boss-art/ginger-stills.ts sheet <out.png> <scale> <file#Export:anim[,anim...][@flip]> ...
 * A sheet: one row per animation, its frames left to right ("anim/0.5.8": only those frames); `@flip` mirrors a row. Rows wrap at 1500 px.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderFrame, type Character } from "../../packages/app/src/characters/sprite.ts";
import { blank, blit, png } from "./render.ts";

const [cmd, out, ...rest] = process.argv.slice(2);
type Img = { w: number; h: number; data: Uint8ClampedArray };
const flipImg = (im: Img): Img => {
  const d = new Uint8ClampedArray(im.data.length);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) d.set(im.data.subarray((y * im.w + x) * 4, (y * im.w + x) * 4 + 4), (y * im.w + (im.w - 1 - x)) * 4);
  return { w: im.w, h: im.h, data: d };
};

if (cmd === "room") {
  const m = (await import("./out/house-shop-ginger/house-shop-ginger.ts")) as Record<string, unknown>;
  const ch = m.HOUSE_SHOP_GINGER as Character;
  const im = renderFrame(ch, ch.anims.idle!.frames[Number(rest[0] ?? 0)]!, { bg: "#0f1626" });
  const img = { w: im.w, h: im.h, data: im.data };
  if (process.env.ELVES) {
    const { placeElves } = await import("./ginger-place.ts");
    for (const [c, anim, at, lift, flip] of placeElves(0)) {
      const r = renderFrame(c, c.anims[anim]!.frames[0]!);
      const pic = flip ? flipImg({ w: r.w, h: r.h, data: r.data }) : { w: r.w, h: r.h, data: r.data };
      const fx = flip ? c.w - 1 - c.foot[0] : c.foot[0];
      blit(img, pic, Math.round(at[0] * 37 + 18.5 - fx), Math.round((m.SHOP_GINGER_TOP as number) + at[1] * 37 + 18.5 - lift - c.foot[1]), 1);
    }
  }
  writeFileSync(out!, png(img));
  console.log(`wrote ${out} (${im.w} x ${im.h})`);
} else if (cmd === "sheet") {
  const scale = Number(rest[0] ?? 3);
  const rows: { imgs: Img[]; h: number }[] = [];
  for (const spec of rest.slice(1)) {
    const [left, flip] = spec.split("@");
    const [file, tail] = left!.split("#") as [string, string];
    const [exp, animList] = tail.split(":") as [string, string | undefined];
    const ch = ((await import(resolve(file))) as Record<string, Character>)[exp]!;
    for (const aspec of (animList ?? Object.keys(ch.anims).join(",")).split(",")) {
      const [a, pick] = aspec.split("/") as [string, string | undefined];
      const an = ch.anims[a];
      if (!an) throw new Error(`${exp} has no ${a}`);
      const list = pick ? pick.split(".").map(Number).map((i) => an.frames[i]!) : an.frames;
      const imgs = list.map((f) => {
        const r = renderFrame(ch, f);
        const im = { w: r.w, h: r.h, data: r.data };
        return flip ? flipImg(im) : im;
      });
      if (process.env.ONEROW && rows.length) rows.at(-1)!.imgs.push(...imgs), (rows.at(-1)!.h = Math.max(rows.at(-1)!.h, ch.h));
      else rows.push({ imgs, h: ch.h });
    }
  }
  const MAX = 1500;
  const placed: { im: Img; x: number; y: number }[] = [];
  let y = 8;
  let wMax = 0;
  for (const r of rows) {
    let x = 8;
    for (const im of r.imgs) {
      if (x + im.w * scale > MAX) ((x = 8), (y += r.h * scale + 6));
      placed.push({ im, x, y });
      x += im.w * scale + 4;
      wMax = Math.max(wMax, x);
    }
    y += r.h * scale + 12;
  }
  const bg = blank(Math.min(MAX, wMax + 4), y, process.env.BG ?? "#3a4458");
  for (const p of placed) blit(bg, p.im, p.x, p.y, scale);
  writeFileSync(out!, png(bg));
  console.log(`wrote ${out} (${bg.w} x ${bg.h})`);
}
