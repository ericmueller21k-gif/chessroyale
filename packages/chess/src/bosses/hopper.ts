/**
 * Chub & Chirp (BOSS_ROSTER "hopper"; HOPPER_NAME): Chub the rabbit riding Chirp the grasshopper (Eric, Oct 18). Their
 * rules ("he" below: the boss as one, as for every boss; Chirp does the hop).
 *
 * His passive, Leapfrog: at the start of his turn, when one of his pawns stands nose to nose with one of the crowd's
 * (the crowd's pawn on the square in front of his), his pawn hops over it to the square beyond, if that square is
 * empty: automatically (he says a line: the app's). Never onto the crowd's back rank (Eric: no instant queen), never one
 * that leaves his king attacked (a pinned pawn; in check, it waits), never one that gives check; the en passant square
 * goes with it. When several can, the engine's pick: the one best for him (hopFrom), as the other bosses' powers pick.
 * At most hopMax a battle. `hopIsMove` (BOSS_POWERS) says which of Eric's two ways it is: false, the hop comes first and
 * he still plays his move; true, the hop is his move that turn (as Alfil's fusion). The sim decides
 * (reports/hopper-sim.md).
 *
 * His ultimate isn't decided yet (Eric, Oct 18): `hopperult` holds its place in the roster, his rules have none (it
 * never comes) and his meter is off (`meter`: none shown). Its hooks go here when it's built.
 *
 * Never an illegal position: every hop is checked on the board (hopOptions) and leaves a base at its ply (the position
 * changes outside a move: every replay plays from it, and a repetition counts from it).
 */
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type LeapfrogHop } from "@chessroyale/core";
import { gameEnd, legalMoves, mateInOne, sideToMove } from "../rules.ts";
import { stockfishRefuses } from "../uci.ts";
import { passTurn } from "./hollow.ts";
import { editedFen } from "./alfil.ts";
import { newBoard, BOSS_OPENING } from "../boards.ts";
import type { EngineLike } from "../runner.ts";
import { other, topEach, type Battle, type BossRules, type Side } from "./base.ts";
import { gridKingAttacked, gridOf, type Grid } from "./grid.ts";

/**
 * His moment, beat by beat (ms into it; nobody's clock runs), for his art to match (a later build: his animations' cues):
 *   hop  his line as it begins; at `liftAt` his pawn leaves its square, at `overAt` it's over the crowd's pawn, at
 *        `landAt` it lands on the square beyond; the screen holds to `total`.
 */
export const HOPPER_BEATS = {
  hop: { liftAt: 300, overAt: 600, landAt: 900, total: 1600 },
} as const;

/** How long his moment holds the screen (ms; POWER_FX in boss-timing.ts). */
export const HOPPER_FX = { hop: HOPPER_BEATS.hop.total } as const;

const rank = (sq: string) => Number(sq[1]);
const square = (f: number, r: number) => `${"abcdefgh"[f]}${r}`;
const letter = (side: Side, type: string) => (side === "w" ? type.toUpperCase() : type.toLowerCase());

/** One hop he could make now: his pawn's square, the crowd's pawn it hops over, the square beyond, and the position after. */
export interface HopOption {
  from: string;
  over: string;
  to: string;
  fen: string;
}

/**
 * Why a pawn of his nose to nose with one of the crowd's can't hop now (the sims count them): the square beyond isn't
 * empty (`blocked`), it's the crowd's back rank (`lastRank`), his king would be attacked after it (`pinned`), he's in
 * check (`inCheck`: it waits), it would give check (`check`), the side to move after it would have no move or the game
 * would end (`noMove`), or (the hop comes before his move) it gives him a mate in one he didn't have (`mate`).
 */
export type HopRefused = "blocked" | "lastRank" | "pinned" | "inCheck" | "check" | "noMove" | "mate";

