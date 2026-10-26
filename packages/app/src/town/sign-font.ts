/**
 * The homes' signs' lettering: small pixel capitals, 5 pixels tall and mostly 3 wide (the game's pixel style, and about a
 * third narrower than Press Start 2P at the same height, so a home's whole name fits its board even zoomed out on a
 * phone). Names are written in capitals on the signs, as on Eric's pictures; the floating names keep their own case.
 */

/** Each glyph's rows ('#' lit). */
const GLYPHS: Record<string, readonly string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: [".#.", "#.#", "#.#", "##.", ".##"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#...#", "#...#", "#.#.#", "##.##", "#...#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
  "'": ["#", "#", ".", ".", "."],
  "&": [".#..", "#.#.", ".#..", "#.##", ".##."],
};
/** Letters are 5 pixels tall, 1 apart; a space is 2 wide; lines 2 apart. */
export const CAP = 5;
const GAP = 1;
const SPACE = 2;
export const LEADING = 2;

const glyph = (ch: string) => GLYPHS[ch.toUpperCase()];

/** A line's width in font pixels. */
export function lineWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += ch === " " ? SPACE : (glyph(ch)?.[0]!.length ?? 3) + GAP;
  return Math.max(0, w - GAP);
}

/** A name laid out on one line or two (whichever lets it be bigger in a face fw x fh): its lines and its size in font pixels. */
export function layout(text: string, fw: number, fh: number): { lines: string[]; w: number; h: number } {
  const one = { lines: [text], w: lineWidth(text), h: CAP };
  let best = one;
  let bestScale = Math.min(fw / one.w, fh / one.h);
  const words = text.split(" ");
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const two = { lines, w: Math.max(...lines.map(lineWidth)), h: 2 * CAP + LEADING };
    const scale = Math.min(fw / two.w, fh / two.h);
    if (scale > bestScale) ((best = two), (bestScale = scale));
  }
  return best;
}

/** Draws laid-out lines into a new canvas, `s` device pixels a font pixel, centered line by line, in `ink`. */
export function renderLines(lines: readonly string[], w: number, h: number, s: number, ink: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w * s;
  c.height = h * s;
  const g = c.getContext("2d")!;
  g.fillStyle = ink;
  lines.forEach((line, li) => {
    let x = Math.floor((w - lineWidth(line)) / 2);
    const y = li * (CAP + LEADING);
    for (const ch of line) {
      if (ch === " ") {
        x += SPACE;
        continue;
      }
      const rows = glyph(ch);
      if (!rows) {
        x += 3 + GAP;
        continue;
      }
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] === "#") g.fillRect((x + i) * s, (y + j) * s, s, s);
      });
      x += rows[0]!.length + GAP;
    }
  });
  return c;
}
