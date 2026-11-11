/**
 * Don Dough, the zebra kingpin who runs "just a bakery" (BOSS_ROSTER "zebra"; Eric, Nov 10-11; docs/decisions/2026-11-11-don-dough.md).
 * He starts from the game so far, as most bosses do (a raid; Boss alone: the starting position).
 *
 * His opening comment (Eric: "since he's a chess enthusiast he throws out a comment on whatever opening you do, say 3-4 moves
 * in"): once a battle, as the first crowd turn from the battle's second on begins with the game at move 4 or later, the opening
 * library's name for the game's moves (openingNameFor) and which of its two lines (`pick`): the `openingTalk` event. The app
 * matches the name to his families ("starts with"), and says his fallback when none matches.
 *
 * His passive, Rising Dough:
 * - **The drop:** at the end of a few of his turns early in the battle (after crowd move `next`: the first drawn from
 *   doughFirst, each next one doughGap of the crowd's moves later, none after doughLast; at most doughDrops a battle and
 *   doughLive on the board at once), a lump of dough on an empty square of his half. Everyone sees what it will rise as
 *   (doughOdds among the kinds he can have now: never a ninth pawn or more pieces than promotions could make) and its oven
 *   timer, starting at doughTimers[kind] minutes (Eric's: pawn 4, knight and bishop 7, rook 10, queen 15).
 * - **Where** (doughSquare): never his back rank, the en passant square, a lump's square, or a square one of the crowd's moves
 *   reaches now (a free squash isn't a fight); a pawn, knight or bishop on the two ranks of his half nearest the middle, a rook
 *   or queen on the two ranks behind them, on a file where a pawn of the crowd's stands below it (Eric: "near his side somewhere,
 *   but somewhere that's gettable for the pawn"). In a seeded order; none fits: it waits for his next turn's end.
 * - **The timer:** one minute off for every move, the crowd's and his (afterCrowdMove, afterBossMove). At 00:00 his piece
 *   rises on the lump's square, if the guards allow it (riseCheck: no pawn on a first or last rank, no impossible counts, neither
 *   king in check, a move for the side to move, no mate in one for either side, a position Stockfish plays); else it waits at
 *   00:00 and tries again after the next move. Rises after the crowd's move come before his move (he can play the new piece);
 *   after his move, before the crowd's turn.
 * - **The squash (the director's call):** a move of the crowd's landing on a lump's square squashes it (gone). His own pieces
 *   never move onto one (bossStops; the limit lifts if it's his only move, and then his move squashes it). A lump never blocks
 *   a move through its square.
 *
 * His ultimate, Gold Plate (the rage meter, `rageSpeed.zebra`, at most maxUltimates.zebra a battle):
 * - The usual warning as a crowd turn begins (only while he has a piece to gild); at the start of his turn after the crowd's
 *   move (afterCrowdMove), before his move (he keeps his turn): his queen turns gold; no queen, or it's gold already: his
 *   strongest piece that isn't (a rook, then a bishop or knight; ties by the seed). Kings and pawns never.
 * - **From then on, the crowd's pawns can't capture a gold piece** for the rest of the battle (other pieces can). A gold piece
 *   keeps its gold as it moves (`gold`: its square now). In the move lists as Big Boy's blocks and Babur's hoops are
 *   (crowdFilter: the crowd's allowed moves, the judge's and the bots', the engines' searchmoves); a turn it would leave the
 *   crowd no legal move, it lifts for that move. The screens say "gold" for a refused pawn capture (stopReason).
 * - The admins' trigger: at the start of his next turn, without the warning.
 *
 * Test switches (solo): `?power=dough` starts from BALLOON_TEST_MOVES (a pawn gone each side, so a pawn can rise) and drops a
 * pawn's lump at the end of his first turn; `?power=goldplate` warns as the second turn begins.
 */
import { BOSS_POWERS, DOUGH_PIECES, type BossPowerSettings, type BossPowerState, type DoughLump, type DoughMark, type DoughPiece, type PowerEvent, type ZebraState } from "@chessroyale/core";
import { BOSS_OPENING, newBoard } from "../boards.ts";
import { openingNameFor } from "../openings.ts";
import { fenAtPly, legalMoves, moveNumber, pieceAt, positionOver, sideToMove, withPiece } from "../rules.ts";
import { VALUE, from, materialOf, meterFull, other, powerRoll, testSwitch, to, turnOf, unleashed, type Battle, type BossRules, type Side, type StopFields } from "./base.ts";
import { BALLOON_TEST_MOVES, hoopsGuard, landRefused } from "./tiger.ts";
import { tidyEnPassant } from "./timber.ts";

