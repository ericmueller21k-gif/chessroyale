import { devices, expect, type Browser, type Page } from "@playwright/test";
import { BOARD_SEL, named, test } from "./helpers.ts";

/**
 * Resign in every mode (Eric, Oct 13; DECISIONS.md, "Resign: leaving a match in every mode"): a phone's "⋯" in the top
 * line opens a sheet (Sound, Resign), a computer's flag sits beside the sound button; either way a second step says
 * what happens, and nothing covers the board meanwhile. Solo stops at once; online, a bot takes your seat and the
 * others play on; Squads' squad plays on with a bot in your seat.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const path = (p: Page) => new URL(p.url()).pathname;
const run = Date.now().toString(36).slice(-5);
const pool = (name: string) => `${name}-${test.info().project.name[0]}${run}`;
const phone = () => test.info().project.name === "phone";

/** Boxes don't overlap (with a pixel to spare). */
const apart = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1;

/**
 * Opens the match's control the way this device has it (a phone: "⋯", then Resign or Leave in its sheet; a computer:
 * the flag) and checks the confirm says `title` and `note`, leaving the board, its moves and the clock clear.
 */
async function openConfirm(page: Page, title: RegExp, note: RegExp) {
  const resign = title.source.replace(/^\^/, "").startsWith("Resign");
  if (phone()) {
    await page.getByRole("button", { name: "Match options" }).click();
    const sheet = page.getByRole("dialog", { name: "Match options" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("switch", { name: /Sound/ })).toBeVisible();
    await sheet.getByRole("button", { name: resign ? /^Resign$/ : /^Leave the match$/ }).click();
  } else {
    await expect(page.getByRole("button", { name: "Match options" })).toHaveCount(0);
    await page.getByRole("button", { name: resign ? "Resign" : "Leave the match", exact: true }).click();
  }
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await expect(confirm.locator(".mm-confirm-title")).toHaveText(title);
  await expect(confirm.locator(".mm-confirm-note")).toHaveText(note);
  // (Cancel has the focus: Enter never resigns by itself.)
  await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
  // Nothing over the board (its moves), the line above it (the move's count, a clock), the move's timer bars, the
  // board's clock (Crowd) or the squads' clocks under the board (Squads).
  const box = (await confirm.boundingBox())!;
  for (const sel of [`.board-area ${BOARD_SEL.wrap}`, ".board-area .opening-name", ".timer-bar", ".board-clock", ".sq-clockline"]) {
    for (const el of await page.locator(sel).all()) {
      const b = await el.boundingBox();
      if (b && b.height > 0) expect(apart(box, b), `the confirm covers ${sel}`).toBe(true);
    }
  }
  return confirm;
}

test("Boss alone: Cancel keeps playing; Resign ends the game at once, a loss (\"You resigned\", the boss won), and nothing goes on after it", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=gingerbread");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  // The confirm stays up while the game moves on under it (the screen is drawn afresh each turn): a move, the boss's
  // reply. Then Cancel: the game goes on.
  const first = await openConfirm(page, /^Resign\?$/, /^The game ends here and counts as a loss\.$/);
  const plies0 = await page.evaluate(() => (window as any).match.runner.boards.get((window as any).match.runner.state.boards[0]).history.length);
  const move: string = await page.evaluate(async () => {
    const m = (window as any).match;
    const [top] = await m.runner.topMovesFor(m.phase.board.fen);
    return top.move;
  });
  await page.evaluate((mv) => (window as any).match.submit(mv), move);
  await expect
    .poll(() => page.evaluate(() => (window as any).match.runner.boards.get((window as any).match.runner.state.boards[0]).history.length), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(plies0 + 2);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  await expect(first).toBeVisible();
  await first.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(await phase(page)).toBe("play");
  // Resign on the next move.
  const confirm = await openConfirm(page, /^Resign\?$/, /^The game ends here and counts as a loss\.$/);
  await confirm.getByRole("button", { name: /Resign/ }).click();
  await expect.poll(() => phase(page), { timeout: 5_000 }).toBe("results");
  await expect(page.locator(".results h1")).toHaveText("You resigned");
  await expect(page.locator(".results .team-result").first()).toHaveText(/Ginger won\./);
  await expect(page.locator(".results")).toContainText("It counts as a loss.");
  const left = await page.evaluate(() => (window as any).match.phase);
  expect(left).toMatchObject({ kind: "results", left: { how: "resigned" }, bossResult: "boss", placement: 1 });
  // Stopped: no timer, no engine answer brings anything back (the boss doesn't move, the phase stays).
  const plies = await page.evaluate(() => (window as any).match.runner.boards.get((window as any).match.runner.state.boards[0]).history.length);
  await page.waitForTimeout(4_000);
  expect(await phase(page)).toBe("results");
  expect(await page.evaluate(() => (window as any).match.runner.boards.get((window as any).match.runner.state.boards[0]).history.length)).toBe(plies);
  // A clear way home.
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("solo 50 v 50: Leave in the votes goes home with nothing recorded; Resign mid-match stops it there, out last of 100", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await named(page, "Quitter");
  // The votes (before move 1): Leave.
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=2&clock=30");
  await page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Solo/ }).click();
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("vote");
  const leave = await openConfirm(page, /^Leave the match\?$/, /^You'll go home\. Nothing goes on your record\.$/);
  await leave.getByRole("button", { name: "Leave" }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(page.locator(".vote-screen")).toHaveCount(0);

  // Again, past the votes: Resign.
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=2&clock=30&augments=0");
  await page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Solo/ }).click();
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/^(play|watching)$/);
  const confirm = await openConfirm(page, /^Resign\?$/, /^The match ends here for you and counts as a loss\.$/);
  await confirm.getByRole("button", { name: /Resign/ }).click();
  await expect.poll(() => phase(page), { timeout: 5_000 }).toBe("results");
  await expect(page.locator(".results h1")).toHaveText("You resigned");
  await expect(page.locator(".results .left-line")).toHaveText("Out in 100th place of 100.");
  await expect(page.locator(".results")).toContainText("It counts as a loss.");
  await page.waitForTimeout(2_000);
  expect(await phase(page)).toBe("results");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
});

