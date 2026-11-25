import { describe, expect, it, vi } from "vitest";
import { MATCH_SAVE, PLAY_COINS, XP, modeSettings, xpDayStart } from "@chessroyale/core";
import { createGuest, ensureSchema, grantReward, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { setCase } from "../src/fairplay.ts";
import { applyOp, leg, ledgerAccount, ledgerMismatches, opKeys } from "../src/ledger.ts";
import { PLAY, PLAY_BONUS, coinDayOf, oldCoins } from "../src/play-coins.ts";
import type { SquadsReward } from "../src/squads-lobby.ts";
import { gameXpOf, grantXp, xpOf, type XpGame } from "../src/xp.ts";
import { setup as lobbySetup } from "./lobby-fixture.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: the match rooms import it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));
const { writeReward, writeRewardQueue } = await import("../src/squads-do.ts");

/**
 * Play coins on the server (Nov 25; server/play-coins.ts, paid by xp.ts grantXp; core's play-coins.ts has the rules): a game pays
 * once (replays, races, retries), in the same batch as its XP; the XP day's totals are the ledger's own and roll at the XP day's
 * start; the day's 300 and the bonus steps hold when games land at once; nothing for a player fair play holds; the friends' lobby
 * win rule holds the win's bonus back with its XP; the 50 v 50 scoreboard's top places. And the review's fixes (Nov 25): a failed D1
 * call never costs a Squads reward its coins (M1; ranked's: duel-do.test.ts), a squad on its own devices' word pays as solo (m2), a
 * game the old code paid never pays twice (m3), a Squads member who resigned late pays play coins only. The delta review's (Nov 25): a
 * game pays at most one daily reward, granted again on the next XP day too (N1); a Squads queue's rewards share one window (N2); the
 * ranked old-key guard searches the primary key (N3).
 */
const T0 = Date.UTC(2026, 10, 25, 12, 0);
const MIN = 60_000;

async function world() {
  const { sql, db } = memoryDb();
  await ensureSchema(sql);
  return { sql, db };
}
const signedIn = async (sql: Sql, email: string) => signInWithIdentity(sql, (await createGuest(sql, T0, "Player")).user, "email", email, {}, T0);
/** A counted online game of `minutes` (12 moves: short of the daily reward's 15, so no crates muddle the wallet). */
const game = (key: string, minutes: number, over: Partial<XpGame> = {}, facts: Partial<XpGame["facts"]> = {}): XpGame => ({
  key,
  facts: { ms: minutes * MIN, moves: 12, won: false, ...facts },
  signedInOnly: true,
  now: T0,
  ...over,
});
const coinsOf = async (sql: Sql, id: string) => (await sql.first<{ coins: number }>("SELECT coins FROM wallets WHERE user_id = ?", id))?.coins ?? 0;

describe("play coins, paid with a game's XP", () => {
  it("a game pays once: a replay and three at once answer the same and pay nothing more; its ops are keyed by the game", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const g = game("lobby:ABCDE:1", 15, {}, { won: true });
    const first = await grantXp(sql, ann.id, g);
    expect(first!.coins).toEqual({ play: 27, bonus: 15, parts: [{ label: "Win", coins: 15 }], step: 0, today: { play: 27, bonus: 15 } });
    const again = [await grantXp(sql, ann.id, g), ...(await Promise.all([grantXp(sql, ann.id, g), grantXp(sql, ann.id, g), grantXp(sql, ann.id, g)]))];
    for (const x of again) expect(x!.coins).toMatchObject({ play: 27, bonus: 15, today: { play: 27, bonus: 15 } });
    expect(await coinsOf(sql, ann.id)).toBe(42);
    const acct = (await ledgerAccount(sql, ann.id))!.account;
    expect(await sql.all("SELECT op_id, reason, delta, source_id FROM ledger WHERE asset_kind = 'coins' ORDER BY op_id")).toEqual([
      { op_id: `coins:lobby:ABCDE:1:${acct}`, reason: PLAY, delta: 27, source_id: "lobby:ABCDE:1" },
      { op_id: `coinsbonus:lobby:ABCDE:1:${acct}`, reason: PLAY_BONUS, delta: 15, source_id: "lobby:ABCDE:1" },
    ]);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("the day's 300 play coins: a game past it pays what's left, then none; wins still pay their bonus; never more, games landing at once", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    // (Five 30-minute games: 54 each, 270; the sixth pays the 30 left; the seventh none, but its win's bonus.)
    for (let i = 0; i < 5; i++) expect((await grantXp(sql, ann.id, game(`g${i}`, 30)))!.coins!.play).toBe(54);
    expect((await grantXp(sql, ann.id, game("g5", 30)))!.coins).toMatchObject({ play: 30, today: { play: 300, bonus: 0 } });
    expect((await grantXp(sql, ann.id, game("g6", 30, {}, { won: true })))!.coins).toMatchObject({ play: 0, bonus: 15, today: { play: 300, bonus: 15 } });
    expect(await coinsOf(sql, ann.id)).toBe(315);
    // (Bo's eight games land at once: the guard reads the day in the same statement, and a refused one is worked out again.)
    const bo = await signedIn(sql, "bo@example.com");
    const all = await Promise.all(Array.from({ length: 8 }, (_, i) => grantXp(sql, bo.id, game(`b${i}`, 30))));
    expect(await coinsOf(sql, bo.id)).toBe(PLAY_COINS.perDay);
    expect(all.reduce((n, x) => n + x!.coins!.play, 0)).toBe(PLAY_COINS.perDay);
    expect(await coinDayOf(sql, (await ledgerAccount(sql, bo.id))!.account, xpDayStart(T0))).toEqual({ play: 300, bonus: 0 });
    for (const u of [ann, bo]) expect(await ledgerMismatches(sql, u.id)).toEqual([]);
  });

  it("the bonus steps across a day: wins pay 15 to 150, then 8, then 4, then none; 600 a day at most, wins landing at once too", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const bonuses: number[] = [];
    for (let i = 0; i < 70; i++) bonuses.push((await grantXp(sql, ann.id, game(`w${i}`, 30, {}, { won: true })))!.coins!.bonus);
    expect(bonuses.slice(0, 10)).toEqual(Array(10).fill(15));
    expect(bonuses[10]).toBe(8);
    expect(bonuses.filter((b) => b === 4).length).toBeGreaterThan(5);
    expect(bonuses.at(-1)).toBe(0);
    expect(bonuses.reduce((a, b) => a + b, 0)).toBe(300);
    expect(await coinsOf(sql, ann.id)).toBe(600);
    // (At once, mid-day: Bo's 12 wins in a row (166 bonus), then 50 more landing together. Each refused share is worked out again (four
    // strict tries, then one held to the day's ceiling only): the day never passes 300 and 300; in a burst of many games of one account
    // at once, some may be paid at an earlier step and the last ones may get nothing (the review's m1), so only the cap is checked.)
    const bo = await signedIn(sql, "bo@example.com");
    const boAcct = (await ledgerAccount(sql, bo.id))!.account;
    for (let i = 0; i < 12; i++) await grantXp(sql, bo.id, game(`u${i}`, 5, {}, { won: true }));
    expect((await coinDayOf(sql, boAcct, xpDayStart(T0))).bonus).toBe(166);
    const burst = await Promise.all(Array.from({ length: 50 }, (_, i) => grantXp(sql, bo.id, game(`v${i}`, 5, {}, { won: true }))));
    const day = await coinDayOf(sql, boAcct, xpDayStart(T0));
    expect(day.bonus).toBeLessThanOrEqual(300);
    expect(day.play).toBeLessThanOrEqual(300);
    for (const x of burst) expect(x!.coins!.bonus).toBeLessThanOrEqual(PLAY_COINS.bonus.win);
    expect(await coinsOf(sql, bo.id)).toBe(day.play + day.bonus);
    expect(await ledgerMismatches(sql, bo.id)).toEqual([]);
  });

  it("the day's totals roll at the XP day's start (XP.dayStartUtcHour), not at midnight UTC; a late retry of yesterday's game counts in yesterday", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const start = xpDayStart(T0);
    for (let i = 0; i < 6; i++) await grantXp(sql, ann.id, game(`d${i}`, 30, { now: start + 60 * MIN + i }));
    // (The last minute of the XP day: full.)
    expect((await grantXp(sql, ann.id, game("late", 30, { now: start + 86_400_000 - 1 })))!.coins!.play).toBe(0);
    // (Its first minute: a new day.)
    const next = await grantXp(sql, ann.id, game("next", 30, { now: start + 86_400_000 }));
    expect(next!.coins).toMatchObject({ play: 54, today: { play: 54, bonus: 0 } });
    expect(new Date(start + 86_400_000).getUTCHours()).toBe(XP.dayStartUtcHour);
    // (A game of yesterday's written now (a room's retry, its `now` its own): yesterday's day, full: nothing; today's stays.)
    expect((await grantXp(sql, ann.id, game("retry", 30, { now: start + 2 * 60 * MIN })))!.coins).toMatchObject({ play: 0, today: { play: 300 } });
    expect(await coinDayOf(sql, (await ledgerAccount(sql, ann.id))!.account, start + 86_400_000)).toEqual({ play: 54, bonus: 0 });
  });

  it("nothing for a guest, a test game, a leaver or under 10 moves (XP's reasons), nor a player fair play holds (in review or banned); XP still decides its own", async () => {
    const { sql } = await world();
    const guest = (await createGuest(sql, T0, "Guest")).user;
    expect((await grantXp(sql, guest.id, game("a", 15)))!.coins).toMatchObject({ play: 0, bonus: 0, none: "guest" });
    const ann = await signedIn(sql, "ann@example.com");
    expect((await grantXp(sql, ann.id, game("b", 15, {}, { test: true })))!.coins).toMatchObject({ play: 0, none: "test" });
    expect((await grantXp(sql, ann.id, game("c", 15, {}, { abandoned: true, won: true })))!.coins).toMatchObject({ play: 0, bonus: 0, none: "left" });
    expect((await grantXp(sql, ann.id, game("d", 15, {}, { moves: 9 })))!.coins).toMatchObject({ play: 0, none: "short" });
    await setCase(sql, ann.id, "review", "reports", "test", T0);
    const held = await grantXp(sql, ann.id, game("e", 15, {}, { won: true }));
    expect(held!.coins).toMatchObject({ play: 0, bonus: 0, none: "held" });
    expect(held!.parts).toEqual([
      { label: "15 min", xp: 150 },
      { label: "Win", xp: XP.win },
    ]);
    await setCase(sql, ann.id, "banned", "admin:x", "test", T0);
    expect((await grantXp(sql, ann.id, game("f", 15)))!.coins).toMatchObject({ none: "banned" });
    expect(await coinsOf(sql, ann.id)).toBe(0);
    // (Rewards paused: no coins at all, as no XP.)
    const bo = await signedIn(sql, "bo@example.com");
    expect((await grantXp(sql, bo.id, game("g", 15, { paused: true })))!.coins).toBeUndefined();
    expect(await coinsOf(sql, bo.id)).toBe(0);
  });

  it("the bonus's facts: a ranked draw 5, a 50 v 50 top place 10, a Squads placement (never the win's 15 too); a friends' lobby pays the win's bonus once a day per opponent, with its XP", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const bo = await signedIn(sql, "bo@example.com");
    expect((await grantXp(sql, ann.id, game("duel:1", 15, { coin: { draw: true } })))!.coins).toMatchObject({ bonus: 5, parts: [{ label: "Draw", coins: 5 }] });
    expect((await grantXp(sql, ann.id, game("lobby:C:1", 15, { coin: { crowdTop: true } }, { won: true })))!.coins).toMatchObject({
      bonus: 25,
      parts: [
        { label: "Win", coins: 15 },
        { label: "Top 3", coins: 10 },
      ],
    });
    expect((await grantXp(sql, ann.id, game("squads:S:1", 15, { coin: { squads: 1 } }, { won: true })))!.coins).toMatchObject({ bonus: 40, parts: [{ label: "1st place", coins: 40 }] });
    // (A friends' lobby: Ann beats Bo, then beats him again the same XP day: the second win's XP and its bonus held back together.)
    const vs = { cap: { vs: [bo.id] } };
    expect((await grantXp(sql, ann.id, game("lobby:F:1", 15, vs, { won: true })))!.coins).toMatchObject({ bonus: 15 });
    const again = await grantXp(sql, ann.id, game("lobby:F:2", 15, vs, { won: true }));
    expect(again!.parts.find((p) => p.label.startsWith("Win"))).toEqual({ label: "Win (paid once today)", xp: 0 });
    expect(again!.coins).toMatchObject({ play: 27, bonus: 0, parts: [], step: null });
    // (Solo, and an online game on one device's word: no bonus.)
    expect((await grantXp(sql, ann.id, game("solo:1", 15, { cap: "solo" }, { won: true })))!.coins).toMatchObject({ play: 27, bonus: 0, parts: [] });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("the 50 v 50 scoreboard's top places: the first rows of your team's at the end (bots' seats count); only a 50 v 50 that's over", () => {
    const L = lobbySetup({ ...modeSettings("crowd", { augments: false }) });
    const rows = [
      { id: "w1", team: "w" },
      { id: "b1", team: "b" },
      { id: "w2", team: "w" },
      { id: "botw", team: "w" },
      { id: "b2", team: "b" },
      { id: "w4", team: "w" },
      { id: "b3", team: "b" },
      { id: "b4", team: "b" },
    ];
    (L.core as unknown as { runner: unknown }).runner = { leaderboard: () => rows, boss: null };
    expect(L.core.crowdTeamTop("w4")).toBe(false);
    L.core.record.phase = "results";
    expect(["w1", "w2", "w4", "b1", "b2", "b3", "b4"].filter((id) => L.core.crowdTeamTop(id))).toEqual(["w1", "w2", "b1", "b2", "b3"]);
    expect(L.core.crowdTeamTop("nobody")).toBe(false);
    // (A boss battle in the crowd: none.)
    (L.core as unknown as { runner: unknown }).runner = { leaderboard: () => rows, boss: {} };
    expect(L.core.crowdTeamTop("w1")).toBe(false);
    // (Classic: none.)
    const C = lobbySetup();
    (C.core as unknown as { runner: unknown }).runner = { leaderboard: () => rows, boss: null };
    C.core.record.phase = "results";
    expect(C.core.crowdTeamTop("w1")).toBe(false);
  });
});

