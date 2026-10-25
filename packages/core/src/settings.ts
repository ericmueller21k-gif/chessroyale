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
 * - boss: the top 4 team up on a fresh board against the Hidden Boss (Eric, Oct 14: always him, `crowdFinalBoss` in boss.ts)
 * - duel: the best player on each side plays 1v1 to the end
 */
export type FinalFormat = "team" | "boss" | "duel";

/**
 * How a Crowd 50 v 50's game starts (the pre-game vote "How does it start?", Eric, Oct 24): the usual starting position,
 * a balanced named opening `CROWD_START.randomOpeningMoves` moves in, or Freestyle (FIDE's name for Chess960: the back-row
 * pieces shuffled, a seeded start, never the usual one).
 */
export type CrowdStart = "normal" | "random" | "freestyle";

/** The start vote's numbers: how many moves per side a random opening is played in before move 1 of the vote's game. */
export const CROWD_START = {
  randomOpeningMoves: 4,
} as const;

export interface Settings {
  mode: GameMode;
  /**
   * Crowd: two teams, 50 v 50, each playing one side all game. False only in a boss raid (RAID_SETTINGS): everyone
   * picks the crowd's moves against the boss.
   */
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
  /** Boss raid (a mode of its own): up to 50 players against a boss, no bots, from the starting position. */
  raid: boolean;
  /** Boss raid: the boss's strength, set from the lobby's ratings when it starts (0: from the crowd, as in 50 v 50). */
  bossFixedElo: number;
  /**
   * Which boss (a BOSS_ROSTER id): the one picked, if it's playable; "" for a random playable boss, not `bossAvoid`
   * when there's another (your last boss solo; online, the one most of the lobby met last).
   */
  bossId: string;
  bossAvoid: string;
  /**
   * Bosses resting (kill switches: pauses.ts), by id: never met, at random or picked (a picked one is replaced by a
   * random one), nor in the Crowd's boss final (another boss takes his place). Set by the server for a lobby, by the
   * app for a solo game.
   */
  bossesOff?: readonly string[];
  /** Test switch (?power=freeze|blizzard|pie|funhouse|sparkler|candle): that power comes at once (an ultimate after its warning). */
  bossPowerTest: string;
  /**
   * Test switch, solo (?mate=1): the boss battle starts after 1.f3 e5 2.g4 with the crowd White and the boss to move, and
   * the boss plays a mate in one whenever it has one: its attack on the crowd's king, then the result, at once.
   */
  bossMateTest?: boolean;
  /**
   * Test switch, solo (?paint=1 or 2, with ?boss=smudgy): the battle starts with Smudgy's rook already hidden on d7 and the
   * crowd's king able to step into its line (bosses/smudgy.ts, PAINT_TEST): the e2e's way to a move refused for the painted
   * piece. His moves are scripted: 1, the rook steps like a pawn, then strikes; 2, it steps twice like a pawn (to be taken).
   */
  bossPaintTest?: 1 | 2;
  /** Solo's difficulty (BOSS_DIFFICULTY): Elo on top of the boss's strength, within what the engine plays (0 online). */
  bossDifficulty: number;
  /**
   * Boss alone's difficulty as Maia's rating (BOSS_DIFFICULTY's `maia`): the boss picks its moves at it, whatever the
   * strength (bossBrainFor's `alone`). 0: none (every other battle, a test link's fixed tier).
   */
  bossAloneMaia: number;
  /** Testing, solo only (?wip=1): `bossId` may be a boss whose powers are built but whose art isn't yet (placeholders). */
  bossUnfinished: boolean;
  /**
   * Testing, admins only, Boss alone: `bossId` may be a boss hidden from players (BossDef.adminOnly: the Hidden Boss,
   * Eric, Oct 14: "for testing available in boss mode with bots for now"). Off everywhere else. (The Crowd's boss final
   * meets him for everyone without it: `crowdFinalBoss` in boss.ts.)
   */
  bossHidden?: boolean;
  /**
   * Test switch, solo (?win=1): the boss battle starts after 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 with the crowd White to move,
   * so Qxf7 mates the boss at once (to see a boss beaten: the Hidden Boss's collapse).
   */
  bossWinTest?: boolean;
  /**
   * Test switch, solo (?carrots=N, 0 to 5, with ?boss=hopper&power=carrotpatch): Chub & Chirp's cast plants N carrots
   * each a step from one of his pieces and out of the crowd's reach, and the rest each a step from one of the crowd's
   * and out of his, and his race brain takes a carrot whenever a move of his pulls one (BossRace.eager): each side
   * pulling its own, his spin comes on N carrots (5: his fifth wins the battle). The e2e's and the previews' way to a
   * given count (docs/decisions/2026-10-18-hopper-wired.md).
   */
  bossCarrotTest?: number;
  /**
   * Test switch, solo (?seeds=N, 0 to 10, with ?boss=gardener): the hippo gardener has exactly N seeds waiting at every
   * watering, whatever the clock says (his meter shows N): the e2e's, the sims' and the boss kit's way to a set count
   * (docs/decisions/2026-10-21-gardener-rules.md).
   */
  bossSeedTest?: number;
  /**
   * Test switches, solo (with ?boss=tiger; docs/decisions/2026-10-23-tiger-rules.md): ?balloon=<pawn|knight|bishop|rook|queen|fakequeen>,
   * every balloon of the circus tiger's that shape (never a dud, but the fake queen, which always pops); ?stage=N (1 to 4),
   * every balloon goes on N stages blown already (4: ready at once, so it lands or pops at the end of that same turn).
   */
  bossBalloonTest?: "pawn" | "knight" | "bishop" | "rook" | "queen" | "fakequeen";
  bossStageTest?: number;
  /** Boss battle: the King's strike makes the boss's next move one that loses this many points (from its top moves). */
  kingStrikeLoss: readonly [number, number];
  /**
   * Boss battle: how long the King's strike takes on screen (ms), commanding it from his spot (KING_COMMAND in
   * boss-timing.ts: it must cover his last slash). The move clock stands still meanwhile. Summoned onto the board
   * (`kingOnBoard`) it takes KING_SUMMON.strikeMs instead.
   */
  kingStrikeMs: number;
  /**
   * Boss battle: the God King's old way of acting, summoned onto your king's square (bolts converging, a beam, he
   * takes the king's place, walks with a king move, leaves in holy light). Off since Eric's Oct 9 polish: he acts from
   * his spot by the board. Kept, unused, for later.
   */
  kingOnBoard: boolean;
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
   * less than lastStandFrom (a position that's already lost isn't saved; set it over 100 to turn him off, in tests).
   * While the best move is worth less than lastStandShareBelow, the bar is a share of the chances left instead
   * (lastStandShare of them), when that's lower: a weak position has fewer points to lose (Eric, Oct 10: from 25%
   * no move can give away 35 points, so the plain bar alone could never call him there).
   */
  lastStandLoss: number;
  lastStandChargedExtra: number;
  lastStandLossFloor: number;
  lastStandDecayMoves: number;
  lastStandFrom: number;
  lastStandShareBelow: number;
  lastStandShare: number;
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
   * A move clock that changes with the move number instead (none today: the Variable speed that had one is gone, Oct 13,
   * 2026). Empty: every move gets moveClockSeconds. Read the clock with moveClockAt, never one of these two directly.
   */
  moveClockSteps: readonly ClockStep[];
  /**
   * Boss alone (a raid with nobody else in the crowd): no move clock (Eric, Oct 21: "it can just be infinite time when
   * you're playing by yourself"): nothing counts down and no move is ever played for you. Not under the Hidden Boss's
   * bullet clock (his ultimate is the clock). A test link's ?clock= turns it off.
   */
  bossAloneUntimed?: boolean;
  /** Pre-game votes: whether a player may move their pawn to another zone after voting (Eric: one vote each, for now). */
  voteChangeAllowed: boolean;
  /**
   * Each player's time bank for the whole match (seconds). Thinking time comes out of it. With timeIncrementSeconds and
   * moveClockSeconds it makes a chess time control: Crowd 50 v 50's clock vote sets all three (votes.ts).
   */
  timeBankSeconds: number;
  /**
   * Added to the bank at the start of every move (seconds), so even an empty bank leaves this long to move. What a move
   * doesn't use stays in the bank, as a chess clock's increment does.
   */
  timeIncrementSeconds: number;
  /** Power-ups (reveal the engine's top 3 moves): how many each player starts with. */
  powerUpsAtStart: number;
  /** Power-ups added for every player who survives a cut. */
  powerUpsPerStage: number;
  /** Most power-ups a player can hold (extra ones earned at a full hand are lost). */
  powerUpsMax: number;
  /** Bots use a power-up when the second-best candidate loses at least this many points. */
  botPowerUpLoss: number;
  /** Each player keeps one color for a whole stage, swapping at stage breaks (needs 2+ boards). */
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
  /**
   * Boss raid: from a named opening `openingMoves` in, as raids were until Oct 21 (tests that need a book position use it;
   * a boss whose gimmick is openings may later). Off: every raid starts from the starting position (Eric, Oct 21).
   */
  raidOpening?: boolean;
  /**
   * Crowd 50 v 50: how the game starts (the pre-game vote, CrowdStart). Unset is "normal". The runner sets the board up
   * from it before move 1 (MatchRunner.patchSettings); Random opening also sets `openingMoves`.
   */
  crowdStart?: CrowdStart;
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
  /**
   * Testing only (the ?weakbots=1 switch, WEAK_BOTS): people rank above bots in the standings, so every cut takes bots
   * first. Never for players.
   */
  peopleFirst?: boolean;
  /**
   * Crowd 50 v 50's scoring (CROWD_SCORING: the soft cap by stage, shared-blunder relief, streaks, rare brilliant
   * finds, the bubble grace). Unset: every other mode scores as before.
   */
  crowdScoring?: CrowdScoring;
}

/**
 * Crowd 50 v 50's scoring (Eric, Oct 23; docs/decisions/2026-10-24-crowd-scoring.md, measured in reports/crowd-scoring.md).
 * A pick's round score starts as today's (the group's average loss less its own, the opening allowance taken off), then:
 * - **shared-blunder relief**: a losing pick (`sharedFrom` points or more) made by at least `sharedMin` players, or by
 *   `sharedShare` of the group, counts its loss times (1 - `sharedK` x its share), never less than `sharedFloor` of it;
 * - **the soft cap**: a smooth curve (`capCurve`) that keeps a score inside +-cap, a bigger miss still scoring worse than a
 *   smaller one. The cap widens by stage: `cap[i]` from the match's stage `capFrom[i]` (stage 0 is before the first cut),
 *   null for none. A pick that gives up a piece (`uncapPawns` of material) by the exchange check takes a minus score
 *   uncapped;
 * - **streaks**: a strong move is one within `streakStrong` points of the engine's best (its raw loss); strong moves in a
 *   row make a streak, which any other pick or a miss ends. From `streakFrom` in a row a strong move earns
 *   `streakBonus[n - streakFrom]` (the last entry from then on), added after the cap. Streaks count from the player's
 *   `streakFromMove`th picked move on the usual start, from the first in Random opening and Freestyle;
 * - **brilliant finds** (`brilliance`, the rest giving away `brilliantMinGap` points or more): `brilliantBonus` and a
 *   shoutout, only when rare: `brilliantMaxFound` or fewer found it, or exactly one when `brilliantFewLeft` or fewer picked;
 * - a miss scores `missCaps` times the stage's cap below zero (missedMoveScore when there's no cap);
 * - every round score is kept to 2 decimals, and at a cut (not the last) anyone within `cutGrace` points of the last
 *   player through goes through like an exact tie (what that leaves over carries, as cutCarry).
 * The FAQ and the screens read these numbers from here.
 */
export interface CrowdScoring {
  cap: readonly (number | null)[];
  /**
   * The soft cap's curve: "tanh" (cap x tanh(x / cap): close to the score while small, then flat near the cap, so big
   * misses all read about -cap) or "ratio" (x / (1 + |x| / cap): eases in sooner and never quite flattens, so a bigger
   * miss always shows a little worse, even to 2 decimals).
   */
  capCurve: "tanh" | "ratio";
  capFrom: readonly number[];
  /** A pick that gives up this many pawns of material or more by the exchange check (a piece) isn't capped. */
  uncapPawns: number;
  sharedFrom: number;
  sharedMin: number;
  sharedShare: number;
  sharedK: number;
  sharedFloor: number;
  streakStrong: number;
  streakFrom: number;
  streakFromMove: number;
  /** Testing in the sim only: streaks count from the first cut. */
  streakFromCut?: boolean;
  streakBonus: readonly number[];
  brilliantBonus: number;
  /** A find is a shoutout only when the rest gave away this many points on average or more (`brilliance`'s minGap). */
  brilliantMinGap: number;
  brilliantMaxFound: number;
  brilliantFewLeft: number;
  missCaps: number;
  cutGrace: number;
}

export const CROWD_SCORING: CrowdScoring = {
  cap: [2, 3.5, 5, 8],
  capCurve: "ratio",
  capFrom: [0, 1, 5, 9],
  uncapPawns: 3,
  sharedFrom: 5,
  sharedMin: 3,
  sharedShare: 0.25,
  sharedK: 1,
  sharedFloor: 0.4,
  streakStrong: 2,
  streakFrom: 3,
  streakFromMove: 6,
  streakBonus: [0.25, 0.5, 0.75, 1],
  brilliantBonus: 1,
  brilliantMinGap: 35,
  brilliantMaxFound: 3,
  brilliantFewLeft: 10,
  missCaps: 2,
  cutGrace: 0.1,
};

/**
 * One step of a move clock that rises as the game goes on: from this move on, this many seconds a move. "Move" is the
 * move number the top bar shows ("Move 6"): White's and Black's first moves are both move 1.
 */
export interface ClockStep {
  fromMove: number;
  seconds: number;
}

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

/**
 * The test switch `?pace=quick` (the e2e and playtests, test-switches.ts): a shorter reveal and less settling in, on top
 * of the mode's own pace. Players always play the mode's own pace (the Relaxed pace toggle went on Oct 15, 2026).
 */
export const QUICK_PACE: Record<GameMode, Partial<Settings>> = {
  classic: { revealSeconds: 3, drawnMoveSeconds: 2.5, boardIntroSeconds: 2 },
  crowd: { revealSeconds: 2, drawnMoveSeconds: 1.2, stageBreakSeconds: 4 },
};

export const DEFAULT_SETTINGS: Settings = {
  mode: "classic",
  crowdTeams: true,
  augments: true,
  cutClockVote: false,
  finalFormat: "team",
  voteSeconds: 8,
  // (4.2 s: the winner's banner a second longer, as every banner since Eric, Oct 15; was 3.2.)
  voteResultSeconds: 4.2,
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
  bossAloneMaia: 0,
  bossUnfinished: false,
  kingStrikeLoss: [5, 15],
  // (4.7 s: his cut-in a second longer, and his slashes after it, Oct 15; was 3.7 s. The move clock stands still.)
  kingStrikeMs: 4700,
  kingOnBoard: false,
  kingPowerUpsPerCharge: 10,
  kingChargesMax: 3,
  kingBotLoss: 6,
  kingBotFollow: 0.6,
  lastStandLoss: 30,
  lastStandChargedExtra: 5,
  lastStandLossFloor: 13,
  lastStandDecayMoves: 22,
  lastStandFrom: 20,
  lastStandShareBelow: 40,
  lastStandShare: 0.5,
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

/** The bots' skills under the ?weakbots=1 test switch (WEAK_BOTS): every bot at least this loose (`botSkillRange`). */
export const WEAK_BOT_SKILL: readonly [number, number] = [8, 32];

/**
 * Test switch ?weakbots=1 (solo, and a lobby you create): loose bots, and people ranked above bots (`peopleFirst`), so a
 * test's player is sure to survive the cuts (to the Crowd's top 4, say). Loose bots alone stopped doing it once the
 * opening allowance forgave every pick within 8 points (Oct 15): a test playing the engine's best move then lost the
 * last cut to bots that had scored as well, whenever the judge's final numbers ranked one bot pick above its move
 * (docs/decisions/2026-10-16-flaky-e2e-batch-2.md). Never for players.
 */
export const WEAK_BOTS: Pick<Settings, "botSkillRange" | "peopleFirst"> = { botSkillRange: WEAK_BOT_SKILL, peopleFirst: true };

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
 * The opening allowance (Eric, Oct 15, 2026; docs/decisions/2026-10-15-opening-allowance-and-ties.md): early in a game a
 * move's loss counts for points only beyond `points`, so a sound move off the engine's line costs nothing, while poor
 * play still costs. The move number is the game's own (the position's fullmove number: "Move 6" on the top bar), the
 * same in every mode: the whole allowance through move `flatThrough`, then falling in a line to nothing at move
 * `goneBy` (nothing from there on). A move that gives up at least `materialPawns` pawns of material against the
 * engine's best move by the exchange check (it leaves something to be taken, or passes up a capture that wins
 * material: `materialSlips` in the chess package) gets no allowance at all. Measured in reports/opening-allowance.md.
 * The FAQ and the screens read these numbers from here.
 */
export const OPENING_ALLOWANCE = {
  points: 8,
  flatThrough: 10,
  goneBy: 14,
  materialPawns: 1,
} as const;

/**
 * Crowd 50 v 50 knockouts for each way to end: they leave 8 (team final), 4 (the boss final, against the Hidden Boss) or
 * 2 (duel); `crowdFinalists` says how many. The boss final's are the duel's cuts stopping at four (Eric, Oct 14: "the top
 * four always battle versus [him]"; it was the top 10 against a random boss).
 */
export const CROWD_KNOCKOUTS: Record<FinalFormat, readonly number[]> = {
  team: [16, 14, 12, 10, 8, 8, 6, 6, 4, 4, 4],
  boss: [16, 14, 12, 10, 8, 8, 6, 6, 4, 4, 4, 2, 2],
  duel: [16, 14, 12, 10, 8, 8, 6, 6, 4, 4, 4, 2, 2, 2],
};

