/**
 * Every tunable in Battle Royale Chess lives here, so playtest changes never
 * touch game code. Starting values come from buildspec.md.
 */

export type ScoreCarry = "reset" | "carry";

export interface Settings {
  lobbySize: number;
  groupSize: number;
  /** Seconds a player has to pick a move. */
  moveClockSeconds: number;
  /** A pick arriving this long after the deadline still counts. */
  lateGraceMs: number;
  revealSeconds: number;
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
  /** Bot skill temperatures (in points of loss); lower is stronger. Chosen in milestone 2. */
  botSkills: readonly number[];
  botRandomMoveChance: number;
  /** Bots' recorded thinking time, for tie-breaks (seconds). */
  botThinkSeconds: readonly [number, number];
  duelClockSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = {
  lobbySize: 32,
  groupSize: 4,
  moveClockSeconds: 10,
  lateGraceMs: 300,
  revealSeconds: 4,
  roundsPerStage: 8,
  knockoutsPerStage: [8, 8, 8, 4, 2],
  scoresBetweenStages: "reset",
  missedMoveScore: -25,
  openingPlies: 20,
  openingBalance: [0.4, 0.6],
  retireThreshold: 0.9,
  engineNodes: 100_000,
  engineHashMb: 16,
  botCandidateMoves: 8,
  botSkills: [0.5, 1, 2, 3, 5, 8, 12, 20],
  botRandomMoveChance: 0.02,
  botThinkSeconds: [2, 8],
  duelClockSeconds: 180,
};
