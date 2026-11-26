import type { FloorPlay, TowerStripInfo } from "./tower.ts";
import { toSan, type BoardRound, type Base, type BoardSlot, type Capture, type LivePick, type NetBoss, type NetFinal, type NetLightsOut, type NetStanding, type NetVote, type Phase2Seat } from "@chessroyale/chess";
import { brilliance, type MaterialSlip } from "@chessroyale/core";
import { roundsInStage, type Augment, type Settings } from "@chessroyale/core";
import type { MatchChat } from "./chat.ts";

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
  /** Positions changed between moves (a piece Grex's fire destroyed): the moves after each are played from it. */
  bases?: Base[];
  /** Every capture on this board as it was played (NetBoard.captures): what the queen banners read. */
  captures?: Capture[];
}

/**
 * One row of the live leaderboard. `board`: the Hidden Boss's phase 2, from his fall until the results, a player on one of his
 * boards: still in, and how their board stands (phase2Standings).
 */
export type Standing = NetStanding & { isYou: boolean; board?: Phase2Seat };

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
  /** The loss as it counted for points, when the opening allowance took something off; or why it didn't (material). */
  counted?: number;
  material?: MaterialSlip;
  roundScore: number;
  /** The engine's best move (after the re-check), and how many of those who picked found it (within 1.5 points). */
  bestMove?: string;
  found?: number;
  pickers?: number;
  /** Everyone's average loss that turn, as it counted for points (the round score is measured from it). */
  avgLoss?: number | null;
  /** The same before the opening allowance, when that differs. */
  avgRaw?: number;
  /** Your pick separated the field (a brilliant move, made without a power-up). */
  brilliant?: boolean;
  usedPowerUp?: boolean;
  /**
   * No move of your own, but your turn (core's OwnTurn: XP's minimum counts it, ownMoves): you called the God King to play it
   * (`abstained`), or Hollow's dark ended it at your last wrong try (`darkOut`, solo: online the match room counts it).
   */
  abstained?: boolean;
  darkOut?: boolean;
}

/**
 * Crowd 50 v 50's miss on the reveal (CrowdMisses, Eric, Nov 4), so a removal is never a surprise: a move was picked for
 * you (it doesn't count in the vote), and how many of the misses the game allows you've used: "Missed: a move was picked
 * for you (1 of 3)"; `short` (phones under 380 px): "Missed: picked for you (1 of 3)". Null: not a miss, or misses as before.
 */
export function missLine(p: { move: string | null; defaultMove?: string; missNo?: number }, allowed: number | undefined, short = false): string | null {
  if (p.move !== null || !p.defaultMove || !p.missNo || allowed === undefined) return null;
  return `Missed: ${short ? "picked" : "a move was picked"} for you (${p.missNo} of ${allowed})`;
}

/**
 * The opening allowance on a pick, in a few plain words for the reveal (one line, even at 320 px), one number at most:
 * what it forgave ("1.2 forgiven · opening", "8 of 9.6 forgiven · opening"), or why it didn't cover the pick
 * ("no allowance · gave up material", "no allowance · missed a capture"); in 50 v 50 after the allowance, a piece given
 * up that the soft limit didn't cover ("not capped · gave up a piece", "not capped · missed a piece"). `short`: the boss
 * dock on the narrowest phones ("8 of 9.6 forgiven", "no allowance"). Null when it made no difference (no loss, or no
 * allowance on this move).
 */
export function allowanceNote(p: { loss: number | null; counted?: number; material?: MaterialSlip; uncapped?: MaterialSlip }, short = false): string | null {
  if (p.loss === null || p.loss < 0.05) return null;
  if (p.material) return short ? "no allowance" : `no allowance · ${p.material === "missed" ? "missed a capture" : "gave up material"}`;
  // (Crowd 50 v 50 after the allowance: a piece given up isn't capped. CrowdScoring.)
  if (p.uncapped) return short ? "not capped" : `not capped · ${p.uncapped === "missed" ? "missed a piece" : "gave up a piece"}`;
  if (p.counted === undefined) return null;
  const pts = (x: number) => x.toFixed(1).replace(/\.0$/, "");
  const forgiven = p.counted < 0.05 ? `${pts(p.loss)} forgiven` : `${pts(p.loss - p.counted)} of ${pts(p.loss)} forgiven`;
  return short ? forgiven : `${forgiven} · opening`;
}

