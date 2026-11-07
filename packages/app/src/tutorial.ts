import { WELCOME_GIFT } from "@chessroyale/core";

/**
 * The first-time walkthrough's words and order, as pure data (no UI, no storage in here).
 *
 * Slides run in this order: PLAY, the three RANKED modes, the rest of the home spots, the Handbook, "Play anywhere" (no spot),
 * then the crates slide with the welcome progress (the 5-game and 25-game Welcome Crates), which is the last slide: only it has
 * the OK button and the "Don't show me this again" box.
 */

export interface TutorialSpot {
  /**
   * The `data-tour` value on the elements the slide points at: every visible one (a computer has some of them twice, in its
   * side menu and on the home screen).
   */
  id: "play" | "mode-crowd" | "mode-1v1" | "mode-squads" | "chess-town" | "boss-battle" | "play-with-friends" | "shop" | "profile" | "settings";
  title: string;
  body: string;
}

export const TUTORIAL_SPOTS: readonly TutorialSpot[] = [
  { id: "play", title: "PLAY", body: "Tap here to start a match." },
  { id: "mode-crowd", title: "50 v 50", body: "Two teams of 50 vote on every move." },
  { id: "mode-1v1", title: "1 v 1", body: "You against one player, ranked." },
  { id: "mode-squads", title: "Squads", body: "4-player teams across several boards." },
  { id: "chess-town", title: "Chess Town", body: "Your town of chess games and rewards." },
  { id: "boss-battle", title: "Boss Battle", body: "Team up against a boss." },
  { id: "play-with-friends", title: "Play with friends", body: "Invite a friend to a match." },
  { id: "shop", title: "Shop & crates", body: "Open crates for new pieces and items." },
  { id: "profile", title: "Profile", body: "Your profile and your collection." },
  { id: "settings", title: "Settings", body: "Sound, sign-in and help live here." },
];

export const TUTORIAL_HANDBOOK_SLIDE = {
  id: "handbook" as const,
  title: "HunChess Handbook",
  body: "Every rule and number, in one place. Open it any time from Settings.",
};

/** The no-spot slide: the game runs in a browser, and the app can also go on the home screen (the install card). */
export const TUTORIAL_ANYWHERE_SLIDE = {
  id: "anywhere" as const,
  title: "Play anywhere",
  body: "HunChess runs right from the website, on both computer and phone. No download needed. You can also add it to your home screen.",
};

/** The Welcome Crates' goals (5 games, then 25): the crates slide shows both, as the Crates tab does. */
export const TUTORIAL_CRATE_GOALS: readonly number[] = WELCOME_GIFT.milestones;

export interface TutorialCrateBar {
  goal: number;
  /** Games played so far, capped at the goal. */
  done: number;
  /** 0 to 1, for the bar's width. */
  fraction: number;
  reached: boolean;
}

/** The welcome crate bars for a games count (never negative, never above the goal). */
export function crateBars(games: number, goals: readonly number[] = TUTORIAL_CRATE_GOALS): TutorialCrateBar[] {
  const played = Number.isFinite(games) ? Math.max(0, Math.floor(games)) : 0;
  return goals.map((goal) => {
    const done = Math.min(played, goal);
    return { goal, done, fraction: goal > 0 ? done / goal : 0, reached: played >= goal };
  });
}

/** Every slide in order, with the crates slide last. */
export type TutorialSlide =
  | { kind: "spot"; spot: TutorialSpot }
  | { kind: "handbook" }
  | { kind: "anywhere" }
  | { kind: "crates" };

export function tutorialSlides(): TutorialSlide[] {
  return [
    ...TUTORIAL_SPOTS.map((spot) => ({ kind: "spot" as const, spot })),
    { kind: "handbook" as const },
    { kind: "anywhere" as const },
    { kind: "crates" as const },
  ];
}

/** The storage key for "Don't show this tutorial again". Read and written in try/catch by the caller. */
export const TUTORIAL_SEEN_KEY = "hunchess.tutorial.dismissed";

/** Whether the tutorial should start, given the stored flag (a missing or unreadable flag means show it). */
export function shouldShowTutorial(stored: string | null | undefined): boolean {
  return stored !== "1";
}

/** Whether the URL asks for the walkthrough (`?tour=1` on any home URL): it opens from the first slide, whatever the flag. */
export function tourRequested(search: string): boolean {
  return new URLSearchParams(search).get("tour") === "1";
}

/** The `data-tour` spot a slide lights up: its own spot, the shop on the crates slide, none on the Handbook or Play anywhere. */
export function slideSpotId(slide: TutorialSlide): TutorialSpot["id"] | null {
  if (slide.kind === "spot") return slide.spot.id;
  if (slide.kind === "crates") return "shop";
  return null;
}

/**
 * Whether the OK on the last slide saves "don't show again": only when the box is ticked. Unticked, the walkthrough closes for
 * now and shows again next visit. (Skip and Escape, on any slide, save only when the box is ticked too.)
 */
export function shouldSaveSeen(dontShowAgain: boolean): boolean {
  return dontShowAgain;
}

/** The crate rows on the last slide: each Welcome Crate's goal, with its label. */
export const TUTORIAL_CRATE_LABEL = (goal: number) => `${goal} games`;
