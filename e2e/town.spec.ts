import { expect, type Page } from "@playwright/test";
import { BOTS, STATUES, TABLES } from "../packages/app/src/town/world.ts";
import { BOARD_SEL, test } from "./helpers.ts";

/**
 * The town square (/town; hidden: docs/areas/town-square.md), on a phone and a computer: the page loads, its world is
 * drawn (not blank), a tap a few rows ahead walks you toward it, the zoom pair works (it opens zoomed out), back goes
 * home, and `?sky=` picks the sky's look whatever the clock says.
 * Slice 4: a boss's card ("Challenge alone", its confirm, Leave to the Boss raid screen with that boss's tile picked)
 * and a home's (its shop greyed, "Coming soon"). Slice 5: the Colosseum's (a tap on its gate walks you to the apron in
 * front of it; "Raids with people" greyed, "Coming soon"). Slice 6: the park's chess tables (a tap on one walks you to a
 * free stool, you sit, its card shows "Casual" and "Ranked" greyed and "Coming soon"; a tap elsewhere closes it and you
 * stand), on the bigger map round the bigger Colosseum. The lights (Oct 27): at `?sky=night` a park lamp's glass and Babur's
 * Circus's lit doorway are clearly warmer and brighter than at `?sky=day`.
 * Test hooks: the canvas carries `data-you="c,r"` (your square) and `data-ready="1"` once its first frame is drawn;
 * `window.__townAt("boss" | "home" | "coliseum", id)` says where to tap a boss, a home or the Colosseum's gate (with the
 * test switches on, as here); `__townAt("lamp", i)` where a park lamp's glass is, `__townAt("light", id)` a lit pixel of a
 * home's light with nothing in front of it.
 */
test.use({ actionTimeout: 15_000 });

// The chat log's text field (Oct 28; shown where the test switches are on, as here) lies over a corner of the map and takes taps
// there; on the phone project's short screen that corner holds the Colosseum's gate and the marble statue. These tests aim at the
// map, so the field lets taps through (e2e/town-chat.spec.ts tests the field itself). No check changed.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".tc-form{pointer-events:none!important}";
      document.head.append(s);
    });
  });
});

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

/**
 * The sky's average color across a strip at the top of the canvas, its left and right sixths (CSS pixels 2 to 8 down).
 * (Slices 1 to 5 sampled its middle third; slice 6's bigger Colosseum rises out of the box's top there on a computer, so
 * the strip is either side of it, where the top is sky on a phone and a computer.)
 */
const skyTop = (p: Page) =>
  canvas(p).evaluate((cv: HTMLCanvasElement) => {
    const k = cv.width / cv.clientWidth;
    const g2 = cv.getContext("2d")!;
    const w = Math.round(cv.width / 6);
    const left = g2.getImageData(0, Math.round(2 * k), w, Math.round(6 * k)).data;
    const right = g2.getImageData(cv.width - w, Math.round(2 * k), w, Math.round(6 * k)).data;
    const d = new Uint8ClampedArray(left.length + right.length);
    d.set(left);
    d.set(right, left.length);
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) ((r += d[i]!), (g += d[i + 1]!), (b += d[i + 2]!));
    const n = d.length / 4;
    return [r / n, g / n, b / n];
  });

