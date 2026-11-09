import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { boardPieces, rushFen, rushJudge, rushMovesLeft, rushSquares, rushTimeline, withPieces, type DashView } from "@chessroyale/chess";
import { BOSS_POWERS } from "@chessroyale/core";
import { hash } from "../characters/boss-beats.ts";
import { DASH_FIGURE, DASH_RUN } from "../characters/dash-figure.ts";
import { DASH_RUSH_LINES } from "../characters/dash-lines.ts";
import { renderFrame } from "../characters/sprite.ts";
import { kingSay } from "../godKing.ts";
import { play } from "../sound.ts";
import { CRITICAL, bossVoice } from "../speech.tsx";
import type { BossView, RushView } from "../game.ts";
import { squareXY } from "./GodKing.tsx";
import { InPlace } from "./PowerParts.tsx";

/**
 * Dash's Scramble Rush on screen (Eric, Nov 6; his rules: packages/chess/src/bosses/dash.ts; docs/decisions/2026-11-06-dash-v2.md).
 * The game's position never changes: the board shows what this says, then the position as it was.
 * - "1.00" ticking down to "0.00" over five seconds (a second that lasts five), in his banner's colors over the board; inside it
 *   five copies of him run across the whole board along rows and diagonals, crossing, each with his trail (two afterimages and
 *   a streak), several passes each. A swept piece is gone as a copy runs over its square and on its new square as one passes
 *   there: no piece slides (`rushRuns`, `rushShownFen`).
 * - His line ("Hope I wasn't too quick for you."), then the God King's ("Put the pieces back…"), alive or fallen.
 * - Ten seconds, the same banner at the board's top (taps go through it): drag or tap the swept pieces (orange edges) to any free
 *   square, each at most dashScramble.movesPerPiece times (Eric, Nov 6; a try after that: the piece shakes, "No more tries" fades
 *   over it, it stays); a piece on a square where one like it stood gets a green edge (a soft blip), anywhere else a red edge
 *   (a buzz) and his word ("Close, but not quite!" a square off, else "Not even close."). He smacks his clock, impatient.
 * - Time's up: the board as it was, and the verdict (the crowd's, once judged): enough back, the God King's "Well remembered!";
 *   else his extra move follows, with his line.
 */

type Rush = NonNullable<DashView["rush"]>;
const S = BOSS_POWERS.dashScramble;
const PIECE_NAMES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const pieceClass = (code: string) => `${code[0] === "w" ? "white" : "black"} ${PIECE_NAMES[code[1]!]}`;

// ---------------- His copies' runs ----------------

/** One copy's pass across the board: from square `a` to square `b`, `start` to `start + ms` (ms from the Rush's start). */
export interface RushRun {
  copy: number;
  start: number;
  ms: number;
  a: string;
  b: string;
}

const COPIES = 5;
const RUN_MS = 900;
const SLOT_MS = 1100;
const STAGGER_MS = 80;
const sq = (f: number, r: number) => `${"abcdefgh"[f]}${r + 1}`;
const steps = (a: string, b: string) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));

/** A line across the whole board through `s`: its rank, or one of its diagonals (one at least four squares long), either way. */
function lineThrough(s: string, kind: number, reverse: boolean): [string, string] {
  const f = s.charCodeAt(0) - 97;
  const r = Number(s[1]) - 1;
  const diag = (df: number): [string, string] | null => {
    // (Down-left to up-right, or up-left to down-right.)
    const back = df > 0 ? Math.min(f, r) : Math.min(f, 7 - r);
    const on = df > 0 ? Math.min(7 - f, 7 - r) : Math.min(7 - f, r);
    return back + on >= 3 ? [sq(f - back, df > 0 ? r - back : r + back), sq(f + on, df > 0 ? r + on : r - on)] : null;
  };
  const line = (kind % 3 === 1 ? diag(1) : kind % 3 === 2 ? diag(-1) : null) ?? diag(kind % 2 ? -1 : 1) ?? [sq(0, r), sq(7, r)];
  return reverse ? [line[1], line[0]] : line;
}

/**
 * The copies' passes (three slots, five copies each, a little apart) and when each swept piece goes (`gone`, by its square
 * before the sweep: a copy over it) and lands (`land`: a copy over its new square, in a later slot). The scoops go first, then
 * the drops; any slot left over is a pass through a square of the seed's. The same on every screen (from the sweep itself).
 */
