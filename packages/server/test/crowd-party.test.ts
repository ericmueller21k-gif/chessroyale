import { describe, expect, it } from "vitest";
import { CROWD_PARTY, CROWD_PARTY_MAX, modeSettings, type Settings } from "@chessroyale/core";
import { SQUADS_PROTOCOL, type PartyServerMessage } from "@chessroyale/chess/squads";
import { CROWD_PARTY_LINES, PartyCore, newPartyRecord } from "../src/squads-party.ts";
import { Matchmaker, type PlayAnswer } from "../src/matchmaker.ts";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";
import { library, setup } from "./lobby-fixture.ts";
import { memoryDb } from "./memory-db.ts";
import { createGuest, ensureSchema } from "../src/accounts.ts";
import { answerRequest, block, crowdInviteOpen, dismissInvite, friendsState, mayInvite, sendInvite, sendRequest, setFriendSettings, FRIEND_TEXT } from "../src/friends.ts";
import { handleFriendsApi } from "../src/friends-api.ts";
import { createSession } from "../src/accounts.ts";

/**
 * 50 v 50's party (Nov 16; docs/decisions/2026-11-16-crowd-party.md): friends only, by a member's invite; up to CROWD_PARTY_MAX;
 * the leader's Find match queues it into the public 50 v 50 matchmaking as one ticket, seated whole in one lobby, on one team.
 * And Do Not Disturb: no invites or friend requests reach you.
 */

function party() {
  let now = 5_000_000;
  const inbox = new Map<string, PartyServerMessage[]>();
  let n = 0;
  const core = new PartyCore(newPartyRecord("CROWD", now, "crowd", "u-ann"), {
    now: () => now,
    send: (id, m) => inbox.set(id, [...(inbox.get(id) ?? []), { ...m, now } as PartyServerMessage]),
    random: () => `r${++n}`,
  });
  const join = (uid: string, name = uid) => core.connect(undefined, { name, v: SQUADS_PROTOCOL, userId: uid });
  const view = () => core.view();
  return { core, join, view, inbox, tick: (ms: number) => (now += ms), now: () => now };
}

const member = (r: ReturnType<PartyCore["connect"]>) => {
  if (!r.ok) throw new Error(r.message);
  return r.memberId;
};

