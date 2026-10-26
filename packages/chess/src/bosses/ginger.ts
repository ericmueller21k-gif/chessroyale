/**
 * Ginger, the Freeze boss (BOSS_ROSTER "gingerbread"): his rules. His passive, the freeze, ices one of the crowd's
 * pieces that matters for a couple of turns, every few turns. His ultimate, the blizzard, lasts three turns and thaws
 * (Eric, Oct 12: "1 unmelted piece turn 1, turn 2 about 4–5 pieces, then all"): it ices every crowd piece but one, a
 * random one with a move (Eric, Oct 11; it was the queen); the next turn four or five are free in all (that one and
 * more thawed, at random, those with a move first); the turn after, the ice is gone. The pieces that thaw next turn
 * are named the turn before (they show cracked, dripping ice). Numbers: BOSS_POWERS.freeze*, blizzardTurns,
 * blizzardFree. His art and moments are the app's (characters/gingerbread.ts, the ice and the blizzard in
 * characters/effects/).
 */
import { BOSS_POWERS, type BossPowerSettings, type BossState } from "@chessroyale/core";
import { legalMoves, pieceAt, sideToMove } from "../rules.ts";
import { VALUE, bossPowers, from, powerRoll, to, turnOf, warnThenUnleash, type BossRules, type Side } from "./base.ts";

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const GINGER_FX = { freeze: 2300, blizzard: 3600, thaw: 2200 } as const;

/**
 * Freeze: the piece to ice, one that matters (the most valuable and mobile of the crowd's pieces: a pick from the
 * top three), never the king, never a piece without a move, and never one whose freeze leaves no other legal move.
 */
export function chooseFreeze(fen: string, crowdSide: Side, seed: number, turn: number, pie?: string | null): { square: string; piece: string } | null {
  const legal = legalMoves(fen).filter((m) => to(m) !== pie);
  const moves = new Map<string, number>();
  for (const m of legal) moves.set(from(m), (moves.get(from(m)) ?? 0) + 1);
  const options = [...moves.entries()]
    .map(([square, n]) => ({ square, n, piece: pieceAt(fen, square) }))
    .filter((o) => o.piece && o.piece.color === crowdSide && o.piece.type !== "k" && legal.length - o.n > 0)
    // Pieces before pawns; then the most valuable and mobile. Ties by square, so every device ranks alike.
    .map((o) => ({ ...o, score: (o.piece!.type === "p" ? 0 : 100) + VALUE[o.piece!.type]! * 3 + o.n }))
    .sort((a, b) => b.score - a.score || (a.square < b.square ? -1 : 1));
  if (!options.length) return null;
  const top = options.slice(0, 3);
  const pick = top[Math.floor(powerRoll(seed, "freeze", turn) * top.length)]!;
  return { square: pick.square, piece: pick.piece!.type };
}

/**
 * One of the crowd's pieces with a legal move (among `among`, if given), from `roll` (a number from the seed): never
 * the king nor `frozen` unless nothing else can move (then the king, then the frozen piece); null when none can move.
 * In check only the pieces that can answer it have a move, so the one picked always can.
 */
function chooseMover(fen: string, crowdSide: Side, roll: number, frozen?: string | null, among?: ReadonlySet<string>): string | null {
  const movers = [...new Set(legalMoves(fen).map(from))].filter((sq) => pieceAt(fen, sq)?.color === crowdSide && (!among || among.has(sq))).sort();
  const pieces = movers.filter((sq) => pieceAt(fen, sq)?.type !== "k" && sq !== frozen);
  const king = movers.filter((sq) => pieceAt(fen, sq)?.type === "k");
  const pool = pieces.length ? pieces : king.length ? king : movers;
  return pool.length ? pool[Math.floor(roll * pool.length)]! : null;
}

/**
 * The blizzard's free piece as it comes: one of the crowd's pieces with a legal move, at random from the seed (the same
 * on every device). Never the king nor the piece the freeze holds, unless nothing else can move (then the king, then
 * the frozen piece); null when the crowd has no move at all.
 */
export function chooseBlizzard(fen: string, crowdSide: Side, seed: number, turn: number, frozen?: string | null): string | null {
  return chooseMover(fen, crowdSide, powerRoll(seed, "blizzard", turn), frozen);
}

/** How many crowd turns the blizzard lasts (BOSS_POWERS.blizzardTurns; at least 2: its ice, then the turn it's gone). */
export const blizzardLength = (s: Pick<BossPowerSettings, "blizzardTurns"> = BOSS_POWERS): number => Math.max(2, Math.round(s.blizzardTurns));

/**
 * How many of the crowd's pieces are free in all on the blizzard's turn `step` (0: the turn it came, crowd turn
 * `came`), from the seed: a number in that turn's range (BOSS_POWERS.blizzardFree; the last range for a turn past the
 * list). On its last turn, every piece (Infinity).
 */
