/**
 * Sawyer, the raccoon with a saw (BOSS_ROSTER "sawyer"): his rules. He opens with the split pawn: his first move is
 * always a pawn move, and then he saws that pawn in two, a second pawn of his landing on an empty square beside it (the
 * two halves are tracked through the game). The engine plays no position with a ninth pawn a side or a 33rd piece, so
 * while he has all 8 (or the board 32 pieces) the split waits, and comes after his first pawn move once there's room;
 * if the pawn he moved has no square to split into, another pawn of his that has one is sawn (chooseSplit). His
 * passive, saw cuts: every few turns he saws one edge between two neighbouring squares in the crowd's half, and
 * nothing (either side) may move straight across it while it's there
 * (diagonal moves pass at the corners, knights jump it). His ultimate, the board saw: with the rage meter full, from
 * turn boardSawFrom, and one half of the board more his than the crowd's on material, the warning, then the board is
 * sawn in two between the d and e files: for a few turns no move may cross between the halves, knights included.
 *
 * Both kinds of cut block movement, never attacks (checks and pins work across them as in ordinary chess), and like
 * every power they never leave anyone without a move or block the only way out of check (the dispatcher lifts them
 * for the turn). Numbers: BOSS_POWERS.saw*, boardSaw*. His art and moments are the app's (characters/sawyer.ts,
 * components/Sawyer.tsx, the cuts in characters/effects/sawyer.ts).
 */
import { BOSS_POWERS, type BossPowerState, type BossState, type SawCut, type SplitPawn } from "@chessroyale/core";
import { legalMoves, pieceAt, withPiece } from "../rules.ts";
import { VALUE, crowdHalf, from, meterFull, other, powerRoll, testSwitch, to, turnOf, type Battle, type BossRules, type Side, type TurnContext } from "./base.ts";

/**
 * The split, beat by beat (ms into its moment, after his first move shows; nobody's clock runs):
 *   0         "SPLIT PAWN!" (his banner).
 *   hopAt     he leaps from his corner onto the pawn (`landAt`: his saw's tip over it).
 *   sawAt     he saws (his `sawDown`, its `cut` cue at `cutAt`), the blade buzzing in the pawn.
 *   crackAt   the pawn cracks in two (a wood crack): the halves come apart, one onto the square beside it,
 *             settled by `settledAt` (the board shows both as halves from then).
 *   backAt    he hops back to his corner (gone from the board by `total`).
 */
export const SPLIT = { hopAt: 1100, landAt: 1600, sawAt: 1650, cutAt: 1970, crackAt: 2450, settledAt: 2950, backAt: 3050, total: 3600 } as const;

/** A saw cut: the banner, his `sawDown` at the board's corner, its `cut` cue as the groove opens along the edge (`openMs`). */
export const SAW_CUT = { cutAt: 1500, openMs: 380, ms: 2300 } as const;

/**
 * The board saw, beat by beat (ms into its moment, as the crowd's turn begins):
 *   0         "BOARD SAW!" (his banner).
 *   jumpAt    he jumps from his corner onto the board's bottom edge, between the d and e files (`landAt`).
 *   revAt     he revs (his `rev`).
 *   runAt     he saws his way up between the d and e files, bottom to top, for `runMs`: the groove opens behind him.
 *   splitAt   at the top the board splits: the halves part with a jolt (`jolt` ms), leaving the gap.
 *   offAt     he hops back to his corner (gone by `total`).
 */
export const BOARD_SAW = { jumpAt: 1400, landAt: 1900, revAt: 1950, runAt: 3150, runMs: 1700, splitAt: 4850, jolt: 280, offAt: 5050, total: 5700 } as const;

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const SAWYER_FX = { split: SPLIT.total, cut: SAW_CUT.ms, boardsaw: BOARD_SAW.total } as const;

const file = (sq: string) => sq.charCodeAt(0) - 97;
const rank = (sq: string) => Number(sq[1]);
const square = (f: number, r: number) => `${"abcdefgh"[f]}${r}`;

// ---------------- The split pawn ----------------

