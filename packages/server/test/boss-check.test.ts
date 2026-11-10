/**
 * The boss's move, played by two devices with one seed (BOSS_CHECK; docs/decisions/2026-11-10-boss-and-lone-devices.md), and a
 * match that rests on one device's word paying as a solo game (LobbyRecord.unvouched). The outside review's lying-host proof
 * (notes/fable-lying-host.test.ts: a host that sent the boss's worst move each turn won the raid in 8 moves) turned around.
 */
import { describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { BOSS_CHECK, DEFAULT_SETTINGS, JUDGES, RAID_SETTINGS, mulberry32, type JudgeConfig, type Settings } from "@chessroyale/core";
import { legalMoves, runJudgeJob, type BoardScore, type EngineLike, type MoveScore, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord, type ServerScoreRequest } from "../src/lobby.ts";
import { library } from "./lobby-fixture.ts";

// (The engine server is a Container, which needs the Workers runtime: the match rooms import it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));
const { lobbyXpGame } = await import("../src/lobby-do.ts");

type Msg = ServerMessage;
const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const after = (fen: string, uci: string) => {
  const c = new Chess(fen);
  c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return c;
};
/** What the side to move can win at once: a mate 100, else its best capture's value. */
function gain(fen: string): number {
  let best = 0;
  for (const m of legalMoves(fen)) {
    const cap = new Chess(fen).get(m.slice(2, 4) as never) as { type: string } | null;
    let v = cap ? VAL[cap.type]! : 0;
    if (after(fen, m).isCheckmate()) v = 100;
    best = Math.max(best, v);
  }
  return best;
}
/** A move's worth to its mover, 0 to 1: what it leaves the other side to win at once (a mate: nothing left; a queen: 0.1). */
const worth = (fen: string, m: string) => {
  const c = after(fen, m);
  if (c.isCheckmate()) return 1;
  const g = gain(c.fen());
  return g >= 100 ? 0 : Math.max(0, 1 - g / 10);
};
/** The honest boss move here (what every honest device with the seed plays, in this test): the one leaving the crowd least. */
const honestMove = (fen: string, allowed: readonly string[]) => [...allowed].sort((a, b) => worth(fen, b) - worth(fen, a) || (a < b ? -1 : 1))[0]!;
/** The thrower's: the one leaving the crowd most. */
const worstMove = (fen: string, allowed: readonly string[]) => [...allowed].sort((a, b) => worth(fen, a) - worth(fen, b) || (a < b ? -1 : 1))[0]!;
/** The crowd's greedy pick: the biggest capture, a mate first. */
const greedy = (fen: string, allowed: readonly string[]) => {
  let best = { m: allowed[0]!, v: -1 };
  for (const m of allowed) {
    const cap = new Chess(fen).get(m.slice(2, 4) as never) as { type: string } | null;
    const v = after(fen, m).isCheckmate() ? 100 : cap ? VAL[cap.type]! : 0;
    if (v > best.v) best = { m, v };
  }
  return best.m;
};
/** A judge's engine for the vouched case: any fixed numbers do (both judges give the same). */
const fixed: EngineLike = {
  topMoves: async (fen, n) => legalMoves(fen).map((move) => ({ move, expected: worth(fen, move) })).sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1)).slice(0, n),
  scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: worth(fen, move) })),
  scoreMovesAt: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: worth(fen, move) })),
};

