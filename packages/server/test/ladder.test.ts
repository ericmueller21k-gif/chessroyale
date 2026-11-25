import { beforeEach, describe, expect, it } from "vitest";
import { ITEM_DEFS, LADDER, RANKED_1V1, ladderPlaces, type LadderAnswer, type LadderRow } from "@chessroyale/core";
import { createGuest, ensureSchema, type Sql, type User } from "../src/accounts.ts";
import { setCase } from "../src/fairplay.ts";
import { LADDER_ROWS_SQL, forgetLadderTops, handleLadder, ladderTop, ladderYou } from "../src/ladder.ts";
import { SHOWN_ABOVE_SQL, SHOWN_ALL_SQL, forgetTopPlaces, rankOf, topPlace } from "../src/ranked-schema.ts";
import { rot13 } from "../src/text-filter.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * The season ladder (ladder.ts; docs/decisions/2026-11-25-ladder.md): the top LADDER.size rows in ladder order with shared places,
 * the count, the accounts left out (banned, under review, the engine pool, test accounts) and the top tiers' place agreeing with it,
 * your own standing wherever you are, the looks in one batched read within D1's 100 bound values, the plans on the new index, and the
 * route: the top kept a minute in the Worker, your own row put in your copy fresh, a left-out viewer's answer the same as an honest one's.
 */

const T0 = 1_800_000_000_000;
const P = RANKED_1V1.placements.games;

async function setup() {
  const { sql, db, d1 } = memoryDb();
  await ensureSchema(sql);
  return { sql, db, d1 };
}

beforeEach(() => {
  forgetTopPlaces();
  forgetLadderTops();
});

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

  it("banned players, players under review, the engine pool and test accounts are left out of the list, the count and everyone's place; residents and the rest stay", async () => {
    const { sql } = await setup();
    const [banned, reviewed, pooled, test, a, b] = await players(sql, [3100, 3050, 3000, 2950, 2900, 2850]);
    await setCase(sql, banned!, "banned", "admin:x@example.com", "engine", T0);
    // (Under review, results held: fair play's eligibleForRanked, "not while they're in review or banned"; the director's call, Nov 25.)
    await setCase(sql, reviewed!, "review", "admin:x@example.com", "engine", T0);
    await setCase(sql, pooled!, "pool", "admin:x@example.com", "engine", T0);
    await sql.run("UPDATE users SET test = 1 WHERE id = ?", test);
    // (A resident (residents.ts) is a real-looking player by design: on the ladder like anyone.)
    await sql.run("UPDATE users SET resident = 1 WHERE id = ?", b);
    const top = await ladderTop(sql);
    expect(top.rows.map((r) => r.uid)).toEqual([a, b]);
    expect(top.rows.map((r) => r.place)).toEqual([1, 2]);
    expect(top.total).toBe(2);
    // The top tiers' place counts the same players (since Nov 25, banned and reviewed ones left out too): the list's place and the tier agree.
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
    const you = (await ladderYou(sql, me.user, false)).you as LadderRow;
    // 3000 … 2761: 230 ladders above 2770, and 2770 itself is shared with p230 (the same place).
    expect(you).toMatchObject({ uid: me.user.id, name: "Mia", place: 231, wins: 15, losses: 15 });
    expect(you.rank.label).toBe("Radiant 1 · 50 RP");
    const top = await ladderTop(sql);
    expect(top.total).toBe(241);
    expect(top.rows.some((r) => r.uid === me.user.id)).toBe(false);
    // Up into the list: the same place there as pinned.
    await sql.run("UPDATE ranked_1v1 SET ladder = 2995 WHERE user_id = ?", me.user.id);
    const mine = (await ladderYou(sql, me.user, false)).you as LadderRow;
    const listed = (await ladderTop(sql)).rows.find((r) => r.uid === me.user.id)!;
    expect(mine.place).toBe(6);
    expect(listed.place).toBe(mine.place);
    expect(listed.rank.label).toBe(mine.rank.label);
  });

  it("in placements: how many played of how many; never placed: 0 of 5", async () => {
    const { sql } = await setup();
    const me = await signedIn(sql);
    expect(await ladderYou(sql, me.user, false)).toEqual({ you: { placement: { played: 0, of: P } }, leftOut: false });
    await rankRow(sql, me.user.id, 2, null);
    expect(await ladderYou(sql, me.user, false)).toEqual({ you: { placement: { played: 2, of: P } }, leftOut: false });
  });

  it("no account: null; a guest where online play needs signing in: null (Sign in), where it doesn't: placements", async () => {
    const { sql } = await setup();
    expect((await ladderYou(sql, null, false)).you).toBeNull();
    const guest = await createGuest(sql, T0, "Gus");
    expect((await ladderYou(sql, guest.user, false)).you).toBeNull();
    expect((await ladderYou(sql, guest.user, true)).you).toEqual({ placement: { played: 0, of: P } });
  });

  it("a left-out account's own place counted as everyone's, and whether it's left out read with it (never answered)", async () => {
    const { sql } = await setup();
    await players(sql, [3000, 2900]);
    const me = await signedIn(sql);
    await rankRow(sql, me.user.id, 20, 2950);
    expect(await ladderYou(sql, me.user, false)).toMatchObject({ you: { place: 2 }, leftOut: false });
    for (const status of ["pool", "review", "banned"] as const) {
      await setCase(sql, me.user.id, status, "admin:x@example.com", "engine", T0);
      expect(await ladderYou(sql, me.user, false)).toMatchObject({ you: { place: 2 }, leftOut: true });
    }
    await sql.run("DELETE FROM fairplay_cases");
    await sql.run("UPDATE users SET test = 1 WHERE id = ?", me.user.id);
    expect((await ladderYou(sql, me.user, false)).leftOut).toBe(true);
  });
});

