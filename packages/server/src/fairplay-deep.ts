/**
 * Fair play's deep re-check: a flagged player's counted moves searched again on the engine server (native Stockfish
 * 17.1, the full network, FAIRPLAY.deep.nodes), over every legal move of the position: the candidates are the engine's
 * own, never the judges' list, which a device sent and could have forged (the outside review of Nov 10, finding 3). The
 * engine server takes at most ENGINE_MOVES_MAX moves a search, so the legal moves go in near-equal groups (moveGroups, as
 * 1 v 1's check: fairplay-duel.ts), one search each from the day's budget. It answers the question the judges' quick
 * search can't settle on its own: are the picks the moves a strong engine plays, far more often than even a very strong
 * player's would be? A ban needs this confirmation (core/fairplay.ts, playerLevel).
 *
 * Eric's computing rule: the game first, then players' devices, then our servers where truly needed. Detection uses
 * the server's own record of each match and the server's own engine, never a device's say-so; and this heavy work
 * runs from the Worker's schedule: cases in review at once, the rest off-peak, within its own daily budget, on its own
 * container instance ("fairplay-1", fairplay-engine.ts), so a match's re-checks never wait behind it.
 */
import { legalMoves, stockfishRefuses } from "@chessroyale/chess";
import { FAIRPLAY, matchSignals, referenceStrength, skipReason, type FairMove, type FairSummary } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";
import { relevel, type CaseMailer } from "./fairplay.ts";

/** The most moves the engine server scores in one search (it answers 400 to more: engine/server.mjs). */
export const ENGINE_MOVES_MAX = 8;

/**
 * A position's legal moves in as few groups as the engine server takes (at most ENGINE_MOVES_MAX each), as near equal
 * in size as they can be (17 moves: 6, 6 and 5, never 8, 8 and 1, which would search the lone move eight times as
 * deep), the played move first. Searches of the same position at the same nodes, over about as many moves each, give
 * comparable expected scores, so the groups' answers together score every move.
 */
export function moveGroups(legal: readonly string[], played: string): string[][] {
  const order = [played, ...legal.filter((m) => m !== played)].filter((m) => legal.includes(m));
  const count = Math.ceil(order.length / ENGINE_MOVES_MAX);
  const groups: string[][] = [];
  for (let g = 0, at = 0; g < count; g++) {
    const size = Math.floor(order.length / count) + (g < order.length % count ? 1 : 0);
    groups.push(order.slice(at, at + size));
    at += size;
  }
  return groups;
}

/** A position's legal moves, or none (a position chess.js can't read: never searched). */
function legalOf(fen: string): string[] {
  try {
    return legalMoves(fen);
  } catch {
    return [];
  }
}

/** One deep search over some moves: each one's expected score (the mover's), or null when the server can't answer. */
export type DeepSearch = (fen: string, moves: readonly string[]) => Promise<{ move: string; expected: number }[] | null>;

/** Takes `n` searches from today's budget, all or none; false when fewer are left (the 1 v 1 check shares it: fairplay-duel.ts). */
export async function takeBudget(sql: Sql, now: number, n = 1): Promise<boolean> {
  const day = new Date(now).toISOString().slice(0, 10);
  await sql.run("INSERT INTO fairplay_budget (day, searches) VALUES (?, 0) ON CONFLICT (day) DO NOTHING", day);
  const took = await sql.first<{ searches: number }>(
    "UPDATE fairplay_budget SET searches = searches + ? WHERE day = ? AND searches + ? <= ? RETURNING searches",
    n,
    day,
    n,
    FAIRPLAY.deep.dailySearches,
  );
  return !!took;
}

/**
 * Every legal move of a position scored, one search a group (moveGroups), the whole position's budget taken before the first search:
 * a day's budget never runs out halfway through a position, its searches thrown away (the review of #610, m4). `scores` null when the
 * budget is short or the server doesn't answer (the searches it never made go back to the budget); `made`: the searches sent.
 */
export async function searchPosition(
  sql: Sql,
  search: DeepSearch,
  fen: string,
  groups: readonly string[][],
  now: number,
): Promise<{ scores: { move: string; expected: number }[] | null; made: number }> {
  if (!(await takeBudget(sql, now, groups.length))) return { scores: null, made: 0 };
  const scores: { move: string; expected: number }[] = [];
  for (let i = 0; i < groups.length; i++) {
    const got = await search(fen, groups[i]!);
    if (!got) {
      if (i + 1 < groups.length) await sql.run("UPDATE fairplay_budget SET searches = MAX(0, searches - ?) WHERE day = ?", groups.length - i - 1, new Date(now).toISOString().slice(0, 10));
      return { scores: null, made: i + 1 };
    }
    scores.push(...got);
  }
  return { scores, made: groups.length };
}

