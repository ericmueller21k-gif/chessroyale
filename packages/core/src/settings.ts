/**
 * Every tunable in HunChess lives here, so playtest changes never
 * touch game code. Starting values come from buildspec.md.
 */

export type ScoreCarry = "reset" | "carry";

/**
 * How the move that continues a board is chosen from the group's picks:
 * - random: each pick is one ticket (the original spec)
 * - popular: the move most players picked (a tie is drawn among the tied moves); with `crowdPlayedFromTop` over 1 (50 v 50),
 *   one of the most-picked few, by their picks (crowdTopOdds)
 * - best: the best move picked (a tie is drawn)
 * - weighted: a draw where better moves get more tickets (see drawWeightPoints)
 */
export type DrawRule = "random" | "popular" | "best" | "weighted" | "party";
export const DRAW_RULES: readonly DrawRule[] = ["random", "popular", "best", "weighted", "party"];

/** Game modes: Classic (many boards, players rotate) and Crowd (everyone on one board, the crowd's picks decide the move). */
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
 * How a Crowd 50 v 50 team's move is picked since the rework (the vote "How are moves picked?", Eric, Nov 16; CROWD_PICK):
 * - strong: the judge's best of the team's 3 most-picked moves, or one as good (within 3% expected score), drawn
 * - majority: the old 50 v 50's draw (Eric, Nov 17): the most-picked at 70% of the picks or more, always; else one of the top 3
 *   by their picks (crowdSureShare, crowdPlayedFromTop, crowdTopOdds)
 * - chaos: any move the team picked, each equally likely
 */
export type CrowdPick = "strong" | "majority" | "chaos";

