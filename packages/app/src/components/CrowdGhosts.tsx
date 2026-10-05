import { useEffect, useRef, useState } from "preact/hooks";
import { pieceAt } from "@chessroyale/chess";

const NAMES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/** Board position (percent from the top-left) of a square, from the given side. */
function at(square: string, orientation: "white" | "black") {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { left: (orientation === "white" ? f : 7 - f) * 12.5, top: (orientation === "white" ? 7 - r : r) * 12.5 };
}

/** Column and row (0-7, from the top-left) of a square, from the given side. */
function cell(square: string, orientation: "white" | "black") {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { x: orientation === "white" ? f : 7 - f, y: orientation === "white" ? 7 - r : r };
}

/** Motion trail: how long a pick takes to fly to its square (ms), and the most in the air at once (the rest just pop). */
export const FLY_MS = 420;
const MAX_FLYING = 14;

interface Flight {
  key: string;
  move: string;
  at: number;
  cls: string;
  you: boolean;
}

export interface GhostPick {
  /** Unique per pick (the player's id). */
  id: string;
  name: string;
  move: string;
  you: boolean;
  /** Leaderboard position (for which names make the tag). */
  rank: number;
}

/**
 * One see-through piece on its picked square. Every picked square has exactly
 * one: it never slides across the board (dozens of pieces sliding at once
 * smeared into streaks), it pops in where it lands, a little bolder for every
 * extra pick and with a pulse each time one more arrives.
 */
function Ghost({ fen, move, orientation, count, you, instant, landing, chosenCls }: { fen: string; move: string; orientation: "white" | "black"; count: number; you: boolean; instant: boolean; landing: boolean; chosenCls: string }) {
  const piece = pieceAt(fen, move.slice(0, 2));
  if (!piece) return null;
  const p = at(move.slice(2, 4), orientation);
  // 1 pick: faint; more picks: bolder (the stack reads at a glance), up to a cap.
  const weight = Math.min(1, 0.55 + 0.15 * Math.log2(count));
  // With the motion trail, a pick that's flying in shows (or pops) when it lands, not before.
  const arrive = instant ? "" : landing ? (count === 1 ? " land-first" : " land") : " pop";
  return (
    <piece
      key={instant ? "still" : `n${count}`}
      class={`${piece.color === "w" ? "white" : "black"} ${NAMES[piece.type]} crowd-ghost${you ? " you" : ""}${arrive}${chosenCls}`}
      style={{ left: `${p.left}%`, top: `${p.top}%`, "--ghost-weight": String(weight), "--fly-ms": `${FLY_MS}ms` }}
    />
  );
}

/**
 * Motion trail: one pick flying from its piece's square to where it lands, with two fading echoes behind it.
 * It's placed on the landing square and starts offset by whole squares (a transform), so where it ends is
 * exactly where the fixed ghost stands, and it fades out as that ghost appears.
 */
function Flyer({ move, orientation, cls, you }: { move: string; orientation: "white" | "black"; cls: string; you: boolean }) {
  const from = cell(move.slice(0, 2), orientation);
  const to = cell(move.slice(2, 4), orientation);
  const p = at(move.slice(2, 4), orientation);
  const style = { left: `${p.left}%`, top: `${p.top}%`, "--dx": String(from.x - to.x), "--dy": String(from.y - to.y), "--fly-ms": `${FLY_MS}ms` };
  return (
    <>
      {[2, 1, 0].map((echo) => (
        <piece key={`e${echo}`} class={`${cls} crowd-flyer${echo ? ` echo${echo}` : ""}${you ? " you" : ""}`} style={style} />
      ))}
    </>
  );
}

/** A ghost with animations off: one still piece per picked move. */
function StillGhost({ fen, move, orientation, chosenCls }: { fen: string; move: string; orientation: "white" | "black"; chosenCls: string }) {
  const piece = pieceAt(fen, move.slice(0, 2));
  if (!piece) return null;
  const to = at(move.slice(2, 4), orientation);
  return <piece class={`${piece.color === "w" ? "white" : "black"} ${NAMES[piece.type]} crowd-ghost still${chosenCls}`} style={{ left: `${to.left}%`, top: `${to.top}%` }} />;
}

/**
 * Crowd picks on the board. Every move picked gets a tag over its square: one
 * name ("You" if you picked it, else the best-placed) and "+N" for the rest, and one ghost piece
 * on the square it moves to (one spot per square, however many picked it).
 * With animations on, each new pick pops that ghost (20 knight picks are 20
 * quick pulses on one knight); with the motion trail too, each pick first flies
 * in from its piece's square and the ghost pops as it lands; with animations
 * off, the ghosts just stand there.
 * `chosen` fades the others and lights the winner.
 */
