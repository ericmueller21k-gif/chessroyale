import { describe, expect, it } from "vitest";
import { leaveStanding, type RankedLeaves } from "@chessroyale/core";
import { abortNote, leavesLine, leavesNote, rankedLockedUntil, resignNote, untilShown } from "../src/ranked.ts";

/** Ranked's leave rules on screen (L1): home's line and note, and the match menu's confirms, from the server's standing. */

const NOW = 1_800_000_000_000;
const M = 60_000;
const clean: RankedLeaves = { ...leaveStanding([], 10, NOW), dodged: null };

describe("home's line above PLAY (1 v 1)", () => {
  it("nothing on a clean record, or with the rules paused (no standing)", () => {
    expect(leavesLine(clean, NOW)).toBeNull();
    expect(leavesLine(null, NOW)).toBeNull();
  });
  it("a dodge's lockout counts down, then nothing", () => {
    const l: RankedLeaves = { ...clean, level: 2, lock: "dodge", lockedUntil: NOW + 4 * M + 31_000 };
    expect(leavesLine(l, NOW)).toBe("You left early: 1 v 1 opens in 4:31");
    expect(rankedLockedUntil(l, NOW)).toBe(NOW + 4 * M + 31_000);
    expect(leavesLine(l, NOW + 5 * M)).toBeNull();
    expect(rankedLockedUntil(l, NOW + 5 * M)).toBeNull();
  });
  it("too many leaves: the 24-hour lock in hours", () => {
    expect(leavesLine({ ...clean, marks: 8, lock: "leaves", lockedUntil: NOW + 24 * 60 * M }, NOW)).toBe("Too many leaves: 1 v 1 opens in 24:00:00");
  });
  it("the delayed queue: how many and the extra wait (PLAY stays: the wait starts with the search)", () => {
    const l: RankedLeaves = { ...clean, marks: 3, delaySec: 120 };
    expect(leavesLine(l, NOW)).toBe("3 leaves in your last 20: +2 min queue");
    expect(rankedLockedUntil(l, NOW)).toBeNull();
  });
  it("countdowns: m:ss under an hour, h:mm:ss from it, rounded up", () => {
    expect(untilShown(59_001)).toBe("1:00");
    expect(untilShown(3_600_000)).toBe("1:00:00");
    expect(untilShown(3_600_001)).toBe("1:00:01");
  });
});

describe("home's note", () => {
  it("after a dodge: what it cost (none in placements)", () => {
    expect(leavesNote({ ...clean, dodged: { at: NOW, rp: 5 } })).toBe("You left before the game started: −5 RP");
    expect(leavesNote({ ...clean, dodged: { at: NOW, rp: 0 } })).toBe("You left before the game started");
  });
  it("from 5 marks: finish games to clear it", () => {
    expect(leavesNote({ ...clean, marks: 5, delaySec: 300 })).toBe("Finish ranked games to clear your leaves.");
    expect(leavesNote({ ...clean, marks: 4, delaySec: 120 })).toBeNull();
  });
});

describe("the match menu's confirms in a ranked 1 v 1", () => {
  it("Abort: what a dodge now costs; with the rules paused (or a bot's game), as before", () => {
    expect(abortNote(clean)).toBe("The game is called off. Leaving before it starts costs 5 RP.");
    expect(abortNote({ ...clean, nextDodge: { rp: 10, lockoutMin: 30 } })).toBe("The game is called off. Leaving before it starts costs 10 RP and a 30-minute wait before your next 1 v 1.");
    expect(abortNote({ ...clean, nextDodge: { rp: 10, lockoutMin: 120 } })).toBe("The game is called off. Leaving before it starts costs 10 RP and a 2-hour wait before your next 1 v 1.");
    expect(abortNote({ ...clean, nextDodge: { rp: 0, lockoutMin: 5 } })).toBe("The game is called off. Leaving before it starts costs a 5-minute wait before your next 1 v 1.");
    expect(abortNote({ ...clean, nextDodge: { rp: 0, lockoutMin: 0 } })).toBe("The game is called off. Leaving before it starts goes on your record.");
    expect(abortNote(null)).toBe("The game is called off: no result, and no rank change.");
  });
  it("Resign: before your 3rd move, a leave; from it, a plain loss", () => {
    expect(resignNote(clean, 2, true)).toBe("It counts as a loss, and resigning this early costs 10 RP more.");
    expect(resignNote(clean, 0, false)).toBe("It counts as a loss, and resigning this early goes on your record.");
    expect(resignNote(clean, 3, true)).toBe("It counts as a loss.");
    expect(resignNote(null, 1, true)).toBe("It counts as a loss.");
  });
});
