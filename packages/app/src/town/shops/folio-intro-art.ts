/**
 * Folio's challenge intro, its props (Nov 5, brief-folio-sanctuary-art.md; the timeline and the cues: intro-folio-nov5.md):
 *
 * 2. The furniture folds itself: on the clean page lie three flat sheets, two small ones (the stools) and a big one (the
 *    table). Each folds up in a few readable steps (flat, a crease lifts, its sides fold, it stands): first the stools, then
 *    the table. `INTRO_FOLIO_STOOL` and `INTRO_FOLIO_TABLE`, anim `fold` (once; its last frame is the finished piece) and
 *    `flat` / `idle` (the sheet lying flat, the finished piece).
 * 3. The board arrives: a paper aeroplane folded from a ruled page (blue lines, the pink margin line) glides in from off the
 *    room carrying the board folded flat on its back, banks over the table, drops the board and flies off
 *    (`INTRO_FOLIO_PLANE`: `fly`, `bank`, `drop`, `away`). The board, folded in quarters, falls to the table
 *    (`INTRO_FOLIO_BOARD` `packet`) and unfolds on it in two folds, like a map (`unfold`), a top-view picture the code lays on
 *    the table's top.
 * 5. The crumple's maths sketch is crumple.ts, beside this file.
 *
 * Drawn in the sanctuary's paper (paper-kit.ts: Folio's own cream, ink, gilt and seal), light from the top left. Upright
 * pieces stand at their foot as the room's do (37 px a square); the plane's foot is its middle (it flies: code lifts it).
 *
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/house-intro-folio/house-intro-folio.ts at e7e08bcf, Nov 5), its imports moved. The
 * notes: scripts/boss-art/out/shop-folio-nov5.md and intro-folio-nov5.md on that branch.
 */
import type { Anim, Character, Frame, Part } from "../../characters/sprite.ts";
import { PAPER_PALETTE, crop, cv, face, gilt, line, put, rect, seal, shadow, type Cv, type Pt } from "./paper-kit.ts";

/** The board's own two colours (the park table's ink, town/houses/park.ts TABLE_INK) and their shades, for the stand-in board. */
export const INTRO_FOLIO_PALETTE: Record<string, string> = {
  ...PAPER_PALETTE,
  "%": "#f6f1e6",
  "#": "#d3c9b6",
  "&": "#2d2c33",
  "=": "#57565f",
};

const part = (c: Cv, outline = true): { part: Part; at: Pt } => {
  const r = crop(c);
  return r ? { part: { grid: r.grid, outline }, at: r.at } : { part: { grid: ["."], outline: false }, at: [0, 0] };
};
/** A Character from named anims, each a list of [ms, canvases (back to front, the first without outline: a shadow)]. */
function character(id: string, name: string, w: number, h: number, foot: Pt, anims: Record<string, { loop: boolean; frames: { ms: number; cvs: Cv[]; cue?: string; outline?: boolean[] }[] }>): Character {
  const parts: Record<string, Part> = {};
  let n = 0;
  const out: Record<string, Anim> = {};
  for (const [an, a] of Object.entries(anims)) {
    out[an] = {
      loop: a.loop,
      frames: a.frames.map((f): Frame => ({
        ms: f.ms,
        ...(f.cue ? { cue: f.cue } : {}),
        layers: f.cvs.map((c, i) => {
          const p = part(c, f.outline?.[i] ?? i > 0);
          const nm = `p${n++}`;
          parts[nm] = p.part;
          return { part: nm, x: p.at[0], y: p.at[1] };
        }),
      })),
    };
  }
  return { id, name, w, h, foot, palette: INTRO_FOLIO_PALETTE, parts, anims: out };
}

// ==== 2. The stools: a small square sheet folds into a little paper box stool (its seat the park stool's height, 11 px).