// ---------------- His moments ----------------

/**
 * His animations' and props' lengths (ms; the art's, scripts/boss-art/out/boss-zebra and zebra-props on claude/boss-art,
 * copied into packages/app/src/characters/zebra.ts and zebra-dough.ts): his `drop` (the lump lands on its square at `landAt`: the
 * dough's `land`), the timer's `ding` at 00:00 and the dough's `rise` (his piece shows from `riseAt`), the
 * `squash`, the timer's roll, and Gold Plate's whole moment (Eric, Nov 11: "like 10 total": his cast, the gilding and shine,
 * his line, back to idle: `gildAt` his first stroke and the gilding, `swapAt` the gold piece in, `shineAt` its shine, `glintAt` its
 * glint for good, `bragAt` his brag, `lineAt` his line).
 */
export const ZEBRA_ANIM = { drop: 1200, landAt: 940, land: 300, ding: 800, rise: 890, riseAt: 470, squash: 600, roll: 250, goldPlate: 10000, gildAt: 2480, swapAt: 2720, shineAt: 3300, glintAt: 4780, bragAt: 4300, lineAt: 5200 } as const;

/**
 * How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts, so the server waits for them): a drop (his
 * lob, then the lump landing), a rise (the ding, then the rise to its pop), a squash, Gold Plate (its 10 s; at the start of his
 * turn: his move waits for it, zebraTurnMs). His opening comment is a line: it holds nothing.
 */
export const ZEBRA_FX = {
  doughDrop: ZEBRA_ANIM.landAt + ZEBRA_ANIM.land,
  doughRise: ZEBRA_ANIM.ding + ZEBRA_ANIM.rise,
  doughSquash: ZEBRA_ANIM.squash,
  goldPlate: ZEBRA_ANIM.goldPlate,
  openingTalk: 0,
} as const;

type DoughSettings = Pick<BossPowerSettings, "doughTimers" | "doughOdds" | "doughDrops" | "doughFirst" | "doughGap" | "doughLast" | "doughLive" | "doughReach" | "doughLeadMax">;

/** His state (a fresh one before his battle has set it up). */
export const zebraOf = (p: Pick<BossPowerState, "zebra"> | null | undefined): ZebraState =>
  p?.zebra ?? {
    lumps: [],
    drops: 0,
    next: Infinity,
    rises: [],
    squashes: [],
    gold: [],
    gilds: [],
  };

/** A whole number from the seed in [lo, hi]. */
const rollIn = (seed: number, range: readonly [number, number], ...parts: (string | number)[]): number => range[0] + Math.floor(powerRoll(seed, ...parts) * (range[1] - range[0] + 1));

// ---------------- Rising Dough ----------------

/**
 * The kind of his `n`-th lump (`fen`: any position; `his`: his side): doughOdds over the kinds he can have now (landRefused:
 * never a ninth pawn, never more pieces than promotions could make), from the seed. Null: none he can have.
 */
export function doughKind(fen: string, his: Side, seed: number, n: number, s: Pick<BossPowerSettings, "doughOdds" | "doughLeadMax"> = BOSS_POWERS): DoughPiece | null {
  // (Never one that would put him more than doughLeadMax pawns ahead of you on material.)
  const room = materialOf(fen, other(his)) + s.doughLeadMax - materialOf(fen, his);
  const open = DOUGH_PIECES.filter((k) => s.doughOdds[k] > 0 && VALUE[k]! <= room && !landRefused(fen, k, his));
  const total = open.reduce((t, k) => t + s.doughOdds[k], 0);
  if (!total) return null;
  let x = powerRoll(seed, "doughKind", n) * total;
  for (const k of open) {
    x -= s.doughOdds[k];
    if (x < 0) return k;
  }
  return open[open.length - 1]!;
}

/** How far a square is from his back rank (0 on it, 7 on yours). */
const fromHome = (sq: string, his: Side): number => (his === "w" ? Number(sq[1]) - 1 : 8 - Number(sq[1]));

