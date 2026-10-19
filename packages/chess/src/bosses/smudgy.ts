/**
 * Smudgy, the chameleon painter (BOSS_ROSTER "smudgy"; Eric, Oct 19; docs/decisions/2026-10-19-smudgy-rules.md). He
 * always starts from the starting position (his passive needs his pawns and rooks at home), whatever side he plays.
 *
 * His passive, Camouflage:
 * - **His first two moves are forced:** an end pawn two squares (a7-a5 or h7-h5; a2-a4 or h2-h4 as White), then that
 *   side's rook out through the gap to its third rank (Ra8-a6 or Rh8-h6; Ra1-a3 or Rh1-h3). The side is picked from the
 *   battle's seed among the sides where both moves are legal and the rook's new square isn't simply lost (attacked by a
 *   cheaper piece, or attacked and undefended). A forced move that can't be played on a turn (in check, a square taken)
 *   waits: he plays a move of his own and the forced move due comes on his next turn, up to camoTries turns in all; then
 *   no Camouflage this battle (camoDue). The lift itself needs only to be legal: the swap follows it at once, before the
 *   crowd moves, so the rook never stands on its new square (the sim: a threat to it that came with the crowd's move in
 *   between gave up Camouflage in 3 battles of 4).
 * - **The swap,** after his second forced move, before the crowd's turn (afterBossMove; the position changes outside a
 *   move, so it leaves a base): the rook and one of his pawns change places (seeded, among the pawns where the position
 *   stays one the engine plays and nobody is left in check, on the board or as the crowd sees it: swapOptions). A real
 *   pawn stands on the rook's square, and the rook hides on the pawn's, drawn as a pawn (`camouflage`).
 * - **What the crowd sees:** the board with the hidden rook drawn as a pawn (maskedFen). As with Hollow's dark, the true
 *   position is the one played (the engines play the boss on it) and the screens hide the piece: it's in the app's
 *   memory, not a network secret. A move of yours legal on the board you see but not on the true one (your king into
 *   the rook's line, a piece it pins) is refused ("paint": stopReason) and you pick again, at no cost; the crowd's
 *   allowed moves are those legal on both boards (crowdFilter), so the judge and the bots score only moves people can
 *   make.
 * - **He plays it like a pawn:** while hidden it makes only pawn-shaped moves (keepsDisguise): one square forward, or two
 *   from his pawns' first rank with both squares empty, never a capture, never a double step a pawn of yours could take
 *   en passant on the board you see, never onto your back rank, never onto a square where a pawn would give your king
 *   check (a check that isn't there).
 * - **The strike:** from the crowd's camoStrikeTurn-th move after the swap (his turn after it), any rook move. A move no
 *   pawn could make reveals it (`strike`, "move"); so does a check, whatever the turn, its own or discovered (`strike`,
 *   "check"); and so does the crowd taking it (`rookTaken`). At the battle's end the screens show the true board.
 * - One Camouflage a battle.
 *
 * His ultimate, Repaint (at most repaintMax a battle): his meter full (its warning as a crowd turn begins), at the start
 * of his turn he paints one of his pawns the crowd's color and one of the crowd's knights or bishops his; that's his
 * whole turn (passTurn: the crowd moves next, the en passant square cleared, the fifty-move count kept, a base so a
 * repetition counts from it). The engine picks the pair (repaintFrom): what it gains him, judged with the crowd to move
 * (passScores), within repaintBand, the nearest repaintTarget. Never the crowd's queen, rooks or king, never his king or
 * the hidden rook, never a pawn one step from promoting for its new owner, nothing that leaves either side in check or
 * hands either a mate in one, never a position the engine refuses (repaintOptions). No pair in the band: no Repaint that
 * turn, again at the start of his next (the test switch and the admins' trigger take the nearest outside it).
 */
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type BossState, type Camouflage, type PowerEvent, type RepaintResult } from "@chessroyale/core";
import { BOSS_OPENING, newBoard } from "../boards.ts";
import { applyMove, legalMoves, mateInOne, pieceAt, sideToMove, toSan, withPiece } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import { stockfishRefuses } from "../uci.ts";
import { from, meterFull, other, passScores, powerRoll, testSwitch, to, unleashed, type Battle, type BossRules, type Side } from "./base.ts";
import { PIECE_VALUE, gridAttackers, gridKing, gridOf, placementOf, type Grid } from "./grid.ts";
import { passTurn } from "./hollow.ts";

