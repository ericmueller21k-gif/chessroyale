import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { asAdmin, test } from "./helpers.ts";

/**
 * The street town, round 4 (Nov 5; brief-town-rows.md): the rows and the chase camera. The mockup's stills (`STILLS=docs/street-town-rows/mockup`),
 * drawn with WebGL: Fountain Street (both sides) close and zoomed out, by day and at dusk; a corner mid-swing; the Colosseum seen down a
 * street that opens onto it, and hidden by the rows.
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
type W = { __townWalk: (s: readonly [number, number]) => boolean; __townHeading: (h: number | null) => void; __townCam: () => { heading: number; headingTo: number } };
const walkTo = async (page: Page, sq: readonly [number, number]) => {
  await page.evaluate((s) => (window as unknown as W).__townWalk(s), sq);
  await expect.poll(async () => (await you(page)).join(","), { message: `walked to ${sq}`, timeout: 60_000 }).toBe(sq.join(","));
};
async function open(page: Page, sky: string) {
  await asAdmin(page);
  await page.goto(`/town?sky=${sky}&gl=1`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
}

test("stills: the rows mockup (round 4)", async ({ page }) => {
  test.skip(!STILLS, "stills only (STILLS=docs/street-town-rows/mockup)");
  test.setTimeout(600_000);
  mkdirSync(STILLS!, { recursive: true });
  const project = test.info().project.name;
  const only = (process.env.SHOTS ?? "").split(",").filter(Boolean);
  const want = (n: string) => !only.length || only.includes(n);
  const shot = async (name: string) => {
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${STILLS}/${name}-${project}.png` });
  };
  // Fountain Street, looking east along it from its west end (the chase camera behind you as you walk east), close; then zoomed out.
  for (const sky of ["day", "dusk"]) {
    if (!want(`fountain-${sky}`)) continue;
    await open(page, sky);
    await walkTo(page, [1, 14]);
    await walkTo(page, [4, 14]);
    await expect.poll(async () => (await page.evaluate(() => (window as unknown as W).__townCam().heading)), { timeout: 5000 }).toBe(90);
    await shot(`1-fountain-street-close-${sky}`);
    if (sky === "day") {
      await page.getByRole("button", { name: "Zoom out" }).click();
      await shot(`2-fountain-street-far-${sky}`);
      await page.getByRole("button", { name: "Zoom in" }).click();
    }
  }
  if (want("corner")) {
    // A corner mid-swing: down Seam Avenue (south) into Fountain Street's crossing, turning east (held halfway).
    await open(page, "day");
    await walkTo(page, [0, 20]);
    await walkTo(page, [0, 14]);
    await page.evaluate(() => (window as unknown as W).__townHeading(135));
    await shot("3-corner-mid-turn");
    await page.evaluate(() => (window as unknown as W).__townHeading(null));
  }
  if (want("colosseum")) {
    // The Colosseum: seen down the park's promenade, which opens onto it; hidden from Fountain Street by its north row.
    await open(page, "day");
    await walkTo(page, [22, 13]);
    await walkTo(page, [22, 17]);
    await shot("4-colosseum-seen");
    await walkTo(page, [8, 13]);
    await walkTo(page, [8, 15]);
    await shot("5-colosseum-hidden");
  }
});