/**
 * The opening allowance in one short phrase, for the reveal's one line (Nov 1, Eric: "too many words"): "8 forgiven"
 * (what it took off), or the same reasons as allowanceNote, short ("no allowance", "not capped").
 */
export function allowanceShort(p: { loss: number | null; counted?: number; material?: MaterialSlip; uncapped?: MaterialSlip }): string | null {
  if (p.loss === null || p.loss < 0.05) return null;
  if (p.material || p.uncapped || p.counted === undefined) return allowanceNote(p, true);
  const pts = (x: number) => x.toFixed(1).replace(/\.0$/, "");
  return `${pts(p.counted < 0.05 ? p.loss : p.loss - p.counted)} forgiven`;
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
    ...(me.counted !== undefined ? { counted: me.counted } : {}),
    ...(me.material ? { material: me.material } : {}),
    roundScore: me.roundScore,
    bestMove: mine.bestMove,
    found: picked.filter((p) => p.loss! <= 1.5).length,
    pickers: picked.length,
    avgLoss: picked.length ? picked.reduce((s, p) => s + (p.counted ?? p.loss!), 0) / picked.length : null,
    ...(picked.some((p) => p.counted !== undefined) ? { avgRaw: picked.reduce((s, p) => s + p.loss!, 0) / picked.length } : {}),
    brilliant: !!(mine.result.brilliant ?? bril)?.players.includes(me.playerId),
    usedPowerUp: !!me.usedPowerUp,
    ...(me.abstained ? { abstained: true } : {}),
  };
}

/**
 * Your last elimination (Crowd): your score and the cut line's when you went out, for the breakdown on the
 * cut screen and the results.
 */
export const elimination: { current: { stage: number; you: number; line: number; placement: number | null; out: number; left: number; lastCut?: boolean } | null } = { current: null };

/** The 2v2 final as the screens see it (same shape the server sends, with the board as a view). */
export type FinalView = Omit<NetFinal, "board"> & { board: BoardView };

/** A pre-game vote as the screens see it (times are local). */
export type VoteView = NetVote;

/** The boss battle as the screens see it. */
export type BossView = Omit<NetBoss, "board"> & { board: BoardView };

/**
 * Hollow's dark: your last move attempt into the dark this turn (sent unchecked): `pending` while the server judges it;
 * else wrong, with your wrong tries so far this turn and whether that was the last (your turn is over, a miss).
 */
export interface DarkNote {
  move: string;
  at: number;
  pending?: boolean;
  tries: number;
  out: boolean;
  /** Boss alone, his bulbs (Nov 5): how many are out now; the dark plays this turn's move for you; the last went out. */
  bulbs?: number;
  forced?: boolean;
  blackout?: boolean;
}

/** Hollow's Lights out as the screens see it (`at` in local time; every beat follows from it: lightsOutTimeline). */
export type LightsView = NetLightsOut;

/**
 * Dash's Scramble Rush as the screens see it: its key, when it began (local time; every beat follows from it: rushTimeline), and
 * your placements so far (each swept piece's square before the sweep → the square you put it on) and each piece's moves so far
 * (by the same square: at most dashScramble.movesPerPiece). The swept pieces and, once it's over, the verdict are the boss view's
 * (`powers.dash.rush`).
 */
export interface RushView {
  key: string;
  at: number;
  places: Record<string, string>;
  moved: Record<string, number>;
}

/**
 * Chandy's Dodge on this device's clock (online: `local` of the server's start): its key, when it began, the round being voted on, its
 * counts so far, and your own vote in it. The clones, the teleports as they come and each round's result are in the boss's view.
 */
export interface DodgeRun {
  key: string;
  at: number;
  round: number;
  votes: Record<string, number>;
  mine?: string;
}

