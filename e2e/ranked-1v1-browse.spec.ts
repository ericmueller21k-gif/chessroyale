import { expect, type Browser, type Page } from "@playwright/test";
import { RANKED_1V1 } from "@chessroyale/core";
import { named, test, watchSpans } from "./helpers.ts";

/**
 * Browsing while queued for 1 v 1 (docs/areas/ranked.md, "Browsing while queued"; Eric, Oct 16): Home from the search
 * stage keeps the search going, with a bar on every screen ("Searching 1 v 1 · 0:42 ›", Cancel); the bar goes back to
 * the stage; an opponent found while you browse buzzes and goes straight to the stage; another mode asks "Leave the
 * 1 v 1 queue?" first; a reload carries on with the search. Each test queues in a pool of its own (`?pool=`).
 */

const isComputer = () => test.info().project.name === "desktop";
const poolName = () => `b${test.info().project.name.slice(0, 1)}${Math.random().toString(36).slice(2, 9)}`;

async function player(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await named(page, name);
  await page.goto("/?nolanding");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  return page;
}

/** The queue's asks this page has made so far (POST /api/1v1/play), and its cancels. */
function asks(page: Page) {
  const seen = { play: 0, cancel: 0 };
  page.on("request", (r) => {
    if (r.url().includes("/api/1v1/play")) seen.play++;
    if (r.url().includes("/api/1v1/cancel")) seen.cancel++;
  });
  return seen;
}

