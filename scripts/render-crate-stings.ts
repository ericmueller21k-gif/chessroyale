/**
 * Renders the crate opening's sound offline, audio only, for Eric's ear (Nov 24; crate tier stings): one full opening per tier, the
 * Transcendent moment alone, and a Transcendent opening (its strip, the moment, the second strip, a Mythic). WAV and MP3 (ffmpeg).
 * `npx tsx scripts/render-crate-stings.ts <out dir>`
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { bannerPlusMs, type ItemTier } from "@chessroyale/core";
import { crateSound, renderCues } from "../packages/app/src/crate-open/sounds.ts";
import { STRIPS, clickTimes, cues, timeline, type CrateCue } from "../packages/app/src/crate-open/timeline.ts";

const RATE = 44100;
const WIDTH = 390;
const out = process.argv[2] ?? "audio";
mkdirSync(out, { recursive: true });

function wav(name: string, x: Float32Array) {
  const pcm = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i]!)) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  const f = `${out}/${name}.wav`;
  writeFileSync(f, Buffer.concat([h, pcm]));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", f, "-codec:a", "libmp3lame", "-q:a", "2", `${out}/${name}.mp4`.replace(/mp4$/, "mp3")]);
  let peak = 0, sq = 0;
  for (const v of x) (peak = Math.max(peak, Math.abs(v))), (sq += v * v);
  console.log(`${name}: ${(x.length / RATE).toFixed(2)} s, peak ${peak.toFixed(2)}, rms ${Math.sqrt(sq / x.length).toFixed(3)}`);
}

const end = (list: readonly CrateCue[]) => Math.max(...list.map((c) => c.at + (crateSound(c.sound, RATE).length / RATE) * 1000)) + 300;

const T = timeline();
const clicks = clickTimes(T.spinMs, WIDTH, STRIPS.crate.land);
for (const tier of ["common", "rare", "epic", "legendary", "mythic"] as ItemTier[]) {
  const list = cues(T, clicks, tier);
  wav(`opening-${tier}`, renderCues(RATE, list, end(list)));
}
wav("transcendent-alone", renderCues(RATE, [{ at: 0, sound: "transcendent" }], end([{ at: 0, sound: "transcendent" }])));

// A Transcendent opening as the game runs it: the first strip (no item), the moment as it lands, the banner, the second strip's Mythic.
const first = cues(T, clicks, null);
const landAt = T.stop;
const T2 = timeline(undefined, false);
const second = landAt + 2500 + bannerPlusMs() + 200;
const list = [
  ...first,
  { at: landAt, sound: "transcendent" },
  ...cues(T2, clickTimes(T2.spinMs, WIDTH, STRIPS.fischer.land), "mythic").map((c) => ({ ...c, at: c.at + second })),
];
wav("opening-transcendent-mythic", renderCues(RATE, list, end(list)));
