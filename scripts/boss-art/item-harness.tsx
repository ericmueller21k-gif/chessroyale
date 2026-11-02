/**
 * The page item-render.ts shows in a browser to look at an API-drawn crate item or rider (bundled with the draft; the
 * request is `window.__REQ`). It draws one picture of labeled rows, the way the game draws items (Items.tsx's paint,
 * its avatar fit and its tile framing), then sets `window.__DONE` to its facts and warnings.
 */
import type { ComponentChildren } from "preact";
import { render } from "preact";
import { ITEM_COLORS, type ItemSlot } from "@chessroyale/core";
import { ItemLayer } from "../../packages/app/src/components/Items.tsx";
import * as DRAFT from "virtual:draft";
import { Pawn, TRAIL_MAX, usePaint, type Finish, type ItemDraft, type RiderDraft, type RiderFacing, type RiderTrail, type RiderViewDraft } from "./item-kit.tsx";

interface Req {
  mode: "item" | "rider" | "sheet";
  /** Which frames of the motion to show big (default all, at most 8). */
  frames?: number[];
  /** Rider mode: which animation the big row shows. */
  anim?: "idle" | "move";
  /** Rider mode: which view the page shows ("all": the three side by side; default all when it has front or back; "trail": its trail mark). */
  view?: RiderFacing | "all" | "trail";
  /** The pawn's side on the big row. */
  side?: "w" | "b";
  /** The color on the big row and the phone row. */
  color?: string;
  /** The final preview: every frame, no limit. */
  all?: boolean;
}
const req = (window as unknown as { __REQ: Req }).__REQ;
const warnings: string[] = [];

const isItem = (v: unknown): v is ItemDraft => !!v && typeof v === "object" && "Art" in v && "slot" in v;
const isRider = (v: unknown): v is RiderDraft => !!v && typeof v === "object" && "Back" in v && "Front" in v && "pose" in v;
const exported = Object.values(DRAFT as Record<string, unknown>);
const item = exported.find(isItem);
const rider = exported.find(isRider);

/** The pawn's anchors (Items.tsx PAWN_ANCHORS): where a head or face item's attach line goes. */
const ANCHOR: Partial<Record<ItemSlot, number>> = { head: 25, face: 40 };
/** Existing items of each slot, for the style (all fit the pawn with no shift). */
const REFS: Record<string, string[]> = {
  weapon: ["candy-cane", "cutlass", "spyglass"],
  head: ["little-crown", "pirate-hat", "party-hat"],
  face: ["dark-shades", "scarf", "fake-mustache"],
  skin: ["captains-coat", "ninja-gi", "snowman"],
  rider: ["candy-cane", "pirate-hat", "captains-coat"],
};
/** Their tiles' frames (Items.tsx FRAMES). */
const REF_FRAME: Record<string, [number, number, number, number]> = {
  "candy-cane": [60, 12, 38, 88],
  cutlass: [62, 12, 34, 84],
  spyglass: [62, 30, 36, 62],
  "little-crown": [33, 2, 34, 25],
  "pirate-hat": [23.5, 5.5, 53, 23.5],
  "party-hat": [37, 1, 26, 26],
  "dark-shades": [36, 24, 28, 11],
  scarf: [35, 30, 30, 30],
  "fake-mustache": [37, 27, 26, 11],
  "captains-coat": [20, 15, 60, 76],
  "ninja-gi": [20, 15, 60, 76],
  snowman: [16, 6, 68, 88],
};
export const fin = (color: string, blemish = 0, seed = 4242): Finish => ({ color, blemish, seed });
export const GROUND = "#2a2d34";

export function Label({ children }: { children: ComponentChildren }) {
  return <div style={{ font: "12px sans-serif", color: "#d1d5db", textAlign: "center", marginTop: "2px" }}>{children}</div>;
}
function Row({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ font: "bold 13px sans-serif", color: "#f2c14e", margin: "0 0 4px 4px" }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-end" }}>{children}</div>
    </div>
  );
}
function Cell({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div>
      {children}
      <Label>{label}</Label>
    </div>
  );
}

// ---------------- Items ----------------