/** Seconds in a "0:42" (the first one in the text). */
const seconds = (text: string | null) => {
  const m = /(\d+):(\d\d)/.exec(text ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/** Home from the search stage. */
const goHome = (page: Page) => page.locator(".dv-search").getByRole("button", { name: /^Home/ }).click();

/** The shop: the phone's home button, or the computer's side menu. */
async function openShop(page: Page) {
  if (isComputer()) await page.locator(".fd-side").getByRole("button", { name: "Shop & crates" }).click();
  else await page.getByRole("main").getByRole("button", { name: "Shop & crates" }).click();
  await expect(page.getByRole("heading", { name: "Shop", exact: true })).toBeVisible();
}

/** Nothing of the page under the bar: the page's own top is at or below the bar's foot. */
async function underBar(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  return page.evaluate(() => {
    const bar = document.querySelector(".dq-bar")!.getBoundingClientRect();
    const first = document.querySelector("#app > :not(.dq-bar):not(.maint-banner)")!.getBoundingClientRect();
    return first.top - bar.bottom;
  });
}

test("Home from the search keeps you queued: the bar on home and in the shop, back to the stage from it, Cancel from it", async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const a = await player(browser, "Ann Browse");
  const seen = asks(a);
  await a.goto(`/1v1?nolanding&pool=${poolName()}`);
  await expect(a.locator(".dv-search")).toContainText("Finding opponent…");
  // Home: home's screen, the search's bar at the top, nothing under it; no confirm.
  await goHome(a);
  const bar = a.locator(".dq-bar");
  await expect(bar).toBeVisible();
  await expect(bar.locator(".dq-go")).toHaveText(/^Searching 1 v 1· \d:\d\d›$/);
  await expect(bar.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(a.locator(".dv-stage")).toHaveCount(0);
  await expect(a.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(new URL(a.url()).pathname).toBe("/");
  expect(await underBar(a)).toBeGreaterThanOrEqual(-0.5);
  // Still in the queue: it keeps asking, and the wait keeps counting.
  const before = seen.play;
  await expect.poll(() => seen.play, { timeout: 15_000 }).toBeGreaterThan(before);
  // The shop: the bar there too, over nothing.
  await openShop(a);
  await expect(bar).toBeVisible();
  expect(await underBar(a)).toBeGreaterThanOrEqual(-0.5);
  await a.waitForTimeout(1_200);
  // The bar's words: back to the stage, the same search (its wait not started again).
  const waited = seconds(await bar.locator(".dq-time").textContent());
  await bar.locator(".dq-go").click();
  await expect(a.locator(".dv-search")).toContainText("Finding opponent…");
  await expect(bar).toHaveCount(0);
  expect(new URL(a.url()).pathname).toBe("/1v1");
  expect(seconds(await a.locator(".dv-search .dv-wait").textContent())).toBeGreaterThanOrEqual(waited);
  // Home again, then the bar's Cancel: out of the queue (the server told), the page stays, no more asks.
  await goHome(a);
  await bar.getByRole("button", { name: "Cancel" }).click();
  await expect(bar).toHaveCount(0);
  await expect(a.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect.poll(() => seen.cancel).toBe(1);
  const after = seen.play;
  await a.waitForTimeout(4_000);
  expect(seen.play).toBe(after);
});

test("an opponent found while you browse: a sound and a buzz, straight to the stage, the versus moment, then the board", async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const a = await player(browser, "Ann Away");
  const b = await player(browser, "Bo Away");
  const pool = poolName();
  await a.addInitScript(() => {
    (window as unknown as { __soundLog: string[] }).__soundLog = [];
    (window as unknown as { __buzz: unknown[] }).__buzz = [];
    navigator.vibrate = (p: VibratePattern) => ((window as unknown as { __buzz: unknown[] }).__buzz.push(p), true);
  });
  await a.goto(`/1v1?nolanding&pool=${pool}`);
  await expect(a.locator(".dv-search")).toBeVisible();
  await goHome(a);
  await openShop(a);
  const spans = await watchSpans(a, { versus: { selector: ".dv-versus .dv-st-them .dv-st-name", text: /^Bo Away$/ }, board: { selector: ".dv-vote" } });
  await b.goto(`/1v1?nolanding&pool=${pool}`);
  // Straight from the shop to the stage: Bo's pawn, name and rank arrive on it; the bar has gone.
  await expect(a.locator(".dv-versus .dv-st-them .dv-st-name")).toHaveText("Bo Away", { timeout: 20_000 });
  await expect(a.locator(".dq-bar")).toHaveCount(0);
  await expect(a.getByRole("heading", { name: "Shop", exact: true })).toHaveCount(0);
  const log = await a.evaluate(() => (window as unknown as { __soundLog: string[] }).__soundLog);
  expect(log.filter((s) => s.startsWith("bannerStart"))).toHaveLength(1);
  expect(await a.evaluate(() => (window as unknown as { __buzz: unknown[] }).__buzz)).toEqual([[90, 60, 160]]);
  // The found moment plays whole, then the board.
  await expect(a.locator(".dv-vote")).toBeVisible({ timeout: 10_000 });
  const s = await spans.spans();
  expect(s.versus!.last - s.versus!.first).toBeGreaterThan(RANKED_1V1.versusMs - 1000);
  expect(s.board!.first).toBeGreaterThan(s.versus!.last);
  // Bo, on the stage all along, heard nothing new.
  await expect(b.locator(".dv-vote")).toBeVisible({ timeout: 10_000 });
});

test("another mode while queued asks first (Stay keeps the search; Leave queue ends it and starts that mode); 1 v 1's PLAY goes back to the stage", async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const a = await player(browser, "Ann Modes");
  const seen = asks(a);
  await a.goto(`/1v1?nolanding&pool=${poolName()}`);
  await expect(a.locator(".dv-search")).toBeVisible();
  await goHome(a);
  const bar = a.locator(".dq-bar");
  const ranked = a.getByRole("radiogroup", { name: "RANKED" });
  const play = a.getByRole("button", { name: "PLAY", exact: true });
  // 1 v 1's PLAY while searching: the stage again, the same search, no confirm.
  await ranked.getByRole("radio", { name: /^1 v 1/ }).click();
  await play.click();
  await expect(a.locator(".dv-search")).toBeVisible();
  await expect(a.getByRole("alertdialog")).toHaveCount(0);
  await goHome(a);
  // 50 v 50's PLAY: "Leave the 1 v 1 queue?"; Stay: still searching.
  await ranked.getByRole("radio", { name: /^50 v 50/ }).click();
  await play.click();
  const ask = a.getByRole("alertdialog", { name: "Leave the 1 v 1 queue?" });
  await expect(ask).toContainText("Starting this ends your 1 v 1 search.");
  await expect(ask.getByRole("button")).toHaveText(["Stay", "Leave queue"]);
  await ask.getByRole("button", { name: "Stay" }).click();
  await expect(ask).toHaveCount(0);
  await expect(bar).toBeVisible();
  expect(seen.cancel).toBe(0);
  // Again, Leave queue: the search ends (the server told) and 50 v 50's queue starts.
  await play.click();
  await ask.getByRole("button", { name: "Leave queue" }).click();
  await expect(bar).toHaveCount(0);
  await expect.poll(() => seen.cancel).toBe(1);
  await expect(a.getByRole("button", { name: "Cancel" })).toBeVisible({ timeout: 15_000 });
  await expect(a.locator(".dv-stage")).toHaveCount(0);
  await a.getByRole("button", { name: "Cancel" }).click();
  await expect(play).toBeVisible();
});

test("a reload while queued carries on with the search: on the stage from /1v1, with the bar from home; found after it, and no buzz with sound off", async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const a = await player(browser, "Ann Reload");
  const b = await player(browser, "Bo Reload");
  const pool = poolName();
  await a.addInitScript(() => {
    localStorage.setItem("brc.muted", "1");
    (window as unknown as { __buzz: unknown[] }).__buzz = [];
    navigator.vibrate = (p: VibratePattern) => ((window as unknown as { __buzz: unknown[] }).__buzz.push(p), true);
  });
  await a.goto(`/1v1?nolanding&pool=${pool}`);
  await expect(a.locator(".dv-search")).toBeVisible();
  await a.waitForTimeout(2_500);
  // On the stage: the stage again, the wait going on from where it was.
  await a.reload();
  await expect(a.locator(".dv-search")).toBeVisible();
  expect(seconds(await a.locator(".dv-search .dv-wait").textContent())).toBeGreaterThanOrEqual(2);
  // From home: home again, with the bar (no ghost: it's the same search, still asking).
  await goHome(a);
  await a.reload();
  const bar = a.locator(".dq-bar");
  await expect(bar).toBeVisible();
  await expect(a.locator(".dv-stage")).toHaveCount(0);
  expect(seconds(await bar.locator(".dq-time").textContent())).toBeGreaterThanOrEqual(2);
  // And it finds: Bo queues, Ann goes to the stage (sound off: no buzz).
  await b.goto(`/1v1?nolanding&pool=${pool}`);
  await expect(a.locator(".dv-versus .dv-st-them .dv-st-name")).toHaveText("Bo Reload", { timeout: 20_000 });
  expect(await a.evaluate(() => (window as unknown as { __buzz: unknown[] }).__buzz)).toEqual([]);
  // Done with that game: a reload after it shows no bar (nothing saved once found).
  await expect(a.locator(".dv-vote")).toBeVisible({ timeout: 10_000 });
  await a.goto("/?nolanding");
  await expect(a.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await a.waitForTimeout(1_000);
  await expect(bar).toHaveCount(0);
});

test("the bar fits (320, 360, 390 px; 1280 on a computer), and at Few players online it says so and takes you to the choices", async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const a = await player(browser, "Ann Fits");
  await a.goto(`/1v1?nolanding&pool=${poolName()}&fewAfter=1`);
  await expect(a.locator(".dv-search")).toBeVisible();
  await goHome(a);
  const bar = a.locator(".dq-bar");
  await expect(bar).toHaveClass(/\bfew\b/, { timeout: 10_000 });
  await expect(bar.locator(".dq-text")).toHaveText("Few players online");
  const sizes = isComputer() ? [{ width: 1280, height: 800 }] : [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 664 }];
  for (const size of sizes) {
    await a.setViewportSize(size);
    await expect
      .poll(() =>
        a.evaluate(() => {
          const bad: string[] = [];
          const vw = document.documentElement.clientWidth;
          const bar = document.querySelector(".dq-bar")!.getBoundingClientRect();
          if (bar.height > 56) bad.push(`bar ${bar.height} tall`);
          for (const e of document.querySelectorAll<HTMLElement>(".dq-bar > *, .dq-text, .dq-time")) {
            const r = e.getBoundingClientRect();
            if (r.left < 0 || r.right > vw + 0.5) bad.push(`${e.className} sideways`);
            if (e.scrollWidth > e.clientWidth + 1) bad.push(`${e.className} cut`);
          }
          if (document.documentElement.scrollWidth > vw) bad.push("page scrolls sideways");
          return bad;
        }),
      { message: `${size.width} px` })
      .toEqual([]);
  }
  // The bar's words: the stage, with Keep waiting and Play a bot; Keep waiting holds after Home again.
  await bar.locator(".dq-go").click();
  await expect(a.locator(".dv-few")).toContainText("Few players online right now");
  await a.locator(".dv-few").getByRole("button", { name: "Keep waiting" }).click();
  await goHome(a);
  await expect(bar).not.toHaveClass(/\bfew\b/);
  await expect(bar.locator(".dq-text")).toHaveText("Searching 1 v 1");
  await bar.getByRole("button", { name: "Cancel" }).click();
});
