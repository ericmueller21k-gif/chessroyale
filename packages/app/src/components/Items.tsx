import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";
import { behindPiece, isShiny, itemColor, mulberry32, type ItemLook, type ItemSlot } from "@chessroyale/core";
import { PawnHat } from "./Cosmetics.tsx";

/**
 * Crate items, drawn. Every item is drawn once, on a pawn's 100 × 100 square (head centred at 50, 20), with its
 * *paint regions* marked: those get the item's colour automatically, then its blemish (dark blotches over exactly
 * that share of the colour, shaped by the item's seed; at 0% purity, all of it, a darker shade) and, at 90%+
 * purity, a sweeping shine. Outlines and fixed parts (white fur, coal, ice) stay as drawn. A new item is one
 * drawing; every colour comes free.
 */

export interface Finish {
  color: string;
  /** Two-colour items (a present's ribbon). */
  color2?: string | null;
  blemish: number;
  seed: number;
}

let uid = 0;
const useUid = () => {
  const r = useRef<string>("");
  if (!r.current) r.current = `it${++uid}`;
  return r.current;
};

/** A colour mixed towards black (amount 0-1). */
function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - amount));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * amount);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

const blotchCache = new Map<string, string>();
/**
 * The blemish: a seeded noise field over the square (smooth blobs from a coarse grid, a little fine grain), cut
 * at the level that leaves exactly `blemish`% of cells below it. Those cells become overlapping round blotches,
 * in one path (cheap even for a grid of 100 pawns).
 */
export function blotchPath(seed: number, blemish: number): string {
  const key = `${seed}:${blemish}`;
  const hit = blotchCache.get(key);
  if (hit !== undefined) return hit;
  const rng = mulberry32(seed || 1);
  const N = 18;
  const C = 6;
  const coarse = Array.from({ length: C * C }, () => rng());
  const at = (x: number, y: number) => coarse[Math.min(C - 1, y) * C + Math.min(C - 1, x)]!;
  const values: { x: number; y: number; v: number }[] = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const gx = (x / (N - 1)) * (C - 1);
      const gy = (y / (N - 1)) * (C - 1);
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = gx - x0;
      const fy = gy - y0;
      const s = (t: number) => t * t * (3 - 2 * t);
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * s(fx);
      const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * s(fx);
      values.push({ x, y, v: top + (bottom - top) * s(fy) + (rng() - 0.5) * 0.18 });
    }
  const count = Math.round((values.length * Math.max(0, Math.min(100, blemish))) / 100);
  const chosen = new Set([...values].sort((a, b) => a.v - b.v).slice(0, count).map(({ x, y }) => y * N + x));
  // Items reach a little past the square (antler tips, flames): two rings of cells around it copy the nearest cell
  // inside, so blotches run on to the item's edge, and at 0% purity they cover all of it.
  const PAD = 2;
  const inside = (i: number) => Math.max(0, Math.min(N - 1, i));
  const cells: { x: number; y: number }[] = [];
  for (let y = -PAD; y < N + PAD; y++) for (let x = -PAD; x < N + PAD; x++) if (chosen.has(inside(y) * N + inside(x))) cells.push({ x, y });
  const cell = 100 / N;
  const r = cell * 0.78;
  const d = cells
    .map(({ x, y }) => {
      const cx = (x + 0.5) * cell;
      const cy = (y + 0.5) * cell;
      return `M${(cx - r).toFixed(1)} ${cy.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`;
    })
    .join("");
  blotchCache.set(key, d);
  return d;
}

/** The paint for one item: its fill (a gradient for the sheen colours), blotch colour and the clip id. */
interface Paint {
  id: string;
  fill: string;
  blotch: string;
  hex: string;
  defs: ComponentChildren;
  finish: Finish;
  /** Fills that go from the colour to a bright tip (the crown's flames). */
  flameFill: string;
  /** The item's own box (where it's drawn), so the shine rolls across the item itself. */
  box: [number, number, number, number];
}

