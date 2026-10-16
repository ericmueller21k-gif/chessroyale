import { describe, expect, it } from "vitest";
import { FAIRPLAY } from "@chessroyale/core";
import { createGuest, ensureSchema } from "../src/accounts.ts";
import { caseDetail } from "../src/admin.ts";
import { reportPlayer } from "../src/fairplay.ts";
import { ENGINE_MOVES_MAX, checkDuelGames, duelCheckSummary, moveGroups } from "../src/fairplay-duel.ts";
import { legalMoves } from "@chessroyale/chess";
import type { DeepSearch } from "../src/fairplay-deep.ts";
import { recordDuel, type FinishedDuel } from "../src/ranked.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Fair play's engine check of 1 v 1 games (fairplay-duel.ts): a reported game first, the player's own moves after
 * the opening, every legal move scored in the engine server's groups of at most 8, within the deep re-check's daily
 * budget, carried on when cut short, and shown on the case page. It never touches the case's level.
 */

const T0 = 1_800_000_000_000;
// A real game: 14 plies (the opening's 8 aren't checked).
const LINE = ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "d2d3", "f8c5", "e1g1", "d7d6", "c2c3", "e8g8", "b1d2", "a7a6"];

async function setup() {
  const { sql } = memoryDb();
  await ensureSchema(sql);
  const ann = (await createGuest(sql, T0, "Ann")).user;
  const bob = (await createGuest(sql, T0, "Bob")).user;
  const play = (id: string, endedAt: number) =>
    recordDuel(sql, { id, players: { w: ann.id, b: bob.id }, control: "blitz", result: "1-0", reason: "resign", moves: LINE, times: LINE.map(() => 2000), startedAt: endedAt - 60_000, endedAt } satisfies FinishedDuel, async () => false);
  return { sql, ann, bob, play };
}

/**
 * An engine server as the real one answers: at most 8 moves a search (more: a 400, which the Worker reads as no
 * answer), each move's expected score its own whatever it's searched with (so groups compare), one move best.
 */
const scoreOf = (m: string) => (m === "e1g1" ? 0.62 : 0.3 + ([...m].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 29) / 100);
const engine = (calls: { fen: string; moves: readonly string[] }[]): DeepSearch => async (fen, moves) => {
  calls.push({ fen, moves });
  if (moves.length > ENGINE_MOVES_MAX) return null;
  return moves.map((m) => ({ move: m, expected: scoreOf(m) }));
};

