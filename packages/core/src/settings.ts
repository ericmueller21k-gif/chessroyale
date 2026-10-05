/**
 * Every tunable in HunChess lives here, so playtest changes never
 * touch game code. Starting values come from buildspec.md.
 */

export type ScoreCarry = "reset" | "carry";

/**
 * How the move that continues a board is chosen from the group's picks:
 * - random: each pick is one ticket (the original spec)
 * - popular: the move most players picked (a tie is drawn among the tied moves)
 * - best: the best move picked (a tie is drawn)
 * - weighted: a draw where better moves get more tickets (see drawWeightPoints)
 */
export type DrawRule = "random" | "popular" | "best" | "weighted";
export const DRAW_RULES: readonly DrawRule[] = ["random", "popular", "best", "weighted"];

/** Game modes: Classic (many boards, players rotate) and Crowd (everyone on one board, the most popular move is played). */
export type GameMode = "classic" | "crowd";
/** What the first screen offers: Classic, Crowd (50 v 50), and the boss raid (a Crowd variant). */
export type ModeChoiceId = GameMode | "raid";

/**
 * How a Crowd 50 v 50 match ends (chosen by the pre-game vote):
 * - team: the top 8 play on, 4v4 with teammates taking turns, shrinking to 3v3 and then 2v2, which plays to the end
 * - boss: the top 10 team up on a fresh board against a Stockfish boss, which strikes down the weakest every few moves
 * - duel: the best player on each side plays 1v1 to the end
 */
export type FinalFormat = "team" | "boss" | "duel";

