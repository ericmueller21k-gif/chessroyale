/**
 * Board lab (throwaway): cm-chessboard (MIT, https://github.com/shaack/cm-chessboard) driven by our rules.
 * Rebuilt whenever an option changes (pieces, speed, drag, dots), so each option is exactly what the library does.
 */
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
import { BORDER_TYPE, Chessboard, COLOR, INPUT_EVENT_TYPE } from "cm-chessboard/src/Chessboard.js";
import { MARKER_TYPE, Markers } from "cm-chessboard/src/extensions/markers/Markers.js";
import markersSvg from "cm-chessboard/assets/extensions/markers/markers.svg?raw";
import "cm-chessboard/assets/chessboard.css";
import "cm-chessboard/assets/extensions/markers/markers.css";
import { spriteUrl } from "./pieces.ts";
import { ANIM_MS, type LabBoardProps } from "./types.ts";

const LAST = { class: "bl-cm-last", slice: "markerSquare" };
const CHECK = { class: "bl-cm-check", slice: "markerCircleFilled" };
let markersUrl: string | null = null;

/** The sprites are cached in the page under fixed ids: drop them so a rebuilt board loads its own set. */
function dropSpriteCache() {
  for (const id of ["cm-chessboard-sprite", "cm-chessboard-markers"]) document.getElementById(id)?.remove();
}

export function CmBoard(props: LabBoardProps) {
  const el = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const board = useRef<any>(null);
  const live = useRef(props);
  live.current = props;
  const { opts } = props;

  useLayoutEffect(() => {
    dropSpriteCache();
    markersUrl ??= URL.createObjectURL(new Blob([markersSvg], { type: "image/svg+xml" }));
    const p = live.current;
    const b = new Chessboard(el.current!, {
      position: p.fen,
      orientation: p.orientation === "white" ? COLOR.white : COLOR.black,
      assetsUrl: "",
      style: {
        cssClass: "default",
        showCoordinates: true,
        borderType: BORDER_TYPE.none,
        pieces: { file: spriteUrl(opts.pieces), tileSize: 40 },
        animationDuration: ANIM_MS[opts.anim],
      },
      extensions: [{ class: Markers, props: { sprite: markersUrl, autoMarkers: MARKER_TYPE.frame } }],
    });
    board.current = b;
    b.enableMoveInput((event: { type: string; squareFrom: string; squareTo: string; animate?: boolean; chessboard: typeof b }) => {
      const cur = live.current;
      switch (event.type) {
        case INPUT_EVENT_TYPE.moveInputStarted: {
          const dests = cur.dests.get(event.squareFrom);
          if (!dests?.length) return false;
          if (cur.opts.dots === "on") b.addLegalMovesMarkers(dests.map((to) => ({ to })));
          return true;
        }
        case INPUT_EVENT_TYPE.validateMoveInput: {
          b.removeLegalMovesMarkers();
          return cur.onMove(event.squareFrom, event.squareTo);
        }
        case INPUT_EVENT_TYPE.moveInputCanceled:
        case INPUT_EVENT_TYPE.moveInputFinished:
          b.removeLegalMovesMarkers();
          return;
      }
    });
    // drag=off: the library has no switch, so it never hears the pointer moving while pressed (taps still work).
    const stop = (e: Event) => {
      if (live.current.opts.drag === "off") e.stopPropagation();
    };
    window.addEventListener("mousemove", stop, true);
    window.addEventListener("touchmove", stop, true);
    sync(b, live.current, false);
    return () => {
      window.removeEventListener("mousemove", stop, true);
      window.removeEventListener("touchmove", stop, true);
      b.destroy();
      board.current = null;
      if (el.current) el.current.innerHTML = "";
    };
  }, [opts.pieces, opts.anim, opts.dots, opts.drag]);

  // Position, last move and orientation follow the game.
  const shown = useRef({ fen: props.fen, orientation: props.orientation });
  useEffect(() => {
    const b = board.current;
    if (!b) return;
    const flip = shown.current.orientation !== props.orientation;
    shown.current = { fen: props.fen, orientation: props.orientation };
    if (flip) void b.setOrientation(props.orientation === "white" ? COLOR.white : COLOR.black, true);
    sync(b, props, true);
  }, [props.fen, props.orientation, props.lastMove, props.check]);

  return <div class="bl-cm" ref={el} />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sync(b: any, p: LabBoardProps, animated: boolean) {
  // After the player's own move has finished animating (castling's rook, en passant and promotion come from the FEN).
  void b.state.moveInputProcess.then(() => {
    if (!b.state) return;
    void b.setPosition(p.fen, animated);
    b.removeMarkers(LAST);
    b.removeMarkers(CHECK);
    if (p.lastMove) {
      b.addMarker(LAST, p.lastMove.slice(0, 2));
      b.addMarker(LAST, p.lastMove.slice(2, 4));
    }
    if (p.check) b.addMarker(CHECK, p.check);
  });
}
