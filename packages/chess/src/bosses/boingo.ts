/**
 * Boingo the Clown (BOSS_ROSTER "clown"): his rules. His passive, the pie (Eric, Nov 12; it replaced the pie on an empty
 * square near the center): he throws it in the face of one of the crowd's pieces whose two squares diagonally behind it
 * (toward the crowd's own back rank) are both empty, and it splits onto those two: nobody, either side, may move onto them
 * for a turn. The piece hit gets a splat mark (it follows the piece); a second splat freezes it for a turn, and its mark
 * goes. His ultimate, the funhouse, turns the board round in steps (Eric, Oct 11): upside down, a quarter turn to one
 * side, a half turn to the other side, then back where it started. As it comes he plays the crowd's first move for it, a
 * weak but recoverable one, unscored (Eric, Oct 12: "the forced move is the joke"); from the next turn the crowd plays its
 * own on the turned board. Numbers: BOSS_POWERS.pie*, funhouse*. His art and moments are the app's (characters/clown.ts,
 * the pie in characters/effects/). docs/decisions/2026-11-12-boingo-face-pie.md.
 */
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type BossState, type SplatMark } from "@chessroyale/core";
import { playOnBoard } from "../boards.ts";
import { applyMove, legalMoves, pieceAt, sideToMove, toSan } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import type { MoveScore } from "../uci.ts";
import { VALUE, bossPowers, from, heldIn, moveLoss, powerRoll, to, turnOf, warnThenUnleash, type Battle, type BossRules, type Side } from "./base.ts";

/**
 * How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). The pie's: its banner, his throw, the
 * pie in the piece's face, the two pieces of it landing on the squares behind (the app's PIE). The funhouse's is its own
 * screen, after the move he plays for the crowd: he pogos on, the board turns upside down, he speaks, the move lands, he goes.
 */
export const BOINGO_FX = { pie: 2700, funhouse: 5200, spin: 2600 } as const;

/**
 * The squares a move lands a piece on: its target, and castling's rook too (the review of the face pie, Nov 12: a rook could castle
 * onto a pie). Castling is any king move that also moves its own rook (standard or Chess960 notation alike): found by playing it.
 */
export function lands(m: string, fen: string): string[] {
  const king = pieceAt(fen, from(m));
  if (king?.type !== "k" || from(m)[1] !== to(m)[1]) return [to(m)];
  const near = Math.abs(from(m).charCodeAt(0) - to(m).charCodeAt(0));
  const own = pieceAt(fen, to(m));
  if (near < 2 && !(own && own.color === king.color)) return [to(m)];
  try {
    const after = applyMove(fen, m);
    const rank = from(m)[1]!;
    const out = new Set<string>([to(m)]);
    for (const f of "abcdefgh") {
      const sq = `${f}${rank}`;
      const p = pieceAt(after, sq);
      const was = pieceAt(fen, sq);
      if (p && p.color === king.color && (!was || was.type !== p.type || was.color !== p.color)) out.add(sq);
    }
    return [...out];
  } catch {
    return [to(m)];
  }
}

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

// ---------------- The pie ----------------

/**
 * The two squares diagonally behind `square` from the crowd's side (toward its own back rank: a rank down for White, up
 * for Black), the a-side one first; null when either is off the board (an edge file, the crowd's back rank).
 */
export function behindSquares(square: string, crowd: Side): [string, string] | null {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) + (crowd === "w" ? -1 : 1);
  if (f < 1 || f > 6 || r < 1 || r > 8) return null;
  return [`${"abcdefgh"[f - 1]}${r}`, `${"abcdefgh"[f + 1]}${r}`];
}

/** A throw: the piece hit in the face (its square and kind), the two squares the pie splits onto, and whether it freezes. */
export interface PieThrow {
  square: string;
  piece: string;
  pied: [string, string];
  freeze: boolean;
}

