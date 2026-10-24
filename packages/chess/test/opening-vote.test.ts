import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CROWD_KNOCKOUTS, CROWD_START, DEFAULT_SETTINGS, PREGAME_VOTES, crowdFinalBoss, modeSettings, mulberry32, type Settings } from "@chessroyale/core";
import {
  CHESS960_STANDARD_INDEX,
  FREESTYLE_OPENING,
  MatchRunner,
  START_FEN,
  applyMove,
  baseAt,
  chess960Fen,
  fenAtPly,
  freestyleBoard,
  freestyleStart,
  isChess960Fen,
  legalMoves,
  perft960,
  pieceAt,
  usableAt,
  type EngineLike,
  type Opening,
} from "../src/index.ts";

/**
 * The 50 v 50's start vote ("How does it start?", Eric, Oct 24; docs/decisions/2026-10-24-opening-vote.md): what each
 * start puts on the board, and a Freestyle game played through the runner (bots, the judge, castling both ways).
 */

const library = JSON.parse(readFileSync(new URL("../data/openings.json", import.meta.url), "utf8")) as Opening[];
const startVote = PREGAME_VOTES.find((v) => v.id === "start")!;
const patchOf = (id: string) => startVote.options.find((o) => o.id === id)!.patch;
const crowd: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd") };

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
/** A stand-in judge: every legal move a stable number; `prefer` (if legal) far ahead of the rest. */
const judge = (prefer: string[] = []): EngineLike => {
  const score = (fen: string, move: string) => (prefer.includes(move) ? 0.95 : 0.3 + 0.2 * hash(fen + move));
  return {
    async topMoves(fen, n) {
      return legalMoves(fen)
        .map((move) => ({ move, expected: score(fen, move) }))
        .sort((a, b) => b.expected - a.expected)
        .slice(0, n);
    },
    async scoreMoves(fen, moves) {
      return moves.map((move) => ({ move, expected: score(fen, move) }));
    },
  };
};

const entrants = (humans = 0) =>
  Array.from({ length: 100 }, (_, i) => (i < humans ? { id: `h${i}`, name: `H${i}`, isBot: false } : { id: `b${i}`, name: `B${i}`, isBot: true, skill: 1 + (i % 20) }));

function runner(seed: number, opts: { settings?: Settings; engine?: EngineLike; humans?: number } = {}) {
  return new MatchRunner({ settings: opts.settings ?? crowd, rng: mulberry32(seed), engines: [opts.engine ?? judge()], library, entrants: entrants(opts.humans) });
}

describe("Freestyle's start", () => {
  it("is one of the 959 Chess960 starts that aren't the usual one, a legal position with every castling right, seeded", () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 300; seed++) {
      const { index, fen } = freestyleStart(mulberry32(seed));
      expect(index).not.toBe(CHESS960_STANDARD_INDEX);
      expect(fen).toBe(chess960Fen(index));
      expect(fen).not.toBe(START_FEN);
      expect(isChess960Fen(fen)).toBe(true);
      // (Every right on: two rooks a side, named by file.)
      expect(fen.split(" ")[2]).toMatch(/^[A-H]{2}[a-h]{2}$/);
      // Every pawn's two steps and the knights' jumps (16 or more moves), and the board mirrored.
      expect(legalMoves(fen).length).toBeGreaterThanOrEqual(18);
      const [black, , , , , , , white] = fen.split(" ")[0]!.split("/");
      expect(black).toBe(white!.toLowerCase());
      // The same source, the same start.
      expect(freestyleStart(mulberry32(seed))).toEqual({ index, fen });
      seen.add(index);
    }
    expect(seen.size).toBeGreaterThan(200);
    // (The extremes: the first draw and the last.)
    expect(freestyleStart(() => 0).index).toBe(0);
    expect(freestyleStart(() => 0.99999999).index).toBe(959);
    // (Neither side's first move can touch the other's: perft 2 is perft 1 squared.)
    const one = freestyleStart(mulberry32(1)).fen;
    expect(perft960(one, 2)).toBe(perft960(one, 1) ** 2);
  });
});

