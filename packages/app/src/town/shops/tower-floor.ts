/**
 * The Battle Tower's floor room as a flow (PR 11b, Eric, Nov 19: "you walk into the battle tower, you talk to the clerk, you start a
 * match. After the round ends, it's like a victory or defeat screen ... And then it takes you back. And then you stand there and wait
 * in the room. And then the next, you go up whatever the elevator, you go to the next floor and then you continue on."). Pure: where
 * everyone stands, and when, as the floor's bosses come out of the elevator one after another and walk to their marks; the scene
 * (tower-scene.ts) draws it and the town (Town.tsx) walks you. Tested in packages/app/test/tower-floor.test.ts.
 */
import { CHALLENGE_FEEL } from "./challenge.ts";

/** Squares (a square's middle on its whole number): the room is 10 x 10, its battle circle's middle between columns and rows 4 and 5. */
export interface At {
  readonly c: number;
  readonly r: number;
}

export const TOWER_FLOOR_FEEL = {
  /** Just inside the way in this long (the room's fade-in, then a beat) before you walk to your mark (the challenge's). */
  insideMs: CHALLENGE_FEEL.insideMs,
  /** A square's walk, yours and the bosses' (the challenge's slow walk). */
  stepMs: CHALLENGE_FEEL.walkStepMs,
  /** The last half square onto your mark's middle (the challenge's). */
  settleMs: CHALLENGE_FEEL.settleMs,
  /** The first boss steps out of the elevator this long after you start walking; each next one this much later. */
  firstMs: 300,
  gapMs: 800,
  /** A boss shows in the elevator's doorway over this long (ms) as he steps out. */
  showMs: 250,
  /** The doors open this long before the first boss steps out, and close this long after the last one is clear of them. */
  doorsMs: 300,
  /** Everyone on their marks: this long, then the pieces come up on the board over `boardMs`, then held `holdMs` before the match. */
  beatMs: 400,
  boardMs: 450,
  holdMs: 600,
  /** Into the board (the town's own zoom on a door, on the room's canvas), then black, then the match. */
  zoomMs: 650,
  zoom: 2.4,
  /**
   * The floor arrow to the next door (Eric, Nov 21: "a little like 3D blinking arrow ... right on the floor, right in front of the door"):
   * one blink this long (ms), dimmed to `arrowLow` and nudged `arrowNudge` squares toward the door at its middle; `arrowLen` squares long,
   * its head `arrowHead` wide and `arrowHeadLen` long, its shaft `arrowShaft` wide; its slab `arrowLift` squares thick.
   */
  arrowBlinkMs: 1000,
  arrowLow: 0.3,
  arrowNudge: 0.12,
  arrowLen: 1.3,
  arrowHead: 1.1,
  arrowHeadLen: 0.6,
  arrowShaft: 0.44,
  arrowLift: 0.16,
} as const;

/** The table: on the battle circle's middle. */
export const FLOOR_TABLE: At = { c: 4.5, r: 4.5 };
/** Your mark (south of the table, facing it, as a challenge's "facing" layout): the square you walk to, and the half square on. */
export const FLOOR_YOU = { sq: { c: 4, r: 7 }, at: { c: 4.5, r: 7 } } as const;
/** Where a boss shows: in the elevator's doorway (the back wall's columns 4-5), just out of its doors. */
export const FLOOR_DOOR: At = { c: 4.5, r: 0.7 };

/** The bosses' marks on the far side of the table, in their turn order (1, 2 or 3, spread across it). */
export function bossMarks(n: number): At[] {
  if (n <= 1) return [{ c: 4.5, r: 2.0 }];
  if (n === 2)
    return [
      { c: 3.3, r: 2.2 },
      { c: 5.7, r: 2.2 },
    ];
  return [
    { c: 2.6, r: 2.6 },
    { c: 4.5, r: 2.0 },
    { c: 6.4, r: 2.6 },
  ];
}

