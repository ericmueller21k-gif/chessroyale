/**
 * Bakes the rides (packages/app/src/components/rides/*.tsx, crate items in the `ride` slot) for the town square: one
 * picture per ride and color, `packages/app/src/town/rides/ride-<ride>-<color>.webp` (lossless: bit for bit the page's
 * drawing, about 40% of a PNG's size), and what the town needs to play them in
 * `packages/app/src/town/ride-sheets.ts` (both generated; don't edit them by hand).
 *
 * Why (docs/decisions/2026-10-31-rides.md): the town draws nothing new per frame (Eric's frame-rate rule), and a ride's
 * SVG, drawn in the town, would cost a phone tens of milliseconds a frame of it. Baked, the town loads one small picture
 * for a ride in a color, cuts it into frames once and puts each rider's pawn between their back and front once. A sheet's
 * rows are idle back, idle front, move back, move front, a frame a column; drawn at 100% purity without the shine (the
 * town shows a ride's color, not its blotches). With each ride: its cell, its frames' times, where the pawn sits on each,
 * the move's lift, and a hash of what its sheets are drawn from (its drawing, the paint's fills and lines in
 * components/item-paint.tsx, the colors; not the blotches, which the sheets don't have), which
 * `packages/app/test/town-rides.test.ts` checks, so a sheet can't go stale.
 *
 * Run after changing a ride, the paint (components/item-paint.tsx) or the colors: `npx tsx scripts/bake-rides.ts`.
 * (It opens /rides-bake.html on the app's dev server in Chromium: packages/app/src/dev/rides-bake.tsx.)
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { ITEM_COLORS } from "../packages/core/src/index.ts";

const RIDE_DIR = "packages/app/src/components/rides";
const OUT = "packages/app/src/town/ride-sheets.ts";
const SHEETS = "packages/app/src/town/rides";

/** A hash of what a ride's sheets are drawn from: its drawing, the paint's fills and lines, and the colors (the test recomputes it). */
export function rideHash(id: string, root = "."): string {
  const h = createHash("sha256");
  h.update(readFileSync(`${root}/${RIDE_DIR}/${id}.tsx`));
  h.update(readFileSync(`${root}/packages/app/src/components/item-paint.tsx`));
  h.update(JSON.stringify(ITEM_COLORS));
  return h.digest("hex").slice(0, 16);
}

const nums = (a: readonly number[]) => `[${a.map((x) => +x.toFixed(2)).join(", ")}]`;

