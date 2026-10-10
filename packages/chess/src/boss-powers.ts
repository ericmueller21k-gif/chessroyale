/**
 * Boss powers: the rules each power answers, from the boss template (core's BOSS_ROSTER). Pure functions of the
 * battle's state and the position, so the server, the solo game and every screen work out the same thing: which
 * moves the crowd (and the boss) may play this turn, what happens as a turn begins, what each player sees, and
 * whether a turn counts for fair play. The ground rules:
 *
 * - The server decides every power, from the battle's seed (drawn once, as it starts) and the position.
 * - A power never leaves anyone without a legal move and never breaks check: if a restriction would leave no legal
 *   move (or no escape from check), it lifts for that turn. The king is never frozen.
 * - The judge plays by the same rules: the best move is the best of the allowed ones (judge.ts, runner.ts).
 * - A turn the boss plays for the crowd (the funhouse) isn't scored; any turn a power touches doesn't count for
 *   fair play.
 *
 * Turns are the crowd's: turn N is the crowd's Nth move of the battle (crowdMoves + 1 while it's being picked).
 */
import {
  BOSS_POWERS,
  mulberry32,
  type BossPowerSettings,
  type BossPowerState,
  type BossState,
  type BounceResult,
  type PowerEvent,
} from "@chessroyale/core";
import { legalMoves, pieceAt } from "./rules.ts";
import type { EngineLike } from "./runner.ts";
import type { MoveScore } from "./uci.ts";
import {
  bossPowers,
  moveLoss,
  type Battle,
  type BossLastMove,
  crowdHalf,
  logit,
  materialOf,
  meterFull,
  moveSquares,
  other,
  powerRoll,
  ragePoints,
  rageTick,
  testSwitch,
  to,
  turnOf,
  type BossRules,
  type JudgedEvaluation,
  type RageRates,
  type Side,
  type TurnContext,
} from "./bosses/base.ts";

import { GINGER } from "./bosses/ginger.ts";
import { BOINGO } from "./bosses/boingo.ts";
import { GREX } from "./bosses/grex.ts";
import { HOLLOW } from "./bosses/hollow.ts";

export { bossPowers, materialOf, moveLoss, moveSquares, powerRoll, ragePoints, rageTick, type Battle, type BossLastMove, type BossRules, type RageRates, type TurnContext };
export * from "./bosses/ginger.ts";
export * from "./bosses/boingo.ts";
export * from "./bosses/grex.ts";
export * from "./bosses/hollow.ts";

/** A battle's powers as it starts (nothing has happened yet; the first turn is set up by prepareTurn). */
export function initPowers(seed: number, fen: string, crowdSide: Side): BossPowerState {
  return { seed: seed >>> 0, turn: 0, material: materialOf(fen, other(crowdSide)), lost: 0, nextPassive: BOSS_POWERS.firstPassive, events: [] };
}

/**
 * As a crowd turn begins (after the boss's move, or as the battle starts): the rage meter, the ultimate's warning
 * and the ultimate, and the passive. `fen` is the position with the crowd to move. Once per turn: calling it again
 * for the same turn (the re-pick after the God King's Last Stand) changes nothing. `test`: an ultimate (the test switch)
 * warned as the second turn begins and unleashed on the third (the passive comes on the second turn anyway).
 * The test trigger (an admin's, `ultNext`) brings the ultimate as this turn begins, without the warning. `lastMove`: the
 * boss's move just played (Hollow covers its piece's square after his first).
 *
 * The meter is the same for every boss; the rest is the boss's own rules (BossRules), in this order: what wore off,
 * the ultimate's step, anything every turn, then the passive (not on the turn the ultimate came, if it was due then:
 * it waits a turn).
 */
