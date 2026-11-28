import { expect, type Browser, type Page } from "@playwright/test";
import { RANKED_1V1, rankView } from "@chessroyale/core";
import { BOARD_SEL, REAL_SCREENS, asSignedIn, endGaps, localSql, named, realLayout, realScreenContext, test, watchFor, watchSpans } from "./helpers.ts";

/**
 * Ranked 1 v 1 through the real server (docs/areas/ranked.md), two players on emulated phones (and computers): both
 * queue (one tap: /1v1, as the home screen's button), meet, vote on the time control on the game's own board (a real
 * drag, a tap and a tap), see "Timer: …" over it, and play to a result with real taps on the board: checkmate,
 * resigning, flagging. Ranks move (placements). Also: a first move that never comes aborts as a dodge (ranked's leave
 * rules, L1: the one who didn't move pays, the other nothing), leaving during the vote (the confirm's words, home's note), and
 * the no-opponent fallback (Keep waiting; Play a bot, unranked). Each test queues in a pool of its own (`?pool=`, a
 * test switch), so tests never meet; `clock=` (each side's seconds, a test switch) makes a flag quick, and `fewAfter=`
 * brings the "Few players online" choice forward.
 */

const isComputer = () => test.info().project.name === "desktop";

/** This test's players, by name: on a failure, each one's game and breadcrumbs go into the report. */
let players: [string, Page][] = [];
test.beforeEach(() => {
  players = [];
});

/**
 * A failure's report keeps each player's `window.duel.snapshot()` (the game as that page holds it) and the app's breadcrumbs
 * (`1v1 move e2e4`: a move the page sent), so a lost move shows which side lost it (docs/decisions/2026-11-20-duel-flake-diagnostics.md).
 */
test.afterEach(async ({}, info) => {
  if (info.status === info.expectedStatus) return;
  for (const [name, page] of players) {
    const state = await Promise.race([
      page
        .evaluate(() => {
          const w = window as unknown as { duel?: { snapshot(): unknown } | null; __crumbs?: () => string[] };
          return { at: Date.now(), url: location.href, duel: w.duel?.snapshot() ?? null, crumbs: w.__crumbs?.() ?? null };
        })
        .catch((e: unknown) => ({ error: String(e) })),
      new Promise((r) => setTimeout(() => r({ error: "no answer in 5 s" }), 5000)),
    ]);
    await info.attach(`duel state: ${name}`, { body: JSON.stringify(state, null, 2), contentType: "application/json" });
  }
});

async function player(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext({ ...test.info().project.use })).newPage();
  players.push([name, page]);
  await named(page, name);
  await page.goto("/?nolanding");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  return page;
}

/** Eric's spacing rule on an end page (Nov 25): every gap between two containers the stack's one gap, to 2 px; nothing set to stretch. */
async function expectEvenGaps(page: Page, root: string, at: string) {
  const g = await endGaps(page, root);
  expect(g.token, `${at}: the stack's gap`).toBeGreaterThanOrEqual(8);
  for (const x of g.gaps) expect(Math.abs(x.px - g.token), `${at}: ${x.between}: ${x.px.toFixed(1)} px, not the one gap (${g.token} px)`).toBeLessThanOrEqual(2);
  expect(g.spread, `${at}: nothing spread apart`).toEqual([]);
  expect(g.grow, `${at}: nothing grows to fill`).toEqual([]);
}

/** A pool of this test's own. */
const poolName = () => `d${test.info().project.name.slice(0, 1)}${Math.random().toString(36).slice(2, 9)}`;

/** Your standing with ranked's leave rules, from the server (your profile). */
const leavesOf = (page: Page) => page.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.leaves as { marks: number; dodged: { rp: number } | null } | null));

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

/**
 * Each page's game is on its board (the vote, the "Timer" line or play) and not over: a state that lasts from the vote to the
 * result. (The versus moment lasts 2.5 s and the vote up to 10: a test process slowed for longer missed them, the page went on, and the
 * wait timed out on a game that was fine. The versus moment has its own test, "the stage", below.)
 */
async function inGame(pages: Page[], timeout = 30_000) {
  for (const p of pages)
    await expect
      .poll(
        () =>
          p
            .evaluate(() => {
              const s = (window as unknown as { duel?: { snapshot(): { phase: string; end: unknown } } | null }).duel?.snapshot();
              return s && !s.end ? s.phase : null;
            })
            .catch(() => null),
        { timeout },
      )
      .toMatch(/^(vote|overlay|play)$/);
}