/** The draft's art with its paint, in the square's coordinates. */
export function DraftLayer({ d, finish, side, f }: { d: ItemDraft; finish: Finish; side: "w" | "b"; f: number }) {
  const box = d.shineBox ?? d.frame;
  const p = usePaint(finish, box);
  const p2 = usePaint({ ...finish, color: finish.color2 ?? finish.color, seed: finish.seed + 101 }, box);
  return (
    <g>
      <defs>
        {p.defs}
        {p2.defs}
      </defs>
      {d.Art({ p, p2, side, f })}
    </g>
  );
}

/** The draft worn on a pawn, as Avatar draws it: behind or in front of the pawn, shifted to its anchor, capped. */
export function OnPawn({ d, finish, side, f, px, ground = true, over }: { d: ItemDraft; finish: Finish; side: "w" | "b"; f: number; px: number; ground?: boolean; over?: string }) {
  const shift = ANCHOR[d.slot] !== undefined && d.attach !== undefined ? ANCHOR[d.slot]! - d.attach : 0;
  const art = (
    <g clip-path="url(#cap)" transform={`translate(0 ${shift})`}>
      <DraftLayer d={d} finish={finish} side={side} f={f} />
    </g>
  );
  return (
    <svg width={px} height={px} viewBox="0 0 100 100" style={{ overflow: "visible", background: ground ? GROUND : undefined, display: "block" }}>
      <defs>
        <clipPath id="cap">
          <rect x="-12" y="-9" width="124" height="112" />
        </clipPath>
      </defs>
      {d.slot === "skin" ? (
        art
      ) : (
        <>
          {d.layer === "back" && art}
          <Pawn side={side} />
          {d.layer !== "back" && art}
          {/* (An existing face item worn over it: goggles and shades go over a hat, crates.ts's faceLayer "above".) */}
          {over && <ItemLayer def={over} finish={fin("cobalt", 25)} side={side} />}
        </>
      )}
    </svg>
  );
}

/** An existing item on a pawn, for the style. */
export function RefOnPawn({ def, px, side = "w", color = "cobalt" }: { def: string; px: number; side?: "w" | "b"; color?: string }) {
  const skin = def === "captains-coat" || def === "ninja-gi" || def === "snowman";
  return (
    <svg width={px} height={px} viewBox="0 0 100 100" style={{ overflow: "visible", background: GROUND, display: "block" }}>
      {!skin && <Pawn side={side} />}
      <ItemLayer def={def} finish={fin(color, 25)} side={side} />
    </svg>
  );
}

/** A tile, framed as ItemArt frames an item (the locker's 64 px). */
function Tile({ frame, px, children }: { frame: [number, number, number, number]; px: number; children: ComponentChildren }) {
  const [x, y, w, h] = frame;
  const s = Math.max(w, h) * 1.12;
  return (
    <div style={{ width: `${px + 16}px`, height: `${px + 16}px`, background: "#1f2228", borderRadius: "10px", display: "grid", placeItems: "center" }}>
      <svg width={px} height={px} viewBox={`${x + w / 2 - s / 2} ${y + h / 2 - s / 2} ${s} ${s}`} style={{ overflow: "visible", "--sw": String(Math.max(0.4, s / 100)) }}>
        {children}
      </svg>
    </div>
  );
}