/** A pawn of the crowd's stands on this square's file below it (between the square and the crowd's side). */
function crowdPawnBelow(fen: string, sq: string, crowd: Side): boolean {
  const r = Number(sq[1]);
  for (let k = 1; k <= 8; k++) {
    if ((crowd === "w" && k >= r) || (crowd === "b" && k <= r)) continue;
    const pc = pieceAt(fen, `${sq[0]}${k}`);
    if (pc?.type === "p" && pc.color === crowd) return true;
  }
  return false;
}

/**
 * Where his `n`-th lump of `piece` goes (`fen`: the crowd to move, after his move; `lumps`: the dough on the board): an empty
 * square of his half that isn't his back rank, the en passant square or a lump's, and that none of the crowd's moves reaches now;
 * a pawn, knight or bishop on the two ranks of his half nearest the middle; a rook or queen on the two behind them, on a file
 * where a pawn of the crowd's stands below it. The first of a seeded order, or null: none fits.
 */
export function doughSquare(fen: string, piece: DoughPiece, seed: number, n: number, lumps: readonly Pick<DoughLump, "square">[] = [], s: Pick<BossPowerSettings, "doughReach"> = BOSS_POWERS): string | null {
  const crowd = sideToMove(fen);
  const his = other(crowd);
  const ep = fen.split(" ")[3];
  const reach = new Set(s.doughReach === "out" ? legalMoves(fen).map(to) : []);
  const deep = piece === "r" || piece === "q";
  const out: { sq: string; k: number }[] = [];
  for (const f of "abcdefgh") {
    for (let r = 1; r <= 8; r++) {
      const sq = `${f}${r}`;
      const home = fromHome(sq, his);
      if (home < 1 || home > 3 || (deep ? home > 2 : home < 2)) continue;
      if (pieceAt(fen, sq) || sq === ep || reach.has(sq) || lumps.some((l) => l.square === sq)) continue;
      if (deep && !crowdPawnBelow(fen, sq, crowd)) continue;
      out.push({ sq, k: powerRoll(seed, "doughSquare", n, sq) });
    }
  }
  out.sort((a, b) => a.k - b.k);
  return out[0]?.sq ?? null;
}

/**
 * His piece risen on a lump's square, if the guards allow it (`fen`: whoever is to move): the square empty, no pawn on a first or
 * last rank, a piece he can have (landRefused), the en passant square kept only while a capture there is legal, and the
 * position after one the engine plays with neither king in check, a move for the side to move and no mate in one for either
 * side (hoopsGuard, with no walls). The position after, or null: it waits.
 */
export function riseCheck(fen: string, piece: DoughPiece, square: string, his: Side): string | null {
  try {
    if (pieceAt(fen, square)) return null;
    if (piece === "p" && (square[1] === "1" || square[1] === "8")) return null;
    if (landRefused(fen, piece, his)) return null;
    const after = tidyEnPassant(withPiece(fen, square, { color: his, type: piece }));
    return hoopsGuard(after, []) ? after : null;
  } catch {
    return null;
  }
}

/** The squares of the dough on the board. */
export const doughSquares = (p: Pick<BossPowerState, "zebra"> | null | undefined): string[] => (p?.zebra?.lumps ?? []).map((l) => l.square);

/** His `n`-th drop is due at the end of his turn after crowd move `at`. */
export function dropDue(z: ZebraState, at: number, s: Pick<BossPowerSettings, "doughDrops" | "doughLast" | "doughLive"> = BOSS_POWERS): boolean {
  return z.drops < s.doughDrops && at >= z.next && at <= s.doughLast && z.lumps.length < s.doughLive;
}

// ---------------- Gold Plate ----------------

/** A move that's a pawn's capture of a gold piece (`fen`: before it; `gold`: the gold pieces' squares). */
export const pawnOnGold = (fen: string, move: string, gold: readonly string[]): boolean => gold.includes(to(move)) && pieceAt(fen, from(move))?.type === "p";

/**
 * The piece Gold Plate gilds (`fen`: any position; `his`: his side; `gold`: his gold pieces' squares): his queen, else his
 * strongest piece that isn't gold (a rook, then a bishop or knight), never a king or pawn; ties by the seed and the cast's
 * number. Null: none.
 */
