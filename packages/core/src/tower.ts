import { BOSS_ROSTER, ENGINE_MAX_ELO, maiaTopRating, playableBosses, rosterWithout, type BossDef } from "./boss.ts";
import { mulberry32, shuffle } from "./rng.ts";
import { BATTLE_TOWER, type Settings } from "./settings.ts";

/**
 * The Battle Tower's climb (docs/decisions/2026-11-18-battle-tower-design.md, section 3; docs/areas/battle-tower.md): how many
 * bosses each floor has and how strong they play, which bosses (the deal), and the run's steps. A run is plain data (TowerRun)
 * and every step a pure function returning the next run, for the server to save (PR 9). The numbers are BATTLE_TOWER's.
 */

/** The tower's numbers (BATTLE_TOWER's shape, so a test or a sim can pass others). */
export interface TowerRules {
  floors: number;
  pattern: readonly number[];
  maiaStart: number;
  maiaStep: number;
  soloBonus: number;
  stockfishFrom: number;
  stockfishStart: number;
  stockfishStep: number;
  leaveFreeBefore: number;
  apart: readonly (readonly [string, string])[];
  maxBosses: number;
}

/** How many bosses floor `floor` has: the pattern looping (1, 2, 2, 3: floors 1, 5, 9 … one; 4, 8 … three). */
export const floorBossCount = (floor: number, s: TowerRules = BATTLE_TOWER): number => s.pattern[(floor - 1) % s.pattern.length]!;

/**
 * How every boss on a floor plays (each boss the floor's own: no roster offset, no difficulty).
 * - `brain` "maia": Maia at `rating` (Boss alone's brain, `bossBrainFor`'s `alone`); "stockfish": Stockfish at UCI_Elo `rating`
 *   with the blunder guard, as a Stockfish boss always plays.
 * - `full`: Stockfish's best every move (the move kind "best"), `rating` its ceiling.
 */
export interface FloorStrength {
  brain: "maia" | "stockfish";
  rating: number;
  full: boolean;
}

/**
 * Floor `floor`'s strength with `bosses` on it: before stockfishFrom, Maia at maiaStart + maiaStep a floor, held at Maia's top
 * (2500, from floor 20); from stockfishFrom, Stockfish at stockfishStart + stockfishStep a floor, held at ENGINE_MAX_ELO on the
 * floor that reaches it (79), its best from the floor after (80). A lone boss plays soloBonus more, within the same caps.
 */
export function floorStrength(floor: number, bosses: number, s: TowerRules = BATTLE_TOWER): FloorStrength {
  const bonus = bosses === 1 ? s.soloBonus : 0;
  if (floor < s.stockfishFrom) return { brain: "maia", rating: Math.min(maiaTopRating(), s.maiaStart + s.maiaStep * (floor - 1) + bonus), full: false };
  const at = (f: number) => s.stockfishStart + s.stockfishStep * (f - s.stockfishFrom);
  const full = floor > s.stockfishFrom && at(floor - 1) >= ENGINE_MAX_ELO;
  return { brain: "stockfish", rating: full ? ENGINE_MAX_ELO : Math.min(ENGINE_MAX_ELO, at(floor) + bonus), full };
}

/**
 * The bosses the tower deals from, in roster order: every playable boss (a complete character with powers, live for everyone:
 * never the hidden one, never one in the game for admins first) but those resting (`off`: the kill switches, rosterWithout).
 */
export const towerPool = (off?: readonly string[], roster: readonly BossDef[] = BOSS_ROSTER): string[] => playableBosses(rosterWithout(off, roster)).map((b) => b.id);

const apart = (a: string, b: string, s: TowerRules) => s.apart.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/**
 * Why `ids` can't be one floor's bosses (null: they can): a boss with no powers (or no such boss), none or more than maxBosses,
 * one twice, a pair `apart` keeps apart, or (with `pool`) one not in it now (resting, hidden or not live). The one rule for a
 * side: the runner's start (several bosses) throws it for a test switch; the tower's start deals again instead (startFloor).
 */