/** Both players queue in `pool` and meet: their game on the board (from the vote on). */
async function meet(a: Page, b: Page, pool: string, extra = "") {
  await a.goto(`/1v1?nolanding&debug&pool=${pool}${extra}`);
  await expect(a.locator(".dv-search")).toContainText("Finding opponent…");
  await b.goto(`/1v1?nolanding&debug&pool=${pool}${extra}`);
  await inGame([a, b]);
}

/** The two players by side, once the board is up. */
async function bySide(a: Page, b: Page): Promise<{ white: Page; black: Page }> {
  return (await sideOf(a)) === "w" ? { white: a, black: b } : { white: b, black: a };
}

/** Waits for play: the overlay gone, the first move due. */
async function waitForPlay(...pages: Page[]) {
  for (const p of pages) await expect(p.locator(".dv-status")).toContainText(/first move/, { timeout: 25_000 });
}

/** Resign (or Leave: an abort) from the match's gear and its list, on a phone or a computer; then confirm. */
async function resign(page: Page, word: "Resign" | "Leave" = "Resign", says?: string) {
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: new RegExp(word) }).click();
  // (The confirm's words: what going now costs in a ranked game, L1.)
  if (says) await expect(page.getByRole("alertdialog")).toContainText(says);
  await page.getByRole("alertdialog").getByRole("button", { name: word }).click();
}

