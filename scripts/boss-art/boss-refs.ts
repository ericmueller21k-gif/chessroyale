/**
 * Reference pictures of a boss for item and rider modes: a few of its animations' frames at 4x on the game's dark
 * ground, one PNG per animation, so the model sees the boss's colors and feel.
 *   npx tsx scripts/boss-art/boss-refs.ts <out dir> <character id>[:anim,anim] ...
 * (Default anims: idle and victory. A sidekick: its id as in characters/sidekicks, e.g. sidekick-puddles.)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHARACTERS } from "../../packages/app/src/characters/index.ts";
import { renderFrame, type Character } from "../../packages/app/src/characters/sprite.ts";
import { blank, blit, png } from "./render.ts";

const [out, ...wanted] = process.argv.slice(2);
if (!out || !wanted.length) {
  console.error("usage: npx tsx scripts/boss-art/boss-refs.ts <out dir> <character id>[:anim,anim] ...");
  process.exit(2);
}
mkdirSync(out, { recursive: true });
for (const w of wanted) {
  const [id, list] = w.split(":");
  const ch: Character | undefined = CHARACTERS.find((c) => c.id === id);
  if (!ch) throw new Error(`no character "${id}"; the ids: ${CHARACTERS.map((c) => c.id).join(", ")}`);
  for (const name of (list ?? "idle,victory").split(",")) {
    const anim = ch.anims[name];
    if (!anim) continue;
    const picks = [...new Set([0, Math.floor(anim.frames.length / 3), Math.floor((2 * anim.frames.length) / 3)])].slice(0, 3);
    const s = Math.max(1, Math.min(4, Math.floor(1400 / (picks.length * (ch.w + 4)))));
    const img = blank(picks.length * (ch.w * s + 8) + 8, ch.h * s + 16, "#14161b");
    picks.forEach((f, i) => blit(img, renderFrame(ch, anim.frames[f]!), 8 + i * (ch.w * s + 8), 8, s));
    writeFileSync(join(out, `${id}-${name}.png`), png(img));
    console.log(`saved ${id}-${name}.png`);
  }
}
