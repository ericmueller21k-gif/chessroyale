import { useEffect, useRef, useState } from "preact/hooks";
import type { BoardSlot } from "@chessroyale/chess";
import { play } from "../sound.ts";

const SIZE: Record<string, number> = { p: 0.42, n: 0.62, b: 0.62, r: 0.62, q: 0.72, k: 0.8 };

/**
 * A board drawn as pixels: muted squares, white and black blocks for pieces
 * (pawns smaller, the king largest), the last move tinted. Always White at
 * the bottom.
 */
export function TinyBoard({ fen, lastMove }: { fen: string; lastMove: string | null }) {
  const rows = fen.split(" ")[0]!.split("/");
  const marked = lastMove ? [lastMove.slice(0, 2), lastMove.slice(2, 4)] : [];
  const cells = [];
  const pieces = [];
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r] ?? "") {
      if (/\d/.test(ch)) {
        f += Number(ch);
        continue;
      }
      const s = SIZE[ch.toLowerCase()] ?? 0.6;
      const o = (1 - s) / 2;
      pieces.push(<rect key={`p${r}${f}`} x={f + o} y={r + o} width={s} height={s} class={ch === ch.toUpperCase() ? "tp-w" : "tp-b"} />);
      f++;
    }
    for (let c = 0; c < 8; c++) {
      const sq = "abcdefgh"[c]! + (8 - r);
      const cls = marked.includes(sq) ? "ts-m" : (r + c) % 2 ? "ts-d" : "ts-l";
      cells.push(<rect key={sq} x={c} y={r} width={1} height={1} class={cls} />);
    }
  }
  return (
    <svg class="tiny-board" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
      {cells}
      {pieces}
    </svg>
  );
}

/** The strip as last shown (kept across screens). */
let lastShown: BoardSlot[] | null = null;
/** Forget it when a new match starts. */
export const resetBoardsStrip = () => {
  lastShown = null;
};

/**
 * Every board in the match as a strip of tiny boards numbered 1–8, live after
 * each round. Yours this turn is ringed; boards that have closed stay greyed.
 * While `frozen` (the reveal, before the chosen move plays) it keeps showing
 * the positions from before; when they change, the boards light up one after
 * another with a ripple of soft knocks.
 */
export function BoardsStrip({ slots, current, frozen = false }: { slots: BoardSlot[]; current: number | null; frozen?: boolean }) {
  // What was last on screen survives the switch between screens (the reveal mounts with the new positions already in).
  const shown = useRef(lastShown ?? slots);
  const [wave, setWave] = useState(0);
  if (!frozen) shown.current = slots;
  lastShown = shown.current;
  const key = shown.current.map((s) => s.fen).join("|");
  const prevKey = useRef(key);
  useEffect(() => {
    if (prevKey.current === key) return;
    prevKey.current = key;
    setWave((w) => w + 1);
    play("ripple");
  }, [key]);
  const list = shown.current;
  if (!list.length) return null;
  return (
    <div class="boards-strip" role="list" aria-label="All boards">
      {list.map((s, i) => (
        <div
          key={`${s.id}:${wave}`}
          role="listitem"
          class={`strip-slot${s.id === current ? " current" : ""}${s.live ? "" : " closed"}${wave ? " wave" : ""}`}
          style={wave ? { animationDelay: `${i * 45}ms` } : undefined}
          aria-label={`Board ${s.id + 1}${s.id === current ? ", yours" : ""}${s.live ? "" : ", closed"}`}
          aria-current={s.id === current ? "true" : undefined}
        >
          <TinyBoard fen={s.fen} lastMove={s.lastMove} />
          <span class="strip-num">{s.id + 1}</span>
        </div>
      ))}
    </div>
  );
}
