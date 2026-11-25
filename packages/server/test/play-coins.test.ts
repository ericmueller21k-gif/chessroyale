import { describe, expect, it, vi } from "vitest";
import { PLAY_COINS, XP, modeSettings, xpDayStart } from "@chessroyale/core";
import { createGuest, ensureSchema, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { setCase } from "../src/fairplay.ts";
import { ledgerAccount, ledgerMismatches } from "../src/ledger.ts";
import { PLAY, PLAY_BONUS, coinDayOf } from "../src/play-coins.ts";
import { grantXp, type XpGame } from "../src/xp.ts";
import { setup as lobbySetup } from "./lobby-fixture.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: the match rooms import it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));

/**
 * Play coins on the server (Nov 25; server/play-coins.ts, paid by xp.ts grantXp; core's play-coins.ts has the rules): a game pays
 * once (replays, races, retries), in the same batch as its XP; the XP day's totals are the ledger's own and roll at the XP day's
 * start; the day's 300 and the bonus steps hold when games land at once; nothing for a player fair play holds; the friends' lobby
 * win rule holds the win's bonus back with its XP; the 50 v 50 scoreboard's top places.
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
    // (At once: still 300 bonus at most, and the day's paid bonus on the steps' curve: each refused share worked out again.)
    const bo = await signedIn(sql, "bo@example.com");
    await Promise.all(Array.from({ length: 50 }, (_, i) => grantXp(sql, bo.id, game(`v${i}`, 5, {}, { won: true }))));
    const day = await coinDayOf(sql, (await ledgerAccount(sql, bo.id))!.account, xpDayStart(T0));
    expect(day.bonus).toBeLessThanOrEqual(300);
    expect(day.play).toBe(300);
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
