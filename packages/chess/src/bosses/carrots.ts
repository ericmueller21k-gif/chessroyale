/**
 * Chub & Chirp's ultimate, the Carrot Patch (Eric's sheet, Oct 18; docs/decisions/2026-10-18-carrot-patch.md): the race's
 * own rules, pure, so the server, the host, solo and every replay work out the same thing. Their part in a battle (the
 * cast, the pulls, the spin) is in hopper.ts; his race brain's search is the runner's (raceGuard).
 *
 * - **The cast** (his whole turn, once a battle): BOSS_POWERS.carrotCount carrots on empty squares, at least one on each
 *   half, no two touching. Where they go (`plantCarrots`): for each side, the fewest moves for any of its pieces to end a
 *   move on each square from the position as it stands (`reachMap`: blockers where they are; a pawn straight on to an
 *   empty square or diagonally onto a piece only) give each square his lead (the crowd's moves there less his: the crowd
 *   moves first, so a tie is the crowd's); a carrot goes where his lead is nearest each of carrotLeads (the sim's
 *   tuning), nearer squares first, seeded among equals.
 * - **The race:** a piece pulls a carrot by ending its move there; carrotMoves moves each.
 * - **What the race is worth** (`raceWorth`): who gets each carrot still in the ground as the race would go, one carrot
 *   at a time each (`raceOutlook`), gives the odds of how many he ends with; each count's prize at its average, in
 *   pawns, his last carrot the battle. His brain (the runner's raceGuard) and the crowd's judge (`raceJudged`,
 *   `raceRanked`) both weigh moves by it, against each other (`raceAdjust`).
 * - **The spin** (`spinRoll`) on his tier, from the battle's seed; the prize stepped down when the engines can't take
 *   it (`prizeFits`), and put on his side (`placePrize`, with Alfil's landing code).
 */
import { BOSS_POWERS, type BossPowerSettings, type CarrotPatch, type CarrotSide } from "@chessroyale/core";
import { applyMove, legalMoves, sideToMove } from "../rules.ts";
import { stockfishRefuses, type MoveScore } from "../uci.ts";
import { editedFen, putDown } from "./alfil.ts";
import { logit, other, powerRoll, VALUE, type Side } from "./base.ts";
import { gridOf, isLight, sideOf, type Grid } from "./grid.ts";

type CarrotSettings = Pick<BossPowerSettings, "carrotCount" | "carrotMoves" | "carrotLeads" | "carrotReach">;

const FILES = "abcdefgh";
const sq = (f: number, r: number) => `${FILES[f]}${r}`;
const file = (s: string) => s.charCodeAt(0) - 97;
const rank = (s: string) => Number(s[1]);
const idx = (s: string) => file(s) + (rank(s) - 1) * 8;
const SQUARES = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((r) => [0, 1, 2, 3, 4, 5, 6, 7].map((f) => sq(f, r)));
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]] as const;
const AROUND = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;
const letter = (side: Side, type: string) => (side === "w" ? type.toUpperCase() : type.toLowerCase());

// ---------------- The math: who reaches each square, and how soon ----------------

/**
 * The squares a piece (`c`, a FEN letter) on `at` can end its next move on, on `g` as it stands but for its own first
 * square (`left`: it has moved off it): an empty square or one of the other side's pieces (a capture; never a king),
 * along its lines up to the first piece in the way; a pawn straight on to an empty square (two from its first rank,
 * both empty), diagonally only onto a piece; a pawn on the last rank goes no further.
 */
