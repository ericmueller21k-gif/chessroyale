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
  /** The last few moves (up to 4) and the position before them, to replay what a player missed. */
  recent: string[];
  recentFrom: string;
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

export interface NetDuel {
  white: string;
  black: string;
  fen: string;
  history: string[];
  lastMove: string | null;
  clocks: { w: number; b: number };
  turnStartedAt: number;
  over: null | { winner: string | "draw"; reason: string };
}

export type ClientMessage =
  | { t: "hello"; token?: string; name?: string; device?: "phone" | "computer"; practice?: boolean }
  | { t: "start" }
  | { t: "pick"; key: string; move: string }
  | { t: "powerUp"; key: string }
  | { t: "scores"; key: string; boards: BoardScore[] }
  | { t: "crossCheck"; key: string; boardId: number; ok: boolean; detail?: string }
  | { t: "chooseColour"; colour: "w" | "b" }
  | { t: "duelMove"; move: string }
  | { t: "resign" }
  | { t: "botMove"; ply: number; move: string; loss: number | null }
  | { t: "duelLoss"; ply: number; loss: number };

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
      /** This player's deadline (from their own time bank). */
      deadline: number;
      board: NetBoard | null;
      standings: NetStanding[];
      cutoff: number;
      alive: boolean;
      /** When each bot finishes thinking (ms after the round starts), for the leaderboard's "done" marks. */
      botsDoneIn: Record<string, number>;
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
      /** For the cross-check: the group's evaluation as the host computed it. */
      expectedAfter: Record<string, number>;
      bestExpected: number | null;
      standings: NetStanding[];
      cutoff: number;
      until: number;
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
    }
  | { t: "spectate"; boards: NetBoard[]; standings: NetStanding[]; stage: number; round: number }
  | { t: "chooseColour"; chooserId: string; until: number }
  | { t: "duel"; duel: NetDuel; finalists: [string, string] }
  | { t: "botMoveRequest"; ply: number; fen: string; skill: number }
  | { t: "duelScoreRequest"; ply: number; fen: string; move: string }
  | { t: "results"; placements: Record<string, number>; winner: string; lossesByStage: Record<string, number[][]> }
);
