import { Chess } from "chess.js";
import { RANKED_1V1, duelControl, isDuelZone, votedControl, type DuelControl, type DuelZone } from "@chessroyale/core";
import { START_FEN } from "../rules.ts";

/**
 * Ranked 1 v 1's game (pure: the server's game object and the app's bot game both play by it; docs/areas/ranked.md).
 * Normal chess between two players with real clocks, after a five-second vote on the time control:
 *   - vote → overlay ("Timer: Blitz 3+2") → play → over;
 *   - each first move has RANKED_1V1.firstMoveSeconds, untimed (the clocks start after Black's first move, as on the
 *     big chess sites); a first move that doesn't come aborts the game: no result, no rank change;
 *   - after that a Fischer clock: the mover's thinking comes off their clock and the increment goes on after the move;
 *   - the game ends by checkmate, resignation, time (a loss, but a draw when the side still on time can't mate),
 *     stalemate, threefold repetition, the 50-move rule, not enough material, or a draw both agree to.
 * Time comes in as `now` on every call; `tick` moves the game on when nothing else happens (the vote closing, the
 * start, a flag, a first move that never came), and `nextDeadline` says when it should next be called.
 */

export type Color = "w" | "b";
export const other = (c: Color): Color => (c === "w" ? "b" : "w");

export type DuelPhase = "vote" | "overlay" | "play" | "over";
export type DuelResult = "1-0" | "0-1" | "1/2-1/2" | "aborted";
export type DuelReason =
  | "checkmate"
  | "resign"
  | "timeout"
  /** The flag fell, but the side still on time couldn't mate: a draw. */
  | "timeout_vs_insufficient"
  | "stalemate"
  | "repetition"
  | "fifty_moves"
  | "insufficient_material"
  | "agreement"
  /** A player left (or pressed Abort) before both had made their first move. */
  | "abort"
  /** A first move didn't come in time. */
  | "no_first_move"
  /** The two players weren't both there in time (the room's, before the vote). */
  | "no_show";

export interface DuelEnd {
  result: DuelResult;
  reason: DuelReason;
  /** Who it's about: the one who resigned, ran out of time, aborted, or didn't make their first move. */
  by: Color | null;
  /** When it ended (a flag: the moment the clock reached zero, not when it was noticed). */
  at: number;
}

export interface DuelState {
  phase: DuelPhase;
  /** The vote: when it opens and closes, and each player's zone (null: no pick yet). */
  voteAt: number;
  voteEndsAt: number;
  picks: Record<Color, DuelZone | null>;
  /** The control the vote gave (its id), from the vote's close. */
  control: string | null;
  /** A test's own clock (seconds for each side, no increment), whatever the vote says. */
  testSeconds: number | null;
  /** When play begins (after the overlay): White's first move window starts here. */
  startsAt: number | null;
  fen: string;
  /** The moves (UCI and SAN), and how long each mover took (ms, the server's own times). */
  moves: string[];
  sans: string[];
  times: number[];
  /** How often each position has stood (board, side to move, castling, en passant): threefold repetition. */
  reps: Record<string, number>;
  /** Each side's time left (ms) as of `turnAt`; the side to move's runs from there once the clocks run. */
  clocks: Record<Color, number>;
  /** When the side to move's turn began. */
  turnAt: number;
  /** A draw offer standing, from this side. */
  drawOffer: Color | null;
  /** A side offers again only once it has made this many moves (after a declined or lapsed offer). */
  drawAfter: Record<Color, number>;
  end: DuelEnd | null;
}

export interface DuelRules {
  voteMs: number;
  overlayMs: number;
  firstMoveMs: number;
  drawOfferEveryMoves: number;
}

export const duelRules = (s = RANKED_1V1): DuelRules => ({
  voteMs: s.voteSeconds * 1000,
  overlayMs: s.overlayMs,
  firstMoveMs: s.firstMoveSeconds * 1000,
  drawOfferEveryMoves: s.drawOfferEveryMoves,
});

