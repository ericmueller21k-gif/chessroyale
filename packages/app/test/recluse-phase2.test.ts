import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RECLUSE_PHASE2 } from "@chessroyale/core";
import { legalMoves, phase2Numbers, type MoveScore } from "@chessroyale/chess";
import { PHASE_CHANGE, Phase2Game } from "../src/recluse-phase2.ts";
import { RECLUSE } from "../src/characters/recluse.ts";
import { KING_VS_RECLUSE, RECLUSE_LINES } from "../src/characters/recluse-lines.ts";
import { animLength, cueAt } from "../src/characters/power-art.ts";

// The Hidden Boss's phase 2 on this device (recluse-phase2.ts): the phase change's beats, and the four boards driven
// with pretend engines and a pretend clock. Its rules: packages/chess/test/recluse-phase2.test.ts.

describe("the phase change", () => {
  it("is short (6 to 8 s), its beats in order, his revive's catch as the book goes back to him", () => {
    const C = PHASE_CHANGE;
    expect(C.total).toBeGreaterThanOrEqual(6000);
    expect(C.total).toBeLessThanOrEqual(8000);
    const order = [0, C.slamAt, C.crackAt, C.partAt, C.growAt, C.growAt + C.growMs, C.flipAt, C.shuffleAt, C.shuffleAt + C.shuffleMs, C.closeAt, C.bookGoneAt, C.bannerAt, C.total];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const revive = RECLUSE.anims.revive!;
    expect(C.reviveAt + cueAt(revive, "catch")!).toBe(C.bookGoneAt);
    expect(C.reviveAt + animLength(revive)).toBeLessThanOrEqual(C.bannerAt);
    // (Phase 2's frames, all drawn already: his revive and his phase 2 idle, his slam and laugh, the placeholder's glow.)
    for (const a of ["revive", "idle2", "slam2", "laugh2", "spellbook2", "spellLoop2", "collapseLoop"]) expect(RECLUSE.anims[a], a).toBeDefined();
  });
});

describe("his phase 2 lines", () => {
  it("has a line for each moment, his and the God King's", () => {
    for (const k of ["revive", "phase2", "boardWon", "boardLost", "beaten2"] as const) expect(RECLUSE_LINES[k].length, k).toBeGreaterThan(0);
    for (const k of ["phase2", "boardWon", "boardLost", "victory2"] as const) expect(KING_VS_RECLUSE[k].length, k).toBeGreaterThan(0);
  });
});

/** Pretend engines: his plays the first legal move (sorted), and counts what it's asked; the bots' the same. */
function engines() {
  const asked: { fen: string; elo: number; nodes?: number; moveMs?: number }[] = [];
  const first = (fen: string) => [...legalMoves(fen)].sort()[0]!;
  const boss = {
    playAtElo: (fen: string, elo: number, nodes?: number, moveMs?: number) => {
      asked.push({ fen, elo, nodes, moveMs });
      return Promise.resolve(first(fen));
    },
  };
  const bots = {
    playAtElo: (fen: string) => Promise.resolve(first(fen)),
    topMoves: (fen: string): Promise<MoveScore[]> => Promise.resolve(legalMoves(fen).includes("h5f7") ? [{ move: "h5f7", expected: 1 }] : [{ move: first(fen), expected: 0.5 }]),
  };
  return { boss, bots, asked };
}

