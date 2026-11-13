import { createHash } from "node:crypto";
import { devices, expect, type Page } from "@playwright/test";
import { BANNED_LINE, SUPPORT_EMAIL } from "@chessroyale/core";
import { asServerAdmin, asSignedIn, localSql, named, test, pickMode } from "./helpers.ts";

/** The automated reviewer's token in the local Worker (playwright.config.ts). */
const REVIEW = { authorization: "Bearer e2e-review-token-0123456789" };

const myId = (page: Page) => page.evaluate(async () => ((await (await fetch("/api/me")).json()) as { user: { id: string } }).user.id);

/**
 * The ban screen and nothing else (Eric, Nov 13): the line, its address a mailto link, and under it, where sign-in is set up, only the
 * sign-in to another account (a shared device: the review of #687, M1); no other button, no menu or board; no sideways scroll.
 */
async function onlyTheBan(page: Page) {
  await expect(page.locator(".ban-screen")).toBeVisible();
  await expect(page.locator(".ban-line")).toHaveText(BANNED_LINE);
  await expect(page.getByRole("link", { name: SUPPORT_EMAIL })).toHaveAttribute("href", `mailto:${SUPPORT_EMAIL}`);
  const shown = await page.evaluate(() => {
    const box = document.querySelector<HTMLElement>(".ban-screen > .ban-signin");
    return {
      parts: [...document.querySelector(".ban-screen")!.children].map((e) => e.className),
      rest: document.body.innerText.replace(box?.innerText ?? "", "").trim(),
      heading: box?.querySelector("h2")?.textContent ?? null,
      strayButtons: document.querySelectorAll("button").length - document.querySelectorAll(".ban-signin button").length,
    };
  });
  expect(shown).toEqual({ parts: shown.heading ? ["ban-line", "ban-signin"] : ["ban-line"], rest: BANNED_LINE, heading: shown.heading && "Sign in to another account", strayButtons: 0 });
  await expect(page.locator("canvas, .fd-home, .landing, .board-wrap")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
}

/**
 * Every answer the server gives this browser on these routes: the ban answer (403, the line, the app's header). The sign-in's own
 * routes aren't among them: anyone may sign in to their own account on a marked browser (a shared device; ban-gate.ts).
 */
async function everyRouteBanned(page: Page) {
  const routes: [string, "GET" | "POST"][] = [
    ["/api/me", "GET"],
    ["/api/status", "GET"],
    ["/api/live", "GET"],
    ["/api/shop", "GET"],
    ["/api/lobby/ABCDE", "GET"],
    ["/api/play", "POST"],
    ["/api/lobby", "POST"],
    ["/api/town/here", "POST"],
    ["/api/auth/logout", "POST"],
  ];
  for (const [path, method] of routes) {
    const res = method === "GET" ? await page.request.get(path) : await page.request.post(path, { data: {} });
    expect([path, res.status(), res.headers()["x-hc-banned"], await res.json()]).toEqual([path, 403, "1", { banned: true, message: BANNED_LINE }]);
  }
  const options = await page.request.get("/api/auth/config");
  expect([options.status(), options.headers()["x-hc-banned"]]).toEqual([200, undefined]);
}

/**
 * The real config with email sign-in shown (as where it's set up), and its emailed code planted in the local database. `heading`: the
 * sign-in box's (home's for a guest; the ban screen's "Sign in to another account").
 */
async function emailSignIn(page: Page, email: string, code: string, heading = "Sign in to play online") {
  await page.route("**/api/auth/config", async (route) => {
    const real = await route.fetch();
    const body = (await real.json()) as Record<string, unknown>;
    await route.fulfill({ status: real.status(), headers: real.headers(), json: real.ok() ? { ...body, google: true, email: true, onlineNeedsSignIn: true } : body });
  });
  await page.route("**/api/auth/email/start", (route) => route.fulfill({ json: { ok: true } }));
  const at = Date.now();
  const hash = createHash("sha256").update(`${email}:${code}`).digest("hex");
  await localSql(page, `INSERT OR REPLACE INTO email_codes (email, code_hash, expires_at, attempts, sent_at, hour_start, sends_this_hour) VALUES ('${email}', '${hash}', ${at + 600_000}, 0, ${at}, ${at}, 1)`);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("a ban means you can't sign in (Eric, Nov 13): a tab open drops to the ban line; every URL and API route answers only it; signing in again is refused with no session; a lifted ban signs in as before", async ({ page, browser }) => {
  test.setTimeout(3 * 60_000);
  await named(page, "Banny");
  await page.goto("/?debug");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  const id = await myId(page);
  // Signed in (an email on the account, its holder old enough), home open in this tab.
  await asSignedIn(page, "banny");
  await localSql(page, "UPDATE users SET age_ok_at = 1 WHERE id = ?", id);
  const [{ email }] = await localSql<{ email: string }>(page, "SELECT email FROM users WHERE id = ?", id);
  await page.reload();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();

  // The reviewer's API: a decision needs a written reason; its token never bans (the outside review's finding 6; its review's M1).
  expect((await page.request.post(`/api/admin/fairplay/cases/${id}/decision`, { headers: REVIEW, data: { decision: "ban" } })).status()).toBe(400);
  const refused = await page.request.post(`/api/admin/fairplay/cases/${id}/decision`, { headers: REVIEW, data: { decision: "ban", reason: "e2e: a banned account" } });
  expect(refused.status()).toBe(409);
  expect(((await refused.json()) as { message: string }).message).toMatch(/^a ban is for a person/);
  // Without the token, the API and the review page aren't there.
  expect((await page.request.get(`/api/admin/fairplay/cases/${id}`)).status()).toBe(404);
  const reviewPage = await page.request.get("/admin/fairplay");
  expect([reviewPage.status(), await reviewPage.text()]).toEqual([404, "Not found"]);

  // A person bans the account (from another browser): the tab still open drops to the ban line by itself, on its next request.
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await adminPage.goto("/?debug");
  const adminEmail = `ops-admin-fairplay-${test.info().project.name}@e2e.test`;
  await asServerAdmin(adminPage);
  const decide = (decision: "ban" | "clear") => adminPage.request.post(`/api/admin/fairplay/cases/${id}/decision`, { data: { decision, reason: `e2e: ${decision}` } });
  expect(await (await decide("ban")).json()).toEqual({ ok: true, status: "banned", by: `admin:${adminEmail}` });
  await expect(page.locator(".ban-screen")).toBeVisible({ timeout: 15_000 });
  await onlyTheBan(page);
  // Signed out: the account has no session left, and this browser is marked with it.
  expect(await localSql(page, "SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?", id)).toEqual([{ n: 0 }]);
  expect((await page.context().cookies()).find((c) => c.name === "hc_banned")?.value).toBe(id);

  // Every URL, deep links included: only the ban line.
  for (const url of ["/", "/town", "/play", "/profile", `/profile/${id}`, "/settings", "/lobby/ABCDE", "/boss", "/squads/party/ABCDE", "/faq"]) {
    await page.goto(url);
    await onlyTheBan(page);
  }
  // Every API route, asked directly: the ban answer.
  await everyRouteBanned(page);

  // Anyone looking at the banned player's profile sees "Banned" (and nothing else about it).
  const viewerCtx = await browser.newContext();
  const viewer = await viewerCtx.newPage();
  await viewer.goto(`/profile/${id}`);
  await expect(viewer.getByRole("heading", { name: "Banny" })).toBeVisible();
  await expect(viewer.locator(".fp-banned")).toHaveText("Banned");
  await viewerCtx.close();

  // The device forgetting (its storage cleared, cookies kept): the server still answers only the ban.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await onlyTheBan(page);
  // The account's own sign-in cookie never gets it past: a session of its own (the mark cleared) is refused, and ended.
  const token = `e2e${Date.now().toString(36)}${"x".repeat(30)}`;
  await localSql(page, "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", createHash("sha256").update(token).digest("hex"), id, Date.now(), Date.now() + 86_400_000);
  await page.context().clearCookies();
  await page.context().addCookies([{ name: "hc_session", value: token, url: page.url() }]);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await onlyTheBan(page);
  expect(await localSql(page, "SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?", id)).toEqual([{ n: 0 }]);

  // A fresh browser (cookies and storage cleared): signing in to the banned account shows only the ban line, and makes no session.
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await emailSignIn(page, email, "424242");
  await onlyTheBan(page);
  expect(await localSql(page, "SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?", id)).toEqual([{ n: 0 }]);
  await page.unrouteAll();
  await page.goto("/town");
  await onlyTheBan(page);

  // A shared device (the review of #687, M1): the mark keeps out only the banned account. Someone else signs in to their own account
  // from the ban screen (the sign-in to another account under the line) and plays; the browser keeps the banned account's mark.
  const sisCtx = await browser.newContext();
  const sisPage = await sisCtx.newPage();
  await named(sisPage, "Sissy");
  await sisPage.goto("/?debug");
  const sisId = await asSignedIn(sisPage, "sissy");
  await localSql(sisPage, "UPDATE users SET age_ok_at = 1 WHERE id = ?", sisId);
  const [{ email: sisEmail }] = await localSql<{ email: string }>(sisPage, "SELECT email FROM users WHERE id = ?", sisId);
  await sisCtx.close();
  const shared = await browser.newContext();
  await shared.addCookies([{ name: "hc_banned", value: id, url: page.url() }]);
  const tablet = await shared.newPage();
  await emailSignIn(tablet, sisEmail, "616161", "Sign in to another account");
  await expect(tablet.getByRole("button", { name: "PLAY", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(tablet.locator(".ban-screen")).toHaveCount(0);
  expect(await myId(tablet)).toBe(sisId);
  expect((await shared.cookies()).find((c) => c.name === "hc_banned")?.value).toBe(id);
  await shared.close();

  // Lifted (an appeal by email, answered by a person): the next load is the game again, and the account signs in as before.
  expect(await (await decide("clear")).json()).toMatchObject({ ok: true, status: "cleared" });
  await adminCtx.close();
  await page.reload();
  await expect(page.locator(".ban-screen")).toHaveCount(0);
  await emailSignIn(page, email, "535353");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(((await (await page.request.get("/api/me")).json()) as { user: { id: string } }).user.id).toBe(id);
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
