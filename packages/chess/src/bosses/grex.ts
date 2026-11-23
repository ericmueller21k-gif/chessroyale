/**
 * Grex, the Fire boss (BOSS_ROSTER "grex"): his rules. His passive, the sparkler, sets a tile on the crowd's half on
 * fire: it burns in stages, one a crowd turn, and a crowd piece left on it after the crowd's move on the last stage
 * burns (never the king, nor a piece whose loss would leave a king in check: the tile fizzles). His ultimate, the Roman
 * candle, rains fireballs in waves, each wave's squares shown as growing shadows a few turns ahead; each lands as a fresh
 * tile, some on his own half (his pieces never burn: the first time one sits on the candle's fire, he laughs it off). The
 * candle's fire chars a crowd piece the first time it reaches it (it stays, charred for the rest of the match) and burns it
 * the second (Eric, Nov 20: candleHitsToBurn; docs/decisions/2026-11-20-grex-char.md); the sparkler's burns at once. The
 * judge counts a piece left to burn as already gone, so saving it is never a mistake. Numbers: BOSS_POWERS.fire*, candle*.
 * His art and moments are the app's (characters/grex.ts, the fire in characters/effects/).
 */
import {
  BOSS_POWERS,
  type BossPowerSettings,
  type BossPowerState,
  type BossState,
  type BurnEvent,
  type CandleWave,
  type CharMark,
  type FireTile,
  type PowerEvent,
} from "@chessroyale/core";
import { burnOnBoard } from "../boards.ts";
import { followSplats, marksStanding } from "./boingo.ts";
import { applyMove, kingAttacked, legalMoves, pieceAt, positionOver, withoutPiece } from "../rules.ts";
import type { MoveScore } from "../uci.ts";
import { VALUE, crowdHalf, from, logit, other, powerRoll, to, turnOf, warnThenUnleash, type Battle, type BossRules, type Side } from "./base.ts";

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const GREX_FX = { spark: 2300, candle: 7100, fireball: 1700, fireproof: 2200 } as const;

/**
 * Grex's fire after the crowd's move: a piece left on a tile ablaze burns (or the tile fizzles under the king) as the
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
 * A wave of the Roman candle's fireballs: `n` squares, `own` of them on his own half (Eric, Oct 11: his pieces never
 * burn, so those are mostly wasted) and the rest on the crowd's; never the crowd king's square, never one already on
 * fire, spread out (none next to another tile if it can be helped). The same everywhere, from the seed. The crowd's
 * come first (as they always did: with `own` 0, the same squares as before). `aim` (the test switch, ?power=candle): on
 * the crowd's half, squares from its first list that can be hit come first, then its next (candleAim), spread or not.
 */
export function chooseFireballs(fen: string, crowd: Side, seed: number, turn: number, n: number, fire: readonly FireTile[] = [], own: number = 0, aim: readonly (readonly string[])[] = []): string[] {
  const king = kingSquare(fen, crowd);
  const taken = fire.map((t) => t.square);
  const out: string[] = [];
  const mine = Math.max(0, Math.min(n, own));
  const pick = (half: string[], count: number, key: string, tiers: readonly (readonly string[])[] = []) => {
    for (let i = 0; i < count; i++) {
      const free = half.filter((sq) => sq !== king && !taken.includes(sq) && !out.includes(sq));
      if (!free.length) break;
      // (Away from every tile if it can be; else at least from this wave's.)
      const spread = free.filter((sq) => [...taken, ...out].every((t) => apart(sq, t) >= 2));
      const inWave = free.filter((sq) => out.every((t) => apart(sq, t) >= 2));
      const aimed = tiers.map((tier) => free.filter((sq) => tier.includes(sq))).find((x) => x.length);
      const pool = aimed ?? (spread.length ? spread : inWave.length ? inWave : free);
      out.push(pool[Math.floor(powerRoll(seed, key, turn, i) * pool.length)]!);
    }
  };
  pick(crowdHalf(crowd), n - mine, "fireball", aim);
  pick(crowdHalf(other(crowd)), mine, "fireball-own");
  return out;
}

/**
 * The test switch's aim (?power=candle): the crowd's charred pieces first (so the second hit, the burn, comes soon), then
 * its pawns, then its other pieces (never the king), so a test sees the candle char a piece and then burn it.
 */
export function candleAim(fen: string, crowd: Side, marks: readonly CharMark[]): string[][] {
  const mine = crowdHalf(crowd)
    .concat(crowdHalf(other(crowd)))
    .filter((sq) => pieceAt(fen, sq)?.color === crowd && pieceAt(fen, sq)?.type !== "k");
  const charred = mine.filter((sq) => marks.some((m) => m.square === sq));
  return [charred, mine.filter((sq) => !charred.includes(sq) && pieceAt(fen, sq)!.type === "p"), mine.filter((sq) => !charred.includes(sq))];
}

