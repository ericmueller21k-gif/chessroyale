import { beforeEach, describe, expect, it } from "vitest";
import { ITEM_DEFS, LADDER, RANKED_1V1, ladderPlaces, type LadderAnswer, type LadderRow } from "@chessroyale/core";
import { createGuest, ensureSchema, type Sql, type User } from "../src/accounts.ts";
import { setCase } from "../src/fairplay.ts";
import { LADDER_ROWS_SQL, handleLadder, ladderTop, ladderYou, type EdgeCache } from "../src/ladder.ts";
import { SHOWN_ABOVE_SQL, SHOWN_ALL_SQL, forgetTopPlaces, rankOf, topPlace } from "../src/ranked-schema.ts";
import { rot13 } from "../src/text-filter.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * The season ladder (ladder.ts; docs/decisions/2026-11-25-ladder.md): the top LADDER.size rows in ladder order with shared places,
 * the count, the accounts left out (banned, the engine pool, test accounts) and the top tiers' place agreeing with it, your own
 * standing wherever you are, the looks in one batched read within D1's 100 bound values, the plans on the new index, and the route
 * with the edge's minute (your row never kept).
 */

const T0 = 1_800_000_000_000;
const P = RANKED_1V1.placements.games;

async function setup() {
  const { sql, db, d1 } = memoryDb();
  await ensureSchema(sql);
  return { sql, db, d1 };
}

beforeEach(() => forgetTopPlaces());

/** Players on the ladder at these ladders (ids "p000", "p001", …; names "Player 0", …; `games` each, 60% won). */
async function players(sql: Sql, ladders: readonly number[], { from = 0, games = 40 } = {}): Promise<string[]> {
  const ids: string[] = [];
  for (const [i, l] of ladders.entries()) {
    const id = `p${String(from + i).padStart(3, "0")}`;
    ids.push(id);
    await sql.run("INSERT INTO users (id, name, created_at, last_seen) VALUES (?, ?, ?, ?)", id, `Player ${from + i}`, T0, T0);
    const wins = Math.round(games * 0.6);
    await sql.run(
      "INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_at, streak) VALUES (?, 2000, 60, ?, ?, ?, 1, ?, ?, 2)",
      id,
      games,
      wins,
      games - wins - 1,
      games >= P ? l : null,
      T0,
    );
  }
  return ids;
}

/** Every query a database is asked, with its bound values (to count reads and check D1's limit of 100 bound values a query). */
function spying(sql: Sql) {
  const asked: { q: string; n: number }[] = [];
  const log = (q: string, p: unknown[]) => asked.push({ q, n: p.length });
  const spy: Sql = {
    ...sql,
    first: (q, ...p) => (log(q, p), sql.first(q, ...p)),
    all: (q, ...p) => (log(q, p), sql.all(q, ...p)),
    run: (q, ...p) => (log(q, p), sql.run(q, ...p)),
  };
  return { spy, asked };
}

/** A player signed in (an email: not a guest). */
async function signedIn(sql: Sql, name = "Me"): Promise<{ user: User; token: string }> {
  const g = await createGuest(sql, T0, name);
  await sql.run("UPDATE users SET email = ? WHERE id = ?", `${g.user.id}@example.com`, g.user.id);
  return { user: { ...g.user, email: `${g.user.id}@example.com` }, token: g.token };
}

const rankRow = (sql: Sql, id: string, games: number, ladder: number | null) =>
  sql.run("INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_at) VALUES (?, 1800, 80, ?, ?, ?, 0, ?, ?)", id, games, Math.floor(games / 2), games - Math.floor(games / 2), ladder, T0);

