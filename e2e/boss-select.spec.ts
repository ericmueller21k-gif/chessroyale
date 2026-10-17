import { expect, type Page } from "@playwright/test";
import { named, openBossRaid, test } from "./helpers.ts";

/**
 * The Boss raid screen as an old-school character select (Eric, Oct 16; docs/decisions/2026-10-16-boss-character-select.md):
 * the slanted tiles, the stage (the picked boss's idle, its name and strength), a tap's drop, sound and line, the "?"
 * tile, the Hidden Boss dark and locked (never named), the pick reaching Boss alone, a Solo raid and a raid you make
 * (the public queues always random), resting bosses left out, the layout at every width, and home's card turning.
 */

const desktop = () => test.info().project.name === "desktop";
const sideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const sounds = (p: Page) => p.evaluate(() => ((window as any).__soundLog ?? []) as string[]);
const tile = (p: Page, name: string) => p.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio", { name, exact: true });
const bubble = (p: Page) => p.locator(".bs-say .bs-bubble");
// (Each boss's lines on the stage: characters/boss-select.ts.)
const BOINGO = ["Honk honk! Showtime!", "Step right up!", "Who ordered a clown?"];
const HOLLOW = ["Hollow is here.", "Did you leave a light on?", "I was always here.", "Hush now."];
const HIDDEN = ["Team up on me. It wouldn't be the first time anyone did that.", "You're not ready to fight me yet."];

test("the tiles and the stage: a tap drops the boss on, plays its sound once and says one of its lines; '?' is random; the Hidden Boss is a silhouette, unnamed, every choice locked", async ({ page }) => {
  await named(page, "Selector");
  await page.addInitScript(() => ((window as any).__soundLog = []));
  await page.goto("/?mode=raid");
  await expect(page.getByRole("heading", { name: "Boss raid", exact: true })).toBeVisible();
  const tiles = page.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio");
  // Seven bosses you can meet, the Hidden Boss's tile, then "?".
  await expect(tiles).toHaveCount(9);
  await expect(tiles.last()).toHaveAccessibleName("Random boss");
  await expect(tiles.nth(7)).toHaveAccessibleName("Locked boss");

  // Boingo: his idle on the stage, his name and strength, his pie's splat once, one of his lines in his bubble.
  await tile(page, "Boingo the Clown").click();
  await expect(tile(page, "Boingo the Clown")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".bs-stage .bs-sprite")).toHaveAttribute("data-fx", "clown");
  await expect(page.locator(".bs-name")).toHaveText("Boingo the Clown");
  await expect(page.locator(".bs-rating")).toHaveText(/^💀+ Rating \d{3,4}$/);
  await expect(bubble(page)).toBeVisible();
  expect(BOINGO).toContain(await bubble(page).getAttribute("aria-label"));
  await expect.poll(async () => (await sounds(page)).filter((s) => s.startsWith("clownSplat")).length).toBe(1);
  // It animates (its idle's frames change), and it dropped in (the 1 v 1 stage's drop).
  const frames = new Set<string>();
  for (let i = 0; i < 8; i++) {
    frames.add((await page.locator(".bs-sprite").getAttribute("data-frame"))!);
    await page.waitForTimeout(120);
  }
  expect(frames.size).toBeGreaterThan(1);
  expect(await page.locator(".bs-fig").evaluate((e) => getComputedStyle(e).animationName)).toBe("dv-st-drop");

  // Hollow: his darkness's sound, one of his lines.
  await tile(page, "Hollow").click();
  await expect(page.locator(".bs-stage .bs-sprite")).toHaveAttribute("data-fx", "hollow");
  await expect.poll(async () => (await sounds(page)).filter((s) => s.startsWith("hollowCast")).length).toBe(1);
  await expect.poll(async () => HOLLOW.includes((await bubble(page).getAttribute("aria-label")) ?? "")).toBe(true);
  for (const b of await page.locator(".rd-option").all()) await expect(b).toBeEnabled();

  // "?": a question mark on the stage, a random boss; Boss alone says so.
  await tile(page, "Random boss").click();
  await expect(page.locator(".bs-stage .bs-q-big")).toBeVisible();
  await expect(page.locator(".bs-stage .bs-sprite")).toHaveCount(0);
  await expect(page.locator(".bs-name")).toHaveText("Random boss");
  await expect(page.getByRole("button", { name: /^Boss alone/ })).toHaveText("Boss aloneJust you vs a random boss");

  // The Hidden Boss: all dark, his ominous hum, his two lines in turn, every choice locked, his name nowhere.
  await tile(page, "Locked boss").click();
  await expect(page.locator(".bs-stage.bs-dark .bs-sprite")).toBeVisible();
  expect(await page.locator(".bs-sprite").evaluate((e) => getComputedStyle(e).filter)).toMatch(/^brightness\(0\)/);
  await expect(page.locator(".bs-name")).toHaveText("???");
  await expect.poll(async () => (await sounds(page)).filter((s) => s.startsWith("recluseHum")).length).toBe(1);
  await expect.poll(() => bubble(page).getAttribute("aria-label")).toBe(HIDDEN[0]);
  const options = page.locator(".rd-option");
  await expect(options).toHaveCount(5);
  for (const b of await options.all()) {
    await expect(b).toBeDisabled();
    await expect(b.locator(".rd-lock")).toBeVisible();
  }
  await tile(page, "Locked boss").click();
  await expect.poll(() => bubble(page).getAttribute("aria-label")).toBe(HIDDEN[1]);
  const html = await page.content();
  expect(html).not.toContain("Fischer");
  expect(html).not.toContain("Hidden Boss");
  // Another boss unlocks them.
  await tile(page, "Ginger").click();
  for (const b of await options.all()) await expect(b).toBeEnabled();
  await expect.poll(async () => (await sounds(page)).filter((s) => s.startsWith("gingerCrackle")).length).toBe(1);
});