function stepsFrom(g: Grid, at: string, c: string, left: string): string[] {
  const side = sideOf(c);
  const type = c.toLowerCase();
  const f = file(at);
  const r = rank(at);
  const on = (s: string) => (s === left ? undefined : g.get(s));
  const ok = (ff: number, rr: number) => ff >= 0 && ff < 8 && rr >= 1 && rr <= 8;
  const lands = (s: string) => {
    const x = on(s);
    return !x || (sideOf(x) !== side && x.toLowerCase() !== "k");
  };
  const out: string[] = [];
  if (type === "p") {
    const dir = side === "w" ? 1 : -1;
    if (r === (side === "w" ? 8 : 1)) return out;
    if (ok(f, r + dir) && !on(sq(f, r + dir))) {
      out.push(sq(f, r + dir));
      if (r === (side === "w" ? 2 : 7) && ok(f, r + 2 * dir) && !on(sq(f, r + 2 * dir))) out.push(sq(f, r + 2 * dir));
    }
    for (const df of [-1, 1]) {
      if (!ok(f + df, r + dir)) continue;
      const x = on(sq(f + df, r + dir));
      if (x && sideOf(x) !== side && x.toLowerCase() !== "k") out.push(sq(f + df, r + dir));
    }
    return out;
  }
  if (type === "n" || type === "k") {
    for (const [df, dr] of type === "n" ? KNIGHT : AROUND) if (ok(f + df, r + dr) && lands(sq(f + df, r + dr))) out.push(sq(f + df, r + dr));
    return out;
  }
  for (const [df, dr] of AROUND) {
    if (type === "b" && !(df && dr)) continue;
    if (type === "r" && df && dr) continue;
    for (let k = 1; k < 8 && ok(f + df * k, r + dr * k); k++) {
      const s = sq(f + df * k, r + dr * k);
      const x = on(s);
      if (!x || lands(s)) out.push(s);
      if (x) break;
    }
  }
  return out;
}

/**
 * For one side: the fewest moves for any of its pieces to end a move on each square (by square index, a1 = 0), from
 * the position as it stands, each piece moving alone with every other piece where it is; up to `most` moves (further:
 * Infinity). The same blockers the placement reads, so the race's numbers are the cast's.
 */
export function reachMap(g: Grid, side: Side, most: number): number[] {
  const best = new Array<number>(64).fill(Infinity);
  for (const [home, c] of g) {
    if (sideOf(c) !== side) continue;
    const seen = new Map<string, number>([[home, 0]]);
    let wave = [home];
    for (let d = 1; d <= most && wave.length; d++) {
      const next: string[] = [];
      for (const at of wave)
        for (const to of stepsFrom(g, at, c, home)) {
          if (seen.has(to)) continue;
          seen.set(to, d);
          next.push(to);
          if (d < best[idx(to)]!) best[idx(to)] = d;
        }
      wave = next;
    }
  }
  return best;
}

/** One empty square as the cast sees it: each side's fewest moves there (Infinity: none within the race), and his lead. */
export interface CarrotSpot {
  square: string;
  his: number;
  crowd: number;
  lead: number;
}

/** His lead on a square: the crowd's fewest moves less his (one side only reaching it: ±9; neither: 0). */
export const carrotLead = (his: number, crowd: number): number => (his === Infinity && crowd === Infinity ? 0 : his === Infinity ? -9 : crowd === Infinity ? 9 : crowd - his);

/** Every empty square as the cast sees it (`fen`: the crowd to move, carrotMoves each to come): the placement's math. */
export function carrotSpots(fen: string, crowd: Side, s: Pick<BossPowerSettings, "carrotMoves"> = BOSS_POWERS): CarrotSpot[] {
  const g = gridOf(fen);
  const mine = reachMap(g, other(crowd), s.carrotMoves);
  const theirs = reachMap(g, crowd, s.carrotMoves);
  return SQUARES.filter((x) => !g.has(x)).map((square) => {
    const his = mine[idx(square)]!;
    const them = theirs[idx(square)]!;
    return { square, his, crowd: them, lead: carrotLead(his, them) };
  });
}

const touching = (a: string, b: string) => Math.max(Math.abs(file(a) - file(b)), Math.abs(rank(a) - rank(b))) <= 1;
const half = (s: string) => (rank(s) <= 4 ? 0 : 1);

/**
 * Where the cast's carrots go (Eric's sheet), from the position it leaves (`fen`: the crowd to move; the crowd moves
 * first) and the battle's seed (`at`: the crowd move it came after): carrotCount empty squares, at least one on each half,
 * no two touching. For each of carrotLeads in turn, the square whose lead (carrotSpots: the crowd's fewest moves there
 * less his) is nearest it, a nearer square first among equals (a tenth of a move for each move the nearer side needs),
 * among squares a piece of either side reaches within carrotReach moves (fewer of those than it needs: any reached in
 * the race, then any), seeded among equals; then, if all landed on one half, the one whose swap to the other half costs
 * least is swapped. Fewer only when the board can't hold them all apart. Pure.
 */
