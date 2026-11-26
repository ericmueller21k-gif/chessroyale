import { describe, expect, it, vi } from "vitest";
import { COIN_BOOST, LEVEL_CRATE_BONUS, XP, questDrop, rewardLines, xpDayStart, type QuestDrop } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { handleAccountApi } from "../src/api.ts";
import { grantTestItems } from "../src/boss-tokens.ts";
import { BOOST, NO_BOOST_CRATE, boostOpId, openBoostCrate } from "../src/coin-boost.ts";
import { setCase } from "../src/fairplay.ts";
import { ledgerAccount, ledgerMismatches } from "../src/ledger.ts";
import { lockerState } from "../src/locker.ts";
import { coinDayOf } from "../src/play-coins.ts";
import { questOpId, setTestQuests } from "../src/quests.ts";
import { grantXp, setTestXp, type XpGame } from "../src/xp.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: the match rooms import it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));

/**
 * The coin boost and the Crate Bonus on the server (Nov 26; server/coin-boost.ts, quests.ts, rewards.ts, xp.ts grantXp; core's
 * coin-boost.ts; docs/decisions/2026-11-26-coin-boost.md): a daily quest's drop rolled in its completion op (the roll's wiring), the Coin
 * Boost Crate opened once, the boost counting down by counted games' minutes only, the day's 300 and the bonus steps counting base coins,
 * no stacking, a game boosted once (retries, games at once), and the Crate Bonus doubling paying level-ups' crates (keys stay 1).
 */
const T0 = Date.UTC(2026, 10, 26, 12, 0);
const MIN = 60_000;
const DAY = 86_400_000;

async function world() {
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql);
  return { sql, d1 };
}
const signedIn = async (sql: Sql, email: string) => signInWithIdentity(sql, (await createGuest(sql, T0, "Player")).user, "email", email, {}, T0);
/** A counted online game of `minutes` (12 moves: short of the daily reward's 15, so no crate muddles the counts). */
const game = (key: string, minutes: number, over: Partial<XpGame> = {}, facts: Partial<XpGame["facts"]> = {}): XpGame => ({
  key,
  facts: { ms: minutes * MIN, moves: 12, won: false, ...facts },
  signedInOnly: true,
  now: T0,
  ...over,
});
const wallet = (sql: Sql, id: string) =>
  sql.first<{ coins: number; boost_crates: number; boost_minutes: number; crate_bonus: number; crate_keys: number }>(
    "SELECT coins, boost_crates, boost_minutes, crate_bonus, crate_keys FROM wallets WHERE user_id = ?",
    id,
  );
const winter = async (sql: Sql, id: string) => (await sql.first<{ n: number }>("SELECT n FROM series_crates WHERE user_id = ? AND crate = ?", id, XP.rewardCrate))?.n ?? 0;
/** An account with `n` boost minutes (Coin Boost Crates granted and opened). */
async function boosted(sql: Sql, email: string, crates = 1) {
  const a = await signedIn(sql, email);
  expect(await grantTestItems(sql, a.id, { boost: crates }, T0)).toEqual({ ok: true });
  for (let i = 0; i < crates; i++) expect(await openBoostCrate(sql, a.id, `open-${email}-${i}`, T0)).toEqual({ ok: true });
  return a;
}
const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
/**
 * An account whose first quest (dealt by the test switch) rolls `want` when finished: its ledger id is picked here, before its first
 * ledger row, so the roll (core's questDrop, from the completion op's key, which holds the ledger id) is known. Answers the account,
 * its ledger id and the quest's op key.
 */
async function rolling(sql: Sql, email: string, kind: string, progress: number, want: QuestDrop, weekly = false) {
  const a = await signedIn(sql, email);
  expect(await setTestQuests(sql, a.id, [{ kind, progress }], T0)).toBe(true);
  const q = (await sql.first<{ id: string }>("SELECT id FROM quests WHERE user_id = ? AND period = ?", a.id, weekly ? "weekly" : "daily"))!;
  let account = hex(12);
  while (questDrop(questOpId(kind, q.id, account)) !== want) account = hex(12);
  await sql.run("INSERT INTO ledger_accounts (user_id, account) VALUES (?, ?)", a.id, account);
  return { a, account, op: questOpId(kind, q.id, account) };
}

