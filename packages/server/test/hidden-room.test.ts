import { afterEach, describe, expect, it, vi } from "vitest";
import { BOSS_PARTY, DEFAULT_SETTINGS, HIDDEN_ROOM, TOWN_AFK, hiddenRoomSettings, mulberry32, pausedLine, type Settings } from "@chessroyale/core";
import { legalMoves, type BoardScore, type MatchRunner, type ServerMessage } from "@chessroyale/chess";
import { ADMINS_ONLY, DOOR_LOCKED, HiddenRooms, NOT_ENOUGH, NO_FIGHT, ROOM_LIMITS, fightingText, type RoomStart, type RoomView } from "../src/hidden-room.ts";
import { hiddenRoomResponse, readRoomLimits, type RoomAction, type RoomHub } from "../src/hidden-room-api.ts";
import { LobbyCore, newLobbyRecord, type PartyLobby } from "../src/lobby.ts";
import { TownChat } from "../src/town-chat.ts";
import { LiveHub } from "../src/live-hub.ts";
import { createGuest, createSession, ensureSchema, signInWithIdentity } from "../src/accounts.ts";
import { BANNED_MESSAGE, setCase } from "../src/fairplay.ts";
import { memoryDb } from "./memory-db.ts";
import { library } from "./lobby-fixture.ts";

/**
 * The Hidden Boss's room challenge (Eric, Nov 12 and 13; hidden-room.ts; docs/decisions/2026-11-13-hidden-boss-challenge.md): four at
 * most in his room, a 5th locked out; one request per town instance, 1 of 4 to 4 of 4; leaving, a cancel or a disconnect drops you; one
 * request at a time; the 5-minute cap; the admin's test bots and "Win this form", each refused for a player.
 */

const T = "town";
const at = (c = 3, r = 4) => ({ c, r, idleMs: 0, hidden: false });

describe("the Hidden Boss's room: four at most, the door locked to a 5th", () => {
  it("counts the people in the room (not only challengers); a 5th at the door finds it locked and stays out", () => {
    const R = new HiddenRooms();
    for (const [k, id] of ["a", "b", "c", "d"].entries()) {
      const v = R.enter(id, id.toUpperCase(), T, 1000 + k, at());
      expect(v.in).toBe(true);
      expect(v.people).toBe(k + 1);
      expect(v.message).toBeUndefined();
    }
    // (Nobody has challenged: the room is full all the same.)
    expect(R.look("a", T, 2000).count).toBe(0);
    const e = R.enter("e", "E", T, 2000, at());
    expect(e).toMatchObject({ in: false, people: 4, max: 4, message: DOOR_LOCKED });
    expect(R.has("e", T)).toBe(false);
    // (Someone goes down: the 5th gets in.)
    R.leave("b", 2100);
    expect(R.enter("e", "E", T, 2200, at())).toMatchObject({ in: true, people: 4 });
    expect(R.enter("e", "E", T, 2300, at()).message).toBeUndefined();
  });

  it("each town instance has its own room; going into another's takes you out of the first", () => {
    const R = new HiddenRooms();
    for (const id of ["a", "b", "c", "d"]) R.enter(id, id, "town", 0, at());
    expect(R.enter("e", "e", "test:x", 0, at())).toMatchObject({ in: true, people: 1 });
    R.challenge("a", "town", 1);
    R.enter("a", "a", "test:x", 2, at());
    expect(R.has("a", "town")).toBe(false);
    expect(R.look("b", "town", 3)).toMatchObject({ people: 3, count: 0 });
  });

  it("everyone in the room sees the others (where they stand) and the count, 1 of 4 to 3 of 4, and who's waiting", () => {
    const R = new HiddenRooms();
    R.enter("a", "Ann", T, 0, at(2, 5));
    R.enter("b", "Bo", T, 0, at(6, 6));
    R.challenge("a", T, 10);
    expect(R.look("b", T, 11)).toMatchObject({ count: 1, yours: false, names: ["Ann"], others: [{ id: "a", name: "Ann", c: 2, r: 5 }] });
    R.challenge("b", T, 12);
    // (A second tap changes nothing.)
    R.challenge("b", T, 13);
    expect(R.look("a", T, 14)).toMatchObject({ count: 2, yours: true, names: ["Ann", "Bo"] });
  });
});

