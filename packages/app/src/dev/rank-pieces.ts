/**
 * MOCKUP ONLY (rank-pieces-mockup, Nov 28): rank-colored piece sets for the shop. Data and CSS for the stills; nothing in the game
 * reads this file.
 *
 * Every style is the board's own cburnett piece (board/pieces/cburnett), the same shapes, restyled in its SVG text:
 *   A        the whole piece a gradient: the white fill becomes white -> the rank's light color, the black fill black -> the rank's
 *            deep color (lighter at the top, as if lit from above). The outline and the details stay as they are.
 *   B        the default piece untouched, with a rim round its outline: the same shapes drawn once more underneath with a wider
 *            stroke in the rank's gradient.
 *   B-solid  the same rim in one flat color.
 */
import kl from "../board/pieces/cburnett/Chess_klt45.svg?raw";
import kd from "../board/pieces/cburnett/Chess_kdt45.svg?raw";
import ql from "../board/pieces/cburnett/Chess_qlt45.svg?raw";
import qd from "../board/pieces/cburnett/Chess_qdt45.svg?raw";
import rl from "../board/pieces/cburnett/Chess_rlt45.svg?raw";
import rd from "../board/pieces/cburnett/Chess_rdt45.svg?raw";
import bl from "../board/pieces/cburnett/Chess_blt45.svg?raw";
import bd from "../board/pieces/cburnett/Chess_bdt45.svg?raw";
import nl from "../board/pieces/cburnett/Chess_nlt45.svg?raw";
import nd from "../board/pieces/cburnett/Chess_ndt45.svg?raw";
import pl from "../board/pieces/cburnett/Chess_plt45.svg?raw";
import pd from "../board/pieces/cburnett/Chess_pdt45.svg?raw";

export const ROLES = ["king", "queen", "rook", "bishop", "knight", "pawn"] as const;
export type Role = (typeof ROLES)[number];
export type Side = "white" | "black";
const SRC: Record<Side, Record<Role, string>> = {
  white: { king: kl, queen: ql, rook: rl, bishop: bl, knight: nl, pawn: pl },
  black: { king: kd, queen: qd, rook: rd, bishop: bd, knight: nd, pawn: pd },
};

export type Stops = readonly (readonly [number, string])[];
export type StyleId = "a" | "b" | "solid";
export const STYLES: readonly { id: StyleId; name: string; note: string }[] = [
  { id: "a", name: "A: whole piece a gradient", note: "white → the rank's color, black → the rank's color" },
  { id: "b", name: "B: gradient border", note: "the default piece, a rim in the rank's gradient" },
  { id: "solid", name: "B-solid: one-color border", note: "the same rim, one flat color" },
];

export interface RankSet {
  id: "gold" | "sublime" | "pearlescent";
  name: string;
  emblem: string;
  /** A: the white pieces' fill and the black pieces' fill, top to bottom. */
  white: Stops;
  black: Stops;
  /** B: the rim's gradient (top left to bottom right) and B-solid's one color. */
  rim: Stops;
  solid: string;
}

/** The colors are the rank emblems' (characters/rank-set.ts: GOLD, SUBLIME, PEARL and its sheen, softened). */
export const RANKS: readonly RankSet[] = [
  {
    id: "gold", name: "Gold", emblem: "gold-d5",
    white: [[0, "#ffffff"], [0.42, "#fff6c0"], [1, "#ffd94a"]],
    black: [[0, "#b87a12"], [0.4, "#5e3406"], [1, "#160b02"]],
    rim: [[0, "#fff3a6"], [0.3, "#f6c93a"], [0.62, "#dc9a1c"], [0.82, "#a8680e"], [1, "#f6c93a"]],
    solid: "#f6c93a",
  },
  {
    id: "sublime", name: "Sublime", emblem: "sublime-d5",
    white: [[0, "#ffffff"], [0.42, "#f4e8ff"], [1, "#cfa8ff"]],
    black: [[0, "#8447d4"], [0.4, "#3f1880"], [1, "#0f051f"]],
    rim: [[0, "#f0dcff"], [0.3, "#ad78f0"], [0.62, "#6a2fc0"], [0.84, "#f6c93a"], [1, "#fff3a6"]],
    solid: "#8447d4",
  },
  {
    id: "pearlescent", name: "Pearlescent", emblem: "pearlescent",
    white: [[0, "#ffffff"], [0.35, "#fdeaf3"], [0.68, "#e6dcf6"], [1, "#cfe6f4"]],
    // (The black fill's top stops short of full pearl, and the rim's pastels are deepened: at full pearl the black pieces' tops were as
    // light as the white pieces' feet, and the rim vanished on a light square.)
    black: [[0, "#b9aed2"], [0.28, "#857bae"], [0.62, "#3a3158"], [1, "#0d0a17"]],
    rim: [[0, "#ffffff"], [0.18, "#ff9fcb"], [0.4, "#b396f0"], [0.6, "#7db9f2"], [0.8, "#7fe0c0"], [1, "#ffd78a"]],
    solid: "#d8d1e4",
  },
];
export const rankOf = (id: string): RankSet => RANKS.find((r) => r.id === id) ?? RANKS[0]!;

