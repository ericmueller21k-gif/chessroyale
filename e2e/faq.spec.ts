import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * The FAQ, "How HunChess works" (Eric, Oct 11): reached from Settings, its contents jump to each section, it reads
 * at a phone's width without sideways scroll, a link to a heading opens there, and back goes to Settings.
 */

/** How far a heading's top is from the top of the window (it should be near 0 once jumped to). */
const topOf = (page: Page, id: string) => page.evaluate((x) => document.getElementById(x)?.getBoundingClientRect().top ?? -1e9, id);

test("Settings → FAQ: the contents jump to a section and it comes into view; back goes to Settings", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: /FAQ · How it works/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "FAQ · How it works" })).toBeVisible();
  await expect(page).toHaveURL(/\/faq$/);

  // Every link in the contents points at something on the page.
  const toc = page.getByRole("navigation", { name: "Contents" });
  const hrefs = await toc.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  expect(hrefs.length).toBeGreaterThan(8);
  for (const h of hrefs) expect(await page.locator(h).count(), h).toBe(1);

  // A sub-heading: the handover from Maia to Stockfish.
  await toc.getByRole("link", { name: "The handover: from Maia to Stockfish" }).click();
  await expect(page.locator("#faq-handover")).toBeInViewport();
  await expect.poll(() => topOf(page, "faq-handover"), { timeout: 5000 }).toBeLessThan(80);
  await expect.poll(() => topOf(page, "faq-handover")).toBeGreaterThan(-5);
  await expect(page).toHaveURL(/#faq-handover$/);

  // Back to the contents, then a whole section: the God King.
  await page.locator("#faq-boss-brain").locator("..").getByRole("link", { name: "↑ Contents" }).click();
  await expect(toc).toBeInViewport();
  await toc.getByRole("link", { name: "The God King", exact: true }).click();
  const king = page.getByRole("heading", { level: 2, name: "The God King" });
  await expect(king).toBeInViewport();
  await expect.poll(() => topOf(page, "faq-god-king"), { timeout: 5000 }).toBeLessThan(80);

  // Readable at this width: nothing wider than the window (wide tables scroll inside their own box).
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Back to Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page).toHaveURL(/\/settings$/);
});

test("a link to a heading in the FAQ opens at that heading", async ({ page }) => {
  await page.goto("/faq#faq-last-stand");
  await expect(page.getByRole("heading", { level: 3, name: "His save: the Last Stand" })).toBeInViewport();
  await expect.poll(() => topOf(page, "faq-last-stand"), { timeout: 5000 }).toBeLessThan(80);
});