describe("the Hidden Boss's room: leaving asks, and leaving, a cancel or a disconnect drops your place", () => {
  it("leaving the room (the stairs, back, the town closed) cancels your place in the request", () => {
    const R = new HiddenRooms();
    R.enter("a", "Ann", T, 0, at());
    R.enter("b", "Bo", T, 0, at());
    R.challenge("a", T, 1);
    R.challenge("b", T, 2);
    R.leave("a", 3);
    expect(R.look("b", T, 4)).toMatchObject({ count: 1, names: ["Bo"], people: 1 });
    // (The last one out: no request left.)
    R.cancel("b", 5);
    expect(R.look("b", T, 6)).toMatchObject({ count: 0, yours: false, in: true });
  });

  it("a disconnect (no look for HIDDEN_ROOM.silentSec) and the town's AFK drop (no input for TOWN_AFK.bootAfterSec) cancel it too", () => {
    const R = new HiddenRooms();
    R.enter("a", "Ann", T, 0, at());
    R.enter("b", "Bo", T, 0, at());
    R.enter("c", "Cy", T, 0, at());
    for (const id of ["a", "b", "c"]) R.challenge(id, T, 1);
    // (b keeps asking but hasn't touched anything for 5 minutes; c stops asking; a is fine.)
    let now = 0;
    while (now < TOWN_AFK.bootAfterSec * 1000) {
      now += 5000;
      R.look("a", T, now, at());
      R.look("b", T, now, { ...at(), idleMs: now });
      if (now < (HIDDEN_ROOM.silentSec - 5) * 1000) R.look("c", T, now, at());
      // (c's last look was at 10 s: gone once it's been silent HIDDEN_ROOM.silentSec.)
      if (now === 10_000 + HIDDEN_ROOM.silentSec * 1000) expect(R.look("a", T, now)).toMatchObject({ count: 2, names: ["Ann", "Bo"], people: 2 });
      if (now === 5_000 + HIDDEN_ROOM.silentSec * 1000) expect(R.look("a", T, now)).toMatchObject({ count: 3, people: 3 });
    }
    expect(R.look("a", T, now)).toMatchObject({ count: 1, names: ["Ann"], people: 1 });
    expect(R.has("b", T) || R.has("c", T)).toBe(false);
  });

  it("one request at a time: a boss battle begun elsewhere (the hub's drop, from a solo battle's start) ends your place", () => {
    const R = new HiddenRooms();
    R.enter("a", "Ann", T, 0, at());
    R.enter("b", "Bo", T, 0, at());
    R.challenge("a", T, 1);
    R.challenge("b", T, 2);
    R.drop("a", 3);
    expect(R.look("b", T, 4)).toMatchObject({ count: 1, names: ["Bo"] });
    expect(R.look("a", T, 4)).toMatchObject({ yours: false, in: true });
  });
});

