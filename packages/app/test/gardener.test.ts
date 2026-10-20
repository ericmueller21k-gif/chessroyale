import { describe, expect, it } from "vitest";
import { GARDENER, GARDENER_PORTRAIT, gardenerLayers, type GardenerPose } from "../src/characters/gardener.ts";
import { frameKeys, renderFrame } from "../src/characters/sprite.ts";

/** The select stage draws every boss at one pixel size, up to this many sprite px from the top of its drawing to its feet (BossSelect's TALLEST / PX). */
const STAGE_TALLEST = 70;

describe("the hippo gardener's still", () => {
  const still = GARDENER.anims.idle!.frames[0]!;
  const keys = frameKeys(GARDENER, still);

  it("is one looping idle frame, in a palette that holds every color it uses", () => {
    expect(Object.keys(GARDENER.anims)).toEqual(["idle"]);
    expect(GARDENER.anims.idle!.loop).toBe(true);
    for (const [name, part] of Object.entries(GARDENER.parts))
      for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(GARDENER.palette, `${name}: "${k}"`).toHaveProperty(k);
    expect(renderFrame(GARDENER, still).data.length).toBe(GARDENER.w * GARDENER.h * 4);
  });

  it("fits the select stage's 70 px, with nothing cut off at the frame's edge, and stands on its ground point", () => {
    const top = keys.findIndex((r) => r.some(Boolean));
    expect(GARDENER.foot[1] - top).toBeLessThanOrEqual(STAGE_TALLEST);
    const edge = [...keys[0]!, ...keys[GARDENER.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[GARDENER.w - 1])];
    expect(edge.filter(Boolean)).toEqual([]);
    const [fx, fy] = GARDENER.foot;
    expect(keys[fy - 1]!.slice(fx - 6, fx + 6).some(Boolean)).toBe(true);
  });

  it("has a portrait inside the frame", () => {
    const p = GARDENER_PORTRAIT;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + p.w).toBeLessThanOrEqual(GARDENER.w);
    expect(p.y + p.h).toBeLessThanOrEqual(GARDENER.h);
  });

  it("moves by numbers: the jaw, the water, the arms and the bag redraw without error and stay in the frame", () => {
    const poses: GardenerPose[] = [
      { jaw: 30, eyes: "wide", spray: 0 },
      { nozzle: 40, fist: [17, 29], spray: 22, droop: 12, seed: 7 },
      { hand: [36, 47], bag: 3, bob: 1, earN: -2, earF: 2, stepN: 3, tail: 2 },
    ];
    for (const pose of poses) {
      const k = frameKeys(GARDENER, { layers: gardenerLayers(pose), ms: 100 });
      const edge = [...k[0]!, ...k[GARDENER.h - 1]!, ...k.map((r) => r[0]), ...k.map((r) => r[GARDENER.w - 1])];
      expect(edge.filter(Boolean)).toEqual([]);
    }
  });
});
