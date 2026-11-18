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
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type BossState, type SuperFreezeState } from "@chessroyale/core";
import { boardEnd } from "../boards.ts";
import { legalMoves, pieceAt, sideToMove } from "../rules.ts";
import { VALUE, bossPowers, from, heldIn, powerRoll, to, turnOf, warnThenUnleash, type Battle, type BossRules, type Side, type TurnContext } from "./base.ts";

/**
 * His Super Freeze beat by beat (ms into its moment, after its banner's hold; Eric, Nov 18: "that animation might even take 4 or 5
 * seconds for him to do a charge up and make an expanding ice block"), played while he thinks at the start of his turn, so his
 * move waits for it all (gingerTurnMs in boss-timing.ts). The banner (SUPER FREEZE!) until `chargeAt`; then his cast (`castMs`: his
 * intro's charge, one cycle of his charged hold, his blast), whose `blast` cue fires the ice bolt at `boltAt`; the bolt flies to the
 * piece (`flyMs`) and the ice block grows over the 3 x 3 from `iceAt` (`growMs`; each square's ice whole at its step, the art's
 * SUPER_ICE_STEPS), holds (`holdMs`) and settles into each frozen piece's own ice from `settleAt` (`settleMs`). `total` is the whole
 * of it. The app's art matches these numbers (packages/app/test/ginger-superfreeze.test.ts).
 */
export const SUPER_FREEZE_BEATS = (() => {
  const chargeAt = 1300;
  const castMs = 2620;
  const boltAt = chargeAt + 2090;
  const flyMs = 260;
  const iceAt = boltAt + flyMs;
  const growMs = 1520;
  const holdMs = 300;
  const settleMs = 440;
  const settleAt = iceAt + growMs + holdMs;
  return { chargeAt, castMs, boltAt, flyMs, iceAt, growMs, holdMs, settleAt, settleMs, total: settleAt + settleMs };
})();

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const GINGER_FX = { freeze: 2300, blizzard: 3600, thaw: 2200, superFreeze: SUPER_FREEZE_BEATS.total } as const;

/**
 * Freeze: the piece to ice, one that matters (the most valuable and mobile of the crowd's pieces: a pick from the
 * top three), never the king, never a piece without a move, and never one whose freeze leaves no other legal move.
 */
