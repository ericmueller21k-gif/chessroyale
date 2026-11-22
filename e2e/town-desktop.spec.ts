import { devices, expect, type Page } from "@playwright/test";
import { asSignedIn, settled, tapInTown, test } from "./helpers.ts";

/**
 * The town square on a computer (Oct 29, Eric; docs/decisions/2026-10-29-town-on-computer.md, docs/areas/town-square.md): in the front
 * door's frame, in exactly the box home's middle column (`.fd-center`) takes, the side menu on the left and the live panel with the global
 * chat on the right as on home; since Nov 7 no bar: the town's tools are in the right column's top slot, under "TOWN". A
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
const ready = (p: Page) => p.locator("canvas.town-canvas[data-ready='1']").waitFor();
const onlyComputer = () => test.skip(test.info().project.name !== "desktop", "a computer's window: the desktop project");

/** The bar's parts and the box's, measured. */
const PARTS = { screen: ".town-screen", bar: ".town-bar", back: ".town-back", map: ".tm-toggle", chatBtn: ".tc-mode", quests: '.town-bar [aria-label="Quests"]', shop: '.town-bar [aria-label="Shop & crates"]', friends: ".town-bar .fd-top-friends", gear: '[aria-label="Town settings"]', box: ".town-box", canvas: "canvas.town-canvas", controls: ".town-controls", zoom: ".town-zoom", focus: ".town-recenter", chat: ".town-chat" } as const;
async function parts(p: Page) {
  // (One read of every box, as the page is now; a part that isn't there is null. Read one by one, each missing part waited the action
  // timeout, 15 s: a computer has no bar, so 45 s a read.)
  return (await p.evaluate(
    (sels) =>
      Object.fromEntries(
        Object.entries(sels).map(([k, sel]) => {
          const r = document.querySelector(sel)?.getBoundingClientRect();
          return [k, r ? [r.x, r.y, r.width, r.height] : null];
        }),
      ),
    PARTS,
  )) as Record<keyof typeof PARTS, Box>;
}