/** Sawyer's first move is still to come: it must be a pawn move. */
export const firstMoveDue = (p: Pick<BossPowerState, "split"> | null | undefined): boolean => !!p && !p.split;

/**
 * There's room on the board for another pawn of `side`'s: fewer than 8 of them, and fewer than 32 pieces in all. The
 * engine (Stockfish, for his moves, the judge, the eval bar and the bots) refuses any position with a ninth pawn a side
 * or a 33rd piece, so the split waits for room (DECISIONS.md, "Sawyer, built").
 */
export function splitRoom(fen: string, side: Side): boolean {
  const board = fen.split(" ")[0]!;
  const pawn = side === "w" ? "P" : "p";
  let pawns = 0;
  let pieces = 0;
  for (const c of board) {
    if (c === pawn) pawns++;
    if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z")) pieces++;
  }
  return pawns < 8 && pieces < 32;
}

/**
 * Where the second half of Sawyer's split pawn lands, beside the pawn he moved (on `pawn` in `fen`, the crowd to
 * move): an empty square on its rank, left or right from the seed; only one free, that one; neither, null (no split).
 * My calls: never a square where the new pawn gives check or leaves the crowd without a move (the split never decides
 * a game by itself, like the cuts), and never one where it attacks one of the crowd's pieces (a knight, bishop, rook or
 * queen: it would fork or win a piece at once, far more than a pawn's head start; Big Boy's bounce keeps a like rule).
 */
export function splitSquare(fen: string, pawn: string, crowd: Side, seed: number): string | null {
  const boss = other(crowd);
  const f = file(pawn);
  const r = rank(pawn);
  const king = (() => {
    for (let ff = 0; ff < 8; ff++) for (let rr = 1; rr <= 8; rr++) {
      const pc = pieceAt(fen, square(ff, rr));
      if (pc?.type === "k" && pc.color === crowd) return square(ff, rr);
    }
    return null;
  })();
  const options = [f - 1, f + 1]
    .filter((ff) => ff >= 0 && ff < 8)
    .map((ff) => square(ff, r))
    .filter((sq) => !pieceAt(fen, sq))
    .filter((sq) => {
      // (A pawn of his attacks the two squares diagonally ahead of it: never the crowd's king or one of its pieces.)
      const ahead = rank(sq) + (boss === "w" ? 1 : -1);
      if (king && rank(king) === ahead && Math.abs(file(king) - file(sq)) === 1) return false;
      for (const ff of [file(sq) - 1, file(sq) + 1]) {
        const hit = ff >= 0 && ff < 8 && ahead >= 1 && ahead <= 8 ? pieceAt(fen, square(ff, ahead)) : null;
        if (hit && hit.color === crowd && hit.type !== "p") return false;
      }
      try {
        const after = withPiece(fen, sq, { color: boss, type: "p" });
        return legalMoves(after).length > 0;
      } catch {
        return false;
      }
    });
  if (options.length < 2) return options[0] ?? null;
  return options[powerRoll(seed, "split") < 0.5 ? 0 : 1]!;
}

/**
 * Which pawn of his the split saws, and where its new half lands (Eric, Oct 10: "he picks a pawn which has a space
 * available next to it and splits it"): the pawn he just moved (`moved`) when a square beside it will do
 * (splitSquare); otherwise another of his pawns that has one, the most central first (the d and e files, then c and
 * f…), from the seed among those as central. None: null (the split waits for his next pawn move).
 */
export function chooseSplit(fen: string, moved: string | null, crowd: Side, seed: number, turn: number): { pawn: string; square: string } | null {
  if (moved) {
    const half = splitSquare(fen, moved, crowd, seed);
    if (half) return { pawn: moved, square: half };
  }
  const mine = other(crowd);
  const options: { pawn: string; square: string }[] = [];
  for (let f = 0; f < 8; f++)
    for (let r = 2; r <= 7; r++) {
      const sq = square(f, r);
      if (sq === moved) continue;
      const pc = pieceAt(fen, sq);
      if (pc?.type !== "p" || pc.color !== mine) continue;
      const half = splitSquare(fen, sq, crowd, seed);
      if (half) options.push({ pawn: sq, square: half });
    }
  if (!options.length) return null;
  const off = (sq: string) => Math.abs(file(sq) - 3.5);
  const most = Math.min(...options.map((o) => off(o.pawn)));
  const central = options.filter((o) => off(o.pawn) === most).sort((a, b) => (a.pawn < b.pawn ? -1 : 1));
  return central[Math.floor(powerRoll(seed, "split-pawn", turn) * central.length)]!;
}

