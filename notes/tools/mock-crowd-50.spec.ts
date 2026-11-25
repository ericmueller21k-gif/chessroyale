import { expect, type Page } from "@playwright/test";
import { BOARD_SEL, named, soloFromHome, test } from "./helpers.ts";
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const CSS = `
@media (min-width: 900px) {
  .screen.game.crowd-50 { --bd-room: ${process.env.ROOM ?? 140}px; --side-w: ${process.env.RW ?? 300}px !important; --gutter: 14px !important;
    --scr: calc(var(--bd-h) + var(--side-w) + 2 * var(--gutter) + 28px) !important; }
  .arena:not(.sq-arena):has(> .screen.game.crowd-50) > .tower-side { flex: 0 0 ${process.env.LW ?? 340}px !important; }
  .arena:has(> .screen.game.crowd-50) { width: fit-content !important; margin-inline: auto !important; gap: 15px !important; }
  .screen.game.crowd-50 > .hud-row { grid-column: 1 / -1 !important; }
  .screen.game.crowd-50 > .hud-row > .hud { margin: 0 !important; padding: 0 calc(var(--side-w) + 2 * var(--gutter)) 0 0 !important; }
  .screen.game.crowd-50 > .hud-row > .mm { position: absolute !important; right: 0 !important; left: auto !important; }
}`;
for (const [w, h, sc] of [[1536, 730, 1.25], [1920, 960, 1]] as const)
  test(`mock crowd ${w}x${h}`, async ({ browser }) => {
    test.setTimeout(400_000);
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: sc })).newPage();
    await named(page, "Wide Window");
    await page.goto("/?debug&pace=quick&mode=crowd&rounds=2&clock=60&augments=0");
    await soloFromHome(page);
    await expect.poll(() => phase(page), { timeout: 120_000 }).toMatch(/^(play|watching)$/);
    await page.waitForTimeout(1500);
    const shot = process.env.SHOTS!;
    await page.screenshot({ path: `${shot}/crowd-${w}x${h}-before.png` });
    await page.addStyleTag({ content: CSS });
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${shot}/crowd-${w}x${h}-after.png` });
    const m = await page.evaluate((sel) => {
      const cl = document.querySelector(".screen.game.crowd-50 > .play-footer, .screen.game.crowd-50 > .poll")!.getBoundingClientRect();
      const r = (q: string) => document.querySelector(q)?.getBoundingClientRect();
      const b = r(`.board-area .board-row > .board-wrap ${sel}`)!, l = r(".tower-side")!, c = r(".screen.game.crowd-50 > .under-board.side") ?? r(".screen.game.crowd-50 > .play-footer")!;
      return { board: Math.round(b.width), top: Math.round(b.top), foot: Math.round(b.bottom), leftGap: Math.round(b.left - l.right), rightGap: Math.round(cl.left - b.right), pw: Math.round(document.querySelector(".history-nav, .power-row")?.getBoundingClientRect().bottom ?? -1), lTop: Math.round(l.top), lFoot: Math.round(l.bottom), cFoot: Math.round(c.bottom) };
    }, BOARD_SEL.container);
    console.log("MEASURE", w, h, JSON.stringify(m));
  });
