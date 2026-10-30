import { describe, expect, it } from "vitest";
import { BOSS_PARTY, DEFAULT_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { legalMoves, type BoardScore, type MatchRunner, type ServerMessage } from "@chessroyale/chess";
import { SQUADS_PROTOCOL, type PartyServerMessage } from "@chessroyale/chess/squads";
import { LobbyCore, PARTY_ONLY, lobbyClosing, newLobbyRecord } from "../src/lobby.ts";
import { bossPartyOverrides, partyLobby } from "../src/boss-party.ts";
import { KICKED, PartyCore, newPartyRecord, type BossStart } from "../src/squads-party.ts";
import { library } from "./lobby-fixture.ts";

type Msg = ServerMessage;

/** A party's battle on a fake clock: `size` members expected, the host (p1) scoring with a fixed "engine". */
function battle(size: number, patch: Partial<Settings> = {}, bots = 0) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  // (Each member's own pass into their own seat, from their own account: pass0 / u0 for seat 0, and so on.)
  const start: BossStart = { id: 1, members: Array.from({ length: size }, (_, i) => ({ id: `m${i}`, seat: i, pass: `pass${i}`, userId: `u${i}` })), bots, leaderSeat: 0, boss: "gingerbread", difficulty: "normal" };
  const core = new LobbyCore(
    newLobbyRecord("BATTL", now, bossPartyOverrides(start), partyLobby(start, "PARTY", now)),
    { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]) },
    library,
    mulberry32(7),
    { ...DEFAULT_SETTINGS, ...bossPartyOverrides(start), raidOpening: true, lastStandFrom: 999, bossKillEvery: 99, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...patch } as Settings,
  );
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const all = <T extends Msg["t"]>(id: string, t: T) => (inbox.get(id) ?? []).filter((m) => m.t === t) as Extract<Msg, { t: T }>[];
  const advance = (ms: number) => {
    const to = now + ms;
    while (core.nextAlarm !== null && core.nextAlarm <= to) {
      now = Math.max(now, core.nextAlarm);
      core.alarm();
    }
    now = to;
  };
  const join = (seat: number, pass = `pass${seat}`, userId = `u${seat}`) => core.connect(undefined, `M${seat}`, "phone", false, 1500, undefined, userId, null, null, false, { pass, seat });
  /** The host scores: `exp` gives the moves' expected scores (others 0.3). */
  const hostScores = (exp: Record<string, number> = {}) => {
    const req = last("p1", "scoreRequest");
    if (!req) return false;
    const boards: BoardScore[] = req.jobs.map((j) => {
      const legal = legalMoves(j.fen);
      const e = Object.fromEntries(legal.map((m) => [m, exp[m] ?? 0.3]));
      const best = legal.reduce((a, b) => (e[b]! > e[a]! ? b : a));
      return { boardId: j.boardId, bestMove: best, bestExpected: e[best]!, expectedAfter: e, botPicks: Object.fromEntries(j.bots.map((b, i) => [b.id, legal[i % legal.length]!])), botThinkMs: {} };
    });
    core.message("p1", { t: "scores", key: req.key, boards });
    inbox.set("p1", (inbox.get("p1") ?? []).filter((m) => m.t !== "scoreRequest"));
    return true;
  };
  /** The host plays the boss's first allowed move, then the crowd's turn comes. */
  const hostBoss = () => {
    for (let i = 0; i < 20 && !last("p1", "bossRequest"); i++) advance(5_000);
    const req = last("p1", "bossRequest");
    if (!req) return;
    core.message("p1", { t: "bossMove", key: req.key, move: (req.allowed ?? legalMoves(req.fen))[0]! });
    inbox.set("p1", (inbox.get("p1") ?? []).filter((m) => m.t !== "bossRequest"));
    advance(20_000);
  };
  const runner = () => (core as unknown as { runner: MatchRunner }).runner;
  return { core, last, all, advance, join, hostScores, hostBoss, runner, inbox, get now() { return now; } };
}

