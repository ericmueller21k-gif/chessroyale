import { describe, expect, it } from "vitest";
import { FAIRPLAY } from "@chessroyale/core";
import { createGuest, ensureSchema } from "../src/accounts.ts";
import { caseDetail } from "../src/admin.ts";
import { reportPlayer } from "../src/fairplay.ts";
import { checkDuelGames, duelCheckSummary } from "../src/fairplay-duel.ts";
import type { DeepSearch } from "../src/fairplay-deep.ts";
import { recordDuel, type FinishedDuel } from "../src/ranked.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Fair play's engine check of 1 v 1 games (fairplay-duel.ts): a reported game first, the player's own moves after
 * the opening, every legal move a candidate, within the deep re-check's daily budget, carried on when cut short, and
 * shown on the case page. It never touches the case's level.
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

/** An engine that ranks the candidates as given, the last best (so the pick is never first unless it's the only one... or listed last). */
const engine = (calls: { fen: string; moves: readonly string[] }[]): DeepSearch => async (fen, moves) => {
  calls.push({ fen, moves });
  return moves.map((m, i) => ({ move: m, expected: 0.3 + (0.4 * i) / moves.length }));
};

describe("the 1 v 1 engine check", () => {
  it("the player's moves after the opening, every legal move searched, the reported game first", async () => {
    const { sql, ann, bob, play } = await setup();
    await play("OLDER-a", T0);
    await play("NEWER-b", T0 + 120_000);
    await reportPlayer(sql, bob, ann.id, "Cheating", "OLDER", T0 + 200_000);
    const calls: { fen: string; moves: readonly string[] }[] = [];
    const r = await checkDuelGames(sql, engine(calls), ann.id, T0 + 300_000, 60);
    // White's plies 8, 10 and 12 in each game.
    expect(r).toEqual({ searches: 6, games: 2 });
    expect(calls[0]!.moves.length).toBeGreaterThan(20);
    const d = (await caseDetail(sql, ann.id))!;
    const older = d.duels.find((g) => g.id === "OLDER-a")!;
    expect(older).toMatchObject({ reported: true, color: "w", opponent: { name: "Bob" }, control: "blitz" });
    expect(older.check!.moves.map((m) => m.ply)).toEqual([8, 10, 12]);
    expect(older.check!.moves[0]).toMatchObject({ move: "e1g1", thinkMs: 2000 });
    expect(older.summary.checked).toBe(3);
    // Bob's side of the same games: his own moves.
    expect((await checkDuelGames(sql, engine([]), bob.id, T0 + 300_000, 60)).searches).toBe(6);
    // Nothing about the case's level.
    expect((await caseDetail(sql, ann.id))!.case?.status).toBe("watch");
  });

  it("cut short (a search cap, the day's budget or no answer): carried on next time", async () => {
    const { sql, ann, play } = await setup();
    await play("ONLY1-a", T0);
    expect(await checkDuelGames(sql, engine([]), ann.id, T0, 2)).toEqual({ searches: 2, games: 0 });
    expect((await caseDetail(sql, ann.id))!.duels[0]!.check).toMatchObject({ done: false });
    const calls: { fen: string; moves: readonly string[] }[] = [];
    expect(await checkDuelGames(sql, engine(calls), ann.id, T0, 60)).toEqual({ searches: 1, games: 1 });
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
