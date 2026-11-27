import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOSS_ADMIN_FIRST, MATCH_SAVE, TOWER_PARTY, TOWN_CHAT, finishFloor, newRun, pausedLine, towerPool } from "@chessroyale/core";
import { SQUADS_PROTOCOL, type PartyServerMessage } from "@chessroyale/chess/squads";
import { createGuest, ensureSchema, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { deleteAccount } from "../src/account-data.ts";
import { TOWER_LINES, commitPartyFloor, partyFloorWrite, preparePartyFloor, type Fight } from "../src/tower.ts";
import type { LobbyRecord } from "../src/lobby.ts";
import { TownChat } from "../src/town-chat.ts";
import { CHAT_OFF } from "../src/chat-mod.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: the match rooms import it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, serverAllMovesAt: async () => null, warmEngine: async () => false, countRecluseNoResult: () => undefined }));
import { SquadsParty } from "../src/squads-do.ts";
import { writeTowerEnds } from "../src/lobby-do.ts";
import { lobbyOptions } from "../src/lobby-options.ts";
import { bossPartyOverrides } from "../src/boss-party.ts";

/**
 * The Battle Tower party's Durable Object (SquadsParty, kind "tower") on a fake runtime with a real (in-memory) database, and the floor
 * room's writes (writeTowerEnds): the review of #835's 12b and 12c. START reads everyone's copies again and must find the plan they
 * readied for; the room made but the copies' commit refused places nobody; the raid kill switch begins no floor; a member's failing
 * write never holds the others back, and a crate that keeps failing stops holding its floor up after MATCH_SAVE.strictMinutes.
 */
const POOL = towerPool();

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
  errors() {
    return this.sent.filter((m) => m.t === "error").map((m) => (m as { message: string }).message);
  }
}

const signedIn = async (sql: Sql, email: string, now: number) => signInWithIdentity(sql, (await createGuest(sql, now, "Player")).user, "email", email, {}, now);

/** A tower party's object, its database, and its match rooms (`made`: each one asked for; `onCreate`: runs as one is made). */
async function world(extra: Record<string, string> = {}, shared?: { sql: Sql; d1: D1Database; town: TownChat }) {
  const { sql, d1 } = shared ?? memoryDb();
  await ensureSchema(sql);
  const made: string[] = [];
  // (`done`: what the floor's room answers when the party asks whether its battle is over; `asked`: each ask, [room, party, START].)
  const room = { onCreate: async () => undefined as unknown, done: false };
  const asked: [string, string, number][] = [];
  // (The live hub's town chat, a real room: the party's line goes in and out of it.)
  const town = shared?.town ?? new TownChat();
  const hub = {
    townPartyOpen: async (by: string, text: string, code: string) => {
      const r = town.partyOpen(by, text, code, Date.now());
      return r.ok ? { n: r.line.n } : { retryMs: r.retryMs };
    },
    townRemoveParty: async (n: number, code: string) => town.removeParty(n, code, Date.now()),
  };
  const env = {
    DB: d1,
    LIVE: { idFromName: (x: string) => x, get: () => hub },
    ...extra,
    LOBBIES: {
      idFromName: (c: string) => c,
      get: (c: string) => ({
        create: async () => {
          made.push(c);
          await room.onCreate();
          return true;
        },
        holdsTowerFloor: async () => true,
        partyBattleDone: async (code: string, start: number) => (asked.push([c, code, start]), room.done),
        revokePartyMember: async () => undefined,
      }),
    },
  };
  const store = new Map<string, unknown>();
  const sockets: FakeSocket[] = [];
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  let loading: Promise<unknown> = Promise.resolve();
  const ctx = {
    storage: {
      get: async (k: string) => clone(store.get(k)),
      put: async (k: string, v: unknown) => void store.set(k, clone(v)),
      setAlarm: async () => undefined,
      deleteAlarm: async () => undefined,
      deleteAll: async () => store.clear(),
    },
    getWebSockets: () => sockets.filter((s) => s.closed === null),
    acceptWebSocket: (ws: FakeSocket) => void sockets.push(ws),
    waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined),
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => (loading = fn()),
  };
  const party = new SquadsParty(ctx as unknown as DurableObjectState, env as never);
  await loading;
  expect(await party.create("TOWER", "", 0, "tower")).toBe(true);
  const send = (ws: FakeSocket, msg: object) => party.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(msg));
  /** Someone into the party, on their own socket (their account's). */
  const join = async (userId: string, name: string) => {
    const ws = new FakeSocket();
    ws.serializeAttachment({ userId, name });
    sockets.push(ws);
    await send(ws, { t: "hello", v: SQUADS_PROTOCOL, name, device: "phone" });
    return ws;
  };
  return { sql, d1, made, room, asked, join, send, town, party, store };
}

