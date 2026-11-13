import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { START_FEN, chess960Fen, legalMoves960, stockfishRefuses } from "@chessroyale/chess";

/**
 * The engine server's one way in (engine.ts, `containerScore`): a position Stockfish refuses never reaches the
 * container (Stockfish would end its process, and the container with it), from `/api/engine/score`, `serverScoreAt`
 * (every match's re-checks) or fair play's deep search; a legal one, Chess960 included, still does.
 */

// (The real container needs the Workers runtime: a stub that records what it's sent and scores every move 0.5.)
const sent = vi.hoisted(() => [] as { instance: string; fen: string; moves: string[] }[]);
// (Searches that fail, by their number from the test's start (a container still waking: no answer).)
const failing = vi.hoisted(() => ({ calls: 0, at: new Set<number>() }));
vi.mock("@cloudflare/containers", () => ({
  Container: class {},
  getContainer: (_ns: unknown, instance: string) => ({
    fetch: async (_url: string, init: { body: string }) => {
      if (failing.at.has(failing.calls++)) return new Response("", { status: 503 });
      const body = JSON.parse(init.body) as { fen: string; moves: string[] };
      sent.push({ instance, fen: body.fen, moves: body.moves });
      return new Response(JSON.stringify({ moves: body.moves.map((move) => ({ move, expected: 0.5 })) }));
    },
  }),
}));

import { ENGINE_SERVER } from "@chessroyale/core";
import worker, { type Env } from "../src/index.ts";
import { createGuest, ensureSchema, signInWithIdentity } from "../src/accounts.ts";
import { SESSION_COOKIE } from "../src/api.ts";
import { memoryDb } from "./memory-db.ts";
import { serverAllMovesAt, serverScoreAt, soloCap } from "../src/engine.ts";
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
async function score(env: Partial<Env>, body: unknown, cookie?: string) {
  // (A new address each time, so the per-address rate limit never answers instead.)
  const request = new Request("https://hunchess.test/api/engine/score", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "cf-connecting-ip": `10.0.0.${++ip}`, ...(cookie ? { cookie } : {}) },
  });
  return worker.fetch(request, env as Env, ctx);
}
async function ping(env: Partial<Env>, cookie?: string) {
  return worker.fetch(new Request("https://hunchess.test/api/engine/ping", { headers: { "cf-connecting-ip": `10.0.1.${++ip}`, ...(cookie ? { cookie } : {}) } }), env as Env, ctx);
}

/** D1 with accounts: a guest's session cookie and a signed-in account's. */
async function accountsDb() {
  const { sql, d1, db } = memoryDb();
  await ensureSchema(sql, d1);
  // (engine.ts makes this table once per Worker instance: in a test's fresh database, here.)
  db.exec("CREATE TABLE IF NOT EXISTS engine_usage (day TEXT PRIMARY KEY, searches INTEGER NOT NULL)");
  const guest = await createGuest(sql, Date.now(), "Guest");
  const ann = await createGuest(sql, Date.now(), "Ann");
  await signInWithIdentity(sql, ann.user, "email", "ann@example.com", {}, Date.now());
  const usage = (key: string) => (db.prepare("SELECT searches FROM engine_usage WHERE day = ?").get(key) as { searches: number } | undefined)?.searches ?? 0;
  return { sql, d1, db, usage, guest: `${SESSION_COOKIE}=${guest.token}`, ann: `${SESSION_COOKIE}=${ann.token}`, annId: ann.user.id };
}

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  sent.length = 0;
  failing.calls = 0;
  failing.at.clear();
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
    const { d1, guest, usage } = await accountsDb();
    const res = await score({ ENGINE: {} as never, DB: d1 }, { fen: START_FEN, moves: ["e2e4", "d2d4"] }, guest);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { moves: { move: string }[] }).moves.map((m) => m.move)).toEqual(["e2e4", "d2d4"]);
    expect(usage(new Date().toISOString().slice(0, 10))).toBe(1);
    const res960 = await score({ ENGINE: {} as never, DB: d1 }, { fen: C960, moves: C960_MOVES }, guest);
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

  it("the Hidden Boss's phase 2 (serverAllMovesAt): every legal move in groups of 8; the first group tried twice (a container still waking), a later one once", async () => {
    const all = legalMoves960(C960);
    const groups = Math.ceil(all.length / 8);
    expect(groups).toBeGreaterThan(2);
    expect((await serverAllMovesAt({ ENGINE: {} as never }, C960, 1000))?.map((s) => s.move).sort()).toEqual([...all].sort());
    expect(sent).toHaveLength(groups);
    // (The first group's first try fails: tried again, and the position is scored.)
    sent.length = 0;
    failing.calls = 0;
    failing.at.add(0);
    expect(await serverAllMovesAt({ ENGINE: {} as never }, C960, 1000)).toHaveLength(all.length);
    expect(sent).toHaveLength(groups);
    expect(failing.calls).toBe(groups + 1);
    // (Both tries fail: no answer; the device's turn.)
    failing.calls = 0;
    failing.at.add(1);
    expect(await serverAllMovesAt({ ENGINE: {} as never }, C960, 1000)).toBeNull();
    expect(failing.calls).toBe(2);
    // (A later group fails: no answer at once, no second try.)
    failing.calls = 0;
    failing.at.clear();
    failing.at.add(1);
    expect(await serverAllMovesAt({ ENGINE: {} as never }, C960, 1000)).toBeNull();
    expect(failing.calls).toBe(2);
  });

  it("fair play's deep search goes the same way: refused, nothing sent; legal, sent to its own instance", async () => {
    const search = containerSearch({ ENGINE: {} as never })!;
    expect(await search(REFUSED.ninePawns, ["e2e4"])).toBeNull();
    expect(sent).toEqual([]);
    expect(await search(C960, C960_MOVES)).toHaveLength(2);
    expect(sent).toEqual([{ instance: "fairplay-1", fen: C960, moves: C960_MOVES }]);
  });
});

