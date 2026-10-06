import type { ItemLook } from "@chessroyale/core";
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
  /** A person's account (their public profile: /api/profile/UID). */
  uid?: string;
  /** What they wear (sent once per player: keep the last one seen). */
  look?: ItemLook;
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
  /** A person's crate items (shown on the cut screen). */
  look?: ItemLook;
}

export interface NetPick {
  playerId: string;
  move: string | null;
  loss: number | null;
  roundScore: number;
  /** Used a power-up this round (so the pick can't count as brilliant). */
  usedPowerUp?: boolean;
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
  /** Crowd: bot picks decided at the start of the round (shown live); use these instead of choosing again. */
  botPlan?: Record<string, string>;
  botPlanPowerUps?: string[];
  /** Boss battle, the re-pick after the God King's Last Stand: the move he took back (no bot picks it; it isn't the best). */
  barred?: string;
}

/** A pick shown live in Crowd once you've picked (or while your team watches): visible from `at` (server time). */
export interface LivePick {
  playerId: string;
  move: string;
  at: number;
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
  scores: Record<string, { avg: number | null; moves: number; matchLoss?: number | null; rating?: number | null }>;
  /** The move just played, with its loss (null loss = missed, then the engine's move was played). */
  last: null | { playerId: string; move: string; san: string; loss: number | null };
  /** classic (fixed moves each), team (4v4, 3v3, then 2v2 to the end) or duel (1v1 to the end). */
  format?: "classic" | "team" | "duel";
  /** Team final: turns until the next cut (null on the last step), and who has gone out so far. */
  cutIn?: number | null;
  out?: { id: string; turn: number }[];
  /** Team final: who went out just now (after the move in `last`). */
  justOut?: string[];
}

/** The boss battle, for every screen. */
export interface NetBoss {
  board: NetBoard;
  name: string;
  icon: string;
  /** 1 to 5: how scary the boss is (its Elo stays secret). */
  threat: number;
  /** The side the crowd plays. */
  crowdSide: "w" | "b";
  crowdMoves: number;
  maxMoves: number;
  /** Crowd moves until the boss strikes again (null when it won't strike any more). */
  strikeIn: number | null;
  kills: { id: string; atMove: number }[];
  /** The move number the battle started from (a position from the game just played). */
  startMove: number;
  /** The King, the crowd's champion: charges left, the crowd moves he played, and after which he struck the boss. */
  kingCharges: number;
  kingMoves: number[];
  kingStrikes: number[];
  /** The King has struck: the boss's next move will be a weaker one. */
  staggerNext: boolean;
  /** Boss raid (its own mode), and the opening it starts from. */
  raid: boolean;
  openingName: string | null;
  /** The boss's last move, and who it struck down just now. */
  /** `captured`: the piece it took ("q" for a queen: its banner). */
  lastMove: null | { move: string; san: string; staggered?: boolean; captured?: string };
  justKilled?: string | null;
  /**
   * The God King's Last Stand, once it has happened (he has fallen): the crowd's move he took back, during which
   * crowd move, what it gave away, the bar it crossed, and the charges he still had (they went with him).
   */
  lastStand?: { atMove: number; move: string; loss: number; bar: number; charges: number } | null;
  /** The re-pick after his Last Stand: the move he took back can't be picked. */
  barred?: string | null;
  /** Set when the battle is over. */
  result?: "crowd" | "boss" | "draw";
}

/** A pre-game vote, for every screen: everyone's votes, each visible from `at` (server time). */
export interface NetVote {
  key: string;
  /** Which vote (index into PREGAME_VOTES) and how many there are. */
  index: number;
  count: number;
  startsAt: number;
  until: number;
  votes: { playerId: string; option: number; at: number; side: "w" | "b" }[];
  /** The winning option once counted (then shown until `nextAt`). */
  result: number | null;
  nextAt?: number;
}

