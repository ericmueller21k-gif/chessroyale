// The bosses' art is made the first time it's read, not when the app loads (Nov 10: every boss's poses cost about 1.4 s of
// a fast core on every page load; docs/decisions/2026-11-10-lazy-boss-art.md). Importing every character module and the
// screens that read their timings makes no animation; reading one makes that one (a grouped boss: those before it, in order).
import { describe, expect, it } from "vitest";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { CHARACTERS, EFFECT_SPRITES } from "../src/characters/index.ts";
import { animsMade } from "../src/characters/sprite.ts";
import "../src/components/BossCharacter.tsx";
import "../src/components/BossPowers.tsx";
import "../src/screens/Boss.tsx";
import "../src/screens/Recluse2.tsx";

describe("boss art made on first use", () => {
  it("the load makes no animation", () => {
    expect(Object.keys(BOSS_KITS).length + CHARACTERS.length + Object.keys(EFFECT_SPRITES).length).toBeGreaterThan(30);
    expect(animsMade()).toBe(0);
  });
  it("reading one boss's idle makes his idle, not every boss", () => {
    void BOSS_KITS["Boingo the Clown"]!.ch.anims.idle!.frames;
    expect(animsMade()).toBeGreaterThan(0);
    expect(animsMade()).toBeLessThan(5);
  });
});
