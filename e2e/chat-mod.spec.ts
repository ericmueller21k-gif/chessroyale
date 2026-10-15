import { expect, type Page } from "@playwright/test";
import { createLobbyFromHome, joinFromInvite, named, test } from "./helpers.ts";
import { rot13 } from "../packages/server/src/text-filter.ts";

/**
 * Chat moderation (docs/areas/chat.md, "Moderation"): mute a player from their name (by account, on this device),
 * report a line (a confirmation; it shows on the review page with the lines around it), a moderator's chat ban (the
 * player can't send, sees why, and gets a notice once), and the name filter. The review page is open to the test
 * because the local Worker runs with CHAT_MOD_TEST and no sign-in (playwright.config.ts).
 */

const run = Date.now().toString(36).slice(-4);
/** A slur from the filter's list (written ROT13-encoded, as in the list), with digits for two letters. */
const blocked = `x${rot13("avttre").replace("i", "1").replace("e", "3")}`;

const lobbyChat = (p: Page) => p.locator(".lobby-chat-box .qchat-lobby");

test("chat moderation: mute and report from a name, the review page, a chat ban, the name filter", async ({ browser }, info) => {
  test.setTimeout(3 * 60_000);
  test.skip(info.project.name !== "phone", "one run covers it (the panels are the same on a computer; the review page is the server's)");
  const opts = info.project.use;
  const ann = await (await browser.newContext({ ...opts })).newPage();
  const bo = await (await browser.newContext({ ...opts })).newPage();
  const [annName, boName] = [`Ann${run}`, `Bo${run}`];
  await named(ann, annName);
  await named(bo, boName);

  // Ann makes a private lobby; Bo joins with the invite. Bo says hello.
  await ann.goto("/?debug&mode=crowd");
  await createLobbyFromHome(ann);
  await expect(ann.getByRole("heading", { name: /^Lobby [A-Z0-9]{5}$/ })).toBeVisible();
  const code = (await ann.locator(".invite-code").textContent())!.trim();
  await bo.goto(`/lobby/${code}?debug`);
  await joinFromInvite(bo);
  await expect(ann.locator(".lobby-players li")).toHaveCount(2);
  for (const p of [ann, bo]) await expect.poll(() => p.evaluate(() => (window as any).match.chat.enabled)).toBe(true);
  await lobbyChat(bo).locator(".qchip", { hasText: "Good luck!" }).click();
  const boLine = lobbyChat(ann).locator(".qline", { hasText: "Good luck!" }).filter({ hasText: boName });
  await expect(boLine).toBeVisible();

  // Mute, one tap from the name: the line goes, and stays gone after a reload (by account, on this device).
  await boLine.getByRole("button", { name: `${boName}: profile, mute or report` }).click();
  const menu = lobbyChat(ann).locator(".qmenu");
  await expect(menu.getByRole("button", { name: "Report" })).toBeVisible();
  await ann.screenshot({ path: info.outputPath("chat-mod-menu-phone.png") });
  await menu.getByRole("button", { name: "Mute", exact: true }).click();
  await expect(boLine).toHaveCount(0);
  await expect(lobbyChat(ann).locator(".qfeed-empty", { hasText: `Muted: ${boName}` })).toBeVisible();
  await ann.reload();
  await expect.poll(() => ann.evaluate(() => (window as any).match?.chat?.enabled ?? false)).toBe(true);
  await expect(lobbyChat(ann).locator(".qfeed-empty", { hasText: `Muted: ${boName}` })).toBeVisible();
  await expect(boLine).toHaveCount(0);
  expect(await ann.evaluate(() => JSON.parse(localStorage.getItem("brc.muted") ?? "[]").length)).toBe(1);
  // Unmuted from the chat's options: back.
  await lobbyChat(ann).getByRole("button", { name: "Chat options" }).click();
  await lobbyChat(ann).getByRole("button", { name: `Unmute ${boName}` }).click();
  await lobbyChat(ann).getByRole("button", { name: "Done" }).click();
  await expect(boLine).toBeVisible();

  // Report the line: a short confirmation; again, it's the same report.
  await boLine.getByRole("button", { name: `${boName}: profile, mute or report` }).click();
  await menu.getByRole("button", { name: "Report" }).click();
  await expect(menu.locator(".qmenu-note")).toHaveText("Reported. Thanks: a moderator will look at it.");
  await ann.screenshot({ path: info.outputPath("chat-mod-reported-phone.png") });
  await menu.getByRole("button", { name: "Close" }).click();
  await boLine.getByRole("button", { name: `${boName}: profile, mute or report` }).click();
  await menu.getByRole("button", { name: "Report" }).click();
  await expect(menu.locator(".qmenu-note")).toHaveText("You've already reported this player here.");
  await menu.getByRole("button", { name: "Close" }).click();
  expect(await ann.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  // The review page, on a phone: Bo with one report from one player, the line among the lines around it.
  const mod = await (await browser.newContext({ ...opts })).newPage();
  await mod.goto("/admin/chat");
  await expect(mod.getByRole("heading", { name: "Chat reports" })).toBeVisible();
  const row = mod.locator("tr", { has: mod.getByRole("link", { name: boName, exact: true }) });
  await expect(row.locator("td").nth(1)).toHaveText("1");
  await expect(row.locator("td").nth(2)).toHaveText("1");
  await row.getByRole("link", { name: boName }).click();
  await expect(mod.getByRole("heading", { name: boName })).toBeVisible();
  const report = mod.locator(".card", { hasText: `Lobby ${code}` });
  await expect(report).toContainText(`reported by ${annName}`);
  await expect(report.locator("tr.hard")).toContainText("Good luck!");
  await expect(report.locator("tr.hard .pill")).toHaveText("reported");
  expect(await mod.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await mod.screenshot({ path: info.outputPath("chat-mod-review-phone.png"), fullPage: true });

  // A chat ban for a day, with a note: the reports close, and it reaches the lobby at once.
  await mod.getByPlaceholder(/^Reason/).fill("e2e: a chat ban");
  await mod.getByPlaceholder(/^Note to the player/).fill("Keep it friendly.");
  await mod.getByRole("button", { name: "Chat ban 1 day" }).click();
  await expect(mod.locator(".card").first()).toHaveText("Done.");
  await expect(mod.getByText(/^Chat: chat ban until/)).toBeVisible();
  await expect(mod.getByRole("heading", { name: "Open reports (0)" })).toBeVisible();

  // Bo can't send: the server refuses, and his panel says why instead of the buttons. Ann hears nothing.
  await expect(lobbyChat(bo).locator(".qchip", { hasText: "Have fun!" })).toBeEnabled({ timeout: 10_000 });
  await lobbyChat(bo).locator(".qchip", { hasText: "Have fun!" }).click();
  await expect(lobbyChat(bo).locator(".qpaused")).toHaveText(/^Your chat is off until .+: a moderator's decision\.$/);
  await expect(lobbyChat(bo).locator(".qbuttons .qchip")).toHaveCount(0);
  await bo.evaluate(() => (window as any).match.send({ t: "chat", say: "gg" }));
  await ann.waitForTimeout(1_000);
  await expect(lobbyChat(ann).locator(".qline", { hasText: "Have fun!" })).toHaveCount(0);
  await expect(lobbyChat(ann).locator(".qline", { hasText: "GG" })).toHaveCount(0);
  // Home (Leave, then the app opened again): the notice, once, with the note.
  await bo.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(bo.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await bo.reload();
  const notice = bo.getByRole("dialog", { name: "Your chat is off" });
  await expect(notice).toContainText("A moderator turned your chat off until");
  await expect(notice).toContainText("Keep it friendly.");
  await notice.getByRole("button", { name: "Got it" }).click();
  await expect(notice).toHaveCount(0);
  await bo.reload();
  await expect(bo.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(notice).toHaveCount(0);
  // The global chat (a computer's) refuses him too.
  expect((await bo.request.post("/api/chat", { data: { say: "gg" } })).status()).toBe(403);

  // The name filter: a new device asking for a slur as its name (even dressed up) is "Player", in its profile and its
  // lobby seat (a seat asked for with one directly is "Player N": lobby-chat.test.ts); a profile can't take one.
  const cy = await (await browser.newContext({ ...opts })).newPage();
  await named(cy, blocked);
  await cy.goto(`/lobby/${code}?debug`);
  await joinFromInvite(cy);
  await expect(ann.locator(".lobby-players li")).toHaveCount(2);
  await expect(ann.locator(".lobby-players")).toContainText("Player");
  await expect(ann.locator(".lobby-players")).not.toContainText(blocked);
  expect(await cy.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.user.name))).toBe("Player");
  await ann.getByRole("button", { name: "Leave", exact: true }).click();
  await ann.getByRole("button", { name: "Your profile" }).click();
  await ann.getByRole("button", { name: "Edit name & icon" }).click();
  await ann.getByLabel("Your name").fill(blocked);
  await ann.getByRole("button", { name: "Save name" }).click();
  await expect(ann.locator(".fd-note")).toHaveText("That name isn't allowed. Pick another one.");
  expect(await ann.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.user.name))).toBe(annName);
});