/** A party climb begun and won once by `uids` (beside the party under test): their copies open on floor 2. */
async function climbedOnce(sql: Sql, uids: string[], now: number) {
  const read = await preparePartyFloor(sql, uids, now, { pool: POOL, seed: 4 });
  if (!read.ok) throw new Error("refused");
  const fight: Fight = { id: "f00000000000000077", startedAt: now, lobby: "ELSEW" };
  expect(await commitPartyFloor(sql, read.prep, fight, now, new Set())).toBe(true);
  for (const uid of uids) await partyFloorWrite(sql, now + 60_000, fight.id, { uid, outcome: "won" }, { pool: POOL });
}

const copy = (sql: Sql, uid: string) => sql.first<{ floor: number; fight: string | null }>("SELECT floor, fight FROM tower_runs WHERE user_id = ? AND kind = 'party' AND status = 'open'", uid);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(1_800_000_000_000);
});
afterEach(() => vi.useRealTimers());

describe("a Battle Tower party's START (SquadsParty.makeTowerFloor; the review of #835, 12b)", () => {
  it("the plan everyone readied for: its floor's room made, every copy begun, everyone placed", async () => {
    const W = await world();
    const [ann, bo] = [await signedIn(W.sql, "ann@example.com", Date.now()), await signedIn(W.sql, "bo@example.com", Date.now())];
    const a = await W.join(ann.id, "Ann");
    const b = await W.join(bo.id, "Bo");
    expect(b.party()!.party.tower!.plan).toEqual({ kind: "new", ends: [] });
    await W.send(b, { t: "ready", on: true });
    await W.send(a, { t: "start" });
    expect(W.made).toHaveLength(1);
    expect(a.party()!.party.placed?.lobby).toBe(W.made[0]);
    expect(b.party()!.party.tower!.floor).toBe(true);
    for (const u of [ann.id, bo.id]) expect(JSON.parse((await copy(W.sql, u))!.fight!).lobby).toBe(W.made[0]);
  });

  it("climbing on together, the plan carries the climb's lives left (Nov 20); a floor lost since, one fewer", async () => {
    const W = await world();
    const [ann, bo] = [await signedIn(W.sql, "ann@example.com", Date.now()), await signedIn(W.sql, "bo@example.com", Date.now())];
    await climbedOnce(W.sql, [ann.id, bo.id], Date.now());
    const a = await W.join(ann.id, "Ann");
    const b = await W.join(bo.id, "Bo");
    expect(b.party()!.party.tower!.plan).toMatchObject({ kind: "continue", floor: 2, lives: 2 });
    await W.send(b, { t: "ready", on: true });
    await W.send(a, { t: "start" });
    // (Floor 2 lost by the party: a life spent, both copies on floor 3; the plan read again shows it.)
    const fight = JSON.parse((await copy(W.sql, ann.id))!.fight!).id as string;
    for (const uid of [ann.id, bo.id]) await partyFloorWrite(W.sql, Date.now() + 60_000, fight, { uid, outcome: "lost" }, { pool: POOL });
    const read = await preparePartyFloor(W.sql, [ann.id, bo.id], Date.now(), { pool: POOL });
    expect(read.ok && read.prep.plan.kind === "continue" && read.prep.floor).toBe(3);
    expect(read.ok && read.prep.run.lost).toEqual([2]);
  });

  it("a plan changed between READY and START: refused before any room is made, nobody placed, the new plan shown and everyone un-readied", async () => {
    const W = await world();
    const [ann, bo, cy] = [await signedIn(W.sql, "ann@example.com", Date.now()), await signedIn(W.sql, "bo@example.com", Date.now()), await signedIn(W.sql, "cy@example.com", Date.now())];
    const a = await W.join(ann.id, "Ann");
    const b = await W.join(bo.id, "Bo");
    await W.send(b, { t: "ready", on: true });
    // (Meanwhile Ann climbed a floor with Cy, elsewhere: START would now end her climb on floor 2.)
    await climbedOnce(W.sql, [ann.id, cy.id], Date.now());
    await W.send(a, { t: "start" });
    expect(W.made).toEqual([]);
    expect(a.errors()).toContain(TOWER_LINES.changed);
    expect(a.party()!.party.state).not.toBe("placed");
    expect(b.party()!.party.tower!.plan).toEqual({ kind: "new", ends: [{ id: expect.any(String), floor: 2 }] });
    expect(b.party()!.party.members.find((m) => m.name === "Bo")!.ready).toBe(false);
    expect(await copy(W.sql, bo.id)).toBeNull();
  });

  it("the room made but the copies' commit refused (something changed in between): nobody is placed, nobody's copy written", async () => {
    const W = await world();
    const [ann, bo] = [await signedIn(W.sql, "ann@example.com", Date.now()), await signedIn(W.sql, "bo@example.com", Date.now())];
    const a = await W.join(ann.id, "Ann");
    const b = await W.join(bo.id, "Bo");
    await W.send(b, { t: "ready", on: true });
    // (While the room is made, Bo's account gets an open party copy nobody agreed to end: the commit's batch is refused.)
    W.room.onCreate = async () =>
      W.sql.run("INSERT INTO tower_runs (id, user_id, kind, seed, floor, met, members, fight, last, status, started_at, updated_at) VALUES ('x1', ?, 'party', 1, 1, '{}', NULL, NULL, NULL, 'open', 1, 1)", bo.id);
    await W.send(a, { t: "start" });
    expect(W.made).toHaveLength(1);
    expect(a.errors()).toContain(TOWER_LINES.changed);
    expect(b.party()!.party.state).not.toBe("placed");
    expect(b.party()!.party.placed).toBeUndefined();
    expect(await copy(W.sql, ann.id)).toBeNull();
  });

  it("online boss battles resting (the raid kill switch): no floor begins, and everyone's told", async () => {
    const W = await world({ PAUSE_RAID: "1" });
    const [ann, bo] = [await signedIn(W.sql, "ann@example.com", Date.now()), await signedIn(W.sql, "bo@example.com", Date.now())];
    const a = await W.join(ann.id, "Ann");
    const b = await W.join(bo.id, "Bo");
    await W.send(b, { t: "ready", on: true });
    await W.send(a, { t: "start" });
    expect(W.made).toEqual([]);
    expect(b.errors()).toContain(pausedLine("raid"));
    expect(await copy(W.sql, ann.id)).toBeNull();
  });
});

