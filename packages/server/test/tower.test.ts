import { describe, expect, it, vi } from "vitest";
import { BATTLE_TOWER, finishFloor, floorSettings, newRun, pauseVariable, startFloor, towerPool } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { handleAccountApi } from "../src/api.ts";
import { finishTowerFloor, newTowerRun, runOf, startTowerFloor, stopTower, towerState, type TowerRunView } from "../src/tower.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: the match rooms import it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));

/**
 * The Battle Tower's saving (server tower.ts; docs/decisions/2026-11-18-battle-tower-design.md, section 5; docs/areas/battle-tower.md,
 * "Saving"): the tables and the one-open-run index, each route's happy path and refusals, a floor's result taken once and only for the
 * floor started, a win too soon refused, a free leave against a counted one, the best, the sign-in merge, the download and deleting.
 */
const T0 = 1_800_000_000_000;
const SEC = 1000;
const POOL = towerPool();
const SEED = 12345;
const MIN_WIN = BATTLE_TOWER.soloWinMinSeconds * SEC;

async function world() {
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql);
  return { sql, d1 };
}
const guest = async (sql: Sql, now = T0) => (await createGuest(sql, now, "Player")).user;
const signedIn = async (sql: Sql, email: string, now = T0) => signInWithIdentity(sql, await guest(sql, now), "email", email, {}, now);
const rows = (sql: Sql, userId: string) =>
  sql.all<{ kind: string; floor: number; status: string; fight: string | null; met: string }>("SELECT kind, floor, status, fight, met FROM tower_runs WHERE user_id = ? ORDER BY started_at, id", userId);
const best = async (sql: Sql, userId: string, kind = "solo") => (await sql.first<{ floor: number }>("SELECT floor FROM tower_best WHERE user_id = ? AND kind = ?", userId, kind))?.floor ?? 0;
const body = <T = Record<string, unknown>>(a: { body: Record<string, unknown> }) => a.body as T;

/** A run begun, then `wins` floors won (each a floor started and won, BATTLE_TOWER.soloWinMinSeconds apart). Answers the time after. */
async function climb(sql: Sql, userId: string, wins: number, now = T0, seed = SEED) {
  expect((await newTowerRun(sql, userId, now, { confirm: true, pool: POOL, seed })).status).toBe(200);
  let t = now;
  for (let i = 0; i < wins; i++) {
    const start = body<{ fight: { id: string } }>(await startTowerFloor(sql, userId, ++t, { pool: POOL }));
    t += MIN_WIN;
    expect((await finishTowerFloor(sql, userId, t, { fight: start.fight.id, outcome: "won" }, { pool: POOL, minWinMs: MIN_WIN })).status).toBe(200);
  }
  return t;
}

describe("the tables", () => {
  it("one open run an account and kind (the unique index); any number that ended; a solo and a party run side by side", async () => {
    const { sql } = await world();
    const add = (id: string, user: string, kind: string, status: string) =>
      sql.run("INSERT INTO tower_runs (id, user_id, kind, seed, floor, met, status, started_at, updated_at) VALUES (?, ?, ?, 1, 1, '{}', ?, ?, ?)", id, user, kind, status, T0, T0);
    await add("a", "u1", "solo", "open");
    await expect(add("b", "u1", "solo", "open")).rejects.toThrow(/UNIQUE/);
    await add("c", "u1", "party", "open");
    await add("d", "u2", "solo", "open");
    for (const [id, status] of [["e", "out"], ["f", "top"], ["g", "abandoned"], ["h", "out"]]) await add(id!, "u1", "solo", status!);
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM tower_runs WHERE user_id = 'u1'"))!.n).toBe(6);
    // (And the best: one row an account and kind.)
    await sql.run("INSERT INTO tower_best (user_id, kind, floor, at) VALUES ('u1', 'solo', 3, ?)", T0);
    await expect(sql.run("INSERT INTO tower_best (user_id, kind, floor, at) VALUES ('u1', 'solo', 4, ?)", T0)).rejects.toThrow(/UNIQUE|PRIMARY/);
  });
});

