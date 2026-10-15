import { expect, test, type Page } from "@playwright/test";
import { BOARD_SEL, soloFromHome } from "./helpers.ts";

/**
 * Clicks a move on the main board: tap the piece (again if nothing was picked up: the board takes moves a moment
 * after its countdown ends), then the target square.
 */
async function clickMove(page: Page, uci: string) {
  const wrap = page.locator(`.board-area ${BOARD_SEL.wrap}`).first();
  const box = (await wrap.boundingBox())!;
  const black = ((await wrap.getAttribute("class")) ?? "").includes("orientation-black");
  const at = (sq: string) => {
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    const x = black ? 7 - f : f;
    const y = black ? r : 7 - r;
    return { x: box.x + ((x + 0.5) * box.width) / 8, y: box.y + ((y + 0.5) * box.height) / 8 };
  };
  const from = at(uci.slice(0, 2));
  const to = at(uci.slice(2, 4));
  const picked = page.locator(`.board-area ${BOARD_SEL.square}.selected`);
  await expect(async () => {
    if (!(await picked.count())) await page.mouse.click(from.x, from.y);
    await expect(picked).toHaveCount(1, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await page.mouse.click(to.x, to.y);
  if (uci.length === 5) await page.getByRole("button", { name: "Queen" }).click();
}

/** The engine's best move for the position on screen (debug hook). */
async function bestMove(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const m = (window as any).match;
    const fen = m.phase.board.fen;
    // The same search the round is scored with, and its highest-scoring line, so this really is the best move (the
    // judge rates each pick by its line's score). That's usually the first line, but not always: when the node budget
    // runs out partway through a depth, lines not yet searched again keep the last depth's score.
    const top: { move: string; expected: number }[] = await m.runner.topMovesFor(fen);
    return top.reduce((best, line) => (line.expected > best.expected ? line : best)).move;
  });
}

/**
 * Starts the engine's searches of the boards as they stand after a round (MatchRunner.prefetch: the next round reuses
 * them to score with), and with `wait`, waits for those of the boards still in play. Started in a stage's last reveal
 * and waited for at the stage break, while no clock runs (the break waits for your tap), they make the best move known
 * when the next round's clock starts: the test's engine lookup isn't the player's thinking time. (A cut drops boards,
 * never swaps them, so these are the next stage's boards and positions.)
 */
async function searchBoards(page: Page, wait = false) {
  await page.evaluate(async (wait) => {
    const r = (window as any).match.runner;
    r.prefetch();
    if (wait) await Promise.all(r.state.boards.map((id: number) => r.topMovesFor(r.boards.get(id).fen)));
  }, wait);
}

/** In a reveal, a tap moves on once the chosen move has played (the screen says so); else it moves on by itself. */
async function tapThroughReveal(page: Page) {
  const prompt = page.locator(".reveal").getByText("Tap to continue");
  await expect.poll(async () => (await prompt.isVisible()) || (await phase(page)) !== "reveal", { intervals: [100], timeout: 10_000 }).toBe(true);
  if (await prompt.isVisible()) await page.locator(".screen").click();
}

async function phase(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).match?.phase.kind ?? "none");
}

async function start(page: Page, query: string) {
  await page.goto(`/?debug&mode=classic&${query}`);
  await soloFromHome(page);
  await expect(page.getByRole("heading", { name: "Today's openings" })).toBeVisible();
}