/** The reveal: your group's picks and scores (same shape the server sends). */
export type GroupReveal = Pick<BoardRound, "fenBefore" | "bestMove" | "playerIds" | "king" | "kingCalls" | "lastStand"> & {
  result: Pick<BoardRound["result"], "players" | "playedMove" | "drawRule" | "brilliant">;
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

/**
 * Boss battle: Dash's stall skit on this move (Eric, Nov 17; his rules' stallPlan): its beat on screen from `at` to `until` (the
 * slam, or his fake second move `move`, played and taken back). The move clock stands still meanwhile (the play phase's deadline
 * already includes it); the board takes no move during the fake move.
 */
export interface StallState {
  /** (`tap`: his lying-down clock tap began at `at`; no pause, `until` = `at`. DashTap in DashStall.tsx.) */
  beat: "tap" | "slam" | "fake";
  at: number;
  until: number;
  move?: string;
}

export type Phase =
  | { kind: "loading" }
  | { kind: "lobby" }
  | { kind: "opening"; boards: BoardView[] }
  /**
   * `startsAt`: when the move clock starts (after the new board's settling-in countdown). `clock`: this move's clock
   * in seconds, the time control's cap (`allowedMs` is less when a time bank runs low).
   */
  | { kind: "play"; board: BoardView; startsAt: number; deadline: number; allowedMs: number; clock?: number; strike?: StrikeState; stall?: StallState }
  /** `watched`: Crowd 50 v 50, the other team's vote is being counted. `movedAt`: when your move went in (local time). */
  | { kind: "scoring"; board: BoardView; move: string | null; watched?: boolean; strike?: StrikeState; stall?: StallState; movedAt?: number }
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
  /**
   * Boss battle: the boss thinking, its move, or its strike (`until`: when the next crowd move starts). `lights`:
   * Hollow's Lights out, at the start of his turn (the clocks stopped), before his move. `loading` (with `intro`): solo,
   * the loading step before the intro, while the boss's Maia brain loads (maia-gate.ts): the intro's first frame, held;
   * `afterLoading`: the intro that follows it. `toPhase2` (with `fall`): the Hidden Boss beaten, his phase change next (solo).
   */
  | { kind: "boss"; boss: BossView; until: number; thinking?: boolean; intro?: boolean; loading?: boolean; afterLoading?: boolean; lights?: LightsView; rush?: RushView; dodge?: DodgeRun; fall?: boolean; toPhase2?: boolean }
  /**
   * The Hidden Boss's phase change (`at`: when it began; PHASE_CHANGE in recluse-phase2.ts): the book's slam, the board
   * split into four, his revive, the Chess960 shuffle; `splitAt`: when the board cracks into four, Date.now()'s clock, where his
   * music's drop lands). Then `simul`: his phase 2, four boards at once (GameView.simul).
   */
  | { kind: "phaseChange"; at: number; splitAt: number }
  /** (`at`: when its clocks start: a countdown on the boards until then, Oct 17.) */
  | { kind: "simul"; at: number }
  /**
   * `gameWinner`: Crowd, who won the game on the board (null for a draw). `bossResult`: who won a boss battle. `left`:
   * you left before the end (see GameView.resign): you resigned (a loss; `bot`: online, a bot plays your seat), or you
   * left once you were already out (your place as it stood; the winner isn't known). `simulBoard`: the Hidden Boss's phase 2, the
   * board you played as it ended (this device's view, never sent or stored), for the result's review (QA #12, Nov 14).
   */
  | { kind: "results"; placement: number; winner: string; youWon: boolean; gameWinner?: "w" | "b" | null; /** The 50 v 50 rework's podium titles (C3): each standing then has `outAtMove` and `perMove`. */ podium?: { winner?: string; best: string | null }; bossResult?: "crowd" | "boss" | "draw"; left?: LeftResult; timeout?: boolean; carrots?: boolean; blackout?: boolean; simul?: { won: number; of: number }; noResult?: "board" | "watched"; simulBoard?: SimulBoardView };

/** One of the Hidden Boss's phase 2 boards as the screens see it (board 0 is yours). */
export interface SimulBoardView {
  id: number;
  you: boolean;
  /** Who plays it for the crowd ("You", or a bot's name). */
  name: string;
  /** Its Chess960 start position (the standard numbering; -1: the test switch's position). */
  number: number;
  fen: string;
  lastMove: string | null;
  history: string[];
  bases?: Base[];
  /** The player's bank as of `turnAt` (ms), and when their turn began (their clock running), or null. */
  bankMs: number;
  turnAt: number | null;
  toMove: "crowd" | "boss" | null;
  result: { winner: "crowd" | "boss" | "draw"; how: "mate" | "time" | "resign" | "stalemate" | "draw" | "slow" } | null;
  /** The player's hearts left (RECLUSE_PHASE2.hearts at the start), and when the last was cut (this device's time), or null. */
  hearts: number;
  slashAt: number | null;
}

/** The Hidden Boss's phase 2 as the screens see it: the four boards, and where the battle stands. */
export interface SimulView {
  /** The position the phase change splits (phase 1's last), for its first beats. */
  from: string;
  boards: SimulBoardView[];
  /** The clocks are running (after the phase change). */
  playing: boolean;
  won: number;
  lost: number;
  drawn: number;
  of: number;
  /** Every board is decided (his reaction holds the boards, then the result). */
  decided: boolean;
  beaten: boolean;
  /**
   * Online: every clock paused since then (this device's time): his move is late from the engine server. Every board shows "He's
   * thinking…", takes no move, and its clock shows where it stood. Missing or null: not paused (solo never is).
   */
  paused?: number | null;
  /** Online: the fight ended with no result (his move never came from the engine server); `decided` is true with it. */
  noResult?: boolean;
}

/** How you left a match before its end (the results screen says so). */
export interface LeftResult {
  /** `afk`: Crowd 50 v 50's removal for being away (CrowdMisses: more misses in the game than it allows). */
  how: "resigned" | "out" | "afk";
  /** `afk`: the misses that removed you. */
  misses?: number;
  /** Online: a bot took your seat (else the match went on without it). */
  bot?: boolean;
}

/**
 * Leaving the match (settings.ts, LEAVING): "resign" while the match is on and you're in it (a loss); "leave" before
 * move 1, or once you're out (nothing changes on your record).
 */
export type ExitKind = "resign" | "leave";

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
  /** How many of those still in would go through if the stage's cut came now (ties at the line go through). */
  readonly cutoff: number;
  nameOf(id: string): string;
  isYou(id: string): boolean;
  subscribe(fn: () => void): () => void;
  /** Your pick (null: none). `premove`: a premove played as your turn opened (online, the server is told: fair play). */
  submit(move: string | null, premove?: boolean): void;
  skipReveal(): void;
  continueFromBreak(): void;
  /**
   * The 50 v 50 rework's cut screen, out (C3; Eric, Nov 16: "make sure there's a spectate option"): watch to the podium. Solo: the
   * break ends now and the game plays on before you (not tapping it: the rest is played out at once, your result straight after);
   * online: from the next move (the server's watching rounds; not tapping it spectates too, once the break ends). `spectateAsked`:
   * tapped (its button shows it).
   */
  spectate?(): void;
  readonly spectateAsked?: boolean;
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
  /**
   * A Boss Battle party's battle (online): each member's seat (their color) and the leader now; your pick this turn (it
   * can change until the turn resolves); the AFK kick (docs/decisions/2026-10-30-boss-party.md). Missing elsewhere.
   */
  readonly party?: { seats: Record<string, number>; leader: string | null } | null;
  readonly myPick?: string | null;
  /** When your first pick this turn went in (local time); null with no pick. */
  readonly myPickAt?: number | null;
  readonly myId?: string | null;
  partyKick?(playerId: string): void;
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
  /**
   * Testing, admins only: bring the boss's ultimate as the next crowd turn begins (no warning). Safe at any moment:
   * it does nothing when the ultimate is spent or the battle's over (online, the server checks the admin too).
   */
  triggerUltimate(): void;
  /**
   * The Hidden Boss's cutscene (his adult form beaten, his phase change next): from `at` to `until` (this device's clock), once it's
   * due; null (or absent) otherwise. Solo's own times, or the server's (`recluseCutscene`).
   */
  readonly cutscene?: { at: number; until: number } | null;
  /** The Hidden Boss's phase 2 (solo only), while it's on: its boards; null otherwise. */
  readonly simul?: SimulView | null;
  /** Your move on your phase 2 board. */
  simulMove?(boardId: number, move: string): void;
  /**
   * A word in the boss bar instead of the move count while the Hidden Boss's phase 2 is on ("1 of 4 won"; "" in its
   * phase change); null (or absent) otherwise, so test it against null, not for truth.
   */
  readonly bossNote?: string | null;
  /** Testing, admins in Boss alone (solo only; online has none): the "Engine move" button shows. */
  readonly engineMoveShown?: boolean;
  /** Its search is running (the button waits). */
  readonly engineThinking?: boolean;
  /** Plays Stockfish's best move as your own, through the normal move path. */
  engineMove?(): void;
  /**
   * Testing, admins in any boss battle (solo and online, Battle Tower floors too; Nov 20): the 🏆 shows, "Win this match" ("Win this
   * form" against the Hidden Boss).
   */
  readonly winFormShown?: boolean;
  /** It was pressed: your next move wins the match (the Hidden Boss's form, or his phase 2's four boards). */
  readonly winFormArmed?: boolean;
  /** Arms it: your next move beats the boss, the same end a mate takes (the Hidden Boss: his form, or in phase 2 every board). */
  winForm?(): void;
  /** You called the King to play this move. */
  readonly kingCalled: boolean;
  /** Testing, admins (Boss alone): what the boss's brain did with its last move (Maia or Stockfish), or null. */
  readonly brainLine?: string | null;
  /**
   * Hollow's dark: a move attempt that touches a dark square (starts on one, lands on one or passes over one), sent
   * unchecked: a legal one is your pick; an illegal one costs points and you pick again (see darkNote).
   */
  darkTry(move: string): void;
  /** Hollow's dark: how your last attempt into the dark this turn went (null: none). */
  readonly darkNote: DarkNote | null;
  /** Hollow's Lights out: you tap a square (in the round that's on). */
  lightsTap(square: string): void;
  /** Dash's Scramble Rush: you put the swept piece that stood on `from` (before his sweep) on `to`, while its countdown is on. */
  rushPlace(from: string, to: string): void;
  /** Chandy's Dodge: your vote for the king's square in the round on (a later tap replaces it). */
  dodgeVote(square: string): void;
  /** Quick chat (online matches only; see `enabled`). */
  readonly chat?: MatchChat;
  /** It counts for your ranking (at least 30% real players; never solo). Null or missing: not known (yet). */
  readonly ranked?: boolean | null;
  /** Online: something in the match stood on one device's word alone, so it pays as a solo game (the results say so). */
  readonly unvouched?: boolean;
  /** Online: you played in a 50 v 50 party of 2 or more friends, so yours isn't ranked (the results say so). */
  readonly partied?: boolean;
  /** What leaving means now (null: nothing to leave: the results, or still connecting). */
  readonly exit: ExitKind | null;
  /** Leaving goes straight home, with no results screen (before move 1; online, once you're out). */
  readonly exitHome: boolean;
  /** A Battle Tower floor (solo: solo.ts): its run, for the strip and the result's buttons. */
  readonly tower?: FloorPlay | null;
  /** A Battle Tower party's floor (online, Nov 20): the floor, its bosses and those beaten, for the strip and the result's way back. */
  readonly towerParty?: TowerStripInfo | null;
  /** Online: a bot takes the seat you leave (the lobby fills seats with bots); else the match goes on without it. */
  readonly seatToBot?: boolean;
  /**
   * Resign (or leave: see `exit`). Solo: the match stops here (every timer, engine search and worker with it) and the
   * results show at once. Online: the server takes you out of the match (a bot in your seat) and its answer brings the
   * results; the others play on.
   */
  resign(): void;
}

