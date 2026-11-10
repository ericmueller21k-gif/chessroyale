import { expect, type Page } from "@playwright/test";
import { FRONT_DOOR, SQUADS } from "@chessroyale/core";
import { named, pickMode, test } from "./helpers.ts";

/**
 * Searching while you browse (Eric, Nov 10; docs/decisions/2026-11-10-search-on-home.md; the approved mockup v2): a lobby's
 * Exit with "Keep me in the queue" goes home still queued; home's own mode rows show the search (in their own boxes: nothing
 * moves) and its three actions, Cancel, Lobby and Start with bots, the confirms asked in place; the rest greys; other pages
 * show the slim bar; the lobby filling while you browse takes you in, with the found alert. 1 v 1's side of it:
 * ranked-1v1-browse.spec.ts. Each test queues in a pool of its own (`?pool=`).
 */

const isComputer = () => test.info().project.name === "desktop";
const poolName = () => `s${test.info().project.name.slice(0, 1)}${Math.random().toString(36).slice(2, 9)}`;
const play = (page: Page) => page.getByRole("button", { name: "PLAY", exact: true });
const acts = (page: Page) => page.locator(".fd-search-acts");
const ACTIONS = ["Cancelstop searching", "Lobbysee who's in", "Start with botsplay now"];

/** Seconds in a "0:42" (the first one in the text). */
const seconds = (text: string | null) => {
  const m = /(\d+):(\d\d)/.exec(text ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
const lobbyCode = (page: Page) => /^\/lobby\/([A-Z2-9]{5})$/.exec(new URL(page.url()).pathname)?.[1] ?? null;

/** Home's boxes that must not move or resize when the search shows (Eric's rule: nothing moves). */
const boxes = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [".fd-ranked .fd-modes", ".fd-mode-panel", ".fd-play", ".fd-town", ".rd-pair", ".fd-hero"].map((s) => {
        const r = document.querySelector(s)!.getBoundingClientRect();
        return [s, [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 2) / 2)];
      }),
    ),
  );

/** The shop: the phone's top bar, or the computer's side menu. */
async function openShop(page: Page) {
  if (isComputer()) await page.locator(".fd-side").getByRole("button", { name: "Shop & crates" }).click();
  else await page.locator(".fd-top").getByRole("button", { name: "Shop & crates" }).click();
  await expect(page.getByRole("tab", { name: "Shop", exact: true })).toHaveAttribute("aria-selected", "true");
}

/** 50 v 50's PLAY, people only (Bots off, a test's stored pick: it waits as long as the test needs), into its lobby. */
async function crowdLobby(page: Page, name: string, botsOff = true) {
  await named(page, name);
  if (botsOff) await page.addInitScript(() => localStorage.setItem("brc.matchmaking", "botsoff"));
  await page.goto(`/?nolanding&debug&pool=${poolName()}`);
  await pickMode(page, "50 v 50");
}

/** The found alert's sound and buzz, logged from the page's start. */
async function logAlerts(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __soundLog: string[] }).__soundLog = [];
    (window as unknown as { __buzz: unknown[] }).__buzz = [];
    navigator.vibrate = (p: VibratePattern) => ((window as unknown as { __buzz: unknown[] }).__buzz.push(p), true);
  });
}

