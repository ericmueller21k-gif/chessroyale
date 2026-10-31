import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";
import { isShiny, itemColor, mulberry32 } from "@chessroyale/core";

/**
 * The paint every drawn crate item uses (moved out of Items.tsx on Oct 31, word for word, so the rides' drawings in
 * `rides/` can use it too): an item's color (a gradient for the sheen colors), its blemish's blotches (seeded, covering
 * exactly that share of each painted region), the shine at 90%+ purity, the outlines (`LINE`, `lw`) and `Region`, a
 * painted part. Items.tsx (the items, the avatar) and the rides import it; nothing here knows any item.
 */

export interface Finish {
  color: string;
  /** Two-color items (a present's ribbon). */
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

/** A color mixed toward black (amount 0-1). */
export function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - amount));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
/** A color mixed toward white (amount 0-1). */
export function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * amount);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** Whether a color is light (so lines on it should be darker, not lighter). */
export const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6;
};

const N = 18;
const CELL = 100 / N;
const R = CELL * 0.78;
export type Box = [number, number, number, number];

/** A canvas, only to test points against a region's paths. */
let probe: CanvasRenderingContext2D | null | undefined;
/**
 * The sample points inside a region, one per square unit: their positions and, for each, the cells whose blotch
 * would cover it (as indices into `cells`, the cells that touch the region at all).
 */
const regionCache = new Map<string, { xs: number[]; ys: number[]; near: number[][]; cells: number[] }>();
function regionSamples(d: string[], box: Box) {
  const key = `${box.join(",")}|${d.join("|")}`;
  const hit = regionCache.get(key);
  if (hit) return hit;
  if (probe === undefined) probe = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  const paths = probe ? d.map((x) => new Path2D(x)) : [];
  const out = { xs: [] as number[], ys: [] as number[], near: [] as number[][], cells: [] as number[] };
  const index = new Map<number, number>();
  for (let y = box[1] - 6 + 0.5; y < box[1] + box[3] + 6; y++)
    for (let x = box[0] - 6 + 0.5; x < box[0] + box[2] + 6; x++) {
      if (!paths.some((path) => probe!.isPointInPath(path, x, y))) continue;
      const i0 = Math.floor(x / CELL);
      const j0 = Math.floor(y / CELL);
      const near: number[] = [];
      for (let j = j0 - 1; j <= j0 + 1; j++)
        for (let i = i0 - 1; i <= i0 + 1; i++) {
          if ((x - (i + 0.5) * CELL) ** 2 + (y - (j + 0.5) * CELL) ** 2 > R * R) continue;
          const c = cellId(i, j);
          if (!index.has(c)) index.set(c, out.cells.push(c) - 1);
          near.push(index.get(c)!);
        }
      out.xs.push(x);
      out.ys.push(y);
      out.near.push(near);
    }
  regionCache.set(key, out);
  return out;
}
/** Cells are numbered by (i, j) on a grid that runs past the square (a few items reach outside it). */
const cellId = (i: number, j: number) => (j + 8) * 64 + (i + 8);
const cellCentre = (c: number) => [((c % 64) - 8 + 0.5) * CELL, (Math.floor(c / 64) - 8 + 0.5) * CELL] as const;

const blotchCache = new Map<string, string>();
/**
 * The blemish: a seeded noise field (smooth blobs from a coarse grid, a little fine grain) on an 18 × 18 grid of
 * cells over the square; cells outside it copy the nearest one inside. Every cell below a cut becomes a round
 * blotch, all in one path (cheap even for a grid of 100 pawns). The cut is set on the region itself (`d`, within
 * its item's `box`): the level at which the blotches cover exactly `blemish`% of it, so a thin tube or a small
 * scarf is as blotched as its purity says, wherever the blobs fall. At 100% the region is covered entirely.
 */
