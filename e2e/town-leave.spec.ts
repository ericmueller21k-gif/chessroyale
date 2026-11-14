import { mkdirSync } from "node:fs";
import { expect, type Browser, type Page } from "@playwright/test";
import { asSignedIn, named, tapInTown, test } from "./helpers.ts";

/**
 * "Leave Chess Town?" (Eric: "a little pop-up that just says you are about to leave Chess Town, click yes and no … you should always
 * have a confirm if you're going back out to a different menu or you're trying to exit"; town/LeaveTown.tsx). Leaving the town for
 * another screen asks first: Stay (the default, Escape too) changes nothing, Leave goes where you asked. Asked: a computer's side
 * menu, the town's back button, the phone's or browser's back gesture (and a guest's chat sign-up). Not asked: a room's back (the
 * square), a boss's challenge into its battle, the AFK drop. Since Nov 13 (Eric: "even if you're in a building … There should always be
 * 'are you sure you want to exit' if you're in the town"): from inside a building too, and the back gesture with no step of the app's
 * own before the town (the town has its own), and an invite's Join. `LEAVE_STILLS=<folder>` (outside the repo) saves the dialog's stills.
 */
test.use({ actionTimeout: 15_000 });

const canvas = (p: Page) => p.locator("canvas.town-canvas");
const room = (p: Page) => p.locator("canvas.town-shop-canvas");
const you = (p: Page) => canvas(p).getAttribute("data-you");
const leaveDialog = (p: Page) => p.getByRole("alertdialog", { name: "Leave Chess Town?" });
const onlyComputer = () => test.skip(test.info().project.name !== "desktop", "a computer's side menu: the desktop project");

test.beforeEach(async ({ page }) => {
  // (The chat box lies over the map's top left and takes taps there: as e2e/town.spec.ts.)
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
});

/** A still of the dialog, when LEAVE_STILLS names a folder. */
async function still(p: Page, name: string) {
  const dir = process.env.LEAVE_STILLS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await p.screenshot({ path: `${dir}/${name}-${test.info().project.name}.png` });
}