export function plantCarrots(fen: string, crowd: Side, seed: number, at: number, s: CarrotSettings = BOSS_POWERS): string[] {
  const spots = carrotSpots(fen, crowd, s);
  const roll = new Map(spots.map((x) => [x.square, powerRoll(seed, "carrots", at, x.square)]));
  const reach = (x: CarrotSpot) => Math.min(x.his, x.crowd);
  const pools = [spots.filter((x) => reach(x) <= s.carrotReach), spots.filter((x) => reach(x) < Infinity), spots];
  const pool = pools.find((p) => p.length >= s.carrotCount * 3) ?? spots;
  const aims = s.carrotLeads.slice(0, s.carrotCount);
  const cost = (x: CarrotSpot, aim: number) => Math.abs(x.lead - aim) + 0.1 * (Number.isFinite(reach(x)) ? reach(x) : 9) + 1e-6 * roll.get(x.square)!;
  const best = (aim: number, from: readonly CarrotSpot[], taken: readonly string[]) =>
    from.filter((x) => !taken.some((t) => t === x.square || touching(t, x.square))).sort((a, b) => cost(a, aim) - cost(b, aim) || (a.square < b.square ? -1 : 1))[0] ?? null;
  const chosen: CarrotSpot[] = [];
  for (const aim of aims) {
    const x = best(aim, pool, chosen.map((c) => c.square)) ?? best(aim, spots, chosen.map((c) => c.square));
    if (x) chosen.push(x);
  }
  // (Both halves: the cheapest swap of one carrot to the half without any.)
  if (chosen.length > 1 && new Set(chosen.map((c) => half(c.square))).size === 1) {
    const away = 1 - half(chosen[0]!.square);
    let swap: { i: number; x: CarrotSpot; extra: number } | null = null;
    for (let i = 0; i < chosen.length; i++) {
      const rest = chosen.filter((_, j) => j !== i).map((y) => y.square);
      const x = best(aims[i]!, pool.filter((y) => half(y.square) === away), rest) ?? best(aims[i]!, spots.filter((y) => half(y.square) === away), rest);
      const extra = x ? cost(x, aims[i]!) - cost(chosen[i]!, aims[i]!) : Infinity;
      if (x && (!swap || extra < swap.extra)) swap = { i, x, extra };
    }
    if (swap) chosen[swap.i] = swap.x;
  }
  return chosen.map((c) => c.square);
}

// ---------------- The race ----------------

/** The carrots still in the ground, in the order planted. */
export const carrotsOpen = (c: Pick<CarrotPatch, "squares" | "pulls">): string[] => c.squares.filter((x) => !c.pulls.some((p) => p.square === x));

/** How many carrots a side has pulled. */
export const carrotsOf = (c: Pick<CarrotPatch, "pulls"> | null | undefined, by: CarrotSide): number => c?.pulls.filter((p) => p.by === by).length ?? 0;

/** Each side's moves left in the race. */
export const raceLeft = (c: Pick<CarrotPatch, "crowdMoves" | "bossMoves">, s: Pick<BossPowerSettings, "carrotMoves"> = BOSS_POWERS) => ({
  crowd: Math.max(0, s.carrotMoves - c.crowdMoves),
  boss: Math.max(0, s.carrotMoves - c.bossMoves),
});

/** The race is on: the carrots planted, and it isn't over. */
export const raceOn = (c: CarrotPatch | null | undefined): c is CarrotPatch => !!c && !c.over;

/** The open carrots in `open` that a piece stands on in `fen` (after a move: the ones it pulled). */
export function standingOn(fen: string, open: readonly string[]): string[] {
  const g = gridOf(fen);
  return open.filter((x) => g.has(x));
}

/** The open carrots a move would pull, without playing it: where its piece ends, and a castling rook's square. */
export function pullsOf(fen: string, move: string, open: readonly string[]): string[] {
  const to = move.slice(2, 4);
  const out = open.includes(to) ? [to] : [];
  const from = move.slice(0, 2);
  const g = gridOf(fen);
  if (g.get(from)?.toLowerCase() === "k" && Math.abs(file(to) - file(from)) === 2) {
    const rook = sq(file(to) > file(from) ? file(to) - 1 : file(to) + 1, rank(to));
    if (open.includes(rook)) out.push(rook);
  }
  return out;
}

