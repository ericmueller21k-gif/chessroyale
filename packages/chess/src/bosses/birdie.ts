/**
 * Birdie (BOSS_ROSTER "birdie"; Eric, Nov 23; docs/decisions/2026-11-23-birdie-rules.md): Eric's own young mourning dove, riding a
 * yellow toy diesel train in a conductor's cap and a tie. He plays from the game so far, like most bosses.
 *
 * His passive, the Train:
 * - As crowd turn BOSS_POWERS.birdie.trainFrom begins (2: at the end of his reply to your first move), and then every trainEvery
 *   crowd turns (Eric: "a 3 (6 total turn) turn cooldown"), he warns a rank or file where exactly one of your pieces stands, any
 *   piece, your king too (`trainSignal`: his `signal` and the crossing on every square of the line). Only a piece your move can save:
 *   it has a move this turn, and the smash would be legal now (not the last shield of your king, not a piece in front of his pawn
 *   about to promote). No line fits: it waits a turn. Several fit: the battle's seed picks (powerRoll), the same on every device.
 * - Your move moves that piece (any move of it, a capture, a promotion, castling with it): it's saved, and the warning ends. Any other
 *   move leaves it there, and at the start of his turn (as your move lands: afterCrowdMove) his train rides the line and smashes it
 *   (`trainSmash`; a base on the board); his own pieces on the line step aside as it passes (on screen only). Your king left there:
 *   the train smashes it and the battle is his (`trainWin`; the board unchanged, the result "boss" whatever it says). A smash that
 *   would leave a position no game can have (your king open to his piece, his king checked by the gap, a promotion handed to him, no
 *   move left for him) spares the piece (`trainSmash` with `fizzled`): the train rides by. Nothing rides once the game is over on the
 *   board (a mate, a draw), at the move cap, or with the battle decided.
 * - The judge counts a piece left on the warned square as gone (its value at trainPawnLogit log-odds a pawn, the fire's way; your
 *   king as the battle lost), and always scores the moves that save it, so saving it is never a mistake; the turn doesn't count for
 *   fair play (powerTurn), and the God King's Last Stand sits out on it (boardAltered reads powerTurn).
 *
 * His ultimate, the Fall (once a battle; his meter is the material he has lost, BossRules.meter):
 * - At the start of his turn once he has lost fallLost points of material since the battle began (P1 N3 B3 R5 Q9; the most he has
 *   been down, as the rage meter counts it), or the admins' trigger, or the test switch (?power=fall: after the crowd's second
 *   move): his `fall`, then the cutscene (`birdieFall`, played while he thinks; his move waits for it), and he's Armored Birdie for
 *   the rest of the battle. After a train ridden on the same turn: the train first.
 * - Armored Birdie (Eric, Nov 23: "He still uses his same normal move after. He just does it every 3 to 4 turns"): the train goes on,
 *   the same rule, `armoredTrainEvery` crowd turns apart; and his brain plays much stronger (`brainNow`, armoredBrain): Maia
 *   `armoredMaiaBoost` higher up to its top, at its top Stockfish just above it. The same on every device: the runner asks it for
 *   every move of his, solo and online.
 */
import { BIRDIE_CINEMATIC, BIRDIE_ULT, BOSS_POWERS, ENGINE_MAX_ELO, levelForMaia, maiaTopRating, type BalloonShape, type BirdieState, type BossPowerSettings, type BossPowerState, type BossState, type PowerEvent } from "@chessroyale/core";
import { boardEnd, type BoardState } from "../boards.ts";
import { applyMove, keptEnPassant, kingAttacked, legalMoves, pieceAt, positionOver, withoutPiece } from "../rules.ts";
import { stockfishRefuses, type MoveScore } from "../uci.ts";
import { VALUE, from, logit, materialOf, other, powerRoll, turnOf, ultCapped, unleashed, type Battle, type BossRules, type BrainNow, type JudgedEvaluation, type Side } from "./base.ts";

type BirdieSettings = BossPowerSettings["birdie"];

