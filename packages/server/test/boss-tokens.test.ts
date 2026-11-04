import { describe, expect, it } from "vitest";
import { BOSS_CRATES, BOSS_TOKENS, RAID_SETTINGS, TOKEN_WINDOW_MS, battleCounts, bossCrateOf, dropBosses, dropsToken, tokenGotLine } from "@chessroyale/core";
import { legalMoves } from "@chessroyale/chess";
import { createGuest, createSession, ensureSchema, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { handleAccountApi } from "../src/api.ts";
import { battleToken, bossCrateHoldings, buyBossCrate, countBossBattle, finishSoloBattle, grantTestItems, openBossCrate, startSoloBattle, tokenHoldings } from "../src/boss-tokens.ts";
import { lockerState, openCrate } from "../src/locker.ts";
import { setup } from "./lobby-fixture.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Boss tokens, crate keys and buying a boss's crate (BOSS_TOKENS, BOSS_CRATE_PRICE; docs/decisions/2026-11-02-boss-tokens.md):
 * the drop rule over the rolling window, what counts as a battle (10 of your moves or 5 minutes: the match room's count, the
 * server's clock for solo), the purchase as one transaction (both ways, not enough, twice at once), and admins' test grants.
 */

const MIN = 60_000;
const T0 = 10 * 86_400_000;
const babur = bossCrateOf("tiger")!;

/** A fresh database with one account (signed in unless `guest`). */
async function account(guest = false) {
  const { sql, db, d1 } = memoryDb();
  await ensureSchema(sql);
  const g = await createGuest(sql, T0, "Player");
  const id = guest ? g.user.id : (await signInWithIdentity(sql, g.user, "email", "player@example.com", {}, T0)).id;
  return { sql, db, d1, id };
}

/** Randomness that answers these in turn: a drop's luck roll, then its boss pick. */
const rolls = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length]!;
};
const UNLUCKY = rolls(0.99, 0);
const LUCKY = rolls(0.01, 0);
const drops = (db: ReturnType<typeof memoryDb>["db"], id: string) => (db.prepare("SELECT COUNT(*) AS n FROM boss_token_drops WHERE user_id = ?").get(id) as { n: number }).n;