describe("a new run", () => {
  it("is floor 1 from the server's seed, its bosses core's deal from the pool now; GET shows it and a best of 0", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const made = await newTowerRun(sql, ann.id, T0, { confirm: false, pool: POOL, seed: SEED });
    expect(made.status).toBe(200);
    const run = body<{ run: TowerRunView }>(made).run;
    expect(run).toMatchObject({ kind: "solo", floor: 1, bosses: newRun(SEED, POOL).floors[0], beaten: [], fight: null, startedAt: T0 });
    const core = newRun(SEED, POOL);
    expect(await rows(sql, ann.id)).toEqual([{ kind: "solo", floor: 1, status: "open", fight: null, met: JSON.stringify({ floors: core.floors, deck: core.deck, decks: core.decks }) }]);
    expect(await towerState(sql, ann.id, POOL)).toEqual({ runs: { solo: run, party: null }, best: { solo: 0, party: 0 } });
  });

  it("replaces an open run only with confirm: without, 409 and that run, nothing written; with, the old one abandoned in the same batch", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await climb(sql, ann.id, 2);
    const asked = await newTowerRun(sql, ann.id, T0 + 100 * SEC, { confirm: false, pool: POOL, seed: 7 });
    expect(asked.status).toBe(409);
    expect(asked.body).toMatchObject({ confirm: true, message: "You have a run on floor 3. Starting a new one ends it.", run: { floor: 3 } });
    expect((await rows(sql, ann.id)).map((r) => [r.floor, r.status])).toEqual([[3, "open"]]);
    const replaced = await newTowerRun(sql, ann.id, T0 + 101 * SEC, { confirm: true, pool: POOL, seed: 7 });
    expect(replaced.status).toBe(200);
    expect((await rows(sql, ann.id)).map((r) => [r.floor, r.status])).toEqual([
      [3, "abandoned"],
      [1, "open"],
    ]);
    // The best stays; the next new run clears the runs that ended (the abandoned one), never the open one it replaces.
    expect(await best(sql, ann.id)).toBe(2);
    await newTowerRun(sql, ann.id, T0 + 102 * SEC, { confirm: true, pool: POOL, seed: 8 });
    expect((await rows(sql, ann.id)).map((r) => [r.floor, r.status])).toEqual([
      [1, "abandoned"],
      [1, "open"],
    ]);
    expect(await best(sql, ann.id)).toBe(2);
  });

  it("two starts at once make one open run: the unique index refuses the other, answered as without confirm", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const [a, b] = await Promise.all([1, 2].map((seed) => newTowerRun(sql, ann.id, T0, { confirm: false, pool: POOL, seed })));
    expect([a!.status, b!.status].sort()).toEqual([200, 409]);
    expect((await rows(sql, ann.id)).map((r) => r.status)).toEqual(["open"]);
  });

  it("no boss in the pool (every one resting): 503 and nothing written", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const none = await newTowerRun(sql, ann.id, T0, { confirm: false, pool: [], seed: SEED });
    expect(none).toEqual({ status: 503, body: { message: "The tower's bosses are resting for a bit. Back soon." } });
    expect(await rows(sql, ann.id)).toEqual([]);
  });
});

describe("a floor's start", () => {
  it("notes the start by the server's clock and answers core's settings; a second start answers the same floor, never a new one", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    expect((await startTowerFloor(sql, ann.id, T0, { pool: POOL })).status).toBe(404);
    await newTowerRun(sql, ann.id, T0, { confirm: false, pool: POOL, seed: SEED });
    const start = await startTowerFloor(sql, ann.id, T0 + 5 * SEC, { pool: POOL });
    const core = startFloor(newRun(SEED, POOL), POOL)!;
    expect(start.status).toBe(200);
    const s = body<{ fight: { id: string; startedAt: number }; floor: number; bosses: string[]; settings: unknown; run: TowerRunView }>(start);
    expect(s.fight).toEqual({ id: expect.stringMatching(/^[0-9a-f]{18}$/), startedAt: T0 + 5 * SEC });
    expect(s).toMatchObject({ floor: 1, bosses: core.run.floors[0], settings: core.settings, run: { fight: s.fight } });
    expect(s).not.toHaveProperty("under");
    const again = body(await startTowerFloor(sql, ann.id, T0 + 60 * SEC, { pool: POOL }));
    expect(again).toMatchObject({ fight: s.fight, under: true, floor: 1, settings: core.settings });
  });

  it("a boss resting since the deal is dealt again, and saved so (the floor's bosses then stay, whatever rests after its start)", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await newTowerRun(sql, ann.id, T0, { confirm: false, pool: POOL, seed: SEED });
    const dealt = newRun(SEED, POOL).floors[0]!;
    const off = towerPool(dealt);
    // GET shows the floor as its start will deal it now.
    const shown = (await towerState(sql, ann.id, off)).runs.solo!.bosses;
    expect(shown).not.toEqual(dealt);
    const s = body<{ bosses: string[]; settings: unknown }>(await startTowerFloor(sql, ann.id, T0 + SEC, { pool: off }));
    expect(s.bosses).toEqual(shown);
    expect(s.settings).toEqual(floorSettings({ floors: [shown] }));
    expect(runOf((await sql.first<{ seed: number; met: string; status: "open" }>("SELECT seed, met, status FROM tower_runs WHERE user_id = ?", ann.id))!).floors).toEqual([shown]);
    // Under way, the floor's bosses are the ones it began with, whatever the pool says now.
    expect((await towerState(sql, ann.id, POOL)).runs.solo!.bosses).toEqual(shown);
  });

  it("every boss resting: 503 and the run as it was", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await newTowerRun(sql, ann.id, T0, { confirm: false, pool: POOL, seed: SEED });
    const before = await rows(sql, ann.id);
    expect((await startTowerFloor(sql, ann.id, T0 + SEC, { pool: [] })).status).toBe(503);
    expect(await rows(sql, ann.id)).toEqual(before);
  });
});

