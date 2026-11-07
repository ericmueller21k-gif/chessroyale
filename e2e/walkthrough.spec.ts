import { mkdirSync } from "node:fs";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * The first-time walkthrough over the home screen (13 slides: PLAY, the three RANKED modes, the rest of the home spots, the
 * Handbook, Play anywhere, then the crates slide last). Each slide lights every visible element with its `data-tour` id: a
 * computer has some of them twice (its side menu and the home screen's button), so those light two. Only the last slide has
 * OK and "Don't show me this again"; taps never go past it. `?tour=1` opens it from the first slide whatever the flag says.
 * With TOUR_STILLS_DIR=<dir> it saves the stills (phone and computer) to that folder.
 */

// This file tests the walkthrough itself, so it opts out of the shared default that marks it seen (helpers.ts).
test.use({ tutorialSeen: false });

/** Each slide's title, and how many elements it lights: a computer, then a phone (a phone has no side menu). */
const SLIDES: [title: string, desktop: number, phone: number][] = [
  ["PLAY", 2, 1],
  ["50 v 50", 1, 1],
  ["1 v 1", 1, 1],
  ["Squads", 1, 1],
  ["Chess Town", 2, 1],
  ["Boss Battle", 2, 1],
  ["Play with friends", 1, 1],
  ["Shop & crates", 1, 1],
  ["Profile", 2, 1],
  ["Settings", 1, 1],
  ["HunChess Handbook", 0, 0],
  ["Play anywhere", 0, 0],
  ["Your welcome crates", 1, 1],
];
const LAST = SLIDES.length - 1;
const STILLS = process.env.TOUR_STILLS_DIR;

const dialogOf = (page: Page) => page.getByRole("dialog", { name: "Welcome walkthrough" });
const box = (page: Page) => dialogOf(page).getByRole("checkbox", { name: "Don't show me this again" });
const ok = (page: Page) => dialogOf(page).getByRole("button", { name: "OK", exact: true });

/** A slide's title, its lit count for this project, the glow and cut-out for each lit element, and the bubble's dock. */
async function expectSlide(page: Page, testInfo: TestInfo, i: number) {
  const [title, desktop, phone] = SLIDES[i]!;
  const dialog = dialogOf(page);
  await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(title);
  await expect(dialog.locator(".wt-count")).toHaveText(`${i + 1} of ${SLIDES.length}`);
  const lit = testInfo.project.name === "desktop" ? desktop : phone;
  await expect(page.locator(".wt-lit")).toHaveCount(lit);
  await expect(page.locator(".wt-spot")).toHaveCount(lit);
  await expect(page.locator(".wt-hole")).toHaveCount(lit);
  await expect(page.locator(".wt-dim")).toHaveCount(1);
  // The last slide alone has OK and the box (under it); the other slides have Skip.
  await expect(ok(page)).toHaveCount(i === LAST ? 1 : 0);
  await expect(box(page)).toHaveCount(i === LAST ? 1 : 0);
  await expect(dialog.getByRole("button", { name: "Skip" })).toHaveCount(i === LAST ? 0 : 1);
  await expect(async () => {
    const r = await page.evaluate(() => {
      const lits = [...document.querySelectorAll<HTMLElement>(".wt-lit")].map((e) => e.getBoundingClientRect());
      const spots = [...document.querySelectorAll<HTMLElement>(".wt-spot")].map((e) => e.getBoundingClientRect());
      const holes = [...document.querySelectorAll<SVGRectElement>(".wt-hole")].map((h) => ({
        x: Number(h.getAttribute("x")), y: Number(h.getAttribute("y")),
        w: Number(h.getAttribute("width")), h: Number(h.getAttribute("height")),
      }));
      // (The dock: the box with its "Tap anywhere" line above it, so the dock's edge is the screen's edge margin.)
      const b = document.querySelector<HTMLElement>(".wt-dock")!.getBoundingClientRect();
      // Each lit element sits inside a glow box, and its cut-out is that same box.
      const inside = lits.every((l) => spots.some((s) => l.left >= s.left - 1 && l.right <= s.right + 1 && l.top >= s.top - 1 && l.bottom <= s.bottom + 1));
      const cut = lits.every((l) => holes.some((h) => Math.abs(h.x - l.left) <= 1.5 && Math.abs(h.y - l.top) <= 1.5 && Math.abs(h.w - l.width) <= 1.5 && Math.abs(h.h - l.height) <= 1.5));
      const top = spots.length ? Math.min(...spots.map((s) => s.top)) : 0;
      const bottom = spots.length ? Math.max(...spots.map((s) => s.bottom)) : 0;
      const topHalf = spots.length > 0 && (top + bottom) / 2 < innerHeight / 2;
      return {
        inside, cut, bubbleOk: spots.length === 0 ? true : topHalf
          ? Math.abs(innerHeight - b.bottom - 16) <= 1
          : Math.abs(b.top - 16) <= 1,
      };
    });
    expect(r).toEqual({ inside: true, cut: true, bubbleOk: true });
  }).toPass({ timeout: 3000 });
}

// The compact box (Eric, Nov 7: "make it way less wide … a lot less height … measure the space"). Today's heights on main, at the
// box's own size (1280 × 800 and 390 × 844): 135 px for a spot slide (PLAY, the modes, the Handbook), 167 px for "Play anywhere",
// 323 px for the crates slide. The limit is half of each. Exception: on a phone the two centered slides' copy is long (the
// Handbook's 68 characters, "Play anywhere"'s 130), so they run 97 and 115 px there, about 70% of today's; their limits are
// the measured heights, with a little room. (Cutting the copy would bring them under half: Eric's call.)
const MAX_HEIGHT = {
  computer: { spot: 67, handbook: 67, anywhere: 83, crates: 161 },
  phone: { spot: 67, handbook: 100, anywhere: 120, crates: 161 },
};
const MAX_WIDTH_DESKTOP = 520;
const slideKind = (i: number) => (i <= 9 ? "spot" : i === 10 ? "handbook" : i === 11 ? "anywhere" : "crates");

test("the box is compact: at most half today's height (the phone's two centered slides about 70%), 520 px wide on a computer, no overflow; Tap anywhere sits above it, centered, with no glow; the last slide has none", async ({ page }, testInfo) => {
  await page.goto("/");
  const desktop = testInfo.project.name === "desktop";
  for (let i = 0; i <= LAST; i++) {
    await expect(dialogOf(page).locator(".wt-count")).toHaveText(`${i + 1} of ${SLIDES.length}`);
    await page.waitForTimeout(260);
    const m = await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>(".wt-bubble")!;
      const r = box.getBoundingClientRect();
      const tapEl = document.querySelector<HTMLElement>(".wt-tap");
      const tap = tapEl?.getBoundingClientRect() ?? null;
      return {
        width: r.width,
        height: r.height,
        overflowY: box.scrollHeight - box.clientHeight,
        overflowX: box.scrollWidth - box.clientWidth,
        tapBottom: tap ? tap.bottom : null,
        tapCenter: tap ? tap.left + tap.width / 2 : null,
        boxCenter: r.left + r.width / 2,
        tapShadow: tapEl ? getComputedStyle(tapEl).textShadow : null,
        boxTop: r.top,
        tapColor: tapEl ? getComputedStyle(tapEl).color : null,
        tapText: tapEl?.textContent ?? null,
      };
    });
    const limit = MAX_HEIGHT[desktop ? "computer" : "phone"][slideKind(i) as keyof typeof MAX_HEIGHT.computer];
    expect(m.height, `slide ${i + 1} height`).toBeLessThanOrEqual(limit);
    if (desktop) expect(m.width, `slide ${i + 1} width (computer)`).toBeLessThanOrEqual(MAX_WIDTH_DESKTOP);
    else expect(m.width, `slide ${i + 1} width (phone)`).toBeLessThanOrEqual(390 - 24);
    expect(m.overflowY, `slide ${i + 1} text overflow (down)`).toBeLessThanOrEqual(0);
    expect(m.overflowX, `slide ${i + 1} text overflow (across)`).toBeLessThanOrEqual(0);
    if (i < LAST) {
      // The gold line: outside the box, just above it, centered over the box, plain text (no glow) in PLAY's gold.
      expect(m.tapText).toBe("Tap anywhere to continue");
      expect(m.tapBottom!).toBeLessThanOrEqual(m.boxTop + 0.5);
      expect(Math.abs(m.tapCenter! - m.boxCenter)).toBeLessThanOrEqual(2);
      expect(m.tapShadow).toBe("none");
      expect(m.tapColor).toBe("rgb(242, 193, 78)");
    } else {
      expect(m.tapText).toBeNull();
      await expect(dialogOf(page).getByText("Tap anywhere to continue")).toHaveCount(0);
    }
    if (i < LAST) await tapOn(page);
  }
});

