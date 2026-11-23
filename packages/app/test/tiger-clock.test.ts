import { describe, expect, it } from "vitest";
import { BOSS_POWERS } from "@chessroyale/core";
import { balloonStage } from "@chessroyale/chess";
import { visibleClock } from "../src/garden-clock.ts";

/**
 * The circus tiger's balloons solo and in Boss alone (docs/decisions/2026-10-23-tiger-rules.md): they blow up on the same
 * clock as Puddles' seeds, the page's time counting only while it's in view (solo.ts hands the runner `gardenClock` for every
 * boss), so a player who walks away comes back to the balloon at the stage it had.
 */
describe("the circus tiger's balloon on the page's clock", () => {
  it("stands still while the page is hidden: its stage and readiness count only the time in view", () => {
    let t = 0;
    let hidden = false;
    let change = () => {};
    const clock = visibleClock(
      () => t,
      () => hidden,
      (fn) => (change = fn),
    );
    const stage = BOSS_POWERS.balloonStageSec * 1000;
    t = 10_000;
    const balloon = { at: clock(), readyAt: clock() + BOSS_POWERS.balloonStages * stage };
    t += stage + 1_000;
    expect(balloonStage(balloon, clock())).toEqual({ stage: 2, ready: false });
    hidden = true;
    change();
    t += 3_600_000;
    expect(balloonStage(balloon, clock())).toEqual({ stage: 2, ready: false });
    hidden = false;
    change();
    t += stage;
    expect(balloonStage(balloon, clock())).toEqual({ stage: 3, ready: false });
    t += 2 * stage;
    expect(balloonStage(balloon, clock())).toEqual({ stage: 4, ready: true });
  });
});
