import { expect, type Page } from "@playwright/test";
import { named, test, pickMode } from "./helpers.ts";

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

test("computer: the play column in the phone's order (the RANKED row, its panel, PLAY, Other modes with the Boss raid card and Auto chess at the bottom); the panel greyed (none selected, not tappable) and PLAY dimmed until a mode is picked; no Shop, Profile or Play with friends buttons", async ({ page }) => {
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
    await expect(page.getByRole("radio", { name: /^Default/ })).toBeDisabled();
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
    // Top to bottom, as on a phone (Eric, Oct 19: chess first): the RANKED row, its panel (matchmaking), PLAY and its
    // line, then "Other modes" (Oct 24), the Boss raid card and Auto chess (full width) at the bottom.
    const box = async (l: import("@playwright/test").Locator) => (await l.boundingBox())!;
    const boss = await box(main.getByRole("button", { name: /^Boss raid/ }));
    const auto = await box(main.getByRole("button", { name: /^Auto chess/ }));
    const other = await box(main.getByRole("heading", { name: "Other modes", exact: true }));
    const modes = await box(main.getByRole("radiogroup", { name: "RANKED" }));
    const types = await box(main.getByRole("radiogroup", { name: "Matchmaking" }));
    const p = await box(play);
    const hint = await box(page.locator(".fd-hint"));
    expect(boss.height).toBeGreaterThanOrEqual(60);
    expect(Math.abs(boss.width - modes.width), `${w}: the card full width`).toBeLessThan(2);
    expect(modes.y + modes.height).toBeLessThanOrEqual(types.y);
    expect(types.y + types.height, `${w}: the modes right above PLAY`).toBeLessThanOrEqual(p.y);
    expect(p.y - (types.y + types.height)).toBeLessThan(30);
    expect(hint.y).toBeGreaterThanOrEqual(p.y + p.height);
    expect(other.y, `${w}: Other modes below PLAY's line`).toBeGreaterThanOrEqual(hint.y + hint.height);
    expect(boss.y, `${w}: the Boss raid card under Other modes`).toBeGreaterThanOrEqual(other.y + other.height);
    expect(auto.y, `${w}: Auto chess under the Boss raid card`).toBeGreaterThanOrEqual(boss.y + boss.height);
    expect(Math.abs(auto.width - boss.width), `${w}: the same width`).toBeLessThan(2);
    await expect(page.locator(".fd-hint")).toHaveText(/Starts within|Usually about|Solo vs/);
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
    await expect(hero.locator(".fd-hero-sub")).toContainText(/No rating yet|·/);
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
    // Your coins and pawn: the top right of the page, in the live panel.
    await expect(panel.getByRole("button", { name: "Your profile" })).toBeVisible();
    const ring = (await panel.getByRole("button", { name: "Your profile" }).boundingBox())!;
    expect(ring.y).toBeLessThan(40);
    expect(ring.x + ring.width).toBeGreaterThan(w - 40);
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
    // The whole lobby fits the window, Cancel included.
    const cancel = (await page.getByRole("button", { name: "Cancel" }).boundingBox())!;
    expect(cancel.y + cancel.height).toBeLessThanOrEqual(h);
    expect(cancel.height).toBeGreaterThanOrEqual(44);
    // (Cancel is right there: no back arrow in the lobby.)
    await expect(page.getByRole("button", { name: "Leave the queue" })).toBeHidden();
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

    await page.getByRole("button", { name: "Cancel" }).click();
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
  await expect(menu).toHaveCount(0);
});

test("computer: in the queue, your profile opens over it; another menu item leaves the queue and goes there", async ({ page }) => {
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
  // Settings: out of the queue, then Settings.
  await menu.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  expect(await page.evaluate(() => (window as any).match?.closed)).toBe(true);
  await menu.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
});

test("phone: the queue takes the whole screen; the count, the grid and Cancel are in view on common phones, the chat under them; back and Cancel leave", async ({ page }) => {
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
    for (const sel of [".fd-queue-count", ".fd-seats", ".fd-cancel"]) expect(await inView(sel), `${sel} at ${w} x ${h}`).toBe(true);
    await expect(page.getByText("You're in · seat 1")).toBeVisible();
    // The chat: under Cancel, its header on screen, the rest a scroll away at most.
    const cancel = (await page.locator(".fd-cancel").boundingBox())!;
    const c = (await chat.boundingBox())!;
    expect(c.y).toBeGreaterThanOrEqual(cancel.y + cancel.height);
    expect(c.y + 26).toBeLessThanOrEqual(h);
    await chat.scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => (window as any).match.chat.enabled)).toBe(true);
    await chat.locator(".qchip", { hasText: "Good luck!" }).click();
    await expect(chat.locator(".qline.you", { hasText: "Good luck!" })).toBeVisible();
    expect(await sideways(page)).toBe(0);
    // The back arrow leaves the queue too.
    await page.getByRole("button", { name: "Leave the queue" }).click();
    await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as any).match?.closed)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto(`/?debug&pool=phonequeue-${run}`);
  await expect(page.locator(".fd-top").getByRole("button", { name: "Your profile" })).toBeVisible();
  await pickMode(page);
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(page.locator(".fd-seats .fd-seat")).toHaveCount(100);
  const vw = page.viewportSize()!.width;
  const q = (await page.locator(".fd-queue").boundingBox())!;
  expect(q.x).toBe(0);
  expect(q.width).toBe(vw);
  expect(q.y).toBe(0);
  // Its own header (the back arrow, the mode, the sound), nothing of home around it, and no menu or panel.
  await expect(page.getByRole("button", { name: "Leave the queue" })).toBeVisible();
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
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await expect(page.locator(".fd-top").getByRole("button", { name: "Your profile" })).toBeVisible();
  expect(await sideways(page)).toBe(0);
});

test("phone: home fits the screen with no scrolling from 360×640 up, in every mode, the Boss raid and Auto chess cards at the bottom under PLAY; the shop, your profile and Friends are in the top bar", async ({ page }) => {
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
        // (The last card, Auto chess, home's last box, on screen, under PLAY's line.)
        foot: [...document.querySelectorAll(".rd-card")].pop()!.getBoundingClientRect().bottom <= innerHeight,
        order: [...document.querySelectorAll(".rd-card")].pop()!.getBoundingClientRect().top >= document.querySelector(".fd-hint")!.getBoundingClientRect().bottom,
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
  await expect(page.getByRole("heading", { name: "Shop" })).toBeVisible();
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
    await expect(page.locator(".fd-right > .fd-top-right .fd-ring")).toBeVisible();
    const name = page.locator(".fd-hero-name");
    await expect(name).toHaveText("Columned");
    expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth), `${w}×${h}`).toBe(true);
    // PLAY whole in the window, as before.
    const p = (await play.boundingBox())!;
    expect(p.y + p.height, `${w}×${h}`).toBeLessThanOrEqual(h);
    expect(await sideways(page), `${w}×${h}`).toBe(0);
  }
});
