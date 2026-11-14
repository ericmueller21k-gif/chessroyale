import { describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { CHARACTERS } from "../src/characters/index.ts";
import { EFFECT_SPRITES } from "../src/characters/effects.ts";
import { BOSS_KITS, bossKit, kitName } from "../src/characters/kits.ts";
import { RECLUSE, RECLUSE_BOOK, RECLUSE_BUST, suitFrame, suited } from "../src/characters/recluse.ts";
import { frameKeys, renderFrame, type Character } from "../src/characters/sprite.ts";

// The Hidden Boss (code id `recluse`): his art. Since phase 1 (Oct 14) he's registered (his kit, his full figure among the
// characters), hidden from players (boss-menu tests: recluse-boss.test.ts). His bust is cut at its foot on purpose and his
// book is phase 2's, so neither is in a character or effect list; the checks characters.test.ts makes of every character
// are made here for all three.
const top = (keys: (string | null)[][]) => keys.findIndex((r) => r.some(Boolean));
const ALL: readonly Character[] = [RECLUSE, RECLUSE_BUST, RECLUSE_BOOK];

describe("his name is one edit (Eric, Oct 14: he'll be renamed)", () => {
  it("renamed in the roster, he keeps his kit: screens find it by the name they show", () => {
    const renamed = BOSS_ROSTER.map((b) => (b.id === "recluse" ? { ...b, name: "A Powerful Foe" } : b));
    expect(kitName("A Powerful Foe", renamed)).toBe("Hidden Boss");
    expect(BOSS_KITS[kitName("A Powerful Foe", renamed)]).toMatchObject({ ch: RECLUSE });
    // Today's names are kits' own names; an unknown name stays as it is (no kit).
    expect(kitName("Hidden Boss")).toBe("Hidden Boss");
    expect(kitName("Jefferson")).toBe("Jefferson");
    expect(bossKit("Nobody")).toBeNull();
  });
});

describe("the Hidden Boss's art", () => {
  it("is his kit's drawing (the bust in a phone's bar), one roster entry hidden from players; his book isn't on the board yet", () => {
    expect(RECLUSE.name).toBe("Hidden Boss");
    expect(CHARACTERS).toContain(RECLUSE);
    expect(CHARACTERS).not.toContain(RECLUSE_BUST);
    expect(BOSS_KITS["Hidden Boss"]).toMatchObject({ ch: RECLUSE, bar: RECLUSE_BUST });
    expect(Object.values(EFFECT_SPRITES)).not.toContain(RECLUSE_BOOK);
    expect(BOSS_ROSTER.filter((b) => b.id === "recluse" || b.name === "Hidden Boss")).toEqual([expect.objectContaining({ id: "recluse", name: "Hidden Boss", kit: "Hidden Boss", adminOnly: true })]);
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
      // The phase change where he stands (both drawings): he seizes the God King's power (his head snaps up, his hand
      // raised, held up while it streams in, his fist as it lands), then up in a rage.
      expect(cues("seize")).toEqual(["rise", "reach"]);
      expect(ch.anims.seizeLoop!.loop).toBe(true);
      expect(cues("seizeLoop")).toEqual([]);
      expect(cues("seized")).toEqual(["grab"]);
      expect(cues("rage")).toEqual(["snatch", "catch"]);
    }
    // ...and on the board, his whole figure only: the leap in, the book thrown down, the chant (its loop silent), the
    // book back in his hands, the leap back.
    const cues = (name: string) => RECLUSE.anims[name]!.frames.map((f) => f.cue).filter(Boolean);
    expect(cues("leap")).toEqual(["jump", "land"]);
    expect(cues("drop")).toEqual(["raise", "throw", "thud"]);
    expect(cues("chantRaise")).toEqual(["light"]);
    expect(RECLUSE.anims.chant!.loop).toBe(true);
    expect(cues("chant")).toEqual([]);
    expect(cues("pickup")).toEqual(["snap", "catch"]);
    expect(cues("leap2")).toEqual(["jump"]);
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

  it("holds no chess piece anywhere (Eric, Oct 14), and his free arm hangs with an open hand at rest", () => {
    for (const ch of [RECLUSE, RECLUSE_BUST])
      for (const [name, anim] of Object.entries(ch.anims))
        anim.frames.forEach((f, i) => expect(f.layers.some((l) => l.part.startsWith("piece")), `${ch.id} ${name} frame ${i + 1}`).toBe(false));
    expect(Object.keys(RECLUSE.parts).some((n) => n.startsWith("piece"))).toBe(false);
    for (const f of RECLUSE.anims.idle!.frames) expect(f.layers.some((l) => l.part.startsWith("hand:"))).toBe(true);
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

  it("wears his suit on every frame of either drawing (Eric, Nov 14): each part's suit version is its size, so it sits where the part did; the tie off, the helmet over his head; the visor's three ways", () => {
    const size = (name: string) => {
      const g = RECLUSE.parts[name]!.grid;
      return [Math.max(...g.map((r) => r.length)), g.length];
    };
    for (const ch of [RECLUSE, RECLUSE_BUST])
      for (const [name, anim] of Object.entries(ch.anims))
        anim.frames.forEach((f, i) => {
          const s = suited(f);
          expect(suited(f), "made once").toBe(s);
          const kept = f.layers.filter((l) => !l.part.startsWith("tie:"));
          expect(s.layers.map((l) => [l.x, l.y]), `${ch.id} ${name} ${i + 1}`).toEqual(kept.map((l) => [l.x, l.y]));
          s.layers.forEach((l, j) => expect(size(l.part), `${ch.id} ${name} ${i + 1}: ${l.part}`).toEqual(size(kept[j]!.part)));
          expect(s.layers.some((l) => l.part.startsWith("head:")), `${ch.id} ${name} ${i + 1}`).toBe(false);
        });
    for (const v of ["down", "mid", "up"] as const) {
      const f = suitFrame(RECLUSE.anims.idle2!.frames[0]!, v);
      expect(f.layers.find((l) => l.part.startsWith("helmet:"))!.part).toMatch(new RegExp(`^helmet:${v}:`));
    }
  });

  it("puts the book effect on one board square", () => {
    expect([RECLUSE_BOOK.w, RECLUSE_BOOK.h]).toEqual([32, 32]);
  });
});
