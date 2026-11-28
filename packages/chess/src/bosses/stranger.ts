/**
 * The Stranger (BOSS_ROSTER "stranger"; Eric, Nov 27; docs/decisions/2026-11-27-stranger-rules.md). He plays from the game so far,
 * like most bosses. His art is the characters lane's (claude/stranger-art); his rules are here.
 *
 * His passive, the Frostfire strike (Eric: "he puts both of the tips of his swords like together, and he does like a dual fire and ice
 * move, like where it hits a square, freezes your piece, and then that ... tile also becomes like in 2 turns, it burns whatever's on
 * it"; timing, his answer: "Freeze 1 turn, then flee"):
 * - As crowd turn BOSS_POWERS.stranger.strikeFrom begins (it comes with his move: after it, never instead of it), then every
 *   strikeEvery crowd turns, on the crowd's most valuable piece that isn't the king (`chooseStrike`: ties the most central, then the
 *   seed's pick, so solo and online agree). Only a piece whose freeze leaves the crowd a move and whose burning would be legal now.
 *   None fits: it waits a turn. One strike at a time.
 * - Frozen for freezeTurns crowd turns (that turn: it can't move, nor castle with it: held on the board layer, as Ginger's freeze);
 *   then thawed for fleeTurns turns, the crowd's chance to move it off; then, as the last of those moves lands (the start of his
 *   turn, afterCrowdMove), the tile burns whatever stands on it: the crowd's piece left there or one moved onto it, his own piece too
 *   ("whatever's on it"). Never a king (spared), and never a loss that leaves a position no game can have (`frostfireOutcome`: a king
 *   opened to attack, his king checked by the gap, a promotion handed to him, no move left for him: spared). A base on the board.
 * - The judge counts what the burn takes on the flee turn: the crowd's piece left there as gone (its value at burnPawnLogit log-odds
 *   a pawn, the fire's way), his piece left there as a gain; and it always scores the moves that save the piece. The frozen turn and
 *   the flee turn don't count for fair play (powerTurn), and the God King's Last Stand sits out on them.
 *
 * His ultimate (Eric, Nov 27): the Storm of Two Worlds, `strangerult`: three of your turns of ice and fire, below (`stormPick`,
 * `stormCheck`); its numbers in settings.ts.
 */
import { BOSS_POWERS, mulberry32, type BalloonShape, type BossPowerSettings, type BossPowerState, type BossState, type PowerEvent, type StormKind, type StrangerState } from "@chessroyale/core";
import { BOSS_OPENING, boardEnd, newBoard, type BoardState } from "../boards.ts";
import { heldIn, movePaths } from "../board-layer.ts";
import { applyMove, fenAtPly, keptEnPassant, kingAttacked, legalMoves, pieceAt, positionOver, sideToMove, withoutPiece, type Base } from "../rules.ts";
import type { EngineLike } from "../runner-tools.ts";
import { stockfishRefuses, type MoveScore } from "../uci.ts";
import { VALUE, from, heldBy, logit, materialOf, meterFull, other, powerRoll, testSwitch, turnOf, ultCapped, type Battle, type BossRules, type JudgedEvaluation, type Side } from "./base.ts";
import { capturedSquare } from "./chandy.ts";

type StrangerSettings = BossPowerSettings["stranger"];

/**
 * His storm's opening scene (Eric, Nov 27: "he jumps onto the center of the board, takes both of his swords out, and slams them both into
 * the chessboard ... then he pulls them out ... and then when he jumps back, we can, like, restore the board"; "10 to 12 seconds"), ms
 * from his leap (the moment's own clock, after its banner's lead): off his place at `upAt`, down in the board's middle at `landAt` (the
 * pieces there nudged aside from `nudgeAt`, drawn only); his swords out by `drawnAt`; the fire sword driven in at `fireAt`, the ice
 * sword at `iceAt`, the board cracking round each and pulsing its color; the storm gathering round the board from `fireAt`; his grip on
 * both hilts at `gripAt` (his red and blue aura, the charge building), the full swirl at `fullAt`; the swords out at `pullAt`; off the
 * board at `leapAt`, home at `homeAt`; the pieces his swords threw fly back to their squares over `healAt` to `healAt + healMs`, from
 * his leap away (Eric, Nov 28: "reset when he jumps away"); the end, `ms`.
 * Its banner is up before all of it (boss-timing.ts POWER_BANNERS: the whole banner is the moment's lead), so nothing he does on the
 * board is behind it (Eric, Nov 27: "look at the banner and look at every frame"); `leapAt` is his swords home again (the whole of
 * `stormPull`, 840 ms after `pullAt`), so his leap back never cuts the sheathing short.
 */
export const STORM_SCENE = { upAt: 90, landAt: 480, nudgeAt: 400, nudgeMs: 240, drawnAt: 1240, fireAt: 1650, iceAt: 2450, gripAt: 4750, fullAt: 7350, pullAt: 7850, leapAt: 8690, homeAt: 9170, healAt: 8780, healMs: 700, ms: 10000 } as const;

/**
 * How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts): the strike (his banner, the swords' tips together,
 * the bolt onto the piece and its ice) as the crowd's turn after his move begins; the burn at the start of his turn. His art plays
 * within them (the characters lane's).
 */
export const STRANGER_FX = { frostfire: 2300, frostfireBurn: 1500, finisher: 4600, storm: STORM_SCENE.ms, stormIce: 1400, stormFire: 1400, stormBurn: 1500 } as const;

/**
 * His finishers (Eric, Nov 27: "a flame strike ... or a literal strike with a sword ... one of them could be he cuts the piece in half
 * ... some ice or some fire, or cuts the piece, or ... a combination"): which one an event's `pick` plays (`pick` modulo their count).
 */
export const FINISHERS = ["flame", "ice", "cut", "frostfire"] as const;
export type Finisher = (typeof FINISHERS)[number];
/**
 * The test switch `?power=finisher` (and `finisher-<kind>`, that finisher every time; test links only): the battle starts where your
 * bishop can take his knight at once (by your side: your move first), and every move of his takes a piece of yours that isn't a pawn
 * when one can (the most valuable), so the e2e sees his block and then his finisher. Not a position the game reaches; nothing else changes.
 */
export const FINISHER_TEST = {
  w: "rnbqkb1r/pppp1ppp/5n2/4p1B1/3PP3/8/PPP2PPP/RN1QKBNR w KQkq - 0 4",
  b: "rn1qkbnr/ppp2ppp/8/3pp3/4P1b1/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 4",
} as const;
/**
 * His block before his finisher (ms): when the crowd's move that began his turn took a piece of his that isn't a pawn, his block plays where
 * he stands (the app's hurt beat: draw, the blow, sheathe) as his thinking begins, and he thinks at least this long (strangerTurnMs, in the
 * thinking minimum as Grex's burn is), so his finisher starts as his block ends, never after a wait. At least the block's animation (a unit
 * test in the app).
 */
