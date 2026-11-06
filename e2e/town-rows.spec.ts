import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { asAdmin, test, lookDrag } from "./helpers.ts";

/**
 * The street town, round 4 (Nov 5; brief-town-rows.md): the rows on every street, the chase camera, the town that wraps east-west
 * only (the Colosseum at the north edge), the zoom steps and the park's step out. `STILLS=docs/street-town-rows` writes the stills
 * (`SHOTS=a,b` takes some of them). Round 5: the camera faces north (e2e/town-fixed.spec.ts), so looking along a street is a drag; the
 * stills here are round 4's (they walk along streets, which no longer turns the camera).
 */
test.use({ actionTimeout: 15_000 });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
});

const STILLS = process.env.STILLS;
const canvas = (p: Page) => p.locator("canvas.town-canvas");
const you = async (p: Page) => (await canvas(p).getAttribute("data-you"))!.split(",").map(Number) as [number, number];
type Cam = { heading: number; headingTo: number; zoom: number; zoomTarget: number; parkBefore: number | null };
type W = { __townWalk: (s: readonly [number, number]) => boolean; __townHeading: (h: number | null) => void; __townCam: () => Cam };
const cam = (page: Page) => page.evaluate(() => (window as unknown as W).__townCam());
const walkTo = async (page: Page, sq: readonly [number, number]) => {
  await page.evaluate((s) => (window as unknown as W).__townWalk(s), sq);
  await expect.poll(async () => (await you(page)).join(","), { message: `walked to ${sq}`, timeout: 60_000 }).toBe(sq.join(","));
};
/** Walks to `from`, then on to `to` (so the chase camera faces from one to the other), and waits for the camera to settle. */
const walkAlong = async (page: Page, from: readonly [number, number], to: readonly [number, number]) => {
  await walkTo(page, from);
  await walkTo(page, to);
  await expect.poll(async () => { const c = await cam(page); return c.heading === c.headingTo; }, { timeout: 5000 }).toBe(true);
};
async function open(page: Page, sky: string, gl: boolean) {
  await asAdmin(page);
  await page.goto(`/town?sky=${sky}${gl ? "&gl=1" : ""}`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
}

/** Every figure drawn (a boss, a bot, you) whole inside the world's box (Eric, Nov 4), its foot on screen; a faded one may be off. */
type Fig = { name: string; x0: number; y0: number; x1: number; y1: number; fy: number; alpha: number };
async function figuresOnScreen(page: Page, what: string) {
  const cv = (await canvas(page).boundingBox())!;
  const c = (await page.evaluate(() => (window as unknown as { __townCam: () => { figures: Fig[] } }).__townCam()))!;
  expect(c.figures.length, `${what}: figures drawn`).toBeGreaterThan(0);
  for (const f of c.figures) {
    if (f.alpha < 0.5) continue;
    expect(f.x0, `${what}: ${f.name} not cut off on the left`).toBeGreaterThanOrEqual(-1);
    expect(f.x1, `${what}: ${f.name} not cut off on the right`).toBeLessThanOrEqual(cv.width + 1);
    expect(f.y0, `${what}: ${f.name} not cut off at the top`).toBeGreaterThanOrEqual(-1);
    expect(f.fy, `${what}: ${f.name}'s foot on screen`).toBeLessThanOrEqual(cv.height + 1);
  }
}

/**
 * The share of the box's street-level band at its sides (the outer 15% of its width each side, from 8% of its height over the horizon to
 * just above it: the fronts' lower floors, not the sky over the farther, lower roofs) that's the sky's own colour: each row's sky taken from the middle of the box, where the street runs away to the sky. Sky between
 * two fronts (a gap, a missing front, a crack) shows there as that colour.
 */
async function skyAtSides(page: Page): Promise<number> {
  const hy = (await page.evaluate(() => (window as unknown as { __townCam: () => { horizon: number } }).__townCam().horizon))!;
  return canvas(page).evaluate((cv: HTMLCanvasElement, hy: number) => {
    const dpr = cv.width / cv.clientWidth;
    const W = cv.width;
    const H = cv.clientHeight;
    const y0 = Math.round((hy - 0.08 * H) * dpr);
    const y1 = Math.round((hy - 0.01 * H) * dpr);
    const d = cv.getContext("2d")!.getImageData(0, y0, W, y1 - y0).data;
    let sky = 0;
    let n = 0;
    for (let y = 0; y < y1 - y0; y++) {
      // The sky's colour on this row: the middle few pixels' (where the street opens to it).
      const m = (y * W + Math.round(W / 2)) * 4;
      const ref = [d[m]!, d[m + 1]!, d[m + 2]!];
      for (let x = 0; x < W; x++) {
        if (x > W * 0.15 && x < W * 0.85) continue;
        const k = (y * W + x) * 4;
        n++;
        if (Math.abs(d[k]! - ref[0]!) + Math.abs(d[k + 1]! - ref[1]!) + Math.abs(d[k + 2]! - ref[2]!) < 12) sky++;
      }
    }
    return sky / n;
  }, hy);
}

/** (Round 5) A drag across the box from its middle, `share` of its width (negative: leftward): a look round, half a turn a width. */
async function drag(page: Page, share: number) {
  // (The press and its first move together, so a slow frame can't make it a hold to run: helpers.ts lookDrag.)
  await lookDrag(page, (await canvas(page).boundingBox())!, share);
}

// (Round 5: the camera faces north; a drag looks round. Looking along a street both ways is a drag a quarter turn each way, from where
// round 4 walked along it.)
test("no sky between the fronts at street level: Fountain Street and South Street, looking both ways along each (Canvas 2D and WebGL)", async ({ page }) => {
  test.setTimeout(400_000);
  for (const gl of [false, true]) {
    await open(page, "day", gl);
    // (Street level: the mockup's step, 1. The town opens a step further out since Nov 5, which sees over the rows.)
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect.poll(async () => (await cam(page)).zoom, { timeout: 3000 }).toBe(1);
    for (const [name, sq, look] of [["Fountain Street east", [4, 28], 0.5], ["Fountain Street west", [39, 28], -0.5], ["South Street east", [4, 13], 0.5], ["South Street west", [39, 13], -0.5]] as const) {
      await walkTo(page, sq);
      await expect.poll(async () => (await cam(page)).heading, { timeout: 5000 }).toBe(0);
      await drag(page, look);
      await page.waitForTimeout(800);
      expect(Math.abs((await cam(page)).heading), `${name}: looking a quarter round`).toBeGreaterThan(80);
      const share = await skyAtSides(page);
      expect(share, `${name} (${gl ? "WebGL" : "2D"}): sky at the sides at street level`).toBeLessThan(0.005);
    }
  }
});

test("the zoom steps: − and + move a step at a time (in, the mockup's, out (the default since Nov 5), the overview); every figure on screen at each", async ({ page }) => {
  test.setTimeout(200_000);
  await open(page, "day", false);
  await walkAlong(page, [1, 28], [4, 28]);
  // (Eric, Nov 5: "we're going with number three for the default": the town opens at step 2.)
  expect((await cam(page)).zoomTarget).toBe(2);
  for (let k = 0; k < 2; k++) await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(async () => (await cam(page)).zoom, { timeout: 3000 }).toBe(0);
  await figuresOnScreen(page, "in");
  for (const step of [1, 2, 3]) {
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect.poll(async () => (await cam(page)).zoom, { timeout: 3000 }).toBe(step);
    await figuresOnScreen(page, `step ${step}`);
  }
  await page.getByRole("button", { name: "Zoom out" }).click();
  expect((await cam(page)).zoomTarget, "the overview is the last").toBe(3);
  await expect(page.getByRole("button", { name: "Zoom out" })).toHaveAttribute("aria-pressed", "true");
  for (let k = 0; k < 2; k++) await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(async () => (await cam(page)).zoom, { timeout: 3000 }).toBe(1);
  await expect(page.getByRole("button", { name: "Zoom in" })).toHaveAttribute("aria-pressed", "true");
});

test("the park zooms a step out as you come in and back as you leave; a press in it wins", async ({ page }) => {
  test.setTimeout(200_000);
  await open(page, "day", false);
  await walkAlong(page, [6, 28], [9, 28]);
  // (The default since Nov 5: step 2, so the park's step out is to the overview, 3.)
  expect((await cam(page)).zoomTarget).toBe(2);
  // In (fully: a square past its edge), out a step over about 0.6 s; you and every figure on screen.
  await walkTo(page, [16, 28]);
  await expect.poll(async () => (await cam(page)).zoom, { timeout: 3000 }).toBe(3);
  expect((await cam(page)).parkBefore).toBe(2);
  await figuresOnScreen(page, "in the park");
  // Out again: back to the step you had.
  await walkTo(page, [9, 28]);
  await expect.poll(async () => (await cam(page)).zoom, { timeout: 3000 }).toBe(2);
  // In again, and + twice in the park: your step stays as you leave (not the 2 you came in with).
  await walkTo(page, [16, 28]);
  await expect.poll(async () => (await cam(page)).zoomTarget, { timeout: 3000 }).toBe(3);
  for (let k = 0; k < 2; k++) await page.getByRole("button", { name: "Zoom in" }).click();
  await walkTo(page, [9, 28]);
  await page.waitForTimeout(800);
  expect((await cam(page)).zoomTarget, "your press in the park wins").toBe(1);
});

// (Round 5: "the north edge holds you" went with the plaza beside the Colosseum: e2e/town-fixed.spec.ts "the Colosseum against the back
// wall" walks up to it and is stopped beside it.)

/** The stills (brief: each street by day, one at dusk, a corner, a boss home in its row, the turn; the park on arrival; the zoom steps). */
test("stills: the rows (round 4)", async ({ page }) => {
  test.skip(!STILLS, "stills only (STILLS=docs/street-town-rows)");
  test.setTimeout(900_000);
  mkdirSync(STILLS!, { recursive: true });
  const project = test.info().project.name;
  const only = (process.env.SHOTS ?? "").split(",").filter(Boolean);
  const want = (n: string) => !only.length || only.includes(n);
  const shot = async (name: string) => {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${STILLS}/${name}-${project}.png` });
  };
  // (The default renderer, Canvas 2D, as Eric sees it; STILLS_GL=1 for WebGL, as the mockup's.)
  const gl = process.env.STILLS_GL === "1";
  await open(page, "day", gl);
  // Each street by day, walking along it (the chase camera behind you).
  const streets: [string, readonly [number, number], readonly [number, number]][] = [
    ["1-south-street", [1, 13], [4, 13]],
    ["2-fountain-street", [1, 28], [4, 28]],
    ["3-colosseum-row", [1, 36], [4, 36]],
    ["4-meadow-street", [40, 5], [36, 5]],
    ["5-seam-avenue", [0, 17], [0, 20]],
  ];
  for (const [name, a, b] of streets) {
    if (!want(name)) continue;
    await walkAlong(page, a, b);
    await shot(name);
  }
  if (want("6-boss-home")) {
    // Sawyer's woodshed in Fountain Street's north row, walking up to it.
    await walkAlong(page, [10, 27], [10, 31]);
    await shot("6-boss-home-in-its-row");
  }
  if (want("7-corner")) {
    // The corner of Seam Avenue and Fountain Street, the camera midway through the turn east (held).
    await walkAlong(page, [0, 34], [0, 29]);
    await page.evaluate(() => (window as unknown as W).__townHeading(135));
    await shot("7-corner-mid-turn");
    await page.evaluate(() => (window as unknown as W).__townHeading(null));
  }
  if (want("8-plaza")) {
    // Up the promenade into the Colosseum's plaza at the north edge.
    await walkAlong(page, [22, 35], [22, 40]);
    await shot("8-colosseum-plaza");
  }
  if (want("9-park")) {
    // Into the park from Fountain Street: the camera eases a step out as you arrive.
    await walkAlong(page, [6, 28], [10, 28]);
    await walkTo(page, [16, 28]);
    await expect.poll(async () => (await cam(page)).zoom, { timeout: 5000 }).toBe(2);
    await shot("9-park-on-arrival");
  }
  if (want("10-zoom")) {
    await walkAlong(page, [1, 28], [4, 28]);
    const steps = ["in", "default", "out", "overview"];
    await page.getByRole("button", { name: "Zoom in" }).click();
    await shot("10-zoom-0-in");
    for (let k = 1; k < 4; k++) {
      await page.getByRole("button", { name: "Zoom out" }).click();
      await shot(`10-zoom-${k}-${steps[k]}`);
    }
    for (let k = 0; k < 2; k++) await page.getByRole("button", { name: "Zoom in" }).click();
  }
  if (want("11-dusk")) {
    await open(page, "dusk", gl);
    await walkAlong(page, [1, 28], [4, 28]);
    await shot("11-fountain-street-dusk");
  }
});
