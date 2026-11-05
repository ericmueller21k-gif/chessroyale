// Stills of Folio's sanctuary pieces (Nov 5, review only): the room flat (room.png), or any Character's frames side by side.
//   npx tsx scripts/boss-art/folio-stills.ts room <out.png> [frame]
//   npx tsx scripts/boss-art/folio-stills.ts pieces <out.png> <scale> <name,name,...>   (pieces of the room, first frame, on cream)
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
