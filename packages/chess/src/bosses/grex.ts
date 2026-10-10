/**
 * G-REX, the Fire boss (BOSS_ROSTER "grex"): his rules. His passive, the sparkler, sets a tile on the crowd's half on
 * fire: it burns in stages, one a crowd turn, and a crowd piece left on it after the crowd's move on the last stage
 * burns (never the king, nor a piece whose loss would leave a king in check: the tile fizzles). His ultimate, the Roman
 * candle, rains fireballs in waves, each wave's squares shown as growing shadows a few turns ahead; each lands as a fresh
 * tile. The judge counts a piece left to burn as already gone, so saving it is never a mistake. Numbers:
 * BOSS_POWERS.fire*, candle*. His art and moments are the app's (characters/grex.ts, the fire in characters/effects/).
 */
import {
  BOSS_POWERS,
  type BossPowerSettings,
  type BossPowerState,
  type BossState,
  type BurnEvent,
  type CandleWave,
  type FireTile,
  type PowerEvent,
} from "@chessroyale/core";
import { burnOnBoard } from "../boards.ts";
import { applyMove, kingAttacked, legalMoves, pieceAt, positionOver, withoutPiece } from "../rules.ts";
import type { MoveScore } from "../uci.ts";
import { VALUE, crowdHalf, from, logit, other, powerRoll, to, turnOf, warnThenUnleash, type BossRules, type Side } from "./base.ts";

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const GREX_FX = { spark: 2300, candle: 7100, fireball: 1700 } as const;

/**
 * G-REX's fire after the crowd's move: a piece left on a tile ablaze burns (or the tile fizzles under the king) as the
 * boss's turn begins. The boss's move waits for it (at least this long after the crowd's move), solo and online.
 */
export const FIRE_BURN_MS = 1500;

const kingSquare = (fen: string, side: Side) => {
  for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) if (pieceAt(fen, `${f}${r}`)?.type === "k" && pieceAt(fen, `${f}${r}`)?.color === side) return `${f}${r}`;
  return null;
};
const apart = (a: string, b: string) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));

/** The sparkler's square: a random one on the crowd's half, empty or not, never the crowd king's, never on fire. */
export function chooseSpark(fen: string, crowd: Side, seed: number, turn: number, fire: readonly FireTile[] = []): string | null {
  const king = kingSquare(fen, crowd);
  const burning = new Set(fire.map((t) => t.square));
  const options = crowdHalf(crowd).filter((sq) => sq !== king && !burning.has(sq));
  return options.length ? options[Math.floor(powerRoll(seed, "spark", turn) * options.length)]! : null;
}

/**
 * A wave of the Roman candle's fireballs: `n` squares on the crowd's half, never the crowd king's, never one already on
 * fire, spread out (none next to another tile if it can be helped). The same everywhere, from the seed.
 */
export function chooseFireballs(fen: string, crowd: Side, seed: number, turn: number, n: number, fire: readonly FireTile[] = []): string[] {
  const king = kingSquare(fen, crowd);
  const taken = fire.map((t) => t.square);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const free = crowdHalf(crowd).filter((sq) => sq !== king && !taken.includes(sq) && !out.includes(sq));
    if (!free.length) break;
    // (Away from every tile if it can be; else at least from this wave's.)
    const spread = free.filter((sq) => [...taken, ...out].every((t) => apart(sq, t) >= 2));
    const inWave = free.filter((sq) => out.every((t) => apart(sq, t) >= 2));
    const pool = spread.length ? spread : inWave.length ? inWave : free;
    out.push(pool[Math.floor(powerRoll(seed, "fireball", turn, i) * pool.length)]!);
  }
  return out;
}

/** The crowd turn wave `i` of the Roman candle's schedule lands on (he fired on crowd turn `at`). */
export const candleLands = (at: number, i: number, s: Pick<BossPowerSettings, "candleDelay"> = BOSS_POWERS) => at + s.candleDelay + i;

/**
 * The Roman candle's barrage as a crowd turn begins: the waves due land, each fireball a stage-1 fire tile (one on the
 * crowd king's square fizzles: never on his square), then the waves whose time has come are picked, candleAhead turns
 * before they land: spread out (chooseFireballs), never on the king's square or one that will be burning or hit before
 * then. Returns the candle and the fire tiles after it, and the turn's fireball event if a wave landed. Pure: the same
 * everywhere, from the seed.
 */
