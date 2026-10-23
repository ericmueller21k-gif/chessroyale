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
const SMUDGY = ["Every chameleon blends in. I'd rather stand out.", "Smudgy, artist. Don't touch the wet parts.", "A masterpiece, if I say so myself."];
// (Moo & Moon's, as a screen reader reads them: the plain words, with his pixel icons left out.)
const MOO = ["Hi! This is Moo. He's my best friend. (Moo!)", "I watched your farm for ages. Let's play! (Moo?)", "Best friends make the best moves! (Moo!)"];
const PUDDLES = ["Mind the flower beds.", "Good soil here. Very good soil.", "Everything's coming up roses."];
const HIDDEN = ["Team up on me. It wouldn't be the first time anyone did that.", "You're not ready to fight me yet."];

test("the tiles and the stage: a tap drops the boss on, plays its sound once and says one of its lines; '?' is random; the Hidden Boss is a silhouette, unnamed, every choice locked", async ({ page }) => {
  await named(page, "Selector");
  await page.addInitScript(() => ((window as any).__soundLog = []));
  await page.goto("/?mode=raid");
  await expect(page.getByRole("heading", { name: "Boss raid", exact: true })).toBeVisible();
  const tiles = page.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio");
  // Twelve bosses you can meet (Puddles the last), the Hidden Boss's tile, then "?".
  await expect(tiles).toHaveCount(14);
  await expect(tiles.last()).toHaveAccessibleName("Random boss");
  await expect(tiles.nth(9)).toHaveAccessibleName("Smudgy");
  await expect(tiles.nth(10)).toHaveAccessibleName("Moo & Moon");
  await expect(tiles.nth(11)).toHaveAccessibleName("Puddles");
  await expect(tiles.nth(12)).toHaveAccessibleName("Locked boss");

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

  // Smudgy: his idle on the stage, his splash once, one of his three lines (the first is the longest, so the bubble wraps).
  await tile(page, "Smudgy").click();
  await expect(page.locator(".bs-stage .bs-sprite")).toHaveAttribute("data-fx", "smudgy");
  await expect(page.locator(".bs-name")).toHaveText("Smudgy");
  await expect.poll(async () => (await sounds(page)).filter((s) => s.startsWith("smudgySplash")).length).toBe(1);
  await expect.poll(async () => SMUDGY.includes((await bubble(page).getAttribute("aria-label")) ?? "")).toBe(true);

  // Moo & Moon: his idle on the stage, his happy moo once, one of his three lines, with one of his pixel icons drawn in it.
  await tile(page, "Moo & Moon").click();
  await expect(page.locator(".bs-stage .bs-sprite")).toHaveAttribute("data-fx", "moo");
  await expect(page.locator(".bs-name")).toHaveText("Moo & Moon");
  await expect.poll(async () => (await sounds(page)).filter((s) => s.startsWith("mooHappy")).length).toBe(1);
  await expect.poll(async () => MOO.includes((await bubble(page).getAttribute("aria-label")) ?? "")).toBe(true);
  await expect(bubble(page).locator("img.line-icon")).toHaveCount(1);

  // Puddles: his idle on the stage, his happy grunt and a splash once, one of his three lines.
  await tile(page, "Puddles").click();
  await expect(page.locator(".bs-stage .bs-sprite")).toHaveAttribute("data-fx", "gardener");
  await expect(page.locator(".bs-name")).toHaveText("Puddles");
  await expect(page.locator(".bs-rating")).toHaveText(/^💀+ Rating \d{3,4}$/);
  await expect.poll(async () => (await sounds(page)).filter((s) => s.startsWith("gardenerHello")).length).toBe(1);
  await expect.poll(async () => PUDDLES.includes((await bubble(page).getAttribute("aria-label")) ?? "")).toBe(true);

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
  // (The stage shows Boss alone's level, Normal's 1400 on a fresh device. A Solo raid's strength is the usual one, a
  // step above your rating plus Sawyer's offset: 1350 unrated, as it was; its brain plays it with the bots as a crowd.)
  await expect(page.locator(".bs-rating")).toHaveText(/^💀+ Rating 1400$/u);
  await main.getByRole("button", { name: /^Raid with bots/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).match?.boss?.id ?? null), { timeout: 60_000 }).toBe("sawyer");
  expect(await page.evaluate(() => (window as any).match.runner.state.boss.elo)).toBe(1350);

  // Boss alone: the difficulty, and the boss picked (no list to pick from again).
  await page.goto("/?debug&pace=quick&clock=20&bossMoves=3");
  await openBossRaid(page);
  await tile(page, "Wrangler").click();
  await main.getByRole("button", { name: /^Boss alone/ }).click();
  const menu = page.getByRole("dialog", { name: "Boss alone" });
  await expect(menu.locator(".boss-row")).toHaveCount(1);
  // (Hard: the level the menu and the stage show, 1800, is the rating its brain picks its moves at, Oct 18.)
  await menu.getByRole("radio", { name: "Hard", exact: true }).click();
  const aloneElo = Number(await menu.locator(".boss-row .br-elo strong").textContent());
  expect(aloneElo).toBe(1800);
  await expect(page.locator(".bs-rating")).toHaveText(new RegExp(`^💀+ Rating ${aloneElo} · Hard$`, "u"));
  await menu.getByRole("button", { name: /^Wrangler/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).match?.boss?.id ?? null), { timeout: 60_000 }).toBe("pig");
  expect(await page.evaluate(() => (window as any).match.runner.bossBrainPlan("", true).rating)).toBe(aloneElo);
});

