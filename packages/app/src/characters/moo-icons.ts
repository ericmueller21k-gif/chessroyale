import type { Character } from "./sprite.ts";

/**
 * Moo's icons, out of his drawing's file (moo.ts) so the chat's speech line (speech.tsx, speech-icons.ts) draws them from the first load
 * without his code (Nov 16, the bundle split).
 */

/** His outline's color (moo.ts MOO_PALETTE.k): the icons' outline too. */
export const MOO_OUTLINE = "#25140d";

// ---- Moo's icons: he can't talk, so besides his moos he says things with these, in a line of text.

/**
 * A little picture for his speech line: `grid` is its pixels (a palette key each, `.` empty) and `palette` its colors. It has
 * no outline of its own: drawn as a sprite (`mooIconSprite`) it gets the same dark outline and faint halo as every figure,
 * light from the top left, so it reads on light and dark grounds. Each is about 10 pixels tall (12 with its outline).
 */
export interface MooIcon {
  grid: readonly string[];
  palette: Readonly<Record<string, string>>;
}

export const MOO_ICONS = {
  /** A bottle of milk: a blue cap, a glass neck and shoulders, a white body. */
  milk: {
    grid: ["..ccc..", "..cCc..", "..gwg..", ".gwwwg.", "gwWwwwg", "gwWwwwg", "gwwwwsg", "gwwwwsg", "gwwwssg", ".ggggg."],
    palette: { c: "#3f7fd0", C: "#8fbcf5", g: "#8fb8dc", w: "#f6f6f0", W: "#ffffff", s: "#c4d0e2" },
  },
  /** A heart. */
  heart: {
    grid: [".rrr...rrr.", "rHHrr.rrrrr", "rHrrrrrrrrr", "rrrrrrrrrrs", "rrrrrrrrrrs", ".rrrrrrrrs.", "..rrrrrrs..", "...rrrrs...", "....rrs....", ".....s....."],
    palette: { r: "#e8384f", H: "#ff9aa8", s: "#b01f3a" },
  },
  /** A chess pawn (him thinking of a piece). */
  pawn: {
    grid: ["...ww...", "..wWww..", "..wwws..", "...ws...", "..wwws..", "...ws...", "...ws...", "..wwss..", ".wwwwss.", ".sssssss"],
    palette: { w: "#f1e8d2", W: "#fffaf0", s: "#bfb08e" },
  },
  /** "Zzz": napping, or dazed after the full moon. */
  zzz: {
    grid: [".......ZZZZ", ".........z.", "........z..", ".......ssss", "ZZZZZZ.....", "....zz.....", "...zz......", "..zz.......", ".zz........", "ssssss....."],
    palette: { Z: "#e6f4ff", z: "#9ccbf5", s: "#6aa0dc" },
  },
  /** A tuft of grass with a little flower. */
  grass: {
    grid: [".....p.....", "....pyp....", ".....p.....", ".....g.....", "..g..g..g..", "..gg.gG.gg.", ".gGg.gGgGg.", ".gGgGgGgGg.", "gGGgGgGGGgg", "ggggggggggg"],
    palette: { g: "#3a8f3a", G: "#7ad25e", p: "#f27aa8", y: "#ffd23a" },
  },
  /** A sparkle: a four-pointed star. */
  sparkle: {
    grid: ["....y....", "....y....", "...yYy...", "...yYy...", "yyyYYYyyy", "...yYy...", "...yYy...", "....y....", "....y...."],
    palette: { y: "#ffd23a", Y: "#fff6a8" },
  },
  /** The cartoon anger mark: for when you take his piece. */
  anger: {
    grid: ["rrr....rrr", "rHr....rrr", "rr......rr", "..........", "..........", "..........", "rr......rr", "rrr....rrr", "rrr....rrr"],
    palette: { r: "#e0342c", H: "#ff8a7a" },
  },
  /** A question mark. */
  question: {
    grid: [".yyyy.", "yYyyyy", "yy..yo", "....yo", "...yoo", "..yoo.", "..yo..", "......", "..yo..", "..yo.."],
    palette: { y: "#ffd23a", Y: "#fff6a8", o: "#d9921a" },
  },
  /** A tiny crescent moon: his friend. */
  moon: {
    grid: ["..yyyy..", ".yYyyy..", "yYyyy...", "yYyy....", "yyyy....", "yyyy....", "yyyyo...", "yyyyoo..", ".yyyyoo.", "..yyyyoo"],
    palette: { y: "#f8c744", Y: "#ffe58a", o: "#d8921f" },
  },
  /** A cowbell: a leather loop, a brass bell and its clapper. */
  cowbell: {
    grid: ["...lll...", "...l.l...", "..yyyyy..", ".yYyyyyo.", ".yYyyyyo.", ".yYyyyyo.", "yyYyyyyoo", "yyYyyyyoo", "ooooooooo", "...ddd..."],
    palette: { l: "#8a5a34", y: "#e8b23a", Y: "#fff0a0", o: "#b8801a", d: "#7a4a1a" },
  },
} as const satisfies Record<string, MooIcon>;

export type MooIconId = keyof typeof MOO_ICONS;

/** An icon as a one-frame sprite (three pixels of room all round for its outline and halo), drawn the way every figure is. */
export function mooIconSprite(id: MooIconId): Character {
  const icon: MooIcon = MOO_ICONS[id];
  const w = Math.max(...icon.grid.map((r) => r.length)) + 6;
  const h = icon.grid.length + 6;
  return {
    id: `moo-icon-${id}`,
    name: `Moo icon: ${id}`,
    w,
    h,
    foot: [Math.floor(w / 2), h - 3],
    palette: { k: MOO_OUTLINE, ...icon.palette },
    halo: "#2c2624",
    parts: { icon: { grid: icon.grid } },
    anims: { idle: { loop: true, frames: [{ ms: 1000, layers: [{ part: "icon", x: 3, y: 3 }] }] } },
  };
}