/**
 * The hops he could make now (him to move in `fen`; `boss` his side), in his pawns' square order, and why each other
 * pawn of his that stands nose to nose with one of the crowd's can't. A hop takes his pawn two squares forward, over the
 * crowd's pawn, onto the empty square beyond: never the crowd's back rank, never leaving his king attacked (a pinned
 * pawn; in check, none), never giving check. The position after it: the en passant square cleared, the fifty-move count
 * from zero (a pawn moved), castling as it was; `isMove` (the hop is his move): the crowd to move (passTurn: the move
 * number goes on when he's Black), and never leaving it without a move or ending the game; otherwise him still to move,
 * with a move to play, and never a mate in one for him that the hop made. The engine must play the position too.
 */
export function hopOptions(fen: string, boss: Side, isMove: boolean = BOSS_POWERS.hopIsMove): { options: HopOption[]; refused: { from: string; why: HopRefused }[] } {
  const options: HopOption[] = [];
  const refused: { from: string; why: HopRefused }[] = [];
  if (sideToMove(fen) !== boss) return { options, refused };
  const g0 = gridOf(fen);
  const crowd = other(boss);
  const dir = boss === "w" ? 1 : -1;
  const back = boss === "w" ? 8 : 1;
  const checked = gridKingAttacked(g0, boss);
  // (His mate in one before the hop, asked only once a hop gets that far.)
  let before: string | null | undefined;
  const mateBefore = () => (before === undefined ? (before = mateInOne(fen)) : before);
  const pawns = [...g0].filter(([, c]) => c === letter(boss, "p")).map(([sq]) => sq).sort();
  for (const from of pawns) {
    const f = from.charCodeAt(0) - 97;
    const over = square(f, rank(from) + dir);
    if (g0.get(over) !== letter(crowd, "p")) continue;
    const to = square(f, rank(from) + 2 * dir);
    const why = hopRefused(g0, fen, from, to, boss, checked, isMove, mateBefore);
    if (typeof why === "string") refused.push({ from, why });
    else options.push({ from, over, to, fen: why.fen });
  }
  return { options, refused };
}

/** One hop checked (hopOptions): why it can't go, or the position after it. */
function hopRefused(g0: Grid, fen: string, from: string, to: string, boss: Side, checked: boolean, isMove: boolean, mateBefore: () => string | null): HopRefused | { fen: string } {
  if (g0.has(to)) return "blocked";
  if (rank(to) === (boss === "w" ? 8 : 1)) return "lastRank";
  const g: Grid = new Map(g0);
  g.delete(from);
  g.set(to, letter(boss, "p"));
  if (checked) return "inCheck";
  if (gridKingAttacked(g, boss)) return "pinned";
  if (gridKingAttacked(g, other(boss))) return "check";
  const parts = editedFen(fen, g).split(" ");
  parts[3] = "-";
  const edited = parts.join(" ");
  // (passTurn: null when the crowd would have no move.)
  const out = isMove ? passTurn(edited) : edited;
  if (!out || gameEnd(out, []) || stockfishRefuses(out) || !hasMove(out)) return "noMove";
  if (!isMove && mateInOne(out) && !mateBefore()) return "mate";
  return { fen: out };
}

/** The side to move has a legal move. */
function hasMove(fen: string): boolean {
  try {
    return legalMoves(fen).length > 0;
  } catch {
    return false;
  }
}

/**
 * The engine's pick of a hop, from this device's engines (the host's online, solo's): each way to go searched at hopNodes
 * (shared out over the engines), scored as his expected score there (him to move: the engine's own; the crowd to move:
 * the rest), and the best for him taken (equals in the order given). Null: no candidates, no engine or no answer (the
 * hop then takes the first way: hopperBattle.apply).
 */
