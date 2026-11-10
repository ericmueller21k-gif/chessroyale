/**
 * The review of PR #611 (review/fable-b3: B1, E1, M1, M2, m2, m3, m5), its proof tests turned around: the boss's move played by the host
 * and a checker with one seed (BOSS_CHECK), with honest differences (Maia against a fallback) never struck nor "the better of two",
 * checkers whose Maia is loaded, re-asks on a host change, missed windows, and the unvouched match's results line.
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

describe("review of PR #611 (BOSS_CHECK), turned around", () => {
  it("M1: the host drops after answering; the new host (the checker) is compared with its answer, kept by device: a different move goes to the engine server, the better plays, vouched", () => {
    const L = raid({ server: true });
    people(L);
    const { key, reqs } = nextBossTurn(L);
    expect(reqs.map((x) => x.id).sort()).toEqual(["p1", "p2"]);
    expect(L.core.record.bossCheck!.asked).toEqual(["p1", "p2"]);
    const r = reqs[0]!.r;
    const allowed = allowedOf(r);
    const honest = honestMove(r.fen, allowed);
    const thrown = worstMove(r.fen, allowed) !== honest ? worstMove(r.fen, allowed) : allowed.find((m) => m !== honest)!;
    L.core.record.unvouched = undefined;
    // The honest host answers, then its connection drops (a reload, a tunnel).
    L.core.message("p1", { t: "bossMove", key, move: honest });
    L.core.disconnect("p1");
    expect(L.core.record.hostId).toBe("p2");
    // The checker, now also the host, throws: one device, one answer (never two), compared with the dropped host's.
    L.core.message("p2", { t: "bossMove", key, move: thrown });
    expect(Object.keys(L.core.record.bossCheck!.answers)).toEqual(["p1", "p2"]);
    expect(L.asks.filter((a) => a.id.startsWith("boss:"))).toHaveLength(1);
    L.serve();
    expect(played(L, "p2")).toBe(honest);
    expect(L.core.record.unvouched).toBeUndefined();
  });

  it("M1: the host drops before answering and the checker becomes the host: a fresh checker beside it, with the same seed; the two agree, vouched", () => {
    const L = raid({ server: true });
    people(L, ["computer", "phone", "phone"]);
    // (This battle's checker is p2: it's kept while it can, so the new host, a phone like p3, is p2: the first one here.)
    L.core.record.bossChecker = "p2";
    const { key, reqs } = nextBossTurn(L, ["p1", "p2", "p3"]);
    expect(reqs.map((x) => x.id).sort()).toEqual(["p1", "p2"]);
    const draw = reqs[0]!.r.draw!;
    L.core.record.unvouched = undefined;
    L.core.disconnect("p1");
    expect(L.core.record.hostId).toBe("p2");
    // p2 is asked again (the whole request, as the host), and p3 beside it, with the same seed.
    const again = ["p2", "p3"].flatMap((id) => L.take(id, "bossRequest").filter((r) => r.key === key).map((r) => ({ id, r })));
    expect(again.map((x) => x.id).sort()).toEqual(["p2", "p3"]);
    for (const { r } of again) expect(r.draw).toBe(draw);
    expect(L.core.record.bossCheck!.asked).toEqual(["p1", "p2", "p3"]);
    const r = again[0]!.r;
    answer(L, key, again, () => ({ move: honestMove(r.fen, allowedOf(r)) }));
    expect(played(L, "p2")).toBe(honestMove(r.fen, allowedOf(r)));
    expect(L.asks).toEqual([]);
    expect(L.core.record.unvouched).toBeUndefined();
  });

  it("M2: a silent checker misses its window: one more device is asked once, with the same seed, and its agreeing answer plays vouched; next move the silent one is replaced", () => {
    const L = raid({ server: true });
    people(L, ["computer", "phone", "phone"]);
    L.core.record.bossChecker = "p2";
    const { key, reqs } = nextBossTurn(L, ["p1", "p2", "p3"]);
    expect(reqs.map((x) => x.id).sort()).toEqual(["p1", "p2"]);
    L.core.record.unvouched = undefined;
    const r = reqs[0]!.r;
    const move = honestMove(r.fen, allowedOf(r));
    L.core.message("p1", { t: "bossMove", key, move });
    // (The checker has BOSS_CHECK.waitMs after the host's answer.)
    L.advance(BOSS_CHECK.waitMs - 500);
    expect(L.core.record.bossKey).toBe(key);
    expect(L.take("p3", "bossRequest")).toEqual([]);
    L.advance(600);
    expect(L.core.record.bossMisses).toEqual({ p2: 1 });
    const second = L.take("p3", "bossRequest").filter((x) => x.key === key);
    expect(second).toHaveLength(1);
    expect(second[0]!.draw).toBe(r.draw);
    L.core.message("p3", { t: "bossMove", key, move });
    expect(played(L)).toBe(move);
    expect(L.core.record.unvouched).toBeUndefined();
    // Next move: p3 checks (p2 missed: replaced), and no strike yet (one miss).
    const next = nextBossTurn(L, ["p1", "p2", "p3"]);
    expect(next.reqs.map((x) => x.id).sort()).toEqual(["p1", "p3"]);
    expect(L.core.record.judges!.devices.p2!.strikes).toBe(0);
  });

  it("M2: two people and a silent checker: each move stands alone after the window (unvouched), and BOSS_CHECK.missStrikes misses are a strike", () => {
    const L = raid({ server: true });
    people(L);
    const waits: number[] = [];
    for (let turn = 0; turn < BOSS_CHECK.missStrikes; turn++) {
      const { key, reqs } = nextBossTurn(L);
      if (turn === 0) L.core.record.unvouched = undefined;
      expect(L.core.record.bossCheck!.asked).toEqual(["p1", "p2"]);
      const r = reqs.find((x) => x.id === "p1")!.r;
      L.core.message("p1", { t: "bossMove", key, move: honestMove(r.fen, allowedOf(r)) });
      const t0 = L.now();
      while (L.core.record.bossKey === key) L.advance(100);
      waits.push(L.now() - t0);
      if (turn === 0) expect(L.core.record.unvouched).toMatch(/no second device/);
    }
    for (const w of waits) expect(w).toBeGreaterThanOrEqual(BOSS_CHECK.waitMs);
    expect(L.core.record.bossMisses).toEqual({ p2: BOSS_CHECK.missStrikes });
    expect(L.core.record.judges!.devices.p2!.strikes).toBe(1);
  });

  it("M2: the checker's request has only what the move needs (none of his powers' extras), with the host's seed", () => {
    const L = raid({ server: true });
    people(L);
    for (let turn = 0; turn < 3 && L.core.record.phase !== "results"; turn++) {
      const { key, reqs } = nextBossTurn(L);
      const host = reqs.find((x) => x.id === "p1")!.r;
      const checker = reqs.find((x) => x.id === "p2")!.r;
      expect(checker.draw).toBe(host.draw);
      for (const k of ["drag", "showdown", "beam", "balloon", "hoops", "crease"]) expect(checker).not.toHaveProperty(k);
      for (const k of Object.keys(checker)) if (k !== "now") expect(host).toHaveProperty(k);
      answer(L, key, reqs, (_, r) => ({ move: honestMove(r.fen, allowedOf(r)) }));
    }
  });

  it("B1: an honest Maia host and a checker that fell back to Stockfish (its Maia late): Maia's move plays, nobody is struck, the host keeps hosting", () => {
    const L = raid({ server: true });
    people(L);
    for (let turn = 0; turn < 3; turn++) {
      const { key, reqs } = nextBossTurn(L);
      const r = reqs[0]!.r;
      const allowed = allowedOf(r);
      const sf = honestMove(r.fen, allowed);
      const maia = allowed.find((m) => m !== sf)!;
      answer(L, key, reqs, (id) => (id === "p1" ? { move: maia, by: "maia" } : { move: sf }));
      // The engine server: Stockfish's move 0.90, Maia's unguarded one 0.45 (a fifth of its moves give away 25 points or more).
      for (const req of L.asks.splice(0)) L.core.serverScored(req.id, req.moves.map((move) => ({ move, expected: move === maia ? 0.45 : 0.9 })));
      expect(played(L)).toBe(maia);
      L.advance(1000);
    }
    expect(L.core.record.judges!.devices.p1!.strikes).toBe(0);
    expect(L.core.record.judges!.devices.p2!.strikes).toBe(0);
    expect(nextBossTurn(L).reqs.map((x) => x.id).sort()).toEqual(["p1", "p2"]);
  });

  it("B1: the same the other way round (the host's Maia late): the checker's Maia move plays, no strike", () => {
    const L = raid({ server: true });
    people(L);
    const { key, reqs } = nextBossTurn(L);
    const r = reqs[0]!.r;
    const allowed = allowedOf(r);
    const sf = honestMove(r.fen, allowed);
    const maia = allowed.find((m) => m !== sf)!;
    answer(L, key, reqs, (id) => (id === "p2" ? { move: maia, by: "maia" } : { move: sf }));
    for (const req of L.asks.splice(0)) L.core.serverScored(req.id, req.moves.map((move) => ({ move, expected: move === maia ? 0.3 : 0.9 })));
    expect(played(L)).toBe(maia);
    expect(L.core.record.judges!.devices.p1!.strikes + L.core.record.judges!.devices.p2!.strikes).toBe(0);
  });

  it("B1: a throw (BOSS_CHECK.throwLoss worse than the other) never plays, whoever says Maia played it, and its device is struck", () => {
    const L = raid({ server: true });
    people(L);
    const { key, reqs } = nextBossTurn(L);
    const r = reqs[0]!.r;
    const allowed = allowedOf(r);
    const sf = honestMove(r.fen, allowed);
    const thrown = allowed.find((m) => m !== sf)!;
    answer(L, key, reqs, (id) => (id === "p1" ? { move: thrown, by: "maia" } : { move: sf }));
    for (const req of L.asks.splice(0)) L.core.serverScored(req.id, req.moves.map((move) => ({ move, expected: move === thrown ? 0.9 - BOSS_CHECK.throwLoss - 0.01 : 0.9 })));
    expect(played(L)).toBe(sf);
    expect(L.core.record.judges!.devices.p1!.strikes).toBe(1);
    expect(L.core.record.judges!.devices.p2!.strikes).toBe(0);
  });

  it("E1 / B1: on the Maia brain, a checker only with Maia loaded; none: the host's move alone (unvouched); computers and phones with Maia saved are told to load it, a phone without never", () => {
    const L = raid({ server: true });
    join(L, "Host", "computer");
    join(L, "Phone", "phone");
    join(L, "Laptop", "computer");
    join(L, "Saved", "phone");
    ready(L, ["p1", "p2", "p3", "p4"], true);
    L.core.message("p4", { t: "speed", nps: 300_000, maiaSaved: true });
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    const { key, reqs } = nextBossTurn(L, ["p1", "p2", "p3", "p4"]);
    expect(L.core.record.bossBrain?.brain).toMatch(/^maia/);
    expect(["elo", "stumble"]).toContain(L.core.record.bossKind);
    // Told to load Maia to check (BOSS_CHECK.loaders: two drawn of p3 and p4, as the battle began); the phone without it, never.
    expect(L.take("p2", "bossBrain")).toEqual([]);
    for (const id of ["p3", "p4"]) expect(L.take(id, "bossBrain")).toEqual([expect.objectContaining({ check: true })]);
    // Nobody's Maia ready yet: the host alone.
    expect(reqs.map((x) => x.id)).toEqual(["p1"]);
    L.core.record.unvouched = undefined;
    const r = reqs[0]!.r;
    expect(r.draw).toBeUndefined();
    L.core.message("p1", { t: "bossMove", key, move: honestMove(r.fen, allowedOf(r)), by: "maia" });
    expect(L.core.record.unvouched).toMatch(/no second device/);
    // p4's Maia loads: it checks from then on.
    L.core.message("p4", { t: "maiaReady" });
    const next = nextBossTurn(L, ["p1", "p2", "p3", "p4"]);
    expect(next.reqs.map((x) => x.id).sort()).toEqual(["p1", "p4"]);
  });

  it("m2: an app from before the seed never checks; a host from before it plays alone (unvouched)", () => {
    const L = raid({ server: true });
    join(L, "Old", "computer", true);
    join(L, "New", "phone");
    ready(L, ["p1", "p2"]);
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    const { reqs } = nextBossTurn(L);
    expect(reqs.map((x) => x.id)).toEqual(["p1"]);
    expect(reqs[0]!.r.draw).toBeUndefined();
    const L2 = raid({ server: true });
    join(L2, "New", "computer");
    join(L2, "Old", "phone", true);
    ready(L2, ["p1", "p2"]);
    L2.core.message("p1", { t: "start" });
    L2.advance(1000);
    expect(nextBossTurn(L2).reqs.map((x) => x.id)).toEqual(["p1"]);
  });

  it("m3: the checker is drawn at random among those that may check (not the fastest computer every time)", () => {
    const picked = new Set<string>();
    for (let seed = 1; seed <= 8 && picked.size < 2; seed++) {
      const L = raid({ server: true, judgeSeed: seed });
      people(L, ["computer", "computer", "computer"]);
      // (p2 the fastest by far: before, it was always the checker.)
      L.core.message("p2", { t: "speed", nps: 3_000_000 });
      nextBossTurn(L, ["p1", "p2", "p3"]);
      picked.add(L.core.record.bossCheck!.asked[1]!);
    }
    expect([...picked].sort()).toEqual(["p2", "p3"]);
  });

  it("m5: an unvouched match's results say so (and the app shows the line in place of the unranked one)", () => {
    const L = raid();
    people(L);
    L.core.record.unvouched = "test";
    (L.core as unknown as { finishMatch(): void }).finishMatch();
    expect(L.last("p1", "results")).toMatchObject({ unvouched: true, ranked: false });
  });
});
