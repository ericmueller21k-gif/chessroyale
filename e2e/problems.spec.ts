import { execFileSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * Error capture and the feedback sheet (docs/areas/ops.md, "Errors and player reports"): errors on a device reach the
 * store with their diagnostics, a render error shows "Something went wrong" instead of a blank page, a bug report gets
 * a short id that /admin/ops finds, feedback is listed by kind, and POST /api/problems holds its size and rate caps.
 */

const run = Date.now().toString(36).slice(-6);
const project = () => test.info().project.name;
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/**
 * Makes this page's account an admin: the local Worker's ADMIN_EMAILS (playwright.config.ts) has one email per project,
 * given here straight in the local database (no sign-in is set up in tests). Reloads nothing: the server reads it at once.
 */
async function asAdmin(page: Page) {
  const email = `ops-admin-${project()}@e2e.test`;
  const id = ((await (await page.request.get("/api/me")).json()) as { user: { id: string } }).user.id;
  const sql = `UPDATE users SET email = NULL WHERE email = '${email}'; UPDATE users SET email = '${email}' WHERE id = '${id}'`;
  execFileSync("npx", ["wrangler", "d1", "execute", "hunchess", "--local", "--command", sql], { stdio: "ignore" });
  return id;
}

/** The ops page's text, its diagnostics unescaped. */
async function opsPage(page: Page, query = ""): Promise<string> {
  const res = await page.request.get(`/admin/ops${query}`);
  expect(res.status()).toBe(200);
  return (await res.text()).replaceAll("&quot;", '"').replaceAll("&#39;", "'");
}

/** Boss alone against Ginger, to the first move. */
async function bossAlone(page: Page) {
  await page.goto("/?debug&clock=60&boss=gingerbread");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
}

test("a thrown error and a rejected promise reach the store, with the screen, the version and the device", async ({ page }) => {
  const tag = `${run}-${project()}`;
  await page.goto("/");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/problems") && r.method() === "POST");
  // (One function, so calling it again throws the same errors from the same places.)
  await page.evaluate((t) => {
    (window as any).e2eFail = () => {
      setTimeout(() => {
        throw new Error(`e2e thrown ${t}`);
      });
      void Promise.reject(new Error(`e2e rejected ${t}`));
    };
    (window as any).e2eFail();
  }, tag);
  // (One request, a few seconds later: OPS.client.batchMs.)
  const body = (await sent).postDataJSON() as { kind: string; errors: { kind: string; message: string }[]; version: string };
  expect(body.kind).toBe("errors");
  expect(body.errors.map((e) => [e.kind, e.message]).sort()).toEqual([
    ["error", `Error: e2e thrown ${tag}`],
    ["rejection", `Error: e2e rejected ${tag}`],
  ]);
  await asAdmin(page);
  // (Written within OPS.store.flushMs: the first at once, then every 20 s.)
  await expect.poll(async () => opsPage(page, `?q=${tag}`), { timeout: 40_000 }).toContain(`e2e rejected ${tag}`);
  const html = await opsPage(page, `?q=${tag}`);
  expect(html).toContain(`Error: e2e thrown ${tag}`);
  expect(html).toContain(`"screen": "home"`);
  expect(html).toMatch(/"version": "([0-9a-f]{12}|dev)"/);
  expect(html).toMatch(/"viewport": "\d+x\d+@[\d.]+"/);
  expect(html).toContain(`"ua": "Mozilla`);
  // Each kind once per page load: the same errors again aren't sent again.
  const again: string[] = [];
  page.on("request", (r) => r.url().endsWith("/api/problems") && again.push(r.url()));
  await page.evaluate(() => (window as any).e2eFail());
  await page.waitForTimeout(4_000);
  expect(again).toEqual([]);
});

test("a render error shows Something went wrong with Reload (not a blank page), and is reported", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const tag = `${run}-${project()}`;
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await bossAlone(page);
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/problems") && r.method() === "POST");
  // A match whose standings can't be read: the app's next render throws.
  await page.evaluate((t) => {
    const m = (window as any).match;
    m.standings = () => {
      throw new Error(`e2e render ${t}`);
    };
    m.emit();
  }, tag);
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await expect(page.locator(".hb")).toHaveCount(0);
  const body = (await sent).postDataJSON() as { errors: { kind: string; message: string; where: { screen: string; mode: string; boss: string } }[] };
  expect(body.errors).toEqual(
    expect.arrayContaining([expect.objectContaining({ kind: "render", message: `Error: e2e render ${tag}`, where: expect.objectContaining({ screen: "play", mode: "solo raid", boss: "gingerbread" }) })]),
  );
  // (Still a page error, once: the console and other specs' error checks see it.)
  expect(pageErrors.filter((m) => m === `e2e render ${tag}`)).toHaveLength(1);
  await asAdmin(page);
  await expect.poll(async () => opsPage(page, `?q=${tag}`), { timeout: 40_000 }).toContain(`e2e render ${tag}`);
  // Reload: back in the app.
  await page.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
});