/** The town, open and drawn; your square once you've stopped (the same square after a Stay). */
async function openTown(p: Page, query = "sky=day&townafk=off") {
  await p.goto(`/town?${query}`);
  await expect(canvas(p)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await p.waitForTimeout(600);
  return (await you(p))!;
}

/** Stay: the dialog closes, and you're still in the town on the same square. */
async function expectStayed(p: Page, square: string) {
  await expect(leaveDialog(p)).toHaveCount(0);
  await expect(canvas(p)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await p.waitForTimeout(800);
  expect(await you(p), "still on the same square").toBe(square);
  expect(new URL(p.url()).pathname).toBe("/town");
}

/**
 * Opens a boss's or a home's card by tapping it (helpers.ts tapInTown: the view held still, the camera glided there if it's off the screen;
 * it may stroll a step; a tap that met someone else first, Babur strolling in front of his circus, Nov 9, opened their card: closed first).
 */
const openCard = (p: Page, kind: "boss" | "home", name: string, id: string) => tapInTown(p, kind, id, p.getByRole("dialog", { name, exact: true }));
/** Walks to Babur's Circus, opens its card and goes in: the room is drawn. */
async function goInBabur(p: Page) {
  const card = await openCard(p, "home", "Babur's Circus", "tiger");
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room(p)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
}

test("the town's back button asks 'Leave Chess Town?' first: Stay keeps you on your square, Escape stays too, Leave goes home", async ({ page }) => {
  test.skip(test.info().project.name === "desktop", "a computer has no back button since Nov 7 (its tools are in the right column): its side menu asks, below");
  const square = await openTown(page);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(leaveDialog(page)).toBeVisible();
  const sheet = leaveDialog(page);
  await expect(sheet.locator(".fd-sub")).toHaveText("You'll head back to Play.");
  await expect(sheet.getByRole("button")).toHaveText(["Stay", "Leave"]);
  await expect(sheet.getByRole("button", { name: "Stay" })).toBeFocused();
  await still(page, "back-button");
  await sheet.getByRole("button", { name: "Stay" }).click();
  await expectStayed(page, square);
  // Escape is Stay, at once: the sheet takes keys as it's drawn, not a frame later (an Escape in that frame was lost under load).
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.keyboard.press("Escape");
  await expectStayed(page, square);
  // Leave: the front door, and the address back to /.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await leaveDialog(page).getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(canvas(page)).toHaveCount(0);
});

test("the phone's back gesture asks too: Stay puts the town back as it was, Leave goes home", async ({ page }) => {
  const square = await openTown(page);
  // (The town opened first in this tab, nothing of the app's before it: back takes the town's own step, Nov 13. It left the site before.)
  await page.goBack();
  await expect(leaveDialog(page)).toBeVisible();
  await expect(leaveDialog(page).locator(".fd-sub")).toHaveText("You'll head back to Play.");
  await still(page, "back-gesture");
  await leaveDialog(page).getByRole("button", { name: "Stay" }).click();
  await expectStayed(page, square);
  // The gesture again (Stay put the town's step back), and Leave: the front door.
  await page.goBack();
  await leaveDialog(page).getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
});

test("a computer's side menu asks first: 'You'll head back to the Shop.'; Stay keeps the town, Leave opens the Shop", async ({ page }) => {
  onlyComputer();
  const square = await openTown(page);
  const menu = page.getByRole("navigation", { name: "Menu" });
  await menu.getByRole("button", { name: "Shop & crates" }).click();
  await expect(leaveDialog(page).locator(".fd-sub")).toHaveText("You'll head back to the Shop.");
  await still(page, "side-menu");
  await leaveDialog(page).getByRole("button", { name: "Stay" }).click();
  await expectStayed(page, square);
  await expect(menu.getByRole("button", { name: "Chess Town" })).toHaveAttribute("aria-current", "page");
  // Chess Town itself, where you are, asks nothing.
  await menu.getByRole("button", { name: "Chess Town" }).click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await menu.getByRole("button", { name: "Shop & crates" }).click();
  await leaveDialog(page).getByRole("button", { name: "Leave", exact: true }).click();
  await expect(menu.getByRole("button", { name: "Shop & crates" })).toHaveAttribute("aria-current", "page");
  await expect(canvas(page)).toHaveCount(0);
});

test("inside a room: the back button goes out to the square with no question; the back gesture asks, Stay stays in the room", async ({ page }) => {
  await openTown(page);
  await goInBabur(page);
  // (The real history, nothing of the test's own: the town's step, Nov 13. Twice: Stay puts the step back.)
  for (const n of [1, 2]) {
    await page.goBack();
    await expect(leaveDialog(page)).toBeVisible();
    await expect(leaveDialog(page).locator(".fd-sub")).toHaveText("You'll head back to Play.");
    if (n === 1) await still(page, "room-back-gesture");
    await leaveDialog(page).getByRole("button", { name: "Stay" }).click();
    await expect(leaveDialog(page)).toHaveCount(0);
    await expect(room(page)).toHaveAttribute("data-ready", "1");
    expect(new URL(page.url()).pathname).toBe("/town");
  }
  // The room's own back (a computer's: its door's Go out, no bar since Nov 7): out to the square, and no question.
  if (test.info().project.name === "phone") await page.getByRole("button", { name: "Back", exact: true }).click();
  else
    await expect(async () => {
      const door = await page.evaluate(() => (window as unknown as { __shopAt?: (k: string) => { x: number; y: number } | null }).__shopAt?.("door") ?? null);
      const cv = (await room(page).boundingBox())!;
      if (door) await page.mouse.click(cv.x + door.x, cv.y + door.y);
      await page.getByRole("dialog", { name: "Door" }).getByRole("button", { name: "Go out" }).click({ timeout: 3000 });
    }).toPass({ timeout: 30_000 });
  await expect(room(page)).toHaveCount(0, { timeout: 20_000 });
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  if (test.info().project.name !== "phone") return;
  // Back tapped the moment the room is drawn, as it still fades in: the tap waits for the room, then out (Nov 12: it was lost, and
  // you stayed in the room). (The page notes the room drawn: it's up for about 0.6 s, which fell between two of toHaveCount's polls
  // on a slow runner, and the check then waited 20 s for a room long gone: the town-leave:148 flake, Nov 13.)
  await page.evaluate(() => {
    new MutationObserver((_, ob) => {
      if (document.querySelector("canvas.town-shop-canvas")?.getAttribute("data-ready") !== "1") return;
      ob.disconnect();
      (window as unknown as { __roomDrawn?: boolean }).__roomDrawn = true;
      document.querySelector<HTMLButtonElement>("button.town-back")!.click();
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-ready"] });
  });
  const card = await openCard(page, "home", "Babur's Circus", "tiger");
  await card.getByRole("button", { name: "Go in" }).click();
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { __roomDrawn?: boolean }).__roomDrawn), { timeout: 20_000 }).toBe(true);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(leaveDialog(page)).toHaveCount(0);
});

test("a computer's side menu inside a room asks too; Leave goes to the front door", async ({ page }) => {
  onlyComputer();
  await openTown(page);
  await goInBabur(page);
  const menu = page.getByRole("navigation", { name: "Menu" });
  await menu.getByRole("button", { name: "Play", exact: true }).click();
  await expect(leaveDialog(page).locator(".fd-sub")).toHaveText("You'll head back to Play.");
  await leaveDialog(page).getByRole("button", { name: "Stay" }).click();
  await expect(room(page)).toHaveAttribute("data-ready", "1");
  await menu.getByRole("button", { name: "Play", exact: true }).click();
  await leaveDialog(page).getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(room(page)).toHaveCount(0);
});

/** A signed-in player in a context of their own (as e2e/friends.spec.ts): their page and id. */
async function player(browser: Browser, name: string): Promise<{ page: Page; id: string }> {
  const page = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await named(page, name);
  await page.goto("/?nolanding");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  const id = await page.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.user.id as string));
  return { page, id };
}