/**
 * Crowd mode: 100 players, 50 v 50, on one board from the starting position; each team picks its side's moves and the
 * most popular pick is played. No cuts for the first 10 moves (20 plies), then a cut after every move (2 plies, half
 * from each team) down to the ending the pre-game vote picked (CROWD_KNOCKOUTS). Scores carry over all game (a stage
 * is only one move long). 3 power-ups, none earned.
 */
export const CROWD_SETTINGS: Partial<Settings> = {
  mode: "crowd",
  // Always team turns (Crowd's "everyone moves" went on Oct 15, 2026); only a raid sets it false.
  crowdTeams: true,
  lobbySize: 100,
  groupSize: 100,
  knockoutsPerStage: CROWD_KNOCKOUTS.team,
  finalFormat: "team",
  firstStageRounds: 20,
  roundsPerStage: 2,
  scoresBetweenStages: "carry",
  crowdScoring: CROWD_SCORING,
  colourPerStage: false,
  drawRuleByStage: ["popular"],
  powerUpsAtStart: 3,
  powerUpsPerStage: 0,
  openingMoves: 0,
  // With DEFAULT_SETTINGS' 10-minute bank and +5 s: Rapid 10+5, the clock whenever there's no clock vote (votes off,
  // raids). The vote's options are in votes.ts.
  moveClockSeconds: 20,
  boardIntroSeconds: 0,
  // One board from the starting position: no opening grid to show.
  openingShowSeconds: 0.5,
  // Most of the show happens live (picks appear as they're made), so the reveal itself is short.
  revealSeconds: 2.5,
  drawnMoveSeconds: 1.5,
  // The cut is a judgment (the gavel and every player's pawn): 10 s, as Eric asked.
  stageBreakSeconds: 10,
  botThinkSeconds: [2, 14],
};

/**
 * How many play a Crowd 50 v 50's ending (`format`): the lobby less every knockout (the team final 8, the boss final 4,
 * the duel 2). The vote's cards, the FAQ and the screens take the number from here, never typed.
 */
export function crowdFinalists(format: FinalFormat, knockouts: Readonly<Record<FinalFormat, readonly number[]>> = CROWD_KNOCKOUTS, lobbySize = CROWD_SETTINGS.lobbySize ?? DEFAULT_SETTINGS.lobbySize): number {
  return lobbySize - knockouts[format].reduce((a, b) => a + b, 0);
}

/**
 * Boss raid: everyone (up to 50, no bots) picks the crowd's moves together
 * against a boss, from the starting position (Eric, Oct 21: the runner's
 * startRaid). The boss strikes down to half the group; the King has 3 charges.
 */