/** How many of a wave's fireballs fall on his own half (candleOwnShare of them, rounded). */
export const ownShots = (shots: number, s: Pick<BossPowerSettings, "candleOwnShare"> = BOSS_POWERS) => Math.round(shots * s.candleOwnShare);

/** The crowd turn wave `i` of the Roman candle's schedule lands on (he fired on crowd turn `at`). */
export const candleLands = (at: number, i: number, s: Pick<BossPowerSettings, "candleDelay"> = BOSS_POWERS) => at + s.candleDelay + i;

/**
 * The Roman candle's barrage as a crowd turn begins: the waves due land, each fireball a stage-1 fire tile (one on the
 * crowd king's square fizzles: never on his square), then the waves whose time has come are picked, candleAhead turns
 * before they land: spread out (chooseFireballs), never on the king's square or one that will be burning or hit before
 * then (`test`, the test switch: aimed at the crowd's pieces, candleAim). Returns the candle and the fire tiles after it,
 * and the turn's fireball event if a wave landed. Pure: the same everywhere, from the seed.
 */
export function candleTurn(
  p: Pick<BossPowerState, "candle" | "fire" | "seed" | "charred">,
  fen: string,
  crowd: Side,
  turn: number,
  s: Pick<BossPowerSettings, "candleWaves" | "candleDelay" | "candleAhead" | "fireStages" | "candleOwnShare"> = BOSS_POWERS,
  test = false,
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
    fire = [...(fire ?? []), ...squares.filter((sq) => !fizzled.includes(sq)).map((square) => ({ square, lit: turn, candle: true as const }))];
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
    waves = [...waves, { lands, shots, squares: chooseFireballs(fen, crowd, p.seed, lands, shots, taken, ownShots(shots, s), test ? candleAim(fen, crowd, p.charred ?? []) : []) }];
    unpicked -= shots;
    nextWave++;
  }
  return { candle: { ...c, left, next: nextWave, waves }, fire, event };
}

/** One of his own pieces sitting on a tile from his Roman candle (its square, the first in square order), or null. */
export function fireproofSquare(fire: readonly FireTile[] | undefined, fen: string, crowd: Side): string | null {
  const his = other(crowd);
  return (fire ?? []).filter((t) => t.candle && pieceAt(fen, t.square)?.color === his).map((t) => t.square).sort()[0] ?? null;
}

/** A shadow's size on a crowd turn: 1 (small) when its wave is candleAhead turns out, up to candleAhead (lands next turn). */
export const shadowStage = (lands: number, turn: number, s: Pick<BossPowerSettings, "candleAhead"> = BOSS_POWERS) => s.candleAhead - (lands - turn) + 1;

/** Where the Roman candle's fireballs are coming down: each square still to be hit, the turn it lands, its shadow's size. */
export function fireShadows(p: Pick<BossPowerState, "candle" | "turn"> | null | undefined, s: Pick<BossPowerSettings, "candleAhead"> = BOSS_POWERS): { square: string; lands: number; stage: number }[] {
  return (p?.candle?.waves ?? []).flatMap((w) => w.squares.map((square) => ({ square, lands: w.lands, stage: Math.max(1, shadowStage(w.lands, p!.turn, s)) })));
}

/** A fire tile's stage on a crowd turn: 1 (a singe) as it lands, up to fireStages (ablaze). */
export const fireStage = (t: FireTile, turn: number) => turn - t.lit + 1;

/** The tiles ablaze this crowd turn: a crowd piece left on one after the crowd's move burns, or (the candle's) chars. */
export function ablaze(boss: BossState | null | undefined, s: Pick<BossPowerSettings, "fireStages"> = BOSS_POWERS): string[] {
  const fire = boss?.powers?.fire;
  if (!boss || !fire?.length) return [];
  const turn = turnOf(boss);
  return fire.filter((t) => fireStage(t, turn) >= s.fireStages).map((t) => t.square).sort();
}

/** The char marks now (none: an empty list). */
export const charMarks = (boss: Pick<BossState, "powers"> | null | undefined): CharMark[] => boss?.powers?.charred ?? [];

/** The candle's fire burns a piece it has already reached this many times (candleHitsToBurn - 1); short of it, it chars it. */
const burnsAt = (s: Pick<BossPowerSettings, "candleHitsToBurn">) => Math.max(1, Math.round(s.candleHitsToBurn)) - 1;

/**
 * The tiles ablaze this crowd turn where a crowd piece left after the move is destroyed (the judge's and the bots' `burn`):
 * every one of his sparkler's, and those of his Roman candle's with a charred crowd piece on it now (one not yet charred
 * is only charred: it stays). A charred piece that steps onto an empty tile of the candle's ablaze burns too, but isn't
 * counted here (the judge is lenient there: docs/decisions/2026-11-20-grex-char.md).
 */