describe("50 v 50's party: friends only, by invite", () => {
  it("its maker is in first; anyone else only with a member's invite; one seat per account", () => {
    const P = party();
    expect(P.join("u-bo")).toEqual({ ok: false, message: CROWD_PARTY_LINES.invitedOnly });
    const ann = member(P.join("u-ann", "Ann"));
    expect(P.view()).toMatchObject({ kind: "crowd", max: CROWD_PARTY_MAX, leaderId: ann, invited: [] });
    // Not a member: can't invite. A member: can, and the seat shows "…" with the name until they come.
    expect(P.core.mayInvite("u-zed", "u-bo")).toEqual({ ok: false, message: CROWD_PARTY_LINES.notMember });
    expect(P.core.mayInvite("u-ann", "u-bo")).toEqual({ ok: true });
    P.core.invited("u-ann", "u-bo", "Bo", P.now() + 600_000);
    expect(P.view().invited).toEqual([{ uid: "u-bo", name: "Bo", expiresAt: P.now() + 600_000 }]);
    const bo = member(P.join("u-bo", "Bo"));
    expect(P.view().invited).toEqual([]);
    expect(P.view().members.map((m) => m.uid)).toEqual(["u-ann", "u-bo"]);
    // Bo's other device takes over Bo's seat (never a second one).
    expect(member(P.join("u-bo", "Bo"))).toBe(bo);
    expect(P.view().members).toHaveLength(2);
    // Any member may invite; someone already in is refused.
    expect(P.core.mayInvite("u-bo", "u-ann")).toEqual({ ok: false, message: CROWD_PARTY_LINES.inParty });
  });

  it("an invite lapses, or is declined: the seat is a + again and the code alone gets nobody in", () => {
    const P = party();
    member(P.join("u-ann"));
    P.core.invited("u-ann", "u-cy", "Cy", P.now() + 1000);
    P.core.invited("u-ann", "u-di", "Di", P.now() + 600_000);
    P.tick(1000);
    expect(P.view().invited!.map((i) => i.uid)).toEqual(["u-di"]);
    expect(P.join("u-cy")).toEqual({ ok: false, message: CROWD_PARTY_LINES.invitedOnly });
    P.core.uninvited("u-di");
    expect(P.view().invited).toEqual([]);
    expect(P.join("u-di")).toEqual({ ok: false, message: CROWD_PARTY_LINES.invitedOnly });
  });

  it(`holds ${CROWD_PARTY_MAX}, members and open invites counted together`, () => {
    const P = party();
    member(P.join("u-ann"));
    for (let i = 1; i < CROWD_PARTY_MAX; i++) {
      expect(P.core.mayInvite("u-ann", `u-${i}`)).toEqual({ ok: true });
      P.core.invited("u-ann", `u-${i}`, `F${i}`, P.now() + 600_000);
      if (i <= 3) member(P.join(`u-${i}`));
    }
    expect(P.core.mayInvite("u-ann", "u-extra")).toEqual({ ok: false, message: CROWD_PARTY_LINES.noRoom });
    // Asking again for someone invited already is fine (their invite is renewed).
    expect(P.core.mayInvite("u-ann", "u-5")).toEqual({ ok: true });
    for (let i = 4; i < CROWD_PARTY_MAX; i++) member(P.join(`u-${i}`));
    expect(P.view().members).toHaveLength(CROWD_PARTY_MAX);
  });

  it("only the leader's Find match queues it (every member, one ticket); invites still out are dropped; nobody joins mid-search", () => {
    const P = party();
    const ann = member(P.join("u-ann"));
    P.core.invited("u-ann", "u-bo", "Bo", P.now() + 600_000);
    const bo = member(P.join("u-bo"));
    P.core.invited("u-ann", "u-cy", "Cy", P.now() + 600_000);
    P.core.message(bo, { t: "queue" });
    expect(P.core.record.state).toBe("open");
    P.core.message(ann, { t: "queue" });
    expect(P.core.record.state).toBe("queueing");
    expect(P.view().invited).toEqual([]);
    expect(P.core.takeQueue()).toMatchObject({ ticket: null, size: 2 });
    expect(P.core.mayInvite("u-ann", "u-cy")).toMatchObject({ ok: false });
    expect(P.join("u-cy")).toEqual({ ok: false, message: CROWD_PARTY_LINES.searching });
    // Placed: the lobby and its pass for everyone; the leader's Cancel takes the party back to idle.
    const pass = P.core.record.queue!.pass;
    P.core.answered(pass, { code: "LOBBY" });
    expect(P.view()).toMatchObject({ state: "placed", placed: { lobby: "LOBBY", pass } });
    P.core.message(ann, { t: "cancel" });
    expect(P.view()).toMatchObject({ state: "open" });
    expect(P.view().placed).toBeUndefined();
  });

  it("the leader leaving hands the lead on; their seat is free again", () => {
    const P = party();
    const ann = member(P.join("u-ann"));
    P.core.invited("u-ann", "u-bo", "Bo", P.now() + 600_000);
    const bo = member(P.join("u-bo"));
    P.core.message(ann, { t: "leave" });
    expect(P.view()).toMatchObject({ leaderId: bo });
    expect(P.view().members.map((m) => m.uid)).toEqual(["u-bo"]);
    expect(P.core.mayInvite("u-bo", "u-ann")).toEqual({ ok: true });
  });

  it("M2 (c): a leader who drops (a reload) keeps the lead a while; back in time, still the leader; gone longer, it passes on", () => {
    const P = party();
    const ann = member(P.join("u-ann"));
    P.core.invited("u-ann", "u-bo", "Bo", P.now() + 600_000);
    const bo = member(P.join("u-bo"));
    P.core.disconnect(ann);
    expect(P.view().leaderId).toBe(ann);
    // (The alarm comes when the hold ends, to pass the lead on then.)
    expect(P.core.nextAlarm).toBe(P.now() + CROWD_PARTY.leadHoldMs);
    P.core.message(bo, { t: "queue" });
    expect(P.core.record.state).toBe("open");
    P.tick(CROWD_PARTY.leadHoldMs - 1000);
    P.core.tick();
    expect(P.view().leaderId).toBe(ann);
    expect(member(P.join("u-ann"))).toBe(ann);
    expect(P.view().leaderId).toBe(ann);
    expect(P.core.nextAlarm).toBeNull();
    // Gone past the hold: Bo leads, and everyone is told so by the alarm.
    P.core.disconnect(ann);
    P.tick(CROWD_PARTY.leadHoldMs);
    P.inbox.clear();
    P.core.tick();
    expect(P.view().leaderId).toBe(bo);
    expect(P.inbox.get(bo)?.at(-1)).toMatchObject({ t: "party", party: { leaderId: bo } });
  });

  it("L5, N5: the leader's Cancel takes its ticket out of the matchmaker's line; a search with nobody here stops (and says so when they're back), and so does one everyone left", () => {
    const P = party();
    const ann = member(P.join("u-ann"));
    P.core.invited("u-ann", "u-bo", "Bo", P.now() + 600_000);
    const bo = member(P.join("u-bo"));
    P.core.message(ann, { t: "queue" });
    const pass = P.core.takeQueue()!.pass;
    P.core.answered(pass, { busy: true, ticket: "t1", position: 3, waitSeconds: 9, retryMs: 3000, message: "busy" });
    P.core.message(ann, { t: "cancel" });
    expect(P.core.takeDropTickets()).toEqual(["t1"]);
    expect(P.core.takeDropTickets()).toEqual([]);
    expect(P.view().stopped, "a Cancel is no away stop").toBeUndefined();
    // Searching again, then nobody connected: it asks on until CROWD_PARTY.awayStopMs, then stops (its ticket dropped).
    P.core.message(ann, { t: "queue" });
    P.core.answered(P.core.takeQueue()!.pass, { busy: true, ticket: "t2", position: 3, waitSeconds: 9, retryMs: 3000, message: "busy" });
    P.core.disconnect(ann);
    P.core.disconnect(bo);
    P.tick(3000);
    expect(P.core.takeQueue()).not.toBeNull();
    P.tick(CROWD_PARTY.awayStopMs);
    expect(P.core.takeQueue()).toBeNull();
    expect(P.view().state).toBe("open");
    expect(P.core.takeDropTickets()).toEqual(["t2"]);
    // N5: back, the party says why the search stopped, until the next Find match.
    expect(member(P.join("u-ann"))).toBe(ann);
    expect(P.view().stopped).toBe("away");
    // Everyone leaving: at once.
    P.core.message(ann, { t: "queue" });
    expect(P.view().state).toBe("queueing");
    expect(P.view().stopped).toBeUndefined();
    // (L1: the line is gone, not just hidden while searching: a Cancel back to the party doesn't bring it back.)
    P.core.message(ann, { t: "cancel" });
    expect(P.view().state).toBe("open");
    expect(P.view().stopped).toBeUndefined();
    P.core.message(ann, { t: "queue" });
    P.core.message(ann, { t: "leave" });
    expect(P.view().state).toBe("open");
  });
});

