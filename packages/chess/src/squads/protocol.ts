import type { ItemLook } from "@chessroyale/core";
import type { LobbyCloseReason } from "../protocol.ts";
import type { MoveScore } from "../uci.ts";
import type { BoardResult, Colour, Side } from "./board.ts";
import type { SquadsFormat, SquadsRound } from "./lobby.ts";
import type { ChoiceError, MatchResult, Role, SquadsEvent } from "./match.ts";
import type { SquadsRules, SquadsVoteId } from "./votes.ts";

/**
 * Squads' messages between the app and the server, sent as JSON over WebSockets (docs/areas/squads.md, "The
 * server"). Two kinds of socket:
 *   - a **party** (`/api/squads/party/CODE/ws`): up to 4 friends gather under an invite code or link; the leader queues
 *     them; the party is told which lobby to join and its pass.
 *   - a **lobby** (`/api/squads/lobby/CODE/ws`): the 32 seats, the votes, the bracket and every match in it.
 * Times are server milliseconds; each server message carries `now` so the app can correct for clock offset. Moves are
 * UCI. `hello` carries the app's protocol version (`v`); a server that doesn't speak it says so ("error").
 *
 * Version 1 (Oct 10, 2026): the first (team clocks: one bank per squad for the whole tournament).
 */
export const SQUADS_PROTOCOL = 1;

/** A squad's placement: 1st, 2nd, 3rd-4th (out in round 2), 5th-8th (out in round 1). */
export type SquadsPlacement = 1 | 2 | 3 | 5;

// ---------------- The lobby ----------------

export interface NetSquadsPlayer {
  id: string;
  name: string;
  isBot: boolean;
  connected: boolean;
  /** The party they came with (people who came alone have one of their own); null for a bot. */
  partyId: string | null;
  /** A bot plays this seat now: a bot, or a person's seat a bot has taken over (`replaced`: repeat no-shows, or they left). */
  botPlays: boolean;
  replaced?: true;
  /** They left the lobby (knocked out and gone to queue again, or quit). */
  left?: true;
  /** Missed actions this lobby (every one is logged). */
  misses: number;
  /** A person's account (their public profile: /api/profile/UID). */
  uid?: string;
  /** What they wear (sent once per player: keep the last one seen). */
  look?: ItemLook;
}

/** A squad: its seats in order (seat 0 is the rules' "player 1"), and its placement once it's out or has won. */
export interface NetSquad {
  id: number;
  seats: string[];
  placement: SquadsPlacement | null;
}

/** One match of the bracket. Round 0 is Relay (4 matches), 1 Pairs (2), 2 the final. */
export interface NetBracketMatch {
  /** "r0m2": round 1, match 3 (the key of its NetSquadsMatch). */
  key: string;
  round: SquadsRound;
  index: number;
  format: SquadsFormat;
  /** The two squads (ids): null until the round before decides them. */
  squads: [number | null, number | null];
  winner: number | null;
  /** waiting: for its squads; break: both are in, it starts at `startsAt`; playing (Armageddon included); over. */
  state: "waiting" | "break" | "playing" | "over";
  startsAt?: number;
  /** Once over: the points, and how it was decided. */
  points?: [number, number];
  how?: MatchResult["how"];
}

/**
 * The lobby, for every screen. Phases: waiting (the queue screen: people join until `fillAt`), filled (the seats are
 * full, bots in the empty ones, squads formed: the queue screen's full grid for a moment), vote (the pre-game votes),
 * bracket (the matches), results (every placement decided; the lobby closes LOBBY_LIFE later).
 */
