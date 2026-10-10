import { describe, expect, it } from "vitest";
import { CRATES_FREE } from "@chessroyale/core";
import { SQUADS_PROTOCOL, type PartyServerMessage } from "@chessroyale/chess/squads";
import { Matchmaker, type PlayAnswer } from "../src/matchmaker.ts";
import { queueName } from "../src/queue.ts";
import { SquadsCore, newSquadsRecord } from "../src/squads-lobby.ts";
import { PartyCore, newPartyRecord, partyClosing } from "../src/squads-party.ts";
import { createGuest, ensureSchema, grantReward, profile, recordResult, shopState, signInWithIdentity } from "../src/accounts.ts";
import { lockerState } from "../src/locker.ts";
import { memoryDb } from "./memory-db.ts";
import { library } from "./squads-fixture.ts";

/**
 * Squads' queue and parties (docs/areas/squads.md, "Parties and the queue"): the matchmaker seats parties whole
 * (solo players are parties of one) in Squads lobbies, a party gathers under a code and its leader queues it, and
 * placements and rewards land in the database.
 */

/** Squads lobbies by code, each the real lobby logic (no Durable Object), as the matchmaker sees them. */
function squadsLobbies() {
  const lobbies = new Map<string, SquadsCore>();
  const ns = {
    idFromName: (name: string) => name,
    get: (code: string) => ({
      async create(c: string, opts: { fillAt: number | null; reserve?: { size: number; pass: string }[]; reserveMs?: number }) {
        if (lobbies.has(c)) return false;
        const core = new SquadsCore(newSquadsRecord(c, Date.now(), 1, { auto: true, fillAt: opts.fillAt }), {}, { now: () => Date.now(), send: () => undefined }, library);
        lobbies.set(c, core);
        return opts.reserve ? core.reserve(opts.reserve, opts.reserveMs ?? 20_000) : [];
      },
      async reserve(groups: { size: number; pass: string }[], ms: number) {
        return lobbies.get(code)?.reserve(groups, ms) ?? [];
      },
    }),
  };
  return { lobbies, ns };
}

class TestMatchmaker extends Matchmaker {
  constructor(ctx: DurableObjectState, env: never) {
    super(ctx, env);
    this.holdMs = 200;
  }
}

function matchmaker(ns: unknown) {
  const store = new Map<string, unknown>();
  const ctx = { storage: { get: async (k: string) => store.get(k), put: async (k: string, v: unknown) => void store.set(k, v) }, blockConcurrencyWhile: <T>(fn: () => Promise<T>) => fn() };
  return new TestMatchmaker(ctx as unknown as DurableObjectState, { SQUADS: ns } as never);
}

const codeOf = (a: PlayAnswer) => ("code" in a ? a.code : null);
const squadPlay = (mm: Matchmaker, size: number, pass = "") => mm.next({}, 60_000, { squads: true }, null, { size, pass });

describe("the Squads queue", () => {
  it("has its own queue name, never Crowd's or the raid's", () => {
    expect(queueName("squads", "default")).toBe("squads-default");
    expect(queueName("squads", "default", "e2e-1")).toBe("squads-default-e2e-1");
  });

  it("seats solo players and parties whole in one lobby; parties that wouldn't fit go to the next", async () => {
    const L = squadsLobbies();
    const mm = matchmaker(L.ns);
    const answers = await Promise.all([squadPlay(mm, 1), squadPlay(mm, 4, "p4"), squadPlay(mm, 3, "p3"), squadPlay(mm, 1)]);
    const code = codeOf(answers[0]!)!;
    expect(answers.every((a) => codeOf(a) === code)).toBe(true);
    const lobby = L.lobbies.get(code)!;
    expect(Object.values(lobby.record.parties).map((p) => p.size).sort()).toEqual([3, 4]);
    expect(lobby.record.solos).toHaveLength(2);
    // Fill it with parties of 3 (one a squad, each leaving a seat): seven of them take every squad...
    const more = await Promise.all(Array.from({ length: 7 }, (_, i) => squadPlay(mm, 3, `x${i}`)));
    const inFirst = more.filter((a) => codeOf(a) === code).length;
    const elsewhere = more.filter((a) => codeOf(a) !== code);
    // (8 squads: the party of 4 and the party of 3 hold two; six more parties of 3 fit; the seventh goes to a new lobby.)
    expect(inFirst).toBe(6);
    expect(elsewhere).toHaveLength(1);
    expect(L.lobbies.size).toBe(2);
  });

  it("a party's members join with its pass and play in one squad", async () => {
    const L = squadsLobbies();
    const mm = matchmaker(L.ns);
    const code = codeOf(await squadPlay(mm, 2, "duo"))!;
    await squadPlay(mm, 1);
    const lobby = L.lobbies.get(code)!;
    const a = lobby.connect(undefined, { name: "Ann", party: "duo", v: SQUADS_PROTOCOL });
    const b = lobby.connect(undefined, { name: "Bo", party: "duo", v: SQUADS_PROTOCOL });
    const c = lobby.connect(undefined, { name: "Cy", v: SQUADS_PROTOCOL });
    expect(a.ok && b.ok && c.ok).toBe(true);
    (lobby as unknown as { fill(): void }).fill();
    const squadOf = (id: string) => lobby.record.squads.find((sq) => sq.players.some((p) => p.id === id))!.id;
    if (a.ok && b.ok) expect(squadOf(a.playerId)).toBe(squadOf(b.playerId));
  });
});