export function blotchPath(seed: number, blemish: number, d: string[] = [], box: Box = [0, 0, 100, 100]): string {
  const share = Math.max(0, Math.min(100, blemish)) / 100;
  if (share >= 1) return `M${box[0] - 6} ${box[1] - 6}h${box[2] + 12}v${box[3] + 12}h${-box[2] - 12}Z`;
  const key = `${seed}:${blemish}:${box.join(",")}|${d.join("|")}`;
  const hit = blotchCache.get(key);
  if (hit !== undefined) return hit;
  const rng = mulberry32(seed || 1);
  const C = 6;
  const coarse = Array.from({ length: C * C }, () => rng());
  const at = (x: number, y: number) => coarse[Math.min(C - 1, y) * C + Math.min(C - 1, x)]!;
  const values: number[] = [];
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
      values.push(top + (bottom - top) * s(fy) + (rng() - 0.5) * 0.18);
    }
  const inside = (i: number) => Math.max(0, Math.min(N - 1, i));
  const value = (c: number) => values[inside(Math.floor(c / 64) - 8) * N + inside((c % 64) - 8)]!;
  const { xs, ys, near, cells } = regionSamples(d, box);
  /** A round blotch; `hollow` winds the other way, cutting a clean hole out of the blotch around it. */
  const circle = (c: number, r: number, hollow = false) => {
    const [cx, cy] = cellCentre(c);
    const a = `a${r.toFixed(2)} ${r.toFixed(2)} 0 1 ${hollow ? 1 : 0}`;
    return `M${(cx - r).toFixed(2)} ${cy.toFixed(2)}${a} ${(2 * r).toFixed(2)} 0${a} ${(-2 * r).toFixed(2)} 0`;
  };
  const vals = cells.map(value);
  // Cells below `cut` are whole blotches; a cell at exactly `cut` is part of one (`partial`), so the share is exact.
  let cut = -Infinity;
  let partial: ((c: number) => string) | null = null;
  if (xs.length) {
    // A point is blotched once the cut reaches the lowest cell covering it. Cut just below the level that would
    // cover `share` of the region's points, then blotch part of that level's cell to cover exactly the rest.
    const lows = new Float64Array(xs.length);
    for (let n = 0; n < xs.length; n++) {
      let m = Infinity;
      for (const c of near[n]!) if (vals[c]! < m) m = vals[c]!;
      lows[n] = m;
    }
    const sorted = lows.slice().sort();
    const k = Math.round(sorted.length * share);
    if (k >= sorted.length) cut = Infinity;
    else if (k > 0) {
      cut = sorted[k]!;
      const rest = k - sorted.indexOf(cut);
      // The part grows as a spot from the cell's center, or, when blotches already ring the cell (a clean spot
      // left in a blotched item), closes in from its edge, so the clean spot shrinks instead of leaving a ring.
      const c0 = cells[vals.indexOf(cut)]!;
      const hole = [-65, -64, -63, -1, 1, 63, 64, 65].filter((o) => value(c0 + o) < cut).length >= 6;
      const dist: number[] = [];
      for (let n = 0; n < xs.length; n++) {
        if (lows[n] !== cut) continue;
        let m = hole ? 0 : Infinity;
        for (const c of near[n]!) {
          if (vals[c] !== cut) continue;
          const [cx, cy] = cellCentre(cells[c]!);
          const h = Math.hypot(xs[n]! - cx, ys[n]! - cy);
          m = hole ? Math.max(m, h) : Math.min(m, h);
        }
        dist.push(m);
      }
      dist.sort((a, b) => a - b);
      if (rest > 0 && hole) {
        const r = dist[dist.length - rest]! - 0.01;
        partial = (c) => circle(c, R) + (r > 0 ? circle(c, r, true) : "");
      } else if (rest > 0) {
        const r = dist[rest - 1]! + 0.01;
        partial = (c) => circle(c, r);
      }
    }
  } else {
    // No region to measure (no canvas): that share of the square's cells.
    const sorted = [...values].sort((a, b) => a - b);
    const k = Math.round(sorted.length * share);
    if (k > 0) cut = sorted[k - 1]! + 1e-9;
  }
  // (Without a region, every cell over the square and two rings around it.)
  const drawn = xs.length ? cells : Array.from({ length: (N + 4) ** 2 }, (_, n) => cellId((n % (N + 4)) - 2, Math.floor(n / (N + 4)) - 2));
  const path = drawn.map((c) => (value(c) < cut ? circle(c, R) : value(c) === cut && partial ? partial(c) : "")).join("");
  blotchCache.set(key, path);
  return path;
}

/** The paint for one item: its fill (a gradient for the sheen colors), blotch color and the clip id. */
export interface Paint {
  id: string;
  fill: string;
  blotch: string;
  hex: string;
  defs: ComponentChildren;
  finish: Finish;
  /** Fills that go from the color to a bright tip (the crown's flames). */
  flameFill: string;
  /** The item's own box (where it's drawn), so the shine rolls across the item itself. */
  box: [number, number, number, number];
}

/** An item's paint, its shine rolling across `box` (where it's drawn, in the pawn's square's units). */
export function usePaint(finish: Finish, box: Box): Paint {
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
    box,
  };
}

/** Line widths scale with how closely the item is framed (--sw), so outlines stay crisp on a card and in a grid. */
export const lw = (n: number) => ({ style: `stroke-width: calc(var(--sw, 1) * ${n}px)` });
export const LINE = { stroke: "#1d1d1f", "stroke-linejoin": "round" as const, "stroke-linecap": "round" as const, ...lw(3) };

/**
 * A painted region: its paths filled with the item's color, the blemish blotches (clipped to the region), an
 * optional overlay (stripes), the shine when shiny, then the outline (`line` wide: thinner for small parts).
 */
export function Region({ p, d, name, fill, over, outline = true, line = 3 }: { p: Paint; d: string[]; name: string; fill?: string; over?: ComponentChildren; outline?: boolean; line?: number }) {
  const clip = `${p.id}-${name}`;
  const blotches = p.finish.blemish > 0 ? blotchPath(p.finish.seed + name.length * 7919, p.finish.blemish, d, p.box) : "";
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
          <path key={x} d={x} fill="none" {...LINE} {...lw(line)} />
        ))}
    </g>
  );
}

