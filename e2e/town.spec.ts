import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * The town square (/town; hidden: docs/areas/town-square.md), on a phone and a computer: the page loads, its world is
 * drawn (not blank), a tap a few rows ahead walks you toward it, the zoom pair works (it opens zoomed out), back goes
 * home, and `?sky=` picks the sky's look whatever the clock says.
 * Test hooks: the canvas carries `data-you="c,r"` (your square) and `data-ready="1"` once its first frame is drawn.
 */
test.use({ actionTimeout: 15_000 });

/** Every page error and console error of a test: none may happen. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

const canvas = (p: Page) => p.locator("canvas.town-canvas");
const you = async (p: Page) => (await canvas(p).getAttribute("data-you"))!.split(",").map(Number) as [number, number];

/** How many distinct colors a sample of the canvas holds (a blank or one-color canvas has one or two). */
const colors = (p: Page) =>
  canvas(p).evaluate((cv: HTMLCanvasElement) => {
    const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    return seen.size;
  });

/** A small fingerprint of what the canvas shows now. */
const fingerprint = (p: Page) =>
  canvas(p).evaluate((cv: HTMLCanvasElement) => {
    const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 4 * 211) h = (Math.imul(h, 31) + d[i]! + d[i + 1]! * 7 + d[i + 2]! * 13) | 0;
    return h;
  });

test("the town square at /town: the world is drawn and fills its box under the bar; a tap a few rows ahead walks you there; the zoom pair works; back goes home", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/town");
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  expect(await colors(page), "the world is drawn, not blank").toBeGreaterThan(40);

  // The world fills the rest of the screen under the bar, phone or computer.
  const vp = page.viewportSize()!;
  const bar = (await page.locator(".town-bar").boundingBox())!;
  const cv = (await canvas(page).boundingBox())!;
  expect(Math.abs(cv.y - (bar.y + bar.height)), "the world starts right under the bar").toBeLessThanOrEqual(1.5);
  expect(Math.abs(cv.width - vp.width), "as wide as the screen").toBeLessThanOrEqual(1);
  expect(Math.abs(cv.y + cv.height - vp.height), "down to the screen's foot").toBeLessThanOrEqual(1);

  // A tap straight ahead, a third of the way down the world (several rows up from your pawn on either shape of box),
  // walks you that way: your row grows (to a square, or next to a bot or a home standing there).
  const [, r0] = await you(page);
  await page.mouse.click(cv.x + cv.width / 2, cv.y + cv.height / 3);
  await expect.poll(async () => (await you(page))[1], { message: "you walk ahead", timeout: 5000 }).toBeGreaterThanOrEqual(r0 + 2);

  // The zoom pair: the page opens zoomed out (− pressed; Eric, Oct 26); + zooms in (and the view changes), − back out.
  const zoomOut = page.getByRole("button", { name: "Zoom out" });
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  await expect(zoomOut).toHaveAttribute("aria-pressed", "true");
  await expect(zoomIn).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(1200); // (the walk and the camera settle)
  const before = await fingerprint(page);
  await zoomIn.click();
  await expect(zoomIn).toHaveAttribute("aria-pressed", "true");
  await expect(zoomOut).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => fingerprint(page), { message: "the view zooms in" }).not.toBe(before);
  await zoomOut.click();
  await expect(zoomOut).toHaveAttribute("aria-pressed", "true");
  // The controls stay put whatever the zoom (nothing shifts).
  await expect(page.getByRole("button", { name: "Back to me" })).toBeVisible();

  // Back goes home, and the address back to /.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  expect(errors).toEqual([]);
});

/** The sky's average color across a strip at the top of the canvas, middle third (CSS pixels 2 to 8 down). */
const skyTop = (p: Page) =>
  canvas(p).evaluate((cv: HTMLCanvasElement) => {
    const k = cv.width / cv.clientWidth;
    const d = cv.getContext("2d")!.getImageData(Math.round(cv.width / 3), Math.round(2 * k), Math.round(cv.width / 3), Math.round(6 * k)).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) ((r += d[i]!), (g += d[i + 1]!), (b += d[i + 2]!));
    const n = d.length / 4;
    return [r / n, g / n, b / n];
  });

test("the sky by the time of day: ?sky=day and ?sky=night draw different skies (a day's top is light blue, a night's deep navy)", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  const day = await skyTop(page);
  await page.goto("/town?sky=night");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  const night = await skyTop(page);
  const lum = ([r, g, b]: number[]) => 0.3 * r! + 0.59 * g! + 0.11 * b!;
  expect(day[2]!, `day's sky is blue: ${day.map(Math.round)}`).toBeGreaterThan(200);
  expect(lum(night), `night's sky is dark: ${night.map(Math.round)}`).toBeLessThan(40);
  expect(lum(day) - lum(night), "day is far lighter than night").toBeGreaterThan(100);
  expect(errors).toEqual([]);
});