export function gildPick(fen: string, his: Side, gold: readonly string[], seed: number, n: number): { square: string; piece: DoughPiece } | null {
  const out: { square: string; piece: DoughPiece; k: number }[] = [];
  for (const f of "abcdefgh") {
    for (let r = 1; r <= 8; r++) {
      const sq = `${f}${r}`;
      const pc = pieceAt(fen, sq);
      if (!pc || pc.color !== his || pc.type === "k" || pc.type === "p" || gold.includes(sq)) continue;
      out.push({
        square: sq,
        piece: pc.type,
        k: -VALUE[pc.type]! + powerRoll(seed, "gild", n, sq) * 0.5,
      });
    }
  }
  out.sort((a, b) => a.k - b.k);
  return out[0] ? { square: out[0].square, piece: out[0].piece } : null;
}

/** The gold pieces' squares after `move` (`fen`: before it): a gold piece moving takes its gold along; one taken loses it. */
export function goldAfter(fen: string, move: string, gold: readonly string[]): string[] {
  if (!gold.length) return [...gold];
  const a = from(move);
  const b = to(move);
  let out = gold.filter((sq) => sq !== b);
  if (gold.includes(a)) out = out.map((sq) => (sq === a ? b : sq));
  // (Castling: the king's two steps bring the rook from its corner to the square he crossed.)
  if (pieceAt(fen, a)?.type === "k" && a[1] === b[1] && Math.abs(b.charCodeAt(0) - a.charCodeAt(0)) === 2) {
    const kingSide = b > a;
    const corner = `${kingSide ? "h" : "a"}${a[1]}`;
    const crossed = `${kingSide ? "f" : "d"}${a[1]}`;
    out = out.map((sq) => (sq === corner ? crossed : sq));
  }
  return out;
}

// ---------------- His rules ----------------

/** How many Gold Plates a battle he has at most (BOSS_POWERS.maxUltimates.zebra; none set: no cap). */
const goldMax = (s: Pick<BossPowerSettings, "maxUltimates"> = BOSS_POWERS): number => s.maxUltimates?.["zebra"] ?? Infinity;

/** His last moves' marks for the screens, as the crowd's turn after his turn's end begins (`side` "boss", after crowd move turn - 1). */
const hisMarks = (marks: readonly DoughMark[], turn: number): DoughMark[] => marks.filter((m) => m.side === "boss" && m.at + 1 === turn);