/**
 * His moments beat by beat (ms into each), from his animations (characters/birdie.ts, the art's own lengths: a unit test there keeps
 * them the same), so the server and solo wait for the board's train too:
 * - **trainSignal** (as the crowd's turn after his move begins): his `signal` (1500 ms), its `signal` cue (his wave's top) at
 *   `lightAt`: the crossing lights up on every square of the line, and stays through the crowd's turn.
 * - **trainSmash** (at the start of his turn, while he thinks): his `depart` (960 ms: he ducks in and the train pulls away, its `go`
 *   cue at 290), then from `rideAt` the train crosses the board along the line in `rideMs` (from one board's edge to past the other,
 *   `trackSquares` squares of travel: the board's eight, its own length and a square of run-in), the pieces on the line stepping
 *   aside as it nears (`asideMs` before its nose and back after its tail), the warned piece smashed as its nose reaches it (the
 *   train's `smash`, 420 ms) or stepping aside too (spared); then his `entrance` (2140 ms) back to his spot from `backAt`.
 * - **trainWin**: the same ride, your king smashed; its banner first.
 * - **birdieFall**: timed to his ult's piece (BIRDIE_ULT, Nov 23): he waits in his spot, his line at `lineAt`; from `fallAt` his `fall`
 *   where he stands (BIRDIE_CINEMATIC.dropMs), then the cutscene's beats (BIRDIE_CINEMATIC): the scene fades in (`cutAt`), he tumbles
 *   (`tumbleAt`), his train comes up the track (`approachAt`) and hits him on the piece's drop (`impactAt`, its last frame), the light
 *   whole a beat later (`hitAt`: he's Armored Birdie from then, `armorAt`), his reveal, he stands (`holdAt`), the scene fades out
 *   (`fadeOutAt`); `total`, the whole of it.
 */
export const BIRDIE_BEATS = {
  signal: { lightAt: 500, total: 1500 },
  ride: (() => {
    const departMs = 960;
    const rideAt = 720;
    const rideMs = 1300;
    const entranceMs = 2140;
    const backAt = rideAt + rideMs;
    return { departMs, rideAt, rideMs, trackSquares: 11, asideMs: 160, smashMs: 420, entranceMs, backAt, total: backAt + entranceMs };
  })(),
  fall: (() => {
    const c = BIRDIE_CINEMATIC;
    // (The impact, the drop of his ult's piece: BIRDIE_ULT. The cutscene starts its own time to the impact before it.)
    const impactAt = BIRDIE_ULT.pieceAt + BIRDIE_ULT.introMs;
    const fallAt = impactAt - (c.dropMs + c.fadeInMs + c.tumbleMs + c.approachMs);
    const cutAt = fallAt + c.dropMs;
    const tumbleAt = cutAt + c.fadeInMs;
    const approachAt = tumbleAt + c.tumbleMs;
    const hitAt = approachAt + c.approachMs + c.hitHoldMs;
    const holdAt = hitAt + c.revealMs;
    const fadeOutAt = holdAt + c.holdMs;
    return { lineAt: BIRDIE_ULT.lineAt, fallAt, cutAt, tumbleAt, approachAt, impactAt, hitAt, armorAt: hitAt, holdAt, fadeOutAt, total: fadeOutAt + c.fadeOutMs };
  })(),
} as const;

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const BIRDIE_FX = { trainSignal: BIRDIE_BEATS.signal.total, trainSmash: BIRDIE_BEATS.ride.total, trainWin: BIRDIE_BEATS.ride.total, birdieFall: BIRDIE_BEATS.fall.total } as const;

/**
 * Where the train's nose is along its line `ms` into the ride (from `rideAt`), in squares from the line's first square's near edge
 * (negative: still off the board; past 8: leaving it): its run-in and its own length before the board, so it enters whole.
 */
export function trainNose(ms: number, b: typeof BIRDIE_BEATS.ride = BIRDIE_BEATS.ride): number {
  const p = Math.max(0, Math.min(1, ms / Math.max(1, b.rideMs)));
  return -1 + p * b.trackSquares;
}

/** When the train's nose reaches square `i` of its line (0: its first square's middle), ms into the ride. */
export const trainReaches = (i: number, b: typeof BIRDIE_BEATS.ride = BIRDIE_BEATS.ride): number => Math.round(((i + 0.5 + 1) / b.trackSquares) * b.rideMs);

const FILES = "abcdefgh";
/** The 16 lines: the files (a-h), then the ranks (1-8). */
const LINES: readonly string[] = [...FILES, ..."12345678"];

/**
 * A line's squares in the order the train rides it: a file from his side of the board to yours (his train comes down it at you); a
 * rank from the a-file to the h-file.
 */