/**
 * How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). Placeholders until his art (the
 * wiring lane sets them from his animations' cues): the swap under a splash of paint over his pawns, the paint dripping
 * off the rook as it strikes, "That was his rook!", the brush strokes of Repaint.
 */
export const SMUDGY_FX = { camouflage: 2600, strike: 1800, rookTaken: 2000, repaint: 3000 } as const;

type CamoSettings = Pick<BossPowerSettings, "camoTries" | "camoStrikeTurn">;

const FILES = "abcdefgh";
const rank = (sq: string) => Number(sq[1]);
const file = (sq: string) => sq.charCodeAt(0) - 97;
const square = (f: number, r: number) => (f >= 0 && f < 8 && r >= 1 && r <= 8 ? `${FILES[f]}${r}` : null);
const letter = (side: Side, type: string) => (side === "w" ? type.toUpperCase() : type.toLowerCase());
/** Forward for a side's pawns. */
const ahead = (side: Side) => (side === "w" ? 1 : -1);
/** A side's back rank, and its pawns' first rank. */
const homeRank = (side: Side) => (side === "w" ? 1 : 8);
const pawnRank = (side: Side) => (side === "w" ? 2 : 7);

/** A position with the other side to move and no en passant square (the board as it stands, only the turn passed). */
function flipped(fen: string): string {
  const f = fen.split(" ");
  f[1] = f[1] === "w" ? "b" : "w";
  f[3] = "-";
  return f.join(" ");
}

/** A position's placement replaced (`g`), everything else as it was. */
const withGrid = (fen: string, g: Grid): string => [placementOf(g), ...fen.split(" ").slice(1)].join(" ");

// ---------------- Camouflage: the forced moves ----------------

/** His two forced moves on a side (`boss`: his color): the end pawn's double step, then the rook out to its third rank. */
export function forcedMoves(side: "a" | "h", boss: Side): { push: string; lift: string; rookTo: string } {
  const p = pawnRank(boss);
  const h = homeRank(boss);
  const rookTo = `${side}${h + 2 * ahead(boss)}`;
  return { push: `${side}${p}${side}${p + 2 * ahead(boss)}`, lift: `${side}${h}${rookTo}`, rookTo };
}

/** A piece of `side` on `sq` is simply lost: attacked by a cheaper piece, or attacked and not defended. */
export function simplyLost(fen: string, sq: string, side: Side): boolean {
  const g = gridOf(fen);
  const c = g.get(sq);
  if (!c) return false;
  const att = gridAttackers(g, sq, other(side));
  if (!att.length) return false;
  const v = PIECE_VALUE[c.toLowerCase()]!;
  return att.some((a) => PIECE_VALUE[g.get(a)!.toLowerCase()]! < v) || !gridAttackers(g, sq, side).length;
}

/**
 * The rook's lift is legal in `fen` (him to move) and doesn't leave the rook simply lost there. `swap`: the lift itself
 * (his second forced move), whose swap follows at once, before the crowd moves: the rook never stands on its new square
 * on the crowd's turn unless no swap can be made, so only then does that square's safety count.
 */
function liftOk(fen: string, lift: string, rookTo: string, boss: Side, swap = false): boolean {
  if (pieceAt(fen, lift.slice(0, 2))?.type !== "r" || pieceAt(fen, lift.slice(0, 2))?.color !== boss) return false;
  if (!legalMoves(fen).includes(lift)) return false;
  const after = applyMove(fen, lift);
  return (swap && swapOptions(after, rookTo, boss).length > 0) || !simplyLost(after, rookTo, boss);
}

/**
 * The sides where his first forced move can be played now (`fen`, him to move): the end pawn's double step is legal, and
 * after it (the crowd's pieces as they stand) the rook's lift would be legal and its new square not simply lost.
 */
export function camoSides(fen: string, boss: Side): ("a" | "h")[] {
  if (sideToMove(fen) !== boss) return [];
  const legal = legalMoves(fen);
  return (["a", "h"] as const).filter((side) => {
    const f = forcedMoves(side, boss);
    const pawn = pieceAt(fen, f.push.slice(0, 2));
    if (pawn?.type !== "p" || pawn.color !== boss || !legal.includes(f.push)) return false;
    return liftOk(flipped(applyMove(fen, f.push)), f.lift, f.rookTo, boss);
  });
}

/**
 * The forced move due on his turn now (`fen`, him to move; `at`: the crowd's moves so far, for the seed), or null: none
 * can be played now (it waits), or none is due (both played, or no Camouflage this battle). The first: the end pawn's
 * double step on a side picked from the seed among camoSides; the second: that side's rook out, if it's legal (and its
 * square isn't simply lost, should no swap be possible after it: the swap comes at once, before the crowd moves).
 */
