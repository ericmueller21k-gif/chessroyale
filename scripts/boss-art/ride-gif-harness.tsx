/**
 * The page ride-gif.ts shows in a browser to draw a ride's pictures for its GIF (bundled with the draft, like
 * item-harness.tsx; it has no request: ride-gif.ts calls `window.__RIDE` from Node). It draws one thing at a time on a
 * transparent page, and ride-gif.ts screenshots it:
 *   - `info()`: the draft's name, its views and each view's idle and move lengths (ms) and the move's dx per frame;
 *   - `sprite(...)`: one frame of one view, the ride with its pawn on it, at its place on a cell (the pawn's foot at the
 *     cell's anchor, which is where the town stands a pawn on its square), without the pose's dx (the GIF moves it);
 *   - `mark(...)`: one frame of one trail mark on the ground, centered on the cell's anchor (the spot it lands on), or the
 *     town's droplet at an age when the ride has no trail mark yet;
 *   - `pawn(...)`: the plain pawn in the same cell;
 *   - `caption(...)`: the strip along the top.
 */
import type { ComponentChildren } from "preact";
import { render } from "preact";
import * as DRAFT from "virtual:draft";
import { Pawn, TRAIL_MAX, usePaint, type Finish, type RiderDraft, type RiderFacing, type RiderTrail, type RiderViewDraft } from "./item-kit.tsx";

const isRider = (v: unknown): v is RiderDraft => !!v && typeof v === "object" && "Back" in v && "Front" in v && "pose" in v;
const rider = Object.values(DRAFT as Record<string, unknown>).find(isRider);

/** The pawn's base: the point of its picture that stands on the middle of its square (render.ts PAWN_FOOT), in the 100-unit square. */
const FOOT_X = 50;
const FOOT_Y = ((39.5 + 0.75) / 45) * 100;
/** Town size: pixels per unit of the pawn's 100 × 100 square (a pawn about 45 px; item-harness.tsx's town size). */
const TOWN = 0.45;

/** A cell: `cw` x `ch` town pixels with the foot at (`ax`, `ay`); `ss` times finer for measuring. */
export interface Cell {
  cw: number;
  ch: number;
  ax: number;
  ay: number;
  ss: number;
}

const facings = (d: RiderDraft): RiderFacing[] => ["side", ...(d.views?.front ? ["front" as const] : []), ...(d.views?.back ? ["back" as const] : [])];
const viewOf = (d: RiderDraft, v: RiderFacing): RiderViewDraft | undefined => (v === "side" ? d : d.views?.[v]);
const fin = (d: RiderDraft, color: string): Finish => ({ color, color2: d.colors === 2 ? "yellow" : undefined, blemish: 0, seed: 4242 });

/** The cell's svg: its box in the pawn's units, so the foot lands on the anchor pixel. */
function CellSvg({ c, children }: { c: Cell; children: ComponentChildren }) {
  const x0 = FOOT_X - c.ax / TOWN;
  const y0 = FOOT_Y - c.ay / TOWN;
  return (
    <svg width={c.cw * c.ss} height={c.ch * c.ss} viewBox={`${x0} ${y0} ${c.cw / TOWN} ${c.ch / TOWN}`} style={{ display: "block" }}>
      {children}
    </svg>
  );
}

/** item-harness.tsx's RiderLayer (it renders on load, so it can't be imported), without the pose's dx. */
function RiderSprite({ d, v, anim, f, finish }: { d: RiderDraft; v: RiderFacing; anim: "idle" | "move"; f: number; finish: Finish }) {
  const view = viewOf(d, v)!;
  const box: [number, number, number, number] = view.frame ?? d.frame;
  const p = usePaint(finish, box);
  const p2 = usePaint({ ...finish, color: finish.color2 ?? finish.color, seed: finish.seed + 101 }, box);
  const pose = view.pose(anim, f);
  const clip = `cut-${v}-${anim}-${f}`;
  return (
    <g transform={`translate(0 ${pose.dy})`}>
      <defs>
        {p.defs}
        {p2.defs}
        <clipPath id={clip}>
          <rect x="-50" y="-60" width="200" height={60 + pose.cut} />
        </clipPath>
      </defs>
      {view.Back({ p, p2, side: "w", f, anim, view: v })}
      <g transform={`translate(${pose.pawnX} ${pose.pawnY}) rotate(${pose.pawnTilt ?? 0} 50 88)`}>
        <g clip-path={`url(#${clip})`}>
          <Pawn side="w" />
        </g>
      </g>
      {view.Front({ p, p2, side: "w", f, anim, view: v })}
    </g>
  );
}

