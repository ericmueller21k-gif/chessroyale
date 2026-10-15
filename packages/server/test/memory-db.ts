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
