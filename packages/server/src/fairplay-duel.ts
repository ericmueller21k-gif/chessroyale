/**
 * Fair play's engine check of a player's ranked 1 v 1 games (docs/areas/fairplay.md, "1 v 1"): no engine judges a 1 v
 * 1 move as it's played, so a reported player's kept games (ranked.ts, RANKED_1V1.gamesKeepDays) are searched on the
 * engine server when a person asks, from the case page's "Check with the engine server" (admin.ts): the deep
 * re-check's own engine instance and its daily budget (FAIRPLAY.deep.dailySearches), never more. Each of the
 * player's moves after the opening is scored against every legal move, so the pick's place among them and what it
 * gave away are the engine's. The engine server takes at most ENGINE_MOVES_MAX (8) moves a search and has no
 * unrestricted search (engine/server.mjs; the judges' top-8 search runs on players' devices), so the legal moves go in
 * groups of at most 8, one search each (the played move's group first), each a search from the day's budget. The
 * result is for the reviewer to read; it never feeds the suspicion score or a ban by itself (there are no judged
 * numbers to measure it against, so a false ban can't come from it).
 */
import { FAIRPLAY, ratingForLoss } from "@chessroyale/core";
import { START_FEN, applyMove, legalMoves, stockfishRefuses } from "@chessroyale/chess";
import type { Sql } from "./accounts.ts";
import { deepResult, takeBudget, type DeepSearch } from "./fairplay-deep.ts";

/** The most moves the engine server scores in one search (it answers 400 to more: engine/server.mjs). */
export const ENGINE_MOVES_MAX = 8;

/**
 * A position's legal moves in groups the engine server takes (at most ENGINE_MOVES_MAX each), the played move's group
 * first. Searches of the same position at the same nodes give comparable expected scores, so the groups' answers
 * together score every move.
 */
export function moveGroups(legal: readonly string[], played: string): string[][] {
  const order = [played, ...legal.filter((m) => m !== played)].filter((m) => legal.includes(m));
  const groups: string[][] = [];
  for (let i = 0; i < order.length; i += ENGINE_MOVES_MAX) groups.push(order.slice(i, i + ENGINE_MOVES_MAX));
  return groups;
}

/** One checked move: its place (ply), the pick, the engine's best, the pick's rank among the legal moves, its loss and the think time. */
export interface DuelCheckedMove {
  ply: number;
  move: string;
  best: string;
  rank: number;
  loss: number;
  thinkMs: number;
}

/** A game's check so far (`done` once every move of the player's after the opening has been searched). */
export interface DuelCheck {
  moves: DuelCheckedMove[];
  done: boolean;
  at: number;
}

/** What the reviewer reads first: moves checked, how many were the engine's best, the average loss and the strength it shows. */
export function duelCheckSummary(c: DuelCheck | null): { checked: number; best: number; avgLoss: number | null; strength: number | null } {
  if (!c?.moves.length) return { checked: 0, best: 0, avgLoss: null, strength: null };
  const avg = c.moves.reduce((s, m) => s + m.loss, 0) / c.moves.length;
  return { checked: c.moves.length, best: c.moves.filter((m) => m.rank === 1).length, avgLoss: Math.round(avg * 10) / 10, strength: ratingForLoss(avg) };
}

