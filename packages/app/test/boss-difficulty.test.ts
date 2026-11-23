import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, bossBrainFor } from "@chessroyale/core";
import { bossAloneElo, chosenDifficulty, difficultyElo, difficultyMaia, rememberDifficulty } from "../src/boss-difficulty.ts";

describe("solo's difficulty against a boss", () => {
  it("starts at Medium (normal), remembers the last choice, and gives its Elo on top of the boss's strength", () => {
    expect(chosenDifficulty()).toBe("normal");
    expect(difficultyElo()).toBe(0);
    rememberDifficulty("hardest");
    expect(chosenDifficulty()).toBe("hardest");
    expect(difficultyElo()).toBe(500);
    expect(difficultyElo("easy")).toBe(-300);
    expect(difficultyElo("hard")).toBe(250);
    // Anything else is ignored.
    rememberDifficulty("impossible" as never);
    expect(chosenDifficulty()).toBe("hardest");
  });

  it("in Boss alone sets the rating the boss picks its moves at, whatever your rating (Eric, Oct 18: Hardest was way too easy)", () => {
    expect(["very-easy", "easy", "normal", "hard", "hardest"].map((d) => difficultyMaia(d as never))).toEqual([700, 1150, 1600, 2050, 2500]);
    const hopper = BOSS_ROSTER.find((b) => b.id === "hopper")!;
    // (Shown as the boss's level, the same for a 900 and a 2000 player.)
    expect(bossAloneElo(900, hopper, "hardest")).toBe(2500);
    expect(bossAloneElo(2000, hopper, "easy")).toBe(1150);
    // The brain: the boss's own (Maia) at that rating, no bridge share, even where the strength alone would mean Stockfish.
    expect(bossBrainFor("hopper", 1830, "", true, { alone: 2200 })).toEqual({ brain: "maia-raw", rating: 2200, stockfishShare: 0 });
    expect(bossBrainFor("hopper", 3100, "", true, { alone: 1000 })).toEqual({ brain: "maia-raw", rating: 1000, stockfishShare: 0 });
    // Not with a crowd (a Solo raid's bots), not without Maia, not for the Hidden Boss (fixed); an admin's Stockfish pick stays.
    expect(bossBrainFor("hopper", 1830, "", true, { crowd: true, alone: 2200 }).rating).not.toBe(2200);
    expect(bossBrainFor("hopper", 1830, "", false, { alone: 2200 }).brain).toBe("stockfish");
    expect(bossBrainFor("recluse", 1830, "", true, { alone: 1000 }).rating).toBe(2500);
    expect(bossBrainFor("hopper", 1830, "stockfish", true, { alone: 2200 }).brain).toBe("stockfish");
  });
});
