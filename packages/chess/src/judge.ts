/**
 * Many judges: a board's scoring job as players' devices do it online, and how the lobby checks their answers.
 *
 * A job is a position, the people's picks (moves only: no names or ids) and the bots picking there. A judge runs
 * the same searches the host always ran (the top moves, then one search over any pick outside them, and with no
 * engine server, the re-check of close calls) and sends back the engines' raw numbers: a JudgeReport. Everything
 * else (the bots' picks, the best move, each pick's score) is worked out from the report by the same pure code on
 * the device and in the lobby (judgedBoard), so the lobby can check a report on its own, and two honest devices'
 * reports are identical (the browser engine is deterministic: reports/judge-determinism.md).
 */
import { DEFAULT_SETTINGS, botChoose, mulberry32 } from "@chessroyale/core";
import { legalMoves } from "./rules.ts";
import type { MoveScore } from "./uci.ts";
import { applyRecheck, recheckTargets, repliesFrom, type EngineLike, type RecheckSettings } from "./runner.ts";

/** The lobby's rules for the bots' picks (so every judge picks for them exactly as the lobby would). */
export interface JudgeRules {
  botCandidateMoves: number;
  botRandomMoveChance: number;
  botPowerUpLoss: number;
}

export interface JudgeJob {
  /** Opaque: which job this is (the lobby maps it back to a board). */
  id: string;
  fen: string;
  /** The people's picks, sorted, a move once per player who picked it (misses left out). */
  picks: string[];
  /** The bots picking on this board, in a fixed order: their picks come from `seed`. */
  bots: { skill: number; powerUps: number }[];
  seed: number;
  rules: JudgeRules;
  /** Boss battle, the re-pick after the God King's Last Stand: the move he took back (no option, not the best). */
  barred?: string;
  /** No engine server: the device re-checks close calls itself, with these settings, `priority` moves first. */
  recheck?: RecheckSettings;
  priority?: string[];
}

/** A judge's answer: the engines' raw output for the job. */
export interface JudgeReport {
  /** The top-moves search (MultiPV botCandidateMoves at engineNodes). */
  top: MoveScore[];
  /** One search over the picks (people's and bots') outside the top moves. */
  extra: MoveScore[];
  /** The re-check's deep search, when the job asked for one and there were close calls. */
  deep?: MoveScore[];
}

/** A board's scores as worked out from a report (or the engine server's verdict). */
export interface JudgedBoard {
  bestMove: string;
  bestExpected: number;
  expectedAfter: Record<string, number>;
  /** Each bot's pick (in the job's order), and which of them used a power-up. */
  botPicks: string[];
  botPowerUps: number[];
  replies: Record<string, string>;
  mates: Record<string, number>;
  rechecked: string[];
}

/** The top moves the job may use (never the barred move, unless it's the only one). */
export function judgeTop(job: Pick<JudgeJob, "barred">, top: readonly MoveScore[]): MoveScore[] {
  return job.barred && top.some((m) => m.move !== job.barred) ? top.filter((m) => m.move !== job.barred) : [...top];
}

/** The bots' picks, from the top moves and the job's seed: the same on every device and in the lobby. */
export function judgeBotPicks(job: JudgeJob, top: readonly MoveScore[]): { picks: string[]; powerUps: number[] } {
  const t = judgeTop(job, top);
  const best = t[0]?.expected ?? 0.5;
  const candidates = t.map((m) => ({ move: m.move, loss: Math.max(0, (best - m.expected) * 100) }));
  const legal = legalMoves(job.fen).filter((m) => m !== job.barred);
  const rng = mulberry32(job.seed);
  const settings = { ...DEFAULT_SETTINGS, ...job.rules };
  const picks: string[] = [];
  const powerUps: number[] = [];
  job.bots.forEach((b, i) => {
    const choice = botChoose(rng, candidates, { skill: b.skill, powerUps: b.powerUps }, legal, settings);
    picks.push(choice.move);
    if (choice.usedPowerUp) powerUps.push(i);
  });
  return { picks, powerUps };
}

/** Picks outside the top moves (each once, sorted): the second search. */
function outsideTop(top: readonly MoveScore[], moves: readonly string[]): string[] {
  const have = new Set(top.map((m) => m.move));
  return [...new Set(moves.filter((m) => !have.has(m)))].sort();
}