function usePaint(finish: Finish, def: string): Paint {
  const id = useUid();
  const c = itemColor(finish.color);
  const sheen = c.hex2;
  const defs = (
    <>
      {sheen && (
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color={c.hex} />
          <stop offset="0.5" stop-color={sheen} />
          <stop offset="1" stop-color={c.hex} />
        </linearGradient>
      )}
      <linearGradient id={`${id}-f`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color={c.hex} />
        <stop offset="0.65" stop-color={lighten(c.hex, 0.35)} />
        <stop offset="1" stop-color={lighten(c.hex, 0.85)} />
      </linearGradient>
      {isShiny(finish.blemish) && (
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="1" y2="0.5">
          <stop offset="0.12" stop-color="#fff" stop-opacity="0" />
          <stop offset="0.35" stop-color="#fff" stop-opacity="0.3" />
          <stop offset="0.5" stop-color="#fff" stop-opacity="0.75" />
          <stop offset="0.65" stop-color="#fff" stop-opacity="0.3" />
          <stop offset="0.88" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
      )}
    </>
  );
  return {
    id,
    fill: sheen ? `url(#${id}-g)` : c.hex,
    blotch: c.id === "pearl" ? "#9b8fb0" : darken(c.hex, c.id === "midnight" ? 0.5 : 0.42),
    hex: c.hex,
    defs,
    finish,
    flameFill: `url(#${id}-f)`,
    box: SHINE_BOX[def] ?? FRAMES[def] ?? [0, 0, 100, 100],
  };
}

/** Line widths scale with how closely the item is framed (--sw), so outlines stay crisp on a card and in a grid. */
const lw = (n: number) => ({ style: `stroke-width: calc(var(--sw, 1) * ${n}px)` });
const LINE = { stroke: "#1d1d1f", "stroke-linejoin": "round" as const, "stroke-linecap": "round" as const, ...lw(3) };

/**
 * A painted region: its paths filled with the item's colour, the blemish blotches (clipped to the region), an
 * optional overlay (stripes), the shine when shiny, then the outline.
 */
function Region({ p, d, name, fill, over, outline = true }: { p: Paint; d: string[]; name: string; fill?: string; over?: ComponentChildren; outline?: boolean }) {
  const clip = `${p.id}-${name}`;
  const blotches = p.finish.blemish > 0 ? blotchPath(p.finish.seed + name.length * 7919, p.finish.blemish) : "";
  return (
    <g>
      <clipPath id={clip}>
        {d.map((x) => (
          <path key={x} d={x} />
        ))}
      </clipPath>
      {d.map((x) => (
        <path key={x} d={x} fill={fill ?? p.fill} />
      ))}
      <g clip-path={`url(#${clip})`}>
        {over}
        {blotches && <path d={blotches} fill={p.blotch} opacity="0.85" />}
        {isShiny(p.finish.blemish) && (
          // The shine: a soft band of light that rolls slowly across the item (a CSS animation slides it).
          <g class="item-shine" style={{ "--shine-d": `${(p.box[2] * 1.2).toFixed(1)}px` }}>
            <rect x={p.box[0]} y={p.box[1]} width={p.box[2]} height={p.box[3]} fill={`url(#${p.id}-s)`} />
          </g>
        )}
      </g>
      {outline &&
        d.map((x) => (
          <path key={x} d={x} fill="none" {...LINE} />
        ))}
    </g>
  );
}

// ---------------- The items ----------------

const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${100 - Number(x)} ${y}`);

function SantaHat({ p }: { p: Paint }) {
  return (
    <g>
      <Region p={p} name="cone" d={["M37 21 Q39 6 54 5 Q67 5 72 15 L67 18 Q62 12 56 12 Q61 16 63 21 Z"]} />
      <rect x="33" y="18" width="34" height="8" rx="4" fill="#f8fafc" {...LINE} />
      <circle cx="70" cy="18" r="4.6" fill="#f8fafc" {...LINE} />
    </g>
  );
}

const ANTLER = "M47 16 L44 19 L37 12 L29 11 L27 7 L34 7 L31 0 L35 -2 L38 6 L40 7 L39 -4 L43 -4 L44 7 L50 13 Z";
function Antlers({ p }: { p: Paint }) {
  return <Region p={p} name="antlers" d={[ANTLER, mirror(ANTLER)]} />;
}

function SantaBeard({ p }: { p: Paint }) {
  return (
    <g>
      <Region p={p} name="beard" d={["M39 21 Q39 31 43 37 Q46 42 50 44 Q54 42 57 37 Q61 31 61 21 Q57 27 53 25 Q50 28 47 25 Q43 27 39 21 Z"]} />
      <path d="M45.5 26.5 Q50 30 54.5 26.5" fill="none" stroke="#1d1d1f" {...lw(2)} stroke-linecap="round" />
    </g>
  );
}

function Snowman({ p, side }: { p: Paint; side: "w" | "b" }) {
  const snow = side === "w" ? "#f8fafc" : "#4b5262";
  const coal = side === "w" ? "#1d1d1f" : "#e5e7eb";
  return (
    <g>
      {/* Stick arms, behind the body. */}
      <path d="M38 45 L22 34 M27 37 L24 30 M62 45 L78 34 M73 37 L76 30" fill="none" stroke="#6b4423" {...lw(2.6)} stroke-linecap="round" />
      <ellipse cx="50" cy="88" rx="26" ry="3.5" fill="#000" opacity="0.12" />
      <circle cx="50" cy="69" r="20" fill={snow} {...LINE} />
      <circle cx="50" cy="44" r="14" fill={snow} {...LINE} />
      <circle cx="50" cy="20" r="10.5" fill={snow} {...LINE} />
      <circle cx="46" cy="18" r="1.6" fill={coal} />
      <circle cx="54" cy="18" r="1.6" fill={coal} />
      <path d="M50 21 L59 23.2 L50 24.6 Z" fill="#f97316" stroke="#9a3412" {...lw(1)} stroke-linejoin="round" />
      <circle cx="50" cy="42" r="1.7" fill={coal} />
      <circle cx="50" cy="49" r="1.7" fill={coal} />
      <circle cx="50" cy="64" r="1.7" fill={coal} />
      {/* The scarf: the painted part. */}
      <Region p={p} name="scarf" d={["M38 29 Q50 35 62 29 L63 35 Q50 41 37 35 Z", "M54 35 L60 50 L54 52 L50 38 Z"]} />
    </g>
  );
}

function GiftTube({ p }: { p: Paint }) {
  const stripes = [];
  for (let y = -10; y < 110; y += 12) {
    stripes.push(<path key={`a${y}`} d={`M60 ${y} l40 18 v5 l-40 -18 Z`} fill="#fff" opacity="0.9" />);
    stripes.push(<path key={`b${y}`} d={`M60 ${y + 6} l40 18 v3 l-40 -18 Z`} fill={lighten(p.hex, 0.45)} />);
  }
  return (
    <g transform="rotate(16 82 60)">
      <Region p={p} name="tube" d={["M76 28 Q76 25 79 25 L85 25 Q88 25 88 28 L88 90 Q88 93 85 93 L79 93 Q76 93 76 90 Z"]} over={stripes} />
      <rect x="74.5" y="22" width="15" height="6" rx="2" fill="#d4a017" {...LINE} {...lw(2.4)} />
      <rect x="74.5" y="90" width="15" height="6" rx="2" fill="#d4a017" {...LINE} {...lw(2.4)} />
    </g>
  );
}

function FireIceCrown({ p }: { p: Paint }) {
  const id = p.id;
  const flame = (x: number, y: number, s: number) =>
    `M${x} ${y} C${x - 5 * s} ${y - 4 * s} ${x - 2 * s} ${y - 9 * s} ${x} ${y - 13 * s} C${x + 1 * s} ${y - 8 * s} ${x + 6 * s} ${y - 6 * s} ${x} ${y} Z`;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-ice`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f0fbff" />
          <stop offset="1" stop-color="#8fd3f4" />
        </linearGradient>
      </defs>
      <Region p={p} name="flames" fill={p.flameFill} d={[flame(39, 14, 0.8), flame(50, 9, 1), flame(61, 14, 0.8)]} />
      <path d="M33 26 L33 14 L39 18 L44 9 L50 15 L56 9 L61 18 L67 14 L67 26 Z" fill={`url(#${id}-ice)`} {...LINE} />
      <path d="M36 22 L64 22" stroke="#bae6fd" {...lw(1.6)} />
      <circle cx="50" cy="21" r="2.2" fill="#38bdf8" stroke="#1d1d1f" {...lw(1.2)} />
    </g>
  );
}

