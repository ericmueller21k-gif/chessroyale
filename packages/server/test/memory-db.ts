import { createRequire } from "node:module";
import type { Sql } from "../src/accounts.ts";

// node:sqlite through require (Vite doesn't know it as a built-in yet).
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

/** An in-memory SQLite standing in for D1: the SQL interface, and a fake D1 binding over the same database. */
export function memoryDb() {
  const db = new DatabaseSync(":memory:");
  const sql: Sql = {
    async run(q, ...p) {
      db.prepare(q).run(...(p as never[]));
    },
    async first(q, ...p) {
      return (db.prepare(q).get(...(p as never[])) ?? null) as never;
    },
    async all(q, ...p) {
      return db.prepare(q).all(...(p as never[])) as never;
    },
    // (One transaction, as D1's batch.)
    async batch(statements) {
      transaction(statements.map((s) => () => db.prepare(s.sql).run(...(s.params as never[]))));
    },
  };
  function transaction(steps: (() => unknown)[]) {
    db.exec("BEGIN");
    try {
      for (const step of steps) step();
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  const stmt = (q: string, params: unknown[] = []) => ({
    bind: (...p: unknown[]) => stmt(q, p),
    // (The statement runs at once, so a batch's transaction holds it.)
    run: async () => (db.prepare(q).run(...(params as never[])), { success: true }),
    first: async () => db.prepare(q).get(...(params as never[])) ?? null,
    all: async () => ({ results: db.prepare(q).all(...(params as never[])) }),
  });
  const d1 = {
    prepare: (q: string) => stmt(q),
    batch: async (stmts: { run(): unknown }[]) => (transaction(stmts.map((s) => () => s.run())), stmts.map(() => ({ success: true }))),
  } as unknown as D1Database;
  return { db, sql, d1 };
}

/**
 * Crates to open (Nov 9, XP phase 2: a series crate takes one you hold and a crate key): `n` of `crate` and `n` keys, through the
 * ledger as any grant (an op "test-stock"), so the balances and the ledger still agree.
 */
export async function stockCrates(sql: Sql, userId: string, crate: string, n: number, now = 1): Promise<void> {
  const { applyOp, leg, ledgerAccount } = await import("../src/ledger.ts");
  const me = await ledgerAccount(sql, userId);
  if (!me || n <= 0) return;
  await applyOp(sql, me, { id: `test-stock:${me.account}:${crypto.randomUUID()}`, reason: "test", now, legs: [leg.seriesCrates(userId, crate, n), leg.keys(userId, n)] });
}
