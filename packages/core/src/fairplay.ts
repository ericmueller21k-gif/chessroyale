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
 * A player's recent summaries give their level (playerLevel): none, watch, review or ban. A flagged player's counted
 * moves are searched again later on the engine server (the deep re-check); a ban needs that confirmation.
 */
import { FAIRPLAY } from "./settings.ts";
import { lossForRating, ratingForLoss } from "./rating.ts";

/** Where a banned player writes for more information (Eric, Nov 13): appeals come by email and a person answers them. */
export const SUPPORT_EMAIL = "support@hunchess.com";
/**
 * The one line a banned account sees (Eric, Nov 13: "Your account has been banned. For more information, email support."): on the ban
 * screen (the address a mailto link), in every answer the server gives a banned session or sign-in, and in the ban email.
 * docs/decisions/2026-11-13-ban-blocks-sign-in.md.
 */
export const BANNED_LINE = `Your account has been banned. For more information, email ${SUPPORT_EMAIL}.`;

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
  /** Other people picking in this position (not practicing, no power-up), and how many of them found the best. */
  crowd: number;
  crowdFound: number;
  /**
   * What those others picked (UCI move → how many; the most picked few), so the crowd's rate for any move can be read
   * later: the deep re-check's best, say.
   */
  picks?: Record<string, number>;
  /** Thinking time (ms). */
  thinkMs: number;
  /** Look-aways during the move's clock, before the pick: the page hidden or the window unfocused (the app's count). */
  away: number;
  /**
   * A premove (chess.com's: made ahead, and played as the turn opened), as the server saw it: told to the server before
   * any browser could know the position it's played in, then played at once (the lobby's premoveAhead). Its time
   * measures no thinking, so it's left out of timing; everything else counts it as any pick.
   */
  premove?: boolean;
  /** Used a power-up (saw the engine's top moves): never counted. */
  powerUp?: boolean;
  /**
   * Played with a Stockfish token (Squads' Mercenary mode: sanctioned engine help, bought in the shop; the squad's
   * `assists` log says which moves): never counted, nor part of anyone's crowd, so an honest player is never flagged
   * for the engine moves the game itself showed them.
   */
  engineToken?: boolean;
  /** A boss power touched the turn (a frozen piece, a pie, the blizzard, a flipped board): never counted. */
  power?: boolean;
  /** The best move takes on the square the last move landed on (a recapture, or taking a piece that just moved). */
  recapture?: boolean;
  /** Legal moves in the position. */
  legal: number;
  /** The judges' best moves, best first (up to FAIRPLAY.deep.candidates): evidence for a person (the deep re-check searches every legal move). */
  top?: string[];
  /**
   * The deep re-check (on the engine server, afterwards): its best of the candidates, where the pick ranked among them
   * (1 = its best), what the pick gave away by its numbers, and its top 3.
   */
  deep?: { best: string; rank: number; loss: number; top?: string[] };
}

/**
 * Whether a deep-checked pick counts as the engine's best (Eric, Nov 11; docs/decisions/2026-11-11-near-best.md): its rank is 1,
 * or it gives away at most FAIRPLAY.deep.nearBestLoss points by the deep search's own numbers. Two strong engines often prefer
 * different, practically equal moves, so an exact match undercounts every engine user whose engine isn't ours.
 */
export const nearBest = (d: Pick<NonNullable<FairMove["deep"]>, "rank" | "loss">, near: number = FAIRPLAY.deep.nearBestLoss): boolean => d.rank === 1 || d.loss <= near;

export type SkipReason = "book" | "forced" | "only" | "recapture" | "decided" | "powerUp" | "engineToken" | "bossPower";

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
 * with the engine's moves on screen that the game showed: a power-up, or a Stockfish token (Squads' Mercenary).
 */
