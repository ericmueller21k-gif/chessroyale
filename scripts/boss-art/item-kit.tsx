/**
 * The kit an API-drawn crate item imports (scripts/boss-art, item and rider modes): the game's own item machinery from
 * packages/app/src/components/Items.tsx, copied word for word where Items.tsx doesn't export it (usePaint, Region, LINE,
 * lw, darken, lighten, mirror, PAWN_PATH), so a drawing moves into Items.tsx by deleting its import line. Nothing here
 * is in the game.
 *
 * Motion: the game's items are still today (only the shine rolls, by CSS). A drawing's motion is frames: its art gets
 * `f`, the frame number, and `motion.ms` gives each frame's length. What the game would need to show them is in
 * scripts/boss-art/README.md ("Item motion").
 */
import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";
import { isShiny, itemColor, type ItemSlot, type ItemTier } from "@chessroyale/core";
import { blotchPath } from "../../packages/app/src/components/Items.tsx";

export interface Finish {
  color: string;
  color2?: string | null;
  blemish: number;
  seed: number;
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

let uid = 0;
const useUid = () => {
  const r = useRef<string>("");
  if (!r.current) r.current = `ba${++uid}`;
  return r.current;
};

/** A color mixed toward black (amount 0-1). */
export function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - amount));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
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

export function usePaint(finish: Finish, box: [number, number, number, number]): Paint {
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

/** A path mirrored across the pawn's middle (x 50). */
export const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${100 - Number(x)} ${y}`);

/** The cburnett pawn (Colin M.L. Burnett, BSD), on its 45 × 45 grid: draw it in `<g transform="scale(2.2222)">`. */
export const PAWN_PATH =
  "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z";
/** The pawn itself, white or black, on the 100 × 100 square (as the chimney and the coats draw it). */
export function Pawn({ side }: { side: "w" | "b" }) {
  return (
    <g transform="scale(2.2222)">
      <path d={PAWN_PATH} fill={side === "w" ? "#fff" : "#000"} stroke="#000" stroke-width="1.5" stroke-linecap="round" />
    </g>
  );
}

/** What a drawing's art is given: its paint (and a second paint), the pawn's side and the frame to draw. */
export interface ArtProps {
  p: Paint;
  p2: Paint;
  side: "w" | "b";
  /** The frame number of the motion (0 to motion.ms.length - 1). */
  f: number;
}

/** A crate item drawn by the API: what ITEM_DEFS, ITEM_ART, FRAMES, SHINE_BOX and ATTACH would get. */
export interface ItemDraft {
  id: string;
  name: string;
  tier: ItemTier;
  slot: ItemSlot;
  description: string;
  layer?: "front" | "back";
  colors?: 2;
  /** Its box on the pawn's square: x, y, w, h (FRAMES). */
  frame: [number, number, number, number];
  /** The shine's box in the art's own coordinates, if the art is drawn tilted (SHINE_BOX); else `frame`. */
  shineBox?: [number, number, number, number];
  /** Head and face items: the line in the drawing that meets the slot's anchor (ATTACH; a hat's brim = 25). */
  attach?: number;
  /** Its motion: each frame's length in ms (one entry: still). It loops. */
  motion: { ms: number[] };
  Art: (props: ArtProps) => ComponentChildren;
}

/** One animation of a rider: each frame's length in ms. */
export interface RiderAnim {
  ms: number[];
}
/**
 * Where everything is on a frame: the whole group (rider and pawn) moved by `dx`, `dy` (in the pawn's units: its box is
 * 100, which the town draws about 1.45 town squares across, so one square is about 69 units; a move is drawn from dx 0 to
 * 100 and the town fits it to one square); the pawn moved by `pawnX`, `pawnY` on its rider (riding up a
 * little: negative y is up), tilted `pawnTilt` degrees round its base, and hidden below `cut` (in the pawn's own
 * square, before it's moved: the bench-sit look hides about its lowest third, cut ≈ 66).
 */
export interface RiderPose {
  dx: number;
  dy: number;
  pawnX: number;
  pawnY: number;
  pawnTilt?: number;
  cut: number;
}
/**
 * Which way the ride is seen. side: going left or right (drawn facing our right; the town mirrors it for left). back:
 * going up the screen, seen from behind. front: coming down the screen, seen from the front.
 */
export type RiderFacing = "side" | "front" | "back";
export interface RiderProps extends ArtProps {
  anim: "idle" | "move";
  /** The view being drawn (side for the RiderDraft's own Back and Front), for code shared between views. */
  view?: RiderFacing;
}
/**
 * One view of a ride: its own idle and move, a pose per frame, and its two drawings, Back (behind the pawn) and Front
 * (in front of it). The side view is the RiderDraft's own fields.
 */
export interface RiderViewDraft {
  /** Its box on the pawn's square with its pawn on it, at rest: x, y, w, h (front and back: default the side's). */
  frame?: [number, number, number, number];
  idle: RiderAnim;
  /**
   * The side view: one square of the town's movement, drawn as dx 0 to 100 (the town fits it to one square). The front and back views: one square's walk toward or
   * away from the camera, played in place on its square (the town slides it up or down the screen): dx stays about 0,
   * dy is only a bob or a hop.
   */
  move: RiderAnim;
  pose: (anim: "idle" | "move", f: number) => RiderPose;
  Back: (props: RiderProps) => ComponentChildren;
  Front: (props: RiderProps) => ComponentChildren;
}
/** A ride (a new slot, "rider"): its side view, and optionally its front and back views (`views`). */
export interface RiderDraft extends RiderViewDraft {
  id: string;
  name: string;
  tier: ItemTier;
  description: string;
  colors?: 2;
  /** Its box on the pawn's square with its pawn on it, at rest: x, y, w, h (for the tile). */
  frame: [number, number, number, number];
  /** The views from behind (walking up the screen) and from the front (walking down). */
  views?: { front?: RiderViewDraft; back?: RiderViewDraft };
}