/**
 * The pie's target (the crowd to move in `fen`): one of the crowd's pieces, never the king, whose two squares diagonally
 * behind it are both on the board, empty and not already pied (`taken`). The guards: the crowd keeps a legal move with
 * the two squares pied and (a splat that freezes: `marks` holds pieSplatsToFreeze - 1 splats on it) the piece held, and
 * the boss keeps one in the position as it stands (as if it were his move). A real nuisance: ranked by the crowd's moves
 * the two pies take away (the piece's own retreats count double: 2 x its moves onto them + the other pieces' moves onto
 * them), then by value (pieces before pawns), then by square; the pick at random from the seed among the top three, so
 * it's not the same piece every time. `test` (the test switch, ?power=pie): a piece already splatted comes first, so the
 * second splat (the freeze) comes on the next throw. Null: no target, no throw.
 */
export function choosePieThrow(
  fen: string,
  crowd: Side,
  seed: number,
  turn: number,
  marks: readonly SplatMark[] = [],
  taken: readonly string[] = [],
  s: Pick<BossPowerSettings, "pieSplatsToFreeze"> = BOSS_POWERS,
  test = false,
): PieThrow | null {
  const legal = legalMoves(fen);
  if (!legal.length) return null;
  const his = movesOfOther(fen);
  const options: (PieThrow & { score: number; value: number; marked: number })[] = [];
  for (const f of "abcdefgh")
    for (let r = 1; r <= 8; r++) {
      const square = `${f}${r}`;
      const pc = pieceAt(fen, square);
      if (!pc || pc.color !== crowd || pc.type === "k") continue;
      const pied = behindSquares(square, crowd);
      if (!pied || pied.some((sq) => pieceAt(fen, sq) || taken.includes(sq))) continue;
      const marked = marks.find((m) => m.square === square)?.n ?? 0;
      const freeze = marked + 1 >= Math.max(1, s.pieSplatsToFreeze);
      const onPie = (m: string) => lands(m, fen).some((sq) => pied.includes(sq));
      if (!legal.some((m) => !onPie(m) && !(freeze && heldIn(fen, m, [square])))) continue;
      if (his.length && his.every(onPie)) continue;
      const own = legal.filter((m) => from(m) === square && onPie(m)).length;
      const others = legal.filter((m) => from(m) !== square && onPie(m)).length;
      options.push({ square, piece: pc.type, pied, freeze, score: 2 * own + others, value: VALUE[pc.type] ?? 0, marked });
    }
  if (!options.length) return null;
  options.sort((a, b) => (test ? b.marked - a.marked : 0) || b.score - a.score || b.value - a.value || (a.square < b.square ? -1 : 1));
  const top = test && options[0]!.marked ? options.slice(0, 1) : options.slice(0, 3);
  const { square, piece, pied, freeze } = top[Math.floor(powerRoll(seed, "pie", turn) * top.length)]!;
  return { square, piece, pied, freeze };
}

/**
 * The splat marks through a move just played (`fen`: the position after it): the piece that moved takes its mark with it
 * (a promotion: its new kind), castling's rook too; one taken (en passant too) is gone. Pure, so every device keeps them alike.
 */
export function followSplats(marks: readonly SplatMark[], move: string, fen: string, crowd: Side): SplatMark[] {
  const f = from(move);
  const t = to(move);
  const king = pieceAt(fen, t);
  // (Castling: the king two files along its rank; its rook goes round it.)
  const castle = king?.type === "k" && f[1] === t[1] && Math.abs(f.charCodeAt(0) - t.charCodeAt(0)) === 2 ? (t[0] === "g" ? [`h${t[1]}`, `f${t[1]}`] : [`a${t[1]}`, `d${t[1]}`]) : null;
  return marks.flatMap((m) => {
    const moved = m.square === f ? t : castle && m.square === castle[0] ? castle[1]! : null;
    const sq = moved ?? m.square;
    const pc = pieceAt(fen, sq);
    if (!pc || pc.color !== crowd || (!moved && pc.type !== m.piece)) return [];
    return [{ ...m, square: sq, piece: pc.type }];
  });
}

/** The pied squares now (none: an empty list). */
export const piedSquares = (boss: Pick<BossState, "powers"> | null | undefined): string[] => (boss?.powers?.pies ?? []).map((p) => p.square);

/** The splat marks now (none: an empty list). */
export const splatMarks = (boss: Pick<BossState, "powers"> | null | undefined): SplatMark[] => boss?.powers?.splats ?? [];

