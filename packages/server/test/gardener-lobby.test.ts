import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { PASS_WAIT, legalMoves, sanLineToUci, seedsAt, sideToMove, waterAnswer, waterCheck, type BoardScore, type MatchRunner, type Opening, type ServerMessage } from "@chessroyale/chess";
import { fakeEngine } from "../../chess/test/boss-kit-lib.ts";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

/**
 * The hippo gardener online (docs/decisions/2026-10-21-gardener-rules.md): his seed meter on the server's clock, the
 * watering's request (what the seeds rolled, asked of the host), the host's placement checked and played as his whole
 * turn, and anything else (junk, PASS_WAIT) leaving him his move.
 */

type Msg = ServerMessage;
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, eco: "C88", name: `O${i}`, family: `F${i}`, unusual: false, moves: line, namedPlies: line.length, expected: Object.fromEntries(line.map((_, n) => [n, 0.5])) }));

function gardener(patch: Partial<Settings> = {}, players = ["P1", "P2"]) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const settings = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...RAID_SETTINGS, lastStandFrom: 999, bossId: "gardener", bossUnfinished: true, bossStumbleBelow: 0, bossPowerTest: "water", ...patch } as Settings;
  const core = new LobbyCore(newLobbyRecord("GARDN", now), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), msg as Msg]), icon: () => undefined }, library, mulberry32(7), settings);
  for (const [i, id] of players.entries()) core.connect(undefined, id, i ? "phone" : "computer", false, 1500);
  core.message("p1", { t: "start" });
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  const runner = () => (core as unknown as { runner: MatchRunner }).runner;
  const hostScores = () => {
    const req = last("p1", "scoreRequest");
    if (!req) return false;
    const boards: BoardScore[] = req.jobs.map((j) => {
      const legal = j.allowed ?? legalMoves(j.fen);
      const exp = Object.fromEntries(legal.map((m) => [m, 0.3 + 0.4 * hash(j.fen + m)]));
      const best = legal.reduce((a, b) => (exp[b]! > exp[a]! ? b : a));
      return { boardId: j.boardId, bestMove: best, bestExpected: exp[best]!, expectedAfter: exp, botPicks: {}, botThinkMs: {} };
    });
    core.message("p1", { t: "scores", key: req.key, boards });
    inbox.set("p1", (inbox.get("p1") ?? []).filter((m) => m.t !== "scoreRequest"));
    return true;
  };
  const asked = () => {
    for (let i = 0; i < 12 && !last("p1", "bossRequest") && core.save().phase !== "play"; i++) advance(5_000);
    return last("p1", "bossRequest");
  };
  const toRound = () => {
    for (let i = 0; i < 12 && core.save().phase !== "play"; i++) advance(5_000);
    return last("p1", "round")!;
  };
  const crowdPlays = () => {
    const r = toRound();
    const ok = r.boss?.powers?.allowed ?? legalMoves(r.board!.fen);
    const m = ok.find((x) => x === "b1c3" || x === "g1f3" || x === "b8c6" || x === "g8f6") ?? ok[0]!;
    for (const id of players.map((x) => x.toLowerCase())) core.message(id, { t: "pick", key: last(id, "round")!.key, move: m });
    expect(hostScores()).toBe(true);
    inbox.set("p1", (inbox.get("p1") ?? []).filter((x) => x.t !== "bossRequest"));
  };
  const answer = (move: string) => {
    const req = last("p1", "bossRequest")!;
    inbox.set("p1", (inbox.get("p1") ?? []).filter((x) => x.t !== "bossRequest"));
    core.message("p1", { t: "bossMove", key: req.key, move });
  };
  advance(1000);
  advance(60_000);
  const io = { now: () => now, send: (id: string, msg: unknown) => inbox.set(id, [...(inbox.get(id) ?? []), msg as Msg]), icon: () => undefined };
  return { core, inbox, last, advance, runner, asked, toRound, crowdPlays, answer, now: () => now, io, settings };
}

/** Plays on (his ordinary moves answered with the first allowed) until the watering is asked of the host. */
function untilWater(L: ReturnType<typeof gardener>) {
  for (let i = 0; i < 6; i++) {
    if (L.runner().bossToMove()) {
      const req = L.asked()!;
      // (When it was asked: the server's clock then, the time the count was taken.)
      if (req.water) return Object.assign(req, { at: L.now() });
      L.answer((req.allowed ?? legalMoves(req.fen))[0]!);
      continue;
    }
    L.crowdPlays();
  }
  throw new Error("no watering asked");
}

