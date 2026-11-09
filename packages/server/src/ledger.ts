import { OPS, type CrateRoll } from "@chessroyale/core";
import type { Sql, Stmt } from "./accounts.ts";

/**
 * The ledger (docs/decisions/2026-11-06-ledger.md; the audit of Nov 6, §1): every change to a balance or an inventory, one row per
 * leg, append-only. This is the only module that writes a balance table (wallets, boss_tokens, inventory, items, boss_crates,
 * welcome_crates): each change goes in with its ledger rows in one batch (one transaction), so the two never disagree. The balance
 * tables stay the fast read and keep their checks; the ledger is the history beside them (`ledger.test.ts` reconciles the two and
 * guards that nothing else writes them; the paths not moved here yet are listed there, for part II).
 *
 * An op is one event (a buy, a drop, an open), keyed by `op_id`: the same op applied twice applies once. Its first leg goes in only
 * if the op's guard holds (`when`: it can pay, it's earned) and the op isn't there yet; every other leg and every balance write go in
 * only if that first leg is this attempt's (its nonce). So a replay or a race changes nothing the second time, and a refused op
 * writes nothing. The ledger names no player: each account has a random ledger id (`ledger_accounts`), dropped when the account is
 * deleted or merged, so its rows stay but name nobody (as deleted results do). (Only types come from accounts.ts: it imports this
 * file's schema while it loads.)
 */
export const LEDGER_SCHEMA = [
  // Each account's ledger id (random). Only the account's own row links the ledger to it.
  `CREATE TABLE IF NOT EXISTS ledger_accounts (
    user_id TEXT PRIMARY KEY,
    account TEXT NOT NULL UNIQUE
  )`,
  // One row per leg: `asset_kind` coins | crates | keys | xp | token | shop | item | boss_crate | welcome, `asset_id` which one (a boss,
  // a shop item, an item's id, a boss crate's kind, a Welcome Crate's milestone; '' for coins, crates, keys and XP), `source_id` where it
  // came from (a game, a battle, a crate). Never updated or deleted (the triggers below).
  `CREATE TABLE IF NOT EXISTS ledger (
    op_id TEXT NOT NULL,
    leg INTEGER NOT NULL,
    account TEXT NOT NULL,
    asset_kind TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    delta INTEGER NOT NULL CHECK (delta <> 0),
    reason TEXT NOT NULL,
    source_id TEXT,
    created_at INTEGER NOT NULL,
    nonce TEXT NOT NULL,
    PRIMARY KEY (op_id, leg)
  )`,
  `CREATE INDEX IF NOT EXISTS ledger_account ON ledger (account, asset_kind, asset_id)`,
];