/**
 * The race as a move is weighed (his brain's, the crowd's judge's): his side, the carrots still in the ground, his
 * count, each side's moves left (the side to move's counting the move weighed), and how much the race weighs in the
 * pick (his strength, raceWeight; the judge's: all of it). The boss request's `race`, the score jobs' `race`.
 */
export interface CarrotRace {
  boss: Side;
  open: string[];
  his: number;
  crowdLeft: number;
  bossLeft: number;
  weight?: number;
}

/** How much the race weighs in his pick at his strength (`elo`): carrotWeightMin at carrotSkill[0] and below, all of it from carrotSkill[1]. */
export function raceWeight(elo: number, s: Pick<BossPowerSettings, "carrotSkill" | "carrotWeightMin"> = BOSS_POWERS): number {
  const [lo, hi] = s.carrotSkill;
  return Math.max(s.carrotWeightMin, Math.min(1, (elo - lo) / Math.max(1, hi - lo)));
}

/** The race after a move (`fen` the position before it): what it pulled, the counts, the moves left; and the position after. */
export function raceAfter(fen: string, move: string, r: CarrotRace): { fen: string; race: CarrotRace; pulled: string[] } {
  const after = applyMove(fen, move);
  const pulled = standingOn(after, r.open);
  const his = sideToMove(fen) === r.boss;
  return {
    fen: after,
    pulled,
    race: {
      ...r,
      open: r.open.filter((x) => !pulled.includes(x)),
      his: r.his + (his ? pulled.length : 0),
      crowdLeft: r.crowdLeft - (his ? 0 : 1),
      bossLeft: r.bossLeft - (his ? 1 : 0),
    },
  };
}

/**
 * Who gets each carrot still in the ground as the race would go from here (`d`: each side's fewest moves to each, from
 * the position; `left`: each side's moves left; `first`: the side to move): each side takes one carrot at a time. On its
 * move a side works toward the carrot it would otherwise lose soonest among those it gets to first (else its nearest),
 * and pulls it once its moves there are done (pulled by the other side first: on to its next). Each carrot's taker then
 * holds it by its margin (how many plies later the other side would have got there, at most 4), through a logistic
 * (carrotSharp a ply); his own the less the later he'd pull them (carrotHurry for each of his moves before the one that
 * pulls it: a carrot in the ground isn't his yet, so pulling one now beats leaving it for later). His chance of each,
 * in `d`'s order; nobody reaching one in the race: 0.
 */
export function raceOutlook(d: Record<CarrotSide, readonly number[]>, left: Record<CarrotSide, number>, first: CarrotSide, s: Pick<BossPowerSettings, "carrotSharp" | "carrotHurry"> = BOSS_POWERS): number[] {
  const n = d.boss.length;
  const owner: (CarrotSide | null)[] = new Array<CarrotSide | null>(n).fill(null);
  const margin = new Array<number>(n).fill(0);
  const when = new Array<number>(n).fill(0);
  const st: Record<CarrotSide, { target: number; done: number; used: number }> = { boss: { target: -1, done: 0, used: 0 }, crowd: { target: -1, done: 0, used: 0 } };
  const flip = (x: CarrotSide): CarrotSide => (x === "boss" ? "crowd" : "boss");
  const mover = (ply: number): CarrotSide => (ply % 2 === 1 ? first : flip(first));
  // (The ply of a side's k-th move from ply `from` on.)
  const nth = (x: CarrotSide, from: number, k: number) => (mover(from) === x ? from : from + 1) + 2 * (Math.max(1, k) - 1);
  // (When the other side would get to carrot c from ply `from`, going straight for it: Infinity when it can't in the race.)
  const theirs = (o: CarrotSide, c: number, from: number) => {
    const need = d[o][c]! - (st[o].target === c ? st[o].done : 0);
    return need <= left[o] - st[o].used ? nth(o, from, need) : Infinity;
  };
  for (let ply = 1; ply <= left.boss + left.crowd + 1 && owner.includes(null); ply++) {
    const x = mover(ply);
    const o = flip(x);
    const me = st[x];
    if (me.used >= left[x]) continue;
    if (me.target < 0 || owner[me.target] !== null) {
      me.target = -1;
      me.done = 0;
      let key = [Infinity, Infinity];
      for (let c = 0; c < n; c++) {
        const need = d[x][c]!;
        if (owner[c] !== null || need > left[x] - me.used) continue;
        const mine = nth(x, ply, need);
        const them = theirs(o, c, ply);
        const k = [mine < them ? them - mine : 1000 + need, need];
        if (k[0]! < key[0]! || (k[0] === key[0] && k[1]! < key[1]!)) [key, me.target] = [k, c];
      }
    }
    me.used++;
    if (me.target < 0) continue;
    me.done++;
    const c = me.target;
    if (me.done < d[x][c]!) continue;
    owner[c] = x;
    margin[c] = Math.min(4, theirs(o, c, ply + 1) - ply);
    when[c] = me.used;
    me.target = -1;
    me.done = 0;
  }
  return owner.map((who, c) => {
    if (!who) return 0;
    const hold = 1 / (1 + Math.exp(-s.carrotSharp * margin[c]!));
    return who === "boss" ? hold * Math.pow(s.carrotHurry, when[c]! - 1) : 1 - hold;
  });
}

