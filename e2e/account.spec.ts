import { expect, test } from "@playwright/test";

test("a guest profile: icon and name stick, a solo match goes on it", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/");
  const config = await page.evaluate(() => fetch("/api/auth/config").then((r) => r.json()));
  expect(config.accounts).toBe(true);
  // A guest account is made on the first visit.
  const chip = page.getByRole("button", { name: "Your profile" });
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("No matches yet");
  await chip.click();
  // Draw an icon: fill the canvas with a colour, add a stroke, save.
  await page.getByRole("button", { name: "Edit your icon" }).click();
  const canvas = page.getByLabel("Your icon, 48 by 48 pixels");
  await page.getByRole("button", { name: "Fill" }).click();
  await page.getByRole("radio").nth(3).click();
  await canvas.click({ position: { x: 5, y: 5 } });
  await page.getByRole("button", { name: "Pencil" }).click();
  await page.getByRole("radio").nth(6).click();
  await canvas.click({ position: { x: 40, y: 40 } });
  await page.getByRole("button", { name: "Save icon" }).click();
  await expect(page.locator(".profile-icon img")).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect
    .poll(() => page.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => String(p.user.icon).slice(0, 22))))
    .toBe("data:image/png;base64,");
  const nameBox = page.getByLabel("Your name");
  await nameBox.fill("Hunter");
  await nameBox.blur();
  await expect.poll(() => page.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.user.name))).toBe("Hunter");
  // Without Google or Resend secrets, no sign-in buttons are offered.
  await expect(page.locator(".signin")).toHaveCount(0);
  await page.getByRole("button", { name: "Back" }).click();
  // It's still there after a reload (the session cookie).
  await page.reload();
  await expect(chip).toContainText("Hunter");
  await expect(chip.locator(".account-icon img")).toHaveAttribute("src", /^data:image\/png;base64,/);
  // A quick solo match (missing every move) lands on the profile.
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=1&augments=0");
  await page.getByLabel("Your name").fill("Hunter");
  await page.getByRole("button", { name: /Play solo/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase.kind), { timeout: 3 * 60_000 }).toBe("results");
  await expect
    .poll(() => page.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.stats.crowd.matches)), { timeout: 10_000 })
    .toBe(1);
});
