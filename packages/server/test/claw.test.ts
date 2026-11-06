import { describe, expect, it } from "vitest";
import { BOSS_TOKENS, CLAW, bossCrateOf, clawWins, mulberry32 } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { handleAccountApi } from "../src/api.ts";
import { bossCrateHoldings, grantTestItems, openBossCrate, tokenHoldings } from "../src/boss-tokens.ts";
import { playClaw } from "../src/claw.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Boingo's claw machine (Eric, Nov 6; CLAW in core's settings; server/claw.ts; docs/decisions/2026-11-06-claw-machine.md): one boss
 * token in, the server's roll, and that boss's Boss Crate on a win, all in one transaction; a retry of the same play spends nothing
 * again; plays at once never overspend; guests can't play; the e2e's seed only where TEST_SWITCHES is on; Eric's tokens for testing
 * come from the admins' grant, which stays admin-only.
 */

const T0 = 10 * 86_400_000;
const folio = bossCrateOf("folio")!;
const WIN = () => 0.01;
const LOSE = () => 0.99;
let n = 0;
const rid = () => `play-${(++n).toString().padStart(6, "0")}`;

/** A fresh database with one signed-in account holding `tokens` of Folio's tokens. */
async function holding(tokens: number) {
  const { sql, db, d1 } = memoryDb();
  await ensureSchema(sql);
  const g = await createGuest(sql, T0, "Player");
  const id = (await signInWithIdentity(sql, g.user, "email", "player@example.com", {}, T0)).id;
  if (tokens) db.prepare("INSERT INTO boss_tokens (user_id, boss, n) VALUES (?, 'folio', ?)").run(id, tokens);
  return { sql, db, d1, id };
}
const folioTokens = async (sql: Sql, id: string) => (await tokenHoldings(sql, id)).tokens.folio ?? 0;
const plays = (db: ReturnType<typeof memoryDb>["db"], id: string) =>
  db.prepare("SELECT boss, won, crate, at FROM claw_plays WHERE user_id = ? ORDER BY at, id").all(id) as { boss: string; won: number; crate: string | null; at: number }[];