test("the select keeps quiet when sound is off, and holds still under reduced motion", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone");
  await page.addInitScript(() => {
    (window as any).__soundLog = [];
    localStorage.setItem("brc.muted", "1");
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?mode=raid");
  await tile(page, "Big Boy").click();
  await expect.poll(() => sounds(page)).toEqual([expect.stringMatching(/^bigboyClack:.*:muted$/)]);
  // (The line still shows: it's words, not sound.)
  await expect(bubble(page)).toBeVisible();
  const frame = await page.locator(".bs-sprite").getAttribute("data-frame");
  await page.waitForTimeout(700);
  await expect(page.locator(".bs-sprite")).toHaveAttribute("data-frame", frame!);
  expect(await page.locator(".bs-fig").evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
});

test("the pick reaches Boss alone, a Solo raid and a raid you make; the public queues are always a random boss", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone");
  test.setTimeout(3 * 60_000);
  await named(page, "Picker");
  await page.goto("/?debug&pace=quick&clock=20&bossMoves=3");
  await openBossRaid(page);
  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: /^Join a raid/ })).toHaveText(/^Join a raidRandom boss · up to 50 players · bots after \d+ s$/);
  await expect(main.getByRole("button", { name: /^People only/ })).toHaveText(/^People onlyRandom boss · no bots · starts at 50, or 10 after \d+ s$/);

  // Play with friends: the raid is made for the boss picked (the lobby's bossPicked).
  await tile(page, "Jefferson").click();
  await main.getByRole("button", { name: /^Play with friends/ }).click();
  const made = page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/api/lobby?"));
  await page.getByRole("dialog", { name: "Play with friends" }).getByRole("button", { name: "Create a raid" }).click();
  const url = new URL((await made).url());
  expect(url.searchParams.get("mode")).toBe("raid");
  expect(url.searchParams.get("boss")).toBe("grex");

  // Raid with bots: you and 49 bots against the boss picked.
  await page.goto("/?debug&pace=quick&clock=20&bossMoves=3");
  await openBossRaid(page);
  await expect(tile(page, "Jefferson")).toHaveAttribute("aria-checked", "true");
  await tile(page, "Sawyer").click();
  await main.getByRole("button", { name: /^Raid with bots/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).match?.boss?.id ?? null), { timeout: 60_000 }).toBe("sawyer");

  // Boss alone: the difficulty, and the boss picked (no list to pick from again).
  await page.goto("/?debug&pace=quick&clock=20&bossMoves=3");
  await openBossRaid(page);
  await tile(page, "Wrangler").click();
  await main.getByRole("button", { name: /^Boss alone/ }).click();
  const menu = page.getByRole("dialog", { name: "Boss alone" });
  await expect(menu.locator(".boss-row")).toHaveCount(1);
  await menu.getByRole("button", { name: /^Wrangler/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).match?.boss?.id ?? null), { timeout: 60_000 }).toBe("pig");
});

