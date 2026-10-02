import type { BoardRound } from "@chessroyale/chess";
import type { Settings } from "@chessroyale/core";

/**
 * What the screens need from a match, whether it runs in this browser (solo)
 * or on the lobby server (multiplayer). Screens only ever talk to this.
 */

/** A board as a player sees it. */
export interface BoardView {
  id: number;
  fen: string;
  lastMove: string | null;
  openingName: string;
  /** The named opening's moves, for the opening animation. */
  openingMoves?: string[];
}

export interface Standing {
  id: string;
  name: string;
  score: number;
  isYou: boolean;
}

export interface MoveRecord {
  stage: number;
  round: number;
  fen: string;
  move: string | null;
  san: string;
  loss: number | null;
  roundScore: number;
}

export interface DuelView {
  opponentName: string;
  youColour: "w" | "b";
  fen: string;
  history: string[];
  lastMove: string | null;
  clocks: { w: number; b: number };
  /** When the side to move's clock started (local time). */
  turnStartedAt: number;
  over: null | { winner: "you" | "opponent" | "draw"; reason: string };
}

/** The reveal: your group's picks and scores (same shape the server sends). */
export type GroupReveal = Pick<BoardRound, "fenBefore" | "bestMove" | "playerIds"> & {
  result: Pick<BoardRound["result"], "players" | "playedMove">;
};

export type Phase =
  | { kind: "loading" }
  | { kind: "lobby" }
  | { kind: "opening"; boards: BoardView[] }
  | { kind: "play"; board: BoardView; deadline: number }
  | { kind: "scoring"; board: BoardView; move: string | null }
  | { kind: "reveal"; mine: GroupReveal; board: BoardView }
  | { kind: "stageBreak"; stage: number; standings: Standing[]; knockedOut: Standing[]; cutoff: number; youOut: boolean; nextBoards: BoardView[] }
  | { kind: "simulating"; stage: number; round: number }
  | { kind: "spectating"; boards: BoardView[] }
  | { kind: "duelColour"; opponentName: string }
  | { kind: "duel"; duel: DuelView }
  | { kind: "results"; placement: number; winner: string; youWon: boolean };

export interface GameView {
  readonly settings: Settings;
  readonly phase: Phase;
  readonly playerName: string;
  /** Current stage (0-based) and rounds completed in it. */
  readonly stage: number;
  readonly roundsPlayed: number;
  readonly totalPlayers: number;
  readonly placement: number | null;
  readonly lossesByStage: number[][];
  readonly moves: MoveRecord[];
  readonly scoringMs: number[];
  standings(): Standing[];
  /** Players ranked at or below this many go out at the end of the stage. */
  readonly cutoff: number;
  nameOf(id: string): string;
  isYou(id: string): boolean;
  subscribe(fn: () => void): () => void;
  submit(move: string | null): void;
  skipReveal(): void;
  continueFromBreak(): void;
  chooseColour(colour: "w" | "b"): void;
  duelMove(move: string): void;
  resign(): void;
  finishAfterDuel(): void;
  duelClocks(d: DuelView): { w: number; b: number };
}