/** The splat marks follow a move just played on the battle's board (the crowd's or his). */
function trackSplats(b: Battle, move: string | null): void {
  const boss = b.state.boss;
  const p = boss?.powers;
  if (!move || !p?.splats?.length) return;
  const splats = followSplats(p.splats, move, b.boards.get(b.state.boards[0]!)!.fen, boss!.crowdSide);
  if (splats.length === p.splats.length && splats.every((m, i) => m.square === p.splats![i]!.square && m.piece === p.splats![i]!.piece)) return;
  b.state = { ...b.state, boss: { ...boss!, powers: { ...p, splats } } };
}

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

/** Boingo: the pie in a piece's face (its two squares behind pied, a splat on it, a second freezes it), and the funhouse turning the board round. */
export const BOINGO: BossRules = {
  id: "clown",
  wearOff(next, t) {
    // The pies after their turn; the freeze after its turn (or once its piece is gone); a mark whose piece is gone.
    if (next.pies?.length) next.pies = next.pies.filter((p) => p.until >= t.turn);
    if (next.frozen) {
      const piece = pieceAt(t.fen, next.frozen.square);
      if (next.frozen.until < t.turn || piece?.color !== t.crowd || piece.type !== next.frozen.piece) next.frozen = null;
    }
    if (next.splats?.length) next.splats = next.splats.filter((m) => pieceAt(t.fen, m.square)?.color === t.crowd && pieceAt(t.fen, m.square)?.type === m.piece);
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
  // The pie: every pieEvery turns (the test switch: every turn), at a piece with both squares behind it empty (none: the
  // next turn), while there's room for its two pies (pieMax). The piece hit gets a splat; at pieSplatsToFreeze it freezes.
  passive(next, t) {
    const pies = next.pies ?? [];
    if (t.turn < next.nextPassive || pies.length + 2 > Math.max(2, t.s.pieMax)) return;
    const test = t.test === "pie";
    const marks = next.splats ?? [];
    const pick = choosePieThrow(t.fen, t.crowd, t.seed, t.turn, marks, pies.map((p) => p.square), t.s, test);
    if (!pick) {
      next.nextPassive = t.turn + 1;
      return;
    }
    const until = t.turn + t.s.pieTurns - 1;
    next.pies = [...pies, ...pick.pied.map((square) => ({ square, until }))];
    const rest = marks.filter((m) => m.square !== pick.square);
    if (pick.freeze) {
      next.frozen = { square: pick.square, piece: pick.piece, until: t.turn + Math.max(1, t.s.pieFreezeTurns) - 1 };
      next.splats = rest;
    } else next.splats = [...rest, { square: pick.square, piece: pick.piece, n: (marks.find((m) => m.square === pick.square)?.n ?? 0) + 1 }];
    t.events.push({ kind: "pie", turn: t.turn, square: pick.square, squares: [...pick.pied] });
    next.nextPassive = t.turn + (test ? 1 : Math.max(1, t.s.pieEvery));
  },
  // A frozen piece can't move, nor castle with a frozen rook (the held pieces' one rule: heldIn).
  held: (boss) => (boss.powers!.frozen ? [boss.powers!.frozen.square] : []),
  // Nobody can move onto a pie, the boss included.
  crowdFilter(allowed, boss, fen) {
    const pied = piedSquares(boss);
    return pied.length ? allowed.filter((m) => !lands(m, fen).some((sq) => pied.includes(sq))) : allowed;
  },
  bossStops(boss) {
    const pied = piedSquares(boss);
    return pied.length ? (m) => pied.includes(to(m)) : null;
  },
  stopReason: (boss, fen, m) => {
    const pied = (boss.powers?.pies ?? []).map((x) => x.square);
    return pied.length && lands(m, fen).some((sq) => pied.includes(sq)) ? "pie" : null;
  },
  powerTurn: (boss) => piedSquares(boss).length > 0 || !!boss.powers!.frozen || boardAngle(boss) !== 0,
  // The frozen piece shows ice (as Ginger's freeze), through the boss's turn after it too.
  iced: (boss) => (boss.powers!.frozen ? [boss.powers!.frozen.square] : []),
  // The marks follow every move, his and the crowd's (the funhouse's move for the crowd too).
  afterCrowdMove: (b, move) => trackSplats(b, move),
  afterBossMove: (b, move) => trackSplats(b, move),
  view: (p) => ({ splats: (p.splats ?? []).map((m) => ({ ...m })) }),
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