export function skipReason(m: FairMove, s: Signals = FAIRPLAY.signals): SkipReason | null {
  if (m.powerUp) return "powerUp";
  if (m.engineToken) return "engineToken";
  if (m.power) return "bossPower";
  if (m.ply < s.bookPlies) return "book";
  if (m.legal <= 1) return "forced";
  if (m.bestExp >= 1 - s.decided || m.bestExp <= s.decided) return "decided";
  const rate = crowdRate(m, s);
  const obvious = rate === null || rate >= s.obviousShare;
  if (obvious && m.gap !== null && m.gap >= s.onlyGap) return "only";
  if (obvious && m.recapture) return "recapture";
  return null;
}

/** Engine rating over counted moves' losses, pulled toward 1500 by `perfPriorMoves` (null with no moves). */
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

/**
 * An honest player's chance of picking the best move: from the crowd's rate for that move (c: how many of the others
 * picked it, smoothed) and the player's strength R, logit(p) = (g0 + g1 Δ) logit(c) + d0 + d1 Δ with Δ = (R − 1500) /
 * 400 (a stronger player leans less on what the crowd sees), never below a floor, logit = f0 + f1 Δ (the model is
 * [g0, g1, d0, d1, f0, f1]). Without a crowd: logit(p) = a + b Δ. All fitted on the simulation's honest players
 * (reports/fairplay.md), one set for the judges' best and one for the deep re-check's.
 */
export function honestChance(crowd: number, found: number, rating: number, model: readonly number[], solo: readonly number[], s: Pick<Signals, "minCrowd"> = FAIRPLAY.signals): number {
  const d = (rating - 1500) / 400;
  if (crowd < s.minCrowd) return sigmoid(solo[0]! + solo[1]! * d);
  const c = (found + 0.5) / (crowd + 1);
  const p = sigmoid((model[0]! + model[1]! * d) * logit(c) + model[2]! + model[3]! * d);
  // A floor: even where almost nobody in the crowd found it, a strong player sometimes does (logit = f0 + f1 Δ).
  return model.length >= 6 ? Math.max(p, sigmoid(model[4]! + model[5]! * d)) : p;
}

/**
 * One counted pick's evidence: the log-likelihood that an engine user made it rather than an honest player of strength
 * `rating`.
 *   - Checked by the deep re-check: was the pick its best, one of its next two or near its best (nearBest, within `near` points:
 *     Nov 11), or neither? An honest player's chances come from the crowd in that position (how many of them picked its best, its
 *     top 3: honestChance, fitted on its best alone, so a near-best pick is never "its best" here), an engine user's are cheatDeep
 *     (its own engine can differ from ours, so its pick is sometimes our second or third, or another practically equal move).
 *   - Not checked: was the pick within foundLoss of the judges' best? An engine user does that at least cheatFind of
 *     the time.
 * A best move the crowd missed is strong evidence; a pick outside the engine's top 3 and not near its best counts strongly the
 * other way.
 */