function ItemPage({ d }: { d: ItemDraft }) {
  const n = d.motion?.ms?.length ?? 0;
  if (!n) warnings.push("motion.ms is empty: give each frame's length (one entry for a still item)");
  const frames = (req.frames?.length ? req.frames : Array.from({ length: n }, (_, i) => i)).filter((i) => i >= 0 && i < n).slice(0, req.all ? 64 : 8);
  const side = req.side ?? "w";
  const color = req.color ?? "red";
  const refs = REFS[d.slot] ?? [];
  return (
    <div style={{ padding: "6px" }}>
      <Row title={`${d.name} (${d.slot}, ${d.tier}): its motion, frame by frame on a ${side === "w" ? "white" : "black"} pawn at 4x (240 px), ${color}, 75% purity`}>
        {frames.map((f) => (
          <Cell key={f} label={`frame ${f} (${d.motion.ms[f]} ms)`}>
            <OnPawn d={d} finish={fin(color, 25)} side={side} f={f} px={req.all ? 160 : 240} />
          </Cell>
        ))}
      </Row>
      <Row title="Phone size: a lobby pawn (60 px), white and black; the home pawn (130 px); its locker tile (64 px); beside existing items">
        <Cell label="60 px">
          <OnPawn d={d} finish={fin(color, 25)} side="w" f={0} px={60} />
        </Cell>
        <Cell label="60 px black">
          <OnPawn d={d} finish={fin(color, 25)} side="b" f={0} px={60} />
        </Cell>
        <Cell label="home 130 px">
          <OnPawn d={d} finish={fin(color, 25)} side="w" f={0} px={130} />
        </Cell>
        <Cell label="tile">
          <Tile frame={d.frame} px={64}>
            <DraftLayer d={d} finish={fin(color, 25)} side="w" f={0} />
          </Tile>
        </Cell>
        {d.slot === "head" &&
          ["ski-goggles", "dark-shades"].map((o) => (
            <Cell key={o} label={`${o} on top`}>
              <OnPawn d={d} finish={fin(color, 25)} side="w" f={0} px={130} over={o} />
            </Cell>
          ))}
        {refs.map((r) => (
          <Cell key={r} label={r}>
            <RefOnPawn def={r} px={60} />
          </Cell>
        ))}
        {refs.slice(0, 2).map((r) => (
          <Cell key={`t${r}`} label={`${r} tile`}>
            <Tile frame={REF_FRAME[r]!} px={64}>
              <ItemLayer def={r} finish={fin("cobalt", 25)} />
            </Tile>
          </Cell>
        ))}
      </Row>
      <Row title="Every color at 75% purity (100 px); then 100% and shiny (95%)">
        {ITEM_COLORS.map((c) => (
          <Cell key={c.id} label={c.name}>
            <OnPawn d={d} finish={{ ...fin(c.id, 25, 1000 + c.weight * 10), color2: d.colors === 2 ? "yellow" : undefined }} side="w" f={0} px={100} />
          </Cell>
        ))}
        <Cell label="100%">
          <OnPawn d={d} finish={fin(color, 0)} side="w" f={0} px={100} />
        </Cell>
        <Cell label="shiny 95%">
          <OnPawn d={d} finish={fin(color, 5)} side="w" f={0} px={100} />
        </Cell>
      </Row>
    </div>
  );
}

// ---------------- Riders ----------------

/** The views a ride has: always its side, then front and back if drawn. */
export const facings = (d: RiderDraft): RiderFacing[] => ["side", ...(d.views?.front ? ["front" as const] : []), ...(d.views?.back ? ["back" as const] : [])];
/** One view of a ride (the side view is the draft itself). */
export const viewOf = (d: RiderDraft, v: RiderFacing): RiderViewDraft | undefined => (v === "side" ? d : d.views?.[v]);
const VIEW_NAME: Record<RiderFacing, string> = { side: "side (left/right)", front: "front (walking down)", back: "back (walking up)" };

/** The rider's box around its pawn: wide enough for a big ride, and the next square for the side view's move. */
const RB = { x: -45, y: -45, w: 190, h: 165 };
/** The front and back views' box (seen end-on: narrower; they move in place). */
const RB_END = { x: -25, y: -45, w: 150, h: 165 };
/** The three-view grid's cell: the same for every view, so they compare at one size (the side's move in place). */
const CELL = { x: -20, y: -45, w: 140, h: 150 };

