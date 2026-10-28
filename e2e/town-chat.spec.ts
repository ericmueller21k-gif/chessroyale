import { devices, expect, type Browser, type Page, type Request } from "@playwright/test";
import { CHAT } from "../packages/app/src/town/chat.ts";
import { asServerAdmin, asSignedIn, test } from "./helpers.ts";

/**
 * The town square's chat log (Oct 28; docs/areas/town-square.md, "The chat log"), on a phone and a computer. v2 (Eric, Oct 28): one
 * see-through box flush in the map's top left corner, a line a message ("[9:41] Name: message"), every line of the last minute kept
 * and scrolling (a finger, the wheel), the field "Say something…" at its foot (no send button), no backing; a chat icon in the
 * header with three modes (always on, new messages only, off) and a gear opening "Town settings"; in new messages the lines show when
 * a message comes and fade after `fadeAfterMs`, and a tap on one brings back the rest; a tap on the box away from a line reaches
 * the map; a tap on a player's name opens its menu; press and hold to move the box, remembered; the edge chips keep off its box
 * (always on and new messages, shown or not); the keyboard doesn't resize or move the town. And players' messages
 * (docs/decisions/2026-10-28-town-chat-typing.md): two signed-in players see each other's lines within a few seconds and a guest
 * none; the server's limits and reasons in the field; a line's menu (Profile, Mute, Report, a moderator's Remove); the switch off.
 * Test hooks (the test switches on): `__townSay()` (someone from the table talks now) or `__townSay(name, text, kind, agoMs)`,
 * `__townChatter(false)` (no chatter of its own while a test looks), `__townTapped` (taps on player lines).
 */
test.use({ actionTimeout: 15_000 });

/** This run's mark in the messages it sends (players in other tests share the room). */
const run = Date.now().toString(36).slice(-5);

type Box = { x: number; y: number; w: number; h: number };
const canvas = (p: Page) => p.locator("canvas.town-canvas");
const log = (p: Page) => p.locator(".tc-log");
const rectOf = (p: Page, sel: string): Promise<Box> =>
  p.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
const meets = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const you = async (p: Page) => (await canvas(p).getAttribute("data-you"))!;
/** Waits until your pawn has stopped (its square the same for a while). */
async function settle(p: Page) {
  let last = "";
  for (let n = 0; n < 40; n++) {
    const now = await you(p);
    if (now === last) return;
    last = now;
    await p.waitForTimeout(800);
  }
}
/** The same box, within a pixel (a place is remembered to whole pixels). */
const near = (a: Box, b: Box) => expect([a.x, a.y, a.w, a.h].map((v, i) => Math.abs(v - [b.x, b.y, b.w, b.h][i]!) <= 1)).toEqual([true, true, true, true]);
const say = (p: Page, name: string, text: string, kind = "boss", agoMs = 0) => p.evaluate(([n, t, k, a]) => (window as any).__townSay(n, t, k, a), [name, text, kind, agoMs] as const);
/** The header's chat icon (a tap goes to the next mode) and what it says now. */
const icon = (p: Page) => p.locator("button.tc-mode");
const LABEL = { always: "Chat: always on", new: "Chat: new messages only", off: "Chat: off" } as const;
/** Taps the icon until the chat is in `mode`. */
async function goMode(p: Page, mode: keyof typeof LABEL) {
  for (let n = 0; n < 3 && (await icon(p).getAttribute("aria-label")) !== LABEL[mode]; n++) await icon(p).click();
  await expect(icon(p)).toHaveAttribute("aria-label", LABEL[mode]);
}
/** The alpha of a computed color ("rgba(14, 18, 26, 0)" is 0; "rgb(...)" is 1). */
const alphaOf = (css: string) => (css.startsWith("rgba") ? Number(css.slice(css.lastIndexOf(",") + 1, -1)) : css === "transparent" ? 0 : 1);
const bg = (p: Page, sel: string) => p.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
/** The camera now (the test hook): the zoom and where it looks. */
const cam = (p: Page) => p.evaluate(() => { const c = (window as any).__townCam(); return { zoom: c.zoom as number, focus: c.focus as number[] }; });
/**
 * A finger drags on the page at (x, y), `dy` pixels down (older lines): real touch events (CDP's), so the browser does its own
 * touch scroll, as a thumb makes it. (CDP's synthesized scroll gesture does nothing in headless Chromium.)
 */
async function swipe(p: Page, x: number, y: number, dy: number) {
  const cdp = await p.context().newCDPSession(p);
  const touch = (type: string, at: number | null) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: at === null ? [] : [{ x, y: at }] });
  await touch("touchStart", y);
  for (let i = 1; i <= 10; i++) {
    await touch("touchMove", y + (dy * i) / 10);
    await p.waitForTimeout(16);
  }
  await touch("touchEnd", null);
  await cdp.detach();
}
/** The log's scroll now: how far from its foot (0: at it) and how far it can go. */
const scrollOf = (p: Page) => p.locator(".tc-log").evaluate((el) => ({ top: el.scrollTop, fromFoot: el.scrollHeight - el.scrollTop - el.clientHeight, room: el.scrollHeight - el.clientHeight }));

/** The town, open, with the bosses' and kids' own chatter stopped (it speaks every 20 to 45 s: a test looks at its own lines). */
async function open(page: Page, query = "") {
  await page.goto(`/town?sky=day${query}`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await page.waitForFunction(() => typeof (window as any).__townSay === "function");
  await page.evaluate(() => (window as any).__townChatter(false));
}

/**
 * The town, open, as a signed-in player (the field and other players' lines are theirs only): the account gets an email in
 * the local database (`asSignedIn`), then the page loads again. `admin`: the chat moderator's address instead
 * (playwright.config.ts' ADMIN_EMAILS). Answers the account's id.
 */
async function openSignedIn(page: Page, admin = false) {
  await open(page);
  const id = admin ? await asServerAdmin(page, "chat") : await asSignedIn(page, "town");
  await open(page);
  await expect(page.locator(".tc-form input")).toBeVisible();
  return id;
}

/** Another player on a device like this project's (a phone or a computer). */
async function another(browser: Browser, phone: boolean) {
  const ctx = await browser.newContext(phone ? { ...devices["iPhone 13"] } : { viewport: { width: 1280, height: 800 } });
  return ctx.newPage();
}

/** Types a message in the field and sends it with the keyboard's own Send (Enter). */
async function send(page: Page, text: string) {
  const field = page.locator(".tc-form input");
  await field.fill(text);
  await field.press("Enter");
}

/** Every chip showing: its face's box, and what it points to. */
const chips = (p: Page) =>
  p.locator(".town-chip").evaluateAll((els) =>
    els
      .filter((e) => getComputedStyle(e).display !== "none")
      .map((e) => {
        const r = e.querySelector(".town-chip-face")!.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height, name: e.querySelector("button")!.getAttribute("aria-label")! };
      }),
  );

/** Press and hold on the map where the box lies, then drag: the box is picked up and put down at the end. */
async function carry(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(CHAT.holdMs + 200);
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}
/** Where to press on the box: on its first line (the lines start at the box's top), away from the text field's strip. */
const grip = (b: Box) => ({ x: b.x + 24, y: b.y + 8 });