export function sideRefusal(ids: readonly string[], pool?: readonly string[], s: TowerRules = BATTLE_TOWER, roster: readonly BossDef[] = BOSS_ROSTER): string | null {
  const unknown = ids.filter((id) => !roster.some((d) => d.id === id && d.powers));
  if (unknown.length) return `no boss with powers named ${unknown.join(", ")}`;
  if (!ids.length || ids.length > s.maxBosses || new Set(ids).size < ids.length) return `1 to ${s.maxBosses} different bosses, not ${ids.join(", ")}`;
  const pair = s.apart.find(([a, b]) => ids.includes(a) && ids.includes(b));
  if (pair) return `${pair[0]} and ${pair[1]} never share a floor (BATTLE_TOWER.apart)`;
  const out = pool ? ids.filter((id) => !pool.includes(id)) : [];
  return out.length ? `not in the tower's pool now: ${out.join(", ")}` : null;
}

/**
 * A climb, as the server saves it. `floors[f - 1]` is floor f's bosses in the order they take turns; the last is the floor to
 * fight (dealt as the floor before was won), so the floor is `floors.length`. `deck`: the bosses still to deal, in order; `decks`:
 * how many decks were shuffled from `seed` so far.
 */
export interface TowerRun {
  seed: number;
  floors: readonly (readonly string[])[];
  deck: readonly string[];
  decks: number;
  /** "open": climbing; "top": floor `floors` (99) won; "out": a floor lost, drawn, or left after your 2nd move. */
  status: "open" | "top" | "out";
}

/**
 * Deals from `deck`, in order, onto `on` (up to `k`): never a boss already on it, one on the floor before (`before`) or one `apart`
 * from one on it; those it passes over stay, in order, for the next floor. Returns them.
 */
function take(deck: readonly string[], k: number, on: string[], before: readonly string[], s: TowerRules): string[] {
  const rest: string[] = [];
  for (const b of deck) {
    if (on.length < k && !before.includes(b) && !on.includes(b) && !on.some((c) => apart(b, c, s))) on.push(b);
    else rest.push(b);
  }
  return rest;
}

/**
 * Whether `deck`, dealt from `floor` on (`on` already on that floor, `before` the floor before's), is dealt to its last boss with
 * none left behind: never a floor it can't fill while some of it waits (an `apart` pair at its end), when the next deck's would come
 * first. (The pool as it is now; a kill switch later may still leave one behind, dealt on the next floor.)
 */
function dealsOut(deck: readonly string[], floor: number, on: readonly string[], before: readonly string[], s: TowerRules): boolean {
  let rest = deck;
  let floorOn = [...on];
  let prev = before;
  for (let f = floor; f <= s.floors; f++) {
    rest = take(rest, floorBossCount(f, s), floorOn, prev, s);
    if (!rest.length) return true;
    if (floorOn.length < floorBossCount(f, s)) return false;
    prev = floorOn;
    floorOn = [];
  }
  return true;
}

/** Shuffles of the pool tried for a deck that deals out (dealsOut) before the last one is kept as it is (a pool too small for the rules). */
const DECK_TRIES = 64;

