import { expect, type Page } from "@playwright/test";
import { asServerAdmin, createLobbyFromHome, joinFromInvite, named, test } from "./helpers.ts";
import { rot13 } from "../packages/server/src/text-filter.ts";

/**
 * Chat moderation (docs/areas/chat.md, "Moderation"): mute a player from their name (by account, on this device), report
 * them from their profile (fair play's report), a moderator's chat ban from fair play's review page (the player can't
 * send, sees why, and gets a notice once), and the name filter. (Finding a player by id or profile link: the unit test.) The moderator is an admin: the local Worker's ADMIN_EMAILS has a chat moderator's email per project
 * (playwright.config.ts, asServerAdmin).
 */

const run = Date.now().toString(36).slice(-4);
/** A slur from the filter's list (written ROT13-encoded, as in the list), with digits for two letters. */
const blocked = `x${rot13("avttre").replace("i", "1").replace("e", "3")}`;

const lobbyChat = (p: Page) => p.locator(".lobby-chat-box .qchat-lobby");

test("chat moderation: mute from a name, a report from the profile, a moderator's chat ban and its notice, the name filter", async ({ browser }, info) => {
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

  // Mute, one tap from the name (the menu: Profile, Mute): the line goes, and stays gone after a reload.
  await boLine.getByRole("button", { name: `${boName}: profile or mute`, exact: true }).click();
  const menu = lobbyChat(ann).locator(".qmenu");
  await expect(menu.getByRole("button")).toHaveText(["Profile", "Mute", "✕"]);
  await ann.screenshot({ path: info.outputPath("chat-mod-menu-phone.png") });
  await menu.getByRole("button", { name: "Mute", exact: true }).click();
  await expect(boLine).toHaveCount(0);
  await expect(lobbyChat(ann).locator(".qfeed-empty", { hasText: `Muted: ${boName}` })).toBeVisible();
  await ann.reload();
  await expect.poll(() => ann.evaluate(() => (window as any).match?.chat?.enabled ?? false)).toBe(true);
  await expect(lobbyChat(ann).locator(".qfeed-empty", { hasText: `Muted: ${boName}` })).toBeVisible();
  await expect(boLine).toHaveCount(0);
  expect(await ann.evaluate(() => JSON.parse(localStorage.getItem("brc.muted") ?? "[]").length)).toBe(1);
  // Unmuted from the chat's options: his line comes back.
  await lobbyChat(ann).getByRole("button", { name: "Chat options", exact: true }).click();
  await lobbyChat(ann).getByRole("button", { name: `Unmute ${boName}`, exact: true }).click();
  await lobbyChat(ann).getByRole("button", { name: "Done", exact: true }).click();
  await expect(boLine).toBeVisible();
  expect(await ann.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  // Reporting is fair play's, from the profile: Ann taps Bo's name, Profile, Report, "Offensive name or icon".
  await boLine.getByRole("button", { name: `${boName}: profile or mute`, exact: true }).click();
  await menu.getByRole("button", { name: "Profile", exact: true }).click();
  const profile = ann.locator(".fd-overlay");
  // (Oct 28: Report is in the public profile's ••• menu.)
  await profile.getByRole("button", { name: "More options" }).click();
  await ann.getByRole("menuitem", { name: "Report", exact: true }).click();
  await ann.getByRole("button", { name: "Offensive name or icon", exact: true }).click();
  await expect(ann.getByText("Thanks, we'll look into it.")).toBeVisible();
  await ann.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await profile.getByRole("button", { name: "Back", exact: true }).click();
  await expect(boLine).toBeVisible();

  // A moderator, on a phone: Bo is in fair play's open cases (the report opened one); his page has the chat section.
  // A chat ban for a day, with a note.
  const mod = await (await browser.newContext({ ...opts })).newPage();
  await asServerAdmin(mod, "chat");
  await mod.goto("/admin/fairplay");
  await mod.getByRole("link", { name: boName, exact: true }).click();
  await expect(mod.getByRole("heading", { name: boName, exact: true })).toBeVisible();
  await expect(mod.getByRole("cell", { name: "Offensive name or icon", exact: true })).toBeVisible();
  await expect(mod.getByText(/^Chat: open/)).toBeVisible();
  await mod.locator('input[name="chat_reason"]').fill("e2e: a chat ban");
  await mod.locator('input[name="chat_note"]').fill("Keep it friendly.");
  expect(await mod.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await mod.screenshot({ path: info.outputPath("chat-mod-review-phone.png"), fullPage: true });
  await mod.getByRole("button", { name: "Chat ban 1 day", exact: true }).click();
  await expect(mod.locator(".card").first()).toHaveText("Done.");
  await expect(mod.getByText(/^Chat: chat ban until/)).toBeVisible();

  // Bo can't send (the lobby read his ban as he joined... and reads it again as he chats): his panel says why
  // instead of the buttons, and nothing reaches Ann. (Up to CHAT_MOD.recheckMs for a ban decided while he's seated.)
  await expect(async () => {
    await lobbyChat(bo).locator(".qchip", { hasText: "Have fun!" }).click({ timeout: 2_000 });
    await expect(lobbyChat(bo).locator(".qchatoff")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 45_000 });
  await expect(lobbyChat(bo).locator(".qchatoff")).toHaveText(/^Your chat is off until .+: a moderator's decision\.$/);
  await expect(lobbyChat(bo).locator(".qbuttons .qchip")).toHaveCount(0);
  const before = await lobbyChat(ann).locator(".qline").count();
  await bo.evaluate(() => (window as any).match.send({ t: "chat", say: "gg" }));
  await ann.waitForTimeout(1_000);
  // (A line's own words, exactly: a whole line's text is the icon, the name and the words, and `hasText` is a substring in any case, so
  // "♟Bo4tigGood luck!" (a run's name ending in "g", then "Good") read as a "GG": the flaky "Expected: 0 · Received: 1", Nov 2.)
  await expect(lobbyChat(ann).locator(".qline .qline-text", { hasText: /^GG$/ })).toHaveCount(0);
  expect(await lobbyChat(ann).locator(".qline").count()).toBe(before);

  // Home (Leave, then the app opened again): the notice, once, with the note. Gone for good after "Got it", moving
  // around the app included.
  await bo.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(bo.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await bo.reload();
  const notice = bo.getByRole("dialog", { name: "Your chat is off" });
  await expect(notice).toContainText("A moderator turned your chat off until");
  await expect(notice).toContainText("Keep it friendly.");
  await notice.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(notice).toHaveCount(0);
  await bo.getByRole("button", { name: "Your profile", exact: true }).click();
  await bo.getByRole("button", { name: "Back", exact: true }).click();
  await expect(bo.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(notice).toHaveCount(0);
  await bo.reload();
  await expect(bo.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(notice).toHaveCount(0);
  // The global chat (a computer's) refuses him too.
  expect((await bo.request.post("/api/chat", { data: { say: "gg" } })).status()).toBe(403);

  // The name filter: a new device asking for a slur as its name (even dressed up) is "Player", in its profile and its
  // lobby seat; a profile can't take one.
  const cy = await (await browser.newContext({ ...opts })).newPage();
  await named(cy, blocked);
  await cy.goto(`/lobby/${code}?debug`);
  await joinFromInvite(cy);
  await expect(ann.locator(".lobby-players li")).toHaveCount(2);
  await expect(ann.locator(".lobby-players")).toContainText("Player");
  await expect(ann.locator(".lobby-players")).not.toContainText(blocked);
  expect(await cy.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.user.name))).toBe("Player");
  await ann.getByRole("button", { name: "Leave", exact: true }).click();
  await ann.getByRole("button", { name: "Your profile", exact: true }).click();
  await ann.getByRole("button", { name: "Edit name & icon", exact: true }).click();
  await ann.getByLabel("Your name").fill(blocked);
  await ann.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(ann.getByRole("dialog", { name: "Edit name & icon" }).locator(".fd-note")).toHaveText("That name isn't allowed. Pick another one.");
  expect(await ann.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.user.name))).toBe(annName);
});