describe("a floor whose room never says it's over (the delta review of #835, finding 2)", () => {
  it("the party asks its room every TOWER_PARTY.floorCheckMs: under way there, nothing changes; closed without results, the floor ends here (Kick and Open party live again)", async () => {
    const W = await world();
    const [ann, bo] = [await signedIn(W.sql, "ann@example.com", Date.now()), await signedIn(W.sql, "bo@example.com", Date.now())];
    const a = await W.join(ann.id, "Ann");
    const b = await W.join(bo.id, "Bo");
    await W.send(b, { t: "ready", on: true });
    await W.send(a, { t: "start" });
    expect(b.party()!.party.tower!.floor).toBe(true);
    // (Before its time: nothing asked.)
    await W.party.alarm();
    expect(W.asked).toEqual([]);
    // (Its room still holds the battle: asked once, still under way.)
    vi.setSystemTime(Date.now() + TOWER_PARTY.floorCheckMs);
    await W.party.alarm();
    expect(W.asked).toEqual([[W.made[0], "TOWER", expect.any(Number)]]);
    expect(b.party()!.party.tower!.floor).toBe(true);
    // (Nobody reached it: it closed without results, and its word never came. The next ask ends the floor here.)
    W.room.done = true;
    vi.setSystemTime(Date.now() + TOWER_PARTY.floorCheckMs);
    await W.party.alarm();
    expect(W.asked).toHaveLength(2);
    expect(b.party()!.party.tower!.floor).toBeUndefined();
    expect((W.store.get("party") as { tower?: { floorCheckAt?: number } }).tower?.floorCheckAt).toBeUndefined();
    // (And nothing more is asked.)
    vi.setSystemTime(Date.now() + TOWER_PARTY.floorCheckMs);
    await W.party.alarm();
    expect(W.asked).toHaveLength(2);
    // (Kick is the leader's again.)
    await W.send(a, { t: "kick", id: a.party()!.party.members.find((m) => m.name === "Bo")!.id });
    expect(a.party()!.party.members.map((m) => m.name)).toEqual(["Ann"]);
  });

  it("a deleted member's seat holds the plan without reading it again every few seconds (the delta review's finding 9)", async () => {
    const W = await world();
    const [ann, bo, cy] = [await signedIn(W.sql, "ann@example.com", Date.now()), await signedIn(W.sql, "bo@example.com", Date.now()), await signedIn(W.sql, "cy@example.com", Date.now())];
    const a = await W.join(ann.id, "Ann");
    await W.join(bo.id, "Bo");
    await deleteAccount(W.sql, bo, Date.now());
    // (Cy comes in: the plan is read again, and Bo's seat holds it.)
    await W.join(cy.id, "Cy");
    expect(a.party()!.party.tower!.plan).toEqual({ kind: "wait", message: TOWER_LINES.gone("Bo") });
    expect((W.store.get("party") as { tower?: { recheckAt?: number } }).tower?.recheckAt).toBeUndefined();
  });
});

