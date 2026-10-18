/**
 * Alfil, the woolly mammoth (BOSS_ROSTER "alfil"; Eric, Oct 17): his rules. He's the chess bishop's ancestor: in old
 * Persian and Arabic chess the bishop's square held an elephant, the alfil.
 *
 * His passive, Tusks: at the start of his turn (his tusksFirst-th, then every tusksEvery), before his move, he marks two
 * of his pawns anywhere on the board (they glow; the engine's pick, tusksPairs). On the crowd's turn, taking either one
 * stops it. On his next turn, the fusion is his move: both are lifted off, an elephant (a bishop in every way) lands on
 * one of their two squares, the engine's pick (fuseFrom), and the crowd's turn begins (in check, it waits for his next
 * turn, the marks staying, and he answers the check with a move). At most tusksMax a battle. His elephants' squares are
 * tracked as they move, so the app can draw them with their own art.
 *
 * His ultimate, the Mammoth Slam: his rage meter full (its warning as a crowd turn begins), at the start of his turn,
 * two of the crowd's pawns and one of its knights or bishops fly up (never a queen, rook or king; fewer if it has fewer)
 * for slamTurns crowd turns, then land as the next begins, on their own squares (taken: the nearest empty square allowed:
 * a bishop on its color, a pawn never on the first or last rank, never giving check, never left hanging when another
 * square avoids it; landing). The engine picks the three so the hit is real but capped (slamFrom: it plays the turns
 * out and puts them down), and they come down early, at the start of his turn, when he has a mate in one only because
 * they're up. A Slam that lifts nothing keeps the meter and comes again on his next turn.
 *
 * Never an illegal position: the fusion never leaves his king attacked (the crowd moves next), gives check, leaves the
 * crowd without a move or ends the game (a dead draw), the lift never leaves the crowd's king in check or adds a check on
 * his, a landing never gives check or leaves the side to move without a move; and each is a base on the board (the
 * position changes outside a move). Numbers: BOSS_POWERS.tusks*, slam*. His art and moments are the app's
 * (characters/alfil.ts, components/Alfil.tsx), timed by ALFIL_BEATS.
 */
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type BossState, type SlamLanding, type SlamPiece } from "@chessroyale/core";
import { applyMove, gameEnd, legalMoves, mateInOne, sideToMove } from "../rules.ts";
import { stockfishRefuses } from "../uci.ts";
import { passTurn } from "./hollow.ts";
import type { BossAhead, EngineLike } from "../runner.ts";
import { bossPowers, eachOn, from, logit, meterFull, other, powerRoll, testSwitch, to, topEach, turnOf, unleashed, type Battle, type BossRules, type Side } from "./base.ts";
import { PIECE_VALUE, gridAttackers, gridHanging, gridKing, gridKingAttacked, gridOf, isLight, placementOf, sideOf, type Grid } from "./grid.ts";

/**
 * His moments, beat by beat (ms into each; nobody's clock runs), timed by his animations' cues (the app's alfil.ts:
 * its tests check each cue against these):
 *   tusks  the banner until `castAt`, when his trunk levels the ankus (his tusksCast's `cast`) and his two pawns start
 *          to glow; then his move.
 *   fuse   his two pawns glow; at `riseAt` they lift off toward the board's center (his tusksFuse's `rise`), at
 *          `flashAt` they meet in a ball of white light (its `flash`), and the elephant drops onto its square by
 *          `landAt`; then the crowd's turn.
 *   slam   the banner until `leapAt` (his mammothSlam's `leap`); at `slamAt` he crashes down and the board shakes (its
 *          `slam`); at `flyAt` the pieces fly up off their squares (its `fly`), gone by `goneAt`; at `shadowsAt` each
 *          square they'll land on shows its shadow (its `shadows`); then his move.
 *   land   the pieces drop out of the sky one after another, `stagger` apart, each `fallMs` onto its own square (a
 *          piece whose own square was taken then slides `slideMs` onto the square it landed on).
 */
export const ALFIL_BEATS = {
  tusks: { castAt: 1500, total: 2300 },
  fuse: { riseAt: 400, flashAt: 900, landAt: 1400, total: 2100 },
  slam: { leapAt: 1500, slamAt: 1860, flyAt: 2000, goneAt: 2600, shadowsAt: 2210, total: 3000 },
  land: { stagger: 200, fallMs: 450, slideMs: 300, total: 1500 },
} as const;

/**
 * How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts): the cast and the Slam at the start
 * of his turn (each its own screen, then his move), the fusion (his move) and the landing as a crowd turn begins (or
 * the landing at the start of his turn, early).
 */
export const ALFIL_FX = { tusks: ALFIL_BEATS.tusks.total, fuse: ALFIL_BEATS.fuse.total, slam: ALFIL_BEATS.slam.total, land: ALFIL_BEATS.land.total } as const;

/** What his turn begins with: the Mammoth Slam, the fusion of his last cast (his move: his turn ends with it), or a new cast (then his move). */
export type AlfilStep = "fuse" | "tusks" | "slam";

const rank = (sq: string) => Number(sq[1]);
const file = (sq: string) => sq.charCodeAt(0) - 97;
const square = (f: number, r: number) => `${"abcdefgh"[f]}${r}`;
const letter = (side: Side, type: string) => (side === "w" ? type.toUpperCase() : type.toLowerCase());
const SQUARES = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((r) => [0, 1, 2, 3, 4, 5, 6, 7].map((f) => square(f, r)));

/** His turn now (him to move): his turns so far in the battle (his moves, and his fusions: each was his move), plus one. */
export const hisTurn = (boss: Pick<BossState, "crowdMoves" | "startPly"> & { powers?: Pick<BossPowerState, "fused"> | null }, plies: number): number =>
  plies - (boss.startPly ?? 0) - boss.crowdMoves + 1 + (boss.powers?.fused ?? 0);

/**
 * A position with pieces taken off or put on between moves (`g`, the side to move as in `fen`): castling rights only
 * while their king and rook stand (these powers never move either, but it costs nothing), the en passant square only
 * while it and the square behind it are empty (a piece landed on either: Stockfish drops the square then, chess.js
 * doesn't, and the two must agree on the moves), the pawn that made its double step is there and one of the side to
 * move's pawns can take it, and the fifty-move count from zero (as after a capture).
 */
