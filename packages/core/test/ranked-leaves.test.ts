import { describe, expect, it } from "vitest";
import { LEAVES, delayFor, dodgeCost, dodgeLevelAt, dodgeLevels, isQuickResign, ladderAfterFee, leaveStanding, marksInWindow, type LeaveMark } from "../src/index.ts";

const H = 3_600_000;
const M = 60_000;

describe("dodge levels (LEAVES.dodgeDecayHours)", () => {
  it("each dodge raises the level by one", () => {
    expect(dodgeLevels([0, M, 2 * M, 3 * M, 4 * M, 5 * M])).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("drops by one every 12 hours without a dodge", () => {
    expect(dodgeLevelAt([0, M, 2 * M], 2 * M)).toBe(3);
    expect(dodgeLevelAt([0, M, 2 * M], 2 * M + 12 * H - 1)).toBe(3);
    expect(dodgeLevelAt([0, M, 2 * M], 2 * M + 12 * H)).toBe(2);
    expect(dodgeLevelAt([0, M, 2 * M], 2 * M + 36 * H)).toBe(0);
    expect(dodgeLevelAt([], 0)).toBe(0);
    // A dodge after a quiet day starts from the level left.
    expect(dodgeLevels([0, M, 2 * M, 2 * M + 24 * H])).toEqual([1, 2, 3, 2]);
    expect(dodgeLevels([0, 13 * H])).toEqual([1, 1]);
  });
});

describe("dodge costs (LEAVES.dodgeRp, dodgeLockoutMin)", () => {
  it("level 1: −5 and no lockout; level 2: −10 and 5 minutes; then 30, 120, 720 at most", () => {
    expect(dodgeCost(1)).toEqual({ rp: 5, lockoutMs: 0 });
    expect(dodgeCost(2)).toEqual({ rp: 10, lockoutMs: 5 * M });
    expect(dodgeCost(3)).toEqual({ rp: 10, lockoutMs: 30 * M });
    expect(dodgeCost(4)).toEqual({ rp: 10, lockoutMs: 120 * M });
    expect(dodgeCost(5)).toEqual({ rp: 10, lockoutMs: 720 * M });
    expect(dodgeCost(40)).toEqual({ rp: 10, lockoutMs: 720 * M });
  });
  it("a fee never takes a ladder below 0, and there's none in placements", () => {
    expect(ladderAfterFee(100, 10)).toBe(90);
    expect(ladderAfterFee(4, 10)).toBe(0);
    expect(ladderAfterFee(0, 5)).toBe(0);
    expect(ladderAfterFee(null, 10)).toBe(null);
  });
  it("a quick resign is before your 3rd move", () => {
    expect(isQuickResign(0)).toBe(true);
    expect(isQuickResign(2)).toBe(true);
    expect(isQuickResign(3)).toBe(false);
    expect(LEAVES.quickResignMoves).toBe(3);
  });
});

describe("the last-20 rule (LEAVES.window, delayed, lockAt)", () => {
  const dodge = (games: number, at = 0): LeaveMark => ({ kind: "dodge", at, games });
  const leave = (games: number, at = 0): LeaveMark => ({ kind: "leave", at, games });
  it("counts marks among the latest 20 ranked games and dodges", () => {
    expect(marksInWindow([], 50)).toBe(0);
    // A leave in the latest game, and one 19 games before it: both in.
    expect(marksInWindow([leave(50), leave(31)], 50)).toBe(2);
    // 20 games before the latest: out.
    expect(marksInWindow([leave(50), leave(30)], 50)).toBe(1);
  });
  it("dodges take a place in the window too (they're not games)", () => {
    // Three dodges in a row with no games: places 1, 2, 3.
    expect(marksInWindow([dodge(10), dodge(10), dodge(10)], 10)).toBe(3);
    // 18 games since a dodge, and one dodge after it: place 20, still in.
    expect(marksInWindow([dodge(28), dodge(10)], 28)).toBe(2);
    expect(marksInWindow([dodge(29), dodge(10)], 29)).toBe(1);
  });
  it("each clean game pushes the oldest mark out", () => {
    const marks = [leave(10), leave(9), leave(8)];
    expect(marksInWindow(marks, 10)).toBe(3);
    expect(marksInWindow(marks, 27)).toBe(3);
    expect(marksInWindow(marks, 28)).toBe(2);
    expect(marksInWindow(marks, 30)).toBe(0);
  });
  it("the delayed queue: nothing at 0-2, 2 minutes at 3-4, 5 minutes at 5 or more", () => {
    expect([0, 1, 2, 3, 4, 5, 7, 8].map((n) => delayFor(n))).toEqual([0, 0, 0, 120, 120, 300, 300, 300]);
  });
});

describe("leaveStanding", () => {
  const now = 1_000 * H;
  it("a clean record: nothing, and a dodge would cost 5", () => {
    expect(leaveStanding([], 12, now)).toEqual({ marks: 0, level: 0, lockedUntil: null, lock: null, delaySec: 0, nextDodge: { rp: 5, lockoutMin: 0 } });
  });
  it("a second dodge locks for 5 minutes from it", () => {
    const marks: LeaveMark[] = [
      { kind: "dodge", at: now - M, games: 3 },
      { kind: "dodge", at: now - 10 * M, games: 3 },
    ];
    const s = leaveStanding(marks, 3, now);
    expect(s.level).toBe(2);
    expect(s.lock).toBe("dodge");
    expect(s.lockedUntil).toBe(now - M + 5 * M);
    expect(s.nextDodge).toEqual({ rp: 10, lockoutMin: 30 });
    // After it: free again, the level still 2.
    expect(leaveStanding(marks, 3, now + 4 * M).lockedUntil).toBe(null);
  });
  it("8 marks in the window lock ranked for 24 hours from the latest; after it, the 5-minute delayed queue", () => {
    const marks: LeaveMark[] = Array.from({ length: 8 }, (_, i) => ({ kind: "leave" as const, at: now - i * H, games: 40 - i }));
    const s = leaveStanding(marks, 40, now);
    expect(s.marks).toBe(8);
    expect(s.lock).toBe("leaves");
    expect(s.lockedUntil).toBe(now + 24 * H);
    const later = leaveStanding(marks, 40, now + 24 * H);
    expect(later.lockedUntil).toBe(null);
    expect(later.delaySec).toBe(300);
  });
  it("3 leaves: the delayed queue, not a lockout", () => {
    const marks: LeaveMark[] = [0, 1, 2].map((i) => ({ kind: "leave" as const, at: now - i * H, games: 20 - i }));
    const s = leaveStanding(marks, 20, now);
    expect(s).toMatchObject({ marks: 3, lockedUntil: null, lock: null, delaySec: 120 });
  });
});
