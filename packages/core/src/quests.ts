import { mulberry32 } from "./rng.ts";
import { QUESTS, XP, type QuestCounts, type QuestDef } from "./settings.ts";
import { xpDayStart } from "./xp.ts";

/**
 * Quests (Eric, Nov 9; XP phase 3; QUESTS in settings.ts; docs/decisions/2026-11-09-quests-*.md): the rules, pure. The server deals
 * them, counts each game and pays them (server/quests.ts); the overlay draws what it answers (components/QuestsOverlay.tsx).
 */

/** A quest row's picture: a boss's portrait (a boss quest: a live boss, by name), Squads' pawns, or a piece of the board's set. */
export type QuestIcon = { kind: "boss"; boss: string } | { kind: "squad" } | { kind: "board"; piece: "knight" | "rook" | "queen" | "pawn" };

/** One quest as the overlay shows it. */
export interface QuestView {
  /** This quest's own id (a reroll names it). */
  id: string;
  /** Daily (two a day, up to three waiting) or the weekly. */
  period: "daily" | "weekly";
  name: string;
  /** What to do, in plain words ("Play 2 Squads games"). */
  goal: string;
  progress: number;
  target: number;
  icon: QuestIcon;
  /** What finishing it pays (granted the moment it's done, by the server). */
  reward: { xp: number; crates?: number; keys?: number };
  /** Its free reroll is there today (an unfinished daily that no reroll dealt today; each daily has its own, Nov 10). */
  canReroll: boolean;
}

/** GET /api/quests's answer. */
export interface QuestsAnswer {
  /** The dailies (the oldest first), then the weekly. */
  quests: QuestView[];
  /** The XP day these are (its start), for "shown once a day". */
  day: number;
  /** When the next dailies are dealt, and the weekly resets (server time). */
  dailyResetAt: number;
  weeklyResetAt: number;
  /** The server's time as it answered (the countdowns are worked out against it). */
  now: number;
  /** PAUSE_REWARDS is on: quests don't move and pay nothing for now. */
  paused?: boolean;
}

/**
 * What the server knows of a counted game, for quests: its mode (a solo game is "solo", a solo Boss Battle "soloBoss": the device's
 * word, as its moves and its win are), and a win whose XP was paid.
 */
export interface QuestGame {
  mode: "classic" | "crowd" | "boss" | "squads" | "duel" | "solo" | "soloBoss";
  /** Won, and its win XP paid (the server checks the ledger: a friends' lobby's win pays once a day per opponent). */
  won: boolean;
  /** Your time in it by the server's clock, ms (a solo game needs QUESTS.soloMinMinutes of it). */
  ms: number;
}

/** A pool's quest by id (daily or weekly), or null: not one (any more). */
export function questDef(id: string): QuestDef | null {
  return QUESTS.daily.find((q) => q.id === id) ?? QUESTS.weekly.find((q) => q.id === id) ?? null;
}

/**
 * Whether a counted game moves a quest of this kind (online games by their room's facts). A solo game needs QUESTS.soloMinMinutes of
 * the server's time and moves "any"; a solo Boss Battle also "boss" and, won, "bossWin" (Eric, Nov 10: "they just follow our normal rules").
 */
export function questCounts(counts: QuestCounts, g: QuestGame): boolean {
  if (g.mode === "solo" || g.mode === "soloBoss") {
    if (g.ms < QUESTS.soloMinMinutes * 60_000) return false;
    return counts === "any" || (g.mode === "soloBoss" && (counts === "boss" || (counts === "bossWin" && g.won)));
  }
  switch (counts) {
    case "any":
      return true;
    case "win":
      return g.won;
    case "boss":
      return g.mode === "boss";
    case "bossWin":
      return g.mode === "boss" && g.won;
    case "squads":
      return g.mode === "squads";
    case "crowd":
      return g.mode === "crowd";
  }
}

const DAY = 86_400_000;

/** The quest week holding `t` began: the Monday (QUESTS.weekStartDay) at XP.dayStartUtcHour UTC. */
export function questWeekStart(t: number): number {
  const day = xpDayStart(t);
  // (Day 0 since 1970 at 08:00 UTC was a Thursday: weekday 4.)
  const weekday = (Math.floor((day - XP.dayStartUtcHour * 3_600_000) / DAY) + 4) % 7;
  return day - ((weekday - QUESTS.weekStartDay + 7) % 7) * DAY;
}

/** A number from a string (FNV-1a), for a seed. */
export function questSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * `n` quests from a pool, by weight, without repeats and none of `held` (kinds already dealt): drawn from `seed`, so the same
 * account and day always draw the same. Fewer if the pool runs out.
 */
export function pickQuests(pool: readonly QuestDef[], held: readonly string[], n: number, seed: string): QuestDef[] {
  const rng = mulberry32(questSeed(seed));
  const left = pool.filter((q) => !held.includes(q.id) && q.weight > 0);
  const out: QuestDef[] = [];
  while (out.length < n && left.length) {
    const total = left.reduce((s, q) => s + q.weight, 0);
    let r = rng() * total;
    let i = 0;
    for (; i < left.length - 1; i++) {
      r -= left[i]!.weight;
      if (r < 0) break;
    }
    out.push(left.splice(i, 1)[0]!);
  }
  return out;
}

/** How many dailies a new day deals when `waiting` unfinished ones carry over: up to QUESTS.dailyPerDay, never past QUESTS.maxDailies. */
export const dailiesToDeal = (waiting: number): number => Math.max(0, Math.min(QUESTS.dailyPerDay, QUESTS.maxDailies - waiting));

/** A countdown in a word: "4d", "12h", "35m" (at least "1m"). */
export function questCountdown(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60_000));
  if (m >= 48 * 60) return `${Math.floor(m / (24 * 60))}d`;
  if (m >= 60) return `${Math.floor(m / 60)}h`;
  return `${m}m`;
}

/** A quest done by a game, as its result's toast shows it ("Quest done: Boss Hunter +300 XP"). */
export interface QuestPaid {
  /** The pool's id. */
  quest: string;
  name: string;
  xp: number;
  crates: number;
  keys: number;
}

/** The XP box's part for a game's quests ("Quest +300", "Quests +600"). */
export const questPartLabel = (n: number): string => (n === 1 ? "Quest" : "Quests");