test("50 v 50: Exit keeps you queued; home's rows show the search in their own boxes (nothing moves), the rest greyed; the bar on other pages; Cancel asks in place (No, or a few seconds, puts it back; Yes leaves)", async ({ page }) => {
  test.setTimeout(2 * 60_000);
  await crowdLobby(page, "Ann Rows");
  const before = await boxes(page);
  await play(page).click();
  // The lobby: "Keep me in the queue" (checked) and Exit, where Cancel was.
  const keep = page.getByRole("checkbox", { name: "Keep me in the queue" });
  await expect(keep).toBeChecked();
  await expect.poll(() => lobbyCode(page)).toBeTruthy();
  const code = lobbyCode(page);
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  // Home, still queued: the modes row is the search, the options row its three actions, in the same boxes.
  const row = page.locator(".fd-search");
  await expect(row.locator(".fd-search-title")).toHaveText("Searching · 50 v 50");
  await expect(row.locator(".fd-search-detail")).toHaveText("Solo queue · 1 of 100 in the lobby");
  await expect(acts(page).getByRole("button")).toHaveText(ACTIONS);
  expect(new URL(page.url()).pathname).toBe("/");
  expect(await boxes(page)).toEqual(before);
  const t0 = seconds(await row.locator(".fd-search-time").textContent());
  await expect.poll(async () => seconds(await row.locator(".fd-search-time").textContent())).toBeGreaterThan(t0);
  // Greyed in place and not tappable: the RANKED label, the line and PLAY, Chess Town, Other modes and its cards. Lit: the top, your card.
  await expect(play(page)).toBeDisabled();
  expect(await page.evaluate(() => [".fd-go", ".fd-town", ".rd-pair"].map((s) => document.querySelector<HTMLElement>(s)!.inert))).toEqual([true, true, true]);
  for (const s of [".fd-ranked > .fd-label", ".fd-go", ".fd-town", ".fd-other-label", ".rd-pair"]) await expect(page.locator(s)).toHaveClass(/\bfd-off\b/);
  await expect(page.locator(".fd-hero")).not.toHaveClass(/\bfd-off\b/);
  expect(await page.locator(".fd-hero").evaluate((e) => (e as HTMLElement).inert || !!e.closest("[inert]"))).toBe(false);
  // No bar on home (the rows say it).
  await expect(page.locator(".dq-bar")).toHaveCount(0);

  // Cancel asks in the same three slots: the question (not a button), Yes, No. No puts the actions back.
  await acts(page).getByRole("button", { name: /^Cancel/ }).click();
  await expect(acts(page).locator(".fd-search-ask")).toHaveText("Stop search?are you sure");
  await expect(acts(page).getByRole("button")).toHaveText(["Yesstop", "Nokeep searching"]);
  expect(await boxes(page)).toEqual(before);
  await acts(page).getByRole("button", { name: /^No/ }).click();
  await expect(acts(page).getByRole("button")).toHaveText(ACTIONS);
  // Asked and left: back by itself after FRONT_DOOR.searchAskMs.
  await acts(page).getByRole("button", { name: /^Cancel/ }).click();
  const asked = Date.now();
  await expect(acts(page).locator(".fd-search-ask")).toBeVisible();
  await expect(acts(page).getByRole("button")).toHaveText(ACTIONS, { timeout: FRONT_DOOR.searchAskMs + 3000 });
  expect(Date.now() - asked).toBeGreaterThan(FRONT_DOOR.searchAskMs - 1000);

  // Another page: the bar, "Searching 50 v 50 · 0:07 ›"; its words go back to the same lobby.
  await openShop(page);
  const bar = page.locator(".dq-bar");
  await expect(bar.locator(".dq-go")).toHaveText(/^Searching 50 v 50· \d+:\d\d›$/);
  await bar.locator(".dq-go").click();
  await expect(page.locator(".fd-exit-row")).toBeVisible();
  expect(lobbyCode(page)).toBe(code);
  await expect(bar).toHaveCount(0);
  // Exit again, then Cancel and Yes: out of the queue, home as it was (the seat forgotten here).
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await acts(page).getByRole("button", { name: /^Cancel/ }).click();
  await acts(page).getByRole("button", { name: /^Yes/ }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "RANKED" })).toBeVisible();
  await expect(play(page)).toBeEnabled();
  expect(await page.evaluate(() => [localStorage.getItem("brc.current"), sessionStorage.getItem("hunchess.awaySearch")])).toEqual([null, null]);
  expect(await boxes(page)).toEqual(before);
});

test("50 v 50: Lobby goes back to the same lobby; Start with bots asks (Play bots? ends your search) and Yes plays you and 99 bots at once", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(2 * 60_000);
  await crowdLobby(page, "Ann Lobby");
  await play(page).click();
  await expect.poll(() => lobbyCode(page)).toBeTruthy();
  const code = lobbyCode(page);
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await acts(page).getByRole("button", { name: /^Lobby/ }).click();
  await expect(page.locator(".fd-exit-row")).toBeVisible();
  expect(lobbyCode(page)).toBe(code);
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  // Start with bots: "Play bots?" in place; a double tap lands on No (where Start with bots was), never on Yes.
  await acts(page).getByRole("button", { name: /^Start with bots/ }).dblclick();
  await expect(acts(page).getByRole("button")).toHaveText(ACTIONS);
  await acts(page).getByRole("button", { name: /^Start with bots/ }).click();
  await expect(acts(page).locator(".fd-search-ask")).toHaveText("Play bots?ends your search");
  await expect(acts(page).getByRole("button")).toHaveText(["Yesplay now", "Nokeep searching"]);
  await acts(page).getByRole("button", { name: /^Yes/ }).click();
  // You and bots, in your browser: the queue screen fills with your bots, then the match.
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { match?: { isSolo?: boolean } }).match?.isSolo), { timeout: 20_000 }).toBe(true);
  await expect(page.locator(".fd-search")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("hunchess.awaySearch"))).toBeNull();
});