const STW = 26;
const STH = 26;
const STF: Pt = [13, 22];
/** Five steps: flat; a crease lifts (a low ridge); its sides fold up (walls rising, the corners tucking in); it stands (the seat's flap closing); done. */
function stoolCv(step: number): Cv[] {
  const sh = cv(STW, STH);
  const c = cv(STW, STH);
  const y = STF[1];
  if (step === 0) {
    shadow(sh, 13, y, 10, 2);
    face(c, [[3, y - 2], [20, y - 2], [23, y + 1], [6, y + 1]], "A", { lo: "C" });
    line(c, 4, y - 1, 21, y - 1, "b");
  } else if (step === 1) {
    shadow(sh, 13, y, 10, 2);
    face(c, [[3, y], [12, y - 6], [14, y - 6], [13, y]], "B", { hi: "A" });
    face(c, [[13, y], [14, y - 6], [16, y - 6], [23, y]], "C", { lo: "D" });
    face(c, [[3, y], [13, y], [13, y + 1], [6, y + 1]], "b");
    line(c, 13, y - 6, 13, y, "D");
  } else if (step === 2) {
    shadow(sh, 13, y, 10, 2);
    // Walls half up, the inside showing (in shade), the corners tucking in as triangles.
    face(c, [[6, y - 9], [19, y - 9], [21, y - 6], [8, y - 6]], "D");
    face(c, [[6, y - 5], [19, y - 5], [19, y], [6, y]], "B", { hi: "A", lo: "C" });
    face(c, [[19, y - 5], [21, y - 7], [21, y - 2], [19, y]], "C", { lo: "D" });
    face(c, [[3, y - 1], [6, y - 5], [6, y]], "C");
    line(c, 12, y - 5, 12, y, "C");
  } else {
    shadow(sh, 13, y, 10, 2);
    // Standing: the front, its east side, and the seat (its flap closing at step 3, flat at 4).
    face(c, [[5, y - 11], [19, y - 11], [19, y], [5, y]], "B", { hi: "A", lo: "C" });
    face(c, [[19, y - 11], [22, y - 14], [22, y - 3], [19, y]], "C", { lo: "D" });
    line(c, 12, y - 10, 12, y - 1, "C");
    line(c, 6, y - 6, 11, y - 1, "b");
    line(c, 18, y - 6, 13, y - 1, "b");
    if (step === 3) {
      face(c, [[5, y - 11], [19, y - 11], [17, y - 17], [3, y - 17]], "C", { lo: "D" });
      face(c, [[19, y - 11], [22, y - 14], [20, y - 18], [17, y - 17]], "D");
    } else {
      face(c, [[5, y - 11], [19, y - 11], [22, y - 14], [8, y - 14]], "A", { lo: "B" });
      line(c, 8, y - 14, 19, y - 11, "b");
      gilt(c, [5, y - 11], [19, y - 11], { glint: 0.3 });
    }
  }
  return [sh, c];
}
const STOOL_MS = [180, 150, 150, 150, 220];
/** `fold`: the crease lifting, the sides folding, standing, done (the flat sheet before it is INTRO_FOLIO_SHEETS' `stool`). */
export const INTRO_FOLIO_STOOL = character("folio-intro-stool", "Folio's intro: a stool folding", STW, STH, STF, {
  fold: { loop: false, frames: STOOL_MS.slice(1).map((ms, i) => ({ ms, cvs: stoolCv(i + 1), ...(i < 3 ? { cue: "fold" } : { cue: "set" }) })) },
  idle: { loop: true, frames: [{ ms: 1000, cvs: stoolCv(4) }] },
});

// ==== 2. The table: a big sheet folds into a folded-paper table: its middle drawn up into a pleated pedestal on a folded
// foot, its top two flaps opening flat into the tabletop (a gilt edge along its front). Its top stands 27 px over its foot
// (the park table's is 26), where the board lies.

