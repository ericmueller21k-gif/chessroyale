/**
 * Fair play's deep re-check: a flagged player's counted moves searched again on the engine server (native Stockfish
 * 17.1, the full network, FAIRPLAY.deep.nodes), restricted to the judges' best moves and the pick. It answers the
 * question the judges' quick search can't settle on its own: are the picks the moves a strong engine plays, far more
 * often than even a very strong player's would be? A ban needs this confirmation (core/fairplay.ts, playerLevel).
 *
 * Eric's computing rule: the game first, then players' devices, then our servers where truly needed. Detection uses
 * the server's own record of each match and the server's own engine, never a device's say-so; and this heavy work
 * runs from the Worker's schedule: cases in review at once, the rest off-peak, within its own daily budget, on its own
 * container instance ("fairplay-1", fairplay-engine.ts), so a match's re-checks never wait behind it.
 */
import { FAIRPLAY, matchSignals, referenceStrength, skipReason, type FairMove } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";
import { relevel, type CaseMailer } from "./fairplay.ts";

/** One deep search over some moves: each one's expected score (the mover's), or null when the server can't answer. */
export type DeepSearch = (fen: string, moves: readonly string[]) => Promise<{ move: string; expected: number }[] | null>;

/** Takes one search from today's budget; false once it's spent. */
async function takeBudget(sql: Sql, now: number): Promise<boolean> {
  const day = new Date(now).toISOString().slice(0, 10);
  await sql.run("INSERT INTO fairplay_budget (day, searches) VALUES (?, 1) ON CONFLICT (day) DO UPDATE SET searches = searches + 1", day);
  const used = (await sql.first<{ searches: number }>("SELECT searches FROM fairplay_budget WHERE day = ?", day))?.searches ?? 0;
  return used <= FAIRPLAY.deep.dailySearches;
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
 * One scheduled run: matches waiting for the deep re-check (a flagged match, or any match of a player with an open
 * case), cases in review first and the rest only off-peak (`all` ignores the hours: an admin asking). Each counted
 * move is searched once; a match is done when all of them are (or can't be). The player's level is worked out again
 * afterwards, which is where a ban can come from. Returns how many searches it made.
 */
export async function deepCheckRun(sql: Sql, search: DeepSearch, now: number, opts: { mail?: CaseMailer; all?: boolean; userId?: string; perRun?: number } = {}): Promise<{ searches: number; matches: number }> {
  const dp = FAIRPLAY.deep;
  const perRun = opts.perRun ?? dp.perRun;
  const quiet = opts.all || offPeak(now);
  const rows = await sql.all<QueueRow & { status: string | null }>(
    `SELECT m.id, m.user_id, m.played_at, m.moves, c.status FROM fairplay_matches m LEFT JOIN fairplay_cases c ON c.user_id = m.user_id
     WHERE m.moves IS NOT NULL AND (m.deep_done IS NULL OR m.deep_done = 0)
       AND (m.score >= ? OR m.level != 'none' OR c.status IN ('watch', 'review'))
       ${opts.userId ? "AND m.user_id = ?" : ""}
     ORDER BY CASE c.status WHEN 'review' THEN 0 WHEN 'watch' THEN 1 ELSE 2 END, m.played_at DESC LIMIT 50`,
    dp.queueScore,
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
      await sql.run("UPDATE fairplay_matches SET deep_done = 1 WHERE id = ?", row.id);
      continue;
    }
    let complete = true;
    let changed = false;
    for (const m of moves) {
      if (m.deep || skipReason(m) !== null) continue;
      if (searches >= perRun || !(await takeBudget(sql, now))) {
        complete = false;
        break;
      }
      searches++;
      const candidates = [...new Set([...(m.top ?? [m.best]).slice(0, dp.candidates), m.move])];
      const scores = await search(m.fen, candidates);
      if (!scores) {
        // The server didn't answer: try again on a later run.
        complete = false;
        break;
      }
      const d = deepResult(m.move, scores);
      if (d) {
        m.deep = d;
        changed = true;
      }
    }
    if (changed || complete) await saveDeep(sql, row, moves, complete);
    if (changed) touched.add(row.user_id);
    if (complete) matches++;
    if (!complete) break;
  }
  for (const userId of touched) await relevel(sql, userId, now, opts.mail);
  return { searches, matches };
}

/** Stores a match's moves with their deep results, and its summary and score worked out again. */
async function saveDeep(sql: Sql, row: QueueRow, moves: FairMove[], complete: boolean): Promise<void> {
  // (Measured against the player's strength as it was before that match, as when it was first scored.)
  const before = await sql.all<{ perf: number | null }>(
    "SELECT perf FROM fairplay_matches WHERE user_id = ? AND played_at < ? ORDER BY played_at DESC LIMIT 10",
    row.user_id,
    row.played_at,
  );
  const rating = (await sql.first<{ rating: number | null }>("SELECT rating FROM users WHERE id = ?", row.user_id))?.rating ?? null;
  const summary = matchSignals(moves, referenceStrength(before.map((b) => b.perf), rating));
  await sql.run(
    "UPDATE fairplay_matches SET moves = ?, summary = ?, score = ?, perf = ?, deep_done = ? WHERE id = ?",
    JSON.stringify(moves),
    JSON.stringify(summary),
    summary.score,
    summary.perf,
    complete ? 1 : 0,
    row.id,
  );
}