async function main() {
  const { chromium } = await import("@playwright/test");
  const sharp = (await import("sharp")).default;
  const { createServer } = await import("vite");
  const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5199, strictPort: false }, logLevel: "error" });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error("page:", e.message));
    await page.goto(`${server.resolvedUrls!.local[0]}rides-bake.html`);
    await page.waitForFunction(() => "__bake" in window);
    const rides = await page.evaluate(() => (window as unknown as { __rides: string[] }).__rides);
    rmSync(SHEETS, { recursive: true, force: true });
    mkdirSync(SHEETS, { recursive: true });
    const entries: string[] = [];
    for (const id of rides) {
      const pose = await page.evaluate((id) => (window as unknown as { __poses: (id: string) => { ms: { idle: number[]; move: number[] }; seat: { idle: number[][]; move: number[][] }; lift: number[] } }).__poses(id), id);
      let first: { cell: number[]; w: number; h: number; top: number } | null = null;
      let bytes = 0;
      for (const c of ITEM_COLORS) {
        const r = await page.evaluate(([id, color]) => (window as unknown as { __bake: (id: string, color: string) => Promise<{ png: string; cell: number[]; w: number; h: number; top: number }> }).__bake(id!, color!), [id, c.id]);
        if (first && (r.cell.join() !== first.cell.join() || r.w !== first.w)) throw new Error(`${id}: ${c.id}'s cell ${r.cell} isn't ${first.cell}`);
        if (first) first.top = Math.min(first.top, r.top);
        first ??= r;
        const png = Buffer.from(r.png.slice(r.png.indexOf(",") + 1), "base64");
        const webp = await sharp(png).webp({ lossless: true, exact: true, effort: 6 }).toBuffer();
        // (Lossless, checked: the same pixels as the page drew.)
        const [a, b] = await Promise.all([sharp(png).ensureAlpha().raw().toBuffer(), sharp(webp).ensureAlpha().raw().toBuffer()]);
        if (!a.equals(b)) {
          let n = 0;
          let n0 = 0;
          let max = 0;
          for (let i = 0; i < a.length; i += 4)
            if (a.readUInt32LE(i) !== b.readUInt32LE(i)) {
              n++;
              if (a[i + 3] === 0) n0++;
              for (let k = 0; k < 4; k++) max = Math.max(max, Math.abs(a[i + k]! - b[i + k]!));
            }
          throw new Error(`${id} ${c.id}: the WebP isn't the PNG's pixels (${n} differ, ${n0} of them clear, by ${max} at most)`);
        }
        writeFileSync(`${SHEETS}/ride-${id}-${c.id}.webp`, webp);
        bytes += webp.length;
      }
      const s = first!;
      const seat = (a: number[][]) => `[${a.map(nums).join(", ")}]`;
      entries.push(
        `  ${JSON.stringify(id)}: {\n    id: ${JSON.stringify(id)},\n    w: ${s.w},\n    h: ${s.h},\n    cell: [${s.cell.join(", ")}],\n    top: ${s.top},\n    ms: { idle: ${nums(pose.ms.idle)}, move: ${nums(pose.ms.move)} },\n    seat: { idle: ${seat(pose.seat.idle)}, move: ${seat(pose.seat.move)} },\n    lift: ${nums(pose.lift)},\n    hash: "${rideHash(id)}",\n  },`,
      );
      console.log(`${id}: cells ${s.w} x ${s.h} px (${s.cell.join(", ")}), ${ITEM_COLORS.length} colors, ${(bytes / 1024).toFixed(0)} KB`);
    }
    writeFileSync(
      OUT,
      `// Generated by scripts/bake-rides.ts from packages/app/src/components/rides/*.tsx: don't edit by hand
// (npx tsx scripts/bake-rides.ts). Each ride's sheet in a color is ./rides/ride-<ride>-<color>.webp (lossless): rows idle back, idle front,
// move back, move front; a frame a column, ${"`w`"} x ${"`h`"} pixels each, at RIDE_PX pixels a unit of the pawn's square.

/** Pixels a unit of the pawn's 100 x 100 square in a sheet (the town's dressed pawns: PAWN_PX, 160 a pawn). */
export const RIDE_PX = 1.6;

/** A baked ride: what the town needs to play its frames with a pawn on it. */
export interface RideSheet {
  /** The ride's item id (crates.ts). */
  id: string;
  /** A cell's size in pixels, and its box on the pawn's square (x, y, w, h, in units): the same for every frame. */
  w: number;
  h: number;
  cell: readonly [number, number, number, number];
  /** The highest drawn row (pixels) of any idle frame, back or front. */
  top: number;
  /** Each frame's time (ms) as drawn. The town plays idle's as they are, and move's as shares of one square's step. */
  ms: { readonly idle: readonly number[]; readonly move: readonly number[] };
  /** Where the pawn sits on each frame, in units: x, y (its square moved), tilt (degrees, round its base) and cut (hidden below). */
  seat: { readonly idle: readonly (readonly number[])[]; readonly move: readonly (readonly number[])[] };
  /** The move's lift on each frame (units up: the hop). */
  lift: readonly number[];
  /** A hash of the ride's drawing, the paint's fills and lines, and the colors (the test checks it against them). */
  hash: string;
}

export const RIDE_SHEETS = {
${entries.join("\n")}
} as const satisfies Record<string, RideSheet>;
`,
    );
  } finally {
    await browser.close();
    await server.close();
  }
}

if (process.argv[1]?.endsWith("bake-rides.ts")) await main();