export const FINISHER_BLOCK_MS = 1800;

/**
 * The material he lost (pawn 1 ... queen 9) since before the crowd's last move: a piece of his taken by it, or burnt as his turn began. 0
 * when the board has just gone back past it (Folio's Revision: a base that goes back, `from`), as bossBeat reads it.
 */
export function hisLoss(board: { fen: string; history: readonly string[]; bases?: readonly Base[] | null }, crowd: Side): number {
  const ply = board.history.length;
  if (!ply || board.bases?.some((x) => x.ply === ply && x.from !== undefined)) return 0;
  const his = other(crowd);
  return materialOf(fenAtPly(board.history, ply - 1, board.bases), his) - materialOf(board.fen, his);
}

/**
 * How long his thinking lasts at least for his block (ms; the server's thinkMinAt and solo's bossTurn add it, as each boss's turn moments):
 * FINISHER_BLOCK_MS when a piece of his that isn't a pawn was just lost (hisLoss 3 or more); a burn as the crowd's move landed (his
 * Frostfire's tile, a storm's fire turn), at least its moment (STRANGER_FX); else 0.
 */
export const strangerTurnMs = (boss: { id?: string; crowdSide: Side; board: { fen: string; history: readonly string[]; bases?: readonly Base[] | null }; powers?: { events?: readonly { kind: string }[] } | null } | null | undefined): number =>
  boss?.id !== "stranger"
    ? 0
    : Math.max(hisLoss(boss.board, boss.crowdSide) >= 3 ? FINISHER_BLOCK_MS : 0, boss.powers?.events?.some((e) => e.kind === "stormBurn") ? STRANGER_FX.stormBurn : 0, boss.powers?.events?.some((e) => e.kind === "frostfireBurn") ? STRANGER_FX.frostfireBurn : 0);

const finisherTest = (test: string): { on: boolean; kind: number } => ({ on: test === "finisher" || test.startsWith("finisher-"), kind: test.startsWith("finisher-") ? FINISHERS.indexOf(test.slice(9) as Finisher) : -1 });
export const finisherOf = (pick: number | undefined): Finisher => FINISHERS[(((pick ?? 0) % FINISHERS.length) + FINISHERS.length) % FINISHERS.length]!;

const FILES = "abcdefgh";
/** How far a square is from the board's middle (0.5 on the four center squares, 3.5 in a corner): the strike's tie-break. */
const offCenter = (sq: string) => Math.max(Math.abs(FILES.indexOf(sq[0]!) - 3.5), Math.abs(Number(sq[1]) - 1 - 3.5));

/** The square one rank toward `side`'s own back rank from `square`, or null off the board. */
const towardHome = (square: string, side: Side): string | null => {
  const r = Number(square[1]) + (side === "w" ? -1 : 1);
  return r >= 1 && r <= 8 ? `${square[0]}${r}` : null;
};

/**
 * Burning the crowd's piece on `square` would be legal now (`fen`, the crowd to move): not the last shield of its king against one
 * of his pieces, and not on the square his pawn would promote on next (your back rank, his pawn right behind it). Birdie's
 * smashLegalNow's rule, for the pick: a strike on a piece the burn would spare anyway is a strike wasted.
 */
export function burnLegalNow(fen: string, square: string, crowd: Side): boolean {
  const piece = pieceAt(fen, square);
  if (!piece || piece.color !== crowd || piece.type === "k") return false;
  if (kingAttacked(withoutPiece(fen, square), crowd)) return false;
  const back = crowd === "w" ? "1" : "8";
  if (square[1] === back) {
    const behind = towardHome(square, other(crowd));
    const p = behind ? pieceAt(fen, behind) : null;
    if (p && p.type === "p" && p.color === other(crowd)) return false;
  }
  return true;
}

/**
 * The piece his Frostfire strikes as crowd turn `turn` begins (`fen`, the crowd to move; `moves`, the crowd's allowed moves this turn,
 * every legal move without): the crowd's most valuable piece but the king (P1 N3 B3 R5 Q9), then the most central, then the seed's
 * pick (powerRoll), the same on every device. Only one whose freeze leaves the crowd a move (heldIn) and whose burning would be legal
 * now (burnLegalNow). Null: none fits.
 */
export function chooseStrike(fen: string, crowd: Side, seed: number, turn: number, moves?: readonly string[]): { square: string; piece: string } | null {
  const legal = moves ?? legalMoves(fen);
  const options: { square: string; piece: string; score: number; mid: number; roll: number }[] = [];
  for (const f of FILES)
    for (let r = 1; r <= 8; r++) {
      const square = `${f}${r}`;
      const piece = pieceAt(fen, square);
      if (!piece || piece.color !== crowd || piece.type === "k") continue;
      if (!legal.some((m) => !heldIn(fen, m, [square])) || !burnLegalNow(fen, square, crowd)) continue;
      options.push({ square, piece: piece.type, score: VALUE[piece.type] ?? 0, mid: offCenter(square), roll: powerRoll(seed, "frostfire", turn, square) });
    }
  options.sort((a, b) => b.score - a.score || a.mid - b.mid || a.roll - b.roll || (a.square < b.square ? -1 : 1));
  const pick = options[0];
  return pick ? { square: pick.square, piece: pick.piece } : null;
}

/** What the burn does to its tile after the crowd's move (`fen`, him to move). */
export interface FrostfireOutcome {
  /** The position after it (the same when it spares the piece). */
  fen: string;
  /** The piece it reached: its kind and whose. */
  piece: string;
  side: Side;
  /** Not burnt: a king, or a loss that would leave a position no game can have. */
  spared?: true;
}

/**
 * The burn on `square` after the crowd's move (`fen`, him to move): null when nothing stands there. A king is spared (kings never
 * burn). Any other piece, either side's, is taken off the board (the en passant square as the engine keeps it), unless that would
 * leave a position no game can have: the crowd's king attacked (the side not to move in check), his king checked by the gap, a
 * promotion handed to him he didn't have, or no move left for him; then `spared`. Never called once the game is over on the board.
 */
export function frostfireOutcome(fen: string, square: string): FrostfireOutcome | null {
  const piece = pieceAt(fen, square);
  if (!piece) return null;
  const side = piece.color as Side;
  if (piece.type === "k") return { fen, piece: "k", side, spared: true };
  const mover = sideToMove(fen);
  let after: string;
  try {
    after = keptEnPassant(withoutPiece(fen, square));
  } catch {
    return { fen, piece: piece.type, side, spared: true };
  }
  const moves = legalMoves(after);
  const promos = (ms: readonly string[]) => new Set(ms.filter((m) => m.length === 5).map((m) => m.slice(0, 4)));
  const now = promos(moves);
  const before = now.size ? promos(legalMoves(fen)) : now;
  const handed = [...now].some((m) => !before.has(m));
  const bad = !moves.length || handed || kingAttacked(after, other(mover)) || (!kingAttacked(fen, mover) && kingAttacked(after, mover)) || !!stockfishRefuses(after);
  return bad ? { fen, piece: piece.type, side, spared: true } : { fen: after, piece: piece.type, side };
}

