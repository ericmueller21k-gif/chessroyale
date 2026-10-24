import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, isPlayable } from "@chessroyale/core";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { renderFrame } from "../src/characters/sprite.ts";

/**
 * The phone boss bar's figure, every frame (Eric, Oct 24; docs/decisions/2026-10-24-boss-bar-same.md). Each playable boss is drawn at
 * least at full size (`barScale` >= 1). The four big animals (Alfil, Puddles, Moo & Moon, Babur) are at 4/3, or at the largest step of
 * 1/12 that fits the room. `barShift` moves a drawing sideways inside the figure box, in whole px.
 *
 * The room, in px on the 390 px screen (the bar's left edge at 14 px; the figure box 58 px wide from 5 px in, so the feet at 48 px from
 * the screen's left edge; the name column at 89 px; the "BOSS · move N" text ends at 32 px; the bar's top at 48 px; the feet at 141 px):
 * - at rest, on every idle frame: the drawing is 2 px inside the screen's left edge, 2 px clear of the name column, 1 px under the
 *   "BOSS · move N" text, and drops no more than the bar's bottom padding (6 px) below the feet. It may hang out of the bar's top and
 *   its left edge (the figure is the boss, and it's drawn at its own size).
 * - a one-shot moment (every frame of every animation) may rise anywhere above the bar, but never off the screen.
 * The e2e spec (e2e/boss-bar-same.spec.ts) measures the real page; this checks every frame, which the page can't.
 */
const PLAYABLE = BOSS_ROSTER.filter(isPlayable);

/** The room, in px, from the feet (FEET_X, FEET_Y) on the screen. */
const FEET_X = 48;
const FEET_Y = 141;
const SCREEN_W = 320;
const NAME_X = 89;
const HUD_BOTTOM = 32;
const BAR_PAD_BOTTOM = 6;
/** The bounds on a drawn side: at rest (the idle frames), and for a moment (any frame). */
const REST_LEFT = FEET_X - 2;             // the drawn left edge >= 2 px from the screen's left edge: L * s - shift <= 46
const REST_RIGHT = NAME_X - 2 - FEET_X;   // the drawn right edge 2 px short of the name column:    R * s + shift <= 39
const REST_UP = FEET_Y - (HUD_BOTTOM + 1); // the drawn top 1 px under the text:                       U * s <= 108
const MOMENT_LEFT = FEET_X;               // a moment's drawn left edge on the screen (x >= 0):        L * s - shift <= 48
const MOMENT_RIGHT = SCREEN_W - FEET_X;   // (the narrowest phone, 320 px):                            R * s + shift <= 272
const MOMENT_UP = FEET_Y;                 // (the screen's top, y >= 0):                               U * s <= 141

/** The big animals: at 4/3 or the largest 1/12 step that fits. */
const BIG = new Set(["Alfil", "Gardener", "Moo", "Tiger"]);
/** The order check: each big animal's idle figure is at least as tall as the tallest of these (at full size). */
const ORDER_REF = ["Ginger", "Sawyer", "Smudgy", "Chub & Chirp"];
const STEP = 1 / 12;

type Extent = { left: number; right: number; up: number; down: number };
type Ch = Parameters<typeof renderFrame>[0];
type Frame = Parameters<typeof renderFrame>[1];