/** The rim's width, in the piece's own units (a piece is 45 wide: 2.2 is 2.2 px on a phone's 46 px square, 3.9 px on a computer's 80). */
export const RIM = 2.2;

const stops = (s: Stops) => s.map(([at, c]) => `<stop offset="${at}" stop-color="${c}"/>`).join("");
const grad = (id: string, s: Stops, x1: number, y1: number, x2: number, y2: number) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(s)}</linearGradient>`;
const split = (svg: string) => {
  const open = /<svg[^>]*>/.exec(svg)!;
  const body = svg.slice(open.index + open[0].length, svg.lastIndexOf("</svg>"));
  return { open: open[0], body };
};

/** One piece's SVG text in a style. */
export function pieceSvg(rank: RankSet, style: StyleId, side: Side, role: Role): string {
  const { open, body } = split(SRC[side][role]);
  if (style === "a") {
    // (The body's own fill becomes the gradient: #fff / #ffffff on a white piece, #000000 on a black one. A white knight's black eye
    // and nostril, every outline and the black pieces' light details stay.)
    const filled = side === "white" ? body.replace(/fill:\s*#ffffff/g, "fill:url(#a)").replace(/fill="#fff"/g, 'fill="url(#a)"') : body.replace(/fill:\s*#000000/g, "fill:url(#a)");
    return `${open}<defs>${grad("a", side === "white" ? rank.white : rank.black, 17, 5, 28, 41)}</defs>${filled}</svg>`;
  }
  const paint = style === "b" ? "url(#r)" : rank.solid;
  const css = `.rim *{stroke:${paint}!important;stroke-width:${1.5 + 2 * RIM}px!important;stroke-linejoin:round!important;stroke-linecap:round!important}`;
  return `${open}<defs>${style === "b" ? grad("r", rank.rim, 6, 5, 39, 41) : ""}<style>${css}</style></defs><g class="rim">${body}</g>${body}</svg>`;
}

export const dataUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/<\?xml[^>]*\?>|<!DOCTYPE[^>]*>/g, "").replace(/\s+/g, " "))}")`;

/** The class a board (or anything drawn with pieces) wears for a set: `.rp-<rank>-<style>` (every piece) or `.rp-<rank>-<style>-kq` (the king and queen only). */
export const setClass = (rank: string, style: StyleId, kq = false) => `rp-${rank}-${style}${kq ? "-kq" : ""}`;

/** Every set's rules: the pieces' pictures, over the board's own (pieces.css). */
export function piecesCss(): string {
  const out: string[] = [];
  for (const rank of RANKS)
    for (const { id } of STYLES)
      for (const side of ["white", "black"] as const)
        for (const role of ROLES) {
          const url = dataUrl(pieceSvg(rank, id, side, role));
          const who = `piece.${role}.${side}`;
          // (The class on something round the board, or on the pieces' own layer.)
          const classes = [setClass(rank.id, id), ...(role === "king" || role === "queen" ? [setClass(rank.id, id, true)] : [])];
          const sel = classes.flatMap((c) => [`.${c} :is(.hb, .hb-pieces) ${who}`, `.${c}.hb-pieces ${who}`]);
          out.push(`${sel.join(", ")} { background-image: ${url}; }`);
        }
  return out.join("\n");
}