export function lineSquares(line: string, crowd: Side): string[] {
  if (FILES.includes(line)) {
    const ranks = crowd === "w" ? "87654321" : "12345678";
    return [...ranks].map((r) => `${line}${r}`);
  }
  return [...FILES].map((f) => `${f}${line}`);
}

/** The square one rank toward `side`'s own back rank from `square`, or null off the board. */
const towardHome = (square: string, side: Side): string | null => {
  const r = Number(square[1]) + (side === "w" ? -1 : 1);
  return r >= 1 && r <= 8 ? `${square[0]}${r}` : null;
};

/**
 * The smash would be legal now (`fen`, the crowd to move) for the crowd's piece on `square`: not the last shield of its king against
 * one of his pieces, and not standing on the square his pawn would promote on next (your back rank, his pawn right behind it). Your
 * king always is: the train doesn't take it off the board, it ends the battle.
 */
export function smashLegalNow(fen: string, square: string, crowd: Side): boolean {
  const piece = pieceAt(fen, square);
  if (!piece || piece.color !== crowd) return false;
  if (piece.type === "k") return true;
  if (kingAttacked(withoutPiece(fen, square), crowd)) return false;
  const his = other(crowd);
  const back = crowd === "w" ? "1" : "8";
  if (square[1] === back) {
    const behind = towardHome(square, crowd === "w" ? "b" : "w");
    const p = behind ? pieceAt(fen, behind) : null;
    if (p && p.type === "p" && p.color === his) return false;
  }
  return true;
}

/** A line the train can take: the line, its squares in riding order, and the one crowd piece on it (its square and kind). */
export interface TrainLine {
  line: string;
  squares: string[];
  square: string;
  piece: string;
}

/**
 * Every line his train can warn now (`fen`, the crowd to move; `moves`, the crowd's allowed moves this turn, every legal move
 * without): exactly one of the crowd's pieces on it, that piece with a move, and its smash legal now (smashLegalNow). In LINES'
 * order.
 */
export function trainLines(fen: string, crowd: Side, moves?: readonly string[]): TrainLine[] {
  const movers = new Set((moves ?? legalMoves(fen)).map(from));
  const out: TrainLine[] = [];
  for (const line of LINES) {
    const squares = lineSquares(line, crowd);
    const mine = squares.filter((sq) => pieceAt(fen, sq)?.color === crowd);
    if (mine.length !== 1) continue;
    const square = mine[0]!;
    if (!movers.has(square) || !smashLegalNow(fen, square, crowd)) continue;
    out.push({ line, squares, square, piece: pieceAt(fen, square)!.type });
  }
  return out;
}

/** The line his train warns as crowd turn `turn` begins (trainLines, the seed's pick among them), or null: none fits. */
export function chooseLine(fen: string, crowd: Side, seed: number, turn: number, moves?: readonly string[]): TrainLine | null {
  const lines = trainLines(fen, crowd, moves);
  if (!lines.length) return null;
  const roll = (l: TrainLine) => powerRoll(seed, "train", turn, l.line);
  return [...lines].sort((a, b) => roll(a) - roll(b) || (a.line < b.line ? -1 : 1))[0]!;
}

/** What his train does on the warned square after the crowd's move (`fen`, him to move). */
export interface TrainOutcome {
  /** The position after it (the same when it spares the piece or takes the king). */
  fen: string;
  /** The kind of the crowd's piece it reached (p, n, b, r, q, k). */
  piece: string;
  /** It's your king: the battle is his. */
  king?: true;
  /** The smash wasn't legal: the piece spared. */
  spared?: true;
}

/**
 * His train on `square` after the crowd's move (`fen`, him to move): null when the crowd's piece is gone from it (the crowd moved it:
 * saved). Your king: the battle (`king`). Any other piece is smashed (taken off the board, the en passant square as the engine keeps
 * it), unless that would leave a position no game can have: your king attacked (it was its last shield), his king checked by the gap,
 * a promotion handed to him he didn't have, or no move left for him; then `spared`. Never called once the game is over on the board.
 */
