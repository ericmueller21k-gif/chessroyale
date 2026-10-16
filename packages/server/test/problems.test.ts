import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { OPS } from "@chessroyale/core";

// (The Worker's module, for its cron, and the ops page's health section: the engine server's container needs the
// Workers runtime, and nothing here searches.)
vi.mock("@cloudflare/containers", () => ({ Container: class {}, getContainer: () => ({ fetch: async () => new Response("{}") }) }));

import { createGuest, createSession, ensureSchema, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { isSessionToken, problemLimited } from "../src/limits.ts";
import {
  ErrorTally,
  codeInPath,
  errorSample,
  fingerprint,
  guardEntries,
  handleProblems,
  latestReports,
  normalizeMessage,
  pruneProblems,
  readCapped,
  readProblem,
  reportById,
  saveReport,
  scrubEmails,
  topErrors,
  topFile,
  type ErrorGroup,
} from "../src/problems.ts";
import { handleOpsAdmin } from "../src/ops-admin.ts";
import worker, { type Env } from "../src/index.ts";
import { memoryDb } from "./memory-db.ts";

/** Errors and player reports (problems.ts, docs/areas/ops.md "Errors and player reports"). */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 9, 15, 12, 0, 0);

/** Background work (the Worker's waitUntil), awaited by `settle`. */
function background() {
  const pending: Promise<unknown>[] = [];
  return {
    waitUntil: (p: Promise<unknown>) => void pending.push(p),
    async settle() {
      while (pending.length) await pending.shift();
    },
  };
}
/** Every write a tally made has landed (one flush window on, and all background work done). */
async function flushed(bg: ReturnType<typeof background>) {
  await vi.advanceTimersByTimeAsync(OPS.store.flushMs);
  await bg.settle();
}

const ASSETS = { fetch: async () => new Response(JSON.stringify({ version: "abc1234def56" })) } as unknown as Fetcher;

const device = { ua: "Mozilla/5.0 (iPhone)", viewport: "390x664@3", memory: 4 };
const where = { screen: "boss freeze", mode: "solo raid", boss: "gingerbread", code: null };
const anError = (message = "TypeError: Cannot read properties of undefined (reading 'board')") => ({
  kind: "error",
  message,
  stack: `${message}\nat PlayScreen (/assets/index-AbC12x_9.js:1:2345)\nat render (/assets/index-AbC12x_9.js:1:999)`,
  where,
  trail: ["1.0s home", "4.2s boss intro", "9.9s move e2e4"],
});

let ip = 0;
function post(body: unknown, opts: { session?: string; raw?: string; ip?: string; headers?: Record<string, string> } = {}) {
  return new Request("https://hunchess.com/api/problems", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": opts.ip ?? `10.0.0.${++ip}`,
      ...(opts.session ? { cookie: `hc_session=${opts.session}` } : {}),
      ...opts.headers,
    },
    body: opts.raw ?? JSON.stringify(body),
  });
}
/** A session cookie's shape (randomToken: 43 characters), made from a name. */
const tok = (name: string) => name.padEnd(43, "x");

// (One clock for the whole file, only ever moving on: the module's tally remembers when it last wrote.)
beforeAll(() => {
  vi.useFakeTimers({ now: T0 });
});
afterAll(() => {
  vi.useRealTimers();
});

