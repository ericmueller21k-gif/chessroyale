import { afterEach, describe, expect, it, vi } from "vitest";
import { CAPACITY, FAIRPLAY, FRONT_DOOR } from "@chessroyale/core";

// (The real container needs the Workers runtime; nothing here searches.)
vi.mock("@cloudflare/containers", () => ({ Container: class {}, getContainer: () => null }));

import { createGuest, createSession, ensureSchema, signInWithIdentity } from "../src/accounts.ts";
import { forgetAccessKeys, viaAccess } from "../src/access.ts";
import { engineHealth, markEngine } from "../src/engine.ts";
import { health } from "../src/health.ts";
import { LiveBoard, LiveReporter, type LobbySummary } from "../src/live.ts";
import { handleOpsAdmin } from "../src/ops-admin.ts";
import { ErrorTally } from "../src/problems.ts";
import { squadsLiveSummary, type SquadsRecord } from "../src/squads-lobby.ts";
import { memoryDb } from "./memory-db.ts";

/** The health view (health.ts), its Access check (access.ts) and Squads on the live hub (DECISIONS.md, "Health"). */

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 15, 18, 30);
const TEAM = "team.cloudflareaccess.com";
const AUD = "aud-tag-0123";
const ASSETS = { fetch: async () => new Response(JSON.stringify({ version: "abc1234def56", commit: "abc1234def56".padEnd(40, "0"), built: "2026-10-15T18:00:00.000Z" })) } as unknown as Fetcher;

afterEach(() => {
  vi.unstubAllGlobals();
  forgetAccessKeys();
});

// ---------------- Access ----------------

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const part = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

/** A signing key like the team's, its public half as Access publishes it, and a token signer. */
async function team() {
  const pair = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "k1" };
  const sign = async (claims: Record<string, unknown>, header: Record<string, unknown> = { alg: "RS256", kid: "k1" }) => {
    const data = `${part(header)}.${part(claims)}`;
    const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(data)));
    return `${data}.${b64url(sig)}`;
  };
  const asked: string[] = [];
  const fetcher = (async (url: string) => {
    asked.push(String(url));
    return new Response(JSON.stringify({ keys: [jwk] }));
  }) as unknown as typeof fetch;
  return { sign, fetcher, asked };
}
const good = { aud: [AUD], iss: `https://${TEAM}`, exp: NOW / 1000 + 600, common_name: "client-id.access" };
const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
const withToken = (jwt: string) => new Request("https://hunchess.com/api/admin/health", { headers: { "cf-access-jwt-assertion": jwt } });

describe("Access's token", () => {
  it("passes when it's the team's signature, for this application, unexpired; keys fetched once", async () => {
    const t = await team();
    expect(await viaAccess(withToken(await t.sign(good)), env, NOW, t.fetcher)).toBe(true);
    expect(await viaAccess(withToken(await t.sign(good)), env, NOW + 1000, t.fetcher)).toBe(true);
    expect(t.asked).toEqual([`https://${TEAM}/cdn-cgi/access/certs`]);
  });

  it("fails for another application, another team, an expired or altered token, another algorithm, or without config", async () => {
    const t = await team();
    const no = async (jwt: string, e: Record<string, string> = env) => expect(await viaAccess(withToken(jwt), e, NOW, t.fetcher)).toBe(false);
    await no(await t.sign({ ...good, aud: ["another-app"] }));
    await no(await t.sign({ ...good, iss: "https://evil.cloudflareaccess.com" }));
    await no(await t.sign({ ...good, exp: NOW / 1000 - 1 }));
    await no(await t.sign(good, { alg: "HS256", kid: "k1" }));
    const [h, , s] = (await t.sign(good)).split(".");
    await no(`${h}.${part({ ...good, aud: [AUD, "x"] })}.${s}`);
    await no("not.a-token");
    await no(await t.sign(good), { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: "" });
    expect(await viaAccess(new Request("https://hunchess.com/"), env, NOW, t.fetcher)).toBe(false);
  });

  it("an unknown key id asks for the keys again, at most once a minute", async () => {
    const t = await team();
    expect(await viaAccess(withToken(await t.sign(good)), env, NOW, t.fetcher)).toBe(true);
    const rotated = await t.sign(good, { alg: "RS256", kid: "k2" });
    expect(await viaAccess(withToken(rotated), env, NOW + 61_000, t.fetcher)).toBe(false);
    expect(await viaAccess(withToken(rotated), env, NOW + 62_000, t.fetcher)).toBe(false);
    expect(t.asked).toHaveLength(2);
  });
});