describe("the ladder's top", () => {
  it("the top 200 of 250 in ladder order, places shared by equal ladders, the count of everyone placed", async () => {
    const { sql } = await setup();
    // 250 placed players, 3200 down two points apart, with two ties (rows 3-4 and 120-122), and 3 still in placements.
    const ladders = Array.from({ length: 250 }, (_, i) => 3200 - 2 * i);
    ladders[4] = ladders[3]!;
    ladders[121] = ladders[120]!;
    ladders[122] = ladders[120]!;
    await players(sql, ladders);
    await players(sql, [0, 0, 0], { from: 250, games: P - 1 });
    const top = await ladderTop(sql);
    expect(top.rows).toHaveLength(LADDER.size);
    expect(top.total).toBe(250);
    const got = top.rows.map((r) => r.rank.ladder!);
    expect(got).toEqual([...got].sort((a, b) => b - a));
    expect(top.rows.map((r) => r.place).slice(0, 6)).toEqual([1, 2, 3, 4, 4, 6]);
    expect(top.rows.slice(120, 124).map((r) => r.place)).toEqual([121, 121, 121, 124]);
    // (Nobody in placements: they have no ladder yet.)
    expect(top.rows.some((r) => Number(r.uid.slice(1)) >= 250)).toBe(false);
    // A row carries what the page shows: name, rank (the top tiers by place, as everywhere), record, streak.
    const first = top.rows[0]!;
    expect(first).toMatchObject({ uid: "p000", name: "Player 0", place: 1, wins: 24, losses: 15, draws: 1, streak: 2 });
    expect(first.rank.tier).toBe("Transcendent");
    expect(top.rows[150]!.rank.tier).toBe("Pearlescent");
    // The same tier the profile shows for that ladder (topPlace's count).
    for (const r of [top.rows[0]!, top.rows[99]!, top.rows[100]!, top.rows[199]!]) expect((await rankOf(sql, { games: 40, ladder: r.rank.ladder })).label).toBe(r.rank.label);
  });

  it("fewer than 200: everyone, the list ends there", async () => {
    const { sql } = await setup();
    await players(sql, [1500, 1400, 1000]);
    const top = await ladderTop(sql);
    expect(top.rows.map((r) => r.place)).toEqual([1, 2, 3]);
    expect(top.total).toBe(3);
    expect(top.rows[2]!.rank.label).toBe("Gold 3 · 40 RP");
  });

  it("banned players, the engine pool and test accounts are left out of the list, the count and everyone's place; residents and the rest stay", async () => {
    const { sql } = await setup();
    const [banned, pooled, test, a, b] = await players(sql, [3100, 3000, 2950, 2900, 2850]);
    await setCase(sql, banned!, "banned", "admin:x@example.com", "engine", T0);
    await setCase(sql, pooled!, "pool", "admin:x@example.com", "engine", T0);
    await sql.run("UPDATE users SET test = 1 WHERE id = ?", test);
    // (A resident (residents.ts) is a real-looking player by design: on the ladder like anyone.)
    await sql.run("UPDATE users SET resident = 1 WHERE id = ?", b);
    const top = await ladderTop(sql);
    expect(top.rows.map((r) => r.uid)).toEqual([a, b]);
    expect(top.rows.map((r) => r.place)).toEqual([1, 2]);
    expect(top.total).toBe(2);
    // The top tiers' place counts the same players (since Nov 25, banned ones left out too): the list's place and the tier agree.
    expect(await topPlace(sql, 2900, T0)).toBe(1);
    expect(await topPlace(sql, 2850, T0)).toBe(2);
  });

  it("a stray case with no account id (a TEXT key may hold NULL) never empties the list", async () => {
    const { sql } = await setup();
    await players(sql, [2000, 1900]);
    await sql.run("INSERT INTO fairplay_cases (user_id, status, opened_at, updated_at) VALUES (NULL, 'banned', 1, 1)");
    expect((await ladderTop(sql)).rows).toHaveLength(2);
  });

  it("names through the seat filter, as the stage shows them", async () => {
    const { sql } = await setup();
    const [id] = await players(sql, [2000]);
    await sql.run("UPDATE users SET name = ? WHERE id = ?", `${rot13("avttre")}99`, id);
    expect((await ladderTop(sql)).rows[0]!.name).toBe("Player");
  });

  it("the 200 players' looks in one read, within D1's 100 bound values a query", async () => {
    const { sql } = await setup();
    const ids = await players(sql, Array.from({ length: 230 }, (_, i) => 3000 - i));
    // Every player wears a hat (the first head item), so every row's look comes from the batched read.
    const hat = ITEM_DEFS.find((d) => d.slot === "head")!;
    for (const [i, id] of ids.entries()) {
      await sql.run("INSERT INTO items (id, user_id, def, color, blemish, seed, crate, created_at) VALUES (?, ?, ?, 'red', 0, ?, 'test', ?)", `it${i}`, id, hat.id, i, T0);
      await sql.run("INSERT INTO equipped_items (user_id, slot, item_id) VALUES (?, 'head', ?)", id, `it${i}`);
    }
    const { spy, asked } = spying(sql);
    const top = await ladderTop(spy);
    expect(top.rows.every((r: LadderRow) => r.look.head?.def === hat.id)).toBe(true);
    expect(asked.filter((a) => a.q.includes("equipped_items"))).toHaveLength(1);
    // The rows, the count and the looks: three reads, none over 100 bound values.
    expect(asked).toHaveLength(3);
    expect(Math.max(...asked.map((a) => a.n))).toBeLessThanOrEqual(100);
  });

  it("the plans: the rows read in order from the new index (no sort), the count and the place from the ladder's index alone, the looks by their key", async () => {
    const { sql, db } = await setup();
    await players(sql, [3000, 2000, 1000]);
    type Step = { parent: number; detail: string };
    const plan = (q: string, ...p: unknown[]) => db.prepare(`EXPLAIN QUERY PLAN ${q}`).all(...(p as never[])) as Step[];
    const text = (steps: Step[]) => steps.map((r) => r.detail).join(" | ");
    const rows = plan(LADDER_ROWS_SQL, LADDER.size);
    expect(text(rows)).toMatch(/SEARCH r USING INDEX ranked_1v1_board \(ladder>\?\)/);
    // (No sort of the list itself: only the left-out list's own steps below it, never at the top.)
    expect(rows.filter((r) => r.parent === 0).map((r) => r.detail).join(" | ")).not.toMatch(/TEMP B-TREE/);
    expect(text(plan(SHOWN_ALL_SQL))).toMatch(/SEARCH ranked_1v1 USING COVERING INDEX ranked_1v1_ladder \(ladder>\?\)/);
    expect(text(plan(SHOWN_ABOVE_SQL, 2000))).toMatch(/SEARCH ranked_1v1 USING COVERING INDEX ranked_1v1_ladder \(ladder>\?\)/);
    for (const q of [LADDER_ROWS_SQL, SHOWN_ALL_SQL, SHOWN_ABOVE_SQL]) expect(text(plan(q, ...(q === SHOWN_ALL_SQL ? [] : [1])))).not.toMatch(/SCAN ranked_1v1\b|SCAN r\b(?! USING)/);
    expect(text(plan("SELECT e.user_id FROM equipped_items e WHERE e.user_id IN (SELECT value FROM json_each(?))", "[]"))).toMatch(/SEARCH e USING (COVERING )?INDEX sqlite_autoindex_equipped_items_1 \(user_id=\?\)/);
  });
});

