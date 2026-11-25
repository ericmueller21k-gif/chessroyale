/**
 * How a resident plays a 1 v 1 game, as decisions: its vote, how long it thinks, when it resigns, offers or takes a draw, and what
 * its behavior does to a game (walk away, stall, never move). Pure: everything drawn with the `rng` it's given (RESIDENTS.duel).
 * Tested in packages/server/test/residents-program.test.ts.
 */
import { RESIDENTS, type DuelZone, type Rng } from "@chessroyale/core";
import { between, type Behavior, type Profile, type ResidentSettings } from "./profiles.ts";

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Material on the board for each side (pawn 1, knight and bishop 3, rook 5, queen 9), from a FEN. */
export function material(fen: string): { w: number; b: number } {
  const out = { w: 0, b: 0 };
  for (const c of fen.split(" ")[0] ?? "") {
    const v = VALUES[c.toLowerCase()];
    if (v === undefined) continue;
    if (c === c.toUpperCase()) out.w += v;
    else out.b += v;
  }
  return out;
}

/** How far `side` is ahead in material (negative: behind). */
export function materialEdge(fen: string, side: "w" | "b"): number {
  const m = material(fen);
  return side === "w" ? m.w - m.b : m.b - m.w;
}

/** The resident's vote: its favorite zone most of the time, now and then another. */
export function chooseZone(p: Profile, rng: Rng): DuelZone {
  if (rng() < 0.8) return p.zone;
  const zones: DuelZone[] = ["bullet", "blitz", "rapid"];
  return zones[Math.floor(rng() * zones.length)]!;
}

export interface ThinkInput {
  /** The move's place in the game (0: White's first). */
  ply: number;
  /** This side's clock left now (ms), and the increment (ms). */
  clockMs: number;
  incrementMs: number;
  inCheck: boolean;
  /** Maia's top two moves are close (a real choice to make). */
  close: boolean;
  behavior: Behavior;
}

/**
 * How long to think before moving (ms). The first moves come within RESIDENTS.duel.firstMoveMs (the 20 s rule); later ones spread the
 * clock over the moves likely left, plus most of the increment, scattered (a lognormal spread), quicker in the opening, slower in
 * check or with a close choice, a slow resident's slower still. Never under `minThinkMs`, and never past `safetyMs` before the flag,
 * except a slow resident now and then (`slowFlagChance`: it runs its clock down).
 */
export function thinkMs(x: ThinkInput, rng: Rng, s: ResidentSettings = RESIDENTS): number {
  const d = s.duel;
  if (x.ply < 2) return Math.round(between(rng, d.firstMoveMs[0], d.firstMoveMs[1]));
  const movesLeft = Math.max(d.minMovesLeft, d.movesLeft - Math.floor(x.ply / 2) * 0.5);
  let ms = x.clockMs / movesLeft + x.incrementMs * 0.8;
  // (A lognormal spread around it: most moves near, a few much longer, as people think.)
  const z = Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-9))) * Math.cos(2 * Math.PI * rng());
  ms *= Math.exp(0.6 * z - 0.18);
  if (x.ply < d.openingPlies) ms *= d.openingFactor;
  if (x.inCheck) ms *= d.checkFactor;
  if (x.close) ms *= d.closeFactor;
  if (x.behavior === "slow") {
    ms *= d.slowFactor;
    if (rng() < d.slowFlagChance) return Math.round(x.clockMs + 500);
  }
  const latest = x.clockMs - d.safetyMs;
  return Math.floor(Math.max(Math.min(d.minThinkMs, Math.max(0, latest)), Math.min(ms, latest)));
}

/** Whether to resign now: well behind in material, past the opening (a rage-quitter: sooner). */
export function shouldResign(edge: number, myMoves: number, behavior: Behavior, rng: Rng, s: ResidentSettings = RESIDENTS): boolean {
  const r = s.duel.resign;
  if (behavior === "rageQuit" && edge <= -r.rageLostBy && myMoves >= 4) return rng() < r.rageChance;
  return edge <= -r.lostBy && myMoves >= r.afterMove && rng() < r.chance;
}

/** Whether to offer a draw with this move: level material, a long game, rarely. */
export function shouldOfferDraw(edge: number, ply: number, rng: Rng, s: ResidentSettings = RESIDENTS): boolean {
  return Math.abs(edge) <= 1 && ply >= s.duel.draw.fromPly && rng() < s.duel.draw.offerChance;
}

/** Whether to take the other side's offer: level or behind, past `acceptFromPly`, about half the time. */
export function acceptsDraw(edge: number, ply: number, rng: Rng, s: ResidentSettings = RESIDENTS): boolean {
  return edge <= 1 && ply >= s.duel.draw.acceptFromPly && rng() < s.duel.draw.acceptChance;
}

/** What a resident's behavior does to one game, decided as it starts. */
export interface GamePlan {
  /** Never makes its first move (an AFK resident): the game is aborted, a dodge. */
  noShow: boolean;
  /** Stops moving after this many of its own moves (an AFK resident): it flags. */
  stallAfter: number | null;
  /** Closes the game and never comes back after this many of its own moves (a leaver): it flags while gone, a leave. */
  leaveAfter: number | null;
  /** The socket drops after this many of its own moves and comes back (any resident, `dropChance`). */
  dropAfter: number | null;
  /** Says hello at the start, and gg at the end. */
  greet: boolean;
  gg: boolean;
}

export function gamePlan(behavior: Behavior, rng: Rng, s: ResidentSettings = RESIDENTS): GamePlan {
  const d = s.duel;
  const afk = behavior === "afk";
  const noShow = afk && rng() < d.afkNoShow;
  const stallAfter = afk && !noShow && rng() < d.afkStall ? 5 + Math.floor(rng() * 20) : null;
  const leaveAfter = behavior === "leaver" && rng() < d.leaverChance ? 10 + Math.floor(rng() * 21) : null;
  const dropAfter = rng() < s.dropChance ? 3 + Math.floor(rng() * 25) : null;
  const chatty = behavior === "chatty";
  const greet = chatty && rng() < d.chat.greet;
  const gg = rng() < (chatty ? d.chat.gg : d.chat.normalGg);
  return { noShow, stallAfter, leaveAfter, dropAfter, greet, gg };
}

/** After a game: whether the session ends now (a rage-quitter after a loss). */
export const logsOffAfter = (behavior: Behavior, lost: boolean, rng: Rng, s: ResidentSettings = RESIDENTS) => behavior === "rageQuit" && lost && rng() < s.duel.rageLogOff;
