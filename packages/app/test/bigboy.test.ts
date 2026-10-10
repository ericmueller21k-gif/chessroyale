import { describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { BIGBOY } from "../src/characters/bigboy.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { frameKeys } from "../src/characters/sprite.ts";

const RAINBOW = ["1", "2", "3", "4", "5", "6"];
const top = (keys: (string | null)[][]) => keys.findIndex((r) => r.some(Boolean));

describe("Big Boy (a sprite preview)", () => {
  it("is a kit for the test link only: no boss uses him yet", () => {
    expect(BOSS_KITS["BigBoy"]?.ch).toBe(BIGBOY);
    expect(BOSS_ROSTER.some((b) => b.kit === "BigBoy")).toBe(false);
  });

  it("never rises above his wave, so on a phone he stays under the boss bar's heading", () => {
    const highest = Math.min(...BIGBOY.anims.idle!.frames.map((f) => top(frameKeys(BIGBOY, f))));
    for (const [name, anim] of Object.entries(BIGBOY.anims))
      anim.frames.forEach((f, i) => expect(top(frameKeys(BIGBOY, f)), `${name} frame ${i + 1}`).toBeGreaterThanOrEqual(highest));
  });

  it("shows every colour of the lollipop's swirl at rest, enough of each to read at phone size", () => {
    const keys = frameKeys(BIGBOY, BIGBOY.anims.idle!.frames[0]!).flat();
    for (const k of RAINBOW) expect(keys.filter((c) => c === k).length, k).toBeGreaterThanOrEqual(20);
  });

  it("has a portrait inside his frame that shows his lips and the whole candy", () => {
    const kit = BOSS_KITS["BigBoy"]!;
    const p = kit.portrait;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + p.w).toBeLessThanOrEqual(BIGBOY.w);
    expect(p.y + p.h).toBeLessThanOrEqual(BIGBOY.h);
    const keys = frameKeys(BIGBOY, BIGBOY.anims[p.anim]!.frames[p.frame]!);
    const inside = keys.slice(p.y, p.y + p.h).flatMap((r) => r.slice(p.x, p.x + p.w));
    expect(inside).toContain("L");
    const all = (k: string) => keys.flat().filter((c) => c === k).length;
    for (const k of RAINBOW) expect(inside.filter((c) => c === k).length, k).toBe(all(k));
  });
});
