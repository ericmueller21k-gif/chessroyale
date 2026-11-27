import { describe, expect, it } from "vitest";
import { welcomeResumeRow, welcomeRows, welcomeRowsShown, type WelcomeRide } from "../src/welcome-rows.ts";

/**
 * The two Welcome Crate rows (Eric, Nov 6: "1 out of 5 … 1 out of 25 unlock tracker"): both always there, each with its own meter and
 * state, read from the locker's welcome (games, next, unopened, item). The server grants and opens; these rows only show it.
 */

const R1: WelcomeRide = { id: "item-1", def: "balloon-pup-hunchess" };
const R2: WelcomeRide = { id: "item-2", def: "flame-hunchess" };

describe("the Welcome Crate rows (Nov 6; the first given on the first visit and opening at level 5 since Nov 27)", () => {
  it("before the first visit's grant: crate 1's meter is your level ('Level 1/5', 'Given on your first visit'), crate 2's your games", () => {
    const rows = welcomeRows({ games: 0, next: 5, unopened: 0, status: "locked" }, true);
    expect(rows.map((r) => [r.n, r.milestone, r.state, r.canOpen, r.meter, r.line])).toEqual([
      [1, 5, "locked", false, "Level 1/5", "Given on your first visit"],
      [2, 25, "locked", false, "0/25", "Finish 25 games to unlock"],
    ]);
    expect(rows.map((r) => r.fill)).toEqual([0.2, 0]);
  });

  it("a guest's are both locked, 'Sign in to get it' and 'Sign in to earn', whatever the games (the server never grants a guest)", () => {
    const rows = welcomeRows({ games: 3, next: null, unopened: 2, status: "ready" }, false, [R1], 7);
    expect(rows.map((r) => [r.state, r.canOpen, r.meter, r.line])).toEqual([
      ["locked", false, "Level 5/5", "Sign in to get it"],
      ["locked", false, "3/25", "Sign in to earn"],
    ]);
    expect(rows.every((r) => !r.ride)).toBe(true);
  });

  it("given, below level 5: crate 1 is held (ready) but can't open: 'Reach level 5 to open', its meter your level", () => {
    for (const [level, meter, fill] of [
      [1, "Level 1/5", 0.2],
      [4, "Level 4/5", 0.8],
    ] as const) {
      const rows = welcomeRows({ games: 4, next: 25, unopened: 1, status: "ready" }, true, [], level);
      expect(rows.map((r) => [r.state, r.canOpen, r.meter, r.line])).toEqual([
        ["ready", false, meter, "Reach level 5 to open"],
        ["locked", false, "4/25", "Finish 25 games to unlock"],
      ]);
      expect(rows[0]!.fill).toBeCloseTo(fill);
    }
  });

  it("at level 5: crate 1 opens (a full bar, 'Ready'); crate 2 shows its games", () => {
    for (const level of [5, 12]) {
      const rows = welcomeRows({ games: 5, next: 25, unopened: 1, status: "ready" }, true, [], level);
      expect(rows.map((r) => [r.state, r.canOpen, r.meter, r.line, r.fill])).toEqual([
        ["ready", true, "Level 5/5", "Ready", 1],
        ["locked", false, "5/25", "Finish 25 games to unlock", 0.2],
      ]);
    }
  });

  it("opened 1: crate 1 'Opened' with the ride it gave, crate 2 still locked", () => {
    const rows = welcomeRows({ games: 6, next: 25, unopened: 0, status: "opened", item: R1.id }, true, [R1], 6);
    expect(rows.map((r) => [r.state, r.line, r.ride])).toEqual([
      ["opened", "Opened", R1],
      ["locked", "Finish 25 games to unlock", undefined],
    ]);
    expect(rows[1]!.meter).toBe("6/25");
  });

  it("at 25 games with crate 1 opened: crate 2 ready, its bar full at 25/25; below level 5 it waits too (the server's rule covers both)", () => {
    const rows = welcomeRows({ games: 25, next: null, unopened: 1, status: "ready", item: R1.id }, true, [R1], 9);
    expect(rows.map((r) => [r.state, r.canOpen, r.meter, r.ride])).toEqual([
      ["opened", false, "Level 5/5", R1],
      ["ready", true, "25/25", undefined],
    ]);
    expect(rows[1]!.fill).toBe(1);
    expect(welcomeRows({ games: 25, next: null, unopened: 1, status: "ready", item: R1.id }, true, [R1], 4)[1]).toMatchObject({ canOpen: false, line: "Reach level 5 to open" });
  });

  it("both opened: each its own ride (crate 2's is the latest, the locker's item; crate 1's the other)", () => {
    const rows = welcomeRows({ games: 30, next: null, unopened: 0, status: "opened", item: R2.id }, true, [R1, R2], 9);
    expect(rows.map((r) => [r.state, r.line, r.ride])).toEqual([
      ["opened", "Opened", R1],
      ["opened", "Opened", R2],
    ]);
  });

  it("an older server's welcome with no `next`: the first row ready when one waits", () => {
    const rows = welcomeRows({ games: 5, status: "ready" }, true);
    expect(rows.map((r) => r.state)).toEqual(["ready", "locked"]);
  });

  it("resumes an unseen reveal on the ready row, else the latest opened", () => {
    expect(welcomeResumeRow(welcomeRows({ games: 5, next: 25, unopened: 1, status: "ready" }, true))).toBe(1);
    expect(welcomeResumeRow(welcomeRows({ games: 30, next: null, unopened: 0, status: "opened", item: R2.id }, true, [R1, R2]))).toBe(2);
    expect(welcomeResumeRow(welcomeRows({ games: 0, next: 5, unopened: 0, status: "locked" }, true))).toBe(1);
  });
});

describe("the Welcome Crate rows the Crates tab lists (Eric, Nov 25: used ones gone)", () => {
  it("given, below level 5: both show (crate 1 held with its padlock, crate 2 with its meter)", () => {
    const rows = welcomeRows({ games: 2, next: 5, unopened: 0, status: "locked" }, true);
    expect(welcomeRowsShown(rows).map((r) => r.n)).toEqual([1, 2]);
  });

  it("crate 1 fully opened and seen: only crate 2 (still Welcome Crate 2)", () => {
    const rows = welcomeRows({ games: 6, next: 25, unopened: 0, status: "opened", item: R1.id }, true, [R1]);
    expect(welcomeRowsShown(rows).map((r) => [r.n, r.state])).toEqual([[2, "locked"]]);
  });

  it("crate 1 opened but its reveal not seen yet: it stays until it is", () => {
    const rows = welcomeRows({ games: 6, next: 25, unopened: 0, status: "opened", item: R1.id }, true, [R1]);
    expect(welcomeRowsShown(rows, welcomeResumeRow(rows)).map((r) => r.n)).toEqual([1, 2]);
  });

  it("crate 1 opened, crate 2 ready: only crate 2", () => {
    const rows = welcomeRows({ games: 25, next: null, unopened: 1, status: "ready", item: R1.id }, true, [R1]);
    expect(welcomeRowsShown(rows).map((r) => [r.n, r.state])).toEqual([[2, "ready"]]);
  });

  it("both opened and seen: none", () => {
    const rows = welcomeRows({ games: 30, next: null, unopened: 0, status: "opened", item: R2.id }, true, [R1, R2]);
    expect(welcomeRowsShown(rows)).toEqual([]);
  });

  it("a guest's both show (locked: 'Sign in to get it', 'Sign in to earn')", () => {
    expect(welcomeRowsShown(welcomeRows({ games: 0 }, false)).map((r) => r.n)).toEqual([1, 2]);
  });
});