/** The town's droplet (town/render.ts drawMarks), in units: `a` its age (0 to 1), `sq` units a square, `size` and `alpha` TOWN_FEEL's. */
export interface Droplet {
  a: number;
  sq: number;
  size: number;
  alpha: number;
}
function DropletMark({ a, sq, size, alpha }: Droplet) {
  const rx = sq * size * 0.5 * (1 - 0.6 * a);
  const o = alpha * (1 - a) * (1 - a);
  return (
    <g>
      <ellipse cx="0" cy={rx * 0.25} rx={rx * 1.5} ry={rx * 0.66} fill="rgb(110,70,30)" fill-opacity={0.22 * o} />
      <ellipse cx="0" cy="0" rx={rx * 1.4} ry={rx * 0.6} fill="#fff" fill-opacity={0.55 * o} />
      <ellipse cx="0" cy="0" rx={rx} ry={rx * 0.42} fill="#fff" fill-opacity={o} />
    </g>
  );
}

/** One frame of the ride's trail mark, centered on (0, 0), with its own paint (its box the mark's). */
function TrailMark({ t, finish, v, f, n }: { t: RiderTrail; finish: Finish; v: RiderFacing; f: number; n: number }) {
  const box: [number, number, number, number] = [-t.w / 2, -t.h / 2, t.w, t.h];
  const p = usePaint(finish, box);
  const p2 = usePaint({ ...finish, color: finish.color2 ?? finish.color, seed: finish.seed + 101 }, box);
  return (
    <g>
      <defs>
        {p.defs}
        {p2.defs}
      </defs>
      {t.Mark({ p, p2, f, view: v, n })}
    </g>
  );
}

const root = document.getElementById("app")!;
const api = {
  info() {
    if (!rider) return { error: `the draft exports no rider (an object with id, frame, idle, move, pose, Back and Front); exports: ${Object.keys(DRAFT as object).join(", ") || "none"}` };
    const views: Record<string, { idleMs: number[]; moveMs: number[]; moveDx: number[] }> = {};
    for (const v of facings(rider)) {
      const view = viewOf(rider, v)!;
      views[v] = { idleMs: view.idle?.ms ?? [], moveMs: view.move?.ms ?? [], moveDx: (view.move?.ms ?? []).map((_, f) => view.pose("move", f).dx) };
    }
    const t = rider.trail;
    const trail = t ? { ms: t.ms ?? [], every: t.every ?? 1, w: t.w, h: t.h } : null;
    return { id: rider.id, name: rider.name, views, trail, trailMax: TRAIL_MAX };
  },
  sprite(c: Cell, v: RiderFacing, anim: "idle" | "move", f: number, color: string) {
    render(
      <CellSvg c={c}>
        <RiderSprite d={rider!} v={v} anim={anim} f={f} finish={fin(rider!, color)} />
      </CellSvg>,
      root,
    );
  },
  /** A trail mark's frame (or, with `drop`, the town's droplet), its spot on the cell's anchor; the cell's svg box is in units round (0, 0). */
  mark(c: Cell, v: RiderFacing, f: number, n: number, color: string, drop?: Droplet) {
    render(
      <svg width={c.cw * c.ss} height={c.ch * c.ss} viewBox={`${-c.ax / TOWN} ${-c.ay / TOWN} ${c.cw / TOWN} ${c.ch / TOWN}`} style={{ display: "block" }}>
        {drop ? <DropletMark {...drop} /> : <TrailMark t={rider!.trail!} finish={fin(rider!, color)} v={v} f={f} n={n} />}
      </svg>,
      root,
    );
  },
  pawn(c: Cell) {
    render(
      <CellSvg c={c}>
        <Pawn side="w" />
      </CellSvg>,
      root,
    );
  },
  caption(w: number, h: number, name: string, width: string, over: boolean, action: string) {
    render(
      <div style={{ width: `${w}px`, height: `${h}px`, boxSizing: "border-box", background: "#14161b", color: "#d1d5db", font: "15px sans-serif", display: "flex", alignItems: "center", gap: "10px", padding: "0 10px", whiteSpace: "nowrap", overflow: "hidden" }}>
        <b style={{ color: "#f3f4f6", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</b>
        <span style={{ color: over ? "#ff5a4d" : "#d1d5db", fontWeight: over ? "bold" : "normal" }}>{width}</span>
        <span style={{ marginLeft: "auto", color: "#f2c14e" }}>{action}</span>
      </div>,
      root,
    );
  },
};
(window as unknown as { __RIDE: typeof api }).__RIDE = api;