describe("your standing", () => {
  it("your row with your exact place, far below the 200; in the list when you're in it", async () => {
    const { sql } = await setup();
    await players(sql, Array.from({ length: 240 }, (_, i) => 3000 - i));
    const me = await signedIn(sql, "Mia");
    await rankRow(sql, me.user.id, 30, 2770);
    const you = (await ladderYou(sql, me.user, false)) as LadderRow;
    // 3000 … 2761: 230 ladders above 2770, and 2770 itself is shared with p230 (the same place).
    expect(you).toMatchObject({ uid: me.user.id, name: "Mia", place: 231, wins: 15, losses: 15 });
    expect(you.rank.label).toBe("Radiant 1 · 50 RP");
    const top = await ladderTop(sql);
    expect(top.total).toBe(241);
    expect(top.rows.some((r) => r.uid === me.user.id)).toBe(false);
    // Up into the list: the same place there as pinned.
    await sql.run("UPDATE ranked_1v1 SET ladder = 2995 WHERE user_id = ?", me.user.id);
    const mine = (await ladderYou(sql, me.user, false)) as LadderRow;
    const listed = (await ladderTop(sql)).rows.find((r) => r.uid === me.user.id)!;
    expect(mine.place).toBe(6);
    expect(listed.place).toBe(mine.place);
    expect(listed.rank.label).toBe(mine.rank.label);
  });

  it("in placements: how many played of how many; never placed: 0 of 5", async () => {
    const { sql } = await setup();
    const me = await signedIn(sql);
    expect(await ladderYou(sql, me.user, false)).toEqual({ placement: { played: 0, of: P } });
    await rankRow(sql, me.user.id, 2, null);
    expect(await ladderYou(sql, me.user, false)).toEqual({ placement: { played: 2, of: P } });
  });

  it("no account: null; a guest where online play needs signing in: null (Sign in), where it doesn't: placements", async () => {
    const { sql } = await setup();
    expect(await ladderYou(sql, null, false)).toBeNull();
    const guest = await createGuest(sql, T0, "Gus");
    expect(await ladderYou(sql, guest.user, false)).toBeNull();
    expect(await ladderYou(sql, guest.user, true)).toEqual({ placement: { played: 0, of: P } });
  });

  it("a left-out account still sees its own place, counted as everyone's (the engine pool is quiet)", async () => {
    const { sql } = await setup();
    await players(sql, [3000, 2900]);
    const me = await signedIn(sql);
    await rankRow(sql, me.user.id, 20, 2950);
    await setCase(sql, me.user.id, "pool", "admin:x@example.com", "engine", T0);
    expect(((await ladderYou(sql, me.user, false)) as LadderRow).place).toBe(2);
    expect((await ladderTop(sql)).rows.map((r) => r.place)).toEqual([1, 2]);
  });
});

