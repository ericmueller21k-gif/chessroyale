/**
 * Delta review of PR #611's fix round (review/fable-b3, delta.md): proof tests. Each passes by showing the failure it names.
 * Helpers copied from review-fable-b3.test.ts (the PR's own turned-around proofs).
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

function raid(opts: { server?: boolean; judges?: Partial<JudgeConfig>; settings?: Partial<Settings>; judgeSeed?: number } = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const asks: ServerScoreRequest[] = [];
  const core = new LobbyCore(
    newLobbyRecord("RAIDS", now),
    {
      now: () => now,
      send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]),
      judges: { ...JUDGES, on: false, ...opts.judges },
      judgeRng: mulberry32(opts.judgeSeed ?? 3),
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

/** Someone joins with an up-to-date app (it plays the boss's seed: hello's `seeded`, m2), or (`old`) an app from before it. */
const join = (L: ReturnType<typeof raid>, name: string, device: "phone" | "computer", old = false) => L.core.connect(undefined, name, device, false, 1500, undefined, undefined, null, null, false, {}, !old);
/** Devices' speed known (they can judge and check) and, unless `noMaia`, their Maia loaded (they can check his Maia moves). */
function ready(L: ReturnType<typeof raid>, ids: string[], noMaia = false) {
  for (const id of ids) {
    L.core.message(id, { t: "speed", nps: 800_000 });
    if (!noMaia) L.core.message(id, { t: "maiaReady" });
  }
}