test("the feedback sheet: Report a bug from the match menu gives a short id that /admin/ops finds with its diagnostics; Feedback from Settings is the note alone, listed by kind", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const tag = `${run}-${project()}`;
  await bossAlone(page);
  // A phone: "⋯", then Report a bug in its sheet; a computer: the bug button beside the sound button.
  if (project() === "phone") {
    await page.getByRole("button", { name: "Match options" }).click();
    await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: "Report a bug" }).click();
  } else await page.getByRole("button", { name: "Report a bug" }).click();
  const sheet = page.getByRole("dialog", { name: "We'd love your feedback" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "Report a bug" })).toHaveAttribute("aria-checked", "true");
  // The game goes on under it, and the note stays put while it does.
  await sheet.getByRole("textbox").fill(`e2e note ${tag}: the board froze`);
  await page.waitForTimeout(1_500);
  await expect(sheet.getByRole("textbox")).toHaveValue(`e2e note ${tag}: the board froze`);
  await sheet.getByRole("button", { name: "Send" }).click();
  const shown = sheet.getByRole("status");
  await expect(shown).toHaveText(/^Report [A-HJKMNP-Z2-9]{6} — share this id$/);
  const id = (await shown.textContent())!.match(/Report (\w{6})/)![1]!;
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toHaveCount(0);
  const accountId = await asAdmin(page);
  let html = await opsPage(page, `?report=${id}`);
  expect(html).toContain(`Report ${id}`);
  expect(html).toContain(`e2e note ${tag}: the board froze`);
  expect(html).toMatch(/"screen": "play"/);
  expect(html).toContain(`"mode": "solo raid"`);
  expect(html).toContain(`"boss": "gingerbread"`);
  expect(html).toMatch(/"trail": \[[^\]]*s play"/);
  // A guest's bug report has no account.
  expect(html).toContain(`"account": null`);

  // Settings: Feedback, a note alone (it needs one), then listed with the feedback on /admin/ops.
  await page.goto("/settings");
  await page.getByRole("button", { name: /Feedback/ }).click();
  await expect(sheet.getByRole("radio", { name: "Feedback" })).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByRole("button", { name: "Send" })).toBeDisabled();
  await sheet.getByRole("textbox").fill(`e2e feedback ${tag}: love the bosses`);
  await sheet.getByRole("button", { name: "Send" }).click();
  await expect(sheet.getByRole("status")).toHaveText("Thanks for your feedback!");
  await sheet.getByRole("button", { name: "Done" }).click();
  html = await opsPage(page, "?kind=feedback");
  expect(html).toContain(`e2e feedback ${tag}: love the bosses`);
  expect(await opsPage(page, "?kind=idea")).not.toContain(`e2e feedback ${tag}`);

  // A bug from the same sheet, signed in now (the admin email made this account so; the page reloaded): its account.
  await page.getByRole("button", { name: /Feedback/ }).click();
  await sheet.getByRole("radio", { name: "Report a bug" }).click();
  await sheet.getByRole("button", { name: "Send" }).click();
  await expect(shown).toHaveText(/share this id/);
  const id2 = (await shown.textContent())!.match(/Report (\w{6})/)![1]!;
  html = await opsPage(page, `?report=${id2}`);
  expect(html).toContain(`"screen": "settings"`);
  expect(html).toContain(`"account": "${accountId}"`);
});

test("POST /api/problems: only JSON from this site, 413 past its size cap, 429 past an account's rate, 400 for anything else; /admin/ops is Not found for players", async ({ page }) => {
  await page.request.get("/api/me");
  // A form's post (not JSON) and another site's page's: refused.
  expect((await page.request.post("/api/problems", { headers: { "content-type": "text/plain" }, data: JSON.stringify({ kind: "idea", note: "x" }) })).status()).toBe(415);
  expect((await page.request.post("/api/problems", { headers: { "sec-fetch-site": "cross-site" }, data: { kind: "idea", note: "x" } })).status()).toBe(403);
  const big = await page.request.post("/api/problems", { headers: { "content-type": "application/json" }, data: JSON.stringify({ kind: "bug", note: "x".repeat(30_000) }) });
  expect(big.status()).toBe(413);
  expect((await page.request.post("/api/problems", { data: { kind: "nope" } })).status()).toBe(400);
  const statuses: number[] = [];
  for (let i = 0; i < 11; i++) {
    const r = await page.request.post("/api/problems", { data: { kind: "errors", version: "dev", errors: [{ kind: "error", message: `Error: e2e rate ${run}-${i}`, stack: "" }] } });
    statuses.push(r.status());
    if (r.status() === 429) expect(Number(r.headers()["retry-after"])).toBeGreaterThan(0);
  }
  expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200));
  expect(statuses[10]).toBe(429);
  const ops = await page.request.get("/admin/ops");
  expect(ops.status()).toBe(404);
  expect(await ops.text()).toBe("Not found");
});

test("the health view: JSON for an admin (deployed version, live numbers, errors, budgets, D1), on /admin/ops too; Not found for a player", async ({ page }) => {
  test.skip(project() !== "desktop", "one run is enough");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect((await page.request.get("/api/admin/health")).status()).toBe(404);
  await asAdmin(page);
  const res = await page.request.get("/api/admin/health");
  expect(res.status()).toBe(200);
  const h = (await res.json()) as {
    deploy: { version: string };
    live: { online: number; modes: Record<string, unknown> } | null;
    errors: { day: number };
    engine: { on: boolean; cap: number };
    fairplay: { cap: number };
    d1: { ok: boolean };
  };
  expect(h.deploy.version).toMatch(/^([0-9a-f]{12}|dev)$/);
  expect(h.live?.online).toBeGreaterThanOrEqual(1);
  expect(Object.keys(h.live!.modes).sort()).toEqual(["boss", "classic", "crowd", "squads"]);
  expect(h.engine).toMatchObject({ on: false });
  expect(h.d1.ok).toBe(true);
  expect(await opsPage(page)).toContain("<h2>Health</h2>");
});
