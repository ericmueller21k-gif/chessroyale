import { expect, type Page } from "@playwright/test";
import { named, openBossRaid, openSoloBoss, test } from "./helpers.ts";

/**
 * The Boss raid screen as an old-school character select (Eric, Oct 16; docs/decisions/2026-10-16-boss-character-select.md):
 * the slanted tiles, the stage (the picked boss's idle, its name and difficulty; no number since Oct 25), a tap's drop, sound and line, the "?"
 * tile, the Hidden Boss dark and locked (never named), the pick reaching Boss alone, a Solo raid and a raid you make
 * (the public queues always random), resting bosses left out, the grid (the same tall tiles with a gap, five to a row, a figure
 * and a color each, 44 px targets) and the layout at every width, and home's card turning. The grid:
 * docs/decisions/2026-10-23-boss-select-sf.md.
 */

const desktop = () => test.info().project.name === "desktop";
const sideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const sounds = (p: Page) => p.evaluate(() => ((window as any).__soundLog ?? []) as string[]);
const tile = (p: Page, name: string) => p.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio", { name, exact: true });
const bubble = (p: Page) => p.locator(".bs-say .bs-bubble");
type Box = { x: number; y: number; width: number; height: number };
/** The biggest difference, in px, between two boxes' edges and sizes (nothing shifts: Eric's rule). */
const boxGap = (a: Box, b: Box) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.width - b.width), Math.abs(a.height - b.height));
// (Each boss's lines on the stage: characters/boss-select.ts.)
const BOINGO = ["Honk honk! Showtime!", "Step right up!", "Who ordered a clown?"];
const HOLLOW = ["Hollow is here.", "Did you leave a light on?", "I was always here.", "Hush now."];
const SMUDGY = ["Every chameleon blends in. I'd rather stand out.", "Smudgy, artist. Don't touch the wet parts.", "A masterpiece, if I say so myself."];
// (Moo & Moon's, as a screen reader reads them: the plain words, with his pixel icons left out.)
const MOO = ["Hi! This is Moo. He's my best friend. (Moo!)", "I watched your farm for ages. Let's play! (Moo?)", "Best friends make the best moves! (Moo!)"];
const PUDDLES = ["Mind the flower beds.", "Good soil here. Very good soil.", "Everything's coming up roses."];
const BABUR = ["No roaring tonight. Balloons only.", "Another masterpiece.", "Don't rush the artist."];
const HIDDEN = ["Team up on me. It wouldn't be the first time anyone did that.", "You're not ready to fight me yet."];

