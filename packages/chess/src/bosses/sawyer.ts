/**
 * Sawyer, the raccoon with a saw (BOSS_ROSTER "sawyer"): his rules. He opens with the split pawn: his first move is
 * always a pawn move, and then he saws that pawn in two, a second pawn of his landing on an empty square beside it (the
 * two halves are tracked through the game). The engine plays no position with a ninth pawn a side or a 33rd piece, so
 * while he has all 8 (or the board 32 pieces) the split waits, and comes after his first pawn move once there's room;
 * if the pawn he moved has no square to split into, another pawn of his that has one is sawn (chooseSplit). His
 * passive, saw cuts: every few turns he saws one edge between two neighboring squares in the crowd's half, and
 * nothing (either side) may move straight across it while it's there
 * (diagonal moves pass at the corners, knights jump it). His ultimate, the board saw: with the rage meter full, from
 * turn boardSawFrom, and one half of the board more his than the crowd's on material, the warning, then the board is
 * sawn in two between the d and e files: for a few turns no move may cross between the halves, knights included. His third
 * power, the Saw Swap (Eric, Nov 20), once a battle: at the start of his turn, in check with his king on his half, he saws the
 * board across the middle and his half down its center, and swaps its two 4 x 4 blocks out of check; then he moves.
 *
 * Both kinds of cut block movement, never attacks (checks and pins work across them as in ordinary chess), and like
 * every power they never leave anyone without a move or block the only way out of check (the dispatcher lifts them
 * for the turn). Numbers: BOSS_POWERS.saw*, boardSaw*. His art and moments are the app's (characters/sawyer.ts,
 * components/Sawyer.tsx, the cuts in characters/effects/sawyer.ts).
 */
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type BossState, type SawCut, type SplitPawn } from "@chessroyale/core";
import { BOSS_OPENING, boardEnd, newBoard } from "../boards.ts";
import { marksStop, moveEdges, type EdgeMark } from "../board-layer.ts";
import { applyMove, inCheck, kingAttacked, legalMoves, pieceAt, sideToMove, withPiece } from "../rules.ts";
import { stockfishRefuses } from "../uci.ts";
import { VALUE, crowdHalf, from, meterFull, other, powerRoll, testSwitch, to, turnOf, type Battle, type BossRules, type Side, type TurnContext } from "./base.ts";

/**
 * The split, beat by beat (ms into its moment, after his first move shows; nobody's clock runs):
 *   0         "SPLIT PAWN!" (his banner, to `bannerMs`).
 *   hopAt     he leaps from his corner onto the pawn (`landAt`: his saw's tip over it).
 *   sawAt     he saws (his `sawDown`, its `cut` cue at `cutAt`), the blade buzzing in the pawn.
 *   crackAt   the pawn cracks in two (a wood crack): the halves come apart, one onto the square beside it,
 *             settled by `settledAt` (the board shows both as halves from then).
 *   backAt    he hops back to his corner (gone from the board by `total`).
 */
export const SPLIT = { bannerMs: 1300, hopAt: 1100, landAt: 1600, sawAt: 1650, cutAt: 1970, crackAt: 2450, settledAt: 2950, backAt: 3050, total: 3600 } as const;

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

/**
 * The Saw Swap, beat by beat (ms into its moment, after its banner's hold; it plays while he thinks at the start of his turn, and his
 * move waits for it all: sawyerTurnMs in boss-timing.ts):
 *   0         "SAW SWAP!" (his banner, to `cutAt`).
 *   cutAt     he saws at the board's corner (his `sawDown`, its `cut` cue): a groove runs across the middle of the board, between
 *             his half and the crowd's, for `crossMs`;
 *   downAt    then down the middle of his half (between the d and e files), from the middle to his edge, for `downMs`.
 *   liftAt    the two 4 x 4 blocks of his half come loose (the grooves part, a crack); they slide past each other for `slideMs`,
 *             the block with his king lifted over the other;
 *   landAt    each lands on the other's place; the board draws the new position from here (the moment's blocks `overlap` more);
 *   closeAt   the grooves close (the board saw's rejoin), done by `total`. Then his move.
 */
export const SAW_SWAP = { bannerMs: 1300, cutAt: 1300, crossMs: 680, downAt: 1980, downMs: 420, liftAt: 2520, slideMs: 900, landAt: 3420, overlap: 60, closeAt: 3520, total: 4000 } as const;

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const SAWYER_FX = { split: SPLIT.total, cut: SAW_CUT.ms, boardsaw: BOARD_SAW.total, sawSwap: SAW_SWAP.total } as const;