test("two players: one tap to queue, the vote on the game's own board, checkmate with real taps, and both ranks move", { tag: "@phone-only" }, async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const a = await player(browser, "Ann Duel");
  const b = await player(browser, "Bo Duel");
  const pool = poolName();
  await meet(a, b, pool);
  for (const p of [a, b]) await expect(p.locator(".dv-vote")).toBeVisible();

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

  // Bo taps Bullet, his pawn not picked up first, and it goes there (Eric's rule, every pawn vote, Nov 25: docs/rules/eric.md); Ann sees
  // it move live. Then Ann drags hers into Rapid: both in, the vote closes a beat later (RANKED_1V1.voteBothPickedMs), not at its 10 s.
  const overlay = await watchFor(a, { timer: { selector: ".dv-overlay", text: /^Timer: Blitz 3\+2$/ } });
  await expect(b.locator(".vote-me.selected")).toHaveCount(0);
  await b.getByRole("button", { name: "Pick Bullet 1+1" }).click();
  await expect(b.locator(".dv-label.mine")).toHaveText("Bullet 1+1");
  const inZone = async (p: Page, pawn: string, zone: number) => {
    const z = (await p.locator(".vote-zone").nth(zone).boundingBox())!;
    const q = (await p.locator(pawn).boundingBox())!;
    const [x, y] = [q.x + q.width / 2, q.y + q.height * 0.55];
    return x > z.x && x < z.x + z.width && y > z.y && y < z.y + z.height;
  };
  await expect.poll(() => inZone(b, ".vote-me", 0), { message: "Bo's pawn stands in the zone he tapped" }).toBe(true);
  // Ann sees Bo's pawn in Bullet (the zone on her left).
  await expect.poll(() => inZone(a, ".dv-pawn:not(.vote-me)", 0)).toBe(true);
  // (Timed on Ann's page, from her pawn's release to the "Timer" line: the line shows for RANKED_1V1.overlayMs, 1.5 s, and a test
  // process stalled that long on a busy runner once missed it while it waited for it (Nov 26).
  // docs/decisions/2026-11-26-ranked-1v1-timer-line-flake.md.)
  await a.evaluate(() => {
    const w = window as unknown as { __closeAt?: { up?: number; timer?: number } };
    const t = (w.__closeAt = {} as { up?: number; timer?: number });
    window.addEventListener("pointerup", () => (t.up ??= Date.now()), { capture: true });
    const check = () => {
      if (t.timer === undefined && document.querySelector(".dv-overlay")?.textContent === "Timer: Blitz 3+2") t.timer = Date.now();
    };
    new MutationObserver(check).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  const zone = (await a.locator(".vote-zone").nth(2).boundingBox())!;
  const mine = (await a.locator(".vote-me").boundingBox())!;
  await a.mouse.move(mine.x + mine.width / 2, mine.y + mine.height / 2);
  await a.mouse.down();
  await a.mouse.move(zone.x + zone.width / 2, zone.y + zone.height * 0.7, { steps: 8 });
  await a.mouse.up();

  // Rapid and Bullet meet on Blitz: "Timer: Blitz 3+2" over the board, then the game on the same board.
  await waitForPlay(a, b);
  expect((await overlay.seen()).timer).toBe(true);
  const closed = await a.evaluate(() => (window as unknown as { __closeAt: { up?: number; timer?: number } }).__closeAt);
  expect(closed.up, "Ann's release reached her page").toBeDefined();
  expect(closed.timer, "\"Timer: Blitz 3+2\" showed over Ann's board").toBeDefined();
  expect(closed.timer! - closed.up!, "the vote closed a beat after both picks, well before its 10 s").toBeLessThan(RANKED_1V1.voteBothPickedMs + 4_000);
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
  await expect(black.getByTestId("es-title")).toHaveText("Victory!");
  await expect(black.getByTestId("es-line")).toHaveText("Checkmate.");
  await expect(white.getByTestId("es-title")).toHaveText("Defeat");
  // The ranks moved: one placement game each (the server's record).
  for (const p of [white, black]) await expect(p.getByTestId("es-now-rp")).toHaveText("1 of 5 placement games", { timeout: 15_000 });
  // XP (Nov 9): the end page's XP (Nov 20: a ranked game's own page), from the outcome: 2 moves each is too few for anyone.
  for (const p of [white, black]) await expect(p.locator(".es-earned-xp .es-earned-why")).toHaveText("No XP: the game ended before move 10.");
  expect(await record(black)).toMatchObject({ games: 1, wins: 1, losses: 0, rank: { label: "Placement 1/5" } });
  expect(await record(white)).toMatchObject({ games: 1, wins: 0, losses: 1 });
});

test("typed chat in a 1 v 1 (Eric, Nov 25: \"i said hello, it never appeared, twice\"): your own line shows; told when the other doesn't see typed messages; they turn it on mid-game, read it and answer", { tag: "@phone-only" }, async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const a = await player(browser, "Ann Typed");
  const b = await player(browser, "Bo Typed");
  // Both signed in (typing is for accounts); Ann's chat on, Bo's still off.
  for (const p of [a, b]) await asSignedIn(p);
  expect((await a.request.patch("/api/me", { data: { chatOn: true } })).status()).toBe(200);
  await meet(a, b, poolName());
  const field = (p: Page) => p.locator(".dv-chat").getByRole("textbox", { name: "Send a message" });
  await field(a).fill("hello");
  await field(a).press("Enter");
  await expect(a.locator(".dv-chat .qline.you", { hasText: "hello" })).toBeVisible();
  await expect(a.locator(".dv-chat .qtype-note")).toHaveText("Bo Typed doesn't see typed messages, only the quick lines.");
  // Bo turns typed chat on in the match's chat options (the notice once): Ann's line comes, and he can type back.
  await expect(field(b)).toHaveCount(0);
  await b.locator(".dv-chat").getByRole("button", { name: "Chat options" }).click();
  await b.getByRole("checkbox", { name: "Typed chat (players' messages)" }).click();
  await b.getByRole("button", { name: "Turn on chat", exact: true }).click();
  await expect(b.getByRole("checkbox", { name: "Typed chat (players' messages)" })).toBeChecked();
  await b.locator(".dv-chat").getByRole("button", { name: "Chat options" }).click();
  await expect(b.locator(".dv-chat .qline", { hasText: "hello" }).filter({ hasText: "Ann Typed" })).toBeVisible();
  await expect(field(b)).toBeVisible();
  await field(b).fill("hi Ann");
  await field(b).press("Enter");
  await expect(b.locator(".dv-chat .qline.you", { hasText: "hi Ann" })).toBeVisible();
  await expect(a.locator(".dv-chat .qline", { hasText: "hi Ann" }).filter({ hasText: "Bo Typed" })).toBeVisible();
  await expect(b.locator(".dv-chat .qtype-note")).toHaveCount(0);
});