export function rushRuns(rush: Pick<Rush, "at" | "moves">, s: Pick<typeof S, "scatterAt"> = S): { runs: RushRun[]; gone: Record<string, number>; land: Record<string, number> } {
  const seed = hash(`${rush.at}:${rush.moves.map((m) => m.from + m.to).join()}`);
  const pending = [...rush.moves.map((m, i) => ({ drop: false, i, square: m.from })), ...rush.moves.map((m, i) => ({ drop: true, i, square: m.to }))];
  const scoopSlot: Record<number, number> = {};
  const runs: RushRun[] = [];
  const gone: Record<string, number> = {};
  const land: Record<string, number> = {};
  for (let slot = 0; slot < 3; slot++)
    for (let copy = 0; copy < COPIES; copy++) {
      const k = slot * COPIES + copy;
      const start = s.scatterAt + slot * SLOT_MS + copy * STAGGER_MS;
      const ti = pending.findIndex((t) => !t.drop || (scoopSlot[t.i] !== undefined && scoopSlot[t.i]! < slot));
      const task = ti >= 0 ? pending.splice(ti, 1)[0]! : null;
      const through = task ? task.square : sq((seed >>> (k % 24)) % 8, (seed >>> ((k * 3) % 24)) % 8);
      const [a, b] = lineThrough(through, (seed >>> k) + k, ((seed >>> (k + 3)) & 1) === 1);
      runs.push({ copy, start, ms: RUN_MS, a, b });
      if (!task) continue;
      const at = start + (RUN_MS * steps(a, through)) / Math.max(1, steps(a, b));
      if (task.drop) land[rush.moves[task.i]!.from] = at;
      else {
        gone[rush.moves[task.i]!.from] = at;
        scoopSlot[task.i] = slot;
      }
    }
  return { runs, gone, land };
}

/** The board during the sweep (`t` ms into the Rush): each swept piece on its square until a copy runs over it, on its new square once one has passed there. */
export function rushShownFen(fen: string, rush: Pick<Rush, "at" | "moves">, t: number): string {
  const { gone, land } = rushRuns(rush);
  const pieces = boardPieces(fen);
  for (const m of rush.moves) if (t >= gone[m.from]!) pieces.delete(m.from);
  for (const m of rush.moves) if (t >= land[m.from]!) pieces.set(m.to, m.piece);
  return withPieces(fen, pieces);
}

/** Where the Rush stands at `now`: the sweep (and his and the God King's lines), your ten seconds, or time's up (the board as it was). */
export function rushStage(rush: Pick<Rush, "correct">, view: Pick<RushView, "at">, now: number): "sweep" | "place" | "done" {
  const t = now - view.at;
  const tl = rushTimeline();
  return t < tl.placeAt ? "sweep" : t < tl.placeUntil && rush.correct === undefined ? "place" : "done";
}

/** The board the screen shows in the Rush (the game's own position before it and after time's up). */
export function rushBoard(boss: BossView, view: RushView, now: number): string {
  const rush = boss.powers?.dash?.rush;
  if (!rush) return boss.board.fen;
  const stage = rushStage(rush, view, now);
  return stage === "sweep" ? rushShownFen(boss.board.fen, rush, now - view.at) : stage === "place" ? rushFen(boss.board.fen, rush, view.places) : boss.board.fen;
}

/** The dock's two lines in the Rush: what's on, and what it means for you. */
export function rushDock(boss: BossView, view: RushView, now: number): { line: string; sub: string } {
  const rush = boss.powers?.dash?.rush;
  if (!rush) return { line: "", sub: "" };
  const n = rush.moves.length;
  const need = Math.min(S.needCorrect, n);
  const stage = rushStage(rush, view, now);
  if (stage === "sweep") return { line: "Scramble Rush!", sub: `Watch his pieces: ${need} of ${n} back, or he moves twice.` };
  const right = rushJudge(boss.board.fen, rush, view.places).correct;
  if (stage === "place") return { line: `${right} of ${n} back`, sub: `${need} needed. Drag or tap them home.` };
  if (rush.correct === undefined) return { line: `Time's up: ${right} of ${n}`, sub: "The board as it was." };
  // (The verdict's own count: yours alone solo; online, the crowd's mean, with yours beside it when it differs. Its word follows
  // `extra`, the same field his extra move goes by, so the line and the move never disagree; Nov 8.)
  const crowd = rush.correct !== right;
  const count = crowd ? `Crowd: ${rush.correct} of ${n}` : `${right} of ${n}`;
  // "you" only for a viewer who put pieces back (not a spectator, nor one who was out; review of #561).
  const yours = crowd && Object.keys(view.places).length ? ` (On average; you: ${right}.)` : "";
  if (rush.extra === "skipped") return { line: `${count}: too few`, sub: `No quiet move for him: your move.${yours}` };
  return rush.extra ? { line: `${count}: too few`, sub: `He moves again.${yours}` } : { line: `${count}: well done!`, sub: `The board as it was. Your move.${yours}` };
}