export const RAID_SETTINGS: Partial<Settings> = {
  ...CROWD_SETTINGS,
  raid: true,
  crowdTeams: false,
  // (A raid scores as before: the crowd's scoring is 50 v 50's.)
  crowdScoring: undefined,
  augments: false,
  lobbySize: 50,
  groupSize: 50,
  knockoutsPerStage: [],
  openingMoves: 5,
  powerUpsAtStart: 0,
  bossAloneUntimed: true,
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
  /**
   * The blizzard (Ginger's ultimate; Eric, Oct 12: "Ult lasts 3 turns now: 1 unmelted piece turn 1, turn 2 about 4–5
   * pieces, then all"): it lasts blizzardTurns crowd turns (at least 2). On each but the last, blizzardFree's entry for
   * that turn is how many of the crowd's pieces are free in all, a number in its range drawn from the seed (turn 1 one,
   * turn 2 four or five); the rest are iced. Pieces once free stay free, and the ones that thaw next turn show cracked,
   * dripping ice the turn before. On the last turn the ice is gone and every piece moves. The meter stays empty through
   * all of them, and the freeze waits until it's over.
   */
  blizzardTurns: 3,
  blizzardFree: [
    [1, 1],
    [4, 5],
  ] as readonly (readonly [number, number])[],
  /**
   * Pie: a square near the center is pied for pieTurns crowd turns (nobody may move onto it). Up to pieMax pies on the
   * board at once (Eric, Oct 11: two), never two on one square; a new one every pieEvery turns while there's room.
   */
  pieTurns: 3,
  pieEvery: 2,
  pieMax: 2,
  /**
   * The ultimate's meter (the rage meter), in rage points: full at rageFull, then a one-turn warning, then the
   * ultimate. It empties as the ultimate comes and fills again for the next (Eric, Oct 11: several a match, like a
   * game's rage meter); while the ultimate's effect still runs it stays empty (nothing gathers), and one never overlaps
   * another. It fills over time (ragePerMove each crowd move), faster while the crowd is ahead on the judged eval (up
   * to rageAheadMax more a move, all of it from rageAheadFull expected score), with the boss's own material lost
   * (ragePerMaterial a point: a queen's worth is half the meter), and with each of the God King's strikes on the boss
   * (rageStrike: a quarter of the meter). Every gain is multiplied by the boss's rageSpeed (its ultimate's effect
   * lasts longer or shorter, so each gets about two ultimates in a typical battle of about 40 crowd moves). Rates set
   * by estimate (DECISIONS.md, "Rage meters: every boss's ultimate again and again"); not yet tested with the bot sim.
   * Run the sim at a future date (boss-sim.ts raid). rageOverTime false: material and strikes only. Wrangler has no
   * meter (Eric, Oct 13): his showdown comes whenever a line-up is ready (showdownFrom, showdownMax, showdownGap).
   */
  rageFull: 100,
  rageOverTime: true,
  ragePerMove: 4,
  rageAheadMax: 4,
  rageAheadFull: 0.75,
  ragePerMaterial: 100 / 18,
  rageStrike: 25,
  /**
   * How fast each boss's meter fills (every gain times this), by BOSS_ROSTER id (1 when missing). Its ultimate's
   * effect pauses the meter for its length (the blizzard 3 turns, the funhouse 12, the Roman candle about 13, Lights
   * out 2, the Big Bounce 1, the board saw 5), so a longer one fills faster to fit two in a typical battle. Ginger a
   * little faster (Eric, Oct 11: her ultimate's weak; about twice a game), and 1.2 since her blizzard lasts three turns
   * (Oct 12, by estimate: the second still comes about turn 30). Jefferson's candle burns for about a third of a
   * battle, so he gets about one and a half (two in a long battle): two full barrages would keep the crowd's half on
   * fire most of the game. Babur (tiger) 1.3 (Oct 24, was 1.6: Eric, "he's ulting so much… 2 to 4 times per game"; his
   * hoops now come after his move): the raid sim's 10 s crowd, 2.55 casts a battle of 44 moves, 3.45 per 60 moves (1.1 gave
   * 1.80 a battle, under 2: his battles are shorter now he keeps his turn; reports/tiger-sim.md).
   */
  rageSpeed: { gingerbread: 1.2, clown: 1.8, grex: 1.2, hollow: 1, bigboy: 1, sawyer: 1.3, alfil: 1.2, smudgy: 1, moo: 1, gardener: 1.2, tiger: 1.3 } as Readonly<Record<string, number>>,
  /**
   * The Hidden Boss's ultimate, the bullet clock (Eric, Oct 14: "Meter builds starting turn 1, about 7 turns in he says
   * something about how you're thinking too much and to just play pure chess etc, true to him, then for the rest of phase 1
   * it's bullet with no added time per move so it's a true race against the clock but it should be bearable for a strong
   * team"). His own meter, not the rage meter: it fills from crowd turn 1 and is full as crowd turn bulletTurn begins,
   * when it comes (his line and the spellbook, no warning); nothing else fills it (no strikes, no eval). From then to the
   * end of phase 1 everyone's clock is a bank of bulletBankSeconds: no per-move cap, and no increment for its first
   * bulletPlainMoves moves (below); a bank that runs out loses the battle on time. Eric, Oct 14, after playing it: 3:00
   * "feels like too much", so 1:00 ("1+0"), was 180 s. A battle is capped at bossMaxMoves (60) crowd moves. Not yet
   * sim-tested.
   */
  bulletTurn: 7,
  bulletBankSeconds: 60,
  /**
   * Then he adds time per move (Eric, Oct 14, after playing it again: "1 min too short, needs to be 1+1 or even 1+2... a
   * few moves, say 3, with 1+0, then he says a comment about it and suggests adding time per move"): the crowd plays the
   * bullet clock's first bulletPlainMoves moves on the bank alone (1+0); as the next crowd turn begins he says so (his
   * line, then "+2 s a move from now on" across the board), and from then on each move made in time adds
   * bulletIncrementSeconds to that player's bank (1+2: the more forgiving of Eric's two, as 1:00 alone felt too short).
   * No cap on the bank: it grows by at most this a move, over at most bossMaxMoves moves. Estimates, not sim-tested.
   */
  bulletPlainMoves: 3,
  bulletIncrementSeconds: 2,
  /** The meter glows from this full (0-1) as it nears its ultimate. */
  rageGlowFrom: 0.75,
  /**
   * The test trigger: admins (ADMIN_EMAILS) see a small "Trigger ultimate (testing)" button in any boss battle, which
   * brings the boss's ultimate as the next crowd turn begins (no warning). false removes it everywhere, server too.
   */
  ultimateTestButton: true,
  /**
   * Testing, admins only, Boss alone (Eric, Oct 14): an "Engine move" button that plays Stockfish's best move for you
   * through the normal move path. Its search is the power-up hints' (`engineNodes`, 250,000 nodes: well under a second
   * on a phone, already under way as your move starts), so it adds no engine work. false removes it.
   */
  engineMoveButton: true,
  /**
   * The funhouse (Boingo's ultimate; Eric, Oct 11): he turns the board round in steps, funhouseStepTurns crowd turns
   * apart: upside down (180°) as it comes, then a quarter turn to a side picked from the seed (90° or 270°), then a half
   * turn to the other side, then back to the start, where it stays. As it comes he plays the crowd's first move for it
   * (Eric, Oct 12: "the forced move is the joke"), one move per funhouse, unscored; the crowd plays its own from the next
   * turn. The meter fills again once the board is back.
   */
  funhouseStepTurns: 4,
  /** The funhouse's move: one that gives away this many points against the best (1 to 2.5 pawns)... */
  funhouseLoss: [10, 25] as readonly [number, number],
  /** ...and never one that gives away more than this in log-odds (a lost cause stays a fight). */
  funhouseMaxLogit: 1.6,
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
   * The share of each wave's fireballs that fall on his own half (Eric, Oct 11: his ultimate was too strong). His pieces
   * never burn, so those are mostly wasted (a crowd piece standing there still would). Rounded per wave: 0.4 sends 10
   * of the 24 to his half (waves 0, 1, 1, 2, 2, 2, 1, 1, 0) and 14 to the crowd's, where all 24 fell before. Set by
   * estimate; not yet tested with the bot sim.
   */
  candleOwnShare: 0.4,
  /**
   * Each wave's squares are picked this many crowd turns before it lands (at most candleDelay), and show a shadow
   * that grows each turn: small, bigger, bigger again, then the fireball drops onto it.
   */
  candleAhead: 3,
  /**
   * Hollow's dark: after his first move he covers the square of the piece he moved, then another on every darkEvery-th
   * of his moves (his 4th, 7th, 10th…), a random occupied square from the seed (his or the crowd's, never a king's, never
   * one already dark). Each lasts darkTurns crowd turns: it belongs to the square, not the piece.
   */
  darkEvery: 3,
  darkTurns: 10,
  /**
   * A move attempt that touches a dark square (starts on one, lands on one or passes over one) goes to the server
   * unchecked: an illegal one costs darkTryCost points and the player picks again; the darkTries-th in a turn ends that
   * player's turn as a missed move. A turn's score, penalties included, never goes below missedMoveScore.
   */
  darkTryCost: 5,
  darkTries: 5,
  /**
   * Lights out (Hollow's ultimate, at the start of his turn, the clocks stopped): a memory test in rounds, each naming
   * this many of his pieces with this long to tap where they are (the usual late grace on top).
   */
  lightsOutRounds: [
    { pieces: 1, ms: 3000 },
    { pieces: 2, ms: 4000 },
    { pieces: 3, ms: 5000 },
  ] as readonly { pieces: number; ms: number }[],
  /**
   * Each tap a player makes in a round, right or wrong, adds this long to their own countdown (Eric, Oct 9). Their
   * tries stay the number of pieces, so a round gives at most that many seconds more.
   */
  lightsOutTapMs: 1000,
  /** Each piece not found (a wrong square, or out of time) costs this many points. */
  lightsOutMiss: 10,
  /**
   * Bots in the crowd find each piece with this chance, round by round (from the seed): fewer as the rounds get harder.
   * Eric, Oct 10: high enough that a crowd of bots sits near lightsOutHold (about 72% over the test), not always under it.
   */
  lightsOutBotHit: [0.85, 0.75, 0.65] as readonly number[],
  /**
   * The crowd's find rate over the whole test (every piece found by everyone still in, over every piece asked of them)
   * that holds the light (Eric, Oct 10). Below it, he plays an extra move after his own, before the crowd's turn.
   */
  lightsOutHold: 0.7,
  /**
   * His extra move (a failed Lights out) is a quiet one (no capture, check or promotion) that gains him at most this
   * many points (expected score x 100) over not moving again, and loses him no more than that either; none such: no
   * extra move.
   */
  lightsOutExtraGain: 3,
  /**
   * Big Boy's toy blocks: from the crowd's 2nd turn (firstPassive), every blockEvery crowd turns he tosses a toy block
   * onto an empty square in the crowd's half that one of its pieces could move to. It stays blockTurns crowd turns (and
   * the boss's replies in between): nothing may move onto it or slide through it, either side. Never leaves anyone
   * without a move, never blocks the only way out of check (it lifts for that turn).
   */
  blockEvery: 4,
  blockTurns: 3,
  /**
   * The Big Bounce (Big Boy's ultimate, at the start of his turn, from the rage meter): the crowd's pieces thrown about.
   * Each candidate moves bouncePieces of them (never the king, no captures), each to an empty square within bounceReach
   * (pawns only sideways along their rank). Of bounceCandidates such positions (from the seed), each glanced at by the
   * engine (bounceScreenNodes), the bounceConfirm nearest the target are looked at properly (bounceNodes, as is the
   * position before), and of those the one whose value for the crowd is nearest bounceTarget pawns worse inside
   * bounceLoss (half a pawn to a pawn and a half); none inside: the nearest below it (never one better for the crowd);
   * none at all: the bounces still play but nothing moves. About one of his moves' worth of searching, shared out over
   * the engines, so the bounce never stalls a match.
   */
  bouncePieces: [2, 6] as readonly [number, number],
  bounceReach: 2,
  bounceCandidates: 16,
  bounceScreenNodes: 15_000,
  bounceConfirm: 3,
  bounceNodes: 100_000,
  bounceLoss: [0.5, 1.5] as readonly [number, number],
  bounceTarget: 1,
  /**
   * A pawn, in log-odds of the engine's expected score: the starting position is 0.536 for White, without its d- or
   * e-pawn 0.31 or 0.30 (2,000,000 nodes), 0.95 log-odds apart. Losses are measured this way, so a pawn and a half is a
   * pawn and a half however far ahead or behind the crowd already is (in points of expected score it shrinks to nothing
   * in a lopsided position).
   */
  bouncePawnLogit: 0.95,
  /**
   * Sawyer's saw cuts: from crowd turn sawFirst (his split pawn has turn 2 to itself), every sawEvery crowd turns he
   * saws one edge between two neighboring squares in the crowd's half that one of its moves would cross, for sawTurns
   * crowd turns (and his replies in between; then a turn's gap). Nothing, either side, may move straight across it (a
   * rook, queen, king or pawn moving through it); diagonal moves and knights pass. It blocks moves, never attacks;
   * never leaves anyone without a move, never blocks the only way out of check (it lifts for that turn).
   */
  sawFirst: 3,
  sawEvery: 4,
  sawTurns: 3,
  /**
   * The board saw (Sawyer's ultimate): the rage meter full, from crowd turn boardSawFrom, and one half of the board
   * (files a-d or e-h) more his than the crowd's on material: the warning, then the next turn the board is sawn in two
   * between the d and e files. For boardSawTurns crowd turns (and his replies) no move may cross between the halves,
   * knights included; then they rejoin. Same fairness as the cuts.
   */
  boardSawFrom: 10,
  boardSawTurns: 5,
  /**
   * Wrangler's long pull (his first move): a center pawn's double step, lassoed one square further (three squares in one
   * move: e2-e5 or d2-d5 as White; d7-d4 or e7-e4 as Black after the crowd's first move). The engine picks the d- or
   * e-pawn (the position after each, and after his best ordinary move, searched at pullNodes); a pull losing more than
   * pullMaxLoss pawns against that ordinary move is unsound (it hangs the pawn), and so is one whose path or square is
   * taken or that leaves the pawn simply taken: then it's an ordinary first move. Measured (Stockfish, depth 18): -0.2
   * to +0.3 pawns for him against a normal first move, pure flavor.
   */
  pullMaxLoss: 0.5,
  pullNodes: 100_000,
  /**
   * Wrangler's lasso drag (his passive): after his move, from crowd turn dragFirst, every dragEvery turns, he ropes one
   * crowd piece (never the king) and drags it one square up, down, left or right onto an empty square (a pawn never onto
   * the first or last rank; never a bishop: it would change color), never leaving the crowd in check or without a move.
   * In a game already decided (past 4 pawns either way) there's none: the engine can't read a loss there. Of the legal
   * drags (at most dragCandidates, a seeded sample, none leaving more of the crowd's material hanging), each glanced at
   * by the engine (dragScreenNodes), the dragConfirm nearest the band's middle are looked at properly (dragNodes, as is
   * the position before), and the one costing the crowd nearest the middle of dragLoss (in pawns: bouncePawnLogit) is
   * played (seeded among ties). None in the band: no drag that turn, and it doesn't count (he tries again after his next move). About
   * 3 to 4 a battle of 30 to 40 crowd moves (turns 3, 13, 23, 33), by estimate (Eric's rule on power rates): not yet
   * tested with the bot sim.
   */
  dragFirst: 3,
  dragEvery: 10,
  dragLoss: [0.1, 0.9] as readonly [number, number],
  dragCandidates: 16,
  dragScreenNodes: 8_000,
  dragConfirm: 3,
  dragNodes: 50_000,
  /**
   * Wrangler's showdown (his ultimate; Eric, Oct 13: "he checks every turn after three or four moves, and the moment
   * it's ready he fires it with no warning"; he has no rage meter): three pairs (a crowd piece and one of his of the
   * same kind: queens, rooks, then bishops or knights, the most valuable pairs there are), or two when no three-pair
   * line-up qualifies, lined up facing each other in the middle of the board (files b-g, ranks 3-6), his pieces always
   * protected; the crowd's next move must be one of the duels (its piece taking his). A line-up qualifies when the
   * crowd's best duel gains him showdownEdge pawns over the position before the line-up (nearest showdownTarget,
   * seeded among ties: DECISIONS.md, "Wrangler, built", on why it's measured from the position before), and another
   * duel costs the crowd at least showdownTrap pawns more; never a check, never a mate for him after the best duel.
   * - When (Eric, Oct 13): his own meter (not the rage meter: nothing but his moves fills it) fills over his first
   *   showdownMeterTurns moves, and again over as many after each showdown; as it fills he says "I've got you in my
   *   sights." and swings both ropes until he fires. With it full, on the first of his turns where a qualifying line-up
   *   is found after his move, he fires (no other warning, no "Not yet..."); none found, he plays on (his lasso drags
   *   carry on) and tries again next turn. At most showdownMax a battle.
   * - His moves after the duel: his reply, and his next ones while the showdown's tactics are live (a line-up piece of
   *   either side still attacked), up to showdownEngineMoves, are the engine's best at full strength, never his brain's.
   * - The search: while the crowd thinks, every turn from showdownFrom (while one may still come), up to
   *   showdownSearchMs a turn on the position then (an engine of its own): line-ups of three pairs, then two, scanned
   *   and the promising ones confirmed; the qualifying and promising ones are kept from turn to turn and checked again
   *   on each new position (dropped once they no longer hold). At his turn, after his move, the kept ones first, then
   *   fresh ones (three pairs first, then two), for up to showdownTurnMs (at most showdownSetups line-ups a search).
   *   Each line-up costs one search per duel at showdownNodes (a quick scan, read with some slack); the promising ones
   *   are looked at closely at showdownConfirmNodes. A phone is 3 to 5 times slower than a computer: the scout's time
   *   is what it leans on.
   * - The admins' test trigger: at his next turn, ignoring showdownFrom, the cap and the gap; up to showdownTestMs of
   *   searching, then the best line-up found even outside the band (marked so on the admins' debug line), so a
   *   showdown always comes when the board holds two matched pairs. Players never get one outside the band.
   */
  showdownEdge: [-0.2, 1.5] as readonly [number, number],
  showdownTarget: 0.5,
  showdownTrap: 1.5,
  showdownFrom: 4,
  showdownMeterTurns: 5,
  showdownMax: 2,
  showdownEngineMoves: 3,
  showdownSearchMs: 8000,
  showdownTurnMs: 3000,
  showdownTestMs: 10_000,
  showdownSetups: 60,
  showdownNodes: 8_000,
  showdownConfirmNodes: 40_000,
  /**
   * Alfil's Tusks (his passive; Eric, Oct 17): at the start of his turn tusksFirst (his 3rd), then every tusksEvery of
   * his turns, he marks two of his pawns, anywhere (they glow), then plays his move. His next turn, the fusion is his
   * move: both are lifted off and an elephant (a bishop in every way) lands on one of their two squares, the engine's
   * pick (each position searched at tusksNodes: the one best for him), and the crowd's turn begins. The crowd taking
   * one on its turn between stops it. At most tusksMax elephants a battle. Which two: the engine's pick the same way
   * among tusksLooks pairs, as if they fused at once (tusksPairs).
   */
  tusksFirst: 3,
  tusksEvery: 8,
  tusksMax: 2,
  tusksLooks: 5,
  tusksNodes: 30_000,
  /**
   * Alfil's Mammoth Slam (his ultimate, at the start of his turn after its warning, from the rage meter): slamPawns of
   * the crowd's pawns and slamMinors of its knights or bishops (never a queen, rook or king; fewer if it has fewer) fly
   * up for slamTurns crowd turns and land as the next begins, each on its own square (taken: the nearest empty square
   * allowed). Never a piece whose removal would leave the crowd's king in check. The swing cap: of the lifts that leave
   * the least of the crowd's material hanging (seeded), slamLooks are played out by the engine (its best moves for both
   * sides through the turns they're up, slamLineNodes a search), put down, and scored (slamNodes, as is the position
   * before): the crowd's loss in pawns (bouncePawnLogit) nearest slamTarget inside slamLoss, else the nearest below it;
   * never past the cap, never a line with a mate against the crowd. None: nothing lifts (the meter is kept, and the
   * Slam comes again on his next turn).
   */
  slamPawns: 2,
  slamMinors: 1,
  slamTurns: 3,
  slamLooks: 4,
  slamLineNodes: 15_000,
  slamNodes: 60_000,
  slamLoss: [0.25, 1.5] as readonly [number, number],
  slamTarget: 0.75,
  /**
   * The landing guard (Eric, after playing him: "can we make the engine think, the turn before the pieces land, that
   * they're there?"; docs/decisions/2026-10-17-alfil-sees-the-landing.md): on his move just before the Slam's pieces
   * land (his fusion too), his move still comes from the board as it is, but it's judged with them down. His pick and
   * the slamGuardLooks best moves of his own search are each played, the pieces put down as the rules will (landing),
   * and searched at slamGuardNodes, the crowd to move; a pick that gives away more than the blunder guard allows against
   * the best of them gives way to it. At most (slamGuardLooks + 1) × slamGuardNodes on that one move: 150,000 nodes,
   * under a third of the move's own searches (bossNodes for its top moves, and again for its pick).
   */
  slamGuardLooks: 4,
  slamGuardNodes: 30_000,
  /**
   * The pass guard (Eric, Oct 18: Alfil fused while his queen hung, and lost it for free;
   * docs/decisions/2026-10-18-turn-passing-guard.md): one rule for every power that spends a boss's whole turn (Alfil's
   * fusion, Chub & Chirp's Carrot Patch cast). When it's due and passing would lose real material, it waits a turn and
   * he plays his move instead; it's checked again on his next turn, with no cap. "Real material": the engine's
   * evaluation after the power (the crowd to move) at least passGuardPawns below his evaluation before it (him to move,
   * so his best move's), in pawns of log-odds (bouncePawnLogit), on the host's engine (the server never searches; no
   * engine anywhere: it comes as ever). The fusion reads the searches its square's pick already makes (tusksNodes); the
   * cast, with none of its own, searches the position before and after the pass at passGuardNodes each (60,000 nodes in
   * all: about 0.2 s on a phone). 2: the fusion itself gains him about a pawn (two pawns become a bishop) and a pass
   * costs a tempo, so a pawn left hanging nets out near zero and doesn't stop it, while a piece left hanging (a minor
   * nets about -2) or anything bigger does. In the sims before this guard, 25 of 153 fusions lost 2 pawns or more by
   * this measure (most of them 4 to 8) and one lost between 1 and 2 (1.76).
   */
  passGuardPawns: 2,
  passGuardNodes: 30_000,
  /**
   * Chub & Chirp's Leapfrog (their passive; Eric, Oct 18): at the start of his turn, when one of his pawns stands nose
   * to nose with one of the crowd's (the crowd's pawn on the square in front of his) and the square beyond is empty, his
   * pawn hops over it to that square (never onto the crowd's last two ranks), automatically, and he still plays his move
   * (the sim's variant A: reports/hopper-sim.md); several can: the engine's pick (each position searched at hopNodes:
   * the one best for him). At most hopMax a battle.
   */
  hopMax: 2,
  hopNodes: 30_000,
  /**
   * Chub & Chirp's Carrot Patch (their ultimate, once a battle; Eric, Oct 18; docs/decisions/2026-10-18-carrot-patch.md).
   * The cast is his whole turn: carrotCount carrots on empty squares, at least one on each half, no two touching. Where
   * they go (the math): each side's fewest moves to end a move on each square, from the position as it stands, give each
   * square his lead (the crowd's moves there less his; the crowd moves first, so a tie is the crowd's), and a carrot
   * goes where his lead is nearest each of `carrotLeads` (moves; the sim's tuning: reports/hopper-carrots-sim.md),
   * nearer squares first, among squares some piece reaches within carrotReach moves. A piece pulls one by ending its
   * move there. What the race is worth (his brain's and the judge's): who'd get each carrot as the race would go, each
   * side one at a time, held by its margin (`carrotSharp` a ply, through a logistic), his own the less the later he'd
   * pull them (`carrotHurry` a move: one in the ground isn't his yet); each count's prize at its average,
   * in pawns; his last carrot `carrotWinWorth` pawns (the battle). The race
   * lasts carrotMoves moves each; then his spin on his tier (his carrots: `carrotOdds`, each tier's prizes and their
   * odds, Eric's sheet, tier 3 the softened table), his 5th carrot winning the battle at once. A prize the engines
   * can't take (more than 8 pawns, or more pieces than promotions could make) steps down `carrotPrizes`, best first, to
   * the next that fits.
   * His race brain (the host's engine, as the landing guard): on his ordinary moves in the race, his pick, his search's
   * carrotLooks best moves within the blunder guard and as many moves that pull a carrot are searched at carrotNodes (at
   * most 9 × 30,000 nodes a move, about the move's own search again) and re-scored with the race (what his chances of
   * each carrot make his prize worth), weighed by his strength: from carrotWeightMin at carrotSkill[0] Elo to all of it
   * at carrotSkill[1]; a move that pulls his last carrot is always played. A move replaces his pick only for the race:
   * at least carrotMinGain pawns of the race's worth above it (so a tiny race gain can't let a stronger chess move in:
   * the review's 29 switches on real Stockfish had race gains of 0.01 to 0.24 pawn on the six that smuggled chess or
   * swapped equals in a lost position, 0.32 and up on the rest). The crowd's judge weighs the race in full (the bots
   * pick by it, the pulls among their choices).
   */
  carrotCount: 5,
  carrotMoves: 12,
  carrotLeads: [3, 1, 0, 0, -2] as readonly number[],
  carrotReach: 4,
  carrotSharp: 1.2,
  carrotHurry: 0.85,
  carrotWinWorth: 30,
  carrotOdds: [
    [{ prize: [], p: 1 }],
    [
      { prize: ["p"], p: 0.6 },
      { prize: ["p", "p"], p: 0.4 },
    ],
    [
      { prize: ["p", "p"], p: 0.4 },
      { prize: ["n"], p: 0.3 },
      { prize: ["b"], p: 0.3 },
    ],
    [
      { prize: ["n"], p: 0.25 },
      { prize: ["b"], p: 0.25 },
      { prize: ["r"], p: 0.3 },
      { prize: ["q"], p: 0.15 },
      { prize: ["q", "r"], p: 0.05 },
    ],
    [{ prize: ["q", "q"], p: 1 }],
  ] as readonly (readonly { prize: readonly string[]; p: number }[])[],
  carrotPrizes: [["q", "q"], ["q", "r"], ["q"], ["r"], ["b"], ["n"], ["p", "p"], ["p"]] as readonly (readonly string[])[],
  carrotLooks: 4,
  carrotNodes: 30_000,
  carrotSkill: [1000, 2000] as readonly [number, number],
  carrotWeightMin: 0.25,
  carrotMinGain: 0.25,
  /**
   * Smudgy's Camouflage (Eric, Oct 19; docs/decisions/2026-10-19-smudgy-rules.md): his first two moves are forced (an end
   * pawn two squares, then that side's rook out to its third rank). A forced move that can't be played on a turn (he's
   * in check, a square is taken, the rook's square would be simply lost) waits for his next turn, up to camoTries turns
   * in all, then no Camouflage this battle. After the swap the hidden rook moves only like a pawn until the crowd's
   * camoStrikeTurn-th move after it ("from his 3rd turn after the swap": his turn after that crowd move), then any rook move.
   */
  camoTries: 3,
  camoStrikeTurn: 3,
  /**
   * Smudgy's Repaint (his ultimate, his whole turn; Eric, Oct 19): one of his pawns painted the crowd's color and one of
   * the crowd's knights or bishops his. The engine picks the pair: what it gains him (his evaluation with the crowd to
   * move after it, against his evaluation before it with him to move, in pawns: passScores, each position searched at
   * repaintNodes) within repaintBand, the nearest repaintTarget; none in the band: no Repaint that turn, again at the
   * start of his next. At most repaintMax a battle (then his meter is off).
   */
  repaintBand: [1.5, 2.5] as readonly [number, number],
  repaintTarget: 2,
  repaintMax: 2,
  repaintNodes: 30_000,
  /**
   * Moo & Moon's Moonbeam (Eric, Oct 20; docs/decisions/2026-10-20-moo-rules.md): after every moonbeamEvery-th move of
   * his, at the end of his turn, a beam stuns one of the crowd's pieces: it can't move on the crowd's next turn. Never
   * the king; always a move left for the crowd. Which piece (moonbeamTarget; the Full Moon's flurry the same, on
   * different pieces): "best", the piece that moves in the crowd's engine-best move after his move (the host's engine:
   * its top moonbeamLines lines at moonbeamNodes), then the pieces of its next lines, then by value; "valuable",
   * Ginger's freeze's way, one of the crowd's three most valuable mobile pieces at random; "random", any of its mobile
   * pieces at random (from the seed). "random" since the raid sim (Oct 20, the director's call while Eric slept: "best"
   * left the crowd 0.02, "random" 0.21; reports/moo-sim.md); "best" was the director's first reading of "most useful".
   */
  moonbeamTarget: "random" as "best" | "valuable" | "random",
  moonbeamEvery: 3,
  moonbeamLines: 8,
  moonbeamNodes: 50_000,
  /**
   * His Full Moon (on the rage meter; Eric, Oct 20: "max stockfish for 5 of his plays... we may even need to make it like
   * 7"): fullMoonMoves of his moves at full strength (the engine's best at his move's own budget, bossNodes: never his
   * brain, a slip or the guard), the first ending with a flurry of flurryBeams moonbeams on different pieces.
   */
  fullMoonMoves: 5,
  flurryBeams: 5,
  /**
   * The hippo gardener's Seeds (his passive; Eric, Oct 20: "a second meter on a real timer... every 30 seconds it fills and
   * he plants a seed"; docs/decisions/2026-10-21-gardener-rules.md): seedsAtStart waiting as the battle begins, then one
   * every seedEverySec seconds of real time, whoever's turn it is, up to seedMax waiting. Where they are is never decided
   * until he waters. Online the server's clock; solo and Boss alone the device's, counting only while the page is in view.
   */
  seedsAtStart: 5,
  seedEverySec: 30,
  seedMax: 10,
  /**
   * His Watering (his ultimate, his whole turn; Eric, Oct 20: "his lottery"): every waiting seed rolls one of these, in
   * percent (seeded from the battle): nothing, a plain plant (blocks an empty square for plantTurns crowd turns), a killer
   * plant (eats a non-king piece of either side), a pawn, a knight, bishop or rook (which one: seeded, a third each), a
   * queen. They add up to 100.
   */
  waterOdds: { nothing: 40, plant: 30, killer: 12, pawn: 12, piece: 5, queen: 1 } as Readonly<Record<"nothing" | "plant" | "killer" | "pawn" | "piece" | "queen", number>>,
  plantTurns: 3,
  /**
   * Where the host's engines put what came up (waterFrom: outcome by outcome, the biggest first): his total gain from the
   * watering (his evaluation after it, the crowd to move, against his before it, him to move, in pawns of log-odds,
   * bouncePawnLogit) at most the band's top, nearest waterTarget. A rolled queen (the jackpot) goes where it gains nearest
   * jackpotMax, however far over (a queen up saturates the engine's win chances near 7 from an even position, so a cap
   * would only ever leave it hanging: Eric, "if he gets really lucky, you're just losing the game, and that's fine"), and
   * the rest of that watering is placed under jackpotMax (or what the queen gained), nearest it. An outcome that can't be
   * placed without going over the top is dropped (it comes up as nothing). Under the band's bottom is kept: what came up
   * was small (only plants), and nothing placed would only be less. Each outcome
   * weighs at most waterLooks squares (seeded among those its guards allow; a killer plant the crowd's pieces first, his
   * own only when none keeps the band), each searched at waterNodes; a watering searches at most waterBudget positions in
   * all, besides the one before it, so ten seeds never stall a phone.
   */
  waterBand: [0.5, 2.5] as readonly [number, number],
  waterTarget: 1.5,
  jackpotMax: 6,
  waterLooks: 4,
  waterNodes: 20_000,
  waterBudget: 48,
  /**
   * The placement's time limit on the host (ms from when it starts): past it, it answers with what it has placed so far
   * (every step is a whole watering that passes the guards), well inside the boss request's 15 s timeout, so a slow phone
   * never runs past it and the watering is never asked of host after host.
   */
  waterTimeMs: 8_000,
  /**
   * The circus tiger's Balloons (his passive; Eric, Oct 23: "a meter builds continuously and he blows up a balloon... every
   * 15 s it changes shape a little closer to a chess piece"; docs/decisions/2026-10-23-tiger-rules.md): a balloon goes on
   * his nozzle at the start of his turn when it's empty, and blows up in balloonStages stages of balloonStageSec seconds of
   * real time (the battle's clock: the server's online, the page's visible time solo), then waits, ready. At the end of
   * his turn a ready balloon lands as his piece or pops. Its shape (percent; the fake queen looks like a queen) and
   * whether it pops (percent of that shape's) are rolled as it goes on: the shape from the battle's seed, a queen's being a
   * fake one and every pop from the battle's own secret (BalloonState.secret). About 58% pop (Oct 24: pops 50 for a pawn,
   * 65 for a knight, bishop or rook; the fake queen always, the real one never). Eric, Oct 24: "the balloons… they're not
   * landing… for a full game… he's way too easy otherwise"; "about a bishop's worth… on average of pieces a game, like a
   * bishop and a pawn… it's still just a little too slow." Target: landed material a battle, at Eric's pace (a 5 s pick), of
   * 4 or more, a bishop and a pawn as the floor.
   * balloonStageSec is the raid sim's, at that pace (20 battles each): 30 s gave 2.15 landed material a battle; 12 s gave
   * 6.35 at the old pops (40 / 55) and 5.50 at these (reports/tiger-sim.md, Oct 24).
   */
  balloonStages: 4,
  balloonStageSec: 12,
  balloonOdds: { pawn: 55, knight: 13, bishop: 13, rook: 6, fakeQueen: 10, queen: 3 } as Readonly<Record<"pawn" | "knight" | "bishop" | "rook" | "fakeQueen" | "queen", number>>,
  balloonPops: { pawn: 50, knight: 65, bishop: 65, rook: 65, fakeQueen: 100, queen: 0 } as Readonly<Record<"pawn" | "knight" | "bishop" | "rook" | "fakeQueen" | "queen", number>>,
  /** How many colors a balloon can be (seeded, not tied to its shape: the art's six). */
  balloonColors: 6,
  /**
   * Where a landing balloon goes (landFrom, on the host's engines): only squares the crowd doesn't attack (landCheck), and of
   * those the least valuable: his gain from it (his evaluation after it, the crowd to move, against before it, in pawns of
   * log-odds: bouncePawnLogit) in its shape's band nearest the band's low end; none in the band, the nearest. The bands are
   * measured in the engine's own units (packages/sim/scripts/tiger-bands.ts, Oct 24: 16 even middlegames, up to 10 safe
   * squares a shape): a safe pawn gains 0.3 to 1.6 (the middle half), while any safe piece saturates the engine's win
   * chances (7.1 to 8.0 for a knight, bishop, rook or queen alike), so a piece's band is that, and aiming at its low end
   * takes the least useful safe square. Up to balloonLooks squares weighed (seeded), each at balloonNodes.
   */
  balloonBands: { p: [0.3, 1.5], n: [7, 8.5], b: [7, 8.5], r: [7, 8.5], q: [7, 8.5] } as Readonly<Record<"p" | "n" | "b" | "r" | "q", readonly [number, number]>>,
  balloonLooks: 8,
  balloonNodes: 15_000,
  /** A landing's search time on the host (ms; past it, the squares searched so far), its own share after a cast's. */
  balloonTimeMs: 3_000,
  /**
   * His Hoops (his ultimate; Eric, Oct 23: "3 staggered burning hoops on the board each covering 2x2 areas. No pieces can
   * leave that area for 2 turns, nothing can get in or out"). **After his move** (Eric, Oct 24: "he plays his move, then
   * before your turn, he throws the rings"; until then they were his whole turn): hoopsCount 2x2 blocks within ranks 2 to 7
   * (the inner ranks 3 to 6 first), apart from each other, walled for the crowd's next hoopsCrowdMoves moves (his move
   * between them too). Where (hoopsFrom, on the host's engines, block by block, on the position after his move): his gain
   * with the walls in force against the same position without them (the crowd to move both) in hoopsBand, nearest
   * hoopsTarget; up to hoopsLooks blocks weighed a step, each at hoopsNodes, within hoopsTimeMs (past it, the blocks placed
   * so far; the server gives the host that much longer for his move's request). How often: rageSpeed.tiger.
   */
  hoopsCount: 3,
  hoopsCrowdMoves: 2,
  hoopsBand: [0.5, 2.5] as readonly [number, number],
  hoopsTarget: 1.5,
  hoopsLooks: 8,
  hoopsNodes: 20_000,
  hoopsTimeMs: 8_000,
} as const;