const TBW = 64;
const TBH = 44;
const TBF: Pt = [32, 39];
/** The table top's height over the foot, and its half-width (px): where the board is laid. */
export const INTRO_FOLIO_TABLE_TOP = 27;
export const INTRO_FOLIO_TABLE_HALF = 26;
function pedestal(c: Cv, y0: number, y1: number, half: number) {
  for (let y = y0; y <= y1; y++)
    for (let x = -half; x <= half; x++) {
      const u = (x + half) % 4;
      put(c, TBF[0] + x, y, u === 0 ? "A" : u === 1 ? "B" : u === 2 ? "C" : "D");
    }
}
function tableCv(step: number): Cv[] {
  const sh = cv(TBW, TBH);
  const c = cv(TBW, TBH);
  const y = TBF[1];
  const cx = TBF[0];
  shadow(sh, cx, y, step >= 4 ? 22 : 28, 3);
  if (step === 0) {
    face(c, [[3, y - 3], [56, y - 3], [61, y + 1], [8, y + 1]], "A", { lo: "C" });
    line(c, 6, y - 2, 57, y - 2, "b");
  } else if (step === 1) {
    // A crease lifts: the middle rises in a long ridge.
    face(c, [[3, y], [cx - 1, y - 11], [cx + 1, y - 11], [cx, y]], "B", { hi: "A" });
    face(c, [[cx, y], [cx + 1, y - 11], [cx + 3, y - 11], [61, y]], "C", { lo: "D" });
    face(c, [[3, y], [cx, y], [cx, y + 1], [8, y + 1]], "b");
    line(c, cx, y - 11, cx, y, "D");
  } else if (step === 2) {
    // The middle drawn up into a pleated column, the two flaps (the top-to-be) hanging down either side.
    face(c, [[cx - 14, y - 3], [cx + 14, y - 3], [cx + 18, y + 1], [cx - 10, y + 1]], "B", { lo: "C" });
    pedestal(c, y - 18, y - 3, 4);
    face(c, [[cx - 4, y - 18], [cx - 24, y - 6], [cx - 20, y - 3], [cx - 4, y - 12]], "B", { hi: "A", lo: "C" });
    face(c, [[cx + 4, y - 18], [cx + 24, y - 6], [cx + 22, y - 3], [cx + 4, y - 12]], "C", { lo: "D" });
  } else if (step === 3) {
    // It stands: the column full height on its folded foot, the flaps rising toward flat.
    face(c, [[cx - 14, y - 4], [cx + 14, y - 4], [cx + 18, y], [cx - 10, y]], "B", { hi: "A", lo: "C" });
    pedestal(c, y - INTRO_FOLIO_TABLE_TOP + 1, y - 4, 5);
    face(c, [[cx - 5, y - INTRO_FOLIO_TABLE_TOP], [cx - 26, y - INTRO_FOLIO_TABLE_TOP - 9], [cx - 26, y - INTRO_FOLIO_TABLE_TOP - 5], [cx - 5, y - INTRO_FOLIO_TABLE_TOP + 3]], "A", { lo: "C" });
    face(c, [[cx + 5, y - INTRO_FOLIO_TABLE_TOP], [cx + 26, y - INTRO_FOLIO_TABLE_TOP - 9], [cx + 26, y - INTRO_FOLIO_TABLE_TOP - 5], [cx + 5, y - INTRO_FOLIO_TABLE_TOP + 3]], "B", { lo: "D" });
  } else {
    // Done: a flat top (seen from above, 7 px deep), its front edge band, gilt along it; the pedestal, the foot.
    const t = y - INTRO_FOLIO_TABLE_TOP;
    face(c, [[cx - 14, y - 4], [cx + 14, y - 4], [cx + 18, y], [cx - 10, y]], "B", { hi: "A", lo: "C" });
    pedestal(c, t + 3, y - 4, 5);
    face(c, [[cx - 26, t - 4], [cx + 24, t - 4], [cx + 27, t + 1], [cx - 23, t + 1]], "A", { lo: "B" });
    line(c, cx, t - 4, cx + 1, t + 1, "b");
    face(c, [[cx - 23, t + 1], [cx + 27, t + 1], [cx + 27, t + 3], [cx - 23, t + 3]], "C", { lo: "D" });
    gilt(c, [cx - 23, t + 1], [cx + 27, t + 1], { glint: 0.2 });
  }
  return [sh, c];
}
const TABLE_MS = [200, 170, 170, 170, 160, 240];
/** `fold`: the ridge, the column drawn up, standing, the top flat (and a beat); the flat sheet before it is INTRO_FOLIO_SHEETS' `table`. */
export const INTRO_FOLIO_TABLE = character("folio-intro-table", "Folio's intro: the table folding", TBW, TBH, TBF, {
  fold: { loop: false, frames: TABLE_MS.slice(1).map((ms, i) => ({ ms, cvs: tableCv(Math.min(4, i + 1)), ...(i < 3 ? { cue: "fold" } : i === 3 ? { cue: "set" } : {}) })) },
  idle: { loop: true, frames: [{ ms: 1000, cvs: tableCv(4) }] },
});

