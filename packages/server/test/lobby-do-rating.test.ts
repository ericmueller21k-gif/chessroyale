import { describe, expect, it, vi } from "vitest";
import { RAID_SETTINGS, raidBossElo } from "@chessroyale/core";
import { createGuest, ensureSchema, recordResult, signInWithIdentity, type Sql } from "../src/accounts.ts";
import type { LobbyRecord } from "../src/lobby.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: not here.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));
import { Lobby } from "../src/lobby-do.ts";

/**
 * A raid's boss plays a step above its people's average rating. That rating is the one stored on each player's account
 * (`users.rating`), which the lobby's Durable Object reads as they join, never the number their app sends: an app
 * claiming a low rating would otherwise meet a weaker boss (docs/decisions/2026-10-16-server-side-rating.md).
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

/** An account whose ranked matches left it `rating` (none: no rating yet); signed in with an email, or a guest's. */
async function account(sql: Sql, name: string, rating: number | null, signedIn: boolean): Promise<string> {
  const now = Date.now();
  const guest = await createGuest(sql, now, name);
  const id = signedIn ? (await signInWithIdentity(sql, guest.user, "email", `${name.toLowerCase()}@example.com`, {}, now)).id : guest.user.id;
  if (rating !== null) await recordResult(sql, id, { mode: "crowd", online: true, placement: 1, players: 100, rating, ranked: true }, now);
  return id;
}

/** A private raid's Durable Object on a fake runtime, with D1 (unless `db` is false: no accounts at all). */
async function raid(db = true) {
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
  // (No sign-in secrets: sign-in isn't required here, so a guest's account plays online as anyone's does.)
  const lobby = new Lobby(ctx as unknown as DurableObjectState, (db ? { DB: d1 } : {}) as never);
  await loading;
  await lobby.create("RAIDS", { ...RAID_SETTINGS } as LobbyRecord["overrides"]);
  const record = () => store.get("lobby") as LobbyRecord;
  /** Someone joins (on a socket opened with `userId`'s session; none: no account), their app claiming `claimed`. */
  const join = async (name: string, userId: string | undefined, claimed: number) => {
    const ws = new FakeSocket();
    ws.serializeAttachment({ userId, guest: false, banned: false });
    sockets.push(ws);
    // (Raw JSON: the protocol has no rating any more, but an app can still send one.)
    await lobby.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ t: "hello", name, device: "computer", rating: claimed }));
    expect(ws.sent.some((m) => m.t === "welcome")).toBe(true);
    return ws;
  };
  const ratings = () => Object.fromEntries(record().humans.map((h) => [h.name, h.rating ?? null]));
  /** The host starts the raid: its boss's strength (the tier, before the boss's own offset). */
  const start = async (host: FakeSocket) => {
    await lobby.webSocketMessage(host as unknown as WebSocket, JSON.stringify({ t: "start" }));
    expect(record().phase).not.toBe("lobby");
    return record().overrides?.bossFixedElo;
  };
  return { sql, join, ratings, start };
}

describe("a raid's boss strength comes from the ratings the server stores", () => {
  it("signed in: a low rating claimed is ignored; the lobby takes the account's, and the boss follows it", async () => {
    const R = await raid();
    const ann = await account(R.sql, "Ann", 2350, true);
    const host = await R.join("Ann", ann, 400);
    expect(R.ratings()).toEqual({ Ann: 2350 });
    // The boss a step above 2350 (2400), not above the 400 claimed (1400).
    expect(await R.start(host)).toBe(raidBossElo([2350]));
    expect(raidBossElo([2350])).toBe(2400);
    expect(raidBossElo([400])).toBe(1400);
  });

  it("a guest: their guest account's stored rating if it has one, else the prior, whatever they claim", async () => {
    const R = await raid();
    const gus = await account(R.sql, "Gus", 2150, false);
    const hal = await account(R.sql, "Hal", null, false);
    const host = await R.join("Gus", gus, 400);
    await R.join("Hal", hal, 3000);
    expect(R.ratings()).toEqual({ Gus: 2150, Hal: null });
    // (2150 + the prior's 1500) / 2 = 1825: the boss at 2000, not at the claims' 1800.
    expect(await R.start(host)).toBe(2000);
    expect(raidBossElo([400, 3000])).toBe(1800);
  });

  it("signed in and a guest in one raid: both claims ignored", async () => {
    const R = await raid();
    const ann = await account(R.sql, "Ann", 2350, true);
    const gus = await account(R.sql, "Gus", 2150, false);
    const host = await R.join("Ann", ann, 400);
    await R.join("Gus", gus, 400);
    expect(R.ratings()).toEqual({ Ann: 2350, Gus: 2150 });
    expect(await R.start(host)).toBe(raidBossElo([2350, 2150]));
  });

  it("no account at all (no session, or no accounts here): the prior, whatever they claim", async () => {
    const R = await raid();
    const host = await R.join("Ann", undefined, 3190);
    expect(R.ratings()).toEqual({ Ann: null });
    expect(await R.start(host)).toBe(raidBossElo([null]));
    const S = await raid(false);
    const solo = await S.join("Bo", "u-bo", 400);
    expect(S.ratings()).toEqual({ Bo: null });
    expect(await S.start(solo)).toBe(raidBossElo([null]));
  });
});
