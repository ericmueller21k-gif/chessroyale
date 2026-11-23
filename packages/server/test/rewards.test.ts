import { describe, expect, it, vi } from "vitest";
import { XP, bossCrateOf, isPickableBossCrate, pickableBossCrates, xpDayStart } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, recordResult, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { handleAccountApi } from "../src/api.ts";
import { openBossCrate } from "../src/boss-tokens.ts";
import { applyOp, leg, ledgerAccount, ledgerMismatches } from "../src/ledger.ts";
import { lockerState, openCrate } from "../src/locker.ts";
import { NO_PICK, levelOwed, paidLevels, pickBossCrate } from "../src/rewards.ts";
import { gameXpOf, grantXp, setTestXp, xpOf, type XpGame } from "../src/xp.ts";
import { memoryDb, stockCrates } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: the match rooms import it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));

/**
 * XP phase 2 (Eric, Nov 9: "go with phase two"; server/rewards.ts, xp.ts; docs/decisions/2026-11-09-xp-phase2-*.md): the daily
 * reward once an XP day, every 2nd level's crates and key once (several at once too; levels of 500 since Nov 20, and the levels of
 * 1,000 paid before never paid again), every 20th level's boss crate picked once, a series
 * crate's open taking a key (refused without), the kill switch PAUSE_REWARDS, the old crates' turn into Winter Crates, and the new
 * rows through a guest's merge, the download and deleting the account.
 */
const T0 = Date.UTC(2026, 10, 9, 12, 0);
const MIN = 60_000;
const DAY = 86_400_000;

async function world() {
  const { sql, db, d1 } = memoryDb();
  await ensureSchema(sql);
  return { sql, db, d1 };
}
const signedIn = async (sql: Sql, email: string, now = T0) => signInWithIdentity(sql, (await createGuest(sql, now, "Player")).user, "email", email, {}, now);
/** A counted game: 12 minutes and `moves` of your own moves (the daily reward needs 15). */
const game = (key: string, moves = 20, over: Partial<XpGame> = {}): XpGame => ({ key, facts: { ms: 12 * MIN + 30_000, moves, won: false }, signedInOnly: true, now: T0, ...over });
const holdings = (sql: Sql, id: string) => lockerState(sql, id).then((l) => ({ crates: l.seriesCrates, keys: l.keys, picks: l.bossPicks }));

