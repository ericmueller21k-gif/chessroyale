/**
 * Big Boy, the baby boss (BOSS_ROSTER "bigboy"): his rules. He opens with his snack: the battle starts from the starting
 * position less one of the crowd's center pawns, which he eats before move 1. His passive, the toy-block tower (Eric,
 * Nov 18): a block lands on an empty square in the crowd's half, and as every crowd turn after it begins he stacks one
 * more there, up to towerMax. Nothing slides through it (a knight jumps it; it never stops an attack); from towerEnter
 * blocks a crowd piece may move onto it, which topples it (his pieces too, rarely: on a seeded share of his turns, when his
 * engine picks that move); at towerMax it wobbles a turn and topples by itself. Some of its blocks (towerScatterShare)
 * scatter to empty squares nearby, each blocking as one block does (nothing onto it or through it, either side) for one
 * crowd turn; then they vanish and a new tower starts. His ultimate, the Big Bounce, comes at the start of his
 * turn after its warning: a few of the crowd's pieces are thrown to new squares nearby, into a position a little worse
 * for the crowd. Numbers: BOSS_POWERS.tower*, bounce*. His art and moments are the app's (characters/bigboy.ts,
 * components/BigBoy.tsx, the toys in characters/effects/).
 */
import { BOSS_POWERS, mulberry32, type BossPowerSettings, type BossPowerState, type BossState, type BounceResult, type PowerEvent } from "@chessroyale/core";
import { BOSS_OPENING, newBoard } from "../boards.ts";
import { applyMove, legalMoves, pieceAt, withoutPiece } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import type { MoveScore } from "../uci.ts";
import { bossPowers, crowdHalf, logit, meterFull, moveSquares, other, powerRoll, testSwitch, to, topEach, unleashed, type Battle, type BossRules, type Side } from "./base.ts";
import { gridHanging, gridKingAttacked, gridOf, isLight, placementOf, type Grid } from "./grid.ts";

/**
 * Big Boy's snack in the intro (before move 1): he waddles over to the crowd's center pawn, grabs it and eats it
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
 *   jumpAt    the last spring, high up and out of sight, his shadow growing over the four center squares.
 *   crashAt   the giant fall on the center: a crash, a shockwave across the board, dust, the board jolts (`jolt` ms).
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

/** Big Boy's toy block (a new tower's first): the banner, then his toss from the board's corner, the block's flight, and it lands. */
export const BLOCK = { flyAt: 1450, landAt: 1850 } as const;

/** One more block on his tower (no banner): his toss from the board's corner, the block's flight up to the top, it lands. */
export const STACK = { flyAt: 300, landAt: 650, ms: 900 } as const;

/**
 * His tower topples (no banner), by itself as a crowd turn begins or by the crowd's move onto it (while he thinks): it wobbles,
 * goes over at `tipAt` (its tip animation), and from `flyAt` its blocks fly out to their squares in landing order (nearest first),
 * one every `every` ms, each `flight` ms in a short arc, landing with a bounce; held to `ms` (ten blocks land by then).
 */
export const TOPPLE = { tipAt: 450, flyAt: 750, every: 70, flight: 420, ms: 2200 } as const;

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const BIGBOY_FX = { block: 2300, stack: STACK.ms, topple: TOPPLE.ms, bounce: BOUNCE.total } as const;

/** Big Boy opens with his snack: the battle starts from the starting position less one of the crowd's center pawns. */
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

/** His tower on the board now, if any. */
export const towerOf = (boss: Pick<BossState, "powers"> | null | undefined) => boss?.powers?.tower ?? null;

/** The squares his toy blocks stand on now: the tower's, or its scattered blocks' (never both at once). */
export function toyBlockSquares(p: Pick<BossPowerState, "tower" | "scatter"> | null | undefined): string[] {
  return [...(p?.tower ? [p.tower.square] : []), ...(p?.scatter?.squares ?? [])];
}

