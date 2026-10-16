import { expect, type Browser, type Page } from "@playwright/test";
import { BOARD_SEL, named, test, watchFor } from "./helpers.ts";

/**
 * Ranked 1 v 1 through the real server (docs/areas/ranked.md), two players on emulated phones (and computers): both
 * queue (one tap: /1v1, as the home screen's button), meet, vote on the time control on the game's own board (a real
 * drag, a tap and a tap), see "Timer: …" over it, and play to a result with real taps on the board: checkmate,
 * resigning, flagging. Ranks move (placements). Also: a first move that never comes aborts with no rank change, and
 * the no-opponent fallback (Keep waiting; Play a bot, unranked). Each test queues in a pool of its own (`?pool=`, a
 * test switch), so tests never meet; `clock=` (each side's seconds, a test switch) makes a flag quick, and `fewAfter=`
 * brings the "Few players online" choice forward.
 */

const isComputer = () => test.info().project.name === "desktop";

async function player(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await named(page, name);
  await page.goto("/?nolanding");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  return page;
}

/** A pool of this test's own. */
const poolName = () => `d${test.info().project.name.slice(0, 1)}${Math.random().toString(36).slice(2, 9)}`;

/** Your 1 v 1 record, from the server (your profile). */
const record = (page: Page) => page.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.ranked1v1 as { games: number; wins: number; losses: number; draws: number; rank: { label: string } }));

/** Which side this page plays (its own strip says). */
const sideOf = async (page: Page) => (await page.locator(".dv-strip.dv-you").getAttribute("data-side")) as "w" | "b";

/** A square's center on screen, from this page's side. */
async function squareAt(page: Page, square: string): Promise<{ x: number; y: number }> {
  const box = (await page.locator(`.board-area ${BOARD_SEL.squares}`).boundingBox())!;
  const white = (await sideOf(page)) === "w";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  const col = white ? f : 7 - f;
  const row = white ? 7 - r : r;
  return { x: box.x + ((col + 0.5) * box.width) / 8, y: box.y + ((row + 0.5) * box.height) / 8 };
}

/** A move by two taps on the board, as a player makes it. */
async function tapMove(page: Page, uci: string) {
  const a = await squareAt(page, uci.slice(0, 2));
  const b = await squareAt(page, uci.slice(2, 4));
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
}

/** Both players queue in `pool` and meet: the versus moment, then the vote on the board. */
async function meet(a: Page, b: Page, pool: string, extra = "") {
  await a.goto(`/1v1?nolanding&debug&pool=${pool}${extra}`);
  await expect(a.locator(".dv-search")).toContainText("Finding an opponent");
  await b.goto(`/1v1?nolanding&debug&pool=${pool}${extra}`);
  for (const p of [a, b]) await expect(p.locator(".dv-versus")).toContainText("Opponent found", { timeout: 20_000 });
  for (const p of [a, b]) await expect(p.locator(".dv-vote")).toBeVisible({ timeout: 10_000 });
}

/** The two players by side, once the board is up. */
async function bySide(a: Page, b: Page): Promise<{ white: Page; black: Page }> {
  return (await sideOf(a)) === "w" ? { white: a, black: b } : { white: b, black: a };
}

/** Waits for play: the overlay gone, the first move due. */
async function waitForPlay(...pages: Page[]) {
  for (const p of pages) await expect(p.locator(".dv-status")).toContainText(/first move/, { timeout: 15_000 });
}

/** Resign (or Leave: an abort) from the match's control: the phone's "⋯" sheet, or the computer's flag; then confirm. */
async function resign(page: Page, word: "Resign" | "Leave" = "Resign") {
  if (isComputer()) await page.getByRole("button", { name: word === "Resign" ? "Resign" : "Leave the match" }).click();
  else {
    await page.getByRole("button", { name: "Match options" }).click();
    await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: new RegExp(word) }).click();
  }
  await page.getByRole("alertdialog").getByRole("button", { name: word }).click();
}

