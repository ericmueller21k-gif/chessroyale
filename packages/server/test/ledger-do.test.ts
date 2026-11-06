import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOBBY_LIFE, RAID_SETTINGS, SQUADS_LOBBY } from "@chessroyale/core";
import { createGuest, ensureSchema, signInWithIdentity, type Sql } from "../src/accounts.ts";
import type { LobbyRecord } from "../src/lobby.ts";
import type { SquadsRecord, SquadsReward } from "../src/squads-lobby.ts";
import { ledgerAccount, ledgerMismatches } from "../src/ledger.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: not here.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));
import { Lobby } from "../src/lobby-do.ts";
import { SquadsLobby } from "../src/squads-do.ts";

/**
 * The ledger's part II in the match rooms (lobby-do.ts, squads-do.ts) on a fake runtime with D1: a room that stops between writing to
 * D1 and storing that it did writes again when it wakes, and the ledger's keys make that pay once; a Squads reward that fails to write
 * stays in the record and is written on the next alarm, once.
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

/** A Durable Object's storage, alarm and sockets; `failPut` makes a store throw (the object stops there). */
function runtime() {
  const store = new Map<string, unknown>();
  const sockets: FakeSocket[] = [];
  const pending: Promise<unknown>[] = [];
  let alarm: number | null = null;
  let loading: Promise<unknown> = Promise.resolve();
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const rt = {
    store,
    sockets,
    failPut: () => false,
    get alarm() {
      return alarm;
    },
    /** What the object handed to waitUntil, finished. */
    settle: async () => {
      while (pending.length) await pending.shift()!.catch(() => undefined);
    },
    ctx: {
      storage: {
        get: async (k: string | string[]) => (Array.isArray(k) ? new Map(k.filter((x) => store.has(x)).map((x) => [x, clone(store.get(x))])) : clone(store.get(k))),
        list: async () => new Map(),
        put: async (k: string | Record<string, unknown>, v?: unknown) => {
          if (rt.failPut()) throw new Error("the object stopped here");
          for (const [key, val] of Object.entries(typeof k === "string" ? { [k]: v } : k)) store.set(key, clone(val));
        },
        getAlarm: async () => alarm,
        setAlarm: async (t: number) => void (alarm = t),
        deleteAlarm: async () => void (alarm = null),
        deleteAll: async () => store.clear(),
      },
      getWebSockets: () => sockets,
      acceptWebSocket: (ws: FakeSocket) => void sockets.push(ws),
      waitUntil: (p: Promise<unknown>) => void pending.push(p),
      blockConcurrencyWhile: (fn: () => Promise<unknown>) => (loading = fn()),
    },
    /** The object, (re)started from what's stored. */
    make: async <T>(Cls: new (ctx: DurableObjectState, env: never) => T, env: object): Promise<T> => {
      const o = new Cls(rt.ctx as unknown as DurableObjectState, env as never);
      await loading;
      return o;
    },
  };
  return rt;
}

