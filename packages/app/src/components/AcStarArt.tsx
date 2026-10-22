import { useMemo } from "preact/hooks";
import type { Color, Kind } from "../autochess/types.ts";
import { PIECE_SHAPES, type PieceShape } from "../autochess/pieceShapes.ts";

/**
 * A starred piece's look (Auto chess v8; docs/decisions/2026-10-22-autochess-star-look.md): tiny solid stars inside its body, and its outline: a second copy of the piece's own shape drawn
 * round it, gold for a second star and a prismatic gradient for a third. One 45 x 45 box that sits exactly over the piece (the board's pieces are 45 x 45 drawings), so it is the same
 * on a board square, a bench tile and a shop card, and it scales with the piece.
 *
 * With the outline on, the piece itself is drawn here too, from the same shapes (the CSS picture of it is switched off by `.ac-drawn`, styles.css): a browser draws a CSS picture on a
 * box that isn't a whole number of pixels a little big and off its box (about half a pixel at the far edge), so an outline drawn round it from the shapes would show a gap on one side
 * and a dark fringe on the other. Drawn from the same shapes, the band is an exact 1.5 units all round. With the outline off, only the stars are drawn, over the CSS picture.
 */

/** The thickness of the colored band round the piece's black outline, in the art's units (the black outline is 1.5 thick; a square is 45). */
const BAND = 1.5;

/**
 * Where a piece's stars sit in its body: the middle of the group and the width of one star (a share of the 45 box: 5.4 is 12%). Found by looking for the widest plain part of each
 * piece's body, inside its outline (the rook's and knight's are big enough for 12%; the bishop's belly and the queen's are not, so those stars are a little smaller).
 */
const STAR_SPOT: Record<string, { x: number; y: number; w: number }> = {
  rw: { x: 22.5, y: 23.2, w: 5.4 },
  rb: { x: 22.5, y: 23.2, w: 5.4 },
  nw: { x: 27.5, y: 32.2, w: 5.4 },
  nb: { x: 27.5, y: 32.2, w: 5.4 },
  bw: { x: 22.5, y: 22.6, w: 3.4 },
  bb: { x: 22.5, y: 22.6, w: 3.4 },
  qw: { x: 22.5, y: 35.2, w: 3.8 },
  qb: { x: 22.5, y: 23.4, w: 3.4 },
};

/** A five-pointed star `w` wide, centered on (cx, cy), as polygon points. */
function starPoints(cx: number, cy: number, w: number): string {
  const R = w / 1.902;
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? R * 0.382 : R;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  const ys = pts.map((p) => p[1]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  return pts.map(([x, y]) => `${(cx + x).toFixed(2)},${(cy + y - mid).toFixed(2)}`).join(" ");
}

/** The centers of the stars of a piece: two side by side, or three with one above and two below. */
export function starCenters(n: number, piece: string): [number, number][] {
  const s = STAR_SPOT[piece] ?? STAR_SPOT.rw!;
  const half = s.w * 0.65;
  const rise = s.w * 0.445;
  return n >= 3
    ? [
        [s.x, s.y - rise],
        [s.x - half, s.y + rise],
        [s.x + half, s.y + rise],
      ]
    : [
        [s.x - half, s.y],
        [s.x + half, s.y],
      ];
}

/** The width of one star of a piece, in 45ths of the piece. */
export const starWidth = (piece: string) => (STAR_SPOT[piece] ?? STAR_SPOT.rw!).w;

const GOLD: [number, string][] = [
  [0, "#ffd84d"],
  [0.5, "#f0a500"],
  [1, "#ffd84d"],
];
/** The prismatic stops (Eric's own mock: teal and cyan most of it, then blue to violet to magenta, then coral and orange; no yellow or plain green). */
const PRISM: [number, string][] = [
  [0, "#22bfa9"],
  [0.16, "#1fb6cf"],
  [0.3, "#2fa3e6"],
  [0.44, "#5b84f0"],
  [0.56, "#8d68e6"],
  [0.67, "#d25ccb"],
  [0.78, "#ff6f73"],
  [0.88, "#ff9a5c"],
  [1, "#ff6f73"],
];

let seq = 0;

function Draw({ s, fill, stroke, sw, cap, join }: { s: PieceShape; fill: string; stroke: string; sw: number; cap: string; join: string }) {
  const p = { fill, stroke, "stroke-width": sw, "stroke-linecap": cap, "stroke-linejoin": join, "fill-rule": s.eo ? "evenodd" : undefined, transform: s.tf } as Record<string, unknown>;
  return s.d !== undefined ? <path d={s.d} {...p} /> : <circle cx={s.cx} cy={s.cy} r={s.r} {...p} />;
}

const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * `n` stars (2 or 3) on a `kind` of `color`. `outline`: draw the outline (and the piece itself under the stars); else only the stars. `shift`: a prismatic outline's colors slowly move
 * (the shop card's; never under reduced motion; the pieces on the board and the benches stay still, so many of them cost nothing).
 */
export function StarArt({ color, kind, n, outline, shift = false }: { color: Color; kind: Kind | "k"; n: number; outline: boolean; shift?: boolean }) {
  const id = useMemo(() => `acs${++seq}`, []);
  const piece = `${kind}${color}`;
  const shapes = PIECE_SHAPES[piece];
  if (n < 2 || !shapes) return null;
  const g = `${id}g`;
  const stops = n >= 3 ? PRISM : GOLD;
  const ink = color === "w" ? "#000" : "#fff";
  const edge = color === "w" ? "#fff" : "#000";
  const url = `url(#${g})`;
  return (
    <svg class="ac-art" viewBox="0 0 45 45" data-stars={n} data-outline={outline ? "1" : "0"} aria-hidden="true" focusable="false">
      {outline && (
        <>
          <defs>
            <linearGradient id={g} gradientUnits="userSpaceOnUse" x1="6" y1="8" x2="39" y2="38" spreadMethod="reflect">
              {stops.map(([at, c]) => (
                <stop key={at} offset={at} stop-color={c} />
              ))}
              {n >= 3 && shift && !reducedMotion() && <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="66 60" dur="9s" repeatCount="indefinite" />}
            </linearGradient>
          </defs>
          {/* The outline: the piece's own shapes again, filled and stroked wider in the gradient, behind the piece. */}
          <g class="ac-art-ring">
            {shapes.map((s, i) => (
              <Draw key={i} s={s} fill={s.fill === "none" ? "none" : url} stroke={s.stroke === "none" ? "none" : url} sw={s.sw + 2 * BAND} cap="round" join="round" />
            ))}
          </g>
          <g class="ac-art-piece">
            {shapes.map((s, i) => (
              <Draw key={i} s={s} fill={s.fill} stroke={s.stroke} sw={s.sw} cap={s.cap} join={s.join} />
            ))}
          </g>
        </>
      )}
      {starCenters(n, piece).map(([x, y], i) => (
        <polygon key={i} class="ac-star" points={starPoints(x, y, starWidth(piece))} fill={ink} stroke={edge} stroke-width="0.5" stroke-linejoin="round" paint-order="stroke" />
      ))}
    </svg>
  );
}