export function prepareTurn(boss: BossState, fen: string, test = "", s: BossPowerSettings = BOSS_POWERS, lastMove: string | null = null): BossState {
  const powers = bossPowers(boss);
  const p = boss.powers;
  const rules = bossRules(boss);
  if (!powers || !p || !rules) return boss;
  const turn = turnOf(boss);
  if (p.turn === turn) return boss;
  const crowd = boss.crowdSide;
  const events: PowerEvent[] = [];
  const lost = Math.max(p.lost, p.material - materialOf(fen, other(crowd)));
  // The meter over time: each crowd move since the last turn began, faster while the crowd is ahead on the judged eval.
  const moved = p.turn > 0 ? Math.max(0, turn - p.turn) : 0;
  const charge = (p.charge ?? 0) + moved * rageTick(p.judged, s);
  // (An ultimate at the start of the boss's turn keeps the test trigger until then.)
  const { ultNext, ...rest } = p;
  const next: BossPowerState = { ...rest, turn, lost, charge, events, ...(ultNext && rules.ultimateOnHisTurn ? { ultNext } : {}) };
  const t: TurnContext = { turn, fen, crowd, seed: p.seed, passive: powers.passive, ultimate: powers.ultimate, test, ultNext: !!ultNext, lastMove, s, events };
  rules.wearOff?.(next, t);
  const ultNow = next.ultAt === undefined ? rules.ultimate(next, t) : false;
  rules.everyTurn?.(next, t);
  if (ultNow && turn >= next.nextPassive) next.nextPassive = turn + 1;
  else rules.passive(next, t);
  return { ...boss, powers: next };
}

// ---------------- Big Boy: the snack, toy blocks, the Big Bounce ----------------

/** Big Boy opens with his snack: the battle starts from the starting position less one of the crowd's centre pawns. */
export const startsWithSnack = (def: { powers: { passive: string } | null } | null | undefined): boolean => def?.powers?.passive === "blocks";

/** The crowd's pawn Big Boy eats before move 1: its d- or e-pawn (from the seed), on its starting square. */
export function snackSquare(seed: number, crowd: Side): string {
  return `${powerRoll(seed, "snack") < 0.5 ? "d" : "e"}${crowd === "w" ? 2 : 7}`;
}

/**
 * A toy block stops a move: it lands on the block, or slides over it (a rank, file or diagonal, a pawn's double step, a
 * castling king's way to his rook's corner). A knight jumps it. It never stops an attack: a piece behind it still gives
 * check and pins as in ordinary chess (the block only takes moves away, like the pie).
 */
export const blockedBy = (move: string, block: string | null | undefined, fen?: string): boolean => !!block && moveSquares(move, fen).slice(1).includes(block);

/**
 * Where Big Boy tosses his toy block: an empty square on the crowd's half that one of its pieces could move to now
 * (so it matters a little), a seeded pick. Null when there's none.
 */
export function chooseBlock(fen: string, crowd: Side, seed: number, turn: number): string | null {
  const half = new Set(crowdHalf(crowd));
  let legal: string[];
  try {
    legal = legalMoves(fen);
  } catch {
    return null;
  }
  const options = [...new Set(legal.map(to))].filter((sq) => half.has(sq) && !pieceAt(fen, sq)).sort();
  return options.length ? options[Math.floor(powerRoll(seed, "block", turn) * options.length)]! : null;
}

/** The toy block on the board now, if any. */
export const blockSquare = (boss: Pick<BossState, "powers"> | null | undefined): string | null => boss?.powers?.block?.square ?? null;

/**
 * The Big Bounce is due: the start of his turn (the crowd has just moved) on the turn the rage meter warned, or after
 * the test trigger. Once a match.
 */
export const bounceDue = (boss: BossState | null | undefined): boolean => {
  const p = boss?.powers;
  return !!p && !boss!.result && bossPowers(boss)?.ultimate === "bounce" && !p.bounce && p.ultAt === undefined && (!!p.ultNext || (p.warnAt !== undefined && p.warnAt === boss!.crowdMoves));
};

/** One of the Big Bounce's candidate positions (him to move) and the crowd's pieces it moved, each from and to. */
export interface BounceCandidate {
  fen: string;
  moves: { from: string; to: string; piece: string }[];
}

type Grid = Map<string, string>;
const gridOf = (fen: string): Grid => {
  const g: Grid = new Map();
  fen
    .split(" ")[0]!
    .split("/")
    .forEach((row, r) => {
      let f = 0;
      for (const c of row) {
        if (c >= "1" && c <= "8") f += Number(c);
        else g.set(`${"abcdefgh"[f++]}${8 - r}`, c);
      }
    });
  return g;
};
const placementOf = (g: Grid): string =>
  [8, 7, 6, 5, 4, 3, 2, 1]
    .map((r) => [..."abcdefgh"].map((f) => g.get(`${f}${r}`) ?? ".").join("").replace(/\.+/g, (d) => String(d.length)))
    .join("/");
const isLight = (sq: string) => (sq.charCodeAt(0) - 97 + Number(sq[1])) % 2 === 0;