describe("reading a request", () => {
  it("keeps every field it knows, cut to size, and nothing else; emails are scrubbed from any text", () => {
    const p = readProblem({
      kind: "errors",
      version: "abc1234def56",
      device,
      account: "u_1",
      ip: "1.2.3.4",
      errors: [{ ...anError("Error: mail me at pat@example.com"), extra: "dropped", trail: ["x".repeat(500), 7, "ok"] }],
    })!;
    expect(p.kind).toBe("errors");
    expect(p.diag).toEqual({ version: "abc1234def56", device, account: "u_1" });
    expect(JSON.stringify(p)).not.toContain("1.2.3.4");
    expect(JSON.stringify(p)).not.toContain("dropped");
    const e = p.kind === "errors" ? p.errors[0]! : null;
    expect(e!.message).toBe("Error: mail me at [email]");
    expect(e!.trail).toEqual(["x".repeat(60), "ok"]);
    expect(e!.where).toEqual(where);
  });

  it("caps errors per request and the length of each field; bad values become empty ones", () => {
    const p = readProblem({
      kind: "errors",
      version: "not a version",
      device: { ua: "u".repeat(1000), viewport: "huge", memory: 99999 },
      errors: Array.from({ length: 9 }, () => ({ kind: "error", message: "m".repeat(1000), stack: "s".repeat(5000), where: { screen: "s".repeat(200), code: "nope!" } })),
    })!;
    if (p.kind !== "errors") throw new Error("errors expected");
    expect(p.errors).toHaveLength(OPS.endpoint.maxErrorsPerPost);
    expect(p.errors[0]!.message).toHaveLength(300);
    expect(p.errors[0]!.stack).toHaveLength(1000);
    expect(p.errors[0]!.where).toEqual({ screen: "s".repeat(60), mode: null, boss: null, code: null });
    expect(p.diag).toEqual({ version: "unknown", device: { ua: "u".repeat(300), viewport: "", memory: null }, account: null });
  });

  it("a bug report: its note (500 characters), where it was sent from, its trail and recent errors", () => {
    const p = readProblem({ kind: "bug", note: `  the clock froze; I'm ${"z".repeat(600)}`, where: { ...where, code: "ABCDE" }, trail: ["2.0s play"], recent: [{ kind: "error", message: "boom" }], version: "dev", device })!;
    if (p.kind !== "bug") throw new Error("bug expected");
    expect(p.note.startsWith("the clock froze")).toBe(true);
    expect(p.note.length).toBeLessThanOrEqual(500);
    expect(p.where.code).toBe("ABCDE");
    expect(p.recent).toEqual([{ kind: "error", message: "boom" }]);
  });

  it("feedback and ideas need a note (a bug's is optional); anything else is not a problem", () => {
    expect(readProblem({ kind: "bug" })).toMatchObject({ kind: "bug", note: "" });
    expect(readProblem({ kind: "idea", note: " a Fischer Random boss " })).toMatchObject({ kind: "idea", note: "a Fischer Random boss" });
    for (const b of [null, "x", [], {}, { kind: "errors" }, { kind: "errors", errors: [] }, { kind: "hack" }, { kind: "report" }, { kind: "feedback", note: "   " }, { kind: "idea" }]) {
      expect(readProblem(b)).toBeNull();
    }
  });

  it("scrubbing is linear: a 20 KB field without separators, or with one \"@\", takes a few milliseconds", () => {
    for (const long of ["a".repeat(20_000), `a@${"b".repeat(20_000)}`, `${"a".repeat(50)}@`.repeat(400)]) {
      const t = performance.now();
      scrubEmails(long);
      expect(performance.now() - t, long.slice(0, 60)).toBeLessThan(20);
    }
    expect(scrubEmails("x.pat@example.com, (sam@ex.co) and @@lee@ex.org.")).toBe("[email], ([email]) and @@[email].");
    const t = performance.now();
    readProblem({ kind: "bug", note: "n".repeat(19_000), where: { screen: "s".repeat(19_000) } });
    expect(performance.now() - t).toBeLessThan(20);
  });

  it("control characters can't hide an address from the scrub (they're dropped first; newlines kept)", () => {
    const p = readProblem({ kind: "bug", note: "write to pat\u0000@exam\u0007ple.com\nor sam\u001f@ex.co\u007f, thanks" })!;
    expect(p.kind === "bug" && p.note).toBe("write to [email]\nor [email], thanks");
    // An address across the field's cut is scrubbed before the cut, not left half there.
    const q = readProblem({ kind: "bug", note: `${"n ".repeat(248)}pat@example.com` })!;
    expect(q.kind === "bug" && q.note).toBe(`${"n ".repeat(248)}[email]`.slice(0, 500));
    expect(JSON.stringify(q)).not.toContain("pat");
  });

  it("reads a body up to the cap and no further", async () => {
    const small = new Request("https://x/", { method: "POST", body: "hello" });
    expect(await readCapped(small, 10)).toBe("hello");
    const big = new Request("https://x/", { method: "POST", body: "y".repeat(25_000) });
    expect(await readCapped(big, 20_000)).toBeNull();
  });
});

describe("fingerprints", () => {
  it("the same bug in another build, on another line, with other numbers, is one fingerprint", () => {
    const a = fingerprint("client", "error", "TypeError: x is undefined at 12", "at f (https://hunchess.com/assets/index-AbC12x_9.js:1:2345)");
    const b = fingerprint("client", "error", "TypeError: x is undefined at 97", "at g (/assets/index-Zz9-8xQ1.js:1:77)");
    expect(a).toBe(b);
    expect(normalizeMessage("Failed to fetch https://hunchess.com/assets/Boss-AbC12x_9.js?v=3 (id 0xdeadbeef01)")).toBe("Failed to fetch /assets/Boss.js (id X)");
    expect(topFile("Error: boom\n    at Object.fetch (index.js:120:5)")).toBe("index.js");
    expect(topFile("at /engine/stockfish-19-lite-single.js:1:2")).toBe("stockfish-19-lite-single.js");
  });

  it("another message, kind, source or file is another fingerprint", () => {
    const base = fingerprint("client", "error", "TypeError: a", "at x (/assets/index-AbC12x_9.js:1:1)");
    expect(fingerprint("client", "error", "TypeError: b", "at x (/assets/index-AbC12x_9.js:1:1)")).not.toBe(base);
    expect(fingerprint("client", "rejection", "TypeError: a", "at x (/assets/index-AbC12x_9.js:1:1)")).not.toBe(base);
    expect(fingerprint("server", "error", "TypeError: a", "at x (/assets/index-AbC12x_9.js:1:1)")).not.toBe(base);
    expect(fingerprint("client", "error", "TypeError: a", "at x (/assets/Boss-AbC12x_9.js:1:1)")).not.toBe(base);
  });
});

