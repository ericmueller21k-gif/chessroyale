/**
 * Fair play's signals and suspicion score (pure; shared by the lobby server and the simulation). See DECISIONS.md,
 * "Fair play", and reports/fairplay.md for how the numbers were tuned.
 *
 * Everything here comes from the match's own judged numbers, as the lobby has them (the judges' or the engine
 * server's scores), never from numbers a browser makes up. The one exception is the look-away count (only the app
 * can see the page being hidden), which is weak evidence on its own: it can add a few points, never ban.
 *
 * For each human pick the lobby records a FairMove. A match's moves become a FairSummary (matchSignals): which
 * positions count, the strength they show (an engine rating over counted moves), how often they found moves the crowd
 * missed (measured against the other people picking in the same position), timing and look-aways, and points for each.
 * A player's recent summaries give their level (playerLevel): none, watch, review or ban.
 */
import { FAIRPLAY } from "./settings.ts";
import { lossForRating, ratingForLoss } from "./rating.ts";

/** One person's pick in one position, from the match's judged numbers. */
export interface FairMove {
  /** Plies played before this move from the starting position (0: White's first move). */
  ply: number;
  /** The position (FEN), the pick and the judged best move (UCI). Kept as evidence. */
  fen: string;
  move: string;
  best: string;
  /** Points the pick gave away against the best (the round's own loss). */
  loss: number;
  /** The mover's expected score after the best move (0-1). */
  bestExp: number;
  /** Position complexity: moves within FAIRPLAY.signals.nearPoints of the best, of those the judges scored. */
  near: number;
  /** Points the second-best scored move loses (null when only one move was scored). */
  gap: number | null;
  /** Other people picking in this position (not practising, no power-up), and how many of them found the best. */
  crowd: number;
  crowdFound: number;
  /** Thinking time (ms). */
  thinkMs: number;
  /** Look-aways during the move's clock, before the pick: the page hidden or the window unfocused (the app's count). */
  away: number;
  /** Used a power-up (saw the engine's top moves): never counted. */
  powerUp?: boolean;
  /** The best move takes on the square the last move landed on (a recapture, or taking a piece that just moved). */
  recapture?: boolean;
  /** Legal moves in the position. */
  legal: number;
}

export type SkipReason = "book" | "forced" | "only" | "recapture" | "decided" | "powerUp";

/** A settings group with its numbers widened (FAIRPLAY is `as const`), so tests and the simulation can try others. */
type Widen<T> = { [K in keyof T]: T[K] extends number ? number : T[K] };
export type FairSignals = Widen<typeof FAIRPLAY.signals>;
export type FairScore = Widen<typeof FAIRPLAY.score>;
export type FairLevels = Widen<typeof FAIRPLAY.levels>;
type Signals = FairSignals;
type Score = FairScore;
type Levels = FairLevels;

/** The share of the crowd that found the best move, or null without enough of a crowd. */
export function crowdRate(m: Pick<FairMove, "crowd" | "crowdFound">, s: Pick<Signals, "minCrowd"> = FAIRPLAY.signals): number | null {
  return m.crowd >= s.minCrowd ? m.crowdFound / m.crowd : null;
}

export const foundBest = (m: Pick<FairMove, "loss">, s: Pick<Signals, "foundLoss"> = FAIRPLAY.signals) => m.loss <= s.foundLoss;

/**
 * Why a position doesn't count, or null when it does. Skipped: the opening (book), a forced move, an only move or a
 * recapture that most of the crowd found (or with no crowd to say), a position already won or lost, and any pick made
 * with a power-up (the engine's top moves were on screen).
 */
export function skipReason(m: FairMove, s: Signals = FAIRPLAY.signals): SkipReason | null {
  if (m.powerUp) return "powerUp";
  if (m.ply < s.bookPlies) return "book";
  if (m.legal <= 1) return "forced";
  if (m.bestExp >= 1 - s.decided || m.bestExp <= s.decided) return "decided";
  const rate = crowdRate(m, s);
  const obvious = rate === null || rate >= s.obviousShare;
  if (obvious && m.gap !== null && m.gap >= s.onlyGap) return "only";
  if (obvious && m.recapture) return "recapture";
  return null;
}

