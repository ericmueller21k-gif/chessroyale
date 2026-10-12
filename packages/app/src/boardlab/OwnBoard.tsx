/**
 * Board lab (throwaway): a board written from scratch: plain DOM, CSS transitions and pointer events.
 * Tap a piece then a square, or drag it. Pieces keep their identity between positions, so a move (castling's rook,
 * an undo, a reset) slides every piece that moved.
 */
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { pieceImages } from "./pieces.ts";
import { ANIM_MS, type LabBoardProps } from "./types.ts";

interface Piece {
  id: number;
  code: string; // "wp", "bk", ...
  sq: string; // "e4"
}

const FILES = "abcdefgh";
// Tuned to the game's board (measured, Oct 12): a drag starts after 3 px.
const DRAG_START_PX = 3;

function parseFen(fen: string): Map<string, string> {
  const out = new Map<string, string>();
  const rows = fen.split(" ")[0]!.split("/");
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        out.set(`${FILES[f]}${8 - i}`, (ch === ch.toUpperCase() ? "w" : "b") + ch.toLowerCase());
        f++;
      }
    }
  });
  return out;
}

const fileOf = (sq: string) => FILES.indexOf(sq[0]!);
const rankOf = (sq: string) => Number(sq[1]) - 1;
const dist = (a: string, b: string) => Math.hypot(fileOf(a) - fileOf(b), rankOf(a) - rankOf(b));

let nextId = 1;

/**
 * Who went where: a piece still on its square keeps its id; the rest take the id of the nearest vanished piece of
 * the same kind (it slides there), then of the same colour (a pawn sliding to promote). Anything left over is new;
 * vanished pieces left over were captured.
 */
function follow(prev: Piece[], board: Map<string, string>): { pieces: Piece[]; gone: Piece[] } {
  const left = new Map(prev.map((p) => [p.id, p]));
  const out: Piece[] = [];
  const todo: [string, string][] = [];
  for (const [sq, code] of board) {
    const stay = prev.find((p) => p.sq === sq && p.code === code && left.has(p.id));
    if (stay) {
      left.delete(stay.id);
      out.push(stay);
    } else todo.push([sq, code]);
  }
  const take = (sq: string, ok: (p: Piece) => boolean) => {
    let best: Piece | null = null;
    for (const p of left.values()) if (ok(p) && (!best || dist(p.sq, sq) < dist(best.sq, sq))) best = p;
    if (best) left.delete(best.id);
    return best;
  };
  const rest: [string, string][] = [];
  for (const [sq, code] of todo) {
    const p = take(sq, (q) => q.code === code);
    if (p) out.push({ id: p.id, code, sq });
    else rest.push([sq, code]);
  }
  for (const [sq, code] of rest) {
    const p = take(sq, (q) => q.code[0] === code[0]);
    out.push({ id: p?.id ?? nextId++, code, sq });
  }
  // (Kept in id order: a piece whose element moved in the DOM would lose its slide, as a re-inserted element has no
  // transition to run.)
  out.sort((a, b) => a.id - b.id);
  return { pieces: out, gone: [...left.values()] };
}

interface Press {
  sq: string;
  id: number;
  x: number;
  y: number;
  wasSelected: boolean;
  dragging: boolean;
}