/** Append-only in the database too: an UPDATE or a DELETE on the ledger is refused (a second lock beside the code's). */
export const LEDGER_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT, 'the ledger is append-only'); END`,
  `CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT, 'the ledger is append-only'); END`,
];

export type AssetKind = "coins" | "crates" | "keys" | "xp" | "token" | "shop" | "item" | "boss_crate" | "welcome";

/** A condition in SQL with its parameters. */
export interface Cond {
  sql: string;
  params: unknown[];
}
export const cond = (sql: string, ...params: unknown[]): Cond => ({ sql, params });
const stmt = (sql: string, ...params: unknown[]): Stmt => ({ sql, params });
const newId = (bytes = 12) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
const COLS = "op_id, leg, account, asset_kind, asset_id, delta, reason, source_id, created_at, nonce";

/** An account and its ledger id. */
export interface LedgerAccount {
  user: string;
  account: string;
}

/** An account's ledger id, made the first time it's needed. Null: no such account (deleted, or merged into another). */
export async function ledgerAccount(sql: Sql, userId: string): Promise<LedgerAccount | null> {
  const read = async () => (await sql.first<{ account: string }>("SELECT account FROM ledger_accounts WHERE user_id = ?", userId))?.account;
  const account =
    (await read()) ??
    (
      await sql.first<{ account: string }>(
        "INSERT INTO ledger_accounts (user_id, account) SELECT ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?) ON CONFLICT (user_id) DO NOTHING RETURNING account",
        userId,
        newId(),
        userId,
      )
    )?.account ??
    (await read());
  return account ? { user: userId, account } : null;
}

/** The app's id for one action (a boss crate's buy, an open, an admin's grant, a claw play): 8 to 64 letters, digits, "-" or "_". */
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
/** An action's request id (account.ts makes one per tap, and a retry sends it again), or null: none, or not one (an older app). */
export const requestId = (x: unknown): string | null => (typeof x === "string" && REQUEST_ID.test(x) ? x : null);

/** An op's key, or how to make it from the account's ledger id (a key that names an account names it by that, never by its user id). */
export type OpKey = string | ((ledgerId: string) => string);
export const keyFor = (k: OpKey, a: LedgerAccount): string => (typeof k === "string" ? k : k(a.account));
/** The keys that name an account (the audit of Nov 6, §1). */
export const opKeys = {
  /** An online boss battle's token drop: its lobby's code and when its match began (a code is used again once its lobby closes). */
  onlineDrop: (code: string, startedAt: number): OpKey => (a) => `drop:${code}:${startedAt}:${a}`,
  /** A Squads placement reward: its lobby's code and when that lobby was made. */
  squadsReward: (code: string, createdAt: number): OpKey => (a) => `squads:${code}:${createdAt}:${a}`,
  /** An action the app sent with its request id: `boss-crate`, `open`, `grant`, `claw`. */
  request: (kind: string, request: string): OpKey => (a) => `${kind}:${a}:${request}`,
};

/** One leg of an op: its ledger row, and the balance write that goes with it (written only if the op applies: `ours`). */
export interface Leg {
  kind: AssetKind;
  asset: string;
  delta: number;
  source: string | null;
  writes(ours: Cond): Stmt[];
}

/** A wallet's column, or boss_tokens' count, moved by `delta` (an UPDATE for a spend: the op's guard has checked it's there). */
function countLeg(kind: AssetKind, asset: string, delta: number, source: string | null, add: (o: Cond) => Stmt, spend: (o: Cond) => Stmt): Leg {
  return { kind, asset, delta, source, writes: (o) => [delta > 0 ? add(o) : spend(o)] };
}
function walletLeg(kind: "coins" | "crates" | "keys" | "xp", user: string, delta: number, source: string | null): Leg {
  const col = kind === "keys" ? "crate_keys" : kind;
  return countLeg(
    kind,
    "",
    delta,
    source,
    (o) => stmt(`INSERT INTO wallets (user_id, ${col}) SELECT ?, ? WHERE ${o.sql} ON CONFLICT (user_id) DO UPDATE SET ${col} = ${col} + excluded.${col}`, user, delta, ...o.params),
    (o) => stmt(`UPDATE wallets SET ${col} = ${col} + ? WHERE user_id = ? AND ${o.sql}`, delta, user, ...o.params),
  );
}

/** A new item's row (an `items` row: its roll, the crate it came from). */
export type NewItem = Pick<CrateRoll, "def" | "color" | "color2" | "blemish" | "seed" | "fischer"> & { id: string };

/** The legs there are. Each says what changes and writes that change. */
export const leg = {
  coins: (user: string, delta: number, source: string | null = null) => walletLeg("coins", user, delta, source),
  crates: (user: string, delta: number, source: string | null = null) => walletLeg("crates", user, delta, source),
  keys: (user: string, delta: number, source: string | null = null) => walletLeg("keys", user, delta, source),
  /** XP (Nov 9; xp.ts): a game's, or a test's. The wallet's `xp` column. */
  xp: (user: string, delta: number, source: string | null = null) => walletLeg("xp", user, delta, source),
  tokens: (user: string, boss: string, delta: number, source: string | null = null) =>
    countLeg(
      "token",
      boss,
      delta,
      source,
      (o) => stmt(`INSERT INTO boss_tokens (user_id, boss, n) SELECT ?, ?, ? WHERE ${o.sql} ON CONFLICT (user_id, boss) DO UPDATE SET n = n + excluded.n`, user, boss, delta, ...o.params),
      (o) => stmt(`UPDATE boss_tokens SET n = n + ? WHERE user_id = ? AND boss = ? AND ${o.sql}`, delta, user, boss, ...o.params),
    ),
  /** A shop item got (the coin shop). */
  shopItem: (user: string, item: string, now: number): Leg => ({
    kind: "shop",
    asset: item,
    delta: 1,
    source: null,
    writes: (o) => [stmt(`INSERT INTO inventory (user_id, item_id, acquired_at) SELECT ?, ?, ? WHERE ${o.sql}`, user, item, now, ...o.params)],
  }),
  /** A crate item into the locker, from `crate`. */
  item: (user: string, it: NewItem, crate: string, now: number): Leg => ({
    kind: "item",
    asset: it.id,
    delta: 1,
    source: crate,
    writes: (o) => [
      stmt(
        `INSERT INTO items (id, user_id, def, color, color2, blemish, seed, crate, fischer, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${o.sql}`,
        it.id,
        user,
        it.def,
        it.color,
        it.color2 ?? null,
        it.blemish,
        it.seed,
        crate,
        it.fischer ? 1 : 0,
        now,
        ...o.params,
      ),
    ],
  }),
  /** A boss crate bought (row `id`), or opened (taken off). */
  bossCrateIn: (user: string, id: string, crate: string, now: number): Leg => ({
    kind: "boss_crate",
    asset: crate,
    delta: 1,
    source: id,
    writes: (o) => [stmt(`INSERT INTO boss_crates (id, user_id, crate, bought_at) SELECT ?, ?, ?, ? WHERE ${o.sql}`, id, user, crate, now, ...o.params)],
  }),
  bossCrateOut: (user: string, id: string, crate: string): Leg => ({
    kind: "boss_crate",
    asset: crate,
    delta: -1,
    source: id,
    writes: (o) => [stmt(`DELETE FROM boss_crates WHERE id = ? AND user_id = ? AND ${o.sql}`, id, user, ...o.params)],
  }),
  /** A Welcome Crate earned (`games`: the finished games, counted in the same statement), or opened (to `item`, the ride). */
  welcomeIn: (user: string, milestone: number, now: number, games: Cond): Leg => ({
    kind: "welcome",
    asset: String(milestone),
    delta: 1,
    source: null,
    writes: (o) => [
      stmt(`INSERT INTO welcome_crates (user_id, milestone, granted_at, games) SELECT ?, ?, ?, ${games.sql} WHERE ${o.sql}`, user, milestone, now, ...games.params, ...o.params),
    ],
  }),
  welcomeOut: (user: string, milestone: number, item: { id: string; def: string }, now: number): Leg => ({
    kind: "welcome",
    asset: String(milestone),
    delta: -1,
    source: item.id,
    writes: (o) => [
      stmt(
        `UPDATE welcome_crates SET opened_at = ?, item_id = ?, def = ? WHERE user_id = ? AND milestone = ? AND opened_at IS NULL AND ${o.sql}`,
        now,
        item.id,
        item.def,
        user,
        milestone,
        ...o.params,
      ),
    ],
  }),
};

/** One event: its key, why, its guard, its legs (one account's), and any rows that go with it that aren't balances. */
export interface Op {
  /** The idempotency key: an op with this key applies once, however often it's tried. */
  id: string;
  reason: string;
  now: number;
  /** What must hold for it to apply (it can pay, it's earned), checked as its first leg goes in, in the same transaction. */
  when?: Cond;
  legs: readonly Leg[];
  /** Rows that go with it that aren't balances (a drop's record), written only if it applies. */
  also?: (ours: Cond) => Stmt[];
}

/** What became of an op: this attempt applied it, an earlier one had (a replay: nothing changed now), or its guard refused it. */
export type Outcome = "applied" | "replay" | "refused";

/** An op's statements, for a batch (with `nonce`, this attempt's): used as they are by a caller with a batch of its own (ranked). */
export function opStatements(a: LedgerAccount, op: Op, nonce: string): Stmt[] {
  if (!op.legs.length || op.legs.some((l) => !Number.isInteger(l.delta) || l.delta === 0)) throw new Error(`ledger: op ${op.id} needs legs of whole, non-zero amounts`);
  const ours = cond("EXISTS (SELECT 1 FROM ledger WHERE op_id = ? AND leg = 0 AND nonce = ?)", op.id, nonce);
  const row = (l: Leg, i: number) => [op.id, i, a.account, l.kind, l.asset, l.delta, op.reason, l.source, op.now, nonce];
  const [first, ...rest] = op.legs;
  return [
    stmt(
      `INSERT INTO ledger (${COLS}) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM ledger_accounts WHERE user_id = ? AND account = ?) AND (${op.when?.sql ?? "1"})
       ON CONFLICT (op_id, leg) DO NOTHING`,
      ...row(first!, 0),
      a.user,
      a.account,
      ...(op.when?.params ?? []),
    ),
    ...rest.map((l, i) => stmt(`INSERT INTO ledger (${COLS}) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${ours.sql}`, ...row(l, i + 1), ...ours.params)),
    ...op.legs.flatMap((l) => l.writes(ours)),
    ...(op.also?.(ours) ?? []),
  ];
}

/** Whether attempt `nonce` applied op `opId`. */
export async function opOutcome(sql: Sql, opId: string, nonce: string): Promise<Outcome> {
  const row = await sql.first<{ nonce: string }>("SELECT nonce FROM ledger WHERE op_id = ? AND leg = 0", opId);
  return !row ? "refused" : row.nonce === nonce ? "applied" : "replay";
}

/** Applies an op in one batch (one transaction). */
export async function applyOp(sql: Sql, a: LedgerAccount, op: Op): Promise<Outcome> {
  const nonce = newId(9);
  await sql.batch(opStatements(a, op, nonce));
  return opOutcome(sql, op.id, nonce);
}

/** An op's first leg as stored (a replay answers what the first attempt did, e.g. which boss's token dropped). */
export const firstLeg = (sql: Sql, opId: string) => sql.first<{ asset_kind: string; asset_id: string; delta: number }>("SELECT asset_kind, asset_id, delta FROM ledger WHERE op_id = ? AND leg = 0", opId);

/**
 * Deletes items you own, for good (the locker's hold-to-delete): op `delete:<item id>` each, in one batch, whatever the count (the ids
 * go in as one JSON list). An id that isn't yours, or is gone already, writes nothing. Taken off first if worn.
 */
export async function deleteItems(sql: Sql, a: LedgerAccount, ids: readonly string[], now: number): Promise<void> {
  const nonce = newId(9);
  const ours = (col: string) => `EXISTS (SELECT 1 FROM ledger WHERE op_id = 'delete:' || ${col} AND leg = 0 AND nonce = ?)`;
  await sql.batch([
    stmt(
      `INSERT INTO ledger (${COLS})
       SELECT 'delete:' || id, 0, ?, 'item', id, -1, 'delete', crate, ?, ? FROM items
       WHERE user_id = ? AND id IN (SELECT value FROM json_each(?)) AND EXISTS (SELECT 1 FROM ledger_accounts WHERE user_id = ? AND account = ?)
       ON CONFLICT (op_id, leg) DO NOTHING`,
      a.account,
      now,
      nonce,
      a.user,
      JSON.stringify(ids),
      a.user,
      a.account,
    ),
    stmt(`DELETE FROM equipped_items WHERE user_id = ? AND ${ours("equipped_items.item_id")}`, a.user, nonce),
    stmt(`DELETE FROM items WHERE user_id = ? AND ${ours("items.id")}`, a.user, nonce),
  ]);
}

/**
 * Every balance there is, each table's as rows (user_id, asset, n) of one kind: what the ledger's sums must equal. (A boss crate counts
 * by its kind; a Welcome Crate while it's unopened.) One SELECT each: D1 refuses a compound SELECT of more than a few terms, so a
 * statement reads one of these at a time.
 */
const HOLDINGS: readonly { kind: AssetKind; rows: string }[] = [
  { kind: "coins", rows: "SELECT user_id, '' AS asset, coins AS n FROM wallets" },
  { kind: "crates", rows: "SELECT user_id, '' AS asset, crates AS n FROM wallets" },
  { kind: "keys", rows: "SELECT user_id, '' AS asset, crate_keys AS n FROM wallets" },
  { kind: "xp", rows: "SELECT user_id, '' AS asset, xp AS n FROM wallets" },
  { kind: "token", rows: "SELECT user_id, boss AS asset, n FROM boss_tokens" },
  { kind: "shop", rows: "SELECT user_id, item_id AS asset, 1 AS n FROM inventory" },
  { kind: "item", rows: "SELECT user_id, id AS asset, 1 AS n FROM items" },
  { kind: "boss_crate", rows: "SELECT user_id, crate AS asset, COUNT(*) AS n FROM boss_crates GROUP BY user_id, crate" },
  { kind: "welcome", rows: "SELECT user_id, CAST(milestone AS TEXT) AS asset, 1 AS n FROM welcome_crates WHERE opened_at IS NULL" },
];
/** One account's balances (`?1`, its id), as rows (kind, asset, n), a table at a time. */
const BALANCES = HOLDINGS.map((h) => `SELECT '${h.kind}' AS kind, asset, n FROM (${h.rows}) WHERE user_id = ?1`);
/** What an account's ledger (`account`, its ledger id) holds of one asset. */
const ledgerSum = (account: string, kind: AssetKind, asset: string) =>
  `COALESCE((SELECT SUM(l.delta) FROM ledger l WHERE l.account = ${account} AND l.asset_kind = '${kind}' AND l.asset_id = ${asset}), 0)`;
/**
 * Each table's differences, every account's at once, as rows (user_id, account, asset, diff: the balance minus the ledger's sum):
 * the assets it holds a balance row of, and those its ledger holds that it has no balance row of. (An account with no ledger id yet:
 * `account` null, and its ledger holds nothing.)
 */
const differences = (h: (typeof HOLDINGS)[number]) => [
  `SELECT b.user_id, k.account, b.asset, b.n - ${ledgerSum("k.account", h.kind, "b.asset")} AS diff
   FROM (${h.rows}) b LEFT JOIN ledger_accounts k ON k.user_id = b.user_id WHERE b.user_id IN (SELECT id FROM users)`,
  `SELECT k.user_id, l.account, l.asset_id AS asset, -SUM(l.delta) AS diff FROM ledger l JOIN ledger_accounts k ON k.account = l.account
   WHERE l.asset_kind = '${h.kind}' AND NOT EXISTS (SELECT 1 FROM (${h.rows}) b WHERE b.user_id = k.user_id AND b.asset = l.asset_id)
   GROUP BY l.account, l.asset_id`,
];

/** Gives an account its ledger id in a batch, if it has none (only an account that exists). */
const ensureAccount = (userId: string) =>
  stmt("INSERT INTO ledger_accounts (user_id, account) SELECT ?1, ?2 WHERE EXISTS (SELECT 1 FROM users WHERE id = ?1) ON CONFLICT (user_id) DO NOTHING", userId, newId());

/**
 * A guest signing in to an account (accounts.ts, the sign-in's one batch): the guest's balances join the account, and the ledger
 * records each move (op `merge:<guest's ledger id>:<asset>`: a leg out of the guest, a leg into the account for what it really gains:
 * nothing for a shop item it has already, or for the guest's Welcome Crates, which are dropped: a guest never earns one). Coins,
 * crates, keys, XP and tokens are added up (XP: a guest earns none where sign-in is set up, so only XP from before then); items and boss crates move; then the guest's ledger id goes, so nothing names the guest.
 */