export function trainOutcome(fen: string, square: string, crowd: Side): TrainOutcome | null {
  const piece = pieceAt(fen, square);
  if (!piece || piece.color !== crowd) return null;
  if (piece.type === "k") return { fen, piece: "k", king: true };
  const his = other(crowd);
  let after: string;
  try {
    after = keptEnPassant(withoutPiece(fen, square));
  } catch {
    return { fen, piece: piece.type, spared: true };
  }
  const moves = legalMoves(after);
  const promos = (ms: readonly string[]) => new Set(ms.filter((m) => m.length === 5).map((m) => m.slice(0, 4)));
  const now = promos(moves);
  const before = now.size ? promos(legalMoves(fen)) : now;
  const handed = [...now].some((m) => !before.has(m));
  const bad = !moves.length || handed || kingAttacked(after, crowd) || (!kingAttacked(fen, his) && kingAttacked(after, his)) || !!stockfishRefuses(after);
  return bad ? { fen, piece: piece.type, spared: true } : { fen: after, piece: piece.type };
}

// ---------------- The judge ----------------

/** The judge's numbers for a move, worked out once a position (the lobby asks several times a turn): by fen, square and move. */
const lossMemo = new Map<string, number>();

/**
 * How much a crowd move (`fen`, the crowd to move) leaves to his train on `square`: the value of the piece it would smash (pawn 1 ...
 * queen 9), Infinity for your king (the battle), 0 when the move saves it, the train would spare it, or the game is over after it.
 */
export function trainLoss(fen: string, move: string, square: string, crowd: Side): number {
  const key = `${fen}|${square}|${move}`;
  const hit = lossMemo.get(key);
  if (hit !== undefined) return hit;
  let loss = 0;
  try {
    const after = applyMove(fen, move);
    if (!positionOver(after)) {
      const out = trainOutcome(after, square, crowd);
      loss = !out || out.spared ? 0 : out.king ? Infinity : (VALUE[out.piece] ?? 0);
    }
  } catch {
    loss = 0;
  }
  lossMemo.set(key, loss);
  if (lossMemo.size > 2000) lossMemo.delete(lossMemo.keys().next().value!);
  return loss;
}

/** A move's expected score with what it leaves to the train taken off (trainPawnLogit log-odds a pawn of value; your king: 0). */
export function trainExpected(expected: number, lost: number, s: Pick<BirdieSettings, "trainPawnLogit"> = BOSS_POWERS.birdie): number {
  if (lost <= 0) return expected;
  if (lost === Infinity) return 0;
  return 1 / (1 + Math.exp(-(logit(expected) - lost * s.trainPawnLogit)));
}

/**
 * Top moves as the train's judge ranks them (for bots and hints): expected less what each leaves to the train, best first; a tie goes
 * to the move that leaves the train less (in a lost position every move scores 0, and your king left on the line must never rank level
 * with saving it), then by move.
 */
export function trainRanked(top: readonly MoveScore[], fen: string, square: string | null | undefined, crowd: Side): MoveScore[] {
  if (!square) return [...top];
  return top
    .map((m) => ({ m, loss: trainLoss(fen, m.move, square, crowd) }))
    .map(({ m, loss }) => ({ m: { ...m, expected: trainExpected(m.expected, loss) }, loss }))
    .sort((a, b) => b.m.expected - a.m.expected || a.loss - b.loss || (a.m.move < b.m.move ? -1 : 1))
    .map(({ m }) => m);
}

/**
 * A board's evaluation as the train's judge sees it (this turn's warned square): every move's expected score less what it leaves to
 * the train, the best move the best of those (a tie goes to the move that leaves the train less, so the best move is never your king
 * left on the line when an escape scores the same; then the judge's best, then by move). Unchanged without a warning. Pure.
 */
export function trainJudged<E extends JudgedEvaluation>(evaluation: E, fen: string, square: string | null | undefined, crowd: Side): E {
  if (!square) return evaluation;
  const loss = (m: string) => trainLoss(fen, m, square, crowd);
  const expectedAfter = Object.fromEntries(Object.entries(evaluation.expectedAfter).map(([m, e]) => [m, trainExpected(e, loss(m))]));
  let bestMove = evaluation.bestMove;
  let bestExpected = expectedAfter[bestMove] ?? trainExpected(evaluation.bestExpected, loss(bestMove));
  let bestLoss = loss(bestMove);
  for (const [m, e] of Object.entries(expectedAfter).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (e < bestExpected || (e === bestExpected && loss(m) >= bestLoss)) continue;
    [bestMove, bestExpected, bestLoss] = [m, e, loss(m)];
  }
  return { ...evaluation, bestMove, bestExpected, expectedAfter };
}

