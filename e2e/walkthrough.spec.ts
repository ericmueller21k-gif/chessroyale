import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * The first-time walkthrough over the home screen: it shows on a first visit, walks all nine slides (the last shows both
 * Welcome Crates and "Go to your inventory"), and Skip, the "don't show again" box and Settings' replay behave as specified.
 * With TUTORIAL_STILLS=1 it saves a still of the last slide to docs/first-tutorial/<phone|desktop>/.
 */

const here = dirname(fileURLToPath(import.meta.url));
const STILLS = process.env.TUTORIAL_STILLS === "1";
const SLIDES = [
  "PLAY", "Chess Town", "Boss Battle", "Play with friends", "Shop & crates", "Profile", "Settings", "HunChess Handbook", "Your welcome crates",
];

const dialogOf = (page: Page) => page.getByRole("dialog", { name: "Welcome walkthrough" });
const box = (page: Page) => dialogOf(page).getByRole("checkbox", { name: /Don't show this tutorial again/ });

/** Taps through to the last slide (the corner is the dimmed screen, so a tap there moves on). */
async function toLastSlide(page: Page) {
  const dialog = dialogOf(page);
  for (let i = 0; i < SLIDES.length - 1; i++) {
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(SLIDES[i]);
    await dialog.click({ position: { x: 4, y: 4 } });
  }
  await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(SLIDES[SLIDES.length - 1]);
}

test("the walkthrough walks all nine slides; the last shows both crates; finishing stops it", async ({ page }, testInfo) => {
  await page.goto("/");
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  await expect(box(page)).not.toBeChecked();

  await toLastSlide(page);
  await expect(dialog.locator(".wt-count")).toHaveText(`9 of ${SLIDES.length}`);
  // Both Welcome Crates, each with its picture, its goal and its progress.
  const crates = dialog.locator(".wt-crate");
  await expect(crates).toHaveCount(2);
  await expect(crates.nth(0)).toContainText("5 games");
  await expect(crates.nth(0)).toContainText("0 of 5");
  await expect(crates.nth(1)).toContainText("25 games");
  await expect(crates.nth(1)).toContainText("0 of 25");
  await expect(crates.nth(0).locator(".wt-art svg")).toHaveCount(1);
  // The shop is lit up on this slide, with the inventory button under the crates.
  await expect(page.locator('.wt-spot')).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "Go to your inventory" })).toBeVisible();

  if (STILLS) {
    const dir = join(here, "..", "docs", "first-tutorial", testInfo.project.name);
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, "09-your-welcome-crates.png") });
  }

  // Tapping on the last slide finishes it: that saves "don't show again", so a reload shows nothing.
  await dialog.click({ position: { x: 4, y: 4 } });
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(dialog).toHaveCount(0);
});

test("unticked, Skip shows it again next visit; ticked, Skip stops it", async ({ page }) => {
  await page.goto("/");
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Skip" }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(dialogOf(page)).toBeVisible();

  await box(page).check();
  await dialogOf(page).getByRole("button", { name: "Skip" }).click();
  await page.reload();
  await expect(dialogOf(page)).toHaveCount(0);
});

test("Go to your inventory closes it and opens the shop's Crates tab with the Welcome Crates", async ({ page }) => {
  await page.goto("/");
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  await toLastSlide(page);
  await dialog.getByRole("button", { name: "Go to your inventory" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/shop\?crates$/);
  await expect(page.getByText(/Welcome Crate 1/).first()).toBeVisible();
});

test("Settings' Show the walkthrough again starts it over", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: /Show the walkthrough again/ }).click();
  await expect(dialogOf(page)).toBeVisible();
  await expect(dialogOf(page).getByRole("heading", { level: 2 })).toHaveText("PLAY");
});