/** Engine rating over counted moves' losses, pulled towards 1500 by `perfPriorMoves` (null with no moves). */
export function matchPerf(losses: readonly number[], s: Pick<Signals, "perfPriorMoves"> = FAIRPLAY.signals): number | null {
  if (!losses.length) return null;
  const prior = lossForRating(1500);
  return ratingForLoss((losses.reduce((a, b) => a + b, 0) + s.perfPriorMoves * prior) / (losses.length + s.perfPriorMoves));
}

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * How likely an honest player of strength `rating` is to find the best move in a position where `found` of `crowd`
 * others did: the crowd's rate (smoothed), shifted by how much stronger than the crowd they are.
 */
export function honestFindChance(crowd: number, found: number, rating: number, s: Pick<Signals, "hardSlope" | "crowdRating"> = FAIRPLAY.signals): number {
  const c = (found + 0.5) / (crowd + 1);
  return sigmoid(logit(c) + (s.hardSlope * (rating - s.crowdRating)) / 400);
}

/** Spearman rank correlation (average ranks for ties); null with fewer than 3 pairs or no spread. */
export function spearman(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length < 3) return null;
  const rank = (v: readonly number[]) => {
    const idx = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(v.length);
    for (let i = 0; i < idx.length; ) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++;
      for (let k = i; k <= j; k++) r[idx[k]![1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my);
    dx += (rx[i]! - mx) ** 2;
    dy += (ry[i]! - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

/** One player's fair-play summary of one match. */
export interface FairSummary {
  /** Picks made, and those that count (see skipReason). */
  moves: number;
  counted: number;
  /** Match strength: the engine rating over counted moves (null with none), and their average loss. */
  perf: number | null;
  avgLoss: number | null;
  /** Counted moves that found the best, and the longest run of them in a row. */
  found: number;
  topStreak: number;
  /** Hard positions (counted, with a crowd, which fewer than hardShare found), how many they found, the longest run. */
  hard: number;
  hardFinds: number;
  hardStreak: number;
  /** Evidence (log-likelihood) that they find moves the crowd misses like an engine user rather than an honest player. */
  hardEvidence: number;
  /** Hard finds made in under fastHardMs, and how think time followed difficulty (null without enough moves). */
  fastHard: number;
  timeCorr: number | null;
  /** Counted moves with a look-away during the clock, and how many of those found the best. */
  awayMoves: number;
  awayFound: number;
  /** The suspicion score and its parts. */
  score: number;
  parts: { perf: number; jump: number; hard: number; streak: number; time: number; away: number };
}

/**
 * A match's signals and score. `ref`: the player's own strength before this match (their history's median match
 * strength, or their rating), or null for someone new. The hard-find evidence measures against the higher of that and
 * this match's strength (up to strengthCap), so an honest strong player isn't flagged for finding what strong players
 * find.
 */
export function matchSignals(moves: readonly FairMove[], ref: number | null, s: Signals = FAIRPLAY.signals, sc: Score = FAIRPLAY.score): FairSummary {
  const counted = moves.filter((m) => skipReason(m, s) === null);
  const losses = counted.map((m) => m.loss);
  const perf = matchPerf(losses, s);
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : null;
  let found = 0;
  let run = 0;
  let topStreak = 0;
  let hard = 0;
  let hardFinds = 0;
  let hardRun = 0;
  let hardStreak = 0;
  let hardEvidence = 0;
  let fastHard = 0;
  let awayMoves = 0;
  let awayFound = 0;
  const strength = Math.min(s.strengthCap, Math.max(ref ?? s.crowdRating, perf ?? s.crowdRating));
  const times: number[] = [];
  const difficulty: number[] = [];
  for (const m of counted) {
    const f = foundBest(m, s);
    if (f) found++;
    run = f ? run + 1 : 0;
    topStreak = Math.max(topStreak, run);
    if (m.away > 0) {
      awayMoves++;
      if (f) awayFound++;
    }
    const rate = crowdRate(m, s);
    if (rate === null) continue;
    times.push(m.thinkMs);
    difficulty.push(1 - rate);
    // Evidence: a find where an honest player of this strength usually misses (p) points to an engine user, who finds
    // it at least cheatFind of the time (q); a miss points the other way.
    const p = honestFindChance(m.crowd, m.crowdFound, strength, s);
    const q = Math.max(p, s.cheatFind);
    hardEvidence += f ? Math.log(q / p) : Math.log((1 - q) / (1 - p));
    if (rate < s.hardShare) {
      hard++;
      if (f) {
        hardFinds++;
        if (m.thinkMs < s.fastHardMs) fastHard++;
      }
      hardRun = f ? hardRun + 1 : 0;
      hardStreak = Math.max(hardStreak, hardRun);
    }
  }
  const timeCorr = times.length >= s.minTimed ? spearman(times, difficulty) : null;
  const enough = counted.length >= sc.minCounted;
  const parts = {
    perf: enough && perf !== null ? clamp((perf - sc.perfFrom) / sc.perfPer, 0, sc.perfMax) : 0,
    jump: enough && perf !== null && ref !== null && perf - ref >= sc.jumpFrom ? clamp(1 + (perf - ref - sc.jumpFrom) / sc.jumpPer, 0, sc.jumpMax) : 0,
    hard: clamp(hardEvidence * sc.hardPer, 0, sc.hardMax),
    streak: topStreak >= sc.streakFrom ? clamp((topStreak - sc.streakFrom + 1) * sc.streakPer, 0, sc.streakMax) : 0,
    time: clamp(Math.max(0, fastHard - 1) * sc.fastPer, 0, sc.fastMax) + (timeCorr !== null && timeCorr < s.flatCorr ? sc.flat : 0),
    away: awayMoves >= sc.awayMoves && awayFound / awayMoves >= sc.awayRate && awayFound / awayMoves - (found - awayFound) / Math.max(1, counted.length - awayMoves) >= sc.awayLift ? sc.away : 0,
  };
  const score = round2(parts.perf + parts.jump + parts.hard + parts.streak + parts.time + parts.away);
  return {
    moves: moves.length,
    counted: counted.length,
    perf,
    avgLoss: avgLoss === null ? null : round2(avgLoss),
    found,
    topStreak,
    hard,
    hardFinds,
    hardStreak,
    hardEvidence: round2(hardEvidence),
    fastHard,
    timeCorr: timeCorr === null ? null : round2(timeCorr),
    awayMoves,
    awayFound,
    score,
    parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, round2(v)])) as FairSummary["parts"],
  };
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const round2 = (x: number) => Math.round(x * 100) / 100;

/** A player's own strength before a match: the median of their recent match strengths (3 or more), else their rating. */
export function referenceStrength(history: readonly (number | null)[], rating: number | null): number | null {
  const xs = history.filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  if (xs.length >= 3) return xs[Math.floor(xs.length / 2)]!;
  return rating;
}

export type FairLevel = "none" | "watch" | "review" | "ban";

/** What a player's recent matches say, and why (one line per reason, for the case's log). */
export interface LevelVerdict {
  level: FairLevel;
  reasons: string[];
}

/**
 * A player's level from their recent match summaries (any order; only `at` within the window counts, at most
 * windowMatches of the newest). Ban needs overwhelming evidence: super-GM strength over two matches with a high score,
 * or one match past every bar.
 */
export function playerLevel(
  matches: readonly (Pick<FairSummary, "score" | "perf" | "counted"> & { at: number })[],
  now: number,
  lv: Levels = FAIRPLAY.levels,
): LevelVerdict {
  const recent = matches
    .filter((m) => m.at > now - lv.windowDays * 86_400_000)
    .sort((a, b) => b.at - a.at)
    .slice(0, lv.windowMatches);
  const scores = recent.map((m) => m.score).sort((a, b) => b - a);
  const top1 = scores[0] ?? 0;
  const top2 = top1 + (scores[1] ?? 0);
  const strong = recent.filter((m) => (m.perf ?? 0) >= lv.banPerf && m.counted >= lv.banCounted && m.score >= lv.banScore);
  const one = recent.find((m) => (m.perf ?? 0) >= lv.banOnePerf && m.counted >= lv.banOneCounted && m.score >= lv.banOneScore);
  if (strong.length >= lv.banMatches)
    return { level: "ban", reasons: [`${strong.length} matches at strength ${strong.map((m) => m.perf).join(", ")} with scores ${strong.map((m) => m.score).join(", ")}`] };
  if (one) return { level: "ban", reasons: [`one match at strength ${one.perf} on ${one.counted} counted moves, score ${one.score}`] };
  if (top1 >= lv.reviewOne) return { level: "review", reasons: [`a match scored ${top1}`] };
  if (top2 >= lv.reviewTwo) return { level: "review", reasons: [`two matches scored ${scores[0]} and ${scores[1]}`] };
  if (top1 >= lv.watch) return { level: "watch", reasons: [`a match scored ${top1}`] };
  return { level: "none", reasons: [] };
}
