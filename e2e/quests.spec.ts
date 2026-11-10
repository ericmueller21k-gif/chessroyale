import { expect, type Page } from "@playwright/test";
import { asSignedIn, bossAloneFromHome, pickMode, submitMove, test } from "./helpers.ts";

/**
 * Quests (XP phase 3, Nov 9; docs/decisions/2026-11-09-quests-*.md), phone and computer: the overlay with the server's quests from the
 * Quests button and the reroll (once a day per daily, kept by the server); the overlay by itself on a signed-in account's first home visit of
 * the day, once; the entry greyed for a guest where sign-in is set up; a quest finished by a game: its line in the result's toast, its
 * XP in the box ("Quests +1,800") and "Done!" in the overlay after. The test switch ?quests=<kind>[:<progress>],… sets your quests.
 * QUESTS_SHOTS=<dir> saves the stills (the overlay light and dark, a finished quest, the result's toast, a 320 px top bar).
 */
const SHOTS = process.env.QUESTS_SHOTS;

type Answer = { quests: { id: string; name: string; progress: number; target: number; canReroll: boolean }[]; day: number };
const answer = async (page: Page) => (await (await page.request.get("/api/quests")).json()) as Answer;

/** Home with your quests set by the test switch, once the server has them. */
async function homeWith(page: Page, quests: string, names: string[]) {
  await page.goto(`/?quests=${quests}`);
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "hc_session"), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => (await answer(page)).quests.map((q) => q.name), { timeout: 20_000 }).toEqual(names);
}

const dialog = (page: Page) => page.getByRole("dialog", { name: "Daily Quests" });
const entry = (page: Page) => page.getByRole("button", { name: "Quests", exact: true });

