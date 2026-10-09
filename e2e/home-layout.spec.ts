import { expect, type Page } from "@playwright/test";
import { named, test } from "./helpers.ts";

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

  // Every front-door page honours it, and the game's colours too.
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

test("computer: the play column is Play with friends | Boss alone, the mode picker, then PLAY at the bottom; no Shop or Profile buttons", async ({ page }) => {
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
    // The shop and your profile: the side menu's, not repeated on home.
    await expect(main.getByRole("button", { name: "Shop & crates" })).toHaveCount(0);
    await expect(main.getByRole("button", { name: "Profile", exact: true })).toHaveCount(0);
    const menu = page.getByRole("navigation", { name: "Menu" });
    await expect(menu.getByRole("button", { name: "Shop & crates" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Profile" })).toBeVisible();
    // Top to bottom: the two ways to play (side by side), the mode picker and matchmaking, PLAY, its line.
    const box = async (l: import("@playwright/test").Locator) => (await l.boundingBox())!;
    const friends = await box(main.getByRole("button", { name: "Play with friends" }));
    const boss = await box(main.getByRole("button", { name: "Boss alone" }));
    const modes = await box(main.getByRole("radiogroup", { name: "Mode" }));
    const types = await box(main.getByRole("radiogroup", { name: "Matchmaking" }));
    const p = await box(play);
    const hint = await box(page.locator(".fd-hint"));
    expect(Math.abs(friends.y - boss.y), `${w}`).toBeLessThan(1);
    expect(friends.x + friends.width).toBeLessThanOrEqual(boss.x);
    expect(friends.height).toBeGreaterThanOrEqual(44);
    expect(friends.y + friends.height, `${w}: the buttons above the modes`).toBeLessThanOrEqual(modes.y);
    expect(modes.y + modes.height).toBeLessThanOrEqual(types.y);
    expect(types.y + types.height, `${w}: the modes right above PLAY`).toBeLessThanOrEqual(p.y);
    expect(p.y - (types.y + types.height)).toBeLessThan(30);
    expect(hint.y).toBeGreaterThanOrEqual(p.y + p.height);
    await expect(page.locator(".fd-hint")).toHaveText(/Starts within|Usually about|Solo vs/);
    if (w >= 1280) {
      // Beside your card: PLAY's line ends level with the card's bottom, and the room above is free (for a live game).
      const card = await box(page.locator(".fd-hero"));
      expect(Math.abs(hint.y + hint.height - (card.y + card.height)), `${w}: PLAY at the bottom`).toBeLessThan(12);
      expect(friends.y - card.y, `${w}: room above`).toBeGreaterThan(200);
      expect(friends.x).toBeGreaterThanOrEqual(card.x + card.width);
    }
    expect(await sideways(page), `${w}`).toBe(0);
  }
});

test("your icon sits to the left of your name and rating on your home card (a drawn icon, pixel-sharp)", async ({ page }) => {
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
    // Left of the name and the rating line, level with them, under your pawn.
    expect(i.x + i.width, `${width}`).toBeLessThanOrEqual(Math.min(name.x, sub.x));
    expect(i.y).toBeLessThan(sub.y + sub.height);
    expect(i.y + i.height).toBeGreaterThan(name.y);
    expect(i.width).toBe(48);
    const pawn = (await hero.locator(".fd-pawn-hero").boundingBox())!;
    expect(i.y).toBeGreaterThanOrEqual(pawn.y + pawn.height - 1);
    await expect(hero.locator(".fd-hero-sub")).toContainText(/No rating yet|·/);
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
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(page.locator(".fd-seats")).toBeVisible();
  // Your profile: over the queue, which carries on underneath.
  await menu.getByRole("button", { name: "Profile" }).click();
  await expect(page.locator(".fd-overlay").getByRole("heading", { name: "Wanderer" })).toBeVisible();
  await page.locator(".fd-overlay").getByRole("button", { name: "Back" }).click();
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

test("phone: the top bar (logo, coins, pawn) fits from 320 px up, even with a six-digit balance", async ({ page }) => {
  test.skip(desktop(), "the phone's top bar");
  // A big balance (the server's answer, with more coins in it).
  await page.route("**/api/me*", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    if (body?.shop) body.shop.coins = 123_456;
    await route.fulfill({ response: res, json: body });
  });
  for (const width of [320, 360, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
    const bar = page.locator(".fd-top");
    await expect(bar.getByLabel("123456 coins")).toBeVisible();
    // Nothing runs off the bar or the screen; the number shows whole; every button is a full 44 px.
    const fits = await bar.evaluate((el) => {
      const right = el.getBoundingClientRect().right - parseFloat(getComputedStyle(el).paddingRight);
      const kids = [...el.querySelectorAll(".fd-logo, .fd-coins, .fd-ring")].map((k) => k.getBoundingClientRect());
      const pill = el.querySelector(".fd-coins")!.getBoundingClientRect();
      const n = el.querySelector(".fd-coins-n")!.getBoundingClientRect();
      const inOrder = kids.every((k, i) => i === 0 || k.left >= kids[i - 1]!.right);
      return { inOrder, inside: kids.every((k) => k.right <= right + 0.5), number: n.left >= pill.left && n.right <= pill.right + 0.5 && n.bottom <= pill.bottom + 0.5 };
    });
    expect(fits, `${width} px`).toEqual({ inOrder: true, inside: true, number: true });
    const ring = (await bar.getByRole("button", { name: "Your profile" }).boundingBox())!;
    expect(ring.width, `Your profile at ${width}`).toBeGreaterThanOrEqual(44);
    expect(await sideways(page), `${width} px`).toBe(0);
  }
});
