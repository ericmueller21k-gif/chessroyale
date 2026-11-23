import { expect, type Locator, type Page } from "@playwright/test";
import { createLobbyFromHome, named, test, openPlayWithFriends } from "./helpers.ts";

/**
 * Closing finished lobbies (DECISIONS.md, "Closing finished lobbies"): results stay up for a while (here `keep`
 * seconds, a playtest option), then the lobby closes. A reload while they're up shows them again; once it has
 * closed, the app (and any old link to it) goes home with a note, and the address is / again.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const path = (p: Page) => new URL(p.url()).pathname;
const note = (p: Page) => p.locator(".fd-notice");

/** Plays this page's moves (its own engine's best) until the results. */
async function playToResults(page: Page, minutes: number) {
  const stopAt = Date.now() + minutes * 60_000;
  while (Date.now() < stopAt) {
    const k = await phase(page);
    if (k === "results") return;
    if (k === "play") {
      await page
        .evaluate(async () => {
          const m = (window as any).match;
          if (m.phase.kind !== "play" || Date.now() < m.phase.startsAt) return;
          const fen = m.phase.board.fen;
          const [engine] = await m.engines();
          const [top] = await engine.topMoves(fen, 1);
          if (m.phase.kind === "play" && m.phase.board.fen === fen) m.submit(top.move);
        })
        .catch(() => undefined);
    }
    await page.waitForTimeout(250);
  }
  throw new Error("no results in time");
}

test("a finished match: a reload mid-match rejoins it; its results survive a reload while they're up; then it closes: home, a note, your result", { tag: "@phone-only" }, async ({ page, browser }) => {
  test.setTimeout(6 * 60_000);
  await named(page, "Closer");
  // A boss raid of one with two crowd moves: a short online match. Its results stay up 30 s.
  await page.goto("/?debug&pace=quick&mode=raid&boss=1600&bossMoves=2&clock=20&keep=30");
  await createLobbyFromHome(page);
  await page.getByRole("button", { name: /^Start with 1 player$/ }).click();
  const code: string = await page.evaluate(() => (window as any).match.code);
  expect(path(page)).toBe(`/lobby/${code}`);

  // Mid-match: a reload puts you back in it (same lobby, same seat, a match screen, not home).
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await page.reload();
  await expect.poll(() => phase(page), { timeout: 30_000 }).toMatch(/^(play|scoring|reveal|boss)$/);
  expect(path(page)).toBe(`/lobby/${code}`);
  expect(await page.evaluate(() => (window as any).match.code)).toBe(code);

  await playToResults(page, 4);
  const heading = (await page.locator(".results h1").textContent())!.trim();
  expect(heading.length).toBeGreaterThan(0);

  // Results up: a reload shows them again, as they were.
  await page.reload();
  await expect(page.locator(".results h1")).toHaveText(heading, { timeout: 20_000 });
  expect(path(page)).toBe(`/lobby/${code}`);
  const seat = await page.evaluate((c) => localStorage.getItem(`brc.lobby.${c}`), code);
  expect(seat).toBeTruthy();

  // Someone who wasn't in it opens the link meanwhile: home with the note (nothing of theirs to see), at /.
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(`/lobby/${code}`);
  await expect(note(stranger)).toContainText("That match has ended.");
  await expect(stranger.getByRole("button", { name: "See your result" })).toHaveCount(0);
  await expect(stranger.getByRole("dialog", { name: /Join lobby/ })).toHaveCount(0);
  expect(path(stranger)).toBe("/");

  // The keep time runs out with the results on screen: home, the note, your result, and the address is / again.
  await expect(note(page)).toContainText("That match has ended.", { timeout: 60_000 });
  expect(path(page)).toBe("/");
  await expect(page.locator(".results")).toHaveCount(0);
  // (This device forgot its seat.)
  expect(await page.evaluate((c) => localStorage.getItem(`brc.lobby.${c}`), code)).toBeNull();

  // "See your result": your profile, at that match.
  await page.getByRole("button", { name: "See your result" }).click();
  const marked = page.locator('.fd-match[aria-current="true"]');
  await expect(marked).toBeVisible();
  await expect(marked).toContainText("Boss Battle");
  await expect(page.locator(".fd-match.marked")).toHaveCount(1);

  // A stale tab that still has its seat (the app reopened hours later): home with the note, not a dead screen.
  await page.evaluate(([c, s]) => localStorage.setItem(`brc.lobby.${c}`, s!), [code, seat] as const);
  await page.goto(`/lobby/${code}`);
  await expect(note(page)).toContainText("That match has ended.", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "See your result" })).toBeVisible();
  expect(path(page)).toBe("/");
  // Dismissed, it's gone.
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(note(page)).toHaveCount(0);
});