/** A game's `checked` column: each side's check (a game can be checked for either player, or both). */
type Checks = Partial<Record<"w" | "b", DuelCheck>>;
const parse = (s: string | null): Checks => {
  try {
    const v = s ? (JSON.parse(s) as Checks) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};

/**
 * Checks a player's kept 1 v 1 games: the reported ones first (a report made from the game names it), then the
 * newest, until `maxSearches` searches or the day's budget are spent. A game half checked carries on next time.
 * Returns the searches made and the games finished.
 */
export async function checkDuelGames(sql: Sql, search: DeepSearch, userId: string, now: number, maxSearches: number): Promise<{ searches: number; games: number }> {
  const reported = new Set((await sql.all<{ match: string }>("SELECT DISTINCT match FROM reports WHERE target = ? AND match IS NOT NULL", userId)).map((r) => r.match));
  const rows = await sql.all<{ id: string; white_id: string; moves: string; times: string; checked: string | null }>(
    "SELECT id, white_id, moves, times, checked FROM ranked_1v1_games WHERE white_id = ?1 OR black_id = ?1 ORDER BY ended_at DESC LIMIT 20",
    userId,
  );
  const queue = [...rows.filter((r) => reported.has(r.id.slice(0, 5))), ...rows.filter((r) => !reported.has(r.id.slice(0, 5)))];
  let searches = 0;
  let games = 0;
  for (const row of queue) {
    const side = row.white_id === userId ? "w" : "b";
    const all = parse(row.checked);
    const had = all[side];
    if (had?.done) continue;
    if (searches >= maxSearches) break;
    const moves = row.moves ? row.moves.split(" ") : [];
    const times = row.times ? row.times.split(",").map(Number) : [];
    const mine = side === "w" ? 0 : 1;
    const done = new Set(had?.moves.map((m) => m.ply));
    const checked = [...(had?.moves ?? [])];
    let complete = true;
    let fen = START_FEN;
    for (let ply = 0; ply < moves.length; ply++) {
      const move = moves[ply]!;
      if (ply % 2 === mine && ply >= FAIRPLAY.signals.bookPlies && !done.has(ply)) {
        const legal = legalMoves(fen);
        // (A forced move tells nothing; a position Stockfish refuses is never sent: engine.ts.)
        if (legal.length > 1 && !stockfishRefuses(fen)) {
          // (Every group of the position within this press's searches and the day's budget, or the move waits for the next.)
          const groups = moveGroups(legal, move);
          if (searches + groups.length > maxSearches) {
            complete = false;
            break;
          }
          const scores: { move: string; expected: number }[] = [];
          let ok = true;
          for (const group of groups) {
            if (!(await takeBudget(sql, now))) {
              ok = false;
              break;
            }
            searches++;
            const got = await search(fen, group);
            if (!got) {
              ok = false;
              break;
            }
            scores.push(...got);
          }
          if (!ok) {
            complete = false;
            break;
          }
          const d = deepResult(move, scores);
          if (d) checked.push({ ply, move, best: d.best, rank: d.rank, loss: d.loss, thinkMs: times[ply] ?? 0 });
        }
      }
      fen = applyMove(fen, move);
    }
    const check: DuelCheck = { moves: checked.sort((a, b) => a.ply - b.ply), done: complete, at: now };
    await sql.run("UPDATE ranked_1v1_games SET checked = ? WHERE id = ?", JSON.stringify({ ...all, [side]: check }), row.id);
    if (complete) games++;
    else break;
  }
  return { searches, games };
}

/** A player's kept 1 v 1 games for the case page: each with its opponent, whether it was reported, and its check. */
export async function duelEvidence(sql: Sql, userId: string): Promise<
  {
    id: string;
    color: "w" | "b";
    opponent: { id: string; name: string };
    control: string;
    result: string;
    reason: string;
    endedAt: number;
    moves: number;
    reported: boolean;
    check: DuelCheck | null;
    summary: ReturnType<typeof duelCheckSummary>;
  }[]
> {
  const reported = new Set((await sql.all<{ match: string }>("SELECT DISTINCT match FROM reports WHERE target = ? AND match IS NOT NULL", userId)).map((r) => r.match));
  const rows = await sql.all<{ id: string; white_id: string; black_id: string; control: string; result: string; reason: string; moves: string; ended_at: number; checked: string | null; name: string | null }>(
    `SELECT g.id, g.white_id, g.black_id, g.control, g.result, g.reason, g.moves, g.ended_at, g.checked, u.name FROM ranked_1v1_games g
     LEFT JOIN users u ON u.id = CASE WHEN g.white_id = ?1 THEN g.black_id ELSE g.white_id END
     WHERE g.white_id = ?1 OR g.black_id = ?1 ORDER BY g.ended_at DESC LIMIT 30`,
    userId,
  );
  return rows.map((r) => {
    const color = r.white_id === userId ? ("w" as const) : ("b" as const);
    const check = parse(r.checked)[color] ?? null;
    return {
      id: r.id,
      color,
      opponent: { id: color === "w" ? r.black_id : r.white_id, name: r.name ?? "Deleted player" },
      control: r.control,
      result: r.result,
      reason: r.reason,
      endedAt: r.ended_at,
      moves: r.moves ? r.moves.split(" ").length : 0,
      reported: reported.has(r.id.slice(0, 5)),
      check,
      summary: duelCheckSummary(check),
    };
  });
}