// ---------------- The matchmaker and the lobby ----------------

const crowd = (patch: Partial<Settings> = {}) => ({ ...modeSettings("crowd", { augments: false }), finalFormat: "team" as const, ...patch });

/** 50 v 50 lobbies by code, each the real lobby logic, as the matchmaker sees them (seats held for singles kept beside, as the object does). */
function lobbies(size = 100) {
  const open = new Map<string, { core: LobbyCore; singles: number }>();
  const ns = {
    idFromName: (name: string) => name,
    get: (code: string) => ({
      async create(c: string, _o: unknown, auto: { fillAt: number | null; botsOff?: boolean; reserve?: number; party?: { size: number; pass: string } }) {
        if (open.has(c)) return false;
        const core = new LobbyCore(newLobbyRecord(c, Date.now()), { now: () => Date.now(), send: () => undefined }, library, () => 0.5, { ...crowd(), lobbySize: size } as Settings);
        core.setAuto(auto.fillAt, !!auto.botsOff);
        const l = { core, singles: 0 };
        open.set(c, l);
        if (auto.party) return core.reserveParty(auto.party.size, auto.party.pass, 20_000, 0, true) ? true : 0;
        const give = Math.min(auto.reserve ?? 0, core.seatsLeft());
        l.singles += give;
        return auto.reserve ? give : true;
      },
      async reserve(n: number) {
        const l = open.get(code)!;
        const give = Math.max(0, Math.min(n, l.core.seatsLeft() - l.singles));
        l.singles += give;
        return give;
      },
      async reserveParty(size: number, pass: string, ms: number) {
        const l = open.get(code)!;
        return l.core.reserveParty(size, pass, ms, l.singles);
      },
      async hurry() {},
    }),
  };
  return { open, ns };
}

class TestMatchmaker extends Matchmaker {
  constructor(ctx: DurableObjectState, env: never) {
    super(ctx, env);
    this.holdMs = 60;
  }
}
function matchmaker(ns: unknown) {
  const store = new Map<string, unknown>();
  const ctx = { storage: { get: async (k: string) => store.get(k), put: async (k: string, v: unknown) => void store.set(k, v) }, blockConcurrencyWhile: <T>(fn: () => Promise<T>) => fn() };
  return new TestMatchmaker(ctx as unknown as DurableObjectState, { LOBBIES: ns } as never);
}
const codeOf = (a: PlayAnswer) => ("code" in a ? a.code : null);
const play = (mm: Matchmaker, info?: { size: number; pass: string }, fillMs = 60_000) => mm.next({}, fillMs, { crowdWaitsForFull: true }, null, info);