/** A castling move (the king two files along): its way runs on past where he lands, to the rook's corner. */
const castles = (move: string, fen: string): boolean => Math.abs(move.charCodeAt(0) - move.charCodeAt(2)) === 2 && pieceAt(fen, move.slice(0, 2))?.type === "k";

/**
 * A move topples his tower: it lands on the tower's square (an ordinary legal move: a slide that ends there, a knight's
 * jump, a pawn's step or capture; never castling, whose way runs on past it), and the tower is towerEnter blocks or more.
 * (The crowd's may, always; his only on a turn his tower is open to him: hisToppleOpen.)
 */
export function topples(move: string, tower: { square: string; height: number } | null | undefined, fen: string, s: Pick<BossPowerSettings, "towerEnter"> = BOSS_POWERS): boolean {
  return !!tower && tower.height >= s.towerEnter && to(move) === tower.square && !castles(move, fen);
}

/**
 * His tower is open to his own pieces on his move now (Eric, Nov 18: "both but he usually doesn't"): on a towerBossChance share
 * of his turns, drawn from the battle's seed and the crowd turn just played (`p.turn`; the same on the server, the host and in
 * solo, as the server sends the host the moves he may play). Open, a move of his onto it (towerEnter tall or more) is one of his
 * moves like any other: his engine or brain plays it only if it picks it, no bonus. Closed (most turns), it stops his pieces as
 * a single block does.
 */
export function hisToppleOpen(p: Pick<BossPowerState, "seed" | "turn" | "tower"> | null | undefined, s: Pick<BossPowerSettings, "towerEnter" | "towerBossChance"> = BOSS_POWERS): boolean {
  return !!p?.tower && p.tower.height >= s.towerEnter && powerRoll(p.seed, "his-topple", p.turn) < s.towerBossChance;
}

/**
 * His toy blocks stop a move (`mayTopple`: the move may topple the tower: always the crowd's, his only when hisToppleOpen):
 * onto or through a scattered block; through the tower; onto the tower, unless the move may topple it and does (`topples`). A
 * knight jumps them all; none ever stops an attack.
 */
export function toyStops(move: string, p: Pick<BossPowerState, "tower" | "scatter"> | null | undefined, fen: string, mayTopple: boolean, s: Pick<BossPowerSettings, "towerEnter"> = BOSS_POWERS): boolean {
  if (p?.scatter?.squares.some((sq) => blockedBy(move, sq, fen))) return true;
  const t = p?.tower;
  if (!t || !blockedBy(move, t.square, fen)) return false;
  // (Onto it, not through it: its square is where the move lands and nowhere on its way.)
  return !(mayTopple && topples(move, t, fen, s) && moveSquares(move, fen).indexOf(t.square) === 1);
}

/**
 * Where a toppled tower's blocks land (Eric: "it favors the closer ones, but ... some scattered further away"): up to `height`
 * empty squares within towerScatterReach of its square (any direction; never its own square, a piece's or off the board), each
 * drawn in turn with weight 1 / distance^towerScatterPower (the distance between the squares' middles), from the battle's seed,
 * the crowd turn and who toppled it: the same on every device. A square that would leave the side to move in `fen` without a
 * legal move (the blocks so far with it) is passed over. Fewer when there aren't enough. In landing order: nearest first (a
 * tie in the order drawn).
 */
