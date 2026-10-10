import { beforeEach, describe, expect, it } from "vitest";
import { applyMove } from "@chessroyale/chess";
import { knockFor, moveKnock, resetKnocks } from "../src/move-sound.ts";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const after = (fen: string, ...moves: string[]) => moves.reduce((f, m) => applyMove(f, m), fen);

describe("the knock as a move appears on the board", () => {
  it("a move, a capture (en passant too) and castling each have their own", () => {
    const e4 = after(START, "e2e4");
    expect(moveKnock(START, e4, "e2e4")).toBe("move");
    const exd5 = after(START, "e2e4", "d7d5");
    expect(moveKnock(exd5, after(exd5, "e4d5"), "e4d5")).toBe("capture");
    const ep = after(START, "e2e4", "a7a6", "e4e5", "d7d5");
    expect(moveKnock(ep, after(ep, "e5d6"), "e5d6")).toBe("capture");
    const castle = after(START, "e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6");
    expect(moveKnock(castle, after(castle, "e1g1"), "e1g1")).toBe("castle");
    expect(moveKnock(e4, e4, "e2e4")).toBeNull();
  });
});

describe("a board that takes over from another screen (Eric, Oct 10: your move against Hollow made no sound)", () => {
  beforeEach(() => resetKnocks());

  it("knocks once for your move when the screen you moved on was replaced before it could", () => {
    // The play screen's board shows the position; you move; the boss screen (him thinking) replaces it at once.
    expect(knockFor(null, START, null)).toBeNull();
    const e4 = after(START, "e2e4");
    expect(knockFor(null, e4, "e2e4")).toBe("move");
  });

  it("doesn't knock twice when the screen you moved on did", () => {
    expect(knockFor(null, START, null)).toBeNull();
    const e4 = after(START, "e2e4");
    expect(knockFor(START, e4, "e2e4")).toBe("move");
    // The next screen shows the same position: nothing new.
    expect(knockFor(null, e4, "e2e4")).toBeNull();
    // His reply on that screen knocks as usual.
    expect(knockFor(e4, after(e4, "e7e5"), "e7e5")).toBe("move");
  });

  it("never knocks for a position that isn't that very move after the last one shown", () => {
    expect(knockFor(null, START, null)).toBeNull();
    // Two moves on (a tab back from the background), or another game's board: silence, as before.
    expect(knockFor(null, after(START, "e2e4", "e7e5"), "e7e5")).toBeNull();
    expect(knockFor(null, START, null)).toBeNull();
    expect(knockFor(null, after(START, "d2d4"), "d2d4")).toBe("move");
    // (Now the last shown is after d4: a board of a game that went c4 instead doesn't follow from it.)
    expect(knockFor(null, after(START, "c2c4"), "c2c4")).toBeNull();
  });
});