const FILES = "abcdefgh";
const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]] as const;
const AROUND = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;
/**
 * The squares of `by`'s pieces attacking `sq` on a grid (as chess.js's `attackers`: pawns diagonally, knights, the king,
 * sliders up to the first piece in the way), worked out on the grid itself: the bounce tries many positions, and making
 * a chess.js board for each was most of its time.
 */
function gridAttackers(g: Grid, sq: string, by: Side): string[] {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]);
  const mine = (c: string) => (c === c.toUpperCase()) === (by === "w");
  const at = (ff: number, rr: number) => (ff >= 0 && ff < 8 && rr >= 1 && rr <= 8 ? `${FILES[ff]}${rr}` : null);
  const out: string[] = [];
  const is = (s2: string | null, types: string) => {
    const c = s2 ? g.get(s2) : undefined;
    return !!c && mine(c) && types.includes(c.toLowerCase());
  };
  for (const df of [-1, 1]) {
    const s2 = at(f + df, by === "w" ? r - 1 : r + 1);
    if (is(s2, "p")) out.push(s2!);
  }
  for (const [df, dr] of KNIGHT) if (is(at(f + df, r + dr), "n")) out.push(at(f + df, r + dr)!);
  for (const [df, dr] of AROUND) {
    if (is(at(f + df, r + dr), "k")) out.push(at(f + df, r + dr)!);
    const slider = df && dr ? "bq" : "rq";
    for (let k = 1; k < 8; k++) {
      const s2 = at(f + df * k, r + dr * k);
      if (!s2) break;
      const c = g.get(s2);
      if (!c) continue;
      if (mine(c) && slider.includes(c.toLowerCase())) out.push(s2);
      break;
    }
  }
  return out;
}
const gridKing = (g: Grid, side: Side): string | null => [...g].find(([, c]) => c === (side === "w" ? "K" : "k"))?.[0] ?? null;
const gridKingAttacked = (g: Grid, side: Side): boolean => {
  const k = gridKing(g, side);
  return !k || gridAttackers(g, k, other(side)).length > 0;
};
/** The material `side` has hanging on a grid (as rules.ts hangingValue: attacked by a cheaper piece, or attacked and undefended). */
function gridHanging(g: Grid, side: Side): number {
  let total = 0;
  for (const [sq, c] of g) {
    if ((c === c.toUpperCase()) !== (side === "w") || c.toLowerCase() === "k") continue;
    const att = gridAttackers(g, sq, other(side));
    if (!att.length) continue;
    const v = PIECE_VALUE[c.toLowerCase()]!;
    const cheaper = att.some((a) => PIECE_VALUE[g.get(a)!.toLowerCase()]! < v);
    if (cheaper || !gridAttackers(g, sq, side).length) total += v;
  }
  return total;
}

/**
 * Where a crowd piece may land in the Big Bounce: an empty square within `reach` (in both directions) of where it
 * stood, never the toy block; a pawn only sideways along its rank (so it never reaches the first or last rank, and
 * the pawns stay plausible); a bishop on its own colour (my call: a position that could come up in a game).
 */
function landings(sq: string, type: string, g: Grid, block: string | null, reach: number): string[] {
  const f0 = sq.charCodeAt(0) - 97;
  const r0 = Number(sq[1]);
  const out: string[] = [];
  for (let df = -reach; df <= reach; df++)
    for (let dr = -reach; dr <= reach; dr++) {
      const f = f0 + df;
      const r = r0 + dr;
      if ((!df && !dr) || f < 0 || f > 7 || r < 1 || r > 8) continue;
      if (type === "p" && dr !== 0) continue;
      const t = `${"abcdefgh"[f]}${r}`;
      if (g.has(t) || t === block) continue;
      if (type === "b" && isLight(t) !== isLight(sq)) continue;
      out.push(t);
    }
  return out;
}

