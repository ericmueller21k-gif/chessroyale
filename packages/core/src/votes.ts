import type { Rng } from "./rng.ts";
import { CROWD_KNOCKOUTS, type Settings } from "./settings.ts";

/**
 * Crowd 50 v 50's pre-game votes. Before the first move, everyone (both teams)
 * votes by pushing one of their pawns two squares into one of three zones in
 * the middle of the board: 2x2 blocks on files b-c, d-e and f-g, ranks 4-5.
 * White pawns land on rank 4, Black pawns on rank 5. Each vote's options and
 * what they change are plain data here, so names, numbers and order are easy
 * to change.
 */

export interface VoteOption {
  id: string;
  icon: string;
  label: string;
  /** One short line under the label. */
  blurb: string;
  /** Settings this option sets if it wins. */
  patch: Partial<Settings>;
}

export interface PregameVote {
  id: string;
  title: string;
  /** Three options, left to right on the board. */
  options: readonly VoteOption[];
  /** The option that wins if nobody votes. */
  defaultOption: number;
}

export const PREGAME_VOTES: readonly PregameVote[] = [
  {
    id: "format",
    title: "How does it end?",
    defaultOption: 0,
    options: [
      {
        id: "team",
        icon: "🛡️",
        label: "Team final",
        blurb: "Top 8 play on: 4v4, 3v3, then 2v2 to the end",
        patch: { finalFormat: "team", knockoutsPerStage: CROWD_KNOCKOUTS.team },
      },
      {
        id: "boss",
        icon: "👹",
        label: "Boss battle",
        blurb: "Top 10 team up against a Stockfish boss",
        patch: { finalFormat: "boss", knockoutsPerStage: CROWD_KNOCKOUTS.boss },
      },
      {
        id: "duel",
        icon: "⚔️",
        label: "Duel",
        blurb: "The best of each side, 1v1 to the end",
        patch: { finalFormat: "duel", knockoutsPerStage: CROWD_KNOCKOUTS.duel },
      },
    ],
  },
  {
    id: "speed",
    title: "How fast?",
    defaultOption: 1,
    options: [
      { id: "slow", icon: "🐢", label: "Slow", blurb: "30 s a move", patch: { moveClockSeconds: 30 } },
      { id: "standard", icon: "⏱️", label: "Standard", blurb: "20 s a move", patch: { moveClockSeconds: 20 } },
      { id: "bullet", icon: "⚡", label: "Bullet", blurb: "10 s a move", patch: { moveClockSeconds: 10 } },
    ],
  },
];

/** The files of each zone, left to right (from White's side). */
export const VOTE_ZONE_FILES: readonly (readonly [string, string])[] = [
  ["b", "c"],
  ["d", "e"],
  ["f", "g"],
];

/** The pawn pushes that vote for an option: two squares forward on the zone's files. */
export function voteMoves(side: "w" | "b", option: number): string[] {
  const files = VOTE_ZONE_FILES[option] ?? [];
  return files.map((f) => (side === "w" ? `${f}2${f}4` : `${f}7${f}5`));
}

/** Every voting move for a side. */
export const allVoteMoves = (side: "w" | "b") => VOTE_ZONE_FILES.flatMap((_, i) => voteMoves(side, i));

/** Which option a pawn push votes for (null if it isn't a voting move). */
export function voteOptionOf(move: string): number | null {
  const i = VOTE_ZONE_FILES.findIndex((files) => files.some((f) => move === `${f}2${f}4` || move === `${f}7${f}5`));
  return i < 0 ? null : i;
}

/** The winning option: most votes; a tie is drawn among the tied; no votes gives the default. */
export function tallyVotes(choices: readonly number[], options: number, defaultOption: number, rng: Rng): number {
  const counts = Array.from({ length: options }, (_, i) => choices.filter((c) => c === i).length);
  const top = Math.max(...counts);
  if (top === 0) return defaultOption;
  const tied = counts.flatMap((c, i) => (c === top ? [i] : []));
  return tied[Math.floor(rng() * tied.length)]!;
}

export interface BotVote {
  id: string;
  option: number;
  /** When the vote comes in, ms after voting opens. */
  atMs: number;
}

/**
 * Bots' votes: each vote gets its own random lean (so results differ from
 * game to game and a few humans can swing it), and each bot votes for an
 * option with that lean's odds, at a random moment in the window.
 */
export function botVotes(rng: Rng, ids: readonly string[], options: number, windowMs: number): BotVote[] {
  const lean = Array.from({ length: options }, () => 0.4 + rng());
  const total = lean.reduce((s, x) => s + x, 0);
  return ids.map((id) => {
    let r = rng() * total;
    let option = 0;
    while (option < options - 1 && (r -= lean[option]!) > 0) option++;
    return { id, option, atMs: Math.round((0.1 + 0.8 * rng()) * windowMs) };
  });
}

/** The vote that runs before the game in these settings (none outside Crowd 50 v 50 or with augments off). */
export const pregameVotes = (s: Pick<Settings, "mode" | "crowdTeams" | "augments">): readonly PregameVote[] =>
  s.mode === "crowd" && s.crowdTeams && s.augments ? PREGAME_VOTES : [];