/** A present, worn as a helmet: the box over the head down to the neck, its ribbon and bow in the second colour. */
function Present({ p, p2 }: { p: Paint; p2: Paint }) {
  return (
    <g>
      <Region p={p} name="box" d={["M37 22 L63 22 L63 38 Q63 39.5 61.5 39.5 L38.5 39.5 Q37 39.5 37 38 Z", "M35 15.5 Q35 14.5 36 14.5 L64 14.5 Q65 14.5 65 15.5 L65 22 L35 22 Z"]} />
      <Region p={p2} name="ribbon" d={["M47 14.5 L53 14.5 L53 39.5 L47 39.5 Z", "M50 14.5 C44 4 34 7 40 14.5 Z", "M50 14.5 C56 4 66 7 60 14.5 Z"]} />
      <path d="M47 22 H53" fill="none" {...LINE} {...lw(2)} />
      <Region p={p2} name="knot" d={["M47.4 13.6 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 Z"]} outline={false} />
      <circle cx="50" cy="13.6" r="2.6" fill="none" {...LINE} {...lw(2)} />
    </g>
  );
}

/** A candy cane at the pawn's side: white, striped in its colour. */
const CANE = "M86 94 L86 30 A14 14 0 0 0 58 30 L58 33 A3 3 0 0 0 64 33 L64 30 A8 8 0 0 1 80 30 L80 94 A3 3 0 0 0 86 94 Z";
function CandyCane({ p }: { p: Paint }) {
  const stripes = [];
  for (let y = -6; y < 112; y += 10) stripes.push(`M50 ${y} L100 ${y + 22} L100 ${y + 27} L50 ${y + 5} Z`);
  return (
    <g transform="rotate(14 80 60)">
      <clipPath id={`${p.id}-cane`}>
        <path d={CANE} />
      </clipPath>
      <path d={CANE} fill="#fbfbf8" />
      <g clip-path={`url(#${p.id}-cane)`}>
        <Region p={p} name="stripes" d={stripes} outline={false} />
        <path d="M84.5 34 V90" stroke="#fff" opacity="0.55" {...lw(1.6)} stroke-linecap="round" />
      </g>
      <path d={CANE} fill="none" {...LINE} />
    </g>
  );
}

