import { expect, type Page } from "@playwright/test";
import { legalMoves } from "@chessroyale/chess";
import { test, submitMove } from "./helpers.ts";

/**
 * The Battle Tower's solo screens (PR 10; docs/areas/battle-tower.md): the tower's screen at /tower (only the town's clerk opens it),
 * a run started, floor 1 won with the test switch (?win=1: Qxf7 mates), floor 2's two bosses on the split bar, a reload mid-floor
 * rejoining the same position, a counted leave ending the run; a free leave before your 2nd move; no Last Stand on a floor.
 */

const phase = (page: Page) => page.evaluate(() => (window as any).match?.phase?.kind ?? null);
const fen = (page: Page) => page.evaluate(() => (window as any).match?.phase?.board?.fen ?? null);
const moves = (page: Page) => page.evaluate(() => (window as any).match?.boss?.crowdMoves ?? null);

/** Your turn (the play phase), then a move of yours played: the first the bosses' powers allow (any legal one when none limit it). */
async function playAMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  const at = await page.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board.fen as string, allowed: (m.runner.crowdAllowed() as string[] | null) ?? null };
  });
  const quiet = ["e2e4", "d2d4", "g1f3", "b1c3", "e2e3", "d2d3", "c2c3", "h2h3", "a2a3"];
  const allowed = at.allowed ?? legalMoves(at.fen);
  await submitMove(page, quiet.find((m) => allowed.includes(m)) ?? allowed[0], at.fen);
}

async function towerScreen(page: Page) {
  await expect(page.getByRole("heading", { name: "Battle Tower", exact: true })).toBeVisible({ timeout: 30_000 });
}

test("a run: floor 1 won, floor 2's two bosses on the bar, a reload rejoins the same position, a counted leave ends the run", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await page.goto("/tower?debug&pace=quick&win=1");
  await towerScreen(page);
  // No run yet: START A RUN, "Start a new run" greyed (nothing hidden), Party greyed.
  await expect(page.getByRole("region", { name: "Your run" })).toContainText("No run yet");
  await expect(page.getByRole("button", { name: "Start a new run" })).toBeDisabled();
  await expect(page.getByRole("radio", { name: /Party/ })).toBeDisabled();
  await page.getByRole("button", { name: "START A RUN" }).click();
  // Floor 1: one boss, the strip over the battle. Qxf7 mates (?win=1).
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect(page.locator(".tw-strip").first()).toContainText("Floor 1 of 99");
  await submitMove(page, "h5f7");
  const won = page.locator('[data-tower-result="won"]');
  await expect(won).toContainText("Floor 1 cleared!", { timeout: 120_000 });
  const cont = won.getByRole("button", { name: "Continue" });
  // (Greyed while the result's pictures play and the server answers; then on.)
  await expect(cont).toBeEnabled({ timeout: 20_000 });
  await expect(won.getByRole("button", { name: "Stop here (saved)" })).toBeEnabled();
  await cont.click();
  // Floor 2: two bosses, the bar split in two, one lit to move.
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect(page.locator(".tw-strip").first()).toContainText("Floor 2 of 99");
  await expect(page.locator(".tw-bar .tw-part")).toHaveCount(2);
  await expect(page.locator(".tw-bar .tw-part.tw-to-move")).toHaveCount(1);
  // A move, the bosses' reply, then a reload: the same position, rejoined at once from the tower's screen.
  await playAMove(page);
  await expect.poll(async () => (await phase(page)) === "play" && (await moves(page)) === 1, { timeout: 90_000 }).toBe(true);
  const before = await fen(page);
  await page.reload();
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  expect(await fen(page)).toBe(before);
  expect(await moves(page)).toBe(1);
  await expect(page.locator(".tw-bar .tw-part")).toHaveCount(2);
  // A second move: leaving now counts as a loss (the confirm says so), and the run ends.
  await playAMove(page);
  await expect.poll(async () => (await phase(page)) === "play" && (await moves(page)) === 2, { timeout: 90_000 }).toBe(true);
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("button", { name: "Resign" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("counts as a loss");
  await page.getByRole("alertdialog").getByRole("button", { name: "Resign" }).click();
  const out = page.locator('[data-tower-result="out"]');
  await expect(out).toContainText("Your run ended on floor 2.", { timeout: 30_000 });
  await expect(out).toContainText("Best solo: floor 1", { timeout: 20_000 });
  await out.getByRole("button", { name: "Back to the tower" }).click();
  await towerScreen(page);
  await expect(page.getByRole("region", { name: "Your run" })).toContainText("No run yet");
  await expect(page.locator(".tw-bests")).toContainText("Floor 1");
});

test("no Last Stand on a floor (?laststand=1 forces one elsewhere); leaving before your 2nd move is free and keeps the floor", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await page.addInitScript(() => {
    const w = window as any;
    w.__kinds = [];
    setInterval(() => {
      const k = w.match?.phase?.kind;
      if (k && w.__kinds[w.__kinds.length - 1] !== k) w.__kinds.push(k);
    }, 50);
  });
  await page.goto("/tower?debug&pace=quick&laststand=1");
  await towerScreen(page);
  await page.getByRole("button", { name: "START A RUN" }).click();
  await playAMove(page);
  await expect.poll(async () => (await phase(page)) === "play" && (await moves(page)) === 1, { timeout: 90_000 }).toBe(true);
  // (Alone, a Last Stand is the one reveal: none came.)
  const kinds: string[] = await page.evaluate(() => (window as any).__kinds);
  expect(kinds).not.toContain("reveal");
  expect(await page.evaluate(() => (window as any).match.boss.lastStand)).toBeNull();
  // One move made: Leave is free (the confirm says so), back to the tower, the same floor waiting.
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("button", { name: "Leave the match" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("free before your 2nd move");
  await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
  await towerScreen(page);
  await expect(page.getByRole("button", { name: "CONTINUE FLOOR 1" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Your run" })).toContainText("saved");
});