/**
 * The split's two halves through a move (`fen`: the position after it): the half that moved goes with it; one that's
 * taken (en passant too) or promotes (a whole piece now) is gone. Pure, so every device tracks them alike.
 */
export function trackHalves(halves: SplitPawn["halves"], move: string, fen: string, boss: Side): SplitPawn["halves"] {
  const f = from(move);
  const t = to(move);
  return halves.flatMap((h) => {
    let sq = h.square;
    if (sq === f) {
      if (move.length > 4) return [];
      sq = t;
    }
    const pc = pieceAt(fen, sq);
    return pc?.type === "p" && pc.color === boss ? [{ square: sq, side: h.side }] : [];
  });
}

/** The split's two halves now (their squares and sides), if any. */
export const halfPawns = (boss: Pick<BossState, "powers"> | null | undefined): SplitPawn["halves"] => boss?.powers?.split?.halves ?? [];

// ---------------- The cuts ----------------

/** An edge between two orthogonally neighbouring squares, in order (the lower file first, or the lower rank on one file). */
export function edgeOf(s1: string, s2: string): { a: string; b: string } {
  return file(s1) < file(s2) || (file(s1) === file(s2) && rank(s1) < rank(s2)) ? { a: s1, b: s2 } : { a: s2, b: s1 };
}

/**
 * The edges a move crosses straight on its way: every edge between the squares of a slide along a rank or file (a
 * rook, a queen, a king's step, a pawn's push or double step), and a castling king's way on to his rook's corner (the
 * king's path and the rook's, as Big Boy's toy block counts it; `fen` says it's a king). A diagonal move passes at the
 * corners and a knight jumps: neither crosses an edge.
 */
export function moveEdges(move: string, fen?: string): { a: string; b: string }[] {
  const a = from(move);
  const b = to(move);
  const df = file(b) - file(a);
  const dr = rank(b) - rank(a);
  if (df !== 0 && dr !== 0) return [];
  let end = b;
  if (fen && dr === 0 && Math.abs(df) === 2 && pieceAt(fen, a)?.type === "k") end = square(df > 0 ? 7 : 0, rank(a));
  const n = Math.max(Math.abs(file(end) - file(a)), Math.abs(rank(end) - rank(a)));
  const sf = Math.sign(file(end) - file(a));
  const sr = Math.sign(rank(end) - rank(a));
  const out: { a: string; b: string }[] = [];
  for (let k = 0; k < n; k++) out.push(edgeOf(square(file(a) + sf * k, rank(a) + sr * k), square(file(a) + sf * (k + 1), rank(a) + sr * (k + 1))));
  return out;
}

/** A saw cut stops a move: it crosses the cut's edge straight (moveEdges). It never stops an attack. */
export const crossesCut = (move: string, cut: Pick<SawCut, "a" | "b"> | null | undefined, fen?: string): boolean =>
  !!cut && moveEdges(move, fen).some((e) => e.a === cut.a && e.b === cut.b);

/** A move crosses between the board's halves (files a-d and e-h): any move, knights included, castling's king too. */
export const crossesMiddle = (move: string): boolean => file(from(move)) <= 3 !== file(to(move)) <= 3;

/**
 * Where Sawyer saws a cut: an edge between two squares of the crowd's half that one of its legal moves crosses now (so
 * it matters a little), a seeded pick. Null when there's none.
 */
export function chooseCut(fen: string, crowd: Side, seed: number, turn: number): { a: string; b: string } | null {
  const half = new Set(crowdHalf(crowd));
  let legal: string[];
  try {
    legal = legalMoves(fen);
  } catch {
    return null;
  }
  const keys = new Set<string>();
  for (const m of legal) for (const e of moveEdges(m, fen)) if (half.has(e.a) && half.has(e.b)) keys.add(`${e.a}-${e.b}`);
  const options = [...keys].sort();
  if (!options.length) return null;
  const [a, b] = options[Math.floor(powerRoll(seed, "cut", turn) * options.length)]!.split("-") as [string, string];
  return { a, b };
}