describe("the Hidden Boss's room: the 5-minute cap, and four go in", () => {
  it("not four by HIDDEN_ROOM.capSec (5 minutes, shown nowhere): everyone waiting reads \"Sorry, not enough players.\", once each, and stays in the room", () => {
    expect(HIDDEN_ROOM.capSec).toBe(300);
    const R = new HiddenRooms();
    R.enter("a", "Ann", T, 0, at());
    R.enter("b", "Bo", T, 0, at());
    R.enter("c", "Cy", T, 0, at());
    R.challenge("a", T, 0);
    for (let now = 5000; now < 300_000; now += 5000) {
      if (now === 60_000) R.challenge("b", T, now);
      for (const id of ["a", "b", "c"]) expect(R.look(id, T, now, at()).outcome).toBeUndefined();
    }
    const a = R.look("a", T, 300_000, at());
    expect(a).toMatchObject({ count: 0, yours: false, in: true, outcome: { kind: "ended", message: NOT_ENOUGH } });
    expect(R.look("b", T, 300_001, at()).outcome).toMatchObject({ kind: "ended", message: NOT_ENOUGH });
    // (Not in it: nothing.)
    expect(R.look("c", T, 300_002, at()).outcome).toBeUndefined();
    // (Told again until it goes, the same number: a device acts on it once.)
    expect(R.look("a", T, 301_000, at()).outcome!.n).toBe(a.outcome!.n);
    // (A new challenge starts a fresh count; the old end is gone.)
    expect(R.challenge("a", T, 302_000).view).toMatchObject({ count: 1, yours: true });
    expect(R.look("a", T, 302_001, at()).outcome).toBeUndefined();
  });

  it("a test's shortened cap (the test switches only: the API reads `limits`)", () => {
    const R = new HiddenRooms();
    const limits = readRoomLimits({ cap: 3 })!;
    expect(limits).toMatchObject({ capMs: 3000, silentMs: ROOM_LIMITS.silentMs });
    R.enter("a", "Ann", T, 0, at(), limits);
    R.challenge("a", T, 0);
    expect(R.look("a", T, 2999, at()).outcome).toBeUndefined();
    expect(R.look("a", T, 3000, at()).outcome).toMatchObject({ message: NOT_ENOUGH });
  });

  it("the 4th makes it full: the start, once, its seats in order; then each reads their pass and seat, and the room empties for the next four", () => {
    const R = new HiddenRooms();
    for (const id of ["a", "b", "c", "d"]) R.enter(id, id.toUpperCase(), T, 0, at());
    let start: RoomStart | null = null;
    for (const [k, id] of ["a", "b", "c", "d"].entries()) {
      const r = R.challenge(id, T, k + 1);
      expect(r.view.count).toBe(k + 1);
      if (k < 3) expect(r.start).toBeNull();
      else start = r.start;
    }
    expect(start).toMatchObject({ room: T, seats: [{ id: "a", name: "A", bot: false }, { id: "b" }, { id: "c" }, { id: "d" }] });
    // (Being made: nobody leaves it, nothing starts twice.)
    R.leave("b", 6);
    expect(R.challenge("a", T, 7).start).toBeNull();
    expect(R.due(8)).toEqual([]);
    R.started(start!, "ABCDE", { a: "pa", b: "pb", c: "pc", d: "pd" }, 9);
    expect(R.look("a", T, 10)).toMatchObject({ in: false, people: 0, count: 0, outcome: { kind: "fight", lobby: "ABCDE", pass: "pa", seat: 0, names: ["A", "B", "C", "D"] } });
    expect(R.look("d", T, 10).outcome).toMatchObject({ kind: "fight", pass: "pd", seat: 3 });
    expect(R.enter("e", "E", T, 11, at())).toMatchObject({ in: true, people: 1 });
  });

  it("a fight that couldn't be made: everyone reads why, the request ends, and they stay in the room", () => {
    const R = new HiddenRooms();
    for (const id of ["a", "b", "c", "d"]) R.enter(id, id, T, 0, at());
    let start: RoomStart | null = null;
    for (const id of ["a", "b", "c", "d"]) start = R.challenge(id, T, 1).start ?? start;
    R.started(start!, null, {}, 2);
    expect(R.look("c", T, 3)).toMatchObject({ in: true, people: 4, count: 0, outcome: { kind: "ended", message: NO_FIGHT } });
  });

  it("the town's line names the four: \"Ann, Bo, Cy and Di are fighting the Hidden Boss.\", in the challenge lines' blue", () => {
    expect(fightingText(["Ann", "Bo", "Cy", "Di"], "the Hidden Boss")).toBe("Ann, Bo, Cy and Di are fighting the Hidden Boss.");
    const line = new TownChat().fighting(fightingText(["Ann", "Bot 1", "Bot 2", "Bot 3"], "the Hidden Boss"), 0);
    expect(line).toMatchObject({ from: "", name: "", sys: "challenge", text: "Ann, Bot 1, Bot 2 and Bot 3 are fighting the Hidden Boss." });
  });
});