/**
 * A party's others' marks (Nov 20: "everyone's pawn walks in in seat order"): beside yours on your side of the table, in the order they
 * walk in (seat order), and where they come in (the way in, below).
 */
export const MATE_MARKS: readonly At[] = [
  { c: 3.0, r: 7.35 },
  { c: 6.0, r: 7.35 },
  { c: 4.5, r: 8.3 },
];
export const FLOOR_IN: At = { c: 4.5, r: 9.4 };

/** When each part of a floor's walk-in happens (ms from the room's first frame), for `n` bosses. Reduced motion: everyone on their marks. */
export interface FloorTimes {
  /** You start walking to your mark (and you're on it, settled). */
  youGo: number;
  youOn: number;
  /** Each boss steps out, and is on his mark. */
  bossGo: number[];
  bossOn: number[];
  /** The elevator's doors open and close round the bosses' coming out (open: `doorsOpen` <= t < `doorsShut`). */
  doorsOpen: number;
  doorsShut: number;
  /** The pieces start coming up on the board; the match starts (the zoom into the board). */
  board: number;
  go: number;
  /** A party's others (Nov 20): each starts walking in after you, one after another, and is on their mark. */
  mateGo: number[];
  mateOn: number[];
}

const dist = (a: At, b: At) => Math.hypot(a.c - b.c, a.r - b.r);

/** The floor's walk-in times: `youSteps`, the squares you walk from the way in to your mark. */
export function floorTimes(n: number, youSteps: number, still: boolean, F = TOWER_FLOOR_FEEL, mates = 0): FloorTimes {
  const marks = bossMarks(n);
  const them = MATE_MARKS.slice(0, Math.max(0, Math.min(mates, MATE_MARKS.length)));
  if (still) {
    // (Reduced motion: nobody walks; everyone stands on their marks as the room shows, and the pieces come up.)
    const board = F.insideMs;
    return { youGo: 0, youOn: 0, bossGo: marks.map(() => 0), bossOn: marks.map(() => 0), doorsOpen: 0, doorsShut: 0, board, go: board + F.boardMs + F.holdMs, mateGo: them.map(() => 0), mateOn: them.map(() => 0) };
  }
  const youGo = F.insideMs;
  const youOn = youGo + youSteps * F.stepMs + F.settleMs;
  const bossGo = marks.map((_, i) => youGo + F.firstMs + i * F.gapMs);
  const bossOn = marks.map((m, i) => bossGo[i]! + dist(FLOOR_DOOR, m) * F.stepMs);
  const doorsOpen = bossGo[0]! - F.doorsMs;
  // (Clear of the doors: a square out.)
  const doorsShut = bossGo[bossGo.length - 1]! + F.stepMs + F.doorsMs;
  // (Your party in after you, in seat order, one a step apart: Nov 20.)
  const mateGo = them.map((_, i) => youGo + (i + 1) * F.stepMs);
  const mateOn = them.map((m, i) => mateGo[i]! + dist(FLOOR_IN, m) * F.stepMs);
  const board = Math.max(youOn, ...bossOn, ...mateOn) + F.beatMs;
  return { youGo, youOn, bossGo, bossOn, doorsOpen, doorsShut, board, go: board + F.boardMs + F.holdMs, mateGo, mateOn };
}

/**
 * Party member `i` (of the others, in seat order) at `t` ms: below the way in until they set off, walking straight to their mark, then on
 * it. `times` null (back from a match, or reduced motion): on their mark.
 */
export function mateAt(i: number, times: FloorTimes | null, t: number, out: BossNow): BossNow {
  const m = MATE_MARKS[i] ?? MATE_MARKS[0]!;
  const go = times?.mateGo[i];
  const on = times?.mateOn[i];
  if (go === undefined || on === undefined || on <= go || t >= on) return Object.assign(out, { c: m.c, r: m.r, a: 1, walking: false });
  if (t < go) return Object.assign(out, { c: FLOOR_IN.c, r: FLOOR_IN.r, a: 0, walking: false });
  const u = (t - go) / (on - go);
  return Object.assign(out, { c: FLOOR_IN.c + (m.c - FLOOR_IN.c) * u, r: FLOOR_IN.r + (m.r - FLOOR_IN.r) * u, a: 1, walking: true });
}