describe("a floor's result: only for the floor started, once", () => {
  const started = async (sql: Sql, user: User, now = T0) => {
    await newTowerRun(sql, user.id, now, { confirm: false, pool: POOL, seed: SEED });
    return body<{ fight: { id: string } }>(await startTowerFloor(sql, user.id, now + SEC, { pool: POOL })).fight.id;
  };
  const finish = (sql: Sql, user: User, fight: unknown, outcome: unknown, now: number) => finishTowerFloor(sql, user.id, now, { fight, outcome }, { pool: POOL, minWinMs: MIN_WIN });

  it("won: the next floor dealt by core and saved, the best 1; a replay of it is refused and changes nothing", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const fight = await started(sql, ann);
    const won = await finish(sql, ann, fight, "won", T0 + 60 * SEC);
    const next = finishFloor(startFloor(newRun(SEED, POOL), POOL)!.run, "won", POOL);
    expect(won.status).toBe(200);
    expect(won.body).toMatchObject({ outcome: "won", floor: 1, status: "open", best: 1, run: { floor: 2, bosses: next.floors[1], beaten: [next.floors[0]], fight: null } });
    expect(runOf({ ...(await rows(sql, ann.id))[0]!, seed: SEED, status: "open" })).toEqual(next);
    const after = await rows(sql, ann.id);
    for (const outcome of ["won", "lost"]) expect(await finish(sql, ann, fight, outcome, T0 + 70 * SEC)).toEqual({ status: 409, body: { message: "That floor isn't under way." } });
    expect(await rows(sql, ann.id)).toEqual(after);
    expect(await best(sql, ann.id)).toBe(1);
  });

  it("refused: a floor never started (or another's id), no run, a bad outcome or id; the floor stays under way", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    expect((await finish(sql, ann, "0123456789abcdef01", "lost", T0)).status).toBe(409);
    const fight = await started(sql, ann);
    expect((await finish(sql, ann, "0123456789abcdef01", "lost", T0 + 60 * SEC)).status).toBe(409);
    for (const [f, o] of [[fight, "resigned"], [fight, null], [fight.toUpperCase(), "won"], [42, "won"], [undefined, "won"]]) expect((await finish(sql, ann, f, o, T0 + 60 * SEC)).status).toBe(400);
    // (Bo can't end Ann's floor.)
    const bo = await signedIn(sql, "bo@example.com");
    expect((await finish(sql, bo, fight, "lost", T0 + 60 * SEC)).status).toBe(409);
    expect((await rows(sql, ann.id))[0]).toMatchObject({ status: "open", fight: expect.stringContaining(fight) });
  });

  it("a win sooner than BATTLE_TOWER.soloWinMinSeconds after the start is refused, the floor still under way; at the minimum it's taken", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const fight = await started(sql, ann);
    const soon = await finish(sql, ann, fight, "won", T0 + SEC + MIN_WIN - 1);
    expect(soon).toMatchObject({ status: 409, body: { message: "That floor only just began.", fight: { id: fight } } });
    expect((await rows(sql, ann.id))[0]).toMatchObject({ floor: 1, status: "open", fight: expect.stringContaining(fight) });
    expect((await finish(sql, ann, fight, "won", T0 + SEC + MIN_WIN)).status).toBe(200);
  });

  it("lost or drawn at once: the run is out (one loss and you're out), its best as it was; nothing open after", async () => {
    const { sql } = await world();
    for (const outcome of ["lost", "drawn"] as const) {
      const ann = await signedIn(sql, `${outcome}@example.com`);
      const t = await climb(sql, ann.id, 3);
      const fight = body<{ fight: { id: string } }>(await startTowerFloor(sql, ann.id, t + 1, { pool: POOL })).fight.id;
      const out = await finish(sql, ann, fight, outcome, t + 2);
      expect(out).toEqual({ status: 200, body: { outcome, floor: 4, status: "out", run: null, best: 3 } });
      expect((await rows(sql, ann.id)).map((r) => [r.floor, r.status, r.fight])).toEqual([[4, "out", null]]);
      expect((await towerState(sql, ann.id, POOL)).runs.solo).toBeNull();
      expect((await startTowerFloor(sql, ann.id, t + 3, { pool: POOL })).status).toBe(404);
    }
  });

  it("two results for one floor at once (two tabs): one is taken, the other refused", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const fight = await started(sql, ann);
    const both = await Promise.all([finish(sql, ann, fight, "won", T0 + 60 * SEC), finish(sql, ann, fight, "lost", T0 + 60 * SEC)]);
    expect(both.map((a) => a.status).sort()).toEqual([200, 409]);
    const taken = both.find((a) => a.status === 200)!.body.outcome;
    expect((await rows(sql, ann.id))[0]).toMatchObject(taken === "won" ? { floor: 2, status: "open" } : { floor: 1, status: "out" });
  });

  it("floor 99 won: the run is complete (top), the best 99; no floor after it", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const t = await climb(sql, ann.id, BATTLE_TOWER.floors - 1);
    expect((await towerState(sql, ann.id, POOL)).runs.solo!.floor).toBe(99);
    const fight = body<{ fight: { id: string } }>(await startTowerFloor(sql, ann.id, t + 1, { pool: POOL })).fight.id;
    const top = await finish(sql, ann, fight, "won", t + 1 + MIN_WIN);
    expect(top).toEqual({ status: 200, body: { outcome: "won", floor: 99, status: "top", run: null, best: 99 } });
    expect((await rows(sql, ann.id)).map((r) => [r.floor, r.status])).toEqual([[99, "top"]]);
    expect(JSON.parse((await rows(sql, ann.id))[0]!.met).floors).toHaveLength(99);
    expect((await startTowerFloor(sql, ann.id, t + MIN_WIN * 2, { pool: POOL })).status).toBe(404);
  });

  it("the best only rises: a new run's lower floors leave it; one a result's own write missed is set right by the next result, or the next run", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const t = await climb(sql, ann.id, 4);
    const t2 = await climb(sql, ann.id, 2, t + 1, 99);
    expect(await best(sql, ann.id)).toBe(4);
    // (The Worker stopped between a result and its best: the next result works it out again from the runs, the abandoned one's too.)
    await sql.run("UPDATE tower_best SET floor = 1 WHERE user_id = ?", ann.id);
    const fight = body<{ fight: { id: string } }>(await startTowerFloor(sql, ann.id, t2 + 1, { pool: POOL })).fight.id;
    await finish(sql, ann, fight, "lost", t2 + 2);
    expect(await best(sql, ann.id)).toBe(4);
    // (And a new run, before the runs that ended go.)
    await sql.run("UPDATE tower_best SET floor = 1 WHERE user_id = ?", ann.id);
    await newTowerRun(sql, ann.id, t2 + 3, { confirm: false, pool: POOL, seed: 5 });
    expect(await best(sql, ann.id)).toBe(4);
    expect((await rows(sql, ann.id)).map((r) => r.status)).toEqual(["open"]);
  });
});

