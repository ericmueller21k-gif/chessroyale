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
import { BOSS_POWERS, mulberry32, type BossPowerSettings, type BossPowerState, type BossState, type PowerEvent, type PowerId } from "@chessroyale/core";
import { pieceAt } from "../rules.ts";

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

export const logit = (x: number) => {
  const q = Math.min(0.999, Math.max(0.001, x));
  return Math.log(q / (1 - q));
};

// ---------------- The ultimate's meter ----------------

/** The rates the meter fills at (BOSS_POWERS). */
export type RageRates = Pick<BossPowerSettings, "rageFull" | "rageOverTime" | "ragePerMove" | "rageAheadMax" | "rageAheadFull" | "ragePerMaterial">;

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

/** Rage points: the charge from time and the eval, plus the boss's own material lost (a queen's worth fills it). */
export function ragePoints(p: Pick<BossPowerState, "charge" | "lost">, s: RageRates = BOSS_POWERS): number {
  return (p.charge ?? 0) + p.lost * s.ragePerMaterial;
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
  /** As a crowd turn begins, first: what wore off (its passive's state after its turns). */
  wearOff?(next: BossPowerState, t: TurnContext): void;
  /**
   * The ultimate's step as a crowd turn begins, while it hasn't come yet (`ultAt` unset): the meter, the warning, the
   * trigger, the test switch. True when it comes now (the passive then waits a turn if it was due).
   */
  ultimate(next: BossPowerState, t: TurnContext): boolean;
  /** Every turn after the ultimate's step (G-REX's barrage). */
  everyTurn?(next: BossPowerState, t: TurnContext): void;
  /** The passive's step. */
  passive(next: BossPowerState, t: TurnContext): void;
  /** Its limits on the crowd's moves this turn (the dispatcher lifts them for the turn if none are left). */
  crowdFilter?(allowed: string[], boss: BossState, fen: string): string[];
  /** What stops the boss's own moves now (a pie, a toy block), or null: nothing does. */
  bossStops?(boss: BossState): ((move: string, fen: string) => boolean) | null;
  /** A power touches this crowd turn: its picks don't count as fair-play signals. */
  powerTurn?(boss: BossState): boolean;
  /** The squares that show ice (`crowdAllowed`: the dispatcher's). */
  iced?(boss: BossState, fen: string, crowdAllowed: (boss: BossState, fen: string) => string[] | null): string[];
}

/** The rage meter is full. */
export const meterFull = (next: BossPowerState, t: Pick<TurnContext, "s">): boolean => ragePoints(next, t.s) >= t.s.rageFull;

/** The test switch brings this boss's ultimate: warned (or due) as the second turn begins, after the boss's first move. */
export const testSwitch = (t: Pick<TurnContext, "test" | "ultimate" | "turn">): boolean => t.test === t.ultimate && t.turn >= 2;

/**
 * The usual ultimate (the blizzard, the funhouse, the Roman candle): the meter full (or the test switch), a warning as
 * this turn begins; the next turn, the ultimate. The test trigger: straight to it. Once a match. True when it comes now.
 */
export function warnThenUnleash(next: BossPowerState, t: TurnContext): boolean {
  if (t.ultNext) {
    next.ultAt = t.turn;
    return true;
  }
  if (next.warnAt === undefined) {
    if (meterFull(next, t) || testSwitch(t)) {
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
