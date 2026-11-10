import { describe, expect, it } from "vitest";
import { HUNCHESS_RIDES, ITEM_DEFS, NOT_TRADEABLE, WELCOME_CRATE, WELCOME_CRATE_ID, WELCOME_GIFT, WELCOME_TEXT, hunchessBase, isHunchess, itemDef, showsPurity, tradeable } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, profile, recordResult, signInWithIdentity, type MatchResult, type Sql } from "../src/accounts.ts";
import { handleAccountApi } from "../src/api.ts";
import { lockerMoves, lockerState } from "../src/locker.ts";
import { finishedGames, grantWelcomeCrate, openWelcomeCrate, seenWelcomeNotice, welcomeState } from "../src/welcome.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * The HunChess Welcome Crate (Eric, Nov 6; docs/decisions/2026-11-06-welcome-crate.md): earned at 5 finished games and not at 4,
 * abandoned games not counted, one per account under concurrent grants, the backfill, opening once to one HunChess ride, never
 * tradeable, no purity, and old lockers loading.
 */

const T0 = 20 * 86_400_000;
const GAME: MatchResult = { mode: "classic", online: true, placement: 3, players: 8, lobby: "ABCDE" };

/** A fresh database with one account (signed in unless `guest`). */
async function account(guest = false) {
  const { sql, db, d1 } = memoryDb();
  await ensureSchema(sql);
  const g = await createGuest(sql, T0, "Player");
  const id = guest ? g.user.id : (await signInWithIdentity(sql, g.user, "email", "tester@example.com", {}, T0)).id;
  return { sql, db, d1, id };
}

/** `n` finished games for `id`, each saved as a match room or the app saves one, then the grant check that follows it. */
async function play(sql: Sql, id: string, n: number, r: Partial<MatchResult> = {}) {
  const granted: boolean[] = [];
  for (let i = 0; i < n; i++) {
    await recordResult(sql, id, { ...GAME, ...r }, T0 + i);
    granted.push((await grantWelcomeCrate(sql, id, T0 + i)).length > 0);
  }
  return granted;
}
const rows = (db: ReturnType<typeof memoryDb>["db"], id: string) => (db.prepare("SELECT COUNT(*) AS n FROM welcome_crates WHERE user_id = ?").get(id) as { n: number }).n;
const hunchessItems = (db: ReturnType<typeof memoryDb>["db"], id: string) =>
  db.prepare("SELECT def, crate FROM items WHERE user_id = ? AND crate = ?").all(id, WELCOME_CRATE_ID) as { def: string; crate: string }[];

