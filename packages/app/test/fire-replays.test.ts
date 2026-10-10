import { describe, expect, it } from "vitest";
import { applyMove, fenAtPly, START_FEN, withoutPiece } from "@chessroyale/chess";
import { bossBeat } from "../src/characters/boss-beats.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";

/**
 * After G-REX's fire destroys a piece, moves that were only legal without it are in the game's history: anything that
 * replays the game must start from where the position changed (its bases), or the replay throws.
 */
describe("replays after a piece burnt", () => {
  // 1. e4 (and the pawn burns on e4), e5 2. Nf3 e4: the black pawn's step is only legal with e4 empty.
  const burnt = withoutPiece(applyMove(START_FEN, "e2e4"), "e4");
  const bases = [{ ply: 1, fen: burnt }];
  const history = ["e2e4", "e7e5", "g1f3", "e5e4"];
  const fen = applyMove(applyMove(applyMove(burnt, "e7e5"), "g1f3"), "e5e4");

  it("the position at any ply plays from the base", () => {
    expect(fenAtPly(history, 4, bases)).toBe(fen);
    expect(() => fenAtPly(history, 4)).toThrow();
  });

  it("the boss's reactions read the position before the last moves from the base too", () => {
    const kit = BOSS_KITS["Jefferson"]!;
    for (const stage of ["thinking", "bossMove", "crowd"] as const) {
      expect(() => bossBeat(kit, { stage, fen, history, bases, crowdSide: "w", lastMove: null })).not.toThrow();
    }
  });
});
