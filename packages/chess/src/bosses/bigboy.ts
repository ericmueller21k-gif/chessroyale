/**
 * Big Boy, the baby boss (BOSS_ROSTER "bigboy"): his rules. He opens with his snack: the battle starts from the starting
 * position less one of the crowd's centre pawns, which he eats before move 1. His passive, toy blocks: every few turns
 * a block lands on an empty square in the crowd's half, and nothing (either side) may move onto it or slide through it
 * while it's there (a knight jumps it; it never stops an attack). His ultimate, the Big Bounce, comes at the start of his
 * turn after its warning: a few of the crowd's pieces are thrown to new squares nearby, into a position a little worse
 * for the crowd. Numbers: BOSS_POWERS.block*, bounce*. His art and moments are the app's (characters/bigboy.ts,
 * components/BigBoy.tsx, the toys in characters/effects/).
 */
import { BOSS_POWERS, mulberry32, type BossPowerSettings, type BossState, type BounceResult } from "@chessroyale/core";
import { BOSS_OPENING, newBoard } from "../boards.ts";
import { legalMoves, pieceAt, withoutPiece } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import type { MoveScore } from "../uci.ts";
import { bossPowers, crowdHalf, logit, meterFull, moveSquares, other, powerRoll, testSwitch, to, type Battle, type BossRules, type Side } from "./base.ts";

/**
 * Big Boy's snack in the intro (before move 1): he waddles over to the crowd's centre pawn, grabs it and eats it
 * ("Nom nom."), beat by beat in ms from its start (the app's SnackTime): he's at the pawn at `grabAt` (it leaves the
 * board), eats it at `nomAt`, and is back in his corner by the end.
 */
export const SNACK = { walkMs: 1100, grabAt: 1100, nomAt: 1500, ms: 3000 } as const;
export const SNACK_MS = SNACK.ms;

/**
 * Big Boy's Big Bounce, beat by beat (ms into its moment, at the start of his turn; nobody's clock runs):
 *   0         "BIG BOUNCE!" (his banner).
 *   leapAt    he leaps from his corner; a shadow grows on the first of his three spots (each a 2x2 block of squares).
 *   lands     he lands on each spot in turn, squashing, then stretches up again: the pieces there are knocked up and
 *             tumble in the air.
 *   jumpAt    the last spring, high up and out of sight, his shadow growing over the four centre squares.
 *   crashAt   the giant fall on the centre: a crash, a shockwave across the board, dust, the board jolts (`jolt` ms).
 *   settleAt  every piece comes down into the new position, settled by `settledAt`.
 *   backAt    he bounces back to his corner (gone from the board by `total`); then he plays his move.
 */
export const BOUNCE = {
  leapAt: 1300,
  lands: [1850, 2450, 3050] as readonly number[],
  jumpAt: 3050,
  crashAt: 4100,
  jolt: 320,
  settleAt: 4500,
  settledAt: 5200,
  backAt: 5350,
  total: 6200,
} as const;

/** Big Boy's toy block: the banner, then his toss from the board's corner, the block's flight, and it lands. */
export const BLOCK = { flyAt: 1450, landAt: 1850 } as const;

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const BIGBOY_FX = { block: 2300, bounce: BOUNCE.total } as const;

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
  // From the starting position (sides as usual), less the crowd's centre pawn he eats before move 1: a base at ply 0
  // (the position changed outside a move: every replay plays from it).
  opening: {
    fromStart: true,
    setUp(b, at) {
      const square = snackSquare(at.seed, at.crowdSide);
      const board = newBoard(at.boardId, BOSS_OPENING, 0, at.generation);
      const fen = withoutPiece(board.fen, square);
      b.boards.set(at.boardId, { ...board, fen, bases: [{ ply: 0, fen }] });
      return { snack: { square } };
    },
  },
  view: (p) => ({ block: p.block ? { square: p.block.square, at: p.block.at, until: p.block.until } : null, snack: p.snack?.square ?? null, bounce: p.bounce ?? null }),
};

// ---------------- The Big Bounce in a match ----------------

/** Each position's top move at `nodes`, shared out over the engines (each takes the next position as it's free). */
async function topEach(engines: readonly EngineLike[], fens: readonly string[], nodes: number): Promise<(MoveScore | undefined)[]> {
  const best: (MoveScore | undefined)[] = new Array(fens.length);
  let next = 0;
  await Promise.all(
    engines.map(async (e) => {
      while (next < fens.length) {
        const i = next++;
        best[i] = (await (e.topMovesAt ? e.topMovesAt(fens[i]!, 1, nodes) : e.topMoves(fens[i]!, 1)))[0];
      }
    }),
  );
  return best;
}

/**
 * Big Boy's Big Bounce: the candidates (positions with him to move) scored by the engine path his moves use (each
 * position's top move; the crowd's expected score is one less his), shared out over this device's engines. A glance at
 * every candidate (bounceScreenNodes), then a proper look (bounceNodes) at the position before and the bounceConfirm
 * nearest the target; then pickBounce on those: the loss nearest the target in the band, else the nearest below it;
 * null (nothing moves) when none is under the cap, or there's no engine. About one of his moves' worth of searching.
 */