export function blizzardFree(seed: number, came: number, step: number, s: Pick<BossPowerSettings, "blizzardTurns" | "blizzardFree"> = BOSS_POWERS): number {
  if (step >= blizzardLength(s) - 1) return Infinity;
  const [lo, hi] = s.blizzardFree[Math.min(step, s.blizzardFree.length - 1)] ?? [1, 1];
  return lo + Math.floor(powerRoll(seed, "blizzardFree", came, step) * (hi - lo + 1));
}

/** The crowd's pieces, by square (a1, a2… h8). */
function crowdSquares(fen: string, crowd: Side): string[] {
  const out: string[] = [];
  for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) if (pieceAt(fen, `${f}${r}`)?.color === crowd) out.push(`${f}${r}`);
  return out;
}

/**
 * `count` of the iced pieces to thaw, at random from the seed (and what for: the blizzard that came on crowd turn
 * `came`, picked on crowd turn `turn`): those with a legal move first, then the rest. Never the king, nor `held` (a
 * piece the freeze still holds): they wait for the mercy rule or the ice's last turn.
 */
function pickThaw(fen: string, iced: readonly string[], count: number, seed: number, came: number, turn: number, held: string | null): string[] {
  if (count <= 0) return [];
  const movers = new Set(legalMoves(fen).map(from));
  return iced
    .filter((sq) => pieceAt(fen, sq)?.type !== "k" && sq !== held)
    .map((sq) => ({ sq, tier: movers.has(sq) ? 0 : 1, roll: powerRoll(seed, "thaw", came, turn, sq) }))
    .sort((a, b) => a.tier - b.tier || a.roll - b.roll || (a.sq < b.sq ? -1 : 1))
    .slice(0, count)
    .map((o) => o.sq);
}

/**
 * One turn of the blizzard as it begins (crowd turn `turn`, the crowd to move in `fen`; it came on crowd turn `came`),
 * from the pieces its ice held as the turn before began (`prevIced`) and those named then to thaw now (`due`): which
 * thaw now, which stay iced, and which thaw next turn. Pieces once free stay free, wherever they've moved; on its last
 * turn everything thaws. Otherwise the pieces due thaw, then more if fewer of the crowd's pieces are free than this
 * turn's count (a free one lost to the boss), those with a move first; and if no free piece has a legal move (in check:
 * none can answer it), one that has one thaws too (the mercy rule: never the king nor a frozen piece while another
 * will do). The pieces to thaw next turn are named now: at random, those with a move first (before its last turn,
 * all that's left).
 */
export function blizzardStep(
  fen: string,
  crowd: Side,
  seed: number,
  came: number,
  turn: number,
  prevIced: readonly string[],
  due: readonly string[],
  s: Pick<BossPowerSettings, "blizzardTurns" | "blizzardFree"> = BOSS_POWERS,
  frozen: { square: string; until: number } | null = null,
): { thawing: string[]; iced: string[]; next: string[] } {
  const step = turn - came;
  const last = blizzardLength(s) - 1;
  const pieces = crowdSquares(fen, crowd);
  const was = new Set(prevIced);
  // (A piece the freeze still holds on crowd turn t.)
  const held = (t: number) => (frozen && frozen.until >= t ? frozen.square : null);
  let iced = pieces.filter((sq) => was.has(sq));
  let thawing = step >= last ? iced : iced.filter((sq) => due.includes(sq));
  iced = iced.filter((sq) => !thawing.includes(sq));
  if (step < last) {
    const more = pickThaw(fen, iced, blizzardFree(seed, came, step, s) - (pieces.length - iced.length), seed, came, turn, held(turn));
    iced = iced.filter((sq) => !more.includes(sq));
    thawing = [...thawing, ...more];
    const ice = new Set(iced);
    const legal = legalMoves(fen);
    if (legal.length && legal.every((m) => ice.has(from(m)))) {
      const sq = chooseMover(fen, crowd, powerRoll(seed, "thawMercy", came, turn), held(turn), ice);
      if (sq) {
        iced = iced.filter((x) => x !== sq);
        thawing = [...thawing, sq];
      }
    }
  }
  const free = pieces.length - iced.length;
  const next = step + 1 >= last ? iced : pickThaw(fen, iced, blizzardFree(seed, came, step + 1, s) - free, seed, came, turn, held(turn + 1));
  return { thawing: [...thawing].sort(), iced, next: [...next].sort() };
}

/**
 * The blizzard's ice on crowd turn `turn` as the state stands: the squares it holds, or null (none). `fen` reads a
 * battle from before the thaw too (Oct 12: on the crowd's turn it came, every crowd piece but its first iced).
 */
function blizzardIce(boss: BossState, turn: number, fen: string): Set<string> | null {
  const p = boss.powers;
  const b = p?.blizzard;
  if (!p || !b || p.ultAt === undefined || bossPowers(boss)?.ultimate !== "blizzard" || (b.at ?? b.turn) !== turn) return null;
  const iced = b.iced ?? (sideToMove(fen) === boss.crowdSide ? crowdSquares(fen, boss.crowdSide).filter((sq) => sq !== b.square) : []);
  return iced.length ? new Set(iced) : null;
}

