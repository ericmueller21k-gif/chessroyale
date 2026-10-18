/**
 * The base boss: what every boss's rules file (bosses/<boss>.ts) fills in, and the helpers they share. The dispatcher
 * (boss-powers.ts) calls these hooks, so the server, the solo game and every screen work out the same thing for any
 * boss. A boss is registered in bosses/index.ts by its BOSS_ROSTER id; its numbers live in BOSS_POWERS (settings.ts).
 *
 * The ground rules every boss keeps (boss-powers.ts):
 * - Every choice comes from the battle's seed (powerRoll) and the position: the same on every device and replay.
 * - A power never leaves anyone without a legal move and never breaks check (the dispatcher lifts a restriction that
 *   would leave none). The king is never frozen.
 * - The judge plays by the same rules (judgeTop, judgeCandidates, allowedSearch).
 * - Turns are the crowd's: turn N is the crowd's Nth move of the battle (crowdMoves + 1 while it's being picked).
 */
import {
  BOSS_POWERS,
  bossDef,
  mulberry32,
  type BossPowerSettings,
  type BossPowerState,
  type BossState,
  type MatchState,
  type PlayerState,
  type PowerEvent,
  type PowerId,
  type Settings,
  type StopReason,
} from "@chessroyale/core";
import type { BoardState } from "../boards.ts";
import type { NetBossPowers } from "../protocol.ts";
import { pieceAt } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import type { MoveScore } from "../uci.ts";

export type Side = "w" | "b";
export const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const other = (s: Side): Side => (s === "w" ? "b" : "w");
export const from = (m: string) => m.slice(0, 2);
export const to = (m: string) => m.slice(2, 4);

/** Material on the board for one side (pawns 1, knights and bishops 3, rooks 5, queens 9). */
export function materialOf(fen: string, side: Side): number {
  let total = 0;
  for (const c of fen.split(" ")[0]!) {
    const v = VALUE[c.toLowerCase()];
    if (v && (c === c.toUpperCase()) === (side === "w")) total += v;
  }
  return total;
}

/** A number in [0, 1) from the battle's seed and what it's for: the same on every device and every replay. */
export function powerRoll(seed: number, ...parts: readonly (string | number)[]): number {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (const ch of parts.join("|")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return mulberry32(h)();
}

/** The boss's powers, if it has any (its template's passive and ultimate). */
export function bossPowers(boss: Pick<BossState, "id"> | null | undefined): { passive: PowerId; ultimate: PowerId } | null {
  return bossDef(boss?.id)?.powers ?? null;
}

/** The crowd turn being picked now. */
export const turnOf = (boss: Pick<BossState, "crowdMoves">) => boss.crowdMoves + 1;

/** The crowd's half of the board (ranks 1-4 for White, 5-8 for Black). */
export function crowdHalf(crowd: Side): string[] {
  const out: string[] = [];
  for (const f of "abcdefgh") for (let r = crowd === "w" ? 1 : 5; r <= (crowd === "w" ? 4 : 8); r++) out.push(`${f}${r}`);
  return out;
}

/**
 * The squares a move touches: where it starts and lands, every square it passes over on its way (a slide along a
 * rank, file or diagonal; a pawn's double step), and a castling king's way on to his rook's corner (`fen` says it's a
 * king). A knight's jump passes over nothing.
 */
export function moveSquares(move: string, fen?: string): string[] {
  const a = from(move);
  const b = to(move);
  const out = [a, b];
  const f0 = a.charCodeAt(0) - 97;
  const r0 = Number(a[1]) - 1;
  const df = b.charCodeAt(0) - 97 - f0;
  const dr = Number(b[1]) - 1 - r0;
  const sq = (f: number, r: number) => `${"abcdefgh"[f]}${r + 1}`;
  if (df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr)) {
    const n = Math.max(Math.abs(df), Math.abs(dr));
    for (let k = 1; k < n; k++) out.push(sq(f0 + Math.sign(df) * k, r0 + Math.sign(dr) * k));
  }
  if (fen && dr === 0 && Math.abs(df) === 2 && pieceAt(fen, a)?.type === "k") {
    // (Castling: his way past the square he lands on, to the rook's corner.)
    for (let f = f0 + df + Math.sign(df); f >= 0 && f <= 7; f += Math.sign(df)) out.push(sq(f, r0));
  }
  return out;
}