describe("stop", () => {
  const underWay = async (sql: Sql, user: User, wins = 1) => {
    const t = await climb(sql, user.id, wins);
    const s = body<{ fight: { id: string }; bosses: string[] }>(await startTowerFloor(sql, user.id, t + 1, { pool: POOL }));
    return { t: t + 1, fight: s.fight.id, bosses: s.bosses };
  };

  it("between floors: nothing to do, a clean answer, the run as it was; with no run at all, too", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    expect(await stopTower(sql, ann.id, T0, {}, { pool: POOL })).toEqual({ status: 200, body: { stopped: "between", run: null } });
    const t = await climb(sql, ann.id, 2);
    const before = await rows(sql, ann.id);
    const stop = await stopTower(sql, ann.id, t + 1, {}, { pool: POOL });
    expect(stop).toMatchObject({ status: 200, body: { stopped: "between", run: { floor: 3, fight: null } } });
    expect(await rows(sql, ann.id)).toEqual(before);
  });

  it("mid-floor before your 2nd move: free, the same floor and bosses later (a new start, a new id); from the 2nd: a loss, the run out", async () => {
    const { sql } = await world();
    for (const moves of [0, 1]) {
      const ann = await signedIn(sql, `free${moves}@example.com`);
      const u = await underWay(sql, ann);
      const free = await stopTower(sql, ann.id, u.t + 1, { fight: u.fight, moves }, { pool: POOL });
      expect(free).toMatchObject({ status: 200, body: { stopped: "free", floor: 2, status: "open", run: { floor: 2, bosses: u.bosses, fight: null } } });
      expect((await rows(sql, ann.id))[0]).toMatchObject({ floor: 2, status: "open", fight: null });
      const again = body<{ fight: { id: string }; bosses: string[] }>(await startTowerFloor(sql, ann.id, u.t + 2, { pool: POOL }));
      expect(again.bosses).toEqual(u.bosses);
      expect(again.fight.id).not.toBe(u.fight);
    }
    for (const moves of [2, 30, undefined, -1, 1.5, "0"]) {
      const ann = await signedIn(sql, `lost${String(moves)}@example.com`);
      const u = await underWay(sql, ann);
      const lost = await stopTower(sql, ann.id, u.t + 1, { fight: u.fight, moves }, { pool: POOL });
      expect(lost, `moves ${String(moves)}`).toEqual({ status: 200, body: { stopped: "lost", floor: 2, status: "out", run: null } });
      expect(await best(sql, ann.id)).toBe(1);
    }
  });

  it("only for the floor under way: another id is refused (never a floor started since); a repeat of a stop changes nothing", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const u = await underWay(sql, ann);
    await stopTower(sql, ann.id, u.t + 1, { fight: u.fight, moves: 0 }, { pool: POOL });
    const next = body<{ fight: { id: string } }>(await startTowerFloor(sql, ann.id, u.t + 2, { pool: POOL })).fight.id;
    // (The first floor's stop again, now a counted one: refused, the floor started since untouched.)
    const stale = await stopTower(sql, ann.id, u.t + 3, { fight: u.fight, moves: 5 }, { pool: POOL });
    expect(stale).toMatchObject({ status: 409, body: { message: "That floor isn't under way.", fight: { id: next } } });
    for (const fight of [undefined, null]) expect((await stopTower(sql, ann.id, u.t + 3, { fight, moves: 0 }, { pool: POOL })).status).toBe(409);
    expect((await rows(sql, ann.id))[0]).toMatchObject({ status: "open", fight: expect.stringContaining(next) });
    // A stop that ended its floor, sent again: nothing under way, so nothing to do.
    await stopTower(sql, ann.id, u.t + 4, { fight: next, moves: 3 }, { pool: POOL });
    expect(await stopTower(sql, ann.id, u.t + 5, { fight: next, moves: 3 }, { pool: POOL })).toEqual({ status: 200, body: { stopped: "between", run: null } });
  });
});

