import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";
import { isShiny, itemColor } from "@chessroyale/core";
import { blotchPath, type Box } from "./blotches.ts";

export type { Box } from "./blotches.ts";

/**
 * The paint every drawn crate item uses (moved out of Items.tsx on Oct 31, word for word, so the rides' drawings in
 * `rides/` can use it too): an item's color (a gradient for the sheen colors), the shine at 90%+ purity, the outlines
 * (`LINE`, `lw`) and `Region`, a painted part, which lays the blemish's blotches on (blotches.ts). Items.tsx (the items, the
 * avatar) and the rides import it; nothing here knows any item. The rides' baked sheets for the town are drawn with this
 * file, so a change here asks for `npx tsx scripts/bake-rides.ts` (a test says so); the blotches don't (the sheets have none).
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