test("the chat box (always on, the default): one see-through box flush in the map's top left, the lines from its top, newest last above the field; no backing, light text with a shadow; no send button", async ({ page }, info) => {
  const phone = info.project.name === "phone";
  await open(page);
  await expect(icon(page)).toHaveAttribute("aria-label", LABEL.always);
  const map = await rectOf(page, ".town-box");
  const b0 = await rectOf(page, ".town-chat");
  // Flush in the map's top left corner, a small inset (8 px), under the header; a phone's from its left edge to about two thirds
  // across and down about a fifth (to a quarter), a computer's wider and taller; clear of the buttons (−, +, "Back to me").
  expect(b0.x - map.x, "8 px in from the map's left edge").toBeGreaterThanOrEqual(6);
  expect(b0.x - map.x).toBeLessThanOrEqual(10);
  expect(b0.y - map.y, "8 px down from the map's top").toBeGreaterThanOrEqual(6);
  expect(b0.y - map.y).toBeLessThanOrEqual(10);
  if (phone) {
    expect(b0.w / map.w).toBeGreaterThan(0.55);
    expect(b0.w / map.w).toBeLessThan(0.75);
    expect(b0.h / map.h).toBeGreaterThan(0.15);
    expect(b0.h / map.h).toBeLessThan(0.3);
  } else {
    expect(b0.w).toBeGreaterThanOrEqual(400);
    expect(b0.h).toBeGreaterThanOrEqual(300);
  }
  expect(meets(b0, await rectOf(page, ".town-controls")), "the box never covers the buttons").toBe(false);
  const bar = await rectOf(page, ".town-bar");
  expect(b0.y, "under the bar: on the map").toBeGreaterThanOrEqual(bar.y + bar.h);

  // Always on: it shows with nothing said (the field at its foot; the stream empty), and keeps its place and size.
  await expect(page.locator(".tc-line")).toHaveCount(0);
  await expect(log(page)).toHaveCSS("opacity", "1");
  await expect(page.locator(".tc-form input")).toBeVisible();
  await expect(page.locator(".tc-form input")).toHaveAttribute("placeholder", /./);

  await say(page, "Hollow", "The park gets quiet after dark.");
  const first = page.locator(".tc-line").first();
  await expect(first).toHaveText(/^\[(1[0-2]|[1-9]):[0-5]\d\] Hollow: The park gets quiet after dark\.$/);
  const name = first.locator("b.tc-name");
  await expect(name).toHaveText("Hollow");
  expect(Number(await name.evaluate((el) => getComputedStyle(el).fontWeight)), "the name is bold").toBeGreaterThanOrEqual(700);
  // The time is this device's clock, hours and minutes, 12-hour, no am/pm.
  const shown = (await first.locator(".tc-time").textContent())!;
  const clocks = await page.evaluate(() => [0, -1].map((m) => { const d = new Date(Date.now() + m * 60000); return `[${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}]`; }));
  expect(clocks, "this device's time").toContain(shown);
  // Names keep their colors by kind: a boss's gold, a kid's mint, a player's light blue.
  await say(page, "Sparky", "Ooh, sparkly!", "kid");
  await say(page, "Ann", "hello town", "player");
  const color = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).color);
  expect(await color(".tc-boss .tc-name")).toBe("rgb(255, 212, 121)");
  expect(await color(".tc-kid .tc-name")).toBe("rgb(155, 232, 192)");
  expect(await color(".tc-player .tc-name")).toBe("rgb(191, 224, 255)");

  // No backing, on the box or on a line (one CSS variable, 0, is there to raise it later); light text with a soft dark shadow.
  for (const sel of [".town-chat", ".tc-log", ".tc-line", ".tc-form input"]) expect(alphaOf(await bg(page, sel)), `${sel} has no backing`).toBe(0);
  expect(await page.locator(".town-chat").evaluate((el) => getComputedStyle(el).getPropertyValue("--chat-back").trim())).toBe("0");
  const text = await page.locator(".tc-line").first().evaluate((el) => ({ c: getComputedStyle(el).color, s: getComputedStyle(el).textShadow }));
  expect(text.c, "light text").toBe("rgb(255, 255, 255)");
  expect(text.s, "a soft dark shadow").toMatch(/rgba?\(0, 0, 0/);

  // The lines start at the box's top (the corner); the newest is last, above the text field's strip.
  const lb = await rectOf(page, ".tc-line");
  expect(lb.y - b0.y, "the first line is flush at the box's top").toBeLessThanOrEqual(4);
  expect(lb.x).toBeGreaterThanOrEqual(b0.x - 1);
  expect(lb.x + lb.w).toBeLessThanOrEqual(b0.x + b0.w + 1);
  const last = await rectOf(page, ".tc-line:last-child");
  expect(last.y, "newest last").toBeGreaterThan(lb.y);
  expect(last.y + last.h, "above the text field's strip").toBeLessThanOrEqual(b0.y + b0.h - 30);
  // The field is a plain line at the foot: no box round it, no send button anywhere in the box (the keyboard's Send or Enter only).
  const field = await page.locator(".tc-form input").evaluate((el) => { const c = getComputedStyle(el); return { w: [c.borderTopWidth, c.borderLeftWidth, c.borderRightWidth, c.borderBottomWidth], radius: c.borderTopLeftRadius }; });
  expect(field.w, "no box round the field").toEqual(["0px", "0px", "0px", "0px"]);
  await expect(page.locator(".tc-rule"), "its one line").toHaveCount(1);
  await expect(page.locator(".town-chat button"), "no send button").toHaveCount(0);
  await expect(page.locator(".town-chat [type=submit], .town-chat svg"), "no send icon").toHaveCount(0);

  // A long message wraps to two lines at most, then "…"; the box keeps its place and size whatever it holds.
  const long = "word ".repeat(40).trim();
  await say(page, "Eric", long, "player");
  const mine = page.locator(".tc-line").last();
  const m = await mine.evaluate((el) => ({ h: el.clientHeight, sh: el.scrollHeight, lh: parseFloat(getComputedStyle(el).lineHeight), clamp: getComputedStyle(el).webkitLineClamp }));
  expect(m.clamp).toBe("2");
  expect(m.h, "at most two lines").toBeLessThanOrEqual(2 * m.lh + 6);
  expect(m.sh, "cut off, with dots").toBeGreaterThan(m.h);
  expect(await rectOf(page, ".town-chat")).toEqual(b0);
  // About 5 lines of messages on a phone and 12 on a computer fit the box before it scrolls.
  const fit = await page.locator(".tc-log").evaluate((el) => Math.floor(el.clientHeight / (parseFloat(getComputedStyle(el.querySelector(".tc-line")!).lineHeight) + 2)));
  expect(fit, "single lines that fit before it scrolls").toBeGreaterThanOrEqual(phone ? 5 : 12);
  // It doesn't fade: always on.
  await page.waitForTimeout(CHAT.fadeAfterMs + 1500);
  await expect(log(page)).toHaveCSS("opacity", "1");
  await expect(page.locator(".tc-form input")).toBeVisible();
  expect(await rectOf(page, ".town-chat")).toEqual(b0);
});