const file = (sq: string) => sq.charCodeAt(0) - 97;
const rank = (sq: string) => Number(sq[1]);
const square = (f: number, r: number) => `${"abcdefgh"[f]}${r}`;

// ---------------- The split pawn ----------------

/**
 * The test switch (?power=split): the battle starts a few real moves in, one of his pawns taken by the crowd and the crowd
 * to move, so his first move (a pawn's) has room to split at once. The split otherwise waits for room and then for his
 * next pawn move, both up to his brain, and the e2e's game ran past its 20 moves now and then (main run 1199, Nov 10).
 * The crowd White: 1.e4 d5 2.exd5 Nf6; Black: 1.e4 d5 2.Nc3 dxe4 3.Nxe4.
 */
export const SPLIT_TEST_MOVES: Readonly<Record<Side, readonly string[]>> = {
  w: ["e2e4", "d7d5", "e4d5", "g8f6"],
  b: ["e2e4", "d7d5", "b1c3", "d5e4", "c3e4"],
};

/**
 * Sawyer's first move is still to come: it must be a pawn move. Never while his split is off this battle (noAdd: a tower floor of
 * several whose primary is another boss, BATTLE_TOWER.addsPieces): then nothing splits, and his first move is any.
 */
export const firstMoveDue = (p: Pick<BossPowerState, "split" | "noAdd"> | null | undefined): boolean => !!p && !p.split && !p.noAdd;

/**
 * There's room on the board for another pawn of `side`'s: fewer than 8 of them, fewer than 32 pieces in all, and no
 * more pieces than promotions could have made with one pawn fewer missing (beyond a queen, two rooks, two bishops and
 * two knights). The engine (Stockfish, for his moves, the judge, the eval bar and the bots) refuses any other position
 * (stockfishRefuses), so the split waits for room (DECISIONS.md, "Sawyer, built"; the promotions, Oct 15).
 */
