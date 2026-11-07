import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { OPS, SHOP_ITEMS, bossCrateOf, crateDef, itemDef, mulberry32, rollCrate, tokenBosses, type CrateDef } from "@chessroyale/core";
import { buyItem, createGuest, createSession, ensureSchema, grantReward, recordResult, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { buyBossCrate, countBossBattle, grantTestItems, openBossCrate } from "../src/boss-tokens.ts";
import { applyOp, backfillLedger, clawOp, cond, leg, ledgerAccount, ledgerCheck, ledgerCheckDue, ledgerMismatches, opKeys, requestId } from "../src/ledger.ts";
import { deleteLockerItems, openCrate } from "../src/locker.ts";
import { handleOpsAdmin } from "../src/ops-admin.ts";
import { recordDuel, type FinishedDuel } from "../src/ranked.ts";
import { grantWelcomeCrate, openWelcomeCrate } from "../src/welcome.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: the ops page imports it.)
vi.mock("@cloudflare/containers", () => ({ Container: class {}, getContainer: () => null }));

/**
 * The ledger (ledger.ts; docs/decisions/2026-11-06-ledger.md): an op applied twice, or twice at once, changes a balance once; a refused
 * or failed op writes nothing; every path moved to it keeps each balance equal to its ledger's sum, through guests merging in and
 * accounts deleted; the ledger is append-only and names nobody once an account is gone; and nothing else writes a balance table.
 * Prices count here, so SHOP_FREE is off.
 */
const shop = vi.hoisted(() => ({ free: false }));
vi.mock("@chessroyale/core", async (orig) => {
  const real = await orig<typeof import("@chessroyale/core")>();
  return {
    ...real,
    get SHOP_FREE() {
      return shop.free;
    },
  };
});

const T0 = 1_800_000_000_000;
const MIN = 60_000;
const DAY = 86_400_000;
const tiger = bossCrateOf("tiger")!;
type Db = ReturnType<typeof memoryDb>["db"];

async function world() {
  const { sql, db } = memoryDb();
  await ensureSchema(sql);
  return { sql, db };
}
const signedIn = async (sql: Sql, email: string, now: number) => signInWithIdentity(sql, (await createGuest(sql, now, "Player")).user, "email", email, {}, now);
/** Coins through the ledger: a test's own op (the coin paths moved so far are ranked games and the shop's spending). */
let gifts = 0;
async function giveCoins(sql: Sql, userId: string, n: number, now: number, id = `test:coins:${++gifts}`) {
  return applyOp(sql, (await ledgerAccount(sql, userId))!, { id, reason: "test", now, legs: [leg.coins(userId, n)] });
}
const coinsOf = (db: Db, id: string) => (db.prepare("SELECT coins FROM wallets WHERE user_id = ?").get(id) as { coins: number } | undefined)?.coins ?? 0;
const legsOf = (db: Db, prefix: string) => db.prepare("SELECT leg, asset_kind, asset_id, delta FROM ledger WHERE op_id LIKE ? ORDER BY rowid").all(`${prefix}%`);
/** Assets of accounts nobody has now (merged or deleted) whose legs don't add up to zero. */
const orphans = (db: Db) =>
  db
    .prepare(
      "SELECT account, asset_kind, asset_id, SUM(delta) AS n FROM ledger WHERE account NOT IN (SELECT account FROM ledger_accounts) GROUP BY account, asset_kind, asset_id HAVING SUM(delta) <> 0",
    )
    .all();
let games = 0;
const duel = (w: string, b: string, result: FinishedDuel["result"], endedAt: number): FinishedDuel => ({
  id: `G${++games}`,
  players: { w, b },
  control: "blitz",
  result,
  reason: "resign",
  moves: Array.from({ length: 60 }, () => "e2e4"),
  times: Array.from({ length: 60 }, () => 1500),
  startedAt: endedAt - 6 * MIN,
  endedAt,
});
const notHeld = async () => false;

describe("an op", () => {
  it("applied twice, or three times at once, changes the balance once", async () => {
    const { sql, db } = await world();
    const a = await signedIn(sql, "a@example.com", T0);
    const me = (await ledgerAccount(sql, a.id))!;
    const op = { id: "test:once", reason: "test", now: T0, legs: [leg.coins(a.id, 50)] };
    expect(await applyOp(sql, me, op)).toBe("applied");
    expect(await applyOp(sql, me, op)).toBe("replay");
    expect(coinsOf(db, a.id)).toBe(50);
    const race = await Promise.all([1, 2, 3].map(() => applyOp(sql, me, { ...op, id: "test:race" })));
    expect(race.sort()).toEqual(["applied", "replay", "replay"]);
    expect(coinsOf(db, a.id)).toBe(100);
    expect(db.prepare("SELECT COUNT(*) AS n FROM ledger").get()).toEqual({ n: 2 });
    expect(await ledgerMismatches(sql, a.id)).toEqual([]);
  });

  it("refused by its guard, or failing partway (one transaction), it writes nothing; an account gone since is refused", async () => {
    const { sql, db } = await world();
    const a = await signedIn(sql, "a@example.com", T0);
    const me = (await ledgerAccount(sql, a.id))!;
    await giveCoins(sql, a.id, 50, T0);
    const spend = (id: string) => ({ id, reason: "test", now: T0, when: cond("EXISTS (SELECT 1 FROM wallets WHERE user_id = ? AND coins >= 80)", a.id), legs: [leg.coins(a.id, -80)] });
    expect(await applyOp(sql, me, spend("test:spend"))).toBe("refused");
    const failing: Sql = { ...sql, batch: (list) => sql.batch([...list, { sql: "INSERT INTO nowhere VALUES (1)", params: [] }]) };
    await expect(applyOp(failing, me, { id: "test:fails", reason: "test", now: T0, legs: [leg.coins(a.id, 10), leg.keys(a.id, 1)] })).rejects.toThrow();
    expect(db.prepare("SELECT coins, crate_keys FROM wallets WHERE user_id = ?").get(a.id)).toEqual({ coins: 50, crate_keys: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM ledger").get()).toEqual({ n: 1 });
    // (Deleted: its ledger id is gone, so an op still holding it is refused, and nothing names it.)
    await deleteAccount(sql, a, T0 + 1);
    expect(await applyOp(sql, me, { id: "test:late", reason: "test", now: T0 + 2, legs: [leg.coins(a.id, 5)] })).toBe("refused");
    expect(await ledgerAccount(sql, a.id)).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS n FROM wallets").get()).toEqual({ n: 0 });
    expect(orphans(db)).toEqual([]);
  });

  it("is append-only: the database refuses an UPDATE or DELETE of a ledger row", async () => {
    const { sql, db } = await world();
    const a = await signedIn(sql, "a@example.com", T0);
    await giveCoins(sql, a.id, 5, T0);
    expect(() => db.prepare("UPDATE ledger SET delta = 500").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM ledger").run()).toThrow(/append-only/);
    expect(db.prepare("SELECT delta FROM ledger").all()).toEqual([{ delta: 5 }]);
  });
});

describe("each path, keyed by its event: replayed or raced, it changes a balance once", () => {
  it("the coin shop (shop:<ledger id>:<item>), ranked coins (ranked:<game>:<color>), a solo drop (drop:solo:<battle>)", async () => {
    const { sql, db } = await world();
    const a = await signedIn(sql, "a@example.com", T0);
    const b = await signedIn(sql, "b@example.com", T0);
    await giveCoins(sql, a.id, 1000, T0);
    const both = await Promise.all([buyItem(sql, a.id, "king-storm", T0), buyItem(sql, a.id, "king-storm", T0)]);
    expect(both.every((r) => r.ok)).toBe(true);
    expect((await buyItem(sql, a.id, "king-storm", T0 + 1)).ok).toBe(true);
    expect(coinsOf(db, a.id)).toBe(600);
    expect(legsOf(db, "shop:")).toEqual([
      { leg: 0, asset_kind: "shop", asset_id: "king-storm", delta: 1 },
      { leg: 1, asset_kind: "coins", asset_id: "", delta: -400 },
    ]);
    // Ranked: a game recorded twice (a retry whose answer was lost) pays once.
    const g = duel(a.id, b.id, "1-0", T0 + 10 * MIN);
    const first = await recordDuel(sql, g, notHeld);
    await recordDuel(sql, g, notHeld);
    expect(coinsOf(db, a.id)).toBe(600 + first!.w.coins);
    expect(legsOf(db, `ranked:${g.id}:`)).toEqual([
      { leg: 0, asset_kind: "coins", asset_id: "", delta: first!.w.coins },
      { leg: 0, asset_kind: "coins", asset_id: "", delta: first!.b.coins },
    ]);
    // A solo battle's drop, counted twice and three times at once: one token, and every answer names its boss.
    const lucky = () => () => 0.01;
    const drop = (n: number) => countBossBattle(sql, a.id, T0 + 20 * MIN + n, { battle: "0123456789abcdef01", op: "drop:solo:0123456789abcdef01", rng: lucky() });
    const answers = [await drop(0), ...(await Promise.all([drop(1), drop(2), drop(3)]))];
    expect(new Set(answers).size).toBe(1);
    expect(answers[0]).toBeTruthy();
    expect(db.prepare("SELECT SUM(n) AS n FROM boss_tokens WHERE user_id = ?").get(a.id)).toEqual({ n: 1 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM boss_token_drops WHERE user_id = ?").get(a.id)).toEqual({ n: 1 });
    for (const u of [a, b]) expect(await ledgerMismatches(sql, u.id)).toEqual([]);
  });

  it("Welcome Crates (welcome:… and welcome-open:…), a boss crate's buy and open (open:<its row>), deleting an item (delete:<item>)", async () => {
    const { sql, db } = await world();
    const a = await signedIn(sql, "a@example.com", T0);
    for (let i = 0; i < 5; i++) await recordResult(sql, a.id, { mode: "classic", online: false, placement: 1, players: 8 }, T0 + i);
    expect((await Promise.all([1, 2, 3].map(() => grantWelcomeCrate(sql, a.id, T0 + 9)))).flat()).toEqual([5]);
    const opens = await Promise.all([1, 2, 3].map(() => openWelcomeCrate(sql, a.id, T0 + 10)));
    expect(opens.filter((r) => r.ok && !r.again)).toHaveLength(1);
    const ride = opens.find((r) => r.ok && !r.again)!;
    if (!ride.ok) throw new Error(ride.message);
    expect(legsOf(db, "welcome")).toEqual([
      { leg: 0, asset_kind: "welcome", asset_id: "5", delta: 1 },
      { leg: 0, asset_kind: "welcome", asset_id: "5", delta: -1 },
      { leg: 1, asset_kind: "item", asset_id: ride.item.id, delta: 1 },
    ]);
    // A boss crate bought with tokens (what it cost stays in the ledger after it's opened), opened twice at once: one item.
    await grantTestItems(sql, a.id, { boss: "tiger", tokens: 3 }, T0 + 11);
    expect((await buyBossCrate(sql, a.id, tiger.id, "tokens", T0 + 12)).ok).toBe(true);
    const crateOpens = await Promise.all([openBossCrate(sql, a.id, tiger.id, T0 + 13), openBossCrate(sql, a.id, tiger.id, T0 + 13)]);
    expect(crateOpens.filter((r) => r.ok)).toHaveLength(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM boss_crates").get()).toEqual({ n: 0 });
    expect(legsOf(db, "boss-crate:").map((l) => [l.asset_kind, l.delta])).toEqual([
      ["boss_crate", 1],
      ["token", -3],
    ]);
    expect(legsOf(db, "open:").map((l) => [l.asset_kind, l.delta])).toEqual([
      ["boss_crate", -1],
      ["item", 1],
    ]);
    // Deleting both items, twice at once: each is deleted once, one leg each.
    const ids = (db.prepare("SELECT id FROM items WHERE user_id = ?").all(a.id) as { id: string }[]).map((r) => r.id);
    expect(ids).toHaveLength(2);
    await Promise.all([deleteLockerItems(sql, a.id, ids, false, T0 + 14), deleteLockerItems(sql, a.id, ids, false, T0 + 14)]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM items").get()).toEqual({ n: 0 });
    expect(legsOf(db, "delete:").map((l) => [l.asset_id, l.delta]).sort()).toEqual(ids.map((id) => [id, -1]).sort());
    expect(await ledgerMismatches(sql, a.id)).toEqual([]);
  });
});

describe("part II's keys: each replayed, or raced, changes a balance once", () => {
  const R = (n: number) => `req-${n}-0123456789`;
  const count = (db: Db, q: string, ...p: unknown[]) => (db.prepare(q).get(...(p as never[])) as { n: number }).n;

  it("by the app's request id: an admin's grant, a boss crate's buy and open, a free crate's open (each sent again, and twice at once)", async () => {
    const { sql, db } = await world();
    const a = await signedIn(sql, "a@example.com", T0);
    const me = (await ledgerAccount(sql, a.id))!;
    const tokens = () => count(db, "SELECT COALESCE(SUM(n), 0) AS n FROM boss_tokens WHERE user_id = ? AND boss = 'tiger'", a.id);
    const crates = () => count(db, "SELECT COUNT(*) AS n FROM boss_crates WHERE user_id = ?", a.id);
    const items = () => count(db, "SELECT COUNT(*) AS n FROM items WHERE user_id = ?", a.id);
    const thrice = async <T>(f: () => Promise<T>): Promise<T[]> => [await f(), ...(await Promise.all([f(), f()]))];
    expect([requestId(R(1)), requestId("short"), requestId("no spaces here"), requestId(5)]).toEqual([R(1), null, null, null]);
    // An admin's grant: given once.
    const grants = await thrice(() => grantTestItems(sql, a.id, { keys: 2, boss: "tiger", tokens: 9, request: R(1) }, T0));
    expect(grants.every((g) => g.ok)).toBe(true);
    expect([tokens(), count(db, "SELECT crate_keys AS n FROM wallets WHERE user_id = ?", a.id)]).toEqual([9, 2]);
    // A boss crate's buy: one crate, paid once, and every answer is that crate.
    const buys = await thrice(() => buyBossCrate(sql, a.id, tiger.id, "tokens", T0 + 1, false, R(2)));
    expect(buys.map((b) => b.ok && b.crate)).toEqual([tiger.id, tiger.id, tiger.id]);
    expect([crates(), tokens()]).toEqual([1, 6]);
    // (Another request id is another buy. An older app's buy, with none, is one each time, as before.)
    expect((await buyBossCrate(sql, a.id, tiger.id, "key", T0 + 2, false, R(3))).ok).toBe(true);
    expect((await buyBossCrate(sql, a.id, tiger.id, "tokens", T0 + 2)).ok).toBe(true);
    expect([crates(), tokens()]).toEqual([3, 2]);
    // A boss crate's open: one crate opens, and every answer is its item.
    const opens = await thrice(() => openBossCrate(sql, a.id, tiger.id, T0 + 3, false, R(4)));
    expect(new Set(opens.map((o) => o.ok && o.item.id)).size).toBe(1);
    expect([crates(), items()]).toEqual([2, 1]);
    expect(legsOf(db, `open:${me.account}:${R(4)}`).map((l) => [l.asset_kind, l.delta])).toEqual([
      ["boss_crate", -1],
      ["item", 1],
    ]);
    // Your last crates opened, then an open sent again: the same item, not "none to open".
    await openBossCrate(sql, a.id, tiger.id, T0 + 4, false, R(5));
    const last = await openBossCrate(sql, a.id, tiger.id, T0 + 4, false, R(6));
    const again = await openBossCrate(sql, a.id, tiger.id, T0 + 5, false, R(6));
    expect(again.ok && last.ok && again.item.id === last.item.id && again.roll.def === last.roll.def).toBe(true);
    expect([crates(), items()]).toEqual([0, 3]);
    // A free crate's open: one item, the same answer each time; an older app's open, with no id, is one each time.
    const free = await thrice(() => openCrate(sql, a.id, "beta-001", {}, T0 + 6, false, R(7)));
    expect(new Set(free.map((o) => o.ok && JSON.stringify([o.item, o.roll]))).size).toBe(1);
    expect(items()).toBe(4);
    await openCrate(sql, a.id, "beta-001", {}, T0 + 7);
    await openCrate(sql, a.id, "beta-001", {}, T0 + 7);
    expect(items()).toBe(6);
    expect(await ledgerMismatches(sql, a.id)).toEqual([]);
  });

  it("an open raced at each step (A held just before, or just after, its transaction while B runs whole): one grant, and every answer is the stored item, byte for byte", async () => {
    const { sql, db } = await world();
    const a = await signedIn(sql, "a@example.com", T0);
    const me = (await ledgerAccount(sql, a.id))!;
    await grantTestItems(sql, a.id, { boss: "tiger", tokens: 6 }, T0);
    for (const n of [1, 2]) expect((await buyBossCrate(sql, a.id, tiger.id, "tokens", T0 + n, false, R(80 + n))).ok).toBe(true);
    // Each attempt rolls from its own seed, each a two-color item (whose roll once came back in another key order), so an answer that
    // is an attempt's own roll, or the stored item in another shape, shows.
    const twoColor = (crate: CrateDef, n: number) => {
      const out: number[] = [];
      for (let s = 1; out.length < n; s++) if (itemDef(rollCrate(mulberry32(s), crate).def)?.colors === 2) out.push(s);
      return out;
    };
    const freeSeeds = twoColor(crateDef("beta-001")!, 3);
    const bossSeeds = twoColor(tiger, 3);
    let seeds: number[] = [];
    const real = crypto.getRandomValues.bind(crypto);
    const spy = vi.spyOn(crypto, "getRandomValues").mockImplementation(<T extends ArrayBufferView | null>(arr: T): T => {
      if (arr instanceof Uint32Array && arr.length === 1 && seeds.length) arr[0] = seeds.shift()!;
      else real(arr as never);
      return arr;
    });
    /** `sql` with A's transaction held, just before it runs or just after it commits, until released. */
    const holding = (at: "before" | "after") => {
      let reached!: () => void;
      let release!: () => void;
      const there = new Promise<void>((r) => (reached = r));
      const go = new Promise<void>((r) => (release = r));
      const held: Sql = {
        ...sql,
        async batch(list) {
          if (at === "after") await sql.batch(list);
          reached();
          await go;
          if (at === "before") await sql.batch(list);
        },
      };
      return { held, there, release };
    };
    type Open = { ok: true; roll: unknown; item: { id: string } } | { ok: false; message: string };
    const race = async (open: (s: Sql) => Promise<Open>, at: "before" | "after") => {
      const h = holding(at);
      const first = open(h.held);
      await h.there;
      const second = await open(sql);
      h.release();
      return [await first, second, await open(sql)];
    };
    const stored = (op: string) =>
      db.prepare("SELECT i.id, i.def FROM ledger l JOIN items i ON i.id = l.asset_id WHERE l.op_id = ? AND l.asset_kind = 'item'").all(op) as { id: string; def: string }[];
    try {
      let n = 90;
      for (const at of ["before", "after"] as const) {
        for (const boss of [false, true]) {
          const req = R(++n);
          seeds = [...(boss ? bossSeeds : freeSeeds)];
          const op = `open:${me.account}:${req}`;
          const what = `${boss ? "boss" : "free"} crate, A held ${at} its transaction`;
          const open = (s: Sql) => (boss ? openBossCrate(s, a.id, tiger.id, T0 + n, false, req) : openCrate(s, a.id, "beta-001", {}, T0 + n, false, req));
          const answers = await race(open, at);
          const [item, ...more] = stored(op);
          expect([itemDef(item!.def)?.colors, more.length], what).toEqual([2, 0]);
          expect(answers.map((o) => o.ok && o.item.id), what).toEqual([item!.id, item!.id, item!.id]);
          expect(new Set(answers.map((o) => o.ok && JSON.stringify([o.item, o.roll]))).size, what).toBe(1);
          expect(count(db, "SELECT COUNT(DISTINCT nonce) AS n FROM ledger WHERE op_id = ?", op), what).toBe(1);
          expect(legsOf(db, op).map((l) => [l.asset_kind, l.delta]), what).toEqual(boss ? [["boss_crate", -1], ["item", 1]] : [["item", 1]]);
        }
      }
    } finally {
      spy.mockRestore();
    }
    expect([count(db, "SELECT COUNT(*) AS n FROM items WHERE user_id = ?", a.id), count(db, "SELECT COUNT(*) AS n FROM boss_crates WHERE user_id = ?", a.id)]).toEqual([4, 0]);
    expect(await ledgerMismatches(sql, a.id)).toEqual([]);
  });

  it("Squads' reward (squads:<code>:<created>:<ledger id>) and an online drop (drop:<code>:<match start>:<ledger id>), each written again", async () => {
    const { sql, db } = await world();
    const a = await signedIn(sql, "a@example.com", T0);
    const reward = (key = opKeys.squadsReward("SQUAD", T0)) => grantReward(sql, a.id, 100, 1, key, T0 + 1);
    expect([await reward(), ...(await Promise.all([reward(), reward()]))].sort()).toEqual(["applied", "replay", "replay"]);
    expect(db.prepare("SELECT coins, crates FROM wallets WHERE user_id = ?").get(a.id)).toEqual({ coins: 100, crates: 1 });
    // The same code's next lobby (made later): its own reward.
    expect(await reward(opKeys.squadsReward("SQUAD", T0 + 1))).toBe("applied");
    expect(db.prepare("SELECT coins, crates FROM wallets WHERE user_id = ?").get(a.id)).toEqual({ coins: 200, crates: 2 });
    // An online drop, counted again and twice at once (every roll lucky: the window would take three): one token, the same boss.
    const lucky = () => () => 0.01;
    const drop = (start: number) => countBossBattle(sql, a.id, T0 + 2, { battle: "RAIDS", op: opKeys.onlineDrop("RAIDS", start), rng: lucky() });
    const bosses = [await drop(T0), ...(await Promise.all([drop(T0), drop(T0)]))];
    expect(new Set(bosses).size).toBe(1);
    expect(count(db, "SELECT SUM(n) AS n FROM boss_tokens WHERE user_id = ?", a.id)).toBe(1);
    // The code's next match (its own start): its own drop.
    expect(await drop(T0 + 1)).toBeTruthy();
    expect(count(db, "SELECT SUM(n) AS n FROM boss_tokens WHERE user_id = ?", a.id)).toBe(2);
    expect(count(db, "SELECT COUNT(*) AS n FROM boss_token_drops WHERE user_id = ?", a.id)).toBe(2);
    expect(await ledgerMismatches(sql, a.id)).toEqual([]);
  });

  it("the claw's op (clawOp, claw.ts's): a token in, its crate on a win, once per request id; none to spend, refused", async () => {
    const { sql, db } = await world();
    const a = await signedIn(sql, "a@example.com", T0);
    const me = (await ledgerAccount(sql, a.id))!;
    await grantTestItems(sql, a.id, { boss: "tiger", tokens: 2 }, T0);
    const play = (request: string, won: boolean) => applyOp(sql, me, clawOp(me, { request, boss: "tiger", crate: tiger.id, won, crateRow: `row-${request}`, now: T0 + 1 }));
    expect(await play("claw-aaaaaaaa", true)).toBe("applied");
    expect(await play("claw-aaaaaaaa", true)).toBe("replay");
    expect(await play("claw-bbbbbbbb", false)).toBe("applied");
    expect(await play("claw-cccccccc", true)).toBe("refused");
    expect(count(db, "SELECT n FROM boss_tokens WHERE user_id = ? AND boss = 'tiger'", a.id)).toBe(0);
    expect(count(db, "SELECT COUNT(*) AS n FROM boss_crates WHERE user_id = ?", a.id)).toBe(1);
    expect(legsOf(db, "claw:").map((l) => [l.asset_kind, l.delta])).toEqual([
      ["token", -1],
      ["boss_crate", 1],
      ["token", -1],
    ]);
    expect(await ledgerMismatches(sql, a.id)).toEqual([]);
  });
});

describe("the backfill (backfill:v1:<ledger id>:<kind>:<asset>) and the daily check", () => {
  it("records what each account held before the ledger; run again, or after live ops, it adds nothing; the daily check finds who disagrees", async () => {
    const { sql, db } = await world();
    const a = await signedIn(sql, "a@example.com", T0);
    // (A guest from before the ledger: no ledger id yet.)
    const old = (await createGuest(sql, T0, "Old")).user;
    const other = tokenBosses().find((b) => b.id !== "tiger")!.id;
    // Balances from before the ledger, written as the old code did, straight into the tables.
    db.prepare("INSERT INTO wallets (user_id, coins, crates, crate_keys) VALUES (?, 500, 2, 1)").run(a.id);
    db.prepare("INSERT INTO boss_tokens (user_id, boss, n) VALUES (?, 'tiger', 4)").run(a.id);
    db.prepare("INSERT INTO inventory (user_id, item_id, acquired_at) VALUES (?, 'king-storm', ?)").run(a.id, T0);
    db.prepare("INSERT INTO items (id, user_id, def, color, blemish, seed, crate, created_at) VALUES ('old-item', ?, 'pirate-hat', 'red', 10, 1, 'beta-001', ?)").run(a.id, T0);
    db.prepare("INSERT INTO boss_crates (id, user_id, crate, bought_at) VALUES ('old-crate', ?, ?, ?)").run(a.id, tiger.id, T0);
    db.prepare("INSERT INTO welcome_crates (user_id, milestone, granted_at, games) VALUES (?, 5, ?, 5)").run(a.id, T0);
    db.prepare("INSERT INTO wallets (user_id, coins) VALUES (?, 70)").run(old.id);
    // And a ledger leg whose balance went outside it (granted, then the row deleted by hand): the ledger holds one more.
    await grantTestItems(sql, a.id, { boss: other, tokens: 1 }, T0);
    db.prepare("DELETE FROM boss_tokens WHERE user_id = ? AND boss = ?").run(a.id, other);
    expect((await ledgerCheck(sql, 10)).map((d) => [d.user, d.account !== null]).sort()).toEqual(
      [
        [a.id, true],
        [old.id, false],
      ].sort(),
    );
    // Once: a leg per account and asset (a's nine, the old guest's coins), and both agree.
    expect(await backfillLedger(sql, T0 + 1)).toBe(10);
    const oldId = (await ledgerAccount(sql, old.id))!.account;
    expect(legsOf(db, `backfill:v1:${oldId}:`)).toEqual([{ leg: 0, asset_kind: "coins", asset_id: "", delta: 70 }]);
    expect(db.prepare("SELECT delta FROM ledger WHERE reason = 'backfill' AND asset_kind = 'token' AND asset_id = ?").all(other)).toEqual([{ delta: -1 }]);
    for (const u of [a, old]) expect(await ledgerMismatches(sql, u.id)).toEqual([]);
    expect(await ledgerCheck(sql, 10)).toEqual([]);
    // Twice is once.
    const ledger = () => db.prepare("SELECT * FROM ledger ORDER BY op_id, leg").all();
    const once = ledger();
    expect(await backfillLedger(sql, T0 + 2)).toBe(0);
    expect(ledger()).toEqual(once);
    // Live ops since (through the ledger): a backfill again adds nothing, and every account still agrees.
    const paid = SHOP_ITEMS.find((i) => !i.starter && i.price > 0 && i.price <= 500 && i.id !== "king-storm")!;
    expect((await buyItem(sql, a.id, paid.id, T0 + 3)).ok).toBe(true);
    expect((await buyBossCrate(sql, a.id, tiger.id, "tokens", T0 + 3, false, "req-backfill-1")).ok).toBe(true);
    expect((await openBossCrate(sql, a.id, tiger.id, T0 + 3, false, "req-backfill-2")).ok).toBe(true);
    await grantReward(sql, old.id, 10, 0, opKeys.squadsReward("SQUAD", T0), T0 + 3);
    expect(await backfillLedger(sql, T0 + 4)).toBe(0);
    for (const u of [a, old]) expect(await ledgerMismatches(sql, u.id)).toEqual([]);
    expect(await ledgerCheck(sql, 10)).toEqual([]);
    // A balance changed outside the ledger since: the daily check finds it; a backfill again adds nothing (that key is used).
    db.prepare("UPDATE wallets SET coins = coins + 5 WHERE user_id = ?").run(a.id);
    const aId = (await ledgerAccount(sql, a.id))!.account;
    expect(await ledgerCheck(sql, 10)).toEqual([{ user: a.id, account: aId, mismatches: [{ kind: "coins", asset: "", diff: 5 }] }]);
    expect(await backfillLedger(sql, T0 + 5)).toBe(0);
  });

  it("the daily check runs in the schedule's first run of its hour; the backfill route is an admin's POST from the site itself", async () => {
    const day = Date.UTC(2026, 10, 6) + OPS.ledgerCheck.hourUtc * 3_600_000;
    expect([day, day + 14 * MIN, day + 15 * MIN, day - 15 * MIN, day + DAY].map(ledgerCheckDue)).toEqual([true, true, false, false, true]);
    const { sql, db, d1 } = memoryDb();
    await ensureSchema(sql);
    const admin = await signedIn(sql, "admin@example.com", T0);
    const other = await signedIn(sql, "b@example.com", T0);
    db.prepare("INSERT INTO wallets (user_id, coins) VALUES (?, 30)").run(other.id);
    const env = { DB: d1, ADMIN_EMAILS: "admin@example.com" };
    const call = async (u: User, init: { method?: string; origin?: string } = {}) =>
      (await handleOpsAdmin(
        new Request("https://hunchess.test/api/admin/ledger/backfill", {
          method: init.method ?? "POST",
          headers: { cookie: `hc_session=${await createSession(sql, u.id, Date.now())}`, origin: init.origin ?? "https://hunchess.test" },
        }),
        env as never,
      ))!;
    expect((await call(other)).status).toBe(404);
    expect((await call(admin, { origin: "https://elsewhere.test" })).status).toBe(404);
    expect((await call(admin, { method: "GET" })).status).toBe(404);
    expect(await (await call(admin)).json()).toEqual({ legs: 1, disagree: 0 });
    expect(await (await call(admin)).json()).toEqual({ legs: 0, disagree: 0 });
  });
});

describe("reconciliation: each balance is its ledger's sum", () => {
  it("over 500 random ops by three accounts, with guests signing in to them and accounts deleted, never below zero", { timeout: 120_000 }, async () => {
    const { sql, db } = await world();
    const rand = mulberry32(20261106);
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
    let now = T0;
    let n = 0;
    const people: User[] = [];
    const guests: User[] = [];
    const lastDrop = new Map<string, string>();
    const person = async () => signedIn(sql, `p${n++}@example.com`, now);
    for (let i = 0; i < 3; i++) people.push(await person());
    const paid = SHOP_ITEMS.filter((i) => !i.starter && i.price > 0).map((i) => i.id);
    const itemsOf = (id: string) => (db.prepare("SELECT id FROM items WHERE user_id = ?").all(id) as { id: string }[]).map((r) => r.id);
    // (Part II's request ids, sometimes sent again: a retry.)
    const lastRequest = new Map<string, string>();
    const request = (u: User) => {
      const r = rand() < 0.3 && lastRequest.get(u.id) ? lastRequest.get(u.id)! : `req-${u.id}-${n++}`;
      lastRequest.set(u.id, r);
      return r;
    };
    /** What anyone (a person or a guest) can do. */
    const anyone: ((u: User) => Promise<unknown>)[] = [
      (u) => giveCoins(sql, u.id, 100 + Math.floor(rand() * 600), now),
      (u) => buyItem(sql, u.id, pick(paid), now),
      (u) => {
        // A solo battle's drop, sometimes the same battle counted again.
        const op = rand() < 0.3 && lastDrop.get(u.id) ? lastDrop.get(u.id)! : `drop:solo:${u.id}:${n++}`;
        lastDrop.set(u.id, op);
        return countBossBattle(sql, u.id, now, { battle: op.slice(-18), op, rng: rand });
      },
      (u) => grantTestItems(sql, u.id, { keys: Math.floor(rand() * 3), boss: "tiger", tokens: Math.floor(rand() * 4), ...(rand() < 0.5 ? { request: request(u) } : {}) }, now),
      (u) => buyBossCrate(sql, u.id, tiger.id, pick(["tokens", "key"]), now, false, rand() < 0.5 ? request(u) : null),
      (u) => openBossCrate(sql, u.id, tiger.id, now, false, rand() < 0.5 ? request(u) : null),
      (u) => openCrate(sql, u.id, "beta-001", {}, now, false, rand() < 0.5 ? request(u) : null),
      // A Squads reward, sometimes written again (a lobby retrying it).
      (u) => grantReward(sql, u.id, Math.floor(rand() * 100), rand() < 0.3 ? 1 : 0, opKeys.squadsReward("SQUAD", rand() < 0.3 ? T0 : now), now),
      (u) => deleteLockerItems(sql, u.id, itemsOf(u.id).filter(() => rand() < 0.4), false, now).catch(() => null),
    ];
    /** What only a signed-in person does (a guest earns no Welcome Crate; ranked is two people). */
    const signedInOnly: ((u: User) => Promise<unknown>)[] = [
      async (u) => {
        await recordResult(sql, u.id, { mode: "classic", online: false, placement: 1, players: 8 }, now);
        return grantWelcomeCrate(sql, u.id, now);
      },
      (u) => openWelcomeCrate(sql, u.id, now, rand),
      (u) => {
        const other = pick(people.filter((p) => p.id !== u.id));
        return recordDuel(sql, duel(u.id, other.id, pick(["1-0", "0-1", "1/2-1/2"] as const), now), notHeld);
      },
    ];
    for (let step = 0; step < 500; step++) {
      now += Math.floor(rand() * 20 * MIN) + (rand() < 0.05 ? DAY : 0);
      const r = rand();
      if (r < 0.05) guests.push((await createGuest(sql, now, "Guest")).user);
      else if (r < 0.08 && guests.length) {
        // A guest signs in to a person's account: its things join it.
        const g = guests.splice(Math.floor(rand() * guests.length), 1)[0]!;
        await signInWithIdentity(sql, g, "email", pick(people).email!, {}, now);
      } else if (r < 0.1) {
        // A person deletes their account; someone new comes.
        const i = Math.floor(rand() * people.length);
        await deleteAccount(sql, people[i]!, now);
        people[i] = await person();
      } else if (r < 0.3 && guests.length) await pick(anyone)(pick(guests));
      else {
        const u = pick(people);
        await pick(rand() < 0.3 ? signedInOnly : anyone)(u);
      }
      for (const u of [...people, ...guests]) expect(await ledgerMismatches(sql, u.id), `step ${step}: ${u.id}`).toEqual([]);
      expect(orphans(db), `step ${step}`).toEqual([]);
      expect(db.prepare("SELECT COUNT(*) AS n FROM wallets WHERE coins < 0 OR crates < 0 OR crate_keys < 0").get(), `step ${step}`).toEqual({ n: 0 });
    }
    // Every path moved to the ledger ran (and applied) along the way.
    const reasons = (db.prepare("SELECT DISTINCT reason FROM ledger ORDER BY reason").all() as { reason: string }[]).map((r) => r.reason);
    expect(reasons).toEqual(
      expect.arrayContaining(["admin grant", "boss crate (key)", "boss crate (tokens)", "boss crate open", "crate open", "delete", "drop", "erase", "merge", "ranked", "reward", "shop", "welcome", "welcome open"]),
    );
  });

  it("the download has the account's ledger; once it's deleted, its rows stay and add up to nothing, naming nobody", async () => {
    const { sql, db } = await world();
    const a = await signedIn(sql, "a@example.com", T0);
    await giveCoins(sql, a.id, 500, T0);
    expect((await buyItem(sql, a.id, "king-storm", T0 + 1)).ok).toBe(true);
    await grantTestItems(sql, a.id, { keys: 2, boss: "tiger", tokens: 1 }, T0 + 2);
    const d = (await accountDownload(sql, a, T0 + 3)) as { ledger: { changes: { asset_kind: string; delta: number; reason: string }[] } };
    expect(d.ledger.changes.map((c) => [c.asset_kind, c.delta, c.reason])).toEqual([
      ["coins", 500, "test"],
      ["shop", 1, "shop"],
      ["coins", -400, "shop"],
      ["keys", 2, "admin grant"],
      ["token", 1, "admin grant"],
    ]);
    const rows = db.prepare("SELECT COUNT(*) AS n FROM ledger").get() as { n: number };
    await deleteAccount(sql, a, T0 + 4);
    // Closed: four balances, a leg each.
    expect(db.prepare("SELECT COUNT(*) AS n FROM ledger").get()).toEqual({ n: rows.n + 4 });
    expect(orphans(db)).toEqual([]);
    expect(JSON.stringify(db.prepare("SELECT * FROM ledger").all())).not.toContain(a.id);
    expect(db.prepare("SELECT COUNT(*) AS n FROM ledger_accounts").get()).toEqual({ n: 0 });
  });
});

/** The balance tables: only ledger.ts writes them. */
const BALANCE_TABLES = ["wallets", "inventory", "items", "boss_tokens", "boss_crates", "welcome_crates"];
const WRITE = new RegExp(`\\b(?:INSERT(?:\\s+OR\\s+\\w+)?\\s+INTO|UPDATE|DELETE\\s+FROM|REPLACE\\s+INTO)\\s+(${BALANCE_TABLES.join("|")})\\b`, "g");
/** Writes to them elsewhere, each with why: none is a balance. (Part II moved the last paths, grantReward and openCrate.) */
const NOT_YET: Record<string, Record<string, { n: number; why: string }>> = {
  "welcome.ts": { welcome_crates: { n: 1, why: "not a balance: the notice closed (seen_at)" } },
};
/** Files that once wrote balances themselves, and what they write through now. The guard fails if one does again. */
const MOVED: Record<string, string> = {
  "claw.ts": "Boingo's claw: its playClaw's token and crate writes go through ledger.ts's clawOp, its claw_plays row as the op's `log`",
};
const SRC = join(dirname(fileURLToPath(import.meta.url)), "../src");
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? sources(join(dir, f)) : f.endsWith(".ts") ? [join(dir, f)] : []));

describe("the static guard", () => {
  it("no write to a balance table outside ledger.ts (the claw's included); none to the ledger but INSERT, anywhere", () => {
    const found: Record<string, Record<string, number>> = {};
    for (const f of sources(SRC)) {
      const name = f.slice(SRC.length + 1);
      const text = readFileSync(f, "utf8");
      expect(text.match(/\b(?:UPDATE|DELETE\s+FROM|REPLACE\s+INTO|INSERT\s+OR\s+REPLACE\s+INTO)\s+ledger\b/g), `${name}: the ledger is append-only`).toBeNull();
      if (name === "ledger.ts") continue;
      for (const m of text.matchAll(WRITE)) ((found[name] ??= {})[m[1]!] ??= 0), found[name]![m[1]!]!++;
      // (A write to a table named by a list, `DELETE FROM ${t}`: no balance table in that list.)
      for (const line of text.split("\n").filter((l) => /(?:INSERT INTO|UPDATE|DELETE FROM) \$\{/.test(l))) {
        for (const t of BALANCE_TABLES) expect(line.includes(`"${t}"`), `${name}: ${line.trim()}`).toBe(false);
      }
    }
    for (const [f, todo] of Object.entries(MOVED)) expect(found[f], `${f} writes balances itself. TODO: ${todo}`).toBeUndefined();
    const allowed = Object.fromEntries(Object.entries(NOT_YET).map(([f, ts]) => [f, Object.fromEntries(Object.entries(ts).map(([t, v]) => [t, v.n]))]));
    expect(found, "a balance changes only through ledger.ts").toEqual(allowed);
    // (The guard sees ledger.ts's own writes, so it would see one anywhere.)
    const own = new Set([...readFileSync(join(SRC, "ledger.ts"), "utf8").matchAll(WRITE)].map((m) => m[1]));
    expect([...own].sort()).toEqual([...BALANCE_TABLES].sort());
  });
});