/** The position's key for repetition: the board, the side to move, castling and en passant (chess.js names it only when it can be taken). */
const repKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

/** A new game whose vote opens at `voteAt`. `testSeconds`: a test's clock (each side, no increment). */
export function newDuel(voteAt: number, opts: { testSeconds?: number | null } = {}, rules: DuelRules = duelRules()): DuelState {
  return {
    phase: "vote",
    voteAt,
    voteEndsAt: voteAt + rules.voteMs,
    picks: { w: null, b: null },
    control: null,
    testSeconds: opts.testSeconds && opts.testSeconds > 0 ? Math.round(opts.testSeconds) : null,
    startsAt: null,
    fen: START_FEN,
    moves: [],
    sans: [],
    times: [],
    reps: { [repKey(START_FEN)]: 1 },
    clocks: { w: 0, b: 0 },
    turnAt: voteAt,
    drawOffer: null,
    drawAfter: { w: 0, b: 0 },
    end: null,
  };
}

/** The control a game plays (a test's clock as a control with no increment). */
export function gameControl(s: DuelState): DuelControl {
  const c = duelControl(s.control);
  return s.testSeconds ? { ...c, baseSeconds: s.testSeconds, incrementSeconds: 0 } : c;
}

export const sideToMoveOf = (s: Pick<DuelState, "moves">): Color => (s.moves.length % 2 === 0 ? "w" : "b");
/** The clocks run once both first moves are made. */
export const clocksRun = (s: Pick<DuelState, "phase" | "moves">) => s.phase === "play" && s.moves.length >= 2;
/** Moves a side has made. */
export const movesBy = (s: Pick<DuelState, "moves">, c: Color) => (c === "w" ? Math.ceil(s.moves.length / 2) : Math.floor(s.moves.length / 2));

/** A side's time left at `now` (its clock runs only on its own turn, once the clocks run). */
export function clockLeft(s: DuelState, c: Color, now: number): number {
  if (!clocksRun(s) || sideToMoveOf(s) !== c) return s.clocks[c];
  return Math.max(0, s.clocks[c] - Math.max(0, now - s.turnAt));
}

/** Until when the side to move may make its first move (null once both have, or outside play). */
export function firstMoveBy(s: DuelState, rules: DuelRules = duelRules()): number | null {
  if (s.phase !== "play" || s.moves.length >= 2) return null;
  return s.turnAt + rules.firstMoveMs;
}

/** Abort, rather than resign: before both players have made their first move (the vote and the overlay included). */
export const canAbort = (s: DuelState) => s.phase !== "over" && s.moves.length < 2;

function finish(s: DuelState, result: DuelResult, reason: DuelReason, by: Color | null, at: number): DuelState {
  return { ...s, phase: "over", end: { result, reason, by, at }, drawOffer: null };
}

const winFor = (c: Color): DuelResult => (c === "w" ? "1-0" : "0-1");

/**
 * Whether a side could still mate if the game went on (for a flag: the side still on time). The simple rule: a lone
 * king, or a king with one knight or one bishop and nothing else, can't; anything more can.
 */
export function canMate(fen: string, c: Color): boolean {
  const board = fen.split(" ")[0]!;
  const mine = [...board].filter((ch) => /[a-z]/i.test(ch) && (c === "w" ? ch === ch.toUpperCase() : ch === ch.toLowerCase())).map((ch) => ch.toLowerCase());
  const extra = mine.filter((p) => p !== "k");
  if (extra.length === 0) return false;
  return !(extra.length === 1 && (extra[0] === "n" || extra[0] === "b"));
}

/**
 * Moves the game on to `now`: the vote closes (the control from both picks: votedControl), play begins after the
 * overlay, a first move that didn't come aborts, a flag falls. Anything that acts on the game calls this first, so
 * a move after the flag is never played.
 */
