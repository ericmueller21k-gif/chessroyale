import { devices, expect, type Browser, type Page } from "@playwright/test";
import { asSignedIn, giveItems, test, wearItem } from "./helpers.ts";

/**
 * Away in the town square (Eric, Nov 7: "after a few min put zzz with no text box… then boot after 10 min of not moving or in the
 * background either one"; town/afk.ts, town/here-net.ts, server/src/town-here.ts), on a phone and a computer, with the numbers
 * shortened by the test switch `?townafk=zzz,boot,hidden` (seconds) and each test in a town of its own (`?townroom=`), so other
 * tests' players never walk in it. Number checks through `__townHere()`: who's in the town, their "zzz" as the server told it and
 * whether the last frame drew it, what they wear and whether they were drawn dressed, and whether their name tag was drawn. Eric, on
 * #542: 1 and 5 minutes; "You've been dropped from the town" as a pop-up; guests get 30 s (`?townguest=` shortens it), watch the
 * town (everyone dressed, no names) and read its chat, but can't type.
 */
test.use({ actionTimeout: 15_000 });

const canvas = (p: Page) => p.locator("canvas.town-canvas");
type Here = { uid: string | null; you: boolean; name: string; at: [number, number]; here: boolean; zzz: boolean; drawn: boolean; look: Record<string, string> | null; dressed: boolean; tag: boolean };
const hereOf = (p: Page) => p.evaluate(() => (window as any).__townHere() as Here[]);
const them = async (p: Page, uid: string) => (await hereOf(p)).find((h) => h.uid === uid) ?? null;
const me = async (p: Page) => (await hereOf(p)).find((h) => h.you)!;

/** The town, open as a signed-in player (other players are signed-in players'), in this test's room, the away numbers as given. */
async function openIn(page: Page, room: string, afk: string, before?: () => Promise<unknown>) {
  await page.goto("/town?sky=day&townafk=off");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  const id = await asSignedIn(page, "afk");
  // (Before the town has a beat of theirs: what they wear is read once a minute.)
  await before?.();
  await page.goto(`/town?sky=day&townroom=${room}&townafk=${afk}`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await page.waitForFunction(() => typeof (window as any).__townHere === "function" && typeof (window as any).__townChatter === "function");
  // (The bosses' own chatter stopped: the log holds only what this test makes.)
  await page.evaluate(() => (window as any).__townChatter(false));
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
  // (Ann: the zzz after 10 s; Bo watches, his own numbers long.)
  const bo = await another(browser, info.project.name === "phone");
  const boId = await openIn(bo, r, "600,900,900");
  const annId = await openIn(page, r, "10,600,600");
  // Both in the town for each other; Ann taps a key (her clock starts again) and Bo sees her not away.
  await expect.poll(async () => (await them(bo, annId))?.here, { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => (await them(page, boId))?.here, { timeout: 15_000 }).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await them(bo, annId))?.zzz, { timeout: 8_000 }).toBe(false);
  expect((await them(bo, annId))!.drawn).toBe(false);
  // Ann leaves it alone: her zzz, on her screen (over her own pawn) and on Bo's (drawn over hers).
  await expect.poll(async () => (await me(page)).drawn, { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => {
    const a = await them(bo, annId);
    return a ? [a.zzz, a.drawn] : null;
  }, { timeout: 15_000, message: "Bo sees Ann's zzz" }).toEqual([true, true]);
  // A signed-in viewer sees Ann's name tag. No text box or words with the zzz: no new element, the chat log has no line about it.
  expect((await them(bo, annId))!.tag).toBe(true);
  await expect(bo.locator(".town-card")).toBeHidden();
  await expect(bo.locator(".tc-line")).toHaveCount(0);
  // Ann presses an arrow key (her pawn moves): gone at once on hers, and on Bo's within a beat.
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await me(page)).zzz, { timeout: 3_000 }).toBe(false);
  await expect.poll(async () => (await them(bo, annId))?.zzz, { timeout: 12_000, message: "Ann's zzz cleared on Bo's screen" }).toBe(false);
  expect((await them(bo, annId))!.drawn).toBe(false);
  await bo.context().close();
});

const dialog = (p: Page) => p.getByRole("alertdialog");

test("no input for the limit: home with the pop-up \"You've been dropped from the town\" (one redirect, no reload), and your pawn leaves another player's town", async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  const r = room();
  const bo = await another(browser, info.project.name === "phone");
  await openIn(bo, r, "600,900,900");
  const annId = await openIn(page, r, "2,6,600");
  await expect.poll(async () => (await them(bo, annId))?.here, { timeout: 15_000 }).toBe(true);
  let loads = 0;
  page.on("load", () => loads++);
  // Ann idles past 6 s: home, the pop-up over it.
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  await expect(canvas(page)).toHaveCount(0);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator("h2")).toHaveText("You've been dropped from the town");
  await expect(dialog(page).locator(".fd-sub")).toHaveText("You were away for a while. Come back any time.");
  await expect(dialog(page).getByRole("button")).toHaveText(["OK"]);
  // Bo's town: Ann has gone (the leave Ann's page sent, and the server's own drop).
  await expect.poll(async () => (await them(bo, annId))?.here, { timeout: 12_000, message: "Ann leaves Bo's town" }).toBe(false);
  // It stays until OK; OK closes it; no reload or second redirect meanwhile.
  await page.waitForTimeout(2_000);
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole("button", { name: "OK" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(loads).toBe(0);
  await expect(page).toHaveURL(/\/$/);
  await bo.context().close();
});