/** Into the battle's first crowd turn: everyone joined, past the boss's intro. */
function inPlay(size: number, patch: Partial<Settings> = {}, bots = 0) {
  const B = battle(size, patch, bots);
  for (let i = 0; i < size; i++) expect(B.join(i).ok).toBe(true);
  B.advance(1000);
  B.advance(60_000);
  expect(B.core.record.phase).toBe("play");
  return B;
}

describe("a Boss Battle party's battle (docs/decisions/2026-10-30-boss-party.md)", () => {
  it("only its members get in, each in their own seat; it begins once all are here, or at BOSS_PARTY.joinWaitSec with those who came", () => {
    const B = battle(3);
    expect(B.join(0, "wrong")).toEqual({ ok: false, message: PARTY_ONLY });
    expect(B.join(0).ok).toBe(true);
    expect(B.join(0)).toEqual({ ok: false, message: PARTY_ONLY });
    expect(B.join(5)).toEqual({ ok: false, message: PARTY_ONLY });
    // (A pass takes its own seat, whatever seat the app claims; another account can't use it.)
    expect(B.join(1, "pass1", "someone-else")).toEqual({ ok: false, message: PARTY_ONLY });
    expect(B.join(2).ok).toBe(true);
    expect(B.core.record.phase).toBe("lobby");
    expect(B.last("p1", "lobby")!.party).toEqual({ seats: { p1: 0, p2: 2 }, leader: "p1" });
    B.advance(BOSS_PARTY.joinWaitSec * 1000 + 10);
    expect(B.core.record.phase).not.toBe("lobby");
    const all = battle(2);
    all.join(0);
    all.join(1);
    expect(all.core.record.phase).not.toBe("lobby");
  });

  it("is a raid of up to 3 on the party rule, 10 + 10 and any member's God King call, never ranked", () => {
    const o = bossPartyOverrides({ boss: "gingerbread", difficulty: "hard" });
    expect(o).toMatchObject({ raid: true, lobbySize: 3, groupSize: 3, drawRuleByStage: ["party"], kingAnyCall: true, bossClock: true, timeBankSeconds: 600, timeIncrementSeconds: 10, bossId: "gingerbread", bossDifficulty: 250, bossAloneMaia: 2050 });
    expect(bossPartyOverrides({ boss: "", difficulty: "easy" }).bossId).toBeUndefined();
    const B = inPlay(3);
    expect(B.core.ranked()).toBe(false);
  });

  it("teammates' picks show live, before you pick; a pick can change until the last one resolves the turn", () => {
    const B = inPlay(2);
    const r = B.last("p1", "round")!;
    const [a, b] = legalMoves(r.board!.fen);
    B.core.message("p1", { t: "pick", key: r.key, move: a! });
    expect(B.last("p2", "tally")!.picks.map((p) => [p.playerId, p.move])).toEqual([["p1", a]]);
    B.core.message("p1", { t: "pick", key: r.key, move: b! });
    expect(B.last("p2", "tally")!.picks.map((p) => [p.playerId, p.move])).toEqual([["p1", b]]);
    expect(B.core.record.phase).toBe("play");
    // The last pick ends the turn: two on one move, it's played.
    B.core.message("p2", { t: "pick", key: r.key, move: b! });
    expect(B.core.record.phase).toBe("scoring");
    B.hostScores({ [a!]: 0.9 });
    expect(B.last("p2", "reveal")!.playedMove).toBe(b);
  });

  it("one team clock: 10:10 for the first move, the turn's length off it, 10 s back as the next begins", () => {
    const B = inPlay(2);
    const r = B.last("p1", "round")!;
    expect(r.deadline - r.startsAt).toBe(610_000);
    const m = legalMoves(r.board!.fen)[0]!;
    B.advance(5_000);
    B.core.message("p1", { t: "pick", key: r.key, move: m });
    B.advance(15_000);
    B.core.message("p2", { t: "pick", key: r.key, move: m });
    // (The turn: from its clock's start to the last pick, whatever each pick's own time.)
    const turn = B.now - r.startsAt;
    expect(turn).toBeGreaterThanOrEqual(20_000);
    B.hostScores();
    expect(B.runner().teamBankMs()).toBe(610_000 - turn);
    expect(B.runner().alive().map((p) => p.bankMs)).toEqual([610_000 - turn, 610_000 - turn]);
    B.hostBoss();
    const next = B.last("p2", "round")!;
    expect(next.key).not.toBe(r.key);
    expect(next.deadline - next.startsAt).toBe(610_000 - turn + 10_000);
  });

  it("out of time loses: the team's clock runs out with a pick missing, the move isn't played, the boss wins on time", () => {
    const B = inPlay(2);
    const r = B.last("p1", "round")!;
    B.core.message("p1", { t: "pick", key: r.key, move: legalMoves(r.board!.fen)[0]! });
    B.advance(r.deadline - B.now + DEFAULT_SETTINGS.lateGraceMs + 10);
    B.hostScores();
    B.advance(30_000);
    expect(B.runner().boss!.result).toBe("boss");
    expect(B.runner().bossTimedOut).toBe(true);
  });

  it("the AFK kick: a minute after the turn's first pick, the leader can kick whoever hasn't picked; told so, out, the turn goes on", () => {
    const B = inPlay(3);
    const r = B.last("p1", "round")!;
    const m = legalMoves(r.board!.fen)[0]!;
    // Nobody has picked: no kick, however long.
    B.advance(70_000);
    B.core.message("p1", { t: "kick", playerId: "p3" });
    expect(B.core.record.humans.map((h) => h.id)).toEqual(["p1", "p2", "p3"]);
    B.core.message("p1", { t: "pick", key: r.key, move: m });
    B.core.message("p2", { t: "pick", key: r.key, move: m });
    // A minute from the first pick, not before; never someone who has picked; never by a member while the leader has picked.
    B.advance(59_000);
    B.core.message("p1", { t: "kick", playerId: "p3" });
    expect(B.core.partyKickable("p1", "p3")).toBe(false);
    B.advance(2_000);
    expect(B.core.partyKickable("p1", "p2")).toBe(false);
    expect(B.core.partyKickable("p2", "p3")).toBe(false);
    B.core.message("p1", { t: "kick", playerId: "p3" });
    expect(B.core.record.humans.map((h) => h.id)).toEqual(["p1", "p2"]);
    expect(B.last("p3", "resigned")!.how).toBe("kicked");
    expect(B.core.takePartyKicks()).toEqual({ party: "PARTY", members: ["m2"] });
    expect(B.core.takePartyKicks()).toBeNull();
    // The turn resolves on the picks it has.
    expect(B.core.record.phase).toBe("scoring");
  });

  it("the leader is the one who hasn't picked: the members who have picked get the kick", () => {
    const B = inPlay(3);
    const r = B.last("p1", "round")!;
    const m = legalMoves(r.board!.fen)[0]!;
    B.core.message("p2", { t: "pick", key: r.key, move: m });
    B.advance(61_000);
    expect(B.core.partyKickable("p3", "p1")).toBe(false);
    expect(B.core.partyKickable("p2", "p1")).toBe(true);
    expect(B.core.partyKickable("p2", "p3")).toBe(true);
    B.core.message("p2", { t: "kick", playerId: "p1" });
    expect(B.core.record.humans.map((h) => h.id)).toEqual(["p2", "p3"]);
    // The next seat leads now.
    expect(B.core.partyLeader()).toBe("p2");
  });

  it("a dropped member isn't waited for", () => {
    const B = inPlay(2);
    const r = B.last("p1", "round")!;
    B.core.disconnect("p2");
    B.core.message("p1", { t: "pick", key: r.key, move: legalMoves(r.board!.fen)[0]! });
    expect(B.core.record.phase).toBe("scoring");
  });

  it("any member's call for the God King is the team's move, at once", () => {
    const B = inPlay(3);
    const r = B.last("p1", "round")!;
    expect(B.runner().boss!.kingCharges).toBeGreaterThan(0);
    B.core.message("p3", { t: "king", key: r.key });
    expect(B.core.record.phase).toBe("scoring");
    B.hostScores();
    expect(B.last("p1", "reveal")!.king).toBe(true);
  });

  it("bot members (admins' tests) sit in the free seats and pick", () => {
    const B = inPlay(1, {}, 2);
    expect(Object.values(B.last("p1", "lobby")!.party!.seats).sort()).toEqual([0, 1, 2]);
    expect(B.runner().alive()).toHaveLength(3);
  });
});

