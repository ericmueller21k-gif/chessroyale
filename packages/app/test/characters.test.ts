import { describe, expect, it } from "vitest";
import { CHARACTERS } from "../src/characters/index.ts";
import { frameKeys, renderFrame } from "../src/characters/sprite.ts";

describe("boss characters (code-drawn pixel art)", () => {
  for (const ch of CHARACTERS) {
    describe(ch.name, () => {
      it("draws every part only with colors in its palette", () => {
        for (const [name, part] of Object.entries(ch.parts))
          for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(ch.palette, `${name}: "${k}"`).toHaveProperty(k);
      });

      it("has a looping idle and one-shot moves that fire cues", () => {
        expect(ch.anims.idle?.loop).toBe(true);
        const shots = Object.values(ch.anims).filter((a) => !a.loop);
        expect(shots.length).toBeGreaterThan(0);
        for (const a of shots) expect(a.frames.some((f) => f.cue)).toBe(true);
      });

      it("renders every frame, in every look, without anything cut off at the frame's edge", () => {
        for (const [name, anim] of Object.entries(ch.anims))
          anim.frames.forEach((f, i) => {
            for (const look of [undefined, ...Object.keys(ch.looks ?? {})]) expect(renderFrame(ch, f, { look }).data.length).toBe(ch.w * ch.h * 4);
            const keys = frameKeys(ch, f);
            const edge = [...keys[0]!, ...keys[ch.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1])];
            expect(edge.filter(Boolean), `${name} frame ${i + 1}`).toEqual([]);
          });
      });

      it("stands its feet on the ground point", () => {
        const keys = frameKeys(ch, ch.anims.idle!.frames[0]!);
        const [fx, fy] = ch.foot;
        expect(keys[fy - 1]!.slice(fx - 6, fx + 6).some(Boolean)).toBe(true);
      });
    });
  }
});

// The Hidden Boss's younger ages (Nov 12): drawn for the preview; since Nov 13 also his child form's growing figure (RECLUSE_GROWING),
// in its own kit (RECLUSE_CHILD_KIT, kits.ts bossKitOf), never in a character list or BOSS_KITS.
describe("the Hidden Boss's ages (mockup)", async () => {
  const { RECLUSE_AGES_PREVIEW } = await import("../src/characters/recluse-ages.ts");
  const { BOSS_KITS } = await import("../src/characters/kits.ts");

  it("is in no character list or kit", () => {
    const ids = new Set(RECLUSE_AGES_PREVIEW.map((c) => c.id));
    expect(CHARACTERS.filter((c) => ids.has(c.id))).toEqual([]);
    for (const kit of Object.values(BOSS_KITS)) for (const c of [kit.ch, kit.bar]) expect(c && ids.has(c.id)).toBeFalsy();
  });

  for (const ch of RECLUSE_AGES_PREVIEW) {
    const bust = ch.id.endsWith("-bust");
    it(`${ch.id}: draws every frame in its palette, a looping idle, cues on its one-shots, nothing cut off`, () => {
      expect(ch.anims.idle?.loop).toBe(true);
      for (const [name, anim] of Object.entries(ch.anims)) {
        if (!anim.loop) expect(anim.frames.some((f) => f.cue), name).toBe(true);
        anim.frames.forEach((f, i) => {
          expect(renderFrame(ch, f).data.length).toBe(ch.w * ch.h * 4);
          const keys = frameKeys(ch, f);
          // (A bust is cut at its foot on purpose, as today's is.)
          const edge = [...keys[0]!, ...(bust ? [] : keys[ch.h - 1]!), ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1])];
          expect(edge.filter(Boolean), `${name} frame ${i + 1}`).toEqual([]);
        });
      }
      if (!bust) {
        const keys = frameKeys(ch, ch.anims.idle!.frames[0]!);
        const [fx, fy] = ch.foot;
        expect(keys[fy - 1]!.slice(fx - 6, fx + 6).some(Boolean)).toBe(true);
      }
    });
  }
});