test("the tiles and the stage: a tap drops the boss on, plays its sound once and says one of its lines; '?' is random; the Hidden Boss is a silhouette, unnamed, every choice locked", async ({ page }) => {
  await named(page, "Selector");
  await page.addInitScript(() => ((window as any).__soundLog = []));
  await page.goto("/?mode=raid");
  await expect(page.getByRole("heading", { name: "Boss raid", exact: true })).toBeVisible();
  const tiles = page.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio");
  // Fourteen bosses you can meet (Folio the last), the Hidden Boss's tile, then "?".
  await expect(tiles).toHaveCount(16);
  await expect(tiles.last()).toHaveAccessibleName("Random boss");
  await expect(tiles.nth(9)).toHaveAccessibleName("Smudgy");
  await expect(tiles.nth(10)).toHaveAccessibleName("Moo & Moon");
  await expect(tiles.nth(11)).toHaveAccessibleName("Puddles");
  await expect(tiles.nth(12)).toHaveAccessibleName("Babur");
  await expect(tiles.nth(13)).toHaveAccessibleName("Folio");
  await expect(tiles.nth(14)).toHaveAccessibleName("Locked boss");

  // Boingo: his idle on the stage, his name and strength, his pie's splat once, one of his lines in his bubble.
  await tile(page, "Boingo the Clown").click();
  await expect(tile(page, "Boingo the Clown")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".bs-stage .bs-sprite")).toHaveAttribute("data-fx", "clown");
  await expect(page.locator(".bs-name")).toHaveText("Boingo the Clown");
  await expect(page.locator(".bs-level")).toHaveText("Medium");
  await expect(page.locator(".bs-level")).not.toContainText(/Rating|💀|\d/u);
  await expect(bubble(page)).toBeVisible();
  // (Nothing shifts, Eric's rule: the "Join a raid" button keeps its box whichever boss is picked, checked below.)
  const joinBox = async (): Promise<Box> => (await page.getByRole("main").getByRole("button", { name: /^Join a raid/ }).boundingBox())!;
  const boingoJoin = await joinBox();
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
  await expect(page.locator(".bs-level")).toHaveText("Medium");
  await expect(page.locator(".bs-level")).not.toContainText(/Rating|💀|\d/u);
  await expect.poll(async () => (await sounds(page)).filter((s) => s.startsWith("gardenerHello")).length).toBe(1);
  await expect.poll(async () => PUDDLES.includes((await bubble(page).getAttribute("aria-label")) ?? "")).toBe(true);

  // Babur: his idle on the stage, his bored yawn and a balloon squeak once, one of his three lines.
  await tile(page, "Babur").click();
  await expect(page.locator(".bs-stage .bs-sprite")).toHaveAttribute("data-fx", "tiger");
  await expect(page.locator(".bs-name")).toHaveText("Babur");
  await expect(page.locator(".bs-level")).toHaveText("Medium");
  await expect(page.locator(".bs-level")).not.toContainText(/Rating|💀|\d/u);
  await expect.poll(async () => (await sounds(page)).filter((s) => s.startsWith("tigerHello")).length).toBe(1);
  await expect.poll(async () => BABUR.includes((await bubble(page).getAttribute("aria-label")) ?? "")).toBe(true);

  // Folio: its idle on the stage, a page turning and a flap of its wing once, its one line.
  await tile(page, "Folio").click();
  await expect(page.locator(".bs-stage .bs-sprite")).toHaveAttribute("data-fx", "folio");
  await expect(page.locator(".bs-name")).toHaveText("Folio");
  await expect(page.locator(".bs-level")).toHaveText("Medium");
  await expect.poll(async () => (await sounds(page)).filter((s) => s.startsWith("folioHello")).length).toBe(1);
  await expect.poll(() => bubble(page).getAttribute("aria-label")).toBe("Every game is a draft. Shall we write one?");
  // (Its select line is said in the select's own voice: its whisper is the battle's, never heard here.)
  expect((await sounds(page)).filter((s) => s.startsWith("folioVoice"))).toEqual([]);

  // "?": a question mark on the stage, a random boss; Boss alone says so.
  await tile(page, "Random boss").click();
  await expect(page.locator(".bs-stage .bs-q-big")).toBeVisible();
  await expect(page.locator(".bs-stage .bs-sprite")).toHaveCount(0);
  await expect(page.locator(".bs-name")).toHaveText("Random boss");
  await expect(page.getByRole("button", { name: /^Boss alone/ })).toHaveText("Boss aloneJust you vs a random boss");
  const randomJoin = await joinBox();
  expect(boxGap(randomJoin, boingoJoin), "the Join a raid button: Random boss against Boingo").toBeLessThanOrEqual(1);

  // The Hidden Boss: all dark, his ominous hum, his two lines in turn, every choice locked, his name nowhere.
  await tile(page, "Locked boss").click();
  await expect(page.locator(".bs-stage.bs-dark .bs-sprite")).toBeVisible();
  expect(await page.locator(".bs-sprite").evaluate((e) => getComputedStyle(e).filter)).toMatch(/^brightness\(0\)/);
  await expect(page.locator(".bs-name")).toHaveText("???");
  expect(boxGap(await joinBox(), randomJoin), "the Join a raid button: the Hidden Boss against Random boss").toBeLessThanOrEqual(1);
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

test("Big Boy stands in the middle of the platform: his feet centered on it (Eric, Oct 25)", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?mode=raid");
  await tile(page, "Big Boy").click();
  const sprite = page.locator(".bs-stage .bs-sprite");
  await expect(sprite).toHaveAttribute("data-fx", "bigboy");
  // (His feet: the lowest five rows the canvas paints, their middle on the page.)
  const feet = await sprite.evaluate((c: HTMLCanvasElement) => {
    const { data, width, height } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    const painted = (x: number, y: number) => data[(y * width + x) * 4 + 3]! > 0;
    let bottom = height - 1;
    while (bottom > 0 && !Array.from({ length: width }, (_, x) => painted(x, bottom)).some(Boolean)) bottom--;
    let a = width, b = -1;
    for (let y = Math.max(0, bottom - 4); y <= bottom; y++) for (let x = 0; x < width; x++) if (painted(x, y)) (a = Math.min(a, x)), (b = Math.max(b, x));
    const r = c.getBoundingClientRect();
    return r.left + ((a + b + 1) / 2) * (r.width / width);
  });
  const plat = (await page.locator(".bs-spot:not(.bs-mine) > .dv-st-plat").boundingBox())!;
  expect(Math.abs(feet - (plat.x + plat.width / 2)), "his feet's middle from the platform's").toBeLessThan(4);
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
  // (The stage shows no number (Eric, Oct 25), and the difficulty's name under the boss (Medium). A Solo raid's strength is the usual one, a
  // step above your rating plus Sawyer's offset: 1350 unrated, as it was; its brain plays it with the bots as a crowd.)
  await expect(page.locator(".bs-level")).toHaveText("Medium");
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
  // (Hard: the level the menu shows, 2050, is the rating its brain picks its moves at, Oct 18; the stage names only the difficulty.)
  await menu.getByRole("radio", { name: "Hard", exact: true }).click();
  const aloneElo = Number(await menu.locator(".boss-row .br-elo strong").textContent());
  expect(aloneElo).toBe(2050);
  await expect(page.locator(".bs-level")).toHaveText("Hard");
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
  await expect(tiles).toHaveCount(15);
  await expect(tile(page, "Boingo the Clown")).toHaveCount(0);
  await expect(tile(page, "Random boss")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".bs-name")).toHaveText("Random boss");
});