export function splitRoom(fen: string, side: Side): boolean {
  const board = fen.split(" ")[0]!;
  const count = (c: string) => [...board].filter((x) => x === (side === "w" ? c.toUpperCase() : c)).length;
  const pawns = count("p");
  const pieces = [...board].filter((c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z")).length;
  const promoted = Math.max(0, count("q") - 1) + Math.max(0, count("r") - 2) + Math.max(0, count("b") - 2) + Math.max(0, count("n") - 2);
  return pawns < 8 && pieces < 32 && promoted <= 8 - (pawns + 1);
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

// (The edges' geometry, edgeOf and moveEdges, lives in the board layer: board-layer.ts.)

/**
 * His cuts on the board now, his part of the board layer (board-layer.ts), stopping both sides' moves: the board saw's line, the
 * eight edges between the d and e files (`across: "all"`: no move crosses between the halves, knights and castling's king
 * included), then the saw cut's edge (`"straight"`: no move crosses it straight; a diagonal passes at its corners, a knight
 * jumps it; castling's king and rook each count). In that order, so the screens name the board saw first. Never an attack.
 */
export function sawMarks(p: Partial<Pick<BossPowerState, "cut" | "boardSaw">> | null | undefined): EdgeMark[] {
  const marks: EdgeMark[] = [];
  if (p?.boardSaw) for (let r = 1; r <= 8; r++) marks.push({ a: `d${r}`, b: `e${r}`, across: "all", kind: "boardsaw", binds: "both", by: "sawyer" });
  if (p?.cut) marks.push({ a: p.cut.a, b: p.cut.b, across: "straight", kind: "cut", binds: "both", by: "sawyer" });
  return marks;
}

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
 * The half of the board (files a-d, or e-h) that favors Sawyer on material (his pieces there worth more than the
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

// ---------------- The Saw Swap ----------------

/** His half of the board: its lowest and highest rank (1-4 when he plays White, 5-8 when he plays Black). */
export const hisRanks = (boss: Side): readonly [number, number] => (boss === "w" ? [1, 4] : [5, 8]);

/** Where the piece on `sq` goes in the Saw Swap: on his half, 4 files over (a-d to e-h and back), its rank kept; elsewhere, nowhere. */
export function swapSquare(sq: string, boss: Side): string {
  const [lo, hi] = hisRanks(boss);
  const r = rank(sq);
  return r >= lo && r <= hi ? square((file(sq) + 4) % 8, r) : sq;
}

/**
 * The board's pieces with his half's two 4 x 4 blocks swapped (every piece in them, both colors, 4 files over, its rank kept): the
 * FEN's placement only. The same swap undoes it (the screens draw the position before it from the one after).
 */
export function swapPlacement(fen: string, boss: Side): string {
  const parts = fen.split(" ");
  const [lo, hi] = hisRanks(boss);
  parts[0] = parts[0]!
    .split("/")
    .map((row, i) => {
      const r = 8 - i;
      if (r < lo || r > hi) return row;
      const cells = row.replace(/\d/g, (n) => ".".repeat(Number(n)));
      return (cells.slice(4) + cells.slice(0, 4)).replace(/\.+/g, (d) => String(d.length));
    })
    .join("/");
  return parts.join(" ");
}

/** `side`'s king's square, or null. */
const kingOf = (fen: string, side: Side): string | null => {
  for (let f = 0; f < 8; f++) for (let r = 1; r <= 8; r++) if (pieceAt(fen, square(f, r))?.type === "k" && pieceAt(fen, square(f, r))?.color === side) return square(f, r);
  return null;
};

/**
 * The Saw Swap's position, when it may come now (`fen`: him to move), else null. It comes when he's in check with his king on his
 * half, and swapping his half's two blocks (swapPlacement) leaves a position the game can play on: him no longer in check, the
 * crowd's king not attacked, a legal move for him, and one the engine plays (stockfishRefuses: no pawn on the first or last rank,
 * which a swap that keeps every rank can't make anyway). His castling rights go (his king always moves, and his rooks with him: one
 * rule for every case; the crowd's king and rooks on their own back rank never move, so the crowd's stay), the en passant square goes,
 * and the fifty-move count starts again (as after a piece another power took off: withoutPiece). The side to move stays his.
 */
export function sawSwapFen(fen: string, boss: Side): string | null {
  if (sideToMove(fen) !== boss) return null;
  const king = kingOf(fen, boss);
  const [lo, hi] = hisRanks(boss);
  if (!king || rank(king) < lo || rank(king) > hi) return null;
  try {
    if (!inCheck(fen)) return null;
    const parts = swapPlacement(fen, boss).split(" ");
    const mine = (c: string) => (boss === "w" ? c >= "A" && c <= "Z" : c >= "a" && c <= "z");
    parts[2] = [...(parts[2] ?? "-")].filter((c) => c !== "-" && !mine(c)).join("") || "-";
    parts[3] = "-";
    if (parts[4] !== undefined) parts[4] = "0";
    const after = parts.join(" ");
    if (stockfishRefuses(after) || kingAttacked(after, other(boss)) || inCheck(after) || !legalMoves(after).length) return null;
    return after;
  } catch {
    return null;
  }
}

/**
 * The test switch (?power=sawswap): the battle starts a few real moves in, the crowd to move, and the crowd's natural next move (the
 * bishop's check, SAW_SWAP_TEST_CHECK) checks his king on his half where the swap takes him out of it: it fires as that move lands.
 * The crowd White: 1.e4 d5 2.exd5 Qxd5 3.Nc3 Qd8 (then Bb5+); Black: 1.d4 e6 2.c4 (then ...Bb4+).
 */
export const SAW_SWAP_TEST_MOVES: Readonly<Record<Side, readonly string[]>> = {
  w: ["e2e4", "d7d5", "e4d5", "d8d5", "b1c3", "d5d8"],
  b: ["d2d4", "e7e6", "c2c4"],
};
/** The crowd's check in the test switch's position (SAW_SWAP_TEST_MOVES), by the side the crowd plays. */
export const SAW_SWAP_TEST_CHECK: Readonly<Record<Side, string>> = { w: "f1b5", b: "f8b4" };

/**
 * His Saw Swap came as the crowd's move just played landed: while he thinks after it (its moment, about 5 s), the move he's about to
 * play isn't on the board yet, so the move list holds it back (as Dash's pop-off: popOffHolding). The screens' view and the state alike.
 */
export const sawSwapHolding = (boss: { id?: string; crowdMoves?: number; powers?: { sawSwap?: { at: number } | null } | null } | null | undefined): boolean =>
  boss?.id === "sawyer" && !!boss.powers?.sawSwap && boss.powers.sawSwap.at === boss.crowdMoves;

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
      if (boardSawReady(next, t) || testSwitch(t, next)) {
        next.warnAt = t.turn;
        t.events.push({ kind: "warn", turn: t.turn });
      }
      return false;
    }
    return t.turn > next.warnAt ? unleash() : false;
  },
  // The board saw runs while the halves are apart.
  ultimateRunning: (p, turn) => turn <= (p.boardSaw?.until ?? p.ultAt!),
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
  // His cuts on the board (sawMarks), both sides' moves (the dispatcher lifts them for a turn they'd leave no move).
  layer(boss) {
    const edges = sawMarks(boss.powers);
    return edges.length ? { edges } : null;
  },
  // His own moves: his first is a pawn move (no pawn move: any, as the dispatcher lifts it); the cuts stop him too (layer).
  // (His first move is his own: on a side of several bosses it binds only his.)
  sideStops: () => null,
  bossStops(boss) {
    const p = boss.powers;
    return p && firstMoveDue(p) ? (m, fen) => pieceAt(fen, from(m))?.type !== "p" : null;
  },
  // Which saw stops a move (the screens' words): the board saw's line, else the saw cut's edge.
  stopReason: (boss, fen, m) => {
    const hit = marksStop({ edges: sawMarks(boss.powers) }, fen, m);
    return hit ? (hit.kind === "boardsaw" ? "boardsaw" : "cut") : null;
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
        // (No split yet: it waits for his next pawn move with room and a pawn to split. That covers a first move that
        // wasn't a pawn's too: a check with no pawn move out of it lifts the rule.)
        const split: SplitPawn = { turn: turnOf(boss), pawn: moved, square: null, halves: [], waiting: true };
        b.state = { ...b.state, boss: { ...boss, powers: { ...p, split } } };
      }
      return;
    }
    sawyerBattle.track(b, move);
  },
  // After the crowd's move (the start of his turn): the halves follow it; then the Saw Swap, if it comes now.
  afterCrowdMove(b, move) {
    if (move) sawyerBattle.track(b, move);
    sawyerBattle.sawSwap(b);
  },
  // The judge: a crowd move that sets off the Saw Swap is scored on the board after the swap (Eric, Nov 21).
  judgeAfter: (b, allowed) => sawyerBattle.judgeSwaps(b, allowed),
  // (Several bosses: another boss's move, his halves follow it too; a half another boss's power moved or changed is let go.)
  followMove: (b, move) => sawyerBattle.track(b, move),
  followBoard(b) {
    const boss = b.state.boss!;
    const p = boss.powers!;
    if (!p.split?.halves.length) return;
    const fen = b.boards.get(b.state.boards[0]!)!.fen;
    const mine = other(boss.crowdSide);
    const halves = p.split.halves.filter((h) => pieceAt(fen, h.square)?.type === "p" && pieceAt(fen, h.square)?.color === mine);
    if (halves.length < p.split.halves.length) b.state = { ...b.state, boss: { ...boss, powers: { ...p, split: { ...p.split, halves } } } };
  },
  // From the game so far; his cuts start a turn later than the others' passives (the split has turn 2 to itself).
  opening: {
    setUp(b, at) {
      // (The test switch: a pawn of his already gone, the crowd to move: SPLIT_TEST_MOVES.)
      // (?power=sawswap: a few moves in, the crowd's check ready: SAW_SWAP_TEST_MOVES.)
      const test = b.settings.bossPowerTest === "split" ? SPLIT_TEST_MOVES : b.settings.bossPowerTest === "sawswap" ? SAW_SWAP_TEST_MOVES : null;
      if (test) {
        const moves = test[at.crowdSide];
        b.boards.set(at.boardId, newBoard(at.boardId, { ...BOSS_OPENING, moves: [...moves] }, moves.length, at.generation));
      }
      return { nextPassive: BOSS_POWERS.sawFirst };
    },
  },
  view: (p) => ({ split: p.split ?? null, cut: p.cut ? { ...p.cut } : null, boardSaw: p.boardSaw ? { ...p.boardSaw } : null, sawSwap: p.sawSwap ? { at: p.sawSwap.at, king: [...p.sawSwap.king] as [string, string] } : null }),
};

