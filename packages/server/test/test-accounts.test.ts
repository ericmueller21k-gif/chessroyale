import { describe, expect, it } from "vitest";
import { createGuest, createSession, ensureSchema, publicProfile, recordResult, signInWithIdentity, userFromToken, type Sql } from "../src/accounts.ts";
import { caseOf, logCase, setCase } from "../src/fairplay.ts";
import { forgetTopPlaces, topPlace } from "../src/ranked-schema.ts";
import { handleTestAccounts, testEmail } from "../src/test-accounts.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Test accounts (docs/decisions/2026-11-10-cheater-demo.md): an admin's script makes named accounts with a dummy email
 * (`<name>@test.hunchess`, `users.test` = 1), signs in as them, lists their fair play and deletes them all in one call. Nobody else
 * can reach the route, a real account is never signed in to through it, and public rankings leave test accounts out.
 */

const T0 = Date.UTC(2026, 10, 10, 12);
const ADMIN = "boss@example.com";
const E2E_KEY = "k".repeat(40);
const URL_ = "https://hunchess.test/api/admin/test-accounts";

async function world() {
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql);
  const env = { DB: d1, ADMIN_EMAILS: ADMIN };
  /** A request through the route, as `as` (headers), with `access` saying whether it came through Access with a service token. */
  const call = (method: string, headers: Record<string, string> = {}, body?: unknown, opts: { access?: boolean; e2e?: string } = {}) =>
    handleTestAccounts(new Request(URL_, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }), { ...env, ...(opts.e2e ? { E2E_SQL: opts.e2e } : {}) }, {
      now: T0,
      access: async () => !!opts.access,
    });
  return { sql, call };
}

async function signedIn(sql: Sql, email: string) {
  const g = await createGuest(sql, T0 - 1000, "Someone");
  const u = await signInWithIdentity(sql, g.user, "email", email, {}, T0 - 1000);
  return { user: u, cookie: `hc_session=${await createSession(sql, u.id, T0 - 1000)}` };
}

const tokenOf = (res: Response) => decodeURIComponent(res.headers.get("set-cookie")?.match(/hc_session=([^;]+)/)?.[1] ?? "");

describe("test accounts: who may use the route", () => {
  it("is Not found to anyone but an admin, a script through Access or the e2e's key", async () => {
    const { sql, call } = await world();
    const guest = await createGuest(sql, T0, "Guest");
    const player = await signedIn(sql, "player@example.com");
    for (const headers of [{}, { cookie: `hc_session=${guest.token}` }, { cookie: player.cookie }, { authorization: "Bearer anything" }]) {
      for (const method of ["GET", "POST", "DELETE"]) {
        const res = (await call(method, headers, method === "POST" ? { name: "Engine Eddie" } : undefined))!;
        expect(res.status).toBe(404);
      }
    }
    // A wrong or short e2e key (and a key sent where the server has none).
    expect((await call("GET", { "x-e2e-sql": "wrong".repeat(10) }, undefined, { e2e: E2E_KEY }))!.status).toBe(404);
    expect((await call("GET", { "x-e2e-sql": "short" }, undefined, { e2e: "short" }))!.status).toBe(404);
    expect((await call("GET", { "x-e2e-sql": E2E_KEY }))!.status).toBe(404);
    // An admin's change only from the site itself (a page elsewhere can't make or delete accounts with their session).
    const admin = await signedIn(sql, ADMIN);
    expect((await call("POST", { cookie: admin.cookie }, { name: "Engine Eddie" }))!.status).toBe(404);
    expect((await call("DELETE", { cookie: admin.cookie, origin: "https://elsewhere.example" }))!.status).toBe(404);
    expect(await sql.first("SELECT id FROM users WHERE test = 1")).toBeNull();
    // Other paths aren't this route's.
    expect(await handleTestAccounts(new Request("https://hunchess.test/api/admin/fairplay/cases"), { DB: memoryDb().d1 })).toBeNull();
  });

  it("answers an admin's session, a script through Access, and the e2e's key", async () => {
    const { sql, call } = await world();
    const admin = await signedIn(sql, ADMIN);
    expect((await call("GET", { cookie: admin.cookie }))!.status).toBe(200);
    expect((await call("POST", { cookie: admin.cookie, origin: "https://hunchess.test" }, { name: "Judge Jo" }))!.status).toBe(200);
    expect((await call("POST", {}, { name: "Judge Jay" }, { access: true }))!.status).toBe(200);
    expect((await call("POST", { "x-e2e-sql": E2E_KEY }, { name: "Strong Sam" }, { e2e: E2E_KEY }))!.status).toBe(200);
    expect((await sql.all<{ name: string }>("SELECT name FROM users WHERE test = 1 ORDER BY name")).map((u) => u.name)).toEqual(["Judge Jay", "Judge Jo", "Strong Sam"]);
  });
});

