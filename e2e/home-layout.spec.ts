import { expect, type Page } from "@playwright/test";
import { named, test } from "./helpers.ts";

/**
 * Light or dark, and the computer's home with its queue in place (DECISIONS.md, "Light and dark, a switch" and "A
 * cleaner computer home"). This device is in dark mode: the app follows it until someone picks.
 */
test.use({ colorScheme: "dark" });

const desktop = () => test.info().project.name === "desktop";
const run = Date.now().toString(36).slice(-5);
const shown = (p: Page) => p.evaluate(() => document.documentElement.getAttribute("data-theme"));
const sideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const bg = (p: Page, sel: string) => p.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
const LIGHT_GROUND = "rgb(244, 242, 238)";
const DARK_GROUND = "rgb(20, 22, 27)";

test("light or dark: the sun switches, the pick survives a reload with no flash, Settings has Match device / Light / Dark", async ({ page }) => {
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
  // Nothing picked: the device's dark, and the sun is the black one.
  expect(await shown(page)).toBe("dark");
  const sun = page.getByRole("button", { name: "Dark mode" });
  await expect(sun).toHaveCount(1);
  await expect(sun).toHaveAttribute("aria-pressed", "true");
  const box = (await sun.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  if (desktop()) {
    // The computer: its own small button in the side menu, just above Settings (now a gear).
    const menu = page.getByRole("navigation", { name: "Menu" });
    await expect(menu.getByRole("button", { name: "Dark mode" })).toBeVisible();
    const settings = (await menu.getByRole("button", { name: "Settings" }).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(settings.y + 1);
    expect(settings.y - (box.y + box.height)).toBeLessThan(24);
  } else {
    // A phone: the home's top bar, by your coins and pawn.
    await expect(page.locator(".fd-top").getByRole("button", { name: "Dark mode" })).toBeVisible();
    await expect(page.locator(".fd-top").getByRole("button", { name: "Your profile" })).toBeVisible();
  }
  expect(await bg(page, ".fd-root")).toBe(DARK_GROUND);

  // Tap: light, forced on a dark device.
  await sun.click();
  expect(await shown(page)).toBe("light");
  await expect(sun).toHaveAttribute("aria-pressed", "false");
  expect(await bg(page, ".fd-root")).toBe(LIGHT_GROUND);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())).toBe("#f3f1ec");

  // Reload: light from the first moment (the script in index.html), never dark on the way.
  await page.reload();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__themes)).toEqual(["light"]);
  await expect(page.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "false");

  // Every front-door page honours it, and the game's colours too.
  for (const path of ["/settings", "/profile", "/shop"]) {
    await page.goto(path);
    await expect(page.locator(".fd-root").first()).toBeVisible();
    expect(await bg(page, ".fd-root"), path).toBe(LIGHT_GROUND);
  }

  // Settings: Theme, with the pick checked.
  await page.goto("/settings");
  const themeChoice = page.getByRole("radiogroup", { name: "Theme" });
  await expect(themeChoice.getByRole("radio")).toHaveText(["Match device", "Light", "Dark"]);
  await expect(themeChoice.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
  // Match device: dark again (the device), and it follows the device live.
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
  // Back home, the sun agrees with Settings.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true");
  expect(await sideways(page)).toBe(0);
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
    // From 1280 px your card shrinks to the top of the left column, the lobby beside it.
    const card = page.locator(".fd-wait-side .fd-hero");
    if (w >= 1280) {
      await expect(card).toBeVisible();
      await expect(card).toContainText("Placed");
      const c = (await card.boundingBox())!;
      expect(c.x + c.width).toBeLessThanOrEqual(seats.x);
      expect(c.y).toBeLessThan(40);
      expect(c.height).toBeLessThan(140);
    } else await expect(card).toBeHidden();
    // (No empty box where the lobby's chat goes.)
    expect(await page.locator(".fd-wait-chat:empty").count()).toBe(0);
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

test("phone: the queue still takes the whole screen; Cancel is home, with the sun in the top bar", async ({ page }) => {
  test.skip(desktop(), "the phone's layout");
  await named(page, "Pocket");
  await page.goto(`/?debug&pool=phonequeue-${run}`);
  await expect(page.locator(".fd-top").getByRole("button", { name: "Dark mode" })).toBeVisible();
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
  await expect(page.locator(".fd-top").getByRole("button", { name: "Dark mode" })).toBeVisible();
  expect(await sideways(page)).toBe(0);
});

test("phone: the top bar (logo, sun, coins, pawn) fits from 320 px up, even with a six-digit balance", async ({ page }) => {
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
      const kids = [...el.querySelectorAll(".fd-logo, .fd-theme, .fd-coins, .fd-ring")].map((k) => k.getBoundingClientRect());
      const pill = el.querySelector(".fd-coins")!.getBoundingClientRect();
      const n = el.querySelector(".fd-coins-n")!.getBoundingClientRect();
      const inOrder = kids.every((k, i) => i === 0 || k.left >= kids[i - 1]!.right);
      return { inOrder, inside: kids.every((k) => k.right <= right + 0.5), number: n.left >= pill.left && n.right <= pill.right + 0.5 && n.bottom <= pill.bottom + 0.5 };
    });
    expect(fits, `${width} px`).toEqual({ inOrder: true, inside: true, number: true });
    for (const name of ["Dark mode", "Your profile"]) {
      const b = (await bar.getByRole("button", { name }).boundingBox())!;
      expect(b.width, `${name} at ${width}`).toBeGreaterThanOrEqual(44);
    }
    expect(await sideways(page), `${width} px`).toBe(0);
  }
});