export function editedFen(fen: string, g: Grid): string {
  const parts = fen.split(" ");
  parts[0] = placementOf(g);
  const corner: Record<string, [string, string, string, string]> = { K: ["e1", "K", "h1", "R"], Q: ["e1", "K", "a1", "R"], k: ["e8", "k", "h8", "r"], q: ["e8", "k", "a8", "r"] };
  parts[2] = [...(parts[2] ?? "-")].filter((c) => corner[c] && g.get(corner[c]![0]) === corner[c]![1] && g.get(corner[c]![2]) === corner[c]![3]).join("") || "-";
  const ep = parts[3] ?? "-";
  if (ep !== "-") {
    const mover: Side = sideToMove(fen);
    const pawn = square(file(ep), mover === "w" ? 5 : 4);
    // (Behind it: the square the pawn's double step started from.)
    const behind = square(file(ep), mover === "w" ? 7 : 2);
    const takers = [file(ep) - 1, file(ep) + 1].filter((f) => f >= 0 && f < 8).map((f) => square(f, mover === "w" ? 5 : 4));
    if (g.has(ep) || g.has(behind) || g.get(pawn) !== letter(other(mover), "p") || !takers.some((sq) => g.get(sq) === letter(mover, "p"))) parts[3] = "-";
  }
  if (parts[4]) parts[4] = "0";
  return parts.join(" ");
}

/** The side to move has a legal move (the position is one a game can go on from). */
function hasMove(fen: string): boolean {
  try {
    return legalMoves(fen).length > 0;
  } catch {
    return false;
  }
}

/** A piece on `sq` would hang: attacked by a cheaper piece, or attacked and not defended (Big Boy's bounce's rule). */
function hangs(g: Grid, sq: string): boolean {
  const c = g.get(sq);
  if (!c) return false;
  const side = sideOf(c);
  const att = gridAttackers(g, sq, other(side));
  if (!att.length) return false;
  const v = PIECE_VALUE[c.toLowerCase()]!;
  return att.some((a) => PIECE_VALUE[g.get(a)!.toLowerCase()]! < v) || !gridAttackers(g, sq, side).length;
}

// ---------------- Tusks: the cast ----------------

/**
 * His position with the two pawns lifted off and the elephant on `at` (one of their squares), the crowd to move (the
 * fusion is his move), or null when that isn't allowed: one isn't his pawn now, his king is attacked after it (a pawn
 * that blocked a check, or a check he was already in: a move must leave his king safe; alfilBattle.step waits for a
 * turn he isn't in check), the elephant gives check (as no power's piece ever lands giving one), it leaves more of the
 * crowd's material hanging than before (my call, Big Boy's bounce's rule, as Sawyer's split never lands attacking a
 * piece: the crowd sees the pawns glow but not the square, so a fork it couldn't see coming would win material at once,
 * far more than the fusion's point), the crowd would have no move (mate or stalemate by a power), it ends the game (a
 * dead draw: two pawns made a lone bishop against a lone king, or bishops all on one color), or the engine would
 * refuse it.
 */
export function fusedFen(fen: string, pawns: readonly string[], at: string, boss: Side): string | null {
  const g = fusedGrid(gridOf(fen), pawns, at, boss);
  if (!g) return null;
  // (passTurn: null when his king is in check or the crowd has no move.)
  const out = passTurn(editedFen(fen, g));
  return out && !gameEnd(out, []) && !stockfishRefuses(out) ? out : null;
}

/** fusedFen's board alone (the checks a board can answer by itself, without a chess.js board): null when not allowed. */
function fusedGrid(g0: Grid, pawns: readonly string[], at: string, boss: Side): Grid | null {
  if (pawns.length !== 2 || !pawns.includes(at) || pawns.some((sq) => g0.get(sq) !== letter(boss, "p"))) return null;
  const g = new Map(g0);
  for (const sq of pawns) g.delete(sq);
  g.set(at, letter(boss, "b"));
  if (gridKingAttacked(g, boss) || gridKingAttacked(g, other(boss))) return null;
  if (gridHanging(g, other(boss)) > gridHanging(g0, other(boss))) return null;
  return g;
}

/** What one of his pawns is worth to him beyond a pawn: passed (no crowd pawn ahead on its file or the next), or his king's shield. */
function pawnCost(g: Grid, sq: string, boss: Side): number {
  const ahead = (r: number) => (boss === "w" ? r > rank(sq) : r < rank(sq));
  let passed = true;
  for (const [s, c] of g) if (c === letter(other(boss), "p") && Math.abs(file(s) - file(sq)) <= 1 && ahead(rank(s))) passed = false;
  const king = gridKing(g, boss);
  const shield = !!king && Math.abs(file(king) - file(sq)) <= 1 && (boss === "w" ? rank(sq) - rank(king) : rank(king) - rank(sq)) >= 1 && Math.abs(rank(sq) - rank(king)) <= 2;
  return (passed ? 2 : 0) + (shield ? 2 : 0);
}

/** One pair his cast could mark, and its fusion's ways to go now (as if it fused at once: what the engine weighs). */
export interface TusksPair {
  pawns: string[];
  options: { at: string; fen: string }[];
}

/**
 * The pairs his cast weighs (Eric: "the engine picks the pair that helps him most"): of his pawns' pairs whose fusion
 * would be allowed now (fusedFen, on either square), those giving up neither a passed pawn of his nor his king's shield
 * first, seeded among equals; tusksLooks of them. The engine picks one by their ways to go now, as for the fusion
 * (fuseFrom: the one best for him). The crowd can take one on its turn: that isn't avoided (the counter is part of the
 * power). Pure: the server, the host and solo work out the same list. Empty: no cast (fewer than two pawns, or no pair
 * allowed).
 */
