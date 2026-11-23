import { expect, type Page } from "@playwright/test";
import { asAdmin, tapInTown, test, townReady } from "./helpers.ts";

/**
 * Birdie's Station (Nov 23; docs/areas/town-square.md, "Birdie's Station"), on a phone and a computer, as an admin (Birdie is in the game
 * for admins first): his card out front, its Challenge alone open and his hello as you tap him; in through the doors to the lobby, the
 * bartender pigeon the Shopkeeper; the split-flap board written by the game (the town's buildings, never the Hidden Boss's), its flaps
 * turning now and then. Then his challenge at the middle table: his hello as he says his line, the board's pop, his wipe.
 * Test hooks: the room's canvas (`data-room`, `data-ready`), `__shopAt`, `__shopFlaps()`, `__shopIntro()`, `__soundLog`.
 */
test.use({ actionTimeout: 15_000 });

type Hooks = {
  __soundLog?: string[];
  __shopAt?: (k: string, s?: [number, number]) => { x: number; y: number } | null;
  __shopFlaps?: () => { title: string; rows: string[] } | null;
  __shopIntro?: () => { step: string } | null;
  __birdieSteps?: string[];
};
const room = (p: Page) => p.locator("canvas.town-shop-canvas");
const sounds = (p: Page) => p.evaluate(() => (window as unknown as Hooks).__soundLog ?? []);
const flaps = (p: Page) => p.evaluate(() => (window as unknown as Hooks).__shopFlaps?.() ?? null);

async function birdieCard(page: Page) {
  const card = page.getByRole("dialog", { name: "Birdie", exact: true });
  await tapInTown(page, "boss", "birdie", card);
  return card;
}

test("Birdie's Station: his card and hello out front; in to the lobby, the bartender at the bar, the flip board writing the town", async ({ page }) => {
  test.setTimeout(120_000);
  await asAdmin(page);
  await page.addInitScript(() => ((window as unknown as Hooks).__soundLog = []));
  await page.goto("/town?sky=day");
  await townReady(page);
  const card = await birdieCard(page);
  await expect(card.getByRole("button", { name: "Challenge alone" })).toBeEnabled();
  // (His hello, as you tap him: boss-select.ts SELECT_SOUND, #901.)
  await expect.poll(async () => (await sounds(page)).some((l) => l.startsWith("birdieHello:"))).toBe(true);
  await page.keyboard.press("Escape");
  const home = page.getByRole("dialog", { name: "Birdie's Station", exact: true });
  await tapInTown(page, "home", "birdie", home);
  await home.getByRole("button", { name: "Go in" }).click();
  await expect(room(page)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  await expect(room(page)).toHaveAttribute("data-room", "birdie");
  await expect(page.locator(".area-banner .area-banner-title")).toHaveText("BIRDIE'S STATION");
  // The board: a title, four rows of the same flaps, the town's buildings by their names; never the Hidden Boss's walk-up.
  const first = (await flaps(page))!;
  expect(["DEPARTURES", "ARRIVALS"]).toContain(first.title);
  expect(first.rows).toHaveLength(4);
  for (const r of first.rows) {
    expect(r).toHaveLength(first.rows[0]!.length);
    expect(r).toMatch(/^\d\d:\d\d /);
    expect(r).not.toMatch(/WALK/);
  }
  // The bartender's card, from the floor past the bar's stools.
  await expect.poll(() => page.evaluate(() => (window as unknown as Hooks).__shopAt?.("keeper") ?? null)).not.toBeNull();
  const xy = (await page.evaluate(() => (window as unknown as Hooks).__shopAt!("keeper")))!;
  const cv = (await room(page).boundingBox())!;
  await page.mouse.click(cv.x + xy.x, cv.y + xy.y);
  const keeper = page.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(keeper).toBeVisible({ timeout: 15_000 });
  // (Its flaps turn now and then: a row's status every few seconds.)
  await expect.poll(async () => JSON.stringify(await flaps(page)), { timeout: 20_000 }).not.toBe(JSON.stringify(first));
});

test("his challenge: his hello as he says his line at the middle table, the board's pop, his wipe @phone-only", async ({ page }) => {
  test.setTimeout(180_000);
  await asAdmin(page);
  await page.addInitScript(() => {
    const w = window as unknown as Hooks;
    w.__soundLog = [];
    w.__birdieSteps = [];
    const tick = () => {
      const s = w.__shopIntro?.();
      if (s && w.__birdieSteps!.at(-1) !== s.step) w.__birdieSteps!.push(s.step);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto("/town?sky=day&introPreview=1");
  await townReady(page);
  const card = await birdieCard(page);
  await card.getByRole("button", { name: "Challenge alone" }).click();
  await page.getByRole("dialog", { name: "Challenge Birdie?" }).getByRole("button", { name: "Fight" }).click();
  await expect(page.locator('canvas.boss-storm[data-boss="birdie"][data-covered="1"]')).toBeAttached({ timeout: 90_000 });
  const steps = await page.evaluate(() => (window as unknown as Hooks).__birdieSteps ?? []);
  expect(steps).toEqual(expect.arrayContaining(["face", "line", "board", "table"]));
  expect(steps.indexOf("line")).toBeLessThan(steps.indexOf("board"));
  const log = await sounds(page);
  // (His hello twice: the tap on him out front, and his line at the table; then the board's pop.)
  expect(log.filter((l) => l.startsWith("birdieHello:")).length).toBeGreaterThanOrEqual(2);
  expect(log.some((l) => l.startsWith("pop:"))).toBe(true);
});
