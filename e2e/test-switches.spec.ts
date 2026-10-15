import { expect, type Page } from "@playwright/test";
import { soloFromHome, test } from "./helpers.ts";

/**
 * The test switches in the address (docs/areas/ops.md, "Test switches"): `?debug`, `?boss=`, `?fischer=1`, … work only
 * for an admin or where the server has TEST_SWITCHES on. This server has it on (the rest of the suite needs it), so
 * here the app is told otherwise, as hunchess.com tells a player: every switch is then ignored. The server's own checks
 * (a lobby's options, a queue's pool, a crate's forced roll) are in packages/server/test/test-switches.test.ts.
 */

/** The server's config as production's says it: TEST_SWITCHES off. */
async function switchesOff(page: Page) {
  await page.route("**/api/auth/config", async (route) => {
    const res = await route.fetch();
    const { testSwitches: _, ...body } = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, json: body });
  });
}

/** Your profile says you're an admin (as /api/me does for an email in ADMIN_EMAILS). */
async function asAdmin(page: Page) {
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    try {
      const res = await route.fetch();
      const body = await res.json().catch(() => null);
      await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
    } catch {
      // The page is gone: nothing to answer.
    }
  });
}

test("a player's test switches are ignored: no menu skipped, no match on window, no crate test boxes; an admin's work", async ({ page }) => {
  test.setTimeout(2 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await switchesOff(page);

  // A player. ?boss= would skip the boss menu: Boss alone opens it.
  await page.goto("/?debug&boss=pig&laststand=1");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
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
