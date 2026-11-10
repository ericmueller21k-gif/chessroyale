import { expect, type Page } from "@playwright/test";
import { named, test, pickMode, leaveQueue } from "./helpers.ts";

/**
 * Light or dark, and the computer's home with its queue in place (DECISIONS.md, "Light and dark, a switch", "A cleaner
 * computer home" and "The computer's play column, your icon, no sun"). This device is in dark mode: the app follows it
 * until someone picks.
 */
test.use({ colorScheme: "dark" });

const desktop = () => test.info().project.name === "desktop";
const run = Date.now().toString(36).slice(-5);
const shown = (p: Page) => p.evaluate(() => document.documentElement.getAttribute("data-theme"));
const sideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const bg = (p: Page, sel: string) => p.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
const LIGHT_GROUND = "rgb(244, 242, 238)";
const DARK_GROUND = "rgb(20, 22, 27)";

test("light or dark lives in Settings (Match device / Light / Dark), not on home; the pick survives a reload with no flash", async ({ page }) => {
  await named(page, "Sunny");
  // Every value <html data-theme> takes, from the very start of each load (before the page's own scripts).
  await page.addInitScript(() => {
    const log: string[] = ((window as any).__themes = []);
    new MutationObserver((records) => {
      for (const r of records) if (r.target === document.documentElement) log.push((r.target as Element).getAttribute("data-theme") ?? "none");
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-theme"] });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  // Nothing picked: the device's dark. No sun on home (Eric, Oct 9): not in the side menu, not in the phone's top bar.
  expect(await shown(page)).toBe("dark");
  await expect(page.locator(".fd-theme")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dark mode" })).toHaveCount(0);
  expect(await bg(page, ".fd-root")).toBe(DARK_GROUND);

  // Settings: Theme, Match device checked.
  await page.goto("/settings");
  const themeChoice = page.getByRole("radiogroup", { name: "Theme" });
  await expect(themeChoice.getByRole("radio")).toHaveText(["Match device", "Light", "Dark"]);
  await expect(themeChoice.getByRole("radio", { name: "Match device" })).toHaveAttribute("aria-checked", "true");
  for (const r of await themeChoice.getByRole("radio").all()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Light, forced on a dark device.
  await themeChoice.getByRole("radio", { name: "Light" }).click();
  expect(await shown(page)).toBe("light");
  expect(await bg(page, ".fd-root")).toBe(LIGHT_GROUND);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())).toBe("#f3f1ec");

  // Home, reloaded: light from the first moment (the script in index.html), never dark on the way.
  await page.goto("/");
  await page.reload();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__themes)).toEqual(["light"]);
  expect(await bg(page, ".fd-root")).toBe(LIGHT_GROUND);

  // Every front-door page honors it, and the game's colors too.
  for (const path of ["/settings", "/profile", "/shop"]) {
    await page.goto(path);
    await expect(page.locator(".fd-root").first()).toBeVisible();
    expect(await bg(page, ".fd-root"), path).toBe(LIGHT_GROUND);
  }

  // Match device: dark again (the device), and it follows the device live.
  await page.goto("/settings");
  await expect(themeChoice.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
  await themeChoice.getByRole("radio", { name: "Match device" }).click();
  expect(await shown(page)).toBe("dark");
  expect(await bg(page, ".fd-root")).toBe(DARK_GROUND);
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => shown(page)).toBe("light");
  // Dark, picked: the device going light doesn't change it, nor does a reload.
  await themeChoice.getByRole("radio", { name: "Dark" }).click();
  expect(await shown(page)).toBe("dark");
  expect(await bg(page, ".fd-root")).toBe(DARK_GROUND);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())).toBe("#16181d");
  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  expect(await shown(page)).toBe("dark");
  expect(await page.evaluate(() => (window as any).__themes)).toEqual(["dark"]);
  // Back home: dark.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(await bg(page, ".fd-root")).toBe(DARK_GROUND);
  expect(await sideways(page)).toBe(0);
});

