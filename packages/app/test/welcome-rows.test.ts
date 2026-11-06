import { describe, expect, it } from "vitest";
import { welcomeResumeRow, welcomeRows, type WelcomeRide } from "../src/welcome-rows.ts";

/**
 * The two Welcome Crate rows (Eric, Nov 6: "1 out of 5 … 1 out of 25 unlock tracker"): both always there, each with its own meter and
 * state, read from the locker's welcome (games, next, unopened, item). The server grants and opens; these rows only show it.
 */

const R1: WelcomeRide = { id: "item-1", def: "balloon-pup-hunchess" };
const R2: WelcomeRide = { id: "item-2", def: "flame-hunchess" };

describe("the Welcome Crate rows (Nov 6)", () => {
  it("both show from the start, locked, at 0 games: 0/5 and 0/25, 'Finish N games to unlock'", () => {
    const rows = welcomeRows({ games: 0, next: 5, unopened: 0, status: "locked" }, true);
    expect(rows.map((r) => [r.n, r.milestone, r.state, r.meter, r.line])).toEqual([
      [1, 5, "locked", "0/5", "Finish 5 games to unlock"],
      [2, 25, "locked", "0/25", "Finish 25 games to unlock"],
    ]);
    expect(rows.map((r) => r.fill)).toEqual([0, 0]);
  });

  it("a guest's are both locked, 'Sign in to earn', whatever the games (the server never grants a guest)", () => {
    const rows = welcomeRows({ games: 3, next: null, unopened: 2, status: "ready" }, false, [R1]);
    expect(rows.map((r) => [r.state, r.meter, r.line])).toEqual([
      ["locked", "3/5", "Sign in to earn"],
      ["locked", "3/25", "Sign in to earn"],
    ]);
    expect(rows.every((r) => !r.ride)).toBe(true);
  });

  it("the meters count the finished games up to each milestone: 4 of 5, and 4 of 25", () => {
    const rows = welcomeRows({ games: 4, next: 5, unopened: 0, status: "locked" }, true);
    expect(rows.map((r) => r.meter)).toEqual(["4/5", "4/25"]);
    expect(rows[0]!.fill).toBeCloseTo(0.8);
  });

  it("at 5 games: crate 1 is ready (a full bar, 'Ready'), crate 2 shows 5/25", () => {
    const rows = welcomeRows({ games: 5, next: 25, unopened: 1, status: "ready" }, true);
    expect(rows.map((r) => [r.state, r.meter, r.line, r.fill])).toEqual([
      ["ready", "5/5", "Ready", 1],
      ["locked", "5/25", "Finish 25 games to unlock", 0.2],
    ]);
  });

  it("opened 1: crate 1 'Opened' with the ride it gave, crate 2 still locked", () => {
    const rows = welcomeRows({ games: 6, next: 25, unopened: 0, status: "opened", item: R1.id }, true, [R1]);
    expect(rows.map((r) => [r.state, r.line, r.ride])).toEqual([
      ["opened", "Opened", R1],
      ["locked", "Finish 25 games to unlock", undefined],
    ]);
    expect(rows[1]!.meter).toBe("6/25");
  });

  it("at 25 games with crate 1 opened: crate 2 ready, its bar full at 25/25", () => {
    const rows = welcomeRows({ games: 25, next: null, unopened: 1, status: "ready", item: R1.id }, true, [R1]);
    expect(rows.map((r) => [r.state, r.meter, r.ride])).toEqual([
      ["opened", "5/5", R1],
      ["ready", "25/25", undefined],
    ]);
    expect(rows[1]!.fill).toBe(1);
  });

  it("both opened: each its own ride (crate 2's is the latest, the locker's item; crate 1's the other)", () => {
    const rows = welcomeRows({ games: 30, next: null, unopened: 0, status: "opened", item: R2.id }, true, [R1, R2]);
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
