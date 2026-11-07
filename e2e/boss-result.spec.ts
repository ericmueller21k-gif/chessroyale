import { expect, type Page } from "@playwright/test";
import { test, bossAloneFromHome, submitMove } from "./helpers.ts";

/**
 * Eric, Nov 7: a boss battle's result screen has no trophy or skull above its title, its title in the God King's pixel type,
 * no record text ("A win on your record", "It counts as a loss"), and the boss's line in its bubble (a victory when it wins,
 * a defeat when you do). Phone and computer. RESULT_SHOTS=<dir> saves the two result screens (phone and computer) there.
 */
const SHOTS = process.env.RESULT_SHOTS;

async function resultOf(page: Page, project: string, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` });
  const results = page.locator(".results");
  await expect(results.locator("h1")).toHaveClass(/boss-title/);
  // No trophy and no skull above the title: nothing before the title in the top part.
  await expect(results.locator(".trophy")).toHaveCount(0);
  await expect(results).not.toContainText("💀");
  await expect(results).not.toContainText("🏆");
  // No record line, win or loss counted, in any words.
  await expect(results).not.toContainText(/on your record|counts as a (win|loss)|a win on|a loss on/i);
  // The boss's line in its bubble, said as the result shows.
  await expect(results.locator(".bc-bubble")).not.toBeEmpty({ timeout: 15_000 });
  // The ranking note, when it's true for this match (boss alone is unranked), and nothing else of a record.
  await expect(results.locator(".results-unranked")).toHaveText("Unranked: solo games don't count for ranking.");
}

test("a boss battle's victory and defeat screens: the title in the pixel type, no trophy or skull, no record text, the boss's line", async ({ page }, testInfo) => {
  test.setTimeout(3 * 60_000);
  // A boss beats you at once (?mate=1): Defeated, and the boss's victory line.
  await page.goto("/?debug&pace=quick&mate=1");
  await bossAloneFromHome(page);
  await expect(page.locator(".results h1")).toHaveText("Defeated", { timeout: 120_000 });
  await resultOf(page, testInfo.project.name, "defeat");
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
});

test("a boss battle won: Victory!, no trophy or skull, no record text, the boss's defeat line", async ({ page }, testInfo) => {
  test.setTimeout(3 * 60_000);
  // You mate the boss at once (?win=1): Victory!, and the boss's defeat line.
  await page.goto("/?debug&pace=quick&win=1");
  await bossAloneFromHome(page);
  // Your move (?win=1: Qxf7 mates him, from h5).
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind), { timeout: 60_000 }).toBe("play");
  await submitMove(page, "h5f7");
  await expect(page.locator(".results h1")).toHaveText("Victory!", { timeout: 120_000 });
  await resultOf(page, testInfo.project.name, "victory");
});