/**
 * Boss alone: you against a boss, nobody else (a raid of one). Its screens speak to you, never to a crowd: no pick
 * count, no place in a crowd of one, no crowd table.
 */
export const bossAlone = (m: Pick<GameView, "settings" | "totalPlayers">) => !!m.settings.raid && m.totalPlayers === 1;

/**
 * Boss alone and a raid (solo or online) take the shared game frame on a computer (`bf-frame`, board-size.css; Nov 26): every screen of the
 * battle, so nothing moves between them. The Hidden Boss's whole fight too (round 2: his phase change and phase 2, Recluse2.tsx, keep phase
 * 1's boxes, so they take it with phase 1; out of it, his figures were sized for other room than every other boss's). A Battle Tower floor
 * keeps its own layout.
 */
export const bossFramed = (m: Pick<GameView, "settings" | "boss" | "tower" | "towerParty">) =>
  !!m.boss && !!m.settings.raid && !m.tower && !m.towerParty;

/** Crowd 50 v 50: your team (the side you play all match), if you have one. */
export function myTeam(m: Pick<GameView, "standings">): "w" | "b" | null {
  return m.standings().find((s) => s.isYou)?.team ?? null;
}

/** Which players the scoreboard shows: a team (Black, White), or everyone ("All", ranked by points, team marks). */
export type TeamPick = "w" | "b" | "all";