describe("the claw machine: one play", () => {
  it("the rule: CLAW.winChance is 0.25, from the settings; a roll under it wins", () => {
    expect(CLAW.winChance).toBe(0.25);
    expect(clawWins(0.2499)).toBe(true);
    expect(clawWins(0.25)).toBe(false);
  });

  it("spends exactly one token, win or lose, and logs the play (account, boss, outcome, time)", async () => {
    const { sql, db, id } = await holding(3);
    const lost = await playClaw(sql, id, "folio", rid(), T0, { rng: LOSE });
    expect(lost).toMatchObject({ ok: true, won: false, boss: "folio" });
    expect(await folioTokens(sql, id)).toBe(2);
    const won = await playClaw(sql, id, "folio", rid(), T0 + 1, { rng: WIN });
    expect(won).toMatchObject({ ok: true, won: true, crate: folio.id, boss: "folio" });
    expect(await folioTokens(sql, id)).toBe(1);
    expect(plays(db, id)).toEqual([
      { boss: "folio", won: 0, crate: null, at: T0 },
      { boss: "folio", won: 1, crate: folio.id, at: T0 + 1 },
    ]);
  });

  it("a win grants that boss's Boss Crate, unopened in the inventory; it opens like a bought one; a loss grants nothing", async () => {
    const { sql, id } = await holding(2);
    await playClaw(sql, id, "folio", rid(), T0, { rng: LOSE });
    expect(await bossCrateHoldings(sql, id)).toEqual({});
    const won = await playClaw(sql, id, "folio", rid(), T0, { rng: WIN });
    expect(won.ok && won.locker.bossCrates).toEqual({ [folio.id]: 1 });
    const opened = await openBossCrate(sql, id, folio.id, T0 + 5);
    expect(opened.ok).toBe(true);
    expect(folio.items).toContain(opened.ok ? opened.item.def : "");
    expect(await bossCrateHoldings(sql, id)).toEqual({});
  });

  it("refuses with none: nothing spent, nothing given, nothing logged (another boss's tokens don't count)", async () => {
    const { sql, db, id } = await holding(0);
    db.prepare("INSERT INTO boss_tokens (user_id, boss, n) VALUES (?, 'tiger', 5)").run(id);
    expect(await playClaw(sql, id, "folio", rid(), T0, { rng: WIN })).toEqual({ ok: false, message: "You need a Folio token." });
    expect(await bossCrateHoldings(sql, id)).toEqual({});
    expect((await tokenHoldings(sql, id)).tokens).toEqual({ tiger: 5 });
    expect(plays(db, id)).toEqual([]);
    // Not a boss with a crate, or no request id: refused before anything.
    expect(await playClaw(sql, id, "recluse", rid(), T0)).toEqual({ ok: false, message: "No such crate." });
    expect(await playClaw(sql, id, "nobody", rid(), T0)).toEqual({ ok: false, message: "No such crate." });
    expect(await playClaw(sql, id, "tiger", "x", T0)).toEqual({ ok: false, message: "No play to make." });
    expect((await tokenHoldings(sql, id)).tokens).toEqual({ tiger: 5 });
  });

  it("the token spent elsewhere just before this play's transaction: it logs nothing, takes nothing and gives nothing", async () => {
    const { sql, db, id } = await holding(1);
    const racing: Sql = {
      ...sql,
      async batch(statements) {
        db.prepare("UPDATE boss_tokens SET n = 0 WHERE user_id = ?").run(id);
        return sql.batch(statements);
      },
    };
    expect(await playClaw(racing, id, "folio", rid(), T0, { rng: WIN })).toEqual({ ok: false, message: "You need a Folio token." });
    expect(await bossCrateHoldings(sql, id)).toEqual({});
    expect(plays(db, id)).toEqual([]);
  });

  it("a crate that can't go in (its write fails): the whole play is undone, the token kept", async () => {
    const { sql, db, id } = await holding(1);
    const failing: Sql = {
      ...sql,
      async batch(statements) {
        return sql.batch(statements.map((s) => (/INSERT INTO boss_crates/.test(s.sql) ? { ...s, sql: s.sql.replace("boss_crates", "no_such_table") } : s)));
      },
    };
    await expect(playClaw(failing, id, "folio", rid(), T0, { rng: WIN })).rejects.toThrow();
    expect(await folioTokens(sql, id)).toBe(1);
    expect(plays(db, id)).toEqual([]);
  });
});

describe("the claw machine: the odds", () => {
  it("about 25% over many seeded rolls (the server's own randomness in play: crypto)", async () => {
    const { sql, db, id } = await holding(0);
    const N = 2000;
    db.prepare("UPDATE boss_tokens SET n = ? WHERE user_id = ?").run(N, id);
    db.prepare("INSERT OR REPLACE INTO boss_tokens (user_id, boss, n) VALUES (?, 'folio', ?)").run(id, N);
    const rng = mulberry32(20261106);
    let wins = 0;
    for (let i = 0; i < N; i++) {
      const r = await playClaw(sql, id, "folio", rid(), T0 + i, { rng });
      if (r.ok && r.won) wins++;
    }
    // 2000 plays at 0.25: 500 expected, sd about 19; within 4 sd.
    expect(Math.abs(wins - N * CLAW.winChance)).toBeLessThan(80);
    expect(await folioTokens(sql, id)).toBe(0);
    expect((await bossCrateHoldings(sql, id))[folio.id]).toBe(wins);
  });

  it("the e2e's seed: the roll is mulberry32(seed)'s first number, so a seed picks a known outcome", async () => {
    const seedFor = (win: boolean) => {
      for (let s = 1; ; s++) if (clawWins(mulberry32(s)()) === win) return s;
    };
    const { sql, id } = await holding(2);
    expect(await playClaw(sql, id, "folio", rid(), T0, { seed: seedFor(true) })).toMatchObject({ won: true });
    expect(await playClaw(sql, id, "folio", rid(), T0, { seed: seedFor(false) })).toMatchObject({ won: false });
  });
});

