import { describe, expect, it } from "vitest";
import { BOSS_DIFFICULTY, BOSS_LEVEL, ENGINE_MAX_ELO, BOSS_ROSTER, bossLevelBase, bossLevelNow, bossRatingShown, bossDef, bossIdFromLink, bossInText, bossStrength, bossThreat, chooseBoss, crowdFinalBoss, isPlayable, playableBosses, type BossDef } from "../src/index.ts";

describe("the boss template: who can be met", () => {
  it("only a boss with a complete character and its powers is playable", () => {
    const base: BossDef = { id: "x", name: "X", icon: "x", kit: "X", offset: 0, powers: { passive: "freeze", ultimate: "blizzard" } };
    expect(isPlayable(base)).toBe(true);
    expect(isPlayable({ ...base, kit: null })).toBe(false);
    expect(isPlayable({ ...base, powers: null })).toBe(false);
    expect(isPlayable(null)).toBe(false);
    expect(playableBosses([base, { ...base, id: "y", kit: null }, { ...base, id: "z", powers: null }]).map((b) => b.id)).toEqual(["x"]);
  });

  it("today: Ginger (Freeze), Boingo the Clown, Jefferson (Fire), Hollow (Darkness), Big Boy (toy blocks, the Big Bounce), Sawyer (saw cuts, the board saw), Wrangler (the lasso drag, the showdown), Alfil (Tusks, the Mammoth Slam), Chub & Chirp (Leapfrog, the Carrot Patch), Smudgy (Camouflage, Repaint), Moo & Moon (Moonbeam, the Full Moon) and Puddles (Seeds, Watering)", () => {
    expect(playableBosses().map((b) => b.id).sort()).toEqual(["alfil", "bigboy", "clown", "gardener", "gingerbread", "grex", "hollow", "hopper", "moo", "pig", "sawyer", "smudgy"]);
    expect(BOSS_ROSTER.find((b) => b.id === "gardener")).toMatchObject({ name: "Puddles", icon: "🦛", kit: "Gardener", offset: -250, powers: { passive: "seeds", ultimate: "water" } });
    expect(BOSS_ROSTER.find((b) => b.id === "moo")).toMatchObject({ name: "Moo & Moon", icon: "🐄", kit: "Moo", offset: -240, powers: { passive: "moonbeam", ultimate: "fullmoon" } });
    expect(BOSS_ROSTER.find((b) => b.id === "smudgy")).toMatchObject({ name: "Smudgy", icon: "🦎", kit: "Smudgy", offset: 0, powers: { passive: "camouflage", ultimate: "repaint" } });
    expect(BOSS_ROSTER.find((b) => b.id === "hopper")).toMatchObject({ name: "Chub & Chirp", icon: "🐇", kit: "Chub & Chirp", offset: -250, powers: { passive: "leapfrog", ultimate: "carrotpatch" } });
    expect(BOSS_ROSTER.find((b) => b.id === "alfil")).toMatchObject({ name: "Alfil", icon: "🦣", kit: "Alfil", offset: -250, powers: { passive: "tusks", ultimate: "slam" } });
    expect(BOSS_ROSTER.find((b) => b.id === "pig")).toMatchObject({ name: "Wrangler", icon: "🤠", kit: "Wrangler", powers: { passive: "drag", ultimate: "showdown" } });
    expect(BOSS_ROSTER.find((b) => b.id === "sawyer")).toMatchObject({ name: "Sawyer", icon: "🪚", kit: "Sawyer", powers: { passive: "cuts", ultimate: "boardsaw" } });
    expect(BOSS_ROSTER.find((b) => b.id === "bigboy")).toMatchObject({ name: "Big Boy", icon: "🍭", kit: "Big Boy", powers: { passive: "blocks", ultimate: "bounce" } });
    expect(BOSS_ROSTER.find((b) => b.id === "hollow")).toMatchObject({ name: "Hollow", kit: "Hollow", offset: -100, powers: { passive: "dark", ultimate: "lightsout" } });
    expect(BOSS_ROSTER.find((b) => b.id === "grex")).toMatchObject({ name: "Jefferson", kit: "Jefferson", powers: { passive: "sparkler", ultimate: "candle" } });
    expect(BOSS_ROSTER.find((b) => b.id === "gingerbread")!.powers).toEqual({ passive: "freeze", ultimate: "blizzard" });
    expect(BOSS_ROSTER.find((b) => b.id === "clown")!.powers).toEqual({ passive: "pie", ultimate: "funhouse" });
  });

  it("the Crowd's boss final meets the roster's crowdFinal boss (the Hidden Boss, hidden from players elsewhere), if it has its character and powers; none marked: none (a random playable one)", () => {
    const base: BossDef = { id: "x", name: "X", icon: "x", kit: "X", offset: 0, powers: { passive: "freeze", ultimate: "blizzard" } };
    const hidden: BossDef = { ...base, id: "h", name: "H", adminOnly: true, crowdFinal: true };
    expect(crowdFinalBoss([base, hidden])).toBe(hidden);
    expect(crowdFinalBoss([base])).toBeNull();
    expect(crowdFinalBoss([base, { ...hidden, kit: null }])).toBeNull();
    expect(crowdFinalBoss([base, { ...hidden, powers: null }])).toBeNull();
    // Today: the Hidden Boss, by his roster name and icon (one place: renaming him is one edit).
    expect(crowdFinalBoss()).toMatchObject({ id: "recluse", name: "Hidden Boss", icon: "📕" });
    expect(isPlayable(crowdFinalBoss())).toBe(false);
  });

  it("Jefferson was G-REX (Eric, Oct 10): his id stays grex, and a test link's ?boss=jefferson meets him too", () => {
    for (const q of ["jefferson", "Jefferson", "grex"]) expect(bossIdFromLink(q)).toBe("grex");
    expect(bossDef(bossIdFromLink("jefferson"))?.name).toBe("Jefferson");
    expect(bossIdFromLink("hollow")).toBe("hollow");
    expect(bossIdFromLink("1600")).toBe("1600");
    expect(bossIdFromLink(null)).toBeNull();
    // (Only a link resolves the alias: a stored id stays the roster's own.)
    expect(bossDef("jefferson")).toBeNull();
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
    expect(seen).toEqual(new Set(["alfil", "bigboy", "clown", "gardener", "gingerbread", "grex", "hollow", "hopper", "moo", "pig", "sawyer", "smudgy"]));
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

describe("a boss's name in a sentence", () => {
  it("the Hidden Boss takes \"the\" (his roster's `the`); a name starting \"The \" keeps it, lower case mid-sentence; others as they are", () => {
    expect(bossInText("Hidden Boss")).toBe("the Hidden Boss");
    expect(bossInText("Hidden Boss", true)).toBe("The Hidden Boss");
    expect(bossInText("The Pawn Golem")).toBe("the Pawn Golem");
    expect(bossInText("The Pawn Golem", true)).toBe("The Pawn Golem");
    expect(bossInText("Ginger")).toBe("Ginger");
    expect(bossInText("Boingo the Clown", true)).toBe("Boingo the Clown");
    // Renamed without the flag: no article.
    expect(bossInText("Hidden Boss", false, BOSS_ROSTER.map(({ the: _, ...b }) => b))).toBe("Hidden Boss");
  });
});

describe("the level in a boss's bar (LVL 50)", () => {
  it("is the rating over 28 with a random offset of up to 10 either way: Normal's 1400 lands between 40 and 60, every number of the band comes up", () => {
    expect(BOSS_LEVEL).toMatchObject({ divisor: 28, spread: 10, max: 99 });
    const seen = new Set<number>();
    for (let seed = 1; seed <= 2000; seed++) seen.add(bossLevelBase(1400, seed * 7919));
    expect(Math.min(...seen)).toBe(40);
    expect(Math.max(...seen)).toBe(60);
    expect(seen.size).toBe(21);
    // (2000, Hard's neighbor, is 71 over 28: 61 to 81.)
    const high = new Set<number>();
    for (let seed = 1; seed <= 2000; seed++) high.add(bossLevelBase(2000, seed * 7919));
    expect([Math.min(...high), Math.max(...high)]).toEqual([61, 81]);
  });

  it("is the same for the same battle, wherever and whenever it's asked, and rolls again for another battle", () => {
    for (const seed of [0, 1, 12345, 2 ** 32 - 1]) expect(bossLevelBase(1400, seed)).toBe(bossLevelBase(1400, seed));
    const levels = new Set(Array.from({ length: 40 }, (_, i) => bossLevelBase(1400, 1000 + i)));
    expect(levels.size).toBeGreaterThan(8);
  });

  it("never goes under 1 or over 99 (100 is Fischer's)", () => {
    for (let seed = 1; seed <= 500; seed++) {
      expect(bossLevelBase(100, seed)).toBeGreaterThanOrEqual(1);
      expect(bossLevelBase(0, seed)).toBeGreaterThanOrEqual(1);
      expect(bossLevelBase(ENGINE_MAX_ELO, seed)).toBeLessThanOrEqual(99);
      expect(bossLevelBase(9999, seed)).toBe(99);
    }
    expect(bossLevelNow(95, 1400, ENGINE_MAX_ELO)).toBe(99);
    expect(bossLevelNow(3, 1400, 700)).toBe(1);
  });

  it("follows the strength he plays at now by the same divisor: the engine's top lifts it, a weakened move slashes it, equal ratings change nothing", () => {
    expect(bossLevelNow(50, 1400, 1400)).toBe(50);
    expect(bossLevelNow(50, 1400, ENGINE_MAX_ELO)).toBe(99);
    expect(bossLevelNow(40, 1400, 1400 + 280)).toBe(50);
    expect(bossLevelNow(50, 1400, 1400 - BOSS_LEVEL.weakDrop)).toBe(50 - BOSS_LEVEL.weakDrop / BOSS_LEVEL.divisor);
    expect(bossLevelNow(50, 1400, 1400 - BOSS_LEVEL.weakDrop)).toBeLessThan(50);
  });

  it("is made from Boss alone's Maia rating when there is one (the stage's 'Rating 1400'), else from his strength in the battle", () => {
    expect(bossRatingShown(2300, { bossAloneMaia: 1400 })).toBe(1400);
    expect(bossRatingShown(2300, { bossAloneMaia: 0 })).toBe(2300);
  });

  it("is unknown ('LVL ???') for the Hidden Boss, and for him alone", () => {
    expect(BOSS_ROSTER.filter((b) => b.levelUnknown).map((b) => b.id)).toEqual(["recluse"]);
  });
});