/**
 * How Sawyer's split pawn looks (packages/app/src/components/Sawyer.tsx). Looks only: the rules, the engine and the
 * position are the same either way, and so is the moment's length.
 * - `split`: "morph" (Eric, Oct 11): the saw goes through the pawn, which squashes and pinches into two smaller whole
 *   pawns (about half size) that hop to their squares. "halves": the first version, the pawn cut into two halves that
 *   come apart, and every board then drawing the pair as halves wherever they go. To go back: set "halves".
 * - `settle` (the morph only): "grow": the small pawns ease up to a normal pawn's size as they land (they're ordinary
 *   pawns). "small": they stay small, and every board draws the pair small wherever they go.
 */
export const SAWYER_LOOKS: { readonly split: "morph" | "halves"; readonly settle: "grow" | "small" } = { split: "morph", settle: "grow" };

/**
 * Hollow's string of Christmas lights (packages/app/src/characters/lights.ts; Eric, Oct 11: random colors each game).
 * Looks only. Each battle his ten bulbs take a fresh order of these colors, the same on every screen of the battle
 * (from the battle's seed), never one color on two bulbs within three of each other along the wire (so no two bulbs
 * ever lit side by side match, as the countdown puts every third one out). Every place a bulb is drawn takes it: his
 * sprite and its moments, his whip at a king and its lashes, Lights out, the strip of bulbs by the boss bar.
 * Each color: `glass` (lit) and `shade` (the glass's shaded side, darker); a glint (near white) and the glow round a
 * lit bulb (the glass, see-through) are made from `glass`. Bright enough to read on his charcoal fur and on the
 * board's squares; purple and pink kept clear of his own violet. At least 3 colors.
 */
export const HOLLOW_LIGHTS: { readonly colours: readonly { readonly name: string; readonly glass: string; readonly shade: string }[] } = {
  colours: [
    { name: "red", glass: "#ff4a4a", shade: "#b3172c" },
    { name: "yellow", glass: "#ffe14a", shade: "#c79a0e" },
    { name: "blue", glass: "#4f8dff", shade: "#2248c4" },
    { name: "green", glass: "#4fe36c", shade: "#178f3a" },
    { name: "orange", glass: "#ff9433", shade: "#c2550c" },
    { name: "purple", glass: "#c477ff", shade: "#7a2fd1" },
    { name: "pink", glass: "#ff7dcf", shade: "#c22f8b" },
    { name: "cyan", glass: "#45ecef", shade: "#0f97a3" },
  ],
};

/**
 * The Hidden Boss's phase 2 (Eric, Oct 14; DECISIONS.md, "The Hidden Boss, phase 2"): four boards of Chess960 at once,
 * each from its own start position, against Stockfish (never Maia: it can't play Chess960). Solo only, on this device:
 * an admin's Boss alone (you on one board, bots on the other three) and a solo Crowd's boss final (the other finalists on
 * the other three; Oct 14). Not online yet: there phase 1 won is the crowd's victory.
 */
/**
 * The Hidden Boss's chatter (Eric, Oct 15: "he stopped saying voice lines after like 10 moves... he should be slowly,
 * as the game goes on, saying those lines about being teamed up on and getting more upset"): one line about every
 * `everyMs` of play, give or take `jitterMs`, in phase 1 (the whole of it, the bullet stretch too) and in phase 2 (while
 * any board is in play); `recluse-talk.ts`. By the clock, not by moves: moves come at very different speeds (a slow
 * think early in phase 1, a second each in its bullet stretch, one board left late in phase 2), and phase 2's old
 * every-8-of-his-moves went quiet for minutes once boards ended. A line is said only when no other line of his is up
 * and, in phase 1, on your own move (never over his moments, whose lines come first); due but blocked, it's tried again
 * `retryMs` later instead of waiting a whole interval. Stages by play time so far (`middleFromMs`, `lateFromMs`, per
 * phase): suspicious muttering, then accusations, then angry ranting. 15 s: a line, read and gone (about 5 to 8 s),
 * then a quiet spell about as long, so he keeps talking without drowning out his moments or the God King.
 * Phase 1 (about 3 to 6 minutes: six slow moves, then the bullet stretch): the middle from 1:15, the late from 3:00.
 * Phase 2 (about 2 to 5 minutes): the middle from 0:45, the late from 1:45. Estimates, to tune after playtests.
 */
export const RECLUSE_TALK = {
  everyMs: 15_000,
  jitterMs: 3_000,
  retryMs: 1_500,
  1: { middleFromMs: 75_000, lateFromMs: 180_000 },
  2: { middleFromMs: 45_000, lateFromMs: 105_000 },
} as const;

export const RECLUSE_PHASE2 = {
  /** How many boards (all of them must be won to beat him). */
  boards: 4,
  /**
   * His strength (Stockfish's UCI_Elo, its own engine-calibrated scale, not a FIDE rating). Eric, Oct 14: about 2750 to
   * start ("at that very fast pace 2750 may be sufficient"; the roadmap's earlier figure was 3000). A starting value, to
   * tune once real players have tried him; the next step is the engine-against-engine sim at the real clock.
   */
  elo: 2750,
  /** His search per move: at most this many nodes, and never longer than `moveMs` (a phone stays responsive). */
  nodes: 250_000,
  /**
   * His most time for one move (ms): one engine serves the four boards in turn, so a phone keeps up. Short enough that
   * four boards on a slow phone never wait more than about 3 s for him; at a phone's speed it caps his search below
   * `nodes`, so his strength there is less than the number says (an estimate, not yet measured on a real phone).
   */
  moveMs: 900,
  /**
   * Each player's bank on each board (s): ultra-fast bullet, no increment, nothing adds time; out of time loses that
   * board. His own moves take no time from it (he has no clock, as in phase 1). An estimate (2:00 a board): not yet
   * sim-tested.
   */
  bankSeconds: 120,
  /**
   * His ultimate (Eric, Oct 14): a move that takes longer than `slowMoveSeconds` (anyone's, on any board, before it
   * comes) is a slow move: he says so (one of his lines about playing faster), counted once for the team as the move
   * is made (the X marks beside every board). The team's `slowMovesForUlt`-th slow move brings his ultimate (Eric, Oct
   * 14, after playtesting: at 10 of 10; it was the 6th, then the 5th): from then on every move on every board has
   * `ultMoveSeconds`, no bank, everyone's few seconds starting fresh as it comes; when they run out, a random legal
   * move is played for that player (never a loss on time). Before it, the bank above applies. Estimates, not yet
   * sim-tested: with a 2:00 bank (about 3 s a move over a game) slow moves will be common.
   */
  slowMoveSeconds: 5,
  slowMovesForUlt: 10,
  ultMoveSeconds: 5,
  /**
   * The bots on the other boards (Boss alone's, or a solo Crowd's finalists beside you): Stockfish at this strength, this
   * many nodes, within `botMoveMs`.
   */
  botElo: 2200,
  botNodes: 100_000,
  /** A bot's thinking per move (ms, its own clock running): a random time in this range, as a bullet player's. */
  botMoveMs: [900, 2600] as readonly [number, number],
  /**
   * Now and then (this share of its moves, before his ultimate) a bot thinks longer, `botSlowMs` (past
   * `slowMoveSeconds`), so his slow-move count and his ultimate come in Boss alone too, not only from you.
   */
  botSlowChance: 0.12,
  botSlowMs: [5400, 7000] as readonly [number, number],
  /** Once every board is decided: how long his reaction holds the boards before the result screen (ms). */
  endMs: 3200,
  /**
   * The phase change's pace (Eric, Oct 17, after playing it: "everything's perfect, but it happens way too fast"): about
   * 10 s more from the mate to the split, the animations themselves unchanged, then a countdown before the clocks
   * (packages/app/src/recluse-phase2.ts, PHASE_CHANGE; docs/decisions/2026-10-17-phase-change-pace.md).
   */
  change: {
    /**
     * After the mate, more of his words before he seizes the God King's power (ms added before the seize): his
     * mumbling, then his new lines (RECLUSE_LINES.seizeTalk), the last about taking that power, while the God King
     * gloats over him.
     */
    talkMs: 4500,
    /** The power landed: he holds his closed fist, his engine eye newly lit, before he rises (ms). */
    absorbHoldMs: 1500,
    /** His cast on the board: the chant over the open book held this much longer before the board cracks (ms). */
    castHoldMs: 4000,
    /** The boards split and set: a big 5, 4, 3, 2, 1 on every board before phase 2's clocks run (s). */
    countdownSeconds: 5,
  },
};

/** BOSS_POWERS with room for other numbers (tests, and the switch turned off). */
export type BossPowerSettings = {
  -readonly [K in keyof typeof BOSS_POWERS]: (typeof BOSS_POWERS)[K] extends boolean ? boolean : (typeof BOSS_POWERS)[K] extends number ? number : (typeof BOSS_POWERS)[K];
};

/**
 * A boss's fighting-game banners over the board: each power's (the rage warning, his passive, his ultimate), QUEEN
 * SLAIN! and QUEEN DOWN!, "START!", and the Hidden Boss's "PHASE 2" and "5 SECONDS!". Each slides in, holds and slides
 * off by its end (styles.css times the band's exit from it). Eric, Oct 15: every banner a second longer (2.5 s); Oct 16,
 * a boss's a second shorter again: "when the bosses ult they are ulting while the banner is still up, same thing for
 * Toy Blocks... Do 1 second less" (docs/decisions/2026-10-16-banner-timing.md). Oct 24: BANNER_PLUS_MS on top of
 * every one (below), each a boss's banner's whole length (bossBannerMs), and what comes after it that much later.
 */
export const BOSS_BANNER = {
  /** How long one showed before Oct 24's extra (ms): what the beats inside a power's moment are counted from. */
  ms: 1500,
  /** "PHASE 2", as the Hidden Boss's phase change ends (its clocks start after it; the extra on top). */
  phase2Ms: 1400,
} as const;

/**
 * The extra time on every full-width banner over the board, in every mode (ms). Eric, Oct 24, on his phone: "we need
 * the banners to appear… at least… 3/4 of a second longer, or 1/2 a second even, just to start… across the entire
 * board… the large banners… when the boss ults, when your queen is down, for any mode, those things should be more
 * consistent, because it's just so fast." Every beat that comes after a banner comes this much later too, so nothing
 * plays under a longer banner (the Oct 15 trap: docs/decisions/2026-10-24-banner-and-speech-time.md). A tester's
 * `?bannerplus=` (seconds) sets it for a page's games on the device (the app's test-switches.ts); online the server
 * and every screen use this default.
 */
export const BANNER_PLUS_MS = 750;
let bannerPlusFrom: () => number | null = () => null;
/** The extra time on every banner now (ms): BANNER_PLUS_MS, or a tester's `?bannerplus=` for a game on the device. */
export const bannerPlusMs = (): number => bannerPlusFrom() ?? BANNER_PLUS_MS;
/** Where a page's own extra comes from (the app's `?bannerplus=`; null: the default). The server never sets one. */
export function setBannerPlusSource(from: () => number | null): void {
  bannerPlusFrom = from;
}
/**
 * How long every boss's banner shows (ms), each power's and QUEEN SLAIN!, QUEEN DOWN!, "START!", BULLET!, "5 SECONDS!":
 * the same length for all (Eric, Oct 24: "more consistent"), BOSS_BANNER.ms and the extra. One that ended sooner for its
 * power (Leapfrog's, 0.72 s) is brought up to it, and its power waits for it.
 */
export const bossBannerMs = (): number => BOSS_BANNER.ms + bannerPlusMs();
/**
 * How long a pre-game vote's result shows before the next vote or the match (ms): `voteResultSeconds` (the walk to the
 * winner, then its banner) and the banners' extra (Oct 24), Crowd and Squads, solo and online.
 */
export const voteResultMs = (s: { voteResultSeconds: number }): number => s.voteResultSeconds * 1000 + bannerPlusMs();

/**
 * How long every speech line stays up, and how lines take turns (Eric, Oct 10: Ginger's line came and went at once).
 * The rule for every boss's lines and the God King's, in one place (packages/app/src/speech.tsx): a line types out
 * (`typeMs` a character), then stays fully readable for `readMs` plus `perCharMs` a character, and `longExtraMs` more
 * for a line longer than `longChars` (about one row of the bar's bubble on a 390 px phone), at most `maxReadMs`, then
 * fades (`fadeMs`). Once a line has started, nothing takes it off before it has typed out and been fully readable for
 * `minReadMs`: a critical line that comes sooner waits for that, then cuts in; any other waits its turn, highest
 * priority first, and is dropped if it can't start within `waitMs` of being said (it would be stale by then).
 * Eric, Oct 10: "a few seconds… two, three, four, not that long". Oct 24 (Babur's thinking line, cut off by his hoops'
 * line a quarter of a second in): "same with the text bubbles when the boss talks… I couldn't even see what the heck he
 * was saying… because it was so fast. And it shouldn't linger forever… they need to be like a second longer if they're
 * like two rows or more than a certain number of words, and then even… sit out a little bit longer." A short line now
 * rests about 3 s once typed, a two-row one (50 characters) about 5.5 s, none over 6.5 s.
 */
export const SPEECH = {
  typeMs: 28,
  readMs: 2700,
  perCharMs: 35,
  longChars: 30,
  longExtraMs: 1000,
  maxReadMs: 6500,
  minReadMs: 1500,
  fadeMs: 260,
  waitMs: 5000,
} as const;

/**
 * The God King's chatter (packages/app/src/godKing.ts). Eric, Oct 9, 2026: he talked too much. Critical moments always
 * speak (a new danger to your queen or king, a mate threat, a queen taken either way, his own strikes and moves, his
 * Last Stand, a boss's power); everything else is paced by these numbers.
 */
export const KING_SPEECH = {
  /** The least time between two lines that aren't critical (ms). */
  quietMs: 8000,
  /** Small talk (idle, the tap-me nudge, winning or losing) rests this many crowd moves after any line… */
  restMoves: 8,
  /** …then its chance grows by this much with each quiet move. */
  perQuietMove: 0.1,
  /** A remark on a move (a brilliant, good or bad move, a capture, a check given, the boss's slip) waits this many crowd moves after the last remark. */
  remarkGapMoves: 6,
  /** How likely each remark and each piece of small talk is to be said, when it may be (critical cues always speak). */
  chance: {
    greatMove: 0.3,
    goodMove: 0.08,
    badMove: 0.35,
    crowdCapture: 0.2,
    crowdCheck: 0.25,
    bossCapture: 0.2,
    bossBlunder: 0.5,
    staggered: 0.5,
    idle: 0,
    nudge: 0.1,
    winning: 0.1,
    losing: 0.1,
    spent: 1,
  } as Record<string, number>,
} as const;

