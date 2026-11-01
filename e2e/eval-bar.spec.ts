import { expect, type Page } from "@playwright/test";
import { BOARD_SEL, asAdmin, switchesOff, test, bossAloneFromHome } from "./helpers.ts";

/**
 * The eval bar (Eric, Nov 1: "it should never actually be displayed… we can keep it in the settings for now, but disable it…
 * Nothing gets resized when the eval bar isn't enabled"): never shown, to anyone, testers included. Settings → Testing keeps
 * its row, switched off and not tappable ("Off for now"); a device's stored choice (brc.evalBar) is ignored, and the board
 * takes its room, as a player's does (desktop-board.spec.ts and board-layout.spec.ts pin the sizes).
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** Boss alone, to your first move: the board's box, the row's, and whether the bar shows. */
async function boardNow(page: Page) {
  await page.goto("/?debug&clock=60&boss=hollow&laststand=0");
  await bossAloneFromHome(page);
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await page.waitForTimeout(400);
  // (No switch for it on the board's screen: it's in Settings only.)
  await expect(page.getByRole("switch", { name: /Eval bar/ })).toHaveCount(0);
  return page.evaluate((squares) => {
    const board = document.querySelector(squares)!.getBoundingClientRect();
    const row = document.querySelector(".board-row")!.getBoundingClientRect();
    // (The dock's row under the board: its edges the board's, bar or no bar; Eric, Oct 15.)
    const dock = document.querySelector(".boss-dock-main")!.getBoundingClientRect();
    return { bars: document.querySelectorAll(".eval-bar").length, width: board.width, left: board.left - row.left, right: row.right - board.right, overflow: document.documentElement.scrollWidth - innerWidth, dockOff: Math.max(Math.abs(dock.left - board.left), Math.abs(dock.right - board.right)) };
  }, BOARD_SEL.squares);
}

test("the eval bar is never shown (testers too); its Testing row is shown, off and disabled", async ({ page }) => {
  await asAdmin(page);
  // A device that stored it on: ignored.
  await page.addInitScript(() => localStorage.setItem("brc.evalBar", "1"));
  const board = await boardNow(page);
  expect(board.bars).toBe(0);
  expect(board.dockOff).toBeLessThanOrEqual(1);
  // The board takes its room: centered, no sideways scroll.
  expect(Math.abs(board.left - board.right)).toBeLessThanOrEqual(2);
  expect(board.overflow).toBeLessThanOrEqual(0);

  await page.goto("/settings");
  const toggle = page.getByRole("switch", { name: /Eval bar/ });
  await expect(toggle).toBeVisible();
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeDisabled();
  await expect(page.locator(".fd-toggle", { has: toggle })).toContainText("Off for now");
  // Tapping its row does nothing (the switch is disabled; the row is just a label for it).
  await page.locator(".fd-toggle", { has: toggle }).click({ force: true, timeout: 10_000 });
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole("switch", { name: /Eval bar/ })).not.toBeChecked();
  expect((await boardNow(page)).bars).toBe(0);
});

test("players never see the eval bar: no bar on the board and no switch, even on a device that had it on", async ({ page }) => {
  test.setTimeout(2 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  // A player (this server has TEST_SWITCHES on: the app is told otherwise, as hunchess.com tells a player).
  await switchesOff(page);
  await page.addInitScript(() => localStorage.setItem("brc.evalBar", "1"));
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("switch", { name: /Eval bar/ })).toHaveCount(0);
  // Boss alone, the boss picked from the menu: the board, and no bar beside it.
  await page.goto("/");
  await bossAloneFromHome(page, "Boingo the Clown");
  await expect(page.locator(".board-row")).toBeVisible({ timeout: 90_000 });
  await expect(page.locator(BOARD_SEL.squares)).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.locator(".eval-bar")).toHaveCount(0);
});
