import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RANKED_1V1 } from "@chessroyale/core";
import { DUEL_PROTOCOL, DUEL_UPDATE, type DuelServerMessage } from "@chessroyale/chess/duel";
import { createGuest, d1Sql, ensureSchema } from "../src/accounts.ts";
import { duelEntrant, duelGamesOf, rankedRecordOf } from "../src/ranked.ts";
import { DuelGame } from "../src/duel-do.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Ranked 1 v 1's game object (duel-do.ts) on a fake runtime: a game through to checkmate over its sockets, recorded in
 * D1 once with each player told what it did for them, picked up again after a restart, its alarm on the next thing
 * due, and closed (everything deleted) once its results have been up their time.
 */

class FakeSocket {
  sent: DuelServerMessage[] = [];
  closed: number | null = null;
  private attachment: unknown = null;
  serializeAttachment(a: unknown) {
    this.attachment = JSON.parse(JSON.stringify(a));
  }
  deserializeAttachment() {
    return this.attachment;
  }
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close(code: number) {
    this.closed = code;
  }
  last<T extends DuelServerMessage["t"]>(t: T) {
    return [...this.sent].reverse().find((m) => m.t === t) as Extract<DuelServerMessage, { t: T }> | undefined;
  }
}

const T0 = 1_800_000_000_000;

/**
 * A fake runtime: storage (writes counted), alarms, sockets, waitUntil. `envExtra`: the Worker's variables;
 * `slowDb`: D1's next batch hangs until `failBatch` is called (a recording slow to fail, or cut short by an eviction).
 */
async function runtime(envExtra: Record<string, string> = {}) {
  const store = new Map<string, unknown>();
  const writes = { put: 0 };
  let alarm: number | null = null;
  const sockets: FakeSocket[] = [];
  const pending: Promise<unknown>[] = [];
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const ctx = {
    storage: {
      get: async (k: string) => clone(store.get(k)),
      put: async (k: string, v: unknown) => {
        writes.put++;
        store.set(k, clone(v));
      },
      setAlarm: async (t: number) => void (alarm = t),
      deleteAlarm: async () => void (alarm = null),
      deleteAll: async () => store.clear(),
    },
    getWebSockets: () => sockets.filter((s) => s.closed === null),
    waitUntil: (p: Promise<unknown>) => void pending.push(p.catch(() => undefined)),
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn(),
  };
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql);
  const ann = (await createGuest(sql, T0, "Ann")).user;
  const bob = (await createGuest(sql, T0, "Bob")).user;
  const slow = { hang: false, fail: null as ((e: Error) => void) | null };
  const db = new Proxy(d1 as object, {
    get(t, k) {
      if (k === "batch" && slow.hang)
        return () =>
          new Promise((_, reject) => {
            slow.hang = false;
            slow.fail = reject;
          });
      const v = (t as Record<string | symbol, unknown>)[k as string];
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
    },
  });
  const env = { DB: db, ...envExtra } as never;
  const make = async () => {
    const g = new DuelGame(ctx as unknown as DurableObjectState, env);
    await Promise.resolve();
    return g;
  };
  const socket = (color: "w" | "b", uid: string) => {
    const ws = new FakeSocket();
    ws.serializeAttachment({ color, uid });
    sockets.push(ws);
    return ws;
  };
  const settle = async () => {
    while (pending.length) await pending.shift();
  };
  return { store, writes, slow, sockets, make, socket, settle, sql, ann, bob, d1, get alarm() { return alarm; } };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