// ---------------- His running copy ----------------

/** His running copy, drawn once a page (a data URL: every copy and afterimage is the same picture). */
let runImage: string | null = null;
function runUrl(): string | null {
  if (runImage || typeof document === "undefined") return runImage;
  const r = renderFrame(DASH_FIGURE, DASH_RUN);
  const c = document.createElement("canvas");
  c.width = r.w;
  c.height = r.h;
  const g = c.getContext("2d");
  if (!g) return null;
  g.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
  return (runImage = c.toDataURL());
}

/** A copy's place at `t` (board units, 0-800), from the side the board is seen. */
function runAt(run: RushRun, t: number, orientation: "white" | "black"): { x: number; y: number; dx: number; dy: number } {
  const a = squareXY(run.a, orientation);
  const b = squareXY(run.b, orientation);
  const u = Math.max(0, Math.min(1, (t - run.start) / run.ms));
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, dx: b.x - a.x, dy: b.y - a.y };
}

/** His copies on the board at `t`: each a little over a square tall, its feet on the line, leaning into its run; two afterimages and a streak behind. */
function Copies({ runs, t, orientation }: { runs: readonly RushRun[]; t: number; orientation: "white" | "black" }) {
  const url = runUrl();
  if (!url) return null;
  const tall = 1.25 * 100;
  const wide = (tall * DASH_FIGURE.w) / DASH_FIGURE.h;
  const out = [];
  for (const run of runs) {
    if (t < run.start || t > run.start + run.ms) continue;
    const p = runAt(run, t, orientation);
    // (His art faces our left: running right, he's mirrored. He leans into the run.)
    const right = p.dx > 0;
    const angle = (Math.atan2(p.dy, Math.abs(p.dx) || 1) * 180) / Math.PI;
    const tilt = right ? Math.max(-30, Math.min(30, angle)) : -Math.max(-30, Math.min(30, angle));
    const at = (q: { x: number; y: number }) => ({ left: `${(Math.max(wide / 2, Math.min(800 - wide / 2, q.x)) - wide / 2) / 8}%`, top: `${(Math.max(tall - 40, Math.min(800 - 4, q.y + 40)) - tall) / 8}%` });
    const tail = runAt(run, Math.max(run.start, t - 160), orientation);
    const len = Math.hypot(p.x - tail.x, p.y - tail.y);
    out.push(
      <span key={`s${run.copy}-${run.start}`} class="rush-streak" style={{ left: `${tail.x / 8}%`, top: `${tail.y / 8}%`, width: `${len / 8}%`, transform: `rotate(${(Math.atan2(p.y - tail.y, p.x - tail.x) * 180) / Math.PI}deg)` }} />,
      ...[120, 60].map((back, i) => (
        <img key={`g${run.copy}-${run.start}-${back}`} class={`rush-copy ghost g${i}`} src={url} alt="" style={{ ...at(runAt(run, Math.max(run.start, t - back), orientation)), width: `${wide / 8}%`, transform: `scaleX(${right ? -1 : 1}) skewX(${right ? 14 : -14}deg) rotate(${tilt}deg)` }} />
      )),
      <img key={`c${run.copy}-${run.start}`} class="rush-copy" src={url} alt="" style={{ ...at(p), width: `${wide / 8}%`, transform: `scaleX(${right ? -1 : 1}) skewX(${right ? 14 : -14}deg) rotate(${tilt}deg)` }} />,
    );
  }
  return <>{out}</>;
}

// ---------------- The layer ----------------

/** The square under a point of the board (its squares' box, from either side). */
function squareAtPoint(el: Element, x: number, y: number, orientation: "white" | "black"): string | null {
  const r = el.getBoundingClientRect();
  const col = Math.floor(((x - r.left) / r.width) * 8);
  const row = Math.floor(((y - r.top) / r.height) * 8);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return orientation === "white" ? `${"abcdefgh"[col]}${8 - row}` : `${"abcdefgh"[7 - col]}${row + 1}`;
}
const cell = (square: string, orientation: "white" | "black") => {
  const { x, y } = squareXY(square, orientation);
  return { left: `${(x - 50) / 8}%`, top: `${(y - 50) / 8}%` };
};
/** "No more tries" over a square at the board's left or right edge: kept to the board's side, so it never runs off the page. */
const nopeEdge = (square: string, orientation: "white" | "black") => {
  const { x } = squareXY(square, orientation);
  return x < 100 ? " at-left" : x > 700 ? " at-right" : "";
};
/** What this device has played or said once (a sound, a line), by key: a screen drawn again doesn't repeat it. */
const done = new Set<string>();
const once = (key: string, f: () => void) => {
  if (done.has(key)) return;
  done.add(key);
  if (done.size > 300) done.delete(done.values().next().value!);
  f();
};