test("a deploy landed while the page was open: the town square's files are gone, so the page loads again, once, and the town opens", async ({ page }) => {
  // (After a deploy the old version's files are gone: the first ask for the town's styles fails as it would then.)
  let asked = 0;
  await page.route(/\/assets\/Town-[^/]*\.css$/, (route) => (asked++ === 0 ? route.fulfill({ status: 404, body: "" }) : route.continue()));
  let loads = 0;
  page.on("load", () => loads++);
  await page.goto("/town");
  await expect.poll(() => loads, { message: "the page loaded again" }).toBe(2);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  // (The second time the app's service worker serves them: no route sees that ask.)
  expect(asked, "the styles were refused").toBeGreaterThanOrEqual(1);
  expect(loads, "the page loaded again, once").toBe(2);
  expect(await colors(page), "the world is drawn, not blank").toBeGreaterThan(40);
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

/**
 * The average color of the canvas round a test hook's point (`__townAt(kind, id)`: a lamp's glass, a home's lit pixel),
 * a CSS pixel each way, read in the same moment as the point; null while the hook has none (not drawn, or someone stands
 * in front of it).
 */
const glowAt = (p: Page, kind: "lamp" | "light", id: number | string) =>
  canvas(p).evaluate(
    (cv: HTMLCanvasElement, [kind, id]) => {
      const at = (window as unknown as { __townAt: (k: string, id: number | string) => { x: number; y: number } | null }).__townAt(kind, id);
      if (!at) return null;
      const k = cv.width / cv.clientWidth;
      const n = Math.max(1, Math.round(2 * k));
      const d = cv.getContext("2d")!.getImageData(Math.round((at.x - 1) * k), Math.round((at.y - 1) * k), n, n).data;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < d.length; i += 4) ((r += d[i]!), (g += d[i + 1]!), (b += d[i + 2]!));
      return [r / (n * n), g / (n * n), b / (n * n)];
    },
    [kind, id] as const,
  );

test("the lights at dusk and night: at ?sky=night a park lamp's glass and Babur's Circus's lit doorway are clearly warmer and brighter than at ?sky=day", async ({ page }) => {
  const errors = watchErrors(page);
  const lum = ([r, g, b]: number[]) => 0.3 * r! + 0.59 * g! + 0.11 * b!;
  const warm = ([r, , b]: number[]) => r! - b!;
  const look = async (sky: string) => {
    await page.goto(`/town?sky=${sky}`);
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    // The lamp ahead on your left as the page opens (a bot may stroll in front of it a moment: wait till it's clear).
    let lamp: number[] | null = null;
    await expect(async () => {
      lamp = await glowAt(page, "lamp", 0);
      expect(lamp, "the lamp's glass shows").not.toBeNull();
    }).toPass({ timeout: 20_000 });
    // Babur's Circus: its doorway (Babur and his balloons may stand in front of it a moment).
    await toBabur(page);
    let door: number[] | null = null;
    await expect(async () => {
      door = await glowAt(page, "light", "tiger");
      expect(door, "the circus's doorway shows").not.toBeNull();
    }).toPass({ timeout: 20_000 });
    return { lamp: lamp!, door: door! };
  };
  const day = await look("day");
  const night = await look("night");
  for (const k of ["lamp", "door"] as const) {
    const msg = `${k}: day ${day[k].map(Math.round)}, night ${night[k].map(Math.round)}`;
    expect(lum(night[k]) - lum(day[k]), `${msg}: brighter at night`).toBeGreaterThan(25);
    expect(warm(night[k]) - warm(day[k]), `${msg}: warmer at night`).toBeGreaterThan(25);
  }
  expect(errors).toEqual([]);
});

test("a boss's card: 'Challenge alone', then 'Leave the town square?'; Stay keeps you, Leave opens the Boss raid screen with that boss's tile picked", async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => ((window as any).__soundLog = []));
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await toBabur(page);
  let card = await openCard(page, "boss", "Babur");
  // He says something as his card opens (Eric, Oct 27: his select sound), once: its confirm opening is the same card.
  const said = () => page.evaluate(() => ((window as any).__soundLog as string[]).filter((l) => l.startsWith("tigerHello")).length);
  await expect.poll(said).toBe(1);
  await card.getByRole("button", { name: "Challenge alone" }).click();
  let confirm = page.getByRole("dialog", { name: "Leave the town square?" });
  await expect(confirm.getByRole("heading", { name: "Leave the town square?" })).toBeVisible();
  expect(await said()).toBe(1);
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

test("the Colosseum: a tap on its gate walks you to the apron in front of it and opens its card ('Raids with people' greyed, 'Coming soon'); a tap elsewhere closes it", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  // It stands just ahead of your start, in view from the first frame on a phone and a computer.
  const at = await page.evaluate(() => (window as unknown as { __townAt?: (k: string) => { x: number; y: number } | null }).__townAt?.("coliseum") ?? null);
  expect(at, "the Colosseum is drawn at the start").not.toBeNull();
  const cv = (await canvas(page).boundingBox())!;
  await page.mouse.click(cv.x + at!.x, cv.y + at!.y);
  const card = page.getByRole("dialog", { name: "The Colosseum", exact: true });
  await expect(card.getByRole("heading", { name: "The Colosseum" })).toBeVisible();
  const raids = card.getByRole("button", { name: "Raids with people" });
  await expect(raids).toBeVisible();
  await expect(raids).toBeDisabled();
  await expect(card.getByText("Coming soon", { exact: true })).toBeVisible();
  // You end on the apron at the gate: the row just in front of its ground (row 27), one of its two middle columns.
  await expect.poll(async () => (await you(page)).join(","), { message: "you walk to the gate", timeout: 5000 }).toMatch(/^(22|23),27$/);
  // A tap on the world elsewhere (low on the left) closes it.
  await page.mouse.click(cv.x + cv.width * 0.3, cv.y + cv.height * 0.85);
  await expect(card).toBeHidden();
  expect(errors).toEqual([]);
});

