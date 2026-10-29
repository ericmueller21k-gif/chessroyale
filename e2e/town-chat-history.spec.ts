import { devices, expect, type Browser, type Page } from "@playwright/test";
import { asServerAdmin, asSignedIn, test } from "./helpers.ts";

/**
 * The town chat's 5 minutes (Eric, Oct 28: "keep up to 5 minutes of chat actually, or 100 messages whichever it hits first";
 * docs/decisions/2026-10-28-town-chat-v2.md, "v4"), the part that needs real time: a line another player said is still on the
 * screen 4 minutes later, and Report still works on it (the server holds each line 5 minutes: TOWN_CHAT.lineMs), for a moderator
 * too (Remove). Its own file, so it runs beside the other chat specs and not after them. The fast checks (a line 4 minutes old on the
 * device by the test hook, the 100-line cap, the clock) are in town-chat.spec.ts; the room's own clock is unit-tested in
 * packages/server/test/town-chat.test.ts. The same wait and checks run on a phone and on a computer.
 */
test.use({ actionTimeout: 15_000 });

const run = Date.now().toString(36).slice(-5);
const canvas = (p: Page) => p.locator("canvas.town-canvas");
const lineOf = (p: Page, text: string) => p.locator(".tc-player").filter({ hasText: text });

/** The town, open, signed in (as `asSignedIn` makes an account; a moderator's address with `admin`), with the bosses' chatter stopped. */
async function openSignedIn(page: Page, admin = false) {
  const open = async () => {
    await page.goto("/town?sky=day");
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    await page.waitForFunction(() => typeof (window as any).__townSay === "function");
    await page.evaluate(() => (window as any).__townChatter(false));
  };
  await open();
  const id = admin ? await asServerAdmin(page, "chat") : await asSignedIn(page, "town");
  await open();
  await expect(page.locator(".town-chat")).toHaveAttribute("data-on", "1");
  return id;
}

/** Another player on a device like this project's. */
async function another(browser: Browser, phone: boolean) {
  const ctx = await browser.newContext(phone ? { ...devices["iPhone 13"] } : { viewport: { width: 1280, height: 800 } });
  return ctx.newPage();
}

/** A tap on the box where no name is (opens typing), then types and sends with Enter. */
async function send(page: Page, text: string) {
  const b = await page.locator(".tc-log").evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width - 14, y: r.top + r.height - 12 }; });
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(b.x, b.y);
  else await page.mouse.click(b.x, b.y);
  await expect(page.locator(".town-chat")).toHaveAttribute("data-typing", "1");
  const field = page.locator(".tc-form input");
  await field.fill(text);
  await field.press("Enter");
}

test("a line another player said 4 minutes ago is still on the screen, and Report and a moderator's Remove work on it (the room holds each line 5 minutes)", async ({ page, browser }, info) => {
  test.setTimeout(420_000);
  const phone = info.project.name === "phone";
  // The moderator (a chat admin's address: playwright.config.ts' ADMIN_EMAILS), and Bo, who says the line.
  await openSignedIn(page, true);
  const bo = await another(browser, phone);
  const boId = await openSignedIn(bo);
  const sentAt = Date.now();
  await send(bo, `Bo said this long ago ${run}`);
  const old = lineOf(page, `Bo said this long ago ${run}`);
  await expect(old).toHaveCount(1, { timeout: 12_000 });

  // Four minutes after it was said: it's still there (the device keeps 5 minutes), and it is the same line (nothing re-read it).
  await page.waitForTimeout(Math.max(0, 240_000 - (Date.now() - sentAt)));
  await expect(old, "the line is still on the screen, 4 minutes on").toHaveCount(1);
  await expect(page.locator(".town-chat")).toHaveAttribute("data-on", "1");

  // Report works on it: a tap on its name, then Report; the answer in the menu; fair play's case holds the words.
  await old.locator(".tc-name").click();
  const menu = page.locator(".tc-menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Report" }).click();
  await expect(menu.locator(".tc-menu-said")).toHaveText(/Thanks|already/);
  await expect(menu).toHaveCount(0, { timeout: 5000 });
  const casePage = await (await page.request.get(`/admin/fairplay/case/${boId}`)).text();
  expect(casePage, "the report reached fair play with the line").toContain("Offensive chat");
  expect(casePage).toContain(`Bo said this long ago ${run}`);

  // And a moderator's Remove takes it out of everyone's log (its number is still in the room).
  await old.locator(".tc-name").click();
  await menu.getByRole("button", { name: "Remove" }).click();
  await expect(old).toHaveCount(0);
  await expect(lineOf(bo, `Bo said this long ago ${run}`)).toHaveCount(0, { timeout: 12_000 });
});