export async function bounceFrom(
  engines: readonly EngineLike[],
  fen: string,
  candidates: readonly string[],
  s: Parameters<typeof pickBounce>[2] & Pick<typeof BOSS_POWERS, "bounceNodes" | "bounceScreenNodes" | "bounceConfirm"> = BOSS_POWERS,
): Promise<{ fen: string; loss: number } | null> {
  if (!candidates.length || !engines.length) return null;
  const crowdOf = (m: MoveScore | undefined) => (m ? 1 - m.expected : null);
  // The glance: which few are worth a proper look (nearest the target, no forced mates).
  const glance = await topEach(engines, [fen, ...candidates], s.bounceScreenNodes);
  const b0 = crowdOf(glance[0]);
  if (b0 === null) return null;
  const near = candidates
    .map((c, i) => ({ c, m: glance[i + 1] }))
    .filter((x) => x.m && x.m.mate === undefined)
    .map((x) => ({ c: x.c, d: Math.abs(pawnsLost(b0, crowdOf(x.m)!, s) - s.bounceTarget) }))
    .sort((a, b) => a.d - b.d || (a.c < b.c ? -1 : 1))
    .slice(0, s.bounceConfirm)
    .map((x) => x.c);
  if (!near.length) return null;
  const look = await topEach(engines, [fen, ...near], s.bounceNodes);
  const before = crowdOf(look[0]);
  if (before === null) return null;
  const scored: BounceScore[] = near.flatMap((c, i) => {
    const m = look[i + 1];
    return m ? [{ fen: c, crowd: 1 - m.expected, ...(m.mate !== undefined ? { mate: true } : {}) }] : [];
  });
  return pickBounce(before, scored, s);
}

/** The Big Bounce's candidates, worked out once per position (the pick is checked against the same list). */
function bounceList(b: Battle): BounceCandidate[] {
  const boss = b.state.boss!;
  const fen = b.boards.get(b.state.boards[0]!)!.fen;
  const key = `${fen}|${boss.crowdMoves}|${boss.powers!.seed}|${blockSquare(boss)}`;
  const memo = b.memo.get("bounce") as { key: string; list: BounceCandidate[] } | undefined;
  if (memo?.key === key) return memo.list;
  const list = bounceCandidates(fen, boss.crowdSide, boss.powers!.seed, boss.crowdMoves, blockSquare(boss));
  b.memo.set("bounce", { key, list });
  return list;
}

/** His part in the match runner (the runner's bounceDue, bounceCandidates, playBounce and applyBounce hand it over). */
export const bigboyBattle = {
  /** The Big Bounce is due: the start of his turn (the crowd has moved), from the warning or the test trigger. */
  bounceDue(b: Battle): boolean {
    return bounceDue(b.state.boss) && b.bossToMove() && !b.finalGameOver();
  },

  /**
   * The Big Bounce's candidate positions (him to move), from the seed and the position now: the same list on the
   * server, the host and in solo (bounceCandidates).
   */
  bounceCandidates(b: Battle): string[] {
    return bounceList(b).map((c) => c.fen);
  },

  /** The Big Bounce, from this device's engines (bounceFrom: the candidates scored, the pick within the loss band). */
  async playBounce(b: Battle, engines: readonly EngineLike[]): Promise<BounceResult> {
    const fen = b.boards.get(b.state.boards[0]!)!.fen;
    const pick = await bounceFrom(engines, fen, bigboyBattle.bounceCandidates(b));
    return bigboyBattle.applyBounce(b, pick?.fen ?? null, pick?.loss ?? null);
  },

  /**
   * The Big Bounce lands (from the host's engine online): the crowd's pieces where the picked candidate has them (a base
   * on the board: the position changes between moves), or, with no pick (none within the cap, no engine anywhere, or
   * anything that isn't one of the candidates), nothing moves; the bounces play either way. It isn't a move: nothing is
   * scored, fair play never sees it, and he plays his move after it. Once a match: the meter is spent.
   */
  applyBounce(b: Battle, pick: string | null, loss: number | null = null): BounceResult {
    const boss = b.state.boss!;
    const { ultNext: _trigger, ...p } = boss.powers!;
    const id = b.state.boards[0]!;
    const board = b.boards.get(id)!;
    const picked = (pick && bounceList(b).find((c) => c.fen === pick)) || null;
    const result = bounceResult(board.fen, boss.crowdSide, p.seed, boss.crowdMoves, picked, loss);
    if (picked) {
      const ply = board.history.length;
      // (The side to move's expected score: his, better by the loss (in pawns) when it's known.)
      const odds = Math.log(Math.min(0.999, Math.max(0.001, board.expected)) / (1 - Math.min(0.999, Math.max(0.001, board.expected))));
      const expected = loss === null ? board.expected : 1 / (1 + Math.exp(-(odds + loss * BOSS_POWERS.bouncePawnLogit)));
      b.boards.set(id, { ...board, fen: picked.fen, expected, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: picked.fen }] });
    }
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, ultAt: boss.crowdMoves, bounce: result, events: [...p.events, { kind: "bounce", turn: p.turn }] } } };
    return result;
  },
};