/** The moves that save the warned piece (the judge scores them all, so saving it is always on the table). */
export function trainEscapes(fen: string, square: string | null | undefined): string[] {
  return square ? legalMoves(fen).filter((m) => from(m) === square) : [];
}

// ---------------- His state ----------------

const fresh = (s: Pick<BirdieSettings, "trainFrom"> = BOSS_POWERS.birdie): BirdieState => ({ next: s.trainFrom, warn: null });
const birdieOf = (p: Pick<BossPowerState, "birdie"> | null | undefined): BirdieState => p?.birdie ?? fresh();

/** The train's warning on crowd turn `turn` (the turn being picked), or null. */
export const warnOn = (p: Pick<BossPowerState, "birdie"> | null | undefined, turn: number) => {
  const w = p?.birdie?.warn;
  return w && w.turn === turn ? w : null;
};

/** The warned square the judge weighs now (this crowd turn's warning), or null. */
export const trainSquare = (boss: Pick<BossState, "id" | "powers" | "crowdMoves"> | null | undefined): string | null =>
  boss?.id === "birdie" ? (warnOn(boss.powers, turnOf(boss))?.square ?? null) : null;

/** His train smashed the crowd's king: the battle is his, whatever the board says. */
export const trainWon = (boss: Pick<BossState, "powers"> | null | undefined): boolean => !!boss?.powers?.birdie?.ride?.king;

/** He has fallen: Armored Birdie (the train every armoredTrainEvery turns, his brain stronger). */
export const birdieArmored = (p: Pick<BossPowerState, "birdie"> | null | undefined): boolean => !!p?.birdie?.fell;

/** What the screens get of his state (NetBossPowers' `birdie`). */
export interface BirdieView {
  /** The warning now: the line, its squares in riding order, the crowd's piece on it and its kind, and the crowd turn it's for. */
  warn: { turn: number; line: string; squares: string[]; square: string; piece: string } | null;
  /** His train's last ride (after crowd move `at`): the piece it smashed, spared or (your king) won the battle with. */
  ride: { at: number; line: string; squares: string[]; square: string; piece: string; spared?: true; king?: true } | null;
  /** He fell after crowd move `fell` (Armored Birdie from then); null: not yet. */
  fell: number | null;
  /**
   * When his moments at the start of crowd turn `turn`'s reply began (his train's ride, his fall: his thinking's start), sent while that
   * thinking is on, so a device rejoining in the middle carries them on (Birdie.tsx, birdieTurnMoments): the lobby's clock as sent (net.ts
   * maps it onto the device's), solo's own; `dropAt`, his fall's impact on the same clock (at + birdieImpactMs: his music's drop), if he
   * falls this turn. Not part of the rules (the rules' view never has it). Missing: none, or an older server.
   */
  turnAt?: { turn: number; at: number; dropAt?: number };
}

const setBirdie = (b: Battle, change: (bd: BirdieState) => BirdieState, events: readonly PowerEvent[] = [], more: Partial<BossPowerState> = {}): void => {
  const boss = b.state.boss!;
  const p = boss.powers!;
  b.state = { ...b.state, boss: { ...boss, powers: { ...p, ...more, birdie: change(birdieOf(p)), events: [...p.events, ...events] } } };
};

/** The battle's board. */
const boardOf = (b: Battle): BoardState => b.boards.get(b.state.boards[0]!)!;

