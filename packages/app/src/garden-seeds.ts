/**
 * The hippo gardener's seeds on a screen (docs/decisions/2026-10-23-gardener-wired.md; his rules: bosses/gardener.ts). Pure functions
 * of the view's `garden` and the garden's clock (garden-clock.ts), and the small store the screens' tosses go through:
 * - **The meter** (`seedReading`): how many seeds wait and how far the bar is toward the next, by the rules' own `seedsAt` and
 *   `seedFill`. While a watering is being placed (`garden.taken`) it holds where it was when the count was taken.
 * - **The toss** (`freshLanding`, `tossSquares`, the store): a seed's landing is a moment of the garden's clock, not an event of any
 *   turn. A screen tosses for the latest landing only if it came a moment ago and this device hasn't tossed for it yet, so a screen
 *   drawn later, a page that was hidden (online the server's clock ran on) and a reload never toss for time they didn't see: no burst.
 */
import { seedFill, seedsAt, type GardenView } from "@chessroyale/chess";
import { BOSS_POWERS } from "@chessroyale/core";
import { hash } from "./characters/boss-beats.ts";

type Garden = Pick<GardenView, "since" | "base" | "fixed" | "taken">;

export interface SeedReading {
  /** The seeds waiting. */
  count: number;
  /** The bar toward the next seed, 0 to 1 (1 at the cap). */
  fill: number;
  /** When the next seed lands, on the garden's clock (null: at the cap, or the meter is held). */
  next: number | null;
  /** A watering's count is taken and its placement is still to come: the meter holds. */
  held: boolean;
}

/**
 * His meter at clock time `now`. Held (`taken`), it shows the count taken and the bar where it stood at the moment it was taken, whatever
 * `now` is; a set count (the test switch's `fixed`) shows full.
 */
export function seedReading(g: Garden, now: number): SeedReading {
  if (g.taken) {
    const { count } = seedsAt(g, now);
    return { count, fill: g.fixed != null ? 1 : seedFill({ since: g.since, base: g.base }, g.taken.clock), next: null, held: true };
  }
  const { count, next } = seedsAt(g, now);
  return { count, fill: seedFill(g, now), next, held: false };
}

/** A seed's landing is a toss still worth playing for this long after it (ms of the garden's clock). */
export const SEED_FRESH_MS = 2000;

/**
 * The latest seed to have landed on the meter since its last reset (`since`), with a key of its own and when it landed on the garden's
 * clock; null: none (the count is still `base`, held, or a set count).
 */
export function lastLanding(g: Garden, now: number): { key: string; at: number } | null {
  if (g.taken || g.fixed != null) return null;
  const every = BOSS_POWERS.seedEverySec * 1000;
  const n = Math.min(Math.floor(Math.max(0, now - g.since) / every), Math.max(0, BOSS_POWERS.seedMax - g.base));
  return n > 0 ? { key: `${g.since}:${n}`, at: g.since + n * every } : null;
}

/** The latest landing if it came less than SEED_FRESH_MS ago. */
export function freshLanding(g: Garden, now: number): { key: string; at: number } | null {
  const l = lastLanding(g, now);
  return l && now - l.at < SEED_FRESH_MS ? l : null;
}

/** The squares a toss can land on: the board's middle four ranks, where the seeds sink into open ground (they are only for show). */
const POOL = [..."abcdefgh"].flatMap((f) => [3, 4, 5, 6].map((r) => `${f}${r}`));

/** `n` different squares for a toss, from a seeded pick on its key (the same on every device, and when it replays). */
export function tossSquares(key: string, n: number): string[] {
  const pool = [...POOL];
  const out: string[] = [];
  let h = hash(key);
  for (let i = 0; i < n && pool.length; i++) {
    h = hash(`${h}:${i}`);
    out.push(pool.splice(h % pool.length, 1)[0]!);
  }
  return out;
}

// ---------------- The tosses on this screen ----------------

/** One seed: where it lands and when it leaves his hand (Date.now() time). */
export interface TossSeed {
  to: string;
  leaveAt: number;
}

/**
 * One toss (the opening's five, or one seed): where his hand is on the board when the seeds leave it (the board's size as 1; null: not
 * found, a corner of the board stands in), and the seeds.
 */
export interface Toss {
  id: string;
  hand: { x: number; y: number } | null;
  seeds: TossSeed[];
}

const tosses: Toss[] = [];
const listeners = new Set<() => void>();
/** The tosses played on this device this battle (a screen drawn again never plays one twice). */
const played = new Set<string>();

/** How long a toss stays in the store: a seed's flight and its plop (a little over; a screen's drawing drops what's over). */
export const TOSS_KEEP_MS = 3000;

export const hasTossed = (id: string): boolean => played.has(id);

/** Adds a toss (once per id) and tells the layers drawing seeds. */
export function addToss(t: Toss): boolean {
  if (played.has(t.id)) return false;
  played.add(t.id);
  if (played.size > 100) played.delete(played.values().next().value!);
  const now = Date.now();
  for (let i = tosses.length - 1; i >= 0; i--) if (tosses[i]!.seeds.every((s) => now - s.leaveAt > TOSS_KEEP_MS)) tosses.splice(i, 1);
  tosses.push(t);
  for (const f of listeners) f();
  return true;
}

export const currentTosses = (): readonly Toss[] => tosses;

export function onTosses(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** A new battle: nothing tossed yet. */
export function resetTosses(): void {
  tosses.length = 0;
  played.clear();
}