describe("50 v 50's party in the matchmaker", () => {
  it("a party is one ticket, seated whole beside the single players, its seats held under its pass", async () => {
    const L = lobbies();
    const mm = matchmaker(L.ns);
    const answers = await Promise.all([play(mm), play(mm, { size: 5, pass: "pp" }), play(mm), play(mm)]);
    const code = codeOf(answers[0]!)!;
    expect(answers.map(codeOf)).toEqual([code, code, code, code]);
    const lobby = L.open.get(code)!;
    expect(lobby.core.record.crowdParties).toEqual({ pp: { size: 5, ids: [], until: expect.any(Number) } });
    // 3 singles and the party's 5 held: 92 seats left for anyone else.
    expect(lobby.core.seatsLeft() - lobby.singles).toBe(92);
  });

  it("a party that wouldn't fit whole on one team goes to a new lobby", async () => {
    const L = lobbies(10);
    const mm = matchmaker(L.ns);
    // Two parties of 4 in a lobby of 10 (5 a side): a third of 2 still fits seats-wise, but no longer whole on a team.
    const [a, b] = await Promise.all([play(mm, { size: 4, pass: "a" }), play(mm, { size: 4, pass: "b" })]);
    expect(codeOf(b)).toBe(codeOf(a));
    const c = await play(mm, { size: 2, pass: "c" });
    expect(codeOf(c)).not.toBe(codeOf(a));
    expect(L.open.get(codeOf(c)!)!.core.record.crowdParties?.c?.size).toBe(2);
  });

  it("H2: a lobby filling sooner than a party's hold isn't the party's: a new one is (and holds them until its own fill)", async () => {
    const L = lobbies();
    const mm = matchmaker(L.ns);
    // (A lobby filling in 15 s, less than the 20 s a party's members have to arrive.)
    const first = codeOf(await play(mm, undefined, 15_000))!;
    const party = codeOf(await play(mm, { size: 3, pass: "pp" }, 15_000))!;
    expect(party).not.toBe(first);
    expect(L.open.get(first)!.core.record.crowdParties).toBeUndefined();
    const held = L.open.get(party)!.core.record;
    expect(held.crowdParties?.pp?.until).toBe(held.auto!.fillAt);
  });
});