/** Birdie: his train smashes the one piece of yours left on a warned line; his fall makes him Armored Birdie. */
export const BIRDIE: BossRules = {
  id: "birdie",
  // The Fall comes at the start of his turn (afterCrowdMove), never with a warning: the admins' trigger is kept until then.
  ultimateOnHisTurn: true,
  ultimateOnce: true,
  // (After his fall the meter stays on the bar, empty and dimmed: nothing hidden.)
  spentMeterShown: true,
  ultimate: () => false,
  // From his fall on: Armored Birdie for the rest of the battle (no other ultimate, the meter held).
  ultimateRunning: (p) => birdieArmored(p),
  // His meter: the material he has lost against fallLost; full on the turn of his fall, empty after.
  meter: (p, turn, s) => (p.ultAt !== undefined ? (turn <= p.ultAt ? 1 : 0) : Math.max(0, Math.min(1, p.lost / Math.max(1, s.birdie.fallLost)))),
  // (A warning left from another turn: gone.)
  wearOff(next, t) {
    const bd = next.birdie;
    if (bd?.warn && bd.warn.turn !== t.turn) next.birdie = { ...bd, warn: null };
  },
  // The Train's warning, as a crowd turn begins: when one is due (trainFrom, then trainEvery turns apart, armoredTrainEvery once he's
  // Armored Birdie; the test switch: every turn), on a line the seed picks (chooseLine); none fits: next turn.
  passive(next, t) {
    const s = t.s.birdie;
    const bd = next.birdie ?? fresh(s);
    const test = t.test === "train";
    if (t.turn < s.trainFrom || (t.turn < bd.next && !test)) {
      if (!next.birdie) next.birdie = bd;
      return;
    }
    const pick = chooseLine(t.fen, t.crowd, t.seed, t.turn, t.crowdMoves?.());
    if (!pick) {
      next.birdie = { ...bd, next: t.turn + 1 };
      return;
    }
    const every = bd.fell ? s.armoredTrainEvery : s.trainEvery;
    next.birdie = { ...bd, warn: { turn: t.turn, ...pick }, next: t.turn + (test ? 1 : Math.max(1, Math.round(every))) };
    t.events.push({ kind: "trainSignal", turn: t.turn, square: pick.square, squares: [...pick.squares], ...(pick.piece !== "k" ? { shape: pick.piece as BalloonShape } : {}) });
  },
  // (The turn the move cap ends, bossMaxMoves: no train rides after it, so no warning for it either, and the judge, the dock and the
  // ride agree. The cadence can drift onto it when no line fits for a turn.)
  turnBegun(b) {
    const boss = b.state.boss!;
    const p = boss.powers;
    const w = p?.birdie?.warn;
    if (!p || !w || w.turn < b.settings.bossMaxMoves) return;
    const events = p.events.filter((e) => !(e.kind === "trainSignal" && e.turn === w.turn));
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, birdie: { ...p.birdie!, warn: null }, events } } };
  },
  // (Armored Birdie: his brain much stronger for every move of his from his fall on.)
  brainNow: (boss, plan, s) => (birdieArmored(boss.powers) ? armoredBrain(plan, s.birdie) : plan),
  // A warned turn: the judge's best moves change (the train), so it doesn't count for fair play, and the Last Stand sits out.
  powerTurn: (boss) => !!warnOn(boss.powers, turnOf(boss)),
  judge: {
    mustScore: (boss, fen) => trainEscapes(fen, trainSquare(boss)),
    // (The bots may pick them too: with your king warned, its moves may be none of the engine's top ones.)
    offer: (boss, fen) => trainEscapes(fen, trainSquare(boss)),
    rank: (boss, top, fen) => trainRanked(top, fen, trainSquare(boss), boss.crowdSide),
    evaluation: (boss, evaluation, fen) => trainJudged(evaluation, fen, trainSquare(boss), boss.crowdSide),
  },
  afterCrowdMove(b) {
    birdieBattle.afterCrowdMove(b);
  },
  // (Several bosses: another boss's power took the warned piece away outside a move: the warning goes with it.)
  followBoard(b) {
    const boss = b.state.boss!;
    const w = boss.powers?.birdie?.warn;
    if (!w) return;
    const at = pieceAt(boardOf(b).fen, w.square);
    if (!at || at.color !== boss.crowdSide || at.type !== w.piece) setBirdie(b, (bd) => ({ ...bd, warn: null }));
  },
  view: (p) => {
    const bd = birdieOf(p);
    const w = warnOn(p, p.turn);
    return {
      birdie: {
        warn: w ? { ...w, squares: [...w.squares] } : null,
        ride: bd.ride ? { ...bd.ride, squares: [...bd.ride.squares] } : null,
        fell: bd.fell?.at ?? null,
      },
    };
  },
};

