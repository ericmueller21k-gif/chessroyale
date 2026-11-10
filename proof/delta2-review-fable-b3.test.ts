/**
 * Delta review 2 of PR #611 (fix round 2, 08e5f52..e576a8e; review/fable-b3, delta2.md): proof tests. Each passes by showing the
 * failure it names. The harness is copied from the PR's delta-review-fable-b3.test.ts. Copy into packages/server/test/ and run
 * `npx vitest run packages/server/test/delta2-review-fable-b3.test.ts` from the repo root.
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

describe("delta review 2 of PR #611", () => {
  /** Plays boss turns honestly until Wrangler's showdown is asked of both devices; returns that turn's requests. */
  function untilShowdown(L: ReturnType<typeof raid>) {
    for (let turn = 0; turn < 8 && L.core.record.phase !== "results"; turn++) {
      const { key, reqs } = nextBossTurn(L);
      if (L.core.record.phase !== "boss") break;
      const host = reqs.find((x) => x.id === "p1")?.r;
      const checker = reqs.find((x) => x.id === "p2")?.r;
      if (host && checker && host.showdown === "try") return { key, host, checker };
      answer(L, key, reqs, (_, r) => ({ move: honestMove(r.fen, allowedOf(r)) }));
      L.advance(1000);
    }
    return null;
  }

  for (const brain of ["stockfish", "maia"] as const) {
    it(`P1 (D2): a lying checker buys the turn's power with a better move: its empty showdown plays, the honest host's line-up is dropped, no strike (${brain} brain)`, () => {
      const L = raid({ server: true, settings: { bossId: "pig", bossPowerTest: "showdown", bossKillEvery: 99 } });
      people(L);
      if (brain === "stockfish") L.core.record.bossBrain = undefined;
      else expect(L.core.record.bossBrain?.brain).toMatch(/^maia/);
      const runner = (L.core as unknown as { runner: { applyBossMove: (...a: unknown[]) => unknown } }).runner;
      const spy = vi.spyOn(runner, "applyBossMove");
      const turn = untilShowdown(L)!;
      expect(turn).not.toBeNull();
      const { key, host } = turn;
      const allowed = allowedOf(host);
      // The honest host: its move (Maia's, on the Maia brain) and the line-up its engine found after it.
      const honest = allowed.map((m) => ({ m, l: [...lineups(applyMove(host.fen, m), 1, 3, 3000)].find(Boolean) })).find((x) => x.l)!;
      // The liar: any other move the engine server scores higher (the engine's best, say; on the Maia brain it says Maia too), and no line-up.
      const better = allowed.find((m) => m !== honest.m)!;
      const by = brain === "maia" ? { by: "maia" as const } : {};
      L.core.message("p1", { t: "bossMove", key, move: honest.m, showdown: honest.l!.spec, ...by });
      L.core.message("p2", { t: "bossMove", key, move: better, showdown: "", ...by });
      for (const req of L.asks.splice(0)) L.core.serverScored(req.id, req.moves.map((move) => ({ move, expected: move === better ? 0.53 : 0.5 })));
      expect(played(L)).toBe(better);
      const extras = spy.mock.calls.at(-1)![2] as Record<string, unknown>;
      // (The host's line-up is gone: the liar's "" is applied, so no showdown this turn.)
      expect(extras.showdown).toBe("");
      expect(strikes(L, "p2")).toBe(0);
    });
  }

  it("P2 (D1): a phone host whose Maia never loads and a phone that says `maiaReady`: it checks every Maia move, and 0.25 worse plays every time, vouched, unstruck", () => {
    const L = raid({ server: true });
    // (A lobby of phones: the host is the first; nobody's Maia loaded but the liar's word.)
    for (const n of ["Host", "Phone A", "Phone B", "Liar"]) join(L, n, "phone");
    ready(L, ["p1", "p2", "p3", "p4"], true);
    L.core.message("p4", { t: "maiaReady" });
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    expect(L.core.record.bossBrain?.brain).toMatch(/^maia/);
    let lies = 0;
    for (let turn = 0; turn < 5 && L.core.record.phase !== "results"; turn++) {
      const { key, reqs } = nextBossTurn(L, ["p1", "p2", "p3", "p4"]);
      if (L.core.record.phase !== "boss") break;
      expect(L.core.record.hostId).toBe("p1");
      // (The server knows the host's Maia isn't loaded: it never said `maiaReady`.)
      expect(L.core.record.humans.find((h) => h.id === "p1")!.maiaReady).toBeUndefined();
      expect(L.core.record.bossCheck!.maia).toBe(true);
      expect(L.core.record.bossCheck!.asked).toEqual(["p1", "p4"]);
      const r = reqs[0]!.r;
      const allowed = allowedOf(r);
      const honest = honestMove(r.fen, allowed);
      const lie = allowed.find((m) => m !== honest)!;
      L.core.record.unvouched = undefined;
      // The honest host fell back (Stockfish's move, no Maia); the liar says Maia played its move.
      answer(L, key, reqs, (id) => (id === "p4" ? { move: lie, by: "maia" } : id === "p1" ? { move: honest } : null));
      serveGap(L, lie, 0.5, BOSS_CHECK.maiaGap);
      expect(played(L)).toBe(lie);
      expect(L.core.record.unvouched).toBeUndefined();
      lies++;
      L.advance(1000);
    }
    expect(lies).toBe(5);
    expect(strikes(L, "p4")).toBe(0);
  });
});
