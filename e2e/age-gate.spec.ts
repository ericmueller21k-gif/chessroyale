import { createHash } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";
import { AGE_STEP_LINE, TOO_YOUNG_LINE } from "@chessroyale/core";
import { localSql, pickMode } from "./helpers.ts";

/**
 * The age gate (docs/decisions/2026-10-16-age-gate-and-real-money.md; since Nov 12, 2026-11-12-signin-without-age.md), on a
 * phone: Sign in comes first, with no question; Sign up, below it, asks a neutral question (the birth month and year) before the
 * account is made, and so does a sign-in into an account that never answered. Under 13: a friendly line, guest play, and no way
 * to sign in from this device, even after a reload, a retry or cleared cookies. 13 or older: the account made keeps when its
 * holder said so, and signs in on a fresh browser with no question. Sign-in isn't set up on the local server (no Google or email
 * secrets), so the config shows both ways to sign in, and the code email is skipped: the code goes straight into the local
 * database. The code check, the age gate and the account are the real server's.
 */

/** Runs a query on the local D1, through the server's own (helpers' localSql: no second process on its file). */
const d1 = <T = Record<string, unknown>>(page: Page, query: string, ...params: string[]) => localSql<T>(page, query, ...params);

/** Writes to the local D1, through the server's own (helpers' localSql: one writer, so the server is never locked out). */
const d1Write = (page: Page, sql: string) => localSql(page, sql).then(() => undefined);

/** The real config, with Google and email sign-in shown (as where they're set up). */
async function signInOn(page: Page) {
  await page.route("**/api/auth/config", async (route) => {
    const real = (await (await route.fetch()).json()) as Record<string, unknown>;
    await route.fulfill({ json: { ...real, google: true, email: true, onlineNeedsSignIn: true } });
  });
}

const api = (page: Page, path: string, init?: { method: string; body?: unknown }) =>
  page.evaluate(
    async ([p, i]) => {
      const r = await fetch(p, i ? { method: i.method, headers: { "content-type": "application/json" }, body: JSON.stringify(i.body ?? {}) } : undefined);
      return { status: r.status, body: (await r.json().catch(() => null)) as Record<string, any> | null };
    },
    [path, init] as const,
  );

/** A 6-digit code for `email` in the local database, as if it had been emailed (no email service here). */
async function codeFor(page: Page, email: string, code: string) {
  const at = Date.now();
  const hash = createHash("sha256").update(`${email}:${code}`).digest("hex");
  await d1Write(
    page,
    `INSERT OR REPLACE INTO email_codes (email, code_hash, expires_at, attempts, sent_at, hour_start, sends_this_hour) VALUES ('${email}', '${hash}', ${at + 600_000}, 0, ${at}, ${at}, 1)`,
  );
  return at;
}

/** Picks a birth month (1-12) and year in the question, then Continue. */
async function answer(page: Page, month: number, year: number) {
  await page.getByLabel("Birth month").selectOption(String(month));
  await page.getByLabel("Birth year").selectOption(String(year));
  await page.getByRole("button", { name: "Continue" }).click();
}

const now = new Date();
const thisMonth = now.getMonth() + 1;

