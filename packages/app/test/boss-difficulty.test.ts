import { describe, expect, it } from "vitest";
import { chosenDifficulty, difficultyElo, rememberDifficulty } from "../src/boss-difficulty.ts";

describe("solo's difficulty against a boss", () => {
  it("starts at Normal, remembers the last choice, and gives its Elo on top of the boss's strength", () => {
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
});
