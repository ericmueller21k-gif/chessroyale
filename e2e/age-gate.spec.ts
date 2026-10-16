import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { TOO_YOUNG_LINE } from "@chessroyale/core";

/**
 * The age gate (docs/decisions/2026-10-16-age-gate-and-real-money.md), on a phone: before signing in, a neutral
 * question asks for the birth month and year. Under 13: a friendly line, guest play, and no way to sign in from this
 * device, even after a reload, a retry or cleared cookies. 13 or older: the sign-in options, and the account made keeps
 * when its holder said so. Sign-in isn't set up on the local server (no Google or email secrets), so the config shows
 * both ways to sign in, and the code email is skipped: the code goes straight into the local database. The code check,
 * the age gate and the account are the real server's.
 */

// node:sqlite through require, to read the local D1 that wrangler dev keeps (read only).
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
const D1_DIR = join(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
function d1<T>(query: string, ...params: string[]): T[] {
  for (const f of readdirSync(D1_DIR).filter((x) => x.endsWith(".sqlite"))) {
    const db = new DatabaseSync(join(D1_DIR, f), { readOnly: true });
    try {
      if (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get()) return db.prepare(query).all(...params) as T[];
    } finally {
      db.close();
    }
  }
  throw new Error(`no local D1 with a users table in ${D1_DIR}`);
}

/**
 * Writes to the local D1 (the running server writes to it too: on SQLITE_BUSY, wait a moment and ask again, as
 * problems.spec.ts does).
 */
async function d1Write(page: Page, sql: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync("npx", ["wrangler", "d1", "execute", "hunchess", "--local", "--command", sql], { stdio: "pipe" });
      return;
    } catch (e) {
      const why = String((e as { stderr?: unknown }).stderr ?? e);
      if (!why.includes("SQLITE_BUSY") || attempt >= 10) throw new Error(`d1 execute failed (attempt ${attempt}): ${why.slice(-500)}`);
      await page.waitForTimeout(300);
    }
  }
}

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

  // The question: a birth month and year, nothing chosen, no age mentioned, and no way to sign in yet.
  const box = page.locator(".landing-signin");
  await expect(box.getByText("Before you sign in: when were you born?")).toBeVisible();
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
  expect(d1<{ kind: string; note: string }>("SELECT kind, note FROM ops_reports WHERE id = ?", id)).toEqual([{ kind: "bug", note: "" }]);
});

test("13 or older: the sign-in options after the question, and the account made keeps when its holder said so", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await signInOn(page);
  // (No email service here: the code goes into the local database instead of an inbox.)
  await page.route("**/api/auth/email/start", (route) => route.fulfill({ json: { ok: true } }));
  await page.goto("/");
  await expect(page.getByText("Before you sign in: when were you born?")).toBeVisible();

  // 13 exactly.
  await answer(page, thisMonth, now.getFullYear() - 13);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  expect((await api(page, "/api/auth/config")).body?.age).toBe("ok");

  const email = `age-${Date.now().toString(36)}@e2e.test`;
  const code = "424242";
  const at = Date.now();
  const hash = createHash("sha256").update(`${email}:${code}`).digest("hex");
  await d1Write(
    page,
    `INSERT OR REPLACE INTO email_codes (email, code_hash, expires_at, attempts, sent_at, hour_start, sends_this_hour) VALUES ('${email}', '${hash}', ${at + 600_000}, 0, ${at}, ${at}, 1)`,
  );
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Signed in: home, the account has the email and when its holder said they were old enough; the answer is used up.
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  const me = (await api(page, "/api/me")).body!;
  expect(me.user).toMatchObject({ signedIn: true, email });
  const [row] = d1<{ age_ok_at: number | null }>("SELECT age_ok_at FROM users WHERE email = ?", email);
  expect(row!.age_ok_at).toBeGreaterThanOrEqual(at - 60_000);
  expect((await api(page, "/api/auth/config")).body?.age).toBeUndefined();
});