/** The stream's box and whether a line lies wholly inside it, as `inBox(line)`. */
const logBox = (p: Page) => rectOf(p, ".tc-log");
const inBox = async (p: Page, el: ReturnType<Page["locator"]>) => {
  const [b, r] = [await logBox(p), await el.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })];
  return r.y >= b.y - 1 && r.y + r.h <= b.y + b.h + 1;
};
/** Scrolls the stream back (older lines) by hand: a finger on a phone, the wheel on a computer, the pointer on the box at (x, y). */
async function scrollBack(p: Page, phone: boolean, at: { x: number; y: number }, by = 600) {
  if (phone) await swipe(p, at.x, at.y, by);
  else {
    await p.mouse.move(at.x, at.y);
    await p.mouse.wheel(0, -by);
  }
}
async function scrollFwd(p: Page, phone: boolean, at: { x: number; y: number }, by = 600) {
  if (phone) await swipe(p, at.x, at.y, -by);
  else {
    await p.mouse.move(at.x, at.y);
    await p.mouse.wheel(0, by);
  }
}

test("the stream holds the last minute and scrolls back, by finger on a phone and by wheel on a computer, to a line 50 s old; the map under the box doesn't pan or zoom; a line is gone for good a minute after it was said", async ({ page }, info) => {
  const phone = info.project.name === "phone";
  await open(page);
  const start = await you(page);
  // One line said 50 s ago, then plenty of new ones: more than the box holds. (It has about 10 s left: go straight at it.)
  await page.evaluate(() => {
    const say = (window as any).__townSay;
    say("Hollow", "OLD LINE from fifty seconds ago", "boss", 50_000);
    for (let i = 1; i <= 24; i++) say(i % 2 ? "Sparky" : "Tex", `new line ${i}`, "kid");
  });
  const lines = page.locator(".tc-line");
  await expect(lines).toHaveCount(25);
  const old = lines.first();
  const sc = await scrollOf(page);
  expect(sc.room, "more than the box holds: it scrolls").toBeGreaterThan(50);
  expect(sc.fromFoot, "at its foot, the newest lines in view").toBeLessThanOrEqual(2);
  expect(await inBox(page, lines.last())).toBe(true);
  expect(await inBox(page, old), "the 50 s old line is out of view").toBe(false);
  const cam0 = await cam(page);
  const b0 = await rectOf(page, ".town-chat");

  const b = await logBox(page);
  const at = { x: b.x + 40, y: b.y + b.h / 2 };
  await scrollBack(page, phone, at);
  await expect.poll(async () => (await scrollOf(page)).fromFoot, { message: "it scrolled back", timeout: 5000 }).toBeGreaterThan(40);
  for (let n = 0; n < 4 && !(await inBox(page, old)); n++) await scrollBack(page, phone, at, 1500);
  await expect.poll(() => inBox(page, old), { message: "the 50 s old line is in view", timeout: 5000 }).toBe(true);
  await expect(old).toContainText("OLD LINE from fifty seconds ago");
  expect(await rectOf(page, ".town-chat"), "the box itself stayed").toEqual(b0);
  // The map under the box didn't pan or zoom, and you didn't set off walking.
  expect(await cam(page), "the map stayed").toEqual(cam0);
  expect(await you(page)).toBe(start);

  // The old line is removed for good a minute after it was said (a few seconds from now); the rest stay.
  await expect(page.locator(".tc-line").filter({ hasText: "OLD LINE" })).toHaveCount(0, { timeout: 20_000 });
  await expect(lines).toHaveCount(24);
  // Off the box the wheel is the map's again (it zooms), and over the box it didn't (above).
  if (!phone) {
    await page.mouse.move(page.viewportSize()!.width - 300, 400);
    await page.mouse.wheel(0, -400); // (up: zooms in; the page opens zoomed out)
    await expect.poll(async () => (await cam(page)).zoom, { message: "the wheel off the box zooms the map" }).not.toBe(cam0.zoom);
  }
});

test("new lines keep the stream at its foot unless you've scrolled up, then it stays where you are and says \"↓ new\" until you go down (the marker's tap, or the foot by hand)", async ({ page }, info) => {
  const phone = info.project.name === "phone";
  await open(page);
  await page.evaluate(() => { for (let i = 1; i <= 24; i++) (window as any).__townSay(i % 2 ? "Sparky" : "Tex", `line ${i}`, "kid"); });
  const lines = page.locator(".tc-line");
  await expect(lines).toHaveCount(24);
  expect((await scrollOf(page)).fromFoot).toBeLessThanOrEqual(2);
  // At its foot, a new line keeps it there.
  await say(page, "Chip", "first new", "kid");
  await expect(lines.last()).toContainText("first new");
  expect((await scrollOf(page)).fromFoot, "kept up").toBeLessThanOrEqual(2);
  await expect(page.locator(".tc-new")).toHaveCount(0);
  const b = await logBox(page);
  const at = { x: b.x + 40, y: b.y + b.h / 2 };
  // Scrolled up, it stays where you are when a line comes, and says so: "↓ new".
  await scrollBack(page, phone, at, 300);
  await expect.poll(async () => (await scrollOf(page)).fromFoot, { timeout: 5000 }).toBeGreaterThan(40);
  const before = (await scrollOf(page)).top;
  await say(page, "Chip", "a line while you read", "kid");
  await expect(page.locator(".tc-new")).toHaveText("↓ new");
  expect(Math.abs((await scrollOf(page)).top - before), "stays where you are").toBeLessThanOrEqual(2);
  await say(page, "Chip", "and another", "kid");
  expect(Math.abs((await scrollOf(page)).top - before)).toBeLessThanOrEqual(2);
  await expect(page.locator(".tc-new")).toHaveCount(1);
  // The marker's tap goes to the newest, and it keeps up again.
  await page.locator(".tc-new").click();
  await expect(page.locator(".tc-new")).toHaveCount(0);
  expect((await scrollOf(page)).fromFoot).toBeLessThanOrEqual(2);
  await say(page, "Chip", "pinned again", "kid");
  await expect(lines.last()).toContainText("pinned again");
  expect((await scrollOf(page)).fromFoot, "at its foot again").toBeLessThanOrEqual(2);
  // Up again, a line comes, and then back down to the foot by hand: the marker goes and it keeps up.
  await scrollBack(page, phone, at, 300);
  await expect.poll(async () => (await scrollOf(page)).fromFoot, { timeout: 5000 }).toBeGreaterThan(40);
  await say(page, "Chip", "one more", "kid");
  await expect(page.locator(".tc-new")).toHaveCount(1);
  await scrollFwd(page, phone, at, 3000);
  await expect.poll(async () => (await scrollOf(page)).fromFoot, { timeout: 5000 }).toBeLessThanOrEqual(2);
  await expect(page.locator(".tc-new")).toHaveCount(0);
  await say(page, "Chip", "last one", "kid");
  await expect(lines.last()).toContainText("last one");
  expect((await scrollOf(page)).fromFoot).toBeLessThanOrEqual(2);
});