/** His chance of each open carrot in `fen` (either side to move; each side's moves left as `r` says): raceOutlook on the board's distances. */
export function hisChances(fen: string, r: CarrotRace, s: Pick<BossPowerSettings, "carrotSharp" | "carrotHurry"> = BOSS_POWERS): number[] {
  if (!r.open.length) return [];
  const g = gridOf(fen);
  const mine = reachMap(g, r.boss, Math.max(0, r.bossLeft));
  const theirs = reachMap(g, other(r.boss), Math.max(0, r.crowdLeft));
  const first: CarrotSide = sideToMove(fen) === r.boss ? "boss" : "crowd";
  const d = { boss: r.open.map((x) => mine[idx(x)]!), crowd: r.open.map((x) => theirs[idx(x)]!) };
  return raceOutlook(d, { boss: Math.max(0, r.bossLeft), crowd: Math.max(0, r.crowdLeft) }, first, s);
}

/** The odds of his count once the race is over (0 to carrotCount; each carrot's chance taken on its own), from `his` now. */
export function countOdds(his: number, chances: readonly number[], max: number = BOSS_POWERS.carrotCount): number[] {
  let odds = new Array<number>(max + 1).fill(0);
  odds[Math.min(max, his)] = 1;
  for (const c of chances) {
    const next = new Array<number>(max + 1).fill(0);
    odds.forEach((p, k) => {
      next[k] = next[k]! + p * (1 - c);
      next[Math.min(max, k + 1)] = next[Math.min(max, k + 1)]! + p * c;
    });
    odds = next;
  }
  return odds;
}

/** Each tier's average prize in pawns (Eric's sheet: pawns 1, knights and bishops 3, rooks 5, queens 9), from carrotOdds. */
export function prizeWorth(s: Pick<BossPowerSettings, "carrotOdds"> = BOSS_POWERS): number[] {
  return s.carrotOdds.map((row) => row.reduce((t, x) => t + x.p * x.prize.reduce((v, pc) => v + VALUE[pc]!, 0), 0));
}

type WorthSettings = Pick<BossPowerSettings, "carrotCount" | "carrotSharp" | "carrotHurry" | "carrotOdds" | "carrotWinWorth">;

/**
 * What the race is worth to him from here, in pawns (`fen` and `r`: after a move, raceAfter's): the odds of each count he
 * can end with (his chances of each carrot, hisChances), each count's prize at its average, his last carrot the battle
 * (carrotWinWorth).
 */
export function raceWorth(fen: string, r: CarrotRace, s: WorthSettings = BOSS_POWERS): number {
  if (r.his >= s.carrotCount) return s.carrotWinWorth;
  const worth = prizeWorth(s);
  return countOdds(r.his, hisChances(fen, r, s), s.carrotCount).reduce((t, p, k) => t + p * (k >= s.carrotCount ? s.carrotWinWorth : (worth[k] ?? 0)), 0);
}

/**
 * A move's expected score with the race counted, against the other moves weighed with it: `e` its expected score (the
 * mover's, from the engine), `lag` how many pawns of the race's worth it gives up against the best of them for the race
 * (the mover's side: his prize's worth for him, its lack for the crowd), `weight` how much the race weighs (his strength;
 * the judge's: all of it), bouncePawnLogit log-odds a pawn. Only the difference between the moves is counted, so a
 * move's score stays the engine's where it's the race's best, and nothing saturates.
 */
