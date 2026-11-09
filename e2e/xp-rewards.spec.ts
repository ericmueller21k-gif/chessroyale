import { expect, type Page } from "@playwright/test";
import { asServerAdmin, bossAloneFromHome, giveCrates, submitMove, test } from "./helpers.ts";

/**
 * XP phase 2 (Eric, Nov 9: "go with phase two"; docs/decisions/2026-11-09-xp-phase2-*.md), phone and computer: the daily reward in
 * the result's XP box ("Daily reward +200") and its toast ("+1 Winter Crate"); a level-up's toast with its crates and key and the
 * Crates tab after it (the counts, a crate opened with the key, then refused without one, a padlock on the crate it can't open);
 * every 10th level's boss crate, chosen in the Crates tab; an admin's +100 crate keys. Each game is a won Boss alone game counted as
 * 12 minutes (?xpgame=12) against Ginger (?win needs a boss whose powers don't get in its way); its moves are the device's word, so
 * the daily reward's 15 are said by the test (`moves`). REWARD_SHOTS=<dir> saves the stills (the level-up toast, the boss crate
 * choice, the Crates tab with keys and a locked crate).
 */
const SHOTS = process.env.REWARD_SHOTS;

/** Your account's XP, once it's loaded and the ?xp= switch has set it. */
async function xpIs(page: Page, xp: number) {
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "hc_session"), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => ((await (await page.request.get("/api/me")).json()) as { xp?: number }).xp, { timeout: 20_000 }).toBe(xp);
}

/** A won Boss alone game counted as 12 minutes, from `xp` XP; `moves`: the moves the device says it played (null: as it played). */
async function wonGame(page: Page, xp: number, moves: number | null = null) {
  if (moves !== null) {
    await page.route("**/api/results", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      await route.continue({ postData: JSON.stringify({ ...body, moves }) });
    });
  }
  await page.goto(`/?debug&pace=quick&win=1&boss=gingerbread&xp=${xp}&xpgame=12`);
  await xpIs(page, xp);
  await bossAloneFromHome(page);
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind), { timeout: 60_000 }).toBe("play");
  await submitMove(page, "h5f7");
  await expect(page.locator(".results h1")).toHaveText("Victory!", { timeout: 120_000 });
  await expect(page.getByTestId("xp-box")).toHaveClass(/xp-done/, { timeout: 20_000 });
}

/** The locker as the server has it. */
const locker = async (page: Page) =>
  ((await (await page.request.get("/api/locker")).json()) as { seriesCrates: Record<string, number>; keys: number; bossPicks: number; bossCrates: Record<string, number> });

test("the daily reward: the day's first counted game of 15 moves says \"Daily reward +200\" in the XP box, and its toast \"+1 Winter Crate\"; the next game doesn't", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await wonGame(page, 0, 20);
  const box = page.getByTestId("xp-box");
  await expect(box.locator(".xp-parts")).toHaveText("12 min +120 · Win +50 · Daily reward +200");
  await expect(box.locator(".xp-gain")).toHaveText("+370 XP");
  const toast = page.getByTestId("reward-box");
  await expect(toast).toContainText("Daily reward");
  await expect(toast).toContainText("Daily reward: +1 Winter Crate");
  await expect(toast.locator('[data-thing="crates"]')).toHaveText("×1");
  // (It takes no taps: the result screen's buttons stay tappable under it, and nothing moved.)
  expect(await toast.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
  expect((await locker(page)).seriesCrates).toEqual({ "winter-1": 1 });
  // It goes on its own.
  await expect(toast).toHaveCount(0, { timeout: 10_000 });
  // The next game today: its own XP, no daily reward.
  await wonGame(page, 370, 20);
  await expect(page.getByTestId("xp-box").locator(".xp-parts")).toHaveText("12 min +120 · Win +50");
  await expect(page.getByTestId("reward-box")).toHaveCount(0);
  expect((await locker(page)).seriesCrates).toEqual({ "winter-1": 1 });
});

