import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RANKED_1V1 } from "@chessroyale/core";
import type { DuelServerMessage } from "@chessroyale/chess/duel";
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

async function runtime() {
  const store = new Map<string, unknown>();
  let alarm: number | null = null;
  const sockets: FakeSocket[] = [];
  const pending: Promise<unknown>[] = [];
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const ctx = {
    storage: {
      get: async (k: string) => clone(store.get(k)),
      put: async (k: string, v: unknown) => void store.set(k, clone(v)),
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
  const env = { DB: d1 } as never;
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
  return { store, sockets, make, socket, settle, sql, ann, bob, d1, get alarm() { return alarm; } };
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
    await game.webSocketMessage(w as never, JSON.stringify({ t: "hello" }));
    await game.webSocketMessage(b as never, JSON.stringify({ t: "hello" }));
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

  it("only its two players get in", async () => {
    const rt = await runtime();
    const game = await rt.make();
    const sql = d1Sql(rt.d1);
    await game.create("ABCDE", { w: (await duelEntrant(sql, rt.ann)).player, b: (await duelEntrant(sql, rt.bob)).player });
    const res = await game.fetch(new Request("https://x/api/1v1/game/ABCDE/ws", { headers: { Upgrade: "websocket" } }));
    expect(res.status).toBe(403);
  });
});
