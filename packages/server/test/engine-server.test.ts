import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { START_FEN, chess960Fen, legalMoves960, stockfishRefuses } from "@chessroyale/chess";

/**
 * The engine server's one way in (engine.ts, `containerScore`): a position Stockfish refuses never reaches the
 * container (Stockfish would end its process, and the container with it), from `/api/engine/score`, `serverScoreAt`
 * (every match's re-checks) or fair play's deep search; a legal one, Chess960 included, still does.
 */

// (The real container needs the Workers runtime: a stub that records what it's sent and scores every move 0.5.)
const sent = vi.hoisted(() => [] as { instance: string; fen: string; moves: string[] }[]);
vi.mock("@cloudflare/containers", () => ({
  Container: class {},
  getContainer: (_ns: unknown, instance: string) => ({
    fetch: async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { fen: string; moves: string[] };
      sent.push({ instance, fen: body.fen, moves: body.moves });
      return new Response(JSON.stringify({ moves: body.moves.map((move) => ({ move, expected: 0.5 })) }));
    },
  }),
}));

import worker, { type Env } from "../src/index.ts";
import { serverScoreAt } from "../src/engine.ts";
import { containerSearch } from "../src/fairplay-engine.ts";

/** Positions Stockfish refuses, one of each kind the game could be handed (stockfishRefuses). */
const REFUSED = {
  ninePawns: "rnbqkbnr/pppppppp/8/8/8/P7/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  notToMoveInCheck: "4k3/8/8/8/8/8/4R3/4K3 w - - 0 1",
  noKing: "8/8/8/8/8/8/8/4K3 w - - 0 1",
  tooManyPieces: "4k3/8/8/8/8/8/PPPPPPPP/QQ2K3 w - - 0 1",
};
const C960 = chess960Fen(0);
const C960_MOVES = legalMoves960(C960).slice(0, 2);

/** D1's stand-in for the day's budget: counts the queries (the budget is a query). */
function budgetDb() {
  const queries: string[] = [];
  const db = {
    prepare(q: string) {
      queries.push(q);
      return { run: async () => ({}), bind: () => ({ first: async () => ({ searches: 1 }) }) };
    },
  };
  return { queries, db: db as unknown as D1Database };
}

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
let ip = 0;
async function score(env: Partial<Env>, body: unknown) {
  // (A new address each time, so the per-address rate limit never answers instead.)
  const request = new Request("https://hunchess.test/api/engine/score", { method: "POST", body: JSON.stringify(body), headers: { "cf-connecting-ip": `10.0.0.${++ip}` } });
  return worker.fetch(request, env as Env, ctx);
}

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  sent.length = 0;
  log = vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => log.mockRestore());

describe("the engine server never gets a position Stockfish refuses", () => {
  it("the test positions: each refused, the legal ones not", () => {
    for (const fen of Object.values(REFUSED)) expect(stockfishRefuses(fen), fen).not.toBeNull();
    expect(stockfishRefuses(START_FEN)).toBeNull();
    expect(stockfishRefuses(C960)).toBeNull();
    expect(C960_MOVES).toHaveLength(2);
  });

  it("/api/engine/score: a refused position is a bad request (400), before the budget; nothing sent", async () => {
    for (const fen of Object.values(REFUSED)) {
      const { queries, db } = budgetDb();
      const res = await score({ ENGINE: {} as never, DB: db }, { fen, moves: ["e2e4"] });
      expect(res.status, fen).toBe(400);
      expect(await res.json()).toEqual({ message: "Bad request" });
      expect(queries, "the budget isn't touched").toEqual([]);
    }
    expect(sent).toEqual([]);
  });

  it("/api/engine/score: a legal position is searched, Chess960 too", async () => {
    const { queries, db } = budgetDb();
    const res = await score({ ENGINE: {} as never, DB: db }, { fen: START_FEN, moves: ["e2e4", "d2d4"] });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { moves: { move: string }[] }).moves.map((m) => m.move)).toEqual(["e2e4", "d2d4"]);
    expect(queries.length).toBeGreaterThan(0);
    const res960 = await score({ ENGINE: {} as never, DB: db }, { fen: C960, moves: C960_MOVES });
    expect(res960.status).toBe(200);
    expect(sent).toEqual([
      { instance: "engine-1", fen: START_FEN, moves: ["e2e4", "d2d4"] },
      { instance: "engine-1", fen: C960, moves: C960_MOVES },
    ]);
  });

  it("serverScoreAt (every match's re-checks): a refused position is no answer, never sent, one line logged", async () => {
    for (const fen of Object.values(REFUSED)) expect(await serverScoreAt({ ENGINE: {} as never }, fen, ["e2e4"]), fen).toBeNull();
    expect(sent).toEqual([]);
    expect(log).toHaveBeenCalledTimes(Object.keys(REFUSED).length);
    expect(String(log.mock.calls[0]![0])).toMatch(/^engine server: not sent, a position Stockfish refuses \(White has more than 8 pawns\): /);
  });

  it("serverScoreAt: a legal position is sent, Chess960 too", async () => {
    expect(await serverScoreAt({ ENGINE: {} as never }, START_FEN, ["e2e4"])).toEqual([{ move: "e2e4", expected: 0.5 }]);
    expect(await serverScoreAt({ ENGINE: {} as never }, C960, C960_MOVES)).toHaveLength(2);
    expect(sent.map((s) => s.fen)).toEqual([START_FEN, C960]);
    expect(log).not.toHaveBeenCalled();
  });

  it("fair play's deep search goes the same way: refused, nothing sent; legal, sent to its own instance", async () => {
    const search = containerSearch({ ENGINE: {} as never })!;
    expect(await search(REFUSED.ninePawns, ["e2e4"])).toBeNull();
    expect(sent).toEqual([]);
    expect(await search(C960, C960_MOVES)).toHaveLength(2);
    expect(sent).toEqual([{ instance: "fairplay-1", fen: C960, moves: C960_MOVES }]);
  });
});