test("resigning, then a flag: Play again queues both again; each game counts", { tag: "@phone-only" }, async ({ browser }) => {
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
  // Before your 3rd move it's a leave (L1); in placements there are no rank points to take, so it goes on the record.
  await resign(white, "Resign", "It counts as a loss, and resigning this early goes on your record.");
  await expect(black.getByTestId("es-title")).toHaveText("Victory!");
  await expect(black.getByTestId("es-line")).toHaveText(/ resigned\.$/);
  await expect(white.getByTestId("es-line")).toHaveText("You resigned.");
  for (const p of [white, black]) await expect(p.getByTestId("es-now-rp")).toHaveText("1 of 5 placement games", { timeout: 15_000 });
  // (Nov 25: a placement counts games, not RP; no quests moved: one line, "Quests  No quests this game".)
  for (const p of [white, black]) {
    // (No RP slot over the placement card: the card alone says it, Nov 25; resigned at move 2, no quests moved: one line.)
    await expect(p.getByTestId("es-earned-rp")).toHaveCount(0);
    await expect(p.getByTestId("es-quests")).toHaveText("Quests No quests this game.", { timeout: 10_000 });
    await expect(p.locator(".dv-result-actions .btn").nth(1)).toHaveText("Home");
  }
  // Eric's spacing rule (Nov 25), phone 390 × 844: one gap between every container of the page, nothing stretched.
  await expectEvenGaps(white, ".screen.dv-end", "phone 390×844");
  expect(await leavesOf(white)).toMatchObject({ marks: 1 });
  expect(await leavesOf(black)).toMatchObject({ marks: 0 });

  // Play again: both back in the queue (the same pool), a new game; this time White's clock runs out.
  const hadBlack = black;
  for (const p of [a, b]) await p.getByRole("button", { name: "Play again" }).click();
  await inGame([a, b]);
  await waitForPlay(a, b);
  ({ white, black } = await bySide(a, b));
  // Colors in turn (Nov 25): who had Black in the first game has White now.
  expect(white).toBe(hadBlack);
  await tapMove(white, "d2d4");
  await expect(black.locator(".dv-status")).toContainText("Your first move", { timeout: 10_000 });
  await tapMove(black, "d7d5");
  // White doesn't move: 6 s later the flag falls (Black has more than a lone king: a loss, not a draw).
  await expect(white.getByTestId("es-title")).toHaveText("Defeat", { timeout: 20_000 });
  await expect(white.getByTestId("es-line")).toHaveText("You ran out of time.");
  await expect(black.getByTestId("es-line")).toHaveText(/ ran out of time\.$/);
  for (const p of [white, black]) await expect(p.getByTestId("es-now-rp")).toHaveText("2 of 5 placement games", { timeout: 15_000 });
});

test("every change is drawn, even in the same millisecond as the last draw (the clock held still from the last move): the result, then the rank", { tag: "@phone-only" }, async ({ browser }) => {
  // (The game screen once redrew by setting the time as its state, and Preact skips a state set to the value it holds: a
  // change in the same millisecond as the clocks' last tick wasn't drawn, and "Updating your rank…" stayed up for good.
  // A held clock makes every change land in the same millisecond. docs/decisions/2026-10-28-two-flaky-tests.md.)
  test.setTimeout(2 * 60_000);
  const a = await player(browser, "Ann Still");
  const b = await player(browser, "Bo Still");
  await meet(a, b, poolName(), "&clock=6");
  await waitForPlay(a, b);
  const { white, black } = await bySide(a, b);
  await tapMove(white, "e2e4");
  await expect(black.locator(".dv-status")).toContainText("Your first move", { timeout: 10_000 });
  await tapMove(black, "e7e5");
  await expect(white.locator(".dv-status")).toHaveText("Your move", { timeout: 10_000 });
  for (const p of [white, black]) await p.clock.setFixedTime(await p.evaluate(() => Date.now()));
  await resign(white);
  await expect(black.getByTestId("es-title")).toHaveText("Victory!");
  await expect(white.getByTestId("es-line")).toHaveText("You resigned.");
  for (const p of [white, black]) await expect(p.getByTestId("es-now-rp")).toHaveText("1 of 5 placement games", { timeout: 15_000 });
});

test("a first move that never comes: the game is aborted, a dodge for the one who didn't move (L1), nothing for the other", { tag: "@phone-only" }, async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const a = await player(browser, "Ann Abort");
  const b = await player(browser, "Bo Abort");
  await meet(a, b, poolName());
  await waitForPlay(a, b);
  const { white, black } = await bySide(a, b);
  // White never moves: 20 s later it's called off.
  await expect(white.locator(".dv-result-title")).toHaveText("Game aborted", { timeout: 35_000 });
  await expect(white.locator(".dv-result-why")).toHaveText("Your first move didn't come in time.");
  await expect(black.locator(".dv-result-why")).toHaveText(/'s first move didn't come in time\. No rank change\.$/);
  // (In placements there are no rank points to take: the dodge only goes on the record.)
  await expect(white.locator(".dv-result-rank")).toHaveText("Left before it started", { timeout: 15_000 });
  await expect(black.locator(".dv-result-rank")).toHaveCount(0);
  expect((await record(white)).games).toBe(0);
  expect((await record(black)).games).toBe(0);
  expect(await leavesOf(white)).toMatchObject({ marks: 1, dodged: { rp: 0 } });
  expect(await leavesOf(black)).toMatchObject({ marks: 0, dodged: null });
});