export function tick(s: DuelState, now: number, rules: DuelRules = duelRules()): DuelState {
  let g = s;
  if (g.phase === "vote" && now >= g.voteEndsAt) {
    const control = votedControl(g.picks.w, g.picks.b);
    const ms = (g.testSeconds ?? control.baseSeconds) * 1000;
    g = { ...g, phase: "overlay", control: control.id, clocks: { w: ms, b: ms }, startsAt: g.voteEndsAt + rules.overlayMs };
  }
  if (g.phase === "overlay" && now >= g.startsAt!) g = { ...g, phase: "play", turnAt: g.startsAt! };
  if (g.phase !== "play") return g;
  const due = firstMoveBy(g, rules);
  if (due !== null && now >= due) return finish(g, "aborted", "no_first_move", sideToMoveOf(g), due);
  if (clocksRun(g)) {
    const c = sideToMoveOf(g);
    const flagAt = g.turnAt + g.clocks[c];
    if (now >= flagAt) {
      const them = other(c);
      return canMate(g.fen, them)
        ? finish({ ...g, clocks: { ...g.clocks, [c]: 0 } }, winFor(them), "timeout", c, flagAt)
        : finish({ ...g, clocks: { ...g.clocks, [c]: 0 } }, "1/2-1/2", "timeout_vs_insufficient", c, flagAt);
    }
  }
  return g;
}

/** When `tick` next has something to do (null: nothing until someone acts, or the game is over). */
export function nextDeadline(s: DuelState, rules: DuelRules = duelRules()): number | null {
  if (s.phase === "vote") return s.voteEndsAt;
  if (s.phase === "overlay") return s.startsAt;
  if (s.phase !== "play") return null;
  const due = firstMoveBy(s, rules);
  if (due !== null) return due;
  return s.turnAt + s.clocks[sideToMoveOf(s)];
}

export type Refusal = "phase" | "turn" | "illegal" | "over";
export type Acted = { ok: true; state: DuelState } | { ok: false; reason: Refusal; state: DuelState };

/** A pick in the vote (it can change until time's up). Anything but a zone is ignored. */
export function pick(s0: DuelState, c: Color, zone: unknown, now: number, rules: DuelRules = duelRules()): Acted {
  const s = tick(s0, now, rules);
  if (s.phase !== "vote") return { ok: false, reason: "phase", state: s };
  if (!isDuelZone(zone)) return { ok: false, reason: "illegal", state: s };
  return { ok: true, state: { ...s, picks: { ...s.picks, [c]: zone } } };
}

/**
 * A move (UCI) by `c`. It must be their turn and legal (a promotion names its piece). The mover's thinking comes off
 * their clock once the clocks run, and the increment goes on. Then the game's end, if it has come.
 */