export function OwnBoard(props: LabBoardProps) {
  const { fen, lastMove, orientation, opts, dests, check } = props;
  const white = orientation === "white";
  const ms = ANIM_MS[opts.anim];
  const images = pieceImages(opts.pieces);

  const [, redraw] = useState(0);
  const rerender = () => redraw((n) => n + 1);

  // Pieces follow the position (worked out during render, once per position).
  const state = useRef<{ fen: string | null; pieces: Piece[]; fading: (Piece & { until: number })[] }>({ fen: null, pieces: [], fading: [] });
  const st = state.current;
  if (st.fen !== fen) {
    const { pieces, gone } = follow(st.fen === null ? [] : st.pieces, parseFen(fen));
    const now = performance.now();
    st.fading = [...st.fading.filter((f) => f.until > now), ...(st.fen === null ? [] : gone.map((g) => ({ ...g, until: now + ms })))];
    st.pieces = pieces;
    st.fen = fen;
    if (st.fading.length) setTimeout(rerender, ms + 20);
  }

  // The selection belongs to a position: a new one (a move, undo, reset) clears it.
  const [sel, setSel] = useState<{ sq: string; fen: string } | null>(null);
  const selected = sel?.fen === fen ? sel.sq : null;
  const setSelected = (sq: string | null) => setSel(sq ? { sq, fen } : null);
  // The piece just dropped by drag lands where the finger let go, without sliding.
  const [instant, setInstant] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const press = useRef<Press | null>(null);
  const boardEl = useRef<HTMLDivElement>(null);
  const hoverEl = useRef<HTMLDivElement>(null);
  const pieceEls = useRef(new Map<number, HTMLDivElement>());

  useLayoutEffect(() => {
    if (instant === null) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setInstant(null)));
    return () => cancelAnimationFrame(r);
  }, [instant]);

  const col = (sq: string) => (white ? fileOf(sq) : 7 - fileOf(sq));
  const row = (sq: string) => (white ? 7 - rankOf(sq) : rankOf(sq));
  const at = (sq: string) => `translate(${col(sq) * 100}%, ${row(sq) * 100}%)`;

  // The board's box, read once per press: reading it on every pointer move, after writing a transform, forces a
  // layout each time (measured: frames dropped while dragging at 4x CPU throttling).
  const bounds = useRef<DOMRect | null>(null);
  const rect = () => bounds.current ?? boardEl.current!.getBoundingClientRect();
  const squareAt = (clientX: number, clientY: number): string | null => {
    const r = rect();
    const c = Math.floor(((clientX - r.left) / r.width) * 8);
    const w = Math.floor(((clientY - r.top) / r.height) * 8);
    if (c < 0 || c > 7 || w < 0 || w > 7) return null;
    return `${FILES[white ? c : 7 - c]}${white ? 8 - w : w + 1}`;
  };
  const pieceOn = (sq: string) => st.pieces.find((p) => p.sq === sq);
  const turn = fen.split(" ")[1];

  const tryMove = (from: string, to: string) => !!dests.get(from)?.includes(to) && props.onMove(from, to);

  /** Puts a dragged piece's centre under the pointer. */
  const dragTo = (id: number, clientX: number, clientY: number) => {
    const el = pieceEls.current.get(id);
    const r = rect();
    if (!el) return;
    const s = r.width / 8;
    el.style.transform = `translate(${clientX - r.left - s / 2}px, ${clientY - r.top - s / 2}px)`;
    const sq = squareAt(clientX, clientY);
    const h = hoverEl.current;
    if (h) {
      h.style.display = sq ? "block" : "none";
      if (sq) h.style.transform = at(sq);
    }
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || press.current) return;
    bounds.current = boardEl.current!.getBoundingClientRect();
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    e.preventDefault();
    // Tap-tap: a selected piece goes to a tapped destination.
    if (selected && selected !== sq && dests.get(selected)?.includes(sq)) {
      tryMove(selected, sq);
      setSelected(null);
      return;
    }
    const p = pieceOn(sq);
    if (p && p.code[0] === turn) {
      setSelected(sq);
      press.current = { sq, id: p.id, x: e.clientX, y: e.clientY, wasSelected: selected === sq, dragging: false };
      boardEl.current!.setPointerCapture(e.pointerId);
    } else setSelected(null);
  };

  const onMove = (e: PointerEvent) => {
    const p = press.current;
    if (!p || opts.drag === "off") return;
    if (!p.dragging) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START_PX) return;
      p.dragging = true;
      setDragId(p.id);
    }
    dragTo(p.id, e.clientX, e.clientY);
  };

  const onUp = (e: PointerEvent) => {
    const p = press.current;
    if (!p) return;
    press.current = null;
    if (hoverEl.current) hoverEl.current.style.display = "none";
    if (!p.dragging) {
      // A second tap on the selected piece puts it down.
      if (p.wasSelected) setSelected(null);
      return;
    }
    setDragId(null);
    const to = e.type === "pointerup" ? squareAt(e.clientX, e.clientY) : null;
    if (to && to !== p.sq && tryMove(p.sq, to)) {
      setInstant(p.id);
      setSelected(null);
      return;
    }
    // Back where it came from at once, as the game's board does (measured: no slide back).
    const el = pieceEls.current.get(p.id);
    if (el) {
      el.style.transform = at(p.sq);
      // (Styled now, while it has no transition: otherwise it slides back once the drag class goes.)
      void el.offsetWidth;
    }
    if (to !== p.sq) setSelected(null);
  };

  const sqStyle = (sq: string) => ({ transform: at(sq) });
  const selDests = selected ? dests.get(selected) ?? [] : [];
  const now = performance.now();

  return (
    <div
      ref={boardEl}
      class={`bl-own${opts.drag === "on" ? " bl-own-drag" : ""}`}
      style={{ "--bl-anim": `${ms}ms` }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <span key={`r${i}`} class={`bl-coord bl-rank ${i % 2 ? "bl-on-dark" : "bl-on-light"}`} style={{ top: `${i * 12.5}%` }}>
          {white ? 8 - i : i + 1}
        </span>
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <span key={`f${i}`} class={`bl-coord bl-file ${i % 2 ? "bl-on-light" : "bl-on-dark"}`} style={{ left: `${i * 12.5}%` }}>
          {FILES[white ? i : 7 - i]}
        </span>
      ))}
      {lastMove && <div class="bl-sq bl-last" style={sqStyle(lastMove.slice(0, 2))} />}
      {lastMove && <div class="bl-sq bl-last" style={sqStyle(lastMove.slice(2, 4))} />}
      {check && <div class="bl-sq bl-check" style={sqStyle(check)} />}
      {selected && <div class="bl-sq bl-selected" style={sqStyle(selected)} />}
      <div ref={hoverEl} class="bl-sq bl-hover" style={{ display: "none" }} />
      {st.fading
        .filter((f) => f.until > now)
        .map((f) => (
          <div key={`g${f.id}`} data-p={f.code} class="bl-piece bl-fade" style={{ transform: at(f.sq), backgroundImage: `url("${images[f.code]}")` }} />
        ))}
      {st.pieces.map((p) => (
        <div
          key={p.id}
          data-p={p.code}
          ref={(el) => {
            if (el) pieceEls.current.set(p.id, el);
            else pieceEls.current.delete(p.id);
          }}
          class={`bl-piece${p.id === dragId ? " bl-dragging" : ""}${p.id === instant ? " bl-instant" : ""}`}
          style={{ transform: at(p.sq), backgroundImage: `url("${images[p.code]}")` }}
        />
      ))}
      {opts.dots === "on" &&
        selDests.map((sq) => <div key={`d${sq}`} class={`bl-sq ${pieceOn(sq) ? "bl-ring" : "bl-dot"}`} style={sqStyle(sq)} />)}
    </div>
  );
}