export function chooseFreeze(fen: string, crowdSide: Side, seed: number, turn: number, pie?: string | null, held: readonly string[] = []): { square: string; piece: string } | null {
  const legal = legalMoves(fen).filter((m) => to(m) !== pie);
  const moves = new Map<string, number>();
  for (const m of legal) moves.set(from(m), (moves.get(from(m)) ?? 0) + 1);
  // (`held`: pieces the Super Freeze holds this turn: never picked, and the crowd still has a move with them held too.)
  const options = [...moves.entries()]
    .map(([square, n]) => ({ square, n, piece: pieceAt(fen, square) }))
    .filter((o) => o.piece && o.piece.color === crowdSide && o.piece.type !== "k" && !held.includes(o.square) && legal.some((m) => !heldIn(fen, m, [...held, o.square])))
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
    if (legal.length && legal.every((m) => heldIn(fen, m, ice))) {
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

// ---------------- The Super Freeze (his second meter; Eric, Nov 18) ----------------

type SuperSettings = Pick<BossPowerSettings, "superFreezeEvery" | "superFreezeMax">;

/** The squares of the 3 x 3 round `square` that are on the board (itself included), a1 to h8. */
export function superBox(square: string): string[] {
  const f0 = square.charCodeAt(0) - 97;
  const r0 = Number(square[1]) - 1;
  const out: string[] = [];
  for (let f = f0 - 1; f <= f0 + 1; f++) for (let r = r0 - 1; r <= r0 + 1; r++) if (f >= 0 && f < 8 && r >= 0 && r < 8) out.push(`${"abcdefgh"[f]}${r + 1}`);
  return out.sort();
}

/** The crowd's pieces a Super Freeze can hold (never the king). */
const freezable = (fen: string, crowd: Side, sq: string): boolean => {
  const pc = pieceAt(fen, sq);
  return !!pc && pc.color === crowd && pc.type !== "k";
};

/**
 * The Super Freeze's target (`fen`: the position as the crowd's move lands, him to move; `n`: how many have come before, for the
 * seed): the crowd's piece (never the king) whose 3 x 3 holds the most of the crowd's pieces but the king (itself counted); equal,
 * the one whose 3 x 3 is more on the board (not cut by its edge), then at random from the seed; and those pieces (`squares`). Null: the crowd has no piece but its king.
 */
export function chooseSuperFreeze(fen: string, crowd: Side, seed: number, n: number): { target: string; squares: string[] } | null {
  const pieces = crowdSquares(fen, crowd).filter((sq) => freezable(fen, crowd, sq));
  const ranked = pieces
    .map((sq) => ({ sq, box: superBox(sq).length, squares: superBox(sq).filter((x) => freezable(fen, crowd, x)), roll: powerRoll(seed, "superFreeze", n, sq) }))
    // (Equal: the 3 x 3 more of which is on the board first, so the ice block sits on it; then the seed.)
    .sort((a, b) => b.squares.length - a.squares.length || b.box - a.box || a.roll - b.roll || (a.sq < b.sq ? -1 : 1));
  const top = ranked[0];
  return top ? { target: top.sq, squares: top.squares } : null;
}

/**
 * The pieces a Super Freeze holds as the crowd's turn begins (`fen`: the crowd to move, after his move), from those iced as it came
 * (`squares`, round `target`): those still the crowd's and not the king (his move may have taken one), less those let go so the crowd
 * keeps a legal move with them held (and `also`: the freeze's piece, still held): the farthest from the middle first (a corner before
 * an edge), ties from the seed. In check only the moves that answer it are legal, so one of those is always left.
 */
export function superHeld(fen: string, crowd: Side, target: string, squares: readonly string[], seed: number, at: number, also: readonly string[] = []): string[] {
  const legal = legalMoves(fen);
  const dist = (sq: string) => (sq.charCodeAt(0) - target.charCodeAt(0)) ** 2 + (Number(sq[1]) - Number(target[1])) ** 2;
  // The order they're let go in: the farthest first.
  const order = squares
    .filter((sq) => freezable(fen, crowd, sq))
    .map((sq) => ({ sq, d: dist(sq), roll: powerRoll(seed, "superLetGo", at, sq) }))
    .sort((a, b) => b.d - a.d || a.roll - b.roll || (a.sq < b.sq ? -1 : 1))
    .map((o) => o.sq);
  while (order.length && !legal.some((m) => !heldIn(fen, m, [...order, ...also]))) order.shift();
  return order.sort();
}

/** How many crowd moves fill the Super Freeze's meter the `n`th time (0: the first): from the seed; the test switch, 1 then 2. */
export function superNeed(seed: number, n: number, test: string, s: SuperSettings = BOSS_POWERS): number {
  if (test === "superfreeze") return n === 0 ? 1 : 2;
  const [lo, hi] = s.superFreezeEvery;
  return lo + Math.floor(powerRoll(seed, "superNeed", n) * (hi - lo + 1));
}

/** The Super Freeze's state (made as his battle's first crowd turn begins). */
const superOf = (p: Pick<BossPowerState, "superFreeze"> | null | undefined): SuperFreezeState | null => p?.superFreeze ?? null;

/** The pieces the Super Freeze holds on crowd turn `turn` (none: empty). */
export function superHeldOn(p: Pick<BossPowerState, "superFreeze"> | null | undefined, turn: number): string[] {
  const hit = superOf(p)?.hit;
  return hit && hit.at + 1 === turn ? [...(hit.held ?? [])] : [];
}

/**
 * The Super Freeze's meter as crowd turn `turn` is picked (0-1): full on the turn it comes as that move lands; empty again from
 * then; empty for good once it has come superFreezeMax times. Null: none (not Ginger's state yet).
 */
export function superMeter(p: Pick<BossPowerState, "superFreeze"> | null | undefined, turn: number, s: SuperSettings = BOSS_POWERS): number | null {
  const sf = superOf(p);
  if (!sf) return null;
  if (sf.used >= s.superFreezeMax) return 0;
  return Math.max(0, Math.min(1, (turn - sf.since) / Math.max(1, sf.need)));
}

/**
 * The blizzard holds crowd turn `turn` or comes as it begins (warned, or the admins' trigger pulled): the Super Freeze waits (Eric's
 * rule via the brief: never the two on one turn).
 */
function blizzardOn(p: BossPowerState, turn: number, s: Pick<BossPowerSettings, "blizzardTurns">): boolean {
  if (p.ultNext) return true;
  if (p.ultAt === undefined) return p.warnAt !== undefined;
  return turn < p.ultAt + blizzardLength(s);
}

/** As a crowd turn begins: the Super Freeze's meter made (his battle's first), and the pieces it holds this turn settled. */
function superTurn(next: BossPowerState, t: TurnContext): void {
  const sf = next.superFreeze ?? { since: 0, need: superNeed(t.seed, 0, t.test, t.s), used: 0, hit: null };
  const hit = sf.hit;
  if (hit && hit.at + 1 === t.turn && !hit.held) {
    const also = next.frozen && next.frozen.until >= t.turn ? [next.frozen.square] : [];
    next.superFreeze = { ...sf, hit: { ...hit, held: superHeld(t.fen, t.crowd, hit.target, hit.squares, t.seed, hit.at, also) } };
  } else if (sf !== next.superFreeze) next.superFreeze = sf;
}

export const gingerBattle = {
  /**
   * After the crowd's move (the start of his turn): the Super Freeze comes when its meter is full (since + need crowd moves), fewer
   * than superFreezeMax have come, the battle goes on, and the blizzard isn't on the crowd's next turn (else it waits, full): its
   * moment (`superFreeze`, while he thinks), its target and pieces, the meter emptied and the next fill drawn.
   */
  afterCrowdMove(b: Battle, s: SuperSettings & Pick<BossPowerSettings, "blizzardTurns"> = BOSS_POWERS): void {
    const boss = b.state.boss;
    const p = boss?.powers;
    const sf = superOf(p);
    if (!boss || !p || !sf || boss.id !== "gingerbread") return;
    if (sf.used >= s.superFreezeMax || boss.crowdMoves - sf.since < sf.need) return;
    if (boss.result || !b.bossToMove() || boss.crowdMoves >= b.settings.bossMaxMoves || blizzardOn(p, boss.crowdMoves + 1, s)) return;
    const board = b.boards.get(b.state.boards[0]!)!;
    if (boardEnd(board) !== null) return;
    const pick = chooseSuperFreeze(board.fen, boss.crowdSide, p.seed, sf.used);
    if (!pick) return;
    const used = sf.used + 1;
    const next: SuperFreezeState = { since: boss.crowdMoves, need: superNeed(p.seed, used, b.settings.bossPowerTest ?? "", s), used, hit: { at: boss.crowdMoves, target: pick.target, squares: pick.squares } };
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, superFreeze: next, events: [...p.events, { kind: "superFreeze", turn: p.turn, square: pick.target, squares: pick.squares }] } } };
  },
};

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
    // (Never on a turn the Super Freeze holds: the admins' trigger becomes the warning, and the blizzard comes next turn. The meter
    // can't bring it on such a turn: the Super Freeze waits for a warned blizzard.)
    if (superOf(next)?.hit?.at === t.turn - 1) {
      if (t.ultNext && next.warnAt === undefined) {
        next.warnAt = t.turn;
        t.events.push({ kind: "warn", turn: t.turn });
      }
      // (A full meter is only warned this turn, as ever.)
      if (t.ultNext || next.warnAt !== undefined) return false;
    }
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
    // (The Super Freeze's meter and its pieces held this turn, first: the freeze leaves those be.)
    superTurn(next, t);
    // (Not while the blizzard lasts: the freeze waits until its ice is gone.)
    if (next.ultAt !== undefined && t.turn < next.ultAt + blizzardLength(t.s)) {
      if (t.turn >= next.nextPassive) next.nextPassive = t.turn + 1;
      return;
    }
    if (t.turn < next.nextPassive) return;
    const pick = chooseFreeze(t.fen, t.crowd, t.seed, t.turn, next.pies?.[0]?.square, superHeldOn(next, t.turn));
    if (pick) {
      next.frozen = { ...pick, until: t.turn + t.s.freezeTurns - 1 };
      t.events.push({ kind: "freeze", turn: t.turn, square: pick.square });
      const [lo, hi] = t.s.freezeEvery;
      next.nextPassive = t.turn + lo + Math.floor(powerRoll(t.seed, "every", t.turn) * (hi - lo + 1));
    } else next.nextPassive = t.turn + 1;
  },
  // Frozen pieces can't move, nor castle with a frozen rook (the held pieces' one rule: heldIn); in the blizzard only its
  // free pieces move (none can: everything, as the dispatcher lifts it).
  held(boss, fen) {
    const ice = blizzardIce(boss, turnOf(boss), fen);
    if (ice) return [...ice];
    const frozen = boss.powers!.frozen;
    // (The Super Freeze's pieces on its turn, with the freeze's piece.)
    return [...(frozen ? [frozen.square] : []), ...superHeldOn(boss.powers, turnOf(boss))];
  },
  powerTurn: (boss) => !!boss.powers!.frozen || blizzardNow(boss) || superHeldOn(boss.powers, turnOf(boss)).length > 0,
  afterCrowdMove(b) {
    gingerBattle.afterCrowdMove(b);
  },
  // The frozen piece; in the blizzard the pieces its ice holds, through the boss's turn after it too (none once its
  // free pieces have no move: the dispatcher lifts it).
  iced(boss, fen) {
    const p = boss.powers!;
    const ice = blizzardIce(boss, p.turn, fen);
    if (ice) {
      if (sideToMove(fen) === boss.crowdSide) {
        const legal = legalMoves(fen);
        if (legal.length && legal.every((m) => heldIn(fen, m, ice))) return [];
      }
      return [...ice].filter((sq) => pieceAt(fen, sq)?.color === boss.crowdSide).sort();
    }
    // The Super Freeze's ice: from the start of his turn (its moment) through his move, then on the crowd's pieces it holds through
    // the crowd's turn; it thaws as his next turn starts (Eric: "it's just frozen on your turn, and then they unfreeze for his turn").
    const hit = superOf(p)?.hit;
    const sup = !hit ? [] : p.turn === hit.at ? hit.squares.filter((sq) => freezable(fen, boss.crowdSide, sq)) : p.turn === hit.at + 1 && sideToMove(fen) === boss.crowdSide ? (hit.held ?? []) : [];
    return [...new Set([...(p.frozen ? [p.frozen.square] : []), ...sup])].sort();
  },
  // The pieces whose ice thaws as the next crowd turn begins (cracked and dripping on screen); the Super Freeze's meter (0-1, empty
  // for good once spent), how many have come, and the pieces it holds this turn.
  view: (p) => ({
    thaw: [...(p.blizzard?.next ?? [])],
    ...(p.superFreeze ? { superFreeze: { meter: superMeter(p, p.turn) ?? 0, used: p.superFreeze.used, max: BOSS_POWERS.superFreezeMax, held: superHeldOn(p, p.turn), target: p.superFreeze.hit?.target ?? null, at: p.superFreeze.hit?.at ?? null } } : {}),
  }),
};