/** One square's burn in a burn of several (burnAll): the piece it burnt (`piece`, `side`), or `spared`; neither: nothing there. */
export interface BurnResult {
  square: string;
  piece?: string;
  side?: Side;
  spared?: true;
}

/**
 * The burn of several squares at once after the crowd's move (`fen`, him to move): the storm's fire marks (and the Frostfire's tile, one
 * square). Each square in turn, by name, on the position the ones before it left: frostfireOutcome's rules for each (a king, or a loss no
 * game can have, spared). Returns the position after them all and each square's outcome.
 */
export function burnAll(fen: string, squares: readonly string[]): { fen: string; burnt: BurnResult[] } {
  let now = fen;
  const burnt: BurnResult[] = [];
  for (const square of [...new Set(squares)].sort()) {
    const out = frostfireOutcome(now, square);
    if (!out) {
      burnt.push({ square });
      continue;
    }
    if (!out.spared) now = out.fen;
    burnt.push({ square, piece: out.piece, side: out.side, ...(out.spared ? { spared: true as const } : {}) });
  }
  return { fen: now, burnt };
}

const squaresOf = (squares: string | readonly string[] | null | undefined): readonly string[] => (!squares ? [] : typeof squares === "string" ? [squares] : squares);

// ---------------- The judge ----------------

const lossMemo = new Map<string, number>();

/**
 * What a crowd move (`fen`, the crowd to move) leaves to the burn on `squares` (the Frostfire's tile, or the storm's fire marks): the value
 * of the crowd's pieces it would burn (pawn 1 ... queen 9), less the value of his pieces it would burn; 0 when nothing burns, it's spared,
 * or the game is over after the move.
 */
export function burnLoss(fen: string, move: string, squares: string | readonly string[], crowd: Side): number {
  const list = squaresOf(squares);
  if (!list.length) return 0;
  const key = `${fen}|${list.join(",")}|${move}`;
  const hit = lossMemo.get(key);
  if (hit !== undefined) return hit;
  let loss = 0;
  try {
    const after = applyMove(fen, move);
    if (!positionOver(after)) for (const b of burnAll(after, list).burnt) if (b.piece && !b.spared) loss += (b.side === crowd ? 1 : -1) * (VALUE[b.piece] ?? 0);
  } catch {
    loss = 0;
  }
  lossMemo.set(key, loss);
  if (lossMemo.size > 2000) lossMemo.delete(lossMemo.keys().next().value!);
  return loss;
}

/** A move's expected score with what the burn takes off (burnPawnLogit log-odds a pawn of value; his piece burnt: as much added). */
export function burnExpected(expected: number, lost: number, s: Pick<StrangerSettings, "burnPawnLogit"> = BOSS_POWERS.stranger): number {
  if (!lost) return expected;
  return 1 / (1 + Math.exp(-(logit(expected) - lost * s.burnPawnLogit)));
}

/** Top moves as the burn's judge ranks them (bots, hints): expected after the burn, best first; a tie to the move that loses less. */
export function burnRanked(top: readonly MoveScore[], fen: string, squares: string | readonly string[] | null | undefined, crowd: Side): MoveScore[] {
  const square = squaresOf(squares);
  if (!square.length) return [...top];
  return top
    .map((m) => ({ m, loss: burnLoss(fen, m.move, square, crowd) }))
    .map(({ m, loss }) => ({ m: { ...m, expected: burnExpected(m.expected, loss) }, loss }))
    .sort((a, b) => b.m.expected - a.m.expected || a.loss - b.loss || (a.m.move < b.m.move ? -1 : 1))
    .map(({ m }) => m);
}

/** A board's evaluation as the burn's judge sees it (the flee turn's tile): every move's expected after the burn, the best the best of those. */
export function burnJudged<E extends JudgedEvaluation>(evaluation: E, fen: string, squares: string | readonly string[] | null | undefined, crowd: Side): E {
  const square = squaresOf(squares);
  if (!square.length) return evaluation;
  const loss = (m: string) => burnLoss(fen, m, square, crowd);
  const expectedAfter = Object.fromEntries(Object.entries(evaluation.expectedAfter).map(([m, e]) => [m, burnExpected(e, loss(m))]));
  let bestMove = evaluation.bestMove;
  let bestExpected = expectedAfter[bestMove] ?? burnExpected(evaluation.bestExpected, loss(bestMove));
  let bestLoss = loss(bestMove);
  for (const [m, e] of Object.entries(expectedAfter).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (e < bestExpected || (e === bestExpected && loss(m) >= bestLoss)) continue;
    [bestMove, bestExpected, bestLoss] = [m, e, loss(m)];
  }
  return { ...evaluation, bestMove, bestExpected, expectedAfter };
}

/** The moves that move the crowd's pieces off the tiles that burn after this move (the flee turn's, a fire turn's): the judge scores them all. */
export function burnEscapes(fen: string, squares: string | readonly string[] | null | undefined, crowd: Side): string[] {
  const mine = squaresOf(squares).filter((sq) => pieceAt(fen, sq)?.color === crowd);
  return mine.length ? legalMoves(fen).filter((m) => mine.includes(from(m))) : [];
}

// ---------------- His ultimate: the Storm of Two Worlds ----------------

/** The other kind of storm turn. */
export const otherKind = (k: StormKind): StormKind => (k === "fire" ? "ice" : "fire");
/** The kind his storm's turn `turn` is: its first kind on its 1st and 3rd turns, the other on its 2nd. */
export const stormKindOn = (storm: { at: number; first: StormKind }, turn: number): StormKind => ((turn - storm.at) % 2 === 0 ? storm.first : otherKind(storm.first));
/** The kind a storm begins with (Eric: "sometimes he starts with fire, sometimes he starts with ice"): from the seed and how many he has had. */
export const stormFirst = (seed: number, ults: number): StormKind => (powerRoll(seed, "storm-first", ults) < 0.5 ? "fire" : "ice");
/** His storm runs on crowd turn `turn`. */
export const stormOn = (st: Pick<StrangerState, "storm"> | null | undefined, turn: number, s: Pick<StrangerSettings, "stormTurns"> = BOSS_POWERS.stranger): boolean =>
  !!st?.storm && turn >= st.storm.at && turn < st.storm.at + Math.max(1, Math.round(s.stormTurns));