describe("the daily reward: XP.dailyBonus XP and XP.dailyCrates Winter Crates for the XP day's first counted game of 15 moves", () => {
  it("once a day: a short game first doesn't take it, the 15-move game does, the next game today doesn't, tomorrow's does", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    // (14 moves: XP, no daily reward.)
    expect((await grantXp(sql, ann.id, game("lobby:AAAAA:1", 14)))?.parts).toEqual([{ label: "12 min", xp: 120 }]);
    const first = await grantXp(sql, ann.id, game("lobby:BBBBB:1"));
    expect(first?.parts).toEqual([
      { label: "12 min", xp: 120 },
      { label: "Daily reward", xp: XP.dailyBonus },
    ]);
    expect(first?.rewards).toEqual({ crate: "winter-1", daily: XP.dailyCrates, crates: 0, keys: 0, bossPicks: 0, levels: [] });
    expect(first).toMatchObject({ before: 120, after: 120 + 120 + XP.dailyBonus });
    // The next game today: its own XP only, no daily reward (its 560 XP reach level 2: that level's crate and key, Nov 20's levels).
    const second = await grantXp(sql, ann.id, game("lobby:CCCCC:1", 20, { now: T0 + 60 * MIN }));
    expect([second?.parts, second?.rewards]).toEqual([[{ label: "12 min", xp: 120 }], { crate: "winter-1", daily: 0, crates: XP.levelCrates, keys: XP.levelKeys, bossPicks: 0, levels: [2] }]);
    // A replay of the paying game: the same parts and rewards, nothing more.
    const again = await grantXp(sql, ann.id, game("lobby:BBBBB:1"));
    expect([again?.parts, again?.rewards]).toEqual([first?.parts, first?.rewards]);
    expect(await holdings(sql, ann.id)).toEqual({ crates: { "winter-1": 1 + XP.levelCrates }, keys: XP.levelKeys, picks: 0 });
    // The next XP day (08:00 UTC): again.
    const tomorrow = await grantXp(sql, ann.id, game("lobby:DDDDD:1", 20, { now: xpDayStart(T0) + DAY }));
    expect(tomorrow?.parts.at(-1)).toEqual({ label: "Daily reward", xp: XP.dailyBonus });
    expect((await holdings(sql, ann.id)).crates).toEqual({ "winter-1": 2 + XP.levelCrates });
    expect(await xpOf(sql, ann.id)).toBe(120 * 4 + 2 * XP.dailyBonus);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("two games at once (two rooms): the day's reward is paid once, to one of them", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const both = await Promise.all(["lobby:AAAAA:1", "squads:BBBBB:1", "duel:CCCCC"].map((k) => grantXp(sql, ann.id, game(k))));
    expect(both.filter((g) => g?.parts.some((p) => p.label === "Daily reward")).length).toBe(1);
    expect(both.filter((g) => g?.rewards?.daily).length).toBe(1);
    // (Their 560 XP reach level 2: its crate and key, once.)
    expect(await holdings(sql, ann.id)).toEqual({ crates: { "winter-1": 1 + XP.levelCrates }, keys: XP.levelKeys, picks: 0 });
    expect(await xpOf(sql, ann.id)).toBe(3 * 120 + XP.dailyBonus);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("solo: also XP.dailySoloMinMinutes of the server's own time; a game with no XP (a test, left, a guest) never pays it", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const quick = await grantXp(sql, ann.id, { ...game("solo:a"), cap: "solo", facts: { ms: 2 * MIN, moves: 40, won: false } });
    expect(quick?.rewards).toBeUndefined();
    expect((await grantXp(sql, ann.id, { ...game("lobby:AAAAA:1"), facts: { ms: 20 * MIN, moves: 40, won: false, test: true } }))?.none).toBe("test");
    expect((await grantXp(sql, ann.id, { ...game("lobby:BBBBB:1"), facts: { ms: 20 * MIN, moves: 40, won: false, abandoned: true } }))?.none).toBe("left");
    const guest = (await createGuest(sql, T0, "Guest")).user;
    expect((await grantXp(sql, guest.id, game("lobby:CCCCC:1")))?.none).toBe("guest");
    expect((await holdings(sql, guest.id)).crates).toEqual({});
    const timed = await grantXp(sql, ann.id, { ...game("solo:b"), cap: "solo", facts: { ms: XP.dailySoloMinMinutes * MIN, moves: 40, won: false } });
    expect(timed?.rewards?.daily).toBe(XP.dailyCrates);
  });

  it("kept on the result row: the result screen's GET /api/xp answers the parts and the rewards", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const xp = await grantXp(sql, ann.id, game("lobby:QWERT:1"));
    await recordResult(sql, ann.id, { mode: "crowd", online: true, placement: 1, players: 100, lobby: "QWERT", xp }, T0 + 1);
    expect(await gameXpOf(sql, ann.id, "QWERT", T0 + 2)).toEqual(xp);
  });
});

