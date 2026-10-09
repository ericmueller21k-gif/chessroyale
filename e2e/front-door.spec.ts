import { expect } from "@playwright/test";
import { named, test } from "./helpers.ts";

const live = (p: import("@playwright/test").Page) => p.evaluate(() => fetch("/api/live").then((r) => r.json()));

test("home: the live line comes from the server, the mode picker changes the line under PLAY, Classic is coming", async ({ page, browser }) => {
  await named(page, "Eric");
  await page.goto("/");
  // The logo you can see: the top bar's on a phone, the side menu's on a computer (both are in the page).
  await expect(page.locator(".fd-logo").filter({ visible: true })).toHaveText("HunChess");
  await expect(page.getByRole("button", { name: "Your profile" })).toBeVisible();
  await expect(page.locator(".fd-hero-name")).toHaveText("Eric");
  // The live line: you're online (the app told the server you're here).
  const line = page.getByRole("status").filter({ hasText: "online" });
  await expect(line).toBeVisible();
  const before = await live(page);
  expect(before.online).toBeGreaterThanOrEqual(1);
  // (Other tests' players come and go, so the number itself can move between two looks.)
  await expect(line).toContainText(/[1-9]\d* online/);
  // Someone else waiting in the queue shows up in the count within a few seconds.
  const other = await (await browser.newContext()).newPage();
  await other.goto(`/?pool=home-${test.info().project.name}`);
  await other.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(async () => (await live(page)).queue, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  await expect(line).toContainText(/[1-9]\d* in queue/, { timeout: 10_000 });
  await other.close();
  // The line under PLAY follows the mode; Classic can't be queued for yet.
  await page.getByRole("radio", { name: /Boss raid/ }).click();
  await expect(page.locator(".fd-hint")).toHaveText(/^Join a raid; bots fill the crowd after \d+ s$/);
  await page.getByRole("radio", { name: /Classic/ }).click();
  await expect(page.locator(".fd-hint")).toHaveText("Classic is being reworked");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeDisabled();
  await page.getByRole("radio", { name: /Crowd/ }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeEnabled();
  // No sideways scrolling, and big tap targets.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  for (const name of ["Play with friends", "Boss alone", "Shop & crates", "Profile"]) {
    const box = (await page.getByRole("main").getByRole("button", { name, exact: true }).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test("home: Boss alone opens the boss menu; Play with friends offers lobbies (practice is Solo, on the home screen)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  const menu = page.getByRole("dialog", { name: "Choose your boss" });
  // A random boss, then the bosses you can meet (the gingerbread man, Boingo).
  await expect(menu.locator(".boss-row")).toHaveCount(3);
  await menu.getByRole("button", { name: "Close" }).click();
  await page.getByRole("main").getByRole("button", { name: "Play with friends" }).click();
  const sheet = page.getByRole("dialog", { name: "Play with friends" });
  await expect(sheet.getByRole("button", { name: "Create a lobby" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Join lobby" })).toBeDisabled();
  await sheet.getByLabel("Lobby code").fill("abcde");
  await expect(sheet.getByLabel("Lobby code")).toHaveValue("ABCDE");
  await expect(sheet.getByRole("button", { name: "Join lobby" })).toBeEnabled();
  await expect(sheet.getByRole("button", { name: /Solo vs/ })).toHaveCount(0);
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

test("computer: a side menu, the centre and a live panel; the phone keeps one column", async ({ page, browser }) => {
  test.setTimeout(2 * 60_000);
  await page.goto("/");
  const menu = page.getByRole("navigation", { name: "Menu" });
  const panel = page.getByRole("complementary", { name: "Live" });
  if (test.info().project.name !== "desktop") {
    await expect(menu).toBeHidden();
    await expect(panel).toBeHidden();
    return;
  }
  await expect(menu).toBeVisible();
  await expect(panel.getByRole("status")).toContainText("online");
  // The menu goes where the home screen's buttons go.
  await menu.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  await menu.getByRole("button", { name: "Profile" }).click();
  await expect(page.locator(".fd-card")).toBeVisible();
  await menu.getByRole("button", { name: "Boss alone" }).click();
  await expect(page.getByRole("dialog", { name: "Choose your boss" })).toBeVisible();
  await page.getByRole("dialog", { name: "Choose your boss" }).getByRole("button", { name: "Close" }).click();
  await menu.getByRole("button", { name: "Play with friends" }).click();
  await expect(page.getByRole("dialog", { name: "Play with friends" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  // Your pawn and PLAY side by side.
  const hero = (await page.locator(".fd-hero").boundingBox())!;
  const play = (await page.getByRole("button", { name: "PLAY", exact: true }).boundingBox())!;
  expect(play.x).toBeGreaterThan(hero.x + hero.width - 1);
  // A match being played shows on the panel's list (no names, just the mode and who's left).
  const other = await (await browser.newContext()).newPage();
  await other.goto("/?pool=panel");
  await other.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(panel.locator(".fd-playing").filter({ hasText: "Crowd · 50 v 50" }).first()).toBeVisible({ timeout: 40_000 });
  await other.close();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});
