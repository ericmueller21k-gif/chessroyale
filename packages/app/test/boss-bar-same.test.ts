import { describe, expect, it } from "vitest";
import { BAR_TOP_GAP } from "../src/characters/kits.ts";
import { barFit, barRows, momentOk, restOk, BAR_PAD_BOTTOM, REST_LEFT, REST_RIGHT, REST_UP } from "./bar-fit.ts";

/**
 * The phone boss bar's figure, every frame (Eric, Oct 24; Nov 4: every boss whole inside the bar; Nov 12: "every boss as tall as their
 * container… make it the height, minus a few pixels… if it reaches over to the left… just shift everything over to the right").
 * docs/decisions/2026-11-12-boss-card-height.md. The room is in packages/app/test/bar-fit.ts.
 * - its size: as tall as the bar less BAR_TOP_GAP, every frame it rests in (its loops but the victory, the last frame of a one-shot)
 *   no higher, in its own proportions (kits.ts barScale, `barFit`);
 * - every rest frame whole inside the bar: 2 px in from its left edge (barShift, the least that does it), under its top, in its bottom
 *   padding, and 2 px clear of the name column (moved right by barName, the least that does it);
 * - a moment (every frame of every animation, the victory too) may rise over the bar, never off the screen.
 * The e2e specs (e2e/boss-bar-same.spec.ts, e2e/boss-bar.spec.ts) measure the real page; this checks every frame, which the page can't.
 */
describe("the phone boss bar's figure: as tall as the bar, whole inside it at rest, every frame", () => {
  for (const { name, kit, rest, all, idle } of barRows()) {
    const scale = kit.barScale ?? 1;
    const shift = kit.barShift ?? 0;
    const nameOff = kit.barName ?? 0;

    it(`${name}: its bar numbers are its art's (scale ${scale}, shift ${shift}, name +${nameOff}; npx tsx scripts/bar-fit.ts)`, () => {
      expect({ barScale: scale, barShift: shift, barName: nameOff }).toEqual(barFit(rest));
    });

    it(`${name}: as tall as the bar less ${BAR_TOP_GAP} px at rest, within a hundredth`, () => {
      expect(rest.up * scale).toBeLessThanOrEqual(REST_UP - BAR_TOP_GAP);
      const more = scale + 0.01;
      expect(rest.up * more > REST_UP - BAR_TOP_GAP || rest.down * more > BAR_PAD_BOTTOM, `${name}: a hundredth more wouldn't fit`).toBe(true);
      // (Its idle at least half the bar: a figure that rests much taller than its idle is the one place it reads smaller.)
      expect((idle.up + idle.down) * scale, `${name}: its idle's height`).toBeGreaterThan(REST_UP / 2);
    });

    it(`${name}: every rest frame whole inside the bar, with its shift ${shift} px and name column +${nameOff} px`, () => {
      expect(rest.left * scale - shift, `${name}: the left edge 2 px in from the bar's left edge`).toBeLessThanOrEqual(REST_LEFT);
      expect(rest.right * scale + shift, `${name}: the right edge 2 px short of the name column`).toBeLessThanOrEqual(REST_RIGHT + nameOff);
      expect(rest.down * scale, `${name}: the bottom within the bar's padding`).toBeLessThanOrEqual(BAR_PAD_BOTTOM);
      expect(restOk(rest, scale, shift, nameOff), `${name}: restOk`).toBe(true);
    });

    it(`${name}: a moment (the victory too) on the screen, with its shift of ${shift} px`, () => {
      expect(momentOk(all, scale, shift), `${name}: a moment on the screen`).toBe(true);
    });
  }
});