/** A SQL interface that counts its writes. */
function counting(sql: Sql) {
  const writes: string[] = [];
  return {
    writes,
    sql: {
      ...sql,
      run: (q: string, ...p: unknown[]) => (writes.push(q.trim().split(/\s+/)[0]!), sql.run(q, ...p)),
      first: (q: string, ...p: unknown[]) => (writes.push(q.trim().split(/\s+/)[0]!), sql.first(q, ...p)),
    } as Sql,
  };
}
const group = (fp: string, patch: Partial<ErrorGroup> = {}): ErrorGroup => ({ fingerprint: fp, source: "client", kind: "error", message: `Error ${fp}`, version: "abc1234def56", sample: "{}", ...patch });

describe("bounded writes", () => {
  it("an error storm of one kind is one row an hour, however many times it happens", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const t = new ErrorTally();
    const c = counting(sql);
    expect(t.add(group("a"), T0)).toBe(true);
    for (let i = 0; i < 10_000; i++) expect(t.add(group("a", { sample: `{"i":${i}}` }), T0 + i)).toBe(false);
    expect(await t.flush(c.sql)).toBe(1);
    expect(c.writes).toEqual(["INSERT"]);
    // The next window, the same hour: the same row counts on.
    t.add(group("a"), T0 + 20_000);
    await t.flush(sql);
    const rows = await sql.all<{ count: number; sample: string; first_seen: number }>("SELECT count, sample, first_seen FROM ops_errors");
    expect(rows).toEqual([{ count: 10_002, sample: "{}", first_seen: T0 }]);
  });

  it("at most maxRowsPerFlush rows a write (the most frequent; the rest wait for the next), at most maxGroups kinds in memory (more dropped and logged)", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const t = new ErrorTally();
    for (let g = 0; g < OPS.store.maxGroups + 50; g++) for (let n = 0; n <= g % 7; n++) t.add(group(`g${g}`), T0);
    expect(log).not.toHaveBeenCalled();
    const c = counting(sql);
    expect(await t.flush(c.sql)).toBe(OPS.store.maxRowsPerFlush);
    expect(c.writes).toHaveLength(OPS.store.maxRowsPerFlush);
    const kept = await sql.all<{ count: number }>("SELECT count FROM ops_errors");
    expect(kept.every((r) => r.count === 7)).toBe(true);
    expect(log).toHaveBeenCalledWith({ ops: "errors-dropped", count: expect.any(Number) });
    // The rest are written at the next writes, the most frequent first, until none are left.
    expect(t.pending).toBe(OPS.store.maxGroups - OPS.store.maxRowsPerFlush);
    expect(await t.flush(sql)).toBe(OPS.store.maxRowsPerFlush);
    while (t.pending) await t.flush(sql);
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM ops_errors"))!.n).toBe(OPS.store.maxGroups);
    expect(await t.flush(sql)).toBe(0);
    log.mockRestore();
  });

  it("one address counts once per kind per write window: a device repeating an error can't push others out", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const t = new ErrorTally();
    for (let i = 0; i < 1000; i++) t.add(group("loud"), T0, "10.9.9.9");
    for (let i = 0; i < 3; i++) t.add(group("real"), T0, `10.8.8.${i}`);
    for (let g = 0; g < OPS.store.maxRowsPerFlush; g++) for (let i = 0; i < 2; i++) t.add(group(`two${g}`), T0, `10.7.7.${i}`);
    await t.flush(sql);
    const rows = await sql.all<{ fingerprint: string; count: number }>("SELECT fingerprint, count FROM ops_errors ORDER BY count DESC, fingerprint");
    expect(rows[0]).toEqual({ fingerprint: "real", count: 3 });
    expect(rows.find((r) => r.fingerprint === "loud")?.count ?? 1).toBe(1);
    // A new window: that address counts once more.
    t.add(group("loud"), T0 + 1, "10.9.9.9");
    while (t.pending) await t.flush(sql);
    expect((await sql.first<{ count: number }>("SELECT count FROM ops_errors WHERE fingerprint = 'loud'"))!.count).toBe(2);
  });

  it("an error's row keeps a small sample: a few kilobytes at most, whatever was sent", () => {
    // Every field at its longest, in characters that take 3 bytes each (or 2 as JSON escapes).
    const wide = (n: number) => "€\"".repeat(n);
    const p = readProblem({
      kind: "errors",
      version: "abc1234def56",
      device: { ua: wide(500), viewport: "12345x12345@99.999", memory: 1024 },
      account: "a".repeat(64),
      errors: [{ kind: wide(50), message: wide(500), stack: wide(2000), where: { screen: wide(100), mode: wide(50), boss: wide(50), code: "ABCDE" }, trail: Array.from({ length: 40 }, () => wide(100)) }],
    })!;
    if (p.kind !== "errors") throw new Error("errors expected");
    const sample = errorSample(p.errors[0]!, p.diag, "a".repeat(64), T0);
    expect(JSON.parse(sample).trail).toHaveLength(OPS.store.sampleCrumbs);
    expect(new TextEncoder().encode(sample).length).toBeLessThan(7_000);
  });

  it("the database's own cap: at most maxNewErrorsPerHour new kinds an hour (a cap line logged); stored kinds keep counting", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const t = new ErrorTally();
    const cap = OPS.store.maxNewErrorsPerHour;
    for (let i = 0; i < cap + 10; i += OPS.store.maxRowsPerFlush) {
      for (let j = i; j < i + OPS.store.maxRowsPerFlush; j++) t.add(group(`kind${j}`), T0);
      await t.flush(sql);
    }
    t.add(group("kind0"), T0 + 1000);
    await t.flush(sql);
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM ops_errors"))!.n).toBe(cap);
    expect((await sql.first<{ count: number }>("SELECT count FROM ops_errors WHERE fingerprint = 'kind0'"))!.count).toBe(2);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ ops: "cap", what: "new kinds of error an hour" }));
    // The next hour starts afresh.
    t.add(group("later"), T0 + HOUR);
    await t.flush(sql);
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM ops_errors WHERE fingerprint = 'later'"))!.n).toBe(1);
    log.mockRestore();
  });

  it("writes the first at once, then at most once per flushMs, one wait at a time", async () => {
    const t = new ErrorTally();
    const bg = background();
    let writes = 0;
    const write = async () => void writes++;
    t.schedule(Date.now(), write, bg.waitUntil);
    expect(writes).toBe(1);
    for (let i = 0; i < 50; i++) t.schedule(Date.now(), write, bg.waitUntil);
    expect(writes).toBe(1);
    await vi.advanceTimersByTimeAsync(OPS.store.flushMs - 1);
    expect(writes).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await bg.settle();
    expect(writes).toBe(2);
  });

  it("a wait its request's end cut short doesn't stop later ones", async () => {
    const t = new ErrorTally();
    const lost: Promise<unknown>[] = [];
    let later = 0;
    const now = Date.now();
    t.schedule(now, async () => undefined, () => undefined);
    // (This wait's timer never fires: its request ended.)
    t.schedule(now + 1, async () => undefined, (p) => void lost.push(p));
    const bg = background();
    const write = async () => void later++;
    t.schedule(now + OPS.store.flushMs, write, bg.waitUntil);
    expect(later).toBe(1);
    t.schedule(now + OPS.store.flushMs + 1, write, bg.waitUntil);
    await vi.advanceTimersByTimeAsync(2 * OPS.store.flushMs);
    await bg.settle();
    expect(later).toBe(2);
  });
});