/** What a device does with a job. `top`: the top-moves search if it already ran (prefetched while players thought). */
export async function runJudgeJob(engine: EngineLike, job: JudgeJob, top?: Promise<MoveScore[]> | MoveScore[]): Promise<JudgeReport> {
  const all = await (top ?? engine.topMoves(job.fen, job.rules.botCandidateMoves));
  const bots = judgeBotPicks(job, all);
  const missing = outsideTop(all, [...job.picks, ...bots.picks]);
  const extra = missing.length ? await engine.scoreMoves(job.fen, missing) : [];
  const report: JudgeReport = { top: all, extra };
  if (job.recheck && engine.scoreMovesAt) {
    const base = baseBoard(job, report, bots);
    if (base) {
      const flagged = recheckTargets(base, [...job.picks, ...bots.picks], job.recheck, job.priority);
      if (flagged.length) report.deep = await engine.scoreMovesAt(job.fen, [base.bestMove, ...flagged], job.recheck.recheckNodes);
    }
  }
  return report;
}

const okScore = (m: MoveScore | undefined, legal: ReadonlySet<string>) =>
  !!m && typeof m.move === "string" && legal.has(m.move) && typeof m.expected === "number" && Number.isFinite(m.expected) && m.expected >= 0 && m.expected <= 1;

/** The board before any re-check; null if the report doesn't hold together. */
function baseBoard(job: JudgeJob, report: JudgeReport, bots: { picks: string[]; powerUps: number[] }): JudgedBoard | null {
  const legal = new Set(legalMoves(job.fen));
  if (!Array.isArray(report.top) || !Array.isArray(report.extra) || !report.top.length) return null;
  if (report.top.length > job.rules.botCandidateMoves) return null;
  if (![...report.top, ...report.extra].every((m) => okScore(m, legal))) return null;
  const top = judgeTop(job, report.top);
  const expectedAfter: Record<string, number> = Object.fromEntries(top.map((m) => [m.move, m.expected]));
  for (const m of report.extra) if (expectedAfter[m.move] === undefined) expectedAfter[m.move] = m.expected;
  // Every pick (people's and bots') must be scored.
  if (![...job.picks, ...bots.picks].every((m) => expectedAfter[m] !== undefined)) return null;
  const { replies, mates } = repliesFrom([top, report.extra]);
  return { bestMove: top[0]!.move, bestExpected: top[0]!.expected, expectedAfter, botPicks: bots.picks, botPowerUps: bots.powerUps, replies, mates, rechecked: [] };
}

/**
 * A board's scores from a judge's report, exactly as the device itself worked them out; null if the report doesn't
 * hold together (moves that aren't legal, numbers out of range, a pick left unscored, a re-check missing or wrong).
 * `recheck`: whether the device was asked to re-check (the job says so).
 */
export function judgedBoard(job: JudgeJob, report: JudgeReport): JudgedBoard | null {
  if (!report || typeof report !== "object") return null;
  const bots = Array.isArray(report.top) && report.top.length ? judgeBotPicks(job, report.top) : null;
  const base = bots && baseBoard(job, report, bots);
  if (!base) return null;
  if (!job.recheck) return base;
  const flagged = recheckTargets(base, [...job.picks, ...base.botPicks], job.recheck, job.priority);
  if (!flagged.length) return base;
  const legal = new Set(legalMoves(job.fen));
  if (!Array.isArray(report.deep) || !report.deep.every((m) => okScore(m, legal))) return null;
  // (A deep search that left the best move out changes nothing, as on the device: applyRecheck keeps the numbers.)
  const checked = applyRecheck(base, flagged, report.deep);
  return { ...base, bestMove: checked.bestMove, bestExpected: checked.bestExpected, expectedAfter: checked.expectedAfter, rechecked: checked.rechecked };
}

/** Two judges' boards agree: the same best move and bot picks, and every score within `tolerance` (expected score). */
export function boardsAgree(a: JudgedBoard, b: JudgedBoard, tolerance = 0): { agree: boolean; diff: number } {
  const keys = new Set([...Object.keys(a.expectedAfter), ...Object.keys(b.expectedAfter)]);
  let diff = Math.abs(a.bestExpected - b.bestExpected);
  for (const k of keys) {
    const x = a.expectedAfter[k];
    const y = b.expectedAfter[k];
    diff = Math.max(diff, x === undefined || y === undefined ? 1 : Math.abs(x - y));
  }
  const same =
    a.bestMove === b.bestMove &&
    a.botPicks.length === b.botPicks.length &&
    a.botPicks.every((m, i) => m === b.botPicks[i]) &&
    a.botPowerUps.join() === b.botPowerUps.join();
  return { agree: same && diff <= tolerance + 1e-12, diff };
}

