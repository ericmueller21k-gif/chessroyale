import { describe, expect, it } from "vitest";
import { CROWD_PARTY_MAX, modeSettings, type Settings } from "@chessroyale/core";
import { SQUADS_PROTOCOL, type PartyServerMessage } from "@chessroyale/chess/squads";
import { CROWD_PARTY_LINES, PartyCore, newPartyRecord } from "../src/squads-party.ts";
import { Matchmaker, type PlayAnswer } from "../src/matchmaker.ts";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";
import { library, setup } from "./lobby-fixture.ts";
import { memoryDb } from "./memory-db.ts";
import { createGuest, ensureSchema } from "../src/accounts.ts";
import { dismissInvite, friendsState, mayInvite, sendInvite, sendRequest, setFriendSettings, FRIEND_TEXT } from "../src/friends.ts";

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
  return { core, join, view, tick: (ms: number) => (now += ms), now: () => now };
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

  it("only the leader's Find match queues it (everyone connected, one ticket); invites still out are dropped; nobody joins mid-search", () => {
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
        if (auto.party) return core.reserveParty(auto.party.size, auto.party.pass, 20_000) ? true : 0;
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
const play = (mm: Matchmaker, info?: { size: number; pass: string }) => mm.next({}, 60_000, { crowdWaitsForFull: true }, null, info);

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

  it("a hold that runs out frees its seats; a second party only while every party still fits whole on a team", () => {
    const L = setup({ ...crowd(), lobbySize: 10 });
    L.core.setAuto(L.now + 60_000);
    expect(L.core.reserveParty(4, "a", 5_000)).toBe(true);
    expect(L.core.reserveParty(4, "b", 5_000)).toBe(true);
    expect(L.core.reserveParty(2, "c", 5_000)).toBe(false);
    expect(L.core.seatsLeft()).toBe(2);
    L.advance(5_000);
    // (Nobody came: their seats are everyone's again, and the parties count as who came: none.)
    expect(L.core.seatsLeft()).toBe(10);
    expect(L.core.reserveParty(2, "c", 5_000)).toBe(true);
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

  it("dismissing a 50 v 50 party's invite says what it was for (its seat is a + again)", async () => {
    const { sql, now, a, b } = await db();
    expect(await sendInvite(sql, a, b, "crowdparty", "PRTY2", false, now)).toMatchObject({ ok: true });
    expect(await dismissInvite(sql, b, a)).toEqual({ ok: true, was: { kind: "crowdparty", code: "PRTY2" } });
    expect(await dismissInvite(sql, b, a)).toEqual({ ok: true });
  });
});