export interface NetSquadsLobby {
  code: string;
  phase: "waiting" | "filled" | "vote" | "bracket" | "results";
  /** Everyone in it: people in the order they joined, then the bots. */
  players: NetSquadsPlayer[];
  seats: number;
  /** When bots fill the empty seats (server time); null in a lobby that waits for its test start. */
  fillAt: number | null;
  filledAt: number | null;
  /** Empty until the lobby fills. */
  squads: NetSquad[];
  /** Empty until it's drawn (after the votes). */
  bracket: NetBracketMatch[];
  /** The votes' result, once decided. */
  rules: SquadsRules | null;
  /** Every squad's team clock (empty until the bracket is drawn). */
  clocks: NetTeamClock[];
  /** A test lobby (the test controls): where it started, and whether a test control has been used (no rewards then). */
  test?: { start: SquadsRound; used: boolean };
}

/** A pre-game vote (Start, then Clock): the whole lobby votes once, before round 1, on Crowd's machinery. */
export interface NetSquadsVote {
  key: string;
  id: SquadsVoteId;
  /** Which vote (index into squadsVotes()) and how many there are. */
  index: number;
  count: number;
  startsAt: number;
  until: number;
  /**
   * Everyone's votes, each shown from `at` (server time). Once counted, everyone who didn't vote joins the winner
   * (`joined`), as in Crowd.
   */
  votes: { playerId: string; option: number; at: number; squad: number; joined?: true }[];
  /** The winning option once counted (then shown until `nextAt`). */
  result: number | null;
  nextAt?: number;
}

// ---------------- A match ----------------

export interface NetSquadsBoard {
  id: number;
  /** Where the board started (the starting position or an opening's last position), and the opening's library id. */
  startFen: string;
  openingId: string | null;
  fen: string;
  /** Moves played in this match, from startFen (only in "match" messages: a "half" carries the new ones in its events). */
  moves?: string[];
  /** How many moves have been played (check it against your own list; ask "sync" if it differs). */
  ply: number;
  lastMove: string | null;
  /** The side of the match that plays White here. */
  white: Side;
  result: BoardResult | null;
}

/** Who acts in a half on a board: a Relay move (one player), a pair's picks, the final's picks or blocks. */
export interface NetDuty {
  board: number;
  side: Side;
  role: Role;
  players: string[];
  /** When their time is up (server time): the per-move ceiling, or (moves and picks) their side's bank if shorter. */
  deadline: number;
}

/** The half being played: White's moves on every board, then Black's (the final: the White squad's move, then Black's). */
export interface NetSquadsHalf {
  /** Counts the match's halves from 0: "choose" and "lock" name it, so a late message never lands in the next half. */
  seq: number;
  turn: number;
  half: Colour;
  startedAt: number;
  duties: NetDuty[];
  /** Whoever's turn it would be on a finished board: they sit this half out (and scout). */
  scouts: NetDuty[];
  /** The final's mercy rule: no blocks this move (the side to move has few legal moves). */
  mercy: "few_moves" | null;
  /** Boards whose side to move has one legal move: it plays itself. */
  forced: number[];
}

export interface NetSquadsMatch {
  key: string;
  round: SquadsRound;
  index: number;
  format: SquadsFormat;
  /** The Armageddon board after a drawn final (Black has draw odds, White more time). */
  armageddon: boolean;
  /** Side 0 and side 1: each squad's id and its seats in order. */
  sides: [{ squadId: number; seats: string[] }, { squadId: number; seats: string[] }];
  boards: NetSquadsBoard[];
  turn: number;
  half: Colour;
  /**
   * Each side's team bank (ms) as the current half began (Armageddon: its own fixed clocks). During a half it drains past
   * `delayMs` (the free seconds a move) once for each of that squad's moves still being thought about (blockers don't
   * drain it). On screen, a duty whose players haven't all locked in is still being thought about; the exact bank
   * (the rules count each player's last choice) comes with the "half". At 0 the squad is in sudden death: each move
   * within `delayMs`.
   */
  banks: [number, number];
  delayMs: number;
  /** Credited to a squad's bank after each move it made in time. */
  incrementMs: number;
  /**
   * break: about to start (the first half at `startsAt`); half: a half is being played (`current`); show: the half's
   * moves landing, the reveal and the coin (the next half at `startsAt`); armageddon: a drawn final, its Armageddon's
   * colours being chosen (`armageddonChoice`); over.
   */
  state: "break" | "half" | "show" | "armageddon" | "over";
  startsAt: number | null;
  current: NetSquadsHalf | null;
  result: MatchResult | null;
  /** After a drawn final: its points and each side's team bank left (which decided who picks Armageddon's colours). */
  drawnFinal?: { points: [number, number]; timeLeft: [number, number] };
  /** A drawn final: the side that picks Armageddon's colours (its squad's people; bots take Black), until when, and the pick so far. */
  armageddonChoice?: { chooser: Side; until: number; colour: Colour | null };
}