describe("the drop: a daily quest finished rolls once, in its completion op", () => {
  it("a Coin Boost Crate: its leg in the quest's op (the game its source), the result names it, the locker holds it; a replay drops nothing more", async () => {
    const { sql } = await world();
    const { a, op } = await rolling(sql, "ann@example.com", "warm-up", 2, "boost");
    const g = game("lobby:AAAAA:1", 12, { quest: "classic" });
    const x = await grantXp(sql, a.id, g);
    expect(x!.rewards!.quests).toEqual([{ quest: "warm-up", name: "Warm Up", xp: 300, crates: 0, keys: 0, boost: 1 }]);
    expect(rewardLines(x!.rewards!, "Winter Crate").drops).toEqual(["+1 Coin Boost Crate: open it in Crates for 2.5x coins over 120 minutes of play"]);
    expect(await sql.all("SELECT asset_kind, delta, source_id FROM ledger WHERE op_id = ? ORDER BY leg", op)).toEqual([
      { asset_kind: "xp", delta: 300, source_id: "lobby:AAAAA:1" },
      { asset_kind: "boost_crate", delta: 1, source_id: "lobby:AAAAA:1" },
    ]);
    expect((await grantXp(sql, a.id, g))!.rewards!.quests).toEqual(x!.rewards!.quests);
    const l = await lockerState(sql, a.id);
    expect([l.boostCrates, l.boostMinutes, l.crateBonus]).toEqual([1, 0, 0]);
    expect(await ledgerMismatches(sql, a.id)).toEqual([]);
  });

  it("a Crate Bonus: LEVEL_CRATE_BONUS.levels level-ups, applied at once", async () => {
    const { sql } = await world();
    const { a, op } = await rolling(sql, "bo@example.com", "fifty-fifty", 0, "bonus");
    const x = await grantXp(sql, a.id, game("lobby:BBBBB:1", 12, { quest: "crowd" }));
    expect(x!.rewards!.quests).toEqual([{ quest: "fifty-fifty", name: "Fifty-Fifty", xp: 300, crates: 0, keys: 0, crateBonus: LEVEL_CRATE_BONUS.levels }]);
    expect(await sql.all("SELECT asset_kind, delta FROM ledger WHERE op_id = ? ORDER BY leg", op)).toEqual([
      { asset_kind: "xp", delta: 300 },
      { asset_kind: "crate_bonus", delta: 5 },
    ]);
    expect((await lockerState(sql, a.id)).crateBonus).toBe(5);
  });

  it("nothing: the op is the quest's alone; the weekly never rolls (a key that would roll a crate as a daily's)", async () => {
    const { sql } = await world();
    const none = await rolling(sql, "cy@example.com", "warm-up", 2, null);
    expect((await grantXp(sql, none.a.id, game("lobby:CCCCC:1", 12, { quest: "classic" })))!.rewards!.quests).toEqual([{ quest: "warm-up", name: "Warm Up", xp: 300, crates: 0, keys: 0 }]);
    expect(await sql.all("SELECT asset_kind FROM ledger WHERE op_id = ?", none.op)).toEqual([{ asset_kind: "xp" }]);
    const weekly = await rolling(sql, "di@example.com", "regular", 9, "boost", true);
    await grantXp(sql, weekly.a.id, game("lobby:DDDDD:1", 12, { quest: "classic" }));
    expect((await sql.all<{ asset_kind: string }>("SELECT asset_kind FROM ledger WHERE op_id = ? ORDER BY leg", weekly.op)).map((r) => r.asset_kind)).toEqual(["xp", "series_crate", "keys"]);
    expect((await lockerState(sql, weekly.a.id)).boostCrates).toBe(0);
  });
});