// ---------------- Squads on the live hub ----------------

const lobby = (code: string, patch: Partial<LobbySummary> = {}): LobbySummary => ({ code, mode: "crowd", kind: "queue", phase: "playing", humans: 3, alive: 80, total: 100, bossElo: null, startedAt: NOW - 60_000, ...patch });

describe("Squads on the live hub", () => {
  it("counts for the overload limit and the health view, never on the home page's public line", () => {
    const b = new LiveBoard();
    b.report(lobby("AAAAA"), NOW);
    b.report(lobby("SQUAD", { mode: "squads", humans: 9, alive: null, total: null }), NOW);
    b.report(lobby("SQWAT", { mode: "squads", phase: "waiting", humans: 4, alive: null, total: null }), NOW);
    const pub = b.counts(NOW, { crowd: null, boss: null });
    expect(pub).toMatchObject({ matches: 1, queue: 0 });
    expect(pub.playing.map((p) => p.mode)).toEqual(["crowd"]);
    expect(b.players(NOW)).toBe(16);
    expect(b.health(NOW)).toMatchObject({ players: 16, modes: { crowd: { playing: 1, waiting: 0, humans: 3 }, squads: { playing: 1, waiting: 1, humans: 13 }, boss: { playing: 0 } } });
    // A lobby that stopped reporting drops out of every count.
    expect(b.health(NOW + FRONT_DOOR.matchStaleMs + 1).players).toBe(0);
  });

  it("a Squads lobby's summary: its phase as the live line has them, the people connected, matchmade or a test", () => {
    const human = (connected: boolean, left?: true) => ({ connected, ...(left ? { left } : {}) });
    const rec = { code: "SQUAD", phase: "bracket", auto: true, filledAt: NOW, humans: [human(true), human(false), human(true, true), human(true)] } as unknown as SquadsRecord;
    expect(squadsLiveSummary(rec)).toEqual({ code: "SQUAD", mode: "squads", kind: "queue", phase: "playing", humans: 2, alive: null, total: null, bossElo: null, startedAt: NOW });
    expect(squadsLiveSummary({ ...rec, phase: "filled", auto: false })).toMatchObject({ phase: "waiting", kind: "private" });
    expect(squadsLiveSummary({ ...rec, phase: "results" }).phase).toBe("over");
  });

  it("reports when something changes or a minute on, at most every lobbyReportMs, the latest state following", () => {
    const r = new LiveReporter();
    const gap = CAPACITY.presence.lobbyReportMs;
    expect(r.next("playing:4", false, NOW)).toBe("now");
    expect(r.next("playing:4", false, NOW + 30_000)).toBeNull();
    expect(r.next("playing:5", false, NOW + 30_000 + gap)).toBe("now");
    expect(r.next("playing:6", false, NOW + 30_000 + gap + 500)).toBe(gap - 500);
    expect(r.next("playing:7", false, NOW + 30_000 + gap + 600)).toBeNull();
    expect(r.next("playing:7", false, NOW + 30_000 + 2 * gap, true)).toBe("now");
    expect(r.next("playing:7", false, NOW + 30_000 + 2 * gap + 61_000)).toBe("now");
    // The end is said at once, then never again.
    expect(r.next("over:0", true, NOW + 30_000 + 2 * gap + 61_100)).toBe("now");
    expect(r.next("over:0", true, NOW + 999_999)).toBeNull();
  });
});