/** The windows the select is checked at (Eric's iPhone in Safari is 428 x 777), and the tiles' size in each in the first grid (Oct 21, before the grid: width, height). */
const SIZES = () => (desktop() ? [[1280, 800]] : [[320, 568], [360, 740], [390, 844], [428, 777], [430, 932]]);
const TILE_BEFORE: Record<number, [number, number]> = { 320: [44, 39.6], 360: [50.7, 45.6], 390: [55.7, 50.1], 428: [62, 55.8], 430: [62.3, 56.1], 1280: [76, 68.4] };

/** The grid's boxes (rows, tiles, their art, the block, the column and the header over it). */
function measureGrid() {
  const R = (e: Element) => {
    const b = e.getBoundingClientRect();
    return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height };
  };
  const rows = [...document.querySelectorAll(".bs-row")].map((row) => ({
    ...R(row),
    tiles: [...row.querySelectorAll(".bs-tile")].map((t) => {
      const inner = t.querySelector(".bs-tile-in")!;
      const art = t.querySelector(".bs-art");
      return {
        ...R(t),
        name: t.getAttribute("aria-label")!,
        text: (t.textContent ?? "").trim(),
        // (The slant, the first number of the tile's polygon: its shape's lean in pixels.)
        slant: Number(getComputedStyle(t).clipPath.match(/^polygon\(([\d.]+)px/)?.[1] ?? NaN),
        inner: R(inner),
        fill: getComputedStyle(inner).backgroundImage,
        art: art ? R(art) : null,
      };
    }),
  }));
  return { rows, block: R(document.querySelector(".bs-tiles")!), column: R(document.querySelector(".rd-page")!), head: R(document.querySelector(".rd-page .fd-page-head")!) };
}
/** What tile (its name) is at each point, null where none is (the page, a gap). */
const tileAt = (ps: { x: number; y: number }[]) => ps.map((p) => document.elementFromPoint(p.x, p.y)?.closest(".bs-tile")?.getAttribute("aria-label") ?? null);

