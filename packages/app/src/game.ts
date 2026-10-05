import { toSan, type BoardRound, type BoardSlot, type LivePick, type NetBoss, type NetFinal, type NetStanding, type NetVote } from "@chessroyale/chess";
import { brilliance } from "@chessroyale/core";
import { roundsInStage, type Augment, type Settings } from "@chessroyale/core";

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
  /** The engine's best move (after the re-check), and how many of those who picked found it (within 1.5 points). */
  bestMove?: string;
  found?: number;
  pickers?: number;
  /** Everyone's average loss that turn. */
  avgLoss?: number | null;
  /** Your pick separated the field (a brilliant move, made without a power-up). */
  brilliant?: boolean;
  usedPowerUp?: boolean;
}

/** Your move from a reveal, with what the elimination breakdown needs (null if you weren't picking). */
export function moveRecordFrom(stage: number, round: number, mine: GroupReveal, isYou: (id: string) => boolean): MoveRecord | null {
  const players = mine.result.players;
  const me = players.find((p) => isYou(p.playerId));
  if (!me) return null;
  const picked = players.filter((p) => p.move && p.loss !== null);
  const bril = brilliance(players);
  return {
    stage,
    round,
    fen: mine.fenBefore,
    move: me.move,
    san: me.move ? toSan(mine.fenBefore, me.move) : "—",
    loss: me.loss,
    roundScore: me.roundScore,
    bestMove: mine.bestMove,
    found: picked.filter((p) => p.loss! <= 1.5).length,
    pickers: picked.length,
    avgLoss: picked.length ? picked.reduce((s, p) => s + p.loss!, 0) / picked.length : null,
    brilliant: !!bril?.players.includes(me.playerId),
    usedPowerUp: !!me.usedPowerUp,
  };
}

/**
 * Your last elimination (Crowd): your score and the cut line's when you went out, for the breakdown on the
 * cut screen and the results.
 */
export const elimination: { current: { stage: number; you: number; line: number; placement: number | null; out: number; left: number } | null } = { current: null };

/** The 2v2 final as the screens see it (same shape the server sends, with the board as a view). */
export type FinalView = Omit<NetFinal, "board"> & { board: BoardView };

/** A pre-game vote as the screens see it (times are local). */
export type VoteView = NetVote;

/** The boss battle as the screens see it. */
export type BossView = Omit<NetBoss, "board"> & { board: BoardView };

/** The reveal: your group's picks and scores (same shape the server sends). */
export type GroupReveal = Pick<BoardRound, "fenBefore" | "bestMove" | "playerIds" | "king" | "kingCalls"> & {
  result: Pick<BoardRound["result"], "players" | "playedMove" | "drawRule">;
};

/**
 * Boss battle: calls for the God King's strike this move. Once he strikes, `at` to `until` is the strike on
 * screen; the move clock stands still meanwhile (the play phase's deadline already includes it).
 */
export interface StrikeState {
  calls: number;
  needed: number;
  /** You've called for it. */
  mine: boolean;
  at?: number;
  until?: number;
}

