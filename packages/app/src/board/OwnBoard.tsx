/**
 * HunChess's board (docs/areas/board.md): plain elements, CSS transitions and pointer events. It replaced chessground
 * (GPL-3) on Oct 12, 2026, with the same look and feel, measured side by side in the board lab: 220 ms slides on a
 * cubic ease in and out, a captured piece fading, a 3 px drag threshold, a dropped piece landing at once and an illegal
 * one going straight back, the same dots, rings, highlights, arrows and coordinates. Its behaviour, where the game
 * relies on it:
 * - Taps and drags: a tap selects a piece of the side to move (its dots show), a second tap on a dot moves it (as the
 *   press goes down); or drag it. A move you make stays on the board until the game next tells the board anything
 *   (`local`): a game that keeps the position (the Crowd) sees it go back, one that plays it keeps it.
 * - Pieces keep their identity between positions, so a move slides the piece that moved (castling's rook too).
 * - The board is drawn a whole multiple of 8 device pixels wide (crisp squares) and writes that size on the wrap
 *   (--board-width, read as --board-size by everything drawn over the squares, styles.css).
 * - Boingo's quarter turns are built in: every square is drawn where the turned board shows it (board-view.ts), taps
 *   are turned back, and the coordinates name the real squares.
 * - Hollow's dark: a dark square tapped is selected (no piece lifted, no dots); any attempt touching the dark goes to
 *   onDarkTry unchecked.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { BOARD } from "@chessroyale/core";
import { applyMove, inCheck, legalMoves, pieceAt, sideToMove, touchesDark } from "@chessroyale/chess";
import { BoardTurn, coordLabel, type QuarterTurn } from "../board-view.ts";
import { BRUSHES, FILES, SLIDE_MS, boardSize, cellOf, destsFor, drawArrows, follow, pieceClass, pieceCloseTo, positionKey, pressDown, pressMove, pressUp, readPieces, slidePiece, squareAtPoint, type BoardPiece, type Box, type PieceCode, type Press, type PressBoard } from "./logic.ts";
import type { BoardProps } from "./types.ts";

let nextPieceId = 1;
let boards = 0;
const NONE: readonly string[] = [];

/** A piece's place on the board: its column and row as a share of its own size (a square), so any size fits. */
const place = (square: string, orientation: "white" | "black", turn: QuarterTurn) => {
  const { col, row } = cellOf(square, orientation, turn);
  return `translate(${col * 100}%, ${row * 100}%)`;
};

