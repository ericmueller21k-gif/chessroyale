import { describe, expect, it } from "vitest";
import {
  TUTORIAL_CRATE_GOALS,
  TUTORIAL_SPOTS,
  crateBars,
  shouldSaveSeen,
  shouldShowTutorial,
  slideSpotId,
  tutorialSlides,
  TUTORIAL_CRATE_LABEL,
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
  it("shows both Welcome Crates, 5 games and 25", () => {
    expect(TUTORIAL_CRATE_GOALS).toEqual([5, 25]);
    expect(crateBars(0).map((b) => b.goal)).toEqual([5, 25]);
  });

  it("counts games, caps at the goal, and marks it reached", () => {
    expect(crateBars(2)[0]).toEqual({ goal: 5, done: 2, fraction: 0.4, reached: false });
    expect(crateBars(9)[0]).toEqual({ goal: 5, done: 5, fraction: 1, reached: true });
  });

  it("treats bad counts as zero", () => {
    expect(crateBars(-3)[0].done).toBe(0);
    expect(crateBars(Number.NaN)[0].done).toBe(0);
  });

  it("shows 7 of 25 once the first crate is earned", () => {
    const bars = crateBars(7);
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

describe("the crates slide and finishing", () => {
  it("lights up the shop on the crates slide, its own spot on a spot slide, and nothing on the Handbook slide", () => {
    const slides = tutorialSlides();
    expect(slideSpotId(slides[0])).toBe("play");
    expect(slideSpotId(slides[7])).toBeNull();
    expect(slideSpotId(slides[8])).toBe("shop");
  });

  it("saves the flag when all nine are finished, and on Skip only if the box is ticked", () => {
    expect(shouldSaveSeen(true, false)).toBe(true);
    expect(shouldSaveSeen(false, true)).toBe(true);
    expect(shouldSaveSeen(false, false)).toBe(false);
  });

  it("labels each crate by its goal", () => {
    expect(TUTORIAL_CRATE_LABEL(5)).toBe("5 games");
    expect(TUTORIAL_CRATE_LABEL(25)).toBe("25 games");
  });
});