describe("parties", () => {
  function party() {
    let now = 5_000_000;
    const inbox = new Map<string, PartyServerMessage[]>();
    let n = 0;
    const core = new PartyCore(newPartyRecord("PARTY", now), {
      now: () => now,
      send: (id, m) => inbox.set(id, [...(inbox.get(id) ?? []), { ...m, now } as PartyServerMessage]),
      random: () => `r${++n}`,
    });
    const view = (id: string) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === "party") as Extract<PartyServerMessage, { t: "party" }> | undefined;
    return {
      core,
      view,
      inbox,
      tick: (ms: number) => (now += ms),
      get now() {
        return now;
      },
    };
  }

  it("up to four join by the code; the first is the leader; a fifth is refused", () => {
    const P = party();
    const ids = ["Ann", "Bo", "Cy", "Di"].map((name) => {
      const r = P.core.connect(undefined, { name, v: SQUADS_PROTOCOL });
      if (!r.ok) throw new Error(r.message);
      return r.memberId;
    });
    expect(P.core.connect(undefined, { name: "Ed", v: SQUADS_PROTOCOL })).toEqual({ ok: false, message: "This party is full." });
    expect(P.core.connect(undefined, { name: "Old", v: 0 })).toMatchObject({ ok: false });
    const v = P.view(ids[3]!)!.party;
    expect(v).toMatchObject({ code: "PARTY", leaderId: ids[0], max: 4, state: "open" });
    expect(v.members.map((m) => m.name)).toEqual(["Ann", "Bo", "Cy", "Di"]);
    // Only the leader queues; the leader leaving hands it on.
    P.core.message(ids[1]!, { t: "queue" });
    expect(P.core.record.state).toBe("open");
    P.core.message(ids[0]!, { t: "leave" });
    expect(P.view(ids[1]!)!.party.leaderId).toBe(ids[1]);
    // A leader who drops: the next connected member leads.
    P.core.disconnect(ids[1]!);
    expect(P.core.view().leaderId).toBe(ids[2]);
  });

  it("the leader queues everyone connected: busy, ask again later; then placed, with the lobby and its pass for all", () => {
    const P = party();
    const a = P.core.connect(undefined, { name: "Ann", v: SQUADS_PROTOCOL });
    const b = P.core.connect(undefined, { name: "Bo", v: SQUADS_PROTOCOL });
    const c = P.core.connect(undefined, { name: "Cy", v: SQUADS_PROTOCOL });
    if (!a.ok || !b.ok || !c.ok) throw new Error("join");
    P.core.disconnect(c.memberId);
    P.core.message(a.memberId, { t: "queue" });
    const want = P.core.wantsQueue()!;
    expect(want).toMatchObject({ ticket: null, size: 2 });
    P.core.answered(want.pass, { busy: true, ticket: "t-123456789", position: 3, waitSeconds: 10, retryMs: 3000, message: "Servers are busy, you're in line: about 10 s" });
    expect(P.view(b.memberId)!.party).toMatchObject({ state: "queueing", busy: { position: 3, waitSeconds: 10 } });
    expect(P.core.wantsQueue()).toBeNull();
    expect(P.core.nextAlarm).toBe(P.now + 3000);
    P.tick(3000);
    expect(P.core.wantsQueue()).toMatchObject({ ticket: "t-123456789", pass: want.pass });
    // An answer for an older pass is ignored.
    P.core.answered("old", { code: "WRONG" });
    P.core.answered(want.pass, { code: "LOBBY", ticket: "t-123456789" });
    expect(P.view(b.memberId)!.party).toMatchObject({ state: "placed", placed: { lobby: "LOBBY", pass: want.pass } });
    // Cancel (leader): open again; queue again later: a new pass.
    P.core.message(a.memberId, { t: "cancel" });
    expect(P.core.record.state).toBe("open");
    P.core.message(a.memberId, { t: "queue" });
    expect(P.core.wantsQueue()!.pass).not.toBe(want.pass);
  });

  it("a party with nobody in it closes after its idle time; never while someone is connected", () => {
    const P = party();
    expect(partyClosing(P.core.record, true)).toBeNull();
    expect(partyClosing(P.core.record, false)).toEqual({ at: P.now + 60 * 60_000, reason: "idle" });
  });

  it("party → matchmaker → lobby: the party is placed and its members sit in one squad", async () => {
    const L = squadsLobbies();
    const mm = matchmaker(L.ns);
    const P = party();
    const ids = ["Ann", "Bo", "Cy"].map((name) => {
      const r = P.core.connect(undefined, { name, v: SQUADS_PROTOCOL });
      if (!r.ok) throw new Error(r.message);
      return r.memberId;
    });
    await squadPlay(mm, 1);
    P.core.message(ids[0]!, { t: "queue" });
    const want = P.core.wantsQueue()!;
    P.core.answered(want.pass, await mm.next({}, 60_000, { squads: true }, want.ticket, { size: want.size, pass: want.pass }));
    const placed = P.core.record.placed!;
    const lobby = L.lobbies.get(placed.lobby)!;
    const seats = ids.map((_, i) => lobby.connect(undefined, { name: `M${i}`, party: placed.pass, v: SQUADS_PROTOCOL }));
    const solo = lobby.connect(undefined, { name: "Solo", v: SQUADS_PROTOCOL });
    expect(seats.every((s) => s.ok) && solo.ok).toBe(true);
    (lobby as unknown as { fill(): void }).fill();
    const squads = new Set(seats.map((s) => (s.ok ? lobby.record.squads.find((sq) => sq.players.some((p) => p.id === s.playerId))!.id : -1)));
    expect(squads.size).toBe(1);
  });
});