describe("Open party's line (the review of #835, findings 2 and 3)", () => {
  it("posted under the leader's account name; refused with its words for a moderator's chat ban; one an account, a newer after the wait replacing the older; out when it lapses", async () => {
    const W = await world();
    const [ann, bo] = [await signedIn(W.sql, "ann@example.com", Date.now()), await signedIn(W.sql, "bo@example.com", Date.now())];
    await W.sql.run("UPDATE users SET name = 'Ann' WHERE id = ?", ann.id);
    const a = await W.join(ann.id, "Ann");
    await W.send(a, { t: "open" });
    expect(a.party()!.party.tower!.open).toBe(true);
    const lines = () => W.town.snapshot(Date.now()).lines.filter((l) => l.sys === "party");
    expect(lines().map((l) => [l.text, l.party])).toEqual([["Ann is looking for 3 more to climb the Battle Tower", "TOWER"]]);
    // (And on the clerk's list of open parties: Eric, Nov 20.)
    expect(await W.party.towerListing()).toEqual({ leader: "Ann", members: 1, max: 4 });
    // (Bo joins: 2 more now; the line stands. Ann leaves: it goes.)
    const b = await W.join(bo.id, "Bo");
    expect(lines()).toHaveLength(1);
    await W.send(a, { t: "leave" });
    expect(lines()).toEqual([]);
    // (Bo leads now, under a moderator's chat ban: refused, told why, the button live again.)
    await W.sql.run("INSERT INTO chat_mod_log (user_id, at, action, until, by, reason) VALUES (?, ?, 'ban', NULL, 'admin:test', 'test')", bo.id, Date.now());
    await W.send(b, { t: "open" });
    expect(b.errors()).toContain(CHAT_OFF);
    expect(b.party()!.party.tower!.open).toBe(false);
    expect(lines()).toEqual([]);
  });

  it("a second party's line from the same account within TOWER_PARTY.openGapMs is refused with the wait; Open party lapses after TOWN_CHAT.lineMs", async () => {
    const W = await world();
    const ann = await signedIn(W.sql, "ann@example.com", Date.now());
    const a = await W.join(ann.id, "Ann");
    await W.send(a, { t: "open" });
    expect(a.party()!.party.tower!.open).toBe(true);
    // (A second party of hers, opened to the town before the wait is up: refused with it.)
    const W2 = await world({}, W);
    const a2 = await W2.join(ann.id, "Ann");
    await W2.send(a2, { t: "open" });
    expect(a2.errors()[0]).toMatch(/^You can open a party to the town once a minute\. Try again in \d+ s\.$/);
    expect(a2.party()!.party.tower!.open).toBe(false);
    // (The first party's line lapses with the town's lines: the alarm takes it out, and Open party is live again.)
    vi.setSystemTime(Date.now() + TOWN_CHAT.lineMs);
    await W.party.alarm();
    expect(a.party()!.party.tower!.open).toBe(false);
    expect(W.town.snapshot(Date.now()).lines.filter((l) => l.sys === "party")).toEqual([]);
  });
});