for (const scheme of ["light", "dark"] as const) {
  test(`the grid, ${scheme}: tall slanted tiles all the same size with a small gap, five to a row (a short row centered), edge to edge on a phone, bigger than before, 44 px targets, each filled by its boss's figure, nothing sideways`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [w, h] of SIZES()) {
      const at = `${scheme} ${w}x${h}`;
      await page.setViewportSize({ width: w!, height: h! });
      await page.goto("/?mode=raid");
      await expect(page.getByRole("heading", { name: "Boss raid", exact: true })).toBeVisible();
      await expect(page.locator(".bs-tile")).toHaveCount(16);
      await page.evaluate(() => document.fonts.ready);
      const g = await page.evaluate(measureGrid);

      // Five to a row on a phone and a computer alike: 5, 5, 5 and "?" on its own (sixteen tiles since Folio, Oct 27).
      expect(g.rows.map((r) => r.tiles.length), at).toEqual([5, 5, 5, 1]);
      const tiles = g.rows.flatMap((r) => r.tiles);
      const t0 = tiles[0]!;

      // Every tile the very same size and shape: tall (its visible width 1 to 1.55 of its height), its slant a fifth of its width.
      for (const t of tiles) {
        // ("?" is the smaller box since Oct 29, Eric's picture: 0.82 of a tile's width, half its height.)
        if (t.name === "Random boss") {
          expect(Math.abs(t.w - 0.82 * t0.w), `${at} ${t.name}: width`).toBeLessThan(0.6);
          expect(Math.abs(t.h - 0.5 * t0.h), `${at} ${t.name}: height`).toBeLessThan(0.6);
          continue;
        }
        expect(Math.abs(t.w - t0.w), `${at} ${t.name}: width`).toBeLessThan(0.6);
        expect(Math.abs(t.h - t0.h), `${at} ${t.name}: height`).toBeLessThan(0.6);
        expect(Math.abs(t.slant - 0.2 * t.w), `${at} ${t.name}: slant`).toBeLessThan(0.7);
      }
      expect(Math.abs(t0.h / t0.w - 1.24), `${at}: tall`).toBeLessThan(0.02);
      const slant = t0.slant;
      expect(slant, `${at}: the frame stays slanted`).toBeGreaterThan(8);
      expect((t0.w - slant) * 1.55, `${at}: visible width to height`).toBeCloseTo(t0.h, 0);

      // A small, even gap between neighbors (along their slanted edge) and between rows.
      const gaps: number[] = [];
      for (const row of g.rows) for (let i = 1; i < row.tiles.length; i++) gaps.push(row.tiles[i]!.x - (row.tiles[i - 1]!.r - slant));
      for (const gap of gaps) {
        expect(gap, `${at}: gap between neighbors`).toBeGreaterThanOrEqual(4);
        expect(gap, `${at}: gap between neighbors`).toBeLessThanOrEqual(6);
        expect(Math.abs(gap - gaps[0]!), `${at}: the same gap everywhere`).toBeLessThan(0.6);
      }
      for (let i = 1; i < g.rows.length; i++) {
        const gap = g.rows[i]!.y - g.rows[i - 1]!.b;
        expect(gap, `${at}: gap between rows ${i} and ${i + 1}`).toBeGreaterThanOrEqual(4);
        expect(gap, `${at}: gap between rows ${i} and ${i + 1}`).toBeLessThanOrEqual(6);
        expect(Math.abs(gap - gaps[0]!), `${at}: row gap as wide as the others`).toBeLessThan(1);
      }

      // Each row centered in the block (the short one too: its tiles the same size, not stretched), the block in the column.
      const rowSpan = (r: (typeof g.rows)[number]) => [r.tiles[0]!.x, r.tiles.at(-1)!.r] as const;
      const mid = (g.block.x + g.block.r) / 2;
      for (const row of g.rows) {
        const [l, r] = rowSpan(row);
        expect(Math.abs((l + r) / 2 - mid), `${at}: a row of ${row.tiles.length} centered`).toBeLessThan(1);
      }
      const left = rowSpan(g.rows[0]!)[0] - g.column.x;
      const right = g.column.r - rowSpan(g.rows[0]!)[1];
      expect(Math.abs(left - right), `${at}: even`).toBeLessThanOrEqual(1);
      const top = g.rows[0]!.y - g.head.b;
      expect(top, `${at}: top buffer`).toBeGreaterThanOrEqual(8);
      expect(top, `${at}: top buffer`).toBeLessThanOrEqual(12);
      if (desktop()) {
        // A computer: the tiles stop at 96 px, the block is in the middle of the column, narrower than it.
        expect(t0.w, `${at}: capped`).toBeCloseTo(96, 0);
        expect(left, `${at}: room each side`).toBeGreaterThan(20);
      } else {
        // A phone: nearly the screen's width, a 10 px buffer each side (a tile's corner is the edge).
        expect(left, `${at}: left buffer`).toBeGreaterThanOrEqual(8);
        expect(left, `${at}: left buffer`).toBeLessThanOrEqual(12);
        expect(right, `${at}: right buffer`).toBeGreaterThanOrEqual(8);
        expect(right, `${at}: right buffer`).toBeLessThanOrEqual(12);
      }

      // Bigger than the first grid, every tile a 44 px target (its width at mid-height: a slant narrower than its box).
      const [bw, bh] = TILE_BEFORE[w!]!;
      expect(t0.w, `${at}: wider than the first grid's (${bw})`).toBeGreaterThanOrEqual(bw * 1.15);
      expect(t0.h, `${at}: taller than the first grid's (${bh})`).toBeGreaterThanOrEqual(bh * 1.15);
      expect(t0.h, `${at}: 44 px high`).toBeGreaterThanOrEqual(44);
      expect(t0.w - slant, `${at}: 44 px wide at mid-height`).toBeGreaterThanOrEqual(44);

      // Each boss's tile is filled by its figure (no name on it): the figure's box covers the tile inside its frame, its color is its own.
      const fills = new Set<string>();
      for (const t of tiles) {
        if (t.name === "Random boss") {
          expect(t.text, `${at}: "?"`).toBe("?");
          expect(t.art, `${at}: "?" has no figure`).toBeNull();
          continue;
        }
        expect(t.text, `${at} ${t.name}: no name written on the tile`).toBe("");
        const a = t.art!;
        expect(a, `${at} ${t.name}: its figure`).not.toBeNull();
        expect(a.x, `${at} ${t.name}: figure to the left edge`).toBeLessThanOrEqual(t.inner.x + 0.5);
        expect(a.r, `${at} ${t.name}: figure to the right edge`).toBeGreaterThanOrEqual(t.inner.r - 0.5);
        expect(a.b, `${at} ${t.name}: figure on past the foot`).toBeGreaterThanOrEqual(t.inner.b - 0.5);
        if (t.name !== "Locked boss") fills.add(t.fill);
      }
      // A color of its own for each boss with a character (the Hidden Boss's is dark, "?" plain): fourteen, no two the same.
      expect(fills.size, `${at}: a color each`).toBe(14);

      // Nothing spills past a tile's shape: the gaps are empty, art and all (on either side of each slanted edge, and between the rows).
      const gap = gaps[0]!;
      const probes: { x: number; y: number }[] = [];
      for (const row of g.rows) {
        for (let i = 1; i < row.tiles.length; i++) {
          const a = row.tiles[i - 1]!;
          for (const f of [0.15, 0.5, 0.85]) probes.push({ x: a.r - slant * f + gap / 2, y: a.y + a.h * f });
        }
      }
      for (let i = 1; i < g.rows.length; i++) for (const t of g.rows[i - 1]!.tiles) probes.push({ x: t.x + t.w / 2, y: t.b + (g.rows[i]!.y - t.b) / 2 });
      expect(await page.evaluate(tileAt, probes), `${at}: the gaps are bare`).toEqual(probes.map(() => null));
      expect(await sideways(page), at).toBe(0);
    }
  });
}

