import { expect, type Page } from "@playwright/test";
import { named, soloFromHome, test } from "./helpers.ts";

/**
 * The first-time pawn-vote hint (the 1 v 1 core's VoteHint, shared) in the Crowd's and Squads' pre-game votes: the first
 * vote a player meets on this device shows it over the board, just above the zones, until they vote; never again there
 * (not the match's second vote, not the next match). Docs: docs/decisions/2026-10-16-home-ranked-row-and-boss-raid.md.
 */

const hint = (p: Page) => p.locator(".first-vote-hint.vh-zones");
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** The hint sits inside the board, under the zones, clear of them (Eric, Nov 26: above them it covered the middle zone's name tag). */
async function underZones(page: Page) {
  const h = (await hint(page).boundingBox())!;
  const board = (await page.locator(".vote-screen .board-wrap").first().boundingBox())!;
  const zones = await page.locator(".vote-zone").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
  expect(h.x).toBeGreaterThanOrEqual(board.x);
  expect(h.x + h.width).toBeLessThanOrEqual(board.x + board.width + 0.5);
  expect(h.y).toBeGreaterThanOrEqual(Math.max(...zones));
  expect(h.y + h.height).toBeLessThanOrEqual(board.y + board.height);
}

test("Crowd: the first vote on this device shows the hint until you vote; the second vote and the next match don't", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await named(page, "Newcomer");
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=1&clock=30");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("vote");
  await expect(hint(page)).toHaveText("Drag your pawn into a zone to vote");
  await underZones(page);
  // Voting (a card) puts it away.
  await page.getByRole("radio", { name: /Chaos/ }).click();
  await expect(hint(page)).toHaveCount(0);
  // The second vote: no hint.
  await expect(page.getByRole("heading", { name: "How does it start?" })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1000);
  await expect(hint(page)).toHaveCount(0);
  // The next match on this device: none either.
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=1&clock=30");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("vote");
  await page.waitForTimeout(1000);
  await expect(hint(page)).toHaveCount(0);
});

test("Squads: the first vote on a new device shows the same hint, under the zones, until you vote", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(2 * 60_000);
  await named(page, "Squaddie");
  await page.goto("/squads/test?nolanding&debug");
  await expect(page.locator(".vote-title h1")).toHaveText("Which mode?", { timeout: 20_000 });
  await expect(hint(page)).toHaveText("Drag your pawn into a zone to vote");
  await underZones(page);
  await page.locator(".vote-card").nth(0).click();
  await expect(hint(page)).toHaveCount(0);
  await expect(page.locator(".vote-title h1")).toHaveText(/How do the boards start\?|How fast\?/, { timeout: 60_000 });
  await page.waitForTimeout(1000);
  await expect(hint(page)).toHaveCount(0);
});

test("50 v 50's vote (Eric, Nov 26): the hint covers no zone's name or count, and each card fills upward with its share of the votes", async ({ page }) => {
  test.setTimeout(2 * 60_000);
  await named(page, "Filler");
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=1&clock=30");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("vote");
  await expect(hint(page)).toBeVisible();
  await expect(page.locator(".vote-tags .vt-tag").first()).toBeVisible();
  const overlaps = await page.evaluate(() => {
    const h = document.querySelector(".first-vote-hint.vh-zones")!.getBoundingClientRect();
    return Array.from(document.querySelectorAll(".vote-tags .vt-tag, .vote-zone-count")).filter((e) => {
      const r = e.getBoundingClientRect();
      return r.left < h.right && h.left < r.right && r.top < h.bottom && h.top < r.bottom;
    }).length;
  });
  expect(overlaps).toBe(0);
  await underZones(page);
  // The fills follow the counts: votes / all votes of the card's height, from its foot; the cards keep their size.
  const sizes = await page.locator(".vote-card").evaluateAll((els) => els.map((e) => [e.clientWidth, e.clientHeight].join("x")));
  const fit = () =>
    page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".vote-card"));
      const n = cards.map((c) => Number(c.querySelector(".vote-card-count")?.textContent ?? 0));
      const total = Math.max(1, n.reduce((a, b) => a + b, 0));
      if (n.reduce((a, b) => a + b, 0) < 2) return "few votes";
      return cards
        .map((c, i) => {
          const card = c.getBoundingClientRect(), f = c.querySelector(".vote-card-fill")!.getBoundingClientRect();
          return Math.abs(f.height - (card.height * n[i]!) / total) <= 3 && Math.abs(f.bottom - card.bottom) <= 3 ? "ok" : `card ${i}: ${f.height} of ${card.height} for ${n[i]}/${total}`;
        })
        .filter((x) => x !== "ok")
        .join("; ") || "ok";
    });
  await expect.poll(fit, { timeout: 20_000 }).toBe("ok");
  expect(await page.locator(".vote-card").evaluateAll((els) => els.map((e) => [e.clientWidth, e.clientHeight].join("x")))).toEqual(sizes);
});
