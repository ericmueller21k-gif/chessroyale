import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modeSettings } from "@chessroyale/core";
import { SQUADS_PROTOCOL, type PartyServerMessage } from "@chessroyale/chess/squads";
import { createGuest, createSession, ensureSchema, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { setCase } from "../src/fairplay.ts";
import { answerRequest, block, sendInvite, sendRequest, setFriendSettings } from "../src/friends.ts";
import { MATCH_STARTED, type LobbyRecord } from "../src/lobby.ts";
import { CROWD_PARTY_LINES } from "../src/squads-party.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: not here.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));
const { Lobby } = await import("../src/lobby-do.ts");
const { SquadsParty } = await import("../src/squads-do.ts");

/**
 * 50 v 50's party through its Durable Objects on a fake runtime (the fix round of PR #747): the lobby's door (H1, a pooled member's
 * party), and the party's own door and search (L2, L4, L5).
 */

class FakeSocket {
  sent: { t: string; message?: string }[] = [];
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
}

function fakeCtx(sockets: FakeSocket[] = []) {
  const store = new Map<string, unknown>();
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
    getWebSockets: () => sockets.filter((s) => s.closed === null),
    acceptWebSocket: (ws: FakeSocket) => void sockets.push(ws),
    waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined),
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => (loading = fn()),
  };
  return { ctx: ctx as unknown as DurableObjectState, store, loaded: () => loading };
}

async function player(sql: Sql, name: string): Promise<User> {
  const g = await createGuest(sql, 1000, name);
  return signInWithIdentity(sql, g.user, "email", `${name.toLowerCase()}@example.com`, {}, 1000);
}

