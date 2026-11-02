import { AUTOCHESS, type AutoChessSettings } from "@chessroyale/core";
import { botAt, type BotEvent } from "./bot.ts";
import type { Kind, StarCount } from "./types.ts";

/**
 * What each side sees of the other's board while buying (Eric, Nov 1-2: "fair and strategic"; docs/decisions/2026-11-02-autochess-reveal.md).
 *
 * - **Live circles:** the other side's placed pieces show as plain circles (pawns too) the moment they are placed.
 * - **Reveals every `revealSeconds` (3 s), piece for piece by kind:** a piece is revealed only together with a piece of the other side
 *   of its group (`revealGroups`: pawn and pawn, knight or bishop and knight or bishop, rook and rook, queen and queen), one reveal
 *   per tick, the two of a pair on two ticks in a row (one side, then the other). A piece with no unrevealed match on the other side
 *   stays hidden. Kings are never hidden (they are not in the logs).
 * - **The order:** in each group the two sides' unrevealed pieces pair up in the order they were placed (the first of each, then the
 *   second of each, ...). The pair that formed first (the later of its two placements is the earliest) opens first (a tie: pawns, then
 *   knights and bishops, rooks, queens). **Placing first pays:** within a pair the piece placed later shows first, and the side that
 *   placed first answers on the next tick.
 * - **The answer** is that side's earliest-placed unrevealed piece of the group (the pair's own piece, unless it was sold in between:
 *   then the next one of the group; with none, the pair is broken and that tick opens the next pair).
 * - **Sold** (taken off the board): it leaves its pair (an unopened pair re-forms from what is left); a revealed one is simply gone.
 *   **Moved** (a square to another; the buy step has no such move today): the piece keeps its place in the order, and stays revealed.
 * - Your **next** piece to be revealed: the one the coming ticks reveal first if nothing changes (the answer you owe, else your piece
 *   in the next pair to open); none when no tick is left in the step.
 * - At the move step everything shows (the screen's full reveal, as before).
 *
 * Everything is a pure function of the two sides' board changes and the time, the same for both sides (the bot or a person), so a
 * test can say what shows when.
 */

export type Side = "you" | "them";

/** One change to a side's board while buying, `at` seconds into the step: a piece put on a square, taken off it (sold), or moved to another. */
export type BoardChange =
  | { side: Side; at: number; type: "add"; square: string; kind: Kind }
  | { side: Side; at: number; type: "remove"; square: string }
  | { side: Side; at: number; type: "move"; square: string; to: string };

/** A piece on a board, as the reveal sees it: when it was placed, and when it was revealed (null: still hidden). */
export interface RevealPiece {
  side: Side;
  square: string;
  kind: Kind;
  placed: number;
  shown: number | null;
}

/** The times (seconds into the buy step) of the reveal ticks: every `revealSeconds`, while the step is on. */
export function revealTimes(cfg: AutoChessSettings = AUTOCHESS): number[] {
  const out: number[] = [];
  for (let k = 1; k * cfg.revealSeconds < cfg.buySeconds; k++) out.push(k * cfg.revealSeconds);
  return out;
}

/** The group a kind reveals with (its index in `revealGroups`), or -1: never revealed while buying. */
export const revealGroup = (kind: Kind, cfg: AutoChessSettings = AUTOCHESS) => cfg.revealGroups.findIndex((g) => g.includes(kind));

const otherSide = (s: Side): Side => (s === "you" ? "them" : "you");

interface Piece extends RevealPiece {
  id: number;
}
interface RunState {
  pieces: Piece[];
  /** The side that answers the pair opened on the last tick, and the group it answers in. */
  owed: { side: Side; group: number } | null;
}

function applyChange(st: RunState, c: BoardChange, id: number) {
  const i = st.pieces.findIndex((p) => p.side === c.side && p.square === c.square);
  if (c.type === "add") {
    // (A square holds one piece: anything still logged there has left.)
    if (i >= 0) st.pieces.splice(i, 1);
    st.pieces.push({ id, side: c.side, square: c.square, kind: c.kind, placed: c.at, shown: null });
  } else if (i >= 0 && c.type === "remove") st.pieces.splice(i, 1);
  else if (i >= 0 && c.type === "move") st.pieces[i] = { ...st.pieces[i]!, square: c.to };
}

/** A side's unrevealed pieces of a group, earliest placed first. */
const hiddenOf = (st: RunState, side: Side, group: number, cfg: AutoChessSettings) =>
  st.pieces.filter((p) => p.side === side && p.shown === null && revealGroup(p.kind, cfg) === group).sort((a, b) => a.placed - b.placed || a.id - b.id);

