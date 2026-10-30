import { describe, expect, it } from "vitest";
import { BOSS_PARTY, DEFAULT_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { legalMoves, type BoardScore, type MatchRunner, type ServerMessage } from "@chessroyale/chess";
import { SQUADS_PROTOCOL, type PartyServerMessage } from "@chessroyale/chess/squads";
import { LobbyCore, PARTY_ONLY, newLobbyRecord } from "../src/lobby.ts";
import { bossPartyOverrides, partyLobby } from "../src/boss-party.ts";
import { KICKED, PartyCore, newPartyRecord, type BossStart } from "../src/squads-party.ts";
import { library } from "./lobby-fixture.ts";

type Msg = ServerMessage;

/** A party's battle on a fake clock: `size` members expected, the host (p1) scoring with a fixed "engine". */
function battle(size: number, patch: Partial<Settings> = {}, bots = 0) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const start: BossStart = { pass: "pass1", size, bots, leaderSeat: 0, boss: "gingerbread", difficulty: "normal" };
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
  const join = (seat: number, pass = "pass1") => core.connect(undefined, `M${seat}`, "phone", false, 1500, undefined, undefined, null, null, false, { pass, seat });
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
    expect(B.core.takePartyKicks()).toEqual({ party: "PARTY", seats: [2] });
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
    const core = new PartyCore(newPartyRecord("PARTY", now, "boss"), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as PartyServerMessage]), random: () => `r${++n}` });
    const view = (id: string) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === "party")!.party as Extract<PartyServerMessage, { t: "party" }>["party"];
    const join = (name: string) => core.connect(undefined, { name, v: SQUADS_PROTOCOL });
    return { core, inbox, view, join, tick: (ms: number) => (now += ms) };
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
    expect(P.core.takeStart()).toEqual({ pass: expect.any(String), size: 3, bots: 0, leaderSeat: 0, boss: "tiger", difficulty: "hard" });
    P.core.placedIn("BATTL");
    expect(P.view("m2").placed).toMatchObject({ lobby: "BATTL" });
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
    // Its battle's AFK kick: by seat.
    P.core.kickSeat(0);
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
    expect(P.core.takeStart()).toMatchObject({ size: 1, bots: 2 });
  });
});
