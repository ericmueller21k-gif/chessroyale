import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { test } from "./helpers.ts";

// Hollow, the Darkness boss, is drawn before his power rules exist: he never shows in a battle, only in a test link
// (?wip=1&kit=Hollow) that puts his kit in the boss's place, and `&power=` previews a moment over the real board
// (components/WipPreview.tsx). The rules PR replaces these with the real thing.

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

async function meet(page: Page, power: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?debug&clock=60&wip=1&kit=Hollow&power=${power}`);
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await page.getByRole("dialog", { name: "Choose your boss" }).getByRole("button", { name: /Boingo the Clown/ }).click();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  return errors;
}

/** A square's middle on screen. */
async function squareAt(page: Page, square: string) {
  const board = (await page.locator("cg-board").first().boundingBox())!;
  const flip = (await page.evaluate(() => (window as any).match.boss?.crowdSide)) === "b";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
}

test("Hollow: only a test link shows him, and his dark squares hide a piece but never take a tap", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const errors = await meet(page, "dark");
  // His drawing in the boss's place (his frame is 104 px wide), never taking a tap.
  const char = page.locator(".boss-char:visible").first();
  await expect(char.locator("canvas")).toHaveAttribute("width", "104");
  // The dark is drawn on one canvas over the board, which takes no taps.
  const dark = page.locator(".wip-preview canvas[data-fx='board']");
  await expect(dark).toBeVisible();
  expect(await dark.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
  // A crowd piece under a thinning dark square: it's hidden (the square's middle is the cloud's, not the piece's), and
  // tapping it still picks it up, so it moves.
  const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  const thin = (await page.locator(".wip-preview").getAttribute("data-squares"))!.split(" ").find((x) => x.endsWith(":thin"))!.split(":")[0]!;
  const move = new Chess(fen).moves({ verbose: true }).find((m) => m.from === thin);
  const p = await squareAt(page, thin);
  const covered = await dark.evaluate((c: HTMLCanvasElement, [x, y]) => {
    const r = c.getBoundingClientRect();
    const px = c.getContext("2d")!.getImageData(Math.floor(((x! - r.left) / r.width) * c.width), Math.floor(((y! - r.top) / r.height) * c.height), 1, 1).data;
    return px[3];
  }, [p.x, p.y]);
  expect(covered).toBe(255);
  expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest("cg-board, cg-container"), [p.x, p.y])).toBe(true);
  if (move) {
    await page.mouse.click(p.x, p.y);
    const q = await squareAt(page, move.to);
    await page.mouse.click(q.x, q.y);
    await expect.poll(async () => page.evaluate((b) => (window as any).match.phase.board?.fen !== b || (window as any).match.phase.kind !== "play", fen), { timeout: 30_000 }).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("Hollow's Lights out: the whole board goes dark, every square still under a tap, and the lights come back", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const errors = await meet(page, "lightsout");
  const night = page.locator(".wip-preview canvas[data-fx='board']");
  // He leaves his spot for the board's top edge (his usual spot is hidden meanwhile)...
  await expect(page.locator(".power-moment canvas[data-fx='hollow']")).toBeVisible({ timeout: 5000 });
  await expect(page.locator(".boss-char").first()).toBeHidden();
  // ...and smashes the bulbs: then every square is night (opaque), and a tap at any square reaches the board.
  const dim = async () =>
    night.evaluate((c: HTMLCanvasElement) => {
      const g = c.getContext("2d")!;
      let opaque = 0;
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) if (g.getImageData(f * 32 + 16, r * 32 + 16, 1, 1).data[3] === 255) opaque++;
      return opaque;
    });
  await expect.poll(dim, { timeout: 8000 }).toBe(64);
  for (const sq of ["a1", "h8", "e4", "d5"]) {
    const p = await squareAt(page, sq);
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest("cg-board, cg-container"), [p.x, p.y]), sq).toBe(true);
  }
  // The lights come back: the night lifts from every square.
  await expect.poll(dim, { timeout: 25_000, intervals: [250] }).toBe(0);
  expect(errors).toEqual([]);
});
