import { type Page } from "@playwright/test";
import { test } from "./helpers.ts";
import { writeFileSync } from "node:fs";
// Reuse the probe's into() by import.
import { intoScreen } from "./_probe-into.ts";

async function geom(page: Page, menu: string) {
  return page.evaluate((menu) => {
    document.getElementById("probe-menu")?.remove();
    if (menu) document.head.insertAdjacentHTML("beforeend", `<style id="probe-menu">.gm-frame { --gm-menu: ${menu} !important; }</style>`);
    const r = (q: string) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), Math.round(b.top), Math.round(b.bottom)]; };
    const scr = document.querySelector(".screen.game")!;
    const cs = getComputedStyle(scr);
    const em = document.querySelector(".qchat [aria-label=Emoji]");
    const chips = em ? [...em.children].map((c) => Math.round(c.getBoundingClientRect().width * 10) / 10) : [];
    return { win: innerWidth, side: r(".gm-frame > .fd-side"), main: r(".gm-main"), tower: r(".tower-side"), towerSpace: r(".tower-space"), screen: r(".screen.game"), area: r(".board-area"), board: r(".board-area .board-row > .board-wrap"), chat: r(".qchat"), under: r(".screen.game > .under-board"), dvside: r(".dv-side"), sq: r(".sq-panel"), mv: r(".mv-side"), cols: cs.gridTemplateColumns, pad: cs.paddingLeft + "/" + cs.paddingRight, gap: cs.columnGap, chips, vars: ["--scr", "--side-w", "--gutter", "--bd-h", "--scr-need", "--win-w"].map((v) => v + "=" + cs.getPropertyValue(v)) };
  }, menu);
}
const SCREENS = (process.env.PROBE_SCREENS ?? "crowd").split(",") as any[];
for (const screen of SCREENS)
  test(`geom ${screen}`, async ({ browser }) => {
    test.setTimeout(10 * 60_000);
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 730 }, deviceScaleFactor: 1.25, isMobile: false, hasTouch: false });
    const page = await ctx.newPage();
    await intoScreen(page, screen);
    await page.waitForTimeout(500);
    const out = { icons: await geom(page, "80px"), labels: await geom(page, "232px") };
    writeFileSync(`${process.env.PROBE_OUT}/geom-${screen}.json`, JSON.stringify(out, null, 1));
  });
