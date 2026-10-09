import { LIVE_WINDOW } from "@chessroyale/core";
import { START_FEN, applyMove } from "@chessroyale/chess";

/**
 * Bot-match replays for the home page's live window (DECISIONS.md, "The live window"): Crowd 50 v 50 matches of bots,
 * recorded offline (packages/sim/scripts/bot-replays.ts) and played back on the viewer's device. They run one after
 * another on a cycle set by the clock, so everyone watching sees the same match at the same moment. A beta stand-in
 * until real players arrive. Playing back is moves only: no engine, and each replay's positions are worked out once.
 */

/** One ply: the move played (UCI), the crowd's top votes, who voted for it or moved, players left, a restart. */
export interface ReplayPly {
  m: string;
  /** [SAN, count], most first (a final's one player: [SAN, 1]). */
  v: [string, number][];
  /** A bot who voted for the played move (index into names). */
  n?: number;
  /** The final: who moved (index into names). */
  w?: number;
  /** Players still in after this ply. */
  a: number;
  /** The game was restarted: the position this ply started from. */
  s?: string;
}
export interface Replay {
  id: string;
  names: string[];
  plies: ReplayPly[];
  end: { winner: "w" | "b" | null; top: number[] };
}
export interface ReplayFile {
  version: 1;
  replays: Replay[];
}

export const REPLAYS_URL = "/replays/crowd-bots.json";

type Timing = Pick<typeof LIVE_WINDOW, "plySeconds" | "finalPlySeconds" | "startSeconds" | "endSeconds">;

/** How long one ply shows (ms). */
const plyMs = (p: ReplayPly, t: Timing) => (p.w !== undefined ? t.finalPlySeconds : t.plySeconds) * 1000;

/** A replay's length on the cycle: the starting position, each ply, then the result (ms). */
export function replayMs(r: Replay, t: Timing = LIVE_WINDOW): number {
  let ms = (t.startSeconds + t.endSeconds) * 1000;
  for (const p of r.plies) ms += plyMs(p, t);
  return ms;
}

/** The whole cycle (ms): every replay once. */
export function cycleMs(file: ReplayFile, t: Timing = LIVE_WINDOW): number {
  return file.replays.reduce((sum, r) => sum + replayMs(r, t), 0);
}

/**
 * What's showing at `now` (ms since 1970, the same clock for everyone): which replay, which ply (-1 = the starting
 * position, `plies.length` = the result), and when that changes next.
 */
export interface ReplayMoment {
  replay: number;
  ply: number;
  /** Until this time (ms since 1970) nothing changes. */
  until: number;
}

export function replayAt(file: ReplayFile, now: number, t: Timing = LIVE_WINDOW): ReplayMoment | null {
  const total = cycleMs(file, t);
  if (!file.replays.length || total <= 0) return null;
  const into = ((now % total) + total) % total;
  const cycleStart = now - into;
  let at = 0;
  for (let i = 0; i < file.replays.length; i++) {
    const r = file.replays[i]!;
    const len = replayMs(r, t);
    if (into >= at + len) {
      at += len;
      continue;
    }
    // Inside this replay: the start, a ply, or the result.
    let edge = at + t.startSeconds * 1000;
    if (into < edge) return { replay: i, ply: -1, until: cycleStart + edge };
    for (let k = 0; k < r.plies.length; k++) {
      edge += plyMs(r.plies[k]!, t);
      if (into < edge) return { replay: i, ply: k, until: cycleStart + edge };
    }
    return { replay: i, ply: r.plies.length, until: cycleStart + at + len };
  }
  return { replay: 0, ply: -1, until: now + t.startSeconds * 1000 };
}

/** Each ply's position after it is played (index = ply), from the start or a restart: worked out once per replay. */
const positions = new WeakMap<Replay, string[]>();
export function replayPositions(r: Replay): string[] {
  let out = positions.get(r);
  if (out) return out;
  out = [];
  let fen = START_FEN;
  for (const p of r.plies) {
    fen = applyMove(p.s ?? fen, p.m);
    out.push(fen);
  }
  positions.set(r, out);
  return out;
}

/** The position, move and words to show for a moment of a replay. */
export interface ReplayView {
  fen: string;
  lastMove: string | null;
  /** The side whose crowd (or finalist) just moved. */
  side: "w" | "b" | null;
  votes: [string, number][];
  /** A bot who voted for the move, or who moved it (the final). */
  name: string | null;
  final: boolean;
  /** Players still in. */
  alive: number;
  /** Moves into the game (plies). */
  ply: number;
  /** The result, once the replay has ended. */
  end: { winner: "w" | "b" | null; top: string[] } | null;
}

export function replayView(r: Replay, ply: number): ReplayView {
  const fens = replayPositions(r);
  if (ply < 0 || !r.plies.length)
    return { fen: r.plies[0]?.s ?? START_FEN, lastMove: null, side: null, votes: [], name: null, final: false, alive: 100, ply: 0, end: null };
  const k = Math.min(ply, r.plies.length - 1);
  const p = r.plies[k]!;
  const before = p.s ?? (k > 0 ? fens[k - 1]! : START_FEN);
  const side = before.split(" ")[1] === "b" ? "b" : "w";
  const who = p.w ?? p.n;
  return {
    fen: fens[k]!,
    lastMove: p.m,
    side,
    votes: p.v,
    name: who !== undefined ? (r.names[who] ?? null) : null,
    final: p.w !== undefined,
    alive: p.a,
    ply: k + 1,
    end: ply >= r.plies.length ? { winner: r.end.winner, top: r.end.top.map((i) => r.names[i] ?? "") } : null,
  };
}

let loading: Promise<ReplayFile | null> | null = null;
/** The replays, fetched once (null if they can't be had: the window then waits for a real match). */
export function loadReplays(): Promise<ReplayFile | null> {
  loading ??= fetch(REPLAYS_URL)
    .then((r) => (r.ok ? (r.json() as Promise<ReplayFile>) : null))
    .then((f) => (f && f.version === 1 && Array.isArray(f.replays) && f.replays.length ? f : null))
    .catch(() => {
      loading = null;
      return null;
    });
  return loading;
}