describe("level rewards: XP.levelCrates Winter Crates and XP.levelKeys keys every 2nd level; every 20th also a boss crate to pick", () => {
  it("a level-up pays its level once; a replay answers the same; the next game in the same level pays nothing; an odd level pays nothing", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    // (The levels below 2 were never reached: nothing owed.)
    await setTestXp(sql, ann.id, 450, T0);
    const up = await grantXp(sql, ann.id, game("lobby:AAAAA:1", 14));
    expect(up).toMatchObject({ levelBefore: 1, levelAfter: 2, rewards: { crates: XP.levelCrates, keys: XP.levelKeys, bossPicks: 0, levels: [2], daily: 0 } });
    expect((await grantXp(sql, ann.id, game("lobby:AAAAA:1", 14)))?.rewards).toEqual(up?.rewards);
    expect((await grantXp(sql, ann.id, game("lobby:BBBBB:1", 14)))?.rewards).toBeUndefined();
    expect(await holdings(sql, ann.id)).toEqual({ crates: { "winter-1": XP.levelCrates }, keys: XP.levelKeys, picks: 0 });
    // (Level 3: the level-up, no rewards (Nov 20: every 2nd level pays). Level 4: its crate and key.)
    await setTestXp(sql, ann.id, 950, T0);
    const three = await grantXp(sql, ann.id, game("lobby:CCCCC:1", 14));
    expect([three?.levelBefore, three?.levelAfter, three?.rewards]).toEqual([2, 3, undefined]);
    await setTestXp(sql, ann.id, 1_450, T0);
    expect(await grantXp(sql, ann.id, game("lobby:DDDDD:1", 14))).toMatchObject({ levelBefore: 3, levelAfter: 4, rewards: { crates: XP.levelCrates, keys: XP.levelKeys, levels: [4] } });
    expect(await holdings(sql, ann.id)).toEqual({ crates: { "winter-1": 2 * XP.levelCrates }, keys: 2 * XP.levelKeys, picks: 0 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("several levels at once (a test switch's jump, or levels from before): each paid once, the 20th's boss crate pick too", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await setTestXp(sql, ann.id, 9_850, T0);
    const g = await grantXp(sql, ann.id, game("lobby:AAAAA:1", 14));
    expect(g?.rewards).toEqual({ crate: "winter-1", daily: 0, crates: 10 * XP.levelCrates, keys: 10 * XP.levelKeys, bossPicks: 1, levels: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] });
    expect(await holdings(sql, ann.id)).toEqual({ crates: { "winter-1": 10 * XP.levelCrates }, keys: 10 * XP.levelKeys, picks: 1 });
    // Down and up again (the test switch): never paid twice.
    await setTestXp(sql, ann.id, 0, T0);
    await setTestXp(sql, ann.id, 9_850, T0);
    expect((await grantXp(sql, ann.id, game("lobby:BBBBB:1", 14)))?.rewards).toBeUndefined();
    expect((await holdings(sql, ann.id)).picks).toBe(1);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("at most XP.levelsPerGame levels a game, the rest at the next; two games at once pay each level once", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await setTestXp(sql, ann.id, 40_000, T0);
    const both = await Promise.all([grantXp(sql, ann.id, game("lobby:AAAAA:1", 14)), grantXp(sql, ann.id, game("lobby:BBBBB:1", 14))]);
    const paid = both.flatMap((g) => g?.rewards?.levels ?? []);
    expect(new Set(paid).size).toBe(paid.length);
    const next = await grantXp(sql, ann.id, game("lobby:CCCCC:1", 14));
    const all = [...paid, ...(next?.rewards?.levels ?? [])].sort((a, b) => a - b);
    // (40,120 XP: level 81. Every 2nd level from 2 to 80, the 20th, 40th, 60th and 80th with a pick: the same as levels of 1,000.)
    expect(all).toEqual(Array.from({ length: 40 }, (_, i) => 2 * (i + 1)));
    expect(both.every((g) => (g?.rewards?.levels.length ?? 0) <= XP.levelsPerGame)).toBe(true);
    expect(await holdings(sql, ann.id)).toEqual({ crates: { "winter-1": 40 * XP.levelCrates }, keys: 40 * XP.levelKeys, picks: 4 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("the daily reward's XP can be the level-up's: both in one game's rewards", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await setTestXp(sql, ann.id, 350, T0);
    const g = await grantXp(sql, ann.id, game("lobby:AAAAA:1"));
    expect(g).toMatchObject({ before: 350, after: 350 + 120 + XP.dailyBonus, levelAfter: 2 });
    expect(g?.rewards).toEqual({ crate: "winter-1", daily: XP.dailyCrates, crates: XP.levelCrates, keys: XP.levelKeys, bossPicks: 0, levels: [2] });
  });
});

describe("a level's boss crate: picked among the live bosses, once a pick", () => {
  it("refused without a pick; picked once per request (a retry, and twice at once); only a live boss's; then it opens as a boss crate", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const babur = bossCrateOf("tiger")!;
    expect(pickableBossCrates().map((c) => c.id)).toContain(babur.id);
    // (A boss in the game for admins first, Timber: not one to pick.)
    expect(isPickableBossCrate(bossCrateOf("timber")!.id)).toBe(false);
    expect(await pickBossCrate(sql, ann.id, babur.id, "pick-request-1", T0)).toEqual({ ok: false, message: NO_PICK });
    await setTestXp(sql, ann.id, 9_990, T0);
    await grantXp(sql, ann.id, game("lobby:AAAAA:1", 14));
    expect((await holdings(sql, ann.id)).picks).toBe(1);
    expect(await pickBossCrate(sql, ann.id, bossCrateOf("timber")!.id, "pick-request-2", T0)).toEqual({ ok: false, message: "No such crate." });
    const picks = await Promise.all([1, 2, 3].map(() => pickBossCrate(sql, ann.id, babur.id, "pick-request-3", T0)));
    expect(picks).toEqual([1, 2, 3].map(() => ({ ok: true, crate: babur.id })));
    const after = await lockerState(sql, ann.id);
    expect([after.bossPicks, after.bossCrates]).toEqual([0, { [babur.id]: 1 }]);
    expect(await pickBossCrate(sql, ann.id, babur.id, "pick-request-4", T0)).toEqual({ ok: false, message: NO_PICK });
    // Opened as any boss crate: no token, no key.
    const opened = await openBossCrate(sql, ann.id, babur.id, T0 + 1);
    expect(opened.ok && babur.items).toContain(opened.ok ? opened.item.def : "");
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("through the API: POST /api/locker/pick answers the crate and the locker", async () => {
    const { sql, d1 } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const cookie = `hc_session=${await createSession(sql, ann.id, Date.now())}`;
    const call = async (path: string, body: unknown) => {
      const res = (await handleAccountApi(new Request(`https://hunchess.com${path}`, { method: "POST", body: JSON.stringify(body), headers: { cookie } }), { DB: d1 } as never))!;
      return { status: res.status, body: (await res.json()) as Record<string, unknown> };
    };
    const folio = bossCrateOf("folio")!;
    expect(await call("/api/locker/pick", { crate: folio.id, request: "pick-request-1" })).toEqual({ status: 400, body: { message: NO_PICK } });
    const me = (await ledgerAccount(sql, ann.id))!;
    await applyOp(sql, me, { id: "test-pick", reason: "test", now: T0, legs: [leg.bossPicks(ann.id, 1)] });
    const r = await call("/api/locker/pick", { crate: folio.id, request: "pick-request-2" });
    expect([r.status, r.body.crate, (r.body.locker as { bossCrates: unknown }).bossCrates, (r.body.locker as { bossPicks: number }).bossPicks]).toEqual([200, folio.id, { [folio.id]: 1 }, 0]);
  });
});

describe("crates need keys (Nov 9: for everyone)", () => {
  it("an open takes the crate and a key, once; refused without either; two at once with one key open one", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    expect((await openCrate(sql, ann.id, "winter-1", {}, T0)).ok).toBe(false);
    // A crate and no key: refused, the crate stays.
    await setTestXp(sql, ann.id, 0, T0);
    await grantXp(sql, ann.id, game("lobby:AAAAA:1"));
    expect(await holdings(sql, ann.id)).toEqual({ crates: { "winter-1": 1 }, keys: 0, picks: 0 });
    expect(await openCrate(sql, ann.id, "winter-1", {}, T0)).toEqual({ ok: false, message: "You need a Winter Crate and a crate key to open it." });
    // A key and the wrong series: refused.
    await stockCrates(sql, ann.id, "beta-001", 0);
    const me = (await ledgerAccount(sql, ann.id))!;
    await applyOp(sql, me, { id: "test-key", reason: "test", now: T0, legs: [leg.keys(ann.id, 1)] });
    expect((await openCrate(sql, ann.id, "beta-001", {}, T0)).ok).toBe(false);
    // Both: two opens at once, one key: one item.
    const both = await Promise.all([openCrate(sql, ann.id, "winter-1", {}, T0, false, "open-request-1"), openCrate(sql, ann.id, "winter-1", {}, T0, false, "open-request-2")]);
    expect(both.filter((o) => o.ok).length).toBe(1);
    expect(await holdings(sql, ann.id)).toEqual({ crates: {}, keys: 0, picks: 0 });
    expect((await lockerState(sql, ann.id)).items).toHaveLength(1);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("old crates (the wallet's count, before Nov 9) become Winter Crates as the locker is read, once", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const me = (await ledgerAccount(sql, ann.id))!;
    await applyOp(sql, me, { id: "old-reward", reason: "reward", now: T0, legs: [leg.crates(ann.id, 3)] });
    const reads = await Promise.all([lockerState(sql, ann.id), lockerState(sql, ann.id)]);
    expect(reads.at(-1)?.seriesCrates).toEqual({ "winter-1": 3 });
    expect((await lockerState(sql, ann.id)).crates).toBe(3);
    expect((await sql.first<{ crates: number }>("SELECT crates FROM wallets WHERE user_id = ?", ann.id))?.crates).toBe(0);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });
});

describe("PAUSE_REWARDS (Nov 9): nothing granted while it's on; owed levels and the day's reward come after", () => {
  it("a paused game: \"paused\", no XP, no crate, no key; after it, the next game pays the day's reward and the levels", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await setTestXp(sql, ann.id, 490, T0);
    const paused = await grantXp(sql, ann.id, game("lobby:AAAAA:1", 20, { paused: true }));
    expect(paused).toEqual({ before: 490, after: 490, levelBefore: 1, levelAfter: 1, parts: [], none: "paused" });
    expect(await holdings(sql, ann.id)).toEqual({ crates: {}, keys: 0, picks: 0 });
    const on = await grantXp(sql, ann.id, game("lobby:BBBBB:1"));
    expect(on?.rewards).toEqual({ crate: "winter-1", daily: XP.dailyCrates, crates: XP.levelCrates, keys: XP.levelKeys, bossPicks: 0, levels: [2] });
  });

  it("through the API: a solo result while PAUSE_REWARDS is on answers \"paused\"", async () => {
    const { sql, d1 } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const cookie = `hc_session=${await createSession(sql, ann.id, Date.now())}`;
    const env = { DB: d1, PAUSE_REWARDS: "1" };
    const post = async (path: string, body: unknown) =>
      (await (await handleAccountApi(new Request(`https://hunchess.com${path}`, { method: "POST", body: JSON.stringify(body), headers: { cookie } }), env as never))!.json()) as Record<string, unknown>;
    const { game: id } = (await post("/api/xp/solo/start", {})) as { game: string };
    await sql.run("UPDATE solo_games SET started_at = started_at - ? WHERE user_id = ?", 20 * MIN, ann.id);
    const r = await post("/api/results", { placement: 1, players: 1, mode: "boss", game: id, moves: 30, won: true });
    expect((r.xp as { none: string }).none).toBe("paused");
    expect(await xpOf(sql, ann.id)).toBe(0);
  });
});

describe("level rewards through a guest's merge (the outside review of Nov 10)", () => {
  it("a guest's merge doesn't pay its levels again: the account is owed only levels neither was paid", async () => {
    const { sql } = await world();
    const owner = await signedIn(sql, "owner@example.com");
    const guest = (await createGuest(sql, T0, "Guest")).user;
    // (A guest earns where sign-in isn't set up: the local and e2e servers.) The guest reaches level 5: levels 2 and 4 paid to it.
    await setTestXp(sql, guest.id, 2_000, T0);
    expect((await grantXp(sql, guest.id, { ...game("lobby:AAAAA:1"), signedInOnly: false }))?.rewards?.levels).toEqual([2, 4]);
    // The account reaches level 2: level 2 paid to it.
    await setTestXp(sql, owner.id, 600, T0);
    expect((await grantXp(sql, owner.id, game("lobby:BBBBB:1")))?.rewards?.levels).toEqual([2]);
    const before = await holdings(sql, guest.id);
    const mine = await holdings(sql, owner.id);
    await signInWithIdentity(sql, guest, "email", "owner@example.com", {}, T0 + 1);
    // Together: 920 + 2,320 XP, level 7. Its next game pays level 6 only (before Nov 10: 4 and 6; level 4 the guest's again).
    expect(await xpOf(sql, owner.id)).toBe(3_240);
    const next = await grantXp(sql, owner.id, game("lobby:CCCCC:1", 20, { now: T0 + 60 * MIN }));
    expect(next?.rewards?.levels).toEqual([6]);
    const after = await holdings(sql, owner.id);
    expect(after.keys).toBe(mine.keys + before.keys + XP.levelKeys);
    expect(after.crates["winter-1"]).toBe((mine.crates["winter-1"] ?? 0) + (before.crates["winter-1"] ?? 0) + XP.levelCrates);
    // Nothing more at the game after.
    expect((await grantXp(sql, owner.id, game("lobby:DDDDD:1", 20, { now: T0 + 90 * MIN })))?.rewards?.levels ?? []).toEqual([]);
    expect(await ledgerMismatches(sql, owner.id)).toEqual([]);
  });
});

describe("levels of 500 (Nov 20): what the levels of 1,000 paid is never paid again (docs/decisions/2026-11-20-levels-500.md)", () => {
  /** An old level's op (levels of 1,000 XP, Nov 9 to Nov 20) as the ledger has it: a crate and a key, every 10th also a boss pick. */
  const oldLevels = async (sql: Sql, userId: string, levels: number[]) => {
    const me = (await ledgerAccount(sql, userId))!;
    for (const l of levels) {
      const legs = [leg.seriesCrates(userId, "winter-1", 1, "lobby:OLDGM:1"), leg.keys(userId, 1, "lobby:OLDGM:1"), ...(l % 10 === 0 ? [leg.bossPicks(userId, 1, "lobby:OLDGM:1")] : [])];
      expect(await applyOp(sql, me, { id: `level:${l}:${me.account}`, reason: "level", now: T0, legs })).toBe("applied");
    }
  };
  /** Every game's levels paid, and the holdings after, for games of +120 XP from each of these XPs (the test switch, then a game). */
  const climb = async (sql: Sql, userId: string, from: number[]) => {
    const paid: number[][] = [];
    for (const [i, xp] of from.entries()) {
      await setTestXp(sql, userId, xp, T0);
      paid.push((await grantXp(sql, userId, game(`lobby:CL${String(i).padStart(3, "0")}:1`, 14)))?.rewards?.levels ?? []);
    }
    return { paid, holdings: await holdings(sql, userId) };
  };

  it("the mapping: old level k is today's (k-1)th crate and key (level 2(k-1)); old 10's pick is today's 20th's; a lvl: op is its level", () => {
    const paid = paidLevels([
      { op_id: "level:2:x", pick: 0 },
      { op_id: "level:3:x", pick: 0 },
      { op_id: "level:10:x", pick: 1 },
      { op_id: "lvl:22:x", pick: 0 },
      { op_id: "nonsense", pick: 0 },
    ]);
    expect([[...paid.rewards], [...paid.picks], [...paid.done]]).toEqual([[2, 4, 18], [20], [22]]);
    // (Level 20: its crate and key still owed (old 10's crate was today's 18th level's), its pick paid; 22 done; 3 never pays.)
    expect([20, 22, 3, 6].map((l) => levelOwed(l, paid))).toEqual([
      { crates: XP.levelCrates, keys: XP.levelKeys, bossPicks: 0 },
      { crates: 0, keys: 0, bossPicks: 0 },
      { crates: 0, keys: 0, bossPicks: 0 },
      { crates: XP.levelCrates, keys: XP.levelKeys, bossPicks: 0 },
    ]);
  });

  it("a fresh account is paid on levels 2, 4, 6, … (the 20th's pick too), each once, nothing on the others", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    // (Up to 10,120 XP, 250 at a time: level 21.)
    const { paid, holdings: h } = await climb(sql, ann.id, Array.from({ length: 41 }, (_, i) => i * 250));
    expect(paid.flat()).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    expect(h).toEqual({ crates: { "winter-1": 10 * XP.levelCrates }, keys: 10 * XP.levelKeys, picks: 1 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("2,700 XP, paid levels 2 and 3 of 1,000 (now level 6): its next games pay level 6, then 8; never 2 or 4 again", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await oldLevels(sql, ann.id, [2, 3]);
    const { paid, holdings: h } = await climb(sql, ann.id, [2_700, 2_820, 3_450]);
    expect(paid).toEqual([[6], [], [8]]);
    // (4 crates and keys at 3,570 XP: as a fresh account's, levels 2, 4, 6 and 8.)
    expect(h).toEqual({ crates: { "winter-1": 4 }, keys: 4, picks: 0 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("old level 10 paid with its boss pick (9,200 XP, now level 19): level 20 pays its crate and key but no second pick; 40 pays a pick", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await oldLevels(sql, ann.id, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(await holdings(sql, ann.id)).toEqual({ crates: { "winter-1": 9 }, keys: 9, picks: 1 });
    const { paid, holdings: h } = await climb(sql, ann.id, [9_200, 9_450, 19_450]);
    expect(paid).toEqual([[], [20], [22, 24, 26, 28, 30, 32, 34, 36, 38, 40]]);
    // (Level 40: 20 crates and keys and 2 picks, as a fresh account's.)
    expect(h).toEqual({ crates: { "winter-1": 20 }, keys: 20, picks: 2 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("old levels past its XP now (the test switch down): nothing owed and no error; up again, only what's past them", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await oldLevels(sql, ann.id, [2, 3, 4, 5]);
    const { paid, holdings: h } = await climb(sql, ann.id, [1_000, 4_600]);
    // (Old 2 to 5 are today's 2, 4, 6 and 8: at level 10 (4,720 XP), only 10.)
    expect(paid).toEqual([[], [10]]);
    expect(h).toEqual({ crates: { "winter-1": 5 }, keys: 5, picks: 0 });
  });

  it("a guest's old levels, merged in, count as paid for the account", async () => {
    const { sql } = await world();
    const owner = await signedIn(sql, "owner@example.com");
    const guest = (await createGuest(sql, T0, "Guest")).user;
    await oldLevels(sql, guest.id, [2, 3]);
    await setTestXp(sql, guest.id, 2_000, T0);
    await setTestXp(sql, owner.id, 600, T0);
    await signInWithIdentity(sql, guest, "email", "owner@example.com", {}, T0 + 1);
    // (2,600 + 120 XP: level 6; the guest's old 2 and 3 are today's 2 and 4.)
    expect((await grantXp(sql, owner.id, game("lobby:AAAAA:1", 14)))?.rewards?.levels).toEqual([6]);
    expect(await ledgerMismatches(sql, owner.id)).toEqual([]);
  });
});

describe("the account's data: the new rows through a merge, the download and deleting", () => {
  it("a guest's series crates and boss picks join the account it signs in to; the download has them; deleting closes them", async () => {
    const { sql } = await world();
    const owner = await signedIn(sql, "owner@example.com");
    const guest = (await createGuest(sql, T0, "Guest")).user;
    // (A guest earns where sign-in isn't set up: the local and e2e servers.)
    await setTestXp(sql, guest.id, 9_990, T0);
    await grantXp(sql, guest.id, { ...game("lobby:AAAAA:1"), signedInOnly: false });
    const before = await holdings(sql, guest.id);
    expect(before.picks).toBe(1);
    const merged = await signInWithIdentity(sql, guest, "email", "owner@example.com", {}, T0 + 1);
    expect(merged.id).toBe(owner.id);
    expect(await holdings(sql, owner.id)).toEqual(before);
    expect(await ledgerMismatches(sql, owner.id)).toEqual([]);
    const d = (await accountDownload(sql, owner, T0 + 2)) as unknown as {
      xp: { seriesCrates: unknown[] };
      shop: { wallet: { boss_picks: number } };
      ledger: { changes: { reason: string; asset_kind: string }[] };
    };
    expect(d.xp.seriesCrates).toEqual([{ crate: "winter-1", n: before.crates["winter-1"] }]);
    expect(d.shop.wallet.boss_picks).toBe(1);
    // (The guest's own history stays under its dropped ledger id: the account's has the merge's legs in.)
    expect(d.ledger.changes.filter((c) => c.reason === "merge").map((c) => c.asset_kind)).toEqual(expect.arrayContaining(["series_crate", "boss_pick", "keys", "xp"]));
    await deleteAccount(sql, owner, T0 + 2);
    expect(await sql.all("SELECT * FROM series_crates")).toEqual([]);
    expect(await sql.all("SELECT * FROM wallets")).toEqual([]);
    // (The ledger's rows stay, naming nobody: what's left adds up to nothing.)
    expect((await sql.first<{ n: number }>("SELECT SUM(delta) AS n FROM ledger WHERE asset_kind IN ('series_crate', 'boss_pick')"))?.n).toBe(0);
  });
});