export interface Settings {
  mode: GameMode;
  /** Crowd: two teams, 50 v 50, each playing one side all game (false: everyone picks for whichever side is to move). */
  crowdTeams: boolean;
  /** Crowd 50 v 50: before the game, everyone votes on how it ends and how fast it is (see votes.ts). */
  augments: boolean;
  /** Crowd: after each cut, players vote on the next round's move clock (more time, same, less time). Off since the pre-game votes. */
  cutClockVote: boolean;
  /** Crowd 50 v 50: how the match ends (set by the pre-game vote). */
  finalFormat: FinalFormat;
  /** Pre-game votes: seconds to vote, and how long each result shows. */
  voteSeconds: number;
  voteResultSeconds: number;
  /** Team final: players per side at each step (the last step plays to the end of the game). */
  teamFinalSizes: readonly number[];
  /** Team final: moves each player makes before a step's weakest player on each side goes out. */
  teamFinalMovesPerStep: number;
  /** Team final and duel: the most moves before the game is adjudicated by the engine (a safety cap). */
  finalMaxTurns: number;
  /** Boss battle: crowd moves between the boss's strikes, and how many survive its strikes at least. */
  bossKillEvery: number;
  bossMinSurvivors: number;
  /** Boss battle: the most crowd moves before the game is adjudicated by the engine. */
  bossMaxMoves: number;
  /** Boss battle: the boss's strength over the crowd's weighted rating, and its limits (Stockfish UCI_Elo). */
  bossEloOffset: number;
  bossEloRange: readonly [number, number];
  /** Boss battle: the boss's search budget per move. */
  bossNodes: number;
  /** Boss raid (a mode of its own): up to 50 players against a boss, no bots, from a named opening. */
  raid: boolean;
  /** Boss raid: the boss's strength, set from the lobby's ratings when it starts (0: from the crowd, as in 50 v 50). */
  bossFixedElo: number;
  /** Boss battle: the King's strike makes the boss's next move one that loses this many points (from its top moves). */
  kingStrikeLoss: readonly [number, number];
  /** Boss battle: how long the King's strike takes on screen (ms). The move clock stands still meanwhile. */
  kingStrikeMs: number;
  /** Boss battle, the King (the crowd's champion): charges from the ten's leftover power-ups (one per this many, 1 to kingChargesMax). */
  kingPowerUpsPerCharge: number;
  kingChargesMax: number;
  /** Bots call the King when the crowd's popular move loses at least this many points, and back a human's call with this chance. */
  kingBotLoss: number;
  kingBotFollow: number;
  /** Boss battle: below this strength the boss sometimes slips (up to this chance): a small deliberate inaccuracy, never a blunder. */
  bossStumbleBelow: number;
  bossStumbleMax: number;
  /** Boss battle: a slip gives away this many points (from its top moves; the one nearest the middle). */
  bossSlipLoss: readonly [number, number];
  /**
   * Boss battle, the blunder guard: no boss move may give away more than this many points of expected score, nor
   * more than this much in log-odds (the same guard in a position that's already won or lost, where points shrink).
   * Stockfish's own limited strength hangs pieces; a move that would is swapped for a slip.
   */
  bossMaxLoss: number;
  bossMaxLogitLoss: number;
  /**
   * The re-check (reports/judge-accuracy.md): picked moves that lose between these many points are searched
   * again, deeper, before they cost anyone (the most picked first, up to recheckMax, at recheckNodes).
   */
  recheckLoss: readonly [number, number];
  recheckMax: number;
  recheckNodes: number;
  /** Augments: seconds added or taken per vote, and the clock's limits. */
  clockStepSeconds: number;
  clockRange: readonly [number, number];
  lobbySize: number;
  groupSize: number;
  /** The longest a single move may take (seconds), so a round never waits long for anyone. */
  moveClockSeconds: number;
  /** Each player's time bank for the whole match (seconds). Thinking time comes out of it. */
  timeBankSeconds: number;
  /** Added to the bank at the start of every move (seconds), so even an empty bank leaves this long to move. */
  timeIncrementSeconds: number;
  /** Power-ups (reveal the engine's top 3 moves): how many each player starts with. */
  powerUpsAtStart: number;
  /** Power-ups added for every player who survives a cut. */
  powerUpsPerStage: number;
  /** Most power-ups a player can hold (extra ones earned at a full hand are lost). */
  powerUpsMax: number;
  /** Bots use a power-up when the second-best candidate loses at least this many points. */
  botPowerUpLoss: number;
  /** Each player keeps one colour for a whole stage, swapping at stage breaks (needs 2+ boards). */
  colourPerStage: boolean;
  /** A pick arriving this long after the deadline still counts. */
  lateGraceMs: number;
  /** The reveal before the chosen move plays: everyone's moves, then selecting the move. */
  revealSeconds: number;
  /** After the reveal, time for the drawn move to animate before the next round. */
  drawnMoveSeconds: number;
  /**
   * A new board's settling-in time before the move clock starts: a short
   * countdown while the last few moves replay.
   */
  boardIntroSeconds: number;
  /** How long the grid of openings plays before the first round. */
  openingShowSeconds: number;
  /** Multiplayer: how long the stage-break standings show (solo waits for a tap). */
  stageBreakSeconds: number;
  roundsPerStage: number;
  /** Rounds in stage 1, before the first cut: longer, so one bad start doesn't knock anyone out. */
  firstStageRounds: number;
  /** Players knocked out at the end of each knockout stage; the 2v2 final follows. */
  knockoutsPerStage: readonly number[];
  scoresBetweenStages: ScoreCarry;
  missedMoveScore: number;
  /** Draw rule per knockout stage (the last entry covers later stages). */
  drawRuleByStage: readonly DrawRule[];
  /** Weighted draw: a pick's tickets halve for roughly every this-many × 0.7 points of loss (exp(-loss / this)). */
  drawWeightPoints: number;
  /** Opening moves per side played on each board before the first round (0-10, a lobby setting). Boards where Black starts get one ply more. */
  openingMoves: number;
  /** A line qualifies if the side to move's expected score at its end is inside this window. */
  openingBalance: readonly [number, number];
  engineNodes: number;
  engineHashMb: number;
  botCandidateMoves: number;
  /**
   * Bot skill temperatures T (in points of loss), strongest to loosest. Bots get
   * skills spread evenly on a log scale across this range. Chosen in milestone 2.
   */
  botSkillRange: readonly [number, number];
  botRandomMoveChance: number;
  /** Bots' recorded thinking time, for tie-breaks (seconds). */
  botThinkSeconds: readonly [number, number];
  /** The 2v2 final: moves each finalist makes (fewer if the game ends first). */
  finalMovesPerPlayer: number;
  /** In the final, a missed move counts as this many points of loss. */
  finalMissLoss: number;
}

