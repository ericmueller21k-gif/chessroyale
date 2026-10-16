import { expect, type Page } from "@playwright/test";
import { named, soloFromHome, test } from "./helpers.ts";

/**
 * The first-time pawn-vote hint (the 1 v 1 core's VoteHint, shared) in the Crowd's and Squads' pre-game votes: the first
 * vote a player meets on this device shows it over the board, just above the zones, until they vote; never again there
 * (not the match's second vote, not the next match). Docs: docs/decisions/2026-10-16-home-ranked-row-and-boss-raid.md.
 */

const hint = (p: Page) => p.locator(".first-vote-hint.vh-zones");
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** The hint sits inside the board, above the zones, clear of them. */
async function aboveZones(page: Page) {
  const h = (await hint(page).boundingBox())!;
  const board = (await page.locator(".vote-screen .board-wrap").first().boundingBox())!;
  const zones = await page.locator(".vote-zone").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(h.x).toBeGreaterThanOrEqual(board.x);
  expect(h.x + h.width).toBeLessThanOrEqual(board.x + board.width + 0.5);
  expect(h.y).toBeGreaterThanOrEqual(board.y);
  expect(h.y + h.height).toBeLessThanOrEqual(Math.min(...zones));
}

test("Crowd: the first vote on this device shows the hint until you vote; the second vote and the next match don't", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await named(page, "Newcomer");
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=1&clock=30");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("vote");
  await expect(hint(page)).toHaveText("Drag your pawn into a zone to vote");
  await aboveZones(page);
  // Voting (a card) puts it away.
  await page.getByRole("radio", { name: /Duel/ }).click();
  await expect(hint(page)).toHaveCount(0);
  // The second vote: no hint.
  await expect(page.getByRole("heading", { name: "How fast?" })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1000);
  await expect(hint(page)).toHaveCount(0);
  // The next match on this device: none either.
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=1&clock=30");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("vote");
  await page.waitForTimeout(1000);
  await expect(hint(page)).toHaveCount(0);
});

test("Squads: the first vote on a new device shows the same hint, above the zones, until you vote", async ({ page }) => {
  test.setTimeout(2 * 60_000);
  await named(page, "Squaddie");
  await page.goto("/squads/test?nolanding&debug");
  await expect(page.locator(".vote-title h1")).toHaveText("Which mode?", { timeout: 20_000 });
  await expect(hint(page)).toHaveText("Drag your pawn into a zone to vote");
  await aboveZones(page);
  await page.locator(".vote-card").nth(0).click();
  await expect(hint(page)).toHaveCount(0);
  await expect(page.locator(".vote-title h1")).toHaveText(/How do the boards start\?|How fast\?/, { timeout: 60_000 });
  await page.waitForTimeout(1000);
  await expect(hint(page)).toHaveCount(0);
});
