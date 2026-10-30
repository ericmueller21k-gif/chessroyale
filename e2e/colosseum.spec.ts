import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * Inside the Colosseum, the first look (Oct 30; docs/areas/colosseum.md): the town's Colosseum card links in, the arena draws
 * (WebGL 2), Change seat changes the view, a bot game plays on the floor and the next one starts, the overlay's pieces are
 * there, and Exit goes back to the town. Phone and computer. Headless WebGL is software (a few frames a second): the checks
 * wait on the game's state, never on a frame rate.
 */

test.use({ actionTimeout: 15_000 });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
});

type Hooks = {
  __colosseum: {
    state: () => { view: number; backend: string; drawCalls: number; crowd: number; game: number; plies: number; status: string };
    seat: (i: number) => void;
    flag: () => void;
    sample: () => { sky: number; hash: number } | null;
  };
};
// (Before the page's chunk has loaded there's no hook yet: an empty state, and the polls wait.)
const state = (p: Page) => p.evaluate(() => (window as unknown as Partial<Hooks>).__colosseum?.state() ?? ({} as ReturnType<Hooks["__colosseum"]["state"]>));
const sample = (p: Page) => p.evaluate(() => (window as unknown as Partial<Hooks>).__colosseum?.sample() ?? null);

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

test("the Colosseum's first look: the card's link in, the arena drawn, Change seat, a bot game and the next, the overlay, Exit back to the town", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);

  // The way in: the town's Colosseum card keeps what it had, plus the link.
  await page.goto("/town");
  await expect(page.locator("canvas.town-canvas")).toHaveAttribute("data-ready", "1");
  const gate = (await page.evaluate(() => (window as unknown as { __townAt: (k: string) => { x: number; y: number } | null }).__townAt("coliseum")))!;
  expect(gate, "the Colosseum is drawn at the start").not.toBeNull();
  const cv = (await page.locator("canvas.town-canvas").boundingBox())!;
  await page.mouse.click(cv.x + gate.x, cv.y + gate.y);
  const card = page.getByRole("dialog", { name: "The Colosseum", exact: true });
  await expect(card.getByRole("button", { name: "Raids with people" })).toBeDisabled();
  const look = card.getByRole("link", { name: "Look inside (preview)" });
  await expect(look).toHaveAttribute("href", "/colosseum");
  await look.click();
  await expect(page).toHaveURL(/\/colosseum$/);
  await expect(page.getByRole("heading", { name: "The Colosseum" })).toBeVisible();

  // Again with `?fast` (the bots move at once, the next game comes quickly): the arena draws, with its crowd, in three draw calls.
  await page.goto("/colosseum?fast");
  await expect.poll(async () => (await state(page)).crowd, { message: "the crowd is in", timeout: 60_000 }).toBeGreaterThan(1500);
  const s0 = await state(page);
  expect(s0.backend).toBe("webgl");
  await expect.poll(async () => (await state(page)).drawCalls, { message: "three draw calls a frame" }).toBe(3);
  const a = (await sample(page))!;
  expect(a.sky, "the arena, not an empty sky").toBeLessThan(0.5);

  // Change seat: another seat, another picture.
  await page.getByRole("button", { name: "Change seat" }).click();
  await expect.poll(async () => (await state(page)).view).not.toBe(s0.view);
  expect((await state(page)).view).toBeLessThan(8);
  const b = (await sample(page))!;
  expect(b.hash).not.toBe(a.hash);

  // A bot game plays (moves on the floor and in the overlay); ended at once, the next starts.
  await expect.poll(async () => (await state(page)).plies, { message: "the bots play", timeout: 90_000 }).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".col-moves li").first()).toContainText("1.");
  const game = (await state(page)).game;
  await page.evaluate(() => (window as unknown as Hooks).__colosseum.flag());
  await expect(page.locator(".col-status")).toContainText(/wins on time\. Next game soon\./);
  await expect.poll(async () => (await state(page)).game, { message: "the next game starts", timeout: 30_000 }).toBe(game + 1);
  await expect.poll(async () => (await state(page)).plies, { message: "and plays", timeout: 90_000 }).toBeGreaterThanOrEqual(1);

  // The overlay: each player's card (portrait, name, ELO, the pieces taken, the clock), the middle, the board with its eval bar, the chat's box.
  for (const side of ["w", "b"]) {
    const c = page.locator(`.col-card[data-side="${side}"]`);
    await expect(c.locator(".col-pic")).toBeVisible();
    await expect(c.locator(".col-name")).toContainText("(bot)");
    await expect(c.locator(".col-elo")).toHaveText(/^ELO \d{3,4}$/);
    await expect(c.getByLabel("Pieces taken")).toBeAttached();
    await expect(c.locator(".col-clock")).toHaveText(/^\d:\d\d(\.\d)?$/);
  }
  await expect(page.locator(".col-turn")).toHaveText(/^Turn \d+$/);
  await expect(page.locator(".col-viewers")).toHaveText(/^\d\.\dK$/);
  await expect(page.getByLabel("Last moves").locator("li")).toHaveCount(4);
  await expect(page.locator(".col-board")).toBeVisible();
  await expect(page.locator(".col-eval")).toBeVisible();
  await expect(page.getByRole("region", { name: "Chat" })).toBeVisible();
  // Nothing hidden, nothing shifts: the cards and the board keep their place from move to move.
  const box1 = await page.locator(".col-board").boundingBox();
  const plies = (await state(page)).plies;
  await expect.poll(async () => (await state(page)).plies, { timeout: 60_000 }).toBeGreaterThan(plies);
  expect(await page.locator(".col-board").boundingBox()).toEqual(box1);

  // The gear: Sound, Ambient crowd noise (a switch, no sound yet), Report a bug.
  await page.getByRole("button", { name: "Match options" }).click();
  const panel = page.getByRole("dialog", { name: "Match options" });
  await expect(panel.getByRole("switch", { name: /Sound/ })).toBeVisible();
  const amb = panel.getByRole("switch", { name: /Ambient crowd noise/ });
  await expect(amb).toHaveAttribute("aria-checked", "true");
  await amb.click();
  await expect(amb).toHaveAttribute("aria-checked", "false");
  await expect(panel.getByRole("button", { name: /Report a bug/ })).toBeVisible();
  await page.keyboard.press("Escape");

  // The player views (`?view=white` / `black`): Black's turns the flat board round.
  await page.goto("/colosseum?view=black");
  await expect.poll(async () => (await state(page)).view).toBe(9);
  await expect(page.locator(".col-board .hb, .col-board [class*='board']").first()).toBeVisible();

  // Exit: back to the town.
  await page.getByRole("button", { name: "Exit" }).click();
  await expect(page).toHaveURL(/\/town$/);
  await expect(page.locator("canvas.town-canvas")).toHaveAttribute("data-ready", "1");
  expect(errors.filter((e) => !/WebGL|GPU stall|willReadFrequently/i.test(e))).toEqual([]);
});