/** One tick: the answer owed, else the next pair opens with its later-placed piece. Returns the piece revealed, if any. */
function tick(st: RunState, at: number, cfg: AutoChessSettings): Piece | null {
  const owed = st.owed;
  st.owed = null;
  if (owed) {
    const p = hiddenOf(st, owed.side, owed.group, cfg)[0];
    if (p) {
      p.shown = at;
      return p;
    }
  }
  let best: { first: Piece; group: number } | null = null;
  for (let group = 0; group < cfg.revealGroups.length; group++) {
    const a = hiddenOf(st, "you", group, cfg)[0];
    const b = hiddenOf(st, "them", group, cfg)[0];
    if (!a || !b) continue;
    // (The pair formed when its later piece was placed; that piece shows first. An exact tie of times goes by the order logged.)
    const later = a.placed > b.placed || (a.placed === b.placed && a.id > b.id) ? a : b;
    if (!best || later.placed < best.first.placed) best = { first: later, group };
  }
  if (!best) return null;
  best.first.shown = at;
  st.owed = { side: otherSide(best.first.side), group: best.group };
  return best.first;
}

/** The boards and reveals `seconds` into the step, and each side's next piece to be revealed (its square; null: none in this step). */
export function revealsAt(changes: readonly BoardChange[], seconds: number, cfg: AutoChessSettings = AUTOCHESS): { pieces: RevealPiece[]; next: Record<Side, string | null> } {
  const log = [...changes].sort((a, b) => a.at - b.at);
  const st: RunState = { pieces: [], owed: null };
  let n = 0;
  const times = revealTimes(cfg);
  for (const t of times) {
    if (t > seconds) break;
    while (n < log.length && log[n]!.at <= t) applyChange(st, log[n]!, n++);
    tick(st, t, cfg);
  }
  while (n < log.length && log[n]!.at <= seconds) applyChange(st, log[n]!, n++);
  const pieces = st.pieces.map(({ id: _, ...p }) => p);
  // What comes next if nothing changes: the coming ticks played on a copy, until each side has had one.
  const ahead: RunState = { pieces: st.pieces.map((p) => ({ ...p })), owed: st.owed };
  const next: Record<Side, string | null> = { you: null, them: null };
  for (const t of times) {
    if (t <= seconds) continue;
    if (next.you && next.them) break;
    const p = tick(ahead, t, cfg);
    if (p && !next[p.side]) next[p.side] = p.square;
  }
  return { pieces, next };
}

/** The changes a board went through (`before` to `after`, `at` seconds into the step), for the reveal's log: what left, then what arrived. */
export function boardChanges(side: Side, before: Readonly<Record<string, Kind>>, after: Readonly<Record<string, Kind>>, at: number): BoardChange[] {
  const out: BoardChange[] = [];
  for (const [square, kind] of Object.entries(before)) if (after[square] !== kind) out.push({ side, at, type: "remove", square });
  for (const [square, kind] of Object.entries(after)) if (before[square] !== kind) out.push({ side, at, type: "add", square, kind });
  return out;
}

/** The bot's board changes from its plan: each piece bought onto the board or placed from its bench (it sells and moves nothing). */
export function botChanges(events: readonly BotEvent[]): BoardChange[] {
  const out: BoardChange[] = [];
  for (const e of events) {
    if ((e.type === "buy" || e.type === "place") && e.square && e.kind !== "reroll" && e.kind !== "xp") out.push({ side: "them", at: e.at, type: "add", square: e.square, kind: e.kind });
  }
  return out;
}

export interface Revealed {
  square: string;
  kind: Kind;
  /** When it was revealed (seconds into the step). */
  at: number;
  /** Its stars as they are now (v8): a revealed piece shows them, and a star it gains after it was revealed shows too; none for a plain piece. */
  stars?: StarCount;
}

/**
 * What shows `seconds` into the buy step. Of their board: circles (all but the revealed), the revealed pieces, what they have spent
 * and the XP they have bought (`circlesDelaySeconds` behind: 0 since Nov 2, live). Of yours: the pieces they haven't seen yet
 * (`unseen`, slightly grayed on your screen) and the next of yours to be revealed (`next`, a thin yellow border).
 */
export function botSeen(
  events: readonly BotEvent[],
  yours: readonly BoardChange[],
  seconds: number,
  cfg: AutoChessSettings = AUTOCHESS,
): { circles: string[]; revealed: Revealed[]; spent: number; xpBuys: number; unseen: string[]; next: string | null } {
  const behind = botAt(events, Math.max(0, seconds - cfg.circlesDelaySeconds));
  const now = botAt(events, seconds);
  const run = revealsAt([...yours, ...botChanges(events)], seconds, cfg);
  const revealed: Revealed[] = run.pieces
    .filter((p) => p.side === "them" && p.shown !== null)
    .sort((a, b) => a.shown! - b.shown!)
    .map((p) => ({ square: p.square, kind: p.kind, at: p.shown!, ...(now.stars[p.square] ? { stars: now.stars[p.square]! } : {}) }));
  const shown = new Set(revealed.map((r) => r.square));
  return {
    circles: Object.keys(behind.squares).filter((sq) => !shown.has(sq)),
    revealed,
    spent: behind.spent,
    xpBuys: behind.xpBuys,
    unseen: run.pieces.filter((p) => p.side === "you" && p.shown === null).map((p) => p.square),
    next: run.next.you,
  };
}