/** One random try at a bounced position (a seeded random source), or null when it doesn't hold together. */
function bounceTry(fen: string, crowd: Side, rnd: () => number, block: string | null, s: Pick<BossPowerSettings, "bouncePieces" | "bounceReach">): (BounceCandidate & { grid: Grid }) | null {
  const [lo, hi] = s.bouncePieces;
  const want = lo + Math.floor(rnd() * (hi - lo + 1));
  const g = gridOf(fen);
  const mine = (c: string) => (c === c.toUpperCase()) === (crowd === "w");
  const pieces = [...g].filter(([, c]) => mine(c) && c.toLowerCase() !== "k").map(([sq]) => sq).sort();
  // A seeded shuffle.
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j]!, pieces[i]!];
  }
  const moves: BounceCandidate["moves"] = [];
  const landed = new Set<string>();
  for (const sq of pieces) {
    if (moves.length >= want) break;
    const c = g.get(sq);
    if (!c || landed.has(sq)) continue;
    const options = landings(sq, c.toLowerCase(), g, block, s.bounceReach);
    if (!options.length) continue;
    const t = options[Math.floor(rnd() * options.length)]!;
    g.delete(sq);
    g.set(t, c);
    landed.add(t);
    moves.push({ from: sq, to: t, piece: c.toLowerCase() });
  }
  if (moves.length < lo) return null;
  const parts = fen.split(" ");
  parts[0] = placementOf(g);
  // Castling rights go with a rook moved off its corner (the king never moves); en passant is cleared.
  const corners: Record<string, string> = crowd === "w" ? { a1: "Q", h1: "K" } : { a8: "q", h8: "k" };
  let castling = parts[2] ?? "-";
  for (const m of moves) if (m.piece === "r" && corners[m.from]) castling = castling.replace(corners[m.from]!, "");
  parts[2] = castling.replace(/-/g, "") || "-";
  parts[3] = "-";
  // It's his move next: the crowd's king can't be in check; and (my call) the bounce never gives him check.
  if (gridKingAttacked(g, crowd) || gridKingAttacked(g, other(crowd))) return null;
  return { fen: parts.join(" "), moves, grid: g };
}

/**
 * The Big Bounce's candidates, from the seed: up to bounceCandidates positions with him to move, each moving
 * bouncePieces of the crowd's pieces (never the king, no captures: each to an empty square within bounceReach, a pawn
 * only sideways, never onto the toy block), the crowd's king not in check, his neither, castling rights gone with a
 * moved rook, en passant cleared. A try that leaves more of the crowd's material hanging than before is dropped (he'd
 * simply take it: far past a pawn and a half). Pure: the server, the host and solo work out the same list.
 */
export function bounceCandidates(
  fen: string,
  crowd: Side,
  seed: number,
  at: number,
  block: string | null = null,
  s: Pick<BossPowerSettings, "bouncePieces" | "bounceReach" | "bounceCandidates"> = BOSS_POWERS,
): BounceCandidate[] {
  const out: BounceCandidate[] = [];
  const seen = new Set<string>();
  const hanging = gridHanging(gridOf(fen), crowd);
  for (let a = 0; out.length < s.bounceCandidates && a < s.bounceCandidates * 30; a++) {
    const c = bounceTry(fen, crowd, mulberry32(Math.floor(powerRoll(seed, "bounce", at, a) * 2 ** 32)), block, s);
    if (!c) continue;
    const key = c.fen.split(" ")[0]!;
    if (seen.has(key) || gridHanging(c.grid, crowd) > hanging) continue;
    seen.add(key);
    // (And he has a move: never a stalemate.)
    try {
      if (!legalMoves(c.fen).length) continue;
    } catch {
      continue;
    }
    out.push({ fen: c.fen, moves: c.moves });
  }
  return out;
}

/** A candidate as the engine scored it: the crowd's expected score in it (him to move), and whether its line has a forced mate. */
export interface BounceScore {
  fen: string;
  crowd: number;
  mate?: boolean;
}

/** How many pawns worse a position is for the crowd (its expected score `before`, then `after`), by bouncePawnLogit. */
export const pawnsLost = (before: number, after: number, s: Pick<BossPowerSettings, "bouncePawnLogit"> = BOSS_POWERS): number => (logit(before) - logit(after)) / s.bouncePawnLogit;

/**
 * The Big Bounce's pick (Eric: a position a little worse for the crowd, a pawn and a half at most), from the crowd's
 * expected score before it (`before`, him to move) and each candidate's: the loss in pawns (pawnsLost) nearest
 * bounceTarget inside bounceLoss; none inside, the one nearest it below (the smallest step short of the band; never a
 * position better for the crowd); never past the cap (the band's top), never a line with a forced mate either way.
 * Null: nothing moves.
 */