/** The camera now (the test hook): its zoom, its lens, where it looks, the statue it's close on and whether the quote shows. */
type Cam = {
  zoom: number;
  zoomTarget: number;
  mag: number;
  focus: [number, number];
  statue: string | null;
  close: number;
  closingIn: boolean;
  quote: boolean;
  /** The statue up close: its top and bottom as shares of the world's box. */
  box: [number, number] | null;
  /** The quote's letters' height, CSS pixels. */
  cap: number;
};
const cam = (p: Page) => p.evaluate(() => (window as unknown as { __townCam: () => Cam }).__townCam());

// (Their squares from the town's own layout, so they follow the Colosseum if it moves: in front of its ground's last and
// first columns.)
const statueSq = (id: "bronze" | "marble") => {
  const s = STATUES.find((x) => x.id === id)!;
  return [s.c, s.r] as const;
};
for (const st of [
  { id: "bronze", sq: statueSq("bronze"), quote: "Concrete considerations always take precedence over general principles", zoomIn: false },
  { id: "marble", sq: statueSq("marble"), quote: "Nothing is so healing as the human touch", zoomIn: true },
] as const) {
  test(`the ${st.id} statue: a tap on it walks you up to it, the camera glides in close on it and its quote shows word for word; a tap elsewhere glides back out to the zoom you had and clears it`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/town");
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    const live = page.locator(".town-sr");
    await expect(live).toHaveText("");
    // (The marble one from the zoomed-in view: the camera comes back to whichever zoom you had.)
    if (st.zoomIn) {
      await page.getByRole("button", { name: "Zoom in" }).click();
      await expect.poll(async () => (await cam(page)).zoom, { message: "zoomed in" }).toBe(0);
    }
    const before = await cam(page);
    expect(before.mag, "no close-up yet").toBe(1);
    expect(before.statue).toBeNull();
    const cv = (await canvas(page).boundingBox())!;
    // Both statues stand on the Colosseum's front, in view from the start.
    const at = await page.evaluate((id) => (window as unknown as { __townAt: (k: string, id: string) => { x: number; y: number } | null }).__townAt("statue", id), st.id);
    expect(at, "the statue is drawn").not.toBeNull();
    await page.mouse.click(cv.x + at!.x, cv.y + at!.y);
    // You walk to the square right in front of it; the camera glides in close on it; the quote renders in.
    await expect.poll(async () => (await you(page)).join(","), { message: "you walk up to the statue", timeout: 6000 }).toBe(st.sq.join(","));
    await expect.poll(async () => (await cam(page)).quote, { message: "the camera arrives and the quote shows", timeout: 6000 }).toBe(true);
    const close = await cam(page);
    expect(close.statue).toBe(st.id);
    expect(close.close).toBe(1);
    // Close: the statue and its pedestal fill most of the world's box, whole (from either zoom: the lens differs).
    expect(close.mag, "a longer lens").toBeGreaterThan(2);
    expect(close.box![1] - close.box![0], `the statue fills the box (${close.box})`).toBeGreaterThan(0.7);
    expect(close.box![0], "its head in view").toBeGreaterThanOrEqual(0);
    expect(close.box![1], "its pedestal's foot in view").toBeLessThanOrEqual(1);
    expect(close.cap, "the quote's letters readable on a phone (12 px or more, on a pedestal of normal size)").toBeGreaterThanOrEqual(12);
    expect(Math.abs(close.focus[0] - st.sq[0]) + Math.abs(close.focus[1] - st.sq[1]), "the camera looks at the statue's square").toBeLessThan(0.1);
    expect(close.zoom, "the − / + zoom itself is untouched").toBe(before.zoom);
    await expect(live).toHaveText(st.quote, { useInnerText: true });
    expect(await live.textContent(), "the quote, word for word").toBe(st.quote);
    // The HUD stays put: the zoom pair and "Back to me" are where they were.
    await expect(page.getByRole("button", { name: "Back to me" })).toBeVisible();
    // A tap elsewhere (high in the middle, over the statue's head: the Colosseum's wall) walks you away: the camera glides
    // back out to the zoom you had, and the quote is gone.
    await page.mouse.click(cv.x + cv.width / 2, cv.y + cv.height * 0.03);
    await expect(live).toHaveText("");
    await expect.poll(async () => (await cam(page)).statue, { message: "the close-up ends", timeout: 5000 }).toBeNull();
    const after = await cam(page);
    expect(after.mag, "the lens is back to none").toBe(1);
    expect(after.zoom, "back to the zoom you had").toBe(before.zoom);
    expect(after.quote).toBe(false);
    expect(errors).toEqual([]);
  });
}