test("a tap on the box away from any line reaches the map; a line takes the finger (a boss's or kid's does nothing, a player's opens its menu on a tap on its name or text)", async ({ page }) => {
  await open(page);
  await say(page, "Hollow", "The park gets quiet after dark.");
  await say(page, "Sparky", "Ooh, sparkly!", "kid");
  const lines = page.locator(".tc-line");
  await expect(lines).toHaveCount(2);
  const box = await rectOf(page, ".town-chat");
  const kidR = await rectOf(page, ".tc-kid");
  const mid = (r: Box) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const pointOf = (p: { x: number; y: number }) => page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y)!; return e.tagName === "CANVAS" ? "canvas" : e.closest(".tc-line") ? "a line" : e.className; }, p);
  expect(await pointOf(mid(kidR)), "a line takes the pointer (its finger scrolls the stream)").toBe("a line");
  // Away from any line, inside the box: the map's. (Low in the box, over the ground or the Colosseum; its right part, beside the short lines.)
  const empty = { x: box.x + box.w - 30, y: box.y + box.h - 60 };
  expect(await pointOf(empty), "the empty box lets the pointer through to the map").toBe("canvas");
  const start = await you(page);
  await page.mouse.click(empty.x, empty.y);
  await expect.poll(async () => (await you(page)) !== start || (await page.getByRole("dialog").count()) > 0, { message: "the tap reached the map", timeout: 6000 }).toBe(true);
  await page.keyboard.press("Escape");
  await settle(page);

  // A tap on a boss's or kid's line is the line's: nothing happens, and the map doesn't see it.
  const here = await you(page);
  const dialogs = await page.getByRole("dialog").count();
  await page.mouse.click(mid(kidR).x, mid(kidR).y);
  await page.waitForTimeout(700);
  expect(await you(page), "the map didn't see the tap").toBe(here);
  expect(await page.getByRole("dialog").count()).toBe(dialogs);

  // A player's line: a tap on its name or on its text is its own (listed by the test hook), not the map's.
  await say(page, "Eric", "please check this line", "player");
  const mine = page.locator(".tc-player").last();
  await mine.locator(".tc-name").click();
  await expect.poll(() => page.evaluate(() => (window as any).__townTapped ?? [])).toEqual(["please check this line"]);
  await mine.click({ position: { x: (await rectOf(page, ".tc-player")).w - 8, y: 6 } }); // (its text, away from the name)
  await expect.poll(() => page.evaluate(() => (window as any).__townTapped ?? [])).toEqual(["please check this line", "please check this line"]);
  await page.waitForTimeout(700);
  expect(await you(page), "the map didn't see it").toBe(here);
  expect(await page.getByRole("dialog").count()).toBe(dialogs);
});

test("new messages: the lines show when a message comes and fade after the wait, the field with them; a faded box takes no taps and keeps its place; the next message brings back only the new ones; a tap on a line brings back every line of the last minute, scrollable, until it fades again", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  const b0 = await rectOf(page, ".town-chat");
  await goMode(page, "new");
  // Nothing said yet: nothing shows, the field fades with the lines (it can't be seen or tabbed to), the box is where it was.
  await expect(log(page)).toHaveCSS("opacity", "0");
  await expect(page.locator(".tc-form input")).toBeHidden();
  expect(await rectOf(page, ".town-chat"), "the same place and size, faded").toEqual(b0);

  await say(page, "Hollow", "first thing said", "boss");
  await say(page, "Glim", "second thing said", "kid");
  const said = Date.now();
  await expect(log(page)).toHaveCSS("opacity", "1");
  await expect(page.locator(".tc-form input"), "the field shows with the lines").toBeVisible();
  // It fades `fadeAfterMs` after the last message, not before (its lines are still kept); the field fades with it.
  await page.waitForTimeout(CHAT.fadeAfterMs - 2500);
  await expect(log(page)).toHaveCSS("opacity", "1");
  await expect(log(page)).toHaveCSS("opacity", "0", { timeout: 15_000 });
  expect(Date.now() - said, "not before the wait").toBeGreaterThanOrEqual(CHAT.fadeAfterMs);
  await expect(page.locator(".tc-form input")).toBeHidden();
  expect(await rectOf(page, ".town-chat"), "the same place and size, faded").toEqual(b0);
  const gone = await rectOf(page, ".tc-line");
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, { x: gone.x + 20, y: gone.y + gone.h / 2 }), "a faded line takes no taps: the map's").toBe("CANVAS");

  // The next message brings the box back with only what's new; the faded lines wait for a tap.
  await say(page, "Sparky", "something new now", "kid");
  await expect(log(page)).toHaveCSS("opacity", "1");
  await expect(page.locator(".tc-line")).toHaveCount(1);
  await expect(page.locator(".tc-line")).toHaveText(/Sparky: something new now$/);
  expect(await rectOf(page, ".town-chat")).toEqual(b0);
  // A tap on the line's text brings every line of the last minute back: the faded ones too.
  const only = page.locator(".tc-line");
  await only.click({ position: { x: (await rectOf(page, ".tc-line")).w - 8, y: 6 } });
  await expect(page.locator(".tc-line")).toHaveCount(3);
  await expect(page.locator(".tc-line").first()).toHaveText(/Hollow: first thing said$/);
  await expect(page.locator(".tc-line").last()).toHaveText(/Sparky: something new now$/);
  expect(await rectOf(page, ".town-chat"), "the box doesn't change").toEqual(b0);
  // Scrollable now (give it more lines than it holds); a message while it's open keeps all of them.
  await page.evaluate(() => { for (let i = 1; i <= 20; i++) (window as any).__townSay("Tex", `more ${i}`, "kid"); });
  await expect(page.locator(".tc-line")).toHaveCount(23);
  expect((await scrollOf(page)).room, "scrollable").toBeGreaterThan(50);
  // It fades again after the wait with nothing new, and the next message after that shows only itself.
  await expect(log(page)).toHaveCSS("opacity", "0", { timeout: CHAT.fadeAfterMs + 6000 });
  await expect(page.locator(".tc-line")).toHaveCount(23);
  await say(page, "Chip", "after the fade", "kid");
  await expect(page.locator(".tc-line")).toHaveCount(1);
  await expect(log(page)).toHaveCSS("opacity", "1");
  // A tap on a player's name is the menu's (listed by the hook), not the box coming back: the older lines stay faded.
  await say(page, "Ann", "check this line", "player");
  await page.locator(".tc-player .tc-name").click();
  await expect.poll(() => page.evaluate(() => (window as any).__townTapped ?? [])).toEqual(["check this line"]);
  await expect(page.locator(".tc-line")).toHaveCount(2);
});