describe("the admin's test bots: \"Fill with 3 bots\" (admins only, server-checked)", () => {
  it("refused for a player: nothing in the room changes", () => {
    const R = new HiddenRooms();
    R.enter("p", "Pat", T, 0, at());
    expect(R.fill("p", T, false, 1)).toMatchObject({ message: ADMINS_ONLY, people: 1, bots: false });
  });

  it("an admin's: three bots stand in the room (counted: the door locks), join the challenge one by one as players, and the 4th makes it full", () => {
    const R = new HiddenRooms();
    R.enter("adm", "Eric", T, 0, at());
    expect(R.fill("adm", T, true, 1)).toMatchObject({ people: 4, bots: true, count: 0 });
    expect(R.look("adm", T, 2).others.map((o) => o.name)).toEqual(["Bot 1", "Bot 2", "Bot 3"]);
    expect(R.enter("x", "X", T, 3, at()).message).toBe(DOOR_LOCKED);
    // (Twice: nothing more.)
    expect(R.fill("adm", T, true, 4).people).toBe(4);
    expect(R.challenge("adm", T, 10).view).toMatchObject({ count: 1 });
    expect(R.due(10 + HIDDEN_ROOM.botJoinMs - 1)).toEqual([]);
    expect(R.look("adm", T, 10 + HIDDEN_ROOM.botJoinMs).count).toBe(2);
    expect(R.look("adm", T, 10 + 2 * HIDDEN_ROOM.botJoinMs).count).toBe(3);
    const starts = R.due(10 + 3 * HIDDEN_ROOM.botJoinMs);
    expect(starts).toHaveLength(1);
    expect(starts[0]!.seats.map((s) => [s.name, s.bot])).toEqual([["Eric", false], ["Bot 1", true], ["Bot 2", true], ["Bot 3", true]]);
    R.started(starts[0]!, "FIGHT", { adm: "pass" }, 3000);
    expect(R.look("adm", T, 3001)).toMatchObject({ in: false, people: 0, bots: false, outcome: { kind: "fight", lobby: "FIGHT", pass: "pass", seat: 0, names: ["Eric", "Bot 1", "Bot 2", "Bot 3"] } });
  });

  it("the bots go with the admin who filled them (never left standing in a player's room), and only fit with room for three", () => {
    const R = new HiddenRooms();
    R.enter("adm", "Eric", T, 0, at());
    R.fill("adm", T, true, 1);
    R.leave("adm", 2);
    expect(R.size).toBe(0);
    R.enter("adm", "Eric", T, 3, at());
    R.enter("p", "Pat", T, 3, at());
    expect(R.fill("adm", T, true, 4).message).toBe("The room is full.");
  });

  it("a request with only bots left in it ends (the admin cancelled)", () => {
    const R = new HiddenRooms();
    R.enter("adm", "Eric", T, 0, at());
    R.fill("adm", T, true, 1);
    R.challenge("adm", T, 2);
    R.look("adm", T, 2 + HIDDEN_ROOM.botJoinMs);
    R.cancel("adm", 2 + HIDDEN_ROOM.botJoinMs + 1);
    expect(R.look("adm", T, 2 + 5 * HIDDEN_ROOM.botJoinMs)).toMatchObject({ count: 0, people: 4 });
    expect(R.due(10_000)).toEqual([]);
  });
});

/** The fight from the room: a party battle's lobby for four, as the hub makes it (hiddenRoomSettings, PartyLobby.room). */
function roomFight(people: number, bots: number) {
  let now = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  const party: PartyLobby = {
    admits: Object.fromEntries(Array.from({ length: people }, (_, i) => [`pass${i}`, { seat: i, member: `u${i}`, userId: `u${i}` }])),
    size: people,
    bots,
    leaderSeat: 0,
    startBy: now + HIDDEN_ROOM.joinWaitSec * 1000,
    seats: {},
    partyCode: "",
    startId: 1,
    room: true,
  };
  const overrides = JSON.parse(JSON.stringify(hiddenRoomSettings()));
  const core = new LobbyCore(
    newLobbyRecord("FIGHT", now, overrides, party),
    { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as ServerMessage]) },
    library,
    mulberry32(7),
    { ...DEFAULT_SETTINGS, ...overrides, lastStandFrom: 999, boardIntroSeconds: 0 } as Settings,
  );
  const last = <K extends ServerMessage["t"]>(id: string, t: K) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<ServerMessage, { t: K }> | undefined;
  const advance = (ms: number) => {
    const to = now + ms;
    while (core.nextAlarm !== null && core.nextAlarm <= to) {
      now = Math.max(now, core.nextAlarm);
      core.alarm();
    }
    now = to;
  };
  const hostScores = () => {
    const req = last("p1", "scoreRequest");
    if (!req) return false;
    const boards: BoardScore[] = req.jobs.map((j) => {
      const legal = legalMoves(j.fen);
      const e = Object.fromEntries(legal.map((m) => [m, 0.4]));
      return { boardId: j.boardId, bestMove: legal[0]!, bestExpected: 0.4, expectedAfter: e, botPicks: Object.fromEntries(j.bots.map((b) => [b.id, legal[0]!])), botThinkMs: {} };
    });
    core.message("p1", { t: "scores", key: req.key, boards });
    inbox.set("p1", (inbox.get("p1") ?? []).filter((m) => m.t !== "scoreRequest"));
    return true;
  };
  for (let i = 0; i < people; i++) expect(core.connect(undefined, `M${i}`, "phone", false, 1500, undefined, `u${i}`, null, null, i === 0, { pass: `pass${i}`, seat: i }).ok).toBe(true);
  const runner = () => (core as unknown as { runner: MatchRunner }).runner;
  return { core, last, advance, hostScores, runner, inbox };
}

