/**
 * Hollow's Christmas lights (Eric, Oct 11): random colours each game. His ten bulbs take a fresh order of
 * HOLLOW_LIGHTS' colours each battle (settings.ts), never one colour on two neighbouring bulbs, and the same on every
 * screen of the battle: the order comes from his powers' `lights` number, which the rules draw from the battle's seed
 * (an online raid's players all see the same lights; an older server without it: a random order kept for the battle).
 *
 * "Neighbours" (my call: with ten bulbs and eight colours, no colour can be kept off the strand twice): a bulb's
 * colour differs from the next bulb's along the wire either way, and from the one after that too, which hangs on the
 * same side of the wire. Bulbs 0-4 run up the inner half to his hand and 5-9 down the outer half, so 4 and 5 (either
 * side of his hand) are neighbours; the two ends (0 and 9) are not.
 *
 * Everything that draws a bulb is drawn in its default colours (DEFAULT_LIGHTS: red, yellow, blue in turn, as he was
 * first drawn; previews and tests see these) and recoloured as its frames are drawn, by a swap of each bulb's own
 * palette keys (sprite.ts `Swap`): his sprite and its moments (hollow.ts), his attack on a king, the strip of bulbs by
 * the boss bar and his lashes' colour on the king's square (effects/hollow.ts). A swap keeps whatever a frame does to a
 * bulb (out, flickering, flashing), so a bulb keeps its colour through every frame of the battle. The strip's three
 * bulbs and the lashes take the first three bulbs' colours (always three different ones).
 */
import { HOLLOW_LIGHTS } from "@chessroyale/core";
import type { Swap } from "./sprite.ts";
import type { BossView } from "../game.ts";

/** Bulbs on his strand. */
export const LIGHT_BULBS = 10;

/** One colour of his lights as drawn: its glass, the glass's shaded side, a glint on it, and the glow round it. */
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

/** Colour `c` of HOLLOW_LIGHTS as drawn (lower case, so a swap can find it). */
export function bulbColour(c: number): BulbColour {
  const { glass, shade } = HOLLOW_LIGHTS.colours[c]!;
  const g = glass.toLowerCase();
  return { glass: g, shade: shade.toLowerCase(), glint: mix(g, "#ffffff", 0.82), glow: `${g}55` };
}

const colourIndex = (name: string) => Math.max(0, HOLLOW_LIGHTS.colours.findIndex((c) => c.name === name));
/** The bulbs' colours before a battle's are known (and the colours the art is drawn in): red, yellow, blue in turn. */
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
 * A battle's lights: each bulb's colour, first to last along the wire (an index into HOLLOW_LIGHTS.colours), from
 * `seed`. Every colour equally likely for each bulb, given that it differs from the two bulbs before it (with 3
 * colours or fewer, from the one before it only). The same seed gives the same lights.
 */
export function lightsOrder(seed: number, bulbs = LIGHT_BULBS, colours = HOLLOW_LIGHTS.colours.length): number[] {
  const next = rng((seed ^ 0x5bd1e995) >>> 0);
  const back = colours > 3 ? 2 : 1;
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

/** The bulbs' colours now: the battle's, or the defaults before one shows. */
export function currentLights(): readonly number[] {
  return current?.order ?? DEFAULT_LIGHTS;
}

/** The id of the lights now (for caches of drawn frames), "" for the defaults. */
export function lightsId(): string {
  return current ? `lights${current.seed}` : "";
}

/**
 * The recolour for a character whose bulbs are drawn in key sets `keySets` (set `i`: bulb `i`'s keys, in
 * DEFAULT_LIGHTS[i]'s colours): each takes the battle's colour for bulb `i`. Null before a battle's lights are known.
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