/** Taps to the next slide (the corner is the dimmed screen, so a tap there moves on). */
async function tapOn(page: Page) {
  await dialogOf(page).click({ position: { x: 4, y: 4 } });
}

/** Walks to the last slide, checking each one. */
async function toLastSlide(page: Page, testInfo: TestInfo) {
  for (let i = 0; i < LAST; i++) {
    await expectSlide(page, testInfo, i);
    await tapOn(page);
  }
  await expectSlide(page, testInfo, LAST);
}

test("every slide in order lights its elements (a computer lights two where two exist); the mode tabs light", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(dialogOf(page)).toBeVisible();
  await expect(box(page)).toHaveCount(0);
  for (let i = 0; i < LAST; i++) {
    await expectSlide(page, testInfo, i);
    await tapOn(page);
  }
  await expectSlide(page, testInfo, LAST);
  await expect(dialogOf(page).getByRole("button", { name: "Go to your inventory" })).toBeVisible();
  // Both Welcome Crates, each with its picture, its goal and its progress.
  const crates = dialogOf(page).locator(".wt-crate");
  await expect(crates).toHaveCount(2);
  await expect(crates.nth(0)).toContainText("5 games");
  await expect(crates.nth(1)).toContainText("25 games");
});

test("the last slide only: taps and spam taps never finish it; OK does, and ticked it stays gone", async ({ page }, testInfo) => {
  await page.goto("/");
  await toLastSlide(page, testInfo);
  for (let n = 0; n < 6; n++) await tapOn(page);
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await expect(dialogOf(page).locator(".wt-count")).toHaveText(`${SLIDES.length} of ${SLIDES.length}`);
  await expect(dialogOf(page)).toBeVisible();

  await box(page).check();
  await ok(page).click();
  await expect(dialogOf(page)).toHaveCount(0);
  await page.reload();
  await expect(dialogOf(page)).toHaveCount(0);
});