// ==== 2. The three flat sheets as they lie on the clean page before they fold: top-view pictures (code lays each flat on
// the floor through the camera, as the room's floor tiles are; 37 px a square). Each a hair warmer than the page, already
// creased with the folds it will make (faint lines), its south and east edges a hair darker where they lift. The stools'
// sheets are 24 px (0.65 squares) square, the table's 52 x 38 (1.4 x 1 squares).

function sheetCv(w: number, h: number, folds: (c: Cv) => void): Cv {
  const c = cv(w + 2, h + 2);
  // A soft shadow south and east (the edges lifting), then the sheet.
  rect(c, 2, 2, w, h, "+");
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(c, x, y, y === 0 || x === 0 ? "A" : y === h - 1 || x === w - 1 ? "C" : "B");
  folds(c);
  return c;
}
const SHEET_STOOL = sheetCv(24, 24, (c) => {
  // A square sheet's folds: the diagonals and a square inside (the box's walls).
  for (let i = 3; i < 21; i++) (put(c, i, i, "b"), put(c, 23 - i, i, "b"));
  for (let i = 6; i <= 17; i++) (put(c, i, 6, "b"), put(c, i, 17, "b"), put(c, 6, i, "b"), put(c, 17, i, "b"));
});
const SHEET_TABLE = sheetCv(52, 38, (c) => {
  // The table's folds: a long ridge down the middle, pleats either side (the pedestal), the top's two flaps.
  for (let y = 2; y < 36; y++) put(c, 26, y, "b");
  for (const x of [20, 23, 29, 32]) for (let y = 10; y < 28; y++) if (y % 2 === 0) put(c, x, y, "b");
  for (let x = 2; x < 50; x++) (put(c, x, 9, "b"), put(c, x, 28, "b"));
  seal(c, 44, 30, true);
});
export const INTRO_FOLIO_SHEETS = character("folio-intro-sheets", "Folio's intro: the flat sheets (top view)", 54, 40, [27, 20], {
  stool: { loop: true, frames: [{ ms: 1000, cvs: [SHEET_STOOL], outline: [false] }] },
  table: { loop: true, frames: [{ ms: 1000, cvs: [SHEET_TABLE], outline: [false] }] },
});
/** Each sheet's size on the floor (squares): its top-view picture's width and height / 37 (its shadow's 2 px aside). */
export const INTRO_FOLIO_SHEET_SQUARES = { stool: [26 / 37, 26 / 37], table: [54 / 37, 40 / 37] } as const;

// ==== 3. The paper aeroplane, folded from a ruled page (blue lines, the pink margin line), the board folded flat on its back
// (a little packet: the board's back, Folio's seal on it). Drawn facing our left; mirror it to fly right.