test("two players: one tap to queue, the vote on the game's own board, checkmate with real taps, and both ranks move", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const a = await player(browser, "Ann Duel");
  const b = await player(browser, "Bo Duel");
  const pool = poolName();
  await meet(a, b, pool);

  // Each pawn starts off the grid on its own side, on the line between its second and third ranks; the zones are
  // Bullet, Blitz, Rapid from left to right whichever side you play.
  for (const p of [a, b]) {
    const labels = await p.locator(".dv-label").allTextContents();
    expect(labels).toEqual(["Bullet 1+1", "Blitz 3+2", "Rapid 10+5"]);
    const xs = await p.locator(".dv-label").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
    expect(xs[0]!).toBeLessThan(xs[1]!);
    expect(xs[1]!).toBeLessThan(xs[2]!);
    const board = (await p.locator(`.board-area ${BOARD_SEL.squares}`).boundingBox())!;
    const pawn = (await p.locator(".vote-me").boundingBox())!;
    const cx = pawn.x + pawn.width / 2;
    // (Between the d- and e-files, near your own side: the line of your second and third ranks, 6/8 of the way down.)
    expect(Math.abs(cx - (board.x + board.width / 2))).toBeLessThan(board.width / 16);
    expect(pawn.y + pawn.height * 0.55).toBeGreaterThan(board.y + board.height * 0.68);
  }
  const boardBefore = (await a.locator(`.board-area ${BOARD_SEL.wrap}`).boundingBox())!;

  // Ann drags hers into Rapid; Bo picks up his with a tap, then taps Bullet. The other's pawn moves live.
  const overlay = await watchFor(a, { timer: { selector: ".dv-overlay", text: /^Timer: Blitz 3\+2$/ } });
  const zone = (await a.locator(".vote-zone").nth(2).boundingBox())!;
  const mine = (await a.locator(".vote-me").boundingBox())!;
  await a.mouse.move(mine.x + mine.width / 2, mine.y + mine.height / 2);
  await a.mouse.down();
  await a.mouse.move(zone.x + zone.width / 2, zone.y + zone.height * 0.7, { steps: 8 });
  await a.mouse.up();
  await b.locator(".vote-me").click();
  await b.getByRole("button", { name: "Pick Bullet 1+1" }).click();
  await expect(a.locator(".dv-label.mine")).toHaveText("Rapid 10+5");
  await expect(b.locator(".dv-label.mine")).toHaveText("Bullet 1+1");
  // Ann sees Bo's pawn in Bullet (the zone on her left).
  const bullet = (await a.locator(".vote-zone").nth(0).boundingBox())!;
  await expect
    .poll(async () => {
      const p = (await a.locator(".dv-pawn:not(.vote-me)").boundingBox())!;
      return p.x + p.width / 2 > bullet.x && p.x + p.width / 2 < bullet.x + bullet.width;
    })
    .toBe(true);

  // Rapid and Bullet meet on Blitz: "Timer: Blitz 3+2" over the board, then the game on the same board.
  await waitForPlay(a, b);
  expect((await overlay.seen()).timer).toBe(true);
  await expect(a.locator(".dv-control")).toHaveText("Blitz 3+2");
  await expect(a.locator(".dv-clock").first()).toHaveText("3:00");
  // The board never moved from the vote to the game.
  const boardAfter = (await a.locator(`.board-area ${BOARD_SEL.wrap}`).boundingBox())!;
  expect(boardAfter).toEqual(boardBefore);

  // The fool's mate, by taps: White f3 and g4, Black e5 and Qh4#.
  const { white, black } = await bySide(a, b);
  for (const [p, m, ply] of [
    [white, "f2f3", 1],
    [black, "e7e5", 2],
    [white, "g2g4", 3],
    [black, "d8h4", 4],
  ] as const) {
    await expect(p.locator(".dv-status")).toContainText(/Your (first )?move/, { timeout: 10_000 });
    await tapMove(p, m);
    await expect.poll(() => p.evaluate(() => (window as unknown as { duel?: { snapshot(): { moves: string[] } } }).duel?.snapshot().moves.length ?? -1).catch(() => -1)).toBe(ply);
  }
  await expect(black.locator(".dv-result-title")).toHaveText("You won");
  await expect(black.locator(".dv-result-why")).toHaveText("Checkmate.");
  await expect(white.locator(".dv-result-title")).toHaveText("You lost");
  // The ranks moved: one placement game each (the server's record).
  for (const p of [white, black]) await expect(p.locator(".dv-result-rank")).toHaveText("Placement 1/5", { timeout: 15_000 });
  expect(await record(black)).toMatchObject({ games: 1, wins: 1, losses: 0, rank: { label: "Placement 1/5" } });
  expect(await record(white)).toMatchObject({ games: 1, wins: 0, losses: 1 });
});

