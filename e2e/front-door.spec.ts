import { expect } from "@playwright/test";
import { asAdmin, named, openBossRaid, switchesOff, test } from "./helpers.ts";

const live = (p: import("@playwright/test").Page) => p.evaluate(() => fetch("/api/live").then((r) => r.json()));

test("home: the live line comes from the server, the RANKED row changes the line under PLAY", async ({ page, browser }) => {
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
  // Someone else waiting in the queue shows up in the count within a few seconds. (Bots off, so they stay in it: with
  // bots they'd be in a match by the fill time, 8 s here, and the line, asked every 5 s, could miss the count between
  // two looks: docs/decisions/2026-10-15-flaky-e2e-batch.md.)
  const other = await (await browser.newContext()).newPage();
  await other.addInitScript(() => localStorage.setItem("brc.matchmaking", "botsoff"));
  await other.goto(`/?pool=home-${test.info().project.name}`);
  await other.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(async () => (await live(page)).queue, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  await expect(line).toContainText(/[1-9]\d* in queue/, { timeout: 10_000 });
  await other.close();
  // The line under PLAY follows the RANKED row's pick (50 v 50 · 1 v 1 · Squads; Eric, Oct 16). Squads: PLAY is its
  // solo queue or a party, picked in the panel in the Matchmaking row's place.
  await expect(page.getByRole("radiogroup", { name: "RANKED" }).getByRole("radio")).toHaveText([/^50 v 50/, /^1 v 1/, /^Squads/]);
  await page.getByRole("radio", { name: /Squads/ }).click();
  await expect(page.locator(".fd-hint")).toHaveText(/^Solo queue: bots fill any empty seat after \d+ s$/);
  await expect(page.getByRole("radiogroup", { name: "Squads" }).getByRole("radio")).toHaveText(["Solo queueyou join a squad", "Partywith up to 3 friends"]);
  await expect(page.getByRole("radio", { name: /^Solo queue/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radiogroup", { name: "Matchmaking" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeEnabled();
  await page.getByRole("radio", { name: /^50 v 50/ }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeEnabled();
  // No sideways scrolling, and big tap targets. (Boss alone isn't on home any more: the Boss raid screen has it.)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await expect(page.getByRole("main").getByRole("button", { name: /^Boss alone/ })).toHaveCount(0);
  // (Home has the card and one button: the shop and your profile are in a phone's top bar and a computer's side menu.)
  for (const name of ["Play with friends"]) {
    const box = (await page.getByRole("main").getByRole("button", { name, exact: true }).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect((await page.getByRole("main").getByRole("button", { name: /^Boss raid/ }).boundingBox())!.height).toBeGreaterThanOrEqual(64);
});

test("home: Play with friends offers lobbies (practice is Solo, on the home screen)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("button", { name: "Play with friends" }).click();
  const sheet = page.getByRole("dialog", { name: "Play with friends" });
  await expect(sheet.getByRole("button", { name: "Create a lobby" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Join lobby" })).toBeDisabled();
  await sheet.getByLabel("Lobby code").fill("abcde");
  await expect(sheet.getByLabel("Lobby code")).toHaveValue("ABCDE");
  await expect(sheet.getByRole("button", { name: "Join lobby" })).toBeEnabled();
  await expect(sheet.getByRole("button", { name: /Solo vs/ })).toHaveCount(0);
});

test("settings: the sections in order, the board's choices stick, and Testing (practice mode, the eval bar) only for admins", async ({ page }) => {
  // A player (this server has TEST_SWITCHES on: the app is told otherwise, as hunchess.com tells a player).
  await switchesOff(page);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  // (Friends and Account show once accounts are on, Friends right after Quick chat; the order is the same either way.)
  const labels = async () => (await page.locator(".fd-settings .fd-label").allTextContents()).filter((l) => l !== "ACCOUNT" && l !== "FRIENDS");
  await expect.poll(labels).toEqual(["THEME", "SOUND", "BOARD", "QUICK CHAT", "HOW TO PLAY", "HELP", "PRIVACY AND TERMS"]);
  // Gone (Eric, Oct 15): practice mode and the eval bar for players, the pre-game votes' and Classic's opening moves'
  // switches, the sound lab (its choice is the Reveal sound picker).
  await expect(page.getByRole("switch", { name: /Practice mode|Eval bar|Pre-game votes/ })).toHaveCount(0);
  await expect(page.getByText(/Opening moves|Sound lab/)).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "Reveal sound" })).toBeVisible();
  // Board: animations off takes the motion trail with it; both stick.
  const anim = page.getByRole("switch", { name: /Animations/ });
  await expect(anim).toBeChecked();
  await anim.click();
  await expect(page.getByRole("switch", { name: /Motion trail/ })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("switch", { name: /Animations/ })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: /Motion trail/ })).not.toBeChecked();

  // An admin: Testing, last, with practice mode (off until switched; it sticks) and the eval bar (on).
  await asAdmin(page);
  await page.reload();
  await expect.poll(labels).toEqual(["THEME", "SOUND", "BOARD", "QUICK CHAT", "HOW TO PLAY", "HELP", "PRIVACY AND TERMS", "TESTING"]);
  const practice = page.getByRole("switch", { name: /Practice mode/ });
  await expect(practice).not.toBeChecked();
  await expect(page.getByRole("switch", { name: /Eval bar/ })).toBeChecked();
  await practice.click();
  await page.reload();
  await expect(page.getByRole("switch", { name: /Practice mode/ })).toBeChecked();
  await page.getByRole("button", { name: "Back", exact: true }).click();
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

test("computer: a side menu, the center and a live panel; the phone keeps one column", async ({ page, browser }) => {
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
  // Boss raid: its screen, the menu showing where you are; Play is home again.
  await menu.getByRole("button", { name: "Boss raid" }).click();
  await expect(page.getByRole("heading", { name: "Boss raid", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Boss raid" })).toHaveAttribute("aria-current", "page");
  await expect(menu.getByRole("button", { name: "Boss alone" })).toHaveCount(0);
  await menu.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
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
