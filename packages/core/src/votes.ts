import type { Rng } from "./rng.ts";
import { CROWD_KNOCKOUTS, VARIABLE_CLOCK, clockStepRanges, type Settings } from "./settings.ts";

/**
 * Crowd 50 v 50's pre-game votes. Before the first move, everyone (both teams) votes by dragging their own pawn into
 * one of three zones in the middle of an empty board: 2x2 blocks on files b-c, d-e and f-g, ranks 4-5 (or by tapping
 * a card). Each vote's options and what they change are plain data here, so names, numbers and order are easy to
 * change. See DECISIONS.md, "Pre-game vote overhaul (Oct 7, 2026)".
 */

export interface VoteOption {
  id: string;
  icon: string;
  label: string;
  /** One short line under the label. */
  blurb: string;
  /** More detail, shown when this option wins (e.g. the Variable speed's whole schedule). */
  detail?: string;
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

/** "Moves 1–5: 10 s · 6–10: 15 s · … · 21+: 30 s": a rising clock in one line. */
export function clockScheduleLine(steps = VARIABLE_CLOCK): string {
  return clockStepRanges(steps)
    .map((r, i) => `${i === 0 ? "Moves " : ""}${r.to === null ? `${r.from}+` : r.to === r.from ? `${r.from}` : `${r.from}–${r.to}`}: ${r.seconds} s`)
    .join(" · ");
}

const first = VARIABLE_CLOCK[0]!.seconds;
const last = VARIABLE_CLOCK[VARIABLE_CLOCK.length - 1]!.seconds;

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
    // Nobody votes: the middle option, Variable.
    defaultOption: 1,
    options: [
      { id: "normal", icon: "⏱️", label: "Normal", blurb: "20 s a move", patch: { moveClockSeconds: 20, moveClockSteps: [] } },
      {
        id: "variable",
        icon: "📈",
        label: "Variable",
        blurb: `${first} s, rising to ${last} s`,
        detail: clockScheduleLine(),
        patch: { moveClockSteps: VARIABLE_CLOCK },
      },
      { id: "bullet", icon: "⚡", label: "Bullet", blurb: "10 s a move", patch: { moveClockSeconds: 10, moveClockSteps: [] } },
    ],
  },
];

/**
 * A speed option by its id (a test URL's ?speed=). Speeds that no longer exist map to the nearest one: "slow" (30 s
 * a move, removed Oct 7, 2026) and "standard" (the old name) are Normal.
 */
export function speedOption(id: string | null | undefined): VoteOption | null {
  if (!id) return null;
  const key = id === "slow" || id === "standard" ? "normal" : id;
  return PREGAME_VOTES.find((v) => v.id === "speed")!.options.find((o) => o.id === key) ?? null;
}

/** The files of each zone, left to right (from White's side). */
export const VOTE_ZONE_FILES: readonly (readonly [string, string])[] = [
  ["b", "c"],
  ["d", "e"],
  ["f", "g"],
];

/**
 * A point on the vote board, in squares from White's side: x across from the a-file's left edge (0-8), y up from
 * rank 1's bottom edge (0-8). The screen flips it for Black.
 */
export interface BoardSpot {
  x: number;
  y: number;
}

/** A zone's box on the board (in squares, from White's side): files b-c, d-e or f-g, ranks 4-5. */
export function voteZoneBox(option: number): { x0: number; x1: number; y0: number; y1: number } {
  const col = (VOTE_ZONE_FILES[option]?.[0] ?? "a").charCodeAt(0) - 97;
  return { x0: col, x1: col + 2, y0: 3, y1: 5 };
}

/** The zone a point falls in (null outside all three). */
export function voteZoneAt(p: BoardSpot): number | null {
  const i = VOTE_ZONE_FILES.findIndex((_, o) => {
    const z = voteZoneBox(o);
    return p.x >= z.x0 && p.x <= z.x1 && p.y >= z.y0 && p.y <= z.y1;
  });
  return i < 0 ? null : i;
}

/** How far a pawn's centre stays from the edges of its band or zone (squares): it stands inside, not on the line. */
export const VOTE_SPOT_MARGIN = 0.32;

/** A player id's 32-bit hash (FNV-1a): the seed for where their pawn stands. */
export function idHash(id: string): number {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}

/** The k-th point of the R2 sequence: points spread evenly over the unit square (no clumps, no grid). */
function r2(k: number): [number, number] {
  const g = 1.324717957244746;
  return [(0.5 + k / g) % 1, (0.5 + k / (g * g)) % 1];
}

/** A small, stable nudge (± `size` squares) from a hash, so a spread never looks machine-made. */
const jitter = (h: number, shift: number, size: number) => (((h >>> shift) & 0xff) / 255 - 0.5) * 2 * size;

/**
 * Every pawn's starting spot on the vote board: White's players scattered loosely over ranks 1-2 and Black's over
 * ranks 7-8, not snapped to squares. Each team is spread evenly (a low-discrepancy sequence, with a little jitter),
 * and who stands where is seeded by the player's id, so a pawn keeps its spot between renders and between the two
 * votes, however the list is ordered.
 */
