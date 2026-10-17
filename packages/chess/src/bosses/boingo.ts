/**
 * Boingo the Clown (BOSS_ROSTER "clown"): his rules. His passive, the pie, splats an empty square near the center for a
 * few turns (nobody, either side, may move onto it), up to two at once; his ultimate, the funhouse, turns the board
 * round in steps (Eric, Oct 11): upside down, a quarter turn to one side, a half turn to the other side, then back where
 * it started. As it comes he plays the crowd's first move for it, a weak but recoverable one, unscored (Eric, Oct 12:
 * "the forced move is the joke"); from the next turn the crowd plays its own on the turned board. Numbers:
 * BOSS_POWERS.pie*, funhouse*. His art and moments are the app's (characters/clown.ts, the pie in characters/effects/).
 */
import { BOSS_POWERS, type BossPowerState, type BossState } from "@chessroyale/core";
import { playOnBoard } from "../boards.ts";
import { applyMove, legalMoves, pieceAt, sideToMove, toSan } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import type { MoveScore } from "../uci.ts";
import { bossPowers, moveLoss, powerRoll, to, turnOf, warnThenUnleash, type Battle, type BossRules } from "./base.ts";

/**
 * How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). The funhouse's is its own screen,
 * after the move he plays for the crowd: he pogos on, the board turns upside down, he speaks, the move lands, he goes.
 */
export const BOINGO_FX = { pie: 2300, funhouse: 5200, spin: 2600 } as const;

/** The legal moves of the side not to move (as if it were its turn): what a square would block for the boss. */
function movesOfOther(fen: string): string[] {
  const parts = fen.split(" ");
  parts[1] = parts[1] === "w" ? "b" : "w";
  parts[3] = "-";
  try {
    return legalMoves(parts.join(" "));
  } catch {
    return [];
  }
}

const CENTRE = ["d4", "e4", "d5", "e5", "c3", "d3", "e3", "f3", "c4", "f4", "c5", "f5", "c6", "d6", "e6", "f6"];
const centreDistance = (sq: string) => Math.abs(sq.charCodeAt(0) - 100.5) + Math.abs(Number(sq[1]) - 4.5);

/**
 * Pie: the square to pie, an empty one near the center chosen so the position barely changes: the fewest moves of
 * either side can land there right now (none, if possible), nearest the middle first, a pick from the best few. Never a
 * square already pied (`taken`).
 */
export function choosePie(fen: string, seed: number, turn: number, taken: readonly string[] = []): string | null {
  const reach = new Map<string, number>();
  for (const m of [...legalMoves(fen), ...movesOfOther(fen)]) reach.set(to(m), (reach.get(to(m)) ?? 0) + 1);
  const empty = CENTRE.filter((sq) => !pieceAt(fen, sq) && !taken.includes(sq))
    .map((sq) => ({ sq, reach: reach.get(sq) ?? 0, d: centreDistance(sq) }))
    .sort((a, b) => a.reach - b.reach || a.d - b.d || (a.sq < b.sq ? -1 : 1));
  if (!empty.length) return null;
  const least = empty.filter((e) => e.reach === empty[0]!.reach).slice(0, 4);
  return least[Math.floor(powerRoll(seed, "pie", turn) * least.length)]!.sq;
}

/** The pied squares now (none: an empty list). */
export const piedSquares = (boss: Pick<BossState, "powers"> | null | undefined): string[] => (boss?.powers?.pies ?? []).map((p) => p.square);

// ---------------- The funhouse ----------------

/** How far the board is turned clockwise from the crowd's own view (degrees). */
export type BoardAngle = 0 | 90 | 180 | 270;

/**
 * The funhouse's angle on crowd turn `turn`: upside down (180) from the turn it came, then every `step` crowd turns the
 * next: its side (90 or 270), the other side, and back to 0, where it stays. 0 without a funhouse or before it.
 */
export function funhouseAngle(f: BossPowerState["funhouse"], turn: number, step: number = BOSS_POWERS.funhouseStepTurns): BoardAngle {
  if (!f || turn < f.turn) return 0;
  const k = Math.floor((turn - f.turn) / Math.max(1, step));
  return k === 0 ? 180 : k === 1 ? f.side : k === 2 ? (f.side === 90 ? 270 : 90) : 0;
}

/** The crowd turn the funhouse's board is back where it started: its effect is over from then. */
export const funhouseEnds = (f: NonNullable<BossPowerState["funhouse"]>, step: number = BOSS_POWERS.funhouseStepTurns) => f.turn + 3 * Math.max(1, step);

/** The board's angle for the crowd now (the funhouse's step on this crowd turn). */
export const boardAngle = (boss: BossState | null | undefined, step: number = BOSS_POWERS.funhouseStepTurns): BoardAngle => {
  const p = boss?.powers;
  return p?.funhouse ? funhouseAngle(p.funhouse, turnOf(boss!), step) : 0;
};

/** The crowd sees the board upside down now (the funhouse's first step). */
export const boardFlipped = (boss: BossState | null | undefined): boolean => boardAngle(boss) === 180;