/** A gingerbread man (a skin): the whole cookie takes the colour; white icing, gumdrop buttons. */
const GINGER =
  "M56 34.5 Q60 38 66 39 L78 40 Q84 41 84 47 Q84 53 78 53 L64 53 L64 62 L74 82 Q77 89 70 91 Q65 92 63 87 L53 73 Q50 68 47 73 L37 87 Q35 92 30 91 Q23 89 26 82 L36 62 L36 53 L22 53 Q16 53 16 47 Q16 41 22 40 L34 39 Q40 38 44 34.5 A13 13 0 1 1 56 34.5 Z";
function Gingerbread({ p, side }: { p: Paint; side: "w" | "b" }) {
  const icing = side === "w" ? "#fffdf7" : "#2b1d16";
  const zig = (x: number, y: number, dx: number, dy: number, n: number) => {
    let d = `M${x} ${y}`;
    for (let i = 1; i <= n; i++) d += ` L${x + dx * i} ${y + (i % 2 ? dy : 0)}`;
    return d;
  };
  return (
    <g>
      <ellipse cx="50" cy="92" rx="26" ry="3" fill="#000" opacity="0.12" />
      <Region p={p} name="cookie" d={[GINGER]} />
      <g fill="none" stroke={icing} stroke-linecap="round" stroke-linejoin="round" {...lw(1.8)}>
        <path d="M22.5 42 Q25 46.5 22.5 51" />
        <path d={"M77.5 42 Q75 46.5 77.5 51"} />
        <path d={zig(27, 82.5, 2, 2.4, 4)} />
        <path d={zig(65, 82.5, 2, 2.4, 4)} />
        <path d="M45 27 Q50 31 55 27" />
      </g>
      <circle cx="45.5" cy="21" r="1.9" fill={icing} />
      <circle cx="54.5" cy="21" r="1.9" fill={icing} />
      {[44, 52, 60].map((y, i) => (
        <circle key={y} cx="50" cy={y} r="2.6" fill={["#e11d48", "#16a34a", "#e11d48"][i]} stroke="#1d1d1f" {...lw(1.2)} />
      ))}
    </g>
  );
}

