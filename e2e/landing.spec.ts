import { expect, test } from "@playwright/test";

// The landing page shows only where sign-in is set up; locally there are no Google or Resend secrets, so the config is faked.
const signInOn = { accounts: true, google: true, email: true, onlineNeedsSignIn: true };

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
  expect((await page.request.get("/media/crowd-demo.mp4")).status()).toBe(200);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.2);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  // FAQ answers open.
  await page.getByText("Why do I need an account to play online?").click();
  await expect(page.getByText(/ban sticks/i)).toBeVisible();
  // Legal pages.
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  // A guest gets solo play against bots; online asks you to sign in. Crowd is the default mode.
  await page.getByRole("button", { name: "Play vs 99 bots as a guest" }).click();
  await expect(page.getByRole("radio", { name: /Crowd/ })).toHaveAttribute("aria-checked", "true");
  // PLAY plays 99 bots; lobbies ask you to sign in.
  await expect(page.locator(".fd-hint")).toContainText("Solo vs 99 bots");
  await page.getByRole("main").getByRole("button", { name: "Play with friends" }).click();
  await expect(page.getByRole("button", { name: "Create a lobby" })).toHaveCount(0);
  await expect(page.getByRole("dialog").getByRole("button", { name: "Sign in to play online" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  // Remembered on this device.
  await page.reload();
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
