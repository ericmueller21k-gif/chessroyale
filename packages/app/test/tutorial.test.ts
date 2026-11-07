import { describe, expect, it } from "vitest";
import {
  TUTORIAL_CRATE_GOALS,
  TUTORIAL_SPOTS,
  crateBars,
  TUTORIAL_ANYWHERE_SLIDE,
  shouldSaveSeen,
  shouldShowTutorial,
  slideSpotId,
  tourRequested,
  tutorialSlides,
  TUTORIAL_CRATE_LABEL,
} from "../src/tutorial.ts";

describe("tutorial slides", () => {
  it("runs PLAY, then the three modes, then the rest of the home spots, the Handbook, Play anywhere, and the crates slide last", () => {
    const slides = tutorialSlides();
    expect(slides.map((s) => (s.kind === "spot" ? s.spot.id : s.kind))).toEqual([
      "play", "mode-crowd", "mode-1v1", "mode-squads",
      "chess-town", "boss-battle", "play-with-friends", "shop", "profile", "settings",
      "handbook", "anywhere", "crates",
    ]);
    expect(slides).toHaveLength(13);
    expect(TUTORIAL_SPOTS).toHaveLength(10);
  });

  it("gives the mode slides their short titles and one-line bodies", () => {
    expect(TUTORIAL_SPOTS.slice(1, 4).map((s) => [s.title, s.body])).toEqual([
      ["50 v 50", "Two teams of 50 vote on every move."],
      ["1 v 1", "You against one player, ranked."],
      ["Squads", "4-player teams across several boards."],
    ]);
  });

  it("has a Play anywhere slide with no spot, after the Handbook", () => {
    expect(TUTORIAL_ANYWHERE_SLIDE.title).toBe("Play anywhere");
    expect(TUTORIAL_ANYWHERE_SLIDE.body).toBe(
      "HunChess runs right from the website, on both computer and phone. No download needed. You can also add it to your home screen.",
    );
    const slides = tutorialSlides();
    expect(slides[slides.length - 2]).toEqual({ kind: "anywhere" });
    expect(slideSpotId({ kind: "anywhere" })).toBeNull();
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

  it("opens from the first slide on ?tour=1, whatever the flag", () => {
    expect(tourRequested("?tour=1")).toBe(true);
    expect(tourRequested("?x=2&tour=1")).toBe(true);
    expect(tourRequested("?tour=0")).toBe(false);
    expect(tourRequested("?tour=true")).toBe(false);
    expect(tourRequested("")).toBe(false);
  });
});

describe("the crates slide and finishing", () => {
  it("lights up the mode tab on a mode slide, the shop on the crates slide, and nothing on the Handbook slide", () => {
    const slides = tutorialSlides();
    expect(slideSpotId(slides[0])).toBe("play");
    expect(slideSpotId(slides[1])).toBe("mode-crowd");
    expect(slideSpotId(slides[10])).toBeNull();
    expect(slideSpotId(slides[12])).toBe("shop");
  });

  it("saves the flag only when the OK's box is ticked", () => {
    expect(shouldSaveSeen(true)).toBe(true);
    expect(shouldSaveSeen(false)).toBe(false);
  });

  it("labels each crate by its goal", () => {
    expect(TUTORIAL_CRATE_LABEL(5)).toBe("5 games");
    expect(TUTORIAL_CRATE_LABEL(25)).toBe("25 games");
  });
});