function RiderLayer({ d, v = "side", finish, side, anim, f, inPlace = false }: { d: RiderDraft; v?: RiderFacing; finish: Finish; side: "w" | "b"; anim: "idle" | "move"; f: number; inPlace?: boolean }) {
  const view = viewOf(d, v)!;
  const box: [number, number, number, number] = view.frame ?? d.frame;
  const p = usePaint(finish, box);
  const p2 = usePaint({ ...finish, color: finish.color2 ?? finish.color, seed: finish.seed + 101 }, box);
  const pose = view.pose(anim, f);
  const clip = `cut-${v}-${anim}-${f}-${finish.color}-${side}-${inPlace ? "p" : "t"}`;
  return (
    <g transform={`translate(${inPlace ? 0 : pose.dx} ${pose.dy})`}>
      <defs>
        {p.defs}
        {p2.defs}
        <clipPath id={clip}>
          <rect x="-50" y="-60" width="200" height={60 + pose.cut} />
        </clipPath>
      </defs>
      {view.Back({ p, p2, side, f, anim, view: v })}
      <g transform={`translate(${pose.pawnX} ${pose.pawnY}) rotate(${pose.pawnTilt ?? 0} 50 88)`}>
        <g clip-path={`url(#${clip})`}>
          <Pawn side={side} />
        </g>
      </g>
      {view.Front({ p, p2, side, f, anim, view: v })}
    </g>
  );
}

/** The two town squares the move goes across, under the ride (a checker of the park's paving). */
function Squares({ n = 2, x = 0 }: { n?: number; x?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={x + i * 100} y="80" width="100" height="22" fill={i % 2 ? "#4a4f5a" : "#5b616d"} />
      ))}
    </g>
  );
}

/**
 * A ride with its pawn on one picture. The side view's move goes across two squares; the front and back views stay on
 * their square. `cell`: the three-view grid's box, the same for every view (the side's move in place).
 */
export function RiderView({ d, v = "side", finish, side, anim, f, scale, move = false, cell = false }: { d: RiderDraft; v?: RiderFacing; finish: Finish; side: "w" | "b"; anim: "idle" | "move"; f: number; scale: number; move?: boolean; cell?: boolean }) {
  const b = cell ? CELL : v === "side" ? { ...RB, w: move ? RB.w + 100 : RB.w } : RB_END;
  const two = !cell && v === "side" && move;
  return (
    <svg width={b.w * scale} height={b.h * scale} viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} style={{ background: GROUND, display: "block" }}>
      {cell ? <rect x={CELL.x} y="80" width={CELL.w} height="22" fill="#5b616d" /> : <Squares n={two ? 2 : 1} />}
      <RiderLayer d={d} v={v} finish={finish} side={side} anim={anim} f={f} inPlace={cell && v === "side"} />
    </svg>
  );
}

/** Move frames spread evenly over the move (n of them; all when n >= the count). */
export const spread = (count: number, n: number) => (n >= count ? Array.from({ length: count }, (_, i) => i) : Array.from({ length: n }, (_, i) => Math.round((i * count) / n)));

/**
 * The views side by side: a column per view (side, front, back), a row per frame: idle frame 0, then the move's frames
 * (`moveFrames`: indices into each view's move; a view with fewer frames leaves the cell empty). The side's move is
 * shown in place, so every cell is the same box.
 */
