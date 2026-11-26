// Dumps Chandy's checkmate frames as raw RGBA (for the pose sheet and the storyboard): npx tsx scripts/chandy-mate-dump.ts <out.json> [stage]
import { writeFileSync } from "node:fs";
import { CHANDY_MATE, MATE_ANIMS } from "../packages/app/src/characters/chandy-mate.ts";
import { chandyAnim, type RifleStage } from "../packages/app/src/characters/chandy.ts";
import { renderFrame } from "../packages/app/src/characters/sprite.ts";

const [out = "mate.json", st = "5"] = process.argv.slice(2);
const stage = Number(st) as RifleStage;
const anims: Record<string, { ms: number; cue?: string; shake?: readonly number[]; data: string }[]> = {};
for (const name of MATE_ANIMS) {
  const a = CHANDY_MATE.anims[chandyAnim(name, stage)]!;
  anims[name] = a.frames.map((f) => ({ ms: f.ms, cue: f.cue, shake: f.shake, data: Buffer.from(renderFrame(CHANDY_MATE, f).data).toString("base64") }));
}
writeFileSync(out, JSON.stringify({ w: CHANDY_MATE.w, h: CHANDY_MATE.h, foot: CHANDY_MATE.foot, anims }));