async function call(env: object, { token, mode = "1v1", method = "GET", now = T0 }: { token?: string; mode?: string; method?: string; now?: number } = {}) {
  const req = new Request(`https://hunchess.test/api/ladder?mode=${mode}`, { method, headers: token ? { cookie: `hc_session=${token}` } : {} });
  const res = (await handleLadder(req, env as never, now))!;
  return { status: res.status, cacheControl: res.headers.get("cache-control"), body: (await res.json()) as LadderAnswer & { message?: string } };
}

const uids = (a: LadderAnswer) => a.rows.map((r) => r.uid);
const places = (a: LadderAnswer) => a.rows.map((r) => r.place);

describe("GET /api/ladder", () => {
  it("the top kept a minute in the Worker, your row read fresh each time, the answer itself never kept", async () => {
    const { sql, d1 } = await setup();
    await players(sql, [3000, 2900]);
    const me = await signedIn(sql);
    await rankRow(sql, me.user.id, 20, 2000);
    const env = { DB: d1 };
    const first = await call(env, { token: me.token });
    expect(first.status).toBe(200);
    expect(first.cacheControl).toBe("no-store");
    expect(first.body).toMatchObject({ season: LADDER.season, mode: "1v1", total: 3 });
    expect(uids(first.body)).toEqual(["p000", "p001", me.user.id]);
    expect((first.body.you as LadderRow).place).toBe(3);
    // Within the minute: the kept rows (a new player above isn't in them yet), but your place counted now, in the list and pinned.
    await players(sql, [3100], { from: 10 });
    const second = await call(env, { token: me.token, now: T0 + LADDER.cacheSeconds * 1000 - 1 });
    expect(uids(second.body)).toEqual(["p000", "p001", me.user.id]);
    expect((second.body.you as LadderRow).place).toBe(4);
    expect(second.body.rows.at(-1)).toEqual(second.body.you);
    // The minute up: read again.
    const third = await call(env, { token: me.token, now: T0 + LADDER.cacheSeconds * 1000 });
    expect(uids(third.body)).toEqual(["p010", "p000", "p001", me.user.id]);
    expect(third.body.total).toBe(4);
    // Signed out: the same rows, no you.
    expect((await call(env, { now: T0 + LADDER.cacheSeconds * 1000 })).body.you).toBeNull();
  });

  it("your own row in the list is always your fresh one, at its place among the kept rows (never twice, never a minute old)", async () => {
    const { sql, d1 } = await setup();
    await players(sql, [3000, 2900, 2800, 2700]);
    const me = await signedIn(sql);
    await rankRow(sql, me.user.id, 20, 2650);
    const env = { DB: d1 };
    expect(places((await call(env, { token: me.token })).body)).toEqual([1, 2, 3, 4, 5]);
    // A win within the kept minute, 2650 → 2850: you at #3, the two you passed one place down, the total as it was.
    await sql.run("UPDATE ranked_1v1 SET ladder = 2850, wins = wins + 1, streak = 1 WHERE user_id = ?", me.user.id);
    const up = (await call(env, { token: me.token, now: T0 + 1000 })).body;
    expect(uids(up)).toEqual(["p000", "p001", me.user.id, "p002", "p003"]);
    expect(places(up)).toEqual([1, 2, 3, 4, 5]);
    expect(up.rows[2]).toEqual(up.you);
    expect(up.rows[2]!.streak).toBe(1);
    expect(up.total).toBe(5);
    // Then a loss to 2750: between them again, the one you passed back up.
    await sql.run("UPDATE ranked_1v1 SET ladder = 2750 WHERE user_id = ?", me.user.id);
    const down = (await call(env, { token: me.token, now: T0 + 2000 })).body;
    expect(uids(down)).toEqual(["p000", "p001", "p002", me.user.id, "p003"]);
    expect(places(down)).toEqual([1, 2, 3, 4, 5]);
    // (The kept rows themselves never take your copy: signed out, the list as it was read.)
    expect(places((await call(env, { now: T0 + 2000 })).body)).toEqual([1, 2, 3, 4, 5]);
    expect(uids((await call(env, { now: T0 + 2000 })).body).at(-1)).toBe(me.user.id);
  });

  it("dropped out of a full list within the minute: out of your copy (never shown at a stale place), the rows under you one place up", async () => {
    const { sql, d1 } = await setup();
    await players(sql, Array.from({ length: LADDER.size + 5 }, (_, i) => 3200 - 2 * i));
    const me = await signedIn(sql);
    // At 2805: #199 of 206 (198 above: 3200 … 2806).
    await rankRow(sql, me.user.id, 20, 2805);
    const env = { DB: d1 };
    const before = (await call(env, { token: me.token })).body;
    expect(before.rows.findIndex((r) => r.uid === me.user.id)).toBe(198);
    expect(before.rows[199]).toMatchObject({ uid: "p198", place: 200 });
    await sql.run("UPDATE ranked_1v1 SET ladder = 2700 WHERE user_id = ?", me.user.id);
    const after = (await call(env, { token: me.token, now: T0 + 1000 })).body;
    expect(uids(after)).not.toContain(me.user.id);
    expect(after.rows.at(-1)).toMatchObject({ uid: "p198", place: 199 });
    expect((after.you as LadderRow).place).toBe(206);
    // (One short of the 200 until the minute is up and the list is read again: the next row down isn't in the kept list.)
    expect(after.rows).toHaveLength(LADDER.size - 1);
    expect(after.total).toBe(206);
  });

  it("without a database: 503; other modes and methods are refused", async () => {
    const { sql, d1 } = await setup();
    await players(sql, [3000]);
    expect((await call({ DB: d1 })).body.rows).toHaveLength(1);
    expect((await call({ DB: d1 }, { mode: "squads" })).status).toBe(404);
    expect((await call({ DB: d1 }, { method: "POST" })).status).toBe(404);
    expect((await call({})).status).toBe(503);
    expect(await handleLadder(new Request("https://hunchess.test/api/ladderx"), { DB: d1 } as never)).toBeNull();
  });
});

