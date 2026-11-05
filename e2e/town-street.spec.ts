import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { asAdmin, test } from "./helpers.ts";

/**
 * The street town, round 2: the layout (Nov 5; docs/decisions/2026-11-05-street-town-layout.md), in an admin's town only
 * (admin-town.ts STREET_TOWN) until round 3. On a phone and a computer: it opens zoomed in, at the start (22, 11), the camera facing
 * north; a tap on Ginger Igloo walks you down Fountain Street to its door square and its card opens; the up arrow into Smudgy's Art
 * Gallery from its door opens his card; a park table works. A player's town is today's (e2e/town.spec.ts and the rest, unchanged).
 * `STILLS=docs/street-town` also writes the stills: each street, the park and a home's card.
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
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
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
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
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

// The stills for Eric (STILLS=docs/street-town): each street, looking north along it, standing at a home's door (as a tap on it walks
// you); Seam Avenue from its own board, its fronts the stand-ins facing the camera till round 3's turn.
test("stills: each street of the street town", async ({ page }) => {
  test.skip(!STILLS, "stills only (STILLS=docs/street-town)");
  test.setTimeout(180_000);
  await openStreet(page);
  const project = test.info().project.name;
  const shot = async (name: string) => {
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${STILLS}/${name}-${project}.png` });
  };
  /** Holds an arrow until you stand where `done` says. */
  const run = async (key: string, done: (c: number, r: number) => boolean) => {
    await page.keyboard.down(key);
    await expect.poll(async () => done(...(await you(page))), { timeout: 20_000, intervals: [30] }).toBe(true);
    await page.keyboard.up(key);
  };
  const visit = async (id: string, name: string, door: string) => {
    const card = await tapHome(page, id, name);
    await expect.poll(async () => (await you(page)).join(","), { message: `at ${name}'s door`, timeout: 30_000 }).toBe(door);
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    // (Then two steps back into the street, to see its row of fronts as you walk it.)
    const r0 = Number(door.split(",")[1]);
    await run("ArrowDown", (_c, r) => (r0 - r + 46) % 46 >= 2);
  };
  await visit("smudgy", "Smudgy's Art Gallery", "19,2");
  await shot("3-seam-street");
  // West along Seam Street's board, round the seam onto Seam Avenue, and up it.
  await run("ArrowLeft", (c) => c >= 44 || c <= 1);
  await run("ArrowUp", (_c, r) => r >= 8 && r < 20);
  await shot("7-seam-avenue");
  await visit("timber", "Timber's Lumber Lodge", "4,17");
  await shot("4-fountain-street");
  await visit("bigboy", "Big Boy's Crib", "35,25");
  await shot("5-colosseum-row");
  await visit("hollow", "Hollow Peak", "39,34");
  await shot("6-upper-street");
});
