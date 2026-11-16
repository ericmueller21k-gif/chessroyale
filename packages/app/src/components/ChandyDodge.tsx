/**
 * Chandy's ultimate, Dodge, as drawn (Eric's design, Nov 15-16; branch stills/boss-chandy, DESIGN.md D1-D12; art only: his rules job
 * runs it). Laid over the board's box (it sizes and places itself in eighths of `--board-size`, as everything over the squares):
 *
 * - `scope`: he targets your king: everything but a circle round him greys, blurs and darkens, a cyan scope ring closing on him.
 * - `slide`: your king slides to the center (`center`: e4 for White, e5 for Black), the scope following him.
 * - `open`: the scope opens on a blank board (every other piece gone), the 3 x 3 round him framed in red.
 * - `vote`: the clones stand on the board's edge squares (a rank's on the left or right edge, aiming level; a file's on his side's
 *   edge, aiming down). No lines (Eric, Nov 16: "you actually have to look and see which ones he's pointing at"). A clone that
 *   teleports blinks out leaving its afterimage (`ghosts`) and appears on its new square. Your taps vote (`onPick`); the counts show on
 *   the squares, yours ringed in gold; the 3 s bar runs to `endsAt`.
 * - `locked`: your king on the winning square (`placed`); each clone's line flashes three times, the whole rank or file.
 * - `blast`: the blasts, a big pop edge to edge (power-art.ts EFFECTS chandyDodgeRow / chandyDodgeCol, on the shared board canvas).
 * - `result`: "DODGED n/3" or "HIT! YOU LOSE".
 *
 * The clones are drawn on one canvas of their own (90 px a square: half a CSS pixel an art pixel on a phone's 45 px square, crisp at
 * any size), one shared frame loop; the lines on the board's effects canvas. Nothing here takes a tap but the vote's squares.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { CHANDY_CLONE, CHANDY_FOOT, cloneMuzzle } from "../characters/chandy.ts";
import { spriteCanvas } from "../characters/sprite-kit.ts";
import { BoardEffects, onEachFrame, spriteFrameAt, type BoardItem } from "./BossEffect.tsx";

export type DodgePhase = "scope" | "slide" | "open" | "vote" | "locked" | "blast" | "result";
/** A clone's line, on the screen: a rank's clone on its `left` or `right` edge square, a file's on the top edge (his side). */
export type DodgeLine = { rank: number; side: "left" | "right"; since?: number } | { file: string; since?: number };
export interface DodgeView {
  phase: DodgePhase;
  /** When the phase began, in this device's time (online: `local(serverTime)`, as every moment), never a raw server time. */
  since: number;
  /** The crowd's side: its king's color, and the board's way up. */
  side: "white" | "black";
  /** Your king's own square (the scope finds him there), the center he slides to, and the square he's on once the vote locks. */
  king: string;
  center: string;
  placed?: string;
  /** The clones now, and the afterimages of those that just teleported (each fading from its `since`). */
  lines: readonly DodgeLine[];
  ghosts?: readonly (DodgeLine & { since: number })[];
  /** The vote: each square's count, your own pick, and when it closes. */
  votes?: Readonly<Record<string, number>>;
  mine?: string;
  endsAt?: number;
  round: 1 | 2 | 3;
  /** "TELEPORT!" in the round's place for a moment. */
  teleport?: boolean;
  result?: "dodged" | "hit";
  onPick?: (square: string) => void;
}

const FILES = "abcdefgh";
/** A square's column and row on the screen (0 at the top left), the crowd at the bottom. */
const cell = (sq: string, side: "white" | "black"): [number, number] => {
  const f = FILES.indexOf(sq[0]!);
  const r = Number(sq[1]) - 1;
  return side === "white" ? [f, 7 - r] : [7 - f, r];
};
const sqAt = (c: number, r: number, side: "white" | "black") => (side === "white" ? `${FILES[c]}${8 - r}` : `${FILES[7 - c]}${r + 1}`);
/** n squares as a CSS length. */
const sqs = (n: number) => `calc(var(--board-size) * ${n / 8})`;
/** The clones' canvas: 90 px a square, one square of room above the board (a top-edge clone's head) and on each side. */
const PX = 90;

/** Where a clone's frame goes on its canvas (frame px, the canvas's), and whether it's drawn mirrored. */
function clonePlace(line: DodgeLine, side: "white" | "black"): { x: number; y: number; flip: boolean; pose: "level" | "down" } {
  const W = CHANDY_CLONE.w;
  const [fx, fy] = CHANDY_FOOT;
  if ("rank" in line) {
    const [, r] = cell(`a${line.rank}`, side);
    const floor = PX + (r + 1) * PX - 4;
    // (His feet on the edge square, a little in from the board's edge, his rifle reaching about two squares in.)
    return line.side === "left" ? { x: PX + 76 - fx, y: floor - fy, flip: false, pose: "level" } : { x: PX + 8 * PX - 76 - (W - fx), y: floor - fy, flip: true, pose: "level" };
  }
  const [c] = cell(`${line.file}1`, side);
  const [mx] = cloneMuzzle("down");
  return { x: PX + c * PX + PX / 2 - mx, y: PX + PX - 4 - fy, flip: false, pose: "down" };
}