test("resigning, then a flag: Play again queues both again; each game counts", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const a = await player(browser, "Ann Clock");
  const b = await player(browser, "Bo Clock");
  const pool = poolName();
  // (A test's clock: 6 s each side, no increment.)
  await meet(a, b, pool, "&clock=6");
  await waitForPlay(a, b);
  let { white, black } = await bySide(a, b);
  await tapMove(white, "e2e4");
  await expect(black.locator(".dv-status")).toContainText("Your first move", { timeout: 10_000 });
  await tapMove(black, "e7e5");
  await expect(white.locator(".dv-status")).toHaveText("Your move", { timeout: 10_000 });
  await resign(white);
  await expect(black.locator(".dv-result-title")).toHaveText("You won");
  await expect(black.locator(".dv-result-why")).toHaveText(/ resigned\.$/);
  await expect(white.locator(".dv-result-why")).toHaveText("You resigned.");
  for (const p of [white, black]) await expect(p.locator(".dv-result-rank")).toHaveText("Placement 1/5", { timeout: 15_000 });

  // Play again: both back in the queue (the same pool), a new game; this time White's clock runs out.
  for (const p of [a, b]) await p.getByRole("button", { name: "Play again" }).click();
  for (const p of [a, b]) await expect(p.locator(".dv-vote")).toBeVisible({ timeout: 25_000 });
  await waitForPlay(a, b);
  ({ white, black } = await bySide(a, b));
  await tapMove(white, "d2d4");
  await expect(black.locator(".dv-status")).toContainText("Your first move", { timeout: 10_000 });
  await tapMove(black, "d7d5");
  // White doesn't move: 6 s later the flag falls (Black has more than a lone king: a loss, not a draw).
  await expect(white.locator(".dv-result-title")).toHaveText("You lost", { timeout: 20_000 });
  await expect(white.locator(".dv-result-why")).toHaveText("You ran out of time.");
  await expect(black.locator(".dv-result-why")).toHaveText(/ ran out of time\.$/);
  await expect(white.locator(".dv-clock.low").first()).toBeVisible();
  for (const p of [white, black]) await expect(p.locator(".dv-result-rank")).toHaveText("Placement 2/5", { timeout: 15_000 });
});

test("a first move that never comes: the game is aborted, nobody's rank moves", async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const a = await player(browser, "Ann Abort");
  const b = await player(browser, "Bo Abort");
  await meet(a, b, poolName());
  await waitForPlay(a, b);
  const { white, black } = await bySide(a, b);
  // White never moves: 20 s later it's called off.
  await expect(white.locator(".dv-result-title")).toHaveText("Game aborted", { timeout: 35_000 });
  await expect(white.locator(".dv-result-why")).toHaveText("Your first move didn't come in time. No rank change.");
  await expect(black.locator(".dv-result-why")).toHaveText(/'s first move didn't come in time\. No rank change\.$/);
  await expect(white.locator(".dv-result-rank")).toHaveCount(0);
  expect((await record(white)).games).toBe(0);
  expect((await record(black)).games).toBe(0);
});

