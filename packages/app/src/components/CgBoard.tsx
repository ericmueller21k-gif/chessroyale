import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";
import { BOARD } from "@chessroyale/core";
import { inCheck, legalMoves, pieceAt, sideToMove, touchesDark } from "@chessroyale/chess";
import { BoardTurn, coordLabel, realSquare, viewFen, viewSquare, type QuarterTurn } from "../board-view.ts";
import type { Arrow, BoardProps } from "../board/types.ts";

const sq = (s: string) => s as Key;

function destsFor(fen: string, only?: readonly string[], dark: readonly string[] = [], turn: QuarterTurn = 0): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const m of only ?? legalMoves(fen)) {
    // (Hollow's dark: no dots from, onto or past a dark square: they'd give its piece away.)
    if (touchesDark(m, dark, fen)) continue;
    const from = sq(viewSquare(m.slice(0, 2), turn));
    const to = sq(viewSquare(m.slice(2, 4), turn));
    const list = dests.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    dests.set(from, list);
  }
  return dests;
}

function shapesFor(arrows: Arrow[] = [], turn: QuarterTurn = 0): DrawShape[] {
  return arrows.map((a) => ({
    orig: sq(viewSquare(a.move.slice(0, 2), turn)),
    dest: sq(viewSquare(a.move.slice(2, 4), turn)),
    brush: a.brush,
    ...(a.label ? { label: { text: a.label } } : {}),
  }));
}

/**
 * The chessground board (BOARD.impl "chessground", today's default; being replaced by our own, board/OwnBoard.tsx).
 * Tap a piece then a square, or drag. Pawns reaching the last rank open a promotion picker.
 */
