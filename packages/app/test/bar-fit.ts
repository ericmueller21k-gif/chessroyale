import { BOSS_ROSTER } from "@chessroyale/core";
import { BAR_TOP_GAP, BOSS_KITS, type BossKit } from "../src/characters/kits.ts";
import { renderFrame } from "../src/characters/sprite.ts";

/**
 * A phone's boss bar: each boss's size, its drawing's shift and its name column's offset, measured from its art (Eric, Nov 12: "every
 * boss as tall as their container… make it the height, minus a few pixels, of the container, and then if it reaches over to the left…
 * just shift everything over to the right"). The test (boss-bar-same.test.ts) checks kits.ts against `barFit`; `scripts/bar-fit.ts`
 * prints the numbers to put there after a change to a drawing or to BAR_TOP_GAP.
 *
 * The room, in px on a phone (the bar's left edge at 14 px; the figure box 58 px wide from 5 px in, so the feet at 48 px from the
 * screen's left edge; the name column at 89 px; the bar's top at 48 px; the feet at 141 px, the bar's bottom padding 6 px under them).
 */
// (Every boss with a character, those in the game for admins first (Timber, Dash, Don Dough) too: Eric, Nov 12, "every boss".)
export const PLAYABLE = BOSS_ROSTER.filter((b) => !!b.kit && !!BOSS_KITS[b.kit]);

export const FEET_X = 48;
export const FEET_Y = 141;
export const SCREEN_W = 320;
export const NAME_X = 89;
export const BAR_PAD_BOTTOM = 6;
export const BAR_LEFT = 14;
export const BAR_TOP = 48;
export const REST_LEFT = FEET_X - (BAR_LEFT + 2); // the drawn left edge 2 px in from the bar's left edge:   L * s - shift <= 32
export const REST_RIGHT = NAME_X - 2 - FEET_X; // the drawn right edge 2 px short of the name column:      R * s + shift <= 39 + barName
export const REST_UP = FEET_Y - BAR_TOP; // the bar's height above the feet:                               U * s <= 93 - BAR_TOP_GAP
export const MOMENT_LEFT = FEET_X; // a moment's drawn left edge on the screen (x >= 0)
export const MOMENT_RIGHT = SCREEN_W - FEET_X; // (the narrowest phone, 320 px)
export const MOMENT_UP = FEET_Y; // (the screen's top, y >= 0)

export type Extent = { left: number; right: number; up: number; down: number };
type Ch = Parameters<typeof renderFrame>[0];
type Frame = Parameters<typeof renderFrame>[1];

/** A frame's drawn pixels, from its feet (the kit's `foot`; the same pixels the canvas draws). */
export function frameExtent(ch: Ch, frame: Frame): Extent | null {
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

const widest = (frames: Iterable<[Ch, Frame]>): Extent => {
  const worst: Extent = { left: 0, right: 0, up: 0, down: 0 };
  for (const [ch, frame] of frames) {
    const e = frameExtent(ch, frame);
    if (!e) continue;
    worst.left = Math.max(worst.left, e.left);
    worst.right = Math.max(worst.right, e.right);
    worst.up = Math.max(worst.up, e.up);
    worst.down = Math.max(worst.down, e.down);
  }
  return worst;
};

/**
 * The loops a boss doesn't rest in through a battle, so they don't size it (Eric, Nov 12: "as tall as their container"): his victory, the
 * battle won, arms up at its end. Played in the bar it's a moment, as a cast: it may rise over the bar's top, never off the screen.
 */
export const NOT_REST: readonly string[] = ["victory"];

/** Each side's farthest reach over every rest frame: a loop's frames, and the last frame of each one-shot (where each beat ends), but NOT_REST. */
export const restExtent = (ch: Ch): Extent =>
  widest(
    Object.entries(ch.anims)
      .filter(([name]) => !NOT_REST.includes(name))
      .flatMap(([, anim]) => (anim.loop ? anim.frames : anim.frames.slice(-1)).map((f): [Ch, Frame] => [ch, f])),
  );

/** Each side's farthest reach over every frame of the given animations. */
export function extentOf(ch: Ch, anims: string[]): Extent {
  return widest(
    anims.flatMap((name) => {
      const anim = ch.anims[name];
      if (!anim) throw new Error(`${ch.id}: no animation ${name}`);
      return anim.frames.map((f): [Ch, Frame] => [ch, f]);
    }),
  );
}

/** The room at rest: every rest frame inside the bar (2 px in from its left edge, under its top, in its bottom padding, 2 px short of the name column). */
export function restOk(rest: Extent, s: number, shift: number, name = 0): boolean {
  return rest.left * s - shift <= REST_LEFT && rest.right * s + shift <= REST_RIGHT + name && rest.up * s <= REST_UP && rest.down * s <= BAR_PAD_BOTTOM;
}

/** A one-shot moment stays on the screen (not above it, not off either side). */
export function momentOk(all: Extent, s: number, shift: number): boolean {
  return all.left * s - shift <= MOMENT_LEFT && all.right * s + shift <= MOMENT_RIGHT && all.up * s <= MOMENT_UP;
}

/**
 * A boss's bar numbers: its size, the largest hundredth that has every rest frame reach no higher than BAR_TOP_GAP under the bar's top
 * (and stay in the bottom padding); its drawing's shift, the least whole px that keeps every rest frame 2 px in from the bar's left edge
 * (a drawing that reaches further left than the box moves right); and the name column's offset, the least whole px that keeps it 2 px clear.
 */
export function barFit(rest: Extent): { barScale: number; barShift: number; barName: number } {
  const cap = Math.min((REST_UP - BAR_TOP_GAP) / rest.up, BAR_PAD_BOTTOM / Math.max(rest.down, 1e-9));
  const barScale = Math.floor(cap * 100 + 1e-9) / 100;
  const barShift = Math.ceil(rest.left * barScale - REST_LEFT - 1e-9);
  const barName = Math.max(0, Math.ceil(rest.right * barScale + barShift - REST_RIGHT - 1e-9));
  return { barScale, barShift, barName };
}

/** Every playable boss's kit, the character its bar draws, its idle's and its rest frames' reach, and every frame's. */
export function barRows() {
  return PLAYABLE.map((def) => {
    const kit: BossKit = BOSS_KITS[def.kit!]!;
    const ch = kit.bar ?? kit.ch;
    const idle = [kit.loops?.idle ?? "idle", ...(kit.powered ? [kit.powered.idle] : [])];
    return { name: def.kit!, kit, idle: extentOf(ch, idle), rest: restExtent(ch), all: extentOf(ch, Object.keys(ch.anims)) };
  });
}
