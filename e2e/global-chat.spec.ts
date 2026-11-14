import { expect, type Browser, type Page } from "@playwright/test";
import { asAdmin, asSignedIn, named, pickMode, tapInTown, test } from "./helpers.ts";

/**
 * The computer's right column and its typed global chat (Eric's approved mockup, Nov 7: docs/decisions/2026-11-07-typed-chat-column.md).
 * The column is in the same place and size on every front-door page (number checks, at three window sizes); chat is off until you
 * turn it on (the one-time notice); signed-in players type (the filter, one message every 5 s, our `:name:` emoji); the server's
 * cap ("Chat is busy, try again", a test's own chat with a cap of one every 3 s); a device the age gate marked too young keeps the
 * quick chips; guests read. Each test uses its own chat (`?chatroom=`, the test switches) so other tests' lines and the bots stay out.
 * (Replaces the quick chips' spec of Oct 9: "post a line, everyone on the home page sees it, then the 30 s limit".)
 */

const run = Date.now().toString(36).slice(-4);
const desktopOnly = () => test.skip(test.info().project.name !== "desktop", "a computer's right column (a phone has none)");

/** A signed-in player on the home page, in the test's chat `room`, with chat on (the notice, once) unless `off`. */
async function player(browser: Browser, name: string, room: string, o: { off?: boolean; young?: boolean; width?: number; height?: number } = {}): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: o.width ?? 1280, height: o.height ?? 800 } });
  if (o.young) {
    await ctx.addCookies([{ name: "hc_age", value: "under", url: test.info().project.use.baseURL! }]);
    await ctx.addInitScript(() => localStorage.setItem("brc.tooYoung", "1"));
  }
  const page = await ctx.newPage();
  await named(page, name);
  // (A queue of its own, `?pool=`: the three right-column tests press 1 v 1's PLAY at once on parallel workers, and in the
  // shared queue they met each other, so the search was gone before its Cancel: the CI flake of Nov 10.)
  await page.goto(`/?chatroom=${room}&pool=${room}`);
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await asSignedIn(page);
  await page.reload();
  await expect(page.getByRole("region", { name: "Global chat" })).toBeVisible();
  if (!o.off) await turnOn(page);
  return page;
}

async function turnOn(page: Page) {
  const chat = page.getByRole("region", { name: "Global chat" });
  await chat.getByRole("button", { name: "Turn on chat" }).click();
  const notice = page.getByRole("dialog", { name: "Turn on chat?" });
  if (await notice.isVisible().catch(() => false)) await notice.getByRole("button", { name: "Turn on chat" }).click();
  await expect(chat.getByText("Chat is off.")).toHaveCount(0);
}

const field = (p: Page) => p.getByRole("region", { name: "Global chat" }).getByRole("textbox", { name: "Send a message" });

