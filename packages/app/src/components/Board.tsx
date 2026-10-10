import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";
import { legalMoves, pieceAt, sideToMove, touchesDark } from "@chessroyale/chess";
import { play } from "../sound.ts";
import { knockFor } from "../move-sound.ts";

export interface Arrow {
  move: string;
  brush: "green" | "blue" | "red" | "yellow" | "paleGrey" | "paleBlue";
  /** Short text on the arrow, e.g. an expected score. */
  label?: string;
}

interface BoardProps {
  fen: string;
  orientation: "white" | "black";
  lastMove?: string | null;
  /** Enable moving for the side to move. */
  interactive?: boolean;
  /** Only these moves may be played (default: every legal move). */
  moves?: readonly string[];
  onMove?: (uci: string) => void;
  arrows?: Arrow[];
  small?: boolean;
  /** Animate changes (off for instant jumps). */
  animate?: boolean;
  /** Drawn over the board (e.g. everyone's picks as see-through pieces). */
  children?: ComponentChildren;
  /** Extra square highlights under the pieces: square → class (e.g. the God King's Last Stand marks the blunder). */
  marks?: Readonly<Record<string, string>>;
  /**
   * Hollow's dark: the squares covered (their pieces hidden by the power layer). No move dots from, onto or past them;
   * a tap on one selects it (the green glow, no dots, nothing picked up); and any move attempt that touches one goes to
   * `onDarkTry` unchecked (the server says whether it was legal).
   */
  dark?: readonly string[];
  onDarkTry?: (uci: string) => void;
}

const sq = (s: string) => s as Key;

function destsFor(fen: string, only?: readonly string[], dark: readonly string[] = []): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const m of only ?? legalMoves(fen)) {
    // (Hollow's dark: no dots from, onto or past a dark square: they'd give its piece away.)
    if (touchesDark(m, dark, fen)) continue;
    const from = sq(m.slice(0, 2));
    const to = sq(m.slice(2, 4));
    const list = dests.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    dests.set(from, list);
  }
  return dests;
}

function shapesFor(arrows: Arrow[] = []): DrawShape[] {
  return arrows.map((a) => ({
    orig: sq(a.move.slice(0, 2)),
    dest: sq(a.move.slice(2, 4)),
    brush: a.brush,
    ...(a.label ? { label: { text: a.label } } : {}),
  }));
}

/** Chessground board. Tap a piece then a square, or drag. Pawns reaching the last rank open a promotion picker. */
export function Board({ fen, orientation, lastMove, interactive, moves, onMove, arrows, small, animate = true, children, marks, dark, onDarkTry }: BoardProps) {
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
  const live = useRef({ fen, dark: dark ?? [], darkOn, darkSel, sync: () => {} });
  live.current = { ...live.current, fen, dark: dark ?? [], darkOn, darkSel };
  const prevFen = useRef<string | null>(null);
  const lastSound = useRef(0);

  // A move appearing on a big board makes a sound (a capture sounds different). Before the paint (a layout effect),
  // and a board that takes over from another screen's knocks for the move made there (knockFor): a screen replaced
  // before it painted never ran its effects, and your own move went silent.
  useLayoutEffect(() => {
    const prev = prevFen.current;
    prevFen.current = fen;
    if (small) return;
    const knock = knockFor(prev, fen, lastMove);
    if (!knock) return;
    // A fast replay (a whole game from move 0) would be a clatter: at most one knock every 180 ms.
    const now = performance.now();
    if (now - lastSound.current < 180) return;
    lastSound.current = now;
    play(knock);
  }, [fen]);

  // The board is built, and kept in step, before the browser paints (layout effects): a plain effect runs after the
  // first paint, so every new board (each phase of a match is its own screen) showed one frame with no board at all.
  useLayoutEffect(() => {
    api.current = Chessground(el.current!, {
      fen,
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
    const resize = new ResizeObserver(() => api.current?.redrawAll());
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
    const sync = () =>
      api.current?.set({
        fen,
        orientation,
        turnColor: color,
        selectable: { enabled: !!interactive },
        animation: { enabled: animate, duration: 220 },
        lastMove: lastMove ? [sq(lastMove.slice(0, 2)), sq(lastMove.slice(2, 4))] : undefined,
        highlight: {
          lastMove: true,
          check: true,
          custom: new Map([...Object.entries(marks ?? {}), ...(darkSel && darkOn ? [[darkSel, "selected"] as const] : [])].map(([k, v]) => [sq(k), v])),
        },
        check: undefined,
        movable: {
          color: interactive ? color : undefined,
          // (Hollow's dark: any square takes a drop, and the attempt is judged below: one touching the dark goes out
          // unchecked, an ordinary illegal one goes back.)
          free: darkList.length > 0,
          dests: interactive ? destsFor(fen, moves, darkList) : new Map(),
          events: {
            after: (from, to) => {
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
    api.current?.setAutoShapes(shapesFor(arrows));
  }, [fen, orientation, lastMove, interactive, arrows, animate, moves?.join(), JSON.stringify(marks ?? null), darkOn, dark?.join(), darkSel]);

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
      const key = api.current.getKeyAtDomPos([t.clientX, t.clientY]) as string | undefined;
      if (!key) return;
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
      const held = api.current.state.selected as string | undefined;
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
    <div class={`board-wrap ${small ? "board-small" : ""}`} data-dark-sel={darkSel ?? undefined}>
      <div ref={el} class="board" />
      {children}
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

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      piece: { class?: string; key?: string; style?: Record<string, string> };
    }
  }
}