/** Deck number `n` of the run seeded `seed`: the first of its shuffles of `pool` that deals out from `floor` (dealsOut). */
function freshDeck(seed: number, n: number, pool: readonly string[], floor: number, on: readonly string[], before: readonly string[], s: TowerRules): string[] {
  const rng = mulberry32((seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0);
  let deck = shuffle(rng, pool);
  for (let t = 1; t < DECK_TRIES && !dealsOut(deck, floor, on, before, s); t++) deck = shuffle(rng, pool);
  return deck;
}

/**
 * Floor `floor`'s bosses from the run's deck (a resting boss leaves it), the floor before's (`before`) never again: the deck's, in
 * order, then a new deck's once it runs out, so a run meets every boss in the pool once before any comes twice. A pool the kill
 * switches left too small for that: the floor before's bosses may come again, never an apart pair; still too small, fewer bosses.
 */
function deal(run: Pick<TowerRun, "seed" | "deck" | "decks">, floor: number, before: readonly string[], pool: readonly string[], s: TowerRules): Pick<TowerRun, "deck" | "decks"> & { bosses: string[] } {
  const k = floorBossCount(floor, s);
  const bosses: string[] = [];
  let deck = take(run.deck.filter((b) => pool.includes(b)), k, bosses, before, s);
  let decks = run.decks;
  if (bosses.length < k && deck.length < pool.length) {
    const fresh = freshDeck(run.seed, decks++, pool, floor, bosses, before, s);
    deck = [...deck, ...take(fresh, k, bosses, before, s)];
  }
  if (bosses.length < k) deck = take(deck, k, bosses, [], s);
  return { bosses, deck, decks };
}

/** A new run from `seed` (the server's draw): floor 1 dealt from the pool now (towerPool). */
export function newRun(seed: number, pool: readonly string[], s: TowerRules = BATTLE_TOWER): TowerRun {
  const { bosses, deck, decks } = deal({ seed: seed >>> 0, deck: [], decks: 0 }, 1, [], pool, s);
  return { seed: seed >>> 0, floors: [bosses], deck, decks, status: "open" };
}

/**
 * The floor's start, the only way into a floor: its bosses from the run's deal, never from anywhere else. A deal the pool no longer
 * allows (a boss resting since, or a pair `apart` keeps apart since) is dealt again (its bosses back on top of the deck), never
 * thrown; the run returned is the one to save. Null for a run that isn't open. `settings`: the floor's for the match runner (its
 * bosses in turn order, and the floor, which sets their strength: floorStrength).
 */
export function startFloor(run: TowerRun, pool: readonly string[], s: TowerRules = BATTLE_TOWER): { run: TowerRun; settings: Partial<Settings> } | null {
  const floor = run.floors.length;
  if (run.status !== "open" || !floor) return null;
  let next = run;
  const dealt = run.floors[floor - 1]!;
  if (sideRefusal(dealt, pool, s)) {
    const { bosses, deck, decks } = deal({ ...run, deck: [...dealt, ...run.deck] }, floor, run.floors[floor - 2] ?? [], pool, s);
    next = { ...run, floors: [...run.floors.slice(0, -1), bosses], deck, decks };
  }
  return { run: next, settings: floorSettings(next) };
}

/**
 * The match runner's settings for the run's floor as it's dealt (its bosses in turn order, and the floor, which sets their strength:
 * floorStrength): startFloor's, and the server's for a floor already under way (its bosses as they were when it began).
 */
export function floorSettings(run: Pick<TowerRun, "floors">): Partial<Settings> {
  const floor = run.floors.length;
  const bosses = run.floors[floor - 1] ?? [];
  return { towerFloor: floor, bossId: bosses[0]!, bossIds: bosses, bossAvoid: "" };
}

/**
 * A floor's end. Won: the next floor dealt from the pool now (and saved with the run: stopping and coming back meets the same
 * bosses), or the run complete ("top") on the last floor. Lost or drawn: the run is over ("out"; only a win climbs). A run that
 * isn't open stays as it is.
 */
export function finishFloor(run: TowerRun, outcome: "won" | "lost" | "drawn", pool: readonly string[], s: TowerRules = BATTLE_TOWER): TowerRun {
  if (run.status !== "open") return run;
  if (outcome !== "won") return { ...run, status: "out" };
  const floor = run.floors.length;
  if (floor >= s.floors) return { ...run, status: "top" };
  const { bosses, deck, decks } = deal(run, floor + 1, run.floors[floor - 1]!, pool, s);
  return { ...run, floors: [...run.floors, bosses], deck, decks };
}

/**
 * Leaving a floor under way after `crowdMoves` of your moves on it: free before your leaveFreeBefore-th (2nd) move (the run as it
 * was: the same floor and bosses, fought again later), else a loss.
 */
export const leaveFloor = (run: TowerRun, crowdMoves: number, s: TowerRules = BATTLE_TOWER): TowerRun =>
  crowdMoves < s.leaveFreeBefore ? run : finishFloor(run, "lost", [], s);