test("the header's chat icon cycles always on, new messages only, off (top bubble green then bottom green then both gray) and the gear's sheet sets the mode; off shows no box and no field, and the lines that came meanwhile show when it's on again; the mode is remembered; the icons never cover the title", async ({ page }) => {
  await open(page);
  // At the right end of the title's line, never over the title.
  const title = await rectOf(page, ".town-bar h1");
  const bar = await rectOf(page, ".town-bar");
  const ic = await rectOf(page, "button.tc-mode");
  const gear = await rectOf(page, 'button[aria-label="Town settings"]');
  expect(meets(ic, title) || meets(gear, title), "the icons don't cover the title").toBe(false);
  expect(ic.x, "right of the title").toBeGreaterThan(title.x + title.w);
  expect(gear.x, "the gear is the last").toBeGreaterThan(ic.x);
  expect(gear.x + gear.w, "at the right end").toBeGreaterThan(bar.x + bar.w - 24);
  for (const r of [ic, gear]) expect(Math.abs(r.y + r.h / 2 - (title.y + title.h / 2)), "on the title's line").toBeLessThan(6);

  // Its two bubbles' colors, by mode (the green is the game's "good").
  const probe = page.locator("body");
  const green = await probe.evaluate(() => { const d = document.createElement("i"); d.style.color = "var(--good)"; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
  const bubbles = () => page.locator("button.tc-mode .tc-bub").evaluateAll((els) => els.map((e) => getComputedStyle(e).fill));
  const tops = async () => { const [t, b] = await bubbles(); return { top: t === green ? "green" : "gray", bottom: b === green ? "green" : "gray", same: t === b }; };
  await expect(icon(page)).toHaveAttribute("aria-label", LABEL.always);
  expect(await tops()).toMatchObject({ top: "green", bottom: "gray" });
  await icon(page).click();
  await expect(icon(page)).toHaveAttribute("aria-label", LABEL.new);
  expect(await tops()).toMatchObject({ top: "gray", bottom: "green" });
  await icon(page).click();
  await expect(icon(page)).toHaveAttribute("aria-label", LABEL.off);
  expect(await tops()).toMatchObject({ top: "gray", bottom: "gray", same: true });
  // Off: no box, no field. The lines still arrive.
  await expect(page.locator(".town-chat")).toBeHidden();
  await expect(page.locator(".tc-form input")).toBeHidden();
  await expect(page.locator(".tc-line")).toHaveCount(0);
  await say(page, "Hollow", "said while the chat was off", "boss");
  await say(page, "Sparky", "and this too", "kid");
  await expect(page.locator(".town-chat")).toBeHidden();
  // A tap round again: always on, with the lines that came meanwhile (the last minute).
  await icon(page).click();
  await expect(icon(page)).toHaveAttribute("aria-label", LABEL.always);
  await expect(page.locator(".tc-line")).toHaveCount(2);
  await expect(page.locator(".tc-line").first()).toContainText("said while the chat was off");
  await expect(page.locator(".tc-form input")).toBeVisible();

  // The gear: "Town settings", the chat's mode as three choices (nothing else in it yet).
  await page.getByRole("button", { name: "Town settings" }).click();
  const sheet = page.getByRole("dialog", { name: "Town settings" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Town settings" })).toBeVisible();
  const radios = sheet.getByRole("radio");
  await expect(radios).toHaveText(["Always on", "New messages", "Off"]);
  await expect(sheet.getByRole("button")).toHaveCount(1); // (its X)
  await expect(radios.nth(0)).toHaveAttribute("aria-checked", "true");
  await radios.nth(1).click();
  await expect(icon(page)).toHaveAttribute("aria-label", LABEL.new);
  await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(radios.nth(0)).toHaveAttribute("aria-checked", "false");
  await radios.nth(2).click();
  await expect(icon(page)).toHaveAttribute("aria-label", LABEL.off);
  await expect(page.locator(".town-chat")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  // The X, and a tap outside the sheet, close it too.
  await page.getByRole("button", { name: "Town settings" }).click();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
  await page.getByRole("button", { name: "Town settings" }).click();
  await page.mouse.click(4, 400);
  await expect(sheet).toHaveCount(0);
  await page.getByRole("button", { name: "Town settings" }).click();
  await sheet.getByRole("radio", { name: "New messages" }).click();
  await sheet.getByRole("button", { name: "Close" }).click();

  // Remembered on this device: a reload comes back in the same mode (a stored value only this device sees).
  await expect(icon(page)).toHaveAttribute("aria-label", LABEL.new);
  expect(await page.evaluate((k) => localStorage.getItem(k), CHAT.modeKey)).toBe("new");
  await page.reload();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await expect(icon(page)).toHaveAttribute("aria-label", LABEL.new);
  await expect(log(page)).toHaveCSS("opacity", "0");
  await page.evaluate((k) => localStorage.setItem(k, "off"), CHAT.modeKey);
  await page.reload();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await expect(icon(page)).toHaveAttribute("aria-label", LABEL.off);
  await expect(page.locator(".town-chat")).toBeHidden();
});

test("the text field (a signed-in player's): 80 characters, a count near the end, one message per 15 seconds with the wait in the field, your line in the log as a player", async ({ page }) => {
  test.setTimeout(120_000);
  await openSignedIn(page);
  const field = page.locator(".tc-form input");
  await expect(field).toBeVisible();
  await expect(field).toHaveAttribute("placeholder", "Say something…");
  await expect(field).toHaveAttribute("enterkeyhint", "send");
  await expect(field).toHaveAttribute("maxlength", "80");
  expect(await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), "16 px or more: iPhone Safari doesn't zoom in").toBeGreaterThanOrEqual(16);
  await expect(page.locator(".tc-form button"), "no send button in the box").toHaveCount(0);
  // Inside the box, at its foot, the same size with or without it.
  const b = await rectOf(page, ".town-chat");
  const f = await rectOf(page, ".tc-form");
  expect(f.y + f.h).toBeLessThanOrEqual(b.y + b.h + 1);
  expect(f.y).toBeGreaterThan(b.y + b.h / 2);

  await field.click();
  await page.keyboard.type("a".repeat(69));
  await expect(page.locator(".tc-left"), "no count until near the end").toHaveCount(0);
  await page.keyboard.type("bcdef");
  await expect(page.locator(".tc-left")).toHaveText("6 left");
  await page.keyboard.type("x".repeat(30)); // (the field stops at 80)
  await expect(field).toHaveValue(/^a{69}bcdefxxxxxx$/);
  await expect(page.locator(".tc-left")).toHaveText("0 left");
  await field.fill(`hello town ${run}`);
  await page.keyboard.press("Enter");

  // Your line, back from the server: your name, kind "player"; the field empties, lets go, and shows the wait. (Only this
  // test's lines are counted: other tests' players, in the same room, may be talking too.)
  const mine = page.locator(".tc-player").filter({ hasText: run });
  await expect(mine).toHaveCount(1);
  await expect(mine).toHaveText(new RegExp(`^\\[\\d{1,2}:\\d{2}\\] .+: hello town ${run}$`));
  await expect(mine.locator("b.tc-name")).not.toHaveText("");
  await expect(field).toHaveValue("");
  await expect(field).toBeDisabled();
  await expect(field).toHaveAttribute("placeholder", /^Wait (1[0-5]|[1-9]) s$/);
  await expect(field).not.toBeFocused();
  expect(await rectOf(page, ".town-chat"), "the box didn't change").toEqual(b);
  // It counts down and gives the field back after 15 seconds.
  await expect(field).toBeEnabled({ timeout: 17_000 });
  await expect(field).toHaveAttribute("placeholder", "Say something…");
  await field.click();
  await page.keyboard.type(`second one ${run}`);
  await page.keyboard.press("Enter");
  await expect(mine).toHaveCount(2);
  await expect(mine.last()).toHaveText(new RegExp(`second one ${run}$`));
});

test("a guest's field is there, greyed, saying how to chat (nothing hidden); without the test switches no hooks either", async ({ page }) => {
  await page.route("**/api/auth/config", (route) => route.fulfill({ json: { accounts: false, google: false, email: false } }));
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await expect(page.locator(".town-chat")).toHaveCount(1);
  const field = page.locator(".tc-form input");
  await expect(field).toBeVisible();
  await expect(field).toBeDisabled();
  await expect(field).toHaveAttribute("placeholder", "Sign in to chat with other players.");
  await page.evaluate(() => (window as any).__townSay?.("Hollow", "hello", "boss"));
  await page.waitForTimeout(400);
  await expect(page.locator(".tc-line"), "the hooks are off too").toHaveCount(0);
  // The box is the same size with or without the field's strip.
  expect((await rectOf(page, ".town-chat")).h).toBeGreaterThan(100);
});

test("press and hold on the box and drag it anywhere on the map; it stays, is remembered, never leaves the map or covers the buttons; a tap or a drag without the hold is the map's", async ({ page }) => {
  await open(page);
  await say(page, "Hollow", "The park gets quiet after dark.");
  await expect(log(page)).toHaveCSS("opacity", "1");
  const map = await rectOf(page, ".town-box");
  const b0 = await rectOf(page, ".town-chat");
  const start = await you(page);
  const cam0 = await page.evaluate(() => (window as any).__townCam().focus as number[]);

  // A plain tap on the box away from its lines is the map's: you walk (or a card opens); the box stays. (Low in the box, where the
  // map under it is ground or the Colosseum: its top corner is sky.)
  const tap = { x: b0.x + b0.w / 2, y: b0.y + b0.h - 60 };
  await page.mouse.click(tap.x, tap.y);
  await expect.poll(async () => (await you(page)) !== start || (await page.getByRole("dialog").count()) > 0, { timeout: 6000 }).toBe(true);
  await page.keyboard.press("Escape");
  expect(await rectOf(page, ".town-chat")).toEqual(b0);
  await settle(page);

  // A drag that starts on the box without the hold, away from its lines, is the map's: the camera looks around; the box stays.
  const here = await you(page);
  const free = { x: b0.x + b0.w - 30, y: b0.y + b0.h - 60 };
  await page.mouse.move(free.x, free.y);
  await page.mouse.down();
  await page.mouse.move(free.x + 40, free.y + 120, { steps: 6 });
  await page.mouse.up();
  expect(await rectOf(page, ".town-chat")).toEqual(b0);
  const cam1 = await page.evaluate(() => (window as any).__townCam().focus as number[]);
  expect(Math.hypot(cam1[0]! - cam0[0]!, cam1[1]! - cam0[1]!), "the camera moved").toBeGreaterThan(0.3);
  expect(await you(page)).toBe(here);
  await page.getByRole("button", { name: "Back to me" }).click();

  // Press and hold, then drag: it goes with the finger (a little right and down), the map doesn't see it.
  await settle(page);
  const walk = await you(page);
  await carry(page, grip(b0), { x: grip(b0).x + 60, y: grip(b0).y + 90 });
  const b1 = await rectOf(page, ".town-chat");
  expect(b1.x - b0.x).toBeCloseTo(60, 0);
  expect(b1.y - b0.y).toBeCloseTo(90, 0);
  expect(b1.w).toBe(b0.w);
  expect(b1.h).toBe(b0.h);
  await page.waitForTimeout(600);
  expect(await you(page), "a held box isn't a tap on the map").toBe(walk);
  expect(await page.getByRole("dialog").count()).toBe(0);
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), CHAT.storageKey))!)).toEqual({ x: Math.round(b1.x - map.x), y: Math.round(b1.y - map.y) });

  // Dropped over the buttons or off the map: it ends inside the map and clear of them.
  const controls = await rectOf(page, ".town-controls");
  await carry(page, grip(b1), { x: controls.x + controls.w / 2, y: controls.y + controls.h / 2 });
  const b2 = await rectOf(page, ".town-chat");
  expect(meets(b2, controls), "never over the buttons").toBe(false);
  expect(b2.x).toBeGreaterThanOrEqual(map.x);
  expect(b2.y).toBeGreaterThanOrEqual(map.y);
  expect(b2.x + b2.w).toBeLessThanOrEqual(map.x + map.w);
  expect(b2.y + b2.h).toBeLessThanOrEqual(map.y + map.h);
  await carry(page, grip(b2), { x: map.x + 2, y: map.y + 2 });
  const b3 = await rectOf(page, ".town-chat");
  expect(b3.x).toBeGreaterThanOrEqual(map.x);
  expect(b3.y).toBeGreaterThanOrEqual(map.y);

  // It stays where it was dropped, also after a reload (remembered on this device).
  await carry(page, grip(b3), { x: grip(b3).x + 30, y: grip(b3).y + 40 });
  const b4 = await rectOf(page, ".town-chat");
  await page.reload();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  near(await rectOf(page, ".town-chat"), b4);
});

