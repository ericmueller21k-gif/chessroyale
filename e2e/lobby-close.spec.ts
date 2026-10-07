import { expect, type Page } from "@playwright/test";
import { createLobbyFromHome, named, test } from "./helpers.ts";

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

test("a finished match: a reload mid-match rejoins it; its results survive a reload while they're up; then it closes: home, a note, your result", async ({ page, browser }) => {
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
  await expect(marked).toContainText("Boss raid");
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

test("a code typed into Join that leads nowhere: \"Can't join\", not an endless \"Connecting…\"", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("button", { name: "Play with friends" }).click();
  await page.getByRole("textbox", { name: "Lobby code" }).fill("ZZZZZ");
  await page.getByRole("button", { name: "Join lobby" }).click();
  await expect(page.getByRole("heading", { name: "Can't join" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("We couldn't find a lobby with that code.")).toBeVisible();
  await page.getByRole("button", { name: "Home" }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(path(page)).toBe("/");
});