describe("the runner sets the 50 v 50's board up from the start that won the vote", () => {
  it("Normal: the usual starting position, as before the vote (nothing drawn, nothing changed)", () => {
    const r = runner(3);
    const before = r.boards.get(0)!;
    r.patchSettings(patchOf("normal"));
    expect(r.boards.get(0)).toBe(before);
    expect(before.fen).toBe(START_FEN);
    expect(before.history).toEqual([]);
  });

  it("Random opening: a named line from the library, CROWD_START moves a side in, inside the balance window, White to move", () => {
    const fens = new Set<string>();
    for (let seed = 0; seed < 12; seed++) {
      const r = runner(seed);
      r.patchSettings(patchOf("random"));
      const b = r.boards.get(0)!;
      const plies = 2 * CROWD_START.randomOpeningMoves;
      expect(b.openingPlies).toBe(plies);
      expect(b.history).toEqual(b.opening.moves.slice(0, plies));
      expect(b.fen.split(" ")[1]).toBe("w");
      expect(b.fen.split(" ")[5]).toBe(String(CROWD_START.randomOpeningMoves + 1));
      expect(library).toContain(b.opening);
      expect(usableAt(b.opening, plies, crowd.openingBalance)).toBe(true);
      expect(b.expected).toBeGreaterThanOrEqual(crowd.openingBalance[0]);
      expect(b.expected).toBeLessThanOrEqual(crowd.openingBalance[1]);
      // From the usual start: no base.
      expect(b.bases).toBeUndefined();
      fens.add(b.fen);
    }
    expect(fens.size).toBeGreaterThan(6);
  });

  it("Freestyle: a seeded Chess960 start in a base at ply 0, the same for the same match seed (every device the lobby sends it to)", () => {
    const a = runner(5);
    a.patchSettings(patchOf("freestyle"));
    const b = a.boards.get(0)!;
    expect(b.opening).toBe(FREESTYLE_OPENING);
    expect(b.opening.name).toBe("Freestyle");
    expect(isChess960Fen(b.fen)).toBe(true);
    expect(b.bases).toEqual([{ ply: 0, fen: b.fen }]);
    expect(baseAt(0, b.bases).fen).toBe(b.fen);
    const again = runner(5);
    again.patchSettings(patchOf("freestyle"));
    expect(again.boards.get(0)!.fen).toBe(b.fen);
    const others = new Set([6, 7, 8, 9].map((seed) => {
      const r = runner(seed);
      r.patchSettings(patchOf("freestyle"));
      return r.boards.get(0)!.fen;
    }));
    expect(others.size).toBeGreaterThan(1);
  });

  it("set before the match (the ?start= test switch, votes off): the same boards", () => {
    const free = runner(5, { settings: { ...crowd, augments: false, ...patchOf("freestyle") } });
    expect(isChess960Fen(free.boards.get(0)!.fen)).toBe(true);
    const random = runner(5, { settings: { ...crowd, augments: false, ...patchOf("random") } });
    expect(random.boards.get(0)!.history).toHaveLength(2 * CROWD_START.randomOpeningMoves);
  });

  it("once a move is played, the start never changes", async () => {
    const r = runner(4);
    r.deal();
    await r.score(new Map());
    const b = r.boards.get(0)!;
    r.patchSettings(patchOf("freestyle"));
    expect(r.boards.get(0)).toBe(b);
  });

  it("only the 50 v 50: Classic's boards and a raid's are untouched by a start in their settings", () => {
    const classic = new MatchRunner({ settings: { ...DEFAULT_SETTINGS, ...patchOf("freestyle") }, rng: mulberry32(1), engines: [judge()], library, entrants: entrants().slice(0, 64) });
    expect([...classic.boards.values()].some((b) => isChess960Fen(b.fen))).toBe(false);
  });
});

/** A Freestyle position with both castles open to White: king e1, rooks b1 and g1 (and Black's the same). */
const CASTLES = "1r2k1r1/pppppppp/8/8/8/8/PPPPPPPP/1R2K1R1 w GBgb - 0 1";

