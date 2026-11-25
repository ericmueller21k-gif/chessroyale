import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";
import { intoScreen } from "./_probe-into.ts";
import { writeFileSync } from "node:fs";
const OUT = process.env.PROBE_OUT!;
async function geom(page: Page) {
  return page.evaluate(() => {
    const r = (q: string) => { const e = [...document.querySelectorAll(q)].find((x) => x.getBoundingClientRect().width > 0); if (!e) return null; const b = e.getBoundingClientRect(); return { l: +b.left.toFixed(2), r: +b.right.toFixed(2), t: +b.top.toFixed(2), b: +b.bottom.toFixed(2) }; };
    return {
      win: [innerWidth, innerHeight], labels: document.querySelector(".gm-frame")!.classList.contains("gm-labels"),
      frame: r(".gm-frame"), menu: r(".gm-frame > .fd-side"), main: r(".gm-main"), screen: r(".screen.game"), area: r(".board-area"),
      wrap: r(".board-area .board-row > .board-wrap"), board: r(".board-area .board-row > .board-wrap .hb-container"),
      them: r(".dv-strip.dv-them"), you: r(".dv-strip.dv-you"), side: r(".dv-side"), box: r(".dv-side > .dv-box"), gear: r(".dv-gear"),
      kids: [...(document.querySelector(".dv-side > .dv-box")?.children ?? [])].map((c) => { const b = c.getBoundingClientRect(); return `${c.className.split(" ")[0]} ${b.top.toFixed(1)}-${b.bottom.toFixed(1)} ${b.left.toFixed(1)}-${b.right.toFixed(1)}`; }),
    };
  });
}
const SIZES: [number, number, number][] = [[1536, 730, 1.25], [1920, 960, 1], [1858, 1040, 1]];
for (const [w, h, sc] of SIZES)
  test(`duel geom ${w}x${h}`, async ({ browser }) => {
    test.setTimeout(5 * 60_000);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: sc, isMobile: false, hasTouch: false });
    const page = await ctx.newPage();
    await intoScreen(page, "duel");
    await page.waitForTimeout(800);
    const play = await geom(page);
    if (process.env.SHOTS) await page.screenshot({ path: `${OUT}/duel-play-${w}x${h}.png` });
    await page.getByRole("button", { name: "Match options" }).click();
    await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^Resign$/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /Resign/ }).click();
    await expect(page.locator(".dv-ended")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2500);
    const end = await geom(page);
    if (process.env.SHOTS) await page.screenshot({ path: `${OUT}/duel-end-${w}x${h}.png` });
    writeFileSync(`${OUT}/duelgeom-${w}x${h}.json`, JSON.stringify({ play, end }, null, 1));
    await ctx.close();
  });