export async function hopFrom(engines: readonly EngineLike[], fen: string, candidates: readonly string[], s: Pick<BossPowerSettings, "hopNodes"> = BOSS_POWERS): Promise<{ fen: string } | null> {
  if (!candidates.length || !engines.length) return null;
  const his = sideToMove(fen);
  const tops = await topEach(engines, candidates, s.hopNodes);
  let pick: { fen: string; his: number } | null = null;
  for (let i = 0; i < candidates.length; i++) {
    const m = tops[i];
    if (!m) continue;
    const mine = sideToMove(candidates[i]!) === his ? m.expected : 1 - m.expected;
    if (!pick || mine > pick.his) pick = { fen: candidates[i]!, his: mine };
  }
  return pick ? { fen: pick.fen } : null;
}

/**
 * The test switch (?power=leapfrog): the battle starts from 1.e4 e5 with the crowd to move, so his pawn stands nose to
 * nose with the crowd's as his first turn begins (nothing the crowd can play first fills the square beyond or pins it).
 * The crowd White: 1.e4 e5 (his e5 over your e4 to e3); the crowd Black: 1.e4 e5 2.Nf3 (his e4 over your e5 to e6).
 */
export const LEAPFROG_TEST_MOVES: Record<Side, readonly string[]> = { w: ["e2e4", "e7e5"], b: ["e2e4", "e7e5", "g1f3"] };

// ---------------- His rules ----------------

/** The hopper: Leapfrog (his pawns hop over the crowd's). His ultimate isn't built: it never comes, and his meter is off. */
export const HOPPER: BossRules = {
  id: "hopper",
  // (No ultimate yet: none comes, the test trigger and the test switch included; no meter shown.)
  ultimate: () => false,
  meter: () => null,
  // As a crowd turn begins: his hop, when it was his move just now (variant B; with the hop first, its moment plays at
  // the start of his turn: hopperBattle.apply).
  everyTurn(next, t) {
    const h = next.hop;
    if (t.s.hopIsMove && h && h.at + 1 === t.turn) t.events.push({ kind: "hop", turn: t.turn, square: h.to, squares: [h.from, h.over, h.to] });
  },
  // (Leapfrog comes at the start of his turn: hopperBattle.)
  passive() {},
  // The crowd's turn right after a hop: its picks don't count for fair play.
  powerTurn: (boss) => !!boss.powers!.hop && boss.powers!.hop.at === boss.crowdMoves,
  opening: {
    setUp(b, at) {
      if (b.settings.bossPowerTest !== "leapfrog") return {};
      const moves = LEAPFROG_TEST_MOVES[at.crowdSide];
      b.boards.set(at.boardId, newBoard(at.boardId, { ...BOSS_OPENING, moves: [...moves] }, moves.length, at.generation));
      return {};
    },
  },
  view: (p) => ({ hop: p.hop ?? null }),
};

// ---------------- His part in the match runner ----------------

/** The battle's board (its one board). */
const boardOf = (b: Battle) => b.boards.get(b.state.boards[0]!)!;

/** His hops now, worked out once per position (the pick is checked against the same list). */
function hopList(b: Battle, s: Pick<BossPowerSettings, "hopIsMove">): ReturnType<typeof hopOptions> {
  const boss = b.state.boss!;
  const fen = boardOf(b).fen;
  const key = `${fen}|${s.hopIsMove}`;
  const memo = b.memo.get("hop") as { key: string; list: ReturnType<typeof hopOptions> } | undefined;
  if (memo?.key === key) return memo.list;
  const list = hopOptions(fen, other(boss.crowdSide), s.hopIsMove);
  b.memo.set("hop", { key, list });
  return list;
}

/** His powers' state, changed (the match's state replaced, as everywhere). */
const setPowers = (b: Battle, change: (p: BossPowerState) => BossPowerState): void => {
  const boss = b.state.boss!;
  b.state = { ...b.state, boss: { ...boss, powers: change(boss.powers!) } };
};