describe("the hippo gardener online", () => {
  it("his meter on the server's clock: the opening toss for everyone, the request's seeds as many as the clock says", async () => {
    const L = gardener();
    const first = L.toRound();
    const g = first.boss!.powers!.garden!;
    expect(g.base).toBe(5);
    expect(first.boss!.powers!.events).toContainEqual({ kind: "plantMany", turn: 1, seeds: 5 });
    expect(L.last("p2", "round")!.boss!.powers!.garden).toEqual(g);
    const req = untilWater(L);
    expect(req.water!.kinds).toHaveLength(seedsAt(g, req.at).count);
    expect(req.water!.kinds.length).toBeGreaterThan(5);
    expect(req.waterAny).toBe(true);
    // (A pick of positions, not a move: no allowed moves, no brain.)
    expect(req.allowed ?? req.brain ?? req.repaint).toBeUndefined();
  });

  it("the host's placement is his whole turn: checked, played, the crowd's turn after it with the watering's moment", async () => {
    const L = gardener({ bossSeedTest: 10 });
    const req = untilWater(L);
    expect(req.water!.kinds).toHaveLength(10);
    const { answer } = await waterAnswer([fakeEngine()], req.fen, req.water!, true);
    const checked = waterCheck(req.fen, req.water!, answer)!;
    expect(checked).not.toBeNull();
    L.answer(answer);
    const round = L.toRound();
    expect(round.board!.fen).toBe(checked.fen);
    expect(sideToMove(round.board!.fen)).toBe(L.runner().boss!.crowdSide);
    const p = round.boss!.powers!;
    expect(p.garden!.waterings).toBe(1);
    expect(p.garden!.water!.rolled).toEqual(req.water!.kinds);
    expect(p.events.find((e) => e.kind === "water")!.growth).toEqual(p.garden!.water!.growth);
    expect(p.garden!.plants.map((x) => x.square).sort()).toEqual([...checked.plants].sort());
    for (const plant of p.garden!.plants) expect(plant.left).toBe(3);
    expect(round.boss!.lastMove ?? null).toBeNull();
    // (Both players see the same.)
    expect(L.last("p2", "round")!.boss!.powers!.garden).toEqual(p.garden);
    // (The meter reset from the moment the count was taken: the request's.)
    expect(p.garden!.since).toBe(req.at);
    expect(p.garden!.base).toBe(0);
  });

  it("junk, \"\" or PASS_WAIT from the host: no watering now, and his move is asked for at once; next turn it's asked again", () => {
    for (const junk of ["e2e4", "", PASS_WAIT, "qa1 qa2"]) {
      const L = gardener({ bossSeedTest: 4 });
      untilWater(L);
      L.answer(junk);
      const move = L.asked()!;
      expect(move.water).toBeUndefined();
      expect(L.runner().boss!.powers!.garden!.wait).toBe(L.runner().boss!.crowdMoves);
      L.answer((move.allowed ?? legalMoves(move.fen))[0]!);
      L.crowdPlays();
      expect(L.asked()!.water?.kinds).toHaveLength(4);
    }
  });

  it("no host answers in time (the request's timeout, no other host): no watering now, and his move", () => {
    const L = gardener({ bossSeedTest: 3 }, ["P1"]);
    const req = untilWater(L);
    expect(req.water!.kinds).toHaveLength(3);
    L.inbox.set("p1", []);
    // (The host never answers: past the timeout, the server's own fallback, "", and the watering waits a turn.)
    L.advance(16_000);
    expect(L.runner().boss!.powers!.garden!.wait).toBe(L.runner().boss!.crowdMoves);
    expect(L.runner().boss!.powers!.garden!.waterings).toBe(0);
    const move = L.last("p1", "bossRequest");
    expect(move?.water).toBeUndefined();
  });

  it("a lobby restored mid-watering (the Durable Object woken) keeps the roll: the host's answer to it is played", async () => {
    const L = gardener({ bossSeedTest: 6 });
    const req = untilWater(L);
    const record = structuredClone(L.core.save());
    const restored = new LobbyCore(record, L.io, library, mulberry32(8), L.settings);
    const runner = (restored as unknown as { runner: MatchRunner }).runner;
    expect(runner.waterAsk()!.kinds).toEqual(req.water!.kinds);
    expect(runner.boss!.powers!.garden!.roll!.clock).toBe(req.at);
    const { answer } = await waterAnswer([fakeEngine()], req.fen, req.water!, true);
    restored.message("p1", { t: "bossMove", key: req.key, move: answer });
    expect(runner.boss!.powers!.garden!.waterings).toBe(1);
    expect(runner.boss!.powers!.garden!.water!.rolled).toEqual(req.water!.kinds);
  });

  it("a roll with queens: asked and checked as any other; with all eight of his pawns on the board none can grow (nothing, dropped)", async () => {
    const odds = BOSS_POWERS.waterOdds;
    (BOSS_POWERS as { waterOdds: unknown }).waterOdds = { nothing: 0, plant: 0, killer: 0, pawn: 0, piece: 0, queen: 100 };
    try {
      const L = gardener({ bossSeedTest: 2 });
      const req = untilWater(L);
      expect(req.water!.kinds).toEqual(["q", "q"]);
      const { answer } = await waterAnswer([fakeEngine()], req.fen, req.water!, true);
      // (His queen and his eight pawns: a second queen is more than promotions could make.)
      expect(answer).toBe("none");
      expect(waterCheck(req.fen, req.water!, "qe4")).toBeNull();
      L.answer(answer);
      const w = L.toRound().boss!.powers!.garden!.water!;
      expect(w.growth.map((g) => [g.kind, g.dropped])).toEqual([
        ["nothing", "q"],
        ["nothing", "q"],
      ]);
      expect(w.jackpot).toBeUndefined();
    } finally {
      (BOSS_POWERS as { waterOdds: unknown }).waterOdds = odds;
    }
  });
});