// ---------------- The engine server's marks ----------------

describe("the engine server's last answer and failure", () => {
  it("are written at most once a minute (an answer) and every 10 s (a failure) per instance, and read back", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const writes: string[] = [];
    const counting = { prepare: (q: string) => (writes.push(q), d1.prepare(q)) } as unknown as D1Database;
    vi.useFakeTimers({ now: NOW });
    for (let i = 0; i < 30; i++) await markEngine({ DB: counting }, true);
    await markEngine({ DB: counting }, false, "no answer in time");
    await markEngine({ DB: counting }, false, "no answer in time");
    expect(writes).toHaveLength(2);
    vi.setSystemTime(NOW + 61_000);
    await markEngine({ DB: counting }, true);
    expect(writes).toHaveLength(3);
    await sql.run("CREATE TABLE IF NOT EXISTS engine_usage (day TEXT PRIMARY KEY, searches INTEGER NOT NULL)");
    await sql.run("INSERT INTO engine_usage (day, searches) VALUES ('2026-10-15', 412)");
    expect(await engineHealth({ DB: d1, ENGINE_DAILY_SEARCHES: "3000" }, NOW + 62_000)).toEqual({
      on: false,
      searches: 412,
      cap: 3000,
      lastOk: NOW + 61_000,
      lastFail: { at: NOW, why: "no answer in time" },
    });
    vi.useRealTimers();
  });
});

// ---------------- The view ----------------

/** A database with an hour's worth of everything the view reads. */
async function seeded() {
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql, d1);
  const t = new ErrorTally();
  const add = async (n: number, at: number, fp: string, kind = "error", source: "client" | "server" = "client") => {
    for (let i = 0; i < n; i++) t.add({ fingerprint: fp, source, kind, message: `Error ${fp}`, version: "abc1234def56", sample: "{}" }, at);
    await t.flush(sql);
  };
  await add(3, NOW - 5 * 60_000, "now");
  await add(2, NOW - 70 * 60_000, "now");
  await add(4, NOW - 5 * HOUR, "old");
  await add(1, NOW - 10 * 60_000, "alarm", "Lobby.alarm", "server");
  await add(2, NOW - 3 * HOUR, "hub", "LiveHub.report", "server");
  await add(9, NOW - 30 * HOUR, "gone");
  await sql.run(
    "INSERT INTO ops_reports (id, at, kind, account, version, note, diag) VALUES ('AAAAAA', ?, 'bug', NULL, 'dev', 'froze', '{}'), ('BBBBBB', ?, 'idea', NULL, '', 'dice boss', '{}'), ('CCCCCC', ?, 'idea', NULL, '', 'old', '{}')",
    NOW - HOUR,
    NOW - 2 * HOUR,
    NOW - 30 * HOUR,
  );
  await sql.run("INSERT INTO fairplay_budget (day, searches) VALUES ('2026-10-15', 120)");
  return { sql, d1 };
}

const liveStub = {
  idFromName: () => "id",
  get: () => ({ health: async () => ({ online: 12, players: 7, modes: { crowd: { waiting: 0, playing: 1, humans: 5 }, boss: { waiting: 0, playing: 0, humans: 0 }, classic: { waiting: 0, playing: 0, humans: 0 }, squads: { waiting: 1, playing: 0, humans: 2 } } }) }),
} as unknown as DurableObjectNamespace<never>;

