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
  /**
   * Which boss (a BOSS_ROSTER id): the one picked, if it's playable; "" for a random playable boss, not `bossAvoid`
   * when there's another (your last boss solo; online, the one most of the lobby met last).
   */
  bossId: string;
  bossAvoid: string;
  /** Test switch (?power=freeze|blizzard|pie|funhouse|sparkler|candle): that power comes at once (an ultimate after its warning). */
  bossPowerTest: string;
  /** Solo's difficulty (BOSS_DIFFICULTY): Elo on top of the boss's strength, within what the engine plays (0 online). */
  bossDifficulty: number;
  /** Testing, solo only (?wip=1): `bossId` may be a boss whose powers are built but whose art isn't yet (placeholders). */
  bossUnfinished: boolean;
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
  /**
   * Close calls that can decide a cut (online, re-checked on the engine server): picks by players whose stage score
   * is within recheckCutPoints of the cut line are re-checked first, over this wider range of losses, up to
   * recheckCutMax moves a board (on top of the usual ones, up to recheckMax in all when there are fewer).
   */
  recheckCutLoss: readonly [number, number];
  recheckCutMax: number;
  recheckCutPoints: number;
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
  bossId: "",
  bossAvoid: "",
  bossPowerTest: "",
  bossDifficulty: 0,
  bossUnfinished: false,
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
  recheckCutLoss: [1, 60],
  recheckCutMax: 5,
  recheckCutPoints: 25,
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

/**
 * Boss powers (boss-powers.ts in the chess package). Turns are the crowd's moves. Every power is decided on the
 * server from the match's seed and the position, never breaks check and never leaves the crowd without a move.
 */
export const BOSS_POWERS = {
  /** The first passive comes as this crowd turn begins. */
  firstPassive: 2,
  /** Freeze: a crowd piece (never the king) is iced for this many crowd turns, every 4 to 6 turns (from its start). */
  freezeTurns: 2,
  freezeEvery: [4, 6] as readonly [number, number],
  /** Pie: a square near the centre is pied for this many crowd turns (nobody may move onto it), then this many clear. */
  pieTurns: 3,
  pieGap: 2,
  /**
   * The ultimate's meter (the rage meter), in rage points: full at rageFull, then a one-turn warning, then the
   * ultimate, once per match. It fills over time (ragePerMove each crowd move, so on its own it's full after about
   * 20 crowd moves, around the middle of a battle), faster while the crowd is ahead on the judged eval (up to
   * rageAheadMax more a move, all of it from rageAheadFull expected score), and with the boss's own material lost
   * (ragePerMaterial a point: a queen's worth fills it alone, as before). rageOverTime false: material only.
   */
  rageFull: 100,
  rageOverTime: true,
  ragePerMove: 5,
  rageAheadMax: 5,
  rageAheadFull: 0.75,
  ragePerMaterial: 100 / 9,
  /** The meter glows from this full (0-1) as it nears its ultimate. */
  rageGlowFrom: 0.75,
  /**
   * The test trigger: admins (ADMIN_EMAILS) see a small "Trigger ultimate (testing)" button in any boss battle, which
   * brings the boss's ultimate as the next crowd turn begins (no warning). false removes it everywhere, server too.
   */
  ultimateTestButton: true,
  /** The funhouse: the boss plays the crowd's move, one that gives away this many points against the best (1 to 2.5 pawns). */
  funhouseLoss: [10, 25] as readonly [number, number],
  /** ...and never one that gives away more than this in log-odds (a lost cause stays a fight). */
  funhouseMaxLogit: 1.6,
  /** After the funhouse the crowd sees the board flipped for this many of its turns. */
  flipTurns: 2,
  /**
   * G-REX's fire tiles: a tile burns in fireStages stages, one a crowd turn (a singe, more burn, ablaze); after the
   * crowd's move on its last stage, a crowd piece still on it is destroyed (never the king: it fizzles). Then
   * fireGap turns with no fire before he throws the next sparkler.
   */
  fireStages: 3,
  fireGap: 1,
  /** The judge counts a piece left to burn as gone: this many log-odds of expected score per pawn of its value. */
  firePawnLogit: 1,
  /**
   * The Roman candle: the shots he fires, and the waves they fall in (one a crowd turn, ramping up then down), from
   * this many crowd moves on. 24 shots (Eric, Oct 9; was 12 in 1, 2, 3, 4, 2).
   */
  candleShots: 24,
  candleWaves: [1, 2, 3, 4, 4, 4, 3, 2, 1] as readonly number[],
  candleDelay: 3,
  /**
   * Each wave's squares are picked this many crowd turns before it lands (at most candleDelay), and show a shadow
   * that grows each turn: small, bigger, bigger again, then the fireball drops onto it.
   */
  candleAhead: 3,
} as const;