test("a resting boss has no tile, and a pick of it reads as a random boss", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone");
  await page.route("**/api/status", (r) => r.fulfill({ json: { paused: ["boss:clown"], banner: null } }));
  await page.addInitScript(() => localStorage.setItem("brc.bossId", "clown"));
  await page.goto("/?mode=raid");
  const tiles = page.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio");
  await expect(tiles).toHaveCount(13);
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
    // Two rows of six and the last two (the Hidden Boss's and "?") on a third (fourteen tiles since Puddles), a phone and a computer.
    const rows = new Set(boxes.map((b) => Math.round(b.top)));
    expect(rows.size, `${w}`).toBe(3);
    const tilesBottom = Math.max(...boxes.map((b) => b.bottom));
    const stage = (await page.locator(".bs-spot").boundingBox())!;
    const first = (await page.locator(".rd-option").first().boundingBox())!;
    expect(stage.y, `${w}`).toBeGreaterThan(tilesBottom);
    expect(first.y, `${w}`).toBeGreaterThan(stage.y + stage.height);
    // Every boss whole inside the stage's width (Wrangler's lasso out to one side, the tallest the Hidden Boss).
    for (const name of ["Ginger", "Boingo the Clown", "Jefferson", "Hollow", "Big Boy", "Sawyer", "Wrangler", "Alfil", "Chub & Chirp", "Smudgy", "Moo & Moon", "Puddles", "Locked boss"]) {
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
  // (?cardMs=: the turn quicker than its 30 s, a test switch: a second, so a busy machine's looks, about every 0.2 s,
  // never miss one.)
  await page.goto("/?debug&cardMs=1000");
  const card = page.getByRole("main").getByRole("button", { name: /^Boss raid/ });
  const face = card.locator(".rd-face-stack");
  await expect(face).toBeVisible();
  // (Measured once the page's fonts are in: the card's words in Archivo Black are a little taller than the fallback's.)
  await page.evaluate(() => document.fonts.ready);
  const size = (await card.boundingBox())!;
  const seen: string[] = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 5_500) {
    const id = (await face.getAttribute("data-boss"))!;
    if (seen.at(-1) !== id) seen.push(id);
    const b = (await card.boundingBox())!;
    expect(Math.abs(b.height - size.height)).toBeLessThan(0.5);
    expect(Math.abs(b.width - size.width)).toBeLessThan(0.5);
    await page.waitForTimeout(100);
  }
  expect(seen.length).toBeGreaterThanOrEqual(4);
  expect(seen).not.toContain("recluse");
  // Each the next in roster order (wherever the first look found it: the first turn may come before it).
  const order = ["gingerbread", "clown", "grex", "hollow", "bigboy", "sawyer", "pig"];
  for (let i = 1; i < seen.length; i++) expect(order.indexOf(seen[i]!), seen.join(" ")).toBe((order.indexOf(seen[i - 1]!) + 1) % order.length);
  // Still portraits: one canvas each, no animation loop (no data-frame on them).
  await expect(card.locator("canvas[data-frame]")).toHaveCount(0);
});

/**
 * Your profile as the server would answer it, with a rating (and an admin's brain picker, the menu's tallest content):
 * Eric's, Oct 17 (1580).
 */
async function rated(page: Page, rating: number, admin = false) {
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    try {
      const res = await route.fetch();
      const body = await res.json().catch(() => null);
      await route.fulfill({ response: res, json: body ? { ...body, rating, ...(admin ? { admin: true } : {}) } : body });
    } catch {
      // The page is gone: nothing to answer.
    }
  });
}

/**
 * The menu's box inside the window (on a computer, a dialog with room all round: never glued to the window's foot), and
 * its last row: scrolled to inside the menu, inside the window and the list's visible box, and clickable (a trial click:
 * nothing else over it).
 */