describe("play coins, the review's fixes (Nov 25)", () => {
  /** A Squads reward of a 14-minute lobby, 12 moves: 1st place by default (25 play coins, 40 bonus: 65). */
  const reward = (userId: string, over: Partial<SquadsReward> = {}): SquadsReward => ({ playerId: "p1", userId, squadId: 0, placement: 1, coins: 0, crates: 0, recorded: true, moves: 12, playMs: 14 * MIN, ...over });
  /** A grant's batch (its XP and coin ops: keyed "xp:squads:…", "coins:squads:…" and so on). */
  const grantBatch = (st: readonly { params: unknown[] }[]) => st.some((x) => x.params.some((p) => typeof p === "string" && /^(xp|xpwin|coins|coinsbonus):squads:/.test(p)));
  const lost = () => Promise.reject(new Error("D1_ERROR: Network connection lost."));

  it("M1, Squads: one failed XP batch keeps the reward queued (when it first failed) and the next write pays 65 once; past MATCH_SAVE.strictMinutes it's written without its XP and coins", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    let fails = 1;
    const flaky: Sql = { ...sql, batch: (st) => (fails > 0 && grantBatch(st) ? (fails--, lost()) : sql.batch(st)) };
    const rec = { code: "SQUAD", createdAt: T0, rewardQueue: [reward(ann.id)] };
    const first = await writeRewardQueue(flaky, rec, true, false);
    expect(first).toMatchObject({ written: 0, refused: [] });
    expect(String(first.failure)).toContain("Network connection lost");
    expect(rec.rewardQueue).toHaveLength(1);
    expect(rec.rewardQueue[0]!.failedAt).toBeTypeOf("number");
    expect([await coinsOf(sql, ann.id), await xpOf(sql, ann.id)]).toEqual([0, 0]);
    expect(await writeRewardQueue(flaky, rec, true, false)).toEqual({ written: 1, refused: [], failure: null });
    expect(rec.rewardQueue).toEqual([]);
    // (Written again (a store that failed): nothing more.)
    await writeReward(sql, "SQUAD", T0, reward(ann.id), Date.now(), true);
    expect([await coinsOf(sql, ann.id), await xpOf(sql, ann.id)]).toEqual([65, 190]);
    expect((await gameXpOf(sql, ann.id, "SQUAD", T0))!.coins).toMatchObject({ play: 25, bonus: 40 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
    // (A reward whose grant still fails MATCH_SAVE.strictMinutes after its first failed write: written without them, logged.)
    const bo = await signedIn(sql, "bo@example.com");
    fails = 1;
    const late = { code: "SQUAB", createdAt: T0, rewardQueue: [reward(bo.id, { failedAt: Date.now() - (MATCH_SAVE.strictMinutes + 1) * MIN })] };
    expect(await writeRewardQueue(flaky, late, true, false)).toEqual({ written: 1, refused: [], failure: null });
    expect([await coinsOf(sql, bo.id), await xpOf(sql, bo.id)]).toEqual([0, 0]);
  });

  it("M1: settling the coins failing partway (a share refused by a race, its retry's write lost) throws, and the grant tried again pays once", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    // (The day's coins read once as if another game's bonus had landed (1): the batch's bonus op is refused, so it's worked out again
    // and written alone; that write is lost.)
    let race = true;
    let fails = 1;
    const racy: Sql = {
      ...sql,
      first: async (q, ...p) => {
        const row = await sql.first<Record<string, unknown>>(q, ...p);
        if (race && q.includes("AS bonus")) {
          race = false;
          return { ...row, bonus: 1 } as never;
        }
        return row as never;
      },
      // (The bonus op written alone: its own batch, whose first statement is its first leg.)
      batch: (st) => (fails > 0 && st[0]?.params[0] === `coinsbonus:squads:SQUAD:${T0}:${acct}` ? (fails--, lost()) : sql.batch(st)),
    };
    const acct = (await ledgerAccount(sql, ann.id))!.account;
    const rec = { code: "SQUAD", createdAt: T0, rewardQueue: [reward(ann.id)] };
    expect(String((await writeRewardQueue(racy, rec, true, false)).failure)).toContain("Network connection lost");
    expect([race, fails]).toEqual([false, 0]);
    // (The XP and the play coins went in with the batch; the bonus didn't.)
    expect([await coinsOf(sql, ann.id), await xpOf(sql, ann.id), rec.rewardQueue.length]).toEqual([25, 190, 1]);
    expect((await writeRewardQueue(racy, rec, true, false)).failure).toBeNull();
    expect([await coinsOf(sql, ann.id), await xpOf(sql, ann.id)]).toEqual([65, 190]);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("m2: a squad whose bots only its own party's devices moved (unvouched) pays its play coins by the solo rule, no placement bonus; XP as before", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const bo = await signedIn(sql, "bo@example.com");
    // (Ann's squad 0 rests on its own party's word; Bo's squad 1 doesn't.)
    const rec = { code: "SQUAD", createdAt: T0, unvouched: { 0: "one party in the lobby" }, rewardQueue: [reward(ann.id), reward(bo.id, { playerId: "p2", squadId: 1 })] };
    expect(await writeRewardQueue(sql, rec, true, false)).toEqual({ written: 2, refused: [], failure: null });
    expect((await gameXpOf(sql, ann.id, "SQUAD", T0))!.coins).toMatchObject({ play: 25, bonus: 0, parts: [], step: null });
    expect([await coinsOf(sql, ann.id), await xpOf(sql, ann.id)]).toEqual([25, 190]);
    expect([await coinsOf(sql, bo.id), await xpOf(sql, bo.id)]).toEqual([65, 190]);
  });

  it("a Squads member who resigned after 10 or more moves: play coins for their time, no placement bonus", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await writeReward(sql, "SQUAD", T0, reward(ann.id, { placement: 5, resigned: true }), T0 + MIN, true);
    const x = await gameXpOf(sql, ann.id, "SQUAD", T0);
    expect(x!.none).toBeUndefined();
    expect(x!.coins).toMatchObject({ play: 25, bonus: 0, parts: [], step: null });
    expect(await coinsOf(sql, ann.id)).toBe(25);
  });

  it("m3: a game the code before Nov 25 paid coins for (its ranked op, or its Squads reward's coins leg) pays none again; the other side, and its XP, as usual", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const bo = await signedIn(sql, "bo@example.com");
    // (Ranked: the old code's `ranked:<duel id>:w` paid Ann 30; the room's note of it was lost at a deploy, so the new code writes again.)
    const me = (await ledgerAccount(sql, ann.id))!;
    await applyOp(sql, me, { id: "ranked:G1:w", reason: "ranked", now: T0, legs: [leg.coins(ann.id, 30, "G1")] });
    const a = await grantXp(sql, ann.id, game("duel:G1", 15, {}, { won: true }));
    expect(a!.coins).toMatchObject({ play: 0, bonus: 0 });
    expect(a!.parts).toEqual([
      { label: "15 min", xp: 150 },
      { label: "Win", xp: XP.win },
    ]);
    expect(await coinsOf(sql, ann.id)).toBe(30);
    // (Bo, Black, had no old op of his own: paid as usual.)
    expect((await grantXp(sql, bo.id, game("duel:G1", 15)))!.coins).toMatchObject({ play: 27 });
    // (Squads: the old reward op paid 100 coins and a crate; written again, its XP goes in, no coins, no second crate.)
    const cy = await signedIn(sql, "cy@example.com");
    expect(await grantReward(sql, cy.id, 100, 1, opKeys.squadsReward("SQOLD", T0), T0)).toBe("applied");
    expect(await writeReward(sql, "SQOLD", T0, reward(cy.id, { coins: 100, crates: 1 }), T0 + MIN, true)).toBe("replay");
    expect([await coinsOf(sql, cy.id), await xpOf(sql, cy.id)]).toEqual([100, 190]);
    expect((await gameXpOf(sql, cy.id, "SQOLD", T0))!.coins).toMatchObject({ play: 0, bonus: 0 });
    for (const u of [ann, bo, cy]) expect(await ledgerMismatches(sql, u.id)).toEqual([]);
  });

  /** The daily reward ops in an account's ledger. */
  const dailies = async (sql: Sql, id: string) =>
    (await sql.first<{ n: number }>("SELECT COUNT(DISTINCT op_id) AS n FROM ledger WHERE account = ? AND reason = 'daily'", (await ledgerAccount(sql, id))!.account))!.n;

  it("N1: a game pays at most one daily reward: a ranked grant tried again after the XP day rolls over, and a Squads reward written again, pay it once; the next game that day pays the day's", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const bo = await signedIn(sql, "bo@example.com");
    const rollover = xpDayStart(T0) + 86_400_000;
    // (Ranked: White's grant went in 5 s before the rollover; the room's retry (Black's failed), 15 s after it, grants White again.)
    const ranked = (key: string, now: number) => grantXp(sql, ann.id, game(key, 15, { now }, { moves: 20 }));
    const first = await ranked("duel:G1", rollover - 5_000);
    expect(first!.parts.at(-1)).toEqual({ label: "Daily reward", xp: XP.dailyBonus });
    const again = await ranked("duel:G1", rollover + 15_000);
    // (The replay answers the reward the game paid, as a replay on the same day does.)
    expect([again!.parts, again!.rewards, again!.before]).toEqual([first!.parts, first!.rewards, first!.before]);
    expect([await dailies(sql, ann.id), await xpOf(sql, ann.id)]).toEqual([1, 150 + XP.dailyBonus]);
    // (The new day's reward is still there: her next game pays it.)
    expect((await ranked("duel:G2", rollover + MIN))!.parts.at(-1)).toEqual({ label: "Daily reward", xp: XP.dailyBonus });
    expect(await dailies(sql, ann.id)).toBe(2);
    // (Squads: a reward written before the rollover, written again after it, as when its row or crate op failed.)
    await writeReward(sql, "SQUAD", T0, reward(bo.id, { moves: 20 }), rollover - 5_000, true);
    await writeReward(sql, "SQUAD", T0, reward(bo.id, { moves: 20 }), rollover + 15_000, true);
    expect([await dailies(sql, bo.id), await xpOf(sql, bo.id)]).toEqual([1, 190 + XP.dailyBonus]);
    for (const u of [ann, bo]) expect(await ledgerMismatches(sql, u.id)).toEqual([]);
  });

  it("N2: a lasting grant fault in a Squads queue of 3: one failure starts every waiting reward's window, so all 3 go MATCH_SAVE.strictMinutes later, without XP or coins, each once", async () => {
    const { sql } = await world();
    const users = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com"), await signedIn(sql, "cy@example.com")];
    const broken: Sql = { ...sql, batch: (st) => (grantBatch(st) ? lost() : sql.batch(st)) };
    const rec = { code: "SQUAD", createdAt: T0, rewardQueue: users.map((u, i) => reward(u.id, { playerId: `p${i}`, squadId: i, placement: i + 1, crates: 1 })) };
    const at = T0 + 20 * MIN;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(at);
      expect((await writeRewardQueue(broken, rec, true, false)).written).toBe(0);
      expect(rec.rewardQueue.map((r) => r.failedAt)).toEqual([at, at, at]);
      // (The next wake past the window: every one written, not one a wake.)
      vi.setSystemTime(at + (MATCH_SAVE.strictMinutes + 1) * MIN);
      expect(await writeRewardQueue(broken, rec, true, false)).toEqual({ written: 3, refused: [], failure: null });
    } finally {
      vi.useRealTimers();
    }
    expect(rec.rewardQueue).toEqual([]);
    for (const u of users) {
      const rows = (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE user_id = ? AND lobby = 'SQUAD'", u.id))!.n;
      const crates = (await sql.first<{ n: number }>("SELECT n FROM series_crates WHERE user_id = ? AND crate = ?", u.id, XP.rewardCrate))?.n ?? 0;
      expect([rows, crates, await coinsOf(sql, u.id), await xpOf(sql, u.id)]).toEqual([1, 1, 0, 0]);
      expect(await ledgerMismatches(sql, u.id)).toEqual([]);
    }
  });

  it("N3: the ranked old-key guard searches the primary key (op id and leg), not the account's whole ledger", async () => {
    const { db } = await world();
    const g = oldCoins("duel:G1", "acct")!;
    const plan = (db.prepare(`EXPLAIN QUERY PLAN SELECT ${g.sql}`).all(...(g.params as never[])) as { detail: string }[]).map((r) => r.detail).join(" | ");
    expect(plan).toContain("(op_id=? AND leg=?)");
    expect(plan).not.toMatch(/ledger_reason|ledger_account/);
  });
});
