import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, isPlayable } from "@chessroyale/core";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { renderFrame } from "../src/characters/sprite.ts";

/**
 * The boss bar's figure, every frame: where each playable boss's drawing lies against its phone bar, in both layouts (the
 * compact bar, `out`, and `fit`, ?bar=fit: styles.css, docs/decisions/2026-10-24-boss-bar-same.md). Its drawn pixels, measured
 * from its feet (frame pixels, the kit's `foot`) at the size its `barScale` gives:
 * - `out`: at rest and in every moment, the figure never covers the "BOSS · move N" line above the bar (its top stays
 *   `HUD_TOP` px above the feet's line at most), and at rest it stays clear of the name column (and never drops below the bar).
 * - `fit`: at rest, the figure is wholly inside the bar (its top within the bar's height, its sides inside the bar's edges
 *   and the name column's clearance), and in every moment its top stays under the line above the bar.
 * The e2e spec (e2e/boss-bar-same.spec.ts) measures the real page; this checks every frame, which the page can't.
 */
const PLAYABLE = BOSS_ROSTER.filter(isPlayable);

/** Layout (px, as styles.css lays the phone bar out). The feet sit on the bar's content bottom, 6 px above its bottom edge. */
const BAR_H = { out: 64, fit: 99 } as const;
const FEET_PAD = 6;
/** The feet's middle: 4 px of bar padding, then half the 58 px figure box. */
const FEET_X = 4 + 29;
/** The name column starts 12 px past the figure box: a figure's right side may reach this far from its feet. */
const NAME_CLEAR = 74 - FEET_X;
/** The "BOSS · move N" line's text ends 16 px above the bar's top (measured at 390 px: boss-bar-same.spec.ts), so a figure may
 * rise 15 px above the bar's top line's feet mark: its top stays 1 px clear of the text. */
const HUD_TOP = 16 - 1;
/** A figure's whole drawing sits in the bar's top margin, the feet's line down to the bar's top. */
const feetToBarTop = (mode: keyof typeof BAR_H) => BAR_H[mode] - FEET_PAD;

type Extent = { left: number; right: number; up: number; down: number };
/** The drawn pixels of one frame, from its feet (the same pixels the canvas draws; styles.css's box is the bar's). */
function frameExtent(ch: { w: number; h: number; foot: readonly [number, number] }, frame: Parameters<typeof renderFrame>[1], bar: Parameters<typeof renderFrame>[0]): Extent | null {
  const { w, h, data } = renderFrame(bar, frame);
  const [fx, fy] = ch.foot;
  let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3]! > 0) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  return maxX < 0 ? null : { left: fx - minX, right: maxX + 1 - fx, up: fy - minY, down: maxY + 1 - fy };
}

/** The extent over every frame of the given animations (the worst of each side). */
function extentOf(ch: Parameters<typeof renderFrame>[0], anims: string[]): Extent {
  const worst: Extent = { left: 0, right: 0, up: 0, down: 0 };
  for (const name of anims) {
    const anim = ch.anims[name];
    if (!anim) throw new Error(`${ch.id}: no animation ${name}`);
    for (const frame of anim.frames) {
      const e = frameExtent(ch, frame, ch);
      if (!e) continue;
      worst.left = Math.max(worst.left, e.left);
      worst.right = Math.max(worst.right, e.right);
      worst.up = Math.max(worst.up, e.up);
      worst.down = Math.max(worst.down, e.down);
    }
  }
  return worst;
}

describe("the boss bar's figure fits its layout, every frame", () => {
  for (const def of PLAYABLE) {
    const kit = BOSS_KITS[def.kit!]!;
    const ch = kit.bar ?? kit.ch;
    const idle = [kit.loops?.idle ?? "idle", ...(kit.powered ? [kit.powered.idle] : [])];
    const every = Object.keys(ch.anims);
    const atIdle = extentOf(ch, idle);
    const atAll = extentOf(ch, every);
    const scale = kit.barScale ?? { out: 1, fit: 1 };

    it(`${def.name}: a figure's scale is a fraction of full size, and its scale is the one its numbers give`, () => {
      expect(scale.out).toBeGreaterThan(0);
      expect(scale.out).toBeLessThanOrEqual(1);
      expect(scale.fit).toBeGreaterThan(0);
      expect(scale.fit).toBeLessThanOrEqual(1);
    });

    it(`${def.name}, out: every frame's top stays under the line above the bar; at rest it clears the name column and the bar's bottom`, () => {
      const up = atAll.up * scale.out;
      expect(up, `${def.name}: top (${up.toFixed(1)} px above feet, all frames)`).toBeLessThanOrEqual(feetToBarTop("out") + HUD_TOP);
      expect(atIdle.right * scale.out, `${def.name}: at rest, clear of the name column`).toBeLessThanOrEqual(NAME_CLEAR + 1e-6);
      expect(atIdle.down * scale.out, `${def.name}: at rest, within the bar's bottom padding`).toBeLessThanOrEqual(FEET_PAD);
    });

    it(`${def.name}, fit: at rest the figure is wholly inside the bar; every frame's top stays under the line above the bar`, () => {
      expect(atIdle.up * scale.fit, `${def.name}: at rest, inside the bar's top`).toBeLessThanOrEqual(feetToBarTop("fit"));
      expect(atIdle.left * scale.fit, `${def.name}: at rest, inside the bar's left edge`).toBeLessThanOrEqual(FEET_X);
      expect(atIdle.right * scale.fit, `${def.name}: at rest, clear of the name column`).toBeLessThanOrEqual(NAME_CLEAR + 1e-6);
      expect(atIdle.down * scale.fit, `${def.name}: at rest, within the bar's bottom padding`).toBeLessThanOrEqual(FEET_PAD);
      expect(atAll.up * scale.fit, `${def.name}: top in every frame (${(atAll.up * scale.fit).toFixed(1)} px above feet)`).toBeLessThanOrEqual(feetToBarTop("fit") + HUD_TOP);
    });
  }
});