export function tusksPairs(fen: string, boss: Side, seed: number, turn: number, s: Pick<BossPowerSettings, "tusksLooks"> = BOSS_POWERS): TusksPair[] {
  const g = gridOf(fen);
  const pawns = [...g].filter(([, c]) => c === letter(boss, "p")).map(([sq]) => sq).sort();
  const pairs: { pawns: string[]; cost: number; roll: number }[] = [];
  for (let i = 0; i < pawns.length; i++)
    for (let j = i + 1; j < pawns.length; j++) {
      const pair = [pawns[i]!, pawns[j]!];
      if (pair.some((at) => fusedGrid(g, pair, at, boss))) pairs.push({ pawns: pair, cost: pawnCost(g, pair[0]!, boss) + pawnCost(g, pair[1]!, boss), roll: powerRoll(seed, "tusks", turn, pair.join()) });
    }
  // (In order; the full check, a chess.js board each, only until enough pass.)
  const out: TusksPair[] = [];
  for (const p of pairs.sort((a, b) => a.cost - b.cost || a.roll - b.roll)) {
    if (out.length >= s.tusksLooks) break;
    const options = fusionOptions(fen, p.pawns, boss);
    if (options.length) out.push({ pawns: p.pawns, options });
  }
  return out;
}

/** The pair a cast marks: the one with the engine's pick among its ways to go; no pick (no engine's answer), the first. */
export const castPick = (pairs: readonly TusksPair[], pick: string | null): string[] | null =>
  (pairs.find((p) => p.options.some((o) => o.fen === pick)) ?? pairs[0])?.pawns ?? null;

/**
 * Squares that travel with their pieces through a move (`fen`: the position after it): the piece that moved takes its
 * square along; one taken (en passant too) or no longer what `keep` wants (a pawn promoted) is dropped. Pure, as
 * Sawyer's halves.
 */
export function followSquares(squares: readonly string[], move: string, fen: string, keep: string): string[] {
  const g = gridOf(fen);
  return squares.flatMap((sq) => {
    const now = sq === from(move) ? to(move) : sq;
    return g.get(now) === keep ? [now] : [];
  });
}

// ---------------- Tusks: the fusion ----------------

/** The fusion's ways to go now, as his move: the elephant on either pawn's square, where it's allowed (fusedFen). */
export function fusionOptions(fen: string, pawns: readonly string[], boss: Side): { at: string; fen: string }[] {
  return [...pawns].sort().flatMap((at) => {
    const f = fusedFen(fen, pawns, at, boss);
    return f ? [{ at, fen: f }] : [];
  });
}

/**
 * A way to go as the engine scored it: his expected score there (the crowd to move), and what the fusion gains him in
 * pawns (log-odds, bouncePawnLogit; for the sims: a measure that tops out).
 */
export interface FusionScore {
  fen: string;
  expected: number;
  gain: number;
}

/**
 * The fusion's square, or the cast's pair (Eric: "whichever the engine prefers"; "the engine picks the pair that helps
 * him most"): of the ways to go, the one best for him (his expected score; equals in the order given: the pairs' order,
 * then the squares'). Null: none. Unbounded, as the sheet has it: the first build's cap ("about 1 point") read
 * Stockfish's verdict, which puts nearly every fusion in a balanced game at a won one, so it stopped most fusions
 * (docs/decisions/2026-10-17-alfil-rules.md). Only the ways fusedFen allows are weighed.
 */
export function pickFusion(scored: readonly FusionScore[]): { fen: string; gain: number } | null {
  let pick: FusionScore | null = null;
  for (const c of scored) if (!pick || c.expected > pick.expected) pick = c;
  return pick ? { fen: pick.fen, gain: Math.round(pick.gain * 100) / 100 } : null;
}

/**
 * The engine's pick of the fusion's square (or the cast's pair), from this device's engines (the host's online,
 * solo's): the position before it (him to move) and each way to go (the crowd to move: his score is the rest) searched
 * at tusksNodes, shared out over the engines, then pickFusion. Null: no engine (the fusion then takes the first way
 * allowed; the cast, the first pair). `ahead` (the fusion only: the Slam's pieces land as the crowd's turn after it
 * begins, slamAhead): each way to go is searched with them down, as for his move (the landing guard); the pick is still
 * one of `candidates`.
 */
export async function fuseFrom(
  engines: readonly EngineLike[],
  fen: string,
  candidates: readonly string[],
  s: Pick<BossPowerSettings, "tusksNodes" | "bouncePawnLogit"> = BOSS_POWERS,
  ahead: ((fen: string) => string) | null = null,
): Promise<{ fen: string; gain: number } | null> {
  if (!candidates.length || !engines.length) return null;
  const [before, ...after] = await topEach(engines, [fen, ...candidates.map((c) => (ahead ? ahead(c) : c))], s.tusksNodes);
  if (!before) return null;
  const scored = candidates.flatMap((c, i) => {
    const m = after[i];
    return m ? [{ fen: c, expected: 1 - m.expected, gain: (logit(1 - m.expected) - logit(before.expected)) / s.bouncePawnLogit }] : [];
  });
  return pickFusion(scored);
}

// ---------------- The Mammoth Slam ----------------

/** One of the Slam's lifts: the position with the pieces up (him to move), and the pieces. */
export interface SlamCandidate {
  fen: string;
  pieces: SlamPiece[];
}

const choose = <T>(xs: readonly T[], k: number): T[][] => (k === 0 ? [[]] : xs.flatMap((x, i) => choose(xs.slice(i + 1), k - 1).map((rest) => [x, ...rest])));

/**
 * The Mammoth Slam's lifts to weigh, from the seed: slamPawns of the crowd's pawns and slamMinors of its knights or
 * bishops (fewer if it has fewer; never a queen, rook or king), every way of choosing them, less any whose lift would
 * leave the crowd's king in check (a blocker: it's his move) or give his a new check (a line opened onto it: a check
 * he's already in, from the crowd's last move, doesn't stop the Slam); none of the full count left, fewer (a minor
 * less, then a pawn less). Those leaving the least of the crowd's material hanging first (he'd simply take it), seeded
 * among equals; slamLooks of them. Pure: the server, the host and solo work out the same list.
 */