export function ViewsGrid({ d, finish, side = "w", scale, moveFrames, title }: { d: RiderDraft; finish: Finish; side?: "w" | "b"; scale: number; moveFrames: number[]; title?: string }) {
  const vs = facings(d);
  const small = scale < 1;
  const rows: { anim: "idle" | "move"; f: number }[] = [{ anim: "idle", f: 0 }, ...moveFrames.map((f) => ({ anim: "move" as const, f }))];
  return (
    <div>
      {title && <div style={{ font: "bold 13px sans-serif", color: "#f2c14e", margin: "0 0 4px 4px" }}>{title}</div>}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${vs.length}, auto)`, gap: small ? "3px 4px" : "4px 8px", justifyContent: "start" }}>
        {vs.map((v) => (
          <div key={v} style={{ font: `bold ${small ? 10 : 13}px sans-serif`, color: "#d1d5db", textAlign: "center" }}>
            {small ? v : VIEW_NAME[v]}
          </div>
        ))}
        {rows.flatMap(({ anim, f }) =>
          vs.map((v) => {
            const a = viewOf(d, v)![anim];
            const ok = f < (a?.ms?.length ?? 0);
            return (
              <div key={`${anim}${f}${v}`}>
                {ok ? <RiderView d={d} v={v} finish={finish} side={side} anim={anim} f={f} scale={scale} cell /> : <div style={{ width: `${CELL.w * scale}px`, height: `${CELL.h * scale}px` }} />}
                <Label>{!ok ? "(none)" : small ? `${anim} ${f}` : `${anim} ${f} (${a.ms[f]} ms)`}</Label>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

/** The three views together: at 4x (idle and some move frames), at town size (idle and every move frame), two colors. */
function ViewsPage({ d }: { d: RiderDraft }) {
  const color = req.color ?? "red";
  const side = req.side ?? "w";
  const most = Math.max(...facings(d).map((v) => viewOf(d, v)!.move?.ms?.length ?? 0));
  const big = req.frames?.length ? req.frames.filter((i) => i >= 0 && i < most).slice(0, req.all ? 64 : 4) : spread(most, req.all ? most : 3);
  return (
    <div style={{ padding: "6px", display: "flex", gap: "18px", alignItems: "flex-start" }}>
      <ViewsGrid d={d} finish={fin(color, 25)} side={side} scale={1.8} moveFrames={big} title={`${d.name}: the three views at 4x, ${color}, 75% purity (the side's move in place)`} />
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <ViewsGrid d={d} finish={fin(color, 25)} side={side} scale={0.45} moveFrames={spread(most, Math.min(most, 12))} title="Town size: idle, every move frame" />
        {(["cobalt", "midnight"] as const).map((c, i) => (
          <ViewsGrid key={c} d={d} finish={fin(c, 25, 1300 + i)} side={i ? "b" : "w"} scale={0.62} moveFrames={[]} title={`${c}, ${i ? "black" : "white"} pawn`} />
        ))}
      </div>
    </div>
  );
}

function RiderPage({ d, v }: { d: RiderDraft; v: RiderFacing }) {
  const view = viewOf(d, v)!;
  const anim = req.anim ?? "idle";
  const a = view[anim];
  const n = a?.ms?.length ?? 0;
  if (!n) warnings.push(`${v === "side" ? "" : `views.${v}.`}${anim}.ms is empty`);
  const frames = (req.frames?.length ? req.frames : Array.from({ length: n }, (_, i) => i)).filter((i) => i >= 0 && i < n).slice(0, req.all ? 64 : 8);
  const side = req.side ?? "w";
  const color = req.color ?? "red";
  const moveN = view.move?.ms?.length ?? 0;
  const big = v !== "side" ? 1.8 : anim === "idle" ? 1.8 : 1.15;
  const vname = v === "side" ? "" : `, ${VIEW_NAME[v]}`;
  return (
    <div style={{ padding: "6px" }}>
      <Row title={`${d.name} (rider, ${d.tier}${vname}): "${anim}" frame by frame with a ${side === "w" ? "white" : "black"} pawn riding (4x), ${color}, 75% purity`}>
        {frames.map((f) => (
          <Cell key={f} label={`frame ${f} (${a.ms[f]} ms)`}>
            <RiderView d={d} v={v} finish={fin(color, 25)} side={side} anim={anim} f={f} scale={req.all ? 1 : big} move={anim === "move"} />
          </Cell>
        ))}
      </Row>
      <Row title={`Town size (a pawn about 45 px): at rest, then every frame of its move ${v === "side" ? "across a square" : "(in place: the town slides it along)"}`}>
        <Cell label="idle">
          <RiderView d={d} v={v} finish={fin(color, 25)} side="w" anim="idle" f={0} scale={0.45} />
        </Cell>
        {Array.from({ length: Math.min(moveN, 12) }, (_, f) => (
          <Cell key={f} label={`move ${f}`}>
            <RiderView d={d} v={v} finish={fin(color, 25)} side="w" anim="move" f={f} scale={0.45} move />
          </Cell>
        ))}
      </Row>
      <Row title="Every color at 75% purity; 100%; shiny; its locker tile; existing items for the style">
        {ITEM_COLORS.map((c) => (
          <Cell key={c.id} label={c.name}>
            <RiderView d={d} v={v} finish={{ ...fin(c.id, 25, 1000 + c.weight * 10), color2: d.colors === 2 ? "yellow" : undefined }} side="w" anim="idle" f={0} scale={0.62} />
          </Cell>
        ))}
        <Cell label="100%">
          <RiderView d={d} v={v} finish={fin(color, 0)} side="w" anim="idle" f={0} scale={0.62} />
        </Cell>
        <Cell label="shiny">
          <RiderView d={d} v={v} finish={fin(color, 5)} side="b" anim="idle" f={0} scale={0.62} />
        </Cell>
        <Cell label="tile">
          <Tile frame={d.frame} px={64}>
            <RiderLayer d={d} finish={fin(color, 25)} side="w" anim="idle" f={0} />
          </Tile>
        </Cell>
        {REFS.rider!.map((r) => (
          <Cell key={r} label={r}>
            <RefOnPawn def={r} px={60} />
          </Cell>
        ))}
      </Row>
    </div>
  );
}