/** BOSS_POWERS with room for other numbers (tests, and the switch turned off). */
export type BossPowerSettings = {
  -readonly [K in keyof typeof BOSS_POWERS]: (typeof BOSS_POWERS)[K] extends boolean ? boolean : (typeof BOSS_POWERS)[K] extends number ? number : (typeof BOSS_POWERS)[K];
};

/** Solo's difficulty: Elo on top of the boss's usual strength (yours), capped at what the engine plays. */
export const BOSS_DIFFICULTY = [
  { id: "easy", label: "Easy", elo: -300 },
  { id: "normal", label: "Normal", elo: 0 },
  { id: "hard", label: "Hard", elo: 250 },
  { id: "hardest", label: "Hardest", elo: 500 },
] as const;
export type BossDifficultyId = (typeof BOSS_DIFFICULTY)[number]["id"];

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
 * The home page's live window (a computer's; DECISIONS.md, "The live window"): a real match when one is running, else
 * bot-match replays (packages/app/public/replays/crowd-bots.json, made by packages/sim/scripts/bot-replays.ts) played
 * one after another on a cycle set by the clock, so everyone watching sees the same moment. More replays make the
 * cycle longer (toward a day without repeats).
 */
export const LIVE_WINDOW = {
  /** Seconds each crowd move shows (the vote, then the move): about what a Crowd round with bots takes. */
  plySeconds: 9,
  /** A final's moves, one player each: quicker. */
  finalPlySeconds: 6,
  /** The starting position before a replay's first move, and its result after its last. */
  startSeconds: 6,
  endSeconds: 14,
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
  /**
   * Bots off: a seat whose person has been gone this long is freed before anyone else joins (or a raid begins), so the
   * count is real and a full lobby never starts with people who left. Back while it still waits: a new seat.
   */
  botsOffSeatHoldMs: 120_000,
} as const;

/**
 * Ranking (the rating and rank on your profile, its chart and "Top N%"): a match counts toward it only if at least this
 * share of its seats are real players (Eric, Oct 7, 2026: the ranked draft's 30 of 100, over his earlier "more than 25%
 * bots" rule). Scaled to each mode's seats: 30 of a 50 v 50's 100, 15 of a raid's 50, 20 of Classic's 64. Solo games
 * never count (all bots, and no server saw them).
 */
export const RANKING = {
  rankedMinHumanShare: 0.3,
} as const;

/** The real players a match needs to count for ranking, in a mode with this many seats (30 of 100; 15 of a raid's 50). */
export function rankedMinHumans(seats: number, share: number = RANKING.rankedMinHumanShare): number {
  return Math.ceil(seats * share - 1e-9);
}