describe("50 v 50's party in the lobby", () => {
  it("its members join with the pass and play on one team; their seats stay theirs until the hold runs out", () => {
    const L = setup({ ...crowd(), lobbySize: 10 });
    L.core.setAuto(L.now + 60_000);
    expect(L.core.reserveParty(3, "pp", 20_000)).toBe(true);
    expect(L.core.seatsLeft()).toBe(7);
    const ids = ["Ann", "Bo", "Cy"].map((name) => {
      const r = L.core.connect(undefined, name, "phone", false, null, undefined, `u-${name}`, null, null, false, { pass: "pp" });
      if (!r.ok) throw new Error(r.message);
      return r.playerId;
    });
    expect(L.core.record.crowdParties!.pp!.ids).toEqual(ids);
    expect(ids.every((id) => L.core.inCrowdParty(id))).toBe(true);
    const solo = L.core.connect(undefined, "Di", "phone");
    if (!solo.ok) throw new Error(solo.message);
    expect(L.core.inCrowdParty(solo.playerId)).toBe(false);
    L.advance(60_000);
    const players = L.core.save().runner!.state.players;
    const side = (id: string) => players.find((p) => p.id === id)!.colour;
    expect(new Set(ids.map(side)).size).toBe(1);
    expect(players.filter((p) => p.colour === "w")).toHaveLength(5);
  });

  it("a hold that runs out frees its seats; a second party only while every party, at its full size, still fits whole on a team", () => {
    const L = setup({ ...crowd(), lobbySize: 10 });
    L.core.setAuto(L.now + 60_000);
    expect(L.core.reserveParty(4, "a", 5_000)).toBe(true);
    expect(L.core.reserveParty(4, "b", 5_000)).toBe(true);
    expect(L.core.reserveParty(2, "c", 5_000)).toBe(false);
    expect(L.core.seatsLeft()).toBe(2);
    L.advance(5_000);
    // (Nobody came yet: their seats are everyone's again. L1: a party still counts at its full size, as its members on their way
    // join it whenever they come, so a third party still doesn't fit whole on a side.)
    expect(L.core.seatsLeft()).toBe(10);
    expect(L.core.reserveParty(2, "c", 5_000)).toBe(false);
  });

  it("L1: a member arriving after the hold still joins the party's group, and the start puts every party whole on one side", () => {
    const L = setup({ ...crowd(), lobbySize: 10 });
    L.core.setAuto(L.now + 60_000);
    expect(L.core.reserveParty(4, "a", 5_000)).toBe(true);
    expect(L.core.reserveParty(4, "b", 5_000)).toBe(true);
    const join = (name: string, pass: string) => {
      const r = L.core.connect(undefined, name, "phone", false, null, undefined, `u-${name}`, null, null, false, { pass });
      if (!r.ok) throw new Error(r.message);
      return r.playerId;
    };
    const a = ["A1", "A2"].map((n) => join(n, "a"));
    const b = ["B1", "B2", "B3"].map((n) => join(n, "b"));
    L.advance(10_000);
    a.push(join("A3", "a"), join("A4", "a"));
    b.push(join("B4", "b"));
    expect(L.core.record.crowdParties!.a!.ids).toEqual(a);
    expect(L.core.record.crowdParties!.b!.ids).toEqual(b);
    L.advance(60_000);
    const players = L.core.save().runner!.state.players;
    const side = (id: string) => players.find((p) => p.id === id)!.colour;
    expect(new Set(a.map(side)).size).toBe(1);
    expect(new Set(b.map(side)).size).toBe(1);
    expect(side(a[0]!)).not.toBe(side(b[0]!));
  });

  it("N1: Find match holds a seat for every member, an away one too: back after the hold, they still join the party's group and its team", () => {
    const P = party();
    const ann = member(P.join("u-ann"));
    P.core.invited("u-ann", "u-bo", "Bo", P.now() + 600_000);
    const bo = member(P.join("u-bo"));
    // (Bo's phone sleeps, or he's mid-reload, as Ann taps Find match.)
    P.core.disconnect(bo);
    P.core.message(ann, { t: "queue" });
    const want = P.core.takeQueue()!;
    expect(want.size).toBe(2);
    const L = setup({ ...crowd(), lobbySize: 10 });
    L.core.setAuto(L.now + 60_000);
    expect(L.core.reserveParty(want.size, want.pass, 20_000)).toBe(true);
    const join = (name: string, pass?: string) => {
      const r = L.core.connect(undefined, name, "phone", false, null, undefined, `u-${name}`, null, null, false, pass ? { pass } : {});
      if (!r.ok) throw new Error(r.message);
      return r.playerId;
    };
    const a = join("Ann", want.pass);
    // (Singles beside them.)
    for (const n of ["Cy", "Di", "Ed"]) join(n);
    // Bo is back after the hold has run out (his app walks him in with the pass): the party's group still has his seat.
    L.advance(25_000);
    const b = join("Bo", want.pass);
    expect(L.core.record.crowdParties![want.pass]!.ids).toEqual([a, b]);
    L.advance(60_000);
    const players = L.core.save().runner!.state.players;
    const side = (id: string) => players.find((p) => p.id === id)!.colour;
    expect(side(b)).toBe(side(a));
  });

  it("H2: a lobby filling within a party's hold doesn't take it; a lobby made for it holds them until its fill; the fill never comes sooner", () => {
    const L = setup({ ...crowd(), lobbySize: 10 });
    L.core.setAuto(L.now + 15_000);
    expect(L.core.reserveParty(3, "pp", 20_000)).toBe(false);
    expect(L.core.reserveParty(3, "pp", 20_000, 0, true)).toBe(true);
    expect(L.core.record.crowdParties!.pp!.until).toBe(L.now + 15_000);
    // (Someone who already waited joins: bots fill sooner, but not before the party's members have had their hold.)
    const M = setup({ ...crowd(), lobbySize: 10 });
    M.core.setAuto(M.now + 60_000);
    expect(M.core.reserveParty(3, "pp", 20_000)).toBe(true);
    M.core.hurry(M.now);
    expect(M.core.record.auto!.fillAt).toBe(M.now + 20_000);
  });

  it("H1, N4: a party's pass, held here with room and in its hold, lets its member past the engine pool's door; a full group's, another's, or one whose hold ran out doesn't", () => {
    const L = setup({ ...crowd(), lobbySize: 10 });
    L.core.setAuto(L.now + 60_000);
    expect(L.core.reserveParty(1, "pp", 20_000)).toBe(true);
    expect(L.core.crowdPassOpen("pp")).toBe(true);
    expect(L.core.crowdPassOpen("nope")).toBe(false);
    expect(L.core.crowdPassOpen("__proto__")).toBe(false);
    expect(L.core.crowdPassOpen(undefined)).toBe(false);
    const r = L.core.connect(undefined, "Ann", "phone", false, null, undefined, "u-ann", null, null, false, { pass: "pp" });
    expect(r.ok).toBe(true);
    expect(L.core.crowdPassOpen("pp")).toBe(false);
    // (A pass the app made up never breaks the door: only the lobby's own keys.)
    expect(L.core.connect(undefined, "Bo", "phone", false, null, undefined, "u-bo", null, null, false, { pass: "constructor" }).ok).toBe(true);
    // N4: once its hold has run out, a pass with a seat still free no longer opens the door (a friend who joined the party after its
    // Find match can't take a late member's seat in a clean lobby).
    expect(L.core.reserveParty(2, "late", 20_000)).toBe(true);
    expect(L.core.crowdPassOpen("late")).toBe(true);
    L.advance(20_000);
    expect(L.core.crowdPassOpen("late")).toBe(false);
  });

  it(`M3, N2: the singles stay ranked; only a party of 2 or more's members aren't (CROWD_PARTY.ranked: ${CROWD_PARTY.ranked}), and their results say it's the party; a party of one is a single`, () => {
    const lobby = (party: number) => {
      const L = setup({ ...crowd(), lobbySize: 10 });
      L.core.setAuto(L.now + 60_000);
      expect(L.core.reserveParty(Math.max(1, party), "pp", 20_000)).toBe(true);
      const ids = [0, 1, 2, 3].map((i) => {
        const r = L.core.connect(undefined, `P${i}`, "phone", false, null, undefined, `u-${i}`, null, null, false, i < party ? { pass: "pp" } : {});
        if (!r.ok) throw new Error(r.message);
        return r.playerId;
      });
      // (Into its first round. Then a member and a single leave (their results as they go), and the match ends for the other two (its
      // results), as review-fable-b3's m5 ends one: playing a 50 v 50 out takes far too long here.)
      for (let i = 0; i < 200 && !L.core.record.round; i++) L.advance(Math.max(1, (L.core.nextAlarm ?? L.now + 1000) - L.now));
      expect(L.core.record.round).toBeTruthy();
      L.core.message(ids[0]!, { t: "resign" });
      L.core.message(ids[2]!, { t: "resign" });
      (L.core as unknown as { finishMatch(): void }).finishMatch();
      // (Mid-match nobody has a place yet: the two still here get one, as the match's end gives everyone.)
      for (const id of [ids[1]!, ids[3]!]) L.core.record.placements[id] ??= 1;
      // (Each player's own result, and what they were told: the results, or the note as they left.)
      const rows = [...L.core.takeLeftResults(), ...L.core.humanResults()];
      const told = (id: string) => {
        const m = [...(L.inbox.get(id) ?? [])].reverse().find((x) => x.t === "results" || x.t === "resigned");
        return m?.t === "results" ? { ranked: m.ranked, partied: m.partied } : m?.t === "resigned" ? { ranked: m.result?.ranked, partied: m.result?.partied } : null;
      };
      return { ranked: L.core.ranked(), mine: ids.map((id) => rows.find((r) => r.playerId === id)!.ranked), told: ids.map(told) };
    };
    const party = CROWD_PARTY.ranked ? {} : { partied: true };
    const two = lobby(2);
    expect(two.ranked, "the match counts").toBe(true);
    expect(two.mine).toEqual([CROWD_PARTY.ranked, CROWD_PARTY.ranked, true, true]);
    expect(two.told).toEqual([
      { ranked: CROWD_PARTY.ranked, ...party },
      { ranked: CROWD_PARTY.ranked, ...party },
      { ranked: true, partied: undefined },
      { ranked: true, partied: undefined },
    ]);
    for (const n of [0, 1]) {
      const l = lobby(n);
      expect(l.mine).toEqual([true, true, true, true]);
      expect(l.told.every((t) => t?.ranked === true && t.partied === undefined)).toBe(true);
    }
  });

  it("a member who taps Leave before the fill is out of the party's group: their seat in it reopens for a return with the pass, and the friend left behind plays as a single (ranked, no party line)", () => {
    const L = setup({ ...crowd(), lobbySize: 10 });
    L.core.setAuto(L.now + 60_000);
    expect(L.core.reserveParty(2, "pp", 20_000)).toBe(true);
    const join = (name: string, pass?: string) => {
      const r = L.core.connect(undefined, name, "phone", false, null, undefined, `u-${name}`, null, null, false, pass ? { pass } : {});
      if (!r.ok) throw new Error(r.message);
      return r.playerId;
    };
    const ann = join("Ann", "pp");
    const bo = join("Bo", "pp");
    for (const n of ["Cy", "Di"]) join(n);
    const free = L.core.seatsLeft();
    L.core.message(bo, { t: "leave" });
    expect(L.core.record.crowdParties!.pp!.ids).toEqual([ann]);
    expect(L.core.inCrowdParty(bo)).toBe(false);
    // (His seat in the group is held again while the hold lasts, so nobody else takes it, and the pass opens the door for him.)
    expect(L.core.seatsLeft()).toBe(free);
    expect(L.core.crowdPassOpen("pp")).toBe(true);
    // Back with the pass: in the group again, in a new seat.
    const bo2 = join("Bo", "pp");
    expect(L.core.record.crowdParties!.pp!.ids).toEqual([ann, bo2]);
    // He leaves again, for good: Ann plays alone, a single's result (ranked, no "Party matches aren't ranked").
    L.core.message(bo2, { t: "leave" });
    for (let i = 0; i < 200 && !L.core.record.round; i++) L.advance(Math.max(1, (L.core.nextAlarm ?? L.now + 1000) - L.now));
    expect(L.core.record.round).toBeTruthy();
    (L.core as unknown as { finishMatch(): void }).finishMatch();
    L.core.record.placements[ann] ??= 1;
    expect(L.core.ranked()).toBe(true);
    expect(L.core.humanResults().find((r) => r.playerId === ann)!.ranked).toBe(true);
    const told = [...(L.inbox.get(ann) ?? [])].reverse().find((m) => m.t === "results");
    expect(told).toMatchObject({ t: "results", ranked: true });
    expect(told && "partied" in told ? told.partied : undefined).toBeUndefined();
  });
});

