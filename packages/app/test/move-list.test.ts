import { describe, expect, it } from "vitest";
import { fenAtPly } from "@chessroyale/chess";
import { battleStartPly, moveNumber, moverOf, newPlyCache, noteTurns, pieceOn, plyRows, timeShown, turnBook, turnMs, type TurnInput } from "../src/move-list.ts";

/** A game with a capture of each kind, castling, en passant and a promotion. */
const GAME = ["e2e4", "d7d5", "e4d5", "d8d5", "b1c3", "d5a5", "g1f3", "c8g4", "f1e2", "b8c6", "e1g1", "e8c8"];

describe("the move list's rows from the match's history", () => {
  it("names each move's piece, the square it went to and what it took", () => {
    const rows = plyRows(newPlyCache(), "1:0", GAME);
    expect(rows).toHaveLength(GAME.length);
    const at = (i: number) => ({ color: rows[i]!.color, piece: rows[i]!.piece, to: rows[i]!.to, captured: rows[i]!.captured, castle: rows[i]!.castle });
    expect(at(0)).toEqual({ color: "w", piece: "p", to: "e4", captured: null, castle: null });
    expect(at(2)).toEqual({ color: "w", piece: "p", to: "d5", captured: "p", castle: null });
    expect(at(3)).toEqual({ color: "b", piece: "q", to: "d5", captured: "p", castle: null });
    expect(at(4)).toEqual({ color: "w", piece: "n", to: "c3", captured: null, castle: null });
    expect(at(10)).toEqual({ color: "w", piece: "k", to: "g1", captured: null, castle: "O-O" });
    expect(at(11)).toEqual({ color: "b", piece: "k", to: "c8", captured: null, castle: "O-O-O" });
    // Each row's positions are the game's own.
    for (let i = 0; i < GAME.length; i++) expect(rows[i]!.fenAfter).toBe(fenAtPly(GAME, i + 1));
  });

  it("en passant takes a pawn; a promotion names its piece", () => {
    const ep = plyRows(newPlyCache(), "k", ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"]);
    expect(ep[4]).toMatchObject({ piece: "p", to: "d6", captured: "p" });
    const promo = plyRows(newPlyCache(), "k", ["h2h4", "g7g5", "h4g5", "h7h6", "g5h6", "f8g7", "h6g7", "g8f6", "g7h8q"]);
    expect(promo[8]).toMatchObject({ piece: "p", to: "h8", captured: "r", promo: "q" });
  });

  it("works out only new plies, and redoes them from a move taken back or a new base", () => {
    const cache = newPlyCache();
    const first = plyRows(cache, "b", GAME.slice(0, 6));
    const kept = first[3];
    const more = plyRows(cache, "b", GAME);
    expect(more[3]).toBe(kept);
    // (The God King's Last Stand: the last move taken back, another played.)
    const back = plyRows(cache, "b", [...GAME.slice(0, 11), "a7a6"]);
    expect(back).toHaveLength(12);
    expect(back[11]).toMatchObject({ piece: "p", to: "a6" });
    expect(back[3]).toBe(kept);
    // (A base: a piece destroyed between moves, e.g. G-REX's fire on b1 before White's 3rd move: Nc3 can't happen.)
    const base = { ply: 4, fen: fenAtPly(GAME, 4).replace("RNB", "R1B") };
    const burnt = plyRows(cache, "b", ["e2e4", "d7d5", "e4d5", "d8d5", "g1f3"], [base]);
    expect(burnt).toHaveLength(5);
    expect(burnt[4]).toMatchObject({ piece: "n", to: "f3", fenBefore: base.fen });
    // A new board starts again.
    expect(plyRows(cache, "c", ["d2d4"])).toHaveLength(1);
  });

  it("knows who moved: the opening, the crowd, the God King for the crowd, the boss", () => {
    const rows = plyRows(newPlyCache(), "m", GAME);
    // The battle from move 3 (ply 4), the crowd White, the God King playing the crowd's 2nd move (ply 6).
    const start = battleStartPly(3);
    expect(start).toBe(4);
    expect(rows.map((r) => moverOf(r, "w", start, [2]))).toEqual(["opening", "opening", "opening", "opening", "crowd", "boss", "king", "boss", "crowd", "boss", "crowd", "boss"]);
    // The crowd Black from the start.
    expect(rows.slice(0, 4).map((r) => moverOf(r, "b", 0, [1]))).toEqual(["boss", "king", "boss", "crowd"]);
  });

  it("numbers and times as the rows show them", () => {
    expect([moveNumber(0), moveNumber(1), moveNumber(22)]).toEqual(["1.", "1…", "12."]);
    expect([timeShown(400), timeShown(4_400), timeShown(65_000)]).toEqual(["0s", "4s", "1:05"]);
    expect(pieceOn("8/8/8/8/8/8/8/R3K2r w - - 0 1", "h1")).toEqual({ color: "b", type: "r" });
    expect(pieceOn("8/8/8/8/8/8/8/R3K2r w - - 0 1", "b1")).toBeNull();
  });
});

describe("how long each move took, as this device watched it", () => {
  const match = {};
  const board = (history: string[]) => ({ id: 1, generation: 0, history });
  it("the crowd's from its clock starting to its move being in; the boss's from his turn to his move", () => {
    const book = turnBook(match);
    const h0: string[] = [];
    const at = (phase: TurnInput["phase"], history: string[], now: number) => noteTurns(book, { phase, board: board(history) }, now);
    // Your move: the clock starts at 1000; it's in at 5200 (Boss alone: the boss thinks at once).
    at({ kind: "play", board: { ply: 0 }, startsAt: 1000 }, h0, 1500);
    at({ kind: "boss", boss: { board: { history: ["e2e4"] } }, thinking: true }, ["e2e4"], 5200);
    // His move lands at 7000.
    at({ kind: "boss", boss: { board: { history: ["e2e4", "e7e5"] } } }, ["e2e4", "e7e5"], 7000);
    expect(turnMs(book, 0)).toBe(4200);
    expect(turnMs(book, 1)).toBe(1800);
    // A raid's reveal: the votes in at 12000, how many picked the move.
    at({ kind: "play", board: { ply: 2 }, startsAt: 8000 }, ["e2e4", "e7e5"], 8000);
    at(
      { kind: "reveal", board: { ply: 2 }, mine: { result: { players: [{ move: "g1f3" }, { move: "g1f3" }, { move: "d2d4" }, { move: null }], playedMove: "g1f3" } } },
      ["e2e4", "e7e5"],
      12_000,
    );
    at({ kind: "boss", boss: { board: { history: ["e2e4", "e7e5", "g1f3"] } }, thinking: true }, ["e2e4", "e7e5", "g1f3"], 13_000);
    expect(turnMs(book, 2)).toBe(4000);
    expect(book.picks.get(2)).toEqual({ n: 2, of: 3 });
    // A move this device never saw start: no time.
    expect(turnMs(book, 7)).toBeNull();
  });
});