/** The clones (and the afterimages) on their canvas, every frame. */
function CloneLayer({ view }: { view: DodgeView }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const live = useRef(view);
  live.current = view;
  useLayoutEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    let last = "";
    const draw = () => {
      const v = live.current;
      const now = Date.now();
      const show = v.phase === "vote" || v.phase === "locked" || v.phase === "blast" || v.phase === "result";
      const items: { line: DodgeLine; anim: string; then?: string; since: number }[] = [];
      if (show) {
        for (const line of v.lines) {
          const pose = "rank" in line ? "level" : "down";
          const cap = pose === "level" ? "Level" : "Down";
          items.push(line.since !== undefined ? { line, anim: `appear${cap}`, then: pose, since: line.since } : { line, anim: pose, since: 0 });
        }
        for (const line of v.ghosts ?? []) items.push({ line, anim: "rank" in line ? "fadeLevel" : "fadeDown", since: line.since });
      }
      const frames = items.map((it) => ({ it, s: spriteFrameAt(CHANDY_CLONE, it.anim, it.then, now, it.since) }));
      const key = frames.map(({ s }) => `${s.anim}:${s.frame}`).join(";") + `|${v.side}|${JSON.stringify(v.lines)}`;
      if (key === last) return;
      last = key;
      g.clearRect(0, 0, 10 * PX, 10 * PX);
      for (const { it, s } of frames) {
        const p = clonePlace(it.line, v.side);
        const img = spriteCanvas(CHANDY_CLONE, s.anim, s.frame);
        if (p.flip) {
          g.save();
          g.translate(p.x + img.width, p.y);
          g.scale(-1, 1);
          g.drawImage(img, 0, 0);
          g.restore();
        } else g.drawImage(img, p.x, p.y);
      }
    };
    draw();
    return onEachFrame(draw);
  }, []);
  return <canvas ref={cv} class="cd-clones" width={10 * PX} height={10 * PX} aria-hidden="true" />;
}

/** Redrawn every tenth of a second while the vote runs (its 3 s bar and seconds). */
function useTenths(on: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => set((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [on]);
}

export function ChandyDodge({ view }: { view: DodgeView }) {
  const v = view;
  useTenths(v.phase === "vote" && !!v.endsAt);
  const now = Date.now();
  // (How long ago the phase began, measured once per phase: a redraw mustn't move its animations' delay again.)
  const first = useRef({ since: v.since, ago: Math.max(0, now - v.since) });
  if (first.current.since !== v.since) first.current = { since: v.since, ago: Math.max(0, now - v.since) };
  const ago = first.current.ago;
  const blank = v.phase !== "scope" && v.phase !== "slide";
  const [kc, kr] = cell(v.king, v.side);
  const [cc, cr] = cell(v.center, v.side);
  const at = v.phase === "scope" ? [kc, kr] : v.phase === "slide" || v.phase === "open" || v.phase === "vote" || !v.placed ? [cc, cr] : cell(v.placed, v.side);
  // The lines once the vote locks: each clone's whole rank or file, flashing, then the blast (the board's effects canvas).
  const items: BoardItem[] = [];
  if (v.phase === "locked" || v.phase === "blast")
    for (const line of v.lines)
      for (let i = 0; i < 8; i++) {
        const square = "rank" in line ? sqAt(i, cell(`a${line.rank}`, v.side)[1], v.side) : sqAt(cell(`${line.file}1`, v.side)[0], i, v.side);
        items.push({ square, name: "rank" in line ? "chandyDodgeRow" : "chandyDodgeCol", anim: v.phase === "locked" ? "flash" : "blast", since: v.since, quiet: i > 0 });
      }
  const nine: string[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) nine.push(sqAt(cc + dc, cr + dr, v.side));
  const left = v.endsAt ? Math.max(0, v.endsAt - now) / 1000 : 3;
  const vars = { "--cd-ago": `-${ago}ms`, "--cd-kx": `${kc}`, "--cd-ky": `${kr}`, "--cd-cx": `${cc}`, "--cd-cy": `${cr}` };
  return (
    <div class={`cd-root cd-p-${v.phase}`} style={vars}>
      {blank && <div class="cd-blank" aria-hidden="true" />}
      {blank && <div class="cd-arena" aria-hidden="true" style={{ left: sqs(cc - 1), top: sqs(cr - 1) }} />}
      {!blank && (
        <div class="cd-aim" aria-hidden="true">
          <div class="cd-scope" />
          <i class="cd-ring" />
        </div>
      )}
      <BoardEffects items={items} orientation={v.side} class="cd-lines" />
      <CloneLayer view={v} />
      <div class={`hb-pieces cd-king${v.result === "hit" ? " cd-hit" : ""}`} aria-hidden="true" style={{ "--cd-x": `${at[0]}`, "--cd-y": `${at[1]}` }}>
        <piece class={`${v.side} king`} />
      </div>
      {v.phase === "vote" &&
        nine.map((sq) => {
          const [c, r] = cell(sq, v.side);
          const n = v.votes?.[sq];
          return (
            <button type="button" key={sq} class={`cd-pick${v.mine === sq ? " cd-mine" : ""}`} style={{ left: sqs(c), top: sqs(r) }} aria-label={`Vote ${sq}${n ? `, ${n} votes` : ""}`} onClick={() => v.onPick?.(sq)}>
              {n ? <b class="cd-count">{n}</b> : null}
            </button>
          );
        })}
      {blank && (
        <div class="cd-hud" style={{ top: sqs(cr + 2) }}>
          {v.phase === "result" ? (
            <div class={`cd-result${v.result === "hit" ? " cd-lost" : ""}`}>{v.result === "hit" ? "HIT! YOU LOSE" : `DODGED ${v.round}/3`}</div>
          ) : (
            <>
              <div class="cd-round">{v.teleport ? <span class="cd-tele">TELEPORT!</span> : <>DODGE! <span>ROUND {v.round}/3</span></>}</div>
              <div class="cd-bar">
                <i style={{ width: `${v.phase === "vote" ? (left / 3) * 100 : v.phase === "open" ? 100 : 0}%` }} />
              </div>
              <div class="cd-say">{v.phase === "vote" ? `VOTE: TAP A SQUARE ${left.toFixed(1)} s` : v.phase === "open" ? "GET READY" : "LOCKED"}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