test("a reload mid-game comes back to the same game, its clocks running; a declined offer, then a draw both agree to", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const a = await player(browser, "Ann Draw");
  const b = await player(browser, "Bo Draw");
  await meet(a, b, poolName());
  await waitForPlay(a, b);
  const { white, black } = await bySide(a, b);
  await tapMove(white, "e2e4");
  await expect(black.locator(".dv-status")).toContainText("Your first move", { timeout: 10_000 });
  await tapMove(black, "e7e5");
  await expect(white.locator(".dv-status")).toHaveText("Your move", { timeout: 10_000 });
  // White reloads (its address is the game's: /1v1/CODE): the same game, both moves, White's clock running down.
  const code = await white.evaluate(() => location.pathname);
  expect(code).toMatch(/^\/1v1\/[A-Z2-9]{5}$/);
  const clock = () => white.locator(".dv-strip.dv-you .dv-clock").textContent();
  await white.reload();
  await expect(white.locator(".dv-status")).toHaveText("Your move", { timeout: 20_000 });
  expect(await white.evaluate(() => location.pathname)).toBe(code);
  expect(await white.evaluate(() => (window as unknown as { duel: { snapshot(): { moves: string[]; running: boolean } } }).duel.snapshot())).toMatchObject({ moves: ["e2e4", "e7e5"], running: true });
  const t1 = await clock();
  await expect.poll(clock, { timeout: 5_000 }).not.toBe(t1);
  // White offers a draw; Black declines; White can't offer again yet.
  await white.getByRole("button", { name: "Offer a draw" }).click();
  await expect(white.locator(".dv-draw-sent")).toHaveText("Draw offered");
  const nameOf = (p: Page) => (p === a ? "Ann Draw" : "Bo Draw");
  await expect(black.locator(".dv-draw")).toContainText(`${nameOf(white)} offers a draw`);
  await black.locator(".dv-draw").getByRole("button", { name: "Decline" }).click();
  await expect(white.locator(".dv-draw-sent")).toHaveCount(0);
  await expect(white.getByRole("button", { name: "Offer a draw" })).toBeDisabled();
  // Black offers, after a move each; White accepts: a draw, both told why.
  await tapMove(white, "g1f3");
  await expect(black.locator(".dv-status")).toHaveText("Your move", { timeout: 10_000 });
  await black.getByRole("button", { name: "Offer a draw" }).click();
  await expect(white.locator(".dv-draw")).toContainText(`${nameOf(black)} offers a draw`);
  await white.locator(".dv-draw").getByRole("button", { name: "Accept" }).click();
  for (const p of [white, black]) {
    await expect(p.locator(".dv-result-title")).toHaveText("Draw");
    await expect(p.locator(".dv-result-why")).toHaveText("Draw agreed.");
    await expect(p.locator(".dv-result-rank")).toHaveText("Placement 1/5", { timeout: 15_000 });
  }
  expect(await record(white)).toMatchObject({ games: 1, draws: 1 });
});

test("Leave before the first moves: the game is called off, with no result and no rank change", async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const a = await player(browser, "Ann Leave");
  const b = await player(browser, "Bo Leave");
  await meet(a, b, poolName());
  await waitForPlay(a, b);
  const { white, black } = await bySide(a, b);
  await resign(white, "Leave");
  await expect(white.locator(".dv-result-title")).toHaveText("Game aborted");
  await expect(white.locator(".dv-result-why")).toHaveText("You left before the first moves. No rank change.");
  await expect(black.locator(".dv-result-title")).toHaveText("Game aborted");
  await expect(black.locator(".dv-result-why")).toHaveText(`${white === a ? "Ann Leave" : "Bo Leave"} left before the first moves. No rank change.`);
  expect((await record(white)).games).toBe(0);
  expect((await record(black)).games).toBe(0);
});

test("nobody to play: the search's Cancel, then Few players online: Keep waiting, or a bot (unranked)", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const a = await player(browser, "Ann Alone");
  const pool = poolName();
  // (`fewAfter=2`: the choice after 2 s instead of 45.)
  await a.goto(`/1v1?nolanding&pool=${pool}&fewAfter=2`);
  await expect(a.locator(".dv-search")).toContainText("Finding an opponent");
  const few = a.locator(".dv-few");
  await expect(few).toContainText("Few players online right now", { timeout: 10_000 });
  await few.getByRole("button", { name: "Keep waiting" }).click();
  await expect(few).toHaveCount(0);
  await expect(a.locator(".dv-search")).toContainText("Finding an opponent");
  // Cancel: home.
  await a.getByRole("button", { name: "Cancel" }).click();
  await expect(a.locator(".dv-search")).toHaveCount(0);
  await expect(a).toHaveURL(/\/(\?.*)?$/);
  // Again, and this time a bot.
  await a.goto(`/1v1?nolanding&pool=${pool}&fewAfter=2`);
  await a.locator(".dv-few").getByRole("button", { name: "Play a bot (unranked)" }).click();
  await expect(a.locator(".dv-versus")).toContainText("Bot");
  await expect(a.locator(".dv-vote")).toBeVisible({ timeout: 10_000 });
  await expect(a.locator(".dv-status")).toContainText(/first move/, { timeout: 15_000 });
  // Your first move (the bot's first, if it has White); the bot answers; then it's yours again: resign.
  if ((await sideOf(a)) === "b") await expect(a.locator(".dv-status")).toHaveText(/^Your first move/, { timeout: 30_000 });
  await tapMove(a, (await sideOf(a)) === "w" ? "e2e4" : "e7e5");
  await expect(a.locator(".dv-status")).toHaveText("Your move", { timeout: 30_000 });
  await resign(a);
  await expect(a.locator(".dv-result-title")).toHaveText("You lost");
  await expect(a.locator(".dv-result-rank")).toHaveText("Unranked game");
  expect((await record(a)).games).toBe(0);
});