describe("test accounts: the account", () => {
  it("is made once with a dummy email and the test flag, and the answer signs the script in as it", async () => {
    const { sql, call } = await world();
    expect(testEmail("Engine Eddie")).toBe("engine-eddie@test.hunchess");
    const res = (await call("POST", {}, { name: "Engine Eddie" }, { access: true }))!;
    const body = (await res.json()) as { id: string; name: string; email: string; created: boolean };
    expect(body).toMatchObject({ name: "Engine Eddie", email: "engine-eddie@test.hunchess", created: true });
    expect(await sql.first("SELECT name, email, test, google_sub FROM users WHERE id = ?", body.id)).toEqual({ name: "Engine Eddie", email: "engine-eddie@test.hunchess", test: 1, google_sub: null });
    // The session cookie is the account's (HttpOnly, as every sign-in's).
    expect(res.headers.get("set-cookie")).toMatch(/^hc_session=[^;]+; Path=\/; HttpOnly; Secure; SameSite=Lax/);
    expect((await userFromToken(sql, tokenOf(res), T0))?.id).toBe(body.id);
    // Nothing granted: no coins, crates or items beyond what play pays.
    expect(await sql.first("SELECT * FROM wallets WHERE user_id = ?", body.id)).toBeNull();
    expect(await sql.first("SELECT * FROM ledger WHERE account IN (SELECT account FROM ledger_accounts WHERE user_id = ?)", body.id)).toBeNull();
    expect(await sql.first("SELECT * FROM items WHERE user_id = ?", body.id)).toBeNull();
    // Again: the same account, a new session.
    const again = (await call("POST", {}, { name: "Engine Eddie" }, { access: true }))!;
    expect(await again.json()).toMatchObject({ id: body.id, created: false });
    expect((await userFromToken(sql, tokenOf(again), T0))?.id).toBe(body.id);
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE test = 1"))?.n).toBe(1);
  });

  it("never signs in to a real account, and refuses a name with no address", async () => {
    const { sql, call } = await world();
    // (No real sign-in can reach the test domain, but an account given that address any other way is still never handed out.)
    const real = await signedIn(sql, "someone@example.com");
    await sql.run("UPDATE users SET email = 'engine-eddie@test.hunchess' WHERE id = ?", real.user.id);
    const res = (await call("POST", {}, { name: "Engine Eddie" }, { access: true }))!;
    expect(res.status).toBe(409);
    expect(res.headers.get("set-cookie")).toBeNull();
    for (const name of ["", "   ", "!!!", 42, null]) expect((await call("POST", {}, { name }, { access: true }))!.status).toBe(400);
  });
});

