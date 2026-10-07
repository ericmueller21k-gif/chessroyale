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
  /**
   * Pre-game votes: seconds to vote, and how long each result shows (it starts with everyone who didn't vote walking
   * to the winner, then the winner's banner).
   */
  voteSeconds: number;
  voteResultSeconds: number;
  /**
   * Pre-game votes: the share of bots that don't vote. When time's up they join the winner with everyone else who
   * didn't vote (people too: "Didn't vote? You're with the crowd").
   */
  voteBotSkip: number;
  /** Pre-game votes: your pawn on the vote board, this many times the size of everyone else's (Eric: "10-15% bigger if that"). */
  voteYouScale: number;
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
  /**
   * Boss battle, the God King's Last Stand (once per game): when the crowd's played move gives away at least the
   * bar (points of expected score against the best move), he takes the blow and the move is undone. The bar starts
   * at lastStandLoss (plus lastStandChargedExtra while he still has charges) and falls linearly with every crowd
   * move to lastStandLossFloor, reached after lastStandDecayMoves crowd moves. Never when the best move was worth
   * less than lastStandFrom (a position that's already lost isn't saved).
   */
  lastStandLoss: number;
  lastStandChargedExtra: number;
  lastStandLossFloor: number;
  lastStandDecayMoves: number;
  lastStandFrom: number;
  /**
   * The Last Stand: he falls with his charges unspent, and leaves them to the crowd. Every player still in gets this
   * many power-ups (the engine's top 3 moves, as in Crowd) for each charge he had left.
   */
  lastStandPowerUps: number;
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
  /**
   * A move clock that changes with the move number instead (the Variable speed: VARIABLE_CLOCK). Empty: every move
   * gets moveClockSeconds. Read the clock with moveClockAt, never one of these two directly.
   */
  moveClockSteps: readonly ClockStep[];
  /** Pre-game votes: whether a player may move their pawn to another zone after voting (Eric: one vote each, for now). */
  voteChangeAllowed: boolean;
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

/**
 * One step of a move clock that rises as the game goes on: from this move on, this many seconds a move. "Move" is the
 * move number the top bar shows ("Move 6"): White's and Black's first moves are both move 1.
 */
export interface ClockStep {
  fromMove: number;
  seconds: number;
}

/**
 * The Variable speed (Crowd 50 v 50's speed vote; Eric's schedule, Oct 7, 2026): 10 s a move for moves 1-5, then 5 s
 * more every 5 moves, up to 30 s from move 21 on. One entry per step, in order; the vote's card, the rules and the
 * clock all read it from here.
 */
export const VARIABLE_CLOCK: readonly ClockStep[] = [
  { fromMove: 1, seconds: 10 },
  { fromMove: 6, seconds: 15 },
  { fromMove: 11, seconds: 20 },
  { fromMove: 16, seconds: 25 },
  { fromMove: 21, seconds: 30 },
];

/**
 * The move clock (seconds) on a move number: the step that move falls in (the first step before the schedule
 * starts), or moveClockSeconds when there's no schedule. Every place that sets a clock (solo, the lobby server, the
 * finals, the bots' timing, the timer on screen) goes through this.
 */
export function moveClockAt(s: Pick<Settings, "moveClockSeconds" | "moveClockSteps">, move: number): number {
  const steps = s.moveClockSteps ?? [];
  if (!steps.length) return s.moveClockSeconds;
  const sorted = [...steps].sort((a, b) => a.fromMove - b.fromMove);
  let seconds = sorted[0]!.seconds;
  for (const step of sorted) if (move >= step.fromMove) seconds = step.seconds;
  return seconds;
}