/**
 * The funhouse's move is due: it came as this crowd turn began, and he hasn't played the crowd's move for it yet. Once a
 * funhouse (each new one, after a repeat ultimate, plays its own once).
 */
export const funhouseDue = (boss: BossState | null | undefined): boolean => {
  const f = boss?.powers?.funhouse;
  return !!f && !boss!.result && bossPowers(boss)?.ultimate === "funhouse" && f.turn === turnOf(boss!) && !f.move;
};

/**
 * The funhouse's move played: the crowd's move is on the board (the caller plays it) as this crowd turn, and its moment
 * (he pogos on, the board turns upside down, the move lands) is this turn's event.
 */
export function funhousePlayed(boss: BossState, move: string, san: string): BossState {
  const p = boss.powers!;
  const f = p.funhouse!;
  // (His joke: which line, 0-4095 from the seed and the turn, the same on every screen; the app takes it modulo its lines.)
  const pick = Math.floor(powerRoll(p.seed, "funhouse-joke", f.turn) * 4096);
  return { ...boss, crowdMoves: boss.crowdMoves + 1, powers: { ...p, funhouse: { ...f, move, san }, events: [...p.events, { kind: "funhouse", turn: f.turn, pick }] } };
}

/**
 * The board's angle a screen shows for the powers as they were set for crowd turn `turn` (BossPowerView's): the
 * funhouse's, except the right way up while its move is still to come (the board turns in that move's moment).
 */
export const shownAngle = (f: BossPowerState["funhouse"], turn: number, step: number = BOSS_POWERS.funhouseStepTurns): BoardAngle =>
  f && turn === f.turn && !f.move ? 0 : funhouseAngle(f, turn, step);

/** Boingo: pies on squares near the center (nobody moves onto them), and the funhouse turning the board round. */
export const BOINGO: BossRules = {
  id: "clown",
  wearOff(next, t) {
    // Each pie after its turns.
    if (next.pies?.length) next.pies = next.pies.filter((p) => p.until >= t.turn);
  },
  ultimate(next, t) {
    const now = warnThenUnleash(next, t);
    if (now) {
      // (The side of its quarter turn, from the seed: the same on every screen.)
      // (Its moment is the move he plays for the crowd: its event is added when it's played, funhousePlayed.)
      next.funhouse = { turn: t.turn, side: powerRoll(t.seed, "funhouse-side", t.turn) < 0.5 ? 90 : 270 };
    }
    return now;
  },
  // The funhouse runs until the board is back where it started (the meter fills again from then).
  ultimateRunning: (p, turn, s) => !!p.funhouse && turn < funhouseEnds(p.funhouse, s.funhouseStepTurns),
  // Each later step turns the board as its crowd turn begins: to his side, to the other side, then back.
  everyTurn(next, t) {
    const f = next.funhouse;
    const step = Math.max(1, t.s.funhouseStepTurns);
    if (f && t.turn > f.turn && t.turn <= funhouseEnds(f, step) && (t.turn - f.turn) % step === 0) t.events.push({ kind: "spin", turn: t.turn });
  },
  // A pie every pieEvery turns while fewer than pieMax are on the board, each for pieTurns.
  passive(next, t) {
    const pies = next.pies ?? [];
    if (t.turn < next.nextPassive || pies.length >= t.s.pieMax) return;
    const square = choosePie(t.fen, t.seed, t.turn, pies.map((p) => p.square));
    if (square) {
      next.pies = [...pies, { square, until: t.turn + t.s.pieTurns - 1 }];
      t.events.push({ kind: "pie", turn: t.turn, square });
      next.nextPassive = t.turn + t.s.pieEvery;
    } else next.nextPassive = t.turn + 1;
  },
  // Nobody can move onto a pie, the boss included.
  crowdFilter(allowed, boss) {
    const pied = piedSquares(boss);
    return pied.length ? allowed.filter((m) => !pied.includes(to(m))) : allowed;
  },
  bossStops(boss) {
    const pied = piedSquares(boss);
    return pied.length ? (m) => pied.includes(to(m)) : null;
  },
  stopReason: (boss, _fen, m) => ((boss.powers?.pies ?? []).some((x) => x.square === to(m)) ? "pie" : null),
  powerTurn: (boss) => piedSquares(boss).length > 0 || boardAngle(boss) !== 0,
};

// ---------------- The funhouse's move in a match ----------------

/**
 * Boingo's funhouse: the move he plays for the crowd. Weak but recoverable: from the allowed moves, one that gives
 * away about `loss` points against the best (1 to 2.5 pawns from an even position), nearest the middle of that range,
 * never past `maxLogit` in log-odds, never one whose line allows a forced mate, never one that leaves the queen to be
 * taken (unless it takes a queen itself: a trade). The engine's top moves first; if none is weak enough, the rest of
 * the allowed moves are searched too. Like the boss's slips, the pick is checked head to head with the best once.
 */