export function moveEvidence(m: FairMove, rating: number, s: Signals = FAIRPLAY.signals, near: number = FAIRPLAY.deep.nearBestLoss): { outcome: number; honest: number[]; evidence: number } {
  const clampP = (p: number) => Math.min(0.98, Math.max(0.02, p));
  if (m.deep) {
    const top = m.deep.top ?? [m.deep.best];
    const outcome = m.deep.rank === 1 ? 0 : m.deep.rank <= 3 || nearBest(m.deep, near) ? 1 : 2;
    // (Older records without the crowd's picks: its count for the judges' best stands in for that move.)
    const count = (x: string) => (m.picks ? (m.picks[x] ?? 0) : x === m.best ? m.crowdFound : 0);
    const share = (moves: readonly string[]) => Math.min(m.crowd, moves.reduce((t, x) => t + count(x), 0));
    const p1 = clampP(honestChance(m.crowd, share(top.slice(0, 1)), rating, s.findDeep, s.soloDeep, s));
    // (Outcome 1 is "its next two or near its best": a near-best pick outside its top 3 adds the crowd on that pick, else a move most of
    // the crowd played reads as engine evidence. The review of #629, M1.)
    const top3 = top.slice(0, 3);
    const second = outcome === 1 && !top3.includes(m.move) ? [...top3, m.move] : top3;
    const p3 = Math.max(p1 + 0.02, clampP(honestChance(m.crowd, share(second), rating, s.findDeep3, s.soloDeep3, s)));
    const honest = [p1, p3 - p1, Math.max(0.01, 1 - p3)];
    // An engine user finds our best at least as often as an honest player would; its other chances keep their shape.
    const q0 = Math.max(s.cheatDeep[0], p1);
    const rest = s.cheatDeep[1] + s.cheatDeep[2];
    const cheat = [q0, (s.cheatDeep[1] * (1 - q0)) / rest, (s.cheatDeep[2] * (1 - q0)) / rest];
    return { outcome, honest, evidence: Math.log(cheat[outcome]! / honest[outcome]!) };
  }
  const event = m.loss <= s.foundLoss;
  const honest = clampP(honestChance(m.crowd, m.crowdFound, rating, s.findJudge, s.soloFound, s));
  const q = Math.max(honest, s.cheatFind);
  return { outcome: event ? 0 : 1, honest: [honest, 1 - honest], evidence: event ? Math.log(q / honest) : Math.log((1 - q) / (1 - honest)) };
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
  /**
   * Evidence (a log-likelihood, over counted moves) that the picks are an engine user's rather than an honest player's
   * of their own strength (moveEvidence): positive points to an engine.
   */
  evidence: number;
  /** Hard finds made in under fastHardMs, and how think time followed difficulty (null without enough moves). */
  fastHard: number;
  timeCorr: number | null;
  /** Counted moves with a look-away during the clock, and how many of those found the best. */
  awayMoves: number;
  awayFound: number;
  /**
   * The deep re-check: counted moves checked; picks at or near its best (a "deep match": nearBest, which the ban bars read); picks
   * that were its very best (rank 1; a summary without it predates the near-best count, Nov 11); in its top 3; its average loss.
   */
  deepChecked: number;
  deepMatch: number;
  deepExact: number;
  deepTop3: number;
  deepLoss: number | null;
  /** The suspicion score and its parts. */
  score: number;
  parts: { perf: number; jump: number; evidence: number; streak: number; time: number; away: number };
}

/**
 * A match's signals and score. `ref`: the player's own strength before this match (their history's median match
 * strength, or their rating), or null for someone new. The hard-find evidence measures against the higher of that and
 * this match's strength (up to strengthCap), so an honest strong player isn't flagged for finding what strong players
 * find.
 */
