import { expect, type Page } from "@playwright/test";
import { named, test } from "./helpers.ts";

/**
 * The computer's live window at the top of the home's play column (DECISIONS.md, "The live window"): a bot match
 * played back from a recording ("Bot match"), or a real match when one is running ("Live", no "Bot match").
 */
const desktop = () => test.info().project.name === "desktop";
const sideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** No real match in the live line (other tests' matches would otherwise be shown): the window plays a bot match. */
const noRealMatch = (p: Page) =>
  p.route("**/api/live", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    await route.fulfill({ response: res, json: { ...body, featured: null } });
  });

test("computer: a bot match plays in the live window above the buttons, labelled as one; light on the page; none below 1280 px or on a phone", async ({ page }) => {
  await named(page, "Watcher");
  if (!desktop()) {
    // A phone: no window, and the replays aren't even fetched.
    let fetched = false;
    page.on("request", (r) => r.url().includes("/replays/") && (fetched = true));
    await page.goto("/");
    await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.locator(".fd-livewin")).toHaveCount(0);
    expect(fetched).toBe(false);
    return;
  }
  test.setTimeout(2 * 60_000);
  await noRealMatch(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(page.locator(".fd-livewin")).toHaveCount(0);
  for (const [w, h] of [
    [1280, 800],
    [1440, 900],
    [1280, 680],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    const win = page.getByRole("region", { name: "Bot match, a recording" });
    await expect(win).toBeVisible();
    await expect(win.locator(".fd-livewin-tag")).toHaveText(/Bot match/i);
    await expect(win.locator(".fd-livewin-mode")).toHaveText("Crowd · 50 v 50");
    await expect(win.locator(".fd-livewin-line")).toHaveText(/crowd: |Final · .+ plays |wins · 1st |A draw|A new match is starting/);
    // A square board, as big as the room allows, inside the window; the window above Play with friends and Boss alone,
    // level with the top of your card; PLAY still at the bottom.
    const box = (await win.boundingBox())!;
    const board = (await win.locator(".board-wrap").boundingBox())!;
    expect(Math.abs(board.width - board.height), `${w}x${h}`).toBeLessThan(2);
    expect(board.width, `${w}x${h}`).toBeGreaterThan(h >= 800 ? 240 : 150);
    expect(board.x).toBeGreaterThanOrEqual(box.x);
    expect(board.x + board.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
    const card = (await page.locator(".fd-hero").boundingBox())!;
    expect(Math.abs(box.y - card.y)).toBeLessThan(2);
    const friends = (await page.getByRole("main").getByRole("button", { name: "Play with friends" }).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(friends.y);
    const hint = (await page.locator(".fd-hint").boundingBox())!;
    expect(Math.abs(hint.y + hint.height - (card.y + card.height)), `${w}x${h}: PLAY at the bottom`).toBeLessThan(12);
    // Its words fit on their lines (cut short with "…" at worst, never spilling out).
    for (const sel of [".fd-livewin-head", ".fd-livewin-line"]) {
      const over = await win.locator(sel).evaluate((el) => el.getBoundingClientRect().right - el.parentElement!.getBoundingClientRect().right);
      expect(over, sel).toBeLessThanOrEqual(0.5);
    }
    expect(await sideways(page)).toBe(0);
  }
  // Light on the page: a move changes about every 6-9 s; over two changes nothing piles up (nodes, animations, timers).
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const win = page.getByRole("region", { name: "Bot match, a recording" });
  await expect(win).toBeVisible();
  const look = () =>
    page.evaluate(() => ({
      nodes: document.getElementsByTagName("*").length,
      animations: document.getAnimations().length,
      fen: (document.querySelector(".fd-livewin cg-board")?.innerHTML.length ?? 0) > 0,
    }));
  const first = await look();
  const line0 = await win.locator(".fd-livewin-line").textContent();
  const meta0 = await win.locator(".fd-livewin-meta").textContent();
  await expect.poll(async () => `${await win.locator(".fd-livewin-meta").textContent()} ${await win.locator(".fd-livewin-line").textContent()}`, { timeout: 25_000 }).not.toBe(`${meta0} ${line0}`);
  const line1 = await win.locator(".fd-livewin-line").textContent();
  const meta1 = await win.locator(".fd-livewin-meta").textContent();
  await expect.poll(async () => `${await win.locator(".fd-livewin-meta").textContent()} ${await win.locator(".fd-livewin-line").textContent()}`, { timeout: 25_000 }).not.toBe(`${meta1} ${line1}`);
  await page.waitForTimeout(1000);
  const later = await look();
  expect(later.fen).toBe(true);
  expect(later.nodes - first.nodes).toBeLessThan(40);
  expect(later.animations).toBeLessThanOrEqual(first.animations + 2);
});

test("computer: a real match running shows in the live window as Live (no Bot match label), with the crowd's votes; back to a bot match after", async ({ page, browser }) => {
  test.skip(!desktop(), "the computer's home");
  test.setTimeout(3 * 60_000);
  // Someone plays: PLAY (Crowd), the bots fill after 8 s.
  const player = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await named(player, "Real Rita");
  await player.goto(`/?pool=livewin-${Date.now().toString(36)}`);
  await player.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(player.locator(".fd-seats")).toBeVisible();
  await named(page, "Watcher");
  // (The switch back is the window's: a route takes the real match off the live line on cue.)
  let hide = false;
  await page.route("**/api/live", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    await route.fulfill({ response: res, json: hide ? { ...body, featured: null } : body });
  });
  await page.goto("/");
  const real = page.getByRole("region", { name: "Live match" });
  await expect(real).toBeVisible({ timeout: 60_000 });
  await expect(real.locator(".fd-livewin-tag")).toHaveText(/Live/);
  await expect(page.getByText("Bot match", { exact: false })).toHaveCount(0);
  // The first move: the crowd's votes on it.
  await expect(real.locator(".fd-livewin-line")).toHaveText(/^(White|Black)'s crowd: \S+ \d+/, { timeout: 90_000 });
  await expect(real.locator(".fd-livewin-meta")).toHaveText(/^Move \d+ · \d+ left$/);
  await expect(real.locator(".board-wrap piece").first()).toBeVisible();
  hide = true;
  await expect(page.getByRole("region", { name: "Bot match, a recording" })).toBeVisible({ timeout: 15_000 });
  await player.close();
});
