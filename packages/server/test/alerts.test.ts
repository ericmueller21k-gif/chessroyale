import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALERTS } from "@chessroyale/core";

// (The real container needs the Workers runtime; nothing here searches.)
vi.mock("@cloudflare/containers", () => ({ Container: class {}, getContainer: () => null }));

import { ensureSchema, type Sql } from "../src/accounts.ts";
import { alertState, checkAlerts, forgetAlerts, overLine, type DiscordPost } from "../src/alerts.ts";
import { memoryDb } from "./memory-db.ts";

/** Alerts to Discord (alerts.ts; docs/ideas/live-ops.md, sections 1 and 5). */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
// 4:02 am Central (UTC-6 in November): before the digest's hour.
const NOW = Date.UTC(2026, 10, 10, 10, 2);
const H = Math.floor(NOW / HOUR) * HOUR;
const HOOK = "https://discord.com/api/webhooks/123456789/abc-DEF_1";
const ASSETS = { fetch: async () => new Response(JSON.stringify({ version: "abc1234def56" })) } as unknown as Fetcher;

beforeEach(() => forgetAlerts());

async function setup(extra: Record<string, string> = {}) {
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql, d1);
  const posts: DiscordPost[] = [];
  const env = { DB: d1, ASSETS, ALERT_WEBHOOK: HOOK, ...extra };
  const check = (t: number, over: { sql?: Sql; post?: (b: DiscordPost) => Promise<void> } = {}) =>
    checkAlerts(env, over.sql ?? sql, t, { post: over.post ?? (async (b) => void posts.push(b)), sleep: async () => undefined });
  /** An error row's count for one clock hour (as the error store keeps them: one row per kind of error per hour). */
  const errors = (hour: number, n: number, kind = "fetch", route = "POST /api/play", message = `Error: ${kind} broke`) =>
    sql.run(
      `INSERT INTO ops_errors (fingerprint, hour, source, kind, message, version, count, first_seen, last_seen, sample) VALUES (?, ?, 'server', ?, ?, 'v1', ?, ?, ?, ?)
       ON CONFLICT (fingerprint, hour) DO UPDATE SET count = excluded.count`,
      `${kind} ${route}`,
      hour,
      kind,
      message,
      n,
      hour,
      hour,
      JSON.stringify({ route }),
    );
  return { sql, d1, env, posts, check, errors };
}