describe("H1: a party with a pooled member, in the pool's lobby", () => {
  const RealResponse = Response;
  let pair: FakeSocket[] = [];
  beforeEach(() => {
    // (The Workers runtime's WebSocketPair and 101 answer, on Node.)
    vi.stubGlobal("WebSocketPair", function () {
      pair = [new FakeSocket(), new FakeSocket()];
      return pair;
    });
    vi.stubGlobal(
      "Response",
      class extends RealResponse {
        constructor(body?: BodyInit | null, init?: ResponseInit) {
          super(body, init?.status === 101 ? { ...init, status: 200 } : init);
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("its clean member comes in with the party's pass (the server sent them); without it, or once the group is whole, still turned away", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const [ann, bo, cy, di] = [await player(sql, "Ann"), await player(sql, "Bo"), await player(sql, "Cy"), await player(sql, "Di")];
    await setCase(sql, ann.id, "pool", "detection", "level ban: test", Date.now());
    const f = fakeCtx();
    const lobby = new Lobby(f.ctx, { DB: d1 } as never);
    await f.loaded();
    // (Ann pooled: the party's ticket went to the pool's queue, which made this lobby for it: its 2 seats held under the pass.)
    expect(await lobby.create("POOLS", { ...modeSettings("crowd", { augments: true }) } as LobbyRecord["overrides"], { fillAt: Date.now() + 60_000, engine: true, party: { size: 2, pass: "pass-1" } })).toBe(true);
    const join = async (u: User, party?: string) => {
      const headers = { upgrade: "websocket", cookie: `hc_session=${await createSession(sql, u.id, Date.now())}` };
      await lobby.fetch(new Request("https://hunchess.test/api/lobby/POOLS/ws", { headers }));
      const ws = pair[1]!;
      await lobby.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ t: "hello", name: u.name, device: "computer", ...(party ? { party } : {}) }));
      const error = ws.sent.find((m) => m.t === "error");
      return error ? error.message : (ws.deserializeAttachment() as { playerId?: string }).playerId ? "seated" : "nothing";
    };
    expect(await join(cy)).toBe(MATCH_STARTED);
    expect(await join(ann, "pass-1")).toBe("seated");
    expect(await join(bo, "pass-1")).toBe("seated");
    expect((f.store.get("lobby") as LobbyRecord).crowdParties!["pass-1"]!.ids).toHaveLength(2);
    // (The group is whole: the pass lets nobody else past the pool's door.)
    expect(await join(di, "pass-1")).toBe(MATCH_STARTED);
  });
});

describe("the party's Durable Object (kind crowd)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(10_000_000);
  });
  afterEach(() => vi.useRealTimers());

  async function world() {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const now = Date.now();
    const [ann, bo] = [await createGuest(sql, now - 60_000, "Ann"), await createGuest(sql, now - 60_000, "Bo")].map((g) => g.user.id) as [string, string];
    await sendRequest(sql, ann, bo, false, now);
    await answerRequest(sql, bo, ann, true, now);
    const sockets: FakeSocket[] = [];
    const f = fakeCtx(sockets);
    const canceled: [string, string][] = [];
    const matchmaker = (queue: string) => ({
      next: async () => ({ busy: true, ticket: "t-1", position: 4, waitSeconds: 12, retryMs: 3000, message: "Servers are busy" }),
      cancel: async (ticket: string) => (canceled.push([queue, ticket]), {}),
    });
    const env = { DB: d1, MATCHMAKER: { idFromName: (q: string) => q, get: matchmaker } };
    const party = new SquadsParty(f.ctx, env as never);
    await f.loaded();
    expect(await party.create("PRTY2", "crowd-q", 60_000, "crowd", "crowd-pool", ann)).toBe(true);
    const hello = async (userId: string, token?: string) => {
      const ws = new FakeSocket();
      ws.serializeAttachment({ userId, name: userId === ann ? "Ann" : "Bo" });
      sockets.push(ws);
      await party.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ t: "hello", v: SQUADS_PROTOCOL, ...(token ? { token } : {}) }));
      return ws;
    };
    const welcome = (ws: FakeSocket) => ws.sent.find((m) => m.t === "welcome") as Extract<PartyServerMessage, { t: "welcome" }> | undefined;
    const error = (ws: FakeSocket) => ws.sent.find((m) => m.t === "error")?.message;
    const send = (ws: FakeSocket, msg: object) => party.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(msg));
    return { sql, now, ann, bo, party, hello, welcome, error, send, canceled };
  }

  it("L2: an invite taken back since (a block, or their Do Not Disturb) lets nobody in, though the party still lists it", async () => {
    const W = await world();
    await W.hello(W.ann);
    expect(await sendInvite(W.sql, W.ann, W.bo, "crowdparty", "PRTY2", false, W.now)).toMatchObject({ ok: true });
    await W.party.crowdInvited(W.ann, W.bo, "Bo", W.now + 600_000);
    await setFriendSettings(W.sql, W.bo, { dnd: true });
    expect(W.error(await W.hello(W.bo))).toBe(CROWD_PARTY_LINES.invitedOnly);
    await setFriendSettings(W.sql, W.bo, { dnd: false });
    await block(W.sql, W.bo, W.ann, W.now);
    expect(W.error(await W.hello(W.bo))).toBe(CROWD_PARTY_LINES.invitedOnly);
  });

  it("L4: on a shared device, another member's stored token never puts you in their seat: yours is your account's", async () => {
    const W = await world();
    const annWs = await W.hello(W.ann);
    const annSeat = W.welcome(annWs)!;
    expect(await sendInvite(W.sql, W.ann, W.bo, "crowdparty", "PRTY2", false, W.now)).toMatchObject({ ok: true });
    await W.party.crowdInvited(W.ann, W.bo, "Bo", W.now + 600_000);
    // (Bo signs in on Ann's device, which kept her token for this party.)
    const boWs = await W.hello(W.bo, annSeat.token);
    const boSeat = W.welcome(boWs)!;
    expect(boSeat.memberId).not.toBe(annSeat.memberId);
    expect((boWs.deserializeAttachment() as { playerId: string }).playerId).toBe(boSeat.memberId);
    // (And what Bo does is Bo's: his Find match isn't the leader's.)
    await W.send(boWs, { t: "queue" });
    expect((await W.party.status())!.state).toBe("open");
  });

  it("L5: the leader's Cancel takes the party's ticket out of the matchmaker's line, in both queues", async () => {
    const W = await world();
    const annWs = await W.hello(W.ann);
    await W.send(annWs, { t: "queue" });
    expect((await W.party.status())!.state).toBe("queueing");
    expect(W.canceled).toEqual([]);
    await W.send(annWs, { t: "cancel" });
    expect((await W.party.status())!.state).toBe("open");
    expect(W.canceled).toEqual([
      ["crowd-q", "t-1"],
      ["crowd-pool", "t-1"],
    ]);
  });
});
