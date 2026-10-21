import { describe, expect, it } from "vitest";
import { AUTOCHESS, mulberry32, type AutoChessSettings } from "@chessroyale/core";
import { bonusFor, botLocked, bothLocked, buyFreeze, freezeWords, noLocks, tickLocks, youLock } from "../src/autochess/lockin.ts";
import { botPlan } from "../src/autochess/bot.ts";
import { kingSquares } from "../src/autochess/army.ts";

/** Lock-in as it was (v5): off since v7, kept behind `lockIn` (Eric, Oct 21: "just remove the button keep the logic there, might wanna readd it later"). */
const ON: AutoChessSettings = { ...AUTOCHESS, lockIn: true };

describe("auto chess: lock in is off (v7), its code kept behind the `lockIn` setting", () => {
  it("is off, the bonus is still 25 gold, a setting", () => {
    expect(AUTOCHESS.lockIn).toBe(false);
    expect(AUTOCHESS.lockInBonus).toBe(25);
  });

  it("with it off nobody can lock and nobody gets a bonus, the bot's included, and the step runs its full time with only the last seconds locked", () => {
    // You can't lock (no button, and the function does nothing).
    expect(youLock(noLocks, 4000, 10)).toBe(noLocks);
    expect(youLock(noLocks, 4000, null)).toBe(noLocks);
    // The bot's time never comes: no bonus for it either.
    expect(botLocked(10, 99_999)).toBe(false);
    expect(tickLocks(noLocks, 29_000, 5)).toBe(noLocks);
    expect(bothLocked(noLocks, 29_000, 5)).toBe(false);
    // A bonus recorded in the state (an old one) pays nothing.
    expect(bonusFor({ you: 1, bonus: "you" }, "you")).toBe(0);
    expect(bonusFor({ you: null, bonus: "bot" }, "bot")).toBe(0);
    // The whole 30 s open but the last 3 (the last seconds still lock).
    expect(buyFreeze(noLocks, 0)).toBeNull();
    expect(buyFreeze(noLocks, 26_999)).toBeNull();
    expect(buyFreeze(noLocks, 27_000)).toBe("time");
    expect(AUTOCHESS.lockSeconds).toBe(3);
  });

  it("the bot never locks in (its plan has no lock-in time, whatever the seed) and its pieces go down over the whole open part of the step", () => {
    const open = AUTOCHESS.buySeconds - AUTOCHESS.lockSeconds - 1;
    let last = 0;
    for (let seed = 0; seed < 300; seed++) {
      const color = seed % 2 ? "w" : "b";
      const plan = botPlan(color, kingSquares(seed)[color], 100 + (seed % 5) * 30, 1 + (seed % 8), mulberry32(seed));
      expect(plan.lockAt, `seed ${seed}`).toBeNull();
      for (const e of plan.events) {
        expect(e.at).toBeLessThanOrEqual(open);
        last = Math.max(last, e.at);
      }
      // (With the lock-in on the same seed locks at a time or never; the draw is the same either way.)
      const on = botPlan(color, kingSquares(seed)[color], 100 + (seed % 5) * 30, 1 + (seed % 8), mulberry32(seed), ON);
      expect(on.army).toEqual(plan.army);
    }
    expect(last).toBeGreaterThan(open * 0.5);
  });
});

describe("auto chess: lock in (v5), switched on", () => {
  it("the bonus is 25 gold, a setting", () => {
    expect(ON.lockInBonus).toBe(25);
  });

  it("the first side to lock in gets the bonus, the other gets nothing", () => {
    // You first: the bot's time (10 s) hasn't come at 4 s.
    const first = youLock(noLocks, 4000, 10, ON);
    expect(first).toEqual({ you: 4000, bonus: "you" });
    expect(bonusFor(first, "you", ON)).toBe(25);
    expect(bonusFor(first, "bot", ON)).toBe(0);
    // The bot's time comes later: it doesn't take the bonus.
    expect(tickLocks(first, 10_000, 10, ON)).toBe(first);
    // The bot first: its time (5 s) is past when you lock at 6 s, even if the clock hadn't ticked it yet.
    const second = youLock(noLocks, 6000, 5, ON);
    expect(second.bonus).toBe("bot");
    expect(bonusFor(second, "you", ON)).toBe(0);
    expect(bonusFor(second, "bot", ON)).toBe(25);
    // The bot's time comes with nobody locked: it is first, and stays so when you lock after.
    const ticked = tickLocks(noLocks, 5000, 5, ON);
    expect(ticked).toEqual({ you: null, bonus: "bot" });
    expect(youLock(ticked, 9000, 5, ON).bonus).toBe("bot");
    // A bot that never locks (null): you get it, nobody else can.
    expect(tickLocks(noLocks, 29_000, null, ON)).toBe(noLocks);
    expect(youLock(noLocks, 29_000, null, ON).bonus).toBe("you");
    // Locking again changes nothing (no second bonus).
    expect(youLock(first, 8000, 10, ON)).toBe(first);
  });

  it("both locked ends the step at once; one locked doesn't", () => {
    const locks = youLock(noLocks, 4000, 10, ON);
    expect(bothLocked(locks, 5000, 10, ON)).toBe(false);
    expect(bothLocked(locks, 10_000, 10, ON)).toBe(true);
    expect(bothLocked(noLocks, 20_000, 10, ON)).toBe(false);
    expect(bothLocked(youLock(noLocks, 12_000, 10, ON), 12_000, 10, ON)).toBe(true);
    expect(bothLocked(locks, 28_000, null, ON)).toBe(false);
    expect(botLocked(10, 9999, ON)).toBe(false);
    expect(botLocked(10, 10_000, ON)).toBe(true);
    expect(botLocked(null, 99_999, ON)).toBe(false);
  });

  it("locking in freezes your buying (a bought, sold, moved or rerolled thing is refused with a reason); so do the step's last seconds", () => {
    expect(buyFreeze(noLocks, 0)).toBeNull();
    expect(buyFreeze(noLocks, 26_999)).toBeNull();
    expect(buyFreeze(noLocks, 27_000)).toBe("time");
    expect(buyFreeze(youLock(noLocks, 3000, null, ON), 3001)).toBe("locked_in");
    expect(freezeWords("locked_in")).toBe("You're locked in");
    expect(freezeWords("time")).toBe("Shop locked");
  });

  it("the bot locks at a seeded time in the open part of the step, or now and then never, and has finished placing by then", () => {
    const open = AUTOCHESS.buySeconds - AUTOCHESS.lockSeconds - 1;
    let never = 0;
    const times: number[] = [];
    for (let seed = 0; seed < 400; seed++) {
      const color = seed % 2 ? "w" : "b";
      const plan = botPlan(color, kingSquares(seed)[color], 100 + (seed % 5) * 30, 1 + (seed % 8), mulberry32(seed), ON);
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
    expect(botPlan("w", "e1", 100, 1, mulberry32(5), ON).lockAt).toBe(botPlan("w", "e1", 100, 1, mulberry32(5), ON).lockAt);
  });
});