/** A boss now: where he stands (squares), how much of him shows (0-1: stepping out of the doorway), whether he's walking. */
export interface BossNow {
  c: number;
  r: number;
  a: number;
  walking: boolean;
}

/** Boss `i` of `n` at `t` ms (the floor's times): in the doorway, walking straight to his mark, then on it. Before he steps out: unseen. */
export function bossAt(i: number, n: number, t: number, times: FloorTimes, out: BossNow, F = TOWER_FLOOR_FEEL): BossNow {
  const m = bossMarks(n)[i]!;
  const go = times.bossGo[i]!;
  const on = times.bossOn[i]!;
  if (on <= go || t >= on) return Object.assign(out, { c: m.c, r: m.r, a: 1, walking: false });
  if (t < go) return Object.assign(out, { c: FLOOR_DOOR.c, r: FLOOR_DOOR.r, a: 0, walking: false });
  const u = (t - go) / (on - go);
  return Object.assign(out, { c: FLOOR_DOOR.c + (m.c - FLOOR_DOOR.c) * u, r: FLOOR_DOOR.r + (m.r - FLOOR_DOOR.r) * u, a: Math.min(1, (t - go) / F.showMs), walking: true });
}

/** How far the pieces have come up on the board at `t` (0-1). */
export const piecesAt = (t: number, times: FloorTimes, F = TOWER_FLOOR_FEEL): number => Math.max(0, Math.min(1, (t - times.board) / F.boardMs));

/**
 * The floor room's state (the town's): `fight`, the floor's bosses walking in to a match; `won`, back after a floor the climb goes on from
 * (a win, or a loss, draw or counted leave with a life spent: Nov 20), the elevator open to the next floor; `out`, back after the run ended
 * (a loss with no life left, or the top), the elevator shut: down to the lobby.
 */
export type FloorMode = "fight" | "won" | "out";

/**
 * The floor arrow (Nov 21): after a floor, on the floor right in front of the door you go through next, pointing at it: the elevator, up
 * to the next floor (`won`), or the way down to the lobby (`out`: the run over, the elevator shut). Its middle (squares) and which way it
 * points along the rows (-1 north, to the back wall; 1 south). None during a fight. Gone as you go through: the room goes with you.
 */
export interface FloorArrow {
  readonly to: "top" | "front";
  readonly c: number;
  readonly r: number;
  readonly dir: -1 | 1;
}
const ARROW_UP: FloorArrow = { to: "top", c: 4.5, r: 1.3, dir: -1 };
const ARROW_DOWN: FloorArrow = { to: "front", c: 4.5, r: 7.8, dir: 1 };
export const floorArrow = (mode: FloorMode): FloorArrow | null => (mode === "won" ? ARROW_UP : mode === "out" ? ARROW_DOWN : null);
/** The arrow's blink at `t` ms (from the room's first frame): how opaque it is, and how far (squares) it's nudged toward the door. Into `out`. */
export function arrowBlink(t: number, still: boolean, out: { a: number; nudge: number }, F = TOWER_FLOOR_FEEL): { a: number; nudge: number } {
  // (Reduced motion: held, full.)
  const u = still ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * Math.max(0, t)) / F.arrowBlinkMs);
  out.a = 1 - (1 - F.arrowLow) * u;
  out.nudge = F.arrowNudge * u;
  return out;
}

/** The elevator's card in the floor room: up to the next floor once a floor's won; shut otherwise (greyed, nothing hidden). */
export function upWords(mode: FloorMode, floor: number): { word: string; on: boolean; note: string | null } {
  if (mode === "won") return { word: `Up to floor ${floor + 1}`, on: true, note: null };
  return { word: "Up", on: false, note: mode === "out" ? "Your run is over. Talk to the clerk downstairs to start a new one." : "Win this floor first." };
}
