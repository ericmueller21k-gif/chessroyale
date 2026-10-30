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
import { Pawn, usePaint, type Finish, type ItemDraft, type RiderDraft } from "./item-kit.tsx";

interface Req {
  mode: "item" | "rider";
  /** Which frames of the motion to show big (default all, at most 8). */
  frames?: number[];
  /** Rider mode: which animation the big row shows. */
  anim?: "idle" | "move";
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
const fin = (color: string, blemish = 0, seed = 4242): Finish => ({ color, blemish, seed });
const GROUND = "#2a2d34";

function Label({ children }: { children: ComponentChildren }) {
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
function DraftLayer({ d, finish, side, f }: { d: ItemDraft; finish: Finish; side: "w" | "b"; f: number }) {
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
function OnPawn({ d, finish, side, f, px, ground = true }: { d: ItemDraft; finish: Finish; side: "w" | "b"; f: number; px: number; ground?: boolean }) {
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
        </>
      )}
    </svg>
  );
}

/** An existing item on a pawn, for the style. */
function RefOnPawn({ def, px, side = "w" }: { def: string; px: number; side?: "w" | "b" }) {
  const skin = def === "captains-coat" || def === "ninja-gi" || def === "snowman";
  return (
    <svg width={px} height={px} viewBox="0 0 100 100" style={{ overflow: "visible", background: GROUND, display: "block" }}>
      {!skin && <Pawn side={side} />}
      <ItemLayer def={def} finish={fin("cobalt", 25)} side={side} />
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

/** The rider's box around its pawn: wide enough for a big ride, and the next square for the move. */
const RB = { x: -45, y: -45, w: 190, h: 165 };

function RiderLayer({ d, finish, side, anim, f }: { d: RiderDraft; finish: Finish; side: "w" | "b"; anim: "idle" | "move"; f: number }) {
  const box: [number, number, number, number] = d.frame;
  const p = usePaint(finish, box);
  const p2 = usePaint({ ...finish, color: finish.color2 ?? finish.color, seed: finish.seed + 101 }, box);
  const pose = d.pose(anim, f);
  const clip = `cut-${anim}-${f}-${finish.color}-${side}`;
  return (
    <g transform={`translate(${pose.dx} ${pose.dy})`}>
      <defs>
        {p.defs}
        {p2.defs}
        <clipPath id={clip}>
          <rect x="-50" y="-60" width="200" height={60 + pose.cut} />
        </clipPath>
      </defs>
      {d.Back({ p, p2, side, f, anim })}
      <g transform={`translate(${pose.pawnX} ${pose.pawnY}) rotate(${pose.pawnTilt ?? 0} 50 88)`}>
        <g clip-path={`url(#${clip})`}>
          <Pawn side={side} />
        </g>
      </g>
      {d.Front({ p, p2, side, f, anim })}
    </g>
  );
}

/** The two town squares the move goes across, under the ride (a checker of the park's paving). */
function Squares({ n = 2 }: { n?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={i * 100} y="80" width="100" height="22" fill={i % 2 ? "#4a4f5a" : "#5b616d"} />
      ))}
    </g>
  );
}

function RiderView({ d, finish, side, anim, f, scale, move = false }: { d: RiderDraft; finish: Finish; side: "w" | "b"; anim: "idle" | "move"; f: number; scale: number; move?: boolean }) {
  const w = move ? RB.w + 100 : RB.w;
  return (
    <svg width={w * scale} height={RB.h * scale} viewBox={`${RB.x} ${RB.y} ${w} ${RB.h}`} style={{ background: GROUND, display: "block" }}>
      <Squares n={move ? 2 : 1} />
      <RiderLayer d={d} finish={finish} side={side} anim={anim} f={f} />
    </svg>
  );
}

function RiderPage({ d }: { d: RiderDraft }) {
  const anim = req.anim ?? "idle";
  const a = d[anim];
  const n = a?.ms?.length ?? 0;
  if (!n) warnings.push(`${anim}.ms is empty`);
  const frames = (req.frames?.length ? req.frames : Array.from({ length: n }, (_, i) => i)).filter((i) => i >= 0 && i < n).slice(0, req.all ? 64 : 8);
  const side = req.side ?? "w";
  const color = req.color ?? "red";
  const moveN = d.move?.ms?.length ?? 0;
  const big = anim === "idle" ? 1.8 : 1.15;
  return (
    <div style={{ padding: "6px" }}>
      <Row title={`${d.name} (rider, ${d.tier}): "${anim}" frame by frame with a ${side === "w" ? "white" : "black"} pawn riding (4x), ${color}, 75% purity`}>
        {frames.map((f) => (
          <Cell key={f} label={`frame ${f} (${a.ms[f]} ms)`}>
            <RiderView d={d} finish={fin(color, 25)} side={side} anim={anim} f={f} scale={req.all ? 1 : big} move={anim === "move"} />
          </Cell>
        ))}
      </Row>
      <Row title="Town size (a pawn about 45 px): at rest, then every frame of its move across a square">
        <Cell label="idle">
          <RiderView d={d} finish={fin(color, 25)} side="w" anim="idle" f={0} scale={0.45} />
        </Cell>
        {Array.from({ length: Math.min(moveN, 12) }, (_, f) => (
          <Cell key={f} label={`move ${f}`}>
            <RiderView d={d} finish={fin(color, 25)} side="w" anim="move" f={f} scale={0.45} move />
          </Cell>
        ))}
      </Row>
      <Row title="Every color at 75% purity; 100%; shiny; its locker tile; existing items for the style">
        {ITEM_COLORS.map((c) => (
          <Cell key={c.id} label={c.name}>
            <RiderView d={d} finish={{ ...fin(c.id, 25, 1000 + c.weight * 10), color2: d.colors === 2 ? "yellow" : undefined }} side="w" anim="idle" f={0} scale={0.62} />
          </Cell>
        ))}
        <Cell label="100%">
          <RiderView d={d} finish={fin(color, 0)} side="w" anim="idle" f={0} scale={0.62} />
        </Cell>
        <Cell label="shiny">
          <RiderView d={d} finish={fin(color, 5)} side="b" anim="idle" f={0} scale={0.62} />
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
  if (rider) facts.rider = { id: rider.id, tier: rider.tier, idleFrames: rider.idle?.ms?.length ?? 0, moveFrames: rider.move?.ms?.length ?? 0, idleMs: (rider.idle?.ms ?? []).reduce((s, x) => s + x, 0), moveMs: (rider.move?.ms ?? []).reduce((s, x) => s + x, 0) };
  return facts;
}

const root = document.getElementById("app")!;
try {
  if (req.mode === "item") {
    if (!item) throw new Error(`the draft exports no item (an object with id, slot, frame, motion and Art); exports: ${Object.keys(DRAFT).join(", ") || "none"}`);
    render(<ItemPage d={item} />, root);
  } else {
    if (!rider) throw new Error(`the draft exports no rider (an object with id, frame, idle, move, pose, Back and Front); exports: ${Object.keys(DRAFT).join(", ") || "none"}`);
    render(<RiderPage d={rider} />, root);
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
