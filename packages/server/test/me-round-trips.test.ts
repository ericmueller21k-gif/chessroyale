import { describe, expect, it } from "vitest";
import { memoryDb } from "./memory-db.ts";
import { handleAccountApi } from "../src/api.ts";
import { handleFriendsApi } from "../src/friends-api.ts";

/**
 * Home's first requests in D1 round trips (Nov 10: "hunchess just took 30+ seconds to load"; /api/me took 1.1 to 1.7 s live, 29
 * reads one after another at about 40 ms each from a Worker). The fake D1 here holds each statement until the next "wave": statements
 * started together share one, as reads in flight at once do on D1. The counts are the reads in a row a request waits for.
 */
function waved(d1: D1Database) {
  let wave = 0;
  let pending: (() => void)[] | null = null;
  const next = () =>
    new Promise<void>((res) => {
      if (!pending) {
        pending = [];
        setTimeout(() => {
          wave++;
          const p = pending!;
          pending = null;
          for (const f of p) f();
        }, 0);
      }
      pending.push(res);
    });
  type Stmt = { bind(...p: unknown[]): Stmt; run(): Promise<unknown>; first(): Promise<unknown>; all(): Promise<unknown>; inner: unknown };
  const wrap = (s: Stmt): Stmt => ({
    bind: (...p) => wrap(s.bind(...p)),
    run: async () => (await next(), s.run()),
    first: async () => (await next(), s.first()),
    all: async () => (await next(), s.all()),
    inner: s,
  });
  const db = d1 as unknown as { prepare(q: string): Stmt; batch(s: unknown[]): Promise<unknown> };
  const out = {
    prepare: (q: string) => wrap(db.prepare(q)),
    batch: async (ss: Stmt[]) => (await next(), db.batch(ss.map((s) => s.inner))),
  } as unknown as D1Database;
  return { out, reset: () => void (wave = 0), waves: () => wave };
}

describe("home's requests in D1 round trips", () => {
  it("/api/me in at most 5 (was 29), /api/quests in 3 (was 5) and /api/friends in 3 (was 9), for an account with a bit of everything", async () => {
    const { db, d1 } = memoryDb();
    const w = waved(d1);
    const env = { DB: w.out, FRIENDS: "1" };
    const call = async (path: string, cookie?: string) => {
      const headers = new Headers(cookie ? { cookie } : {});
      const req = new Request("https://hunchess.com" + path, { headers });
      const res = (await handleAccountApi(req, env as never, fetch, () => {})) ?? (await handleFriendsApi(req, env as never, () => {}))!;
      const set = res.headers.getSetCookie().find((c) => c.startsWith("hc_session=")) ?? null;
      return { status: res.status, cookie: set?.split(";")[0] ?? cookie, body: (await res.json()) as Record<string, unknown> };
    };
    const me = await call("/api/me?name=Player");
    const other = await call("/api/me?name=Rival");
    const [a, b] = [(me.body.user as { id: string }).id, (other.body.user as { id: string }).id];
    // A bit of everything: results, a ranked ladder at the top tiers (its place is counted), ranked games, an item worn, a friend.
    for (let i = 0; i < 8; i++) db.prepare("INSERT INTO results (user_id, mode, online, placement, players, rating, played_at) VALUES (?, 'crowd', 1, 3, 100, 1500, ?)").run(a, 1000 + i);
    db.prepare("INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, peak) VALUES (?, 2300, 60, 30, 20, 9, 1, 2350, 2400)").run(a);
    for (let i = 0; i < 6; i++)
      db.prepare("INSERT INTO ranked_1v1_games (id, white_id, black_id, control, result, reason, moves, times, started_at, ended_at, nonce) VALUES (?, ?, ?, '5+0', '1-0', 'mate', '', '', 1, ?, 'n')").run(`g${i}`, a, b, 10 + i);
    db.prepare("INSERT INTO items (id, user_id, def, color, blemish, seed, crate, created_at) VALUES ('it1', ?, 'hat-crown', '#fff', 0.1, 1, 'c', 1)").run(a);
    db.prepare("INSERT INTO equipped_items (user_id, slot, item_id) VALUES (?, 'hat', 'it1')").run(a);
    db.prepare("INSERT INTO friends (user_id, friend_id, since) VALUES (?, ?, 1), (?, ?, 1)").run(a, b, b, a);
    await call("/api/quests", me.cookie); // (today's quests dealt)

    const trips = async (path: string) => {
      w.reset();
      const r = await call(path, me.cookie);
      expect(r.status).toBe(200);
      return w.waves();
    };
    expect(await trips("/api/me")).toBeLessThanOrEqual(5);
    expect(await trips("/api/quests")).toBeLessThanOrEqual(3);
    expect(await trips("/api/friends")).toBeLessThanOrEqual(3);
  });
});