/** The cburnett pawn, on the 100 × 100 square (for skins that show the pawn itself). */
const PAWN_PATH =
  "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z";

/** A chimney (a skin): the pawn sitting in a red-brick chimney up to its chest; the cap takes the colour. */
function Chimney({ p, side }: { p: Paint; side: "w" | "b" }) {
  const bricks = [];
  for (let row = 0, y = 64; y < 96; row++, y += 6.5) {
    bricks.push(<path key={`h${y}`} d={`M24 ${y} H76`} />);
    for (let x = row % 2 ? 31 : 37.5; x < 76; x += 13) bricks.push(<path key={`v${y}-${x}`} d={`M${x} ${y} v6.5`} />);
  }
  return (
    <g>
      <g transform="scale(2.2222)">
        <path d={PAWN_PATH} fill={side === "w" ? "#fff" : "#000"} stroke="#000" stroke-width="1.5" stroke-linecap="round" />
      </g>
      <ellipse cx="50" cy="95" rx="30" ry="3" fill="#000" opacity="0.12" />
      <clipPath id={`${p.id}-brick`}>
        <rect x="24" y="61" width="52" height="33" />
      </clipPath>
      <rect x="24" y="61" width="52" height="33" fill="#b3322b" />
      <g clip-path={`url(#${p.id}-brick)`} fill="none" stroke="#f3eee6" {...lw(1.5)}>
        {bricks}
      </g>
      <rect x="24" y="61" width="52" height="33" fill="none" {...LINE} />
      <Region p={p} name="cap" d={["M19 55 Q19 53.5 20.5 53.5 L79.5 53.5 Q81 53.5 81 55 L81 62.5 L19 62.5 Z"]} />
    </g>
  );
}

const ITEM_ART: Record<string, (p: { p: Paint; p2: Paint; side: "w" | "b" }) => ComponentChildren> = {
  "santa-hat": SantaHat,
  antlers: Antlers,
  "santa-beard": SantaBeard,
  snowman: Snowman,
  "gift-tube": GiftTube,
  "fire-ice-crown": FireIceCrown,
  present: Present,
  "candy-cane": CandyCane,
  gingerbread: Gingerbread,
  chimney: Chimney,
};

/** The shine's box where an item is drawn in its own coordinates (the tube is drawn tilted, in a group). */
const SHINE_BOX: Record<string, [number, number, number, number]> = {
  "gift-tube": [74, 22, 16, 76],
  "candy-cane": [56, 14, 32, 84],
};

/** Where each item sits on the pawn's square, to frame it alone (a card, the strip): x, y, w, h. */
const FRAMES: Record<string, [number, number, number, number]> = {
  "santa-hat": [30, 0, 46, 30],
  antlers: [26, -4, 48, 22],
  "santa-beard": [36, 18, 28, 28],
  snowman: [16, 6, 68, 88],
  "gift-tube": [62, 18, 40, 82],
  "fire-ice-crown": [30, -6, 40, 34],
  present: [31, 1, 38, 41],
  "candy-cane": [60, 12, 38, 88],
  gingerbread: [14, 8, 72, 86],
  chimney: [16, 14, 68, 84],
};

