import { PRIOR_RATING } from "./rating.ts";
import type { Settings } from "./settings.ts";

/**
 * Boss battle: the last 10 team up against Stockfish. The boss's strength comes
 * from the crowd's own ratings, weighted towards the best players (it should
 * feel like a real fight to them, and like a wall to the weakest), plus an
 * offset because a crowd voting together plays better than its average member.
 */
export function bossElo(ratings: readonly (number | null)[], s: Pick<Settings, "bossEloOffset" | "bossEloRange">): number {
  const rs = ratings.map((r) => r ?? PRIOR_RATING).sort((a, b) => b - a);
  if (!rs.length) return s.bossEloRange[0];
  // The best gets weight n, the next n-1, ... the weakest 1.
  let sum = 0;
  let weights = 0;
  rs.forEach((r, i) => {
    const w = rs.length - i;
    sum += w * r;
    weights += w;
  });
  const elo = Math.round(sum / weights + s.bossEloOffset);
  return Math.max(s.bossEloRange[0], Math.min(s.bossEloRange[1], elo));
}

/**
 * Stockfish can't play weaker than UCI_Elo 1320, and even a boss set a little
 * below a weaker crowd's rating beat it nearly every time in calibration (see
 * reports/boss-calibration.md). Below bossStumbleBelow the
 * boss "stumbles" now and then instead: it plays a random legal move.
 */
export function bossStumbleChance(elo: number, s: Pick<Settings, "bossStumbleBelow" | "bossStumbleMax">): number {
  return Math.max(0, Math.min(s.bossStumbleMax, (s.bossStumbleBelow - elo) / 1000));
}

/**
 * Where the boss battle starts: a position from the game just played, with
 * White (the crowd) to move, between moves 5 and 12. It should be roughly even
 * and never better for the boss: White's expected score 0.50-0.60 if possible
 * (the one nearest move 8), else the closest to even that still favours White,
 * else the starting position. `evals[k]` is the side to move's expected score
 * after k plies.
 */
export function bossStartPly(evals: readonly number[], plies: number): number {
  const candidates = [];
  for (let k = 10; k <= Math.min(24, plies); k += 2) if (evals[k] !== undefined) candidates.push({ k, white: evals[k]! });
  const even = candidates.filter((c) => c.white >= 0.5 && c.white <= 0.6).sort((a, b) => Math.abs(a.k - 16) - Math.abs(b.k - 16));
  if (even.length) return even[0]!.k;
  const ahead = candidates.filter((c) => c.white > 0.6).sort((a, b) => a.white - b.white);
  if (ahead.length) return ahead[0]!.k;
  return 0;
}

/** Boss raid: the strengths a boss comes in (Stockfish UCI_Elo), one per boss. */
export const BOSS_TIERS: readonly number[] = [1400, 1700, 2000, 2300, 2600, 2900];

/** Boss raid: the weakest boss that's stronger than the lobby's average rating (the strongest if none is). */
export function raidBossElo(ratings: readonly (number | null)[]): number {
  const rs = ratings.map((r) => r ?? PRIOR_RATING);
  const avg = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : PRIOR_RATING;
  return BOSS_TIERS.find((t) => t > avg) ?? BOSS_TIERS[BOSS_TIERS.length - 1]!;
}

export interface BossInfo {
  name: string;
  icon: string;
  /** 1 to 5 skulls: how scary it is, without giving away the number. */
  threat: number;
}

const BOSSES: { below: number; name: string; icon: string }[] = [
  { below: 1500, name: "The Pawn Golem", icon: "🗿" },
  { below: 1800, name: "The Iron Bishop", icon: "🤖" },
  { below: 2100, name: "The Black Knight", icon: "🐴" },
  { below: 2400, name: "The Tower Tyrant", icon: "🏰" },
  { below: 2700, name: "The Grandmaster Wraith", icon: "👻" },
  { below: Infinity, name: "The Engine Eternal", icon: "👹" },
];

/** The boss's name, look and threat level for a strength (the Elo itself stays secret). */
export function bossInfo(elo: number): BossInfo {
  const i = BOSSES.findIndex((b) => elo < b.below);
  const b = BOSSES[i]!;
  return { name: b.name, icon: b.icon, threat: Math.max(1, Math.min(5, i)) };
}
