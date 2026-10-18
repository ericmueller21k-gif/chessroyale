/**
 * Chub & Chirp (BOSS_ROSTER "hopper"; HOPPER_NAME): Chub the rabbit riding Chirp the grasshopper (Eric, Oct 18). Their
 * rules ("he" below: the boss as one, as for every boss; Chirp does the hop).
 *
 * Their passive, Leapfrog: at the start of his turn, when one of his pawns stands nose to nose with one of the crowd's
 * (the crowd's pawn on the square in front of his), his pawn hops over it to the square beyond, if that square is
 * empty: automatically (he says a line: the app's), and then he plays his move. Never onto the crowd's back rank (Eric:
 * no instant queen), never one that leaves his king attacked (a pinned pawn; in check, it waits), never one that gives
 * check; the en passant square goes with it. When several can, the engine's pick: the one best for him (hopFrom), as
 * the other bosses' powers pick. At most hopMax a battle, one a turn. (Eric left open whether the hop is free or his
 * move that turn: "let the sim figure it out". Free, he lands in the pack; as his move, the crowd scored 0.77:
 * reports/hopper-sim.md, docs/decisions/2026-10-18-hopper-leapfrog.md.)
 *
 * Their ultimate isn't decided yet (Eric, Oct 18): `hopperult` holds its place in the roster, these rules have none (it
 * never comes) and the meter is off (`meter`: none shown). Its hooks go here when it's built.
 *
 * Never an illegal position: every hop is checked on the board (hopOptions) and leaves a base at its ply (the position
 * changes outside a move: every replay plays from it, and a repetition counts from it).
 */
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type LeapfrogHop } from "@chessroyale/core";
import { BOSS_OPENING, newBoard } from "../boards.ts";
import { gameEnd, legalMoves, mateInOne, sideToMove } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import { stockfishRefuses } from "../uci.ts";
import { editedFen } from "./alfil.ts";
import { other, topEach, type Battle, type BossRules, type Side } from "./base.ts";
import { gridKingAttacked, gridOf, type Grid } from "./grid.ts";

/**
 * His moment, beat by beat (ms into it; nobody's clock runs), for the art to match (a later build: the animations' cues):
 *   hop  his line as it begins; at `liftAt` his pawn leaves its square, at `overAt` it's over the crowd's pawn, at
 *        `landAt` it lands on the square beyond; the screen holds to `total`, then he thinks and plays his move.
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
 * empty (`blocked`), it's the crowd's back rank (`lastRank`), he's in check (`inCheck`: it waits), his king would be
 * attacked after it (`pinned`), it would give check (`check`), he'd have no move after it or the game would end
 * (`noMove`), or it would give him a mate in one he didn't have (`mate`: the crowd never sees the hop before his move).
 */
export type HopRefused = "blocked" | "lastRank" | "inCheck" | "pinned" | "check" | "noMove" | "mate";

/**
 * The hops he could make now (him to move in `fen`; `boss` his side), in his pawns' square order, and why each other
 * pawn of his that stands nose to nose with one of the crowd's can't. A hop takes his pawn two squares forward, over the
 * crowd's pawn, onto the empty square beyond: never the crowd's back rank, never with his king attacked before or after
 * it (in check; a pinned pawn), never giving check, never leaving him without a move, never making him a mate in one.
 * The position after it: him still to move, the en passant square cleared, the fifty-move count from zero (a pawn
 * moved), castling and the move number as they were; one the engine plays.
 */
export function hopOptions(fen: string, boss: Side): { options: HopOption[]; refused: { from: string; why: HopRefused }[] } {
  const options: HopOption[] = [];
  const refused: { from: string; why: HopRefused }[] = [];
  if (sideToMove(fen) !== boss) return { options, refused };
  const g0 = gridOf(fen);
  const dir = boss === "w" ? 1 : -1;
  const checked = gridKingAttacked(g0, boss);
  // (His mate in one before the hop, asked only once a hop gets that far.)
  let before: string | null | undefined;
  const mateBefore = () => (before === undefined ? (before = mateInOne(fen)) : before);
  const pawns = [...g0].filter(([, c]) => c === letter(boss, "p")).map(([sq]) => sq).sort();
  for (const from of pawns) {
    const f = from.charCodeAt(0) - 97;
    const over = square(f, rank(from) + dir);
    if (g0.get(over) !== letter(other(boss), "p")) continue;
    const to = square(f, rank(from) + 2 * dir);
    const why = hopRefused(g0, fen, from, to, boss, checked, mateBefore);
    if (typeof why === "string") refused.push({ from, why });
    else options.push({ from, over, to, fen: why.fen });
  }
  return { options, refused };
}