test("chat is off by default; turning it on shows the notice once (Not now keeps it off), kept with the account; then typing: a line with our emoji, seen by another player, the filter, and one message every 5 s", async ({ browser }) => {
  desktopOnly();
  test.setTimeout(180_000);
  const room = `t1${run}`;
  const ann = await player(browser, `Ann${run}`, room, { off: true });
  const chat = ann.getByRole("region", { name: "Global chat" });
  // Off by default: nothing to read, and the band says why in the field's place (the band keeps its place).
  await expect(chat.getByText("Chat is off.")).toBeVisible();
  await expect(field(ann)).toBeDisabled();
  await expect(field(ann)).toHaveAttribute("placeholder", "Chat is off");
  await chat.getByRole("button", { name: "Chat settings" }).click();
  await expect(chat.getByRole("switch", { name: /Chat/ })).toHaveAttribute("aria-checked", "false");
  await ann.keyboard.press("Escape");
  // The notice, word for word (Eric's); Not now keeps it off.
  await chat.getByRole("button", { name: "Turn on chat" }).click();
  const notice = ann.getByRole("dialog", { name: "Turn on chat?" });
  await expect(notice).toContainText(
    "Chat is typed by players. We filter hate speech and slurs, and you can report anyone by tapping their name. You may still see things you don't like: chat at your own risk. You can turn chat off any time in Settings.",
  );
  await notice.getByRole("button", { name: "Not now" }).click();
  await expect(notice).toBeHidden();
  await expect(chat.getByText("Chat is off.")).toBeVisible();
  await chat.getByRole("button", { name: "Turn on chat" }).click();
  await notice.getByRole("button", { name: "Turn on chat" }).click();
  await expect(field(ann)).toBeEnabled();
  await expect(field(ann)).toHaveAttribute("placeholder", "Send a message");
  // Kept with the account (the server's), not only on this device. (The switch shows on at once and its save follows: read the server
  // until the save has landed, not the moment after the tap, Nov 13.)
  await expect.poll(async () => ((await (await ann.request.get("/api/me")).json()) as { chatOn: boolean }).chatOn, { message: "the server keeps chat on" }).toBe(true);
  await ann.reload();
  await expect(field(ann)).toBeEnabled();
  // Off from the gear; on again with no notice (it showed once).
  await chat.getByRole("button", { name: "Chat settings" }).click();
  await chat.getByRole("switch", { name: /Chat/ }).click();
  await expect(chat.getByText("Chat is off.")).toBeVisible();
  await chat.getByRole("button", { name: "Turn on chat" }).click();
  await expect(notice).toBeHidden();
  await expect(field(ann)).toBeEnabled();

  // Someone else reading the same chat.
  const bo = await player(browser, `Bo${run}`, room);
  // Typing: the emoji button's picker puts a code in; Enter sends; the line shows with the emoji drawn.
  await field(ann).fill("hello everyone");
  await chat.getByRole("button", { name: "Emoji" }).click();
  await chat.getByRole("group", { name: "Emoji" }).getByRole("button", { name: /Crown :crown:/ }).click();
  await expect(field(ann)).toHaveValue("hello everyone :crown: ");
  await field(ann).press("Enter");
  await expect(field(ann)).toHaveValue("");
  // One message every 5 s: the field says so, and the server refuses one sent anyway.
  await expect(field(ann)).toHaveAttribute("placeholder", /Next message in [1-5] s/);
  const again = await ann.request.post("/api/chat", { data: { text: "again", chatroom: room } });
  expect(again.status()).toBe(429);
  const mine = chat.locator(".gline.you").filter({ hasText: "hello everyone" });
  await expect(mine).toBeVisible();
  await expect(mine.locator('svg[data-emoji="crown"]')).toBeVisible();
  await expect(mine.locator("time")).toHaveText(/\d/);
  const seen = bo.getByRole("region", { name: "Global chat" }).locator(".gline").filter({ hasText: `Ann${run}` }).filter({ hasText: "hello everyone" });
  await expect(seen).toBeVisible({ timeout: 15_000 });
  await expect(seen).not.toHaveClass(/you/);
  await expect(seen.locator('svg[data-emoji="crown"]')).toBeVisible();
  // The filter: refused with its short reason; the words stay in the field.
  await expect(field(ann)).toHaveAttribute("placeholder", "Send a message", { timeout: 8_000 });
  await field(ann).fill("add me on discord");
  await field(ann).press("Enter");
  await expect(chat.locator(".gchat-note.error")).toHaveText("No links or contact details in chat.");
  await expect(field(ann)).toHaveValue("add me on discord");
  await expect(chat.locator(".gline").filter({ hasText: "discord" })).toHaveCount(0);
  await ann.context().close();
  await bo.context().close();
});

