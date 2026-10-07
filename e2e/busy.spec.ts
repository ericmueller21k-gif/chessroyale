import { expect } from "@playwright/test";
import { named, test } from "./helpers.ts";

/**
 * Servers busy (DECISIONS.md, "Capacity: built"): past the matchmaker's admission rate or the overload limit, PLAY
 * answers "busy" with a ticket and about how long. The queue screen says so, asks again with the ticket (keeping the
 * place in line), and moves on to the usual queue once there's a seat. Overload can't be made on demand here, so the
 * first answers are the server's busy answer, word for word; the rest go to the real server.
 */
const busyAnswer = (waitSeconds: number) => ({
  busy: true,
  ticket: "test-ticket-0001",
  position: 40,
  waitSeconds,
  retryMs: 1200,
  message: `Servers are busy, you're in line: about ${waitSeconds} s`,
});

test("servers busy: you're told you're in line and about how long, then the queue takes you in", async ({ page }) => {
  await named(page, "Ann");
  const asked: string[] = [];
  let n = 0;
  await page.route("**/api/play*", async (route) => {
    asked.push(route.request().url());
    if (n++ < 2) return route.fulfill({ json: busyAnswer(n === 1 ? 20 : 15) });
    return route.continue();
  });
  await page.goto(`/?pool=busy-${test.info().project.name}`);
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  const line = page.locator(".fd-queue-busy");
  await expect(line).toHaveText("Servers are busy, you're in line: about 20 s");
  await expect(page.getByText("You're in line", { exact: true })).toBeVisible();
  await expect(line).toHaveText("Servers are busy, you're in line: about 15 s");
  // A seat: the usual queue.
  await expect(page.locator(".fd-queue-line")).toContainText(/Finding players · \d+ s, then bots fill the rest/);
  await expect(page.getByText("You're in · seat 1")).toBeVisible();
  // It asked again with its ticket, so it kept its place.
  expect(asked.length).toBe(3);
  expect(new URL(asked[1]!).searchParams.get("ticket")).toBe("test-ticket-0001");
  expect(new URL(asked[2]!).searchParams.get("ticket")).toBe("test-ticket-0001");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  // No sideways scroll on the busy screen either (checked above while it showed; here the page is home again).
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("servers busy: Cancel while in line goes home and stops asking", async ({ page }) => {
  await named(page, "Bo");
  let asked = 0;
  await page.route("**/api/play*", (route) => {
    asked++;
    return route.fulfill({ json: busyAnswer(45) });
  });
  await page.goto(`/?pool=busy2-${test.info().project.name}`);
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(page.locator(".fd-queue-busy")).toHaveText("Servers are busy, you're in line: about 45 s");
  // On a narrow phone (360 px) the whole line shows, with nothing off the side.
  await page.setViewportSize({ width: 360, height: 740 });
  const box = (await page.locator(".fd-queue-busy").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(await page.locator(".fd-queue-busy").evaluate((el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  const after = asked;
  await page.waitForTimeout(3000);
  expect(asked).toBe(after);
});
