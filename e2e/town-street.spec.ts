import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { asAdmin, test } from "./helpers.ts";

/**
 * The street town, round 2: the layout (Nov 5; docs/decisions/2026-11-05-street-town-layout.md), in an admin's town only
 * (admin-town.ts STREET_TOWN) until round 3. On a phone and a computer: it opens zoomed in, at the start (22, 11), the camera facing
 * north; a tap on Ginger Igloo walks you down Fountain Street to its door square and its card opens; the up arrow into Smudgy's Art
 * Gallery from its door opens his card; a park table works. A player's town is today's (e2e/town.spec.ts and the rest, unchanged).
 * `STILLS=docs/street-town` also writes the stills: each street, the park and a home's card.
 * Round 3 (Nov 5): the buildings are boxes and the camera turns: the turn walked on both renderers (a tap and an arrow mid-turn and
 * after, every figure on screen at rest). Round 4 (the rows, the chase camera, the plan wrapping east-west only, its rows 6 up): the
 * squares moved with the plan; the turn is the chase camera's (behind you, the way you walk); round 2's and 3's stills tests went with
 * their plans (round 4's are in e2e/town-rows.spec.ts).
 */
test.use({ actionTimeout: 15_000 });

// The chat log's box lies over a corner of the map and takes taps there (as in e2e/town.spec.ts): these tests aim at the map.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
});

const STILLS = process.env.STILLS;

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}
const canvas = (p: Page) => p.locator("canvas.town-canvas");
const you = async (p: Page) => (await canvas(p).getAttribute("data-you"))!.split(",").map(Number) as [number, number];
type Hooks = {
  __townAt?: (k: string, id?: unknown) => { x: number; y: number } | null;
  __townGlide?: (to: string | readonly [number, number]) => void;
  __townCam?: () => { zoom: number; zoomTarget: number; focus: number[] };
};