export function candleTurn(
  p: Pick<BossPowerState, "candle" | "fire" | "seed">,
  fen: string,
  crowd: Side,
  turn: number,
  s: Pick<BossPowerSettings, "candleWaves" | "candleDelay" | "candleAhead" | "fireStages"> = BOSS_POWERS,
): { candle: BossPowerState["candle"]; fire: FireTile[] | undefined; event: PowerEvent | null } {
  const c = p.candle;
  if (!c) return { candle: c, fire: p.fire, event: null };
  let waves: CandleWave[] = c.waves ?? [];
  let left = c.left;
  let fire = p.fire;
  let event: PowerEvent | null = null;
  // Land what's due.
  const due = waves.filter((w) => w.lands <= turn);
  if (due.length) {
    const king = kingSquare(fen, crowd);
    const burning = new Set((fire ?? []).map((t) => t.square));
    const squares = due.flatMap((w) => w.squares);
    const fizzled = squares.filter((sq) => sq === king || burning.has(sq));
    fire = [...(fire ?? []), ...squares.filter((sq) => !fizzled.includes(sq)).map((square) => ({ square, lit: turn }))];
    left = Math.max(0, left - due.reduce((t, w) => t + w.shots, 0));
    waves = waves.filter((w) => w.lands > turn);
    event = { kind: "fireball", turn, squares, ...(fizzled.length ? { fizzled } : {}) };
  }
  // Pick the waves whose time has come (their shots still unassigned: the schedule's, then the rest in one).
  let nextWave = c.next ?? 0;
  const ahead = Math.max(0, Math.min(s.candleAhead, s.candleDelay));
  let unpicked = left - waves.reduce((t, w) => t + w.shots, 0);
  while (unpicked > 0 && candleLands(c.at, nextWave, s) - ahead <= turn) {
    const lands = Math.max(turn + 1, candleLands(c.at, nextWave, s));
    const shots = Math.min(unpicked, s.candleWaves[nextWave] ?? unpicked);
    // (What will be burning as it lands: tiles not yet burnt out by then, and the waves landing before it.)
    const taken: FireTile[] = [
      ...(fire ?? []).filter((t) => t.lit + s.fireStages - 1 >= lands),
      ...waves.flatMap((w) => w.squares.map((square) => ({ square, lit: w.lands }))),
    ];
    waves = [...waves, { lands, shots, squares: chooseFireballs(fen, crowd, p.seed, lands, shots, taken) }];
    unpicked -= shots;
    nextWave++;
  }
  return { candle: { ...c, left, next: nextWave, waves }, fire, event };
}

/** A shadow's size on a crowd turn: 1 (small) when its wave is candleAhead turns out, up to candleAhead (lands next turn). */
export const shadowStage = (lands: number, turn: number, s: Pick<BossPowerSettings, "candleAhead"> = BOSS_POWERS) => s.candleAhead - (lands - turn) + 1;

/** Where the Roman candle's fireballs are coming down: each square still to be hit, the turn it lands, its shadow's size. */
export function fireShadows(p: Pick<BossPowerState, "candle" | "turn"> | null | undefined, s: Pick<BossPowerSettings, "candleAhead"> = BOSS_POWERS): { square: string; lands: number; stage: number }[] {
  return (p?.candle?.waves ?? []).flatMap((w) => w.squares.map((square) => ({ square, lands: w.lands, stage: Math.max(1, shadowStage(w.lands, p!.turn, s)) })));
}

/** A fire tile's stage on a crowd turn: 1 (a singe) as it lands, up to fireStages (ablaze). */
export const fireStage = (t: FireTile, turn: number) => turn - t.lit + 1;

/** The tiles ablaze this crowd turn: a crowd piece left on one after the crowd's move burns. */
export function ablaze(boss: BossState | null | undefined, s: Pick<BossPowerSettings, "fireStages"> = BOSS_POWERS): string[] {
  const fire = boss?.powers?.fire;
  if (!boss || !fire?.length) return [];
  const turn = turnOf(boss);
  return fire.filter((t) => fireStage(t, turn) >= s.fireStages).map((t) => t.square).sort();
}

