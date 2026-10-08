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
  };
  const stmt = (q: string, params: unknown[] = []) => ({
    bind: (...p: unknown[]) => stmt(q, p),
    run: async () => (db.prepare(q).run(...(params as never[])), { success: true }),
    first: async () => db.prepare(q).get(...(params as never[])) ?? null,
    all: async () => ({ results: db.prepare(q).all(...(params as never[])) }),
  });
  const d1 = { prepare: (q: string) => stmt(q) } as unknown as D1Database;
  return { db, sql, d1 };
}