export function camoDue(fen: string, c: Pick<Camouflage, "side" | "step" | "off"> | null | undefined, seed: number, boss: Side, at: number): string | null {
  if (!c || c.off || c.step >= 2 || sideToMove(fen) !== boss) return null;
  if (c.step === 0) {
    const sides = camoSides(fen, boss);
    if (!sides.length) return null;
    return forcedMoves(sides[Math.floor(powerRoll(seed, "camo-side", at) * sides.length)]!, boss).push;
  }
  if (!c.side) return null;
  const f = forcedMoves(c.side, boss);
  return liftOk(fen, f.lift, f.rookTo, boss, true) ? f.lift : null;
}

// ---------------- Camouflage: the swap and the board the crowd sees ----------------

/** The board as the crowd sees it: the hidden rook on `square` drawn as a pawn of his (any other square: the board as it is). */
export function maskedFen(fen: string, square: string | null | undefined): string {
  if (!square) return fen;
  const pc = pieceAt(fen, square);
  return pc?.type === "r" ? withPiece(fen, square, { color: pc.color, type: "p" }) : fen;
}

/** On a grid, `crowd`'s king stands where a pawn of the other side on `sq` would attack it (a pawn's check). */
function pawnChecks(g: Grid, sq: string, crowd: Side): boolean {
  const king = gridKing(g, crowd);
  if (!king) return false;
  const dir = ahead(other(crowd));
  return rank(king) === rank(sq) + dir && Math.abs(file(king) - file(sq)) === 1;
}

/** One swap he could make: the pawn whose place the rook takes, and the position after it (the crowd to move). */
export interface SwapOption {
  pawn: string;
  fen: string;
}

/**
 * The swaps he could make after his second forced move (`fen`: the crowd to move, his rook on `rook`): each pawn of his
 * changes places with it, the position after it one the engine plays (stockfishRefuses), the crowd not in check on the
 * board or as it sees it (a real pawn on the rook's square, the rook on the pawn's, drawn as a pawn), and the crowd with a
 * move it can make on both. Every square holds what it held, so no line through the board opens or closes: only who
 * stands where changes. In his pawns' square order.
 */
export function swapOptions(fen: string, rook: string, boss: Side): SwapOption[] {
  const g0 = gridOf(fen);
  if (g0.get(rook) !== letter(boss, "r")) return [];
  const crowd = other(boss);
  const out: SwapOption[] = [];
  const pawns = [...g0].filter(([, c]) => c === letter(boss, "p")).map(([sq]) => sq).sort();
  for (const pawn of pawns) {
    const g = new Map(g0);
    g.set(rook, letter(boss, "p"));
    g.set(pawn, letter(boss, "r"));
    const after = withGrid(fen, g);
    if (stockfishRefuses(after)) continue;
    const king = gridKing(g, crowd);
    if (!king || gridAttackers(g, king, boss).length || pawnChecks(g, pawn, crowd)) continue;
    const seen = new Set(legalMoves(maskedFen(after, pawn)));
    if (!legalMoves(after).some((m) => seen.has(m))) continue;
    out.push({ pawn, fen: after });
  }
  return out;
}

/**
 * A move of the hidden rook from `fromSq` to `toSq` keeps it hidden (a move a pawn of his could make), as the board stands
 * after it (`after`; `captured`: it took a piece): one square forward, or two from his pawns' first rank (the square
 * between empty: it passed it), never a capture, never onto the crowd's back rank, never a double step landing beside a
 * pawn of the crowd's (it could take a pawn en passant there, on the board it sees), never onto a square where a pawn
 * would check the crowd's king (a check that isn't there).
 */
export function keepsDisguise(after: string, fromSq: string, toSq: string, captured: boolean, boss: Side): boolean {
  if (captured || file(fromSq) !== file(toSq)) return false;
  const steps = (rank(toSq) - rank(fromSq)) * ahead(boss);
  if (steps !== 1 && !(steps === 2 && rank(fromSq) === pawnRank(boss))) return false;
  if (rank(toSq) === homeRank(other(boss))) return false;
  const g = gridOf(after);
  const crowd = other(boss);
  if (steps === 2 && [-1, 1].some((df) => {
    const s = square(file(toSq) + df, rank(toSq));
    return !!s && g.get(s) === letter(crowd, "p");
  })) return false;
  return !pawnChecks(g, toSq, crowd);
}

