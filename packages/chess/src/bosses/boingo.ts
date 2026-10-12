/**
 * Boingo the Clown (BOSS_ROSTER "clown"): his rules. His passive, the pie, splats an empty square near the centre for a
 * few turns (nobody, either side, may move onto it), up to two at once; his ultimate, the funhouse, turns the board
 * round in steps (Eric, Oct 11): upside down, a quarter turn to one side, a half turn to the other side, then back where
 * it started. No move is played for the crowd: it plays its own on the turned board. Numbers: BOSS_POWERS.pie*,
 * funhouseStepTurns. His art and moments are the app's (characters/clown.ts, the pie in characters/effects/).
 */
import { BOSS_POWERS, type BossPowerState, type BossState } from "@chessroyale/core";
import { legalMoves, pieceAt } from "../rules.ts";
import { powerRoll, to, turnOf, warnThenUnleash, type BossRules } from "./base.ts";

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const BOINGO_FX = { pie: 2300, funhouse: 4300, spin: 2600 } as const;

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

const CENTRE = ["d4", "e4", "d5", "e5", "c3", "d3", "e3", "f3", "c4", "f4", "c5", "f5", "c6", "d6", "e6", "f6"];
const centreDistance = (sq: string) => Math.abs(sq.charCodeAt(0) - 100.5) + Math.abs(Number(sq[1]) - 4.5);

/**
 * Pie: the square to pie, an empty one near the centre chosen so the position barely changes: the fewest moves of
 * either side can land there right now (none, if possible), nearest the middle first, a pick from the best few. Never a
 * square already pied (`taken`).
 */
export function choosePie(fen: string, seed: number, turn: number, taken: readonly string[] = []): string | null {
  const reach = new Map<string, number>();
  for (const m of [...legalMoves(fen), ...movesOfOther(fen)]) reach.set(to(m), (reach.get(to(m)) ?? 0) + 1);
  const empty = CENTRE.filter((sq) => !pieceAt(fen, sq) && !taken.includes(sq))
    .map((sq) => ({ sq, reach: reach.get(sq) ?? 0, d: centreDistance(sq) }))
    .sort((a, b) => a.reach - b.reach || a.d - b.d || (a.sq < b.sq ? -1 : 1));
  if (!empty.length) return null;
  const least = empty.filter((e) => e.reach === empty[0]!.reach).slice(0, 4);
  return least[Math.floor(powerRoll(seed, "pie", turn) * least.length)]!.sq;
}

/** The pied squares now (none: an empty list). */
export const piedSquares = (boss: Pick<BossState, "powers"> | null | undefined): string[] => (boss?.powers?.pies ?? []).map((p) => p.square);

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

/** Boingo: pies on squares near the centre (nobody moves onto them), and the funhouse turning the board round. */
export const BOINGO: BossRules = {
  id: "clown",
  wearOff(next, t) {
    // Each pie after its turns.
    if (next.pies?.length) next.pies = next.pies.filter((p) => p.until >= t.turn);
  },
  ultimate(next, t) {
    const now = warnThenUnleash(next, t);
    if (now) {
      // (The side of its quarter turn, from the seed: the same on every screen.)
      next.funhouse = { turn: t.turn, side: powerRoll(t.seed, "funhouse-side", t.turn) < 0.5 ? 90 : 270 };
      t.events.push({ kind: "funhouse", turn: t.turn });
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
  // A pie every pieEvery turns while fewer than pieMax are on the board, each for pieTurns.
  passive(next, t) {
    const pies = next.pies ?? [];
    if (t.turn < next.nextPassive || pies.length >= t.s.pieMax) return;
    const square = choosePie(t.fen, t.seed, t.turn, pies.map((p) => p.square));
    if (square) {
      next.pies = [...pies, { square, until: t.turn + t.s.pieTurns - 1 }];
      t.events.push({ kind: "pie", turn: t.turn, square });
      next.nextPassive = t.turn + t.s.pieEvery;
    } else next.nextPassive = t.turn + 1;
  },
  // Nobody can move onto a pie, the boss included.
  crowdFilter(allowed, boss) {
    const pied = piedSquares(boss);
    return pied.length ? allowed.filter((m) => !pied.includes(to(m))) : allowed;
  },
  bossStops(boss) {
    const pied = piedSquares(boss);
    return pied.length ? (m) => pied.includes(to(m)) : null;
  },
  powerTurn: (boss) => piedSquares(boss).length > 0 || boardAngle(boss) !== 0,
};