/** The street town, an admin's, open by day. */
async function openStreet(page: Page, query = "") {
  await asAdmin(page);
  await page.goto(`/town?sky=day${query}`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
}

/** Taps a home (the camera glides to it first) until its card opens. */
async function tapHome(page: Page, id: string, name: string) {
  const card = page.getByRole("dialog", { name, exact: true });
  await page.evaluate((h) => (window as unknown as Hooks).__townGlide?.(h), id);
  await expect(async () => {
    if (await card.isVisible()) return;
    const xy = await page.evaluate((h) => (window as unknown as Hooks).__townAt?.("home", h) ?? null, id);
    expect(xy, "drawn").not.toBeNull();
    const cv = (await canvas(page).boundingBox())!;
    await page.mouse.click(cv.x + xy!.x, cv.y + xy!.y);
    await expect(card).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
  return card;
}

test("an admin's street town opens at its default zoom step, at the start (22, 17), the camera facing north; a player's opens as today (zoomed out, at (22, 17))", async ({ page }) => {
  const errors = watchErrors(page);
  // A player's town: today's.
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  expect(await you(page)).toEqual([22, 17]);
  await expect(page.getByRole("button", { name: "Zoom out" })).toHaveAttribute("aria-pressed", "true");
  // An admin's: the street town.
  await openStreet(page);
  expect(await you(page)).toEqual([22, 17]);
  await expect(page.getByRole("button", { name: "Zoom in" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Zoom out" })).toHaveAttribute("aria-pressed", "false");
  const cam = (await page.evaluate(() => (window as unknown as Hooks).__townCam?.()))!;
  // (Round 4: the zoom is a step, 0 in .. 3 the overview; the default, 1, from the first frame. You open in the park: no step out.)
  expect(cam.zoom, "the default step from the first frame").toBe(1);
  expect(cam.zoomTarget).toBe(1);
  // Facing north: the camera looks up the board from behind you, its focus on your column, ahead of you (rows rising).
  expect(Math.abs(cam.focus[0]! - 22)).toBeLessThan(0.01);
  expect(cam.focus[1]!).toBeGreaterThanOrEqual(17);
  // The sky over the rooftops: the top of the world's box is sky (its blue), not a building.
  const top = await canvas(page).evaluate((cv: HTMLCanvasElement) => {
    const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, 4).data;
    let blue = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 2]! > d[i]! + 20 && d[i + 2]! > 150) blue++;
    return blue / (d.length / 4);
  });
  expect(top, "sky along the top").toBeGreaterThan(0.95);
  if (STILLS) {
    mkdirSync(STILLS, { recursive: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${STILLS}/1-park-${test.info().project.name}.png` });
  }
  expect(errors, "no page or console errors").toEqual([]);
});

test("walking down Fountain Street to Ginger Igloo's door: a tap on it walks you there, along the street, to its door square (34, 23), and its card opens", async ({ page }) => {
  const errors = watchErrors(page);
  await openStreet(page);
  await page.waitForTimeout(600);
  // Where you walk, every 50 ms.
  const seen: string[] = [];
  let watching = true;
  const watch = (async () => {
    while (watching) {
      seen.push((await you(page)).join(","));
      await page.waitForTimeout(50);
    }
  })();
  const card = await tapHome(page, "gingerbread", "Ginger Igloo");
  await expect.poll(async () => (await you(page)).join(","), { message: "at its door square", timeout: 20_000 }).toBe("34,23");
  watching = false;
  await watch;
  // (Out of the park east, along Fountain Street: columns 33 to 36, rows 19 to 22.)
  expect(seen.some((s) => /^3[3-6],(19|2[0-2])$/.test(s)), `along Fountain Street: ${[...new Set(seen)].join(" ")}`).toBe(true);
  await expect(card).toBeVisible();
  if (STILLS) {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${STILLS}/2-fountain-street-ginger-card-${test.info().project.name}.png` });
  }
  expect(errors, "no page or console errors").toEqual([]);
});

test("Smudgy's Art Gallery: a tap walks you to its door square (19, 8); from there the arrow toward it opens its card and you stay put", async ({ page }) => {
  const errors = watchErrors(page);
  await openStreet(page);
  await page.waitForTimeout(600);
  const card = await tapHome(page, "smudgy", "Smudgy's Art Gallery");
  await expect.poll(async () => (await you(page)).join(","), { message: "at its door square", timeout: 20_000 }).toBe("19,8");
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  const at = await you(page);
  // (Round 4's chase camera: the key toward the gallery, north of you, is whichever the way you face makes it: up ahead, left and right
  // a quarter round.)
  const key = await towardKey(page, "N");
  await page.keyboard.down(key);
  await expect(card, `the arrow (${key}) against the gallery opens its card`).toBeVisible({ timeout: 5000 });
  await page.keyboard.up(key);
  expect(await you(page), "you didn't walk into it").toEqual(at);
  expect(errors, "no page or console errors").toEqual([]);
});

test("a park table: a tap on the one ahead on your left walks you to a free stool and you sit; its card shows 'Casual' and 'Ranked' greyed; a tap elsewhere closes it and you stand", async ({ page }) => {
  const errors = watchErrors(page);
  await openStreet(page);
  await expect(canvas(page)).toHaveAttribute("data-sit", "0");
  // The park's fourth table, (19, 23), ahead on your left past the fountain: its stools (18, 23) and (20, 23). (The one on your row,
  // (19, 18), has a home's edge chip over it on a phone.)
  const at = await page.evaluate(() => (window as unknown as Hooks).__townAt?.("table", 3) ?? null);
  expect(at, "the table is drawn at the start").not.toBeNull();
  const cv = (await canvas(page).boundingBox())!;
  await page.mouse.click(cv.x + at!.x, cv.y + at!.y);
  const card = page.getByRole("dialog", { name: "Chess table", exact: true });
  await expect(card).toBeVisible();
  for (const name of ["Casual", "Ranked"]) await expect(card.getByRole("button", { name, exact: true })).toBeDisabled();
  await expect.poll(async () => (await you(page)).join(","), { message: "you walk to a stool", timeout: 5000 }).toMatch(/^(18|20),23$/);
  await expect(canvas(page)).toHaveAttribute("data-sit", "1");
  const stool = (await you(page)).join(",");
  await page.mouse.click(cv.x + cv.width * 0.3, cv.y + cv.height * 0.85);
  await expect(card).toBeHidden();
  await expect(canvas(page)).toHaveAttribute("data-sit", "0");
  expect((await you(page)).join(","), "you stand on the stool's square").toBe(stool);
  expect(errors, "no page or console errors").toEqual([]);
});

// ---- Round 3 (Nov 5): the buildings as boxes and the turning camera (docs/decisions/2026-11-05-street-town-boxes.md).

type Cam = {
  heading: number;
  headingTo: number;
  figures: { name: string; x0: number; y0: number; x1: number; y1: number; fy: number; alpha: number }[];
  boxes: { id: string; kind: string; facing: "S" | "N" | "W" | "E"; draws: number; front: boolean; facesYou: boolean; sides: number }[];
};
const cam = async (page: Page) => (await page.evaluate(() => (window as unknown as { __townCam: () => Cam }).__townCam()))!;
const walkTo = async (page: Page, sq: readonly [number, number]) => {
  await page.evaluate((s) => (window as unknown as { __townWalk: (s: readonly [number, number]) => boolean }).__townWalk(s), sq);
  await expect.poll(async () => (await you(page)).join(","), { message: `walked to ${sq}`, timeout: 30_000 }).toBe(sq.join(","));
};
/** Every figure drawn (a boss, a bot, you) whole inside the world's box (Eric, Nov 4), its foot on screen; a faded one may be off. */
async function figuresOnScreen(page: Page) {
  const cv = (await canvas(page).boundingBox())!;
  const c = await cam(page);
  expect(c.figures.length, "figures drawn").toBeGreaterThan(0);
  for (const f of c.figures) {
    if (f.alpha < 0.5) continue;
    expect(f.x0, `${f.name} not cut off on the left`).toBeGreaterThanOrEqual(-1);
    expect(f.x1, `${f.name} not cut off on the right`).toBeLessThanOrEqual(cv.width + 1);
    expect(f.y0, `${f.name} not cut off at the top`).toBeGreaterThanOrEqual(-1);
    expect(f.fy, `${f.name}'s foot on screen`).toBeLessThanOrEqual(cv.height + 1);
  }
}
/** Holds an arrow key until you've stepped off (c, r); answers where you ended up. */
async function arrowStep(page: Page, key: string) {
  const from = (await you(page)).join(",");
  await page.keyboard.down(key);
  await expect.poll(async () => (await you(page)).join(","), { message: `${key} walks you`, timeout: 5000 }).not.toBe(from);
  await page.keyboard.up(key);
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __townYou: () => { moving: boolean } }).__townYou().moving)), { timeout: 5000 }).toBe(false);
  return you(page);
}
/** A tap on square (c, r) where it's drawn now: you walk there. */
async function tapSquare(page: Page, sq: readonly [number, number]) {
  const xy = await page.evaluate((s) => (window as unknown as Hooks).__townAt?.("square", s as never) ?? null, sq);
  expect(xy, `${sq} drawn`).not.toBeNull();
  const cv = (await canvas(page).boundingBox())!;
  await page.mouse.click(cv.x + xy!.x, cv.y + xy!.y);
  await expect.poll(async () => (await you(page)).join(","), { message: `a tap walks you to ${sq}`, timeout: 15_000 }).toBe(sq.join(","));
}
const dist = (a: readonly number[], b: readonly number[]) => Math.abs(((a[0]! - b[0]! + 69) % 46) - 23) + Math.abs(a[1]! - b[1]!);