describe("the sign-in merge", () => {
  /** A guest and an account, each with a solo climb of `g` and `a` floors won (null: none), the guest's floor under way. */
  async function pair(g: number | null, a: number | null) {
    const { sql } = await world();
    const account = await signedIn(sql, "ann@example.com");
    if (a !== null) await climb(sql, account.id, a, T0, 1);
    const visitor = await guest(sql);
    let fight: string | null = null;
    if (g !== null) {
      const t = await climb(sql, visitor.id, g, T0, 2);
      fight = body<{ fight: { id: string } }>(await startTowerFloor(sql, visitor.id, t + 1, { pool: POOL })).fight.id;
    }
    await signInWithIdentity(sql, visitor, "email", "ann@example.com", {}, T0 + 3_600_000);
    return { sql, account, visitor, fight };
  }
  const open = (sql: Sql, id: string) => sql.all<{ floor: number; fight: string | null }>("SELECT floor, fight FROM tower_runs WHERE user_id = ? AND status = 'open'", id);

  it("a guest's run and best move to the account that has none", async () => {
    const { sql, account, visitor, fight } = await pair(3, null);
    expect(await open(sql, account.id)).toEqual([{ floor: 4, fight: expect.stringContaining(fight!) }]);
    expect(await best(sql, account.id)).toBe(3);
    expect(await sql.all("SELECT 1 FROM tower_runs WHERE user_id = ? UNION ALL SELECT 1 FROM tower_best WHERE user_id = ?", visitor.id, visitor.id)).toEqual([]);
  });

  it("two open runs: the guest's higher floor stays open (its floor still under way), the account's is abandoned; the best is the higher", async () => {
    const { sql, account, fight } = await pair(5, 2);
    expect(await open(sql, account.id)).toEqual([{ floor: 6, fight: expect.stringContaining(fight!) }]);
    expect((await rows(sql, account.id)).map((r) => [r.floor, r.status]).sort()).toEqual([
      [3, "abandoned"],
      [6, "open"],
    ]);
    expect(await best(sql, account.id)).toBe(5);
  });

  it("two open runs: the account's higher floor stays, the guest's is abandoned (and so is the guest's on a tie); the account's best stays", async () => {
    for (const [g, a] of [
      [1, 4],
      [3, 3],
    ] as const) {
      const { sql, account } = await pair(g, a);
      expect((await open(sql, account.id)).map((r) => r.floor)).toEqual([a + 1]);
      expect((await rows(sql, account.id)).map((r) => [r.floor, r.status]).sort()).toEqual(
        [
          [a + 1, "open"],
          [g + 1, "abandoned"],
        ].sort(),
      );
      expect(await best(sql, account.id)).toBe(a);
    }
  });

  it("a guest with nothing leaves the account's run and best as they were", async () => {
    const { sql, account } = await pair(null, 2);
    expect(await open(sql, account.id)).toEqual([{ floor: 3, fight: null }]);
    expect(await best(sql, account.id)).toBe(2);
  });
});