test("computer: the play column in the phone's order (the RANKED row, its panel, PLAY, Chess Town's button, Other modes with Boss Battle and Auto chess at the bottom); the panel greyed (none selected, not tappable) and PLAY dimmed until a mode is picked; no Shop, Profile or Play with friends buttons", async ({ page }) => {
  test.skip(!desktop(), "the computer's layout");
  await named(page, "Columned");
  const main = page.getByRole("main");
  for (const [w, h] of [
    [1024, 768],
    [1280, 800],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    const play = main.getByRole("button", { name: "PLAY", exact: true });
    await expect(play).toBeVisible();
    // Nothing picked yet: PLAY dimmed, and the panel there, greyed with nothing selected (Eric, Oct 25).
    await expect(play).toBeDisabled();
    await expect(page.locator(".fd-mode-panel.idle")).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Solo queue/ })).toBeDisabled();
    await pickMode(page, "50 v 50");
    await expect(page.locator(".fd-mode-panel")).toBeVisible();
    await expect(page.locator(".fd-mode-panel.idle")).toHaveCount(0);
    await expect(play).toBeEnabled();
    // The shop, your profile and Play with friends: the side menu's, not repeated on home.
    await expect(main.getByRole("button", { name: "Shop & crates" })).toHaveCount(0);
    await expect(main.getByRole("button", { name: "Profile", exact: true })).toHaveCount(0);
    await expect(main.getByRole("button", { name: "Play with friends" })).toHaveCount(0);
    const menu = page.getByRole("navigation", { name: "Menu" });
    await expect(menu.getByRole("button", { name: "Shop & crates" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Profile" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Play with friends" })).toBeVisible();
    // Top to bottom, as on a phone (Eric, Oct 19: chess first): the RANKED row, its panel (matchmaking), the line above PLAY
    // (Oct 28) and PLAY, then Chess Town's button (PLAY's size; Nov 1, in the old Boss Arena card's place), "Other modes" (Oct 24),
    // and Boss Battle and Auto chess side by side at the bottom (Eric, Oct 26: half width each).
    const box = async (l: import("@playwright/test").Locator) => (await l.boundingBox())!;
    const town = await box(main.getByRole("button", { name: "Chess Town", exact: true }));
    const solo = await box(main.getByRole("button", { name: /^Boss Battle/ }));
    const auto = await box(main.getByRole("button", { name: /^Auto chess/ }));
    const other = await box(main.getByRole("heading", { name: "Other modes", exact: true }));
    const modes = await box(main.getByRole("radiogroup", { name: "RANKED" }));
    const types = await box(main.getByRole("radiogroup", { name: "Matchmaking" }));
    const p = await box(play);
    const hint = await box(page.locator(".fd-hint"));
    expect(Math.abs(town.height - p.height), `${w}: Chess Town as tall as PLAY`).toBeLessThan(0.5);
    expect(Math.abs(town.width - modes.width), `${w}: Chess Town full width`).toBeLessThan(2);
    expect(modes.y + modes.height).toBeLessThanOrEqual(types.y);
    expect(types.y + types.height, `${w}: the modes right above PLAY's line`).toBeLessThanOrEqual(hint.y);
    expect(hint.y - (types.y + types.height)).toBeLessThan(30);
    expect(hint.y + hint.height, `${w}: the line above PLAY`).toBeLessThanOrEqual(p.y);
    expect(p.y - (hint.y + hint.height), `${w}: the line just above PLAY`).toBeLessThan(12);
    expect(town.y, `${w}: Chess Town below PLAY`).toBeGreaterThanOrEqual(p.y + p.height);
    expect(other.y, `${w}: Other modes below Chess Town`).toBeGreaterThanOrEqual(town.y + town.height);
    expect(solo.y, `${w}: the pair under Other modes`).toBeGreaterThanOrEqual(other.y + other.height);
    expect(Math.abs(solo.y - auto.y), `${w}: Boss Battle and Auto chess side by side`).toBeLessThan(2);
    expect(Math.abs(solo.width - auto.width), `${w}: the two half cards the same width`).toBeLessThan(2);
    expect(Math.abs(solo.width * 2 + 10 - town.width), `${w}: two half cards and their gap are Chess Town's width`).toBeLessThan(2);
    await expect(page.locator(".fd-hint")).toHaveText(/Starts within|Usually about|Start at once/);
    if (w >= 1280) {
      // Beside your card: the Boss raid card ends level with your card's bottom, and the room above is free (for a live
      // game).
      const card = await box(page.locator(".fd-hero"));
      expect(Math.abs(auto.y + auto.height - (card.y + card.height)), `${w}: the column's foot level with the card's`).toBeLessThan(12);
      expect(modes.y - card.y, `${w}: room above`).toBeGreaterThan(200);
      expect(p.x).toBeGreaterThanOrEqual(card.x + card.width);
    }
    expect(await sideways(page), `${w}`).toBe(0);
  }
});

test("your tag sits above your pawn's head, centered over it: the icon left of your name and rating, as tall as those two lines (a drawn icon, pixel-sharp)", async ({ page }) => {
  await named(page, "Iconic");
  // A drawn icon (48 x 48 PNG) in the server's answer: gold with a blue diagonal.
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAABlBMVEUeOorywU4ACwF6AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAh0lEQVRIx7XWWw4AEBQD0WP/myZiAUbCf+Nx2w7WGmERFapCVah7qKdS76HeXH0r9XXVeagTVGeuukT1lepE1buq29V8qIlSM6imVs252gxql6jto/aV2nBqJ6otqvau2tRqt6s0UPmhEkdllEo1lYMqOVXWqnRWeX6P26MIRH/9NPz8yGzFBJLdB737VQ42AAAAAElFTkSuQmCC";
  await page.route("**/api/me*", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    if (body?.user) body.user.icon = png;
    await route.fulfill({ response: res, json: body });
  });
  const widths = desktop() ? [1024, 1280, 1440] : [320, 375, 430];
  for (const width of widths) {
    await page.setViewportSize({ width, height: desktop() ? 800 : 740 });
    await page.goto("/");
    const hero = page.locator(".fd-hero");
    await expect(hero.locator(".fd-hero-name")).toHaveText("Iconic");
    const icon = hero.locator(".fd-hero-icon img.user-icon");
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute("src", png);
    const i = (await icon.boundingBox())!;
    const name = (await hero.locator(".fd-hero-name").boundingBox())!;
    const sub = (await hero.locator(".fd-hero-sub").boundingBox())!;
    // Left of the name and the rating line, and a square.
    expect(i.x + i.width, `${width}`).toBeLessThanOrEqual(Math.min(name.x, sub.x));
    expect(i.width, `${width}: a square`).toBeCloseTo(i.height, 0);
    // Above your pawn's head, centered over it (its top is the card's, the head sits under it). A short card (a 640 px
    // phone or less, or a short window) puts the tag beside the pawn instead, so home still fits (styles.css).
    const pawn = (await hero.locator(".fd-pawn-hero").boundingBox())!;
    const short = (await hero.boundingBox())!.height <= 189;
    // (As tall as the two lines together, level with the name: the tall card's tag. Oct 25: the options panel is there in
    // the first view, so a 320 px phone's card is short from the start, and beside the pawn its rating line can wrap,
    // which leaves the icon shorter than the two lines, as home with a mode picked has always been.)
    if (!short) {
      expect(Math.abs(i.height - (sub.y + sub.height - name.y)), `${width}: the icon as tall as the two lines`).toBeLessThanOrEqual(1.5);
      expect(Math.abs(i.y - name.y), `${width}: the icon level with the name`).toBeLessThanOrEqual(1.5);
    }
    if (short) {
      expect(i.x, `${width}: beside the pawn on a short card`).toBeGreaterThanOrEqual(pawn.x + pawn.width - 1);
      expect(name.x, `${width}: the name beside the icon`).toBeGreaterThanOrEqual(i.x + i.width - 0.5);
    } else {
      const tagBottom = Math.max(i.y + i.height, sub.y + sub.height);
      expect(tagBottom, `${width}: the tag above the pawn`).toBeLessThanOrEqual(pawn.y + 1);
      const tagLeft = Math.min(i.x, name.x);
      const tagRight = Math.max(name.x + name.width, sub.x + sub.width);
      expect(Math.abs((tagLeft + tagRight) / 2 - (pawn.x + pawn.width / 2)), `${width}: the tag centered over the pawn`).toBeLessThanOrEqual(3);
    }
    await expect(hero.locator(".fd-hero-sub")).toContainText(/Unranked|Placement|·/);
    // (No outfit line: the names of what you wear are gone from home.)
    await expect(hero.locator(".fd-hero-sub")).not.toContainText(",");
    expect(await sideways(page), `${width}`).toBe(0);
  }
});