for (const [w, h] of [[1280, 800], [1440, 900], [1920, 1080]] as const) {
  test(`${w} × ${h}: the town fills everything between the menu and the right column, top to bottom; the town's tools in the right column's top slot under TOWN (no bar); nothing pokes out of the box`, async ({ page }) => {
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
    // (Measured once every box holds still: the page right after the town's first frame can still be laying out.)
    const t = await settled(page, () => parts(page));
    // Everything between the menu's right edge and the right column's left edge, from the window's top to its bottom (no width limit).
    const between: Box = [home.side[0] + home.side[2], 0, home.right[0] - (home.side[0] + home.side[2]), h];
    nearBox(t.screen, between, 1, "the town's box is the space between the menu and the right column, full height");
    nearBox(await box(page, ".fd-side"), home.side, 1, "the menu is home's");
    nearBox(await box(page, ".fd-right"), home.right, 1, "the right column is home's");
    // The frame's parts show and work as on home: the menu (Chess Town is where you are), the live panel and the global chat.
    await expect(page.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Chess Town" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("complementary", { name: "Live" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Global chat" })).toBeVisible();

    // No bar on a computer (Eric's mockup, Nov 7): "TOWN" and the town's tools (the chat icon, the gear and the map, everyone's since Nov 13) centered in the
    // right column's top slot, under it; the world fills the whole box.
    await expect(page.locator(".town-bar")).toHaveCount(0);
    const slot = (await box(page, ".rc-slot"))!;
    expect(inside(slot, home.right), "the slot is in the right column").toBe(true);
    for (const k of ["chatBtn", "gear"] as const) expect(inside(t[k], slot), `${k} is in the slot`).toBe(true);
    const mid = (b: Box) => b[0] + b[2] / 2;
    expect(Math.abs(mid((await box(page, ".rc-tools"))!) - mid(slot)), "the tools centered").toBeLessThanOrEqual(1);
    expect(Math.abs(mid((await box(page, ".rc-slot .rc-h"))!) - mid(slot)), "TOWN centered").toBeLessThanOrEqual(1);
    expect(t.chatBtn[0] + t.chatBtn[2], "the chat icon, then the gear").toBeLessThanOrEqual(t.gear[0] + 1);
    nearBox(t.canvas, t.screen, 1, "the world fills the whole box");
    expect(await page.getByRole("button", { name: "View profile", exact: true }).isVisible(), "no profile button on the town page").toBe(false);
    // The buttons keep their corner of the box; the chat box keeps the world's top left corner.
    expect(Math.abs(t.screen[0] + t.screen[2] - 14 - (t.focus[0] + t.focus[2])), "the focus button 14 px from the box's right").toBeLessThanOrEqual(1);
    expect(Math.abs(t.screen[1] + t.screen[3] - 14 - (t.focus[1] + t.focus[3])), "and 14 px from its foot").toBeLessThanOrEqual(1);
    expect(Math.abs(t.chat[0] - t.canvas[0] - 8) + Math.abs(t.chat[1] - t.canvas[1] - 8), "the chat box is 8 px in from the world's top left").toBeLessThanOrEqual(1);

    // Nothing pokes out of the box (nor into the menu or the right column): the buttons, the chat box, every chip, an open card; and the page doesn't scroll.
    for (const k of ["zoom", "focus", "chat"] as const) expect(inside(t[k], t.screen), `${k} is inside the box`).toBe(true);
    const chips = await page.locator(".town-chip-face").evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] as Box; }));
    expect(chips.length, "chips show").toBeGreaterThan(0);
    for (const c of chips) expect(inside(c, t.screen), `a chip ${JSON.stringify(c)} is inside the box`).toBe(true);
    // A card: Babur's Circus, tapped (the camera glides to it if it isn't in view; the tap waits for the view to hold still: a tap read
    // mid-glide landed beside it and walked you off, Nov 13).
    await tapInTown(page, "home", "tiger", page.locator(".town-card"));
    expect(inside((await box(page, ".town-card"))!, t.screen), "an open card is inside the box").toBe(true);
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight, innerWidth, innerHeight]);
    expect(scroll, "the page doesn't scroll").toEqual([w, h, w, h]);
  });
}

test("the menu works as on home: Home goes home, Chess Town comes back to the town; nothing jumps while the town loads", async ({ page }) => {
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
  // (Home asks first from the town: "Leave Chess Town?", e2e/town-leave.spec.ts.)
  await menu.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Leave Chess Town?" }).getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  await menu.getByRole("button", { name: "Chess Town" }).click();
  await ready(page);
  expect(new URL(page.url()).pathname).toBe("/town");
  await expect(menu.getByRole("button", { name: "Chess Town" })).toHaveAttribute("aria-current", "page");
});