describe("earning it", () => {
  it("at exactly 5 finished games, not at 4; once", async () => {
    expect(WELCOME_GIFT.milestones).toEqual([5, 25]);
    const { sql, db, id } = await account();
    expect(await play(sql, id, 4)).toEqual([false, false, false, false]);
    expect((await welcomeState(sql, id)).status).toBe("locked");
    expect((await welcomeState(sql, id)).games).toBe(4);
    expect(await play(sql, id, 1)).toEqual([true]);
    expect(await welcomeState(sql, id)).toMatchObject({ status: "ready", notice: true, games: 5 });
    // A sixth game (and a seventh) grants nothing more.
    expect(await play(sql, id, 2)).toEqual([false, false]);
    expect(rows(db, id)).toBe(1);
  });

  it("any mode counts: online matches, Squads, solo games the server timed, boss battles, ranked 1 v 1 games, mixed", async () => {
    const { sql, id } = await account();
    await recordResult(sql, id, { mode: "crowd", online: true, placement: 1, players: 100, lobby: "AAAAA" }, T0);
    await recordResult(sql, id, { mode: "squads", online: true, placement: 2, players: 16, lobby: "AAAAB" }, T0);
    await recordResult(sql, id, { mode: "boss", online: false, placement: 1, players: 1, playMs: WELCOME_GIFT.soloMinMinutes * 60_000 }, T0);
    await recordResult(sql, id, { mode: "classic", online: false, placement: 5, players: 8, playMs: 12 * 60_000 }, T0);
    expect(await finishedGames(sql, id)).toBe(4);
    expect(await grantWelcomeCrate(sql, id, T0)).toEqual([]);
    // One ranked 1 v 1 game (its record's count: aborted games are never recorded).
    await sql.run("INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws) VALUES (?, 1500, 300, 1, 0, 0, 1)", id);
    expect(await finishedGames(sql, id)).toBe(5);
    expect(await grantWelcomeCrate(sql, id, T0)).toEqual([5]);
  });

  it("abandoned games don't count: gone too long, idle or removed mid-match (the match room's word); a resignation does", async () => {
    const { sql, id } = await account();
    await play(sql, id, 4, { abandoned: true });
    expect(await finishedGames(sql, id)).toBe(0);
    expect((await welcomeState(sql, id)).status).toBe("locked");
    // The app can't say a solo game was or wasn't abandoned: only a match room marks one.
    await recordResult(sql, id, { mode: "classic", online: false, placement: 8, players: 8, abandoned: true, playMs: 5 * 60_000 }, T0);
    expect(await finishedGames(sql, id)).toBe(1);
    await play(sql, id, 3);
    expect(await grantWelcomeCrate(sql, id, T0)).toEqual([]);
    await play(sql, id, 1);
    expect((await welcomeState(sql, id)).status).toBe("ready");
  });

  it("a solo game counts only when the server timed it for WELCOME_GIFT.soloMinMinutes: empty posts earn nothing (Nov 10, finding 10)", async () => {
    const { sql, d1, id } = await account();
    const cookie = `hc_session=${await createSession(sql, id, Date.now())}`;
    const post = async (path: string, body: unknown) =>
      (await handleAccountApi(new Request(`https://hunchess.com${path}`, { method: "POST", body: JSON.stringify(body), headers: { cookie } }), { DB: d1 } as never))!;
    // The review's attack: 25 results posted with no game the server timed. All recorded (the profile's stats), none counted.
    for (let i = 0; i < 25; i++) expect((await post("/api/results", { mode: "classic", placement: 1, players: 8 })).status).toBe(200);
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE user_id = ?", id))?.n).toBe(25);
    expect(await finishedGames(sql, id)).toBe(0);
    expect(await welcomeState(sql, id)).toMatchObject({ status: "locked", games: 0 });
    // A game the server timed, but shorter than the minimum: not counted either.
    const started = async (minutesAgo: number) => {
      const { game } = (await (await post("/api/xp/solo/start", {})).json()) as { game: string };
      await sql.run("UPDATE solo_games SET started_at = started_at - ? WHERE user_id = ?", minutesAgo * 60_000, id);
      return game;
    };
    await post("/api/results", { mode: "classic", placement: 1, players: 8, game: await started(WELCOME_GIFT.soloMinMinutes - 1) });
    expect(await finishedGames(sql, id)).toBe(0);
    // Long enough by the server's clock: each counts.
    for (let i = 0; i < 5; i++) await post("/api/results", { mode: "classic", placement: 2, players: 8, game: await started(WELCOME_GIFT.soloMinMinutes) });
    expect(await finishedGames(sql, id)).toBe(5);
    expect((await welcomeState(sql, id)).status).toBe("ready");
  });

  it("the match room marks a player who left mid-match away, idle or kicked as abandoned, and one who resigned as a loss that counts", async () => {
    const { LobbyCore } = await import("../src/lobby.ts");
    const core = Object.create(LobbyCore.prototype) as InstanceType<typeof LobbyCore>;
    const result = { playerId: "p", placement: 7, players: 8 };
    (core as unknown as { record: { left: unknown[] } }).record = {
      left: (["resigned", "away", "afk", "kicked", "early"] as const).map((how, i) => ({ id: `p${i}`, name: "P", token: "t", how, at: 0, result: how === "early" ? null : { ...result, playerId: `p${i}` } })),
    };
    const out = core.takeLeftResults();
    expect(out.map((r) => [r.playerId, !!r.abandoned])).toEqual([
      ["p0", false],
      ["p1", true],
      ["p2", true],
      ["p3", true],
    ]);
    // Each once.
    expect(core.takeLeftResults()).toEqual([]);
  });

  it("guests never get one (bots have no account at all), however many games", async () => {
    const { sql, db, id } = await account(true);
    expect(await play(sql, id, 8)).toEqual(Array(8).fill(false));
    expect(rows(db, id)).toBe(0);
    expect((await welcomeState(sql, id)).status).toBe("locked");
    // Signing in on that guest (an email attached to it): its games count, and it's granted.
    const user = (await sql.first("SELECT id, name, icon, email, google_sub, created_at FROM users WHERE id = ?", id)) as never;
    await signInWithIdentity(sql, user, "email", "late@example.com", {}, T0);
    expect(await grantWelcomeCrate(sql, id, T0)).toEqual([5]);
  });

  it("one per account under concurrent grants (two tabs, two match rooms, retries): one row, one notice", async () => {
    const { sql, db, id } = await account();
    for (let i = 0; i < 5; i++) await recordResult(sql, id, GAME, T0 + i);
    const all = await Promise.all(Array.from({ length: 12 }, (_, i) => grantWelcomeCrate(sql, id, T0 + i)));
    expect(all.filter((g) => g.length)).toHaveLength(1);
    expect(rows(db, id)).toBe(1);
    // And a grant whose quick check is passed by another's write between its two statements: the insert's own conflict guard.
    const racing: Sql = {
      ...sql,
      async first(q, ...p) {
        if (/^SELECT 1 FROM welcome_crates/.test(q)) return null as never;
        return sql.first(q, ...p);
      },
    };
    expect(await grantWelcomeCrate(racing, id, T0 + 99)).toEqual([]);
    expect(rows(db, id)).toBe(1);
    // Every profile load grants nothing more.
    const user = (await sql.first("SELECT id, name, icon, email, google_sub, created_at FROM users WHERE id = ?", id)) as never;
    await Promise.all([profile(sql, user), profile(sql, user)]);
    expect(rows(db, id)).toBe(1);
  });

  it("the backfill: an account that finished 5 games before Nov 6 gets it on its next sign-in or app load (/api/me)", async () => {
    const { sql, db, id } = await account();
    // Its results, stored before the crate existed (no grant check ran then).
    for (let i = 0; i < 6; i++) await recordResult(sql, id, { mode: i % 2 ? "boss" : "crowd", online: true, placement: 2, players: 50, lobby: "BBBBB" }, T0 - 30 * 86_400_000 + i);
    // (Older results have `abandoned` NULL: they count.)
    db.prepare("UPDATE results SET abandoned = NULL WHERE user_id = ?").run(id);
    expect(rows(db, id)).toBe(0);
    const user = (await sql.first("SELECT id, name, icon, email, google_sub, created_at FROM users WHERE id = ?", id)) as never;
    const p = await profile(sql, user);
    expect(p.locker.welcome).toMatchObject({ status: "ready", notice: true });
    expect(rows(db, id)).toBe(1);
  });

  it("a guest's games join the account it signs in to, and count there; the guest brings no crate", async () => {
    const { sql, db } = memoryDb();
    await ensureSchema(sql);
    const owner = await signInWithIdentity(sql, (await createGuest(sql, T0, "A")).user, "email", "owner@example.com", {}, T0);
    await play(sql, owner.id, 2);
    const guest = (await createGuest(sql, T0, "G")).user;
    await play(sql, guest.id, 3);
    expect(rows(db, guest.id)).toBe(0);
    const back = await signInWithIdentity(sql, guest, "email", "owner@example.com", {}, T0 + 10);
    expect(back.id).toBe(owner.id);
    expect(await finishedGames(sql, owner.id)).toBe(5);
    expect(await grantWelcomeCrate(sql, owner.id, T0 + 11)).toEqual([5]);
    expect(rows(db, owner.id)).toBe(1);
  });

  it("the notice shows once: closed, it stays closed", async () => {
    const { sql, id } = await account();
    await play(sql, id, 5);
    expect((await welcomeState(sql, id)).notice).toBe(true);
    await seenWelcomeNotice(sql, id, T0 + 1);
    await seenWelcomeNotice(sql, id, T0 + 2);
    expect((await welcomeState(sql, id)).notice).toBe(false);
  });
});

