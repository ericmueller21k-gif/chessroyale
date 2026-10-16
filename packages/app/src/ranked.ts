import { rankView, type RankView } from "@chessroyale/core";
import { account } from "./account.ts";

/**
 * Your ranked 1 v 1 rank, for any screen that shows it (the home screen's 1 v 1 button, the queue): from your profile
 * (/api/me), which the server works out. Nothing here is stored on the device.
 */

/** Your rank as it shows: "Gold 2 · 45 RP", "Master · 120 RP", "Placement 2/5" (null: no account loaded yet). */
export function ranked1v1Label(): string | null {
  const p = account().profile;
  return p ? (p.ranked1v1?.rank ?? rankView(null)).label : null;
}

/** Your rank in full (tier, division, rank points, its color; placements), or null with no account loaded. */
export function ranked1v1Rank(): RankView | null {
  const p = account().profile;
  return p ? (p.ranked1v1?.rank ?? rankView(null)) : null;
}
