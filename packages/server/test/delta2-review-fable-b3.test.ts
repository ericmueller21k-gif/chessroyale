/**
 * Delta review 2 of PR #611 (review/fable-b3, delta2.md): its proof tests, turned around. N1: the boss's Maia move needs the host's
 * Maia loaded (else no brain to anyone, and nobody's "Maia played it" is heard). N2: when a checker's move plays on a turn with his
 * powers' extras, the host is asked for that move's extras; the checker's only if the host doesn't answer in its time.
 */
import { describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { BOSS_CHECK, DEFAULT_SETTINGS, JUDGES, RAID_SETTINGS, mulberry32, type JudgeConfig, type Settings } from "@chessroyale/core";
import { applyMove, legalMoves, lineups, type BoardScore, type MoveScore, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord, type ServerScoreRequest } from "../src/lobby.ts";
import { library } from "./lobby-fixture.ts";

// (The engine server is a Container, which needs the Workers runtime: the match rooms import it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));

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


type Req = Extract<Msg, { t: "bossRequest" }>;

describe("delta review 2 of PR #611, turned around", () => {
  /** Plays boss turns honestly until Wrangler's showdown is asked of the host; returns that turn's requests. */
  function untilShowdown(L: ReturnType<typeof raid>, ids = ["p1", "p2"]) {
    for (let turn = 0; turn < 8 && L.core.record.phase !== "results"; turn++) {
      const { key, reqs } = nextBossTurn(L, ids);
      if (L.core.record.phase !== "boss") break;
      const host = reqs.find((x) => x.id === "p1")?.r;
      if (host?.showdown === "try" && reqs.length >= 2) return { key, host, reqs };
      answer(L, key, reqs, (_, r) => ({ move: honestMove(r.fen, allowedOf(r)) }));
      L.advance(1000);
    }
    return null;
  }
  /** The showdown turn's moves: one with a line-up after it (the host's honest pick) and another (the checker's). */
  const showdownMoves = (host: Req) => {
    const found: { m: string; l: { spec: string } }[] = [];
    for (const m of allowedOf(host)) {
      const l = [...lineups(applyMove(host.fen, m), 1, 3, 3000)].find(Boolean);
      if (l) found.push({ m, l });
      if (found.length === 2) break;
    }
    return { honest: found[0]!, better: found[1]! };
  };
  const spyApply = (L: ReturnType<typeof raid>) => vi.spyOn((L.core as unknown as { runner: { applyBossMove: (...a: unknown[]) => unknown } }).runner, "applyBossMove");

  for (const brain of ["stockfish", "maia"] as const) {
    it(`P1 (N2): a checker's better move plays, but the turn's power is the host's: it's asked for that move's extras and its line-up plays, never the checker's empty one (${brain} brain)`, () => {
      const L = raid({ server: true, settings: { bossId: "pig", bossPowerTest: "showdown", bossKillEvery: 99 } });
      people(L);
      if (brain === "stockfish") L.core.record.bossBrain = undefined;
      else expect(L.core.record.bossBrain?.brain).toMatch(/^maia/);
      const spy = spyApply(L);
      const turn = untilShowdown(L)!;
      expect(turn).not.toBeNull();
      const { key, host } = turn;
      const { honest, better } = showdownMoves(host);
      const by = brain === "maia" ? { by: "maia" as const } : {};
      expect(L.core.record.bossCheck!.maia).toBe(brain === "maia");
      const before = spy.mock.calls.length;
      L.core.message("p1", { t: "bossMove", key, move: honest.m, showdown: honest.l.spec, ...by });
      L.core.message("p2", { t: "bossMove", key, move: better.m, showdown: "", ...by });
      const draw = L.core.record.bossCheck!.draw;
      L.take("p1", "bossRequest");
      for (const req of L.asks.splice(0)) L.core.serverScored(req.id, req.moves.map((move) => ({ move, expected: move === better.m ? 0.53 : 0.5 })));
      // Not played yet: the host is asked for the better move's extras (the whole request, that move alone, the same seed, no brain).
      expect(spy.mock.calls.length).toBe(before);
      const [again] = L.take("p1", "bossRequest");
      expect(again).toMatchObject({ key, allowed: [better.m], showdown: "try", draw });
      expect(again!.brain).toBeUndefined();
      expect(again!.pull).toBeUndefined();
      expect(again!.check).toBeUndefined();
      expect(L.take("p2", "bossRequest")).toEqual([]);
      // (Its time: the checker's window, the showdown's allowance and all.)
      expect(L.core.record.timer!.at).toBe(L.now() + BOSS_CHECK.waitMs + 15_000);
      // The liar can't step in: only the host's answer for that move counts.
      L.core.message("p2", { t: "bossMove", key, move: better.m, showdown: "" });
      L.core.message("p1", { t: "bossMove", key, move: honest.m, showdown: honest.l.spec });
      expect(spy.mock.calls.length).toBe(before);
      L.core.message("p1", { t: "bossMove", key, move: better.m, showdown: better.l.spec });
      expect(played(L)).toBe(better.m);
      expect((spy.mock.calls.at(-1)![2] as Record<string, unknown>).showdown).toBe(better.l.spec);
      expect(strikes(L, "p2")).toBe(0);
    });
  }

  it("N2: the same move from two checkers (the host missed its window): the host is asked for its extras, so padded keys win nothing", () => {
    const L = raid({ server: true, settings: { bossId: "pig", bossPowerTest: "showdown", bossKillEvery: 99 } });
    people(L, ["computer", "phone", "phone"]);
    L.core.record.bossBrain = undefined;
    const spy = spyApply(L);
    const turn = untilShowdown(L, ["p1", "p2", "p3"])!;
    expect(turn).not.toBeNull();
    const { key, host } = turn;
    const { honest } = showdownMoves(host);
    const [first] = L.core.record.bossCheck!.asked.filter((id) => id !== "p1");
    const before = spy.mock.calls.length;
    // The checker answers with every extra it can name; the host doesn't answer in its window.
    L.core.message(first!, { t: "bossMove", key, move: honest.m, showdown: "", drag: "", hoops: "", crease: "" });
    L.advance(L.core.record.timer!.at - L.now());
    const second = L.core.record.bossCheck!.asked.find((id) => id !== "p1" && id !== first)!;
    expect(second).toBeDefined();
    L.core.message(second, { t: "bossMove", key, move: honest.m, showdown: "" });
    expect(spy.mock.calls.length).toBe(before);
    const again = L.take("p1", "bossRequest").at(-1)!;
    expect(again.allowed).toEqual([honest.m]);
    L.core.message("p1", { t: "bossMove", key, move: honest.m, showdown: honest.l.spec });
    expect(played(L)).toBe(honest.m);
    const extras = spy.mock.calls.at(-1)![2] as Record<string, unknown>;
    // (The host's: its line-up, and none of the checker's padding.)
    expect(extras.showdown).toBe(honest.l.spec);
    expect([extras.drag ?? null, extras.hoops ?? null, extras.crease ?? null]).toEqual([null, null, null]);
  });

  it("P2 (N1): a phone host whose Maia never loads: no brain to anyone, any phone checks, and a checker's \"Maia played it\" isn't heard: the better move plays every time", () => {
    const L = raid({ server: true });
    // (A lobby of phones: the host is the first; nobody's Maia loaded but the liar's word.)
    for (const n of ["Host", "Phone A", "Phone B", "Liar"]) join(L, n, "phone");
    ready(L, ["p1", "p2", "p3", "p4"], true);
    L.core.message("p4", { t: "maiaReady" });
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    expect(L.core.record.bossBrain?.brain).toMatch(/^maia/);
    let turns = 0;
    const checkers = new Set<string>();
    for (let turn = 0; turn < 5 && L.core.record.phase !== "results"; turn++) {
      const { key, reqs } = nextBossTurn(L, ["p1", "p2", "p3", "p4"]);
      if (L.core.record.phase !== "boss") break;
      expect(L.core.record.hostId).toBe("p1");
      expect(L.core.record.bossCheck!.maia).toBe(false);
      // (Both devices play the seeded Stockfish move: no brain, no share, to the host and the checker alike.)
      expect(reqs.length).toBe(2);
      for (const { r } of reqs) expect([r.brain, r.share, r.draw === L.core.record.bossCheck!.draw]).toEqual([undefined, undefined, true]);
      const liar = L.core.record.bossCheck!.asked[1]!;
      checkers.add(liar);
      const r = reqs[0]!.r;
      const allowed = allowedOf(r);
      const honest = honestMove(r.fen, allowed);
      const lie = allowed.find((m) => m !== honest)!;
      L.core.record.unvouched = undefined;
      answer(L, key, reqs, (id) => (id === liar ? { move: lie, by: "maia" } : { move: honest }));
      serveGap(L, lie, 0.5, BOSS_CHECK.maiaGap);
      expect(played(L)).toBe(honest);
      expect(L.core.record.unvouched).toBeUndefined();
      turns++;
      L.advance(1000);
    }
    expect(turns).toBe(5);
    expect([...checkers].every((id) => id !== "p1")).toBe(true);
  });

  it("N1: the host's Maia loads: its moves are Maia's (the brain to the host and a checker with Maia); it fails (`maiaReady` off): no brain again", () => {
    const L = raid({ server: true });
    people(L, ["computer", "computer"]);
    L.core.message("p1", { t: "maiaReady", off: true });
    expect(L.core.record.humans.find((h) => h.id === "p1")!.maiaReady).toBeUndefined();
    const plan = L.core.record.bossBrain!;
    const turn = (want: boolean) => {
      const { key, reqs } = nextBossTurn(L);
      expect(L.core.record.bossCheck!.maia).toBe(want);
      expect(reqs.map(({ r }) => r.brain)).toEqual(reqs.map(() => (want ? { brain: plan.brain, rating: plan.rating } : undefined)));
      answer(L, key, reqs, (_, r) => ({ move: honestMove(r.fen, allowedOf(r)), ...(want ? { by: "maia" as const } : {}) }));
      L.advance(1000);
    };
    turn(false);
    L.core.message("p1", { t: "maiaReady" });
    turn(true);
    L.core.message("p1", { t: "maiaReady", off: true });
    turn(false);
  });
});
