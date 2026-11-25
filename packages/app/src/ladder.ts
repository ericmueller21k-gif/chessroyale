import { type LadderAnswer, type LadderMode, type LadderRow, type RankView } from "@chessroyale/core";
import { api } from "./account.ts";

/**
 * The season ladder (/ladder; Eric, Nov 25: "a ladder board for all rank modes for the current season"; "scrollable to the top 200";
 * docs/decisions/2026-11-25-ladder.md): its answer from `GET /api/ladder` (server/src/ladder.ts; core's `LadderAnswer`), kept a moment
 * so a profile opened from a row comes back to the same list at the same place, and the words its rows show. The page is
 * screens/Ladder.tsx.
 */

/** How long a loaded ladder is shown again without asking (Back from a profile, the page opened again soon): the server's own minute. */
export const LADDER_KEEP_MS = 60_000;
/** A request that hasn't answered in this long has failed (tried once more, then "The ladder didn't load."). */
const LADDER_TIMEOUT_MS = 10_000;

/** The last answer for each mode, when it came, and how far down its list you had scrolled. */
const kept = new Map<LadderMode, { at: number; answer: LadderAnswer; scroll: number }>();

/** A kept answer still fresh enough to show at once (null: ask). */
export function keptLadder(mode: LadderMode, now = Date.now()): { answer: LadderAnswer; scroll: number } | null {
  const k = kept.get(mode);
  return k && now - k.at < LADDER_KEEP_MS ? k : null;
}
/** Where the list was scrolled to (kept with its answer, for Back from a profile). */
export function keepLadderScroll(mode: LadderMode, scroll: number): void {
  const k = kept.get(mode);
  if (k) k.scroll = scroll;
}
/** Forgets every kept answer (tests; signing in or out changes your row). */
export const forgetLadder = () => kept.clear();

/** The ladder for `mode`: asked once more if the first ask fails, then the failure is thrown (the page says so, with Retry). */
export async function loadLadder(mode: LadderMode, now = () => Date.now()): Promise<LadderAnswer> {
  const ask = () =>
    api<LadderAnswer>(`/api/ladder?mode=${mode}`, typeof AbortSignal.timeout === "function" ? { signal: AbortSignal.timeout(LADDER_TIMEOUT_MS) } : undefined);
  const answer = await ask().catch(ask);
  if (!Array.isArray(answer.rows)) throw new Error("The ladder didn't load.");
  kept.set(mode, { at: now(), answer, scroll: 0 });
  return answer;
}

/**
 * The list as the page shows it: the answer's rows, and you in your place among them when your place is within them but the
 * shared list doesn't have you (an account rankings leave out sees its own place as ever: the engine pool is quiet).
 */
export function rowsWithYou(answer: Pick<LadderAnswer, "rows" | "you">): LadderRow[] {
  const you = answer.you;
  const rows = answer.rows;
  if (!you || "placement" in you || rows.some((r) => r.uid === you.uid)) return rows;
  const last = rows.at(-1);
  if (!last || you.place > last.place) return rows;
  const at = rows.findIndex((r) => r.place > you.place);
  return at < 0 ? [...rows, you] : [...rows.slice(0, at), you, ...rows.slice(at)];
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
