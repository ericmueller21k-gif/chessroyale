import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { CREASE_LINES, applyMove, creaseAnswer, folioOf, folioTurnMs, legalMoves, sanLineToUci, type BoardScore, type MatchRunner, type Opening, type ServerMessage } from "@chessroyale/chess";
import { fakeEngine } from "../../chess/test/boss-kit-lib.ts";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

/**
 * Folio online (docs/decisions/2026-10-27-folio-rules.md): the Crease's line asked of the host with its move when the
 * warning (or the trigger) comes as the crowd's next turn begins, checked by the server (junk: no warning, asked again
 * with its next move); Revision's move asked as the engine's best (`best`, no brain), held until its moment has played.
 */

type Msg = ServerMessage;
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, eco: "C88", name: `O${i}`, family: `F${i}`, unusual: false, moves: line, namedPlies: line.length, expected: Object.fromEntries(line.map((_, n) => [n, 0.5])) }));

function folio(patch: Partial<Settings> = {}) {
  let now = 1_000_000;
  const players = ["P1", "P2"];
  const inbox = new Map<string, Msg[]>();
  const settings = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...RAID_SETTINGS, lastStandFrom: 999, bossId: "folio", bossUnfinished: true, bossStumbleBelow: 0, raidOpening: true, ...patch } as Settings;
  const core = new LobbyCore(newLobbyRecord("FOLIO", now), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), msg as Msg]), icon: () => undefined }, library, mulberry32(7), settings);
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
    return last("p1", "bossRequest")!;
  };
  const toRound = () => {
    for (let i = 0; i < 12 && core.save().phase !== "play"; i++) advance(5_000);
    return last("p1", "round")!;
  };
  const crowdPlays = () => {
    const r = toRound();
    const ok = r.boss?.powers?.allowed ?? legalMoves(r.board!.fen);
    const m = [...ok].sort()[0]!;
    for (const id of players.map((x) => x.toLowerCase())) core.message(id, { t: "pick", key: last(id, "round")!.key, move: m });
    expect(hostScores()).toBe(true);
  };
  const answer = (move: string, crease?: string) => {
    const req = last("p1", "bossRequest")!;
    inbox.set("p1", (inbox.get("p1") ?? []).filter((x) => x.t !== "bossRequest"));
    core.message("p1", { t: "bossMove", key: req.key, move, ...(crease !== undefined ? { crease } : {}) });
  };
  advance(1000);
  advance(60_000);
  return { core, last, advance, runner, asked, toRound, crowdPlays, answer };
}

describe("Folio online: the Crease's line from the host", () => {
  it("?power=crease: asked with its first move; junk is refused (no warning, asked again); a line the rules allow: the warning shows it, then it lands", async () => {
    const L = folio({ bossPowerTest: "crease" });
    L.crowdPlays();
    const first = L.asked();
    expect(first.crease).toMatchObject({ order: expect.any(Number) });
    L.answer((first.allowed ?? legalMoves(first.fen)).sort()[0]!, "z|z");
    const r1 = L.toRound();
    expect(r1.boss!.powers!.events.map((e) => e.kind)).not.toContain("creaseWarn");
    expect(r1.boss!.powers!.warned).toBe(false);
    L.crowdPlays();
    const again = L.asked();
    expect(again.crease).toBeDefined();
    const move = (again.allowed ?? legalMoves(again.fen)).sort()[0]!;
    const pick = await creaseAnswer([fakeEngine()], applyMove(again.fen, move), again.crease!);
    expect(CREASE_LINES).toContain(pick);
    L.answer(move, pick);
    const warned = L.toRound();
    expect(warned.boss!.powers!.events).toEqual([{ kind: "warn", turn: warned.boss!.powers!.turn }, { kind: "creaseWarn", turn: warned.boss!.powers!.turn, line: pick }]);
    expect(warned.boss!.powers!.creaseNext).toBe(pick);
    L.crowdPlays();
    const next = L.asked();
    expect(next.crease).toBeUndefined();
    L.answer((next.allowed ?? legalMoves(next.fen)).sort()[0]!);
    const landed = L.toRound();
    expect(landed.boss!.powers!.crease).toEqual({ line: pick, at: landed.boss!.powers!.turn, until: landed.boss!.powers!.turn + BOSS_POWERS.creaseTurns - 1, side: landed.boss!.crowdSide });
    expect(landed.boss!.powers!.events.map((e) => e.kind)).toEqual(["crease"]);
  });
});

describe("Folio online: Revision", () => {
  it("?power=revision: after your fifth move the board goes back, its move is asked as the engine's best (no brain), and held until its moment has played", () => {
    const L = folio({ bossPowerTest: "revision" });
    for (let i = 0; i < 4; i++) {
      L.crowdPlays();
      const req = L.asked();
      L.answer((req.allowed ?? legalMoves(req.fen)).sort()[0]!);
    }
    // (Its fourth move may be held for a moment of its own: the crowd's fifth turn has begun once the round is out.)
    L.toRound();
    const plies = L.runner().boards.get(0)!.history.length;
    L.crowdPlays();
    const req = L.asked();
    expect(folioOf(L.runner().boss!.powers).revision).toMatchObject({ at: 5 });
    expect(req.best).toBe(true);
    expect(req.brain).toBeUndefined();
    // (Asked from the position before its crossed-out move.)
    expect(req.fen).toBe(L.runner().boards.get(0)!.fen);
    expect(L.runner().boards.get(0)!.history).toHaveLength(plies + 1);
    const hold = folioTurnMs(L.runner().boss);
    expect(hold).toBeGreaterThan(0);
    L.answer((req.allowed ?? legalMoves(req.fen)).sort()[0]!);
    expect(L.runner().boards.get(0)!.history).toHaveLength(plies + 1);
    L.advance(hold + 100);
    expect(L.runner().boards.get(0)!.history).toHaveLength(plies + 2);
    expect(folioOf(L.runner().boss!.powers).revision!.move).toBe(L.runner().boards.get(0)!.history.at(-1));
  });
});