// ---------------- Do Not Disturb ----------------

describe("Do Not Disturb (Eric, Nov 16)", () => {
  async function db() {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const now = 1_800_000_000_000;
    const [a, b] = [await createGuest(sql, now - 60_000, "Ann"), await createGuest(sql, now - 60_000, "Bo")];
    return { sql, now, a: a.user.id, b: b.user.id };
  }

  it("no invite or friend request reaches you; the sender hears the quiet refusal; invites to you are hidden", async () => {
    const { sql, now, a, b } = await db();
    expect(await sendInvite(sql, a, b, "crowd", "ABCDE", false, now)).toMatchObject({ ok: true });
    expect((await friendsState(sql, b, now)).invites).toHaveLength(1);
    await setFriendSettings(sql, b, { dnd: true });
    expect((await friendsState(sql, b, now)).settings).toMatchObject({ dnd: true });
    expect((await friendsState(sql, b, now)).invites).toEqual([]);
    expect(await mayInvite(sql, a, b, false, now + 60_000)).toEqual({ ok: false, message: FRIEND_TEXT.notTaking, status: 403 });
    expect(await sendRequest(sql, a, b, false, now)).toEqual({ ok: false, message: FRIEND_TEXT.notTakingRequests, status: 403 });
    await setFriendSettings(sql, b, { dnd: false });
    expect(await sendRequest(sql, a, b, false, now)).toMatchObject({ ok: true });
  });

  it("nit: earlier friend requests are hidden too, until it ends", async () => {
    const { sql, now, a, b } = await db();
    expect(await sendRequest(sql, a, b, false, now)).toMatchObject({ ok: true });
    await setFriendSettings(sql, b, { dnd: true });
    expect((await friendsState(sql, b, now)).requests).toEqual([]);
    await setFriendSettings(sql, b, { dnd: false });
    expect((await friendsState(sql, b, now)).requests.map((r) => r.id)).toEqual([a]);
  });

  it("dismissing a 50 v 50 party's invite says what it was for (its seat is a + again)", async () => {
    const { sql, now, a, b } = await db();
    expect(await sendInvite(sql, a, b, "crowdparty", "PRTY2", false, now)).toMatchObject({ ok: true });
    expect(await dismissInvite(sql, b, a)).toEqual({ ok: true, was: { kind: "crowdparty", code: "PRTY2" } });
    expect(await dismissInvite(sql, b, a)).toEqual({ ok: true });
  });
});

