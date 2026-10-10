import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, isPlayable, playableBosses } from "@chessroyale/core";
import { BOSS_KITS } from "../src/characters/kits.ts";
import type { Beat } from "../src/characters/boss-beats.ts";

/** Every moment a boss character plays (characters/boss-beats.ts). */
const BEATS: Beat[] = ["entrance", "idle", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory", "strike"];
/** The animation each power's moment plays (BossPowers.tsx). */
const POWER_ANIMS: Record<string, string> = { freeze: "freezeCast", blizzard: "blizzard", pie: "pieThrow", funhouse: "funhouse", sparkler: "ignite", candle: "romanCandle", dark: "darkCast", lightsout: "lightsOut", blocks: "toss", bounce: "bigBounce" };

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

describe("bosses' sounds play on their own moments, never as your move (Eric, Oct 10: a new sound as he moved a piece against Hollow)", () => {
  const PIECE_SOUNDS = ["move", "capture", "castle"];
  it("no boss's cue plays a piece's sound (the board knocks for every move itself)", () => {
    for (const [name, kit] of Object.entries(BOSS_KITS)) for (const [cue, sound] of Object.entries(kit.sounds)) expect(PIECE_SOUNDS, `${name}: ${cue} → ${sound}`).not.toContain(sound);
  });

  it("what a boss shows as your plain move lands (him thinking) has no sound in it: only the board's knock is heard", () => {
    for (const b of playableBosses()) {
      const kit = BOSS_KITS[b.kit!]!;
      const anim = kit.ch.anims[kit.anims.thinking ?? "thinking"]!;
      const cues = anim.frames.map((f) => f.cue).filter((c): c is string => !!c && !!kit.sounds[c]);
      expect(cues, `${b.name}: thinking`).toEqual([]);
    }
  });

  it("every cue in a boss's animations is wired to one of its own sounds (Hollow's to his)", () => {
    for (const b of playableBosses()) {
      const kit = BOSS_KITS[b.kit!]!;
      for (const [anim, a] of Object.entries(kit.ch.anims))
        for (const f of a.frames) if (f.cue && kit.sounds[f.cue]) expect(PIECE_SOUNDS, `${b.name}: ${anim} ${f.cue}`).not.toContain(kit.sounds[f.cue]);
    }
    for (const sound of Object.values(BOSS_KITS.Hollow!.sounds)) expect(sound).toMatch(/^hollow/);
  });
});