/**
 * Each position's top move at `nodes`, shared out over the engines (each takes the next position as it's free): Big
 * Boy's bounce and Alfil's fusion and Slam weigh their candidates this way.
 */
export async function topEach(engines: readonly EngineLike[], fens: readonly string[], nodes: number): Promise<(MoveScore | undefined)[]> {
  return eachOn(engines, fens, async (e, fen) => (await (e.topMovesAt ? e.topMovesAt(fen, 1, nodes) : e.topMoves(fen, 1)))[0]);
}

/** `work` on each item, shared out over the engines (each takes the next item as it's free); in the items' order. */
export async function eachOn<T, R>(engines: readonly EngineLike[], items: readonly T[], work: (engine: EngineLike, item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    engines.map(async (e) => {
      while (next < items.length) {
        const i = next++;
        out[i] = await work(e, items[i]!);
      }
    }),
  );
  return out;
}

export const logit = (x: number) => {
  const q = Math.min(0.999, Math.max(0.001, x));
  return Math.log(q / (1 - q));
};

/**
 * How much a move gives away against the best: points of expected score (0-100) and log-odds. Log-odds
 * catch a blunder in a position that's already won or lost, where the points shrink (0.05 to 0.01 is 4
 * points but throws the rest away).
 */
export function moveLoss(best: number, got: number): { points: number; logit: number } {
  const g = Math.min(best, got);
  return { points: (best - g) * 100, logit: logit(best) - logit(g) };
}

// ---------------- The ultimate's meter ----------------

/** The rates the meter fills at (BOSS_POWERS). */
export type RageRates = Pick<BossPowerSettings, "rageFull" | "rageOverTime" | "ragePerMove" | "rageAheadMax" | "rageAheadFull" | "ragePerMaterial" | "rageSpeed">;

/**
 * One crowd move's worth of rage over time: ragePerMove, plus up to rageAheadMax more while the crowd is ahead on the
 * judged eval (`judged`: its expected score after the move, 0-1; all of it from rageAheadFull). Nothing with the
 * switch off (rageOverTime).
 */
export function rageTick(judged: number | undefined, s: RageRates = BOSS_POWERS): number {
  if (!s.rageOverTime) return 0;
  const ahead = judged === undefined ? 0 : Math.max(0, Math.min(1, (judged - 0.5) / Math.max(0.01, s.rageAheadFull - 0.5)));
  return s.ragePerMove + s.rageAheadMax * ahead;
}

/** Rage points gathered all battle: the charge from time, the eval and strikes, plus the boss's own material lost. */
export function ragePoints(p: Pick<BossPowerState, "charge" | "lost">, s: Pick<RageRates, "ragePerMaterial"> = BOSS_POWERS): number {
  return (p.charge ?? 0) + p.lost * s.ragePerMaterial;
}

/** How fast a boss's meter fills (BOSS_POWERS.rageSpeed: every gain times this). */
export const rageSpeedOf = (id: string | undefined, s: Pick<RageRates, "rageSpeed"> = BOSS_POWERS): number => (id && s.rageSpeed[id]) || 1;

/**
 * The meter now, in rage points: what was gathered since the last ultimate spent it (and since its effect ended),
 * times the boss's speed. 0 to rageFull and past it (a full meter waits for its ultimate).
 */
export function rageNow(p: Pick<BossPowerState, "charge" | "lost" | "rageUsed">, speed: number, s: Pick<RageRates, "ragePerMaterial"> = BOSS_POWERS): number {
  return Math.max(0, ragePoints(p, s) - (p.rageUsed ?? 0)) * speed;
}

// ---------------- The base boss ----------------

/** What a boss's hooks get as a crowd turn begins (prepareTurn). Events go in `events`, in the order they happen. */
export interface TurnContext {
  /** The crowd turn being set up. */
  turn: number;
  /** The position, the crowd to move. */
  fen: string;
  crowd: Side;
  seed: number;
  /** The boss's powers (its BOSS_ROSTER template). */
  passive: PowerId;
  ultimate: PowerId;
  /** The test switch (?power=): this ultimate comes early. */
  test: string;
  /** The test trigger (an admin's) was pulled: bring the ultimate now, without the warning. */
  ultNext: boolean;
  /** The boss's move just played (Hollow covers its piece's square after his first). */
  lastMove: string | null;
  /** How fast this boss's meter fills (rageSpeedOf). */
  rageSpeed: number;
  s: BossPowerSettings;
  events: PowerEvent[];
}

