import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SQUADS_PROTOCOL, type PartyServerMessage } from "@chessroyale/chess/squads";

vi.mock("../src/engine.ts", () => ({ serverScoreAt: async () => null }));
import { SquadsParty } from "../src/squads-do.ts";

/**
 * A Boss Battle party's Durable Object (SquadsParty, kind "boss") on a fake runtime: START makes one battle at a time,
 * and each placement goes with its own START (#420's review, 4).
 */
class FakeSocket {
  sent: PartyServerMessage[] = [];
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
  party() {
    return [...this.sent].reverse().find((m) => m.t === "party") as Extract<PartyServerMessage, { t: "party" }> | undefined;
  }
}

async function runtime(env: object) {
  const store = new Map<string, unknown>();
  const sockets: FakeSocket[] = [];
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const ctx = {
    storage: {
      async get(k: string) {
        return clone(store.get(k));
      },
      async put(k: string, v: unknown) {
        store.set(k, clone(v));
      },
      async setAlarm() {},
      async deleteAlarm() {},
      async deleteAll() {
        store.clear();
      },
    },
    getWebSockets: () => sockets.filter((s) => s.closed === null),
    acceptWebSocket: (ws: FakeSocket) => void sockets.push(ws),
    waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined),
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => (loading = fn()),
  };
  let loading: Promise<unknown> = Promise.resolve();
  const party = new SquadsParty(ctx as unknown as DurableObjectState, env as never);
  await loading;
  const socket = (attached: Record<string, unknown>) => {
    const ws = new FakeSocket();
    ws.serializeAttachment(attached);
    sockets.push(ws);
    return ws;
  };
  return { party, socket };
}

const send = (p: SquadsParty, ws: FakeSocket, msg: object) => p.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(msg));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(10_000_000);
});
afterEach(() => vi.useRealTimers());

describe("a Boss Battle party's Durable Object", () => {
  it("4: one battle per START, even with messages while it's being made; the placement is that START's", async () => {
    const made: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const env = {
      LOBBIES: {
        idFromName: (c: string) => c,
        get: (c: string) => ({
          create: async () => {
            made.push(c);
            await gate;
            return true;
          },
          revokePartyMember: async () => undefined,
        }),
      },
    };
    const { party, socket } = await runtime(env);
    expect(await party.create("PARTY", "", 0, "boss")).toBe(true);
    const eric = socket({ userId: "u1", name: "Eric" });
    const maya = socket({ userId: "u2", name: "Maya" });
    await send(party, eric, { t: "hello", v: SQUADS_PROTOCOL });
    await send(party, maya, { t: "hello", v: SQUADS_PROTOCOL });
    const me = (ws: FakeSocket) => (ws.sent.find((m) => m.t === "welcome") as { memberId: string }).memberId;
    await send(party, maya, { t: "ready", on: true });
    const starting = send(party, eric, { t: "start" });
    // While the battle is being made: more messages (and START again) make no second one.
    await send(party, maya, { t: "look", look: {} });
    await send(party, eric, { t: "start" });
    expect(made).toHaveLength(1);
    release();
    await starting;
    await vi.waitFor(() => expect(maya.party()?.party.placed?.lobby).toBe(made[0]));
    expect(made).toHaveLength(1);
    // Each with their own pass.
    const a = eric.party()!.party.placed!.pass;
    const b = maya.party()!.party.placed!.pass;
    expect(a).not.toBe(b);
    expect(me(eric)).not.toBe(me(maya));
  });

  it("1: a kicked member's socket is closed and their account can't come back without a token", async () => {
    const { party, socket } = await runtime({});
    await party.create("PARTY", "", 0, "boss");
    const eric = socket({ userId: "u1", name: "Eric" });
    const maya = socket({ userId: "u2", name: "Maya" });
    await send(party, eric, { t: "hello", v: SQUADS_PROTOCOL });
    await send(party, maya, { t: "hello", v: SQUADS_PROTOCOL });
    const mayaId = (maya.sent.find((m) => m.t === "welcome") as { memberId: string }).memberId;
    await send(party, eric, { t: "kick", id: mayaId });
    expect(maya.closed).not.toBeNull();
    const again = socket({ userId: "u2", name: "Maya" });
    await send(party, again, { t: "hello", v: SQUADS_PROTOCOL });
    expect(again.sent.at(-1)).toMatchObject({ t: "error", message: "You were removed from the party." });
    expect(again.closed).not.toBeNull();
  });
});