/** "Relaxed" is the default; "quick" shortens the reveal and the settling-in time on a new board. */
export type Pace = "relaxed" | "quick";
export const PACE_SETTINGS: Record<Pace, Partial<Settings>> = {
  relaxed: {},
  quick: { revealSeconds: 3, drawnMoveSeconds: 2.5, boardIntroSeconds: 2 },
};

export const DEFAULT_SETTINGS: Settings = {
  mode: "classic",
  crowdTeams: true,
  augments: true,
  cutClockVote: false,
  finalFormat: "team",
  voteSeconds: 8,
  voteResultSeconds: 2.5,
  teamFinalSizes: [4, 3, 2],
  teamFinalMovesPerStep: 3,
  finalMaxTurns: 160,
  bossKillEvery: 3,
  bossMinSurvivors: 3,
  bossMaxMoves: 60,
  bossEloOffset: -100,
  bossEloRange: [800, 3000],
  bossNodes: 250_000,
  raid: false,
  bossFixedElo: 0,
  kingStrikeLoss: [5, 15],
  kingStrikeMs: 5900,
  kingPowerUpsPerCharge: 10,
  kingChargesMax: 3,
  kingBotLoss: 6,
  kingBotFollow: 0.6,
  bossStumbleBelow: 2100,
  bossStumbleMax: 0.25,
  bossSlipLoss: [2, 7],
  bossMaxLoss: 10,
  bossMaxLogitLoss: 1,
  recheckLoss: [5, 60],
  recheckMax: 3,
  recheckNodes: 700_000,
  clockStepSeconds: 5,
  clockRange: [10, 40],
  lobbySize: 64,
  groupSize: 8,
  moveClockSeconds: 30,
  timeBankSeconds: 600,
  timeIncrementSeconds: 5,
  powerUpsAtStart: 3,
  powerUpsPerStage: 1,
  powerUpsMax: 5,
  botPowerUpLoss: 15,
  colourPerStage: true,
  lateGraceMs: 300,
  revealSeconds: 5,
  drawnMoveSeconds: 4,
  boardIntroSeconds: 5,
  openingShowSeconds: 6,
  stageBreakSeconds: 10,
  roundsPerStage: 5,
  firstStageRounds: 8,
  knockoutsPerStage: [8, 8, 8, 8, 8, 8, 8, 4],
  scoresBetweenStages: "reset",
  missedMoveScore: -25,
  drawRuleByStage: ["popular", "best"],
  drawWeightPoints: 4,
  openingMoves: 4,
  openingBalance: [0.4, 0.6],
  engineNodes: 250_000,
  engineHashMb: 16,
  botCandidateMoves: 8,
  botSkillRange: [0.25, 32],
  botRandomMoveChance: 0.02,
  botThinkSeconds: [3, 20],
  finalMovesPerPlayer: 5,
  finalMissLoss: 25,
};

/** `count` bot skills spread evenly on a log scale across `botSkillRange`, strongest first. */
export function botSkillSpread(count: number, settings: Settings = DEFAULT_SETTINGS): number[] {
  const [lo, hi] = settings.botSkillRange;
  return Array.from({ length: count }, (_, i) => Math.round(lo * Math.pow(hi / lo, i / Math.max(1, count - 1)) * 1000) / 1000);
}

/** Longest opening a lobby can choose, in moves per side. */
export const MAX_OPENING_MOVES = 10;

/** Plies of opening on a board where White starts (Black-start boards get one more). */
export const openingPlies = (s: Pick<Settings, "openingMoves">) => 2 * Math.max(0, Math.min(MAX_OPENING_MOVES, Math.round(s.openingMoves)));

/** Rounds in a knockout stage (stage 0 is the longer first one). */
export const roundsInStage = (s: Pick<Settings, "roundsPerStage" | "firstStageRounds">, stage: number) =>
  stage === 0 ? s.firstStageRounds : s.roundsPerStage;

/**
 * Crowd mode: 100 players on one board from the starting position, the most
 * popular pick always played. No cuts for the first 10 moves (20 plies), then
 * a cut after every move (2 plies) down to the final four, who play the 2v2.
 * Scores carry over all game (a stage is only one move long). 3 power-ups,
 * none earned.
 */
