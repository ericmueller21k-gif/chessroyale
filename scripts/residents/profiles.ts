/**
 * Who each resident is: a fixed rating, home time zone, keenness, behavior, favorite time control and look, all drawn from its name
 * alone, so the same resident is the same person on every run and every machine (RESIDENTS in packages/core/src/settings.ts).
 * Pure: no network, no clock. Tested in packages/server/test/residents-program.test.ts.
 */
import { RESIDENTS, botRatingOf, mulberry32, type DuelZone, type PawnColor, type Rng } from "@chessroyale/core";

export type ResidentSettings = typeof RESIDENTS;
export type Behavior = keyof ResidentSettings["behaviors"];

export interface Profile {
  /** Its place in names.json (the first `accounts` names are used). */
  index: number;
  name: string;
  /** Its seed: every draw about it starts here. */
  seed: number;
  /** Maia's rating it plays at (BOT_LOBBY's bell curve, steps of 100). */
  rating: number;
  region: string;
  /** Its home time zone: hours from UTC. */
  utcOffset: number;
  /** Its chance of playing on a given day. */
  keenness: number;
  behavior: Behavior;
  /** Its favorite 1 v 1 time control (the vote's zone). */
  zone: DuelZone;
  /** Its look, set once when the account is made. */
  pawn: PawnColor;
  icon: string;
}

/** FNV-1a over a string: a 32-bit seed. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A seed from several parts (a resident's seed, a day, a minute…). */
export function seedOf(...parts: (string | number)[]): number {
  return hashString(parts.join("|"));
}

/** One key of `shares` (weights, any scale), drawn with `rng`. */
export function drawShare<K extends string>(rng: Rng, shares: Readonly<Record<K, number>>): K {
  const keys = Object.keys(shares) as K[];
  const total = keys.reduce((a, k) => a + shares[k], 0);
  let x = rng() * total;
  for (const k of keys) if ((x -= shares[k]) < 0) return k;
  return keys[keys.length - 1]!;
}

/** A number between `min` and `max`, drawn with `rng`. */
export const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

export function profileOf(name: string, index: number, s: ResidentSettings = RESIDENTS): Profile {
  const seed = hashString(`resident:${name}`);
  const rng = mulberry32(seed);
  const region = drawShare(rng, Object.fromEntries(s.regions.map((r) => [r.name, r.share])) as Record<string, number>);
  const offsets = s.regions.find((r) => r.name === region)!.offsets;
  const utcOffset = offsets[Math.floor(rng() * offsets.length)]!;
  const keenness = Math.round(between(rng, s.keenness.min, s.keenness.max) * 100) / 100;
  const behavior = drawShare(rng, s.behaviors);
  // (A slow resident thinks near its clock: it likes the long games.)
  const zone: DuelZone = behavior === "slow" ? "rapid" : drawShare(rng, s.duel.zones);
  const pawn: PawnColor = rng() < 0.5 ? "white" : "black";
  const icon = s.icons[Math.floor(rng() * s.icons.length)]!;
  // (The bots' curve, keyed by this resident's own name: a different draw from any bot's of the same name.)
  const rating = botRatingOf(`resident:${name}`, { ratings: s.ratings });
  return { index, name, seed, rating, region, utcOffset, keenness, behavior, zone, pawn, icon };
}

/** The first `count` residents of `names`. */
export function profilesFor(names: readonly string[], count: number, s: ResidentSettings = RESIDENTS): Profile[] {
  if (count > names.length) throw new Error(`only ${names.length} names for ${count} accounts (scripts/residents/names.json)`);
  return names.slice(0, count).map((n, i) => profileOf(n, i, s));
}