describe("download my data and deleting the account", () => {
  it("the download has your climbs (the floors met, never the seed or the deck) and bests; deleting removes every row", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const bo = await signedIn(sql, "bo@example.com");
    const t = await climb(sql, ann.id, 2);
    await startTowerFloor(sql, ann.id, t + 1, { pool: POOL });
    await climb(sql, bo.id, 1);
    const d = (await accountDownload(sql, ann, t + 2)) as { tower: { runs: Record<string, unknown>[]; best: unknown[] } };
    const floors = runOf({ ...(await sql.first<{ met: string }>("SELECT met FROM tower_runs WHERE user_id = ?", ann.id))!, seed: SEED, status: "open" }).floors;
    expect(d.tower).toEqual({
      runs: [{ kind: "solo", floor: 3, status: "open", floors, fight_at: new Date(t + 1).toISOString(), started_at: new Date(T0).toISOString(), updated_at: new Date(t + 1).toISOString() }],
      best: [{ kind: "solo", floor: 2, at: expect.any(String) }],
    });
    expect(JSON.stringify(d.tower)).not.toMatch(/seed|deck/);
    await deleteAccount(sql, ann, t + 3);
    expect(await sql.all("SELECT user_id FROM tower_runs UNION ALL SELECT user_id FROM tower_best")).toEqual([{ user_id: bo.id }, { user_id: bo.id }]);
  });
});

