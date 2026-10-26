import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * The town square (/town; hidden: docs/areas/town-square.md), on a phone and a computer: the page loads, its world is
 * drawn (not blank), a tap a few rows ahead walks you toward it, the zoom pair works (it opens zoomed out), back goes
 * home, and `?sky=` picks the sky's look whatever the clock says.
 * Slice 4: a boss's card ("Challenge alone", its confirm, Leave to the Boss raid screen with that boss's tile picked)
 * and a home's (its shop greyed, "Coming soon"). Slice 5: the Coliseum's (a tap on its gate walks you to the apron in
 * front of it; "Raids with people" greyed, "Coming soon").
 * Test hooks: the canvas carries `data-you="c,r"` (your square) and `data-ready="1"` once its first frame is drawn;
 * `window.__townAt("boss" | "home" | "coliseum", id)` says where to tap a boss, a home or the Coliseum's gate (with the
 * test switches on, as here).
 */
test.use({ actionTimeout: 15_000 });

/** Every page error and console error of a test: none may happen. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

const canvas = (p: Page) => p.locator("canvas.town-canvas");
const you = async (p: Page) => (await canvas(p).getAttribute("data-you"))!.split(",").map(Number) as [number, number];

/** How many distinct colors a sample of the canvas holds (a blank or one-color canvas has one or two). */
const colors = (p: Page) =>
  canvas(p).evaluate((cv: HTMLCanvasElement) => {
    const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    return seen.size;
  });

/** A small fingerprint of what the canvas shows now. */
const fingerprint = (p: Page) =>
  canvas(p).evaluate((cv: HTMLCanvasElement) => {
    const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 4 * 211) h = (Math.imul(h, 31) + d[i]! + d[i + 1]! * 7 + d[i + 2]! * 13) | 0;
    return h;
  });

test("the town square at /town: the world is drawn and fills its box under the bar; a tap a few rows ahead walks you there; the zoom pair works; back goes home", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/town");
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  expect(await colors(page), "the world is drawn, not blank").toBeGreaterThan(40);

  // The world fills the rest of the screen under the bar, phone or computer.
  const vp = page.viewportSize()!;
  const bar = (await page.locator(".town-bar").boundingBox())!;
  const cv = (await canvas(page).boundingBox())!;
  expect(Math.abs(cv.y - (bar.y + bar.height)), "the world starts right under the bar").toBeLessThanOrEqual(1.5);
  expect(Math.abs(cv.width - vp.width), "as wide as the screen").toBeLessThanOrEqual(1);
  expect(Math.abs(cv.y + cv.height - vp.height), "down to the screen's foot").toBeLessThanOrEqual(1);

  // A tap straight ahead, a third of the way down the world (several rows up from your pawn on either shape of box),
  // walks you that way: your row grows (to a square, or next to a bot or a home standing there).
  const [, r0] = await you(page);
  await page.mouse.click(cv.x + cv.width / 2, cv.y + cv.height / 3);
  await expect.poll(async () => (await you(page))[1], { message: "you walk ahead", timeout: 5000 }).toBeGreaterThanOrEqual(r0 + 2);

  // The zoom pair: the page opens zoomed out (− pressed; Eric, Oct 26); + zooms in (and the view changes), − back out.
  const zoomOut = page.getByRole("button", { name: "Zoom out" });
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  await expect(zoomOut).toHaveAttribute("aria-pressed", "true");
  await expect(zoomIn).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(1200); // (the walk and the camera settle)
  const before = await fingerprint(page);
  await zoomIn.click();
  await expect(zoomIn).toHaveAttribute("aria-pressed", "true");
  await expect(zoomOut).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => fingerprint(page), { message: "the view zooms in" }).not.toBe(before);
  await zoomOut.click();
  await expect(zoomOut).toHaveAttribute("aria-pressed", "true");
  // The controls stay put whatever the zoom (nothing shifts).
  await expect(page.getByRole("button", { name: "Back to me" })).toBeVisible();

  // Back goes home, and the address back to /.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  expect(errors).toEqual([]);
});

/** The sky's average color across a strip at the top of the canvas, middle third (CSS pixels 2 to 8 down). */
const skyTop = (p: Page) =>
  canvas(p).evaluate((cv: HTMLCanvasElement) => {
    const k = cv.width / cv.clientWidth;
    const d = cv.getContext("2d")!.getImageData(Math.round(cv.width / 3), Math.round(2 * k), Math.round(cv.width / 3), Math.round(6 * k)).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) ((r += d[i]!), (g += d[i + 1]!), (b += d[i + 2]!));
    const n = d.length / 4;
    return [r / n, g / n, b / n];
  });

