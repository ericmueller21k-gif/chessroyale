import type { ComponentChildren } from "preact";
import type { RiderDraft, RiderProps, RiderViewDraft, TrailProps } from "./kit.ts";

/**
 * The HunChess colorway (Eric, Nov 6: the Welcome Crate's "special HunChess-colored random rider"; docs/decisions/2026-11-06-welcome-crate.md):
 * every ride's own drawing, remapped to the HunChess palette (deep black, the logo's gold, cream highlights) with a thin gold trim
 * round it, as an SVG filter on its layers (never on the pawn riding it). One remap for every ride, so a new ride has its colorway
 * with no drawing: its light (luminance) picks the palette's color, darkest to lightest: black, soft black, gold, light gold, cream.
 *
 * Where the remap alone fails, a ride's own levels lift it (`HUNCHESS_LEVELS`): a mostly dark ride (Hollow's Bulb, the Rodeo Bull,
 * the Log Roller) would come out all black, its shapes lost, so its light is stretched up into the golds; the gold trim keeps
 * every ride's outline on a dark page.
 */

/** The palette, darkest to lightest (sRGB, 0 to 1): the stops of the remap, evenly spread over the ride's light. */
export const HUNCHESS_PALETTE = {
  black: "#0b0906",
  softBlack: "#2a2216",
  gold: "#c99a22",
  lightGold: "#f2cd5c",
  cream: "#fff4d6",
  trim: "#e0b440",
} as const;
const STOPS = [HUNCHESS_PALETTE.black, HUNCHESS_PALETTE.softBlack, HUNCHESS_PALETTE.gold, HUNCHESS_PALETTE.lightGold, HUNCHESS_PALETTE.cream];
const channel = (hex: string, i: number) => (parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255).toFixed(3);
const table = (i: number) => STOPS.map((s) => channel(s, i)).join(" ");

/**
 * A ride's levels before the remap: its light times `gain` plus `lift` (0 to 1). The default (1, 0) is the plain remap. Set by hand
 * from the sheet of every ride (docs/welcome-crate/hunchess-rides.png), for each whose remap read badly.
 */
export const HUNCHESS_LEVELS: Readonly<Record<string, { gain: number; lift: number }>> = {
  // Dark glass and a dark cord: lifted so the bulb reads gold, its glow cream.
  "hollow-bulb": { gain: 1.25, lift: 0.18 },
  // A dark brown bull: lifted, or it's a black shape.
  "rodeo-bull": { gain: 1.2, lift: 0.16 },
  // Dark bark: lifted into the golds.
  "log-roller": { gain: 1.2, lift: 0.14 },
  // The night-blue moon: lifted to gold.
  "moon-ride": { gain: 1.15, lift: 0.12 },
  // Dark iron and tires.
  "sawyer-dozer": { gain: 1.1, lift: 0.08 },
  "bigboy-buggy": { gain: 1.1, lift: 0.06 },
};

/** A ride's filter's id (one a ride: its levels are its own). */
export const hunchessFilterId = (base: string) => `hc-remap-${base}`;

/** The filter: the remap (levels, then the palette) and the gold trim under it. */
export function HunchessFilter({ base }: { base: string }) {
  const { gain, lift } = HUNCHESS_LEVELS[base] ?? { gain: 1, lift: 0 };
  const row = `${(0.3 * gain).toFixed(3)} ${(0.59 * gain).toFixed(3)} ${(0.11 * gain).toFixed(3)} 0 ${lift}`;
  return (
    <filter id={hunchessFilterId(base)} x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values={`${row} ${row} ${row} 0 0 0 1 0`} result="gray" />
      <feComponentTransfer in="gray" result="mapped">
        <feFuncR type="table" tableValues={table(0)} />
        <feFuncG type="table" tableValues={table(1)} />
        <feFuncB type="table" tableValues={table(2)} />
      </feComponentTransfer>
      <feMorphology in="SourceAlpha" operator="dilate" radius="0.9" result="grown" />
      <feFlood flood-color={HUNCHESS_PALETTE.trim} result="gold" />
      <feComposite in="gold" in2="grown" operator="in" result="trim" />
      <feMerge>
        <feMergeNode in="trim" />
        <feMergeNode in="mapped" />
      </feMerge>
    </filter>
  );
}

/** Some of a ride's drawing, in the colorway. */
const remapped = (base: string, inner: ComponentChildren) => (
  <g class="hunchess" filter={`url(#${hunchessFilterId(base)})`}>
    <defs>
      <HunchessFilter base={base} />
    </defs>
    {inner}
  </g>
);

const viewIn = (base: string, v: RiderViewDraft): RiderViewDraft => ({
  ...v,
  Back: (p: RiderProps) => remapped(base, v.Back(p)),
  Front: (p: RiderProps) => remapped(base, v.Front(p)),
});

/**
 * A ride's drawing in the colorway: the same drawing (its boxes, poses, frames and trail), every layer remapped. `base` is the ride's
 * own id ("balloon-pup"); the drawing's id becomes the colorway's ("balloon-pup-hunchess").
 */
export function hunchessDraft(d: RiderDraft, base: string): RiderDraft {
  return {
    ...d,
    ...viewIn(base, d),
    id: `${d.id}-hunchess`,
    ...(d.views ? { views: { ...(d.views.front ? { front: viewIn(base, d.views.front) } : {}), ...(d.views.back ? { back: viewIn(base, d.views.back) } : {}) } } : {}),
    ...(d.trail ? { trail: { ...d.trail, Mark: (p: TrailProps) => remapped(base, d.trail!.Mark(p)) } } : {}),
  };
}
