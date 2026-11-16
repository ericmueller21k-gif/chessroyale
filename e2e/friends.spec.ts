import { expect, type Browser, type Page } from "@playwright/test";
import { named, pickMode, test } from "./helpers.ts";

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
  // (The address keeps home's query: test switches and links survive the page, Nov 11 fix round.)
  await expect(page).toHaveURL(/\/friends\?nolanding$/);
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
  // Bo's home: the notice at the top right (Eric, Nov 16), within seconds. Accept puts him in her lobby.
  const toast = bo.page.locator(".fr-toast");
  await expect(toast).toContainText("Ann Friend invited you to a Crowd lobby", NEWS);
  await shot(bo.page, "invite-toast");
  await toast.getByRole("button", { name: "Accept" }).click();
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
  await expect(page).toHaveURL(/\/friends\?nolanding$/);
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

/** Two players made friends through the API (a request and its answer), each on their own page. */
async function befriend(a: { page: Page; id: string }, b: { page: Page; id: string }) {
  const post = (p: Page, action: string, body: object) =>
    p.evaluate(([action, body]) => fetch(`/api/friends/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.status), [action, body] as const);
  expect(await post(a.page, "request", { id: b.id })).toBe(200);
  expect(await post(b.page, "answer", { id: a.id, accept: true })).toBe(200);
}

/** PARTY_SHOTS=<dir>: the 50 v 50 party's stills for Eric (dark, as the mockup's). */
async function partyShot(page: Page, name: string) {
  const dir = process.env.PARTY_SHOTS;
  if (!dir) return;
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: `${dir}/${isComputer() ? "computer" : "phone"}-${name}.png` });
}

test("50 v 50 Party (Eric, Nov 16): seven + seats; a + opens the friends sheet; the invited seat waits; the notice's Accept brings the friend in; the leader's Find match puts both in one lobby, on one team", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const q = `party-${test.info().project.name[0]}${Date.now().toString(36).slice(-5)}`;
  const ann = await player(browser, "Ann Party");
  const bo = await player(browser, "Bo Party");
  await befriend(ann, bo);
  for (const p of [ann.page, bo.page]) await p.goto(`/?nolanding&debug&pool=${q}`);

  // Ann: 50 v 50, Party, PLAY: the queue screen, idle: her seat, seven "+", the party's count, her Find match beside Leave.
  await pickMode(ann.page, "50 v 50");
  await ann.page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Party/ }).click();
  await ann.page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(ann.page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50 · Party");
  await expect(ann.page.locator(".fd-seat.party-open")).toHaveCount(7);
  await expect(ann.page.locator(".fd-queue-count")).toHaveText("1 / 8");
  await expect(ann.page.getByRole("button", { name: "Find match" })).toBeEnabled();
  await expect(ann.page.locator(".fd-party-note")).toHaveText("Party matches aren't ranked");
  await partyShot(ann.page, "1-alone");
  // (A laptop's window, 1280 × 600: Leave, Find match and the line under them still inside it, the grid giving way. The fix round of #747.)
  if (isComputer()) {
    const size = ann.page.viewportSize()!;
    await ann.page.setViewportSize({ width: 1280, height: 600 });
    await expect.poll(() => ann.page.evaluate(() => Math.round(document.querySelector(".fd-party-note")!.getBoundingClientRect().bottom))).toBeLessThanOrEqual(600);
    await expect(ann.page.getByRole("button", { name: "Find match" })).toBeInViewport({ ratio: 1 });
    await ann.page.setViewportSize(size);
  }

  // A "+": her friends sheet (no codes, no links); Invite. Bo's seat waits ("…"), named under the grid.
  await ann.page.locator(".fd-seat.party-open").first().click();
  const sheet = ann.page.getByRole("dialog", { name: "Invite friends" });
  await expect(sheet).toContainText("Up to 7 friends queue with you, all on your team.");
  await partyShot(ann.page, "2-sheet");
  await sheet.locator(".fr-row", { hasText: "Bo Party" }).getByRole("button", { name: "Invite" }).click();
  await expect(sheet.locator(".fr-row", { hasText: "Bo Party" }).getByRole("button", { name: "Invited" })).toBeDisabled();
  await ann.page.keyboard.press("Escape");
  await expect(ann.page.locator(".fd-seat.party-invited")).toHaveCount(1);
  await expect(ann.page.locator(".fd-seat.party-open")).toHaveCount(6);
  await expect(ann.page.locator(".fd-you-line")).toContainText("Bo Party invited");
  await partyShot(ann.page, "3-invited");

  // Bo's home: the notice at the top right, "Ann Party invited you", Accept and Decline; it sits on top and pushes nothing.
  const toast = bo.page.locator(".fr-toast");
  await expect(toast).toContainText("Ann Party invited you", NEWS);
  await expect(toast).toContainText("to their 50 v 50 party");
  const box = (await toast.boundingBox())!;
  const vw = bo.page.viewportSize()!.width;
  expect(vw - (box.x + box.width)).toBeLessThan(24);
  // (A computer: at the very top. A phone: under its top bar, never over its buttons: the fix round of #747.)
  expect(box.y).toBeLessThan(isComputer() ? 40 : 90);
  const over = await bo.page.evaluate(([x, y, w, h]) => [...document.querySelectorAll(".fd-top button")].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.right > x && r.left < x + w && r.bottom > y && r.top < y + h; }).map((b) => b.getAttribute("aria-label") ?? b.textContent), [box.x, box.y, box.width, box.height] as const);
  expect(over).toEqual([]);
  // (On top: what's at its middle is the notice itself, never the page under it.)
  expect(await bo.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".fr-toast"), [box.x + box.width / 2, box.y + box.height / 2] as const)).toBe(true);
  await expect(toast.getByRole("button", { name: "Decline" })).toBeVisible();
  await partyShot(bo.page, "4-notice");
  await toast.getByRole("button", { name: "Accept" }).click();

  // Bo is in: his screen is the party's, Find match greyed with whose it is; Ann's has him in a seat.
  await expect(bo.page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50 · Party");
  await expect(bo.page.getByRole("button", { name: "Waiting for Ann Party" })).toBeDisabled();
  await expect(ann.page.locator(".fd-queue-count")).toHaveText("2 / 8");
  await expect(ann.page.locator(".fd-seat.friend")).toHaveCount(1);
  await expect(ann.page.locator(".fd-seat.party-invited")).toHaveCount(0);
  await expect(ann.page.locator(".fd-seat.party-open")).toHaveCount(6);
  // (In: the invite is off his list.)
  await expect.poll(() => bo.page.evaluate(() => fetch("/api/friends").then((r) => r.json()).then((a) => a.state.invites.length))).toBe(0);
  await partyShot(ann.page, "5-joined");
  await partyShot(bo.page, "6-member");

  // Ann's Find match: both in one 50 v 50 lobby, the party's seats first. Her Cancel brings both back to idle, out of it (M5).
  await ann.page.getByRole("button", { name: "Find match" }).click();
  await sameLobby(ann.page, bo.page);
  await expect(ann.page.getByRole("button", { name: "Cancel" })).toBeEnabled();
  await partyShot(ann.page, "7-searching");
  await ann.page.getByRole("button", { name: "Cancel" }).click();
  for (const p of [ann.page, bo.page]) await expect.poll(() => lobbyOf(p)).toBeUndefined();
  await expect(ann.page.getByRole("button", { name: "Find match" })).toBeEnabled();
  await expect(bo.page.getByRole("button", { name: "Waiting for Ann Party" })).toBeDisabled();
  await expect(bo.page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50 · Party");

  // Find match again: the lobby's party group is the two of them (the server's own, through its test hook), so they play on one
  // team every time, not by chance. Through the fill and loading the party's screen stays, its Cancel greyed (M4: nothing shifts).
  await ann.page.getByRole("button", { name: "Find match" }).click();
  const lobby = await sameLobby(ann.page, bo.page);
  await expect.poll(() => partyGroups(ann.page, lobby)).toEqual([[ann.id, bo.id].sort()]);
  await watchFill(ann.page);
  for (const p of [ann.page, bo.page]) await expect.poll(() => phaseOf(p), { timeout: 30_000 }).toBe("vote");
  const frames = await ann.page.evaluate(() => (window as any).__fillFrames as { title: string | null; go: string | null }[]);
  expect(frames.length).toBeGreaterThan(0);
  expect(new Set(frames.map((f) => `${f.title} · ${f.go}`))).toEqual(new Set(["Crowd · 50 v 50 · Party · Cancel:off"]));
  const teams = await ann.page.evaluate((ids) => ids.map((uid) => (window as any).match.standingsList.find((s: any) => s.uid === uid)?.team), [ann.id, bo.id]);
  expect(teams[0]).toMatch(/^[wb]$/);
  expect(teams[1]).toBe(teams[0]);
});

/** The lobby a page is in (window.match's code, while that match is still open: the debug hook keeps the last one), if any. */
const lobbyOf = (p: Page) => p.evaluate(() => ((m) => (m && !m.closed ? (m.code as string) : undefined))((window as any).match)).catch(() => undefined);
const phaseOf = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
/** Both pages in one lobby: its code. */
async function sameLobby(a: Page, b: Page): Promise<string> {
  await expect.poll(() => lobbyOf(a)).toBeTruthy();
  const code = (await lobbyOf(a))!;
  await expect.poll(() => lobbyOf(b)).toBe(code);
  return code;
}
/** The lobby's 50 v 50 party groups, each by its members' accounts (sorted): GET /api/lobby/CODE?parties, a test hook. */
const partyGroups = (p: Page, code: string) =>
  p.evaluate((c) => fetch(`/api/lobby/${c}?parties`).then((r) => r.json()).then((b) => ((b.parties ?? []) as string[][]).map((g) => [...g].sort())), code);
/**
 * Every frame from the lobby filling until the match leaves the queue: the title and the leader's button (`__fillFrames`), put on
 * the page before the fill, so the fill's first frame is caught (LESSONS: a moment the server times is watched from inside the page).
 */
const watchFill = (p: Page) =>
  p.evaluate(() => {
    const w = window as any;
    w.__fillFrames = [];
    const tick = () => {
      const m = w.match;
      const queued = !!m && (m.phase.kind === "lobby" || m.phase.kind === "loading");
      if (queued && m.filledAt) {
        const go = document.querySelector<HTMLButtonElement>(".fd-party-go");
        w.__fillFrames.push({ title: document.querySelector(".fd-queue-mode")?.textContent ?? null, go: go ? `${go.textContent}:${go.disabled ? "off" : "on"}` : null });
      }
      if (!m || queued) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

test("50 v 50 Party reloads (the fix round of #747, M2) and the leader leaving mid-search: back in the party and its lobby; the leader keeps the lead; the leader's Cancel recalls a reloaded member; Leave hands the lead on", async ({ browser }) => {
  test.setTimeout(4 * 60_000);
  const q = `prl-${test.info().project.name[0]}${Date.now().toString(36).slice(-5)}`;
  const ann = await player(browser, "Ann Lead");
  const bo = await player(browser, "Bo Member");
  await befriend(ann, bo);
  // (`partyfill`: this party's lobbies fill 70 s after they open, so (b) still has room after (a)'s 21 s wait: production's is 60 s.)
  for (const p of [ann.page, bo.page]) await p.goto(`/?nolanding&debug&pool=${q}&partyfill=70`);
  await pickMode(ann.page, "50 v 50");
  await ann.page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Party/ }).click();
  await ann.page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(ann.page.getByRole("button", { name: "Find match" })).toBeEnabled();
  // (Bo invited as the friends sheet does it, through the API; he's in from his notice's Accept.)
  const party = await ann.page.evaluate(() => localStorage.getItem("brc.crowdparty.current"));
  const invite = await ann.page.evaluate(
    ([id, code]) => fetch("/api/friends/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, kind: "crowdparty", code }) }).then((r) => r.status),
    [bo.id, party] as const,
  );
  expect(invite).toBe(200);
  await expect(bo.page.locator(".fr-toast")).toContainText("Ann Lead invited you", NEWS);
  await bo.page.locator(".fr-toast").getByRole("button", { name: "Accept" }).click();
  const waiting = bo.page.getByRole("button", { name: "Waiting for Ann Lead" });
  await expect(waiting).toBeDisabled();

  // (c) Ann reloads: back on her party's screen, still its leader; Bo still waits for her.
  await ann.page.reload();
  await expect(ann.page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50 · Party");
  await expect(ann.page.getByRole("button", { name: "Find match" })).toBeEnabled();
  await expect(waiting).toBeDisabled();
  await expect(ann.page.locator(".fd-seat.friend")).toHaveCount(1);

  // (a) Bo's app is placed, but its check on the lobby comes back stale ("playing", as if it had begun), so it stays out. He reloads
  // more than 20 s after the placing (older than a hold): his app asks again, finds the lobby still waiting, and he's in with Ann, in
  // the party's group. A placing is joined by its lobby's state, never by its age (the delta review's test gap).
  const status = /\/api\/lobby\/[A-Z2-9]{5}$/;
  let asked = 0;
  await bo.page.route(status, (r) => (asked++, r.fulfill({ json: { open: true, phase: "playing" } })));
  await ann.page.getByRole("button", { name: "Find match" }).click();
  await expect.poll(() => lobbyOf(ann.page)).toBeTruthy();
  const placedAt = Date.now();
  await expect.poll(() => asked).toBeGreaterThan(0);
  await expect(bo.page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50 · Party");
  expect(await lobbyOf(bo.page)).toBeUndefined();
  await bo.page.unroute(status);
  // (Time passing is the point: the placing older than its 20 s hold. This party's lobby fills 45 s after it opened.)
  await bo.page.waitForTimeout(Math.max(0, placedAt + 21_000 - Date.now()));
  await bo.page.reload();
  const lobby = await sameLobby(ann.page, bo.page);
  await expect(bo.page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50 · Party");
  await expect.poll(() => partyGroups(ann.page, lobby)).toEqual([[ann.id, bo.id].sort()]);

  // (b) Bo reloads inside the lobby: back on the party's screen there; Ann's Cancel brings him back to idle, out of the lobby.
  await bo.page.reload();
  await expect.poll(() => lobbyOf(bo.page)).toBe(lobby);
  await expect(bo.page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50 · Party");
  await expect(waiting).toBeDisabled();
  await ann.page.getByRole("button", { name: "Cancel" }).click();
  for (const p of [ann.page, bo.page]) await expect.poll(() => lobbyOf(p)).toBeUndefined();
  await expect(waiting).toBeDisabled();
  await expect(bo.page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50 · Party");

  // The leader leaving mid-search: Bo leads, the search goes on (his Cancel), and Ann is home.
  await ann.page.getByRole("button", { name: "Find match" }).click();
  const again = await sameLobby(ann.page, bo.page);
  await ann.page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(ann.page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(bo.page.getByRole("button", { name: "Cancel" })).toBeEnabled();
  expect(await lobbyOf(bo.page)).toBe(again);
  await bo.page.getByRole("button", { name: "Cancel" }).click();
  await expect(bo.page.getByRole("button", { name: "Find match" })).toBeEnabled();
  await expect.poll(() => lobbyOf(bo.page)).toBeUndefined();
});

test("50 v 50 Party: a search stopped because everyone was away says so on the party's screen, on top, pushing nothing (the delta review's N5)", async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const q = `pas-${test.info().project.name[0]}${Date.now().toString(36).slice(-5)}`;
  const ann = await player(browser, "Ann Away");
  // (The server's word that the last search stopped with everyone away (CROWD_PARTY.awayStopMs, its unit test): added to the party's
  // own messages once `stopped` is set, as everyone coming back finds it. A real one needs the matchmaker busy for 20 s.)
  let stopped = false;
  await ann.page.routeWebSocket(/\/api\/crowd\/party\/[A-Z2-9]{5}\/ws/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((m) => server.send(m));
    server.onMessage((m) => {
      const msg = typeof m === "string" ? JSON.parse(m) : null;
      ws.send(stopped && msg?.t === "party" ? JSON.stringify({ ...msg, party: { ...msg.party, stopped: "away" } }) : m);
    });
  });
  await ann.page.goto(`/?nolanding&debug&pool=${q}`);
  await pickMode(ann.page, "50 v 50");
  await ann.page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Party/ }).click();
  await ann.page.getByRole("button", { name: "PLAY", exact: true }).click();
  const find = ann.page.getByRole("button", { name: "Find match" });
  await expect(find).toBeEnabled();
  const note = ann.page.locator(".fd-notice");
  await expect(note).toHaveCount(0);
  const fixed = [find, ann.page.locator(".fd-queue-count"), ann.page.locator(".fd-seats")];
  const boxes = async () => (await Promise.all(fixed.map((l) => l.boundingBox()))).flatMap((b) => [b!.x, b!.y, b!.width, b!.height]);
  const before = await boxes();
  /** Every box where it was (to 1 px). */
  const same = async () => (await boxes()).forEach((v, i) => expect(Math.abs(v - before[i]!), `box value ${i}`).toBeLessThanOrEqual(1));
  // Back from being away (a reload): the line on top, everything where it was; its X takes it away, and nothing moves.
  stopped = true;
  await ann.page.reload();
  await expect(note).toHaveText(/The search stopped: everyone was away\./);
  await expect(find).toBeEnabled();
  const onTop = await note.evaluate((n) => {
    const r = n.getBoundingClientRect();
    return n.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
  expect(onTop, "on top").toBe(true);
  await same();
  await note.getByRole("button", { name: "Dismiss" }).click();
  await expect(note).toHaveCount(0);
  await same();
});