/** Every move the engine server should score to settle a disagreement: everything either judge scored, and every pick. */
export function verdictMoves(job: JudgeJob, reports: readonly (JudgeReport | null)[], boards: readonly (JudgedBoard | null)[]): string[] {
  const legal = new Set(legalMoves(job.fen));
  const moves = new Set<string>(job.picks);
  for (const r of reports) for (const m of [...(Array.isArray(r?.top) ? r!.top : []), ...(Array.isArray(r?.extra) ? r!.extra : [])]) if (m && legal.has(m.move)) moves.add(m.move);
  for (const b of boards) for (const m of b?.botPicks ?? []) moves.add(m);
  if (job.barred && moves.size > 1) moves.delete(job.barred);
  return [...moves].filter((m) => legal.has(m)).sort();
}

/**
 * The board from the engine server's deep search (its verdict): its numbers for every move, its best as the best.
 * The bots' picks come from `bots`, the judge closer to the verdict (whose own report held together, so its picks
 * follow from its top moves). A move the server left out keeps that judge's number, moved by the same shift.
 */
export function verdictBoard(job: JudgeJob, deep: readonly MoveScore[], bots: JudgedBoard): JudgedBoard | null {
  const all = legalMoves(job.fen);
  const legal = new Set(all.length > 1 ? all.filter((m) => m !== job.barred) : all);
  const scored = deep.filter((m) => okScore(m, legal));
  if (!scored.length) return null;
  const expectedAfter: Record<string, number> = Object.fromEntries(scored.map((m) => [m.move, m.expected]));
  const best = scored.reduce((a, b) => (b.expected > a.expected ? b : a));
  const anchor = expectedAfter[bots.bestMove];
  const shift = anchor === undefined ? 0 : anchor - bots.bestExpected;
  for (const [m, e] of Object.entries(bots.expectedAfter)) if (expectedAfter[m] === undefined) expectedAfter[m] = Math.min(1, Math.max(0, e + shift));
  const { replies, mates } = repliesFrom([scored]);
  return {
    bestMove: best.move,
    bestExpected: best.expected,
    expectedAfter,
    botPicks: bots.botPicks,
    botPowerUps: bots.botPowerUps,
    replies: { ...bots.replies, ...replies },
    mates: { ...bots.mates, ...mates },
    rechecked: Object.keys(expectedAfter),
  };
}

/** Each move's loss in points (0-100) against the board's best. */
export function boardLosses(b: Pick<JudgedBoard, "bestExpected" | "expectedAfter">): Record<string, number> {
  const best = Math.max(b.bestExpected, ...Object.values(b.expectedAfter));
  return Object.fromEntries(Object.entries(b.expectedAfter).map(([m, e]) => [m, (best - e) * 100]));
}

/**
 * How far a judge's board is from the verdict: the worst difference in any move's loss (points), over the moves
 * both scored. A report that didn't hold together (null) is infinitely far.
 */
export function distanceFrom(verdict: JudgedBoard, b: JudgedBoard | null): number {
  if (!b) return Infinity;
  const v = boardLosses(verdict);
  const mine = boardLosses(b);
  let worst = 0;
  for (const [m, loss] of Object.entries(mine)) if (v[m] !== undefined) worst = Math.max(worst, Math.abs(loss - v[m]!));
  return worst;
}

/**
 * After a verdict: which judge to blame (index), if either. Of two, the further one, when it's further by at least
 * `margin` points; a lone judge (a spot check), when it's at least `soloMargin` away. A report that didn't hold
 * together is always blamed.
 */
export function blameJudge(verdict: JudgedBoard, boards: readonly (JudgedBoard | null)[], margin: number, soloMargin = margin): { blamed: number[]; distances: number[] } {
  const distances = boards.map((b) => distanceFrom(verdict, b));
  const blamed = new Set<number>();
  distances.forEach((d, i) => d === Infinity && blamed.add(i));
  if (distances.length === 2 && !blamed.size) {
    const far = distances[0]! >= distances[1]! ? 0 : 1;
    if (distances[far]! - distances[1 - far]! >= margin) blamed.add(far);
  }
  if (distances.length === 1 && !blamed.size && distances[0]! >= soloMargin) blamed.add(0);
  return { blamed: [...blamed], distances };
}