describe("a Boss Battle party (PartyCore, kind \"boss\")", () => {
  function party() {
    let now = 5_000_000;
    const inbox = new Map<string, PartyServerMessage[]>();
    let n = 0;
    const closed: string[] = [];
    const core = new PartyCore(newPartyRecord("PARTY", now, "boss"), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as PartyServerMessage]), random: () => `r${++n}`, close: (id) => closed.push(id) });
    const view = (id: string) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === "party")!.party as Extract<PartyServerMessage, { t: "party" }>["party"];
    const join = (name: string, token?: string) => core.connect(token, { name, v: SQUADS_PROTOCOL, userId: `u-${name}` });
    return { core, inbox, view, join, closed, tick: (ms: number) => (now += ms) };
  }

  it("up to 3, in seats 0 to 2; the leader's boss and difficulty for everyone; a member's READY; START once all are ready", () => {
    const P = party();
    for (const name of ["Eric", "Sam", "Maya"]) expect(P.join(name).ok).toBe(true);
    expect(P.join("Four")).toEqual({ ok: false, message: "This party is full." });
    const v = P.view("m1");
    expect(v.max).toBe(3);
    expect(v.members.map((m) => [m.name, m.seat, m.ready])).toEqual([["Eric", 0, false], ["Sam", 1, false], ["Maya", 2, false]]);
    expect(v.boss).toEqual({ id: "", difficulty: "normal" });
    P.core.message("m2", { t: "ready", on: true });
    P.core.message("m1", { t: "start" });
    expect(P.core.takeStart()).toBeNull();
    // A member can't choose; the leader's choice un-readies everyone.
    P.core.message("m2", { t: "choose", boss: "tiger", difficulty: "hard" });
    expect(P.view("m1").boss).toEqual({ id: "", difficulty: "normal" });
    P.core.message("m1", { t: "choose", boss: "tiger", difficulty: "hard" });
    expect(P.view("m3").boss).toEqual({ id: "tiger", difficulty: "hard" });
    expect(P.view("m3").members.map((m) => m.ready)).toEqual([false, false, false]);
    P.core.message("m2", { t: "ready", on: true });
    P.core.message("m3", { t: "ready", on: true });
    P.core.message("m1", { t: "start" });
    const want = P.core.takeStart()!;
    expect(want).toMatchObject({ id: 1, bots: 0, leaderSeat: 0, boss: "tiger", difficulty: "hard" });
    expect(want.members.map((m) => [m.id, m.seat])).toEqual([["m1", 0], ["m2", 1], ["m3", 2]]);
    expect(new Set(want.members.map((m) => m.pass)).size).toBe(3);
    // A placement for another START (a late one) changes nothing; its own places everyone, each with their own pass.
    P.core.placedIn("OTHER", 99);
    expect(P.view("m2").placed).toBeUndefined();
    P.core.placedIn("BATTL", want.id);
    expect(P.view("m2").placed).toMatchObject({ lobby: "BATTL", pass: want.members[1]!.pass });
    expect(P.view("m3").placed).toMatchObject({ lobby: "BATTL", pass: want.members[2]!.pass });
    expect(P.core.takeStart()).toBeNull();
    // Back for the next battle: everyone un-readied.
    expect(P.view("m2").members.map((m) => m.ready)).toEqual([false, false, false]);
  });

  it("the leader's Kick (never back in, told so) and Promote; a member can do neither", () => {
    const P = party();
    P.join("Eric");
    const sam = P.join("Sam");
    P.join("Maya");
    P.core.message("m2", { t: "kick", id: "m3" });
    P.core.message("m2", { t: "promote", id: "m2" });
    expect(P.view("m1").leaderId).toBe("m1");
    P.core.message("m1", { t: "promote", id: "m2" });
    expect(P.view("m1").leaderId).toBe("m2");
    P.core.message("m2", { t: "kick", id: "m3" });
    expect(P.view("m1").members.map((m) => m.name)).toEqual(["Eric", "Sam"]);
    expect(P.inbox.get("m3")!.at(-1)).toMatchObject({ t: "error", message: KICKED, ended: true });
    const token = P.core.record.kicked![0]!;
    expect(P.core.connect(token, { name: "Maya", v: SQUADS_PROTOCOL })).toEqual({ ok: false, message: KICKED });
    // The seat it left is the next one's.
    expect(sam.ok && P.join("Lee").ok).toBe(true);
    expect(P.view("m1").members.find((m) => m.name === "Lee")!.seat).toBe(2);
    // Its battle's AFK kick: by member id.
    P.core.kickMember("m1");
    expect(P.view("m2").members.map((m) => m.name)).toEqual(["Sam", "Lee"]);
  });

  it("bot members: admins and tests only, ready at once", () => {
    const P = party();
    P.join("Eric");
    P.core.message("m1", { t: "bot", add: true });
    expect(P.view("m1").members).toHaveLength(1);
    P.core.message("m1", { t: "bot", add: true }, { test: true });
    P.core.message("m1", { t: "bot", add: true }, { test: true });
    expect(P.view("m1").members.map((m) => [m.seat, !!m.bot, m.ready])).toEqual([[0, false, false], [1, true, true], [2, true, true]]);
    P.core.message("m1", { t: "start" });
    expect(P.core.takeStart()).toMatchObject({ bots: 2 });
    expect(P.core.takeStart()!.members).toHaveLength(1);
  });
});

