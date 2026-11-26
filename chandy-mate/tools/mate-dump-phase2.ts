// scratch: npx tsx scripts/.mate-dump.ts out.json stage name...
import { writeFileSync } from "node:fs";
import { CHANDY_MATE } from "../packages/app/src/characters/chandy-mate.ts";
import { chandyAnim, type RifleStage } from "../packages/app/src/characters/chandy.ts";
import { renderFrame } from "../packages/app/src/characters/sprite.ts";
const [out, st, ...names] = process.argv.slice(2);
const stage = Number(st) as RifleStage;
const anims: Record<string, { ms: number; cue?: string; data: string }[]> = {};
for (const name of names) {
  const a = CHANDY_MATE.anims[chandyAnim(name, stage)]!;
  anims[name] = a.frames.map((f) => ({ ms: f.ms, cue: f.cue, data: Buffer.from(renderFrame(CHANDY_MATE, f).data).toString("base64") }));
}
writeFileSync(out!, JSON.stringify({ w: CHANDY_MATE.w, h: CHANDY_MATE.h, foot: CHANDY_MATE.foot, anims }));