test("a chess table in the park: a tap on one walks you to a free stool and you sit; its card (no title: Eric, Oct 27) shows 'Casual' and 'Ranked' greyed and 'Coming soon'; a tap elsewhere closes it and you stand", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await expect(canvas(page)).toHaveAttribute("data-sit", "0");
  // The table on your left as you start (the park's seventh, on your row: its square (19, 13), its stools (18, 13) and (20, 13)).
  const at = await page.evaluate(() => (window as unknown as { __townAt: (k: string, id: number) => { x: number; y: number } | null }).__townAt("table", 6));
  expect(at, "the table is drawn at the start").not.toBeNull();
  const cv = (await canvas(page).boundingBox())!;
  await page.mouse.click(cv.x + at!.x, cv.y + at!.y);
  const card = page.getByRole("dialog", { name: "Chess table", exact: true });
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading")).toHaveCount(0);
  for (const name of ["Casual", "Ranked"]) {
    const b = card.getByRole("button", { name, exact: true });
    await expect(b).toBeVisible();
    await expect(b).toBeDisabled();
  }
  await expect(card.getByText("Coming soon", { exact: true })).toBeVisible();
  // You walk to its nearer stool (nobody on it at the start) and sit.
  await expect.poll(async () => (await you(page)).join(","), { message: "you walk to a stool", timeout: 5000 }).toMatch(/^(18|20),13$/);
  await expect(canvas(page)).toHaveAttribute("data-sit", "1");
  const stool = (await you(page)).join(",");
  // A tap on the world elsewhere (low on the left) closes it, and you stand up where you are.
  await page.mouse.click(cv.x + cv.width * 0.3, cv.y + cv.height * 0.85);
  await expect(card).toBeHidden();
  await expect(canvas(page)).toHaveAttribute("data-sit", "0");
  expect((await you(page)).join(","), "you stand on the stool's square").toBe(stool);
  expect(errors).toEqual([]);
});

test("Folio's Folded House: a tap walks you there and opens its card with its name; at ?sky=night its doorway's lamplight keeps its brightness, warm, as the town darkens", async ({ page }) => {
  const errors = watchErrors(page);
  const name = "Folio's Folded House";
  const at = async () => {
    const xy = await page.evaluate(() => (window as unknown as { __townAt?: (k: string, id: string) => { x: number; y: number } | null }).__townAt?.("home", "folio") ?? null);
    if (!xy) return null;
    const cv = (await canvas(page).boundingBox())!;
    return { x: cv.x + xy.x, y: cv.y + xy.y };
  };
  const card = page.getByRole("dialog", { name, exact: true });
  /** Taps the house (its chip first when it's off screen) until its card opens: you walk to it, the camera with you, till you stop. */
  const visit = async () => {
    const chip = page.getByRole("button", { name: `Go to ${name}` });
    if (!(await at()) && (await chip.count())) await chip.click({ force: true });
    await expect(async () => {
      if (await card.isVisible()) return;
      if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
      const p = await at();
      expect(p, "drawn").not.toBeNull();
      await page.mouse.click(p!.x, p!.y);
      await expect(card).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 30_000 });
    const you = () => canvas(page).getAttribute("data-you");
    await expect(async () => {
      const a = await you();
      await page.waitForTimeout(600);
      expect(await you()).toBe(a);
    }).toPass({ timeout: 30_000 });
    await page.waitForTimeout(800);
  };
  const lum = ([r, g, b]: number[]) => 0.3 * r! + 0.59 * g! + 0.11 * b!;
  const door: Record<string, number[]> = {};
  for (const sky of ["day", "night"]) {
    await page.goto(`/town?sky=${sky}`);
    await expect(canvas(page)).toHaveAttribute("data-ready", "1");
    await visit();
    await expect(card.getByRole("heading", { name })).toBeVisible();
    await expect(card.getByText("Coming soon", { exact: true })).toBeVisible();
    // Folio's paper crane steps round behind its house and stays: its picture's box is wide, and standing in front it
    // covered the doorway for the whole wait (seen Oct 27, 1 run in 10 on a computer).
    await expect.poll(() => page.evaluate(() => (window as unknown as { __townBossBack: (id: string) => boolean }).__townBossBack("folio")), { timeout: 15_000 }).toBe(true);
    await page.waitForTimeout(300);
    await expect(async () => {
      const c = await glowAt(page, "light", "folio");
      expect(c, "its doorway shows").not.toBeNull();
      door[sky] = c!;
    }).toPass({ timeout: 20_000 });
  }
  // (Its doorway is lamplight in its art by day already. The night darkens every unlit pixel of the town by about a third (its tint,
  // 34%); its doorway, lit, keeps its brightness and stays warm.)
  const msg = `door day ${door.day}, night ${door.night}`;
  expect(lum(door.night!), `${msg}: as bright at night`).toBeGreaterThanOrEqual(lum(door.day!) - 10);
  expect(lum(door.night!), `${msg}: bright`).toBeGreaterThan(190);
  expect(door.night![0]! - door.night![2]!, `${msg}: warm`).toBeGreaterThan(40);
  expect(errors).toEqual([]);
});

