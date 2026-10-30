import { expect, type Page } from "@playwright/test";
import { BOTS, STATUES, TABLES, TOWN_LINES, sidekickText } from "../packages/app/src/town/world.ts";
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

// The chat log's box (Oct 28; shown where the test switches are on, as here) lies over a corner of the map and takes taps there (v4: every
// touch on its own area while it shows, the empty part too; before, its text field only); on the phone project's short screen that corner
// holds the Colosseum's gate and the marble statue. These tests aim at the map, so the box lets taps through (e2e/town-chat.spec.ts tests the
// box itself). The helper's rule widened from the field (`.tc-form`) to the whole box; no check changed.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
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

  // The world fills the rest of the screen under the bar: the whole screen's width on a phone, the front door's center column's on a
  // computer (Oct 29: the town sits in the frame, between the menu and the live panel; its box is tested in town-desktop.spec.ts).
  const vp = page.viewportSize()!;
  const bar = (await page.locator(".town-bar").boundingBox())!;
  const cv = (await canvas(page).boundingBox())!;
  const wide = test.info().project.name === "desktop" ? (await page.locator(".fd-center").boundingBox())!.width : vp.width;
  // (A computer's bar is the right column's top row, Oct 30: its world starts at the window's top.)
  const computer = test.info().project.name === "desktop";
  expect(Math.abs(cv.y - (computer ? 0 : bar.y + bar.height)), computer ? "the world starts at the window's top" : "the world starts right under the bar").toBeLessThanOrEqual(1.5);
  expect(Math.abs(cv.width - wide), "as wide as the screen (a computer's: its center column)").toBeLessThanOrEqual(1);
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
  const focus = page.getByRole("button", { name: "Back to me" });
  await expect(focus).toBeVisible();

  // The buttons (Eric, Oct 28): one row in the map's bottom right corner, the −/+ pair on the left and the round focus button to its
  // right (an icon, no words; its name, "Back to me", is for screen readers), 14 px in from the corner, as high as the pair.
  const mapBox = (await page.locator(".town-box").boundingBox())!;
  const pair = (await page.locator(".town-zoom").boundingBox())!;
  const fb = (await focus.boundingBox())!;
  expect(pair.x + pair.width, "the pair is left of the focus button").toBeLessThanOrEqual(fb.x);
  expect(Math.abs(pair.y + pair.height / 2 - (fb.y + fb.height / 2)), "one row").toBeLessThanOrEqual(1.5);
  expect(mapBox.x + mapBox.width - (fb.x + fb.width), "14 px from the right edge").toBeCloseTo(14, 0);
  expect(mapBox.y + mapBox.height - (fb.y + fb.height), "14 px from the foot").toBeCloseTo(14, 0);
  expect(fb.width, "round").toBeCloseTo(fb.height, 0);
  expect(fb.height, "as high as the −/+ buttons").toBeCloseTo(pair.height, 0);
  expect(await focus.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("50%");
  await expect(focus, "an icon, no words").toHaveText("");
  await expect(focus.locator("svg")).toHaveCount(1);
  // It does what "Back to me" did: after a look around, the camera comes back to you.
  const lookAt = () => page.evaluate(() => (window as unknown as { __townCam: () => { focus: number[] } }).__townCam().focus);
  const home = await lookAt();
  await page.mouse.move(cv.x + cv.width / 2, cv.y + cv.height / 2);
  await page.mouse.down();
  await page.mouse.move(cv.x + cv.width / 2 + 120, cv.y + cv.height / 2 + 160, { steps: 8 });
  await page.mouse.up();
  const away = await lookAt();
  expect(Math.hypot(away[0]! - home[0]!, away[1]! - home[1]!), "you looked around").toBeGreaterThan(1);
  await focus.click();
  await expect
    .poll(async () => {
      const f = await lookAt();
      const [c, r] = await you(page);
      return Math.hypot(f[0]! - c, f[1]! - r);
    }, { message: "the camera is back on you", timeout: 6000 })
    .toBeLessThan(2.5);

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
  // (Counted as the page's documents arrive, not by "load": on a slow run the town's chunk is asked for, refused and the page
  // loads again before the first page's own "load" ever fires, Oct 30.)
  let loads = 0;
  page.on("framenavigated", (frame) => frame === page.mainFrame() && loads++);
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

test("/town?fps: anyone sees the frame-rate pill with a number (no admin needed, Eric, Oct 30), and ?crowd=50 brings the crowd; without ?fps there is no pill", async ({ page }) => {
  const pill = page.locator(".town-fps");
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await page.waitForTimeout(1500);
  await expect(pill).toHaveCount(0);
  await page.goto("/town?sky=day&fps&crowd=50");
  await expect(canvas(page)).toHaveAttribute("data-crowd", "50", { timeout: 10_000 });
  await expect(pill).toHaveText(/^\d+ fps · \d+\.\d ms$/, { timeout: 10_000 });
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
  // No line on his card (only Hollow's has lines: Oct 28).
  await expect(card.locator(".town-card-line")).toHaveCount(0);
  // He says something as his card opens (Eric, Oct 27: his select sound), once: its confirm opening is the same card.
  const said = () => page.evaluate(() => ((window as any).__soundLog as string[]).filter((l) => l.startsWith("tigerHello")).length);
  await expect.poll(said).toBe(1);
  await card.getByRole("button", { name: "Challenge alone" }).click();
  let confirm = page.getByRole("dialog", { name: "Leave the town square?" });
  await expect(confirm.getByRole("heading", { name: "Leave the town square?" })).toBeVisible();
  expect(await said()).toBe(1);
  await expect(confirm.getByText("You'll fight Babur in Boss Battle.")).toBeVisible();
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
    // The HUD stays put: the zoom pair and the focus button ("Back to me") are where they were.
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
    // (Off screen: its chip, if it has one; only the nearest four places get chips (`maxChips`), and from your start Folio's house
    // is the fifth since Oct 28, so otherwise the camera glides there, as a chip's tap would.)
    if (!(await at())) {
      if (await chip.count()) await chip.click({ force: true });
      else await page.evaluate(() => (window as unknown as { __townGlide?: (id: string) => void }).__townGlide?.("folio"));
    }
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
    // Its place (Eric, Oct 28: "folio's house is like 2 inches from the colosseum it's gotta get moved a bit"): its plot is columns
    // 34 to 36 now (it was 32 to 34), so you stop on the ring round it, column 33 or further east; the Colosseum's ground ends at
    // column 28 (5 open squares between them, 3 before).
    const [col] = await you(page);
    expect(col, "you stand beside Folio's house, east of the Colosseum's 5 open squares").toBeGreaterThanOrEqual(33);
    expect(col).toBeLessThanOrEqual(37);
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

type BotRow = { name: string; at: string; table: number; moving: boolean; home: boolean; anim: "idle" | "walk" | "sit" | "wave" | null };
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
  // Tempo Tess comes to stand beside you, and every bot holds still.
  const i = BOTS.findIndex((b) => b.name === "Tempo Tess");
  await page.evaluate((i) => (window as unknown as { __townCall: (i: number) => void }).__townCall(i), i);
  await expect.poll(async () => (await bots(page))[i]!.moving, { timeout: 10_000 }).toBe(false);
  await page.waitForTimeout(400);
  await tapAt(page, "bot", i);
  const card = page.getByRole("dialog", { name: "Tempo Tess (bot)", exact: true });
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: "Tempo Tess (bot)" })).toBeVisible();
  await expect(card.getByText(`Rating ${BOTS[i]!.rating}`, { exact: true })).toBeVisible();
  // A pawn's card says nothing more (a sidekick's says whose it is).
  await expect(card.getByText(/sidekick/)).toHaveCount(0);
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

