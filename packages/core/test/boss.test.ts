import { describe, expect, it } from "vitest";
import { BOSS_DIFFICULTY, ENGINE_MAX_ELO, BOSS_ROSTER, bossStrength, bossThreat, chooseBoss, isPlayable, playableBosses, type BossDef } from "../src/index.ts";

describe("the boss template: who can be met", () => {
  it("only a boss with a complete character and its powers is playable", () => {
    const base: BossDef = { id: "x", name: "X", icon: "x", kit: "X", offset: 0, powers: { passive: "freeze", ultimate: "blizzard" } };
    expect(isPlayable(base)).toBe(true);
    expect(isPlayable({ ...base, kit: null })).toBe(false);
    expect(isPlayable({ ...base, powers: null })).toBe(false);
    expect(isPlayable(null)).toBe(false);
    expect(playableBosses([base, { ...base, id: "y", kit: null }, { ...base, id: "z", powers: null }]).map((b) => b.id)).toEqual(["x"]);
  });

  it("today: the gingerbread man (Freeze) and Boingo the Clown", () => {
    expect(playableBosses().map((b) => b.id).sort()).toEqual(["clown", "gingerbread"]);
    expect(BOSS_ROSTER.find((b) => b.id === "gingerbread")!.powers).toEqual({ passive: "freeze", ultimate: "blizzard" });
    expect(BOSS_ROSTER.find((b) => b.id === "clown")!.powers).toEqual({ passive: "pie", ultimate: "funhouse" });
  });

  it("chooses only playable bosses: a picked one if playable, else at random, never the one to avoid when there's another", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const b = chooseBoss(i / 100);
      expect(isPlayable(b)).toBe(true);
      seen.add(b.id);
      expect(chooseBoss(i / 100, null, "clown").id).toBe("gingerbread");
      expect(chooseBoss(i / 100, null, "gingerbread").id).toBe("clown");
      // A picked boss that isn't playable is never met.
      expect(isPlayable(chooseBoss(i / 100, "golem"))).toBe(true);
    }
    expect(seen).toEqual(new Set(["clown", "gingerbread"]));
    expect(chooseBoss(0.99, "clown", "clown").id).toBe("clown");
    // With one playable boss, it's met even if it was the last one.
    const one: BossDef[] = [{ id: "a", name: "A", icon: "a", kit: "A", offset: 0, powers: { passive: "pie", ultimate: "funhouse" } }];
    expect(chooseBoss(0.5, null, "a", one).id).toBe("a");
  });

  it("plays at the lobby's strength plus its offset; the skulls follow the strength", () => {
    expect(bossStrength(1600, { offset: -100 })).toBe(1500);
    expect(bossStrength(3190, { offset: 200 })).toBe(3190);
    expect([1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3190].map(bossThreat)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it("solo's difficulty: Easy −300, Normal your strength, Hard +250, Hardest +500, never past the engine's strongest", () => {
    expect(BOSS_DIFFICULTY.map((d) => [d.id, d.elo])).toEqual([["easy", -300], ["normal", 0], ["hard", 250], ["hardest", 500]]);
    const at = (base: number, id: string) => bossStrength(base, { offset: -100 }, BOSS_DIFFICULTY.find((d) => d.id === id)!.elo);
    expect([at(1600, "easy"), at(1600, "normal"), at(1600, "hard"), at(1600, "hardest")]).toEqual([1200, 1500, 1750, 2000]);
    expect(at(3000, "hardest")).toBe(ENGINE_MAX_ELO);
    expect(at(1000, "easy")).toBe(800);
    // A test trigger, solo only: a boss whose powers are built before its art (?wip=1); never otherwise.
    expect(chooseBoss(0.5, "grex").id).not.toBe("grex");
    expect(chooseBoss(0.5, "grex", null, undefined, true).id).toBe("grex");
    expect(chooseBoss(0.5, "golem", null, undefined, true).id).not.toBe("golem");
  });
});
