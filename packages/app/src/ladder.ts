import { type LadderAnswer, type LadderMode, type LadderRow, type RankView } from "@chessroyale/core";
import { api } from "./account.ts";
import { backFrom, openProfile, type ProfileTarget } from "./profile-nav.ts";

/**
 * The season ladder (/ladder; Eric, Nov 25: "a ladder board for all rank modes for the current season"; "scrollable to the top 200";
 * docs/decisions/2026-11-25-ladder.md): its answer from `GET /api/ladder` (server/src/ladder.ts; core's `LadderAnswer`, your own row
 * already in its list), kept a moment so a profile opened from a row comes back to the same list, the list's place kept for that
 * profile's Back, and the words its rows show. The page is screens/Ladder.tsx.
 */

/** How long a loaded ladder is shown again without asking (Back from a profile a row opened): the server's own minute. */
export const LADDER_KEEP_MS = 60_000;
/** A request that hasn't answered in this long has failed (tried once more, then "The ladder didn't load."). */
const LADDER_TIMEOUT_MS = 10_000;

/** The last answer for each mode, and when it came. */
const kept = new Map<LadderMode, { at: number; answer: LadderAnswer }>();

/** A kept answer still fresh enough to show at once (null: ask). */
export function keptLadder(mode: LadderMode, now = Date.now()): LadderAnswer | null {
  const k = kept.get(mode);
  return k && now - k.at < LADDER_KEEP_MS ? k.answer : null;
}
/** Forgets every kept answer (tests). */
export const forgetLadder = () => kept.clear();

/** The ladder for `mode`: asked once more if the first ask fails, then the failure is thrown (the page says so, with Retry). */
export async function loadLadder(mode: LadderMode, now = () => Date.now()): Promise<LadderAnswer> {
  const ask = () =>
    api<LadderAnswer>(`/api/ladder?mode=${mode}`, typeof AbortSignal.timeout === "function" ? { signal: AbortSignal.timeout(LADDER_TIMEOUT_MS) } : undefined);
  const answer = await ask().catch(ask);
  if (!Array.isArray(answer.rows)) throw new Error("The ladder didn't load.");
  kept.set(mode, { at: now(), answer });
  return answer;
}

/** The profile a row opened, and how far down the list was scrolled then (apart from the answer's age: a minute on a profile is normal). */
let left: { target: ProfileTarget; scroll: number } | null = null;

/** A row's tap: that player's profile, with the list's place kept for its Back. */
export function openFromLadder(target: ProfileTarget, scroll: number): void {
  left = { target, scroll };
  openProfile(target);
}

/**
 * Asked once as the page opens: how far down the list was when a row opened the profile whose own Back brought you here (profile-nav's
 * backFrom), or null for any other way here (the menu, home's LADDER, that profile closed by anything but its Back): the list from the top.
 * Forgets either way.
 */
export function cameBack(): number | null {
  const l = left;
  left = null;
  return l && backFrom() === l.target ? l.scroll : null;
}

/** "142 – 88" (draws left out, as the profile's W / L). */
export const recordLine = (r: Pick<LadderRow, "wins" | "losses">) => `${r.wins} – ${r.losses}`;
/** Wins over games, whole percent ("62%"). */
export const winPct = (r: Pick<LadderRow, "wins" | "losses" | "draws">) => {
  const g = r.wins + r.losses + r.draws;
  return g > 0 ? `${Math.round((100 * r.wins) / g)}%` : "–";
};
/** The rank's words, as everywhere ("Gold 2 · 45 RP", "Transcendent · 214 RP"): core's own label. */
export const rankLine = (rank: RankView) => rank.label;
/** "#2,418". */
export const placeText = (n: number) => `#${n.toLocaleString("en-US")}`;
/** "12,408 ranked players". */
export const totalLine = (n: number) => `${n.toLocaleString("en-US")} ranked player${n === 1 ? "" : "s"}`;
/** Your pinned row's words while you're still placing. */
export const placementLine = (p: { played: number; of: number }) => {
  const left = p.of - p.played;
  return `Play ${left} more placement game${left === 1 ? "" : "s"} to join the ladder`;
};
/** Your pinned row's words when you're signed out (or a guest where online play needs signing in). */
export const SIGN_IN_LINE = "Sign in to join the ladder";

/** The ladder's trophy (the computer's side menu). */
export const TROPHY_PATHS = ["M8 4h8v5a4 4 0 0 1-8 0z", "M8 6H5.5a2.5 2.5 0 0 0 2.6 3.4M16 6h2.5a2.5 2.5 0 0 1-2.6 3.4", "M12 13v3M8.5 20h7M9.5 20l.5-4h4l.5 4"];