/**
 * A squad's team clock, for every player (each squad's clock beside its name and rank): its bank (ms) as of `since`,
 * and whether it's in sudden death. `key`: the match it's playing now (null between matches), whose current half began
 * at `since`; during that half the bank drains as `NetSquadsMatch.banks` says (the match's duties and who has locked
 * in, from "turn" and "choices").
 */
export interface NetTeamClock {
  squadId: number;
  bankMs: number;
  suddenDeath: boolean;
  key: string | null;
  since: number | null;
}

// ---------------- Messages: the lobby ----------------

export type SquadsClientMessage =
  /**
   * Joining or rejoining (`token`: your seat, from "welcome"). `party`: the pass your party was given ("placed"), so
   * you sit in your party's squad. `v`: SQUADS_PROTOCOL.
   */
  | { t: "hello"; v: number; token?: string; name?: string; device?: "phone" | "computer"; party?: string; look?: unknown }
  /** A pre-game vote: the option this player chose. */
  | { t: "vote"; key: string; option: number }
  /**
   * Your move (Relay: made once, final), pick or block (Pairs, the final: can change until the half ends; never your
   * partner's). `key` is the match, `seq` the half. Refused: "choiceNo".
   */
  | { t: "choose"; key: string; seq: number; move: string }
  /** Locks in your pick or block (the half ends early once everyone with a duty has locked in). */
  | { t: "lock"; key: string; seq: number }
  /** A drawn final: your squad picks Armageddon's colour (the side that picks: see `armageddonChoice`; the last pick stands). */
  | { t: "armageddon"; key: string; colour: Colour }
  /** This device's engine speed (nodes per second), from its speed check on joining: it can take bot work. */
  | { t: "speed"; nps: number }
  /** This device's answer to one bot-work job: the bot engine's top moves (topMovesAt(fen, n, nodes)), best first. */
  | { t: "botTop"; id: string; top: MoveScore[] }
  /** Take your seat back from the bot playing it (a repeat no-show's seat), from the next half. */
  | { t: "reclaim" }
  /**
   * Leave: before the lobby fills, your seat is free again; once your squad is out, you go (queue again); while your
   * squad is still playing, a bot takes your seat at once.
   */
  | { t: "leave" }
  /** Everything again (the lobby, the vote, every match): after a gap, or a board whose `ply` doesn't match yours. */
  | { t: "sync" }
  /**
   * Test control (admins, or anyone where SQUADS_TEST is on): "Next round". Every match still going in the earliest
   * unfinished round ends now (boards still going decided by material, a level match by time left, then a coin), and
   * the bracket moves on. In the votes: they close now.
   */
  | { t: "nextRound" };

