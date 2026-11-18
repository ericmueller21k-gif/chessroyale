import { describe, expect, it } from "vitest";
import { e2eSql, e2eSqlAllowed } from "../src/e2e-sql.ts";

/** The e2e's SQL route (Nov 10): two locks, a long key set on the server and the same key on the request. */
describe("the e2e's SQL route", () => {
  const key = "k".repeat(48);
  it("is on only with a key of 32+ characters and the request carrying exactly it", () => {
    expect(e2eSqlAllowed(undefined, key)).toBe(false);
    expect(e2eSqlAllowed("1", "1")).toBe(false); // (the old one-lock value: refused)
    expect(e2eSqlAllowed("short-key", "short-key")).toBe(false);
    expect(e2eSqlAllowed(key, null)).toBe(false);
    expect(e2eSqlAllowed(key, key.slice(1))).toBe(false);
    expect(e2eSqlAllowed(key, key)).toBe(true);
  });
  it("doesn't exist without the key: no database touched", async () => {
    let touched = false;
    const DB = { prepare: () => { touched = true; throw new Error("no"); }, batch: () => { touched = true; throw new Error("no"); } } as unknown as D1Database;
    const req = (h: Record<string, string> = {}) => new Request("http://x/api/e2e/sql", { method: "POST", headers: h, body: JSON.stringify({ sql: "SELECT 1" }) });
    const url = new URL("http://x/api/e2e/sql");
    expect(await e2eSql(req(), url, { DB, E2E_SQL: "1" })).toBeNull();
    expect(await e2eSql(req({ "x-e2e-sql": "1" }), url, { DB, E2E_SQL: "1" })).toBeNull();
    expect(await e2eSql(req(), url, { DB, E2E_SQL: key })).toBeNull();
    expect(touched).toBe(false);
  });
});
