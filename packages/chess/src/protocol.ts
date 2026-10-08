import type { ItemLook } from "@chessroyale/core";
import type { Augment, DrawRule } from "@chessroyale/core";
import type { LastStandRound } from "./runner.ts";
import type { JudgeJob, JudgeReport, JudgeRules } from "./judge.ts";
import type { MoveScore } from "./uci.ts";
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
  /** A person's account (a tap on their name opens /api/profile/UID). */
  uid?: string;
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
  /**
   * From the same searches: each scored move's best reply, and a forced mate in its line (moves, from the mover's
   * side). The God King's Last Stand names what a blunder loses with them.
   */
  replies?: Record<string, string>;
  mates?: Record<string, number>;
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
  /** Picks that can decide the cut (players near the cut line): re-checked first (recheckCut* in settings). */
  priority?: string[];
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
   * crowd move, what it gave away, the bar it crossed, and the charges he still had (each player still in got
   * that many power-ups). For the results card: the position before the move, the best move, the crowd's chances
   * after the best move and after the blunder (0-1), the boss's best reply and a mate it allowed (boss's moves).
   */
  lastStand?: {
    atMove: number;
    move: string;
    loss: number;
    bar: number;
    charges: number;
    fen?: string;
    bestMove?: string;
    before?: number;
    after?: number;
    reply?: string;
    mateIn?: number;
  } | null;
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
  /**
   * Everyone's votes, each shown from `at`. Once counted, everyone who didn't vote joins the winner (`joined`: added
   * when time ran out, see closePregameVote), so the final counts and the pawns show them.
   */
  votes: { playerId: string; option: number; at: number; side: "w" | "b"; joined?: true }[];
  /** The winning option once counted (then shown until `nextAt`). */
  result: number | null;
  nextAt?: number;
  /** A player may move their pawn to another zone after voting (voteChangeAllowed; off: one vote each). */
  changeAllowed?: boolean;
}

/**
 * Quick chat: one line said in the match (a phrase or emoji id from core/chat.ts; never free text). `team` is the
 * sender's team when they said it (null: everyone is one team, as in a raid). `at` (server time) is when to show it
 * (a bot's line comes a moment after what it reacts to). `icon` is the sender's pixel icon, sent with their first
 * line to each player (keep it).
 */
export interface NetChatLine {
  n: number;
  from: string;
  say: string;
  to: "team" | "all";
  team: "w" | "b" | null;
  at: number;
  icon?: string;
}

/** Why the server dropped a chat line (the app mirrors the limits, so this is rare). */
export type ChatRefusal = "unknown" | "locked" | "team" | "gap" | "burst" | "repeat" | "closed" | "off";

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
  | { t: "leave" }
  /** Quick chat: say a line (a phrase or emoji id) to your team or, for Hello and Sporting lines and emoji, to everyone. */
  | { t: "chat"; say: string; to?: "team" | "all" }
  /**
   * Quick chat, this device's choices: chat off (nothing is sent to it, and it can't send), and the players muted
   * for this match (their lines aren't sent to it).
   */
  | { t: "chatPrefs"; off?: boolean; muted?: string[] }
  /** Many judges: this device's engine speed (nodes per second), from its speed check on joining. */
  | { t: "speed"; nps: number }
  /** Many judges: this device's answer to one scoring job. */
  | { t: "judged"; key: string; id: string; report: JudgeReport }
  /** Many judges, deep checks: this device's re-check of the job's close calls (sent after its "judged"). */
  | { t: "judgedDeep"; key: string; id: string; deep: MoveScore[] };

/** Why a lobby closed (see LOBBY_LIFE in settings.ts). */
export type LobbyCloseReason = "ended" | "idle" | "abandoned";

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
      /** Matchmade, Bots off: no bots; it waits until it's full (a raid: or `fillAt` with enough people). */
      botsOff?: true;
      /** Matchmade: the seats were filled then (bots in the empty ones); the match begins a moment later. */
      filledAt?: number;
    }
  /** Can't join (or play on). `ended`: the match is over (or long gone), so the app goes home with a note. */
  | { t: "error"; message: string; ended?: true }
  /**
   * The lobby is closing: its results have been up long enough (`ended`), it never started and nothing happened in it
   * for a long time (`idle`), or nobody had been in its match for hours (`abandoned`). The socket closes next, and
   * the lobby's code is free again. The app goes home with a note.
   */
  | { t: "closed"; reason: LobbyCloseReason }
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
  /**
   * Many judges: scoring jobs for this device (positions and picks, no names). Answer each with "judged". A job
   * with `referee` is a second opinion after two judges disagreed (it doesn't hold up the round).
   */
  | { t: "judge"; key: string; jobs: JudgeJob[] }
  /** `serverRecheck`: the engine server re-checks the close calls, so the host skips its own re-check. */
  | { t: "scoreRequest"; key: string; jobs: ScoreJob[]; serverRecheck?: boolean }
  /** To the host at the start of a round: every board, so it can search them while players think. */
  | {
      t: "prefetch";
      fens: string[];
      /** Crowd: the bots picking this round, so the host can decide their picks now (sent back as botPlan). */
      plan?: {
        key: string;
        fen: string;
        bots: { id: string; skill: number; powerUps: number }[];
        barred?: string;
        /** Many judges: the bots pick from this seed and these rules (judgeBotPicks), so the scoring job agrees. */
        seed?: number;
        rules?: JudgeRules;
      };
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
      lastStand?: LastStandRound;
      /** Boss battle: the battle after this move (his charges, whether he has fallen). */
      boss?: NetBoss;
      /** Scored by two judges (and the engine server where they disagreed): no cross-check needed. */
      judged?: true;
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
  /** Quick chat: a line for you (your own included, echoed back). */
  | { t: "chat"; line: NetChatLine }
  /**
   * Quick chat, on (re)joining a started match: the recent lines you can see, and the chat packs the server knows
   * you own (the buttons to show).
   */
  | { t: "chatLog"; lines: NetChatLine[]; packs: string[] }
  /** Quick chat: your line was dropped; `retryAt` (server time) is when it (or anything, for the gap and burst limits) could go. */
  | { t: "chatNo"; say: string; reason: ChatRefusal; retryAt: number }
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
      /** It counted for ranking (real players filled at least RANKING.rankedMinHumanShare of the seats). Missing: an older server. */
      ranked?: boolean;
    }
);
