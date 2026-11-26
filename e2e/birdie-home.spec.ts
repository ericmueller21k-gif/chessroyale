import { expect, type Page } from "@playwright/test";
import { asAdmin, tapInTown, test, townReady } from "./helpers.ts";

/**
 * Birdie's Station (Nov 23; docs/areas/town-square.md, "Birdie's Station"), on a phone and a computer, as an admin (Birdie is in the game
 * for admins first): his card out front, its Challenge alone open and his hello as you tap him; in through the doors to the lobby, the
 * bartender pigeon the Shopkeeper; the split-flap board written by the game (the town's buildings, never the Hidden Boss's), its flaps
 * turning now and then. Then his challenge at the middle table: his hello as he says his line, the board's pop, his wipe; his crossing gates
 * idle as you walk in, then lowering and flashing from the marks (round 4, Nov 23).
 * Test hooks: the room's canvas (`data-room`, `data-ready`), `__shopAt`, `__shopFlaps()`, `__shopIntro()`, `__soundLog`.
 */
test.use({ actionTimeout: 15_000 });

type Hooks = {
  __soundLog?: string[];
  __shopAt?: (k: string, s?: [number, number]) => { x: number; y: number } | null;
  __shopFlaps?: () => { title: string; rows: string[] } | null;
  __shopIntro?: () => { step: string; plays: Record<string, string> | null; looks: 1 | 0 | -1 | null } | null;
  __birdieSteps?: string[];
  __birdieGates?: string[];
  __birdieLooks?: string[];
  __birdieBirds?: () => { n: number; shown: number; flying: number; fled: number; near: boolean } | null;
  __townReport?: (raw?: boolean) => { state: string; raw: { flags: number[]; ups: number[]; bakes: number[] } | null } | null;
};
const room = (p: Page) => p.locator("canvas.town-shop-canvas");
const sounds = (p: Page) => p.evaluate(() => (window as unknown as Hooks).__soundLog ?? []);
const flaps = (p: Page) => p.evaluate(() => (window as unknown as Hooks).__shopFlaps?.() ?? null);

async function birdieCard(page: Page) {
  const card = page.getByRole("dialog", { name: "Birdie", exact: true });
  await tapInTown(page, "boss", "birdie", card);
  return card;
}

test("Birdie's Station: his card and hello out front; in to the lobby, the bartender at the bar, the flip board writing the town; the birds at the bar fly off as you walk up to it, the room uploading and painting nothing new (Nov 26)", async ({ page }) => {
  test.setTimeout(120_000);
  await asAdmin(page);
  await page.addInitScript(() => ((window as unknown as Hooks).__soundLog = []));
  await page.goto("/town?sky=day&report");
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
  await expect.poll(() => page.evaluate(() => (window as unknown as Hooks).__birdieBirds?.()?.n ?? 0)).toBe(50);
  const birds0 = await page.evaluate(() => (window as unknown as Hooks).__birdieBirds?.() ?? null);
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
  // (Nov 26) The birds at the bar (shops/birdie-birds.ts): on show as you came in; walked up to the bar, every one has flown off. And the
  // room's frames, from the walk in to the bar, uploaded and painted nothing (`?report`; the town's lesson #969: bake it all at load).
  expect(birds0!.shown).toBeGreaterThan(birds0!.n * 0.5);
  await expect.poll(() => page.evaluate(() => (window as unknown as Hooks).__birdieBirds?.() ?? null)).toMatchObject({ near: true, shown: 0, fled: 50 });
  // (Recording since the walk to his door, 30 s at most: finished now if it's still going.)
  if ((await page.evaluate(() => (window as unknown as Hooks).__townReport?.()?.state)) === "rec") await page.locator(".tfr-pill button").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as Hooks).__townReport?.()?.state)).toBe("done");
  const rep = (await page.evaluate(() => (window as unknown as Hooks).__townReport!(true)))!.raw!;
  const ROOM = 256; // (frame-report.ts F.room)
  const inRoom = rep.flags.map((f, i) => (f & ROOM ? i : -1)).filter((i) => i >= 0);
  expect(inRoom.length).toBeGreaterThan(30);
  expect(inRoom.reduce((a, i) => a + rep.ups[i]! + rep.bakes[i]!, 0), "pictures uploaded or painted in the room").toBe(0);
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
    w.__birdieGates = [];
    w.__birdieLooks = [];
    const tick = () => {
      const s = w.__shopIntro?.();
      if (s && w.__birdieSteps!.at(-1) !== s.step) w.__birdieSteps!.push(s.step);
      const g = s?.plays ? `${s.step}:${Object.values(s.plays).join(",")}` : null;
      if (g && w.__birdieGates!.at(-1) !== g) w.__birdieGates!.push(g);
      const lk = s && s.step !== "walk" ? `${s.step}:${s.looks}` : null;
      if (lk && w.__birdieLooks!.at(-1) !== lk) w.__birdieLooks!.push(lk);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto("/town?sky=day&introPreview=1");
  await townReady(page);
  const card = await birdieCard(page);
  await card.getByRole("button", { name: "Challenge alone" }).click();
  await page.getByRole("dialog", { name: "Challenge Birdie?" }).getByRole("button", { name: "Fight" }).click();
  await expect(page.locator('canvas.boss-wipe[data-boss="birdie"][data-covered="1"]')).toBeAttached({ timeout: 90_000 });
  const steps = await page.evaluate(() => (window as unknown as Hooks).__birdieSteps ?? []);
  expect(steps).toEqual(expect.arrayContaining(["face", "line", "board", "table"]));
  expect(steps.indexOf("line")).toBeLessThan(steps.indexOf("board"));
  // (His crossing gates: up as you both walk in; from the marks both lower, then come down flashing through the intro.)
  const gates = await page.evaluate(() => (window as unknown as Hooks).__birdieGates ?? []);
  expect(gates[0]).toBe("walk:idle,idle");
  expect(gates).toContain("face:lower,lower");
  expect(gates.some((g) => g.startsWith("table:") && g.endsWith(":down,down"))).toBe(true);
  // (On his mark, west of the table, he faces it, east, through every beat: Eric, Nov 23, "He's facing the wrong way in the building".)
  const looks = await page.evaluate(() => (window as unknown as Hooks).__birdieLooks ?? []);
  expect(looks.length).toBeGreaterThan(0);
  expect(looks.filter((l) => !l.endsWith(":1")), "every beat facing east").toEqual([]);
  const log = await sounds(page);
  // (His hello twice: the tap on him out front, and his line at the table; then the board's pop.)
  expect(log.filter((l) => l.startsWith("birdieHello:")).length).toBeGreaterThanOrEqual(2);
  expect(log.some((l) => l.startsWith("pop:"))).toBe(true);
});