test("Home or Play again from results: the address is / again, so reopening the app lands home", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await named(page, "Leaver");
  await page.goto("/?debug&pace=quick&mode=raid&boss=1600&bossMoves=1&clock=20");
  await createLobbyFromHome(page);
  await page.getByRole("button", { name: /^Start with 1 player$/ }).click();
  const code: string = await page.evaluate(() => (window as any).match.code);
  await playToResults(page, 3);
  await page.getByRole("button", { name: "Home" }).click();
  expect(path(page)).toBe("/");
  expect(await page.evaluate((c) => localStorage.getItem(`brc.lobby.${c}`), code)).toBeNull();
  // Reopened: home, no note (the results are still up, but nobody asked for that lobby).
  await page.reload();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(note(page)).toHaveCount(0);
  // Its link, while the results are still up: the note (you've left it), with your result.
  await page.goto(`/lobby/${code}`);
  await expect(note(page)).toContainText("That match has ended.");
  await expect(page.getByRole("button", { name: "See your result" })).toBeVisible();
  expect(path(page)).toBe("/");
});

test("a code typed into Join that leads nowhere: \"Can't join\", not an endless \"Connecting…\"", { tag: "@phone-only" }, async ({ page }) => {
  await page.goto("/");
  await openPlayWithFriends(page);
  await page.getByRole("textbox", { name: "Lobby code" }).fill("ZZZZZ");
  await page.getByRole("button", { name: "Join lobby" }).click();
  await expect(page.getByRole("heading", { name: "Can't join" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("We couldn't find a lobby with that code.")).toBeVisible();
  await page.getByRole("button", { name: "Home" }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(path(page)).toBe("/");
});

/**
 * Pop-up notices sit on top and push nothing (Eric, Nov 16: "They shouldn't ever push anything around on the screen").
 * With a note showing, a fixed thing on the screen keeps its box (to 1 px); dismissed, it still does; and the note is on
 * top (the element at its middle is inside it). Home: PLAY. Boss Battle (a party that closed): the first boss tile and the first way to play.
 */
const box = async (loc: Locator) => {
  const b = await loc.boundingBox();
  return { x: b!.x, y: b!.y, w: b!.width, h: b!.height };
};
async function expectSameBox(loc: Locator, want: { x: number; y: number; w: number; h: number }) {
  const got = await box(loc);
  for (const k of ["x", "y", "w", "h"] as const) expect(Math.abs(got[k] - want[k])).toBeLessThanOrEqual(1);
}
async function expectOnTop(page: Page, note: Locator) {
  const onTop = await page.evaluate(() => {
    const n = document.querySelector(".fd-notice");
    if (!n) return false;
    const r = n.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && !!n.contains(hit);
  });
  expect(onTop).toBe(true);
  await expect(note).toBeVisible();
}

test("a pop-up note floats over the screen and pushes nothing: home (PLAY) and Boss Battle (a closed party: its first tile, its first way to play)", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  // Home with no note: where PLAY is.
  await page.goto("/?debug");
  const play = page.getByRole("button", { name: "PLAY", exact: true });
  await expect(play).toBeVisible();
  const playAt = await box(play);
  // Home with the note (an unknown lobby's link): PLAY keeps its box, and the note is on top.
  await page.goto("/lobby/ZZZZZ?debug");
  await expect(note(page)).toBeVisible({ timeout: 20_000 });
  await expectOnTop(page, note(page));
  await expectSameBox(play, playAt);
  await note(page).getByRole("button", { name: "Dismiss" }).click();
  await expect(note(page)).toHaveCount(0);
  await expectSameBox(play, playAt);

  // Boss Battle with no note: the first tile and START.
  // (The raid screen, the same one a closed party's link opens: its first tile and its first way to play.)
  await page.goto("/?debug&mode=raid");
  const tile = page.locator(".bs-tile").first();
  const play1 = page.locator(".rd-options button").first();
  await expect(play1).toBeVisible();
  const tileAt = await box(tile);
  const playOptAt = await box(play1);
  // Its party has closed: the note floats over it, and the tile and the first way to play keep their boxes.
  await page.goto("/boss/party/ZZZZZ?debug&mode=raid");
  await expect(note(page)).toContainText("That party has closed.", { timeout: 20_000 });
  await expectOnTop(page, note(page));
  await expectSameBox(tile, tileAt);
  await expectSameBox(play1, playOptAt);
  await note(page).getByRole("button", { name: "Dismiss" }).click();
  await expect(note(page)).toHaveCount(0);
  await expectSameBox(tile, tileAt);
  await expectSameBox(play1, playOptAt);
});

test("a remembered Boss Battle party that has closed: its note once, then this device forgets it (never again on the next visit)", async ({ page }) => {
  test.setTimeout(2 * 60_000);
  // (Eric, Nov 18: "That party has closed." came back every time he opened Boss Battle: the closed party stayed this device's.)
  await page.goto("/?debug");
  await page.evaluate(() => {
    localStorage.setItem("brc.bossparty.current", "ZZZZZ");
    localStorage.setItem("brc.bossparty.ZZZZZ", "a-seat-token");
  });
  await page.goto("/?debug&mode=raid");
  await expect(note(page)).toContainText("That party has closed.", { timeout: 20_000 });
  expect(await page.evaluate(() => [localStorage.getItem("brc.bossparty.current"), localStorage.getItem("brc.bossparty.ZZZZZ")])).toEqual([null, null]);
  await note(page).getByRole("button", { name: "Dismiss" }).click();
  // The next visit: Boss Battle again, and no note.
  await page.goto("/?debug&mode=raid");
  await expect(page.locator(".bs-tile").first()).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(note(page)).toHaveCount(0);
});
