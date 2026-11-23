/**
 * Delta review of PR #611's fix round (review/fable-b3, delta.md): its proof tests, turned around (fix round 2). Each passes by
 * showing the fix for the failure it named. Helpers copied from review-fable-b3.test.ts (the PR's own turned-around proofs).
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

describe("delta review of PR #611's fixes, turned around", () => {
  it("D1 (B1): a Stockfish-brain raid: a checker's `by: \"maia\"` isn't heard (no Maia move): the better move plays, every move", () => {
    const L = raid({ server: true });
    people(L);
    // (A strength from BOSS_BRAIN.stockfishFrom up, or a raid whose players may not have Maia: no request carries a brain.)
    L.core.record.bossBrain = undefined;
    let turns = 0;
    for (let turn = 0; turn < 5 && L.core.record.phase !== "results"; turn++) {
      const { key, reqs } = nextBossTurn(L);
      if (L.core.record.phase !== "boss") break;
      expect(reqs.map((x) => x.id).sort()).toEqual(["p1", "p2"]);
      for (const { r } of reqs) expect(r.brain).toBeUndefined();
      expect(L.core.record.bossCheck!.maia).toBe(false);
      const r = reqs[0]!.r;
      const allowed = allowedOf(r);
      const honest = honestMove(r.fen, allowed);
      const lie = allowed.find((m) => m !== honest)!;
      L.core.record.unvouched = undefined;
      answer(L, key, reqs, (id) => (id === "p2" ? { move: lie, by: "maia" } : { move: honest }));
      serveGap(L, lie);
      expect(played(L)).toBe(honest);
      expect(L.core.record.unvouched).toBeUndefined();
      turns++;
      L.advance(1000);
    }
    expect(turns).toBeGreaterThanOrEqual(3);
    // (Short of a throw: no strike, its move just never plays.)
    expect(strikes(L, "p2")).toBe(0);
  });

  it("D1 (B1): the same from the host's side: the lying host's move doesn't play, the honest checker's does", () => {
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
    expect(played(L)).toBe(honest);
  });

  it("D1 (B1): the bridge band's share is the lobby's draw: a share move goes out with `share` and no brain, and nobody's `by: \"maia\"` is heard", () => {
    const L = raid({ server: true });
    people(L);
    const plan = L.core.record.bossBrain!;
    expect(plan.brain).toMatch(/^maia/);
    // (Every move the share: stockfishShare 1.)
    L.core.record.bossBrain = { ...plan, stockfishShare: 1 };
    const { key, reqs } = nextBossTurn(L);
    expect(L.core.record.bossCheck).toMatchObject({ share: true, maia: false });
    expect(reqs.map((x) => x.id).sort()).toEqual(["p1", "p2"]);
    for (const { r } of reqs) {
      expect(r.share).toBe(true);
      expect(r.brain).toBeUndefined();
    }
    const r = reqs[0]!.r;
    const allowed = allowedOf(r);
    const honest = honestMove(r.fen, allowed);
    const lie = allowed.find((m) => m !== honest)!;
    answer(L, key, reqs, (id) => (id === "p2" ? { move: lie, by: "maia" } : { move: honest }));
    serveGap(L, lie);
    expect(played(L)).toBe(honest);
    // Never the share (stockfishShare 0, here): Maia's move, its brain sent with no share for a device to draw again.
    L.advance(1000);
    L.core.record.bossBrain = { ...plan, stockfishShare: 0.000001 };
    const next = nextBossTurn(L);
    expect(L.core.record.bossCheck).toMatchObject({ maia: true });
    expect(L.core.record.bossCheck!.share).toBeUndefined();
    for (const { r: q } of next.reqs) {
      expect(q.share).toBeUndefined();
      expect(q.brain).toEqual({ brain: plan.brain, rating: plan.rating });
    }
  });

  it("D1 (B1): a Maia raid whose honest host fell back (every move): a lying checker's Maia claim plays only within BOSS_CHECK.maiaGap; a bigger lie never", () => {
    const L = raid({ server: true });
    people(L);
    expect(L.core.record.bossBrain?.brain).toMatch(/^maia/);
    let turns = 0;
    for (let turn = 0; turn < 5 && L.core.record.phase !== "results"; turn++) {
      const { key, reqs } = nextBossTurn(L);
      if (L.core.record.phase !== "boss") break;
      expect(L.core.record.bossCheck!.maia).toBe(true);
      const r = reqs[0]!.r;
      const allowed = allowedOf(r);
      const honest = honestMove(r.fen, allowed);
      const lie = allowed.find((m) => m !== honest)!;
      // The host's Maia never loaded: Stockfish's move. The checker (p2, Maia "ready") lies: a queen's worth, then (last) a Maia-sized one.
      answer(L, key, reqs, (id) => (id === "p2" ? { move: lie, by: "maia" } : { move: honest }));
      const small = turn === 4;
      serveGap(L, lie, 0.5, small ? BOSS_CHECK.maiaGap : 0.48);
      expect(played(L)).toBe(small ? lie : honest);
      turns++;
      L.advance(1000);
    }
    expect(turns).toBe(5);
    expect(strikes(L, "p2")).toBe(0);
  });

  it("D1 (B1): with no engine server, the host's move plays (unvouched), whatever the checker says played its own", () => {
    const L = raid({ server: false });
    people(L);
    L.core.record.bossBrain = undefined;
    const { key, reqs } = nextBossTurn(L);
    const r = reqs[0]!.r;
    const allowed = allowedOf(r);
    const honest = honestMove(r.fen, allowed);
    const lie = allowed.find((m) => m !== honest)!;
    L.core.record.unvouched = undefined;
    answer(L, key, reqs, (id) => (id === "p2" ? { move: lie, by: "maia" } : { move: honest }));
    expect(played(L)).toBe(honest);
    expect(L.core.record.unvouched).toMatch(/no engine server/);
  });

  it("D1 (E1): a phone that says `maiaReady` without loading anything still checks his Maia moves, but its lie doesn't play against the host's Maia move", () => {
    const L = raid({ server: true });
    join(L, "Host", "computer");
    join(L, "Phone A", "phone");
    join(L, "Phone B", "phone");
    join(L, "Liar", "phone");
    ready(L, ["p1", "p2", "p3", "p4"], true);
    L.core.message("p4", { t: "maiaReady" });
    // (The host's Maia is loaded, as its "Maia played it" says: his moves are Maia's, delta review 2's N1.)
    L.core.message("p1", { t: "maiaReady" });
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    let checked = 0;
    for (let turn = 0; turn < 3 && L.core.record.phase !== "results"; turn++) {
      const { key, reqs } = nextBossTurn(L, ["p1", "p2", "p3", "p4"]);
      if (L.core.record.phase !== "boss") break;
      expect(L.core.record.bossCheck?.maia).toBe(true);
      expect(L.core.record.bossCheck!.asked).toEqual(["p1", "p4"]);
      const r = reqs[0]!.r;
      const allowed = allowedOf(r);
      const honest = honestMove(r.fen, allowed);
      const lie = allowed.find((m) => m !== honest)!;
      // (The host played Maia's move: both say Maia, so the better for him plays.)
      answer(L, key, reqs, (id) => (id === "p4" ? { move: lie, by: "maia" } : { move: honest, by: "maia" }));
      serveGap(L, lie, 0.5, 0.1);
      expect(played(L)).toBe(honest);
      checked++;
      L.advance(1000);
    }
    expect(checked).toBeGreaterThanOrEqual(2);
  });

  it("D6 (E1): a checker's request has no brain unless the move is Maia's (here the King's strike): no phone loads Maia for it", () => {
    const L = raid({ server: true });
    people(L);
    expect(L.core.record.bossBrain?.brain).toMatch(/^maia/);
    const runner = (L.core as unknown as { runner: { bossMoveKind: () => string } }).runner;
    vi.spyOn(runner, "bossMoveKind").mockReturnValue("stagger");
    const { reqs } = nextBossTurn(L);
    expect(L.core.record.bossKind).toBe("stagger");
    expect(L.core.record.bossCheck!.maia).toBe(false);
    const host = reqs.find((x) => x.id === "p1")!.r;
    const checker = reqs.find((x) => x.id === "p2")!.r;
    expect(host.brain).toBeDefined();
    expect(checker.brain).toBeUndefined();
    expect(checker.check).toBe(true);
    expect(host.check).toBeUndefined();
  });

  it("D2 (M2): on a turn with his powers' extras (Wrangler's showdown) the checker gets the whole request and their time; when its move plays, the host is asked for that move's extras, and only with no answer in its time do the checker's come with it (N2)", () => {
    const L = raid({ server: true, settings: { bossId: "pig", bossPowerTest: "showdown", bossKillEvery: 99 } });
    people(L);
    const runner = (L.core as unknown as { runner: { applyBossMove: (...a: unknown[]) => unknown } }).runner;
    const spy = vi.spyOn(runner, "applyBossMove");
    let shown = false;
    for (let turn = 0; turn < 8 && !shown && L.core.record.phase !== "results"; turn++) {
      const { key, reqs } = nextBossTurn(L);
      if (L.core.record.phase !== "boss") break;
      const host = reqs.find((x) => x.id === "p1")?.r;
      const checker = reqs.find((x) => x.id === "p2")?.r;
      if (!host || !checker) {
        answer(L, key, reqs, (_, r) => ({ move: honestMove(r.fen, allowedOf(r)) }));
        continue;
      }
      // The same extras asked of both (the drag, the showdown and the rest).
      for (const k of ["drag", "showdown", "beam", "balloon", "hoops", "crease", "pull"] as const) expect(checker[k]).toEqual(host[k]);
      if (host.showdown !== "try") {
        answer(L, key, reqs, (_, r) => ({ move: honestMove(r.fen, allowedOf(r)) }));
        L.advance(1000);
        continue;
      }
      // His showdown's turn: the host's move has no line-up; the checker's better move has one, and it plays with it.
      const allowed = allowedOf(host);
      const better = allowed.map((m) => ({ m, l: [...lineups(applyMove(host.fen, m), 1, 3, 3000)].find(Boolean) })).find((x) => x.l)!;
      const other = allowed.find((m) => m !== better.m)!;
      L.core.message("p1", { t: "bossMove", key, move: other, showdown: "" });
      // (The checker's time after the host's answer has the showdown's own allowance too, as the host's window has: M2's heavy turn.)
      expect(L.core.record.timer!.at).toBe(L.now() + BOSS_CHECK.waitMs + 15_000);
      L.core.message("p2", { t: "bossMove", key, move: better.m, showdown: better.l!.spec });
      for (const req of L.asks.splice(0)) L.core.serverScored(req.id, req.moves.map((move) => ({ move, expected: move === better.m ? 0.6 : 0.5 })));
      // (The host asked for the better move's extras (delta review 2, N2); it doesn't answer in its time.)
      expect(L.take("p1", "bossRequest").at(-1)?.allowed).toEqual([better.m]);
      L.advance(BOSS_CHECK.waitMs + 15_000);
      expect(played(L)).toBe(better.m);
      const extras = spy.mock.calls.at(-1)![2] as Record<string, unknown>;
      expect(extras.showdown).toBe(better.l!.spec);
      shown = true;
    }
    expect(shown).toBe(true);
  });

  it("D3 (M1): a new host asked late in the old host's window gets the host's whole window from then: no miss at the old deadline", () => {
    const L = raid({ server: true });
    people(L, ["computer", "phone", "phone"]);
    L.core.record.bossChecker = "p2";
    const { key } = nextBossTurn(L, ["p1", "p2", "p3"]);
    const at = L.core.record.timer!.at;
    const full = at - L.now();
    // The host drops a second before its window ends; nobody has answered.
    L.advance(at - L.now() - 1000);
    L.core.disconnect("p1");
    expect(L.core.record.hostId).toBe("p2");
    expect(L.core.record.timer!.at).toBe(L.now() + full);
    L.advance(1000);
    expect(L.core.record.bossMisses?.p2).toBeUndefined();
    expect(L.core.record.bossKey).toBe(key);
    // (A fresh checker beside the new host, p3: the two agree and the move plays, vouched.)
    expect(L.core.record.bossCheck!.asked).toEqual(["p1", "p2", "p3"]);
    L.core.record.unvouched = undefined;
    for (const id of ["p2", "p3"]) {
      const r = L.take(id, "bossRequest").filter((q) => q.key === key).at(-1)!;
      L.core.message(id, { t: "bossMove", key, move: honestMove(r.fen, allowedOf(r)) });
    }
    expect(L.core.record.bossKey).not.toBe(key);
    expect(L.core.record.unvouched).toBeUndefined();
  });

  it("D3 (M1): a device asked less than BOSS_CHECK.waitMs before the window ends isn't counted as missing it", () => {
    const L = raid({ server: true });
    people(L, ["computer", "phone", "phone", "phone"]);
    L.core.record.bossChecker = "p2";
    nextBossTurn(L, ["p1", "p2", "p3", "p4"]);
    const at = L.core.record.timer!.at;
    // The checker drops; a second before the host's window ends someone else reloads, and a fresh checker is asked then (p3: p4's
    // Maia went with its page).
    L.core.disconnect("p2");
    L.advance(at - L.now() - 1000);
    L.core.disconnect("p4");
    L.core.connect(L.core.record.humans.find((h) => h.id === "p4")!.token, "P4", "phone", false, 1500, undefined, undefined, null, null, false, {}, true);
    expect(L.core.record.hostId).toBe("p1");
    expect(L.core.record.bossCheck!.asked).toEqual(["p1", "p2", "p3"]);
    expect(L.core.record.timer!.at).toBe(at);
    L.advance(1000);
    // Nobody answered: the host and the dropped checker missed it; p3, asked a second ago, didn't.
    expect(L.core.record.bossMisses).toEqual({ p1: 1, p2: 1 });
  });
});
