/**
 * The "zzz" over an away player's pawn (Eric, Nov 7: "put zzz with no text box or something like that"): three pixel-art Zs, no
 * bubble, no words, drifting up and to the right from over the head, each growing a little and fading as it goes, one after
 * another. The Z is drawn once (a 5 × 5 pixel Z in a dark rim, made 4 times bigger without smoothing); a frame only places
 * three copies of it, so it costs nothing per frame but three image draws for each away pawn on screen (none when nobody's away).
 */

/** The Z's pixels (its dark rim is the pixels round them). */
const Z = ["ooooo", "...o.", "..o..", ".o...", "ooooo"];
const SIDE = Z.length + 2;
const PX = 4;
const FILL = "#eef3ff";
const RIM = "#2b2f3d";
/** One Z's trip, from over the head to gone (ms). */
const TRIP_MS = 2400;
const ZS = 3;

let art: HTMLCanvasElement | null = null;
function glyph(): HTMLCanvasElement {
  if (art) return art;
  const c = document.createElement("canvas");
  c.width = c.height = SIDE * PX;
  const g = c.getContext("2d")!;
  const on = (x: number, y: number) => Z[y - 1]?.[x - 1] === "o";
  for (let y = 0; y < SIDE; y++)
    for (let x = 0; x < SIDE; x++) {
      let rim = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) rim ||= on(x + dx, y + dy);
      if (!on(x, y) && !rim) continue;
      g.fillStyle = on(x, y) ? FILL : RIM;
      g.fillRect(x * PX, y * PX, PX, PX);
    }
  return (art = c);
}

/** What a "zzz" is drawn with: a Canvas 2D context or the town's drawing layer (paint.ts). */
interface Drawer {
  globalAlpha: number;
  drawImage(img: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
}

/**
 * Draws a "zzz" whose first Z starts at (x, y) (just over a head, a little right of it), `s` its scale (1: a Z from 6 to 10 px tall),
 * at `alpha`, as it is at `now` (ms). Leaves globalAlpha at 1.
 */
export function drawZzz(g: Drawer, x: number, y: number, s: number, now: number, alpha = 1): void {
  const img = glyph();
  for (let i = 0; i < ZS; i++) {
    const t = (((now / TRIP_MS + i / ZS) % 1) + 1) % 1;
    const a = t < 0.2 ? t / 0.2 : t > 0.7 ? (1 - t) / 0.3 : 1;
    const size = (6 + 4 * t) * s;
    const dx = x + (2 + 12 * t + 1.5 * Math.sin(t * Math.PI * 2)) * s;
    const dy = y - (2 + 18 * t) * s;
    g.globalAlpha = alpha * a;
    g.drawImage(img, dx - size / 2, dy - size, size, size);
  }
  g.globalAlpha = 1;
}