test("the side menu's Play with friends, Daily Quests, Shop & crates and Profile open over the town (Nov 22): the side menu lit and usable, another switches, Back, Escape, the back gesture and Chess Town close it; the town is the same one after, your square kept, no goodbye sent; Home leaves", async ({ page }) => {
  onlyComputer();
  test.setTimeout(150_000);
  await page.goto("/");
  await asSignedIn(page, "layers");
  // (The town's beats to the server: a closing town says goodbye ({ leave: true }), so none may go while the layers open and close.)
  const goodbyes: string[] = [];
  page.on("request", (r) => r.url().endsWith("/api/town/here") && (r.postData() ?? "").includes('"leave":true') && goodbyes.push(r.url()));
  await page.goto(`/town?sky=day&townroom=layers${Date.now().toString(36)}&quests=warm-up:1`);
  await ready(page);
  const cv = page.locator("canvas.town-canvas");
  await page.waitForTimeout(600);
  const square = await cv.getAttribute("data-you");
  // (The town's own canvas, marked: the same element after, so the town never unmounted under the layer.)
  await cv.evaluate((el) => void ((el as unknown as { mark: number }).mark = 1));
  const menu = page.getByRole("navigation", { name: "Menu" });
  const item = (name: string) => menu.getByRole("button", { name, exact: true });
  const layer = page.getByTestId("town-layer");
  const leave = page.getByRole("alertdialog", { name: "Leave Chess Town?" });
  const center = (await box(page, ".fd-root.framed.fd-on-town > .fd-center"))!;
  const steps = await page.evaluate(() => history.length);
  const sameTown = async (what: string) => {
    await expect(layer, `${what}: closed`).toHaveCount(0);
    await expect(item("Chess Town"), what).toHaveAttribute("aria-current", "page");
    expect(await cv.evaluate((el) => (el as unknown as { mark?: number }).mark), `${what}: the same town`).toBe(1);
    expect(await cv.getAttribute("data-you"), `${what}: your square`).toBe(square);
    expect(new URL(page.url()).pathname, what).toBe("/town");
  };
  const opens = async (name: string, lit: string, inside: (l: typeof layer) => Promise<void>) => {
    await item(name).click();
    await expect(leave, `${name}: no question, the town stays`).toHaveCount(0);
    await expect(layer).toHaveAttribute("aria-label", name);
    await inside(layer);
    await expect(item(lit), `${name}: lit`).toHaveAttribute("aria-current", "page");
    await expect(item("Chess Town")).not.toHaveAttribute("aria-current", "page");
    // (Over the town's middle column exactly: the side menu and the right column as they were.)
    nearBox(await box(page, '[data-testid="town-layer"]'), center, 1, `${name}: over the middle column`);
    await expect(page.locator(".fd-right .rc-h").first()).toHaveText("TOWN");
  };
  const shop = (l: typeof layer) => expect(l.getByRole("tab", { name: "Crates" })).toBeVisible();
  // (LAYER_STILLS=<folder>, outside the repo: a still of each page over the town.)
  const still = async (name: string) => {
    if (!process.env.LAYER_STILLS) return;
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${process.env.LAYER_STILLS}/town-${name}-desktop.png` });
  };
  // Shop & crates; the arrow keys don't walk the town under it; Profile switches the layer (no new step); its Back closes it.
  await opens("Shop & crates", "Shop & crates", shop);
  await still("shop");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowUp");
  await opens("Profile", "Profile", (l) => expect(l.getByRole("button", { name: "Back" }).first()).toBeVisible());
  await still("profile");
  expect(await page.evaluate(() => history.length), "one step for the layer, switched in place").toBe(steps + 1);
  await layer.getByRole("button", { name: "Back" }).first().click();
  await sameTown("Profile's Back");
  // Daily Quests (home's card, over the town): Escape closes it.
  await opens("Daily Quests", "Daily Quests", (l) => expect(l.getByRole("heading", { name: "Daily Quests" })).toBeVisible());
  await page.keyboard.press("Escape");
  await sameTown("Escape");
  // Play with friends (home's sheet): the back gesture closes it, not the town's "Leave Chess Town?".
  await opens("Play with friends", "Play with friends", (l) => expect(l.getByRole("dialog", { name: "Play with friends" }).getByRole("button", { name: "Get friend code" })).toBeVisible());
  await page.goBack();
  await expect(leave).toHaveCount(0);
  await sameTown("the back gesture");
  // Chess Town closes it too.
  await opens("Shop & crates", "Shop & crates", shop);
  await item("Chess Town").click();
  await sameTown("Chess Town");
  expect(goodbyes, "the town never said goodbye").toEqual([]);
  // The town's own step is still there: the back gesture asks to leave, as before any layer.
  await page.goBack();
  await leave.getByRole("button", { name: "Stay" }).click();
  await sameTown("Stay");
  // Home leaves the town, as it always did (asked first).
  await item("Home").click();
  await expect(leave.locator(".fd-sub")).toHaveText("You'll head back to Home.");
  await leave.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(cv).toHaveCount(0);
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
  expect(Math.abs(900 - 18 - (t.gear[0] + t.gear[2])), "the gear is at the right end (home's 18 px margin since Nov 22)").toBeLessThanOrEqual(1);
});

test("a phone's bar (Nov 22): back and home's six buttons fit a 320 px phone at 40 px, in order, none touching; Shop & crates and Play with friends open over the town and close back to the same town", async ({ browser }) => {
  onlyComputer();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 320, height: 568 } });
  const page = await ctx.newPage();
  await page.goto("/town?sky=day&townafk=off");
  await ready(page);
  await page.waitForTimeout(600);
  const bar = page.locator(".town-bar");
  const boxes = (await bar.locator("button").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }))) as Box[];
  expect(boxes.length, "seven buttons").toBe(7);
  // (In home's order after back and the map: the chat (its label says its mode), Quests, Shop & crates, Friends (Play with friends), the gear.)
  const labels = await bar.locator("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
  expect([labels[0], labels[1], labels[3], labels[4], labels[6]]).toEqual(["Back", "Map", "Quests", "Shop & crates", "Town settings"]);
  expect(labels[2]).toMatch(/chat/i);
  expect(labels[5]).toMatch(/^Play with friends/);
  for (const [i, b] of boxes.entries()) {
    expect(b[2], `button ${i}: at least 40 px`).toBeGreaterThanOrEqual(40);
    expect(b[0], `button ${i}: on the screen`).toBeGreaterThanOrEqual(0);
    expect(b[0] + b[2], `button ${i}: on the screen`).toBeLessThanOrEqual(320);
    const prev = boxes[i - 1];
    if (prev) expect(b[0], `button ${i}: after the one before, not touching`).toBeGreaterThanOrEqual(prev[0] + prev[2] + 4 - 0.5);
  }
  const cv = page.locator("canvas.town-canvas");
  const square = await cv.getAttribute("data-you");
  await cv.evaluate((el) => void ((el as unknown as { mark: number }).mark = 1));
  const layer = page.getByTestId("town-layer");
  const same = async (what: string) => {
    await expect(layer, what).toHaveCount(0);
    await expect(page.getByRole("alertdialog", { name: "Leave Chess Town?" }), what).toHaveCount(0);
    expect(await cv.evaluate((el) => (el as unknown as { mark?: number }).mark), `${what}: the same town`).toBe(1);
    expect(await cv.getAttribute("data-you"), `${what}: your square`).toBe(square);
    expect(new URL(page.url()).pathname, what).toBe("/town");
  };
  // The shop over the whole screen, in its own page; its Back closes it.
  await bar.getByRole("button", { name: "Shop & crates" }).click();
  await expect(layer.getByRole("tab", { name: "Crates" })).toBeVisible();
  nearBox(await box(page, '[data-testid="town-layer"]'), [0, 0, 320, 568], 1, "the whole screen");
  await layer.getByRole("button", { name: "Back" }).first().click();
  await same("the shop's Back");
  // Play with friends (home's sheet): the back gesture closes it, not the town's "Leave Chess Town?".
  await bar.getByRole("button", { name: /^Play with friends/ }).click();
  await expect(layer.getByRole("dialog", { name: "Play with friends" })).toBeVisible();
  await page.goBack();
  await same("the back gesture");
  await ctx.close();
});

/**
 * Phones and tablets: the town's boxes, with the frame absent: each is the whole screen, the bar's back button, map, chat icon, Quests, Shop & crates, Friends and
 * gear, the world, the arrow keys over the zoom pair and the focus button (Eric, Nov 4: the pair and the focus button 27 px and 57 px
 * wide, 87 px together with the keys' width, right-aligned: town-arrow-keys-v3), and the chat box. The bar, the world and the chat box
 * are main's (5e70aeed), to the pixel (the bar's buttons since Nov 22: back and home's six, measured then); the controls' boxes are the arrow keys' layout. Measured the same way (`devices["iPhone 13"]`
 * with each window size: a touch screen, a tablet on its side included). The town animates, so boxes, not pixels.
 */
const MAIN: Record<string, Record<keyof typeof PARTS, Box>> = {
  "390x844": {
    screen: [0, 0, 390, 844],
    bar: [0, 0, 390, 52],
    back: [18, 3.5, 44, 44],
    map: [78, 3.5, 44, 44],
    chatBtn: [128, 3.5, 44, 44],
    quests: [178, 3.5, 44, 44],
    shop: [228, 3.5, 44, 44],
    friends: [278, 3.5, 44, 44],
    gear: [328, 3.5, 44, 44],
    box: [0, 52, 390, 792],
    canvas: [0, 52, 390, 792],
    controls: [289, 740, 87, 90],
    zoom: [289, 803, 57, 27],
    focus: [349, 803, 27, 27],
    chat: [8, 60, 249.4, 182.2],
  },
  "430x932": {
    screen: [0, 0, 430, 932],
    bar: [0, 0, 430, 52],
    back: [18, 3.5, 44, 44],
    map: [98, 3.5, 44, 44],
    chatBtn: [152, 3.5, 44, 44],
    quests: [206, 3.5, 44, 44],
    shop: [260, 3.5, 44, 44],
    friends: [314, 3.5, 44, 44],
    gear: [368, 3.5, 44, 44],
    box: [0, 52, 430, 880],
    canvas: [0, 52, 430, 880],
    controls: [329, 828, 87, 90],
    zoom: [329, 891, 57, 27],
    focus: [389, 891, 27, 27],
    chat: [8, 60, 275.8, 202.4],
  },
  "768x1024": {
    screen: [0, 0, 768, 1024],
    bar: [0, 0, 768, 52],
    back: [18, 3.5, 44, 44],
    map: [436, 3.5, 44, 44],
    chatBtn: [490, 3.5, 44, 44],
    quests: [544, 3.5, 44, 44],
    shop: [598, 3.5, 44, 44],
    friends: [652, 3.5, 44, 44],
    gear: [706, 3.5, 44, 44],
    box: [0, 52, 768, 972],
    canvas: [0, 52, 768, 972],
    controls: [667, 920, 87, 90],
    zoom: [667, 983, 57, 27],
    focus: [727, 983, 27, 27],
    chat: [8, 60, 300, 223.5],
  },
  "1024x768": {
    screen: [0, 0, 1024, 768],
    bar: [0, 0, 1024, 52],
    back: [18, 3.5, 44, 44],
    map: [692, 3.5, 44, 44],
    chatBtn: [746, 3.5, 44, 44],
    quests: [800, 3.5, 44, 44],
    shop: [854, 3.5, 44, 44],
    friends: [908, 3.5, 44, 44],
    gear: [962, 3.5, 44, 44],
    box: [0, 52, 1024, 716],
    canvas: [0, 52, 1024, 716],
    controls: [923, 664, 87, 90],
    zoom: [923, 727, 57, 27],
    focus: [983, 727, 27, 27],
    chat: [8, 60, 500, 340],
  }
};
test("phones and tablets: the town's boxes are main's at 390 × 844, 430 × 932, 768 × 1024 and a tablet on its side (1024 × 768, touch); no frame; the bar's back and home's six buttons (Nov 22)", async ({ browser }) => {
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
    // (Since Nov 22 the bar is back, then home's buttons: the map, the chat, Quests, Shop & crates, Friends and the gear, together at the right.)
    await expect(page.locator(".town-bar h1"), `${size}: the title for screen readers only`).toHaveClass(/town-sr-title/);
    expect(Math.abs(t.gear[0] + t.gear[2] - (w - 18)), `${size}: the gear at the right end`).toBeLessThanOrEqual(1);
    await ctx.close();
  }
});
