import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOBBY_LIFE, SQUADS_LOBBY } from "@chessroyale/core";
import { SQUADS_PROTOCOL, squadsLegalMoves, type SquadsServerMessage } from "@chessroyale/chess/squads";
import { SquadsLobby } from "../src/squads-do.ts";

// (The engine server is a Container, which needs the Workers runtime: not here.)
vi.mock("../src/engine.ts", () => ({ serverScoreAt: async () => null }));
import { clearTopCache } from "../src/squads-lobby.ts";

/**
 * The Squads lobby's Durable Object (squads-do.ts) on a fake runtime: it stores each match under its own key and only
 * the ones that changed, picks up where it was after a restart, keeps its alarm on the next thing due, and closes
 * itself (everything deleted) once its results have been up long enough.
 */

class FakeSocket {
  sent: SquadsServerMessage[] = [];
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
  last<T extends SquadsServerMessage["t"]>(t: T) {
    return [...this.sent].reverse().find((m) => m.t === t) as Extract<SquadsServerMessage, { t: T }> | undefined;
  }
}

function runtime() {
  const store = new Map<string, unknown>();
  let alarm: number | null = null;
  const sockets: FakeSocket[] = [];
  const writes: string[][] = [];
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const storage = {
    async get(k: string | string[]) {
      if (Array.isArray(k)) return new Map(k.filter((x) => store.has(x)).map((x) => [x, clone(store.get(x))]));
      return clone(store.get(k));
    },
    async put(k: string | Record<string, unknown>, v?: unknown) {
      const entries = typeof k === "string" ? { [k]: v } : k;
      writes.push(Object.keys(entries));
      for (const [key, val] of Object.entries(entries)) store.set(key, clone(val));
    },
    async setAlarm(t: number) {
      alarm = t;
    },
    async deleteAlarm() {
      alarm = null;
    },
    async deleteAll() {
      store.clear();
    },
  };
  let loading: Promise<unknown> = Promise.resolve();
  const ctx = {
    storage,
    getWebSockets: () => sockets.filter((s) => s.closed === null),
    acceptWebSocket: (ws: FakeSocket) => void sockets.push(ws),
    waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined),
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => (loading = fn()),
  };
  const make = async () => {
    const lobby = new SquadsLobby(ctx as unknown as DurableObjectState, {} as never);
    await loading;
    return lobby;
  };
  /** A socket that has connected (the request's checks done: a signed-in person, or a test player). */
  const socket = (attached: Record<string, unknown> = {}) => {
    const ws = new FakeSocket();
    ws.serializeAttachment(attached);
    sockets.push(ws);
    return ws;
  };
  return {
    store,
    writes,
    make,
    socket,
    get alarm() {
      return alarm;
    },
  };
}

const send = (lobby: SquadsLobby, ws: FakeSocket, msg: object) => lobby.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(msg));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(10_000_000);
  clearTopCache();
});
afterEach(() => vi.useRealTimers());