test("unticked, OK closes it for now: it shows again next visit", async ({ page }, testInfo) => {
  await page.goto("/");
  await toLastSlide(page, testInfo);
  await expect(box(page)).not.toBeChecked();
  await ok(page).click();
  await expect(dialogOf(page)).toHaveCount(0);
  await page.reload();
  await expect(dialogOf(page)).toBeVisible();
});

test("Skip on an earlier slide closes it for now: it shows again next visit", async ({ page }) => {
  await page.goto("/");
  await dialogOf(page).getByRole("button", { name: "Skip" }).click();
  await expect(dialogOf(page)).toHaveCount(0);
  await page.reload();
  await expect(dialogOf(page)).toBeVisible();
});

test("?tour=1 opens it from the first slide after it was dismissed for good, and doesn't change the flag", async ({ page }, testInfo) => {
  await page.goto("/");
  await toLastSlide(page, testInfo);
  await box(page).check();
  await ok(page).click();
  await page.reload();
  await expect(dialogOf(page)).toHaveCount(0);

  await page.goto("/?tour=1");
  await expect(dialogOf(page).getByRole("heading", { level: 2 })).toHaveText("PLAY");
  await expect(dialogOf(page).locator(".wt-count")).toHaveText(`1 of ${SLIDES.length}`);
  await dialogOf(page).getByRole("button", { name: "Skip" }).click();
  await page.goto("/");
  await expect(dialogOf(page)).toHaveCount(0);

  // Unticked, through to the end: it closes, and the flag is still set (the next plain visit shows nothing).
  await page.goto("/?tour=1");
  await toLastSlide(page, testInfo);
  await ok(page).click();
  await page.goto("/");
  await expect(dialogOf(page)).toHaveCount(0);
});

test("Settings' Show the walkthrough again starts it over", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: /Show the walkthrough again/ }).click();
  await expect(dialogOf(page)).toBeVisible();
  await expect(dialogOf(page).getByRole("heading", { level: 2 })).toHaveText("PLAY");
});

test("Go to your inventory closes it and opens the shop's Crates tab with the Welcome Crates", async ({ page }, testInfo) => {
  await page.goto("/");
  await toLastSlide(page, testInfo);
  await dialogOf(page).getByRole("button", { name: "Go to your inventory" }).click();
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/shop\?crates$/);
  await expect(page.getByText(/Welcome Crate 1/).first()).toBeVisible();
});

test("stills: PLAY, a mode, Play anywhere and the last slide", async ({ page }, testInfo) => {
  test.skip(!STILLS, "stills only (TOUR_STILLS_DIR=<folder>)");
  mkdirSync(STILLS!, { recursive: true });
  await page.goto("/");
  const shots: [number, string][] = [[0, "play"], [1, "mode-50v50"], [11, "play-anywhere"], [LAST, "last-ok"]];
  for (const [i, name] of shots) {
    while (true) {
      const n = await dialogOf(page).locator(".wt-count").textContent();
      if (n === `${i + 1} of ${SLIDES.length}`) break;
      await tapOn(page);
    }
    await expectSlide(page, testInfo, i);
    await page.screenshot({ path: `${STILLS}/${name}-${testInfo.project.name}.png` });
  }
});
