import { devices, expect, type Page } from "@playwright/test";
import { asServerAdmin, createLobbyFromHome, joinFromInvite, localSql, named, test, pickMode, startBotLevel } from "./helpers.ts";

/** The automated reviewer's token in the local Worker (playwright.config.ts). */
const REVIEW = { authorization: "Bearer e2e-review-token-0123456789" };

const myId = (page: Page) => page.evaluate(async () => ((await (await fetch("/api/me")).json()) as { user: { id: string } }).user.id);

test("a banned account: PLAY, a new lobby and an invite show the ban notice with an appeal; solo still plays; the profile says Banned", async ({ page, browser }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run covers it (the notice is the same sheet on a computer)");
  await named(page, "Banny");
  await page.goto("/?debug&pool=fairplay");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  const id = await myId(page);

  // The reviewer's API: a decision needs a written reason.
  expect((await page.request.post(`/api/admin/fairplay/cases/${id}/decision`, { headers: REVIEW, data: { decision: "ban" } })).status()).toBe(400);
  // The reviewer's token never bans (the outside review's finding 6; its review's M1): a person does.
  const refused = await page.request.post(`/api/admin/fairplay/cases/${id}/decision`, { headers: REVIEW, data: { decision: "ban", reason: "e2e: a banned account" } });
  expect(refused.status()).toBe(409);
  expect(((await refused.json()) as { message: string }).message).toMatch(/^a ban is for a person/);
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await adminPage.goto("/?debug");
  const adminEmail = `ops-admin-fairplay-${test.info().project.name}@e2e.test`;
  await asServerAdmin(adminPage);
  const ban = await adminPage.request.post(`/api/admin/fairplay/cases/${id}/decision`, { data: { decision: "ban", reason: "e2e: a banned account" } });
  expect(await ban.json()).toEqual({ ok: true, status: "banned", by: `admin:${adminEmail}` });
  await adminCtx.close();
  // Without the token, the API and the review page aren't there.
  expect((await page.request.get(`/api/admin/fairplay/cases/${id}`)).status()).toBe(404);
  const admin = await page.request.get("/admin/fairplay");
  expect(admin.status()).toBe(404);
  expect(await admin.text()).toBe("Not found");

  // PLAY (Default): the ban notice, not a queue.
  await pickMode(page);
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  const notice = page.getByRole("dialog", { name: "Your account can't play online" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Solo games against bots are still open.");
  await expect(page.locator(".fd-seats")).toHaveCount(0);
  // The appeal: a sentence at least, then sent.
  const send = notice.getByRole("button", { name: "Send appeal" });
  await expect(send).toBeDisabled();
  await notice.getByRole("textbox").fill("I play at a chess club and I didn't use an engine.");
  await send.click();
  await expect(notice).toContainText("Your appeal is with us. A person will read it");
  await expect(notice.getByRole("textbox")).toHaveCount(0);
  // Fits a phone: nothing wider than the screen, the button big enough to tap.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await notice.getByRole("button", { name: "Close" }).click();
  await expect(notice).toHaveCount(0);

  // Again: the notice remembers the appeal.
  await pickMode(page);
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(notice).toContainText("Your appeal is with us");
  await notice.getByRole("button", { name: "Close" }).click();

  // A new lobby: the same.
  await createLobbyFromHome(page);
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Close" }).click();
  await page.getByRole("dialog", { name: "Play with friends" }).getByRole("button", { name: "Close" }).click();

  // An invite to someone else's lobby: the lobby turns the banned account away with the notice.
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const host = await hostCtx.newPage();
  await named(host, "Hosty");
  await host.goto("/?debug&mode=crowd");
  await createLobbyFromHome(host);
  await expect(host.getByRole("heading", { name: /^Lobby / })).toBeVisible();
  const code = (await host.locator(".invite-code").textContent())!.trim();
  await page.goto(`/lobby/${code}?debug`);
  await joinFromInvite(page);
  await expect(notice).toBeVisible();
  await expect(host.locator(".lobby-players li")).toHaveCount(1);

  // Anyone looking at the banned player's profile sees "Banned" (and nothing else about it).
  await host.goto(`/profile/${id}`);
  await expect(host.getByRole("heading", { name: "Banny" })).toBeVisible();
  await expect(host.locator(".fp-banned")).toHaveText("Banned");

  // Solo stays open: the queue fills with bots and the match begins.
  await page.goto("/?debug&pool=fairplay");
  await pickMode(page);
  await page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Bots/ }).click();
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await startBotLevel(page);
  await expect(page.locator(".fd-seats")).toBeVisible();
  await expect(notice).toHaveCount(0);
});