/** Whether `now` is off-peak (FAIRPLAY.deep.offPeakUtc). */
export function offPeak(now: number): boolean {
  const h = new Date(now).getUTCHours();
  const [from, to] = FAIRPLAY.deep.offPeakUtc;
  return from <= to ? h >= from && h < to : h >= from || h < to;
}

/** The deep re-check of one move: the search's best of the candidates, the pick's rank among them, its loss, the top 3. */
export function deepResult(pick: string, scores: readonly { move: string; expected: number }[]): FairMove["deep"] | null {
  const own = scores.find((x) => x.move === pick);
  if (!own) return null;
  const sorted = [...scores].sort((a, b) => b.expected - a.expected);
  const best = sorted[0]!;
  return {
    best: best.move,
    rank: 1 + sorted.filter((x) => x.expected > own.expected + 1e-9).length,
    loss: Math.round(Math.max(0, (best.expected - own.expected) * 100) * 100) / 100,
    top: sorted.slice(0, 3).map((x) => x.move),
  };
}

interface QueueRow {
  id: number;
  user_id: string;
  played_at: number;
  moves: string;
}

/**
 * One scheduled run: matches waiting for the deep re-check (queueDeep: every match still kept of a player with a
 * flagged match or an open case), cases in review first and the rest only off-peak (`all` ignores the hours: an admin asking). Each counted
 * move is searched once; a match is done when all of them are (or can't be). Outside a review, a ban or the engine pool (off-peak,
 * beside watch) a match is checked only as far as a ban could need (FAIRPLAY.levels.banMatchChecked counted moves), then leaves the queue undone: a review queues the rest again
 * (setCase). The player's level is worked out again afterwards. Returns how many searches it made (a position's whole budget).
 */
export async function deepCheckRun(sql: Sql, search: DeepSearch, now: number, opts: { mail?: CaseMailer; all?: boolean; userId?: string; perRun?: number } = {}): Promise<{ searches: number; matches: number }> {
  const dp = FAIRPLAY.deep;
  const perRun = opts.perRun ?? dp.perRun;
  const quiet = opts.all || offPeak(now);
  const rows = await sql.all<QueueRow & { status: string | null }>(
    `SELECT m.id, m.user_id, m.played_at, m.moves, c.status FROM fairplay_matches m LEFT JOIN fairplay_cases c ON c.user_id = m.user_id
     WHERE m.deep_queued = 1 ${opts.userId ? "AND m.user_id = ?" : ""}
     ORDER BY CASE c.status WHEN 'review' THEN 0 WHEN 'watch' THEN 1 WHEN 'pool' THEN 1 ELSE 2 END, m.played_at DESC LIMIT 50`,
    ...(opts.userId ? [opts.userId] : []),
  );
  let searches = 0;
  let matches = 0;
  const touched = new Set<string>();
  for (const row of rows) {
    if (!quiet && row.status !== "review") continue;
    if (searches >= perRun) break;
    let moves: FairMove[];
    try {
      moves = JSON.parse(row.moves) as FairMove[];
    } catch {
      await sql.run("UPDATE fairplay_matches SET deep_done = 1, deep_queued = 0 WHERE id = ?", row.id);
      continue;
    }
    let complete = true;
    let changed = false;
    // (Outside a review or a ban, as far as a ban could need and no further: the day's budget goes round more players. The review of
    // #610, m4. A banned case is checked in full, as a review's: a person's ban and its appeal rest on every counted move (delta m4-a). So
    // is a pooled one's: a person's Release reads how they play in the pool, and the pool's data is kept (the #618 review, m1).)
    const cap = row.status === "review" || row.status === "banned" || row.status === "pool" ? Infinity : FAIRPLAY.levels.banMatchChecked;
    let checked = moves.filter((m) => m.deep && skipReason(m) === null).length;
    let capped = false;
    for (const m of moves) {
      // (A position Stockfish refuses is never sent, so it never gets an answer: passed over rather than waited on, or
      // the queue would stop at it every run. No game makes one: engine.ts, containerScore.)
      if (m.deep || skipReason(m) !== null || stockfishRefuses(m.fen)) continue;
      // Every legal move, the pick's group first: the engine's own candidates (a pick that isn't legal here gets no result).
      const groups = moveGroups(legalOf(m.fen), m.move);
      if (!groups.length) continue;
      if (checked >= cap) {
        capped = true;
        break;
      }
      // (All of a position's groups within this run's share, or it waits for the next run: half a position is never kept.)
      if (searches + groups.length > perRun) {
        complete = false;
        break;
      }
      const { scores, made } = await searchPosition(sql, search, m.fen, groups, now);
      searches += made;
      if (!scores) {
        // The day's budget is short, or the server didn't answer: try again on a later run.
        complete = false;
        break;
      }
      const d = deepResult(m.move, scores);
      if (d) {
        m.deep = d;
        changed = true;
        checked++;
      }
    }
    if (changed || complete) await saveDeep(sql, row, moves, complete ? (capped ? "capped" : "done") : "waiting");
    if (changed) touched.add(row.user_id);
    if (complete) matches++;
    if (!complete) break;
  }
  for (const userId of touched) await relevel(sql, userId, now, opts.mail);
  return { searches, matches };
}

