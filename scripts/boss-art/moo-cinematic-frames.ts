/**
 * One frame of a drawing as a 1x PNG with its own transparency (Nov 17, Moo's Full Moon cinematic): the stills put the scenes
 * and Moo's sprite over the real game screen, scaled up with nearest-neighbor in the browser.
 *   npx tsx scripts/boss-art/moo-cinematic-frames.ts <out dir> <file#Export:anim/frame> ...   (writes <Export>-<anim>-<frame>.png)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderFrame, type Character } from "../../packages/app/src/characters/sprite.ts";
import { png } from "./render.ts";

const [out, ...specs] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
for (const spec of specs) {
  const [file, tail] = spec.split("#") as [string, string];
  const [exp, rest] = tail.split(":") as [string, string];
  const [anim, f] = rest.split("/") as [string, string];
  const ch = ((await import(resolve(file))) as Record<string, Character>)[exp];
  if (!ch) throw new Error(`${file} exports no ${exp}`);
  const an = ch.anims[anim];
  if (!an) throw new Error(`${exp} has no ${anim}`);
  const i = f === "last" ? an.frames.length - 1 : Number(f);
  const r = renderFrame(ch, an.frames[i]!);
  const name = `${exp}-${anim}-${i}.png`;
  writeFileSync(join(out!, name), png({ w: r.w, h: r.h, data: r.data }));
  console.log(name, r.w, r.h, "foot", ch.foot.join(","));
}
