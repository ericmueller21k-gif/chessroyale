import { afterEach, describe, expect, it, vi } from "vitest";
import { RANKED_1V1, TOWN_AFK, TOWN_TABLES, rankView } from "@chessroyale/core";
import type { DuelPlayerView } from "@chessroyale/chess/duel";
import { DuelCore, newDuelRecord, type DuelIO, type DuelOutgoing } from "../src/duel-room.ts";
import { LiveHub } from "../src/live-hub.ts";
import { TownHere, type HereBeat } from "../src/town-here.ts";
import { readBeat, readSeat } from "../src/town-here-api.ts";
import { TownTables, type TableSeat } from "../src/town-tables.ts";

/**
 * Ranked at the park's tables (Eric, Nov 27; town-tables.ts): the town's presence state machine. Sitting at a table (the beat's seat),
 * found (the queue's pair seated at the first's table, the other's seat cleared), the end (the table free), a searcher gone before the
 * pairing (no table of theirs), two tables meeting, a table taken, the time limit; the hub's view; and what a watcher hears of a game.
 */

const T0 = 1_800_000_000_000;
const seat = (uid: string, name = uid.toUpperCase()): TableSeat => ({ uid, name, look: null, pawn: "white" });
const beat = (c: number, r: number, s?: [number, 0 | 1]): HereBeat => ({ c, r, idleMs: 0, hidden: false, shop: null, ...(s ? { seat: { table: s[0], stool: s[1] } } : {}) });

