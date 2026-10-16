import { expect, type Browser, type Page } from "@playwright/test";
import { RANKED_1V1 } from "@chessroyale/core";
import { BOARD_SEL, named, test, watchFor, watchSpans } from "./helpers.ts";

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

/** Both players queue in `pool` and meet: the versus moment (each other's pawn on the stage), then the vote on the board. */
async function meet(a: Page, b: Page, pool: string, extra = "") {
  await a.goto(`/1v1?nolanding&debug&pool=${pool}${extra}`);
  await expect(a.locator(".dv-search")).toContainText("Finding opponent…");
  await b.goto(`/1v1?nolanding&debug&pool=${pool}${extra}`);
  for (const p of [a, b]) await expect(p.locator(".dv-versus .dv-st-them .dv-st-pawn")).toBeVisible({ timeout: 20_000 });
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
  await expect(a.locator(".dv-search")).toContainText("Finding opponent…");
  const few = a.locator(".dv-few");
  await expect(few).toContainText("Few players online right now", { timeout: 10_000 });
  await few.getByRole("button", { name: "Keep waiting" }).click();
  await expect(few).toHaveCount(0);
  await expect(a.locator(".dv-search")).toContainText("Finding opponent…");
  // Cancel: home.
  await a.getByRole("button", { name: "Cancel" }).click();
  await expect(a.locator(".dv-search")).toHaveCount(0);
  await expect(a).toHaveURL(/\/(\?.*)?$/);
  // A computer keeps its side menu while searching: another page from it leaves the queue first.
  if (isComputer()) {
    await a.goto(`/1v1?nolanding&pool=${pool}`);
    await expect(a.locator(".dv-search")).toBeVisible();
    await a.locator(".fd-side").getByRole("button", { name: "Settings" }).click();
    await expect(a.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(a.locator(".dv-stage")).toHaveCount(0);
  }
  // Again, and this time a bot.
  await a.goto(`/1v1?nolanding&pool=${pool}&fewAfter=2`);
  // The bot arrives on the same stage: its pawn on the right platform, yours still on the left.
  const yours = await a.locator(".dv-st-you .dv-st-spot").boundingBox();
  await a.locator(".dv-few").getByRole("button", { name: "Play a bot (unranked)" }).click();
  await expect(a.locator(".dv-versus .dv-st-them .dv-st-name")).toHaveText("Bot");
  await expect(a.locator(".dv-versus .dv-st-them .dv-st-pawn")).toBeVisible();
  await expect(a.locator(".dv-versus .dv-st-them .dv-st-rank")).toHaveText("Unranked");
  expect(await a.locator(".dv-st-you .dv-st-spot").boundingBox()).toEqual(yours);
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

// ---------------- The stage: the search and the versus moment (docs/areas/ranked.md, "The stage") ----------------

/** The stage's boxes: each side's spot (pawn and platform), and how far the page scrolls each way. */
const stageBoxes = (page: Page) =>
  page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null;
    };
    const d = document.documentElement;
    return { you: box(".dv-st-you .dv-st-spot"), them: box(".dv-st-them .dv-st-spot"), sideways: d.scrollWidth - d.clientWidth, down: d.scrollHeight - d.clientHeight };
  });

