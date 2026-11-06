import { expect, type Page } from "@playwright/test";
import { HUNCHESS_RIDES, WELCOME_CRATE_ID } from "@chessroyale/core";
import { asSignedIn, named, test } from "./helpers.ts";

/**
 * The HunChess Welcome Crate (Eric, Nov 6; docs/decisions/2026-11-06-welcome-crate.md), on a phone and a computer: a signed-in
 * account finishes 5 games (through the app's own result path, POST /api/results, as a solo result screen saves one: the fastest
 * real path), sees the one-time "You earned a Welcome Crate!" notice, opens the crate in the Crates tab (the usual strip, Fischer
 * Random, the reveal) to a HunChess ride, rides it in the town, finds "Not tradeable" and no trade or listing anywhere, and a sixth
 * game grants nothing more. WELCOME_SHOTS=<dir>: the stills for the PR (docs/welcome-crate/).
 */

test.use({ actionTimeout: 15_000 });
const SHOTS = process.env.WELCOME_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${test.info().project.name}.png` });
};

type LockerNow = { items: { id: string; def: string; blemish: number }[]; welcome: { games: number; status: string; notice: boolean; item?: string } };
const lockerNow = (page: Page) => page.evaluate(async () => (await (await fetch("/api/locker")).json()) as LockerNow);
/** One finished game, saved as a solo result screen saves it (the app's own path). */
const finishGame = (page: Page) =>
  page.evaluate(async () => (await fetch("/api/results", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "classic", placement: 2, players: 8, evalBar: true }) })).ok);

test("the Welcome Crate: 5 finished games earn it once; its notice, opening it to a HunChess ride, riding it in the town, never tradeable; a sixth game grants nothing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await named(page, "Tess");
  await page.goto("/");
  await asSignedIn(page, "welcome");
  await page.reload();

  // Four games: not yet. The Crates tab shows how far along you are (greyed, not hidden).
  for (let i = 0; i < 4; i++) expect(await finishGame(page)).toBe(true);
  expect((await lockerNow(page)).welcome).toMatchObject({ status: "locked", games: 4, notice: false });
  await page.goto("/shop?crates");
  const row = page.locator(`.welcome-crate-row[data-crate="${WELCOME_CRATE_ID}"]`);
  await expect(row).toContainText("HunChess Welcome Crate");
  await expect(row).toContainText("Thank you for being an early tester!");
  await expect(row).toContainText("Finish 5 games to earn your Welcome Crate: 4/5");
  await expect(row.locator(".not-tradeable")).toHaveText("Not tradeable");
  await expect(row).toHaveClass(/none/);

  // The fifth: earned. Home shows the one-time notice.
  expect(await finishGame(page)).toBe(true);
  await page.goto("/");
  const notice = page.locator(".welcome-notice");
  await expect(notice).toBeVisible({ timeout: 20_000 });
  await expect(notice).toContainText("You earned a Welcome Crate!");
  await expect(notice).toContainText("Thank you for being an early tester!");
  await shot(page, "notice");
  await notice.getByRole("button", { name: "▶ OK" }).click();
  await expect(notice).toHaveCount(0);
  // Once: closed, it doesn't come back.
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.locator(".welcome-notice")).toHaveCount(0);
  expect((await lockerNow(page)).welcome).toMatchObject({ status: "ready", notice: false });

  // The inventory: the crate, yours to open; its card.
  await page.goto("/shop?crates");
  await expect(row).toContainText("You have 1. Open it!");
  await expect(row).not.toHaveClass(/none/);
  await shot(page, "crate-row");
  await row.click();
  const hero = page.locator(".welcome-crate-hero");
  await expect(hero).toContainText("HunChess Welcome Crate");
  await expect(hero).toContainText("Thank you for being an early tester!");
  await expect(hero.locator(".not-tradeable")).toHaveText("Not tradeable");
  // No purity anywhere on its page (Eric: "Purity isn't listed for these").
  await expect(page.locator(".welcome-page")).not.toContainText(/purity/i);
  await expect(page.locator(".welcome-page .odds-row")).toHaveCount(HUNCHESS_RIDES.length);
  await shot(page, "crate-card");

  // Open it: the strip, Fischer Random, then the reveal: a HunChess ride, "Not tradeable", no purity, no "Open another".
  await page.getByRole("button", { name: /^▶ Open$/ }).click();
  await expect(page.locator(".crate-opening .spin")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500);
  await shot(page, "opening");
  const reveal = page.locator(".reveal-card");
  await expect(reveal).toBeVisible({ timeout: 40_000 });
  await expect(reveal.locator(".reveal-name")).toHaveText(/^HunChess /);
  await expect(reveal.locator(".not-tradeable")).toHaveText("Not tradeable");
  await expect(reveal).not.toContainText(/purity/i);
  await expect(reveal.getByRole("button", { name: "▶ Open another" })).toBeDisabled();
  await shot(page, "reveal");
  let locker = await lockerNow(page);
  const won = locker.items.filter((i) => i.def.endsWith("-hunchess"));
  expect(won).toHaveLength(1);
  expect(HUNCHESS_RIDES.map((d) => d.id)).toContain(won[0]!.def);
  expect(locker.welcome).toMatchObject({ status: "opened", item: won[0]!.id });
  // Wear it from the reveal.
  await reveal.getByRole("button", { name: "▶ Wear" }).click();
  await expect(reveal.getByRole("button", { name: "Wearing it" })).toBeVisible();
  await reveal.getByRole("button", { name: "▶ Done" }).click();
  await expect(page.locator(".welcome-crate-hero .welcome-progress")).toHaveText("Opened. Its ride is in your locker.");
  await expect(page.getByRole("button", { name: /^▶ Open$/ })).toBeDisabled();

  // Opening again (a second tap, another device): nothing new, the same ride.
  const again = await page.evaluate(async (crate) => {
    const r = await fetch("/api/locker/open", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ crate }) });
    return { ok: r.ok, body: (await r.json()) as { again?: boolean; item?: { id: string } } };
  }, WELCOME_CRATE_ID);
  expect(again).toMatchObject({ ok: true, body: { again: true, item: { id: won[0]!.id } } });
  expect((await lockerNow(page)).items.filter((i) => i.def.endsWith("-hunchess"))).toHaveLength(1);

  // The locker: its tile says "Not tradeable", no purity; there's no trade, sell or list button for it (none exist).
  await page.goto("/shop");
  await page.getByRole("tab", { name: "Locker" }).click();
  await page.getByRole("tab", { name: "Ride", exact: true }).click();
  const tile = page.locator(".locker-item.hunchess-item");
  await expect(tile).toHaveCount(1);
  await expect(tile.locator(".not-tradeable")).toHaveText("Not tradeable");
  await expect(tile).not.toContainText("%");
  await expect(tile.locator(".locker-worn")).toHaveText("Worn");
  await expect(page.getByRole("button", { name: /trade|sell|list for/i })).toHaveCount(0);
  await expect(page.locator(".locker-preview .avatar.riding")).toHaveCount(2);
  await shot(page, "not-tradeable");

  // Riding it in the town: your pawn on the HunChess ride, its frames ready.
  await page.goto("/town?sky=day");
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __townRide?: () => { you: { ride: string | null; ready: boolean } } | null }).__townRide?.()?.you ?? null), { timeout: 30_000 })
    .toEqual(expect.objectContaining({ ride: won[0]!.def, ready: true }));
  await page.waitForTimeout(800);
  await shot(page, "town");

  // A sixth game grants nothing: still one crate, opened, one ride, no notice.
  expect(await finishGame(page)).toBe(true);
  locker = await lockerNow(page);
  expect(locker.welcome).toMatchObject({ status: "opened", notice: false });
  expect(locker.items.filter((i) => i.def.endsWith("-hunchess"))).toHaveLength(1);
  expect(errors).toEqual([]);
});
