import { expect, type Browser, type Page } from "@playwright/test";
import { named, test } from "./helpers.ts";

/**
 * Friends and invites (docs/decisions/2026-10-15-friends-and-invites.md), with two players through the real server: a request from a
 * profile, accepted from the friends list; each sees the other online; the invites setting (no one, then friends);
 * an invite from the list makes a lobby and shows on the other's home as a toast, and Join puts them in it; a block
 * ends the friendship, refuses invites and keeps requests from reaching the blocker. FRIENDS_SHOTS=<dir> saves the
 * screenshots Eric reviews (a profile's buttons, the list, a request, the invite toast, the settings).
 */

const isComputer = () => test.info().project.name === "desktop";
/** New things for you reach the app with the live line (every 5 s on a front-door page) and a presence batch (5 s). */
const NEWS = { timeout: 25_000 };

async function player(browser: Browser, name: string): Promise<{ page: Page; id: string }> {
  const page = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await named(page, name);
  await page.goto("/?nolanding");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  const id = await page.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.user.id as string));
  return { page, id };
}

/** The friends list: the live panel's "All friends" on a computer, your profile's Friends on a phone (Eric, Oct 18). */
async function openFriends(page: Page) {
  if (isComputer()) await page.locator(".fr-panel").getByRole("button", { name: "All friends ›" }).click();
  else {
    await page.locator(".fd-top .fd-ring").click();
    await page.getByRole("button", { name: /^Friends/ }).click();
  }
  await expect(page.getByRole("heading", { name: "Friends", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/friends$/);
}

async function shot(page: Page, name: string) {
  const dir = process.env.FRIENDS_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}-${isComputer() ? "computer-1280" : "phone-390"}.png` });
}

test("two players: a request accepted, online in each other's list, the invites setting, an invite joined from its toast, then a block", async ({ browser }) => {
  test.setTimeout(4 * 60_000);
  const ann = await player(browser, "Ann Friend");
  const bo = await player(browser, "Bo Friend");

  // Ann opens Bo's profile (as from a name anywhere) and adds him.
  await ann.page.goto(`/profile/${bo.id}?nolanding`);
  await ann.page.getByRole("button", { name: "Add friend" }).click();
  await expect(ann.page.locator(".fr-note")).toHaveText("Request sent.");
  await expect(ann.page.getByRole("button", { name: "Cancel request" })).toBeVisible();
  await ann.page.locator(".fr-note").scrollIntoViewIfNeeded();
  await shot(ann.page, "profile");
  await ann.page.emulateMedia({ colorScheme: "dark" });
  await shot(ann.page, "profile-dark");
  await ann.page.emulateMedia({ colorScheme: "light" });

  // Bo, on his home: "1 new" within seconds; his list has the request; he accepts.
  // (A phone: a count on Friends in the top bar.)
  if (isComputer()) await expect(bo.page.locator(".fr-panel .fr-badge")).toHaveText("1 new", NEWS);
  else await expect(bo.page.locator(".fd-top .fd-top-friends .fd-news")).toHaveText("1", NEWS);
  await openFriends(bo.page);
  const request = bo.page.locator(".fr-page .fr-row", { hasText: "Ann Friend" });
  await expect(request).toContainText("wants to be friends");
  await shot(bo.page, "request");
  await request.getByRole("button", { name: "Accept" }).click();
  await expect(bo.page.locator("#fr-requests")).toHaveCount(0);
  await expect(bo.page.locator(".fr-page .fr-row", { hasText: "Ann Friend" })).toContainText("Online");

  // Ann sees Bo online: in the live panel on a computer, in her friends list on a phone.
  await ann.page.goto("/?nolanding");
  if (isComputer()) await expect(ann.page.locator(".fr-panel .fr-row", { hasText: "Bo Friend" })).toContainText("Online", NEWS);
  await openFriends(ann.page);
  const boRow = ann.page.locator(".fr-page .fr-row", { hasText: "Bo Friend" });
  await expect(boRow).toContainText("Online");
  await shot(ann.page, "list");

  // Bo takes invites from no one: Ann's invite is refused, and no lobby is made for it.
  await bo.page.goto("/settings?nolanding");
  const from = bo.page.getByRole("radiogroup", { name: "Invites from" });
  await from.getByRole("radio", { name: "No one" }).click();
  await expect(from.getByRole("radio", { name: "No one" })).toHaveAttribute("aria-checked", "true");
  await boRow.getByRole("button", { name: "Invite" }).click();
  await expect(ann.page.locator(".fr-page .fd-error")).toHaveText("This player isn't taking invites right now.");
  await expect(ann.page.getByRole("heading", { name: "Friends", exact: true })).toBeVisible();
  // Friends only: Ann is his friend.
  await from.getByRole("radio", { name: "Friends" }).click();
  await expect(from.getByRole("radio", { name: "Friends" })).toHaveAttribute("aria-checked", "true");
  await from.scrollIntoViewIfNeeded();
  await shot(bo.page, "settings");
  // The setting is kept on his account.
  await bo.page.reload();
  await expect(bo.page.getByRole("radiogroup", { name: "Invites from" }).getByRole("radio", { name: "Friends" })).toHaveAttribute("aria-checked", "true");

  // Ann invites him from her list: a lobby is made in her home screen's mode (Crowd) and she's in it.
  await bo.page.goto("/?nolanding");
  await boRow.getByRole("button", { name: "Invite" }).click();
  const heading = ann.page.getByRole("heading", { name: /^Lobby [A-Z2-9]{5}$/ });
  await expect(heading).toBeVisible();
  const code = (await heading.textContent())!.slice("Lobby ".length);
  // Bo's home: the toast, within seconds. Join puts him in her lobby.
  const toast = bo.page.locator(".fr-toast");
  await expect(toast).toContainText("Ann Friend invited you to a Crowd lobby", NEWS);
  await shot(bo.page, "invite-toast");
  await toast.getByRole("button", { name: "Join" }).click();
  await expect(bo.page.getByRole("heading", { name: `Lobby ${code}` })).toBeVisible();
  await expect(ann.page.locator(".lobby-players")).toContainText("Bo Friend");
  // (Joined: the invite is off his list.)
  await expect.poll(() => bo.page.evaluate(() => fetch("/api/friends").then((r) => r.json()).then((a) => a.state.invites.length))).toBe(0);

  // Both leave. Bo blocks Ann from her profile (a second tap confirms).
  for (const p of [ann.page, bo.page]) await p.getByRole("button", { name: "Leave" }).click();
  await bo.page.goto(`/profile/${ann.id}?nolanding`);
  await bo.page.getByRole("button", { name: "Block", exact: true }).click();
  await bo.page.getByRole("button", { name: "Tap again to block" }).click();
  await expect(bo.page.getByRole("button", { name: "Unblock" })).toBeVisible();
  await expect(bo.page.getByRole("button", { name: "Invite to play" })).toHaveCount(0);
  // Ann: no longer friends; her invite gets the same answer as any setting; her request looks sent but never reaches him.
  await ann.page.goto(`/profile/${bo.id}?nolanding`);
  await expect(ann.page.getByRole("button", { name: "Add friend" })).toBeVisible();
  await ann.page.getByRole("button", { name: "Invite to play" }).click();
  await expect(ann.page.locator(".fr-note")).toHaveText("This player isn't taking invites right now.");
  await ann.page.getByRole("button", { name: "Add friend" }).click();
  await expect(ann.page.locator(".fr-note")).toHaveText("Request sent.");
  await bo.page.goto("/friends?nolanding");
  await expect(bo.page.locator(".fr-page .fr-row", { hasText: "Ann Friend" })).toContainText("Unblock");
  await expect(bo.page.locator("#fr-requests")).toHaveCount(0);
  await expect(bo.page.locator("#fr-friends")).toHaveText("FRIENDS · 0");
});