/**
 * Fitting items to the piece. A piece (the pawn, or a skin) has anchor points on its 100 × 100 square: where a
 * hat's brim sits (a few points below the top of its head, like a real hat) and where a beard starts (just below
 * the middle of its head). Each item names the line in its own drawing that meets its slot's anchor (a hat's brim,
 * a beard's top edge), and the avatar lines them up. A new item needs only that one number; a new skin, its anchors.
 * (The cburnett pawn's head: top at y 20, centre 29, radius 9.)
 */
const PAWN_ANCHORS = { head: 25, face: 40 };
const SKIN_ANCHORS: Record<string, { head: number; face: number }> = {
  snowman: { head: 14, face: 22 },
  gingerbread: { head: 15, face: 26 },
  // The chimney shows the pawn itself, so its anchors are the pawn's.
  chimney: PAWN_ANCHORS,
};
/** The line in each item's drawing that meets its slot's anchor (head and face items). */
const ATTACH: Record<string, number> = {
  "santa-hat": 22,
  antlers: 16,
  "fire-ice-crown": 24,
  "santa-beard": 23,
  present: 25,
};
/** How far a piece's anchors sit from the pawn's (for the old shop hats, drawn for the pawn). */
export const anchorsFor = (skin?: string) => (skin && SKIN_ANCHORS[skin]) || PAWN_ANCHORS;

/** One item, drawn into an existing svg on the pawn's square. */
export function ItemLayer({ def, finish, side = "w" }: { def: string; finish: Finish; side?: "w" | "b" }) {
  const p = usePaint(finish, def);
  // The second colour (two-colour items): the same blemish, its own blotches.
  const p2 = usePaint({ color: finish.color2 ?? finish.color, blemish: finish.blemish, seed: finish.seed + 101 }, def);
  const Art = ITEM_ART[def];
  if (!Art) return null;
  return (
    <g>
      <defs>
        {p.defs}
        {p2.defs}
      </defs>
      <Art p={p} p2={p2} side={side} />
    </g>
  );
}

/** One item on its own, framed square (cards, the strip, the reveal). A sparkle when shiny. */
export function ItemArt({ def, finish, side = "w", class: cls }: { def: string; finish: Finish; side?: "w" | "b"; class?: string }) {
  const [x, y, w, h] = FRAMES[def] ?? [0, 0, 100, 100];
  const s = Math.max(w, h) * 1.12;
  const vb = `${x + w / 2 - s / 2} ${y + h / 2 - s / 2} ${s} ${s}`;
  return (
    <span class={`item-art${isShiny(finish.blemish) ? " shiny" : ""}${cls ? ` ${cls}` : ""}`} style={{ "--sw": String(Math.max(0.4, s / 100)) }}>
      <svg viewBox={vb} aria-hidden="true">
        <ItemLayer def={def} finish={finish} side={side} />
      </svg>
    </span>
  );
}

/**
 * A player as a pawn (or a snowman) wearing their items: skin, then face, head and a weapon at their side. The
 * old shop hat shows when no crate item is on the head. Used in the votes and on the cut screen.
 */
