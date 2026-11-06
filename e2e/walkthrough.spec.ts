import { expect } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * The first-time walkthrough over the home screen: it shows on a first visit, Skip ends it, and Settings' "Show the
 * walkthrough again" starts it over.
 */
test("the walkthrough shows on a first visit, Skip ends it, and Settings shows it again", async ({ page }) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Welcome walkthrough" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("PLAY");

  await dialog.getByRole("button", { name: "Skip" }).click();
  await expect(dialog).toHaveCount(0);

  await page.goto("/settings");
  await page.getByRole("button", { name: /Show the walkthrough again/ }).click();
  await expect(page.getByRole("dialog", { name: "Welcome walkthrough" })).toBeVisible();
});
