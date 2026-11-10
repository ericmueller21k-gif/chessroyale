import { describe, expect, it, vi } from "vitest";
import { XP, bossCrateOf, isPickableBossCrate, pickableBossCrates, xpDayStart } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, recordResult, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { handleAccountApi } from "../src/api.ts";
import { openBossCrate } from "../src/boss-tokens.ts";
import { applyOp, leg, ledgerAccount, ledgerMismatches } from "../src/ledger.ts";
import { lockerState, openCrate } from "../src/locker.ts";
import { NO_PICK, pickBossCrate } from "../src/rewards.ts";
import { gameXpOf, grantXp, setTestXp, xpOf, type XpGame } from "../src/xp.ts";
import { memoryDb, stockCrates } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: the match rooms import it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));

/**
 * XP phase 2 (Eric, Nov 9: "go with phase two"; server/rewards.ts, xp.ts; docs/decisions/2026-11-09-xp-phase2-*.md): the daily
 * reward once an XP day, each level's crates and key once (several at once too), every 10th level's boss crate picked once, a series
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
    // The next game today: its own XP only.
    const second = await grantXp(sql, ann.id, game("lobby:CCCCC:1", 20, { now: T0 + 60 * MIN }));
    expect([second?.parts, second?.rewards]).toEqual([[{ label: "12 min", xp: 120 }], undefined]);
    // A replay of the paying game: the same parts and rewards, nothing more.
    const again = await grantXp(sql, ann.id, game("lobby:BBBBB:1"));
    expect([again?.parts, again?.rewards]).toEqual([first?.parts, first?.rewards]);
    expect(await holdings(sql, ann.id)).toEqual({ crates: { "winter-1": 1 }, keys: 0, picks: 0 });
    // The next XP day (08:00 UTC): again.
    const tomorrow = await grantXp(sql, ann.id, game("lobby:DDDDD:1", 20, { now: xpDayStart(T0) + DAY }));
    expect(tomorrow?.parts.at(-1)).toEqual({ label: "Daily reward", xp: XP.dailyBonus });
    expect((await holdings(sql, ann.id)).crates).toEqual({ "winter-1": 2 });
    expect(await xpOf(sql, ann.id)).toBe(120 * 4 + 2 * XP.dailyBonus);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("two games at once (two rooms): the day's reward is paid once, to one of them", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const both = await Promise.all(["lobby:AAAAA:1", "squads:BBBBB:1", "duel:CCCCC"].map((k) => grantXp(sql, ann.id, game(k))));
    expect(both.filter((g) => g?.parts.some((p) => p.label === "Daily reward")).length).toBe(1);
    expect(both.filter((g) => g?.rewards?.daily).length).toBe(1);
    expect(await holdings(sql, ann.id)).toEqual({ crates: { "winter-1": 1 }, keys: 0, picks: 0 });
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

describe("level rewards: XP.levelCrates Winter Crates and XP.levelKeys keys a level; every 10th also a boss crate to pick", () => {
  it("a level-up pays its level once; a replay answers the same; the next game in the same level pays nothing", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    // (The levels below 2 were never reached: nothing owed.)
    await setTestXp(sql, ann.id, 950, T0);
    const up = await grantXp(sql, ann.id, game("lobby:AAAAA:1", 14));
    expect(up).toMatchObject({ levelBefore: 1, levelAfter: 2, rewards: { crates: XP.levelCrates, keys: XP.levelKeys, bossPicks: 0, levels: [2], daily: 0 } });
    expect((await grantXp(sql, ann.id, game("lobby:AAAAA:1", 14)))?.rewards).toEqual(up?.rewards);
    expect((await grantXp(sql, ann.id, game("lobby:BBBBB:1", 14)))?.rewards).toBeUndefined();
    expect(await holdings(sql, ann.id)).toEqual({ crates: { "winter-1": XP.levelCrates }, keys: XP.levelKeys, picks: 0 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("several levels at once (a test switch's jump, or levels from before): each paid once, the 10th's boss crate pick too", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await setTestXp(sql, ann.id, 9_850, T0);
    const g = await grantXp(sql, ann.id, game("lobby:AAAAA:1", 14));
    expect(g?.rewards).toEqual({ crate: "winter-1", daily: 0, crates: 9 * XP.levelCrates, keys: 9 * XP.levelKeys, bossPicks: 1, levels: [2, 3, 4, 5, 6, 7, 8, 9, 10] });
    expect(await holdings(sql, ann.id)).toEqual({ crates: { "winter-1": 9 * XP.levelCrates }, keys: 9 * XP.levelKeys, picks: 1 });
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
    expect(all).toEqual(Array.from({ length: 40 }, (_, i) => i + 2));
    expect(both.every((g) => (g?.rewards?.levels.length ?? 0) <= XP.levelsPerGame)).toBe(true);
    expect(await holdings(sql, ann.id)).toEqual({ crates: { "winter-1": 40 * XP.levelCrates }, keys: 40 * XP.levelKeys, picks: 4 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("the daily reward's XP can be the level-up's: both in one game's rewards", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await setTestXp(sql, ann.id, 850, T0);
    const g = await grantXp(sql, ann.id, game("lobby:AAAAA:1"));
    expect(g).toMatchObject({ before: 850, after: 850 + 120 + XP.dailyBonus, levelAfter: 2 });
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
    await setTestXp(sql, ann.id, 990, T0);
    const paused = await grantXp(sql, ann.id, game("lobby:AAAAA:1", 20, { paused: true }));
    expect(paused).toEqual({ before: 990, after: 990, levelBefore: 1, levelAfter: 1, parts: [], none: "paused" });
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
    // (A guest earns where sign-in isn't set up: the local and e2e servers.) The guest reaches level 3: levels 2 and 3 paid to it.
    await setTestXp(sql, guest.id, 2_000, T0);
    expect((await grantXp(sql, guest.id, { ...game("lobby:AAAAA:1"), signedInOnly: false }))?.rewards?.levels).toEqual([2, 3]);
    // The account reaches level 2: level 2 paid to it.
    await setTestXp(sql, owner.id, 1_500, T0);
    expect((await grantXp(sql, owner.id, game("lobby:BBBBB:1")))?.rewards?.levels).toEqual([2]);
    const before = await holdings(sql, guest.id);
    const mine = await holdings(sql, owner.id);
    await signInWithIdentity(sql, guest, "email", "owner@example.com", {}, T0 + 1);
    // Together: 1,820 + 2,320 XP, level 5. Its next game pays levels 4 and 5 only (before: 3, 4 and 5; level 3 the guest's again).
    expect(await xpOf(sql, owner.id)).toBe(4_140);
    const next = await grantXp(sql, owner.id, game("lobby:CCCCC:1", 20, { now: T0 + 60 * MIN }));
    expect(next?.rewards?.levels).toEqual([4, 5]);
    const after = await holdings(sql, owner.id);
    expect(after.keys).toBe(mine.keys + before.keys + 2 * XP.levelKeys);
    expect(after.crates["winter-1"]).toBe((mine.crates["winter-1"] ?? 0) + (before.crates["winter-1"] ?? 0) + 2 * XP.levelCrates);
    // Nothing more at the game after.
    expect((await grantXp(sql, owner.id, game("lobby:DDDDD:1", 20, { now: T0 + 90 * MIN })))?.rewards?.levels ?? []).toEqual([]);
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