export function slamCandidates(fen: string, crowd: Side, seed: number, at: number, s: Pick<BossPowerSettings, "slamPawns" | "slamMinors" | "slamLooks"> = BOSS_POWERS): SlamCandidate[] {
  const g0 = gridOf(fen);
  const mine = [...g0].filter(([, c]) => sideOf(c) === crowd);
  const pawns = mine.filter(([, c]) => c.toLowerCase() === "p").map(([sq]) => sq).sort();
  const minors = mine.filter(([, c]) => "nb".includes(c.toLowerCase())).map(([sq]) => sq).sort();
  const hung = gridHanging(g0, crowd);
  // (His king's attackers now: a lift may leave a check he's in, or take its piece up, but never add one.)
  const hisKing = gridKing(g0, other(crowd));
  const checkers = hisKing ? gridAttackers(g0, hisKing, crowd) : [];
  const opensCheck = (g: Grid) => !!hisKing && gridAttackers(g, hisKing, crowd).some((sq) => !checkers.includes(sq));
  const all: { g: Grid; lift: string[]; hang: number; roll: number }[] = [];
  // (The full count where it can; where none of those can go (a lone minor that blocks a check), fewer: a minor less
  // first, then a pawn less.)
  for (let size = Math.min(s.slamPawns, pawns.length) + Math.min(s.slamMinors, minors.length); size > 0 && !all.length; size--)
    for (let nm = Math.min(s.slamMinors, minors.length, size); nm >= 0 && !all.length; nm--) {
      const np = size - nm;
      if (np > Math.min(s.slamPawns, pawns.length)) continue;
      for (const ps of choose(pawns, np))
        for (const ms of choose(minors, nm)) {
          const lift = [...ps, ...ms];
          const g = new Map(g0);
          for (const sq of lift) g.delete(sq);
          if (gridKingAttacked(g, crowd) || opensCheck(g)) continue;
          all.push({ g, lift, hang: gridHanging(g, crowd) - hung, roll: powerRoll(seed, "slam", at, lift.join()) });
        }
    }
  const out: SlamCandidate[] = [];
  // (The engine's own checks only on the ones taken, in order: a chess.js board each.)
  for (const c of all.sort((a, b) => a.hang - b.hang || a.roll - b.roll)) {
    if (out.length >= s.slamLooks) break;
    const f = editedFen(fen, c.g);
    if (!stockfishRefuses(f) && hasMove(f)) out.push({ fen: f, pieces: c.lift.map((sq) => ({ piece: g0.get(sq)!.toLowerCase(), square: sq })) });
  }
  return out;
}

/** The pieces a lift took off (the crowd's in `before`, gone in `after`), in square order. */
export function liftedPieces(before: string, after: string, crowd: Side): SlamPiece[] {
  const a = gridOf(before);
  const b = gridOf(after);
  return [...a].filter(([sq, c]) => sideOf(c) === crowd && b.get(sq) !== c).map(([sq, c]) => ({ piece: c.toLowerCase(), square: sq })).sort((x, y) => (x.square < y.square ? -1 : 1));
}

/**
 * Where the Slam's pieces land, in `fen` (as it is now, the crowd's or his move): each on its own square when it's empty
 * and allowed (Eric's predictable option); taken, the nearest empty square allowed (king steps, then straight-line
 * steps, then square order) that it isn't left hanging on, else the nearest allowed. Allowed: a bishop on its color, a
 * pawn never on the first or last rank, never giving check, and the side to move still has a move. The ones whose own
 * square is free land first; one with nowhere at all stays up (`stuck`: a board too full, it tries again a turn later).
 */
export function landing(fen: string, pieces: readonly SlamPiece[], crowd: Side): { fen: string; landed: SlamLanding["pieces"]; stuck: SlamPiece[] } {
  const g = gridOf(fen);
  const landed: SlamLanding["pieces"] = [];
  const stuck: SlamPiece[] = [];
  const order = [...pieces].sort((a, b) => Number(g.has(a.square)) - Number(g.has(b.square)));
  for (const pc of order) {
    const near = (sq: string) => Math.max(Math.abs(file(sq) - file(pc.square)), Math.abs(rank(sq) - rank(pc.square))) * 16 + Math.abs(file(sq) - file(pc.square)) + Math.abs(rank(sq) - rank(pc.square));
    // (A bishop on its own color; nearest first, then square order.)
    const squares = SQUARES.filter((sq) => pc.piece !== "b" || isLight(sq) === isLight(pc.square)).sort((a, b) => near(a) - near(b) || (a < b ? -1 : 1));
    const pick = putDown(g, fen, letter(crowd, pc.piece), squares, pc.square);
    if (!pick) {
      stuck.push(pc);
      continue;
    }
    landed.push({ piece: pc.piece, from: pc.square, to: pick });
  }
  return { fen: landed.length ? editedFen(fen, g) : fen, landed, stuck };
}

/**
 * One piece (`c`, a FEN letter) put down on `g` (changed in place), as the Slam's pieces land (landing) and Chub &
 * Chirp's prize pieces go on (carrots.ts): of `order` (the squares in the order wanted), those allowed (empty; a pawn
 * never on the first or last rank; never attacking the other side's king: no power's piece lands giving check), `first`
 * if it's one of them, then those it isn't left hanging on, then the rest, each checked for a move left to the side to
 * move in `fen`. Returns its square; null: nowhere (nothing put down).
 */
export function putDown(g: Grid, fen: string, c: string, order: readonly string[], first: string | null = null): string | null {
  const side = sideOf(c);
  const king = gridKing(g, other(side));
  const allowed = (sq: string): boolean => {
    if (g.has(sq) || (c.toLowerCase() === "p" && (rank(sq) === 1 || rank(sq) === 8))) return false;
    g.set(sq, c);
    const ok = !(king && gridAttackers(g, king, side).includes(sq));
    g.delete(sq);
    return ok;
  };
  const tries = order.filter(allowed);
  const home = first !== null && tries.includes(first) ? [first] : [];
  const safe = tries.filter((sq) => {
    g.set(sq, c);
    const h = hangs(g, sq);
    g.delete(sq);
    return !h;
  });
  // (Its first square if it can; else safe squares first, then the rest; each checked for a move left to the side to move.)
  const pick = [...home, ...safe, ...tries].find((sq) => {
    g.set(sq, c);
    const ok = hasMove(editedFen(fen, g));
    g.delete(sq);
    return ok;
  });
  if (!pick) return null;
  g.set(pick, c);
  return pick;
}

/** A candidate's outcome as the engine played it out: the crowd's expected score once they're down (crowd to move), or a mate against it on the way. */
export interface PlayedOut {
  fen: string;
  crowd: number;
  mate?: true;
}