describe("test accounts: off public rankings", () => {
  it("others' Top N% and 1 v 1's top places leave test accounts out; theirs looks as anyone's", async () => {
    const { sql, call } = await world();
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const u = await signedIn(sql, `p${i}@example.com`);
      ids.push(u.user.id);
      await recordResult(sql, u.user.id, { mode: "crowd", online: true, placement: 2, players: 100, rating: 1000 + 100 * i, ranked: true }, T0);
    }
    const before = (await publicProfile(sql, ids[9]!, T0))!.topPercent;
    expect(before).not.toBeNull();
    const eddie = (await (await call("POST", {}, { name: "Engine Eddie" }, { access: true }))!.json()) as { id: string };
    await recordResult(sql, eddie.id, { mode: "crowd", online: true, placement: 1, players: 100, rating: 3000, ranked: true }, T0);
    // The 1900 player stays 1st of 10; the test account's own is worked out among the rest and itself.
    expect((await publicProfile(sql, ids[9]!, T0))!.topPercent).toBe(before);
    expect((await publicProfile(sql, eddie.id, T0))!.topPercent).not.toBeNull();
    for (const [id, ladder] of [[eddie.id, 3100], [ids[9]!, 3000]] as const)
      await sql.run("INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_at) VALUES (?, 2400, 60, 40, 20, 20, 0, ?, ?)", id, ladder, T0);
    forgetTopPlaces();
    expect(await topPlace(sql, 3000, T0)).toBe(1);
    expect(await topPlace(sql, 3100, T0)).toBe(1);
  });
});

describe("test accounts: the report and deleting them", () => {
  it("lists each one's case and matches, and one call deletes them all, fair play's file too, leaving real accounts", async () => {
    const { sql, call } = await world();
    const real = await signedIn(sql, "real@example.com");
    await setCase(sql, real.user.id, "pool", "detection", "level ban: a real one", T0);
    const eddie = (await (await call("POST", {}, { name: "Engine Eddie" }, { access: true }))!.json()) as { id: string };
    await sql.run(
      "INSERT INTO fairplay_matches (user_id, lobby, mode, played_at, counted, perf, score, level, summary, moves, keep_until) VALUES (?, 'ABCDE', 'crowd', ?, 20, 2900, 14, 'ban', ?, '[]', ?)",
      eddie.id,
      T0,
      JSON.stringify({ moves: 30, counted: 20, found: 19, evidence: 15.2, deepChecked: 14, deepMatch: 14 }),
      T0 + 86_400_000,
    );
    await setCase(sql, eddie.id, "pool", "detection", "level ban: one match", T0 + 1000);
    await logCase(sql, eddie.id, "note", "detection", "more", T0 + 2000);
    const list = (await (await call("GET", {}, undefined, { access: true }))!.json()) as { accounts: { id: string; name: string; case: { status: string } | null; log: unknown[]; matches: Record<string, unknown>[] }[] };
    expect(list.accounts).toHaveLength(1);
    expect(list.accounts[0]).toMatchObject({ id: eddie.id, name: "Engine Eddie", case: { status: "pool" } });
    expect(list.accounts[0]!.matches[0]).toMatchObject({ lobby: "ABCDE", counted: 20, perf: 2900, evidence: 15.2, deepChecked: 14, deepMatch: 14, score: 14, level: "ban" });
    expect(list.accounts[0]!.log.length).toBe(2);
    const del = (await call("DELETE", {}, undefined, { access: true }))!;
    expect(await del.json()).toEqual({ deleted: 1 });
    expect(await sql.first("SELECT id FROM users WHERE id = ?", eddie.id)).toBeNull();
    for (const t of ["fairplay_cases", "fairplay_log", "fairplay_matches", "fairplay_identities", "sessions"]) {
      expect(await sql.first(`SELECT user_id FROM ${t} WHERE user_id = ?`, eddie.id)).toBeNull();
    }
    // A real account's file is untouched, and making the name again starts afresh (no pool carried over by its address).
    expect((await caseOf(sql, real.user.id))?.status).toBe("pool");
    const fresh = (await (await call("POST", {}, { name: "Engine Eddie" }, { access: true }))!.json()) as { id: string; created: boolean };
    expect(fresh.created).toBe(true);
    expect(await caseOf(sql, fresh.id)).toBeNull();
  });
});
