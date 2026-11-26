import { describe, expect, it } from "vitest";
import { COIN_BOOST, LEVEL_CRATE_BONUS, XP } from "../src/settings.ts";
import { boostFor, boostLine, coinsPaid, crateBonusLine, questDrop } from "../src/coin-boost.ts";
import { coinStripView, readPlayCoins, type PlayCoins } from "../src/play-coins.ts";
import { readRewards, rewardDrops, rewardLines, xpGrant, type XpRewards } from "../src/xp.ts";

/**
 * The coin boost and the Crate Bonus (Nov 26; the payments design's section 7; COIN_BOOST, LEVEL_CRATE_BONUS; core's coin-boost.ts;
 * docs/decisions/2026-11-26-coin-boost.md): the drop's odds and its seed, the boost's share of a game, the lines.
 */
const hex = (n: number, seed: number) => {
  let s = "";
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    s += (x >>> 24).toString(16).padStart(2, "0");
  }
  return s.slice(0, n);
};

describe("the settings (the design's block)", () => {
  it("2.5x for 120 minutes, 4% a daily; the Crate Bonus 5 level-ups, 4% a daily", () => {
    expect(COIN_BOOST).toEqual({ multiplier: 2.5, minutes: 120, dropChance: 0.04 });
    expect(LEVEL_CRATE_BONUS).toEqual({ levels: 5, dropChance: 0.04 });
  });
});

describe("the drop: one roll a finished daily, from its completion op's key", () => {
  it("the same key rolls the same, every time", () => {
    for (let i = 0; i < 200; i++) {
      const key = `quest:warm-up:${hex(18, i)}:${hex(24, i + 7)}`;
      expect(questDrop(key)).toBe(questDrop(key));
    }
  });

  it("the odds: about 4% a Coin Boost Crate, 4% a Crate Bonus, 92% nothing (60,000 keys)", () => {
    const n = 60_000;
    const seen = { boost: 0, bonus: 0, none: 0 };
    for (let i = 0; i < n; i++) seen[questDrop(`quest:winner:${hex(18, i * 3 + 1)}:${hex(24, i * 5 + 2)}`) ?? "none"]++;
    // (Each within 0.4 points: about 5 standard errors at 4%.)
    expect(Math.abs(seen.boost / n - COIN_BOOST.dropChance)).toBeLessThan(0.004);
    expect(Math.abs(seen.bonus / n - LEVEL_CRATE_BONUS.dropChance)).toBeLessThan(0.004);
    expect(seen.none / n).toBeGreaterThan(0.9);
  });

  it("the chances come from the settings (0 never drops, 1 always does); the account's part of the key changes the roll", () => {
    const keys = Array.from({ length: 300 }, (_, i) => `quest:squad-up:${hex(18, i)}:${hex(24, i + 1)}`);
    expect(keys.every((k) => questDrop(k, 0, 0) === null)).toBe(true);
    expect(keys.every((k) => questDrop(k, 1, 0) === "boost")).toBe(true);
    expect(keys.every((k) => questDrop(k, 0, 1) === "bonus")).toBe(true);
    // (The same quest for two accounts: the rolls differ, so a quest's id alone, which the player sees, says nothing.)
    const differ = Array.from({ length: 300 }, (_, i) => {
      const q = hex(18, i);
      return questDrop(`quest:warm-up:${q}:${hex(24, 11)}`, 0.5, 0) !== questDrop(`quest:warm-up:${q}:${hex(24, 12)}`, 0.5, 0);
    }).filter(Boolean).length;
    expect(differ).toBeGreaterThan(100);
  });
});

describe("the boost's share of a game", () => {
  it("a whole game in the boost: its coins times 2.5 (the extra 1.5x, rounded), its minutes used", () => {
    // (A 30-minute win: 54 play coins and 15 bonus; 69 x 1.5 = 103.5.)
    expect(boostFor({ play: 54, bonus: 15 }, 30, 120)).toEqual({ coins: 104, minutes: 30 });
    expect(boostFor({ play: 27, bonus: 0 }, 15, 120)).toEqual({ coins: 41, minutes: 15 });
  });

  it("fewer minutes left than the game's: that share of it", () => {
    // (10 of 30 minutes: a third of 69 x 1.5 = 34.5.)
    expect(boostFor({ play: 54, bonus: 15 }, 30, 10)).toEqual({ coins: 35, minutes: 10 });
    expect(boostFor({ play: 54, bonus: 0 }, 30, 1)).toEqual({ coins: 3, minutes: 1 });
  });

  it("no boost minutes, or a game that paid no play coins (past the day's 300): nothing used, nothing added", () => {
    expect(boostFor({ play: 54, bonus: 15 }, 30, 0)).toEqual({ coins: 0, minutes: 0 });
    expect(boostFor({ play: 0, bonus: 15 }, 30, 120)).toEqual({ coins: 0, minutes: 0 });
    expect(boostFor({ play: 0, bonus: 0 }, 30, 120)).toEqual({ coins: 0, minutes: 0 });
  });

  it("a counted game under a minute (XP's minutes 0, its 1 play coin) uses one minute", () => {
    expect(boostFor({ play: 1, bonus: 15 }, 0, 120)).toEqual({ coins: 24, minutes: 1 });
  });

  it("the multiplier is one number: a boost of 240 minutes (two crates) pays the same per game as one of 120", () => {
    expect(boostFor({ play: 54, bonus: 15 }, 30, 240)).toEqual(boostFor({ play: 54, bonus: 15 }, 30, 120));
  });

  it("a whole boost over a day under the 300: about 120 minutes of play coins boosted (the design's ~420 with the bonus)", () => {
    // (Four 30-minute games, the average bonus of 8 a game: 4 x (54 + 8) x 1.5 = 372; with a win's 15 each, 414.)
    let left = COIN_BOOST.minutes;
    let extra = 0;
    for (let g = 0; g < 5; g++) {
      const b = boostFor({ play: 54, bonus: 15 }, 30, left);
      extra += b.coins;
      left -= b.minutes;
    }
    expect(left).toBe(0);
    expect(extra).toBe(416);
    expect(XP.maxMinutes).toBe(30);
  });
});