/**
 * What the fire does to a position (after the crowd's move, `crowd` its side): each crowd piece on a tile in `burn`
 * is destroyed, but never the king (the tile fizzles), and never a piece whose loss would leave a king in check (its
 * own exposed, or the boss's checked by it: the tile fizzles too). Nothing burns once the game is over. Tiles in
 * square order, each with what burnt before it.
 */
export function burnOutcome(fen: string, burn: readonly string[], crowd: Side): { fen: string; burnt: { square: string; piece?: string; fizzled?: boolean }[] } {
  const out: { square: string; piece?: string; fizzled?: boolean }[] = [];
  if (!burn.length || positionOver(fen)) return { fen, burnt: out };
  let now = fen;
  for (const square of [...burn].sort()) {
    const piece = pieceAt(now, square);
    if (!piece || piece.color !== crowd) continue;
    if (piece.type === "k") {
      out.push({ square, fizzled: true });
      continue;
    }
    const after = withoutPiece(now, square);
    if (kingAttacked(after, crowd) || (!kingAttacked(now, other(crowd)) && kingAttacked(after, other(crowd)))) {
      out.push({ square, fizzled: true });
      continue;
    }
    now = after;
    out.push({ square, piece: piece.type });
  }
  return { fen: now, burnt: out };
}

/**
 * After the crowd's move (the boss state already counting it): the tiles that were ablaze burn out, destroying what
 * burnOutcome says; the God King's warning the first time a crowd piece steps onto a burning tile. Returns the new
 * state, the position after the fire, and the squares emptied.
 */
export function fireAfterMove(boss: BossState, fen: string, move: string | null, s: Pick<BossPowerSettings, "fireStages"> = BOSS_POWERS): { boss: BossState; fen: string; emptied: string[] } {
  const p = boss.powers;
  if (!p?.fire?.length) return { boss, fen, emptied: [] };
  const turn = boss.crowdMoves;
  const due = p.fire.filter((t) => fireStage(t, turn) >= s.fireStages);
  // (Stepping onto a tile that isn't ablaze yet: there's still time to leave.)
  const stepped = p.stepped ?? (move && p.fire.some((t) => t.square === to(move) && fireStage(t, turn) < s.fireStages) ? turn : undefined);
  const result = burnOutcome(fen, due.map((t) => t.square), boss.crowdSide);
  const fire = p.fire.filter((t) => !due.includes(t));
  // (A tile with nothing of the crowd's on it just burns out.)
  const burnt: BurnEvent[] = due.map((t) => ({ turn, square: t.square, ...result.burnt.find((b) => b.square === t.square) })).sort((a, b) => (a.square < b.square ? -1 : 1));
  const powers: BossPowerState = {
    ...p,
    fire,
    burnt,
    ...(stepped !== undefined ? { stepped } : {}),
    ...(due.length && !fire.length ? { fireOut: turn } : {}),
  };
  return { boss: { ...boss, powers }, fen: result.fen, emptied: result.burnt.filter((b) => b.piece).map((b) => b.square) };
}

/** How much of the crowd's material a move leaves to the fire this turn (pawn 1 ... queen 9). */
export function fireLoss(fen: string, move: string, burn: readonly string[], crowd: Side): number {
  if (!burn.length) return 0;
  let after: string;
  try {
    after = applyMove(fen, move);
  } catch {
    return 0;
  }
  return burnOutcome(after, burn, crowd).burnt.reduce((t, b) => t + (b.piece ? VALUE[b.piece]! : 0), 0);
}

/**
 * The judge treats a piece left on a tile ablaze as already gone: a move's expected score with what it leaves to the
 * fire taken off (firePawnLogit log-odds a pawn of value), so saving the piece is never scored as a mistake.
 */
export function fireExpected(expected: number, lost: number, s: Pick<BossPowerSettings, "firePawnLogit"> = BOSS_POWERS): number {
  if (lost <= 0) return expected;
  return 1 / (1 + Math.exp(-(logit(expected) - lost * s.firePawnLogit)));
}

/**
 * A board's evaluation as the fire's judge sees it (this turn's tiles ablaze, `burn`): every move's expected score less
 * what it leaves to burn, and the best move the best of those. Unchanged without fire. Pure: every device, the host
 * and the lobby work out the same numbers from the same evaluation.
 */