/**
 * The leaderboard as you should see it: in Crowd 50 v 50 each team has its own
 * cut (half the knockouts each), so it shows your team with your team's cut line
 * (where the cut would fall now: the rows it would take are marked `cut`; ties at the line go through).
 * `pick` (the phone's scoreboard, TeamPick) shows another team instead, or "All": both teams ranked by points, with
 * each row's team marked (`teams`) and no cut line (each team is cut on its own).
 */
export function towerView(m: Pick<GameView, "standings" | "cutoff" | "settings" | "stage" | "totalPlayers"> & { boss?: BossView | null }, pick?: TeamPick): { standings: Standing[]; cutoff: number; teamLabel: string | null; teams?: boolean } {
  const all = m.standings();
  // Boss battle: one crowd, no cut line (the boss strikes instead). Boss alone: just you, your own row.
  if (m.boss) return { standings: all, cutoff: all.filter((s) => !s.out).length, teamLabel: bossAlone(m) ? "You" : "The crowd" };
  const team = all.find((s) => s.isYou)?.team ?? null;
  if (!team) return { standings: all, cutoff: m.cutoff, teamLabel: null };
  if (pick === "all") return { standings: all, cutoff: all.filter((s) => !s.out).length, teamLabel: "All players", teams: true };
  const side = pick ?? team;
  const mine = all.filter((s) => s.team === side);
  const alive = mine.filter((s) => !s.out);
  return { standings: mine, cutoff: alive.filter((s) => !s.cut).length, teamLabel: side === "w" ? "White team" : "Black team" };
}

