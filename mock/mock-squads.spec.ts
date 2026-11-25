import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { named, test } from "./helpers.ts";
// The Squads frame's mock (Nov 26): main's live screen with the frame's CSS injected (board-size.css as on the branch), board-foot.ts's
// measurement done by hand, the gray "Waiting…" and the votes' list added to the DOM. 1536 × 730 at 125%, Eric's laptop.
const CSS = readFileSync("packages/app/src/board-size.css", "utf8");
const SHOTS = process.env.SHOTS!;
async function foot(page: Page) {
  await page.evaluate(() => {
    const arena = document.querySelector<HTMLElement>(".arena")!;
    const b = arena.querySelector(".board-area .board-row > .board-wrap .hb-container")!.getBoundingClientRect();
    const f = b.bottom + 6;
    const side = arena.querySelector<HTMLElement>(":scope > .tower-side")!;
    const row = side.querySelector(".sq-row")!;
    const pad = parseFloat(getComputedStyle(side).paddingTop);
    arena.style.setProperty("--side-pad", `${Math.round(pad + b.top - row.getBoundingClientRect().top)}px`);
    arena.style.setProperty("--side-foot", `${Math.round(f - side.getBoundingClientRect().top)}px`);
    const col = arena.querySelector(":scope > .screen.game > :is(.sq-panel, .sq-votes)");
    if (col) arena.style.setProperty("--chat-foot", `${Math.round(f - col.getBoundingClientRect().top)}px`);
  });
}
for (const fmt of ["pairs", "relay", "vote"] as const)
  test(`mock squads ${fmt}`, async ({ browser }) => {
    test.setTimeout(200_000);
    const page = await (await browser.newContext({ viewport: { width: 1536, height: 730 }, deviceScaleFactor: 1.25 })).newPage();
    await named(page, "Wide Window");
    await page.goto(fmt === "vote" ? "/squads/test?nolanding&debug&clock=90,0,3,0" : `/squads/test/${fmt}?nolanding&debug&clock=90,0,3,0`);
    if (fmt === "vote") await expect(page.getByRole("button", { name: "Skip votes" })).toBeVisible({ timeout: 60_000 });
    else {
      await page.getByRole("button", { name: "Skip votes" }).click({ timeout: 40_000 });
      await expect(page.locator(".sq-game .board-area .board-wrap")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(9000);
    }
    await page.addStyleTag({ content: CSS });
    await page.evaluate((fmt) => {
      const scr = document.querySelector(".screen.game")!;
      if (fmt === "vote") {
        scr.classList.add("cf-vote");
        const box = document.createElement("section");
        box.className = "sq-votes";
        box.innerHTML = `<ol class="sq-votes-list"><li class="on"><i>1</i>Which mode?</li><li><i>2</i>How do the boards start?</li><li><i>3</i>How fast?</li><li class="end"><i>→</i>The bracket is drawn</li></ol>`;
        scr.append(box);
      } else if (fmt === "pairs" && !document.querySelector(".sq-duty")) {
        const idle = document.createElement("div");
        idle.className = "waiting-banner slot-idle";
        idle.innerHTML = "<i></i>Waiting…";
        document.querySelector(".sq-panel")!.prepend(idle);
      }
    }, fmt);
    await page.waitForTimeout(300);
    await foot(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/mock-squads-${fmt}-1536x730.png` });
  });