describe("alerts to Discord", () => {
  it("the line: a real count (20 in 15 minutes) and 3 times the same hour's normal", () => {
    expect(ALERTS.page).toMatchObject({ minErrors: 20, timesNormal: 3, inARow: 2 });
    expect(overLine(19, 0)).toBe(false);
    expect(overLine(20, 0)).toBe(true);
    // 400 an hour is normal: 100 a window, so 300 to page.
    expect(overLine(299, 400)).toBe(false);
    expect(overLine(300, 400)).toBe(true);
  });

  it("no webhook, one that isn't Discord's, or PAUSE_ALERTS: nothing is read or posted", async () => {
    for (const extra of [{ ALERT_WEBHOOK: "" }, { ALERT_WEBHOOK: "https://example.com/api/webhooks/1/x" }, { PAUSE_ALERTS: "1" }] as Record<string, string>[]) {
      const { check, errors, posts } = await setup(extra);
      await errors(H, 500);
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      expect(await checkAlerts({ ALERT_WEBHOOK: extra.ALERT_WEBHOOK ?? HOOK, ...extra }, { first: () => Promise.reject(new Error("read")) } as unknown as Sql, NOW)).toBeNull();
      expect(await check(NOW)).toBeNull();
      expect(await check(NOW + 15 * MIN)).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
      expect(posts).toEqual([]);
      vi.unstubAllGlobals();
    }
  });

  it("two checks in a row over the line page once; still happening an hour on; recovered after two under", async () => {
    const { check, errors, posts, sql } = await setup();
    await errors(H, 0);
    expect(await check(NOW)).toEqual([]); // (The first check only sets where counting starts.)
    await errors(H, 25);
    expect(await check(NOW + 15 * MIN)).toEqual([]); // One check over: not yet.
    await errors(H, 50);
    expect(await check(NOW + 30 * MIN)).toEqual(["page:play"]);
    const page = posts.at(-1)!;
    expect(page.content).toMatch(/^@everyone 🚨 \*\*PAGE: players may not be able to play\.\*\* errors on the match, lobby and queue routes: 25, then 25/);
    expect(page.content).toContain("```\n50× fetch: Error: fetch broke\n```");
    expect(page.allowed_mentions).toEqual({ parse: ["everyone"] });
    // Still over, within the hour: no repeat.
    await errors(H, 75);
    expect(await check(NOW + 45 * MIN)).toEqual([]);
    await errors(H, 85);
    await errors(H + HOUR, 20); // (Across the hour's turn: 10 + 20.)
    expect(await check(NOW + 60 * MIN)).toEqual([]);
    await errors(H + HOUR, 50);
    expect(await check(NOW + 90 * MIN)).toEqual(["still:play"]);
    expect(posts.at(-1)!.content).toContain("**Still happening** (paged 4:32 AM Central)");
    // Under the line once, then twice: recovered, quietly.
    await errors(H + HOUR, 52);
    expect(await check(NOW + 105 * MIN)).toEqual([]);
    await errors(H + HOUR, 54);
    expect(await check(NOW + 120 * MIN)).toEqual(["recovered:play"]);
    expect(posts.at(-1)!.allowed_mentions).toEqual({ parse: [] });
    expect(posts.at(-1)!.content).not.toContain("@everyone");
    expect((await alertState(sql)).log.map((l) => l.what)).toEqual(["page", "still", "recovered"]);
  });

  it("over, under, over is not two in a row; under 20 never pages; well within normal never pages", async () => {
    const { check, errors, posts } = await setup();
    await errors(H, 0);
    await check(NOW);
    for (const [t, n] of [[15, 30], [30, 31], [45, 61]] as const) {
      await errors(H, n);
      await check(NOW + t * MIN);
    }
    expect(posts).toEqual([]);
    // 19 a window, twice.
    const b = await setup();
    await b.errors(H, 0);
    await b.check(NOW);
    for (const [t, n] of [[15, 19], [30, 38]] as const) {
      await b.errors(H, n);
      await b.check(NOW + t * MIN);
    }
    expect(b.posts).toEqual([]);
    // 400 an hour is this hour's normal (the median of the 7 days before): 250 a window twice is fine, 300 pages.
    const c = await setup();
    for (let d = 1; d <= 7; d++) await c.errors(H - d * DAY, d === 7 ? 5 : 400);
    await c.errors(H, 0);
    await c.check(NOW);
    for (const [t, n] of [[15, 250], [30, 500]] as const) {
      await c.errors(H, n);
      await c.check(NOW + t * MIN);
    }
    expect(c.posts).toEqual([]);
    await c.errors(H, 800);
    await c.check(NOW + 40 * MIN);
    await c.errors(H, 1100);
    expect(await c.check(NOW + 50 * MIN)).toEqual(["page:play"]);
  });

  it("the Durable Objects' errors page on their own; other routes' errors don't count; a failed post is tried again", async () => {
    const { check, errors, posts } = await setup({ ALERT_PING: "424242424242" });
    await errors(H, 0, "Lobby.alarm", "Lobby.alarm");
    await errors(H, 0, "fetch", "GET /api/me");
    await check(NOW);
    await errors(H, 30, "Lobby.alarm", "Lobby.alarm");
    await errors(H, 500, "fetch", "GET /api/me");
    await check(NOW + 15 * MIN);
    await errors(H, 60, "Lobby.alarm", "Lobby.alarm");
    await errors(H, 1000, "fetch", "GET /api/me");
    // Discord down: thrown (the cron counts it), and the page waits for the next check.
    await expect(check(NOW + 30 * MIN, { post: () => Promise.reject(new Error("Discord webhook answered 500")) })).rejects.toThrow("500");
    await errors(H, 90, "Lobby.alarm", "Lobby.alarm");
    expect(await check(NOW + 45 * MIN)).toEqual(["page:durable"]);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.content).toMatch(/^<@424242424242> 🚨 \*\*PAGE.*Durable Object errors: 30, then 30/);
    expect(posts[0]!.content).toContain("Lobby.alarm");
    expect(posts[0]!.allowed_mentions).toEqual({ parse: [], users: ["424242424242"] });
  });

  it("D1 not answering twice, 30 s apart, pages at once; a blip doesn't; once an hour while it lasts; recovered", async () => {
    const { check, posts, sql } = await setup();
    const down = { first: () => Promise.reject(new Error("D1 down")), all: () => Promise.reject(new Error("D1 down")), run: () => Promise.reject(new Error("D1 down")), batch: () => Promise.reject(new Error("D1 down")) } as unknown as Sql;
    // A blip: the second read answers.
    let reads = 0;
    const blip = { ...sql, first: (q: string, ...p: unknown[]) => (reads++ ? sql.first(q, ...p) : Promise.reject(new Error("blip"))) } as Sql;
    expect(await check(NOW, { sql: blip })).toEqual([]);
    const waits: number[] = [];
    const run = (t: number, s: Sql) => checkAlerts({ ALERT_WEBHOOK: HOOK, ASSETS }, s, t, { post: async (b) => void posts.push(b), sleep: async (ms) => void waits.push(ms) });
    expect(await run(NOW + 15 * MIN, down)).toEqual(["page:d1"]);
    expect(waits).toEqual([ALERTS.d1RetryMs]);
    expect(posts.at(-1)!.content).toMatch(/^@everyone \*\*PAGE: D1 isn't answering\*\*/);
    expect(await run(NOW + 30 * MIN, down)).toEqual([]);
    expect(await run(NOW + 75 * MIN, down)).toEqual(["still:d1"]);
    expect(await run(NOW + 90 * MIN, sql)).toEqual(["recovered:d1"]);
    expect(posts.at(-1)!.allowed_mentions).toEqual({ parse: [] });
  });

  it("the morning digest: once a Central day from 8 am, the last 24 hours, players' text only in a code block, no pings", async () => {
    const { check, errors, posts, sql } = await setup();
    const morning = Date.UTC(2026, 10, 10, 14, 5); // 8:05 am Central
    const mh = Math.floor(morning / HOUR) * HOUR;
    await errors(mh - 3 * DAY, 4, "Lobby.alarm", "Lobby.alarm"); // seen before: not new
    await errors(mh - 2 * HOUR, 6, "Lobby.alarm", "Lobby.alarm");
    await errors(mh - HOUR, 3, "fetch", "POST /api/play", "Error: @everyone `boom` <https://example.com>‮");
    await sql.run("INSERT INTO ops_reports (id, at, kind, account, version, note, diag) VALUES ('AB12CD', ?, 'bug', NULL, 'v1', 'board froze ```@here', '{}')", morning - HOUR);
    await check(morning - 10 * MIN); // 7:55: not yet
    expect(posts).toEqual([]);
    expect(await check(morning)).toEqual(["digest"]);
    const d = posts[0]!;
    expect(d.allowed_mentions).toEqual({ parse: [] });
    expect(d.content).toContain("☀️ **HunChess digest, Tue, Nov 10** (the last 24 hours)");
    expect(d.content).toContain("**Pages:** none.");
    expect(d.content).toContain("**Errors:** 9 (the 24 hours before: 0), 2 kinds; 1 new kinds. **Durable Objects:** Lobby.alarm 6.");
    expect(d.content).toContain("**Players' reports:** 1 bugs, 0 feedback, 0 ideas.");
    const [head, code] = d.content.split("```\n");
    expect(head).not.toMatch(/@everyone|@here|boom|froze/);
    expect(code).toContain("[new server error, 3×] fetch: Error: @everyone 'boom' <https://example.com>\n[bug AB12CD] board froze '''@here\n");
    expect(d.content.endsWith("\n```")).toBe(true);
    expect(d.content.length).toBeLessThanOrEqual(2000);
    // Once a day: not again at 8:20, nor at 7:50 the next morning; again at 8:05.
    expect(await check(morning + 15 * MIN)).toEqual([]);
    expect(await check(morning + DAY - 15 * MIN)).toEqual([]);
    expect(await check(morning + DAY)).toEqual(["digest"]);
  });

  it("the digest names the Hidden Boss's fights with no result yesterday too (UTC days), not only since midnight UTC (the delta review of #683, m2)", async () => {
    const { check, posts, sql } = await setup();
    const morning = Date.UTC(2026, 10, 10, 14, 5); // 8:05 am Central, 14:05 UTC
    await sql.run("CREATE TABLE IF NOT EXISTS engine_usage (day TEXT PRIMARY KEY, searches INTEGER NOT NULL)");
    // (A fight at 9 am Central the day before: yesterday's UTC row, which the digest read as "today" missed.)
    await sql.run("INSERT INTO engine_usage (day, searches) VALUES ('2026-11-09:recluse-none', 2)");
    expect(await check(morning)).toEqual(["digest"]);
    expect(posts[0]!.content).toContain("the Hidden Boss's fights with no result (UTC days): yesterday 2, today so far 0.");
  });
});
