import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { REPAINT_TEST_MOVES, legalMoves, pieceAt, sanLineToUci, sideToMove, type BoardScore, type MatchRunner, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

/**
 * Smudgy online (docs/decisions/2026-10-19-smudgy-rules.md): his forced moves asked of the host as his only allowed
 * move, the swap for everyone, the Repaint request (the pairs as `repaint`; the host's pick, or "" and his move), and a
 * pick refused for the hidden rook, picked again at no cost.
 */

type Msg = ServerMessage;
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, eco: "C88", name: `O${i}`, family: `F${i}`, unusual: false, moves: line, namedPlies: line.length, expected: Object.fromEntries(line.map((_, n) => [n, 0.5])) }));

function smudgy(patch: Partial<Settings> = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const settings = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...RAID_SETTINGS, lastStandFrom: 999, bossId: "smudgy", bossUnfinished: true, bossStumbleBelow: 0, ...patch } as Settings;
  const core = new LobbyCore(newLobbyRecord("SMUDG", now), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), msg as Msg]), icon: () => undefined }, library, mulberry32(7), settings);
  for (const [i, id] of ["P1", "P2"].entries()) core.connect(undefined, id, i ? "phone" : "computer", false, 1500);
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
  /** Time passes until the host is asked for the boss's turn (or the crowd's turn comes). */
  const asked = () => {
    for (let i = 0; i < 12 && !last("p1", "bossRequest") && core.save().phase !== "play"; i++) advance(5_000);
    return last("p1", "bossRequest");
  };
  const toRound = () => {
    for (let i = 0; i < 12 && core.save().phase !== "play"; i++) advance(5_000);
    return last("p1", "round")!;
  };
  const crowdPlays = (move?: string) => {
    const r = toRound();
    const ok = r.boss?.powers?.allowed ?? legalMoves(r.board!.fen);
    const m = move ?? ok.find((x) => x === "b1c3" || x === "g1f3" || x === "b1a3") ?? ok[0]!;
    for (const id of ["p1", "p2"]) core.message(id, { t: "pick", key: last(id, "round")!.key, move: m });
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
  return { core, inbox, last, advance, runner, hostScores, asked, toRound, crowdPlays, answer };
}

describe("Smudgy online", () => {
  it("his two forced moves are his only allowed moves in the host's request, then the swap reaches everyone", () => {
    const L = smudgy();
    expect(L.runner().boss!.id).toBe("smudgy");
    for (let k = 0; k < 2; k++) {
      L.crowdPlays();
      const req = L.asked()!;
      expect(req.allowed).toHaveLength(1);
      const forced = req.allowed![0]!;
      expect(k === 0 ? ["a7a5", "h7h5"] : ["a8a6", "h8h6"]).toContain(forced);
      L.answer(forced);
    }
    const round = L.toRound();
    const camo = round.boss!.powers!.camo!;
    expect(camo).toMatchObject({ step: 2, off: false });
    expect(camo.square).toBe(camo.swap!.pawn);
    expect(pieceAt(round.board!.fen, camo.square!)).toEqual({ color: "b", type: "r" });
    expect(round.boss!.powers!.events.some((e) => e.kind === "camouflage")).toBe(true);
    // (Both players see it the same.)
    expect(L.last("p2", "round")!.boss!.powers!.camo).toEqual(camo);
  });

  it("Repaint: the host is asked to pick among the pairs; its pick is his whole turn; its \"\" leaves him his move", () => {
    const L = smudgy({ bossPowerTest: "repaint" });
    expect(L.runner().boards.get(0)!.history.slice(0, 4)).toEqual([...REPAINT_TEST_MOVES]);
    // His forced moves first.
    for (let k = 0; k < 2; k++) {
      L.crowdPlays();
      L.answer(L.asked()!.allowed![0]!);
    }
    L.crowdPlays();
    const req = L.asked()!;
    expect(req.repaint?.length).toBeGreaterThan(0);
    expect(req.repaintAny).toBe(true);
    expect(req.allowed ?? req.brain ?? req.hop ?? req.fuse).toBeUndefined();
    // "" (none in the band): no Repaint now, and his move is asked for at once.
    L.answer("");
    const move = L.asked()!;
    expect(move.repaint).toBeUndefined();
    expect(L.runner().boss!.powers!.repaintWait).toBe(L.runner().boss!.crowdMoves);
    L.answer((move.allowed ?? legalMoves(move.fen))[0]!);
    // Next turn it's asked again: the host's pick this time.
    L.crowdPlays();
    const again = L.asked()!;
    expect(again.repaint?.length).toBeGreaterThan(0);
    const pick = again.repaint![0]!;
    L.answer(pick);
    const round = L.toRound();
    const p = round.boss!.powers!;
    expect(p.repaints).toBe(1);
    expect(round.board!.fen).toBe(pick);
    expect(sideToMove(round.board!.fen)).toBe("w");
    expect(p.events).toContainEqual({ kind: "repaint", turn: p.turn, squares: [p.repaint!.pawn, p.repaint!.piece] });
    expect(round.boss!.lastMove ?? null).toBeNull();
  });

  it("a pick the hidden rook makes illegal is refused, and the player picks again at no cost", () => {
    const L = smudgy();
    L.toRound();
    // (The battle from a position of our own: his rook hidden on e7, your king on d2, you to move.)
    const r = L.runner();
    const fen = "4k3/4r3/8/8/8/8/3K4/8 w - - 0 30";
    const board = r.boards.get(0)!;
    r.boards.set(0, { ...board, fen, bases: [...(board.bases ?? []), { ply: board.history.length, fen }] });
    const p = r.state.boss!.powers!;
    r.state = { ...r.state, boss: { ...r.state.boss!, crowdMoves: 4, powers: { ...p, camo: { side: "h", step: 2, missed: 0, due: null, square: "e7", swap: { at: 2, rook: "h6", pawn: "e7" } } } } };
    expect(r.crowdAllowed() ?? legalMoves(fen)).not.toContain("d2e3");
    const key = L.last("p1", "round")!.key;
    const before = (L.inbox.get("p2") ?? []).length;
    L.core.message("p1", { t: "pick", key, move: "d2e3" });
    // Refused: no pick recorded, nobody told it moved.
    expect((L.inbox.get("p2") ?? []).slice(before).some((m) => m.t === "moved")).toBe(false);
    L.core.message("p1", { t: "pick", key, move: "d2d3" });
    expect((L.inbox.get("p2") ?? []).slice(before).some((m) => m.t === "moved" && m.playerId === "p1")).toBe(true);
  });
});
