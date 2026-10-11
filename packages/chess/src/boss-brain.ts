/**
 * A boss's brain (BOSS_BRAIN in settings): how its move is chosen when a human-like engine (Maia-3, in its own worker,
 * spoken to over text by HumanUciEngine) is on offer. The boss's own top-8 Stockfish search stays the referee: the
 * guarded brains veto from it, and every fallback is today's Stockfish move.
 */
import { BOSS_BRAIN, type BossBrain, type BossBrainSettings, type BrainGuard } from "@chessroyale/core";
import { moveLoss } from "./bosses/base.ts";
import type { MoveScore } from "./uci.ts";

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
  candidates(fen: string, rating: number, allowed: readonly string[] | null, opts: { temperature: number; topP: number; multipv: number }): Promise<HumanAnswer | null>;
}

/** What the brain did with the boss's last move (the admins' debug line). */
export interface BrainNote {
  brain: BossBrain;
  rating: number | null;
  /** Whose move was played. */
  by: "maia" | "stockfish";
  /** Its place in Maia's list (1: Maia's likeliest), when it was Maia's. */
  rank?: number;
  /** How many of Maia's moves the guard turned down first. */
  vetoed?: number;
  /** Maia's time for this move. */
  ms?: number;
  /** Why Stockfish played it: Maia not loaded yet (or failed), too slow, every candidate vetoed, or the King's strike. */
  why?: "not ready" | "failed" | "no answer" | "guard" | "strike";
}

/** Within a guard: never more than maxLoss points, nor more than maxLogitLoss log-odds (a couple of points is always fine). */
export function withinBrainGuard(loss: { points: number; logit: number }, guard: BrainGuard): boolean {
  return loss.points <= guard.maxLoss && (loss.logit <= guard.maxLogitLoss || loss.points <= 2);
}

/** The guard a brain plays under at a rating (null: none). */
export function brainGuard(brain: BossBrain, rating: number, s: BossBrainSettings = BOSS_BRAIN): BrainGuard | null {
  if (brain === "maia-light") return s.light;
  if (brain === "maia-full") return rating >= s.strictFrom ? s.strict : s.full;
  return null;
}

/**
 * The move a Maia brain plays, from Maia's answer and the boss's top-8 Stockfish search (`top`: the moves it may
 * play, scored), or null when Stockfish should play (`why` then says so).
 * - maia-raw: Maia's own draw.
 * - maia-light / maia-full: Maia's draw, then its likeliest other moves (at least minP, at most `candidates` tried
 *   in all), the first that the guard allows against the best of `top`. A move outside the top 8 is turned down: no
 *   extra search is made for it. None allowed: null (Stockfish's best).
 * `allowed`: the moves a power leaves the boss (null: any); Maia was asked for those only, but nothing else is played.
 */
export function humanBrainMove(
  brain: BossBrain,
  rating: number,
  answer: HumanAnswer,
  top: readonly MoveScore[],
  allowed: readonly string[] | null,
  s: BossBrainSettings = BOSS_BRAIN,
): { move: string; rank?: number; vetoed: number } | { move: null; vetoed: number } {
  const ok = (m: string | null): m is string => !!m && (!allowed || allowed.includes(m));
  const rankOf = (m: string) => {
    const i = answer.moves.findIndex((c) => c.move === m);
    return i >= 0 ? { rank: i + 1 } : {};
  };
  if (brain === "maia-raw" || brain === "stockfish") {
    if (brain === "stockfish") return { move: null, vetoed: 0 };
    const m = ok(answer.best) ? answer.best : answer.moves.find((c) => ok(c.move))?.move ?? null;
    return m ? { move: m, ...rankOf(m), vetoed: 0 } : { move: null, vetoed: 0 };
  }
  const guard = brainGuard(brain, rating, s)!;
  if (!top.length) return { move: null, vetoed: 0 };
  const best = Math.max(...top.map((m) => m.expected));
  const tries: string[] = [];
  if (ok(answer.best)) tries.push(answer.best);
  for (const c of answer.moves) {
    if (tries.length >= s.candidates) break;
    if (c.p >= s.minP && ok(c.move) && !tries.includes(c.move)) tries.push(c.move);
  }
  let vetoed = 0;
  for (const m of tries) {
    const scored = top.find((t) => t.move === m);
    if (scored && withinBrainGuard(moveLoss(best, scored.expected), guard)) return { move: m, ...rankOf(m), vetoed };
    vetoed++;
  }
  return { move: null, vetoed };
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

/** The words of the debug line: "Maia 1450 · Maia's #1 · 120 ms", "Maia 1450 · guard → Maia's #2", "… guard → Stockfish". */
export function brainLine(n: BrainNote): string {
  const head = n.brain === "stockfish" || n.rating === null ? "Stockfish" : `Maia ${n.rating} · ${n.brain === "maia-raw" ? "no guard" : n.brain === "maia-light" ? "light guard" : "full guard"}`;
  const ms = n.ms !== undefined ? ` · ${Math.round(n.ms)} ms` : "";
  if (n.by === "maia") {
    const which = n.rank ? `Maia's #${n.rank}` : "Maia's";
    return `${head} · ${n.vetoed ? `guard → ${which}` : which}${ms}`;
  }
  if (n.brain === "stockfish") return head;
  const why =
    n.why === "guard"
      ? "guard → Stockfish"
      : n.why === "not ready"
        ? "Stockfish (Maia loading)"
        : n.why === "failed"
          ? "Stockfish (Maia failed)"
          : n.why === "strike"
            ? "Stockfish (the King's strike)"
            : "Stockfish (Maia too slow)";
  return `${head} · ${why}${ms}`;
}
