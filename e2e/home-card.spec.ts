import { expect } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * Home's profile card (Eric, Nov 6): a tap on your pawn opens your inventory (the shop's Locker tab), a tap on your icon,
 * level or name opens the icon picker (your profile's Edit sheet, on the icon). The page never zooms: the viewport says
 * user-scalable=no.
 */

test("the viewport forbids zoom", async ({ page }) => {
  await page.goto("/");
  const content = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(content).toContain("user-scalable=no");
  expect(content).toContain("maximum-scale=1");
});

test("a tap on your pawn opens your inventory; a tap on your icon opens the icon picker", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open your inventory" }).click();
  await expect(page.getByRole("tab", { name: "Locker" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");

  await page.goto("/");
  await page.getByRole("button", { name: "Change your icon" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit name & icon" });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".icon-editor")).toBeVisible();
});
