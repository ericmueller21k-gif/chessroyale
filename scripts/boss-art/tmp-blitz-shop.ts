// Temporary: renders an animation of the shop's room still to a PNG (deleted after).
import { writeFileSync } from "node:fs";
import { renderFrame } from "../../packages/app/src/characters/sprite.ts";
import { HOUSE_SHOP_BLITZ as R } from "./out/house-shop-blitz/house-shop-blitz.ts";
import { blank, blit, png } from "./render.ts";
const [out, anim = "idle", fs = "0", zs = "1"] = process.argv.slice(2);
const a = R.anims[anim]!;
const z = Number(zs);
const frs = fs === "all" ? a.frames.map((_, i) => i) : fs.split(",").map(Number);
for (const f of frs) {
  const im = renderFrame(R, a.frames[f]!);
  // Crop to what's drawn.
  let x1 = 0, y1 = 0;
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (im.data[(y * im.w + x) * 4 + 3]! > 0) (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
  const o = blank((x1 + 2) * z, (y1 + 2) * z, "#14161b");
  blit(o, im, 0, 0, z);
  writeFileSync(frs.length > 1 ? out.replace(".png", `-${String(f).padStart(2, "0")}.png`) : out, png(o));
}