test("a reload mid-game comes back to the same game, its clocks running; a declined offer, then a draw both agree to", { tag: "@phone-only" }, async ({ browser }) => {
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
    await expect(p.getByTestId("es-title")).toHaveText("A draw");
    await expect(p.getByTestId("es-line")).toHaveText("Draw agreed.");
    await expect(p.getByTestId("es-now-rp")).toHaveText("1 of 5 placement games", { timeout: 15_000 });
  }
  expect(await record(white)).toMatchObject({ games: 1, draws: 1 });
});

test("Leave during the time-control vote: a dodge (L1): the confirm says so, the game is called off, home's note; the other loses nothing", { tag: "@phone-only" }, async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const a = await player(browser, "Ann Leave");
  const b = await player(browser, "Bo Leave");
  // (From the vote: should it close while the menu is open, it's still before the first moves, the same dodge.)
  await meet(a, b, poolName());
  await a.getByRole("button", { name: "Match options" }).click();
  await a.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /Leave/ }).click();
  // The confirm's words: what leaving now costs (in placements, no rank points yet: it goes on the record).
  const confirm = a.getByRole("alertdialog");
  await expect(confirm).toContainText("The game is called off. Leaving before it starts goes on your record.");
  await confirm.getByRole("button", { name: "Leave" }).click();
  await expect(a.locator(".dv-result-title")).toHaveText("Game aborted");
  await expect(a.locator(".dv-result-why")).toHaveText("You left before the first moves.");
  await expect(a.locator(".dv-result-rank")).toHaveText("Left before it started", { timeout: 15_000 });
  await expect(b.locator(".dv-result-title")).toHaveText("Game aborted");
  await expect(b.locator(".dv-result-why")).toHaveText("Ann Leave left before the first moves. No rank change.");
  await expect(b.locator(".dv-result-rank")).toHaveCount(0);
  expect((await record(a)).games).toBe(0);
  expect((await record(b)).games).toBe(0);
  expect(await leavesOf(a)).toMatchObject({ marks: 1, dodged: { rp: 0 } });
  expect(await leavesOf(b)).toMatchObject({ marks: 0, dodged: null });
  // Home: the note at its top says it (dismissed with its X); the other player's home has none.
  await a.locator(".dv-result").getByRole("button", { name: "Home", exact: true }).click();
  const note = a.locator(".fd-notice");
  await expect(note).toHaveText(/You left before the game started/);
  await note.getByRole("button", { name: "Dismiss" }).click();
  await expect(note).toHaveCount(0);
  await b.locator(".dv-result").getByRole("button", { name: "Home", exact: true }).click();
  await expect(b.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(b.locator(".fd-notice")).toHaveCount(0);
});