test("every tile can be tapped, in its middle and either side of a gap; a press shrinks it; the picked one is gold, the Hidden Boss's dark, and '?' stays in its tile", async ({ page }) => {
  await named(page, "Tapper");
  for (const [w, h] of desktop() ? [[1280, 800]] : [[320, 568], [428, 777]]) {
    const at = `${w}x${h}`;
    await page.setViewportSize({ width: w!, height: h! });
    await page.goto("/?mode=raid");
    await expect(page.locator(".bs-tile")).toHaveCount(16);
    const g = await page.evaluate(measureGrid);
    const slant = g.rows[0]!.tiles[0]!.slant;
    const names = g.rows.flatMap((r) => r.tiles.map((t) => t.name));

    // Each tile in turn, by its middle: it's the one picked, and only it.
    for (const name of names) {
      await tile(page, name).click();
      await expect(tile(page, name), `${at} ${name}`).toHaveAttribute("aria-checked", "true");
      await expect(page.locator('.bs-tile[aria-checked="true"]'), `${at} ${name}`).toHaveCount(1);
    }

    // Close to each slanted edge, at its top, middle and foot: the tile on that side of it, and nothing in the gap between.
    const probes: { x: number; y: number; want: string | null }[] = [];
    for (const row of g.rows) {
      for (let i = 1; i < row.tiles.length; i++) {
        const a = row.tiles[i - 1]!;
        const b = row.tiles[i]!;
        const gap = b.x - (a.r - slant);
        for (const f of [0.1, 0.5, 0.9]) {
          const edge = a.r - slant * f;
          const y = a.y + a.h * f;
          probes.push({ x: edge - 4, y, want: a.name }, { x: edge + gap / 2, y, want: null }, { x: edge + gap + 4, y, want: b.name });
        }
      }
      // (And a tile's top and foot, a row's gap under it.)
      for (const t of row.tiles) probes.push({ x: t.x + t.w / 2, y: t.y + 4, want: t.name }, { x: t.x + t.w / 2, y: t.b - 4, want: t.name });
    }
    expect(await page.evaluate(tileAt, probes), at).toEqual(probes.map((p) => p.want));

    // A press: the tile under the finger shrinks (and springs back).
    const ginger = (await tile(page, "Ginger").boundingBox())!;
    await page.mouse.move(ginger.x + ginger.width / 2, ginger.y + ginger.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(250);
    expect(await tile(page, "Ginger").evaluate((e) => getComputedStyle(e).transform), at).toMatch(/^matrix\(0\.95, 0, 0, 0\.95/);
    await page.mouse.up();
    await page.waitForTimeout(250);
    expect(await tile(page, "Ginger").evaluate((e) => getComputedStyle(e).transform), at).toBe("none");

    // The picked tile's frame is gold (the others' is not); the Hidden Boss's tile is dark; "?" is whole inside its tile, as big as its tile.
    const gold = (rgb: string) => {
      const [r, gr, b] = rgb.match(/\d+/g)!.map(Number) as [number, number, number];
      return r > 200 && gr > 150 && b < 130;
    };
    await tile(page, "Hollow").click();
    expect(gold(await tile(page, "Hollow").evaluate((e) => getComputedStyle(e).backgroundColor)), `${at}: the picked tile's frame`).toBe(true);
    expect(gold(await tile(page, "Ginger").evaluate((e) => getComputedStyle(e).backgroundColor)), `${at}: another tile's`).toBe(false);
    expect(await tile(page, "Locked boss").locator(".bs-tile-in").evaluate((e) => getComputedStyle(e).backgroundColor), at).toBe("rgb(11, 10, 16)");
    const q = (await tile(page, "Random boss").locator(".bs-q").boundingBox())!;
    const rb = (await tile(page, "Random boss").boundingBox())!;
    expect(q.x, at).toBeGreaterThanOrEqual(rb.x);
    expect(q.x + q.width, at).toBeLessThanOrEqual(rb.x + rb.width);
    expect(q.y, at).toBeGreaterThanOrEqual(rb.y);
    expect(q.y + q.height, at).toBeLessThanOrEqual(rb.y + rb.height);
    expect(q.height, `${at}: a "?" that fills its tile`).toBeGreaterThanOrEqual(rb.height * 0.3);
  }
});

test("the layout: the stage under the tiles, the ways to play under the stage and on screen where the window allows, every boss whole on the stage; no sideways scroll at 320, 360, 390, 428, 430 and 1280 px", async ({ page }) => {
  for (const [w, h] of SIZES()) {
    await page.setViewportSize({ width: w!, height: h! });
    await page.goto("/?mode=raid");
    await tile(page, "Hollow").click();
    const block = (await page.locator(".bs-tiles").boundingBox())!;
    const stage = (await page.locator(".bs-spot:not(.bs-mine)").boundingBox())!;
    const first = (await page.locator(".rd-option").first().boundingBox())!;
    expect(stage.y, `${w}`).toBeGreaterThan(block.y + block.height);
    expect(first.y, `${w}`).toBeGreaterThan(stage.y + stage.height);
    // The tall tiles take most of a small phone: the first way to play is whole in the window from 740 px tall (the stage is smaller up to
    // 800 px tall for it), and at 568 px the boss's name is still in the window with the page scrolling on from there. That's with three
    // rows of tiles; each row past three (a fourth since Folio's tile, Oct 27: sixteen tiles, five to a row) moves both down by its
    // own height and gap, and nothing more.
    const rows = await page.locator(".bs-row").count();
    const rowBoxes = await page.locator(".bs-row").evaluateAll((es) => es.map((e) => e.getBoundingClientRect().top));
    const pitch = rows > 1 ? (rowBoxes.at(-1)! - rowBoxes[0]!) / (rows - 1) : 0;
    const extra = Math.max(0, rows - 3) * pitch;
    if (h! >= 740) expect(first.y + first.height, `${w}x${h}: the first way to play whole in the window (${rows} rows)`).toBeLessThanOrEqual(h! + extra);
    else expect((await page.locator(".bs-name").boundingBox())!.y + 48, `${w}x${h}: the boss's name in the window (${rows} rows)`).toBeLessThanOrEqual(h! + extra);
    // Every boss whole inside the stage's width (Wrangler's lasso out to one side, the tallest the Hidden Boss).
    for (const name of ["Ginger", "Boingo the Clown", "Jefferson", "Hollow", "Big Boy", "Sawyer", "Wrangler", "Alfil", "Chub & Chirp", "Smudgy", "Moo & Moon", "Puddles", "Babur", "Folio", "Locked boss"]) {
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

test("home's Boss Arena card: a still portrait that moves on to the next boss you can meet, never the Hidden Boss, the card never changing size", async ({ page }) => {
  // (?cardMs=: the turn quicker than its 30 s, a test switch: a second, so a busy machine's looks, about every 0.2 s,
  // never miss one.)
  await page.goto("/?debug&cardMs=1000");
  const card = page.getByRole("main").getByRole("button", { name: /^Boss Arena/ });
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
 * Your profile as the server would answer it, with a rating (and an admin's: the Hidden Boss in the full picker, its
 * longest list): Eric's, Oct 17 (1580).
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
    // Boss alone's menu, for the boss picked. An admin's has no brain picker any more (Eric, Oct 25: "get rid of that
    // Maia, no guard thing"): the difficulty, then the boss.
    await page.goto("/?mode=raid");
    await tile(page, "Sawyer").click();
    await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    const alone = page.getByRole("dialog", { name: "Boss alone" });
    await expect(alone.locator(".boss-difficulty")).toBeVisible();
    await expect(alone.getByRole("combobox")).toHaveCount(0);
    await expect(alone.getByText(/BRAIN|Maia/)).toHaveCount(0);
    await expectMenuFits(page, alone, `${w}x${h} Boss alone`);
    // The full picker (/bosses): every boss and a random one, for an admin the Hidden Boss too: the longest list.
    await page.goto("/bosses");
    const all = page.getByRole("dialog", { name: "Choose your boss" });
    await expect(all.locator(".boss-row")).toHaveCount(16);
    await expectMenuFits(page, all, `${w}x${h} /bosses`);
    expect(await sideways(page), `${w}x${h}`).toBe(0);
  }
});

test("the stage shows no number (Eric, Oct 25), the difficulty's name (Medium by default); Boss alone's menu shows the boss's strength at your difficulty and follows it as it changes", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone");
  await named(page, "Counter");
  // (1580: the tier a step above is 1600; Sawyer and Big Boy are 250 under it, Ginger 100: BOSS_DIFFICULTY's
  // Very easy −500, Easy −300, Medium 0, Hard +250, Very hard +500 on top.)
  await rated(page, 1580);
  await page.goto("/?mode=raid");
  const main = page.getByRole("main");
  const stage = page.locator(".bs-level");
  const menu = page.getByRole("dialog", { name: "Boss alone" });
  // (Boss alone's level: the difficulty's Maia rating, whatever the boss or your rating, Oct 18.)
  const cases: [string, string, number][] = [
    ["Sawyer", "Hard", 2050],
    ["Sawyer", "Medium", 1600],
    ["Ginger", "Easy", 1150],
    ["Ginger", "Very hard", 2500],
    ["Big Boy", "Hard", 2050],
  ];
  for (const [boss, level, elo] of cases) {
    await tile(page, boss).click();
    await main.getByRole("button", { name: /^Boss alone/ }).click();
    await menu.getByRole("radio", { name: level, exact: true }).click();
    // The menu's row shows the number; the stage behind it names the difficulty.
    await expect(menu.locator(".boss-row .br-elo strong")).toHaveText(String(elo));
    await expect(stage).toHaveText(level);
    await menu.getByRole("button", { name: "Close" }).click();
    await expect(menu).toHaveCount(0);
    await expect(stage).toHaveText(level);
  }
  // Remembered on this device: the stage after a reload, before the menu opens.
  await page.reload();
  await expect(page.locator(".bs-name")).toHaveText("Big Boy");
  await expect(stage).toHaveText("Hard");

  // The widest difficulty name (Very hard) on one line at 320 px, inside the window.
  await rated(page, 2950);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.reload();
  await tile(page, "Ginger").click();
  await main.getByRole("button", { name: /^Boss alone/ }).click();
  await menu.getByRole("radio", { name: "Very hard", exact: true }).click();
  await menu.getByRole("button", { name: "Close" }).click();
  await expect(stage).toHaveText("Very hard");
  const line = (await stage.boundingBox())!;
  expect(line.x).toBeGreaterThanOrEqual(0);
  expect(line.x + line.width).toBeLessThanOrEqual(320);
  // (One line of 14 px text is about 20 px tall with its emoji; two would be over 32.)
  expect(line.height).toBeLessThan(28);
  expect(await sideways(page)).toBe(0);
});

test("Boss Battle (Eric, Oct 29): home's card and the screen's header say so; five difficulty levels, the arrows stepping through them and stopping at the ends (greyed there, not hidden); your two invite circles are there, named, and nothing moves", async ({ page }) => {
  await named(page, "Party");
  await page.goto("/");
  await expect(page.getByRole("main").locator(".rd-card").filter({ hasText: /^Boss BattleAny boss, up to 3$/ })).toBeVisible();
  await openSoloBoss(page);
  const level = page.locator(".bs-level");
  const easier = page.getByRole("button", { name: "Easier" });
  const harder = page.getByRole("button", { name: "Harder" });
  // (Boxes on the page, not the window: a tap may scroll the page a little, which moves nothing in it.)
  const frame = () => page.evaluate(() => [".bs-stage", ".bs-start", ".bs-diff", ".bs-dots", ".bs-back.bs-l", ".bs-back.bs-r"].map((q) => { const r = document.querySelector(q)!.getBoundingClientRect(); return [r.x + scrollX, r.y + scrollY, r.width, r.height]; }));
  await expect(page.locator(".bs-dot")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Invite a friend", exact: true })).toHaveCount(2);
  await expect(page.locator(".bs-back")).toHaveCount(2);
  // Medium is the default (id normal); step down to the end, then up to the other end, then each stop holds.
  await expect(level).toHaveText("Medium");
  const still = await frame();
  const colors = new Set<string>();
  const seen = async (name: string, dotAt: number) => {
    await expect(level).toHaveText(name);
    colors.add(await level.evaluate((e) => getComputedStyle(e).color));
    await expect(page.locator(".bs-dot").nth(dotAt)).toHaveClass(/\bon\b/);
    expect(await page.locator(".bs-dot.on").count()).toBe(1);
    expect(await frame(), `${name}: nothing moves`).toEqual(still);
  };
  await easier.click();
  await seen("Easy", 1);
  await easier.click();
  await seen("Very easy", 0);
  await expect(easier).toHaveAttribute("aria-disabled", "true");
  await easier.click({ force: true });
  await seen("Very easy", 0);
  for (const [name, at] of [["Easy", 1], ["Medium", 2], ["Hard", 3], ["Very hard", 4]] as const) {
    await harder.click();
    await seen(name, at);
  }
  await expect(harder).toHaveAttribute("aria-disabled", "true");
  await harder.click({ force: true });
  await seen("Very hard", 4);
  expect(colors.size, "each level its own color").toBe(5);
  // Remembered by its stored id: a reload keeps it.
  await page.reload();
  await openSoloBoss(page);
  await expect(page.locator(".bs-level")).toHaveText("Very hard");
});