test("the stage: your pawn on the left platform while searching; the opponent's pawn, name and rank arrive on the right, hold, then the board", async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const a = await player(browser, "Ann Stage");
  const b = await player(browser, "Bo Stage");
  const pool = poolName();
  await a.goto(`/1v1?nolanding&pool=${pool}`);
  // Searching: your dressed pawn on the left platform, your name and rank under it; the right platform empty and
  // waiting, "Finding opponent…" under it.
  const stage = a.locator(".dv-stage");
  await expect(stage.locator(".dv-st-you .dv-st-pawn .avatar")).toBeVisible();
  await expect(stage.locator(".dv-st-you .dv-st-name")).toHaveText("Ann Stage");
  await expect(stage.locator(".dv-st-you .dv-st-rank")).toHaveText("Placement 0/5");
  await expect(stage.locator(".dv-st-them .dv-st-empty")).toBeVisible();
  await expect(stage.locator(".dv-st-them .dv-st-pawn")).toHaveCount(0);
  await expect(stage.locator(".dv-st-them")).toContainText("Finding opponent…");
  await expect(stage.getByRole("button", { name: "Cancel" })).toBeVisible();
  const before = await stageBoxes(a);
  // Left and right, level, a big part of the width (each pawn's box at least 40% of the screen on a phone).
  const width = a.viewportSize()!.width;
  expect(before.you!.x + before.you!.w / 2).toBeLessThan(width / 2);
  expect(before.them!.x + before.them!.w / 2).toBeGreaterThan(width / 2);
  expect(before.you!.y).toBe(before.them!.y);
  if (!isComputer()) expect(before.you!.w).toBeGreaterThan(width * 0.4);
  expect(before.sideways).toBe(0);
  // (Your pawn's element, marked: the same one must still be there when the opponent arrives, never drawn again.)
  await a.locator(".dv-st-you .dv-st-pawn").evaluate((e) => e.setAttribute("data-kept", "1"));
  const spans = await watchSpans(a, { versus: { selector: ".dv-st-them .dv-st-name", text: /^Bo Stage$/ }, board: { selector: ".dv-vote" } });

  await b.goto(`/1v1?nolanding&pool=${pool}`);
  // Found: Bo's pawn on the right platform, his name and rank under it, "VS" between; nothing else on the stage moved.
  await expect(stage.locator(".dv-st-them .dv-st-name")).toHaveText("Bo Stage", { timeout: 20_000 });
  await expect(stage.locator(".dv-st-them .dv-st-pawn .avatar")).toBeVisible();
  await expect(stage.locator(".dv-st-them .dv-st-rank")).toHaveText("Placement 0/5");
  await expect(stage.locator(".dv-st-vs")).toHaveText("VS");
  await expect(stage.locator(".dv-st-line")).toHaveText(/^You play (White|Black)$/);
  await expect(stage.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  const found = await stageBoxes(a);
  expect(found).toEqual(before);
  await expect(a.locator('.dv-st-you .dv-st-pawn[data-kept="1"]')).toHaveCount(1);
  // Bo sees the same from his side: himself on the left, Ann on the right.
  await expect(b.locator(".dv-st-you .dv-st-name")).toHaveText("Bo Stage", { timeout: 10_000 });
  await expect(b.locator(".dv-st-them .dv-st-name")).toHaveText("Ann Stage");

  // It holds for the game's versus moment, then the board loads with the vote on it, and the stage is gone.
  await expect(a.locator(".dv-vote")).toBeVisible({ timeout: 10_000 });
  await expect(a.locator(".dv-stage")).toHaveCount(0);
  const s = await spans.spans();
  const held = s.versus!.last - s.versus!.first;
  expect(held).toBeGreaterThan(RANKED_1V1.versusMs - 1000);
  expect(held).toBeLessThan(RANKED_1V1.versusMs + 500);
  expect(s.board!.first).toBeGreaterThan(s.versus!.last);
});

