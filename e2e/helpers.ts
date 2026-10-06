import { expect, type Page } from "@playwright/test";

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
