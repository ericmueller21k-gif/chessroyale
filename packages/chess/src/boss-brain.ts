/**
 * A boss's brain (BOSS_BRAIN in settings): how its move is chosen when a human-like engine (Maia-3, in its own worker,
 * spoken to over text by HumanUciEngine) is on offer. The boss's own top-8 Stockfish search stays the referee: the
 * guarded brains veto from it, and every fallback is today's Stockfish move.
 */
import { BATTLE_TOWER, BOSS_BRAIN, type BossBrain, type BossBrainSettings, type BrainGuard, type Rng } from "@chessroyale/core";
import { Chess, type Move, type Square } from "chess.js";
import { moveLoss } from "./bosses/base.ts";
import type { MoveScore } from "./uci.ts";

/** Pieces' worth in pawns for the gift check's static exchange (a king never taken: legal moves only). */
const WORTH: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/**
 * What the side to move wins on `sq` by taking there first (a static exchange: each side takes with its cheapest legal capture,
 * or stops when taking would lose; legal moves, so pins, checks and pieces behind the first come in as they should). 0: nothing.
 */
function exchangeOn(c: Chess, sq: Square): number {
  const target = c.get(sq);
  if (!target) return 0;
  const cheapest = cheapestTake(c, sq);
  if (!cheapest) return 0;
  c.move(cheapest);
  const gain = WORTH[target.type]! - exchangeOn(c, sq);
  c.undo();
  return Math.max(0, gain);
}

/** The side to move's cheapest legal capture on `sq` (a pawn promoting as a queen), or null. */
function cheapestTake(c: Chess, sq: Square): Move | null {
  const takes = c.moves({ verbose: true }).filter((m: Move) => m.to === sq && (!m.promotion || m.promotion === "q"));
  return takes.length ? takes.reduce((a, b) => (WORTH[b.piece]! < WORTH[a.piece]! ? b : a)) : null;
}

/**
 * After every legal capture on `sq` by the other side, the mover has a mate in one (a sacrifice that mates: chess.js's "#"). Every one,
 * not only the cheapest (the second review of #991: Nxc4 allows Re8# but Rxc4 just wins the queen, a gift all the same).
 */
function matesAfterTake(c: Chess, sq: Square): boolean {
  const takes = c.moves({ verbose: true }).filter((m: Move) => m.to === sq && (!m.promotion || m.promotion === "q"));
  if (!takes.length) return false;
  return takes.every((take) => {
    c.move(take);
    const mate = c.moves().some((san) => san.endsWith("#"));
    c.undo();
    return mate;
  });
}

/**
 * How much a move gives away with the piece it moves (BATTLE_TOWER's gift check, no engine): when it moves one of `pieces` (a queen or
 * rook), what the other side wins taking it on its new square (exchangeOn), less what the move itself took; 0 for any other piece, a
 * mate, a sacrifice that mates (a mate in one after every capture on its square: matesAfterTake), or a position chess.js can't
 * read. A piece left hanging elsewhere isn't counted (a missed threat is allowed).
 */
export function giftedMaterial(fen: string, move: string, pieces: readonly string[] = BATTLE_TOWER.giftPieces): number {
  try {
    const c = new Chess(fen);
    const from = move.slice(0, 2) as Square;
    const to = move.slice(2, 4) as Square;
    const piece = c.get(from);
    if (!piece || !pieces.includes(piece.type)) return 0;
    const made = c.move({ from, to, ...(move[4] ? { promotion: move[4] } : {}) });
    if (c.isCheckmate()) return 0;
    const lost = exchangeOn(c, to) - (made.captured ? WORTH[made.captured]! : 0);
    return lost > 0 && !matesAfterTake(c, to) ? lost : 0;
  } catch {
    return 0;
  }
}

/** A gift (BATTLE_TOWER.giftLoss): the move gives away at least that many pawns with the queen or rook it moves. */
export const isGift = (fen: string, move: string, s: Pick<typeof BATTLE_TOWER, "giftPieces" | "giftLoss"> = BATTLE_TOWER): boolean =>
  giftedMaterial(fen, move, s.giftPieces) >= s.giftLoss;

/**
 * Maia's move drawn again without the gift (a Battle Tower floor's noGift): from its listed moves (its likeliest, `moves`) that it may
 * play and that aren't gifts, each weighed by its probability at the draw's temperature (p^(1/T), as the box weighs a draw), with `rng`
 * (the boss move's random source: the seeded one online, so the checker draws the same). Null: every listed move is a gift.
 */