describe("opening a Coin Boost Crate", () => {
  it("free, once a request: a crate off, 120 minutes on; with none, refused; a second crate adds 120 more", async () => {
    const { sql } = await world();
    const a = await signedIn(sql, "ann@example.com");
    expect(await openBoostCrate(sql, a.id, "first-open-1", T0)).toEqual({ ok: false, message: NO_BOOST_CRATE });
    await grantTestItems(sql, a.id, { boost: 2 }, T0);
    expect(await openBoostCrate(sql, a.id, "first-open-1", T0)).toEqual({ ok: true });
    // (The same request again: the first open's answer, nothing more.)
    expect(await openBoostCrate(sql, a.id, "first-open-1", T0)).toEqual({ ok: true });
    expect(await wallet(sql, a.id)).toMatchObject({ boost_crates: 1, boost_minutes: COIN_BOOST.minutes });
    expect(await openBoostCrate(sql, a.id, "second-open", T0)).toEqual({ ok: true });
    expect(await wallet(sql, a.id)).toMatchObject({ boost_crates: 0, boost_minutes: 2 * COIN_BOOST.minutes });
    expect(await openBoostCrate(sql, a.id, "third-open", T0)).toEqual({ ok: false, message: NO_BOOST_CRATE });
    expect(await ledgerMismatches(sql, a.id)).toEqual([]);
  });

  it("the API: POST /api/locker/boost answers the locker; refused with none; the shop's kill switch rests it", async () => {
    const { sql, d1 } = await world();
    const a = await signedIn(sql, "ann@example.com");
    const cookie = `hc_session=${await createSession(sql, a.id, Date.now())}`;
    const call = async (body: unknown, env: Record<string, unknown> = {}) => {
      const res = (await handleAccountApi(new Request("https://hunchess.com/api/locker/boost", { method: "POST", body: JSON.stringify(body), headers: { cookie } }), { DB: d1, ...env } as never))!;
      return { status: res.status, body: (await res.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
    };
    expect(await call({ request: "api-open-0001" })).toEqual({ status: 400, body: { message: NO_BOOST_CRATE } });
    await grantTestItems(sql, a.id, { boost: 1 }, T0);
    expect((await call({ request: "api-open-0002" }, { PAUSE_SHOP: "1" })).status).toBe(503);
    const r = await call({ request: "api-open-0002" });
    expect(r.status).toBe(200);
    expect([r.body.locker.boostCrates, r.body.locker.boostMinutes]).toEqual([0, COIN_BOOST.minutes]);
  });
});

describe("a boosted game", () => {
  it("its coins times 2.5: the extra its own op (reason coin-boost), its counted minutes off the boost", async () => {
    const { sql } = await world();
    const a = await boosted(sql, "ann@example.com");
    const before = (await wallet(sql, a.id))!.coins;
    const x = await grantXp(sql, a.id, game("lobby:AAAAA:1", 12));
    // (12 minutes: 22 play coins; 22 x 1.5 = 33 extra.)
    expect(x!.coins).toMatchObject({ play: 22, bonus: 0, today: { play: 22, bonus: 0 }, boost: { coins: 33, minutes: 12, left: 108 } });
    expect((await wallet(sql, a.id))!.coins - before).toBe(55);
    const acct = (await ledgerAccount(sql, a.id))!.account;
    expect(await sql.all("SELECT reason, asset_kind, delta, source_id FROM ledger WHERE op_id = ? ORDER BY leg", boostOpId("lobby:AAAAA:1", acct))).toEqual([
      { reason: BOOST, asset_kind: "coins", delta: 33, source_id: "lobby:AAAAA:1" },
      { reason: BOOST, asset_kind: "boost_min", delta: -12, source_id: "lobby:AAAAA:1" },
    ]);
    expect(await ledgerMismatches(sql, a.id)).toEqual([]);
  });

  it("counts down only in counted games' minutes: a short game, a held player and a game with no XP use none; a solo game the minutes XP paid", async () => {
    const { sql } = await world();
    const a = await boosted(sql, "ann@example.com");
    expect((await grantXp(sql, a.id, game("lobby:SHORT:1", 20, {}, { moves: 4 })))!.coins).toMatchObject({ play: 0, none: "short" });
    expect((await grantXp(sql, a.id, game("lobby:TEST1:1", 20, {}, { test: true })))!.coins!.boost).toBeUndefined();
    expect((await wallet(sql, a.id))!.boost_minutes).toBe(120);
    // (A solo game of 20 minutes, under the solo cap: its 20 minutes.)
    expect((await grantXp(sql, a.id, game("solo:abc", 20, { cap: "solo" })))!.coins).toMatchObject({ play: 36, boost: { coins: 54, minutes: 20, left: 100 } });
    const held = await boosted(sql, "held@example.com");
    await setCase(sql, held.id, "review", "admin", "test", T0);
    expect((await grantXp(sql, held.id, game("lobby:HELD1:1", 20)))!.coins).toMatchObject({ play: 0, none: "held" });
    expect((await wallet(sql, held.id))!.boost_minutes).toBe(120);
  });

  it("the day's 300 counts base coins: four boosted 30-minute games leave the day at 216, two more reach 300", async () => {
    const { sql } = await world();
    const a = await boosted(sql, "ann@example.com");
    for (let i = 0; i < 4; i++) expect((await grantXp(sql, a.id, game(`lobby:BOOST:${i}`, 30)))!.coins).toMatchObject({ play: 54, boost: { coins: 81, minutes: 30 } });
    const acct = (await ledgerAccount(sql, a.id))!.account;
    expect(await coinDayOf(sql, acct, xpDayStart(T0))).toEqual({ play: 216, bonus: 0 });
    expect((await wallet(sql, a.id))!.boost_minutes).toBe(0);
    expect((await grantXp(sql, a.id, game("lobby:PLAIN:1", 30)))!.coins).toMatchObject({ play: 54, today: { play: 270 } });
    expect((await grantXp(sql, a.id, game("lobby:PLAIN:2", 30)))!.coins).toMatchObject({ play: 30, today: { play: 300 } });
    expect((await grantXp(sql, a.id, game("lobby:PLAIN:3", 30)))!.coins).toMatchObject({ play: 0 });
    expect(await ledgerMismatches(sql, a.id)).toEqual([]);
  });

  it("the bonus is multiplied too, its steps count the base: a boosted win pays 15 bonus and 104 extra; the day's bonus is 15", async () => {
    const { sql } = await world();
    const a = await boosted(sql, "ann@example.com");
    const x = await grantXp(sql, a.id, game("lobby:WIN01:1", 30, {}, { won: true }));
    expect(x!.coins).toMatchObject({ play: 54, bonus: 15, today: { play: 54, bonus: 15 }, boost: { coins: 104, minutes: 30, left: 90 } });
    const acct = (await ledgerAccount(sql, a.id))!.account;
    expect(await coinDayOf(sql, acct, xpDayStart(T0))).toEqual({ play: 54, bonus: 15 });
  });

  it("past the day's 300 the boost waits: a win then pays its bonus at base and uses no minutes; the next XP day it runs again", async () => {
    const { sql } = await world();
    // (The day's 300 first, unboosted; then the crate opened.)
    const b = await signedIn(sql, "bo@example.com");
    for (let i = 0; i < 6; i++) await grantXp(sql, b.id, game(`lobby:FILL${i}:1`, 30));
    await grantTestItems(sql, b.id, { boost: 1 }, T0);
    await openBoostCrate(sql, b.id, "bo-open-1", T0);
    const past = await grantXp(sql, b.id, game("lobby:PAST1:1", 30, {}, { won: true }));
    expect(past!.coins).toMatchObject({ play: 0, bonus: 15 });
    expect(past!.coins!.boost).toBeUndefined();
    expect((await wallet(sql, b.id))!.boost_minutes).toBe(120);
    const tomorrow = await grantXp(sql, b.id, game("lobby:NEXT1:1", 30, { now: T0 + DAY }));
    expect(tomorrow!.coins).toMatchObject({ play: 54, boost: { coins: 81, minutes: 30, left: 90 } });
    expect(await ledgerMismatches(sql, b.id)).toEqual([]);
  });

  it("never stacks: with two crates opened (240 minutes) a game's extra is the same as with one", async () => {
    const { sql } = await world();
    const one = await boosted(sql, "one@example.com", 1);
    const two = await boosted(sql, "two@example.com", 2);
    const x1 = await grantXp(sql, one.id, game("lobby:ONE01:1", 30));
    const x2 = await grantXp(sql, two.id, game("lobby:TWO01:1", 30));
    expect(x1!.coins!.boost).toEqual({ coins: 81, minutes: 30, left: 90 });
    expect(x2!.coins!.boost).toEqual({ coins: 81, minutes: 30, left: 210 });
  });

  it("fewer minutes left than the game's: that share; then none", async () => {
    const { sql } = await world();
    const a = await boosted(sql, "ann@example.com");
    for (let i = 0; i < 3; i++) await grantXp(sql, a.id, game(`lobby:USE0${i}:1`, 30));
    // (30 left: a 30-minute game uses them all; then a 20-minute game is plain.)
    expect((await grantXp(sql, a.id, game("lobby:LAST1:1", 30)))!.coins!.boost).toEqual({ coins: 81, minutes: 30, left: 0 });
    expect((await grantXp(sql, a.id, game("lobby:AFTER:1", 20)))!.coins!.boost).toBeUndefined();
    const b = await boosted(sql, "bo@example.com");
    for (let i = 0; i < 3; i++) await grantXp(sql, b.id, game(`lobby:BUSE${i}:1`, 30));
    await grantXp(sql, b.id, game("lobby:BUSE3:1", 20));
    // (10 left, a 30-minute game: a third of 54 x 1.5 = 27.)
    expect((await grantXp(sql, b.id, game("lobby:BLAST:1", 30)))!.coins).toMatchObject({ play: 54, boost: { coins: 27, minutes: 10, left: 0 } });
  });

  it("a game is boosted once: a replay and three at once answer the same boost and use its minutes once", async () => {
    const { sql } = await world();
    const a = await boosted(sql, "ann@example.com");
    const g = game("lobby:AGAIN:1", 12);
    const first = await grantXp(sql, a.id, g);
    const again = [await grantXp(sql, a.id, g), ...(await Promise.all([grantXp(sql, a.id, g), grantXp(sql, a.id, g), grantXp(sql, a.id, g)]))];
    for (const x of again) expect(x!.coins!.boost).toMatchObject({ coins: 33, minutes: 12 });
    expect(first!.coins!.boost).toEqual({ coins: 33, minutes: 12, left: 108 });
    expect((await wallet(sql, a.id))!.boost_minutes).toBe(108);
    expect(await sql.first("SELECT COUNT(*) AS n FROM ledger WHERE reason = ?", BOOST)).toEqual({ n: 2 });
    expect(await ledgerMismatches(sql, a.id)).toEqual([]);
  });

  it("games at once share the minutes: never more used than there are (10 left, three 12-minute games)", async () => {
    const { sql } = await world();
    const a = await boosted(sql, "ann@example.com");
    for (let i = 0; i < 3; i++) await grantXp(sql, a.id, game(`lobby:PRE0${i}:1`, 30));
    await grantXp(sql, a.id, game("lobby:PRE03:1", 20));
    expect((await wallet(sql, a.id))!.boost_minutes).toBe(10);
    const xs = await Promise.all([1, 2, 3].map((i) => grantXp(sql, a.id, game(`lobby:RACE${i}:1`, 12))));
    const used = xs.reduce((n, x) => n + (x!.coins!.boost?.minutes ?? 0), 0);
    expect(used).toBe(10);
    expect((await wallet(sql, a.id))!.boost_minutes).toBe(0);
    expect(await ledgerMismatches(sql, a.id)).toEqual([]);
  });

  it("rewards paused: no coins, no boost, the minutes stay", async () => {
    const { sql } = await world();
    const a = await boosted(sql, "ann@example.com");
    expect((await grantXp(sql, a.id, game("lobby:PAUSE:1", 30, { paused: true })))!.none).toBe("paused");
    expect((await wallet(sql, a.id))!.boost_minutes).toBe(120);
  });
});

describe("the Crate Bonus", () => {
  it("the next 5 paying level-ups give their crates twice (keys stay 1); the 6th is plain; the card says so; a replay pays once", async () => {
    const { sql } = await world();
    const a = await signedIn(sql, "ann@example.com");
    await grantTestItems(sql, a.id, { crateBonus: 1 }, T0);
    expect((await wallet(sql, a.id))!.crate_bonus).toBe(5);
    // (Level 2 at 500 XP: a 12-minute game from 400 reaches it.)
    await setTestXp(sql, a.id, 400, T0);
    const g = game("lobby:LEVEL:2", 12);
    const x = await grantXp(sql, a.id, g);
    expect(x!.rewards).toMatchObject({ crates: 2, keys: 1, doubled: 1, levels: [2] });
    expect(rewardLines(x!.rewards!, "Winter Crate · Series 1").level).toBe("+2 Winter Crates (Crate bonus) · +1 crate key");
    expect((await grantXp(sql, a.id, g))!.rewards).toEqual(x!.rewards);
    expect(await winter(sql, a.id)).toBe(2);
    expect(await wallet(sql, a.id)).toMatchObject({ crate_bonus: 4, crate_keys: 1 });
    // (Level 3 pays nothing (every 2nd level does): the bonus isn't used.)
    await setTestXp(sql, a.id, 900, T0);
    expect((await grantXp(sql, a.id, game("lobby:LEVEL:3", 12)))!.rewards).toBeUndefined();
    expect((await wallet(sql, a.id))!.crate_bonus).toBe(4);
    // (Levels 4 to 12 in one game: 4, 6, 8 and 10 doubled, 12 plain.)
    await setTestXp(sql, a.id, 5490, T0);
    const many = await grantXp(sql, a.id, game("lobby:LEVEL:12", 12));
    expect(many!.rewards).toMatchObject({ crates: 9, keys: 5, doubled: 4, levels: [4, 6, 8, 10, 12] });
    expect(await winter(sql, a.id)).toBe(11);
    expect(await wallet(sql, a.id)).toMatchObject({ crate_bonus: 0, crate_keys: 6 });
    // (Another Crate Bonus adds 5 more.)
    await grantTestItems(sql, a.id, { crateBonus: 1 }, T0);
    expect((await wallet(sql, a.id))!.crate_bonus).toBe(5);
    expect(await ledgerMismatches(sql, a.id)).toEqual([]);
  });
});

describe("the account's data", () => {
  it("a guest's boost joins the account it signs in to; the download has the counts; deleting closes them in the ledger", async () => {
    const { sql } = await world();
    const owner = await boosted(sql, "owner@example.com");
    const guest = (await createGuest(sql, T0, "Guest")).user;
    await grantTestItems(sql, guest.id, { boost: 1, crateBonus: 1 }, T0);
    await signInWithIdentity(sql, guest, "email", "owner@example.com", {}, T0 + 1);
    expect(await wallet(sql, owner.id)).toMatchObject({ boost_crates: 1, boost_minutes: 120, crate_bonus: 5 });
    expect(await ledgerMismatches(sql, owner.id)).toEqual([]);
    const d = (await accountDownload(sql, owner, T0 + 2)) as unknown as { shop: { wallet: Record<string, number> } };
    expect(d.shop.wallet).toMatchObject({ boost_crates: 1, boost_minutes: 120, crate_bonus: 5 });
    await deleteAccount(sql, owner, T0 + 3);
    expect(await sql.all("SELECT asset_kind, delta FROM ledger WHERE reason = 'erase' AND asset_kind IN ('boost_crate', 'boost_min', 'crate_bonus') ORDER BY asset_kind")).toEqual([
      { asset_kind: "boost_crate", delta: -1 },
      { asset_kind: "boost_min", delta: -120 },
      { asset_kind: "crate_bonus", delta: -5 },
    ]);
  });
});
