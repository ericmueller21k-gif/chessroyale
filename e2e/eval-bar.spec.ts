import { expect, type Page } from "@playwright/test";
import { BOARD_SEL, asAdmin, switchesOff, test, bossAloneFromHome } from "./helpers.ts";

/**
 * The eval bar's switch (Eric, Oct 10): on by default, in Settings only (never on a board screen); off, no bar on any
 * board and the board takes its room, centered, on a phone and a computer; remembered on the device. Since Oct 15 it's
 * for testers only (an admin, or a test server like this one), its switch in Settings → Testing (admins); players never
 * see the bar.
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

test("the eval bar (testers): on by default, switched off in Settings → Testing, and the board takes its room", async ({ page }, info) => {
  await asAdmin(page);
  const on = await boardNow(page);
  expect(on.bars).toBe(1);
  expect(on.dockOff).toBeLessThanOrEqual(1);

  await page.goto("/settings");
  const toggle = page.getByRole("switch", { name: /Eval bar/ });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole("switch", { name: /Eval bar/ })).not.toBeChecked();

  const off = await boardNow(page);
  expect(off.bars).toBe(0);
  // The board takes the bar's room: wider on a phone (the width was the limit), never smaller; still centered, no
  // sideways scroll.
  if (info.project.name === "phone") expect(off.width).toBeGreaterThan(on.width + 15);
  else expect(off.width).toBeGreaterThanOrEqual(on.width - 1);
  expect(Math.abs(off.left - off.right)).toBeLessThanOrEqual(2);
  expect(off.overflow).toBeLessThanOrEqual(0);
  expect(off.dockOff).toBeLessThanOrEqual(1);

  // Back on: the bar again, the board as it was.
  await page.goto("/settings");
  await page.getByRole("switch", { name: /Eval bar/ }).click();
  const again = await boardNow(page);
  expect(again.bars).toBe(1);
  expect(Math.abs(again.width - on.width)).toBeLessThanOrEqual(1);
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
  await page.getByRole("dialog", { name: "Boss alone" }).getByRole("button", { name: /Boingo/ }).click();
  await expect(page.locator(".board-row")).toBeVisible({ timeout: 90_000 });
  await expect(page.locator(BOARD_SEL.squares)).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.locator(".eval-bar")).toHaveCount(0);
});