/** His part in the match runner. */
export const sawyerBattle = {
  /**
   * The Saw Swap, if it comes as the crowd's move just played lands (the start of his turn; Eric, Nov 20: "trigger anytime whenever it
   * legally is safe to"): not yet this battle, not on a Battle Tower floor (lone or shared) unless `sawSwapInTower`, he's to move, the
   * battle goes on (not at the move cap; never on a mate, a draw or the battle's end: the crowd's mate stands), and sawSwapFen says
   * the swap may come. The board takes the new position (a base at this ply: the history keeps every move, and nothing before it can
   * come again), its last move cleared (the crowd's move's squares mean nothing on the swapped half); his split pawn's halves on his
   * half move with their blocks; the rage meter and his other powers are untouched (his saw cut is always in the crowd's half; the
   * board saw's line, between the d and e files, is the line the swap saws along, so it stays as it is). Its moment (`sawSwap`, while
   * he thinks) plays before his move, which he picks from the new position as ever. Returns whether it came.
   */
  sawSwap(b: Battle, s: Pick<BossPowerSettings, "sawSwapInTower"> = BOSS_POWERS): boolean {
    const boss = b.state.boss;
    if (!sawyerBattle.swapToCome(b, s) || !boss || !b.bossToMove() || boss.crowdMoves >= b.settings.bossMaxMoves) return false;
    const p = boss.powers!;
    const id = b.state.boards[0]!;
    const board = b.boards.get(id)!;
    if (boardEnd(board) !== null) return false;
    const mine = other(boss.crowdSide);
    const fen = sawSwapFen(board.fen, mine);
    if (!fen) return false;
    const before = kingOf(board.fen, mine)!;
    const king: [string, string] = [before, swapSquare(before, mine)];
    const ply = board.history.length;
    b.boards.set(id, { ...board, fen, lastMove: null, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen }] });
    const split = p.split?.halves.length ? { ...p.split, halves: p.split.halves.map((h) => ({ ...h, square: swapSquare(h.square, mine) })) } : p.split;
    b.state = {
      ...b.state,
      boss: { ...boss, powers: { ...p, ...(split ? { split } : {}), sawSwap: { at: boss.crowdMoves, king }, events: [...p.events, { kind: "sawSwap", turn: p.turn, square: king[1], squares: [...king] }] } },
    };
    return true;
  },

  /**
   * The Saw Swap may still come this battle: the boss is Sawyer, he hasn't swapped yet, the battle's on, and it isn't a Battle Tower
   * floor (lone or shared) unless `sawSwapInTower`. sawSwap's own test, and the judge's (judgeSwaps): one rule for both.
   */
  swapToCome(b: Battle, s: Pick<BossPowerSettings, "sawSwapInTower"> = BOSS_POWERS): boolean {
    const boss = b.state.boss;
    const p = boss?.powers;
    return !!boss && !!p && boss.id === "sawyer" && !p.sawSwap && !boss.result && !(b.settings.towerFloor && !s.sawSwapInTower);
  },

  /**
   * The judge's look past the crowd's move (Eric, Nov 21: "score that checking move as if the swap happens"): of `allowed`, the crowd's
   * moves this turn (the crowd to move), those that set off the Saw Swap as they land, each with the board after the swap (him to move),
   * which the judge scores the move on instead of the board right after it (BossRules.judgeAfter). sawSwap's own rules, a move ahead:
   * the swap still to come (swapToCome), the crowd's move not the battle's last (the move cap) nor one that ends the game on the board
   * (a mate stands; a draw), and sawSwapFen. Sorted by move; empty when none. A side of several bosses (a tower floor, where the swap is
   * off: sawSwapInTower) gets none: which boss moves after the crowd isn't settled until its move lands.
   */
  judgeSwaps(b: Battle, allowed: readonly string[], s: Pick<BossPowerSettings, "sawSwapInTower"> = BOSS_POWERS): Record<string, string> {
    const boss = b.state.boss;
    if (!sawyerBattle.swapToCome(b, s) || !boss || (b.state.bosses?.length ?? 0) > 1 || b.bossToMove() || boss.crowdMoves + 1 >= b.settings.bossMaxMoves) return {};
    const board = b.boards.get(b.state.boards[0]!)!;
    const mine = other(boss.crowdSide);
    const out: Record<string, string> = {};
    for (const m of [...allowed].sort()) {
      let after: string;
      try {
        after = applyMove(board.fen, m);
        if (!inCheck(after)) continue;
      } catch {
        continue;
      }
      const fen = sawSwapFen(after, mine);
      if (fen && boardEnd({ ...board, history: [...board.history, m] }) === null) out[m] = fen;
    }
    return out;
  },

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
