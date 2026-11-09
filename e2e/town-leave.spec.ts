import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { asSignedIn, test } from "./helpers.ts";

/**
 * "Leave Chess Town?" (Eric: "a little pop-up that just says you are about to leave Chess Town, click yes and no … you should always
 * have a confirm if you're going back out to a different menu or you're trying to exit"; town/LeaveTown.tsx). Leaving the town for
 * another screen asks first: Stay (the default, Escape too) changes nothing, Leave goes where you asked. Asked: a computer's side
 * menu, the town's back button, the phone's or browser's back gesture (and a guest's chat sign-up). Not asked: a room's back (the
 * square), a boss's challenge into its battle, the AFK drop. `LEAVE_STILLS=<folder>` (outside the repo) saves the dialog's stills.
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
  await expect(canvas(p)).toHaveAttribute("data-ready", "1");
  await p.waitForTimeout(600);
  return (await you(p))!;
}

/** Stay: the dialog closes, and you're still in the town on the same square. */
async function expectStayed(p: Page, square: string) {
  await expect(leaveDialog(p)).toHaveCount(0);
  await expect(canvas(p)).toHaveAttribute("data-ready", "1");
  await p.waitForTimeout(800);
  expect(await you(p), "still on the same square").toBe(square);
  expect(new URL(p.url()).pathname).toBe("/town");
}

const tapPoint = async (p: Page, kind: "boss" | "home", id: string) => {
  const xy = await p.evaluate(([k, i]) => (window as unknown as { __townAt?: (k: string, id: string) => { x: number; y: number } | null }).__townAt?.(k, i) ?? null, [kind, id] as const);
  if (!xy) return null;
  const cv = (await canvas(p).boundingBox())!;
  return { x: cv.x + xy.x, y: cv.y + xy.y };
};
/**
 * Opens a boss's or a home's card by tapping it (it may stroll a step; the card's own tap then opens it). A tap that met
 * someone else first (Babur strolling in front of his circus, Nov 9) opened their card, which then covers the home's point:
 * closed first, or every later tap lands on that card (as e2e/town.spec.ts).
 */
async function openCard(p: Page, kind: "boss" | "home", name: string, id: string) {
  const card = p.getByRole("dialog", { name, exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    if (await p.locator(".town-card").isVisible()) await p.keyboard.press("Escape");
    if (!(await tapPoint(p, kind, id))) await p.evaluate((i) => (window as unknown as { __townGlide?: (id: string) => void }).__townGlide?.(i), id);
    await expect.poll(() => tapPoint(p, kind, id), { message: `${name} comes into view` }).not.toBeNull();
    const at = await tapPoint(p, kind, id);
    await p.mouse.click(at!.x, at!.y);
    await expect(card).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  return card;
}
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
  // Escape is Stay.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(leaveDialog(page)).toBeVisible();
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
  // (The app's own address, one step on: the back gesture takes it back to the town.)
  await page.evaluate(() => history.pushState(null, "", "/town?sky=day&townafk=off&step=2"));
  await page.goBack();
  await expect(leaveDialog(page)).toBeVisible();
  await expect(leaveDialog(page).locator(".fd-sub")).toHaveText("You'll head back to Play.");
  await still(page, "back-gesture");
  await leaveDialog(page).getByRole("button", { name: "Stay" }).click();
  await expectStayed(page, square);
  // The gesture again, and Leave: the front door.
  await page.evaluate(() => history.pushState(null, "", "/town?sky=day&townafk=off&step=3"));
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
  await page.evaluate(() => history.pushState(null, "", "/town?sky=day&townafk=off&step=2"));
  await page.goBack();
  await expect(leaveDialog(page)).toBeVisible();
  await still(page, "room-back-gesture");
  await leaveDialog(page).getByRole("button", { name: "Stay" }).click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(room(page)).toHaveAttribute("data-ready", "1");
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
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByRole("alertdialog", { name: "You've been dropped from the town" })).toBeVisible();
  await expect(leaveDialog(page)).toHaveCount(0);
});