test("the 3D pieces behind ?pieces=3d: drawn instanced (a draw call a kind on the board), moving with the game; without the switch, the flat pieces", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  const pieces = async () => ((await state(page)) as { pieces?: string }).pieces;
  await page.goto("/colosseum?pieces=3d&fast");
  await expect.poll(async () => (await state(page)).crowd, { message: "the crowd is in", timeout: 60_000 }).toBeGreaterThan(1500);
  expect((await state(page)).backend).toBe("webgl");
  expect(await pieces()).toBe("3d");
  // The arena's three, and one a kind: all six kinds stand on the board at the start.
  await expect.poll(async () => (await state(page)).drawCalls, { message: "three draw calls and one a piece kind" }).toBe(9);
  const a = (await sample(page))!;
  expect(a.sky, "the arena, not an empty sky").toBeLessThan(0.5);
  // The game plays on: the draw calls stay one a kind on the board.
  await expect.poll(async () => (await state(page)).plies, { message: "the bots play", timeout: 90_000 }).toBeGreaterThanOrEqual(4);
  expect((await state(page)).drawCalls).toBeLessThanOrEqual(9);
  expect((await state(page)).drawCalls).toBeGreaterThanOrEqual(5);

  // Without the switch: the flat pieces, three draw calls, as before.
  await page.goto("/colosseum");
  await expect.poll(async () => (await state(page)).crowd, { timeout: 60_000 }).toBeGreaterThan(1500);
  expect(await pieces()).toBe("flat");
  await expect.poll(async () => (await state(page)).drawCalls).toBe(3);
  expect(errors.filter((e) => !/WebGL|GPU stall|willReadFrequently/i.test(e))).toEqual([]);
});