describe("rate limits", () => {
  it("errors: per account, then per address; reports have their own, tighter, limits", () => {
    const now = T0;
    const L = OPS.endpoint;
    for (let i = 0; i < L.errors.perUser.limit; i++) expect(problemLimited("errors", { ip: "9.9.9.1", session: tok("s-errors") }, now)).toBeNull();
    expect(problemLimited("errors", { ip: "9.9.9.2", session: tok("s-errors") }, now)).toBeGreaterThan(0);
    // Another account behind the same address goes ahead, until the address's own limit.
    expect(problemLimited("errors", { ip: "9.9.9.1", session: tok("s-other") }, now)).toBeNull();
    for (let i = 0; i < L.errors.perIp.limit; i++) problemLimited("errors", { ip: "9.9.9.3", session: null }, now);
    expect(problemLimited("errors", { ip: "9.9.9.3", session: tok(`s-${Math.random()}`) }, now)).toBeGreaterThan(0);
    for (let i = 0; i < L.reports.perUser.limit; i++) expect(problemLimited("report", { ip: "9.9.9.4", session: tok("s-report") }, now)).toBeNull();
    expect(problemLimited("report", { ip: "9.9.9.5", session: tok("s-report") }, now)).toBeGreaterThan(0);
    // A window later, it goes ahead again.
    expect(problemLimited("errors", { ip: "9.9.9.6", session: tok("s-errors") }, now + L.errors.perUser.windowMs)).toBeNull();
  });

  it("an account is counted only for a cookie shaped like a session token, and not when the address is already refused", () => {
    const now = T0 + 7 * DAY;
    const L = OPS.endpoint.reports;
    expect(isSessionToken(tok("a"))).toBe(true);
    for (const v of [null, "", "short", `${tok("a")}x`, tok("a").replace("x", "!")]) expect(isSessionToken(v)).toBe(false);
    // A refused address uses up nothing of the account's limit.
    for (let i = 0; i < L.perIp.limit; i++) problemLimited("report", { ip: "9.8.0.1", session: null }, now);
    for (let i = 0; i < 20; i++) expect(problemLimited("report", { ip: "9.8.0.1", session: tok("s-fresh") }, now)).toBeGreaterThan(0);
    for (let i = 0; i < L.perUser.limit; i++) expect(problemLimited("report", { ip: `9.8.1.${i}`, session: tok("s-fresh") }, now)).toBeNull();
    expect(problemLimited("report", { ip: "9.8.2.1", session: tok("s-fresh") }, now)).toBeGreaterThan(0);
    // A cookie not shaped like a session token is no key: only the address counts.
    for (let i = 0; i < L.perUser.limit + 3; i++) expect(problemLimited("report", { ip: `9.8.3.${i}`, session: "made-up" }, now)).toBeNull();
  });
});