/** A schedule as the rules show it: moves 1-5 10 s, 6-10 15 s, …, 21 on 30 s (`to` is null for the last step). */
export function clockStepRanges(steps: readonly ClockStep[]): { from: number; to: number | null; seconds: number }[] {
  const sorted = [...steps].sort((a, b) => a.fromMove - b.fromMove);
  return sorted.map((s, i) => ({ from: s.fromMove, to: i + 1 < sorted.length ? sorted[i + 1]!.fromMove - 1 : null, seconds: s.seconds }));
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
  voteResultSeconds: 3.2,
  voteBotSkip: 0.1,
  voteYouScale: 1.12,
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
  lastStandLoss: 30,
  lastStandChargedExtra: 5,
  lastStandLossFloor: 13,
  lastStandDecayMoves: 22,
  lastStandFrom: 40,
  lastStandPowerUps: 1,
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
  moveClockSteps: [],
  voteChangeAllowed: false,
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

/** How a top rank's pill stands out: a gold ring and sheen, a glow, or a prismatic fill. */
export type RankEffect = "gilt" | "glow" | "prism";

export interface RankDef {
  name: string;
  /** The lowest rating in this rank (on the engine rating's scale). */
  from: number;
  /** Its pill colour (a prism pill paints a rainbow instead; this is its colour elsewhere). */
  color: string;
  effect?: RankEffect;
}

/**
 * The player ranks, lowest first. The names honour Puzzle Pirates, whose skill ladder they are (Eric, Oct 6, 2026).
 * Cutoffs are fixed and rounded to 50, set so a chess-like spread of ratings (centre 1500, SD 350) lands about
 * 5 / 7 / 9 / 10 / 11 / 12 / 11 / 10 / 9 / 7 / 5 / 2.5 / 1.2 / 0.3 % in each, lowest first; the shares these cutoffs
 * actually give are in DECISIONS.md ("The rank ladder"). Colours climb from dull grey through earth, green and sky to
 * violet, and the top three are special. Each colour keeps its pill readable on both themes (4.5:1 or better).
 */
export const RATING_RANKS: readonly RankDef[] = [
  { name: "Novice", from: 0, color: "#a2a6ad" },
  { name: "Neophyte", from: 950, color: "#b0a590" },
  { name: "Apprentice", from: 1100, color: "#c0a180" },
  { name: "Narrow", from: 1250, color: "#d3996f" },
  { name: "Broad", from: 1350, color: "#a3b053" },
  { name: "Solid", from: 1450, color: "#6cbd5e" },
  { name: "Weighty", from: 1550, color: "#3fc28e" },
  { name: "Expert", from: 1650, color: "#35bfc6" },
  { name: "Paragon", from: 1750, color: "#52abf1" },
  { name: "Illustrious", from: 1850, color: "#91a1fa" },
  { name: "Sublime", from: 1950, color: "#bc93f8" },
  { name: "Revered", from: 2100, color: "#f2c14e", effect: "gilt" },
  { name: "Exalted", from: 2250, color: "#ff7e4a", effect: "glow" },
  { name: "Transcendent", from: 2450, color: "#f472b6", effect: "prism" },
];

/**
 * The front door (home, queue, profiles): the live line's timing, the queue's show, and the rank ladder.
 * See DECISIONS.md, "The front door".
 */
export const FRONT_DOOR = {
  /** Online = seen (any request from the app) within this long. */
  onlineWindowMs: 60_000,
  /** The live line refreshes this often while a front-door screen is open… */
  livePollMs: 5_000,
  /** …and the app says "still here" this often everywhere else (a match), so players in matches count as online. */
  heartbeatMs: 30_000,
  /** A running match counts while its lobby has reported within this long (it reports at least once a minute). */
  matchStaleMs: 3 * 60_000,
  /** The queue: after the fill time, bots pop into the empty seats for this long before the match begins. */
  fillShowMs: 1_800,
  /** The typical wait shown under PLAY: the median of the last this-many matchmade starts (within a week). */
  waitSamples: 20,
  /** Players with a rating needed before a profile shows its percentile ("Top 18%"). */
  percentileMinPlayers: 10,
  /** The rank ladder (RATING_RANKS) a rating is named by. */
  ratingRanks: RATING_RANKS,
} as const;

/**
 * How you're matched (the home screen's "Matchmaking", for every mode; see DECISIONS.md, "Matchmaking types"):
 *   - default: real players; bots fill the empty seats once the queue has waited a minute;
 *   - botsoff: real players only; the lobby waits until it's full (a raid: see raidBotsOff*);
 *   - solo: you and bots, starting at once (played in your browser, like solo before).
 */
export type MatchmakingType = "default" | "botsoff" | "solo";
export const MATCHMAKING_TYPES: readonly MatchmakingType[] = ["default", "botsoff", "solo"];

export const MATCHMAKING = {
  /** Solo: the bots pop into their seats over this long, then the seats stay full this long before the match begins. */
  soloFillMs: 2_200,
  soloHoldMs: 900,
  /**
   * Bots off, a boss raid: it starts when 50 have joined, or once it has waited the queue's usual minute with at least
   * this many people (a raid of 10 is a real crowd: the same size as the Crowd's boss battle). A 50 v 50 waits until
   * it's full.
   */
  raidBotsOffMinPlayers: 10,
  /** Bots off → Default ("let bots fill"): your wait so far counts, but the bots never fill sooner than this. */
  switchMinWaitMs: 5_000,
} as const;

/**
 * Ranking (the rating and rank on your profile, its chart and "Top N%"): a match changes them only if no more than this
 * share of its players were bots (Eric, Oct 7, 2026). Solo games are never ranked (all bots, and no server saw them).
 */
export const RANKING = {
  rankedMaxBotShare: 0.25,
} as const;

/** A match counts for your ranking when no more than RANKING.rankedMaxBotShare of its players are bots. */
export function isRankedMatch(bots: number, players: number, maxBotShare: number = RANKING.rankedMaxBotShare): boolean {
  return players > 0 && bots / players <= maxBotShare;
}

/**
 * What bots wear on the vote board and the cut screen (core/bot-looks.ts), seeded by the bot's name so a bot always
 * looks the same. Mostly one thing, rarely two, plenty plain (Eric: nothing "crazy decked out"). Only items that
 * already exist: the shop's hats, and the crates' head, face and weapon pieces (no skins: they hide the team's
 * colour; not the Mythic crown: that one stays the players'). See DECISIONS.md, "Vote board follow-ups".
 */
export const BOT_LOOKS = {
  /** Out of 100: nothing on; one shop hat; one crate head piece; one face piece; one weapon; two things. */
  odds: { plain: 42, shopHat: 24, head: 11, face: 11, weapon: 5, two: 7 },
  shopHats: ["party", "crown", "wizard", "top", "viking"],
  head: ["beanie", "antlers", "santa-hat", "present"],
  face: ["santa-beard", "ski-goggles"],
  weapon: ["gift-tube", "candy-cane"],
  /** Two things: a hat (a shop hat or a crate head piece, evenly) and then a face piece, or now and then a weapon. */
  twoWeaponShare: 0.3,
  /** A crate item's purity (%), evenly in this range: clean enough to read on a small pawn, never shiny (90%+). */
  purity: [55, 88],
} as const;

/**
 * How long a lobby lives (see DECISIONS.md, "Closing finished lobbies"). When a lobby closes, its Durable Object
 * deletes everything it stored and its code is free again; a link to it then opens the home screen with a note.
 */
export const LOBBY_LIFE = {
  /** After a match ends, its results stay up this long (see your place, say GG, share), then the lobby closes. */
  lobbyResultsKeepMinutes: 15,
  /** A lobby that never started (a private one nobody started, a queue everyone left) closes after this long with nothing happening in it. */
  lobbyIdleMinutes: 60,
  /**
   * Safety cap for a match in progress that nobody is connected to: it closes after this long without hearing from
   * anyone. A match left to itself still plays out (no move waits for long), and the longest, a team final to its
   * 160-turn cap, takes about an hour and a half; so a running match always reaches its results first, and this only
   * clears one that's stuck. Never while anyone is connected.
   */
  lobbyAbandonedMinutes: 180,
} as const;

/**
 * Quick chat in matches (preset phrases and emoji only; see DECISIONS.md, "Quick chat in matches"). The server
 * enforces the limits; the app mirrors them to grey out its buttons.
 */
export const QUICK_CHAT = {
  /** One message every this long… */
  minGapMs: 3_000,
  /** …and at most this many in this long. */
  burstMax: 5,
  burstWindowMs: 30_000,
  /** The same line as your last one, again within this long, is dropped. */
  repeatMs: 30_000,
  /** The feed keeps the last this-many messages (the computer's panel shows them all; a phone's split the newest few). */
  feedSize: 30,
  /** The server keeps this many lines (both teams together) to send a player who reconnects. */
  logSize: 60,
  /** Phone: the newest message shows this long as a one-line bubble under the top bar, while chat is hidden. */
  bubbleMs: 2_000,
  /** An emoji floats above its sender's row on the scoreboard this long. */
  emojiFloatMs: 2_400,
  /** The soft tick for a team message, at most this often; its level is a fraction of the clock's tick (itself softer than a move). */
  tickGapMs: 400,
  tickLevel: 0.25,
  /** Bots chat a little: at most this many lines a minute across every bot in the lobby. */
  botMaxPerMinute: 3,
  /** "Good luck!" as the match begins: the odds, and how many bots at most. */
  botStartChance: 0.9,
  botStartMax: 2,
  /** "Nice move!" after a great crowd move (the move played lost at most this many points): the odds. */
  botGreatMoveChance: 0.3,
  botGreatMoveLoss: 1,
  /** "GG" at the end: the odds, and how many bots at most. */
  botEndChance: 0.9,
  botEndMax: 2,
  /** A bot's line comes this long after the moment (ms, random in the range), like a person typing. */
  botDelayMs: [1_500, 6_000] as readonly [number, number],
  /**
   * The profile's picks (Quick chat and emoji): the lines and emoji a player sees in their games, in their order.
   * At most this many lines, and this many emoji (one row on a phone's full-width chat, no scrolling).
   */
  maxLines: 10,
  maxEmoji: 8,
  /** Everyone's picks until they choose their own (new and existing players alike): free lines and emoji only. */
  defaultLines: ["good-luck", "have-fun", "nice-move", "wow", "oops", "trust-crowd", "defend-king", "go-mate", "gg", "thanks"] as readonly string[],
  defaultEmoji: ["e-thumbs", "e-clap", "e-laugh", "e-wow", "e-grimace", "e-fire", "e-skull", "e-party"] as readonly string[],
  /** Shop prices of the packs, in coins (everything is free while SHOP_FREE is on). */
  packPrices: {
    godking: 300,
    winter: 200,
    spicy: 250,
    "emoji-chess": 200,
    "emoji-winter": 200,
    "emoji-royal": 300,
  } as Readonly<Record<string, number>>,
} as const;
