/**
 * The park in front of the Colosseum (town square, slice 6; world.ts PARK): its trees, benches, the stone fountain in its
 * middle and its ten chess tables, drawn in code in the homes' pixel style (characters/sprite.ts parts, houses/kit.ts),
 * lit from the top left and outlined, at the homes' scale (37 pixels a square). Each picture's foot is the middle of the
 * square it stands on (the fountain's: the middle of its front edge).
 *
 * - A tree: a round leafy park tree on a short trunk (three of them, a little different).
 * - A bench: wooden slats on iron legs, its back to the north, facing you as you come up the park.
 * - The fountain: a city fountain of grey stone (its own design: Puddles' garden has a tiered one of its own): a wide
 *   round basin with a carved rim, a pedestal in its middle carrying a broad shallow bowl, a stone chess pawn on top
 *   spouting a jet; the water spills from the bowl into the basin. `idle`: the jet, the falling water and the ripples move.
 * - A chess table: a square stone table on one leg with a chessboard set into its top (a game under way on it) and a
 *   round stone stool either side of it, the table's square in the middle of the picture's three.
 * - A lamp (Oct 27): a classic park lamp post, dark iron on a stepped foot, a collar halfway up, a lantern on top (four
 *   panes of glass under a pointed cap), about a pawn and a half tall. Its glass is pale by day; at dusk and night it's lit
 *   (`PARK_LAMP_LIGHTS`, `PARK_LAMP_POOLS`: render.ts draws the glow, its halo and its pool after the world's tint).
 */
import type { Anim, Character, Frame, Part } from "../../characters/sprite.ts";
import { TOWN_FEEL } from "../feel.ts";
import { LANTERN_LIGHT, grain, groundShadow, paint, type LightPool, type LightSpot, type Pt } from "./kit.ts";

const PALETTE: Record<string, string> = {
  k: "#2a1c14", // outline
  // Stone (the fountain, the tables, the stools): lightest to darkest, a warm grey.
  "1": "#f2eee6",
  "2": "#dcd5c8",
  "3": "#bfb6a6",
  "4": "#9a9081",
  "5": "#73695c",
  // Water: pale to deep.
  a: "#e8f8ff",
  b: "#a9dcf2",
  c: "#6bb6dc",
  d: "#3f86b8",
  e: "#2c5f8e",
  // Leaves: light to dark (three greens), and a blossom pink.
  G: "#9fd36a",
  g: "#6db34a",
  h: "#4a8a36",
  j: "#2f6128",
  p: "#f4b6c8",
  // Bark and wood: light to dark.
  W: "#b98454",
  w: "#8a5a32",
  V: "#5e3b1e",
  // Iron: lit, mid, dark.
  J: "#6c707b",
  I: "#4a4d55",
  i: "#2c2e33",
  // A lamp's glass, unlit: pale where the day lights it, darker in its shade (at dusk and night render.ts lights it).
  y: "#c4ccd0",
  Y: "#8d979e",
  // The board's squares, and its pieces.
  L: "#f4dcae",
  D: "#8e6440",
  P: "#fbfbf6",
  Q: "#262321",
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};

const PX = TOWN_FEEL.housePxPerSquare;
const one = (id: string, name: string, w: number, h: number, foot: Pt, layers: { part: Part; at: Pt }[], extra?: Frame[]): Character => {
  const parts: Record<string, Part> = {};
  layers.forEach((l, i) => (parts[`p${i}`] = l.part));
  const frame: Frame = { ms: 1000, layers: layers.map((l, i) => ({ part: `p${i}`, x: l.at[0], y: l.at[1] })) };
  const idle: Anim = { loop: true, frames: extra ?? [frame] };
  return { id, name, w, h, foot, palette: PALETTE, parts, anims: { idle } };
};

// ---- A tree: a short trunk, a round crown of leaf clumps lit from the top left.

