import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { MatchRunner, legalMoves, type EngineLike, type NetBoss, type Opening, type UciEngine } from "@chessroyale/chess";
import { loadOpenings } from "../src/solo.ts";
import { NetMatch } from "../src/net.ts";

// (The opening library is its own chunk, loaded on first use: solo.ts.)
beforeAll(() => loadOpenings());

/**
 * Online hints and the eval bar with Sawyer's Saw Swap still to come (the review of #863, finding 2): they score a check that sets it
 * off on the board after the swap, as the judge does, so a paid hint never recommends the fork the judge charges as a blunder.
 */

// The crowd White: Nb5-c7+ forks his king and rook (0.9 as plain chess; after the swap, him to move, 0.2), the quiet Kg1-h1 0.6, any
// other 0.5; any board but this one (the boards after the swap) 0.8 for the side to move.
const FORK = "r3k3/8/8/1N6/8/8/8/6K1 w - - 0 1";
const [FORKM, QUIETM] = ["b5c7", "g1h1"];
const score = (fen: string, m: string) => (fen === FORK ? (m === FORKM ? 0.9 : m === QUIETM ? 0.6 : 0.5) : 0.8);
const engine: EngineLike = {
  topMoves: async (fen, n) =>
    legalMoves(fen)
      .map((move) => ({ move, expected: score(fen, move) }))
      .sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1))
      .slice(0, n),
  scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
  playAtElo: async (fen) => legalMoves(fen).sort()[0]!,
};
const RUY = ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4", "g8f6", "e1g1", "f8e7", "f1e1", "b7b5"];
const opening: Opening = { id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves: RUY, namedPlies: RUY.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } };

/** A Boss alone against Sawyer on FORK, his swap still to come: the boss view the server sends, and the judge's own scoring. */
function forkRaid(): MatchRunner {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "sawyer", lastStandFrom: 999 } as Settings;
  const r = new MatchRunner({ settings, rng: mulberry32(5), engines: [engine], library: [opening], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: "w" });
  const board = r.boards.get(0)!;
  r.boards.set(0, { ...board, fen: FORK, history: [], bases: [{ ply: 0, fen: FORK }], lastMove: null });
  return r;
}

/** An online match on FORK's turn with `boss` as the server's view: the hints (a power-up) and the eval bar. */
async function online(boss: NetBoss) {
  const m = new NetMatch("TEST", "Ann", async () => [engine as unknown as UciEngine], true);
  const inner = m as unknown as { boss: NetBoss; key: string; phase: unknown };
  inner.boss = boss;
  inner.key = "k";
  inner.phase = { kind: "play", board: { ...boss.board, fen: FORK } };
  m.usePowerUp();
  for (let i = 0; i < 20 && !m.hint?.length; i++) await new Promise((done) => setTimeout(done, 0));
  return { hint: m.hint ?? [], bar: await m.evaluate(FORK) };
}

describe("online hints and the eval bar with Sawyer's Saw Swap", () => {
  it("agree with the judge: the fork scored after the swap (0.2), the quiet move the best; without the look, plain chess's fork", async () => {
    const r = forkRaid();
    const view = r.bossView()!;
    expect(Object.keys(view.powers!.swap ?? {})).toContain(FORKM);
    // The judge: picked, the fork loses 40 points to the quiet move.
    r.deal();
    const res = await r.score(new Map([["h0", { move: FORKM, thinkMs: 1000 }]]));
    expect(res.boards[0]!.bestMove).toBe(QUIETM);
    expect(res.boards[0]!.result.players[0]!.loss).toBeCloseTo(40, 6);
    // Online, the same: the hint's first move is the quiet one, the fork (if listed) at 0.2; the bar White's 0.6.
    const { hint, bar } = await online(view);
    expect(hint[0]!.move).toBe(QUIETM);
    const fork = hint.find((h) => h.move === FORKM);
    if (fork) expect(fork.expected).toBeCloseTo(0.2, 9);
    expect(bar).toBe(0.6);
    // (A view without the look, an older server's or once the swap is used: plain chess, the fork first at 0.9.)
    const { swap: _look, ...powers } = view.powers!;
    const plain = await online({ ...view, powers });
    expect(plain.hint[0]!.move).toBe(FORKM);
    expect(plain.bar).toBe(0.9);
  });
});