describe("the Squads lobby's Durable Object", () => {
  it("a test lobby at the final: stored apart by match, restored after a restart, to its results, then closed", async () => {
    const rt = runtime();
    let lobby = await rt.make();
    expect(await lobby.create("SQUAD", { fillAt: Date.now() + 5_000, test: { start: 2 }, keepMs: 30_000 })).toEqual([]);
    expect(rt.alarm).toBe(Date.now() + 5_000);
    const ws = rt.socket({ test: true });
    await send(lobby, ws, { t: "hello", v: SQUADS_PROTOCOL, name: "Ann" });
    const welcome = ws.last("welcome")!;
    expect(welcome).toMatchObject({ v: SQUADS_PROTOCOL, code: "SQUAD", test: true });
    expect(await lobby.status()).toEqual({ phase: "waiting" });
    // Its alarms, as the runtime would ring them.
    const ring = async (until: () => boolean, limit = 50_000) => {
      for (let i = 0; i < limit && !until(); i++) {
        if (rt.alarm === null) throw new Error("no alarm");
        vi.setSystemTime(Math.max(Date.now(), rt.alarm));
        await lobby.alarm();
      }
    };
    await ring(() => !!rt.store.get("m:r2m0"));
    // The final is stored under its own key; nothing else is a match yet.
    expect([...rt.store.keys()].filter((k) => k.startsWith("m:"))).toEqual(["m:r2m0"]);
    await ring(() => ws.sent.some((m) => m.t === "turn"));
    // A restart (the object was evicted): it picks up where it was.
    lobby = await rt.make();
    expect(await lobby.status()).toEqual({ phase: "bracket" });
    // A person's choice after the restart lands in the stored half.
    const turn = ws.last("turn")!;
    const duty = turn.current.duties.find((d) => d.players.includes(welcome.playerId));
    type Stored = { half: { inputs: { choices: Record<string, string> } } | null; m: { boards: { fen: string }[] } };
    const stored = () => rt.store.get("m:r2m0") as Stored;
    if (duty && stored().half) {
      const move = squadsLegalMoves(stored().m.boards[duty.board]!.fen)[0]!;
      await send(lobby, ws, { t: "choose", key: turn.key, seq: turn.current.seq, move });
      expect(stored().half!.inputs.choices[welcome.playerId]).toBe(move);
    }
    // Each store writes the lobby and only the matches that changed.
    expect(rt.writes.every((w) => w.every((k) => k === "lobby" || k.startsWith("m:")))).toBe(true);
    // "Next round" (a test player) ends the final: results.
    await send(lobby, ws, { t: "nextRound" });
    expect(await lobby.status()).toEqual({ phase: "results" });
    expect(ws.last("results")).toBeDefined();
    // Its results stay up (here 30 s, a test's keep), then it closes: everyone told, everything deleted.
    expect(rt.alarm).toBe(Date.now() + 30_000);
    vi.setSystemTime(Date.now() + 30_000);
    await lobby.alarm();
    expect(ws.last("closed")).toMatchObject({ reason: "ended" });
    expect(rt.store.size).toBe(0);
    expect(await lobby.status()).toBeNull();
  }, 60_000);

  it("a lobby nobody fills closes after LOBBY_LIFE's idle time; its code is free again", async () => {
    const rt = runtime();
    const lobby = await rt.make();
    await lobby.create("IDLE2", { fillAt: Date.now() + 60_000, reserve: [{ size: 1, pass: "" }] });
    expect(await lobby.create("IDLE2", { fillAt: null })).toBe(false);
    // (The fill time comes with nobody there: it waits.)
    vi.setSystemTime(Date.now() + 61_000);
    await lobby.alarm();
    expect(await lobby.status()).toEqual({ phase: "waiting" });
    vi.setSystemTime(Date.now() + LOBBY_LIFE.lobbyIdleMinutes * 60_000);
    expect(await lobby.status()).toBeNull();
    expect(await lobby.create("IDLE2", { fillAt: null })).toEqual([]);
  });

  it("a guest where sign-in is needed, or a banned account, is refused on hello", async () => {
    const rt = runtime();
    const lobby = await rt.make();
    await lobby.create("GUEST", { fillAt: Date.now() + 60_000 });
    const guest = rt.socket({ guest: true });
    await send(lobby, guest, { t: "hello", v: SQUADS_PROTOCOL, name: "G" });
    expect(guest.last("error")!.message).toMatch(/Sign in/);
    expect(guest.closed).toBe(1008);
    const banned = rt.socket({ banned: true });
    await send(lobby, banned, { t: "hello", v: SQUADS_PROTOCOL, name: "B" });
    expect(banned.last("error")).toMatchObject({ banned: true });
    void SQUADS_LOBBY;
  });

  it("a seat takes its account's name, whatever the device asks for (a moderator's reset sticks); no account's name: the device's", async () => {
    const rt = runtime();
    const lobby = await rt.make();
    await lobby.create("NAMES", { fillAt: Date.now() + 60_000 });
    // (The account's name comes with the socket: whoIsAsking reads it with the session as they connect.)
    await send(lobby, rt.socket({ userId: "u1", name: "Player" }), { t: "hello", v: SQUADS_PROTOCOL, name: "Rude Name" });
    await send(lobby, rt.socket({}), { t: "hello", v: SQUADS_PROTOCOL, name: "Ann" });
    expect((rt.store.get("lobby") as { humans: { name: string }[] }).humans.map((h) => h.name)).toEqual(["Player", "Ann"]);
  });
});
