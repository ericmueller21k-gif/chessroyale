/**
 * Chub & Chirp's Turf (Eric, Nov 22 and 27; docs/decisions/2026-11-27-hopper-turf.md), everywhere but the Battle Tower: the pure
 * rules (the battle's part is hopper.ts's turf steps). "he" below: the boss, as everywhere.
 * - **The squares.** Each side starts with its own 16 (its first two ranks), 32 open. A square becomes a side's when one of its
 *   pieces ends a move there: a capture, castling's king and rook, a promotion, his hop's landing, your bounced pawn's, prize pieces
 *   dropped in (claimTurf: every piece that has come to a square since the last claim claims it). A piece leaving keeps it.
 * - **The hop-around.** Every turfHopEvery of his turns, at the start of his turn (one step a turn: the bounce, then the hop, then
 *   this), Chirp hops on turfHops of his empty squares (the nearest to where he lands, the farthest first) and lands on an open empty
 *   square (else one of yours), claiming it (turfHopPick: seeded, the same on the server and in solo).
 * - **His holds**, each while he held at least that many squares (turfHolds) as his turn began: Long legs (his pawns step 2 from
 *   any square but their start, 3 from it: legsOptions), Short fuse (your next move's time: fuseClock, fuseIncrement), Double hop
 *   (a quiet second move after his: hopper.ts). You have no holds: your answer is taking squares back.
 */
import { BOSS_POWERS, type BossPowerSettings, type BossState, type TurfHop, type TurfState } from "@chessroyale/core";
import { applyMove, gameEnd, inCheck, legalMoves, sideToMove } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import { stockfishRefuses } from "../uci.ts";
import { editedFen } from "./alfil.ts";
import { logit, other, powerRoll, topEach, type Side } from "./base.ts";
import { gridKingAttacked, gridOf, sideOf } from "./grid.ts";

const FILES = "abcdefgh";
/** A square's place in TurfState.owner (a1 0, h1 7, a2 8 ... h8 63). */
export const turfIndex = (sq: string): number => sq.charCodeAt(0) - 97 + 8 * (Number(sq[1]) - 1);
export const turfSquare = (i: number): string => `${FILES[i % 8]}${Math.floor(i / 8) + 1}`;

/** Who holds a square: his (`b`), the crowd's (`c`), open (`.`). */
export type TurfMark = "b" | "c" | ".";

/** The holds in order (TurfState.holds counts them), as the screens name them. */
export const TURF_HOLDS = ["legs", "fuse", "double"] as const;
export type TurfHold = (typeof TURF_HOLDS)[number];

/** The Turf as a battle starts (`fen`, the board then; `crowd`, the crowd's side): each side its first two ranks. */
export function newTurf(fen: string, crowd: Side): TurfState {
  let owner = "";
  for (let i = 0; i < 64; i++) {
    const rank = Math.floor(i / 8) + 1;
    const side: Side | null = rank <= 2 ? "w" : rank >= 7 ? "b" : null;
    owner += side === null ? "." : side === crowd ? "c" : "b";
  }
  return { owner, seen: fen.split(" ")[0]!, holds: 0, holdsAt: 0, hopAt: 0 };
}

/** Every piece that has come to a square since the last claim (`seen`) claims it for its side; `fen`: the board now. */
export function claimTurf(t: TurfState, fen: string, crowd: Side): TurfState {
  const placement = fen.split(" ")[0]!;
  if (placement === t.seen) return t;
  const was = gridOf(t.seen);
  const owner = [...t.owner];
  for (const [sq, c] of gridOf(placement)) if (was.get(sq) !== c) owner[turfIndex(sq)] = sideOf(c) === crowd ? "c" : "b";
  return { ...t, owner: owner.join(""), seen: placement };
}

/** How many squares carry `mark`. */
export function turfCount(owner: string, mark: TurfMark): number {
  let n = 0;
  for (const c of owner) if (c === mark) n++;
  return n;
}

/** The squares carrying `mark`, a1 first. */
export const turfSquares = (owner: string, mark: TurfMark): string[] => [...owner].flatMap((c, i) => (c === mark ? [turfSquare(i)] : []));