/** His hidden rook on `sq` gives the crowd's king check on the board as it is (`fen`). */
export function rookChecks(fen: string, sq: string, boss: Side): boolean {
  const g = gridOf(fen);
  const king = gridKing(g, other(boss));
  return !!king && gridAttackers(g, king, boss).includes(sq);
}

/**
 * A move of the crowd's legal on the board it sees (the hidden rook on `square` drawn as a pawn) but not on the true one:
 * refused for the hidden rook (its king into the rook's line, a piece it pins), and picked again at no cost.
 */
export function paintRefuses(fen: string, square: string | null | undefined, move: string): boolean {
  if (!square || pieceAt(fen, square)?.type !== "r") return false;
  return legalMoves(maskedFen(fen, square)).includes(move) && !legalMoves(fen).includes(move);
}

/** The crowd's move from which (its count so far) the hidden rook may strike: camoStrikeTurn after the swap. Null: no swap. */
export const strikeFrom = (c: Pick<Camouflage, "swap"> | null | undefined, s: CamoSettings = BOSS_POWERS): number | null => (c?.swap ? c.swap.at + s.camoStrikeTurn : null);

/** The hidden rook may make any rook move now (his turn after the crowd's `crowdMoves`-th move). */
export const strikeOpen = (boss: Pick<BossState, "crowdMoves" | "powers">, s: CamoSettings = BOSS_POWERS): boolean => {
  const at = strikeFrom(boss.powers?.camo, s);
  return at !== null && boss.crowdMoves >= at;
};

/** His forced moves are still to come (neither played nor given up): his Repaint waits for them. */
const camoPending = (c: Camouflage | null | undefined): boolean => !!c && !c.off && c.step < 2;

/** Camouflage as it stands before his first move. */
const freshCamo = (): Camouflage => ({ side: null, step: 0, missed: 0, due: null, square: null });

/** Camouflage as the screens get it (NetBossPowers.camo). */
export interface CamoView {
  side: "a" | "h" | null;
  step: number;
  off: boolean;
  /** The hidden rook's square now (null: none hidden). The screens draw a pawn there (maskedFen). */
  square: string | null;
  swap: { at: number; rook: string; pawn: string } | null;
  /** The crowd's move count from which the hidden rook may strike (null: no swap). */
  strikeAt: number | null;
  reveal: { at: number; square: string; how: "move" | "check" | "taken"; from?: string } | null;
}

export function camoView(c: Camouflage | null | undefined): CamoView | null {
  if (!c) return null;
  return {
    side: c.side,
    step: c.step,
    off: !!c.off,
    square: c.square,
    swap: c.swap ? { ...c.swap } : null,
    strikeAt: strikeFrom(c),
    reveal: c.reveal ? { ...c.reveal } : null,
  };
}

// ---------------- Repaint ----------------

/** One pair he could paint: his pawn (now the crowd's), the crowd's knight or bishop (now his), and the position after (the crowd to move). */
export interface RepaintOption {
  pawn: string;
  piece: string;
  type: "n" | "b";
  fen: string;
}

/**
 * The pairs he could paint now (`fen`: him to move; `hidden`: his hidden rook's square, never painted), in square order:
 * each pawn of his with each knight or bishop of the crowd's. The turn passes (passTurn: none while he's in check). Never
 * a pawn one step from promoting for the crowd; never a position the engine refuses (a ninth pawn, the side not to move
 * in check); never the crowd in check, on the board or as it sees it; never one the crowd can't move in; never a mate in
 * one for the crowd, nor one for him were the crowd to pass.
 */
export function repaintOptions(fen: string, boss: Side, hidden: string | null = null): RepaintOption[] {
  const passed = passTurn(fen);
  if (!passed || sideToMove(fen) !== boss) return [];
  const crowd = other(boss);
  const g0 = gridOf(passed);
  const pawns = [...g0].filter(([sq, c]) => c === letter(boss, "p") && sq !== hidden).map(([sq]) => sq).sort();
  const pieces = [...g0].filter(([, c]) => c === letter(crowd, "n") || c === letter(crowd, "b")).map(([sq]) => sq).sort();
  const nextToLast = crowd === "w" ? 7 : 2;
  const out: RepaintOption[] = [];
  for (const pawn of pawns) {
    if (rank(pawn) === nextToLast) continue;
    for (const piece of pieces) {
      const type = g0.get(piece)!.toLowerCase() as "n" | "b";
      const g = new Map(g0);
      g.set(pawn, letter(crowd, "p"));
      g.set(piece, letter(boss, type));
      const after = withGrid(passed, g);
      if (stockfishRefuses(after)) continue;
      const king = gridKing(g, crowd);
      if (!king || gridAttackers(g, king, boss).length) continue;
      if (hidden && pawnChecks(g, hidden, crowd)) continue;
      if (!legalMoves(after).length || mateInOne(after)) continue;
      const his = passTurn(after);
      if (his && mateInOne(his)) continue;
      out.push({ pawn, piece, type, fen: after });
    }
  }
  return out;
}