test("strong play is never cut on a tie, the 2v2 final is played (with your turns when you're in it), and results show", async ({ page }) => {
  // Before Oct 15 a tie at a cut went to less thinking time, and this test's player (the engine's best, found ahead)
  // always won those ties, so it always reached the final. Now everyone tied with the last player through goes through,
  // and only the last cut breaks a tie (docs/decisions/2026-10-15-opening-allowance-and-ties.md). With one round a stage
  // (rounds=1) a stage's score is one round against one board's group, so whole groups tie exactly, and what the ties
  // leave over is owed by the later cuts: reaching the final then turns on the luck of the groups (measured headless:
  // rarely at one round a stage; at Classic's own 8 and 5 rounds a stage, every time). So this asserts the rule itself: you're never cut
  // while tied with, or above, the last player through, except at the last cut; the final is played; if you're in it,
  // you get turns.
  test.setTimeout(240_000);
  await start(page, "rounds=1&clock=20&pace=quick");
  let finalTurns = 0;
  // Every alive player's exact stage score just before each cut, and whether it was the last cut before the final.
  let before: { scores: Record<string, number>; last: boolean } | null = null;
  for (let i = 0; i < 3000; i++) {
    const p = await phase(page);
    if (p === "results") break;
    if (p === "play") {
      if (await page.evaluate(() => !!(window as any).match.final)) finalTurns++;
      // Moves are possible once the new board's settling-in countdown is over.
      await expect(page.locator(".cc-banner", { hasText: "Round start" })).toHaveCount(0, { timeout: 10_000 });
      await clickMove(page, await bestMove(page));
      await expect.poll(() => phase(page)).not.toBe("play");
    } else if (p === "reveal") {
      // (One round a stage: every reveal ends one.) The exact scores the cut is about to go by.
      before = await page.evaluate(() => {
        const m = (window as any).match;
        const st = m.runner.state;
        if (st.final) return null;
        const scores = Object.fromEntries(st.players.filter((x: any) => x.alive).map((x: any) => [x.id, x.stageScore]));
        return { scores, last: st.stage >= m.settings.knockoutsPerStage.length - 1 };
      });
      await searchBoards(page);
      await tapThroughReveal(page);
    } else if (p === "stageBreak") {
      await expect(page.locator(".tower-row").first()).toBeVisible();
      const brk = await page.evaluate(() => {
        const ph = (window as any).match.phase;
        return { youOut: ph.youOut as boolean, out: ph.knockedOut.map((x: any) => x.id) as string[] };
      });
      if (brk.youOut && before) {
        // Out: strictly below everyone who went through (to the last bit), unless this was the last cut.
        const through = Object.keys(before.scores).filter((id) => !brk.out.includes(id));
        const line = Math.min(...through.map((id) => before!.scores[id]!));
        if (!before.last) expect(before.scores.you!, "cut while tied with or above the last player through").toBeLessThanOrEqual(line - 1e-9);
      }
      // The test's next moves are found now, not on the player's clock (on a busy machine that took up to 10 s).
      await searchBoards(page, true);
      await page.getByRole("button", { name: /Next stage|See how it ends/ }).click();
    } else if (p === "final") {
      // Watching the final shows the teams (unless your turn has already come up meanwhile).
      await expect
        .poll(async () => (await phase(page)) !== "final" || (await page.locator(".final-teams").isVisible()))
        .toBe(true);
      await page.waitForTimeout(300);
    } else {
      await page.waitForTimeout(200);
    }
  }
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  await expect(page.locator(".results h1")).toContainText(/of 64/);
  // The 2v2 final was played (four finalists, placed 1st to 4th); if you were in it, you got turns.
  const final = await page.evaluate(() => {
    const st = (window as any).match.runner.state;
    return { order: (st.final?.order ?? []) as string[], places: st.players.filter((p: any) => (st.final?.order ?? []).includes(p.id)).map((p: any) => p.placement).sort() };
  });
  expect(final.order).toHaveLength(4);
  expect(final.places).toEqual([1, 2, 3, 4]);
  if (final.order.includes("you")) expect(finalTurns).toBeGreaterThan(0);
});

test("missing every move gets you knocked out; the match plays out and shows results", async ({ page }) => {
  await start(page, "rounds=2&clock=3&pace=quick");
  // Once you're out, the rest of the match (every stage and the final) is played out at the engines' speed: about
  // 30 s here, more on a busy machine. So the loop runs to a deadline, not a count of looks (200 left about 3 s over).
  const stopAt = Date.now() + 4 * 60_000;
  while (Date.now() < stopAt) {
    const p = await phase(page);
    if (p === "results") break;
    if (p === "reveal") {
      await expect(page.locator(".round-score")).toContainText("-25");
      await tapThroughReveal(page);
    } else if (p === "stageBreak") {
      await expect(page.locator(".out-msg")).toBeVisible();
      await page.getByRole("button", { name: "See how it ends" }).click();
    } else {
      await page.waitForTimeout(250);
    }
  }
  await expect(page.locator(".results h1")).toContainText(/(5[7-9]|6[0-4])(st|nd|rd|th) of 64/);
});