export function fireJudged<E extends { bestMove: string; bestExpected: number; expectedAfter: Record<string, number> }>(evaluation: E, fen: string, burn: readonly string[], crowd: Side): E {
  if (!burn.length) return evaluation;
  const expectedAfter = Object.fromEntries(Object.entries(evaluation.expectedAfter).map(([m, e]) => [m, fireExpected(e, fireLoss(fen, m, burn, crowd))]));
  const best = expectedAfter[evaluation.bestMove] ?? fireExpected(evaluation.bestExpected, fireLoss(fen, evaluation.bestMove, burn, crowd));
  let bestMove = evaluation.bestMove;
  let bestExpected = best;
  for (const [m, e] of Object.entries(expectedAfter).sort((a, b) => (a[0] < b[0] ? -1 : 1))) if (e > bestExpected) [bestMove, bestExpected] = [m, e];
  return { ...evaluation, bestMove, bestExpected, expectedAfter };
}

/** Top moves as the fire's judge ranks them (for bots and hints): expected less what each leaves to burn, best first. */
export function fireRanked(top: readonly MoveScore[], fen: string, burn: readonly string[], crowd: Side): MoveScore[] {
  if (!burn.length) return [...top];
  return top.map((m) => ({ ...m, expected: fireExpected(m.expected, fireLoss(fen, m.move, burn, crowd)) })).sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));
}

/** The moves that take a crowd piece off a tile ablaze (the judge scores them all, so saving it is always on the table). */
export function fireEscapes(fen: string, burn: readonly string[]): string[] {
  if (!burn.length) return [];
  const on = new Set(burn);
  return legalMoves(fen).filter((m) => on.has(from(m)));
}

/** G-REX: a burning tile from his sparkler, and a barrage of fireballs from his Roman candle. */
export const GREX: BossRules = {
  id: "grex",
  ultimate(next, t) {
    const now = warnThenUnleash(next, t);
    if (now) {
      next.candle = { at: t.turn, left: t.s.candleShots };
      t.events.push({ kind: "candle", turn: t.turn });
    }
    return now;
  },
  // The Roman candle's fireballs: a wave a crowd turn from candleDelay turns after it fired, each landing as a fresh fire
  // tile; each wave's squares picked candleAhead turns before it lands (their shadows growing meanwhile).
  everyTurn(next, t) {
    if (!next.candle) return;
    const barrage = candleTurn(next, t.fen, t.crowd, t.turn, t.s);
    next.candle = barrage.candle;
    if (barrage.fire) next.fire = barrage.fire;
    if (barrage.event) t.events.push(barrage.event);
  },
  // A sparkler when no tile is burning, a full turn after the last fire went out; paused through the candle's barrage.
  passive(next, t) {
    const barrage = !!next.candle && (next.candle.left > 0 || !!next.fire?.length);
    const ready = !next.fire?.length && t.turn >= next.nextPassive && (next.fireOut === undefined || t.turn > next.fireOut + t.s.fireGap);
    if (!barrage && ready) {
      const square = chooseSpark(t.fen, t.crowd, t.seed, t.turn, next.fire ?? []);
      if (square) {
        next.fire = [{ square, lit: t.turn }];
        t.events.push({ kind: "spark", turn: t.turn, square });
        next.nextPassive = t.turn + t.s.fireStages + t.s.fireGap;
      } else next.nextPassive = t.turn + 1;
    }
  },
  powerTurn: (boss) => !!boss.powers!.fire?.length,
  // The judge: a piece left on a tile ablaze counts as gone, and the moves that save it are always scored.
  judge: {
    mustScore: (boss, fen) => fireEscapes(fen, ablaze(boss)),
    rank: (boss, top, fen) => fireRanked(top, fen, ablaze(boss), boss.crowdSide),
    evaluation: (boss, evaluation, fen) => fireJudged(evaluation, fen, ablaze(boss), boss.crowdSide),
  },
  // After the crowd's move: what was left on a tile ablaze burns (the board's position changes).
  afterCrowdMove(b, move) {
    const boss = b.state.boss;
    if (!boss?.powers?.fire?.length) return;
    const id = b.state.boards[0]!;
    let board = b.boards.get(id)!;
    const out = fireAfterMove(boss, board.fen, move);
    for (const sq of out.emptied) board = burnOnBoard(board, sq);
    b.boards.set(id, board);
    b.state = { ...b.state, boss: out.boss };
  },
};
