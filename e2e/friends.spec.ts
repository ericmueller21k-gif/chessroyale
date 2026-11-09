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

test("two players: a request accepted, online in each other's list, the invites setting, an invite joined from its toast, then a block", { tag: "@phone-only" }, async ({ browser }) => {
  test.setTimeout(4 * 60_000);
  const ann = await player(browser, "Ann Friend");
  const bo = await player(browser, "Bo Friend");

  // Ann opens Bo's profile (as from a name anywhere) and adds him.
  await ann.page.goto(`/profile/${bo.id}?nolanding`);
  await ann.page.getByRole("button", { name: "Add Friend" }).click();
  await expect(ann.page.locator(".fr-note")).toHaveText("Request sent.");
  await expect(ann.page.getByRole("button", { name: "Cancel Request" })).toBeVisible();
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
  // (Oct 28: Block is in the public profile's ••• menu, still a first tap that asks and a second that blocks.)
  await bo.page.getByRole("button", { name: "More options" }).click();
  await bo.page.getByRole("menuitem", { name: "Block", exact: true }).click();
  await bo.page.getByRole("menuitem", { name: "Tap again to block" }).click();
  await bo.page.getByRole("button", { name: "More options" }).click();
  await expect(bo.page.getByRole("menuitem", { name: "Unblock" })).toBeVisible();
  await bo.page.keyboard.press("Escape");
  // (A blocked player can't be challenged: Challenge is greyed, not gone.)
  await expect(bo.page.getByRole("button", { name: "Challenge" })).toBeDisabled();
  // Ann: no longer friends; her invite gets the same answer as any setting; her request looks sent but never reaches him.
  await ann.page.goto(`/profile/${bo.id}?nolanding`);
  await expect(ann.page.getByRole("button", { name: "Add Friend" })).toBeVisible();
  await ann.page.getByRole("button", { name: "Challenge" }).click();
  await expect(ann.page.locator(".fr-note")).toHaveText("This player isn't taking invites right now.");
  await ann.page.getByRole("button", { name: "Add Friend" }).click();
  await expect(ann.page.locator(".fr-note")).toHaveText("Request sent.");
  await bo.page.goto("/friends?nolanding");
  await expect(bo.page.locator(".fr-page .fr-row", { hasText: "Ann Friend" })).toContainText("Unblock");
  await expect(bo.page.locator("#fr-requests")).toHaveCount(0);
  await expect(bo.page.locator("#fr-friends")).toHaveText("FRIENDS · 0");
});


test("the friends overlay (Eric, Nov 9): the top bar's Friends opens your friends in a centered box; tap one for Invite to play or View profile; Private lobby opens the code sheet; the dim closes it", { tag: "@phone-only" }, async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const ann = await player(browser, "Ann Overlay");
  const bo = await player(browser, "Bo Overlay");
  // (Friends through the API: the request and its answer, as the first test does from a profile and the list.)
  const post = (page: Page, action: string, body: object) =>
    page.evaluate(([a, b]) => fetch(`/api/friends/${a}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.status), [action, body] as const);
  expect(await post(ann.page, "request", { id: bo.id })).toBe(200);
  expect(await post(bo.page, "answer", { id: ann.id, accept: true })).toBe(200);
  await ann.page.reload();

  // The top bar's Friends: a centered box titled Friends (not the old sheet), Bo in it, online.
  await ann.page.locator(".fd-top").getByRole("button", { name: /^Friends/ }).click();
  const box = ann.page.getByRole("dialog", { name: "Friends", exact: true });
  await expect(box).toBeVisible();
  await expect(ann.page.getByRole("dialog", { name: "Play with friends" })).toHaveCount(0);
  const row = box.getByRole("button", { name: /^Bo Overlay, / });
  await expect(row).toHaveAccessibleName("Bo Overlay, Online", NEWS);
  await expect(box.getByRole("button", { name: "Requests sent and blocked ›" })).toBeEnabled();
  // (Its opening scale done, then measured.)
  await box.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  // Centered: the box's middle within a few pixels of the window's.
  const b = (await box.boundingBox())!;
  const vw = ann.page.viewportSize()!.width;
  expect(Math.abs(b.x + b.width / 2 - vw / 2)).toBeLessThan(3);

  // Tap Bo: his menu, Invite to play (on: he's online) and View profile; opening it moves nothing in the box.
  const before = await row.boundingBox();
  await row.click();
  const menu = box.getByRole("menu", { name: "Bo Overlay: what to do" });
  await expect(menu.getByRole("button", { name: "Invite to play" })).toBeEnabled();
  await expect(menu.getByRole("button", { name: "View profile" })).toBeVisible();
  expect(await row.boundingBox()).toEqual(before);
  await menu.getByRole("button", { name: "Close the menu" }).click();
  await expect(menu).toHaveCount(0);

  // Private lobby ›: Play with friends' sheet (make a lobby or join by code), as the top bar opened before; its ✕ back home.
  await box.getByRole("button", { name: /^Private lobby ›/ }).click();
  const sheet = ann.page.getByRole("dialog", { name: "Play with friends" });
  await expect(sheet.getByRole("button", { name: "Get friend code" })).toBeVisible();
  await expect(box).toHaveCount(0);
  await sheet.getByRole("button", { name: "Close" }).click();
  await ann.page.locator(".fd-top").getByRole("button", { name: /^Friends/ }).click();

  // A tap on the dim closes the box.
  await ann.page.mouse.click(4, ann.page.viewportSize()!.height - 4);
  await expect(box).toHaveCount(0);

  // View profile: his profile, and the box is gone.
  await ann.page.locator(".fd-top").getByRole("button", { name: /^Friends/ }).click();
  await box.getByRole("button", { name: /^Bo Overlay, / }).click();
  await box.getByRole("menu").getByRole("button", { name: "View profile" }).click();
  await expect(box).toHaveCount(0);
  await expect(ann.page.getByRole("button", { name: "Challenge" })).toBeVisible();
});