test("the Quests button opens the server's quests (names, goals, progress, rewards, the countdowns); the reroll swaps a daily once a day (each its own) and the server keeps it", async ({ page }, testInfo) => {
  await homeWith(page, "squad-up:1,fifty-fifty,regular:3", ["Squad Up", "Fifty-Fifty", "Regular"]);
  await expect(entry(page)).toBeEnabled();
  await entry(page).click();
  const d = dialog(page);
  await expect(d).toBeVisible();
  await expect(d.locator(".qo-name")).toHaveText(["Squad Up", "Fifty-Fifty", "Regular"]);
  await expect(d.locator(".qo-goal")).toHaveText(["Play 2 Squads games", "Play a 50 v 50 game", "Complete 10 games"]);
  await expect(d.locator(".qo-count")).toHaveText(["1/2", "0/1", "3/10"]);
  await expect(d.locator(".qo-row.weekly .qo-xp")).toHaveText("+1,500 XP");
  await expect(d.getByText(/^New quests in \d+[hm]$/)).toBeVisible();
  await expect(d.getByText(/^Resets in \d+[dhm]$/)).toBeVisible();
  if (SHOTS) {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${SHOTS}/quests-overlay-${testInfo.project.name}-${scheme}.png` });
    }
  }
  // The reroll: Squad Up (1/2) swapped for a quest you don't hold, at 0; only its reroll greys (still there), Fifty-Fifty keeps its own.
  await d.locator(".qo-row").first().locator(".qo-reroll").click();
  await expect(d.locator(".qo-name").first()).not.toHaveText("Squad Up");
  await expect(d.locator(".qo-name").first()).not.toHaveText("Fifty-Fifty");
  await expect(d.locator(".qo-reroll").first()).toBeDisabled();
  await expect(d.locator(".qo-reroll").nth(1)).toBeEnabled();
  const swapped = await d.locator(".qo-name").first().textContent();
  await d.getByRole("button", { name: "Got it" }).click();
  await expect(d).toHaveCount(0);
  // (The server's: home again (without the test switch, which would set them again), the same quests, the swapped one's reroll used.)
  await page.goto("/");
  await expect(entry(page)).toBeEnabled({ timeout: 20_000 });
  await entry(page).click();
  await expect(dialog(page).locator(".qo-name")).toHaveText([swapped!, "Fifty-Fifty", "Regular"]);
  await expect(dialog(page).locator(".qo-reroll").first()).toBeDisabled();
  await expect(dialog(page).locator(".qo-reroll").nth(1)).toBeEnabled();
  expect((await answer(page)).quests.map((q) => q.canReroll)).toEqual([false, true, false]);
  await dialog(page).getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
});

test.describe("the day's first home visit", () => {
  test.use({ questsSeen: false });

  test("signed in: the overlay opens by itself, once a day on this device (a guest's day never opens it)", async ({ page }) => {
    await page.goto("/");
    await expect(entry(page)).toBeEnabled({ timeout: 20_000 });
    // (A guest: no first-visit overlay.)
    await expect.poll(async () => (await answer(page)).quests.length, { timeout: 20_000 }).toBe(3);
    await page.waitForTimeout(1_000);
    await expect(dialog(page)).toHaveCount(0);
    await asSignedIn(page);
    await page.reload();
    await expect(dialog(page)).toBeVisible({ timeout: 20_000 });
    await expect(dialog(page).locator(".qo-row")).toHaveCount(3);
    await dialog(page).getByRole("button", { name: "Got it" }).click();
    // The same day again: not by itself (the button still opens it).
    const seen = page.waitForResponse((r) => r.url().endsWith("/api/quests"));
    await page.reload();
    await seen;
    await page.waitForTimeout(1_000);
    await expect(dialog(page)).toHaveCount(0);
    // A new day (this device last showed it yesterday): again.
    const day = (await answer(page)).day;
    await page.evaluate((d) => localStorage.setItem("hunchess.quests.seenDay", String(d - 86_400_000)), day);
    await page.reload();
    await expect(dialog(page)).toBeVisible({ timeout: 20_000 });
  });

  test("not by itself over the queue: the answer coming in while you queue keeps the day due for the next home visit (review of #575, m3)", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("brc.matchmaking", "botsoff"));
    await page.goto(`/?pool=quests-queue-${test.info().project.name}`);
    await expect(entry(page)).toBeEnabled({ timeout: 20_000 });
    await asSignedIn(page);
    // (A slow network: the quests' answer held until you're in the queue.)
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/api/quests", async (route) => {
      await held;
      await route.continue();
    });
    await page.reload();
    await pickMode(page);
    await page.getByRole("button", { name: "PLAY", exact: true }).click();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible({ timeout: 20_000 });
    const came = page.waitForResponse((r) => r.url().endsWith("/api/quests"));
    release();
    await came;
    await page.waitForTimeout(1_000);
    await expect(dialog(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("hunchess.quests.seenDay"))).toBeNull();
    // (Out of the queue, the next home visit: it opens.)
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.unroute("**/api/quests");
    await page.reload();
    await expect(dialog(page)).toBeVisible({ timeout: 20_000 });
  });
});

test("a guest where sign-in is set up: the Quests entry is there, greyed, \"Sign in for quests\"", async ({ page }) => {
  await page.route("**/api/auth/config", async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: { ...((await res.json()) as object), onlineNeedsSignIn: true } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play vs 99 bots as a guest" }).click();
  await expect(entry(page)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".fd-top-quests, .fd-quests-btn").first()).toHaveAttribute("title", "Sign in for quests");
  await expect(entry(page)).toBeDisabled();
});

test("a game that finishes quests: \"Quests +1,800\" in its XP box, \"Quest done: …\" in its toast, and Done! in the overlay after", async ({ page }, testInfo) => {
  test.setTimeout(4 * 60_000);
  // Warm Up at 2 of 3 and the weekly at 9 of 10: a won Boss alone game counted as 12 minutes (?xpgame=12) finishes both.
  await page.goto("/?debug&pace=quick&win=1&boss=gingerbread&xpgame=12&quests=warm-up:2,squad-up,regular:9");
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "hc_session"), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => (await answer(page)).quests.map((q) => `${q.name} ${q.progress}`), { timeout: 20_000 }).toEqual(["Warm Up 2", "Squad Up 0", "Regular 9"]);
  await bossAloneFromHome(page);
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind), { timeout: 60_000 }).toBe("play");
  await submitMove(page, "h5f7");
  await expect(page.locator(".results h1")).toHaveText("Victory!", { timeout: 120_000 });
  const box = page.getByTestId("xp-box");
  await expect(box).toHaveClass(/xp-done/, { timeout: 20_000 });
  await expect(box.locator(".xp-parts")).toHaveText("Win +50 · Quests +1,800");
  const toast = page.getByTestId("reward-box");
  await expect(toast).toContainText("Quest done: Warm Up +300 XP");
  await expect(toast).toContainText("Quest done: Regular +1,500 XP · +1 Winter Crate · +1 crate key");
  if (SHOTS) {
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SHOTS}/quests-toast-${testInfo.project.name}.png` });
  }
  // Home: both done (their bars full, a check, "Done!"); no reroll on a finished daily.
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(entry(page)).toBeEnabled({ timeout: 20_000 });
  await entry(page).click();
  const d = dialog(page);
  await expect(d.locator(".qo-row.done .qo-name")).toHaveText(["Warm Up", "Regular"]);
  await expect(d.locator('.qo-row[data-quest] .qo-count')).toHaveText(["Done!", "0/2", "Done!"]);
  await expect(d.locator(".qo-row.done .qo-reroll")).toBeDisabled();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/quests-done-${testInfo.project.name}.png` });
  // (Paid once: a reload of the result changes nothing; the server has both done.)
  expect((await answer(page)).quests.map((q) => `${q.progress}/${q.target}`)).toEqual(["3/3", "0/2", "10/10"]);
});

test("a 320 px phone's top bar: the logo, your pawn, Quests, the shop, Friends and the gear in one row, every button 40 px", { tag: "@phone-only" }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "the phone's top bar");
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await expect(entry(page)).toBeEnabled({ timeout: 20_000 });
  const bar = page.locator(".fd-top");
  for (const name of ["Your profile", "Quests", "Shop & crates", "Friends", "Settings"]) {
    const b = (await bar.getByRole("button", { name, exact: true }).boundingBox())!;
    expect(Math.min(b.width, b.height), name).toBeGreaterThanOrEqual(40);
  }
  const row = await bar.evaluate((el) => {
    const kids = [...el.querySelectorAll(":scope > .fd-logo, .fd-top-end button")].map((k) => k.getBoundingClientRect());
    return { tops: [...new Set(kids.slice(1).map((k) => Math.round(k.top)))].length, apart: kids.every((k, i) => i === 0 || k.left >= kids[i - 1]!.right - 0.5), right: Math.max(...kids.map((k) => k.right)), logo: kids[0]!.width };
  });
  expect(row.tops).toBe(1);
  expect(row.apart).toBe(true);
  expect(row.right).toBeLessThanOrEqual(320);
  expect(row.logo, "the logo is its icon").toBeGreaterThan(20);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/quests-topbar-320.png`, clip: { x: 0, y: 0, width: 320, height: 120 } });
});
