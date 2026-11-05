import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { asAdmin, test } from "./helpers.ts";

/**
 * The street town, round 4 (Nov 5; brief-town-rows.md): the rows on every street, the chase camera, the town that wraps east-west
 * only (the Colosseum at the north edge), the zoom steps and the park's step out. `STILLS=docs/street-town-rows` writes the stills
 * (`SHOTS=a,b` takes some of them).
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
  const gl = process.env.STILLS_2D !== "1";
  await open(page, "day", gl);
  // Each street by day, walking along it (the chase camera behind you).
  const streets: [string, readonly [number, number], readonly [number, number]][] = [
    ["1-south-street", [1, 5], [4, 5]],
    ["2-fountain-street", [1, 20], [4, 20]],
    ["3-colosseum-row", [1, 28], [4, 28]],
    ["4-upper-street", [40, 37], [36, 37]],
    ["5-seam-avenue", [0, 9], [0, 12]],
  ];
  for (const [name, a, b] of streets) {
    if (!want(name)) continue;
    await walkAlong(page, a, b);
    await shot(name);
  }
  if (want("6-boss-home")) {
    // Sawyer's woodshed in Fountain Street's north row, walking up to it.
    await walkAlong(page, [10, 19], [10, 23]);
    await shot("6-boss-home-in-its-row");
  }
  if (want("7-corner")) {
    // The corner of Seam Avenue and Fountain Street, the camera midway through the turn east (held).
    await walkAlong(page, [0, 26], [0, 21]);
    await page.evaluate(() => (window as unknown as W).__townHeading(135));
    await shot("7-corner-mid-turn");
    await page.evaluate(() => (window as unknown as W).__townHeading(null));
  }
  if (want("8-plaza")) {
    // Up the promenade into the Colosseum's plaza at the north edge.
    await walkAlong(page, [22, 27], [22, 31]);
    await shot("8-colosseum-plaza");
  }
  if (want("9-park")) {
    // Into the park from Fountain Street: the camera eases a step out as you arrive.
    await walkAlong(page, [6, 20], [10, 20]);
    await walkTo(page, [16, 20]);
    await expect.poll(async () => (await cam(page)).zoom, { timeout: 5000 }).toBe(2);
    await shot("9-park-on-arrival");
  }
  if (want("10-zoom")) {
    await walkAlong(page, [1, 20], [4, 20]);
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
    await walkAlong(page, [1, 20], [4, 20]);
    await shot("11-fountain-street-dusk");
  }
});