export const ZEBRA: BossRules = {
  id: "zebra",
  // Gold Plate: the meter full as a turn begins (with a piece to gild), its warning that turn; at the start of his turn after it,
  // as the crowd's move lands (afterCrowdMove). The trigger (`ultNext`, kept): at the start of his next turn, without the warning.
  ultimateOnHisTurn: true,
  get ultimateMax() {
    return goldMax();
  },
  // (After his last, the meter stays on the bar, empty and dimmed: nothing hidden.)
  spentMeterShown: true,
  ultimate(next, t) {
    if (next.warnAt !== undefined || t.ultNext || (next.ults ?? 0) >= goldMax(t.s)) return false;
    if ((meterFull(next, t) || testSwitch(t, next)) && gildPick(t.fen, other(t.crowd), zebraOf(next).gold, t.seed, next.ults ?? 0)) {
      next.warnAt = t.turn;
      t.events.push({ kind: "warn", turn: t.turn });
    }
    return false;
  },
  // (The gilding is the start of his turn: over as the crowd's next turn begins. After his last, for the rest of the battle.)
  ultimateRunning: (p, turn, s) => (p.ults ?? 0) >= goldMax(s) || turn <= (p.ultAt ?? 0),
  // As the crowd's turn after his turn's end begins: what his turn's end did (a rise, a squash his only move made, a drop), his
  // opening comment; and whether a pawn of the crowd's could take a gold piece this turn (fair play skips it).
  everyTurn(next, t) {
    const z = next.zebra;
    if (!z) return;
    for (const m of hisMarks(z.rises, t.turn))
      t.events.push({
        kind: "doughRise",
        turn: t.turn,
        square: m.square,
        shape: m.piece,
      });
    for (const m of hisMarks(z.squashes, t.turn))
      t.events.push({
        kind: "doughSquash",
        turn: t.turn,
        square: m.square,
        shape: m.piece,
      });
    if (z.drop && z.drop.at + 1 === t.turn)
      t.events.push({
        kind: "doughDrop",
        turn: t.turn,
        square: z.drop.square,
        shape: z.drop.piece,
      });
    if (z.talk && z.talk.at + 1 === t.turn)
      t.events.push({
        kind: "openingTalk",
        turn: t.turn,
        pick: z.talk.pick,
        ...(z.talk.name ? { opening: z.talk.name } : {}),
      });
    const pawnCan = z.gold.length > 0 && legalMoves(t.fen).some((m) => pawnOnGold(t.fen, m, z.gold));
    if (pawnCan) next.zebra = { ...z, goldTurn: t.turn };
  },
  // (His dough comes at his turns' ends and rises by the moves: afterCrowdMove, afterBossMove.)
  passive() {},
  // Gold Plate: the crowd's pawns can't take a gold piece (lifted for a turn it would leave no move: the dispatcher).
  crowdFilter(allowed, boss, fen) {
    const gold = boss.powers?.zebra?.gold ?? [];
    return gold.length ? allowed.filter((m) => !pawnOnGold(fen, m, gold)) : allowed;
  },
  // His pieces never move onto his dough (lifted if it's his only move).
  bossStops(boss) {
    const lumps = doughSquares(boss.powers);
    return lumps.length ? (m) => lumps.includes(to(m)) : null;
  },
  stopReason: (boss, fen, m) => zebraStop(boss.powers?.zebra ?? null, fen, m),
  // The turn a piece rose (the board changed outside a move) and a turn a pawn could have taken a gold piece don't count for
  // fair play.
  powerTurn: (boss) => {
    const z = boss.powers?.zebra;
    if (!z) return false;
    return z.rises.some((r) => r.at === boss.crowdMoves) || z.goldTurn === turnOf(boss);
  },
  opening: {
    setUp(b, at) {
      const test = b.settings.bossPowerTest === "dough";
      if (test) b.boards.set(at.boardId, newBoard(at.boardId, { ...BOSS_OPENING, moves: [...BALLOON_TEST_MOVES] }, BALLOON_TEST_MOVES.length, at.generation));
      const s = BOSS_POWERS;
      return {
        zebra: {
          lumps: [],
          drops: 0,
          next: test ? 0 : rollIn(at.seed, s.doughFirst, "doughFirst"),
          rises: [],
          squashes: [],
          gold: [],
          gilds: [],
          his: other(at.crowdSide),
        } as ZebraState,
      };
    },
  },
  afterCrowdMove(b, move) {
    zebraBattle.afterCrowdMove(b, move);
  },
  afterBossMove(b, move) {
    zebraBattle.afterHisMove(b, move);
  },
  view: (p) => ({ zebra: zebraView(p) }),
};

/**
 * Which of his powers stops `move` now, either side (the screens' words): a pawn's capture of a gold piece ("gold"), his move
 * onto his dough ("dough"). Reads only what the screens' view carries too (StopFields' `zebra`).
 */
export function zebraStop(z: NonNullable<StopFields["zebra"]> | null, fen: string, move: string): "gold" | "dough" | null {
  if (!z) return null;
  if (pawnOnGold(fen, move, z.gold)) return "gold";
  const pc = pieceAt(fen, from(move));
  if (z.his && pc?.color === z.his && z.lumps.some((l) => l.square === to(move))) return "dough";
  return null;
}

/** His fields for the screens (NetBossPowers' `zebra`). */
export interface ZebraView {
  his?: Side;
  lumps: DoughLump[];
  drops: number;
  max: number;
  drop: DoughMark | null;
  /** The newest rise and squash (the screens play each once). */
  rise: DoughMark | null;
  squash: DoughMark | null;
  rises: number;
  squashes: number;
  gold: string[];
  gild: ZebraState["gilds"][number] | null;
  talk: ZebraState["talk"] | null;
}

export function zebraView(p: BossPowerState): ZebraView | null {
  const z = p.zebra;
  if (!z) return null;
  return {
    ...(z.his ? { his: z.his } : {}),
    lumps: z.lumps.map((l) => ({ ...l })),
    drops: z.drops,
    max: BOSS_POWERS.doughDrops,
    drop: z.drop ?? null,
    rise: z.rises.at(-1) ?? null,
    squash: z.squashes.at(-1) ?? null,
    rises: z.rises.length,
    squashes: z.squashes.length,
    gold: [...z.gold],
    gild: z.gilds.at(-1) ?? null,
    talk: z.talk ?? null,
  };
}