/** One 50 v 50 cut since the rework (CROWD_CUTS): after Black's move `after` (the game's move number), `keep` a side stay in. */
export interface CrowdCut {
  after: number;
  keep: number;
}

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
  /**
   * Several bosses on one side (the Battle Tower, PR 6: a runner option and a test switch until the tower's rules deal them):
   * 2 or 3 BOSS_ROSTER ids with powers, in the order they take turns. A raid then starts with them all (`bossId` unused).
   * Unset or one: one boss, as ever.
   */
  bossIds?: readonly string[];
  /**
   * A Battle Tower floor (core tower.ts; set only by its start path, `startFloor`, from the run's deal): every boss on it plays
   * the floor's strength (`floorStrength`: Maia at the floor's rating, Stockfish from BATTLE_TOWER.stockfishFrom, its best from
   * the floor after its ceiling), with no roster offset and no difficulty, a party at the same ratings. Unset: not the tower.
   */
  towerFloor?: number;
  /**
   * The draw rule "party"'s tie (partyMove): with no majority, another tied move within this many centipawns of the engine's best
   * may be played instead, one of them at random. Unset: BOSS_PARTY.closeCp (30). The Battle Tower's party sets 0 (TOWER_PARTY):
   * Eric's "followed by best engine move if draws", always the best.
   */
  partyCloseCp?: number;
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
   * the boss plays a mate in one whenever it has one: its attack on the crowd's king, then the result, at once. Not with a
   * boss whose first move is a power's (Wrangler's long pull; Sawyer's pawn move for his split): that first move comes
   * first, so name a boss with ?boss= (e.g. hollow) wherever the mate must come at once (2026-11-09-boss-result-red.md).
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
   * meets him for everyone without it: `crowdFinalBoss` in boss.ts; and the fight from his room in the town, set by the
   * server alone: hiddenRoomSettings, Nov 13.)
   */
  bossHidden?: boolean;
  /**
   * The Hidden Boss starts in his child form (RECLUSE_CHILD), then a new match against his adult form once the child is beaten.
   * Set where he's fought, from his forms (recluseChildFirst): his room's fight (hiddenRoomSettings), the Crowd's boss final
   * (modeSettings("crowd")) and solo; `?form=adult`, a test switch (solo and a lobby's), starts at his adult form.
   */
  recluseChild?: boolean;
  /**
   * Test switch, solo (?win=1): the boss battle starts after 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 with the crowd White to move,
   * so Qxf7 mates the boss at once (to see a boss beaten: the Hidden Boss's collapse).
   */
  bossWinTest?: boolean;
  /**
   * Testing only (e2e): the Hidden Boss's cutscene's hold (ms) instead of RECLUSE_CUTSCENE.holdMs; the scene plays sped up to fit it
   * (fitCutscene). Solo: `?cutscene=SECONDS`; online: the lobby server's CUTSCENE_HOLD_MS where TEST_SWITCHES is on.
   */
  cutsceneHoldMs?: number;
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
   * No Last Stand on the crowd's first this many moves of the battle; from the next one on, as above. It counts the
   * moves played in this battle, whatever the opening (a Random opening, Freestyle, a battle that starts from a game in
   * progress). The test switch (?laststand=1) still calls him on any move. Eric, Nov 2: "sometimes it triggers on the
   * first move… it doesn't matter if it's a random position opening like Fischer Random or a piece gets eaten or
   * whatever… always hard set each side five moves in no matter what before it will even look to make a save… it can
   * literally be disabled until it detects that you've played five moves and then it can flip on."
   */
  lastStandFromMove: number;
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
   * Boss alone (a raid with nobody else in the crowd) plays on Boss Battle's clock, BOSS_CLOCK (10 + 10; Eric, Oct 30: "a
   * normal time control for all bosses probably just 10 min + 10 per move"; it replaces his Oct 21 untimed one). On in
   * RAID_SETTINGS; a Solo raid (with bots) keeps the raid's clock, and a test link's ?clock= turns it off.
   */
  bossAloneClock?: boolean;
  /**
   * The battle is on a time bank that loses on time (BOSS_CLOCK): a move that empties the bank isn't played, and the boss
   * wins on time, as under the Hidden Boss's bullet clock. Set with the bank by bossClockSettings, never alone.
   */
  bossClock?: boolean;
  /**
   * A Boss Battle party (part 2): any one member's call for the God King acts for the team (his move, his strike), as
   * the charges are the team's; a raid needs more than half the crowd.
   */
  kingAnyCall?: boolean;
  /**
   * Boss Battle (alone and in a party) has no boss strikes (Eric, Oct 31: "we got to get rid of the strike down thing
   * altogether. That's only for the 50-person mode"): nobody is ever knocked out, and no count to a strike shows. Raids
   * and the Crowd keep theirs.
   */
  bossNoStrikes?: boolean;
  /**
   * Hollow in Boss alone (Eric, Nov 5): his ten bulbs instead of points. Each wrong move into the dark puts one out; at
   * BOSS_POWERS.darkBulbForced (3 and 7) the dark plays a bad move for you; at darkBulbs (10) you lose. Set as the battle
   * begins (the rules keep it in his powers' `strand`, so a battle keeps the rules it began with). Solo only: crowds,
   * raids and parties keep the points (Eric, Nov 5: "bulbs only apply in solo for now to avoid a griever spamming bad
   * moves").
   */
  hollowBulbs?: boolean;
  /** Testing (?bulbs=N): Hollow's strand starts with N of its bulbs already out (to reach 3, 7 and 10 fast). */
  hollowBulbsOut?: number;
  /** Testing (?darkblock=2 or 3): his first cover of the dark brings a block of that size too (his 2 x 2, or his 3 x 3). */
  hollowBlockTest?: 2 | 3;
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
  /**
   * Rounds in each knockout stage in turn, when a mode's stages differ (Crowd 50 v 50: CROWD_STAGE_ROUNDS); the last entry
   * covers later stages. Set and not empty, it replaces `firstStageRounds` and `roundsPerStage` (`roundsInStage`); a
   * test's `?rounds=` empties it.
   */
  stageRounds?: readonly number[];
  /** Players knocked out at the end of each knockout stage; the 2v2 final follows. */
  knockoutsPerStage: readonly number[];
  scoresBetweenStages: ScoreCarry;
  missedMoveScore: number;
  /** Draw rule per knockout stage (the last entry covers later stages). */
  drawRuleByStage: readonly DrawRule[];
  /** Weighted draw: a pick's tickets halve for roughly every this-many × 0.7 points of loss (exp(-loss / this)). */
  drawWeightPoints: number;
  /**
   * The "popular" rule's played move. 1: the most picked (a tie drawn among the tied). More (Crowd 50 v 50's 3, Eric,
   * Nov 2: "if say 45 people castle it will most likely castle but might play one of the other moves"): one of the
   * this-many most-picked moves, each with the odds of its picks over theirs (crowdTopOdds; 45 / 3 / 2 plays 90% / 6% /
   * 4%). Boss battles keep 1.
   */
  crowdPlayedFromTop: number;
  /**
   * With `crowdPlayedFromTop` over 1: when the most-picked move has at least this share of the team's picks, it's played,
   * always, a blunder too (Eric, Nov 4: "10 people on white, a 7-2-1 split, the 7 should always win, but a 6-3-1 could
   * go to the 3"; 50 v 50's 0.7). Below it, the draw (crowdTopOdds). Only real picks count, never a miss's pick made for
   * it (CrowdMisses). 1: only a unanimous pick is sure.
   */
  crowdSureShare: number;
  /**
   * Crowd 50 v 50 since the rework (Eric, Nov 16; CROWD_REWORK): how a team's move is picked, set by the vote "How are moves
   * picked?" (votes.ts; nobody votes: Strong). With the "popular" draw rule it takes the place of `crowdPlayedFromTop` and
   * `crowdSureShare` (CrowdPick, CROWD_PICK). Unset: as before.
   */
  crowdPick?: CrowdPick;
  /**
   * Crowd 50 v 50 since the rework (CROWD_REWORK): one game played to its end, with equal cuts from each side down to a 1 v 1
   * (CROWD_CUTS: after which move, how many a side are kept). Set, it decides each stage's length (roundsInStage: by the game's
   * move number, to the move limit after the last cut) and each cut's size (cutPlan), and the match never enters a final
   * (isFinal). `knockoutsPerStage` goes with it (crowdCutKnockouts). Unset: the endings as before.
   */
  crowdCuts?: readonly CrowdCut[];
  /** With `crowdCuts`: the share of their score each survivor keeps at a cut (the soft reset; 2 decimals). Unset: all of it. */
  crowdCarry?: number;
  /** With `crowdCuts`: the game ends after Black's move this-many (crowdLimitReached), and the judge's verdict decides. */
  crowdMoveLimit?: number;
  /** At the move limit: the side at this expected score or more wins (crowdLimitVerdict); neither: a draw. */
  crowdLimitWin?: number;
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
   * Bot skill temperatures T (in points of loss), strongest to loosest. Since Nov 1 a lobby's bots get the temperature
   * of their rating (BOT_LOBBY, botStrength), never tighter than this range's first number (the ?weakbots=1 floor);
   * botSkillSpread (the sims) still spreads skills evenly on a log scale across it.
   */
  botSkillRange: readonly [number, number];
  /**
   * Solo's bot level (home's 50 v 50 Bots, the Bot level box; Eric, Nov 9): the average rating its bots are drawn around (BOT_LEVELS),
   * or "random" (each bot's rating uniform over BOT_LOBBY.ratings' range). Unset: BOT_LOBBY's own curve, as before (online lobbies).
   */
  botLevel?: number | "random";
  botRandomMoveChance: number;
  /** Crowd 50 v 50's bots (CROWD_BOTS): spread over the good lines with each turn's shared lean. Unset: botPick as before. */
  crowdBots?: CrowdBotSpread;
  /**
   * Crowd 50 v 50's misses (CROWD_MISSES, Eric, Nov 4): a pick made for a player who picks nothing, the score a miss
   * gets, and the removal for being away. Unset or null (every other mode, and the `?afk=0` test switch): a miss
   * scores as before (missedMoveScore, or CrowdScoring.missCaps) and nobody is removed for it.
   */
  crowdMisses?: CrowdMisses | null;
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
  /**
   * A raid (no cuts, so no stages): the cap widens by the crowd's move instead, `cap[i]` from crowd move `capFromMove[i]`
   * (1 up: the raid's first crowd move is 1). Unset: by stage (`capFrom`).
   */
  capFromMove?: readonly number[];
  /** A pick that gives up this many pawns of material or more by the exchange check (a piece) isn't capped. */
  uncapPawns: number;
  sharedFrom: number;
  sharedMin: number;
  sharedShare: number;
  sharedK: number;
  sharedFloor: number;
  /**
   * The relief only when at least this many on the team picked (real picks: a miss never counts, as the AFK rule's tally):
   * at 4 or fewer one pick is a quarter of them (`sharedShare`), so a lone pick would count as a crowd's shared blunder. The
   * director's call for the rework's small sides (4 v 4 to the 1 v 1), Nov 16; docs/decisions/2026-11-16-crowd-rework-runner.md.
   * Unset: at any size (a raid's crowd).
   */
  sharedMinPicks?: number;
  streakStrong: number;
  streakFrom: number;
  streakFromMove: number;
  /**
   * A move counts for streaks only when the group gave away this many points or more on average (raw loss); below it
   * the move plays itself (a decided game, every move scoring about the same) and a streak neither grows nor ends.
   * Unset: every move counts.
   */
  streakMinAverage?: number;
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
  // ±3.5 from cut 1 (move 11), ±5 from cut 2 (move 16), ±8 from cut 3 (move 20) and in the endings: about where they
  // came when a cut followed every move (moves 11, 15, 19; the cuts changed on Nov 1, docs/decisions/2026-11-01-crowd-cuts.md).
  capFrom: [0, 1, 2, 3],
  uncapPawns: 3,
  sharedFrom: 5,
  sharedMin: 3,
  sharedShare: 0.25,
  sharedK: 1,
  sharedFloor: 0.4,
  sharedMinPicks: 5,
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
 * A raid's scoring (Eric, Oct 25: "Raids should use the 50 v 50 math: the dampers and the early forgiveness";
 * docs/decisions/2026-10-25-raid-scoring.md, measured in reports/raid-scoring.md): 50 v 50's, but a raid has no cuts, so
 * the cap widens by the crowd's move (`capFromMove`): +-2 for the first 10 crowd moves, as 50 v 50's first 10 picks,
 * then +-3.5, +-5 and +-8 from picks 11, 15 and 19 (where 50 v 50's cuts 1, 5 and 9 came until Nov 1; its cuts 1, 2 and 3 now). A raid often plays on in a decided game, where
 * every move is "strong", so a move counts for streaks only when the crowd gave away `streakMinAverage` points or more on
 * average. No bubble: nothing is cut. The boss's strike still goes by the points given away (strikeVictim), never by
 * these. Boss alone keeps the old scoring (BOSS_ALONE_SCORING).
 */
export const RAID_SCORING: CrowdScoring = {
  ...CROWD_SCORING,
  capFromMove: [1, 11, 15, 19],
  streakMinAverage: 1,
  cutGrace: 0,
  // (A raid's crowd keeps the relief at any size: the 50 v 50's small sides are the reason for sharedMinPicks.)
  sharedMinPicks: undefined,
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
  lastStandFromMove: 5,
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
  crowdPlayedFromTop: 1,
  crowdSureShare: 1,
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

/**
 * The bots as a lobby (Eric, Nov 1: "mostly about 800 to 1500, with some range above and below", like a real lobby of
 * whoever is online; "a player making the engine's best moves should finish 1st or 2nd").
 * docs/decisions/2026-11-01-bot-lobby.md.
 *
 * - `ratings`: each bot's rating, fixed by its name (the same player every match), on a chess site's scale (Maia's,
 *   Lichess's). A bell curve (`mean`, `sd`), held within `min` to `max`, rounded to `step`. About 89% of bots land
 *   between 800 and 1500, about 5% on either side.
 * - `skillAt`: the bot's temperature (botPick, over the judge's top moves with its `botRandomMoveChance`) that gives
 *   away, in a Crowd 50 v 50, the points a move Maia gives away at that rating (reports/maia-calibration.md's per-move
 *   table; the temperatures' losses measured by `packages/sim/scripts/crowd-bots-sim.ts probe`, reports/crowd-bots.md).
 *   No temperature gives away more than about 7.3 a move, so 600 sits at 128. Between points, along a line in
 *   log(temperature); held at its ends. Stockfish-style, not Maia: Maia is too slow for a team turn on a phone.
 */
export const BOT_LOBBY = {
  ratings: { mean: 1150, sd: 250, min: 600, max: 2200, step: 100 },
  skillAt: [
    [600, 128],
    [900, 67],
    [1200, 27],
    [1500, 16.5],
    [1800, 11.7],
    [2100, 8.4],
    [2400, 6.4],
  ] as readonly (readonly [number, number])[],
};
export type BotLobbySettings = typeof BOT_LOBBY;

/**
 * Home's 50 v 50 Bots: the Bot level box (Eric, Nov 9: "select the average bot MMR … my level … very easy … they kind of fluctuate a few
 * hundred points up and down around [it] … random, which is just pure randomness for every bot").
 * docs/decisions/2026-11-09-home-modes-bot-level.md. Each level sets the bell curve's mean (BOT_LOBBY.ratings' sd, min, max and step
 * stay, narrowed near the range's ends: botRatingOf); `mine` is your own rating (clamped to the curve's range; Medium when the app knows none); `random` draws each bot uniform
 * over the range. Medium's 1150 is BOT_LOBBY's own mean, so Medium plays exactly as solo did before. Solo only.
 */
export const BOT_LEVELS = [
  { id: "mine", label: "My level", mean: null },
  { id: "very-easy", label: "Very easy", mean: 700 },
  { id: "easy", label: "Easy", mean: 950 },
  { id: "medium", label: "Medium", mean: 1150 },
  { id: "hard", label: "Hard", mean: 1500 },
  { id: "very-hard", label: "Very hard", mean: 1900 },
  { id: "random", label: "Random", mean: null },
] as const;
export type BotLevelId = (typeof BOT_LEVELS)[number]["id"];

/** A Bot level's setting (Settings.botLevel): its mean, your rating for "mine" (clamped; Medium's without one), or "random". */
export function botLevelMean(id: BotLevelId, yourRating: number | null): number | "random" {
  if (id === "random") return "random";
  const { min, max, mean } = BOT_LOBBY.ratings;
  if (id === "mine") return yourRating == null || !Number.isFinite(yourRating) ? mean : Math.max(min, Math.min(max, Math.round(yourRating)));
  return BOT_LEVELS.find((l) => l.id === id)!.mean ?? mean;
}

/**
 * A 50 v 50 party's people (Eric, Nov 9 and 16: queue together into the public 50 v 50 matchmaking, on one team, the side drawn at
 * random): you and up to 7 friends, invited from your friends list (docs/decisions/2026-11-16-crowd-party.md).
 */
export const CROWD_PARTY_MAX = 8;

/**
 * A 50 v 50 party's play (the fix round of PR #747, docs/decisions/2026-11-16-crowd-party-fixes.md):
 * - `ranked`: whether a 50 v 50 party's members (a party of 2 or more friends who played together) get a ranked result (the singles
 *   in the same match always do). Eric, Nov 16: yes, "It's always ranked. There is no unranked unless it's a private lobby."
 *   Off: their results and the party's screen say why, in one line each.
 * - `leadHoldMs`: how long a leader who dropped (a reload, the app in the background) keeps the lead before it passes on.
 * - `awayStopMs`: a search with nobody in the party connected for this long stops (its ticket is canceled).
 */
export const CROWD_PARTY: { ranked: boolean; leadHoldMs: number; awayStopMs: number } = {
  ranked: true,
  leadHoldMs: 20_000,
  awayStopMs: 20_000,
};

/** 32-bit FNV-1a of a string (a bot's name: its fixed rating). */
function nameHash(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

/**
 * A bot's rating, from its name alone (the same every match): BOT_LOBBY.ratings' bell curve. `level` (solo's Bot level, BOT_LEVELS):
 * the curve around that mean instead, or uniform over the range for "random", still fixed by the name within the level (the name and
 * the level seed it; BOT_LOBBY's own mean keeps the name's rating of before).
 */
export function botRatingOf(name: string, b: Pick<BotLobbySettings, "ratings"> = BOT_LOBBY, level?: number | "random"): number {
  const { min, max, step } = b.ratings;
  const mean = typeof level === "number" ? Math.max(min, Math.min(max, level)) : b.ratings.mean;
  // (Near the range's ends a level's curve narrows (to 1.5 times its room), so the clamp doesn't drag its average off the level's:
  // Very easy's 700 sits 100 above the floor, a bot below 600 would play as 600 anyway.)
  const sd = Math.min(b.ratings.sd, 1.5 * (mean - min), 1.5 * (max - mean));
  const own = level === undefined || level === b.ratings.mean;
  let a = nameHash(own ? name : `${name}|${level}`);
  const next = () => {
    // (mulberry32, inline: rng.ts imports nothing from here, and this file stays free of imports.)
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  if (level === "random") return Math.round((min + next() * (max - min)) / step) * step;
  const u1 = Math.max(next(), 1e-9);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * next());
  return Math.max(min, Math.min(max, Math.round((mean + sd * z) / step) * step));
}

/** The temperature (botPick) that plays like a rating (BOT_LOBBY.skillAt; held at its ends). */
export function botSkillForRating(rating: number, b: Pick<BotLobbySettings, "skillAt"> = BOT_LOBBY): number {
  const pts = b.skillAt;
  if (rating <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    const [r1, s1] = pts[i]!;
    const [r0, s0] = pts[i - 1]!;
    if (rating <= r1) return Math.round(Math.exp(Math.log(s0) + ((rating - r0) / (r1 - r0)) * (Math.log(s1) - Math.log(s0))) * 1000) / 1000;
  }
  return pts[pts.length - 1]![1];
}

/** The rating a temperature plays like (botSkillForRating's inverse, held at its ends), rounded to the step. */
export function botRatingForSkill(skill: number, b: Pick<BotLobbySettings, "skillAt" | "ratings"> = BOT_LOBBY): number {
  const pts = b.skillAt;
  const step = b.ratings.step;
  const snap = (r: number) => Math.round(r / step) * step;
  if (skill >= pts[0]![1]) return pts[0]![0];
  for (let i = 1; i < pts.length; i++) {
    const [r1, s1] = pts[i]!;
    const [r0, s0] = pts[i - 1]!;
    if (skill >= s1) return snap(r0 + ((Math.log(s0) - Math.log(skill)) / (Math.log(s0) - Math.log(s1))) * (r1 - r0));
  }
  return pts[pts.length - 1]![0];
}

/**
 * A bot's rating and temperature as its seat gets them: its name's rating (botRatingOf), as loose as `botSkillRange`
 * allows at least (the ?weakbots=1 switch: then the rating that temperature plays like).
 */
export function botStrength(name: string, settings: Pick<Settings, "botSkillRange" | "botLevel"> = DEFAULT_SETTINGS): { rating: number; skill: number } {
  const rating = botRatingOf(name, BOT_LOBBY, settings.botLevel);
  const skill = botSkillForRating(rating);
  const floor = settings.botSkillRange[0];
  return skill >= floor ? { rating, skill } : { rating: Math.min(rating, botRatingForSkill(floor)), skill: floor };
}

/** `count` bot skills spread evenly on a log scale across `botSkillRange`, strongest first. */
export function botSkillSpread(count: number, settings: Settings = DEFAULT_SETTINGS): number[] {
  const [lo, hi] = settings.botSkillRange;
  return Array.from({ length: count }, (_, i) => Math.round(lo * Math.pow(hi / lo, i / Math.max(1, count - 1)) * 1000) / 1000);
}

/** Longest opening a lobby can choose, in moves per side. */
export const MAX_OPENING_MOVES = 10;

/** Plies of opening on a board where White starts (Black-start boards get one more). */
export const openingPlies = (s: Pick<Settings, "openingMoves">) => 2 * Math.max(0, Math.min(MAX_OPENING_MOVES, Math.round(s.openingMoves)));

/**
 * Rounds (plies) in a knockout stage: with `crowdCuts` (the 50 v 50 rework), the plies to its cut's move (crowdStageRounds),
 * unless a test's `?rounds=` emptied `stageRounds`; else `stageRounds`' entry when the mode has a list; else the longer
 * first one, then `roundsPerStage`.
 */
export const roundsInStage = (
  s: Pick<Settings, "roundsPerStage" | "firstStageRounds" | "stageRounds"> & Partial<Pick<Settings, "crowdCuts" | "crowdMoveLimit" | "openingMoves">>,
  stage: number,
) =>
  s.crowdCuts?.length && s.stageRounds?.length !== 0
    ? crowdStageRounds(s, stage)
    : s.stageRounds?.length
      ? s.stageRounds[Math.min(stage, s.stageRounds.length - 1)]!
      : stage === 0
        ? s.firstStageRounds
        : s.roundsPerStage;

/**
 * The plies of a stage under `crowdCuts`, counted by the game's own move number (the board's: "Move 14"), the same in every
 * start: from move 1, or the move after a Random opening's `openingMoves`, to Black's move `after` of the stage's cut; after
 * the last cut, the 1 v 1 to the move limit (`crowdMoveLimit`; none: it plays to the end). At least one ply.
 */
export function crowdStageRounds(s: Partial<Pick<Settings, "crowdCuts" | "crowdMoveLimit" | "openingMoves">>, stage: number): number {
  const cuts = s.crowdCuts ?? [];
  const from = stage <= 0 || !cuts.length ? (s.openingMoves ?? 0) : cuts[Math.min(stage, cuts.length) - 1]!.after;
  const to = stage < cuts.length ? cuts[stage]!.after : (s.crowdMoveLimit ?? Infinity);
  return Math.max(1, 2 * (to - from));
}

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
 * four always battle versus [him]"; it was the top 10 against a random boss). Fewer, bigger cuts (Eric, Nov 1: "we need
 * fewer eliminations, but we can eliminate more players"): 100 → 70 → 48 → 32 → 20 → 12 → 8 (team final) → 4 (boss
 * final) → 2 (duel), half of each cut from each team. Each cut comes after CROWD_STAGE_ROUNDS' stage.
 * docs/decisions/2026-11-01-crowd-cuts.md.
 */
export const CROWD_KNOCKOUTS: Record<FinalFormat, readonly number[]> = {
  team: [30, 22, 16, 12, 8, 4],
  boss: [30, 22, 16, 12, 8, 4, 4],
  duel: [30, 22, 16, 12, 8, 4, 4, 2],
};

/**
 * Crowd 50 v 50's bots (Eric, Nov 2: "the goal should be unique lines favored over optimal play"; "the bots aren't
 * hijacking which move is chosen every time"; docs/decisions/2026-11-02-crowd-bot-spread.md). Each team turn draws one
 * shared lean (botLean) from the turn's random source before any bot picks; then each bot weighs the judge's lines:
 *
 * - a **good line** (one of the first `moves` lines giving away less than `blunderLoss` points: Lichess's blunder, a
 *   15% swing in expected score) by exp(-focus x loss / T + taste), T the bot's temperature (its rating, BOT_LOBBY);
 * - any other line (a blunder, or past the first `moves`) by `blunderWeight` x exp(-loss / T): rare, rarer the stronger.
 *
 * The lean: `focus` (log-uniform over its range) is how closely this turn's appeal follows the engine (high: the team
 * crowds onto the best; low: it scatters); `taste` is a normal draw per line times a strength drawn over `lean`, the
 * same for every bot of the team that turn, so the plurality lands on different good lines turn to turn (humans herd).
 * Weaker bots (higher T) follow the taste more and the engine less. `powerUpChance`: a bot holding a power-up uses it
 * on a sharp turn (the second line gives away `botPowerUpLoss` or more) with this chance, and then plays the best line;
 * before Nov 2 every bot holding one used it at once, so a whole team picked the same move (the unanimous castles).
 * The bots keep BOT_LOBBY's temperatures: here they give away about 60% of the points a move they did before Nov 2,
 * in the same order by rating (a Maia-matched table needs a 1200 bot to miss a plain recapture about half the time, and
 * the team then plays blunders: reports/crowd-spread.md).
 */
export interface CrowdBotSpread {
  moves: number;
  blunderLoss: number;
  blunderWeight: number;
  focus: readonly [number, number];
  lean: readonly [number, number];
  powerUpChance: number;
}
/**
 * Crowd 50 v 50's misses (Eric, Nov 4: "no move at all = default to a random top 5 move, but your penalty is simply you
 * get the lowest score given to a player on your team that round; but if you miss more than 3 moves in the game you are
 * removed for being AFK, so people don't cleverly abuse AFK if they don't know a move and it's nearing the end";
 * docs/decisions/2026-11-04-crowd-votes-afk.md). A player who picks nothing in a turn:
 * - gets a pick made for them, one of the engine's `defaultFromTop` best moves at random (shown to them, never counted
 *   in the team's tally: it would sway or dilute the vote). Nobody on the team picked: the team plays one of those
 *   moves at random (in team turns; a final's mover and a boss battle as before: the engine's best, or the boss's rule);
 * - scores the lowest round score of anyone in the group who picked (never better than the worst real pick; nobody
 *   picked: CrowdScoring.missCaps as before);
 * - with more than `allowed` misses in the game (the 4th), is removed for being away: today's "left the match"
 *   (LeftHow "afk": a loss, out in the last place still open, a bot in the seat where one takes it). Bots never miss.
 */
export interface CrowdMisses {
  defaultFromTop: number;
  allowed: number;
}
export const CROWD_MISSES: CrowdMisses = { defaultFromTop: 5, allowed: 3 };

export const CROWD_BOTS: CrowdBotSpread = {
  // (Eric, Nov 2, on the first tune: the plurality was the engine's best 39% of turns and the played move a top-3 line
  // 74%: "spread better across the best 4-5 moves, or even 7 moves when it's early game". Wider: 7 lines, a looser focus,
  // a stronger lean: plurality = best about 25%, played a top-3 line about 55%, played blunders about 1.5%.)
  moves: 7,
  blunderLoss: 15,
  blunderWeight: 0.1,
  focus: [0.1, 1],
  lean: [0.8, 2.5],
  powerUpChance: 0.25,
};

/**
 * Crowd 50 v 50: the rounds (plies: a move is one from each team) before each cut, CROWD_KNOCKOUTS' stages in order:
 * cuts after moves 10, 15, 19, 23, 26 and 29 (the team final), 32 (the boss final) and 34 (the duel). Longer rounds, so
 * the chess has room between cuts (Eric, Nov 1: "it takes away from the chess game because there's too many cuts").
 */
export const CROWD_STAGE_ROUNDS: readonly number[] = [20, 10, 8, 8, 6, 6, 6, 4];

/**
 * The 50 v 50 rework's pick modes (Settings.crowdPick; Eric, Nov 16; notes/designs/crowd-rework.md, rule 1; measured in
 * reports/crowd-rework.md). Only the team's real picks count, never a miss's pick made for it (CROWD_MISSES); nobody on the
 * team picked: one of the engine's top `CROWD_MISSES.defaultFromTop` (the runner, as before).
 * - **strong** (nobody votes: this): the team's `strongTop` most-picked moves (a tie for the last place goes to the
 *   better-scored); the judge's best of them is played, or, when others are within `strongClose` expected score of it (0.03:
 *   about 30 centipawns), one of those close ones and it, drawn at equal odds;
 * - **majority** (Eric, Nov 17: "it almost always does the majority but sometimes the 2nd or 3rd option"): the old 50 v 50's
 *   draw, kept one setting away in case the old way comes back: the most-picked move at `crowdSureShare` (0.7) of the team's real
 *   picks or more, always; below it, one of the `crowdPlayedFromTop` (3) most-picked by their picks (`crowdTopOdds`);
 * - **chaos**: one of the distinct moves the team picked, each equally likely, however many picked it (Eric's default for his
 *   question 2: "totally random").
 * The 1 v 1 needs no rule: one player's pick is the only move.
 */
export const CROWD_PICK: { strongTop: number; strongClose: number } = { strongTop: 3, strongClose: 0.03 };

/**
 * The 50 v 50 rework's cuts (Eric, Nov 16; the design's schedule C): equal from each side, each side's players ranked by their
 * score (already relative to their own team), after Black's move `after` by the game's move number, leaving `keep` a side:
 * 50 v 50 for moves 1-14, then 34, 23, 15 and 10 a side for 4 moves each, 6 for 3 (31-33), 4 for 6 (34-39: Eric, "the top 4
 * a side play longer"), 2 for 3 (40-42), and from move 43 the 1 v 1 to the move limit. Ties at the line go through and what
 * that leaves over is owed by the cuts to come, spread evenly; the last cut is exact (cutPlan). The first cut after 14: the
 * opening allowance is gone by then (OPENING_ALLOWANCE.goneBy).
 */
export const CROWD_CUTS: readonly CrowdCut[] = [
  { after: 14, keep: 34 },
  { after: 18, keep: 23 },
  { after: 22, keep: 15 },
  { after: 26, keep: 10 },
  { after: 30, keep: 6 },
  { after: 33, keep: 4 },
  { after: 39, keep: 2 },
  { after: 42, keep: 1 },
];

/** A Crowd 50 v 50's lobby: 100 players, 50 a side (CROWD_SETTINGS.lobbySize). */
export const CROWD_LOBBY_SIZE = 100;

/** Each cut's knockouts, both sides together (Settings.knockoutsPerStage), from a cut schedule and the lobby's size. */
export function crowdCutKnockouts(cuts: readonly CrowdCut[], lobbySize = CROWD_LOBBY_SIZE): number[] {
  return cuts.map((c, i) => 2 * Math.max(0, (i ? cuts[i - 1]!.keep : lobbySize / 2) - c.keep));
}

/**
 * The 50 v 50 rework in core (Eric, Nov 16: "the 50v50 rework. We're doing away with the hidden boss on that for now";
 * notes/designs/crowd-rework.md; docs/decisions/2026-11-16-crowd-rework-core.md). On in CROWD_SETTINGS since step C2 (the
 * runner, the server and the protocol: docs/decisions/2026-11-16-crowd-rework-runner.md); raids never take it (RAID_SETTINGS). One game played to its
 * end: mate, a draw by the rules, or the move limit, after Black's move `crowdMoveLimit`, where the judge's verdict decides
 * (a side at `crowdLimitWin` expected score or more wins; else a draw: Eric's default for his question 1). No team final,
 * boss final or duel. The cuts (CROWD_CUTS) take the same number from each side down to a 1 v 1; at each cut a survivor
 * keeps `crowdCarry` of their score. Strong is the pick when nobody votes (and with the votes off).
 */
export const CROWD_REWORK: Partial<Settings> = {
  crowdPick: "strong",
  crowdCuts: CROWD_CUTS,
  knockoutsPerStage: crowdCutKnockouts(CROWD_CUTS),
  crowdCarry: 0.5,
  crowdMoveLimit: 60,
  crowdLimitWin: 0.75,
};

/**
 * The 50 v 50 rework's best player (bestPlayer; the design's rule 5): the fewest counted points given away a move over the
 * match (matchLoss), among those who survived at least `cutsShare` of the cuts made (half: rounded up).
 */
export const CROWD_BEST = { cutsShare: 0.5 } as const;

/**
 * Crowd mode: 100 players, 50 v 50, on one board from the starting position; each team picks its side's moves. Since the
 * rework (Nov 16, CROWD_REWORK, spread in last): the move by the pick vote (Strong when nobody votes), equal cuts from each
 * side (CROWD_CUTS) down to a 1 v 1, half of each survivor's score carried at a cut, one game played to its end or the move
 * limit; no endings. (The keys before it, the endings' knockouts and the top-3 draw, are the old 50 v 50's: the rework's
 * keys take their place; step C4 retires them.) 3 power-ups, none earned.
 */
export const CROWD_SETTINGS: Partial<Settings> = {
  mode: "crowd",
  // Always team turns (Crowd's "everyone moves" went on Oct 15, 2026); only a raid sets it false.
  crowdTeams: true,
  lobbySize: CROWD_LOBBY_SIZE,
  groupSize: CROWD_LOBBY_SIZE,
  knockoutsPerStage: CROWD_KNOCKOUTS.team,
  finalFormat: "team",
  stageRounds: CROWD_STAGE_ROUNDS,
  // (Used only when `stageRounds` is emptied: a test's ?rounds=, which sets both.)
  firstStageRounds: 20,
  roundsPerStage: 2,
  scoresBetweenStages: "carry",
  crowdScoring: CROWD_SCORING,
  colourPerStage: false,
  drawRuleByStage: ["popular"],
  crowdPlayedFromTop: 3,
  crowdSureShare: 0.7,
  crowdBots: CROWD_BOTS,
  crowdMisses: CROWD_MISSES,
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
  // (The 50 v 50 rework, Nov 16: last, so its cuts' knockouts take the place of the endings'.)
  ...CROWD_REWORK,
};

/**
 * The 50 v 50 as it was before the rework (the top-3 draw with its sure share, CROWD_STAGE_ROUNDS' cuts to an ending, scores
 * carried whole, the relief at any size), put over CROWD_SETTINGS: for the old endings' unit tests and sims, until step C4
 * retires them with their code, and the FAQ's words until step C3 rewrites them for the rework. No lobby, test switch or queue
 * sets it: no match is played with it.
 */
export const CROWD_PRE_REWORK: Partial<Settings> = {
  crowdPick: undefined,
  crowdCuts: undefined,
  crowdCarry: undefined,
  crowdMoveLimit: undefined,
  crowdLimitWin: undefined,
  knockoutsPerStage: CROWD_KNOCKOUTS.team,
  crowdScoring: { ...CROWD_SCORING, sharedMinPicks: undefined },
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
  // (50 v 50's scoring, its cap widening by the crowd's move: RAID_SCORING. Boss alone: BOSS_ALONE_SCORING.)
  crowdScoring: RAID_SCORING,
  // (The most popular pick is played, and bots pick as everywhere else: 50 v 50's crowdPlayedFromTop and crowdBots are off.)
  crowdPlayedFromTop: 1,
  crowdBots: undefined,
  // (A raid keeps its misses as before: 50 v 50's CROWD_MISSES are off.)
  crowdMisses: undefined,
  // (Nor does it take the 50 v 50 rework, once CROWD_SETTINGS has it: a raid has no cuts, no move limit and plays the most popular pick.)
  crowdPick: undefined,
  crowdCuts: undefined,
  crowdCarry: undefined,
  crowdMoveLimit: undefined,
  crowdLimitWin: undefined,
  augments: false,
  lobbySize: 50,
  groupSize: 50,
  knockoutsPerStage: [],
  // (No cuts, so no Crowd schedule: firstStageRounds as before.)
  stageRounds: [],
  openingMoves: 5,
  powerUpsAtStart: 0,
  bossAloneClock: true,
};

/**
 * Boss Battle's clock (Eric, Oct 30: "10 min + 10 per move" for every boss, alone and in a party): a bank of
 * `bankSeconds`, `incrementSeconds` added as each move begins, no cap on a single move; the boss has none. In a party it's
 * the team's one bank. Out of time loses. docs/decisions/2026-10-30-boss-battle-clock.md.
 */
export const BOSS_CLOCK = { bankSeconds: 600, incrementSeconds: 10 } as const;

/**
 * Boss Battle's live party (Eric, Oct 29 and 30; docs/decisions/2026-10-30-boss-party.md):
 * - `max`: you and two on the platforms behind you;
 * - `closeCp`: with no majority, the engine's best pick is played unless another is within this many centipawns of it,
 *   then one of those at random (Eric, Oct 30: 30);
 * - `afkKickSec`: a turn's first pick, then this long, and whoever may kick can kick someone who hasn't picked;
 * - `joinWaitSec`: after START, how long the battle waits for every member to arrive before it begins without them.
 */
export const BOSS_PARTY = { max: 3, closeCp: 30, afkKickSec: 60, joinWaitSec: 30 } as const;

/**
 * The Battle Tower's party (Eric, Nov 18 and 20; docs/decisions/2026-11-20-tower-party.md): Boss Battle's party (its seats, READY and
 * START, Kick and Promote, the party rule) for up to `max` climbers, the tie always the engine's best (`closeCp` 0: Eric's "followed
 * by best engine move if draws"). A party's floor won at one of `crateFloors` pays a crate, once an account (the design's section 3:
 * a party's floor is the server's word, a solo floor the device's). The clerk's "Open party" line in the town's chat lasts as the town's
 * lines do (TOWN_CHAT.lineMs, then the button is live again), and lapses sooner when the party fills, starts or its leader leaves; one
 * line an account at a time (a newer replaces the older), and a new one at most every `openGapMs` (the review of #835, finding 2). The
 * clerk's list of open parties (Eric, Nov 20) shows at most `listMax` of them, newest first, read again every `listPollMs` while it shows;
 * each Worker instance makes the list at most once every `listCacheMs` (from its copy of the town's chat, then each party asked), and every
 * reader on it shares that (the delta review of #835, finding 1: one list an instance, never one a reader). While a party's floor shows
 * under way, the party asks its floor's room every `floorCheckMs` whether the floor is over, should the room's own word never come
 * (finding 2: a room that never started, or its call lost).
 */
export const TOWER_PARTY = { max: 4, closeCp: 0, crateFloors: [25, 50, 75, 99] as readonly number[], openGapMs: 60_000, listMax: 12, listPollMs: 4000, listCacheMs: 3000, floorCheckMs: 60_000 } as const;

/**
 * The Hidden Boss's room challenge (Eric, Nov 12 and 13; docs/decisions/2026-11-13-hidden-boss-challenge.md): in the top-floor room
 * of his walk-up in the town, each player's Challenge counts toward one request per town instance ("1 of 4"…); at `players` the
 * summoning plays and they fight him together (one team on the party rule: hiddenRoomSettings).
 * - `players`: the request's size, and the most people in the room at once (a 5th finds "The door is locked.");
 * - `capSec`: a request without its four by then ends for everyone in it ("Sorry, not enough players."); not shown anywhere;
 * - `pollMs`: how often a device in his room asks the server (the count, the room's people, the start);
 * - `silentSec`: a device in the room that hasn't asked for this long has gone (a disconnect): out of the room and the request;
 * - `outcomeSec`: how long the start (or the end) waits for a device to read it;
 * - `bots`: the admin's test bots ("Fill with 3 bots": admins only, server-checked), and `botJoinMs`: each joins a challenge
 * *   on the admin's first look this long or more after the one before, as a player would (one a look: the admin sees each count);
 * - `joinWaitSec`: the fight waits this long for the four to arrive (the summoning plays first), then begins with those who came.
 */
export const HIDDEN_ROOM = { players: 4, capSec: 300, pollMs: 1500, silentSec: 20, outcomeSec: 60, bots: 3, botJoinMs: 2000, joinWaitSec: 60, boss: "recluse" } as const;

/**
 * A Boss Battle party's battle's settings (docs/decisions/2026-10-30-boss-party.md), the server's and the app's alike: a
 * raid of up to BOSS_PARTY.max on the draw rule "party", BOSS_CLOCK as the team's one clock, any member's God King call
 * for the team, and the boss at the leader's difficulty (its Maia rating and its offset, as Boss alone). The boss itself
 * (`bossId`) is the caller's to add: a playable one, else random.
 */
export function bossPartySettings(difficulty: string): Partial<Settings> {
  const d = BOSS_DIFFICULTY.find((x) => x.id === difficulty) ?? BOSS_DIFFICULTY.find((x) => x.id === "normal")!;
  return {
    ...RAID_SETTINGS,
    ...bossClockSettings({ bossMaxMoves: RAID_SETTINGS.bossMaxMoves ?? DEFAULT_SETTINGS.bossMaxMoves }),
    lobbySize: BOSS_PARTY.max,
    groupSize: BOSS_PARTY.max,
    drawRuleByStage: ["party"],
    kingAnyCall: true,
    bossNoStrikes: true,
    bossDifficulty: d.elo,
    bossAloneMaia: d.maia,
  };
}

/**
 * The Hidden Boss's fight from his room (HIDDEN_ROOM; Eric, Nov 13): Boss Battle's party battle for the room's four (the party rule:
 * a move two or more picked is played, a tie between moves by their strength: partyMove), the team's one clock, any member's God
 * King call; the boss always him (`bossHidden`: he's hidden from players everywhere else). His forms in turn (RECLUSE_FORMS): the child
 * first, then his adult form, then his phase change and the four boards online (Nov 13: RECLUSE_ONLINE), as in the Crowd's final. The server's alone: a player can't ask for it.
 */
/**
 * A Battle Tower party's floor (docs/decisions/2026-11-20-tower-party.md): Boss Battle's party battle (the party rule, the team's one
 * clock, any member's God King call) for up to TOWER_PARTY.max, every tie to the engine's best (`partyCloseCp` 0), the bosses at the
 * floor's strength (`floor`: core tower.ts floorSettings, the run's deal; no difficulty, no Maia of a pick, as a solo floor).
 */
export function towerPartySettings(floor: Partial<Settings>): Partial<Settings> {
  return { ...bossPartySettings("normal"), lobbySize: TOWER_PARTY.max, groupSize: TOWER_PARTY.max, partyCloseCp: TOWER_PARTY.closeCp, bossDifficulty: 0, bossAloneMaia: 0, bossHidden: false, bossUnfinished: false, ...floor };
}

export function hiddenRoomSettings(): Partial<Settings> {
  return { ...bossPartySettings("normal"), lobbySize: HIDDEN_ROOM.players, groupSize: HIDDEN_ROOM.players, bossId: HIDDEN_ROOM.boss, bossHidden: true, recluseChild: recluseChildFirst() };
}

/**
 * A move's centipawns from the mover's expected score (0 to 1), by Lichess's win-chance curve (expected = 1 / (1 +
 * e^(-0.00368208 cp))), as the judge measures expected scores, not centipawns. Kept inside +-2000 (a decided position).
 */
export function cpFromExpected(expected: number): number {
  const e = Math.min(0.9994, Math.max(0.0006, expected));
  return Math.log(e / (1 - e)) / 0.00368208;
}

/**
 * The settings for a battle on BOSS_CLOCK: the bank and its increment, and a move clock no bank can reach (the bank plus
 * the increment on every move a battle can have), so the bank decides. The Hidden Boss's Bullet still replaces it when
 * it comes (its own bank and increment).
 */
export function bossClockSettings(s: Pick<Settings, "bossMaxMoves">, clock: { bankSeconds: number; incrementSeconds: number } = BOSS_CLOCK): Partial<Settings> {
  return {
    bossClock: true,
    timeBankSeconds: clock.bankSeconds,
    timeIncrementSeconds: clock.incrementSeconds,
    moveClockSeconds: clock.bankSeconds + clock.incrementSeconds * s.bossMaxMoves,
    moveClockSteps: [],
  };
}

/**
 * Boss alone (you alone against a boss: a raid of one, on this device) scores as before (no cap, streaks or 2
 * decimals): with nobody to compare with, every round score is 0 but a miss, and its scoreboard is going away.
 */
export const BOSS_ALONE_SCORING: Partial<Settings> = { crowdScoring: undefined };

/**
 * The Battle Tower (docs/decisions/2026-11-18-battle-tower-design.md). Several bosses on one side (PR 6): each boss's rage
 * meter fills at `rageScale[n - 1]` of its speed on a floor of n bosses (first guesses; the tower's sim tunes them), and the
 * bosses in `apart` are never on one floor: Hollow and Smudgy (both hide what is on a square; Eric, Nov 18), and, for now, the pairs
 * the kit found colliding (Eric, Nov 19: "if two boss things collide badly just for now make note of which combination to not use"):
 * Smudgy and Alfil (Repaint while the Slam holds pieces up), Alfil and Grex (the Slam lifts a piece blocking a boss pawn's
 * promotion), Dash and Smudgy (Dash's extra move ignores the side's stops and can slide the hidden rook).
 * docs/decisions/2026-11-19-tower-apart-pairs.md.
 */
export const BATTLE_TOWER = {
  /**
   * The climb (core tower.ts; the design's section 3): 99 floors, each one game. Only ever raised: a run saved above it would end there
   * as the top (core finishFloor), its best held at it (server tower.ts, soloBest).
   */
  floors: 99,
  /**
   * A run's lives (Eric, Nov 20: "2 lives I think is still the way to go. And yeah, it just takes you on to the next match, and it just
   * counts. You just advance."): a floor lost or drawn (or left after your 2nd move) costs one and the climb goes on, the next floor
   * dealt as after a win; a loss with none left ends the run (core finishFloor). 2: the third loss ends it. Only floors won count to a
   * best. docs/decisions/2026-11-20-tower-lives.md.
   */
  lives: 2,
  /** How many bosses a floor has, looping: floor f has pattern[(f - 1) % pattern.length] (Eric: "1 boss then 2, maybe 2 again, then 3"). */
  pattern: [1, 2, 2, 3] as readonly number[],
  /**
   * Floors before stockfishFrom: Maia at maiaStart, then each floor adds the step of the last `maiaSteps` row whose floor it has reached
   * (held at Maia's top, 2500). Eric, Nov 20 (the climb sim: +100 a floor ended every run by floor 8): "for the first 10 levels, it
   * should probably just climb like 20 per ... go up like 20 points for the first 5 levels, and then go up like 30 points, and then like
   * maybe 40 points ... players feel pretty comfortable getting, you know, 10 levels in ... Getting to 20 levels should be doable ...
   * around the 30 mark ... keep it clamped in like the 15 to 1700 range for a bit." Two-boss floors: 600, 680 (floor 5), 830 (10),
   * 1630 (30), 1710 (50); a lone boss soloBonus more. The sims' tries: reports/tower-sim.md.
   */
  maiaStart: 600,
  maiaSteps: [
    [2, 20],
    [6, 30],
    [11, 40],
    [31, 4],
  ] as readonly (readonly [number, number])[],
  /**
   * A one-boss floor plays this much stronger, within the same caps (Eric: "solo bosses get a little bit extra strength"). The director's
   * guess: +200 with +100 a floor; +100 since the gentler climb of Nov 20 (+200 made floor 1 stronger than floors 2 to 8, and the
   * lone floors of the 30s and 40s 1900, well over Eric's "15 to 1700").
   */
  soloBonus: 100,
  /**
   * From this floor Stockfish (Eric: "at 50 wins ... we swap to stock fish and continue up"): its UCI_Elo stockfishStart, +stockfishStep a
   * floor, held at its ceiling (ENGINE_MAX_ELO, 3190); from the floor after that, its best every move. Nov 20 (the director's call, with
   * the gentler Maia climb): from about where Maia's floors end (1750, not a jump to 2500), +31 a floor: its ceiling on floor 98, and the top floor (99) its best.
   */
  stockfishFrom: 51,
  stockfishStart: 1750,
  stockfishStep: 31,
  /** Leaving a floor under way is free before your leaveFreeBefore-th move (the floor fought again later, the same bosses), else a loss (a life). */
  leaveFreeBefore: 2,
  /**
   * A solo floor reported won sooner than this after its start, by the server's clock, is refused, the floor still under way (server
   * tower.ts, finishTowerFloor): a sanity check on the device's word, well under any real win (a four-move mate takes longer). Not
   * where TEST_SWITCHES is on (local, e2e, staging).
   */
  soloWinMinSeconds: 10,
  rageScale: [1, 0.75, 0.6] as readonly number[],
  /**
   * Bosses whose ultimate never comes on a tower floor of several (2 or 3 bosses; solo and party alike; the runner sets it up as the
   * floor starts, so solo and online agree). Eric, Nov 20: "Disable wrangler ult plz in battle tower", then "if wrangler is solo in battle
   * tower he fires his ult off still ... just make sure in all modes for him he can only ult once a game then it turns gray": alone on a
   * floor he keeps it (once, as everywhere: showdownMax). Wrangler's code id is `pig`. His meter stays on the bar, empty and dimmed, never
   * filling (nothing hidden). Outside the tower nothing changes. The gates are generic (prepareTurn's ultimate
   * step, ultimateNow, the test trigger, the meter) plus Wrangler's own showdown checks: a boss added here whose ultimate is set up
   * elsewhere needs its own gate too (tower.test.ts runs every boss listed). docs/decisions/2026-11-20-tower-fixes.md.
   */
  noUltimate: ["pig"] as readonly string[],
  /**
   * The most ultimates each boss has on a tower floor of this many bosses (solo and party alike; the runner sets it on each boss's powers
   * as the floor starts, `ultMax`, so solo and online agree and a restored battle keeps it). Eric, Nov 22 (a floor of three where Smudgy
   * ulted twice): "when there's 3 bosses, they should each be maxed out at 1 ult ... They only ult once each at most." On top of each boss's
   * own cap (maxUltimates, repaintMax, showdownMax, once a battle): the lower wins. After his last, his meter stays on the bar, empty and
   * dimmed, and stops charging (as Timber's and Chandy's after theirs); the test trigger refuses. The ultimate only: a second meter
   * (Ginger's Super Freeze, Dash's Scramble Rush) keeps its own cap. A size not listed (a floor of two) keeps every boss's own cap; a lone
   * floor never reads this (one boss, as in every mode). The gates are the dispatcher's (boss-powers.ts `ultCapped`).
   * docs/decisions/2026-11-22-tower-three-ult-cap.md.
   */
  ultsOnFloorOf: { 3: 1 } as Readonly<Record<number, number>>,
  /**
   * Bosses whose power adds pieces to the board, not their ultimate: on a tower floor of several, only the first of them in the floor's
   * turn order (the primary) keeps it; the others' is off all floor (the runner marks their powers `noAdd` as the floor starts, so solo
   * and the party's room agree, and a restored battle keeps it). One of them on a floor, a lone floor, and every other mode: unchanged.
   * Eric, Nov 20: "maybe we need a rule where one boss acts as the primary when it comes to certain moves IE hippo and Babur both
   * shouldn't be 'growing' pieces", then "for any move that's an 'add pieces' move, but it's not their ult. Only one is active during
   * the battle tower, so solo battle tower bosses it's fine." Babur's balloons (`tiger`), Timber's workshop drops, Don Dough's rising
   * dough (`zebra`), Sawyer's split pawn; Puddles (`gardener`) grows his pieces at his Watering, his ultimate, so off the primary the
   * Watering still comes but every seed that would grow a piece comes up as nothing (the director's call: Eric named the hippo).
   * Each boss's own code reads `noAdd`. docs/decisions/2026-11-20-tower-primary-boss.md.
   */
  addsPieces: ["tiger", "gardener", "timber", "zebra", "sawyer"] as readonly string[],
  apart: [["hollow", "smudgy"], ["smudgy", "alfil"], ["alfil", "grex"], ["dash", "smudgy"]] as readonly (readonly [string, string])[],
  maxBosses: 3,
} as const;

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
   * Ginger's Super Freeze, his second meter (Eric, Nov 18: "another ult meter bar ... it'll probably be around turn like 8 to 15";
   * "up to twice in 60 moves"; docs/decisions/2026-11-18-ginger-super-freeze.md). It fills one step a crowd move, full after a number
   * of crowd moves drawn from the seed in superFreezeEvery (so the first is ready between crowd turns 8 and 15), and comes as the
   * crowd's move lands on the turn it's full (the start of his turn, while he thinks): the crowd's piece whose 3 x 3 holds the most of
   * the crowd's pieces (never the king; ties from the seed), and every one of the crowd's pieces in that 3 x 3 but the king is frozen
   * for the crowd's next turn (the farthest from its middle let go first until the crowd has a legal move). Empty squares in it stay
   * open. At most superFreezeMax a battle; it fills again from empty after each. Never on the blizzard's turns (it waits).
   */
  superFreezeEvery: [8, 15] as readonly [number, number],
  superFreezeMax: 2,
  /**
   * Boingo's pie (Eric, Nov 12: thrown in the face of one of the crowd's pieces whose two squares diagonally behind it are
   * empty; it splits onto those two squares): every pieEvery crowd turns from firstPassive (the next turn when there's no
   * target), the two squares pied for pieTurns crowd turns (nobody, either side, may move onto them; Eric: "just one
   * turn"), up to pieMax pied squares at once (one throw: two). The piece hit gets a splat mark; at pieSplatsToFreeze
   * splats it's frozen for pieFreezeTurns crowd turns (Eric: "2 splats on the same piece make it frozen for a turn") and
   * its mark goes. docs/decisions/2026-11-12-boingo-face-pie.md.
   */
  pieTurns: 1,
  pieEvery: 2,
  pieMax: 2,
  pieSplatsToFreeze: 2,
  pieFreezeTurns: 1,
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
   * little faster (Eric, Oct 11: his ultimate's weak; about twice a game), and 1.2 since his blizzard lasts three turns
   * (Oct 12, by estimate: the second still comes about turn 30). Grex's candle burns for about a third of a
   * battle, so he gets about one and a half (two in a long battle): two full barrages would keep the crowd's half on
   * fire most of the game. Babur (tiger) 1.3 (Oct 24, was 1.6: Eric, "he's ulting so much… 2 to 4 times per game"; his
   * hoops now come after his move): the raid sim's 10 s crowd, 2.55 casts a battle of 44 moves, 3.45 per 60 moves (1.1 gave
   * 1.80 a battle, under 2: his battles are shorter now he keeps his turn; reports/tiger-sim.md). Folio 1.3 (the director's call,
   * Oct 27, after the first sim put it among the easiest; was the brief's start, 1): 2.8 Creases a battle of 50 moves in
   * the raid sim (reports/folio-sim.md). Dash 1 (Nov 3): about 1.9 Time Scrambles a battle of 46 moves in the
   * raid sim with the player's clock, the crowd 0.15 (reports/dash-sim.md).
   */
  rageSpeed: { gingerbread: 1.2, clown: 1.8, grex: 1.2, hollow: 1, bigboy: 1, sawyer: 1.3, alfil: 1.2, smudgy: 1, moo: 1, gardener: 1.2, tiger: 1.3, folio: 1.3, timber: 0.7, dash: 1, zebra: 1, chandy: 1 } as Readonly<Record<string, number>>,
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
   * line, then "+10 s a move from now on" across the board), and from then on each move made in time adds
   * bulletIncrementSeconds to that player's bank: 1+10 (Eric, Nov 16, after playtesting: "instead of 2 seconds, it should go up
   * to 10 seconds per move ... we're essentially nerfing him ... because he's too powerful right now"; it was 1+2).
   * No cap on the bank: it grows by at most this a move, over at most bossMaxMoves moves. Estimates, not sim-tested.
   */
  bulletPlainMoves: 3,
  bulletIncrementSeconds: 10,
  /** The meter glows from this full (0-1) as it nears its ultimate. */
  rageGlowFrom: 0.75,
  /**
   * The test trigger: admins (ADMIN_EMAILS) see a small "Trigger ultimate (testing)" button in any boss battle, which
   * brings the boss's ultimate as the next crowd turn begins (no warning). false removes it everywhere, server too.
   */
  ultimateTestButton: true,
  /**
   * Testing, admins only, Boss alone (Eric, Oct 14): an "Engine move" button (the 🐟) that plays Stockfish's best move for you
   * through the normal move path. false removes it. Nov 2 (Eric: "set that back to Stockfish"): its own search, Stockfish at full
   * strength (no strength limit, one line) over engineMoveNodes nodes and the moves allowed this turn; never Maia's move, never
   * the boss's brain. (Until then it played the top of the judge's ranking from the power-up hints' search: `engineNodes`,
   * 250,000 nodes over eight lines.)
   */
  engineMoveButton: true,
  engineMoveNodes: 1_000_000,
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
   * Grex's fire tiles: a tile burns in fireStages stages, one a crowd turn (a singe, more burn, ablaze); after the
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
   * How many times the Roman candle's fire must reach one of the crowd's pieces to burn it (Eric, Nov 20: "if a piece ... is
   * there when the tile starts burning, ... it just becomes charred, and then if it does it twice, then it disintegrates").
   * Each time short of it, the piece is charred instead (it stays, marked for the rest of the match). 1: it burns the first
   * time, as before. His sparkler's fire still burns at once. docs/decisions/2026-11-20-grex-char.md.
   */
  candleHitsToBurn: 2,
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
   * Hollow's bigger darkness (Eric, Nov 5; docs/decisions/2026-11-05-hollow-bulbs.md), everywhere he plays: on these of
   * his moves (his 6th, 12th and 18th, never one that brings a single cover with darkEvery 3) a 2 x 2 block of squares
   * goes dark for darkBlockTurns crowd turns; on his darkBigAt-th (his 9th), once a game, a 3 x 3 block for darkBigTurns.
   * Placement (chooseDarkBlock): wholly on the board, never on either king's square (so never all of a king's escape
   * squares), holding at least darkBlockMinPieces pieces (the 3 x 3: darkBigMinPieces) when such a block exists. A
   * square already dark keeps one entry, dark until the later of its two ends.
   */
  darkBlockAt: [6, 12, 18] as readonly number[],
  darkBlockTurns: 4,
  darkBlockMinPieces: 2,
  darkBigAt: 9,
  darkBigTurns: 2,
  darkBigMinPieces: 3,
  /**
   * Hollow in Boss alone (settings.hollowBulbs): his strand of darkBulbs bulbs instead of points. Each wrong move into the
   * dark puts one out (no points off, no darkTries cutoff); as the darkBulbForced-th goes out, the dark plays that turn's
   * move for you, a bad one (darkForcedLoss: giving away 15 to 30 points of expected score against the best, the one
   * nearest 22; never more than darkForcedMaxLogit in log-odds, never one whose line lets him mate, never a mate or a
   * stalemate itself, never one that hangs the queen); as the last goes out, the battle is his.
   */
  darkBulbs: 10,
  darkBulbForced: [3, 7] as readonly number[],
  darkForcedLoss: [15, 30] as readonly [number, number],
  darkForcedMaxLogit: 2,
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
   * Big Boy's toy-block tower (Eric, Nov 18; docs/decisions/2026-11-18-bigboy-tower.md): from the crowd's 2nd turn (firstPassive)
   * he tosses a block onto an empty square of the crowd's half that one of its pieces could move to (as his block always did), and
   * as each crowd turn after it begins, one more on the same square, up to towerMax. Nothing slides through it, either side;
   * nothing moves onto a single block; from towerEnter blocks a crowd piece may move onto it (a legal move to its square, never
   * castling), which topples it. At towerMax it wobbles through a crowd turn, then topples by itself as the next crowd turn
   * begins (after his move).
   * His pieces may topple it too, but rarely (Eric, Nov 18: "both but he usually doesn't"): on a towerBossChance share of his
   * turns (seeded, the same on every device) a tower towerEnter tall or more is open to his pieces as well, and he moves onto
   * it only if his engine (or brain) picks that move on its own, no bonus; on the other turns it's closed to him as ever.
   * The topple: towerScatterShare of its blocks (rounded up) scatter to empty squares within towerScatterReach of it (any
   * direction; never onto a piece, never off the board), each drawn in turn with weight 1 / distance^towerScatterPower from the
   * battle's seed, nearest landing first; fewer when there aren't enough; a square that would leave the side to move without a
   * legal move is passed over (the rest of the tower breaks up where it falls). Each blocks as a single block does, through one
   * crowd turn (toppled by the crowd's move: his next turn and the crowd's next; by his piece: the crowd's next turn and his
   * next; by itself: the crowd's next), then they all vanish and a new tower starts at once. Never leaves anyone without a
   * move, never blocks the only way out of check (the blocks lift for that turn).
   */
  towerMax: 10,
  towerEnter: 2,
  towerBossChance: 0.25,
  towerScatterShare: 1,
  towerScatterReach: 3,
  towerScatterPower: 2,
  /** Testing (?boss=bigboy&power=tower): his first tower starts this many blocks tall, so it tops out and topples within a few turns. */
  towerTest: 8,
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
   * Sawyer's Saw Swap (his third power, once a battle; Eric, Nov 20: "one time a game when's in check, he saws the board in half
   * (only triggers if king is on his upper half, so he slices down the whole middle, then his upper half down the center, and swaps
   * the two 4x4 sides to remove his king from check, then he plays a turn"; "just have it trigger anytime whenever it legally is safe
   * to"). On a Battle Tower floor (lone or shared) only with this on (Eric: "Let's have this off by default for now in battle
   * tower"). docs/decisions/2026-11-20-sawyer-saw-swap.md.
   */
  sawSwapInTower: false,
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
   *   carry on) and tries again next turn. At most showdownMax a battle: once (Eric, Nov 20: "make sure in all modes for him he can
   *   only ult once a game then it turns gray"; was 2), his meter then on the bar, empty and dimmed, for the rest of the battle.
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
  showdownMax: 1,
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
   * Chub & Chirp's Pawn Bounce (Eric, Nov 22: "once per game he'll take your pawn that was moved 2 spaces and he jumps it and he hops
   * it back 1 space"): at the start of his turn after the crowd pushes a pawn two squares, before his move (free, as Leapfrog), that
   * pawn knocked back one square, the en passant square with it. At most pawnBounceMax a battle; a push it can't bounce (his king
   * in check, either king attacked after it, a mate in one or a promotion it would hand him, his hop that turn) waits for the next.
   * Solo, online and in the Battle Tower. docs/decisions/2026-11-22-hopper-pawn-bounce.md.
   */
  pawnBounceMax: 1,
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
  /** Toned down Nov 22 (Eric: "2 carrots gives him a pawn with like a 10% chance for a bishop or knight ... 3 ... one knight or bishop
   *  ... 2 queens is too much, it'd just be 1 queen ... 1 carrot, half the time a pawn, half the time nothing";
   *  docs/decisions/2026-11-22-carrot-odds.md). */
  carrotOdds: [
    [{ prize: [], p: 1 }],
    [
      { prize: ["p"], p: 0.5 },
      { prize: [], p: 0.5 },
    ],
    [
      { prize: ["p"], p: 0.9 },
      { prize: ["n"], p: 0.05 },
      { prize: ["b"], p: 0.05 },
    ],
    [
      { prize: ["n"], p: 0.4 },
      { prize: ["b"], p: 0.4 },
      { prize: ["r"], p: 0.15 },
      { prize: ["q"], p: 0.05 },
    ],
    [{ prize: ["q"], p: 1 }],
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
   * repaintNodes) within repaintBand, the nearest repaintTarget; none in the band: the nearest outside it (Nov 7: a
   * warned Repaint always comes). Warned only when a pair exists. At most repaintMax a battle (then his meter is off).
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
  // (Eric, Nov 20: "If it's only 5, it should be like 10 moves probably.")
  fullMoonMoves: 10,
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
  /**
   * No long runs of landings (Oct 25, the director's suggestion after Eric's "none of his pieces are popping… they're not
   * popping as much as I think we had planned": docs/decisions/2026-10-25-tiger-pops.md): after this many of his balloons
   * landed in a row, the next one pops, whatever its roll, unless it's a real queen (which never pops). A pop of any kind
   * (a dud or `nine`) starts the count again. The test switch's balloons (?balloon=) are exempt.
   */
  balloonLandsInRow: 2,
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
  /**
   * Folio's Draft (its passive; docs/decisions/2026-10-27-folio-rules.md): as the crowd's turn after its move begins, from
   * crowd turn draftFirst, every draftEvery turns, an ink mark under one of the crowd's pieces that one of Folio's pieces
   * attacks: a non-king piece that is defended and that no cheaper Folio piece attacks (Folio wouldn't just take it), the
   * most valuable of them (the director's call, Oct 27: was a seeded pick of the top three; seeded among ties only). The
   * crowd has draftWindow of its own moves to end that one attack (move
   * the piece, block the line, take the attacker); if it still stands after them, the piece is folded: frozen for
   * foldTurns crowd turns, by Ginger's freeze's rules (4: the director's call, Oct 27; was 3). One mark at a time; none that qualifies (or a mark still up, or
   * another of Folio's moments that turn): it tries again next turn, and the try doesn't count. draftEvery 4 (this lane's
   * number; Sawyer's cuts' pace): about 9 marks and 5 folds a battle in the raid sim; every 2 turns changed the crowd's
   * score by nothing measurable (reports/folio-sim.md).
   */
  draftFirst: 3,
  draftEvery: 4,
  draftWindow: 2,
  foldTurns: 4,
  /**
   * Folio's Crease (its ultimate, the rage meter's): on the warning's turn its line shows (the engine's pick, made with
   * Folio's move on the position after it, the crowd to move); as the next crowd turn begins the board is creased along
   * it for creaseTurns crowd turns, and none of the crowd's pieces crosses it; Folio's may (the director's call, Oct 27:
   * it folds the board toward itself; otherwise Sawyer's board saw's rules for the crowd's moves). The line: of the
   * 14 inner lines, the one costing the crowd between creaseLossMin and creaseLossMax pawns (its best move with the crease
   * against without, in pawns of log-odds: bouncePawnLogit) nearest the band's middle, seeded among ties; none there, the
   * one nearest creaseLossMin below it, never one costing more than creaseLossMax (1 to 2.5: the director's call, Oct 27,
   * as other ultimates cost about 2; was 0.3 to 1.5). A line leaving the crowd no move, or handing either side a mate in
   * one, never counts. Each line's look: creaseNodes; the host gets creaseTimeMs more for the
   * request that asks for it. How often: rageSpeed.folio.
   */
  creaseTurns: 4,
  creaseLossMin: 1,
  creaseLossMax: 2.5,
  creaseNodes: 20_000,
  creaseTimeMs: 6_000,
  /**
   * Folio's Revision (once a battle, revisionMax): right after a crowd move that punishes Folio's last move (that move
   * cost it at least revisionDrop pawns against its best there, and after the crowd's reply its judged evaluation is at
   * least revisionDrop worse than before that move), both are crossed out: the board goes back to before its move, it
   * plays the engine's best move there, and the crowd moves again. Never after a crowd move that ends the battle, nor
   * before crowd turn revisionFrom.
   */
  revisionDrop: 1.5,
  revisionMax: 1,
  revisionFrom: 5,
  /**
   * Timber's Workshop (his passive, Scraps; Eric, Nov 1; bosses/timber.ts; docs/decisions/2026-11-01-timber.md): one scrap
   * every scrapEverySec seconds (Eric's 15; the cap, the lead guard and the Gnaw's pace are the sim's: reports/timber-sim.md) on the battle's clock (the real-time meter: the server's online, the page's visible time solo),
   * plus scrapsPerCapture for each capture of his. Each goes, at random, to one of the five pieces not yet finished; a piece is
   * finished at its cost (workshopCosts, in scraps). At the end of his turn one finished piece (the first finished that he can
   * have) is dropped onto an empty square of his half that you don't attack; at most workshopDropMax a battle (the sim's), then
   * the workshop closes. A finished slot starts over at 0.
   */
  scrapEverySec: 15,
  scrapsPerCapture: 2,
  workshopCosts: { p: 2, n: 4, b: 4, r: 6, q: 12 },
  workshopDropMax: 2,
  /**
   * A piece drops only while it leaves him at most workshopLeadMax pawns ahead of you on material (pawn 1, knight and bishop 3,
   * rook 5, queen 9): he rebuilds what he lost rather than running away with the battle (the sim's call: free pieces with no
   * limit decided nearly every battle; reports/timber-sim.md). One that would put him further ahead waits on the bench.
   */
  workshopLeadMax: 1,
  /** Timber's Gnaw (his ultimate, the rage meter's: rageSpeed.timber): after his move, one of your pawns eaten, gnawScraps scraps for his workshop. */
  gnawScraps: 8,
  /**
   * The most ultimates a boss has in one battle, by BOSS_ROSTER id (one not listed: no cap). Timber's Gnaw at most twice (Eric,
   * Nov 2: "make it so this beaver only ults up to 2 times a game. After 2 times, his meter just stops charging. Otherwise, it's
   * too strong."): after his second his meter stays empty and dimmed for the rest of the battle, and the admins' trigger is gone.
   * (Smudgy's Repaint keeps its own cap, repaintMax.) docs/decisions/2026-11-02-nov2-fixes.md. Dash's Time Scramble at most twice
   * (Eric, Nov 6: "about twice a game"; his Scramble Rush is his once-a-battle power besides). Chandy's Dodge once (Eric, Nov 16:
   * "He only ults once per game, no matter what").
   */
  maxUltimates: { timber: 2, dash: 2, zebra: 2, chandy: 1 } as Readonly<Record<string, number>>,
  /**
   * Dash's Clock Slap (his passive; Eric's design, Nov 1; bosses/dash.ts; docs/decisions/2026-11-03-dash.md): each capture of
   * his steals time from your clock. On a time bank (Boss alone and a Boss Battle party: BOSS_CLOCK's 10 + 10, the team's one
   * bank in a party) `slapBankSeconds` come off the bank; on a raid's move timer (the Solo raid, a Boss raid) your next move's
   * clock is `slapMoveSeconds` shorter, never under `slapMoveMin` (one slap a move: they don't add up). The calls of
   * docs/decisions/2026-11-03-dash.md; in the sim about 10 slaps a battle took 5 minutes of a 10 + 10 bank, and no player's
   * bank ran out (reports/dash-sim.md).
   */
  slapBankSeconds: 30,
  slapMoveSeconds: 6,
  slapMoveMin: 8,
  /**
   * Dash's Time Scramble (his ultimate, the rage meter's: rageSpeed.dash; Eric's design): after the usual warning, your next
   * `scrambleMoves` moves get `scrambleSeconds` each (a raid's move timer and a bank alike; a bank still pays for them and still
   * gets its increment). Eric's 5 and 3. At most maxUltimates.dash a battle.
   */
  scrambleMoves: 5,
  scrambleSeconds: 3,
  /**
   * Out of time against Dash is never a loss (the brief): nobody picked in time, so a move is played for you at random from the
   * judge's top `flagTop` moves (0: from every legal move). The sim's call: any legal move at random hung a piece too often and
   * decided the battle (reports/dash-sim.md).
   */
  flagTop: 4,
  /**
   * Dash never thinks (Eric's design: "his moves come instantly"): the least he waits before his move shows (ms), where every
   * other boss waits 1200 (bossThinkMs). A queen taken still waits for QUEEN SLAIN!.
   */
  dashThinkMs: 350,
  /**
   * Dash's clock multi-hit (Eric, Nov 7: "every four or five turns, he bangs on it… he hits it like five times… and always says a
   * line"; docs/decisions/2026-11-07-dash-clock.md): every `every` (4 to 5) of his own moves, drawn from the battle's seed,
   * `smacks` (5) quick smacks of the clock at `smackMs` a smack, and always a line about his clock. Was (Nov 6, Eric: "He smacks
   * the clock too much"): one smack a move, and a clock fit at most twice a battle, 3 to 5 smacks, on turns 3 to 30 from the seed.
   */
  dashClockFit: { every: [4, 5] as readonly [number, number], smacks: 5, smackMs: 150 },
  /**
   * Dash's pop-off (Eric, Nov 7: "I gotta pop off for a second, bro", then he smacks it 10 times really fast, then says again how
   * much he loves that clock; Eric, Nov 8: twice a battle, docs/decisions/2026-11-08-dash-popoff-twice.md): twice a battle, on two
   * of his turns from `from` to `to` (drawn from the battle's seed), at least `gap` of his turns apart, before his move lands. Each
   * is `smacks` (3) smacks at smackMs (dashClockFit's) with the pop-off line, `popMs` long; then `hits` (10) fast smacks at `hitMs`
   * a smack with the love line, `loveMs` long. 4.6 s in all: his thinking waits for it, and no one's clock runs meanwhile.
   */
  dashPopOff: { from: 8, to: 20, gap: 6, smacks: 3, hits: 10, hitMs: 70, popMs: 2000, loveMs: 2600 },
  // (His stall skit and his lying-down clock tap, Nov 17: DASH_STALL and DASH_TAP below BOSS_POWERS.)
  /**
   * Dash's Scramble Rush (Eric, Nov 6; bosses/dash.ts; docs/decisions/2026-11-06-dash-v2.md), once a battle: as a crowd turn
   * begins, from turn `from` on, the first time his rage meter is `atMeter` full (Time Scramble's meter: it comes at full). A
   * countdown of `countdownMs` ("1.00" to "0.00"); inside it his copies sweep the board from `scatterAt` for `scatterMs`, moving
   * `pieces` of yours and `pieces` of his (never a king) to empty squares of ranks `ranks`. His line and the God King's
   * (`linesMs`), then `placeMs` to put them back; then the board as it was, and `resultMs` for the verdict. Under `needCorrect`
   * of the six back (online, the crowd's people's mean, its bots' too: each bot puts each back with `botHit`; solo, only your own
   * put-back, no bots, no mean: Eric, Nov 8), he moves again at once (Hollow's quiet extra move; never skipped once due:
   * docs/decisions/2026-11-08-dash-solo-rush.md). The game's position never changes: only what the screens show. Warned a turn ahead as any
   * ultimate is (Eric, Nov 6, playtesting: "there's no warning"): RAGE!, "Next turn: Scramble Rush", then it comes as the next crowd turn
   * begins. In the put-back each swept piece moves at most `movesPerPiece` times (Eric, Nov 6: "you can only move a piece up
   * to 2 times"); a try after that shakes it, "No more tries".
   */
  dashScramble: {
    from: 7,
    atMeter: 0.5,
    pieces: 3,
    ranks: [3, 6] as readonly [number, number],
    countdownMs: 5000,
    scatterAt: 700,
    scatterMs: 3500,
    linesMs: 4000,
    placeMs: 10000,
    resultMs: 2400,
    needCorrect: 4,
    botHit: 0.6,
    movesPerPiece: 2,
  },
  /**
   * Don Dough's Rising Dough (his passive; Eric, Nov 11; bosses/zebra.ts; docs/decisions/2026-11-11-don-dough.md). Early in the
   * battle, at the end of a few of his turns, a lump of dough on an empty square of his half that shows what it will rise as.
   * Its oven timer starts at doughTimers[kind] minutes (Eric, Nov 12: pawn 8, knight and bishop 13, rook 16, queen 21;
   * Nov 11's 4/7/7/10/15 gave too little time to capture: "I meant 4 of our turns"), one off for
   * every move, yours and his; at 00:00 his piece rises there (when the guards allow; else after the next move). A piece of
   * yours landing on it squashes it. The rest is the sim's (reports/zebra-sim.md):
   * - doughDrops a battle at most; the first after crowd move doughFirst (from the seed, in the range), each next one
   *   doughGap of the crowd's moves later (from the seed), none after crowd move doughLast; at most doughLive on the board at once.
   * - What it is: doughOdds (rook and queen rare, Eric), stepping down to a kind he can have now (never a ninth pawn or more pieces
   *   than promotions could make, never past doughLeadMax pawns ahead: below).
   * - Where: an empty square of his half off his back rank; a pawn, knight or bishop on the two ranks nearest the middle, a rook or
   *   queen nearer his side on a file where a pawn of yours stands below it (Eric: "somewhere that's gettable for the pawn"); in a
   *   seeded order.
   * The sim's (reports/zebra-sim.md): with these, 2.1 pawns risen a battle (a queen in 1 in 10), the crowd 0.05 against the plain
   * boss's 0.10.
   */
  doughTimers: { p: 8, n: 13, b: 13, r: 16, q: 21 } as Readonly<Record<"p" | "n" | "b" | "r" | "q", number>>,
  doughOdds: { p: 0.5, n: 0.2, b: 0.2, r: 0.06, q: 0.04 } as Readonly<Record<"p" | "n" | "b" | "r" | "q", number>>,
  doughDrops: 3,
  doughFirst: [1, 3] as readonly [number, number],
  doughGap: [3, 5] as readonly [number, number],
  doughLast: 16,
  doughLive: 2,
  /**
   * Where a lump may go besides (the sim's): "out" of reach of every move the crowd has now (a free squash is no fight), or "any"
   * empty square of the ranks above. And a lump drops only while its piece leaves him at most doughLeadMax pawns ahead of you on
   * material (pawn 1, knight and bishop 3, rook 5, queen 9), as Timber's workshop: he rebuilds rather than runs away with it.
   */
  doughReach: "any" as "out" | "any",
  doughLeadMax: 2,
  /** A queen's lump (rare: doughOdds) comes whatever the lead (Eric: "on occasion, he may throw out a queen"). */
  doughQueenFree: true,
  /**
   * Chandy (bosses/chandy.ts; Eric's design, Nov 15-16: DESIGN.md on branch stills/boss-chandy; docs/decisions/2026-11-16-chandy-rules.md).
   * - **The locks** (L1-L6): none before his first capture; on that move and his next capture (`teachCaptures` 2; Eric, Nov 18) the
   *   crosshair locks onto the piece he takes (his engine's own move; any piece but the king) right before it shows, an upgrade; then at
   *   the end of each of his turns he locks your most capturable
   *   piece, `maxLocks` at most, a second once the first is `secondAfter` of his turns old. A lock hunts for `huntTurns` of his turns,
   *   and lives on to `liveTurns` while the piece is still gettable. His engine is steered within the margins (L3): a capture of a
   *   locked piece within `takeMargin` pawns of his best (by his engine) is played: one of its top `lockLines` moves, or (the hunt,
   *   Eric, Nov 24: "aggressively trying to capture a piece and upgrade, even if it ... is a detriment to him, but not a super
   *   detriment") any trade for one that nets him at least −`huntLoss` pawns by the exchange check, scored against his best; else one
   *   of the top `lockLines` attacking a locked piece (or adding an attacker) within `chaseMargin`. A locked piece that got away (he
   *   can't take it within `huntLoss`) while another can be hunted: its lock goes and the next most gettable piece is locked.
   *   docs/decisions/2026-11-24-chandy-upgrades.md.
   * - **The rifle:** each locked piece he takes is an upgrade (`upgradesMax`), each unlocking one of his five moves at random (the
   *   queen lock first while it could come right then, a queen of yours it can aim at, or with none your best rook (Nov 19):
   *   `queenLockFirst`, Eric, Nov 18); the upgrade window holds everything `upgradeMs` (Eric: 2 s).
   * - **The move meter:** from the first upgrade, full every `meterEvery` of your moves; it fires an unlocked move: a new unlock first,
   *   never the one he fired last while another can come, then the least fired, ties at random (Eric, Nov 18; chandy.ts meterOrder). `fireOnUnlock` (Eric, Nov 16; false turns it off): a new unlock fires on his turn after its upgrade window whatever the
   *   meter says, and the meter starts over (a queen lock that can't come then waits for the meter; one the pass guard refuses, with
   *   nothing else unlocked, is checked again on his next turn). Scatter shot blocks `scatterSquares` squares round a spot (a pick of the top `looks`, as every pick of his below);
   *   shields cover `shieldCount` of his pieces; rapid fire stuns `rapidCount` of yours.
   * - **The Lock-on Shot** (code name `queenlock`; "Queen lock" until Nov 24: it may aim at a rook): as he aims, the piece its round
   *   will most likely hit (the one in front of the target, or the cheapest you can put there) is locked too; the round shattering a
   *   locked piece or the target is an upgrade, as a capture (Nov 24). Its shot (Eric, Nov 20: the piece goes when the round reaches
   *   it): the round flies down the file from his edge, `shotStepMs` a square; the piece it hits stays on the board until the round's
   *   head reaches its square's middle, then shatters.
   * - **Dodge** (his ultimate, once a battle: maxUltimates.chandy; Eric, Nov 16: "He only ults once per game, no matter what"; "It
   *   should fire after he gets all 5 upgrades ... it should be ulting most games"): his rage meter is dimmed until the rifle is whole,
   *   then fills over `dodgeAfterMoves` of your moves (nothing else fills or drains it); full, the usual warning, then Dodge as your
   *   next turn begins. Eric, Nov 16: 1 (was 3): "It should come a turn later, he should say something about preparing yourself, and
   *   then after you move it begins." **Last chance** (Eric, Nov 16): as your turn begins, if he hasn't used it and you have a move that mates him,
   *   Dodge comes now, whatever his rifle or meter (the warning with it); you may still play the mate after. First the warning volley
   *   (Eric, Nov 16: "an additional shot first that you can't move"): the clones fire once on lines that miss your king, no vote, then
   *   "Dodge the next one!" (`dodgeVolleyMs` in all, the clones aiming `dodgeAimMs` first). Then `dodgeRounds` rounds, each a
   *   `dodgeVoteMs` vote (and the server's `dodgeGraceMs` for lag), the clones teleporting at `dodgeTeleports`' times into each round's
   *   vote (the last always 1.2 s before it closes: a unit test); LOCKED (`dodgeLockedMs`), then the beams travel from the clones'
   *   muzzles across the board (`dodgeTravelMs` each, `dodgeStaggerMs` apart) and hold (`dodgeHoldMs`) before the next round.
   *   `dodgeHits` hits lose: the first cracks your king and play goes on; the second, the beams keep hitting him (`dodgeKillMs`), he
   *   shatters (`dodgeShatterMs`), then the result. A bot finds the safe square with `dodgeBotHit`'s chance.
   * The sim's (reports/chandy-sim.md).
   */
  chandy: {
    maxLocks: 2,
    secondAfter: 2,
    huntTurns: 3,
    liveTurns: 5,
    lockLines: 5,
    takeMargin: 2,
    chaseMargin: 0.75,
    huntLoss: 1,
    upgradesMax: 5,
    upgradeMs: 2000,
    teachCaptures: 2,
    queenLockFirst: true as boolean,
    meterEvery: 6,
    fireOnUnlock: true as boolean,
    shotStepMs: 65,
    looks: 3,
    scatterSquares: 4,
    shieldCount: 2,
    rapidCount: 3,
    dodgeRounds: 3,
    dodgeHits: 2,
    dodgeVoteMs: 3000,
    dodgeGraceMs: 300,
    dodgeTeleports: [[1200], [900, 1600], [800, 1400, 1800]] as readonly (readonly number[])[],
    dodgeScopeMs: 600,
    dodgeSlideMs: 600,
    dodgeVolleyMs: 3600,
    dodgeAimMs: 400,
    dodgeOpenMs: 400,
    dodgeLockedMs: 600,
    dodgeTravelMs: 500,
    dodgeStaggerMs: 150,
    dodgeHoldMs: 2500,
    dodgeKillMs: 5000,
    dodgeShatterMs: 1000,
    dodgeBotHit: 0.6,
    dodgeAfterMoves: 1,
  },
  /**
   * Birdie (Eric, Nov 23; packages/chess/src/bosses/birdie.ts; docs/decisions/2026-11-23-birdie-rules.md):
   * - The Train: as crowd turn `trainFrom` begins (2: at the end of his reply to your first move) he warns a rank or file where
   *   exactly one of your pieces stands (any piece, your king too; one your move can save: it has a move, and the smash would be
   *   legal now); then `trainEvery` crowd turns from one warning to the next (Eric: "a 3 (6 total turn) turn cooldown"). No line
   *   fits: it waits a turn. Your next move moves that piece, or at the start of his turn his train rides the line and smashes it
   *   (your king: the battle is his). The judge counts a piece left there as gone: its value at `trainPawnLogit` log-odds a pawn
   *   (the fire's way, firePawnLogit), your king as the battle lost.
   * - The Fall, once a battle: at the start of his turn once he has lost `fallLost` points of material since the battle began
   *   (P1 N3 B3 R5 Q9: the most he has been down), his fall and its cutscene (BIRDIE_CINEMATIC), then Armored Birdie for the rest of
   *   the battle.
   * - Armored Birdie (Eric, Nov 23: "He still uses his same normal move after. He just does it every 3 to 4 turns ... we turn up the
   *   Maya to a much stronger level"): the train goes on, `armoredTrainEvery` crowd turns from one warning to the next; and his brain
   *   jumps: Maia `armoredMaiaBoost` higher, held at Maia's top; already at Maia's top (Very hard), Stockfish at
   *   `armoredStockfishAbove` over the level Maia's top stands for (core levelForMaia); a battle he already plays on Stockfish, its
   *   strength `armoredMaiaBoost` higher (held at ENGINE_MAX_ELO). The judge and fair play don't read his strength: unchanged.
   * - His train's ride across the board: BIRDIE_RIDE.
   */
  birdie: {
    trainFrom: 2,
    // (Eric, Nov 25: "Birdie's normal move is coming too often ... about double it ... maybe once every 4 to 5 turns": was 3.)
    trainEvery: 5,
    trainPawnLogit: 1,
    fallLost: 9,
    armoredTrainEvery: 3,
    armoredMaiaBoost: 400,
    armoredStockfishAbove: 100,
  },
} as const;

/**
 * Bosses in the game for admins first (Eric, Nov 1: Timber "admins first"): complete and playable, but only an admin meets
 * them (the boss select, Boss alone and a Solo raid), until Eric says go. **To put one live for everyone, take its id out of
 * this list** (core boss.ts's `adminFirst`; nothing else changes).
 */
// (Nov 13: "recluse", the Hidden Boss, was here for a day, so his walk-up was an admin's only; Eric, Nov 13: "It doesn't need to be admin
// only... the site is behind Cloudflare": out again, his building, rooms and challenge for everyone signed in. His Boss Battle tile
// stays locked: he's `adminOnly` in the roster, met only from his room and the Crowd's final.)
// (Nov 16: "chandy": his home, Chandy's Swamp, came first, in an admin's town only, as Timber's and Dash's did; then his rules
// (docs/decisions/2026-11-16-chandy-rules.md): in the roster now, an admin's in every mode until Eric says go.)
// (Nov 23: "birdie": his rules, art and the fall's cutscene wiring, his armored power and the cutscene's art still to come: an admin's
// in every mode until Eric says go, as Chandy.)
export const BOSS_ADMIN_FIRST: readonly string[] = ["timber", "dash", "zebra", "chandy", "birdie"];

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
 * Dash's stall skit (Eric, Nov 17: "once a game if you take more than 30 seconds to move… he smacks the shit out of the clock for 5
 * seconds… then at 30 s is when he fake plays… nahh jk bro and he moves his piece back"; docs/decisions/2026-11-17-dash-stall.md).
 * Once a battle, on a crowd move nobody has finished yet: the slam at slamSeconds of the move's clock (on a bank: Boss alone, a
 * Boss Battle party) or slamShare of the move's clock (a raid's or a group battle's move clock, 20 s: the director's call, Nov 17),
 * `slamMs` of hard clock slams; then his fake second move at fakeSeconds or fakeShare, held landMs + bragMs + jkMs + backMs (his
 * move lands, his brag, "Nahh, jk bro", it slides back). The move's clock stands still through both, for everyone (measured on
 * the move's own clock, the pauses left out); the board takes no move during the fake move's hold. Not on a move whose clock
 * can't reach the fake move with marginMs to spare. Until the fake move has come, it stays armed for a later move (the
 * director's call). `test`: ?power=stall's beats (ms of the move's clock).
 */
export const DASH_STALL = {
  slamSeconds: 20,
  fakeSeconds: 30,
  slamShare: 0.5,
  fakeShare: 0.75,
  slamMs: 5000,
  landMs: 450,
  bragMs: 2100,
  jkMs: 1600,
  backMs: 450,
  marginMs: 2000,
  test: { slamAt: 1500, fakeAt: 3500 },
} as const;

/**
 * Dash's lying-down clock tap (Eric, Nov 17: "once per game he goes down laying down with his chess clock by your clock… and starts
 * tapping it"; a bored "hurry up", so only when you're slow: "it fired off like 5 seconds into the match even tho I played all my
 * moves instantly"): once a battle, from crowd move `fromMove`, as a move of yours runs `afterMs` of a bank's clock (Boss alone, a
 * party) or `afterShare` of a move clock (a raid, a group battle: 6 s of 20); timed with his stall skit's beats (stallPlan), never on
 * its move ("the bigger gag is reserved for another turn"). He lies by your clock until you move ("stay in the crawl position"),
 * `boredMs` after lying down still no move: his "not moving till you do" line; your move before he's down: his crawl still
 * finishes, his "just a joke" line, `jokeMs`, then up. Your clock keeps running as ever. His taps tick aloud for the first `tapMs`
 * after he's down, then go silent (he keeps tapping). Never with less than DASH_STALL.marginMs of the move's clock left after it.
 * Only the players still thinking see it: a player who already moved never does (their pick gets him up).
 */
export const DASH_TAP = { fromMove: 3, afterMs: 10_000, afterShare: 0.3, boredMs: 20_000, jokeMs: 1800, tapMs: 3000 } as const;

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

/**
 * The Hidden Boss's first form, the child (Eric, Nov 12-13; docs/decisions/2026-11-13-hidden-boss-child-form.md): no powers
 * (no "No help", no bullet clock; he never strikes, as his adult form), a kid's lines, and a brain that grows with the game.
 * - **His strength:** Maia, raw (his adult form's brain), at `startRating` for his first moves, `stepRating` more every
 *   `everyPlies` moves on the board (both sides' moves: Eric's "every 4 moves (all moves)"), up to Maia's top rating in our
 *   setup (core `maiaTopRating`: 2500, BOSS_BRAIN.maiaRating's last point), which is his adult form's own: the child at the top
 *   plays as the man does. 1800 to 2500: seven steps, the last after 28 moves on the board (his 14th move).
 * - **He grows:** `ages`, the Maia rating from which each drawing shows (`recluse-ages.ts`): about 9, 13, 20 (the black suit),
 *   then his adult look, the last at the top (a test checks), so the child at his strongest is the man you meet next.
 * - **Beaten** (by mate, or the admins' "Win this form"): his line, then he grows up into the man (`fallMs` in all), and a new
 *   match starts from the starting position against his adult form (today's phase 1), solo and online (RECLUSE_FORMS). A draw
 *   or a loss ends the fight, as his adult form's does.
 */
export const RECLUSE_CHILD = {
  startRating: 1800,
  stepRating: 100,
  everyPlies: 4,
  ages: [1800, 2000, 2200, 2500],
  /**
   * Beaten: his line first, then he grows up into the man at `growUpAt` ms into his fall (about 2.3 s), the fall `fallMs` in all.
   * 7.5 s since Nov 14 (was 4.2 s): the man answers the kid once he's grown, about 3.5 s in (Eric: "there was no conversation"),
   * and his longest answer types out by about 5.2 s and stays readable 2.3 s before the man's match starts (a test checks).
   */
  growUpAt: 1200,
  fallMs: 7500,
} as const;

/**
 * The Hidden Boss's forms, in the order his fight meets them (Eric, Nov 13: "it plays through till the end";
 * docs/decisions/2026-11-13-recluse-online-phase2.md). Each one beaten brings the next; the last beaten is his defeat.
 * `child`: his first form (RECLUSE_CHILD: no powers, his strength growing with the game; beaten, a new match against the man);
 * `adult`: his phase 1 (Bullet, No help, his chatter); `four`: his phase change and the four boards (RECLUSE_PHASE2).
 * Where he's fought (his room's fight: hiddenRoomSettings; the Crowd's boss final: modeSettings("crowd"); solo), `child` first here
 * starts his fight as the child (`recluseChildFirst`, the settings' `recluseChild`).
 */
export type RecluseForm = "child" | "adult" | "four";
export const RECLUSE_FORMS: readonly RecluseForm[] = ["child", "adult", "four"];
/** His fight starts as the child: his forms (RECLUSE_FORMS) begin with it. The settings' `recluseChild` where he's fought. */
export const recluseChildFirst = (forms: readonly RecluseForm[] = RECLUSE_FORMS): boolean => forms[0] === "child";
/** The form his fight meets after `form` (null: `form` is his last, or isn't in his fight). */
export function recluseNextForm(form: RecluseForm, forms: readonly RecluseForm[] = RECLUSE_FORMS): RecluseForm | null {
  const i = forms.indexOf(form);
  return i >= 0 ? (forms[i + 1] ?? null) : null;
}

/**
 * The Hidden Boss's cutscene between his adult form and the cyborg (Nov 12; `components/RecluseCutscene.tsx`): after his fall,
 * before his phase change, solo and online (Nov 13). Eric: everything dims and a soft-edged spotlight shines on the board's middle; his ghost as a
 * child poofs into being above the board, drops and lands; then the 17 lines, each its own text box by its speaker,
 * typed out, a line of two sentences typing the first, holding about a second, then the second; each box up long enough
 * to read ("err on the slow side"); after the last, the child fades. Times in ms.
 */
export const RECLUSE_CUTSCENE = {
  /** Everything dims and the spotlight comes up over this long. */
  dimMs: 1000,
  /** How dark the dimmed screen is outside the light (0 to 1). */
  dimAlpha: 0.86,
  /** The light's radius, a share of the board's width: fully lit inside `spotInner` of it, then a soft fade to the dark. */
  spot: 0.4,
  spotInner: 0.45,
  /** The child poofs in this long after the light is fully up. */
  poofAfterMs: 600,
  /** The first line this long after he has landed and straightened. */
  firstLineAfterMs: 600,
  /** Typing: a character every `typeMs` (the game's lines type at 28: slower here, to read along). */
  typeMs: 45,
  /** Between the two sentences of a line: the first typed, then this pause, then the second. */
  sentencePauseMs: 1000,
  /** Once typed, a box stays fully readable `readMs` plus `perCharMs` a character, at most `maxReadMs`, then fades. */
  readMs: 1700,
  perCharMs: 40,
  maxReadMs: 5500,
  /** A box's fade, and the quiet between it and the next box. */
  boxFadeMs: 260,
  gapMs: 400,
  /**
   * After the last box has gone, his phase change carries on from the scene this much later (Eric, Nov 14: his transformation,
   * the book at his feet opening, the man and the child still in the light).
   */
  endAfterMs: 400,
  /**
   * Online (claude/recluse-online-phase2): after his fall the server holds this long for the scene, telling everyone when it
   * starts (`recluseCutscene`), then his phase change starts for everyone at once. The scene's whole length (the app's
   * `recluseCutsceneTimeline().endAt`: a unit test keeps the two equal; change it with the lines or the times above).
   */
  holdMs: 107_480,
} as const;

/**
 * Moo & Moon's Full Moon cinematic (Eric, Nov 17: "the game pauses, he jumps down onto the center of the board, then the board
 * and everything above it like the boss bar, is replaced with a singular cinematic drawing of a field of grass with a starry
 * night and a giant moon… a super close up of moo and moon from a side profile angle staring up at the moon… their eyes start
 * turning white, then it goes back to the first scene and this is where he does the transformation, then the background fades
 * and then once it fades he hops back to his spot"; components/MooCinematic.tsx; docs/decisions/2026-11-17-moo-cinematic.md).
 * It plays at the start of his turn, while he thinks (no clock runs for the crowd), so its whole length is his Full Moon's
 * (MOO_BEATS.fullMoon in packages/chess/src/bosses/moo.ts adds the beats up, his transformation's own length among them: the
 * server and solo wait that long). Beats in order, ms:
 */
export const MOO_CINEMATIC = {
  /** He hops from his spot onto the board (his `move`: a crouch, the hop, the landing; at least its 710 ms). */
  hopMs: 720,
  /** The field fades in over the board and everything above it (a CSS fade). */
  fadeInMs: 500,
  /**
   * The field holds, him standing in it, before the cut to the close-up (Eric, Nov 19: "about 2 more seconds": 700 → 2700; Nov 20,
   * the moon coming down and bursting into light: "four seconds for that first part, or 5 seconds": 2700 → 5000).
   */
  fieldMs: 5000,
  /**
   * The moon rising (Eric, Nov 20: "the moon should start half hidden behind the horizon/grassy hill and then move upward into the sky
   * for a few seconds (same timing as is now), moon should never be in front of the background hill terrain"; it came down like a
   * meteor before that day's second change): the field's own moon, lifted, behind the field's hills, barn and grass (one picture,
   * characters/moo-field-layers.png: the sky without its moon, the front, the moon), from the field fading in to the
   * cut, `scale` times the field's and `y` art pixels below the field's moon, from `moonFrom` (its middle on the hill line, half
   * hidden) to `moonTo` (the field's own moon's place: the field after the close-up is the same picture), easing out as it rises (its
   * progress 1 − (1 − p) to the power `moonEase`).
   */
  moonFrom: { scale: 1, y: 57 },
  moonTo: { scale: 1, y: 0 },
  moonEase: 1.6,
  /**
   * Then the Hidden Boss's light (components/recluse-light.ts, Eric: "the same way the light looks there, because it looks perfect"):
   * the moon starts glowing `glowMs` before the cut, its rays radiate over the whole screen from `radiateMs` before it, the white
   * covers the whole screen from `whiteMs` before it, whole at the cut.
   */
  glowMs: 2600,
  radiateMs: 1500,
  whiteMs: 700,
  /**
   * The close-up comes in out of that light: whole white for `lightHoldMs`, then the light dies back into the moon's side (above
   * them, to the left) by `lightMs` into the close-up, its rays still falling on them. A wash of it on the two of them (`lit`, its
   * strength) eases from `from` to `to` as their eyes turn white (by `whitenAt` + 4 × `eyeStepMs`) and holds.
   */
  lightHoldMs: 120,
  lightMs: 3000,
  lit: { from: 1, to: 0.45 },
  /** The close-up of the two of them looking up at the moon, the cuts to it and back included (Eric, Nov 19: 2 s longer: 2200 → 4200). */
  closeMs: 4200,
  /** The cut to the close-up and back: a quick crossfade, each way, inside `closeMs`. */
  cutMs: 160,
  /**
   * Into the close-up, their eyes start turning white (`eyeStepMs` a step, four steps), then hold white and glowing. Eric, Nov 19: "it
   * should start with their eyes being like normal and then fade ... turning into the glowing ... right now it's just very quick":
   * normal for 1.2 s (was 0.9), then 4 steps of 0.55 s (was 0.22), glowing from 3.4 s to the cut back.
   */
  whitenAt: 1200,
  eyeStepMs: 550,
  /** (His transformation in the field: his `fullMoon` animation's own length, MOO_BEATS.fullMoon.transformMs.) */
  /** After the transformation, he stands powered up in the field a moment. */
  afterMs: 400,
  /** The field fades out (a CSS fade). */
  fadeOutMs: 500,
  /** He hops back to his spot (his powered `move`). */
  hopBackMs: 720,
  /**
   * His thinking lasts this much past the cinematic's end (fullMoonMs, solo and the server): a late first frame on a device or its
   * move arriving sooner than its thinking did never cuts the hop back (review of #776, #6). Inside his thinking: no player's time.
   */
  tailPadMs: 200,
  /**
   * Seen first with his thinking already under way (a reload or a late join: the round resent as the device rejoins), the cinematic
   * is skipped and he's drawn powered at once: started then, his move would cut it off (review of #776, #2). How soon after the
   * device rejoins a Full Moon counts as resent.
   */
  rejoinMs: 1500,
} as const;

/**
 * Birdie's train on a ride (packages/chess/src/bosses/birdie.ts, BIRDIE_BEATS.ride): `rideMs`, how long it takes to cross the board, from
 * one edge to past the other. The smash as its nose reaches the piece, the pieces stepping aside, his return and the result's hold all
 * follow it, solo and online. Eric, Nov 23: "His attack train move should slow the train a bit down when it moves across the board":
 * 1300 -> 1950, about 1.5x as long (docs/decisions/2026-11-23-birdie-cadence-warning.md). His ride's run (`trainLong` in
 * birdie-sounds.ts) is paced to it (its RIDE_PACE; a unit test keeps the two together).
 */
export const BIRDIE_RIDE = { rideMs: 1950 } as const;

/**
 * Birdie's warning sign on the marked piece (components/Birdie.tsx WarnSign, `.bd-sign`): how long one blink takes, ms, shown half of it
 * and hidden half, hard on and off with no fade. Eric, Nov 24: "it simply like blinks on and off ... it doesn't need to do a fade even.
 * It just blinks every like ... second or second and a half" (docs/decisions/2026-11-24-birdie-train-miss.md): 0.6 s on, 0.6 s off.
 */
export const BIRDIE_SIGN = { blinkMs: 1200 } as const;

/**
 * Birdie's fall (Eric, Nov 23: "A cinematic like Moo's Full Moon: it takes the same space on screen as Moo's, about 6 to 7 s long. A cut
 * to a close-up: he falls out of his spot on the board… he tumbles through the air like a bird falling from a great height… the
 * background is blurred, with wind and speed lines… a train track comes into view below, and his own train barrels toward him…
 * its headlights get brighter and brighter as it nears… It hits him, and he transforms"; components/BirdieFall.tsx;
 * docs/decisions/2026-11-23-birdie-fall.md). It plays at the start of his turn, while he thinks (no clock runs for the crowd), so its
 * whole length is his fall's (BIRDIE_BEATS.fall in packages/chess/src/bosses/birdie.ts adds the beats up: the server and solo wait that
 * long). Beats in order, ms:
 */
export const BIRDIE_CINEMATIC = {
  /** His `fall` where he stands: a happy hop up out of the train, then he drops out of the frame (his animation's own 830 ms). */
  dropMs: 840,
  /** The scene fades in over the board and everything above it, as Moo's field does (a CSS fade). */
  fadeInMs: 400,
  /** He free falls happily through the air (Eric, Nov 23), the sky streaking past (the drawing's `fall`, 600 ms a loop). */
  tumbleMs: 900,
  /**
   * His train comes up the track toward him (the drawing's `approach`, 390 ms a frame), its headlights brighter and brighter, to its last
   * frame (the hit, its `hit` cue at 3120 ms) and `hitHoldMs` of it; the light whole then.
   */
  approachMs: 3120,
  hitHoldMs: 200,
  /**
   * The headlights' light (the Hidden Boss's, components/recluse-light.ts, as Moo's moon's: Eric, "how we did the lights"): glowing from
   * `glowMs` before the hit, its rays over the whole screen from `radiateMs` before it, the white from `whiteMs` before it, whole at the
   * hit; held `lightHoldMs`, then dying back over `lightMs` as Armored Birdie stands in the steam.
   */
  glowMs: 2100,
  radiateMs: 1100,
  whiteMs: 450,
  lightHoldMs: 120,
  lightMs: 800,
  /** Armored Birdie's reveal (the drawing's `reveal`: the steam clearing off him, 1200 ms), then `holdMs` of him standing (`hold`). */
  revealMs: 1200,
  holdMs: 500,
  /** The scene fades out (a CSS fade); he's in his spot as Armored Birdie. */
  fadeOutMs: 400,
  /** His thinking lasts this much past the cutscene's end (as MOO_CINEMATIC.tailPadMs). */
  tailPadMs: 200,
  /** Seen first with his thinking already under way (a reload, a late join): skipped, drawn armored at once (MOO_CINEMATIC.rejoinMs). */
  rejoinMs: 1500,
} as const;

/**
 * His ultimate's music and its timing (Eric, Nov 23, via the music helper: "Birdie doesn't play his move right away. He basically times his
 * next move to the exact moment where ... the end of that little ... clip ... right when the train light kind of hits and then he
 * transforms"; docs/decisions/2026-11-23-birdie-ult-timing.md; public/music/README.md, "Birdie's theme and his ult's piece"). His fall's
 * moment starts as the crowd's move that filled his meter lands (after QUEEN SLAIN! if it took his queen: birdieLeadMs); from it, ms:
 * - `pieceAt`: his ult's piece (themes.json's `theme`, "the crossing") starts, the battle's theme fading into it (MUSIC_SWITCH): a beat
 *   after the moment starts, so a device starting it at once is never late for it.
 * - `introMs`: the piece's length to its drop (themes.json's `introSeconds`, 14.814813 s: a test keeps the two the same). The drop, his
 *   theme from its top, lands on the train's impact (the cutscene's last `approach` frame, its `hit` cue), so the impact is at
 *   pieceAt + introMs (BIRDIE_BEATS.fall.impactAt), and his cutscene starts that long before it (its fall in his spot, the fade-in, the
 *   tumble and the approach: BIRDIE_CINEMATIC). The impact, his transformation and his theme's first hit land together.
 * - `lineAt`: his line, as the piece's first whistle sounds (its `whistle` mark, 1.48 s in), long before the cutscene.
 * His reply waits for all of it (his thinking holds through the cutscene: birdieTurnMs), the crowd's clock stopped (it's his turn), the
 * same on every device, with or without the music. Once a battle (the fall is).
 * - `soloMoveLeadMs`: solo asks its engine for his reply only this long before his thinking's hold ends (a kept game holds his move
 *   once it's played, so a reload in his wait would skip to it): a reload until then carries the wait and the cutscene on.
 */
export const BIRDIE_ULT = { theme: "birdie-ult", pieceAt: 300, introMs: 14815, lineAt: 1780, soloMoveLeadMs: 2500 } as const;

/**
 * How often Birdie chirps (Eric, Nov 24: "I think he's doing a little too much chirping and the train noises. Let's really make it so he
 * can chirp at the start of the game, and I would say cap the chirping to, you know, maybe once every 5 of his moves at most";
 * docs/decisions/2026-11-24-birdie-train-miss.md; was [3, 4], Nov 23). His hello at the battle's start, then one chirp on his first move and
 * then this many of his moves apart, in turn (5: his 1st, 6th, 11th ...), counted by his move's number, so every device hears the same
 * moves. On such a move, one chirp: his move's own (a capture's trill, a check's teeoo, else the nod). The other moves: only the board's
 * own move sound. His train's whistles and horns only on his ride; his victory, defeat and fall unchanged (kits.ts, birdieCue).
 */
export const BIRDIE_SOUND_EVERY: readonly number[] = [5];

/**
 * His phase 2 online (Nov 13; docs/decisions/2026-11-13-recluse-online-phase2.md): the lobby server runs the four boards
 * (packages/server/src/bosses/recluse.ts). His moves come from the engine server alone, never a player's device and never a quick
 * move (Eric, Nov 13: "we can't have him breaking"; docs/decisions/2026-11-13-recluse-server-only.md). The bots' from the host's
 * device first (it chooses them, checked only for legality, as phase 1's bot picks: accepted, the delta review of #683, m3), the
 * engine server where no device answers, the server's own quick move where neither does; a person's fair-play numbers from fair
 * play's own instance of the engine server: so the engine server's queue holds his moves (the review of #683, M1). Phase 1's moves of
 * his that no device answered come from the engine server too (`serverWaitMs`, the tries: docs/decisions/2026-11-13-recluse-phase1-
 * pause.md).
 * - `changeMs`: his phase change's length on every screen, from its start to the boards (the app's PHASE_CHANGE.total: a test
 *   keeps the two within 300 ms); the clocks start `RECLUSE_PHASE2.change.countdownSeconds` after it.
 * - `groupNodes`: the engine server's search per group of moves (every legal move scored, at most 8 a search: its limit), so one
 *   move of his (about five groups) searches less than one judge's re-check.
 * - `searchMs`: the most one try at a position may take on the engine server, all its groups together (then it's no answer, and
 *   tried again): a try's worst case, so a try never goes out while an earlier one could still be running (one lost on the way is
 *   tried again only past this, plus a margin).
 * - `botLoss`: a bot's move is one of those within this much of the best (expected score, 0 to 1), at random: a bot's strength,
 *   never his (he plays the best).
 * - `askMs`: how long the host's device has to play a bot's move; then the engine server's (where it can't: the quick move).
 * - `pauseMs`: his move not in this long after it was asked (an answer usually takes about a second: five groups of 120,000 nodes
 *   at about 0.8 million a second, an estimate): every board's clock pauses, and every board shows "He's thinking…", until it is.
 * - `retryMs`, `retryMaxMs`: a search of his that came back empty is tried again after `retryMs`, then twice as long each time, at
 *   most `retryMaxMs` apart (one lost on the way, no answer in `searchMs` plus 5 s: at once).
 * - `serverWaitMs`: his move not in this long after it was asked: the fight ends with no result ("the Hidden Boss couldn't
 *   connect"); nothing counts for or against those who played its boards (everyone else's result stands). In phase 1 (his move no
 *   device answered in its window, asked of the engine server; `retryMs`, `retryMaxMs` and `searchMs` the same), counted from that
 *   ask: nothing counts for or against those fighting him then. His turn is the pause there: nobody's clock runs on it.
 * His searches are never refused for the engine server's day budget (ENGINE_DAILY_SEARCHES): they're bounded by the fights. Each
 * position is counted once on his own row ("<day>:recluse", the health view), whatever its tries. A long fight is about 150 of his
 * (four boards, about 40 moves each); each searches about a third of one re-check's nodes.
 */
export const RECLUSE_ONLINE = {
  changeMs: 23_700,
  groupNodes: 120_000,
  botLoss: 0.06,
  askMs: 6000,
  pauseMs: 3000,
  retryMs: 1000,
  retryMaxMs: 8000,
  serverWaitMs: 60_000,
  searchMs: 15_000,
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
   * Each player's bank on each board (s), no increment, nothing adds time; out of time loses that board (Eric, Nov 16: 10 minutes,
   * was 2:00). His own moves take no time from it (he has no clock, as in phase 1).
   */
  bankSeconds: 600,
  /**
   * Each player's hearts (Eric, Nov 16: "everyone actually needs their own"; "Let's just call it 8", a column of 8 at each board's
   * right; he also said 10: one number here). A move that takes longer than `slowMoveSeconds` (what players are told) has one of
   * that player's hearts cut as it turns slow, judged with `slowAllowMs` more for lag, never shown or said (the server's clock
   * online: a move slow at 6.5 s from when the board became theirs). After the cut they may take as long as they need on that move
   * (their clock runs; nothing is played for them). The last heart cut, their board is lost; the others play on.
   */
  slowMoveSeconds: 5,
  slowAllowMs: 1500,
  hearts: 8,
  /**
   * A heart cut on screen (ms from the cut, Eric, Nov 16): his blade drawn back, slow (`windMs`), then a fast follow-through across
   * the heart, its halves sliding apart and fading (`ms` in all; the sound's swish at `windMs`: recluse-sounds.ts SLASH_CUT_S). No
   * flash (Eric: photosensitivity). A board whose last heart it was then fades to grey over `greyMs`, "TOO SLOW" over it.
   */
  slash: { windMs: 520, ms: 1400, greyMs: 2600 },
  /**
   * The bots on the other boards (Boss alone's, or a solo Crowd's finalists beside you): Stockfish at this strength, this
   * many nodes, within `botMoveMs`.
   */
  botElo: 2200,
  botNodes: 100_000,
  /** A bot's thinking per move (ms, its own clock running): a random time in this range, as a bullet player's. */
  botMoveMs: [900, 2600] as readonly [number, number],
  /**
   * Now and then (this share of its moves) a bot thinks longer, `botSlowMs` (past `slowMoveSeconds` and its allowance), and loses a
   * heart as you would: a few a board, all of them hardly ever (Nov 16: at 5% a 40-move board loses about 2, a 60-move one 3; all 8
   * about 1 in 1,400 and 1 in 100).
   */
  botSlowChance: 0.05,
  botSlowMs: [7000, 9000] as readonly [number, number],
  /** Once every board is decided: how long his reaction holds the boards before the result screen (ms). */
  endMs: 3200,
  /**
   * The phase change's pace (Eric, Oct 17, after playing it: "everything's perfect, but it happens way too fast"): about
   * 10 s more from the mate to the split, the animations themselves unchanged, then a countdown before the clocks
   * (packages/app/src/recluse-phase2.ts, PHASE_CHANGE; docs/decisions/2026-10-17-phase-change-pace.md).
   */
  change: {
    /**
     * His transformation (Eric, Nov 14; docs/decisions/2026-11-14-recluse-transformation.md). The phase change starts as the book at
     * his feet opens, 400 ms after his cutscene's last box is gone; the transformation theme's intro starts `musicAtMs` into it (so a
     * device a moment late to the phase change still plays the whole intro, its drop on the split), and every beat here is ms from
     * the intro's start (`introMs` after it, the music's drop, the board cracks): the light takes him on the music's slam (`burstAt`: his eyes go white) and lifts him on its build (`riseAt`, for
     * `riseMs`); it grows, shoots up off the screen (`shootAt`), radiates in every direction (`radiateAt`), whites out the screen
     * (`whiteAt` to `whiteFull`; unseen, his final form), holds, and dies back into the center (`downAt` to `revealAt`), his face
     * showing; his first line (`line1At`); he leaps on the music's breath, a second before
     * the drop (`leapMs` of hang time), and lands as the board cracks; his second line `line2AfterMs` after the crack.
     * `introMs` is `recluse-phase3`'s introSeconds (public/music/themes.json; a test keeps them equal).
     */
    transform: {
      musicAtMs: 300,
      introMs: 17_435,
      burstAt: 2640,
      riseAt: 3040,
      riseMs: 1900,
      shootAt: 5600,
      radiateAt: 6300,
      whiteAt: 7300,
      whiteFull: 8000,
      downAt: 8700,
      revealAt: 10_000,
      line1At: 10_600,
      leapMs: 1000,
      line2AfterMs: 800,
    },
    /**
     * How his chant's lines type and hold (Eric, Nov 13: the cutscene mockup's pace, its RECLUSE_CUTSCENE numbers; "err slow"):
     * a character every `typeMs`, `sentencePauseMs` between a line's two sentences, then fully readable `readMs` plus
     * `perCharMs` a character (at most `maxReadMs`), its fade `fadeMs`. Their times: `transform`'s `line1At` and `line2AfterMs`.
     * The first line types faster (`firstTypeMs` a character, Nov 14 review): the music fixes its window (the reveal to the leap),
     * and its box stays up through the crouch until he leaps, so it's readable whole about 2.8 s.
     */
    chantLines: { typeMs: 45, firstTypeMs: 30, sentencePauseMs: 1000, readMs: 1700, perCharMs: 40, maxReadMs: 5500, fadeMs: 260 },
    /** The boards split and set: a big 5, 4, 3, 2, 1 on every board before phase 2's clocks run (s). */
    countdownSeconds: 5,
    /** Beaten where his phase change follows: the board holds this long while he collapses (ms; solo and online). */
    fallMs: 1800,
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
/**
 * The result screen's conversation after a Last Stand (Eric, Nov 8): the boss says its line above him, and once it has typed out
 * it stays `bossHoldMs` more and fades; then the God King answers above him. Never both together.
 */
export const RESULT_TALK = {
  bossHoldMs: 1200,
  /** If the boss says nothing, the God King speaks after this long (ms from the result). */
  kingAfterMs: 3000,
} as const;

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
 * Power tips (packages/app/src/power-tips.ts): the first time you see a boss's power, he and the God King trade a line or two
 * explaining it. Eric, Nov 24: "it says it once always the first time, but then maybe it comes up again in a game or two, and then
 * maybe in like 5 or 6 games, and then after that just every like 5 games against that boss, so you don't really see it too often.
 * But we can keep that pattern strict for all the bosses ... just like one number." Counted per account on this device: the battles
 * in which that power was seen (a battle counts once, as the power first comes). The tip plays in a battle whose count is in `at`,
 * then every `every` battles after the last of them (1, 3, 8, then 13, 18, ...). Once a battle at most.
 */
export const POWER_TIPS = {
  at: [1, 3, 8],
  every: 5,
  /** The next line of the exchange starts this long after the one before has typed out (ms): the God King answers. */
  replyMs: 700,
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
  /**
   * His praise of a good move ("Masterful! Even I'd play that.": greatMove, goodMove) never comes in a game's first this many
   * moves: the move's number in the game (the FEN's), so the crowd's own first ten from the start (Eric, Nov 2: "The king should not
   * be saying that on the first move of the game … let's just make it the first 10 moves of the game").
   */
  praiseFromMove: 11,
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
  { id: "very-easy", label: "Very easy", elo: -500, maia: 700 },
  { id: "easy", label: "Easy", elo: -300, maia: 1150 },
  { id: "normal", label: "Medium", elo: 0, maia: 1600 },
  { id: "hard", label: "Hard", elo: 250, maia: 2050 },
  { id: "hardest", label: "Very hard", elo: 500, maia: 2500 },
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

/**
 * Who plays the boss online (the outside review of Nov 10, finding 2, and its review; docs/decisions/2026-11-10-boss-and-lone-devices.md
 * and docs/areas/bosses.md, "Who plays the boss online"): his own move (the brain's, a slip, the King's stagger, a power's best) and
 * Boingo's funhouse move are asked of the host and a checker (an up-to-date app outside the host's account and party, drawn at random;
 * for Maia's moves one whose Maia is loaded) with one seed, so two honest devices give the same move (Stockfish at a node count; Maia
 * and limited-strength Stockfish draw with the seed; the bridge band's share is drawn by the server). The same move plays. Two differ:
 * the engine server scores both and the better for him plays, but for Maia's move against a device's fallback to Stockfish (its Maia
 * late or not ready), which plays if it's within `maiaGap` of the other. Nobody to ask, or no verdict: the host's plays, and the
 * match pays as a solo game.
 *   - `waitMs`: once the host has answered, how long the checker has (both search at once; the checker skips his powers' extras
 *     on a turn that has none).
 *   - `maiaGap`: Maia's move against a fallback plays if the engine server finds it at most this much worse (points of expected
 *     score, 0 to 1), else the better: four honest Maia moves in five (reports/maia-sim, maia-raw: one in five gave away 0.25 or more).
 *     A device that lies "Maia played it" gains at most this, and only on moves where the other device really fell back.
 *   - `throwLoss`: a move the engine server finds this much worse than the other device's is a throw: its device gets a judge's
 *     strike (benched at JUDGES.strikes). Above Maia's honest worst: its unguarded moves in reports/maia-sim (317 moves) gave away at
 *     most 0.76.
 *   - `missStrikes`: a checker that misses its window is replaced next move; this many misses in a battle are a strike.
 *   - `loaders`: on the Maia brain, how many devices are told to load Maia to check his moves as the battle begins (drawn at random:
 *     computers, and phones whose Maia is already saved; no phone downloads it for this); one more each move while none is ready.
 *   - `eloDrawScale`: Stockfish at a strength with a seed (eloDraw) draws with T = the mean loss a move at that Elo (RATING_CURVE)
 *     times this factor, by Elo (straight between the points, held past the ends), so it gives away what UCI_LimitStrength does
 *     through the same guard: reports/elo-draw.md (two 200-position runs pooled; the delta reviews' D5 and N4).
 */
export const BOSS_CHECK = {
  waitMs: 4_000,
  maiaGap: 0.25,
  throwLoss: 0.8,
  missStrikes: 2,
  loaders: 2,
  eloDrawScale: [
    [1600, 1.25],
    [2200, 1.25],
    [2500, 1.25],
    [2800, 1.05],
  ] as readonly (readonly [number, number])[],
} as const;

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
  // (Its boss final meets the Hidden Boss: as the child first, by his forms.)
  return { ...CROWD_SETTINGS, recluseChild: recluseChildFirst(), ...(opts.augments !== undefined ? { augments: opts.augments } : {}) };
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

/**
 * The app's files on the device (the service worker, packages/app/sw-template.js; Nov 15): each version's files stay while a tab runs
 * that version, so a tab left open across a deploy still opens its rooms. A tab that doesn't say which version it runs (asleep in the
 * background) keeps the newest `keepVersions` versions (this one included) until it does or closes.
 */
export const APP_CACHE = {
  keepVersions: 3,
  /**
   * A file of the game that won't load (app/src/stale.ts): how long the page waits for the server's `/version.json` (ms) to tell a
   * deploy (another build: the page loads again) from a dropped connection (the same build, or no answer: the load just fails).
   */
  staleCheckMs: 5_000,
} as const;

/**
 * The front door (home, queue, profiles): the live line's timing and the queue's show. (A rating's own names, RATING_RANKS
 * "Novice … Transcendent", were retired on Oct 28, 2026: the rank shown everywhere is ranked 1 v 1's tier, RANKED_1V1.)
 * See DECISIONS.md, "The front door".
 */
export const FRONT_DOOR = {
  /** Online = seen (any request from the app) within this long. */
  onlineWindowMs: 60_000,
  /** The live line refreshes this often while a front-door screen is open… */
  livePollMs: 5_000,
  /** …and the app says "still here" this often everywhere else (a match), so players in matches count as online. */
  heartbeatMs: 30_000,
  /**
   * A live request with no answer by now is given up (and the next one goes at its time): one that never answered kept the next from
   * ever going, and the town's and the home page's chats, which ride on it, stopped until a reload (Nov 11).
   */
  liveTimeoutMs: 10_000,
  /**
   * Your account's load (the sign-in options and /api/me, each try): a request with no answer by now is given up, and the profile says
   * it couldn't reach us, with Try again (Nov 20: a load that never ended left Profile on "Loading…" for good).
   */
  accountTimeoutMs: 20_000,
  /** A running match counts while its lobby has reported within this long (it reports at least once a minute). */
  matchStaleMs: 3 * 60_000,
  /** The queue: after the fill time, bots pop into the empty seats for this long before the match begins. */
  fillShowMs: 1_800,
  /** The typical wait shown under PLAY: the median of the last this-many matchmade starts (within a week). */
  waitSamples: 20,
  /** Players with a rating needed before a profile shows its percentile ("Top 18%"). */
  percentileMinPlayers: 10,
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
  /**
   * Searching while you browse (Eric, Nov 10): home's "Stop search?" or "Play bots?" (asked in place, in the action row) goes
   * back to the three actions after this long without a tap.
   */
  searchAskMs: 6_000,
  /**
   * The loading bar (Eric, Nov 10: "only … if it's going to be more than like a 2-second hang"): the splash (or home's shell) under
   * the logo shows a thin bar and what's loading once the page has been loading this long. index.html's shell runs it, before the
   * app's script: it has these numbers written in (a unit test checks they agree).
   */
  loadBarAfterMs: 2_000,
  /** No step done for this long: the bar's line says so, with "Try again" (a reload), never an endless bar. */
  loadBarStallMs: 20_000,
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
  maxNps: number;
  medianCap: number;
  pairClassMin: number;
  pairClassShare: number;
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
  /**
   * Choosing judges: weight = (nodes per second) ^ speedWeight, so a computer judges more often than a phone. 2 (was 3,
   * then 1): the speed is the device's own word until it's measured, so the cap below keeps what a claim buys small,
   * while computers still mostly judge with computers (2026-11-10-judge-pairing.md).
   */
  speedWeight: 2,
  /** The fastest a device's claimed speed counts (nodes/s; a fast desktop's real engine is about 2 to 3 million). */
  maxNps: 3_000_000,
  /**
   * When judges are drawn, a speed counts at most this many times the lobby's median (so in a lobby of phones, a device
   * that claims a desktop's speed weighs as a fast phone, not as a hundred). 3, not 4: two accounts claiming a computer
   * in a 62-phone lobby get both judges 2.9% of the time at 3, 7% at 4 (2026-11-10-judge-pairing.md).
   */
  medianCap: 3,
  /**
   * The second judge comes from the first's class (computer or phone, the device's own word) only when that class has
   * at least this many other accounts left, and at least `pairClassShare` of the lobby's accounts; else from everyone.
   * A fixed count alone let an attacker supply it (four accounts claiming "computer" in a lobby of phones: both judges
   * 29%; with the share, 7%, as if classes were ignored). Delta review 2, 2026-11-10-judge-pairing.md.
   */
  pairClassMin: 3,
  pairClassShare: 0.1,
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
  // (Before turning this on: two accounts claiming "computer" at a fast speed would make deepMode() true and the judging
  // pool only the capable devices, the two of them, in a lobby of phones. Delta review 2 of PR #601, Nov 10.)
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
 * A match's end on players' profiles (server/lobby-do.ts; the outside review of Nov 10, finding 9): each signed-in player's result,
 * fair play, XP and rewards wait in the lobby's record (`saveQueue`) until written, each write keyed so a retry or a restart writes
 * nothing twice. At most `perWake` players are written per wake (about 20 D1 calls each: far under D1's 1,000 queries per
 * invocation), the next ones a second later. A failed write is tried again every `retrySeconds`, and the lobby waits to close for it
 * up to `retryHours` past its closing time (then it closes, and says so on the ops page). Fair play, XP, the Welcome Crate and boss
 * tokens stop holding a result up `strictMinutes` after its first failed try (logged): a lasting bug in one never blocks the result,
 * and a short D1 outage never drops them (by time, not tries: the review of #610, m3).
 */
export const MATCH_SAVE = {
  perWake: 20,
  retrySeconds: 60,
  retryHours: 24,
  strictMinutes: 30,
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

/**
 * A solo game left after `minMoves` of your own moves counts as a loss (Eric, Nov 22: "if I just refresh my browser, it doesn't show
 * in the match history ... otherwise no one would ever resign"; then "we only store games that people are actually playing";
 * docs/decisions/2026-11-22-solo-abandon.md). A solo game (Solo, a solo raid, Boss Battle alone) is played on the device; the server
 * only notes its start (server/xp.ts, `solo_games`). At your `minMoves`th own move (core's ownMoves, as XP counts them) the app tells
 * the server once that the game is real. A real game whose result never comes is recorded as a loss (last place, `abandoned`, no XP,
 * no boss token, no quest, never the Welcome Crate's count) at the first of: you start another solo game, the app loads, or
 * `staleHours` have passed since it began (checked at your next profile read). A late result for it then writes nothing. Under
 * `minMoves`, nothing is stored or recorded. Never a Battle Tower floor (its own leave rules: BATTLE_TOWER) nor a game with a test switch.
 */
export const SOLO_ABANDON = {
  minMoves: 10,
  staleHours: 24,
  /**
   * Another tab of this device still playing a real game (its last move this recent) keeps the app's load in a second tab from
   * recording it as left: a game in a tab left alone longer than this counts as left.
   */
  liveMinutes: 10,
  /**
   * A finished game's result whose post went this recently may still be on its way (from a page since gone, or another tab): the app's
   * load and a start don't send it again yet (a re-send overtaking it would take the game and its XP), only name it (ms).
   */
  resendAfterMs: 15_000,
  /**
   * Step 2, Resume / Forfeit (Eric, Nov 22): a solo boss battle (Boss alone, a Solo raid) is kept on the device from this many of your
   * own moves, so a reload offers "You have a game in progress" with Resume and Forfeit (past `minMoves` a Forfeit is a loss; under it
   * nothing is recorded). Stale after `staleHours`, as the server's record.
   */
  keepFromMoves: 1,
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
 * with ranks of tiers and divisions (Wood 5 … Radiant 1, then Pearlescent and Transcendent; Eric, Oct 28). Every number
 * of the mode is here; core/ranked.ts does the math.
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
  /**
   * How long both players have to drag their pawn into a zone (Eric, Nov 25: "needs to be like 10s, or when both pick then it
   * instantly ends"; it was 5). Once both have picked, the vote closes `voteBothPickedMs` later (a changed pick still counts until
   * then), if that's sooner. docs/decisions/2026-11-25-duel-vote-and-chat.md.
   */
  voteSeconds: 10,
  /** Both picks in: the vote closes this long after the second (a beat to see both pawns land), never later than its own end. */
  voteBothPickedMs: 1_000,
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
  /**
   * Recording a finished game (server/duel-room.ts): tried at once, then 15 s after each try for the first four, then every
   * `recordRetrySeconds`, up to `recordRetryHours` after the game ended (as Squads' rewards: the outside review of Nov 10, finding 7);
   * the room waits to close for it that long (then it closes, and says so on the ops page).
   */
  recordRetrySeconds: 60,
  recordRetryHours: 24,
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
   * Colors (Eric, Nov 25: "Color balance seems good"; docs/decisions/2026-11-25-duel-color-balance.md; core's firstGetsWhite): as a
   * pair is seated, nobody gets one color more than `maxInRow` games in a row when the other player can take it instead; then White
   * goes to the larger (Black games − White games) over each player's last `recentGames` ranked games; a tie, to the one who had
   * Black last; still tied, a coin flip. The rating has no White edge (expectedScore ignores color).
   */
  colors: { recentGames: 10, maxInRow: 2 },
  /**
   * The hidden rating: Glicko-1, each game its own rating period. A new player starts at their account's rating (from
   * other modes, clamped to `seedMin`-`seedMax`) or `start`, with `startRd`; the deviation shrinks with each game to
   * `minRd`, and grows back with idle days (`rdPerDay`: sqrt(RD² + c² × days)).
   */
  rating: { start: 1500, seedMin: 800, seedMax: 2400, startRd: 350, minRd: 60, rdPerDay: 18 },
  /**
   * The ladder (Eric, Oct 28: "Maybe we can do puzzle pirates for some actually, wood, silver, gold, paragon, illustrious,
   * sublime, radiant, pearlescent (top500), transcendent (top 100)"; "each tier has numbers 1-5 within it wood 5 being the
   * lowest"; "yes 80 per division"). Each tier has divisions 5 → 1 of `pointsPerDivision` points; one number places a
   * player: ladder = division index × 80 + points (Wood 5 0 = 0, Radiant 1 79 = 2799). 7 × 5 × 80 = 2800 = 7 × 4 × 100,
   * the old ladder's (Iron … Diamond) length, so a stored ladder keeps its meaning: each tier spans the same 400 points
   * the old tier in its place did (docs/decisions/2026-10-28-ranked-tiers.md). Each color is its emblem's main color,
   * readable as a pill on both themes (4.5:1; packages/core/test/ranked.test.ts).
   */
  tiers: [
    { name: "Wood", color: "#dcaa66" },
    { name: "Silver", color: "#b9c3cf" },
    { name: "Gold", color: "#f0b020" },
    { name: "Paragon", color: "#56c682" },
    { name: "Illustrious", color: "#86aeff" },
    { name: "Sublime", color: "#c096ff" },
    { name: "Radiant", color: "#ff7e68" },
  ] as readonly RankTierDef[],
  divisions: 5,
  pointsPerDivision: 80,
  /**
   * The top two tiers, no divisions, by place among the highest ladders: Pearlescent among the `top` 500, Transcendent
   * among the 100, and only from `topFloor` ladder points (the director's call, Oct 28: with few players the top 100
   * would otherwise be everyone). Your place is 1 + how many ladders are higher than yours (equal ladders share a
   * place). At `topFloor` or more but outside the top 500 you stay Radiant 1, your RP counting on past 80 ("Radiant 1 ·
   * 95 RP"). Where both hold, the smaller `top` (Transcendent) is the one shown.
   */
  topTiers: [
    { name: "Pearlescent", color: "#c8bed8", top: 500 },
    { name: "Transcendent", color: "#ab90ff", top: 100 },
  ] as readonly (RankTierDef & { top: number })[],
  /** The ladder points the top tiers need (Radiant 1's 80 RP: the end of the divisions). */
  topFloor: 2800,
  /**
   * Where the ladder sits on the hidden rating: Wood 5 0 points is `baseRating`, each point `ratingPerPoint` more (so
   * the top tiers' floor, 2800 points, is 2400). Unchanged by the Oct 28 tiers: a stored ladder means the same rating.
   */
  baseRating: 800,
  ratingPerPoint: 1600 / 2800,
  /**
   * Points a game: 2 × `perGame` × (the result − the expected result from the two hidden ratings), so ±`perGame` between
   * equals, more for beating someone stronger and less for beating someone weaker; plus `perRating` × (hidden rating −
   * the ladder's rating) after the game, the adjustment at most ±`maxAdjust` (a draw: half): so a player whose rank is
   * below their play climbs faster, and ranks settle where the hidden rating says. A win never takes points, a loss
   * never gives them. (Without the expected result, a player who keeps beating weaker ones climbed past their rating
   * for good, and two accounts trading wins reached the top tier, then Champion: reports/ranked-1v1.md.) No promotion
   * series and no demotion shields: crossing 80 points is the next division, falling below 0 the one before. Never below Wood 5 0.
   */
  points: { perGame: 20, perRating: 0.05, maxAdjust: 10 },
  /**
   * The first `games` rated games are placements ("Placement 2/5"), then the ladder starts from the hidden rating, at most
   * `maxLadder`: Radiant 5 0 RP (2400; it was Diamond 4 0 before the Oct 28 tiers, the same number).
   */
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
 * The season ladder (Eric, Nov 25: "a ladder board for all rank modes for the current season"; "scrollable to the top 200";
 * docs/decisions/2026-11-25-ladder.md). `season`: the season shown (none is stored yet: "Season 1" is everything so far). `size`:
 * the list's rows, one scroll, never a "next" page; your own row is pinned below it with your exact place wherever you are.
 * `cacheSeconds`: how long each Worker instance keeps a mode's rows and count (at most one read of them a minute per instance, however
 * busy); your own row is read for you every time and put in your copy of the list.
 */
export const LADDER = { season: 1, size: 200, cacheSeconds: 60 };

/**
 * Leaving ranked games early (phase L1, 1 v 1; Eric, Nov 9: "Quitting during time control. Yeah, that's fine. Quitting
 * mid-game. Yeah, full loss."; docs/ideas/ranked-ladder.md section 4, docs/areas/ranked.md "Leaving"). The server
 * decides all of it from the game's own record (core's ranked-leaves.ts does the math); PAUSE_LEAVE_PENALTIES turns it off.
 *   - A **dodge**: leaving after the match is found, before both first moves (Abort, the vote, closing the app, no first
 *     move, never connecting). The game is called off as before (no result, no hidden-rating change), and the dodger loses
 *     `dodgeRp[0]` rank points, `dodgeRp[1]` from dodge level 2 on, with a lockout from ranked by their dodge level.
 *   - A **leave**: after the game starts, abandoning it (your clock ran out while you were gone and your opponent was there)
 *     or resigning before your `quickResignMoves`th move. A full loss, then `leaveRp` more rank points.
 *   - Both put a **mark** on your record: `window` is how many of your latest ranked games and dodges are counted.
 */
export const LEAVES = {
  /** Rank points a dodge costs: the first (dodge level 1), then from level 2 on. None in placements (no rank points yet). */
  dodgeRp: [5, 10] as readonly number[],
  /** Rank points a leave costs on top of the loss. */
  leaveRp: 10,
  /** The lockout from ranked after a dodge, in minutes, by the dodge level it brought (1, 2, 3, 4, 5 and up). */
  dodgeLockoutMin: [0, 5, 30, 120, 720] as readonly number[],
  /** The dodge level drops by one every this many hours without a dodge. */
  dodgeDecayHours: 12,
  /** Marks are counted among your latest this many ranked games and dodges. */
  window: 20,
  /**
   * The delayed queue: with at least `at` marks in the window, each ranked search waits `waitSec` before it can be paired
   * (the most `at` reached applies). From `noteAt` marks home's note also says "Finish ranked games to clear your leaves."
   */
  delayed: [
    { at: 3, waitSec: 120 },
    { at: 5, waitSec: 300 },
  ] as readonly { at: number; waitSec: number }[],
  noteAt: 5,
  /** With this many marks in the window, ranked is locked for `lockHours` from the latest mark. */
  lockAt: 8,
  lockHours: 24,
  /** Resigning before your this-many-th move is a leave (a dodge in disguise). */
  quickResignMoves: 3,
  /**
   * A player counts as gone (for who left: duel rules' conductOf) only once their last socket has been closed this long: a
   * phone backgrounding, a Wi-Fi to cellular handoff, a reload or a deploy's dropped sockets come back well within it. Within it,
   * an Abort pressed is the presser's own, and a flag is a plain loss.
   */
  goneGraceMs: 12_000,
  /** Home's note after a dodge ("You left before the game started: −5 RP") shows this long, unless a game comes after it. */
  noteMinutes: 30,
  /** A mark is kept this long, then the 15-minute cron deletes it. */
  keepDays: 90,
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
   * Placement rewards (unranked), by placement: 1st, 2nd, 3rd-4th, 5th-8th. Coins go in the wallet; crates are crates of the
   * newest series (XP.rewardCrate since Nov 9), each opened with a crate key. Each person on the squad still playing their seat when its
   * placement is decided (not one who left, nor a seat a bot has taken over); none in a lobby a test control touched.
   */
  rewards: {
    1: { coins: 100, crates: 1 },
    2: { coins: 60, crates: 1 },
    3: { coins: 40, crates: 0 },
    5: { coins: 20, crates: 0 },
  } as Readonly<Record<1 | 2 | 3 | 5, { coins: number; crates: number }>>,
  /**
   * A reward (and its results row) stays in the lobby's record until it's written (server/squads-do.ts): a failed write is tried again
   * this often, and the lobby waits to close for it up to `rewardRetryHours` past its closing time (then it closes, and says so).
   */
  rewardRetrySeconds: 60,
  rewardRetryHours: 24,
  /**
   * The daily cap (the outside review of Nov 10, finding 5; like ranked's, RANKED_1V1.coins.perDay): at most this many lobbies a UTC
   * day pay an account their placement's coins and crates; the next that day pay none (XP as usual), and the placement says so.
   * Checked as the reward is written (squads-do.ts writeReward), in the same statement. A lobby of only one party and bots pays
   * none at all (SquadsRecord.unvouched). docs/decisions/2026-11-10-boss-and-lone-devices.md.
   */
  rewardsPerDay: 5,
  /**
   * Squad bots' engine work (the bot engine's top moves for a board), done on players' devices first (Eric's computing
   * priorities): `perJob` devices each (computers before phones, devices outside the match before those in it), their
   * answers compared. The lobby waits `graceMs` after the first answer for the second (or `graceFactor` of the first's time),
   * `answerMs` for any; two that disagree go to the engine server (a restricted search of their moves, at `serverNodes`) or a
   * third device, and the device that was wrong gets a strike (`strikes` and it gets no more work). A second answer after the
   * grace is compared when it comes: disagreeing, the engine server's verdict strikes the one further from it. A bot whose candidates aren't in
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
    /** The second answer's grace is at least graceMs, or this share of the first's own time (as JUDGES.graceFactor). */
    graceFactor: 0.5,
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
  /**
   * Move replay on screen (Eric, Nov 5; the rule's free time: SQUADS.replaySecondsPerMove). Coming back to a board, the
   * moves played there since you last played it land one by one: the first `firstMs` after your half begins, then one
   * every `stepMs`, the last held until the extra free time is over (SQUADS.replaySecondsPerMove a move, so it always fits).
   * `mode`: the replay button's setting on a device (an account) that hasn't set it: off (Eric, Nov 5, round 2: the
   * button steps off, the last 2 moves, all of them). A name tag over each moved piece: `tagChars` letters at most,
   * then "…".
   */
  replay: { mode: "off" as "off" | "two" | "all", firstMs: 150, stepMs: 450, tagChars: 12 },
  /**
   * The countdown tick (Eric, Nov 5: in the free seconds it "makes you panic"): once a second while your squad's real
   * bank has this many seconds or fewer left and you still have a move to make; never in the free seconds.
   */
  tickBankSeconds: 5,
  /** A party (an invite code or link, up to SQUADS.partyMax): closes after this long with nobody in it. */
  partyIdleMinutes: 60,
  /** A party in line asks the matchmaker again this often while it's busy. */
  partyRetryMs: 3_000,
};

/**
 * The God King's effects in the shop UI (the shop's effects tab, the locker's "From the shop" and their buttons; Eric, Nov 8): off
 * hides them only. Nothing is deleted: the catalog (shop.ts), owned records and the database stay as they are.
 */
export const GOD_KING_SHOP = false;

/**
 * The shop's Chat packs tab (Eric, Nov 8: "the chat packs go away"). Off hides the tab and every pack in the shop, and the
 * quick-chat picker offers only the free default lines. Nothing is deleted: owned packs still send (their lines work for
 * whoever has them), and the server keeps its records and purchase code.
 */
export const CHAT_PACKS_SHOP = false;

/**
 * The crate opening (Nov 24; docs/decisions/2026-11-24-crate-open-build.md; app `crate-open/`). Presentation only: the roll, the odds
 * and what's won are the server's.
 */
export const CRATE_OPEN = {
  /**
   * How long the strip spins (ms), each strip (a crate's, and Fischer Random's second). 4 s: the director's call from the mockup's
   * recommendation (Nov 24; it was 6.2 s, 4.8 s for the second): "2.7 s is a little quick for a crate, and 6.2 s with the open's extra
   * 3 s makes the whole thing long." One number, so Eric can change it.
   */
  spinMs: 4000,
} as const;

/**
 * The bonus crate (Eric, Nov 24: "like League of Legends does this ... a crate and key combo in addition to whatever item you get ...
 * it's a 25% chance, and then every crate possible that exists, even ones that have been retired, just evenly spread ... And if it
 * requires a key, though, then we need to give it a key as well"; docs/decisions/2026-11-24-bonus-crate.md; core `bonus-crate.ts`,
 * the server's opens). Every crate opening (a series crate's, a boss crate's) rolls it on the server, in the same op as the item; a
 * bonus crate's own opening never does (Eric: "you can't just keep crating into other crates").
 */
export const CRATE_BONUS = {
  /** The chance an opening also gives a bonus crate (and its key, if it opens with one). */
  chance: 0.25,
} as const;

/**
 * The Shop tab's page (Eric, Nov 9: his mockup, our art; docs/decisions/2026-11-09-shop-page.md). Look only for now: no purchase is
 * wired (a tapped price says "Buying opens soon"); Stripe and coin purchases come next.
 */
export const SHOP = {
  /** The beta discount on everything in the shop (0.5 = 50% off; 0 = none: no ribbons, no struck prices). */
  discount: 0.5,
  /**
   * Full prices in coins (Eric, Nov 18: 100 coins = $1, a key 100 = $1, crates 50-75 "as long as it's something we can easily tweak
   * later"; the payments design, section 8: docs/decisions/2026-11-17-payments-design.md). The page shows them struck through, the
   * discounted price beside them (`shopPrice` in shop.ts); the beta's discount ends when real money turns on.
   */
  prices: { key: 100, hunchess: 50, gift: 75, beta: 75, boss: 200, bundle: 400 },
  /**
   * The God King effects' prices in coins, by item id (Holy Light, the starter, is free). Nov 18: 400-600 became 300-400 (the
   * payments design's table 8; each old price p is now p / 2 + 100: 400 → 300, 500 → 350, 600 → 400).
   */
  godKing: { "king-storm": 300, "king-hellfire": 400, "king-void": 400, "king-emerald": 350 } as Readonly<Record<string, number>>,
  /** The limited, rotating items: a gold clock on their card. */
  limited: ["gift", "beta"] as readonly string[],
  /** The bundle's 3 random crates: each this likely to be a Mythic Crate (a Fischer Random pull: Legendary or Mythic). Wired with purchases. */
  bundleMythicChance: 0.05,
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
  /**
   * Solo 50 v 50 only (Eric, Nov 1: "have the bots just chatting still"): after each of your team's moves, with these odds,
   * a teammate bot says one of these (everyday picks every player has, to the team), within botMaxPerMinute. Online
   * matches don't use it (their bots keep the moments above).
   */
  botChatterChance: 0.35,
  botChatter: ["trust-crowd", "defend-king", "go-mate", "wow", "oops", "e-thumbs", "e-fire", "e-clap", "e-laugh", "e-wow"] as readonly string[],
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
  /**
   * The lines a finished game's chat offers (ranked 1 v 1's end page, Nov 25: Eric, "do you think this chat box makes any sense?", its
   * mid-game lines, "Good luck!" and "Defend the king!", after the game). The free pack's sporting lines; your emoji picks stay.
   */
  postGameLines: ["gg", "well-played", "thanks", "rematch"] as readonly string[],
  /** Shop prices of the packs, in coins (everything is free while SHOP_FREE is on). Nov 18: halved, 200-300 to 100-150 (the payments design). */
  packPrices: {
    godking: 150,
    winter: 100,
    spicy: 125,
    "emoji-chess": 100,
    "emoji-winter": 100,
    "emoji-royal": 150,
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
  /**
   * One message per account every this long (the server enforces it; the app only mirrors it). 5 s since typed chat (Eric, Nov 7;
   * it was 30 s for the quick chips).
   */
  gapMs: 5_000,
  /**
   * The global chat's server-wide cap (Eric, Nov 7): at most `capCount` messages in any `capWindowMs` across every player. A message
   * past it waits its turn in line (it shows a moment late, never out of order) for at most `queueMs`; past that the sender hears
   * "Chat is busy, try again." and nothing is kept.
   */
  capCount: 5,
  capWindowMs: 1_000,
  queueMs: 10_000,
  /** A typed message's most characters, after tidying (the town square's count: an emoji is one, a `:name:` code its letters). */
  maxChars: 80,
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
 * Typed chat (Eric, Nov 7; docs/decisions/2026-11-07-typed-chat-column.md): players type in the global chat and in a match's and its
 * lobby's chat, under the age gate (a device answered "too young" keeps the quick chips; guests read), each player's opt-in (off by
 * default) and the filter. **The one switch back:** false brings the quick chips back everywhere (the global chat's Lobby / Yours /
 * Emoji tabs, a match chat's phrase picks) and the server takes preset lines only, as before Nov 7.
 */
export const CHAT_TYPED: boolean = true;

/**
 * The town square's chat (Eric, Oct 28: "I think it actually is totally fine to allow typing"): typed messages (the other chats too
 * since Nov 7: CHAT_TYPED). Signed-in players only (accounts are 13 and older); the server enforces
 * every number here and the app mirrors them. The room holds its lines in memory only (the live hub), never stored.
 * The kill switch is the Worker variable PAUSE_TOWN_CHAT (pauses.ts). docs/decisions/2026-10-28-town-chat-typing.md.
 */
export const TOWN_CHAT = {
  /** The most characters in a message, after trimming. */
  maxChars: 80,
  /** One message per account every this long. */
  gapMs: 15_000,
  /** The same message (case, spaces and punctuation aside) not again from the same account within this long. */
  repeatMs: 60_000,
  /**
   * A line leaves the room this long after it was said, and the app's log drops it then too (Eric, Oct 28: "keep up to 5 minutes of
   * chat actually"): so Report and a moderator's Remove work on any line a player can still scroll back to. Was 60 s.
   */
  lineMs: 300_000,
  /** A newcomer gets at most this many of the latest lines. */
  keep: 12,
  /**
   * The most lines a device keeps (Eric, Oct 28: "5 minutes, or 100 messages, whichever it hits first"): the oldest go first. The
   * server's own cap is `holdMax`.
   */
  deviceMax: 100,
  /**
   * The most lines the room holds at once (all said within `lineMs`); the oldest go first past it. Kept at 300 when `lineMs`
   * went from 1 to 5 minutes: a device keeps `deviceMax` (100) of the newest, so the room needs only more than that to cover
   * every line one can show, and the hub hands its whole room to each Worker instance every `readCacheMs`, so a bigger one costs
   * every read.
   */
  holdMax: 300,
  /**
   * Each Worker instance reuses the room as it last read it for this long (the live poll's `?town=N`), so the live hub
   * is asked at most this often per instance however many players read.
   */
  readCacheMs: 2_000,
  /**
   * A boss challenged from the town (Eric, Nov 2: town/shops/challenge.ts): the server posts "Ann challenged Alfil!" as its battle
   * starts and "Ann beat Alfil!" / "Alfil beat Ann." as it finishes, and a player's start line waits while one of theirs is still
   * unfinished (no spam). The room forgets an unfinished one after this long (memory only: a restart forgets them all too).
   */
  challengeOpenMs: 86_400_000,
  /**
   * A town challenge's battle surrendered (resigned) after this many of your moves or more posts "Ann surrendered to Alfil after 15
   * moves." (Eric, Nov 2); fewer is a quit: no line, and the challenge stays unfinished (the no-spam rule).
   */
  challengeSurrenderMoves: 10,
  /**
   * "Ann has entered the town." (Eric, Nov 12: "we have to wait for someone to say something… when you join… it should say… has entered
   * the town"): the server's line when a player's pawn appears in the town, once per visit. Back within this long of their last beat (a
   * reload, a quick trip home or to a shop's game) is the same visit: no line.
   */
  enterRejoinMs: 120_000,
  /**
   * A busy town doesn't flood: after an "entered" line, more arrivals within this long are held and go out as one line when it's up
   * ("Ann and Bo entered the town.", "Ann, Bo and 3 others entered the town."): at most one such line per this long.
   */
  enterBurstMs: 6_000,
} as const;

/**
 * Away in the town square and its rooms (Eric, Nov 7: "after a few min put zzz with no text box… then boot after 10 min of not
 * moving or in the background either one"; on #542: 1 and 5 minutes, and guests get 30 seconds). Any input counts as being there (a tap, a drag, a key, the wheel, walking). The
 * server keeps who's in the town (live hub, town-here.ts) from each device's beat and drops a pawn by the same numbers, so a
 * hidden phone that runs no timers still leaves. docs/decisions/2026-11-07-town-afk.md.
 */
export const TOWN_AFK = {
  /** A "zzz" floats over your pawn, for everyone, after this long with no input (Eric, on #542: 1 minute, was 3). */
  zzzAfterSec: 60,
  /** Out of the town (home, "You've been dropped from the town") after this long with no input (Eric, on #542: 5 minutes, was 10). */
  bootAfterSec: 300,
  /** Out after the page has been in the background this long without a break (Eric, on #542: 5 minutes, was 10). */
  hiddenBootAfterSec: 300,
  /** A device in the town tells the server where it is this often while it's visible (and at once on a change). */
  beatSec: 5,
  /** No beat for this long: the server counts the device as in the background since its last beat (a hidden phone sends none). */
  silentAfterSec: 20,
  /** The most other players one device is told about. */
  maxShown: 100,
  /**
   * A guest (not signed in, where accounts can be made) walks round the town (its rooms too) this long, counted while the page is
   * visible and across visits in one page load; then "Make an account to keep exploring" (Eric, on #542: "like 30 seconds").
   */
  guestTownSec: 30,
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
  /** The friends page's player search (Eric, Nov 11): it asks once a name has this many characters… */
  searchMinChars: 2,
  /** …this long after the last keystroke… */
  searchDebounceMs: 250,
  /** …and shows at most this many players (names starting with what was typed, any case). */
  searchMax: 6,
} as const;

/**
 * Friend bots (Eric, Nov 20: "some bots on my friends list that like have random activity showing ... as real as we can get"): test
 * accounts an admin adds to their own friends list from /admin/ops, whose presence is worked out from the time and each bot's id
 * (server/src/friend-bot-schedule.ts): no timers, no writes. docs/decisions/2026-11-20-friend-bots.md.
 */
export const FRIEND_BOTS = {
  /** Bots one "Add friend bots" makes for the admin who asked (again: the missing ones only). */
  count: 8,
  /** A bot's sessions a day, on average: each bot's own number, somewhere in this range. */
  perDay: [2, 6] as readonly [number, number],
  /** A session lasts this many minutes (short ones more often). */
  sessionMinutes: [10, 60] as readonly [number, number],
  /** Each bot's local time: hours from UTC, one of these (US time zones: their evenings are busiest). */
  utcOffsets: [-5, -6, -7, -8] as readonly number[],
  /** How likely a session starts in each local hour, 0 to 23 (relative: evenings most, nights least). */
  hourWeights: [0.35, 0.15, 0.08, 0.05, 0.04, 0.05, 0.12, 0.3, 0.4, 0.45, 0.5, 0.55, 0.65, 0.6, 0.55, 0.6, 0.75, 0.9, 1.3, 1.7, 1.9, 1.8, 1.4, 0.8] as readonly number[],
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
 * The engine server's two open routes (server/index.ts; the outside review of Nov 10, finding 4): POST /api/engine/score (a solo
 * game's close calls) and GET /api/engine/ping (waking it as a solo game starts). Only for an account (signed in, where sign-in is
 * set up), at most `perAccountDaily` calls an account a UTC day (counted in D1: server/engine-calls.ts; not yet measured against a
 * keen solo player), and solo's searches at most `soloDailySearches` a day, never more than `soloShare` of the day's
 * ENGINE_DAILY_SEARCHES (3000), so matches always keep the rest. Past either, the device re-checks itself for the rest of the game,
 * as when the server is down. Devices first (CLAUDE.md's computing priorities): this only stops strangers.
 */
export const ENGINE_SERVER = {
  perAccountDaily: 200,
  soloDailySearches: 1000,
  soloShare: 1 / 3,
  /**
   * A search group's second try (a container still waking, serverAllMovesAt) goes only with at least this much of the try's time
   * left. A timeout can fire a moment before the clock reads the deadline; without this it sent a pointless 1 ms search (Nov 14).
   */
  retryMinMs: 250,
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
    /** The friends page's player search, per account (a search asks after a pause in typing: FRIENDS.searchDebounceMs). */
    search: { limit: 40, windowMs: 60_000 },
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
  /**
   * The item ledger's daily check (server/ledger.ts, ledgerCheck): the 15-minute cron's run in this hour (UTC) finds the accounts whose
   * balances and ledger disagree and logs up to `accounts` of them in full (one error line for /admin/ops says how many).
   */
  ledgerCheck: { hourUtc: 9, accounts: 20 },
} as const;

/**
 * Alerts to Discord (Nov 10; docs/ideas/live-ops.md, sections 1 and 5; server/alerts.ts): the 15-minute cron compares the server's
 * stored error counts with normal and posts to the Worker secret ALERT_WEBHOOK. A PAGE (players can't play) pings at once; the rest
 * waits for the morning digest. A PAGE needs a real count, well above that hour's normal, two checks in a row.
 */
export const ALERTS = {
  /** The cron's period (wrangler.jsonc): a 15-minute window's normal is this share of the hour's. */
  checkMinutes: 15,
  page: {
    /** Errors in one 15-minute window, at least (a real count, never one event). */
    minErrors: 20,
    /** And at least this many times normal: the median of the same clock hour on each of the `normalDays` days before. */
    timesNormal: 3,
    normalDays: 7,
    /** Checks in a row over the line before a PAGE (and under it before "recovered"). */
    inARow: 2,
    /** While it lasts, a problem pages again ("still happening") at most this often. */
    repeatMs: 3_600_000,
  },
  /**
   * The match, lobby and queue routes: the Worker's own errors on these (the route as routeOf names it, "POST /api/play"), with
   * the Durable Objects' errors apart. A request into a lobby that fails is counted once in each (the room's, then the Worker's).
   */
  playRoutes: ["/api/play", "/api/lobby", "/api/squads/", "/api/boss/party", "/api/1v1/"],
  /** D1 not answering: read again this much later; both failing (two checks in a row) pages. */
  d1RetryMs: 30_000,
  /** The morning digest: the first check at or after this hour in this time zone, once a day. */
  digest: { hour: 8, timeZone: "America/Chicago" },
  /** The ops page linked from every post. */
  opsPage: "https://hunchess.com/admin/ops",
} as const;

/**
 * Chess Town's pictures kept between visits (Nov 23, Eric: "the drawn pictures between visits ... it seems like just smart"; the app's
 * town/keep-pictures.ts): the first visit on a build paints every picture on the loading screen, as before, then keeps them on the device
 * (IndexedDB, as PNG pages); a later visit on the same build and layout loads them instead of painting. Anything odd paints as before.
 * `on`: the switch. `maxMB`: the most it keeps (more, and nothing is kept). (Its pages' size is the WebGL atlas's, Nov 25: the app's town/paint.ts `ATLAS`.) `waitMs`: how long the loading
 * screen waits for the kept pictures to be read and decoded before it paints instead. `afterMs`: how long after the first visit's first
 * frame they're kept (composed a page at a time, up to `sliceMs` a frame, encoded in a worker).
 * docs/decisions/2026-11-23-town-keep-pictures.md.
 */
export const TOWN_PICTURES = {
  on: true,
  maxMB: 24,
  waitMs: 4000,
  afterMs: 1500,
  sliceMs: 3,
} as const;

/**
 * Chess Town's first visit paints on more cores (Nov 23, Eric: "It sounds like we can use more cores"; the app's town/paint-pool.ts).
 * The loading screen's pictures are pure pixel math (each frame's palette keys read into RGBA, each roof face baked), so it runs in a
 * few workers while the main thread puts the pixels on canvases and paints what's left itself. `max` workers at most (the device's cores
 * less one, and at least one); each is handed `batch` pictures at a time, `ahead` batches queued so it never waits. `on: false` paints
 * on the main thread only, as before. docs/decisions/2026-11-23-town-paint-workers.md.
 */
export const TOWN_PAINT_WORKERS = {
  on: true,
  max: 3,
  batch: 4,
  ahead: 6,
} as const;

/**
 * The street town's WebGL failures (Oct 30; Nov 13: never today's town; the app's town/gl-fail.ts; docs/areas/ops.md, "Health"):
 * each page says so once, through the error reporting (the app's problems.ts, `reportTownFallback`), as this kind with its reason
 * as the message. The health view counts them by reason, apart from the errors. `no-webgl2`: no WebGL 2 in the browser, so "Chess
 * Town can't run on this device." The reasons a page reloads once: it has WebGL 2, but no context could be made; the shader didn't
 * compile or link; or the context was lost and not given back within 5 s of the page showing. `retry`: it failed again after that
 * reload, and the town's box says "The town didn't load. Please retry." (`lost-twice`, a context lost twice within a minute, isn't a failure since
 * Nov 13; kept so the week's count still reads it.)
 */
export const TOWN_GL_FALLBACK = {
  kind: "town-gl-fallback",
  reasons: ["no-webgl2", "no-context", "shader", "lost-twice", "not-back", "retry"],
} as const;
export type TownGlFallback = (typeof TOWN_GL_FALLBACK.reasons)[number];

/**
 * Rides (Nov 1, Eric: "this cricket is too damn big I wanna see it at 75%"): each ride's size under its pawn, by its item id
 * (crates.ts, the `ride` slot). The ride is drawn at this scale about the pawn's seat, the pawn at its own size, still sitting
 * in the saddle, and the ride still standing on the square; everywhere a rider is drawn (the town, the locker, the profiles,
 * home's pawn and ring). 1 is the size as drawn. Every ride is `defaultScale` (Nov 1, Eric, after trying `?rideScale=`: "0.75
 * is good, I have a feeling most we will scale to that"; it was 1) unless `scale` lists it. An admin's `?rideScale=`
 * (`tryScale`'s range) tries one size for every ride on that page (docs/decisions/2026-11-01-ride-scale.md).
 *
 * `speed` (Nov 1, the rides v2 brief: Cheetah Shoes, "twice as fast"): how much faster than on foot a pawn walks the town on
 * its ride, by item id; a ride not listed is 1. Your step takes TOWN_FEEL.youStepMs / speed (a bot's or another player's,
 * botStepMs / speed). The town's walking isn't sent to the server (no real players walk in the town yet), so there's no
 * server-side check of it to scale (docs/decisions/2026-11-01-rides-v2.md).
 */
export const RIDES = {
  defaultScale: 0.75,
  // (An outfit is drawn round the pawn's own head, so at its size as drawn.)
  scale: { "banana-suit": 1 } as Readonly<Record<string, number>>,
  speed: { "cheetah-shoes": 2 } as Readonly<Record<string, number>>,
  tryScale: [0.5, 1.25] as const,
};

/**
 * A ride's moving sound (Eric, Nov 14: "when you move around ... it sounds like ... a little bulldozer moving ... one continuous sound";
 * "when you stop moving, it doesn't just like instantly stop ... it kind of fades over like a second or whatever ... I guess we'll have
 * to test it"; docs/decisions/2026-11-14-ride-sounds.md). Your own pawn's ride only, only while it moves, and only a ride listed in
 * `rides` (its file is `/sounds/rides/<id>.wav`); standing, nothing. On the game's sounds (the Sound switch, a hidden page). App:
 * `ride-sound.ts`. A ride's `kind`:
 * - `loop` (the dozer): one loop while you move (its file: one loop of exactly 1 s with 0.1 s of itself either side; or `synth`, made in
 *   code: Birdie's Train, his own train run, its loop where birdie-sounds.ts says), at `rate` (its
 *   speed and pitch). A hard start and stop (Eric, Nov 16: "forget the fade in and out, it should be a hard start and stop when you
 *   start moving and stop. Like boingo"; docs/decisions/2026-11-16-ride-sound-hard.md): full level and speed on your first moving
 *   frame, out once you stop. `level`: its gain on the game's sounds (each loop is -20 dB RMS, so well under a move's knock).
 *   `holdMs`: it counts as moving until this long after your last moving frame (a step is 90 ms), so a turn or a tap between steps
 *   never stops it.
 * - `steps` (the pogo; Eric, Nov 15: "get rid of the fade in and fade out ... every time ... you go from one square to the next, it
 *   should be a boing ... they're going to overlap each other, but that's fine"; docs/decisions/2026-11-15-pogo-boings.md): a one-shot
 *   on every square you step, at `level`, the next of its file's boings each time (`boings`: where each starts in the file, s; each
 *   `lengthS` long), its own source, so they overlap. `on`: the hop's moment it lands on, `takeoff` (the first drawn frame off the
 *   ground) or `landing` (the first one back on it), read from the ride's move frames (ride-cells.ts), played once a step.
 */
export const RIDE_SOUND = {
  level: 0.3,
  holdMs: 120,
  rides: {
    "sawyer-dozer": { kind: "loop", rate: 1 },
    /** Puddles's Mower: a putter (Eric, Nov 15: "the putter, the second one's good"). */
    "puddles-mower": { kind: "loop", rate: 1 },
    /** The Candy Cane Sled's jingle bells (Eric, Nov 15: "Bells are good to go yes"): four fifths of a jingle bell is above 8 kHz,
     *  so it plays round the softening (`bright`), from a 48 kHz file. */
    "ginger-sled": { kind: "loop", rate: 1, bright: true },
    /** Its loop's 4 boings (its "little tune": low, mid, low, high), cut as in the sample Eric picked (Nov 15: "Yeah, I like A"). */
    "boingo-pogo": { kind: "steps", level: 0.3, boings: [0, 0.245, 0.49, 0.735], lengthS: 0.245, on: "takeoff" },
    /** Birdie's Train (Nov 23): his own train run, made in code as his sounds are (birdie-sounds.ts BIRDIE_RIDE_LOOP), no file. */
    "birdie-train": { kind: "loop", rate: 1, synth: "birdie" },
  } as Readonly<Record<string, RideLoopSound | RideStepSound>>,
} as const;
/** A ride whose sound loops while it moves (RIDE_SOUND). */
/**
 * `bright`: played round the game sounds' 6 kHz softening (sound.ts `gameBus(true)`), for a sound whose highs are the point (a bell).
 * `synth`: made in code, not a file: a boss's own synthesized sound (`birdie`: his train run, looped where birdie-sounds.ts says).
 */
export type RideLoopSound = { readonly kind: "loop"; readonly rate: number; readonly bright?: boolean; readonly synth?: "birdie" };
/** A ride with a one-shot on every step (RIDE_SOUND). */
export type RideStepSound = { readonly kind: "steps"; readonly level: number; readonly boings: readonly number[]; readonly lengthS: number; readonly on: "takeoff" | "landing" };

/**
 * Outfits (Eric, Nov 10; docs/decisions/2026-11-10-outfit-slot.md): an outfit hides every other worn item. `eyewear`: face items
 * tagged eyewear (goggles, shades) still show, over its face hole ("the only exception"); false hides them too.
 */
export const OUTFIT = {
  eyewear: true,
} as const;

/**
 * The Welcome Crates (Eric, Nov 6: "you get it for completing 5 games in any mode or any boss … Limit one per account"; then "the
 * first one you get after 5 games, the next one you get after 25"; docs/decisions/2026-11-06-welcome-crate.md): a signed-in account
 * earns one at each of `milestones` finished games, each once ever (a result reached: win, loss or draw; never one abandoned, aborted
 * or never started). The server counts and grants them (server/welcome.ts); the prize is welcome.ts in core.
 */
export const WELCOME_GIFT = {
  milestones: [5, 25],
  /**
   * A solo game counts toward them only with XP.minMoves of your own moves (as its XP) and at least this many seconds of the server's
   * time (POST /api/xp/solo/start, then its result): its result is the device's word, and empty posts earned crates (the outside
   * review of Nov 10, finding 10). By moves, not 3 minutes, so a quick boss loss or a first-stage knockout still counts (the review of
   * #610, m6). Online games count as their rooms recorded them.
   */
  soloMinSeconds: 60,
} as const;

/**
 * A boss's crate, sold by the Shopkeeper inside the boss's home (Eric, Nov 2: "3 Babur tokens, or 1 Babur token + 1 crate key"):
 * its two prices, in that boss's tokens and crate keys. Bought on the server (server/boss-tokens.ts, `buyBossCrate`: one
 * transaction); what each crate holds is BOSS_CRATES in crates.ts.
 */
export const BOSS_CRATE_PRICE = {
  tokens: 3,
  withKey: { tokens: 1, keys: 1 },
} as const;

/**
 * Boss tokens (Eric, Nov 2; docs/decisions/2026-11-02-boss-tokens.md). A boss battle counts once it reaches `moves` of your own
 * moves or `minutes` of play, whichever comes first, win or lose. Per account, over a rolling `windowHours`: the first counted
 * battle with no token in the window always drops one; after that each counted battle drops one `chance` of the time, up to `cap`
 * in the window. Which boss's token: one of the live bosses (core/boss-tokens.ts, `dropBosses`), each as likely. Decided by the
 * server only: an online battle by its match room (it counts your picks and keeps the time), a solo battle by the server's own
 * clock alone (`minutes` from its start to its finish as the server saw them: the device's word for its moves isn't trusted).
 * Where sign-in is set up, only signed-in accounts earn them (a guest's would move on signing in: many guests into one account).
 * `shortNames`: a boss whose token says a shorter name than the boss's own ("Boingo token", as its picture is named).
 * `grantMax`: the most an admin's test grant gives at once of one boss's tokens; `keysGrantMax` of crate keys (Eric, Nov 9: an admin
 * grants themselves up to 100 keys at once, now that crates take one: docs/decisions/2026-11-09-xp-phase2-keys.md); `cratesGrantMax` of one
 * crate, a series crate or a boss crate (Eric, Nov 25: "how do I get more crates? ... I'm literally out of crates and I don't see a way to
 * generate more").
 */
export const BOSS_TOKENS = {
  moves: 10,
  minutes: 5,
  windowHours: 24,
  chance: 0.25,
  cap: 3,
  shortNames: { clown: "Boingo" } as Readonly<Record<string, string>>,
  grantMax: 10,
  keysGrantMax: 100,
  cratesGrantMax: 10,
} as const;

/**
 * XP and levels (Eric, Nov 9; the approved design, notes/briefs/design-xp-quests.md v2; docs/decisions/2026-11-09-xp-*.md; core's
 * xp.ts has the rules, server/xp.ts grants them). Linear, no top: Level 1 at 0 XP, one more every `perLevel`.
 *   - A game's XP: `perMinute` for each whole minute you played (up to `maxMinutes`), plus `win` for a win. Minutes are your time in
 *     the game as the server measured it (online: the match room, from the match's start to your last move that went in; solo: the
 *     server's own clock between the game's start and its result, never the device's word).
 *   - It counts only with `minMoves` of your own moves (every turn you took: a pick, or a God King call to play it; a turn you let run out isn't; or your team's turns you picked in); else no XP, and the screen says why.
 *   - No XP for leaving the match (idle, removed), for a guest where sign-in is set up, a test game, or a banned account.
 *   - The win bonus is capped where two accounts could trade wins: a friends' lobby pays it once a day per set of opponents, and solo
 *     games (whose result is the device's word) `soloWinsPerDay` times a day. The day starts at `dayStartUtcHour` (08:00 UTC is
 *     midnight Pacific), the same for everyone. A solo win also needs `soloWinMinMinutes` of the server's own time (as boss tokens').
 *   - Solo time XP (the device's word for the moves; the server's clock only proves time passed) is capped at `soloMinutesPerDay`
 *     minutes an XP day (1,200 XP): a game past it pays what's left ("Daily solo limit"). The director's call (review M2, Nov 9);
 *     Eric may change the number. A solo result the server never timed earns no XP at all (review M1).
 *   - The result screen's XP box: the bar fills from the old XP to the new over `fillMs` (by how much it gains, between the two),
 *     each part appearing in turn; a level-up fills to the end, pops "Level N!" for `levelUpMs`, and carries on from empty. Online,
 *     the screen asks the server for its game's XP at `asksMs` after the results (the room may still be writing them).
 *   - `testMax`: the most XP the test switch `?xp=` sets (test servers and admins only).
 *
 * Phase 2 (Eric, Nov 9: "go with phase two"; the design's sections 2 and 4; docs/decisions/2026-11-09-xp-phase2-*.md):
 *   - **The daily reward:** your first counted game of the XP day with at least `dailyMinMoves` of your own moves (a solo game also
 *     `dailySoloMinMinutes` of the server's own time) pays `dailyBonus` XP ("Daily reward +200") and `dailyCrates` crates of
 *     `rewardCrate` (the newest series), once an XP day.
 *   - **Level-up rewards:** every `levelRewardEvery`th level reached (2, 4, 6, …) pays `levelCrates` crates of `rewardCrate` and
 *     `levelKeys` crate keys; every `bossCrateEvery`th level also a boss crate the player picks among the live bosses (it waits in
 *     the Crates tab until picked). Paid once per level, at the next counted game (so levels reached while rewards were paused, or
 *     before phase 2, are paid then); at most `levelsPerGame` paying levels a game (the rest at the next).
 *   - **Levels of 500 since Nov 20** (Eric, Nov 20, on a +150 XP game moving the 1,000 XP bar 15%: "Maybe smaller levels and adjust
 *     the prizes less? Like double the levels needed?"; the director's call: double the levels, the same rewards per XP;
 *     docs/decisions/2026-11-20-levels-500.md). Changing `perLevel`, `levelRewardEvery` or `bossCrateEvery` renumbers every
 *     account's levels: server/rewards.ts maps the levels paid under the old numbers onto the new (paidLevels), so none is paid
 *     twice; a later change needs its own mapping there.
 *   - The result screen shows what a game paid beside its XP in a toast at the top once the XP bar has filled, for `rewardToastMs`.
 */
export const XP = {
  /** 500 since Nov 20 (was 1,000; Eric: "Like double the levels needed?"). Renumbers levels: see the comment above. */
  perLevel: 500,
  perMinute: 10,
  maxMinutes: 30,
  win: 50,
  minMoves: 10,
  soloWinsPerDay: 5,
  soloWinMinMinutes: 5,
  soloMinutesPerDay: 120,
  dayStartUtcHour: 8,
  fillMs: { min: 1500, max: 2500 },
  levelUpMs: 700,
  asksMs: [700, 1500, 3000, 6000, 10_000],
  testMax: 100_000,
  dailyBonus: 200,
  dailyMinMoves: 15,
  dailySoloMinMinutes: 3,
  dailyCrates: 1,
  /** 1 since Nov 18 (was 2; Eric: "One crate per level seems fine"; the payments design, section 6). */
  levelCrates: 1,
  levelKeys: 1,
  /**
   * Since Nov 20 (was every level): levels halved, so a level's crate and key come every 2nd level, the same per XP as before (the
   * director's call on Eric's "adjust the prizes less").
   */
  levelRewardEvery: 2,
  /** 20 since Nov 20 (was 10, at 1,000 XP a level): the same boss crate picks per XP. */
  bossCrateEvery: 20,
  levelsPerGame: 20,
  rewardCrate: "winter-1",
  rewardToastMs: 6000,
} as const;

/**
 * The end screen (Eric, Nov 20; docs/decisions/2026-11-20-end-screen.md; the app's components/EndScreen.tsx): every match's result
 * shows "XP EARNED" (and on ranked 1 v 1, "RP EARNED" first) counting up from 0, the number lobbing into its bar, the bar filling from
 * where you were (a level or a division reached: the bar flashes full and goes on from 0), then the quests the match moved sliding to
 * their new counts. A tap anywhere but a button skips to the end. Reduced motion: the end at once, one ding. Times in ms; sizes in px.
 * The bar's span is XP.perLevel (RANKED_1V1.pointsPerDivision for RP), never a number of its own.
 */
export const END_SCREEN = {
  /** After the screen (and the game's XP) shows, before the first count: a beat to take in the headline. */
  startMs: 450,
  /** The count-up from 0 to the total (Eric: "should only be like 1.5 sec to reach total"), on an ease-out curve. */
  countMs: 1500,
  /** The number holds at its total before it lobs. */
  holdMs: 280,
  /** The lob into the bar's slot. */
  lobMs: 620,
  /** How far the lob's arc rises above its two ends. */
  lobLift: 18,
  /** The number's size when it lands in the slot (a share of its size). */
  lobEndScale: 0.38,
  /**
   * The bar's fill: between these, by how much of a level it gains. (max 2800 since Nov 20, was 2200: a top game's fill "a bit
   * longer" so its pings' hold at the top pitch is felt; `ping` below.)
   */
  fillMs: { min: 1300, max: 2800 },
  /** The shortest fill of one stretch (between two levels). */
  stretchMinMs: 120,
  /** A level (a division) reached: the pause at full while "Level 3!" pops. */
  levelMs: 650,
  /** Between the RP's bar and the XP's count (ranked), and before the quests. */
  gapMs: 300,
  /** The pings at most this often (a 150 XP count would otherwise ask for 90 a second). */
  pingGapMs: 42,
  /**
   * The pings' pitch (Eric, Nov 20, of the six-note scale stepped by the bar's share: "it sounds like it jumps ... it should be
   * progressive, ... goes up a bit higher pitch, then it stays at a certain amount"; then "keep going up a little bit more ... if
   * you only get 100 XP, then it wouldn't do that. But say if you got like 500 XP ... it would get higher pitched, and then it
   * would only stay there for maybe like a second"). It follows the XP counted so far, not this game's share: from `hz` (C6) up
   * `semitones` (a major sixth), eased 1-(1-r)^2, r = XP so far / the XP that reaches the top. A top game (`topXp`) reaches the
   * top with about `holdMs` of its fill (fillMs.max) left and holds there; a 100 XP game only climbs a little. RP counts as XP
   * by its bar's share. The count-up's pings: the same rule at `countRatio` (an octave down). `level`, `countLevel`: how loud.
   * core's xp.ts: xpPingHz.
   */
  ping: { hz: 1046.5, semitones: 9, topXp: 500, holdMs: 1000, countRatio: 0.5, level: 0.065, countLevel: 0.05 },
  /**
   * The level-up, in the steel pan (Eric, Nov 20, after the mallet chord was "way too goofy" and the bells too deep: "the pan is
   * actually better than the bells ... let's make that the official one for now"): a quick run (G5 C6 E6 G6, `stepMs` apart),
   * then a chord (C6 E6 G6 C7) at `chordAtMs`. One sound for the end screen's level-up, auto chess's and a finished quest.
   * `gain` trims the whole sound (the run and chord keep their balance) so its peak, the chord's four notes struck together, stays
   * under half a move's, as every synthesized sound's does, and its loudness under the chime's it replaced (measured Nov 20: at
   * 1 the peak was 0.62, a move's 0.57; at 0.4 about 0.25, the reveal's three dings 0.29). Louder or softer: this one number.
   */
  levelUp: { run: [783.99, 1046.5, 1318.51, 1567.98], stepMs: 60, runLevel: 0.8, chord: [1046.5, 1318.51, 1567.98, 2093], chordAtMs: 300, chordLevel: 0.75, gain: 0.4 },
  /** The end of the fill: one soft pan note (G6), quieter than the level-up (was a bright two-note bell: "goofy"). */
  ding: { hz: 1567.98, level: 0.35 },
  /** Each moved quest's slide, and the gap before the next. */
  questMs: 650,
  questGapMs: 250,
  /** The most quest rows the box shows (its height is this many rows, always). */
  questRows: 2,
  /** How long the end screen waits for the quests' answer before it goes on without them. */
  questWaitMs: 4000,
  /** The bosses' row (1-2-1): the one in front fits this box, the two behind this one (px). */
  frontBoss: { w: 130, h: 98 },
  backBoss: { w: 80, h: 66 },
  /** The largest a boss is drawn there (screen px a sprite px). */
  bossMaxScale: 2,
} as const;

/**
 * Quests (Eric, Nov 9; XP phase 3; the approved design's sections 3 and 5, notes/briefs/design-xp-quests.md;
 * docs/decisions/2026-11-09-quests-*.md; core's quests.ts has the rules, server/quests.ts deals them and pays them):
 *   - **Dailies:** `dailyPerDay` new ones each XP day (it starts at XP.dayStartUtcHour, 08:00 UTC), dealt the first time your quests
 *     are read that day (home, or a game's end). Unfinished ones carry over, but at most `maxDailies` wait (Hearthstone's kindness
 *     rule): a day's deal tops you up to it, never past it. Each unfinished daily has `rerollsPerDaily` free reroll a day (Eric, Nov 10: one per daily,
 *     not one per day); its replacement's is used for that day. (The server keeps one: `quests.rerolled_day`; 1 is the only value.)
 *   - **The weekly:** one, dealt each week (from Monday at XP.dayStartUtcHour UTC: `weekStartDay`, 1 = Monday); it doesn't carry.
 *   - **Progress:** only a game that earned XP (a counted game: XP's rules) counts, once per game per quest, decided on the server:
 *     online games by their match room's facts; a solo game (its moves and its win are the device's word) only for "finish games"
 *     quests, and only with `soloMinMinutes` of the server's own time (as the daily reward's). A win counts only if the game's win
 *     XP was paid (a friends' lobby's once a day per opponent). Nothing while PAUSE_REWARDS is on.
 *   - **Rewards:** paid by the server through the ledger the moment a game completes a quest, once per quest, in the same batch as
 *     that game's XP: its XP joins the game's XP box ("Quest +300"), its crates (of XP.rewardCrate) and key show in the result's toast.
 *   - **The pool:** only modes always playable (bots fill Squads, 50 v 50 and raids); no auto chess (played on your device), no
 *     ranked 1 v 1 (it needs another person), no "fight boss X" (a raid's boss is drawn at random; Boss alone is played on your
 *     device). `counts`: which counted games move it: "any" any game, "win" a won online game, "boss" an online boss raid,
 *     "bossWin" a won raid, "squads" a Squads game, "crowd" a 50 v 50 game. `weight`: how often it's dealt (wins rarer: the
 *     design's "win quests stay rare"). `icon`: the row's picture ("boss": a live boss's portrait).
 *   - **Progress shown (Eric, Nov 10; docs/decisions/2026-11-10-quest-progress.md):** back on home after a game that moved a quest,
 *     the overlay opens by itself and slides each moved bar from its old count to its new, one after another: `show.startMs` after
 *     it opens, `show.slideMs` each, `show.gapMs` between; a quest it finishes gets `show.finishMs` for its finish (the glow, "Done!",
 *     its reward's burst). A count's tick sound plays at most every `show.tickGapMs`.
 */
export type QuestCounts = "any" | "win" | "boss" | "bossWin" | "squads" | "crowd";
export interface QuestDef {
  id: string;
  name: string;
  goal: string;
  target: number;
  counts: QuestCounts;
  weight: number;
  xp: number;
  crates?: number;
  keys?: number;
  icon: { kind: "boss" } | { kind: "squad" } | { kind: "board"; piece: "knight" | "rook" | "queen" | "pawn" };
}
export const QUESTS = {
  dailyPerDay: 2,
  maxDailies: 3,
  rerollsPerDaily: 1,
  weekStartDay: 1,
  soloMinMinutes: 3,
  /**
   * Hours after the quests overlay is closed (Got it, ×, Escape, a tap outside) before it may open by itself again, either way (the
   * day's first visit, a game that moved a quest), per account on this device; the Quests button opens it any time. Eric, Nov 24: "once
   * you hit got it, it shouldn't appear again. Let's put it on a 12-hour timer so it only reappears for every person every 12 hours unless
   * they manually go to the quest button".
   */
  autoOpenGapHours: 12,
  show: { startMs: 450, slideMs: 750, gapMs: 250, finishMs: 1100, tickGapMs: 70 },
  daily: [
    { id: "boss-hunter", name: "Boss Hunter", goal: "Win a Boss Battle", target: 1, counts: "bossWin", weight: 1, xp: 300, crates: 1, icon: { kind: "boss" } },
    { id: "raid-party", name: "Boss Fighter", goal: "Play 2 Boss Battles", target: 2, counts: "boss", weight: 2, xp: 300, icon: { kind: "boss" } },
    { id: "squad-up", name: "Squad Up", goal: "Play 2 Squads games", target: 2, counts: "squads", weight: 2, xp: 300, icon: { kind: "squad" } },
    { id: "fifty-fifty", name: "Fifty-Fifty", goal: "Play a 50 v 50 game", target: 1, counts: "crowd", weight: 2, xp: 300, icon: { kind: "board", piece: "queen" } },
    { id: "warm-up", name: "Warm Up", goal: "Finish 3 games", target: 3, counts: "any", weight: 2, xp: 300, icon: { kind: "board", piece: "pawn" } },
    { id: "winner", name: "Winner", goal: "Win 2 online games", target: 2, counts: "win", weight: 1, xp: 300, crates: 1, icon: { kind: "board", piece: "rook" } },
  ] as readonly QuestDef[],
  weekly: [
    { id: "regular", name: "Regular", goal: "Complete 10 games", target: 10, counts: "any", weight: 1, xp: 1500, crates: 1, keys: 1, icon: { kind: "board", piece: "knight" } },
  ] as readonly QuestDef[],
} as const;

/**
 * Boingo's claw machine (Eric, Nov 6; docs/decisions/2026-11-06-claw-machine.md): one boss token in, a chance at that boss's Boss
 * Crate. Decided by the server as the coin goes in (server/claw.ts): `winChance` of the time the crate goes into your inventory,
 * unopened. The claw's ride on screen only shows that answer: the stop tap never changes it. At 0.25 a crate costs 4 tokens on
 * average, against BOSS_CRATE_PRICE's 3 tokens (or 1 token and a key): a use for extra tokens, not a cheaper crate.
 *   - `roamSeconds`: how long the claw roams on its own before it drops anyway (no tap needed);
 *   - `dropMs`, `liftMs`, `carryMs`: the claw going down, coming up and carrying over the chute (a loss slips at the top of the lift).
 */
export const CLAW = {
  winChance: 0.25,
  roamSeconds: 8,
  dropMs: 900,
  liftMs: 900,
  carryMs: 1100,
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
   * are in DECISIONS), "review" also opens reviews, "pool" also sends a level that used to ban to the engine pool (`pool`
   * below), "ban" bans it instead. Reports and admins act whatever this says; the automated reviewer never bans. Automatic
   * bans stay off (the outside review of Nov 10, finding 3: the ban bar's evidence is the judges' numbers, which devices
   * send); "pool" since Nov 10 (Eric: "we just keep them in hell basically"), reversible by a person's Release.
   */
  enforcement: "pool" as "watch" | "review" | "pool" | "ban",
  /**
   * A ban means you can't sign in (Eric, Nov 13; docs/decisions/2026-11-13-ban-blocks-sign-in.md): every request to the server with a
   * session (or a browser marked banned) is checked against fair play's cases before its route runs (server/ban-gate.ts). Each Worker
   * instance keeps a "not banned" answer this long per session, so the live line's and the town's polls stay without a database read
   * most of the time; a ban made on the same instance counts at once, one made elsewhere within this long. A minute (the review of
   * #687, minor 5: 30 s at first): a ban counting within a minute costs nothing, and halves the gate's reads on those polls.
   */
  banCheckMs: 60_000,
  /**
   * The engine pool (Eric, Nov 10; docs/decisions/2026-11-10-engine-pool.md): an account detection puts here only ever meets other
   * pooled accounts (or bots) in every queue, and nothing on its screen differs. In: a level that used to ban (`enforcement` "pool"),
   * or a new account with `newHits` of its first `newGames` fair-play matches at the one-match ban bar (`levels.banOne*`), with no
   * review. Out: a person's Release on the review page. Its evidence is kept while it's pooled. (Since Nov 11 one deep-checked match
   * past every `banOne*` bar pools too, as the two-match path does: Eric, "It's better we put people in this queue than under";
   * docs/decisions/2026-11-11-near-best.md.)
   */
  pool: {
    newGames: 10,
    newHits: 2,
    /**
     * The pool list's hints (admin.ts, poolHint): "getting crushed" from 1 v 1 games against pooled players only (at least `games`, scoring
     * under `below`); crowd and raid results never (bots and bosses beat everyone). "Strength down": the in-pool matches' average
     * (`dropMatches` or more) `drop` or more below the best of the matches that pooled them.
     */
    hint: { games: 5, below: 0.3, drop: 400, dropMatches: 3 },
    /** The pool's JSON download: players per file (each file's full case: about 10 queries a player, under D1's 1,000 a request). */
    exportPage: 50,
  },
  reports: {
    /** What a report can be about (the sheet's buttons, in order). Only "cheating" counts toward an automatic review. */
    reasons: ["Cheating", "Offensive name or icon", "Something else"] as const,
    /**
     * A report from a line in the town square's chat (its menu's Report): it carries the line's text and time, which the
     * server reads from the room itself. Not one of the profile sheet's buttons: a report of a line needs the line.
     */
    chatReason: "Offensive chat",
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
   * (native Stockfish, the full network), over every legal move (in groups of at most 8, one search each: the engine's
   * own candidates, never the judges' list; Nov 10). "Deep match": the pick is at or near the deep search's best (`nearBestLoss`). Run by the Worker's schedule: cases in review at once, others off-peak, within a daily
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
    /** The judges' best moves kept with each pick as evidence (FairMove.top): this many. (The re-check searches every legal move.) */
    candidates: 8,
    /**
     * Near the engine's best (Eric, Nov 11; docs/decisions/2026-11-11-near-best.md): a deep-checked pick counts as the engine's best
     * (a "deep match", what `levels.banDeep` and `banOneDeep` read) when it's the search's best or gives away at most this many
     * points of expected score by the search's own numbers (core's nearBest). Two strong engines often prefer different, practically
     * equal moves (the live demo, Nov 11: Stockfish 19's top move was our 17.1's exact best 74% of the time). 1 point is about 0.1 to
     * 0.3 pawns from a level position on Stockfish's win/draw/loss scale (more material, more pawns a point), the judges' own grain
     * for "found the best" (`signals.foundLoss`): never a real mistake. reports/fairplay.md, "Near the engine's best".
     */
    nearBestLoss: 1,
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
     * An engine user's picks against the deep re-check: its best this often, one of its next two or near its best
     * (`deep.nearBestLoss`), neither (its own engine, depth or version can differ from ours). Measured Nov 11: the live demo's
     * Stockfish 19 was our 17.1's exact best 74% of the time; the simulation's other engine splits the rest about 12 to 1
     * (reports/fairplay.md, "Near the engine's best"). Was [0.85, 0.13, 0.02], a guess.
     */
    cheatDeep: [0.74, 0.24, 0.02] as readonly [number, number, number],
    /** Timing: a hard find this fast is suspicious; timing needs this many counted moves with a crowd. */
    fastHardMs: 5_000,
    minTimed: 8,
    /** Timing: think time this little correlated with difficulty (Spearman) is "the same whatever the difficulty". */
    flatCorr: 0.1,
    /**
     * Timing: a pick marked a premove (told to the server before any browser could know its position, the same move)
     * counts as one only when it comes within this long of the clock's start (a premove plays at once: about a round
     * trip); later, it's timed as any pick. A premove's time is left out of timing (fastHard, timeCorr), nothing else.
     */
    premoveMs: 2_000,
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
     * checked among them, a deep-match share (at or near the engine's best: `deep.nearBestLoss`) of `banDeep` and a best match
     * strength of `banPerf`; or one match past every `banOne*` bar. With `enforcement` "pool", either pools (never a ban).
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
    /**
     * Sustained strength (Eric, Nov 11: "People easily get around that by playing the second or third best move ... by 4 or 5 games,
     * if their Elo is just ridiculous like that, put them in the cheater queue"): the newest `poolStrengthMatches` matches in the
     * window with `poolStrengthCounted` counted moves or more each, their match strengths averaging `poolStrength` or more, pool the
     * player whatever their top-move share (a ban-level verdict, as the bars above; never a ban: `enforcement`). Each match is its own
     * lobby, so no one lobby's judges carry it. reports/fairplay.md, "Sustained strength".
     */
    poolStrengthMatches: 5,
    poolStrengthCounted: 8,
    poolStrength: 3000,
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
  /**
   * Seconds between the full lobby showing and its first pre-game vote opening (Eric, Nov 5: players reading the intro
   * missed the vote). The vote, its timer and the bots' votes all start after it.
   */
  firstVoteDelaySeconds: number;
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
  /**
   * Move replay (Eric, Nov 5): coming back to a board (Relay's rotation, Pairs' slots), a move's free seconds grow by
   * this much for each move played on that board since you last played it there (3 moves: +1.5 s), whether the replay
   * is shown or not, so watching the moves you missed never costs your own time. Each match carries its own
   * (`SquadsMatch.replayMsPerMove`).
   */
  replaySecondsPerMove: number;
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
  // Eric, Nov 5: Relay on 3 boards, each squad's fourth player waiting to slot in (the ring: squads/schedule.ts); 4 before.
  boards: { relay: 3, pairs: 2, final: 1 },
  // Eric, Nov 5: 3 s more before the first vote opens, so players reading the intro don't miss it.
  firstVoteDelaySeconds: 3,
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
  // Eric, Nov 5: "+ 0.5 s per move played since you last played".
  replaySecondsPerMove: 0.5,
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
    // (Relay ×4/3 since its 3 boards, Nov 5: three boards pay what four did at ×1; Pairs' 2 and the final's 1 as before.)
    roundScale: [4 / 3, 2, 4],
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

/**
 * Boss battle music (Eric, Nov 11: "Wire boss battle music into the game"; docs/decisions/2026-11-11-boss-music.md;
 * `packages/app/src/music.ts`). Each boss's theme (`packages/app/public/music/themes.json`) plays from the moment the
 * battle starts (the intro's end) until its result, on its own gain into the game's sound, under its effects.
 * - `volume`: the music's gain, where a sound effect plays at 1 (the boss packs, a move's knock). 0.4 (Eric, Nov 14: "a little quieter
 *   than the game"; was 0.25): measured at the speakers, a theme's short-term loudness about -26 LUFS against a move's or the clock
 *   tick's hit at -23 and a capture's at -21 (docs/decisions/2026-11-14-music-level.md).
 * - `fadeMs`: Music or Sound switched off, or the page hidden: faded out over this (and back in).
 * - `endFadeMs`: the battle's result (a win, a loss, leaving): faded out over this, then stopped.
 * - `startDelayS`: from asking to the first note (s), so the intro and the loop are scheduled together.
 * - `splashHoldMs`: a challenge from the town starts the theme as the boss's full-screen splash starts (Eric, Nov 11); a theme not
 *   ready by then holds the splash's covering frame up to this much longer, then the battle goes on and the music joins when ready.
 * - `townPreloadAfterMs`: every theme is fetched (not decoded) in the background this long after the town's first frame, one piece
 *   at a time (Eric, Nov 12: "why not just add all of the songs to the town"; Nov 14: never while the town loads: "christ it's taking
 *   forever"). A theme not in yet is fetched as its battle or room needs it.
 * - `handoffMs`, `handoffWaitMs`: a new audio context (sound.ts rebuilds one after the window was away, or the device changed) takes
 *   the music over seamlessly (Eric, Nov 14: "it froze, stopped for a second... restarted at a different part"): it starts on the new
 *   one at the place the old one is heard at, once the new one's clock runs (waiting at most `handoffWaitMs`), and the old one fades
 *   out over `handoffMs` from there.
 */
/**
 * A building's own music (Eric, Nov 23: "walking into a building no longer triggers the boss's music. I want that to stop."). false:
 * walking into any building leaves the town's music as it is (no boss theme, no fade); a challenge's splash and the battle still play
 * the boss's theme. true brings back Nov 11's room music (the boss's theme as its room shows; app Town.tsx `roomMusicFor`).
 */
export const ROOM_BOSS_MUSIC: boolean = false;

/**
 * Music's timings and level. `towerRecent`: a Battle Tower floor's battle plays one of its bosses' themes, avoiding the themes of this
 * many floors before it on this device (Eric, Nov 19: "it doesn't reuse the same one for, 5 or 6 rounds"; app tower.ts pickFloorTheme).
 */
export const MUSIC = { towerRecent: 5, volume: 0.4, fadeMs: 300, endFadeMs: 1500, startDelayS: 0.05, splashHoldMs: 2000, townPreloadAfterMs: 2000, handoffMs: 300, handoffWaitMs: 1000 } as const;

/**
 * Chess Town's own music (Eric, Nov 14-15: "a song where people literally are like, I want to turn this song on while I'm in the chess
 * town"; docs/decisions/2026-11-15-town-music.md; music.ts `townMusic`): the theme (themes.json's `town`) loops in the street town and
 * in buildings with no music of their own, and now and then one of its piano solos plays instead of the next pass, the theme coming back
 * from its top as the solo ends (Eric: "every few play throughs"). When the first solo comes (Eric, Nov 16: "sometimes in the first
 * minute 30 or sometimes later, not every time early maybe like 33% of the time, but it should always play a solo before 5 minutes or
 * so"; docs/decisions/2026-11-16-town-solos.md): rolled each time the town's music starts.
 * - `earlyChance`: the chance the theme starts partway in, so its first solo comes early (0 to 1). Otherwise it starts from its top.
 * - `earlyEntries`: where it may start, in s into its loop (one of them at random): bar lines, a bar being 240/129 s. Bar 77
 *   (141.395349 s): the solo 37 s in; bar 61 (111.627907 s): 1:07 in.
 * - `earlyFadeS`: a partway start fades in over this (s): the file holds the ring of the bars before it, and a hard start would click.
 * - `firstPasses`: from its top, the passes before the first solo (1: the solo at 2:59).
 * - `passesAfterSolo`: after a solo, the passes before the next, one of these at random (1 or 2: not clockwork).
 * - `order`: the solos by their `id` in themes.json, taking turns (a, b, a, …). Empty: the theme alone.
 * - `aheadS`: how long before a solo it is put on the audio clock, with the theme's return after it (s). The joins are on the clock,
 *   never a timer; this is only how early the timer that schedules them runs (a hidden tab's timers can be a minute late).
 * - `decodeS`: how much earlier than `aheadS` a solo is decoded (s). Only the theme stays decoded while the town plays; a solo is
 *   decoded as its turn nears and let go once it has rung out (Nov 15: about 69 MB for the theme, 16 MB a solo, beside the town's
 *   WebGL on a phone), so at most the theme and one solo are in memory. An early solo is decoded as the music starts. Not decoded by
 *   the time it's due: one more pass.
 */
export const TOWN_MUSIC: {
  readonly earlyChance: number;
  readonly earlyEntries: readonly number[];
  readonly earlyFadeS: number;
  readonly firstPasses: number;
  readonly passesAfterSolo: readonly number[];
  readonly order: readonly string[];
  readonly aheadS: number;
  readonly decodeS: number;
} = { earlyChance: 0.33, earlyEntries: [141.395349, 111.627907], earlyFadeS: 1, firstPasses: 1, passesAfterSolo: [1, 2], order: ["a", "b"], aheadS: 120, decodeS: 30 };

/**
 * The Hidden Boss's music (Nov 13; docs/decisions/2026-11-13-hidden-boss-music.md; the handoff's README, "The Hidden Boss"): one
 * theme for each point of his fight, by its key in themes.json, switched mid-fight (music.ts, `switchPlan`).
 * - `child`: his room and the fight with the child. Not played yet (the child form isn't built): App.tsx's `recluseTheme` is the hook.
 * - `adult`: his adult form (today's phase 1), from the fight's start.
 * - `beaten`: his adult form beaten, through his talk and the absorption (its intro is a book's slam).
 * - `transform`: from his transformation's start; its loop starts as the boards split, which is when its intro ends
 *   (`introSeconds`, read from themes.json: the transformation's start is the split minus that).
 * Fetched (not decoded) as his fight starts, never in the town's loading (2.5 MB, a boss only admins meet).
 */
export const RECLUSE_MUSIC = { child: "recluse-house", adult: "recluse-phase2", beaten: "recluse-beaten", transform: "recluse-phase3" } as const;

/**
 * How one theme gives way to the next mid-fight, by the theme coming in (the handoff's switching rules): what's playing fades out
 * over `fadeMs`; `after`: the new theme starts once that fade is done, else at once (at full level). Any other: at once, over
 * MUSIC.fadeMs.
 */
export const MUSIC_SWITCH: Readonly<Record<string, { readonly fadeMs: number; readonly after: boolean }>> = {
  [RECLUSE_MUSIC.adult]: { fadeMs: 1500, after: true },
  [RECLUSE_MUSIC.beaten]: { fadeMs: 300, after: false },
  [RECLUSE_MUSIC.transform]: { fadeMs: 500, after: false },
  // (Birdie's ult's piece, Nov 23: it opens on a burst of steam at once, his theme fading under it.)
  [BIRDIE_ULT.theme]: { fadeMs: 400, after: false },
};

/**
 * The area banner (Eric, Nov 11, approving its mockup: "super clean. That's exactly what I was imagining";
 * docs/decisions/2026-11-11-area-banner-room-music.md): as you walk into a home's room through its door (once the door's
 * black lifts), its name across a dark band a third down the room's view, the boss's name above it in gold. Taps pass
 * through it. Reduced motion: no fades, shown for the same total time.
 * - `inMs`, `holdMs`, `outMs`: fade in, hold, fade out.
 */
export const AREA_BANNER = { inMs: 400, holdMs: 1800, outMs: 600 } as const;

/**
 * The vote zones' name tags (Eric, Nov 25, look B of the mockup: "the center one of the three, the best"; asked for as "when you
 * actually put your vote in, then they go away because you know what they are"; docs/decisions/2026-11-25-vote-labels.md). On every
 * pawn vote (50 v 50, Squads), a small dark tag above each zone names it as the vote opens: it rises in, bobs gently and lifts away.
 * Gone the moment your vote is in. Reduced motion: no bob, shown for the same time.
 * - `showMs`: how long the tags show from the vote's start (ms).
 * - `goneMs`: your vote in: they fade this fast (ms).
 */
export const VOTE_TAGS = { showMs: 3000, goneMs: 300 } as const;

/** A vibration: one pulse (ms), or on, off, on… (ms) as `navigator.vibrate` takes it. */
export type HapticPattern = number | readonly number[];

/**
 * The installed app's first window on a computer (Eric, Nov 20: it opened narrow, in the phone layout). Chrome opens an installed app
 * small; on its first launch the app opens itself at this size (smaller on a smaller screen) and centers. Only once: a window the player
 * resizes afterward keeps their size (the browser remembers it). The desktop layout with chat starts at 1100 px wide (styles.css).
 */
export const APP_WINDOW = { width: 1600, height: 900 } as const;

/**
 * Haptics (Eric, Nov 9: "when you tap [a piece] … it should vibrate. And then when we drop it on a square … vibrate";
 * docs/decisions/2026-11-09-haptics.md; `packages/app/src/haptics.ts`). Each kind's pattern, in ms; Settings → Sound,
 * "Vibration" switches them all off on the device. On an iPhone each pulse is one system tick (no lengths), at most
 * `iosTicks` of them.
 * - `select`: a tap that picks up one of your pieces (not a press held to drag: `holdMs` and longer is a hold).
 * - `move`: a move you make (a tap on its square, or a dragged piece let go on one; a premove placed; a promotion picked).
 * - The boss moments, each once, on the device that sees it, keyed in `cues` by the art's id and cue (and its animation,
 *   where the same cue plays in another one): Big Boy's toy block landing and his Big Bounce's crash, Babur's balloon
 *   popping, Ginger's ice freezing over a piece, Boingo's pie splat; and QUEEN SLAIN! (Boss.tsx).
 * - `duelFound` (a 1 v 1 opponent found while you browse) and `crateHold` (a crate held) were the game's two buzzes
 *   before Nov 9.
 */
export const HAPTICS = {
  holdMs: 350,
  iosTicks: 3,
  /** Between two ticks of a pattern on an iPhone (ms): the pulse and the gap after it, together. */
  iosTickGapMs: 90,
  patterns: {
    select: 10,
    move: 15,
    bigboyBlock: 35,
    bigboyBounce: [30, 60, 30, 60, 30],
    baburPop: 25,
    gingerFreeze: [20, 40, 20],
    boingoPie: 40,
    queenSlain: [40, 60, 40],
    duelFound: [90, 60, 160],
    crateHold: 15,
  },
  /** The art's cues that vibrate: "<art id> <cue>", or "<art id> <animation> <cue>" for a cue that's in other animations too. */
  cues: {
    "toy-block-top clack": "bigboyBlock",
    "bigboy crash": "bigboyBounce",
    "tigerPump pop": "baburPop",
    "ice-overlay freeze crackle": "gingerFreeze",
    "pie-splat splat": "boingoPie",
  },
} as const satisfies {
  holdMs: number;
  iosTicks: number;
  iosTickGapMs: number;
  patterns: Record<string, HapticPattern>;
  cues: Record<string, string>;
};

export type HapticKind = keyof typeof HAPTICS.patterns;

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
  /**
   * What each piece costs in the shop: its chess value in whole gold, pawn 1, knight 3, bishop 3, rook 5, queen 9 (the TFT-style economy (Eric, Oct 25 and Nov 1, 2026; docs/decisions/2026-11-01-autochess-tft-economy.md);
   * it was the chess value times ten, a bishop 32: 10, 30, 32, 50, 90).
   */
  readonly prices: { readonly p: number; readonly n: number; readonly b: number; readonly r: number; readonly q: number };
  /**
   * The shop (v5, Eric Oct 20; v6 Oct 20 evening; v7 Oct 21): this many offers (4 since v7, was 5), each a piece and a square on
   * your half where it will land; buying an offer rolls a new one into its slot; one reroll of all the offers costs `reroll.first`
   * gold the first time in a round and `reroll.step` more each time after it, up to `reroll.max` (Eric Nov 10: "1 free reroll every round,
   * and then it costs 1 for the next one, and then 2, and it's capped at 2": 0, 1, 2, 2, ...; Oct 25's was 2, 3, 4, 5, 5), back to the first price at each round's start. The shop refills free at each round's start. **The odds follow the level of whoever's shop it is** (v7, Eric Oct 21: "when
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
  /** Selling a piece, from the board or the bench, gives back this share of what was paid for it (its price, and `starUpCost` for each star above the first, v8), rounded to the nearest whole gold, a half up (v6, Eric Oct 20: 75%; whole gold since the TFT-style economy, Nov 1: P1 N2 B2 R4 Q7; it was
   * rounded down on the ×10 scale, P7 N22 B24 R37 Q67). */
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
  /**
   * The buy-and-place step, its locked end (no buying, selling or moving), and how far behind the opponent's circles (and its bench,
   * gold and level) show: 0 since Nov 2, live (Eric: placing first pays, so who placed first must be seen; it was 2 s from Oct 19).
   */
  readonly buySeconds: number;
  readonly lockSeconds: number;
  readonly circlesDelaySeconds: number;
  /**
   * While you buy, a piece is revealed every this many seconds (Eric, Nov 1-2: 3 s; was 5 s at random), piece for piece by kind:
   * a piece shows only with a piece of the other side of its group in `revealGroups` (pawn and pawn, knight or bishop and knight or
   * bishop, rook and rook, queen and queen), the later placed of a pair first. A kind in no group stays hidden until the move step.
   * The rules: packages/app/src/autochess/reveal.ts, docs/decisions/2026-11-02-autochess-reveal.md.
   */
  readonly revealSeconds: number;
  readonly revealGroups: readonly (readonly ("p" | "n" | "b" | "r" | "q")[])[];
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
   * (Eric: "5 cost to upgrade every time... having it be 5 is already generous"; 1 since the TFT-style economy, half a pawn rounded up), whatever the piece and its stars, and merges into the piece
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
  /** A round's income: `first` in round 1, `step` more each round, up to `max` (10, 12, ... 20 since the TFT-style economy; was 100, 120, ... 200). */
  readonly income: { readonly first: number; readonly step: number; readonly max: number };
  /** Interest on gold banked before the income: `gold` for every full `per` banked, up to `max` (Eric, Oct 25: +1 per 10, up to +5 at 50; was 10 per 100, up to 30). */
  readonly interest: { readonly per: number; readonly gold: number; readonly max: number };
  /** After a fight each side gets this share (rounded to the nearest whole gold, a half up, since the TFT-style economy) of everything paid for its pieces still on the board (their prices and their star-ups, v8), win or lose; bench pieces get all of theirs back. */
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
  /** The bot: the chance it banks gold for interest (when it has the gold to; whole `interest.per`s, up to the interest's top), how many moves it tries while adjusting, and the search it uses. */
  readonly bot: {
    /** It locks in at a seeded time between these shares of the step's open part (before its locked end), or never, this often. */
    readonly lockFrom: number;
    readonly lockTo: number;
    readonly neverLockChance: number;
    /**
     * Its shop rerolls (the same climbing price as yours, `shop.reroll`): at most this many a round, only with this much gold, this often
     * (more often when the shop shows nothing but pawns). v7.1: 4 / 40 / 0.15 / 0.4 became 3 / 70 / 0.06 / 0.2, so the bot rerolls in about a third
     * of rounds (63% before, at 2 gold a roll) and spends about what it did on rerolls (2 gold a round). The TFT-style economy (Nov 1): `rerollGold` 7.
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
    /**
     * It buys XP (4 gold for 4 XP) now and then: at most this many a round, with this chance each time it has the gold (more with its board full: a level is room).
     * Nov 10: `xpChanceFull` 0.8 → 0.7 with the free first reroll, so the bot, keeping the gold it spent on rerolls, levels at about the same pace (214 → 210 of 300 test rounds).
     */
    readonly maxXpBuys: number;
    readonly xpGold: number;
    /** With this much gold it buys XP even when that gives no level yet (it saves up for the next). */
    readonly xpRichGold: number;
    readonly xpChance: number;
    readonly xpChanceFull: number;
    /** With no read of you (round 1, or a test that passes none): the chance it banks for interest. */
    readonly saveChance: number;
    /** When it banks for interest it still spends at least this much (a few pieces' worth). */
    readonly saveKeep: number;
    /**
     * It saves when you save (Eric, Nov 10: "if you're saving a bunch of your gold, … it shouldn't spend a ton of its own"). From round 2 it reads your gold
     * at the round's start and what you banked from the last round (never this round's buys): you saving (`banked` or more carried over, or `gold` or more
     * to start) it banks too, `chance` of the time, to your interest steps (the tens you kept beyond this round's income), still spending `saveKeep`, with no
     * rerolls or XP; you spending down, it spends to keep up (no bank). From round `lateRound`, or with either side at `lowHp` HP or less, it never banks.
     */
    readonly follow: { readonly banked: number; readonly gold: number; readonly chance: number; readonly lateRound: number; readonly lowHp: number };
    /** It buys a queen only with this much more left after her (it buys one when rich, not with its last coins). */
    readonly queenChange: number;
    /** Whenever one of its offers is a star-up it can pay for, it buys it this often (Eric: "buys star-ups as a player would", nearly always). */
    readonly starUpChance: number;
    readonly adjustTries: number;
    readonly adjustDestinations: number;
    readonly adjustNodes: number;
    readonly adjustMargin: number;
  };
}

export const AUTOCHESS: AutoChessSettings = {
  prices: { p: 1, n: 3, b: 3, r: 5, q: 9 },
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
    reroll: { first: 0, step: 1, max: 2 },
  },
  sellBack: 0.75,
  benchSlots: 4,
  lockIn: false,
  lockInBonus: 3,
  buySeconds: 30,
  lockSeconds: 3,
  circlesDelaySeconds: 0,
  revealSeconds: 3,
  revealGroups: [["p"], ["n", "b"], ["r"], ["q"]],
  adjustStep: true,
  adjustMode: "stars",
  adjustSeconds: 7,
  adjustMoves: 1,
  starUpCost: 1,
  maxStars: 3,
  moveBase: 5,
  movePerStar: 3,
  fightGlow: false,
  levels: { start: 4, max: 10, freeXp: 2, buyXp: 4, buyXpCost: 4, xpToNext: [4, 8, 12, 16, 20, 24] },
  kingRanks: 2,
  hopEvery: [7, 10],
  hopSeconds: 1.8,
  introSeconds: 10,
  introReplyMs: [1000, 2000],
  introOpenMs: 3000,
  introBubbleMs: 2500,
  fightMoveMs: 600,
  fightNodes: 30000,
  cashInGold: 2,
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
  income: { first: 10, step: 2, max: 20 },
  interest: { per: 10, gold: 1, max: 5 },
  survivorRefund: 0.25,
  winStreakGold: [
    { n: 2, gold: 1 },
    { n: 4, gold: 2 },
    { n: 5, gold: 3 },
  ],
  lossStreakGold: [
    { n: 2, gold: 0 },
    { n: 4, gold: 0 },
    { n: 5, gold: 0 },
  ],
  queenLimit: 1,
  maxPawns: 8,
  pawnsPerFile: 3,
  bot: { lockFrom: 0.3, lockTo: 0.95, neverLockChance: 0.15, maxRerolls: 3, rerollGold: 7, rerollChance: 0.06, rerollChanceBare: 0.2, maxHolds: 2, holdChance: 0.5, placeBy: 0.7, maxXpBuys: 3, xpGold: 6, xpRichGold: 14, xpChance: 0.3, xpChanceFull: 0.7, saveChance: 0.3, saveKeep: 8, follow: { banked: 10, gold: 30, chance: 0.85, lateRound: 7, lowHp: 8 }, queenChange: 4, starUpChance: 0.95, adjustTries: 16, adjustDestinations: 3, adjustNodes: 8000, adjustMargin: 0.02 },
};

/**
 * Residents (Eric, Nov 25: "have 200 bots made which just sit on the server and play ranked ... so like any time of day I can login
 * and see games played"; the design: notes/residents-design.md on claude/director-notes; docs/decisions/2026-11-25-residents-program.md).
 * Real accounts (`users.resident`) played by a headless program outside the game's servers (`scripts/residents/run.ts`), through the
 * same HTTP and WebSocket paths as the app. Every number the program uses is here; the server's side (the route, PAUSE_RESIDENTS) is
 * in packages/server.
 *
 * - `accounts`, `targetOnline`: how many accounts, and about how many online at once (the program's --accounts, --target-online).
 *   `wave`: the online target moves with the residents' own daily shapes (more when more of their evenings overlap) and a slow
 *   swell of `amplitude` every `periodMinutes`, held between `min` and `max` times the target (30: about 15 to 54), so the count
 *   comes in waves, not a flat line. At most `startsPerMinute` sessions begin in a minute.
 * - `ratings`: each resident's Maia rating, fixed by its name: the bots' bell curve (BOT_LOBBY.ratings).
 * - `regions`: home time zones (a share each; whole-hour offsets from UTC, one drawn per resident). `hourWeights`: how likely a
 *   resident is to be on at each local hour (evening peak 18-23, a lunch bump), `weekend` times more on Saturdays and Sundays.
 * - `keenness`: each resident's chance of playing on a given day; `sessions` a day (1-3) of `sessionMinutes` (10-60), at least
 *   `restMinutes` apart, never more than `maxMinutesPerDay`. When too few keen residents are free for the target, the scheduler
 *   tops up from the rest, within the same daily cap (200 accounts can't hold 30 online on 1-3 sessions each).
 * - `behaviors`: shares (of 100) of how residents behave; `dropChance`: in any profile, the chance per game of the socket
 *   dropping and coming back.
 * - `duel`: ranked 1 v 1. `zones`: the shares of Bullet, Blitz and Rapid as a resident's favorite (a slow resident's is Rapid).
 *   `queue`: how residents enter the queue (at most `maxWaiting` of them unpaired at once, each `gapSeconds` apart), so one is
 *   often alone in line and a person who queues meets them within seconds. Think times, resigning and draws: see each field.
 * - `beatSeconds`: the heartbeat to the server; `summaryMinutes`: the log's summary; `homePollMs` / `gamePollMs`: the live line
 *   (/api/live) on home and during a game, as the app polls it (FRONT_DOOR.livePollMs, the 30 s heartbeat).
 * - `host`: the always-on host (the Cloudflare Container `ResidentsHost`, packages/server/src/residents-host.ts; docs/areas/ops.md,
 *   "Residents, the host"). `sleepAfter`: it sleeps after this long without the 15-minute cron's ping (two missed runs). `args`: the
 *   program's options there (a change restarts the host at the cron's next run, games in progress resigned: they're part of its
 *   environment, whose hash it keeps). With `--follow-deploys` the program reads /version.json every `versionCheckMinutes`; after a
 *   deploy it starts nothing new, lets games in progress finish (at most `drainMinutes`, then resigns what's left) and exits for the
 *   host to start it again on the new main.
 */
export const RESIDENTS = {
  accounts: 200,
  targetOnline: 30,
  wave: { min: 0.5, max: 1.8, amplitude: 0.25, periodMinutes: 90 },
  startsPerMinute: 3,
  ratings: { mean: 1150, sd: 250, min: 600, max: 2200, step: 100 },
  regions: [
    { name: "americas", share: 55, offsets: [-8, -7, -6, -5, -5, -4, -3] },
    { name: "europe", share: 25, offsets: [0, 1, 1, 2] },
    { name: "asia-oceania", share: 15, offsets: [5, 7, 8, 9, 10, 11] },
    { name: "elsewhere", share: 5, offsets: [-3, 1, 2, 3, 4] },
  ],
  hourWeights: [0.5, 0.3, 0.15, 0.08, 0.05, 0.05, 0.1, 0.25, 0.35, 0.4, 0.45, 0.55, 0.8, 0.75, 0.5, 0.55, 0.65, 0.8, 1, 1.15, 1.25, 1.25, 1.05, 0.8],
  weekend: 1.3,
  keenness: { min: 0.3, max: 0.9 },
  sessions: { min: 1, max: 3 },
  sessionMinutes: { min: 10, max: 60 },
  restMinutes: 20,
  maxMinutesPerDay: 360,
  behaviors: { normal: 70, slow: 8, leaver: 5, afk: 4, chatty: 8, rageQuit: 5 },
  dropChance: 0.02,
  duel: {
    zones: { bullet: 25, blitz: 50, rapid: 25 },
    queue: { maxWaiting: 3, gapSeconds: [2, 25] as readonly [number, number] },
    /**
     * A resident's vote comes this long after the vote opens (ms): as a person's, so the other player sees its pawn move (Nov 25: the
     * vote now closes a beat after both have picked, RANKED_1V1.voteBothPickedMs). The app's bot game picks the same way.
     */
    pickMs: [1500, 5000] as readonly [number, number],
    /** The first move (White's and Black's): within this long (ms), well inside the 20 s rule. */
    firstMoveMs: [1200, 6000] as readonly [number, number],
    /** Later moves: the clock left spread over this many more moves (never fewer than `minMovesLeft`), plus most of the increment. */
    movesLeft: 35,
    minMovesLeft: 12,
    /** The book moves (the first plies): quicker, this fraction of the usual think. */
    openingPlies: 10,
    openingFactor: 0.4,
    /** More thought in check, or when Maia's top two moves are close (within `closeGap` of each other's chance). */
    checkFactor: 1.5,
    closeGap: 0.1,
    closeFactor: 1.6,
    /** Never less than this (ms), and never closer to the flag than `safetyMs` (a slow resident: sometimes closer, `slowFlagChance`). */
    minThinkMs: 400,
    safetyMs: 1500,
    slowFactor: 2.2,
    slowFlagChance: 0.01,
    /**
     * Resigning a lost game, by the resident's rating (Eric, Nov 25: "can't we just make them not forfeit for a bit longer?"): the first
     * band whose `upTo` holds: material down by `lostBy` or more, from its own `afterMove`th move, this `chance` a move. Players under
     * about 1200 mostly play on to the end, stronger ones resign a clearly lost game. A rage-quitter: down `rageLostBy` from move
     * `rageAfterMove`, `rageChance` a move.
     */
    resign: {
      bands: [
        { upTo: 1199, lostBy: 15, afterMove: 30, chance: 0.04 },
        { upTo: 1599, lostBy: 10, afterMove: 25, chance: 0.08 },
        { upTo: 9999, lostBy: 7, afterMove: 20, chance: 0.12 },
      ],
      rageLostBy: 6,
      rageAfterMove: 12,
      rageChance: 0.25,
    },
    /** Draw offers: material level within 1, from ply `fromPly`, this chance a move; an offer is taken when level and past `acceptFromPly` (`acceptChance`). */
    draw: { fromPly: 60, offerChance: 0.02, acceptFromPly: 40, acceptChance: 0.5 },
    /** A leaver walks away from this share of its games, after 10-30 moves; an AFK resident never makes its first move in `afkNoShow`, and stops moving midgame in `afkStall`. */
    leaverChance: 0.1,
    afkNoShow: 0.08,
    afkStall: 0.08,
    /** A rage-quitter logs off after a loss with this chance. */
    rageLogOff: 0.6,
    /** Quick chat (presets only): a chatty resident greets and says gg this often, and reacts to a capture now and then; others say gg sometimes. */
    chat: { greet: 0.7, gg: 0.8, react: 0.06, normalGg: 0.15 },
    /** Between games: this long on home (ms) before queuing again. */
    homeMs: [5000, 40_000] as readonly [number, number],
  },
  /** The icons residents pick from: the free emoji set every account may use (the server's ICONS). */
  icons: ["♟", "♞", "♝", "♜", "♛", "♚", "🦁", "🦊", "🐺", "🦅", "🐉", "🔥", "⚡", "👑", "🎯", "🧠"] as readonly string[],
  beatSeconds: 60,
  summaryMinutes: 5,
  homePollMs: 5000,
  gamePollMs: 30_000,
  host: { sleepAfter: "30m", args: ["--follow-deploys"], versionCheckMinutes: 2, drainMinutes: 20 },
} as const;