export function pickBounce(
  before: number,
  scored: readonly BounceScore[],
  s: Pick<BossPowerSettings, "bounceLoss" | "bounceTarget" | "bouncePawnLogit"> = BOSS_POWERS,
): { fen: string; loss: number } | null {
  const [lo, hi] = s.bounceLoss;
  const ok = scored
    .filter((c) => !c.mate)
    .map((c) => ({ fen: c.fen, loss: pawnsLost(before, c.crowd, s) }))
    .filter((c) => c.loss >= 0 && c.loss <= hi + 1e-9);
  const inBand = ok.filter((c) => c.loss >= lo - 1e-9);
  const pool = inBand.length ? inBand : ok;
  const pick = [...pool].sort((a, b) => Math.abs(a.loss - s.bounceTarget) - Math.abs(b.loss - s.bounceTarget) || (a.fen < b.fen ? -1 : 1))[0];
  return pick ? { fen: pick.fen, loss: Math.round(pick.loss * 100) / 100 } : null;
}

/**
 * Where his three bounces land before the crash (each a 2x2 block of squares, by its lower-left square from White's
 * side): over the pieces the bounce moves, in order, so they're the ones knocked up; then (fewer than three needed) on
 * the crowd's half, from the seed. Never the centre block (d4-e5): that's the crash's.
 */
export function bounceSpots(moves: readonly { from: string }[], crowd: Side, seed: number, at: number): string[] {
  const out: string[] = [];
  const covers = (spot: string, sq: string) => {
    const df = sq.charCodeAt(0) - spot.charCodeAt(0);
    const dr = Number(sq[1]) - Number(spot[1]);
    return df >= 0 && df <= 1 && dr >= 0 && dr <= 1;
  };
  const centre = (spot: string) => spot === "d4";
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  for (const m of moves) {
    if (out.length >= 3) break;
    if (out.some((sp) => covers(sp, m.from))) continue;
    const f = m.from.charCodeAt(0) - 97;
    const r = Number(m.from[1]);
    // (The four blocks holding the square, in a seeded order: the first on the board that isn't the centre's.)
    const options = [0, 1, 2, 3]
      .map((k) => ({ k, roll: powerRoll(seed, "spot", at, m.from, k) }))
      .sort((a, b) => a.roll - b.roll)
      .map(({ k }) => `${"abcdefgh"[clamp(f - (k & 1), 0, 6)]}${clamp(r - (k >> 1), 1, 7)}`)
      .filter((sp) => covers(sp, m.from) && !centre(sp));
    if (options[0]) out.push(options[0]);
  }
  const ranks = crowd === "w" ? [1, 2, 3] : [6, 7];
  for (let i = 0; out.length < 3 && i < 40; i++) {
    const f = Math.floor(powerRoll(seed, "spot-free", at, i) * 7);
    const r = ranks[Math.floor(powerRoll(seed, "spot-rank", at, i) * ranks.length)]!;
    const spot = `${"abcdefgh"[f]}${r}`;
    if (centre(spot) || out.includes(spot)) continue;
    // (Apart from the others, so the three read as three.)
    if (out.some((sp) => Math.abs(sp.charCodeAt(0) - spot.charCodeAt(0)) < 2 && Math.abs(Number(sp[1]) - Number(spot[1])) < 2)) continue;
    out.push(spot);
  }
  return out;
}

/** The record of a bounce: what moved (none: nothing did), the position before it, and where he bounced. */
export function bounceResult(before: string, crowd: Side, seed: number, at: number, picked: BounceCandidate | null, loss: number | null = null): BounceResult {
  const moves = picked?.moves ?? [];
  return { at, before, moves, spots: bounceSpots(moves, crowd, seed, at), loss: picked ? loss : null };
}