/** The saw cut on the board now, if any. */
export const sawCut = (boss: Pick<BossState, "powers"> | null | undefined): SawCut | null => boss?.powers?.cut ?? null;

// ---------------- The board saw ----------------

/** The board is sawn in two now (no move may cross between the d and e files). */
export const boardSawn = (boss: Pick<BossState, "powers"> | null | undefined): boolean => !!boss?.powers?.boardSaw;

/**
 * The half of the board (files a-d, or e-h) that favours Sawyer on material (his pieces there worth more than the
 * crowd's: pawns 1, knights and bishops 3, rooks 5, queens 9), the one he leads by more; null when neither does.
 */
export function favouredHalf(fen: string, crowd: Side): "a-d" | "e-h" | null {
  const lead = [0, 0];
  fen
    .split(" ")[0]!
    .split("/")
    .forEach((row) => {
      let f = 0;
      for (const c of row) {
        if (c >= "1" && c <= "8") f += Number(c);
        else {
          const v = VALUE[c.toLowerCase()] ?? 0;
          const side: Side = c === c.toUpperCase() ? "w" : "b";
          lead[f <= 3 ? 0 : 1]! += side === crowd ? -v : v;
          f++;
        }
      }
    });
  if (lead[0]! <= 0 && lead[1]! <= 0) return null;
  return lead[0]! >= lead[1]! ? "a-d" : "e-h";
}

/** The board saw may be warned of now: the rage meter full, turn boardSawFrom or later, and a half of the board his. */
export const boardSawReady = (next: BossPowerState, t: TurnContext): boolean => meterFull(next, t) && t.turn >= t.s.boardSawFrom && favouredHalf(t.fen, t.crowd) !== null;

/** What stops a move under his cuts now (either side): the saw cut's edge, the board saw's line. */
export const sawStops = (p: Pick<BossPowerState, "cut" | "boardSaw">, move: string, fen: string): boolean => crossesCut(move, p.cut, fen) || (!!p.boardSaw && crossesMiddle(move));