/**
 * The engine's pick among the pairs (`candidates`: the positions after each, the crowd to move), from this device's
 * engines (the host's online, solo's, the sims'): each searched at repaintNodes against the position before (`fen`, him
 * to move): passScores' gain, in pawns. The one in repaintBand nearest repaintTarget (the first among equals); none in
 * the band: null, or with `any` (the test switch, the admins' trigger) the nearest outside it. Null too with no engine
 * or no answer.
 */
export async function repaintFrom(
  engines: readonly EngineLike[],
  fen: string,
  candidates: readonly string[],
  any = false,
  s: Pick<BossPowerSettings, "repaintBand" | "repaintTarget" | "repaintNodes" | "bouncePawnLogit"> = BOSS_POWERS,
): Promise<{ fen: string; gain: number; outside: boolean } | null> {
  return repaintPick((await passScores(engines, fen, candidates, s.repaintNodes, s)) ?? [], any, s);
}

/** The pick among scored pairs (repaintFrom's rule, pure; the sims log every pair's gain with it). */
export function repaintPick(
  scores: readonly { fen: string; gain: number }[],
  any = false,
  s: Pick<BossPowerSettings, "repaintBand" | "repaintTarget"> = BOSS_POWERS,
): { fen: string; gain: number; outside: boolean } | null {
  const [lo, hi] = s.repaintBand;
  const inBand = scores.filter((x) => x.gain >= lo && x.gain <= hi);
  const pool = inBand.length ? inBand : any ? scores : [];
  let pick: (typeof scores)[number] | null = null;
  for (const x of pool) if (!pick || Math.abs(x.gain - s.repaintTarget) < Math.abs(pick.gain - s.repaintTarget)) pick = x;
  return pick ? { fen: pick.fen, gain: Math.round(pick.gain * 100) / 100, outside: !inBand.length } : null;
}

/**
 * The test switch (?power=repaint): the battle starts from 1.e4 d5 2.exd5 Qxd5, a pawn gone from each side, so a Repaint
 * can come (a ninth pawn of the crowd's is a position the engine refuses: with all eight, no pair fits). His a- and
 * h-pawns and rooks are at home, so Camouflage comes as ever; the crowd White moves next, the crowd Black (?side=b) has
 * him move first. The warning as the second turn begins; the Repaint at the start of his first turn after his forced
 * moves, the nearest pair even outside the band.
 */
export const REPAINT_TEST_MOVES: readonly string[] = ["e2e4", "d7d5", "e4d5", "d8d5"];

// ---------------- His rules ----------------

/** His powers' state, changed (the match's state replaced, as everywhere). */
const setPowers = (b: Battle, change: (p: BossPowerState) => BossPowerState): void => {
  const boss = b.state.boss!;
  b.state = { ...b.state, boss: { ...boss, powers: change(boss.powers!) } };
};

/** The battle's board (its one board). */
const boardOf = (b: Battle) => b.boards.get(b.state.boards[0]!)!;

/** The position changes outside a move: a base on the board at its ply (every replay plays from it). */
function setBase(b: Battle, fen: string): void {
  const id = b.state.boards[0]!;
  const board = b.boards.get(id)!;
  const ply = board.history.length;
  b.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen }] });
}

/** His Camouflage as his turn begins (`fen`, him to move): the forced move due, or a turn missed (and given up after camoTries). */
function camoTurn(c: Camouflage, fen: string, seed: number, boss: Side, at: number, s: CamoSettings = BOSS_POWERS): Camouflage {
  if (!camoPending(c)) return c;
  const due = camoDue(fen, c, seed, boss, at);
  if (due) return { ...c, due };
  const missed = c.missed + 1;
  return { ...c, due: null, missed, ...(missed >= s.camoTries ? { off: true as const } : {}) };
}