describe("the fight from the room: the four on the party rule, against him; the admin's Win this form (server-checked)", () => {
  it("is a raid of four (seats 0 to 3, bots in the free ones) on the party rule against the Hidden Boss, nobody else", () => {
    const F = roomFight(1, 3);
    F.advance(1000);
    F.advance(60_000);
    expect(F.core.record.phase).toBe("play");
    expect(F.runner().boss!.id).toBe("recluse");
    const seats = Object.values(F.core.record.party!.seats).sort();
    expect(seats).toEqual([0, 1, 2, 3]);
    expect(F.runner().settings.drawRuleByStage).toEqual(["party"]);
    expect(F.runner().settings.lobbySize).toBe(4);
    expect(BOSS_PARTY.max).toBe(3);
    // (No party Durable Object behind it: nothing to tell.)
    expect(F.core.takePartyOver()).toBeNull();
  });

  it("Win this form: refused for a player and outside his room's fight; an admin's beats his form on the team's next move, as a mate's end", () => {
    const F = roomFight(2, 2);
    F.advance(1000);
    F.advance(60_000);
    expect(F.core.record.phase).toBe("play");
    // (A player, even one in the fight: nothing.)
    expect(F.core.winFormTrigger("p2", false)).toBe(false);
    expect(F.runner().bossForceWin).toBe(false);
    expect(F.core.winFormTrigger("nobody", true)).toBe(false);
    expect(F.core.winFormTrigger("p1", true)).toBe(true);
    expect(F.core.record.winForm).toBe(true);
    expect(F.core.record.overrides?.tested).toBe(true);
    // (A lobby restored from its record keeps it.)
    const again = new LobbyCore(F.core.save(), { now: () => 0, send: () => undefined }, library, mulberry32(1), { ...DEFAULT_SETTINGS } as Settings);
    expect((again as unknown as { runner: MatchRunner }).runner.bossForceWin).toBe(true);
    // The team's move: both people pick, the host scores; the boss is beaten.
    const key = F.core.record.round!.key;
    const fen = F.runner().boards.get(F.runner().state.boards[0]!)!.fen;
    const move = legalMoves(fen)[0]!;
    F.core.message("p1", { t: "pick", key, move });
    F.core.message("p2", { t: "pick", key, move });
    for (let i = 0; i < 30 && F.runner().boss && !F.runner().boss!.result; i++) {
      F.hostScores();
      F.advance(2000);
    }
    expect(F.runner().boss!.result).toBe("crowd");
  });

  it("Win this form is refused in any other battle (a Boss Battle party's, without `room`)", () => {
    const F = roomFight(2, 2);
    delete F.core.record.party!.room;
    F.advance(61_000);
    expect(F.core.winFormTrigger("p1", true)).toBe(false);
  });
});

/**
 * A live hub with in-memory storage and a fake lobby namespace: each `create` waits for the test's `open` (true: made), so a test can
 * act while the fight is being made.
 */
function roomHub(env: Record<string, unknown> = {}) {
  const storage = {
    get: async () => undefined,
    put: async () => undefined,
    delete: async () => undefined,
    list: async () => new Map(),
    getAlarm: async () => null,
    setAlarm: async () => undefined,
  };
  const ctx = { storage, blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn() };
  const creates: { code: string; party: PartyLobby; open: (ok: boolean) => void }[] = [];
  const LOBBIES = {
    idFromName: (c: string) => c,
    get: (c: string) => ({ create: (_c: string, _o: unknown, _a: unknown, _b: unknown, party: PartyLobby) => new Promise<boolean>((open) => creates.push({ code: c, party, open })) }),
  };
  const hub = new LiveHub(ctx as unknown as DurableObjectState, { LOBBIES, ...env } as never);
  const act = (id: string, action: RoomAction, extra: { admin?: boolean } = {}) =>
    hub.hiddenRoom({ id, name: id.toUpperCase(), room: "test:review", action, admin: !!extra.admin, beat: at() });
  return { hub, creates, act };
}