/**
 * A boss's rules: the hooks the dispatcher (boss-powers.ts) calls. Each hook sees only its own boss's battles, so it
 * reads and writes only its own state (BossPowerState's fields for its powers). Hooks change `next` in place, as the
 * turn is set up.
 */
export interface BossRules {
  /** Its BOSS_ROSTER id. */
  id: string;
  /**
   * Its ultimate comes at the start of the boss's turn, after the crowd's move (Hollow's Lights out, Big Boy's Big
   * Bounce), not as a crowd turn begins: the test trigger is kept until then.
   */
  ultimateOnHisTurn?: boolean;
  /** The test trigger is worked out at his turn, after his move (Wrangler's line-up): kept until its ultimate comes. */
  triggerAtHisTurn?: boolean;
  /**
   * The God King's help doesn't work against this boss (the Hidden Boss's passive): his move, his strike and his Last
   * Stand never come (the runner's kingDecision, callStrike, lastStandFor). A player's try at his move or strike spends a
   * charge as if it had worked (the runner's kingTried; Eric, Oct 14); the Last Stand, which nobody calls, spends nothing.
   */
  blocksKing?: boolean;
  /**
   * The boss never strikes the crowd: nobody is knocked out every bossKillEvery moves (the runner's bossKillDue), and
   * the screens get no count to its next strike (`strikeIn` null). The Hidden Boss: his real fight is a squad of four,
   * who must all reach phase 2's four boards (Oct 14).
   */
  noStrikes?: boolean;
  /** Beaten: the board holds this long for its fall before the result screen, solo and online (the Hidden Boss's collapse). */
  fallMs?: number;
  /**
   * Its own meter instead of the rage meter (Wrangler's: his moves fill it, nothing else): how full (0-1) as crowd turn
   * `turn` is picked, or null (none shown). The King's strike adds nothing to it.
   */
  meter?(p: BossPowerState, turn: number, s: BossPowerSettings): number | null;
  /** As a crowd turn begins, first: what wore off (its passive's state after its turns). */
  wearOff?(next: BossPowerState, t: TurnContext): void;
  /**
   * The ultimate's step as a crowd turn begins, while none is under way (`ultAt` unset): the meter, the warning, the
   * trigger, the test switch. True when it comes now (the passive then waits a turn if it was due). It comes again and
   * again: once its effect is over (ultimateRunning) the dispatcher clears `warnAt` and `ultAt`, and the meter fills
   * again from empty.
   */
  ultimate(next: BossPowerState, t: TurnContext): boolean;
  /**
   * Its ultimate's effect still runs on crowd turn `turn` (it came at `p.ultAt`): the meter stays empty and no other
   * ultimate can come. Without it, the effect is its own turn only (the Big Bounce). Read from the state
   * as the previous turn left it, before anything wears off.
   */
  ultimateRunning?(p: BossPowerState, turn: number, s: BossPowerSettings): boolean;
  /** Every turn after the ultimate's step (G-REX's barrage). */
  everyTurn?(next: BossPowerState, t: TurnContext): void;
  /** The passive's step. */
  passive(next: BossPowerState, t: TurnContext): void;
  /** Its limits on the crowd's moves this turn (the dispatcher lifts them for the turn if none are left). */
  crowdFilter?(allowed: string[], boss: BossState, fen: string): string[];
  /** What stops the boss's own moves now (a pie, a toy block), or null: nothing does. */
  bossStops?(boss: BossState): ((move: string, fen: string) => boolean) | null;
  /**
   * Which of its powers stops `move` now, either side (for the screens' words: a refused move of yours, the boss's only
   * move through it), or null. It reads only fields the screens' view carries too (`StopFields`), so the app asks it.
   */
  stopReason?(boss: { powers?: StopFields | null }, fen: string, move: string): StopReason | null;
  /** A power touches this crowd turn: its picks don't count as fair-play signals. */
  powerTurn?(boss: BossState): boolean;
  /** The squares that show ice (`crowdAllowed`: the dispatcher's). */
  iced?(boss: BossState, fen: string, crowdAllowed: (boss: BossState, fen: string) => string[] | null): string[];
  /**
   * The judge's view of a crowd turn under its rules (G-REX's fire): moves it must score too, the top moves as it ranks
   * them, and a board's evaluation as it sees it. Without it, the engine's numbers stand as they are.
   */
  judge?: {
    mustScore(boss: BossState, fen: string): string[];
    rank(boss: BossState, top: readonly MoveScore[], fen: string): MoveScore[];
    evaluation<E extends JudgedEvaluation>(boss: BossState, evaluation: E, fen: string): E;
  };
  /** In the match: what happens after any crowd move (G-REX's fire burns what was left on a tile ablaze). */
  afterCrowdMove?(b: Battle, move: string | null): void;
  /** In the match: a crowd turn has just been set up (prepareTurn): the Hidden Boss's bullet clock sets every bank as it comes. */
  turnBegun?(b: Battle): void;
  /**
   * In the match: what happens after the boss's own move, before the crowd's next turn is set up (Sawyer saws the pawn of
   * his first move in two; the halves follow every move; Wrangler's long pull, drag and showdown line-up). `extras`:
   * what the boss's turn worked out besides the move (the host's answer online, this device's in solo).
   */
  afterBossMove?(b: Battle, move: string, extras?: BossMoveExtras): void;
  /**
   * A boss move its rules play as something else (Wrangler's long pull, written as its three squares: the double step,
   * then the pawn goes on in afterBossMove), with the move as the screens name it. Null: an ordinary move.
   */
  specialMove?(boss: BossState, fen: string, move: string): { play: string; san: string } | null;
  /**
   * The boss's move now (`board`: him to move) is the follow-up its power's engine search scored (Wrangler's reply to
   * the showdown's duel): it must be the engine's best move at full strength (BossMoveKind "best": never the brain's, a
   * slip or a stumble), or the power plays out other than it was scored. The server decides it, so the host and solo
   * play it alike. The King's strike still staggers it.
   */
  bestReply?(boss: BossState, board: BoardState): boolean;
  /**
   * What the boss's turn must work out besides its move, with the engine (Wrangler's long pull, drag and showdown), in
   * the position before its move: the server asks the host's device for it with the move; solo works it out. Null:
   * nothing.
   */
  asks?(boss: BossState, fen: string): BossAsks | null;
  /** In the match: its own costs on a round's scores (Hollow's wrong tries into the dark). */
  scoreRound?(b: Battle, players: { playerId: string; roundScore: number }[]): void;
  /**
   * How its battle starts, if not from the game so far: `fromStart`, from the starting position; `crowdWhite`, the crowd
   * always plays White (in a raid where it would have been Black, he claims the dark side first); `setUp`, anything
   * else done to the board before move 1, returning what to add to its powers' state (Big Boy eats a pawn).
   */
  opening?: {
    fromStart?: boolean;
    crowdWhite?: boolean;
    setUp?(b: Battle, at: { boardId: number; seed: number; crowdSide: Side; generation: number }): Partial<BossPowerState>;
  };
  /** What the screens get of its own state, on top of every boss's (protocol.ts, NetBossPowers). */
  view?(p: BossPowerState): Partial<NetBossPowers>;
}