/** Each table's state now (the test hook): "still", "waiting:<free stool>" or "playing". */
const tables = (p: Page) => p.evaluate(() => (window as unknown as { __townTables: () => string[] }).__townTables());
const seat = (p: Page, i: number, n: 1 | 2) => p.evaluate(([i, n]) => (window as unknown as { __townSeat: (i: number, n: number) => void }).__townSeat(i, n), [i, n] as const);

test("the tables' boards (Eric, Oct 27): one bot sitting waits (a green ring under the free stool); two play (the pieces move, a clock over the board); a tap on a game offers 'Spectate', greyed, 'Coming soon', and you don't sit", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  expect((await tables(page)).every((s) => s === "still" || s.startsWith("waiting") || s === "playing")).toBe(true);
  // One bot on the west stool of the table on your left: it waits, the east stool free.
  await seat(page, 6, 1);
  await expect.poll(async () => (await tables(page))[6], { message: "a bot sits and waits", timeout: 15_000 }).toBe("waiting:1");
  // A second on the east stool: a game.
  await seat(page, 6, 2);
  await expect.poll(async () => (await tables(page))[6], { message: "two bots play", timeout: 15_000 }).toBe("playing");
  // The board changes as they play (its pixels over the table differ a couple of moves apart).
  const at = await page.evaluate(() => (window as unknown as { __townAt: (k: string, id: number) => { x: number; y: number } | null }).__townAt("table", 6));
  expect(at).not.toBeNull();
  const cv = (await canvas(page).boundingBox())!;
  const shot = async () => (await page.screenshot({ clip: { x: cv.x + at!.x - 40, y: cv.y + at!.y - 50, width: 80, height: 80 } })).toString("base64");
  const before = await shot();
  await expect.poll(shot, { message: "the pieces move", timeout: 5000 }).not.toBe(before);
  // A tap on it: you walk beside it (both stools taken) and don't sit; its card offers to watch, greyed.
  await page.mouse.click(cv.x + at!.x, cv.y + at!.y);
  const card = page.getByRole("dialog", { name: "Chess table", exact: true });
  const watch = card.getByRole("button", { name: "Spectate", exact: true });
  await expect(watch).toBeVisible();
  await expect(watch).toBeDisabled();
  await expect(card.getByText("Coming soon", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Casual" })).toHaveCount(0);
  await expect(canvas(page)).toHaveAttribute("data-sit", "0");
  expect(errors).toEqual([]);
});

// ---------------- Playing a town bot (Oct 27, Eric; docs/areas/town-square.md, "Playing a bot") ----------------

type BotRow = { name: string; at: string; table: number; moving: boolean };
const bots = (p: Page) => p.evaluate(() => (window as unknown as { __townBots: () => BotRow[] }).__townBots());
const tapAt = async (p: Page, kind: string, id: number) => {
  const at = await p.evaluate(([k, i]) => (window as unknown as { __townAt: (k: string, id: number) => { x: number; y: number } | null }).__townAt(k, i), [kind, id] as const);
  expect(at, `${kind} ${id} is drawn`).not.toBeNull();
  const cv = (await canvas(p).boundingBox())!;
  await p.mouse.click(cv.x + at!.x, cv.y + at!.y);
};
const sideOf = async (p: Page) => (await p.locator(".dv-strip.dv-you").getAttribute("data-side")) as "w" | "b";
/** A move by two taps on the game's board. */
async function tapMove(p: Page, uci: string) {
  const box = (await p.locator(`.board-area ${BOARD_SEL.squares}`).boundingBox())!;
  const white = (await sideOf(p)) === "w";
  const at = (sq: string) => {
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    return { x: box.x + (((white ? f : 7 - f) + 0.5) * box.width) / 8, y: box.y + (((white ? 7 - r : r) + 0.5) * box.height) / 8 };
  };
  for (const sq of [uci.slice(0, 2), uci.slice(2, 4)]) await p.mouse.click(at(sq).x, at(sq).y);
}
/** The game against the town bot: past Maia's loading step and the vote, one move each, then resign (the gear). */
async function playAndResign(p: Page, bot: string) {
  const game = p.locator(".duel-screen");
  await expect(game).toBeVisible({ timeout: 15_000 });
  // The gear (Eric's rule: on every screen with a chessboard).
  await expect(p.getByRole("button", { name: "Match options" })).toBeVisible();
  await expect(p.locator(".dv-strip.dv-them .dv-name")).toHaveText(bot);
  // Its rating on its pill (the number), and its whole name, never cut.
  await expect(p.locator(".dv-strip.dv-them .dv-rank")).toHaveText(String(BOTS.find((b) => `${b.name} (bot)` === bot)!.rating));
  expect(await p.locator(".dv-strip.dv-them .dv-name").evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  // Yours says the game is casual: no placement, rank or rating of yours.
  await expect(p.locator(".dv-strip.dv-you .dv-rank")).toHaveText("Casual");
  await expect(p.locator(".dv-strip.dv-you")).not.toContainText(/Placement|RP|Rating|\d{3,4}/);
  await expect(p.locator(".dv-status")).toContainText(/first move/, { timeout: 60_000 });
  if ((await sideOf(p)) === "b") await expect(p.locator(".dv-status")).toHaveText(/^Your first move/, { timeout: 30_000 });
  await tapMove(p, (await sideOf(p)) === "w" ? "e2e4" : "e7e5");
  await expect(p.locator(".dv-status")).toHaveText("Your move", { timeout: 30_000 });
  await p.getByRole("button", { name: "Match options" }).click();
  await p.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /Resign/ }).click();
  await p.getByRole("alertdialog").getByRole("button", { name: "Resign" }).click();
  await expect(p.locator(".dv-result-title")).toHaveText("You lost");
  await expect(p.locator(".dv-result-rank")).toHaveText("Casual game");
}