describe("the floor room's writes (writeTowerEnds; the review of #835, finding 7 and 12c)", () => {
  it("one member's failing write never holds the others back; a crate that keeps failing stops holding its floor up after MATCH_SAVE.strictMinutes", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const now = Date.now();
    const [ann, bo] = [await signedIn(sql, "ann@example.com", now), await signedIn(sql, "bo@example.com", now)];
    const read = await preparePartyFloor(sql, [ann.id, bo.id], now, { pool: POOL, seed: 777 });
    if (!read.ok) throw new Error("refused");
    const fight: Fight = { id: "f00000000000000066", startedAt: now, lobby: "FLOOR" };
    expect(await commitPartyFloor(sql, read.prep, fight, now, new Set())).toBe(true);
    // (Both copies on floor 25 under way: a crate floor.)
    let run = newRun(777, POOL);
    for (let f = 1; f < 25; f++) run = finishFloor(run, "won", POOL);
    await sql.run("UPDATE tower_runs SET floor = 25, met = ? WHERE kind = 'party'", JSON.stringify({ floors: run.floors, deck: run.deck, decks: run.decks }));
    const rec = { code: "FLOOR", towerQueue: [bo.id, ann.id].map((uid) => ({ fight: fight.id, end: { uid, outcome: "won" as const } })) } as unknown as LobbyRecord;
    const paid: string[] = [];
    // (Bo's crate keeps failing: a fault in the ledger.)
    const crate = async (_: Sql, uid: string, floor: number) => {
      if (uid === bo.id) throw new Error("ledger fault");
      paid.push(`${uid}:${floor}`);
    };
    const c = { sql, paused: false, off: [] };
    const first = await writeTowerEnds(c, rec, now + 1000, crate);
    expect(first.written).toBe(1);
    expect(String(first.failure)).toContain("ledger fault");
    expect(paid).toEqual([`${ann.id}:25`]);
    expect(await copy(sql, ann.id)).toMatchObject({ floor: 26, fight: null });
    expect(rec.towerQueue).toHaveLength(1);
    // (Still failing within strictMinutes: held, Bo's floor still under way.)
    expect((await writeTowerEnds(c, rec, now + 1000 + MATCH_SAVE.strictMinutes * 60_000 - 1, crate)).written).toBe(0);
    expect((await copy(sql, bo.id))!.fight).not.toBeNull();
    // (Past it: the floor written without its crate.)
    const late = await writeTowerEnds(c, rec, now + 1000 + MATCH_SAVE.strictMinutes * 60_000, crate);
    expect(late).toEqual({ written: 1, failure: null });
    expect(rec.towerQueue).toEqual([]);
    expect(await copy(sql, bo.id)).toMatchObject({ floor: 26, fight: null });
    expect(paid).toEqual([`${ann.id}:25`]);
  });
});