export function mergeMoves(from: string, to: string, now: number): Stmt[] {
  const nonce = newId(9);
  return [
    ensureAccount(from),
    ensureAccount(to),
    ...BALANCES.map((balance) =>
      stmt(
        `INSERT INTO ledger (${COLS})
         SELECT 'merge:' || g.account || ':' || b.kind || ':' || b.asset, l.leg, CASE l.leg WHEN 0 THEN g.account ELSE o.account END, b.kind, b.asset,
           CASE l.leg WHEN 0 THEN -b.n ELSE b.gets END, 'merge', NULL, ?3, ?4
         FROM (SELECT kind, asset, n, CASE WHEN kind = 'welcome' OR (kind = 'shop' AND EXISTS (SELECT 1 FROM inventory WHERE user_id = ?2 AND item_id = asset)) THEN 0 ELSE n END AS gets
               FROM (${balance})) b,
           (SELECT 0 AS leg UNION ALL SELECT 1) l,
           (SELECT account FROM ledger_accounts WHERE user_id = ?1) g,
           (SELECT account FROM ledger_accounts WHERE user_id = ?2) o
         WHERE b.n <> 0 AND (l.leg = 0 OR b.gets <> 0)`,
        from,
        to,
        now,
        nonce,
      ),
    ),
    stmt("INSERT OR IGNORE INTO inventory (user_id, item_id, acquired_at) SELECT ?, item_id, acquired_at FROM inventory WHERE user_id = ?", to, from),
    stmt(
      "INSERT INTO wallets (user_id, coins, crates, crate_keys, xp) SELECT ?, coins, crates, crate_keys, xp FROM wallets WHERE user_id = ? AND (coins > 0 OR crates > 0 OR crate_keys > 0 OR xp > 0) ON CONFLICT (user_id) DO UPDATE SET coins = coins + excluded.coins, crates = crates + excluded.crates, crate_keys = crate_keys + excluded.crate_keys, xp = xp + excluded.xp",
      to,
      from,
    ),
    stmt("UPDATE items SET user_id = ? WHERE user_id = ?", to, from),
    stmt(
      "INSERT INTO boss_tokens (user_id, boss, n) SELECT ?, boss, n FROM boss_tokens WHERE user_id = ? AND n > 0 ON CONFLICT (user_id, boss) DO UPDATE SET n = n + excluded.n",
      to,
      from,
    ),
    stmt("UPDATE boss_crates SET user_id = ? WHERE user_id = ?", to, from),
    ...["inventory", "wallets", "boss_tokens", "welcome_crates", "ledger_accounts"].map((t) => stmt(`DELETE FROM ${t} WHERE user_id = ?`, from)),
  ];
}