/** Smudgy: Camouflage (two forced moves, then his rook hides as a pawn until it strikes) and Repaint (his whole turn). */
export const SMUDGY: BossRules = {
  id: "smudgy",
  // Repaint: the meter full as a turn begins, its warning that turn; at the start of his turn, after the crowd's move
  // (smudgyBattle.repaintDue). The test switch: warned as the second turn begins. The trigger (`ultNext`, kept): at the
  // start of his next turn, without the warning. At most repaintMax a battle: then the meter is off.
  ultimateOnHisTurn: true,
  get ultimateMax() {
    return BOSS_POWERS.repaintMax;
  },
  ultimate(next, t) {
    if ((next.repaints ?? 0) >= t.s.repaintMax || next.warnAt !== undefined || t.ultNext) return false;
    if (meterFull(next, t) || testSwitch(t, next)) {
      next.warnAt = t.turn;
      t.events.push({ kind: "warn", turn: t.turn });
    }
    return false;
  },
  // Each Repaint its own turn; after the last, for the rest of the battle (no more come).
  ultimateRunning: (p, turn, s) => (p.repaints ?? 0) >= s.repaintMax || turn <= (p.ultAt ?? 0),
  // As a crowd turn begins: the swap, the strike, the Repaint, each on the crowd turn right after it.
  everyTurn(next, t) {
    const c = next.camo;
    if (c?.swap && c.swap.at + 1 === t.turn) t.events.push({ kind: "camouflage", turn: t.turn, square: c.swap.pawn, squares: [c.swap.rook, c.swap.pawn] });
    if (c?.reveal && c.reveal.how !== "taken" && c.reveal.at + 1 === t.turn) {
      const r = c.reveal;
      t.events.push({ kind: "strike", turn: t.turn, square: r.square, squares: r.from ? [r.from, r.square] : [r.square], reveal: r.how === "check" ? "check" : "move" });
    }
    const rp = next.repaint;
    if (rp && rp.at + 1 === t.turn) t.events.push({ kind: "repaint", turn: t.turn, squares: [rp.pawn, rp.piece] });
  },
  // (Camouflage works through his moves: afterCrowdMove, afterBossMove, bossStops.)
  passive() {},
  // The crowd's moves: only those legal on the board it sees as well as on the true one (the hidden rook drawn as a pawn).
  crowdFilter(allowed, boss, fen) {
    const sq = boss.powers?.camo?.square;
    if (!sq) return allowed;
    const seen = new Set(legalMoves(maskedFen(fen, sq)));
    return allowed.filter((m) => seen.has(m));
  },
  // His moves: the forced move due (only it); the hidden rook's pawn-shaped moves only, until it may strike.
  bossStops(boss) {
    const c = boss.powers?.camo;
    if (!c) return null;
    if (camoPending(c) && c.due) {
      const due = c.due;
      return (m) => m !== due;
    }
    const sq = c.square;
    if (!sq || strikeOpen(boss)) return null;
    const his = other(boss.crowdSide);
    return (m, fen) => from(m) === sq && !keepsDisguise(applyMove(fen, m), sq, to(m), !!pieceAt(fen, to(m)), his);
  },
  stopReason(boss, fen, move) {
    const sq = boss.powers?.camo?.square;
    if (!sq) return null;
    const rook = pieceAt(fen, sq);
    const mover = pieceAt(fen, from(move));
    if (!rook || !mover || mover.color === rook.color) return null;
    return paintRefuses(fen, sq, move) ? "paint" : null;
  },
  // The hidden rook's pawn-shaped step is named as a pawn's ("e6", not "Re6": the screens' line for his move), so the
  // move's name gives nothing away. Any other move is named as it is (a strike or a check reveals it anyway).
  specialMove(boss, fen, move) {
    const sq = boss.powers?.camo?.square;
    if (!sq || from(move) !== sq || pieceAt(fen, sq)?.type !== "r") return null;
    const his = other(boss.crowdSide);
    const after = applyMove(fen, move);
    if (!keepsDisguise(after, sq, to(move), !!pieceAt(fen, to(move)), his) || rookChecks(after, to(move), his)) return null;
    try {
      return { play: move, san: toSan(maskedFen(fen, sq), move) };
    } catch {
      return null;
    }
  },
  // The crowd's turns while his rook hides (the engine sees it, the crowd doesn't) and the turn after a Repaint (the board
  // changed): its picks don't count for fair play.
  powerTurn: (boss) => {
    const p = boss.powers!;
    return !!p.camo?.square || p.repaint?.at === boss.crowdMoves;
  },
  afterCrowdMove(b, move) {
    smudgyBattle.afterCrowdMove(b, move);
  },
  afterBossMove(b, move) {
    smudgyBattle.afterHisMove(b, move);
  },
  opening: {
    fromStart: true,
    setUp(b, at) {
      if (b.settings.bossPowerTest === "repaint") b.boards.set(at.boardId, newBoard(at.boardId, { ...BOSS_OPENING, moves: [...REPAINT_TEST_MOVES] }, REPAINT_TEST_MOVES.length, at.generation));
      // (He moves first as White: his first forced move is due as the battle begins.)
      const fen = b.boards.get(at.boardId)!.fen;
      const boss = other(at.crowdSide);
      return { camo: sideToMove(fen) === boss ? camoTurn(freshCamo(), fen, at.seed, boss, 0) : freshCamo() };
    },
  },
  view: (p) => ({ camo: camoView(p.camo), repaint: p.repaint ? { ...p.repaint } : null, repaints: p.repaints ?? 0 }),
};