// ---------------- The bosses' sidekicks (Oct 28, Eric; docs/decisions/2026-10-28-sidekicks-in-town.md) ----------------

test("a sidekick: a tap and it waves, then stands while its card is open ('Glim (bot)', 'Hollow's sidekick', its rating, Play); Play: both seated, the game against it with its face on its strip; resign, back at the table", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors = watchErrors(page);
  await page.goto("/town?debug");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  // Glim, Hollow's critter (the top rung), comes to stand beside you, and every bot holds still.
  const i = BOTS.findIndex((b) => b.name === "Glim");
  await page.evaluate((i) => (window as unknown as { __townCall: (i: number) => void }).__townCall(i), i);
  await expect.poll(async () => (await bots(page))[i]!.moving, { timeout: 10_000 }).toBe(false);
  await page.waitForTimeout(400);
  expect((await bots(page))[i]!.anim).toBe("idle");
  await tapAt(page, "bot", i);
  // It waves (once), then stands again while its card stays open.
  await expect.poll(async () => (await bots(page))[i]!.anim, { timeout: 2000, intervals: [50] }).toBe("wave");
  const card = page.getByRole("dialog", { name: "Glim (bot)", exact: true });
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: "Glim (bot)" })).toBeVisible();
  await expect(card.getByText("Hollow's sidekick", { exact: true })).toBeVisible();
  await expect(card.getByText("Rating 2500", { exact: true })).toBeVisible();
  await expect.poll(async () => (await bots(page))[i]!.anim, { timeout: 5000 }).toBe("idle");
  await expect(card).toBeVisible();
  const play = card.getByRole("button", { name: "Play", exact: true });
  await expect(play).toBeEnabled();
  await play.click();
  // You both walk to a table and sit (it in its sit); then the game opens.
  await expect(page.locator(".duel-screen")).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/town\?.*at=\d+\.[01]\.\d+/);
  const seat = new URL(page.url()).searchParams.get("at")!.split(".").map(Number) as [number, number, number];
  expect(seat[2]).toBe(i);
  // Its strip shows its face (its idle's first frame) in place of the pawn.
  const face = page.locator(".dv-strip.dv-them img.dv-face");
  await expect(face).toBeVisible();
  expect(await face.getAttribute("src")).toMatch(/^data:image\/png/);
  expect(await face.evaluate((img: HTMLImageElement) => img.naturalWidth > 10 && img.naturalHeight > 10)).toBe(true);
  await playAndResign(page, "Glim (bot)");
  // Back to town: at that table, on your stool, Glim across in its sit.
  await page.getByRole("button", { name: "Back to town" }).click();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  const t = TABLES[seat[0]]!;
  expect((await you(page)).join(",")).toBe(`${t.stools[seat[1]]!.c},${t.stools[seat[1]]!.r}`);
  await expect(canvas(page)).toHaveAttribute("data-sit", "1");
  const across = t.stools[1 - seat[1]]!;
  expect((await bots(page))[i]).toMatchObject({ at: `${across.c},${across.r}`, table: t.i, anim: "sit" });
  expect(errors).toEqual([]);
});