test("under 13: a neutral question, a friendly line, guest play, and no sign-in from this device after a reload, a retry or cleared cookies", async ({ page, context }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await signInOn(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to play online" })).toBeVisible();
  // A name chosen before the question (a guest's).
  expect((await api(page, "/api/me", { method: "PATCH", body: { name: "Sam Lee" } })).body?.user.name).toBe("Sam Lee");

  // Sign up's question: a birth month and year, nothing chosen, no age mentioned, and no way to sign up yet.
  const box = page.locator(".landing-signin");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(box.getByRole("heading", { name: "Sign up: when were you born?" })).toBeVisible();
  await expect(page.getByLabel("Birth month")).toHaveValue("");
  await expect(page.getByLabel("Birth year")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  const words = await box.evaluate((el) => {
    const c = el.cloneNode(true) as HTMLElement;
    c.querySelectorAll("select").forEach((s) => s.remove());
    return c.textContent ?? "";
  });
  expect(words).not.toMatch(/\d|old|young|age\b|adult|child|kid/i);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveCount(0);
  // Nothing wider than the phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

  // 12 years 11 months.
  const almost = thisMonth === 12 ? { month: 1, year: now.getFullYear() - 12 } : { month: thisMonth + 1, year: now.getFullYear() - 13 };
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/auth/age"));
  await answer(page, almost.month, almost.year);
  // Only the answer leaves the phone.
  expect((await sent).postDataJSON()).toEqual({ oldEnough: false });
  await expect(page.getByRole("status").filter({ hasText: TOO_YOUNG_LINE })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Online play needs an account" })).toBeVisible();
  await expect(page.getByLabel("Birth month")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await expect(page.locator(".or-line")).toHaveCount(0);
  // Sign in included (Nov 12): no email field, no Sign in or Sign up.
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Sign (in|up)$/ })).toHaveCount(0);

  // A reload (or the back button and back again) doesn't ask again; nor does the server let a new answer through.
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: TOO_YOUNG_LINE })).toBeVisible();
  await expect(page.getByLabel("Birth month")).toHaveCount(0);
  expect((await api(page, "/api/auth/age", { method: "POST", body: { oldEnough: true } })).body).toEqual({ age: "under" });
  const refused = await api(page, "/api/auth/email/verify", { method: "POST", body: { email: "sam@e2e.test", code: "123456" } });
  expect([refused.status, refused.body?.tooYoung]).toEqual([403, true]);
  expect((await api(page, "/api/me")).body?.user.name).toBe("Player");

  // Cookies cleared: this phone's storage tells the server again.
  await context.clearCookies();
  const told = page.waitForRequest((r) => r.url().endsWith("/api/auth/age"));
  await page.reload();
  expect((await told).postDataJSON()).toEqual({ oldEnough: false });
  await expect(page.getByRole("status").filter({ hasText: TOO_YOUNG_LINE })).toBeVisible();
  await expect.poll(async () => (await api(page, "/api/auth/config")).body?.age).toBe("under");

  // Guest play: solo against bots, under the default name, nothing to type to anyone.
  await page.getByRole("button", { name: "Play vs 99 bots as a guest" }).click();
  await pickMode(page);
  await expect(page.locator(".fd-hint")).toContainText("Solo vs 99 bots");
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Player", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit name & icon" })).toHaveCount(0);
  await expect(page.getByText("KEEP YOUR PROFILE")).toHaveCount(0);
  await page.goto("/settings");
  await expect(page.getByText("You're a guest on this device.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: TOO_YOUNG_LINE })).toBeVisible();
  await page.getByRole("button", { name: /Feedback/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Nothing you type.")).toBeVisible();
  await expect(sheet.locator("textarea")).toHaveCount(0);
  await expect(sheet.getByRole("radiogroup")).toHaveCount(0);
  // Settings opens it on Feedback, which becomes a bug report here: it sends, and it's kept without a note.
  await sheet.getByRole("button", { name: "Send" }).click();
  const shown = sheet.getByRole("status");
  await expect(shown).toHaveText(/^Report [A-HJKMNP-Z2-9]{6} — share this id$/);
  const id = (await shown.textContent())!.match(/Report (\w{6})/)![1]!;
  expect(await d1<{ kind: string; note: string }>(page, "SELECT kind, note FROM ops_reports WHERE id = ?", id)).toEqual([{ kind: "bug", note: "" }]);
});

test("Sign up: the question first, then the sign-up options; the account made keeps when its holder said so", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await signInOn(page);
  // (No email service here: the code goes into the local database instead of an inbox.)
  await page.route("**/api/auth/email/start", (route) => route.fulfill({ json: { ok: true } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign up: when were you born?" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);

  // 13 exactly.
  await answer(page, thisMonth, now.getFullYear() - 13);
  await expect(page.getByRole("heading", { name: "Sign up to play online" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  expect((await api(page, "/api/auth/config")).body?.age).toBe("ok");

  const email = `age-${Date.now().toString(36)}@e2e.test`;
  const code = "424242";
  const at = await codeFor(page, email, code);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();

  // Signed in: home, the account has the email and when its holder said they were old enough; the answer is used up.
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  const me = (await api(page, "/api/me")).body!;
  expect(me.user).toMatchObject({ signedIn: true, email });
  const [row] = await d1<{ age_ok_at: number | null }>(page, "SELECT age_ok_at FROM users WHERE email = ?", email);
  expect(row!.age_ok_at).toBeGreaterThanOrEqual(at - 60_000);
  expect((await api(page, "/api/auth/config")).body?.age).toBeUndefined();
});

test("Sign in on a fresh browser (Eric, Nov 12): an account that answered signs in with no question; one that never did is asked once, and its code finishes it", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await signInOn(page);
  await page.route("**/api/auth/email/start", (route) => route.fulfill({ json: { ok: true } }));
  // Every age question that appears, from the first frame, and every answer sent.
  await page.addInitScript(() => {
    const w = window as unknown as { __asked: string[] };
    w.__asked = [];
    new MutationObserver(() => {
      const h = document.querySelector('[aria-label="Birth month"]') && document.querySelector(".signin-title")?.textContent;
      if (h && w.__asked.at(-1) !== h) w.__asked.push(h);
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  const answers: unknown[] = [];
  page.on("request", (r) => void (r.url().endsWith("/api/auth/age") && answers.push(r.postDataJSON())));
  const asked = () => page.evaluate(() => (window as unknown as { __asked: string[] }).__asked);
  const tag = Date.now().toString(36);
  // An account made on another device, whose holder said they were old enough; and one from before the question.
  const known = `known-${tag}@e2e.test`;
  const old = `old-${tag}@e2e.test`;
  await page.goto("/");
  await d1Write(page, `INSERT INTO users (id, name, email, created_at, last_seen, age_ok_at) VALUES ('k${tag}', 'Kim', '${known}', 1, 1, 2), ('o${tag}', 'Olly', '${old}', 1, 1, NULL)`);

  // The front door: Sign in first, its options at once; Sign up below.
  await expect(page.getByRole("heading", { name: "Sign in to play online" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign up", exact: true })).toBeVisible();
  await codeFor(page, known, "135790");
  await page.getByLabel("Email").fill(known);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("6-digit code").fill("135790");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect((await api(page, "/api/me")).body!.user).toMatchObject({ signedIn: true, email: known, name: "Kim" });
  // No question, no answer sent, and the account's answer as it was.
  expect(await asked()).toEqual([]);
  expect(answers).toEqual([]);
  expect(await d1(page, "SELECT age_ok_at FROM users WHERE email = ?", known)).toEqual([{ age_ok_at: 2 }]);

  // Signed out, the account from before the question: asked once, then the same code signs in (nothing typed again).
  await api(page, "/api/auth/logout", { method: "POST" });
  await page.reload();
  await codeFor(page, old, "246801");
  await page.getByLabel("Email").fill(old);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("6-digit code").fill("246801");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: AGE_STEP_LINE })).toBeVisible();
  expect((await api(page, "/api/me")).body!.user.signedIn).toBe(false);
  await answer(page, 6, 1990);
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect((await api(page, "/api/me")).body!.user).toMatchObject({ signedIn: true, email: old, name: "Olly" });
  expect(await asked()).toEqual([AGE_STEP_LINE]);
  expect(answers).toEqual([{ oldEnough: true }]);
  const [row] = await d1<{ age_ok_at: number | null }>(page, "SELECT age_ok_at FROM users WHERE email = ?", old);
  expect(row!.age_ok_at).toBeGreaterThan(2);
});

test("Sign in, then the question, then the code no longer works (review of PR #656): the reason shows, with the address kept", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await signInOn(page);
  await page.route("**/api/auth/email/start", (route) => route.fulfill({ json: { ok: true } }));
  const tag = Date.now().toString(36);
  const old = `late-${tag}@e2e.test`;
  await page.goto("/");
  await d1Write(page, `INSERT INTO users (id, name, email, created_at, last_seen, age_ok_at) VALUES ('l${tag}', 'Lee', '${old}', 1, 1, NULL)`);
  await codeFor(page, old, "975310");
  await page.getByLabel("Email").fill(old);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("6-digit code").fill("975310");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: AGE_STEP_LINE })).toBeVisible();
  // The question takes longer than the code lives.
  await d1Write(page, `UPDATE email_codes SET expires_at = 1 WHERE email = '${old}'`);
  await answer(page, 6, 1990);
  await expect(page.getByText("That code didn't work", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(old);
  expect((await api(page, "/api/me")).body!.user.signedIn).toBe(false);
});