describe("the drop rule", () => {
  it("as a rule: the first in the window always, then one in four, up to 3", () => {
    expect(dropsToken(0, 0.99)).toBe(true);
    expect(dropsToken(1, 0.99)).toBe(false);
    expect(dropsToken(1, 0.24)).toBe(true);
    expect(dropsToken(2, 0.24)).toBe(true);
    expect(dropsToken(3, 0.01)).toBe(false);
    expect(BOSS_TOKENS.chance).toBe(0.25);
    expect(BOSS_TOKENS.cap).toBe(3);
  });

  it("the first counted battle with no token in the window always drops one; after that only a lucky roll; never past 3", async () => {
    const { sql, db, id } = await account();
    // The first: dropped even on an unlucky roll.
    expect(await countBossBattle(sql, id, T0, { battle: "AAAAA", rng: UNLUCKY })).not.toBeNull();
    // Then unlucky: none; lucky: one, until the window holds 3.
    expect(await countBossBattle(sql, id, T0 + MIN, { battle: "AAAAB", rng: UNLUCKY })).toBeNull();
    expect(await countBossBattle(sql, id, T0 + 2 * MIN, { battle: "AAAAC", rng: LUCKY })).not.toBeNull();
    expect(await countBossBattle(sql, id, T0 + 3 * MIN, { battle: "AAAAD", rng: LUCKY })).not.toBeNull();
    for (let i = 0; i < 5; i++) expect(await countBossBattle(sql, id, T0 + (4 + i) * MIN, { battle: "AAAAE", rng: LUCKY })).toBeNull();
    expect(drops(db, id)).toBe(3);
    const held = await tokenHoldings(sql, id);
    expect(Object.values(held.tokens).reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("the window rolls: a drop leaves it 24 hours after it came, and then the first again always drops", async () => {
    const { sql, id } = await account();
    await countBossBattle(sql, id, T0, { battle: "AAAAA", rng: UNLUCKY });
    await countBossBattle(sql, id, T0 + 1 * MIN, { battle: "AAAAB", rng: LUCKY });
    await countBossBattle(sql, id, T0 + 2 * MIN, { battle: "AAAAC", rng: LUCKY });
    // Full: 3 in the window, even a lucky roll gets none until the first leaves it.
    expect(await countBossBattle(sql, id, T0 + TOKEN_WINDOW_MS - 1, { battle: "AAAAD", rng: LUCKY })).toBeNull();
    // The first is out (2 left): a lucky roll drops, an unlucky one doesn't.
    expect(await countBossBattle(sql, id, T0 + TOKEN_WINDOW_MS, { battle: "AAAAE", rng: UNLUCKY })).toBeNull();
    expect(await countBossBattle(sql, id, T0 + TOKEN_WINDOW_MS + 1, { battle: "AAAAF", rng: LUCKY })).not.toBeNull();
    // A day after the last of them: an empty window, so the next counted battle always drops.
    const later = T0 + TOKEN_WINDOW_MS + 1 + TOKEN_WINDOW_MS;
    expect(await countBossBattle(sql, id, later, { battle: "AAAAG", rng: UNLUCKY })).not.toBeNull();
  });

  it("two battles counted at once with an empty window: only one takes the first place (the window is counted in the drop's own statement)", async () => {
    const { sql, db, id } = await account();
    const both = await Promise.all([countBossBattle(sql, id, T0, { battle: "AAAAA", rng: UNLUCKY }), countBossBattle(sql, id, T0, { battle: "AAAAB", rng: UNLUCKY })]);
    expect(both.filter(Boolean)).toHaveLength(1);
    // And a drop written by another battle just before this one's statement runs: this one sees it, and drops nothing.
    const racing: Sql = {
      ...sql,
      async batch(statements) {
        db.prepare("INSERT INTO boss_token_drops (id, user_id, boss, at, battle) VALUES ('other', ?, 'tiger', ?, 'ZZZZZ')").run(id, T0 + TOKEN_WINDOW_MS + 5);
        return sql.batch(statements);
      },
    };
    expect(await countBossBattle(racing, id, T0 + TOKEN_WINDOW_MS + 10, { battle: "AAAAC", rng: UNLUCKY })).toBeNull();
    expect(Object.values((await tokenHoldings(sql, id)).tokens).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("which boss: one of the live bosses, each as likely (not the Hidden Boss, not one for admins first, not one resting)", async () => {
    const live = dropBosses().map((b) => b.id);
    expect(live).toContain("tiger");
    expect(live).not.toContain("recluse");
    expect(live).not.toContain("timber");
    const { sql, id } = await account();
    // The boss pick is the second roll, spread evenly over the list.
    expect(await countBossBattle(sql, id, T0, { battle: "AAAAA", rng: rolls(0.5, 0) })).toBe(live[0]);
    expect(await countBossBattle(sql, id, T0 + MIN, { battle: "AAAAB", rng: rolls(0.01, 0.9999) })).toBe(live[live.length - 1]);
    const off = dropBosses(["tiger"]).map((b) => b.id);
    expect(off).not.toContain("tiger");
    expect(off).toHaveLength(live.length - 1);
  });

  it("where sign-in is set up, a guest earns none (a signed-in account does); an account deleted since gets nothing", async () => {
    const guest = await account(true);
    expect(await countBossBattle(guest.sql, guest.id, T0, { battle: "AAAAA", signedInOnly: true, rng: UNLUCKY })).toBeNull();
    expect(await countBossBattle(guest.sql, guest.id, T0, { battle: "AAAAA", signedInOnly: false, rng: UNLUCKY })).not.toBeNull();
    const signed = await account();
    expect(await countBossBattle(signed.sql, signed.id, T0, { battle: "AAAAA", signedInOnly: true, rng: UNLUCKY })).not.toBeNull();
    expect(await countBossBattle(signed.sql, "nobody", T0, { battle: "AAAAA", rng: UNLUCKY })).toBeNull();
  });

  it("the result screen finds its battle's token (an online match's lobby code), and only its own account's", async () => {
    const { sql, id } = await account();
    const boss = await countBossBattle(sql, id, T0, { battle: "QWERT", rng: UNLUCKY });
    expect(await battleToken(sql, id, "QWERT", T0 + MIN)).toBe(boss);
    expect(await battleToken(sql, id, "ZZZZZ", T0 + MIN)).toBeNull();
    expect(await battleToken(sql, "someone-else", "QWERT", T0 + MIN)).toBeNull();
    expect(await battleToken(sql, id, "' OR 1", T0 + MIN)).toBeNull();
    expect(tokenGotLine("tiger")).toBe("You got a Babur token!");
    expect(tokenGotLine("alfil")).toBe("You got an Alfil token!");
    expect(tokenGotLine("clown")).toBe("You got a Boingo token!");
  });
});

describe("what counts as a battle: 10 of your moves or 5 minutes, whichever comes first", () => {
  it("the threshold", () => {
    expect(battleCounts({ moves: 9, ms: 5 * MIN - 1 })).toBe(false);
    expect(battleCounts({ moves: 10, ms: 0 })).toBe(true);
    expect(battleCounts({ moves: 0, ms: 5 * MIN })).toBe(true);
  });

  it("solo: timed by the server's clock alone, from the start it noted to the finish; counted once", async () => {
    const { sql, id } = await account();
    // Under 5 minutes: not counted, and the battle is closed (asking again later counts nothing).
    const short = (await startSoloBattle(sql, id, T0, false))!;
    expect(await finishSoloBattle(sql, id, short, T0 + 5 * MIN - 1, { rng: UNLUCKY })).toEqual({ counted: false, token: null });
    expect(await finishSoloBattle(sql, id, short, T0 + 10 * MIN, { rng: UNLUCKY })).toEqual({ counted: false, token: null });
    // 5 minutes: counted (the window's first: a token).
    const long = (await startSoloBattle(sql, id, T0 + 20 * MIN, false))!;
    const done = await finishSoloBattle(sql, id, long, T0 + 25 * MIN, { rng: UNLUCKY });
    expect(done.counted).toBe(true);
    expect(done.token).not.toBeNull();
    // Finishing twice at once: one finish counts.
    const twice = (await startSoloBattle(sql, id, T0 + 30 * MIN, false))!;
    const both = await Promise.all([finishSoloBattle(sql, id, twice, T0 + 40 * MIN, { rng: LUCKY }), finishSoloBattle(sql, id, twice, T0 + 40 * MIN, { rng: LUCKY })]);
    expect(both.filter((f) => f.counted)).toHaveLength(1);
  });

  it("solo: one open at a time (a new start replaces it, never counted); another account's battle, or a made-up one, counts nothing", async () => {
    const { sql, id } = await account();
    const first = (await startSoloBattle(sql, id, T0, false))!;
    const second = (await startSoloBattle(sql, id, T0 + MIN, false))!;
    expect(first).not.toBe(second);
    expect((await finishSoloBattle(sql, id, first, T0 + 20 * MIN)).counted).toBe(false);
    const other = await createGuest(sql, T0, "Other");
    expect((await finishSoloBattle(sql, other.user.id, second, T0 + 20 * MIN)).counted).toBe(false);
    expect((await finishSoloBattle(sql, id, "0".repeat(18), T0 + 20 * MIN)).counted).toBe(false);
    expect((await finishSoloBattle(sql, id, { id: second }, T0 + 20 * MIN)).counted).toBe(false);
    expect((await finishSoloBattle(sql, id, second, T0 + 20 * MIN)).counted).toBe(true);
  });

  it("solo: where sign-in is set up, a guest's start notes nothing", async () => {
    const guest = await account(true);
    expect(await startSoloBattle(guest.sql, guest.id, T0, true)).toBeNull();
    expect(guest.db.prepare("SELECT COUNT(*) AS n FROM solo_battles").get()).toEqual({ n: 0 });
    const signed = await account();
    expect(await startSoloBattle(signed.sql, signed.id, T0, true)).toMatch(/^[0-9a-f]{18}$/);
  });

  it("online: the match room counts each person's own picks that went in, and the time from the match's start", () => {
    const L = setup({ ...RAID_SETTINGS, bossId: "bigboy", lastStandFrom: 999 });
    for (let i = 1; i <= 2; i++) L.core.connect(undefined, `P${i}`, "phone", false, 1500, undefined, `user-${i}`);
    expect(L.core.bossBattleSpan("p1")).toBeNull();
    L.core.message("p1", { t: "start" });
    for (let i = 0; i < 200 && L.core.record.phase !== "play"; i++) L.advance(1_000);
    expect(L.core.record.phase).toBe("play");
    // p1 picks, p2 doesn't: one move for p1, none for p2, once the turn locks.
    const r = L.last("p1", "round")!;
    L.core.message("p1", { t: "pick", key: r.key, move: (r.boss?.powers?.allowed ?? legalMoves(r.board!.fen))[0]! });
    for (let i = 0; i < 200 && L.core.record.phase === "play"; i++) L.advance(1_000);
    const p1 = L.core.bossBattleSpan("p1")!;
    expect(p1.moves).toBe(1);
    expect(L.core.bossBattleSpan("p2")!.moves).toBe(0);
    expect(p1.ms).toBe(L.now - L.core.record.startedAt!);
    // (Not a raid: no span.)
    const crowd = setup();
    crowd.core.connect(undefined, "P1", "phone", false, 1500, undefined, "user-1");
    crowd.core.message("p1", { t: "start" });
    expect(crowd.core.bossBattleSpan("p1")).toBeNull();
  });
});

/** An account holding `tokens` of Babur's tokens (and `keys` crate keys), as an admin's grant gives them. */
async function holding(tokens: number, keys = 0) {
  const a = await account();
  if (tokens) await grantTestItems(a.sql, a.id, { boss: "tiger", tokens });
  if (keys) await grantTestItems(a.sql, a.id, { keys });
  return a;
}
const items = (db: ReturnType<typeof memoryDb>["db"], id: string) => db.prepare("SELECT def, crate FROM items WHERE user_id = ?").all(id) as { def: string; crate: string }[];
/** The boss crates an account holds, unopened, as stored: one row each. */
const held = (db: ReturnType<typeof memoryDb>["db"], id: string) => (db.prepare("SELECT crate FROM boss_crates WHERE user_id = ? ORDER BY crate").all(id) as { crate: string }[]).map((r) => r.crate);

describe("buying a boss's crate", () => {
  it("the crates: each boss's ride among its prizes, and never in the Crates tab's free crates", async () => {
    expect(BOSS_CRATES.map((c) => [c.boss, c.ride])).toEqual([
      ["tiger", "balloon-pup"],
      ["gardener", "puddles-mower"],
      ["alfil", "alfil-howdah"],
      ["bigboy", "bigboy-buggy"],
      ["timber", "log-roller"],
      ["dash", "cheetah-shoes"],
      ["hollow", "hollow-bulb"],
      ["pig", "pen-pony"],
      ["grex", "jefferson-giraffe"],
      ["gingerbread", "ginger-sled"],
    ]);
    for (const c of BOSS_CRATES) expect(c.items).toContain(c.ride);
    const { sql, id } = await account();
    expect(await openCrate(sql, id, babur.id, {}, T0)).toEqual({ ok: false, message: "No such crate." });
  });

  it("with 3 tokens: the crate goes into your inventory unopened (Eric, Nov 2), and the tokens are spent", async () => {
    const { sql, db, id } = await holding(4);
    const r = await buyBossCrate(sql, id, babur.id, "tokens", T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.crate).toBe("boss-tiger");
    expect(held(db, id)).toEqual(["boss-tiger"]);
    // Not opened: no item yet.
    expect(items(db, id)).toEqual([]);
    expect([r.locker.tokens, r.locker.bossCrates, r.locker.items]).toEqual([{ tiger: 1 }, { "boss-tiger": 1 }, []]);
  });

  it("with a token and a crate key: both are spent; a second buy holds a second crate", async () => {
    const { sql, db, id } = await holding(2, 2);
    const r = await buyBossCrate(sql, id, babur.id, "key", T0);
    expect(r.ok && [r.locker.tokens, r.locker.keys, r.locker.bossCrates]).toEqual([{ tiger: 1 }, 1, { "boss-tiger": 1 }]);
    const again = await buyBossCrate(sql, id, babur.id, "key", T0 + 1);
    expect(again.ok && [again.locker.tokens, again.locker.keys, again.locker.bossCrates]).toEqual([{}, 0, { "boss-tiger": 2 }]);
    expect(held(db, id)).toEqual(["boss-tiger", "boss-tiger"]);
    expect(items(db, id)).toEqual([]);
  });

  it("not enough: refused, nothing spent and nothing given (another boss's tokens don't count)", async () => {
    const { sql, db, id } = await holding(2, 0);
    await grantTestItems(sql, id, { boss: "gardener", tokens: 5 });
    expect(await buyBossCrate(sql, id, babur.id, "tokens", T0)).toEqual({ ok: false, message: "You need 3 Babur tokens." });
    expect(await buyBossCrate(sql, id, babur.id, "key", T0)).toEqual({ ok: false, message: "You need 1 Babur token and 1 crate key." });
    expect(items(db, id)).toEqual([]);
    expect(held(db, id)).toEqual([]);
    expect(await tokenHoldings(sql, id)).toEqual({ tokens: { gardener: 5, tiger: 2 }, keys: 0 });
    // Keys without a token: refused too.
    const k = await holding(0, 3);
    expect((await buyBossCrate(k.sql, k.id, babur.id, "key", T0)).ok).toBe(false);
    expect((await tokenHoldings(k.sql, k.id)).keys).toBe(3);
  });

  it("not a boss crate, or no such way: refused", async () => {
    const { sql, id } = await holding(3, 1);
    expect(await buyBossCrate(sql, id, "beta-001", "tokens", T0)).toEqual({ ok: false, message: "No such crate." });
    expect(await buyBossCrate(sql, id, babur.id, "coins", T0)).toEqual({ ok: false, message: "No such price." });
    expect((await tokenHoldings(sql, id)).tokens).toEqual({ tiger: 3 });
  });

  it("twice at once (a double tap, two devices) with enough for one: one crate, paid once; with enough for two, two crates paid twice", async () => {
    const one = await holding(3, 0);
    const both = await Promise.all([buyBossCrate(one.sql, one.id, babur.id, "tokens", T0), buyBossCrate(one.sql, one.id, babur.id, "tokens", T0)]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    expect(held(one.db, one.id)).toHaveLength(1);
    expect(await tokenHoldings(one.sql, one.id)).toEqual({ tokens: {}, keys: 0 });
    // The two ways at once, with 3 tokens and a key (enough for either, not both): one crate, paid its own way.
    const mixed = await holding(3, 1);
    const ways = await Promise.all([buyBossCrate(mixed.sql, mixed.id, babur.id, "tokens", T0), buyBossCrate(mixed.sql, mixed.id, babur.id, "key", T0)]);
    expect(ways.filter((r) => r.ok)).toHaveLength(1);
    expect(await tokenHoldings(mixed.sql, mixed.id)).toEqual(ways[0]!.ok ? { tokens: {}, keys: 1 } : { tokens: { tiger: 2 }, keys: 0 });
    expect(held(mixed.db, mixed.id)).toHaveLength(1);
    const two = await holding(6, 0);
    const paid = await Promise.all([buyBossCrate(two.sql, two.id, babur.id, "tokens", T0), buyBossCrate(two.sql, two.id, babur.id, "tokens", T0)]);
    expect(paid.every((r) => r.ok)).toBe(true);
    expect(held(two.db, two.id)).toHaveLength(2);
    expect((await tokenHoldings(two.sql, two.id)).tokens).toEqual({});
  });

  it("the tokens spent elsewhere just before this buy's transaction: it gives nothing and takes nothing", async () => {
    const { sql, db, id } = await holding(3, 0);
    const racing: Sql = {
      ...sql,
      async batch(statements) {
        db.prepare("UPDATE boss_tokens SET n = 1 WHERE user_id = ?").run(id);
        return sql.batch(statements);
      },
    };
    expect(await buyBossCrate(racing, id, babur.id, "tokens", T0)).toEqual({ ok: false, message: "You need 3 Babur tokens." });
    expect(held(db, id)).toEqual([]);
    expect((await tokenHoldings(sql, id)).tokens).toEqual({ tiger: 1 });
  });
});

describe("holding and opening a boss crate (Eric, Nov 2: it's in your inventory; it opens as any crate)", () => {
  const puddles = bossCrateOf("gardener")!;
  /** An account holding `n` of Babur's crates, bought the usual way. */
  async function crates(n: number) {
    const a = await holding(3 * n);
    for (let i = 0; i < n; i++) expect((await buyBossCrate(a.sql, a.id, babur.id, "tokens", T0 + i)).ok).toBe(true);
    return a;
  }

  it("opening one you hold: an item from its pool into the locker, rolled by the server; the crate is gone", async () => {
    const { sql, db, id } = await crates(1);
    const r = await openBossCrate(sql, id, babur.id, T0 + MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(babur.items).toContain(r.item.def);
    expect(r.roll.def).toBe(r.item.def);
    expect(items(db, id)).toEqual([{ def: r.item.def, crate: "boss-tiger" }]);
    expect(held(db, id)).toEqual([]);
    expect(r.locker.bossCrates).toEqual({});
    expect(r.locker.items.map((i) => i.id)).toContain(r.item.id);
  });

  it("once, never twice: a second open of the one crate is refused and gives nothing", async () => {
    const { sql, db, id } = await crates(1);
    expect((await openBossCrate(sql, id, babur.id, T0 + MIN)).ok).toBe(true);
    expect(await openBossCrate(sql, id, babur.id, T0 + MIN)).toEqual({ ok: false, message: "You have no Babur's Boss Crate to open." });
    expect(items(db, id)).toHaveLength(1);
  });

  it("twice at once (a double tap, two devices) with one crate: one item, the crate gone; with two crates, two items", async () => {
    const one = await crates(1);
    const both = await Promise.all([openBossCrate(one.sql, one.id, babur.id, T0 + MIN), openBossCrate(one.sql, one.id, babur.id, T0 + MIN)]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    expect(items(one.db, one.id)).toHaveLength(1);
    expect(held(one.db, one.id)).toEqual([]);
    const two = await crates(2);
    const twice = await Promise.all([openBossCrate(two.sql, two.id, babur.id, T0 + MIN), openBossCrate(two.sql, two.id, babur.id, T0 + MIN)]);
    expect(twice.every((r) => r.ok)).toBe(true);
    expect(items(two.db, two.id)).toHaveLength(2);
    expect(held(two.db, two.id)).toEqual([]);
    expect(await openBossCrate(two.sql, two.id, babur.id, T0 + MIN)).toEqual({ ok: false, message: "You have no Babur's Boss Crate to open." });
  });

  it("can't open one you don't have: none at all, another boss's, or someone else's; not a boss crate; nothing given, nothing taken", async () => {
    const none = await holding(0);
    expect(await openBossCrate(none.sql, none.id, babur.id, T0)).toEqual({ ok: false, message: "You have no Babur's Boss Crate to open." });
    expect(items(none.db, none.id)).toEqual([]);
    // Holding Babur's doesn't open Puddles'.
    const { sql, db, id } = await crates(1);
    expect(await openBossCrate(sql, id, puddles.id, T0)).toEqual({ ok: false, message: "You have no Puddles' Boss Crate to open." });
    expect(held(db, id)).toEqual(["boss-tiger"]);
    // Someone else's crate isn't yours to open (the other account, on the same database).
    const other = await createGuest(sql, T0, "Other");
    expect((await openBossCrate(sql, other.user.id, babur.id, T0)).ok).toBe(false);
    expect(held(db, id)).toEqual(["boss-tiger"]);
    expect(items(db, other.user.id)).toEqual([]);
    // A free crate's id, a made-up one, not a string.
    for (const bad of ["beta-001", "boss-nobody", 7, null]) expect(await openBossCrate(sql, id, bad, T0)).toEqual({ ok: false, message: "No such crate." });
    expect(items(db, id)).toEqual([]);
  });

  it("the crate opened elsewhere just before this open's transaction: it gives nothing and takes nothing more", async () => {
    const { sql, db, id } = await crates(1);
    const racing: Sql = {
      ...sql,
      async batch(statements) {
        db.prepare("DELETE FROM boss_crates WHERE user_id = ?").run(id);
        return sql.batch(statements);
      },
    };
    expect(await openBossCrate(racing, id, babur.id, T0)).toEqual({ ok: false, message: "You have no Babur's Boss Crate to open." });
    expect(items(db, id)).toEqual([]);
  });

  it("an item that can't go in (its write fails): the crate stays, the whole open undone", async () => {
    const { sql, db, id } = await crates(1);
    const failing: Sql = {
      ...sql,
      async batch(statements) {
        // The crate's statement runs, then the last one fails: D1's batch (and this one) rolls the whole of it back.
        return sql.batch([...statements, { sql: "INSERT INTO nowhere VALUES (1)", params: [] }]);
      },
    };
    await expect(openBossCrate(failing, id, babur.id, T0)).rejects.toThrow();
    expect(held(db, id)).toEqual(["boss-tiger"]);
    expect(items(db, id)).toEqual([]);
  });

  it("through the API: /api/locker/open opens a boss crate you hold (never with a test switch), refuses one you don't; the shop's kill switch refuses both", async () => {
    const call = async (env: object, path: string, body: unknown, cookie: string) => {
      const res = (await handleAccountApi(new Request(`https://hunchess.com${path}`, { method: "POST", body: JSON.stringify(body), headers: { cookie } }), env as never))!;
      return { status: res.status, body: (await res.json()) as Record<string, unknown> };
    };
    const { sql, d1, db } = memoryDb();
    await ensureSchema(sql);
    const g = await createGuest(sql, T0, "Eric");
    const eric = await signInWithIdentity(sql, g.user, "email", "eric@example.com", {}, T0);
    const cookie = `hc_session=${await createSession(sql, eric.id, Date.now())}`;
    const env = { DB: d1, ADMIN_EMAILS: "eric@example.com", TEST_SWITCHES: "1" };
    expect(await call(env, "/api/locker/open", { crate: babur.id }, cookie)).toEqual({ status: 400, body: { message: "You have no Babur's Boss Crate to open." } });
    await grantTestItems(sql, eric.id, { boss: "tiger", tokens: 6 });
    const bought = await call(env, "/api/shop/boss-crate", { crate: babur.id, way: "tokens" }, cookie);
    expect([bought.status, bought.body.crate, (bought.body.locker as { bossCrates: unknown }).bossCrates]).toEqual([200, "boss-tiger", { "boss-tiger": 1 }]);
    expect(bought.body.item).toBeUndefined();
    // (A forced Fischer Random is a free crate's test switch: a boss crate ignores it.)
    const opened = await call(env, "/api/locker/open", { crate: babur.id, fischer: true, shiny: true }, cookie);
    expect(opened.status).toBe(200);
    expect(babur.items).toContain((opened.body.item as { def: string }).def);
    expect((opened.body.locker as { bossCrates: unknown }).bossCrates).toEqual({});
    expect(await call(env, "/api/locker/open", { crate: babur.id }, cookie)).toEqual({ status: 400, body: { message: "You have no Babur's Boss Crate to open." } });
    // The shop resting: no buys, no opens (with enough for a buy, and a crate held: both would go through otherwise); nothing changes.
    expect((await call(env, "/api/shop/boss-crate", { crate: babur.id, way: "tokens" }, cookie)).status).toBe(200);
    await grantTestItems(sql, eric.id, { boss: "tiger", tokens: 3 });
    const paused = { ...env, PAUSE_SHOP: "1" };
    expect((await call(paused, "/api/locker/open", { crate: babur.id }, cookie)).status).toBe(503);
    expect((await call(paused, "/api/shop/boss-crate", { crate: babur.id, way: "tokens" }, cookie)).status).toBe(503);
    expect(held(db, eric.id)).toEqual(["boss-tiger"]);
    expect((await tokenHoldings(sql, eric.id)).tokens).toEqual({ tiger: 3 });
  });

  it("an older account (no boss crates table rows) reads as holding none; the locker always says so", async () => {
    const { sql, id } = await holding(0);
    expect((await lockerState(sql, id)).bossCrates).toEqual({});
    expect(await bossCrateHoldings(sql, id)).toEqual({});
  });
});

describe("admins' test grants", () => {
  const call = async (env: object, path: string, body: unknown, cookie: string) => {
    const res = (await handleAccountApi(new Request(`https://hunchess.com${path}`, { method: "POST", body: JSON.stringify(body), headers: { cookie } }), env as never))!;
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  it("only an admin may grant (anyone else: not found, nothing given); keys and any boss's tokens, at most grantMax at once", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql);
    const env = { DB: d1, ADMIN_EMAILS: "eric@example.com" };
    const g = await createGuest(sql, T0, "Player");
    const player = await signInWithIdentity(sql, g.user, "email", "player@example.com", {}, T0);
    const playerCookie = `hc_session=${await createSession(sql, player.id, Date.now())}`;
    expect(await call(env, "/api/locker/grant", { keys: 3, boss: "tiger", tokens: 3 }, playerCookie)).toEqual({ status: 404, body: { message: "Not found" } });
    expect(await tokenHoldings(sql, player.id)).toEqual({ tokens: {}, keys: 0 });
    const g2 = await createGuest(sql, T0, "Eric");
    const eric = await signInWithIdentity(sql, g2.user, "email", "eric@example.com", {}, T0);
    const ericCookie = `hc_session=${await createSession(sql, eric.id, Date.now())}`;
    const r = await call(env, "/api/locker/grant", { keys: 2, boss: "tiger", tokens: 3 }, ericCookie);
    expect(r.status).toBe(200);
    expect([r.body.keys, r.body.tokens]).toEqual([2, { tiger: 3 }]);
    // Capped, and only a boss tokens exist for (not the Hidden Boss, not a made-up one).
    expect((await call(env, "/api/locker/grant", { keys: 1000 }, ericCookie)).body.keys).toBe(2 + BOSS_TOKENS.grantMax);
    expect(await call(env, "/api/locker/grant", { boss: "recluse", tokens: 3 }, ericCookie)).toEqual({ status: 400, body: { message: "Nothing to give." } });
    expect(await call(env, "/api/locker/grant", { boss: "nobody", tokens: 3 }, ericCookie)).toEqual({ status: 400, body: { message: "Nothing to give." } });
    // And the admin buys Babur's crate through the API, both ways (into the inventory, unopened).
    expect((await call(env, "/api/shop/boss-crate", { crate: babur.id, way: "tokens" }, ericCookie)).status).toBe(200);
    await call(env, "/api/locker/grant", { boss: "tiger", tokens: 1 }, ericCookie);
    const k = await call(env, "/api/shop/boss-crate", { crate: babur.id, way: "key" }, ericCookie);
    expect([k.status, (k.body.locker as { keys: number }).keys, (k.body.locker as { bossCrates: unknown }).bossCrates]).toEqual([200, 2 + BOSS_TOKENS.grantMax - 1, { "boss-tiger": 2 }]);
    // The player can't buy without tokens.
    expect(await call(env, "/api/shop/boss-crate", { crate: babur.id, way: "tokens" }, playerCookie)).toEqual({ status: 400, body: { message: "You need 3 Babur tokens." } });
  });
});

describe("a guest signing in to an existing account", () => {
  it("brings its tokens, keys, drops and unopened boss crates along (added up; the account's window counts the drops)", async () => {
    const { sql, db } = memoryDb();
    await ensureSchema(sql);
    const a = await createGuest(sql, T0, "Owner");
    const owner = await signInWithIdentity(sql, a.user, "email", "owner@example.com", {}, T0);
    await grantTestItems(sql, owner.id, { boss: "tiger", tokens: 1, keys: 1 });
    const guest = await createGuest(sql, T0, "Guest");
    await grantTestItems(sql, guest.user.id, { boss: "tiger", tokens: 5, keys: 2 });
    // (The guest buys a crate and keeps it unopened: it comes along too.)
    expect((await buyBossCrate(sql, guest.user.id, babur.id, "tokens", T0)).ok).toBe(true);
    await countBossBattle(sql, guest.user.id, T0, { battle: "AAAAA", rng: UNLUCKY });
    await signInWithIdentity(sql, guest.user, "email", "owner@example.com", {}, T0 + MIN);
    const held = await tokenHoldings(sql, owner.id);
    expect(held.keys).toBe(3);
    expect(Object.values(held.tokens).reduce((x, y) => x + y, 0)).toBe(4);
    expect(drops(db, owner.id)).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM boss_tokens WHERE user_id = ?").get(guest.user.id)).toEqual({ n: 0 });
    // The moved drop fills the window's first place: an unlucky battle now drops nothing.
    expect(await countBossBattle(sql, owner.id, T0 + 2 * MIN, { battle: "AAAAB", rng: UNLUCKY })).toBeNull();
    expect((await lockerState(sql, owner.id)).keys).toBe(3);
    expect(await bossCrateHoldings(sql, owner.id)).toEqual({ "boss-tiger": 1 });
    expect(await bossCrateHoldings(sql, guest.user.id)).toEqual({});
  });
});