describe("the 1 v 1 game object", () => {
  it("a game to checkmate over its sockets: recorded once, each player told, then closed and forgotten", async () => {
    const rt = await runtime();
    const game = await rt.make();
    const players = { w: (await duelEntrant(d1Sql(rt.d1), rt.ann)).player, b: (await duelEntrant(d1Sql(rt.d1), rt.bob)).player };
    expect(await game.create("ABCDE", players)).toBe(true);
    expect(await game.create("ABCDE", players)).toBe(false);
    expect(rt.alarm).toBe(T0 + RANKED_1V1.joinSeconds * 1000);
    const w = rt.socket("w", rt.ann.id);
    const b = rt.socket("b", rt.bob.id);
    await game.webSocketMessage(w as never, JSON.stringify({ t: "hello", v: DUEL_PROTOCOL }));
    await game.webSocketMessage(b as never, JSON.stringify({ t: "hello", v: DUEL_PROTOCOL }));
    expect(b.last("game")!.game.phase).toBe("versus");
    expect(b.last("chatLog")!.packs.length).toBeGreaterThan(0);
    // The vote, the overlay, play: on its alarms.
    vi.setSystemTime(T0 + RANKED_1V1.versusMs + 100);
    await game.webSocketMessage(w as never, JSON.stringify({ t: "pick", zone: "bullet" }));
    for (const t of [T0 + RANKED_1V1.versusMs + RANKED_1V1.voteSeconds * 1000, T0 + RANKED_1V1.versusMs + RANKED_1V1.voteSeconds * 1000 + RANKED_1V1.overlayMs]) {
      expect(rt.alarm).toBe(t);
      vi.setSystemTime(t);
      await game.alarm();
    }
    expect(w.last("game")!.game).toMatchObject({ phase: "play", control: "bullet" });
    // A restart picks it up where it was.
    const again = await rt.make();
    for (const [i, m] of ["f2f3", "e7e5", "g2g4", "d8h4"].entries()) {
      vi.setSystemTime(Date.now() + 1000);
      await again.webSocketMessage((i % 2 ? b : w) as never, JSON.stringify({ t: "move", uci: m, ply: i }));
    }
    expect(b.last("game")!.game.end).toMatchObject({ result: "0-1", reason: "checkmate" });
    await rt.settle();
    expect(w.last("outcome")!.outcome.change!.after.label).toBe("Placement 1/5");
    expect(b.last("outcome")!.outcome.change!.after.label).toBe("Placement 1/5");
    const sql = d1Sql(rt.d1);
    expect((await rankedRecordOf(sql, rt.bob.id)).record).toMatchObject({ games: 1, wins: 1 });
    expect((await duelGamesOf(sql, rt.ann.id))[0]).toMatchObject({ result: "0-1", reason: "checkmate", control: "bullet" });
    // Closed once the results have been up their time: everything deleted, the sockets told.
    const end = (rt.store.get("game") as { closeAt: number }).closeAt;
    expect(rt.alarm).toBe(end);
    vi.setSystemTime(end);
    await again.alarm();
    expect(rt.store.size).toBe(0);
    expect(w.last("closed")).toBeDefined();
    expect(await again.exists()).toBe(false);
  });

  it("Cancel just as it paired (abandon): called off before anyone arrives, nothing recorded; a stranger can't", async () => {
    const rt = await runtime();
    const game = await rt.make();
    const sql = d1Sql(rt.d1);
    await game.create("ABCDE", { w: (await duelEntrant(sql, rt.ann)).player, b: (await duelEntrant(sql, rt.bob)).player });
    await game.abandon("someone-else");
    expect(await game.status()).toMatchObject({ phase: "waiting" });
    await game.abandon(rt.bob.id);
    expect((rt.store.get("game") as { noShow: { result: string; reason: string; by: string } }).noShow).toMatchObject({ result: "aborted", reason: "abort", by: "b" });
    expect(await game.status()).toMatchObject({ phase: "over" });
    expect((await rankedRecordOf(sql, rt.ann.id)).stored).toBe(false);
    expect(await duelGamesOf(sql, rt.ann.id)).toEqual([]);
  });

  it("a recording lost mid-way (slow to fail, or cut short by an eviction) is tried again on a wake; the alarm never spins meanwhile", async () => {
    const rt = await runtime();
    const sql = d1Sql(rt.d1);
    const game = await rt.make();
    await game.create("ABCDE", { w: (await duelEntrant(sql, rt.ann)).player, b: (await duelEntrant(sql, rt.bob)).player });
    const w = rt.socket("w", rt.ann.id);
    const b = rt.socket("b", rt.bob.id);
    await game.webSocketMessage(w as never, JSON.stringify({ t: "hello", v: DUEL_PROTOCOL }));
    await game.webSocketMessage(b as never, JSON.stringify({ t: "hello", v: DUEL_PROTOCOL }));
    vi.setSystemTime(T0 + RANKED_1V1.versusMs + RANKED_1V1.voteSeconds * 1000 + RANKED_1V1.overlayMs);
    await game.alarm();
    await game.alarm();
    rt.slow.hang = true;
    for (const [i, m] of ["f2f3", "e7e5", "g2g4", "d8h4"].entries()) {
      vi.setSystemTime(Date.now() + 1000);
      await game.webSocketMessage((i % 2 ? b : w) as never, JSON.stringify({ t: "move", uci: m, ply: i }));
    }
    for (let i = 0; i < 100 && !rt.slow.fail; i++) await Promise.resolve();
    expect(rt.slow.fail).not.toBeNull();
    // Still recording at its retry time: the alarm moves on, never into the past (no tight loop), and no second try.
    const end = Date.now();
    vi.setSystemTime(end + 20_000);
    await game.alarm();
    expect(rt.alarm).toBeGreaterThanOrEqual(end + 20_000 + 15_000);
    // The slow try fails at last; a later alarm tries again, and this time it goes in.
    rt.slow.fail!(new Error("D1 timed out"));
    await rt.settle();
    vi.setSystemTime(rt.alarm!);
    await game.alarm();
    await rt.settle();
    expect(w.last("outcome")!.outcome.change!.after.label).toBe("Placement 1/5");
    expect(await duelGamesOf(sql, rt.ann.id)).toHaveLength(1);
    // An eviction mid-recording: a fresh object from storage (outcome not stored) records again on its alarm, harmlessly.
    const stored = rt.store.get("game") as { outcomes: unknown; recordTries: number };
    expect(stored.outcomes).not.toBeNull();
    rt.store.set("game", { ...stored, outcomes: null });
    const fresh = await rt.make();
    vi.setSystemTime(Date.now() + 15_000);
    await fresh.alarm();
    await rt.settle();
    expect(await duelGamesOf(sql, rt.ann.id)).toHaveLength(1);
    expect((await rankedRecordOf(sql, rt.bob.id)).record).toMatchObject({ games: 1, wins: 1 });
    // (Recorded before: each hears their rank as it stands, with no points named.)
    expect(w.last("outcome")!.outcome).toMatchObject({ change: { points: null, after: { label: "Placement 1/5" } }, coins: 0 });
  });

  it("a game on a test's clock where test switches are off is unranked: nothing recorded, no coins", async () => {
    for (const [envExtra, ranked] of [[{}, false], [{ TEST_SWITCHES: "1" }, true]] as const) {
      vi.setSystemTime(T0);
      const rt = await runtime(envExtra);
      const sql = d1Sql(rt.d1);
      const game = await rt.make();
      await game.create("ABCDE", { w: (await duelEntrant(sql, rt.ann)).player, b: (await duelEntrant(sql, rt.bob)).player }, { testSeconds: 30 });
      const w = rt.socket("w", rt.ann.id);
      const b = rt.socket("b", rt.bob.id);
      await game.webSocketMessage(w as never, JSON.stringify({ t: "hello", v: DUEL_PROTOCOL }));
      await game.webSocketMessage(b as never, JSON.stringify({ t: "hello", v: DUEL_PROTOCOL }));
      vi.setSystemTime(T0 + RANKED_1V1.versusMs + RANKED_1V1.voteSeconds * 1000 + RANKED_1V1.overlayMs);
      await game.alarm();
      await game.alarm();
      for (const [i, m] of ["f2f3", "e7e5", "g2g4", "d8h4"].entries()) {
        vi.setSystemTime(Date.now() + 1000);
        await game.webSocketMessage((i % 2 ? b : w) as never, JSON.stringify({ t: "move", uci: m, ply: i }));
      }
      await rt.settle();
      if (ranked) expect(b.last("outcome")!.outcome.change!.after.label).toBe("Placement 1/5");
      else expect(b.last("outcome")!.outcome).toEqual({ change: null, coins: 0, unranked: true });
      expect(await duelGamesOf(sql, rt.ann.id)).toHaveLength(ranked ? 1 : 0);
      expect((await rankedRecordOf(sql, rt.bob.id)).stored).toBe(ranked);
    }
  });

  it("an app on another protocol is told to reload; a sync or a refused move stores nothing", async () => {
    const rt = await runtime();
    const sql = d1Sql(rt.d1);
    const game = await rt.make();
    await game.create("ABCDE", { w: (await duelEntrant(sql, rt.ann)).player, b: (await duelEntrant(sql, rt.bob)).player });
    const w = rt.socket("w", rt.ann.id);
    const b = rt.socket("b", rt.bob.id);
    await game.webSocketMessage(w as never, JSON.stringify({ t: "hello", v: DUEL_PROTOCOL + 1 }));
    expect(w.last("error")).toMatchObject({ message: DUEL_UPDATE, reload: true });
    expect(w.last("welcome")).toBeUndefined();
    await game.webSocketMessage(w as never, JSON.stringify({ t: "hello", v: DUEL_PROTOCOL }));
    await game.webSocketMessage(b as never, JSON.stringify({ t: "hello", v: DUEL_PROTOCOL }));
    vi.setSystemTime(T0 + RANKED_1V1.versusMs + RANKED_1V1.voteSeconds * 1000 + RANKED_1V1.overlayMs);
    await game.alarm();
    await game.alarm();
    await game.webSocketMessage(w as never, JSON.stringify({ t: "move", uci: "e2e4", ply: 0 }));
    const before = rt.writes.put;
    for (let i = 0; i < 20; i++) await game.webSocketMessage(w as never, JSON.stringify({ t: "sync" }));
    for (let i = 0; i < 20; i++) await game.webSocketMessage(w as never, JSON.stringify({ t: "move", uci: "d2d4", ply: 1 }));
    expect(rt.writes.put).toBe(before);
    expect(w.last("moveNo")).toMatchObject({ ply: 1 });
  });

  it("never a game with a seat nobody can take: create refuses a missing player", async () => {
    const rt = await runtime();
    const game = await rt.make();
    const sql = d1Sql(rt.d1);
    const bob = (await duelEntrant(sql, rt.bob)).player;
    await expect(game.create("ABCDE", { w: undefined as never, b: bob })).rejects.toThrow();
    await expect(game.create("ABCDE", { w: bob, b: bob })).rejects.toThrow();
    expect(rt.store.size).toBe(0);
  });

  it("only its two players get in", async () => {
    const rt = await runtime();
    const game = await rt.make();
    const sql = d1Sql(rt.d1);
    await game.create("ABCDE", { w: (await duelEntrant(sql, rt.ann)).player, b: (await duelEntrant(sql, rt.bob)).player });
    const res = await game.fetch(new Request("https://x/api/1v1/game/ABCDE/ws", { headers: { Upgrade: "websocket" } }));
    expect(res.status).toBe(403);
  });
});
