import { describe, expect, it } from "vitest";
import { LOOKS, mixTint, skyOverride, skyWeights } from "../src/town/sky.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";

/** The town square's sky by the time of day (src/town/sky.ts): which look shows when, and how they blend. */
const at = (h: number, m = 0) => skyWeights(h * 60 + m);
const sum = (w: Record<string, number>) => LOOKS.reduce((s, l) => s + w[l]!, 0);

describe("town square sky", () => {
  it("dawn at sunrise, day at noon, dusk in the evening, night at midnight", () => {
    expect(at(6, 30)).toEqual({ dawn: 1, day: 0, dusk: 0, night: 0 });
    expect(at(12)).toEqual({ dawn: 0, day: 1, dusk: 0, night: 0 });
    expect(at(18, 30)).toEqual({ dawn: 0, day: 0, dusk: 1, night: 0 });
    expect(at(0)).toEqual({ dawn: 0, day: 0, dusk: 0, night: 1 });
    expect(at(23, 59)).toEqual({ dawn: 0, day: 0, dusk: 0, night: 1 });
  });

  it("the looks always add up to 1, and every change blends over its half hour, never at once", () => {
    for (let m = 0; m < 1440; m += 1) {
      const w = skyWeights(m);
      expect(sum(w)).toBeCloseTo(1, 9);
      for (const l of LOOKS) expect(w[l]).toBeGreaterThanOrEqual(-1e-9);
      // A minute later, no look has moved by more than a minute's share of the blend.
      const next = skyWeights(m + 1);
      for (const l of LOOKS) expect(Math.abs(next[l] - w[l])).toBeLessThanOrEqual(1 / TOWN_FEEL.skyBlendMinutes + 1e-9);
    }
    // Halfway through each blend, half of each look, in order: night to dawn, dawn to day, day to dusk, dusk to night.
    const { dawn, day, dusk, night } = TOWN_FEEL.skyHours;
    for (const [m, a, b] of [
      [dawn, "night", "dawn"],
      [day, "dawn", "day"],
      [dusk, "day", "dusk"],
      [night, "dusk", "night"],
    ] as const) {
      expect(skyWeights(m)[a]).toBeCloseTo(0.5);
      expect(skyWeights(m)[b]).toBeCloseTo(0.5);
    }
  });

  it("?sky= picks one look, anything else leaves the clock in charge", () => {
    expect(skyOverride("dawn")).toEqual({ dawn: 1, day: 0, dusk: 0, night: 0 });
    expect(skyOverride("day")).toEqual({ dawn: 0, day: 1, dusk: 0, night: 0 });
    expect(skyOverride("dusk")).toEqual({ dawn: 0, day: 0, dusk: 1, night: 0 });
    expect(skyOverride("night")).toEqual({ dawn: 0, day: 0, dusk: 0, night: 1 });
    expect(skyOverride(null)).toBeNull();
    expect(skyOverride("noon")).toBeNull();
  });

  it("the world's tint: none by day, soft at dawn, warm at dusk, cool and darker at night, light enough to read through", () => {
    expect(mixTint({ dawn: 0, day: 1, dusk: 0, night: 0 })[3]).toBe(0);
    const dusk = mixTint({ dawn: 0, day: 0, dusk: 1, night: 0 });
    expect(dusk[0]).toBeGreaterThan(dusk[2]);
    const dawnTint = mixTint({ dawn: 1, day: 0, dusk: 0, night: 0 });
    expect(dawnTint[3]).toBeLessThan(dusk[3]); // dawn is softer than dusk
    const night = mixTint({ dawn: 0, day: 0, dusk: 0, night: 1 });
    expect(night[2]).toBeGreaterThan(night[0]);
    expect(night[3]).toBeGreaterThan(dusk[3]);
    expect(night[3]).toBeLessThanOrEqual(0.4);
  });
});
