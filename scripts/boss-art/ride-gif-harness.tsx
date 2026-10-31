/**
 * The page ride-gif.ts shows in a browser to draw a ride's pictures for its GIF (bundled with the draft, like
 * item-harness.tsx; it has no request: ride-gif.ts calls `window.__RIDE` from Node). It draws one thing at a time on a
 * transparent page, and ride-gif.ts screenshots it:
 *   - `info()`: the draft's name, its views and each view's idle and move lengths (ms) and the move's dx per frame;
 *   - `sprite(...)`: one frame of one view, the ride with its pawn on it, at its place on a cell (the pawn's foot at the
 *     cell's anchor, which is where the town stands a pawn on its square), without the pose's dx (the GIF moves it);
 *   - `pawn(...)`: the plain pawn in the same cell;
 *   - `caption(...)`: the strip along the top.
 */
import type { ComponentChildren } from "preact";
import { render } from "preact";
import * as DRAFT from "virtual:draft";
import { Pawn, usePaint, type Finish, type RiderDraft, type RiderFacing, type RiderViewDraft } from "./item-kit.tsx";

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

const root = document.getElementById("app")!;
const api = {
  info() {
    if (!rider) return { error: `the draft exports no rider (an object with id, frame, idle, move, pose, Back and Front); exports: ${Object.keys(DRAFT as object).join(", ") || "none"}` };
    const views: Record<string, { idleMs: number[]; moveMs: number[]; moveDx: number[] }> = {};
    for (const v of facings(rider)) {
      const view = viewOf(rider, v)!;
      views[v] = { idleMs: view.idle?.ms ?? [], moveMs: view.move?.ms ?? [], moveDx: (view.move?.ms ?? []).map((_, f) => view.pose("move", f).dx) };
    }
    return { id: rider.id, name: rider.name, views };
  },
  sprite(c: Cell, v: RiderFacing, anim: "idle" | "move", f: number, color: string) {
    render(
      <CellSvg c={c}>
        <RiderSprite d={rider!} v={v} anim={anim} f={f} finish={fin(rider!, color)} />
      </CellSvg>,
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