/** The arrow key that walks you toward `dir` (N, E, S or W) as the chase camera faces now: up ahead, right and left a quarter round. */
async function towardKey(page: Page, dir: "N" | "E" | "S" | "W") {
  const h = (await cam(page)).headingTo;
  const q = ((Math.round(h / 90) % 4) + 4) % 4;
  const d = { N: 0, E: 1, S: 2, W: 3 }[dir];
  return ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"][(d - q + 4) % 4]!;
}

for (const backend of ["2d", "webgl"] as const)
  test(`the boxes and the chase camera's turn (${backend}): down Seam Avenue and east into Fountain Street the camera swings behind you, eased; both rows drawn;${backend === "2d" ? " the arrows (up ahead, down back, left and right turning) and a tap mid-turn and after;" : ""} every figure on screen at rest`, async ({ page }) => {
    // (WebGL in the headless tests is software, about a third of 2D's frame rate: more time.)
    test.setTimeout(backend === "webgl" ? 400_000 : 150_000);
    const errors = watchErrors(page);
    await openStreet(page, backend === "webgl" ? "&gl=1" : "");
    await expect(canvas(page)).toHaveAttribute("data-backend", backend);
    // Down Seam Avenue (south) to Fountain Street's crossing: the camera behind you, facing south.
    await walkTo(page, [0, 26]);
    await walkTo(page, [0, 20]);
    await expect.poll(async () => ((((await cam(page)).heading % 360) + 360) % 360), { timeout: 5000 }).toBe(180);
    // A tap east along Fountain Street: the camera swings behind you a quarter round (from south to east), easing, seen midway.
    await page.evaluate(() => {
      const w = window as unknown as { __headings: number[]; __townCam: () => Cam };
      w.__headings = [];
      const t0 = performance.now();
      const look = () => {
        w.__headings.push(w.__townCam().heading);
        if (performance.now() - t0 < 6000) requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    // (As a tap would: the cross street isn't on screen from the crossing, so the walk hook takes you.)
    await page.evaluate(() => (window as unknown as { __townWalk: (s: readonly [number, number]) => boolean }).__townWalk([5, 20]));
    await expect.poll(async () => ((((await cam(page)).heading % 360) + 360) % 360), { timeout: 5000 }).toBe(90);
    const seen = (await page.evaluate(() => (window as unknown as { __headings: number[] }).__headings)).map((h) => (((h % 360) + 360) % 360));
    expect(seen.some((h) => h > 110 && h < 160), `turned through the middle: ${[...new Set(seen.map(Math.round))].join(" ")}`).toBe(true);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!, "eased one way, no jumps back").toBeLessThanOrEqual(seen[i - 1]!);
    // Along Fountain Street: both its rows drawn (fronts facing north and south), as boxes.
    await page.waitForTimeout(1200);
    const c = await cam(page);
    expect(c.boxes.filter((b) => b.facing === "S" && b.kind !== "hedge" && b.front).length, "its north row").toBeGreaterThanOrEqual(3);
    expect(c.boxes.filter((b) => b.facing === "N" && b.kind !== "hedge" && b.front).length, "its south row").toBeGreaterThanOrEqual(3);
    await figuresOnScreen(page);
    // (The keys and taps go through the same heading on either renderer: walked on Canvas 2D, where the headless tests run faster.)
    if (backend === "webgl") return void expect(errors, "no page or console errors").toEqual([]);
    // Up walks ahead (east); down steps back (west) without turning.
    // (A held key may take a second step before it's let go: each checked by its way, not its count.)
    const way = (a: readonly number[], b: readonly number[]) => [Math.sign(((b[0]! - a[0]! + 69) % 46) - 23), Math.sign(b[1]! - a[1]!)];
    let from = await you(page);
    let to = await arrowStep(page, "ArrowUp");
    expect(way(from, to), "up: ahead (east)").toEqual([1, 0]);
    from = to;
    to = await arrowStep(page, "ArrowDown");
    expect(way(from, to), "down: back (west)").toEqual([-1, 0]);
    expect((await cam(page)).headingTo % 360, "down doesn't turn").toBe(90);
    // Left turns you north and steps (the camera swings with you); right from there turns you east again.
    from = to;
    to = await arrowStep(page, "ArrowLeft");
    expect(way(from, to), "left: north").toEqual([0, 1]);
    await expect.poll(async () => ((((await cam(page)).heading % 360) + 360) % 360), { timeout: 5000 }).toBe(0);
    from = to;
    to = await arrowStep(page, "ArrowRight");
    expect(way(from, to), "right: east").toEqual([1, 0]);
    await expect.poll(async () => ((((await cam(page)).heading % 360) + 360) % 360), { timeout: 5000 }).toBe(90);
    // Mid-turn (held halfway between east and north): up still walks the way you're heading (east), and a tap where a square is drawn
    // walks you there.
    await page.evaluate(() => (window as unknown as { __townHeading: (h: number | null) => void }).__townHeading(45));
    await page.waitForTimeout(300);
    from = await you(page);
    to = await arrowStep(page, "ArrowUp");
    expect(way(from, to), "mid-turn: up is the way you head").toEqual([1, 0]);
    await tapSquare(page, [to[0]! + 1, 21]);
    await page.evaluate(() => (window as unknown as { __townHeading: (h: number | null) => void }).__townHeading(null));
    await page.waitForTimeout(1200);
    // After it: a tap still lands where it's aimed, and every figure on screen.
    from = await you(page);
    const q = ((Math.round((await cam(page)).headingTo / 90) % 4) + 4) % 4;
    const ahead = ([[0, 3], [3, 0], [0, -3], [-3, 0]] as const)[q]!;
    await tapSquare(page, [(from[0]! + ahead[0] + 46) % 46, from[1]! + ahead[1]]);
    await page.waitForTimeout(1200);
    await figuresOnScreen(page);
    expect(errors, "no page or console errors").toEqual([]);
  });
