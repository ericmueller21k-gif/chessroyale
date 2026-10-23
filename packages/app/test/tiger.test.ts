import { describe, expect, it } from "vitest";
import { TIGER, TIGER_PORTRAIT } from "../src/characters/tiger.ts";
import { frameKeys, renderFrame } from "../src/characters/sprite.ts";

/** The select stage draws every boss at one pixel size, up to this many sprite px from the top of its drawing to its feet (BossSelect's TALLEST / PX). */
const STAGE_TALLEST = 70;

describe("the tiger's still (not wired into the game yet)", () => {
  const still = TIGER.anims.idle!.frames[0]!;
  const keys = frameKeys(TIGER, still);

  it("has one idle pose, in a palette that holds every color it uses", () => {
    expect(Object.keys(TIGER.anims)).toEqual(["idle"]);
    expect(TIGER.anims.idle!.frames.length).toBe(1);
    for (const [name, part] of Object.entries(TIGER.parts))
      for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(TIGER.palette, `${name}: "${k}"`).toHaveProperty(k);
    expect(renderFrame(TIGER, still).data.length).toBe(TIGER.w * TIGER.h * 4);
  });

  it("fits the select stage's 70 px with the balloons, and nothing is cut off at the frame's edge", () => {
    const top = keys.findIndex((r) => r.some(Boolean));
    expect(TIGER.foot[1] - top).toBeLessThanOrEqual(STAGE_TALLEST);
    const edge = [...keys[0]!, ...keys[TIGER.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[TIGER.w - 1])];
    expect(edge.filter(Boolean)).toEqual([]);
  });

  it("stands on its ground point, between his feet", () => {
    const [fx, fy] = TIGER.foot;
    expect(keys[fy - 1]!.slice(fx - 4, fx + 4).some(Boolean)).toBe(true);
  });

  it("has a portrait (his hat and head) inside the frame", () => {
    const p = TIGER_PORTRAIT;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + p.w).toBeLessThanOrEqual(TIGER.w);
    expect(p.y + p.h).toBeLessThanOrEqual(TIGER.h);
  });
});
