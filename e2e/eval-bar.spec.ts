import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * The eval bar's switch (Eric, Oct 10): on by default, in Settings only (never on a board screen); off, no bar on any
 * board and the board takes its room, centred, on a phone and a computer; remembered on the device.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** Boss alone, to your first move: the board's box, the row's, and whether the bar shows. */
async function boardNow(page: Page) {
  await page.goto("/?debug&clock=60&boss=hollow&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await page.waitForTimeout(400);
  // (No switch for it on the board's screen: it's in Settings only.)
  await expect(page.getByRole("switch", { name: /Eval bar/ })).toHaveCount(0);
  return page.evaluate(() => {
    const board = document.querySelector("cg-board")!.getBoundingClientRect();
    const row = document.querySelector(".board-row")!.getBoundingClientRect();
    return { bars: document.querySelectorAll(".eval-bar").length, width: board.width, left: board.left - row.left, right: row.right - board.right, overflow: document.documentElement.scrollWidth - innerWidth };
  });
}

test("the eval bar: on by default, switched off in Settings, and the board takes its room", async ({ page }, info) => {
  const on = await boardNow(page);
  expect(on.bars).toBe(1);

  await page.goto("/settings");
  const toggle = page.getByRole("switch", { name: /Eval bar/ });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole("switch", { name: /Eval bar/ })).not.toBeChecked();

  const off = await boardNow(page);
  expect(off.bars).toBe(0);
  // The board takes the bar's room: wider on a phone (the width was the limit), never smaller; still centred, no
  // sideways scroll.
  if (info.project.name === "phone") expect(off.width).toBeGreaterThan(on.width + 15);
  else expect(off.width).toBeGreaterThanOrEqual(on.width - 1);
  expect(Math.abs(off.left - off.right)).toBeLessThanOrEqual(2);
  expect(off.overflow).toBeLessThanOrEqual(0);

  // Back on: the bar again, the board as it was.
  await page.goto("/settings");
  await page.getByRole("switch", { name: /Eval bar/ }).click();
  const again = await boardNow(page);
  expect(again.bars).toBe(1);
  expect(Math.abs(again.width - on.width)).toBeLessThanOrEqual(1);
});