async function expectMenuFits(page: Page, menu: ReturnType<Page["getByRole"]>, what: string) {
  const vw = page.viewportSize()!;
  const box = (await menu.boundingBox())!;
  expect(box.y, `${what}: its top`).toBeGreaterThanOrEqual(0);
  expect(box.x, `${what}: its left`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${what}: its right`).toBeLessThanOrEqual(vw.width + 0.5);
  expect(box.y + box.height, `${what}: its foot`).toBeLessThanOrEqual(vw.height + 0.5);
  if (vw.width >= 600) {
    expect(box.y, `${what}: room above`).toBeGreaterThanOrEqual(15.5);
    expect(vw.height - (box.y + box.height), `${what}: room below`).toBeGreaterThanOrEqual(15.5);
  }
  const last = menu.locator(".boss-row").last();
  await last.scrollIntoViewIfNeeded();
  const row = (await last.boundingBox())!;
  const list = (await menu.locator(".boss-menu-list").boundingBox())!;
  expect(row.y, `${what}: the last row's top`).toBeGreaterThanOrEqual(Math.max(0, list.y) - 0.5);
  expect(row.y + row.height, `${what}: the last row's foot`).toBeLessThanOrEqual(Math.min(vw.height, list.y + list.height) + 0.5);
  await last.click({ trial: true, timeout: 5_000 });
}

test("Boss alone's menu and the /bosses picker fit any window: whole, or their rows scrolling to the last, which can be tapped; a computer's in the middle with room all round", async ({ page }) => {
  // (Eric, Oct 17: on a laptop the menu sat glued to the window's foot, its row under the taskbar.)
  await named(page, "Fitter");
  await rated(page, 1580, true);
  const sizes = desktop()
    ? [[1280, 600], [1280, 720], [1366, 768], [1920, 1080]]
    : [[320, 568], [360, 640], [390, 844]];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w!, height: h! });
    // Boss alone's menu, for the boss picked (an admin's: the brain picker too).
    await page.goto("/?mode=raid");
    await tile(page, "Sawyer").click();
    await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    const alone = page.getByRole("dialog", { name: "Boss alone" });
    await expect(alone.getByRole("combobox")).toBeVisible();
    await expectMenuFits(page, alone, `${w}x${h} Boss alone`);
    // The full picker (/bosses): every boss and a random one, for an admin the Hidden Boss too: the longest list.
    await page.goto("/bosses");
    const all = page.getByRole("dialog", { name: "Choose your boss" });
    await expect(all.locator(".boss-row")).toHaveCount(14);
    await expectMenuFits(page, all, `${w}x${h} /bosses`);
    expect(await sideways(page), `${w}x${h}`).toBe(0);
  }
});

test("one number per boss: the stage shows Boss alone's strength at your difficulty, as its menu does, and follows the difficulty as it changes", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone");
  await named(page, "Counter");
  // (1580: the tier a step above is 1600; Sawyer and Big Boy are 250 under it, Ginger 100: BOSS_DIFFICULTY's
  // Easy −300, Normal 0, Hard +250, Hardest +500 on top.)
  await rated(page, 1580);
  await page.goto("/?mode=raid");
  const main = page.getByRole("main");
  const stage = page.locator(".bs-rating");
  const menu = page.getByRole("dialog", { name: "Boss alone" });
  // (Boss alone's level: the difficulty's Maia rating, whatever the boss or your rating, Oct 18.)
  const cases: [string, string, number][] = [
    ["Sawyer", "Hard", 1800],
    ["Sawyer", "Normal", 1400],
    ["Ginger", "Easy", 1000],
    ["Ginger", "Hardest", 2200],
    ["Big Boy", "Hard", 1800],
  ];
  for (const [boss, level, elo] of cases) {
    await tile(page, boss).click();
    await main.getByRole("button", { name: /^Boss alone/ }).click();
    await menu.getByRole("radio", { name: level, exact: true }).click();
    // The menu's row and the stage behind it: the same number, the difficulty named on the stage unless it's Normal.
    await expect(menu.locator(".boss-row .br-elo strong")).toHaveText(String(elo));
    await expect(stage).toHaveText(new RegExp(`^💀+ Rating ${elo}${level === "Normal" ? "" : ` · ${level}`}$`, "u"));
    await menu.getByRole("button", { name: "Close" }).click();
    await expect(menu).toHaveCount(0);
    await expect(stage).toHaveText(new RegExp(`^💀+ Rating ${elo}${level === "Normal" ? "" : ` · ${level}`}$`, "u"));
  }
  // Remembered on this device: the stage after a reload, before the menu opens.
  await page.reload();
  await expect(page.locator(".bs-name")).toHaveText("Big Boy");
  await expect(stage).toHaveText(/^💀+ Rating 1800 · Hard$/u);

  // The widest line (the most skulls, four digits, Hardest) on one line at 320 px, inside the window.
  await rated(page, 2950);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.reload();
  await tile(page, "Ginger").click();
  await main.getByRole("button", { name: /^Boss alone/ }).click();
  await menu.getByRole("radio", { name: "Hardest", exact: true }).click();
  await menu.getByRole("button", { name: "Close" }).click();
  await expect(stage).toHaveText(/^💀+ Rating 2200 · Hardest$/u);
  const line = (await stage.boundingBox())!;
  expect(line.x).toBeGreaterThanOrEqual(0);
  expect(line.x + line.width).toBeLessThanOrEqual(320);
  // (One line of 14 px text is about 20 px tall with its emoji; two would be over 32.)
  expect(line.height).toBeLessThan(28);
  expect(await sideways(page)).toBe(0);
});
