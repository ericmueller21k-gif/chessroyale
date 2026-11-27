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
 * His ultimate: Eric's, still to come. `strangerult` is a placeholder: its hook never fires (his rage meter fills as every boss's,
 * and the admins' trigger waits). Eric's ult lands in the next PR.
 */
import { BOSS_POWERS, type BalloonShape, type BossPowerSettings, type BossPowerState, type BossState, type PowerEvent, type StrangerState } from "@chessroyale/core";
import { BOSS_OPENING, boardEnd, newBoard, type BoardState } from "../boards.ts";
import { heldIn } from "../board-layer.ts";
import { applyMove, keptEnPassant, kingAttacked, legalMoves, pieceAt, positionOver, sideToMove, withoutPiece } from "../rules.ts";
import { stockfishRefuses, type MoveScore } from "../uci.ts";
import { VALUE, from, heldBy, logit, other, powerRoll, turnOf, type Battle, type BossRules, type JudgedEvaluation, type Side } from "./base.ts";
import { capturedSquare } from "./chandy.ts";

type StrangerSettings = BossPowerSettings["stranger"];

/**
 * How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts): the strike (his banner, the swords' tips together,
 * the bolt onto the piece and its ice) as the crowd's turn after his move begins; the burn at the start of his turn. His art plays
 * within them (the characters lane's).
 */
export const STRANGER_FX = { frostfire: 2300, frostfireBurn: 1500, finisher: 4600 } as const;

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

// ---------------- The judge ----------------

const lossMemo = new Map<string, number>();

/**
 * What a crowd move (`fen`, the crowd to move) leaves to the burn on `square`: the value of the crowd's piece it would burn (pawn 1 ...
 * queen 9), less the value of his piece it would burn; 0 when nothing burns, it's spared, or the game is over after the move.
 */
