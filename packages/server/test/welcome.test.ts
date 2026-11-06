import { describe, expect, it } from "vitest";
import { HUNCHESS_RIDES, ITEM_DEFS, NOT_TRADEABLE, WELCOME_CRATE, WELCOME_CRATE_ID, WELCOME_GIFT, WELCOME_TEXT, hunchessBase, isHunchess, itemDef, showsPurity, tradeable } from "@chessroyale/core";
import { createGuest, ensureSchema, profile, recordResult, signInWithIdentity, type MatchResult, type Sql } from "../src/accounts.ts";
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
  const { sql, db } = memoryDb();
  await ensureSchema(sql);
  const g = await createGuest(sql, T0, "Player");
  const id = guest ? g.user.id : (await signInWithIdentity(sql, g.user, "email", "tester@example.com", {}, T0)).id;
  return { sql, db, id };
}

/** `n` finished games for `id`, each saved as a match room or the app saves one, then the grant check that follows it. */
async function play(sql: Sql, id: string, n: number, r: Partial<MatchResult> = {}) {
  const granted: boolean[] = [];
  for (let i = 0; i < n; i++) {
    await recordResult(sql, id, { ...GAME, ...r }, T0 + i);
    granted.push(await grantWelcomeCrate(sql, id, T0 + i));
  }
  return granted;
}
const rows = (db: ReturnType<typeof memoryDb>["db"], id: string) => (db.prepare("SELECT COUNT(*) AS n FROM welcome_crates WHERE user_id = ?").get(id) as { n: number }).n;
const hunchessItems = (db: ReturnType<typeof memoryDb>["db"], id: string) =>
  db.prepare("SELECT def, crate FROM items WHERE user_id = ? AND crate = ?").all(id, WELCOME_CRATE_ID) as { def: string; crate: string }[];

describe("earning it", () => {
  it("at exactly 5 finished games, not at 4; once", async () => {
    expect(WELCOME_GIFT.games).toBe(5);
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

  it("any mode counts: online matches, Squads, solo results, boss battles, ranked 1 v 1 games, mixed", async () => {
    const { sql, id } = await account();
    await recordResult(sql, id, { mode: "crowd", online: true, placement: 1, players: 100, lobby: "AAAAA" }, T0);
    await recordResult(sql, id, { mode: "squads", online: true, placement: 2, players: 16, lobby: "AAAAB" }, T0);
    await recordResult(sql, id, { mode: "boss", online: false, placement: 1, players: 1 }, T0);
    await recordResult(sql, id, { mode: "classic", online: false, placement: 5, players: 8 }, T0);
    expect(await finishedGames(sql, id)).toBe(4);
    expect(await grantWelcomeCrate(sql, id, T0)).toBe(false);
    // One ranked 1 v 1 game (its record's count: aborted games are never recorded).
    await sql.run("INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws) VALUES (?, 1500, 300, 1, 0, 0, 1)", id);
    expect(await finishedGames(sql, id)).toBe(5);
    expect(await grantWelcomeCrate(sql, id, T0)).toBe(true);
  });

  it("abandoned games don't count: gone too long, idle or removed mid-match (the match room's word); a resignation does", async () => {
    const { sql, id } = await account();
    await play(sql, id, 4, { abandoned: true });
    expect(await finishedGames(sql, id)).toBe(0);
    expect((await welcomeState(sql, id)).status).toBe("locked");
    // The app can't say a solo game was or wasn't abandoned: only a match room marks one.
    await recordResult(sql, id, { mode: "classic", online: false, placement: 8, players: 8, abandoned: true }, T0);
    expect(await finishedGames(sql, id)).toBe(1);
    await play(sql, id, 3);
    expect(await grantWelcomeCrate(sql, id, T0)).toBe(false);
    await play(sql, id, 1);
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
    expect(await grantWelcomeCrate(sql, id, T0)).toBe(true);
  });

  it("one per account under concurrent grants (two tabs, two match rooms, retries): one row, one notice", async () => {
    const { sql, db, id } = await account();
    for (let i = 0; i < 5; i++) await recordResult(sql, id, GAME, T0 + i);
    const all = await Promise.all(Array.from({ length: 12 }, (_, i) => grantWelcomeCrate(sql, id, T0 + i)));
    expect(all.filter(Boolean)).toHaveLength(1);
    expect(rows(db, id)).toBe(1);
    // And a grant whose quick check is passed by another's write between its two statements: the insert's own conflict guard.
    const racing: Sql = {
      ...sql,
      async first(q, ...p) {
        if (/^SELECT 1 FROM welcome_crates/.test(q)) return null as never;
        return sql.first(q, ...p);
      },
    };
    expect(await grantWelcomeCrate(racing, id, T0 + 99)).toBe(false);
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
    expect(await grantWelcomeCrate(sql, owner.id, T0 + 11)).toBe(true);
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
    db.prepare("INSERT INTO welcome_crates (user_id, granted_at, games) VALUES (?, 0, 5)").run(id);
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

describe("stored data", () => {
  it("old lockers load: an account with items from before (no welcome row, no `abandoned` on its results) reads as not earned yet", async () => {
    const { sql, db, id } = await account();
    db.prepare("INSERT INTO items (id, user_id, def, color, blemish, seed, crate, fischer, created_at) VALUES ('old1', ?, 'pirate-hat', 'red', 12, 3, 'beta-001', 0, 1)").run(id);
    db.prepare("INSERT INTO results (user_id, mode, online, placement, players, played_at) VALUES (?, 'classic', 0, 1, 8, 1)").run(id);
    const locker = await lockerState(sql, id);
    expect(locker.items.map((i) => i.def)).toEqual(["pirate-hat"]);
    expect(locker.welcome).toEqual({ games: 1, status: "locked", notice: false });
  });

  it("a database from before the crate (no welcome_crates table yet) still answers a locker", async () => {
    const { sql, db, id } = await account();
    db.exec("DROP TABLE welcome_crates");
    expect((await lockerState(sql, id)).welcome.status).toBe("locked");
  });
});
