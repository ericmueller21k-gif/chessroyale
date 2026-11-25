import type { ItemLook } from "./crates.ts";
import type { RankView } from "./ranked.ts";

/**
 * The season ladder (Eric, Nov 25; docs/decisions/2026-11-25-ladder.md): what `GET /api/ladder?mode=1v1` answers, shared by the
 * server (packages/server/src/ladder.ts) and the page (packages/app/src/screens/Ladder.tsx). Numbers in `LADDER` (settings.ts).
 */

/** The ranked modes with a ladder of their own today. 50 v 50 and Squads have no rank of their own yet (their tabs are greyed). */
export type LadderMode = "1v1";

/** One player's row: their place this season, how they look, their rank and record. */
export interface LadderRow {
  uid: string;
  name: string;
  /** Their equipped items (empty: a plain pawn). */
  look: ItemLook;
  /** 1 + how many ladders are higher (equal ladders share a place), among the players the ladder shows. */
  place: number;
  rank: RankView;
  wins: number;
  losses: number;
  draws: number;
  /** Wins in a row now. */
  streak: number;
}

/** Your own standing: your row (your exact place, wherever it is), or how far into placements you are, or null (signed out or a guest). */
export type LadderYou = LadderRow | { placement: { played: number; of: number } } | null;

/** The answer: the season, how many are on the ladder, its top `LADDER.size` rows, and you. */
export interface LadderAnswer {
  season: number;
  mode: LadderMode;
  /** Players on the ladder (placements done; banned players, the engine pool and test accounts left out). */
  total: number;
  rows: LadderRow[];
  you: LadderYou;
}

/**
 * Each place down a list already in ladder order, highest first, from the top (place 1): equal ladders share the better place,
 * and the next one down skips the shared places (3000, 3000, 2950 → 1, 1, 3), as the top tiers' place counts it (topPlace).
 */
export function ladderPlaces(ladders: readonly number[]): number[] {
  const out: number[] = [];
  for (const [i, l] of ladders.entries()) out.push(i > 0 && ladders[i - 1] === l ? out[i - 1]! : i + 1);
  return out;
}
