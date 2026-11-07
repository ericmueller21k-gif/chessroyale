import { expect } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * Home's profile card (Eric, Nov 6; the taps split on Nov 7): a tap on your pawn opens your inventory (the shop's Locker tab); a
 * tap on your icon opens the icon picker (your profile's Edit sheet, on the icon); a tap on your name or rank line opens your
 * public profile (the page others see). Only those three are taps: the rest of the card does nothing. Each is a real button with
 * its own focus ring. The page never zooms: the viewport says user-scalable=no.
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
  await page.getByRole("button", { name: "Edit icon" }).click();
  // (Your icon's edit sheet: the address stays /profile, your own page.)
  await expect(page).toHaveURL(/\/profile$/);
  const sheet = page.getByRole("dialog", { name: "Edit name & icon" });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".icon-editor")).toBeVisible();
});

test("a tap on your name or rank opens your public profile; the rest of the card does nothing", async ({ page }) => {
  await page.goto("/");
  const id = await page.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.user.id as string));
  const hero = (await page.locator(".fd-hero").boundingBox())!;

  // Empty card space (the panel's bottom corner, under the tag and the pawn): nothing opens, nothing moves.
  await page.mouse.click(hero.x + 8, hero.y + hero.height - 8);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit name & icon" })).toHaveCount(0);

  // The name: your public profile, the address /profile/ID (the page others see).
  await page.getByRole("button", { name: "View your profile" }).click();
  await expect(page).toHaveURL(new RegExp(`/profile/${id}$`));
  await expect(page.getByRole("heading", { name: "Player Profile", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit name & icon" })).toHaveCount(0);
});

test("the icon and the name are keyboard buttons with a focus ring", async ({ page }) => {
  await page.goto("/");
  const icon = page.getByRole("button", { name: "Edit icon" });
  const name = page.getByRole("button", { name: "View your profile" });
  await icon.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  expect(await icon.evaluate((e) => [e.matches(":focus-visible"), getComputedStyle(e).outlineStyle])).toEqual([true, "solid"]);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/profile$/);

  await page.goto("/");
  await name.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  expect(await name.evaluate((e) => [e.matches(":focus-visible"), getComputedStyle(e).outlineStyle])).toEqual([true, "solid"]);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/profile\/[A-Za-z0-9_-]+$/);
});
