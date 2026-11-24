// MOCKUP (claude/crate-open-mockup): renders the crate opening's three sound options to WAV and MP3.
//   npx tsx scripts/crate-open-sounds.ts <out dir> [tier=rare] [spin=2700]
// Each option's whole sequence (the spin's clicks slowing to a stop, the box landing and shaking, the burst and sting), and each
// one's Legendary ending on its own. Needs ffmpeg for the MP3s.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ItemTier } from "@chessroyale/core";
import { CRATE_SOUND_OPTIONS, renderCrateClip, renderLegendaryEnding } from "../packages/app/src/dev/crate-open-sounds.ts";

const [dir = "crate-sounds", ...args] = process.argv.slice(2);
const arg = (k: string) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
const tier = (arg("tier") ?? "rare") as ItemTier;
const spinMs = Number(arg("spin") ?? 2700);
const all = args.includes("tiers=all");
const RATE = 48000;
mkdirSync(dir, { recursive: true });

function wav(x: Float32Array): Buffer {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + x.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i]!)) * 32767), 44 + i * 2);
  return b;
}
function save(name: string, x: Float32Array) {
  const w = join(dir, `${name}.wav`);
  writeFileSync(w, wav(x));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", w, "-codec:a", "libmp3lame", "-b:a", "192k", join(dir, `${name}.mp3`)]);
  console.log(`${name}: ${(x.length / RATE).toFixed(2)} s`);
}

const slug = { spokes: "card-in-the-spokes", ratchet: "prize-wheel-ratchet", reel: "slot-reel" } as const;
for (const o of CRATE_SOUND_OPTIONS) {
  const base = `${o.letter}-${slug[o.id]}`;
  save(base, renderCrateClip(RATE, { option: o.id, tier, spinMs }));
  save(`${base}-legendary-ending`, renderLegendaryEnding(RATE, o.id));
  if (all)
    for (const t of ["common", "uncommon", "rare", "epic", "legendary", "mythic"] as ItemTier[])
      save(`tiers/${base}-${t}`, renderCrateClip(RATE, { option: o.id, tier: t, spinMs }));
}