/** The Rush over the board: its banner, his copies, your pieces' edges, and (your ten seconds) your drags and taps. */
export function RushLayer({ boss, view, now, orientation, onPlace }: { boss: BossView; view: RushView; now: number; orientation: "white" | "black"; onPlace: (from: string, to: string) => void }) {
  const rush = boss.powers?.dash?.rush ?? null;
  const tl = rushTimeline();
  const t = now - view.at;
  const stage = rush ? rushStage(rush, view, now) : "done";
  const [sel, setSelShown] = useState<string | null>(null);
  const [drag, setDragShown] = useState<{ from: string; x: number; y: number; moved: boolean; id: number } | null>(null);
  // (The pointer's handlers read these refs, not the state: the next pointer event can come before the re-render that hands the
  // handlers a new state, so a drag's moves once all read "no drag" and its drop was lost. The state draws; the refs decide.)
  const selNow = useRef<string | null>(null);
  const dragNow = useRef<typeof drag>(null);
  const setSel = (v: string | null) => {
    selNow.current = v;
    setSelShown(v);
  };
  const setDrag = (v: typeof drag) => {
    dragNow.current = v;
    setDragShown(v);
  };
  const [nope, setNope] = useState<{ square: string; n: number } | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const runs = rush ? rushRuns(rush).runs : [];
  const fen = boss.board.fen;
  const judged = rush ? rushJudge(fen, rush, view.places) : { correct: 0, marks: [] };
  const at = rush ? rushSquares(fen, rush, view.places) : new Map<string, string | null>();
  const key = `${boss.id}:${view.key}`;
  // His line as the sweep ends, then the God King's (fallen or not); the verdict's word once it's known.
  useEffect(() => {
    if (!rush) return;
    if (t >= tl.linesAt) once(`${key}:done`, () => bossVoice.say(DASH_RUSH_LINES.done[hash(key) % DASH_RUSH_LINES.done.length], `${key}:done`, CRITICAL));
    if (t >= tl.askAt) once(`${key}:ask`, () => kingSay("rushAsk", `${key}:ask`));
    if (rush.correct !== undefined && !rush.extra) once(`${key}:well`, () => kingSay("rushWell", `${key}:well`));
    // (Too few back: his word as time's up; his extra move follows at once.)
    if (rush.extra === "due" || rush.extra === "played") once(`${key}:fail`, () => bossVoice.say(DASH_RUSH_LINES.fail[hash(key) % DASH_RUSH_LINES.fail.length], `${key}:fail`, CRITICAL));
  });
  // The clock's tick each second of both countdowns (his "1.00" too: five of them).
  const tick = t < tl.countdownMs ? Math.floor(t / 1000) : t >= tl.placeAt && t < tl.placeUntil ? 100 + Math.floor((t - tl.placeAt) / 1000) : -1;
  useLayoutEffect(() => {
    if (tick >= 0) once(`${key}:tick:${tick}`, () => play("tick"));
  }, [tick]);
  // Each piece you put down: a soft blip on a square where one like it stood, else a buzz and his word (a square off, or more).
  const placedKey = JSON.stringify(view.places);
  const before = useRef(view.places);
  useLayoutEffect(() => {
    const prev = before.current;
    before.current = view.places;
    if (!rush) return;
    for (const [from, to] of Object.entries(view.places)) {
      if (prev[from] === to) continue;
      const m = judged.marks.find((x) => x.square === to);
      if (!m) continue;
      once(`${key}:put:${from}:${to}`, () => {
        if (m.right) return play("popSoft");
        play("sqSting");
        const text = m.off <= 1 ? DASH_RUSH_LINES.close[0] : DASH_RUSH_LINES.far[0];
        bossVoice.say(text, `${key}:put:${from}:${to}`, CRITICAL);
      });
    }
  }, [placedKey]);
  useEffect(() => {
    if (stage !== "place") {
      setSel(null);
      setDrag(null);
    }
  }, [stage]);
  if (!rush) return null;
  const right = judged.marks.filter((m) => m.right).length;
  const showCount = t < tl.countdownMs ? Math.max(0, 1 - t / tl.countdownMs).toFixed(2) : stage === "place" ? Math.max(0, (tl.placeUntil - t) / 1000).toFixed(2) : stage === "done" ? "0.00" : null;
  const originAt = (square: string) => rush.moves.find((m) => at.get(m.from) === square)?.from ?? null;
  const put = (from: string, to: string | null) => {
    if (to && at.get(from) !== to) onPlace(from, to);
  };
  // (A piece out of moves: it shakes where it stands, the board's own piece, and "No more tries" fades over it; it stays.)
  const refuse = (square: string) => {
    setNope({ square, n: (nope?.n ?? 0) + 1 });
    const el = layer.current?.closest(".board-wrap")?.querySelector<HTMLElement>(`piece[data-square="${square}"]`);
    if (!el) return;
    el.classList.remove("rush-shake");
    void el.offsetWidth;
    el.classList.add("rush-shake");
    el.addEventListener("animationend", () => el.classList.remove("rush-shake"), { once: true });
  };
  return (
    <div ref={layer} class={`rush-layer rush-${stage}`} data-stage={stage} data-right={right} data-of={rush.moves.length} data-key={view.key}>
      {/* (His copies, only while they run: drawn over the pieces, never taking a tap.) */}
      {stage === "sweep" && t >= tl.scatterAt && t <= tl.scatterUntil && <Copies runs={runs} t={t} orientation={orientation} />}
      {/* (Your pieces' edges: to put back, right, wrong; the one picked up.) */}
      {stage === "place" &&
        judged.marks.map((m) => (
          <span key={m.square} class={`rush-edge ${m.right ? "right" : m.placed ? "wrong" : "todo"}${sel && at.get(sel) === m.square ? " sel" : ""}`} data-square={m.square} style={cell(m.square, orientation)} />
        ))}
      {showCount !== null && (
        <div class={`rush-banner${stage === "sweep" ? " big" : ""}`} aria-hidden="true">
          <span class="rb-title">{stage === "sweep" ? "SCRAMBLE RUSH" : stage === "place" ? "PUT THEM BACK" : "TIME'S UP"}</span>
          <b class="rb-count" data-count={showCount}>
            {showCount}
          </b>
        </div>
      )}
      {/* (He smacks his clock, impatient, twice in your ten seconds: where he stands.) */}
      {t >= tl.placeAt + 2500 && <InPlace runKey={`${key}:smack1`} anims={["fit3"]} since={view.at + tl.placeAt + 2500} />}
      {t >= tl.placeAt + 6500 && <InPlace runKey={`${key}:smack2`} anims={["fit4"]} since={view.at + tl.placeAt + 6500} />}
      {stage === "place" && (
        <div
          class="rush-taps"
          role="grid"
          aria-label="Put the swept pieces back: drag or tap a piece, then its square"
          onPointerDown={(e) => {
            const s = squareAtPoint(e.currentTarget as HTMLElement, e.clientX, e.clientY, orientation);
            if (!s) return;
            const o = originAt(s);
            if (o && rushMovesLeft(view.moved, o) <= 0) {
              setSel(null);
              return refuse(s);
            }
            if (o) {
              setSel(o);
              setDrag({ from: o, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId });
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              return;
            }
            if (selNow.current) {
              put(selNow.current, s);
              setSel(null);
            }
          }}
          onPointerMove={(e) => {
            const drag = dragNow.current;
            if (!drag || drag.id !== e.pointerId) return;
            const far = drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8;
            setDrag({ ...drag, x: e.clientX, y: e.clientY, moved: far });
          }}
          onPointerUp={(e) => {
            const drag = dragNow.current;
            if (!drag || drag.id !== e.pointerId) return;
            setDrag(null);
            if (!drag.moved) return;
            put(drag.from, squareAtPoint(e.currentTarget as HTMLElement, e.clientX, e.clientY, orientation));
            setSel(null);
          }}
          onPointerCancel={() => setDrag(null)}
        />
      )}
      {stage === "place" && nope && (
        <span key={nope.n} class={`rush-nope${nopeEdge(nope.square, orientation)}`} data-square={nope.square} style={cell(nope.square, orientation)} onAnimationEnd={() => setNope(null)}>
          No more tries
        </span>
      )}
      {drag?.moved && layer.current && (
        <div class="hb-pieces rush-ghost" aria-hidden="true">
          {(() => {
            const r = layer.current!.getBoundingClientRect();
            const m = rush.moves.find((x) => x.from === drag.from)!;
            return <piece class={pieceClass(m.piece)} style={{ left: `${((drag.x - r.left) / r.width) * 100 - 6.25}%`, top: `${((drag.y - r.top) / r.height) * 100 - 6.25}%` }} />;
          })()}
        </div>
      )}
    </div>
  );
}