/** Sawyer: the split pawn after his first move, a saw cut every few turns, and the board saw. */
export const SAWYER: BossRules = {
  id: "sawyer",
  wearOff(next, t) {
    if (next.cut && next.cut.until < t.turn) next.cut = null;
    if (next.boardSaw && next.boardSaw.until < t.turn) next.boardSaw = null;
  },
  // The board saw: the meter full, from turn boardSawFrom, a half of the board his: the warning ("RAGE!"), then the
  // next turn the saw (whatever the material by then: the warning promised it). The test switch: warned as the second
  // turn begins, whatever the board. The trigger: now, without the warning or the conditions.
  ultimate(next, t) {
    const unleash = () => {
      next.ultAt = t.turn;
      next.boardSaw = { at: t.turn, until: t.turn + t.s.boardSawTurns - 1 };
      t.events.push({ kind: "boardsaw", turn: t.turn });
      return true;
    };
    if (t.ultNext) return unleash();
    if (next.warnAt === undefined) {
      if (boardSawReady(next, t) || testSwitch(t)) {
        next.warnAt = t.turn;
        t.events.push({ kind: "warn", turn: t.turn });
      }
      return false;
    }
    return t.turn > next.warnAt ? unleash() : false;
  },
  // The split, as the turn after his first move begins (its moment plays after that move).
  everyTurn(next, t) {
    if (next.split?.square && next.split.turn === t.turn) t.events.push({ kind: "split", turn: t.turn, square: next.split.square, ...(next.split.pawn ? { squares: [next.split.pawn, next.split.square] } : {}) });
  },
  // A saw cut every sawEvery turns from sawFirst, sawTurns turns on the board.
  passive(next, t) {
    if (t.turn < next.nextPassive || next.cut) return;
    const edge = chooseCut(t.fen, t.crowd, t.seed, t.turn);
    if (edge) {
      next.cut = { ...edge, at: t.turn, until: t.turn + t.s.sawTurns - 1 };
      t.events.push({ kind: "cut", turn: t.turn, square: edge.a, squares: [edge.a, edge.b] });
      next.nextPassive = t.turn + t.s.sawEvery;
    } else next.nextPassive = t.turn + 1;
  },
  crowdFilter(allowed, boss, fen) {
    const p = boss.powers!;
    return p.cut || p.boardSaw ? allowed.filter((m) => !sawStops(p, m, fen)) : allowed;
  },
  // His own moves: his first is a pawn move (no pawn move: any, as the dispatcher lifts it); the cuts stop him too.
  bossStops(boss) {
    const p = boss.powers;
    if (!p) return null;
    const first = firstMoveDue(p);
    if (!first && !p.cut && !p.boardSaw) return null;
    return (m, fen) => (first && pieceAt(fen, from(m))?.type !== "p") || sawStops(p, m, fen);
  },
  powerTurn: (boss) => !!boss.powers!.cut || !!boss.powers!.boardSaw,
  // After his move: the first one splits its pawn (a base on the board: the position changes outside a move); after
  // any other, the halves follow.
  afterBossMove(b, move) {
    const boss = b.state.boss!;
    const p = boss.powers!;
    const id = b.state.boards[0]!;
    const board = b.boards.get(id)!;
    const mine = other(boss.crowdSide);
    const first = firstMoveDue(p);
    if (first || p.split?.waiting) {
      // His first move (always a pawn's), or (no room for another pawn of his then, or no pawn with a square to split
      // into) his next pawn move once there is: the pawn he moved if it can split, else another (chooseSplit).
      const sq = to(move);
      const pc = pieceAt(board.fen, sq);
      const moved = pc?.type === "p" && pc.color === mine ? sq : null;
      const pick = moved && splitRoom(board.fen, mine) ? chooseSplit(board.fen, moved, boss.crowdSide, p.seed, turnOf(boss)) : null;
      if (pick) {
        const { pawn, square: half } = pick;
        const fen = withPiece(board.fen, half, { color: mine, type: "p" });
        const ply = board.history.length;
        b.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen }] });
        const halves: SplitPawn["halves"] = file(half) < file(pawn) ? [{ square: half, side: "a" }, { square: pawn, side: "h" }] : [{ square: pawn, side: "a" }, { square: half, side: "h" }];
        b.state = { ...b.state, boss: { ...boss, powers: { ...p, split: { turn: turnOf(boss), pawn, square: half, halves } } } };
      } else if (first) {
        // (No split yet: it waits for his next pawn move with room and a pawn to split. His first move wasn't a pawn's
        // (he had none to move): no split.)
        const split: SplitPawn = { turn: turnOf(boss), pawn: moved, square: null, halves: [], ...(moved ? { waiting: true as const } : {}) };
        b.state = { ...b.state, boss: { ...boss, powers: { ...p, split } } };
      }
      return;
    }
    sawyerBattle.track(b, move);
  },
  afterCrowdMove(b, move) {
    if (move) sawyerBattle.track(b, move);
  },
  // From the game so far; his cuts start a turn later than the others' passives (the split has turn 2 to itself).
  opening: { setUp: () => ({ nextPassive: BOSS_POWERS.sawFirst }) },
  view: (p) => ({ split: p.split ?? null, cut: p.cut ? { ...p.cut } : null, boardSaw: p.boardSaw ? { ...p.boardSaw } : null }),
};

/** His part in the match runner. */
export const sawyerBattle = {
  /** The split's halves follow a move just played on the battle's board. */
  track(b: Battle, move: string): void {
    const boss = b.state.boss!;
    const p = boss.powers!;
    if (!p.split?.halves.length) return;
    const board = b.boards.get(b.state.boards[0]!)!;
    const halves = trackHalves(p.split.halves, move, board.fen, other(boss.crowdSide));
    if (halves.length === p.split.halves.length && halves.every((h, i) => h.square === p.split!.halves[i]!.square)) return;
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, split: { ...p.split, halves } } } };
  },
};
