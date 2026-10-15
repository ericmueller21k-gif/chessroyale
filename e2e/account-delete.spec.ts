import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Settings → Download my data and Delete account (docs/decisions/2026-10-15-delete-my-account-and-download-my-data.md):
 * the file holds the account's data; deleting asks first, then the account is gone (its profile, its session on every
 * device, this device's settings), its results stay without it, and the local database has nothing of it left.
 */

// node:sqlite through require, to read the local D1 that wrangler dev keeps (read only).
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
const D1_DIR = join(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");

/** Runs a query on the local D1 (the file with the users table). */
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

const me = (page: import("@playwright/test").Page) => page.evaluate(() => fetch("/api/me").then((r) => r.json()) as Promise<{ user: { id: string; name: string } }>);

test("Settings: download my data, then delete the account (asked first); it's gone everywhere, its results stay without it", async ({ page, browser }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Your profile" })).toBeVisible();
  // A guest with a name, a solo result, a crate item and a setting on this device.
  const id = (await me(page)).user.id;
  await page.evaluate(async () => {
    const post = (path: string, body: unknown, method = "POST") => fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    await post("/api/me", { name: "Delia" }, "PATCH");
    await post("/api/results", { mode: "crowd", placement: 7, players: 100 });
    await post("/api/locker/open", { crate: "beta-001" });
    localStorage.setItem("brc.theme", "dark");
  });
  const cookie = (await page.context().cookies()).find((c) => c.name === "hc_session")!;

  // Download my data: a JSON file of everything kept about the account.
  await page.goto("/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Download my data/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^hunchess-data-\d{4}-\d{2}-\d{2}\.json$/);
  const chunks: Buffer[] = [];
  for await (const c of (await download.createReadStream())!) chunks.push(c as Buffer);
  const file = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(Object.keys(file)).toEqual(expect.arrayContaining(["exportedAt", "about", "account", "sessions", "results", "shop", "locker", "reportsMade", "friends", "fairPlay"]));
  expect(file.account).toMatchObject({ id, name: "Delia" });
  expect(file.results.map((r: { placement: number }) => r.placement)).toEqual([7]);
  expect(file.locker.items).toHaveLength(1);
  expect(file.fairPlay).toEqual({ banned: false, appeals: [] });

  // Delete account asks first; "Keep it" keeps it.
  await page.getByRole("button", { name: /^Delete account/ }).click();
  const confirm = page.getByRole("group", { name: "Delete your account?" });
  await expect(confirm).toContainText("Your match results stay, without your name");
  await confirm.getByRole("button", { name: "Keep it" }).click();
  await expect(confirm).toHaveCount(0);
  expect((await me(page)).user.id).toBe(id);
  expect(d1("SELECT id FROM users WHERE id = ?", id)).toHaveLength(1);

  // Delete my account: back to the start as a new guest, and this device's settings forgotten.
  await page.getByRole("button", { name: /^Delete account/ }).click();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Your profile" })).toBeVisible();
  const fresh = (await me(page)).user;
  expect(fresh.id).not.toBe(id);
  expect(fresh.name).not.toBe("Delia");
  expect(await page.evaluate(() => localStorage.getItem("brc.theme"))).toBeNull();

  // The old session works nowhere: another device with its cookie is a new visitor; the profile is gone.
  const other = await browser.newContext();
  await other.addCookies([cookie]);
  const p2 = await other.newPage();
  await p2.goto("/");
  expect((await me(p2)).user.id).not.toBe(id);
  expect((await page.request.get(`/api/profile/${id}`)).status()).toBe(404);
  await other.close();

  // In the database: nothing names the account; its result stays, as the deleted account's, with no match code.
  for (const [table, column] of [
    ["users", "id"],
    ["sessions", "user_id"],
    ["results", "user_id"],
    ["items", "user_id"],
    ["equipped_items", "user_id"],
    ["wallets", "user_id"],
  ]) {
    expect(d1(`SELECT 1 AS x FROM ${table} WHERE ${column} = ?`, id), `${table}.${column}`).toHaveLength(0);
  }
  expect(d1<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE user_id = 'deleted' AND placement = 7 AND lobby IS NULL")[0]!.n).toBeGreaterThan(0);
});
