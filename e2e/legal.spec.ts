import { expect, test, type Page } from "@playwright/test";

/**
 * The privacy policy, terms of service and copyright page (drafts until reviewed: DECISIONS.md, "Privacy policy and
 * terms: drafts from the code"): each says DRAFT at the top with the decisions still to make, they read at a phone's
 * width, and they're reached from Settings and the FAQ (the landing page's footer: landing.spec.ts), Back returning
 * there.
 */

async function expectDraft(page: Page, title: string) {
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "DRAFT — not yet reviewed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "To decide before it's final" })).toBeVisible();
  // Nothing wider than the window.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
}

test("privacy, terms and copyright: drafts, from Settings and the FAQ, Back returns there", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/settings");
  await page.getByRole("link", { name: /Privacy policy/ }).click();
  await expectDraft(page, "Privacy policy");
  await expect(page).toHaveURL(/\/privacy$/);
  // Every kind of data says why and for how long.
  const items = page.locator(".legal-item");
  expect(await items.count()).toBeGreaterThan(8);
  for (const item of await items.all()) {
    await expect(item).toContainText("Why:");
    await expect(item).toContainText("Kept:");
  }
  // The other page is one tap away; Back goes back through them to Settings.
  await page.getByRole("link", { name: "Terms of service" }).click();
  await expectDraft(page, "Terms of service");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page).toHaveURL(/\/settings$/);

  // The copyright page, from the terms: the agent and how to send a notice.
  await page.getByRole("link", { name: "Terms of service" }).click();
  await page.locator(".legal-other").getByRole("link", { name: "Copyright" }).click();
  await expectDraft(page, "Copyright");
  await expect(page.getByRole("heading", { name: "Our designated agent" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Repeat infringers" })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms of service" })).toBeVisible();

  // The FAQ's last section links all three, in this tab.
  await page.goto("/faq#faq-privacy");
  const section = page.locator("section").filter({ has: page.locator("#faq-privacy") });
  await section.getByRole("link", { name: "Terms of service", exact: true }).click();
  await expectDraft(page, "Terms of service");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "FAQ · How it works" })).toBeVisible();

  // Opened straight from its address, Back goes home.
  await page.goto("/terms");
  await expectDraft(page, "Terms of service");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});
