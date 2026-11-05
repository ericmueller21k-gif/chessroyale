import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { asAdmin, test } from "./helpers.ts";

/**
 * The street town, round 2: the layout (Nov 5; docs/decisions/2026-11-05-street-town-layout.md), in an admin's town only
 * (admin-town.ts STREET_TOWN) until round 3. On a phone and a computer: it opens zoomed in, at the start (22, 11), the camera facing
 * north; a tap on Ginger Igloo walks you down Fountain Street to its door square and its card opens; the up arrow into Smudgy's Art
 * Gallery from its door opens his card; a park table works. A player's town is today's (e2e/town.spec.ts and the rest, unchanged).
 * `STILLS=docs/street-town` also writes the stills: each street, the park and a home's card.
 * Round 3 (Nov 5): the buildings are boxes and the camera turns on Seam Avenue: the turn walked on both renderers (fronts facing you before
 * and after, a tap and an arrow mid-turn and after, every figure on screen at rest); `STILLS=docs/street-town-boxes` its stills.
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

test("an admin's street town opens zoomed in, at the start (22, 11), the camera facing north; a player's opens as today (zoomed out, at (22, 17))", async ({ page }) => {
  const errors = watchErrors(page);
  // A player's town: today's.
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  expect(await you(page)).toEqual([22, 17]);
  await expect(page.getByRole("button", { name: "Zoom out" })).toHaveAttribute("aria-pressed", "true");
  // An admin's: the street town.
  await openStreet(page);
  expect(await you(page)).toEqual([22, 11]);
  await expect(page.getByRole("button", { name: "Zoom in" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Zoom out" })).toHaveAttribute("aria-pressed", "false");
  const cam = (await page.evaluate(() => (window as unknown as Hooks).__townCam?.()))!;
  expect(cam.zoom, "zoomed in from the first frame").toBe(0);
  expect(cam.zoomTarget).toBe(0);
  // Facing north: the camera looks up the board from behind you, its focus on your column, ahead of you (rows rising).
  expect(Math.abs(cam.focus[0]! - 22)).toBeLessThan(0.01);
  expect(cam.focus[1]!).toBeGreaterThanOrEqual(11);
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

test("walking down Fountain Street to Ginger Igloo's door: a tap on it walks you there, along the street, to its door square (34, 17), and its card opens", async ({ page }) => {
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
  await expect.poll(async () => (await you(page)).join(","), { message: "at its door square", timeout: 20_000 }).toBe("34,17");
  watching = false;
  await watch;
  // (Out of the park east, along Fountain Street: columns 33 to 36, rows 13 to 16.)
  expect(seen.some((s) => /^3[3-6],1[3-6]$/.test(s)), `along Fountain Street: ${[...new Set(seen)].join(" ")}`).toBe(true);
  await expect(card).toBeVisible();
  if (STILLS) {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${STILLS}/2-fountain-street-ginger-card-${test.info().project.name}.png` });
  }
  expect(errors, "no page or console errors").toEqual([]);
});

test("Smudgy's Art Gallery: a tap walks you to its door square (19, 2); from there the up arrow into it opens its card and you stay put", async ({ page }) => {
  const errors = watchErrors(page);
  await openStreet(page);
  await page.waitForTimeout(600);
  const card = await tapHome(page, "smudgy", "Smudgy's Art Gallery");
  await expect.poll(async () => (await you(page)).join(","), { message: "at its door square", timeout: 20_000 }).toBe("19,2");
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  const at = await you(page);
  await page.keyboard.down("ArrowUp");
  await expect(card, "the up arrow against the gallery opens its card").toBeVisible({ timeout: 5000 });
  await page.keyboard.up("ArrowUp");
  expect(await you(page), "you didn't walk into it").toEqual(at);
  expect(errors, "no page or console errors").toEqual([]);
});

test("a park table: a tap on the one ahead on your left walks you to a free stool and you sit; its card shows 'Casual' and 'Ranked' greyed; a tap elsewhere closes it and you stand", async ({ page }) => {
  const errors = watchErrors(page);
  await openStreet(page);
  await expect(canvas(page)).toHaveAttribute("data-sit", "0");
  // The park's fourth table, (19, 17), ahead on your left past the fountain: its stools (18, 17) and (20, 17). (The one on your row,
  // (19, 12), has a home's edge chip over it on a phone.)
  const at = await page.evaluate(() => (window as unknown as Hooks).__townAt?.("table", 3) ?? null);
  expect(at, "the table is drawn at the start").not.toBeNull();
  const cv = (await canvas(page).boundingBox())!;
  await page.mouse.click(cv.x + at!.x, cv.y + at!.y);
  const card = page.getByRole("dialog", { name: "Chess table", exact: true });
  await expect(card).toBeVisible();
  for (const name of ["Casual", "Ranked"]) await expect(card.getByRole("button", { name, exact: true })).toBeDisabled();
  await expect.poll(async () => (await you(page)).join(","), { message: "you walk to a stool", timeout: 5000 }).toMatch(/^(18|20),17$/);
  await expect(canvas(page)).toHaveAttribute("data-sit", "1");
  const stool = (await you(page)).join(",");
  await page.mouse.click(cv.x + cv.width * 0.3, cv.y + cv.height * 0.85);
  await expect(card).toBeHidden();
  await expect(canvas(page)).toHaveAttribute("data-sit", "0");
  expect((await you(page)).join(","), "you stand on the stool's square").toBe(stool);
  expect(errors, "no page or console errors").toEqual([]);
});

// The stills for Eric (STILLS=docs/street-town): each street, looking north along it, standing in the street two rows before a home's
// door; Seam Avenue from its own board, its fronts the stand-ins facing the camera till round 3's turn. (You walk there with the test
// switches' walk hook, as a tap on the square would walk you.)
test("stills: each street of the street town", async ({ page }) => {
  test.skip(!STILLS, "stills only (STILLS=docs/street-town)");
  test.setTimeout(180_000);
  await openStreet(page);
  const project = test.info().project.name;
  const at: [string, readonly [number, number]][] = [
    ["3-seam-street", [19, 0]], // (Smudgy's Art Gallery's door is (19, 2))
    ["7-seam-avenue", [45, 8]],
    ["4-fountain-street", [4, 15]], // (Timber's Lumber Lodge's, (4, 17))
    ["5-colosseum-row", [35, 23]], // (Big Boy's Crib's, (35, 25))
    ["6-upper-street", [39, 32]], // (Hollow Peak's, (39, 34))
  ];
  for (const [name, sq] of at) {
    await page.evaluate((s) => (window as unknown as { __townWalk?: (s: readonly [number, number]) => boolean }).__townWalk?.(s), sq);
    await expect.poll(async () => (await you(page)).join(","), { message: `walked to ${sq}`, timeout: 30_000 }).toBe(sq.join(","));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${STILLS}/${name}-${project}.png` });
  }
});

// ---- Round 3 (Nov 5): the buildings as boxes and the turning camera (docs/decisions/2026-11-05-street-town-boxes.md).

type Cam = {
  heading: number;
  headingTo: number;
  figures: { name: string; x0: number; y0: number; x1: number; y1: number; fy: number; alpha: number }[];
  boxes: { id: string; kind: string; facing: "S" | "W"; draws: number; front: boolean; facesYou: boolean; sides: number }[];
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

for (const backend of ["2d", "webgl"] as const)
  test(`the boxes and the turn (${backend}): walking east along Fountain Street onto Seam Avenue the camera turns, the fronts face you before and after; a tap and an arrow work mid-turn and after; every figure on screen at rest`, async ({ page }) => {
    // (WebGL in the headless tests is software, about a third of 2D's frame rate: more time.)
    test.setTimeout(backend === "webgl" ? 400_000 : 150_000);
    const errors = watchErrors(page);
    await openStreet(page, backend === "webgl" ? "&gl=1" : "");
    await expect(canvas(page)).toHaveAttribute("data-backend", backend);
    // Fountain Street, the camera north: the street's fronts (facing south) face you, drawn as boxes (their roofs and the row's ends).
    await walkTo(page, [39, 14]);
    await page.waitForTimeout(1200);
    let c = await cam(page);
    expect(c.heading).toBe(0);
    expect(c.boxes.filter((b) => b.facing === "S" && b.kind !== "hedge" && b.facesYou).length, "Fountain Street's fronts face you").toBeGreaterThanOrEqual(3);
    expect(c.boxes.some((b) => b.draws > 1), "boxes: roofs and sides").toBe(true);
    await figuresOnScreen(page);
    // East along it with the right arrow, onto the avenue's crossing (still north there).
    await page.keyboard.down("ArrowRight");
    for (let i = 0; i < 400 && (await you(page))[0]! < 43; i++) await page.waitForTimeout(15);
    await page.keyboard.up("ArrowRight");
    expect((await you(page))[1], "along the street").toBe(14);
    await walkTo(page, [45, 14]);
    const at = await you(page);
    expect((await cam(page)).heading).toBe(0);
    // A tap up the avenue, out of the crossing: the camera turns east as you leave it, easing (seen midway, frame by frame), about you.
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
    await tapSquare(page, [at[0]!, 19]);
    await expect.poll(async () => (await cam(page)).heading, { timeout: 5000 }).toBe(90);
    const seen = await page.evaluate(() => (window as unknown as { __headings: number[] }).__headings);
    expect(seen.some((h) => h > 20 && h < 70), `turned through the middle: ${[...new Set(seen.map(Math.round))].join(" ")}`).toBe(true);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!, "eased one way, no jumps back").toBeGreaterThanOrEqual(seen[i - 1]!);
    // Down the avenue past the crossing (north there, east again after): its own fronts (facing west) face you.
    await walkTo(page, [45, 8]);
    await expect.poll(async () => (await cam(page)).heading, { timeout: 5000 }).toBe(90);
    await page.waitForTimeout(1200);
    c = await cam(page);
    expect(c.boxes.filter((b) => b.facing === "W" && b.kind !== "hedge" && b.facesYou).length, "Seam Avenue's fronts face you").toBeGreaterThanOrEqual(2);
    await figuresOnScreen(page);
    // Mid-turn (held halfway): the up arrow walks you the way the screen's up points most nearly (east), and a tap where a square is drawn
    // walks you there.
    await page.evaluate(() => (window as unknown as { __townHeading: (h: number | null) => void }).__townHeading(50));
    await page.waitForTimeout(300);
    let from = await you(page);
    let to = await arrowStep(page, "ArrowUp");
    expect(to[1], "mid-turn: up is east, so along the row").toBe(from[1]);
    expect(dist(to, [from[0]! + 1, from[1]!])).toBeLessThanOrEqual(dist(to, [from[0]! - 1, from[1]!]) - 1);
    await tapSquare(page, [44, 9]);
    await page.evaluate(() => (window as unknown as { __townHeading: (h: number | null) => void }).__townHeading(null));
    await expect.poll(async () => (await cam(page)).heading, { timeout: 5000 }).toBe(90);
    await page.waitForTimeout(800);
    // After the turn (the camera east): right is south, and a tap still lands where it's aimed.
    from = await you(page);
    to = await arrowStep(page, "ArrowRight");
    expect(to[0], "facing east: right is south, so down the avenue").toBe(from[0]);
    expect(to[1]).toBeLessThan(from[1]!);
    await tapSquare(page, [0, 7]);
    await page.waitForTimeout(1200);
    expect((await cam(page)).heading).toBe(90);
    await figuresOnScreen(page);
    expect(errors, "no page or console errors").toEqual([]);
  });

// The stills for Eric (STILLS=docs/street-town-boxes): a street by day and at dusk, the turn's three frames (from Fountain Street's
// crossing onto Seam Avenue: before, halfway (held), after), and a boss home's sides (Boingo's Funhouse on Colosseum Row's corner).
test("stills: the boxes and the turn", async ({ page }) => {
  test.skip(!STILLS, "stills only (STILLS=docs/street-town-boxes)");
  test.setTimeout(240_000);
  mkdirSync(STILLS!, { recursive: true });
  const project = test.info().project.name;
  const shot = async (name: string) => {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${STILLS}/${name}-${project}.png` });
  };
  for (const sky of ["day", "dusk"]) {
    await asAdmin(page);
    await page.goto(`/town?sky=${sky}`);
    await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
    await walkTo(page, [18, 0]);
    await shot(`1-seam-street-${sky}`);
  }
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  await walkTo(page, [45, 15]);
  await shot("2-turn-1-before");
  await page.evaluate(() => (window as unknown as { __townHeading: (h: number | null) => void }).__townHeading(45));
  await shot("2-turn-2-mid");
  await page.evaluate(() => (window as unknown as { __townHeading: (h: number | null) => void }).__townHeading(null));
  await walkTo(page, [45, 19]);
  await shot("2-turn-3-after");
  await walkTo(page, [1, 23]);
  await shot("3-home-sides-funhouse");
});