/** Lets the hub's awaits run (the fake lobby's `create` is a promise). */
const settle = () => new Promise<void>((ok) => setTimeout(ok, 0));

describe("review round (Nov 13): a ban at his door, a start racing a cancel or a leave, a rest", () => {
  afterEach(() => vi.useRealTimers());

  it("M1: an account banned for fair play can't go in or challenge (403, `banned`, as PLAY answers: the ban notice); a look goes on; the device cookie goes to fair play as every way in sends it; checked at most once a minute", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const signed = async (name: string) => {
      const g = await createGuest(sql, 1000, name);
      const u = await signInWithIdentity(sql, g.user, "email", `${name.toLowerCase()}@example.com`, {}, 1000);
      return { id: u.id, token: await createSession(sql, u.id, 1000) };
    };
    const ann = await signed("Ann");
    const bo = await signed("Bo");
    await setCase(sql, bo.id, "banned", "admin:eric", "engine moves", 1500);
    const asked: string[] = [];
    const hub: RoomHub = { hiddenRoom: async (a) => (asked.push(`${a.name} ${a.action}`), new HiddenRooms().view(a.id, a.room, 0)) };
    const post = (who: { token: string }, action: RoomAction, now: number, device: string | null = null) =>
      hiddenRoomResponse(new Request("https://hunchess.test/api/town/hidden", { method: "POST", body: JSON.stringify({ action }) }), sql, hub, { token: who.token, device, tooYoung: false, testSwitches: false, admin: () => false, paused: null }, now);
    for (const action of ["enter", "challenge"] as const) {
      const r = await post(bo, action, 2000, "device-of-bo-0001");
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ message: BANNED_MESSAGE, banned: true });
    }
    // (A look, a cancel, leaving: nothing to refuse, and they never add anyone.)
    for (const action of ["look", "cancel", "leave"] as const) expect((await post(bo, action, 2000)).status).toBe(200);
    expect(asked).toEqual(["Bo look", "Bo cancel", "Bo leave"]);
    // Not banned: in, and the device recorded against the account (banCheck's evasion check reads it).
    expect((await post(ann, "enter", 2000, "device-of-ann-001")).status).toBe(200);
    expect(await sql.first("SELECT user_id FROM fairplay_devices WHERE device = ?", "device-of-ann-001")).toEqual({ user_id: ann.id });
    // Banned a moment later: the answer stands for a minute at most, then the door shuts.
    await setCase(sql, ann.id, "banned", "admin:eric", "engine moves", 2500);
    expect((await post(ann, "challenge", 61_999)).status).toBe(200);
    expect((await post(ann, "challenge", 62_000)).status).toBe(403);
  });

  /** a, b, c and d in the room, all four challenged: the start, being made. */
  const four = () => {
    const R = new HiddenRooms();
    for (const id of ["a", "b", "c", "d"]) R.enter(id, id.toUpperCase(), T, 0, at());
    let start: RoomStart | null = null;
    for (const [k, id] of ["a", "b", "c", "d"].entries()) start = R.challenge(id, T, k + 1).start ?? start;
    return { R, start: start!, passes: { a: "pa", b: "pb", c: "pc", d: "pd" } };
  };
  const fight = (v: RoomView) => (v.outcome?.kind === "fight" ? { pass: v.outcome.pass, seat: v.outcome.seat } : null);

  it("m1 a: Cancel just after the fourth joined: the seat is kept and the cancel's answer carries the fight (the summoning for you too); a cancel while it's being made, the same", () => {
    const { R, start, passes } = four();
    // (Being made: a's cancel changes nothing, the four are set.)
    R.cancel("a", 5);
    R.started(start, "ABCDE", passes, 6);
    // (The hub answers a cancel with a look after it.)
    R.cancel("a", 7);
    expect(fight(R.look("a", T, 7))).toEqual({ pass: "pa", seat: 0 });
    R.cancel("b", 8);
    R.cancel("b", 9);
    expect(fight(R.look("b", T, 9))).toEqual({ pass: "pb", seat: 1 });
    // (An end that isn't a fight still goes with a cancel, as before.)
    const S = new HiddenRooms();
    S.enter("e", "E", T, 0, at(), readRoomLimits({ cap: 3 }));
    S.challenge("e", T, 0);
    expect(S.look("e", T, 3000).outcome).toMatchObject({ kind: "ended", message: NOT_ENOUGH });
    S.cancel("e", 3001);
    expect(S.look("e", T, 3002).outcome).toBeUndefined();
  });

  it("m1 b: \"Leave and cancel\" just as the fourth joined: the leave's answer carries the fight (made before or after the leave)", () => {
    const { R, start, passes } = four();
    // (c leaves while it's being made; d just after.)
    R.leave("c", 5);
    expect(R.view("c", T, 5).outcome).toBeUndefined();
    R.started(start, "ABCDE", passes, 6);
    R.leave("d", 7);
    // (The hub answers a leave with the view after it; c's next answer, once made, too.)
    expect(fight(R.view("d", T, 7))).toEqual({ pass: "pd", seat: 3 });
    expect(fight(R.view("c", T, 8))).toEqual({ pass: "pc", seat: 2 });
  });

  it("m1 c: a device swept out while it's being made comes back in: its fight, not a place in the room; told once, a new visit forgets it", () => {
    const { R, start, passes } = four();
    // (Everyone but b silent for HIDDEN_ROOM.silentSec while the lobby is made: swept, their seats kept.)
    const t = HIDDEN_ROOM.silentSec * 1000 + 10;
    R.look("b", T, t, at());
    expect(R.look("a", T, t + 1)).toMatchObject({ in: false });
    expect(R.look("a", T, t + 1).outcome).toBeUndefined();
    R.started(start, "ABCDE", passes, t + 2);
    // (a's app, told "not in", asks to come in: it's told its fight; the room stays empty for the next four.)
    const e = R.enter("a", "A", T, t + 3, at());
    expect(e).toMatchObject({ in: false, people: 0 });
    expect(fight(e)).toEqual({ pass: "pa", seat: 0 });
    expect(R.has("a", T)).toBe(false);
    // (Told on every answer until it goes; a new visit after that, back from the fight say, starts clean.)
    expect(fight(R.look("a", T, t + 4))).toEqual({ pass: "pa", seat: 0 });
    expect(R.enter("a", "A", T, t + 5, at())).toMatchObject({ in: true, people: 1 });
    expect(R.look("a", T, t + 6).outcome).toBeUndefined();
  });

  it("m1, the hub: a leave (or a cancel, a look) that lands while the lobby is being made waits for it, and answers with the pass", async () => {
    const { creates, act } = roomHub();
    for (const id of ["a", "b", "c", "d"]) await act(id, "enter");
    for (const id of ["a", "b", "c"]) await act(id, "challenge");
    const last = act("d", "challenge");
    await settle();
    expect(creates).toHaveLength(1);
    const left = act("b", "leave");
    const cancelled = act("c", "cancel");
    await settle();
    // (Nothing answered yet: the lobby's Durable Object hasn't said.)
    let answered = false;
    void left.then(() => (answered = true));
    await settle();
    expect(answered).toBe(false);
    creates[0]!.open(true);
    const passOf = (v: RoomView) => (v.outcome?.kind === "fight" ? v.outcome : null);
    const [d, b, c] = await Promise.all([last, left, cancelled]);
    for (const [v, seat] of [[d, 3], [b, 1], [c, 2]] as const) {
      expect(passOf(v)).toMatchObject({ lobby: creates[0]!.code, seat });
      expect(creates[0]!.party.admits[passOf(v)!.pass]).toMatchObject({ seat });
    }
  });

  it("m2: resting (his own switch, or a raid's): the bots filling the four start nothing; everyone reads the rest's line and stays in the room", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    for (const rest of ["boss:recluse", "raid"] as const) {
      vi.setSystemTime(1_000_000);
      const { hub, creates, act } = roomHub(rest === "raid" ? { PAUSE_RAID: "1" } : { PAUSE_BOSS_RECLUSE: "1" });
      await act("eric", "enter");
      await act("eric", "fill", { admin: true });
      await act("eric", "challenge");
      vi.setSystemTime(1_000_000 + HIDDEN_ROOM.bots * HIDDEN_ROOM.botJoinMs);
      const v = await act("eric", "look");
      expect(creates).toEqual([]);
      expect(v).toMatchObject({ in: true, people: 4, count: 0, outcome: { kind: "ended", message: pausedLine(rest) } });
      expect((await hub.townRead("test:review")).lines).toEqual([]);
    }
  });
});
