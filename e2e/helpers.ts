import { test as base, expect, type Page } from "@playwright/test";

/**
 * Playwright's `test`, plus: every browser context a test opens itself (`browser.newContext()`, e.g. a second
 * player) is closed when the test ends, pass or fail. Playwright leaves them open until the worker exits, and a page
 * left in a live match keeps playing it (a host's page runs its engines), slowing every later test in that worker.
 * Use this `test` in any file that opens contexts.
 */
export const test = base.extend<{ closeOwnContexts: void }>({
  closeOwnContexts: [
    async ({ browser }, use) => {
      const before = new Set(browser.contexts());
      await use();
      await Promise.all(browser.contexts().filter((c) => !before.has(c)).map((c) => c.close()));
    },
    { auto: true },
  ],
});

/**
 * The front door, as a player uses it. Your name is your profile's: `named` sets the one a fresh device's guest
 * account is made with (before the first visit).
 */
export async function named(page: Page, name: string) {
  await page.addInitScript((n) => {
    try {
      if (!localStorage.getItem("brc.name")) localStorage.setItem("brc.name", n);
    } catch {
      // No storage.
    }
  }, name);
}

/** Home → Play with friends → Solo vs bots (in the mode the URL or the picker chose). */
export async function soloFromHome(page: Page) {
  // (The home screen's button: on a computer the side menu has one too.)
  await page.getByRole("main").getByRole("button", { name: "Play with friends" }).click();
  await page.getByRole("button", { name: /^Solo vs \d+ bots$/ }).click();
}

/** Home → Play with friends → Create a lobby (or a raid). */
export async function createLobbyFromHome(page: Page) {
  // (The home screen's button: on a computer the side menu has one too.)
  await page.getByRole("main").getByRole("button", { name: "Play with friends" }).click();
  await page.getByRole("button", { name: /^Create a (lobby|raid|Classic lobby)$/ }).click();
}

/** An invite link opens the join form with the code filled in. */
export async function joinFromInvite(page: Page) {
  const dialog = page.getByRole("dialog", { name: /Join lobby/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Join lobby" }).click();
}