/** The squares' colours: light ones as the board's ground, dark ones 20 % black over it (crisp edges, any size). */
const SQUARES_SVG = (() => {
  let d = "";
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) if ((row + col) % 2) d += `M${col} ${row}h1v1h-1z`;
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges"><path d="${d}" fill-opacity="0.2"/></svg>`)}")`;
})();

interface Track {
  key: string | null;
  pieces: BoardPiece[];
  fading: { piece: BoardPiece; until: number }[];
  /** Pieces sliding (drawn over the others meanwhile), until when. */
  sliding: Map<number, number>;
  orientation: string;
  turn: QuarterTurn;
}

export function OwnBoard({ fen, orientation, lastMove, interactive, moves, onMove, arrows, small, animate = true, children, marks, dark, onDarkTry, turn = 0 }: BoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const redraw = () => setTick((n) => n + 1);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onDarkRef = useRef(onDarkTry);
  onDarkRef.current = onDarkTry;
  const [promotion, setPromotion] = useState<{ from: string; to: string; dark?: boolean } | null>(null);
  // Hollow's dark: a dark square tapped (selected without picking anything up).
  const [darkSel, setDarkSel] = useState<string | null>(null);
  const darkOn = !!interactive && !!dark?.length && !!onDarkTry;
  const darkList = darkOn ? dark! : NONE;
  const uid = useMemo(() => `hb${++boards}`, []);

  // A move you made, shown until the game next tells the board anything new (any of these changing), as before.
  const local = useRef<{ pieces: Map<string, PieceCode>; last: [string, string] } | null>(null);
  const deps = [fen, orientation, lastMove, interactive, arrows, animate, moves?.join(), JSON.stringify(marks ?? null), darkOn, dark?.join(), darkSel, turn];
  const seen = useRef(deps);
  if (seen.current.length !== deps.length || seen.current.some((d, i) => d !== deps[i])) {
    seen.current = deps;
    local.current = null;
  }
  // The next change of position lands at once (a dropped piece), rather than sliding.
  const landNext = useRef(false);

  const propPieces = useMemo(() => readPieces(fen), [fen]);
  const shown = local.current?.pieces ?? propPieces;
  const shownLast = local.current ? local.current.last : lastMove ? ([lastMove.slice(0, 2), lastMove.slice(2, 4)] as [string, string]) : null;
  const turnColor = sideToMove(fen);
  const canAct = !!interactive && !small && !local.current;
  const dests = useMemo(() => (interactive && !small ? destsFor(fen, moves, darkList) : new Map<string, string[]>()), [fen, interactive, small, moves?.join(), darkList.join()]);

  // ---------------- Which piece is which ----------------
  const track = useRef<Track>({ key: null, pieces: [], fading: [], sliding: new Map(), orientation, turn });
  const tr = track.current;
  // (A new way up or a new turn of the board: every piece jumps to its new square, never flies there.)
  const turned = tr.orientation !== orientation || tr.turn !== turn;
  let jump = !animate || turned;
  // (Pieces put straight on new squares in this drawing: the browser must take them before anything slides again.)
  let jumped = turned;
  const key = positionKey(shown);
  const now = performance.now();
  if (tr.key !== key) {
    const first = tr.key === null;
    const { pieces, gone, moved } = follow(first ? [] : tr.pieces, shown, () => nextPieceId++);
    const slide = !first && animate && !turned && !landNext.current;
    tr.fading = slide ? [...tr.fading.filter((f) => f.until > now), ...gone.map((piece) => ({ piece, until: now + SLIDE_MS }))] : [];
    if (slide) for (const id of moved) tr.sliding.set(id, now + SLIDE_MS);
    else {
      tr.sliding.clear();
      jump = true;
      jumped = !first;
    }
    tr.pieces = pieces;
    tr.key = key;
  }
  // (A drop lands at once only as it's made: if the game puts the position back instead, that slides as usual.)
  landNext.current = false;
  tr.orientation = orientation;
  tr.turn = turn;
  const fading = tr.fading.filter((f) => f.until > now);
  for (const [id, until] of tr.sliding) if (until <= now) tr.sliding.delete(id);

  // Captured pieces fade and sliding ones settle: drawn again once they're done.
  useEffect(() => {
    const next = Math.min(...tr.fading.map((f) => f.until), ...tr.sliding.values());
    if (!Number.isFinite(next)) return;
    const t = setTimeout(redraw, Math.max(0, next - performance.now()) + 20);
    return () => clearTimeout(t);
  });
  // After a jump, the browser takes the new places before anything slides again (else the next change, in the same
  // frame, would slide from the old ones).
  useLayoutEffect(() => {
    if (jumped) void boardRef.current?.offsetWidth;
  });

  // ---------------- Selecting and moving ----------------
  const selected = useRef<string | null>(null);
  const press = useRef<Press | null>(null);
  const pressBox = useRef<Box | null>(null);
  const pressPointer = useRef<number | null>(null);
  /** The piece the press holds. */
  const pressId = useRef<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  // (The player's last move here was dragged: the next drag starts at once, as before.)
  const dragged = useRef(false);
  const pieceEls = useRef(new Map<number, HTMLElement>());

  // A new way up or turn of the board: nothing stays selected or held.
  const lastView = useRef(`${orientation}${turn}`);
  if (lastView.current !== `${orientation}${turn}`) {
    lastView.current = `${orientation}${turn}`;
    selected.current = null;
    press.current = null;
  }

  const movable = (sq: string) => canAct && shown.get(sq)?.[0] === turnColor;
  const board: PressBoard = {
    piece: (sq) => shown.get(sq),
    movable,
    canMove: (from, to) => from !== to && movable(from) && (darkList.length > 0 || !!dests.get(from)?.includes(to)),
    interactive: !!interactive,
  };
  const live = useRef({ board, shown, orientation, turn, darkOn, darkList, darkSel, fen });
  live.current = { board, shown, orientation, turn, darkOn, darkList, darkSel, fen };

  // A new position or the dark changing: no dark square stays selected.
  useLayoutEffect(() => setDarkSel(null), [fen, dark?.join(), interactive]);

  /** A move from the board (tap-tap or a drop): what it is, as the game sees it. */
  const userMove = (from: string, to: string, dropped: boolean) => {
    const s = live.current;
    if (s.darkList.length && touchesDark(from + to, s.darkList, s.fen)) {
      const piece = pieceAt(s.fen, from);
      // (A pawn you can see reaching the last rank: you pick its piece. From the dark: a queen.)
      if (piece?.type === "p" && !s.darkList.includes(from) && (to[1] === "8" || to[1] === "1")) return setPromotion({ from, to, dark: true });
      return onDarkRef.current?.(from + to);
    }
    const legal = (moves ?? legalMoves(s.fen)).filter((m) => m.startsWith(from + to));
    // (Hollow's dark takes a drop anywhere: an ordinary move that isn't on stays where it was.)
    if (!legal.length) return;
    landNext.current = dropped;
    dragged.current = dropped;
    if (legal.length > 1) {
      local.current = { pieces: slidePiece(s.shown, from, to), last: [from, to] };
      redraw();
      return setPromotion({ from, to });
    }
    let after: Map<string, PieceCode>;
    try {
      after = readPieces(applyMove(s.fen, legal[0]!));
    } catch {
      after = slidePiece(s.shown, from, to);
    }
    local.current = { pieces: after, last: [from, to] };
    redraw();
    onMoveRef.current?.(legal[0]!);
  };

  const boxOf = (): Box => {
    const r = boardRef.current!.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };

  /** The element of the piece a press holds. */
  const heldEl = () => (pressId.current !== null ? pieceEls.current.get(pressId.current) : undefined);

  /** Puts the dragged piece's centre under the pointer. */
  const dragTo = (p: Press) => {
    const el = heldEl();
    const b = pressBox.current;
    if (!el || !b) return;
    el.style.transform = `translate(${p.x - b.left - b.width / 16}px, ${p.y - b.top - b.height / 16}px)`;
  };

  const startDrag = () => {
    // (No slide while it follows the pointer.)
    heldEl()?.classList.add("dragging");
    setDragId(pressId.current);
  };

  /** Ends a drag: the piece back on its square at once (a move made meanwhile puts it on its new one). */
  const endDrag = (p: Press) => {
    const el = heldEl();
    if (el) {
      el.style.transform = place(p.from, live.current.orientation, live.current.turn);
      void el.offsetWidth;
    }
    setDragId(null);
  };

  const onDown = (e: PointerEvent) => {
    if (small) return;
    // (A second finger: the drag in progress is let go.)
    if (press.current) {
      cancelPress();
      return;
    }
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    const s = live.current;
    const box = boxOf();
    const sq = squareAtPoint(e.clientX, e.clientY, box, s.orientation, s.turn);
    if (!sq) return;
    // (A mouse press on the board starts no text selection; a touch's scrolling is decided in onTouch, below.)
    if (e.pointerType === "mouse") e.preventDefault();
    // Hollow's dark, before anything else: a dark square tapped is selected; with one selected, the next tap is the
    // attempt from it (your own piece in plain sight picks that one up instead; the same square lets go).
    if (s.darkOn) {
      const mine = s.shown.get(sq)?.[0] === turnColor && !s.darkList.includes(sq);
      if (s.darkSel) {
        if (sq === s.darkSel) return void setDarkSel(null);
        setDarkSel(null);
        if (!mine) return void onDarkRef.current?.(s.darkSel + sq);
      } else {
        const held = selected.current;
        if (held && sq !== held && mine) selected.current = null;
        if (s.darkList.includes(sq) && !held) {
          selected.current = null;
          setDarkSel(sq);
          return;
        }
      }
    }
    const r = pressDown(s.board, selected.current, sq, e.clientX, e.clientY, dragged.current);
    selected.current = r.selected;
    if (r.move) {
      dragged.current = false;
      userMove(r.move[0], r.move[1], false);
    } else if (r.press) {
      press.current = r.press;
      pressBox.current = box;
      pressPointer.current = e.pointerId;
      pressId.current = tr.pieces.find((q) => q.square === sq)?.id ?? null;
      boardRef.current?.setPointerCapture?.(e.pointerId);
      if (r.press.started) {
        startDrag();
        dragTo(r.press);
      }
    }
    redraw();
  };

  const onMovePointer = (e: PointerEvent) => {
    const p = press.current;
    if (!p || e.pointerId !== pressPointer.current) return;
    const s = live.current;
    const next = pressMove(p, e.clientX, e.clientY, squareAtPoint(e.clientX, e.clientY, pressBox.current!, s.orientation, s.turn));
    press.current = next;
    if (next.started && !p.started) startDrag();
    if (next.started) dragTo(next);
  };

  const onUp = (e: PointerEvent) => {
    const p = press.current;
    if (!p || e.pointerId !== pressPointer.current) return;
    press.current = null;
    pressPointer.current = null;
    const s = live.current;
    const to = e.type === "pointerup" ? squareAtPoint(e.clientX, e.clientY, pressBox.current!, s.orientation, s.turn) : null;
    const r = pressUp(s.board, selected.current, p, to);
    selected.current = r.selected;
    if (p.started) endDrag(p);
    if (r.move) userMove(r.move[0], r.move[1], true);
    redraw();
  };

  /** A press let go without a move (a second finger, or its piece gone from under it). */
  const cancelPress = () => {
    const p = press.current;
    if (!p) return;
    press.current = null;
    pressPointer.current = null;
    selected.current = null;
    if (p.started) endDrag(p);
    redraw();
  };

  // The piece being held left its square (a new position): the press is let go.
  useLayoutEffect(() => {
    const p = press.current;
    if (p && !tr.pieces.some((q) => q.id === pressId.current && q.square === p.from)) cancelPress();
  });

  // A touch that means the board (on a piece, near one, or with one selected) doesn't scroll the page; one on an empty
  // stretch with nothing selected still can.
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el || small) return;
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 1 || !e.cancelable) return;
      const t = e.touches[0]!;
      const s = live.current;
      const box = boxOf();
      const sq = squareAtPoint(t.clientX, t.clientY, box, s.orientation, s.turn);
      if (!sq) return;
      if (s.shown.has(sq) || selected.current || s.darkSel || pieceCloseTo(s.shown, t.clientX, t.clientY, box, s.orientation, s.turn)) e.preventDefault();
    };
    el.addEventListener("touchstart", onTouch, { passive: false });
    return () => el.removeEventListener("touchstart", onTouch);
  }, [small]);

  // ---------------- Its size ----------------
  // Before the first paint (a layout effect), and again whenever the wrap changes size: a whole multiple of 8 device
  // pixels, written on the wrap for everything drawn over the squares. (Measured without transforms: a board inside a
  // turning or shaking row keeps its size.)
  useLayoutEffect(() => {
    const root = rootRef.current!;
    const box = containerRef.current!;
    const wrap = root.parentElement!;
    const size = (w: number, h: number) => {
      if (!(w > 0)) return;
      const width = boardSize(w, window.devicePixelRatio || 1);
      const height = h > 0 ? width * (h / w) : width;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
      wrap.style.setProperty("--board-width", `${width}px`);
      wrap.style.setProperty("--board-height", `${height}px`);
    };
    const cs = getComputedStyle(root);
    size(parseFloat(cs.width), parseFloat(cs.height));
    const watch = new ResizeObserver((entries) => {
      const r = entries[entries.length - 1]!.contentRect;
      size(r.width, r.height);
    });
    watch.observe(root);
    return () => watch.disconnect();
  }, []);

  // ---------------- Drawing ----------------
  const sel = selected.current;
  const squares = new Map<string, string>();
  const mark = (sq: string, cls: string) => squares.set(sq, squares.has(sq) ? `${squares.get(sq)} ${cls}` : cls);
  if (shownLast) for (const sq of shownLast) mark(sq, "last-move");
  if (BOARD.checkHighlight && !local.current && inCheck(fen)) {
    const king = [...shown].find(([, p]) => p === `${turnColor}k`)?.[0];
    if (king) mark(king, "check");
  }
  if (sel) {
    mark(sel, "selected");
    if (canAct) for (const d of dests.get(sel) ?? []) mark(d, shown.has(d) ? "move-dest oc" : "move-dest");
  }
  for (const [sq, cls] of Object.entries(marks ?? {})) mark(sq, cls);
  if (darkSel && darkOn) mark(darkSel, "selected");

  const drawn = useMemo(() => drawArrows(arrows ?? [], orientation, turn), [arrows, orientation, turn]);
  const brushes = [...new Set(drawn.filter((a) => !a.circle).map((a) => a.brush))];
  const ghost = dragId !== null && press.current ? tr.pieces.find((q) => q.id === dragId) : undefined;
  const white = orientation === "white";
  const promoWhite = sideToMove(fen) === "w";

  return (
    <div class={`board-wrap ${small ? "board-small" : ""}`} data-dark-sel={darkSel ?? undefined} data-turn={turn || undefined}>
      <div ref={rootRef} class={`board hb orientation-${orientation}${small ? "" : " hb-manipulable"}${jump ? " hb-jump" : ""}`} data-board="own">
        <div ref={containerRef} class="hb-container">
          <div ref={boardRef} class="hb-board" style={{ backgroundImage: SQUARES_SVG }} onPointerDown={onDown} onPointerMove={onMovePointer} onPointerUp={onUp} onPointerCancel={onUp}>
            {[...squares].map(([sq, cls]) => (
              <square key={sq} class={cls} style={{ transform: place(sq, orientation, turn) }} />
            ))}
            {fading.map(({ piece }) => (
              <piece key={`f${piece.id}`} class={`${pieceClass(piece.code)} fading`} style={{ transform: place(piece.square, orientation, turn) }} />
            ))}
            {tr.pieces.map((p) => (
              <piece
                key={p.id}
                ref={(el: HTMLElement | null) => {
                  if (el) pieceEls.current.set(p.id, el);
                  else pieceEls.current.delete(p.id);
                }}
                data-square={p.square}
                class={`${pieceClass(p.code)}${tr.sliding.has(p.id) ? " anim" : ""}${p.id === dragId ? " dragging" : ""}`}
                style={{ transform: place(p.square, orientation, turn) }}
              />
            ))}
          </div>
          {drawn.length > 0 && (
            <svg class="hb-shapes" viewBox="-4 -4 8 8" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <defs>
                {brushes.map((b) => (
                  <marker key={b} id={`${uid}-${b}`} orient="auto" overflow="visible" markerWidth="4" markerHeight="4" refX="2.05" refY="2">
                    <path d="M0,0 V4 L3,2 Z" fill={BRUSHES[b].color} />
                  </marker>
                ))}
              </defs>
              <g>
                {drawn.map((a) =>
                  a.circle ? (
                    <circle key={a.key} stroke={BRUSHES[a.brush].color} stroke-width={4 / 64} fill="none" opacity={BRUSHES[a.brush].opacity} cx={a.circle.x} cy={a.circle.y} r={a.circle.r} />
                  ) : (
                    <line key={a.key} stroke={BRUSHES[a.brush].color} stroke-width={BRUSHES[a.brush].width / 64} stroke-linecap="round" marker-end={`url(#${uid}-${a.brush})`} opacity={BRUSHES[a.brush].opacity} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />
                  ),
                )}
              </g>
            </svg>
          )}
          {drawn.some((a) => a.label) && (
            <svg class="hb-labels" viewBox="-4 -4 8 8" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              {drawn.map(
                (a) =>
                  a.label && (
                    <g key={a.key} transform={`translate(${a.label.x},${a.label.y})`}>
                      <circle r={0.2} fill-opacity={0.8} stroke-opacity={0.7} stroke-width={0.03} fill={BRUSHES[a.brush].color} stroke="white" />
                      <text font-size={a.label.size} font-family="Noto Sans" text-anchor="middle" fill="white" y={a.label.textY}>
                        {a.label.text}
                      </text>
                    </g>
                  ),
              )}
            </svg>
          )}
          {!small && (
            <div class="hb-coords hb-ranks" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
                <span key={row} class={`hb-coord ${row % 2 ? "hb-on-dark" : "hb-on-light"}`}>
                  {coordLabel(String(white ? 8 - row : row + 1), "ranks", turn)}
                </span>
              ))}
            </div>
          )}
          {!small && (
            <div class="hb-coords hb-files" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((col) => (
                <span key={col} class={`hb-coord ${(col + 7) % 2 ? "hb-on-dark" : "hb-on-light"}`}>
                  {coordLabel(FILES[white ? col : 7 - col]!, "files", turn)}
                </span>
              ))}
            </div>
          )}
          {ghost && <piece class={`ghost ${pieceClass(ghost.code)}`} style={{ transform: place(ghost.square, orientation, turn) }} />}
        </div>
      </div>
      <BoardTurn.Provider value={turn}>{children}</BoardTurn.Provider>
      {promotion && (
        <div class="promo" role="dialog" aria-label="Promote to">
          {(["q", "r", "b", "n"] as const).map((p) => (
            <button
              type="button"
              key={p}
              class={`promo-piece ${promoWhite ? "white" : "black"} ${p}`}
              onClick={() => {
                const pr = promotion;
                setPromotion(null);
                if (pr.dark) onDarkRef.current?.(pr.from + pr.to + p);
                else onMoveRef.current?.(pr.from + pr.to + p);
              }}
              aria-label={{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[p]}
            >
              <piece class={`${promoWhite ? "white" : "black"} ${{ q: "queen", r: "rook", b: "bishop", n: "knight" }[p]}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