/** A match counts for ranking when its real players fill at least RANKING.rankedMinHumanShare of its seats. */
export function isRankedMatch(humans: number, seats: number, share: number = RANKING.rankedMinHumanShare): boolean {
  return seats > 0 && humans >= rankedMinHumans(seats, share);
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
 * Many judges (see DECISIONS.md, "Many judges"): online, each board's scoring job goes to two players' devices,
 * chosen at random by the lobby (faster devices more often), and the lobby compares their answers. Agreement: used.
 * Disagreement: the engine server's deeper search decides, and a device whose answer was off gets a strike.
 */
export interface JudgeConfig {
  on: boolean;
  perJob: number;
  tolerance: number;
  blameMargin: number;
  soloBlame: number;
  strikes: number;
  spotCheckShare: number;
  graceMs: number;
  graceFactor: number;
  speedWeight: number;
  benchNodes: number;
  defaultNps: number;
  deepOnDevices: boolean;
  deepNodes: number;
  deepWindowMs: number;
  deepHeadroom: number;
  deepMinNodes: number;
  deepWaitMs: number;
  refereeWaitMs: number;
}

export const JUDGES: JudgeConfig = {
  /** The switch: off, the lobby's host scores every round as before (one device, the engine server re-checking close calls). */
  on: true,
  /** Devices per job (with fewer devices connected that can judge, as many as there are; one: the host, as before). */
  perJob: 2,
  /**
   * How far two answers may differ (expected score, 0 to 1) and still agree. The browser engine is deterministic
   * (reports/judge-determinism.md: identical numbers on separate engines, used or fresh), so an exact match.
   */
  tolerance: 0,
  /**
   * Blame after the engine server's verdict: the judge whose losses are further from the verdict's gets a strike, if
   * further by at least this many points (one move's worst difference). Below it, it's within the engine-to-engine
   * noise between a phone's quick search and the server's deep one, and nobody is blamed.
   */
  blameMargin: 4,
  /**
   * A spot check (one judge's answer, checked on the engine server afterwards) blames it only when some move's loss
   * is at least this many points off the server's: beyond the worst honest difference measured (see
   * reports/judge-determinism.md), so only a gross lie is caught this way.
   */
  soloBlame: 50,
  /** Strikes before a device is given no more jobs this match. */
  strikes: 2,
  /**
   * Share of jobs answered by one judge only, the other gone without answering (dropped, timed out), that the engine
   * server checks afterwards. (A late judge's answer is compared with the one used when it comes, instead.)
   */
  spotCheckShare: 0.25,
  /**
   * After the first judge answers, how long the lobby waits for the second (ms), at least, or this fraction of the
   * time the first took, whichever is longer, before using the first answer alone (so a round is never held up by a
   * slow phone). The late answer is still compared when it comes, for blame (the scores used stand).
   */
  graceMs: 150,
  graceFactor: 0.25,
  /** Choosing judges: weight = (nodes per second) ^ speedWeight, so a computer judges more often than a phone. */
  speedWeight: 3,
  /** A device's speed check on joining: one search of this many nodes, timed. */
  benchNodes: 150_000,
  /** A device that hasn't reported its speed yet counts as this fast (nodes/s): a typical phone. */
  defaultNps: 250_000,
  /**
   * Deep checks on players' computers (DECISIONS.md, "Deep checks on players' computers"): with two capable devices
   * judging a board, they re-check its close calls themselves, and the engine server is asked only when they
   * disagree or are late. OFF: the browsers' engine (the lite network) re-checks less accurately than the engine
   * server (reports/deep-accuracy.md: unfair cuts of top-quarter players 0.63% against 0.37%), and Eric's rule puts
   * fair scoring first. On only with an engine on the devices as good as the server's.
   */
  deepOnDevices: false,
  /** The re-check's node count at most: the engine server's (shared by the round's boards, as the server's is). */
  deepNodes: 2_000_000,
  /**
   * The time the re-check may take on a device: what the engine server takes today (2M nodes at about 700k nodes/s),
   * so no round waits longer. A job's node count is what the slower of its two devices does in this time, with
   * `deepHeadroom` to spare, capped at deepNodes (reports/deep-timing.md: a speed check's reading is the re-check's speed).
   */
  deepWindowMs: 3_000,
  deepHeadroom: 0.85,
  /**
   * A capable device: a computer (never a phone: a 2M-node search every round drains a battery) that can re-check at
   * least this many nodes in the window (so 1M nodes: about 390k nodes/s on its speed check).
   */
  deepMinNodes: 1_000_000,
  /** After the quick answers settle, how long the lobby waits for both devices' re-checks before asking the server. */
  deepWaitMs: 3_500,
  /** A dispute settled two of three: how long it waits for the third device's answer. */
  refereeWaitMs: 5_000,
};

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
 * Quick chat in matches and in the lobby before them (preset phrases and emoji only; see DECISIONS.md, "Quick chat
 * in matches" and "Lobby chat"). The server enforces the limits; the app mirrors them to grey out its buttons.
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
   * The queue's lobby chat (before the match): "Hi all!" as the bots take their seats. The odds, how many bots at
   * most, how long after they sit down (ms, random in the range) and how far apart. Short: the full grid shows only
   * FRONT_DOOR.fillShowMs (1.8 s) before the votes, and Solo's whole queue is MATCHMAKING.soloFillMs + soloHoldMs
   * (3.1 s). The same per-minute cap as every bot line (botMaxPerMinute), so the match's own "Good luck!" makes it
   * three at most.
   */
  botLobbyChance: 1 as number,
  botLobbyMax: 2,
  botLobbyDelayMs: [300, 900] as readonly [number, number],
  botLobbyGapMs: 500,
  /** The queue's lobby chat on a phone: the feed shows at least this many whole lines (more when there's room). */
  lobbyFeedLines: 2,
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

/**
 * Bots chat in the home page's global chat, so it isn't empty during the beta (Eric, Oct 9, 2026). Every bot line is
 * tagged "bot". **Eric wants this off when the game goes live: set it to false.**
 */
export const GLOBAL_CHAT_BOTS: boolean = true;

/**
 * The home page's global chat (a computer's right column, under Playing now): preset lines only, like quick chat.
 * See DECISIONS.md, "Global chat on the home page".
 */
export const GLOBAL_CHAT = {
  /** One message per account every this long (the server enforces it; the app only mirrors it). */
  gapMs: 30_000,
  /** The server keeps this many lines for newcomers, and the panel shows at most this many. */
  keep: 50,
  /** Lines older than this aren't shown any more. */
  maxAgeMs: 24 * 60 * 60_000,
  /** With GLOBAL_CHAT_BOTS on, a bot says something about this often (ms, random in the range) while someone has it open… */
  botGapMs: [30_000, 90_000] as readonly [number, number],
  /** …and the first this soon after someone opens it when nobody had it open. */
  botFirstMs: [4_000, 15_000] as readonly [number, number],
  /**
   * Someone has the chat open while their app has asked for it within this long. It asks with the live line (every
   * FRONT_DOOR.livePollMs on the home screen), so no new request or socket.
   */
  watchMs: 15_000,
} as const;

/**
 * Capacity (the `ops` delegate): the matchmaker's batches and admission, overload, presence and the live line's
 * write limits, and the API's rate limits. See DECISIONS.md, "Capacity: built".
 */
export const CAPACITY = {
  queue: {
    /**
     * PLAY presses are placed in lobbies in batches: a batch starts as soon as the last one is done (so a lone press
     * isn't held up), and again this often while anyone waits in line.
     */
    formEveryMs: 1_000,
    /** POST /api/play waits up to this long for a seat; past it the answer is "busy, you're in line". */
    holdMs: 2_500,
    /** Players let into lobbies per second, per queue, with this much burst; a bigger surge waits in line. */
    admitPerSecond: 300,
    admitBurst: 600,
    /** A ticket in line is dropped when its player stops asking for this long (they left). */
    ticketTtlMs: 15_000,
    /** A placed ticket's lobby is remembered this long, so a retried request gets the same lobby. */
    placedKeepMs: 60_000,
    /** A seat given to a ticket is held in its lobby this long for the player to connect. */
    reservationMs: 20_000,
    /** A player in line asks again this often. */
    retryMs: 3_000,
    /** Separate queues per region (continent), when there are players enough for it. Off: one queue per mode. */
    byRegion: false,
  },
  overload: {
    /**
     * People in lobbies (queues and matches) past which new players wait in line ("Servers are busy, you're in
     * line: about N s") until others finish. Players already in a lobby or a match are never affected.
     */
    maxPlayers: 20_000,
  },
  presence: {
    /** `users.last_seen` (profiles' "last seen") is written to D1 at most this often per account. */
    lastSeenWriteMs: 60_000,
    /** Each Worker instance tells the live hub who it has seen at most this often. */
    flushMs: 5_000,
    /** A lobby tells the live hub about a change at most this often (and at least once a minute while it runs). */
    lobbyReportMs: 2_000,
  },
  /**
   * Requests per window, counted per Worker instance (a runaway client or script, not a person playing). Sized well
   * above the app's own bursts: a match screen makes several calls each time it opens, so a phone reloading or
   * reconnecting over and over can make a few hundred a minute.
   */
  rateLimits: {
    /** Generous: a school or a mobile network puts many players behind one address. */
    perIp: { limit: 10_000, windowMs: 60_000 },
    /** Well above a burst of reloads; a script hammering in a loop makes hundreds a second. */
    perUser: { limit: 1_200, windowMs: 60_000 },
    /** PLAY and new lobbies (a player in line asks every 3 s). */
    play: { limit: 40, windowMs: 60_000 },
  },
} as const;

/**
 * Fair play (the `fairplay` delegate): reports, cases and what each level does. See DECISIONS.md, "Fair play".
 *   - watch: recorded only (the player's moves are kept as evidence);
 *   - review: a person (or the automated reviewer) looks; meanwhile their results are held off ranking (the rating,
 *     its chart, "Top N%", later leaderboards and ranked) until cleared;
 *   - banned: no online play (solo stays open), with an appeal.
 */
export const FAIRPLAY = {
  /**
   * What detection may do on its own: "watch" records levels but acts on none of them (until the simulation's numbers
   * are in DECISIONS), "review" also opens reviews, "ban" also bans on overwhelming evidence. Reports, admins and the
   * automated reviewer act whatever this says.
   */
  enforcement: "ban" as "watch" | "review" | "ban",
  reports: {
    /** What a report can be about (the sheet's buttons, in order). Only "cheating" counts towards an automatic review. */
    reasons: ["Cheating", "Offensive name or icon", "Something else"] as const,
    /** Reports one account can make a day (one per player per match; outside a match one per player a day). */
    perDay: 20,
    /** Cheating reports from this many different signed-in accounts within `reviewDays` put a player in review. */
    reviewReporters: 3,
    reviewDays: 7,
    /** A new account (fewer than `newAccountMatches` online matches) goes to review with this many instead. */
    newAccountMatches: 10,
    newAccountReporters: 2,
  },
  /** Evidence (each judged move of a match): kept this many days when the player was flagged or reported, otherwise this few. */
  evidenceDays: 30,
  evidenceDaysUnflagged: 3,
  /** Entering review holds the player's online results from this many days back (the matches that put them there). */
  holdBackDays: 7,
  /**
   * The deep re-check (server/fairplay-deep.ts): a flagged player's counted moves searched again on the engine server
   * (native Stockfish, the full network), restricted to the judges' top moves and the pick. "Deep match": the pick is
   * the deep search's best. Run by the Worker's schedule: cases in review at once, others off-peak, within a daily
   * budget of its own (its own container instance, so matches never wait behind it).
   */
  deep: {
    nodes: 2_000_000,
    /** Matches queued for it: a match scoring this much, or any match of a player with an open case or a report. */
    queueScore: 2,
    /** Searches a day, and per scheduled run. */
    dailySearches: 500,
    perRun: 40,
    /** Off-peak hours (UTC, from-to): watch cases are checked only then; reviews any time. */
    offPeakUtc: [3, 10] as readonly [number, number],
    /** The candidate moves searched: the judges' best this many, plus the pick. */
    candidates: 8,
  },
  /**
   * Signals (core/fairplay.ts): which positions count, and what each signal measures. Tuned by the simulation
   * (reports/fairplay.md).
   */
  signals: {
    /** The opening: plies from the starting position that never count (4 moves each). */
    bookPlies: 8,
    /** A pick within this many points of the best found it. */
    foundLoss: 1,
    /** Position complexity: moves within this many points of the best (of those the judges scored). */
    nearPoints: 2,
    /** An only move: every other scored move loses at least this many points. */
    onlyGap: 20,
    /** Only moves and recaptures are skipped when at least this share of the crowd found them, or there's no crowd. */
    obviousShare: 0.5,
    /** Already won or lost: the best move's expected score is below this or above 1 minus it. */
    decided: 0.03,
    /** The crowd's rates need at least this many other people picking (not practising, no power-up). */
    minCrowd: 8,
    /** A hard position: fewer than this share of the crowd found the best move. */
    hardShare: 0.1,
    /** Match strength: the engine rating over counted moves, starting as if this many 1500-level moves came first. */
    perfPriorMoves: 4,
    /**
     * The evidence model (core/fairplay.ts, honestChance), fitted on the simulation's honest players: [g0, g1, d0, d1]
     * with a crowd, [a, b] without, for the judges' best and for the deep re-check's best.
     */
    findJudge: [0.88, -0.08, -0.13, 0.22, -3.27, 0.8] as readonly number[],
    findDeep: [0.8, -0.14, -0.3, 0.06, -4, 0.9] as readonly number[],
    /** The same for the pick being in the deep re-check's top 3 (from the crowd's share of those three). */
    findDeep3: [0.86, -0.09, -0.02, 0.3] as readonly number[],
    soloFound: [-0.53, 0.24] as readonly number[],
    soloDeep: [-1.17, 0.2] as readonly number[],
    soloDeep3: [0.29, 0.26] as readonly number[],
    /** The old shift model's slope (log-odds per 400 rating points), kept for the report's comparison. */
    hardSlope: 0.24,
    crowdRating: 1500,
    /**
     * The honest strength a player's picks are measured against: the higher of their own history and this match, but
     * never stronger than this (past it, picking like an engine is itself the evidence).
     */
    strengthCap: 2700,
    /** An engine user picks the judges' best at least this often, wherever the crowd stands (the evidence's other side). */
    cheatFind: 0.8,
    /**
     * An engine user's picks against the deep re-check: its best this often, one of its next two, neither (its own
     * engine, depth or version can differ from ours).
     */
    cheatDeep: [0.85, 0.13, 0.02] as readonly [number, number, number],
    /** Timing: a hard find this fast is suspicious; timing needs this many counted moves with a crowd. */
    fastHardMs: 5_000,
    minTimed: 8,
    /** Timing: think time this little correlated with difficulty (Spearman) is "the same whatever the difficulty". */
    flatCorr: 0.1,
  },
  /** The suspicion score: points per signal (each capped), from one match's signals. */
  score: {
    /** Match strength: points per `perfPer` rating above `perfFrom`, once `minCounted` moves count. */
    minCounted: 8,
    perfFrom: 2600,
    perfPer: 100,
    perfMax: 6,
    /** A jump: this far above the player's own history (3+ matches) or rating. */
    jumpFrom: 500,
    jumpPer: 200,
    jumpMax: 3,
    /** Evidence (the log-likelihood that the picks are an engine's rather than an honest player's): points per unit. */
    evidencePer: 1,
    evidenceMax: 14,
    /** A run of found moves (counted ones) this long or longer. */
    streakFrom: 10,
    streakPer: 0.5,
    streakMax: 2,
    /** Timing: per fast hard find (beyond the first), and flat timing. */
    fastPer: 0.5,
    fastMax: 2,
    flat: 1,
    /** Look-aways: moves with a look-away, found at least this often and this much more than the rest. */
    awayMoves: 3,
    awayRate: 0.8,
    awayLift: 0.3,
    away: 2,
  },
  /** Levels from the last matches' scores (newest first, within `windowDays`, at most `windowMatches`). */
  levels: {
    windowDays: 30,
    windowMatches: 10,
    watch: 3,
    /** Review: one match this high, or the best two adding up to this. */
    reviewOne: 8,
    reviewTwo: 12,
    /**
     * Auto-ban: only overwhelming evidence, and only from matches the deep re-check has gone through (`banMatchChecked`
     * moves or more each). Either at least `banMatches` such matches in the window whose evidence adds up to `banEvidence`, with `banDeepChecked` moves
     * checked among them, a deep-match share of `banDeep` and a best match strength of `banPerf`; or one match past
     * every `banOne*` bar.
     */
    banMatches: 2,
    /** (A match counts towards a ban only with this many of its moves deep-checked.) */
    banMatchChecked: 8,
    banEvidence: 9,
    banDeepChecked: 16,
    banDeep: 0.8,
    banPerf: 2200,
    banOneEvidence: 11,
    banOneDeepChecked: 12,
    banOneDeep: 0.9,
    banOnePerf: 2400,
  },
} as const;
