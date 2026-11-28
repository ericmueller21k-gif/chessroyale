// Dumps the shop front's picture (1:1) as raw RGBA: npx tsx front.ts out.rgba  → prints "w h"
import { writeFileSync } from "node:fs";
import { lookalikeWith, MOCK_SHOP_SEED } from "../../packages/app/src/town/lookalike.ts";
import { renderFrame } from "../../packages/app/src/characters/sprite.ts";
const { box } = lookalikeWith({ seed: MOCK_SHOP_SEED, w: 113, tall: 3, corner: null, depth: 1.2, px: 37, flat: true });
const ch = box.front;
const { w, h, data } = renderFrame(ch, ch.anims.idle!.frames[0]!);
writeFileSync(process.argv[2]!, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
console.log(w, h);