/**
 * The turns the Slam's pieces are up, played out by the engine (its best for both sides, slamLineNodes a search, each
 * search's reply taken as the next move): his move, then the crowd's and his, slamTurns times; then they land (landing)
 * and the position is searched (slamNodes). A mate against the crowd anywhere on the way: `mate`. Null: no engine answer.
 */
async function playOut(engine: EngineLike, c: SlamCandidate, crowd: Side, s: Pick<BossPowerSettings, "slamTurns" | "slamLineNodes" | "slamNodes">): Promise<PlayedOut | null> {
  const search = async (fen: string, nodes: number) => (await (engine.topMovesAt ? engine.topMovesAt(fen, 1, nodes) : engine.topMoves(fen, 1)))[0];
  const ended = (fen: string): PlayedOut | null => {
    const end = gameEnd(fen, []);
    if (end === "checkmate") return sideToMove(fen) === crowd ? { fen: c.fen, crowd: 0, mate: true } : { fen: c.fen, crowd: 1 };
    return end ? { fen: c.fen, crowd: 0.5 } : null;
  };
  let fen = c.fen;
  for (let plies = 0; plies < 2 * s.slamTurns + 1; ) {
    const over = ended(fen);
    if (over) return over;
    const top = await search(fen, s.slamLineNodes);
    if (!top) return null;
    if (top.mate !== undefined && (sideToMove(fen) === crowd) === top.mate < 0) return { fen: c.fen, crowd: 0, mate: true };
    fen = applyMove(fen, top.move);
    plies++;
    if (top.reply && plies < 2 * s.slamTurns + 1 && !ended(fen)) {
      try {
        fen = applyMove(fen, top.reply);
        plies++;
      } catch {
        // (A reply the line no longer has: searched again.)
      }
    }
  }
  const down = landing(fen, c.pieces, crowd).fen;
  const over = ended(down);
  if (over) return over;
  const end = await search(down, s.slamNodes);
  if (!end) return null;
  if (end.mate !== undefined && end.mate < 0) return { fen: c.fen, crowd: 0, mate: true };
  return { fen: c.fen, crowd: end.expected };
}

/** How many pawns worse the crowd is (its expected score `before`, then `after`), by bouncePawnLogit (log-odds a pawn). */
export const slamPawnsLost = (before: number, after: number, s: Pick<BossPowerSettings, "bouncePawnLogit"> = BOSS_POWERS): number => (logit(before) - logit(after)) / s.bouncePawnLogit;

/**
 * The Slam's pick (Eric: "the hit is real but recoverable, with a cap on how much it can swing the game"), from the
 * crowd's expected score before it (him to move) and each candidate's played out: the loss in pawns nearest slamTarget
 * inside slamLoss; none inside, the nearest below it (the smallest step short of the band, a lift that helped the crowd
 * included); never past the cap, never a line with a mate against the crowd. Null: nothing lifts.
 */
export function pickSlam(before: number, scored: readonly PlayedOut[], s: Pick<BossPowerSettings, "slamLoss" | "slamTarget" | "bouncePawnLogit"> = BOSS_POWERS): { fen: string; loss: number } | null {
  const [lo, hi] = s.slamLoss;
  const ok = scored.filter((c) => !c.mate).map((c) => ({ fen: c.fen, loss: slamPawnsLost(before, c.crowd, s) })).filter((c) => c.loss <= hi + 1e-9);
  const inBand = ok.filter((c) => c.loss >= lo - 1e-9);
  const pick = inBand.length
    ? [...inBand].sort((a, b) => Math.abs(a.loss - s.slamTarget) - Math.abs(b.loss - s.slamTarget) || (a.fen < b.fen ? -1 : 1))[0]
    : [...ok].sort((a, b) => b.loss - a.loss || (a.fen < b.fen ? -1 : 1))[0];
  return pick ? { fen: pick.fen, loss: Math.round(pick.loss * 100) / 100 } : null;
}

/**
 * Alfil's Mammoth Slam from this device's engines (the host's online, solo's): the position before searched (slamNodes),
 * each candidate played out (playOut), shared out over the engines, then pickSlam. Null (nothing lifts): no candidate
 * within the cap, or no engine.
 */
export async function slamFrom(
  engines: readonly EngineLike[],
  fen: string,
  candidates: readonly string[],
  s: Pick<BossPowerSettings, "slamTurns" | "slamLineNodes" | "slamNodes" | "slamLoss" | "slamTarget" | "bouncePawnLogit"> = BOSS_POWERS,
): Promise<{ fen: string; loss: number } | null> {
  const scored = await slamScores(engines, fen, candidates, s);
  return scored ? pickSlam(scored.before, scored.outs, s) : null;
}

/** slamFrom's searches: the crowd's expected score before (him to move) and each candidate's played out (the sims read them too). */
export async function slamScores(
  engines: readonly EngineLike[],
  fen: string,
  candidates: readonly string[],
  s: Pick<BossPowerSettings, "slamTurns" | "slamLineNodes" | "slamNodes"> = BOSS_POWERS,
): Promise<{ before: number; outs: PlayedOut[] } | null> {
  if (!candidates.length || !engines.length) return null;
  const crowd = other(sideToMove(fen));
  const [top] = await topEach(engines, [fen], s.slamNodes);
  if (!top) return null;
  const outs = await eachOn(engines, candidates, (e, c) => playOut(e, { fen: c, pieces: liftedPieces(fen, c, crowd) }, crowd, s));
  return { before: 1 - top.expected, outs: outs.filter((o): o is PlayedOut => !!o) };
}

/**
 * The Slam is due: the start of his turn (the crowd has just moved) from the turn the meter warned, or after the test
 * trigger, until one lifts something (one that lifts nothing keeps the meter and comes again on his next turn:
 * `slamWait`); none in the air and none under way.
 */
export const slamDue = (boss: BossState | null | undefined): boolean => {
  const p = boss?.powers;
  return (
    !!p &&
    !boss!.result &&
    bossPowers(boss)?.ultimate === "slam" &&
    p.ultAt === undefined &&
    !p.airborne?.length &&
    p.slamWait !== boss!.crowdMoves &&
    (!!p.ultNext || (p.warnAt !== undefined && p.warnAt <= boss!.crowdMoves))
  );
};