export function CrowdGhosts({
  fen,
  picks,
  orientation,
  animate,
  chosen = null,
  faint = false,
  instant,
  tags = true,
  trail = false,
}: {
  fen: string;
  picks: GhostPick[];
  orientation: "white" | "black";
  animate: boolean;
  chosen?: string | null;
  /** Live tallies while players are still picking: a little more see-through. */
  faint?: boolean;
  /** Picks already shown (live): they start on their square instead of sliding in again. */
  instant?: ReadonlySet<string>;
  /** Name tags over each picked square (off for the pre-game votes, which show counts instead). */
  tags?: boolean;
  /** Motion trail (with animations on): each new pick flies in from its piece's square. */
  trail?: boolean;
}) {
  // Motion trail: picks seen so far (those already on screen never fly), and the flights in the air.
  const flown = useRef<Set<string> | null>(null);
  const flights = useRef<Flight[]>([]);
  const [, setTick] = useState(0);
  const now = Date.now();
  if (animate && trail) {
    if (!flown.current) flown.current = new Set(instant ?? []);
    flights.current = flights.current.filter((f) => now - f.at < FLY_MS + 60);
    for (const p of picks) {
      if (flown.current.has(p.id)) continue;
      flown.current.add(p.id);
      const piece = pieceAt(fen, p.move.slice(0, 2));
      // One flyer per move in the air at a time (a popular move would stack into a streak); the rest just pop.
      if (!piece || flights.current.length >= MAX_FLYING || flights.current.some((f) => f.move === p.move && now - f.at < FLY_MS)) continue;
      flights.current.push({ key: p.id, move: p.move, at: now, cls: `${piece.color === "w" ? "white" : "black"} ${NAMES[piece.type]}`, you: p.you });
    }
  }
  const flying = flights.current;
  // Clear landed flights (a re-render once the last one is down).
  useEffect(() => {
    if (!flying.length) return;
    const last = Math.max(...flying.map((f) => f.at));
    const t = setTimeout(() => setTick((n) => n + 1), last + FLY_MS + 80 - Date.now());
    return () => clearTimeout(t);
  }, [flying.length, flying[flying.length - 1]?.at]);
  const landing = new Set(flying.filter((f) => now - f.at < FLY_MS).map((f) => f.move));
  const byMove = new Map<string, GhostPick[]>();
  for (const p of picks) byMove.set(p.move, [...(byMove.get(p.move) ?? []), p]);
  const cls = (move: string) => (chosen ? (move === chosen ? " chosen" : " not-chosen") : "");
  return (
    <div class={`cg-wrap shade-layer crowd-layer${faint ? " faint" : ""}`} aria-hidden="true">
      {[...byMove].map(([move, ps]) =>
        animate ? (
          <Ghost
            key={move}
            fen={fen}
            move={move}
            orientation={orientation}
            count={ps.length}
            you={ps.some((p) => p.you)}
            instant={ps.every((p) => instant?.has(p.id))}
            landing={landing.has(move)}
            chosenCls={cls(move)}
          />
        ) : (
          <StillGhost key={move} fen={fen} move={move} orientation={orientation} chosenCls={cls(move)} />
        ),
      )}
      {animate && trail && !chosen && flying.map((f) => <Flyer key={f.key} move={f.move} orientation={orientation} cls={f.cls} you={f.you} />)}
      {tags && [...byMove].map(([move, ps]) => {
        const to = at(move.slice(2, 4), orientation);
        // One name (yours if you picked it, else the best-placed) over the square, and "+N" for everyone else on the
        // piece's corner: both inside the square, so neighbouring squares never overlap.
        const top = [...ps].sort((a, b) => Number(b.you) - Number(a.you) || a.rank - b.rank)[0]!;
        const more = ps.length - 1;
        const you = ps.some((p) => p.you);
        return (
          <div key={`tag${move}`} class={`crowd-mark${you ? " you" : ""}${cls(move)}`}>
            <div class="shade-tag crowd-tag" style={{ left: `${to.left + 6.25}%`, top: `${to.top}%` }}>
              <span>{top.you ? "You" : top.name}</span>
            </div>
            {more > 0 && (
              <span key={`n${ps.length}`} class="crowd-count" style={{ left: `${to.left + 12.5}%`, top: `${to.top}%` }}>
                +{more}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