// ---------------- His part in the match runner ----------------

const boardOf = (b: Battle) => b.boards.get(b.state.boards[0]!)!;

/** The board changed outside a move (a piece risen): the new position, a base at its ply. */
function setBoard(b: Battle, fen: string): void {
  const id = b.state.boards[0]!;
  const board = boardOf(b);
  const ply = board.history.length;
  b.boards.set(id, {
    ...board,
    fen,
    bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen }],
  });
}

const setZebra = (b: Battle, z: ZebraState, extra: Partial<BossPowerState> = {}): void => {
  const boss = b.state.boss!;
  b.state = {
    ...b.state,
    boss: { ...boss, powers: { ...boss.powers!, ...extra, zebra: z } },
  };
};

/**
 * One move's worth of the dough (after `move`, by `side`; `before`: the position before it): a lump it landed on is squashed,
 * every timer loses a minute, and each lump at 00:00 rises if the guards allow (in the order they were dropped). Returns the
 * new state and what happened.
 */
function doughAfterMove(b: Battle, z: ZebraState, move: string | null, side: "crowd" | "boss", at: number): { z: ZebraState; squashed: DoughMark[]; risen: DoughMark[] } {
  const his = z.his ?? other(b.state.boss!.crowdSide);
  const mark = (l: DoughLump): DoughMark => ({
    at,
    side,
    n: l.n,
    piece: l.piece,
    square: l.square,
  });
  const squashed = move ? z.lumps.filter((l) => l.square === to(move)).map(mark) : [];
  let lumps = z.lumps.filter((l) => !squashed.some((m) => m.n === l.n)).map((l) => ({ ...l, left: Math.max(0, l.left - 1) }));
  const risen: DoughMark[] = [];
  let fen = boardOf(b).fen;
  // (Not once the game is over on the board.)
  if (!positionOver(fen)) {
    for (const l of [...lumps].sort((x, y) => x.n - y.n)) {
      if (l.left > 0) continue;
      const after = riseCheck(fen, l.piece, l.square, his);
      if (!after) continue;
      fen = after;
      setBoard(b, fen);
      risen.push(mark(l));
      lumps = lumps.filter((x) => x.n !== l.n);
    }
  }
  return {
    z: {
      ...z,
      lumps,
      rises: [...z.rises, ...risen],
      squashes: [...z.squashes, ...squashed],
    },
    squashed,
    risen,
  };
}

