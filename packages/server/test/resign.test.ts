import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, LEAVING, RAID_SETTINGS, modeSettings, mulberry32, type Settings } from "@chessroyale/core";
import { legalMoves, lightsOutTimeline, sanLineToUci, type BoardScore, type Opening, type ServerMessage } from "@chessroyale/chess";
import { SQUADS_PROTOCOL } from "@chessroyale/chess/squads";
import { LEFT_MATCH, LobbyCore, lobbyClosing, newLobbyRecord } from "../src/lobby.ts";
import { squadsClosing } from "../src/squads-lobby.ts";
import { squadsLobby } from "./squads-fixture.ts";

/**
 * Resigning and leaving a match (LEAVING in settings.ts; DECISIONS.md, "Resign: leaving a match in every mode"): the
 * seat to a bot, the loss on the record, the last one out closing the lobby, a reload within the grace, nobody held up
 * after it, and resigning in the middle of a boss's moments.
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O", "h3", "Nb8", "d4", "Nbd7", "c4"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({
  id: `o${i}`,
  eco: "C95",
  name: `Opening ${i}`,
  family: `Family ${i}`,
  unusual: i >= 25,
  moves: line,
  namedPlies: 21,
  expected: Object.fromEntries(Array.from({ length: 22 }, (_, n) => [n, 0.5])),
}));

type Msg = ServerMessage;

/**
 * A lobby on a fake clock with an outbox per player, a record of whose sockets it closed, and a host that scores. As
 * the Durable Object runs it: every use of `core` is a fresh LobbyCore from the stored record (its match runner
 * restored from its snapshot), never one kept in memory between events.
 */
function setup(settings: Partial<Settings> = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const closed: string[] = [];
  const io = {
    now: () => now,
    send: (id: string, msg: object) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]),
    close: (id: string) => void closed.push(id),
  };
  const rng = mulberry32(7);
  const base = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...settings };
  let record = newLobbyRecord("ABCDE", now);
  let kept: LobbyCore | null = null;
  const fresh = () => {
    if (kept) record = structuredClone(kept.save());
    kept = new LobbyCore(record, io as never, library, rng, base);
    return kept;
  };
  const coreRef = { get core() { return fresh(); } };
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const all = <T extends Msg["t"]>(id: string, t: T) => (inbox.get(id) ?? []).filter((m) => m.t === t) as Extract<Msg, { t: T }>[];
  /** The next alarm (or `ms` at most), as the Durable Object would run it. */
  const step = (ms = 60_000) => {
    const next = coreRef.core.nextAlarm;
    now = next !== null && next - now <= ms ? Math.max(now, next) : now + ms;
    if (coreRef.core.nextAlarm !== null && coreRef.core.nextAlarm <= now) coreRef.core.alarm();
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (let i = 0; i < 10_000 && now < end; i++) step(end - now);
  };
  /** Whoever holds a score request answers it (a hash "engine"). */
  const scores = () => {
    for (const [id, msgs] of inbox) {
      const req = [...msgs].reverse().find((m) => m.t === "scoreRequest") as Extract<Msg, { t: "scoreRequest" }> | undefined;
      if (!req || coreRef.core.record.scoreRequest?.key !== req.key || coreRef.core.record.hostId !== id) continue;
      const boards: BoardScore[] = req.jobs.map((j) => {
        const legal = j.allowed ?? legalMoves(j.fen);
        const exp = Object.fromEntries(legal.map((m) => [m, 0.3 + 0.4 * hash(j.fen + m)]));
        const best = legal.reduce((a, b) => (exp[b]! > exp[a]! ? b : a));
        return { boardId: j.boardId, bestMove: best, bestExpected: exp[best]!, expectedAfter: exp, botPicks: Object.fromEntries(j.bots.map((b, i) => [b.id, legal[i % legal.length]!])), botThinkMs: Object.fromEntries(j.bots.map((b) => [b.id, 4000])) };
      });
      coreRef.core.message(id, { t: "scores", key: req.key, boards });
      return true;
    }
    return false;
  };
  /** Whoever hosts answers the boss's request (its first allowed move). */
  const bossMove = () => {
    const host = coreRef.core.record.hostId;
    const req = host ? last(host, "bossRequest") : undefined;
    if (!host || !req || coreRef.core.record.bossKey !== req.key) return false;
    coreRef.core.message(host, { t: "bossMove", key: req.key, move: (req.allowed ?? legalMoves(req.fen))[0]! });
    return true;
  };
  /** Runs the match on until `done` (the host scoring and playing the boss), within `maxMs` of lobby time. */
  const until = (done: () => boolean, maxMs = 30 * 60_000) => {
    const end = now + maxMs;
    while (!done() && now < end) if (!scores() && !bossMove()) step(5_000);
    expect(done()).toBe(true);
  };
  const runner = () => coreRef.core.save().runner!;
  return { get core() { return coreRef.core; }, last, all, step, advance, scores, bossMove, until, runner, inbox, closed, get now() { return now; } };
}

