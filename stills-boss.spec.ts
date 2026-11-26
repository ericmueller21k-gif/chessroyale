import { devices, expect, type Page } from "@playwright/test";
import { bossAloneFromHome, named, openBossRaid, test } from "./helpers.ts";
// The boss frame's stills (Nov 26): Boss alone and a bot raid on main's build of the branch, at Eric's laptop (1536 × 730 at 125%), a
// desktop (1920 × 960), 1858 × 1040, and the phone (390 × 844, unchanged). Puddles, at your first move.
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const SIZES = [["1536x730", 1536, 730, 1.25], ["1920x960", 1920, 960, 1], ["1858x1040", 1858, 1040, 1], ["phone-390x844", 390, 844, 0]] as const;
for (const mode of ["alone", "raid"] as const)
  for (const [name, w, h, sc] of SIZES)
    test(`still ${mode} ${name}`, async ({ browser }) => {
      test.skip(test.info().project.name !== "desktop");
      test.setTimeout(300_000);
      const ctx = sc ? await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: sc }) : await browser.newContext({ ...devices["iPhone 13"], viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await named(page, "Wide Window");
      await page.goto(`/?debug&pace=quick&clock=60&laststand=0&boss=gardener`);
      if (mode === "raid") {
        await openBossRaid(page);
        await page.getByRole("button", { name: /^Play with bots/ }).click();
      } else await bossAloneFromHome(page);
      await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${process.env.SHOTS}/boss-${mode}-${name}.png` });
      await ctx.close();
    });
