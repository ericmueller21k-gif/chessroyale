import { describe, expect, it } from "vitest";
import { BOSS_POWERS } from "@chessroyale/core";
import { seedsAt } from "@chessroyale/chess";
import { visibleClock } from "../src/garden-clock.ts";

/**
 * The hippo gardener's seed clock solo and in Boss alone (docs/decisions/2026-10-21-gardener-rules.md): the device's
 * time, counting only while the page is in view, so a player who walks away doesn't feed him seeds.
 */
describe("the garden clock", () => {
  function page(hiddenAtStart = false) {
    let t = 0;
    let hidden = hiddenAtStart;
    let change = () => {};
    const clock = visibleClock(
      () => t,
      () => hidden,
      (fn) => (change = fn),
    );
    return {
      clock,
      pass: (ms: number) => (t += ms),
      hide: () => ((hidden = true), change()),
      show: () => ((hidden = false), change()),
    };
  }

  it("runs with the page's time while it's in view, stands still while it's hidden, and goes on from there", () => {
    const p = page();
    p.pass(10_000);
    expect(p.clock()).toBe(10_000);
    p.hide();
    p.pass(3_600_000);
    expect(p.clock()).toBe(10_000);
    p.show();
    p.pass(5_000);
    expect(p.clock()).toBe(15_000);
    // (A second hiding, and a change that isn't one: hidden twice, shown twice.)
    p.hide();
    p.hide();
    p.pass(1_000);
    p.show();
    p.show();
    expect(p.clock()).toBe(15_000);
  });

  it("a page opened hidden counts from when it's first shown", () => {
    const p = page(true);
    p.pass(60_000);
    expect(p.clock()).toBe(0);
    p.show();
    p.pass(1_000);
    expect(p.clock()).toBe(1_000);
  });

  it("his meter on it: a player who walks away for an hour comes back to the seeds he left, not ten", () => {
    const p = page();
    const meter = { since: p.clock(), base: BOSS_POWERS.seedsAtStart };
    p.pass(BOSS_POWERS.seedEverySec * 1000);
    expect(seedsAt(meter, p.clock()).count).toBe(BOSS_POWERS.seedsAtStart + 1);
    p.hide();
    p.pass(3_600_000);
    p.show();
    expect(seedsAt(meter, p.clock()).count).toBe(BOSS_POWERS.seedsAtStart + 1);
  });
});
