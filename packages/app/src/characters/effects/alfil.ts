/**
 * Alfil's effect sprites for the board: one, the jab of his ankus landing on a king (his attack on a king: the God
 * King's Last Stand, the crowd's king at its mate). Everything else of his on the board is drawn from the board's own
 * pieces (the glow, the fusion's flash, the flying pieces), or reused as is (the Slam's shadows: Jefferson's
 * `fireShadow`).
 */
import type { Anim, Character, Speck } from "../sprite.ts";
import { SQUARE, sparkle, type Pt } from "./common.ts";

const ANKUS_PALETTE: Record<string, string> = {
  k: "#3a2410", // the spike's dark edge
  Y: "#f2c14e", // gold
  L: "#fff3ad", // gold, lit
  W: "#ffffff", // the hot tip
  O: "#c98a12", // gold, deep
};

/**
 * The spike's line across the square, coming in from the left edge: "H" high and level, "L" low and rising. `n` pixels
 * of it so far (it thrusts in).
 */
const spikeLine = (kind: "H" | "L", n: number): Pt[] => {
  const [y0, y1] = kind === "H" ? [12, 14] : [22, 16];
  const out: Pt[] = [];
  for (let x = 0; x <= Math.min(22, n); x++) out.push([x, Math.round(y0 + ((y1 - y0) * x) / 22)]);
  return out;
};
const jabFrame = (kind: "H" | "L", step: 0 | 1 | 2): Speck[] => {
  const pts = spikeLine(kind, step === 0 ? 14 : 22);
  const tip = pts[pts.length - 1]!;
  const out: Speck[] = [];
  // The spike: gold with a dark edge under it as it thrusts in, then only its fading streak.
  if (step < 2)
    for (const [x, y] of pts) {
      out.push([x, y, step === 0 ? "L" : "Y"], [x, y + 1, step === 0 ? "Y" : "O"]);
      if (step === 1) out.push([x, y + 2, "k"]);
    }
  else for (const [x, y] of pts) if (x % 2 === 0 && x > 8) out.push([x, y, "O"]);
  // Gold sparks off the tip: a burst, then flying apart and dimming.
  const r = [2, 5, 8][step]!;
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2 + 0.4;
    const px = Math.round(tip[0] + Math.cos(ang) * r);
    const py = Math.round(tip[1] + Math.sin(ang) * r * 0.8);
    if (px < 0 || py < 0 || px > SQUARE - 1 || py > SQUARE - 1) continue;
    out.push([px, py, step === 2 ? "O" : a % 2 ? "L" : "Y"]);
  }
  if (step === 0) out.push(...sparkle(tip[0], tip[1], "W", "L", true));
  return out;
};
/** Mirrored left to right (the jab coming in from the right edge: he stands to the king's right). */
const flipSpecks = (sp: Speck[]): Speck[] => sp.map(([x, y, k]) => [SQUARE - 1 - x, y, k] as Speck);
const jabAnims: Record<string, Anim> = {};
for (const kind of ["H", "L"] as const)
  for (const side of ["L", "R"] as const) {
    const sp = (step: 0 | 1 | 2) => (side === "L" ? jabFrame(kind, step) : flipSpecks(jabFrame(kind, step)));
    jabAnims[`hit${kind}${side}`] = {
      loop: false,
      frames: [
        { ms: 50, layers: [], specks: sp(0) },
        { ms: 70, layers: [], specks: sp(1) },
        { ms: 60, layers: [], specks: sp(2) },
        { ms: 20, layers: [] },
      ],
    };
  }

/**
 * A jab of his ankus landing on a king's square: `hit<H|L><L|R>`: high and level or low and rising, coming in from the
 * left or the right edge, a gold spike and a burst of gold sparks. About 200 ms; ends empty. Over the piece (or the God
 * King standing there), see-through round its line.
 */
export const ANKUS_HIT: Character = {
  id: "ankus-hit",
  name: "A jab of Alfil's ankus",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: ANKUS_PALETTE,
  parts: {},
  anims: jabAnims,
};