test("nobody to play: the search's Cancel, then Few players online: Keep waiting, or a bot (unranked)", { tag: "@phone-only" }, async ({ browser }) => {
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
  // Found: Bo's pawn on the right platform, his name and rank under it, "VS" between; nothing else on the stage moved. And Bo sees the
  // same from his side, himself on the left and Ann on the right, read at once: the stage holds only the versus moment (2.5 s), and
  // read after Ann's checks below it was once gone on a slow runner (main 3fba12e3, desktop).
  await Promise.all([
    expect(stage.locator(".dv-st-them .dv-st-name")).toHaveText("Bo Stage", { timeout: 20_000 }),
    expect(b.locator(".dv-st-you .dv-st-name")).toHaveText("Bo Stage", { timeout: 20_000 }),
    expect(b.locator(".dv-st-them .dv-st-name")).toHaveText("Ann Stage", { timeout: 20_000 }),
  ]);
  await expect(stage.locator(".dv-st-them .dv-st-pawn .avatar")).toBeVisible();
  await expect(stage.locator(".dv-st-them .dv-st-rank")).toHaveText("Placement 0/5");
  await expect(stage.locator(".dv-st-vs")).toHaveText("VS");
  await expect(stage.locator(".dv-st-line")).toHaveText(/^You play (White|Black)$/);
  await expect(stage.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  const found = await stageBoxes(a);
  expect(found).toEqual(before);
  await expect(a.locator('.dv-st-you .dv-st-pawn[data-kept="1"]')).toHaveCount(1);

  // It holds for the game's versus moment, then the board loads with the vote on it, and the stage is gone.
  await expect(a.locator(".dv-vote")).toBeVisible({ timeout: 10_000 });
  await expect(a.locator(".dv-stage")).toHaveCount(0);
  const s = await spans.spans();
  const held = s.versus!.last - s.versus!.first;
  expect(held).toBeGreaterThan(RANKED_1V1.versusMs - 1000);
  expect(held).toBeLessThan(RANKED_1V1.versusMs + 500);
  expect(s.board!.first).toBeGreaterThan(s.versus!.last);
});

test("ranks in the game (Eric, Nov 25: \"the emblem next to everyone... click on someone's rank and then it shows the list of rankings\"): an emblem by both names, its box there in placements too; a tap opens Ranks with that rank marked; ✕ and Escape close it", async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  const a = await player(browser, "Ann Ranks");
  const b = await player(browser, "Bo Ranks");
  // Bo placed in Gold III (ladder 1000: Gold's 800, two divisions up, 40 RP); Ann still in placements.
  const bo = ((await (await b.request.get("/api/me")).json()) as { user: { id: string } }).user.id;
  await localSql(b, `INSERT OR REPLACE INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_at, streak) VALUES ('${bo}', 1500, 80, 12, 7, 5, 0, 1000, 1, 0)`);
  await meet(a, b, poolName());
  const strip = (who: "you" | "them") => a.locator(`.dv-strip.dv-${who}`);
  await expect(strip("them").locator(".dv-rank")).toHaveText("Gold III – 40");
  await expect(strip("them").locator(".dv-strip-emblem .re-box")).toHaveAttribute("data-emblem", "gold-d3");
  // (Placements: the emblem's box at its size, empty, as on the stage: nothing moves when a rank arrives.)
  await expect(strip("you").locator(".dv-strip-emblem .re-box")).not.toHaveAttribute("data-emblem", /./);
  for (const who of ["you", "them"] as const) {
    const box = (await strip(who).locator(".dv-strip-emblem").boundingBox())!;
    const s = (await strip(who).boundingBox())!;
    expect([box.width, box.height, s.height]).toEqual([24, 24, 34]);
  }
  // Tap Bo's rank: every rank, the highest first, then Placement; Gold III marked with his name, in view.
  await strip("them").getByRole("button", { name: /^Bo Ranks: Gold III – 40/ }).click();
  const sheet = a.getByRole("dialog", { name: "Ranks" });
  await expect(sheet.locator(".rk-row")).toHaveCount(RANKED_1V1.tiers.length * RANKED_1V1.divisions + RANKED_1V1.topTiers.length + 1);
  await expect(sheet.locator(".rk-row").first()).toContainText("Transcendent");
  await expect(sheet.locator(".rk-row").last()).toContainText("Placement");
  const marked = sheet.locator('.rk-row[aria-current="true"]');
  await expect(marked).toHaveCount(1);
  await expect(marked).toContainText(/Gold III\s*≈ 1350–1390 Elo\s*Bo Ranks\s*960 RP/);
  // (Eric, Nov 27: a rough Elo by every rank; the top tiers from their floor.)
  await expect(sheet.locator(".rk-row").first()).toContainText("≈ 2400+ Elo");
  await expect(sheet).toContainText("Each rank's Elo is a rough approximation.");
  // (Only the list scrolls to it: the title and ✕ stay in view.)
  await expect(marked).toBeInViewport({ ratio: 1 });
  await expect(sheet.getByRole("heading", { name: "Ranks" })).toBeInViewport({ ratio: 1 });
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
  // Your own: Placement marked. Escape closes it.
  await strip("you").getByRole("button", { name: /^You: Placement 0\/5/ }).click();
  await expect(sheet.locator('.rk-row[aria-current="true"]')).toContainText(/Placement\s*You/);
  await a.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});