type Lobby = ReturnType<typeof setup>;
const join = (L: Lobby, n: number, first = 1) => {
  for (let i = first; i < first + n; i++) L.core.connect(undefined, `P${i}`, i === 1 ? "computer" : "phone", false, 1500, undefined, `user-${i}`);
};
/** A matchmade (Default) Crowd 50 v 50 with `n` people and bots in the other seats, run on to move 1. */
function crowd(n: number, extra: Partial<Settings> = {}) {
  const L = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: false }), ...extra });
  L.core.setAuto(L.now + 60_000);
  join(L, n);
  L.advance(60_000);
  L.until(() => L.core.record.phase === "play");
  return L;
}

describe("resigning online: Crowd 50 v 50 and raids", () => {
  it("mid-match: a loss in the last place still open, a bot takes the seat (the same team, its score), the others play on; told how, and let go", () => {
    const L = crowd(2);
    const seat = L.runner().state.players.find((p) => p.id === "p2")!;
    L.core.message("p2", { t: "resign" });
    // Told how they left and what's on their record, then their sockets close.
    expect(L.last("p2", "resigned")).toMatchObject({ how: "resigned", result: { placement: 100, players: 100, ranked: false } });
    expect(L.closed).toEqual(["p2"]);
    expect(L.core.record.humans.map((h) => h.id)).toEqual(["p1"]);
    // A bot plays the seat from now on: a new id and a bot's name, the same team and score.
    const players = L.runner().state.players;
    expect(players.find((p) => p.id === "p2")).toBeUndefined();
    const bot = players.find((p) => p.id.startsWith("rb"))!;
    expect(bot).toMatchObject({ isBot: true, skill: LEAVING.botSkill, colour: seat.colour, stageScore: seat.stageScore, alive: true });
    expect(players.filter((p) => p.name === bot.name)).toHaveLength(1);
    expect(L.core.record.bots.some((b) => b.id === bot.id)).toBe(true);
    // Everyone else sees the seat change hands (a bot now, in the same place).
    const lobby = L.last("p1", "lobby")!;
    expect(lobby.players.some((p) => p.id === "p2")).toBe(false);
    expect(lobby.players.find((p) => p.id === bot.id)).toMatchObject({ isBot: true, name: bot.name });
    // The loss, for their profile (the Durable Object writes it as they go).
    expect(L.core.takeLeftResults()).toMatchObject([{ playerId: "p2", placement: 100, players: 100, teamWon: false, team: seat.colour, ranked: false }]);
    // The match plays on for the others: p1 sees the next move come, and the seat is a bot's in the scoring.
    const rounds = L.all("p1", "round").length;
    L.until(() => L.all("p1", "round").length > rounds);
    // Back with the old seat's token: told they left (their app goes home with its own note).
    const token = L.core.record.left![0]!.token;
    expect(L.core.connect(token, "P2", "phone")).toEqual({ ok: false, message: LEFT_MATCH, ended: true, left: { how: "resigned", result: { placement: 100, players: 100, ranked: false } } });
  });

  it("a rated loss: in a ranked match the resign counts for ranking, and the match stays ranked for everyone who stays", () => {
    const L = crowd(30);
    expect(L.core.ranked()).toBe(true);
    const alive = L.runner().state.players.filter((p) => p.alive).length;
    L.core.message("p7", { t: "resign" });
    expect(L.last("p7", "resigned")).toMatchObject({ how: "resigned", result: { placement: alive, ranked: true } });
    expect(L.core.takeLeftResults()).toMatchObject([{ playerId: "p7", ranked: true, teamWon: false }]);
    // (29 people and a bot in the seat: still a match of 30 real players.)
    expect(L.core.ranked()).toBe(true);
  });

  it("before move 1 (the votes) it's just Leave: nothing recorded, their vote goes with them, a bot sits in", () => {
    const L = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: true }) });
    L.core.setAuto(L.now + 60_000);
    join(L, 2);
    L.advance(60_000);
    L.until(() => L.core.record.phase === "vote");
    const vote = L.last("p2", "vote")!.vote;
    L.core.message("p2", { t: "vote", key: vote.key, option: 1 });
    expect(L.core.record.vote!.votes.p2).toBeTruthy();
    L.core.message("p2", { t: "resign" });
    expect(L.last("p2", "resigned")).toEqual(expect.objectContaining({ how: "early", result: null }));
    expect(L.core.record.vote!.votes.p2).toBeUndefined();
    expect(L.last("p1", "vote")!.vote.votes.some((v) => v.playerId === "p2")).toBe(false);
    expect(L.runner().state.players.filter((p) => !p.isBot).map((p) => p.id)).toEqual(["p1"]);
    expect(L.runner().state.players).toHaveLength(100);
    expect(L.core.takeLeftResults()).toEqual([]);
    // The votes and the match go on.
    L.until(() => L.core.record.phase === "play");
  });

  it("Cancel on the queue screen once its seats have filled (an older app's \"leave\") is leaving the match: a bot sits in", () => {
    const L = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: true }) });
    L.core.setAuto(L.now + 60_000);
    join(L, 2);
    L.advance(60_000);
    expect(L.core.record.auto?.filledAt).toBeTruthy();
    expect(L.core.record.phase).toBe("lobby");
    L.core.message("p2", { t: "leave" });
    expect(L.core.record.humans.map((h) => h.id)).toEqual(["p1"]);
    expect(L.core.record.left).toMatchObject([{ id: "p2", how: "early", result: null }]);
    expect(L.runner().state.players.filter((p) => !p.isBot).map((p) => p.id)).toEqual(["p1"]);
    expect(L.runner().state.players).toHaveLength(100);
  });

  it("Bots off (a private raid, people only): a seat goes out, no bot; the crowd's last seat is the exception, so the battle goes on for whoever watches", () => {
    // Three people; the boss strikes after every crowd move (down to half the crowd: one strike).
    const L = setup({ ...RAID_SETTINGS, bossKillEvery: 1, lastStandFrom: 999 });
    join(L, 3);
    L.core.message("p1", { t: "start" });
    L.until(() => L.core.record.phase === "play");
    // p1 and p3 pick, p2 misses: the boss strikes the worst down. (Two who both missed would be tied, and a tie for the
    // worst waits: DECISIONS.md, "Opening grace and ties survive the cut".)
    const r = L.last("p1", "round")!;
    for (const id of ["p1", "p3"]) L.core.message(id, { t: "pick", key: r.key, move: (r.boss?.powers?.allowed ?? legalMoves(r.board!.fen))[0]! });
    L.until(() => (L.runner().state.boss?.kills.length ?? 0) === 1);
    const struck = L.runner().state.boss!.kills[0]!.id;
    const other = ["p2", "p3"].find((id) => id !== struck)!;
    // The other one resigns: out in the last place still open (2nd of 3), no bot.
    L.core.message(other, { t: "resign" });
    expect(L.last(other, "resigned")).toMatchObject({ how: "resigned", result: { placement: 2, players: 3 } });
    expect(L.core.record.bots).toEqual([]);
    expect(L.runner().state.players.find((p) => p.id === other)).toMatchObject({ alive: false, placement: 2 });
    expect(L.core.record.placements[other]).toBe(2);
    // p1, the last of the crowd, resigns while the struck one still watches: 1st of 3 on their record (a loss), and a
    // bot plays on so the battle reaches its end on the watcher's screen.
    L.core.message("p1", { t: "resign" });
    expect(L.last("p1", "resigned")).toMatchObject({ how: "resigned", result: { placement: 1, players: 3 } });
    expect(L.core.record.bots).toHaveLength(1);
    expect(L.runner().state.players.filter((p) => p.alive).map((p) => p.isBot)).toEqual([true]);
    expect(L.core.record.phase).not.toBe("results");
    L.until(() => L.core.record.phase === "results", 60 * 60_000);
    // The watcher's result is theirs as it stood (struck down), with everyone's.
    expect(L.core.humanResults()).toMatchObject([{ playerId: struck, placement: 3 }]);
    expect(L.core.takeLeftResults().map((r) => [r.playerId, r.placement, r.teamWon, r.survived])).toEqual([
      [other, 2, false, false],
      ["p1", 1, false, false],
    ]);
  });

  it("already out (cut): leaving takes them home; their result stands, recorded with everyone's when the match ends", () => {
    // Two moves before the cut (each team picks once); both people miss theirs, so the cut takes them.
    const L = crowd(2, { firstStageRounds: 2 });
    L.until(() => L.core.record.phase === "stageBreak");
    const out = L.runner().state.players.filter((p) => !p.isBot && !p.alive).map((p) => p.id);
    expect(out.sort()).toEqual(["p1", "p2"]);
    const place = L.core.record.placements.p2!;
    L.core.message("p2", { t: "resign" });
    expect(L.last("p2", "resigned")).toEqual(expect.objectContaining({ how: "out", result: null }));
    expect(L.core.takeLeftResults()).toEqual([]);
    L.until(() => L.core.record.phase === "results", 4 * 3_600_000);
    expect(L.core.humanResults().map((r) => [r.playerId, r.placement])).toEqual([
      ["p1", L.core.record.placements.p1],
      ["p2", place],
    ]);
  });

  it("the last person to resign ends the match at once, and the lobby closes (its code free)", () => {
    const L = crowd(1);
    L.core.message("p1", { t: "resign" });
    expect(L.core.record.phase).toBe("results");
    expect(L.core.record.wrapped).toBe(true);
    expect(L.core.nextAlarm).toBeNull();
    expect(lobbyClosing(L.core.record, false)).toEqual({ at: L.now, reason: "ended" });
    expect(L.core.takeLeftResults()).toMatchObject([{ playerId: "p1", placement: 100, teamWon: false }]);
  });

  it("a reload within LEAVING.awayMs keeps the seat; gone longer, they've left it (as an app that never sends resign does), and nobody waits for them", () => {
    const L = crowd(2);
    const token = L.core.record.humans.find((h) => h.id === "p2")!.token;
    L.core.disconnect("p2");
    L.advance(LEAVING.awayMs - 5_000);
    expect(L.core.connect(token, "P2", "phone")).toEqual({ ok: true, playerId: "p2" });
    expect(L.core.record.left ?? []).toEqual([]);
    expect(L.runner().state.players.find((p) => p.id === "p2")!.isBot).toBe(false);
    // Gone again, for longer: they've left the match, a loss, and a bot plays the seat.
    L.core.disconnect("p2");
    const gone = L.now;
    L.advance(LEAVING.awayMs + 1_000);
    expect(L.core.record.left).toMatchObject([{ id: "p2", how: "away", at: gone + LEAVING.awayMs }]);
    expect(L.runner().state.players.find((p) => p.id === "p2")).toBeUndefined();
    expect(L.core.takeLeftResults()).toMatchObject([{ playerId: "p2", teamWon: false }]);
    // p1 is still here: the match goes on.
    expect(L.core.record.phase).not.toBe("results");
    expect(L.core.connect(token, "P2", "phone")).toMatchObject({ ok: false, ended: true, left: { how: "away" } });
  });

  it("someone away doesn't hold the move up: it locks once everyone here has moved (with nobody here, it waits for the clock)", () => {
    // Everyone moves (no teams): both people pick every move. (No cut for a while: p2's misses mustn't put him out.)
    const L = setup({ ...modeSettings("crowd", { crowdTeams: false, augments: false }), firstStageRounds: 10, roundsPerStage: 10 });
    L.core.setAuto(L.now + 60_000);
    join(L, 2);
    L.advance(60_000);
    L.until(() => L.core.record.phase === "play");
    L.core.disconnect("p2");
    const r = L.last("p1", "round")!;
    L.core.message("p1", { t: "pick", key: r.key, move: legalMoves(r.board!.fen)[0]! });
    expect(L.core.record.phase).toBe("scoring");
    // Next move: p2 back and p1 picks: the move waits for p2.
    const token = L.core.record.humans.find((h) => h.id === "p2")!.token;
    L.core.connect(token, "P2", "phone");
    L.until(() => L.core.record.phase === "play" && L.last("p1", "round")!.key !== r.key);
    const r2 = L.last("p1", "round")!;
    L.core.message("p1", { t: "pick", key: r2.key, move: legalMoves(r2.board!.fen)[0]! });
    expect(L.core.record.phase).toBe("play");
    // p2 drops now: everyone here has moved, so it locks.
    L.core.disconnect("p2");
    expect(L.core.record.phase).toBe("scoring");
  });

  it("resigning on the boss's turn as its host: the next host is asked for its move, and the battle goes on", () => {
    const L = setup({ ...RAID_SETTINGS, lastStandFrom: 999 });
    L.core.setAuto(L.now + 60_000);
    join(L, 2);
    L.advance(60_000);
    L.until(() => L.core.record.phase === "play");
    expect(L.core.record.hostId).toBe("p1");
    const r = L.last("p1", "round")!;
    for (const id of ["p1", "p2"]) L.core.message(id, { t: "pick", key: r.key, move: (r.boss?.powers?.allowed ?? legalMoves(r.board!.fen))[0]! });
    // On to the boss's turn: its request is p1's.
    while (!(L.core.record.phase === "boss" && L.core.record.bossKey)) if (!L.scores()) L.step(2_000);
    const key = L.core.record.bossKey!;
    expect(L.last("p1", "bossRequest")!.key).toBe(key);
    L.core.message("p1", { t: "resign" });
    expect(L.core.record.hostId).toBe("p2");
    expect(L.last("p2", "bossRequest")!.key).toBe(key);
    L.core.message("p2", { t: "bossMove", key, move: L.last("p2", "bossRequest")!.allowed?.[0] ?? legalMoves(L.last("p2", "bossRequest")!.fen)[0]! });
    const rounds = L.all("p2", "round").length;
    L.until(() => L.all("p2", "round").length > rounds);
  });

  it("resigning during Hollow's Lights out: out of the test, and its round no longer waits for them", () => {
    const L = setup({ ...RAID_SETTINGS, bossId: "hollow", bossPowerTest: "lightsout", lastStandFrom: 999 });
    L.core.setAuto(L.now + 60_000);
    join(L, 2);
    L.advance(60_000);
    // Two crowd moves (the boss's first move between them), then his turn opens with Lights out.
    for (let n = 0; n < 2; n++) {
      L.until(() => L.core.record.phase === "play");
      const r = L.last("p1", "round")!;
      for (const id of ["p1", "p2"]) L.core.message(id, { t: "pick", key: r.key, move: (r.boss?.powers?.allowed ?? legalMoves(r.board!.fen))[0]! });
      L.until(() => L.core.record.phase !== "play" && L.core.record.phase !== "scoring" && L.core.record.phase !== "reveal");
      if (n === 0) L.until(() => L.core.record.phase === "play");
    }
    L.until(() => !!L.core.record.lights);
    const lights = L.last("p1", "lights")!.lights;
    expect(Object.keys(L.core.record.lights!.taps).sort()).toEqual(["p1", "p2"]);
    L.core.message("p2", { t: "resign" });
    expect(Object.keys(L.core.record.lights!.taps)).toEqual(["p1"]);
    // Round 1 open: p1 uses their one try, and with nobody else in the test the round is over at once.
    const open = lightsOutTimeline(lights.rounds, DEFAULT_SETTINGS.lateGraceMs).rounds[0]!.at;
    L.advance(Math.max(0, lights.at + open + 300 - L.now));
    L.core.message("p1", { t: "lightsTap", key: lights.key, round: 0, square: "e4" });
    expect(L.last("p1", "lights")!.lights.rounds[0]!.answers).toBeTruthy();
    // And then the lights come back and he moves: the battle goes on.
    L.until(() => !!L.core.record.bossKey && !L.core.record.lights);
  });

  it("a private lobby nobody started closes when its last person presses Leave (its code stops working); while anyone's there, the idle rule", () => {
    const L = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: false }) });
    join(L, 2);
    L.core.message("p1", { t: "leave" });
    expect(lobbyClosing(L.core.record, true)!.reason).toBe("idle");
    expect(lobbyClosing(L.core.record, true)!.at).toBeGreaterThan(L.now + 30 * 60_000);
    L.core.message("p2", { t: "leave" });
    expect(lobbyClosing(L.core.record, false)).toEqual({ at: L.now, reason: "idle" });
    // (A resign from the waiting room is the same Leave, and says so.)
    const M = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: false }) });
    join(M, 1);
    M.core.message("p1", { t: "resign" });
    expect(M.last("p1", "resigned")).toEqual(expect.objectContaining({ how: "early", result: null }));
    expect(M.core.record.humans).toEqual([]);
    expect(lobbyClosing(M.core.record, false)).toEqual({ at: M.now, reason: "idle" });
  });
});