/** A stored match's summary worked out again from its moves, measured against the player's strength as it was before that match (as when it was first scored). */
async function summaryOf(sql: Sql, row: Pick<QueueRow, "user_id" | "played_at">, moves: readonly FairMove[]): Promise<FairSummary> {
  const before = await sql.all<{ perf: number | null }>(
    "SELECT perf FROM fairplay_matches WHERE user_id = ? AND played_at < ? ORDER BY played_at DESC LIMIT 10",
    row.user_id,
    row.played_at,
  );
  const rating = (await sql.first<{ rating: number | null }>("SELECT rating FROM users WHERE id = ?", row.user_id))?.rating ?? null;
  return matchSignals(moves, referenceStrength(before.map((b) => b.perf), rating));
}

/**
 * Stores a match's moves with their deep results, and its summary and score worked out again: "done" (every counted move), "capped"
 * (out of the queue, not done: a review queues it again) or "waiting" (still queued).
 */
async function saveDeep(sql: Sql, row: QueueRow, moves: FairMove[], state: "done" | "capped" | "waiting"): Promise<void> {
  const summary = await summaryOf(sql, row, moves);
  await sql.run(
    "UPDATE fairplay_matches SET moves = ?, summary = ?, score = ?, perf = ?, deep_done = ?, deep_queued = ? WHERE id = ?",
    JSON.stringify(moves),
    JSON.stringify(summary),
    summary.score,
    summary.perf,
    state === "done" ? 1 : 0,
    state === "waiting" ? 1 : 0,
    row.id,
  );
}

/**
 * The catch-up's bound (the review of #629, m3): only matches played before this can hold a summary from before the near-best count (a
 * deep re-check since the deploy writes `deepExact`), so the scan reads those alone, by `fairplay_matches_user` (user_id, played_at),
 * and never grows with the pool. It must fall after this PR's deploy (Nov 2026; move it later if the deploy is). Remove it, with
 * recountDeep and its call in index.ts, once the schedule's "fairplay-recount" has caught up nothing for a week.
 */
export const RECOUNT_BEFORE = Date.UTC(2026, 10, 15);

/**
 * The near-best count's catch-up (Nov 11; docs/decisions/2026-11-11-near-best.md): an open case's matches played before RECOUNT_BEFORE
 * whose stored summary predates the count (no `deepExact`) and still keep their moves get their summary worked out again from the deep
 * results already stored (each move's rank and loss: no searches), then the player's level again (relevel), as after a deep re-check. A
 * summary worked out again carries `deepExact`, so a match is caught up once and the next run finds nothing: safe to run every time (the
 * Worker's schedule, before the re-check). Closed, cleared (a Release too) and banned cases are left as they are. At most `limit`
 * matches a run; the rest on the next. Returns the matches caught up.
 */
export async function recountDeep(sql: Sql, now: number, opts: { mail?: CaseMailer; limit?: number } = {}): Promise<number> {
  const rows = await sql.all<{ id: number; user_id: string; played_at: number; moves: string }>(
    `SELECT m.id, m.user_id, m.played_at, m.moves FROM fairplay_cases c JOIN fairplay_matches m ON m.user_id = c.user_id AND m.played_at < ?
     WHERE c.status IN ('watch', 'review', 'pool') AND m.moves IS NOT NULL AND json_valid(m.summary)
       AND json_extract(m.summary, '$.deepChecked') > 0 AND json_extract(m.summary, '$.deepExact') IS NULL
     ORDER BY m.played_at LIMIT ?`,
    RECOUNT_BEFORE,
    opts.limit ?? 100,
  );
  const touched = new Set<string>();
  for (const row of rows) {
    let moves: FairMove[];
    try {
      moves = JSON.parse(row.moves) as FairMove[];
    } catch {
      // (Unreadable moves: marked caught up with the count it has, so the next run doesn't pick it again.)
      await sql.run("UPDATE fairplay_matches SET summary = json_set(summary, '$.deepExact', json_extract(summary, '$.deepMatch')) WHERE id = ?", row.id);
      continue;
    }
    const summary = await summaryOf(sql, row, moves);
    await sql.run("UPDATE fairplay_matches SET summary = ?, score = ?, perf = ? WHERE id = ?", JSON.stringify(summary), summary.score, summary.perf, row.id);
    touched.add(row.user_id);
  }
  for (const userId of touched) await relevel(sql, userId, now, opts.mail);
  return rows.length;
}
