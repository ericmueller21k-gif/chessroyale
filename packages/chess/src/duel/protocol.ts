import type { DuelZone, ItemLook, RankChange, RankView } from "@chessroyale/core";
import type { ChatBlock, ChatRefusal, NetChatLine } from "../protocol.ts";
import type { Color, DuelEnd } from "./rules.ts";

/**
 * Ranked 1 v 1's messages between the app and a game's object (docs/areas/ranked.md, "The protocol"). Every message
 * from the server carries `now` (its clock), so the app can turn its times into local ones.
 * 1: the first.
 */
export const DUEL_PROTOCOL = 1;

/** A player as both players see them: the versus screen's and the board's strips. */
export interface DuelPlayerView {
  /** Their account (for their profile), and their account's name. */
  uid: string;
  name: string;
  look: ItemLook | null;
  /** Their 1 v 1 rank as the game began. */
  rank: RankView;
}

/** Where a game is: waiting for both players, the versus moment, the vote, the overlay, play, over. */
export type DuelGamePhase = "waiting" | "versus" | "vote" | "overlay" | "play" | "over";

/** A game as a player sees it (everything is public between the two). */
export interface DuelView {
  code: string;
  phase: DuelGamePhase;
  players: Record<Color, DuelPlayerView>;
  /** When the versus moment began and the vote opens and closes (server times; null until known). */
  versusAt: number | null;
  voteAt: number | null;
  voteEndsAt: number | null;
  picks: Record<Color, DuelZone | null>;
  /** The control the vote gave (its id), the clock it plays (seconds, increment: a test's own), and when play began. */
  control: string | null;
  clock: { baseSeconds: number; incrementSeconds: number } | null;
  startsAt: number | null;
  fen: string;
  moves: string[];
  sans: string[];
  /** Each side's time left as of `turnAt`, and whether the side to move's clock is running. */
  clocks: Record<Color, number>;
  turnAt: number;
  running: boolean;
  /** The side to move's first move is due by then (null once both have made theirs). */
  firstMoveBy: number | null;
  drawOffer: Color | null;
  /** Each side may offer a draw now. */
  canOffer: Record<Color, boolean>;
  connected: Record<Color, boolean>;
  end: DuelEnd | null;
}

/** What a finished game did for you: your rank's change and your coins (none for an aborted game). */
export interface DuelOutcome {
  /** Null when your rank didn't change (an aborted game, or fair play holding your rank). */
  change: RankChange | null;
  coins: number;
}

export type DuelClientMessage =
  | { t: "hello"; v?: number }
  | { t: "pick"; zone: DuelZone }
  /** `ply`: the move's place (0 for White's first), so a resent move is never played twice. */
  | { t: "move"; uci: string; ply: number }
  /** Resign; before both first moves, abort. */
  | { t: "resign" }
  /** Offer a draw, or accept the other side's offer. */
  | { t: "draw" }
  | { t: "drawNo" }
  | { t: "chat"; say: string }
  | { t: "chatPrefs"; off?: boolean; muted?: string[] }
  | { t: "sync" };

export type DuelServerMessage = (
  | { t: "welcome"; you: Color; game: DuelView; v: number; test?: boolean }
  /** The game in full (a phase change, a sync). */
  | { t: "game"; game: DuelView }
  | { t: "picks"; picks: Record<Color, DuelZone | null> }
  | { t: "move"; uci: string; san: string; ply: number; fen: string; clocks: Record<Color, number>; turnAt: number; running: boolean; firstMoveBy: number | null; drawOffer: Color | null; canOffer: Record<Color, boolean> }
  | { t: "moveNo"; ply: number; reason: string; game: DuelView }
  | { t: "draw"; drawOffer: Color | null; canOffer: Record<Color, boolean> }
  | { t: "presence"; connected: Record<Color, boolean> }
  | { t: "outcome"; outcome: DuelOutcome }
  | { t: "chat"; line: NetChatLine }
  | { t: "chatLog"; lines: NetChatLine[]; packs: string[] }
  /** `block`: your chat ban (reason "mod", chat moderation). */
  | { t: "chatNo"; say: string; reason: ChatRefusal; retryAt: number; block?: ChatBlock }
  | { t: "error"; message: string }
  | { t: "closed"; reason: string }
) & { now?: number };