describe("GET /api/ladder", () => {
  /** A stand-in for the edge: what's put, matched until `ttl` ms pass on the test's clock. */
  function fakeCache() {
    const kept = new Map<string, { body: string; maxAge: number }>();
    let puts = 0;
    const cache: EdgeCache = {
      async match(req) {
        const k = kept.get(req.url);
        return k ? new Response(k.body) : undefined;
      },
      async put(req, res) {
        puts++;
        kept.set(req.url, { body: await res.text(), maxAge: Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1]) });
      },
    };
    return { cache, kept, puts: () => puts, expire: () => kept.clear() };
  }

  async function call(env: object, cache: EdgeCache | null, { token, mode = "1v1", method = "GET" }: { token?: string; mode?: string; method?: string } = {}) {
    const req = new Request(`https://hunchess.test/api/ladder?mode=${mode}`, { method, headers: token ? { cookie: `hc_session=${token}` } : {} });
    const res = (await handleLadder(req, env as never, undefined, cache))!;
    return { status: res.status, cacheControl: res.headers.get("cache-control"), body: (await res.json()) as LadderAnswer & { message?: string } };
  }

  it("the rows kept a minute at the edge, your row read fresh each time, the answer itself never kept", async () => {
    const { sql, d1 } = await setup();
    await players(sql, [3000, 2900]);
    const me = await signedIn(sql);
    await rankRow(sql, me.user.id, 20, 2000);
    const env = { DB: d1 };
    const edge = fakeCache();
    const first = await call(env, edge.cache, { token: me.token });
    expect(first.status).toBe(200);
    expect(first.cacheControl).toBe("no-store");
    expect(first.body).toMatchObject({ season: LADDER.season, mode: "1v1", total: 3 });
    expect(first.body.rows.map((r) => r.uid)).toEqual(["p000", "p001", me.user.id]);
    expect((first.body.you as LadderRow).place).toBe(3);
    expect(edge.puts()).toBe(1);
    expect([...edge.kept.values()][0]!.maxAge).toBe(LADDER.cacheSeconds);
    // Within the minute: the kept rows (a new player above isn't in them yet), but your place counted now.
    await players(sql, [3100], { from: 10 });
    const second = await call(env, edge.cache, { token: me.token });
    expect(second.body.rows.map((r) => r.uid)).toEqual(["p000", "p001", me.user.id]);
    expect((second.body.you as LadderRow).place).toBe(4);
    expect(edge.puts()).toBe(1);
    // The minute up: read again.
    edge.expire();
    const third = await call(env, edge.cache, { token: me.token });
    expect(third.body.rows.map((r) => r.uid)).toEqual(["p010", "p000", "p001", me.user.id]);
    expect(third.body.total).toBe(4);
    // Signed out: the same rows, no you.
    expect((await call(env, edge.cache)).body.you).toBeNull();
  });

  it("without an edge (outside a Worker) it reads every time; other modes and methods are refused; no database: 503", async () => {
    const { sql, d1 } = await setup();
    await players(sql, [3000]);
    expect((await call({ DB: d1 }, null)).body.rows).toHaveLength(1);
    expect((await call({ DB: d1 }, null, { mode: "squads" })).status).toBe(404);
    expect((await call({ DB: d1 }, null, { method: "POST" })).status).toBe(404);
    expect((await call({}, null)).status).toBe(503);
    expect(await handleLadder(new Request("https://hunchess.test/api/ladderx"), { DB: d1 } as never, undefined, null)).toBeNull();
  });
});

describe("places down a list (core's ladderPlaces)", () => {
  it("ties share the better place, the next skips them", () => {
    expect(ladderPlaces([3000, 3000, 2950, 2900, 2900, 2900, 10])).toEqual([1, 1, 3, 4, 4, 4, 7]);
    expect(ladderPlaces([])).toEqual([]);
  });
});
