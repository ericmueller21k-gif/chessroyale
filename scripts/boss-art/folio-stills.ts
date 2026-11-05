// Stills of Folio's sanctuary pieces (Nov 5, review only): the room flat (room.png), or any Character's frames side by side.
//   npx tsx scripts/boss-art/folio-stills.ts room <out.png> [frame]
//   npx tsx scripts/boss-art/folio-stills.ts pieces <out.png> <scale> <name,name,...>   (pieces of the room, their frames, on grey)
//   npx tsx scripts/boss-art/folio-stills.ts loops <dir> <scale> <name,name,...>   (the pieces side by side on one clock, 15 fps, 4.8 s: l###.png)
import { writeFileSync } from "node:fs";
import { renderFrame } from "../../packages/app/src/characters/sprite.ts";
import { blank, blit, png } from "./render.ts";
import * as SHOP from "./out/house-shop-folio/house-shop-folio.ts";

const [mode = "room", out = "room.png", a3 = "0", a4 = ""] = process.argv.slice(2);
if (mode === "room") {
  const ch = SHOP.HOUSE_SHOP_FOLIO;
  const f = Number(a3);
  const fr = f === 0 ? ch.anims.idle!.frames[0]! : ch.anims["room-live"]!.frames[f]!;
  const r = renderFrame(ch, fr);
  const im = blank(r.w, r.h, "#14161b");
  blit(im, r, 0, 0, 1);
  writeFileSync(out, png(im));
} else if (mode === "loops") {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(out, { recursive: true });
  const sc = Number(a3);
  const chs = a4.split(",").map((n) => SHOP.SHOP_FOLIO_PIECES[n]!);
  const W = chs.reduce((s, c) => s + c.w * sc + 8, 8);
  const H = Math.max(...chs.map((c) => c.h)) * sc + 16;
  const at = (ch: (typeof chs)[number], ms: number) => {
    const fs = ch.anims.idle!.frames;
    const total = fs.reduce((s, f) => s + f.ms, 0);
    let t = ms % total;
    for (const f of fs) {
      if (t < f.ms) return f;
      t -= f.ms;
    }
    return fs[0]!;
  };
  for (let n = 0; n < 72; n++) {
    const im = blank(W, H, "#efe6d2");
    let x = 8;
    for (const ch of chs) {
      const r = renderFrame(ch, at(ch, Math.round((n * 1000) / 15)));
      blit(im, r, x, H - 8 - ch.foot[1] * sc - (ch.h - ch.foot[1]) * sc + (ch.h - 1 - ch.foot[1]) * sc, sc);
      x += ch.w * sc + 8;
    }
    writeFileSync(`${out}/l${String(n).padStart(3, "0")}.png`, png(im));
  }
} else {
  const sc = Number(a3);
  const names = a4.split(",");
  const rs = names.map((n) => {
    const ch = SHOP.SHOP_FOLIO_PIECES[n]!;
    return ch.anims.idle!.frames.map((fr) => renderFrame(ch, fr));
  });
  // each piece: its frames in a row (at most 8)
  const rowsW = rs.map((fs) => fs.slice(0, 8).reduce((s, r) => s + r.w * sc + 6, 0));
  const W = Math.max(...rowsW) + 6;
  const H = rs.reduce((s, fs) => s + Math.max(...fs.map((r) => r.h)) * sc + 6, 0) + 6;
  const im = blank(W, H, "#5a5560");
  let y = 6;
  for (const fs of rs) {
    let x = 6;
    for (const r of fs.slice(0, 8)) (blit(im, r, x, y, sc), (x += r.w * sc + 6));
    y += Math.max(...fs.map((r) => r.h)) * sc + 6;
  }
  writeFileSync(out, png(im));
}
console.log("wrote", out);