/** A crown: clumps (x, y, radius) over each other, each lit on its top left, its leaves speckled. */
function crown(cx: number, cy: number, clumps: readonly (readonly [number, number, number])[], seed: number, bloom: boolean) {
  const x0 = Math.floor(cx - 40);
  const y0 = Math.floor(cy - 40);
  return paint(x0, y0, 80, 80, (x, y) => {
    let hit = -1;
    for (let i = clumps.length - 1; i >= 0; i--) {
      const [ox, oy, r] = clumps[i]!;
      if (Math.hypot(x + 0.5 - cx - ox, y + 0.5 - cy - oy) < r) {
        hit = i;
        break;
      }
    }
    if (hit < 0) return null;
    const [ox, oy, r] = clumps[hit]!;
    const dx = (x + 0.5 - cx - ox) / r;
    const dy = (y + 0.5 - cy - oy) / r;
    const l = -0.55 * dx - 0.75 * dy + (grain(x, y, seed) - 0.5) * 0.5;
    if (bloom && grain(x, y, seed + 9) > 0.93 && l > -0.2) return "p";
    return l > 0.45 ? "G" : l > -0.05 ? "g" : l > -0.5 ? "h" : "j";
  });
}
const trunk = (cx: number, foot: number, top: number) =>
  paint(cx - 3, top, 7, foot - top, (x, y) => {
    const X = x - (cx - 3);
    if (y > foot - 3 && (X === 0 || X === 6)) return "w"; // its roots' flare
    if (X === 0 || X === 6) return null;
    return X <= 2 ? "W" : X >= 5 ? "V" : grain(x, y, 3) > 0.8 ? "V" : "w";
  });
const TREE_W = 84;
const TREE_H = 112;
const TREE_FOOT = TREE_H - 6;
const TREES = [
  { clumps: [[-14, 6, 18], [14, 6, 18], [0, -10, 22], [-6, 12, 16], [8, 14, 15]], top: 46, bloom: false },
  { clumps: [[-16, 10, 16], [15, 9, 17], [0, -6, 21], [-8, -18, 14], [9, -16, 14], [0, 14, 16]], top: 40, bloom: false },
  { clumps: [[-13, 8, 17], [13, 8, 17], [0, -8, 20], [0, 12, 15]], top: 50, bloom: true },
] as const;
export const PARK_TREES: Character[] = TREES.map((t, v) => {
  const cx = TREE_W / 2;
  const cy = t.top;
  return one(`park-tree-${v}`, "A tree", TREE_W, TREE_H, [cx, TREE_FOOT], [groundShadow(cx + 2, TREE_FOOT, 24, 7), trunk(cx, TREE_FOOT, cy + 6), crown(cx, cy, t.clumps, 31 + v, t.bloom)]);
});

// ---- A bench, facing south (you): its back's slats over the seat's, on iron legs with curled arms.

const BENCH_W = 44;
const BENCH_H = 36;
const BENCH_FOOT = BENCH_H - 4;
export const PARK_BENCH: Character = (() => {
  const cx = BENCH_W / 2;
  const f = BENCH_FOOT;
  const back = paint(cx - 17, f - 28, 34, 11, (x, y) => {
    const j = y - (f - 28);
    if (j === 3 || j === 7) return null; // the gaps between its slats
    return j % 4 === 0 ? "W" : x < cx + 10 ? "w" : "V";
  });
  const seat = paint(cx - 18, f - 15, 36, 5, (x, y) => {
    const j = y - (f - 15);
    return j === 0 ? "W" : j === 2 ? null : j === 4 ? "V" : "w";
  });
  const leg = (lx: number) =>
    paint(lx, f - 28, 3, 28, (x, y) => {
      const j = f - y;
      if (j > 15 && j < 27) return x === lx + 1 ? "i" : null; // its back's upright
      return x === lx ? "I" : "i";
    });
  const arm = (lx: number, dir: number) => paint(lx, f - 20, 6, 3, (x, y) => (y === f - 20 ? (dir * (x - lx - 2.5) < 2 ? "I" : null) : "i"));
  return one("park-bench", "A bench", BENCH_W, BENCH_H, [cx, f], [groundShadow(cx, f - 1, 20, 4), leg(cx - 16), leg(cx + 13), back, seat, arm(cx - 19, -1), arm(cx + 13, 1)]);
})();

// ---- The fountain: a wide round basin, a pedestal and a broad bowl, a stone pawn on top spouting a jet.

