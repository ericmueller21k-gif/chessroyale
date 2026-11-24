import { describe, expect, it } from "vitest";
import { BOSS_ADMIN_FIRST, CRATE_BONUS, bonusPool, bossCrateDef, mulberry32, opensWithKey, rollBonus, rollCrate, crateDef, type BonusRoll } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { handleAccountApi } from "../src/api.ts";
import { openBossCrate } from "../src/boss-tokens.ts";
import { applyOp, leg, ledgerAccount, ledgerMismatches } from "../src/ledger.ts";
import { lockerState, openCrate, type BonusMode } from "../src/locker.ts";
import { memoryDb, stockCrates } from "./memory-db.ts";

/**
 * The bonus crate (Eric, Nov 24; docs/decisions/2026-11-24-bonus-crate.md; core bonus-crate.ts, CRATE_BONUS): every crate opening also has
 * a 25% chance of a crate (any crate there is, each as likely) and its key when it opens with one, rolled by the server in the same
 * ledger op as the item: a retry never grants twice or rolls twice. A bonus crate is held under its crate's id with a "bonus:" prefix,
 * opens after the ordinary ones of its kind and never rolls a bonus itself; the flag goes with a guest's sign-in and the download.
 */
const T0 = Date.UTC(2026, 10, 24, 12, 0);
let n = 0;
const rid = () => `bonus-test-${String(++n).padStart(4, "0")}`;

async function world() {
  const { sql, db, d1 } = memoryDb();
  await ensureSchema(sql);
  return { sql, db, d1 };
}
const signedIn = async (sql: Sql, email: string) => signInWithIdentity(sql, (await createGuest(sql, T0, "Player")).user, "email", email, {}, T0);
/** `k` of a boss's crate, held unopened (as a buy puts them in: a boss_crates row each, through the ledger). */
async function stockBossCrates(sql: Sql, userId: string, crate: string, k: number) {
  const me = (await ledgerAccount(sql, userId))!;
  for (let i = 0; i < k; i++) await applyOp(sql, me, { id: `test-boss:${rid()}`, reason: "test", now: T0 + i, legs: [leg.bossCrateIn(userId, `row-${rid()}`, crate, T0 + i)] });
}
const stock = async (sql: Sql, id: string) => {
  const l = await lockerState(sql, id);
  return { series: l.seriesCrates, boss: l.bossCrates, bonus: l.bonusCrates, keys: l.keys };
};
const force = (crate: true | string): BonusMode => ({ force: crate });
/** A seed whose opening of `crate` rolls (the item, then the bonus, from one stream) a bonus `want` would accept. */
function seedFor(crate: string, want: (b: BonusRoll | null) => boolean): number {
  const def = crateDef(crate) ?? bossCrateDef(crate)!;
  for (let s = 1; ; s++) {
    const rng = mulberry32(s);
    rollCrate(rng, def);
    if (want(rollBonus(rng))) return s;
  }
}
/** Every ledger row an op wrote: its legs as (kind, asset, delta). */
const legsOf = (db: ReturnType<typeof memoryDb>["db"], op: string) =>
  db.prepare("SELECT asset_kind AS kind, asset_id AS asset, delta FROM ledger WHERE op_id = ? ORDER BY leg").all(op) as { kind: string; asset: string; delta: number }[];
const opsSince = (db: ReturnType<typeof memoryDb>["db"], reason: string) => (db.prepare("SELECT DISTINCT op_id FROM ledger WHERE reason = ?").all(reason) as { op_id: string }[]).map((r) => r.op_id);