/**
 * Armored Birdie's brain (Eric, Nov 23: "we turn up the Maya to a much stronger level. And if somebody's already fighting on very hard
 * ... he just turns up to play maybe Stockfish slightly higher than what the Maya highest is"), from the battle's for this move
 * (`rating`: Maia's, null: Stockfish at `elo`): Maia armoredMaiaBoost higher, held at its top (Stockfish's stand-in, while Maia isn't
 * there, as much stronger as that jump is on the game's scale, levelForMaia); already at Maia's top, Stockfish at armoredStockfishAbove
 * over the level Maia's top stands for; on Stockfish already, armoredMaiaBoost more Elo. Held at ENGINE_MAX_ELO, never weaker. Pure.
 */
export function armoredBrain(plan: BrainNow, s: Pick<BirdieSettings, "armoredMaiaBoost" | "armoredStockfishAbove"> = BOSS_POWERS.birdie): BrainNow {
  const top = maiaTopRating();
  if (plan.rating === null) return { rating: null, elo: Math.min(ENGINE_MAX_ELO, plan.elo + s.armoredMaiaBoost) };
  if (plan.rating >= top) return { rating: null, elo: Math.max(plan.elo, Math.min(ENGINE_MAX_ELO, levelForMaia(top) + s.armoredStockfishAbove)) };
  const rating = Math.min(top, plan.rating + s.armoredMaiaBoost);
  return { rating, elo: Math.min(ENGINE_MAX_ELO, plan.elo + Math.max(0, levelForMaia(rating) - levelForMaia(plan.rating))) };
}

// ---------------- His part in the match runner ----------------

export const birdieBattle = {
  /**
   * After the crowd's move (him to move): the warning for this move answered (the piece moved: saved), or his train on it (a smash, a
   * sparing, your king); then his fall when it's due (fallLost lost, the admins' trigger, the test switch). Nothing once the battle is
   * decided, the game over on the board, or at the move cap. Each a base on the board where it changes it; the events in that order.
   */
  afterCrowdMove(b: Battle, s: BirdieSettings = BOSS_POWERS.birdie): void {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "birdie") return;
    const board = boardOf(b);
    const over = !!boss.result || b.finalGameOver() || boardEnd(board) !== null || boss.crowdMoves >= b.settings.bossMaxMoves;
    const bd = birdieOf(p);
    const w = bd.warn && bd.warn.turn === boss.crowdMoves ? bd.warn : null;
    const events: PowerEvent[] = [];
    let ride: BirdieState["ride"] = bd.ride ?? null;
    if (w && !over) {
      const out = trainOutcome(board.fen, w.square, boss.crowdSide);
      if (out) {
        const line = { line: w.line, squares: [...w.squares], square: w.square, piece: out.piece };
        ride = { at: boss.crowdMoves, ...line, ...(out.king ? { king: true as const } : {}), ...(out.spared ? { spared: true as const } : {}) };
        if (out.king) events.push({ kind: "trainWin", turn: p.turn, square: w.square, squares: [...w.squares] });
        else {
          events.push({ kind: "trainSmash", turn: p.turn, square: w.square, squares: [...w.squares], shape: out.piece as BalloonShape, ...(out.spared ? { fizzled: [w.square] } : {}) });
          if (!out.spared) {
            const ply = board.history.length;
            b.boards.set(board.id, { ...board, fen: out.fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: out.fen }] });
          }
        }
      }
    }
    const won = !!ride?.king && ride.at === boss.crowdMoves;
    const lost = Math.max(p.lost, p.material - materialOf(boardOf(b).fen, other(boss.crowdSide)));
    const test = b.settings.bossPowerTest === "fall" && boss.crowdMoves >= 2;
    const falls = !bd.fell && !over && !won && p.ultAt === undefined && !p.noUlt && !ultCapped(p) && (!!p.ultNext || lost >= s.fallLost || test);
    if (falls) events.push({ kind: "birdieFall", turn: p.turn });
    if (!w && !falls) return;
    const { ultNext: _trigger, ...rest } = p;
    const base: BossPowerState = falls ? unleashed({ ...rest, ultAt: boss.crowdMoves, events: p.events }) : p;
    b.state = { ...b.state, boss: { ...boss, powers: { ...base, birdie: { ...bd, warn: null, ride, ...(falls ? { fell: { at: boss.crowdMoves } } : {}) }, events: [...p.events, ...events] } } };
  },
};

/** His events for a turn (the sims and tests read them). */
export const birdieEvents = (events: readonly PowerEvent[]) => events.filter((e) => e.kind === "trainSignal" || e.kind === "trainSmash" || e.kind === "trainWin" || e.kind === "birdieFall");