/**
 * Deleting an account (account-data.ts, its one batch): every balance it holds is closed in the ledger (op `erase:<ledger id>:<asset>`)
 * and its rows go; then its ledger id goes, so its ledger rows stay naming nobody.
 */
export function eraseMoves(userId: string, now: number): Stmt[] {
  const nonce = newId(9);
  return [
    ensureAccount(userId),
    ...BALANCES.map((balance) =>
      stmt(
        `INSERT INTO ledger (${COLS})
         SELECT 'erase:' || k.account || ':' || b.kind || ':' || b.asset, 0, k.account, b.kind, b.asset, -b.n, 'erase', NULL, ?2, ?3
         FROM (${balance}) b, (SELECT account FROM ledger_accounts WHERE user_id = ?1) k WHERE b.n <> 0`,
        userId,
        now,
        nonce,
      ),
    ),
    ...["wallets", "inventory", "items", "boss_tokens", "boss_crates", "welcome_crates", "ledger_accounts"].map((t) => stmt(`DELETE FROM ${t} WHERE user_id = ?`, userId)),
  ];
}

/** The account's part of "Download my data": every change the ledger holds for it. */
export const ledgerDownload = async (sql: Sql, userId: string) => ({
  changes: await sql.all(
    `SELECT l.asset_kind, l.asset_id, l.delta, l.reason, l.source_id, l.created_at FROM ledger l JOIN ledger_accounts a ON a.account = l.account
     WHERE a.user_id = ? ORDER BY l.created_at, l.op_id, l.leg`,
    userId,
  ),
});

