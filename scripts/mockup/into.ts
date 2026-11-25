import { expect, type Page } from "@playwright/test";
import { BOARD_SEL, bossAloneFromHome, named, openBossRaid, soloFromHome } from "../../e2e/helpers.ts";

/** Into each game screen at the board (desktop-board.spec.ts' way in, copied for the mockup's stills). */
export const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
export type Screen = "alone" | "raid" | "crowd" | "vote" | "duel" | "squads";
/** Into each screen at the board, as a player gets there. */
export async function into(page: Page, screen: Screen) {
  await named(page, "Wide Window");
  if (screen === "alone" || screen === "raid") {
    await page.goto("/?debug&pace=quick&clock=60&laststand=0&boss=gardener");
    if (screen === "raid") {
      await openBossRaid(page);
      await page.getByRole("button", { name: /^Play with bots/ }).click();
    } else await bossAloneFromHome(page);
    await expect.poll(() => phase(page), { timeout: 120_000 }).toBe("play");
  } else if (screen === "crowd" || screen === "vote") {
    await page.goto(screen === "vote" ? "/?debug&mode=crowd&augments=1" : "/?debug&pace=quick&mode=crowd&rounds=2&clock=60&augments=0");
    await soloFromHome(page);
    await expect.poll(() => phase(page), { timeout: 120_000 }).toMatch(screen === "vote" ? /^vote$/ : /^(play|watching)$/);
  } else if (screen === "duel") {
    await page.goto(`/1v1?nolanding&pool=wide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}&fewAfter=2`);
    await page.locator(".dv-few").getByRole("button", { name: "Play a bot (unranked)" }).click();
    await expect(page.locator(".dv-status")).toContainText(/first move|Your move|Their move/, { timeout: 30_000 });
  } else {
    await page.goto("/squads/test/pairs?nolanding&debug&clock=90,0,3,0");
    await page.getByRole("button", { name: "Skip votes" }).click({ timeout: 40_000 });
    await expect(page.locator(".sq-game .board-area .board-wrap")).toBeVisible({ timeout: 30_000 });
  }
  await expect(page.locator(`.board-area .board-row > .board-wrap ${BOARD_SEL.container}`).first()).toBeVisible();
}

