import type { BossState, PlayerState } from "./match.ts";
import { FRONT_DOOR } from "./settings.ts";

/**
 * What a profile shows that's worked out from a match or a rating, shared by the server (online matches, profiles)
 * and the app (solo matches it records itself). Nothing here is stored; see the server's accounts.ts.
 */

export interface RatingTier {
  /** e.g. "Gold". */
  name: string;
  /** "I" (top) to "III", or null for the tiers without divisions. */
  division: "I" | "II" | "III" | null;
  /** e.g. "Gold II". */
  label: string;
  color: string;
}

/** The tier a rating falls in (FRONT_DOOR.ratingTiers), or null without a rating. */
export function ratingTier(rating: number | null | undefined, tiers = FRONT_DOOR.ratingTiers, step = FRONT_DOOR.divisionStep): RatingTier | null {
  if (rating === null || rating === undefined || !Number.isFinite(rating)) return null;
  let i = 0;
  while (i + 1 < tiers.length && rating >= tiers[i + 1]!.from) i++;
  const t = tiers[i]!;
  const next = tiers[i + 1];
  let division: RatingTier["division"] = null;
  if (t.divisions && next) {
    const below = next.from - rating;
    division = below <= step ? "I" : below <= 2 * step ? "II" : "III";
  }
  return { name: t.name, division, label: division ? `${t.name} ${division}` : t.name, color: t.color };
}

/** "Top 18%": the share of rated players at or above `rating`'s place (1 = the best), rounded up, at least 1. */
export function topPercent(rank: number, total: number): number {
  return Math.max(1, Math.min(100, Math.ceil((100 * rank) / Math.max(1, total))));
}

/** One player's record of a match beyond placing: cuts and strikes faced and survived, the boss, the Last Stand. */
export interface MatchFeats {
  /** Crowd and Classic: cuts faced while still in, and those survived (null when the match had none). */
  cuts: number | null;
  cutsSurvived: number | null;
  /** A boss battle (raid, or a 50 v 50 that ended in one): the boss's strikes faced while standing, and survived. */
  strikes: number | null;
  strikesSurvived: number | null;
  /** A boss battle: still standing at the end. */
  survived: boolean | null;
  /** A boss battle: the God King made his Last Stand. */
  lastStand: boolean | null;
  /** A boss raid: the boss's strength (one of BOSS_TIERS). */
  bossElo: number | null;
}

/**
 * A player's feats from the match's end state: `stages` is the number of cut stages before any ending
 * (knockoutsPerStage.length), `boss` the boss battle if there was one.
 */
export function matchFeats(p: Pick<PlayerState, "id" | "outInStage">, stages: number, boss: BossState | null | undefined, raid: boolean): MatchFeats {
  const out = p.outInStage;
  const cutOut = out !== null && out < stages;
  const cuts = stages > 0 ? (cutOut ? out + 1 : stages) : null;
  const cutsSurvived = stages > 0 ? (cutOut ? out : stages) : null;
  const reachedBoss = !!boss && !cutOut;
  let strikes: number | null = null;
  let strikesSurvived: number | null = null;
  if (boss && reachedBoss) {
    const at = boss.kills.findIndex((k) => k.id === p.id);
    strikes = at >= 0 ? at + 1 : boss.kills.length;
    strikesSurvived = at >= 0 ? at : boss.kills.length;
  }
  return {
    cuts,
    cutsSurvived,
    strikes,
    strikesSurvived,
    survived: reachedBoss && boss!.result ? !boss!.kills.some((k) => k.id === p.id) : null,
    lastStand: reachedBoss ? !!boss!.lastStand : null,
    bossElo: raid && boss ? boss.elo : null,
  };
}

/**
 * A match's best move for a player: a brilliant one if any, else the pick that beat the field by the most (the
 * highest round score); the later of equals. Null when they never picked.
 */
export function bestMoveOf(moves: readonly { san: string; move: string | null; roundScore: number; brilliant?: boolean }[]): string | null {
  let best: { san: string; score: number } | null = null;
  for (const m of moves) {
    if (!m.move) continue;
    const score = (m.brilliant ? 1e6 : 0) + m.roundScore;
    if (!best || score >= best.score) best = { san: m.san, score };
  }
  return best?.san ?? null;
}