/** Big Boy: a toy block nobody can move onto or through, and the Big Bounce at the start of his turn. */
export const BIGBOY: BossRules = {
  id: "bigboy",
  ultimateOnHisTurn: true,
  wearOff(next, t) {
    if (next.block && next.block.until < t.turn) next.block = null;
  },
  // The Big Bounce: the meter full as a turn begins, its warning ("RAGE!") that turn; it comes at the start of his turn,
  // after the crowd's move (bounceDue). The test switch: warned as the second turn begins. The trigger (`ultNext`, kept):
  // at the start of his next turn, without the warning.
  ultimate(next, t) {
    if (next.warnAt === undefined && !t.ultNext && (meterFull(next, t) || testSwitch(t))) {
      next.warnAt = t.turn;
      t.events.push({ kind: "warn", turn: t.turn });
    }
    return false;
  },
  // A toy block every blockEvery turns, blockTurns turns on the board.
  passive(next, t) {
    if (t.turn < next.nextPassive || next.block) return;
    const square = chooseBlock(t.fen, t.crowd, t.seed, t.turn);
    if (square) {
      next.block = { square, at: t.turn, until: t.turn + t.s.blockTurns - 1 };
      t.events.push({ kind: "block", turn: t.turn, square });
      next.nextPassive = t.turn + t.s.blockEvery;
    } else next.nextPassive = t.turn + 1;
  },
  // Nothing moves onto the block or through it, the boss included.
  crowdFilter(allowed, boss, fen) {
    const block = boss.powers!.block;
    return block ? allowed.filter((m) => !blockedBy(m, block.square, fen)) : allowed;
  },
  bossStops(boss) {
    const block = boss.powers?.block?.square;
    return block ? (m, fen) => blockedBy(m, block, fen) : null;
  },
  powerTurn: (boss) => !!boss.powers!.block,
};

// ---------------- The registry ----------------

/** Every boss with powers, by its BOSS_ROSTER id. */
const BOSS_RULES: ReadonlyMap<string, BossRules> = new Map([GINGER, BOINGO, GREX, HOLLOW, BIGBOY].map((r) => [r.id, r]));

/** A boss's rules (null: a boss without powers). */
export const bossRules = (boss: Pick<BossState, "id"> | null | undefined): BossRules | null => (boss?.id ? (BOSS_RULES.get(boss.id) ?? null) : null);

// ---------------- The test trigger ----------------

/**
 * An admin's test trigger: the boss's ultimate comes as the next crowd turn begins, without the warning. Safe at any
 * moment: nothing happens if the boss has no ultimate, it's spent or already on its way, or the battle is over; it
 * only takes effect as a turn begins (prepareTurn), never in the middle of one or of a moment.
 */
export function triggerUltimate(boss: BossState | null | undefined): { boss: BossState | null | undefined; ok: boolean } {
  const p = boss?.powers;
  if (!boss || !p || !bossPowers(boss) || boss.result || p.ultAt !== undefined) return { boss, ok: false };
  if (p.ultNext) return { boss, ok: true };
  return { boss: { ...boss, powers: { ...p, ultNext: true } }, ok: true };
}

/**
 * The moves the crowd may play this turn, or null when every legal move is allowed. Frozen pieces can't move and
 * nobody can move onto the pie; in the blizzard only the queen moves (no queen, or she can't: the king). The God
 * King's Last Stand bars the move he took back on top. Never empty: a restriction that would leave no legal move
 * lifts for the turn (and since only legal moves are counted, check is always answered).
 */
export function crowdAllowed(boss: BossState | null | undefined, fen: string): string[] | null {
  const p = boss?.powers;
  const barred = boss?.barred;
  if (!p && !barred) return null;
  const legal = legalMoves(fen);
  let allowed = legal;
  if (p) {
    const filter = bossRules(boss)?.crowdFilter;
    if (filter) allowed = filter(allowed, boss!, fen);
    if (!allowed.length) allowed = legal;
  }
  if (barred) {
    const open = allowed.filter((m) => m !== barred);
    allowed = open.length ? open : legal.filter((m) => m !== barred);
    if (!allowed.length) allowed = legal;
  }
  return allowed.length === legal.length ? null : allowed;
}

/**
 * The moves the boss may play (a pie stops it: nothing onto it; a toy block: nothing onto it or through it), or null
 * when every legal move is allowed. Never none: a restriction that would leave no move lifts.
 */
export function bossAllowed(boss: BossState | null | undefined, fen: string): string[] | null {
  const stops = boss ? (bossRules(boss)?.bossStops?.(boss) ?? null) : null;
  if (!stops) return null;
  const legal = legalMoves(fen);
  const allowed = legal.filter((m) => !stops(m, fen));
  return allowed.length && allowed.length < legal.length ? allowed : null;
}

/** A crowd move is allowed this turn. */
export const crowdMayPlay = (boss: BossState | null | undefined, fen: string, move: string): boolean => {
  const allowed = crowdAllowed(boss, fen);
  return allowed ? allowed.includes(move) : legalMoves(fen).includes(move);
};

/**
 * A power touches this crowd turn (a frozen piece, a pie, a toy block, the blizzard, a flipped board, fire): its picks
 * don't count as fair-play signals.
 */