/** His holds for `his` squares: how many of turfHolds he has reached (0 to 3). */
export const holdsFor = (his: number, s: Pick<BossPowerSettings, "turfHolds"> = BOSS_POWERS): number => s.turfHolds.filter((n) => his >= n).length;

/** His Turf in a battle under way (null: none, as on a Battle Tower floor, another boss, or the battle over). */
export const turfOf = (boss: Pick<BossState, "id" | "powers" | "result"> | null | undefined): TurfState | null => (boss?.id === "hopper" && !boss.result ? (boss.powers?.turf ?? null) : null);

/**
 * His hold `level` (1 Long legs, 2 Short fuse, 3 Double hop) is on for the turn under way: his turn after the crowd move his holds
 * were set at (holdsAt), his move's aftermath, and the crowd's turn after it.
 */
export function holdOn(boss: Pick<BossState, "id" | "powers" | "result" | "crowdMoves"> | null | undefined, level: number): boolean {
  const t = turfOf(boss);
  return !!t && t.holds >= level && t.holdsAt === boss!.crowdMoves;
}

/** Short fuse: your move's clock (seconds) cut by turfFuseCut, never under turfFuseMin (nor above what it was); else `base`. */
export function fuseClock(boss: Pick<BossState, "id" | "powers" | "result" | "crowdMoves"> | null | undefined, base: number, s: Pick<BossPowerSettings, "turfFuseCut" | "turfFuseMin"> = BOSS_POWERS): number {
  if (!holdOn(boss, 2)) return base;
  return Math.min(base, Math.max(s.turfFuseMin, Math.round(base * (1 - s.turfFuseCut))));
}

/** Short fuse on Boss Battle's bank: the time your move adds (seconds) cut by turfFuseCut (to a tenth); else `base`. */
export function fuseIncrement(boss: Pick<BossState, "id" | "powers" | "result" | "crowdMoves"> | null | undefined, base: number, s: Pick<BossPowerSettings, "turfFuseCut"> = BOSS_POWERS): number {
  return holdOn(boss, 2) ? Math.round(base * (1 - s.turfFuseCut) * 10) / 10 : base;
}

/**
 * The hop-around he'd make now (`fen`, the board; `at`, the crowd move his turn came after): where he lands, an open empty square
 * (else one of yours), drawn from the battle's seed; and his empty squares he hops on first, the turfHops nearest it (ties by the
 * seed), the farthest first. Null: no square to land on.
 */
export function turfHopPick(t: Pick<TurfState, "owner">, fen: string, seed: number, at: number, s: Pick<BossPowerSettings, "turfHops"> = BOSS_POWERS): TurfHop | null {
  const g = gridOf(fen);
  const empty = (mark: TurfMark) => turfSquares(t.owner, mark).filter((sq) => !g.has(sq));
  const open = empty(".");
  const pool = open.length ? open : empty("c");
  if (!pool.length) return null;
  const to = pool[Math.floor(powerRoll(seed, "turf-hop", at) * pool.length)]!;
  const far = (sq: string) => Math.max(Math.abs(sq.charCodeAt(0) - to.charCodeAt(0)), Math.abs(Number(sq[1]) - Number(to[1])));
  const near = empty("b")
    .map((sq) => ({ sq, d: far(sq), tie: powerRoll(seed, "turf-near", at, sq) }))
    .sort((a, b) => a.d - b.d || a.tie - b.tie)
    .slice(0, s.turfHops)
    .reverse();
  return { at, hops: near.map((x) => x.sq), to };
}

// ---------------- Long legs ----------------

/** The legal step a Long legs move is played as on the board (the pawn goes on after it): the double step from the start, else one. */
export function legsPlay(move: string): string {
  const r0 = Number(move[1]);
  const r1 = Number(move[3]);
  const dir = Math.sign(r1 - r0);
  return `${move.slice(0, 2)}${move[0]}${r0 + (Math.abs(r1 - r0) - 1) * dir}`;
}