describe("the town's tables: seat, found, end, disconnect, two tables meeting", () => {
  it("seat: a beat's seat is kept, and others see the pawn seated; standing up (a beat without it) clears it", () => {
    const h = new TownHere();
    h.beat("ann", "Ann", "town", beat(10, 20, [3, 0]), T0);
    expect(h.seatOf("ann", T0)).toEqual({ table: 3, stool: 0, room: "town" });
    expect(h.view("town", T0, "bo")).toEqual([expect.objectContaining({ id: "ann", c: 10, r: 20, sit: true })]);
    h.beat("ann", "Ann", "town", beat(11, 20), T0 + 1000);
    expect(h.seatOf("ann", T0 + 1000)).toBeNull();
    expect(h.view("town", T0 + 1000, "bo")[0]).not.toHaveProperty("sit");
  });

  it("found: the pair is seated at the first's table, the first on their own stool and the other across; both walk nowhere else", () => {
    const h = new TownHere();
    const t = new TownTables();
    h.beat("ann", "Ann", "town", beat(10, 20, [3, 1]), T0);
    h.beat("cy", "Cy", "town", beat(1, 1), T0);
    const c = t.found("ABCDE", [seat("ann"), seat("bo")], (uid) => h.seatOf(uid, T0), T0);
    expect(c).toMatchObject({ code: "ABCDE", table: 3, room: "town", seats: [{ uid: "bo" }, { uid: "ann" }] });
    // (Bo isn't in the town at all: his pawn sits there all the same.)
    expect(t.view("town", "cy")).toEqual([{ code: "ABCDE", table: 3, seats: [seat("bo"), seat("ann")] }]);
    expect(t.playing("ann", "town") && t.playing("bo", "town")).toBe(true);
    expect(h.view("town", T0, "cy", undefined, true, (id) => t.playing(id, "town"))).toEqual([]);
    // (Not in another town, nor to a player of it, back from it: they sit there on their own.)
    expect(t.view("test:x", "cy")).toEqual([]);
    expect(t.view("town", "ann")).toEqual([]);
    // (A guest watching: no names.)
    expect(t.view("town", null, false)[0]!.seats.map((s) => s.name)).toEqual(["", ""]);
  });

  it("end: the game over, the table is free and its two are gone from it (a code not held is nothing)", () => {
    const h = new TownHere();
    const t = new TownTables();
    h.beat("ann", "Ann", "town", beat(10, 20, [3, 0]), T0);
    t.found("ABCDE", [seat("ann"), seat("bo")], (uid) => h.seatOf(uid, T0), T0);
    expect(t.over("ZZZZZ", T0)).toBeNull();
    expect(t.over("ABCDE", T0)).toMatchObject({ table: 3 });
    expect(t.view("town", null)).toEqual([]);
    expect(t.heldAt("town", 3) || t.playing("ann", "town")).toBe(false);
  });

  it("a found landing after its game's over (#1027's review, N2): never seated; the code is free again once its results are gone", () => {
    const h = new TownHere();
    const t = new TownTables();
    h.beat("ann", "Ann", "town", beat(10, 20, [3, 0]), T0);
    expect(t.over("ABCDE", T0)).toBeNull();
    expect(t.found("ABCDE", [seat("ann"), seat("bo")], (uid) => h.seatOf(uid, T0), T0 + 1000)).toBeNull();
    expect(t.heldAt("town", 3)).toBe(false);
    // (The code's next game, once the old one's room has closed: seated as any.)
    const later = T0 + RANKED_1V1.resultsKeepMinutes * 60_000;
    h.beat("ann", "Ann", "town", beat(10, 20, [3, 0]), later);
    expect(t.found("ABCDE", [seat("ann"), seat("bo")], (uid) => h.seatOf(uid, later), later)?.table).toBe(3);
  });

  it("disconnect: a searcher the town has dropped (gone, past its limit, or standing) has no table; the other's is used, else none", () => {
    const h = new TownHere();
    const t = new TownTables();
    h.beat("ann", "Ann", "town", beat(10, 20, [3, 0]), T0);
    h.beat("bo", "Bo", "town", beat(12, 20, [5, 1]), T0);
    // Ann's phone went quiet in the background long enough to be dropped: Bo's table.
    const late = T0 + (TOWN_AFK.silentAfterSec + TOWN_AFK.hiddenBootAfterSec) * 1000;
    h.beat("bo", "Bo", "town", beat(12, 20, [5, 1]), late);
    expect(t.found("ABCDE", [seat("ann"), seat("bo")], (uid) => h.seatOf(uid, late), late)).toMatchObject({ table: 5, seats: [seat("ann"), seat("bo")] });
    // Neither in the town (left, or stood up): no table at all.
    h.leave("bo");
    h.beat("ann", "Ann", "town", beat(10, 20), late);
    expect(t.found("FGHJK", [seat("ann"), seat("bo")], (uid) => h.seatOf(uid, late), late)).toBeNull();
    // (In a shop: not at a table.)
    h.beat("ann", "Ann", "town", { ...beat(10, 20, [3, 0]), shop: "tiger" }, late);
    expect(h.seatOf("ann", late)).toBeNull();
  });

  it("two tables meeting: one table, the first's (the longer search); the other's seat clears for everyone", () => {
    const h = new TownHere();
    const t = new TownTables();
    h.beat("ann", "Ann", "town", beat(10, 20, [3, 0]), T0);
    h.beat("bo", "Bo", "town", beat(30, 20, [7, 1]), T0);
    h.beat("cy", "Cy", "town", beat(1, 1), T0);
    expect(t.found("ABCDE", [seat("bo"), seat("ann")], (uid) => h.seatOf(uid, T0), T0)).toMatchObject({ table: 7, seats: [seat("ann"), seat("bo")] });
    expect(t.heldAt("town", 3)).toBe(false);
    // Cy sees them both at table 7, and neither still sitting at their own (Ann's beat still says table 3: she isn't shown there).
    expect(h.view("town", T0, "cy", undefined, true, (id) => t.playing(id, "town"))).toEqual([]);
    expect(t.view("town", "cy").map((m) => m.table)).toEqual([7]);
  });

  it("a table another match holds isn't taken: the other's table, else none; a code is seated once; nobody meets themselves", () => {
    const h = new TownHere();
    const t = new TownTables();
    h.beat("ann", "Ann", "town", beat(10, 20, [3, 0]), T0);
    h.beat("cy", "Cy", "town", beat(10, 20, [3, 1]), T0);
    h.beat("di", "Di", "town", beat(12, 20, [4, 0]), T0);
    expect(t.found("AAAAA", [seat("ann"), seat("bo")], (uid) => h.seatOf(uid, T0), T0)?.table).toBe(3);
    expect(t.found("BBBBB", [seat("cy"), seat("di")], (uid) => h.seatOf(uid, T0), T0)?.table).toBe(4);
    expect(t.found("CCCCC", [seat("cy"), seat("ed")], (uid) => h.seatOf(uid, T0), T0)).toBeNull();
    expect(t.found("AAAAA", [seat("di"), seat("ed")], (uid) => h.seatOf(uid, T0), T0)).toBeNull();
    expect(t.found("DDDDD", [seat("di"), seat("di")], (uid) => h.seatOf(uid, T0), T0)).toBeNull();
    // (A table past the park's own (#1027's review, N4: a forged seat no device can draw) is never held; its last one is.)
    expect(t.found("EEEEE", [seat("x"), seat("y")], () => ({ table: TOWN_TABLES.parkTables, stool: 0, room: "town" }), T0)).toBeNull();
    expect(t.found("EEEEE", [seat("x"), seat("y")], () => ({ table: TOWN_TABLES.parkTables - 1, stool: 0, room: "town" }), T0)?.table).toBe(TOWN_TABLES.parkTables - 1);
  });

  it("a timeout: a match held past TOWN_TABLES.matchMaxMinutes is let go whatever its game says", () => {
    const t = new TownTables();
    t.found("ABCDE", [seat("ann"), seat("bo")], () => ({ table: 2, stool: 0, room: "town" }), T0);
    expect(t.sweep(T0 + TOWN_TABLES.matchMaxMinutes * 60_000 - 1)).toEqual([]);
    expect(t.sweep(T0 + TOWN_TABLES.matchMaxMinutes * 60_000)).toEqual(["ABCDE"]);
    expect(t.size).toBe(0);
  });

  it("a beat's seat is read only as [table, stool] within the guard, and never inside a shop", () => {
    expect(readSeat([3, 1])).toEqual({ table: 3, stool: 1 });
    expect(readSeat([TOWN_TABLES.parkTables - 1, 0])).toEqual({ table: TOWN_TABLES.parkTables - 1, stool: 0 });
    for (const bad of [[3, 2], [-1, 0], [TOWN_TABLES.parkTables, 0], [1.5, 0], "3.1", [3], null]) expect(readSeat(bad)).toBeNull();
    expect(readBeat({ c: 1, r: 2, seat: [3, 0] })?.seat).toEqual({ table: 3, stool: 0 });
    expect(readBeat({ c: 1, r: 2, seat: [3, 0], shop: "tiger" })).not.toHaveProperty("seat");
  });
});