test("the stage fits: 320, 360 and 390 px phones (a computer at 1280), the longest names and ranks, no sideways scroll", async ({ browser }) => {
  test.setTimeout(2 * 60_000);
  // The widest a name (16 characters) and a rank can be ("Transcendent – 1199", with its emblem), for both players:
  // your own from the server's answer, the opponent's (and the game's timing, held in the versus moment) from the game's.
  const WIDE = "WWWWWWWWWWWWWWWW";
  const gm = rankView({ games: 40, ladder: RANKED_1V1.topFloor + 1199, place: 1 });
  expect(gm.label).toBe("Transcendent – 1199");
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
              const sel = ".dv-st-head h2, .dv-st-spot, .dv-st-emblem, .dv-st-name, .dv-st-rank, .dv-st-finding, .dv-st-vs, .dv-st-line, .dv-few, .dv-few .btn, .dv-cancel";
              for (const e of document.querySelectorAll<HTMLElement>(sel)) {
                const r = e.getBoundingClientRect();
                const name = `${e.className} "${e.textContent?.slice(0, 20)}"`;
                if (r.left < -0.5 || r.right > vw + 0.5) bad.push(`${name}: sideways ${Math.round(r.left)}-${Math.round(r.right)} of ${vw}`);
                if (r.top < -0.5 || r.bottom > vh + 0.5) bad.push(`${name}: below ${Math.round(r.bottom)} of ${vh}`);
                if (e.scrollWidth > e.clientWidth + 1 && !e.classList.contains("dv-st-spot") && !e.classList.contains("re-box")) bad.push(`${name}: cut ${e.scrollWidth} > ${e.clientWidth}`);
              }
              // The names, ranks and emblems never under "VS".
              const vs = document.querySelector(".dv-st-vs")?.getBoundingClientRect();
              if (vs)
                for (const e of document.querySelectorAll(".dv-st-name, .dv-st-rank, .dv-st-emblem")) {
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
  await expect(a.locator(".dv-st-you .dv-st-rank")).toHaveText("Transcendent – 1199");
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

/**
 * Real screens (Nov 25; docs/decisions/2026-11-25-real-screens.md, 2026-11-25-end-screens-2.md; e2e/helpers.ts REAL_SCREENS): a ranked
 * game and its end page on a 1080p laptop at 125% (Eric's, 1536 × 730), at 150% (1280 × 600), a 768p laptop (1366 × 650) and a desktop
 * (1920 × 960), each at its own device scale. In play: nothing scrolls, the chat beside the board shows at least 120 px of messages. The
 * end page is the game's own screen with its right column swapped (Eric, Nov 25: "the chat box on the end game screen should not now
 * suddenly be to the left of the board when it's to the right during the game"): nothing scrolls either way, the board where it was and
 * the same size, the moves' stepper in your strip; the right column flush with the board (its top and foot the board's, Nov 25's frame),
 * holding the result ("Defeat" in view),
 * the placement card ("1 of 5 placement games", no RP slot over it), the quests in one line, Play again and Home stacked the column's
 * width, then the chat to the foot with its post-game lines ("GG", "Well played", "Thanks!", "Rematch?").
 */
test("real screens (Nov 25): a ranked game and its end page on laptop 1536×730, 1280×600, 1366×650 and desktop 1920×960", async ({ browser }) => {
  test.skip(!isComputer(), "a computer only; it opens its own windows");
  test.setTimeout(8 * 60_000);
  for (const s of REAL_SCREENS) {
    const at = `the ${s.name}`;
    const open = async (name: string) => {
      const page = await (await realScreenContext(browser, s)).newPage();
      players.push([name, page]);
      await named(page, name);
      await page.goto("/?nolanding");
      await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
      return page;
    };
    const a = await open(`Ann ${s.width}`);
    const b = await open(`Bo ${s.width}`);
    await meet(a, b, poolName());
    await waitForPlay(a, b);
    const { white, black } = await bySide(a, b);
    await tapMove(white, "e2e4");
    await expect(black.locator(".dv-status")).toContainText("Your first move", { timeout: 10_000 });
    await tapMove(black, "e7e5");
    await expect(white.locator(".dv-status")).toHaveText("Your move", { timeout: 10_000 });
    const g = await realLayout(white);
    expect(g.scrollX, `${at}, in play: no scrolling across`).toBeLessThanOrEqual(0);
    expect(g.scrollY, `${at}, in play: no scrolling down`).toBeLessThanOrEqual(0);
    expect(g.cut, `${at}, in play: nothing cut off at the top`).toEqual([]);
    expect(g.feeds.length, `${at}, in play: the chat`).toBe(1);
    expect(g.feeds[0], `${at}, in play: the chat's messages`).toBeGreaterThanOrEqual(120);
    // The frame (Nov 25, mockup round 2): no title line, the board the window's height less the two strips (to its 8 device pixel step), the
    // panel's top and foot the board's, the gear level with the top strip, "Your move" in your strip.
    const f = await white.evaluate(() => {
      const r = (q: string) => document.querySelector(q)!.getBoundingClientRect();
      return { box: r(".dv-side > .dv-box"), gear: r(".dv-gear .mm-more"), top: r(".dv-strip.dv-them"), menu: r(".gm-frame > .fd-side"), chip: !!document.querySelector(".dv-strip.dv-you .dv-status"), title: document.querySelectorAll(".screen.game > .hud-row").length };
    });
    expect(f.title, `${at}, in play: no title line`).toBe(0);
    expect(s.height - 108 - g.board!.h, `${at}, in play: the board (${g.board!.h}) the window's height less 108`).toBeLessThan(8);
    // (Eric's column rule, Nov 25 round 2: every column on the board's top and bottom lines and the gaps either side of the board equal, ±1 px.
    // Were ±1.5 for the lines; the gaps were 55 and 70 at 1536 × 730.)
    expect(Math.abs(f.box.top - g.board!.y), `${at}, in play: the panel's top the board's`).toBeLessThanOrEqual(1);
    expect(Math.abs(f.box.bottom - g.board!.b), `${at}, in play: the panel's foot the board's`).toBeLessThanOrEqual(1);
    const gaps = { left: g.board!.x - f.menu.right, right: f.box.left - g.board!.r };
    expect(Math.abs(gaps.left - gaps.right), `${at}, in play: the gaps either side of the board equal (${gaps.left} v ${gaps.right})`).toBeLessThanOrEqual(1);
    expect(Math.abs(f.gear.top + f.gear.height / 2 - (f.top.top + f.top.height / 2)), `${at}, in play: the gear level with the top strip`).toBeLessThanOrEqual(1.5);
    expect(f.chip, `${at}, in play: "Your move" in your strip`).toBe(true);
    await resign(white);
    await expect(white.getByTestId("es-title")).toHaveText("Defeat");
    await expect(white.getByTestId("es-now-rp")).toHaveText("1 of 5 placement games", { timeout: 15_000 });
    await expect(white.getByTestId("es-quests")).toHaveText("Quests No quests this game.", { timeout: 10_000 });
    await white.waitForTimeout(500);
    const e = await realLayout(white);
    expect(e.scrollX, `${at}, the end page: no scrolling across`).toBeLessThanOrEqual(0);
    expect(e.scrollY, `${at}, the end page: no scrolling down`).toBeLessThanOrEqual(0);
    expect(e.cut, `${at}, the end page: nothing cut off at the top`).toEqual([]);
    expect(Math.abs(e.board!.h - g.board!.h), `${at}, the end page: the board the game's size (${e.board!.h} v ${g.board!.h})`).toBeLessThanOrEqual(1);
    expect(Math.abs(e.board!.y - g.board!.y) + Math.abs(e.board!.x - g.board!.x), `${at}, the end page: the board where the game's was`).toBeLessThanOrEqual(2);
    const m = await white.evaluate(() => {
      const r = (q: string) => document.querySelector(q)!.getBoundingClientRect();
      const btns = [...document.querySelectorAll(".dv-end-col .dv-result-actions .btn")].map((x) => x.getBoundingClientRect());
      const lines = [...document.querySelectorAll(".dv-end-col .qgroup-lines:not(.emoji) .qchip")].map((x) => x.textContent);
      return { col: r(".dv-end-col"), menu: r(".gm-frame > .fd-side"), area: r(".board-area"), title: r(".es-title"), feed: r(".dv-end-col .qfeed"), btns: btns.map((x) => ({ x: x.left, y: x.top, w: x.width, h: x.height })), lines, steps: !!document.querySelector(".dv-strip.dv-you [data-testid=dv-steps]") };
    });
    expect(m.title.top, `${at}, the end page: "Defeat" in view`).toBeGreaterThanOrEqual(0);
    expect(m.col.left, `${at}, the end page: the column right of the board`).toBeGreaterThan(m.area.right);
    expect(Math.abs(m.col.top - e.board!.y), `${at}, the end page: the column's top the board's`).toBeLessThanOrEqual(1);
    expect(Math.abs(m.col.bottom - e.board!.b), `${at}, the end page: the column's foot the board's`).toBeLessThanOrEqual(1);
    expect(Math.abs(e.board!.x - m.menu.right - (m.col.left - e.board!.r)), `${at}, the end page: the gaps either side of the board equal`).toBeLessThanOrEqual(1);
    expect(m.steps, `${at}, the end page: the moves' stepper in your strip`).toBe(true);
    expect(m.btns.length).toBe(2);
    expect(m.btns[1]!.y, `${at}, the end page: Play again and Home stacked`).toBeGreaterThan(m.btns[0]!.y + m.btns[0]!.h - 1);
    expect(Math.abs(m.btns[0]!.w - m.col.width), `${at}, the end page: the column's width`).toBeLessThanOrEqual(1);
    expect(m.lines, `${at}, the end page: the post-game lines`).toEqual(["GG", "Well played", "Thanks!", "Rematch?"]);
    expect(m.feed.height, `${at}, the end page: the chat's messages`).toBeGreaterThanOrEqual(40);
    await expect(white.getByTestId("es-earned-rp")).toHaveCount(0);
    // Eric's spacing rule (Nov 25): one gap between every container of the right column, nothing stretched, the block centered.
    await expectEvenGaps(white, ".dv-end-col", s.name);
    for (const p of [a, b]) await p.context().close();
  }
});