export function move(s0: DuelState, c: Color, uci: unknown, now: number, rules: DuelRules = duelRules()): Acted & { san?: string } {
  const s = tick(s0, now, rules);
  if (s.phase === "over") return { ok: false, reason: "over", state: s };
  if (s.phase !== "play") return { ok: false, reason: "phase", state: s };
  if (sideToMoveOf(s) !== c) return { ok: false, reason: "turn", state: s };
  if (typeof uci !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return { ok: false, reason: "illegal", state: s };
  const chess = new Chess(s.fen);
  let played: ReturnType<Chess["move"]>;
  try {
    played = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return { ok: false, reason: "illegal", state: s };
  }
  if (played.from + played.to + (played.promotion ?? "") !== uci) return { ok: false, reason: "illegal", state: s };
  const thought = Math.max(0, now - s.turnAt);
  const timed = clocksRun(s);
  const control = gameControl(s);
  const clocks = timed ? { ...s.clocks, [c]: Math.max(0, s.clocks[c] - thought) + control.incrementSeconds * 1000 } : s.clocks;
  const fen = chess.fen();
  const key = repKey(fen);
  const reps = { ...s.reps, [key]: (s.reps[key] ?? 0) + 1 };
  // The receiver of a draw offer moving declines it (it lapses); its maker waits before offering again.
  const lapsed = s.drawOffer !== null && s.drawOffer !== c;
  const offerer = s.drawOffer;
  let g: DuelState = {
    ...s,
    fen,
    moves: [...s.moves, uci],
    sans: [...s.sans, played.san],
    times: [...s.times, thought],
    reps,
    clocks,
    turnAt: now,
    drawOffer: lapsed ? null : s.drawOffer,
    drawAfter: lapsed && offerer ? { ...s.drawAfter, [offerer]: movesBy(s, offerer) + rules.drawOfferEveryMoves } : s.drawAfter,
  };
  if (chess.isCheckmate()) g = finish(g, winFor(c), "checkmate", other(c), now);
  else if (chess.isStalemate()) g = finish(g, "1/2-1/2", "stalemate", null, now);
  else if (chess.isInsufficientMaterial()) g = finish(g, "1/2-1/2", "insufficient_material", null, now);
  else if (reps[key]! >= 3) g = finish(g, "1/2-1/2", "repetition", null, now);
  else if (Number(fen.split(" ")[4]) >= 100) g = finish(g, "1/2-1/2", "fifty_moves", null, now);
  return { ok: true, state: g, san: played.san };
}

/** Resigning: a loss once both have made their first move; before that, it's an abort (no result). */
export function resign(s0: DuelState, c: Color, now: number, rules: DuelRules = duelRules()): Acted {
  const s = tick(s0, now, rules);
  if (s.phase === "over") return { ok: false, reason: "over", state: s };
  if (canAbort(s)) return { ok: true, state: finish(s, "aborted", "abort", c, now) };
  return { ok: true, state: finish(s, winFor(other(c)), "resign", c, now) };
}

/** Whether `c` may offer a draw now (none pending from them, and they've made enough moves since a declined one). */
export function canOfferDraw(s: DuelState, c: Color): boolean {
  return s.phase === "play" && s.moves.length >= 2 && s.drawOffer === null && movesBy(s, c) >= s.drawAfter[c];
}

/** Offering a draw; or, with the other side's offer standing, accepting it (a draw by agreement). */
export function offerDraw(s0: DuelState, c: Color, now: number, rules: DuelRules = duelRules()): Acted {
  const s = tick(s0, now, rules);
  if (s.phase === "over") return { ok: false, reason: "over", state: s };
  if (s.drawOffer === other(c)) return { ok: true, state: finish(s, "1/2-1/2", "agreement", null, now) };
  if (!canOfferDraw(s, c)) return { ok: false, reason: "phase", state: s };
  return { ok: true, state: { ...s, drawOffer: c } };
}

/** Declining the other side's offer: it goes, and its maker waits RANKED_1V1.drawOfferEveryMoves moves to offer again. */
export function declineDraw(s0: DuelState, c: Color, now: number, rules: DuelRules = duelRules()): Acted {
  const s = tick(s0, now, rules);
  const them = other(c);
  if (s.phase !== "play" || s.drawOffer !== them) return { ok: false, reason: "phase", state: s };
  return { ok: true, state: { ...s, drawOffer: null, drawAfter: { ...s.drawAfter, [them]: movesBy(s, them) + rules.drawOfferEveryMoves } } };
}

/** Ends a game from outside the rules (the room: nobody turned up, "no_show"): no result. */
export function callOff(s: DuelState, reason: DuelReason, by: Color | null, now: number): DuelState {
  return s.phase === "over" ? s : finish(s, "aborted", reason, by, now);
}

/** A side's score in a finished game (1, ½ or 0), or null for an aborted one (or one still going). */
export function scoreOf(s: Pick<DuelState, "end">, c: Color): number | null {
  const r = s.end?.result;
  if (!r || r === "aborted") return null;
  if (r === "1/2-1/2") return 0.5;
  return (r === "1-0") === (c === "w") ? 1 : 0;
}
