import { WELCOME_GIFT } from "@chessroyale/core";

/**
 * The two Welcome Crate rows in the Crates tab (Eric, Nov 6: "you get both crates, but then they just have meters … 1 out of 5 …
 * 1 out of 25 unlock tracker"). Both show from the start, for every player: each with its own meter (its milestone's finished games),
 * and a state. The server decides what's earned and opened (server/welcome.ts); the app only reads it. The server's locker says how
 * many milestones are earned (`next`: the next one not earned, null once both are), how many wait to be opened (`unopened`), and the
 * latest opened ride (`item`). Crates open in order, so the first `earned - unopened` are opened, the next `unopened` are ready, and
 * the rest are locked. A guest's are always locked (the server never grants them).
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
  /** The finished games it needs (WELCOME_GIFT.milestones: 5, then 25). */
  milestone: number;
  /** Finished games counted toward it, at most the milestone. */
  done: number;
  /** The meter's fill, 0 to 1 (full at ready and opened). */
  fill: number;
  /** The meter's words: "3/5", "5/25". */
  meter: string;
  state: WelcomeRowState;
  /** The line under the name: "Finish 5 games to unlock", "Sign in to earn", "Ready", "Opened". */
  line: string;
  /** The ride an opened crate gave, when the locker has it. */
  ride?: WelcomeRide;
}

/** Each row, in order (Welcome Crate 1, then 2). Guests: every row locked, "Sign in to earn". */
export function welcomeRows(w: WelcomeIn, signedIn: boolean, rides: readonly WelcomeRide[] = []): WelcomeRowView[] {
  const milestones = WELCOME_GIFT.milestones as readonly number[];
  // How many are earned: the milestones before `next` (all of them once `next` is null; none while it's the first).
  const earned = !signedIn ? 0 : w.next === undefined ? (w.status && w.status !== "locked" ? 1 : 0) : w.next === null ? milestones.length : Math.max(0, milestones.indexOf(w.next));
  const unopened = signedIn ? (w.unopened ?? (w.status === "ready" ? 1 : 0)) : 0;
  const opened = Math.max(0, earned - unopened);
  // The latest opened crate is the last one opened: its ride is the locker's `item`; an earlier one's is the other ride.
  const latest = opened > 0 ? rides.find((r) => r.id === w.item) : undefined;
  const earlier = rides.find((r) => r.id !== w.item);
  return milestones.map((milestone, i) => {
    const state: WelcomeRowState = i < opened ? "opened" : i < earned ? "ready" : "locked";
    const done = state === "locked" ? Math.min(Math.max(0, w.games), milestone) : milestone;
    const ride = state !== "opened" ? undefined : i === opened - 1 ? latest : earlier;
    const line = state === "opened" ? "Opened" : state === "ready" ? "Ready" : signedIn ? `Finish ${milestone} games to unlock` : "Sign in to earn";
    return {
      n: i + 1,
      milestone,
      done,
      fill: done / milestone,
      meter: `${done}/${milestone}`,
      state,
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