export function burnLoss(fen: string, move: string, square: string, crowd: Side): number {
  const key = `${fen}|${square}|${move}`;
  const hit = lossMemo.get(key);
  if (hit !== undefined) return hit;
  let loss = 0;
  try {
    const after = applyMove(fen, move);
    if (!positionOver(after)) {
      const out = frostfireOutcome(after, square);
      loss = !out || out.spared ? 0 : (out.side === crowd ? 1 : -1) * (VALUE[out.piece] ?? 0);
    }
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
export function burnRanked(top: readonly MoveScore[], fen: string, square: string | null | undefined, crowd: Side): MoveScore[] {
  if (!square) return [...top];
  return top
    .map((m) => ({ m, loss: burnLoss(fen, m.move, square, crowd) }))
    .map(({ m, loss }) => ({ m: { ...m, expected: burnExpected(m.expected, loss) }, loss }))
    .sort((a, b) => b.m.expected - a.m.expected || a.loss - b.loss || (a.m.move < b.m.move ? -1 : 1))
    .map(({ m }) => m);
}

/** A board's evaluation as the burn's judge sees it (the flee turn's tile): every move's expected after the burn, the best the best of those. */
export function burnJudged<E extends JudgedEvaluation>(evaluation: E, fen: string, square: string | null | undefined, crowd: Side): E {
  if (!square) return evaluation;
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

/** The moves that move the struck piece off its tile on the flee turn (the judge scores them all). */
export function burnEscapes(fen: string, square: string | null | undefined, crowd: Side): string[] {
  return square && pieceAt(fen, square)?.color === crowd ? legalMoves(fen).filter((m) => from(m) === square) : [];
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

/** The tile the judge weighs now: the strike's, on its flee turn's last (the one whose move the burn follows), or null. */
export const burnSquare = (boss: Pick<BossState, "id" | "powers" | "crowdMoves"> | null | undefined): string | null => {
  const st = boss?.id === "stranger" ? strikeOf(boss.powers) : null;
  return st && turnOf(boss!) === st.burnAt ? st.square : null;
};

/** What the screens get of his state (NetBossPowers' `stranger`). */
export interface StrangerView {
  /** The strike under way: its tile, the piece it struck, the crowd turn it came, its last frozen turn and the crowd move it burns after. */
  strike: { turn: number; square: string; piece: string; frozenUntil: number; burnAt: number } | null;
  /** The last burn (after crowd move `at`): the piece burnt (`piece`, `side`), or spared; nothing there: neither. */
  burn: { at: number; square: string; piece?: string; side?: Side; spared?: true } | null;
}

const boardOf = (b: Battle): BoardState => b.boards.get(b.state.boards[0]!)!;

/** The Stranger: his Frostfire strike freezes your best piece for a turn, then its tile burns whatever is left on it. */
export const STRANGER: BossRules = {
  id: "stranger",
  // PLACEHOLDER (Nov 27): his ultimate is Eric's, still to come; until it lands this hook never fires. His meter fills as every boss's.
  ultimate: () => false,
  // (A strike left from another turn, past its burn: gone. Only afterCrowdMove burns.)
  wearOff(next, t) {
    const st = next.stranger;
    if (st?.strike && t.turn > st.strike.burnAt) next.stranger = { ...st, strike: null };
  },
  // The strike, as a crowd turn begins (after his move): when one is due (strikeFrom, then strikeEvery turns apart; the test switch
  // ?power=frostfire: from his first move, again as soon as the last has burnt), on the piece chooseStrike picks; none fits: next turn.
  passive(next, t) {
    const s = t.s.stranger;
    const st = next.stranger ?? fresh(s);
    const test = t.test === "frostfire";
    const from = test ? 2 : s.strikeFrom;
    if (st.strike || t.turn < from || (t.turn < st.next && !test)) {
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
    if (!p || !st || st.turn !== turnOf(boss) || st.burnAt < b.settings.bossMaxMoves) return;
    const events = p.events.filter((e) => !(e.kind === "frostfire" && e.turn === st.turn));
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, stranger: { ...p.stranger!, strike: null }, events } } };
  },
  // The frozen piece can't move, nor castle with a frozen rook (held on the board layer); lifted if it would leave no move.
  layer(boss, fen) {
    const sq = frozenOn(boss, turnOf(boss), fen);
    return heldBy(boss, "frozen", sq ? [sq] : []);
  },
  iced(boss, fen) {
    const sq = frozenOn(boss, turnOf(boss), fen);
    return sq ? [sq] : [];
  },
  // The frozen turn and the flee turn: a power touches them (no fair-play signal; the Last Stand sits out).
  powerTurn: (boss) => {
    const st = strikeOf(boss.powers);
    return !!st && turnOf(boss) >= st.turn && turnOf(boss) <= st.burnAt;
  },
  judge: {
    mustScore: (boss, fen) => burnEscapes(fen, burnSquare(boss), boss.crowdSide),
    offer: (boss, fen) => burnEscapes(fen, burnSquare(boss), boss.crowdSide),
    rank: (boss, top, fen) => burnRanked(top, fen, burnSquare(boss), boss.crowdSide),
    evaluation: (boss, evaluation, fen) => burnJudged(evaluation, fen, burnSquare(boss), boss.crowdSide),
  },
  afterCrowdMove(b) {
    strangerBattle.afterCrowdMove(b);
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
    return { stranger: { strike: st.strike ? { ...st.strike } : null, burn: st.burn ? { ...st.burn } : null } };
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
   * once the battle is over. Returns whether it marked one.
   */
  finisher(b: Battle, move: string): boolean {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "stranger" || boss.result || !b.bossToMove() || b.finalGameOver()) return false;
    if (p.events.some((e) => e.kind === "finisher" && e.turn === p.turn)) return false;
    const fen = boardOf(b).fen;
    if (!legalMoves(fen).includes(move)) return false;
    const sq = capturedSquare(fen, move);
    const piece = sq ? pieceAt(fen, sq) : null;
    if (!sq || !piece || piece.color !== boss.crowdSide || piece.type === "p" || piece.type === "k") return false;
    const forced = finisherTest(b.settings.bossPowerTest).kind;
    const pick = forced >= 0 ? forced : Math.floor(powerRoll(p.seed, "finisher", p.turn, sq) * 4096);
    const event: PowerEvent = { kind: "finisher", turn: p.turn, square: sq, shape: piece.type as BalloonShape, pick };
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, events: [...p.events, event] } } };
    return true;
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
};

/** His events for a turn (the sims and tests read them). */
export const strangerEvents = (events: readonly PowerEvent[]) => events.filter((e) => e.kind === "frostfire" || e.kind === "frostfireBurn" || e.kind === "finisher");
