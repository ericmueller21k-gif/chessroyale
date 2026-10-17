import { expect, type Page } from "@playwright/test";
import { BOARD_SEL, test, bossAloneFromHome } from "./helpers.ts";

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
/** The character the player sees (one placement shows per layout: the boss bar on a phone, by the board on a computer). */
const visibleChar = (p: Page) => p.locator(".boss-char:visible").first();
const anim = (p: Page) => visibleChar(p).getAttribute("data-anim").catch(() => null);

test("Boingo the Clown: a raid boss as a character, across the board from the God King, on phone and computer", async ({ page }, info) => {
  test.setTimeout(6 * 60_000);
  const phone = info.project.name === "phone";
  await page.goto("/?debug&pace=quick&clock=20&bossMoves=3");
  await bossAloneFromHome(page, "Boingo the Clown");
  await page.getByRole("dialog", { name: "Boss alone" }).getByRole("button", { name: /Boingo the Clown/ }).click();

  // His entrance, with his portrait on the card instead of an emoji.
  await expect(page.locator(".boss-intro .boss-portrait")).toBeVisible({ timeout: 30_000 });
  await expect(visibleChar(page)).toHaveAttribute("data-anim", "entrance");
  await expect(page.locator(phone ? ".boss-char.place-bar" : ".boss-char.place-side")).toBeVisible();
  await expect(page.locator(phone ? ".boss-char.place-side" : ".boss-char.place-bar")).toBeHidden();

  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  // He never takes a tap and never covers the board: on a phone he's in the boss bar above it, the God King on a line of
  // his own under the dock's row, in its middle (Eric, Oct 15); on a computer he's by its bottom-left corner and the God
  // King mirrors him by its bottom-right (Eric, Oct 11), the status box under the board at its width.
  const char = visibleChar(page);
  expect(await char.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
  expect(await char.locator("canvas").evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
  const box = (await char.boundingBox())!;
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  const king = (await page.locator(".gk-unit").first().boundingBox())!;
  if (phone) {
    expect(box.y + box.height).toBeLessThanOrEqual(board.y);
    expect(box.x + box.width / 2).toBeLessThan(board.x + board.width / 2);
    const row = (await page.locator(".boss-dock-main").boundingBox())!;
    expect(king.y).toBeGreaterThanOrEqual(row.y + row.height);
    expect(Math.abs(king.x + king.width / 2 - (board.x + board.width / 2))).toBeLessThanOrEqual(1);
  } else {
    expect(box.x + box.width).toBeLessThanOrEqual(board.x);
    expect(box.y + box.height).toBeGreaterThan(board.y + board.height / 2);
    // His figure (the button): right of the board, his middle as far from it as the boss's, their feet level.
    const fig = (await page.locator(".gk-unit .gk-unit-btn").first().boundingBox())!;
    const wrap = (await page.locator(".board-wrap").first().boundingBox())!;
    expect(fig.x).toBeGreaterThanOrEqual(board.x + board.width);
    expect(Math.abs(fig.x + fig.width / 2 - (wrap.x + wrap.width) - (wrap.x - (box.x + box.width / 2)))).toBeLessThanOrEqual(2);
    expect(Math.abs(fig.y + fig.height - (box.y + box.height))).toBeLessThanOrEqual(2);
    const status = (await page.locator(".boss-dock-main").boundingBox())!;
    expect(status.y).toBeGreaterThanOrEqual(wrap.y + wrap.height);
    expect(Math.abs(status.x - wrap.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(status.width - wrap.width)).toBeLessThanOrEqual(2);
    // In a narrower window (900 to 1099 px, no leaderboard) he's drawn at 1× and stays whole inside it, clear of the
    // board (Eric, Oct 14: at 1024 px half of him was off the window's left edge).
    for (const [width, height] of [[1024, 768], [900, 1000]] as const) {
      await page.setViewportSize({ width, height });
      await expect.poll(async () => (await char.boundingBox())?.width).toBe(48);
      const sprite = (await char.locator("canvas").boundingBox())!;
      const narrow = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
      expect(sprite.x, `${width}×${height}`).toBeGreaterThanOrEqual(0);
      expect((await char.boundingBox())!.x + 48).toBeLessThanOrEqual(narrow.x);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  // Taps on the board's corner by him still reach the board.
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest(".boss-char") === null, [board.x + 4, board.y + 4]);
  expect(hit).toBe(true);

  // Play it out (the engine's move each turn) and watch what he does: he thinks, moves, and takes his bow.
  const seen = new Set<string>();
  const stopAt = Date.now() + 4 * 60_000;
  while (Date.now() < stopAt) {
    const p = await phase(page);
    const a = await anim(page);
    if (a) seen.add(a);
    if (p === "results") break;
    if (p === "play") {
      await page
        .evaluate(async () => {
          const m = (window as any).match;
          if (m.phase.kind !== "play") return;
          const top = await Promise.race([m.runner.topMovesFor(m.phase.board.fen), new Promise((r) => setTimeout(() => r(null), 12000))]);
          const move = top ? (top as any)[0].move : [...(m.runner.planned?.values() ?? [])][0];
          if (m.phase.kind === "play" && move) m.submit(move);
        })
        .catch(() => undefined);
    }
    await page.waitForTimeout(120);
  }
  expect(await phase(page)).toBe("results");
  expect(seen.has("thinking")).toBe(true);
  expect([...seen].some((a) => ["move", "capture", "check"].includes(a))).toBe(true);
  // The results: his bow, in step with the result.
  const result = await page.evaluate(() => (window as any).match.runner.state.boss.result);
  const bow = page.locator(".boss-char.place-results");
  await expect(bow).toBeVisible();
  await expect(bow).toHaveAttribute("data-anim", ({ crowd: "defeat", boss: "victory", draw: "idle" } as Record<string, string>)[result]!);
  await page.screenshot({ path: info.outputPath(`clown-results-${info.project.name}.png`) });
});