const PW = 52;
const PH = 30;
const PF: Pt = [26, 15];
/** The packet on its back (or falling): the folded board, its outer face the paper's back with the seal; 13 x 6 seen flat. */
function packet(c: Cv, x: number, y: number) {
  face(c, [[x + 2, y], [x + 13, y], [x + 11, y + 5], [x, y + 5]], "F", { hi: "A", lo: "f" });
  line(c, x + 7, y, x + 6, y + 5, "f");
  put(c, x + 4, y + 2, "v");
  put(c, x + 5, y + 2, "v");
  put(c, x + 4, y + 3, "w");
}
/** The plane at a bank `b` (0 level, 1 a little, 2 steep: seen more from above, its wing wider), `nose` up or down a pixel, with or without its packet. */
function planeCv(b: number, nose: number, carry: boolean): Cv {
  const c = cv(PW, PH);
  const y = PF[1];
  const nx = 3;
  const tail = 46;
  const lift = b === 0 ? 0 : b === 1 ? 3 : 7; // how much of the wing's top we see as it banks
  // The far wing (behind, peeking above), the near wing (its top, ruled), the keel under it.
  face(c, [[nx + 2, y - 1 + nose], [tail, y - 8 - lift], [tail, y - 6 - lift]], "B", { lo: "C" });
  const wing: Pt[] = [[nx, y + nose], [tail, y - 6 - lift / 2], [tail + 1, y + 1 + lift]];
  face(c, wing, "A", { lo: "C" });
  // Ruled lines across the wing, and the margin line near its tail.
  for (let x = nx + 4; x < tail; x++)
    for (let yy = y - 9 - lift; yy <= y + 2 + lift; yy++) {
      if (c[yy]?.[x] !== "A") continue;
      if ((yy - y + 30) % 3 === 0) put(c, x, yy, "r");
      if (x === tail - 7 || x === tail - 6) put(c, x, yy, "m");
    }
  face(c, [[nx, y + nose], [tail + 1, y + 1 + lift], [tail - 3, y + 5 + Math.floor(lift / 2)]], "C", { lo: "D" });
  line(c, nx + 1, y + nose, tail, y + 1 + lift, "b");
  if (carry) packet(c, 20, y - 8 - Math.floor(lift / 2));
  return c;
}
const pf = (b: number, nose: number, carry: boolean, ms: number) => ({ ms, cvs: [planeCv(b, nose, carry)], outline: [true] });
export const INTRO_FOLIO_PLANE = character("folio-intro-plane", "Folio's intro: the paper aeroplane", PW, PH, PF, {
  fly: { loop: true, frames: [pf(0, 0, true, 120), pf(0, -1, true, 120), pf(0, 0, true, 120), pf(0, 1, true, 120)] },
  bank: { loop: false, frames: [pf(1, 0, true, 120), pf(2, 0, true, 160), pf(2, 1, true, 160), pf(1, 0, true, 120)] },
  drop: { loop: false, frames: [pf(1, 0, false, 100), pf(0, -1, false, 100), pf(0, -2, false, 120)] },
  away: { loop: true, frames: [pf(0, -2, false, 120), pf(0, -1, false, 120), pf(1, -2, false, 120)] },
  idle: { loop: true, frames: [pf(0, 0, true, 1000)] },
});

// ==== 3. The board, seen from above (a top-view picture the code lays flat on the table's top), 40 x 40 px: folded in
// quarters (the packet: the board's back, Folio's seal), unfolding in two folds like a map: the first flap swings over to
// the east (its back, edge-on, then its inside), the half sheet (still the back, a crease down it); the second flap swings
// down to the south; the whole board, its eight by eight squares.