export type Phase =
  | { kind: "loading" }
  | { kind: "lobby" }
  | { kind: "opening"; boards: BoardView[] }
  /** `startsAt`: when the move clock starts (after the new board's settling-in countdown). */
  | { kind: "play"; board: BoardView; startsAt: number; deadline: number; allowedMs: number; strike?: StrikeState }
  /** `watched`: Crowd 50 v 50, the other team's vote is being counted. */
  | { kind: "scoring"; board: BoardView; move: string | null; watched?: boolean; strike?: StrikeState }
  /** `until`: when the next board comes up (local time). */
  | { kind: "reveal"; mine: GroupReveal; board: BoardView; until: number }
  /** Crowd 50 v 50: the other team is choosing; you watch the vote come in. */
  | { kind: "watching"; board: BoardView; startsAt: number; deadline: number }
  /** `until`: when the next round starts (Crowd: the cut screen and its augment vote). */
  | { kind: "stageBreak"; stage: number; standings: Standing[]; knockedOut: Standing[]; cutoff: number; youOut: boolean; nextBoards: BoardView[]; until?: number; augments?: boolean; moveClock?: number }
  | { kind: "simulating"; stage: number; round: number }
  | { kind: "spectating"; boards: BoardView[] }
  /** The final, watching (or between your turns). */
  | { kind: "final"; final: FinalView }
  /** A pre-game vote (Crowd 50 v 50): push a pawn into a zone. */
  | { kind: "vote"; vote: VoteView }
  /** Boss battle: the boss thinking, its move, or its strike (`until`: when the next crowd move starts). */
  | { kind: "boss"; boss: BossView; until: number; thinking?: boolean; intro?: boolean }
  /** `gameWinner`: Crowd, who won the game on the board (null for a draw). `bossResult`: who won a boss battle. */
  | { kind: "results"; placement: number; winner: string; youWon: boolean; gameWinner?: "w" | "b" | null; bossResult?: "crowd" | "boss" | "draw" };

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
  /**
   * Crowd: the picks you're allowed to see this round, each visible from `at`
   * (local time): none until you've picked, then everyone's as they come in.
   * The watching team sees them all along. Null when hidden.
   */
  livePicks(): LivePick[] | null;
  /** Crowd augments: your vote on the next round's move clock (at a cut). */
  voteAugment(choice: Augment): void;
  /** Your vote at this cut, if any. */
  readonly augmentVote: Augment | null;
  /** A pre-game vote: yours (an option, 0-2), once cast. */
  castVote(option: number): void;
  /** The boss battle once it has started (also during the crowd's moves in it). */
  readonly boss: BossView | null;
  /**
   * Boss battle: call the King (if more than half the crowd calls). To play this move: your whole turn. Or to
   * strike the boss now (`strike`): the clock stands still while he does, then everyone picks as usual.
   */
  callKing(strike?: boolean): void;
  /** You called the King to play this move. */
  readonly kingCalled: boolean;
}

/** Crowd 50 v 50: your team (the side you play all match), if you have one. */
export function myTeam(m: Pick<GameView, "standings">): "w" | "b" | null {
  return m.standings().find((s) => s.isYou)?.team ?? null;
}

/**
 * The leaderboard as you should see it: in Crowd 50 v 50 each team has its own
 * cut (half the knockouts each), so it shows your team with your team's cut line.
 */
export function towerView(m: Pick<GameView, "standings" | "cutoff" | "settings" | "stage"> & { boss?: BossView | null }): { standings: Standing[]; cutoff: number; teamLabel: string | null } {
  const all = m.standings();
  // Boss battle: one crowd, no cut line (the boss strikes instead).
  if (m.boss) return { standings: all, cutoff: all.filter((s) => !s.out).length, teamLabel: "The crowd" };
  const team = all.find((s) => s.isYou)?.team ?? null;
  if (!team) return { standings: all, cutoff: m.cutoff, teamLabel: null };
  const mine = all.filter((s) => s.team === team);
  const alive = mine.filter((s) => !s.out).length;
  const k = m.settings.knockoutsPerStage[m.stage] ?? 0;
  return { standings: mine, cutoff: alive - Math.floor(k / 2), teamLabel: team === "w" ? "White team" : "Black team" };
}

export const isCrowd = (m: Pick<GameView, "settings">) => m.settings.mode === "crowd";

/** What the last cut leads to, by name: the team final, the boss battle, the duel (or the final four). */
export function finalName(s: Pick<Settings, "mode" | "crowdTeams" | "finalFormat">): string {
  if (s.mode !== "crowd" || !s.crowdTeams) return "Final four";
  return s.finalFormat === "boss" ? "Boss battle" : s.finalFormat === "duel" ? "Duel" : "Team final";
}

/** The board you're on this turn (highlighted in the strip), if any. */
export function myBoardId(m: Pick<GameView, "phase" | "final">): number | null {
  const p = m.phase;
  if (p.kind === "play" || p.kind === "scoring" || p.kind === "reveal") return p.board.id;
  if (p.kind === "final") return p.final.board.id;
  return null;
}

/** While a round is being played, the leaderboard shows who has moved. */
export const roundLive = (m: Pick<GameView, "phase">) => m.phase.kind === "play" || m.phase.kind === "scoring" || m.phase.kind === "watching";

/** What the leaderboard's cut line says during a stage. */
export const cutLabel = (m: Pick<GameView, "settings" | "stage">) =>
  m.settings.mode === "crowd"
    ? m.stage === m.settings.knockoutsPerStage.length - 1
      ? `${finalName(m.settings)} line`
      : "Cut line"
    : m.stage === m.settings.knockoutsPerStage.length - 1
    ? `Final four line · after round ${roundsInStage(m.settings, m.stage)}`
    : `Cut after round ${roundsInStage(m.settings, m.stage)}`;