export function voteHomeSpots(players: readonly { id: string; side: "w" | "b" }[]): Map<string, BoardSpot> {
  const out = new Map<string, BoardSpot>();
  const m = VOTE_SPOT_MARGIN;
  for (const side of ["w", "b"] as const) {
    const team = players.filter((p) => p.side === side).sort((a, b) => idHash(a.id) - idHash(b.id) || (a.id < b.id ? -1 : 1));
    const y0 = side === "w" ? 0 : 6;
    team.forEach((p, k) => {
      const h = idHash(p.id);
      const [u, v] = r2(k + 1);
      const x = m + u * (8 - 2 * m) + jitter(h, 0, 0.08);
      const y = y0 + m + v * (2 - 2 * m) + jitter(h, 8, 0.05);
      out.set(p.id, { x: Math.min(8 - m, Math.max(m, x)), y: Math.min(y0 + 2 - m, Math.max(y0 + m, y)) });
    });
  }
  return out;
}

/**
 * Where the k-th voter of a side lands in a zone (0 for the first to arrive): White's voters spread over the zone's
 * rank-4 half and Black's over its rank-5 half, so the sides stay apart; evenly, in order of arrival, so each lands
 * on a free spot.
 */
export function voteZoneSpot(option: number, side: "w" | "b", k: number): BoardSpot {
  const z = voteZoneBox(option);
  const [u, v] = r2(k + 1);
  const mx = VOTE_SPOT_MARGIN;
  const my = 0.22;
  const y0 = side === "w" ? z.y0 : z.y0 + 1;
  return { x: z.x0 + mx + u * (2 - 2 * mx), y: y0 + my + v * (1 - 2 * my) };
}

/** Your own pawn, voting by a tap (a card, or a tap on the zone): the middle of your side's half of the zone. */
export function voteZoneCentre(option: number, side: "w" | "b"): BoardSpot {
  const z = voteZoneBox(option);
  return { x: z.x0 + 1, y: side === "w" ? z.y0 + 0.5 : z.y0 + 1.5 };
}

/**
 * Your own pawn, dropped in a zone: across, it stays where you let go (nudged inside the zone's edges: it's a bigger
 * pawn than the others); up and down, it stands in the middle of your side's half, where your team's votes land (the
 * other half is the other team's, under the zone's count).
 */
export function clampToZone(option: number, p: BoardSpot, side: "w" | "b"): BoardSpot {
  const z = voteZoneBox(option);
  const m = 0.46;
  return { x: Math.min(z.x1 - m, Math.max(z.x0 + m, p.x)), y: voteZoneCentre(option, side).y };
}

/** The winning option: most votes; a tie is drawn among the tied; no votes gives the default. */
export function tallyVotes(choices: readonly number[], options: number, defaultOption: number, rng: Rng): number {
  const counts = Array.from({ length: options }, (_, i) => choices.filter((c) => c === i).length);
  const top = Math.max(...counts);
  if (top === 0) return defaultOption;
  const tied = counts.flatMap((c, i) => (c === top ? [i] : []));
  return tied[Math.floor(rng() * tied.length)]!;
}

/**
 * Closes a vote when its time runs out. The winner first: most votes, a tie drawn among the tied, nobody voting gives
 * the default (`tallyVotes`). Then everyone who didn't vote, people and bots alike, joins the winner ("Didn't vote?
 * You're with the crowd", Eric: "when not moved it defaults to the most popular one"). They're added after the count,
 * so they never change the outcome, only the final counts (and their pawns walk to the winner). `join` makes a
 * non-voter's entry. The one rule for solo and the lobby server; the app shows what they send.
 */
export function closePregameVote<V extends { playerId: string; option: number }>(
  votes: readonly V[],
  everyone: readonly string[],
  vote: Pick<PregameVote, "options" | "defaultOption">,
  rng: Rng,
  join: (playerId: string, option: number) => V,
): { result: number; votes: V[]; joined: string[] } {
  const result = tallyVotes(votes.map((v) => v.option), vote.options.length, vote.defaultOption, rng);
  const voted = new Set(votes.map((v) => v.playerId));
  const joined = [...new Set(everyone)].filter((id) => !voted.has(id));
  return { result, votes: [...votes, ...joined.map((id) => join(id, result))], joined };
}

/**
 * Records a player's vote: their first one counts. With voteChangeAllowed (off: Eric's call, one vote each), a later
 * vote replaces it. Returns the votes as they now stand, or null if the vote doesn't count.
 */
export function castPregameVote<V extends { playerId: string; option: number }>(votes: readonly V[], vote: V, changeAllowed: boolean): V[] | null {
  const had = votes.find((v) => v.playerId === vote.playerId);
  if (had && (!changeAllowed || had.option === vote.option)) return null;
  return [...votes.filter((v) => v.playerId !== vote.playerId), vote];
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
 * option with that lean's odds, at a random moment in the window. A share of
 * them (`skip`, the voteBotSkip setting) don't vote: when time's up they join
 * the winner, with everyone else who didn't vote (closePregameVote).
 */
export function botVotes(rng: Rng, ids: readonly string[], options: number, windowMs: number, skip = 0): BotVote[] {
  const lean = Array.from({ length: options }, () => 0.4 + rng());
  const total = lean.reduce((s, x) => s + x, 0);
  return ids.flatMap((id) => {
    let r = rng() * total;
    let option = 0;
    while (option < options - 1 && (r -= lean[option]!) > 0) option++;
    const atMs = Math.round((0.1 + 0.8 * rng()) * windowMs);
    return skip > 0 && rng() < skip ? [] : [{ id, option, atMs }];
  });
}

/** The vote that runs before the game in these settings (none outside Crowd 50 v 50 or with augments off). */
export const pregameVotes = (s: Pick<Settings, "mode" | "crowdTeams" | "augments">): readonly PregameVote[] =>
  s.mode === "crowd" && s.crowdTeams && s.augments ? PREGAME_VOTES : [];
