import { devices, expect } from "@playwright/test";
import { named, test } from "./helpers.ts";
const SHOTS = process.env.SHOTS!;
const go = async (page: import("@playwright/test").Page, fmt: string) => {
  await named(page, "Wide Window");
  await page.goto(fmt === "vote" ? "/squads/test?nolanding&debug&clock=90,0,3,0" : `/squads/test/${fmt}?nolanding&debug&clock=90,0,3,0`);
  if (fmt === "vote") await expect(page.getByRole("button", { name: "Skip votes" })).toBeVisible({ timeout: 60_000 });
  else {
    await page.getByRole("button", { name: "Skip votes" }).click({ timeout: 40_000 });
    await expect(page.locator(".sq-game .board-area .board-wrap")).toBeVisible({ timeout: 30_000 });
  }
};
for (const fmt of ["pairs", "relay", "vote"])
  for (const [w, h, sc] of [[1536, 730, 1.25], [1920, 960, 1], [1858, 1040, 1]] as const)
    test(`stills squads ${fmt} ${w}x${h}`, async ({ browser }) => {
      test.setTimeout(200_000);
      const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: sc })).newPage();
      await go(page, fmt);
      if (fmt !== "vote") {
        // (Your pick or move on: the panel's pick, or the gray "Waiting…" between.)
        await page.waitForTimeout(9000);
      } else await page.waitForTimeout(2500);
      await page.screenshot({ path: `${SHOTS}/squads-${fmt}-${w}x${h}.png` });
    });
for (const fmt of ["pairs", "relay"])
  test(`stills squads phone ${fmt}`, async ({ browser }) => {
    test.setTimeout(200_000);
    const page = await (await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 } })).newPage();
    await go(page, fmt);
    await page.waitForTimeout(9000);
    await page.screenshot({ path: `${SHOTS}/squads-phone-${fmt}-390x844.png` });
  });
