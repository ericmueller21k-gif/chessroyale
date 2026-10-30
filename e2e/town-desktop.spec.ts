import { devices, expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * The town square on a computer (Oct 29, Eric; docs/decisions/2026-10-29-town-on-computer.md, docs/areas/town-square.md): in the front
 * door's frame, in exactly the box home's middle column (`.fd-center`) takes, the side menu on the left and the live panel with the global
 * chat on the right as on home, and the chat icon at the left of the bar, right after the title (the gear stays at the right end). A
 * computer is 1024 px wide or more with a mouse. Phones and tablets (a tablet on its side included: touch) are main's, box for box.
 */
test.use({ actionTimeout: 15_000 });

type Box = [number, number, number, number];
const box = (p: Page, sel: string): Promise<Box | null> =>
  p.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height] as Box;
  }).catch(() => null);
const nearBox = (a: Box | null, b: Box, tol: number, what: string) => {
  expect(a, what).not.toBeNull();
  a!.forEach((v, i) => expect(Math.abs(v - b[i]!), `${what}: ${JSON.stringify(a)} against ${JSON.stringify(b)}`).toBeLessThanOrEqual(tol));
};
/** `a` lies inside `b` (a pixel's give). */
const inside = (a: Box, b: Box) => a[0] >= b[0] - 1 && a[1] >= b[1] - 1 && a[0] + a[2] <= b[0] + b[2] + 1 && a[1] + a[3] <= b[1] + b[3] + 1;
const apart = (a: Box, b: Box) => a[0] + a[2] <= b[0] || b[0] + b[2] <= a[0] || a[1] + a[3] <= b[1] || b[1] + b[3] <= a[1];
const ready = (p: Page) => p.locator("canvas.town-canvas[data-ready='1']").waitFor();
const onlyComputer = () => test.skip(test.info().project.name !== "desktop", "a computer's window: the desktop project");

/** The bar's parts and the box's, measured. */
const PARTS = { screen: ".town-screen", bar: ".town-bar", back: ".town-back", title: ".town-bar h1", chatBtn: ".tc-mode", gear: '[aria-label="Town settings"]', box: ".town-box", canvas: "canvas.town-canvas", controls: ".town-controls", zoom: ".town-zoom", focus: ".town-recenter", chat: ".town-chat" } as const;
async function parts(p: Page) {
  const out = {} as Record<keyof typeof PARTS, Box>;
  for (const k of Object.keys(PARTS) as (keyof typeof PARTS)[]) out[k] = (await box(p, PARTS[k]))!;
  return out;
}

