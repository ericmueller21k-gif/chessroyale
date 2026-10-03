import type { Augment, DrawRule } from "@chessroyale/core";
/**
 * Messages between the browser and the lobby server (one Durable Object per
 * lobby), sent as JSON over a WebSocket. Times are server milliseconds; each
 * server message carries `now` so clients can correct for clock offset.
 */

export interface LobbyPlayer {
  id: string;
  name: string;
  isBot: boolean;
  connected: boolean;
}

export interface NetBoard {
  id: number;
  fen: string;
  lastMove: string | null;
  openingName: string;
  openingMoves?: string[];
  /** Replacements this board slot has had (a new number means a new game). */
  generation: number;
  /** Moves played on this board so far. */
  ply: number;
  /** The last few moves (up to 5) and the position before them, to replay what a player missed. */
  recent: string[];
  recentFrom: string;
  /** Every move from the starting position, to step back through the game. */
  history: string[];
}

/** A board at a glance, for the strip of tiny boards along the top (slots never move; closed ones stay greyed). */
export interface BoardSlot {
  id: number;
  fen: string;
  lastMove: string | null;
  live: boolean;
}

/** One row of the live leaderboard. */
export interface NetStanding {
  id: string;
  name: string;
  /** What the standings rank by: the stage score (move quality only). */
  points: number;
  stageScore: number;
  /** Average round score this stage. */
  avg: number;
  bankMs: number;
  /** Average thinking time per move over the match. */
  avgThinkMs: number;
  /** Engine-based rating estimate from every move so far (null until a few moves). */
  rating: number | null;
  powerUps: number;
  powerUpsUsed: number;
  practice: boolean;
  isBot: boolean;
  /** Knocked out (then `placement` is set). */
  out: boolean;
  placement: number | null;
  /** Crowd 50 v 50: the player's team (the side they play all match). */
  team?: "w" | "b" | null;
}

export interface NetPick {
  playerId: string;
  move: string | null;
  loss: number | null;
  roundScore: number;
}

/** What the host's browser computes for one board after picks lock. */
export interface BoardScore {
  boardId: number;
  bestMove: string;
  bestExpected: number;
  /** Mover's expected score after every picked move (bots included). */
  expectedAfter: Record<string, number>;
  botPicks: Record<string, string>;
  botThinkMs: Record<string, number>;
  /** Bots that used a power-up on this board. */
  botPowerUps?: string[];
}

export interface ScoreJob {
  boardId: number;
  fen: string;
  /** Human picks on this board (null = missed). */
  humanPicks: Record<string, string | null>;
  bots: { id: string; skill: number; powerUps: number }[];
}

/** The 2v2 final, for every screen: teams, whose turn, each finalist's move quality, and the last move. */
export interface NetFinal {
  board: NetBoard;
  /** teams[0] plays the side that was to move when the final started. */
  teams: [string[], string[]];
  /** Turn order (cycled). */
  order: string[];
  /** Moves made so far, and how many there will be in all. */
  turn: number;
  totalTurns: number;
  /** Whose turn it is (null once the final is over). */
  mover: string | null;
  /** Each finalist's average loss per move in the final (null before their first move) and moves made. */
  scores: Record<string, { avg: number | null; moves: number }>;
  /** The move just played, with its loss (null loss = missed, then the engine's move was played). */
  last: null | { playerId: string; move: string; san: string; loss: number | null };
}

export type ClientMessage =
  | { t: "hello"; token?: string; name?: string; device?: "phone" | "computer"; practice?: boolean }
  | { t: "start" }
  | { t: "pick"; key: string; move: string }
  | { t: "powerUp"; key: string }
  | { t: "scores"; key: string; boards: BoardScore[] }
  | { t: "crossCheck"; key: string; boardId: number; ok: boolean; detail?: string }
  /** Crowd augments: this player's vote on the next round's move clock. */
  | { t: "augment"; choice: Augment };

export type ServerMessage = { now: number } & (
  | { t: "welcome"; playerId: string; token: string; code: string }
  | { t: "lobby"; players: LobbyPlayer[]; hostId: string | null; started: boolean; lobbySize: number }
  | { t: "error"; message: string }
  | { t: "opening"; boards: NetBoard[]; until: number }
  | {
      t: "round";
      key: string;
      stage: number;
      round: number;
      /** When the move clock starts (after the new board's settling-in countdown). */
      startsAt: number;
      /** This player's deadline (from their own time bank). */
      deadline: number;
      board: NetBoard | null;
      standings: NetStanding[];
      cutoff: number;
      alive: boolean;
      /** When each bot finishes thinking (ms after the round starts), for the leaderboard's "done" marks. */
      botsDoneIn: Record<string, number>;
      slots: BoardSlot[];
      /** Crowd 50 v 50: the other team is choosing; this player watches (`board` is still sent). */
      watching?: boolean;
      /** The move clock this round (seconds), which augment votes can change. */
      moveClock?: number;
    }
  /** A human has made their move this round (sent to everyone, for the leaderboard). */
  | { t: "moved"; key: string; playerId: string }
  | { t: "locked"; key: string }
  | { t: "scoreRequest"; key: string; jobs: ScoreJob[] }
  /** To the host at the start of a round: every board, so it can search them while players think. */
  | { t: "prefetch"; fens: string[] }
  | {
      t: "reveal";
      key: string;
      stage: number;
      roundsPlayed: number;
      board: NetBoard | null;
      fenBefore: string | null;
      bestMove: string | null;
      playedMove: string | null;
      picks: NetPick[];
      /** How the played move was chosen from the group's picks. */
      drawRule: DrawRule;
      /** For the cross-check: the group's evaluation as the host computed it. */
      expectedAfter: Record<string, number>;
      bestExpected: number | null;
      standings: NetStanding[];
      cutoff: number;
      until: number;
      /** Every board after this round's moves. */
      slots: BoardSlot[];
    }
  | {
      t: "stageBreak";
      stage: number;
      standings: NetStanding[];
      knockedOut: string[];
      cutoff: number;
      nextBoards: NetBoard[];
      until: number;
      placements: Record<string, number>;
      slots: BoardSlot[];
      /** Crowd: players may vote on the next round's move clock until `until`. */
      augments?: boolean;
      moveClock?: number;
    }
  | { t: "spectate"; boards: NetBoard[]; standings: NetStanding[]; stage: number; round: number; slots: BoardSlot[] }
  /** The final's state, sent to everyone after each move and when a new turn starts. */
  | { t: "final"; final: NetFinal; standings: NetStanding[]; slots: BoardSlot[] }
  | {
      t: "results";
      placements: Record<string, number>;
      winner: string;
      lossesByStage: Record<string, number[][]>;
      /** The final leaderboard (ratings, time, power-ups), for the results screen. */
      standings: NetStanding[];
      /** Crowd: who won the game on the board (the side that mated, or the side clearly ahead), null for a draw. */
      gameWinner?: "w" | "b" | null;
    }
);
