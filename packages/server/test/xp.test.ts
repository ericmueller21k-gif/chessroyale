import { describe, expect, it, vi } from "vitest";
import { XP, xpDayStart } from "@chessroyale/core";
import { createGuest, ensureSchema, profile, publicProfile, recordResult, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { ledgerAccount, ledgerMismatches } from "../src/ledger.ts";
import { endSoloGame, gameXpOf, grantXp, setTestXp, startSoloGame, xpOf, type XpGame } from "../src/xp.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: the match rooms import it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));

/**
 * XP (server/xp.ts; core's xp.ts has the rules): a game's XP decided from the server's facts and granted through the ledger once
 * (replays, races, two tabs), the win's caps (a friends' lobby once an XP day per set of opponents, solo XP.soloWinsPerDay a day),
 * no XP for a guest where sign-in is set up or a banned account, the XP kept on the result row for the result screen to ask for,
 * the solo clock, the test switch, and XP through a guest's merge, the download and deleting an account.
 */
const T0 = Date.UTC(2026, 10, 9, 12, 0);
const MIN = 60_000;

async function world() {
  const { sql, db } = memoryDb();
  await ensureSchema(sql);
  return { sql, db };
}
const signedIn = async (sql: Sql, email: string, now = T0) => signInWithIdentity(sql, (await createGuest(sql, now, "Player")).user, "email", email, {}, now);
const game = (key: string, over: Partial<XpGame> = {}, facts: Partial<XpGame["facts"]> = {}): XpGame => ({
  key,
  facts: { ms: 12 * MIN + 30_000, moves: 14, won: false, ...facts },
  signedInOnly: true,
  now: T0,
  ...over,
});

describe("granting a game's XP", () => {
  it("a counted game: 10 a whole minute plus the win, before and after with both levels, into the wallet through the ledger", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    expect(await setTestXp(sql, ann.id, 6_900, T0)).toBe(6_900);
    const x = await grantXp(sql, ann.id, game("lobby:ABCDE:1", {}, { won: true }));
    expect(x).toEqual({
      before: 6_900,
      after: 7_070,
      levelBefore: 7,
      levelAfter: 8,
      parts: [
        { label: "12 min", xp: 120 },
        { label: "Win", xp: 50 },
      ],
    });
    expect(await xpOf(sql, ann.id)).toBe(7_070);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("once per game: a replay, and two at once, grant once and answer the same parts", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const first = await grantXp(sql, ann.id, game("lobby:ABCDE:1", {}, { won: true }));
    const again = await grantXp(sql, ann.id, game("lobby:ABCDE:1", {}, { won: true }));
    expect(first?.parts).toEqual(again?.parts);
    expect(again).toMatchObject({ before: 0, after: 170 });
    const both = await Promise.all([grantXp(sql, ann.id, game("squads:QWERT:5")), grantXp(sql, ann.id, game("squads:QWERT:5"))]);
    expect(both.map((b) => b?.parts)).toEqual([[{ label: "12 min", xp: 120 }], [{ label: "12 min", xp: 120 }]]);
    expect(await xpOf(sql, ann.id)).toBe(290);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("no XP, and why: too few moves, resigned early, left, a test game, a guest where sign-in is set up, banned", async () => {
    const { sql, db } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const none = async (g: XpGame, userId = ann.id) => (await grantXp(sql, userId, g))?.none;
    expect(await none(game("a", {}, { moves: 9, won: true }))).toBe("short");
    expect(await none(game("b", {}, { moves: 3, resigned: true }))).toBe("resigned");
    expect(await none(game("c", {}, { abandoned: true }))).toBe("left");
    expect(await none(game("d", {}, { test: true }))).toBe("test");
    const guest = (await createGuest(sql, T0, "Player")).user;
    expect(await none(game("e"), guest.id)).toBe("guest");
    // (Where sign-in isn't set up (local, the e2e server), a guest earns as anyone.)
    expect(await none(game("f", { signedInOnly: false }), guest.id)).toBeUndefined();
    db.prepare("INSERT INTO fairplay_cases (user_id, status, opened_at, updated_at) VALUES (?, 'banned', ?, ?)").run(ann.id, T0, T0);
    expect(await none(game("g"))).toBe("banned");
    expect(await xpOf(sql, ann.id)).toBe(0);
    expect(await xpOf(sql, guest.id)).toBe(120);
  });

  it("no such account (deleted mid-match): nothing, and nothing written", async () => {
    const { sql } = await world();
    expect(await grantXp(sql, "nobody", game("a"))).toBeNull();
  });

  it("minutes are capped at 30; under a minute is +0 with nothing written; a win alone still pays", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    expect((await grantXp(sql, ann.id, game("a", {}, { ms: 3 * 3_600_000 })))?.parts).toEqual([{ label: "30 min", xp: XP.maxMinutes * XP.perMinute }]);
    expect(await grantXp(sql, ann.id, game("b", {}, { ms: 40_000 }))).toEqual({ before: 300, after: 300, levelBefore: 1, levelAfter: 1, parts: [] });
    expect((await grantXp(sql, ann.id, game("c", {}, { ms: 40_000, won: true })))?.parts).toEqual([{ label: "Win", xp: 50 }]);
    expect(await xpOf(sql, ann.id)).toBe(350);
  });
});

describe("the win's caps", () => {
  it("a friends' lobby: once an XP day per opponent (any one already beaten today blocks it); others, or the next day, pay again", async () => {
    const { sql } = await world();
    const [ann, bo, cy] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com"), await signedIn(sql, "cy@example.com")];
    const win = (key: string, vs: string[], now = T0) => grantXp(sql, ann.id, game(key, { cap: { vs }, now }, { won: true }));
    expect((await win("lobby:AAAAA:1", [bo.id]))?.parts.at(-1)).toEqual({ label: "Win", xp: 50 });
    expect((await win("lobby:AAAAA:2", [bo.id]))?.parts.at(-1)).toEqual({ label: "Win (paid once today)", xp: 0 });
    // (The time still counts.)
    expect((await win("lobby:AAAAA:2", [bo.id]))?.parts[0]).toEqual({ label: "12 min", xp: 120 });
    expect((await win("lobby:AAAAA:3", [cy.id]))?.parts.at(-1)).toEqual({ label: "Win", xp: 50 });
    // (Review m4: a new set that shares anyone beaten today pays nothing more: with alts B and C, 2 wins a day, not 2^n − 1.)
    expect((await win("lobby:AAAAA:4", [cy.id, bo.id]))?.parts.at(-1)).toEqual({ label: "Win (paid once today)", xp: 0 });
    expect((await win("lobby:AAAAA:5", [bo.id, cy.id]))?.parts.at(-1)).toEqual({ label: "Win (paid once today)", xp: 0 });
    const dee = await signedIn(sql, "dee@example.com");
    expect((await win("lobby:AAAAA:9", [dee.id, bo.id]))?.parts.at(-1)).toEqual({ label: "Win (paid once today)", xp: 0 });
    // (Someone new, alone: pays; then a set with them in it doesn't.)
    expect((await win("lobby:AAAAA:10", [dee.id]))?.parts.at(-1)).toEqual({ label: "Win", xp: 50 });
    expect((await win("lobby:AAAAA:11", [cy.id, dee.id]))?.parts.at(-1)).toEqual({ label: "Win (paid once today)", xp: 0 });
    expect((await win("lobby:AAAAA:6", [bo.id], xpDayStart(T0) + 86_400_000))?.parts.at(-1)).toEqual({ label: "Win", xp: 50 });
    // (No other account against you, bots only: as a matchmade game.)
    expect((await win("lobby:AAAAA:7", []))?.parts.at(-1)).toEqual({ label: "Win", xp: 50 });
    // (Bo's own win over Ann is his.)
    expect((await grantXp(sql, bo.id, game("lobby:AAAAA:8", { cap: { vs: [ann.id] } }, { won: true })))?.parts.at(-1)).toEqual({ label: "Win", xp: 50 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("solo: XP.soloWinsPerDay wins an XP day, even at once; the time always", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const wins = await Promise.all(Array.from({ length: XP.soloWinsPerDay + 3 }, (_, i) => grantXp(sql, ann.id, game(`solo:${i}`, { cap: "solo" }, { won: true }))));
    expect(wins.filter((w) => w?.parts.some((p) => p.label === "Win" && p.xp === XP.win)).length).toBe(XP.soloWinsPerDay);
    expect(wins.every((w) => w?.parts[0]?.xp === 120)).toBe(true);
    expect(await xpOf(sql, ann.id)).toBe((XP.soloWinsPerDay + 3) * 120 + XP.soloWinsPerDay * XP.win);
  });
});

describe("the solo time cap (review M2): XP.soloMinutesPerDay minutes an XP day", () => {
  it("full games until the cap, then what's left (\"Daily solo limit\"), then none; the win still pays; the next day again; not online", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const limit = XP.soloMinutesPerDay * XP.perMinute;
    const solo = (key: string, minutes: number, won = false, now = T0) => grantXp(sql, ann.id, game(key, { cap: "solo", now }, { ms: minutes * MIN, won }));
    // (Four 30-minute games fill 120 minutes.)
    for (let i = 0; i < XP.soloMinutesPerDay / XP.maxMinutes - 1; i++) expect((await solo(`solo:a${i}`, 30))?.parts).toEqual([{ label: "30 min", xp: 300 }]);
    expect((await solo("solo:b", 20))?.parts).toEqual([{ label: "20 min", xp: 200 }]);
    expect((await solo("solo:c", 25))?.parts).toEqual([{ label: "25 min (Daily solo limit)", xp: limit - 1_100 }]);
    expect(await xpOf(sql, ann.id)).toBe(limit);
    // (Nothing left: the reason, not a box of +0s; with a win, the win alone.)
    expect(await solo("solo:d", 12)).toEqual({ before: limit, after: limit, levelBefore: 2, levelAfter: 2, parts: [], none: "limit" });
    expect((await solo("solo:e", 12, true))?.parts).toEqual([
      { label: "Daily solo limit", xp: 0 },
      { label: "Win", xp: XP.win },
    ]);
    // (Online games aren't capped by it.)
    expect((await grantXp(sql, ann.id, game("lobby:ABCDE:1")))?.parts).toEqual([{ label: "12 min", xp: 120 }]);
    // (The next XP day: again.)
    expect((await solo("solo:f", 12, false, xpDayStart(T0) + 86_400_000))?.parts).toEqual([{ label: "12 min", xp: 120 }]);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("at once: results arriving together never pass the cap (the guard is in the same statement)", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const all = await Promise.all(Array.from({ length: 8 }, (_, i) => grantXp(sql, ann.id, game(`solo:${i}`, { cap: "solo" }, { ms: 30 * MIN }))));
    expect(await xpOf(sql, ann.id)).toBeLessThanOrEqual(XP.soloMinutesPerDay * XP.perMinute);
    expect(all.reduce((n, g) => n + (g?.after ?? 0) - (g?.before ?? 0), 0)).toBe(await xpOf(sql, ann.id));
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });
});

describe("where the XP is kept", () => {
  it("on the result row, for the result screen to ask by its lobby code (not someone else's, not a stale one)", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const bo = await signedIn(sql, "bo@example.com");
    expect(await gameXpOf(sql, ann.id, "ABCDE", T0)).toBeNull();
    const xp = await grantXp(sql, ann.id, game("lobby:ABCDE:1", {}, { won: true }));
    await recordResult(sql, ann.id, { mode: "crowd", online: true, placement: 1, players: 100, lobby: "ABCDE", playMs: 12 * MIN, moves: 14, xp }, T0);
    expect(await gameXpOf(sql, ann.id, "ABCDE", T0 + 5_000)).toEqual(xp);
    expect(await gameXpOf(sql, bo.id, "ABCDE", T0)).toBeNull();
    expect(await gameXpOf(sql, ann.id, "ABCDE", T0 + 3 * 3_600_000)).toBeNull();
    expect(await gameXpOf(sql, ann.id, "nope", T0)).toBeNull();
    const none = await grantXp(sql, ann.id, game("lobby:FGHJK:1", {}, { abandoned: true }));
    await recordResult(sql, ann.id, { mode: "crowd", online: true, placement: 9, players: 100, lobby: "FGHJK", xp: none }, T0);
    expect(await gameXpOf(sql, ann.id, "FGHJK", T0)).toEqual({ before: 170, after: 170, levelBefore: 1, levelAfter: 1, parts: [], none: "left" });
  });

  it("the solo clock: the server's time between start and result, once; a new start replaces the last; the test switch's minutes", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const a = await startSoloGame(sql, ann.id, T0);
    expect(await endSoloGame(sql, ann.id, a, T0 + 7 * MIN)).toEqual({ id: a, ms: 7 * MIN, testMinutes: null });
    expect(await endSoloGame(sql, ann.id, a, T0 + 8 * MIN)).toBeNull();
    const b = await startSoloGame(sql, ann.id, T0);
    const c = await startSoloGame(sql, ann.id, T0 + MIN, 12);
    expect(await endSoloGame(sql, ann.id, b, T0 + 9 * MIN)).toBeNull();
    expect(await endSoloGame(sql, ann.id, c, T0 + 2 * MIN)).toEqual({ id: c, ms: MIN, testMinutes: 12 });
    expect(await endSoloGame(sql, ann.id, "x", T0)).toBeNull();
  });

  it("profiles: your XP on your own, the level on the public one", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await setTestXp(sql, ann.id, 6_750, T0);
    expect((await profile(sql, ann)).xp).toBe(6_750);
    expect((await publicProfile(sql, ann.id, T0))?.level).toBe(7);
    // (The test switch sets it, down too; never below 0 or past XP.testMax.)
    expect(await setTestXp(sql, ann.id, 10, T0)).toBe(10);
    expect(await setTestXp(sql, ann.id, -1, T0)).toBeNull();
    expect(await setTestXp(sql, ann.id, XP.testMax + 1, T0)).toBeNull();
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("a guest's XP (from before sign-in was set up) joins the account it signs in to; the ledger agrees", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await grantXp(sql, ann.id, game("a"));
    const guest = (await createGuest(sql, T0, "Player")).user;
    await grantXp(sql, guest.id, game("b", { signedInOnly: false }));
    const back = await signInWithIdentity(sql, guest, "email", "ann@example.com", {}, T0);
    expect(back.id).toBe(ann.id);
    expect(await xpOf(sql, ann.id)).toBe(240);
    expect(await xpOf(sql, guest.id)).toBe(0);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("download my data has the XP, each game's XP and an open solo game; deleting removes them and closes the balance", async () => {
    const { sql, db } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const xp = await grantXp(sql, ann.id, game("lobby:ABCDE:1", {}, { won: true }));
    await recordResult(sql, ann.id, { mode: "crowd", online: true, placement: 1, players: 100, lobby: "ABCDE", playMs: 12 * MIN, moves: 14, xp }, T0);
    await startSoloGame(sql, ann.id, T0);
    const d = (await accountDownload(sql, ann, T0)) as { shop: { wallet: { xp: number } }; results: Record<string, unknown>[]; xp: { soloGame: unknown } };
    expect(d.shop.wallet.xp).toBe(170);
    expect(d.results[0]).toMatchObject({ play_ms: 12 * MIN, moves: 14, xp_before: 0, xp_none: null });
    expect(JSON.parse(d.results[0]!.xp_parts as string)).toEqual(xp!.parts);
    expect(d.xp.soloGame).toBeTruthy();
    const account = (await ledgerAccount(sql, ann.id))!.account;
    await deleteAccount(sql, ann, T0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM solo_games").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM wallets WHERE user_id = ?").get(ann.id)).toEqual({ n: 0 });
    expect(db.prepare("SELECT SUM(delta) AS n FROM ledger WHERE account = ? AND asset_kind = 'xp'").get(account)).toEqual({ n: 0 });
  });
});

describe("each match room's XP", () => {
  it("lobby-do (Classic, Crowd, 50 v 50, raids, friends' lobbies): the room's facts, a win by mode, the test switches, the friends' cap", async () => {
    const { newLobbyRecord } = await import("../src/lobby.ts");
    const { lobbyXpGame } = await import("../src/lobby-do.ts");
    const rec = newLobbyRecord("ABCDE", T0);
    rec.startedAt = T0 + 5_000;
    rec.accounts = { p1: "ua", p2: "ub", p3: "uc" };
    rec.humans = [{ id: "p1", name: "Ann", token: "t", connected: true, device: "phone" }];
    const span = { moves: 12, ms: 9 * MIN };
    const x = (over: Partial<Parameters<typeof lobbyXpGame>[1]> = {}, mode = "crowd", opponents = ["p2", "b7"]) =>
      lobbyXpGame(rec, { playerId: "p1", placement: 3, teamWon: true, ...over }, "ua", span, mode, opponents, true, T0);
    expect(x()).toEqual({ key: `lobby:ABCDE:${T0 + 5_000}`, facts: { ms: 9 * MIN, moves: 12, won: true, resigned: false, abandoned: false, test: false }, cap: { vs: ["ub"] }, signedInOnly: true, now: T0 });
    // (Classic: a win is 1st; a raid: the crowd's, as its team.)
    expect(x({ placement: 1, teamWon: null }, "classic").facts.won).toBe(true);
    expect(x({ placement: 2, teamWon: null }, "classic").facts.won).toBe(false);
    expect(x({ teamWon: true }, "boss", []).cap).toEqual({ vs: [] });
    expect(x({ abandoned: true }).facts.abandoned).toBe(true);
    // (Matchmade: strangers, no cap.)
    rec.auto = { fillAt: null };
    expect(x().cap).toBeNull();
    // (A lobby a test switch made, or practice: a test game; ?xpgame=MINUTES counts it, that long, with enough moves.)
    rec.overrides = { tested: true };
    expect(x().facts.test).toBe(true);
    rec.overrides = { tested: true, xpGame: 12 };
    expect(x().facts).toMatchObject({ ms: 12 * MIN, moves: 12, test: false });
    rec.overrides = {};
    rec.humans[0]!.practice = true;
    expect(x().facts.test).toBe(true);
    rec.humans[0]!.practice = false;
    rec.left = [{ id: "p1", name: "Ann", token: "t", how: "resigned", at: T0, result: null }];
    expect(x().facts.resigned).toBe(true);
  });

  it("squads-do: XP with the result row, once, whatever the retries; a test lobby's (not recorded) none", async () => {
    const { writeReward } = await import("../src/squads-do.ts");
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const reward = { playerId: "p1", userId: ann.id, squadId: 0, placement: 1 as const, coins: 0, crates: 0, recorded: true, moves: 12, playMs: 14 * MIN };
    await writeReward(sql, "SQUAD", T0, reward, T0 + MIN, true);
    await writeReward(sql, "SQUAD", T0, reward, T0 + 2 * MIN, true);
    expect(await xpOf(sql, ann.id)).toBe(190);
    expect(await gameXpOf(sql, ann.id, "SQUAD", T0 + 3 * MIN)).toEqual({ before: 0, after: 190, levelBefore: 1, levelAfter: 1, parts: [{ label: "14 min", xp: 140 }, { label: "Win", xp: 50 }] });
    const bo = await signedIn(sql, "bo@example.com");
    await writeReward(sql, "SQUAB", T0, { ...reward, userId: bo.id, recorded: false }, T0, true);
    expect(await xpOf(sql, bo.id)).toBe(0);
    await writeReward(sql, "SQUAC", T0, { ...reward, userId: bo.id, placement: 5 as const, resigned: true, moves: 4 }, T0, true);
    expect(await gameXpOf(sql, bo.id, "SQUAC", T0)).toMatchObject({ none: "resigned" });
    await writeReward(sql, "SQUAD", T0, { ...reward, userId: bo.id, abandoned: true }, T0, true);
    expect(await gameXpOf(sql, bo.id, "SQUAD", T0)).toMatchObject({ none: "left" });
  });
});