describe("the Stranger online: the server's pick gates (the review of #1000, S1)", () => {
  // (He's in the game for admins first until Eric's ult lands, and the server's raid and party picks pass no admin: so nobody meets
  // him online on production, unlocked or not. When he goes live, `["stranger"]` meets him here: change these lines then.)
  it("is admins first, so a raid's ?boss=stranger meets him only on a test's server, and only for a creator who unlocked him", () => {
    expect(BOSS_ADMIN_FIRST).toContain("stranger");
    const raid = new URLSearchParams("mode=raid&boss=stranger");
    for (const unlocked of [[], ["stranger"]]) {
      // (A player, and an admin whose test switches are on: `test` is never an admin's pick.)
      expect(lobbyOptions(raid, false, false, unlocked).overrides.bossId).toBeUndefined();
      expect(lobbyOptions(new URLSearchParams("mode=raid&boss=stranger&rounds=1"), true, false, unlocked).overrides.bossId).toBeUndefined();
    }
    // (A test's server, TEST_SWITCHES on: him, with the creator's unlock only.)
    expect(lobbyOptions(raid, false, true, []).overrides.bossId).toBeUndefined();
    expect(lobbyOptions(raid, false, true, ["stranger"]).overrides).toMatchObject({ bossId: "stranger", bossPicked: "stranger" });
  });

  it("a Boss Battle party's pick: the same, on the leader's unlock", () => {
    const start = { boss: "stranger", difficulty: "normal" as const };
    for (const unlocked of [[], ["stranger"]]) expect(bossPartyOverrides(start, unlocked).bossId).toBeUndefined();
    expect(bossPartyOverrides(start, [], true).bossId).toBeUndefined();
    expect(bossPartyOverrides(start, ["stranger"], true)).toMatchObject({ bossId: "stranger", bossPicked: "stranger" });
  });

  it("a party floor's write (writeTowerEnds) deals his floor 10 as any other without TEST_SWITCHES, him with it", async () => {
    const floorTen = async (testSwitches: boolean) => {
      const { sql } = memoryDb();
      await ensureSchema(sql);
      const now = Date.now();
      const [ann, bo] = [await signedIn(sql, "ann@example.com", now), await signedIn(sql, "bo@example.com", now)];
      const read = await preparePartyFloor(sql, [ann.id, bo.id], now, { pool: POOL, seed: 777 });
      if (!read.ok) throw new Error("refused");
      const fight: Fight = { id: "f00000000000000088", startedAt: now, lobby: "FLOOR" };
      expect(await commitPartyFloor(sql, read.prep, fight, now, new Set())).toBe(true);
      // (Both copies on floor 9 under way: a win deals floor 10, his own floor, from the pool the room's write passes.)
      let run = newRun(777, POOL);
      for (let f = 1; f < 9; f++) run = finishFloor(run, "won", POOL);
      await sql.run("UPDATE tower_runs SET floor = 9, met = ? WHERE kind = 'party'", JSON.stringify({ floors: run.floors, deck: run.deck, decks: run.decks }));
      const rec = { code: "FLOOR", towerQueue: [ann.id, bo.id].map((uid) => ({ fight: fight.id, end: { uid, outcome: "won" as const } })) } as unknown as LobbyRecord;
      expect(await writeTowerEnds({ sql, paused: false, off: [], testSwitches }, rec, now + 1000, async () => undefined)).toEqual({ written: 2, failure: null });
      const met = await sql.first<{ met: string }>("SELECT met FROM tower_runs WHERE user_id = ? AND kind = 'party'", ann.id);
      return (JSON.parse(met!.met) as { floors: string[][] }).floors[9];
    };
    const plain = await floorTen(false);
    expect(plain!.length).toBeGreaterThan(0);
    expect(plain).not.toContain("stranger");
    expect(await floorTen(true)).toEqual(["stranger"]);
  });
});