export async function funhouseMoveFrom(
  engine: EngineLike,
  fen: string,
  allowed: readonly string[] | null = null,
  loss: readonly [number, number] = BOSS_POWERS.funhouseLoss,
  maxLogit: number = BOSS_POWERS.funhouseMaxLogit,
): Promise<string> {
  const legal = allowed ? [...allowed] : legalMoves(fen);
  if (legal.length <= 1) return legal[0]!;
  const ok = new Set(legal);
  const top = (await engine.topMoves(fen, 8)).filter((m) => ok.has(m.move));
  const seen = new Set(top.map((m) => m.move));
  const scoredAll = [...top];
  const [lo, hi] = loss;
  const safe = (m: MoveScore) => !(m.mate !== undefined && m.mate < 0) && !leavesQueen(fen, m);
  const options = (list: readonly MoveScore[], best: number) =>
    list.filter(safe).map((m) => ({ move: m.move, loss: moveLoss(best, m.expected) })).filter((x) => x.loss.logit <= maxLogit || x.loss.points <= 2);
  let best = top[0]?.expected;
  let inRange = best === undefined ? [] : options(top, best).filter((x) => x.loss.points >= lo && x.loss.points <= hi);
  if (!inRange.length) {
    const rest = legal.filter((m) => !seen.has(m));
    if (rest.length) scoredAll.push(...(await engine.scoreMoves(fen, rest)));
    best = Math.max(...scoredAll.map((m) => m.expected));
    inRange = options(scoredAll, best).filter((x) => x.loss.points >= lo && x.loss.points <= hi);
  }
  const bestMove = [...scoredAll].sort((a, b) => b.expected - a.expected)[0]?.move ?? legal[0]!;
  const all = options(scoredAll, best ?? 0.5).filter((x) => x.move !== bestMove);
  // Nearest the middle of the range; else the weakest move short of it (still a gift, never a blunder); else the best.
  const mid = (lo + hi) / 2;
  const pick =
    [...inRange].sort((a, b) => Math.abs(a.loss.points - mid) - Math.abs(b.loss.points - mid) || (a.move < b.move ? -1 : 1))[0] ??
    [...all].filter((x) => x.loss.points < lo).sort((a, b) => b.loss.points - a.loss.points)[0];
  if (!pick) return bestMove;
  // Checked once more head to head with the best (the wide search spreads itself thin): too much, and the gentlest
  // option short of the range is played instead.
  const check = await engine.scoreMoves(fen, [bestMove, pick.move]);
  const b = check.find((m) => m.move === bestMove)?.expected;
  const g = check.find((m) => m.move === pick.move);
  if (b === undefined || !g) return pick.move;
  const l = moveLoss(Math.max(b, g.expected), g.expected);
  if (l.points <= hi + 5 && (l.logit <= maxLogit || l.points <= 2) && safe(g)) return pick.move;
  const gentler = [...all].filter((x) => x.loss.points < pick.loss.points).sort((a, c) => c.loss.points - a.loss.points)[0];
  return gentler?.move ?? bestMove;
}

/** After `m`, the reply takes the mover's queen, and `m` didn't take a queen itself (a trade is fine). */
function leavesQueen(fen: string, m: MoveScore): boolean {
  if (!m.reply) return false;
  const mover = sideToMove(fen);
  if (pieceAt(fen, m.move.slice(2, 4))?.type === "q") return false;
  const target = pieceAt(applyMove(fen, m.move), m.reply.slice(2, 4));
  return target?.type === "q" && target.color === mover;
}

/** His part in the match runner (MatchRunner's funhouseDue, playFunhouse and applyFunhouse). */
export const boingoBattle = {
  /** The boss plays the crowd's move this turn (its funhouse's first), before the crowd picks. */
  funhouseDue(b: Battle): boolean {
    return funhouseDue(b.state.boss) && !b.finalGameOver() && !b.bossToMove();
  },

  /** The funhouse: the boss picks the crowd's move (a weak but recoverable one) and plays it. */
  async playFunhouse(b: Battle, engine: EngineLike): Promise<string> {
    const fen = b.boards.get(b.state.boards[0]!)!.fen;
    const move = await funhouseMoveFrom(engine, fen, b.crowdAllowed());
    return boingoBattle.applyFunhouse(b, move);
  },

  /**
   * Plays the funhouse's move for the crowd (from the host's engine online; an illegal or disallowed one is replaced
   * by the first allowed move, so every screen and the server agree). It's the crowd's move on the board, but nobody
   * picked it: it isn't scored. The board stays upside down for the rest of the funhouse's first step.
   */
  applyFunhouse(b: Battle, move: string): string {
    const boss = b.state.boss!;
    const id = b.state.boards[0]!;
    const board = b.boards.get(id)!;
    const legal = b.crowdAllowed(id) ?? legalMoves(board.fen);
    const m = legal.includes(move) ? move : legal[0]!;
    const san = toSan(board.fen, m);
    b.boards.set(id, playOnBoard(board, m, board.expected));
    b.state = { ...b.state, boss: funhousePlayed(boss, m, san) };
    b.afterCrowdMove(m);
    return m;
  },
};