/** A live hub with a storage that's a map (as town-chat.test.ts's). */
function hubWith(store = new Map<string, unknown>()) {
  const storage = {
    get: async (k: string) => store.get(k),
    put: async (k: string, v: unknown) => void store.set(k, structuredClone(v)),
    delete: async (k: string | string[]) => {
      for (const x of Array.isArray(k) ? k : [k]) store.delete(x);
    },
    list: async ({ prefix }: { prefix: string }) => new Map([...store].filter(([k]) => k.startsWith(prefix))),
    getAlarm: async () => null,
    setAlarm: async () => undefined,
  };
  let ready: Promise<unknown> = Promise.resolve();
  const ctx = { storage, blockConcurrencyWhile: (fn: () => Promise<unknown>) => (ready = fn()) };
  const hub = new LiveHub(ctx as unknown as DurableObjectState, {} as never);
  return { hub, store, ready: () => ready };
}

describe("the live hub: a town's tables", () => {
  afterEach(() => vi.useRealTimers());

  it("the queue's pair is seated where the town has one of them sitting; every visitor sees it (a guest without names); a restart keeps it; the game's end frees it", async () => {
    vi.useFakeTimers({ now: T0 });
    const { hub, store, ready } = hubWith();
    await ready();
    await hub.townHere("ann", "Ann", "town", beat(10, 20, [3, 0]));
    expect((await hub.townHere("cy", "Cy", "town", beat(1, 1))).others.map((o) => [o.id, o.sit])).toEqual([["ann", true]]);
    expect(await hub.townMatch("ABCDE", [seat("ann"), seat("bo")])).toBe(true);
    const seen = await hub.townHere("cy", "Cy", "town", beat(1, 1));
    expect(seen).toEqual({ others: [], tables: [{ code: "ABCDE", table: 3, seats: [seat("ann"), seat("bo")] }] });
    expect((await hub.townWatch("town")).tables[0]!.seats.map((s) => s.name)).toEqual(["", ""]);
    // (A deploy: the match comes back from storage.)
    const again = hubWith(store);
    await again.ready();
    expect((await again.hub.townWatch("town")).tables.map((m) => m.code)).toEqual(["ABCDE"]);
    await again.hub.townMatchOver("ABCDE");
    expect((await again.hub.townWatch("town")).tables).toEqual([]);
    expect([...store.keys()].filter((k) => k.startsWith("town-match:"))).toEqual([]);
    // Nobody from the pair sitting in the town: nothing seated.
    expect(await hub.townMatch("FGHJK", [seat("dee"), seat("ed")])).toBe(false);
  });
});

describe("watching a 1 v 1 (the town's spectator view)", () => {
  const player = (uid: string, name: string): DuelPlayerView => ({ uid, name, look: null, rank: rankView(null) });

  it("a watcher hears the game (its phases, the moves, the picks, a draw offer, who's connected) but never a chat line or an outcome", () => {
    let now = T0;
    const conn = { w: false, b: false };
    const heard: DuelOutgoing[] = [];
    const io: DuelIO = { now: () => now, send: () => {}, connected: (c) => conn[c], watch: (m) => void heard.push(m) };
    const record = newDuelRecord("ABCDE", now, { w: player("uw", "Wendy"), b: player("ub", "Bo") }, { town: true });
    expect(record.town).toBe(true);
    const core = () => new DuelCore(record, io);
    expect(core().welcomeWatcher()).toMatchObject({ t: "welcome", watch: true, game: { phase: "waiting", players: { w: { name: "Wendy" } } } });
    conn.w = true;
    core().connect("w");
    conn.b = true;
    core().connect("b");
    now += RANKED_1V1.versusMs + 100;
    core().message("w", { t: "pick", zone: "blitz" });
    now += RANKED_1V1.voteSeconds * 1000;
    core().alarm();
    now += RANKED_1V1.overlayMs;
    core().alarm();
    core().message("w", { t: "move", uci: "e2e4", ply: 0 });
    core().message("w", { t: "chat", say: "good-luck" });
    conn.b = false;
    core().disconnect("b");
    const kinds = new Set(heard.map((m) => m.t));
    for (const k of ["game", "presence", "picks", "move"] as const) expect(kinds.has(k)).toBe(true);
    expect(kinds.has("chat") || kinds.has("outcome") || kinds.has("chatLog")).toBe(false);
    expect(heard.at(-1)).toEqual({ t: "presence", connected: { w: true, b: false } });
  });
});
