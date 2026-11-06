import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * The first-time walkthrough over the home screen: it shows on a first visit, walks all nine slides, Skip ends it, and
 * Settings' "Show the walkthrough again" starts it over. With TUTORIAL_STILLS=1 it also saves a still of each slide to
 * docs/first-tutorial/<phone|desktop>/ (run it on its own, with the flag set).
 */

const here = dirname(fileURLToPath(import.meta.url));
const STILLS = process.env.TUTORIAL_STILLS === "1";
const SLIDES = [
  "PLAY", "Chess Town", "Boss Battle", "Play with friends", "Shop & crates", "Profile", "Settings", "HunChess Handbook", "Your welcome crate",
];

const dialogOf = (page: Page) => page.getByRole("dialog", { name: "Welcome walkthrough" });

test("the walkthrough walks all nine slides, with both Welcome Crates on the last", async ({ page }, testInfo) => {
  await page.goto("/");
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  const dir = join(here, "..", "docs", "first-tutorial", testInfo.project.name);
  if (STILLS) mkdirSync(dir, { recursive: true });

  for (let i = 0; i < SLIDES.length; i++) {
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(SLIDES[i]);
    await expect(dialog.locator(".wt-count")).toHaveText(`${i + 1} of ${SLIDES.length}`);
    if (STILLS) await page.screenshot({ path: join(dir, `${String(i + 1).padStart(2, "0")}-${SLIDES[i].replace(/\W+/g, "-").toLowerCase()}.png`) });
    if (i < SLIDES.length - 1) await dialog.click({ position: { x: 4, y: 4 } });
  }
  // The last slide shows both Welcome Crates, 5 games and 25.
  await expect(dialog.locator(".wt-bars li")).toHaveCount(2);
  await expect(dialog.locator(".wt-bars li").nth(1)).toContainText("games");
  await expect(dialog.getByRole("checkbox", { name: /Don't show this tutorial again/ })).toBeChecked();

  // Tapping on the last slide finishes it and saves "don't show again".
  await dialog.click({ position: { x: 4, y: 4 } });
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(dialog).toHaveCount(0);
});

test("Skip ends it, and Settings' Show the walkthrough again starts it over", async ({ page }) => {
  await page.goto("/");
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Skip" }).click();
  await expect(dialog).toHaveCount(0);

  await page.goto("/settings");
  await page.getByRole("button", { name: /Show the walkthrough again/ }).click();
  await expect(dialogOf(page)).toBeVisible();
  await expect(dialogOf(page).getByRole("heading", { level: 2 })).toHaveText("PLAY");
});
