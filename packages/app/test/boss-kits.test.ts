import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, isPlayable, playableBosses } from "@chessroyale/core";
import { BOSS_KITS } from "../src/characters/kits.ts";
import type { Beat } from "../src/characters/boss-beats.ts";

/** Every moment a boss character plays (characters/boss-beats.ts). */
const BEATS: Beat[] = ["entrance", "idle", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory", "strike"];
/** The animation each power's moment plays (BossPowers.tsx). */
const POWER_ANIMS: Record<string, string> = { freeze: "freezeCast", blizzard: "blizzard", pie: "pieThrow", funhouse: "funhouse" };

describe("the playable rule: a complete character and its powers", () => {
  it("every boss that can be met has a complete character kit: every moment, its powers' moments, lines and a portrait", () => {
    const playable = playableBosses();
    expect(playable.length).toBeGreaterThan(0);
    for (const b of playable) {
      const kit = BOSS_KITS[b.kit!];
      expect(kit, `${b.name}'s kit`).toBeTruthy();
      for (const beat of BEATS) expect(kit!.ch.anims[kit!.anims[beat] ?? beat], `${b.name}: ${beat}`).toBeTruthy();
      for (const power of [b.powers!.passive, b.powers!.ultimate]) expect(kit!.ch.anims[POWER_ANIMS[power]!], `${b.name}: ${POWER_ANIMS[power]}`).toBeTruthy();
      expect(Object.keys(kit!.lines).length).toBeGreaterThan(0);
      expect(kit!.ch.anims[kit!.portrait.anim]).toBeTruthy();
    }
  });

  it("a boss with a kit but no powers, or powers but no kit, is never playable", () => {
    for (const b of BOSS_ROSTER) expect(isPlayable(b)).toBe(b.kit !== null && b.powers !== null);
    expect(playableBosses().every((b) => b.powers)).toBe(true);
  });
});
