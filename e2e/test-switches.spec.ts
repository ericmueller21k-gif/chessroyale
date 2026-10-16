import { expect } from "@playwright/test";
import { asAdmin, soloFromHome, switchesOff, test, bossAloneFromHome } from "./helpers.ts";

/**
 * The test switches in the address (docs/areas/ops.md, "Test switches"): `?debug`, `?boss=`, `?fischer=1`, … work only
 * for an admin or where the server has TEST_SWITCHES on. This server has it on (the rest of the suite needs it), so
 * here the app is told otherwise, as hunchess.com tells a player: every switch is then ignored. The server's own checks
 * (a lobby's options, a queue's pool, a crate's forced roll) are in packages/server/test/test-switches.test.ts.
 */

test("a player's test switches are ignored: no menu skipped, no match on window, no crate test boxes; an admin's work", async ({ page }) => {
  test.setTimeout(2 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await switchesOff(page);

  // A player. ?boss= would skip the boss menu: Boss alone opens it.
  await page.goto("/?debug&boss=pig&laststand=1");
  await bossAloneFromHome(page);
  await expect(page.getByRole("dialog", { name: "Choose your boss" })).toBeVisible();
  await page.goto("/?debug&boss=pig");
  // ?debug would put the match on `window`: a Solo match starts without it.
  await soloFromHome(page);
  // (Home, and so the queue, shows only once your account is known: the switches are decided by then.)
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  expect(await page.evaluate(() => (window as any).match?.phase?.kind ?? null)).toBeNull();
  // ?fischer=1: no "Testing:" boxes on a crate's page (and the server ignores a forced roll from a player). The shop
  // shows before your account is known: wait for it.
  const me = page.waitForResponse((r) => r.url().includes("/api/me") && r.request().method() === "GET");
  await page.goto("/shop?crates&fischer=1");
  await me;
  await page.locator('.crate-row[data-crate="beta-001"]').click();
  await expect(page.getByRole("button", { name: /Open · uses 1 key/ })).toBeVisible();
  await expect(page.locator(".test-switches")).toHaveCount(0);

  // An admin: the same addresses work.
  await asAdmin(page);
  await page.goto("/shop?crates&fischer=1");
  await page.locator('.crate-row[data-crate="beta-001"]').click();
  await expect(page.getByLabel("Land on Fischer Random")).toBeChecked();
  await page.goto("/?debug&boss=pig");
  await soloFromHome(page);
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind ?? null)).not.toBeNull();
});