test("the edge chips keep off the chat box (always on and new messages, shown or faded) wherever it's put; off, they may use its space", async ({ page }) => {
  // (Signed in, so the box has its field: faded and without one, the box can't be seen, and a press there is the map's.)
  await openSignedIn(page);
  const quiet = await chips(page);
  expect(quiet.length, "some chips show").toBeGreaterThan(0);
  const box = await rectOf(page, ".town-chat");
  for (const c of quiet) expect(meets(c, box), `${c.name} not under the box`).toBe(false);

  // Put the box over a chip's place: the chip gives way (the box's place is reserved wherever it is), and none is under it.
  // (Some chips lie where the buttons keep the box off: try them in turn.)
  const map = await rectOf(page, ".town-box");
  let proved = false;
  let slid: { name: string; x: number; y: number } | null = null;
  for (let k = 0; k < quiet.length && !proved; k++) {
    const now = await chips(page);
    const target = now[k % now.length]!;
    const was = await rectOf(page, ".town-chat");
    const g = grip(was);
    const want = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
    await carry(page, g, { x: g.x + (want.x - (was.x + was.w / 2)), y: g.y + (want.y - (was.y + was.h / 2)) });
    const moved = await rectOf(page, ".town-chat");
    expect(moved.x).toBeGreaterThanOrEqual(map.x);
    await expect.poll(async () => (await chips(page)).filter((c) => meets(c, moved)).map((c) => c.name), { message: "no chip under the moved box", timeout: 4000 }).toEqual([]);
    if (want.x > moved.x && want.x < moved.x + moved.w && want.y > moved.y && want.y < moved.y + moved.h) {
      const same = (await chips(page)).find((c) => c.name === target.name);
      if (same) expect(Math.hypot(same.x - target.x, same.y - target.y), "that chip slid to a clear spot").toBeGreaterThan(10);
      slid = { name: target.name, x: target.x, y: target.y };
      proved = true;
    }
  }
  expect(proved, "the box lay over a chip's old place, and the chip gave way").toBe(true);
  expect(slid).not.toBeNull();

  // A chip by the box never jumps when the log appears or fades (new messages: the box shows with a message and fades after the
  // wait): its place is reserved always. (Only the chips round the box
  // are compared, and a slide of a step or two is let go: a boss's or bot's name tag passing an edge nudges a chip by `chipSlideStep`
  // (6 px) now and then. A chip let back under the box would jump at least its radius, 27 px, as the box was put over its place.)
  const moved = await rectOf(page, ".town-chat");
  const round = { x: moved.x - 90, y: moved.y - 90, w: moved.w + 180, h: moved.h + 180 };
  const byTheBox = async () => (await chips(page)).filter((c) => meets(c, round));
  const stay = (a: Awaited<ReturnType<typeof chips>>, b: Awaited<ReturnType<typeof chips>>, when: string) => {
    for (const c of a) {
      const d = b.find((o) => o.name === c.name);
      if (d) expect(Math.hypot(c.x - d.x, c.y - d.y), `${c.name} stays put ${when}`).toBeLessThan(15);
    }
  };
  await goMode(page, "new");
  await page.waitForTimeout(300);
  const before = await byTheBox();
  expect(before.length, "a chip lies by the box").toBeGreaterThan(0);
  await say(page, "Hollow", "The park gets quiet after dark.");
  await expect(log(page)).toHaveCSS("opacity", "1");
  await page.waitForTimeout(300);
  stay(before, await byTheBox(), "as the log appears");
  await expect(log(page)).not.toHaveCSS("opacity", "1", { timeout: 15_000 }); // (the fade begins)
  const fading = await byTheBox();
  await expect(log(page)).toHaveCSS("opacity", "0", { timeout: 3000 });
  stay(fading, await byTheBox(), "as the log fades");

  // Off: no box, and the chips may use its space: the chip that gave way comes back to its own place.
  await goMode(page, "off");
  await expect(page.locator(".town-chat")).toBeHidden();
  await expect.poll(async () => {
    const c = (await chips(page)).find((o) => o.name === slid!.name);
    return c ? Math.hypot(c.x - slid!.x, c.y - slid!.y) : 999;
  }, { message: "the chip took its old place back", timeout: 5000 }).toBeLessThan(15);
});