/** A frame's drawn pixels, from its feet (the kit's `foot`; the same pixels the canvas draws). */
function frameExtent(ch: Ch, frame: Frame): Extent | null {
  const { w, h, data } = renderFrame(ch, frame);
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

/** Each side's farthest reach over every frame of the given animations. */
function extentOf(ch: Ch, anims: string[]): Extent {
  const worst: Extent = { left: 0, right: 0, up: 0, down: 0 };
  for (const name of anims) {
    const anim = ch.anims[name];
    if (!anim) throw new Error(`${ch.id}: no animation ${name}`);
    for (const frame of anim.frames) {
      const e = frameExtent(ch, frame);
      if (!e) continue;
      worst.left = Math.max(worst.left, e.left);
      worst.right = Math.max(worst.right, e.right);
      worst.up = Math.max(worst.up, e.up);
      worst.down = Math.max(worst.down, e.down);
    }
  }
  return worst;
}

/** The room at rest, for an idle figure at a scale and a whole-px shift (every idle frame's farthest reach). */
function restOk(idle: Extent, s: number, shift: number): boolean {
  return idle.left * s - shift <= REST_LEFT && idle.right * s + shift <= REST_RIGHT && idle.up * s <= REST_UP && idle.down * s <= BAR_PAD_BOTTOM;
}

/** A one-shot moment stays on the screen (not above it, not off either side). */
function momentOk(all: Extent, s: number, shift: number): boolean {
  return all.left * s - shift <= MOMENT_LEFT && all.right * s + shift <= MOMENT_RIGHT && all.up * s <= MOMENT_UP;
}

/** The whole-px shifts that fit a scale: at rest, and for every moment. */
function shiftsThatFit(idle: Extent, all: Extent, s: number): number[] {
  const out: number[] = [];
  for (let sh = -60; sh <= 60; sh++) if (restOk(idle, s, sh) && momentOk(all, s, sh)) out.push(sh);
  return out;
}

describe("the phone boss bar's figure fits the room, every frame", () => {
  const rows = PLAYABLE.map((def) => {
    const kit = BOSS_KITS[def.kit!]!;
    const ch = kit.bar ?? kit.ch;
    const idle = [kit.loops?.idle ?? "idle", ...(kit.powered ? [kit.powered.idle] : [])];
    return { name: def.kit!, kit, idle: extentOf(ch, idle), all: extentOf(ch, Object.keys(ch.anims)) };
  });
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));

  for (const { name, kit, idle, all } of rows) {
    const scale = kit.barScale ?? 1;
    const shift = kit.barShift ?? 0;

    it(`${name}: drawn at full size or more (scale ${scale.toFixed(4)}), never less`, () => {
      expect(scale).toBeGreaterThanOrEqual(1);
    });

    it(`${name}: ${BIG.has(name) ? "a big animal at 4/3, or the largest step of 1/12 that fits the room" : "at full size, with a shift that fits the room"}`, () => {
      if (BIG.has(name)) {
        // The largest 1/12 step (4/3 at most) with a whole-px shift that fits at rest and for every moment.
        let best = 1;
        for (let k = 16; k >= 12; k--) {
          if (shiftsThatFit(idle, all, k * STEP).length) {
            best = k * STEP;
            break;
          }
        }
        expect(scale, `${name}: 4/3, or the largest step that fits`).toBeCloseTo(best, 9);
      } else {
        expect(scale, `${name}: full size`).toBe(1);
      }
      expect(restOk(idle, scale, shift), `${name}: at rest, with its shift of ${shift} px`).toBe(true);
      expect(momentOk(all, scale, shift), `${name}: a moment on the screen, with its shift of ${shift} px`).toBe(true);
    });

    it(`${name}: the room at rest, on every idle frame`, () => {
      expect(idle.left * scale - shift, `${name}: the left edge (2 px in from the screen)`).toBeLessThanOrEqual(REST_LEFT);
      expect(idle.right * scale + shift, `${name}: the right edge (2 px short of the name column)`).toBeLessThanOrEqual(REST_RIGHT);
      expect(idle.up * scale, `${name}: the top (1 px under the "BOSS · move N" text)`).toBeLessThanOrEqual(REST_UP);
      expect(idle.down * scale, `${name}: below the feet, within the bar's padding`).toBeLessThanOrEqual(BAR_PAD_BOTTOM);
    });
  }

  it("each big animal's idle figure is at least as tall as the reference animals' tallest (at full size)", () => {
    const refTallest = Math.max(...ORDER_REF.map((n) => byName[n]!.idle.up + byName[n]!.idle.down));
    for (const n of BIG) {
      const r = byName[n]!;
      const h = (r.idle.up + r.idle.down) * (r.kit.barScale ?? 1);
      expect(h, `${n}: idle height ${h.toFixed(1)} px vs the reference's tallest ${refTallest} px`).toBeGreaterThanOrEqual(refTallest);
    }
  });
});