export function scatterSquares(
  fen: string,
  from: string,
  height: number,
  seed: number,
  turn: number,
  by: "crowd" | "boss",
  s: Pick<BossPowerSettings, "towerScatterReach" | "towerScatterPower"> = BOSS_POWERS,
): string[] {
  const f0 = from.charCodeAt(0) - 97;
  const r0 = Number(from[1]) - 1;
  const R = s.towerScatterReach;
  const pool: { sq: string; d: number; w: number }[] = [];
  for (let df = -R; df <= R; df++)
    for (let dr = -R; dr <= R; dr++) {
      const f = f0 + df;
      const r = r0 + dr;
      if ((!df && !dr) || f < 0 || f > 7 || r < 0 || r > 7) continue;
      const sq = `${"abcdefgh"[f]}${r + 1}`;
      if (pieceAt(fen, sq)) continue;
      const d = Math.hypot(df, dr);
      pool.push({ sq, d, w: d ** -s.towerScatterPower });
    }
  pool.sort((a, b) => (a.sq < b.sq ? -1 : 1));
  let legal: string[] = [];
  try {
    legal = legalMoves(fen);
  } catch {
    legal = [];
  }
  const rnd = mulberry32(Math.floor(powerRoll(seed, "topple", turn, by) * 2 ** 32));
  const out: { sq: string; d: number }[] = [];
  while (out.length < height && pool.length) {
    let x = rnd() * pool.reduce((t, c) => t + c.w, 0);
    let i = 0;
    while (i < pool.length - 1 && x >= pool[i]!.w) x -= pool[i++]!.w;
    const [c] = pool.splice(i, 1);
    const blocks = [...out.map((o) => o.sq), c!.sq];
    // (Never the last way out: the side to move keeps a legal move none of the blocks stops.)
    if (legal.length && !legal.some((m) => !blocks.some((b) => blockedBy(m, b, fen)))) continue;
    out.push({ sq: c!.sq, d: c!.d });
  }
  return out.sort((a, b) => a.d - b.d).map((o) => o.sq);
}

/** How many of a toppled tower's blocks scatter (towerScatterShare of its height, rounded up; the rest break up where it falls). */
export const scatterCount = (height: number, s: Pick<BossPowerSettings, "towerScatterShare"> = BOSS_POWERS): number => Math.ceil(height * s.towerScatterShare - 1e-9);

/**
 * His tower topples (`by` the crowd's move onto it, or by itself / by his piece as a crowd turn begins): scatterCount of its
 * blocks scatter (scatterSquares, on `fen`: the position now, its side to move kept a move), standing until the crowd's
 * move on turn `until` is played (never into his reply to it); the tower is gone. Returns the topple's event (crowd turn `turn`).
 */
function topple(next: BossPowerState, fen: string, by: "crowd" | "boss", turn: number, until: number, s: BossPowerSettings): PowerEvent {
  const tower = next.tower!;
  const squares = scatterSquares(fen, tower.square, scatterCount(tower.height, s), next.seed, turn, by, s);
  next.tower = null;
  next.scatter = { from: tower.square, height: tower.height, squares, by, at: turn, until };
  next.topples = (next.topples ?? 0) + 1;
  return { kind: "topple", turn, square: tower.square, squares: [...squares], by, height: tower.height };
}

/**
 * His toys as they'll stand for his reply to the crowd's move (`after`: the position after it, him to move; `p`: as the crowd's
 * turn left them): the scattered blocks whose last crowd turn this was go (Eric: gone at the end of the crowd's next turn,
 * every time); one a piece now stands on (its limit lifted) is gone; and the crowd's move landed on his tower (the move that
 * topples it; or any onto it, its limit lifted): it topples, its blocks standing through his reply and the crowd's next turn.
 * Pure: the match's afterCrowdMove, and the Last Stand's look at what his reply would meet (standAltered).
 */
export function toysAfterCrowd(p: BossPowerState, after: string, s: BossPowerSettings = BOSS_POWERS): BossPowerState {
  const next: BossPowerState = { ...p };
  if (next.scatter && next.scatter.until <= p.turn) next.scatter = null;
  if (next.scatter?.squares.some((sq) => pieceAt(after, sq))) next.scatter = { ...next.scatter, squares: next.scatter.squares.filter((sq) => !pieceAt(after, sq)) };
  if (next.tower && pieceAt(after, next.tower.square)) next.events = [...p.events, topple(next, after, "crowd", p.turn, p.turn + 1, s)];
  return next;
}

/** The legal moves in `fen` (none where it can't be read). */
function legalIn(fen: string): string[] {
  try {
    return legalMoves(fen);
  } catch {
    return [];
  }
}