/** D1 that can be down (every statement fails), over the in-memory database. */
function flakyD1(d1: D1Database) {
  const state = { down: false };
  const fail = async () => {
    throw new Error("D1 is down");
  };
  type Prepared = ReturnType<D1Database["prepare"]>;
  const wrap = (s: Prepared): Prepared =>
    ({
      bind: (...p: unknown[]) => wrap(s.bind(...p)),
      run: () => (state.down ? fail() : s.run()),
      first: () => (state.down ? fail() : s.first()),
      all: () => (state.down ? fail() : s.all()),
      // (A batch runs each statement as it is: the batch itself is what fails.)
      inner: s,
    }) as unknown as Prepared;
  const db = {
    prepare: (q: string) => wrap(d1.prepare(q)),
    batch: (list: { inner: Prepared }[]) => (state.down ? fail() : d1.batch(list.map((s) => s.inner))),
  } as unknown as D1Database;
  return { db, state };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(1_800_000_000_000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const signedIn = async (sql: Sql, name: string) =>
  signInWithIdentity(sql, (await createGuest(sql, Date.now(), name)).user, "email", `${name.toLowerCase()}@example.com`, {}, Date.now());

describe("an online boss battle's token drop (lobby-do.ts: drop:<code>:<match start>:<ledger id>)", () => {
  it("a room that stops after writing the drop and before storing that it did drops nothing more when it plays on; the same code's next match drops again", async () => {
    const { sql, d1, db } = memoryDb();
    await ensureSchema(sql);
    const ann = await signedIn(sql, "Ann");
    const me = (await ledgerAccount(sql, ann.id))!;
    // Every roll a lucky one (the window takes up to BOSS_TOKENS.cap drops), so a second drop with a fresh key would go in.
    const real = crypto.getRandomValues.bind(crypto);
    vi.spyOn(crypto, "getRandomValues").mockImplementation(<T extends ArrayBufferView | null>(a: T): T => {
      if (a instanceof Uint32Array && a.length === 1) return ((a[0] = 0), a) as T;
      return real(a as never) as T;
    });
    const rt = runtime();
    const tokens = () => (db.prepare("SELECT COALESCE(SUM(n), 0) AS n FROM boss_tokens WHERE user_id = ?").get(ann.id) as { n: number }).n;
    const drops = () => (db.prepare("SELECT COUNT(*) AS n FROM boss_token_drops").get() as { n: number }).n;
    const phase = () => (rt.store.get("lobby") as LobbyRecord | undefined)?.phase;
    /** A private raid with Ann in it, played out by its alarms (Ann picks nothing: the boss battle runs its clock). */
    const raid = async () => {
      let lobby = await rt.make(Lobby, { DB: d1 });
      expect(await lobby.create("RAIDS", { ...RAID_SETTINGS } as LobbyRecord["overrides"])).toBe(true);
      const ws = new FakeSocket();
      ws.serializeAttachment({ userId: ann.id, guest: false, banned: false });
      rt.sockets.splice(0, rt.sockets.length, ws);
      await lobby.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ t: "hello", name: "Ann", device: "computer" }));
      await lobby.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ t: "start" }));
      return {
        restart: async () => void (lobby = await rt.make(Lobby, { DB: d1 })),
        ring: async (until: () => boolean) => {
          for (let i = 0; i < 5_000 && !until() && rt.alarm !== null; i++) {
            vi.setSystemTime(Math.max(Date.now(), rt.alarm));
            await lobby.alarm().catch(() => undefined);
          }
        },
      };
    };
    const first = await raid();
    // The room stops right after its D1 writes (the drop is in), before it stores the record that says so.
    let stopped = false;
    rt.failPut = () => !stopped && drops() > 0 && (stopped = true);
    await first.ring(() => stopped);
    expect(stopped).toBe(true);
    expect(phase()).not.toBe("results");
    expect(tokens()).toBe(1);
    // Restarted from what it stored: it plays the end again and saves the results again.
    rt.failPut = () => false;
    await first.restart();
    await first.ring(() => phase() === "results");
    expect((rt.store.get("lobby") as LobbyRecord).resultsSaved).toBe(true);
    const start = (rt.store.get("lobby") as LobbyRecord).startedAt!;
    expect(tokens()).toBe(1);
    expect(drops()).toBe(1);
    expect(db.prepare("SELECT op_id, asset_kind, delta FROM ledger WHERE op_id LIKE 'drop:%'").all()).toEqual([{ op_id: `drop:RAIDS:${start}:${me.account}`, asset_kind: "token", delta: 1 }]);
    // The room closes (its code free), and a new match under the same code: its own key, its own drop.
    await first.ring(() => rt.store.size === 0);
    expect(rt.store.size).toBe(0);
    vi.setSystemTime(Date.now() + 60_000);
    const second = await raid();
    await second.ring(() => phase() === "results");
    expect(tokens()).toBe(2);
    expect(db.prepare("SELECT COUNT(DISTINCT op_id) AS n FROM ledger WHERE op_id LIKE 'drop:RAIDS:%'").get()).toEqual({ n: 2 });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  }, 120_000);
});