const BD = 40;
const SQ = BD / 8;
const checker = (gx: number, gy: number) => {
  const i = Math.floor(gx / SQ);
  const j = Math.floor(gy / SQ);
  const light = (i + j) % 2 === 0;
  const edge = gx % SQ === SQ - 1 || gy % SQ === SQ - 1;
  return light ? (edge ? "#" : "%") : edge ? "=" : "&";
};
function boardCv(step: number): Cv {
  const c = cv(BD, BD);
  const H = BD / 2;
  const back = (x0: number, y0: number, w: number, h: number, k = "F") => {
    rect(c, x0, y0, w, h, k);
    for (let x = x0; x < x0 + w; x++) put(c, x, y0 + h - 1, "f");
    for (let y = y0; y < y0 + h; y++) put(c, x0 + w - 1, y, "f");
  };
  /** A flap swinging about a fold line: its width (or height) shrinks with cos of its angle; past 90 degrees we see its inside (the squares, squashed). */
  const flapX = (deg: number) => {
    const w = Math.round(Math.abs(Math.cos((deg * Math.PI) / 180)) * H);
    if (deg < 90) back(H - w, 0, w, H, "f");
    else for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) put(c, H + x, y, checker(H + Math.floor((x * H) / w), y));
  };
  const flapY = (deg: number) => {
    const h = Math.round(Math.abs(Math.cos((deg * Math.PI) / 180)) * H);
    if (deg < 90) back(0, H - h, BD, h, "f");
    else for (let y = 0; y < h; y++) for (let x = 0; x < BD; x++) put(c, x, H + y, checker(x, H + Math.floor((y * H) / h)));
  };
  if (step === 0) {
    back(0, 0, H, H);
    seal(c, 7, 7);
  } else if (step === 1) {
    back(0, 0, H, H);
    flapX(55);
  } else if (step === 2) {
    // The quarter under it is the next layer's back; the flap past upright shows its inside.
    back(0, 0, H, H);
    flapX(125);
  } else if (step === 3) {
    back(0, 0, BD, H);
    line(c, H, 0, H, H - 1, "f");
  } else if (step === 4) {
    back(0, 0, BD, H);
    flapY(55);
  } else if (step === 5) {
    // The top half's inside now shows (the board's top four ranks); the south flap past upright.
    for (let y = 0; y < H; y++) for (let x = 0; x < BD; x++) put(c, x, y, checker(x, y));
    flapY(125);
  } else for (let y = 0; y < BD; y++) for (let x = 0; x < BD; x++) put(c, x, y, checker(x, y));
  return c;
}
const BOARD_MS = [160, 90, 90, 150, 90, 90, 300];
export const INTRO_FOLIO_BOARD = character("folio-intro-board", "Folio's intro: the board unfolding (top view)", BD, BD, [BD / 2, BD / 2], {
  packet: { loop: true, frames: [{ ms: 1000, cvs: [boardCv(0)], outline: [true] }] },
  unfold: { loop: false, frames: BOARD_MS.map((ms, i) => ({ ms, cvs: [boardCv(i)], outline: [true], ...(i === 1 || i === 4 ? { cue: "unfold" } : {}) })) },
  full: { loop: true, frames: [{ ms: 1000, cvs: [boardCv(6)], outline: [true] }] },
  idle: { loop: true, frames: [{ ms: 1000, cvs: [boardCv(6)], outline: [true] }] },
});
/** The packet's size on its own (its quarter of the board's top-view picture): the falling packet is the board's NW quarter. */
export const INTRO_FOLIO_PACKET = { w: BD / 2, h: BD / 2 } as const;

// ==== The positions (squares; lift in squares over the floor), as the mockup plays them (intro-folio-nov5.md).

/** The table's middle (between the marks), the stools one square either side of it (the park table's spacing). */
export const INTRO_FOLIO_TABLE_AT = [9.5, 10.5] as const;
export const INTRO_FOLIO_STOOLS_AT = [[8.5, 10.5], [10.5, 10.5]] as const;
/** The board laid on the table: its top-view picture this many squares across, its middle on the table's middle, at the top's height. */
export const INTRO_FOLIO_BOARD_SQUARES = 1.0;
/**
 * The plane's route: in from beyond the east wall, high, gliding west to over the table (`fly`), banking over it (`bank`), the
 * packet let go over the table's middle (`drop`), then climbing away to the north-west and off the room (`away`). Each point
 * is [col, row, lift] and the time (ms from the plane's start) it passes.
 */
export const INTRO_FOLIO_PLANE_ROUTE = [
  { at: [17.5, 8.4, 3.6], ms: 0 },
  { at: [12.2, 9.6, 2.7], ms: 900 },
  { at: [10.3, 10.2, 2.35], ms: 1250 },
  { at: [9.6, 10.6, 2.25], ms: 1730 },
  { at: [8.4, 10.1, 2.45], ms: 2050 },
  { at: [5.0, 7.2, 3.4], ms: 2700 },
  { at: [1.5, 4.0, 4.4], ms: 3300 },
] as const;
