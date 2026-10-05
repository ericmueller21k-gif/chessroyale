import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";
import { isShiny, itemColor, mulberry32, type ItemLook, type ItemSlot } from "@chessroyale/core";
import { PawnHat } from "./Cosmetics.tsx";

/**
 * Crate items, drawn. Every item is drawn once, on a pawn's 100 × 100 square (head centred at 50, 20), with its
 * *paint regions* marked: those get the item's colour automatically, then its blemish (dark blotches over exactly
 * that share of the colour, shaped by the item's seed) and, under 10% blemish, a sweeping shine. Outlines and
 * fixed parts (white fur, coal, ice) stay as drawn. A new item is one drawing; every colour comes free.
 */

export interface Finish {
  color: string;
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
  const count = Math.round((values.length * Math.max(0, Math.min(49, blemish))) / 100);
  const chosen = [...values].sort((a, b) => a.v - b.v).slice(0, count);
  const cell = 100 / N;
  const r = cell * 0.78;
  const d = chosen
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

const ITEM_ART: Record<string, (p: { p: Paint; side: "w" | "b" }) => ComponentChildren> = {
  "santa-hat": SantaHat,
  antlers: Antlers,
  "santa-beard": SantaBeard,
  snowman: Snowman,
  "gift-tube": GiftTube,
  "fire-ice-crown": FireIceCrown,
};

/** The shine's box where an item is drawn in its own coordinates (the tube is drawn tilted, in a group). */
const SHINE_BOX: Record<string, [number, number, number, number]> = {
  "gift-tube": [74, 22, 16, 76],
};

/** Where each item sits on the pawn's square, to frame it alone (a card, the strip): x, y, w, h. */
const FRAMES: Record<string, [number, number, number, number]> = {
  "santa-hat": [30, 0, 46, 30],
  antlers: [26, -4, 48, 22],
  "santa-beard": [36, 18, 28, 28],
  snowman: [16, 6, 68, 88],
  "gift-tube": [62, 18, 40, 82],
  "fire-ice-crown": [30, -6, 40, 34],
};

/** One item, drawn into an existing svg on the pawn's square. */
export function ItemLayer({ def, finish, side = "w" }: { def: string; finish: Finish; side?: "w" | "b" }) {
  const p = usePaint(finish, def);
  const Art = ITEM_ART[def];
  if (!Art) return null;
  return (
    <g>
      <defs>{p.defs}</defs>
      <Art p={p} side={side} />
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
  return (
    <span class="avatar cg-wrap" aria-hidden="true">
      {!skin && <piece class={`${side === "w" ? "white" : "black"} pawn`} />}
      {!at("head") && hat !== "none" && <PawnHat hat={hat} />}
      <svg class="avatar-items" viewBox="0 0 100 100">
        {skin && <ItemLayer def={skin.def} finish={skin} side={side} />}
        {(["face", "head", "weapon"] as const).map((slot) => {
          const it = at(slot);
          return it ? <ItemLayer key={slot} def={it.def} finish={it} side={side} /> : null;
        })}
      </svg>
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
