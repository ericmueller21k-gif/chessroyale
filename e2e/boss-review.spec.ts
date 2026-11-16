import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";
import { bossAloneFromHome } from "./helpers.ts";

/**
 * A boss battle's result page (Eric, round 2, after his screenshot of the boss's picture over "You resigned"):
 * - the title is never behind the boss's picture: the flag, the title, the picture, then "Timber won.", for every boss (the tall
 *   ones too: Jefferson, Big Boy, Ginger here);
 * - the review is one board, stepped with ◀ ▶ (and ← → on a computer), starting on move 1, and the board never moves;
 * - alone (a boss battle with nobody else), the review has no "Everyone's average loss" and no "found" count;
 * - a computer's result page has no gear (its side bar has Settings); a phone keeps it.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const plies = (p: Page) =>
  p.evaluate(() => {
    const m = (window as any).match;
    return m.runner.boards.get(m.runner.state.boards[0]).history.length;
  });

/** A boss battle alone: `moves` moves by the engine's best, then a resign (it counts as a loss); the result page shows. */
async function playAndResign(page: Page, boss: string, moves: number) {
  await page.goto(`/?debug&clock=60&boss=${boss}`);
  await bossAloneFromHome(page);
  for (let k = 0; k < moves; k++) {
    await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
    const move: string = await page.evaluate(async () => {
      const m = (window as any).match;
      const [top] = await m.runner.topMovesFor(m.phase.board.fen);
      return top.move;
    });
    const before = await plies(page);
    await page.evaluate((mv) => (window as any).match.submit(mv), move);
    await expect.poll(() => plies(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(before + 2);
  }
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await page.getByRole("button", { name: "Match options" }).first().click();
  await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^Resign$/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Resign/ }).click();
  await expect.poll(() => phase(page), { timeout: 10_000 }).toBe("results");
  await expect(page.locator(".results h1")).toHaveText("You resigned");
}

test("a boss's picture never covers the title: the flag, the title, the picture, then the result line (Ginger, Jefferson, Big Boy)", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  for (const boss of ["gingerbread", "grex", "bigboy"]) {
    await playAndResign(page, boss, 0);
    const [title, picture, result] = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      return [r(".results h1"), r(".results .boss-char-sprite"), r(".results .team-result")];
    });
    // Nothing intersects: the picture starts under the title, and the result line under the picture.
    expect(picture.top, `${boss}: the picture under the title`).toBeGreaterThanOrEqual(title.bottom);
    expect(result.top, `${boss}: the result line under the picture`).toBeGreaterThanOrEqual(picture.bottom - 1);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  }
});

test("a boss battle alone: one board stepped with ◀ ▶ (and ← →), starting on move 1, the board never moves; no 'Everyone', no 'found'", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  await playAndResign(page, "gingerbread", 2);
  const phone = test.info().project.name === "phone";
  // One board, no move list.
  await expect(page.locator(".breakdown.inline .breakdown-move")).toHaveCount(0);
  await expect(page.locator(".breakdown.inline .bm-board-wrap")).toHaveCount(1);
  // Alone: you play alone, so the review says nothing of everyone.
  await expect(page.locator(".breakdown.inline .bm-text")).not.toContainText("Everyone");
  await expect(page.locator(".bm-step")).not.toContainText("found");
  // The gear: a computer's side bar has Settings, so the result page has no gear there; a phone keeps it.
  if (phone) await expect(page.getByRole("button", { name: "Match options" })).toBeVisible();
  else await expect(page.getByRole("button", { name: "Match options" })).toHaveCount(0);
  // Starts on move 1: ◀ greyed.
  const step = page.locator(".bm-step-text");
  const prev = page.getByRole("button", { name: "Previous move" });
  const next = page.getByRole("button", { name: "Next move" });
  const total = Number((await step.innerText()).match(/of (\d+)/)![1]);
  expect(total).toBeGreaterThanOrEqual(2);
  await expect(step).toHaveText(new RegExp(`^Move 1 of ${total} · `));
  await expect(prev).toBeDisabled();
  await expect(next).toBeEnabled();
  // The stepper at the top of the view, so a tap doesn't scroll the page: the board's box is compared on screen.
  await page.locator(".bm-step").evaluate((el) => el.scrollIntoView({ block: "start" }));
  const place = () =>
    page.evaluate(() => {
      const b = document.querySelector(".bm-board-wrap")!.getBoundingClientRect();
      const s = document.querySelector(".bm-step")!.getBoundingClientRect();
      return { board: [b.x, b.y, b.width, b.height].map(Math.round), step: [s.x, s.y, s.width, s.height].map(Math.round) };
    });
  const first = await place();
  await next.click();
  await expect(step).toHaveText(new RegExp(`^Move 2 of ${total} · `));
  await expect(prev).toBeEnabled();
  expect(await place(), "▶ keeps the board's place").toEqual(first);
  await prev.click();
  await expect(step).toHaveText(new RegExp(`^Move 1 of ${total} · `));
  expect(await place(), "◀ keeps the board's place").toEqual(first);
  // The arrow keys step too (and the last move greys ▶).
  await page.keyboard.press("ArrowRight");
  await expect(step).toHaveText(new RegExp(`^Move 2 of ${total} · `));
  for (let i = 3; i <= total; i++) await page.keyboard.press("ArrowRight");
  await expect(step).toHaveText(new RegExp(`^Move ${total} of ${total} · `));
  await expect(next).toBeDisabled();
  expect(await place(), "the last move: the board's place").toEqual(first);
  await page.keyboard.press("ArrowLeft");
  await expect(step).toHaveText(new RegExp(`^Move ${total - 1} of ${total} · `));
  expect(await place(), "← keeps the board's place").toEqual(first);
  // The review is on the page, centered, and the stepper is as wide as the board.
  const [board, bar, text] = await Promise.all([
    page.locator(".breakdown.inline .bm-board-wrap").boundingBox(),
    page.locator(".breakdown.inline .bm-step").boundingBox(),
    page.locator(".breakdown.inline .bm-text").boundingBox(),
  ]);
  expect(bar!.width).toBeCloseTo(board!.width, 0);
  expect(text!.width).toBeCloseTo(board!.width, 0);
  expect(bar!.x + bar!.width / 2).toBeCloseTo(board!.x + board!.width / 2, 0);
  // The result stopped: no timer, no move brings anything back.
  expect(await phase(page)).toBe("results");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
});