describe("opening it", () => {
  it("once, to one HunChess ride from the full list, stored; a second open gives nothing new", async () => {
    const { sql, db, id } = await account();
    expect(await openWelcomeCrate(sql, id, T0)).toEqual({ ok: false, message: "You have no Welcome Crate to open." });
    await play(sql, id, 5);
    const first = await openWelcomeCrate(sql, id, T0 + 1);
    if (!first.ok) throw new Error(first.message);
    expect(first.again).toBe(false);
    expect(HUNCHESS_RIDES.map((d) => d.id)).toContain(first.item.def);
    expect(isHunchess(first.item.def)).toBe(true);
    expect(first.item.blemish).toBe(0);
    const again = await openWelcomeCrate(sql, id, T0 + 2);
    expect(again).toMatchObject({ ok: true, again: true, item: first.item });
    expect(hunchessItems(db, id)).toHaveLength(1);
    expect(await welcomeState(sql, id)).toMatchObject({ status: "opened", item: first.item.id });
    // It's in the locker and wears in the ride slot like any ride.
    const locker = await lockerState(sql, id);
    expect(locker.items.map((i) => i.id)).toContain(first.item.id);
  });

  it("twice at once (a double tap, two devices): one ride, the other answers the same ride", async () => {
    const { sql, db, id } = await account();
    await play(sql, id, 5);
    const both = await Promise.all([openWelcomeCrate(sql, id, T0), openWelcomeCrate(sql, id, T0), openWelcomeCrate(sql, id, T0)]);
    expect(both.every((r) => r.ok)).toBe(true);
    expect(new Set(both.map((r) => (r.ok ? r.item.id : "")))).toHaveProperty("size", 1);
    expect(both.filter((r) => r.ok && !r.again)).toHaveLength(1);
    expect(hunchessItems(db, id)).toHaveLength(1);
  });

  it("a failure partway (the batch rolled back) leaves the crate unopened and no ride: it can be opened later", async () => {
    const { sql, db, id } = await account();
    await play(sql, id, 5);
    const failing: Sql = {
      ...sql,
      async batch(statements) {
        // The second statement fails: D1's batch is one transaction, so the first's ride is rolled back with it.
        return sql.batch([statements[0]!, { sql: "INSERT INTO no_such_table VALUES (1)", params: [] }]);
      },
    };
    await expect(openWelcomeCrate(failing, id, T0)).rejects.toThrow();
    expect(hunchessItems(db, id)).toHaveLength(0);
    expect((await welcomeState(sql, id)).status).toBe("ready");
    expect((await openWelcomeCrate(sql, id, T0 + 1)).ok).toBe(true);
  });

  it("every ride can come out, each as likely (the roll is the server's: openWelcomeCrate takes no test switch)", async () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < HUNCHESS_RIDES.length; i++) {
      const { sql, id } = await account();
      await play(sql, id, 5);
      // (Randomness landing on each ride in turn.)
      const k = (i + 0.5) / HUNCHESS_RIDES.length;
      const r = await openWelcomeCrate(sql, id, T0, () => k);
      if (r.ok) seen.set(r.item.def, (seen.get(r.item.def) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual(HUNCHESS_RIDES.map((d) => d.id).sort());
  });
});

describe("the prize: a HunChess colorway of every ride, never tradeable, no purity", () => {
  it("every ride has its colorway, its own id (never a ride's), drawn from that ride", () => {
    const rides = ITEM_DEFS.filter((d) => d.slot === "ride" && !d.hunchess);
    expect(rides.length).toBeGreaterThanOrEqual(17);
    expect(HUNCHESS_RIDES.map((d) => d.id)).toEqual(rides.map((d) => `${d.id}-hunchess`));
    for (const r of rides) {
      const h = itemDef(`${r.id}-hunchess`)!;
      expect(h.slot).toBe("ride");
      expect(hunchessBase(h.id)).toBe(r.id);
      expect(h.name).toBe(`HunChess ${r.name}`);
      expect(isHunchess(r.id)).toBe(false);
    }
    expect(WELCOME_CRATE.items).toEqual(HUNCHESS_RIDES.map((d) => d.id));
    expect(WELCOME_TEXT).toMatchObject({ name: "HunChess Welcome Crate", thanks: "Thank you for being an early tester!", notTradeable: "Not tradeable" });
    expect(WELCOME_TEXT.progress(3)).toBe("Finish 5 games to earn your Welcome Crate: 3/5");
  });

  it("never tradeable or listable: the crate and every HunChess ride refuse; every other item may", () => {
    expect(tradeable(WELCOME_CRATE_ID)).toBe(false);
    for (const d of HUNCHESS_RIDES) expect(tradeable(d.id), d.id).toBe(false);
    for (const d of ITEM_DEFS.filter((x) => !x.hunchess)) expect(tradeable(d.id), d.id).toBe(true);
    expect(tradeable(null)).toBe(false);
    expect(NOT_TRADEABLE).toMatch(/not tradeable/);
  });

  it("the one path that moves items between accounts, a guest's sign-in, can't carry a HunChess ride or a crate: a guest can't earn or open one", async () => {
    const { sql, db, id } = await account(true);
    await play(sql, id, 6);
    expect(await openWelcomeCrate(sql, id, T0)).toMatchObject({ ok: false });
    expect(hunchessItems(db, id)).toHaveLength(0);
    // (Even a row put under a guest by hand is dropped at its sign-in, never moved onto the account.)
    db.prepare("INSERT INTO welcome_crates (user_id, milestone, granted_at, games) VALUES (?, 5, 0, 5)").run(id);
    const owner = await signInWithIdentity(sql, (await createGuest(sql, T0, "O")).user, "email", "o@example.com", {}, T0);
    const guest = (await sql.first("SELECT id, name, icon, email, google_sub, created_at FROM users WHERE id = ?", id)) as never;
    await signInWithIdentity(sql, guest, "email", "o@example.com", {}, T0 + 1);
    expect(rows(db, id)).toBe(0);
    expect(rows(db, owner.id)).toBe(0);
    expect(lockerMoves("a", "b").length).toBeGreaterThan(0);
  });

  it("no purity shown for the crate's rides (stored at 100%: nothing blotched); every other item shows its purity", () => {
    for (const d of HUNCHESS_RIDES) expect(showsPurity(d.id)).toBe(false);
    for (const d of ITEM_DEFS.filter((x) => !x.hunchess)) expect(showsPurity(d.id)).toBe(true);
  });
});

describe("the second Welcome Crate, at 25 (Eric: \"the first one you get after 5 games, the next one you get after 25\")", () => {
  it("at exactly 25 finished games, not at 24; once; the progress names the next milestone", async () => {
    const { sql, db, id } = await account();
    await play(sql, id, 5);
    expect(await welcomeState(sql, id)).toMatchObject({ next: 25, unopened: 1, status: "ready" });
    expect(WELCOME_TEXT.progress(7, 25)).toBe("Finish 25 games for your second Welcome Crate: 7/25");
    expect((await play(sql, id, 19)).some(Boolean)).toBe(false);
    expect(rows(db, id)).toBe(1);
    expect(await play(sql, id, 1)).toEqual([true]);
    expect(rows(db, id)).toBe(2);
    expect(await welcomeState(sql, id)).toMatchObject({ next: null, unopened: 2, notice: true, games: 25 });
    expect(await play(sql, id, 5)).toEqual(Array(5).fill(false));
    expect(rows(db, id)).toBe(2);
  });

  it("concurrent grants at 25: one row for each milestone, never two", async () => {
    const { sql, db, id } = await account();
    for (let i = 0; i < 25; i++) await recordResult(sql, id, GAME, T0 + i);
    const all = await Promise.all(Array.from({ length: 10 }, (_, i) => grantWelcomeCrate(sql, id, T0 + i)));
    expect(all.flat().sort((a, b) => a - b)).toEqual([5, 25]);
    expect(rows(db, id)).toBe(2);
    const milestones = db.prepare("SELECT milestone FROM welcome_crates WHERE user_id = ? ORDER BY milestone").all(id) as { milestone: number }[];
    expect(milestones.map((m) => m.milestone)).toEqual([5, 25]);
  });

  it("the backfill covers both: an account with 30 past games gets both on its next app load", async () => {
    const { sql, db, id } = await account();
    for (let i = 0; i < 30; i++) await recordResult(sql, id, GAME, T0 - 86_400_000 + i);
    const user = (await sql.first("SELECT id, name, icon, email, google_sub, created_at FROM users WHERE id = ?", id)) as never;
    expect((await profile(sql, user)).locker.welcome).toMatchObject({ next: null, unopened: 2, status: "ready", notice: true });
    expect(rows(db, id)).toBe(2);
  });

  it("the second gives a different ride from the first's (even with randomness that would land on the same one, or the first deleted)", async () => {
    const { sql, db, id } = await account();
    await play(sql, id, 25);
    const first = await openWelcomeCrate(sql, id, T0, () => 0);
    if (!first.ok) throw new Error(first.message);
    // (The first's ride deleted from the locker: the crate still remembers which it was.)
    db.prepare("DELETE FROM items WHERE id = ?").run(first.item.id);
    const second = await openWelcomeCrate(sql, id, T0 + 1, () => 0);
    if (!second.ok) throw new Error(second.message);
    expect(second.again).toBe(false);
    expect(second.item.def).not.toBe(first.item.def);
    expect(await welcomeState(sql, id)).toMatchObject({ unopened: 0, status: "opened", item: second.item.id });
    // A third open: nothing new.
    expect(await openWelcomeCrate(sql, id, T0 + 2)).toMatchObject({ ok: true, again: true, item: { id: second.item.id } });
    expect(hunchessItems(db, id)).toHaveLength(1);
  });

  it("two opens at once with both waiting: both open, with different rides; three at once: still two", async () => {
    for (let round = 0; round < 5; round++) {
      const { sql, db, id } = await account();
      await play(sql, id, 25);
      const all = await Promise.all([0, 1, 2].map(() => openWelcomeCrate(sql, id, T0, () => 0.3)));
      const fresh = all.filter((r) => r.ok && !r.again);
      expect(fresh).toHaveLength(2);
      const defs = hunchessItems(db, id).map((r) => r.def);
      expect(defs).toHaveLength(2);
      expect(new Set(defs).size).toBe(2);
      expect((await welcomeState(sql, id)).unopened).toBe(0);
    }
  });
});

describe("stored data", () => {
  it("old lockers load: an account with items from before (no welcome row, no `abandoned` on its results) reads as not earned yet", async () => {
    const { sql, db, id } = await account();
    db.prepare("INSERT INTO items (id, user_id, def, color, blemish, seed, crate, fischer, created_at) VALUES ('old1', ?, 'pirate-hat', 'red', 12, 3, 'beta-001', 0, 1)").run(id);
    // (An online result from before `abandoned`: it counts. A solo one from before the server timed games wouldn't, since Nov 10.)
    db.prepare("INSERT INTO results (user_id, mode, online, placement, players, played_at) VALUES (?, 'classic', 1, 1, 8, 1)").run(id);
    const locker = await lockerState(sql, id);
    expect(locker.items.map((i) => i.def)).toEqual(["pirate-hat"]);
    expect(locker.welcome).toEqual({ games: 1, next: 5, unopened: 0, status: "locked", notice: false });
  });

  it("a database from before the crate (no welcome_crates table yet) still answers a locker", async () => {
    const { sql, db, id } = await account();
    db.exec("DROP TABLE welcome_crates");
    expect((await lockerState(sql, id)).welcome.status).toBe("locked");
  });
});