describe("POST /api/problems", () => {
  it("413 past the size cap, 400 for anything that isn't a problem", async () => {
    const { d1 } = memoryDb();
    const bg = background();
    expect((await handleProblems(post(null, { raw: "x".repeat(OPS.endpoint.maxBytes + 1) }), { DB: d1 }, bg.waitUntil)).status).toBe(413);
    expect((await handleProblems(post(null, { raw: "{not json" }), { DB: d1 }, bg.waitUntil)).status).toBe(400);
    expect((await handleProblems(post({ kind: "errors", errors: "no" }), { DB: d1 }, bg.waitUntil)).status).toBe(400);
    expect((await handleProblems(new Request("https://hunchess.com/api/problems"), { DB: d1 }, bg.waitUntil)).status).toBe(404);
  });

  it("only JSON from this site's own pages: a form's post or another site's is refused before the body is read", async () => {
    const { d1 } = memoryDb();
    const bg = background();
    const body = { kind: "idea", note: "cross" };
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", ""]) {
      expect((await handleProblems(post(body, { headers: { "content-type": type } }), { DB: d1 }, bg.waitUntil)).status, type).toBe(415);
    }
    for (const site of ["cross-site", "same-site", "none"]) {
      expect((await handleProblems(post(body, { headers: { "sec-fetch-site": site } }), { DB: d1 }, bg.waitUntil)).status, site).toBe(403);
    }
    await vi.advanceTimersByTimeAsync(60_000);
    expect((await handleProblems(post(body, { headers: { "sec-fetch-site": "same-origin", "content-type": "application/json; charset=utf-8" } }), { DB: d1 }, bg.waitUntil)).status).toBe(200);
  });

  it("errors land in D1 grouped by fingerprint, with the account only when it's this session's", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const g = await createGuest(sql, T0, "Pat");
    const pat = await signInWithIdentity(sql, g.user, "email", "pat@example.com", {}, T0);
    const token = await createSession(sql, pat.id, T0);
    const bg = background();
    const env = { DB: d1, ASSETS };
    const res = await handleProblems(post({ kind: "errors", version: "abc1234def56", device, account: pat.id, errors: [anError(), anError("ReferenceError: nope")] }, { session: token }), env, bg.waitUntil);
    expect(res.status).toBe(200);
    // Someone else's account id, claimed: not kept.
    await handleProblems(post({ kind: "errors", version: "abc1234def56", device, account: pat.id, errors: [anError()] }, { session: tok("someone-else") }), env, bg.waitUntil);
    // The same error twice in one request, or again from that address this window: counted once.
    await handleProblems(post({ kind: "errors", version: "abc1234def56", device, errors: [anError("ReferenceError: nope"), anError("ReferenceError: nope")] }, { ip: "10.1.1.1" }), env, bg.waitUntil);
    await handleProblems(post({ kind: "errors", version: "abc1234def56", device, errors: [anError("ReferenceError: nope")] }, { ip: "10.1.1.1" }), env, bg.waitUntil);
    await flushed(bg);
    const top = await topErrors(sql, Date.now());
    expect(top.map((e) => [e.message, e.day, e.week])).toEqual([
      ["TypeError: Cannot read properties of undefined (reading 'board')", 2, 2],
      ["ReferenceError: nope", 2, 2],
    ]);
    const sample = JSON.parse(top[0]!.sample) as { account: string | null; where: unknown; device: unknown; version: string };
    expect(sample).toMatchObject({ account: null, where, device, version: "abc1234def56", trail: anError().trail });
    const patsWrite = await handleProblems(post({ kind: "errors", version: "abc1234def56", device, account: pat.id, errors: [anError("Error: pat's own")] }, { session: token }), env, bg.waitUntil);
    expect(patsWrite.status).toBe(200);
    await flushed(bg);
    expect(JSON.parse((await topErrors(sql, Date.now(), 30, "pat's own"))[0]!.sample).account).toBe(pat.id);
    expect(JSON.stringify(await sql.all("SELECT * FROM ops_errors"))).not.toContain("pat@example.com");
  });

  it("a bug report is stored at once and answers with its short id; each instance writes a few a minute at most", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const bg = background();
    await vi.advanceTimersByTimeAsync(60_000);
    const res = await handleProblems(post({ kind: "bug", note: "The board froze after Freeze! Email me: pat@example.com", where, trail: ["1.0s boss"], recent: [], version: "dev", device }), { DB: d1 }, bg.waitUntil);
    const { id } = (await res.json()) as { id: string };
    expect(id).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    const row = (await reportById(sql, id))!;
    expect(row).toMatchObject({ kind: "bug", version: "dev", note: "The board froze after Freeze! Email me: [email]" });
    expect(JSON.parse(row.diag)).toMatchObject({ where, trail: ["1.0s boss"], device, version: "dev", account: null });
    // This instance's cap: more reports in the same minute (from anyone) wait.
    let last = 200;
    for (let i = 0; i < OPS.store.maxReportsPerMinute; i++) last = (await handleProblems(post({ kind: "idea", note: `r${i}` }, { session: `s-cap-${i}` }), { DB: d1 }, bg.waitUntil)).status;
    expect(last).toBe(503);
  });

  it("feedback and ideas keep their note alone: no diagnostics, version or account, even from a signed-in player", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const pat = await signInWithIdentity(sql, (await createGuest(sql, T0, "Pat")).user, "email", "pat@example.com", {}, T0);
    const token = await createSession(sql, pat.id, T0);
    const bg = background();
    await vi.advanceTimersByTimeAsync(60_000);
    const ids: string[] = [];
    for (const kind of ["feedback", "idea"]) {
      const res = await handleProblems(post({ kind, note: `${kind}: more bosses`, where, trail: ["1.0s home"], recent: [{ kind: "error", message: "x" }], version: "abc1234def56", device, account: pat.id }, { session: token }), { DB: d1 }, bg.waitUntil);
      ids.push(((await res.json()) as { id: string }).id);
    }
    expect(await sql.all("SELECT kind, account, version, note, diag FROM ops_reports ORDER BY kind")).toEqual([
      { kind: "feedback", account: null, version: "", note: "feedback: more bosses", diag: "{}" },
      { kind: "idea", account: null, version: "", note: "idea: more bosses", diag: "{}" },
    ]);
    expect(ids.every((id) => /^[A-HJKMNP-Z2-9]{6}$/.test(id))).toBe(true);
    expect((await latestReports(sql, 30, "idea")).map((r) => r.note)).toEqual(["idea: more bosses"]);
    expect(await latestReports(sql)).toHaveLength(2);
  });

  it("a device that answered the age question too young types nothing to us: a bug keeps no note, feedback and ideas aren't taken", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const bg = background();
    await vi.advanceTimersByTimeAsync(60_000);
    const young = { headers: { cookie: "hc_age=under" } };
    const res = await handleProblems(post({ kind: "bug", note: "I'm Sam Lee, 11, from Ohio", where, trail: ["1.0s boss"], recent: [], version: "dev", device }, young), { DB: d1 }, bg.waitUntil);
    expect(res.status).toBe(200);
    const row = (await reportById(sql, ((await res.json()) as { id: string }).id))!;
    expect(row).toMatchObject({ kind: "bug", note: "" });
    expect(JSON.parse(row.diag)).toMatchObject({ where, device });
    for (const kind of ["feedback", "idea"]) {
      expect((await handleProblems(post({ kind, note: "I'm Sam Lee" }, young), { DB: d1 }, bg.waitUntil)).status, kind).toBe(400);
    }
    expect(await sql.all("SELECT kind, note FROM ops_reports")).toEqual([{ kind: "bug", note: "" }]);
    // (An "old enough" answer, or none, changes nothing.)
    const ok = await handleProblems(post({ kind: "idea", note: "more bosses" }, { headers: { cookie: "hc_age=ok" } }), { DB: d1 }, bg.waitUntil);
    expect(ok.status).toBe(200);
  });

  it("the database's own cap: at most maxReportsPerDay reports a day, whatever the instance (a cap line logged)", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await vi.advanceTimersByTimeAsync(60_000);
    const now = Date.now();
    await sql.run(
      "INSERT INTO ops_reports (id, at, kind, account, version, note, diag) SELECT printf('R%05d', value), ?, 'idea', NULL, '', 'x', '{}' FROM json_each(?)",
      now - HOUR,
      JSON.stringify(Array.from({ length: OPS.store.maxReportsPerDay }, (_, i) => i)),
    );
    // (The cap is in the insert itself: two instances counting at once can't both write past it.)
    expect(await saveReport(sql, readProblem({ kind: "idea", note: "direct" }) as never, null, now)).toBeNull();
    const res = await handleProblems(post({ kind: "idea", note: "one more" }), { DB: d1 }, background().waitUntil);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ message: "Too many reports right now. Try again in a minute." });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ ops: "cap", what: "player reports a day" }));
    // A day on, it takes reports again.
    await vi.advanceTimersByTimeAsync(24 * HOUR);
    expect((await handleProblems(post({ kind: "idea", note: "next day" }), { DB: d1 }, background().waitUntil)).status).toBe(200);
    log.mockRestore();
  });

  it("429 past an account's limit", async () => {
    const { d1 } = memoryDb();
    const bg = background();
    const statuses: number[] = [];
    for (let i = 0; i <= OPS.endpoint.errors.perUser.limit; i++) {
      statuses.push((await handleProblems(post({ kind: "errors", errors: [anError(`Error: ${i}`)] }, { session: tok("s-429") }), { DB: d1 }, bg.waitUntil)).status);
    }
    expect(statuses.slice(0, -1).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    await flushed(bg);
  });
});

