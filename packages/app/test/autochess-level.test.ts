import { describe, expect, it } from "vitest";
import { AUTOCHESS, mulberry32 } from "@chessroyale/core";
import { addXp, buyXp, levelWords, startLevel, xpBlock, xpToNext, xpWords } from "../src/autochess/level.ts";
import { beginRound, newMatch, settleRound, type MatchState } from "../src/autochess/economy.ts";
import { buyBlock, buyOffer, emptyArmy, heldBlock, holdOffer, placeBlock, placeWords } from "../src/autochess/army.ts";
import { botBuys, botPlan } from "../src/autochess/bot.ts";
import { buyFromSlot, newShop, shopSeed } from "../src/autochess/shop.ts";
import type { Offer } from "../src/autochess/types.ts";

const offer = (kind: Offer["kind"], square: string): Offer => ({ kind, square });
const L = (level: number, xp = 0) => ({ level, xp });

describe("auto chess: levels (v6)", () => {
  it("hold the design's numbers: start at level 4, top 10, +2 XP free a round, 4 XP for 20 gold, 4, 8, 12, 16, 20, 24 to the next", () => {
    expect(AUTOCHESS.levels).toEqual({ start: 4, max: 10, freeXp: 2, buyXp: 4, buyXpCost: 20, xpToNext: [4, 8, 12, 16, 20, 24] });
    expect(startLevel()).toEqual({ level: 4, xp: 0 });
    expect([4, 5, 6, 7, 8, 9, 10].map((l) => xpToNext(l))).toEqual([4, 8, 12, 16, 20, 24, null]);
    // Every step from 4 to 10 has its number.
    expect(AUTOCHESS.levels.xpToNext).toHaveLength(AUTOCHESS.levels.max - AUTOCHESS.levels.start);
  });

  it("adds XP: a level at each threshold, the extra carrying over, several levels at once, and nothing past the top", () => {
    expect(addXp(L(4), 2)).toEqual(L(4, 2));
    expect(addXp(L(4, 2), 2)).toEqual(L(5, 0));
    expect(addXp(L(4, 3), 4)).toEqual(L(5, 3));
    // 4 + 8 = 12 XP from nothing is two levels.
    expect(addXp(L(4), 12)).toEqual(L(6, 0));
    expect(addXp(L(9, 20), 10)).toEqual(L(10, 0));
    // The top level holds no XP.
    expect(addXp(L(10), 50)).toEqual(L(10, 0));
    // The whole climb, 4 to 10, is 4 + 8 + 12 + 16 + 20 + 24 = 84 XP.
    expect(addXp(L(4), 83)).toEqual(L(9, 23));
    expect(addXp(L(4), 84)).toEqual(L(10, 0));
    // The numbers are settings.
    expect(addXp(L(4), 2, { ...AUTOCHESS, levels: { ...AUTOCHESS.levels, xpToNext: [2, 8, 12, 16, 20, 24] } })).toEqual(L(5, 0));
  });

  it("buys 4 XP for 20 gold, and says why not: the top level, or the gold", () => {
    expect(xpBlock(L(4), 20)).toBeNull();
    expect(xpBlock(L(4), 19)).toBe("gold");
    expect(xpBlock(L(10), 500)).toBe("max");
    expect(buyXp(L(4, 2), 50)).toEqual({ level: 5, xp: 2, gold: 30 });
    expect(buyXp(L(4), 20)).toEqual({ level: 5, xp: 0, gold: 0 });
    expect(xpWords("gold", 12)).toBe("Need 8 more");
    expect(xpWords("max", 99)).toBe("Top level (10)");
    expect(levelWords(L(4, 2))).toBe("Lv 4 · 2/4 XP");
    expect(levelWords(L(9, 23))).toBe("Lv 9 · 23/24 XP");
    expect(levelWords(L(10))).toBe("Lv 10 · max");
  });

  it("each round's start gives both sides 2 XP free (round 1 too): level 5 comes at round 2's start, with nothing bought", () => {
    let m: MatchState = newMatch(3);
    expect([m.you.level, m.you.xp, m.bot.level, m.bot.xp]).toEqual([4, 0, 4, 0]);
    m = beginRound(m).match;
    expect([m.you.level, m.you.xp, m.bot.level, m.bot.xp]).toEqual([4, 2, 4, 2]);
    m = beginRound(settleRound(m, "draw", { you: [], bot: [] }).match).match;
    expect([m.you.level, m.you.xp]).toEqual([5, 0]);
    // The level and the XP stay through a fight's settling.
    expect(settleRound(m, "you", { you: ["p"], bot: [] }).match.you).toMatchObject({ level: 5, xp: 0 });
    // From round 1 on, 2 a round: level 10 after 42 rounds of nothing else; each round's step is the setting's.
    let x = newMatch(1);
    for (let r = 0; r < 42; r++) x = beginRound(x).match;
    expect(x.you.level).toBe(10);
  });

  it("the level is how many pieces the board holds: a placement past it is refused with the level's words, a hold is not", () => {
    const four = Object.fromEntries(["a3", "b3", "c3", "d3"].map((sq) => [sq, "p" as const]));
    const army = { ...emptyArmy("w", "e1"), board: four };
    expect(buyBlock(army, 100, offer("n", "c1"), AUTOCHESS, 4)).toBe("limit");
    expect(buyBlock(army, 100, offer("n", "c1"), AUTOCHESS, 5)).toBeNull();
    expect(placeBlock(army, "n", "c1", undefined, AUTOCHESS, 4)).toBe("limit");
    expect(placeBlock(army, "n", "c1", "a3", AUTOCHESS, 4)).toBeNull();
    expect(placeWords("limit", AUTOCHESS, 4)).toBe("Board full: buy XP");
    // A held piece waits for room: refused at the limit, placed once the level allows.
    const held = holdOffer(army, offer("n", "c1"));
    expect(heldBlock(held, 0, AUTOCHESS, 4)).toBe("limit");
    expect(heldBlock(held, 0, AUTOCHESS, 5)).toBeNull();
    // Buying from a slot at the limit is refused too (and nothing is paid).
    const shop = { slots: [offer("n", "c1")], rerolls: 0, refills: 0 };
    expect(buyFromSlot({ army, gold: 100, shop }, 0, 1, AUTOCHESS, 4)).toEqual({ block: "limit" });
    expect(buyFromSlot({ army, gold: 100, shop }, 0, 1, AUTOCHESS, 5)).toMatchObject({ gold: 70 });
    void buyOffer;
    void newShop;
    void shopSeed;
  });

  it("the bot levels too: it buys XP now and then (20 gold for 4 XP), and its board never holds more than its level", () => {
    let withXp = 0;
    let levelUps = 0;
    for (let seed = 0; seed < 300; seed++) {
      const level = L(4, seed % 4);
      const { buys, army, level: after } = botBuys(emptyArmy("b", "e8"), 120 + (seed % 5) * 40, 1 + (seed % 6), mulberry32(seed), AUTOCHESS, level);
      const xp = buys.filter((b) => b.type === "xp");
      expect(xp.every((b) => b.price === AUTOCHESS.levels.buyXpCost && b.square === null)).toBe(true);
      expect(xp.length).toBeLessThanOrEqual(AUTOCHESS.bot.maxXpBuys);
      // Its level after what it bought is what it plays with: the board never holds more.
      expect(after).toEqual(addXp(level, xp.length * AUTOCHESS.levels.buyXp));
      expect(Object.keys(army.board).length).toBeLessThanOrEqual(after.level);
      expect(buys.reduce((sum, b) => sum + b.price, 0)).toBeLessThanOrEqual(120 + (seed % 5) * 40);
      if (xp.length) withXp++;
      if (after.level > level.level) levelUps++;
    }
    // "Now and then": some rounds, not most.
    expect(withXp).toBeGreaterThan(30);
    expect(withXp).toBeLessThan(220);
    expect(levelUps).toBeGreaterThan(5);
    // It never levels past the top, and never buys XP at the top.
    for (let seed = 0; seed < 50; seed++) {
      const { buys, level } = botBuys(emptyArmy("b", "e8"), 400, 6, mulberry32(seed), AUTOCHESS, L(10));
      expect(buys.filter((b) => b.type === "xp")).toHaveLength(0);
      expect(level).toEqual(L(10));
    }
    // The plan carries its level and XP out for the match.
    const plan = botPlan("b", "e8", 200, 3, mulberry32(5), AUTOCHESS, [], L(5, 2));
    expect(plan.level.level).toBeGreaterThanOrEqual(5);
    expect(Object.keys(plan.army.board).length).toBeLessThanOrEqual(plan.level.level);
  });
});
