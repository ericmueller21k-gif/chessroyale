// npx tsx scripts/boss-art/moo-closeup/parts.ts <out dir> '{"head":[-1,-2],"gaze":[-1,-1],"moonEyes":"open","moonGaze":[-1,-1]}'   then compose.py <out dir> <frames dir>
// Moo's real rig, rendered in parts for the close-up: Moo without the Moon (eyes open / glowing), the Moon (with and without its eyes).
import { writeFileSync, mkdirSync } from "node:fs";
import { MOO, mooLayers, type MooPose } from "../../../packages/app/src/characters/moo.ts";
import { renderFrame, type Frame, type Layer } from "../../../packages/app/src/characters/sprite.ts";
import { png } from "../render.ts";
const out = process.argv[2]!;
mkdirSync(out, { recursive: true });
const pose: MooPose = JSON.parse(process.argv[3] ?? "{}");
const isMoon = (l: Layer) => l.part.startsWith("moon");
const shot = (name: string, p: MooPose, keep: (l: Layer) => boolean, pal?: Record<string, string>) => {
  const f: Frame = { ms: 100, layers: mooLayers(p).filter(keep), ...(pal ? { pal } : {}) };
  const r = renderFrame(MOO, f);
  writeFileSync(`${out}/${name}.png`, png({ w: r.w, h: r.h, data: r.data }));
};
shot("moo", pose, (l) => !isMoon(l));
shot("moo-glow", { ...pose, eyes: "glow" }, (l) => !isMoon(l), { e: "#fff2b3", x: "#ffffff" });
shot("moon", pose, isMoon);
shot("moon-noeyes", { ...pose, moonEyes: "none" }, isMoon);
shot("whole", pose, () => true);
