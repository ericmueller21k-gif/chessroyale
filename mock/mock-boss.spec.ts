import { expect, type Page } from "@playwright/test";
import { bossAloneFromHome, named, openBossRaid, test } from "./helpers.ts";
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const SIZES = (process.env.SIZES ?? "1536x730x1.25,1920x960x1").split(",").map((s) => s.split("x").map(Number));
const MODES = (process.env.MODES ?? "alone,raid").split(",");
for (const mode of MODES)
  for (const [w, h, sc] of SIZES)
    test(`look ${mode} ${w}x${h}`, async ({ browser }) => {
      test.skip(test.info().project.name !== "desktop");
      test.setTimeout(400_000);
      const page = await (await browser.newContext({ viewport: { width: w!, height: h! }, deviceScaleFactor: sc })).newPage();
      await named(page, "Wide Window");
      await page.goto(`/?debug&pace=quick&clock=60&laststand=0&boss=${process.env.BOSS ?? "gardener"}`);
      if (mode === "raid") {
        await openBossRaid(page);
        await page.getByRole("button", { name: /^Play with bots/ }).click();
      } else await bossAloneFromHome(page);
      await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
      await page.waitForTimeout(1500);
      if (process.env.CSS) {
        await page.addStyleTag({ path: process.env.CSS });
        await page.evaluate(() => { document.querySelector(".arena > .screen.game")!.classList.add("bf-frame"); dispatchEvent(new Event("resize")); });
        await page.waitForTimeout(800);
        await page.evaluate(() => dispatchEvent(new Event("resize")));
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${process.env.SHOTS}/${process.env.TAG ?? "now"}-${mode}-${w}x${h}.png` });
      const g = await page.evaluate(() => {
        const r = (s: string) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map((v) => Math.round(v * 10) / 10); };
        return { board: r(".board-area .board-row > .board-wrap .hb-container"), bar: r(".screen.game > .boss-bar"), moves: r(".mv-side"), tools: r(".screen.game > .gm-tools"), score: r(".arena > .tower-side"), table: r(".arena > .tower-side > .tower"), canvas: r(".boss-dock .gk-canvas"), bossChar: r(".boss-char.place-side"), kk: getComputedStyle(document.querySelector(".screen.game")!).getPropertyValue("--king-k"), ss: getComputedStyle(document.querySelector(".screen.game")!).getPropertyValue("--side-s"), labels: document.querySelector(".gm-frame")!.className, space: r(".arena > .tower-space"), king: r(".boss-dock .gk-unit"), pawn: r(".boss-dock .you-pawn"), boss: r(".boss-side"), row: r(".boss-dock-main"), footer: r(".screen.game > .play-footer"), chat: r(".screen.game > .under-board"), menu: r(".gm-frame > .fd-side"), screen: r(".screen.game"), arena: r(".arena"), scroll: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight] };
      });
      console.log(mode, w, h, JSON.stringify(g));
    });