// ---------------- A ride's trail mark ----------------

/** One frame of a trail mark round (0, 0), with its own paint (its box the mark's), as ride-gif-harness.tsx draws it. */
function TrailLayer({ t, finish, v, f, n }: { t: RiderTrail; finish: Finish; v: RiderFacing; f: number; n: number }) {
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
/** The town's floor (ride-gif.ts: render.ts SQ_LIGHT, SQ_DARK). */
const FLOOR = { light: "#eec58b", dark: "#ad8058" };
/** A mark on one square of the town's floor (69 units across, about 0.9 as deep), its box dashed. */
function MarkOnSquare({ t, finish, v, flip, f, n, scale, dark, box = true }: { t: RiderTrail; finish: Finish; v: RiderFacing; flip: boolean; f: number; n: number; scale: number; dark: boolean; box?: boolean }) {
  const W = 69;
  const H = 62;
  return (
    <svg width={W * scale} height={H * scale} viewBox={`${-W / 2} ${-H / 2} ${W} ${H}`} style={{ display: "block" }}>
      <rect x={-W / 2} y={-H / 2} width={W} height={H} fill={dark ? FLOOR.dark : FLOOR.light} />
      {box && <rect x={-t.w / 2} y={-t.h / 2} width={t.w} height={t.h} fill="none" stroke="#2563eb" stroke-width="0.4" stroke-dasharray="1.5 1.5" />}
      <g transform={flip ? "scale(-1 1)" : undefined}>
        <TrailLayer t={t} finish={finish} v={v} f={f} n={n} />
      </g>
    </svg>
  );
}
/** The ways a ride runs, the view its marks get, and the square's shade they're shown on. */
const RUNS: { v: RiderFacing; flip: boolean; label: string; dark: boolean }[] = [
  { v: "side", flip: false, label: "running right (side)", dark: false },
  { v: "side", flip: true, label: "running left (side, mirrored)", dark: true },
  { v: "back", flip: false, label: "running up (back)", dark: false },
  { v: "front", flip: false, label: "running down (front)", dark: true },
];

/** Its trail mark: every frame at 4x for each way it runs (and the next mark, for marks that take turns), at town size, in every color. */
function TrailPage({ d, t }: { d: RiderDraft; t: RiderTrail }) {
  const n = t.ms?.length ?? 0;
  const color = req.color ?? "red";
  const frames = (req.frames?.length ? req.frames : Array.from({ length: n }, (_, i) => i)).filter((i) => i >= 0 && i < n).slice(0, req.all ? 64 : 8);
  const life = (t.ms ?? []).reduce((s, m) => s + m, 0);
  return (
    <div style={{ padding: "6px" }}>
      {RUNS.map((r) => (
        <Row key={r.label} title={`${d.name}'s trail mark, ${r.label}: frame by frame at 4x (fresh to faded), ${color}; its box dashed (${t.w} x ${t.h}); a square is 69 units`}>
          {frames.map((f) => (
            <Cell key={f} label={`frame ${f} (${t.ms[f]} ms)`}>
              <MarkOnSquare t={t} finish={fin(color, 25)} v={r.v} flip={r.flip} f={f} n={0} scale={1.8} dark={r.dark} />
            </Cell>
          ))}
          <Cell label="next mark, frame 0">
            <MarkOnSquare t={t} finish={fin(color, 25)} v={r.v} flip={r.flip} f={0} n={1} scale={1.8} dark={r.dark} />
          </Cell>
        </Row>
      ))}
      <Row title={`Town size (a square 31 px): every frame, each way it runs, on a light and a dark square (life ${life} ms; one every ${t.every ?? 1} square${(t.every ?? 1) > 1 ? "s" : ""})`}>
        {RUNS.flatMap((r) =>
          [false, true].map((dark) => (
            <Cell key={`${r.label}${dark}`} label={`${r.v}${r.flip ? " left" : ""}`}>
              <div style={{ display: "flex" }}>
                {Array.from({ length: n }, (_, f) => (
                  <MarkOnSquare key={f} t={t} finish={fin(color, 25)} v={r.v} flip={r.flip} f={f} n={f % 2} scale={0.45} dark={dark} box={false} />
                ))}
              </div>
            </Cell>
          )),
        )}
      </Row>
      <Row title="Every color at 75% purity, frame 0, running right, at 2x">
        {ITEM_COLORS.map((c) => (
          <Cell key={c.id} label={c.name}>
            <MarkOnSquare t={t} finish={{ ...fin(c.id, 25, 1000 + c.weight * 10), color2: d.colors === 2 ? "yellow" : undefined }} v="side" flip={false} f={0} n={0} scale={0.9} dark={false} box={false} />
          </Cell>
        ))}
      </Row>
    </div>
  );
}

/** A trail mark's numbers and whether every frame stays inside its box (its drawn shapes, outlines aside, 2 units' slack). */
function trailFacts(t: RiderTrail): object {
  const n = t.ms?.length ?? 0;
  if (!n || t.ms.some((m) => !(m > 0))) warnings.push(`trail.ms must be one or more frame lengths in ms, each above 0 (it is ${JSON.stringify(t.ms)})`);
  if (!(t.w > 0 && t.h > 0) || t.w > TRAIL_MAX.w || t.h > TRAIL_MAX.h) warnings.push(`trail.w and trail.h must be above 0 and at most ${TRAIL_MAX.w} and ${TRAIL_MAX.h} (they are ${t.w} and ${t.h})`);
  if (t.every !== undefined && !(Number.isInteger(t.every) && t.every >= 1)) warnings.push(`trail.every must be a whole number of squares, 1 or more (it is ${t.every})`);
  const g = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  document.body.append(g);
  const past: string[] = [];
  for (const v of ["side", "back", "front"] as const)
    for (let f = 0; f < n; f++) {
      const host = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.append(host);
      render(<TrailLayer t={t} finish={fin("red")} v={v} f={f} n={0} />, host);
      host.querySelectorAll(".item-shine").forEach((e) => e.remove());
      const b = host.getBBox();
      if (b.width && (b.x < -t.w / 2 - 2 || b.y < -t.h / 2 - 2 || b.x + b.width > t.w / 2 + 2 || b.y + b.height > t.h / 2 + 2)) past.push(`${v} frame ${f} (${[b.x, b.y, b.width, b.height].map((x) => x.toFixed(0)).join(", ")})`);
      render(null, host);
      host.remove();
    }
  g.remove();
  if (past.length) warnings.push(`the trail mark spills past its box (${-t.w / 2}, ${-t.h / 2}, ${t.w}, ${t.h}): ${past.slice(0, 4).join("; ")}`);
  return { frames: n, lifeMs: (t.ms ?? []).reduce((s, m) => s + m, 0), every: t.every ?? 1, w: t.w, h: t.h };
}

// ---------------- Facts ----------------

/** The art's box on frame 0, and whether it rises past the avatar's cap (9 points over the square). */
function measure(): object {
  const facts: Record<string, unknown> = {};
  if (item) {
    facts.item = { id: item.id, slot: item.slot, tier: item.tier, frames: item.motion?.ms?.length ?? 0, loopMs: (item.motion?.ms ?? []).reduce((s, x) => s + x, 0) };
    const box = item.frame;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    document.body.append(g);
    for (let f = 0; f < (item.motion?.ms?.length ?? 1); f++) {
      const host = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.append(host);
      render(<DraftLayer d={item} finish={fin("red")} side="w" f={f} />, host);
      // (Measured without the shine's band, which spans the whole frame box.)
      host.querySelectorAll(".item-shine").forEach((e) => e.remove());
      const b = host.getBBox();
      if (f === 0) facts.artBox = [b.x, b.y, b.width, b.height].map((v) => +v.toFixed(1));
      const shift = ANCHOR[item.slot] !== undefined && item.attach !== undefined ? ANCHOR[item.slot]! - item.attach : 0;
      if (b.y + shift < -9) warnings.push(`frame ${f}: the art rises to y ${(b.y + shift).toFixed(1)} on the pawn; the avatar's cap cuts it at -9`);
      if (b.x < box[0] - 4 || b.y < box[1] - 4 || b.x + b.width > box[0] + box[2] + 4 || b.y + b.height > box[1] + box[3] + 4)
        warnings.push(`frame ${f}: the art (${[b.x, b.y, b.width, b.height].map((v) => v.toFixed(0)).join(", ")}) spills past its frame box (${box.join(", ")}): the tile will crop it`);
      render(null, host);
      host.remove();
    }
    g.remove();
    if ((item.slot === "head" || item.slot === "face") && item.attach === undefined) warnings.push("a head or face item needs `attach` (the line that meets the anchor)");
  }
  if (rider) {
    const counts = (v: RiderViewDraft) => ({ idleFrames: v.idle?.ms?.length ?? 0, moveFrames: v.move?.ms?.length ?? 0, idleMs: (v.idle?.ms ?? []).reduce((s, x) => s + x, 0), moveMs: (v.move?.ms ?? []).reduce((s, x) => s + x, 0) });
    facts.rider = { id: rider.id, tier: rider.tier, ...counts(rider), views: facings(rider), trail: rider.trail ? trailFacts(rider.trail) : null };
    for (const v of ["front", "back"] as const) {
      const view = rider.views?.[v];
      if (!view) continue;
      facts[v] = counts(view);
      if (!view.idle?.ms?.length) warnings.push(`views.${v}.idle.ms is empty`);
      if (!view.move?.ms?.length) warnings.push(`views.${v}.move.ms is empty`);
      for (let f = 0; f < (view.move?.ms?.length ?? 0); f++) {
        const pose = view.pose("move", f);
        if (Math.abs(pose.dx) > 12) warnings.push(`views.${v} move frame ${f}: dx ${pose.dx}; the front and back moves stay on their square (the town slides them), so dx stays about 0`);
      }
    }
  }
  return facts;
}

const root = document.getElementById("app")!;
if (req.mode !== "sheet") try {
  if (req.mode === "item") {
    if (!item) throw new Error(`the draft exports no item (an object with id, slot, frame, motion and Art); exports: ${Object.keys(DRAFT).join(", ") || "none"}`);
    render(<ItemPage d={item} />, root);
  } else {
    if (!rider) throw new Error(`the draft exports no rider (an object with id, frame, idle, move, pose, Back and Front); exports: ${Object.keys(DRAFT).join(", ") || "none"}`);
    const has = facings(rider);
    const v = req.view ?? (has.length > 1 ? "all" : "side");
    if (v === "trail") {
      if (!rider.trail) throw new Error("the ride has no trail mark yet (the RiderDraft's `trail`)");
      render(<TrailPage d={rider} t={rider.trail} />, root);
    } else {
      if (v !== "all" && !has.includes(v)) throw new Error(`the ride has no ${v} view yet (views.${v}); it has: ${has.join(", ")}`);
      render(v === "all" ? <ViewsPage d={rider} /> : <RiderPage d={rider} v={v} />, root);
    }
  }
  // Wait a frame for layout, then measure.
  requestAnimationFrame(() => {
    try {
      (window as unknown as { __DONE: object }).__DONE = { facts: measure(), warnings };
    } catch (e) {
      (window as unknown as { __DONE: object }).__DONE = { error: String(e instanceof Error ? e.stack : e), warnings };
    }
  });
} catch (e) {
  (window as unknown as { __DONE: object }).__DONE = { error: String(e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : e), warnings };
}