export function Avatar({ look, side = "w", hat = "none" }: { look?: ItemLook; side?: "w" | "b"; hat?: string }) {
  const at = (slot: ItemSlot) => look?.[slot];
  const skin = at("skin");
  // Worn items in drawing order (face, head, then a weapon), split by layer: behind the piece or in front of it.
  const worn = (["face", "head", "weapon"] as const).flatMap((slot) => {
    const it = at(slot);
    return it ? [{ slot, it }] : [];
  });
  const anchors = anchorsFor(skin?.def);
  /** How far to move an item so its attach line meets its slot's anchor on this piece. */
  const shift = (slot: ItemSlot, def: string) => (slot === "head" || slot === "face") && ATTACH[def] !== undefined ? anchors[slot] - ATTACH[def]! : 0;
  const layer = (back: boolean) => (
    // (Items may rise a little above the square, never more: the clip caps their height.)
    <svg class={`avatar-items ${back ? "back" : "front"}`} viewBox="0 0 100 100">
      <defs>
        <clipPath id="avatar-cap">
          <rect x="-12" y="-9" width="124" height="112" />
        </clipPath>
      </defs>
      <g clip-path="url(#avatar-cap)">
        {worn
          .filter(({ it }) => behindPiece(it.def) === back)
          .map(({ slot, it }) => (
            <g key={slot} transform={`translate(0 ${shift(slot, it.def)})`}>
              <ItemLayer def={it.def} finish={it} side={side} />
            </g>
          ))}
      </g>
    </svg>
  );
  return (
    <span class="avatar cg-wrap" aria-hidden="true">
      {layer(true)}
      {skin ? (
        <svg class="avatar-skin" viewBox="0 0 100 100">
          <ItemLayer def={skin.def} finish={skin} side={side} />
        </svg>
      ) : (
        <piece class={`${side === "w" ? "white" : "black"} pawn`} />
      )}
      {!at("head") && hat !== "none" && (
        <span class="avatar-hat" style={{ transform: `translateY(${anchors.head - PAWN_ANCHORS.head}%)` }}>
          <PawnHat hat={hat} />
        </span>
      )}
      {layer(false)}
    </span>
  );
}

/** Fischer Random's tile: a solid gold king's crown with a question mark. */
export function FischerArt() {
  return (
    <span class="item-art fischer-art">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="fischer-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffe58a" />
            <stop offset="1" stop-color="#d49b12" />
          </linearGradient>
        </defs>
        <path d="M18 78 L14 34 L32 50 L50 22 L68 50 L86 34 L82 78 Z" fill="url(#fischer-gold)" {...LINE} />
        <rect x="16" y="76" width="68" height="10" rx="3" fill="url(#fischer-gold)" {...LINE} />
        <circle cx="50" cy="16" r="6" fill="url(#fischer-gold)" {...LINE} />
        <text x="50" y="72" text-anchor="middle" font-size="34" font-weight="900" fill="#3b2a00" font-family="system-ui, sans-serif">
          ?
        </text>
      </svg>
    </span>
  );
}

/** A Winter Crate: a frosted box with a ribbon and a snowflake. */
export function CrateArt() {
  return (
    <span class="item-art crate-art">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="crate-ice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#3b6fd8" />
            <stop offset="1" stop-color="#1b2f74" />
          </linearGradient>
        </defs>
        <rect x="14" y="34" width="72" height="52" rx="5" fill="url(#crate-ice)" {...LINE} />
        <rect x="10" y="24" width="80" height="14" rx="4" fill="#4f86f0" {...LINE} />
        <rect x="45" y="24" width="10" height="62" fill="#e11d48" stroke="#1d1d1f" {...lw(2)} />
        <path d="M50 24 C40 10 30 16 38 22 Z M50 24 C60 10 70 16 62 22 Z" fill="#e11d48" {...LINE} {...lw(2)} />
        <g stroke="#e0f2fe" {...lw(2.4)} stroke-linecap="round">
          <path d="M28 52 v18 M20 61 h16 M22.5 55.5 l11 11 M33.5 55.5 l-11 11" />
          <path d="M72 52 v18 M64 61 h16 M66.5 55.5 l11 11 M77.5 55.5 l-11 11" />
        </g>
      </svg>
    </span>
  );
}

/** A key. */
export function KeyArt() {
  return (
    <span class="item-art key-art">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="32" cy="50" r="16" fill="#fbbf24" {...LINE} />
        <circle cx="32" cy="50" r="6" fill="#1b2f74" stroke="#1d1d1f" {...lw(2)} />
        <path d="M47 46 H86 V54 H80 V62 H72 V54 H66 V60 H58 V54 H47 Z" fill="#fbbf24" {...LINE} />
      </svg>
    </span>
  );
}