/** One hop checked (hopOptions): why it can't go, or the position after it. */
function hopRefused(g0: Grid, fen: string, from: string, to: string, boss: Side, checked: boolean, mateBefore: () => string | null): HopRefused | { fen: string } {
  if (g0.has(to)) return "blocked";
  if (rank(to) === (boss === "w" ? 8 : 1)) return "lastRank";
  if (checked) return "inCheck";
  const g: Grid = new Map(g0);
  g.delete(from);
  g.set(to, letter(boss, "p"));
  if (gridKingAttacked(g, boss)) return "pinned";
  if (gridKingAttacked(g, other(boss))) return "check";
  const parts = editedFen(fen, g).split(" ");
  parts[3] = "-";
  const out = parts.join(" ");
  if (gameEnd(out, []) || stockfishRefuses(out) || !hasMove(out)) return "noMove";
  if (mateInOne(out) && !mateBefore()) return "mate";
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
 * The engine's pick of a hop, from this device's engines (the host's online, solo's): each way to go (him to move)
 * searched at hopNodes, shared out over the engines, and the one with his best expected score taken (equals in the
 * order given). Null: no candidates, no engine or no answer (the hop then takes the first way: hopperBattle.apply).
 */
export async function hopFrom(engines: readonly EngineLike[], fen: string, candidates: readonly string[], s: Pick<BossPowerSettings, "hopNodes"> = BOSS_POWERS): Promise<{ fen: string } | null> {
  if (!candidates.length || !engines.length) return null;
  const tops = await topEach(engines, candidates, s.hopNodes);
  let pick: { fen: string; his: number } | null = null;
  for (let i = 0; i < candidates.length; i++) {
    const m = tops[i];
    if (m && (!pick || m.expected > pick.his)) pick = { fen: candidates[i]!, his: m.expected };
  }
  return pick ? { fen: pick.fen } : null;
}

/**
 * The test switch (?power=leapfrog): the battle starts from 1.e4 e5 with the crowd to move, so his pawn stands nose to
 * nose with the crowd's as his first turn begins, whatever the crowd plays first (nothing fills the square beyond, pins
 * the pawn or lets the hop give check). The crowd White: 1.e4 e5 (his e5 over your e4 to e3); the crowd Black (?side=b):
 * 1.e4 e5 2.Nf3 (his e4 over your e5 to e6).
 */
export const LEAPFROG_TEST_MOVES: Record<Side, readonly string[]> = { w: ["e2e4", "e7e5"], b: ["e2e4", "e7e5", "g1f3"] };

// ---------------- Their rules ----------------

/** Chub & Chirp: Leapfrog (his pawns hop over the crowd's). The ultimate isn't built: it never comes, and the meter is off. */
export const HOPPER: BossRules = {
  id: "hopper",
  // (No ultimate yet: none comes, the test trigger and the test switch included; no meter shown.)
  ultimate: () => false,
  meter: () => null,
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

// ---------------- Their part in the match runner ----------------

/** The battle's board (its one board). */
const boardOf = (b: Battle) => b.boards.get(b.state.boards[0]!)!;

/** His hops now, worked out once per position (the pick is checked against the same list). */
function hopList(b: Battle): ReturnType<typeof hopOptions> {
  const fen = boardOf(b).fen;
  const memo = b.memo.get("hop") as { fen: string; list: ReturnType<typeof hopOptions> } | undefined;
  if (memo?.fen === fen) return memo.list;
  const list = hopOptions(fen, other(b.state.boss!.crowdSide));
  b.memo.set("hop", { fen, list });
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
  due(b: Battle, s: Pick<BossPowerSettings, "hopMax"> = BOSS_POWERS): boolean {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "hopper" || boss.result || !b.bossToMove() || b.finalGameOver()) return false;
    if ((p.hops ?? 0) >= s.hopMax || p.hop?.at === boss.crowdMoves) return false;
    return hopList(b).options.length > 0;
  },

  /** The positions the engine's pick weighs (one per hop he could make), when a hop is due: the same on the server, the host and in solo. */
  candidates(b: Battle): string[] {
    return hopperBattle.due(b) ? hopList(b).options.map((o) => o.fen) : [];
  },

  /** The hop needs an engine's pick: more than one pawn can hop (one alone hops at once). */
  needsEngine(b: Battle): boolean {
    return hopperBattle.candidates(b).length > 1;
  },

  /** The hop, from this device's engines (solo, the sims): hopFrom when several can, then apply. Null: none was due. */
  async play(b: Battle, engines: readonly EngineLike[]): Promise<LeapfrogHop | null> {
    const candidates = hopperBattle.candidates(b);
    if (!candidates.length) return null;
    const pick = candidates.length > 1 ? await hopFrom(engines, boardOf(b).fen, candidates) : null;
    return hopperBattle.apply(b, pick?.fen ?? null);
  },

  /**
   * The hop (online with the host's pick: one of the candidates; anything else, the first): his pawn over the crowd's to
   * the square beyond, a base on the board at its ply (no move added; him still to move). Its moment plays at the start
   * of his turn, a screen of its own (its event with this turn's), then he plays his move. Nothing is scored; the God
   * King's strike waits for that move, as ever. Returns the hop; null when none was due.
   */
  apply(b: Battle, pick: string | null): LeapfrogHop | null {
    if (!hopperBattle.due(b)) return null;
    const options = hopList(b).options;
    const chosen = options.find((o) => o.fen === pick) ?? options[0]!;
    const hop: LeapfrogHop = { at: b.state.boss!.crowdMoves, from: chosen.from, over: chosen.over, to: chosen.to };
    const id = b.state.boards[0]!;
    const board = boardOf(b);
    const ply = board.history.length;
    b.boards.set(id, { ...board, fen: chosen.fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: chosen.fen }] });
    setPowers(b, (p) => ({ ...p, hop, hops: (p.hops ?? 0) + 1, events: [...p.events, { kind: "hop", turn: p.turn, square: hop.to, squares: [hop.from, hop.over, hop.to] }] }));
    return hop;
  },
};