test("a resting boss has no tile, and a pick of it reads as a random boss", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone");
  await page.route("**/api/status", (r) => r.fulfill({ json: { paused: ["boss:clown"], banner: null } }));
  await page.addInitScript(() => localStorage.setItem("brc.bossId", "clown"));
  await page.goto("/?mode=raid");
  const tiles = page.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio");
  await expect(tiles).toHaveCount(8);
  await expect(tile(page, "Boingo the Clown")).toHaveCount(0);
  await expect(tile(page, "Random boss")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".bs-name")).toHaveText("Random boss");
});

test("the layout: the tiles in rows, the stage under them, the ways to play under the stage; no sideways scroll at 320, 360, 390 and 1280 px", async ({ page }) => {
  const widths = desktop() ? [[1280, 800]] : [[320, 640], [360, 740], [390, 844]];
  for (const [w, h] of widths) {
    await page.setViewportSize({ width: w!, height: h! });
    await page.goto("/?mode=raid");
    await tile(page, "Hollow").click();
    const boxes = await page.locator(".bs-tile").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
    for (const b of boxes) {
      expect(b.left, `${w}`).toBeGreaterThanOrEqual(0);
      expect(b.right, `${w}`).toBeLessThanOrEqual(w!);
      expect(b.width, `${w}: a tile big enough to tap`).toBeGreaterThanOrEqual(44);
    }
    // Phones: five to a row, then four; a computer: all in one row.
    const rows = new Set(boxes.map((b) => Math.round(b.top)));
    expect(rows.size, `${w}`).toBe(w! >= 600 ? 1 : 2);
    const tilesBottom = Math.max(...boxes.map((b) => b.bottom));
    const stage = (await page.locator(".bs-spot").boundingBox())!;
    const first = (await page.locator(".rd-option").first().boundingBox())!;
    expect(stage.y, `${w}`).toBeGreaterThan(tilesBottom);
    expect(first.y, `${w}`).toBeGreaterThan(stage.y + stage.height);
    // Every boss whole inside the stage's width (Wrangler's lasso out to one side, the tallest the Hidden Boss).
    for (const name of ["Ginger", "Boingo the Clown", "Jefferson", "Hollow", "Big Boy", "Sawyer", "Wrangler", "Locked boss"]) {
      await tile(page, name).click();
      // (After its drop, which squashes it a little wider for a moment.)
      await page.waitForTimeout(500);
      const fig = (await page.locator(".bs-sprite").boundingBox())!;
      expect(fig.x, `${w} ${name}`).toBeGreaterThanOrEqual(stage.x - 1);
      expect(fig.x + fig.width, `${w} ${name}`).toBeLessThanOrEqual(stage.x + stage.width + 1);
      expect(await sideways(page), `${w} ${name}`).toBe(0);
    }
  }
});

test("home's Boss raid card: a still portrait that moves on to the next boss you can meet, never the Hidden Boss, the card never changing size", async ({ page }) => {
  // (?cardMs=: the turn quicker than its 30 s, a test switch.)
  await page.goto("/?debug&cardMs=400");
  const card = page.getByRole("main").getByRole("button", { name: /^Boss raid/ });
  const face = card.locator(".rd-face-stack");
  await expect(face).toBeVisible();
  // (Measured once the page's fonts are in: the card's words in Archivo Black are a little taller than the fallback's.)
  await page.evaluate(() => document.fonts.ready);
  const size = (await card.boundingBox())!;
  const seen: string[] = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 4_000) {
    const id = (await face.getAttribute("data-boss"))!;
    if (seen.at(-1) !== id) seen.push(id);
    const b = (await card.boundingBox())!;
    expect(Math.abs(b.height - size.height)).toBeLessThan(0.5);
    expect(Math.abs(b.width - size.width)).toBeLessThan(0.5);
    await page.waitForTimeout(100);
  }
  expect(seen.length).toBeGreaterThanOrEqual(4);
  expect(seen).not.toContain("recluse");
  // In roster order, each a different boss from the last.
  expect(seen.slice(0, 3)).toEqual(["gingerbread", "clown", "grex"]);
  // Still portraits: one canvas each, no animation loop (no data-frame on them).
  await expect(card.locator("canvas[data-frame]")).toHaveCount(0);
});