test("computer: PLAY fills the queue in place (the menu, the live panel and your card stay); Cancel is home; nothing sideways at 1024, 1280, 1440", async ({ page }) => {
  test.skip(!desktop(), "the computer's layout");
  test.setTimeout(2 * 60_000);
  await named(page, "Placed");
  const menu = page.getByRole("navigation", { name: "Menu" });
  const panel = page.getByRole("complementary", { name: "Live" });
  for (const [w, h] of [
    [1024, 768],
    [1280, 800],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`/?debug&pool=inplace-${w}-${run}`);
    await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
    // The right column (Eric's mockup, Nov 7): its top slot empty off the town, then FRIENDS; no pawn at the top right any more
    // (Profile is the side menu's).
    await expect(panel.getByRole("button", { name: /^FRIENDS/ })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Your profile", exact: true })).toHaveCount(0);
    // Your card starts at the top (level with the logo), not low with space above it.
    const hero = (await page.locator(".fd-hero").boundingBox())!;
    expect(hero.y).toBeLessThan(40);
    expect(await sideways(page), `home ${w}`).toBe(0);

    await pickMode(page);
    await page.getByRole("button", { name: "PLAY", exact: true }).click();
    await expect(page.locator(".fd-seats .fd-seat")).toHaveCount(100);
    await expect(page.getByText("You're in · seat 1")).toBeVisible();
    await expect(page.locator(".fd-queue-line")).toContainText(/Finding players · \d+ s, then bots fill the rest/);
    // The frame stays: the side menu (on Play) and the live panel, with the lobby between them.
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("button", { name: "Play", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(panel.getByRole("status")).toContainText("online");
    const m = (await menu.boundingBox())!;
    const pn = (await panel.boundingBox())!;
    const seats = (await page.locator(".fd-seats").boundingBox())!;
    expect(seats.x).toBeGreaterThanOrEqual(m.x + m.width);
    expect(seats.x + seats.width).toBeLessThanOrEqual(pn.x);
    // The whole lobby fits the window, its way out included ("Keep me in the queue" and Exit where Cancel was, Nov 10).
    const cancel = (await page.locator(".fd-exit-row").boundingBox())!;
    expect(cancel.y + cancel.height).toBeLessThanOrEqual(h);
    expect((await page.getByRole("button", { name: "Exit", exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // (Exit is right there: no back arrow in the lobby.)
    await expect(page.getByRole("button", { name: /^Exit, / })).toBeHidden();
    // From 1280 px your card shrinks to the top of the left column, the lobby's chat under it, the lobby beside them.
    const card = page.locator(".fd-wait-side .fd-hero");
    const chat = page.locator(".fd-wait-chat .qchat-lobby");
    await expect(chat).toBeVisible();
    // (One chat: the queue screen's own spot, a phone's, is empty here.)
    await expect(page.locator(".qchat-lobby")).toHaveCount(1);
    const ch = (await chat.boundingBox())!;
    expect(ch.height).toBeGreaterThanOrEqual(120);
    if (w >= 1280) {
      await expect(card).toBeVisible();
      await expect(card).toContainText("Placed");
      const c = (await card.boundingBox())!;
      expect(c.x + c.width).toBeLessThanOrEqual(seats.x);
      expect(c.y).toBeLessThan(40);
      expect(c.height).toBeLessThan(140);
      // The chat: under your card, in the same column, down to the bottom of the box.
      expect(ch.y).toBeGreaterThanOrEqual(c.y + c.height);
      expect(Math.abs(ch.x - c.x)).toBeLessThan(2);
      expect(ch.y + ch.height).toBeLessThanOrEqual(h);
    } else {
      await expect(card).toBeHidden();
      // (1024-1279: under the lobby.)
      expect(ch.y).toBeGreaterThanOrEqual(cancel.y + cancel.height);
    }
    expect(await sideways(page), `queue ${w}`).toBe(0);

    await leaveQueue(page);
    await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
    await expect(menu).toBeVisible();
    await expect(panel).toBeVisible();
    // (Out of the lobby: its connection closed, the address home again.)
    expect(await page.evaluate(() => (window as any).match?.closed)).toBe(true);
    expect(new URL(page.url()).pathname).toBe("/");
    expect(await sideways(page), `home again ${w}`).toBe(0);
  }

  // Into a match from the lobby in place: the bots fill (8 s here), then the match's own screen.
  await page.goto(`/?debug&pool=inplace-go-${run}`);
  await pickMode(page);
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(page.locator(".fd-seats")).toBeVisible();
  await expect(page.locator(".fd-count-n")).toHaveText("100", { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase.kind), { timeout: 20_000 }).toBe("vote");
  await expect(page.locator(".fd-seats")).toHaveCount(0);
  // (The match's own screen: the side menu stays, icons only below 1800 px, so a player can always leave by it; the live panel goes.
  // Eric, Nov 1: docs/decisions/2026-11-01-game-screens-computer.md.)
  await expect(menu).toBeVisible();
  await expect(panel).toHaveCount(0);
});

test("computer: in the queue, your profile opens over it; another menu item goes there still queued (Keep me in the queue, Nov 10) or, unchecked, leaves the queue first", async ({ page }) => {
  test.skip(!desktop(), "the computer's menu");
  await named(page, "Wanderer");
  const menu = page.getByRole("navigation", { name: "Menu" });
  await page.goto(`/?debug&pool=inplace-menu-${run}`);
  await pickMode(page);
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(page.locator(".fd-seats")).toBeVisible();
  // Your profile: over the queue, which carries on underneath.
  await menu.getByRole("button", { name: "Profile" }).click();
  await expect(page.locator(".fd-overlay").getByRole("heading", { name: "Wanderer" })).toBeVisible();
  await page.locator(".fd-overlay").getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator(".fd-seats")).toBeVisible();
  expect(await page.evaluate(() => (window as any).match?.phase.kind)).toMatch(/loading|lobby/);
  // Settings, "Keep me in the queue" checked: Settings, still queued (the bar), as 1 v 1's search; Play: home's rows say it.
  await menu.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.locator(".dq-bar .dq-text")).toHaveText("Searching 50 v 50");
  await menu.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".fd-search")).toBeVisible();
  // Back in the lobby (Lobby), unchecked: Settings leaves the queue first, then Settings.
  await page.locator(".fd-search-acts").getByRole("button", { name: /^Lobby/ }).click();
  await page.getByRole("checkbox", { name: "Keep me in the queue" }).uncheck();
  await menu.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  expect(await page.evaluate(() => (window as any).match?.closed)).toBe(true);
  await expect(page.locator(".dq-bar")).toHaveCount(0);
  await menu.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeEnabled();
});

test("phone: the queue takes the whole screen; the count, the grid and its way out (Keep me in the queue, Exit) are in view on common phones, the chat under them; back and Exit, unchecked, leave", async ({ page }) => {
  test.skip(desktop(), "the phone's layout");
  await named(page, "Pocket");
  for (const [w, h] of [
    [390, 664],
    [375, 667],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`/?debug&pool=phonefit-${w}-${run}`);
    await pickMode(page);
    await page.getByRole("button", { name: "PLAY", exact: true }).click();
    await expect(page.locator(".fd-seats .fd-seat")).toHaveCount(100);
    const chat = page.locator(".fd-queue .qchat-lobby");
    await expect(chat).toBeVisible();
    const inView = async (sel: string) => {
      const b = (await page.locator(sel).first().boundingBox())!;
      return b.y >= 0 && b.y + b.height <= h;
    };
    for (const sel of [".fd-queue-count", ".fd-seats", ".fd-exit-row"]) expect(await inView(sel), `${sel} at ${w} x ${h}`).toBe(true);
    await expect(page.getByText("You're in · seat 1")).toBeVisible();
    // The chat: under Exit's row, its header on screen, the rest a scroll away at most.
    const cancel = (await page.locator(".fd-exit-row").boundingBox())!;
    const c = (await chat.boundingBox())!;
    expect(c.y).toBeGreaterThanOrEqual(cancel.y + cancel.height);
    expect(c.y + 26).toBeLessThanOrEqual(h);
    await chat.scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => (window as any).match.chat.enabled)).toBe(true);
    await chat.locator(".qchip", { hasText: "Good luck!" }).click();
    await expect(chat.locator(".qline.you", { hasText: "Good luck!" })).toBeVisible();
    expect(await sideways(page)).toBe(0);
    // The back arrow leaves the queue too, "Keep me in the queue" unchecked (checked, it keeps you queued: search-home.spec.ts).
    await page.getByRole("checkbox", { name: "Keep me in the queue" }).uncheck();
    await page.getByRole("button", { name: "Exit, leave the queue" }).click();
    await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as any).match?.closed)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto(`/?debug&pool=phonequeue-${run}`);
  await expect(page.locator(".fd-top").getByRole("button", { name: "Your profile", exact: true })).toBeVisible();
  await pickMode(page);
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(page.locator(".fd-seats .fd-seat")).toHaveCount(100);
  const vw = page.viewportSize()!.width;
  const q = (await page.locator(".fd-queue").boundingBox())!;
  expect(q.x).toBe(0);
  expect(q.width).toBe(vw);
  expect(q.y).toBe(0);
  // Its own header (the back arrow, the mode, the sound), nothing of home around it, and no menu or panel.
  await expect(page.getByRole("button", { name: "Exit, leave the queue" })).toBeVisible();
  await expect(page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50");
  await expect(page.locator(".fd-top")).toHaveCount(0);
  await expect(page.locator(".fd-hero")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Menu" })).toBeHidden();
  await expect(page.getByRole("complementary", { name: "Live" })).toBeHidden();
  // The grid fills the panel's width (about 30 px pawns).
  const seat = (await page.locator(".fd-seat").first().boundingBox())!;
  expect(seat.width).toBeGreaterThan(26);
  expect(seat.width).toBeLessThan(40);
  expect(await sideways(page)).toBe(0);
  await leaveQueue(page);
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(page.locator(".fd-top").getByRole("button", { name: "Your profile", exact: true })).toBeVisible();
  expect(await sideways(page)).toBe(0);
});

test("phone: home fits the screen with no scrolling from 360×640 up, in every mode, Chess Town's button under PLAY and the Boss Battle and Auto chess cards at the bottom; the shop, your profile and Friends are in the top bar", async ({ page }) => {
  test.skip(desktop(), "a phone's screen (Eric, Oct 18: \"should never have to be scrolling down on the phone\")");
  await named(page, LONG_NAME);
  for (const [width, height] of [[360, 640], [375, 667], [390, 664], [390, 844], [430, 932]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
    for (const mode of ["", "50 v 50", "1 v 1", "Squads"]) {
      if (mode) await pickMode(page, mode);
      const fit = await page.evaluate(() => ({
        scroll: document.documentElement.scrollHeight - innerHeight,
        // (The last card, Auto chess, home's last box, on screen, under PLAY.)
        foot: [...document.querySelectorAll(".rd-card")].pop()!.getBoundingClientRect().bottom <= innerHeight,
        order: [...document.querySelectorAll(".rd-card")].pop()!.getBoundingClientRect().top >= document.querySelector(".fd-play")!.getBoundingClientRect().bottom,
        pawn: document.querySelector(".fd-hero .fd-pawn")!.getBoundingClientRect().height,
      }));
      expect(fit.scroll, `${width}×${height}, ${mode || "no mode"}: scrolling`).toBeLessThanOrEqual(0);
      expect(fit.foot, `${width}×${height}, ${mode || "no mode"}: the Auto chess card on screen`).toBe(true);
      expect(fit.order, `${width}×${height}: the cards under PLAY`).toBe(true);
      expect(fit.pawn, `${width}×${height}, ${mode || "no mode"}: your pawn`).toBeGreaterThanOrEqual(48);
    }
    await expect(page.getByRole("main").getByRole("button", { name: "Play with friends" })).toHaveCount(0);
    await expect(page.locator(".fd-top").getByRole("button", { name: "Shop & crates" })).toBeVisible();
    await expect(page.locator(".fd-top").getByRole("button", { name: /^Friends/ })).toBeVisible();
  }
});

test("the shell (index.html: what shows before the app's script has run) has the logo, the hero's panel and PLAY's outline where home draws them, so the swap can't be seen", async ({ page }) => {
  // (Nov 10, phone load: nothing shifts. Home once, which marks this device for home's shell, then a load with the app's
  // scripts held back: only the shell shows. Each box the same to the pixel, on a phone and a computer.)
  const boxes = (root: string) =>
    page.evaluate(async (root) => {
      await document.fonts.ready;
      const box = (c: string) => [...document.querySelectorAll(`${root} .${c}`)].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => [r.x, r.y, r.width, r.height].map(Math.round))[0] ?? null;
      return { logo: box("fd-logo"), hero: box("fd-hero"), play: box("fd-play") };
    }, root);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(page.locator("#shell")).toHaveCount(0);
  const home = await boxes("#app");
  expect(home.play).not.toBeNull();
  await page.route(/\/assets\/.*\.js$/, (r) => r.abort());
  await page.reload();
  await expect(page.locator("#shell .fd-root")).toHaveCount(1);
  expect(await boxes("#shell")).toEqual(home);
});

test("the loading bar (Eric, Nov 10): only past a 2-second hang; then a bar and what's loading, under the logo, and nothing else moves", async ({ page }) => {
  // (Every class the bar takes and when, from the very start of each load, and when the shell went.)
  await page.addInitScript(() => {
    const w = window as any;
    w.__bar = { shown: null, lines: [], gone: null };
    new MutationObserver(() => {
      const bar = document.querySelector("#shell .hc-load");
      if (bar?.classList.contains("on") && w.__bar.shown === null) w.__bar.shown = performance.now();
      const line = bar?.querySelector(".hc-load-line")?.textContent;
      if (bar?.classList.contains("on") && line && w.__bar.lines.at(-1) !== line) w.__bar.lines.push(line);
      if (!document.getElementById("shell") && document.getElementById("app") && w.__bar.gone === null) w.__bar.gone = performance.now();
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  const logo = () => page.locator("#shell .fd-logo").evaluate((el) => el.getBoundingClientRect().toJSON());
  // Your profile held 3 s: past 2 s the bar shows under the splash's logo, on the "account" line; then home, the shell (and bar) gone.
  await page.route("**/api/me*", async (r) => {
    await new Promise((d) => setTimeout(d, 3_000));
    await r.continue();
  });
  await page.goto("/");
  const before = await logo();
  const bar = page.locator("#shell .hc-load.on");
  await expect(bar).toBeVisible();
  await expect(bar.locator(".hc-load-line")).toHaveText("Loading your account…");
  expect(await logo(), "the logo stays put").toEqual(before);
  const placed = await bar.evaluate((el) => {
    const b = el.querySelector(".hc-load-track")!.getBoundingClientRect(), l = document.querySelector("#shell .fd-logo")!.getBoundingClientRect();
    return { under: b.top >= l.bottom, centered: Math.abs(b.left + b.width / 2 - (l.left + l.width / 2)) <= 1, inside: b.left >= 0 && b.right <= innerWidth };
  });
  expect(placed).toEqual({ under: true, centered: true, inside: true });
  await expect(bar.getByRole("button", { name: "Try again", includeHidden: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(page.locator("#shell")).toHaveCount(0);
  const held = await page.evaluate(() => (window as any).__bar);
  expect(held.shown, "shown at 2 s, not before").toBeGreaterThanOrEqual(2_000);
  expect(held.lines.at(-1)).toBe("Loading your account…");
  // Nothing held: the bar shows only if the load really ran past 2 s (on a quick load, never).
  await page.unrouteAll();
  await page.reload();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  const quick = await page.evaluate(() => (window as any).__bar);
  expect(quick.gone).not.toBeNull();
  expect(quick.shown !== null, `shell gone at ${Math.round(quick.gone)} ms`).toBe(quick.gone > 2_000);
});

test("phone: the top bar (logo, your pawn, the shop, Friends, the gear) fits from 320 px up, with no coins in it", async ({ page }) => {
  test.skip(desktop(), "the phone's top bar");
  for (const width of [320, 360, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
    const bar = page.locator(".fd-top");
    // No coins up here (Eric, Oct 18): the shop and your profile show them.
    await expect(bar.getByText(/coins/)).toHaveCount(0);
    // In order, apart, on one row, inside the bar; every button a full 44 px (40 below 360 px).
    const fits = await bar.evaluate((el) => {
      const right = el.getBoundingClientRect().right - parseFloat(getComputedStyle(el).paddingRight);
      const kids = [...el.querySelectorAll(".fd-logo, .fd-ring, .fd-top-shop, .fd-top-friends, .fd-top-gear")].map((k) => k.getBoundingClientRect());
      return { count: kids.length, inOrder: kids.every((k, i) => i === 0 || k.left >= kids[i - 1]!.right), inside: kids.every((k) => k.right <= right + 0.5), oneRow: kids.every((k) => k.top < kids[0]!.bottom && k.bottom > kids[0]!.top) };
    });
    expect(fits, `${width} px`).toEqual({ count: 5, inOrder: true, inside: true, oneRow: true });
    for (const name of ["Your profile", "Shop & crates", "Friends", "Settings"]) {
      const b = (await bar.getByRole("button", { name, exact: true }).boundingBox())!;
      expect(Math.min(b.width, b.height), `${name} at ${width}`).toBeGreaterThanOrEqual(width < 360 ? 40 : 44);
    }
    // The profile is the shop's square (Eric, Nov 9): same size and corners, no gold ring, and nothing animating in it (a still face).
    const shop = await bar.getByRole("button", { name: "Shop & crates", exact: true }).evaluate((el) => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, r: getComputedStyle(el).borderRadius }));
    const profile = await bar.getByRole("button", { name: "Your profile", exact: true }).evaluate((el) => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, r: getComputedStyle(el).borderRadius, ring: getComputedStyle(el).borderTopWidth, animations: el.getAnimations({ subtree: true }).length }));
    expect(profile, `profile at ${width}`).toEqual({ ...shop, ring: "0px", animations: 0 });
    // Quests, the shop and Friends are outlines like the gear (Eric, Nov 10: "just black and empty on the inside"): no fill, the gear's color.
    const looks = await bar.locator(".fd-top-quests svg, .fd-top-shop svg, .fd-top-friends svg, .fd-top-gear svg").evaluateAll((els) => els.map((el) => ({ fill: getComputedStyle(el).fill, stroke: getComputedStyle(el).stroke })));
    expect(looks, `icons at ${width}`).toEqual(Array(4).fill({ fill: "none", stroke: looks[3]!.stroke }));
    expect(await sideways(page), `${width} px`).toBe(0);
  }
});

/** A full-length name (the server keeps 16 characters) in the widest letters. */
const LONG_NAME = "MMMMMMMMMMMMMMMM";

test("phone: the top bar's shop and gear open the shop and Settings in one tap (Back is home)", async ({ page }) => {
  test.skip(desktop(), "the phone's top bar (a computer has them in its side menu)");
  await named(page, LONG_NAME);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  // One tap: the shop (its balance at the top); Back is home.
  await page.locator(".fd-top").getByRole("button", { name: "Shop & crates" }).click();
  // (The shop's own "Shop" title is gone, Eric, Nov 7: its tab row says where you are.)
  await expect(page.getByRole("heading", { name: "Shop" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Shop", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).first().click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  // One tap: Settings, as Profile → Settings opens it; Back is home.
  await page.locator(".fd-top").getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("radiogroup", { name: "Theme" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).first().click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
});

test("phone: no sideways scroll on home at 320, 360 and 390 px with a 16-character name; the name ellipsizes in its card", async ({ page }) => {
  test.skip(desktop(), "a phone's widths");
  await named(page, LONG_NAME);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto("/");
      const name = page.locator(".fd-hero-name");
      await expect(name).toHaveText(LONG_NAME);
      expect(await sideways(page), `${width} px, ${scheme}`).toBe(0);
      const cut = await name.evaluate((el) => {
        const s = getComputedStyle(el);
        const card = el.closest(".fd-hero")!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        return { ellipsis: s.textOverflow === "ellipsis" && s.whiteSpace === "nowrap", cut: el.scrollWidth > el.clientWidth, inCard: box.left >= card.left && box.right <= card.right };
      });
      expect(cut, `${width} px, ${scheme}`).toEqual({ ellipsis: true, cut: true, inCard: true });
    }
  }
});

test("computer at a laptop's window (1280×600, 1366×768): no gear on home (Settings is the side menu's), the name whole, nothing sideways", async ({ page }) => {
  test.skip(!desktop(), "the computer's layout");
  await named(page, "Columned");
  for (const [w, h] of [
    [1280, 600],
    [1366, 768],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    const play = page.getByRole("main").getByRole("button", { name: "PLAY", exact: true });
    await expect(play).toBeVisible();
    await expect(page.locator(".fd-top-gear")).toBeHidden();
    await expect(page.locator(".fd-side").getByRole("button", { name: "Settings" })).toBeVisible();
    // (The right column's pawn went with Eric's mockup, Nov 7: Profile is the side menu's.)
    await expect(page.locator(".fd-right .fd-ring")).toHaveCount(0);
    const name = page.locator(".fd-hero-name");
    await expect(name).toHaveText("Columned");
    expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth), `${w}×${h}`).toBe(true);
    // PLAY whole in the window, as before.
    const p = (await play.boundingBox())!;
    expect(p.y + p.height, `${w}×${h}`).toBeLessThanOrEqual(h);
    expect(await sideways(page), `${w}×${h}`).toBe(0);
  }
});

test("Chess Town's button and Other modes: Chess Town under PLAY at PLAY's width, then Boss Battle and Auto chess side by side at half width each; Chess Town opens the town square and Back is home; Boss Battle opens its screen with START; ?mode=raid opens the full Boss raid screen with all five (Eric, Oct 26 and Nov 1)", async ({ page }) => {
  await named(page, "Arena");
  await page.goto("/");
  const main = page.getByRole("main");
  const cards = main.locator(".rd-card");
  const town = main.getByRole("button", { name: "Chess Town", exact: true });
  await expect(cards).toHaveCount(2);
  await expect(town).toHaveText("Chess Town");
  await expect(cards.nth(0)).toHaveText(/^Boss BattleAny boss, up to 3$/);
  await expect(cards.nth(1)).toHaveText(/^Auto chessBuild an army$/);
  // Chess Town as wide as the pair; Boss Battle and Auto chess side by side below it, half width each, the same size.
  const t = (await town.boundingBox())!;
  const s = (await cards.nth(0).boundingBox())!;
  const a = (await cards.nth(1).boundingBox())!;
  expect(s.y, "the pair under Chess Town").toBeGreaterThanOrEqual(t.y + t.height);
  expect(Math.abs(s.y - a.y), "Boss Battle and Auto chess side by side").toBeLessThan(1);
  expect(Math.abs(s.width - a.width), "the two half cards the same width").toBeLessThan(1);
  expect(Math.abs(s.height - a.height), "the two half cards the same height").toBeLessThan(1);
  expect(Math.abs(s.width * 2 + 10 - t.width), "two half cards and their gap are Chess Town's width").toBeLessThan(1);
  // Chess Town: the town square (/town), drawn; Back is home (a computer has no Back since Nov 7: the side menu's Play).
  await town.click();
  await expect(page.locator("canvas.town-canvas")).toHaveAttribute("data-ready", "1");
  expect(new URL(page.url()).pathname).toBe("/town");
  // (Back asks first: "Leave Chess Town?", Leave goes home; e2e/town-leave.spec.ts. A computer has no Back since Nov 7: the side menu's
  // Play, which asks the same.)
  if (test.info().project.name === "desktop") await page.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Play", exact: true }).click();
  else await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Leave Chess Town?" }).getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  // Boss Battle: its screen, titled so, with START (no list of options). Back is home.
  await cards.nth(0).click();
  await expect(page.getByRole("heading", { name: "Boss Battle", exact: true })).toBeVisible();
  await expect(main.locator(".rd-option")).toHaveCount(0);
  await expect(main.getByRole("button", { name: "START" })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "RANKED" })).toBeVisible();
  // ?mode=raid (the test link): the full Boss raid screen, all five choices.
  await page.goto("/?mode=raid");
  await expect(page.getByRole("heading", { name: "Boss Battle", exact: true })).toBeVisible();
  await expect(main.locator(".rd-option")).toHaveCount(5);
  // A computer's side menu: Boss Battle opens its screen (highlighted there), Chess Town the town square.
  if (desktop()) {
    await page.goto("/");
    const menu = page.getByRole("navigation", { name: "Menu" });
    await menu.getByRole("button", { name: "Boss Battle" }).click();
    await expect(page.getByRole("heading", { name: "Boss Battle", exact: true })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Boss Battle" })).toHaveAttribute("aria-current", "page");
    await menu.getByRole("button", { name: "Chess Town" }).click();
    await expect(page.locator("canvas.town-canvas")).toHaveAttribute("data-ready", "1");
    expect(new URL(page.url()).pathname).toBe("/town");
  }
});

test("quests (Nov 9, phase 3; real quests set by ?quests=): the Quests entry opens the overlay over home, 2 dailies and the weekly, one reroll a day per daily, Got it and × close it, the entry reopens it; a phone's entry is in the top bar, a computer's on the card; at 320 px the top bar holds it in one row, every button 40 px, and the card fits", async ({ page }) => {
  await named(page, "Christopher Wallace");
  await page.goto("/?quests=boss-hunter,squad-up,regular:3");
  const quests = page.getByRole("dialog", { name: "Daily Quests" });
  // (A guest's day doesn't open it by itself: the entry does, once the quests are set.)
  const entry = page.getByRole("button", { name: "Quests", exact: true });
  await expect(entry).toBeEnabled({ timeout: 20_000 });
  await expect.poll(async () => ((await (await page.request.get("/api/quests")).json()) as { quests: { name: string }[] }).quests.map((q) => q.name), { timeout: 20_000 }).toEqual(["Boss Hunter", "Squad Up", "Regular"]);
  await entry.click();
  await expect(quests).toBeVisible();
  await expect(quests.locator(".qo-name")).toHaveText(["Boss Hunter", "Squad Up", "Regular"]);
  await expect(quests.locator(".qo-row.weekly .qo-name")).toHaveText("Regular");
  await expect(quests.getByText(/^New quests in \d+[hm]$/)).toBeVisible();
  await expect(quests.getByText(/^Resets in \d+[dhm]$/)).toBeVisible();
  // Each daily its own free reroll a day (Eric, Nov 10): reroll the first, only the first greys and only its quest changes; the
  // second still works; then both grey (still there).
  const rerolls = quests.locator(".qo-reroll");
  await expect(rerolls).toHaveCount(2);
  await rerolls.first().click();
  await expect(rerolls.first()).toBeDisabled();
  await expect(quests.locator(".qo-name").first()).not.toHaveText("Boss Hunter");
  await expect(quests.locator(".qo-name").nth(1)).toHaveText("Squad Up");
  await expect(rerolls.nth(1)).toBeEnabled();
  await rerolls.nth(1).click();
  await expect(quests.locator(".qo-name").nth(1)).not.toHaveText("Squad Up");
  for (const r of await rerolls.all()) await expect(r).toBeDisabled();
  await quests.getByRole("button", { name: "Got it" }).click();
  await expect(quests).toHaveCount(0);
  // The entry: in the top bar on a phone (1 px from the shop's row), on your card's top right on a computer (1024 px and up).
  const computer = await page.evaluate(() => innerWidth >= 1024);
  await expect(page.locator(computer ? ".fd-hero .fd-quests-btn" : ".fd-top .fd-top-quests")).toHaveCount(1);
  await expect(page.locator(computer ? ".fd-top .fd-top-quests" : ".fd-hero .fd-quests-btn")).toHaveCount(0);
  await entry.click();
  await expect(quests).toBeVisible();
  await quests.getByRole("button", { name: "Close" }).click();
  await expect(quests).toHaveCount(0);

  // A 320 px phone (the Quests entry in the top bar, Nov 9 round 2): the top bar's items in one row, none over another, none
  // cut; the entry is the same square as the shop's; the card fits in the window, no row's words cut, nothing sideways.
  if (computer) return;
  await page.setViewportSize({ width: 320, height: 568 });
  const bar = await page.evaluate(() => {
    const top = document.querySelector(".fd-top")!;
    const shop = document.querySelector(".fd-top-shop")!.getBoundingClientRect();
    const questsBtn = document.querySelector(".fd-top-quests")!.getBoundingClientRect();
    // (Every button and the logo in the bar, the pawn's button included: its wrapper can be squeezed narrower than what it holds.)
    const items = [...top.querySelectorAll(":scope > .fd-logo, .fd-top-end button")].map((e) => ({ name: (e as HTMLElement).className || e.tagName, r: e.getBoundingClientRect() }));
    const overlaps: string[] = [];
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i].r, b = items[j].r;
        if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) overlaps.push(`${items[i].name} / ${items[j].name}`);
      }
    const cut = [...top.querySelectorAll(":scope > .fd-logo, .fd-top-end *")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible").map((e) => e.className);
    const edge = Math.max(...items.map((i) => i.r.right)) - innerWidth;
    return {
      overlaps,
      cut,
      edge,
      rows: [...new Set(items.filter((i) => i.name.includes("fd-icon-btn") || i.name.includes("fd-ring")).map((i) => Math.round(i.r.top)))],
      outside: items.filter((i) => i.r.left < top.getBoundingClientRect().left - 0.5 || i.r.right > top.getBoundingClientRect().right + 0.5).map((i) => i.name),
      entry: { w: questsBtn.width, h: questsBtn.height, sameAsShop: Math.abs(questsBtn.width - shop.width) < 1 && Math.abs(questsBtn.height - shop.height) < 1 && Math.abs(questsBtn.top - shop.top) < 1 },
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(bar.overlaps).toEqual([]);
  expect(bar.outside).toEqual([]);
  expect(bar.cut).toEqual([]);
  expect(bar.edge).toBeLessThanOrEqual(0);
  expect(bar.rows).toHaveLength(1);
  expect(bar.entry.sameAsShop).toBe(true);
  // (Phase 3: no squeeze under 40 px; the logo steps down to its icon instead.)
  expect(Math.min(bar.entry.w, bar.entry.h)).toBeGreaterThanOrEqual(40);
  expect(bar.sideways).toBe(0);
  await entry.click();
  await expect(quests).toBeVisible();
  const fit = await page.evaluate(() => {
    const card = document.querySelector(".qo-card")!.getBoundingClientRect();
    const cut = [...document.querySelectorAll(".qo-name, .qo-count, .qo-xp")].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
    return { left: card.left, right: card.right, width: innerWidth, cut, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(fit.left).toBeGreaterThanOrEqual(0);
  expect(fit.right).toBeLessThanOrEqual(fit.width);
  expect(fit.cut).toEqual([]);
  expect(fit.sideways).toBe(0);
});