/**
 * What a boss's turn must work out besides its move (BossRules.asks; Wrangler's): his long pulls to choose from (his
 * first move), his showdown's line-up after it ("try": one that qualifies; "test": the admins' trigger, the best found
 * even outside the band, or a drag standing in), and a lasso drag after it. `seed`: what the engine work is ordered by
 * (drawn from the battle's seed and the turn: the battle's own seed never leaves the server).
 */
export interface BossAsks {
  pull?: string[];
  drag?: true;
  showdown?: "try" | "test";
  seed: number;
}

/**
 * What a boss's turn worked out besides its move, for afterBossMove: the move as sent when its rules played it as
 * something else (`special`: Wrangler's long pull), his drag ("c3c4") and his showdown's line-up (checkLineup's
 * spec), each checked against the rules before it's used ("" or null: none), and his edge after the best duel when
 * this device's engine worked it out (solo).
 */
export interface BossMoveExtras {
  special?: string;
  drag?: string | null;
  showdown?: string | null;
  edge?: number | null;
  /** The test trigger's line-up is outside the band (the host found none inside it). */
  outside?: boolean | null;
}

/** A board's evaluation as the judge works it out: its best move, that move's expected score, and every move's. */
export interface JudgedEvaluation {
  bestMove: string;
  bestExpected: number;
  expectedAfter: Record<string, number>;
}

