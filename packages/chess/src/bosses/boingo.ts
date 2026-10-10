/**
 * Boingo the Clown (BOSS_ROSTER "clown"): his rules. His passive, the pie, splats an empty square near the centre for a
 * few turns (nobody, either side, may move onto it); his ultimate, the funhouse, plays the crowd's move for it (a weak
 * but recoverable one, unscored), then the crowd sees the board flipped for a couple of turns. Numbers:
 * BOSS_POWERS.pie*, funhouse*, flipTurns. His art and moments are the app's (characters/clown.ts, the pie in
 * characters/effects/).
 */
import { BOSS_POWERS, type BossState } from "@chessroyale/core";
import { playOnBoard } from "../boards.ts";
import { applyMove, legalMoves, pieceAt, sideToMove, toSan } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import type { MoveScore } from "../uci.ts";
import { bossPowers, moveLoss, powerRoll, to, turnOf, warnThenUnleash, type Battle, type BossRules } from "./base.ts";

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const BOINGO_FX = { pie: 2300, funhouse: 5200 } as const;

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
 * Pie: the square to pie, an empty one near the centre chosen so the position barely changes: the fewest moves of
 * either side can land there right now (none, if possible), nearest the middle first, a pick from the best few.
 */
export function choosePie(fen: string, seed: number, turn: number): string | null {
  const reach = new Map<string, number>();
  for (const m of [...legalMoves(fen), ...movesOfOther(fen)]) reach.set(to(m), (reach.get(to(m)) ?? 0) + 1);
  const empty = CENTRE.filter((sq) => !pieceAt(fen, sq))
    .map((sq) => ({ sq, reach: reach.get(sq) ?? 0, d: centreDistance(sq) }))
    .sort((a, b) => a.reach - b.reach || a.d - b.d || (a.sq < b.sq ? -1 : 1));
  if (!empty.length) return null;
  const least = empty.filter((e) => e.reach === empty[0]!.reach).slice(0, 4);
  return least[Math.floor(powerRoll(seed, "pie", turn) * least.length)]!.sq;
}

/** The boss plays the crowd's move this turn (the funhouse), and hasn't yet. */
export const funhouseDue = (boss: BossState | null | undefined): boolean =>
  !!boss?.powers && !boss.result && bossPowers(boss)?.ultimate === "funhouse" && boss.powers.ultAt === turnOf(boss) && !boss.powers.funhouse;

/** After the funhouse, the crowd sees the board flipped for its next few turns. */
export const boardFlipped = (boss: BossState | null | undefined): boolean => {
  const p = boss?.powers;
  return !!p?.funhouse && p.flipUntil !== undefined && turnOf(boss!) > p.funhouse.turn && turnOf(boss!) <= p.flipUntil;
};

/** The funhouse played: the crowd's move is on the board (the caller plays it), and the board flips for a while. */
export function funhousePlayed(boss: BossState, move: string, san: string): BossState {
  const p = boss.powers!;
  const turn = turnOf(boss);
  return {
    ...boss,
    crowdMoves: boss.crowdMoves + 1,
    powers: { ...p, funhouse: { turn, move, san }, flipUntil: turn + BOSS_POWERS.flipTurns, events: [...p.events, { kind: "funhouse", turn }] },
  };
}

/** Boingo: a pie on a square near the centre (nobody moves onto it), and he plays the crowd's move (the funhouse). */
export const BOINGO: BossRules = {
  id: "clown",
  wearOff(next, t) {
    // The pie after its turns.
    if (next.pie && next.pie.until < t.turn) next.pie = null;
  },
  // (The funhouse's moment is the move it plays: added when it's played.)
  ultimate: warnThenUnleash,
  passive(next, t) {
    if (t.turn < next.nextPassive) return;
    const square = choosePie(t.fen, t.seed, t.turn);
    if (square) {
      next.pie = { square, until: t.turn + t.s.pieTurns - 1 };
      t.events.push({ kind: "pie", turn: t.turn, square });
      next.nextPassive = t.turn + t.s.pieTurns + t.s.pieGap;
    } else next.nextPassive = t.turn + 1;
  },
  // Nobody can move onto the pie, the boss included.
  crowdFilter(allowed, boss) {
    const pie = boss.powers!.pie;
    return pie ? allowed.filter((m) => to(m) !== pie.square) : allowed;
  },
  bossStops(boss) {
    const pie = boss.powers?.pie?.square;
    return pie ? (m) => to(m) === pie : null;
  },
  powerTurn: (boss) => !!boss.powers!.pie || boardFlipped(boss),
};

// ---------------- The funhouse in a match ----------------

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
  /** The boss plays the crowd's move this turn (its funhouse), before the crowd picks. */
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
   * by the first allowed move). It's the crowd's move on the board, but nobody picked it: it isn't scored, and the
   * boss's strike doesn't count it. The board then shows flipped for the crowd's next turns.
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