describe("resigning in Squads", () => {
  it("mid-bracket: a loss at the worst place the squad can still finish, a bot plays the seat, the squad plays on; back with the token, told again", () => {
    const L = squadsLobby({ seed: 5 });
    const a = L.join("Ann", { userId: "ua" });
    const b = L.join("Bo", { userId: "ub" });
    L.players.add(a);
    L.runUntil(() => L.core.record.phase === "bracket", 10 * 60_000, "the bracket");
    const token = L.core.record.humans.find((h) => h.id === b)!.token;
    L.core.message(b, { t: "leave" });
    expect(L.last(b, "left")).toEqual(expect.objectContaining({ how: "resigned", result: { placement: 5, players: 8 } }));
    expect(L.closed).toContain(b);
    expect(L.core.record.squads.flatMap((sq) => sq.players).find((p) => p.id === b)!.replacedByBot).toBe(true);
    expect(L.core.takeRewards()).toMatchObject([{ playerId: b, userId: "ub", placement: 5, coins: 0, crates: 0, recorded: true }]);
    expect(L.core.connect(token, { name: "Bo", v: SQUADS_PROTOCOL })).toMatchObject({ ok: false, ended: true, left: { how: "resigned", result: { placement: 5 } } });
    // Ann is still here: the bracket plays on.
    L.advance(5 * 60_000);
    expect(L.core.record.phase).toBe("bracket");
  });

  it("before the bracket (the votes) leaving records nothing", () => {
    const L = squadsLobby({ seed: 5 });
    const a = L.join("Ann", { userId: "ua" });
    L.join("Bo", { userId: "ub" });
    L.runUntil(() => L.core.record.phase === "vote", 5 * 60_000, "the votes");
    L.core.message(a, { t: "leave" });
    expect(L.last(a, "left")).toEqual(expect.objectContaining({ how: "early", result: null }));
    expect(L.core.takeRewards()).toEqual([]);
  });

  it("the last person to leave ends the lobby at once and it closes (its code free); everyone away past the grace: the same", () => {
    const L = squadsLobby({ seed: 5 });
    const a = L.join("Ann", { userId: "ua" });
    L.players.add(a);
    L.runUntil(() => L.core.record.phase === "bracket", 10 * 60_000, "the bracket");
    L.core.message(a, { t: "leave" });
    expect(L.core.record.phase).toBe("results");
    expect(L.core.record.wrapped).toBe(true);
    expect(L.core.nextAlarm).toBeNull();
    expect(squadsClosing(L.core.record, false)).toEqual({ at: L.now, reason: "ended" });
    expect(L.core.takeRewards()).toMatchObject([{ playerId: a, placement: 5, coins: 0, recorded: true }]);

    // Away: Cy closes the app mid-bracket and never comes back.
    const M = squadsLobby({ seed: 6 });
    const c = M.join("Cy", { userId: "uc" });
    M.players.add(c);
    M.runUntil(() => M.core.record.phase === "bracket", 10 * 60_000, "the bracket");
    M.players.delete(c);
    M.core.disconnect(c);
    const gone = M.now;
    M.runUntil(() => M.core.record.phase === "results", LEAVING.awayMs + 60_000, "the end");
    expect(M.now - gone).toBeLessThanOrEqual(LEAVING.awayMs + 1_000);
    expect(M.core.record.wrapped).toBe(true);
    expect(M.core.takeRewards()).toMatchObject([{ playerId: c, coins: 0, recorded: true }]);
  });
});