/** The blizzard's ice holds some of the crowd's pieces this crowd turn (each of its turns but the last). */
export function blizzardNow(boss: BossState | null | undefined): boolean {
  const p = boss?.powers;
  const b = p?.blizzard;
  if (!boss || !p || !b || p.ultAt === undefined || bossPowers(boss)?.ultimate !== "blizzard" || (b.at ?? b.turn) !== turnOf(boss)) return false;
  // (A battle from before the thaw: on its own turn.)
  return b.iced ? b.iced.length > 0 : true;
}

/** Ginger: a frozen piece every few turns (the freeze); his blizzard ices all but one piece, then thaws over two turns. */
export const GINGER: BossRules = {
  id: "gingerbread",
  wearOff(next, t) {
    // The ice after its turns (or once its piece is gone).
    if (next.frozen) {
      const piece = pieceAt(t.fen, next.frozen.square);
      if (next.frozen.until < t.turn || piece?.color !== t.crowd || piece.type !== next.frozen.piece) next.frozen = null;
    }
  },
  ultimate(next, t) {
    const now = warnThenUnleash(next, t);
    if (now) {
      const square = chooseBlizzard(t.fen, t.crowd, t.seed, t.turn, next.frozen?.square);
      t.events.push({ kind: "blizzard", turn: t.turn, ...(square ? { square } : {}) });
      if (square) {
        // Every crowd piece but the free one iced (more free if the first turn's count is more than one), and the
        // pieces to thaw next turn named.
        const all = crowdSquares(t.fen, t.crowd).filter((sq) => sq !== square);
        const first = blizzardStep(t.fen, t.crowd, t.seed, t.turn, t.turn, all, [], t.s, next.frozen ?? null);
        next.blizzard = { turn: t.turn, square, at: t.turn, iced: first.iced, next: first.next };
      } else next.blizzard = null;
    }
    return now;
  },
  // Through its turns (the last one with the ice gone), the meter stays empty and no other ultimate comes.
  ultimateRunning: (p, turn, s) => turn < p.ultAt! + blizzardLength(s),
  // Each later turn of the blizzard: the pieces due thaw (the thaw's moment), the rest stay iced; its last, all of them.
  everyTurn(next, t) {
    const b = next.blizzard;
    if (!b || next.ultAt === undefined || t.turn <= b.turn) return;
    const step = blizzardStep(t.fen, t.crowd, t.seed, b.turn, t.turn, b.iced ?? [], b.next ?? [], t.s, next.frozen ?? null);
    if (step.thawing.length) t.events.push({ kind: "thaw", turn: t.turn, squares: step.thawing });
    next.blizzard = t.turn - b.turn < blizzardLength(t.s) - 1 && step.iced.length ? { ...b, at: t.turn, iced: step.iced, next: step.next } : null;
  },
  passive(next, t) {
    // (Not while the blizzard lasts: the freeze waits until its ice is gone.)
    if (next.ultAt !== undefined && t.turn < next.ultAt + blizzardLength(t.s)) {
      if (t.turn >= next.nextPassive) next.nextPassive = t.turn + 1;
      return;
    }
    if (t.turn < next.nextPassive) return;
    const pick = chooseFreeze(t.fen, t.crowd, t.seed, t.turn, next.pies?.[0]?.square);
    if (pick) {
      next.frozen = { ...pick, until: t.turn + t.s.freezeTurns - 1 };
      t.events.push({ kind: "freeze", turn: t.turn, square: pick.square });
      const [lo, hi] = t.s.freezeEvery;
      next.nextPassive = t.turn + lo + Math.floor(powerRoll(t.seed, "every", t.turn) * (hi - lo + 1));
    } else next.nextPassive = t.turn + 1;
  },
  // Frozen pieces can't move; in the blizzard only its free pieces move (none can: everything, as the dispatcher lifts it).
  crowdFilter(allowed, boss, fen) {
    const ice = blizzardIce(boss, turnOf(boss), fen);
    if (ice) return allowed.filter((m) => !ice.has(from(m)));
    const frozen = boss.powers!.frozen;
    return frozen ? allowed.filter((m) => from(m) !== frozen.square) : allowed;
  },
  powerTurn: (boss) => !!boss.powers!.frozen || blizzardNow(boss),
  // The frozen piece; in the blizzard the pieces its ice holds, through the boss's turn after it too (none once its
  // free pieces have no move: the dispatcher lifts it).
  iced(boss, fen) {
    const p = boss.powers!;
    const ice = blizzardIce(boss, p.turn, fen);
    if (ice) {
      if (sideToMove(fen) === boss.crowdSide) {
        const legal = legalMoves(fen);
        if (legal.length && legal.every((m) => ice.has(from(m)))) return [];
      }
      return [...ice].filter((sq) => pieceAt(fen, sq)?.color === boss.crowdSide).sort();
    }
    return p.frozen ? [p.frozen.square] : [];
  },
  // The pieces whose ice thaws as the next crowd turn begins (cracked and dripping on screen).
  view: (p) => ({ thaw: [...(p.blizzard?.next ?? [])] }),
};
