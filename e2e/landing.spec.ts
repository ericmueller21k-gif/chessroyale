import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";
import { openPlayWithFriends, pickMode } from "./helpers.ts";

// The landing page shows only where sign-in is set up; locally there are no Google or Resend secrets, so the config is faked.
const signInOn = { accounts: true, google: true, email: true, onlineNeedsSignIn: true };

/**
 * The sign-in box's size and where the guest button sits below it (from the box's top, so a tap that scrolls the page doesn't
 * count), read a few painted frames apart once they hold still.
 */
async function boxes(page: Page) {
  const read = () =>
    page.evaluate(() => {
      const box = document.querySelector(".landing-signin")!.getBoundingClientRect();
      const guest = document.querySelector(".landing-actions > .btn-wide")!.getBoundingClientRect();
      const r = Math.round;
      return JSON.stringify({ box: [r(box.width), r(box.height)], guest: [r(guest.x - box.x), r(guest.y - box.y), r(guest.width), r(guest.height)] });
    });
  let last = "";
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))));
    const now = await read();
    if (now === last) return JSON.parse(now) as { guest: number[]; box: number[] };
    last = now;
  }
  throw new Error(`boxes kept moving: ${last}`);
}

test("landing on a computer: two panes filling the window, the 16:9 reel big on the left and still, the sign-in and questions scrolling on the right", async ({ page }) => {
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
    // The page fills the window and never scrolls, either way (Eric, Nov 11: "the left, the large part where the video plays, is not").
    const doc = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    expect(doc, `${w}x${h}`).toEqual([w, h]);
    // The reel: 16:9, at least 60% of the window's width (measured: 1280 816, 1440 976, 1920 1456), in the left pane, wholly on screen.
    const box = (await video.boundingBox())!;
    expect(Math.abs(box.width / box.height - 16 / 9), `${w}x${h}`).toBeLessThan(0.01);
    expect(box.width, `${w}x${h}`).toBeGreaterThanOrEqual(0.6 * w);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(h);
    const side = page.locator(".landing-side");
    const col = (await side.boundingBox())!;
    expect(box.x + box.width, `${w}x${h}`).toBeLessThan(col.x);
    // The sign-in (Sign in first, then Sign up) and the guest button are on screen, at the top of the right column.
    for (const b of [page.getByRole("button", { name: "Continue with Google" }), page.getByRole("button", { name: "Sign up", exact: true }), page.getByRole("button", { name: /Play vs \d+ bots as a guest/ })]) {
      const r = (await b.boundingBox())!;
      expect(r.x, `${w}x${h}`).toBeGreaterThanOrEqual(col.x);
      expect(r.y + r.height, `${w}x${h}`).toBeLessThanOrEqual(h);
    }
    // Sign up and back move nothing (Nov 12).
    const before = await boxes(page);
    await page.getByRole("button", { name: "Sign up", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign up: when were you born?" })).toBeVisible();
    expect(await boxes(page), `${w}x${h}: Sign up`).toEqual(before);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    expect(await boxes(page), `${w}x${h}: back`).toEqual(before);
    // With every answer open the questions run long: the right column scrolls on its own, and the reel stays where it was.
    for (const d of await page.locator(".faq details").all()) await d.evaluate((e: HTMLDetailsElement) => (e.open = true));
    expect(await side.evaluate((e) => e.scrollHeight > e.clientHeight), `${w}x${h}`).toBe(true);
    await side.evaluate((e) => (e.scrollTop = e.scrollHeight));
    await expect.poll(() => side.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
    expect(await video.boundingBox()).toEqual(box);
    expect(await page.evaluate(() => [window.scrollX, window.scrollY, document.documentElement.scrollHeight])).toEqual([0, 0, h]);
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
  // Sign in first, with no question (Eric, Nov 12): Google and the email code at once; Sign up below them.
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Birth month")).toHaveCount(0);
  const signUp = page.getByRole("button", { name: "Sign up", exact: true });
  expect((await signUp.boundingBox())!.y).toBeGreaterThan((await page.getByLabel("Email").boundingBox())!.y);
  // Sign up asks the question in the same box, and back: nothing below moves, at this phone's width, the 428 x 746 baseline and 320.
  for (const size of [vp, { width: 428, height: 746 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(size);
    const before = await boxes(page);
    await signUp.click();
    await expect(page.getByRole("heading", { name: "Sign up: when were you born?" })).toBeVisible();
    expect(await boxes(page), `${size.width}: Sign up`).toEqual(before);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in to play online" })).toBeVisible();
    expect(await boxes(page), `${size.width}: back to Sign in`).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${size.width}`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize(vp);
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
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect.poll(() => googleStart).toContain("next=%2Flobby%2FABCDE");
});