describe("the server's own errors", () => {
  it("a Durable Object's entry point: thrown on as before, logged once, counted with its class, method and lobby code", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const bg = background();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    class Thing {
      env = { DB: d1, ASSETS };
      ctx = { waitUntil: bg.waitUntil } as unknown as DurableObjectState;
      record = { code: "ABCDE" };
      async alarm(): Promise<void> {
        throw new Error("alarm broke");
      }
      async fine(n: number): Promise<number> {
        return n + 1;
      }
    }
    guardEntries(Thing, "Thing", ["alarm", "fine"]);
    const t = new Thing();
    expect(await t.fine(1)).toBe(2);
    await expect(t.alarm()).rejects.toThrow("alarm broke");
    await expect(t.alarm()).rejects.toThrow("alarm broke");
    await flushed(bg);
    const lines = log.mock.calls.map((c) => c[0] as { ops?: string; kind?: string; code?: string }).filter((l) => l.ops === "error");
    expect(lines).toEqual([expect.objectContaining({ kind: "Thing.alarm", route: "Thing.alarm", code: "ABCDE", version: "abc1234def56" })]);
    const rows = await sql.all<{ source: string; kind: string; message: string; count: number; sample: string }>("SELECT source, kind, message, count, sample FROM ops_errors");
    expect(rows.map((r) => [r.source, r.kind, r.message, r.count])).toEqual([["server", "Thing.alarm", "Error: alarm broke", 2]]);
    expect(JSON.parse(rows[0]!.sample)).toMatchObject({ route: "Thing.alarm", code: "ABCDE", version: "abc1234def56" });
    log.mockRestore();
  });

  it("the lobby or party code in a path: only where one goes, the whole segment", () => {
    expect(codeInPath("/api/lobby/ABCDE/ws")).toBe("ABCDE");
    expect(codeInPath("/api/lobby/abcde")).toBe("ABCDE");
    expect(codeInPath("/api/squads/party/WXYZ2/join")).toBe("WXYZ2");
    expect(codeInPath("/api/squads/lobby/K3K3K")).toBe("K3K3K");
    for (const path of ["/api/lobby/ABCDEF", "/api/lobby/ABCD1", "/api/me/ABCDE", "/x/api/lobby/ABCDE", "/api/squads/ABCDE", "/api/lobbyABCDE/x"]) expect(codeInPath(path), path).toBeNull();
  });

  it("the cron: old rows failing to go is logged and counted, and fair play's deep check still runs", async () => {
    const { d1 } = memoryDb();
    const seen: string[] = [];
    const db = new Proxy(d1, {
      get(target, key) {
        if (key !== "prepare") return Reflect.get(target, key);
        return (q: string) => {
          seen.push(q);
          if (q.startsWith("DELETE FROM ops_errors")) throw new Error("D1_ERROR: busy");
          return target.prepare(q);
        };
      },
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException() {} } as unknown as ExecutionContext;
    await worker.scheduled({} as ScheduledController, { DB: db, ASSETS, ENGINE: {} } as unknown as Env, ctx);
    // (Each piece of background work to its end, the clock moving on while it waits for the tally's next write.)
    while (pending.length) {
      let done = false;
      void pending.shift()!.finally(() => (done = true));
      while (!done) await vi.advanceTimersByTimeAsync(1_000);
    }
    expect(seen.some((q) => q.includes("FROM fairplay_matches"))).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ ops: "error", kind: "cron", route: "prune" }));
    log.mockRestore();
  });
});

