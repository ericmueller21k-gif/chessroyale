import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { test } from "./helpers.ts";

/**
 * The Maia prototype (DECISIONS.md, "A human-like boss: Maia-3 for Ginger"): an admin picks the boss's brain in Boss
 * alone's boss menu, meets Ginger on a phone, and Maia's moves come through (the Maia box's worker, spoken to in text,
 * vetoed by the full guard where it must be); its debug line says so. Players never load Maia.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** Your profile says you're an admin (as /api/me does for an email in ADMIN_EMAILS). */
async function asAdmin(page: Page) {
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
  });
}

/** Waits for your move and plays a legal one (one a power allows). */
async function play(page: Page) {
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  const { fen, allowed } = await page.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board.fen as string, allowed: (m.boss?.powers?.allowed ?? null) as string[] | null };
  });
  const legal = new Chess(fen)
    .moves({ verbose: true })
    .map((mv) => mv.from + mv.to + (mv.promotion ?? ""))
    .filter((mv) => !allowed || allowed.includes(mv));
  // (A quiet, safe-ish move: the God King's Last Stand isn't what's tested here.)
  const move = legal.find((m) => /^[a-h]2[a-h][34]$/.test(m)) ?? legal[0]!;
  await page.evaluate((mv) => (window as any).match.submit(mv), move);
  await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
}

test("an admin's Brain picker: Ginger on Maia with the full guard, on a phone; Maia's moves come through", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  test.setTimeout(4 * 60_000);
  await asAdmin(page);
  const maiaFiles: string[] = [];
  page.on("request", (r) => r.url().includes("/engine/maia/") && maiaFiles.push(new URL(r.url()).pathname));
  await page.goto("/?debug&clock=40&bossMoves=6&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  const menu = page.getByRole("dialog", { name: "Choose your boss" });
  const brain = menu.getByRole("combobox", { name: "Boss brain (testing)" });
  await expect(brain).toBeVisible();
  // (Each boss's own is the default: Ginger's is Maia, no guard.)
  await expect(brain).toHaveValue("");
  await brain.selectOption("maia-full");
  // The menu fetches Maia's files ahead (into the service worker's cache).
  await expect.poll(() => maiaFiles.some((f) => f.endsWith(".onnx")), { timeout: 10_000 }).toBe(true);
  await menu.getByRole("button", { name: /Ginger/ }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("gingerbread");
  const debug = page.locator(".brain-debug");
  await expect(debug).toContainText(/Maia \d+ · full guard/, { timeout: 30_000 });
  // (The model loads during the intro; it's ready before long.)
  await expect.poll(() => page.evaluate(() => (window as any).match.brainLine as string), { timeout: 60_000 }).toMatch(/· ready$|Maia's/);
  const lines: string[] = [];
  for (let i = 0; i < 4 && (await phase(page)) !== "results"; i++) {
    await play(page);
    await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/^(play|results)$/);
    lines.push(await debug.innerText());
  }
  // Maia played the boss's moves (its own, or its next likely move where the guard turned one down), quickly.
  const maia = lines.filter((l) => /Maia \d+ · full guard · (guard → )?Maia's #\d+ · \d+ ms/.test(l));
  expect(maia.length, lines.join("\n")).toBeGreaterThanOrEqual(2);
  for (const l of maia) expect(Number(l.match(/(\d+) ms/)![1])).toBeLessThan(1500);
  // The line fits the phone's width.
  const box = await debug.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("players meet Stockfish: no Brain picker, no Maia download, no debug line", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  test.setTimeout(3 * 60_000);
  const maiaFiles: string[] = [];
  page.on("request", (r) => r.url().includes("/engine/maia/") && maiaFiles.push(r.url()));
  await page.goto("/?debug&clock=40&bossMoves=6&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  const menu = page.getByRole("dialog", { name: "Choose your boss" });
  await expect(menu.getByRole("button", { name: /Ginger/ })).toBeVisible();
  await expect(menu.getByRole("combobox", { name: "Boss brain (testing)" })).toHaveCount(0);
  await menu.getByRole("button", { name: /Ginger/ }).click();
  await play(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/^(play|results)$/);
  await expect(page.locator(".brain-debug")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).match.brainLine)).toBeNull();
  expect(maiaFiles).toEqual([]);
});

test("the credits name Maia-3 and Stockfish, with the Maia box's licence beside it", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  await page.goto("/settings");
  const credit = page.locator(".maia-credit");
  await expect(credit).toContainText("Maia-3");
  await expect(credit).toContainText("Stockfish");
  await expect(credit.getByRole("link", { name: "Maia-3" })).toHaveAttribute("href", "https://github.com/CSSLab/maia3");
  const licence = await page.request.get("/engine/maia/LICENSE.txt");
  expect(licence.ok()).toBe(true);
  expect(await licence.text()).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");
});