test("a town bot: a tap opens its card ('<name> (bot)', its rating, Play); Play walks you both to a free table; seated, the game against it opens; resign, then back at the table with the bot across", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors = watchErrors(page);
  // Maia's files: never fetched while you walk round the town (Eric's frame-rate rule), only as the game opens.
  const maia: string[] = [];
  page.on("request", (r) => r.url().includes("/engine/maia/") && maia.push(new URL(r.url()).pathname));
  await page.goto("/town?debug");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  // Tempo Tess (1400) comes to stand beside you, and every bot holds still.
  const i = BOTS.findIndex((b) => b.name === "Tempo Tess");
  await page.evaluate((i) => (window as unknown as { __townCall: (i: number) => void }).__townCall(i), i);
  await expect.poll(async () => (await bots(page))[i]!.moving, { timeout: 10_000 }).toBe(false);
  await page.waitForTimeout(400);
  await tapAt(page, "bot", i);
  const card = page.getByRole("dialog", { name: "Tempo Tess (bot)", exact: true });
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: "Tempo Tess (bot)" })).toBeVisible();
  await expect(card.getByText("Rating 1400", { exact: true })).toBeVisible();
  const play = card.getByRole("button", { name: "Play", exact: true });
  await expect(play).toBeEnabled();
  // The bot holds still while its card is open.
  const held = (await bots(page))[i]!.at;
  await page.waitForTimeout(800);
  expect((await bots(page))[i]!.at).toBe(held);
  expect(maia, "nothing of Maia's in the town").toEqual([]);
  await play.click();
  await expect(card).toBeHidden();
  // You both walk to a table and sit; then the game opens (the town closes).
  await expect(page.locator(".duel-screen")).toBeVisible({ timeout: 20_000 });
  // The loading step (Boss alone's): Maia's worker starts on this device, at the bot's rating.
  await expect.poll(() => maia.some((f) => f.endsWith("maia-worker.js")), { timeout: 30_000 }).toBe(true);
  await expect(page).toHaveURL(/\/town\?.*at=\d+\.[01]\.\d+/);
  const seat = new URL(page.url()).searchParams.get("at")!.split(".").map(Number) as [number, number, number];
  expect(seat[2]).toBe(i);
  await playAndResign(page, "Tempo Tess (bot)");
  // Back to town: at that table, on your stool, the bot across; its card closed.
  await page.getByRole("button", { name: "Back to town" }).click();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await expect(page).toHaveURL(/\/town(\?debug)?$/);
  const t = TABLES[seat[0]]!;
  expect((await you(page)).join(",")).toBe(`${t.stools[seat[1]]!.c},${t.stools[seat[1]]!.r}`);
  await expect(canvas(page)).toHaveAttribute("data-sit", "1");
  const across = t.stools[1 - seat[1]]!;
  expect((await bots(page))[i]).toMatchObject({ at: `${across.c},${across.r}`, table: t.i });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // After a short while the bot gets up and wanders off.
  await expect.poll(async () => (await bots(page))[i]!.at, { timeout: 15_000 }).not.toBe(`${across.c},${across.r}`);
  expect(errors).toEqual([]);
});