describe("the engine server's open routes need an account and stop at a cap (Nov 10, finding 4)", () => {
  const legal = { fen: START_FEN, moves: ["e2e4", "d2d4"] };

  it("no account (no session, or one that isn't stored): 401, nothing searched, the budget untouched; the ping too", async () => {
    const { d1, usage } = await accountsDb();
    for (const cookie of [undefined, `${SESSION_COOKIE}=${"x".repeat(43)}`]) {
      const res = await score({ ENGINE: {} as never, DB: d1 }, legal, cookie);
      expect(res.status).toBe(401);
      expect((await ping({ ENGINE: {} as never, DB: d1 }, cookie)).status).toBe(401);
    }
    // (And with no D1 at all: no account can be known.)
    expect((await score({ ENGINE: {} as never }, legal)).status).toBe(401);
    expect(sent).toEqual([]);
    expect(usage(new Date().toISOString().slice(0, 10))).toBe(0);
  });

  it("where sign-in is set up, a guest is refused and a signed-in account searches", async () => {
    const { d1, guest, ann } = await accountsDb();
    const env = { ENGINE: {} as never, DB: d1, RESEND_API_KEY: "re_test" };
    expect((await score(env, legal, guest)).status).toBe(401);
    expect((await ping(env, guest)).status).toBe(401);
    expect((await score(env, legal, ann)).status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it("an account's calls a day: ENGINE_SERVER.perAccountDaily (searches and pings alike), then 429; another account isn't held up", async () => {
    const { d1, db, ann, guest, annId } = await accountsDb();
    const env = { ENGINE: {} as never, DB: d1 };
    const day = new Date().toISOString().slice(0, 10);
    db.prepare("INSERT INTO engine_calls (user_id, day, n) VALUES (?, ?, ?)").run(annId, day, ENGINE_SERVER.perAccountDaily - 2);
    expect((await ping(env, ann)).status).toBe(200);
    expect((await score(env, legal, ann)).status).toBe(200);
    const over = await score(env, legal, ann);
    expect(over.status).toBe(429);
    expect((await ping(env, ann)).status).toBe(429);
    expect(sent).toHaveLength(1);
    expect((await score(env, legal, guest)).status).toBe(200);
  });

  it("solo's searches stop at ENGINE_SERVER.soloDailySearches; matches keep the rest of the day's budget", async () => {
    const { d1, db, guest } = await accountsDb();
    const env = { ENGINE: {} as never, DB: d1 };
    const day = new Date().toISOString().slice(0, 10);
    db.prepare("INSERT INTO engine_usage (day, searches) VALUES (?, ?), (?, ?)").run(`${day}:solo`, ENGINE_SERVER.soloDailySearches, day, ENGINE_SERVER.soloDailySearches);
    expect((await score(env, legal, guest)).status).toBe(503);
    expect(sent).toEqual([]);
    // A match's re-check still searches.
    expect(await serverScoreAt(env, START_FEN, ["e2e4"])).toEqual([{ move: "e2e4", expected: 0.5 }]);
    expect(sent).toHaveLength(1);
  });

  it("a lowered day's budget (staging, say): solo never takes more than ENGINE_SERVER.soloShare of it (the review of #610, m5)", async () => {
    const { d1, db, guest, usage } = await accountsDb();
    const env = { ENGINE: {} as never, DB: d1, ENGINE_DAILY_SEARCHES: "600" };
    expect(soloCap(600)).toBe(Math.floor(600 * ENGINE_SERVER.soloShare));
    expect(soloCap(600)).toBeLessThan(ENGINE_SERVER.soloDailySearches);
    expect(soloCap(3000)).toBe(ENGINE_SERVER.soloDailySearches);
    const day = new Date().toISOString().slice(0, 10);
    db.prepare("INSERT INTO engine_usage (day, searches) VALUES (?, ?), (?, ?)").run(`${day}:solo`, soloCap(600) - 1, day, soloCap(600) - 1);
    expect((await score(env, legal, guest)).status).toBe(200);
    expect((await score(env, legal, guest)).status).toBe(503);
    expect(sent).toHaveLength(1);
    expect(usage(day)).toBe(soloCap(600));
  });
});