test("a level-up: its toast (\"Level 2!\", 2 Winter Crates and a key); the Crates tab shows them, opens one with the key, then the other is locked and refused", async ({ page }, testInfo) => {
  test.setTimeout(4 * 60_000);
  // 990 XP, then +170: Level 2.
  await wonGame(page, 990);
  const toast = page.getByTestId("reward-box");
  await expect(toast).toContainText("Level 2!");
  await expect(toast).toContainText("+2 Winter Crates · +1 crate key");
  await expect(toast.locator('[data-thing="crates"]')).toHaveText("×2");
  await expect(toast.locator('[data-thing="keys"]')).toHaveText("×1");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/levelup-toast-${testInfo.project.name}.png` });
  expect(await locker(page)).toMatchObject({ seriesCrates: { "winter-1": 2 }, keys: 1, bossPicks: 0 });
  // The Crates tab: the key, the two Winter Crates; the Beta Crate (none held) has a padlock.
  await page.goto("/shop?crates");
  const crates = page.locator(".crates");
  await expect(crates.getByText("Keys × 1")).toBeVisible();
  await expect(crates.getByText("Crates × 2")).toBeVisible();
  const winter = crates.locator('.series-crate-row[data-crate="winter-1"]');
  const beta = crates.locator('.series-crate-row[data-crate="beta-001"]');
  await expect(winter).toContainText("You have 2");
  await expect(winter.locator(".crate-lock")).toHaveCount(0);
  await expect(beta).toContainText("You have none");
  await expect(beta.locator(".crate-lock")).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/crates-keys-${testInfo.project.name}.png`, fullPage: true });
  // Open one with the key: the usual strip and reveal; then one crate left and no key.
  await winter.click();
  await expect(page.locator(".crate-held")).toHaveText("You have 2, and 1 key.");
  await page.getByRole("button", { name: /Open · uses 1 key/ }).click();
  await expect(page.locator(".reveal-card")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "▶ Open another" })).toBeDisabled();
  expect(await locker(page)).toMatchObject({ seriesCrates: { "winter-1": 1 }, keys: 0 });
  await page.getByRole("button", { name: "▶ Done" }).click();
  await expect(page.locator(".crate-held")).toHaveText("You have 1. You need a crate key to open one: each level gives you one.");
  await expect(page.getByRole("button", { name: /Open · uses 1 key/ })).toBeDisabled();
  await page.getByRole("button", { name: "‹ Crates" }).click();
  await expect(winter.locator(".crate-lock")).toBeVisible();
  // Refused without a key by the server too (an older app, or a tap that got through), nothing spent.
  const refused = await page.request.post("/api/locker/open", { data: { crate: "winter-1" } });
  expect([refused.status(), ((await refused.json()) as { message: string }).message]).toEqual([400, "You need a Winter Crate and a crate key to open it."]);
  expect(await locker(page)).toMatchObject({ seriesCrates: { "winter-1": 1 }, keys: 0 });
});

test("every 10th level: a boss crate to choose; its toast says so, the Crates tab's choice picks Babur's crate, which is then yours to open", async ({ page }, testInfo) => {
  test.setTimeout(4 * 60_000);
  // 9,990 XP (the levels below never paid: a test switch's jump), then +170: Level 10, every level from 2 paid at once.
  await wonGame(page, 9_990);
  const toast = page.getByTestId("reward-box");
  await expect(toast).toContainText("Level 10!");
  await expect(toast).toContainText("+18 Winter Crates · +9 crate keys");
  await expect(toast).toContainText("Choose your boss crate in Crates.");
  expect((await locker(page)).bossPicks).toBe(1);
  await page.goto("/shop?crates");
  const row = page.locator(".boss-pick-row");
  await expect(row).toHaveAttribute("data-picks", "1");
  await expect(row).toContainText("Choose your boss crate");
  await row.click();
  await expect(page.locator(".boss-pick-said")).toHaveText("1 to choose.");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/boss-pick-${testInfo.project.name}.png`, fullPage: true });
  await page.locator('.boss-pick[data-crate="boss-tiger"]').click();
  await expect(page.locator(".boss-pick-said")).toHaveText("Babur's Boss Crate is in your inventory.");
  await expect(page.locator('.boss-pick[data-crate="boss-tiger"]')).toBeDisabled();
  await page.getByRole("button", { name: "‹ Crates" }).click();
  await expect(row).toHaveAttribute("data-picks", "0");
  await expect(row).toHaveClass(/none/);
  await expect(page.locator('.boss-crate-row[data-crate="boss-tiger"]')).toContainText("You have 1");
  expect(await locker(page)).toMatchObject({ bossPicks: 0, bossCrates: { "boss-tiger": 1 } });
});

test("an admin grants themselves 100 crate keys at once in the Crates tab", { tag: "@phone-only" }, async ({ page }) => {
  await asServerAdmin(page);
  await giveCrates(page, "winter-1", 1, 0);
  await page.goto("/shop?crates");
  const crates = page.locator(".crates");
  await expect(crates.getByText("Keys × 0")).toBeVisible();
  await expect(crates.locator('.series-crate-row[data-crate="winter-1"] .crate-lock')).toBeVisible();
  await page.getByRole("region", { name: "Admin test grants" }).getByRole("button", { name: "+100 crate keys" }).click();
  await expect(crates.getByText("Keys × 100")).toBeVisible();
  await expect(crates.locator('.series-crate-row[data-crate="winter-1"] .crate-lock')).toHaveCount(0);
});
