/**
 * Every tunable in Battle Royale Chess lives here, so playtest changes never
 * touch game code. Starting values come from buildspec.md.
 */

export type ScoreCarry = "reset" | "carry";

export interface Settings {
  lobbySize: number;
  groupSize: number;
  /** The longest a single move may take (seconds), so a round never waits long for anyone. */
  moveClockSeconds: number;
  /** Each player's time bank for the whole match (seconds). Thinking time comes out of it. */
  timeBankSeconds: number;
  /** Added to the bank at the start of every move (seconds), so even an empty bank leaves this long to move. */
  timeIncrementSeconds: number;
  /**
   * Standings count the change in your time bank over the stage at this many
   * points per minute: moving faster than the increment gains, slower loses.
   */
  timeBonusPointsPerMinute: number;
  /** Power-ups (reveal the engine's top 3 moves): how many each player starts with. */
  powerUpsAtStart: number;
  /** Power-ups added for every player who survives a cut. */
  powerUpsPerStage: number;
  /** Using a power-up costs this many points in the stage standings (so saving them pays). */
  powerUpCostPoints: number;
  /** Bots use a power-up when the second-best candidate loses at least this many points. */
  botPowerUpLoss: number;
  /** Each player keeps one colour for a whole stage, swapping at stage breaks (needs 2+ boards). */
  colourPerStage: boolean;
  /** A pick arriving this long after the deadline still counts. */
  lateGraceMs: number;
  revealSeconds: number;
  /** After the reveal, time for the drawn move to animate before the next round. */
  drawnMoveSeconds: number;
  /** How long the grid of openings plays before the first round. */
  openingShowSeconds: number;
  /** Multiplayer: how long the stage-break standings show (solo waits for a tap). */
  stageBreakSeconds: number;
  /** Multiplayer: time to choose a colour for the duel before White is picked for you. */
  colourChoiceSeconds: number;
  roundsPerStage: number;
  /** Players knocked out at the end of each knockout stage; the duel follows. */
  knockoutsPerStage: readonly number[];
  scoresBetweenStages: ScoreCarry;
  missedMoveScore: number;
  openingPlies: number;
  /** A line qualifies if the side to move's expected score at its end is inside this window. */
  openingBalance: readonly [number, number];
  /** Retire a board once either side's expected score reaches this. */
  retireThreshold: number;
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
  duelClockSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = {
  lobbySize: 32,
  groupSize: 4,
  moveClockSeconds: 30,
  timeBankSeconds: 600,
  timeIncrementSeconds: 5,
  timeBonusPointsPerMinute: 2,
  powerUpsAtStart: 1,
  powerUpsPerStage: 1,
  powerUpCostPoints: 4,
  botPowerUpLoss: 15,
  colourPerStage: true,
  lateGraceMs: 300,
  revealSeconds: 4,
  drawnMoveSeconds: 1.5,
  openingShowSeconds: 6,
  stageBreakSeconds: 10,
  colourChoiceSeconds: 15,
  roundsPerStage: 8,
  knockoutsPerStage: [8, 8, 8, 4, 2],
  scoresBetweenStages: "reset",
  missedMoveScore: -25,
  openingPlies: 20,
  openingBalance: [0.4, 0.6],
  retireThreshold: 0.9,
  engineNodes: 250_000,
  engineHashMb: 16,
  botCandidateMoves: 8,
  botSkillRange: [0.25, 32],
  botRandomMoveChance: 0.02,
  botThinkSeconds: [3, 20],
  duelClockSeconds: 180,
};

/** `count` bot skills spread evenly on a log scale across `botSkillRange`, strongest first. */
export function botSkillSpread(count: number, settings: Settings = DEFAULT_SETTINGS): number[] {
  const [lo, hi] = settings.botSkillRange;
  return Array.from({ length: count }, (_, i) => Math.round(lo * Math.pow(hi / lo, i / Math.max(1, count - 1)) * 1000) / 1000);
}
