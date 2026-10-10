/**
 * What a boss's lobby code (bosses/<boss>.ts) may use of the lobby (LobbyCore hands it over: its `bossLobby`), so each
 * boss's server-side moments live in its own file and the lobby only routes to them.
 */
import type { Settings } from "@chessroyale/core";
import type { MatchRunner, NetStanding } from "@chessroyale/chess";
import type { Human, LobbyRecord, Outgoing, Timer } from "../lobby.ts";

export interface BossLobby {
  readonly r: LobbyRecord;
  readonly runner: MatchRunner | null;
  readonly settings: Settings;
  now(): number;
  send(id: string, msg: Outgoing, remember?: boolean): void;
  setTimer(kind: Timer, at: number): void;
  standings(): NetStanding[];
  /** The boss's turn: everyone sees it thinking while the host's engine plays its move. */
  requestBoss(): void;
  /** A crowd turn in progress (a pick sent another way, as Hollow's dark sends a move attempt). */
  doneThisRound(playerId: string): boolean;
  thinkTime(round: NonNullable<LobbyRecord["round"]>, upTo: number): number;
  pick(playerId: string, key: string, move: string, away?: unknown): void;
  sendTally(): void;
  roundHumans(): Human[];
  lock(): void;
}
