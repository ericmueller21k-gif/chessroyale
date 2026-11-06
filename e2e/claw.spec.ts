import { expect, type Page } from "@playwright/test";
import { bossCrateOf, clawWins, mulberry32 } from "@chessroyale/core";
import { asServerAdmin, test } from "./helpers.ts";

/**
 * Boingo's claw machine (Nov 6; docs/decisions/2026-11-06-claw-machine.md), on a phone and a computer: an admin (Eric's path for
 * test tokens: the machine's own "Admin: +3 of each token", the admins' grant) plays Folio's token to a forced win and a forced loss
 * with the e2e's seed hook (`?clawSeed=`, honored only where TEST_SWITCHES is on), opens the won crate with the Crates tab's own
 * opening, and the token count drops by one each play. The machine opens with the test switch `?claw=1` until Boingo's room places it.
 */

/** A seed whose roll wins (or loses): the server's roll with the seed hook is mulberry32(seed)'s first number. */
const seedFor = (win: boolean) => {
  for (let s = 1; ; s++) if (clawWins(mulberry32(s)()) === win) return s;
};
const folio = bossCrateOf("folio")!;

const locker = (page: Page) =>
  page.evaluate(async () => (await (await fetch("/api/locker")).json()) as { tokens: Record<string, number>; bossCrates: Record<string, number> });

test("the claw machine: an admin's test tokens, a forced win (Open now opens the crate) and a forced loss, one token each", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await asServerAdmin(page);
  await page.goto(`/?claw=1&clawSeed=${seedFor(true)}`);
  const machine = page.locator(".claw-machine");
  await expect(machine).toBeVisible({ timeout: 30_000 });
  await expect(machine.locator(".claw-screen")).toHaveText("Insert one boss coin");
  // No tokens yet: the friendly line, every token greyed (shown, not hidden).
  await expect(machine.getByText("You have no boss tokens yet.")).toBeVisible();
  const token = machine.locator('.claw-token[data-boss="folio"]');
  await expect(token).toBeDisabled();
  // Eric's testing: the admins' grant, from the machine.
  await machine.getByRole("button", { name: "Admin: +3 of each token" }).click();
  await expect(token).toHaveAttribute("data-count", "3", { timeout: 20_000 });
  await expect(machine.getByText("You have no boss tokens yet.")).toHaveCount(0);

  // A forced win: the coin, the claw roams (STOP), drops, lifts and carries Folio's crate to the chute.
  await token.click();
  await expect(machine).toHaveAttribute("data-stage", "roam", { timeout: 10_000 });
  expect((await locker(page)).tokens.folio).toBe(2);
  expect((await locker(page)).bossCrates[folio.id]).toBe(1);
  await machine.getByRole("button", { name: "STOP" }).click();
  await expect(machine).toHaveAttribute("data-stage", "won", { timeout: 10_000 });
  await expect(machine.locator(".claw-screen")).toHaveText("You won Folio's Boss Crate!");
  await expect(machine.locator(".claw-chute .claw-chute-crate")).toBeVisible();
  await machine.screenshot({ path: test.info().outputPath("claw-won.png") });
  // Open now: the Crates tab's own opening, to its reveal; the crate is gone from the inventory.
  await machine.getByRole("button", { name: "Open now" }).click();
  await expect(page.locator(".claw-machine .reveal-card")).toBeVisible({ timeout: 30_000 });
  expect((await locker(page)).bossCrates[folio.id] ?? 0).toBe(0);
  await page.getByRole("button", { name: /Done/ }).click();

  // A forced loss: the same, and it slips at the top. One more token gone, no crate.
  await page.goto(`/?claw=1&clawSeed=${seedFor(false)}`);
  await expect(machine).toBeVisible({ timeout: 30_000 });
  await expect(token).toHaveAttribute("data-count", "2");
  await token.click();
  await expect(machine).toHaveAttribute("data-stage", "roam", { timeout: 10_000 });
  await machine.getByRole("button", { name: "STOP" }).click();
  await expect(machine).toHaveAttribute("data-stage", "lost", { timeout: 10_000 });
  await expect(machine.locator(".claw-screen")).toHaveText("So close! Try again?");
  const after = await locker(page);
  expect([after.tokens.folio, after.bossCrates[folio.id] ?? 0]).toEqual([1, 0]);
  // Try again: back to the picker, the count down by one.
  await machine.getByRole("button", { name: "Try again" }).click();
  await expect(token).toHaveAttribute("data-count", "1");
  // Closing is safe: the machine goes; nothing more is spent.
  await machine.getByRole("button", { name: "Close" }).click();
  await expect(machine).toHaveCount(0);
  expect((await locker(page)).tokens.folio).toBe(1);
  expect(errors).toEqual([]);
});