/**
 * Solo's difficulty:
 * - `elo`: Elo on top of the boss's usual strength (yours), capped at what the engine plays (its powers' own brains
 *   read that strength).
 * - `maia`: in Boss alone, the rating Maia picks the boss's moves at, whatever your rating (a human's rating, Maia's
 *   scale). Eric, Oct 18: Hardest was "way too easy"; the strength's Maia curve, tuned against bots, put every
 *   difficulty at or near Maia's floor (600) for a 1580 player, and it gave up its queen. The harder of two ladders
 *   offered ("better they are a bit harder rn"); a too easy / too hard button on the results screen will tune it.
 */
export const BOSS_DIFFICULTY = [
  { id: "easy", label: "Easy", elo: -300, maia: 1000 },
  { id: "normal", label: "Normal", elo: 0, maia: 1400 },
  { id: "hard", label: "Hard", elo: 250, maia: 1800 },
  { id: "hardest", label: "Hardest", elo: 500, maia: 2200 },
] as const;
export type BossDifficultyId = (typeof BOSS_DIFFICULTY)[number]["id"];

/**
 * The level a boss's bar shows, "LVL 50" (Eric, Oct 23: "really just the Maia or Stockfish level converted to a range up to
 * level 100"; "randomly pick between say 40 and 60 even if it really means 1400 Elo... this way it feels unique";
 * docs/decisions/2026-10-23-boss-bar.md): its rating (bossRatingShown) divided by `divisor`, plus a random offset of up to
 * `spread` either way drawn once from the battle's seed (the same on every screen and after a reload), from 1 to `max` (100 is
 * Fischer's: the Hidden Boss's bar says "LVL ???"). The level follows the boss's strength while it changes for a time, by
 * the same divisor: `weakDrop` Elo less for a move the King's strike weakens, the engine's top (ENGINE_MAX_ELO) for the
 * Full Moon's moves and the showdown's follow-up (bossLevelNow).
 */
export const BOSS_LEVEL = { divisor: 28, spread: 10, max: 99, weakDrop: 700 } as const;

/**
 * How a boss picks its moves (DECISIONS.md: "A human-like boss: Maia-3 for Ginger", Oct 11; "Every boss on Maia",
 * Oct 12):
 * - `stockfish`: Stockfish at the boss's UCI_Elo with the blunder guard (bossMaxLoss, bossMaxLogitLoss), as always.
 * - `maia-raw`: Maia-3's own move, drawn mildly from its probabilities (temperature, topP below), no guard: a human's
 *   strength, a human's mistakes. Every boss's brain (Eric, Oct 12).
 * - `maia-light`, `maia-full`, `maia-strict`: Maia's move unless it gives away more than the guard allows against the
 *   boss's own top-8 Stockfish search (no extra engine work): then Maia's next likely move that passes, else
 *   Stockfish's best. The bridge band plays the light guard, then the strict one.
 */
export type BossBrain = "stockfish" | "maia-raw" | "maia-light" | "maia-full" | "maia-strict";
export const BOSS_BRAINS: readonly BossBrain[] = ["stockfish", "maia-raw", "maia-light", "maia-full", "maia-strict"];

export interface BrainGuard {
  maxLoss: number;
  maxLogitLoss: number;
}

export const BOSS_BRAIN = {
  /**
   * Every boss's brain (Eric, Oct 12: every boss on Maia, no guard; "Maia's mistakes are human ones", the boss's edge
   * comes from its powers). The guards' settings stay below, for the bridge band and the admins' Brain picker.
   */
  brain: "maia-raw" as BossBrain,
  /** A boss on another brain than `brain` (by BOSS_ROSTER id): none. */
  byBoss: {} as Readonly<Record<string, BossBrain>>,
  /**
   * A boss whose brain is fixed (by BOSS_ROSTER id), whatever the player's rating, the difficulty, the crowd or an admin's
   * Brain picker: that brain at Maia's top rating (maiaRating's last point, 2500), no guard and no Stockfish share; its
   * strength is fixed too, at the level Maia reaches it (2650; bossStrength). The Hidden Boss's phase 1 (Eric, Oct 14:
   * Maia at its strongest, "so it feels like an aggressive human playing").
   */
  fixed: { recluse: "maia-raw" } as Readonly<Record<string, BossBrain>>,
  /**
   * The Maia brain for players too, not only admins: the one value that switches it on. On since Oct 14, 2026 (Eric:
   * "flip it"), after the Maia box's source was published on the site under the AGPL (DECISIONS.md, "The Maia box's
   * source on the site"). Off, players would meet Stockfish and never download Maia; admins meet Maia either way.
   */
  forPlayers: true,
  /**
   * Maia's rating for a boss's level (its strength, plus crowdMargin for a crowd), on straight lines between these
   * points: below the first along the first line, down to maiaRatingMin; above the last held there (Maia's ceiling).
   * Calibrated against bot crowds and lone bots in plain chess (reports/maia-calibration.md; DECISIONS.md, "Maia bosses
   * harder"): the boss clearly favored, the crowd or the lone player scoring about 0.30 before the powers and the God
   * King (Eric, Oct 12: "people read 'boss' and assume it's a challenge").
   */
  maiaRating: [
    [1800, 600],
    [2000, 850],
    [2250, 1100],
    [2400, 2000],
    [2650, 2500],
  ] as readonly (readonly [number, number])[],
  maiaRatingMin: 600,
  /**
   * A crowd voting together plays above its average member (Eric, Oct 11): in a battle where more than one picks the
   * crowd's moves (a raid, the Crowd's boss battle; not Boss alone), the boss's level is this much above its strength.
   * Measured: a lone bot needed a Maia about this much weaker than a crowd of its rating (reports/maia-calibration.md).
   */
  crowdMargin: 400,
  /**
   * The bridge band (Eric, Oct 11), so the boss's strength never jumps on its way to Stockfish:
   * - the guard follows the level (where Maia with no guard can't hold a crowd any more, Eric, Oct 12: start the bridge
   *   earlier rather than lose the challenge): the light guard from bridgeFrom, the strict one from bridgeStrictFrom;
   * - Stockfish's share of the moves follows the strength: from none at bridgeShareFrom to bridgeStockfishShare just
   *   under stockfishFrom, so the boss arrives at today's Stockfish boss there.
   */
  bridgeFrom: 2400,
  bridgeStrictFrom: 2800,
  bridgeShareFrom: 2500,
  bridgeStockfishShare: 1,
  /** From this strength on the boss is always Stockfish, as before (Maia's humans stop well short of it). */
  stockfishFrom: 2800,
  /** Maia's own draw from its probabilities: a little sharper than a human's (temperature), and none of the rarest moves (topP). */
  temperature: 0.8,
  topP: 0.9,
  /** The guarded brains try Maia's likeliest moves in turn: at most this many, each at least this probable. */
  candidates: 5,
  minP: 0.03,
  /** Light guard: never a move giving away more than this against Stockfish's best. */
  light: { maxLoss: 25, maxLogitLoss: 2 } as BrainGuard,
  /** Full guard: today's blunder guard (bossMaxLoss, bossMaxLogitLoss). */
  full: { maxLoss: 10, maxLogitLoss: 1 } as BrainGuard,
  /** Strict guard: only about 4 points (the bridge band's top). */
  strict: { maxLoss: 4, maxLogitLoss: 0.5 } as BrainGuard,
  /** Maia's answer is waited for this long at most (from the request, made alongside the top-8 search); then Stockfish. */
  timeoutMs: 1500,
  /** The model's load gives up after this long (the boss plays Stockfish meanwhile). */
  loadTimeoutMs: 60_000,
  /**
   * A solo boss battle on Maia waits for it, at most this long, before its intro: the loading step ("Loading the
   * boss…", the download's bar, then "Starting…"), with this device's Stockfish paused so Maia loads alone (Eric's
   * iPhone, Oct 14: Maia failed to load beside it). Then the battle begins whatever happened: not ready yet, the boss
   * plays Stockfish until it is, as before. 20 s: a first download takes a few seconds on Wi-Fi and the start a second
   * or two (Eric: "People can deal with it if they need to wait 5 or 10 seconds"); a slow connection gives up rather
   * than keep a player waiting. Online nothing waits (other players can't wait on one device).
   */
  loadGateMs: 20_000,
  /**
   * After the loading step, this device's Stockfish must answer again within this long; if it doesn't (short of
   * memory beside Maia), Maia is closed and Stockfish started once more: the battle needs Stockfish, not Maia.
   */
  stockfishBackMs: 15_000,
  /**
   * Maia's download, rounded, for the players' words (the loading step's note, the FAQ): its three files unpacked,
   * the model 25.2 MB, onnxruntime's WebAssembly 14.2 MB and the worker 0.1 MB (packages/app/test/maia-gate.test.ts
   * checks it against the files). Over the network it's less (the WebAssembly comes compressed), never more.
   */
  downloadMb: 40,
  /** Candidates Maia lists per move. */
  multipv: 8,
};
export type BossBrainSettings = typeof BOSS_BRAIN;

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
export function modeSettings(mode: GameMode, opts: { augments?: boolean } = {}): Partial<Settings> {
  if (mode !== "crowd") return {};
  return { ...CROWD_SETTINGS, ...(opts.augments !== undefined ? { augments: opts.augments } : {}) };
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
  /** Its pill color (a prism pill paints a rainbow instead; this is its color elsewhere). */
  color: string;
  effect?: RankEffect;
}

/**
 * The player ranks, lowest first. The names honor Puzzle Pirates, whose skill ladder they are (Eric, Oct 6, 2026).
 * Cutoffs are fixed and rounded to 50, set so a chess-like spread of ratings (center 1500, SD 350) lands about
 * 5 / 7 / 9 / 10 / 11 / 12 / 11 / 10 / 9 / 7 / 5 / 2.5 / 1.2 / 0.3 % in each, lowest first; the shares these cutoffs
 * actually give are in DECISIONS.md ("The rank ladder"). Colors climb from dull gray through earth, green and sky to
 * violet, and the top three are special. Each color keeps its pill readable on both themes (4.5:1 or better).
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
  /**
   * Home's Boss raid card (Eric, Oct 16): its still portrait moves on to the next playable boss this often (never the
   * Hidden Boss), with a fade of `bossCardFadeMs` (none under reduced motion). Test switch `?cardMs=` (ms) for a quicker
   * one.
   */
  bossCardMs: 30_000,
  bossCardFadeMs: 600,
  /** Home's hero pawn hops on a phone (Eric: "add the bounce effect every 30 seconds like we have in autochess"): the first hop this many seconds after home shows… */
  heroHopFirstSec: 4,
  /** …then one every this many seconds (never under reduced motion). */
  heroHopEverySec: 30,
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
 * already exist: the crates' head, face and weapon pieces (no skins: they hide the team's color; nothing Mythic: that
 * stays the players'). See DECISIONS.md, "Vote board follow-ups". The old shop hats are crate head pieces now (Beta
 * Crate, Oct 11, 2026), so they're in `head`, and the old "shop hat" share joined the head share.
 */
export const BOT_LOOKS = {
  /** Out of 100: nothing on; one head piece; one face piece; one weapon; two things. */
  odds: { plain: 42, head: 35, face: 11, weapon: 5, two: 7 },
  head: ["party-hat", "little-crown", "wizard-hat", "top-hat", "viking-helm", "beanie", "antlers", "santa-hat", "present"],
  face: ["santa-beard", "ski-goggles"],
  weapon: ["gift-tube", "candy-cane"],
  /** Two things: a head piece and then a face piece, or now and then a weapon. */
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
   * fair scoring first. On only with an engine on the devices as good as the server's. (A device's re-check that leaves
   * out only the picks above the first line, as an app from before Oct 16 does, is never blamed: the server's numbers
   * decide, and a device could copy that to dodge blame. Revisit before turning this on:
   * docs/decisions/2026-10-16-the-best-move-is-the-highest-scored.md.)
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
   * anyone. Since Oct 13 a match everyone has left wraps up as the last of them goes (LEAVING.awayMs after the last
   * one dropped), so this only clears one that's stuck. Never while anyone is connected.
   */
  lobbyAbandonedMinutes: 180,
} as const;

/**
 * Resigning and leaving a match (Eric, Oct 13: "we need a surrender button... for every game mode"; DECISIONS.md,
 * "Resign: leaving a match in every mode"). Resigning in a solo game ends it at once, a loss. Online you can't end the
 * game for everyone: you leave it, out in the last place still open (a loss on your record), and a bot plays your seat
 * so your team isn't short (with Bots off, only where a side would be left empty, or in a final). Before move 1 it's
 * just Leave: nothing recorded. Once the last person has gone, the lobby wraps up at once and closes, freeing its code.
 */
export const LEAVING = {
  /**
   * Someone gone from a match in progress this long (a closed tab, the back button, the app in the background, a
   * dropped connection) has left it: as if they'd resigned (before move 1, as if they'd pressed Leave). Back within it
   * (a reload, a quick look at another app), the seat is still theirs. The same hold as Bots off's waiting seats
   * (MATCHMAKING.botsOffSeatHoldMs). In Squads it only decides when nobody is left at all: someone away there keeps
   * Squads' own rule (a bot after noShowsBeforeBot misses, theirs again when they're back).
   */
  awayMs: 120_000,
  /** How strong the bot that takes a seat someone left plays (a temperature, as botSkillRange; Squads' replacementBotSkill is the same). */
  botSkill: 4,
  /** The app waits this long for the server to confirm a resign, then goes on anyway (the away rule covers the rest). */
  confirmWaitMs: 4_000,
} as const;

/** One of 1 v 1's time controls: a bank for the game and an increment after every timed move, as chess writes them. */
export interface DuelControl {
  id: string;
  /** Chess's own name for it ("Blitz"): the overlay reads "Timer: Blitz 3+2". */
  name: string;
  baseSeconds: number;
  incrementSeconds: number;
}

/** A tier of 1 v 1's ladder, and the color its pill is drawn in. */
export interface RankTierDef {
  name: string;
  color: string;
}

/**
 * Ranked 1 v 1 ("1 v 1 · Classic chess"; Eric, Oct 16, 2026; docs/areas/ranked.md and
 * docs/decisions/2026-10-16-ranked-1v1.md): normal chess between two signed-in players, matched by a hidden rating,
 * with League of Legends style ranks. Every number of the mode is here; core/ranked.ts does the math.
 */
export const RANKED_1V1 = {
  /**
   * The five time controls, fastest first. The vote's three zones are the first, the middle and the last (Bullet on
   * the left, Blitz in the middle, Rapid on the right); the two between are what neighbors' picks meet on. The ids are
   * stored with each game, so they never change; the names and numbers can.
   */
  controls: [
    { id: "bullet", name: "Bullet", baseSeconds: 60, incrementSeconds: 1 },
    { id: "bullet-blitz", name: "Bullet", baseSeconds: 120, incrementSeconds: 1 },
    { id: "blitz", name: "Blitz", baseSeconds: 180, incrementSeconds: 2 },
    { id: "blitz-rapid", name: "Blitz", baseSeconds: 300, incrementSeconds: 3 },
    { id: "rapid", name: "Rapid", baseSeconds: 600, incrementSeconds: 5 },
  ] as readonly DuelControl[],
  /** Neither player picks a zone: this control. */
  defaultControl: "blitz",
  /** How long both players have to drag their pawn into a zone. */
  voteSeconds: 5,
  /** The "found" moment (the versus screen's), before the vote starts on the board. */
  versusMs: 2_500,
  /** "Timer: Blitz 3+2" over the board after the vote, before White's first move. */
  overlayMs: 1_500,
  /** A game whose two players aren't both connected this long after it was made is called off (nothing recorded). */
  joinSeconds: 10,
  /** Each player's first move must come within this long (White's from the start, Black's from White's), or the game is aborted: no rank change. */
  firstMoveSeconds: 20,
  /** After a draw offer is declined (or lapses with a move), its maker offers again only after this many more moves of their own. */
  drawOfferEveryMoves: 3,
  /** A finished game's results stay up this long, then the game's object deletes everything it stored. */
  resultsKeepMinutes: 10,
  /** In the queue: after this long, "Few players online right now" offers Keep waiting and Play a bot (unranked). */
  fewPlayersSeconds: 45,
  /**
   * Pairing by the hidden rating, widening with the wait: two players meet when their ratings are within
   * `startRange + perSecond × seconds waited` (the longer wait's) `+ perRd ×` the larger of their two deviations, at most
   * `maxRange`. (A rating still being found, as in placements, is a guess give or take its deviation: a gap inside that
   * says nothing, so it shouldn't keep two players apart.)
   */
  match: { startRange: 100, perSecond: 10, perRd: 1, maxRange: 1000 },
  /**
   * The hidden rating: Glicko-1, each game its own rating period. A new player starts at their account's rating (from
   * other modes, clamped to `seedMin`-`seedMax`) or `start`, with `startRd`; the deviation shrinks with each game to
   * `minRd`, and grows back with idle days (`rdPerDay`: sqrt(RD² + c² × days)).
   */
  rating: { start: 1500, seedMin: 800, seedMax: 2400, startRd: 350, minRd: 60, rdPerDay: 18 },
  /**
   * The ladder (LoL's tiers, Eric: "we can even like take from there exactly"): each tier has divisions 4 → 1 of
   * `pointsPerDivision` points; past the last tier's division 1 come the apex tiers, with no divisions, each from its
   * points above Master's start. One number places a player: ladder = division index × 100 + points (Iron 4 0 = 0).
   */
  tiers: [
    { name: "Iron", color: "#8b8580" },
    { name: "Bronze", color: "#c08457" },
    { name: "Silver", color: "#aeb6c2" },
    { name: "Gold", color: "#f2c14e" },
    { name: "Platinum", color: "#4fd1c5" },
    { name: "Emerald", color: "#4ade80" },
    { name: "Diamond", color: "#7aa7ff" },
  ] as readonly RankTierDef[],
  divisions: 4,
  pointsPerDivision: 100,
  apex: [
    { name: "Master", color: "#c084fc", from: 0 },
    { name: "Grandmaster", color: "#f87171", from: 200 },
    { name: "Champion", color: "#fbbf24", from: 500 },
  ] as readonly (RankTierDef & { from: number })[],
  /**
   * Where the ladder sits on the hidden rating: Iron 4 0 points is `baseRating`, each point `ratingPerPoint` more (so
   * Master's start, 2800 points, is 2400).
   */
  baseRating: 800,
  ratingPerPoint: 1600 / 2800,
  /**
   * Points a game: 2 × `perGame` × (the result − the expected result from the two hidden ratings), so ±`perGame` between
   * equals, more for beating someone stronger and less for beating someone weaker; plus `perRating` × (hidden rating −
   * the ladder's rating) after the game, the adjustment at most ±`maxAdjust` (a draw: half): so a player whose rank is
   * below their play climbs faster, and ranks settle where the hidden rating says. A win never takes points, a loss
   * never gives them. (Without the expected result, a player who keeps beating weaker ones climbed past their rating
   * for good, and two accounts trading wins reached Champion: reports/ranked-1v1.md.) No promotion series and no
   * demotion shields: crossing 100 points is the next division, falling below 0 the one before. Never below Iron 4 0.
   */
  points: { perGame: 20, perRating: 0.05, maxAdjust: 10 },
  /** The first `games` rated games are placements ("Placement 2/5"), then the ladder starts from the hidden rating, at most `maxLadder` (Diamond 4 0). */
  placements: { games: 5, maxLadder: 2400 },
  /**
   * Coins (as Squads pays them), lined up with what a Squads lobby pays per minute played (about 1.8 a minute:
   * docs/decisions/2026-10-16-ranked-1v1.md): `perMinute` of the game's time from its start to its end, by result, at
   * least 1 and at most `maxPerGame`; nothing for a game with fewer than `minMoves` moves each, an aborted game, a bot
   * game, or a player fair play is holding (in review). At most `perDay` paying games a day per account (UTC days; the
   * director's cap, Oct 16): the next games that day pay nothing.
   */
  coins: { perMinute: { win: 2.4, draw: 1.6, loss: 0.8 }, minMoves: 10, maxPerGame: 70, perDay: 20 },
  /** Each ranked game's moves are kept this long (a reported player's games are checked from them), then deleted. */
  gamesKeepDays: 30,
  /**
   * The bot (unranked; on the player's device): Maia at the player's hidden rating (the bosses' human-like engine, its
   * own draw), Stockfish at that strength while Maia loads or above `maiaMax`. It thinks within `thinkMs` (never more
   * than `clockShare` of what its clock has left).
   */
  bot: { maiaMin: 600, maiaMax: 2500, thinkMs: [600, 2600] as readonly [number, number], clockShare: 0.05 },
};

