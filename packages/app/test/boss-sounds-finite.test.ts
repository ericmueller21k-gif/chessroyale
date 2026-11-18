/**
 * Every synthesized sound is numbers only (Nov 3: Timber's chitter had one NaN sample at 48 kHz, from `bump`'s sine dipping a hair
 * under 0 at a syllable's last sample, raised to 0.7; reaching the soft low-pass every sound goes through, it broke that filter for
 * good and the game went silent on Eric's iPhone and computer). Every sound sound.ts makes this way (its MAKE table), at the rates
 * phones and computers run at.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeBossSound, type BossSound } from "../src/characters/boss-sounds.ts";

const src = readFileSync(new URL("../src/sound.ts", import.meta.url), "utf8");
const start = src.indexOf("const MAKE:");
const table = src.slice(start, src.indexOf("\n};", start));
const sounds = [...new Set([...table.matchAll(/\["(\w+)", "(\w+)"\]/g)].map((m) => `${m[1]}/${m[2]}`))];

describe("every synthesized sound is numbers only", () => {
  it("reads sound.ts's table", () => expect(sounds.length).toBeGreaterThan(200));
  for (const rate of [24000, 44100, 48000]) {
    it(`at ${rate} Hz`, () => {
      const bad: string[] = [];
      for (const s of sounds) {
        const [mod, name] = s.split("/");
        const d = makeBossSound([mod, name] as unknown as BossSound, rate);
        let n = 0;
        for (const v of d) if (!Number.isFinite(v)) n++;
        if (n) bad.push(`${s}: ${n}`);
      }
      expect(bad).toEqual([]);
    }, 120_000);
  }
});