export function matchSignals(
  moves: readonly FairMove[],
  ref: number | null,
  s: Signals = FAIRPLAY.signals,
  sc: Score = FAIRPLAY.score,
  near: number = FAIRPLAY.deep.nearBestLoss,
): FairSummary {
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
  let evidence = 0;
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
    evidence += moveEvidence(m, strength, s, near).evidence;
    const rate = crowdRate(m, s);
    if (rate === null) continue;
    // (A premove's time measures no thinking: it's left out of timing, and counts for everything else.)
    if (!m.premove) {
      times.push(m.thinkMs);
      difficulty.push(1 - rate);
    }
    if (rate < s.hardShare) {
      hard++;
      if (f) {
        hardFinds++;
        if (!m.premove && m.thinkMs < s.fastHardMs) fastHard++;
      }
      hardRun = f ? hardRun + 1 : 0;
      hardStreak = Math.max(hardStreak, hardRun);
    }
  }
  const timeCorr = times.length >= s.minTimed ? spearman(times, difficulty) : null;
  const checked = counted.filter((m) => m.deep);
  const deepMatch = checked.filter((m) => nearBest(m.deep!, near)).length;
  const deepExact = checked.filter((m) => m.deep!.rank === 1).length;
  const deepTop3 = checked.filter((m) => m.deep!.rank <= 3).length;
  const deepLoss = checked.length ? checked.reduce((a, m) => a + m.deep!.loss, 0) / checked.length : null;
  const enough = counted.length >= sc.minCounted;
  const parts = {
    perf: enough && perf !== null ? clamp((perf - sc.perfFrom) / sc.perfPer, 0, sc.perfMax) : 0,
    jump: enough && perf !== null && ref !== null && perf - ref >= sc.jumpFrom ? clamp(1 + (perf - ref - sc.jumpFrom) / sc.jumpPer, 0, sc.jumpMax) : 0,
    evidence: clamp(evidence * sc.evidencePer, 0, sc.evidenceMax),
    streak: topStreak >= sc.streakFrom ? clamp((topStreak - sc.streakFrom + 1) * sc.streakPer, 0, sc.streakMax) : 0,
    time: clamp(Math.max(0, fastHard - 1) * sc.fastPer, 0, sc.fastMax) + (timeCorr !== null && timeCorr < s.flatCorr ? sc.flat : 0),
    away: awayMoves >= sc.awayMoves && awayFound / awayMoves >= sc.awayRate && awayFound / awayMoves - (found - awayFound) / Math.max(1, counted.length - awayMoves) >= sc.awayLift ? sc.away : 0,
  };
  const score = round2(parts.perf + parts.jump + parts.evidence + parts.streak + parts.time + parts.away);
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
    evidence: round2(evidence),
    fastHard,
    timeCorr: timeCorr === null ? null : round2(timeCorr),
    awayMoves,
    awayFound,
    deepChecked: checked.length,
    deepMatch,
    deepExact,
    deepTop3,
    deepLoss: deepLoss === null ? null : round2(deepLoss),
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
  /**
   * "strength": the ban level from sustained strength alone, which rests on the judges' numbers with no deep re-check, so it pools or
   * opens a review but never bans (the review of #629, m1: the server's actOn).
   */
  path?: "strength";
}

/** What playerLevel reads from each match (older summaries without the deep fields count as unchecked). */
export type LevelInput = Pick<FairSummary, "score" | "perf" | "counted"> & Partial<Pick<FairSummary, "deepChecked" | "deepMatch" | "evidence">> & { at: number };

/**
 * A player's level from their recent match summaries (any order; only `at` within the window counts, at most
 * windowMatches of the newest). Ban needs overwhelming evidence confirmed by the deep re-check: super-GM strength
 * and engine-like moves over two matches with high scores, or one match past every bar; or a strength no honest player keeps
 * up over several matches (sustainedStrength: `path` "strength", never a ban on its own).
 */