/**
 * Squads' server (phase 2; docs/areas/squads.md, "The server"): the lobby around the rules (`SQUADS`, below), its
 * parties, bot work and rewards. The lobby's life (results kept, idle, abandoned) is LOBBY_LIFE's; the queue's fill
 * time is MATCH_FILL_SECONDS, as for Crowd.
 */
export const SQUADS_LOBBY = {
  /** The drawn bracket on screen before round 1's matches begin (after the votes). */
  bracketIntroSeconds: 8,
  /**
   * Placement rewards (unranked), by placement: 1st, 2nd, 3rd-4th, 5th-8th. Coins go in the wallet; crates are counted
   * there for when crates stop being free (CRATES_FREE). Each person on the squad still playing their seat when its
   * placement is decided (not one who left, nor a seat a bot has taken over); none in a lobby a test control touched.
   */
  rewards: {
    1: { coins: 100, crates: 1 },
    2: { coins: 60, crates: 1 },
    3: { coins: 40, crates: 0 },
    5: { coins: 20, crates: 0 },
  } as Readonly<Record<1 | 2 | 3 | 5, { coins: number; crates: number }>>,
  /**
   * Squad bots' engine work (the bot engine's top moves for a board), done on players' devices first (Eric's computing
   * priorities): `perJob` devices each (computers before phones, devices outside the match before those in it), their
   * answers compared. The lobby waits `graceMs` after the first answer for the second, `answerMs` for any; two that
   * disagree go to the engine server (a restricted search of their moves, at `serverNodes`) or a third device, and
   * the device that was wrong gets a strike (`strikes` and it gets no more work). A bot whose candidates aren't in
   * `fallbackMarginMs` before its deadline (no devices, none answering) plays from the server's own quick look
   * (material two moves deep and mate in one: no engine), `fallbackScale` turning its pawns into expected score. A
   * device holds at most `maxInFlight` unanswered jobs at once (a phone fewer: its battery), so a slow one is never
   * buried; with every device busy, a job goes to fewer devices, or none.
   */
  botWork: {
    /** The bot engine's search a job asks for (nodes), the same on every device. */
    nodes: 250_000,
    perJob: 2,
    maxInFlight: { computer: 4, phone: 2 },
    graceMs: 400,
    answerMs: 4_000,
    serverNodes: 400_000,
    strikes: 2,
    fallbackMarginMs: 1_500,
    fallbackScale: 0.6,
  },
  /**
   * The test controls (Eric): "Next round" in a match, and a test lobby that starts at round 2 or the final (with its
   * own clock). Admins (ADMIN_EMAILS) only, or anyone where the Worker variable SQUADS_TEST is "1" (local and e2e,
   * never production); false removes them everywhere, server too.
   */
  testControls: true,
  /** A test lobby fills with bots this long after it opens (time to join it). Not `start=votes`: that fills at once. */
  testFillSeconds: 5,
  /**
   * A Mercenary test lobby that starts after round 1: the bracket's intro lasts this long (seconds), so there's time
   * to shop with the test wallet (SQUADS.mercenary.testWallet) before the first match.
   */
  testShopSeconds: 30,
  /**
   * "Cheat lines" (Eric, Oct 12; test controls only, never for players): the engine's top `moves` in the position you
   * are choosing in, searched on your own device at `nodes` (the same Stockfish as the power-up hints), drawn as
   * arrows. It never touches scoring, bots or the server.
   */
  cheatLines: { moves: 3, nodes: 300_000 },
  /**
   * Who's watching a board, and jumping to your next one (Eric, Oct 14). Each screen tells the lobby which board it
   * shows full size, only when that changes; the lobby sends everyone the viewers of the boards that changed, at most
   * once every `coalesceMs` (so a lobby of 32 switching boards can't flood anyone). Over the board, up to `shown` pawns,
   * then "+N". "Jump to my next board" (Relay) is `jumpToNext` on a device that hasn't set it, and moves you
   * `jumpAfterMs` after your move (time to see your piece land: your move shows nowhere else until the half ends).
   */
  watching: { coalesceMs: 1000, shown: 4, jumpToNext: true, jumpAfterMs: 600 },
  /** A party (an invite code or link, up to SQUADS.partyMax): closes after this long with nobody in it. */
  partyIdleMinutes: 60,
  /** A party in line asks the matchmaker again this often while it's busy. */
  partyRetryMs: 3_000,
};

/**
 * Quick chat in matches and in the lobby before them (preset phrases and emoji only; see DECISIONS.md, "Quick chat
 * in matches" and "Lobby chat"). The server enforces the limits; the app mirrors them to gray out its buttons.
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
 * Chat moderation (docs/decisions/2026-10-16-chat-moderation.md; docs/areas/chat.md): a moderator's chat bans and how
 * long their decisions are kept. Chat is preset lines only; the free text players see is display names, which the
 * server's filter checks (server/src/text-filter.ts).
 */
export const CHAT_MOD = {
  /** The chat bans a moderator can give, in days (and one with no end). */
  banDays: [1, 7, 30] as readonly number[],
  /** A lobby reads a chatting player's ban again at most this often (and always as they join). */
  recheckMs: 30_000,
  /** A moderator's decision about a player is deleted this many days after it ended (a chat ban with no end stays). */
  keepDecisionsDays: 180,
} as const;

/**
 * Friends and invites (docs/decisions/2026-10-15-friends-and-invites.md; docs/areas/accounts.md): add a friend from their profile
 * (they accept or decline), invite anyone to your lobby or Squads party, block. Signed-in accounts only, where signing
 * in is set up. The server enforces every number here.
 */
export const FRIENDS = {
  /** Friends one account can have. */
  max: 200,
  /** Friend requests one account has waiting for an answer at once. */
  maxPendingSent: 50,
  /** A request nobody answered is dropped after this many days. */
  requestDays: 30,
  /** Friend requests one account can send in a day. */
  requestsPerDay: 30,
  /** Players one account can have blocked. */
  maxBlocked: 500,
  /** Invites one account can send in an hour. */
  invitesPerHour: 60,
  /** Inviting the same player again: not sooner than this. */
  reinviteMs: 30_000,
  /** An invite stays open this long (in the friend's list, and as a toast while it's new), then it's gone. */
  inviteMinutes: 10,
  /** The friends list refreshes this often while it's on screen (and at once when something new arrives for you). */
  refreshMs: 60_000,
  /** A new invite's toast stays this long unless it's tapped (the invite stays in the list until it expires). */
  toastMs: 20_000,
  /** The computer's live panel lists at most this many friends who are online. */
  panelMax: 8,
} as const;

/**
 * The age gate (Eric, Oct 16, 2026: "13 younger is guest only. If they lie then so be it, we did our part.";
 * docs/decisions/2026-10-16-age-gate-and-real-money.md): before any sign-in, a neutral question asks for the birth
 * month and year. Old enough: sign in. Younger: guest play only, under the default name and icon, and this device can't
 * sign in. Self-declared; the birth date is never sent or stored, only the answer (age-gate.ts).
 */
export const AGE_GATE = {
  /** The youngest age that may make an account (sign in), in whole years. */
  minAge: 13,
  /** The question's years go back this far from this year (newest first, none chosen to start with). */
  years: 100,
  /** An "old enough" answer lets this device sign in once, within this many minutes; then it's asked again. */
  answerMinutes: 60,
  /** A "too young" answer stays on this device this long (400 days: the most a browser keeps a cookie). */
  tooYoungDays: 400,
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
    /** Friends' actions (requests, answers, invites, blocks, settings): FRIENDS has the daily and hourly caps. */
    friends: { limit: 30, windowMs: 60_000 },
  },
} as const;

/**
 * Error capture and the feedback sheet (the `ops` delegate; docs/areas/ops.md, "Errors and player reports"): what a
 * device sends, how POST /api/problems guards itself, and how D1 writes stay bounded in an error storm.
 */
