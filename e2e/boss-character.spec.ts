import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
/** The character the player sees (one placement shows per layout: the boss bar on a phone, by the board on a computer). */
const visibleChar = (p: Page) => p.locator(".boss-char:visible").first();
const anim = (p: Page) => visibleChar(p).getAttribute("data-anim").catch(() => null);

test("Boingo the Clown: a raid boss as a character, kitty-corner from the God King, on phone and computer", async ({ page }, info) => {
  test.setTimeout(6 * 60_000);
  const phone = info.project.name === "phone";
  await page.goto("/?debug&pace=quick&clock=20&bossMoves=3");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await page.getByRole("dialog", { name: "Choose your boss" }).getByRole("button", { name: /Boingo the Clown, 1600/ }).click();

  // His entrance, with his portrait on the card instead of an emoji.
  await expect(page.locator(".boss-intro .boss-portrait")).toBeVisible({ timeout: 30_000 });
  await expect(visibleChar(page)).toHaveAttribute("data-anim", "entrance");
  await expect(page.locator(phone ? ".boss-char.place-bar" : ".boss-char.place-side")).toBeVisible();
  await expect(page.locator(phone ? ".boss-char.place-side" : ".boss-char.place-bar")).toBeHidden();

  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  // He never takes a tap and never covers the board: on a phone he's in the boss bar above it (the God King is under
  // it on the right); on a computer he's by its bottom-left corner (the God King by its top-right).
  const char = visibleChar(page);
  expect(await char.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
  expect(await char.locator("canvas").evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
  const box = (await char.boundingBox())!;
  const board = (await page.locator("cg-board").first().boundingBox())!;
  const king = (await page.locator(".gk-unit").first().boundingBox())!;
  if (phone) {
    expect(box.y + box.height).toBeLessThanOrEqual(board.y);
    expect(king.y).toBeGreaterThanOrEqual(board.y + board.height - 1);
    expect(box.x + box.width / 2).toBeLessThan(board.x + board.width / 2);
    expect(king.x + king.width / 2).toBeGreaterThan(board.x + board.width / 2);
  } else {
    expect(box.x + box.width).toBeLessThanOrEqual(board.x);
    expect(box.y + box.height).toBeGreaterThan(board.y + board.height / 2);
    expect(king.x).toBeGreaterThanOrEqual(board.x + board.width);
    expect(king.y + king.height / 2).toBeLessThan(board.y + board.height / 2);
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