export const isCrowd = (m: Pick<GameView, "settings">) => m.settings.mode === "crowd";

/**
 * A 50 v 50 (Crowd's two teams, not a boss battle): the screens whose middle box and scoreboard hold one place on a
 * phone (Eric, Nov 1). A boss raid, the Crowd's boss final and every other mode keep their own layout.
 */
export const isCrowdFifty = (m: Pick<GameView, "settings" | "boss">) => isCrowd(m) && !m.boss;

/** Decimals a score shows to: 2 where the crowd's scoring keeps them (CrowdScoring), else 1. */
export const scoreDp = (s: Pick<Settings, "crowdScoring">) => (s.crowdScoring ? 2 : 1);

/** What a Crowd match's last cut leads to, by name: the team final, the boss final or the duel. */
export function finalName(s: Pick<Settings, "finalFormat"> & Partial<Pick<Settings, "crowdCuts">>): string {
  // (The 50 v 50 rework has no ending: what follows its last cut is the 1 v 1, the last player of each side.)
  if (s.crowdCuts?.length) return "1 v 1";
  return s.finalFormat === "boss" ? "Boss final" : s.finalFormat === "duel" ? "Duel" : "Team final";
}

type CutSettings = Pick<Settings, "roundsPerStage" | "firstStageRounds" | "stageRounds"> & Partial<Pick<Settings, "crowdCuts" | "crowdMoveLimit" | "openingMoves">>;

/** "4 v 4": a stage's size a side. */
export const versus = (n: number) => `${n} v ${n}`;

/**
 * The 50 v 50 rework's top bar, after "Move 31" (C3; the design's rule 3): "cut in 2" counting down in moves as the board numbers
 * them, "4 v 4 next" on a cut's own move (the size it leaves), "1 v 1 from move 43" through the last stage before it ("1 v 1
 * next" on its cut's move), then "1 v 1". Null: not the rework (the old words, "cut in 2" / "cut now"). Moves are counted from
 * the stage's plies (roundsInStage), so a test's `?rounds=` reads true too.
 */
export function cutCountdown(s: CutSettings, stage: number, roundsPlayed: number, moveNo: number | null): string | null {
  const cuts = s.crowdCuts;
  if (!cuts?.length) return null;
  if (stage >= cuts.length) return "1 v 1";
  const movesLeft = Math.ceil((roundsInStage(s, stage) - roundsPlayed) / 2);
  const last = stage === cuts.length - 1;
  if (movesLeft <= 1) return `${last ? "1 v 1" : versus(cuts[stage]!.keep)} next`;
  return last && moveNo ? `1 v 1 from move ${moveNo + movesLeft}` : `cut in ${movesLeft}`;
}

/**
 * The 50 v 50's NEXT CUT on a computer's labeled top row (Nov 26, Eric's mock): "in 14 moves", "34 v 34" (on the cut's own move: what it
 * leaves), "now" (no cut schedule: this move is the stage's last), "1 v 1 at move 43", "1 v 1". From cutCountdown's words, or the moves left.
 */