export function fireBurns(boss: BossState | null | undefined, s: Pick<BossPowerSettings, "fireStages" | "candleHitsToBurn"> = BOSS_POWERS): string[] {
  const fire = boss?.powers?.fire;
  if (!boss || !fire?.length) return [];
  const turn = turnOf(boss);
  const marks = charMarks(boss);
  const at = burnsAt(s);
  return fire.filter((t) => fireStage(t, turn) >= s.fireStages && (!t.candle || (marks.find((m) => m.square === t.square)?.n ?? 0) >= at)).map((t) => t.square).sort();
}

/**
 * The candle's tiles in `due` that char the piece on them rather than burn it (after the crowd's move, `fen`): a crowd piece
 * not the king, reached fewer than candleHitsToBurn - 1 times before (`marks`, already moved with the move).
 */
export function charSquares(fen: string, due: readonly FireTile[], marks: readonly CharMark[], crowd: Side, s: Pick<BossPowerSettings, "candleHitsToBurn"> = BOSS_POWERS): string[] {
  const at = burnsAt(s);
  return due
    .filter((t) => {
      if (!t.candle) return false;
      const pc = pieceAt(fen, t.square);
      return pc?.color === crowd && pc.type !== "k" && (marks.find((m) => m.square === t.square)?.n ?? 0) < at;
    })
    .map((t) => t.square)
    .sort();
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
 * After the crowd's move (the boss state already counting it, its char marks already moved with it): the tiles that were
 * ablaze burn out, destroying what burnOutcome says, but a crowd piece the candle's fire reaches for the first time
 * (candleHitsToBurn) is only charred (it stays, marked); the God King's warning the first time a crowd piece steps onto a
 * burning tile. Returns the new state, the position after the fire, and the squares emptied.
 */
export function fireAfterMove(
  boss: BossState,
  fen: string,
  move: string | null,
  s: Pick<BossPowerSettings, "fireStages" | "candleHitsToBurn"> = BOSS_POWERS,
): { boss: BossState; fen: string; emptied: string[] } {
  const p = boss.powers;
  if (!p?.fire?.length) return { boss, fen, emptied: [] };
  const turn = boss.crowdMoves;
  const due = p.fire.filter((t) => fireStage(t, turn) >= s.fireStages);
  // (Stepping onto a tile that isn't ablaze yet: there's still time to leave.)
  const stepped = p.stepped ?? (move && p.fire.some((t) => t.square === to(move) && fireStage(t, turn) < s.fireStages) ? turn : undefined);
  const marks = p.charred ?? [];
  const chars = charSquares(fen, due, marks, boss.crowdSide, s);
  const result = burnOutcome(fen, due.map((t) => t.square).filter((sq) => !chars.includes(sq)), boss.crowdSide);
  const fire = p.fire.filter((t) => !due.includes(t));
  // (A tile with nothing of the crowd's on it just burns out; one the candle chars a piece on burns out under it.)
  const hits = (sq: string) => (marks.find((m) => m.square === sq)?.n ?? 0) + 1;
  const burnt: BurnEvent[] = due
    .map((t): BurnEvent => {
      if (chars.includes(t.square)) return { turn, square: t.square, charred: pieceAt(fen, t.square)!.type, hits: hits(t.square) };
      const b = result.burnt.find((x) => x.square === t.square);
      return { turn, square: t.square, ...b, ...(t.candle && b?.piece ? { hits: hits(t.square) } : {}) };
    })
    .sort((a, b) => (a.square < b.square ? -1 : 1));
  const emptied = result.burnt.filter((b) => b.piece).map((b) => b.square);
  // The marks: one more on each piece charred, none on a piece burnt.
  const charred = [
    ...marks.filter((m) => !chars.includes(m.square) && !emptied.includes(m.square)),
    ...chars.map((square) => ({ square, piece: pieceAt(fen, square)!.type, n: (marks.find((m) => m.square === square)?.n ?? 0) + 1 })),
  ].sort((a, b) => (a.square < b.square ? -1 : 1));
  const powers: BossPowerState = {
    ...p,
    fire,
    burnt,
    ...(stepped !== undefined ? { stepped } : {}),
    ...(due.length && !fire.length ? { fireOut: turn } : {}),
    ...(charred.length || p.charred ? { charred } : {}),
  };
  return { boss: { ...boss, powers }, fen: result.fen, emptied };
}

/** The char marks follow a move just played on the battle's board (the crowd's or his): Boingo's splats' machinery (followSplats). */
function trackChars(b: Battle, move: string | null): void {
  const boss = b.state.boss;
  const p = boss?.powers;
  if (!move || !p?.charred?.length) return;
  const charred = followSplats(p.charred, move, b.boards.get(b.state.boards[0]!)!.fen, boss!.crowdSide);
  if (charred.length === p.charred.length && charred.every((m, i) => m.square === p.charred![i]!.square && m.piece === p.charred![i]!.piece)) return;
  b.state = { ...b.state, boss: { ...boss!, powers: { ...p, charred } } };
}

/**
 * The fire did something to see after the crowd's last move (a piece burnt or charred, a tile fizzled under the king): the
 * boss's move waits for it (FIRE_BURN_MS), solo and online. (One test for both: a char once went unwaited in both copies.)
 */
export const fireShows = (boss: { crowdMoves: number; powers?: { burnt?: readonly BurnEvent[] } | null } | null | undefined): boolean =>
  !!boss?.powers?.burnt?.some((b) => b.turn === boss.crowdMoves && !!(b.piece || b.fizzled || b.charred));

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

/** Grex: a burning tile from his sparkler, and a barrage of fireballs from his Roman candle. */
export const GREX: BossRules = {
  id: "grex",
  // (A char mark whose piece is gone: another boss's power, or a capture a tracker missed.)
  wearOff(next, t) {
    if (next.charred?.length) next.charred = marksStanding(next.charred, t.fen, t.crowd);
  },
  ultimate(next, t) {
    const now = warnThenUnleash(next, t);
    if (now) {
      next.candle = { at: t.turn, left: t.s.candleShots };
      t.events.push({ kind: "candle", turn: t.turn });
    }
    return now;
  },
  // The Roman candle runs until its last fireball has landed and every tile has burnt out.
  ultimateRunning: (p) => (p.candle?.left ?? 0) > 0 || !!p.fire?.length,
  // The Roman candle's fireballs: a wave a crowd turn from candleDelay turns after it fired, each landing as a fresh fire
  // tile; each wave's squares picked candleAhead turns before it lands (their shadows growing meanwhile).
  everyTurn(next, t) {
    if (!next.candle) return;
    const barrage = candleTurn(next, t.fen, t.crowd, t.turn, t.s, t.test === "candle");
    next.candle = barrage.candle;
    if (barrage.fire) next.fire = barrage.fire;
    if (barrage.event) t.events.push(barrage.event);
    // The first time one of his own pieces sits on fire from the candle: he laughs it off (once a match).
    const on = next.fireproof ? null : fireproofSquare(next.fire, t.fen, t.crowd);
    if (on) {
      next.fireproof = { turn: t.turn, square: on, pick: Math.floor(powerRoll(t.seed, "fireproof") * 4096) };
      t.events.push({ kind: "fireproof", turn: t.turn, square: on, pick: next.fireproof.pick });
    }
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
  // The Roman candle's shadows on the board, where its fireballs are coming down (the God King's Last Stand sits out).
  altersBoard: (boss) => fireShadows(boss.powers).length > 0,
  // The judge: a piece left to burn on a tile ablaze counts as gone (one the candle only chars doesn't), and the moves that
  // save it are always scored.
  judge: {
    mustScore: (boss, fen) => fireEscapes(fen, fireBurns(boss)),
    rank: (boss, top, fen) => fireRanked(top, fen, fireBurns(boss), boss.crowdSide),
    evaluation: (boss, evaluation, fen) => fireJudged(evaluation, fen, fireBurns(boss), boss.crowdSide),
  },
  // After the crowd's move: the char marks follow it; then what was left on a tile ablaze burns, or the candle chars it (the
  // board's position changes).
  afterCrowdMove(b, move) {
    trackChars(b, move);
    const boss = b.state.boss;
    if (!boss?.powers?.fire?.length) return;
    const id = b.state.boards[0]!;
    let board = b.boards.get(id)!;
    const out = fireAfterMove(boss, board.fen, move);
    for (const sq of out.emptied) board = burnOnBoard(board, sq);
    b.boards.set(id, board);
    b.state = { ...b.state, boss: out.boss };
  },
  // The char marks follow every move, his and the crowd's.
  afterBossMove: (b, move) => trackChars(b, move),
  // (Several bosses: another boss's move, the marks follow it too.)
  followMove: (b, move) => trackChars(b, move),
  // (Several bosses: another boss's power moved a charred piece outside a move (Wrangler's drag or pull, Smudgy's swap or Repaint,
  // Revision): its mark goes at once, as a capture's (one of the same kind the same power put on its square still wears it:
  // nothing tells them apart; bosses.md). Review, Nov 20.)
  followBoard(b) {
    const boss = b.state.boss!;
    const p = boss.powers!;
    if (!p.charred?.length) return;
    const charred = marksStanding(p.charred, b.boards.get(b.state.boards[0]!)!.fen, boss.crowdSide);
    if (charred.length < p.charred.length) b.state = { ...b.state, boss: { ...boss, powers: { ...p, charred } } };
  },
  view: (p) => ({ charred: (p.charred ?? []).map((m) => ({ ...m })) }),
};
