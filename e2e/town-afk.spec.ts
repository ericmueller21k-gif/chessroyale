import { devices, expect, type Browser, type Page } from "@playwright/test";
import { asSignedIn, test } from "./helpers.ts";

/**
 * Away in the town square (Eric, Nov 7: "after a few min put zzz with no text box… then boot after 10 min of not moving or in the
 * background either one"; town/afk.ts, town/here-net.ts, server/src/town-here.ts), on a phone and a computer, with the numbers
 * shortened by the test switch `?townafk=zzz,boot,hidden` (seconds) and each test in a town of its own (`?townroom=`), so other
 * tests' players never walk in it. Number checks through `__townHere()`: who's in the town, their "zzz" as the server told it and
 * whether the last frame drew it.
 */
test.use({ actionTimeout: 15_000 });

const canvas = (p: Page) => p.locator("canvas.town-canvas");
type Here = { uid: string | null; you: boolean; name: string; at: [number, number]; here: boolean; zzz: boolean; drawn: boolean };
const hereOf = (p: Page) => p.evaluate(() => (window as any).__townHere() as Here[]);
const them = async (p: Page, uid: string) => (await hereOf(p)).find((h) => h.uid === uid) ?? null;
const me = async (p: Page) => (await hereOf(p)).find((h) => h.you)!;

/** The town, open as a signed-in player (other players are signed-in players'), in this test's room, the away numbers as given. */
async function openIn(page: Page, room: string, afk: string) {
  await page.goto("/town?sky=day&townafk=off");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  const id = await asSignedIn(page, "afk");
  await page.goto(`/town?sky=day&townroom=${room}&townafk=${afk}`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await page.waitForFunction(() => typeof (window as any).__townHere === "function");
  await expect(page.locator(".tc-form input")).toBeEnabled();
  return id;
}

/** Another player on a device like this project's. */
async function another(browser: Browser, phone: boolean) {
  const ctx = await browser.newContext(phone ? { ...devices["iPhone 13"] } : { viewport: { width: 1280, height: 800 } });
  return ctx.newPage();
}

/** The page to the background, or back (as a phone's tab switch: `document.hidden` and the event; nothing else changes). */
const setHidden = (p: Page, on: boolean) =>
  p.evaluate((on) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => on });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (on ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, on);

const room = () => `afk${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

test("after the zzz wait with no input a \"zzz\" floats over your pawn, for you and another player (no bubble or words); your next input clears it for both", async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  const r = room();
  // (Ann: the zzz after 3 s; Bo watches, his own numbers long.)
  const bo = await another(browser, info.project.name === "phone");
  const boId = await openIn(bo, r, "600,900,900");
  const annId = await openIn(page, r, "3,600,600");
  // Both in the town for each other, neither away.
  await expect.poll(async () => (await them(bo, annId))?.here, { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => (await them(page, boId))?.here, { timeout: 15_000 }).toBe(true);
  expect((await them(bo, annId))!.zzz).toBe(false);
  // Ann leaves it alone: her zzz, on her screen (over her own pawn) and on Bo's (drawn over hers).
  await expect.poll(async () => (await me(page)).drawn, { timeout: 10_000 }).toBe(true);
  await expect.poll(async () => {
    const a = await them(bo, annId);
    return a ? [a.zzz, a.drawn] : null;
  }, { timeout: 15_000, message: "Bo sees Ann's zzz" }).toEqual([true, true]);
  // No text box or words with it: no new element, the chat log has no line about it.
  await expect(bo.locator(".town-card")).toBeHidden();
  await expect(bo.locator(".tc-line")).toHaveCount(0);
  // Ann presses an arrow key (her pawn moves): gone at once on hers, and on Bo's within a beat.
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await me(page)).zzz, { timeout: 3_000 }).toBe(false);
  await expect.poll(async () => (await them(bo, annId))?.zzz, { timeout: 12_000, message: "Ann's zzz cleared on Bo's screen" }).toBe(false);
  expect((await them(bo, annId))!.drawn).toBe(false);
  await bo.context().close();
});

test("no input for the limit: home with a small \"You were away\" (one redirect, no reload), and your pawn leaves another player's town", async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  const r = room();
  const bo = await another(browser, info.project.name === "phone");
  await openIn(bo, r, "600,900,900");
  const annId = await openIn(page, r, "2,6,600");
  await expect.poll(async () => (await them(bo, annId))?.here, { timeout: 15_000 }).toBe(true);
  let loads = 0;
  page.on("load", () => loads++);
  // Ann idles past 6 s: home.
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  await expect(canvas(page)).toHaveCount(0);
  const note = page.locator(".away-note");
  await expect(note).toHaveText("You were away");
  await expect(note).toBeVisible();
  // (Small: the toast's look, as wide as its words, at the top.)
  const box = (await note.boundingBox())!;
  expect(box.width).toBeLessThan(220);
  expect(box.y).toBeLessThan(80);
  // Bo's town: Ann has gone (the leave Ann's page sent, and the server's own drop).
  await expect.poll(async () => (await them(bo, annId))?.here, { timeout: 12_000, message: "Ann leaves Bo's town" }).toBe(false);
  // The note goes after its few seconds; no reload or second redirect meanwhile.
  await expect(note).toHaveCount(0, { timeout: 10_000 });
  expect(loads).toBe(0);
  await expect(page).toHaveURL(/\/$/);
  await bo.context().close();
});

test("in the background for the limit: the server drops your pawn for another player while your page runs nothing, and back on it you're home with \"You were away\"", async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  const r = room();
  const bo = await another(browser, info.project.name === "phone");
  await openIn(bo, r, "600,900,900");
  // (Ann's clock is the test's: a phone in the background runs no timers, so hers stop while she's hidden.)
  await page.clock.install();
  const annId = await openIn(page, r, "600,600,4");
  await expect.poll(async () => (await them(bo, annId))?.here, { timeout: 15_000 }).toBe(true);
  await setHidden(page, true);
  // (Her hidden beat went as she hid; from now on her page runs nothing.)
  await page.waitForTimeout(500);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  // The server drops her pawn by itself after 4 s in the background.
  await expect.poll(async () => (await them(bo, annId))?.here, { timeout: 15_000, message: "the server drops Ann for Bo" }).toBe(false);
  // Ann still shows the town (nothing ran) until she's back.
  await expect(canvas(page)).toHaveCount(1);
  await page.clock.fastForward(5_000);
  await setHidden(page, false);
  await page.clock.resume();
  await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  await expect(page.locator(".away-note")).toHaveText("You were away");
  await bo.context().close();
});

test("the rule holds back for what isn't idle presence: off with ?townafk=off; a guest has no beats and is in nobody's town", { tag: "@phone-only" }, async ({ page }) => {
  // A guest: the away rule still runs on the device (home after the limit), but nothing goes to the server.
  const beats: string[] = [];
  page.on("request", (q) => void (q.url().includes("/api/town/here") && beats.push(q.url())));
  await page.goto("/town?sky=day&townafk=1,3,3");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  await expect(page.locator(".away-note")).toHaveText("You were away");
  expect(beats).toEqual([]);
  // Off: no zzz and no boot however long.
  await page.goto("/town?sky=day&townafk=off");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await page.waitForFunction(() => typeof (window as any).__townHere === "function");
  await page.waitForTimeout(4_000);
  expect((await me(page)).zzz).toBe(false);
  await expect(canvas(page)).toHaveCount(1);
});