export function redrawWithoutGift(fen: string, moves: readonly HumanCandidate[], ok: (m: string) => boolean, temperature: number, rng: Rng): string | null {
  const left = moves.filter((c) => ok(c.move) && !isGift(fen, c.move));
  if (!left.length) return null;
  const t = Math.max(0.05, temperature);
  const w = left.map((c) => Math.pow(Math.max(c.p, 1e-6), 1 / t));
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < left.length; i++) {
    r -= w[i]!;
    if (r < 0) return left[i]!.move;
  }
  return left[left.length - 1]!.move;
}

/** One of Maia's candidates: a move and how likely a human of its rating is to play it. */
export interface HumanCandidate {
  move: string;
  p: number;
}

export interface HumanAnswer {
  /** Its own choice, drawn from its probabilities (as asked: temperature, top-p). */
  best: string | null;
  /** Its likeliest moves, most likely first. */
  moves: HumanCandidate[];
  /** How long it took, request to answer. */
  ms: number;
}

/** A human-like engine (the app's Maia worker): asked for candidates only when ready, never waited on to load. */
export interface HumanEngineLike {
  ready(): boolean;
  /** It won't be ready: its load failed, or its worker broke. */
  failed?(): boolean;
  /** `seed`: its draw from that seed (the same move on any device: BOSS_CHECK); none, a random one. */
  candidates(fen: string, rating: number, allowed: readonly string[] | null, opts: { temperature: number; topP: number; multipv: number; seed?: number }): Promise<HumanAnswer | null>;
}

/** What the brain did with the boss's last move (the admins' debug line). */
export interface BrainNote {
  brain: BossBrain;
  rating: number | null;
  /** The bridge band's share of Stockfish's moves, when there is one. */
  share?: number;
  /** Whose move was played. */
  by: "maia" | "stockfish";
  /** Its place in Maia's list (1: Maia's likeliest), when it was Maia's. */
  rank?: number;
  /** How many of Maia's moves the guard turned down first. */
  vetoed?: number;
  /** Maia's time for this move. */
  ms?: number;
  /**
   * Why Stockfish played it: Maia not loaded yet (or failed), too slow, every candidate vetoed, none of Maia's moves
   * allowed, the bridge band's share, the King's strike, or a power's follow-up its engine search scored (its best:
   * Wrangler's reply to the showdown's duel); or the last check replaced the pick (bossMoveFrom: a move he may not
   * play, whoever named it, swapped for his best allowed move); or the landing guard did (Alfil's Slam: the pick gave
   * away too much with the pieces down, swapped for the best of his top moves there); or his race brain did (Chub &
   * Chirp's Carrot Patch: a move better for the race, raceGuard).
   */
  why?: "not ready" | "failed" | "no answer" | "guard" | "none allowed" | "share" | "strike" | "power" | "replaced" | "landing" | "race" | "lock";
}

/** Within a guard: never more than maxLoss points, nor more than maxLogitLoss log-odds (a couple of points is always fine). */
export function withinBrainGuard(loss: { points: number; logit: number }, guard: BrainGuard): boolean {
  return loss.points <= guard.maxLoss && (loss.logit <= guard.maxLogitLoss || loss.points <= 2);
}

/** The guard a brain plays under (null: none). */
export function brainGuard(brain: BossBrain, s: Pick<BossBrainSettings, "light" | "full" | "strict"> = BOSS_BRAIN): BrainGuard | null {
  if (brain === "maia-light") return s.light;
  if (brain === "maia-full") return s.full;
  if (brain === "maia-strict") return s.strict;
  return null;
}

/**
 * The move a Maia brain plays, from Maia's answer and the boss's top-8 Stockfish search (`top`: the moves it may
 * play, scored), or null when Stockfish should play (`why` then says why).
 * - maia-raw: Maia's own draw.
 * - maia-light / maia-full / maia-strict: Maia's draw, then its likeliest other moves (at least minP, at most
 *   `candidates` tried in all), the first that the guard allows against the best of `top`. A move outside the top 8 is
 *   turned down: no extra search is made for it. None allowed by the guard: null, "guard" (Stockfish's best).
 * `allowed`: the moves a power leaves the boss (null: any); Maia was asked for those only, but nothing else is played.
 * No candidate of Maia's allowed at all: null, "none allowed" (today's Stockfish move).
 * `noGift` (a Battle Tower floor, maia-raw): a draw that gives away the queen or rook it moves (isGift) is drawn again from Maia's other
 * listed moves (redrawWithoutGift; `vetoed` 1); every listed move a gift: null, "guard" (Stockfish's best).
 */