test("50 v 50: the lobby fills while you browse the shop: a sound and a buzz, straight back to its lobby, and the match begins", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(2 * 60_000);
  await logAlerts(page);
  // (Default: bots fill the lobby MATCH_FILL_SECONDS, 8 s here, after it opened.)
  await crowdLobby(page, "Ann Found", false);
  await play(page).click();
  await expect.poll(() => lobbyCode(page)).toBeTruthy();
  const code = lobbyCode(page);
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await expect(page.locator(".fd-search")).toBeVisible();
  await openShop(page);
  // Found: the shop closes, the lobby (filled) is on screen again, the bar gone; one sound, one buzz.
  await expect(page.locator(".fd-queue")).toBeVisible({ timeout: 20_000 });
  expect(lobbyCode(page)).toBe(code);
  await expect(page.getByRole("tab", { name: "Shop", exact: true })).toHaveCount(0);
  await expect(page.locator(".dq-bar")).toHaveCount(0);
  const log = await page.evaluate(() => (window as unknown as { __soundLog: string[] }).__soundLog);
  expect(log.filter((s) => s.startsWith("bannerStart"))).toHaveLength(1);
  expect(await page.evaluate(() => (window as unknown as { __buzz: unknown[] }).__buzz)).toEqual([[90, 60, 160]]);
  await expect.poll(() => page.evaluate(() => (window as unknown as { match?: { phase: { kind: string } } }).match?.phase.kind), { timeout: 20_000 }).not.toBe("lobby");
});

test("Squads: Exit keeps you queued (Searching · Squads, its count; Start with bots greyed: Soon); the lobby fills while you're home: taken in, with the alert", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(2 * 60_000);
  await logAlerts(page);
  await named(page, "Ann Squads");
  await page.goto(`/?nolanding&debug&pool=${poolName()}`);
  await pickMode(page, "Squads");
  await play(page).click();
  // (Bots fill a Squads lobby MATCH_FILL_SECONDS, 8 s here, after it opened: quick checks.)
  await expect(page.locator(".sq-queue .fd-exit-row")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("checkbox", { name: "Keep me in the queue" })).toBeChecked();
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  const row = page.locator(".fd-search");
  await expect(row.locator(".fd-search-title")).toHaveText("Searching · Squads");
  await expect(row.locator(".fd-search-detail")).toHaveText(`Solo queue · 1 of ${SQUADS.squadCount * SQUADS.squadSize} in the lobby`);
  await expect(acts(page).getByRole("button")).toHaveText(["Cancelstop searching", "Lobbysee who's in", "Start with botsSoon"]);
  await expect(acts(page).getByRole("button", { name: /^Start with bots/ })).toHaveAttribute("aria-disabled", "true");
  // Found: the lobby's formed squads on screen again, the rows gone; one sound.
  await expect(page.locator(".sq-queue")).toBeVisible({ timeout: 20_000 });
  await expect(row).toHaveCount(0);
  expect(new URL(page.url()).pathname).toMatch(/^\/squads\/[A-Z2-9]{5}$/);
  const log = await page.evaluate(() => (window as unknown as { __soundLog: string[] }).__soundLog);
  expect(log.filter((s) => s.startsWith("bannerStart"))).toHaveLength(1);
});

test("Keep me in the queue: unchecked, Exit leaves the queue as before, remembered for the next lobby; checked, a reload on another page carries on with the search", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(2 * 60_000);
  await crowdLobby(page, "Ann Keep");
  await play(page).click();
  const keep = page.getByRole("checkbox", { name: "Keep me in the queue" });
  await keep.uncheck();
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  // Out of the queue: home as it was, no search anywhere.
  await expect(page.getByRole("radiogroup", { name: "RANKED" })).toBeVisible();
  await expect(page.locator(".fd-search")).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.getItem("hunchess.keepQueue"), localStorage.getItem("brc.current")])).toEqual(["0", null]);
  // The next lobby remembers it; checked again, Exit keeps you queued.
  await play(page).click();
  await expect(keep).not.toBeChecked();
  await keep.check();
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await expect(page.locator(".fd-search")).toBeVisible();
  // A reload: home again, still searching (its rows), the wait going on.
  await page.waitForTimeout(2_000);
  await page.reload();
  const row = page.locator(".fd-search");
  await expect(row).toBeVisible({ timeout: 15_000 });
  expect(seconds(await row.locator(".fd-search-time").textContent())).toBeGreaterThanOrEqual(2);
  // Loaded on another page (the shop's address): still searching there (the bar); its Cancel ends it, the page stays.
  await page.goto(`/shop${new URL(page.url()).search}`);
  const bar = page.locator(".dq-bar");
  await expect(bar).toBeVisible({ timeout: 15_000 });
  expect(seconds(await bar.locator(".dq-time").textContent())).toBeGreaterThanOrEqual(2);
  await bar.getByRole("button", { name: "Cancel" }).click();
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Shop", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(await page.evaluate(() => [localStorage.getItem("brc.current"), sessionStorage.getItem("hunchess.awaySearch")])).toEqual([null, null]);
});