test("the keyboard opening doesn't resize or move the town: while the field has focus the screen keeps its height and follows the visual viewport", async ({ page }) => {
  await openSignedIn(page);
  const screen = page.locator(".town-screen");
  const field = page.locator(".tc-form input");
  const cv0 = await rectOf(page, "canvas.town-canvas");
  await field.click();
  await expect(field).toBeFocused();
  await expect(screen).toHaveAttribute("style", /height: \d+(\.\d+)?px/);
  // (A browser that pans the page to show the field: the visual viewport's offset, stood in for here.)
  await page.evaluate(() => {
    const vv = window.visualViewport!;
    Object.defineProperty(vv, "offsetTop", { get: () => 120, configurable: true });
    vv.dispatchEvent(new Event("scroll"));
  });
  await expect(screen).toHaveAttribute("style", /translate3d\(0px, 120px, 0(px)?\)/);
  expect(await rectOf(page, "canvas.town-canvas"), "the map's box is the same size").toMatchObject({ w: cv0.w, h: cv0.h });
  await page.evaluate(() => delete (window.visualViewport as any).offsetTop);
  await page.locator("canvas.town-canvas").click({ position: { x: 5, y: 300 } }); // (a tap on the map: the keyboard closes)
  await expect(field).not.toBeFocused();
  await expect(screen).not.toHaveAttribute("style", /height|transform/);
  expect(await rectOf(page, "canvas.town-canvas")).toEqual(cv0);
});

// ---- Players' messages (the server: docs/decisions/2026-10-28-town-chat-typing.md).

/** A swear word, written ROT13 as in the server's list (no swearing spelled out in the tests either). */
const rot13 = (t: string) => t.replace(/[a-z]/gi, (c) => String.fromCharCode(((c.charCodeAt(0) - (c <= "Z" ? 65 : 97) + 13) % 26) + (c <= "Z" ? 65 : 97)));
const lineOf = (p: Page, text: string) => p.locator(".tc-player").filter({ hasText: text });
/** Brings the log back if it has faded (8 s after the last message): the field taking focus holds it shown. */
const showLog = (p: Page) => p.locator(".tc-form input").focus();

test("two signed-in players see each other's lines within a few seconds; a guest sees none, its field greyed, and never asks for them", async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  const phone = info.project.name === "phone";
  await openSignedIn(page);
  const bo = await another(browser, phone);
  await openSignedIn(bo);
  const guest = await another(browser, phone);
  const asked: string[] = [];
  guest.on("request", (r: Request) => void (r.url().includes("town=") && asked.push(r.url())));
  await open(guest);
  await expect(guest.locator(".tc-form input"), "a guest's field: greyed, saying how").toBeDisabled();
  await expect(guest.locator(".tc-form input")).toHaveAttribute("placeholder", "Sign in to chat with other players.");

  await send(page, `hello from Ann ${run}`);
  // Mine, from the server's answer at once; Bo's within a few seconds (the live poll every 5 s).
  await expect(lineOf(page, `hello from Ann ${run}`)).toHaveCount(1);
  const t0 = Date.now();
  await expect(lineOf(bo, `hello from Ann ${run}`)).toHaveCount(1, { timeout: 10_000 });
  expect(Date.now() - t0, "within a few seconds").toBeLessThan(10_000);
  await send(bo, `hi back from Bo ${run}`);
  await expect(lineOf(page, `hi back from Bo ${run}`)).toHaveCount(1, { timeout: 10_000 });
  // A line from the server is a player's: the name bold, and it takes a tap.
  await expect(lineOf(page, `hi back from Bo ${run}`).locator("b.tc-name")).not.toHaveText("");

  // The guest: none of it, ever asked for, and only the bosses' chatter in the log.
  await guest.waitForTimeout(6_000);
  await expect(guest.locator(".tc-player")).toHaveCount(0);
  expect(asked, "a guest never asks for players' lines").toEqual([]);
  await guest.evaluate(() => (window as any).__townSay("Hollow", "The park gets quiet after dark.", "boss"));
  await expect(guest.locator(".tc-boss")).toHaveCount(1);
});

