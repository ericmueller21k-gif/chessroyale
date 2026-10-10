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

  it("today: Ginger (Freeze), Boingo the Clown, G-REX (Fire), Hollow (Darkness), Big Boy (toy blocks, the Big Bounce) and Sawyer (saw cuts, the board saw)", () => {
    expect(playableBosses().map((b) => b.id).sort()).toEqual(["bigboy", "clown", "gingerbread", "grex", "hollow", "sawyer"]);
    expect(BOSS_ROSTER.find((b) => b.id === "sawyer")).toMatchObject({ name: "Sawyer", icon: "🪚", kit: "Sawyer", powers: { passive: "cuts", ultimate: "boardsaw" } });
    expect(BOSS_ROSTER.find((b) => b.id === "bigboy")).toMatchObject({ name: "Big Boy", icon: "🍭", kit: "Big Boy", powers: { passive: "blocks", ultimate: "bounce" } });
    expect(BOSS_ROSTER.find((b) => b.id === "hollow")).toMatchObject({ name: "Hollow", kit: "Hollow", offset: -100, powers: { passive: "dark", ultimate: "lightsout" } });
    expect(BOSS_ROSTER.find((b) => b.id === "grex")!.powers).toEqual({ passive: "sparkler", ultimate: "candle" });
    expect(BOSS_ROSTER.find((b) => b.id === "gingerbread")!.powers).toEqual({ passive: "freeze", ultimate: "blizzard" });
    expect(BOSS_ROSTER.find((b) => b.id === "clown")!.powers).toEqual({ passive: "pie", ultimate: "funhouse" });
  });

  it("chooses only playable bosses: a picked one if playable, else at random, never the one to avoid when there's another", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const b = chooseBoss(i / 100);
      expect(isPlayable(b)).toBe(true);
      seen.add(b.id);
      expect(chooseBoss(i / 100, null, "clown").id).not.toBe("clown");
      expect(chooseBoss(i / 100, null, "gingerbread").id).not.toBe("gingerbread");
      // A picked boss that isn't playable is never met.
      expect(isPlayable(chooseBoss(i / 100, "golem"))).toBe(true);
    }
    expect(seen).toEqual(new Set(["bigboy", "clown", "gingerbread", "grex", "hollow", "sawyer"]));
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
    // Testing, solo only: a boss whose powers are built before its art (?wip=1); never otherwise, never one without powers.
    const wip: BossDef[] = [{ id: "a", name: "A", icon: "a", kit: "A", offset: 0, powers: { passive: "pie", ultimate: "funhouse" } }, { id: "b", name: "B", icon: "b", kit: null, offset: 0, powers: { passive: "freeze", ultimate: "blizzard" } }, { id: "c", name: "C", icon: "c", kit: null, offset: 0, powers: null }];
    expect(chooseBoss(0.5, "b", null, wip).id).toBe("a");
    expect(chooseBoss(0.5, "b", null, wip, true).id).toBe("b");
    expect(chooseBoss(0.5, "c", null, wip, true).id).toBe("a");
  });
});