/** People in a raid (`p1` first: the host, a computer), all ready; the match started. */
function people(L: ReturnType<typeof raid>, devices: ("phone" | "computer")[] = ["computer", "phone"]) {
  devices.forEach((d, i) => join(L, `P${i + 1}`, d));
  ready(L, devices.map((_, i) => `p${i + 1}`));
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

/** Whoever was asked, by device, and the move each answers: `pick(id, req)`; then the engine server answers as `serve` does. */
function answer(L: ReturnType<typeof raid>, key: string, reqs: { id: string; r: Extract<Msg, { t: "bossRequest" }> }[], pick: (id: string, r: Extract<Msg, { t: "bossRequest" }>) => { move: string; by?: "maia" } | null) {
  for (const { id, r } of reqs) {
    const a = pick(id, r);
    if (a) L.core.message(id, { t: "bossMove", key, move: a.move, ...(a.by ? { by: a.by } : {}) });
  }
}
const allowedOf = (r: Extract<Msg, { t: "bossRequest" }>) => r.allowed ?? legalMoves(r.fen);
/** The boss's last move as everyone was sent it. */
const played = (L: ReturnType<typeof raid>, id = "p1") => L.last(id, "boss")?.boss.lastMove?.move;

/** The engine server's verdict: `liar`'s move this much worse than the other (short of BOSS_CHECK.throwLoss). */
const serveGap = (L: ReturnType<typeof raid>, liar: string, at = 0.5, gap = 0.48) => {
  for (const req of L.asks.splice(0)) L.core.serverScored(req.id, req.moves.map((move) => ({ move, expected: move === liar ? at - gap : at })));
};
const strikes = (L: ReturnType<typeof raid>, id: string) => L.core.record.judges!.devices[id]?.strikes ?? 0;

describe("delta review of PR #611's fixes", () => {
  it("D1 (B1): a Stockfish-brain raid (no Maia at all): a checker that says `by: \"maia\"` gets its lie played every move, short of a throw, never struck, the raid vouched", () => {
    const L = raid({ server: true });
    people(L);
    // (A strength from BOSS_BRAIN.stockfishFrom up, or a raid whose players may not have Maia: bossBrainNow() is null, so no request carries a brain
    // and no honest app ever sends `by`.)
    L.core.record.bossBrain = undefined;
    L.core.record.unvouched = undefined;
    let lies = 0;
    for (let turn = 0; turn < 5 && L.core.record.phase !== "results"; turn++) {
      const { key, reqs } = nextBossTurn(L);
      if (L.core.record.phase !== "boss") break;
      expect(reqs.map((x) => x.id).sort()).toEqual(["p1", "p2"]);
      for (const { r } of reqs) expect(r.brain).toBeUndefined();
      const r = reqs[0]!.r;
      const allowed = allowedOf(r);
      const honest = honestMove(r.fen, allowed);
      const lie = allowed.find((m) => m !== honest)!;
      // (The test harness's host scores rounds alone: that unvouches; cleared so only the boss's move counts here.)
      L.core.record.unvouched = undefined;
      answer(L, key, reqs, (id) => (id === "p2" ? { move: lie, by: "maia" } : { move: honest }));
      // Even position, the liar's move 48 points worse (a queen for nothing from 0.5: never 0.8 from there).
      serveGap(L, lie);
      expect(played(L)).toBe(lie);
      expect(L.core.record.unvouched).toBeUndefined();
      lies++;
      L.advance(1000);
    }
    expect(lies).toBeGreaterThanOrEqual(3);
    expect(strikes(L, "p2")).toBe(0);
  });

  it("D1 (B1): the same from the host's side, on the Stockfish brain: the lying host's move plays, the honest checker's is dropped", () => {
    const L = raid({ server: true });
    people(L);
    L.core.record.bossBrain = undefined;
    const { key, reqs } = nextBossTurn(L);
    const r = reqs[0]!.r;
    const allowed = allowedOf(r);
    const honest = honestMove(r.fen, allowed);
    const lie = allowed.find((m) => m !== honest)!;
    answer(L, key, reqs, (id) => (id === "p1" ? { move: lie, by: "maia" } : { move: honest }));
    serveGap(L, lie);
    expect(played(L)).toBe(lie);
    expect(strikes(L, "p1")).toBe(0);
  });

  it("D1 (B1): a Maia raid whose honest host fell back (its Maia failed to load: every move, as on the Oct 14 iPhone): a lying checker's move plays every move, unstruck", () => {
    const L = raid({ server: true });
    people(L);
    expect(L.core.record.bossBrain?.brain).toMatch(/^maia/);
    let lies = 0;
    for (let turn = 0; turn < 5 && L.core.record.phase !== "results"; turn++) {
      const { key, reqs } = nextBossTurn(L);
      if (L.core.record.phase !== "boss") break;
      const r = reqs[0]!.r;
      const allowed = allowedOf(r);
      const honest = honestMove(r.fen, allowed);
      const lie = allowed.find((m) => m !== honest)!;
      // The host's Maia never loaded: Stockfish's move, `by` "stockfish" (sent as nothing). The checker (p2, Maia "ready") lies.
      answer(L, key, reqs, (id) => (id === "p2" ? { move: lie, by: "maia" } : { move: honest }));
      serveGap(L, lie);
      expect(played(L)).toBe(lie);
      lies++;
      L.advance(1000);
    }
    expect(lies).toBeGreaterThanOrEqual(3);
    expect(strikes(L, "p2")).toBe(0);
  });

  it("D1 (B1): with no engine server, a lying checker's `by: \"maia\"` now beats the honest host (before the fix the host's move played)", () => {
    const L = raid({ server: false });
    people(L);
    L.core.record.bossBrain = undefined;
    const { key, reqs } = nextBossTurn(L);
    const r = reqs[0]!.r;
    const allowed = allowedOf(r);
    const honest = honestMove(r.fen, allowed);
    const lie = allowed.find((m) => m !== honest)!;
    answer(L, key, reqs, (id) => (id === "p2" ? { move: lie, by: "maia" } : { move: honest }));
    expect(played(L)).toBe(lie);
  });

  it("D1 (E1): a phone that says `maiaReady` without loading anything is the only device that may check his Maia moves, so it checks every one", () => {
    const L = raid({ server: true });
    join(L, "Host", "computer");
    join(L, "Phone A", "phone");
    join(L, "Phone B", "phone");
    join(L, "Liar", "phone");
    ready(L, ["p1", "p2", "p3", "p4"], true);
    // (Nothing checks it: the server takes the word.)
    L.core.message("p4", { t: "maiaReady" });
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    let checked = 0;
    for (let turn = 0; turn < 3 && L.core.record.phase !== "results"; turn++) {
      const { key, reqs } = nextBossTurn(L, ["p1", "p2", "p3", "p4"]);
      if (L.core.record.phase !== "boss") break;
      expect(L.core.record.bossCheck?.maia).toBe(true);
      expect(L.core.record.bossCheck!.asked).toEqual(["p1", "p4"]);
      checked++;
      answer(L, key, reqs, (_, r) => ({ move: honestMove(r.fen, allowedOf(r)) }));
      L.advance(1000);
    }
    expect(checked).toBeGreaterThanOrEqual(2);
  });

  it("D2 (M2): his powers' extras are lost whenever the checker's bare answer is what plays (here: Maia's against the host's fallback)", () => {
    const L = raid({ server: true });
    people(L);
    const runner = (L.core as unknown as { runner: { applyBossMove: (...a: unknown[]) => unknown } }).runner;
    const spy = vi.spyOn(runner, "applyBossMove");
    const { key, reqs } = nextBossTurn(L);
    const host = reqs.find((x) => x.id === "p1")!.r;
    const r = host;
    const allowed = allowedOf(r);
    const sf = honestMove(r.fen, allowed);
    const maia = allowed.find((m) => m !== sf)!;
    // The host worked out the turn's extra (a drag, Moo's lines, the balloon, the hoops or the Crease: here a drag) after its move; the
    // checker's request had none, so its answer has none.
    L.core.message("p1", { t: "bossMove", key, move: sf, drag: "b1c3" });
    L.core.message("p2", { t: "bossMove", key, move: maia, by: "maia" });
    for (const req of L.asks.splice(0)) L.core.serverScored(req.id, req.moves.map((move) => ({ move, expected: move === maia ? 0.45 : 0.9 })));
    expect(played(L)).toBe(maia);
    const extras = spy.mock.calls.at(-1)![2] as Record<string, unknown>;
    expect(extras.drag).toBeNull();
    expect(Object.values(extras).every((v) => v === null)).toBe(true);
  });

  it("D2 (M2): the host silent, the checker's bare answer stands (alone, or with a second device's): no extras either", () => {
    const L = raid({ server: true });
    people(L);
    const runner = (L.core as unknown as { runner: { applyBossMove: (...a: unknown[]) => unknown } }).runner;
    const spy = vi.spyOn(runner, "applyBossMove");
    const { key, reqs } = nextBossTurn(L);
    const r = reqs[0]!.r;
    L.core.message("p2", { t: "bossMove", key, move: honestMove(r.fen, allowedOf(r)) });
    while (L.core.record.bossKey === key) L.advance(500);
    const extras = spy.mock.calls.at(-1)![2] as Record<string, unknown>;
    expect(Object.values(extras).every((v) => v === null)).toBe(true);
    expect(L.core.record.bossMisses).toEqual({ p1: 1 });
  });

  it("D3 (M1): a new host asked late in the old host's window is counted as missing it (its window isn't reset)", () => {
    const L = raid({ server: true });
    people(L, ["computer", "phone", "phone"]);
    L.core.record.bossChecker = "p2";
    const { key } = nextBossTurn(L, ["p1", "p2", "p3"]);
    const at = L.core.record.timer!.at;
    // The host drops a second before its window ends; nobody has answered.
    L.advance(at - L.now() - 1000);
    L.core.disconnect("p1");
    expect(L.core.record.hostId).toBe("p2");
    expect(L.core.record.timer!.at).toBe(at);
    L.advance(1000);
    // p2 had the whole request for one second: a miss, as if it had the window.
    expect(L.core.record.bossMisses?.p2).toBe(1);
    expect(L.core.record.bossKey).toBe(key);
  });
});