describe("Squads results and rewards in the database", () => {
  it("a placement is a result on the profile (unranked); coins go in the wallet and crates are counted there", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const { user } = await createGuest(sql, 1_000, "Ann");
    await recordResult(sql, user.id, { mode: "squads", online: true, placement: 1, players: 8, teamWon: true, ranked: false, lobby: "ABCDE" }, 2_000);
    await grantReward(sql, user.id, 100, 1);
    await grantReward(sql, user.id, 40, 0);
    const p = await profile(sql, user);
    expect(p.recent[0]).toMatchObject({ mode: "squads", placement: 1, players: 8, online: true });
    expect(p.stats.all.matches).toBe(1);
    expect(p.stats.crowd.matches).toBe(0);
    expect((await shopState(sql, user.id)).coins).toBe(140);
    expect((await sql.first<{ crates: number }>("SELECT crates FROM wallets WHERE user_id = ?", user.id))!.crates).toBe(1);
    // While crates are free the locker says "unlimited"; the count waits for when they aren't.
    expect((await lockerState(sql, user.id)).crates).toBe(CRATES_FREE ? null : 1);
    // A ranked flag on a Squads result is ignored: it's unranked.
    const row = await sql.first<{ ranked: number }>("SELECT ranked FROM results WHERE user_id = ?", user.id);
    expect(row!.ranked).toBe(0);
  });

  it("signing in carries a guest's coins and crates to the account", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const first = await createGuest(sql, 1_000, "Ann");
    await signInWithIdentity(sql, first.user, "email", "ann@example.com", {}, 1_500);
    const guest = await createGuest(sql, 2_000, "Guest");
    await grantReward(sql, guest.user.id, 60, 1);
    const owner = await signInWithIdentity(sql, guest.user, "email", "ann@example.com", {}, 3_000);
    expect(owner.id).toBe(first.user.id);
    expect((await shopState(sql, owner.id)).coins).toBe(60);
    expect((await sql.first<{ crates: number }>("SELECT crates FROM wallets WHERE user_id = ?", owner.id))!.crates).toBe(1);
  });
});