test("the sky by the time of day: ?sky=day and ?sky=night draw different skies (a day's top is light blue, a night's deep navy)", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  const day = await skyTop(page);
  await page.goto("/town?sky=night");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  const night = await skyTop(page);
  const lum = ([r, g, b]: number[]) => 0.3 * r! + 0.59 * g! + 0.11 * b!;
  expect(day[2]!, `day's sky is blue: ${day.map(Math.round)}`).toBeGreaterThan(200);
  expect(lum(night), `night's sky is dark: ${night.map(Math.round)}`).toBeLessThan(40);
  expect(lum(day) - lum(night), "day is far lighter than night").toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

/** Where to tap Babur (or his circus) now, in the page; null while he isn't drawn. */
async function tapPoint(p: Page, kind: "boss" | "home") {
  const xy = await p.evaluate((k) => (window as unknown as { __townAt?: (k: string, id: string) => { x: number; y: number } | null }).__townAt?.(k, "tiger") ?? null, kind);
  if (!xy) return null;
  const cv = (await canvas(p).boundingBox())!;
  return { x: cv.x + xy.x, y: cv.y + xy.y };
}
/** Brings Babur's Circus into view: it's often there from the start; else its chip glides the camera to it. */
async function toBabur(p: Page) {
  if (await tapPoint(p, "home")) return;
  await p.getByRole("button", { name: "Go to Babur's Circus" }).click({ force: true });
  await expect.poll(() => tapPoint(p, "home"), { message: "the circus comes into view" }).not.toBeNull();
}
/**
 * Taps Babur or his circus until its card opens (he may stroll a step between the look and the tap; the hook's point is
 * one a tap would hit then).
 */
async function openCard(p: Page, kind: "boss" | "home", name: string) {
  const card = p.getByRole("dialog", { name, exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    // A tap that met someone else first (Babur strolling in front of his home) opened their card: close it, so the next
    // tap can't land on its buttons.
    if (await p.getByRole("dialog").isVisible()) await p.keyboard.press("Escape");
    const at = await tapPoint(p, kind);
    expect(at, "drawn").not.toBeNull();
    await p.mouse.click(at!.x, at!.y);
    await expect(card).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  return card;
}

test("a boss's card: 'Challenge alone', then 'Leave the town square?'; Stay keeps you, Leave opens the Boss raid screen with that boss's tile picked", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await toBabur(page);
  let card = await openCard(page, "boss", "Babur");
  await card.getByRole("button", { name: "Challenge alone" }).click();
  let confirm = page.getByRole("dialog", { name: "Leave the town square?" });
  await expect(confirm.getByRole("heading", { name: "Leave the town square?" })).toBeVisible();
  await expect(confirm.getByText("You'll fight Babur alone in Solo Boss Mode.")).toBeVisible();
  // Stay: the confirm closes, and you're still in the town square.
  await confirm.getByRole("button", { name: "Stay" }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  // Again, and Leave: the Boss raid screen (its tiles and stage), Babur's tile picked.
  card = await openCard(page, "boss", "Babur");
  await card.getByRole("button", { name: "Challenge alone" }).click();
  confirm = page.getByRole("dialog", { name: "Leave the town square?" });
  await confirm.getByRole("button", { name: "Leave" }).click();
  const tiles = page.getByRole("radiogroup", { name: "Bosses" });
  await expect(tiles).toBeVisible();
  await expect(tiles.getByRole("radio", { name: "Babur", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".bs-name")).toHaveText("Babur");
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.getByRole("heading", { name: "Town square" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a home's card: its name, 'Shop' greyed (shown, not tappable) and 'Coming soon'; a tap anywhere else closes it", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await toBabur(page);
  const card = await openCard(page, "home", "Babur's Circus");
  const shop = card.getByRole("button", { name: "Shop" });
  await expect(shop).toBeVisible();
  await expect(shop).toBeDisabled();
  await expect(card.getByText("Coming soon", { exact: true })).toBeVisible();
  // A tap on the world elsewhere (low in the middle) closes it.
  const cv = (await canvas(page).boundingBox())!;
  await page.mouse.click(cv.x + cv.width * 0.3, cv.y + cv.height * 0.85);
  await expect(card).toBeHidden();
  expect(errors).toEqual([]);
});

test("the Coliseum: a tap on its gate walks you to the apron in front of it and opens its card ('Raids with people' greyed, 'Coming soon'); a tap elsewhere closes it", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  // It stands just ahead of your start, in view from the first frame on a phone and a computer.
  const at = await page.evaluate(() => (window as unknown as { __townAt?: (k: string) => { x: number; y: number } | null }).__townAt?.("coliseum") ?? null);
  expect(at, "the Coliseum is drawn at the start").not.toBeNull();
  const cv = (await canvas(page).boundingBox())!;
  await page.mouse.click(cv.x + at!.x, cv.y + at!.y);
  const card = page.getByRole("dialog", { name: "The Coliseum", exact: true });
  await expect(card.getByRole("heading", { name: "The Coliseum" })).toBeVisible();
  const raids = card.getByRole("button", { name: "Raids with people" });
  await expect(raids).toBeVisible();
  await expect(raids).toBeDisabled();
  await expect(card.getByText("Coming soon", { exact: true })).toBeVisible();
  // You end on the apron at the gate: the row just in front of its ground (row 15), one of its two middle columns.
  await expect.poll(async () => (await you(page)).join(","), { message: "you walk to the gate", timeout: 5000 }).toMatch(/^(19|20),15$/);
  // A tap on the world elsewhere (low on the left) closes it.
  await page.mouse.click(cv.x + cv.width * 0.3, cv.y + cv.height * 0.85);
  await expect(card).toBeHidden();
  expect(errors).toEqual([]);
});