// ---------------- The friends API: friends only, and the seats invites hold ----------------

describe("50 v 50 party invites through the friends API", () => {
  async function world() {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql);
    const now = Date.now();
    const users = await Promise.all(["Ann", "Bo", "Cy"].map(async (n) => (await createGuest(sql, now - 60_000, n)).user.id));
    const tokens = await Promise.all(users.map((u) => createSession(sql, u, now)));
    const uninvited: [string, string][] = [];
    const parties = {
      idFromName: (c: string) => c,
      get: (c: string) => ({
        crowdMayInvite: async () => ({ ok: true }),
        crowdInvited: async () => undefined,
        crowdUninvited: async (to: string) => void uninvited.push([c, to]),
      }),
    };
    const env = { DB: d1, PARTIES: parties };
    const call = async (who: number, action: string, body: object) => {
      const bg: Promise<unknown>[] = [];
      const res = (await handleFriendsApi(
        new Request(`https://hunchess.com/api/friends/${action}`, { method: "POST", headers: { cookie: `hc_session=${tokens[who]}` }, body: JSON.stringify(body) }),
        env as never,
        (p) => void bg.push(p),
      ))!;
      await Promise.all(bg);
      return { status: res.status, body: (await res.json()) as { message?: string } };
    };
    const befriend = async (x: number, y: number) => {
      await sendRequest(sql, users[x]!, users[y]!, false, now);
      await answerRequest(sql, users[y]!, users[x]!, true, now);
    };
    return { sql, now, users, call, befriend, uninvited };
  }

  it("M1: only to a friend: anyone else by account is refused on the server, whatever the app offers", async () => {
    const W = await world();
    const [, bo] = W.users;
    expect(await W.call(0, "invite", { id: bo, kind: "crowdparty", code: "PRTY2" })).toEqual({ status: 403, body: { message: FRIEND_TEXT.notTaking } });
    await W.befriend(0, 1);
    expect((await W.call(0, "invite", { id: bo, kind: "crowdparty", code: "PRTY2" })).status).toBe(200);
  });

  it("L3: two members invite Bo; he declines one: his seat waits on the other. Declining both, or a block, makes it a + again", async () => {
    const W = await world();
    const [ann, bo, cy] = W.users as [string, string, string];
    await W.befriend(0, 1);
    await W.befriend(2, 1);
    expect((await W.call(0, "invite", { id: bo, kind: "crowdparty", code: "PRTY2" })).status).toBe(200);
    expect((await W.call(2, "invite", { id: bo, kind: "crowdparty", code: "PRTY2" })).status).toBe(200);
    expect((await W.call(1, "dismiss", { id: ann })).status).toBe(200);
    expect(W.uninvited).toEqual([]);
    expect(await crowdInviteOpen(W.sql, bo, "PRTY2", W.now)).toBe(true);
    expect((await W.call(1, "dismiss", { id: cy })).status).toBe(200);
    expect(W.uninvited).toEqual([["PRTY2", bo]]);
    // A block takes the invite between them back, and the seat with it.
    W.uninvited.length = 0;
    expect((await W.call(0, "invite", { id: bo, kind: "crowdparty", code: "PRTY3" })).status).toBe(200);
    expect((await W.call(1, "block", { id: ann })).status).toBe(200);
    expect(W.uninvited).toEqual([["PRTY3", bo]]);
  });

  it("L2: the invite lets them in only while it stands: a block deletes it; their Do Not Disturb holds it back", async () => {
    const W = await world();
    const [ann, bo] = W.users as [string, string, string];
    await W.befriend(0, 1);
    expect(await sendInvite(W.sql, ann, bo, "crowdparty", "PRTY2", false, W.now)).toMatchObject({ ok: true });
    expect(await crowdInviteOpen(W.sql, bo, "PRTY2", W.now, true)).toBe(true);
    expect(await crowdInviteOpen(W.sql, bo, "OTHER", W.now, true)).toBe(false);
    await setFriendSettings(W.sql, bo, { dnd: true });
    expect(await crowdInviteOpen(W.sql, bo, "PRTY2", W.now, true)).toBe(false);
    // (Its seat still waits: nobody learns of Do Not Disturb from a seat turning back into a +.)
    expect(await crowdInviteOpen(W.sql, bo, "PRTY2", W.now)).toBe(true);
    await setFriendSettings(W.sql, bo, { dnd: false });
    expect(await block(W.sql, bo, ann, W.now)).toEqual({ ok: true, crowd: [{ to: bo, code: "PRTY2" }] });
    expect(await crowdInviteOpen(W.sql, bo, "PRTY2", W.now, true)).toBe(false);
  });
});
