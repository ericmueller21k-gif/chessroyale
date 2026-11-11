import { expect, type Browser, type Page } from "@playwright/test";
import { named, test } from "./helpers.ts";

/**
 * Friends and invites (docs/decisions/2026-10-15-friends-and-invites.md; the friends page, docs/decisions/2026-11-11-friends-page.md),
 * with two players through the real server: a request from a profile, accepted from the friends page; each sees the other online, with
 * what they're doing; the invites setting (no one, then friends);
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

/** The friends page (Eric, Nov 11): home's Friends in a phone's top bar; the right column's FRIENDS › on a computer. */
async function openFriends(page: Page) {
  if (isComputer()) await page.locator(".rc-friends").click();
  else await page.locator(".fd-top").getByRole("button", { name: /^Friends/ }).click();
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
  if (isComputer()) await expect(bo.page.locator(".rc-friends .fr-badge")).toHaveText("1 new", NEWS);
  else await expect(bo.page.locator(".fd-top .fd-top-friends .fd-news")).toHaveText("1", NEWS);
  await openFriends(bo.page);
  const request = bo.page.locator(".fr-page .fr-row", { hasText: "Ann Friend" });
  await expect(request).toContainText("wants to be friends");
  await shot(bo.page, "request");
  await request.getByRole("button", { name: "Accept" }).click();
  await expect(bo.page.locator("#fr-requests")).toHaveCount(0);
  // (Online, with what she's doing: she's on a front-door page, Bo's profile.)
  await expect(bo.page.locator(".fr-page .fr-row", { hasText: "Ann Friend" })).toContainText("On the home screen", NEWS);

  // Ann sees Bo online: in the live panel on a computer, in her friends list on a phone.
  await ann.page.goto("/?nolanding");
  await openFriends(ann.page);
  const boRow = ann.page.locator(".fr-page .fr-row", { hasText: "Bo Friend" });
  await expect(boRow).toContainText("On the home screen");
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
  await expect(bo.page.locator("#fr-requests")).toHaveCount(0);
  await expect(bo.page.locator("#fp-online")).toHaveText("ONLINE · 0");
  await expect(bo.page.locator("#fp-offline")).toHaveText("OFFLINE · 0");
  await bo.page.getByRole("button", { name: "Requests sent and blocked ›" }).click();
  await expect(bo.page.locator(".fr-page .fr-row", { hasText: "Ann Friend" })).toContainText("Unblock");
});


test("the friends page (Eric, Nov 11): home's Friends opens a page, not a pop-up; a search finds a player by name as you type, nothing moving; their profile's Add Friend; accepted, each sees the other online with what they're doing; Private lobby opens the code sheet", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  // (Names of this run's own: both projects share the server, and D1 lasts the whole run, so a retry or a rerun makes another "Bo
  // Findme". The project, the retry and the time: 16 characters at most, a name's limit; digits only, so the name filter never
  // trips on them.)
  const tag = `${isComputer() ? "C" : "P"}${test.info().retry}${String(Date.now() % 10_000).padStart(4, "0")}`;
  const ann = await player(browser, `Ann Seek ${tag}`);
  const bo = await player(browser, `Bo Findme ${tag}`);
  const page = ann.page;

  // Home's Friends: the page (no pop-up), with Back.
  await openFriends(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await expect(page.locator("#fp-online")).toHaveText("ONLINE · 0");
  await expect(page.locator("#fp-offline")).toHaveText("OFFLINE · 0");
  const lobby = page.getByRole("button", { name: "Private lobby: make one or join with a code" });
  const lobbyBox = await lobby.boundingBox();
  const search = page.getByRole("searchbox", { name: "Search players by name" });
  const results = page.getByRole("region", { name: "Players found" });

  // One character: nothing asked. Then his name, any case: his row (icon, name, level) in the results' box, which keeps one size
  // from its greyed rows to the answer, and nothing on the page under it moves.
  await search.fill("b");
  await expect(results).toHaveCount(0);
  await search.fill(`bo findme ${tag.toLowerCase()}`);
  await expect(results).toBeVisible();
  const resultsBox = await results.boundingBox();
  const hit = results.getByRole("button", { name: `Bo Findme ${tag}, Level 1` });
  await expect(hit).toBeVisible();
  await expect(results.locator(".fp-player")).toHaveCount(1);
  expect(await results.boundingBox()).toEqual(resultsBox);
  expect(await lobby.boundingBox()).toEqual(lobbyBox);
  await shot(page, "page-search");

  // His profile: Add Friend sends the request (Cancel Request then); Back is the friends page, the search as it was.
  await hit.click();
  await page.getByRole("button", { name: "Add Friend" }).click();
  await expect(page.locator(".fr-note")).toHaveText("Request sent.");
  await expect(page.getByRole("button", { name: "Cancel Request" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).first().click();
  await expect(page.getByRole("heading", { name: "Friends", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/friends$/);
  await expect(search).toHaveValue(`bo findme ${tag.toLowerCase()}`);

  // Bo: the request on his friends page; he accepts. Ann is online, on a front-door page.
  await openFriends(bo.page);
  const request = bo.page.locator("#fr-requests ~ .fr-list .fr-row", { hasText: `Ann Seek ${tag}` });
  await expect(request).toContainText("wants to be friends", NEWS);
  await request.getByRole("button", { name: "Accept" }).click();
  await expect(bo.page.locator("#fr-requests")).toHaveCount(0);
  await expect(bo.page.locator("#fp-online")).toHaveText("ONLINE · 1");
  await expect(bo.page.locator(".fr-row", { hasText: `Ann Seek ${tag}` })).toContainText("On the home screen");

  // Bo goes to Chess Town: Ann's page says so (his app tells the server as it changes; her list on its next load).
  await bo.page.goto("/town?nolanding");
  await expect(bo.page.getByRole("heading", { name: "Town square" })).toBeVisible();
  const boRow = page.locator("#fp-online ~ .fr-list .fr-row", { hasText: `Bo Findme ${tag}` });
  await expect(async () => {
    await page.reload();
    await expect(boRow).toContainText("In Chess Town", { timeout: 4_000 });
  }).toPass({ timeout: 45_000 });
  await expect(boRow.getByRole("button", { name: "Invite" })).toBeEnabled();
  await expect(page.locator("#fp-online")).toHaveText("ONLINE · 1");
  await shot(page, "page-online");

  // Private lobby: Play with friends' sheet (make a lobby or join by its code).
  await lobby.click();
  await expect(page.getByRole("dialog", { name: "Play with friends" }).getByRole("button", { name: "Get friend code" })).toBeVisible();
});