export const hopperBattle = {
  /**
   * A hop is due: his turn (the crowd has moved), the battle on, fewer than hopMax hops so far, none yet this turn, and a
   * pawn of his that can hop (hopOptions: in check, none).
   */
  due(b: Battle, s: BossPowerSettings = BOSS_POWERS): boolean {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "hopper" || boss.result || !b.bossToMove() || b.finalGameOver()) return false;
    if ((p.hops ?? 0) >= s.hopMax || p.hop?.at === boss.crowdMoves) return false;
    return hopList(b, s).options.length > 0;
  },

  /** The positions the engine's pick weighs (one per hop he could make), when a hop is due: the same on the server, the host and in solo. */
  candidates(b: Battle, s: BossPowerSettings = BOSS_POWERS): string[] {
    return hopperBattle.due(b, s) ? hopList(b, s).options.map((o) => o.fen) : [];
  },

  /** The hop needs an engine's pick: more than one pawn can hop (one alone hops at once). */
  needsEngine(b: Battle, s: BossPowerSettings = BOSS_POWERS): boolean {
    return hopperBattle.candidates(b, s).length > 1;
  },

  /** The hop, from this device's engines (solo, the sims): hopFrom, then apply. Null: no hop was due. */
  async play(b: Battle, engines: readonly EngineLike[], s: BossPowerSettings = BOSS_POWERS): Promise<LeapfrogHop | null> {
    const candidates = hopperBattle.candidates(b, s);
    if (!candidates.length) return null;
    const pick = candidates.length > 1 ? await hopFrom(engines, boardOf(b).fen, candidates, s) : null;
    return hopperBattle.apply(b, pick?.fen ?? null, s);
  },

  /**
   * The hop (online with the host's pick: one of the candidates, else the first): his pawn over the crowd's to the square
   * beyond, a base on the board. Nothing is scored.
   * - **The hop first** (`hopIsMove` false): him still to move; its moment plays at the start of his turn, a screen of
   *   its own (its event with this turn's), then his move.
   * - **The hop is his move** (`hopIsMove` true): the crowd's turn begins (no last move to show; its moment plays as that
   *   turn begins, HOPPER.everyTurn). The God King's strike just before it hits it: the hop goes to a pawn other than the
   *   engine's pick when another can hop, and the strike is spent there, as by a move.
   * Returns the hop; null when none was due.
   */
  apply(b: Battle, pick: string | null, s: BossPowerSettings = BOSS_POWERS): LeapfrogHop | null {
    if (!hopperBattle.due(b, s)) return null;
    const boss = b.state.boss!;
    const options = hopList(b, s).options;
    const best = options.find((o) => o.fen === pick) ?? null;
    // (Staggered, when the hop is his move: not the engine's pick.)
    const chosen = (s.hopIsMove && boss.staggerNext && best && options.length > 1 ? options.find((o) => o !== best) : best) ?? options[0]!;
    const hop: LeapfrogHop = { at: boss.crowdMoves, from: chosen.from, over: chosen.over, to: chosen.to };
    const id = b.state.boards[0]!;
    const board = boardOf(b);
    const ply = board.history.length;
    const bases = [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: chosen.fen }];
    if (!s.hopIsMove) {
      b.boards.set(id, { ...board, fen: chosen.fen, bases });
      setPowers(b, (p) => ({ ...p, hop, hops: (p.hops ?? 0) + 1, events: [...p.events, { kind: "hop", turn: p.turn, square: hop.to, squares: [hop.from, hop.over, hop.to] }] }));
      return hop;
    }
    // His move: the board passes to the crowd with no move played (no last move to show), then what follows his move.
    b.boards.set(id, { ...board, fen: chosen.fen, bases, expected: 1 - board.expected, lastMove: null });
    b.bossLast = null;
    setPowers(b, (p) => ({ ...p, hop, hops: (p.hops ?? 0) + 1 }));
    // (The God King's strike is spent on it, as on a move.)
    if (b.state.boss!.staggerNext) b.state = { ...b.state, boss: { ...b.state.boss!, staggerNext: false } };
    b.bossPassed();
    return hop;
  },
};