export function nextCutValue(countdown: string | null, movesLeft: number): string {
  if (!countdown) return movesLeft <= 1 ? "now" : `in ${movesLeft} moves`;
  return countdown.replace(/ next$/, "").replace(/^cut in (\d+)$/, "in $1 moves").replace(/ from move (\d+)$/, " at move $1");
}

/** cutCountdown's words for a narrow phone's top bar (about 60 px): "to 34v34" (a cut's move), "1v1 at 43", "1v1". */
export const shortCountdown = (words: string) => words.replace(/ v /g, "v").replace(/^(\S+) next$/, "to $1").replace(" from move ", " at ");

/**
 * The 50 v 50 rework's stages from `stage` on, by the game's move numbers (the cut screen's box, C3): each stage's size a side and
 * its first and last move, the 1 v 1 last (its last move the limit). From the schedule (CROWD_CUTS), counted as the board counts:
 * a test's `?rounds=` stages by their plies from `fromMove`, the move the stage begins.
 */
export function stagesAhead(s: CutSettings, stage: number, fromMove: number): { size: number; from: number; to: number }[] {
  const cuts = s.crowdCuts ?? [];
  const out: { size: number; from: number; to: number }[] = [];
  let from = fromMove;
  for (let i = stage; i <= cuts.length; i++) {
    const size = i === 0 ? CROWD_SIDE : cuts[i - 1]!.keep;
    const moves = Math.max(1, Math.ceil(roundsInStage(s, i) / 2));
    const to = i < cuts.length ? from + moves - 1 : (s.crowdMoveLimit ?? from + moves - 1);
    out.push({ size, from, to });
    from = to + 1;
  }
  return out;
}

/** A 50 v 50's side (CROWD_LOBBY_SIZE / 2). */
const CROWD_SIDE = 50;

/** The rework's stages in words, from the next ("The 4 v 4 plays moves 34-39, then 2 v 2, then the 1 v 1 from move 43."). */
export function stagesLine(ahead: readonly { size: number; from: number; to: number }[]): string {
  const [next, ...rest] = ahead;
  if (!next) return "";
  const span = (a: { from: number; to: number }) => (a.from === a.to ? `move ${a.from}` : `moves ${a.from}-${a.to}`);
  if (next.size === 1) return `The 1 v 1 plays ${span(next)}.`;
  const one = rest.find((a) => a.size === 1);
  const between = rest.filter((a) => a.size > 1).map((a) => versus(a.size));
  return `The ${versus(next.size)} plays ${span(next)}, ${between.length ? `then ${between.join(", ")}, ` : ""}then the 1 v 1${one ? ` from move ${one.from}` : ""}.`;
}

/** The rework's 1 v 1 has just begun (its first turn, solo or online): the banner's moment (C3). */
export const oneVOneBegins = (m: Pick<GameView, "settings" | "stage" | "roundsPlayed" | "boss">) =>
  !m.boss && !!m.settings.crowdCuts?.length && m.stage === m.settings.crowdCuts.length && m.roundsPlayed === 0;

/**
 * The results table's rows: your average loss per move in each part of the match, named for what was played. Classic:
 * each stage, then "Final". Crowd: the knockouts as one row (a stage there is a move or two), then its ending (team
 * final, boss final or duel). A raid or Boss alone: the boss battle.
 */
export function lossRows(match: Pick<GameView, "settings" | "lossesByStage">): { label: string; avg: number }[] {
  const s = match.settings;
  const stages = s.knockoutsPerStage.length;
  const avg = (l: readonly number[]) => l.reduce((a, b) => a + b, 0) / l.length;
  const parts: { label: string; losses: number[] }[] = [];
  const add = (label: string, l: readonly number[]) => {
    const last = parts.at(-1);
    if (last?.label === label) last.losses.push(...l);
    else parts.push({ label, losses: [...l] });
  };
  match.lossesByStage.forEach((l, i) => {
    if (s.raid) add("Boss battle", l);
    else if (i >= stages) add(s.mode === "crowd" ? finalName(s) : "Final", l);
    else add(s.mode === "crowd" ? "Knockouts" : `Stage ${i + 1}`, l);
  });
  return parts.filter((p) => p.losses.length).map((p) => ({ label: p.label, avg: avg(p.losses) }));
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