describe("the health view", () => {
  it("what's deployed, who's playing, errors this hour, the hour before and today, the Durable Objects', reports, budgets, D1", async () => {
    const { sql, d1 } = await seeded();
    const h = await health({ DB: d1, ASSETS, LIVE: liveStub as never }, sql, NOW);
    expect(h.deploy).toEqual({ version: "abc1234def56", commit: "abc1234def56".padEnd(40, "0"), built: "2026-10-15T18:00:00.000Z" });
    expect(h.live).toMatchObject({ online: 12, players: 7 });
    expect(h.errors).toMatchObject({ thisHour: 4, lastHour: 2, day: 12, kinds: 4 });
    expect(h.errors.top.map((e) => [e.fingerprint, e.thisHour, e.lastHour, e.day])).toEqual([
      ["now", 3, 2, 5],
      ["alarm", 1, 0, 1],
      ["old", 0, 0, 4],
      ["hub", 0, 0, 2],
    ]);
    expect(h.durableObjects).toEqual({ thisHour: 1, lastHour: 0, day: 3, byClass: { Lobby: 1, LiveHub: 2 }, byEntry: { "Lobby.alarm": 1, "LiveHub.report": 2 } });
    expect(h.reports.day).toEqual({ bug: 1, idea: 1 });
    expect(h.reports.latest.map((r) => r.id)).toEqual(["AAAAAA", "BBBBBB"]);
    expect(h.fairplay).toEqual({ searches: 120, cap: FAIRPLAY.deep.dailySearches });
    expect(h.engine).toMatchObject({ on: false, searches: 0, lastOk: null, lastFail: null });
    expect(h.d1.ok).toBe(true);
  });

  it("a database that doesn't answer: D1's error, zeros, and still what's deployed", async () => {
    const broken = { first: async () => Promise.reject(new Error("D1 is down")), all: async () => Promise.reject(new Error("D1 is down")), run: async () => undefined };
    const h = await health({ ASSETS }, broken, NOW);
    expect(h.d1).toMatchObject({ ok: false, error: "Error: D1 is down" });
    expect(h.errors).toMatchObject({ thisHour: 0, day: 0, top: [] });
    expect(h.deploy.version).toBe("abc1234def56");
  });

  it("GET /api/admin/health: an admin, or Access's token for this application; Not found for anyone else", async () => {
    const { sql, d1 } = await seeded();
    const t = await team();
    vi.stubGlobal("fetch", t.fetcher);
    const admin = await signInWithIdentity(sql, (await createGuest(sql, NOW, "Eric")).user, "email", "eric@example.com", {}, NOW);
    const adminToken = await createSession(sql, admin.id, NOW);
    const guest = await createGuest(sql, NOW, "Guest");
    const e = { DB: d1, ASSETS, ADMIN_EMAILS: "eric@example.com", ...env };
    const get = (headers: Record<string, string>) => handleOpsAdmin(new Request("https://hunchess.com/api/admin/health", { headers }), e);
    expect((await get({}))!.status).toBe(404);
    expect((await get({ cookie: `hc_session=${guest.token}` }))!.status).toBe(404);
    expect((await get({ "cf-access-jwt-assertion": await t.sign({ ...good, aud: ["other"], exp: Date.now() / 1000 + 600 }) }))!.status).toBe(404);
    const viaAdmin = await get({ cookie: `hc_session=${adminToken}` });
    expect(viaAdmin!.status).toBe(200);
    expect(((await viaAdmin!.json()) as { deploy: { version: string } }).deploy.version).toBe("abc1234def56");
    const viaToken = await get({ "cf-access-jwt-assertion": await t.sign({ ...good, exp: Date.now() / 1000 + 600 }) });
    expect(viaToken!.status).toBe(200);
    expect(((await viaToken!.json()) as { reports: { day: Record<string, number> } }).reports.day).toBeDefined();
    // The page shows it too (admins only, as before).
    const page = await (await handleOpsAdmin(new Request("https://hunchess.com/admin/ops", { headers: { cookie: `hc_session=${adminToken}` } }), e))!.text();
    expect(page).toContain("<h2>Health</h2>");
    expect(page).toContain("Fair play's deep re-checks:");
  });
});