/**
 * Where an account's balances and its ledger disagree: each asset whose balance isn't the sum of its ledger's legs, with the
 * difference (balance minus ledger). Empty: they agree. (Balances from before the ledger, and the paths not moved here yet, differ
 * until part II's backfill.)
 */
export async function ledgerMismatches(sql: Sql, userId: string): Promise<{ kind: string; asset: string; diff: number }[]> {
  const sums = new Map<string, { kind: string; asset: string; diff: number }>();
  const add = (r: { kind: string; asset: string; n: number }) => {
    const k = `${r.kind}\u0000${r.asset}`;
    sums.set(k, { kind: r.kind, asset: r.asset, diff: (sums.get(k)?.diff ?? 0) + r.n });
  };
  for (const balance of BALANCES) for (const r of await sql.all<{ kind: string; asset: string; n: number }>(balance, userId)) add(r);
  const legs = await sql.all<{ kind: string; asset: string; n: number }>(
    `SELECT l.asset_kind AS kind, l.asset_id AS asset, -SUM(l.delta) AS n FROM ledger l JOIN ledger_accounts a ON a.account = l.account
     WHERE a.user_id = ? GROUP BY l.asset_kind, l.asset_id`,
    userId,
  );
  for (const r of legs) add(r);
  return [...sums.values()].filter((s) => s.diff !== 0).sort((a, b) => a.kind.localeCompare(b.kind) || a.asset.localeCompare(b.asset));
}

