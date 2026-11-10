import { afterEach, describe, expect, it, vi } from "vitest";
import { d1Sql, ensureSchema, schemaParts, type Sql } from "../src/accounts.ts";
import { IDENTITIES_REKEY } from "../src/fairplay-schema.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * The schema run (ensureSchema) after a schema-changing deploy (Nov 10, docs/decisions/2026-11-10-schema-fast.md): one run per
 * Worker instance however many requests come at once, a few D1 round trips instead of one per statement, and the same
 * tables, columns, indexes, triggers and rows as the statements one at a time (before: 134 round trips for a fresh database, 97
 * for an upgrade by one column, and every request that came while it ran ran it again).
 */

type Db = ReturnType<typeof memoryDb>;
type Counts = { trips: number; statements: number };
type Fakes = { refuse?: (sql: string) => boolean; beforeBatch?: (sqls: string[]) => void };

/** A fake D1 over the in-memory SQLite that counts round trips (a statement on its own, or a batch) and statements. */
function countingD1(inner: D1Database, counts: Counts, fakes: Fakes = {}): D1Database {
  const check = (q: string) => {
    if (fakes.refuse?.(q)) throw new Error(`refused: ${q.slice(0, 60)}`);
  };
  type Wrapped = { inner: D1PreparedStatement; sql: string };
  const wrap = (q: string, s: D1PreparedStatement) =>
    ({
      inner: s,
      sql: q,
      bind: (...p: unknown[]) => wrap(q, s.bind(...p)),
      run: async () => (counts.trips++, counts.statements++, check(q), s.run()),
      first: async () => (counts.trips++, counts.statements++, check(q), s.first()),
      all: async () => (counts.trips++, counts.statements++, check(q), s.all()),
    }) as unknown as D1PreparedStatement;
  return {
    prepare: (q: string) => wrap(q, inner.prepare(q)),
    batch: async (list: D1PreparedStatement[]) => {
      const all = list as unknown as Wrapped[];
      counts.trips++;
      counts.statements += all.length;
      fakes.beforeBatch?.(all.map((s) => s.sql));
      // (One transaction: a refused statement leaves none of them done.)
      const now = (s: Wrapped) => (s.inner as unknown as { runNow(): unknown }).runNow();
      return inner.batch(all.map((s) => ({ runNow: () => (check(s.sql), now(s)) }) as unknown as D1PreparedStatement));
    },
  } as unknown as D1Database;
}

/** The SQL interface over a counting fake D1, as a request makes it (`d1Sql(env.DB)`). */
function counted(db: Db, fakes?: Fakes, counts: Counts = { trips: 0, statements: 0 }): { sql: Sql; counts: Counts } {
  return { sql: d1Sql(countingD1(db.d1, counts, fakes)), counts };
}