describe("what's shown", () => {
  it("the Crates tab's lines", () => {
    expect(boostLine(95)).toBe("Coin boost: x2.5 coins · 95 min of play left");
    expect(boostLine(0)).toBe("Coin boost: off");
    expect(crateBonusLine(4)).toBe("Crate bonus: 4 level-ups left");
    expect(crateBonusLine(1)).toBe("Crate bonus: 1 level-up left");
    expect(crateBonusLine(0)).toBe("Crate bonus: none");
  });

  it("the reward card's lines: a doubled level's crates say so; a daily's drop has its own line", () => {
    const r: XpRewards = { crate: "winter-1", daily: 0, crates: 2, keys: 1, bossPicks: 0, levels: [8], doubled: 1 };
    expect(rewardLines(r, "Winter Crate · Series 1").level).toBe("+2 Winter Crates (Crate bonus) · +1 crate key");
    expect(rewardLines({ ...r, crates: 1, doubled: undefined }, "Winter Crate · Series 1").level).toBe("+1 Winter Crate · +1 crate key");
    const q: XpRewards = {
      crate: "winter-1",
      daily: 0,
      crates: 0,
      keys: 0,
      bossPicks: 0,
      levels: [],
      quests: [
        { quest: "warm-up", name: "Warm Up", xp: 300, crates: 0, keys: 0, boost: 1 },
        { quest: "winner", name: "Winner", xp: 300, crates: 1, keys: 0, crateBonus: 5 },
      ],
    };
    const lines = rewardLines(q, "Winter Crate · Series 1");
    expect(lines.drops).toEqual(["+1 Coin Boost Crate: open it in Crates for 2.5x coins over 120 minutes of play", "Crate Bonus: your next 5 level-ups give double crates"]);
    expect(lines.quests).toEqual(["Quest done: Warm Up +300 XP", "Quest done: Winner +300 XP · +1 Winter Crate"]);
    expect(rewardDrops(q)).toEqual({ boost: 1, bonus: 5 });
    expect(rewardDrops(r)).toEqual({ boost: 0, bonus: 0 });
  });

  it("the coin strip: a boosted game's total has the extra, its last part \"Boost\", its badge x2.5 and the minutes left; unboosted, no badge", () => {
    const c: PlayCoins = { play: 54, bonus: 15, parts: [{ label: "Win", coins: 15 }], step: 0, today: { play: 54, bonus: 15 }, boost: { coins: 104, minutes: 30, left: 90 } };
    const v = coinStripView({ ...xpGrant(0, [{ label: "Win", xp: 50 }]), coins: c });
    expect(v).toEqual({
      total: 173,
      parts: [
        { label: "Play", coins: 54 },
        { label: "Win", coins: 15 },
        { label: "Boost", coins: 104 },
      ],
      today: "PLAY TODAY 54/300",
      why: null,
      boost: { times: "x2.5", left: 90 },
    });
    const { boost: _, ...plain } = c;
    const p = coinStripView({ ...xpGrant(0, [{ label: "Win", xp: 50 }]), coins: plain });
    expect(p.total).toBe(69);
    expect(p).not.toHaveProperty("boost");
  });

  it("stored and read back: a reward's drops and doubled crates, a game's boost (absent when there was none)", () => {
    const r: XpRewards = { crate: "winter-1", daily: 0, crates: 2, keys: 1, bossPicks: 0, levels: [8], doubled: 1, quests: [{ quest: "warm-up", name: "Warm Up", xp: 300, crates: 0, keys: 0, boost: 1 }] };
    expect(readRewards(JSON.stringify(r))).toEqual(r);
    const plain: XpRewards = { crate: "winter-1", daily: 1, crates: 0, keys: 0, bossPicks: 0, levels: [] };
    expect(readRewards(JSON.stringify(plain))).toEqual(plain);
    const c: PlayCoins = { play: 54, bonus: 15, parts: [{ label: "Win", coins: 15 }], step: 0, today: { play: 54, bonus: 15 }, boost: { coins: 104, minutes: 30, left: 90 } };
    expect(readPlayCoins(JSON.stringify(c))).toEqual(c);
    const { boost: _, ...unboosted } = c;
    expect(readPlayCoins(JSON.stringify(unboosted))).toEqual(unboosted);
    expect(readPlayCoins(JSON.stringify({ ...unboosted, boost: { coins: 0, minutes: 3, left: 4 } }))).toEqual(unboosted);
    expect(coinsPaid(c)).toBe(173);
    expect(coinsPaid(unboosted)).toBe(69);
    expect(coinsPaid(undefined)).toBe(0);
  });
});