/**
 * The backfill (part II; the audit of Nov 6, §1): what each account held before its changes went into the ledger. Per account and
 * asset, one leg of the balance minus the ledger's sum (reason `backfill`), keyed `backfill:v1:<ledger id>:<kind>:<asset>`, so a rerun
 * adds nothing, and the two agree from then on. One batch (one transaction), each difference worked out in the statement that writes
 * its leg, so an op landing meanwhile is counted once, before or after. Every account holding anything gets its ledger id first.
 * Answers how many legs it wrote. (The admins' POST /api/admin/ledger/backfill: ops-admin.ts.)
 */
export async function backfillLedger(sql: Sql, now: number): Promise<number> {
  const nonce = newId(9);
  const count = async () => (await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM ledger WHERE op_id >= 'backfill:' AND op_id < 'backfill;'"))?.n ?? 0;
  const before = await count();
  await sql.batch([
    ...HOLDINGS.map((h) =>
      stmt(
        `INSERT INTO ledger_accounts (user_id, account) SELECT user_id, lower(hex(randomblob(12))) FROM (SELECT DISTINCT user_id FROM (${h.rows}))
         WHERE user_id IN (SELECT id FROM users) ON CONFLICT (user_id) DO NOTHING`,
      ),
    ),
    ...HOLDINGS.flatMap((h) =>
      differences(h).map((diffs) =>
        stmt(
          `INSERT INTO ledger (${COLS})
           SELECT 'backfill:v1:' || d.account || ':${h.kind}:' || d.asset, 0, d.account, '${h.kind}', d.asset, d.diff, 'backfill', NULL, ?1, ?2
           FROM (${diffs}) d WHERE d.account IS NOT NULL AND d.diff <> 0
           ON CONFLICT (op_id, leg) DO NOTHING`,
          now,
          nonce,
        ),
      ),
    ),
  ]);
  return (await count()) - before;
}

/** The schedule's run at `t` (every 15 minutes) is the daily check's: the first in OPS.ledgerCheck.hourUtc. */
export function ledgerCheckDue(t: number): boolean {
  const d = new Date(t);
  return d.getUTCHours() === OPS.ledgerCheck.hourUtc && d.getUTCMinutes() < 15;
}

export interface Disagreement {
  user: string;
  /** Its ledger id (null: none yet, so its ledger holds nothing). */
  account: string | null;
  mismatches: { kind: string; asset: string; diff: number }[];
}
/**
 * The daily check (index.ts, the schedule): accounts whose balances and ledger disagree, found for every account at once (two
 * statements a table), then up to `limit` of them read in full (ledgerMismatches). Empty: they all agree.
 */
export async function ledgerCheck(sql: Sql, limit: number): Promise<Disagreement[]> {
  const users = new Map<string, string | null>();
  for (const h of HOLDINGS) {
    for (const diffs of differences(h)) {
      if (users.size >= limit) break;
      const rows = await sql.all<{ user_id: string; account: string | null }>(`SELECT DISTINCT user_id, account FROM (${diffs}) WHERE diff <> 0 LIMIT ?`, limit - users.size);
      for (const r of rows) users.set(r.user_id, r.account);
    }
  }
  const out: Disagreement[] = [];
  for (const [user, account] of users) out.push({ user, account, mismatches: await ledgerMismatches(sql, user) });
  return out.filter((r) => r.mismatches.length);
}

/**
 * Boingo's claw machine (claw.ts, playClaw: `applyOp(sql, me, clawOp(me, {...}))`, its claw_plays row as `log`).
 *
 * One play: a token of `boss` in (only when one is there), and on a win its crate in, unopened (`crateRow`: the new boss_crates row),
 * keyed by the app's id for the play (`claw:<ledger id>:<request>`: a retry or a double tap plays once); `log`, the play's own row,
 * goes in only if the play applies.
 */
export function clawOp(
  a: LedgerAccount,
  p: { request: string; boss: string; crate: string; won: boolean; crateRow: string; now: number; log?: (ours: Cond) => Stmt[] },
): Op {
  return {
    id: keyFor(opKeys.request("claw", p.request), a),
    reason: "claw",
    now: p.now,
    when: cond("EXISTS (SELECT 1 FROM boss_tokens WHERE user_id = ? AND boss = ? AND n >= 1)", a.user, p.boss),
    legs: [leg.tokens(a.user, p.boss, -1, p.request), ...(p.won ? [leg.bossCrateIn(a.user, p.crateRow, p.crate, p.now)] : [])],
    ...(p.log ? { also: p.log } : {}),
  };
}