export function CgBoard({ fen, orientation, lastMove, interactive, moves, onMove, arrows, small, animate = true, children, marks, dark, onDarkTry, turn = 0 }: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string; dark?: boolean } | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onDarkRef = useRef(onDarkTry);
  onDarkRef.current = onDarkTry;
  // Hollow's dark: a dark square tapped (selected without picking anything up), and the board as it should be now.
  const [darkSel, setDarkSel] = useState<string | null>(null);
  const darkOn = !!interactive && !!dark?.length && !!onDarkTry;
  const live = useRef({ fen, dark: dark ?? [], darkOn, darkSel, turn, sync: () => {} });
  live.current = { ...live.current, fen, dark: dark ?? [], darkOn, darkSel, turn };
  // (The turn the board was last drawn at: a new turn moves every piece at once, not as a move.)
  const drawnTurn = useRef<QuarterTurn>(turn);
  // The board is built, and kept in step, before the browser paints (layout effects): a plain effect runs after the
  // first paint, so every new board (each phase of a match is its own screen) showed one frame with no board at all.
  useLayoutEffect(() => {
    api.current = Chessground(el.current!, {
      // (Already turned, if the board is: a board made unturned and then turned flies every piece across it.)
      fen: viewFen(fen, turn),
      orientation,
      coordinates: !small,
      // Input is wired up only when a board is created interactive, so big boards always are;
      // `movable` and `selectable` decide whether moving is allowed right now.
      viewOnly: !!small,
      selectable: { enabled: !!interactive },
      animation: { enabled: animate, duration: 220 },
      highlight: { lastMove: true, check: true },
      movable: { free: false, showDests: true },
      draggable: { enabled: !small, showGhost: true },
      premovable: { enabled: false },
      drawable: { enabled: false, visible: true },
      // Chessground draws its squares in a box it shrinks to a whole multiple of 8 device pixels (up to 8 px smaller
      // than the wrap at a fractional zoom or display scale), and writes that exact size to ---cg-width on the wrap
      // every time it sizes the board. Overlays size and place themselves by it (--cg-size in styles.css), never by
      // the wrap: a ring placed in % of the wrap drifted off its square by a few pixels toward the board's far side.
      addDimensionsCssVarsTo: el.current!.parentElement!,
    });
    // (Redrawing makes chessground's coordinates afresh: named for a turned board again.)
    const resize = new ResizeObserver(() => {
      api.current?.redrawAll();
      relabel(el.current, live.current.turn);
    });
    resize.observe(el.current!);
    return () => {
      resize.disconnect();
      api.current?.destroy();
    };
  }, []);

  useLayoutEffect(() => {
    const color = sideToMove(fen) === "w" ? "white" : "black";
    const only = moves;
    const darkList = darkOn ? (dark ?? []) : [];
    // (A new turn of the board: its pieces jump to their new squares, never fly there as if moved.)
    const turned = drawnTurn.current !== turn;
    drawnTurn.current = turn;
    const sync = () =>
      api.current?.set({
        fen: viewFen(fen, turn),
        orientation,
        turnColor: color,
        selectable: { enabled: !!interactive },
        animation: { enabled: animate && !turned, duration: 220 },
        lastMove: lastMove ? [sq(viewSquare(lastMove.slice(0, 2), turn)), sq(viewSquare(lastMove.slice(2, 4), turn))] : undefined,
        highlight: {
          lastMove: true,
          check: true,
          custom: new Map([...Object.entries(marks ?? {}), ...(darkSel && darkOn ? [[darkSel, "selected"] as const] : [])].map(([k, v]) => [sq(viewSquare(k, turn)), v])),
        },
        check: BOARD.checkHighlight && inCheck(fen) ? color : undefined,
        movable: {
          color: interactive ? color : undefined,
          // (Hollow's dark: any square takes a drop, and the attempt is judged below: one touching the dark goes out
          // unchecked, an ordinary illegal one goes back.)
          free: darkList.length > 0,
          dests: interactive ? destsFor(fen, moves, darkList, turn) : new Map(),
          events: {
            // (Chessground's squares are the view's: turned back to the real ones.)
            after: (viewFrom, viewTo) => {
              const from = realSquare(viewFrom, turn);
              const to = realSquare(viewTo, turn);
              if (darkList.length && touchesDark(from + to, darkList, fen)) {
                sync();
                const piece = pieceAt(fen, from);
                // (A pawn you can see reaching the last rank: you pick its piece. From the dark: a queen.)
                if (piece?.type === "p" && !darkList.includes(from) && (to[1] === "8" || to[1] === "1")) return setPromotion({ from, to, dark: true });
                return onDarkRef.current?.(from + to);
              }
              const moves = (only ?? legalMoves(fen)).filter((m) => m.startsWith(from + to));
              if (moves.length > 1) setPromotion({ from, to });
              else if (moves[0]) onMoveRef.current?.(moves[0]);
              // (Free for the dark: an ordinary move that isn't on goes back.)
              else if (darkList.length) sync();
            },
          },
        },
      });
    live.current.sync = () => void sync();
    sync();
    api.current?.setAutoShapes(shapesFor(arrows, turn));
    relabel(el.current, turn);
  }, [fen, orientation, lastMove, interactive, arrows, animate, moves?.join(), JSON.stringify(marks ?? null), darkOn, dark?.join(), darkSel, turn]);

  // A new position or the dark changing: no dark square stays selected.
  useLayoutEffect(() => setDarkSel(null), [fen, dark?.join(), interactive]);

  // Hollow's dark: taps are looked at before chessground sees them. A dark square tapped with nothing picked up is
  // selected (no piece lifted, no dots); with it selected, the next tap is the attempt from it (your own piece in plain
  // sight picks that one up instead; the same square again lets go). A tap on your own piece in plain sight while
  // another is picked up picks it up (in the dark's free mode chessground would move onto it).
  useLayoutEffect(() => {
    const box = el.current;
    if (!box) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const s = live.current;
      if (!s.darkOn || !api.current) return;
      const t = "touches" in e ? e.touches[0] : e;
      if (!t) return;
      const viewKey = api.current.getKeyAtDomPos([t.clientX, t.clientY]) as string | undefined;
      if (!viewKey) return;
      const key = realSquare(viewKey, s.turn);
      const mine = pieceAt(s.fen, key)?.color === sideToMove(s.fen) && !s.dark.includes(key);
      const stop = () => {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
      };
      if (s.darkSel) {
        if (key === s.darkSel) {
          stop();
          return setDarkSel(null);
        }
        setDarkSel(null);
        if (mine) return;
        stop();
        return onDarkRef.current?.(s.darkSel + key);
      }
      const heldView = api.current.state.selected as string | undefined;
      const held = heldView ? realSquare(heldView, s.turn) : undefined;
      if (held && key !== held && mine) return void api.current.selectSquare(null);
      if (s.dark.includes(key) && !held) {
        stop();
        setDarkSel(key);
      }
    };
    box.addEventListener("mousedown", onDown, { capture: true });
    box.addEventListener("touchstart", onDown, { capture: true, passive: false });
    return () => {
      box.removeEventListener("mousedown", onDown, { capture: true });
      box.removeEventListener("touchstart", onDown, { capture: true });
    };
  }, []);

  const promote = (piece: string) => {
    if (!promotion) return;
    setPromotion(null);
    if (promotion.dark) return onDarkRef.current?.(promotion.from + promotion.to + piece);
    onMoveRef.current?.(promotion.from + promotion.to + piece);
  };

  const white = sideToMove(fen) === "w";
  return (
    <div class={`board-wrap ${small ? "board-small" : ""}`} data-dark-sel={darkSel ?? undefined} data-turn={turn || undefined}>
      <div ref={el} class="board" />
      <BoardTurn.Provider value={turn}>{children}</BoardTurn.Provider>
      {promotion && (
        <div class="promo" role="dialog" aria-label="Promote to">
          {(["q", "r", "b", "n"] as const).map((p) => (
            <button type="button" key={p} class={`promo-piece ${white ? "white" : "black"} ${p}`} onClick={() => promote(p)} aria-label={{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[p]}>
              <piece class={`${white ? "white" : "black"} ${{ q: "queen", r: "rook", b: "bishop", n: "knight" }[p]}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Chessground's coordinates on a turned board name the real squares (coordLabel): its edge along the bottom runs along
 * the real ranks, the one at the side along the real files. What chessground wrote is kept on each label, so naming
 * them again (after a redraw, or a new turn) starts from it.
 */
function relabel(board: HTMLElement | null, turn: QuarterTurn) {
  const wrap = board;
  if (!wrap) return;
  for (const kind of ["files", "ranks"] as const) {
    for (const c of wrap.querySelectorAll<HTMLElement>(`coords.${kind} coord`)) {
      const own = (c.dataset.cg ??= c.textContent ?? "");
      const label = coordLabel(own, kind, turn);
      if (c.textContent !== label) c.textContent = label;
    }
  }
}
