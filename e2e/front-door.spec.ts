import { expect, test } from "@playwright/test";
import { named } from "./helpers.ts";

const live = (p: import("@playwright/test").Page) => p.evaluate(() => fetch("/api/live").then((r) => r.json()));

test("home: the live line comes from the server, the mode picker changes the line under PLAY, Classic is coming", async ({ page, browser }) => {
  await named(page, "Eric");
  await page.goto("/");
  await expect(page.locator(".fd-logo")).toHaveText("HunChess");
  await expect(page.getByRole("button", { name: "Your profile" })).toBeVisible();
  await expect(page.locator(".fd-hero-name")).toHaveText("Eric");
  // The live line: you're online (the app told the server you're here).
  const line = page.getByRole("status").filter({ hasText: "online" });
  await expect(line).toBeVisible();
  const before = await live(page);
  expect(before.online).toBeGreaterThanOrEqual(1);
  await expect(line).toContainText(`${before.online} online`);
  // Someone else waiting in the queue shows up in the count within a few seconds.
  const other = await (await browser.newContext()).newPage();
  await other.goto(`/?pool=home-${test.info().project.name}`);
  await other.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(async () => (await live(page)).queue, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  await expect(line).toContainText(/[1-9]\d* in queue/, { timeout: 10_000 });
  await other.close();
  // The line under PLAY follows the mode; Classic can't be queued for yet.
  await page.getByRole("radio", { name: /Boss raid/ }).click();
  await expect(page.locator(".fd-hint")).toHaveText("Join a raid; the boss matches the group");
  await page.getByRole("radio", { name: /Classic/ }).click();
  await expect(page.locator(".fd-hint")).toHaveText("Classic is being reworked");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeDisabled();
  await page.getByRole("radio", { name: /Crowd/ }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeEnabled();
  // No sideways scrolling, and big tap targets.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  for (const name of ["Play with friends", "Boss alone", "Shop & crates", "Profile"]) {
    const box = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test("home: Boss alone opens the boss menu; Play with friends offers lobbies and solo practice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Boss alone" }).click();
  const menu = page.getByRole("dialog", { name: "Choose your boss" });
  await expect(menu.locator(".boss-row")).toHaveCount(10);
  await menu.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Play with friends" }).click();
  const sheet = page.getByRole("dialog", { name: "Play with friends" });
  await expect(sheet.getByRole("button", { name: "Create a lobby" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Join lobby" })).toBeDisabled();
  await sheet.getByLabel("Lobby code").fill("abcde");
  await expect(sheet.getByLabel("Lobby code")).toHaveValue("ABCDE");
  await expect(sheet.getByRole("button", { name: "Join lobby" })).toBeEnabled();
  await expect(sheet.getByRole("button", { name: "Solo vs 99 bots" })).toBeVisible();
});

test("settings: the old home's options live here and stick", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  const practice = page.getByRole("switch", { name: /Practice mode/ });
  await expect(practice).not.toBeChecked();
  await practice.click();
  await page.getByRole("radio", { name: /Everyone moves/ }).click();
  await page.reload();
  await expect(page.getByRole("switch", { name: /Practice mode/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /Everyone moves/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
});

test("the queue: your pawn first and ringed, others pop in, Cancel frees the seat, then bots fill the rest (rate-limited pops)", async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const opts = test.info().project.use;
  const ann = await (await browser.newContext({ ...opts })).newPage();
  const bo = await (await browser.newContext({ ...opts })).newPage();
  await named(ann, "Ann");
  await named(bo, "Bo");
  await ann.addInitScript(() => ((window as any).__soundLog = []));
  // A queue of its own, so other tests' players don't land in it.
  for (const p of [ann, bo]) await p.goto(`/?debug&pool=queue-${test.info().project.name}`);
  await ann.getByRole("button", { name: "PLAY", exact: true }).click();
  // The queue screen, not a lobby: the count, the line, the grid.
  await expect(ann.locator(".fd-seats .fd-seat")).toHaveCount(100);
  await expect(ann.locator(".fd-queue-line")).toContainText(/Finding players · \d+ s, then bots fill the rest/);
  await expect(ann.getByText("You're in · seat 1")).toBeVisible();
  await expect(ann.locator(".fd-seat").first()).toHaveClass(/you/);
  await bo.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(ann.locator(".fd-count-n")).toHaveText("2");
  await expect(ann.locator(".fd-seat:not(.empty)")).toHaveCount(2);
  // Each sees themself in seat 1.
  await expect(bo.locator(".fd-seat.you")).toHaveCount(1);
  await expect(bo.locator(".fd-seat").first()).toHaveClass(/you/);
  // The mute switch in the queue's corner: the pops from here on are silent.
  const before: string[] = await ann.evaluate(() => (window as any).__soundLog);
  expect(before.some((l) => l.startsWith("pop:") && !l.endsWith(":muted"))).toBe(true);
  await ann.getByRole("button", { name: "Turn sound off" }).click();
  // Bo cancels: home again, and Ann's count drops.
  await bo.getByRole("button", { name: "Cancel" }).click();
  await expect(bo.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(ann.locator(".fd-count-n")).toHaveText("1");
  // Time's up (8 s locally): bots pop into the empty seats, then the match begins.
  await expect(ann.locator(".fd-count-n")).toHaveText("100", { timeout: 20_000 });
  await expect(ann.locator(".fd-queue-line")).toContainText("Bots fill the rest");
  await expect(ann.locator(".fd-seat.bot")).toHaveCount(99);
  await expect.poll(() => ann.evaluate(() => (window as any).match?.phase.kind), { timeout: 20_000 }).toBe("vote");
  // Pops: one for each person, and the bots' 99 pops rate-limited to a handful, quieter.
  const log: string[] = await ann.evaluate(() => (window as any).__soundLog);
  const pops = log.filter((l) => l.startsWith("pop:")).length;
  const soft = log.filter((l) => l.startsWith("popSoft:")).length;
  expect(pops).toBeGreaterThanOrEqual(1);
  expect(soft).toBeGreaterThan(3);
  expect(soft).toBeLessThan(30);
  expect(log.filter((l) => l.startsWith("popSoft:")).every((l) => l.endsWith(":muted"))).toBe(true);
  await ann.evaluate(() => localStorage.setItem("brc.muted", "0"));
  // No sideways scroll; the grid fits.
  expect(await ann.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});