test("a bot sitting at a table: a tap on the table walks you to the free stool; its card's first button plays it ('Play <name> (bot) · <rating>', Casual and Ranked greyed under it); a reload or the back button from the game lands you back at the table", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors = watchErrors(page);
  await page.goto("/town?debug");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await seat(page, 6, 1);
  await expect.poll(async () => (await tables(page))[6], { message: "a bot sits and waits", timeout: 15_000 }).toBe("waiting:1");
  const sitter = (await bots(page)).find((b) => b.table === 6)!;
  const bot = BOTS.find((b) => `${b.name} (bot)` === sitter.name)!;
  await tapAt(page, "table", 6);
  const card = page.getByRole("dialog", { name: "Chess table", exact: true });
  const play = card.getByRole("button").first();
  await expect(play).toHaveText(`Play ${bot.name} (bot) · ${bot.rating}`);
  await expect(play).toBeEnabled();
  for (const name of ["Casual", "Ranked"]) await expect(card.getByRole("button", { name, exact: true })).toBeDisabled();
  // You walk to the free (east) stool and sit, across from it; it stays while the card is open.
  await expect.poll(async () => (await you(page)).join(","), { timeout: 5000 }).toBe("20,13");
  await expect(canvas(page)).toHaveAttribute("data-sit", "1");
  await page.waitForTimeout(600);
  expect((await bots(page)).find((b) => b.name === sitter.name)!.table).toBe(6);
  await play.click();
  await expect(page.locator(".duel-screen")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".dv-strip.dv-them .dv-name")).toHaveText(`${bot.name} (bot)`);
  await expect(page.locator(".dv-strip.dv-you .dv-rank")).toHaveText("Casual");
  // A reload: back in the town at the table, the bot across.
  await page.reload();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  // (Every bot holds still from here, the one across too: it would get up after a while.)
  await page.evaluate(() => (window as unknown as { __townCall: (i: number) => void }).__townCall(-1));
  await expect(page).toHaveURL(/\/town(\?debug)?$/);
  expect((await you(page)).join(",")).toBe("20,13");
  await expect(canvas(page)).toHaveAttribute("data-sit", "1");
  expect((await bots(page)).find((b) => b.name === sitter.name)).toMatchObject({ at: "18,13", table: 6 });
  // Again (the bot still there), and this time the back button.
  await tapAt(page, "table", 6);
  await card.getByRole("button", { name: `Play ${bot.name} (bot) · ${bot.rating}` }).click();
  await expect(page.locator(".duel-screen")).toBeVisible({ timeout: 15_000 });
  await page.goBack();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  expect((await you(page)).join(",")).toBe("20,13");
  await expect(canvas(page)).toHaveAttribute("data-sit", "1");
  expect((await bots(page)).find((b) => b.name === sitter.name)).toMatchObject({ at: "18,13", table: 6 });
  expect(errors).toEqual([]);
});