describe("Boss Battle party: the review's fixes (#420)", () => {
  function party() {
    const inbox = new Map<string, PartyServerMessage[]>();
    const closed: string[] = [];
    let n = 0;
    const core = new PartyCore(newPartyRecord("PARTY", 5_000_000, "boss"), { now: () => 5_000_000, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now: 0 } as PartyServerMessage]), random: () => `r${++n}`, close: (id) => closed.push(id) });
    const join = (name: string, token?: string) => core.connect(token, { name, v: SQUADS_PROTOCOL, userId: `u-${name}` });
    return { core, inbox, join, closed };
  }

  it("1: someone kicked is banned by account: no way back in, token or none; their socket is closed", () => {
    const P = party();
    P.join("Eric");
    P.join("Maya");
    P.core.message("m1", { t: "kick", id: "m2" });
    expect(P.closed).toEqual(["m2"]);
    // A tokenless hello from the same account (a new seat, the old trick): refused.
    expect(P.join("Maya")).toEqual({ ok: false, message: KICKED });
    expect(P.core.record.members.map((m) => m.name)).toEqual(["Eric"]);
    // Someone else still gets in.
    expect(P.join("Sam").ok).toBe(true);
  });

  it("2: after START, a kick at the stage revokes the kicked member's pass in the battle (by member id)", () => {
    const P = party();
    P.join("Eric");
    P.join("Maya");
    P.core.message("m2", { t: "ready", on: true });
    P.core.message("m1", { t: "start" });
    const want = P.core.takeStart()!;
    P.core.placedIn("BATTL", want.id);
    expect(P.core.takeRevokes()).toBeNull();
    P.core.message("m1", { t: "kick", id: "m2" });
    expect(P.core.takeRevokes()).toEqual({ lobby: "BATTL", start: want.id, members: ["m2"] });
    // Kicked while the battle was being made: revoked in it once it's there.
    const Q = party();
    Q.join("Eric");
    Q.join("Maya");
    Q.core.message("m2", { t: "ready", on: true });
    Q.core.message("m1", { t: "start" });
    const w = Q.core.takeStart()!;
    Q.core.message("m1", { t: "kick", id: "m2" });
    Q.core.placedIn("BATTL", w.id);
    expect(Q.core.takeRevokes()).toEqual({ lobby: "BATTL", start: w.id, members: ["m2"] });
  });

  it("2: in the battle, a pass takes only its own seat, once, from its own account; a revoked pass doesn't get in, and one already in is out", () => {
    const B = battle(3);
    // Maya (seat 1) can't take the leader's seat: her pass gives her seat 1 whatever the app says.
    expect(B.core.connect(undefined, "Maya", "phone", false, 1500, undefined, "u1", null, null, false, { pass: "pass1", seat: 0 }).ok).toBe(true);
    expect(B.last("p1", "lobby")!.party!.seats).toEqual({ p1: 1 });
    // The same pass again (a second device, no token): refused, so nobody fills the battle to start it without the leader.
    expect(B.core.connect(undefined, "Maya2", "phone", false, 1500, undefined, "u1", null, null, false, { pass: "pass1", seat: 2 })).toEqual({ ok: false, message: PARTY_ONLY });
    // Seat 2's member was kicked at the stage after START: their pass is revoked.
    B.core.revokePartyMember("m2");
    expect(B.join(2)).toEqual({ ok: false, message: PARTY_ONLY });
    expect(B.join(0).ok).toBe(true);
    // (Everyone still admitted is here: it begins.)
    expect(B.core.record.phase).not.toBe("lobby");
    B.advance(61_000);
    B.core.revokePartyMember("m1");
    expect(B.core.record.humans.map((h) => h.id)).toEqual(["p2"]);
    expect(B.last("p1", "resigned")!.how).toBe("kicked");
  });

  it("3: it never strands: nobody here when the wait is over, it waits again, and the first to come begins it", () => {
    const B = battle(2);
    expect(B.join(0).ok).toBe(true);
    B.core.disconnect("p1");
    B.advance(BOSS_PARTY.joinWaitSec * 1000 + 10);
    expect(B.core.record.phase).toBe("lobby");
    expect(B.core.record.timer?.kind).toBe("partyStart");
    // Back (with their token): it begins, without waiting for the second member.
    const token = B.core.record.humans[0]!.token;
    expect(B.core.connect(token, "M0", "phone", false, 1500, undefined, "u0").ok).toBe(true);
    expect(B.core.record.phase).not.toBe("lobby");
    // Or someone new after the wait: also at once.
    const C = battle(3);
    C.advance(BOSS_PARTY.joinWaitSec * 1000 + 10);
    expect(C.core.record.phase).toBe("lobby");
    expect(C.join(1).ok).toBe(true);
    expect(C.core.record.phase).not.toBe("lobby");
  });

  it("5: a party's results never count as an online tier beaten; 6: no fair-play signals from a party's battle", () => {
    const B = inPlay(2);
    const r = B.last("p1", "round")!;
    const m = legalMoves(r.board!.fen)[0]!;
    B.core.message("p1", { t: "pick", key: r.key, move: m });
    B.core.message("p2", { t: "pick", key: r.key, move: m });
    B.hostScores({ [m]: 0.6 });
    expect(B.core.fairMoves("p1")).toEqual([]);
    expect(B.core.fairMoves("p2")).toEqual([]);
    // Out on time: the results, each without a tier.
    for (let i = 0; i < 40 && B.core.record.phase !== "results"; i++) {
      B.hostBoss();
      const rr = B.last("p1", "round");
      if (rr && B.core.record.phase === "play") B.advance(rr.deadline - B.now + DEFAULT_SETTINGS.lateGraceMs + 10);
      B.hostScores();
      B.advance(30_000);
    }
    expect(B.core.record.phase).toBe("results");
    const results = B.core.humanResults();
    expect(results).toHaveLength(2);
    for (const res of results) expect(res.bossElo).toBeNull();
  });

  it("7: a member who has picked can still call the God King instead (the pick is replaced)", () => {
    const B = inPlay(3);
    const r = B.last("p1", "round")!;
    B.core.message("p2", { t: "pick", key: r.key, move: legalMoves(r.board!.fen)[0]! });
    B.core.message("p2", { t: "king", key: r.key });
    expect(B.core.record.phase).toBe("scoring");
    expect(B.core.record.round!.picks.p2).toBeUndefined();
    B.hostScores();
    expect(B.last("p1", "reveal")!.king).toBe(true);
  });
});