test("the stage fits: 320, 360 and 390 px phones (a computer at 1280), the longest names and ranks, no sideways scroll", async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  // The widest a name (16 characters) and a rank can be ("Grandmaster · 499 RP"), for both players: your own from
  // the server's answer, the opponent's (and the game's timing, held in the versus moment) from the game's.
  const WIDE = "WWWWWWWWWWWWWWWW";
  const gm = { placement: null, tier: "Grandmaster", division: null, points: 499, ladder: 2299, color: "#f87171", label: "Grandmaster · 499 RP" };
  const a = await player(browser, "Ann Fit");
  const b = await player(browser, "Bo Fit");
  await a.route(/\/api\/me(\?|$)/, async (route) => {
    const res = await route.fetch();
    const me = await res.json();
    await route.fulfill({ response: res, json: { ...me, user: { ...me.user, name: WIDE }, ranked1v1: { ...me.ranked1v1, rank: gm } } });
  });
  await a.routeWebSocket(/\/api\/1v1\/game\/[A-Z2-9]{5}\/ws/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((m) => server.send(m));
    let held = false;
    server.onMessage((m) => {
      if (held) return;
      const msg = JSON.parse(String(m));
      const g = msg.game;
      if (g?.players) for (const c of ["w", "b"]) g.players[c] = { ...g.players[c], name: WIDE, rank: gm };
      // The versus moment: kept on screen (the vote "opens" in 10 minutes; nothing after this reaches the page).
      if (g?.phase === "versus") {
        g.voteAt += 600_000;
        g.voteEndsAt += 600_000;
        held = true;
      }
      ws.send(JSON.stringify(msg));
    });
  });
  await a.reload();
  await expect(a.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  const pool = poolName();
  const sizes = isComputer() ? [{ width: 1280, height: 800 }] : [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 664 }];
  /** Everything on the stage whole and in view at each size, nothing scrolling sideways or down. */
  const fits = async (what: string) => {
    for (const size of sizes) {
      await a.setViewportSize(size);
      await expect
        .poll(
          () =>
            a.evaluate(() => {
              const vw = document.documentElement.clientWidth;
              const vh = document.documentElement.clientHeight;
              const bad: string[] = [];
              const sel = ".dv-st-head h2, .dv-st-spot, .dv-st-name, .dv-st-rank, .dv-st-finding, .dv-st-vs, .dv-st-line, .dv-few, .dv-few .btn, .dv-cancel";
              for (const e of document.querySelectorAll<HTMLElement>(sel)) {
                const r = e.getBoundingClientRect();
                const name = `${e.className} "${e.textContent?.slice(0, 20)}"`;
                if (r.left < -0.5 || r.right > vw + 0.5) bad.push(`${name}: sideways ${Math.round(r.left)}-${Math.round(r.right)} of ${vw}`);
                if (r.top < -0.5 || r.bottom > vh + 0.5) bad.push(`${name}: below ${Math.round(r.bottom)} of ${vh}`);
                if (e.scrollWidth > e.clientWidth + 1 && !e.classList.contains("dv-st-spot")) bad.push(`${name}: cut ${e.scrollWidth} > ${e.clientWidth}`);
              }
              // The names and ranks never under "VS".
              const vs = document.querySelector(".dv-st-vs")?.getBoundingClientRect();
              if (vs)
                for (const e of document.querySelectorAll(".dv-st-name, .dv-st-rank")) {
                  const r = e.getBoundingClientRect();
                  if (r.left < vs.right && r.right > vs.left && r.top < vs.bottom && r.bottom > vs.top) bad.push(`"VS" over ${e.className}`);
                }
              const d = document.documentElement;
              if (d.scrollWidth > d.clientWidth) bad.push(`page scrolls sideways ${d.scrollWidth - d.clientWidth}`);
              if (d.scrollHeight > d.clientHeight) bad.push(`page scrolls down ${d.scrollHeight - d.clientHeight}`);
              return bad;
            }),
          { message: `${what} at ${size.width} px` },
        )
        .toEqual([]);
    }
  };
  // Searching, with "Few players online right now" (after 1 s here) above Cancel: the tallest the search gets.
  await a.goto(`/1v1?nolanding&pool=${pool}&fewAfter=1`);
  await expect(a.locator(".dv-st-you .dv-st-name")).toHaveText(WIDE);
  await expect(a.locator(".dv-st-you .dv-st-rank")).toHaveText("Grandmaster · 499 RP");
  await expect(a.locator(".dv-few")).toBeVisible({ timeout: 10_000 });
  await fits("searching");
  // Found (held in the versus moment): both pawns, names and ranks at their widest, VS between.
  await b.goto(`/1v1?nolanding&pool=${pool}`);
  await expect(a.locator(".dv-st-them .dv-st-name")).toHaveText(WIDE, { timeout: 20_000 });
  await fits("versus");
  // Reduced motion: nothing on the stage animates.
  await a.emulateMedia({ reducedMotion: "reduce" });
  const moving = await a.evaluate(() =>
    [...document.querySelectorAll(".dv-stage, .dv-stage *")].filter((e) => getComputedStyle(e).animationName !== "none").map((e) => e.className),
  );
  expect(moving).toEqual([]);
});
