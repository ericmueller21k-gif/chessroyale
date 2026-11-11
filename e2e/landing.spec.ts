import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";
import { openPlayWithFriends, pickMode } from "./helpers.ts";

// The landing page shows only where sign-in is set up; locally there are no Google or Resend secrets, so the config is faked.
const signInOn = { accounts: true, google: true, email: true, onlineNeedsSignIn: true };

/** The age question that comes before the sign-in options (age-gate.spec.ts tests the gate): an adult's answer. */
async function oldEnough(page: Page) {
  await page.getByLabel("Birth month").selectOption("6");
  await page.getByLabel("Birth year").selectOption("1990");
  await page.getByRole("button", { name: "Continue" }).click();
}

test("landing on a computer: the 16:9 reel as the hero (70% of the width, at most 62% of the height), the sign-in beside it above the fold", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "a computer's layout");
  await page.route("**/api/auth/config", (r) => r.fulfill({ json: signInOn }));
  for (const [w, h] of [
    [1280, 800],
    [1440, 900],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    const video = page.locator("video.demo-video");
    await expect(video).toBeVisible();
    // Only the computer's reel loads (Eric, Nov 11: "a wide rectangle on the computer… like a cinema").
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(/\/media\/hunchess-reel-wide\.(mp4|webm)$/);
    const box = (await video.boundingBox())!;
    const want = Math.min(0.7 * w, ((0.62 * h) * 16) / 9);
    expect(Math.abs(box.width - want), `${w}x${h}: ${box.width} wide, want ${want}`).toBeLessThan(2);
    expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.01);
    // The sign-in and the guest button are on screen without scrolling; nothing scrolls sideways.
    for (const b of [page.getByRole("button", { name: "Continue" }), page.getByRole("button", { name: /Play vs \d+ bots as a guest/ })]) {
      const r = (await b.boundingBox())!;
      expect(r.y + r.height, `${w}x${h}`).toBeLessThanOrEqual(h);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
  }
});

test("landing: demo loop, sign-in, guests play bots only, FAQ and legal pages, invite links", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.route("**/api/auth/config", (r) => r.fulfill({ json: signInOn }));
  let googleStart = "";
  await page.route("**/api/auth/google/start**", (r) => {
    googleStart = r.request().url();
    return r.fulfill({ status: 200, contentType: "text/html", body: "<p>Google</p>" });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to play online" })).toBeVisible();
  // The demo loop is there and plays.
  const video = page.locator("video.demo-video");
  await expect(video).toBeVisible();
  expect((await page.request.get("/media/hunchess-reel.mp4")).status()).toBe(200);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.2);
  // It's big (Eric, Nov 11): the phone's whole width, edge to edge, and no sideways scroll.
  const vp = page.viewportSize()!;
  const reel = (await video.boundingBox())!;
  expect([Math.round(reel.x), Math.round(reel.width)]).toEqual([0, vp.width]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vp.width);
  await oldEnough(page);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  // FAQ answers open.
  await page.getByText("Why do I need an account to play online?").click();
  await expect(page.getByText(/ban sticks/i)).toBeVisible();
  // Legal pages.
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "DRAFT — not yet reviewed" })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in to play online" })).toBeVisible();
  // A guest gets solo play against bots; online asks you to sign in. No mode is picked until you tap one (Eric, Oct 18).
  await page.getByRole("button", { name: "Play vs 99 bots as a guest" }).click();
  await expect(page.getByRole("radiogroup", { name: "RANKED" }).locator('[aria-checked="true"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeDisabled();
  await pickMode(page, "50 v 50");
  // PLAY plays 99 bots; lobbies ask you to sign in.
  await expect(page.locator(".fd-hint")).toContainText("Solo vs 99 bots");
  await openPlayWithFriends(page);
  await expect(page.getByRole("button", { name: "Get friend code" })).toHaveCount(0);
  await expect(page.getByRole("dialog").getByRole("button", { name: "Sign in to play online" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  // Remembered on this device.
  await page.reload();
  await pickMode(page);
  await expect(page.locator(".fd-hint")).toContainText("Solo vs 99 bots");
  await page.getByRole("button", { name: "Sign in to play online" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to play online" })).toBeVisible();
  // An old link to a lobby that has closed: the landing says so, and doesn't offer to join it.
  await page.goto("/lobby/ZZZZ9");
  await expect(page.getByRole("status").filter({ hasText: "That match has ended." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to play online" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  // An invite link (to a lobby that's open: the server's answer, faked) asks a guest to sign in to join, and Google
  // brings them back to the lobby.
  await page.route("**/api/lobby/ABCDE", (r) => r.fulfill({ json: { open: true, phase: "waiting" } }));
  await page.goto("/lobby/ABCDE");
  await expect(page.getByRole("heading", { name: "Sign in to join lobby ABCDE" })).toBeVisible();
  await oldEnough(page);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect.poll(() => googleStart).toContain("next=%2Flobby%2FABCDE");
});