/**
 * An ultimate has come (its `ultAt` just set): one more this battle, and the meter is spent. The dispatcher calls it
 * as a turn begins; a boss's rules call it when theirs comes outside one (Lights out from the test trigger, the Big
 * Bounce).
 */
export function unleashed(next: BossPowerState, s: Pick<RageRates, "ragePerMaterial"> = BOSS_POWERS): BossPowerState {
  next.ults = (next.ults ?? 0) + 1;
  next.rageUsed = ragePoints(next, s);
  return next;
}

/** The rage meter is full. */
export const meterFull = (next: BossPowerState, t: Pick<TurnContext, "s" | "rageSpeed">): boolean => rageNow(next, t.rageSpeed, t.s) >= t.s.rageFull;

/**
 * The test switch brings this boss's ultimate: warned (or due) as the second turn begins, after the boss's first move.
 * Only its first: the ones after come from the meter.
 */
export const testSwitch = (t: Pick<TurnContext, "test" | "ultimate" | "turn">, p?: Pick<BossPowerState, "ults">): boolean => t.test === t.ultimate && t.turn >= 2 && !p?.ults;

/**
 * The usual ultimate (the blizzard, the funhouse, the Roman candle): the meter full (or the test switch), a warning as
 * this turn begins; the next turn, the ultimate. The test trigger: straight to it. Again whenever the meter fills
 * again. True when it comes now.
 */
export function warnThenUnleash(next: BossPowerState, t: TurnContext): boolean {
  if (t.ultNext) {
    next.ultAt = t.turn;
    return true;
  }
  if (next.warnAt === undefined) {
    if (meterFull(next, t) || testSwitch(t, next)) {
      next.warnAt = t.turn;
      t.events.push({ kind: "warn", turn: t.turn });
    }
    return false;
  }
  if (t.turn > next.warnAt) {
    next.ultAt = t.turn;
    return true;
  }
  return false;
}

// ---------------- A boss's part in the match runner ----------------

/**
 * The boss's last move, as the screens show it (and the piece it took, if any). `through`: it was his only move and a
 * power stops it (Sawyer's saw, a pie, a toy block), so the limit lifted for it (the dock says so on your turn).
 */
export type BossLastMove = { move: string; san: string; staggered?: boolean; captured?: string; through?: StopReason };

/** The power fields `BossRules.stopReason` reads: the same in the match's state and in the screens' view. */
export type StopFields = Partial<Pick<BossPowerState, "cut" | "boardSaw" | "pies" | "block">>;

/**
 * What a boss's battle code (its moments in a match: the funhouse, Lights out, the bounce…) may use of the match
 * runner. The runner's methods for those moments hand it over (MatchRunner's `battle`), so each boss's code lives in its
 * own file and the runner's methods stay as they were.
 */
export interface Battle {
  state: MatchState;
  readonly boards: Map<number, BoardState>;
  readonly settings: Settings;
  bossLast: BossLastMove | null;
  readonly engines: readonly EngineLike[];
  alive(): PlayerState[];
  finalGameOver(): boolean;
  bossToMove(): boolean;
  crowdAllowed(boardId?: number): string[] | null;
  boardOf(playerId: string): BoardState | null;
  /** What happens after any crowd move (G-REX's fire). */
  afterCrowdMove(move: string | null): void;
  /**
   * The boss's turn is over without a move on the board (Alfil's fusion is his move): the crowd's turn is set up as
   * after his move (its powers: the meter, the warning, the turn's moments).
   */
  bossPassed(): void;
  /** A boss's own scratch store, kept for the match (Big Boy's bounce candidates, worked out once per position). */
  readonly memo: Map<string, unknown>;
}