export const raceAdjust = (e: number, lag: number, weight: number, s: Pick<BossPowerSettings, "bouncePawnLogit"> = BOSS_POWERS): number =>
  lag <= 0 ? e : 1 / (1 + Math.exp(-(logit(e) - weight * lag * s.bouncePawnLogit)));

// ---------------- The crowd's judge ----------------

/** The race's worth to him after each of the crowd's `moves` (the crowd to move in `fen`); a move that can't be played: null. */
function worthAfter(fen: string, moves: readonly string[], r: CarrotRace): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of moves) {
    try {
      const after = raceAfter(fen, m, r);
      out.set(m, raceWorth(after.fen, after.race));
    } catch {
      // (Not a move here: its score stays the engine's.)
    }
  }
  return out;
}

/**
 * A board's evaluation as the race's judge sees it (the crowd to move in `fen`): every move's expected score with the
 * race counted (raceAdjust: what it lets his prize be worth, against the best of the moves for the race), and the best
 * move the best of those. Unchanged without a race on. Pure: every device, the host and the lobby work out the same
 * numbers from the same evaluation.
 */
export function raceJudged<E extends { bestMove: string; bestExpected: number; expectedAfter: Record<string, number> }>(evaluation: E, fen: string, r: CarrotRace | null): E {
  if (!r || !r.open.length) return evaluation;
  const worth = worthAfter(fen, [...new Set([evaluation.bestMove, ...Object.keys(evaluation.expectedAfter)])], r);
  // (No move here could be played: nothing to weigh, the engine's numbers stand.)
  if (!worth.size) return evaluation;
  const ref = Math.min(...worth.values());
  const adjust = (m: string, e: number) => raceAdjust(e, (worth.get(m) ?? ref) - ref, 1);
  const expectedAfter = Object.fromEntries(Object.entries(evaluation.expectedAfter).map(([m, e]) => [m, adjust(m, e)]));
  let bestMove = evaluation.bestMove;
  let bestExpected = expectedAfter[bestMove] ?? adjust(bestMove, evaluation.bestExpected);
  for (const [m, e] of Object.entries(expectedAfter).sort((a, b) => (a[0] < b[0] ? -1 : 1))) if (e > bestExpected) [bestMove, bestExpected] = [m, e];
  return { ...evaluation, bestMove, bestExpected, expectedAfter };
}

/** Top moves as the race's judge ranks them (for bots and hints): each with the race counted (as raceJudged), best first. */
export function raceRanked(top: readonly MoveScore[], fen: string, r: CarrotRace | null): MoveScore[] {
  if (!r || !r.open.length || !top.length) return [...top];
  const worth = worthAfter(fen, top.map((m) => m.move), r);
  if (!worth.size) return [...top];
  const ref = Math.min(...worth.values());
  return top.map((m) => ({ ...m, expected: raceAdjust(m.expected, (worth.get(m.move) ?? ref) - ref, 1) })).sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));
}

/** The crowd's moves that pull a carrot (the judge scores them all, so pulling one is always on the table). */
export function racePulls(fen: string, r: CarrotRace | null): string[] {
  if (!r || !r.open.length) return [];
  let moves: string[];
  try {
    moves = legalMoves(fen);
  } catch {
    return [];
  }
  return moves.filter((m) => pullsOf(fen, m, r.open).length > 0);
}

// ---------------- The spin ----------------

/**
 * His spin's prize from his tier (his carrots; 0 a blank, carrotCount or more: none, the battle was his) and the
 * battle's seed (`at`: the crowd move before it): carrotOdds's row for the tier, drawn by powerRoll. Pieces as letters.
 */
export function spinRoll(seed: number, at: number, tier: number, s: Pick<BossPowerSettings, "carrotOdds" | "carrotCount"> = BOSS_POWERS): string[] {
  if (tier <= 0 || tier >= s.carrotCount) return [];
  const row = s.carrotOdds[Math.min(tier, s.carrotOdds.length - 1)]!;
  const r = powerRoll(seed, "carrotSpin", at);
  let t = 0;
  for (const x of row) {
    t += x.p;
    if (r < t) return [...x.prize];
  }
  return [...row[row.length - 1]!.prize];
}