test("Hollow's card: one of his three lines (Eric's words), the next one each time it opens", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  const lines = TOWN_LINES.hollow!;
  const at = async () => {
    const xy = await page.evaluate(() => (window as unknown as { __townAt?: (k: string, id: string) => { x: number; y: number } | null }).__townAt?.("home", "hollow") ?? null);
    if (!xy) return null;
    const cv = (await canvas(page).boundingBox())!;
    return { x: cv.x + xy.x, y: cv.y + xy.y };
  };
  // The camera glides to Hollow Peak (as its chip would), far across the world.
  await page.evaluate(() => (window as unknown as { __townGlide: (id: string) => void }).__townGlide("hollow"));
  await expect.poll(at, { message: "Hollow Peak comes into view", timeout: 10_000 }).not.toBeNull();
  // Hollow walks round behind his home and stays: a tap meant for the home that lands on him would open his card, which
  // says the next line too (his card and his home's take turns together).
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __townBossBack: (id: string) => boolean }).__townBossBack("hollow")), { message: "Hollow stands behind his home", timeout: 20_000 })
    .toBe(true);
  const card = page.getByRole("dialog", { name: "Hollow Peak", exact: true });
  /** Which card is open now, shown or not (a card stays hidden while its home is off screen: you walk there first). */
  const openCardName = () => page.locator(".town-card").evaluate((e: HTMLElement) => (e.style.display === "none" ? null : e.getAttribute("aria-label")));
  /** Taps the home until its card is open (only then: each opening says the next line), then waits for you to get there. */
  const open = async () => {
    await expect(async () => {
      const name = await openCardName();
      if (name === "Hollow Peak") return;
      if (name) await page.keyboard.press("Escape");
      const p = await at();
      expect(p, "drawn").not.toBeNull();
      await page.mouse.click(p!.x, p!.y);
      await expect.poll(openCardName, { timeout: 1500 }).toBe("Hollow Peak");
    }).toPass({ timeout: 30_000 });
    await expect(card).toBeVisible({ timeout: 20_000 });
  };
  await open();
  await expect(card.getByText(lines[0]!, { exact: true })).toBeVisible();
  // Its shop greyed as before, under the line.
  await expect(card.getByRole("button", { name: "Shop" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await open();
  await expect(card.getByText(lines[1]!, { exact: true })).toBeVisible();
  await expect(card.getByText(lines[0]!, { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

/**
 * The bots' turns (Oct 28, Eric: "10 out at a time, randomly one each minute starts to head home, is replaced by another…
 * they walk and fade into their respective house and then the new one walks out from their home"). A test hook speeds the
 * minute (`__townTurns(ms)`: the next turn now, then every `ms`); `__townBots()` says who's going home, where to, fading.
 */
test("the bots' turns: ten out; one walks home and fades out at its door, gone; the one home longest fades in at its own door and walks to the square", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  type Bot = { name: string; at: string; moving: boolean; home: boolean; going: boolean; trip: string | null; fading: "in" | "out" | null; door: string; inSquare: boolean; queue: number };
  const bots = () => page.evaluate(() => (window as unknown as { __townBots: () => Bot[] }).__townBots());
  expect((await bots()).filter((b) => !b.home)).toHaveLength(10);
  const next = (await bots()).find((b) => b.queue === 0)!;
  // Watch every frame from now: what the one going home and the one coming out do.
  await page.evaluate(() => {
    const w = window as unknown as { __townBots: () => Bot[]; __townTurns: (ms: number) => void; __rot: { going: string | null; fadedAt: string | null; trip: string | null; gone: boolean; came: string | null; cameAt: string | null; fadedIn: boolean; out: number[] } };
    const r = (w.__rot = { going: null, fadedAt: null, trip: null, gone: false, came: null, cameAt: null, fadedIn: false, out: [] });
    const was = new Map(w.__townBots().map((b) => [b.name, b.home]));
    const look = () => {
      const all = w.__townBots();
      r.out.push(all.filter((b) => !b.home).length);
      for (const b of all) {
        if (!r.going && b.going) ((r.going = b.name), (r.trip = b.trip));
        if (b.name === r.going && b.fading === "out" && !r.fadedAt) r.fadedAt = b.at;
        if (b.name === r.going && b.home) r.gone = true;
        if (was.get(b.name) && !b.home && !r.came) ((r.came = b.name), (r.cameAt = b.at), (r.fadedIn = b.fading === "in"));
        was.set(b.name, b.home);
      }
      if (!r.gone || !r.came) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
    // One turn now, then none for ten minutes.
    w.__townTurns(600_000);
  });
  const rot = () => page.evaluate(() => (window as unknown as { __rot: { going: string | null; fadedAt: string | null; trip: string | null; gone: boolean; came: string | null; cameAt: string | null; fadedIn: boolean; out: number[] } }).__rot);
  await expect.poll(async () => (await rot()).going, { message: "one starts home", timeout: 5000 }).not.toBeNull();
  await expect.poll(async () => (await rot()).gone && !!(await rot()).came, { message: "it gets home and another comes out", timeout: 60_000 }).toBe(true);
  const r = await rot();
  const all = await bots();
  const goer = all.find((b) => b.name === r.going)!;
  // It faded out at its door (a sidekick's boss's home, a pawn's the Colosseum's gate: where it was headed), and it's gone.
  expect(r.fadedAt, "it fades where it was headed").toBe(r.trip);
  const [dc, dr] = goer.door.split(",").map(Number) as [number, number];
  const [fc, fr] = r.fadedAt!.split(",").map(Number) as [number, number];
  expect(Math.abs(fc - dc) <= 1 && Math.abs(fr - dr) <= 1, `${goer.name} faded at ${r.fadedAt}, its door ${goer.door}`).toBe(true);
  expect(goer.home).toBe(true);
  // The one home longest came out, fading in at its own door, as the other got home; ten in the world all along.
  expect(r.came).toBe(next.name);
  expect(r.fadedIn).toBe(true);
  const [cc, cr] = r.cameAt!.split(",").map(Number) as [number, number];
  const [nc, nr] = next.door.split(",").map(Number) as [number, number];
  expect(Math.abs(cc - nc) <= 1 && Math.abs(cr - nr) <= 1, `${next.name} came out at ${r.cameAt}, its door ${next.door}`).toBe(true);
  expect(new Set(r.out)).toEqual(new Set([10]));
  // It walks to the square and stays there.
  await expect.poll(async () => (await bots()).find((b) => b.name === next.name)!, { message: "it reaches the square", timeout: 40_000 }).toMatchObject({ trip: null, moving: false, inSquare: true });
  expect(errors).toEqual([]);
});

// ---------------- The person card (Oct 28, Eric's mockup; docs/decisions/2026-10-28-town-card.md) ----------------
//
// Every card is dark with a gold border; a person's (a bot's, and a real player's when they come) is one row at one size: their picture in
// a round ring, their name ("(bot)" in gray), a sidekick's line and the rating with its bars, and Play with crossed swords (no triangle),
// greyed and reading "Full" when every table is taken. Eric's rule (nothing hidden, nothing shifts): the card is one size whoever it is;
// a name or line too long for its row shrinks its own words (Oct 29, Eric), never the card.

/** The card's colors (town.css) as the browser computes them. */
const CARD = { bg: "rgb(32, 33, 42)", gold: "rgb(217, 187, 140)", white: "rgb(255, 255, 255)", gray: "rgb(165, 164, 170)", blue: "rgb(69, 117, 250)", ivory: "rgb(234, 223, 198)", bars: "rgb(224, 180, 110)" };
/** The card's size: 210 × 53 CSS pixels, on a phone and a computer alike (Eric's mockup, about 189 × 53 measured against its name tags; Oct 29). */
const CARD_SIZE = { w: 210, h: 53 };

type Rect = { x: number; y: number; w: number; h: number };
const rectIn = (p: Page, sel: string): Promise<Rect> =>
  p.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
/** The same rectangle, to a hundredth of a pixel. */
const sameRect = (a: Rect, b: Rect, what: string) => expect([a.x, a.y, a.w, a.h].map((v) => Math.round(v * 100)), what).toEqual([b.x, b.y, b.w, b.h].map((v) => Math.round(v * 100)));

/** A color of `rgb(r, g, b)` or `rgba(…)` as [r, g, b]. */
const channels = (css: string): [number, number, number] => (css.match(/[\d.]+/g)!.slice(0, 3).map(Number) as [number, number, number]);
/** WCAG's contrast ratio of two colors. */
function contrast(a: string, b: string): number {
  const lum = ([r, g, bl]: [number, number, number]) => {
    const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const [x, y] = [lum(channels(a)), lum(channels(b))];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/**
 * The text color of `sel` against the card's own color (or, `on`, against the color of another element: a button's background; a
 * gradient counts at each of its stops, the worst of them), and the first element's text color too.
 */
async function contrastOf(p: Page, sel: string, on?: string): Promise<number> {
  const got = await p.locator(sel).first().evaluate((el, onSel) => {
    const fg = getComputedStyle(el).color;
    const back = onSel ? getComputedStyle(document.querySelector(onSel)!) : getComputedStyle(document.querySelector(".town-card")!);
    const stops = back.backgroundImage.startsWith("linear-gradient") ? (back.backgroundImage.match(/rgb\([^)]*\)/g) ?? []) : [];
    return { fg, bgs: stops.length ? stops : [back.backgroundColor] };
  }, on ?? null);
  return Math.min(...got.bgs.map((bg) => contrast(got.fg, bg)));
}
const WCAG_TEXT = 4.5;

/** A bot comes to stand beside you and holds still; a tap on it opens its card. */
async function openBotCard(p: Page, name: string) {
  const i = BOTS.findIndex((b) => b.name === name);
  await p.evaluate((i) => (window as unknown as { __townCall: (i: number) => void }).__townCall(i), i);
  await expect.poll(async () => (await bots(p))[i]!.moving, { timeout: 10_000 }).toBe(false);
  await p.waitForTimeout(400);
  await tapAt(p, "bot", i);
  const card = p.getByRole("dialog", { name: `${name} (bot)`, exact: true });
  await expect(card).toBeVisible();
  return card;
}
const fillTables = (p: Page, on: boolean) => p.evaluate((on) => (window as unknown as { __townFull: (on: boolean) => void }).__townFull(on), on);

test("a person's card (Eric's mockup, Oct 28): a sidekick's has its picture in a blue ring (no button), its name in bold white with '(bot)' gray, its line, its rating with bars and Play with crossed swords; a pawn's has an ivory ring, the same size and places", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  // ---- A sidekick: Glim, Hollow's.
  let card = await openBotCard(page, "Glim");
  // Dark, with a thin warm-gold border and rounded corners.
  const look = await card.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, border: s.borderTopColor, width: parseFloat(s.borderTopWidth), radius: parseFloat(s.borderTopLeftRadius) };
  });
  expect(look.bg).toBe(CARD.bg);
  expect(look.border).toBe(CARD.gold);
  expect(look.width, "a thin border").toBeGreaterThanOrEqual(1);
  expect(look.width).toBeLessThanOrEqual(2);
  expect(look.radius).toBeGreaterThanOrEqual(12);
  // One size, on a phone and a computer alike.
  const size = await rectIn(page, ".town-card");
  expect([size.w, size.h].map((v) => Math.round(v * 10) / 10)).toEqual([CARD_SIZE.w, CARD_SIZE.h]);
  // Its picture: a sidekick's face (an image of its idle's first frame) in a blue ring, round; not a button.
  const pic = card.locator(".town-pic");
  await expect(pic).toHaveClass(/sidekick/);
  const ring = await pic.evaluate((el) => {
    const s = getComputedStyle(el);
    return { tag: el.tagName, tabIndex: (el as HTMLElement).tabIndex, role: el.getAttribute("role"), hidden: el.getAttribute("aria-hidden"), cursor: s.cursor, border: s.borderTopColor, width: parseFloat(s.borderTopWidth), radius: s.borderTopLeftRadius, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height };
  });
  expect(ring).toMatchObject({ tag: "DIV", tabIndex: -1, role: null, hidden: "true", cursor: "default", border: CARD.blue, width: 3, radius: "50%" });
  expect(Math.abs(ring.w - ring.h), "a round").toBeLessThan(0.01);
  expect(ring.w).toBeCloseTo(38, 1);
  const face = pic.locator("img");
  await expect(face).toBeVisible();
  expect(await face.getAttribute("src")).toMatch(/^data:image\/png/);
  expect(await face.evaluate((img: HTMLImageElement) => img.naturalWidth > 10 && img.naturalHeight > 10)).toBe(true);
  // Its words: the name bold white, "(bot)" gray after it (the heading still reads "Glim (bot)"), the line, the rating with its bars.
  await expect(card.getByRole("heading", { name: "Glim (bot)", exact: true })).toBeVisible();
  const name = await card.locator(".town-name").evaluate((el) => ({ text: el.textContent, color: getComputedStyle(el).color, weight: getComputedStyle(el).fontWeight }));
  expect(name).toEqual({ text: "Glim", color: CARD.white, weight: "700" });
  expect(await card.locator(".town-bot").evaluate((el) => ({ text: el.textContent, color: getComputedStyle(el).color }))).toEqual({ text: " (bot)", color: CARD.gray });
  await expect(card.getByText("Hollow's sidekick", { exact: true })).toBeVisible();
  await expect(card.getByText("Rating 2500", { exact: true })).toBeVisible();
  const bars = card.locator(".town-rate svg.town-ico-bars");
  await expect(bars).toBeVisible();
  expect(await bars.evaluate((el) => getComputedStyle(el).color), "the bars are gold").toBe(CARD.bars);
  // Play, with a plain crossed-swords icon (SVG, hidden from screen readers) and no triangle; its name is still "Play".
  const playBtn = card.getByRole("button", { name: "Play", exact: true });
  await expect(playBtn).toBeEnabled();
  const swords = playBtn.locator("svg.town-ico-swords");
  await expect(swords).toHaveCount(1);
  await expect(swords).toHaveAttribute("aria-hidden", "true");
  expect(await swords.evaluate((el) => getComputedStyle(el).color), "the icon is the button's text color").toBe(await playBtn.evaluate((el) => getComputedStyle(el).color));
  expect(await card.innerText()).not.toMatch(/[▶►▸⏵▷⯈]/);
  // The picture is the only other thing in the row, and the only button is Play: a bot's picture opens nothing.
  await expect(card.getByRole("button")).toHaveCount(1);
  await pic.click();
  await page.waitForTimeout(400);
  await expect(card).toBeVisible();
  await expect(page.locator(".fd-overlay")).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/town");
  // Where each part sits (for the pawn's card to match).
  const parts = async () => ({ card: await rectIn(page, ".town-card"), pic: await rectIn(page, ".town-card .town-pic"), name: await rectIn(page, ".town-card h2"), sub: await rectIn(page, ".town-card .town-sub"), rate: await rectIn(page, ".town-card .town-rate"), play: await rectIn(page, ".town-card .town-play") });
  const kid = await parts();
  // The words on the dark card, 4.5:1 or better (WCAG's number for text): white, gray, the line, the rating, Play on its gold (at each end of the gradient).
  for (const sel of [".town-name", ".town-bot", ".town-sub", ".town-rate span"]) expect(await contrastOf(page, `.town-card ${sel}`), sel).toBeGreaterThanOrEqual(WCAG_TEXT);
  expect(await contrastOf(page, ".town-card .town-play", ".town-card .town-play"), "Play on its gold").toBeGreaterThanOrEqual(WCAG_TEXT);
  expect(await contrastOf(page, ".town-card .town-ico-bars"), "the bars (a picture: 3:1)").toBeGreaterThanOrEqual(3);
  expect(contrast(CARD.blue, CARD.bg), "the blue ring reads on the card (a picture: 3:1)").toBeGreaterThanOrEqual(3);
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();

  // ---- A pawn: Tempo Tess. An ivory ring, her own picture (the pawn as dressed), no line; every part where the sidekick's was.
  card = await openBotCard(page, "Tempo Tess");
  await expect(card.locator(".town-pic")).toHaveClass(/pawn/);
  expect(await card.locator(".town-pic").evaluate((el) => getComputedStyle(el).borderTopColor), "an ivory ring").toBe(CARD.ivory);
  expect(contrast(CARD.ivory, CARD.bg), "the ivory ring reads on the card (a picture: 3:1)").toBeGreaterThanOrEqual(3);
  const pawn = card.locator(".town-pic img");
  await expect(pawn).toBeVisible();
  expect(await pawn.evaluate((img: HTMLImageElement) => img.naturalWidth > 20 && img.naturalHeight > 20)).toBe(true);
  await expect(card.getByText(/sidekick/)).toHaveCount(0);
  expect(await card.locator(".town-sub").innerText(), "the line's row is there, empty").toBe("");
  await expect(card.getByText("Rating 1500", { exact: true })).toBeVisible();
  await expect(card.getByRole("button")).toHaveCount(1);
  const pawnParts = await parts();
  for (const k of ["card", "pic", "name", "sub", "rate", "play"] as const) sameRect({ ...pawnParts[k], x: pawnParts[k].x - pawnParts.card.x, y: pawnParts[k].y - pawnParts.card.y }, { ...kid[k], x: kid[k].x - kid.card.x, y: kid[k].y - kid.card.y }, `${k} sits where the sidekick's did`);
  expect(errors).toEqual([]);
});

test("tables full: a bot's Play is greyed (not tappable) and reads 'Full'; the card, its words and its Play don't move or change size (sidekick and pawn)", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  for (const name of ["Glim", "Tempo Tess"]) {
    const card = await openBotCard(page, name);
    const play = card.locator(".town-play");
    await expect(play).toBeEnabled();
    await expect(play).toHaveText("Play");
    const rects = async () => ({ card: await rectIn(page, ".town-card"), pic: await rectIn(page, ".town-card .town-pic"), name: await rectIn(page, ".town-card h2"), sub: await rectIn(page, ".town-card .town-sub"), rate: await rectIn(page, ".town-card .town-rate"), play: await rectIn(page, ".town-card .town-play") });
    const before = await rects();
    await fillTables(page, true);
    // Greyed and not tappable, reading "Full" (its name says why: "Play: tables are full"); the old "Play · Tables are full" is gone.
    await expect(play).toBeDisabled();
    await expect(play).toHaveText("Full");
    await expect(card.getByRole("button", { name: "Play: tables are full", exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "Play · Tables are full" })).toHaveCount(0);
    // Nothing moved: the same card (place and size), picture, words and button.
    const full = await rects();
    for (const k of ["card", "pic", "name", "sub", "rate", "play"] as const) sameRect(full[k], before[k], `${name}: ${k} stays put`);
    expect(await contrastOf(page, ".town-card .town-play", ".town-card .town-play"), "the greyed Full on its grey").toBeGreaterThanOrEqual(WCAG_TEXT);
    // A tap on the greyed button does nothing: the card stays and no game starts.
    await play.click({ force: true });
    await page.waitForTimeout(400);
    await expect(card).toBeVisible();
    await expect(page.locator(".duel-screen")).toHaveCount(0);
    // A table frees: Play is back, nothing moved.
    await fillTables(page, false);
    await expect(play).toBeEnabled();
    await expect(play).toHaveText("Play");
    for (const k of ["card", "pic", "name", "sub", "rate", "play"] as const) sameRect(await rectIn(page, `.town-card ${k === "card" ? "" : { pic: ".town-pic", name: "h2", sub: ".town-sub", rate: ".town-rate", play: ".town-play" }[k]}`.trim()), before[k], `${name}: ${k} is back where it was`);
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
  }
  expect(errors).toEqual([]);
});

test("a long name or line shrinks its own words to fit its row (Eric, Oct 29), never below its floor, and never the card: every bot's name, line and rating fit", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  let card = await openBotCard(page, "Tempo Tess");
  // Every bot's words, measured in the card's own fonts against its rows: the size each would shrink to is at or above its floor.
  const room = await card.evaluate(async (el, bots) => {
    await document.fonts.load("700 13px Archivo");
    await document.fonts.load("500 12px Archivo");
    await document.fonts.load("500 9.5px Archivo");
    const g = document.createElement("canvas").getContext("2d")!;
    const w = (font: string, text: string) => ((g.font = font), g.measureText(text).width);
    const h2 = el.querySelector("h2")!;
    const sub = el.querySelector<HTMLElement>(".town-sub")!;
    const rateRow = el.querySelector(".town-rate")!;
    return {
      nameRoom: h2.clientWidth,
      lineRoom: sub.clientWidth,
      rateRoom: rateRow.getBoundingClientRect().width - el.querySelector(".town-rate svg")!.getBoundingClientRect().width - parseFloat(getComputedStyle(rateRow).columnGap),
      nameMin: parseFloat(getComputedStyle(h2).getPropertyValue("--fit-min")),
      lineMin: parseFloat(getComputedStyle(sub).getPropertyValue("--fit-min")),
      names: bots.map((b) => ({ b: b.label, w: w("700 13px Archivo", b.name) + w("500 12px Archivo", " (bot)") })),
      lines: bots.filter((b) => b.line).map((b) => ({ b: b.line!, w: w("500 9.5px Archivo", b.line!) })),
      rates: bots.map((b) => ({ b: b.rating, w: w("500 9.5px Archivo", b.rating) })),
    };
  }, BOTS.map((b) => ({ name: b.name, label: `${b.name} (bot)`, line: sidekickText(b), rating: `Rating ${b.rating}` })));
  expect(room.nameMin).toBe(10);
  expect(room.lineMin).toBe(7.5);
  for (const n of room.names) expect((13 * room.nameRoom) / n.w, `${n.b}: the size it shrinks to`).toBeGreaterThanOrEqual(room.nameMin + 0.25);
  for (const n of room.lines) expect((9.5 * room.lineRoom) / n.w, `${n.b}: the size it shrinks to`).toBeGreaterThanOrEqual(room.lineMin + 0.25);
  for (const n of room.rates) expect(n.w + 4, `${n.b} fits its row at full size`).toBeLessThanOrEqual(room.rateRoom);
  // On the card itself: Tempo Tess's name (the widest) is smaller than 13 px and whole; nothing of the card is cut; the card's size is the same.
  const sizeOf = (sel: string) => card.locator(sel).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const whole = async () => {
    for (const sel of ["h2", ".town-sub", ".town-rate"]) expect(await card.locator(sel).evaluate((el) => el.scrollWidth <= el.clientWidth + 0.5), `${sel} is whole`).toBe(true);
  };
  const tess = await sizeOf("h2");
  expect(tess).toBeLessThan(13);
  expect(tess).toBeGreaterThanOrEqual(10);
  await whole();
  const tessSize = await rectIn(page, ".town-card");
  expect([tessSize.w, tessSize.h].map((v) => Math.round(v * 10) / 10)).toEqual([CARD_SIZE.w, CARD_SIZE.h]);
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  // Bun & Bug (Chub & Chirp's sidekick, the widest line): the line shrinks, the rating doesn't, all whole; same rows, same card.
  card = await openBotCard(page, "Bun & Bug");
  const line = await sizeOf(".town-sub");
  expect(line).toBeLessThan(9.5);
  expect(line).toBeGreaterThanOrEqual(7.5);
  expect(await sizeOf(".town-rate")).toBe(9.5);
  await whole();
  /** Each row's place in the card and height, to a hundredth of a pixel. */
  const rows = async () => {
    const c = await rectIn(page, ".town-card");
    const out: Record<string, number[]> = {};
    for (const [k, sel] of [["name", "h2"], ["sub", ".town-sub"], ["rate", ".town-rate"]] as const) {
      const r = await rectIn(page, `.town-card ${sel}`);
      out[k] = [r.x - c.x, r.y - c.y, r.w, r.h].map((v) => Math.round(v * 100));
    }
    return out;
  };
  const bunRows = await rows();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  // Glim (a short name and line): full size, and its rows exactly where Bun & Bug's were (a shrunk row keeps its height).
  card = await openBotCard(page, "Glim");
  expect(await sizeOf("h2")).toBe(13);
  expect(await sizeOf(".town-sub")).toBe(9.5);
  await whole();
  expect(await rows(), "every row where Bun & Bug's was, the same size").toEqual(bunRows);
  expect(errors).toEqual([]);
});

test("the other cards on the same dark look: the boss's, the home's, the Colosseum's, a table's and 'Leave the town square?' keep their words and buttons; gold primary buttons, greyed ones and 'Coming soon' read on the dark (4.5:1)", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  /** The open card is dark with a gold border, white words, a gold primary button, greyed ones and "Coming soon" that read. */
  const onDark = async (what: string, texts: string[]) => {
    const look = await page.locator(".town-card").evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, border: s.borderTopColor, color: s.color };
    });
    expect(look, what).toMatchObject({ bg: CARD.bg, border: CARD.gold, color: CARD.white });
    for (const sel of texts) expect(await contrastOf(page, `.town-card ${sel}`), `${what}: ${sel}`).toBeGreaterThanOrEqual(WCAG_TEXT);
    const primary = page.locator(".town-card .town-btn.primary");
    if (await primary.count()) {
      expect(await primary.first().evaluate((el) => getComputedStyle(el).backgroundImage), `${what}: a gold primary button`).toContain("linear-gradient");
      expect(await contrastOf(page, ".town-card .town-btn.primary", ".town-card .town-btn.primary"), `${what}: its words on the gold`).toBeGreaterThanOrEqual(WCAG_TEXT);
    }
    const grey = page.locator(".town-card .town-btn:disabled");
    if (await grey.count()) {
      expect(await contrastOf(page, ".town-card .town-btn:disabled", ".town-card .town-btn:disabled"), `${what}: a greyed button's words on it`).toBeGreaterThanOrEqual(WCAG_TEXT);
      expect(await contrastOf(page, ".town-card .town-soon"), `${what}: Coming soon`).toBeGreaterThanOrEqual(WCAG_TEXT);
    }
  };
  // The Colosseum's (a tap on its gate; it's in view at the start).
  const gate = (await page.evaluate(() => (window as unknown as { __townAt: (k: string) => { x: number; y: number } | null }).__townAt("coliseum")))!;
  expect(gate, "the Colosseum is drawn at the start").not.toBeNull();
  const cv = (await canvas(page).boundingBox())!;
  await page.mouse.click(cv.x + gate.x, cv.y + gate.y);
  let card = page.getByRole("dialog", { name: "The Colosseum", exact: true });
  await expect(card.getByRole("button", { name: "Raids with people" })).toBeDisabled();
  await expect(card.getByText("Coming soon", { exact: true })).toBeVisible();
  await onDark("the Colosseum's card", ["h2"]);
  await page.keyboard.press("Escape");
  // A chess table's (no title): the camera goes to the park's seventh table, which is out of view from the Colosseum's gate.
  await page.evaluate(() => (window as unknown as { __townGlide: (to: [number, number]) => void }).__townGlide([19, 14]));
  await expect.poll(() => page.evaluate(() => (window as unknown as { __townAt: (k: string, i: number) => unknown }).__townAt("table", 6)), { message: "the table is in view" }).not.toBeNull();
  await page.waitForTimeout(600);
  await tapAt(page, "table", 6);
  card = page.getByRole("dialog", { name: "Chess table", exact: true });
  for (const b of ["Casual", "Ranked"]) await expect(card.getByRole("button", { name: b, exact: true })).toBeDisabled();
  await expect(card.getByText("Coming soon", { exact: true })).toBeVisible();
  await onDark("a table's card", []);
  await page.keyboard.press("Escape");
  // A boss's (Babur's) and its confirm.
  await toBabur(page);
  card = await openCard(page, "boss", "Babur");
  await expect(card.getByRole("heading", { name: "Babur" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Challenge alone" })).toBeEnabled();
  await onDark("the boss's card", ["h2"]);
  await card.getByRole("button", { name: "Challenge alone" }).click();
  const confirm = page.getByRole("dialog", { name: "Leave the town square?" });
  await expect(confirm.getByText("You'll fight Babur in Boss Battle.")).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Leave", exact: true })).toBeEnabled();
  await expect(confirm.getByRole("button", { name: "Stay", exact: true })).toBeEnabled();
  await onDark("the confirm", ["h2", ".town-card-text"]);
  expect(await contrastOf(page, ".town-card .town-btn:not(.primary)", ".town-card .town-btn:not(.primary)"), "the confirm's plain button").toBeGreaterThanOrEqual(WCAG_TEXT);
  await confirm.getByRole("button", { name: "Stay" }).click();
  await expect(confirm).toBeHidden();
  // His home's.
  card = await openCard(page, "home", "Babur's Circus");
  await expect(card.getByRole("button", { name: "Shop" })).toBeDisabled();
  await expect(card.getByText("Coming soon", { exact: true })).toBeVisible();
  await onDark("the home's card", ["h2"]);
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("a real player's card (a test player; no real players walk in the town yet): the same row and size, a ring in ivory and their profile icon, which is a button named 'View <name>'s profile' that opens their profile, as a tap on a name does elsewhere", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  // Another player's account (a guest, named), to have a real profile to open.
  const other = await (await browser.newContext()).newPage();
  await other.goto("/");
  await expect(other.getByRole("button", { name: "Your profile" })).toBeVisible();
  await other.evaluate(() => fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Cyrus" }) }));
  const uid = ((await (await other.request.get("/api/me")).json()) as { user: { id: string; name: string } }).user.id;
  expect(((await (await other.request.get("/api/me")).json()) as { user: { name: string } }).user.name).toBe("Cyrus");
  await page.goto("/town");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  // The test player: a pawn with that account's id, a drawn icon and a rating, beside you.
  await page.evaluate(
    ([id]) => {
      const c = document.createElement("canvas");
      c.width = c.height = 48;
      const g = c.getContext("2d")!;
      g.fillStyle = "#3f48cc";
      g.fillRect(0, 0, 48, 48);
      g.fillStyle = "#ffc90e";
      g.fillRect(12, 12, 24, 24);
      (window as unknown as { __townPlayer: (uid: string, name: string, icon: string, rating: number) => number }).__townPlayer(id!, "Cyrus", c.toDataURL("image/png"), 1432);
    },
    [uid],
  );
  await expect.poll(() => page.evaluate((id) => (window as unknown as { __townAt: (k: string, id: string) => unknown }).__townAt("player", id), uid), { message: "the test player is drawn" }).not.toBeNull();
  const at = (await page.evaluate((id) => (window as unknown as { __townAt: (k: string, id: string) => { x: number; y: number } }).__townAt("player", id), uid))!;
  const cv = (await canvas(page).boundingBox())!;
  await page.mouse.click(cv.x + at.x, cv.y + at.y);
  const card = page.getByRole("dialog", { name: "Cyrus", exact: true });
  await expect(card).toBeVisible();
  // The same size and row as a bot's; no "(bot)", no line; their rating; Play greyed (challenging a player isn't built yet), with its note.
  const size = await rectIn(page, ".town-card");
  expect([size.w, size.h].map((v) => Math.round(v * 10) / 10)).toEqual([CARD_SIZE.w, CARD_SIZE.h]);
  await expect(card.getByRole("heading", { name: "Cyrus", exact: true })).toBeVisible();
  await expect(card.getByText("(bot)")).toHaveCount(0);
  await expect(card.getByText("Rating 1432", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Play", exact: true })).toBeDisabled();
  await expect(card.locator("svg.town-ico-swords")).toHaveAttribute("aria-hidden", "true");
  await expect(card.getByText("Coming soon", { exact: true })).toBeVisible();
  // The picture is their profile icon, in an ivory ring, and a button.
  const pic = card.getByRole("button", { name: "View Cyrus's profile", exact: true });
  await expect(pic).toBeVisible();
  expect(await pic.evaluate((el) => ({ tag: el.tagName, cursor: getComputedStyle(el).cursor, border: getComputedStyle(el).borderTopColor, radius: getComputedStyle(el).borderTopLeftRadius }))).toEqual({ tag: "BUTTON", cursor: "pointer", border: CARD.ivory, radius: "50%" });
  const icon = pic.locator("img.user-icon");
  await expect(icon).toBeVisible();
  expect(await icon.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(48);
  // A tap on it opens that player's profile (the same one a name opens), over the town; Back, and the town is as it was.
  await pic.click();
  const sheet = page.locator(".fd-overlay");
  await expect(sheet.getByRole("heading", { name: "Cyrus" })).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "Back", exact: true }).first().click();
  await expect(sheet).toHaveCount(0);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await expect(card).toBeVisible();
  expect(errors).toEqual([]);
});