export function humanBrainMove(
  brain: BossBrain,
  answer: HumanAnswer,
  top: readonly MoveScore[],
  allowed: readonly string[] | null,
  s: BossBrainSettings = BOSS_BRAIN,
  noGift: { fen: string; temperature: number; rng: Rng } | null = null,
): { move: string; rank?: number; vetoed: number } | { move: null; vetoed: number; why: "guard" | "none allowed" } {
  const ok = (m: string | null): m is string => !!m && (!allowed || allowed.includes(m));
  const rankOf = (m: string) => {
    const i = answer.moves.findIndex((c) => c.move === m);
    return i >= 0 ? { rank: i + 1 } : {};
  };
  if (brain === "stockfish") return { move: null, vetoed: 0, why: "none allowed" };
  if (brain === "maia-raw") {
    const m = ok(answer.best) ? answer.best : answer.moves.find((c) => ok(c.move))?.move ?? null;
    if (m && noGift && isGift(noGift.fen, m)) {
      const again = redrawWithoutGift(noGift.fen, answer.moves, (x) => ok(x) && x !== m, noGift.temperature, noGift.rng);
      return again ? { move: again, ...rankOf(again), vetoed: 1 } : { move: null, vetoed: 1, why: "guard" };
    }
    return m ? { move: m, ...rankOf(m), vetoed: 0 } : { move: null, vetoed: 0, why: "none allowed" };
  }
  const guard = brainGuard(brain, s)!;
  const tries: string[] = [];
  if (ok(answer.best)) tries.push(answer.best);
  for (const c of answer.moves) {
    if (tries.length >= s.candidates) break;
    if (c.p >= s.minP && ok(c.move) && !tries.includes(c.move)) tries.push(c.move);
  }
  if (!tries.length) return { move: null, vetoed: 0, why: "none allowed" };
  if (!top.length) return { move: null, vetoed: 0, why: "guard" };
  const best = Math.max(...top.map((m) => m.expected));
  let vetoed = 0;
  for (const m of tries) {
    const scored = top.find((t) => t.move === m);
    if (scored && withinBrainGuard(moveLoss(best, scored.expected), guard)) return { move: m, ...rankOf(m), vetoed };
    vetoed++;
  }
  return { move: null, vetoed, why: "guard" };
}

/** The answer, or null once `ms` have passed (or it failed). */
export function within<T>(p: Promise<T | null>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), Math.max(0, ms));
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
    );
  });
}

/** A brain's guard in a few words ("no guard", "light guard"…). */
export const GUARD_WORDS: Record<BossBrain, string> = {
  stockfish: "Stockfish",
  "maia-raw": "no guard",
  "maia-light": "light guard",
  "maia-full": "full guard",
  "maia-strict": "strict guard",
};

/**
 * The words of the debug line: "Maia 1450 · no guard · Maia's #1 · 120 ms", "Maia 2400 · light guard · 20% Stockfish ·
 * guard → Maia's #2", "… guard → Stockfish", "… Stockfish (bridge share)".
 */
export function brainLine(n: BrainNote): string {
  const share = n.share ? ` · ${Math.round(n.share * 100)}% Stockfish` : "";
  const head = n.brain === "stockfish" || n.rating === null ? "Stockfish" : `Maia ${n.rating} · ${GUARD_WORDS[n.brain]}${share}`;
  const ms = n.ms !== undefined ? ` · ${Math.round(n.ms)} ms` : "";
  if (n.by === "maia") {
    const which = n.rank ? `Maia's #${n.rank}` : "Maia's";
    return `${head} · ${n.vetoed ? `guard → ${which}` : which}${ms}`;
  }
  if (n.brain === "stockfish") return head;
  const why: Record<NonNullable<BrainNote["why"]>, string> = {
    guard: "guard → Stockfish",
    "not ready": "Stockfish (Maia loading)",
    failed: "Stockfish (Maia failed)",
    strike: "Stockfish (the King's strike)",
    power: "Stockfish's best (power reply)",
    share: "Stockfish (bridge share)",
    "none allowed": "Stockfish (none of Maia's moves allowed)",
    "no answer": "Stockfish (Maia too slow)",
    replaced: "pick replaced (not allowed)",
    landing: "landing guard → Stockfish",
    race: "race brain → Stockfish",
    lock: "lock-on → Stockfish",
  };
  return `${head} · ${why[n.why ?? "no answer"]}${ms}`;
}