describe("the API", () => {
  const call = async (d1: unknown, cookie: string | null, path: string, body?: unknown, env: Record<string, unknown> = {}) => {
    const headers: Record<string, string> = cookie ? { cookie } : {};
    const res = (await handleAccountApi(new Request(`https://hunchess.com${path}`, body === undefined ? { headers } : { method: "POST", body: JSON.stringify(body), headers }), { DB: d1, ...env } as never))!;
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const cookieOf = async (sql: Sql, id: string) => `hc_session=${await createSession(sql, id, Date.now())}`;

  it("a guest climbs: GET, a new run, a floor's start, its result, the next floor, a stop; the seed is never the device's", async () => {
    const { sql, d1 } = await world();
    const visitor = await guest(sql, Date.now());
    const cookie = await cookieOf(sql, visitor.id);
    const env = { TEST_SWITCHES: "1" };
    expect(await call(d1, cookie, "/api/tower")).toEqual({ status: 200, body: { runs: { solo: null, party: null }, best: { solo: 0, party: 0 } } });
    const made = await call(d1, cookie, "/api/tower/run", { seed: 1, kind: "solo" }, env);
    expect(made).toMatchObject({ status: 200, body: { run: { floor: 1, fight: null } } });
    expect((await sql.first<{ seed: number }>("SELECT seed FROM tower_runs WHERE user_id = ?", visitor.id))!.seed).not.toBe(1);
    expect((await call(d1, cookie, "/api/tower/run", {}, env)).body).toMatchObject({ confirm: true });
    const start = await call(d1, cookie, "/api/tower/floor/start", {}, env);
    expect(start).toMatchObject({ status: 200, body: { floor: 1, settings: { towerFloor: 1 } } });
    const fight = (start.body.fight as { id: string }).id;
    // (Test switches on: no minimum for a win.)
    const won = await call(d1, cookie, "/api/tower/floor/finish", { fight, outcome: "won" }, env);
    expect(won).toMatchObject({ status: 200, body: { status: "open", best: 1, run: { floor: 2 } } });
    expect((await call(d1, cookie, "/api/tower/floor/finish", { fight, outcome: "won" }, env)).status).toBe(409);
    expect((await call(d1, cookie, "/api/tower/stop", {}, env)).body).toMatchObject({ stopped: "between", run: { floor: 2 } });
    const next = ((await call(d1, cookie, "/api/tower/floor/start", {}, env)).body.fight as { id: string }).id;
    expect((await call(d1, cookie, "/api/tower/stop", { fight: next, moves: 1 }, env)).body).toMatchObject({ stopped: "free", run: { floor: 2 } });
    expect((await call(d1, cookie, "/api/tower")).body).toMatchObject({ runs: { solo: { floor: 2, fight: null } }, best: { solo: 1 } });
  });

  it("without test switches a win at once is too soon; solo resting refuses a new run or floor, never one under way; a party run, later; no session, 401", async () => {
    const { sql, d1 } = await world();
    const ann = await signedIn(sql, "ann@example.com", Date.now());
    const cookie = await cookieOf(sql, ann.id);
    await call(d1, cookie, "/api/tower/run", {});
    const fight = ((await call(d1, cookie, "/api/tower/floor/start", {})).body.fight as { id: string }).id;
    expect(await call(d1, cookie, "/api/tower/floor/finish", { fight, outcome: "won" })).toMatchObject({ status: 409, body: { message: "That floor only just began." } });
    // (Solo resting: the floor under way still answers its start (a reload rejoining it) and its result; no new run or floor.)
    const resting = { PAUSE_SOLO: "1" };
    expect(await call(d1, cookie, "/api/tower/floor/start", {}, resting)).toMatchObject({ status: 200, body: { under: true, fight: { id: fight } } });
    expect(await call(d1, cookie, "/api/tower/floor/finish", { fight, outcome: "lost" }, resting)).toMatchObject({ status: 200, body: { status: "out" } });
    expect(await call(d1, cookie, "/api/tower/run", { confirm: true }, resting)).toEqual({ status: 503, body: { message: "Solo and Boss alone are resting for a bit. Back soon.", paused: "solo" } });
    await call(d1, cookie, "/api/tower/run", {});
    expect(await call(d1, cookie, "/api/tower/floor/start", {}, resting)).toMatchObject({ status: 503, body: { paused: "solo" } });
    expect(await call(d1, cookie, "/api/tower/run", { kind: "party" })).toEqual({ status: 400, body: { message: "Party runs aren't open yet." } });
    expect((await call(d1, null, "/api/tower")).status).toBe(401);
    expect((await call(d1, cookie, "/api/tower/nope", {})).status).toBe(404);
  });

  it("a boss resting (its kill switch) is never dealt", async () => {
    const { sql, d1 } = await world();
    const ann = await signedIn(sql, "ann@example.com", Date.now());
    const cookie = await cookieOf(sql, ann.id);
    const all = Object.fromEntries(POOL.slice(1).map((b) => [pauseVariable(`boss:${b}`), "1"]));
    const made = await call(d1, cookie, "/api/tower/run", {}, all);
    expect((made.body.run as TowerRunView).bosses).toEqual([POOL[0]]);
  });
});
