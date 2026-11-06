import { WELCOME_GIFT } from "@chessroyale/core";

/**
 * The first-time walkthrough's words and order, as pure data (no UI, no storage in here).
 *
 * Slides run in this order: the seven home-screen spots, then the Handbook, then the crates slide with the
 * welcome progress (the 5-game and 25-game Welcome Crates).
 */

export interface TutorialSpot {
  /** The `data-tour` value on the home-screen element the slide points at. */
  id: "play" | "chess-town" | "boss-battle" | "play-with-friends" | "shop" | "profile" | "settings";
  title: string;
  body: string;
}

export const TUTORIAL_SPOTS: readonly TutorialSpot[] = [
  { id: "play", title: "PLAY", body: "Tap here to start a match." },
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
  | { kind: "crates" };

export function tutorialSlides(): TutorialSlide[] {
  return [
    ...TUTORIAL_SPOTS.map((spot) => ({ kind: "spot" as const, spot })),
    { kind: "handbook" as const },
    { kind: "crates" as const },
  ];
}

/** The storage key for "Don't show this tutorial again". Read and written in try/catch by the caller. */
export const TUTORIAL_SEEN_KEY = "hunchess.tutorial.dismissed";

/** Whether the tutorial should start, given the stored flag (a missing or unreadable flag means show it). */
export function shouldShowTutorial(stored: string | null | undefined): boolean {
  return stored !== "1";
}
