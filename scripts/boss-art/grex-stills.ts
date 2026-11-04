/**
 * Stills for Jefferson's warehouse (Nov 4), no browser: the room laid out flat (its HOUSE_SHOP_GREX idle) and sheets of
 * animation frames side by side, blown up, on a plain ground.
 *   npx tsx scripts/boss-art/grex-stills.ts room <out.png> [frame]
 *   npx tsx scripts/boss-art/grex-stills.ts sheet <out.png> <scale> <file#Export:anim[,anim...][@flip]> ...
 * A sheet: one row per animation, its frames left to right, each row labelled by nothing (the notes name them); `@flip`
 * mirrors a row. Rows wrap at 1500 px.
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
  const m = (await import("./out/house-shop-grex/house-shop-grex.ts")) as Record<string, unknown>;
  const ch = m.HOUSE_SHOP_GREX as Character;
  const extra = rest[1] ? ((await import(resolve(rest[1]))) as { place?: (bg: Img) => void }) : null;
  const im = renderFrame(ch, ch.anims.idle!.frames[Number(rest[0] ?? 0)]!, { bg: "#1b1a20" });
  const img = { w: im.w, h: im.h, data: im.data };
  extra?.place?.(img);
  if (process.env.CREW) {
    // The crew in their places (1:1), north first: the dealer in his corner (mirrored), the idle crew, the machines at home, the pallet.
    const N = await import("./out/npc-grex/npc-grex.ts");
    const { sidekickGrexDealer } = await import("./out/sidekick-grex-dealer/sidekick-grex-dealer.ts");
    const TOP = m.SHOP_GREX_TOP as number;
    const C = m.SHOP_GREX_CREW as Record<string, { at: readonly number[]; face: number }>;
    const K = m.SHOP_GREX_KEEPER as { at: readonly number[]; face: number };
    const PA = m.SHOP_GREX_PALLET_AT as readonly number[];
    const who: [Character, string, readonly number[], boolean][] = [
      [sidekickGrexDealer, "idle", K.at, K.face < 0],
      [N.NPC_GREX_LEANER_A, "idle", C["leaner-a"]!.at, false],
      [N.NPC_GREX_LEANER_B, "idle", C["leaner-b"]!.at, false],
      [N.NPC_GREX_CREW_C, "idle", C["crew-c"]!.at, false],
      [N.NPC_GREX_CREW_D, "idle", C["crew-d"]!.at, false],
      [N.NPC_GREX_LIFT, "idle", C.lift!.at, false],
      [N.NPC_GREX_FORKLIFT, "idle", C.forklift!.at, false],
      [N.NPC_GREX_PALLET, "idle", PA, false],
    ];
    who.sort((a, b) => a[2][1]! - b[2][1]!);
    for (const [ch, anim, at, flip] of who) {
      const r = renderFrame(ch, ch.anims[anim]!.frames[0]!);
      const im = flip ? flipImg({ w: r.w, h: r.h, data: r.data }) : { w: r.w, h: r.h, data: r.data };
      const fx = flip ? ch.w - 1 - ch.foot[0] : ch.foot[0];
      blit(img, im, Math.round(at[0]! * 37 + 18.5 - fx), Math.round(TOP + at[1]! * 37 + 18.5 - ch.foot[1]), 1);
    }
  }
  writeFileSync(out!, png(img));
  console.log(`wrote ${out} (${im.w} x ${im.h})`);
} else if (cmd === "sheet") {
  const scale = Number(rest[0] ?? 3);
  const rowsSpec = rest.slice(1);
  const rows: { imgs: Img[]; h: number }[] = [];
  for (const spec of rowsSpec) {
    const [left, flip] = spec.split("@");
    const [file, tail] = left!.split("#") as [string, string];
    const [exp, animList] = tail.split(":") as [string, string | undefined];
    const ch = ((await import(resolve(file))) as Record<string, Character>)[exp]!;
    for (const aspec of (animList ?? Object.keys(ch.anims).join(",")).split(",")) {
      // "anim/0.5.8": only those frames.
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
  // Lay out: each row's frames left to right, wrapping.
  const placed: { im: Img; x: number; y: number }[] = [];
  let y = 8;
  let wMax = 0;
  for (const r of rows) {
    let x = 8;
    for (const im of r.imgs) {
      if (x + im.w * scale > MAX) {
        x = 8;
        y += r.h * scale + 6;
      }
      placed.push({ im, x, y });
      x += im.w * scale + 4;
      wMax = Math.max(wMax, x);
    }
    y += r.h * scale + 12;
  }
  const bg = blank(Math.min(MAX, wMax + 4), y, process.env.BG ?? "#3a3c44");
  for (const p of placed) blit(bg, p.im, p.x, p.y, scale);
  writeFileSync(out!, png(bg));
  console.log(`wrote ${out} (${bg.w} x ${bg.h})`);
}
