import { expect, type Locator, type Page } from "@playwright/test";
import { BOARD_SEL, named, soloFromHome, test } from "./helpers.ts";

/**
 * Settings → Board → Board colors (Eric, Oct 18): Classic, Green or Gold for the dark squares, on this device only.
 * Pick Green → a match's board has green dark squares (the computed color, and what's really painted) → a reload keeps it
 * → Classic again gives today's colors back. Nothing about it reaches the server.
 */
const CLASSIC = { dark: "rgb(192, 173, 144)", light: "rgb(240, 217, 181)" };
const GREEN = { dark: "rgb(143, 179, 107)", light: "rgb(240, 217, 181)" };
const GOLD = { dark: "rgb(232, 182, 64)", light: "rgb(240, 217, 181)" };

const choice = (page: Page) => page.getByRole("radiogroup", { name: "Board colors" });
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

/** The dark squares' ground and the light squares' layer over it, as the stylesheet computes them. */
const squareColors = (board: Locator) =>
  board.evaluate((el) => ({ dark: getComputedStyle(el).backgroundColor, light: getComputedStyle(el, "::before").backgroundColor }));

/** What's painted at the middle of an empty dark square (column 0, row 3 from the top, either way up) and an empty light one (column 1, row 3). */
async function painted(page: Page, board: Locator): Promise<{ dark: string; light: string }> {
  const png = (await board.screenshot()).toString("base64");
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    const at = (col: number) => {
      const [r, g, b] = ctx.getImageData(Math.round(((col + 0.5) * bmp.width) / 8), Math.round((3.5 * bmp.height) / 8), 1, 1).data;
      return `rgb(${r}, ${g}, ${b})`;
    };
    return { dark: at(0), light: at(1) };
  }, png);
}

/** Settings: pick `name` and see it marked. */
async function pick(page: Page, name: "Classic" | "Green" | "Gold") {
  await page.goto("/settings?debug");
  await choice(page).getByRole("radio", { name }).click();
  await expect(choice(page).getByRole("radio", { checked: true })).toHaveAccessibleName(name);
}

/** A solo Crowd match, at your first turn: its board. */
async function matchBoard(page: Page): Promise<Locator> {
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=2&clock=60&augments=0");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  const board = page.locator(BOARD_SEL.squares).first();
  await expect(board).toBeVisible();
  return board;
}

test("board colors: pick Green and a match's dark squares are green, a reload keeps it, Classic gives today's colors back", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await named(page, "Painter");
  const requests: string[] = [];
  page.on("request", (r) => r.method() !== "GET" && requests.push(`${r.method()} ${r.url()} ${r.postData() ?? ""}`));

  // The choice: three boards side by side, Classic marked until someone picks, each preview in its own colors.
  await page.goto("/settings?debug");
  await expect(choice(page).getByRole("radio")).toHaveText(["Classic", "Green", "Gold"]);
  await expect(choice(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Classic");
  const previews = choice(page).locator(".bc-preview");
  expect(await previews.evaluateAll((els) => els.map((e) => ({ dark: getComputedStyle(e).backgroundColor, light: getComputedStyle(e, "::before").backgroundColor })))).toEqual([CLASSIC, GREEN, GOLD]);
  // (Side by side, on a phone too: one row.)
  const tops = await choice(page).getByRole("radio").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  // Today's board until a pick.
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-board-colors"))).toBe("classic");

  // Green: marked at once, kept on this device only.
  await choice(page).getByRole("radio", { name: "Green" }).click();
  await expect(choice(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Green");
  expect(await page.evaluate(() => [document.documentElement.getAttribute("data-board-colors"), localStorage.getItem("brc.boardColors")])).toEqual(["green", "green"]);

  // A match: its board's dark squares are the green, the light ones as ever (what the stylesheet computes, and what's painted).
  let board = await matchBoard(page);
  expect(await squareColors(board)).toEqual(GREEN);
  await expect.poll(() => painted(page, board)).toEqual(GREEN);

  // A reload: still Green (the page carries it before anything is drawn; Settings marks it).
  await page.goto("/settings?debug");
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-board-colors"))).toBe("green");
  await expect(choice(page).getByRole("radio", { checked: true })).toHaveAccessibleName("Green");

  // Classic again: today's colors.
  await pick(page, "Classic");
  board = await matchBoard(page);
  expect(await squareColors(board)).toEqual(CLASSIC);
  await expect.poll(() => painted(page, board)).toEqual(CLASSIC);

  // Only this device: nothing about it was sent to the server.
  expect(requests.filter((r) => /boardColors|board-colors|brc\.board/i.test(r))).toEqual([]);
});
