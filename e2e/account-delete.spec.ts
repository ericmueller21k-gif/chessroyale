import { expect, type Page } from "@playwright/test";
import { giveCrates, localSql, test } from "./helpers.ts";

/**
 * Settings → Download my data and Delete account (docs/decisions/2026-10-15-delete-my-account-and-download-my-data.md):
 * the file holds the account's data; deleting asks first, then the account is gone (its profile, its session on every
 * device, this device's settings), its results stay without it, and the local database has nothing of it left.
 */

/** Runs a query on the local D1, through the server's own (helpers' localSql: no second process on its file). */
const d1 = <T = Record<string, unknown>>(page: Page, query: string, ...params: string[]) => localSql<T>(page, query, ...params);

const me = (page: import("@playwright/test").Page) => page.evaluate(() => fetch("/api/me").then((r) => r.json()) as Promise<{ user: { id: string; name: string } }>);

test("Settings: download my data, then delete the account (asked first); it's gone everywhere, its results stay without it", async ({ page, browser }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/");
  // (Your profile: the top bar's pawn on a phone, the side menu's Profile on a computer: the right column's pawn went, Nov 7.)
  await expect(page.getByRole("button", { name: "Your profile", exact: true }).or(page.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Profile" })).filter({ visible: true }).first()).toBeVisible();
  // A guest with a name, a solo result, a crate item and a setting on this device.
  const id = (await me(page)).user.id;
  // (Crates need a key since Nov 9: one crate and one key to open.)
  await giveCrates(page, "beta-001", 1);
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
  expect(Object.keys(file)).toEqual(expect.arrayContaining(["exportedAt", "about", "account", "sessions", "results", "shop", "locker", "reports", "friends", "problemReports", "fairPlay"]));
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
  expect(await d1(page, "SELECT id FROM users WHERE id = ?", id)).toHaveLength(1);

  // Delete my account: back to the start as a new guest, and this device's settings forgotten.
  await page.getByRole("button", { name: /^Delete account/ }).click();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Your profile", exact: true }).or(page.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Profile" })).filter({ visible: true }).first()).toBeVisible();
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
    expect(await d1(page, `SELECT 1 AS x FROM ${table} WHERE ${column} = ?`, id), `${table}.${column}`).toHaveLength(0);
  }
  expect((await d1<{ n: number }>(page, "SELECT COUNT(*) AS n FROM results WHERE user_id = 'deleted' AND placement = 7 AND lobby IS NULL"))[0]!.n).toBeGreaterThan(0);
});