function raid(opts: { server?: boolean; judges?: Partial<JudgeConfig>; settings?: Partial<Settings> } = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const asks: ServerScoreRequest[] = [];
  const core = new LobbyCore(
    newLobbyRecord("RAIDS", now),
    {
      now: () => now,
      send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]),
      judges: { ...JUDGES, on: false, ...opts.judges },
      judgeRng: mulberry32(3),
      serverEngine: !!opts.server,
      serverScore: (req) => void asks.push(req),
    },
    library,
    mulberry32(7),
    { ...DEFAULT_SETTINGS, boardIntroSeconds: 0, ...RAID_SETTINGS, raidOpening: true, ...opts.settings },
  );
  const all = <T extends Msg["t"]>(id: string, t: T) => (inbox.get(id) ?? []).filter((m) => m.t === t) as Extract<Msg, { t: T }>[];
  const last = <T extends Msg["t"]>(id: string, t: T) => all(id, t).at(-1);
  const take = <T extends Msg["t"]>(id: string, t: T) => {
    const out = all(id, t);
    inbox.set(id, (inbox.get(id) ?? []).filter((m) => m.t !== t));
    return out;
  };
  const advance = (ms: number) => {
    now += ms;
    while (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  /** The engine server answers what it was asked (the moves' worth to the mover). */
  const serve = () => {
    for (const req of asks.splice(0)) core.serverScored(req.id, req.moves.map((move) => ({ move, expected: worth(req.fen, move) }) as MoveScore));
  };
  return { core, last, take, advance, serve, asks, now: () => now };
}

/** Two people in a raid: `p1` a computer (the host), `p2` a phone; both up-to-date apps (their speed known: they can check). */
function twoPeople(L: ReturnType<typeof raid>, speed = true) {
  L.core.connect(undefined, "Cheat", "computer", false, 1500);
  L.core.connect(undefined, "Friend", "phone", false, 1500);
  if (speed) for (const id of ["p1", "p2"]) L.core.message(id, { t: "speed", nps: 800_000 });
  L.core.message("p1", { t: "start" });
  L.advance(1000);
}

/** Plays the crowd's turns (greedy) and the host's scoring (honest numbers) until the boss is asked for a move. */
function untilBoss(L: ReturnType<typeof raid>, ids = ["p1", "p2"]) {
  // (Not the battle's intro: the boss's turn, its request out.)
  for (let i = 0; i < 300 && !(L.core.record.phase === "boss" && L.core.record.bossKey) && L.core.record.phase !== "results"; i++) {
    const phase = L.core.record.phase;
    if (phase === "play") {
      for (const id of ids) {
        const r = L.last(id, "round");
        if (r?.board && !L.core.record.round?.picks[id]) L.core.message(id, { t: "pick", key: r.key, move: greedy(r.board.fen, r.boss?.powers?.allowed ?? legalMoves(r.board.fen)) });
      }
    } else if (phase === "scoring") hostScores(L, ids);
    L.advance(1000);
  }
}

/** The host scores the round as a device would (its own numbers, every pick and bot scored). */
function hostScores(L: ReturnType<typeof raid>, ids: string[]) {
  for (const id of ids) {
    for (const req of L.take(id, "scoreRequest")) {
      const boards: BoardScore[] = req.jobs.map((j) => {
        const legal = j.allowed ?? legalMoves(j.fen);
        const bots = Object.fromEntries(j.bots.map((b) => [b.id, greedy(j.fen, legal)]));
        const moves = [...new Set([...legal])];
        const scored = Object.fromEntries(moves.map((m) => [m, worth(j.fen, m)]));
        const best = [...moves].sort((a, b) => scored[b]! - scored[a]!)[0]!;
        return { boardId: j.boardId, bestMove: best, bestExpected: scored[best]!, expectedAfter: scored, botPicks: bots, botThinkMs: {} };
      });
      L.core.message(id, { t: "scores", key: req.key, boards });
    }
  }
}

describe("the boss's move, played by two devices with one seed (the review's lying-host proof, turned around)", () => {
  it("a host that throws the boss's move each turn: the checker's honest move plays (the engine server's pick), the host is benched, and the crowd hasn't won in 8 moves", () => {
    const L = raid({ server: true });
    twoPeople(L);
    const played: { honest: string; got: string | null }[] = [];
    let crowdMoves = 0;
    for (let i = 0; i < 600 && L.core.record.phase !== "results" && crowdMoves < 8; i++) {
      const phase = L.core.record.phase;
      if (phase === "boss" && L.core.record.bossKey) {
        const key = L.core.record.bossKey;
        const asked = ["p1", "p2"].flatMap((id) => L.take(id, "bossRequest").filter((r) => r.key === key).map((r) => ({ id, r })));
        for (const { id, r } of asked) {
          const allowed = r.allowed ?? legalMoves(r.fen);
          // (Both asked with one seed; once the thrower is benched, the other alone, with none.)
          if (asked.length === 2) expect(r.draw).toBe(asked[0]!.r.draw);
          const move = id === "p1" ? worstMove(r.fen, allowed) : honestMove(r.fen, allowed);
          L.core.message(id, { t: "bossMove", key: r.key, move });
          if (id === "p2") played.push({ honest: move, got: null });
        }
        L.serve();
        const b = L.last("p2", "boss");
        if (played.length && played.at(-1)!.got === null && b?.boss.lastMove) played.at(-1)!.got = b.boss.lastMove.move;
      } else if (phase === "play") {
        for (const id of ["p1", "p2"]) {
          const r = L.last(id, "round");
          if (r?.board && !L.core.record.round?.picks[id]) L.core.message(id, { t: "pick", key: r.key, move: greedy(r.board.fen, r.boss?.powers?.allowed ?? legalMoves(r.board.fen)) });
        }
        if (Object.keys(L.core.record.round?.picks ?? {}).length === 2) crowdMoves++;
      } else if (phase === "scoring") hostScores(L, ["p1", "p2"]);
      L.advance(1000);
    }
    const asked = played.filter((p) => p.got !== null);
    // (A raid whose thrower was benched rests on one device from then on: it pays as a solo game.)
    expect(L.core.record.unvouched).toBeTruthy();
    expect(asked.length).toBeGreaterThanOrEqual(4);
    // Every boss move that played was the honest one: the thrower's never.
    for (const p of asked) expect(p.got).toBe(p.honest);
    // The thrower was benched (its moves a queen or a mate worse), so it hosts nothing more.
    expect(L.core.record.judges!.devices.p1!.strikes).toBeGreaterThanOrEqual(JUDGES.strikes);
    // The crowd hasn't won in 8 moves (the review's host won in 8).
    const won = L.core.record.phase === "results" && L.core.humanResults().every((r) => r.teamWon === true);
    expect(won).toBe(false);
  });

  it("two honest devices: one seed to both, the same move plays at once, the engine server isn't asked, and the match stays vouched", async () => {
    const L = raid({ server: true, judges: { on: true } });
    twoPeople(L);
    let bossMoves = 0;
    const draws: number[] = [];
    for (let i = 0; i < 400 && L.core.record.phase !== "results" && bossMoves < 3; i++) {
      const phase = L.core.record.phase;
      if (phase === "boss" && L.core.record.bossKey) {
        const key = L.core.record.bossKey;
        const reqs = ["p1", "p2"].flatMap((id) => L.take(id, "bossRequest").filter((r) => r.key === key).map((r) => ({ id, r })));
        if (reqs.length) {
          expect(reqs.map((x) => x.id).sort()).toEqual(["p1", "p2"]);
          expect(reqs[0]!.r.draw).toBe(reqs[1]!.r.draw);
          draws.push(reqs[0]!.r.draw!);
          for (const { id, r } of reqs) L.core.message(id, { t: "bossMove", key: r.key, move: honestMove(r.fen, r.allowed ?? legalMoves(r.fen)) });
          bossMoves++;
        }
      } else if (phase === "play") {
        for (const id of ["p1", "p2"]) {
          const r = L.last(id, "round");
          if (r?.board && !L.core.record.round?.picks[id]) L.core.message(id, { t: "pick", key: r.key, move: greedy(r.board.fen, r.boss?.powers?.allowed ?? legalMoves(r.board.fen)) });
        }
      } else if (phase === "scoring") {
        // (Judging on: both devices judge each round, honestly.)
        for (const id of ["p1", "p2"]) {
          for (const m of L.take(id, "judge")) for (const job of m.jobs) L.core.message(id, { t: "judged", key: m.key, id: job.id, report: await runJudgeJob(fixed, job) });
        }
      }
      L.advance(1000);
    }
    expect(bossMoves).toBe(3);
    // A fresh seed each move.
    expect(new Set(draws).size).toBe(3);
    expect(L.asks.filter((a) => a.id.startsWith("boss:"))).toEqual([]);
    expect(L.core.record.unvouched).toBeUndefined();
  });

  it("two different moves and no engine server: the host's plays, and the match is unvouched (it pays as a solo game)", () => {
    const L = raid();
    twoPeople(L);
    untilBoss(L);
    const key = L.core.record.bossKey!;
    const r = L.last("p1", "bossRequest")!;
    const allowed = r.allowed ?? legalMoves(r.fen);
    const [a, b] = [honestMove(r.fen, allowed), allowed.find((m) => m !== honestMove(r.fen, allowed))!];
    // (The host scored the rounds before it (judging off here): cleared, to see the boss's own reason.)
    L.core.record.unvouched = undefined;
    L.core.message("p2", { t: "bossMove", key, move: b });
    // (One answer in: the host's still to come.)
    expect(L.core.record.bossKey).toBe(key);
    L.core.message("p1", { t: "bossMove", key, move: a });
    expect(L.core.record.bossKey).toBeUndefined();
    L.advance(20_000);
    expect(L.last("p2", "boss")!.boss.lastMove!.move).toBe(a);
    expect(L.core.record.unvouched).toMatch(/differently/);
  });

  it("a junk answer (a move the turn can't play) gets its device a strike and is dropped: the other's stands alone, unvouched", () => {
    const L = raid();
    twoPeople(L);
    untilBoss(L);
    const key = L.core.record.bossKey!;
    const r = L.last("p1", "bossRequest")!;
    const move = honestMove(r.fen, r.allowed ?? legalMoves(r.fen));
    L.core.record.unvouched = undefined;
    L.core.message("p2", { t: "bossMove", key, move: "a1a8" });
    expect(L.core.record.judges!.devices.p2!.strikes).toBe(1);
    expect(L.core.record.bossCheck!.answers).toEqual({});
    L.core.message("p1", { t: "bossMove", key, move });
    L.advance(BOSS_CHECK.waitMs + 100);
    expect(L.last("p2", "boss")!.boss.lastMove!.move).toBe(move);
    expect(L.core.record.unvouched).toMatch(/no second device/);
  });

  it("the checker silent: the host's move waits BOSS_CHECK.waitMs, then plays alone (unvouched); a stranger's answer counts for nothing", () => {
    const L = raid();
    twoPeople(L);
    L.core.connect(undefined, "Stranger", "computer", false, 1500);
    untilBoss(L);
    const key = L.core.record.bossKey!;
    const r = L.last("p1", "bossRequest")!;
    const move = honestMove(r.fen, r.allowed ?? legalMoves(r.fen));
    L.core.record.unvouched = undefined;
    // (The third person, with no speed known, isn't asked: its answer is ignored.)
    L.core.message("p3", { t: "bossMove", key, move });
    L.core.message("p1", { t: "bossMove", key, move });
    expect(L.core.record.bossKey).toBe(key);
    L.advance(BOSS_CHECK.waitMs - 500);
    expect(L.core.record.bossKey).toBe(key);
    L.advance(1000);
    expect(L.core.record.bossKey).toBeUndefined();
    expect(L.core.record.unvouched).toMatch(/no second device/);
  });

  it("one person alone: their device's move plays at once; the match is unvouched, unranked, and its XP game is capped as a solo game's", () => {
    const L = raid();
    L.core.connect(undefined, "Alone", "computer", false, 1500, undefined, "user-1");
    L.core.message("p1", { t: "speed", nps: 800_000 });
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    untilBoss(L, ["p1"]);
    const r = L.last("p1", "bossRequest")!;
    // (Nobody to check it: no seed, the device plays as it always has.)
    expect(r.draw).toBeUndefined();
    L.core.message("p1", { t: "bossMove", key: r.key, move: honestMove(r.fen, r.allowed ?? legalMoves(r.fen)) });
    expect(L.core.record.bossKey).toBeUndefined();
    expect(L.core.record.unvouched).toBeTruthy();
    expect(L.core.ranked()).toBe(false);
    const game = lobbyXpGame(L.core.record, { playerId: "p1", placement: 1, teamWon: true }, "user-1", { moves: 20, ms: 600_000 }, "boss", [], true, L.now());
    expect(game.cap).toBe("solo");
  });

  it("a round the host scores alone (under two judging devices) unvouches the match; a judged one doesn't", () => {
    const L = raid({ judges: { on: true } });
    L.core.connect(undefined, "Alone", "computer", false, 1500);
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    expect(L.core.record.unvouched).toBeUndefined();
    untilBoss(L, ["p1"]);
    // (It's the boss's turn or a round was scored: either way one device alone.)
    for (let i = 0; i < 100 && !L.core.record.unvouched; i++) {
      if (L.core.record.phase === "boss") {
        const r = L.last("p1", "bossRequest");
        if (r && r.key === L.core.record.bossKey) L.core.message("p1", { t: "bossMove", key: r.key, move: honestMove(r.fen, r.allowed ?? legalMoves(r.fen)) });
      }
      untilBoss(L, ["p1"]);
      L.advance(1000);
    }
    expect(L.core.record.unvouched).toBeTruthy();
    const game = lobbyXpGame(L.core.record, { playerId: "p1", placement: 1, teamWon: true }, "user-1", { moves: 20, ms: 600_000 }, "boss", [], true, L.now());
    expect(game.cap).toBe("solo");
    const vouched = lobbyXpGame({ ...L.core.record, unvouched: undefined, auto: { fillAt: null } }, { playerId: "p1", placement: 1, teamWon: true }, "user-1", { moves: 20, ms: 600_000 }, "boss", [], true, L.now());
    expect(vouched.cap).toBeNull();
  });
});
