import { WELCOME_GIFT, WELCOME_TEXT, welcomeGamesNeeded } from "@chessroyale/core";

/**
 * The two Welcome Crate rows in the Crates tab (Eric, Nov 6: "you get both crates, but then they just have meters … 1 out of 5 …
 * 1 out of 25 unlock tracker"). Both show from the start, for every player: each with its own meter (its milestone's finished games),
 * and a state. The server decides what's earned and opened (server/welcome.ts); the app only reads it. The server's locker says how
 * many milestones are earned (`next`: the next one not earned, null once both are), how many wait to be opened (`unopened`), and the
 * latest opened ride (`item`). Crates open in order, so the first `earned - unopened` are opened, the next `unopened` are ready, and
 * the rest are locked. A guest's are always locked (the server never grants them).
 *
 * Nov 27 (Eric: "a golden ride beta crate is given when you open the game for the first time ... it's only openable after level 5 is
 * reached. But you can still view contents"): the first is given on the first visit, so its meter is your level toward
 * WELCOME_GIFT.openLevel ("Level 3/5"), not games. A crate you hold below that level is still ready (listed under Ready to open, its page
 * showing what's inside) but can't open: `canOpen` false, a padlock and "Reach level 5 to open" (the server refuses too).
 */

/** What the locker says about the Welcome Crates (the subset this reads; `WelcomeState` on the server). */
export interface WelcomeIn {
  games: number;
  next?: number | null;
  unopened?: number;
  status?: string;
  item?: string;
}

/** A row's state: locked (its meter filling), ready (the server granted it: Open), opened (its ride is in the locker). */
export type WelcomeRowState = "locked" | "ready" | "opened";

/** A HunChess ride in the locker: its item id and its def (`…-hunchess`). */
export interface WelcomeRide {
  id: string;
  def: string;
}

/** One Welcome Crate row, as the Crates tab and its page show it. */
export interface WelcomeRowView {
  /** 1 or 2: the crate's place (Welcome Crate 1, Welcome Crate 2). */
  n: number;
  /** Its key (WELCOME_GIFT.milestones: 5, then 25) and its meter's goal: the first's the level it opens at (5), the second's 25 games. */
  milestone: number;
  /** Its meter's count, at most the goal: your level (the first), or finished games (the second). */
  done: number;
  /** The meter's fill, 0 to 1 (full at ready and opened). */
  fill: number;
  /** The meter's words: "Level 3/5", "5/25". */
  meter: string;
  state: WelcomeRowState;
  /** Ready and your level is WELCOME_GIFT.openLevel or more: its Open works. */
  canOpen: boolean;
  /** The line under the name: "Given on your first visit", "Finish 25 games to unlock", "Sign in to get it", "Reach level 5 to open", "Ready", "Opened". */
  line: string;
  /** The ride an opened crate gave, when the locker has it. */
  ride?: WelcomeRide;
}

/** Each row, in order (Welcome Crate 1, then 2), for your `level`. Guests: every row locked, "Sign in to get it" / "Sign in to earn". */
export function welcomeRows(w: WelcomeIn, signedIn: boolean, rides: readonly WelcomeRide[] = [], level = 1): WelcomeRowView[] {
  const milestones = WELCOME_GIFT.milestones as readonly number[];
  // How many are earned: the milestones before `next` (all of them once `next` is null; none while it's the first).
  const earned = !signedIn ? 0 : w.next === undefined ? (w.status && w.status !== "locked" ? 1 : 0) : w.next === null ? milestones.length : Math.max(0, milestones.indexOf(w.next));
  const unopened = signedIn ? (w.unopened ?? (w.status === "ready" ? 1 : 0)) : 0;
  const opened = Math.max(0, earned - unopened);
  // The latest opened crate is the last one opened: its ride is the locker's `item`; an earlier one's is the other ride.
  const latest = opened > 0 ? rides.find((r) => r.id === w.item) : undefined;
  const earlier = rides.find((r) => r.id !== w.item);
  const open = WELCOME_GIFT.openLevel;
  return milestones.map((milestone, i) => {
    const state: WelcomeRowState = i < opened ? "opened" : i < earned ? "ready" : "locked";
    const canOpen = state === "ready" && level >= open;
    // (The first, given on a visit: its meter is your level toward the one it opens at. The second: its games.)
    const byLevel = welcomeGamesNeeded(milestone) === 0;
    const goal = byLevel ? open : milestone;
    const done = byLevel ? (state === "opened" ? goal : Math.min(Math.max(1, level), goal)) : state === "locked" ? Math.min(Math.max(0, w.games), goal) : goal;
    const ride = state !== "opened" ? undefined : i === opened - 1 ? latest : earlier;
    const line =
      state === "opened"
        ? "Opened"
        : state === "ready"
          ? canOpen
            ? "Ready"
            : WELCOME_TEXT.locked
          : !signedIn
            ? byLevel
              ? "Sign in to get it"
              : "Sign in to earn"
            : byLevel
              ? "Given on your first visit"
              : `Finish ${milestone} games to unlock`;
    return {
      n: i + 1,
      milestone: goal,
      done,
      fill: done / goal,
      meter: byLevel ? `Level ${done}/${goal}` : `${done}/${goal}`,
      state,
      canOpen,
      line,
      ...(ride ? { ride } : {}),
    };
  });
}

/** The row an unseen Welcome Crate's reveal resumes on: the ready one, else the latest opened. */
export function welcomeResumeRow(rows: readonly WelcomeRowView[]): number {
  const ready = rows.find((r) => r.state === "ready");
  if (ready) return ready.n;
  const opened = rows.filter((r) => r.state === "opened");
  return opened.length ? opened[opened.length - 1]!.n : 1;
}

/**
 * The Welcome Crate rows the Crates tab lists (Eric, Nov 25: "these welcome crates go away once they've been used ... they just shouldn't
 * even appear"; his own exception to "nothing hidden"): every row still to open (locked with its meter, or ready), and an opened one only
 * while its reveal hasn't been seen (`unseenRow`: the row an unseen Welcome Crate's reveal resumes on, else null). Order kept.
 */
export function welcomeRowsShown(rows: readonly WelcomeRowView[], unseenRow: number | null = null): WelcomeRowView[] {
  return rows.filter((r) => r.state !== "opened" || r.n === unseenRow);
}
