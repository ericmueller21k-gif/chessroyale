import type { BoardRound, BoardSlot, NetFinal, NetStanding } from "@chessroyale/chess";
import { roundsInStage, type Settings } from "@chessroyale/core";

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
  /** A new number means the board was replaced with a fresh game. */
  generation: number;
  /** Moves played on the board so far. */
  ply: number;
  /** The last few moves and the position before them, to replay what you missed. */
  recent: string[];
  recentFrom: string;
  /** Every move from the starting position, to step back through the game. */
  history: string[];
}

/** One row of the live leaderboard. */
export type Standing = NetStanding & { isYou: boolean };

/** A power-up's suggestion: one of the engine's top moves and the mover's expected score after it. */
export interface Hint {
  move: string;
  san: string;
  expected: number;
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

/** The 2v2 final as the screens see it (same shape the server sends, with the board as a view). */
export type FinalView = Omit<NetFinal, "board"> & { board: BoardView };

/** The reveal: your group's picks and scores (same shape the server sends). */
export type GroupReveal = Pick<BoardRound, "fenBefore" | "bestMove" | "playerIds"> & {
  result: Pick<BoardRound["result"], "players" | "playedMove" | "drawRule">;
};

export type Phase =
  | { kind: "loading" }
  | { kind: "lobby" }
  | { kind: "opening"; boards: BoardView[] }
  /** `startsAt`: when the move clock starts (after the new board's settling-in countdown). */
  | { kind: "play"; board: BoardView; startsAt: number; deadline: number; allowedMs: number }
  | { kind: "scoring"; board: BoardView; move: string | null }
  /** `until`: when the next board comes up (local time). */
  | { kind: "reveal"; mine: GroupReveal; board: BoardView; until: number }
  | { kind: "stageBreak"; stage: number; standings: Standing[]; knockedOut: Standing[]; cutoff: number; youOut: boolean; nextBoards: BoardView[] }
  | { kind: "simulating"; stage: number; round: number }
  | { kind: "spectating"; boards: BoardView[] }
  /** The final, watching (or between your turns). */
  | { kind: "final"; final: FinalView }
  | { kind: "results"; placement: number; winner: string; youWon: boolean };

export interface GameView {
  readonly settings: Settings;
  /** Multiplayer: the server moves the match on, so there are no "continue" taps. */
  readonly serverPaced?: boolean;
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
  /** The live leaderboard: alive players best first, then those knocked out. */
  standings(): Standing[];
  /** Practice mode: unlimited power-ups. */
  readonly practice: boolean;
  /** Power-ups you can use now (Infinity in practice mode). */
  powerUpsLeft(): number;
  /** This move's power-up suggestions, once used. */
  readonly hint: Hint[] | null;
  /** Uses a power-up on the current move: the engine's top 3 moves. */
  usePowerUp(): void;
  /** White's expected score in a position (for the evaluation bar), from this device's engine. */
  evaluate(fen: string): Promise<number | null>;
  /** Players who have moved this round (lights up the leaderboard as they finish). */
  readonly done: ReadonlySet<string>;
  /** Moves already seen on each board (key "id:generation"), to replay only what you missed. */
  readonly seen: Map<string, number>;
  /** Players ranked at or below this many go out at the end of the stage. */
  readonly cutoff: number;
  nameOf(id: string): string;
  isYou(id: string): boolean;
  subscribe(fn: () => void): () => void;
  submit(move: string | null): void;
  skipReveal(): void;
  continueFromBreak(): void;
  /** The 2v2 final once it has started (also during your own turn in it). */
  readonly final: FinalView | null;
  /** Every board slot as it stands now, for the strip of tiny boards along the top. */
  slots(): BoardSlot[];
}

/** The board you're on this turn (highlighted in the strip), if any. */
export function myBoardId(m: Pick<GameView, "phase" | "final">): number | null {
  const p = m.phase;
  if (p.kind === "play" || p.kind === "scoring" || p.kind === "reveal") return p.board.id;
  if (p.kind === "final") return p.final.board.id;
  return null;
}

/** While a round is being played, the leaderboard shows who has moved. */
export const roundLive = (m: Pick<GameView, "phase">) => m.phase.kind === "play" || m.phase.kind === "scoring";

/** What the leaderboard's cut line says during a stage. */
export const cutLabel = (m: Pick<GameView, "settings" | "stage">) =>
  m.stage === m.settings.knockoutsPerStage.length - 1
    ? `Final four line · after round ${roundsInStage(m.settings, m.stage)}`
    : `Cut after round ${roundsInStage(m.settings, m.stage)}`;