// ---------------- His part in the match runner ----------------

/** His Repaint options now, worked out once per position (the pick is checked against the same list). */
function repaintList(b: Battle): RepaintOption[] {
  const fen = boardOf(b).fen;
  const hidden = b.state.boss!.powers?.camo?.square ?? null;
  const key = `${fen}|${hidden ?? ""}`;
  const memo = b.memo.get("repaint") as { key: string; list: RepaintOption[] } | undefined;
  if (memo?.key === key) return memo.list;
  const list = repaintOptions(fen, other(b.state.boss!.crowdSide), hidden);
  b.memo.set("repaint", { key, list });
  return list;
}

export const smudgyBattle = {
  /**
   * After the crowd's move: the hidden rook taken (revealed: `rookTaken`, as the move lands), and his turn beginning: the
   * forced move due, or a turn missed.
   */
  afterCrowdMove(b: Battle, move: string | null): void {
    const boss = b.state.boss;
    const c = boss?.powers?.camo;
    if (!boss || boss.id !== "smudgy" || !c) return;
    if (c.square && move && to(move) === c.square) {
      const square = c.square;
      setPowers(b, (p) => ({ ...p, camo: { ...c, square: null, reveal: { at: boss.crowdMoves, square, how: "taken" } }, events: [...p.events, { kind: "rookTaken", turn: p.turn, square }] }));
      return;
    }
    if (camoPending(c) && b.bossToMove()) setPowers(b, (p) => ({ ...p, camo: camoTurn(c, boardOf(b).fen, p.seed, other(boss.crowdSide), boss.crowdMoves) }));
  },

  /**
   * After his move: a forced move played (the second: the swap, a base at its ply; none possible: no Camouflage), or the
   * hidden rook's move (a pawn's keeps it hidden; any other reveals it), or a check by it, discovered (reveals it).
   */
  afterHisMove(b: Battle, move: string): void {
    const boss = b.state.boss;
    const c = boss?.powers?.camo;
    if (!boss || boss.id !== "smudgy" || !c) return;
    const his = other(boss.crowdSide);
    const fen = boardOf(b).fen;
    if (camoPending(c)) {
      if (!c.due) return;
      if (move !== c.due) {
        // (Never, as the forced move was his only one allowed: a turn missed all the same.)
        const missed = c.missed + 1;
        setPowers(b, (p) => ({ ...p, camo: { ...c, due: null, missed, ...(missed >= BOSS_POWERS.camoTries ? { off: true as const } : {}) } }));
        return;
      }
      const step = c.step + 1;
      const side = (c.side ?? move[0]) as "a" | "h";
      if (step < 2) return setPowers(b, (p) => ({ ...p, camo: { ...c, side, step, due: null } }));
      const rook = forcedMoves(side, his).rookTo;
      const options = swapOptions(fen, rook, his);
      if (!options.length) return setPowers(b, (p) => ({ ...p, camo: { ...c, side, step, due: null, off: true } }));
      const pick = options[Math.floor(powerRoll(boss.powers!.seed, "camo-swap", boss.crowdMoves) * options.length)]!;
      setBase(b, pick.fen);
      setPowers(b, (p) => ({ ...p, camo: { ...c, side, step, due: null, swap: { at: boss.crowdMoves, rook, pawn: pick.pawn }, square: pick.pawn } }));
      return;
    }
    const sq = c.square;
    if (!sq) return;
    if (from(move) === sq) {
      const now = to(move);
      const reveal = (how: "move" | "check") => setPowers(b, (p) => ({ ...p, camo: { ...c, square: null, reveal: { at: boss.crowdMoves, square: now, how, from: sq } } }));
      if (!keepsDisguise(fen, sq, now, !!b.bossLast?.captured, his)) return reveal("move");
      if (rookChecks(fen, now, his)) return reveal("check");
      setPowers(b, (p) => ({ ...p, camo: { ...c, square: now } }));
      return;
    }
    if (pieceAt(fen, sq)?.type === "r" && rookChecks(fen, sq, his)) setPowers(b, (p) => ({ ...p, camo: { ...c, square: null, reveal: { at: boss.crowdMoves, square: sq, how: "check" } } }));
  },

  /**
   * His Repaint is due: the start of his turn (the crowd has just moved) from the turn the meter warned, or after the test
   * trigger; his forced moves done (or given up); fewer than repaintMax so far; not already tried after this crowd move
   * (`repaintWait`); and a pair he could paint (repaintOptions: none while he's in check).
   */
  repaintDue(b: Battle, s: Pick<BossPowerSettings, "repaintMax"> = BOSS_POWERS): boolean {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "smudgy" || boss.result || !b.bossToMove() || b.finalGameOver()) return false;
    if ((p.repaints ?? 0) >= s.repaintMax || camoPending(p.camo) || p.ultAt !== undefined) return false;
    if (!p.ultNext && !(p.warnAt !== undefined && p.warnAt <= boss.crowdMoves)) return false;
    if (p.repaintWait === boss.crowdMoves) return false;
    return repaintList(b).length > 0;
  },

  /** The positions the engine's pick weighs (one per pair), when a Repaint is due: the same on the server, the host and in solo. */
  candidates(b: Battle): string[] {
    return smudgyBattle.repaintDue(b) ? repaintList(b).map((o) => o.fen) : [];
  },

  /** The pick may fall outside the band: the test switch's Repaint (his first) or the admins' trigger. */
  any(b: Battle): boolean {
    const p = b.state.boss?.powers;
    return !!p && (!!p.ultNext || (b.settings.bossPowerTest === "repaint" && !p.repaints));
  },

  /** The Repaint from this device's engines (solo, the sims): repaintFrom, then apply. */
  async play(b: Battle, engines: readonly EngineLike[]): Promise<RepaintResult | null> {
    const candidates = smudgyBattle.candidates(b);
    if (!candidates.length) return null;
    const pick = await repaintFrom(engines, boardOf(b).fen, candidates, smudgyBattle.any(b));
    return smudgyBattle.apply(b, pick?.fen ?? null, pick?.gain ?? null);
  },

  /**
   * The Repaint (online with the host's pick: one of the candidates; anything else, or none, no Repaint now: it waits for
   * his next turn, the warning and the trigger staying, and he plays his move): his whole turn. The turn passes to the
   * crowd (passTurn, a base at its ply), the meter spent, and the crowd's turn set up as after his move (its moment plays
   * as it begins). Returns the Repaint; null when none was due, or it waits.
   */
  apply(b: Battle, pick: string | null, gain: number | null = null): RepaintResult | null {
    if (!smudgyBattle.repaintDue(b)) return null;
    const boss = b.state.boss!;
    const chosen = repaintList(b).find((o) => o.fen === pick);
    if (!chosen) {
      setPowers(b, (p) => ({ ...p, repaintWait: boss.crowdMoves }));
      return null;
    }
    const outside = smudgyBattle.any(b) && gain !== null && (gain < BOSS_POWERS.repaintBand[0] || gain > BOSS_POWERS.repaintBand[1]);
    const result: RepaintResult = { at: boss.crowdMoves, pawn: chosen.pawn, piece: chosen.piece, type: chosen.type, gain, ...(outside ? { outside: true as const } : {}) };
    const board = boardOf(b);
    setBase(b, chosen.fen);
    b.boards.set(b.state.boards[0]!, { ...boardOf(b), expected: 1 - board.expected, lastMove: null });
    b.bossLast = null;
    setPowers(b, ({ ultNext: _trigger, ...p }) => unleashed({ ...p, ultAt: boss.crowdMoves, repaint: result, repaints: (p.repaints ?? 0) + 1 }));
    b.bossPassed();
    return result;
  },
};

/** His events for a turn, by kind (the sims and tests read them). */
export const smudgyEvents = (events: readonly PowerEvent[]) => events.filter((e) => e.kind === "camouflage" || e.kind === "strike" || e.kind === "rookTaken" || e.kind === "repaint");