const FW = 82;
const FH = 108;
const FFOOT = FH - 6;
const FCX = FW / 2;
/** The basin: half its width, half its depth as drawn, its wall's height, its rim's thickness. */
const BRX = 37;
const BRY = 13;
const BWALL = 12;
const BRIM = 4;
const BCY = FFOOT - BRY; // the middle of its foot's oval
const TCY = BCY - BWALL; // the middle of its rim's oval
/** The bowl on the pedestal: its middle, half its width and depth, and its lip's thickness. */
const BOWL_CY = TCY - 34;
const BOWL_RX = 19;
const BOWL_RY = 7;
const PAWN_FOOT = BOWL_CY - 1;
/** The basin's wall (in front) and its rim, lit on the left; the water inside, a frame's ripples at phase `ph`. */
const basinBack = paint(FCX - BRX, TCY - BRY, 2 * BRX, 2 * BRY + 1, (x, y) => {
  const X = x + 0.5 - FCX;
  const Y = y + 0.5 - TCY;
  const o = (X / BRX) ** 2 + (Y / BRY) ** 2;
  if (o > 1) return null;
  const inner = (X / (BRX - BRIM)) ** 2 + (Y / (BRY - BRIM * 0.4)) ** 2;
  if (inner > 1) return X < -BRX * 0.4 ? "1" : X > BRX * 0.5 ? "3" : grain(x, y, 5) > 0.85 ? "3" : "2"; // the rim's top
  return null; // (the water is its own part)
});
const water = (ph: number) =>
  paint(FCX - BRX + BRIM, TCY - BRY + 2, 2 * (BRX - BRIM), 2 * BRY - 3, (x, y) => {
    const X = x + 0.5 - FCX;
    const Y = y + 0.5 - TCY;
    const inner = (X / (BRX - BRIM)) ** 2 + (Y / (BRY - BRIM * 0.4)) ** 2;
    if (inner > 1) return null;
    // Rings spreading out from where the falling water lands, and the bowl's reflection.
    const d = Math.hypot(X / 2.6, Y);
    const ring = Math.sin(d * 1.4 - ph * 1.6);
    if (inner > 0.82) return Y < 0 ? "d" : "c"; // the water's edge, in the rim's shadow at the back
    if (ring > 0.86) return "a";
    if (ring > 0.4) return "b";
    return Y < -2 ? "d" : "c";
  }, false);
const basinFront = paint(FCX - BRX, TCY, 2 * BRX, BWALL + BRY + 1, (x, y) => {
  const X = x + 0.5 - FCX;
  const Y = y + 0.5;
  const s = X / BRX;
  if (Math.abs(s) >= 1) return null;
  const c = Math.sqrt(1 - s * s);
  const top = TCY + BRY * c;
  const bot = BCY + BRY * c;
  if (Y < top || Y >= bot) return null;
  const h = bot - Y;
  const lit = 0.55 - 0.45 * s;
  if (h > BWALL - 2) return lit > 0.5 ? "1" : "2"; // the rim's lip
  if (h < 2) return lit > 0.5 ? "4" : "5"; // its foot
  // Carved panels round it.
  const a = Math.asin(s) * 4;
  if (Math.abs(a - Math.round(a)) < 0.06 * (2 - c)) return lit > 0.45 ? "3" : "4";
  return lit > 0.75 ? "2" : lit > 0.4 ? "3" : "4";
});
const pedestal = paint(FCX - 5, BOWL_CY, 11, TCY + 2 - BOWL_CY, (x, y) => {
  const X = x + 0.5 - FCX;
  const j = TCY + 2 - y;
  const w = j < 4 ? 5.5 : j > TCY + 2 - BOWL_CY - 4 ? 4 : 3;
  if (Math.abs(X) > w) return null;
  return X < -1 ? "2" : X > 1.5 ? "4" : "3";
});
const bowl = paint(FCX - BOWL_RX, BOWL_CY - BOWL_RY, 2 * BOWL_RX, 2 * BOWL_RY + 6, (x, y) => {
  const X = x + 0.5 - FCX;
  const Y = y + 0.5 - BOWL_CY;
  const s = X / BOWL_RX;
  if (Math.abs(s) >= 1) return null;
  const c = Math.sqrt(1 - s * s);
  if (Y < -BOWL_RY * c) return null;
  if (Y <= BOWL_RY * c) {
    const inner = (X / (BOWL_RX - 2.5)) ** 2 + (Y / (BOWL_RY - 1.5)) ** 2;
    if (inner < 1) return Y < -1 ? "c" : "b"; // the water in it
    return X < 0 ? "1" : "2"; // its lip
  }
  // Its underside, curving in to the pedestal.
  if (Y > BOWL_RY * c + 5 * c) return null;
  return X < -BOWL_RX * 0.3 ? "3" : "4";
});
/** A stone pawn on top (the chess town's fountain), lit on the left. */
const finial = paint(FCX - 6, PAWN_FOOT - 19, 12, 19, (x, y) => {
  const X = (x + 0.5 - FCX) / 1.25;
  const j = (PAWN_FOOT - (y + 0.5)) / 1.25;
  const w = j < 2 ? 4.5 : j < 8 ? 3.4 - (j - 2) * 0.25 : j < 9 ? 3.5 : j < 9.5 ? 1.6 : Math.sqrt(Math.max(0, 7.3 - (j - 12) ** 2));
  if (Math.abs(X) > w) return null;
  return X < -w * 0.3 ? "1" : X > w * 0.45 ? "4" : "2";
});
/** The water: a jet from the pawn's top, and the sheet spilling from the bowl's lip, at phase `ph` (0 to 3). */
const jet = (ph: number) =>
  paint(FCX - 10, PAWN_FOOT - 34, 20, 16, (x, y) => {
    const X = x + 0.5 - FCX;
    const j = PAWN_FOOT - 18 - (y + 0.5); // up from the pawn's head
    // A thin rising jet, its top spraying out either way in an arc; drops along the arcs move with the frame.
    if (Math.abs(X) < 0.9 && j >= 0 && j < 12) return j > 9 ? "a" : "b";
    const arc = 12 - (X * X) / 7;
    if (Math.abs(X) > 1 && Math.abs(X) < 9.5 && Math.abs(j - arc) < 0.9) return (Math.floor(Math.abs(X) + ph) % 3 === 0 ? "a" : "b");
    return null;
  }, false);