export type ClientMessage =
  /** `look`: the crate items you wear (others see them on the cut screen). */
  | { t: "hello"; token?: string; name?: string; device?: "phone" | "computer"; practice?: boolean; rating?: number | null; look?: unknown }
  | { t: "start" }
  | { t: "pick"; key: string; move: string }
  | { t: "powerUp"; key: string }
  | { t: "scores"; key: string; boards: BoardScore[] }
  | { t: "crossCheck"; key: string; boardId: number; ok: boolean; detail?: string }
  /** Crowd: the host's early bot picks for this round. */
  | { t: "botPlan"; key: string; picks: Record<string, string>; powerUps: string[] }
  /** Crowd augments: this player's vote on the next round's move clock. */
  | { t: "augment"; choice: Augment }
  /**
   * Boss battle: this player calls the King. To play this move (their whole turn: no pick of their own), or
   * (`strike`) to strike the boss right now, after which the move goes on and they still pick.
   */
  | { t: "king"; key: string; strike?: boolean }
  /** A pre-game vote (Crowd 50 v 50): the option this player pushed a pawn into. */
  | { t: "vote"; key: string; option: number }
  /** Boss battle, host only: the boss's move. */
  | { t: "bossMove"; key: string; move: string }
  /** Leaving before the match starts (Cancel in the queue): the seat is freed. */
  | { t: "leave" };

export type ServerMessage = { now: number } & (
  | { t: "welcome"; playerId: string; token: string; code: string }
  | {
      t: "lobby";
      players: LobbyPlayer[];
      hostId: string | null;
      started: boolean;
      lobbySize: number;
      /** Matchmade ("Play now"): no host start; the match starts when full or at `fillAt` (server time), bots filling the rest. */
      auto?: boolean;
      fillAt?: number | null;
      /** Matchmade: the seats were filled then (bots in the empty ones); the match begins a moment later. */
      filledAt?: number;
    }
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
      /** Boss battle: the battle as it stands (the God King's charges, a Last Stand's barred move). */
      boss?: NetBoss;
    }
  /** A human has made their move this round (sent to everyone, for the leaderboard). */
  | { t: "moved"; key: string; playerId: string }
  | { t: "locked"; key: string }
  /** `serverRecheck`: the engine server re-checks the close calls, so the host skips its own re-check. */
  | { t: "scoreRequest"; key: string; jobs: ScoreJob[]; serverRecheck?: boolean }
  /** To the host at the start of a round: every board, so it can search them while players think. */
  | {
      t: "prefetch";
      fens: string[];
      /** Crowd: the bots picking this round, so the host can decide their picks now (sent back as botPlan). */
      plan?: { key: string; fen: string; bots: { id: string; skill: number; powerUps: number }[]; barred?: string };
    }
  /** Crowd: the picks so far (bots appear at their thinking time), to players who've picked and to the watching team. */
  | { t: "tally"; key: string; picks: LivePick[] }
  /**
   * Boss battle: calls for the King's strike so far this move, and how many it takes (more than half the crowd).
   * When he strikes, `at` to `until` is the strike on screen: the move clock stands still and `deadline` is this
   * player's new deadline, pushed back by that long.
   */
  | { t: "strike"; key: string; calls: number; needed: number; at?: number; until?: number; deadline?: number }
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
      /** Boss battle: the King played the move, and how many called him; or he struck the boss. */
      king?: boolean;
      kingCalls?: number;
      /**
       * Boss battle: the God King's Last Stand on this move. The played move is shown, then taken back (it isn't on
       * `board`); the clock stands still through it (lastStandMs, already in `until`), then the crowd picks again.
       */
      lastStand?: { move: string; loss: number; bar: number };
      /** Boss battle: the battle after this move (his charges, whether he has fallen). */
      boss?: NetBoss;
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
  /** A pre-game vote: sent when it opens (with the bots' votes and their moments) and with its result. */
  | { t: "vote"; vote: NetVote; standings: NetStanding[] }
  /** A human's vote in the open vote. */
  | { t: "voteCast"; key: string; playerId: string; option: number; at: number; side: "w" | "b" }
  /** Boss battle: the boss's move or strike (`until`: when the next crowd move starts). */
  | { t: "boss"; boss: NetBoss; standings: NetStanding[]; until: number; thinking?: boolean; intro?: boolean }
  /** To the host: play the boss's move. */
  | { t: "bossRequest"; key: string; fen: string; elo: number; nodes: number; stumble?: boolean; stagger?: boolean }
  | {
      t: "results";
      placements: Record<string, number>;
      winner: string;
      lossesByStage: Record<string, number[][]>;
      /** The final leaderboard (ratings, time, power-ups), for the results screen. */
      standings: NetStanding[];
      /** Crowd: who won the game on the board (the side that mated, or the side clearly ahead), null for a draw. */
      gameWinner?: "w" | "b" | null;
      /** Boss battle: who won it. */
      bossResult?: "crowd" | "boss" | "draw";
    }
);