test("under load: past the server's line the sender sees \"Chat is busy, try again\" (a test's chat: one every 3 s, a 6 s line)", async ({ browser }) => {
  desktopOnly();
  test.setTimeout(180_000);
  const room = `t2${run}`;
  const ps: Page[] = [];
  for (const n of ["Al", "Bea", "Cal", "Dee"]) ps.push(await player(browser, `${n}${run}`, room));
  const [a, b, c, d] = ps as [Page, Page, Page, Page];
  // Three at once fill the line (now, in 3 s, in 6 s); the fourth, within 3 s of the first, would wait over 6 s: busy.
  await field(d).fill("me too");
  const sent = await Promise.all([a, b, c].map((p, i) => p.request.post("/api/chat", { data: { text: `rush ${i}`, chatroom: room } })));
  expect(sent.map((r) => r.status())).toEqual([200, 200, 200]);
  await field(d).press("Enter");
  const chat = d.getByRole("region", { name: "Global chat" });
  await expect(chat.locator(".gchat-note.error")).toHaveText("Chat is busy, try again.");
  await expect(field(d)).toHaveValue("me too");
  // A busy refusal doesn't start the wait: a moment later it goes.
  await expect(async () => {
    await field(d).press("Enter");
    await expect(field(d)).toHaveValue("", { timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  // Everyone's lines show, in the order they were sent (the queued ones a moment late).
  await expect(chat.locator(".gline-text")).toHaveText([/^rush \d$/, /^rush \d$/, /^rush \d$/, "me too"], { timeout: 15_000 });
  for (const p of ps) await p.context().close();
});

test("a device the age gate marked too young keeps the quick chips (typed text refused by the server, players' typed lines never shown); a guest reads, and can't post", async ({ browser }) => {
  desktopOnly();
  test.setTimeout(180_000);
  const room = `t3${run}`;
  const ann = await player(browser, `Ann3${run}`, room);
  await field(ann).fill("typed hello");
  await field(ann).press("Enter");
  await expect(field(ann)).toHaveValue("");

  const kid = await player(browser, `Kid${run}`, room, { young: true });
  const chat = kid.getByRole("region", { name: "Global chat" });
  // The chips, not the field.
  await expect(chat.getByRole("tab", { name: "Lobby" })).toHaveAttribute("aria-selected", "true");
  await expect(chat.getByRole("textbox")).toHaveCount(0);
  await chat.getByRole("button", { name: "Anyone up for a Boss Battle?" }).click();
  // (It can wait its turn behind Ann's line, up to the test chat's 3 s, and a line that waited comes with the next live poll, every 5 s.)
  await expect(chat.locator(".gline.you").filter({ hasText: "Anyone up for a Boss Battle?" })).toBeVisible({ timeout: 10_000 });
  // Ann's typed line never reaches this device; the server refuses its typing whatever the app shows.
  await expect(chat.locator(".gline").filter({ hasText: "typed hello" })).toHaveCount(0);
  const typed = await kid.request.post("/api/chat", { data: { text: "hi", chatroom: room } });
  expect(typed.status()).toBe(403);
  expect(((await typed.json()) as { message: string }).message).toMatch(/13 and older/);
  // Ann sees the chip's line.
  await expect(ann.locator(".gline").filter({ hasText: "Anyone up for a Boss Battle?" })).toBeVisible({ timeout: 15_000 });

  // A guest: reads (once chat is on, on this device), can't post.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guest = await ctx.newPage();
  await named(guest, `Guest${run}`);
  await guest.goto(`/?chatroom=${room}`);
  await turnOn(guest);
  const gchat = guest.getByRole("region", { name: "Global chat" });
  await expect(gchat.locator(".gline").filter({ hasText: "typed hello" })).toBeVisible({ timeout: 15_000 });
  await expect(gchat.getByRole("button", { name: "Sign in to chat. Guests can read." })).toBeVisible();
  await expect(gchat.getByRole("textbox")).toHaveCount(0);
  expect((await guest.request.post("/api/chat", { data: { text: "hi", chatroom: room } })).status()).toBe(401);
  expect((await guest.request.post("/api/chat", { data: { say: "l-hey", chatroom: room } })).status()).toBe(401);
  for (const p of [ann, kid, guest]) await p.context().close();
});

test("a phone has no right column: no global chat is drawn or polled there", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "a phone's");
  const asked: string[] = [];
  page.on("request", (r) => r.url().includes("/api/live") && asked.push(r.url()));
  await named(page, `Phone${run}`);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Global chat" })).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(asked.filter((u) => /[?&]chat=/.test(u))).toEqual([]);
});

// ---------------- The column: the same place on every screen ----------------

type Spots = { colX: number; colW: number; friends: number; chat: number; band: number; bandH: number; slotH: number };
/** Where the column's parts are (numbers: the column's box, the y of FRIENDS, GLOBAL CHAT and the message band). */
async function spots(page: Page): Promise<Spots> {
  return page.evaluate(() => {
    const r = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const col = r(".fd-right");
    const band = r(".gchat-band");
    const round = (n: number) => Math.round(n * 10) / 10;
    return { colX: round(col.x), colW: round(col.width), friends: round(r(".rc-friends").y), chat: round(r(".gchat-head .rc-h").y), band: round(band.y), bandH: round(band.height), slotH: round(r(".rc-slot").height) };
  });
}

const town = (p: Page) => p.locator("canvas.town-canvas");
const room = (p: Page) => p.locator("canvas.town-shop-canvas");
/** Where to tap a home in the town now (in the page); null while it isn't drawn. */
async function homeAt(p: Page, id: string) {
  const xy = await p.evaluate((h) => (window as unknown as { __townAt?: (k: string, id: string) => { x: number; y: number } | null }).__townAt?.("home", h) ?? null, id);
  if (!xy) return null;
  const cv = (await town(p).boundingBox())!;
  return { x: cv.x + xy.x, y: cv.y + xy.y };
}
/** Into Babur's Circus (its card's Go in). */
async function goIntoCircus(p: Page) {
  if (!(await homeAt(p, "tiger"))) {
    const chip = p.getByRole("button", { name: "Go to Babur's Circus" });
    if (await chip.count()) await chip.dispatchEvent("click");
    else await p.evaluate(() => (window as unknown as { __townGlide?: (to: string) => void }).__townGlide?.("tiger"));
  }
  await expect.poll(() => homeAt(p, "tiger")).not.toBeNull();
  const card = p.getByRole("dialog", { name: "Babur's Circus", exact: true });
  // (The tap on the frame its point came from: `tapInTown`, Nov 14.)
  await tapInTown(p, "home", "tiger", card);
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room(p)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
}

/** Stills for Eric (not a check): a folder to write the 1280 × 800 screens to. */
const STILLS = process.env.CHAT_STILLS;

for (const [w, h] of [
  [1280, 800],
  [1440, 900],
  [1920, 1080],
] as const) {
  test(`the right column at ${w} × ${h}: FRIENDS, GLOBAL CHAT and the message band at the same place on home and every mode, 1 v 1's search, a page, the town and a room; the town's slot has TOWN and its tools, which work`, async ({ browser }) => {
    desktopOnly();
    test.setTimeout(240_000);
    const page = await player(browser, `Col${w}${run}`, `col${w}${run}`, { width: w, height: h });
    // (The chat log's box lies over the town map's corner and takes taps there: these taps aim at the map.)
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
        document.head.append(s);
      });
    });
    await field(page).fill("gg :happypawn: who's up for squads?");
    await field(page).press("Enter");
    await expect(field(page)).toHaveValue("");
    const shot = async (name: string) => void (STILLS && w === 1280 && (await page.screenshot({ path: `${STILLS}/${name}.png` })));
    const seen: Record<string, Spots> = {};
    seen.home = await spots(page);
    await shot("computer-home");
    for (const mode of ["50 v 50", "1 v 1", "Squads"]) {
      await pickMode(page, mode);
      seen[mode] = await spots(page);
      if (mode === "1 v 1") await shot("computer-1v1");
    }
    // 1 v 1's search (its stage, in the home frame): the global chat stays (it was the home's and the town's only before Nov 7).
    await pickMode(page, "1 v 1");
    await page.getByRole("button", { name: "PLAY", exact: true }).click();
    await expect(page.locator(".dv-search")).toBeVisible();
    await expect(page.getByRole("region", { name: "Global chat" })).toBeVisible();
    seen["1 v 1 search"] = await spots(page);
    await shot("computer-1v1-search");
    await page.locator(".dv-cancel").click();
    await expect(page.locator(".dv-search")).toHaveCount(0);
    await page.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" }).first()).toBeVisible();
    seen.settings = await spots(page);
    // The town (an admin's: the street town, the one with the map button): TOWN and its three tools in the slot; the old bar
    // ("‹ Town square") is gone on a computer.
    await asAdmin(page);
    await page.goto(`/town?chatroom=col${w}${run}`);
    await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
    const slot = page.locator(".rc-slot");
    await expect(slot.getByRole("heading", { name: "TOWN" })).toBeVisible();
    await expect(page.locator(".town-bar")).toHaveCount(0);
    seen.town = await spots(page);
    await shot("computer-town");
    // The tools work: the map turns off and on, the chat's mode moves on, Town settings opens and closes.
    const map = slot.getByRole("button", { name: "Map" });
    const shown = (await map.getAttribute("aria-pressed"))!;
    await map.click();
    await expect(map).toHaveAttribute("aria-pressed", shown === "true" ? "false" : "true");
    await map.click();
    await expect(map).toHaveAttribute("aria-pressed", shown);
    const mode = slot.locator(".tc-mode");
    const was = (await mode.getAttribute("data-mode"))!;
    await mode.click();
    await expect(mode).not.toHaveAttribute("data-mode", was);
    await slot.getByRole("button", { name: "Town settings" }).click();
    const sheet = page.getByRole("dialog", { name: "Town settings" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("radio").first().click();
    await expect(sheet.getByRole("radio").first()).toHaveAttribute("aria-checked", "true");
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    // A room: the same column, TOWN in the slot, the map greyed (it's the town's).
    await goIntoCircus(page);
    await expect(slot.getByRole("heading", { name: "TOWN" })).toBeVisible();
    await expect(slot.getByRole("button", { name: "Map" })).toBeDisabled();
    seen.room = await spots(page);
    await shot("computer-room");
    // Every screen: the column's box, FRIENDS, GLOBAL CHAT and the band, to the tenth of a pixel; the slot is one height.
    for (const [screen, s] of Object.entries(seen)) expect(s, `${screen} at ${w} × ${h}`).toEqual(seen.home);
    expect(seen.home.slotH).toBe(62);
    console.log(`column at ${w} × ${h}: ${JSON.stringify(seen.home)}`);
    await page.context().close();
  });
}