/** Crowd 50 v 50 knockouts for each way to end: they leave 8 (team final), 10 (boss battle) or 2 (duel). */
export const CROWD_KNOCKOUTS: Record<FinalFormat, readonly number[]> = {
  team: [16, 14, 12, 10, 8, 8, 6, 6, 4, 4, 4],
  boss: [16, 14, 12, 10, 8, 8, 6, 6, 4, 4, 2],
  duel: [16, 14, 12, 10, 8, 8, 6, 6, 4, 4, 4, 2, 2, 2],
};
/** Crowd "everyone moves": down to 4 for the 2v2 final. */
export const CROWD_EVERYONE_KNOCKOUTS: readonly number[] = [16, 14, 12, 10, 8, 8, 6, 6, 4, 4, 4, 2, 2];

export const CROWD_SETTINGS: Partial<Settings> = {
  mode: "crowd",
  lobbySize: 100,
  groupSize: 100,
  knockoutsPerStage: CROWD_KNOCKOUTS.team,
  finalFormat: "team",
  firstStageRounds: 20,
  roundsPerStage: 2,
  scoresBetweenStages: "carry",
  colourPerStage: false,
  drawRuleByStage: ["popular"],
  powerUpsAtStart: 3,
  powerUpsPerStage: 0,
  openingMoves: 0,
  moveClockSeconds: 20,
  boardIntroSeconds: 0,
  // One board from the starting position: no opening grid to show.
  openingShowSeconds: 0.5,
  // Most of the show happens live (picks appear as they're made), so the reveal itself is short.
  revealSeconds: 2.5,
  drawnMoveSeconds: 1.5,
  // The cut is a judgement (the gavel and every player's pawn): 10 s, as Eric asked.
  stageBreakSeconds: 10,
  botThinkSeconds: [2, 14],
};

/**
 * Boss raid: everyone (up to 50, no bots) picks the crowd's moves together
 * against a boss, from a named opening 5 moves in. The boss strikes down to
 * half the group; the King has 3 charges.
 */
export const RAID_SETTINGS: Partial<Settings> = {
  ...CROWD_SETTINGS,
  raid: true,
  crowdTeams: false,
  augments: false,
  lobbySize: 50,
  groupSize: 50,
  knockoutsPerStage: [],
  openingMoves: 5,
  powerUpsAtStart: 0,
};

/** How long the cut screen shows: longer when there's an augment vote to make. */
export const cutSeconds = (s: Pick<Settings, "cutClockVote" | "stageBreakSeconds">) => (s.cutClockVote ? Math.max(s.stageBreakSeconds, 7) : s.stageBreakSeconds);

/**
 * Only the keys that are actually set. Spread over a mode's settings, an
 * unset playtest option (`rounds: undefined`) would otherwise wipe the mode's
 * own value and leave the Classic default in its place.
 */
export function definedOnly<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Settings for a mode (Classic is the default). */
export function modeSettings(mode: GameMode, opts: { crowdTeams?: boolean; augments?: boolean } = {}): Partial<Settings> {
  if (mode !== "crowd") return {};
  return {
    ...CROWD_SETTINGS,
    ...(opts.crowdTeams !== undefined ? { crowdTeams: opts.crowdTeams } : {}),
    ...(opts.augments !== undefined ? { augments: opts.augments } : {}),
    // Everyone moves keeps the 2v2 final of the last four.
    ...(opts.crowdTeams === false ? { knockoutsPerStage: CROWD_EVERYONE_KNOCKOUTS } : {}),
  };
}

export type Augment = "more" | "same" | "less";

/** The move clock after an augment vote (majority wins; a tie or no votes keeps it the same). */
export function clockAfterVote(clock: number, votes: readonly Augment[], s: Pick<Settings, "clockStepSeconds" | "clockRange">): number {
  const n = (a: Augment) => votes.filter((v) => v === a).length;
  const more = n("more");
  const less = n("less");
  const same = n("same");
  const step = more > less && more > same ? s.clockStepSeconds : less > more && less > same ? -s.clockStepSeconds : 0;
  return Math.max(s.clockRange[0], Math.min(s.clockRange[1], clock + step));
}
