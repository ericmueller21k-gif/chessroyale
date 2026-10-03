import { expect, test } from "@playwright/test";

const phase = (p: any) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

test("only piece sounds and clock ticks play, and muting silences them", async ({ page }) => {
  await page.addInitScript(() => ((window as any).__soundLog = []));
  await page.goto("/?debug&pace=quick");
  await page.getByLabel("Your name").fill("T");
  await page.getByRole("button", { name: /Play solo/ }).click();
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  // The round opens with the "Round start" 3-2-1 on the board, then the clock bar runs.
  await expect(page.locator(".cc-banner")).toHaveText("Round start");
  await expect(page.locator(".center-count")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator(".timer-bar")).toBeVisible();
  await page.getByRole("button", { name: /Power-up/ }).click();
  await expect(page.locator(".hints li")).toHaveCount(3, { timeout: 15_000 });
  await page.evaluate(() => (window as any).match.submit((window as any).match.hint[0].move));
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("reveal");
  await page.waitForTimeout(4000);
  const log: string[] = await page.evaluate(() => (window as any).__soundLog);
  const names = log.map((l) => l.split(":")[0]);
  expect(names).toContain("tick");
  expect(names.some((n) => n === "move" || n === "capture")).toBe(true);
  // Nothing else makes a sound: no jingles for the power-up, the reveal or the round start.
  expect(names.every((n) => ["move", "capture", "castle", "tick"].includes(n))).toBe(true);
  // The audio context was running (unlocked by the tap), so they were actually heard.
  expect(log.filter((l) => l.startsWith("tick")).every((l) => l.includes(":running"))).toBe(true);
  // Muting silences them.
  await page.getByRole("button", { name: "Turn sound off" }).first().click();
  await page.evaluate(() => ((window as any).__soundLog = []));
  await page.evaluate(() => (window as any).match.skipReveal());
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => (window as any).__soundLog.length), { timeout: 10_000 }).toBeGreaterThan(0);
  const after: string[] = await page.evaluate(() => (window as any).__soundLog);
  expect(after.every((l) => l.endsWith(":muted"))).toBe(true);
});