export const zebraBattle = {
  /** Gold Plate is due at the start of his turn now: warned as the crowd's last turn began (it has moved since), or the trigger. */
  goldDue(p: BossPowerState, crowdMoves: number): boolean {
    if (p.ultAt !== undefined) return false;
    return !!p.ultNext || (p.warnAt !== undefined && p.warnAt <= crowdMoves);
  },

  /**
   * After the crowd's move (him to move): a gold piece it took loses its gold; a lump it landed on is squashed; the timers lose
   * a minute and a lump at 00:00 rises; then Gold Plate, if it's due (the meter spent; his move waits for its moment). Each is
   * one of this turn's events, as it happens. Returns what happened, for the tests and the sims.
   */
  afterCrowdMove(
    b: Battle,
    move: string | null,
  ): {
    squashed: DoughMark[];
    risen: DoughMark[];
    gild: ZebraState["gilds"][number] | null;
  } | null {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p?.zebra || boss.id !== "zebra") return null;
    const at = boss.crowdMoves;
    let z: ZebraState = p.zebra;
    if (move && z.gold.includes(to(move))) z = { ...z, gold: z.gold.filter((sq) => sq !== to(move)) };
    const { z: z1, squashed, risen } = doughAfterMove(b, z, move, "crowd", at);
    z = z1;
    const events: PowerEvent[] = [...p.events];
    // (Marked `by` the crowd: they come at the start of his turn, after the turn's own moments, and his move waits for them.)
    for (const m of squashed) events.push({ kind: "doughSquash", turn: p.turn, square: m.square, shape: m.piece, by: "crowd" });
    for (const m of risen) events.push({ kind: "doughRise", turn: p.turn, square: m.square, shape: m.piece, by: "crowd" });
    let next: BossPowerState = { ...b.state.boss!.powers!, events };
    let gild: ZebraState["gilds"][number] | null = null;
    // (Not once the battle is over: a result, a mate or stalemate, the move cap.)
    const fen = boardOf(b).fen;
    if (zebraBattle.goldDue(next, at) && !boss.result && b.bossToMove() && !positionOver(fen) && at < b.settings.bossMaxMoves) {
      const pick = gildPick(fen, other(boss.crowdSide), z.gold, next.seed, z.gilds.length);
      gild = { at, square: pick?.square ?? null, piece: pick?.piece ?? null };
      z = {
        ...z,
        gold: pick ? [...z.gold, pick.square] : z.gold,
        gilds: [...z.gilds, gild],
      };
      const { ultNext: _trigger, ...rest } = next;
      next = unleashed({
        ...rest,
        ultAt: at,
        events: [
          ...events,
          {
            kind: "goldPlate",
            turn: p.turn,
            ...(pick ? { square: pick.square, shape: pick.piece } : {}),
          },
        ],
      });
    }
    setZebra(b, z, next);
    return { squashed, risen, gild };
  },

  /**
   * After his move (the crowd to move): his gold pieces follow it; a lump it landed on (his only move) is squashed; the timers
   * lose a minute and a lump at 00:00 rises; then a drop when one is due; then his opening comment once the game is at move 4
   * (on the crowd's second turn at the earliest). All shown as the crowd's next turn begins (everyTurn). Not once the battle is
   * over on the board.
   */
  afterHisMove(
    b: Battle,
    move: string,
    s: DoughSettings = BOSS_POWERS,
  ): {
    squashed: DoughMark[];
    risen: DoughMark[];
    drop: DoughMark | null;
  } | null {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p?.zebra || boss.id !== "zebra" || boss.result) return null;
    const at = boss.crowdMoves;
    const board = boardOf(b);
    // (The position before his move: the board's newest move is his.)
    const fenBefore = board.history.length ? fenAtPly(board.history, board.history.length - 1, board.bases) : null;
    let z: ZebraState = {
      ...p.zebra,
      gold: fenBefore ? goldAfter(fenBefore, move, p.zebra.gold) : p.zebra.gold,
    };
    const { z: z1, squashed, risen } = doughAfterMove(b, z, move, "boss", at);
    z = z1;
    let drop: DoughMark | null = null;
    const fen = boardOf(b).fen;
    const over = sideToMove(fen) !== boss.crowdSide || !legalMoves(fen).length;
    if (!over && dropDue(z, at, s)) {
      const his = other(boss.crowdSide);
      const n = z.drops;
      // (The test switch: his first lump a pawn's.)
      const piece = b.settings.bossPowerTest === "dough" && n === 0 && !landRefused(fen, "p", his) ? "p" : doughKind(fen, his, p.seed, n, s);
      const square = piece ? doughSquare(fen, piece, p.seed, n, z.lumps, s) : null;
      if (piece && square) {
        // (Its timer's place: the lowest one free.)
        let slot = 0;
        while (z.lumps.some((l) => l.slot === slot)) slot++;
        const lump: DoughLump = { n, slot, piece, square, left: s.doughTimers[piece], at };
        drop = { at, side: "boss", n, piece, square };
        z = {
          ...z,
          lumps: [...z.lumps, lump],
          drops: n + 1,
          next: at + rollIn(p.seed, s.doughGap, "doughGap", n),
          drop,
        };
      }
    }
    if (!over && !z.talk && at + 1 >= 2 && moveNumber(fen) >= 4) {
      const hist = boardOf(b);
      const firstBase = (hist.bases ?? []).reduce((lo, x) => Math.min(lo, x.ply), Infinity);
      const moves = hist.history.slice(0, Number.isFinite(firstBase) ? firstBase : hist.history.length);
      const name = b.library ? openingNameFor(moves, b.library) : null;
      z = {
        ...z,
        talk: { at, name, pick: Math.floor(powerRoll(p.seed, "talk") * 4096) },
      };
    }
    setZebra(b, z);
    return { squashed, risen, drop };
  },
};

/** His events for a turn (the sims and tests read them). */
export const zebraEvents = (events: readonly PowerEvent[]) =>
  events.filter((e) => e.kind === "doughDrop" || e.kind === "doughRise" || e.kind === "doughSquash" || e.kind === "goldPlate" || e.kind === "openingTalk");