/**
 * The position after a Long legs move (`move`, from to: the crowd to move), or null when it isn't one: its first step (legsPlay)
 * legal, the pawn going on to an empty square, his king never attacked after it, never check (as the hop: nothing the crowd can't
 * answer), the en passant square cleared (no en passant from it), and the crowd left a move. One the engine plays.
 */
export function legsFen(fen: string, move: string): string | null {
  const play = legsPlay(move);
  let after: string;
  try {
    if (!legalMoves(fen).includes(play)) return null;
    after = applyMove(fen, play);
  } catch {
    return null;
  }
  const g = gridOf(after);
  const via = play.slice(2, 4);
  const to = move.slice(2, 4);
  const pawn = g.get(via);
  if (!pawn || pawn.toLowerCase() !== "p" || g.has(to)) return null;
  g.delete(via);
  g.set(to, pawn);
  const mover = sideOf(pawn);
  if (gridKingAttacked(g, mover) || gridKingAttacked(g, other(mover))) return null;
  const parts = editedFen(after, g).split(" ");
  parts[3] = "-";
  const out = parts.join(" ");
  try {
    if (gameEnd(out, []) || stockfishRefuses(out) || !legalMoves(out).length) return null;
  } catch {
    return null;
  }
  return out;
}

/**
 * His Long legs moves now (him, `boss`, to move in `fen`; never in check): each pawn of his 2 squares on from any square but its
 * start, 3 from its start, every square on the way empty (no capture that way), never onto your back rank (no promotion), each
 * one legsFen takes; written from to ("c3c5", "e7e4"), in square order.
 */
export function legsOptions(fen: string, boss: Side): string[] {
  try {
    if (sideToMove(fen) !== boss || inCheck(fen)) return [];
  } catch {
    return [];
  }
  const g = gridOf(fen);
  const dir = boss === "w" ? 1 : -1;
  const start = boss === "w" ? 2 : 7;
  const last = boss === "w" ? 8 : 1;
  const out: string[] = [];
  for (const [from, c] of [...g].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (c !== (boss === "w" ? "P" : "p")) continue;
    const r = Number(from[1]);
    const n = r === start ? 3 : 2;
    const end = r + n * dir;
    if (end < 1 || end > 8 || end === last) continue;
    let clear = true;
    for (let k = 1; k <= n; k++) if (g.has(`${from[0]}${r + k * dir}`)) clear = false;
    const move = `${from}${from[0]}${end}`;
    if (clear && legsFen(fen, move)) out.push(move);
  }
  return out;
}

/**
 * Which Long legs move he plays, from this device's engines (the host's online, solo's, the sims'): of `options` (checked against
 * legsOptions), the one whose position is best for him, as long as it costs him no more than turfLegsMaxLoss pawns against his
 * best ordinary move (each position searched at turfLegsNodes). Null: an ordinary move (his brain's, as ever).
 */
export async function legsFrom(engines: readonly EngineLike[], fen: string, options: readonly string[], s: Pick<BossPowerSettings, "turfLegsMaxLoss" | "turfLegsNodes" | "bouncePawnLogit"> = BOSS_POWERS): Promise<string | null> {
  const ok = options.filter((m) => legsOptions(fen, sideToMove(fen)).includes(m));
  if (!ok.length || !engines.length) return null;
  const fens = ok.map((m) => legsFen(fen, m)!);
  const [base, ...after] = await topEach(engines, [fen, ...fens], s.turfLegsNodes);
  if (!base) return null;
  const pick = ok
    .map((m, i) => ({ m, theirs: after[i] }))
    .filter((x) => x.theirs && x.theirs.mate === undefined)
    .map((x) => ({ m: x.m, his: 1 - x.theirs!.expected }))
    .sort((a, b) => b.his - a.his || (a.m < b.m ? -1 : 1))[0];
  if (!pick) return null;
  return (logit(base.expected) - logit(pick.his)) / s.bouncePawnLogit <= s.turfLegsMaxLoss + 1e-9 ? pick.m : null;
}