describe("phase 2's four boards on this device", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = (over: Partial<ConstructorParameters<typeof Phase2Game>[0]> = {}) => {
    const e = engines();
    const done = vi.fn();
    const results: string[] = [];
    const g = new Phase2Game({
      players: ["you", "b1", "b2", "b3"],
      numbers: phase2Numbers(5),
      human: "you",
      boss: e.boss,
      bots: e.bots,
      rng: () => 0.5,
      onChange: () => undefined,
      onResult: (b) => results.push(`${b.id}:${b.result!.winner}:${b.result!.how}`),
      onDone: done,
      ...over,
    });
    return { g, e, done, results };
  };

  it("the test switch: the bots mate at once, your Qxf7 mates too, and all four won beat him", async () => {
    const { g, done, results } = make({ win: true });
    g.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(g.outcome).toMatchObject({ won: 3, decided: false });
    g.move(0, "h5f7");
    await vi.advanceTimersByTimeAsync(10);
    expect(g.outcome).toMatchObject({ won: 4, beaten: true, decided: true });
    expect(done).toHaveBeenCalledTimes(1);
    expect(results.sort()).toEqual(["0:crowd:mate", "1:crowd:mate", "2:crowd:mate", "3:crowd:mate"]);
  });

  it("he answers on every board with Stockfish at his strength and budget only; your move is yours alone", async () => {
    const { g, e } = make();
    g.start();
    // (Your move on a bot's board, or an illegal one, does nothing.)
    g.move(1, legalMoves(g.board(1)!.board.fen)[0]!);
    expect(g.board(1)!.board.history).toHaveLength(0);
    g.move(0, [...legalMoves(g.board(0)!.board.fen)].sort()[0]!);
    await vi.advanceTimersByTimeAsync(3000);
    expect(g.board(0)!.board.history.length).toBe(2);
    for (const b of g.state.boards) expect(b.board.history.length).toBeGreaterThanOrEqual(2);
    expect(e.asked.length).toBeGreaterThanOrEqual(4);
    for (const a of e.asked) expect(a).toMatchObject({ elo: RECLUSE_PHASE2.elo, nodes: RECLUSE_PHASE2.nodes, moveMs: RECLUSE_PHASE2.moveMs });
    g.stop();
  });

  it("your clock runs out: your board is lost on time; the others played on", async () => {
    const { g, results } = make();
    g.start();
    await vi.advanceTimersByTimeAsync(RECLUSE_PHASE2.bankSeconds * 1000 + 400);
    expect(results).toContain("0:boss:time");
    expect(g.board(0)!.result).toEqual({ winner: "boss", how: "time" });
    // (The bots moved all along, each on its own clock: their boards went on after yours stopped.)
    expect(g.state.boards.slice(1).every((b) => b.board.history.length > 2)).toBe(true);
    g.stop();
  });

  it("his ultimate (the admins' trigger): from then on, out of your few seconds, a random legal move is played for you (no loss)", async () => {
    const ult = vi.fn();
    const { g } = make({ onUlt: ult });
    g.start();
    g.ult();
    expect(ult).toHaveBeenCalledTimes(1);
    expect(g.state.ultAt).not.toBeNull();
    await vi.advanceTimersByTimeAsync(RECLUSE_PHASE2.ultMoveSeconds * 1000 + 300);
    expect(g.board(0)!.result).toBeNull();
    expect(g.board(0)!.board.history.length).toBeGreaterThanOrEqual(1);
    g.ult();
    expect(ult).toHaveBeenCalledTimes(1);
    g.stop();
  });

  it("slow moves count, yours and the bots' (now and then a bot thinks past slowMoveSeconds); past slowMovesForUlt his ultimate comes", async () => {
    const slow = vi.fn();
    const ult = vi.fn();
    // (rng 0.05: every bot's move is a slow one.)
    const { g } = make({ onSlow: slow, onUlt: ult, rng: () => 0.05 });
    g.start();
    await vi.advanceTimersByTimeAsync(RECLUSE_PHASE2.botSlowMs[1] + 500);
    expect(slow).toHaveBeenCalled();
    expect(g.state.slow).toBeGreaterThanOrEqual(3);
    await vi.advanceTimersByTimeAsync(3 * RECLUSE_PHASE2.botSlowMs[1]);
    expect(ult).toHaveBeenCalledTimes(1);
    expect(g.state.slow).toBe(RECLUSE_PHASE2.slowMovesForUlt + 1);
    g.stop();
  });

  it("resigning your board: lost; the battle ends only once every board is decided", async () => {
    const { g, done } = make();
    g.start();
    g.resign(0);
    expect(g.board(0)!.result?.how).toBe("resign");
    expect(done).not.toHaveBeenCalled();
    g.stop();
  });
});
