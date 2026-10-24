import type { Rng } from "./rng.ts";
import { BOSS_ROSTER, crowdFinalBoss, type BossDef } from "./boss.ts";
import { CROWD_KNOCKOUTS, CROWD_START, crowdFinalists, type Settings } from "./settings.ts";

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
  /** More detail, shown under the blurb when this option wins (none of today's options has any). */
  detail?: string;
  /** Settings this option sets if it wins. */
  patch: Partial<Settings>;
  /** Shown but can't be voted for (Squads' third mode, "Coming soon"): the server refuses it; nobody's vote lands there. */
  disabled?: boolean;
}

export interface PregameVote {
  id: string;
  title: string;
  /**
   * Three options, left to right on every screen, the same in every game and on every device (Eric, Oct 13: "The
   * voting rounds in all modes should never change position"). From Black's side too: the board turns, the order
   * doesn't (screens/Vote.tsx). A speed or clock vote runs fastest to slowest: Bullet on the left, the longest on the
   * right (Eric, Oct 16).
   */
  options: readonly VoteOption[];
  /** The option that wins if nobody votes: its index, found by its id (`optionIndex`), so a reorder never moves it. */
  defaultOption: number;
}

/** An option's index by its id: how a default is named, so it stays the same option whatever the order. */
export function optionIndex(options: readonly Pick<VoteOption, "id">[], id: string): number {
  const i = options.findIndex((o) => o.id === id);
  if (i < 0) throw new Error(`No vote option "${id}"`);
  return i;
}

/** What a time control sets: the bank for the game, the increment added at the start of every move, the move's cap. */
export type TimeControl = Pick<Settings, "timeBankSeconds" | "timeIncrementSeconds" | "moveClockSeconds">;

/** Minutes as chess writes them in a time control ("3" in 3+2; "1.5" for 90 s). */
const minutes = (seconds: number) => String(Math.round((seconds / 60) * 100) / 100);

/**
 * One option of the clock vote: a chess time control, written as chess writes it ("Blitz 5+3": 5 minutes for the
 * game, 3 s added every move), with its cap in the blurb. The label and blurb are made from the numbers, so they can't
 * disagree. The patch also clears any rising schedule (moveClockSteps), so the cap is the same on every move.
 */
function timeControl(id: string, icon: string, name: string, tc: TimeControl): VoteOption {
  const mins = minutes(tc.timeBankSeconds);
  return {
    id,
    icon,
    label: `${name} ${mins}+${tc.timeIncrementSeconds}`,
    blurb: `${mins} min + ${tc.timeIncrementSeconds} s a move · max ${tc.moveClockSeconds} s`,
    patch: { ...tc, moveClockSteps: [] },
  };
}

/**
 * The 50 v 50's "How fast?": real chess time controls (Eric, Oct 13, 2026), Bullet on the left, the longest on the right
 * (Eric, Oct 16: "the left should always be bullet, and then the far right on it should always be the longest time
 * control"; it reverses his Oct 13 "always slowest on the left"). Each move adds the increment to your bank; what
 * you think comes out of it, so a quick move banks the rest. No move takes longer than its cap: 50 people pick
 * together, and every turn has to end. Bullet is 3+2, not 2+1: at 7-8 s a move, 2+1 runs dry before the final
 * (DECISIONS.md).
 */
function speedVote(): PregameVote {
  const options = [
    timeControl("bullet", "⚡", "Bullet", { timeBankSeconds: 180, timeIncrementSeconds: 2, moveClockSeconds: 10 }),
    timeControl("blitz", "🔥", "Blitz", { timeBankSeconds: 300, timeIncrementSeconds: 3, moveClockSeconds: 15 }),
    timeControl("rapid", "⏱️", "Rapid", { timeBankSeconds: 600, timeIncrementSeconds: 5, moveClockSeconds: 20 }),
  ];
  // Nobody votes: Blitz, by its id (DECISIONS.md, "Crowd 50 v 50: three chess time controls").
  return { id: "speed", title: "How fast?", defaultOption: optionIndex(options, "blitz"), options };
}

/**
 * The boss final's card (Eric, Oct 14: "instead of saying boss raid it'll say hidden boss"): the boss it always meets
 * (crowdFinalBoss: the Hidden Boss), named and drawn as the roster has him, so renaming him is one edit there; the blurb
 * names the ending and says how many face him (crowdFinalists: the top 4) without naming him again. With no such boss:
 * a random one (also while he's resting: `roster` without him, rosterWithout).
 */
export function bossFinalOption(roster: readonly BossDef[] = BOSS_ROSTER): VoteOption {
  const boss = crowdFinalBoss(roster);
  const n = crowdFinalists("boss");
  return {
    id: "boss",
    icon: boss?.icon ?? "👹",
    label: boss?.name ?? "Boss final",
    // (The card names the boss; its line names the ending, the boss final, as everywhere else.)
    blurb: boss ? `Boss final: top ${n} team up against him` : `Boss final: top ${n} team up against a boss`,
    patch: { finalFormat: "boss", knockoutsPerStage: CROWD_KNOCKOUTS.boss },
  };
}

