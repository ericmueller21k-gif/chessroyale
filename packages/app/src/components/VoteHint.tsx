import { useEffect, useState } from "preact/hooks";

/**
 * The first-time hint for a pawn vote, in any mode (Eric, Oct 16: "drag your pawn to the… spot"): a short text box
 * the first time a player meets a pawn vote on this device, and never again there. Generic, so every pawn vote (1 v 1's
 * time control, the Crowd's and Squads' votes) can show the same one: the caller places it and words it.
 *   - `useVoteHint(active, done)`: whether to show it now. It shows only if this device hasn't seen one before, from
 *     when the vote is `active` until the player has done it (`done`: their pawn dropped) or the vote ends; it's
 *     counted as seen as soon as it shows.
 *   - `<VoteHint text show />`: the box itself (with a small arrow pointing down at the board's middle).
 * Kept on the device (`brc.voteHintSeen`); with no storage (a private window), it shows once per page load.
 */

const KEY = "brc.voteHintSeen";
let seenThisPage = false;

/** This device has shown the hint before. */
export function voteHintSeen(): boolean {
  if (seenThisPage) return true;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** The hint has shown: never again on this device. */
export function markVoteHintSeen() {
  seenThisPage = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // No storage: once per page load.
  }
}

/** Whether the first-time hint shows now (see the header). */
export function useVoteHint(active: boolean, done: boolean): boolean {
  // (Decided once, when the vote's screen appears: a hint that has started showing stays until it's done.)
  const [first] = useState(() => !voteHintSeen());
  const on = first && active;
  useEffect(() => {
    if (on) markVoteHintSeen();
  }, [on]);
  return on && !done;
}

/** The hint's box. `class`: where the caller places it (over the board, under a title). */
export function VoteHint({ text, show, class: cls = "" }: { text: string; show: boolean; class?: string }) {
  if (!show) return null;
  return (
    <div class={`first-vote-hint ${cls}`} role="note">
      {text}
    </div>
  );
}