describe("keeping and reading", () => {
  it("prunes errors and reports older than keepDays; the top errors count the last 24 hours and 7 days apart", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const now = T0;
    const t = new ErrorTally();
    const at = (ago: number, fp: string, n: number, version = "abc1234def56") => {
      for (let i = 0; i < n; i++) t.add(group(fp, { version }), now - ago);
      return t.flush(sql);
    };
    await at(2 * HOUR, "recent", 3, "bbb2222bbb22");
    await at(3 * DAY, "recent", 5);
    await at(3 * DAY, "older", 9);
    await at(OPS.store.keepDays * DAY + 2 * HOUR, "ancient", 1);
    await sql.run("INSERT INTO ops_reports (id, at, kind, account, version, note, diag) VALUES ('AAAAAA', ?, 'bug', NULL, 'dev', '', '{}'), ('BBBBBB', ?, 'idea', NULL, '', 'x', '{}')", now - DAY, now - (OPS.store.keepDays + 1) * DAY);
    const top = await topErrors(sql, now);
    expect(top.map((e) => [e.fingerprint, e.day, e.week])).toEqual([
      ["recent", 3, 8],
      ["older", 0, 9],
    ]);
    expect(top[0]!.versions.split(",").sort()).toEqual(["abc1234def56", "bbb2222bbb22"]);
    expect(top[0]!.firstSeen).toBe(now - 3 * DAY);
    expect((await topErrors(sql, now, 30, "older")).map((e) => e.fingerprint)).toEqual(["older"]);
    await pruneProblems(sql, now);
    expect((await sql.all<{ fingerprint: string }>("SELECT DISTINCT fingerprint FROM ops_errors ORDER BY fingerprint")).map((r) => r.fingerprint)).toEqual(["older", "recent"]);
    expect((await sql.all<{ id: string }>("SELECT id FROM ops_reports")).map((r) => r.id)).toEqual(["AAAAAA"]);
  });
});

