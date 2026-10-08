import { expect, type Locator, type Page } from "@playwright/test";
import { createLobbyFromHome, named, soloFromHome, test } from "./helpers.ts";

/**
 * Quick chat in the lobby, before the match (DECISIONS.md, "Lobby chat"): one channel for everyone waiting, the same
 * lines and checks as in the match, a hello from the bots as they sit down, and the lines carry on into the match.
 * The queue's count, grid and Cancel are never covered, and nothing moves as lines arrive.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
/** Where it is on the page (a phone's chat is under Cancel, a scroll away on a short screen: scrolling moves nothing). */
const box = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  const scrollY = await l.page().evaluate(() => window.scrollY);
  return { x: Math.round(b.x), y: Math.round(b.y + scrollY), width: Math.round(b.width), height: Math.round(b.height) };
};
type Box = Awaited<ReturnType<typeof box>>;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
/** The queue's own pieces, where they are (the lobby chat must cover none of them, and move none of them). */
const queueBoxes = async (p: Page) => ({
  count: await box(p.locator(".fd-queue-count")),
  seats: await box(p.locator(".fd-seats")),
  cancel: await box(p.locator(".fd-cancel")),
  chat: await box(p.locator(".lchat")),
});
const run = Date.now().toString(36).slice(-5);

test("two players in a Default queue chat before the match starts: each sees the other's lines, the bots say hello, and the lines carry into the match", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const opts = test.info().project.use;
  const pool = `lchat-${test.info().project.name[0]}${run}`;
  const ann = await (await browser.newContext({ ...opts })).newPage();
  const bo = await (await browser.newContext({ ...opts })).newPage();
  await named(ann, "Ann Lobby");
  await named(bo, "Bo Lobby");
  for (const p of [ann, bo]) await p.goto(`/?debug&pool=${pool}`);
  // Both PLAY at once: the same queue (8 s locally before the bots fill in).
  await Promise.all([ann, bo].map((p) => p.getByRole("button", { name: "PLAY", exact: true }).click()));
  for (const p of [ann, bo]) {
    await expect(p.locator(".fd-count-n")).toHaveText("2", { timeout: 6_000 });
    await expect(p.locator(".fd-home.queueing .qchat-lobby")).toBeVisible();
    await expect(p.locator(".qchat-lobby .qhead-title")).toHaveText("Lobby");
    await expect.poll(() => p.evaluate(() => (window as any).match.chat.enabled)).toBe(true);
  }
  const before = await queueBoxes(ann);
  // Never over the count, the grid or Cancel.
  for (const k of ["count", "seats", "cancel"] as const) expect(overlaps(before.chat, before[k])).toBe(false);
  // A phone: under the grid (and Cancel). A computer: the left column, under your card, beside the lobby.
  if (test.info().project.name === "phone") expect(before.chat.y).toBeGreaterThanOrEqual(before.seats.y + before.seats.height);
  else expect(before.chat.x + before.chat.width).toBeLessThanOrEqual(before.seats.x);
  expect(before.chat.height).toBeGreaterThanOrEqual(120);

  // Ann says hello; Bo sees it with Ann's name (from the lobby). A plan goes too: there are no teams yet.
  await ann.locator(".qchat-lobby .qchip", { hasText: "Good luck!" }).click();
  await expect(ann.locator(".qchat-lobby .qline.you", { hasText: "Good luck!" })).toBeVisible();
  await expect(bo.locator(".qchat-lobby .qline", { hasText: "Good luck!" }).filter({ hasText: "Ann Lobby" })).toBeVisible();
  await bo.locator(".qchat-lobby .qchip", { hasText: "Defend the king!" }).click();
  await expect(ann.locator(".qchat-lobby .qline", { hasText: "Defend the king!" }).filter({ hasText: "Bo Lobby" })).toBeVisible();
  // Right after sending, Bo's buttons grey out (one line every 3 s), as in the match.
  await expect(bo.locator(".qchat-lobby .qchip", { hasText: "Wow!" })).toBeDisabled();
  // The server drops free text and lines Bo doesn't own.
  await bo.evaluate(() => {
    const m = (window as any).match;
    m.send({ t: "chat", say: "add me on discord" });
    m.send({ t: "chat", say: "gk-crown" });
  });
  // Nothing in the queue moved for the chat, and the chat kept its size.
  const after = await queueBoxes(ann);
  expect(after).toEqual(before);

  // Time's up: the bots fill the seats and one or two say hello in the lobby, before the votes begin.
  await expect(ann.locator(".fd-count-n")).toHaveText("100", { timeout: 20_000 });
  const botLine = ann.locator('.qchat-lobby .qline[data-from^="bot"]');
  await expect(botLine.first()).toBeVisible({ timeout: 3_000 });
  expect(await phase(ann)).toBe("lobby");
  // (The queue's own lines change as the bots fill in: "Unranked" appears and moves what's under it. The chat covers
  // nothing; on a phone it keeps its size, on a computer it gives up the room the new line takes in its column.)
  const filled = await queueBoxes(ann);
  if (test.info().project.name === "phone") expect([filled.chat.width, filled.chat.height]).toEqual([before.chat.width, before.chat.height]);
  else expect(filled.chat.height).toBeGreaterThanOrEqual(120);
  for (const k of ["count", "seats", "cancel"] as const) expect(overlaps(filled.chat, filled[k])).toBe(false);
  await expect.poll(() => phase(ann), { timeout: 20_000 }).toMatch(/vote|opening|play|watching/);
  // In the match the lobby's lines are still there (marked as the lobby's); nothing else of Bo's went through.
  const lines = await ann.evaluate(() => (window as any).match.chat.lines().map((l: any) => ({ say: l.say, lobby: !!l.lobby, from: l.from })));
  const people = lines.filter((l: any) => /^p\d/.test(l.from));
  expect(people.map((l: any) => [l.say, l.lobby])).toEqual([
    ["good-luck", true],
    ["defend-king", true],
  ]);
  expect(lines.filter((l: any) => l.lobby && !/^p\d/.test(l.from)).length).toBeGreaterThanOrEqual(1);
  // On the match's screen, once its panel shows: the lobby's line, tagged "lobby" where tags show (a computer).
  await expect.poll(() => phase(ann), { timeout: 60_000 }).toMatch(/play|watching/);
  if (test.info().project.name === "desktop") {
    await expect(ann.locator(".qchat-side .qline.lobby", { hasText: "Good luck!" }).locator(".qline-to")).toHaveText("lobby");
  } else {
    await expect(ann.locator(".qchat-split .qline", { hasText: "Defend the king!" })).toBeVisible();
  }
  expect(await ann.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("Solo's queue: the bots say hello, your line shows, and the match itself has no chat", async ({ page }) => {
  await named(page, "Solo Sam");
  await page.goto("/?debug");
  await soloFromHome(page);
  await expect(page.locator(".fd-seats")).toBeVisible({ timeout: 60_000 });
  const chat = page.locator(".fd-home.queueing .qchat-lobby");
  await expect(chat).toBeVisible();
  await chat.locator(".qchip", { hasText: "Have fun!" }).click();
  await expect(chat.locator(".qline.you", { hasText: "Have fun!" })).toBeVisible();
  // A bot (one already in its seat) says hello while the seats fill (botLobbyChance is 1: always one or two).
  const hello = chat.locator('.qline[data-from^="bot"]');
  await expect(hello.first()).toBeVisible({ timeout: 4_000 });
  const from = await hello.first().getAttribute("data-from");
  expect(await page.evaluate((id) => (window as any).match.players.some((p: any) => p.id === id && p.isBot), from)).toBe(true);
  expect(await phase(page)).toBe("lobby");
  // The match: Solo has no chat (the screens are as they were).
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("vote");
  await expect(page.locator(".qchat")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).match.chat.enabled)).toBe(false);
});

test("a private lobby: chat while you wait for the host", async ({ page }) => {
  await named(page, "Host Hal");
  await page.goto("/?debug");
  await createLobbyFromHome(page);
  await expect(page.getByRole("heading", { name: /^Lobby [A-Z0-9]{5}$/ })).toBeVisible();
  const chat = page.locator(".lobby-chat-box .qchat-lobby");
  await expect(chat).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).match.chat.enabled)).toBe(true);
  await chat.locator(".qrow.emoji .qchip, .qgroup-lines.emoji .qchip").first().click();
  await expect(chat.locator(".qline.you.emoji")).toBeVisible();
  // It doesn't crowd out the start button.
  const start = page.getByRole("button", { name: /^Start with/ });
  await expect(start).toBeVisible();
  expect(overlaps(await box(chat), await box(start))).toBe(false);
});
