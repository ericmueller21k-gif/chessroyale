import { describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { CHARACTERS } from "../src/characters/index.ts";
import { EFFECT_SPRITES } from "../src/characters/effects.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { RECLUSE, RECLUSE_BOOK, RECLUSE_BUST } from "../src/characters/recluse.ts";
import { frameKeys, renderFrame, type Character } from "../src/characters/sprite.ts";

// The Hidden Boss (code id `recluse`), art only: the checks characters.test.ts makes of every character in the game,
// made here because he isn't in it, and that he shows nowhere in the game.
const top = (keys: (string | null)[][]) => keys.findIndex((r) => r.some(Boolean));
const ALL: readonly Character[] = [RECLUSE, RECLUSE_BUST, RECLUSE_BOOK];

describe("the Hidden Boss (art only)", () => {
  it("is in no roster, kit, character or effect list, so the game never shows him or his book", () => {
    expect(RECLUSE.name).toBe("Hidden Boss");
    for (const ch of ALL) {
      expect(CHARACTERS).not.toContain(ch);
      expect(Object.values(BOSS_KITS).some((k) => k.ch === ch)).toBe(false);
      expect(Object.values(EFFECT_SPRITES)).not.toContain(ch);
    }
    expect(BOSS_ROSTER.some((b) => b.id === "recluse" || b.name === "Hidden Boss")).toBe(false);
  });

  it("draws every part only with colours in its palette", () => {
    for (const ch of ALL)
      for (const [name, part] of Object.entries(ch.parts))
        for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(ch.palette, `${ch.id} ${name}: "${k}"`).toHaveProperty(k);
  });

  it("idles silently in loops; his one-shots fire their cues", () => {
    for (const ch of [RECLUSE, RECLUSE_BUST]) {
      for (const name of ["idle", "idle2", "spellLoop", "spellLoop2", "collapseLoop"]) {
        expect(ch.anims[name]!.loop, name).toBe(true);
        if (name.startsWith("idle")) expect(ch.anims[name]!.frames.some((f) => f.cue), name).toBe(false);
      }
      const cues = (name: string) => ch.anims[name]!.frames.map((f) => f.cue).filter(Boolean);
      expect(cues("consult")).toEqual(["lift", "open", "snap"]);
      expect(cues("stare")).toEqual(["dip", "stare"]);
      expect(cues("laugh")).toEqual(["laugh", "cackle"]);
      expect(cues("spellbook")).toEqual(["raise", "open", "laugh", "cackle"]);
      expect(cues("spellClose")).toEqual(["slam"]);
      expect(cues("slam")).toEqual(["open", "slam"]);
      expect(cues("collapse")).toEqual(["reel", "drop", "thud", "book"]);
      expect(cues("revive")).toEqual(["rise", "snap", "catch"]);
      // Every phase-1 animation he has once revived has a phase-2 version with the same cues.
      for (const name of ["consult", "stare", "laugh", "spellbook", "spellClose", "slam"]) expect(cues(`${name}2`), name).toEqual(cues(name));
    }
    expect(RECLUSE_BOOK.anims.slam!.frames.map((f) => f.cue).filter(Boolean)).toEqual(["slam"]);
    expect(RECLUSE_BOOK.anims.close!.frames.map((f) => f.cue).filter(Boolean)).toEqual(["snap"]);
  });

  it("once revived, his hair never falls calm: every phase-2 frame (and the revival's end) has it in the wind", () => {
    const windy = (f: { layers: readonly { part: string }[] }) => f.layers.some((l) => /^head:.*:[123](:dark)?$/.test(l.part));
    for (const [name, anim] of Object.entries(RECLUSE.anims))
      if (name.endsWith("2")) anim.frames.forEach((f, i) => expect(windy(f), `${name} frame ${i + 1}`).toBe(true));
    const revive = RECLUSE.anims.revive!.frames;
    expect(windy(revive.at(-1)!)).toBe(true);
    // ...and phase 1 at rest is calm.
    expect(RECLUSE.anims.idle!.frames.some(windy)).toBe(false);
  });

  it("renders every frame without anything cut off at the frame's edges (the bust is cut at its foot on purpose)", () => {
    for (const ch of ALL)
      for (const [name, anim] of Object.entries(ch.anims))
        anim.frames.forEach((f, i) => {
          expect(renderFrame(ch, f).data.length).toBe(ch.w * ch.h * 4);
          const keys = frameKeys(ch, f);
          const edge = [...keys[0]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1]), ...(ch === RECLUSE_BUST ? [] : keys[ch.h - 1]!)];
          expect(edge.filter(Boolean), `${ch.id} ${name} frame ${i + 1}`).toEqual([]);
        });
  });

  it("stands his feet on the ground point; the bust fits the phone's boss bar as the cast does", () => {
    const keys = frameKeys(RECLUSE, RECLUSE.anims.idle!.frames[0]!);
    const [fx, fy] = RECLUSE.foot;
    expect(keys[fy - 1]!.slice(fx - 12, fx + 12).some(Boolean)).toBe(true);
    // The bust at rest: no taller above its foot than the cast stands (Hollow, the tallest of the usual box, 75 px).
    const bust = RECLUSE_BUST.anims.idle!.frames.map((f) => RECLUSE_BUST.foot[1] - top(frameKeys(RECLUSE_BUST, f)));
    expect(Math.max(...bust)).toBeLessThanOrEqual(75);
  });

  it("puts the book effect on one board square", () => {
    expect([RECLUSE_BOOK.w, RECLUSE_BOOK.h]).toEqual([32, 32]);
  });
});