/**
 * The Slam's pieces that land as the crowd's turn after his move now (or his fusion) begins: it's the turn they're due
 * (landDue), so his move is judged with them down (the landing guard: slamAhead). Null: none up, or not due yet. On the
 * turn of the Slam itself they're three turns off, so only his move just before they land is judged this way: before
 * that he moves again first, and judging those moves as if they were down would throw away what the Slam gave him.
 */
export function landsAfterHisMove(boss: BossState | null | undefined): SlamPiece[] | null {
  const p = boss?.powers;
  if (!boss || boss.result || !p?.airborne?.length || !p.slam) return null;
  return p.slam.lands <= turnOf(boss) ? p.airborne : null;
}

/**
 * The landing guard's look ahead (BossAhead, bossMoveFrom's) for pieces that land as the crowd's turn after his move
 * begins: the position after his move (the crowd to move), with them down where the rules will put them (landing: each
 * on its own square, or the nearest allowed when it's taken, which can depend on his move), slamGuardLooks of his top
 * moves weighed with his pick, each searched at slamGuardNodes.
 */
export function slamAhead(pieces: readonly SlamPiece[], s: Pick<BossPowerSettings, "slamGuardLooks" | "slamGuardNodes"> = BOSS_POWERS): BossAhead {
  return { after: (fen) => landing(fen, pieces, sideToMove(fen)).fen, looks: s.slamGuardLooks, nodes: s.slamGuardNodes };
}

/** The pieces in the air as the screens show them: each with the crowd turn it lands, the turns left, and its shadow's size (1 to slamTurns). */
export function airborneView(p: Pick<BossPowerState, "airborne" | "slam" | "turn">, s: Pick<BossPowerSettings, "slamTurns"> = BOSS_POWERS): { piece: string; square: string; lands: number; left: number; stage: number }[] {
  if (!p.airborne?.length || !p.slam) return [];
  // (Crowd turns left, counting this one; on his own turn, the one just played; on the Slam's turn, all of them.)
  const left = Math.max(0, p.slam.lands - Math.max(p.turn, p.slam.at + 1));
  const stage = Math.min(s.slamTurns, Math.max(1, s.slamTurns + 1 - left));
  return p.airborne.map((x) => ({ ...x, lands: p.slam!.lands, left, stage }));
}

// ---------------- His rules ----------------

/** Alfil: Tusks (his pawns fuse into elephants) and the Mammoth Slam (the crowd's pieces up for three turns). */
export const ALFIL: BossRules = {
  id: "alfil",
  ultimateOnHisTurn: true,
  // The Mammoth Slam: the meter full as a turn begins, its warning ("RAGE!") that turn; it comes at the start of his
  // turn, after the crowd's move (slamDue). The test switch: warned as the second turn begins. The trigger (`ultNext`,
  // kept): at the start of his next turn, without the warning.
  ultimate(next, t) {
    if (next.warnAt === undefined && !t.ultNext && (meterFull(next, t) || testSwitch(t, next))) {
      next.warnAt = t.turn;
      t.events.push({ kind: "warn", turn: t.turn });
    }
    return false;
  },
  // The Slam runs (the meter held empty, no other ultimate) while its pieces are up.
  ultimateRunning: (p) => !!p.airborne?.length,
  // As a crowd turn begins: his fusion, when it was his move just now (alfilBattle.apply), and the landing (after his
  // move or fusion: alfilBattle.landDue).
  everyTurn(next, t) {
    const f = next.fusion;
    if (f?.to && f.at + 1 === t.turn) t.events.push({ kind: "fuse", turn: t.turn, squares: [...f.from], square: f.to });
    if (next.landed && !next.landed.early && next.landed.turn === t.turn) t.events.push({ kind: "land", turn: t.turn, squares: next.landed.pieces.map((x) => x.to) });
  },
  // (Tusks comes at the start of his turn, before his move: alfilBattle.)
  passive() {},
  // A turn with his pawns marked, or the crowd's pieces up: its picks don't count for fair play.
  powerTurn: (boss) => !!boss.powers!.tusks || !!boss.powers!.airborne?.length,
  afterCrowdMove(b, move) {
    if (move) alfilBattle.afterCrowdMove(b, move);
  },
  afterBossMove(b, move) {
    alfilBattle.afterHisMove(b, move);
  },
  view: (p) => ({
    tusks: p.tusks ? { ...p.tusks, pawns: [...p.tusks.pawns] } : null,
    fusion: p.fusion ?? null,
    elephants: [...(p.elephants ?? [])],
    slam: p.slam ?? null,
    airborne: airborneView(p),
    landed: p.landed ?? null,
  }),
};

// ---------------- His part in the match runner ----------------

/** The battle's board (its one board). */
const boardOf = (b: Battle) => b.boards.get(b.state.boards[0]!)!;

/** The position changes outside a move: a base on the board at its ply (every replay plays from it). */
function setBase(b: Battle, fen: string): void {
  const id = b.state.boards[0]!;
  const board = b.boards.get(id)!;
  const ply = board.history.length;
  b.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen }] });
}

/** His powers' state, changed (the match's state replaced, as everywhere). */
const setPowers = (b: Battle, change: (p: BossPowerState) => BossPowerState): void => {
  const boss = b.state.boss!;
  b.state = { ...b.state, boss: { ...boss, powers: change(boss.powers!) } };
};

/** The Slam's lifts now, worked out once per position (the pick is checked against the same list). */
function slamList(b: Battle): SlamCandidate[] {
  const boss = b.state.boss!;
  const fen = boardOf(b).fen;
  const key = `${fen}|${boss.crowdMoves}|${boss.powers!.seed}`;
  const memo = b.memo.get("slam") as { key: string; list: SlamCandidate[] } | undefined;
  if (memo?.key === key) return memo.list;
  const list = slamCandidates(fen, boss.crowdSide, boss.powers!.seed, boss.crowdMoves);
  b.memo.set("slam", { key, list });
  return list;
}

/** The pairs his cast weighs now (tusksPairs), worked out once per position (the pick is checked against the same list). */
function castPairs(b: Battle, turn: number): TusksPair[] {
  const boss = b.state.boss!;
  const fen = boardOf(b).fen;
  const key = `${fen}|${turn}|${boss.powers!.seed}`;
  const memo = b.memo.get("tusks") as { key: string; pairs: TusksPair[] } | undefined;
  if (memo?.key === key) return memo.pairs;
  const pairs = tusksPairs(fen, other(boss.crowdSide), boss.powers!.seed, turn);
  b.memo.set("tusks", { key, pairs });
  return pairs;
}