describe("a Freestyle game in the runner: bots move, the judge scores, castling both ways", () => {
  it("plays the first stage from its start: every move legal from the Chess960 position, the history replays from the base", async () => {
    const r = runner(11);
    r.patchSettings(patchOf("freestyle"));
    const start = r.boards.get(0)!.fen;
    for (let i = 0; i < 12; i++) {
      r.deal();
      const before = r.boards.get(0)!.fen;
      const rep = await r.score(new Map());
      const [board] = rep.boards;
      expect(board!.fenBefore).toBe(before);
      expect(legalMoves(before)).toContain(board!.result.playedMove);
      // Every pick scored by the judge from this position.
      expect(board!.result.players.every((p) => p.loss !== null)).toBe(true);
    }
    const b = r.boards.get(0)!;
    expect(b.history).toHaveLength(12);
    expect(fenAtPly(b.history, 0, b.bases)).toBe(start);
    expect(fenAtPly(b.history, b.history.length, b.bases)).toBe(b.fen);
    // The snapshot keeps the start (a lobby that sleeps mid-match wakes with the same board and the same name).
    const back = MatchRunner.restore(JSON.parse(JSON.stringify(r.snapshot())), { settings: { ...crowd, ...patchOf("freestyle") }, rng: mulberry32(1), engines: [judge()], library });
    const restored = back.boards.get(0)!;
    expect(restored.opening).toBe(FREESTYLE_OPENING);
    expect(restored.bases).toEqual(b.bases);
    expect(restored.fen).toBe(b.fen);
  });

  for (const [way, move, king, rook] of [
    ["the king's side (O-O)", "e1g1", "g1", "f1"],
    ["the queen's side (O-O-O)", "e1b1", "c1", "d1"],
  ] as const) {
    it(`castling ${way}: the king onto its own rook, picked, judged and played`, async () => {
      const r = runner(2, { engine: judge([move]), humans: 1 });
      r.patchSettings(patchOf("freestyle"));
      r.boards.set(0, freestyleBoard(0, CASTLES));
      const groups = r.deal();
      const [[, ids]] = [...groups] as [[number, string[]]];
      // (Whichever team plays White picks; the person is on one of them.)
      const human = ids.includes("h0") ? new Map([["h0", { move, thinkMs: 1000 }]]) : new Map();
      expect(legalMoves(CASTLES)).toContain(move);
      const rep = await r.score(human);
      const [board] = rep.boards;
      expect(board!.bestMove).toBe(move);
      expect(board!.scored.find((m) => m.move === move)!.loss).toBe(0);
      if (ids.includes("h0")) expect(board!.result.players.find((p) => p.playerId === "h0")).toMatchObject({ move, loss: 0 });
      // Every bot that castled was scored for it, and the crowd's pick is played: the king on its square, the rook beside it.
      expect(board!.result.playedMove).toBe(move);
      const after = r.boards.get(0)!.fen;
      expect(pieceAt(after, king)).toEqual({ color: "w", type: "k" });
      expect(pieceAt(after, rook)).toEqual({ color: "w", type: "r" });
      expect(after).toBe(applyMove(CASTLES, move));
      // White's castling rights are gone; Black's stay.
      expect(after.split(" ")[2]).toBe("gb");
    });
  }
});

describe("the finals after a Freestyle game", () => {
  /** Plays a Freestyle 50 v 50 (votes as patches) through every cut to its final. */
  async function toFinal(settings: Settings, seed: number) {
    const r = runner(seed, { settings });
    r.patchSettings(patchOf("freestyle"));
    const start = r.boards.get(0)!.fen;
    while (!r.isFinal()) {
      r.deal();
      await r.score(new Map());
      if (r.stageComplete()) r.endStage();
    }
    return { r, start };
  }

  it("the boss final is played from the usual starting position: the Hidden Boss, and any boss standing in for him", async () => {
    const boss: Settings = { ...crowd, finalFormat: "boss", knockoutsPerStage: CROWD_KNOCKOUTS.boss, bossMaxMoves: 20 };
    for (const settings of [boss, { ...boss, bossesOff: [crowdFinalBoss()!.id] }]) {
      const { r, start } = await toFinal(settings, 8);
      expect(isChess960Fen(start)).toBe(true);
      const b = r.boards.get(r.state.boards[0]!)!;
      expect(r.boss).not.toBeNull();
      expect([b.fen, b.history, b.bases]).toEqual([START_FEN, [], undefined]);
    }
  });

  it("the team final plays on, on the game's own board from its Freestyle start", async () => {
    const { r, start } = await toFinal({ ...crowd, finalMaxTurns: 70 }, 9);
    expect(r.final!.format).toBe("team");
    const b = r.boards.get(r.state.boards[0]!)!;
    expect(baseAt(0, b.bases).fen).toBe(start);
    expect(fenAtPly(b.history, b.history.length, b.bases)).toBe(b.fen);
  });
});