/** "How does it end?": its listed order, fixed. Nobody votes: Team final, by its id. */
function formatVote(): PregameVote {
  const options: VoteOption[] = [
    {
      id: "team",
      icon: "🛡️",
      label: "Team final",
      blurb: "Top 8 play on: 4v4, 3v3, then 2v2 to the end",
      patch: { finalFormat: "team", knockoutsPerStage: CROWD_KNOCKOUTS.team },
    },
    bossFinalOption(),
    {
      id: "duel",
      icon: "⚔️",
      label: "Duel",
      blurb: "The best of each side, 1v1 to the end",
      patch: { finalFormat: "duel", knockoutsPerStage: CROWD_KNOCKOUTS.duel },
    },
  ];
  return { id: "format", title: "How does it end?", defaultOption: optionIndex(options, "team"), options };
}

/**
 * "How does it start?" (Eric, Oct 24): the usual starting position on the left, a random real opening in the middle,
 * Freestyle on the right (FIDE's name for Chess960, the name players see: never "Chess960" or "Fischer Random"). Nobody
 * votes: Normal, by its id. Each patch sets the start (`crowdStart`) and the opening moves played before move 1 (only
 * Random opening has any: CROWD_START). docs/decisions/2026-10-24-opening-vote.md.
 */
function openingVote(): PregameVote {
  const n: number = CROWD_START.randomOpeningMoves;
  const options: VoteOption[] = [
    { id: "normal", icon: "♟️", label: "Normal", blurb: "The usual starting position", patch: { crowdStart: "normal", openingMoves: 0 } },
    { id: "random", icon: "🎲", label: "Random opening", blurb: `A real opening, ${n} ${n === 1 ? "move" : "moves"} in`, patch: { crowdStart: "random", openingMoves: n } },
    { id: "freestyle", icon: "🔀", label: "Freestyle", blurb: "The back-row pieces start shuffled", patch: { crowdStart: "freestyle", openingMoves: 0 } },
  ];
  return { id: "start", title: "How does it start?", defaultOption: optionIndex(options, "normal"), options };
}

/** The 50 v 50's votes, in the order they're held: how it ends, how it starts, then the clock (Eric, Oct 24). */
export const PREGAME_VOTES: readonly PregameVote[] = [formatVote(), openingVote(), speedVote()];

/**
 * A start by its id (a test URL's ?start=normal|random|freestyle), as the vote's option sets it; an id we don't know
 * gets the default (Normal). No id: null (the vote decides).
 */
export function startOption(id: string | null | undefined): VoteOption | null {
  if (!id) return null;
  const vote = PREGAME_VOTES.find((v) => v.id === "start")!;
  return vote.options.find((o) => o.id === id.toLowerCase()) ?? vote.options[vote.defaultOption]!;
}

/** Speeds that are gone, by their old ?speed= ids: Normal (and before it Slow and Standard) is Rapid, Variable Blitz. */
const OLD_SPEEDS: ReadonlyMap<string, string> = new Map([
  ["normal", "rapid"],
  ["slow", "rapid"],
  ["standard", "rapid"],
  ["variable", "blitz"],
]);

/**
 * A time control by its id (a test URL's ?speed=bullet|blitz|rapid). Old ids map to the new ones (normal → rapid,
 * variable → blitz, bullet → bullet); an id we don't know gets the default (Blitz), never an error. No id: null (the
 * vote decides).
 */
export function speedOption(id: string | null | undefined): VoteOption | null {
  if (!id) return null;
  const vote = PREGAME_VOTES.find((v) => v.id === "speed")!;
  const key = id.toLowerCase();
  return vote.options.find((o) => o.id === (OLD_SPEEDS.get(key) ?? key)) ?? vote.options[vote.defaultOption]!;
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

/**
 * The zone (from White's side) that holds an option on a viewer's screen. Options keep their order on every screen,
 * left to right, whichever side you're on (Eric, Oct 13: "The voting rounds in all modes should never change
 * position"): from Black's side, where the board is turned, the zones are taken the other way round. Its own inverse,
 * so it also gives the option a zone holds on that screen.
 */
export function voteZoneFor(option: number, viewer: "w" | "b", count = VOTE_ZONE_FILES.length): number {
  return viewer === "w" ? option : count - 1 - option;
}

/** The zone a point falls in (null outside all three). */
export function voteZoneAt(p: BoardSpot): number | null {
  const i = VOTE_ZONE_FILES.findIndex((_, o) => {
    const z = voteZoneBox(o);
    return p.x >= z.x0 && p.x <= z.x1 && p.y >= z.y0 && p.y <= z.y1;
  });
  return i < 0 ? null : i;
}

/** How far a pawn's center stays from the edges of its band or zone (squares): it stands inside, not on the line. */
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