export function playerLevel(matches: readonly LevelInput[], now: number, lv: Levels = FAIRPLAY.levels): LevelVerdict {
  const recent = matches
    .filter((m) => m.at > now - lv.windowDays * 86_400_000)
    .sort((a, b) => b.at - a.at)
    .slice(0, lv.windowMatches);
  const scores = recent.map((m) => m.score).sort((a, b) => b - a);
  const top1 = scores[0] ?? 0;
  const top2 = top1 + (scores[1] ?? 0);
  // The ban: from deep-checked matches only, each with enough moves checked to mean something.
  const checked = recent.filter((m) => (m.deepChecked ?? 0) >= lv.banMatchChecked);
  const sum = (f: (m: LevelInput) => number, ms = checked) => ms.reduce((t, m) => t + f(m), 0);
  const evidence = sum((m) => m.evidence ?? 0);
  const deepChecked = sum((m) => m.deepChecked ?? 0);
  const deepShare = deepChecked ? sum((m) => m.deepMatch ?? 0) / deepChecked : 0;
  const bestPerf = Math.max(0, ...checked.map((m) => m.perf ?? 0));
  const r1 = (x: number) => Math.round(x * 10) / 10;
  if (checked.length >= lv.banMatches && evidence >= lv.banEvidence && deepChecked >= lv.banDeepChecked && deepShare >= lv.banDeep && bestPerf >= lv.banPerf) {
    return {
      level: "ban",
      reasons: [`${checked.length} deep-checked matches: evidence ${r1(evidence)}, ${Math.round(deepShare * 100)}% of ${deepChecked} moves near the engine's best, best strength ${bestPerf}`],
    };
  }
  const one = checked.find((m) => atBanBar(m, lv));
  if (one) return { level: "ban", reasons: [`one match: evidence ${r1(one.evidence ?? 0)}, ${one.deepMatch}/${one.deepChecked} moves near the engine's best, strength ${one.perf}`] };
  const strong = sustainedStrength(recent, lv);
  if (strong !== null) return { level: "ban", path: "strength", reasons: [`strength: ${strong.toLocaleString("en-US")} average over ${lv.poolStrengthMatches} matches`] };
  if (top1 >= lv.reviewOne) return { level: "review", reasons: [`a match scored ${top1}`] };
  if (top2 >= lv.reviewTwo) return { level: "review", reasons: [`two matches scored ${scores[0]} and ${scores[1]}`] };
  if (top1 >= lv.watch) return { level: "watch", reasons: [`a match scored ${top1}`] };
  return { level: "none", reasons: [] };
}

/**
 * Sustained strength (Eric, Nov 11): the average match strength of the newest `poolStrengthMatches` matches with `poolStrengthCounted`
 * counted moves or more each (`matches` newest first, already in the window), when there are that many and it reaches `poolStrength`;
 * else null. Catches an engine user who plays its second or third choice, whose top-move share stays low.
 */
export function sustainedStrength(matches: readonly Pick<LevelInput, "perf" | "counted">[], lv: Levels = FAIRPLAY.levels): number | null {
  const n = lv.poolStrengthMatches;
  const enough = matches.filter((m) => m.counted >= lv.poolStrengthCounted && m.perf !== null).slice(0, n);
  if (n < 1 || enough.length < n) return null;
  const avg = Math.round(enough.reduce((t, m) => t + m.perf!, 0) / n);
  return avg >= lv.poolStrength ? avg : null;
}

/**
 * One match at the one-match ban bar (every `banOne*` bar, the deep re-check's numbers included): near-perfect engine play on its
 * own. Read by playerLevel and by the engine pool's new-account rule.
 */
export function atBanBar(m: Omit<LevelInput, "at">, lv: Levels = FAIRPLAY.levels): boolean {
  const checked = m.deepChecked ?? 0;
  return checked >= lv.banMatchChecked && (m.evidence ?? 0) >= lv.banOneEvidence && checked >= lv.banOneDeepChecked && (m.deepMatch ?? 0) / checked >= lv.banOneDeep && (m.perf ?? 0) >= lv.banOnePerf;
}

/**
 * The engine pool's new-account rule (Eric, Nov 10: "if 2 out of the first 3 games they play are just like straight stockfish" … "for
 * the first 10 games"): of an account's first `pool.newGames` fair-play matches (`first`, oldest first, every one), those that count
 * (`counts`: played after the case's last decision, which weighed the rest) at the one-match ban bar. `pool.newHits` or more: the
 * reason to pool it; else null.
 */
export function newAccountPool(
  first: readonly (Omit<LevelInput, "at"> & { counts: boolean })[],
  pool: { newGames: number; newHits: number } = FAIRPLAY.pool,
  lv: Levels = FAIRPLAY.levels,
): string | null {
  const hits = first.slice(0, pool.newGames).filter((m) => m.counts && atBanBar(m, lv)).length;
  return hits >= pool.newHits ? `new account: ${hits} of its first ${Math.min(first.length, pool.newGames)} matches at the one-match ban bar` : null;
}
