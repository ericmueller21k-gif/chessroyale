import { RANKED_1V1, rankView, type RankView } from "@chessroyale/core";
import { account } from "./account.ts";
import { testSwitchesAllowed } from "./test-switches.ts";

/**
 * Your ranked 1 v 1 rank, for any screen that shows it (the home screen's 1 v 1 button, the queue): from your profile
 * (/api/me), which the server works out. Nothing here is stored on the device.
 */

/**
 * An admin's test rank (Oct 28: so Eric can see every emblem on his phone): `?rank=gold-3` (a tier and its division, 5
 * the lowest to 1), `?rank=transcendent` or `?rank=pearlescent`, shown in place of your own rank on your own screens
 * (home, the stage, the game's strip and result, your profile). Read from the address once, as the page opens (a link
 * that drops the query later keeps it for the page); whether it counts, each time (testSwitchesAllowed): a player's
 * is ignored. Anything else (an unknown tier, a division out of 1-5, a top tier with a division) is ignored too.
 */
export function rankFromSwitch(value: string | null | undefined, R: typeof RANKED_1V1 = RANKED_1V1): RankView | null {
  const m = value?.trim().toLowerCase().match(/^([a-z]+)(?:-(\d))?$/);
  if (!m) return null;
  const [, name, d] = m;
  const t = R.tiers.findIndex((x) => x.name.toLowerCase() === name);
  if (t >= 0) {
    const division = Number(d);
    if (!d || division < 1 || division > R.divisions) return null;
    // (45 RP into that division.)
    const ladder = (t * R.divisions + (R.divisions - division)) * R.pointsPerDivision + Math.min(45, R.pointsPerDivision - 1);
    return rankView({ games: R.placements.games, ladder }, R);
  }
  const top = R.topTiers.find((x) => x.name.toLowerCase() === name);
  if (!top || d) return null;
  // (120 RP over the floor, at the tier's last place.)
  return rankView({ games: R.placements.games, ladder: R.topFloor + 120, place: top.top }, R);
}

const RANK_ASKED = (() => {
  try {
    return rankFromSwitch(new URLSearchParams(globalThis.location?.search ?? "").get("rank"));
  } catch {
    return null;
  }
})();

/** Your rank as your own screens show it: an admin's `?rank=` in its place where the test switches count, else your own. */
export function yourRankShown(real: RankView): RankView;
export function yourRankShown(real: RankView | null): RankView | null;
export function yourRankShown(real: RankView | null): RankView | null {
  return RANK_ASKED && real && testSwitchesAllowed() ? RANK_ASKED : real;
}

/** Your rank as it shows: "Gold 2 · 45 RP", "Transcendent · 120 RP", "Placement 2/5" (null: no account loaded yet). */
export function ranked1v1Label(): string | null {
  return ranked1v1Rank()?.label ?? null;
}

/** Your rank in full (tier, division, rank points, its color and emblem; placements), or null with no account loaded. */
export function ranked1v1Rank(): RankView | null {
  const p = account().profile;
  return p ? yourRankShown(p.ranked1v1?.rank ?? rankView(null)) : null;
}