test("Squads (a test lobby): Resign leaves the lobby, a bot plays your seat, and the lobby, with nobody left, closes", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await named(page, "Tess");
  await page.goto("/squads/test/relay?nolanding&debug&clock=90,0,3,0");
  await expect(page.getByRole("button", { name: "Skip votes" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Skip votes" }).click();
  await expect.poll(() => page.evaluate(() => (window as any).squads?.lobby?.phase ?? null), { timeout: 20_000 }).toBe("bracket");
  const code: string = await page.evaluate(() => (window as any).squads.code);
  const squad: string = await page.evaluate(() => {
    const s = (window as any).squads;
    return ["Rooks", "Knights", "Bishops", "Queens", "Kings", "Pawns", "Towers", "Crowns"][s.mySquad.id];
  });
  // In a match: the board's screen.
  await expect(page.locator(".sq-game")).toBeVisible({ timeout: 30_000 });
  const confirm = await openConfirm(page, /^Resign\?$/, new RegExp(`^You'll leave the lobby and it counts as a loss\\. A bot plays your seat for the ${squad}\\.$`));
  await confirm.getByRole("button", { name: /Resign/ }).click();
  await expect(page.locator(".sq-resigned h1")).toHaveText("You resigned");
  await expect(page.locator(".sq-resigned")).toContainText(`Test lobby: nothing goes on your record. A bot plays your seat for the ${squad}.`);
  // Nobody is left in it: it has ended and closed (its code no longer works).
  await expect
    .poll(() => page.evaluate((c) => fetch(`/api/squads/lobby/${c}`).then((r) => r.json()).then((b: { open?: boolean }) => b.open), code), { timeout: 15_000 })
    .toBe(false);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(await page.evaluate((c) => localStorage.getItem(`brc.squads.${c}`), code)).toBeNull();
});

/** A second device, the same kind as the project's. */
const device = (browser: Browser) =>
  browser.newContext(phone() ? ({ ...devices["iPhone 13"], browserName: undefined } as never) : { viewport: { width: 1280, height: 800 } });

test("online boss raid: one resigns, a bot takes the seat, the other plays on (and now runs the boss); the one who left isn't put back", async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  const q = pool("resign");
  const [ca, cb] = [await device(browser), await device(browser)];
  const a = await ca.newPage();
  const b = await cb.newPage();
  await named(a, "Resigner");
  await named(b, "Stayer");
  for (const p of [a, b]) {
    await p.goto(`/?debug&pool=${q}`);
    await p.getByRole("radio", { name: /^Boss raid/ }).click();
    await p.getByRole("button", { name: "PLAY", exact: true }).click();
  }
  // Bots fill at 8 s here; the boss's intro, then the crowd's first move.
  await expect.poll(() => phase(a), { timeout: 60_000 }).toBe("play");
  await expect.poll(() => phase(b), { timeout: 30_000 }).toMatch(/^(play|scoring)$/);
  const code: string = await a.evaluate(() => (window as any).match.code);
  expect(await b.evaluate(() => (window as any).match.code)).toBe(code);
  const names = (p: Page) => p.evaluate(() => (window as any).match.standings().map((s: any) => s.name) as string[]);
  expect(await names(b)).toContain("Resigner");

  const confirm = await openConfirm(a, /^Resign\?$/, /^You'll leave this match and it counts as a loss\. A bot takes your seat\.$/);
  await confirm.getByRole("button", { name: /Resign/ }).click();
  await expect(a.locator(".results h1")).toHaveText("You resigned", { timeout: 10_000 });
  await expect(a.locator(".results .left-line")).toHaveText(/^Out in \d+(st|nd|rd|th) place of 50\. A bot plays your seat\.$/);
  // This device forgot the seat: the app opened again lands home, not back in the match.
  expect(await a.evaluate((c) => localStorage.getItem(`brc.lobby.${c}`), code)).toBeNull();
  await a.getByRole("button", { name: "Home", exact: true }).click();
  await a.goto("/?debug");
  await expect(a.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await a.waitForTimeout(1_000);
  expect(path(a)).toBe("/");

  // The other plays on: the seat is a bot's (the crowd still 50), and the match moves on (their device now hosts it).
  await expect.poll(() => names(b), { timeout: 60_000 }).not.toContain("Resigner");
  expect((await names(b)).length).toBe(50);
  // (Nobody picks: each move times out, and the next comes.)
  const key = await b.evaluate(() => (window as any).match.key);
  await expect.poll(() => b.evaluate((k) => (window as any).match.key !== k, key), { timeout: 120_000, intervals: [1000] }).toBe(true);
  expect(await phase(b)).not.toBe("results");
  expect(await b.evaluate(() => (window as any).match.isHost)).toBe(true);
});
