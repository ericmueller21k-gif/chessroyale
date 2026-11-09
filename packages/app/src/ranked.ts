import { LEAVES, RANKED_1V1, rankView, type RankView, type RankedLeaves } from "@chessroyale/core";
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

/** What home's line under your name says: your rank, "unranked" before your first ranked game, null while loading. */
export type HomeRankLine = RankView | "unranked" | null;

/** Home's line under your name (Oct 28: the rank shown everywhere is ranked 1 v 1's). */
export function homeRankLine(): HomeRankLine {
  const p = account().profile;
  if (!p) return null;
  const shown = ranked1v1Rank()!;
  return shown.placement && !(p.ranked1v1?.games ?? 0) ? "unranked" : shown;
}

// ---------------- Leaving early (ranked's leave rules, L1; docs/areas/ranked.md "Leaving") ----------------

/** Your standing with the leave rules, as the server last said (/api/me): null with none, or while the rules are paused. */
export function yourLeaves(): RankedLeaves | null {
  return account().profile?.leaves ?? null;
}

/** A countdown: h:mm:ss from an hour, m:ss under it (rounded up, as every clock on screen). */
export function untilShown(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(mm).padStart(2, "0")}:${ss}` : `${mm}:${ss}`;
}

/** Ranked is locked for you until then (null: it isn't, at `now`). */
export function rankedLockedUntil(l: RankedLeaves | null, now: number): number | null {
  return l?.lockedUntil && l.lockedUntil > now ? l.lockedUntil : null;
}

/**
 * Home's line above PLAY with 1 v 1 picked, from your standing (null: nothing to say): a lockout and its countdown (PLAY greyed
 * meanwhile), or the delayed queue's extra wait (PLAY as usual: the wait starts when you search). One line on a phone at 320 px.
 */
export function leavesLine(l: RankedLeaves | null, now: number): string | null {
  const until = rankedLockedUntil(l, now);
  if (until) return `${l!.lock === "leaves" ? "Too many leaves" : "You left early"}: 1 v 1 opens in ${untilShown(until - now)}`;
  if (l?.delaySec) return `${l.marks} leaves in your last ${LEAVES.window}: +${Math.round(l.delaySec / 60)} min queue`;
  return null;
}

/** Home's note (the note slot at its top) from your standing: just after a dodge, or while finishing games would clear a delay. */
export function leavesNote(l: RankedLeaves | null): string | null {
  if (l?.dodged) return `You left before the game started${l.dodged.rp > 0 ? `: −${l.dodged.rp} RP` : ""}`;
  // (The count is in the line above PLAY: "5 leaves in your last 20: +5 min queue".)
  if (l && l.marks >= LEAVES.noteAt) return "Finish ranked games to clear your leaves.";
  return null;
}

/** What a dodge now costs, in words for the Abort confirm ("5 RP and a 5-minute wait before your next 1 v 1"; empty: nothing). */
function dodgeCostWords(l: RankedLeaves): string {
  const { rp, lockoutMin } = l.nextDodge;
  const wait = lockoutMin ? `a ${lockoutMin >= 60 ? `${lockoutMin / 60}-hour` : `${lockoutMin}-minute`} wait before your next 1 v 1` : "";
  if (rp && wait) return `${rp} RP and ${wait}`;
  if (rp) return `${rp} RP`;
  return wait;
}

/** The match menu's Abort confirm in a ranked 1 v 1 (before both first moves): what leaving now costs. */
export function abortNote(l: RankedLeaves | null): string {
  if (!l) return "The game is called off: no result, and no rank change.";
  const cost = dodgeCostWords(l);
  return cost ? `The game is called off. Leaving before it starts costs ${cost}.` : "The game is called off. Leaving before it starts goes on your record.";
}

/** The match menu's Resign confirm in a ranked 1 v 1: resigning before your 3rd move is a leave (the loss and LEAVES.leaveRp more). */
export function resignNote(l: RankedLeaves | null, movesMade: number, placed: boolean): string {
  if (!l || movesMade >= LEAVES.quickResignMoves) return "It counts as a loss.";
  return placed ? `It counts as a loss, and resigning this early costs ${LEAVES.leaveRp} RP more.` : "It counts as a loss, and resigning this early goes on your record.";
}
