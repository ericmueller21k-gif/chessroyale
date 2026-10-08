import { describe, expect, it } from "vitest";
import { CHARACTERS } from "../src/characters/index.ts";
import { frameKeys, renderFrame } from "../src/characters/sprite.ts";

describe("boss characters (code-drawn pixel art)", () => {
  for (const ch of CHARACTERS) {
    describe(ch.name, () => {
      it("draws every part only with colours in its palette", () => {
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
