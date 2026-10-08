/**
 * What a boss character does, from the match state every player shares (the board, its history, the boss's last
 * move, the result): which animation plays, which loop it settles into, and the odd taunt. Everything here is a pure
 * function of that shared state, so online every player sees the same animation and the same line at the same
 * moment, with nothing added to the protocol. Lines are picked by a hash of the moment (its key), not at random.
 */
import { fenAfter, inCheck } from "@chessroyale/chess";

/** The moments a boss reacts to. */
export type Beat = "entrance" | "idle" | "thinking" | "move" | "capture" | "hurt" | "check" | "smug" | "rattled" | "defeat" | "victory" | "strike";
/** The loops it rests in between moments. */
export type Loop = "idle" | "thinking" | "smug" | "rattled" | "defeat" | "victory";

/** Where the battle is: the boss's entrance, the crowd's move, the boss thinking, its move, its strike, the end. */
export type Stage = "intro" | "crowd" | "thinking" | "bossMove" | "strike" | "over";

export interface BeatState {
  stage: Stage;
  fen: string;
  history: readonly string[];
  crowdSide: "w" | "b";
  lastMove: { captured?: string } | null;
  result?: "crowd" | "boss" | "draw" | null;
  victim?: string | null;
}

export interface BeatLines {
  /** A few short lines per moment, and the chance (0-1) a moment gets one at all. */
  lines: Partial<Record<Beat, readonly string[]>>;
  chance: Partial<Record<Beat, number>>;
}

export interface BeatResult {
  /** The animation to play once (or the loop itself, when nothing happened). */
  anim: Beat;
  /** The loop to settle into afterwards. */
  loop: Loop;
  /** The moment, the same for every player: an animation plays once per key, and the line is picked from it. */
  key: string;
  line: string | null;
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
/** Material on the board for one side (pawns 1, minor pieces 3, rooks 5, queens 9). */
export function material(fen: string, side: "w" | "b"): number {
  let total = 0;
  for (const c of fen.split(" ")[0]!) {
    const v = VALUE[c.toLowerCase()];
    if (v && (c === c.toUpperCase()) === (side === "w")) total += v;
  }
  return total;
}

/**
 * The boss's mood from the material on the board, its lead in pawns: smug 3 or more ahead, rattled 3 or more
 * behind. (Material, not the engine's eval: every device computes its own eval, a moment apart and not always
 * the same, while the board is shared exactly.)
 */
export function mood(fen: string, crowdSide: "w" | "b"): "idle" | "smug" | "rattled" {
  const lead = material(fen, crowdSide === "w" ? "b" : "w") - material(fen, crowdSide);
  return lead >= 3 ? "smug" : lead <= -3 ? "rattled" : "idle";
}

/** FNV-1a: a small, stable hash of a string. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The line for a moment, or none: the key decides both whether it speaks and which line, the same everywhere. */
export function pickLine(cfg: BeatLines, beat: Beat, key: string): string | null {
  const lines = cfg.lines[beat];
  if (!lines?.length) return null;
  const h = hash(key);
  if ((h % 1000) / 1000 >= (cfg.chance[beat] ?? 0)) return null;
  return lines[(h >>> 10) % lines.length]!;
}

/** The position before the last move (or null at the start). */
function before(history: readonly string[], back = 1): string | null {
  return history.length >= back ? fenAfter(history.slice(0, history.length - back)) : null;
}

export function bossBeat(cfg: BeatLines, s: BeatState): BeatResult {
  const ply = s.history.length;
  const bossSide = s.crowdSide === "w" ? "b" : "w";
  const now = mood(s.fen, s.crowdSide);
  const out = (anim: Beat, loop: Loop, key: string, line = true): BeatResult => ({ anim, loop, key, line: line ? pickLine(cfg, anim, key) : null });
  if (s.stage === "over" || s.result) {
    const r = s.result ?? "draw";
    return r === "crowd" ? out("defeat", "defeat", "over:crowd") : r === "boss" ? out("victory", "victory", "over:boss") : out("smug", "idle", "over:draw", false);
  }
  if (s.stage === "intro") return out("entrance", "idle", `intro:${ply}`);
  if (s.stage === "strike") return out("strike", now, `strike:${ply}:${s.victim ?? ""}`);
  if (s.stage === "thinking") {
    // The crowd just moved: did it take one of the boss's pieces?
    const prev = before(s.history);
    const took = prev !== null && material(s.fen, bossSide) < material(prev, bossSide);
    return took ? out("hurt", "thinking", `hurt:${ply}`) : out("thinking", "thinking", `think:${ply}`);
  }
  if (s.stage === "bossMove") {
    const anim: Beat = inCheck(s.fen) ? "check" : s.lastMove?.captured ? "capture" : "move";
    return out(anim, now, `${anim}:${ply}`);
  }
  // The crowd's move: the boss's mood. It says something only when the mood has just changed.
  const prev = before(s.history, 2);
  const changed = now !== "idle" && (prev === null || mood(prev, s.crowdSide) !== now);
  return out(now, now, `mood:${now}:${ply}`, changed);
}
