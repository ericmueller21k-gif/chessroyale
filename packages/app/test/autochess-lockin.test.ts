import { describe, expect, it } from "vitest";
import { AUTOCHESS, mulberry32 } from "@chessroyale/core";
import { bonusFor, botLocked, bothLocked, buyFreeze, freezeWords, noLocks, tickLocks, youLock } from "../src/autochess/lockin.ts";
import { botPlan } from "../src/autochess/bot.ts";
import { kingSquares } from "../src/autochess/army.ts";

describe("auto chess: lock in (v5)", () => {
  it("the bonus is 25 gold, a setting", () => {
    expect(AUTOCHESS.lockInBonus).toBe(25);
  });

  it("the first side to lock in gets the bonus, the other gets nothing", () => {
    // You first: the bot's time (10 s) hasn't come at 4 s.
    const first = youLock(noLocks, 4000, 10);
    expect(first).toEqual({ you: 4000, bonus: "you" });
    expect(bonusFor(first, "you")).toBe(25);
    expect(bonusFor(first, "bot")).toBe(0);
    // The bot's time comes later: it doesn't take the bonus.
    expect(tickLocks(first, 10_000, 10)).toBe(first);
    // The bot first: its time (5 s) is past when you lock at 6 s, even if the clock hadn't ticked it yet.
    const second = youLock(noLocks, 6000, 5);
    expect(second.bonus).toBe("bot");
    expect(bonusFor(second, "you")).toBe(0);
    expect(bonusFor(second, "bot")).toBe(25);
    // The bot's time comes with nobody locked: it is first, and stays so when you lock after.
    const ticked = tickLocks(noLocks, 5000, 5);
    expect(ticked).toEqual({ you: null, bonus: "bot" });
    expect(youLock(ticked, 9000, 5).bonus).toBe("bot");
    // A bot that never locks (null): you get it, nobody else can.
    expect(tickLocks(noLocks, 29_000, null)).toBe(noLocks);
    expect(youLock(noLocks, 29_000, null).bonus).toBe("you");
    // Locking again changes nothing (no second bonus).
    expect(youLock(first, 8000, 10)).toBe(first);
  });

  it("both locked ends the step at once; one locked doesn't", () => {
    const locks = youLock(noLocks, 4000, 10);
    expect(bothLocked(locks, 5000, 10)).toBe(false);
    expect(bothLocked(locks, 10_000, 10)).toBe(true);
    expect(bothLocked(noLocks, 20_000, 10)).toBe(false);
    expect(bothLocked(youLock(noLocks, 12_000, 10), 12_000, 10)).toBe(true);
    expect(bothLocked(locks, 28_000, null)).toBe(false);
    expect(botLocked(10, 9999)).toBe(false);
    expect(botLocked(10, 10_000)).toBe(true);
    expect(botLocked(null, 99_999)).toBe(false);
  });

  it("locking in freezes your buying (a bought, sold, moved or rerolled thing is refused with a reason); so do the step's last seconds", () => {
    expect(buyFreeze(noLocks, 0)).toBeNull();
    expect(buyFreeze(noLocks, 26_999)).toBeNull();
    expect(buyFreeze(noLocks, 27_000)).toBe("time");
    expect(buyFreeze(youLock(noLocks, 3000, null), 3001)).toBe("locked_in");
    expect(freezeWords("locked_in")).toBe("You're locked in: your board, bench and shop are frozen.");
    expect(freezeWords("time")).toBe("Locked: no buying, selling or moving.");
  });

  it("the bot locks at a seeded time in the open part of the step, or now and then never, and has finished placing by then", () => {
    const open = AUTOCHESS.buySeconds - AUTOCHESS.lockSeconds - 1;
    let never = 0;
    const times: number[] = [];
    for (let seed = 0; seed < 400; seed++) {
      const color = seed % 2 ? "w" : "b";
      const plan = botPlan(color, kingSquares(seed)[color], 100 + (seed % 5) * 30, 1 + (seed % 8), mulberry32(seed));
      if (plan.lockAt === null) {
        never++;
        continue;
      }
      times.push(plan.lockAt);
      expect(plan.lockAt).toBeGreaterThanOrEqual(open * AUTOCHESS.bot.lockFrom);
      expect(plan.lockAt).toBeLessThanOrEqual(open * AUTOCHESS.bot.lockTo);
      for (const e of plan.events) expect(e.at).toBeLessThan(plan.lockAt);
    }
    // "Now and then": about 15%.
    expect(never).toBeGreaterThan(30);
    expect(never).toBeLessThan(100);
    // Spread over the open part, not one time.
    expect(Math.max(...times) - Math.min(...times)).toBeGreaterThan(open * 0.4);
    // Seeded: the same seed, the same time.
    expect(botPlan("w", "e1", 100, 1, mulberry32(5)).lockAt).toBe(botPlan("w", "e1", 100, 1, mulberry32(5)).lockAt);
  });
});
