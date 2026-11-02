/**
 * Renders Timber's synthesized sounds to WAV files for Eric to listen to before they merge (16-bit mono, 44.1 kHz):
 * one per sound, plus `select.wav` (his select sound, the gnaw). `npx tsx scripts/timber-sounds-wav.ts [out dir]`,
 * docs/timber-sounds/ by default.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TIMBER_SOUNDS, timberSound, type TimberSound } from "../packages/app/src/characters/timber-sounds.ts";
import { SELECT_SOUND } from "../packages/app/src/characters/boss-select.ts";

const RATE = 44100;
const out = process.argv[2] ?? "docs/timber-sounds";

function wav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

mkdirSync(out, { recursive: true });
for (const name of TIMBER_SOUNDS) writeFileSync(join(out, `${name}.wav`), wav(timberSound(name, RATE)));
// (His select sound by its name in the game, `timberGnaw`: the module's `gnaw`.)
const select = SELECT_SOUND.timber!.replace(/^timber(.)/, (_, c: string) => c.toLowerCase()) as TimberSound;
writeFileSync(join(out, "select.wav"), wav(timberSound(select, RATE)));
console.log(`${TIMBER_SOUNDS.length + 1} files in ${out} (select: ${select})`);
