/**
 * Board lab (/boardlab, throwaway, not linked anywhere): try candidate boards by feel. Play both sides from the start.
 * ?board=cg (the game's chessground board) | own (the game's own board, board/OwnBoard.tsx: Eric's pick, Oct 12) | cm
 * (cm-chessboard), plus anim, drag and dots options for cm. Both game boards are the real ones, as the game sets them
 * up. Remove or admin-gate before a public launch (DECISIONS.md).
 */
import type { ComponentType } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { applyMove, inCheck, legalMoves, START_FEN } from "@chessroyale/chess";
import { Board } from "../components/Board.tsx";
import { moveKnock } from "../move-sound.ts";
import { play } from "../sound.ts";
import type { LabBoardProps, LabOpts } from "./types.ts";
import "./boardlab.css";

type BoardKind = LabOpts["board"] | "cg";
/** The game's own boards (not the lab's options). */
const GAME_BOARDS: readonly BoardKind[] = ["cg", "own"];
type Opts = Omit<LabOpts, "board"> & { board: BoardKind };

const CHOICES: { [K in keyof Opts]: readonly Opts[K][] } = {
  board: ["cg", "cm", "own"],
  anim: ["fast", "normal", "slow"],
  drag: ["on", "off"],
  dots: ["on", "off"],
  pieces: ["game"],
};
const DEFAULTS: Opts = { board: "cg", anim: "normal", drag: "on", dots: "on", pieces: "game" };

function optsFromUrl(): Opts {
  const q = new URLSearchParams(location.search);
  const out = { ...DEFAULTS } as Record<string, string>;
  for (const [k, list] of Object.entries(CHOICES)) {
    const v = q.get(k);
    if (v && (list as readonly string[]).includes(v)) out[k] = v;
  }
  return out as unknown as Opts;
}

function urlFor(o: Opts): string {
  const q = new URLSearchParams();
  for (const k of Object.keys(CHOICES) as (keyof Opts)[]) if (k === "board" || o[k] !== DEFAULTS[k]) q.set(k, o[k]);
  return `/boardlab?${q}`;
}

const kingSquare = (fen: string, color: "w" | "b"): string | null => {
  const rows = fen.split(" ")[0]!.split("/");
  for (let i = 0; i < 8; i++) {
    let f = 0;
    for (const ch of rows[i]!) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        if (ch === (color === "w" ? "K" : "k")) return `${"abcdefgh"[f]}${8 - i}`;
        f++;
      }
    }
  }
  return null;
};

export function BoardLab() {
  const [opts, setOpts] = useState<Opts>(optsFromUrl);
  const [moves, setMoves] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [Impl, setImpl] = useState<{ kind: BoardKind; C: ComponentType<LabBoardProps> } | null>(null);

  const fens = useMemo(() => {
    const out = [START_FEN];
    for (const m of moves) out.push(applyMove(out[out.length - 1]!, m));
    return out;
  }, [moves]);
  const fen = fens[fens.length - 1]!;
  const lastMove = moves[moves.length - 1] ?? null;
  const legal = useMemo(() => legalMoves(fen), [fen]);
  const dests = useMemo(() => {
    const d = new Map<string, string[]>();
    for (const m of legal) {
      const from = m.slice(0, 2);
      const to = m.slice(2, 4);
      const list = d.get(from) ?? [];
      if (!list.includes(to)) list.push(to);
      d.set(from, list);
    }
    return d;
  }, [legal]);
  const turn = fen.split(" ")[1] as "w" | "b";
  const check = inCheck(fen) ? kingSquare(fen, turn) : null;

  // The board's code loads only when it's picked.
  useEffect(() => {
    if (opts.board !== "cm") return;
    let on = true;
    void import("./CmBoard.tsx").then((m) => on && setImpl({ kind: "cm", C: m.CmBoard }));
    return () => {
      on = false;
    };
  }, [opts.board]);

  const set = (k: keyof Opts, v: string) => {
    const next = { ...opts, [k]: v } as Opts;
    setOpts(next);
    history.replaceState(null, "", urlFor(next));
  };

  /** Plays a move (UCI); a pawn reaching the last rank becomes a queen. The game board (cg) knocks for itself. */
  const playUci = (uci: string, knock: boolean) => {
    const m = legal.find((l) => l === uci) ?? legal.find((l) => l === `${uci}q`);
    if (!m) return false;
    if (knock) {
      const k = moveKnock(fen, applyMove(fen, m), m);
      if (k) play(k);
    }
    setMoves((list) => [...list, m]);
    return true;
  };

  const status = !legal.length ? (check ? `Checkmate: ${turn === "w" ? "Black" : "White"} wins` : "Stalemate") : `${turn === "w" ? "White" : "Black"} to move${check ? " (check)" : ""}`;
  const boardProps: LabBoardProps = {
    fen,
    lastMove,
    orientation,
    opts: { ...opts, board: "cm" },
    dests,
    check,
    onMove: (from, to) => playUci(from + to, true),
  };

  return (
    <div class="bl-page" data-ply={moves.length} data-fen={fen}>
      <div class="bl-chips">
        {(Object.keys(CHOICES) as (keyof Opts)[]).map((k) => (
          <div class={`bl-group${k !== "board" && GAME_BOARDS.includes(opts.board) ? " bl-off" : ""}`} key={k}>
            <span class="bl-label">{k}</span>
            {CHOICES[k].map((v) => (
              <button type="button" key={v} class={`bl-chip${opts[k] === v ? " bl-chip-on" : ""}`} data-opt={`${k}=${v}`} onClick={() => set(k, v)}>
                {v}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div class="bl-board" data-board={opts.board}>
        {GAME_BOARDS.includes(opts.board) ? (
          <Board key={opts.board} impl={opts.board === "own" ? "own" : "chessground"} fen={fen} orientation={orientation} lastMove={lastMove} interactive onMove={(uci) => playUci(uci, false)} />
        ) : Impl?.kind === opts.board ? (
          <Impl.C {...boardProps} />
        ) : null}
      </div>
      <div class="bl-bar">
        <span class="bl-status">{status}</span>
        <button type="button" class="btn btn-secondary bl-btn" onClick={() => setMoves((l) => l.slice(0, -1))} disabled={!moves.length}>
          Undo
        </button>
        <button type="button" class="btn btn-secondary bl-btn" onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}>
          Flip
        </button>
        <button type="button" class="btn btn-secondary bl-btn" onClick={() => setMoves([])} disabled={!moves.length}>
          Reset
        </button>
      </div>
      <p class="bl-note">
        Board lab.{" "}
        {GAME_BOARDS.includes(opts.board)
          ? `${opts.board === "cg" ? "cg is the chessground board" : "own is our own board"} as the game sets it up (220 ms slides, promotion picker); the other options apply to cm.`
          : "Pawns promote to a queen."}
      </p>
    </div>
  );
}
