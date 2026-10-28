import { expect, type Page } from "@playwright/test";
import { BOARD_SEL, bossAloneFromHome, test } from "./helpers.ts";

/**
 * A boss beside the board on a computer stands clear of it (Eric, Oct 28: Folio "behind the board when idling";
 * docs/decisions/2026-10-28-folio-desktop-fixes.md): with no eval bar, as every player's board is, the drawn pixels of its
 * idle (not its frame, which has room around the drawing) stop short of the board's left edge. The bosses whose drawings
 * reach furthest toward the board: Folio's wing, Wrangler's lasso, Hollow, Sawyer, Smudgy and Jefferson.
 */

const WIDE = ["folio", "pig", "hollow", "sawyer", "smudgy", "grex"];

/** The board's left edge less the rightmost drawn pixel of the boss's idle, the most it reaches over 2 s (its frames move). */
async function gap(page: Page): Promise<number> {
  let least = Infinity;
  for (let i = 0; i < 10; i++) {
    const g = await page.evaluate((sel) => {
      const c = document.querySelector<HTMLCanvasElement>(".boss-char.place-side .boss-char-sprite")!;
      const board = document.querySelector(sel)!.getBoundingClientRect();
      const box = c.getBoundingClientRect();
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let right = -1;
      for (let y = 0; y < c.height; y++) for (let x = c.width - 1; x > right; x--) if (d[(y * c.width + x) * 4 + 3]! > 0) right = x;
      return board.left - (box.left + ((right + 1) * box.width) / c.width);
    }, BOARD_SEL.wrap);
    least = Math.min(least, g);
    await page.waitForTimeout(200);
  }
  return least;
}

for (const boss of WIDE) {
  test(`${boss} beside the board stands clear of it, no eval bar`, async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "the boss stands beside the board on a computer only");
    await page.addInitScript(() => localStorage.setItem("brc.evalBar", "0"));
    await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=${boss}`);
    await bossAloneFromHome(page);
    await expect.poll(() => page.evaluate(() => (window as any).match?.phase.kind ?? "none"), { timeout: 60_000 }).toBe("play");
    await expect(page.locator(".boss-char.place-side .boss-char-sprite")).toBeVisible();
    expect(await gap(page)).toBeGreaterThanOrEqual(0);
  });
}