export function powerTurn(boss: BossState | null | undefined): boolean {
  const p = boss?.powers;
  return !!p && !!bossRules(boss)?.powerTurn?.(boss!);
}

/** The squares that show ice: the frozen piece; in the blizzard every crowd piece but the one(s) still free to move. */
export function icedSquares(boss: BossState | null | undefined, fen: string): string[] {
  const p = boss?.powers;
  if (!p || !boss) return [];
  return bossRules(boss)?.iced?.(boss, fen, crowdAllowed) ?? [];
}

/** The rage meter, 0 to 1 (full: the warning, then the ultimate); null once the ultimate is spent. */
export function rageOf(boss: BossState | null | undefined, s: RageRates = BOSS_POWERS): number | null {
  const p = boss?.powers;
  if (!p || !bossPowers(boss)) return null;
  if (p.ultAt !== undefined && turnOf(boss!) > p.ultAt) return null;
  return Math.max(0, Math.min(1, ragePoints(p, s) / s.rageFull));
}

// ---------------- The judge plays by the same rules ----------------

/** What limits the crowd's moves in a judging job: the move the God King took back, and a power's allowed moves. */
export interface MoveLimits {
  barred?: string;
  allowed?: string[];
}

/** Whether the job lets the crowd play `move` (not the barred move; one of the allowed, when a power limits them). */
export function jobAllows(job: MoveLimits, move: string): boolean {
  return move !== job.barred && (!job.allowed || job.allowed.includes(move));
}

/**
 * The top moves the job may use: never the barred move, unless it's the only one; only allowed moves when a power
 * limits them (none of them in the top moves: empty, and the second search covers them all).
 */
export function judgeTop(job: MoveLimits, top: readonly MoveScore[]): MoveScore[] {
  const open = top.filter((m) => jobAllows(job, m.move));
  if (open.length || job.allowed) return open;
  return [...top];
}

/**
 * The scores the job's best move and bots' picks come from: the top moves it allows, or (a power left none of the
 * top moves) the second search over every allowed move, best first.
 */
export function judgeCandidates(job: MoveLimits, top: readonly MoveScore[], extra: readonly MoveScore[] = []): MoveScore[] {
  const t = judgeTop(job, top);
  if (t.length || !job.allowed) return t;
  // (Best first, ties by move: the same order whatever order the engine listed them in.)
  return extra.filter((m) => jobAllows(job, m.move)).sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));
}

/**
 * The moves the judge must score too this crowd turn, whatever the engine's top moves are (G-REX's fire: the ones that
 * save a piece from a tile ablaze). None without a boss, or for a boss whose rules don't ask.
 */
export function judgeMustScore(boss: BossState | null | undefined, fen: string): string[] {
  const j = boss ? bossRules(boss)?.judge : undefined;
  return j ? j.mustScore(boss!, fen) : [];
}

/** Top moves as the judge ranks them this crowd turn under the boss's rules (for bots and hints), best first. */
export function judgeRanked(boss: BossState | null | undefined, top: readonly MoveScore[], fen: string): MoveScore[] {
  const j = boss ? bossRules(boss)?.judge : undefined;
  return j ? j.rank(boss!, top, fen) : [...top];
}

/** A board's evaluation as the judge sees it under the boss's rules (G-REX's fire: a piece left to burn counts as gone). */
export function judgeEvaluation<E extends JudgedEvaluation>(boss: BossState | null | undefined, evaluation: E, fen: string): E {
  const j = boss ? bossRules(boss)?.judge : undefined;
  return j ? j.evaluation(boss!, evaluation, fen) : evaluation;
}

/**
 * A power left none of the top moves open: one search over every allowed move (and any pick), whose best is the
 * best allowed move. Null when the top moves already hold an allowed one (or nothing limits the moves).
 */
export async function allowedSearch(engine: Pick<EngineLike, "scoreMoves">, job: MoveLimits & { fen: string; picks?: readonly string[] }, top: readonly MoveScore[]): Promise<MoveScore[] | null> {
  if (!job.allowed || judgeTop(job, top).length) return null;
  const have = new Set(top.map((m) => m.move));
  const moves = [...new Set([...job.allowed, ...(job.picks ?? [])].filter((m) => !have.has(m)))].sort();
  return engine.scoreMoves(job.fen, moves);
}