export type SquadsServerMessage = { now: number } & (
  /** Your seat: keep `token` to rejoin. `test`: you may use the test controls. */
  | { t: "welcome"; v: number; playerId: string; token: string; code: string; test: boolean }
  | { t: "lobby"; lobby: NetSquadsLobby }
  | { t: "vote"; vote: NetSquadsVote }
  /** A person's vote in the open vote. */
  | { t: "voteCast"; key: string; playerId: string; option: number; at: number; squad: number }
  /**
   * A match in full, as you may see it: on (re)joining, when it starts, and when it changes state (Armageddon). `visible`:
   * the choices you may see so far this half (Relay and Pairs: your own squad's; the final: blocks to everyone, picks to
   * the picking squad), `locked` who has locked in.
   */
  | { t: "match"; match: NetSquadsMatch; visible: Record<string, string>; locked: string[] }
  /** A new half has begun in a match (its duties and deadlines, and both squads' banks as it began). */
  | { t: "turn"; key: string; current: NetSquadsHalf; banks: [number, number] }
  /** Every squad's team clock: as the bracket starts, and whenever a half begins or ends anywhere or a match ends. */
  | { t: "clocks"; clocks: NetTeamClock[] }
  /** Choices you may see in the half being played, as they change. */
  | { t: "choices"; key: string; seq: number; visible: Record<string, string>; locked: string[] }
  /**
   * A half has been played: what happened (every move, pick, block, coin, clock, board end and the match's end: all
   * public now), who acted and who missed, seats a bot has just taken over, and the match after it (no move lists).
   */
  | { t: "half"; key: string; seq: number; events: SquadsEvent[]; acted: string[]; missed: string[]; replaced: string[]; match: NetSquadsMatch }
  /** Your choice was refused: the rules' reason, `late` (your time was up) or `stale` (not the half being played). */
  | { t: "choiceNo"; key: string; seq: number; move: string; reason: ChoiceError | "late" | "stale" }
  /**
   * Your squad's placement is decided (it's out, or it won): your reward (coins, crates), `recorded` if it went on your
   * profile (signed in, still playing your seat, not a test lobby).
   */
  | { t: "placed"; squadId: number; placement: SquadsPlacement; coins: number; crates: number; recorded: boolean }
  /** Every placement is decided (by squad id). */
  | { t: "results"; placements: Record<number, SquadsPlacement> }
  /**
   * Bot work for this device: the bot engine's top `n` moves in each position, searched at `nodes` (topMovesAt; every
   * device the same, so two answers can be compared exactly). Answer each with "botTop".
   */
  | { t: "botWork"; jobs: { id: string; fen: string; n: number; nodes: number }[] }
  /** You left (the socket closes next). */
  | { t: "left" }
  /** Can't join or play on. `ended`: the lobby is over or gone. `banned`: banned for fair play. */
  | { t: "error"; message: string; ended?: true; banned?: true }
  /** The lobby is closing (see LOBBY_LIFE); the socket closes next. */
  | { t: "closed"; reason: LobbyCloseReason }
);

// ---------------- Messages: a party ----------------

export interface NetPartyMember {
  id: string;
  name: string;
  connected: boolean;
}

/**
 * A party: up to SQUADS.partyMax friends under one code (the invite link is /squads/party/CODE). The leader (the first
 * to join; the next one if they leave) queues; everyone connected goes to the lobby the matchmaker finds, into one
 * squad. open: gathering; queueing: in line (`busy`: the servers are busy, about how long); placed: in `lobby`, join it
 * with `pass`. After the lobby, the leader can queue again.
 */
export interface NetParty {
  code: string;
  leaderId: string | null;
  members: NetPartyMember[];
  max: number;
  state: "open" | "queueing" | "placed";
  placed?: { lobby: string; pass: string; at: number };
  busy?: { position: number; waitSeconds: number; message: string };
}

export type PartyClientMessage =
  | { t: "hello"; v: number; token?: string; name?: string; device?: "phone" | "computer" }
  /** The leader queues the party (everyone connected). Again after a lobby: a new one. */
  | { t: "queue" }
  /** The leader stops looking (in line); a placed party's seats go to bots when its lobby fills. */
  | { t: "cancel" }
  /** Leave the party. */
  | { t: "leave" };

export type PartyServerMessage = { now: number } & (
  | { t: "welcome"; v: number; memberId: string; token: string; code: string }
  | { t: "party"; party: NetParty }
  | { t: "error"; message: string; ended?: true; banned?: true }
  | { t: "closed"; reason: LobbyCloseReason }
);