/**
 * His toys take away one of the crowd's legal moves now (`fen`: the crowd to move): a move onto or through a scattered block,
 * through the tower, or onto it while it's too short to topple. Not when they'd take every one (the limit lifts: every move
 * is open). Eric's (b), Nov 18: only such a turn is a power turn for fair play; a tower nothing slides through, standing
 * where a piece may topple it, takes nothing away, and the crowd's picks count as on a plain board.
 */
export function toysTakeMove(p: Pick<BossPowerState, "tower" | "scatter"> | null | undefined, fen: string): boolean {
  if (!p?.tower && !p?.scatter) return false;
  const legal = legalIn(fen);
  const open = legal.filter((m) => !toyStops(m, p, fen, true));
  return open.length > 0 && open.length < legal.length;
}

/**
 * His toys take away the reply the God King's Last Stand would replay (`reply`, the judge's: his best answer to the crowd's
 * move `played`, `fen` before it), as they'd stand for that reply (toysAfterCrowd: a topple's scattered blocks too; the tower
 * open to him on a turn it is, hisToppleOpen). Eric's (b), Nov 18: only then does his Last Stand sit out for the toys (the
 * judge's numbers are plain chess's, and that reply can't be played). Not known (`reply` undefined): it sits out, as before
 * (a feared reply nobody can check). Not when they'd take every move of his (his limit lifts: every move is open).
 */
export function toysTakeReply(p: BossPowerState, fen: string, played: string, reply: string | undefined, s: BossPowerSettings = BOSS_POWERS): boolean {
  if (!p.tower && !p.scatter) return false;
  if (!reply) return true;
  let after: string;
  try {
    after = applyMove(fen, played);
  } catch {
    return true;
  }
  const next = toysAfterCrowd(p, after, s);
  if (!next.tower && !next.scatter) return false;
  const open = hisToppleOpen(next, s);
  const legal = legalIn(after);
  const allowed = legal.filter((m) => !toyStops(m, next, after, open, s));
  return allowed.length > 0 && !allowed.includes(reply);
}

/**
 * The Big Bounce is due: the start of his turn (the crowd has just moved) on the turn the rage meter warned, or after
 * the test trigger, and not played yet this time (`ultAt` is set as it lands, and clears as the next turn begins).
 */
export const bounceDue = (boss: BossState | null | undefined): boolean => {
  const p = boss?.powers;
  return !!p && !boss!.result && bossPowers(boss)?.ultimate === "bounce" && p.ultAt === undefined && (!!p.ultNext || (p.warnAt !== undefined && p.warnAt === boss!.crowdMoves));
};

/** One of the Big Bounce's candidate positions (him to move) and the crowd's pieces it moved, each from and to. */
export interface BounceCandidate {
  fen: string;
  moves: { from: string; to: string; piece: string }[];
}

/**
 * Where a crowd piece may land in the Big Bounce: an empty square within `reach` (in both directions) of where it
 * stood, never one of his toy blocks (the tower's square, a scattered block's); a pawn only sideways along its rank (so it never reaches the first or last rank, and
 * the pawns stay plausible); a bishop on its own color (my call: a position that could come up in a game).
 */
function landings(sq: string, type: string, g: Grid, blocks: readonly string[], reach: number): string[] {
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
      if (g.has(t) || blocks.includes(t)) continue;
      if (type === "b" && isLight(t) !== isLight(sq)) continue;
      out.push(t);
    }
  return out;
}

/** One random try at a bounced position (a seeded random source), or null when it doesn't hold together. */
function bounceTry(fen: string, crowd: Side, rnd: () => number, blocks: readonly string[], s: Pick<BossPowerSettings, "bouncePieces" | "bounceReach">): (BounceCandidate & { grid: Grid }) | null {
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
    const options = landings(sq, c.toLowerCase(), g, blocks, s.bounceReach);
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
 * only sideways, never onto a toy block), the crowd's king not in check, his neither, castling rights gone with a
 * moved rook, en passant cleared. A try that leaves more of the crowd's material hanging than before is dropped (he'd
 * simply take it: far past a pawn and a half). Pure: the server, the host and solo work out the same list.
 */