const spill = (ph: number) =>
  paint(FCX - BOWL_RX - 2, BOWL_CY, 2 * BOWL_RX + 4, TCY - BOWL_CY + 4, (x, y) => {
    const X = x + 0.5 - FCX;
    const j = y + 0.5 - BOWL_CY; // down from the bowl's middle
    const ax = Math.abs(X);
    // Two curtains of water falling from the bowl's sides into the basin.
    const edge = BOWL_RX - 1 + Math.min(2, j * 0.12);
    if (ax > edge - 1.5 && ax < edge + 0.6 && j > 2 && j < TCY - BOWL_CY + 2) return (Math.floor(j + ph * 2) % 4 === 0 ? "a" : "b");
    // The front of the bowl dribbling: a few streaks under its lip.
    if (ax < BOWL_RX - 3 && j > BOWL_RY + 3 && j < BOWL_RY + 3 + 3 + ((Math.floor(X + 40) * 7) % 4) && Math.floor(X + 40) % 4 === ph % 4) return "b";
    return null;
  }, false);
export const PARK_FOUNTAIN: Character = (() => {
  const parts: Record<string, Part> = {};
  const at: Record<string, Pt> = {};
  const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
  add("shadow", groundShadow(FCX + 2, BCY + 3, BRX + 4, BRY + 4));
  add("back", basinBack);
  add("pedestal", pedestal);
  add("bowl", bowl);
  add("finial", finial);
  add("front", basinFront);
  const frames: Frame[] = [0, 1, 2, 3].map((ph) => {
    add(`water${ph}`, water(ph));
    add(`jet${ph}`, jet(ph));
    add(`spill${ph}`, spill(ph));
    const L = (n: string) => ({ part: n, x: at[n]![0], y: at[n]![1] });
    return { ms: 180, layers: [L("shadow"), L("back"), L(`water${ph}`), L("pedestal"), L(`spill${ph}`), L("bowl"), L("finial"), L(`jet${ph}`), L("front")] };
  });
  return { id: "park-fountain", name: "The fountain", w: FW, h: FH, foot: [FCX, FFOOT], palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
})();

// ---- A chess table and its two stools, three squares across (the table's square in the middle).

const TW = 3 * PX;
const TH = 50;
const TFOOT = TH - 6;
const TCX = Math.floor(TW / 2);
/**
 * The table's top, seen from a little above like the squares: its board's 8 x 8 squares, each this many pixels across,
 * its rows 2 and 1 pixels deep in turn (foreshortened); its stone frame round it; the top's front edge at this height.
 */
const SQW = 4;
const ROWS_D = [2, 1, 2, 1, 2, 1, 2, 1] as const;
const ROW_Y = ROWS_D.map((_, i) => ROWS_D.slice(0, i).reduce((a, b) => a + b, 0));
const TOP_Y = TFOOT - 18;
/** A game under way: a few pieces on the board (column, row from the far side, light or dark). */
const GAME: readonly [number, number, boolean][] = [
  [4, 0, false], [3, 1, false], [5, 1, false], [2, 2, false], [6, 3, false],
  [4, 4, true], [3, 6, true], [2, 6, true], [5, 7, true], [4, 7, true], [1, 5, true],
];
export const PARK_TABLE: Character = (() => {
  const bw = 8 * SQW;
  const bd = ROWS_D.reduce((a, b) => a + b, 0);
  const x0 = TCX - bw / 2;
  const by = TOP_Y - 3 - bd; // the board's far edge
  const top = paint(x0 - 2, by - 1, bw + 4, bd + 5, (x, y) => {
    const i = x - x0;
    const j = y - by;
    if (j >= bd + 1) return i < bw / 3 ? "3" : i < (2 * bw) / 3 ? "4" : "5"; // the top's front edge, its thickness
    if (i < 0 || i >= bw || j < 0 || j >= bd) return j < 0 || i < 0 ? "1" : "2"; // the stone frame round the board, lit at the back and left
    const ci = Math.floor(i / SQW);
    let cj = 0;
    while (cj < 7 && j >= ROW_Y[cj + 1]!) cj++;
    return (ci + cj) % 2 ? "D" : "L";
  });
  // The pieces: each a little upright of a body and a head on its square.
  const pieces = paint(x0, by - 3, bw, bd + 3, (x, y) => {
    for (const [ci, cj, light] of GAME) {
      const px = x0 + ci * SQW + 1;
      const py = by + ROW_Y[cj]! + ROWS_D[cj]! - 1; // its square's near edge
      if ((x === px || x === px + 1) && y <= py && y >= py - 2) return light ? "P" : "Q";
    }
    return null;
  }, false);
  // Its leg: a thick stone pedestal on a broad foot.
  const leg = paint(TCX - 7, TOP_Y + 4, 15, TFOOT - TOP_Y - 4, (x, y) => {
    const X = x - TCX;
    const j = TFOOT - y;
    if (j < 3) return X < -2 ? "3" : X < 4 ? "4" : "5";
    if (Math.abs(X) > 4.5) return null;
    return X < -1 ? "2" : X > 2 ? "4" : "3";
  });
  const seatH = Math.round(TOWN_FEEL.sitSeat * PX);
  const stool = (sx: number) =>
    paint(sx - 8, TFOOT - seatH - 3, 17, seatH + 4, (x, y) => {
      const X = x + 0.5 - sx;
      const j = TFOOT - (y + 0.5);
      if (j > seatH - 2) {
        // The seat, a round top seen from above.
        const t = (X / 8) ** 2 + ((j - seatH) / 3) ** 2;
        if (t > 1) return null;
        return X < -2 && j > seatH ? "1" : "2";
      }
      const w = j < 2 ? 6 : 4.5;
      if (Math.abs(X) > w) return null;
      return X < -1.5 ? "2" : X > 2 ? "4" : "3";
    });
  const shadow = groundShadow(TCX + 1, TFOOT, 14, 4);
  const shL = groundShadow(TCX - PX + 1, TFOOT, 8, 3);
  const shR = groundShadow(TCX + PX + 1, TFOOT, 8, 3);
  return one("park-table", "A chess table", TW, TH, [TCX, TFOOT], [shadow, shL, shR, stool(TCX - PX), stool(TCX + PX), leg, top, pieces]);
})();
/** Where the board's top is in the table's picture (its height over the foot, pixels), for its card to point at. */
export const TABLE_TOP = TFOOT - TOP_Y + 18;
/** (Each tree on its own, for the previews: `npm run preview:characters -- <dir> extra=…/park.ts`.) */
export const [PARK_TREE_0, PARK_TREE_1, PARK_TREE_2] = PARK_TREES as [Character, Character, Character];

// ---- A park lamp: a stepped iron foot, a post with a collar halfway up, a lantern on a little bracket at its top.

const LW = 20;
const LH = 62;
const LFOOT = LH - 4;
const LCX = 10;
/** The lantern: its tray's row, its glass's rows above it (the panes widen upward), its cap's eave. */
const TRAY = 23;
const GLASS_TOP = TRAY - 10;
const EAVE_Y = GLASS_TOP - 1;
export const PARK_LAMP: Character = (() => {
  const cx = LCX;
  const f = LFOOT;
  // Iron lit from the top left: its left column lit, its right in shade.
  const iron = (x: number, lo: number, hi: number) => (x <= lo ? "J" : x >= hi ? "i" : "I");
  const foot = paint(cx - 3, f - 4, 7, 4, (x, y) => {
    const j = f - y; // 1 to 4, up from the ground
    const half = j <= 2 ? 3 : 2;
    if (Math.abs(x - cx) > half) return null;
    return j === 2 || j === 4 ? (x < cx + half ? "J" : "I") : iron(x, cx - half, cx + half);
  });
  const post = paint(cx - 1, TRAY + 3, 3, f - 4 - TRAY - 3, (x) => iron(x, cx - 1, cx + 1));
  const collar = paint(cx - 2, f - 24, 5, 3, (x, y) => (y === f - 24 ? "J" : iron(x, cx - 2, cx + 2)));
  // Under the lantern: a little flared bracket.
  const bracket = paint(cx - 3, TRAY + 1, 7, 2, (x, y) => (y === TRAY + 1 ? (x < cx ? "J" : x > cx ? "i" : "I") : Math.abs(x - cx) <= 1 ? iron(x, cx - 1, cx + 1) : null));
  // The lantern: its tray, its four panes (two show, either side of a bar) widening upward, iron at its corners.
  const lanternBody = paint(cx - 4, GLASS_TOP, 9, TRAY - GLASS_TOP + 1, (x, y) => {
    const X = x - cx;
    if (y === TRAY) return Math.abs(X) <= 3 ? (X < 0 ? "I" : "i") : null; // its tray
    const half = 3 + (y < GLASS_TOP + 5 ? 1 : 0);
    if (Math.abs(X) > half) return null;
    if (Math.abs(X) === half || X === 0) return X < 0 ? "I" : "i"; // its corner posts and the bar between the panes
    // The glass: pale where the day lights it (the left pane's upper part), darker in its shade.
    return X < 0 && y < TRAY - 3 ? "y" : "Y";
  });
  // Its cap: a pointed iron roof over a wide eave, a ball on top.
  const cap = paint(cx - 5, EAVE_Y - 7, 11, 8, (x, y) => {
    const X = x - cx;
    const j = EAVE_Y - y; // 0 the eave, up to its top
    if (j <= 5) {
      const half = 5 - j;
      if (Math.abs(X) > half) return null;
      return j === 0 ? (X < 2 ? "I" : "i") : X < 0 ? "J" : X > 0 ? "i" : "I";
    }
    return X === 0 ? (j === 6 ? "I" : "J") : null; // the ball
  });
  return one("park-lamp", "A lamp", LW, LH, [cx, f], [groundShadow(cx + 1, f, 6, 2), foot, post, collar, bracket, lanternBody, cap]);
})();
/** The middle of the lamp's left pane, low in its glass, in its picture's pixels (the tests look for its light there). */
export const PARK_LAMP_HEAD: Pt = [LCX - 1, (GLASS_TOP + TRAY) / 2 + 1];
/** The lamp's light at dusk and night: its glass, warm and bright, with a halo round it in the air. */
export const PARK_LAMP_LIGHTS: readonly LightSpot[] = [{ x: LCX - 4, y: GLASS_TOP, w: 9, h: TRAY - GLASS_TOP, keys: "yY", color: LANTERN_LIGHT, strength: 1, halo: 26 }];
/** ... and its pool on the ground under it (about two squares across). */
export const PARK_LAMP_POOLS: readonly LightPool[] = [{ x: LCX, y: LFOOT, rx: 36, ry: 12, color: LANTERN_LIGHT, strength: 0.26 }];
