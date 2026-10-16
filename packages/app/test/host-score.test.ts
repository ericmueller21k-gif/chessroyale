import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@chessroyale/core";
import { judgedBoard, legalMoves, runJudgeJob, type BoardScore, type ClientMessage, type EngineLike, type JudgeJob, type ScoreJob, type UciEngine } from "@chessroyale/chess";
import { NetMatch } from "../src/net.ts";

/**
 * The host's scoring (online with fewer than two judges): a pick scored above the engine's first line is the best move,
 * exactly as the judges and solo name it (docs/decisions/2026-10-16-the-best-move-is-the-highest-scored.md).
 *
 * The stand-in engine: the top-8 search lists the first 8 legal moves (the first line 0.50, then 0.49, ...); the second
 * search scores the last legal move 0.58, above the first line; the re-check's numbers are the quick ones unless
 * `deep` says otherwise.
 */
function engine(deep: Record<string, number> = {}): EngineLike {
  const top = (fen: string) => legalMoves(fen).slice(0, 8).map((move, i) => ({ move, expected: 0.5 - 0.01 * i }));
  const quick = (fen: string, m: string) => top(fen).find((x) => x.move === m)?.expected ?? (m === legalMoves(fen).at(-1) ? 0.58 : 0.3);
  return {
    topMoves: async (fen, n) => top(fen).slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: quick(fen, move) })),
    scoreMovesAt: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: deep[move] ?? quick(fen, move) })),
  };
}

const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
const FIRST = legalMoves(FEN)[0]!;
const OVER = legalMoves(FEN).at(-1)!;
const job: ScoreJob = { boardId: 0, fen: FEN, humanPicks: { a: FIRST, b: OVER, c: null }, bots: [] };

/** The board this device sends as host. */
async function hostBoard(e: EngineLike, serverRecheck = false): Promise<BoardScore> {
  const m = new NetMatch("TEST", "Ann", async () => [e as unknown as UciEngine]);
  const sent: ClientMessage[] = [];
  (m as unknown as { send: (msg: ClientMessage) => void }).send = (msg) => sent.push(msg);
  await (m as unknown as { hostScore: (key: string, jobs: ScoreJob[], serverRecheck?: boolean) => Promise<void> }).hostScore("k", [job], serverRecheck);
  const scores = sent.find((x) => x.t === "scores") as Extract<ClientMessage, { t: "scores" }>;
  return scores.boards[0]!;
}

describe("the host's board", () => {
  it("names the pick above the engine's first line the best, with or without its own re-check", async () => {
    for (const serverRecheck of [false, true]) {
      const b = await hostBoard(engine(), serverRecheck);
      expect(b.bestMove).toBe(OVER);
      expect(b.bestExpected).toBe(0.58);
    }
  });

  it("re-checks the first line against it, like for like: the better one is the best", async () => {
    const b = await hostBoard(engine({ [FIRST]: 0.55, [OVER]: 0.54 }));
    expect(b.bestMove).toBe(FIRST);
    expect(b.bestExpected).toBeCloseTo(0.59, 9);
  });

  it("is the board two judges work out from the same searches", async () => {
    for (const deep of [{}, { [FIRST]: 0.55, [OVER]: 0.54 }]) {
      const e = engine(deep);
      const j: JudgeJob = { id: "k/0", fen: FEN, picks: [FIRST, OVER].sort(), bots: [], seed: 1, rules: { botCandidateMoves: 8, botRandomMoveChance: 0.02, botPowerUpLoss: 15 }, recheck: DEFAULT_SETTINGS };
      const judged = judgedBoard(j, await runJudgeJob(e, j))!;
      const host = await hostBoard(e);
      expect(host.bestMove).toBe(judged.bestMove);
      expect(host.bestExpected).toBe(judged.bestExpected);
      for (const m of j.picks) expect(host.expectedAfter[m]).toBe(judged.expectedAfter[m]);
    }
  });
});