export function bounceCandidates(
  fen: string,
  crowd: Side,
  seed: number,
  at: number,
  blocks: readonly string[] = [],
  s: Pick<BossPowerSettings, "bouncePieces" | "bounceReach" | "bounceCandidates"> = BOSS_POWERS,
): BounceCandidate[] {
  const out: BounceCandidate[] = [];
  const seen = new Set<string>();
  const hanging = gridHanging(gridOf(fen), crowd);
  // (His promotions already there, him to move: the bounce may keep them, never add one.)
  let promos = new Set<string>();
  try {
    promos = new Set(legalMoves(fen).filter((m) => m.length === 5));
  } catch {
    promos = new Set();
  }
  for (let a = 0; out.length < s.bounceCandidates && a < s.bounceCandidates * 30; a++) {
    const c = bounceTry(fen, crowd, mulberry32(Math.floor(powerRoll(seed, "bounce", at, a) * 2 ** 32)), blocks, s);
    if (!c) continue;
    const key = c.fen.split(" ")[0]!;
    if (seen.has(key) || gridHanging(c.grid, crowd) > hanging) continue;
    seen.add(key);
    // (And he has a move: never a stalemate. Nor a promotion he hadn't before it: a crowd piece thrown onto a square his pawn
    // takes on its last rank, or out of its way, would hand him a queen for nothing. The boss kit's invariant 5.)
    try {
      const his = legalMoves(c.fen);
      if (!his.length || his.some((m) => m.length === 5 && !promos.has(m))) continue;
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
 * the crowd's half, from the seed. Never the center block (d4-e5): that's the crash's.
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
    // (The four blocks holding the square, in a seeded order: the first on the board that isn't the center's.)
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

/** Big Boy: his tower of toy blocks (and its scattered blocks), and the Big Bounce at the start of his turn. */
export const BIGBOY: BossRules = {
  id: "bigboy",
  ultimateOnHisTurn: true,
  // The scattered blocks go as the crowd's move on their last turn (`until`) is played (afterCrowdMove; here only if that
  // never ran). One a piece of his now stands on (his only move, the limit lifted) is gone, as the crowd's case.
  wearOff(next, t) {
    if (next.scatter && next.scatter.until < t.turn) next.scatter = null;
    if (next.scatter?.squares.some((sq) => pieceAt(t.fen, sq))) next.scatter = { ...next.scatter, squares: next.scatter.squares.filter((sq) => !pieceAt(t.fen, sq)) };
  },
  // The Big Bounce: the meter full as a turn begins, its warning ("RAGE!") that turn; it comes at the start of his turn,
  // after the crowd's move (bounceDue). The test switch: warned as the second turn begins. The trigger (`ultNext`, kept):
  // at the start of his next turn, without the warning.
  ultimate(next, t) {
    if (next.warnAt === undefined && !t.ultNext && (meterFull(next, t) || testSwitch(t, next))) {
      next.warnAt = t.turn;
      t.events.push({ kind: "warn", turn: t.turn });
    }
    return false;
  },
  // His tower, as each crowd turn begins (after his move): from firstPassive, its first block (a new tower once the last one's
  // scattered blocks have gone); then one more each turn up to towerMax; at towerMax a turn on, it topples by itself, its blocks
  // standing through this crowd turn, gone as its move is played (Eric: always gone at the end of the crowd's next turn). A
  // piece of his on its square (his move onto it on a turn it was open to him, or his only move, the limit lifted) topples it
  // the same way. The test switch (?power=tower): the battle's first tower starts towerTest tall.
  passive(next, t) {
    if (t.turn < next.nextPassive || next.scatter) return;
    const tower = next.tower;
    if (!tower) {
      const square = chooseBlock(t.fen, t.crowd, t.seed, t.turn);
      if (!square) return;
      next.tower = { square, height: t.test === "tower" && !next.topples ? Math.min(t.s.towerTest, t.s.towerMax) : 1, at: t.turn };
      t.events.push({ kind: "block", turn: t.turn, square });
    } else if (tower.height >= t.s.towerMax || pieceAt(t.fen, tower.square)) {
      t.events.push(topple(next, t.fen, "boss", t.turn, t.turn, t.s));
    } else {
      next.tower = { ...tower, height: tower.height + 1 };
      t.events.push({ kind: "stack", turn: t.turn, square: tower.square, height: tower.height + 1 });
    }
  },
  // Nothing of the crowd's onto a block or through one, nor through the tower; onto the tower only to topple it.
  crowdFilter(allowed, boss, fen) {
    const p = boss.powers!;
    return p.tower || p.scatter ? allowed.filter((m) => !toyStops(m, p, fen, true)) : allowed;
  },
  // His own pieces: never onto a block or through one; into the tower only on a turn it's open to him (hisToppleOpen).
  bossStops(boss) {
    const p = boss.powers;
    if (!p?.tower && !p?.scatter) return null;
    const open = hisToppleOpen(p);
    return (m, fen) => toyStops(m, p, fen, open);
  },
  // (Asked only of a move that isn't allowed, or his only move let through: any block it touches is why.)
  stopReason: (boss, fen, m) => (toyStops(m, boss.powers, fen, false) ? "block" : null),
  // A turn with his toys up is a power turn (fair play) only when they take one of the crowd's moves away (Eric's (b), Nov 18:
  // the tower stands nearly every turn; a tower nothing slides through, open to a topple, changes nothing the crowd may play).
  // Without the position, his toys up count.
  powerTurn: (boss, fen) => (fen === undefined ? !!boss.powers!.tower || !!boss.powers!.scatter : toysTakeMove(boss.powers, fen)),
  // The Last Stand sits out for his toys only when they take away the reply it would replay (Eric's (b), Nov 18): in place of
  // the general rule (his bossStops alone would keep it off whenever the tower stands, nearly every turn).
  standAltered: (boss, fen, played, reply) => toysTakeReply(boss.powers!, fen, played, reply),
  // His toys as the crowd's move is played, before his reply (toysAfterCrowd): the scattered blocks whose last crowd turn this
  // was go; a crowd piece on his tower topples it.
  afterCrowdMove(b) {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || (!p.tower && !p.scatter)) return;
    const fen = b.boards.get(b.state.boards[0]!)!.fen;
    b.state = { ...b.state, boss: { ...boss, powers: toysAfterCrowd(p, fen) } };
  },
  // From the starting position (sides as usual), less the crowd's center pawn he eats before move 1: a base at ply 0
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
  view: (p) => ({ tower: p.tower ? { ...p.tower } : null, scatter: p.scatter ? { ...p.scatter, squares: [...p.scatter.squares] } : null, snack: p.snack?.square ?? null, bounce: p.bounce ?? null }),
};

// ---------------- The Big Bounce in a match ----------------

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
  const blocks = toyBlockSquares(boss.powers);
  const key = `${fen}|${boss.crowdMoves}|${boss.powers!.seed}|${blocks.join(",")}`;
  const memo = b.memo.get("bounce") as { key: string; list: BounceCandidate[] } | undefined;
  if (memo?.key === key) return memo.list;
  const list = bounceCandidates(fen, boss.crowdSide, boss.powers!.seed, boss.crowdMoves, blocks);
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
   * scored, fair play never sees it, and he plays his move after it. The meter is spent (it fills again from the next
   * turn).
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
    b.state = { ...b.state, boss: { ...boss, powers: unleashed({ ...p, ultAt: boss.crowdMoves, bounce: result, events: [...p.events, { kind: "bounce", turn: p.turn }] }) } };
    return result;
  },
};