/** The next cast's turn and gap (the test switch, ?power=tusks: from his first turn, every other). */
const tusksSchedule = (b: Battle, s: Pick<BossPowerSettings, "tusksFirst" | "tusksEvery">) => (b.settings.bossPowerTest === "tusks" ? { first: 1, every: 2 } : { first: s.tusksFirst, every: s.tusksEvery });

export const alfilBattle = {
  /**
   * What his turn begins with now, in this order: the Mammoth Slam (slamDue: before anything else of his that turn),
   * the fusion of his last cast (his move: his turn ends with it, unless it fails; in check, it waits, the marks staying,
   * and he answers the check with a move: no fusion can), a new cast (his turn from tusksFirst, every tusksEvery, at
   * most tusksMax elephants; then his move). Null: nothing (or it isn't his turn). Each is done once (its state moves
   * on), so his turn can begin with more than one.
   */
  step(b: Battle, s: BossPowerSettings = BOSS_POWERS): AlfilStep | null {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "alfil" || boss.result || !b.bossToMove() || b.finalGameOver()) return null;
    if (slamDue(boss)) return "slam";
    const turn = hisTurn(boss, boardOf(b).history.length);
    // (In check, no fusion can answer it: neither the fusion nor a cast, which weighs fusions as if they came now.)
    const checked = gridKingAttacked(gridOf(boardOf(b).fen), other(boss.crowdSide));
    if (p.tusks) return p.tusks.turn < turn && !checked ? "fuse" : null;
    const { first } = tusksSchedule(b, s);
    if (!checked && (p.fused ?? 0) < s.tusksMax && turn >= (p.tusksNext ?? first) && castPairs(b, turn).length) return "tusks";
    return null;
  },

  /** The positions the step's engine pick weighs: the cast's pairs' ways to go (as if they fused now), the fusion's, or the Slam's lifts. */
  candidates(b: Battle): string[] {
    const step = alfilBattle.step(b);
    const boss = b.state.boss!;
    if (step === "tusks") return castPairs(b, hisTurn(boss, boardOf(b).history.length)).flatMap((p) => p.options.map((o) => o.fen));
    if (step === "fuse") return fusionOptions(boardOf(b).fen, boss.powers!.tusks!.pawns, other(boss.crowdSide)).map((o) => o.fen);
    if (step === "slam") return slamList(b).map((c) => c.fen);
    return [];
  },

  /** The step needs an engine: a cast or a fusion with a choice (more than one way to go), or a Slam with a lift to weigh (its cap). */
  needsEngine(b: Battle): boolean {
    const step = alfilBattle.step(b);
    const n = alfilBattle.candidates(b).length;
    return step === "slam" ? n > 0 : n > 1;
  },

  /**
   * The step, from this device's engines (solo, the sims): the fusion's square (fuseFrom; with the Slam's pieces down
   * when they land as the crowd's turn after it begins: fusionAhead), the Slam's lift (slamFrom). Returns what apply
   * returns: the step done, or null when nothing came of it.
   */
  async play(b: Battle, engines: readonly EngineLike[]): Promise<AlfilStep | null> {
    const step = alfilBattle.step(b);
    if (!step) return null;
    const candidates = alfilBattle.candidates(b);
    if (step === "slam") {
      const pick = await slamFrom(engines, boardOf(b).fen, candidates);
      return alfilBattle.apply(b, pick?.fen ?? null, pick?.loss ?? null, step);
    }
    return alfilBattle.apply(b, (await fuseFrom(engines, boardOf(b).fen, candidates, undefined, alfilBattle.fusionAhead(b)))?.fen ?? null, null, step);
  },

  /**
   * The fusion's look ahead (fuseFrom's `ahead`): his fusion now is his move, and the Slam's pieces land as the crowd's
   * turn after it begins (landsAfterHisMove), so its squares are weighed with them down. Null: not the fusion's step, or
   * nothing lands then. (A cast isn't his move: his move follows it, and is judged on its own.)
   */
  fusionAhead(b: Battle): ((fen: string) => string) | null {
    const boss = b.state.boss;
    const pieces = alfilBattle.step(b) === "fuse" ? landsAfterHisMove(boss) : null;
    return pieces ? slamAhead(pieces).after : null;
  },

  /**
   * The step lands (online with the host's pick: one of the candidates, else none): the cast (the picked pair marked;
   * none: the first of them), the fusion (the elephant on the picked square; none, the first square allowed), or the
   * Slam (the picked lift). Nothing is scored. The cast and the Slam aren't moves: he plays his move after them. The
   * fusion is his move: the crowd's turn begins (a base with the crowd to move, the crowd's turn set up as after a move:
   * its moment plays as that turn begins, ALFIL.everyTurn); with no square allowed now it fails, the pawns staying,
   * with no moment (as when the crowd takes one), and he plays his move.
   * - **The God King's strike** (`staggerNext`) just before a fusion hits the fusion: the elephant lands on the worse of
   *   its two squares for him (the engine's view: the square it didn't pick; one allowed, or no engine's answer: as
   *   usual), and the strike is spent there, as by a move.
   * - **A Slam that lifts nothing** (no lift could go, none within the cap, or no engine's answer) doesn't spend the meter
   *   and shows nothing: it comes again at the start of his next turn (`slamWait`).
   * - **`requested`**: the step the pick was asked for. If the step is another now (the admins' trigger brought the Slam
   *   while the host weighed his fusion), the pick is dropped and nothing changes: the step now is asked for anew.
   * Returns the step done; null when nothing came of it (a pick dropped, a Slam that lifted nothing).
   */
  apply(b: Battle, pick: string | null, loss: number | null = null, requested: AlfilStep | null = null, s: BossPowerSettings = BOSS_POWERS): AlfilStep | null {
    const step = alfilBattle.step(b, s);
    if (requested && step !== requested) return null;
    const boss = b.state.boss!;
    const crowd = boss.crowdSide;
    const fen = boardOf(b).fen;
    const turn = hisTurn(boss, boardOf(b).history.length);
    if (step === "tusks") {
      const pawns = castPick(castPairs(b, turn), pick)!;
      setPowers(b, (p) => ({ ...p, tusks: { turn, at: boss.crowdMoves, pawns }, tusksNext: turn + tusksSchedule(b, s).every, events: [...p.events, { kind: "tusks", turn: p.turn, squares: pawns }] }));
    } else if (step === "fuse") {
      const pawns = boss.powers!.tusks!.pawns;
      const options = fusionOptions(fen, pawns, other(crowd));
      const best = options.find((o) => o.fen === pick) ?? null;
      // (Staggered: the square the engine didn't pick.)
      const chosen = (boss.staggerNext && best && options.length > 1 ? options.find((o) => o !== best) : best) ?? options[0] ?? null;
      if (!chosen) {
        // (Failed, as when the crowd takes one: no moment, and he plays his move.)
        setPowers(b, (p) => ({ ...p, tusks: null, fusion: { at: boss.crowdMoves, from: [...pawns], to: null, why: "nowhere" } }));
        return step;
      }
      // His move: the board passes to the crowd with no move played (no last move to show), then what follows his move.
      const board = boardOf(b);
      setBase(b, chosen.fen);
      b.boards.set(b.state.boards[0]!, { ...boardOf(b), expected: 1 - board.expected, lastMove: null });
      b.bossLast = null;
      setPowers(b, (p) => ({ ...p, tusks: null, fusion: { at: boss.crowdMoves, from: [...pawns], to: chosen.at }, elephants: [...(p.elephants ?? []), chosen.at], fused: (p.fused ?? 0) + 1 }));
      // (The God King's strike is spent on it, as on a move: "Boss staggered." goes, and he can be called again.)
      if (b.state.boss!.staggerNext) b.state = { ...b.state, boss: { ...b.state.boss!, staggerNext: false } };
      alfilBattle.landDue(b);
      b.bossPassed();
    } else if (step === "slam") {
      const picked = (pick && slamList(b).find((c) => c.fen === pick)) || null;
      if (!picked) {
        setPowers(b, (p) => ({ ...p, slamWait: boss.crowdMoves }));
        return null;
      }
      setBase(b, picked.fen);
      const lands = Math.min(boss.crowdMoves + 1 + s.slamTurns, b.settings.bossMaxMoves);
      setPowers(b, ({ ultNext: _trigger, ...p }) =>
        unleashed(
          {
            ...p,
            ultAt: boss.crowdMoves,
            slam: { at: boss.crowdMoves, pieces: picked.pieces, lands, loss },
            airborne: picked.pieces,
            landed: null,
            events: [...p.events, { kind: "slam", turn: p.turn, squares: picked.pieces.map((x) => x.square) }],
          },
          s,
        ),
      );
    }
    return step;
  },

  /**
   * After the crowd's move (the start of his turn): his marked pawns and elephants follow it; one marked pawn taken (or
   * no longer a pawn), the fusion fails now. With pieces up: if he has a mate in one that he wouldn't have with them
   * down, they come down now, before his move (Eric: "never mated in one because a piece is airborne").
   */
  afterCrowdMove(b: Battle, move: string): void {
    alfilBattle.follow(b, move);
    const boss = b.state.boss!;
    const p = boss.powers!;
    if (!p.airborne?.length || boss.result || b.finalGameOver()) return;
    const fen = boardOf(b).fen;
    if (!mateInOne(fen)) return;
    const down = landing(fen, p.airborne, boss.crowdSide);
    if (!down.landed.length || mateInOne(down.fen)) return;
    alfilBattle.land(b, down, true);
  },

  /** After his own move: his pieces follow it; and the Slam's pieces land as the crowd turn they're due begins. */
  afterHisMove(b: Battle, move: string): void {
    alfilBattle.follow(b, move);
    alfilBattle.landDue(b);
  },

  /** His turn is over (his move, or his fusion): the Slam's pieces land as the crowd turn they're due begins. */
  landDue(b: Battle): void {
    const boss = b.state.boss!;
    const p = boss.powers!;
    if (!p.airborne?.length || !p.slam || p.slam.lands > turnOf(boss) || b.finalGameOver()) return;
    alfilBattle.land(b, landing(boardOf(b).fen, p.airborne, boss.crowdSide), false);
  },

  /** His marked pawns and elephants follow a move just played (a marked pawn gone: the fusion fails now). */
  follow(b: Battle, move: string): void {
    const boss = b.state.boss!;
    const p = boss.powers!;
    if (!p.tusks && !p.elephants?.length) return;
    const fen = boardOf(b).fen;
    const his = other(boss.crowdSide);
    const pawns = p.tusks ? followSquares(p.tusks.pawns, move, fen, letter(his, "p")) : [];
    const elephants = followSquares(p.elephants ?? [], move, fen, letter(his, "b"));
    const taken = !!p.tusks && pawns.length < p.tusks.pawns.length;
    setPowers(b, (q) => ({
      ...q,
      ...(q.tusks ? (taken ? { tusks: null, fusion: { at: boss.crowdMoves, from: [...q.tusks.pawns], to: null, why: "taken" as const } } : { tusks: { ...q.tusks, pawns } }) : {}),
      elephants,
    }));
  },

  /**
   * The Slam's pieces land (landing's result, a base on the board): as a crowd turn begins (its event plays then:
   * everyTurn), or `early`, at the start of his turn (its event with this turn's). Any with nowhere to go stay up a turn.
   */
  land(b: Battle, down: ReturnType<typeof landing>, early: boolean): void {
    const boss = b.state.boss!;
    if (down.landed.length) setBase(b, down.fen);
    const turn = early ? boss.powers!.turn : turnOf(boss);
    setPowers(b, (p) => ({
      ...p,
      airborne: down.stuck.length ? down.stuck : null,
      ...(down.stuck.length && p.slam ? { slam: { ...p.slam, lands: early ? turnOf(boss) : turnOf(boss) + 1 } } : {}),
      landed: { turn, at: boss.crowdMoves, pieces: down.landed, ...(early ? { early: true as const } : {}) },
      ...(early ? { events: [...p.events, { kind: "land" as const, turn: p.turn, squares: down.landed.map((x) => x.to) }] } : {}),
    }));
  },
};