test("the server decides: a refused message says why over the field and keeps your words; 80 characters; the 15 s wait", async ({ page }) => {
  test.setTimeout(120_000);
  await openSignedIn(page);
  const field = page.locator(".tc-form input");
  const note = page.locator(".tc-note");
  await send(page, `oh ${rot13("shpx")} this`);
  await expect(note).toHaveText("That message isn't allowed.");
  await expect(field, "your words stay, to change them").toHaveValue(`oh ${rot13("shpx")} this`);
  await expect(field).toBeEnabled();
  await expect(page.locator(".tc-player").filter({ hasText: rot13("shpx") })).toHaveCount(0);
  await send(page, "find me at example.com");
  await expect(note).toHaveText("No links or contact details in chat.");
  await send(page, "call me 555 123 4567");
  await expect(note).toHaveText("No links or contact details in chat.");
  // The note goes after a few seconds.
  await expect(note).toHaveCount(0, { timeout: CHAT.noteMs + 3000 });
  // 80 characters: the field stops there, and the server refuses more from anyone who gets past it.
  await expect(field).toHaveAttribute("maxlength", "80");
  const long = await page.request.post("/api/town/chat", { data: { text: "x".repeat(81) } });
  expect(long.status()).toBe(400);
  expect(((await long.json()) as { message: string }).message).toBe("Messages are at most 80 characters.");
  // A message goes; then the wait shows in the field, and the server keeps it whatever the app does.
  await send(page, `all good ${run}`);
  await expect(lineOf(page, `all good ${run}`)).toHaveCount(1);
  await expect(field).toBeDisabled();
  await expect(field).toHaveAttribute("placeholder", /^Wait (1[0-5]|[1-9]) s$/);
  const again = await page.request.post("/api/town/chat", { data: { text: "and again" } });
  expect(again.status()).toBe(429);
  expect(((await again.json()) as { message: string }).message).toBe("One message every 15 s.");
});

test("a tap on a player's name (or, always on, its text): Profile, Mute and Report (a moderator also Remove); Report reaches fair play with the line; Remove takes it from everyone's log; Mute hides the player", async ({ page, browser }, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  // The moderator (a chat admin's address), and two players.
  await openSignedIn(page, true);
  const bo = await another(browser, phone);
  const boId = await openSignedIn(bo);
  const cy = await another(browser, phone);
  await openSignedIn(cy);
  await send(bo, `Bo says something rude ${run}`);
  await send(cy, `Cy says hello ${run}`);
  const boLine = lineOf(page, `Bo says something rude ${run}`);
  const cyLine = lineOf(page, `Cy says hello ${run}`);
  await expect(boLine).toHaveCount(1, { timeout: 10_000 });
  await expect(cyLine).toHaveCount(1, { timeout: 10_000 });

  // A player's own menu: Mute and Report greyed (nothing hidden), no Remove.
  await expect(lineOf(cy, `Cy says hello ${run}`)).toHaveCount(1);
  await lineOf(cy, `Cy says hello ${run}`).locator(".tc-name").click();
  const own = cy.locator(".tc-menu");
  await expect(own.locator("strong")).toHaveText("You");
  await expect(own.getByRole("button", { name: "Profile" })).toBeEnabled();
  await expect(own.getByRole("button", { name: "Mute" })).toBeDisabled();
  await expect(own.getByRole("button", { name: "Report" })).toBeDisabled();
  await expect(own.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await cy.keyboard.press("Escape");
  await expect(own).toHaveCount(0);

  // Report: fair play's report with the line; the answer in the menu, which closes.
  await showLog(page);
  await boLine.locator(".tc-name").click();
  const menu = page.locator(".tc-menu");
  await expect(menu).toBeVisible();
  for (const b of ["Profile", "Mute", "Report", "Remove"]) await expect(menu.getByRole("button", { name: b })).toBeEnabled();
  await menu.getByRole("button", { name: "Report" }).click();
  await expect(menu.locator(".tc-menu-said")).toHaveText(/Thanks|already/);
  await expect(menu).toHaveCount(0, { timeout: 5000 });
  const casePage = await (await page.request.get(`/admin/fairplay/case/${boId}`)).text();
  expect(casePage).toContain("Offensive chat");
  expect(casePage).toContain(`Bo says something rude ${run}`);

  // Remove (a moderator's): the line leaves this log at once, and Bo's and Cy's within a few seconds.
  await showLog(page);
  await boLine.click();
  await menu.getByRole("button", { name: "Remove" }).click();
  await expect(boLine).toHaveCount(0);
  await expect(lineOf(cy, `Bo says something rude ${run}`)).toHaveCount(0, { timeout: 10_000 });
  await expect(lineOf(bo, `Bo says something rude ${run}`)).toHaveCount(0, { timeout: 10_000 });
  await expect(menu).toHaveCount(0, { timeout: 5000 });

  // Profile: Cy's, over the town; Back, and the town is as it was.
  const cyName = (await cyLine.locator("b.tc-name").textContent())!;
  await showLog(page);
  await cyLine.click();
  await menu.getByRole("button", { name: "Profile" }).click();
  await expect(page.locator(".fd-overlay")).toBeVisible();
  await expect(page.locator(".fd-overlay")).toContainText(cyName);
  await page.locator(".fd-overlay").getByRole("button", { name: "Back" }).first().click();
  await expect(page.locator(".fd-overlay")).toHaveCount(0);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");

  // Mute: Cy's lines leave this log, and a new one never shows.
  await showLog(page);
  await cyLine.click();
  await menu.getByRole("button", { name: "Mute" }).click();
  await expect(cyLine).toHaveCount(0);
  await cy.waitForTimeout(15_500);
  await send(cy, `Cy again ${run}`);
  await expect(lineOf(bo, `Cy again ${run}`), "others still see Cy").toHaveCount(1, { timeout: 10_000 });
  await expect(lineOf(page, `Cy again ${run}`), "muted here").toHaveCount(0);
});

test("the switch off (PAUSE_TOWN_CHAT): the field says \"Chat is paused.\" and can't send; the bosses' chatter goes on", async ({ page }) => {
  await openSignedIn(page);
  // (The Worker's variable can't change under a running test: the server's answers say it's off, as they would.)
  await page.route("**/api/status", (route) => route.fulfill({ json: { paused: ["town-chat"], banner: null } }));
  await page.route("**/api/town/chat", (route) => route.fulfill({ status: 503, json: { message: "Chat is paused.", paused: "town-chat" } }));
  await open(page);
  const field = page.locator(".tc-form input");
  await expect(field).toBeDisabled();
  await expect(field).toHaveAttribute("placeholder", "Chat is paused.");
  await say(page, "Hollow", "The park gets quiet after dark.");
  await expect(page.locator(".tc-boss")).toHaveCount(1);
  await expect(log(page)).toHaveCSS("opacity", "1");
});

test("the privacy page and the terms say what the town square's chat is: typed, filtered, reportable, not stored", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/privacy");
  const privacy = page.locator("main, .legal, body").first();
  await expect(privacy).toContainText("Chat is preset lines and emoji, except in the town square, where signed-in players type.");
  await expect(privacy).toContainText("It isn't stored: the server holds each message in memory for 60 seconds, and then it's gone.");
  await expect(privacy).toContainText("If someone reports a message, the report keeps its words and when it was said, for a moderator to read.");
  await expect(privacy).toContainText("A report you made of a town square message is in it without the message's words: they're the other player's.");
  await page.goto("/terms");
  await expect(page.locator("body")).toContainText("In the town square: no slurs, hate, swearing, links or contact details.");
});
