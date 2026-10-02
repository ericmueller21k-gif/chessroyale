/**
 * Every tunable in Battle Royale Chess lives here, so playtest changes never
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

export interface Settings {
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
  /** Players knocked out at the end of each knockout stage; the 2v2 final follows. */
  knockoutsPerStage: readonly number[];
  scoresBetweenStages: ScoreCarry;
  missedMoveScore: number;
  /** Draw rule per knockout stage (the last entry covers later stages). */
  drawRuleByStage: readonly DrawRule[];
  /** Weighted draw: a pick's tickets halve for roughly every this-many × 0.7 points of loss (exp(-loss / this)). */
  drawWeightPoints: number;
  openingPlies: number;
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
  lobbySize: 64,
  groupSize: 8,
  moveClockSeconds: 30,
  timeBankSeconds: 600,
  timeIncrementSeconds: 5,
  powerUpsAtStart: 1,
  powerUpsPerStage: 1,
  botPowerUpLoss: 15,
  colourPerStage: true,
  lateGraceMs: 300,
  revealSeconds: 5,
  drawnMoveSeconds: 4,
  boardIntroSeconds: 5,
  openingShowSeconds: 6,
  stageBreakSeconds: 10,
  roundsPerStage: 5,
  knockoutsPerStage: [8, 8, 8, 8, 8, 8, 8, 4],
  scoresBetweenStages: "reset",
  missedMoveScore: -25,
  drawRuleByStage: ["popular", "best"],
  drawWeightPoints: 4,
  openingPlies: 20,
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