/**
 * The engine pool is quiet (fairplay.ts: a pooled player "sees their place as ever"), and players under review too (the director's
 * call, Nov 25): a left-out viewer's answer is, byte for byte, the one they'd get as an honest player in the same spot (M1 of the
 * review: before, the list left them out, `total` was one short, and a short ladder lost them entirely). Each case: the answer as an
 * honest player, then as a left-out one (nothing kept between), equal; and the list everyone else sees, without them.
 */
describe("a left-out viewer sees the ladder as ever", () => {
  async function bothWays(ladders: readonly number[], mine: number, status: "pool" | "review" | "banned") {
    const { sql, d1 } = await setup();
    await players(sql, ladders);
    const me = await signedIn(sql, "Mia");
    await rankRow(sql, me.user.id, 20, mine);
    const env = { DB: d1 };
    const honest = (await call(env, { token: me.token })).body;
    await setCase(sql, me.user.id, status, "admin:x@example.com", "engine", T0);
    forgetLadderTops();
    const hidden = (await call(env, { token: me.token })).body;
    // (Everyone else, in the same minute: the kept list, without them.)
    const others = (await call(env)).body;
    return { me: me.user.id, honest, hidden, others };
  }

  it("inside the list: in their place, the honest rows below them one place down, the total with them", async () => {
    const { me, honest, hidden, others } = await bothWays([3000, 2900], 2950, "pool");
    expect(hidden).toEqual(honest);
    expect(uids(hidden)).toEqual(["p000", me, "p001"]);
    expect(places(hidden)).toEqual([1, 2, 3]);
    expect(hidden.total).toBe(3);
    expect(hidden.rows[1]).toEqual(hidden.you);
    expect(uids(others)).toEqual(["p000", "p001"]);
    expect(places(others)).toEqual([1, 2]);
    expect(others.total).toBe(2);
  });

  it("at the bottom of a short ladder: the last row, as an honest player there (before: missing, '2 ranked players' over a #3 pin)", async () => {
    const { me, honest, hidden, others } = await bothWays([3000, 2900], 2800, "pool");
    expect(hidden).toEqual(honest);
    expect(uids(hidden)).toEqual(["p000", "p001", me]);
    expect(places(hidden)).toEqual([1, 2, 3]);
    expect(hidden.total).toBe(3);
    expect(others.total).toBe(2);
  });

  it("under review, in a full list across the Transcendent line: the 200 with them, the row they push to #101 Pearlescent, the last one off", async () => {
    // 205 players, 3200 down two apart; you at 3101: #51, so the honest #100 (3002) is #101 for you.
    const { me, honest, hidden, others } = await bothWays(Array.from({ length: LADDER.size + 5 }, (_, i) => 3200 - 2 * i), 3101, "review");
    expect(hidden).toEqual(honest);
    expect(hidden.rows).toHaveLength(LADDER.size);
    expect(hidden.rows[50]).toMatchObject({ uid: me, place: 51 });
    expect(hidden.rows[100]).toMatchObject({ uid: "p099", place: 101 });
    expect(hidden.rows[100]!.rank.tier).toBe("Pearlescent");
    expect(hidden.rows.at(-1)).toMatchObject({ uid: "p198", place: 200 });
    expect(hidden.total).toBe(206);
    expect(others.rows.find((r) => r.uid === "p099")).toMatchObject({ place: 100, rank: { tier: "Transcendent" } });
    expect(others.total).toBe(205);
  });

  it("below a full list: the same 200 rows as everyone, only the total with them", async () => {
    const { me, honest, hidden, others } = await bothWays(Array.from({ length: LADDER.size + 5 }, (_, i) => 3200 - 2 * i), 2700, "pool");
    expect(hidden).toEqual(honest);
    expect(uids(hidden)).not.toContain(me);
    expect(hidden.rows).toEqual(others.rows);
    expect((hidden.you as LadderRow).place).toBe(206);
    expect([hidden.total, others.total]).toEqual([206, 205]);
  });
});

describe("places down a list (core's ladderPlaces)", () => {
  it("ties share the better place, the next skips them", () => {
    expect(ladderPlaces([3000, 3000, 2950, 2900, 2900, 2900, 10])).toEqual([1, 1, 3, 4, 4, 4, 7]);
    expect(ladderPlaces([])).toEqual([]);
  });
});