describe("Boss Battle party: the re-review's fixes (#420)", () => {
  function party() {
    let n = 0;
    const core = new PartyCore(newPartyRecord("PARTY", 5_000_000, "boss"), { now: () => 5_000_000, send: () => undefined, random: () => `r${++n}`, close: () => undefined });
    for (const name of ["Eric", "Sam", "Maya"]) core.connect(undefined, { name, v: SQUADS_PROTOCOL, userId: `u-${name}` });
    core.message("m2", { t: "ready", on: true });
    core.message("m3", { t: "ready", on: true });
    core.message("m1", { t: "start" });
    const want = core.takeStart()!;
    core.placedIn("BATTL", want.id);
    return { core, want };
  }

  it("1: a kick in the join window never closes the battle on the others (the kicked one was the only one in yet)", () => {
    const B = battle(3);
    expect(B.join(2).ok).toBe(true);
    B.core.revokePartyMember("m2", { code: "PARTY", start: 1 });
    expect(B.core.record.humans).toHaveLength(0);
    expect(B.core.record.emptiedAt).toBeUndefined();
    expect(lobbyClosing(B.core.record, false)?.at ?? Infinity).toBeGreaterThan(B.now);
    // The others still get in, and it begins with them.
    expect(B.join(0).ok).toBe(true);
    expect(B.join(1).ok).toBe(true);
    expect(B.core.record.phase).not.toBe("lobby");
  });

  it("2: a revoke for another party or another START (a reused code), or once the battle is over, changes nothing", () => {
    const B = inPlay(2);
    B.core.revokePartyMember("m1", { code: "OTHER", start: 1 });
    B.core.revokePartyMember("m1", { code: "PARTY", start: 2 });
    expect(B.core.record.humans.map((h) => h.id)).toEqual(["p1", "p2"]);
    expect(B.core.takePartyOver()).toBeNull();
    // Over: told once; a revoke then boots nobody off the results.
    for (let i = 0; i < 40 && B.core.record.phase !== "results"; i++) {
      B.hostBoss();
      const rr = B.last("p1", "round");
      if (rr && B.core.record.phase === "play") B.advance(rr.deadline - B.now + DEFAULT_SETTINGS.lateGraceMs + 10);
      B.hostScores();
      B.advance(30_000);
    }
    expect(B.core.record.phase).toBe("results");
    expect(B.core.takePartyOver()).toEqual({ party: "PARTY", start: 1 });
    expect(B.core.takePartyOver()).toBeNull();
    B.core.revokePartyMember("m1", { code: "PARTY", start: 1 });
    expect(B.core.record.humans.map((h) => h.id)).toEqual(["p1", "p2"]);
  });

  it("2: once the party hears its battle is over, a kick at the stage has nothing to revoke there", () => {
    const { core, want } = party();
    core.battleOver(want.id + 1);
    core.message("m1", { t: "kick", id: "m2" });
    expect(core.takeRevokes()).toEqual({ lobby: "BATTL", start: want.id, members: ["m2"] });
    core.battleOver(want.id);
    core.message("m1", { t: "kick", id: "m3" });
    expect(core.takeRevokes()).toBeNull();
  });

  it("3: the battle's AFK kick leaves every other pending revoke alone", () => {
    const { core, want } = party();
    core.message("m1", { t: "kick", id: "m2" });
    core.kickMember("m3");
    expect(core.record.members.map((m) => m.name)).toEqual(["Eric"]);
    expect(core.takeRevokes()).toEqual({ lobby: "BATTL", start: want.id, members: ["m2"] });
  });
});
