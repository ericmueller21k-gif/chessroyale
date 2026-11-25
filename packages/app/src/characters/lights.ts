/**
 * Hollow's Christmas lights (Eric, Oct 11): random colors each game. His ten bulbs take a fresh order of
 * HOLLOW_LIGHTS' colors each battle (settings.ts), never one color on two neighboring bulbs, and the same on every
 * screen of the battle: the order comes from his powers' `lights` number, which the rules draw from the battle's seed
 * (an online raid's players all see the same lights; an older server without it: a random order kept for the battle).
 *
 * "Neighbors" (my call: with ten bulbs and eight colors, no color can be kept off the strand twice): a bulb's
 * color differs from the next three bulbs' along the wire either way. The next one is its neighbor; the one after
 * hangs on the same side of the wire; and his entrance and defeat light or put out every third bulb at a time
 * (`bulbs2` leaves 0, 1, 3, 4, 6, 7, 9 lit, `bulbs1` 0, 3, 6, 9), so bulbs two or three apart end up side by side
 * among the lit ones. So no two bulbs that ever show next to each other share a color. Bulbs 0-4 run up the inner
 * half to his hand and 5-9 down the outer half, so 4 and 5 (either side of his hand) are neighbors; the two ends
 * (0 and 9) are not.
 *
 * Everything that draws a bulb is drawn in its default colors (DEFAULT_LIGHTS: red, yellow, blue in turn, as he was
 * first drawn; previews and tests see these) and recolored as its frames are drawn, by a swap of each bulb's own
 * palette keys (sprite.ts `Swap`): his sprite and its moments (hollow.ts), his attack on a king, the strip of bulbs by
 * the boss bar and his lashes' color on the king's square (effects/hollow.ts). A swap keeps whatever a frame does to a
 * bulb (out, flickering, flashing), so a bulb keeps its color through every frame of the battle. The strip's three
 * bulbs and the lashes take the first three bulbs' colors (always three different ones).
 */
import { HOLLOW_LIGHTS } from "@chessroyale/core";
import type { Swap } from "./sprite.ts";
import type { BossView } from "../game.ts";

/** Bulbs on his strand. */
export const LIGHT_BULBS = 10;

/** One color of his lights as drawn: its glass, the glass's shaded side, a glint on it, and the glow round it. */
export interface BulbColour {
  glass: string;
  shade: string;
  glint: string;
  glow: string;
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");
/** `a` mixed with `b`, `t` of the way (both #rrggbb). */
const mix = (a: string, b: string, t: number) => {
  const ch = (c: string, i: number) => parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2].map((i) => hex2(ch(a, i) + (ch(b, i) - ch(a, i)) * t)).join("")}`;
};

/** Color `c` of HOLLOW_LIGHTS as drawn (lower case, so a swap can find it). */
export function bulbColour(c: number): BulbColour {
  const { glass, shade } = HOLLOW_LIGHTS.colours[c]!;
  const g = glass.toLowerCase();
  return { glass: g, shade: shade.toLowerCase(), glint: mix(g, "#ffffff", 0.82), glow: `${g}55` };
}

const colourIndex = (name: string) => Math.max(0, HOLLOW_LIGHTS.colours.findIndex((c) => c.name === name));
/** The bulbs' colors before a battle's are known (and the colors the art is drawn in): red, yellow, blue in turn. */
export const DEFAULT_LIGHTS: readonly number[] = Array.from({ length: LIGHT_BULBS }, (_, i) => colourIndex(["red", "yellow", "blue"][i % 3]!));

/** A small seeded generator (mulberry32): numbers in [0, 1). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A battle's lights: each bulb's color, first to last along the wire (an index into HOLLOW_LIGHTS.colours), from
 * `seed`. Every color equally likely for each bulb, given that it differs from the three bulbs before it (with
 * fewer than 4 colors, from as many as there's room for). The same seed gives the same lights.
 */
export function lightsOrder(seed: number, bulbs = LIGHT_BULBS, colours = HOLLOW_LIGHTS.colours.length): number[] {
  const next = rng((seed ^ 0x5bd1e995) >>> 0);
  const back = Math.max(1, Math.min(3, colours - 1));
  const out: number[] = [];
  for (let i = 0; i < bulbs; i++) {
    const taken = out.slice(Math.max(0, i - back));
    const free = Array.from({ length: colours }, (_, c) => c).filter((c) => !taken.includes(c));
    out.push(free[Math.floor(next() * free.length)]!);
  }
  return out;
}

/** The lights of the battle on screen now (syncLights), or null before one shows. */
let current: { seed: number; order: number[] } | null = null;

/** A battle without a `lights` number (an older server): a random one, kept for the battle on this device. */
const fallback = new Map<string, number>();
/** The number a battle's lights come from: its powers' `lights` (from the battle's seed), else a random one for it. */
export function lightsSeedOf(boss: Pick<BossView, "id" | "startMove" | "board" | "powers">): number {
  const n = (boss.powers as { lights?: number } | undefined)?.lights;
  if (typeof n === "number") return n;
  const key = `${boss.id}:${boss.startMove}:${boss.board.id}:${boss.board.generation}`;
  let r = fallback.get(key);
  if (r === undefined) {
    r = Math.floor(Math.random() * 4096);
    fallback.set(key, r);
    if (fallback.size > 20) fallback.delete(fallback.keys().next().value!);
  }
  return r;
}

/**
 * The battle on screen sets the lights (the boss's character and anything of his drawn without it call this as they
 * draw): cheap when nothing changed. Every bulb drawn from now on takes them.
 */
export function syncLights(boss: Pick<BossView, "id" | "startMove" | "board" | "powers"> | null | undefined): void {
  if (!boss) return;
  const seed = lightsSeedOf(boss);
  if (current?.seed !== seed) current = { seed, order: lightsOrder(seed) };
}

/** The bulbs' colors now: the battle's, or the defaults before one shows. */
export function currentLights(): readonly number[] {
  return current?.order ?? DEFAULT_LIGHTS;
}

/** The id of the lights now (for caches of drawn frames), "" for the defaults. */
export function lightsId(): string {
  return current ? `lights${current.seed}` : "";
}

/**
 * The recolor for a character whose bulbs are drawn in key sets `keySets` (set `i`: bulb `i`'s keys, in
 * DEFAULT_LIGHTS[i]'s colors): each takes the battle's color for bulb `i`. Null before a battle's lights are known.
 * Made once per battle.
 */
export function lightsSwap(keySets: readonly (readonly string[])[]): () => Swap | null {
  let made: { seed: number; swap: Swap } | null = null;
  return () => {
    if (!current) return null;
    if (made?.seed !== current.seed) {
      const keys: Record<string, Record<string, string>> = {};
      keySets.forEach((set, i) => {
        const from = bulbColour(DEFAULT_LIGHTS[i]!);
        const to = bulbColour(current!.order[i]!);
        const map = { [from.glass]: to.glass, [from.shade]: to.shade, [from.glint]: to.glint };
        for (const k of set) keys[k] = map;
      });
      made = { seed: current.seed, swap: { id: `lights${current.seed}`, keys } };
    }
    return made.swap;
  };
}
