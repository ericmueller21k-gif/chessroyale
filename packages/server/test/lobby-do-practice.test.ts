import { describe, expect, it, vi } from "vitest";

// (The engine server is a Container, which needs the Workers runtime: not here.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));
import { Lobby } from "../src/lobby-do.ts";

/**
 * Practice mode online (unlimited power-ups: the engine's top 3 at any time) is for testers only (Eric, Oct 15): the
 * lobby's Durable Object takes a `hello`'s practice flag only from an admin's socket (ADMIN_EMAILS, checked when the
 * socket opened) or where TEST_SWITCHES is "1". From a player it's ignored, so they play as everyone does.
 */

class FakeSocket {
  sent: { t: string }[] = [];
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
  close() {}
}

/** A lobby's Durable Object on a fake runtime, with the Worker variables given. */
async function lobby(env: Record<string, string> = {}) {
  const store = new Map<string, unknown>();
  const sockets: FakeSocket[] = [];
  let loading: Promise<unknown> = Promise.resolve();
  const ctx = {
    storage: {
      get: async (k: string) => store.get(k),
      list: async () => new Map(),
      put: async (k: string | Record<string, unknown>, v?: unknown) => {
        for (const [key, val] of Object.entries(typeof k === "string" ? { [k]: v } : k)) store.set(key, JSON.parse(JSON.stringify(val)));
      },
      setAlarm: async () => undefined,
      deleteAlarm: async () => undefined,
      deleteAll: async () => store.clear(),
    },
    getWebSockets: () => sockets,
    acceptWebSocket: (ws: FakeSocket) => void sockets.push(ws),
    waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined),
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => (loading = fn()),
  };
  const lobby = new Lobby(ctx as unknown as DurableObjectState, env as never);
  await loading;
  await lobby.create("PRACT");
  /** Someone joins asking for practice mode, on a socket opened as `attached` says (an admin's, or a player's). */
  const join = async (name: string, attached: { admin?: boolean } = {}) => {
    const ws = new FakeSocket();
    ws.serializeAttachment({ userId: `u-${name}`, guest: false, banned: false, ...attached });
    sockets.push(ws);
    await lobby.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ t: "hello", name, device: "computer", practice: true }));
    expect(ws.sent.some((m) => m.t === "welcome")).toBe(true);
  };
  const practicing = () => {
    const record = store.get("lobby") as { humans: { name: string; practice?: boolean }[] };
    return Object.fromEntries(record.humans.map((h) => [h.name, !!h.practice]));
  };
  return { join, practicing };
}

describe("practice mode online: testers only", () => {
  it("a player's request is ignored; an admin's counts", async () => {
    const L = await lobby();
    await L.join("Player");
    await L.join("Admin", { admin: true });
    expect(L.practicing()).toEqual({ Player: false, Admin: true });
  });

  it("where TEST_SWITCHES is on (local, the e2e, staging), anyone's counts", async () => {
    const L = await lobby({ TEST_SWITCHES: "1" });
    await L.join("Tester");
    expect(L.practicing()).toEqual({ Tester: true });
    // (Only exactly "1".)
    const M = await lobby({ TEST_SWITCHES: "true" });
    await M.join("Player");
    expect(M.practicing()).toEqual({ Player: false });
  });
});