/** What the engine needs to pick a storm turn after his move (the boss request's `storm`): the turn's kind and the order ties break in. */
export interface StormAsk {
  kind: StormKind;
  order: number;
}
/** A storm turn's pick: the free pieces (ice: the king is free too) or the marked squares (fire); `mild`, the fairness check's milder one. */
export interface StormAnswer {
  squares: string[];
  mild?: true;
}

const FILE_SQ = [..."abcdefgh"].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`));
const kingOf = (fen: string, side: Side): string | null => FILE_SQ.find((sq) => pieceAt(fen, sq)?.type === "k" && pieceAt(fen, sq)?.color === side) ?? null;
/** The crowd's pieces but its king (by square, a1 first). */
const crowdPieces = (fen: string, crowd: Side): string[] => FILE_SQ.filter((sq) => pieceAt(fen, sq)?.color === crowd && pieceAt(fen, sq)?.type !== "k");
/** The squares a move lands its pieces on (castling: the king's and the rook's). */
const landings = (fen: string, move: string): string[] => movePaths(move, fen).map((p) => p.to);
/** A seeded shuffle (the ask's `order`, then the try). */
const seeded = <T>(items: readonly T[], order: number, k: number): T[] => {
  const rng = mulberry32((order + Math.imul(k + 1, 0x9e3779b1)) >>> 0);
  return items
    .map((x) => ({ x, r: rng() }))
    .sort((a, b) => a.r - b.r)
    .map(({ x }) => x);
};

/** The engine's top moves, best first (the highest expected; ties by move), only legal ones. */
const ranked = (top: readonly MoveScore[], legal: readonly string[]): MoveScore[] =>
  top.filter((m) => legal.includes(m.move)).sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));

/**
 * The fairness promise (the director's reading of Eric's "you always have a good move, but you only have 1 or 2"): with the storm's pick,
 * the crowd's best move loses at most `fairPawns` against its best without the storm, and its next best at most `decentPawns` (or, where
 * the position itself has only one good move, no more than its own second best plus `fairPawns`). `top`: the engine's top moves without
 * the storm, best first (every legal move of the position when there are fewer than its lines); `under`: a move's expected score with the
 * storm, null when the storm takes it away (frozen). Only the moves the engine scored count, so a pick is never passed on a move it
 * didn't see. Pawns of log-odds at burnPawnLogit, the burn's own. `legal`: how many legal moves the position has.
 */
export function stormFair(top: readonly MoveScore[], under: (m: MoveScore) => number | null, legal: number, s: Pick<StrangerSettings, "fairPawns" | "decentPawns" | "burnPawnLogit"> = BOSS_POWERS.stranger): { fair: boolean; best: number; next: number | null } {
  const e0 = top[0]?.expected;
  if (e0 === undefined) return { fair: false, best: Infinity, next: null };
  const pawns = (e: number) => (logit(e0) - logit(e)) / s.burnPawnLogit;
  const open = top
    .map(under)
    .filter((v): v is number => v !== null)
    .sort((a, b) => b - a);
  const best = open.length ? pawns(open[0]!) : Infinity;
  const next = open.length > 1 ? pawns(open[1]!) : null;
  if (best > s.fairPawns + 1e-9) return { fair: false, best, next };
  if (legal < 2) return { fair: true, best, next };
  const bar = Math.max(s.decentPawns, top[1] ? pawns(top[1].expected) + s.fairPawns : s.decentPawns);
  return { fair: next !== null && next <= bar + 1e-9, best, next };
}

/**
 * The ice turn's pick (Eric: "every turn it toggles between scattering spots on the board where anything that's left there will freeze or
 * burn"; the director's design): the crowd's pieces left free, all its others frozen for the turn but the king (never frozen). `iceFree`
 * of them: the piece of the engine's best move that isn't the king's (so it's always there to play), and the others from the seed, kept
 * when the fairness check passes; up to `stormTries` picks, then the milder one: the pieces of the crowd's top three moves (and from the
 * seed, up to `iceFree`). `fen`: the crowd to move; `top`: the engine's top moves there.
 */
export function icePick(fen: string, top: readonly MoveScore[], order: number, s: StrangerSettings = BOSS_POWERS.stranger): StormAnswer {
  const crowd = sideToMove(fen);
  const legal = legalMoves(fen);
  const best = ranked(top, legal);
  const king = kingOf(fen, crowd);
  const pieces = crowdPieces(fen, crowd);
  const movers = pieces.filter((sq) => legal.some((m) => from(m) === sq));
  const lead = best.find((m) => from(m.move) !== king);
  const a = lead ? from(lead.move) : null;
  const want = Math.max(1, Math.round(s.iceFree));
  const fair = (free: readonly string[]) => {
    const frozen = pieces.filter((sq) => !free.includes(sq));
    const open = new Set(legal.filter((m) => !heldIn(fen, m, frozen)));
    return open.size > 0 && stormFair(best, (m) => (open.has(m.move) ? m.expected : null), legal.length, s).fair;
  };
  const rest = movers.filter((sq) => sq !== a);
  const base = a ? [a] : [];
  if (rest.length <= want - base.length) return { squares: [...base, ...rest] };
  for (let k = 0; k < Math.max(1, Math.round(s.stormTries)); k++) {
    const free = [...base, ...seeded(rest, order, k).slice(0, want - base.length)];
    if (fair(free)) return { squares: free };
  }
  const tops = [...new Set(best.slice(0, 3).map((m) => from(m.move)))].filter((sq) => sq !== king && pieces.includes(sq));
  const mild = [...tops, ...seeded(rest, order, 0).filter((sq) => !tops.includes(sq))].slice(0, Math.max(want, tops.length));
  return { squares: mild, mild: true };
}

/**
 * The fire turn's pick: `fireMarks` squares (3 or 4, from the seed) marked to burn whatever stands on them after the crowd's move. Never
 * on his pieces or the crowd's king; at most one of the crowd's pieces, the one the engine's best move moves (it has to find that move,
 * or a decent one, to save it), the rest on empty squares the crowd's moves could land on (never where its best move lands). Kept when
 * the fairness check passes (each move's score less what the burn takes, the judge's way: burnExpected); up to `stormTries` picks, with
 * and without that piece by turns; then the milder one: one mark fewer, all on empty squares where none of its top three moves land.
 */
export function firePick(fen: string, top: readonly MoveScore[], order: number, s: StrangerSettings = BOSS_POWERS.stranger): StormAnswer {
  const crowd = sideToMove(fen);
  const legal = legalMoves(fen);
  const best = ranked(top, legal);
  const sizes = s.fireMarks.length ? s.fireMarks : [3];
  const n = Math.max(1, Math.round(sizes[Math.floor(mulberry32(order >>> 0)() * sizes.length)]!));
  const empty = FILE_SQ.filter((sq) => !pieceAt(fen, sq));
  const first = best[0];
  const bestLands = first ? landings(fen, first.move) : [];
  const piece = first && pieceAt(fen, from(first.move))?.type !== "k" && burnLegalNow(fen, from(first.move), crowd) ? from(first.move) : null;
  const bite = [...new Set(legal.flatMap((m) => landings(fen, m)))].filter((sq) => !pieceAt(fen, sq) && !bestLands.includes(sq)).sort();
  const fair = (marks: readonly string[]) =>
    stormFair(best, (m) => burnExpected(m.expected, burnLoss(fen, m.move, marks, crowd), s), legal.length, s).fair;
  for (let k = 0; k < Math.max(1, Math.round(s.stormTries)); k++) {
    const withPiece = !!piece && k % 2 === 0;
    const need = n - (withPiece ? 1 : 0);
    const pool = [...seeded(bite, order, k), ...seeded(empty.filter((sq) => !bite.includes(sq) && !bestLands.includes(sq)), order, k)];
    const marks = [...(withPiece ? [piece!] : []), ...pool.slice(0, need)].sort();
    if (marks.length && fair(marks)) return { squares: marks };
  }
  const safe = best.slice(0, 3).flatMap((m) => landings(fen, m.move));
  const calm = empty.filter((sq) => !safe.includes(sq));
  return { squares: seeded(calm, order, 99).slice(0, Math.max(1, n - 1)).sort(), mild: true };
}

/**
 * A storm turn's pick after his move, on this device's engines (the host's online, solo's and the sims' own): one search of the crowd's
 * top `stormLines` moves at `stormNodes` on the position after his move (`fen`, the crowd to move), then the turn's pick (icePick,
 * firePick). Null: no engine answer or no move for the crowd (the turn is calm).
 */
export async function stormPick(engines: readonly EngineLike[], fen: string, ask: StormAsk, s: StrangerSettings = BOSS_POWERS.stranger): Promise<StormAnswer | null> {
  const engine = engines[0];
  if (!engine || !legalMoves(fen).length) return null;
  let top: readonly MoveScore[];
  try {
    top = await (engine.topMovesAt ? engine.topMovesAt(fen, s.stormLines, s.stormNodes) : engine.topMoves(fen, s.stormLines));
  } catch {
    return null;
  }
  if (!ranked(top, legalMoves(fen)).length) return null;
  return ask.kind === "ice" ? icePick(fen, top, ask.order, s) : firePick(fen, top, ask.order, s);
}

/** The pick as the host sends it (the boss move's `storm`): its squares by spaces, a mild one led by "!" ("" none). */
export const stormCode = (a: StormAnswer | null): string => (a ? `${a.mild ? "!" : ""}${a.squares.join(" ")}` : "");
/** The host's answer (stormPick's, as stormCode writes it). */
export async function stormAnswer(engines: readonly EngineLike[], fen: string, ask: StormAsk): Promise<string> {
  return stormCode(await stormPick(engines, fen, ask).catch(() => null));
}

/**
 * The server's check of the host's pick (online) or this device's (solo), on the position after his move (`fen`, the crowd to move), by
 * the rules alone: ice, 1 to `iceFree` + 1 of the crowd's pieces but its king, freeing at least one legal move, the frozen pieces all the
 * others; fire, 1 to the most `fireMarks` squares, none his piece or a king, at most one of the crowd's pieces worth more than a pawn (the
 * rest on pawns or empty). Null: not a pick (the turn is calm).
 */
export function stormCheck(fen: string, kind: StormKind, code: string | null | undefined, s: StrangerSettings = BOSS_POWERS.stranger): { squares: string[]; free?: string[]; mild?: true } | null {
  if (typeof code !== "string" || !code.trim()) return null;
  const mild = code.startsWith("!");
  const list = code.replace(/^!/, "").trim().split(/\s+/);
  if (list.some((sq) => !FILE_SQ.includes(sq)) || new Set(list).size !== list.length) return null;
  const crowd = sideToMove(fen);
  const legal = legalMoves(fen);
  if (!legal.length) return null;
  const more = mild ? { mild: true as const } : {};
  if (kind === "ice") {
    const pieces = crowdPieces(fen, crowd);
    if (list.length > Math.round(s.iceFree) + 1 || list.some((sq) => !pieces.includes(sq))) return null;
    const frozen = pieces.filter((sq) => !list.includes(sq));
    if (!legal.some((m) => !heldIn(fen, m, frozen))) return null;
    return { squares: frozen, free: [...list].sort(), ...more };
  }
  if (list.length > Math.max(...s.fireMarks, 1)) return null;
  const on = list.map((sq) => pieceAt(fen, sq));
  if (on.some((p) => p && (p.color !== crowd || p.type === "k"))) return null;
  if (on.filter((p) => p && p.type !== "p").length > 1) return null;
  return { squares: [...list].sort(), ...more };
}

/**
 * The storm's ask with his move now (the boss request's `storm`; solo's own), or null: the crowd's next turn (`turnOf`) is one of his
 * storm's: its 2nd or 3rd turn under way, or its first, due (the warning given a turn before, or the admins' trigger taken). Never while
 * the Frostfire's strike is under way (the storm waits for its burn), once the battle is decided, or after his last (stormMax, ultCapped).
 */
export function stormWanted(boss: BossState, s: StrangerSettings = BOSS_POWERS.stranger): StormAsk | null {
  const p = boss.powers;
  if (boss.id !== "stranger" || !p || boss.result) return null;
  const st = strangerOf(p);
  const turn = turnOf(boss);
  const order = (ults: number) => Math.floor(powerRoll(p.seed, "storm", ults, turn) * 2 ** 32);
  if (st.storm && stormOn(st, turn, s)) return turn > st.storm.at ? { kind: stormKindOn(st.storm, turn), order: order(p.ults ?? 0) } : null;
  const ults = p.ults ?? 0;
  if (p.ultAt !== undefined || ultCapped(p) || ults >= Math.round(s.stormMax) || st.strike) return null;
  const due = !!p.ultNext || (p.warnAt !== undefined && turn > p.warnAt);
  return due ? { kind: stormFirst(p.seed, ults), order: order(ults) } : null;
}

/** The pick for crowd turn `turn`, if his move made one for it. */
const pickFor = (st: StrangerState, turn: number) => (st.pick && st.pick.turn === turn ? st.pick : null);

/** The squares the storm freezes on crowd turn `turn` (an ice turn's, the crowd's pieces still on them in `fen`). */
export function stormIced(boss: Pick<BossState, "id" | "powers" | "crowdSide">, turn: number, fen: string): string[] {
  const st = boss.id === "stranger" ? boss.powers?.stranger : null;
  const pick = st && stormOn(st, turn) ? pickFor(st, turn) : null;
  if (!pick || pick.kind !== "ice") return [];
  return pick.squares.filter((sq) => pieceAt(fen, sq)?.color === boss.crowdSide && pieceAt(fen, sq)?.type !== "k");
}

/** The squares the storm's fire marks on crowd turn `turn` (they burn after its move). */
export function stormMarks(boss: Pick<BossState, "id" | "powers"> | null | undefined, turn: number): string[] {
  const st = boss?.id === "stranger" ? boss.powers?.stranger : null;
  const pick = st && stormOn(st, turn) ? pickFor(st, turn) : null;
  return pick && pick.kind === "fire" ? pick.squares : [];
}

// ---------------- His state ----------------

const fresh = (s: Pick<StrangerSettings, "strikeFrom"> = BOSS_POWERS.stranger): StrangerState => ({ next: s.strikeFrom, strike: null });
const strangerOf = (p: Pick<BossPowerState, "stranger"> | null | undefined): StrangerState => p?.stranger ?? fresh();

/** The strike under way (or null). */
export const strikeOf = (p: Pick<BossPowerState, "stranger"> | null | undefined) => p?.stranger?.strike ?? null;

/** The square his strike holds frozen on crowd turn `turn` (with the crowd's piece still on it, `fen`), or null. */
export function frozenOn(boss: Pick<BossState, "id" | "powers" | "crowdSide">, turn: number, fen: string): string | null {
  const st = boss.id === "stranger" ? strikeOf(boss.powers) : null;
  return st && turn >= st.turn && turn <= st.frozenUntil && pieceAt(fen, st.square)?.color === boss.crowdSide ? st.square : null;
}

/**
 * The squares that burn after the crowd's move now, which the judge weighs: the Frostfire strike's tile on its flee turn's last (the one
 * whose move the burn follows), and the storm's fire marks on a fire turn. [] none.
 */
export const burnSquares = (boss: Pick<BossState, "id" | "powers" | "crowdMoves"> | null | undefined): string[] => {
  if (boss?.id !== "stranger") return [];
  const st = strikeOf(boss.powers);
  return [...(st && turnOf(boss) === st.burnAt ? [st.square] : []), ...stormMarks(boss, turnOf(boss))];
};

/** What the screens get of his state (NetBossPowers' `stranger`). */
export interface StrangerView {
  /** The strike under way: its tile, the piece it struck, the crowd turn it came, its last frozen turn and the crowd move it burns after. */
  strike: { turn: number; square: string; piece: string; frozenUntil: number; burnAt: number } | null;
  /** The last burn (after crowd move `at`): the piece burnt (`piece`, `side`), or spared; nothing there: neither. */
  burn: { at: number; square: string; piece?: string; side?: Side; spared?: true } | null;
  /** His storm: its first crowd turn and kind (its turns: stormOn); none yet: null. */
  storm?: { at: number; first: StormKind } | null;
  /** The storm's pick for crowd turn `turn` (its frozen pieces or marked squares; `free`, an ice turn's free pieces), or null. */
  pick?: { turn: number; kind: StormKind; squares: string[]; free?: string[]; mild?: true; calm?: true } | null;
  /** A fire turn's burn (after crowd move `at`): each mark's outcome. */
  scorch?: { at: number; burnt: BurnResult[] } | null;
}

const boardOf = (b: Battle): BoardState => b.boards.get(b.state.boards[0]!)!;

/** His Frostfire waits from the storm's warning until `stormRest` turns after the storm (no strike shares a turn with it). */
const stormHolds = (next: BossPowerState, t: { turn: number; s: BossPowerSettings }): boolean => {
  const st = next.stranger;
  const s = t.s.stranger;
  return next.warnAt !== undefined || (!!st?.storm && t.turn >= st.storm.at && t.turn < st.storm.at + Math.round(s.stormTurns) + Math.round(s.stormRest));
};

/**
 * The Stranger: his Frostfire strike freezes your best piece for a turn, then its tile burns whatever is left on it; his Storm of Two
 * Worlds (the rage meter's, at most stormMax a battle) gives you three turns of ice and fire, the engine leaving you a good move each.
 */
export const STRANGER: BossRules = {
  id: "stranger",
  // (The trigger waits for his move: each storm turn's pick comes with it.)
  triggerAtHisTurn: true,
  // At most stormMax storms a battle (Eric, Nov 27: "up to 2 times a game"): after the last his meter stays empty, shown dimmed.
  get ultimateMax() {
    return Math.round(BOSS_POWERS.stranger.stormMax);
  },
  spentMeterShown: true,
  // (A strike left from another turn, past its burn: gone. Only afterCrowdMove burns. A pick for a turn gone by: gone.)
  wearOff(next, t) {
    const st = next.stranger;
    if (st?.strike && t.turn > st.strike.burnAt) next.stranger = { ...st, strike: null };
    const now = next.stranger;
    if (now?.pick && now.pick.turn < t.turn) next.stranger = { ...now, pick: null };
  },
  // The storm: the meter full (or the test switch), a warning as this turn begins; as the next begins, it comes, with its first turn's
  // pick made with his move (stormWanted, stormPick). No pick (his move went without the ask): it waits a turn, the warning kept. The
  // trigger: the next turn his move made a pick for. Never while the Frostfire's strike is under way (the warning waits for its burn).
  ultimate(next, t) {
    const st = strangerOf(next);
    const busy = !!st.strike && st.strike.burnAt >= t.turn;
    const ready = pickFor(st, t.turn);
    const land = (): boolean => {
      next.ultAt = t.turn;
      delete next.ultNext;
      next.stranger = { ...st, storm: { at: t.turn, first: ready!.kind } };
      t.events.push({ kind: "storm", turn: t.turn });
      return true;
    };
    if (t.ultNext) return ready && !busy ? land() : false;
    if (next.warnAt === undefined) {
      if (!busy && (meterFull(next, t) || testSwitch(t, next))) {
        next.warnAt = t.turn;
        t.events.push({ kind: "warn", turn: t.turn });
      }
      return false;
    }
    return t.turn > next.warnAt && ready && !busy ? land() : false;
  },
  // While its turns run, the meter stays empty; after his last, for the rest of the battle (none come).
  ultimateRunning: (p, turn, s) => (p.ults ?? 0) >= Math.round(s.stranger.stormMax) || stormOn(p.stranger, turn, s.stranger),
  // Each storm turn as it begins: its pick (made with his move before it; none, or the wrong kind: calm), its frozen pieces still there.
  everyTurn(next, t) {
    const st = next.stranger;
    if (!st?.storm || !stormOn(st, t.turn, t.s.stranger)) return;
    const kind = stormKindOn(st.storm, t.turn);
    const got = pickFor(st, t.turn);
    const pick = got && got.kind === kind ? got : { turn: t.turn, kind, squares: [], calm: true as const };
    const squares = kind === "ice" ? pick.squares.filter((sq) => pieceAt(t.fen, sq)?.color === t.crowd && pieceAt(t.fen, sq)?.type !== "k") : pick.squares.filter((sq) => pieceAt(t.fen, sq)?.color !== other(t.crowd) && pieceAt(t.fen, sq)?.type !== "k");
    next.stranger = { ...st, pick: { ...pick, squares } };
    t.events.push({ kind: kind === "ice" ? "stormIce" : "stormFire", turn: t.turn, squares });
  },
  // The strike, as a crowd turn begins (after his move): when one is due (strikeFrom, then strikeEvery turns apart; the test switch
  // ?power=frostfire: from his first move, again as soon as the last has burnt), on the piece chooseStrike picks; none fits: next turn.
  passive(next, t) {
    const s = t.s.stranger;
    const st = next.stranger ?? fresh(s);
    const test = t.test === "frostfire";
    const from = test ? 2 : s.strikeFrom;
    if (st.strike || t.turn < from || (t.turn < st.next && !test) || stormHolds(next, t)) {
      if (!next.stranger) next.stranger = st;
      return;
    }
    const pick = chooseStrike(t.fen, t.crowd, t.seed, t.turn, t.crowdMoves?.());
    if (!pick) {
      next.stranger = { ...st, next: t.turn + 1 };
      return;
    }
    const frozenUntil = t.turn + Math.max(1, Math.round(s.freezeTurns)) - 1;
    const burnAt = frozenUntil + Math.max(1, Math.round(s.fleeTurns));
    const every = Math.max(burnAt - t.turn + 1, Math.round(s.strikeEvery));
    next.stranger = { ...st, strike: { turn: t.turn, ...pick, frozenUntil, burnAt }, next: test ? burnAt + 1 : t.turn + every };
    t.events.push({ kind: "frostfire", turn: t.turn, square: pick.square, ...(pick.piece !== "k" ? { shape: pick.piece as BalloonShape } : {}) });
  },
  // (A strike whose burn would come at or after the move cap, bossMaxMoves: no burn comes then, so no strike either, and the judge, the
  // dock and the board agree.)
  turnBegun(b) {
    const boss = b.state.boss!;
    const p = boss.powers;
    const st = p?.stranger?.strike;
    // (A fire turn at the move cap: no burn comes after it, so no marks either, and the judge, the dock and the board agree.)
    const pick = p?.stranger?.pick;
    if (p && pick?.kind === "fire" && pick.turn === turnOf(boss) && pick.squares.length && pick.turn >= b.settings.bossMaxMoves)
      b.state = { ...b.state, boss: { ...boss, powers: { ...p, stranger: { ...p.stranger!, pick: { ...pick, squares: [], calm: true } } } } };
    if (!p || !st || st.turn !== turnOf(boss) || st.burnAt < b.settings.bossMaxMoves) return;
    const now = b.state.boss!.powers!;
    const events = now.events.filter((e) => !(e.kind === "frostfire" && e.turn === st.turn));
    b.state = { ...b.state, boss: { ...b.state.boss!, powers: { ...now, stranger: { ...now.stranger!, strike: null }, events } } };
  },
  // The frozen piece can't move, nor castle with a frozen rook (held on the board layer); the storm's ice the same, for its turn; lifted
  // if it would leave no move.
  layer(boss, fen) {
    const sq = frozenOn(boss, turnOf(boss), fen);
    return heldBy(boss, "frozen", [...(sq ? [sq] : []), ...stormIced(boss, turnOf(boss), fen)]);
  },
  iced(boss, fen) {
    const sq = frozenOn(boss, turnOf(boss), fen);
    return [...(sq ? [sq] : []), ...stormIced(boss, turnOf(boss), fen)];
  },
  // The frozen turn and the flee turn, and the storm's turns: a power touches them (no fair-play signal; the Last Stand sits out).
  powerTurn: (boss) => {
    const st = strikeOf(boss.powers);
    return (!!st && turnOf(boss) >= st.turn && turnOf(boss) <= st.burnAt) || stormOn(boss.powers?.stranger, turnOf(boss));
  },
  judge: {
    mustScore: (boss, fen) => burnEscapes(fen, burnSquares(boss), boss.crowdSide),
    offer: (boss, fen) => burnEscapes(fen, burnSquares(boss), boss.crowdSide),
    rank: (boss, top, fen) => burnRanked(top, fen, burnSquares(boss), boss.crowdSide),
    evaluation: (boss, evaluation, fen) => burnJudged(evaluation, fen, burnSquares(boss), boss.crowdSide),
  },
  afterCrowdMove(b) {
    strangerBattle.afterCrowdMove(b);
    strangerBattle.stormBurn(b);
  },
  // (His move made the storm's next turn's pick: kept for that turn, checked.)
  afterBossMove(b, _move, extras) {
    strangerBattle.afterHisMove(b, extras?.storm ?? null);
  },
  // (The test switch ?power=finisher: the battle starts on FINISHER_TEST, your move first.)
  opening: {
    setUp(b, at) {
      if (!finisherTest(b.settings.bossPowerTest).on) return {};
      const fen = FINISHER_TEST[at.crowdSide];
      const board = newBoard(at.boardId, BOSS_OPENING, 0, at.generation);
      b.boards.set(at.boardId, { ...board, fen, bases: [{ ply: 0, fen }] });
      return {};
    },
  },
  view: (p) => {
    const st = strangerOf(p);
    return {
      stranger: {
        strike: st.strike ? { ...st.strike } : null,
        burn: st.burn ? { ...st.burn } : null,
        storm: st.storm ? { ...st.storm } : null,
        // (Only the turn's own pick: the next one, made with his move, shows as its turn begins.)
        pick: st.pick && st.pick.turn === p.turn ? { ...st.pick, squares: [...st.pick.squares] } : null,
        scorch: st.scorch ? { at: st.scorch.at, burnt: st.scorch.burnt.map((x) => ({ ...x })) } : null,
      },
    };
  },
};

// ---------------- His part in the match runner ----------------

export const strangerBattle = {
  /** The test switch's move (`?power=finisher`, solo): a capture of your most valuable piece that isn't a pawn (nor the king); else null. */
  testMove(b: Battle, allowed: readonly string[] | null): string | null {
    const boss = b.state.boss;
    if (!boss || boss.id !== "stranger" || !finisherTest(b.settings.bossPowerTest).on || !b.bossToMove()) return null;
    const fen = boardOf(b).fen;
    const takes = (allowed ?? legalMoves(fen))
      .map((m) => ({ m, sq: capturedSquare(fen, m) }))
      .map(({ m, sq }) => ({ m, v: sq ? pieceAt(fen, sq) : null }))
      .filter((x) => x.v && x.v.color === boss.crowdSide && x.v.type !== "p" && x.v.type !== "k")
      .sort((a, c) => (VALUE[c.v!.type] ?? 0) - (VALUE[a.v!.type] ?? 0) || (a.m < c.m ? -1 : 1));
    return takes[0]?.m ?? null;
  },

  /**
   * His finisher, as his move is about to show (`move`: the move he plays; him to move): a move that takes a piece of yours that isn't a
   * pawn (nor the king) is shown as his leap onto the board and a finisher on that piece (`finisher`: `square`, `shape`, `pick` from the
   * seed, the same on every device), then the move. The server holds the move for it, solo waits (STRANGER_FX.finisher; the runner's
   * bossMoveMoment). The move itself is an ordinary capture. Marked once a turn (the server asks again as it plays the held move); never
   * once the battle is over. The event carries the move (`move`): the board shows it from the finisher's `gone` beat, so when the held
   * move plays the board already matches it. Returns how long it holds his move (ms: STRANGER_FX.finisher; his block, if any, played in
   * his thinking: strangerTurnMs); 0: none.
   */
  finisher(b: Battle, move: string): number {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "stranger" || boss.result || !b.bossToMove() || b.finalGameOver()) return 0;
    if (p.events.some((e) => e.kind === "finisher" && e.turn === p.turn)) return 0;
    const board = boardOf(b);
    const fen = board.fen;
    if (!legalMoves(fen).includes(move)) return 0;
    const sq = capturedSquare(fen, move);
    const piece = sq ? pieceAt(fen, sq) : null;
    if (!sq || !piece || piece.color !== boss.crowdSide || piece.type === "p" || piece.type === "k") return 0;
    const forced = finisherTest(b.settings.bossPowerTest).kind;
    const pick = forced >= 0 ? forced : Math.floor(powerRoll(p.seed, "finisher", p.turn, sq) * 4096);
    const event: PowerEvent = { kind: "finisher", turn: p.turn, square: sq, shape: piece.type as BalloonShape, pick, move };
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, events: [...p.events, event] } } };
    return STRANGER_FX.finisher;
  },

  /**
   * After the crowd's move with him to move: the strike's tile burns as crowd move `burnAt` lands (frostfireOutcome: whatever stands there,
   * a king or a loss no game can have spared; nothing there, the tile burns empty). A base on the board where it changes it. Nothing
   * once the battle is decided, the game is over on the board, or at the move cap.
   */
  afterCrowdMove(b: Battle): void {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "stranger") return;
    const st = strangerOf(p);
    const strike = st.strike;
    if (!strike || boss.crowdMoves !== strike.burnAt) return;
    const board = boardOf(b);
    const over = !!boss.result || b.finalGameOver() || boardEnd(board) !== null || boss.crowdMoves >= b.settings.bossMaxMoves;
    if (over) return;
    const out = frostfireOutcome(board.fen, strike.square);
    const events: PowerEvent[] = [
      {
        kind: "frostfireBurn",
        turn: p.turn,
        square: strike.square,
        ...(out && out.piece !== "k" ? { shape: out.piece as BalloonShape } : {}),
        ...(out?.spared ? { fizzled: [strike.square] } : {}),
      },
    ];
    if (out && !out.spared) {
      const ply = board.history.length;
      b.boards.set(board.id, { ...board, fen: out.fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: out.fen }] });
    }
    const burn: StrangerState["burn"] = { at: boss.crowdMoves, square: strike.square, ...(out ? { piece: out.piece, side: out.side } : {}), ...(out?.spared ? { spared: true as const } : {}) };
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, stranger: { ...st, strike: null, burn }, events: [...p.events, ...events] } } };
  },

  /** The storm's ask with his move now (the boss request's `storm`; solo's own), or null: none wanted (stormWanted). */
  stormAsk(b: Battle): StormAsk | null {
    const boss = b.state.boss;
    if (!boss || !b.bossToMove() || b.finalGameOver()) return null;
    return stormWanted(boss, (b.rageRates?.() ?? BOSS_POWERS).stranger);
  },

  /**
   * After his move (`code`: the storm's pick for the crowd's next turn, the host's answer online, this device's solo: stormCode's): when
   * the next turn is one of his storm's (stormWanted), the pick kept for it, checked by the rules on the position now (stormCheck); none,
   * or refused: that turn is calm (its kind kept, nothing frozen or marked).
   */
  afterHisMove(b: Battle, code: string | null): void {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "stranger") return;
    const s = (b.rageRates?.() ?? BOSS_POWERS).stranger;
    const ask = stormWanted(boss, s);
    if (!ask) return;
    const fen = boardOf(b).fen;
    const ok = sideToMove(fen) === boss.crowdSide ? stormCheck(fen, ask.kind, code, s) : null;
    const pick: NonNullable<StrangerState["pick"]> = ok ? { turn: turnOf(boss), kind: ask.kind, ...ok } : { turn: turnOf(boss), kind: ask.kind, squares: [], calm: true };
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, stranger: { ...strangerOf(p), pick } } } };
  },

  /**
   * After the crowd's move on a fire turn of the storm (crowd move `pick.turn`): each marked square burns whatever stands on it (burnAll: a
   * king or a loss no game can have spared), his pieces too; `stormBurn` as his turn begins, a base on the board where it changed it.
   * Nothing once the battle is decided, the game is over on the board, or at the move cap.
   */
  stormBurn(b: Battle): void {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "stranger") return;
    const st = strangerOf(p);
    const pick = st.pick;
    if (!pick || pick.kind !== "fire" || pick.turn !== boss.crowdMoves || !pick.squares.length || !stormOn(st, pick.turn)) return;
    const board = boardOf(b);
    if (boss.result || b.finalGameOver() || boardEnd(board) !== null || boss.crowdMoves >= b.settings.bossMaxMoves) return;
    const out = burnAll(board.fen, pick.squares);
    if (out.fen !== board.fen) {
      const ply = board.history.length;
      b.boards.set(board.id, { ...board, fen: out.fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: out.fen }] });
    }
    const spared = out.burnt.filter((x) => x.spared).map((x) => x.square);
    const event: PowerEvent = { kind: "stormBurn", turn: p.turn, squares: [...pick.squares], ...(spared.length ? { fizzled: spared } : {}) };
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, stranger: { ...st, scorch: { at: boss.crowdMoves, burnt: out.burnt } }, events: [...p.events, event] } } };
  },
};

/** His events for a turn (the sims and tests read them). */
export const strangerEvents = (events: readonly PowerEvent[]) => events.filter((e) => ["frostfire", "frostfireBurn", "finisher", "storm", "stormIce", "stormFire", "stormBurn"].includes(e.kind));