describe("/admin/ops", () => {
  it("is Not found for anyone but an admin; an admin sees the errors and finds a report by its id", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const t = new ErrorTally();
    t.add(group("e1", { message: "TypeError: <b>oops</b>", sample: JSON.stringify({ where }) }), Date.now());
    await t.flush(sql);
    await sql.run("INSERT INTO ops_reports (id, at, kind, account, version, note, diag) VALUES ('CDEFGH', ?, 'bug', NULL, 'dev', 'stuck on the vote', ?)", Date.now(), JSON.stringify({ where }));
    await sql.run("INSERT INTO ops_reports (id, at, kind, account, version, note, diag) VALUES ('JKLMNP', ?, 'idea', NULL, '', 'a boss made of dice', '{}')", Date.now());
    const admin = await signInWithIdentity(sql, (await createGuest(sql, T0, "Eric")).user, "email", "eric@example.com", {}, T0);
    const guest = await createGuest(sql, T0, "Guest");
    const env = { DB: d1, ADMIN_EMAILS: "eric@example.com", ASSETS };
    const get = async (path: string, token?: string) =>
      (await handleOpsAdmin(new Request(`https://hunchess.com${path}`, { headers: token ? { cookie: `hc_session=${token}` } : {} }), env))!;
    expect((await get("/admin/ops")).status).toBe(404);
    expect((await get("/admin/ops", guest.token)).status).toBe(404);
    expect(await handleOpsAdmin(new Request("https://hunchess.com/admin/fairplay"), env)).toBeNull();
    const token = await createSession(sql, admin.id, T0);
    const page = await (await get("/admin/ops?report=cdefgh", token)).text();
    expect(page).toContain("Report CDEFGH");
    expect(page).toContain("stuck on the vote");
    expect(page).toContain("TypeError: &lt;b&gt;oops&lt;/b&gt;");
    expect(page).toContain("abc1234def56");
    // Reports of one kind: the ideas as a list.
    const ideas = await (await get("/admin/ops?kind=idea", token)).text();
    expect(ideas).toContain("a boss made of dice");
    expect(ideas).not.toContain("stuck on the vote");
  });
});