describe("the bonus crate: the grant", () => {
  it("a series crate's bonus: the item, and the crate (a bonus one) and its key, in the opening's one op; the locker says so at once", async () => {
    const { sql, db } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await stockCrates(sql, ann.id, "beta-001", 1);
    const r = await openCrate(sql, ann.id, "beta-001", {}, T0, false, rid(), { bonus: force("winter-1") });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bonus).toEqual({ crate: "winter-1", key: true });
    // The beta crate and its key spent, the bonus Winter Crate and its key in: one Winter Crate (a bonus one), one key.
    expect(await stock(sql, ann.id)).toEqual({ series: { "winter-1": 1 }, boss: {}, bonus: { "winter-1": 1 }, keys: 1 });
    expect(r.locker.bonusCrates).toEqual({ "winter-1": 1 });
    // One op: the item, the crate and key out, the bonus crate and its key in.
    const [op, ...more] = opsSince(db, "crate open");
    expect(more).toEqual([]);
    expect(legsOf(db, op!)).toEqual([
      { kind: "item", asset: r.item.id, delta: 1 },
      { kind: "series_crate", asset: "beta-001", delta: -1 },
      { kind: "keys", asset: "", delta: -1 },
      { kind: "series_crate", asset: "bonus:winter-1", delta: 1 },
      { kind: "keys", asset: "", delta: 1 },
    ]);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("a boss crate's bonus: no key (a boss crate opens without one); a boss crate's own opening rolls one too", async () => {
    const { sql, db } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await stockCrates(sql, ann.id, "winter-1", 1);
    const r = await openCrate(sql, ann.id, "winter-1", {}, T0, false, rid(), { bonus: force("boss-tiger") });
    expect(r.ok && r.bonus).toEqual({ crate: "boss-tiger", key: false });
    expect(await stock(sql, ann.id)).toEqual({ series: {}, boss: { "boss-tiger": 1 }, bonus: { "boss-tiger": 1 }, keys: 0 });
    // A boss crate (an ordinary one: bought) opened: its bonus, a Beta Crate and its key.
    await stockBossCrates(sql, ann.id, "boss-gardener", 1);
    const b = await openBossCrate(sql, ann.id, "boss-gardener", T0, false, rid(), { bonus: force("beta-001") });
    expect(b.ok && b.bonus).toEqual({ crate: "beta-001", key: true });
    expect(await stock(sql, ann.id)).toEqual({ series: { "beta-001": 1 }, boss: { "boss-tiger": 1 }, bonus: { "boss-tiger": 1, "beta-001": 1 }, keys: 1 });
    const [op] = opsSince(db, "boss crate open");
    expect(legsOf(db, op!).map((l) => [l.kind, l.asset, l.delta])).toEqual([
      ["boss_crate", "boss-gardener", -1],
      ["item", (b as { item: { id: string } }).item.id, 1],
      ["series_crate", "bonus:beta-001", 1],
      ["keys", "", 1],
    ]);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("the roll's own: a seed whose stream rolls a bonus gives it, one that doesn't gives none (the item's roll, then the bonus's, one stream)", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await stockCrates(sql, ann.id, "beta-001", 2);
    const hit = seedFor("beta-001", (b) => b?.crate === "boss-clown");
    const miss = seedFor("beta-001", (b) => b === null);
    const a = await openCrate(sql, ann.id, "beta-001", {}, T0, false, rid(), { bonus: "roll", rng: mulberry32(hit) });
    const b = await openCrate(sql, ann.id, "beta-001", {}, T0, false, rid(), { bonus: "roll", rng: mulberry32(miss) });
    expect([a.ok && a.bonus, b.ok && b.bonus]).toEqual([{ crate: "boss-clown", key: false }, undefined]);
    // (The item is the same stream's: what rollCrate makes of the seed.)
    const rng = mulberry32(hit);
    expect(a.ok && a.item.def).toBe(rollCrate(rng, crateDef("beta-001")!).def);
    // (Off, the default for a direct call: none, whatever the seed.)
    await stockCrates(sql, ann.id, "beta-001", 1);
    const c = await openCrate(sql, ann.id, "beta-001", {}, T0, false, rid(), { rng: mulberry32(hit) });
    expect(c.ok && c.bonus).toBeUndefined();
  });
});

describe("the bonus crate: the odds and the pool", () => {
  it("about 25% over 2,000 seeded openings, every bonus from the pool, its key exactly when it opens with one; the ledger agrees", { timeout: 60_000 }, async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const N = 2000;
    await stockCrates(sql, ann.id, "beta-001", N);
    const rng = mulberry32(20261124);
    const got = new Map<string, number>();
    let keys = 0;
    for (let i = 0; i < N; i++) {
      const r = await openCrate(sql, ann.id, "beta-001", {}, T0 + i, false, rid(), { bonus: "roll", rng });
      expect(r.ok).toBe(true);
      if (!r.ok || !r.bonus) continue;
      expect(bonusPool().map((c) => c.id)).toContain(r.bonus.crate);
      expect(r.bonus.key).toBe(opensWithKey(r.bonus.crate));
      got.set(r.bonus.crate, (got.get(r.bonus.crate) ?? 0) + 1);
      if (r.bonus.key) keys++;
    }
    const hits = [...got.values()].reduce((s, k) => s + k, 0);
    // 2,000 at 0.25: 500 expected, sd about 19; within 4 sd.
    expect(Math.abs(hits - N * CRATE_BONUS.chance)).toBeLessThan(80);
    // Never an admins-first boss's crate for a player.
    for (const boss of BOSS_ADMIN_FIRST) expect(got.has(`boss-${boss}`)).toBe(false);
    // Every ordinary Beta Crate opened (they open first); what's left is the bonus crates, each counted; the keys: the bonus ones.
    const l = await lockerState(sql, ann.id);
    expect(l.bonusCrates).toEqual(Object.fromEntries([...got].sort()));
    expect(l.keys).toBe(keys);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("the server's own randomness (no seed): some openings give a bonus and most don't", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await stockCrates(sql, ann.id, "winter-1", 80);
    let hits = 0;
    for (let i = 0; i < 80; i++) {
      const r = await openCrate(sql, ann.id, "winter-1", {}, T0, false, rid(), { bonus: "roll" });
      if (r.ok && r.bonus) hits++;
    }
    // (The ledger agrees: one bonus crate leg each.)
    const legs = (await sql.all<{ n: number }>("SELECT COUNT(*) AS n FROM ledger WHERE reason = 'crate open' AND delta > 0 AND asset_id LIKE 'bonus:%'"))[0]!.n;
    expect(legs).toBe(hits);
    // 80 at 0.25: 20 expected; none at all, or half or more, would be about 1 in 10 million.
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(40);
  });

  it("an admins-first boss's crate: a player's switch can't name it (another crate comes); an admin's can", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await stockCrates(sql, ann.id, "winter-1", 2);
    const birdie = "boss-birdie";
    expect(BOSS_ADMIN_FIRST).toContain("birdie");
    const p = await openCrate(sql, ann.id, "winter-1", {}, T0, false, rid(), { bonus: force(birdie) });
    expect(p.ok && p.bonus?.crate).not.toBe(birdie);
    const a = await openCrate(sql, ann.id, "winter-1", {}, T0, true, rid(), { bonus: force(birdie) });
    expect(a.ok && a.bonus).toEqual({ crate: birdie, key: false });
  });
});

describe("the bonus crate: a bonus crate never rolls one, and opens last", () => {
  it("a series crate: the ordinary one opens first (it can roll); the bonus one after, never rolling, not even forced", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await stockCrates(sql, ann.id, "winter-1", 1);
    // Its bonus: a Winter Crate. Now one ordinary (bought) and one bonus.
    await openCrate(sql, ann.id, "winter-1", {}, T0, false, rid(), { bonus: force("winter-1") });
    await stockCrates(sql, ann.id, "winter-1", 1);
    expect(await stock(sql, ann.id)).toEqual({ series: { "winter-1": 2 }, boss: {}, bonus: { "winter-1": 1 }, keys: 2 });
    // The ordinary one first: it rolls (forced: a Beta Crate); the bonus one stays.
    const a = await openCrate(sql, ann.id, "winter-1", {}, T0, false, rid(), { bonus: force("beta-001") });
    expect(a.ok && a.bonus).toEqual({ crate: "beta-001", key: true });
    expect(await stock(sql, ann.id)).toEqual({ series: { "winter-1": 1, "beta-001": 1 }, boss: {}, bonus: { "winter-1": 1, "beta-001": 1 }, keys: 2 });
    // Then the bonus one: no bonus, even asked for.
    const b = await openCrate(sql, ann.id, "winter-1", {}, T0, false, rid(), { bonus: force(true) });
    expect(b.ok).toBe(true);
    expect(b.ok && b.bonus).toBeUndefined();
    expect(await stock(sql, ann.id)).toEqual({ series: { "beta-001": 1 }, boss: {}, bonus: { "beta-001": 1 }, keys: 1 });
    // And the bonus Beta Crate: the same.
    const c = await openCrate(sql, ann.id, "beta-001", {}, T0, false, rid(), { bonus: force(true) });
    expect(c.ok && c.bonus).toBeUndefined();
    expect(await stock(sql, ann.id)).toEqual({ series: {}, boss: {}, bonus: {}, keys: 0 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("a boss crate: the ordinary ones first (oldest first), the bonus one last, never rolling", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await stockCrates(sql, ann.id, "winter-1", 1);
    await openCrate(sql, ann.id, "winter-1", {}, T0, false, rid(), { bonus: force("boss-tiger") });
    // (The bonus one is the oldest: the ordinary ones are bought after it, and still open first.)
    await stockBossCrates(sql, ann.id, "boss-tiger", 2);
    expect((await stock(sql, ann.id)).boss).toEqual({ "boss-tiger": 3 });
    for (let i = 0; i < 2; i++) {
      const r = await openBossCrate(sql, ann.id, "boss-tiger", T0, false, rid(), { bonus: force("boss-folio") });
      expect(r.ok && r.bonus).toEqual({ crate: "boss-folio", key: false });
      expect((await stock(sql, ann.id)).bonus["boss-tiger"]).toBe(1);
    }
    const last = await openBossCrate(sql, ann.id, "boss-tiger", T0, false, rid(), { bonus: force("boss-folio") });
    expect(last.ok && last.bonus).toBeUndefined();
    expect(await stock(sql, ann.id)).toEqual({ series: {}, boss: { "boss-folio": 2 }, bonus: { "boss-folio": 2 }, keys: 0 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });
});

describe("the bonus crate: retries and opens at once", () => {
  it("a retried open (the same request id) never grants twice or rolls twice: it answers the first's item and bonus, even after the last crate", async () => {
    const { sql, db } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await stockCrates(sql, ann.id, "beta-001", 2);
    const req = rid();
    const first = await openCrate(sql, ann.id, "beta-001", {}, T0, false, req, { bonus: force("winter-1") });
    // (The retry asks for another crate: what it answers is the first's, as stored.)
    const again = await openCrate(sql, ann.id, "beta-001", {}, T0, false, req, { bonus: force("boss-tiger") });
    expect(again).toEqual(first);
    expect(await stock(sql, ann.id)).toEqual({ series: { "beta-001": 1, "winter-1": 1 }, boss: {}, bonus: { "winter-1": 1 }, keys: 2 });
    // The last ordinary Beta Crate, then its retry once none is left: the same answer.
    const req2 = rid();
    const last = await openCrate(sql, ann.id, "beta-001", {}, T0, false, req2, { bonus: force("boss-folio") });
    const lastAgain = await openCrate(sql, ann.id, "beta-001", {}, T0, false, req2, { bonus: force(true) });
    expect(lastAgain).toEqual(last);
    expect(last.ok && last.bonus).toEqual({ crate: "boss-folio", key: false });
    // A boss crate's open, retried: the same. (An ordinary one bought: it opens before the bonus Folio crate.)
    await stockBossCrates(sql, ann.id, "boss-folio", 1);
    const req3 = rid();
    const boss = await openBossCrate(sql, ann.id, "boss-folio", T0, false, req3, { bonus: force("beta-001") });
    expect(boss.ok && boss.bonus).toEqual({ crate: "beta-001", key: true });
    expect(await openBossCrate(sql, ann.id, "boss-folio", T0, false, req3, { bonus: force("winter-1") })).toEqual(boss);
    expect(await stock(sql, ann.id)).toEqual({
      series: { "winter-1": 1, "beta-001": 1 },
      boss: { "boss-folio": 1 },
      bonus: { "winter-1": 1, "beta-001": 1, "boss-folio": 1 },
      keys: 2,
    });
    // Each open is one op; none more.
    expect(opsSince(db, "crate open").length).toBe(2);
    expect(opsSince(db, "boss crate open").length).toBe(1);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("the same open sent three times at once: one grant, one answer", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await stockCrates(sql, ann.id, "beta-001", 3);
    const req = rid();
    const rs = await Promise.all([0, 1, 2].map(() => openCrate(sql, ann.id, "beta-001", {}, T0, false, req, { bonus: force("winter-1") })));
    expect(rs.every((r) => r.ok)).toBe(true);
    const items = new Set(rs.map((r) => r.ok && r.item.id));
    expect(items.size).toBe(1);
    expect(await stock(sql, ann.id)).toEqual({ series: { "beta-001": 2, "winter-1": 1 }, boss: {}, bonus: { "winter-1": 1 }, keys: 3 });
  });

  it("two opens at once, holding one ordinary and one bonus crate: both open, the second takes the bonus one (and rolls none)", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await stockCrates(sql, ann.id, "winter-1", 1);
    await openCrate(sql, ann.id, "winter-1", {}, T0, false, rid(), { bonus: force("winter-1") });
    await stockCrates(sql, ann.id, "winter-1", 1);
    const rs = await Promise.all([0, 1].map(() => openCrate(sql, ann.id, "winter-1", {}, T0, false, rid(), { bonus: force("boss-tiger") })));
    expect(rs.map((r) => r.ok)).toEqual([true, true]);
    expect(rs.filter((r) => r.ok && r.bonus).length).toBe(1);
    expect(await stock(sql, ann.id)).toEqual({ series: {}, boss: { "boss-tiger": 1 }, bonus: { "boss-tiger": 1 }, keys: 0 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });
});

describe("the bonus crate: the account's data", () => {
  it("a guest's bonus crates (it opens as anyone's) join the account it signs in to, still bonus ones; the download has them; deleting closes them", async () => {
    const { sql } = await world();
    const owner = await signedIn(sql, "owner@example.com");
    const guest = (await createGuest(sql, T0, "Guest")).user;
    await stockCrates(sql, guest.id, "winter-1", 2);
    await openCrate(sql, guest.id, "winter-1", {}, T0, false, rid(), { bonus: force("beta-001") });
    await openCrate(sql, guest.id, "winter-1", {}, T0, false, rid(), { bonus: force("boss-tiger") });
    const before = await stock(sql, guest.id);
    expect(before).toEqual({ series: { "beta-001": 1 }, boss: { "boss-tiger": 1 }, bonus: { "beta-001": 1, "boss-tiger": 1 }, keys: 1 });
    const merged = await signInWithIdentity(sql, guest, "email", "owner@example.com", {}, T0 + 1);
    expect(merged.id).toBe(owner.id);
    expect(await stock(sql, owner.id)).toEqual(before);
    expect(await ledgerMismatches(sql, owner.id)).toEqual([]);
    // Still bonus ones: opening them rolls nothing.
    const b = await openBossCrate(sql, owner.id, "boss-tiger", T0 + 2, false, rid(), { bonus: force(true) });
    expect(b.ok && b.bonus).toBeUndefined();
    const d = (await accountDownload(sql, owner, T0 + 3)) as unknown as { xp: { seriesCrates: { crate: string; n: number }[] }; ledger: { changes: { asset_id: string }[] } };
    expect(d.xp.seriesCrates).toEqual([{ crate: "bonus:beta-001", n: 1 }]);
    expect(d.ledger.changes.some((c) => c.asset_id === "bonus:boss-tiger")).toBe(true);
    await deleteAccount(sql, owner, T0 + 4);
    expect(await ledgerMismatches(sql, owner.id)).toEqual([]);
  });

  it("the download lists a held boss bonus crate as one", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await stockCrates(sql, ann.id, "winter-1", 1);
    await openCrate(sql, ann.id, "winter-1", {}, T0, false, rid(), { bonus: force("boss-tiger") });
    const d = (await accountDownload(sql, ann, T0 + 3)) as unknown as { bossTokens: { bossCrates: { crate: string }[] } };
    expect(d.bossTokens.bossCrates.map((c) => c.crate)).toEqual(["bonus:boss-tiger"]);
  });
});

describe("the bonus crate through the API", () => {
  const call = async (env: object, body: unknown, cookie: string) => {
    const res = (await handleAccountApi(new Request("https://hunchess.com/api/locker/open", { method: "POST", body: JSON.stringify(body), headers: { cookie } }), env as never))!;
    return { status: res.status, body: (await res.json()) as { bonus?: BonusRoll; locker?: { bonusCrates: Record<string, number>; keys: number }; message?: string } };
  };

  it("production: the server's roll, whatever the request asks; TEST_SWITCHES on: none unless the test asks (`bonus`: true, or a crate's id)", async () => {
    const { sql, d1 } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const cookie = `hc_session=${await createSession(sql, ann.id, Date.now())}`;
    await stockCrates(sql, ann.id, "beta-001", 120);
    // Production, asking for a Winter Crate every time: the server's own roll (some, not all, and not always Winter).
    const prod = { DB: d1 };
    const got: (BonusRoll | undefined)[] = [];
    for (let i = 0; i < 60; i++) got.push((await call(prod, { crate: "beta-001", request: rid(), bonus: "winter-1" }, cookie)).body.bonus);
    const hits = got.filter(Boolean);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThan(40);
    // Test switches on: no bonus unless asked.
    const test = { DB: d1, TEST_SWITCHES: "1" };
    for (let i = 0; i < 20; i++) expect((await call(test, { crate: "beta-001", request: rid() }, cookie)).body.bonus).toBeUndefined();
    const asked = await call(test, { crate: "beta-001", request: rid(), bonus: "winter-1" }, cookie);
    expect([asked.status, asked.body.bonus]).toEqual([200, { crate: "winter-1", key: true }]);
    expect(asked.body.locker!.bonusCrates["winter-1"]).toBeGreaterThanOrEqual(1);
    expect((await call(test, { crate: "beta-001", request: rid(), bonus: true }, cookie)).body.bonus).toBeDefined();
    // A boss crate's opening through the API: the same switch.
    await stockBossCrates(sql, ann.id, "boss-tiger", 1);
    expect((await call(test, { crate: "boss-tiger", request: rid(), bonus: "beta-001" }, cookie)).body.bonus).toEqual({ crate: "beta-001", key: true });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("the shop's kill switch refuses the opening, so no bonus either; nothing changes", async () => {
    const { sql, d1 } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const cookie = `hc_session=${await createSession(sql, ann.id, Date.now())}`;
    await stockCrates(sql, ann.id, "beta-001", 1);
    const before = await stock(sql, ann.id);
    expect((await call({ DB: d1, PAUSE_SHOP: "1", TEST_SWITCHES: "1" }, { crate: "beta-001", request: rid(), bonus: true }, cookie)).status).toBe(503);
    expect(await stock(sql, ann.id)).toEqual(before);
  });
});