describe("the claw machine: retries and plays at once", () => {
  it("idempotent on retry: the same request id answers the first play's outcome and spends nothing again", async () => {
    const { sql, db, id } = await holding(3);
    const req = rid();
    const first = await playClaw(sql, id, "folio", req, T0, { rng: WIN });
    expect(first).toMatchObject({ ok: true, won: true, crate: folio.id });
    // The retry rolls a loss and names another boss: it doesn't matter, it's the same play.
    const again = await playClaw(sql, id, "tiger", req, T0 + 9, { rng: LOSE });
    expect(again).toMatchObject({ ok: true, won: true, crate: folio.id, boss: "folio", again: true });
    expect(await folioTokens(sql, id)).toBe(2);
    expect(await bossCrateHoldings(sql, id)).toEqual({ [folio.id]: 1 });
    expect(plays(db, id)).toHaveLength(1);
    // A retry once the tokens are gone still answers the play it made.
    db.prepare("UPDATE boss_tokens SET n = 0 WHERE user_id = ?").run(id);
    expect(await playClaw(sql, id, "folio", req, T0 + 10)).toMatchObject({ ok: true, won: true, again: true });
  });

  it("the same play twice at once (a retry racing the first): one play, one token, one crate at most", async () => {
    const { sql, db, id } = await holding(3);
    const req = rid();
    const both = await Promise.all([playClaw(sql, id, "folio", req, T0, { rng: WIN }), playClaw(sql, id, "folio", req, T0, { rng: WIN })]);
    expect(both.every((r) => r.ok && r.won)).toBe(true);
    expect(both.filter((r) => r.ok && r.again)).toHaveLength(1);
    expect(await folioTokens(sql, id)).toBe(2);
    expect(await bossCrateHoldings(sql, id)).toEqual({ [folio.id]: 1 });
    expect(plays(db, id)).toHaveLength(1);
  });

  it("concurrent plays never overspend: with 2 tokens, 5 plays at once make 2 plays, the rest refused", async () => {
    const { sql, db, id } = await holding(2);
    const all = await Promise.all([1, 2, 3, 4, 5].map(() => playClaw(sql, id, "folio", rid(), T0, { rng: WIN })));
    expect(all.filter((r) => r.ok)).toHaveLength(2);
    expect(all.filter((r) => !r.ok)).toEqual([1, 2, 3].map(() => ({ ok: false, message: "You need a Folio token." })));
    expect(await folioTokens(sql, id)).toBe(0);
    expect(await bossCrateHoldings(sql, id)).toEqual({ [folio.id]: 2 });
    expect(plays(db, id)).toHaveLength(2);
  });
});

