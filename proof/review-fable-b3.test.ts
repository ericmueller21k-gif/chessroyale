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


/** Plays crowd turns and host scoring until the boss is asked; then takes the boss requests sent for that key. */
function nextBossTurn(L: ReturnType<typeof raid>, ids = ["p1", "p2"]) {
  untilBoss(L, ids);
  const key = L.core.record.bossKey!;
  return { key, reqs: ids.flatMap((id) => L.take(id, "bossRequest").filter((r) => r.key === key).map((r) => ({ id, r }))) };
}

describe("review of PR #611 (BOSS_CHECK)", () => {
  it("the host drops mid-move: the checker becomes the host, its one answer counts as both, and a thrown move plays vouched", () => {
    const L = raid({ server: true });
    twoPeople(L);
    const { key, reqs } = nextBossTurn(L);
    expect(reqs.map((x) => x.id).sort()).toEqual(["p1", "p2"]);
    expect(L.core.record.bossCheck!.checker).toBe("p2");
    const r = reqs[0]!.r;
    const allowed = r.allowed ?? legalMoves(r.fen);
    const honest = honestMove(r.fen, allowed);
    // (Its worst move; on an opening board where all look alike, any other move: what matters is that it isn't the host's.)
    const thrown = worstMove(r.fen, allowed) !== honest ? worstMove(r.fen, allowed) : allowed.find((m) => m !== honest)!;
    L.core.record.unvouched = undefined;
    // The honest host answers, then its connection drops (a reload, a tunnel).
    L.core.message("p1", { t: "bossMove", key, move: honest });
    L.core.disconnect("p1");
    expect(L.core.record.hostId).toBe("p2");
    expect(L.core.record.bossCheck!.checker).toBe("p2");
    // The checker (now also the host) throws.
    L.core.message("p2", { t: "bossMove", key, move: thrown });
    L.advance(BOSS_CHECK.waitMs + 100);
    expect(L.asks.filter((a) => a.id.startsWith("boss:"))).toEqual([]);
    expect(L.last("p2", "boss")!.boss.lastMove!.move).toBe(thrown);
    // ...and nothing marks the match: it still pays and ranks as vouched.
    expect(L.core.record.unvouched).toBeUndefined();
  });

  it("a silent checker is never replaced or struck: every boss move waits BOSS_CHECK.waitMs and the raid is unvouched", () => {
    const L = raid({ server: true });
    twoPeople(L);
    const waits: number[] = [];
    for (let turn = 0; turn < 3; turn++) {
      const { key, reqs } = nextBossTurn(L);
      if (turn === 0) L.core.record.unvouched = undefined;
      expect(L.core.record.bossCheck!.checker).toBe("p2");
      const r = reqs.find((x) => x.id === "p1")!.r;
      L.core.message("p1", { t: "bossMove", key, move: honestMove(r.fen, r.allowed ?? legalMoves(r.fen)) });
      const t0 = L.now();
      while (L.core.record.bossKey === key) L.advance(100);
      waits.push(L.now() - t0);
      if (turn === 0) expect(L.core.record.unvouched).toMatch(/no second device/);
    }
    for (const w of waits) expect(w).toBeGreaterThanOrEqual(BOSS_CHECK.waitMs);
    expect(L.core.record.judges!.devices.p2!.strikes).toBe(0);
  });

  it("an honest Maia host whose checker's Maia isn't ready (the checker plays Stockfish's move): 40 points apart twice, and the host is benched", () => {
    const L = raid({ server: true });
    twoPeople(L);
    for (let turn = 0; turn < 2; turn++) {
      const { key, reqs } = nextBossTurn(L);
      const r = reqs[0]!.r;
      const allowed = r.allowed ?? legalMoves(r.fen);
      const sf = honestMove(r.fen, allowed);
      const maia = allowed.find((m) => m !== sf)!;
      L.core.message("p1", { t: "bossMove", key, move: maia });
      L.core.message("p2", { t: "bossMove", key, move: sf });
      // The engine server: Stockfish's move 0.90, Maia's unguarded one 0.45 (reports/maia-boss.md: a fifth of its moves give away 25+).
      for (const req of L.asks.splice(0)) L.core.serverScored(req.id, req.moves.map((move) => ({ move, expected: move === maia ? 0.45 : 0.9 })));
      L.advance(1000);
    }
    expect(L.core.record.judges!.devices.p1!.strikes).toBe(JUDGES.strikes);
    // Benched: no more hosting or judging this match, though nothing it sent was wrong.
    const { reqs } = nextBossTurn(L);
    expect(reqs.map((x) => x.id)).toEqual(["p2"]);
  });
});
