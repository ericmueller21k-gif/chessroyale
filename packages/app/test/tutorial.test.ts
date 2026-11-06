import { describe, expect, it } from "vitest";
import {
  TUTORIAL_CRATE_GOALS,
  TUTORIAL_SPOTS,
  crateBars,
  shouldShowTutorial,
  tutorialSlides,
} from "../src/tutorial.ts";

describe("tutorial slides", () => {
  it("runs the home spots in order, then the Handbook, then the crates slide last", () => {
    const slides = tutorialSlides();
    expect(slides.map((s) => (s.kind === "spot" ? s.spot.id : s.kind))).toEqual([
      "play", "chess-town", "boss-battle", "play-with-friends", "shop", "profile", "settings", "handbook", "crates",
    ]);
    expect(TUTORIAL_SPOTS).toHaveLength(7);
  });
});

describe("crate progress", () => {
  it("shows only the 5-game crate while the 25-game one is held back", () => {
    expect(TUTORIAL_CRATE_GOALS).toEqual([5]);
    expect(crateBars(0).map((b) => b.goal)).toEqual([5]);
  });

  it("counts games, caps at the goal, and marks it reached", () => {
    expect(crateBars(2)[0]).toEqual({ goal: 5, done: 2, fraction: 0.4, reached: false });
    expect(crateBars(9)[0]).toEqual({ goal: 5, done: 5, fraction: 1, reached: true });
  });

  it("treats bad counts as zero", () => {
    expect(crateBars(-3)[0].done).toBe(0);
    expect(crateBars(Number.NaN)[0].done).toBe(0);
  });

  it("builds two bars when given the 25-game goal too", () => {
    const bars = crateBars(7, [5, 25]);
    expect(bars.map((b) => [b.done, b.reached])).toEqual([[5, true], [7, false]]);
  });
});

describe("stored dismissal", () => {
  it("shows the tutorial unless the flag is set to 1", () => {
    expect(shouldShowTutorial(null)).toBe(true);
    expect(shouldShowTutorial(undefined)).toBe(true);
    expect(shouldShowTutorial("0")).toBe(true);
    expect(shouldShowTutorial("1")).toBe(false);
  });
});
