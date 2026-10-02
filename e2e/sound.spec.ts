import { expect, test } from "@playwright/test";

const phase = (p: any) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

test("sounds play for the round start, moves, the power-up and the reveal", async ({ page }) => {
  await page.addInitScript(() => ((window as any).__soundLog = []));
  await page.goto("/?debug");
  await page.getByLabel("Your name").fill("T");
  await page.getByRole("button", { name: /Play solo/ }).click();
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  await expect(page.locator(".replay-tag")).toHaveCount(0);
  await page.getByRole("button", { name: /Power-up/ }).click();
  await expect(page.locator(".hints li")).toHaveCount(3, { timeout: 15_000 });
  await page.evaluate(() => (window as any).match.submit((window as any).match.hint[0].move));
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("reveal");
  await page.waitForTimeout(3200);
  const log: string[] = await page.evaluate(() => (window as any).__soundLog);
  const names = log.map((l) => l.split(":")[0]);
  for (const n of ["roundStart", "powerUp", "allIn"]) expect(names).toContain(n);
  expect(names.some((n) => n === "move" || n === "capture")).toBe(true);
  // The audio context was running (unlocked by the tap), so they were actually heard.
  expect(log.filter((l) => l.startsWith("powerUp")).every((l) => l.includes(":running"))).toBe(true);
  // Muting silences them.
  await page.getByRole("button", { name: "Turn sound off" }).first().click();
  await page.evaluate(() => ((window as any).__soundLog = []));
  await page.evaluate(() => (window as any).match.skipReveal());
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  await page.waitForTimeout(300);
  const after: string[] = await page.evaluate(() => (window as any).__soundLog);
  expect(after.length).toBeGreaterThan(0);
  expect(after.every((l) => l.endsWith(":muted"))).toBe(true);
});