test("the reviewer's API lists a reported player's case with its evidence", { tag: "@phone-only" }, async ({ page, browser }) => {
  test.skip(test.info().project.name !== "desktop", "one run covers it");
  await named(page, "Reporter");
  await page.goto("/?debug");
  const otherCtx = await browser.newContext({ ...devices["iPhone 13"], browserName: undefined } as never);
  const other = await otherCtx.newPage();
  await named(other, "Reported");
  await other.goto("/?debug");
  await expect(other.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  const target = await myId(other);
  // A report from the profile page (no match): a watch case for a person to read.
  await page.goto(`/profile/${target}`);
  // (Oct 28: Report is in the public profile's ••• menu.)
  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Report", exact: true }).click();
  await page.getByRole("button", { name: "Offensive name or icon", exact: true }).click();
  await expect(page.getByText("Thanks, we'll look into it.")).toBeVisible();
  const list = (await (await page.request.get("/api/admin/fairplay/cases?status=watch", { headers: REVIEW })).json()) as { cases: { userId: string; reports: number; status: string }[] };
  expect(list.cases.find((c) => c.userId === target)).toMatchObject({ status: "watch", reports: 1 });
  const detail = (await (await page.request.get(`/api/admin/fairplay/cases/${target}`, { headers: REVIEW })).json()) as { reports: { reason: string; match: string | null }[] };
  expect(detail.reports).toEqual([expect.objectContaining({ reason: "Offensive name or icon", match: null })]);
});

test("the engine pool (Nov 10): pooled accounts' PLAY seats them together, apart from everyone else, with bots after the usual wait; the queue looks the same", { tag: "@phone-only" }, async ({ page, browser }) => {
  test.setTimeout(2 * 60_000);
  const code = (p: Page) => p.evaluate(() => (window as unknown as { match?: { code?: string } }).match?.code).catch(() => undefined);
  const q = `ep-${Date.now().toString(36).slice(-6)}`;
  const open = async (p: Page, name: string, pooled: boolean) => {
    await named(p, name);
    await p.goto(`/?debug&pool=${q}`);
    await expect(p.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
    // (Into the pool as detection would put them: the case's status, which the server reads from the account on each PLAY.)
    if (pooled) await localSql(p, "INSERT INTO fairplay_cases (user_id, status, reason, opened_at, updated_at) VALUES (?, 'pool', 'e2e: the engine pool', ?, ?)", await myId(p), Date.now(), Date.now());
    await pickMode(p);
    return p;
  };
  const clean = await open(page, "Clean", false);
  const a = await open(await (await browser.newContext()).newPage(), "Pooly", true);
  const b = await open(await (await browser.newContext()).newPage(), "Poolette", true);
  for (const p of [clean, a, b]) await p.getByRole("button", { name: "PLAY", exact: true }).click();
  for (const p of [clean, a, b]) await expect.poll(() => code(p)).toBeTruthy();
  // The two pooled players meet each other, never the clean one.
  expect(await code(a)).toBe(await code(b));
  expect(await code(a)).not.toBe(await code(clean));
  // Nothing on screen differs: the same queue lines; bots fill each lobby after the usual wait (8 s here).
  await expect(a.locator(".fd-queue-mode")).toHaveText((await clean.locator(".fd-queue-mode").textContent())!);
  for (const p of [clean, a]) await expect(p.locator(".fd-count-n")).toHaveText("100", { timeout: 20_000 });
  expect(await code(a)).not.toBe(await code(clean));
});