export const OPS = {
  client: {
    /** Different errors one page load reports at most (each one once, however often it happens). */
    maxErrorsPerPage: 10,
    /** Errors wait this long to go in one request (or until the page is hidden: then sendBeacon). */
    batchMs: 3_000,
    /** The breadcrumbs kept: the last app events (screens and moments, moves sent). */
    breadcrumbs: 20,
  },
  endpoint: {
    /** A request's body, at most (bigger: 413). */
    maxBytes: 20_000,
    /** Errors in one request, at most (the rest are dropped). */
    maxErrorsPerPost: 5,
    /**
     * Requests per window, counted per Worker instance: per address (generous, as for the API: many players can share
     * one) and per account (its session). A page load sends at most two error requests.
     */
    errors: { perIp: { limit: 120, windowMs: 60_000 }, perUser: { limit: 10, windowMs: 60_000 } },
    reports: { perIp: { limit: 30, windowMs: 3_600_000 }, perUser: { limit: 5, windowMs: 3_600_000 } },
  },
  store: {
    /**
     * Each Worker instance (and Durable Object instance) counts its errors in memory and writes them to D1 at most
     * this often (the first at once), at most `maxRowsPerFlush` rows a time (the most frequent; the rest wait for the
     * next write). Kept under 30 s: a flush waits in the request's waitUntil.
     */
    flushMs: 20_000,
    maxRowsPerFlush: 5,
    /** Different errors held in memory between writes, at most (more are dropped and logged as a number). */
    maxGroups: 100,
    /** The breadcrumbs an error's row keeps with its latest occurrence (a bug report keeps all `client.breadcrumbs`). */
    sampleCrumbs: 10,
    /** Player reports (bugs, feedback, ideas) each instance writes a minute, at most (one row each, written at once). */
    maxReportsPerMinute: 20,
    /**
     * Caps for the whole database, whatever the instances (a flood from many addresses can't grow D1 without bound):
     * new kinds of error an hour (one already stored keeps counting) and player reports a day, each in its insert.
     * Under 0.9 GB in all over keepDays with every cap hit every hour (docs/areas/ops.md, "Small rows").
     */
    maxNewErrorsPerHour: 100,
    maxReportsPerDay: 2_000,
    /** Errors and player reports are deleted after this many days (the 15-minute cron). */
    keepDays: 30,
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
    /** What a report can be about (the sheet's buttons, in order). Only "cheating" counts toward an automatic review. */
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
    /** The crowd's rates need at least this many other people picking (not practicing, no power-up). */
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
    /** (A match counts toward a ban only with this many of its moves deep-checked.) */
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

/**
 * Squads (docs/areas/squads.md; DECISIONS.md, "Squads" and "Squads v2"): 8 squads of 4 play team chess in a bracket.
 * Round 1 is Relay (4 boards a match, one player a move, everyone moving one board along each turn), round 2 Pairs
 * (2 boards, two players pick and a coin chooses, unless both pick the same move: a same-move token), the final a
 * majority vote (one board, the whole squad picks, the most popular pick plays). In every round a squad may block one
 * of the other squad's moves before its own move (a block bank per match). Each squad has one team clock for the
 * whole tournament, a chess time control voted before round 1 (Bullet, Blitz, Rapid): a bank that carries from round to
 * round (topped up when it advances), drained past a few free seconds a move, once for each of its moves being thought
 * about at the same time; each move made in time earns the increment back, and no move goes past the option's cap. At
 * zero it's sudden death: every move within the free seconds, or it's missed, until the increment lifts the squad out
 * again. No flag falls, and every game is played to the end. No engine in the
 * rules but one: a same-move token's refund takes the judge's top moves (from players' devices) as data; legal moves
 * and mate in one come from the chess library; only the silent safety cap and the test-only "Next round" fall back on
 * material. The rules are in `packages/chess/src/squads/`; every number for the mode is here.
 */
export interface SquadsClock {
  id: string;
  /** The time control's name ("Bullet"); on screen with its numbers in chess form: "Bullet 2+1" (`clockLabel`). */
  label: string;
  /** Each squad's team bank at the start of the tournament (seconds). */
  bankSeconds: number;
  /** Added to a squad's bank when it starts a new round (it advanced). */
  topUpSeconds: number;
  /** Free seconds every move before the bank drains; at zero (sudden death), the time to make each move. */
  delaySeconds: number;
  /**
   * Credited to the bank after each move made in time (0: none), as on a chess clock: a move quicker than the free
   * seconds and the increment together earns time back. It can lift a squad out of sudden death.
   */
  incrementSeconds: number;
  /**
   * The per-move cap while the squad's bank lasts: nobody can hold up a half longer than this (Time chips apart). A
   * mover or picker who hasn't chosen by then misses (a random legal move), the bank draining meanwhile.
   */
  capSeconds: number;
}
/** Mercenary's items, in the shop's order (strongest first: DECISIONS.md, "Squads modes: Mercenary"). */
export type MercItem = "stockfish" | "blocks" | "shield" | "chip";
/**
 * Mercenary (Eric, Oct 12; renamed from Pillage the same night): each squad has one shared coin wallet for the
 * tournament, earned by play and carried from round to round. After each round, squads still in may spend it in a
 * team shop that's open during the wait for their next match (it adds no time): items for that next match only. Each
 * item's price rises by `priceStep` for every one of it the squad has bought before in the tournament; at most
 * `cap` of an item for one round. Every number here; the rules are `packages/chess/src/squads/mercenary.ts`.
 */
export interface MercenarySettings {
  /**
   * The base: every match a squad plays pays this at its end, win or lose (a drawn final's Armageddon doesn't pay it
   * again). Most of a squad's coins, like a Counter-Strike round's payout; play adds the rest.
   */
  played: number;
  /** Coins for a capture, by the piece taken (en passant: a pawn). */
  capture: { p: number; n: number; b: number; r: number; q: number };
  /** A board won (any way: mate, or material at the safety cap), and extra for a checkmate; a drawn board, each side. */
  boardWin: number;
  mate: number;
  boardDraw: number;
  /**
   * A board's coins (captures, win, mate, draw) are multiplied by this in each round (Relay, Pairs, the final): fewer
   * boards, more each, so every round pays about the same.
   */
  roundScale: readonly [number, number, number];
  /** Winning a match (going through to the next round). */
  matchWin: number;
  /**
   * A brilliant move: a quiet move (no capture, not out of check) that the judge (the bot engine's top moves, from
   * players' devices, as for same-move tokens) rates the best by at least `gap` of expected score over every other
   * move, from ply `fromPly` on, in a position still in the balance (the best's expected score within `decided` of
   * neither end). Never one played with a Stockfish token. It pays `coins`, at most `capPerMatch` times per squad per
   * match (Eric, Oct 13: "How could one move be more than winning an entire game?"); past that it's still announced.
   */
  brilliant: { coins: number; capPerMatch: number; gap: number; fromPly: number; decided: number };
  /**
   * Catch-up: when a match of round 2 or the final is set, the squad that has earned fewer coins in the tournament
   * (by play) gets `share` of the difference, to the nearest `round`, at most `max`.
   */
  catchUp: { share: number; max: number; round: number };
  /** Every item's price rises by this for each one of it the squad has already bought this tournament (unless it has `prices`). */
  priceStep: number;
  /**
   * Each item's first price and the most a squad may buy for one round. `prices`: the item's own price list instead,
   * by how many of it the squad has bought this tournament (the last repeats). For the Time chip `cap` is the most a
   * squad may hold.
   */
  items: Readonly<Record<MercItem, { price: number; cap: number; prices?: readonly number[] }>>;
  /**
   * A Time chip (Eric, Oct 13: "like a poker chip"): seconds added to one move, the one being thought about on the
   * tapper's board, when a player on it taps it during their squad's move. The move's deadline moves that much later
   * and those seconds don't drain the bank (unused, they're lost); several can go on one move. Chips are the squad's,
   * kept from round to round.
   */
  chipSeconds: number;
  /** Block points: added to the squad's block bank for its next match. */
  blockPoints: number;
  /** A Stockfish token: your own top `lines` moves for one decision, searched on your device at `nodes`. */
  stockfish: { lines: number; nodes: number };
  /** A test lobby that starts after round 1 (the rounds before skipped): each squad's wallet to shop with. */
  testWallet: number;
  /**
   * Bots: a squad of bots (nobody playing) shops `shopSeconds` (a range) into its window. Before the final it saves
   * everything with `saveChance`; otherwise it spends a share of its wallet in `spend` (the final: all of it), item by
   * item, each drawn by `weights` among those it can afford and hasn't capped. A bot with a Stockfish token uses it with
   * `stockfishChance` a move, or `stockfishSharp` when the engine's best beats the next by `sharpGap` or more.
   */
  bots: {
    shopSeconds: readonly [number, number];
    saveChance: number;
    spend: readonly [number, number];
    weights: Readonly<Record<MercItem, number>>;
    stockfishChance: number;
    stockfishSharp: number;
    sharpGap: number;
    /**
     * A bot squad's Time chips: on a move in sudden death it taps one with `suddenDeath`, with its bank under
     * `lowBankSeconds` with `lowBank` (one a move), `tapMs` (a range) into the move.
     */
    chip: { suddenDeath: number; lowBank: number; lowBankSeconds: number; tapMs: readonly [number, number] };
  };
}
export interface SquadsSettings {
  /** Players in a squad, squads in a lobby (a bracket of three rounds). */
  squadSize: number;
  squadCount: number;
  /** The largest party (invite link or code) that queues together. */
  partyMax: number;
  /** Boards in a match: round 1 (Relay), round 2 (Pairs), the final (the majority vote). Armageddon is always one. */
  boards: { relay: number; pairs: number; final: number };
  /** The pre-game votes (Start, Clock): seconds each is open, the result's showing, bots that don't vote. */
  voteSeconds: number;
  voteResultSeconds: number;
  voteBotSkip: number;
  /**
   * The Clock vote's options (Eric, Oct 13: Bullet, Blitz and Rapid, chess time controls like the 50 v 50's; tuned by
   * the sim), each a team clock: the starting bank, the top-up a round, the free seconds a move, the increment and the
   * cap on one move. In the vote's order, left to right: Bullet first, the longest last (Eric, Oct 16). And the one if
   * nobody votes, by its id.
   */
  clocks: readonly SquadsClock[];
  clockDefault: string;
  /**
   * A team clock stored before the time controls (Oct 13, 2026: Fast, Normal, Long, or a test lobby's four numbers) had
   * one per-move ceiling for every option, this long: a lobby in play across that deploy keeps its numbers and this cap.
   */
  legacyCapSeconds: number;
  /** A missed move earns no increment. */
  incrementOnMiss: boolean;
  /** The silent safety cap on every board, in moves per side: then material decides (as does "Next round"). */
  safetyCap: number;
  /** Material for the safety cap and "Next round" (no engine): pawn, knight, bishop, rook, queen. */
  material: { p: number; n: number; b: number; r: number; q: number };
  /** The smallest material lead that wins at the safety cap; less is a draw. */
  materialLead: number;
  /** Points for a board: a win, a draw. A squad with more than half a match's points has clinched it. */
  winPoints: number;
  drawPoints: number;
  /** Openings (Start: "same opening", "random openings"): moves per side, and the balance window (as for Classic). */
  openingMoves: number;
  openingBalance: readonly [number, number];
  /**
   * Pairs' same-move tokens (Eric, Oct 12): partners may both pick the same move while their squad has a token; it
   * plays (no coin) and burns one automatically. At none, picks must differ. After the move the judge's top moves (the
   * bot engine's, from players' devices, as for bots) decide a refund: the move was the only real one if it was the
   * best and every other legal move was worse by at least `refundGap` of expected score. No judge, no refund.
   */
  tokens: {
    /** Each squad's tokens per Pairs match. */
    perMatch: number;
    /**
     * The only-move gap, in expected score (0 to 1; the judge's scale, 1 point = 0.01). About two pawns' worth: from a
     * level position two pawns down is 0.5 to 0.13 (0.95 log-odds a pawn: BOSS_POWERS.bouncePawnLogit), a gap of 0.37.
     */
    refundGap: number;
    /** One pawn's worth of expected score near a level position: the breakdown's words ("lost at least 2.1 pawns"). */
    pawnWorth: number;
  };
  /**
   * Move blocks, every round (Eric, Oct 12: "You tap their piece and play the move you wanna block"). On its squad's
   * turn on a board, before its move there is settled, any of its players on that board may block moves of the other
   * squad: that piece to that square can't be played on their next turn there (the piece's other moves stay legal).
   * Paid at once from the squad's block bank for the match, by the piece making the move; the king's ordinary moves
   * never, castling at `castlingCost`. A block that doesn't take effect is lifted and refunded: the squad's own move
   * made it impossible, the game ended, or a mercy rule.
   */
  blocks: {
    /**
     * Each squad's block bank coming into a match (Armageddon carries on with what the final left). A mode can set it
     * to 0 (no blocks) or pass a match its own (`MatchSetup.blockBanks`).
     */
    bankPerMatch: number;
    /** A block's cost by the piece making the move (the king's ordinary moves can never be blocked). */
    cost: { p: number; n: number; b: number; r: number; q: number };
    /** Castling as a block (Eric: "let's allow castling to be blocked for 2 tokens"); null: castling can't be blocked. */
    castlingCost: number | null;
    /**
     * Blocks a squad may place on one board in one turn; null: as many as its bank allows (Eric, Oct 12: "one big
     * blocking play, high risk high reward, changeable later").
     */
    maxPerTurn: number | null;
    /**
     * Mercy, on a turn's blocks together: if they'd leave no move, or only moves allowing mate in one, the most recent
     * are lifted (refunded) until that's no longer so.
     */
    liftBeforeMate: boolean;
    /** Mercy (the brief's "a piece that can answer the check can't be blocked"): in check, every move answers it: lifted. */
    liftInCheck: boolean;
  };
  /** The final: everyone picks, the most picked move plays; a tie for the most, a seeded coin between the tied moves. */
  final: {
    tie: "coin";
  };
  /**
   * A drawn final goes to one Armageddon board in the final's format, on its own fixed clocks (a bank for each side,
   * team-clock rules, the lobby's free seconds): Black has draw odds, White more time. The squad with more team bank
   * left after the final picks its color.
   */
  armageddon: { whiteSeconds: number; blackSeconds: number; incrementSeconds: number };
  /** Missed actions in a row before a player's seat goes to a bot (every miss is logged on their record). */
  noShowsBeforeBot: number;
  /** A bot taking over a no-show's seat plays at this skill (a temperature; see botSkillRange). */
  replacementBotSkill: number;
  bots: {
    /** The bot engine's top moves a squad bot chooses among. */
    candidates: number;
    /**
     * Pairs: a bot picks its partner's move (a same-move token, while the squad has one) only when that move is its own
     * top move and beats the next by at least this much expected score (only-move-like); otherwise picks differ.
     */
    sameMoveGap: number;
    /**
     * Blocks, sparingly: a bot blocks the other squad's likely best reply to its own move (the engine line's second
     * move) with `blockChance` a move, or `sharpChance` when that reply captures or checks (shared among the players
     * choosing that move: a pair's two, the final's four); never spending below `blockReserve` unless it's sharp;
     * never the king, never one a mercy rule would lift.
     */
    blockChance: number;
    sharpChance: number;
    blockReserve: number;
    /** The final: a bot copies a human teammate's pick (one already made) with this chance, so it feels like a teammate. */
    copyHumanChance: number;
    /** The color a bot squad takes when it picks Armageddon's colors. */
    armageddonColour: "w" | "b";
    /**
     * Winning, a bot plays with purpose: once the best move's expected score is at least `wonAt`, its temperature is
     * at most `wonSkill`, and moves the engine ranks lower lose `wonRankLoss` points a place (they all score about 1,
     * so without this a bot wanders). A mate it sees: a longer one loses `mateStepLoss` a move, none `mateMissLoss`.
     */
    wonAt: number;
    wonSkill: number;
    wonRankLoss: number;
    mateStepLoss: number;
    mateMissLoss: number;
    /**
     * A bot's thinking time: its squad's bank over `movesToGo`, plus `incrementShare` of the increment and the free
     * seconds, times a random factor in `thinkRange`, at least `minThinkSeconds` (but within the free seconds in
     * sudden death), and always in time: at most `inTime` of its deadline (the cap, or the free seconds in sudden
     * death) and of when its squad's bank would run out (Oct 13: with an increment a squad lives near zero).
     */
    movesToGo: number;
    incrementShare: number;
    thinkRange: readonly [number, number];
    minThinkSeconds: number;
    inTime: number;
  };
  /**
   * The mode vote (Eric, Oct 12), the first pre-game vote: Classic (just chess: same-move tokens, no blocks, no coins)
   * or Mercenary (coins, a team shop between rounds, items; blocks as in Squads v2), and a third mode shown as "Coming
   * soon" that can't be voted for. Nobody voting: Classic. Each lobby draws how strongly its bots lean to Classic, a
   * share in `classicLean` (each bot then votes Classic with that chance): most lobbies' bots lean Classic, some
   * Mercenary, and a few people can swing a close one.
   */
  modeVote: { classicLean: readonly [number, number] };
  /** Mercenary's economy: earning coins, the team shop, the items. */
  mercenary: MercenarySettings;
  /**
   * Showing what happened, in seconds: a half's moves landing (Relay), the pair's reveal and coin (Pairs), the
   * final's reveal (every pick as a ghost with its pickers' names, the count, a coin for a tie), the bracket between
   * matches, Armageddon's intro.
   */
  moveShowSeconds: number;
  pairRevealSeconds: number;
  finalRevealSeconds: number;
  roundBreakSeconds: number;
  armageddonIntroSeconds: number;
}

export const SQUADS: SquadsSettings = {
  squadSize: 4,
  squadCount: 8,
  partyMax: 4,
  boards: { relay: 4, pairs: 2, final: 1 },
  voteSeconds: 8,
  // (4.2 s: the winner's banner a second longer, as every banner since Eric, Oct 15; was 3.2.)
  voteResultSeconds: 4.2,
  voteBotSkip: 0.1,
  // Eric, Oct 10: one team clock per squad for the whole tournament; Oct 13: three chess time controls, Bullet, Blitz
  // and Rapid, each with an increment that banks and its own cap on a move. Tuned by reports/squads-sim.md
  // (DECISIONS.md, "Squads: three chess time controls"). Eric, Oct 14: Rapid was too long ("It shouldn't be 55
  // minutes"): 5+2, was 5+3 (DECISIONS.md, "Squads: Rapid 5+2").
  clocks: [
    // Left to right, Bullet first and the longest last (Eric, Oct 16: "the left should always be bullet, and then the
    // far right on it should always be the longest time control"; it reverses his Oct 13 "always slowest on the left").
    { id: "bullet", label: "Bullet", bankSeconds: 60, topUpSeconds: 15, delaySeconds: 2, incrementSeconds: 1, capSeconds: 10 },
    { id: "blitz", label: "Blitz", bankSeconds: 180, topUpSeconds: 30, delaySeconds: 2, incrementSeconds: 2, capSeconds: 15 },
    { id: "rapid", label: "Rapid", bankSeconds: 300, topUpSeconds: 60, delaySeconds: 2, incrementSeconds: 2, capSeconds: 20 },
  ],
  // Nobody votes: Blitz (as Normal was), by its id, so reordering the options never changes it.
  clockDefault: "blitz",
  // The one ceiling every option had before the time controls (20 s, not the brief's starting 40).
  legacyCapSeconds: 20,
  incrementOnMiss: false,
  safetyCap: 120,
  material: { p: 1, n: 3, b: 3, r: 5, q: 9 },
  materialLead: 1,
  winPoints: 1,
  drawPoints: 0.5,
  openingMoves: 4,
  openingBalance: [0.4, 0.6],
  // Eric, Oct 12 (Squads v2): 5 tokens a Pairs match; a refund at about two pawns' worth (DECISIONS.md, "Squads v2").
  tokens: { perMatch: 5, refundGap: 0.37, pawnWorth: 0.185 },
  // Eric, Oct 12: pawn 1, knight, bishop or rook 2, queen 3, castling 2, the king never. Oct 19: no points to start (it
  // was 5 a match); Mercenary's come from the shop between rounds, so round 1, before any shop, has no blocks.
  blocks: {
    bankPerMatch: 0,
    cost: { p: 1, n: 2, b: 2, r: 2, q: 3 },
    castlingCost: 2,
    maxPerTurn: null,
    liftBeforeMate: true,
    liftInCheck: true,
  },
  final: { tie: "coin" },
  armageddon: { whiteSeconds: 90, blackSeconds: 60, incrementSeconds: 1 },
  noShowsBeforeBot: 3,
  replacementBotSkill: 4,
  bots: {
    candidates: 8,
    sameMoveGap: 0.3,
    blockChance: 0.04,
    sharpChance: 0.15,
    blockReserve: 2,
    copyHumanChance: 0.35,
    armageddonColour: "b",
    wonAt: 0.9,
    wonSkill: 2,
    wonRankLoss: 3,
    mateStepLoss: 5,
    mateMissLoss: 20,
    movesToGo: 40,
    incrementShare: 0.8,
    thinkRange: [0.5, 1.5],
    minThinkSeconds: 1.5,
    inTime: 0.9,
  },
  modeVote: { classicLean: [0.35, 0.75] },
  // Calibrated by reports/squads-mercenary.md (DECISIONS.md, "Mercenary: Eric's first changes"): a squad that wins a
  // round earns about 600-700 (most of it the base), two squads meeting are within a few percent of each other's
  // coins earned, and a lobby takes a little longer than Classic (the time coins bought: more time to think).
  mercenary: {
    // Eric, Oct 13: a steady base (every match played) with play on top, like CS or Valorant; each round should buy
    // a Stockfish token, a time reload and a block or shield, and a very good one a second token.
    played: 200,
    capture: { p: 1, n: 3, b: 3, r: 5, q: 9 },
    boardWin: 40,
    mate: 25,
    boardDraw: 15,
    roundScale: [1, 2, 4],
    matchWin: 150,
    // A brilliant move: 25, never more than a board won (Eric, Oct 13); twice per squad per match at most.
    brilliant: { coins: 25, capPerMatch: 2, gap: 0.5, fromPly: 16, decided: 0.1 },
    catchUp: { share: 0.5, max: 150, round: 10 },
    priceStep: 100,
    items: {
      stockfish: { price: 200, cap: 2 },
      // Eric, Oct 19: blocks only from the shop, and dear: two (275 + 325) take a whole wallet before Pairs (about
      // 560-650), and a third is out of reach; then 425, 525 (docs/decisions/2026-10-19-squads-blocks-from-the-shop.md).
      blocks: { price: 275, cap: 2, prices: [275, 325, 425, 525] },
      shield: { price: 100, cap: 2 },
      // Eric, Oct 13: chips 25, 25, 50, 50, then 50 each ("everyone should be able to basically reload on time
      // chips"); hold at most 3.
      chip: { price: 25, cap: 3, prices: [25, 25, 50, 50] },
    },
    chipSeconds: 30,
    blockPoints: 3,
    stockfish: { lines: 3, nodes: 300_000 },
    testWallet: 600,
    bots: {
      shopSeconds: [3, 9],
      saveChance: 0.25,
      spend: [0.5, 0.9],
      weights: { stockfish: 0.5, blocks: 3, shield: 2, chip: 3 },
      stockfishChance: 0.04,
      stockfishSharp: 0.35,
      sharpGap: 0.2,
      chip: { suddenDeath: 0.6, lowBank: 0.3, lowBankSeconds: 20, tapMs: [700, 1800] },
    },
  },
  moveShowSeconds: 1,
  pairRevealSeconds: 3,
  finalRevealSeconds: 4.5,
  roundBreakSeconds: 20,
  armageddonIntroSeconds: 6,
};

/**
 * The board (Oct 12, 2026; docs/areas/board.md). `checkHighlight`: the red glow under a king in check. Off, as the game
 * has always been (its board was set up never to show it).
 */
export const BOARD: { readonly checkHighlight: boolean } = { checkHighlight: false };

/** What the shop offers, in percent, by kind (pawn, knight, bishop, rook, queen): a row adds up to 100. */
export interface ShopOdds {
  readonly p: number;
  readonly n: number;
  readonly b: number;
  readonly r: number;
  readonly q: number;
}

/**
 * Auto chess, the demo (Oct 19, 2026; docs/decisions/2026-10-19-autochess-demo.md): you and a bot buy pieces with gold
 * (the shop offers each a piece and a square of your half; the king is placed by the game), scout, move one piece once, and the
 * engine plays the position out for both sides. Every number is here so it can be tuned after Eric plays it ("we're just
 * testing this thing"). Nothing carries over between rounds but gold, HP, the win streak, each side's bench and its level and
 * XP (design v4 and v6): each round starts with only the two kings on the boards.
 */
export interface AutoChessSettings {
  /** What each piece costs in the shop (a pawn 10 ... a queen 90: the chess value times ten, a bishop a little over a knight). */
  readonly prices: { readonly p: number; readonly n: number; readonly b: number; readonly r: number; readonly q: number };
  /**
   * The shop (v5, Eric Oct 20; v6 Oct 20 evening; v7 Oct 21): this many offers (4 since v7, was 5), each a piece and a square on
   * your half where it will land; buying an offer rolls a new one into its slot; one reroll of all the offers costs `reroll.first`
   * gold the first time in a round and `reroll.step` more each time after it, up to `reroll.max` (v7.1, Eric Oct 22: "5+1 per roll up
   * to 10 max per round": 5, 6, 7, 8, 9, 10, 10, ...), back to the first price at each round's start. The shop refills free at each round's start. **The odds follow the level of whoever's shop it is** (v7, Eric Oct 21: "when
   * you level you have slightly higher chances for better pieces and pawn odds slightly decrease... [queens] shouldn't even appear
   * till level 7 like in TFT"): `oddsByLevel[level - 1]` is the percent of each kind for a shop rolled at that level, level 1 first
   * (play starts at `levels.start`, 4, and tops at `levels.max`, 10); each row adds up to 100. No rooks before level 5, no queens
   * before 7 (Eric: "Rooks should start at level 5"). The bot rolls by its own level. **Star-ups** (v8): an offer's square is drawn first and its candidates are
   * the pieces of yours that can star up on it (board or bench) and, on an empty board square, a new piece by these odds: the odds are the odds of a *new* piece
   * (see `starUpCost`, `autochess/shop.ts` `rollOffer`).
   */
  readonly shop: {
    readonly slots: number;
    readonly oddsByLevel: readonly ShopOdds[];
    readonly reroll: { readonly first: number; readonly step: number; readonly max: number };
  };
  /** Selling a piece, from the board or the bench, gives back this share of what was paid for it (its price, and `starUpCost` for each star above the first, v8), rounded down (v6, Eric Oct 20: 75%: P7 N22 B24 R37 Q67). */
  readonly sellBack: number;
  /**
   * The bench (v6, Eric Oct 20: "the bench is going to be a massive strategy"): this many held pieces, each keeping the square it
   * was offered on. Held pieces stay from round to round (the board's pieces still don't), and so do their stars (v8).
   */
  readonly benchSlots: number;
  /**
   * Lock in (v5, Eric Oct 20): a button that ends your buying (freezing your board, bench and shop); the first side to lock in gets
   * `lockInBonus` gold at once. **Off since v7** (Eric, Oct 21: "the whole function/feature" goes "for now... just remove the button
   * keep the logic there, might wanna readd it later"): with `lockIn` false there is no button, no bonus for anyone (the bot's
   * included: it never locks) and every buy step runs its full time (the last `lockSeconds` still lock). The code stays behind this
   * switch (`?lockin=1` turns it on for testers).
   */
  readonly lockIn: boolean;
  readonly lockInBonus: number;
  /** The buy-and-place step, its locked end (no buying, selling or moving), and how far behind the opponent's circles show. */
  readonly buySeconds: number;
  readonly lockSeconds: number;
  readonly circlesDelaySeconds: number;
  /** While you buy, one of their pieces (a circle, a pawn too) is revealed at random every this many seconds, and stays shown (v6, Eric Oct 20: 5 s, so 5 in the 30). */
  readonly revealSeconds: number;
  /**
   * The adjust step, shown to players as the **move step** (v6, Eric Oct 20; v2 Oct 21): `adjustSeconds` long, with their full board
   * shown, in which you make `adjustMoves` change, hidden from them until the fight. `adjustStep` false turns the step off (straight to
   * the fight): "we could test it out" both ways (`?adjust=0` in the address, for testers). **`adjustMode`** picks the change:
   * `"legal"` (v7, Eric Oct 21: "it's too strong, instead it highlights one piece at random of yours and you get 7 seconds to do a
   * LEGAL move on your half of the board"): one of your pieces (never the king, one with at least one legal chess move that stays on
   * your half; picked at random, seeded by the round) is lit, and you play one legal chess move with it that stays on your half, or
   * skip; with no such piece you have no move that round. The bot gets the same: its own random piece and the engine's best such move.
   * `"teleport"` (the v6 step, kept in code, off): move any one piece of yours to any empty square of your half.
   * **`"stars"`** (v8, Eric Oct 22; the default): no piece is picked for you; only your **starred** pieces on the board move (see `starUpCost`),
   * each at most once, in any order: a 2-star one legal chess move that stays on your half, a 3-star to any empty square of your half. The step
   * lasts `moveBase` seconds plus `movePerStar` for each starred piece of the side with more of them on the board (`adjustSeconds` and
   * `adjustMoves` are the other two modes'), always runs, and is `moveBase` seconds just to look at the board when nobody has a star.
   */
  readonly adjustStep: boolean;
  readonly adjustMode: "legal" | "teleport" | "stars";
  readonly adjustSeconds: number;
  readonly adjustMoves: number;
  /**
   * Stars (v8, Eric Oct 22: "pieces can now be 2 starred which lets you move the piece once legally during the action phase... 3 star pieces can
   * move anywhere... Pawns can't be starred up"). Every piece but a pawn or the king has 1 (plain), 2 or 3 (`maxStars`) stars. A star changes
   * nothing in the fight (a 3-star rook is a rook); it only lets the piece move in the move step. **A star-up costs a flat `starUpCost` gold**
   * (Eric: "5 cost to upgrade every time... having it be 5 is already generous"), whatever the piece and its stars, and merges into the piece
   * where it is (board or bench). Selling a piece, and the survivors' refund, count everything paid for it: its price plus `starUpCost` for
   * each star above the first. The move step's length is above (`moveBase`, `movePerStar`; Eric: "a flat 5 seconds no matter what... if you
   * have two and your opponent has two starred up pieces, that's still just... an extra 6 seconds total").
   */
  readonly starUpCost: number;
  readonly maxStars: number;
  readonly moveBase: number;
  readonly movePerStar: number;
  /**
   * The star look (v8, Eric Oct 22: "a gold border for the 2-star units on the board... when the chess actually starts to play, can we get rid of the glowing effects of the
   * pieces? It's fine to keep the little stars"). A starred piece has its tiny stars inside it always, and a colored outline round it (gold for 2 stars, prismatic for 3) while you
   * buy, place and move. In the fight and the result the outlines are off, unless this is on (the test switch `?fightglow=1`): a setting so Eric can compare the two.
   */
  readonly fightGlow: boolean;
  /**
   * Levels (v6, Eric Oct 20: "the board's piece limit is your level"): your level is how many pieces (not the king) you may have
   * on the board. You start at `start`, the top is `max`; each round's start gives `freeXp` XP; `buyXp` XP cost `buyXpCost` gold;
   * the XP to the next level is `xpToNext[level - start]` (4 to 5: 4, 5 to 6: 8, ... 9 to 10: 24).
   */
  readonly levels: {
    readonly start: number;
    readonly max: number;
    readonly freeXp: number;
    readonly buyXp: number;
    readonly buyXpCost: number;
    readonly xpToNext: readonly number[];
  };
  /** The kings stand on a random square of each side's back this-many ranks. */
  readonly kingRanks: number;
  /**
   * The two custom pawns on the screen each hop once, then wait a random time between these two numbers (seconds) before their next single
   * hop (counted from the start of one hop to the start of the next), each pawn on its own draw so the two never fall into step (v7.1, Eric
   * Oct 22: "The bouncing is too much, should be randomly once every 7-10 seconds"). One hop (a crouch, a rise, a squash and a settle) lasts
   * `hopSeconds`. Off under reduced motion.
   */
  readonly hopEvery: readonly [number, number];
  readonly hopSeconds: number;
  /**
   * The meeting before round 1 (Eric, Oct 24: "both pawns, you and your opponent's custom pawn, kind of meet... a 10-second countdown"): both custom
   * pawns stand in the middle of the board with the quick chat, the countdown is `introSeconds` (0: no meeting), then they puff away to their
   * corners and the game starts. `introReplyMs`: the bot answers your first line this many ms after it (a random time between the two), once;
   * `introOpenMs`: with no line from you by then, the bot says its opening line (chat.ts). `introBubbleMs`: how long a speech bubble stays.
   */
  readonly introSeconds: number;
  readonly introReplyMs: readonly [number, number];
  readonly introOpenMs: number;
  readonly introBubbleMs: number;
  /**
   * The fight: one move about this often, each searched by the HunChess engine to this many nodes (the same for both sides,
   * deterministic; docs/decisions/2026-10-21-hunchess-engine.md). 600 ms since Oct 21 (was 350; Eric: "for fights, they should
   * take a little bit longer"; the fast pace 175 to 300 ms with it): the node budget was sized for 350 ms on a 4x-slowed phone, so
   * the engine now has room to spare. docs/decisions/2026-10-21-autochess-endings.md.
   */
  readonly fightMoveMs: number;
  readonly fightNodes: number;
  /**
   * The fight has no promotion: a pawn that moves onto its last rank **cashes in** (HunChess engine, Eric Oct 20): it leaves the
   * board and its owner gets `cashInGold` gold at the round's end. The engine counts a cash-in as the pawn given up plus
   * `cashInValue` centipawns (a small nudge for the gold), so it cashes in when the pawn is lost anyway, not as a goal.
   */
  readonly cashInGold: number;
  readonly cashInValue: number;
  /**
   * Moves play at `fightFastMoveMs` (twice as fast) after this many moves a side (v5, Eric Oct 20), and also once either side is
   * down to its king and pawns (Eric, Oct 21: "the last thing we want to see is just the king moving around"), or once this many
   * pieces or fewer are left on the whole board besides the kings, pawns included (`fightFastPieces`; Eric, Oct 21: a pawn and a
   * rook against two knights "should have gone about twice as fast").
   */
  readonly fightFastAfter: number;
  readonly fightFastMoveMs: number;
  readonly fightFastPieces: number;
  /**
   * A fight stalls after this many moves a side, or this many moves a side with no capture or cash-in (a check doesn't count:
   * Eric, Oct 21), or at a threefold repetition. A stall goes to the side that **gained** at least `stallWinMargin` centipawns
   * (50 = half a pawn; 100 until the gains sim on PR #310: it cut draws from 18.8% to 15%) during the fight: the stall judge's score of the final position less its score of the start (Eric, Oct 21: "I
   * shouldn't get rewarded just because I play more pieces"); closer is a draw. docs/decisions/2026-10-21-autochess-endings.md,
   * docs/decisions/2026-10-21-autochess-gain.md.
   */
  readonly moveCap: number;
  readonly quietCap: number;
  readonly stallWinMargin: number;
  /**
   * The clean-up ends early (Eric, Oct 21): a side that has **gained** `decisiveMargin` centipawns or more since the start, after
   * each of `decisiveMoves` of its own moves in a row, wins at once, unless the engine has found it a forced mate (or a forced win
   * by another rule: a bare king, a won stall) within `mateShowMoves` moves, which plays out. The gain is the stall's measure (the
   * judge's score after the move less the start's: the same on any device); a side that only keeps its starting edge never ends a
   * fight this way. 6 moves since PR #305's sim (Eric's brief said 3); 300 (3 pawns) since PR #310's sim (was 500: with gains,
   * a side rarely gains 5, and the hunt for the last pieces brought back long king walks). reports/autochess-endings.md, reports/autochess-gain.md.
   */
  readonly decisiveMargin: number;
  readonly decisiveMoves: number;
  readonly mateShowMoves: number;
  /**
   * Hit points each; the first to 0 loses. A lost round costs the round's number times `damagePerRound` (round 1: 1) plus 1 for every
   * `piecesPerDamage` enemy pieces (not the king) left, rounded down (v7.1, Eric Oct 22: "like TFT where each round is like say dmg+1...
   * each game is about 7-10 rounds ish"): round 1 costs 1 to 3, and games last about 8 rounds. A draw costs nothing.
   */
  readonly hp: number;
  readonly damagePerRound: number;
  readonly piecesPerDamage: number;
  /** Gold at the start of round 1, before its income. */
  readonly startGold: number;
  /** A round's income: `first` in round 1, `step` more each round, up to `max`. */
  readonly income: { readonly first: number; readonly step: number; readonly max: number };
  /** Interest on gold banked before the income: `gold` for every full `per` banked, up to `max`. */
  readonly interest: { readonly per: number; readonly gold: number; readonly max: number };
  /** After a fight each side gets this share (rounded down) of everything paid for its pieces still on the board (their prices and their star-ups, v8), win or lose; bench pieces get all of theirs back. */
  readonly survivorRefund: number;
  /**
   * Gold for a streak, at the start of the next round: from `n` rounds in a row, `gold` (the highest row that fits). A draw
   * ends both streaks. The loss streak's gold is 0 (off): a setting to try if rounds snowball.
   */
  readonly winStreakGold: readonly { readonly n: number; readonly gold: number }[];
  readonly lossStreakGold: readonly { readonly n: number; readonly gold: number }[];
  /** The legal-position limits (the engine refuses others): queens owned, pawns owned, pawns in one file. */
  readonly queenLimit: number;
  readonly maxPawns: number;
  readonly pawnsPerFile: number;
  /** The bot: the chance it keeps a hundred banked for interest (when it has the gold to), how many moves it tries while adjusting, and the search it uses. */
  readonly bot: {
    /** It locks in at a seeded time between these shares of the step's open part (before its locked end), or never, this often. */
    readonly lockFrom: number;
    readonly lockTo: number;
    readonly neverLockChance: number;
    /**
     * Its shop rerolls (the same climbing price as yours, `shop.reroll`): at most this many a round, only with this much gold, this often
     * (more often when the shop shows nothing but pawns). v7.1: 4 / 40 / 0.15 / 0.4 became 3 / 70 / 0.06 / 0.2, so the bot rerolls in about a third
     * of rounds (63% before, at 2 gold a roll) and spends about what it did on rerolls (2 gold a round).
     */
    readonly maxRerolls: number;
    readonly rerollGold: number;
    readonly rerollChance: number;
    readonly rerollChanceBare: number;
    /** With its board full it holds a good piece (not a pawn) on its bench: at most this many a round, each time with this chance (else it keeps the gold). */
    readonly maxHolds: number;
    readonly holdChance: number;
    /** Its pieces go down evenly over the step's open part, the last by this share of it (so something is on its board early, to scout). */
    readonly placeBy: number;
    /** It buys XP (20 gold for 4) now and then: at most this many a round, with this chance each time it has the gold (more with its board full: a level is room). */
    readonly maxXpBuys: number;
    readonly xpGold: number;
    /** With this much gold it buys XP even when that gives no level yet (it saves up for the next). */
    readonly xpRichGold: number;
    readonly xpChance: number;
    readonly xpChanceFull: number;
    readonly saveChance: number;
    /** Whenever one of its offers is a star-up it can pay for, it buys it this often (Eric: "buys star-ups as a player would", nearly always). */
    readonly starUpChance: number;
    readonly adjustTries: number;
    readonly adjustDestinations: number;
    readonly adjustNodes: number;
    readonly adjustMargin: number;
  };
}

export const AUTOCHESS: AutoChessSettings = {
  prices: { p: 10, n: 30, b: 32, r: 50, q: 90 },
  shop: {
    slots: 4,
    // Percent P/N/B/R/Q by level, level 1 first (v7, Eric Oct 21).
    oddsByLevel: [
      { p: 82, n: 10, b: 8, r: 0, q: 0 },
      { p: 80, n: 11, b: 9, r: 0, q: 0 },
      { p: 77, n: 12, b: 11, r: 0, q: 0 },
      { p: 74, n: 14, b: 12, r: 0, q: 0 },
      { p: 66, n: 14, b: 13, r: 7, q: 0 },
      { p: 60, n: 16, b: 15, r: 9, q: 0 },
      { p: 54, n: 18, b: 16, r: 11, q: 1 },
      { p: 48, n: 19, b: 18, r: 12, q: 3 },
      { p: 42, n: 20, b: 19, r: 14, q: 5 },
      { p: 36, n: 21, b: 20, r: 16, q: 7 },
    ],
    reroll: { first: 5, step: 1, max: 10 },
  },
  sellBack: 0.75,
  benchSlots: 4,
  lockIn: false,
  lockInBonus: 25,
  buySeconds: 30,
  lockSeconds: 3,
  circlesDelaySeconds: 2,
  revealSeconds: 5,
  adjustStep: true,
  adjustMode: "stars",
  adjustSeconds: 7,
  adjustMoves: 1,
  starUpCost: 5,
  maxStars: 3,
  moveBase: 5,
  movePerStar: 3,
  fightGlow: false,
  levels: { start: 4, max: 10, freeXp: 2, buyXp: 4, buyXpCost: 20, xpToNext: [4, 8, 12, 16, 20, 24] },
  kingRanks: 2,
  hopEvery: [7, 10],
  hopSeconds: 1.8,
  introSeconds: 10,
  introReplyMs: [1000, 2000],
  introOpenMs: 3000,
  introBubbleMs: 2500,
  fightMoveMs: 600,
  fightNodes: 30000,
  cashInGold: 5,
  cashInValue: 20,
  fightFastAfter: 30,
  fightFastMoveMs: 300,
  fightFastPieces: 5,
  moveCap: 60,
  quietCap: 10,
  stallWinMargin: 50,
  decisiveMargin: 300,
  decisiveMoves: 6,
  mateShowMoves: 5,
  hp: 24,
  damagePerRound: 1,
  piecesPerDamage: 3,
  startGold: 0,
  income: { first: 100, step: 20, max: 200 },
  interest: { per: 100, gold: 10, max: 30 },
  survivorRefund: 0.25,
  winStreakGold: [
    { n: 2, gold: 10 },
    { n: 4, gold: 20 },
    { n: 5, gold: 30 },
  ],
  lossStreakGold: [
    { n: 2, gold: 0 },
    { n: 4, gold: 0 },
    { n: 5, gold: 0 },
  ],
  queenLimit: 1,
  maxPawns: 8,
  pawnsPerFile: 3,
  bot: { lockFrom: 0.3, lockTo: 0.95, neverLockChance: 0.15, maxRerolls: 3, rerollGold: 70, rerollChance: 0.06, rerollChanceBare: 0.2, maxHolds: 2, holdChance: 0.5, placeBy: 0.7, maxXpBuys: 3, xpGold: 60, xpRichGold: 140, xpChance: 0.2, xpChanceFull: 0.7, saveChance: 0.3, starUpChance: 0.95, adjustTries: 16, adjustDestinations: 3, adjustNodes: 8000, adjustMargin: 0.02 },
};