for (const [w, h] of [[1280, 800], [1440, 900], [1920, 1080]] as const) {
  test(`${w} × ${h}: the town fills everything between the menu and the right column, top to bottom; the bar is the right column's top row (back, title, chat icon, gear, one size); nothing pokes out of the box`, async ({ page }) => {
    onlyComputer();
    // (The chat box lies over the map's top left corner and takes taps there; this test taps the map: e2e/town.spec.ts does the same.)
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
        document.head.append(s);
      });
    });
    await page.setViewportSize({ width: w, height: h });
    // Home first: its middle column, the menu and the right column.
    await page.goto("/");
    await page.getByRole("button", { name: "PLAY", exact: true }).waitFor();
    const home = { center: (await box(page, ".fd-center"))!, side: (await box(page, ".fd-side"))!, right: (await box(page, ".fd-right"))! };
    expect(home.center[2], "home's middle box is a real box").toBeGreaterThan(500);

    await page.goto("/town?sky=day");
    await ready(page);
    await page.waitForTimeout(600);
    const t = await parts(page);
    // Everything between the menu's right edge and the right column's left edge, from the window's top to its bottom (no width limit).
    const between: Box = [home.side[0] + home.side[2], 0, home.right[0] - (home.side[0] + home.side[2]), h];
    nearBox(t.screen, between, 1, "the town's box is the space between the menu and the right column, full height");
    nearBox(await box(page, ".fd-side"), home.side, 1, "the menu is home's");
    nearBox(await box(page, ".fd-right"), home.right, 1, "the right column is home's");
    // The frame's parts show and work as on home: the menu (Boss Arena is where you are), the live panel and the global chat.
    await expect(page.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Boss Arena" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("complementary", { name: "Live" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Global chat" })).toBeVisible();

    // The bar is the right column's top row, where the profile button is on other pages (24 px down, 44 px high); the world fills the whole box.
    const r = home.right;
    expect(inside(t.bar, r), "the bar is inside the right column").toBe(true);
    expect(Math.abs(t.bar[1] - 24) + Math.abs(t.bar[3] - 44), "the bar is the row the profile button has: 24 px down, 44 high").toBeLessThanOrEqual(1);
    nearBox(t.canvas, t.screen, 1, "the world fills the whole box");
    expect(await page.getByRole("button", { name: "Your profile" }).isVisible(), "no profile button on the town page").toBe(false);
    // Back, title, chat icon, gear, left to right; the round buttons are one size, the profile button's (44 px); no icon covers the title.
    expect(t.back[0] + t.back[2], "back, then the title").toBeLessThanOrEqual(t.title[0] + 1);
    expect(t.title[0] + t.title[2], "the title, then the chat icon").toBeLessThanOrEqual(t.chatBtn[0] + 1);
    expect(t.chatBtn[0] + t.chatBtn[2], "the chat icon, then the gear").toBeLessThanOrEqual(t.gear[0] + 1);
    for (const k of ["back", "chatBtn", "gear"] as const) expect([t[k][2], t[k][3]], `${k} is 44 × 44, the profile button's size`).toEqual([44, 44]);
    expect(apart(t.chatBtn, t.title) && apart(t.gear, t.title) && apart(t.back, t.title), "no icon covers the title").toBe(true);
    // The buttons keep their corner of the box; the chat box keeps the world's top left corner.
    expect(Math.abs(t.screen[0] + t.screen[2] - 14 - (t.focus[0] + t.focus[2])), "the focus button 14 px from the box's right").toBeLessThanOrEqual(1);
    expect(Math.abs(t.screen[1] + t.screen[3] - 14 - (t.focus[1] + t.focus[3])), "and 14 px from its foot").toBeLessThanOrEqual(1);
    expect(Math.abs(t.chat[0] - t.canvas[0] - 8) + Math.abs(t.chat[1] - t.canvas[1] - 8), "the chat box is 8 px in from the world's top left").toBeLessThanOrEqual(1);

    // Nothing pokes out of the box (nor into the menu or the right column): the buttons, the chat box, every chip, an open card; and the page doesn't scroll.
    for (const k of ["zoom", "focus", "chat"] as const) expect(inside(t[k], t.screen), `${k} is inside the box`).toBe(true);
    const chips = await page.locator(".town-chip-face").evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] as Box; }));
    expect(chips.length, "chips show").toBeGreaterThan(0);
    for (const c of chips) expect(inside(c, t.screen), `a chip ${JSON.stringify(c)} is inside the box`).toBe(true);
    // A card: Babur's Circus (brought into view by its chip if it isn't), tapped.
    const at = () => page.evaluate(() => (window as unknown as { __townAt: (k: string, id: string) => { x: number; y: number } | null }).__townAt("home", "tiger"));
    if (!(await at())) await page.getByRole("button", { name: "Go to Babur's Circus" }).click({ force: true });
    await expect.poll(at, { message: "the circus is in view" }).not.toBeNull();
    await expect(async () => {
      const tap = (await at())!;
      await page.mouse.click(t.canvas[0] + tap.x, t.canvas[1] + tap.y);
      await expect(page.locator(".town-card")).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });
    expect(inside((await box(page, ".town-card"))!, t.screen), "an open card is inside the box").toBe(true);
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight, innerWidth, innerHeight]);
    expect(scroll, "the page doesn't scroll").toEqual([w, h, w, h]);
  });
}