describe("Squads rewards, at least once (squads-do.ts: squads:<code>:<created>:<ledger id>)", () => {
  it("a failed write keeps the reward in the record and the next alarm writes it once; written again after a lost store, it pays nothing more; a lobby closes only once its rewards are written", async () => {
    const { sql, d1, db } = memoryDb();
    await ensureSchema(sql);
    const D1 = flakyD1(d1);
    const ann = await signedIn(sql, "Ann");
    const bob = await signedIn(sql, "Bob");
    const rt = runtime();
    const env = { DB: D1.db };
    let lobby = await rt.make(SquadsLobby, env);
    await lobby.create("SQUAD", { fillAt: Date.now() + 60_000 });
    const record = () => rt.store.get("lobby") as SquadsRecord;
    const created = record().createdAt;
    /** A reward the bracket queued (as placeNew does), in the stored record; the room restarts from it. */
    const queue = async (r: SquadsReward) => {
      record().rewardQueue.push(r);
      lobby = await rt.make(SquadsLobby, env);
    };
    const wake = async () => {
      vi.setSystemTime(Math.max(Date.now(), rt.alarm ?? Date.now()));
      await lobby.alarm();
      await rt.settle();
    };
    const wallet = (id: string) => db.prepare("SELECT coins, crates FROM wallets WHERE user_id = ?").get(id);
    const results = (id: string) => (db.prepare("SELECT COUNT(*) AS n FROM results WHERE user_id = ? AND mode = 'squads'").get(id) as { n: number }).n;
    const annWon: SquadsReward = { playerId: "p1", userId: ann.id, squadId: 0, placement: 1, coins: 100, crates: 1, recorded: true };

    // D1 down: the write fails; the reward stays stored, and a wake is due within rewardRetrySeconds.
    await queue(annWon);
    D1.state.down = true;
    await wake();
    expect(record().rewardQueue).toEqual([annWon]);
    expect(rt.alarm).toBeLessThanOrEqual(Date.now() + SQUADS_LOBBY.rewardRetrySeconds * 1000);
    expect(wallet(ann.id)).toBeUndefined();
    // D1 back: the next alarm writes it, and only then it leaves the record.
    D1.state.down = false;
    await wake();
    expect(record().rewardQueue).toEqual([]);
    expect(wallet(ann.id)).toEqual({ coins: 100, crates: 1 });
    expect(results(ann.id)).toBe(1);
    const acct = (await ledgerAccount(sql, ann.id))!.account;
    expect(db.prepare("SELECT op_id, leg, asset_kind, delta FROM ledger WHERE reason = 'reward' ORDER BY leg").all()).toEqual([
      { op_id: `squads:SQUAD:${created}:${acct}`, leg: 0, asset_kind: "coins", delta: 100 },
      { op_id: `squads:SQUAD:${created}:${acct}`, leg: 1, asset_kind: "crates", delta: 1 },
    ]);
    // The room wrote it and stopped before storing that it had: it's written again on waking, and nothing changes.
    await queue(annWon);
    await wake();
    expect(record().rewardQueue).toEqual([]);
    expect(wallet(ann.id)).toEqual({ coins: 100, crates: 1 });
    expect(results(ann.id)).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM ledger WHERE reason = 'reward'").get()).toEqual({ n: 2 });

    // The lobby's time to close comes while D1 is down with Bob's reward waiting: it stays (its code held) and tries again.
    await queue({ playerId: "p2", userId: bob.id, squadId: 1, placement: 2, coins: 60, crates: 1, recorded: true });
    D1.state.down = true;
    vi.setSystemTime(record().activeAt + LOBBY_LIFE.lobbyIdleMinutes * 60_000);
    expect(await lobby.status()).toEqual({ phase: "waiting" });
    await rt.settle();
    expect(record().rewardQueue).toHaveLength(1);
    expect(await lobby.create("SQUAD", { fillAt: null })).toBe(false);
    // D1 back: written, then it closes.
    D1.state.down = false;
    await wake();
    expect(rt.store.size).toBe(0);
    expect(wallet(bob.id)).toEqual({ coins: 60, crates: 1 });
    expect(results(bob.id)).toBe(1);
    for (const u of [ann, bob]) expect(await ledgerMismatches(sql, u.id)).toEqual([]);
  });

  it("D1 down for rewardRetryHours past the closing time: the lobby closes anyway, and says what it couldn't write", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql);
    const D1 = flakyD1(d1);
    const ann = await signedIn(sql, "Ann");
    const rt = runtime();
    const env = { DB: D1.db };
    await (await rt.make(SquadsLobby, env)).create("SQUAD", { fillAt: Date.now() + 60_000 });
    (rt.store.get("lobby") as SquadsRecord).rewardQueue.push({ playerId: "p1", userId: ann.id, squadId: 0, placement: 3, coins: 40, crates: 0, recorded: true });
    const lobby = await rt.make(SquadsLobby, env);
    D1.state.down = true;
    const said = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const closeAt = (rt.store.get("lobby") as SquadsRecord).activeAt + LOBBY_LIFE.lobbyIdleMinutes * 60_000;
    vi.setSystemTime(closeAt + SQUADS_LOBBY.rewardRetryHours * 3_600_000 - 1);
    expect(await lobby.status()).toEqual({ phase: "waiting" });
    vi.setSystemTime(closeAt + SQUADS_LOBBY.rewardRetryHours * 3_600_000);
    expect(await lobby.status()).toBeNull();
    expect(rt.store.size).toBe(0);
    expect(said.mock.calls.flat().join(" ")).toMatch(/SQUAD: closing with 1 rewards never written/);
  });
});
