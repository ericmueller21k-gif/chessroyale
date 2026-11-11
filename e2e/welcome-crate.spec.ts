import { expect, type Page } from "@playwright/test";
import { HUNCHESS_RIDES, WELCOME_CRATE_ID, XP } from "@chessroyale/core";
import { asSignedIn, named, test } from "./helpers.ts";

/**
 * The HunChess Welcome Crate (Eric, Nov 6; docs/decisions/2026-11-06-welcome-crate.md), on a phone and a computer: a signed-in
 * account finishes 5 games (through the app's own result path, POST /api/results, as a solo result screen saves one: the fastest
 * real path), sees the one-time "You earned a Welcome Crate!" notice, opens the crate in the Crates tab (the usual strip, Fischer
 * Random, the reveal) to a HunChess ride, rides it in the town, finds "Not tradeable" and no trade or listing anywhere, and a sixth
 * game grants nothing more. Both Welcome Crate rows show from the start (Eric, Nov 6: "1 out of 5 … 1 out of 25"), each with its
 * own meter; crate 1 opens at 5 games, crate 2 at 25. WELCOME_SHOTS=<dir>: the stills for the PR (docs/welcome-meters/).
 */

test.use({ actionTimeout: 15_000 });
const SHOTS = process.env.WELCOME_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${test.info().project.name}.png` });
};

type LockerNow = { items: { id: string; def: string; blemish: number }[]; welcome: { games: number; next: number | null; unopened: number; status: string; notice: boolean; item?: string } };
const lockerNow = (page: Page) => page.evaluate(async () => (await (await fetch("/api/locker")).json()) as LockerNow);
/**
 * One finished game, saved as a solo game saves it (the app's own path): the server times it from its start (the test switch
 * ?xpgame counts it as a minute long: WELCOME_GIFT.soloMinSeconds), then its result with XP.minMoves moves. Since Nov 10 a result
 * the server never timed, or timed shorter, or with fewer moves, doesn't count toward a Welcome Crate.
 */
const finishGame = (page: Page) =>
  page.evaluate(async (moves) => {
    const json = { "content-type": "application/json" };
    const { game } = (await (await fetch("/api/xp/solo/start", { method: "POST", headers: json, body: JSON.stringify({ xpgame: 1 }) })).json()) as { game: string };
    return (await fetch("/api/results", { method: "POST", headers: json, body: JSON.stringify({ mode: "classic", placement: 2, players: 8, evalBar: true, moves, game }) })).ok;
  }, XP.minMoves);

test("the Welcome Crates: 5 finished games earn the first once; its notice, opening it to a HunChess ride, riding it in the town, never tradeable; a sixth game grants nothing; 25 earn the second, a different ride", { tag: "@phone-only" }, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await named(page, "Tess");
  await page.goto("/");
  await asSignedIn(page, "welcome");
  await page.reload();

  // No games yet: both Welcome Crates are in the Crates tab from the start, locked, each with its own meter (greyed, not hidden).
  await page.goto("/shop?crates");
  const rowOf = (n: number) => page.locator(`.welcome-crate-row[data-welcome-n="${n}"]`);
  const row1 = rowOf(1);
  const row2 = rowOf(2);
  await expect(page.locator(`.welcome-crate-row[data-crate="${WELCOME_CRATE_ID}"]`)).toHaveCount(2);
  await expect(row1).toContainText("Welcome Crate 1");
  await expect(row2).toContainText("Welcome Crate 2");
  for (const row of [row1, row2]) {
    await expect(row).toContainText("Thank you for being an early tester!");
    await expect(row.locator(".not-tradeable")).toHaveText("Not tradeable");
    await expect(row).toHaveClass(/locked/);
    await expect(row.locator(".welcome-lock")).toHaveCount(1);
  }
  await expect(row1).toContainText("0/5");
  await expect(row1).toContainText("Finish 5 games to unlock");
  await expect(row2).toContainText("0/25");
  await expect(row2).toContainText("Finish 25 games to unlock");

  // A result the server never timed (an empty post, the outside review's Nov 10 finding): saved, but not counted.
  expect(await page.evaluate(async () => (await fetch("/api/results", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "classic", placement: 1, players: 8 }) })).ok)).toBe(true);
  expect((await lockerNow(page)).welcome).toMatchObject({ status: "locked", games: 0 });

  // Three games: each meter counts them.
  for (let i = 0; i < 3; i++) expect(await finishGame(page)).toBe(true);
  expect((await lockerNow(page)).welcome).toMatchObject({ status: "locked", games: 3, notice: false });
  await page.goto("/shop?crates");
  await expect(row1).toContainText("3/5");
  await expect(row2).toContainText("3/25");
  await expect(row1).toHaveClass(/locked/);
  await shot(page, "locked-3");

  // Four games: 4/5 (crate 2 still 4/25).
  expect(await finishGame(page)).toBe(true);
  expect((await lockerNow(page)).welcome).toMatchObject({ status: "locked", games: 4, notice: false });
  await page.goto("/shop?crates");
  await expect(row1).toContainText("4/5");
  await expect(row2).toContainText("4/25");
  await expect(row1).toHaveClass(/locked/);

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

  // The inventory: crate 1 ready (a full bar, Open); crate 2 still locked at 5/25.
  await page.goto("/shop?crates");
  await expect(row1).toContainText("Ready");
  await expect(row1).toContainText("5/5");
  await expect(row1).not.toHaveClass(/locked/);
  await expect(row2).toContainText("5/25");
  await expect(row2).toHaveClass(/locked/);
  await shot(page, "one-ready");
  await row1.click();
  const hero = page.locator(".welcome-crate-hero");
  await expect(hero).toContainText("Welcome Crate 1");
  await expect(hero).toContainText("Thank you for being an early tester!");
  await expect(hero.locator(".not-tradeable")).toHaveText("Not tradeable");
  // No purity anywhere on its page (Eric: "Purity isn't listed for these").
  await expect(page.locator(".welcome-page")).not.toContainText(/purity/i);
  await expect(page.locator(".welcome-page .odds-row")).toHaveCount(HUNCHESS_RIDES.length);
  await shot(page, "crate-card");
  // (Locked, not ready, its Open greyed; the second crate's page says what it needs.)
  await page.goto("/shop?crates");
  await row2.click();
  await expect(page.locator(".welcome-crate-hero")).toContainText("Welcome Crate 2");
  await expect(page.locator(".welcome-progress")).toHaveText("Finish 25 games to unlock");
  await expect(page.getByRole("button", { name: /^▶ Open$/ })).toBeDisabled();
  await page.locator(".welcome-page").getByRole("button", { name: "‹ Crates" }).click();
  await row1.click();

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
  // Crate 1 now reads Opened, with its ride; crate 2 is still locked at 5/25 (Eric: "the first one you get after 5 games, the next one
  // you get after 25").
  await expect(page.locator(".welcome-crate-hero .welcome-progress")).toHaveText("Opened");
  await expect(page.getByRole("button", { name: /^▶ Open$/ })).toBeDisabled();
  await page.goto("/shop?crates");
  await expect(row1).toContainText("Opened");
  await expect(row2).toContainText("5/25");
  await expect(row2).toHaveClass(/locked/);

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
  // (Its own label says "not tradeable": a button named for trading, selling or listing would be a word of its own.)
  await expect(page.getByRole("button", { name: /\b(trade|sell|list)\b/i })).toHaveCount(0);
  // (One pawn in the preview since Nov 7: your default color, W or B.)
  await expect(page.locator(".locker-preview .avatar.riding")).toHaveCount(1);
  await shot(page, "not-tradeable");

  // Your profile: your pawn rides it, and Wearing lists it with no purity and no shine ("Ride · HunChess gold & black · Not tradeable").
  await page.goto("/");
  await page.getByRole("button", { name: "View profile", exact: true }).click();
  await expect(page.locator(`.fd-card .avatar.riding[data-ride="${won[0]!.def}"]`)).toHaveCount(1);
  const wearing = page.locator(".fd-item").filter({ hasText: "HunChess " });
  await expect(wearing).toContainText("Ride · HunChess gold & black · Not tradeable");
  await expect(wearing).not.toContainText(/pure|purity|shiny|%/i);
  await expect(wearing.locator(".item-art.shiny")).toHaveCount(0);

  // Riding it in the town: your pawn on the HunChess ride, its frames ready.
  await page.goto("/town?sky=day");
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __townRide?: () => { you: { ride: string | null; ready: boolean } } | null }).__townRide?.()?.you ?? null), { timeout: 30_000 })
    .toEqual(expect.objectContaining({ ride: won[0]!.def, ready: true }));
  await page.waitForTimeout(800);
  await shot(page, "town");

  // A sixth game grants nothing: still one crate, opened, one ride, no notice; the next is at 25.
  expect(await finishGame(page)).toBe(true);
  locker = await lockerNow(page);
  expect(locker.welcome).toMatchObject({ status: "opened", notice: false, next: 25, games: 6 });
  expect(locker.items.filter((i) => i.def.endsWith("-hunchess"))).toHaveLength(1);

  // The second at 25: its notice, then it opens to a different HunChess ride.
  for (let i = 6; i < 24; i++) expect(await finishGame(page)).toBe(true);
  expect((await lockerNow(page)).welcome).toMatchObject({ status: "opened", next: 25, games: 24, notice: false });
  expect(await finishGame(page)).toBe(true);
  await page.goto("/");
  await expect(page.locator(".welcome-notice")).toContainText("You earned a Welcome Crate!", { timeout: 20_000 });
  await page.locator(".welcome-notice").getByRole("button", { name: "▶ OK" }).click();
  await page.goto("/shop?crates");
  await expect(row2).toContainText("Ready");
  await expect(row2).toContainText("25/25");
  await row2.click();
  await page.getByRole("button", { name: /^▶ Open$/ }).click();
  await expect(reveal).toBeVisible({ timeout: 40_000 });
  await expect(reveal.locator(".reveal-name")).toHaveText(/^HunChess /);
  await reveal.getByRole("button", { name: "▶ Done" }).click();
  await expect(page.locator(".welcome-crate-hero .welcome-progress")).toHaveText("Opened");
  await page.goto("/shop?crates");
  await expect(row1).toContainText("Opened");
  await expect(row2).toContainText("Opened");
  await expect(row1).not.toHaveClass(/locked/);
  await expect(row2).not.toHaveClass(/locked/);
  await shot(page, "both-opened");
  locker = await lockerNow(page);
  const both = locker.items.filter((i) => i.def.endsWith("-hunchess"));
  expect(both).toHaveLength(2);
  expect(new Set(both.map((i) => i.def)).size).toBe(2);
  expect(locker.welcome).toMatchObject({ status: "opened", next: null, unopened: 0, notice: false });
  expect(errors).toEqual([]);
});
