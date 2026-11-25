import { BOSS_ROSTER } from "@chessroyale/core";
import { BAR_TOP_GAP, BOSS_KITS, placeFacing, type BossKit } from "../src/characters/kits.ts";
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

/**
 * A frame's drawn pixels, from its feet (the kit's `foot`; the same pixels the canvas draws). With `above`, only the rows whose top is more
 * than that many of its pixels above the feet (what reaches the name column's text and meters: kits.ts barUnder).
 */
export function frameExtent(ch: Ch, frame: Frame, above = -Infinity): Extent | null {
  const { w, h, data } = renderFrame(ch, frame);
  const [fx, fy] = ch.foot;
  let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
  for (let y = 0; y < Math.min(h, fy - above); y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3]! > 0) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  return maxX < 0 ? null : { left: fx - minX, right: maxX + 1 - fx, up: fy - minY, down: maxY + 1 - fy };
}

const widest = (frames: Iterable<[Ch, Frame]>, above?: number): Extent => {
  const worst: Extent = { left: 0, right: 0, up: 0, down: 0 };
  for (const [ch, frame] of frames) {
    const e = frameExtent(ch, frame, above);
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
export const restExtent = (ch: Ch, above?: number): Extent =>
  widest(
    Object.entries(ch.anims)
      .filter(([name]) => !NOT_REST.includes(name))
      .flatMap(([, anim]) => (anim.loop ? anim.frames : anim.frames.slice(-1)).map((f): [Ch, Frame] => [ch, f])),
    above,
  );

/** Each side's farthest reach over every frame of the given animations. */
export function extentOf(ch: Ch, anims: string[], above?: number): Extent {
  return widest(
    anims.flatMap((name) => {
      const anim = ch.anims[name];
      if (!anim) throw new Error(`${ch.id}: no animation ${name}`);
      return anim.frames.map((f): [Ch, Frame] => [ch, f]);
    }),
    above,
  );
}

/**
 * How many of a figure's pixels above its feet, at size `s`, a row must reach to be beside the name column's text and meters when they end
 * `under` px under the bar's top (kits.ts barUnder): 2 px clear of them. Below that the bar is empty, and a figure may reach past the column.
 */
export const besideAbove = (under: number, s: number): number => (FEET_Y - (BAR_TOP + under + 2)) / s;

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
 * (a drawing that reaches further left than the box moves right) and every frame of `all` on the screen; and the name column's offset, the least whole px that keeps it 2 px clear.
 */
export function barFit(rest: Extent, all?: Extent, beside: Extent = rest): { barScale: number; barShift: number; barName: number } {
  // (`rest` is its body's, for a kit with props (kits.ts barProps): a prop may rise over the bar's top, never off the screen's, `all`.)
  const cap = Math.min((REST_UP - BAR_TOP_GAP) / rest.up, BAR_PAD_BOTTOM / Math.max(rest.down, 1e-9), all ? MOMENT_UP / all.up : Infinity);
  const barScale = Math.floor(cap * 100 + 1e-9) / 100;
  // (And never a moment off the screen's left edge (`all`, every frame): Nov 17, Wrangler's lasso and Dash's entrance, turned to face the
  // board, reach that way.)
  const barShift = Math.max(Math.ceil(rest.left * barScale - REST_LEFT - 1e-9), all ? Math.ceil(all.left * barScale - MOMENT_LEFT - 1e-9) : -Infinity);
  // (Measured from what reaches the name column's height: every rest frame, or for a kit with barUnder, the rows above where its text ends.)
  const barName = Math.max(0, Math.ceil(beside.right * barScale + barShift - REST_RIGHT - 1e-9));
  return { barScale, barShift, barName };
}

/**
 * A figure's body alone: every frame without its props' layers (kits.ts barProps, its parts' name prefixes: Chandy's rifle) and its
 * specks (a muzzle's burst, a lens's flare). A prop doesn't size a boss (Eric, Nov 18: Chandy "just obviously needs to be bigger", as
 * Babur's balloons, Oct 24).
 */
export function bodyOf(ch: Ch, props: readonly string[]): Ch {
  const body = (f: Frame): Frame => ({ ...f, specks: undefined, layers: f.layers.filter((l) => !props.some((p) => String(l.part).startsWith(p))) });
  return { ...ch, anims: Object.fromEntries(Object.entries(ch.anims).map(([n, a]) => [n, { ...a, frames: a.frames.map(body) }])) };
}

/** Each side's farther reach of two extents. */
const either = (a: Extent, b: Extent): Extent => ({ left: Math.max(a.left, b.left), right: Math.max(a.right, b.right), up: Math.max(a.up, b.up), down: Math.max(a.down, b.down) });

/** An extent mirrored about the feet: its left and right swapped. */
const mirrored = (e: Extent): Extent => ({ ...e, left: e.right, right: e.left });

/**
 * Every playable boss's kit, the character its bar draws, and its reach as the bar draws it (mirrored about its feet where it turns to
 * face the board: kits.ts placeFacing, Nov 17): `idle`, its idle's; `rest`, its rest frames' (its body's alone, for a kit with props:
 * kits.ts barProps), which size and place it; `all`, every frame's, props and all, which stay on the screen; `beside`, what must clear
 * the name column (its rest frames, props too; with barUnder, the body and the rows above where the column's text and meters end, at its
 * fitted size); `under`, every frame's reach in those rows (Chandy's rifle: never into them).
 */
export function barRows() {
  return PLAYABLE.map((def) => {
    const kit: BossKit = BOSS_KITS[def.kit!]!;
    const ch = kit.bar ?? kit.ch;
    const body = kit.barProps ? bodyOf(ch, kit.barProps) : ch;
    const idle = [kit.loops?.idle ?? "idle", ...(kit.powered ? [kit.powered.idle] : [])];
    const as = placeFacing(kit, ch, "bar").mirror ? mirrored : (e: Extent) => e;
    const rest = as(restExtent(body));
    const all = as(extentOf(ch, Object.keys(ch.anims)));
    const above = kit.barUnder === undefined ? undefined : besideAbove(kit.barUnder, barFit(rest, all).barScale);
    const beside = above === undefined ? as(restExtent(ch)) : either(rest, as(restExtent(ch, above)));
    const under = above === undefined ? all : as(extentOf(ch, Object.keys(ch.anims), above));
    return { name: def.kit!, kit, idle: as(extentOf(body, idle)), rest, all, beside, under };
  });
}