test("the menu works as on home: Play goes home, Boss Arena comes back to the town; nothing jumps while the town loads", async ({ page }) => {
  onlyComputer();
  // Nothing jumps as it loads: the center column's box is one box from the first frame that has it to the world's first frame and after.
  await page.addInitScript(() => {
    const seen = new Set<string>();
    (window as unknown as { __rects: Set<string> }).__rects = seen;
    const end = performance.now() + 4000;
    const tick = () => {
      for (const sel of [".fd-center", ".fd-side", ".fd-right"]) {
        const e = document.querySelector(sel);
        if (e) {
          const r = e.getBoundingClientRect();
          seen.add(`${sel} ${[r.x, r.y, r.width, r.height].map(Math.round)}`);
        }
      }
      if (performance.now() < end) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto("/town?sky=day");
  await ready(page);
  await page.waitForTimeout(3000);
  const seen = await page.evaluate(() => [...(window as unknown as { __rects: Set<string> }).__rects]);
  expect(seen.length, `the center, the menu and the right column each keep one box: ${seen}`).toBe(3);

  const menu = page.getByRole("navigation", { name: "Menu" });
  await menu.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  await menu.getByRole("button", { name: "Boss Arena" }).click();
  await ready(page);
  expect(new URL(page.url()).pathname).toBe("/town");
  await expect(menu.getByRole("button", { name: "Boss Arena" })).toHaveAttribute("aria-current", "page");
});

test("a mouse window narrower than the frame (900 × 700) has the whole screen and both icons at the right, as a phone does", async ({ page }) => {
  onlyComputer();
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto("/town?sky=day");
  await ready(page);
  await expect(page.locator(".fd-side")).toHaveCount(0);
  const t = await parts(page);
  nearBox(t.screen, [0, 0, 900, 700], 1, "the whole screen");
  expect(t.chatBtn[0], "the chat icon is at the right").toBeGreaterThan(900 / 2);
  expect(Math.abs(900 - 14 - (t.gear[0] + t.gear[2])), "the gear is at the right end").toBeLessThanOrEqual(1);
});

/**
 * Phones and tablets: the town's boxes are main's (5e70aeed), to the pixel, with the frame absent: each is the whole screen, the bar's
 * back button, title, chat icon and gear, the world, the zoom pair and the focus button, and the chat box. Measured on main the same way
 * (`devices["iPhone 13"]` with each window size: a touch screen, a tablet on its side included). The town animates, so boxes, not pixels.
 */
const MAIN: Record<string, Record<keyof typeof PARTS, Box>> = {
  "390x844": {
    screen: [0, 0, 390, 844],
    bar: [0, 0, 390, 52],
    back: [14, 7.5, 36, 36],
    title: [62, 16.5, 126, 18],
    chatBtn: [296, 7.5, 36, 36],
    gear: [340, 7.5, 36, 36],
    box: [0, 52, 390, 792],
    canvas: [0, 52, 390, 792],
    controls: [242, 794, 134, 36],
    zoom: [242, 794, 88, 36],
    focus: [340, 794, 36, 36],
    chat: [8, 60, 249.4, 182.2],
  },
  "430x932": {
    screen: [0, 0, 430, 932],
    bar: [0, 0, 430, 52],
    back: [14, 7.5, 36, 36],
    title: [62, 16.5, 126, 18],
    chatBtn: [336, 7.5, 36, 36],
    gear: [380, 7.5, 36, 36],
    box: [0, 52, 430, 880],
    canvas: [0, 52, 430, 880],
    controls: [282, 882, 134, 36],
    zoom: [282, 882, 88, 36],
    focus: [380, 882, 36, 36],
    chat: [8, 60, 275.8, 202.4],
  },
  "768x1024": {
    screen: [0, 0, 768, 1024],
    bar: [0, 0, 768, 52],
    back: [14, 7.5, 36, 36],
    title: [62, 16.5, 126, 18],
    chatBtn: [674, 7.5, 36, 36],
    gear: [718, 7.5, 36, 36],
    box: [0, 52, 768, 972],
    canvas: [0, 52, 768, 972],
    controls: [620, 974, 134, 36],
    zoom: [620, 974, 88, 36],
    focus: [718, 974, 36, 36],
    chat: [8, 60, 300, 223.5],
  },
  "1024x768": {
    screen: [0, 0, 1024, 768],
    bar: [0, 0, 1024, 52],
    back: [14, 7.5, 36, 36],
    title: [62, 16.5, 126, 18],
    chatBtn: [930, 7.5, 36, 36],
    gear: [974, 7.5, 36, 36],
    box: [0, 52, 1024, 716],
    canvas: [0, 52, 1024, 716],
    controls: [876, 718, 134, 36],
    zoom: [876, 718, 88, 36],
    focus: [974, 718, 36, 36],
    chat: [8, 60, 500, 340],
  }
};
test("phones and tablets: the town's boxes are main's at 390 × 844, 430 × 932, 768 × 1024 and a tablet on its side (1024 × 768, touch); no frame, both icons at the right", async ({ browser }) => {
  onlyComputer();
  for (const size of Object.keys(MAIN)) {
    const [w, h] = size.split("x").map(Number) as [number, number];
    const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto("/town?sky=day");
    await ready(page);
    await page.waitForTimeout(800);
    await expect(page.locator(".fd-root, .fd-side, .fd-right"), `${size}: no frame`).toHaveCount(0);
    const t = await parts(page);
    for (const k of Object.keys(PARTS) as (keyof typeof PARTS)[]) nearBox(t[k], MAIN[size]![k], 0.6, `${size}: ${k}`);
    expect(t.chatBtn[0], `${size}: the chat icon is right of the title`).toBeGreaterThanOrEqual(t.title[0] + t.title[2]);
    expect(Math.abs(t.gear[0] - (t.chatBtn[0] + t.chatBtn[2] + 8)), `${size}: the icons sit together at the right`).toBeLessThanOrEqual(1);
    await ctx.close();
  }
});
