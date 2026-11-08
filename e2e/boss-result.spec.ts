import { expect, type Page } from "@playwright/test";
import { test, bossAloneFromHome, submitMove } from "./helpers.ts";

/**
 * Eric, Nov 7: a boss battle's result screen has no trophy or skull above its title, its title in the God King's pixel type,
 * no record text ("A win on your record", "It counts as a loss"), and the boss's line in its bubble (a victory when it wins,
 * a defeat when you do). Phone and computer. RESULT_SHOTS=<dir> saves the two result screens (phone and computer) there.
 */
const SHOTS = process.env.RESULT_SHOTS;

async function resultOf(page: Page, project: string, name: string) {
  const results = page.locator(".results");
  await expect(results.locator("h1")).toHaveClass(/boss-title/);
  // No trophy and no skull above the title: nothing before the title in the top part.
  await expect(results.locator(".trophy")).toHaveCount(0);
  await expect(results).not.toContainText("💀");
  await expect(results).not.toContainText("🏆");
  // No record line, win or loss counted, in any words.
  await expect(results).not.toContainText(/on your record|counts as a (win|loss)|a win on|a loss on/i);
  // The boss's line in its bubble, typed out in full (its rest, not yet typed, is empty), inside the screen with a 16 px gutter
  // on each side, centered over him.
  const bubble = results.locator(".bc-bubble");
  await expect(bubble).not.toBeEmpty({ timeout: 15_000 });
  await expect(bubble.locator(".speech-rest")).toHaveText("", { timeout: 15_000 });
  const line = (await bubble.locator(".speech-line").innerText()).trim();
  expect(line.length, "a line").toBeGreaterThan(10);
  // (The full line: what's typed (the shown part) is all of it now.)
  expect(await bubble.locator(".speech-line").textContent()).toContain(line);
  const vw = page.viewportSize()!.width;
  const box = (await bubble.boundingBox())!;
  expect(box.x, "left gutter").toBeGreaterThanOrEqual(16);
  expect(box.x + box.width, "right gutter").toBeLessThanOrEqual(vw - 16);
  const boss = (await page.locator(".boss-char.place-results").boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - (boss.x + boss.width / 2)), "centered over him").toBeLessThan(8);
  expect(box.y + box.height, "above him").toBeLessThanOrEqual(boss.y);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` });
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