/** His prize pieces' squares in the order tried (Eric's sheet): pawns on his 2nd row, then his 3rd; the rest on his back row, then his 2nd; nearest the middle first. */
export function prizeSquares(piece: string, boss: Side): string[] {
  const rows = (piece === "p" ? [2, 3] : [1, 2]).map((n) => (boss === "w" ? n : 9 - n));
  const files = [3, 4, 2, 5, 1, 6, 0, 7];
  return rows.flatMap((r) => files.map((f) => sq(f, r)));
}

/**
 * His prize put on the board (`fen`: after his move, the crowd to move): each piece, most valuable first, on the first of
 * its squares (prizeSquares) that's empty and allowed (Alfil's landing code, putDown: never giving check, a pawn never on
 * the first or last rank, the crowd still with a move, a square where it isn't left hanging first); none of those, the
 * nearest empty square allowed. A bishop tries the squares of the color his bishops lack first, then the other (the
 * bishop color where it matters, as Alfil's landing keeps it: a second bishop on one color is worth well under the 3
 * pawns the odds count it at); with none or both, as any piece. Null when a piece has nowhere, or the position is one
 * the engines refuse (more than 8 pawns, more pieces than promotions could make: stockfishRefuses; chess.js and Maia
 * take any).
 */
export function placePrize(fen: string, prize: readonly string[], boss: Side): { fen: string; squares: string[] } | null {
  if (!prize.length) return { fen, squares: [] };
  const g = gridOf(fen);
  const squares: string[] = [];
  for (const piece of [...prize].sort((a, b) => VALUE[b]! - VALUE[a]!)) {
    const order = prizeSquares(piece, boss);
    const anchor = order[0]!;
    const near = (x: string) => Math.max(Math.abs(file(x) - file(anchor)), Math.abs(rank(x) - rank(anchor))) * 16 + Math.abs(file(x) - file(anchor)) + Math.abs(rank(x) - rank(anchor));
    const rest = SQUARES.filter((x) => !order.includes(x)).sort((a, b) => near(a) - near(b) || (a < b ? -1 : 1));
    // (A bishop: the color his bishops lack first, each list keeping its order.)
    const colors = new Set([...g].filter(([, c]) => c === letter(boss, "b")).map(([x]) => isLight(x)));
    const lacked = piece === "b" && colors.size === 1 ? !colors.has(true) : null;
    const byColor = (xs: string[]) => (lacked === null ? xs : [...xs.filter((x) => isLight(x) === lacked), ...xs.filter((x) => isLight(x) !== lacked)]);
    // (His rows first, safe or not, in order; only then the nearest anywhere.)
    const at = putDown(g, fen, letter(boss, piece), byColor(order)) ?? putDown(g, fen, letter(boss, piece), byColor(rest));
    if (!at) return null;
    squares.push(at);
  }
  const out = editedFen(fen, g);
  // (editedFen starts the fifty-move count again: pieces were put on. Nothing else changes: the crowd still to move.)
  return stockfishRefuses(out) ? null : { fen: out, squares };
}

/**
 * The prize he gets: the one rolled if it fits (placePrize), else the next in carrotPrizes (best first) after it that
 * does (Eric's sheet: "the prize steps down to the next one that fits"); none fits, nothing. Never a better one than
 * rolled.
 */
export function prizeFits(fen: string, rolled: readonly string[], boss: Side, s: Pick<BossPowerSettings, "carrotPrizes"> = BOSS_POWERS): { prize: string[]; fen: string; squares: string[] } {
  const key = (p: readonly string[]) => [...p].sort().join("");
  const ladder = s.carrotPrizes.map((p) => [...p]);
  const start = ladder.findIndex((p) => key(p) === key(rolled));
  const tries = [[...rolled], ...(start >= 0 ? ladder.slice(start + 1) : ladder.filter((p) => worthOf(p) < worthOf(rolled)))];
  for (const p of tries) {
    const placed = placePrize(fen, p, boss);
    if (placed) return { prize: p, ...placed };
  }
  return { prize: [], fen, squares: [] };
}

const worthOf = (p: readonly string[]) => p.reduce((t, x) => t + VALUE[x]!, 0);