test("in the background for the limit: the server drops your pawn for another player while your page runs nothing, and back on it you're home with the pop-up", async ({ page, browser }, info) => {
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
  await expect(dialog(page).locator("h2")).toHaveText("You've been dropped from the town");
  await bo.context().close();
});

test("a guest (Eric, on #542): the town's time runs out and \"Make an account to keep exploring\" stops it; Back goes home, coming back in shows it again at once; Sign up leaves for the sign-in; a signed-in player never sees it", async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  await page.goto("/town?sky=day&townafk=off&townguest=3");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await page.waitForFunction(() => typeof (window as any).__townHere === "function");
  const gate = dialog(page);
  await expect(gate).toBeVisible({ timeout: 8_000 });
  await expect(gate.locator("h2")).toHaveText("Make an account to keep exploring");
  await expect(gate.locator(".fd-sub")).toHaveText("It's free.");
  await expect(gate.getByRole("button")).toHaveText(["Sign up", "Back"]);
  await expect(gate.getByRole("button", { name: "Sign up" })).toBeEnabled();
  // No more walking: the arrow keys move nothing under it.
  const at = (await me(page)).at;
  for (const k of ["ArrowLeft", "ArrowUp", "ArrowRight"]) await page.keyboard.press(k);
  await page.waitForTimeout(1_200);
  expect((await me(page)).at).toEqual(at);
  // Back: home. In again (this page load): the pop-up at once, the time already used.
  await gate.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(canvas(page)).toHaveCount(0);
  await page.getByRole("main").getByRole("button", { name: "Chess Town", exact: true }).click();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await expect(gate).toBeVisible({ timeout: 2_000 });
  // Sign up: out of the town to the app's sign-in (the landing page where signing in is set up; home here, where it isn't).
  await gate.getByRole("button", { name: "Sign up" }).click();
  await expect(canvas(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  // A signed-in player: never.
  const bo = await another(browser, info.project.name === "phone");
  await openIn(bo, room(), "600,900,900");
  await bo.goto("/town?sky=day&townafk=off&townguest=2");
  await expect(canvas(bo)).toHaveAttribute("data-ready", "1");
  await bo.waitForTimeout(4_000);
  await expect(dialog(bo)).toHaveCount(0);
  await bo.context().close();
});

test("a guest watches (Eric, on #542): another player in their outfit, no name tag over them, the town chat's lines, a greyed \"Make a free account to chat.\" in place of typing; the server refuses a guest's message; the guest is in nobody's town", async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  const r = room();
  const run = r.slice(-6);
  // Bo, signed in, in a beanie.
  const bo = await another(browser, info.project.name === "phone");
  const boId = await openIn(bo, r, "600,900,900", async () => {
    const [beanie] = await giveItems(bo, [{ def: "beanie", color: "red" }]);
    await wearItem(bo, "head", beanie!);
  });
  // The guest, in Bo's town.
  const posts: string[] = [];
  page.on("request", (q) => void (q.url().includes("/api/town/here") && posts.push(q.postData() ?? "")));
  await page.goto(`/town?sky=day&townroom=${r}&townafk=off`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await page.waitForFunction(() => typeof (window as any).__townHere === "function");
  // Bo, as the guest sees him: here, in his beanie, drawn dressed, no name and no tag.
  await expect.poll(async () => {
    const b = await them(page, boId);
    return b && [b.here, b.look, b.dressed, b.name, b.tag];
  }, { timeout: 15_000, message: "the guest sees Bo dressed, unnamed" }).toEqual([true, { head: "beanie" }, true, "", false]);
  // Bo says something; the guest reads it.
  const said = await bo.evaluate(async ([t, r]) => (await fetch("/api/town/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t, townroom: r }) })).status, [`hello guests ${run}`, r] as const);
  expect(said).toBe(200);
  await expect(page.locator(".tc-player", { hasText: `hello guests ${run}` })).toHaveCount(1, { timeout: 12_000 });
  // The guest can't type: the typing line is greyed with the way to an account, and nothing types into it.
  // (A tap on the box away from any name: its foot's right end.)
  const lg = (await page.locator(".tc-log").boundingBox())!;
  if (info.project.name === "phone") await page.touchscreen.tap(lg.x + lg.width - 8, lg.y + lg.height - 8);
  else await page.mouse.click(lg.x + lg.width - 8, lg.y + lg.height - 8);
  const field = page.locator(".tc-form input");
  await expect(field).toBeDisabled();
  await expect(field).toHaveAttribute("placeholder", "Make a free account to chat.");
  await expect(page.getByRole("button", { name: "Make a free account to chat." })).toHaveCount(1);
  // The server refuses a guest's message whatever the page does.
  expect((await page.request.post("/api/town/chat", { data: { text: `sneaky ${run}` } })).status()).toBe(401);
  // The guest only watched (no square sent: no pawn of theirs anywhere), and Bo's town has no one else in it.
  expect(posts.length).toBeGreaterThan(0);
  for (const b of posts) expect(JSON.parse(b)).toMatchObject({ watch: true });
  expect((await hereOf(bo)).filter((h) => !h.you && h.here)).toEqual([]);
  await bo.context().close();
});

test("the rule off with ?townafk=off: no zzz and no boot however long", { tag: "@phone-only" }, async ({ page }) => {
  await page.goto("/town?sky=day&townafk=off");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await page.waitForFunction(() => typeof (window as any).__townHere === "function");
  await page.waitForTimeout(4_000);
  expect((await me(page)).zzz).toBe(false);
  await expect(canvas(page)).toHaveCount(1);
});