test("inside a room, an invite's Join asks first (Eric, Nov 13): Stay keeps you in the room and the invite; Leave joins their game", async ({ browser }) => {
  onlyComputer();
  test.setTimeout(3 * 60_000);
  const ann = await player(browser, "Ann Town");
  const bo = await player(browser, "Bo Town");
  const page = bo.page;
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
  await openTown(page);
  await goInBabur(page);
  // Ann challenges Bo from his profile: a lobby of hers, and his toast, over the room.
  await ann.page.goto(`/profile/${bo.id}?nolanding`);
  await ann.page.getByRole("button", { name: "Challenge" }).click();
  await expect(ann.page.getByRole("heading", { name: /^Lobby [A-Z2-9]{5}$/ })).toBeVisible({ timeout: 20_000 });
  const toast = page.locator(".fr-toast");
  await expect(toast).toContainText("Ann Town invited you", { timeout: 25_000 });
  await toast.getByRole("button", { name: "Join" }).click();
  await expect(leaveDialog(page).locator(".fd-sub")).toHaveText("You'll head back to their game.");
  await still(page, "room-invite");
  await leaveDialog(page).getByRole("button", { name: "Stay" }).click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(room(page)).toHaveAttribute("data-ready", "1");
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Join" }).click();
  await leaveDialog(page).getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Lobby [A-Z2-9]{5}$/ })).toBeVisible({ timeout: 20_000 });
  await expect(room(page)).toHaveCount(0);
});

test("a boss's challenge from the town (Challenge alone, Leave) asks no 'Chess Town' question: its own confirm, then Boss Battle", async ({ page }) => {
  await openTown(page);
  const card = await openCard(page, "boss", "Sawyer", "sawyer");
  await card.getByRole("button", { name: "Challenge alone" }).click();
  await page.getByRole("dialog", { name: "Leave the town square?" }).getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "Bosses" })).toBeVisible();
  await expect(leaveDialog(page)).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/");
});

test("the town's own settings and a home's card ask nothing", async ({ page }) => {
  await openTown(page);
  await page.getByRole("button", { name: "Town settings" }).click();
  await expect(page.getByRole("dialog", { name: "Town settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(leaveDialog(page)).toHaveCount(0);
  await openCard(page, "home", "Babur's Circus", "tiger");
  await expect(leaveDialog(page)).toHaveCount(0);
});

test("no input for the limit: the AFK drop goes home with its own pop-up, and no 'Leave Chess Town?'", async ({ page }) => {
  test.setTimeout(120_000);
  await openTown(page, "sky=day&townafk=off");
  await asSignedIn(page, "leave");
  await page.goto(`/town?sky=day&townroom=leave${Date.now().toString(36)}&townafk=2,6,600`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByRole("alertdialog", { name: "You've been dropped from the town" })).toBeVisible();
  await expect(leaveDialog(page)).toHaveCount(0);
});
