import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAT_MOD, modeSettings } from "@chessroyale/core";
import { createGuest, ensureSchema, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { decideChat } from "../src/chat-mod.ts";
import type { LobbyRecord } from "../src/lobby.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: not here.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));
import { Lobby } from "../src/lobby-do.ts";

/**
 * Chat moderation in a lobby's Durable Object (lobby-do.ts; docs/decisions/2026-10-16-chat-moderation.md): it reads a
 * player's chat ban as they join and again at most every CHAT_MOD.recheckMs as they chat, a read that fails never
 * stops them joining or chatting, and a seat takes its account's name (so a moderator's reset sticks).
 */

class FakeSocket {
  sent: { t: string; reason?: string; line?: { say: string } }[] = [];
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

async function account(sql: Sql, name: string): Promise<string> {
  const guest = await createGuest(sql, Date.now(), name);
  return (await signInWithIdentity(sql, guest.user, "email", `${name.toLowerCase()}@example.com`, {}, Date.now())).id;
}

/** A private Crowd lobby's Durable Object on a fake runtime, with D1. */
async function lobby() {
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
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql);
  const lobby = new Lobby(ctx as unknown as DurableObjectState, { DB: d1 } as never);
  await loading;
  await lobby.create("CHATS", JSON.parse(JSON.stringify(modeSettings("crowd", { augments: false }))) as LobbyRecord["overrides"]);
  const record = () => store.get("lobby") as LobbyRecord;
  /** Someone joins on their account's socket, their device asking for `name`. */
  const join = async (name: string, userId: string) => {
    const ws = new FakeSocket();
    ws.serializeAttachment({ userId, guest: false, banned: false });
    sockets.push(ws);
    await lobby.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ t: "hello", name, device: "computer" }));
    expect(ws.sent.some((m) => m.t === "welcome")).toBe(true);
    return ws;
  };
  const say = (ws: FakeSocket, line: string) => lobby.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ t: "chat", say: line }));
  const refused = (ws: FakeSocket) => ws.sent.filter((m) => m.t === "chatNo").map((m) => m.reason);
  const heard = (ws: FakeSocket) => ws.sent.filter((m) => m.t === "chat").map((m) => m.line!.say);
  return { sql, record, join, say, refused, heard };
}

describe("a lobby's Durable Object: chat bans", () => {
  afterEach(() => vi.useRealTimers());

  it("a ban is read as they join: their first line is refused, and others' still reach them", async () => {
    const L = await lobby();
    const [ann, troll] = [await account(L.sql, "Ann"), await account(L.sql, "Troll")];
    await decideChat(L.sql, troll, { action: "ban", days: 1, reason: "spamming taunts" }, "admin:e", Date.now());
    const a = await L.join("Ann", ann);
    const t = await L.join("Troll", troll);
    await L.say(t, "gg");
    expect(L.refused(t)).toEqual(["mod"]);
    expect(L.heard(a)).toEqual([]);
    await L.say(a, "hi-all");
    expect(L.heard(t)).toEqual(["hi-all"]);
  });

  it("a ban decided after they joined reaches the lobby once CHAT_MOD.recheckMs has passed, as they chat; a lift the same way", async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ["Date"] });
    const L = await lobby();
    const troll = await account(L.sql, "Troll");
    const t = await L.join("Troll", troll);
    await decideChat(L.sql, troll, { action: "ban", days: "forever", reason: "slurs again and again" }, "admin:e", Date.now());
    // (Read as they joined, a moment ago: not read again yet.)
    await L.say(t, "gg");
    expect(L.refused(t)).toEqual([]);
    vi.advanceTimersByTime(CHAT_MOD.recheckMs);
    await L.say(t, "wow");
    expect(L.refused(t)).toEqual(["mod"]);
    await decideChat(L.sql, troll, { action: "lift", reason: "appealed by email" }, "admin:e", Date.now());
    vi.advanceTimersByTime(CHAT_MOD.recheckMs);
    await L.say(t, "oops");
    expect(L.refused(t)).toEqual(["mod"]);
    expect(L.heard(t)).toEqual(["gg", "oops"]);
  });

  it("a read that fails stops nothing: they join and chat", async () => {
    vi.useFakeTimers({ now: Date.now(), toFake: ["Date"] });
    const L = await lobby();
    const ann = await account(L.sql, "Ann");
    await L.sql.run("DROP TABLE chat_mod_log");
    const a = await L.join("Ann", ann);
    await L.say(a, "gg");
    vi.advanceTimersByTime(CHAT_MOD.recheckMs);
    await L.say(a, "wow");
    expect(L.refused(a)).toEqual([]);
    expect(L.heard(a)).toEqual(["gg", "wow"]);
  });

  it("a seat takes its account's name, whatever the device asks for (a moderator's reset sticks)", async () => {
    const L = await lobby();
    const troll = await account(L.sql, "Troll");
    await decideChat(L.sql, troll, { action: "reset", reason: "rude name" }, "admin:e", Date.now());
    await L.join("Rude Name", troll);
    expect(L.record().humans.map((h) => h.name)).toEqual(["Player"]);
  });
});