describe("the 1 v 1 engine check", () => {
  it("the player's moves after the opening, every legal move scored in groups of at most 8, the reported game first", async () => {
    const { sql, ann, bob, play } = await setup();
    await play("OLDER-a", T0);
    await play("NEWER-b", T0 + 120_000);
    await reportPlayer(sql, bob, ann.id, "Cheating", "OLDER", T0 + 200_000);
    const calls: { fen: string; moves: readonly string[] }[] = [];
    const r = await checkDuelGames(sql, engine(calls), ann.id, T0 + 300_000, 60);
    // White's plies 8, 10 and 12 in each game: 38, 35 and 36 legal moves, 5 searches each.
    expect(r).toEqual({ searches: 30, games: 2 });
    expect(Math.max(...calls.map((c) => c.moves.length))).toBe(8);
    // Each position's groups cover its legal moves once, the played move in the first.
    // (Both games are the same line, so each position comes up twice.)
    const first = calls.slice(0, 5);
    expect(first.every((c) => c.fen === calls[0]!.fen) && calls[5]!.fen !== calls[0]!.fen).toBe(true);
    expect(new Set(first.flatMap((c) => c.moves)).size).toBe(legalMoves(calls[0]!.fen).length);
    expect(first[0]!.moves[0]).toBe("e1g1");
    const d = (await caseDetail(sql, ann.id))!;
    const older = d.duels.find((g) => g.id === "OLDER-a")!;
    expect(older).toMatchObject({ reported: true, color: "w", opponent: { name: "Bob" }, control: "blitz" });
    expect(older.check!.moves.map((m) => m.ply)).toEqual([8, 10, 12]);
    // O-O was the best of all 38 (from its own group); the others are ranked against every legal move.
    expect(older.check!.moves[0]).toMatchObject({ move: "e1g1", best: "e1g1", rank: 1, loss: 0, thinkMs: 2000 });
    const c3 = older.check!.moves[1]!;
    const fen10 = calls.find((c) => c.moves[0] === "c2c3")!.fen;
    const all = legalMoves(fen10).map((m) => ({ m, e: scoreOf(m) }));
    expect(c3.rank).toBe(1 + all.filter((x) => x.e > scoreOf("c2c3") + 1e-9).length);
    expect(c3.best).toBe([...all].sort((a, b) => b.e - a.e)[0]!.m);
    expect(older.summary.checked).toBe(3);
    // Bob's side of the same games: his own moves.
    expect((await checkDuelGames(sql, engine([]), bob.id, T0 + 300_000, 60)).searches).toBe(30);
    // Nothing about the case's level.
    expect((await caseDetail(sql, ann.id))!.case?.status).toBe("watch");
  });

  it("an engine server that refuses more than 8 moves: never asked for more", async () => {
    const { sql, ann, play } = await setup();
    await play("ONLY1-a", T0);
    const calls: { fen: string; moves: readonly string[] }[] = [];
    expect(await checkDuelGames(sql, engine(calls), ann.id, T0, 60)).toEqual({ searches: 15, games: 1 });
    expect(calls.every((c) => c.moves.length <= ENGINE_MOVES_MAX)).toBe(true);
    expect(moveGroups(["a", "b", "c"], "c")).toEqual([["c", "a", "b"]]);
    expect(moveGroups(Array.from({ length: 17 }, (_, i) => `m${i}`), "m16").map((g) => g.length)).toEqual([8, 8, 1]);
  });

  it("cut short (a search cap, the day's budget or no answer): carried on next time", async () => {
    const { sql, ann, play } = await setup();
    await play("ONLY1-a", T0);
    // Room for one position's five searches, not two.
    expect(await checkDuelGames(sql, engine([]), ann.id, T0, 7)).toEqual({ searches: 5, games: 0 });
    expect((await caseDetail(sql, ann.id))!.duels[0]!.check).toMatchObject({ done: false, moves: [{ ply: 8 }] });
    expect(await checkDuelGames(sql, engine([]), ann.id, T0, 60)).toEqual({ searches: 10, games: 1 });
    // The day's budget spent: nothing.
    await play("TWO22-a", T0 + 1);
    await sql.run("INSERT INTO fairplay_budget (day, searches) VALUES (?1, ?2) ON CONFLICT (day) DO UPDATE SET searches = ?2", new Date(T0).toISOString().slice(0, 10), FAIRPLAY.deep.dailySearches + 5);
    expect(await checkDuelGames(sql, engine([]), ann.id, T0, 60)).toEqual({ searches: 0, games: 0 });
    // No answer from the engine server: nothing lost.
    await sql.run("DELETE FROM fairplay_budget");
    expect(await checkDuelGames(sql, async () => null, ann.id, T0, 60)).toEqual({ searches: 1, games: 0 });
  });

  it("the summary: the engine's best counted, the average loss, the strength it shows", () => {
    expect(duelCheckSummary(null)).toEqual({ checked: 0, best: 0, avgLoss: null, strength: null });
    const s = duelCheckSummary({ done: true, at: 0, moves: [{ ply: 8, move: "a", best: "a", rank: 1, loss: 0, thinkMs: 1 }, { ply: 10, move: "b", best: "c", rank: 2, loss: 4, thinkMs: 1 }] });
    expect(s).toMatchObject({ checked: 2, best: 1, avgLoss: 2 });
    expect(s.strength).toBeGreaterThan(2500);
  });
});