describe("the claw machine through the API", () => {
  const call = async (env: object, body: unknown, cookie: string, path = "/api/shop/claw") => {
    const res = (await handleAccountApi(new Request(`https://hunchess.com${path}`, { method: "POST", body: JSON.stringify(body), headers: { cookie } }), env as never))!;
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const seedFor = (win: boolean) => {
    for (let s = 1; ; s++) if (clawWins(mulberry32(s)()) === win) return s;
  };

  it("guests refused (nothing spent); a signed-in account plays; the shop's kill switch refuses it", async () => {
    const { sql, d1, db } = memoryDb();
    await ensureSchema(sql);
    const env = { DB: d1 };
    const guest = await createGuest(sql, T0, "Guest");
    db.prepare("INSERT INTO boss_tokens (user_id, boss, n) VALUES (?, 'folio', 2)").run(guest.user.id);
    expect(await call(env, { boss: "folio", request: rid() }, `hc_session=${await createSession(sql, guest.user.id, Date.now())}`)).toEqual({ status: 403, body: { message: "Sign in to play the claw machine." } });
    expect(await folioTokens(sql, guest.user.id)).toBe(2);
    const player = await signInWithIdentity(sql, (await createGuest(sql, T0, "P")).user, "email", "player@example.com", {}, T0);
    const cookie = `hc_session=${await createSession(sql, player.id, Date.now())}`;
    db.prepare("INSERT INTO boss_tokens (user_id, boss, n) VALUES (?, 'folio', 2)").run(player.id);
    expect((await call({ ...env, PAUSE_SHOP: "1" }, { boss: "folio", request: rid() }, cookie)).status).toBe(503);
    expect(await folioTokens(sql, player.id)).toBe(2);
    const r = await call(env, { boss: "folio", request: rid() }, cookie);
    expect(r.status).toBe(200);
    expect(typeof r.body.won).toBe("boolean");
    expect((r.body.locker as { tokens: Record<string, number> }).tokens).toEqual({ folio: 1 });
  });

  it("the e2e's seed is honored only where TEST_SWITCHES is on: never otherwise, not even for an admin", async () => {
    const { sql, d1, db } = memoryDb();
    await ensureSchema(sql);
    const eric = await signInWithIdentity(sql, (await createGuest(sql, T0, "Eric")).user, "email", "eric@example.com", {}, T0);
    const cookie = `hc_session=${await createSession(sql, eric.id, Date.now())}`;
    db.prepare("INSERT INTO boss_tokens (user_id, boss, n) VALUES (?, 'folio', 100)").run(eric.id);
    const test = { DB: d1, TEST_SWITCHES: "1" };
    expect((await call(test, { boss: "folio", request: rid(), seed: seedFor(true) }, cookie)).body.won).toBe(true);
    expect((await call(test, { boss: "folio", request: rid(), seed: seedFor(false) }, cookie)).body.won).toBe(false);
    // Production (no TEST_SWITCHES), an admin asking for a winning seed every time: the server's own roll, so not every play wins.
    const prod = { DB: d1, ADMIN_EMAILS: "eric@example.com" };
    let wins = 0;
    for (let i = 0; i < 40; i++) if ((await call(prod, { boss: "folio", request: rid(), seed: seedFor(true) }, cookie)).body.won) wins++;
    expect(wins).toBeLessThan(40);
    expect(await folioTokens(sql, eric.id)).toBe(100 - 42);
  });

  it("Eric's tokens for testing: the admins' grant gives them (up to grantMax a tap), admin-only; anyone else: not found, nothing given", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql);
    const env = { DB: d1, ADMIN_EMAILS: "eric@example.com" };
    const player = await signInWithIdentity(sql, (await createGuest(sql, T0, "P")).user, "email", "player@example.com", {}, T0);
    const playerCookie = `hc_session=${await createSession(sql, player.id, Date.now())}`;
    expect(await call(env, { boss: "folio", tokens: 10 }, playerCookie, "/api/locker/grant")).toEqual({ status: 404, body: { message: "Not found" } });
    expect(await folioTokens(sql, player.id)).toBe(0);
    const eric = await signInWithIdentity(sql, (await createGuest(sql, T0, "Eric")).user, "email", "eric@example.com", {}, T0);
    const ericCookie = `hc_session=${await createSession(sql, eric.id, Date.now())}`;
    const g = await call(env, { boss: "folio", tokens: BOSS_TOKENS.grantMax }, ericCookie, "/api/locker/grant");
    expect([g.status, (g.body.tokens as Record<string, number>).folio]).toEqual([200, BOSS_TOKENS.grantMax]);
    // And Eric plays with them.
    expect((await call(env, { boss: "folio", request: rid() }, ericCookie)).status).toBe(200);
    expect(await folioTokens(sql, eric.id)).toBe(BOSS_TOKENS.grantMax - 1);
    await grantTestItems(sql, eric.id, { boss: "folio", tokens: 1 });
    expect(await folioTokens(sql, eric.id)).toBe(BOSS_TOKENS.grantMax);
  });
});