/** The schema one statement at a time, as before Nov 10: what the batched run must make. */
async function oneByOne(sql: Sql): Promise<void> {
  const { SCHEMA, LEDGER_TRIGGERS, COLUMNS, AFTER_COLUMNS, version } = schemaParts;
  for (const s of SCHEMA) await sql.run(s);
  for (const s of LEDGER_TRIGGERS) await sql.run(s);
  const owner = (await sql.all<{ name: string; pk: number }>("PRAGMA table_info(fairplay_identities)")).find((c) => c.name === "user_id");
  if (owner && !owner.pk) await sql.batch(IDENTITIES_REKEY);
  const have = new Map<string, Set<string>>();
  for (const c of COLUMNS) {
    if (!have.has(c.table)) have.set(c.table, new Set((await sql.all<{ name: string }>(`PRAGMA table_info(${c.table})`)).map((r) => r.name)));
    if (have.get(c.table)!.has(c.column)) continue;
    await sql.run(`ALTER TABLE ${c.table} ADD COLUMN ${c.column} ${c.type}`);
    for (const t of c.then ?? []) await sql.run(t);
  }
  for (const s of AFTER_COLUMNS) await sql.run(s);
  await sql.run("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  await sql.run("INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", version);
}

/** Every table, index and trigger, with its SQL. */
const schemaOf = (db: Db) => db.db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all();
const versionOf = (db: Db) =>
  db.db.prepare("SELECT name FROM sqlite_master WHERE name = 'meta'").get()
    ? (db.db.prepare("SELECT value FROM meta WHERE key = 'schema'").get() as { value: string } | undefined)?.value
    : undefined;

/** A database at the full schema. */
async function current(): Promise<Db> {
  const db = memoryDb();
  await oneByOne(db.sql);
  return db;
}

/** A database at the full schema less one column added since (an upgrade by one column), recorded at an older schema. */
async function lessOneColumn(): Promise<Db> {
  const db = await current();
  db.db.exec("ALTER TABLE quests DROP COLUMN rerolled_day; UPDATE meta SET value = 'older' WHERE key = 'schema'");
  return db;
}

/**
 * A database from before several columns and before fairplay_identities' key had the owner (Oct 16), with rows: the
 * columns' follow-ups (`then`) and the identities' rebuild (IDENTITIES_REKEY) run.
 */
async function older(): Promise<Db> {
  const db = await current();
  db.db.exec(`
    DROP INDEX users_rating;
    ALTER TABLE users DROP COLUMN rating;
    ALTER TABLE users DROP COLUMN chat_on;
    ALTER TABLE items DROP COLUMN color2;
    ALTER TABLE results DROP COLUMN xp_rewards;
    ALTER TABLE ranked_1v1 DROP COLUMN peak;
    DROP TABLE fairplay_identities;
    CREATE TABLE fairplay_identities (kind TEXT NOT NULL, hash TEXT NOT NULL, user_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (kind, hash));
    INSERT INTO fairplay_identities (kind, hash, user_id, at) VALUES ('email', 'h1', 'u1', 5);
    INSERT INTO users (id, name, created_at, last_seen) VALUES ('u1', 'Old', 1, 1);
    INSERT INTO results (user_id, mode, online, placement, players, rating, played_at) VALUES ('u1', 'crowd', 1, 3, 100, 1400, 10), ('u1', 'crowd', 1, 3, 100, 1720, 20);
    INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder) VALUES ('u1', 1500, 200, 3, 2, 1, 0, 42);
    UPDATE meta SET value = 'older' WHERE key = 'schema';
  `);
  return db;
}

const rowsOf = (db: Db) => ({
  users: db.db.prepare("SELECT id, rating, chat_on FROM users").all(),
  identities: db.db.prepare("SELECT kind, hash, user_id, at FROM fairplay_identities").all(),
  ranked: db.db.prepare("SELECT user_id, ladder, peak FROM ranked_1v1").all(),
  identitiesKey: db.db.prepare("SELECT name FROM pragma_table_info('fairplay_identities') WHERE pk > 0 ORDER BY pk").all(),
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the schema run's round trips", () => {
  it("a fresh database: the schema the statements one at a time made, in 4 round trips (134 before)", async () => {
    const want = memoryDb();
    await oneByOne(want.sql);
    const db = memoryDb();
    const { sql, counts } = counted(db);
    await ensureSchema(sql, {});
    expect(counts.trips).toBe(4);
    expect(schemaOf(db)).toEqual(schemaOf(want));
    expect(versionOf(db)).toBe(schemaParts.version);
  });

  it("an upgrade by one column: 4 round trips (97 before), the same schema", async () => {
    const want = await current();
    const db = await lessOneColumn();
    const { sql, counts } = counted(db);
    await ensureSchema(sql, {});
    expect(counts).toEqual({ trips: 4, statements: 4 + schemaParts.SCHEMA.length + schemaParts.LEDGER_TRIGGERS.length + schemaParts.AFTER_COLUMNS.length + 1 });
    expect(schemaOf(db)).toEqual(schemaOf(want));
    expect(versionOf(db)).toBe(schemaParts.version);
  });

  it("a new instance on a database already at this schema makes one read; a later request on the same instance none", async () => {
    const db = await current();
    const key = {};
    const { sql, counts } = counted(db);
    await ensureSchema(sql, key);
    expect(counts.trips).toBe(1);
    await ensureSchema(counted(db, {}, counts).sql, key);
    expect(counts.trips).toBe(1);
  });
});

describe("the schema run's statements: the same schema and rows as one at a time", () => {
  it("an older database: its columns added and filled in, fairplay_identities rebuilt with the owner in its key, rows kept", async () => {
    const want = await older();
    await oneByOne(want.sql);
    const db = await older();
    const { sql, counts } = counted(db);
    await ensureSchema(sql, {});
    // (The version, the tables, the columns, the rebuild, the columns again, then the missing columns and the rest.)
    expect(counts.trips).toBe(6);
    expect(schemaOf(db)).toEqual(schemaOf(want));
    expect(rowsOf(db)).toEqual(rowsOf(want));
    expect(rowsOf(db)).toEqual({
      users: [{ id: "u1", rating: 1720, chat_on: null }],
      identities: [{ kind: "email", hash: "h1", user_id: "u1", at: 5 }],
      ranked: [{ user_id: "u1", ladder: 42, peak: 42 }],
      identitiesKey: [{ name: "kind" }, { name: "hash" }, { name: "user_id" }],
    });
  });

  it("another instance adding a column first: the batch is refused and the columns go one at a time, as before", async () => {
    const want = await current();
    const db = await lessOneColumn();
    let raced = false;
    const { sql, counts } = counted(db, {
      beforeBatch: (sqls) => {
        if (raced || !sqls.some((s) => s.startsWith("ALTER TABLE quests ADD COLUMN rerolled_day"))) return;
        raced = true;
        db.db.exec("ALTER TABLE quests ADD COLUMN rerolled_day INTEGER");
      },
    });
    await ensureSchema(sql, {});
    expect(raced).toBe(true);
    // (The refused batch, the column on its own ("duplicate column" is fine), then the statements after the columns.)
    expect(counts.trips).toBe(6);
    expect(schemaOf(db)).toEqual(schemaOf(want));
    expect(versionOf(db)).toBe(schemaParts.version);
  });

  it("a database that refuses the ledger's triggers still loads (each one logged), with every table", async () => {
    const want = memoryDb();
    await oneByOne(want.sql);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = memoryDb();
    await ensureSchema(counted(db, { refuse: (q) => q.startsWith("CREATE TRIGGER") }).sql, {});
    expect(errors.mock.calls.map((c) => String(c[0]).split(":")[0])).toEqual(["ledger trigger not made", "ledger trigger not made"]);
    expect(schemaOf(db)).toEqual(schemaOf(want).filter((r) => (r as { type: string }).type !== "trigger"));
    expect(versionOf(db)).toBe(schemaParts.version);
  });

  it("a database that refuses the one read of the columns gets each table's PRAGMA table_info, as before", async () => {
    const want = await older();
    await oneByOne(want.sql);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = await older();
    await ensureSchema(counted(db, { refuse: (q) => q.includes("pragma_table_info(") }).sql, {});
    expect(errors).toHaveBeenCalledTimes(2); // (once a read: before the rebuild and after it)
    expect(schemaOf(db)).toEqual(schemaOf(want));
    expect(rowsOf(db)).toEqual(rowsOf(want));
  });
});

describe("one schema run per instance (single-flight)", () => {
  it("requests that come while it runs wait for that one run", async () => {
    const want = memoryDb();
    await oneByOne(want.sql);
    const db = memoryDb();
    const key = {};
    const counts = { trips: 0, statements: 0 };
    // (Each request makes its own SQL interface over the one binding, the key.)
    await Promise.all(Array.from({ length: 6 }, () => ensureSchema(counted(db, {}, counts).sql, key)));
    expect(counts.trips).toBe(4);
    expect(schemaOf(db)).toEqual(schemaOf(want));
    await ensureSchema(counted(db, {}, counts).sql, key);
    expect(counts.trips).toBe(4);
  });

  it("a failed run fails the requests waiting on it, and the next request runs it again", async () => {
    const want = memoryDb();
    await oneByOne(want.sql);
    const db = memoryDb();
    const key = {};
    let refuse = true;
    const { sql, counts } = counted(db, { refuse: (q) => refuse && q.startsWith("INSERT INTO meta") });
    const first = await Promise.allSettled([1, 2, 3].map(() => ensureSchema(sql, key)));
    expect(first.map((r) => r.status)).toEqual(["rejected", "rejected", "rejected"]);
    expect(versionOf(db)).toBeUndefined();
    const before = counts.trips;
    refuse = false;
    await ensureSchema(sql, key);
    expect(counts.trips - before).toBe(4);
    expect(schemaOf(db)).toEqual(schemaOf(want));
    expect(versionOf(db)).toBe(schemaParts.version);
  });

  it("a run that never finishes (its request cut short): the next requests wait 5 s at most, then one runs it again", async () => {
    vi.useFakeTimers();
    const never = () => new Promise<never>(() => {});
    const cutShort: Sql = { run: never, first: never, all: never, batch: never };
    const db = memoryDb();
    const key = {};
    void ensureSchema(cutShort, key);
    const counts = { trips: 0, statements: 0 };
    let done = 0;
    const waiting = [1, 2].map(() => ensureSchema(counted(db, {}, counts).sql, key).then(() => done++));
    await vi.advanceTimersByTimeAsync(4_999);
    expect([done, counts.trips]).toEqual([0, 0]);
    await vi.advanceTimersByTimeAsync(1);
    await Promise.all(waiting);
    // (One of them runs it; the other waits for that run.)
    expect([done, counts.trips]).toEqual([2, 4]);
    expect(versionOf(db)).toBe(schemaParts.version);
    await ensureSchema(counted(db, {}, counts).sql, key);
    expect(counts.trips).toBe(4);
  });
});
